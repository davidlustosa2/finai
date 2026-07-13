import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import cron from "node-cron";
import * as fs from "fs";

// Initialize Firebase Admin with custom database ID from local configuration
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

let appAdmin;

if (getApps().length === 0) {
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountVar) {
    let trimmedKey = serviceAccountVar.trim();
    try {
      console.log("[Firebase Admin] Inicializando com chave de Conta de Serviço de FIREBASE_SERVICE_ACCOUNT_KEY.");
      let serviceAccount;
      
      // Remove any leading/trailing quotes if they wrap the env variable (common in some hosting environments)
      if ((trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) || (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))) {
        trimmedKey = trimmedKey.slice(1, -1).trim();
      }

      console.log(`[Firebase Admin] Chave detectada com tamanho ${trimmedKey.length}. Inicial: "${trimmedKey.substring(0, Math.min(trimmedKey.length, 30))}..."`);
      
      if (trimmedKey === "{" || (trimmedKey.startsWith("{") && !trimmedKey.endsWith("}"))) {
        console.error("[Firebase Admin] ALERTA CRÍTICO: Sua chave FIREBASE_SERVICE_ACCOUNT_KEY parece estar cortada/trunca.");
        console.error("[Firebase Admin] Isso ocorre porque quebras de linha em arquivos .env costumam cortar o valor no primeiro newline.");
        console.error("[Firebase Admin] Por favor, converta seu JSON do Firebase para uma única linha (removendo quebras de linha) OU converta-o para Base64!");
        throw new Error("Chave Firebase Service Account corrompida ou incompleta no arquivo .env (provavelmente cortada devido a quebras de linha)");
      }

      if (trimmedKey.startsWith("{") && trimmedKey.endsWith("}")) {
        // inline JSON
        serviceAccount = JSON.parse(trimmedKey);
      } else {
        // Assume Base64. Try to decode it.
        try {
          const decoded = Buffer.from(trimmedKey, "base64").toString("utf-8");
          const decodedTrimmed = decoded.trim();
          if (decodedTrimmed.startsWith("{") && decodedTrimmed.endsWith("}")) {
            serviceAccount = JSON.parse(decodedTrimmed);
            console.log("[Firebase Admin] Chave Base64 decodificada e parseada com SUCESSO!");
          } else {
            throw new Error("O valor decodificado de Base64 não parece ser um JSON válido (não começa com '{' e termina com '}').");
          }
        } catch (base64Err: any) {
          console.error("[Firebase Admin] Erro de decodificação Base64:", base64Err.message);
          // Fallback to direct JSON.parse in case it's actually some weird formatted JSON on a single line
          serviceAccount = JSON.parse(trimmedKey);
        }
      }
      appAdmin = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("[Firebase Admin] Inicializado com SUCESSO usando Conta de Serviço!");
    } catch (err: any) {
      console.error("[Firebase Admin] Erro fatal lendo FIREBASE_SERVICE_ACCOUNT_KEY:", err.message);
      console.error("[Firebase Admin] Detalhes dos primeiros 15 caracteres:", Array.from(trimmedKey.substring(0, Math.min(trimmedKey.length, 15))).map(c => `${c === '\n' ? '\\n' : c === '\r' ? '\\r' : c} (code:${c.charCodeAt(0)})`).join(", "));
      console.error("[Firebase Admin] Inicializando em modo desenvolvimento/sem permissões administrativas completas.");
      appAdmin = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  } else {
    console.log("[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY não encontrada. Usando padrão de credenciais padrão do ambiente.");
    appAdmin = initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
} else {
  appAdmin = getApp();
}

const dbAdmin = getFirestore(appAdmin, firebaseConfig.firestoreDatabaseId);

