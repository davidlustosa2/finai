import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Wallet, 
  CreditCard, 
  Target, 
  BarChart3, 
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Bell,
  Sparkles,
  ChevronRight,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { AIService } from './services/aiService';

// --- Types ---
interface Transaction {
  id: number;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  category: string;
  date: string;
  account: string;
}

interface Summary {
  balance: number;
  income: number;
  expense: number;
  accounts: any[];
  cards: any[];
}

interface CardData {
  id: number;
  name: string;
  limit: number;
  used: number;
  closingDate: string;
  dueDate: string;
}

interface Insight {
  title: string;
  text: string;
  type: 'warning' | 'success' | 'info';
}

// --- Components ---

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string, key?: any }) => (
  <div className={`bg-white rounded-3xl p-6 shadow-sm border border-black/5 ${className}`}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <Card className="flex flex-col gap-2">
    <div className="flex justify-between items-start">
      <span className="text-sm font-medium text-stone-500 uppercase tracking-wider">{title}</span>
      <div className={`p-2 rounded-xl ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
    <span className="text-2xl font-semibold tracking-tight">
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
    </span>
  </Card>
);

export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);

  // Form states for new card
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('');
  const [newCardDue, setNewCardDue] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sumRes, transRes, cardsRes] = await Promise.all([
        fetch('/api/summary'),
        fetch('/api/transactions'),
        fetch('/api/cards')
      ]);
      const summaryData = await sumRes.json();
      const transactionsData = await transRes.json();
      const cardsData = await cardsRes.json();
      
      setSummary(summaryData);
      setTransactions(transactionsData);
      setCards(cardsData);

      // Generate insights on the frontend
      const insightData = await AIService.generateInsights({ 
        transactions: transactionsData, 
        accounts: summaryData.accounts,
        cards: cardsData
      });
      setInsights(insightData.insights || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCardName,
          limit: parseFloat(newCardLimit),
          used: 0,
          closingDate: newCardClosing,
          dueDate: newCardDue
        })
      });
      if (res.ok) {
        setShowNewCardForm(false);
        setNewCardName('');
        setNewCardLimit('');
        setNewCardClosing('');
        setNewCardDue('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    setIsAiLoading(true);
    setChatResponse(null);
    try {
      const interpretation = await AIService.interpretCommand(aiInput);
      
      if (interpretation.type) {
        // It's a transaction, send to backend
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...interpretation,
            date: interpretation.date === 'hoje' ? new Date().toISOString() : interpretation.date 
          })
        });
        
        if (res.ok) {
          setChatResponse(`Registrei sua ${interpretation.type === 'income' ? 'receita' : 'despesa'} de R$ ${interpretation.amount.toFixed(2)} em ${interpretation.category || 'Geral'}.`);
          setAiInput('');
          fetchData();
        }
      } else {
        setChatResponse("Entendi sua mensagem, mas não identifiquei uma transação clara para registrar.");
      }
    } catch (e) {
      console.error(e);
      setChatResponse("Ocorreu um erro ao processar seu comando com a IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const chartData = [
    { name: 'Seg', g: 400, r: 2400 },
    { name: 'Ter', g: 300, r: 1398 },
    { name: 'Qua', g: 200, r: 9800 },
    { name: 'Qui', g: 278, r: 3908 },
    { name: 'Sex', g: 189, r: 4800 },
    { name: 'Sáb', g: 239, r: 3800 },
    { name: 'Dom', g: 349, r: 4300 },
  ];

  const pieData = [
    { name: 'Alimentação', value: 400 },
    { name: 'Moradia', value: 300 },
    { name: 'Transporte', value: 300 },
    { name: 'Lazer', value: 200 },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-stone-900 font-sans selection:bg-emerald-100">
      {/* Sidebar / Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-black/5 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-8">
        <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-full transition-colors ${activeTab === 'dashboard' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}>
          <LayoutDashboard size={20} />
        </button>
        <button onClick={() => setActiveTab('transactions')} className={`p-2 rounded-full transition-colors ${activeTab === 'transactions' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}>
          <BarChart3 size={20} />
        </button>
        <button onClick={() => setActiveTab('cards')} className={`p-2 rounded-full transition-colors ${activeTab === 'cards' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}>
          <CreditCard size={20} />
        </button>
        <button onClick={() => setActiveTab('ai')} className={`p-2 rounded-full transition-colors ${activeTab === 'ai' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}>
          <MessageSquare size={20} />
        </button>
        <div className="w-px h-6 bg-stone-200" />
        <button className="p-2 text-stone-400 hover:text-stone-600">
          <PlusCircle size={20} />
        </button>
      </nav>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 pt-12 pb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Olá, David</h1>
          <p className="text-stone-500 mt-1">Sua saúde financeira está <span className="text-emerald-600 font-medium">excelente</span> hoje.</p>
        </div>
        <div className="flex gap-3">
          <button className="p-3 bg-white rounded-2xl border border-black/5 shadow-sm hover:bg-stone-50 transition-colors">
            <Search size={20} className="text-stone-500" />
          </button>
          <button className="p-3 bg-white rounded-2xl border border-black/5 shadow-sm hover:bg-stone-50 transition-colors relative">
            <Bell size={20} className="text-stone-500" />
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Main Stats */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Saldo Total" value={summary?.balance || 0} icon={Wallet} color="bg-stone-900" />
                <StatCard title="Receitas" value={summary?.income || 0} icon={ArrowUpRight} color="bg-emerald-500" />
                <StatCard title="Despesas" value={summary?.expense || 0} icon={ArrowDownLeft} color="bg-rose-500" />
                
                {/* Main Chart */}
                <Card className="md:col-span-3 h-[400px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold text-lg">Fluxo de Caixa</h3>
                    <select className="bg-stone-100 border-none rounded-lg text-sm px-3 py-1 outline-none">
                      <option>Esta Semana</option>
                      <option>Este Mês</option>
                    </select>
                  </div>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="r" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorR)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                {/* Recent Transactions */}
                <Card className="md:col-span-3">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold text-lg">Últimos Lançamentos</h3>
                    <button className="text-stone-500 text-sm hover:underline">Ver todos</button>
                  </div>
                  <div className="space-y-4">
                    {transactions.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-2xl transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {t.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                          </div>
                          <div>
                            <p className="font-medium">{t.description}</p>
                            <p className="text-xs text-stone-400 uppercase tracking-wider">{t.category} • {t.account}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-stone-900'}`}>
                            {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                          </p>
                          <p className="text-xs text-stone-400">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {/* Accounts Summary */}
                <Card>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg">Suas Contas</h3>
                    <PlusCircle size={18} className="text-stone-400 cursor-pointer" />
                  </div>
                  <div className="space-y-4">
                    {summary?.accounts.map((acc: any) => (
                      <div key={acc.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
                            <Wallet size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{acc.name}</p>
                            <p className="text-xs text-stone-400 uppercase tracking-wider">{acc.type === 'checking' ? 'Corrente' : 'Investimento'}</p>
                          </div>
                        </div>
                        <p className="font-semibold text-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.balance)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* AI Insights */}
                <Card className="bg-stone-900 text-white border-none overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles size={80} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles size={18} className="text-emerald-400" />
                      <h3 className="font-medium text-stone-400 uppercase text-xs tracking-widest">Insights da IA</h3>
                    </div>
                    <div className="space-y-4">
                      {insights.length > 0 ? insights.map((insight, idx) => (
                        <div key={idx} className="border-l-2 border-emerald-500/30 pl-4 py-1">
                          <p className="text-sm font-medium text-emerald-400">{insight.title}</p>
                          <p className="text-xs text-stone-400 mt-1 leading-relaxed">{insight.text}</p>
                        </div>
                      )) : (
                        <p className="text-xs text-stone-500 italic">Analisando seus dados...</p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Category Distribution */}
                <Card>
                  <h3 className="font-semibold text-lg mb-4">Gastos por Categoria</h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {pieData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                          <span className="text-stone-600">{item.name}</span>
                        </div>
                        <span className="font-medium">R$ {item.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Goals */}
                <Card>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg">Metas</h3>
                    <PlusCircle size={18} className="text-stone-400 cursor-pointer" />
                  </div>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Reserva de Emergência</span>
                        <span className="text-stone-500">75%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Viagem Japão</span>
                        <span className="text-stone-500">12%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '12%' }} />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'cards' && (
            <motion.div 
              key="cards"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold tracking-tight">Cartões de Crédito</h2>
                <button 
                  onClick={() => setShowNewCardForm(true)}
                  className="bg-stone-900 text-white px-6 py-2 rounded-2xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
                >
                  <PlusCircle size={18} />
                  Novo Cartão
                </button>
              </div>

              {showNewCardForm && (
                <Card className="max-w-md mx-auto">
                  <h3 className="font-semibold mb-4">Adicionar Novo Cartão</h3>
                  <form onSubmit={handleCreateCard} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-1">Nome do Cartão</label>
                      <input 
                        type="text" 
                        value={newCardName}
                        onChange={(e) => setNewCardName(e.target.value)}
                        placeholder="Ex: Nubank Ultravioleta"
                        className="w-full bg-stone-50 border border-black/5 rounded-xl py-2 px-4 outline-none focus:ring-2 ring-stone-900/5"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-1">Limite Total</label>
                      <input 
                        type="number" 
                        value={newCardLimit}
                        onChange={(e) => setNewCardLimit(e.target.value)}
                        placeholder="Ex: 5000"
                        className="w-full bg-stone-50 border border-black/5 rounded-xl py-2 px-4 outline-none focus:ring-2 ring-stone-900/5"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-1">Fechamento (Dia)</label>
                        <input 
                          type="number" 
                          value={newCardClosing}
                          onChange={(e) => setNewCardClosing(e.target.value)}
                          placeholder="Ex: 25"
                          className="w-full bg-stone-50 border border-black/5 rounded-xl py-2 px-4 outline-none focus:ring-2 ring-stone-900/5"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-1">Vencimento (Dia)</label>
                        <input 
                          type="number" 
                          value={newCardDue}
                          onChange={(e) => setNewCardDue(e.target.value)}
                          placeholder="Ex: 01"
                          className="w-full bg-stone-50 border border-black/5 rounded-xl py-2 px-4 outline-none focus:ring-2 ring-stone-900/5"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setShowNewCardForm(false)}
                        className="flex-1 px-4 py-2 border border-black/5 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map((card) => (
                  <Card key={card.id} className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <CreditCard size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-1">Cartão de Crédito</p>
                          <h3 className="text-xl font-semibold">{card.name}</h3>
                        </div>
                        <div className="p-2 bg-stone-100 rounded-xl">
                          <CreditCard size={20} className="text-stone-600" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-stone-500">Limite Utilizado</span>
                            <span className="font-semibold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.used)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${card.used / card.limit > 0.8 ? 'bg-rose-500' : 'bg-stone-900'}`}
                              style={{ width: `${Math.min((card.used / card.limit) * 100, 100)}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-stone-400 mt-1 uppercase tracking-wider">
                            <span>Disponível: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.limit - card.used)}</span>
                            <span>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.limit)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="bg-stone-50 p-3 rounded-2xl">
                            <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">Fechamento</p>
                            <p className="text-sm font-medium">Dia {card.closingDate}</p>
                          </div>
                          <div className="bg-stone-50 p-3 rounded-2xl">
                            <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">Vencimento</p>
                            <p className="text-sm font-medium">Dia {card.dueDate}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto h-[600px] flex flex-col"
            >
              <Card className="flex-1 flex flex-col overflow-hidden p-0">
                <div className="p-6 border-b border-black/5 flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-900 rounded-2xl flex items-center justify-center text-white">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Assistente FinAI</h3>
                    <p className="text-xs text-stone-400">Interpretando linguagem natural</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 rounded-xl bg-stone-100 flex-shrink-0 flex items-center justify-center">
                      <Sparkles size={14} className="text-stone-500" />
                    </div>
                    <div className="bg-stone-100 p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed">
                      Olá! Eu sou seu assistente inteligente. Você pode me dizer coisas como "Gastei 50 no mercado hoje" ou perguntar "Qual meu saldo?". Como posso ajudar?
                    </div>
                  </div>

                  {chatResponse && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex-shrink-0 flex items-center justify-center">
                        <Sparkles size={14} className="text-emerald-600" />
                      </div>
                      <div className="bg-emerald-600 text-white p-4 rounded-2xl rounded-tr-none text-sm shadow-lg shadow-emerald-100">
                        {chatResponse}
                      </div>
                    </motion.div>
                  )}

                  {isAiLoading && (
                    <div className="flex gap-2 items-center text-stone-400 text-xs animate-pulse">
                      <Sparkles size={12} />
                      Processando comando...
                    </div>
                  )}
                </div>

                <form onSubmit={handleAiCommand} className="p-6 bg-stone-50 border-t border-black/5">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Ex: Gastei 35 no mercado ontem..."
                      className="w-full bg-white border border-black/5 rounded-2xl py-4 pl-6 pr-14 outline-none focus:ring-2 ring-stone-900/5 transition-all shadow-sm"
                    />
                    <button 
                      type="submit"
                      disabled={isAiLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-3 text-center uppercase tracking-widest">
                    Pressione Enter para enviar • Simulação de WhatsApp
                  </p>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
