import { Type } from "@google/genai";

export const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ["income", "expense", "transfer"], description: "Tipo da transação" },
    amount: { type: Type.NUMBER, description: "Valor monetário" },
    description: { type: Type.STRING, description: "Descrição curta" },
    category: { type: Type.STRING, description: "Categoria (ex: Alimentação, Salário, Lazer)" },
    date: { type: Type.STRING, description: "Data no formato ISO ou relativo (ex: hoje, ontem)" },
    account: { type: Type.STRING, description: "Nome da conta ou cartão de origem" },
    destinationAccount: { type: Type.STRING, description: "Conta de destino (apenas para transferências)" },
    installments: { type: Type.INTEGER, description: "Número de parcelas (opcional)" }
  },
  required: ["type", "amount", "description"]
};

export const querySchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["query_balance", "query_spending", "query_goals", "query_bills"], description: "Intenção da consulta" },
    period: { type: Type.STRING, description: "Período (ex: este mês, semana passada)" },
    category: { type: Type.STRING, description: "Categoria específica (opcional)" }
  },
  required: ["intent"]
};