// Core date utility resolving strictly to America/Sao_Paulo
const tzParts = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`; // YYYY-MM-DD
};

// Helper to format Brazilian phone numbers into valid format variants for Evolution API
function getPhoneVariants(phone: string): string[] {
  // Strip non-digits
  let digits = phone.replace(/\D/g, "");
  
  if (!digits) return [];

  // If length is 10 or 11, it's missing the country code (55)
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }

  const variants: string[] = [digits];

  // If start with 55 (Brazil) and has length 13, maybe we can try removing the 9th digit (at index 4)
  // e.g., 55 61 9 8205 9338 -> 55 61 8205 9338 (length 13 -> length 12)
  if (digits.startsWith("55") && digits.length === 13 && digits[4] === "9") {
    const without9 = digits.substring(0, 4) + digits.substring(5);
    if (!variants.includes(without9)) {
      variants.push(without9);
    }
  }

  // If start with 55 (Brazil) and has length 12, maybe we can try adding the 9th digit '9' after the DDD (at index 4)
  // e.g., 55 61 8205 9338 -> 55 61 9 8205 9338 (length 12 -> length 13)
  if (digits.startsWith("55") && digits.length === 12) {
    const with9 = digits.substring(0, 4) + "9" + digits.substring(4);
    if (!variants.includes(with9)) {
      variants.push(with9);
    }
  }

  return variants;
}

// Background monitoring task with payload fallback for secure client-side bypass of IAM rules
async function monitorarVencimentos(payload?: {
  userId?: string;
  telefoneWhatsapp?: string;
  transactions?: any[];
  sentAlertsIds?: string[];
}) {
  console.log("[monitorarVencimentos] Iniciando verificação de vencimentos...");
  
  const now = new Date();
  const todayStr = tzParts(now);
  const d2Date = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const d2Str = tzParts(d2Date);
  
  console.log(`[monitorarVencimentos] Hoje: ${todayStr}, Daqui a 2 dias: ${d2Str}`);
  
  const summary = {
    totalUsersProcessed: 0,
    alertsSent: 0,
    failures: 0,
    details: [] as string[],
    newAlerts: [] as any[] // List of newly sent alerts to save client-side
  };

  const apiKey = process.env.AUTHENTICATION_API_KEY || "";
  if (!apiKey) {
    const errMsg = "[monitorarVencimentos] ERRO: AUTHENTICATION_API_KEY não configurada no ambiente!";
    console.error(errMsg);
    summary.details.push(errMsg);
    return summary;
  }

  try {
    let usersList: { id: string; telefoneWhatsapp?: string }[] = [];
    let isPayloadMode = false;

    if (payload && payload.userId && payload.transactions) {
      isPayloadMode = true;
      usersList = [{
        id: payload.userId,
        telefoneWhatsapp: payload.telefoneWhatsapp
      }];
      console.log(`[monitorarVencimentos] Executando em MODO PAYLOAD de cliente para usuário ${payload.userId}`);
    } else {
      console.log("[monitorarVencimentos] Executando em MODO CRON/ADMIN. Buscando usuários no Firestore...");
      try {
        const usersSnapshot = await dbAdmin.collection("users").get();
        usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          telefoneWhatsapp: doc.data().telefoneWhatsapp
        }));
      } catch (adminErr: any) {
        console.warn("[monitorarVencimentos] Falha ao listar usuários via Admin SDK (Acesso IAM negado):", adminErr.message);
        summary.details.push(`Aviso: Acesso administrativo IAM negado no Cloud Run. Retornando erro amigável.`);
        return {
          ...summary,
          success: false,
          error: "PERMISSION_DENIED_IAM",
          message: "O servidor no Cloud Run não possui permissão administrativa de IAM para ler coleções do Firestore diretamente. Ativando fallback seguro via cliente."
        };
      }
    }
    
    for (const user of usersList) {
      const userId = user.id;
      const telefoneWhatsapp = user.telefoneWhatsapp;
      
      if (!telefoneWhatsapp || typeof telefoneWhatsapp !== 'string' || !telefoneWhatsapp.trim()) {
        continue;
      }
      
      summary.totalUsersProcessed++;
      const cleanPhone = telefoneWhatsapp.replace(/\D/g, "");
      
      if (!cleanPhone) {
        console.log(`[monitorarVencimentos] Número de WhatsApp vazio após higienização para o usuário ${userId}`);
        continue;
      }
      
      console.log(`[monitorarVencimentos] Processando usuário ${userId} com WhatsApp: ${cleanPhone}`);
      
      let pendingExpenses: any[] = [];
      if (isPayloadMode && payload && payload.transactions) {
        pendingExpenses = payload.transactions
          .filter((t: any) => t.type === "expense" && !t.settled);
      } else {
        try {
          const transSnapshot = await dbAdmin.collection("transactions")
            .where("uid", "==", userId)
            .where("type", "==", "expense")
            .get();
            
          pendingExpenses = transSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() as any }))
            .filter(t => !t.settled);
        } catch (transErr: any) {
          console.error(`[monitorarVencimentos] Falha ao buscar transações do usuário ${userId}:`, transErr.message);
          summary.failures++;
          summary.details.push(`Erro ao carregar transações para o usuário ${userId}: ${transErr.message}`);
          continue;
        }
      }
      
      console.log(`[monitorarVencimentos] Usuário ${userId} possui ${pendingExpenses.length} despesas pendentes.`);
        
      const alertsToDispatch: {
        transaction: any;
        tipoAlerta: 'D0' | 'D-2';
        alertId: string;
        tDateOnly: string;
      }[] = [];

      for (const t of pendingExpenses) {
        const tDateOnly = t.date ? t.date.split('T')[0] : '';
        let tipoAlerta: 'D0' | 'D-2' | null = null;
        
        if (tDateOnly === todayStr) {
          tipoAlerta = 'D0';
        } else if (tDateOnly === d2Str) {
          tipoAlerta = 'D-2';
        }
        
        if (!tipoAlerta) continue;
        
        const alertId = `${t.id}_${tipoAlerta}`;
        
        let alreadySent = false;
        if (isPayloadMode && payload && payload.sentAlertsIds) {
          alreadySent = payload.sentAlertsIds.includes(alertId);
        } else {
          try {
            const alertRef = dbAdmin.collection("users").doc(userId).collection("alertas_despesas").doc(alertId);
            const alertDoc = await alertRef.get();
            alreadySent = alertDoc.exists;
          } catch (dbErr) {
            console.warn(`[monitorarVencimentos] Não foi possível verificar se alerta ${alertId} existe no Firestore Admin:`, dbErr);
          }
        }
        
        if (!alreadySent) {
          alertsToDispatch.push({
            transaction: t,
            tipoAlerta,
            alertId,
            tDateOnly
          });
        }
      }

      if (alertsToDispatch.length === 0) {
        console.log(`[monitorarVencimentos] Nenhuma despesa pendente qualificada para envio para o usuário ${userId}.`);
        continue;
      }

      // Construct consolidated message matching the requested pattern
      const messageLines = ["📌 *Lembrete financeiro*", "", "Despesas próximas do vencimento:", ""];

      const d0Alerts = alertsToDispatch.filter(a => a.tipoAlerta === 'D0');
      const d2Alerts = alertsToDispatch.filter(a => a.tipoAlerta === 'D-2');

      const formattedDateToday = new Date(todayStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const formattedDateD2 = new Date(d2Str + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      if (d0Alerts.length > 0) {
        messageLines.push(`Hoje — ${formattedDateToday}`);
        d0Alerts.forEach(a => {
          const amt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.transaction.amount);
          messageLines.push(`• ${a.transaction.description} — ${amt}`);
        });
        messageLines.push("");
      }

      if (d2Alerts.length > 0) {
        messageLines.push(`Em 2 dias — ${formattedDateD2}`);
        d2Alerts.forEach(a => {
          const amt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.transaction.amount);
          messageLines.push(`• ${a.transaction.description} — ${amt}`);
        });
        messageLines.push("");
      }

      const totalSum = alertsToDispatch.reduce((acc, a) => acc + a.transaction.amount, 0);
      const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSum);

      messageLines.push(`Total: ${formattedTotal}`);
      messageLines.push("");
      messageLines.push("Por favor, efetue o pagamento para manter suas contas em dia! 🙏");

      const textMessage = messageLines.join("\n");

      const candidatePhones = getPhoneVariants(cleanPhone);
      console.log(`[monitorarVencimentos] Candidatos para usuário ${userId}:`, candidatePhones);

      let sentSuccess = false;
      let lastError: any = null;
      let finalPhoneUsed = cleanPhone;
      let lastResponseData: any = null;

      for (const phone of candidatePhones) {
        console.log(`[monitorarVencimentos] Tentando enviar mensagem consolidada para ${phone}...`);
        try {
          const response = await fetch("https://evolutionapi.davidlustosa.com.br/message/sendText/mano", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": apiKey
            },
            body: JSON.stringify({
              number: phone,
              text: textMessage
            })
          });
          
          let responseData: any = {};
          try {
            responseData = await response.json();
          } catch (_) {
            responseData = { text: "Sem conteúdo JSON" };
          }

          lastResponseData = responseData;

          if (response.ok) {
            sentSuccess = true;
            finalPhoneUsed = phone;
            break;
          } else {
            const isDoesNotExist = response.status === 400 && 
              (JSON.stringify(responseData).includes("exists\":false") || JSON.stringify(responseData).includes("não existe"));
            
            if (isDoesNotExist) {
              console.warn(`[monitorarVencimentos] Número ${phone} não cadastrado no WhatsApp (exists: false).`);
              lastError = new Error(`Número ${phone} não registrado no WhatsApp (exists: false)`);
            } else {
              lastError = new Error(`Evolution API retornou status HTTP ${response.status} - ${JSON.stringify(responseData)}`);
            }
          }
        } catch (err: any) {
          console.error(`[monitorarVencimentos] Erro de rede/API ao tentar enviar para ${phone}:`, err.message);
          lastError = err;
        }
      }

      for (const item of alertsToDispatch) {
        const { transaction: t, tipoAlerta, alertId } = item;
        try {
          if (!sentSuccess) {
            throw lastError || new Error("Falha ao enviar mensagem para todos os formatos de número testados");
          }
          
          const alertReport = {
            id: alertId,
            despesaId: t.id,
            tipoAlerta,
            status: "success",
            recipient: finalPhoneUsed,
            message: textMessage,
            response: lastResponseData
          };

          // Try saving success alert doc to backend dbAdmin (best-effort)
          try {
            const alertRef = dbAdmin.collection("users").doc(userId).collection("alertas_despesas").doc(alertId);
            await alertRef.set({
              ...alertReport,
              sentAt: FieldValue.serverTimestamp()
            });
          } catch (dbErr: any) {
            console.log(`[monitorarVencimentos] Admin SDK ignorou gravação direta. Persistência repassada ao cliente.`);
          }
          
          summary.alertsSent++;
          summary.newAlerts.push(alertReport);
          summary.details.push(`Sucesso: Alerta ${tipoAlerta} enviado para ${finalPhoneUsed} de despesa "${t.description}"`);
          console.log(`[monitorarVencimentos] Alerta enviado com sucesso de despesa "${t.description}" para ${finalPhoneUsed}`);
        } catch (err: any) {
          summary.failures++;
          const alertReportError = {
            id: alertId,
            despesaId: t.id,
            tipoAlerta,
            status: "error",
            error: err.message,
            recipient: finalPhoneUsed,
            message: textMessage
          };

          // Try saving failed alert doc to backend dbAdmin (best-effort)
          try {
            const alertRef = dbAdmin.collection("users").doc(userId).collection("alertas_despesas").doc(alertId);
            await alertRef.set({
              ...alertReportError,
              sentAt: FieldValue.serverTimestamp()
            });
          } catch (dbErr: any) {
            console.log(`[monitorarVencimentos] Falha ao registrar alerta fracasso via Admin SDK (Falta de permissão IAM).`);
          }

          summary.newAlerts.push(alertReportError);
          summary.details.push(`Erro: Falha ao enviar alerta para ${finalPhoneUsed} de despesa "${t.description}": ${err.message}`);
          console.error(`[monitorarVencimentos] Erro ao enviar alerta para ${finalPhoneUsed}:`, err);
        }
      }
    }
  } catch (err: any) {
    console.error("[monitorarVencimentos] Erro geral ao processar:", err);
    summary.details.push(`Erro Geral: ${err.message}`);
  }
  
  return summary;
}

// Background routine to extend active recurring transactions on the server database
async function estenderLancamentosRecorrentes(targetUserId?: string) {
  console.log("[estenderLancamentosRecorrentes] Iniciando verificação de extensão...");
  const summary = {
    processedUsers: 0,
    extendedGroups: 0,
    totalCreated: 0,
    failures: 0,
    details: [] as string[]
  };

  try {
    let userIds: string[] = [];
    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      try {
        const usersSnapshot = await dbAdmin.collection("users").get();
        userIds = usersSnapshot.docs.map(doc => doc.id);
      } catch (err: any) {
        console.warn("[estenderLancamentosRecorrentes] Falha ao listar usuários via Admin SDK (Falta de permissão IAM):", err.message);
        summary.details.push(`Aviso: Falha ao obter usuários no servidor.`);
        return summary;
      }
    }

    const todayStr = tzParts(new Date());
    const todayTime = new Date(todayStr + "T12:00:00").getTime();

    for (const uid of userIds) {
      summary.processedUsers++;
      try {
        const transSnapshot = await dbAdmin.collection("transactions")
          .where("uid", "==", uid)
          .where("isRecurringEntry", "==", true)
          .get();

        const transactions = transSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as any
        }));

        if (transactions.length === 0) {
          continue;
        }

        const groups: { [gId: string]: any[] } = {};
        transactions.forEach(t => {
          if (t.recurringGroup) {
            const gId = String(t.recurringGroup);
            if (!groups[gId]) groups[gId] = [];
            groups[gId].push(t);
          }
        });

        for (const gId of Object.keys(groups)) {
          const groupTrans = groups[gId];
          groupTrans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const futureOrTodayCount = groupTrans.filter(t => {
            const tTime = new Date(t.date).getTime();
            return tTime >= todayTime;
          }).length;

          // If there are zero future transactions left, the series has been cancelled, deleted, or naturally finished.
          if (futureOrTodayCount === 0) {
            console.log(`[estenderLancamentosRecorrentes] Grupo ${gId} do usuário ${uid} não possui lançamentos para hoje ou futuros (cancelado ou finalizado). Pulando.`);
            continue;
          }

          const needed = 36 - futureOrTodayCount;
          if (needed > 0) {
            console.log(`[estenderLancamentosRecorrentes] Grupo ${gId} do usuário ${uid} precisa de mais ${needed} lançamentos.`);
            const archetype = groupTrans[groupTrans.length - 1];
            const frequency = archetype.recurringFrequency || 'monthly';
            const lastDate = new Date(archetype.date);

            const batch = dbAdmin.batch();
            let addedCount = 0;

            for (let i = 1; i <= needed; i++) {
              const nextDate = new Date(lastDate);
              if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + i);
              else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + i * 7);
              else if (frequency === 'annually') nextDate.setFullYear(nextDate.getFullYear() + i);
              else nextDate.setMonth(nextDate.getMonth() + i);

              const newDocRef = dbAdmin.collection("transactions").doc();
              const payload = {
                uid,
                description: archetype.description || "",
                amount: archetype.amount || 0,
                type: archetype.type || "expense",
                category: archetype.category || "Outros",
                account: archetype.account || "",
                date: nextDate.toISOString(),
                isRecurringEntry: true,
                recurringGroup: archetype.recurringGroup,
                recurringFrequency: frequency,
                settled: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
              };

              batch.set(newDocRef, payload);
              addedCount++;
            }

            await batch.commit();
            summary.extendedGroups++;
            summary.totalCreated += addedCount;
            summary.details.push(`Sucesso: Grupo ${gId} do usuário ${uid} estendido por mais ${addedCount} lançamentos.`);
          }
        }
      } catch (uidErr: any) {
        console.error(`[estenderLancamentosRecorrentes] Falha para usuário ${uid}:`, uidErr.message);
        summary.failures++;
        summary.details.push(`Erro para o usuário ${uid}: ${uidErr.message}`);
      }
    }
  } catch (err: any) {
    console.error("[estenderLancamentosRecorrentes] Erro geral:", err.message);
    summary.details.push(`Erro grave geral: ${err.message}`);
  }

  return summary;
}

// Daily scheduling at 08:00 (America/Sao_Paulo)
cron.schedule("0 8 * * *", async () => {
  console.log("[CRON] Executando monitorarVencimentos e estenderLancamentosRecorrentes agendados às 08:00...");
  try {
    await monitorarVencimentos();
  } catch (err) {
    console.error("[CRON] Erro crítico no agendador monitorarVencimentos:", err);
  }
  try {
    const extSummary = await estenderLancamentosRecorrentes();
    console.log("[CRON] Sucesso na extensão programada de lançamentos:", extSummary);
  } catch (err) {
    console.error("[CRON] Erro crítico no agendador estenderLancamentosRecorrentes:", err);
  }
}, {
  timezone: "America/Sao_Paulo"
});

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // API Key for Gemini
  const apiKey = process.env.GEMINI_API_KEY || "";
  const genAI = new GoogleGenerativeAI(apiKey);

  // AI Proxy Routes
  app.post("/api/ai/command", async (req, res) => {
    const { message } = req.body;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const prompt = `
        Você é um assistente financeiro especializado em interpretar mensagens do WhatsApp para um sistema de gestão financeira.
        Analise a seguinte mensagem do usuário: "${message}"

        Determine se é um COMANDO (registrar transação) ou uma CONSULTA (perguntar saldo, gastos, etc).

        Se for COMANDO, retorne um JSON seguindo o schema de transação:
        { "type": "income|expense", "amount": number, "description": "str", "category": "str", "date": "ISO8601 ou 'hoje'" }

        Se for CONSULTA, retorne um JSON seguindo o schema de consulta:
        { "queryType": "balance|expense_report|savings", "timeRange": "month|week|day" }

        Retorne APENAS o JSON.
      `;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      const response = await result.response;
      res.json(JSON.parse(response.text()));
    } catch (e: any) {
      console.error("AI Proxy Error:", e);
      res.status(500).json({ error: "Failed to process AI command" });
    }
  });

  app.post("/api/ai/insights", async (req, res) => {
    // Desativado temporariamente conforme pedido do usuário
    res.json({ insights: [] });
  });

  // Diagnostic manual trigger for WhatsApp vencimentos notifications
  app.post("/api/admin/monitor-vencimentos", async (req, res) => {
    try {
      const { userId, telefoneWhatsapp, transactions, sentAlertsIds } = req.body;
      
      const payload = userId && transactions ? {
        userId,
        telefoneWhatsapp,
        transactions,
        sentAlertsIds
      } : undefined;

      const summary = await monitorarVencimentos(payload);
      res.json({ success: true, summary });
    } catch (err: any) {
      console.error("[POST /api/admin/monitor-vencimentos] Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Diagnostic manual trigger to extend active recurring transactions on server-side
  app.post("/api/admin/estender-recorrencias", async (req, res) => {
    try {
      const { userId } = req.body;
      const summary = await estenderLancamentosRecorrentes(userId);
      res.json({ success: true, summary });
    } catch (err: any) {
      console.error("[POST /api/admin/estender-recorrencias] Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Secure Cron Trigger endpoint for external schedulers (e.g., cron-job.org / n8n)
  app.all("/api/cron-trigger", async (req, res) => {
    const queryToken = req.query.token || (req.body && req.body.token) || req.headers["x-cron-token"];
    const serverToken = process.env.CRON_SECRET_TOKEN;

    if (serverToken && queryToken !== serverToken) {
      console.warn("[CRON_TRIGGER] Tentativa de ativação externa negada: token inválido.");
      return res.status(401).json({ success: false, error: "Não autorizado: Token inválido ou ausente." });
    }

    console.log("[CRON_TRIGGER] Chamada externa aceita. Iniciando monitoramento e extensão automáticos...");
    const results: any = {
      timestamp: new Date().toISOString(),
      alerts: null,
      extensions: null
    };

    try {
      results.alerts = await monitorarVencimentos();
    } catch (err: any) {
      console.error("[CRON_TRIGGER] Erro no monitorarVencimentos externo:", err);
      results.alerts = { success: false, error: err.message };
    }

    try {
      results.extensions = await estenderLancamentosRecorrentes();
    } catch (err: any) {
      console.error("[CRON_TRIGGER] Erro no estenderLancamentosRecorrentes externo:", err);
      results.extensions = { success: false, error: err.message };
    }

    res.json({ success: true, results });
  });

  // Helper functions for WhatsApp integrations
  async function findUserByPhone(phone: string): Promise<any | null> {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return null;

    let nationalPhone = cleanPhone;
    if (cleanPhone.startsWith("55") && cleanPhone.length > 2) {
      nationalPhone = cleanPhone.substring(2);
    }

    const possibleValues = new Set<string>();
    possibleValues.add(cleanPhone);
    possibleValues.add(nationalPhone);

    if (nationalPhone.length === 11 && nationalPhone[2] === "9") {
      const without9 = nationalPhone.substring(0, 2) + nationalPhone.substring(3);
      possibleValues.add(without9);
      possibleValues.add("55" + without9);
    }

    if (nationalPhone.length === 10) {
      const with9 = nationalPhone.substring(0, 2) + "9" + nationalPhone.substring(2);
      possibleValues.add(with9);
      possibleValues.add("55" + with9);
    }

    try {
      const usersSnapshot = await dbAdmin.collection("users").get();
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        const userPhone = userData.telefoneWhatsapp;
        if (userPhone && typeof userPhone === "string") {
          const cleanUserPhone = userPhone.replace(/\D/g, "");
          if (possibleValues.has(cleanUserPhone)) {
            return { id: doc.id, ...userData };
          }
          let userNational = cleanUserPhone;
          if (cleanUserPhone.startsWith("55") && cleanUserPhone.length > 2) {
            userNational = cleanUserPhone.substring(2);
          }
          if (possibleValues.has(userNational)) {
            return { id: doc.id, ...userData };
          }
        }
      }
    } catch (err: any) {
      console.error("[findUserByPhone] Erro ao buscar usuário no Firestore:", err.message);
    }
    return null;
  }

  async function sendWhatsAppMessage(phone: string, text: string) {
    const apiKey = process.env.AUTHENTICATION_API_KEY || "";
    if (!apiKey) {
      console.error("[sendWhatsAppMessage] Erro: AUTHENTICATION_API_KEY não configurada no ambiente!");
      return false;
    }
    const candidatePhones = getPhoneVariants(phone);
    let success = false;
    for (const p of candidatePhones) {
      try {
        const res = await fetch("https://evolutionapi.davidlustosa.com.br/message/sendText/mano", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            number: p,
            text: text
          })
        });
        if (res.ok) {
          success = true;
          console.log(`[sendWhatsAppMessage] Mensagem enviada com sucesso para ${p}`);
          break;
        }
      } catch (err: any) {
        console.error(`[sendWhatsAppMessage] Erro enviando para ${p}:`, err.message);
      }
    }
    return success;
  }

  function calculateBalances(transactions: any[], cards: any[], filterAccount?: string) {
    let initialBalance = 0;
    const filterLower = filterAccount?.toLowerCase().trim();
    const isFiltered = filterLower && filterLower !== "all";

    if (isFiltered) {
      const matchingCard = cards.find(c => (c.name || "").toLowerCase().trim() === filterLower);
      if (matchingCard) {
        initialBalance = Number(matchingCard.limit) || 0;
      }
    } else {
      initialBalance = cards
        .filter(c => c.type === "bank")
        .reduce((acc, c) => acc + (Number(c.limit) || 0), 0);
    }

    const creditCardNames = new Set(cards.filter(c => c.type === "credit").map(c => (c.name || "").toLowerCase().trim()));

    const matchesAccount = (t: any) => {
      if (!isFiltered) {
        const accName = (t.account || "").toLowerCase().trim();
        return !creditCardNames.has(accName);
      }
      return (t.account || "").toLowerCase().trim() === filterLower;
    };

    const calculateRealizedAmount = (t: any) => {
      if (t.payments && t.payments.length > 0) {
        return t.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      }
      if (t.settled) {
        return Number(t.realizedAmount ?? t.amount) || 0;
      }
      return 0;
    };

    let totalIncome = 0;
    let totalExpense = 0;
    let totalRealizedIncome = 0;
    let totalRealizedExpense = 0;

    for (const t of transactions) {
      if (matchesAccount(t)) {
        const amt = Number(t.amount) || 0;
        const realized = calculateRealizedAmount(t);
        if (t.type === "income") {
          totalIncome += amt;
          totalRealizedIncome += realized;
        } else if (t.type === "expense") {
          totalExpense += amt;
          totalRealizedExpense += realized;
        }
      }
    }

    const balanceProjected = initialBalance + totalIncome - totalExpense;
    const balanceRealized = initialBalance + totalRealizedIncome - totalRealizedExpense;

    return {
      balanceProjected,
      balanceRealized,
      totalIncome,
      totalRealizedIncome,
      totalExpense,
      totalRealizedExpense
    };
  }

  // Incoming WhatsApp message Webhook
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      const body = req.body;
      console.log("[WhatsApp Webhook] Recebendo payload:", JSON.stringify(body));

      let sender = "";
      let text = "";
      let fromMe = false;

      if (body.event === "messages.upsert" && body.data) {
        const data = body.data;
        sender = data.key?.remoteJid || "";
        fromMe = !!data.key?.fromMe;
        text = data.message?.conversation || 
               data.message?.extendedTextMessage?.text || 
               data.message?.imageMessage?.caption || 
               "";
      } else if (body.sender && body.text) {
        sender = body.sender;
        text = body.text;
        fromMe = false;
      } else if (body.data?.message) {
        const data = body.data;
        sender = data.key?.remoteJid || "";
        fromMe = !!data.key?.fromMe;
        text = data.message?.conversation || 
               data.message?.extendedTextMessage?.text || 
               "";
      }

      if (fromMe) {
        console.log("[WhatsApp Webhook] Mensagem ignorada (enviada por nós mesmos).");
        return res.sendStatus(200);
      }

      if (!sender || !text) {
        console.log("[WhatsApp Webhook] Sem remetente ou mensagem vazia.");
        return res.sendStatus(200);
      }

      const cleanPhone = sender.split("@")[0].replace(/\D/g, "");
      if (!cleanPhone) {
        console.log("[WhatsApp Webhook] Sem número de telefone válido.");
        return res.sendStatus(200);
      }

      console.log(`[WhatsApp Webhook] Processando mensagem de ${cleanPhone}: "${text}"`);

      const user = await findUserByPhone(cleanPhone);
      if (!user) {
        console.log(`[WhatsApp Webhook] Nenhum usuário cadastrado com o telefone ${cleanPhone}`);
        await sendWhatsAppMessage(cleanPhone, "Olá! Não encontrei nenhuma conta ativa vinculada a este número de WhatsApp. Por favor, acesse o painel do aplicativo e cadastre o seu número de WhatsApp nas configurações de perfil para me autorizar!");
        return res.sendStatus(200);
      }

      console.log(`[WhatsApp Webhook] Usuário identificado: ${user.id}`);

      const transSnapshot = await dbAdmin.collection("transactions").where("uid", "==", user.id).get();
      const transactions = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const cardsSnapshot = await dbAdmin.collection("cards").where("uid", "==", user.id).get();
      const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const todayStr = tzParts(new Date());
      const currentDayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });

      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      const prompt = `
