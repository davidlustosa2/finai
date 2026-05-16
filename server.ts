import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
