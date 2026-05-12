import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";

// Mock Database
let transactions: any[] = [
  { id: 1, type: 'expense', amount: 45.90, description: 'Almoço', category: 'Alimentação', date: new Date().toISOString(), account: 'Conta Corrente', settled: false },
  { id: 2, type: 'income', amount: 5000.00, description: 'Salário', category: 'Salário', date: new Date().toISOString(), account: 'Conta Corrente', settled: false },
];

let accounts = [
  { id: 1, name: 'Conta Corrente', balance: 4500.00, type: 'checking' },
  { id: 2, name: 'Reserva', balance: 12000.00, type: 'savings' },
];

let cards = [
  { id: 1, name: 'Visa Infinite', limit: 15000.00, used: 2450.00, closingDate: '2026-03-25', dueDate: '2026-04-01' },
  { id: 2, name: 'Mastercard Black', limit: 20000.00, used: 1200.00, closingDate: '2026-03-15', dueDate: '2026-03-22' },
];

let categories = [
  { name: 'Alimentação', type: 'expense' },
  { name: 'Salário', type: 'income' },
  { name: 'Lazer', type: 'expense' },
  { name: 'Moradia', type: 'expense' },
  { name: 'Transporte', type: 'expense' },
  { name: 'Saúde', type: 'expense' },
  { name: 'Educação', type: 'expense' },
  { name: 'Mercado', type: 'expense' },
  { name: 'Assinaturas', type: 'expense' },
  { name: 'Vendas', type: 'income' },
  { name: 'Investimentos', type: 'income' }
];

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

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
      cards: cards,
      categories: categories
    });
  });

  app.get("/api/categories", (req, res) => {
    res.json(categories);
  });

  app.put("/api/categories/:type/:oldName", (req, res) => {
    const { type, oldName } = req.params;
    const { newName } = req.body;
    const index = categories.findIndex(c => c.name === oldName && c.type === type);
    if (index !== -1) {
      categories[index].name = newName;
      // Update transactions with the new category name
      transactions = transactions.map(t => {
        if (t.category === oldName && t.type === type) {
          return { ...t, category: newName };
        }
        return t;
      });
      res.json(categories[index]);
    } else {
      res.status(404).json({ error: "Category not found" });
    }
  });

  app.delete("/api/categories/:type/:name", (req, res) => {
    const { type, name } = req.params;
    categories = categories.filter(c => !(c.name === name && c.type === type));
    res.status(204).send();
  });

  app.post("/api/categories", (req, res) => {
    const { name, type } = req.body;
    if (name && type && !categories.some(c => c.name === name && c.type === type)) {
      categories.push({ name, type });
      res.status(201).json({ name, type });
    } else {
      res.status(400).json({ error: "Invalid data or category already exists" });
    }
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

  // Simple helper to add months/weeks
  const addDate = (d: Date, idx: number, freq: 'monthly' | 'weekly' | 'none') => {
    const newD = new Date(d);
    if (freq === 'monthly') newD.setMonth(newD.getMonth() + idx);
    if (freq === 'weekly') newD.setDate(newD.getDate() + idx * 7);
    return newD.toISOString();
  };

  const createRecurringOrInstallments = (baseData: any) => {
    const { date, installments, frequency, isRecurring, description, amount, type, category, account } = baseData;
    const baseDate = new Date(date || new Date());
    const newTransactions: any[] = [];

    if (installments && installments > 1) {
      const group = Date.now();
      for (let i = 0; i < installments; i++) {
        newTransactions.push({
          id: group + i,
          description: description,
          amount: amount, 
          type,
          category,
          account,
          date: addDate(baseDate, i, 'monthly'),
          installmentGroup: group,
          settled: false
        });
      }
    } else if (isRecurring) {
      const count = frequency === 'weekly' ? 52 : 12;
      const recurringGroup = Date.now();
      for (let i = 0; i < count; i++) {
        newTransactions.push({
          id: recurringGroup + i,
          description: description,
          amount: amount,
          type,
          category,
          account,
          date: addDate(baseDate, i, frequency || 'monthly'),
          isRecurringEntry: true,
          recurringGroup,
          settled: false
        });
      }
    } else {
      newTransactions.push({
        id: Date.now(),
        ...baseData,
        date: baseDate.toISOString(),
        settled: baseData.settled || false
      });
    }
    return newTransactions;
  };

  app.post("/api/transactions", (req, res) => {
    const newTransList = createRecurringOrInstallments(req.body);
    transactions = [...newTransList, ...transactions];
    res.status(201).json(newTransList[0]);
  });

  app.put("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    const index = transactions.findIndex(t => t.id === parseInt(id));
    if (index !== -1) {
      const existingTrans = transactions[index];
      const isNowRecurring = req.body.isRecurring && !existingTrans.recurringGroup;
      const isNowInstallments = req.body.installments > 1 && !existingTrans.installmentGroup;

      if (isNowRecurring || isNowInstallments) {
        const newTransList = createRecurringOrInstallments({ ...existingTrans, ...req.body });
        transactions.splice(index, 1);
        transactions = [...newTransList, ...transactions];
        res.json(newTransList[0]);
      } else {
        transactions[index] = { ...existingTrans, ...req.body, id: parseInt(id) };
        res.json(transactions[index]);
      }
    } else {
      res.status(404).json({ error: "Transaction not found" });
    }
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    const { mode } = req.query; // 'single' or 'future'
    const targetId = parseInt(id);
    const target = transactions.find(t => t.id === targetId);
    
    if (!target) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (mode === 'future') {
      const groupId = target.recurringGroup || target.installmentGroup;
      if (groupId) {
        transactions = transactions.filter(t => {
          // If it's in the same group and the date is >= target date, delete it
          const isSameGroup = (t.recurringGroup === groupId || t.installmentGroup === groupId);
          const isFutureOrPresent = new Date(t.date) >= new Date(target.date);
          return !(isSameGroup && isFutureOrPresent);
        });
      } else {
        transactions = transactions.filter(t => t.id !== targetId);
      }
    } else {
      transactions = transactions.filter(t => t.id !== targetId);
    }
    
    res.status(204).send();
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