Você é o assistente de inteligência artificial pessoal do sistema de gestão financeira do usuário.
Sua tarefa é analisar a mensagem recebida pelo WhatsApp e identificar qual ação o usuário deseja realizar em suas finanças.

Hoje é: ${todayStr} (${currentDayOfWeek}) - Timezone America/Sao_Paulo.

As contas/cartões cadastrados do usuário são:
${JSON.stringify(cards.map(c => ({ id: c.id, name: c.name, type: c.type, limit: c.limit })))}

As últimas transações do usuário são:
${JSON.stringify(transactions.slice(0, 50).map(t => ({ id: t.id, description: t.description, amount: t.amount, type: t.type, date: t.date ? t.date.split("T")[0] : "", settled: t.settled, account: t.account })))}

Mensagem do usuário: "${text}"

--- REGRA DE CLAREZA CRÍTICA ---
Sempre que a mensagem do usuário não deixar TOTALMENTE claro o que deve ser feito, você deve definir "requiresClarification" como true e fornecer uma resposta polida, amigável e prestativa em "clarificationMessage" (em português) solicitando especificamente as informações que faltam de forma a garantir o entendimento correto e não registrar nenhuma informação de forma errada na base de dados.

Exemplos de falta de clareza (requiresClarification: true):
- "adicione 50 reais": Faltou a descrição e o tipo (receita ou despesa). Pergunte sobre o que foi esse lançamento e se é uma receita ou despesa.
- "paguei a conta": Qual conta? Se houver mais de uma conta pendente com nomes semelhantes, ou se nenhuma conta estiver clara, pergunte qual delas ele pagou.
- "mude o valor da internet para 100": Se houver vários lançamentos de "internet", pergunte qual deles deve ser modificado (fornecendo as opções de datas e valores atuais).
- "cadastre padaria 10 reais": Não especificou se já foi pago (settled: true) ou está pendente (settled: false). Pergunte se o valor já foi pago ou se é um agendamento futuro.
- "oi", "olá", etc: Cumprimente de forma calorosa, apresente-se como seu assistente financeiro pessoal, liste o que você pode fazer (cadastrar, editar, quitar lançamentos, consultar saldos e relatórios de vencimentos) e pergunte como pode ajudar hoje.

