import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { firestoreService } from './lib/firestoreService';
import { createRecurringOrInstallments } from './lib/transactionUtils';
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
  ChevronLeft,
  Send,
  Trash2,
  Edit2,
  X,
  Repeat,
  Plus,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  Circle,
  ArrowUpDown,
  Filter,
  ChevronDown,
  LogOut,
  Loader2,
  Download,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
interface Payment {
  amount: number;
  date: string;
}

interface Transaction {
  id: string | number;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  category: string;
  date: string;
  realizedAmount?: number;
  realizedDate?: string;
  payments?: Payment[];
  account: string;
  isRecurringEntry?: boolean;
  recurringGroup?: number;
  installmentGroup?: number;
  settled?: boolean;
}

interface Summary {
  balance: number;
  income: number;
  expense: number;
  realizedBalance?: number;
  realizedIncome?: number;
  realizedExpense?: number;
  accounts: any[];
  cards: any[];
  categories: { name: string, type: 'income' | 'expense' }[];
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

const StatCard = ({ title, value, realizedValue, icon: Icon, color }: any) => (
  <Card className="flex flex-col gap-3 group hover:shadow-lg transition-all duration-300">
    <div className="flex justify-between items-start">
      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{title}</span>
      <div className={`p-2 rounded-xl ${color} shadow-sm group-hover:scale-110 transition-transform`}>
        <Icon size={16} className="text-white" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex flex-col">
        <span className="text-2xl font-bold tracking-tight text-stone-900 group-hover:translate-x-1 transition-transform">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
        </span>
        <span className="text-[8px] font-black text-stone-300 uppercase tracking-tighter">Previsto</span>
      </div>
      
      {realizedValue !== undefined && (
        <div className="pt-2 border-t border-stone-50">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Realizado</span>
            <span className={`text-[10px] font-bold ${realizedValue >= value && title.includes('Receita') ? 'text-emerald-500' : realizedValue > value && title.includes('Despesa') ? 'text-rose-500' : 'text-stone-600'}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(realizedValue)}
            </span>
          </div>
          <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.abs((realizedValue / (value || 1)) * 100))}%` }}
              className={`h-full ${color} opacity-40`}
            />
          </div>
        </div>
      )}
    </div>
  </Card>
);

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const lastInsightRef = React.useRef<number>(0);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('transactions');
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);

  // Form states for new card
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('');
  const [newCardDue, setNewCardDue] = useState('');

  // Form states for new transaction
  const [showNewTransactionForm, setShowNewTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transDescription, setTransDescription] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [transCategory, setTransCategory] = useState('');
  const [transAccount, setTransAccount] = useState('Conta Corrente');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [transPayments, setTransPayments] = useState<{ amount: string, date: string }[]>([{ amount: '', date: new Date().toISOString().split('T')[0] }]);
  const [showRealizedFields, setShowRealizedFields] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'continuous' | 'installments'>('continuous');
  const [transFrequency, setTransFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [installmentsCount, setInstallmentsCount] = useState('3');
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [editingCategoryInModal, setEditingCategoryInModal] = useState<{name: string, type: string} | null>(null);
  const [newCategoryNameInModal, setNewCategoryNameInModal] = useState('');
  const [addingCategoryType, setAddingCategoryType] = useState<'income' | 'expense' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Settle States
  const [settlingTransaction, setSettlingTransaction] = useState<Transaction | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleCoords, setSettleCoords] = useState({ top: 0, left: 0 });
  const [manualCategoryName, setManualCategoryName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  
  const [showQuitarWarning, setShowQuitarWarning] = useState(false);
  const [transactionToQuitar, setTransactionToQuitar] = useState<Transaction | null>(null);

  // New filtering states
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const handlePrevMonth = () => {
    setShowAllMonths(false);
    const date = new Date(selectedYear, selectedMonth - 1, 1);
    setSelectedMonth(date.getMonth());
    setSelectedYear(date.getFullYear());
  };

  const handleNextMonth = () => {
    setShowAllMonths(false);
    const date = new Date(selectedYear, selectedMonth + 1, 1);
    setSelectedMonth(date.getMonth());
    setSelectedYear(date.getFullYear());
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [sortField, setSortField] = useState<'date' | 'description' | 'category' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterText, setFilterText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'due-soon'>('all');
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');
  const [showFilterRow, setShowFilterRow] = useState(false);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getTransactionStatus = (t: Transaction) => {
    if (t.settled) return 'settled';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const transDate = new Date(t.date);
    transDate.setHours(0, 0, 0, 0);

    if (transDate < today) return 'overdue';
    
    const diffTime = transDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 2) return 'due-soon';
    return 'normal';
  };

  const calculateRealizedAmount = (t: Transaction) => {
    if (t.payments && t.payments.length > 0) {
      return t.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }
    if (t.settled) {
      return Number(t.realizedAmount ?? t.amount) || 0;
    }
    return 0;
  };

  const filteredTransactions = transactions
    .filter(t => {
      const d = new Date(t.date);
      const matchesMonth = showAllMonths || !!filterText || (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear);
      const matchesText = !filterText || (() => {
        const search = filterText.toLowerCase();
        const transDate = new Date(t.date);
        const formattedDate = transDate.toLocaleDateString('pt-BR');
        const amountStr = t.amount.toString();
        const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount).toLowerCase();
        
        return t.description.toLowerCase().includes(search) ||
               t.category.toLowerCase().includes(search) ||
               (t.account || '').toLowerCase().includes(search) ||
               formattedDate.includes(search) ||
               amountStr.includes(search) ||
               formattedAmount.includes(search);
      })();
      const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesAccount = filterAccount === 'all' || t.account === filterAccount;
      
      const status = getTransactionStatus(t);
      const matchesStatus = filterStatus === 'all' || status === filterStatus;
      
      const day = d.getDate().toString();
      const matchesDay = !filterDay || day === filterDay || day === `0${filterDay}`;
      
      const amount = t.amount;
      const matchesMin = !filterMinAmount || amount >= parseFloat(filterMinAmount);
      const matchesMax = !filterMaxAmount || amount <= parseFloat(filterMaxAmount);
      
      return matchesMonth && matchesText && matchesCategory && matchesDay && matchesMin && matchesMax && matchesType && matchesAccount && matchesStatus;
    })
    .sort((a, b) => {
      const statusA = getTransactionStatus(a);
      const statusB = getTransactionStatus(b);
      
      const statusPriority: Record<string, number> = {
        'overdue': 0,
        'due-soon': 1,
        'normal': 2,
        'settled': 3
      };

      if (statusPriority[statusA] !== statusPriority[statusB]) {
        return statusPriority[statusA] - statusPriority[statusB];
      }

      // Within the same status priority, use the requested sort order or default to date ASC for urgency
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'description') {
        comparison = a.description.localeCompare(b.description);
      } else if (sortField === 'category') {
        comparison = (a.category || "").localeCompare(b.category || "");
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const metrics = React.useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const status = getTransactionStatus(t);
      const amount = Number(t.amount) || 0;
      const realizedAmount = calculateRealizedAmount(t);

      if (t.type === 'income') {
        acc.income += amount;
        acc.realizedIncome += realizedAmount;
      } else {
        acc.expenses += amount;
        acc.realizedExpenses += realizedAmount;
      }
      
      if (!t.settled && t.type === 'expense') {
        if (status === 'overdue') acc.overdueCount++;
        if (status === 'due-soon') acc.dueSoonCount++;
      }
      
      return acc;
    }, { income: 0, expenses: 0, realizedIncome: 0, realizedExpenses: 0, overdueCount: 0, dueSoonCount: 0 });
  }, [filteredTransactions, getTransactionStatus]);

  const currentBalance = metrics.income - metrics.expenses;
  const realizedBalance = metrics.realizedIncome - metrics.realizedExpenses;

  const fetchData = async () => {
    if (!user) return;
    try {
      const [transactionsData, cardsData, accountsData, categoriesData] = await Promise.all([
        firestoreService.getTransactions(),
        firestoreService.getCards(),
        firestoreService.getAccounts(),
        firestoreService.getCategories()
      ]);
      
      // Calculate summary on frontend as we've moved to direct Firebase integration
      const totalIncome = (transactionsData as any[]).filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const totalExpense = (transactionsData as any[]).filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const balance = totalIncome - totalExpense;

      const totalRealizedIncome = (transactionsData as any[]).filter(t => t.type === 'income').reduce((acc, t) => acc + calculateRealizedAmount(t), 0);
      const totalRealizedExpense = (transactionsData as any[]).filter(t => t.type === 'expense').reduce((acc, t) => acc + calculateRealizedAmount(t), 0);
      const realizedBalance = totalRealizedIncome - totalRealizedExpense;

      const summaryData: Summary = {
        balance,
        income: totalIncome,
        expense: totalExpense,
        realizedBalance,
        realizedIncome: totalRealizedIncome,
        realizedExpense: totalRealizedExpense,
        accounts: accountsData.length > 0 ? accountsData : [
          { id: '1', name: 'Conta Corrente', balance: 4500.00, type: 'checking' },
          { id: '2', name: 'Reserva', balance: 12000.00, type: 'savings' },
        ],
        cards: cardsData,
        categories: categoriesData.length > 0 ? (categoriesData as any[]) : [
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
        ]
      };
      
      setSummary(summaryData);
      setTransactions(transactionsData as any[]);
      setCards(cardsData as any[]);

      // Generate insights
      const now = Date.now();
      if (now - lastInsightRef.current > 60000) {
        try {
          const insightData = await AIService.generateInsights({ 
            transactions: transactionsData as any[], 
            accounts: summaryData.accounts,
            cards: cardsData as any[]
          });
          
          if (insightData.error === 'quota_exceeded') {
            setInsightError('quota');
          } else {
            setInsights(insightData.insights || []);
            setInsightError(null);
            lastInsightRef.current = now;
          }
        } catch (e) {
          console.error("AI Insight fetch error:", e);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const maskCurrency = (value: string) => {
    const onlyDigits = value.replace(/\D/g, '');
    const cents = parseInt(onlyDigits || '0', 10);
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  };

  const parseCurrency = (formattedValue: string) => {
    return (parseInt(formattedValue.replace(/\D/g, ''), 10) || 0) / 100;
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await firestoreService.addCard({
        name: newCardName,
        limit: parseCurrency(newCardLimit),
        used: 0,
        closingDate: newCardClosing,
        dueDate: newCardDue
      });

      setShowNewCardForm(false);
      setNewCardName('');
      setNewCardLimit('');
      setNewCardClosing('');
      setNewCardDue('');
      fetchData();
      setSuccessMessage("Cartão adicionado com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
      setErrorMessage("Erro ao criar cartão. Verifique sua conexão.");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage("Usuário não identificado. Tente fazer login novamente.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    
    const payments = showRealizedFields 
      ? transPayments
          .filter(p => p.amount && p.date)
          .map(p => ({
            amount: parseCurrency(p.amount),
            date: new Date(p.date + 'T12:00:00').toISOString()
          }))
      : [];

    const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
    const plannedAmount = parseCurrency(transAmount);

    const payload: any = {
      description: transDescription,
      amount: plannedAmount,
      type: transType,
      category: transCategory || 'Outros',
      account: transAccount || 'Conta Corrente',
      date: new Date(transDate + 'T12:00:00').toISOString(),
      isRecurring: isRecurring && recurrenceMode === 'continuous',
      frequency: isRecurring && recurrenceMode === 'continuous' ? transFrequency : undefined,
      installments: isRecurring && recurrenceMode === 'installments' ? parseInt(installmentsCount) : undefined,
      payments: payments.length > 0 ? payments : undefined,
      settled: totalPayments >= plannedAmount && plannedAmount > 0
    };

    console.log("Submitting transaction payload:", payload);

    try {
      if (editingTransaction) {
        await firestoreService.updateTransaction(editingTransaction.id.toString(), payload);
      } else {
        const newTransactions = createRecurringOrInstallments({ ...payload, uid: user.uid });
        console.log("Transformed transactions:", newTransactions);
        for (const t of newTransactions) {
          await firestoreService.addTransaction(t);
        }
      }
      resetTransForm();
      fetchData();
      setSuccessMessage(editingTransaction ? "Lançamento atualizado!" : "Lançamento confirmado!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      console.error("Create/Update Transaction Error:", e);
      let msg = "Erro ao salvar: ";
      try {
        const errInfo = JSON.parse(e.message);
        msg += errInfo.error.split(':')[0] || "Erro de permissão ou conexão.";
      } catch {
        msg += e.message || "Erro desconhecido.";
      }
      setErrorMessage(msg);
      // Not clearing error too fast so user can report it
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: number | string, mode: 'single' | 'future' = 'single') => {
    try {
      const targetId = id.toString();
      const target = transactions.find(t => t.id.toString() === targetId);
      
      if (!target) return;

      if (mode === 'future') {
        const groupId = target.recurringGroup || target.installmentGroup;
        if (groupId) {
          const futureTrans = transactions.filter(t => {
            const isSameGroup = (t.recurringGroup === groupId || t.installmentGroup === groupId);
            const isFutureOrPresent = new Date(t.date) >= new Date(target.date);
            return isSameGroup && isFutureOrPresent;
          });
          for (const t of futureTrans) {
            await firestoreService.deleteTransaction(t.id.toString());
          }
        } else {
          await firestoreService.deleteTransaction(targetId);
        }
      } else {
        await firestoreService.deleteTransaction(targetId);
      }
      
      setShowDeleteModal(false);
      setTransactionToDelete(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const confirmDelete = (t: Transaction) => {
    setTransactionToDelete(t);
    setShowDeleteModal(true);
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction(t);
    setTransDescription(t.description);
    setTransAmount(maskCurrency((t.amount * 100).toFixed(0)));
    setTransType(t.type as 'income' | 'expense');
    setTransCategory(t.category);
    setTransAccount(t.account);
    setTransDate(new Date(t.date).toISOString().split('T')[0]);
    if ((t.payments && t.payments.length > 0) || t.realizedAmount !== undefined || t.realizedDate) {
      if (t.payments && t.payments.length > 0) {
        setTransPayments(t.payments.map(p => ({
          amount: maskCurrency((p.amount * 100).toFixed(0)),
          date: new Date(p.date).toISOString().split('T')[0]
        })));
      } else {
        setTransPayments([{
          amount: t.realizedAmount !== undefined ? maskCurrency((t.realizedAmount * 100).toFixed(0)) : '',
          date: t.realizedDate ? new Date(t.realizedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }]);
      }
      setShowRealizedFields(true);
    } else {
      setTransPayments([{ amount: '', date: new Date().toISOString().split('T')[0] }]);
      setShowRealizedFields(false);
    }
    setIsRecurring(!!(t.recurringGroup || t.installmentGroup));
    if (t.installmentGroup) {
      setRecurrenceMode('installments');
    } else if (t.recurringGroup) {
      setRecurrenceMode('continuous');
    }
    setShowNewTransactionForm(true);
  };

  const resetTransForm = () => {
    setShowNewTransactionForm(false);
    setEditingTransaction(null);
    setTransDescription('');
    setTransAmount('');
    setTransType('expense');
    setTransCategory('');
    setTransAccount('Conta Corrente');
    setTransDate(new Date().toISOString().split('T')[0]);
    setTransPayments([{ amount: '', date: new Date().toISOString().split('T')[0] }]);
    setShowRealizedFields(false);
    setIsRecurring(false);
    setRecurrenceMode('continuous');
    setTransFrequency('monthly');
    setInstallmentsCount('3');
    setCategorySearch('');
    setShowCategoryDropdown(false);
  };

  const handleAddCategory = async (name: string) => {
    try {
      await firestoreService.addCategory({ name, type: transType });
      setTransCategory(name);
      setCategorySearch('');
      setShowCategoryDropdown(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCategoryModal = async (type: 'income' | 'expense') => {
    if (!manualCategoryName.trim()) return;
    try {
      await firestoreService.addCategory({ name: manualCategoryName, type });
      setManualCategoryName('');
      setAddingCategoryType(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCategory = async (type: string, oldName: string, newName: string) => {
    try {
      const cat = summary?.categories.find(c => c.name === oldName && c.type === type) as any;
      if (cat && cat.id) {
        await firestoreService.updateCategory(cat.id, { name: newName });
        fetchData();
        setEditingCategoryInModal(null);
        setNewCategoryNameInModal('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCategory = async (type: string, name: string) => {
    if (!confirm('Deseja excluir esta categoria?')) return;
    try {
      const cat = summary?.categories.find(c => c.name === name && c.type === type) as any;
      if (cat && cat.id) {
        await firestoreService.deleteCategory(cat.id);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleAddPaymentClick = (t: Transaction, e: React.MouseEvent) => {
    setSettlingTransaction(t);
    // If there are already payments, don't pre-fill with total amount? 
    // Actually, maybe pre-fill with remaining amount.
    const totalPayments = (t.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, t.amount - totalPayments);
    setSettleAmount(maskCurrency((remaining * 100).toFixed(0)));
    setSettleDate(new Date().toISOString().split('T')[0]);
    
    const rect = e.currentTarget.getBoundingClientRect();
    setSettleCoords({ 
      top: rect.top, 
      left: rect.left 
    });
    
    setShowSettleModal(true);
  };

  const handleQuitarClick = async (t: Transaction) => {
    const totalPayments = (t.payments || []).reduce((sum, p) => sum + p.amount, 0);
    
    if (totalPayments === 0) {
      // Case 1: zero payments
      setIsSubmittingSettle(true);
      try {
        await firestoreService.updateTransaction(t.id.toString(), {
          settled: true,
          payments: [{
            amount: t.amount,
            date: new Date().toISOString()
          }]
        });
        fetchData();
        setSuccessMessage("Lançamento quitado com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (e) {
        console.error(e);
        setErrorMessage("Erro ao quitar lançamento.");
      } finally {
        setIsSubmittingSettle(false);
      }
    } else if (totalPayments < t.amount) {
      // Case 2: total < planned
      setTransactionToQuitar(t);
      setShowQuitarWarning(true);
    } else {
      // Case 3: total >= planned
      setIsSubmittingSettle(true);
      try {
        await firestoreService.updateTransaction(t.id.toString(), {
          settled: true
        });
        fetchData();
        setSuccessMessage("Lançamento quitado!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (e) {
        console.error(e);
        setErrorMessage("Erro ao quitar lançamento.");
      } finally {
        setIsSubmittingSettle(false);
      }
    }
  };

  const handleConfirmQuitarAnyway = async () => {
    if (!transactionToQuitar) return;
    setIsSubmittingSettle(true);
    try {
      await firestoreService.updateTransaction(transactionToQuitar.id.toString(), {
        settled: true
      });
      setShowQuitarWarning(false);
      setTransactionToQuitar(null);
      fetchData();
      setSuccessMessage("Lançamento quitado (valor parcial).");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error(e);
      setErrorMessage("Erro ao quitar lançamento.");
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleExportExcel = () => {
    // Sheet 1: Data
    const dataToExport = filteredTransactions.map(t => ({
      'Data': new Date(t.date).toLocaleDateString('pt-BR'),
      'Descrição': t.description,
      'Categoria': t.category,
      'Conta/Cartão': t.account,
      'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
      'Valor Planejado': t.amount,
      'Valor Pago': calculateRealizedAmount(t),
      'Status': t.settled ? 'Quitado' : (getTransactionStatus(t) === 'overdue' ? 'Vencido' : (getTransactionStatus(t) === 'due-soon' ? 'A Vencer' : 'Pendente')),
      'Recorrente': t.isRecurringEntry ? 'Sim' : 'Não'
    }));

    // Sheet 2: Applied Filters info
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const filtersInfo = [
      { 'Filtro': 'Mês Referência', 'Valor': months[selectedMonth] },
      { 'Filtro': 'Ano Referência', 'Valor': selectedYear },
      { 'Filtro': 'Busca', 'Valor': filterText || 'Nenhum' },
      { 'Filtro': 'Categoria', 'Valor': filterCategory === 'all' ? 'Todas' : filterCategory },
      { 'Filtro': 'Conta/Cartão', 'Valor': filterAccount === 'all' ? 'Todas' : filterAccount },
      { 'Filtro': 'Tipo', 'Valor': filterType === 'all' ? 'Todos' : (filterType === 'income' ? 'Receitas' : 'Despesas') },
      { 'Filtro': 'Status', 'Valor': filterStatus === 'all' ? 'Todos' : (filterStatus === 'paid' ? 'Quitados' : 'Pendentes') }
    ];

    const wb = XLSX.utils.book_new();
    
    const wsData = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.book_append_sheet(wb, wsData, "relatório");
    
    const wsFilters = XLSX.utils.json_to_sheet(filtersInfo);
    XLSX.utils.book_append_sheet(wb, wsFilters, "filtros aplicados");
    
    XLSX.writeFile(wb, "financeiro.xlsx");
  };

  const handleToggleSettle = async (t: Transaction, e: React.MouseEvent) => {
    if (t.settled) {
      // Extornar quitação (just unset settled and realized fields)
      try {
        await firestoreService.updateTransaction(t.id.toString(), { 
          settled: false,
          realizedAmount: null, 
          realizedDate: null,
          payments: t.payments || [] // Keep payments if it was partially paid then quitado anyway? 
          // Usually extornar means back to pending.
        });
        fetchData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleConfirmSettle = async () => {
    if (!settlingTransaction) return;
    setIsSubmittingSettle(true);
    try {
      const newPayment = {
        amount: parseCurrency(settleAmount),
        date: new Date(settleDate + 'T12:00:00').toISOString()
      };
      
      const updatedPayments = [...(settlingTransaction.payments || []), newPayment];
      const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      
      // The user specified: "O adicionar pagamento não deve quitar automaticamente o lançamento, só registrar o novo pagamento."
      // BUT if it reaches the total, should it settle?
      // Actually, let's strictly follow: "não deve quitar automaticamente".
      
      await firestoreService.updateTransaction(settlingTransaction.id.toString(), {
        settled: false, // Explicitly false as per request
        payments: updatedPayments
      });
      setShowSettleModal(false);
      setSettlingTransaction(null);
      fetchData();
      setSuccessMessage("Pagamento adicionado!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
      setErrorMessage("Erro ao adicionar pagamento.");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    setIsAiLoading(true);
    setChatResponse(null);
    try {
      const interpretation = await AIService.interpretCommand(aiInput);
      
      if (interpretation.error) {
        setChatResponse(interpretation.error);
        return;
      }
      
      if (interpretation.type) {
        const payload = {
          ...interpretation,
          date: interpretation.date === 'hoje' ? new Date().toISOString() : interpretation.date 
        };
        await firestoreService.addTransaction(payload);
        
        setChatResponse(`Registrei sua ${interpretation.type === 'income' ? 'receita' : 'despesa'} de R$ ${interpretation.amount.toFixed(2)} em ${interpretation.category || 'Geral'}.`);
        setAiInput('');
        fetchData();
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

  const chartData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return last7Days.map(dateStr => {
      const dayTransactions = transactions.filter(t => t.date.startsWith(dateStr));
      const income = dayTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      
      const d = new Date(dateStr + 'T12:00:00');
      return {
        name: daysMap[d.getDay()],
        g: expense,
        r: income
      };
    });
  }, [transactions]);

  const pieData = React.useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
      
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [transactions]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#78716c'];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="text-stone-900" size={32} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-12 text-center space-y-8">
          <div className="w-20 h-20 bg-stone-900 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-stone-200">
            <Wallet size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">FinAI</h1>
            <p className="text-stone-500 mt-2">Sua gestão financeira inteligente e segura.</p>
          </div>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 bg-white border border-stone-200 rounded-3xl font-semibold flex items-center justify-center gap-3 hover:bg-stone-50 transition-all shadow-sm active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Entrar com Google
          </button>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest leading-loose">
            Ao entrar, você concorda em armazenar seus dados <br/> de forma segura no Google Cloud Firestore.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-stone-900 font-sans selection:bg-emerald-100">
      {/* Sidebar / Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-black/5 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-8">
        <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activeTab === 'dashboard' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}>
          <LayoutDashboard size={20} />
        </button>
        <button onClick={() => setActiveTab('transactions')} className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activeTab === 'transactions' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}>
          <BarChart3 size={20} />
        </button>
        <button onClick={() => setActiveTab('cards')} className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activeTab === 'cards' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}>
          <CreditCard size={20} />
        </button>
        {/* Aba AI Desativada Temporariamente 
        <button onClick={() => setActiveTab('ai')} className={`p-2 rounded-full transition-colors ${activeTab === 'ai' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}>
          <MessageSquare size={20} />
        </button>
        */}
        <div className="w-px h-6 bg-stone-200" />
        <button 
          onClick={logout}
          className="p-2 text-stone-400 hover:text-rose-600 transition-colors"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </nav>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 pt-12 pb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Olá, {user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário'}</h1>
          <p className="text-stone-500 mt-1">Veja o raio-x de sua saúde financeira hoje.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <button 
              onClick={logout}
              className="px-4 py-2 bg-white rounded-xl border border-black/5 shadow-sm text-xs font-semibold text-stone-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group"
            >
              <LogOut size={14} className="group-hover:rotate-12 transition-transform" />
              Sair
            </button>
          </div>
          <div className="relative flex items-center">
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar lançamentos..."
                    className="w-[240px] h-12 px-4 bg-white border border-black/5 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-stone-900/5 text-sm font-medium mr-2"
                    value={filterText}
                    onChange={(e) => {
                      setFilterText(e.target.value);
                      if (activeTab !== 'transactions' && e.target.value) {
                        setActiveTab('transactions');
                      }
                    }}
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (!isSearchOpen) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                } else {
                  setFilterText('');
                }
              }}
              className={`p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 ${isSearchOpen ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white border-black/5 text-stone-500 hover:bg-stone-50 shadow-sm'}`}
            >
              <Search size={20} />
            </button>
          </div>
          <button className="p-3 bg-white rounded-2xl border border-black/5 shadow-sm hover:bg-stone-50 hover:scale-110 hover:shadow-md active:scale-95 transition-all relative">
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
                <StatCard 
                  title="Saldo Total" 
                  value={summary?.balance || 0} 
                  realizedValue={summary?.realizedBalance}
                  icon={Wallet} 
                  color="bg-stone-900" 
                />
                <StatCard 
                  title="Receitas" 
                  value={summary?.income || 0} 
                  realizedValue={summary?.realizedIncome}
                  icon={ArrowUpRight} 
                  color="bg-emerald-500" 
                />
                <StatCard 
                  title="Despesas" 
                  value={summary?.expense || 0} 
                  realizedValue={summary?.realizedExpense}
                  icon={ArrowDownLeft} 
                  color="bg-rose-500" 
                />
                
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
                    <button onClick={() => setActiveTab('transactions')} className="text-stone-500 text-sm hover:underline">Ver todos</button>
                  </div>
                  <div className="space-y-4">
                    {transactions
                      .sort((a, b) => {
                        if (a.settled !== b.settled) return a.settled ? 1 : -1;
                        return new Date(b.date).getTime() - new Date(a.date).getTime();
                      })
                      .slice(0, 5)
                      .map((t) => (
                      <div key={t.id} className={`flex items-center justify-between p-2 hover:bg-stone-50 rounded-2xl transition-all ${t.settled ? 'opacity-40 grayscale-[0.2]' : ''}`}>
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} ${t.settled ? 'bg-stone-100 text-stone-400' : ''}`}>
                            {t.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                          </div>
                          <div>
                            <p className={`font-medium ${t.settled ? 'line-through text-stone-400' : ''}`}>{t.description}</p>
                            <p className="text-xs text-stone-400 uppercase tracking-wider">{t.category} • {t.account}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${t.settled ? 'text-stone-400' : (t.type === 'income' ? 'text-emerald-600' : 'text-rose-600')} flex flex-col items-end`}>
                            <span>{t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}</span>
                            {t.realizedAmount !== undefined && (
                              <span className="text-[10px] text-emerald-500">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.realizedAmount)}
                              </span>
                            )}
                          </div>
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

{/* AI Insights - DEATIVADO TEMPORARIAMENTE
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
                      {insightError === 'quota' ? (
                        <div className="border-l-2 border-stone-500/30 pl-4 py-1">
                          <p className="text-sm font-medium text-stone-400">Insights Temporariamente Indisponíveis</p>
                          <p className="text-xs text-stone-500 mt-1 leading-relaxed">Atingimos o limite de análise. Eles carregarão novamente em breve.</p>
                        </div>
                      ) : insights.length > 0 ? insights.map((insight, idx) => (
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
                */}

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
                  className="bg-stone-900 text-white px-6 py-2 rounded-2xl text-sm font-medium hover:bg-stone-800 transition-all hover:scale-105 hover:shadow-xl hover:shadow-stone-200 active:scale-95 flex items-center gap-2 group"
                >
                  <PlusCircle size={18} className="group-hover:rotate-90 transition-transform" />
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
                        type="text" 
                        value={newCardLimit}
                        onChange={(e) => setNewCardLimit(maskCurrency(e.target.value))}
                        placeholder="0,00"
                        className="w-full bg-stone-50 border border-black/5 rounded-xl py-2 px-4 outline-none focus:ring-2 ring-stone-900/5 text-right font-medium"
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
                        className="flex-1 px-4 py-2 border border-black/5 rounded-xl text-sm font-medium hover:bg-stone-50 hover:shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 hover:shadow-lg hover:shadow-stone-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        {isSubmitting ? 'Salvando...' : 'Salvar'}
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

          {activeTab === 'transactions' && (
            <motion.div 
              key="transactions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold tracking-tight">Transações</h2>
              </div>

              {/* Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <button 
                  onClick={() => {
                    setFilterType(filterType === 'income' ? 'all' : 'income');
                    setFilterStatus('all');
                  }}
                  className={`p-5 rounded-3xl border transition-all text-left group active:scale-95 hover:-translate-y-1 ${filterType === 'income' && filterStatus === 'all' ? 'bg-emerald-600 border-emerald-600 shadow-xl shadow-emerald-200' : 'bg-white border-black/5 shadow-sm hover:border-emerald-200 hover:shadow-md'}`}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors ${filterType === 'income' && filterStatus === 'all' ? 'text-emerald-100' : 'text-stone-400 group-hover:text-emerald-500'}`}>Receitas</p>
                  <div className="space-y-1">
                    <div>
                      <p className={`text-lg font-bold transition-colors ${filterType === 'income' && filterStatus === 'all' ? 'text-white' : 'text-emerald-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.income)}
                      </p>
                      <p className={`text-[8px] font-bold uppercase transition-colors ${filterType === 'income' && filterStatus === 'all' ? 'text-emerald-200' : 'text-stone-300'}`}>Previsto</p>
                    </div>
                    <div className={`mt-2 pt-2 border-t flex justify-between items-center ${filterType === 'income' && filterStatus === 'all' ? 'border-emerald-500' : 'border-stone-50'}`}>
                      <span className={`text-[8px] font-bold uppercase ${filterType === 'income' && filterStatus === 'all' ? 'text-white' : 'text-stone-400'}`}>Realizado</span>
                      <span className={`text-[10px] font-bold ${filterType === 'income' && filterStatus === 'all' ? 'text-white' : 'text-emerald-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.realizedIncome)}
                      </span>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setFilterType(filterType === 'expense' && filterStatus === 'all' ? 'all' : 'expense');
                    setFilterStatus('all');
                  }}
                  className={`p-5 rounded-3xl border transition-all text-left group active:scale-95 hover:-translate-y-1 ${filterType === 'expense' && filterStatus === 'all' ? 'bg-rose-600 border-rose-600 shadow-xl shadow-rose-200' : 'bg-white border-black/5 shadow-sm hover:border-rose-200 hover:shadow-md'}`}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors ${filterType === 'expense' && filterStatus === 'all' ? 'text-rose-100' : 'text-stone-400 group-hover:text-rose-500'}`}>Despesas</p>
                  <div className="space-y-1">
                    <div>
                      <p className={`text-lg font-bold transition-colors ${filterType === 'expense' && filterStatus === 'all' ? 'text-white' : 'text-rose-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.expenses)}
                      </p>
                      <p className={`text-[8px] font-bold uppercase transition-colors ${filterType === 'expense' && filterStatus === 'all' ? 'text-rose-200' : 'text-stone-300'}`}>Previsto</p>
                    </div>
                    <div className={`mt-2 pt-2 border-t flex justify-between items-center ${filterType === 'expense' && filterStatus === 'all' ? 'border-rose-500' : 'border-stone-50'}`}>
                      <span className={`text-[8px] font-bold uppercase ${filterType === 'expense' && filterStatus === 'all' ? 'text-white' : 'text-stone-400'}`}>Realizado</span>
                      <span className={`text-[10px] font-bold ${filterType === 'expense' && filterStatus === 'all' ? 'text-white' : 'text-rose-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.realizedExpenses)}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Saldo</p>
                  <div className="space-y-1">
                    <div>
                      <p className={`text-lg font-bold ${currentBalance >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentBalance)}
                      </p>
                      <p className="text-[8px] font-bold text-stone-300 uppercase">Previsto</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-stone-50 flex justify-between items-center">
                      <span className="text-[8px] font-bold text-stone-400 uppercase">Realizado</span>
                      <span className={`text-[10px] font-bold ${realizedBalance >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(realizedBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setFilterStatus(filterStatus === 'overdue' ? 'all' : 'overdue');
                    if (filterStatus !== 'overdue') setFilterType('all');
                  }}
                  className={`p-5 rounded-3xl border transition-all text-left relative overflow-hidden group active:scale-95 hover:-translate-y-1 ${filterStatus === 'overdue' ? 'bg-rose-600 border-rose-600 shadow-xl shadow-rose-200' : 'bg-rose-50 border-rose-100 shadow-sm hover:border-rose-200 hover:shadow-md'}`}
                >
                  <div className={`absolute -right-2 -bottom-2 transition-all ${filterStatus === 'overdue' ? 'text-rose-500 scale-110' : 'text-rose-100 group-hover:scale-110'}`}>
                    <AlertCircle size={48} />
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10 transition-colors ${filterStatus === 'overdue' ? 'text-rose-100' : 'text-rose-400'}`}>Vencidas</p>
                  <p className={`text-xl font-bold relative z-10 transition-colors ${filterStatus === 'overdue' ? 'text-white' : 'text-rose-600'}`}>{metrics.overdueCount}</p>
                </button>

                <button 
                  onClick={() => {
                    setFilterStatus(filterStatus === 'due-soon' ? 'all' : 'due-soon');
                    if (filterStatus !== 'due-soon') setFilterType('all');
                  }}
                  className={`p-5 rounded-3xl border transition-all text-left relative overflow-hidden group active:scale-95 hover:-translate-y-1 ${filterStatus === 'due-soon' ? 'bg-amber-500 border-amber-500 shadow-xl shadow-amber-100' : 'bg-amber-50 border-amber-100 shadow-sm hover:border-amber-200 hover:shadow-md'}`}
                >
                  <div className={`absolute -right-2 -bottom-2 transition-all ${filterStatus === 'due-soon' ? 'text-amber-400 scale-110' : 'text-amber-100 group-hover:scale-110'}`}>
                    <Clock size={48} />
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10 transition-colors ${filterStatus === 'due-soon' ? 'text-amber-50' : 'text-amber-400'}`}>A Vencer Próximo</p>
                  <p className={`text-xl font-bold relative z-10 transition-colors ${filterStatus === 'due-soon' ? 'text-white' : 'text-amber-600'}`}>{metrics.dueSoonCount}</p>
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start">
                {showNewTransactionForm && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-full lg:w-[400px] lg:sticky lg:top-8"
                  >
                    <Card>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">{editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                        <button onClick={resetTransForm} className="text-stone-400 hover:text-stone-600">
                          <X size={20} />
                        </button>
                      </div>
                      <form onSubmit={handleCreateTransaction} className="space-y-4">
                        <AnimatePresence>
                          {errorMessage && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium"
                            >
                              {errorMessage}
                            </motion.div>
                          )}
                          {successMessage && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-medium"
                            >
                              {successMessage}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="flex p-1 bg-stone-100 rounded-xl">
                          <button 
                            type="button" 
                            onClick={() => {
                              setTransType('expense');
                              setTransCategory('');
                            }}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${transType === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-stone-500'}`}
                          >
                            Despesa
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              setTransType('income');
                              setTransCategory('');
                            }}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${transType === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500'}`}
                          >
                            Receita
                          </button>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-stone-400 uppercase tracking-wider block mb-1">Descrição</label>
                          <input 
                            type="text" 
                            value={transDescription}
                            onChange={(e) => setTransDescription(e.target.value)}
                            placeholder="Ex: Almoço, Salário..."
                            className="w-full bg-transparent border-none rounded-none py-2 px-0 outline-none focus:ring-0 placeholder:text-stone-300 text-lg font-medium transition-all"
                            required
                          />
                          <div className="h-px bg-stone-100 w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <label className="text-xs font-medium text-stone-400 uppercase tracking-wider block mb-1">Valor (Planejado)</label>
                            <input 
                              type="text" 
                              value={transAmount}
                              onChange={(e) => setTransAmount(maskCurrency(e.target.value))}
                              placeholder="0,00"
                              className={`w-full bg-transparent border-none rounded-none py-2 px-0 outline-none focus:ring-0 placeholder:text-stone-300 text-lg font-medium transition-all ${transType === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                              required
                            />
                            <div className="h-px bg-stone-100 w-full" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-stone-400 uppercase tracking-wider block mb-1">Data (Prevista)</label>
                            <input 
                              type="date" 
                              value={transDate}
                              onChange={(e) => setTransDate(e.target.value)}
                              className="w-full bg-transparent border-none rounded-none py-2 px-0 outline-none focus:ring-0 text-stone-600 font-medium transition-all"
                              required
                            />
                            <div className="h-px bg-stone-100 w-full" />
                          </div>
                        </div>
                        <div className="relative">
                          <label className="text-xs font-medium text-stone-400 uppercase tracking-wider block mb-1">Categoria</label>
                          <div 
                            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                            className="w-full py-2 cursor-pointer flex justify-between items-center"
                          >
                            <span className={`font-medium ${transCategory ? 'text-stone-900' : 'text-stone-300'}`}>
                              {transCategory || 'Selecionar Categoria...'}
                            </span>
                          </div>
                          <div className="h-px bg-stone-100 w-full" />
                          
                          <AnimatePresence>
                            {showCategoryDropdown && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute z-50 left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-black/5 p-4 space-y-4"
                              >
                                <div className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2">
                                  <Search size={14} className="text-stone-400" />
                                  <input 
                                    type="text" 
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    placeholder="Buscar ou criar..."
                                    className="bg-transparent border-none outline-none text-sm w-full"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {summary?.categories
                                    .filter(c => c.type === transType && c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                    .map(c => (
                                      <button 
                                        key={c.name}
                                        type="button"
                                        onClick={() => {
                                          setTransCategory(c.name);
                                          setShowCategoryDropdown(false);
                                          setCategorySearch('');
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-stone-50 transition-colors"
                                      >
                                        {c.name}
                                      </button>
                                    ))}
                                  {categorySearch && !summary?.categories.some(c => c.type === transType && c.name.toLowerCase() === categorySearch.toLowerCase()) && (
                                    <button 
                                      type="button"
                                      onClick={() => handleAddCategory(categorySearch)}
                                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                                    >
                                      <Plus size={14} />
                                      Criar "{categorySearch}"
                                    </button>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-stone-50">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setShowManageCategoriesModal(true);
                                      setShowCategoryDropdown(false);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-[10px] text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-widest bg-stone-50/50 rounded-xl"
                                  >
                                    <Settings size={12} />
                                    Editar categorias
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-stone-400 uppercase tracking-wider block mb-1">Conta/Cartão</label>
                          <select 
                            value={transAccount}
                            onChange={(e) => setTransAccount(e.target.value)}
                            className="w-full bg-transparent border-none rounded-none py-2 px-0 outline-none focus:ring-0 text-stone-600 font-medium transition-all appearance-none cursor-pointer"
                          >
                            {summary?.accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                            {cards.map(card => <option key={card.id} value={card.name}>{card.name}</option>)}
                          </select>
                          <div className="h-px bg-stone-100 w-full" />
                        </div>

                        <div className="pt-2">
                          <button 
                            type="button" 
                            onClick={() => {
                              const nextValue = !showRealizedFields;
                              setShowRealizedFields(nextValue);
                              if (nextValue && transPayments.length === 0) {
                                setTransPayments([{ amount: transAmount, date: new Date().toISOString().split('T')[0] }]);
                              }
                            }}
                            className={`flex items-center gap-2 text-[10px] font-medium px-3 py-1.5 rounded-full border transition-all ${showRealizedFields ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-transparent border-stone-200 text-stone-400 hover:text-stone-600'}`}
                          >
                            <CheckCircle2 size={12} />
                            Adicionar Pagamento
                          </button>
                        </div>

                        <AnimatePresence>
                          {showRealizedFields && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden space-y-4 pt-4 border-t border-emerald-100 bg-emerald-50/30 p-4 rounded-3xl mt-4"
                            >
                              <div className="space-y-4">
                                {transPayments.map((payment, index) => (
                                  <div key={index} className="grid grid-cols-2 gap-4 relative p-4 bg-white/50 rounded-2xl border border-emerald-100/50">
                                    <div>
                                      <label className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider block mb-1">Valor Pagamento</label>
                                      <input 
                                        type="text" 
                                        value={payment.amount}
                                        onChange={(e) => {
                                          const newPayments = [...transPayments];
                                          newPayments[index].amount = maskCurrency(e.target.value);
                                          setTransPayments(newPayments);
                                        }}
                                        placeholder="0,00"
                                        className="w-full bg-white border border-emerald-100 rounded-2xl py-2 px-3 outline-none focus:ring-2 ring-emerald-500/10 text-sm font-medium text-emerald-700"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider block mb-1">Data Pagamento</label>
                                      <input 
                                        type="date" 
                                        value={payment.date}
                                        onChange={(e) => {
                                          const newPayments = [...transPayments];
                                          newPayments[index].date = e.target.value;
                                          setTransPayments(newPayments);
                                        }}
                                        className="w-full bg-white border border-emerald-100 rounded-2xl py-2 px-3 outline-none focus:ring-2 ring-emerald-500/10 text-sm font-medium text-emerald-700"
                                      />
                                    </div>
                                    {transPayments.length > 1 && (
                                      <button 
                                        type="button"
                                        onClick={() => setTransPayments(transPayments.filter((_, i) => i !== index))}
                                        className="absolute -right-2 -top-2 p-1 bg-white rounded-full shadow-sm text-stone-400 hover:text-rose-500 transition-colors border border-stone-200"
                                      >
                                        <X size={10} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button 
                                  type="button"
                                  onClick={() => setTransPayments([...transPayments, { amount: '', date: new Date().toISOString().split('T')[0] }])}
                                  className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-2xl text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                                >
                                  <Plus size={12} />
                                  Adicionar Pagamento
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="pt-4 border-t border-stone-50 mt-4">
                          <button 
                            type="button" 
                            onClick={() => setIsRecurring(!isRecurring)}
                            className={`flex items-center gap-2 text-[10px] font-medium px-3 py-1.5 rounded-full border transition-all ${isRecurring ? 'bg-stone-900 border-stone-900 text-white' : 'bg-transparent border-stone-200 text-stone-400 hover:text-stone-600'}`}
                          >
                            <Repeat size={12} />
                            {isRecurring ? 'Lançamento Recorrente' : 'Marcar como Recorrente'}
                          </button>
                        </div>

                        <AnimatePresence>
                          {isRecurring && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0, marginTop: 0 }}
                              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                              exit={{ opacity: 0, height: 0, marginTop: 0 }}
                              className="overflow-hidden space-y-4 pt-4 border-t border-stone-50"
                            >
                                <div className="flex gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                      type="radio" 
                                      name="recurrenceMode"
                                      checked={recurrenceMode === 'continuous'} 
                                      onChange={() => setRecurrenceMode('continuous')}
                                      className="accent-stone-900"
                                    />
                                    <span className="text-[10px] text-stone-600 uppercase tracking-wider">Recorrência</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                      type="radio" 
                                      name="recurrenceMode"
                                      checked={recurrenceMode === 'installments'} 
                                      onChange={() => setRecurrenceMode('installments')}
                                      className="accent-stone-900"
                                    />
                                    <span className="text-[10px] text-stone-600 uppercase tracking-wider">Parcelado</span>
                                  </label>
                                </div>

                                {recurrenceMode === 'continuous' ? (
                                  <div>
                                    <label className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block mb-2">Frequência</label>
                                    <div className="flex gap-2">
                                      {['monthly', 'weekly'].map((f) => (
                                        <button 
                                          key={f}
                                          type="button" 
                                          onClick={() => setTransFrequency(f as any)}
                                          className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-lg border transition-all ${transFrequency === f ? 'bg-stone-800 border-stone-800 text-white font-medium' : 'bg-transparent border-stone-100 text-stone-400'}`}
                                        >
                                          {f === 'monthly' ? 'Mensal' : 'Semanal'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <label className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block mb-1">Número de Parcelas</label>
                                    <input 
                                      type="number" 
                                      min="2"
                                      value={installmentsCount}
                                      onChange={(e) => setInstallmentsCount(e.target.value)}
                                      className="w-full bg-stone-50 border border-black/5 rounded-xl py-2 px-4 outline-none focus:ring-2 ring-stone-900/5 transition-all text-sm"
                                      placeholder="Ex: 3, 4, 12..."
                                    />
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="w-full py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 hover:shadow-xl hover:shadow-stone-200 hover:scale-[1.02] active:scale-95 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                          {isSubmitting ? 'Processando...' : (editingTransaction ? 'Atualizar' : 'Confirmar Lançamento')}
                        </button>
                      </form>
                    </Card>
                  </motion.div>
                )}

                <div className="flex-1 w-full space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center bg-white p-1 rounded-2xl border border-stone-100 shadow-sm gap-2">
                      <div className="flex items-center">
                        <button 
                          onClick={handlePrevMonth}
                          className="p-2 hover:bg-white hover:shadow-md rounded-xl text-stone-400 hover:text-stone-900 transition-all hover:scale-110 active:scale-90 group"
                        >
                          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>

                        <div className="relative px-2 py-1 flex flex-col items-center min-w-[100px]">
                          <button 
                            onClick={() => setShowMonthMenu(!showMonthMenu)}
                            className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-900 transition-all hover:scale-105 flex items-center gap-1"
                          >
                            {showAllMonths ? 'Todos Lançamentos' : new Date(selectedYear, selectedMonth).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                            <ChevronDown size={10} className={`transition-transform ${showMonthMenu ? 'rotate-180' : ''}`} />
                          </button>

                          <AnimatePresence>
                            {showMonthMenu && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setShowMonthMenu(false)}
                                />
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-stone-100 shadow-xl rounded-2xl py-2 min-w-[160px] z-50 overflow-hidden"
                                >
                                  <button 
                                    onClick={() => {
                                      setShowAllMonths(false);
                                      handleCurrentMonth();
                                      setShowMonthMenu(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest hover:bg-stone-50 transition-colors flex items-center gap-2 ${!showAllMonths ? 'text-stone-900 bg-stone-50/50' : 'text-stone-400'}`}
                                  >
                                    <div className={`w-1.5 h-1.5 rounded-full ${!showAllMonths ? 'bg-stone-900' : 'bg-transparent border border-stone-300'}`} />
                                    Mês Atual
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setShowAllMonths(true);
                                      setShowMonthMenu(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest hover:bg-stone-50 transition-colors flex items-center gap-2 ${showAllMonths ? 'text-stone-900 bg-stone-50/50' : 'text-stone-400'}`}
                                  >
                                    <div className={`w-1.5 h-1.5 rounded-full ${showAllMonths ? 'bg-stone-900' : 'bg-transparent border border-stone-300'}`} />
                                    Todos Lançamentos
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        <button 
                          onClick={handleNextMonth}
                          className="p-2 hover:bg-white hover:shadow-md rounded-xl text-stone-400 hover:text-stone-900 transition-all hover:scale-110 active:scale-90 group"
                        >
                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                      
                      <div className="w-px h-6 bg-stone-100 hidden sm:block mx-1" />
                      
                      <div className="flex p-0.5 bg-stone-50/50 rounded-xl">
                        {(['all', 'income', 'expense'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              setFilterType(type);
                              setFilterStatus('all');
                            }}
                            className={`px-4 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${filterType === type ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600 hover:bg-white hover:shadow-sm'}`}
                          >
                            {type === 'all' ? 'Tudo' : type === 'income' ? 'Receitas' : 'Despesas'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowFilterRow(!showFilterRow)}
                      className={`p-3 rounded-2xl border transition-all flex items-center gap-2 group hover:scale-105 active:scale-95 ${showFilterRow ? 'bg-stone-900 border-stone-900 text-white shadow-lg shadow-stone-200' : 'bg-white border-stone-100 text-stone-400 hover:text-stone-900 hover:border-stone-200 shadow-sm hover:shadow-md'}`}
                    >
                      <Filter size={16} className={`${showFilterRow ? 'animate-pulse' : 'group-hover:rotate-12 transition-transform'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest hidden md:block">Filtros</span>
                    </button>

                    <button 
                      onClick={handleExportExcel}
                      className="p-3 rounded-2xl border border-stone-100 bg-white text-stone-400 hover:text-stone-900 hover:border-stone-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group"
                      title="Exportar para Excel"
                    >
                      <FileDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest hidden md:block">Exportar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    { (selectedMonth !== new Date().getMonth() || selectedYear !== new Date().getFullYear()) && (
                      <button 
                        onClick={handleCurrentMonth}
                        className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-all"
                      >
                        Mês Atual
                      </button>
                    )}
                    <button 
                      onClick={() => setShowNewTransactionForm(true)}
                      className="bg-stone-900 text-white px-6 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-stone-300 active:scale-95 shadow-xl shadow-stone-200 flex items-center gap-2 group"
                    >
                      <Plus size={14} className="text-emerald-400 group-hover:rotate-90 transition-transform" />
                      Novo Lançamento
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showFilterRow && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-xl shadow-stone-200/50 space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Filtros Avançados</h4>
                          <button 
                            onClick={() => {
                              setFilterText('');
                              setFilterCategory('all');
                              setFilterType('all');
                              setFilterAccount('all');
                              setFilterStatus('all');
                              setFilterDay('');
                              setFilterMinAmount('');
                              setFilterMaxAmount('');
                            }}
                            className="text-[9px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors"
                          >
                            Limpar Tudo
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                          <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1">Status</label>
                            <div className="flex p-1 bg-stone-50 rounded-xl">
                              {(['all', 'overdue', 'due-soon'] as const).map((status) => (
                                <button
                                  key={status}
                                  onClick={() => setFilterStatus(status)}
                                  className={`flex-1 py-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${filterStatus === status ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                >
                                  {status === 'all' ? 'Todos' : status === 'overdue' ? 'Vencidos' : 'Próximos'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1">Conta / Cartão</label>
                            <select 
                              className="w-full h-12 bg-stone-50 border-none rounded-xl px-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                              value={filterAccount}
                              onChange={(e) => setFilterAccount(e.target.value)}
                            >
                              <option value="all">Todas as Contas</option>
                              {Array.from(new Set(transactions.map(t => t.account))).map(acc => (
                                <option key={acc} value={acc}>{acc}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1">Categoria</label>
                            <select 
                              className="w-full h-12 bg-stone-50 border-none rounded-xl px-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                              value={filterCategory}
                              onChange={(e) => setFilterCategory(e.target.value)}
                            >
                              <option value="all">Todas</option>
                              {summary?.categories.map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1">Mais Filtros</label>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="relative">
                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input 
                                  type="text"
                                  placeholder="Descrição..."
                                  className="w-full h-12 pl-9 pr-3 bg-stone-50 border-none rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                                  value={filterText}
                                  onChange={(e) => setFilterText(e.target.value)}
                                />
                              </div>
                              <input 
                                type="number"
                                min="1"
                                max="31"
                                className="w-full h-12 px-3 bg-stone-50 border-none rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                                placeholder="Filtrar Dia (Ex: 15)"
                                value={filterDay}
                                onChange={(e) => setFilterDay(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-black/5">
                            <th className="pb-4 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 group cursor-pointer hover:text-stone-900 transition-colors px-4" onClick={() => handleSort('date')}>
                              <div className="flex items-center gap-1">
                                Data
                                <ArrowUpDown size={10} className={`${sortField === 'date' ? 'text-stone-900 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                              </div>
                            </th>
                            <th className="pb-4 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 group cursor-pointer hover:text-stone-900 transition-colors" onClick={() => handleSort('description')}>
                              <div className="flex items-center gap-1">
                                Descrição
                                <ArrowUpDown size={10} className={`${sortField === 'description' ? 'text-stone-900 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                              </div>
                            </th>
                            <th className="pb-4 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 group cursor-pointer hover:text-stone-900 transition-colors" onClick={() => handleSort('category')}>
                              <div className="flex items-center gap-1">
                                Categoria
                                <ArrowUpDown size={10} className={`${sortField === 'category' ? 'text-stone-900 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                              </div>
                            </th>
                            <th className="pb-4 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 text-right group cursor-pointer hover:text-stone-900 transition-colors" onClick={() => handleSort('amount')}>
                              <div className="flex items-center justify-end gap-1">
                                Valor
                                <ArrowUpDown size={10} className={`${sortField === 'amount' ? 'text-stone-900 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                              </div>
                            </th>
                            <th className="pb-4 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 text-right px-4">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {filteredTransactions.length > 0 ? (
                            filteredTransactions.map((t) => (
                              <tr key={t.id} className={`group hover:bg-stone-50 transition-all duration-300 ${t.settled ? 'opacity-40 grayscale-[0.2]' : ''}`}>
                                <td className="py-4 text-sm text-stone-500 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    {getTransactionStatus(t) === 'settled' && <CheckCircle2 size={14} className="text-emerald-500" />}
                                    {getTransactionStatus(t) === 'overdue' && <AlertCircle size={14} className="text-rose-600 fill-rose-50" />}
                                    {getTransactionStatus(t) === 'due-soon' && <Clock size={14} className="text-amber-500" />}
                                    {getTransactionStatus(t) === 'normal' && <Circle size={14} className="text-stone-300" />}
                                    {new Date(t.date).toLocaleDateString('pt-BR')}
                                  </div>
                                </td>
                                <td className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${t.settled ? 'bg-stone-100 text-stone-400' : (t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}`}>
                                      {t.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={`font-medium text-sm ${t.settled ? 'line-through text-stone-400' : ''}`}>{t.description}</span>
                                      <div className="flex flex-wrap gap-2 items-center">
                                        {(t.isRecurringEntry || t.installmentGroup) && (
                                          <span className="text-[9px] text-stone-400 flex items-center gap-1 uppercase tracking-wider">
                                            <Repeat size={10} />
                                            {t.isRecurringEntry ? 'Recorrente' : 'Parcelado'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4"><span className="text-xs bg-stone-100 px-2 py-1 rounded-md text-stone-600">{t.category}</span></td>
                                <td className={`py-4 text-sm font-semibold text-right ${t.settled ? 'text-stone-400' : (t.type === 'income' ? 'text-emerald-600' : 'text-rose-600')}`}>
                                   <div className="flex flex-col items-end">
                                     <span>{t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}</span>
                                     <span className="text-[10px] font-medium text-stone-400">
                                       {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateRealizedAmount(t))}
                                     </span>
                                   </div>
                                 </td>
                                 <td className="py-4 text-right">
                                   <div className="flex justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 relative">
                                    {!t.settled ? (
                                      <>
                                        <button 
                                          onClick={(e) => handleAddPaymentClick(t, e)} 
                                          className="p-2 rounded-lg transition-all hover:scale-110 active:scale-90 hover:bg-stone-200 text-stone-400 hover:text-stone-600 hover:shadow-md"
                                          title="Adicionar Pagamento"
                                        >
                                          <Plus size={16} />
                                        </button>
                                        <button 
                                          onClick={() => handleQuitarClick(t)} 
                                          className="p-2 rounded-lg transition-all hover:scale-110 active:scale-90 hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 hover:shadow-md"
                                          title="Quitar"
                                        >
                                          <CheckCircle2 size={16} />
                                        </button>
                                      </>
                                    ) : (
                                      <button 
                                        onClick={(e) => handleToggleSettle(t, e)} 
                                        className="p-2 rounded-lg transition-all hover:scale-110 active:scale-90 bg-emerald-100 text-emerald-600 shadow-sm"
                                        title="Reverter Quitação"
                                      >
                                        <CheckCircle2 size={16} />
                                      </button>
                                    )}
                                    <button onClick={() => handleEditClick(t)} className="p-2 hover:bg-stone-200 hover:scale-110 active:scale-90 hover:shadow-md rounded-lg text-stone-500 transition-all" title="Visualizar / Editar"><Edit2 size={14} /></button>
                                    {!t.settled && (
                                      <button onClick={() => confirmDelete(t)} className="p-2 hover:bg-rose-100 hover:scale-110 active:scale-90 hover:shadow-md rounded-lg text-rose-500 transition-all"><Trash2 size={14} /></button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-12 text-center">
                                <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">Nenhum lançamento para este período</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
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

        <AnimatePresence>
          {showManageCategoriesModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && setShowManageCategoriesModal(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/5"
              >
                <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/30">
                  <div>
                    <h3 className="font-semibold text-xl tracking-tight text-stone-900">Gerenciar Categorias</h3>
                    <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mt-1">Personalize suas receitas e despesas</p>
                  </div>
                  <button onClick={() => setShowManageCategoriesModal(false)} className="p-2.5 hover:bg-white hover:shadow-sm rounded-2xl transition-all text-stone-400 hover:text-stone-600 border border-transparent hover:border-black/5">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-8 max-h-[60vh] overflow-y-auto space-y-10 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-12">
                    {/* Despesas */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-rose-500">Despesas</h4>
                        </div>
                        <button 
                          onClick={() => setAddingCategoryType('expense')}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div className="space-y-1">
                        {addingCategoryType === 'expense' && (
                          <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100 mb-2">
                            <input 
                              autoFocus
                              className="text-sm font-medium bg-transparent border-b border-rose-200 outline-none w-full py-1 text-rose-900 placeholder:text-rose-300"
                              placeholder="Nova categoria..."
                              value={manualCategoryName}
                              onChange={(e) => setManualCategoryName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddCategoryModal('expense');
                                }
                                if (e.key === 'Escape') {
                                  setAddingCategoryType(null);
                                  setManualCategoryName('');
                                }
                              }}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button onClick={() => {setAddingCategoryType(null); setManualCategoryName('');}} className="text-[10px] uppercase font-bold text-stone-400">Cancelar</button>
                              <button onClick={() => handleAddCategoryModal('expense')} className="text-[10px] uppercase font-bold text-rose-600">Salvar</button>
                            </div>
                          </div>
                        )}
                        {summary?.categories.filter(c => c.type === 'expense').map(c => (
                          <div key={c.name} className="flex items-center justify-between group p-3 hover:bg-stone-50 rounded-2xl transition-all">
                            {editingCategoryInModal?.name === c.name && editingCategoryInModal?.type === 'expense' ? (
                              <input 
                                autoFocus
                                className="text-sm font-medium bg-transparent border-b-2 border-stone-900 outline-none w-full mr-4 py-1"
                                value={newCategoryNameInModal}
                                onChange={(e) => setNewCategoryNameInModal(e.target.value)}
                                onBlur={() => handleUpdateCategory('expense', c.name, newCategoryNameInModal)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory('expense', c.name, newCategoryNameInModal)}
                              />
                            ) : (
                              <span className="text-sm text-stone-600 font-medium">{c.name}</span>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingCategoryInModal({ name: c.name, type: 'expense' });
                                  setNewCategoryNameInModal(c.name);
                                }}
                                className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-stone-400 hover:text-stone-900 transition-all border border-transparent hover:border-black/5"
                                title="Editar"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCategory('expense', c.name)}
                                className="p-2 hover:bg-rose-50 rounded-xl text-stone-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Receitas */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-500">Receitas</h4>
                        </div>
                        <button 
                          onClick={() => setAddingCategoryType('income')}
                          className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-500 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div className="space-y-1">
                        {addingCategoryType === 'income' && (
                          <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 mb-2">
                            <input 
                              autoFocus
                              className="text-sm font-medium bg-transparent border-b border-emerald-200 outline-none w-full py-1 text-emerald-900 placeholder:text-emerald-300"
                              placeholder="Nova categoria..."
                              value={manualCategoryName}
                              onChange={(e) => setManualCategoryName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddCategoryModal('income');
                                }
                                if (e.key === 'Escape') {
                                  setAddingCategoryType(null);
                                  setManualCategoryName('');
                                }
                              }}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button onClick={() => {setAddingCategoryType(null); setManualCategoryName('');}} className="text-[10px] uppercase font-bold text-stone-400">Cancelar</button>
                              <button onClick={() => handleAddCategoryModal('income')} className="text-[10px] uppercase font-bold text-emerald-600">Salvar</button>
                            </div>
                          </div>
                        )}
                        {summary?.categories.filter(c => c.type === 'income').map(c => (
                          <div key={c.name} className="flex items-center justify-between group p-3 hover:bg-stone-50 rounded-2xl transition-all">
                            {editingCategoryInModal?.name === c.name && editingCategoryInModal?.type === 'income' ? (
                              <input 
                                autoFocus
                                className="text-sm font-medium bg-transparent border-b-2 border-stone-900 outline-none w-full mr-4 py-1"
                                value={newCategoryNameInModal}
                                onChange={(e) => setNewCategoryNameInModal(e.target.value)}
                                onBlur={() => handleUpdateCategory('income', c.name, newCategoryNameInModal)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory('income', c.name, newCategoryNameInModal)}
                              />
                            ) : (
                              <span className="text-sm text-stone-600 font-medium">{c.name}</span>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingCategoryInModal({ name: c.name, type: 'income' });
                                  setNewCategoryNameInModal(c.name);
                                }}
                                className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-stone-400 hover:text-stone-900 transition-all border border-transparent hover:border-black/5"
                                title="Editar"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCategory('income', c.name)}
                                className="p-2 hover:bg-rose-50 rounded-xl text-stone-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-stone-50/50 border-t border-stone-100 flex justify-end">
                  <button 
                    onClick={() => setShowManageCategoriesModal(false)}
                    className="px-8 py-3 bg-stone-900 text-white rounded-2xl text-sm font-semibold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                  >
                    Concluído
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettleModal && settlingTransaction && (
            <div className="fixed inset-0 z-[1000] pointer-events-auto">
              {/* Overlay to detect outside clicks */}
              <div className="absolute inset-0 bg-black/5" onClick={() => setShowSettleModal(false)} />
              
              <motion.div 
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                style={{ 
                  position: 'fixed', 
                  top: settleCoords.top - 80, // Offset to align vertically
                  left: settleCoords.left - 290, // Left of the button
                }}
                className="w-[280px] bg-white border border-black/5 shadow-2xl rounded-3xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Arrow pointing to button */}
                <div className="absolute right-[-6px] top-[90px] w-3 h-3 bg-white border-r border-t border-black/10 rotate-45" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Adicionar Pagamento</h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[8px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Valor Pagamento</label>
                      <input 
                        type="text" 
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(maskCurrency(e.target.value))}
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl py-2 px-3 outline-none focus:ring-2 ring-emerald-500/10 text-xs font-bold text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Data Pagamento</label>
                      <input 
                        type="date" 
                        value={settleDate}
                        onChange={(e) => setSettleDate(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl py-2 px-3 outline-none focus:ring-2 ring-emerald-500/10 text-xs font-bold text-stone-900"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setShowSettleModal(false)}
                      className="flex-1 py-2 text-stone-400 hover:text-stone-600 text-[10px] font-bold uppercase tracking-widest"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleConfirmSettle}
                      disabled={isSubmittingSettle}
                      className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                    >
                      {isSubmittingSettle ? '...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showQuitarWarning && transactionToQuitar && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
              onClick={(e) => e.target === e.currentTarget && setShowQuitarWarning(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/5"
              >
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Pagamento Incompleto</h3>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Os pagamentos registrados (R$ {(transactionToQuitar.payments || []).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}) são menores que o valor previsto (R$ {transactionToQuitar.amount.toFixed(2)}).
                  </p>

                  <div className="mt-8 space-y-3">
                    <button 
                      onClick={(e) => {
                        setShowQuitarWarning(false);
                        // Mock event for coordinates
                        const mockEvent = {
                          currentTarget: {
                            getBoundingClientRect: () => ({ top: window.innerHeight / 2, left: window.innerWidth / 2 + 150 })
                          }
                        } as any;
                        handleAddPaymentClick(transactionToQuitar, mockEvent);
                      }}
                      className="w-full py-4 bg-stone-900 text-white rounded-2xl text-sm font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-200 active:scale-95"
                    >
                      Adicionar Pagamento
                    </button>
                    <button 
                      onClick={handleConfirmQuitarAnyway}
                      className="w-full py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all active:scale-95"
                    >
                      Quitar assim mesmo
                    </button>
                    <button 
                      onClick={() => setShowQuitarWarning(false)}
                      className="w-full py-2 text-stone-400 text-[10px] font-bold uppercase tracking-widest hover:text-stone-600 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDeleteModal && transactionToDelete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
              onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/5"
              >
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Trash2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Excluir Lançamento?</h3>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Você está prestes a excluir <span className="font-semibold text-stone-900">"{transactionToDelete.description}"</span>. Esta ação não pode ser desfeita.
                  </p>

                  {(transactionToDelete.isRecurringEntry || transactionToDelete.installmentGroup) ? (
                    <div className="mt-8 space-y-3">
                      <button 
                        onClick={() => handleDeleteTransaction(transactionToDelete.id, 'single')}
                        className="w-full py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all active:scale-95"
                      >
                        Excluir Apenas Este
                      </button>
                      <button 
                        onClick={() => handleDeleteTransaction(transactionToDelete.id, 'future')}
                        className="w-full py-4 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 active:scale-95"
                      >
                        Excluir Este e Futuros
                      </button>
                    </div>
                  ) : (
                    <div className="mt-8 grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setShowDeleteModal(false)}
                        className="w-full py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all active:scale-95"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleDeleteTransaction(transactionToDelete.id, 'single')}
                        className="w-full py-4 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 active:scale-95"
                      >
                        Confirmar
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
