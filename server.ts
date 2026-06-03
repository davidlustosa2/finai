import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import cron from "node-cron";
import * as fs from "fs";

// Initialize Firebase Admin with custom database ID from local configuration
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const appAdmin = getApps().length === 0
  ? initializeApp({
      projectId: firebaseConfig.projectId,
    })
  : getApp();

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