Exemplos de mensagens claras (requiresClarification: false):
- "paguei a conta de luz de R$ 150 hoje usando o Nubank": Perfeito! Crie despesa com descrição "Conta de Luz", valor 150, conta "Nubank", data de hoje, settled: true.
- "luz de 150 para pagar amanhã": Perfeito! Crie despesa com descrição "Luz", valor 150, data de amanhã, settled: false.
- "recebi salário de 5000 ontem na conta Itaú": Perfeito! Crie receita com descrição "Salário", valor 5000, conta "Itaú", data de ontem, settled: true.
- "quitar a conta de internet de R$ 90": Se houver uma transação correspondente (por exemplo, descrição "internet" ou "internet fibra" de R$ 90, pendente), selecione o transactionId.
- "quanto tenho de saldo?": query_balance.
- "quais são as contas a pagar esta semana?": query_transactions.

Retorne EXCLUSIVAMENTE um objeto JSON no formato abaixo (sem blocos de código adicionais ou markdown):
{
  "requiresClarification": boolean,
  "clarificationMessage": string | null,
  "action": "create" | "update" | "settle" | "query_balance" | "query_transactions" | null,
  "params": {
    "type": "income" | "expense",
    "amount": number,
    "description": "string",
    "category": "string",
    "date": "YYYY-MM-DD",
    "account": "string",
    "settled": boolean,
    "transactionId": "string",
    "fieldsToUpdate": {
      "amount": number,
      "description": "string",
      "category": "string",
      "date": "YYYY-MM-DD",
      "account": "string",
      "settled": boolean
    },
    "filterAccount": "string",
    "filterType": "all" | "pending" | "settled",
    "timeRange": "today" | "week" | "month" | "upcoming"
  } | null
}
      `;

      let aiResponse: any = {};
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        const resText = await result.response;
        aiResponse = JSON.parse(resText.text());
        console.log("[WhatsApp Webhook] Resposta Gemini:", JSON.stringify(aiResponse));
      } catch (geminiErr: any) {
        console.error("[WhatsApp Webhook] Erro chamando Gemini:", geminiErr.message);
        await sendWhatsAppMessage(cleanPhone, "Desculpe, ocorreu uma instabilidade temporária ao tentar processar sua mensagem. Por favor, tente novamente em instantes.");
        return res.sendStatus(200);
      }

      if (aiResponse.requiresClarification) {
        const reply = aiResponse.clarificationMessage || "Desculpe, não consegui entender exatamente o que deseja. Poderia fornecer mais detalhes?";
        await sendWhatsAppMessage(cleanPhone, reply);
        return res.json({ success: true, action: "clarification_sent", reply });
      }

      const action = aiResponse.action;
      const params = aiResponse.params || {};
      let replyMessage = "";

      if (action === "create") {
        const newDocRef = dbAdmin.collection("transactions").doc();
        const dateStr = params.date || todayStr;
        const isoDate = new Date(dateStr + "T12:00:00").toISOString();
        
        const payload = {
          uid: user.id,
          description: params.description || "Lançamento via WhatsApp",
          amount: Number(params.amount) || 0,
          type: params.type || "expense",
          category: params.category || "Outros",
          account: params.account || "",
          date: isoDate,
          settled: !!params.settled,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        await newDocRef.set(payload);

        const formatAmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payload.amount);
        const emoji = payload.type === "income" ? "📈" : "📉";
        const formattedDate = new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");

        replyMessage = `✅ *Lançamento registrado com sucesso!*\n\n` +
          `${emoji} *Tipo:* ${payload.type === "income" ? "Receita" : "Despesa"}\n` +
          `📝 *Descrição:* ${payload.description}\n` +
          `💰 *Valor:* ${formatAmt}\n` +
          `📅 *Data:* ${formattedDate}\n` +
          `💳 *Conta:* ${payload.account || "Não especificada"}\n` +
          `📌 *Situação:* ${payload.settled ? "Quitado/Realizado ✅" : "Pendente/Previsto ⏳"}`;
      } 
      else if (action === "update") {
        const tId = params.transactionId;
        if (!tId) {
          throw new Error("ID do lançamento não identificado pelo assistente.");
        }
        
        const docRef = dbAdmin.collection("transactions").doc(tId);
        const existingDoc = await docRef.get();
        if (!existingDoc.exists || existingDoc.data()?.uid !== user.id) {
          throw new Error("Lançamento correspondente não encontrado na sua base de dados.");
        }

        const updateData: any = {
          ...params.fieldsToUpdate,
          updatedAt: FieldValue.serverTimestamp()
        };

        if (updateData.date) {
          updateData.date = new Date(updateData.date + "T12:00:00").toISOString();
        }

        await docRef.update(updateData);

        const mergedData = { ...existingDoc.data(), ...updateData };
        const formatAmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(mergedData.amount);

        replyMessage = `✏️ *Lançamento atualizado com sucesso!*\n\n` +
          `📝 *Descrição:* ${mergedData.description}\n` +
          `💰 *Valor:* ${formatAmt}\n` +
          `💳 *Conta:* ${mergedData.account || "Não especificada"}\n` +
          `📌 *Situação:* ${mergedData.settled ? "Quitado ✅" : "Pendente ⏳"}`;
      } 
      else if (action === "settle") {
        const tId = params.transactionId;
        if (!tId) {
          throw new Error("Não consegui identificar qual conta você deseja quitar. Pode especificar o nome ou o valor dela?");
        }

        const docRef = dbAdmin.collection("transactions").doc(tId);
        const existingDoc = await docRef.get();
        if (!existingDoc.exists || existingDoc.data()?.uid !== user.id) {
          throw new Error("Lançamento correspondente não encontrado na sua base de dados.");
        }

        await docRef.update({
          settled: true,
          updatedAt: FieldValue.serverTimestamp()
        });

        const data = existingDoc.data() || {};
        const formatAmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.amount);

        replyMessage = `💰 *Lançamento marcado como quitado!*\n\n` +
          `✅ *Descrição:* ${data.description}\n` +
          `💵 *Valor:* ${formatAmt}\n` +
          `📅 *Data:* ${data.date ? new Date(data.date).toLocaleDateString("pt-BR") : ""}`;
      } 
      else if (action === "query_balance") {
        const filterAcc = params.filterAccount || "all";
        const stats = calculateBalances(transactions, cards, filterAcc);

        const formatVal = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        replyMessage = `📊 *Resumo Geral de Saldos*\n` +
          (filterAcc !== "all" ? `💳 *Filtro de Conta:* ${filterAcc}\n\n` : `\n`) +
          `💵 *Saldo Realizado (Disponível):* ${formatVal(stats.balanceRealized)}\n` +
          `🔮 *Saldo Planejado (Projetado):* ${formatVal(stats.balanceProjected)}\n\n` +
          `📈 *Receitas Previstas:* ${formatVal(stats.totalIncome)} (Realizado: ${formatVal(stats.totalRealizedIncome)})\n` +
          `📉 *Despesas Previstas:* ${formatVal(stats.totalExpense)} (Realizado: ${formatVal(stats.totalRealizedExpense)})`;
      } 
      else if (action === "query_transactions") {
        const fType = params.filterType || "all";
        const tRange = params.timeRange || "month";

        let filtered = transactions;

        if (fType === "pending") {
          filtered = filtered.filter(t => !t.settled);
        } else if (fType === "settled") {
          filtered = filtered.filter(t => t.settled);
        }

        const todayTime = new Date(todayStr + "T12:00:00").getTime();

        if (tRange === "today") {
          filtered = filtered.filter(t => t.date && t.date.split("T")[0] === todayStr);
        } else if (tRange === "week") {
          const sevenDaysLater = todayTime + 7 * 24 * 60 * 60 * 1000;
          filtered = filtered.filter(t => {
            if (!t.date) return false;
            const tTime = new Date(t.date).getTime();
            return tTime >= todayTime && tTime <= sevenDaysLater;
          });
        } else if (tRange === "upcoming") {
          filtered = filtered.filter(t => {
            if (!t.date) return false;
            const tTime = new Date(t.date).getTime();
            return tTime >= todayTime && !t.settled;
          });
        }

        if (tRange === "upcoming" || tRange === "week") {
          filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        } else {
          filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        const totalFound = filtered.length;
        const items = filtered.slice(0, 10);

        let rangeTitle = "do mês";
        if (tRange === "today") rangeTitle = "de hoje";
        if (tRange === "week") rangeTitle = "da semana";
        if (tRange === "upcoming") rangeTitle = "futuros pendentes";

        let typeTitle = "Lançamentos";
        if (fType === "pending") typeTitle = "Contas pendentes";
        if (fType === "settled") typeTitle = "Lançamentos pagos/realizados";

        replyMessage = `📅 *${typeTitle} ${rangeTitle}* (Exibindo ${items.length} de ${totalFound}):\n\n`;

        if (items.length === 0) {
          replyMessage += "Nenhum lançamento encontrado para os critérios informados.";
        } else {
          items.forEach(t => {
            const formatAmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(t.amount);
            const dateFmt = t.date ? new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
            const statusEmoji = t.settled ? "✅" : "⏳";
            const typeEmoji = t.type === "income" ? "📈" : "📉";
            replyMessage += `${statusEmoji} ${typeEmoji} *${dateFmt}* - ${t.description}: *${formatAmt}* ${t.account ? `(${t.account})` : ""}\n`;
          });
        }
      } 
      else {
        replyMessage = "Olá! Consegui entender sua mensagem, mas não identifiquei uma ação financeira específica. Posso te ajudar a incluir despesas, quitar contas, consultar saldos e muito mais. Como deseja prosseguir?";
      }

      await sendWhatsAppMessage(cleanPhone, replyMessage);
      res.json({ success: true, action, replyMessage });

    } catch (err: any) {
      console.error("[WhatsApp Webhook] Erro no processamento principal:", err);
      const body = req.body;
      const rawSender = body.data?.key?.remoteJid || body.sender || "";
      const phoneDigits = rawSender.split("@")[0].replace(/\D/g, "");
      if (phoneDigits) {
        await sendWhatsAppMessage(phoneDigits, `⚠️ *Erro ao processar comando:*\n${err.message}`);
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // Vite / Static Serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
