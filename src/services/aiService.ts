import { GoogleGenAI } from "@google/genai";
import { transactionSchema, querySchema } from "./aiSchemas";

// In Vite, process.env.GEMINI_API_KEY is replaced by a string via vite.config.ts 'define'
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export class AIService {
  static async interpretCommand(message: string) {
    const model = "gemini-3-flash-preview";
    const prompt = `
      Você é um assistente financeiro especializado em interpretar mensagens do WhatsApp para um sistema de gestão financeira.
      Analise a seguinte mensagem do usuário: "${message}"

      Determine se é um COMANDO (registrar transação) ou uma CONSULTA (perguntar saldo, gastos, etc).

      Se for COMANDO, retorne um JSON seguindo o schema de transação.
      Se for CONSULTA, retorne um JSON seguindo o schema de consulta.

      Retorne APENAS o JSON.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    try {
      return JSON.parse(response.text || "{}");
    } catch (e) {
      console.error("Failed to parse AI response", e);
      return { error: "Não consegui entender o comando." };
    }
  }

  static async generateInsights(data: any) {
    const model = "gemini-3-flash-preview";
    const prompt = `
      Com base nos seguintes dados financeiros:
      ${JSON.stringify(data)}

      Gere 3 insights curtos, acionáveis e amigáveis para o usuário.
      Foque em economia, alertas de orçamento e progresso de metas.
      Retorne em formato de lista JSON: { "insights": [ { "title": "", "text": "", "type": "warning|success|info" } ] }
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    try {
      return JSON.parse(response.text || '{"insights": []}');
    } catch (e) {
      return { insights: [] };
    }
  }
}
