import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";

// Mock Database
let transactions: any[] = [
  { id: 1, type: 'expense', amount: 45.90, description: 'Almoço', category: 'Alimentação', date: new Date().toISOString(), account: 'Conta Corrente' },
  { id: 2, type: 'income', amount: 5000.00, description: 'Salário', category: 'Salário', date: new Date().toISOString(), account: 'Conta Corrente' },
];

let accounts = [
  { id: 1, name: 'Conta Corrente', balance: 4500.00, type: 'checking' },
  { id: 2, name: 'Reserva', balance: 12000.00, type: 'savings' },
];

let cards = [
  { id: 1, name: 'Visa Infinite', limit: 15000.00, used: 2450.00, closingDate: '2026-03-25', dueDate: '2026-04-01' },
  { id: 2, name: 'Mastercard Black', limit: 20000.00, used: 1200.00, closingDate: '2026-03-15', dueDate: '2026-03-22' },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/summary", (req, res) => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = totalIncome - totalExpense;
    
    res.json({
      balance,
      income: totalIncome,
      expense: totalExpense,
      accounts: accounts,
      cards: cards
    });
  });

  app.get("/api/cards", (req, res) => {
    res.json(cards);
  });

  app.post("/api/cards", (req, res) => {
    const newCard = { ...req.body, id: Date.now() };
    cards.push(newCard);
    res.status(201).json(newCard);
  });

  app.get("/api/transactions", (req, res) => {
    res.json(transactions);
  });

  app.post("/api/transactions", (req, res) => {
    const newTransaction = { ...req.body, id: Date.now(), date: req.body.date || new Date().toISOString() };
    transactions.unshift(newTransaction);
    res.status(201).json(newTransaction);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
