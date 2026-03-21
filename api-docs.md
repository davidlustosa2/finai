# FinAI API Specification

## Auth
- `POST /api/auth/login`: Authenticate user.
- `POST /api/auth/register`: Register new user.

## Accounts & Cards
- `GET /api/accounts`: List all bank accounts.
- `POST /api/accounts`: Create a new account.
- `GET /api/cards`: List all credit cards.
- `POST /api/cards`: Create a new card.

## Transactions
- `GET /api/transactions`: List transactions with filters.
- `POST /api/transactions`: Create a new transaction (income, expense, transfer).
- `DELETE /api/transactions/:id`: Delete a transaction.

## Categories
- `GET /api/categories`: List categories.

## Budgets & Goals
- `GET /api/budgets`: List budgets.
- `GET /api/goals`: List goals.

## AI Assistant
- `POST /api/ai/command`: Interpret and execute a natural language command (WhatsApp style).
- `GET /api/ai/insights`: Get AI-generated financial insights.
- `POST /api/ai/chat`: Chat with the financial assistant.
