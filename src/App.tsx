import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { firestoreService } from './lib/firestoreService';
import { createRecurringOrInstallments } from './lib/transactionUtils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  Search,
  LayoutDashboard, 
  PlusCircle, 
  Wallet, 
  CreditCard, 
  Target, 
  BarChart3, 
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
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
  Square,
  CheckSquare,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  Circle,
  ArrowUpDown,
  Filter,
  ChevronDown,
  ChevronUp,
  LogOut,
  Loader2,
  Download,
  FileDown,
  GripVertical,
  Landmark
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
  recurringFrequency?: 'monthly' | 'weekly' | 'annually';
  installmentGroup?: number;
  installmentSequence?: number;
  totalInstallments?: number;
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
  id: string | number;
  name: string;
  limit: number;
  used: number;
  closingDate?: string;
  dueDate?: string;
  type: 'credit' | 'bank';
  brand?: string;
  bankLogo?: string;
  overdraftLimit?: number;
}

const CARD_BRANDS = [
  { id: 'visa', name: 'Visa', logo: 'visa.com' },
  { id: 'mastercard', name: 'Mastercard', logo: 'mastercard.com' },
  { id: 'elo', name: 'Elo', logo: 'elo.com.br' },
  { id: 'amex', name: 'American Express', logo: 'amex.com' },
  { id: 'hipercard', name: 'Hipercard', logo: 'hipercard.com.br' },
  { id: 'diners', name: 'Diners Club', logo: 'dinersclub.com' },
];

const BRAZILIAN_BANKS = [
  { id: 'itau', name: 'Itaú Unibanco', logo: 'itau.com.br' },
  { id: 'bb', name: 'Banco do Brasil', logo: 'bb.com.br' },
  { id: 'bradesco', name: 'Bradesco', logo: 'bradesco.com.br' },
  { id: 'caixa', name: 'Caixa Econômica', logo: 'caixa.gov.br' },
  { id: 'santander', name: 'Santander', logo: 'santander.com.br' },
  { id: 'nubank', name: 'Nubank', logo: 'nubank.com.br' },
  { id: 'inter', name: 'Banco Inter', logo: 'bancointer.com.br' },
  { id: 'c6', name: 'C6 Bank', logo: 'c6bank.com.br' },
  { id: 'btg', name: 'BTG Pactual', logo: 'btgpactual.com.br' },
  { id: 'xp', name: 'XP Investimentos', logo: 'xp.com.br' },
  { id: 'safra', name: 'Banco Safra', logo: 'safra.com.br' },
  { id: 'pan', name: 'Banco Pan', logo: 'bancopan.com.br' },
  { id: 'bmg', name: 'Banco BMG', logo: 'bancobmg.com.br' },
  { id: 'neon', name: 'Neon', logo: 'neon.com.br' },
  { id: 'pagbank', name: 'PagBank', logo: 'pagbank.com.br' },
  { id: 'mercadopago', name: 'Mercado Pago', logo: 'mercadopago.com.br' },
  { id: 'picpay', name: 'PicPay', logo: 'picpay.com.br' },
  { id: 'digio', name: 'Digio', logo: 'digio.com.br' },
  { id: 'original', name: 'Banco Original', logo: 'original.com.br' },
  { id: 'sicredi', name: 'Sicredi', logo: 'sicredi.com.br' },
  { id: 'sicoob', name: 'Sicoob', logo: 'sicoob.com.br' },
  { id: 'banrisul', name: 'Banrisul', logo: 'banrisul.com.br' },
  { id: 'modal', name: 'Banco Modal', logo: 'modal.com.br' },
  { id: 'agibank', name: 'Agibank', logo: 'agibank.com.br' },
  { id: 'daycoval', name: 'Banco Daycoval', logo: 'daycoval.com.br' },
  { id: 'cora', name: 'Cora', logo: 'cora.com.br' },
  { id: 'stone', name: 'Stone', logo: 'stone.com.br' },
  { id: 'votorantim', name: 'Banco BV', logo: 'bv.com.br' },
  { id: 'will', name: 'Will Bank', logo: 'willbank.com.br' },
  { id: 'bnb', name: 'Banco do Nordeste', logo: 'bnb.gov.br' },
  { id: 'basa', name: 'Banco da Amazônia', logo: 'bancodaamazonia.com.br' },
  { id: 'efi', name: 'Efí (Gerencianet)', logo: 'sejaefi.com.br' },
  { id: 'creditas', name: 'Creditas', logo: 'creditas.com' },
  { id: 'outro', name: 'Outro Banco', logo: '' }
];

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

const StatCard = ({ title, value, realizedValue, icon: Icon, color, tooltip }: any) => (
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

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', type: 'expense', sortOrder: 0 },
  { name: 'Salário', type: 'income', sortOrder: 1 },
  { name: 'Lazer', type: 'expense', sortOrder: 2 },
  { name: 'Moradia', type: 'expense', sortOrder: 3 },
  { name: 'Transporte', type: 'expense', sortOrder: 4 },
  { name: 'Saúde', type: 'expense', sortOrder: 5 },
  { name: 'Educação', type: 'expense', sortOrder: 6 },
  { name: 'Mercado', type: 'expense', sortOrder: 7 },
  { name: 'Assinaturas', type: 'expense', sortOrder: 8 },
  { name: 'Vendas', type: 'income', sortOrder: 9 },
  { name: 'Investimentos', type: 'income', sortOrder: 10 }
];

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, logout, connectionError } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const lastInsightRef = React.useRef<number>(0);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);

  // Form states for new card
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [newCardName, setNewCardName] = useState('');
  const [newCardType, setNewCardType] = useState<'credit' | 'bank'>('credit');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('');
  const [newCardDue, setNewCardDue] = useState('');
  const [newCardBrand, setNewCardBrand] = useState('visa');
  const [newCardBank, setNewCardBank] = useState('itau');
  const [newCardOverdraft, setNewCardOverdraft] = useState('');
  const [bankSearch, setBankSearch] = useState('');

  // Form states for new transaction
  const [showNewTransactionForm, setShowNewTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transDescription, setTransDescription] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [transCategory, setTransCategory] = useState('');
  const [transAccount, setTransAccount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [transPayments, setTransPayments] = useState<{ amount: string, date: string }[]>([{ amount: '', date: new Date().toISOString().split('T')[0] }]);
  const [showRealizedFields, setShowRealizedFields] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'continuous' | 'installments'>('continuous');
  const [transFrequency, setTransFrequency] = useState<'monthly' | 'weekly' | 'annually'>('monthly');
  const [installmentsCount, setInstallmentsCount] = useState('3');
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [editingCategoryInModal, setEditingCategoryInModal] = useState<{name: string, type: string} | null>(null);
  const [newCategoryNameInModal, setNewCategoryNameInModal] = useState('');
  const [addingCategoryType, setAddingCategoryType] = useState<'income' | 'expense' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
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
  
  const [showCardDeleteModal, setShowCardDeleteModal] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CardData | null>(null);
  
  const [showCategoryDeleteModal, setShowCategoryDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{name: string, type: 'income' | 'expense'} | null>(null);
  const [isCategoryInUse, setIsCategoryInUse] = useState(false);
  
  const [showQuitarWarning, setShowQuitarWarning] = useState(false);
  const [transactionToQuitar, setTransactionToQuitar] = useState<Transaction | null>(null);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

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

  const handleToggleSelect = (id: string) => {
    setSelectedTransactions(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (visibleIds: string[]) => {
    const uniqueVisibleIds = Array.from(new Set(visibleIds));
    if (uniqueVisibleIds.every(id => selectedTransactions.includes(id))) {
      setSelectedTransactions(prev => prev.filter(id => !uniqueVisibleIds.includes(id)));
    } else {
      const newSelection = Array.from(new Set([...selectedTransactions, ...uniqueVisibleIds]));
      setSelectedTransactions(newSelection);
    }
  };

  const handleBulkQuitar = async () => {
    if (selectedTransactions.length === 0 || !user) return;
    setIsBulkSubmitting(true);
    try {
      for (const id of selectedTransactions) {
        const t = transactions.find(trans => trans.id.toString() === id);
        if (t && !t.settled) {
          const payload = {
            ...t,
            settled: true,
            payments: [{ amount: t.amount, date: new Date().toISOString().split('T')[0] }]
          };
          const { id: _, ...updateData } = payload;
          await firestoreService.updateTransaction(id, updateData);
        }
      }
      setSuccessMessage(`${selectedTransactions.length} lançamentos quitados com sucesso!`);
      setSelectedTransactions([]);
      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMessage("Erro ao quitar em lote.");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleBulkDeleteRequest = () => {
    if (selectedTransactions.length > 0) {
      setShowBulkDeleteModal(true);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedTransactions.length === 0) return;
    
    setIsBulkSubmitting(true);
    try {
      await Promise.all(selectedTransactions.map(id => firestoreService.deleteTransaction(id)));
      
      setSuccessMessage(`${selectedTransactions.length} lançamentos excluídos com sucesso!`);
      setSelectedTransactions([]);
      setShowBulkDeleteModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMessage("Erro ao excluir em lote.");
    } finally {
      setIsBulkSubmitting(false);
    }
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
        
        // Special search term for orphaned transactions
        if (search === 'órfão' || search === 'orfao') {
          return !cards.some(c => (c.name || '').toLowerCase().trim() === (t.account || '').toLowerCase().trim());
        }

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

  const computedCards = React.useMemo(() => {
    return cards.map(card => {
      const cardTransactions = transactions.filter(t => 
        (t.account || '').toLowerCase().trim() === (card.name || '').toLowerCase().trim()
      );
      
      const totalIncome = cardTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        
      const totalExpense = cardTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
      // Both bank and credit use the same logic for "Available Value"
      // Balance/Available = Initial/Limit + Income - Expense
      const computedValue = (Number(card.limit) || 0) + totalIncome - totalExpense;
      
      return {
        ...card,
        used: computedValue
      };
    });
  }, [cards, transactions]);

  // Check for transactions that don't belong to any known card/account
  const orphanedTransactions = React.useMemo(() => {
    return transactions.filter(t => 
      !cards.some(c => (c.name || '').toLowerCase().trim() === (t.account || '').toLowerCase().trim())
    );
  }, [cards, transactions]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const currentUid = user.uid;
      console.log("Fetching data for UID:", currentUid);
      const [transactionsData, cardsData, accountsRawData, categoriesData] = await Promise.all([
        firestoreService.getTransactions(currentUid),
        firestoreService.getCards(currentUid),
        firestoreService.getAccounts(currentUid),
        firestoreService.getCategories(currentUid)
      ]);
      
      console.log("Fetched transactions count:", (transactionsData as any[])?.length || 0);
      console.log("Fetched cards count:", (cardsData as any[])?.length || 0);
      
      const transactionsRaw = (transactionsData as any[]) || [];
      const cardsRaw = (cardsData as any[]) || [];
      const accountsRaw = (accountsRawData as any[]) || [];
      const categoriesRaw = (categoriesData as any[]) || [];
      
      // Merge legacy 'accounts' collection items into cards if they aren't already there
      const unifiedCards: CardData[] = [...cardsRaw];
      accountsRaw.forEach(acc => {
        if (!unifiedCards.find(c => c.id === acc.id)) {
          unifiedCards.push({
            ...acc,
            type: acc.type || 'bank',
            limit: acc.limit || acc.balance || 0
          });
        }
      });

      // Calculate summary on frontend
      const totalInitialBalance = unifiedCards
        .filter(c => c.type === 'bank')
        .reduce((acc, c) => acc + (Number(c.limit) || 0), 0);

      const totalIncome = transactionsRaw.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const totalExpense = transactionsRaw.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const balance = totalInitialBalance + totalIncome - totalExpense;

      const totalRealizedIncome = transactionsRaw.filter(t => t.type === 'income').reduce((acc, t) => acc + calculateRealizedAmount(t), 0);
      const totalRealizedExpense = transactionsRaw.filter(t => t.type === 'expense').reduce((acc, t) => acc + calculateRealizedAmount(t), 0);
      const realizedBalance = totalInitialBalance + totalRealizedIncome - totalRealizedExpense;

      // Calculate categories: Use persistent if they exist, otherwise use defaults
      const rawMergedCategories = categoriesRaw.length > 0 
        ? [...categoriesRaw]
        : [...DEFAULT_CATEGORIES];

      // Deduplicate categories by name and type
      const mergedCategories = Array.from(
        new Map(rawMergedCategories.map(c => [`${c.type}-${c.name}`, c])).values()
      ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      const summaryData: Summary = {
        balance,
        income: totalIncome,
        expense: totalExpense,
        realizedBalance,
        realizedIncome: totalRealizedIncome,
        realizedExpense: totalRealizedExpense,
        accounts: unifiedCards.filter(c => c.type === 'bank').map(c => ({
          ...c,
          balance: (Number(c.limit) || 0)
        })),
        cards: unifiedCards,
        categories: mergedCategories
      };
      
      setSummary(summaryData);
      
      // Deduplicate transactions by ID
      const uniqueTransactions = Array.from(
        new Map(transactionsRaw.map(t => [t.id, t])).values()
      ).sort((a: any, b: any) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }) as Transaction[];
      
      setTransactions(uniqueTransactions);
      setCards(unifiedCards);

      // Reset filters if no data in current month but data exists elsewhere
      if (uniqueTransactions.length > 0 && !showAllMonths) {
        const hasDataInActiveMonth = uniqueTransactions.some(t => {
          const d = new Date(t.date);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
        if (!hasDataInActiveMonth) {
          setShowAllMonths(true);
          setSuccessMessage("Mostrando dados de todos os períodos para ajudar a encontrar seus lançamentos.");
          setTimeout(() => setSuccessMessage(null), 5000);
        }
      }

      // Generate insights
      const now = Date.now();
      if (now - lastInsightRef.current > 60000) {
        try {
          const insightData = await AIService.generateInsights({ 
            transactions: uniqueTransactions, 
            accounts: summaryData.accounts,
            cards: unifiedCards
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
      setErrorMessage("Erro ao buscar dados do servidor. Verifique sua conexão.");
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

  const getAutoLogo = (name: string) => {
    const lowercaseName = name.toLowerCase();
    const bank = BRAZILIAN_BANKS.find(b => 
      (b.id !== 'outro' && lowercaseName.includes(b.id.toLowerCase())) || 
      (b.name !== 'Outro Banco' && lowercaseName.includes(b.name.toLowerCase()))
    );
    return bank?.logo;
  };

  const getCardLogoUrl = (domain: string) => {
    if (!domain) return '';
    if (domain.startsWith('http')) return domain;
    return `https://logo.clearbit.com/${domain}`;
  };

  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement, Event>, domain: string) => {
    const target = e.target as HTMLImageElement;
    // If Clearbit fails, try Google as secondary
    if (target.src.includes('clearbit.com')) {
      target.src = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const bankDropdown = document.getElementById('bank-dropdown-list');
      const brandDropdown = document.getElementById('brand-dropdown-list');
      
      if (bankDropdown && !bankDropdown.contains(event.target as Node) && !bankDropdown.previousElementSibling?.contains(event.target as Node)) {
        bankDropdown.classList.add('hidden');
      }
      
      if (brandDropdown && !brandDropdown.contains(event.target as Node) && !brandDropdown.previousElementSibling?.contains(event.target as Node)) {
        brandDropdown.classList.add('hidden');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parseCurrency = (formattedValue: string) => {
    return (parseInt(formattedValue.replace(/\D/g, ''), 10) || 0) / 100;
  };

  const resetCardForm = () => {
    setEditingCard(null);
    setNewCardName('');
    setNewCardType('credit');
    setNewCardLimit('');
    setNewCardClosing('');
    setNewCardDue('');
    setNewCardBrand('visa');
    setNewCardBank('itau');
    setNewCardOverdraft('');
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        const cardData = {
        name: newCardName,
        type: newCardType,
        limit: parseCurrency(newCardLimit),
        closingDate: newCardType === 'credit' ? newCardClosing : undefined,
        dueDate: newCardType === 'credit' ? newCardDue : undefined,
        brand: newCardType === 'credit' ? newCardBrand : undefined,
        bankLogo: newCardType === 'bank' ? BRAZILIAN_BANKS.find(b => b.id === newCardBank)?.logo : undefined,
        bankId: newCardType === 'bank' ? newCardBank : undefined,
        overdraftLimit: newCardType === 'bank' ? parseCurrency(newCardOverdraft) : undefined
      };

      if (editingCard) {
        await firestoreService.updateCard(editingCard.id.toString(), cardData);
        setSuccessMessage("Atualizado com sucesso!");
      } else {
        await firestoreService.addCard({ ...cardData, used: 0 });
        setSuccessMessage("Salvo com sucesso!");
      }

      setShowNewCardForm(false);
      resetCardForm();
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
      setErrorMessage("Erro ao salvar card/conta.");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCardClick = (card: CardData) => {
    setEditingCard(card);
    setNewCardName(card.name);
    setNewCardType(card.type);
    setNewCardLimit(maskCurrency((card.limit * 100).toFixed(0)));
    setNewCardClosing(card.closingDate || '');
    setNewCardDue(card.dueDate || '');
    setNewCardBrand(card.brand || 'visa');
    setNewCardBank((card as any).bankId || 'itau');
    setNewCardOverdraft(card.overdraftLimit ? maskCurrency((card.overdraftLimit * 100).toFixed(0)) : '');
    setShowNewCardForm(true);
  };

  const handleDeleteCard = async (id: string) => {
    setIsSubmitting(true);
    try {
      await firestoreService.deleteCard(id);
      setShowCardDeleteModal(false);
      setCardToDelete(null);
      fetchData();
      setSuccessMessage("Removido com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error(e);
      setErrorMessage("Erro ao remover.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteCard = (card: CardData) => {
    setCardToDelete(card);
    setShowCardDeleteModal(true);
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

    if (!transAccount) {
      setErrorMessage("Por favor, selecione uma conta ou cartão.");
      setIsSubmitting(false);
      return;
    }

    const payload: any = {
      description: transDescription,
      amount: plannedAmount,
      type: transType,
      category: transCategory || 'Outros',
      account: transAccount,
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
        const wasRecurring = !!(editingTransaction.recurringGroup || editingTransaction.installmentGroup);
        const willBeRecurring = isRecurring && (recurrenceMode === 'continuous' || (recurrenceMode === 'installments' && parseInt(installmentsCount) > 1));

        if (willBeRecurring && !wasRecurring) {
          // Converting single to recurring/installments
          const newSeries = createRecurringOrInstallments({ ...payload, uid: user.uid });
          const [first, ...rest] = newSeries;
          
          await firestoreService.updateTransaction(editingTransaction.id.toString(), first);
          for (const t of rest) {
            await firestoreService.addTransaction(t);
          }
        } else if (wasRecurring) {
          // If was recurring, we might need to update future ones
          const groupId = editingTransaction.recurringGroup || editingTransaction.installmentGroup;
          
          // Find all future transactions in this group
          const futureTrans = transactions.filter(t => {
            const isSameGroup = (t.recurringGroup === groupId || t.installmentGroup === groupId);
            const isFuture = new Date(t.date) > new Date(editingTransaction.date);
            return isSameGroup && isFuture;
          });

          if (willBeRecurring) {
            // Check if frequency or mode changed - if so, we definitely need to regenerate future ones
            const hasFrequencyChanged = (editingTransaction.recurringFrequency !== transFrequency);
            const hasRecurrenceModeChanged = ((editingTransaction.recurringGroup && recurrenceMode === 'installments') || (editingTransaction.installmentGroup && recurrenceMode === 'continuous'));
            const hasInstallmentsCountChanged = (editingTransaction.totalInstallments?.toString() !== installmentsCount);

            if (hasFrequencyChanged || hasRecurrenceModeChanged || hasInstallmentsCountChanged) {
              // Frequência ou modo mudou: deletar futuros e regenerar
              for (const t of futureTrans) {
                await firestoreService.deleteTransaction(t.id.toString());
              }
              const newSeries = createRecurringOrInstallments({ ...payload, uid: user.uid });
              const [first, ...rest] = newSeries;
              
              // Mantemos o mesmo ID do grupo para o primeiro (opcional, mas createRecurringOrInstallments gera um novo)
              // Na verdade, createRecurringOrInstallments gera um novo timestamp, o que é ok pois estamos "reiniciando" a série
              await firestoreService.updateTransaction(editingTransaction.id.toString(), first);
              for (const t of rest) {
                await firestoreService.addTransaction(t);
              }
            } else {
              // Apenas campos informativos (descrição, valor, categoria, conta) mudaram
              // Atualizar todos os futuros com os novos dados (exceto a data)
              await firestoreService.updateTransaction(editingTransaction.id.toString(), payload);
              for (const t of futureTrans) {
                const updatedPayload = {
                  ...payload,
                  date: t.date // Preservar a data original do futuro
                };
                await firestoreService.updateTransaction(t.id.toString(), updatedPayload);
              }
            }
          } else {
            // Deixou de ser recorrente: deletar futuros e atualizar o atual como single
            for (const t of futureTrans) {
              await firestoreService.deleteTransaction(t.id.toString());
            }
            // Remover metadados de grupo do payload
            const singlePayload = { ...payload };
            delete singlePayload.recurringGroup;
            delete singlePayload.recurringFrequency;
            delete singlePayload.isRecurringEntry;
            delete singlePayload.installmentGroup;
            delete singlePayload.installmentSequence;
            delete singlePayload.totalInstallments;
            
            await firestoreService.updateTransaction(editingTransaction.id.toString(), singlePayload);
          }
        } else {
          // Standard update (single to single)
          await firestoreService.updateTransaction(editingTransaction.id.toString(), payload);
        }
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
      if (t.totalInstallments) {
        setInstallmentsCount(t.totalInstallments.toString());
      }
    } else if (t.recurringGroup) {
      setRecurrenceMode('continuous');
      if (t.recurringFrequency) {
        setTransFrequency(t.recurringFrequency);
      }
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
    setTransAccount('');
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
      await ensureCategoriesSeeded(); // Keep existing ones as persistent
      const latestCats = await firestoreService.getCategories(user?.uid) as any[];
      const maxOrder = Math.max(0, ...latestCats.map(c => c.sortOrder || 0));
      await firestoreService.addCategory({ name, type: transType, sortOrder: maxOrder + 1 });
      setTransCategory(name);
      setCategorySearch('');
      setShowCategoryDropdown(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const ensureCategoriesSeeded = async () => {
    try {
      const currentPersistent = await firestoreService.getCategories(user?.uid);
      const persistentSet = new Set((currentPersistent as any[]).map(c => `${c.type}-${c.name}`));
      
      // We want to make sure EVERY default category is in Firestore
      const toSeed = DEFAULT_CATEGORIES.filter(def => !persistentSet.has(`${def.type}-${def.name}`));
      
      if (toSeed.length > 0) {
        await Promise.all(toSeed.map(async (c) => {
          try {
            await firestoreService.addCategory({ 
              name: c.name, 
              type: c.type, 
              sortOrder: c.sortOrder || 0 
            });
          } catch (err) {
            console.warn(`Failed to seed cat ${c.name}:`, err);
          }
        }));
      }
    } catch (e) {
      console.error("Error in ensureCategoriesSeeded:", e);
    }
  };

  const handleAddCategoryModal = async (type: 'income' | 'expense') => {
    if (!manualCategoryName.trim()) return;
    try {
      setLoading(true);
      const currentCats = summary?.categories || [];
      const exists = currentCats.some(c => c.name === manualCategoryName && c.type === type);
      if (exists) {
        setErrorMessage("Esta categoria já existe.");
        return;
      }

      await ensureCategoriesSeeded();
      const latestCats = summary?.categories || [];
      const maxOrder = Math.max(0, ...latestCats.map(c => c.sortOrder || 0));
      await firestoreService.addCategory({ name: manualCategoryName, type, sortOrder: maxOrder + 1 });
      setManualCategoryName('');
      setAddingCategoryType(null);
      await fetchData();
    } catch (e) {
      console.error(e);
      setErrorMessage("Erro ao adicionar categoria.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (type: string, oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingCategoryInModal(null);
      return;
    }
    try {
      setLoading(true);
      await ensureCategoriesSeeded();
      
      const updatedCats = await firestoreService.getCategories(user?.uid) as any[];
      const cat = updatedCats.find(c => c.name === oldName && c.type === type);
      
      if (cat && cat.id) {
        await firestoreService.updateCategory(cat.id, { name: newName });
        await fetchData();
      }
      setEditingCategoryInModal(null);
      setNewCategoryNameInModal('');
    } catch (e) {
      console.error(e);
      setErrorMessage("Erro ao atualizar categoria.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = (type: 'income' | 'expense', name: string) => {
    const inUse = transactions.some(t => t.category === name && t.type === type);
    setIsCategoryInUse(inUse);
    setCategoryToDelete({ name, type });
    setShowCategoryDeleteModal(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const { type, name } = categoryToDelete;
    
    try {
      setLoading(true);
      setShowCategoryDeleteModal(false);
      
      const currentPersistent = await firestoreService.getCategories(user?.uid) as any[];
      const cat = currentPersistent.find(c => c.name === name && c.type === type);
      
      if (cat && cat.id) {
        await firestoreService.deleteCategory(cat.id);
      } else {
        await ensureCategoriesSeeded();
        const updatedCats = await firestoreService.getCategories(user?.uid) as any[];
        const persistentCat = updatedCats.find(c => c.name === name && c.type === type);
        if (persistentCat && persistentCat.id) {
          await firestoreService.deleteCategory(persistentCat.id);
        }
      }
      await fetchData();
      setCategoryToDelete(null);
    } catch (e) {
      console.error(e);
      setErrorMessage("Erro ao excluir categoria.");
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result: DropResult, type: 'income' | 'expense') => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    if (source.index === destination.index) return;

    // Optimistic Update
    if (!summary) return;
    const currentCatsOfType = summary.categories.filter(c => c.type === type);
    const otherCats = summary.categories.filter(c => c.type !== type);
    
    const updatedOfType = Array.from(currentCatsOfType);
    const [removed] = updatedOfType.splice(source.index, 1);
    updatedOfType.splice(destination.index, 0, removed);
    
    // Update local state immediately for snappy feel
    const newSummary = {
      ...summary,
      categories: [...otherCats, ...updatedOfType].sort((a, b) => {
        // We need to maintain some sort of relative order between types if we want consistency,
        // but here we just want the UI to feel fast.
        // Actually, just update the filtered list is enough for the modal view.
        return 0; // The categories in summary are usually sorted by sortOrder in fetchData
      })
    };
    
    // Specifically for the modal display, we just need the filtered list to be correct
    setSummary(newSummary);

    try {
      // Reorder in background
      const refreshedPersistent = await firestoreService.getCategories(user?.uid) as any[];
      const persistentOfType = refreshedPersistent
        .filter(c => c.type === type)
        .sort((a: any, b: any) => {
          const indexA = updatedOfType.findIndex(o => (o as any).name === a.name);
          const indexB = updatedOfType.findIndex(o => (o as any).name === b.name);
          return indexA - indexB;
        });

      const batchItems = persistentOfType.map((cat, index) => ({
        id: cat.id,
        data: { sortOrder: index }
      }));

      if (batchItems.length > 0) {
        await firestoreService.batchUpdateCategories(batchItems);
      }
    } catch (e) {
      console.error("Reorder failed:", e);
      // Rollback if needed, but usually not worth the complexity unless it fails often
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
        setSuccessMessage("Lançamento concluído com sucesso!");
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
        setSuccessMessage("Lançamento concluído!");
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
      setSuccessMessage("Lançamento concluído (valor parcial).");
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
      
      // Quando o valor de pagamentos é igual ou superior ao valor planejado, o sistema automaticamente faz a quitação
      const shouldBeSettled = totalPaid >= settlingTransaction.amount;
      
      await firestoreService.updateTransaction(settlingTransaction.id.toString(), {
        settled: shouldBeSettled,
        payments: updatedPayments
      });
      setShowSettleModal(false);
      setSettlingTransaction(null);
      fetchData();
      setSuccessMessage(shouldBeSettled ? "Lançamento quitado com sucesso!" : "Pagamento adicionado!");
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
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {(successMessage || errorMessage) && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6"
          >
            <div className={`p-4 rounded-3xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${successMessage ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-rose-500/90 border-rose-400 text-white'}`}>
              {successMessage ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="font-bold text-sm tracking-tight">{successMessage || errorMessage}</p>
              <button 
                onClick={() => { setSuccessMessage(null); setErrorMessage(null); }}
                className="ml-auto p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar / Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-black/5 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-8">
        <button onClick={() => setActiveTab('dashboard')} title="Painel de Controle" className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activeTab === 'dashboard' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}>
          <LayoutDashboard size={20} />
        </button>
        <button onClick={() => setActiveTab('transactions')} title="Lançamentos e Extrato" className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activeTab === 'transactions' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}>
          <BarChart3 size={20} />
        </button>
        <button onClick={() => setActiveTab('cards')} title="Contas e Cartões" className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${activeTab === 'cards' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}>
          <CreditCard size={20} />
        </button>
        <div className="h-4 w-px bg-black/5 mx-2" />
        <div className="flex flex-col items-center">
          <p className="text-[8px] font-black text-stone-300 uppercase tracking-tighter">Conta</p>
          <p className="text-[10px] font-bold text-stone-500 max-w-[100px] truncate" title={user?.email || ''}>
            {user?.email?.split('@')[0]}
          </p>
        </div>
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
              title={isSearchOpen ? "Fechar Busca" : "Abrir Pesquisa"}
              className={`p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 ${isSearchOpen ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white border-black/5 text-stone-500 hover:bg-stone-50 shadow-sm'}`}
            >
              <Search size={20} />
            </button>
          </div>
          <button title="Notificações" className="p-3 bg-white rounded-2xl border border-black/5 shadow-sm hover:bg-stone-50 hover:scale-110 hover:shadow-md active:scale-95 transition-all relative">
            <Bell size={20} className="text-stone-500" />
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-32">
        {/* Global Connection/Config Error */}
        {(connectionError || errorMessage) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-50 border border-red-200 rounded-3xl flex items-center gap-3 text-red-800"
          >
            <AlertCircle size={20} className="shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-bold">Erro de Configuração</p>
              <p className="text-xs opacity-90">{connectionError || errorMessage}</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Orphaned Transactions Alert */}
              {orphanedTransactions.length > 0 && (
                <div className="lg:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center gap-3 text-amber-800">
                  <AlertCircle size={20} className="shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold">Aviso: Lançamentos sem conta</p>
                    <p className="text-[11px] opacity-80">
                      Identificamos {orphanedTransactions.length} lançamentos vinculados a nomes de conta que não existem ou foram renomeados. 
                      Isso pode afetar o cálculo dos saldos. Edite-os na aba de Lançamentos.
                    </p>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('transactions'); setFilterText('órfão'); }}
                    className="ml-auto px-4 py-2 bg-amber-200/50 hover:bg-amber-200 rounded-xl text-xs font-bold transition-all"
                  >
                    Ver Lançamentos
                  </button>
                </div>
              )}

              {/* Main Stats */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Saldo Total" 
          value={summary?.balance || 0} 
          realizedValue={summary?.realizedBalance}
          icon={Wallet} 
          color="bg-stone-900" 
          tooltip="Seu saldo total planejado (Soma de contas + limite de cartões + receitas - despesas)"
        />
        <StatCard 
          title="Receitas" 
          value={summary?.income || 0} 
          realizedValue={summary?.realizedIncome}
          icon={ArrowUpRight} 
          color="bg-emerald-500" 
          tooltip="Total de receitas previstas para o período selecionado"
        />
        <StatCard 
          title="Despesas" 
          value={summary?.expense || 0} 
          realizedValue={summary?.realizedExpense}
          icon={ArrowDownLeft} 
          color="bg-rose-500" 
          tooltip="Total de despesas previstas para o período selecionado"
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
                          <div className={`p-1 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-stone-100 bg-white shadow-sm overflow-hidden ${t.settled ? 'opacity-50' : ''}`}>
                            {(() => {
                              const card = cards.find(c => c.name === t.account);
                              if (card) {
                                const domain = card.type === 'bank' 
                                  ? (card.bankLogo || getAutoLogo(card.name))
                                  : (CARD_BRANDS.find(b => b.id === card.brand)?.logo || card.bankLogo || getAutoLogo(card.name));
                                  
                                if (domain) {
                                  return (
                                    <img 
                                      src={getCardLogoUrl(domain)} 
                                      alt="" 
                                      className="w-6 h-6 object-contain" 
                                      referrerPolicy="no-referrer" 
                                      onError={(e) => handleLogoError(e, domain)}
                                    />
                                  );
                                }
                              }
                              return t.type === 'income' ? <ArrowUpRight size={20} className="text-emerald-600" /> : <ArrowDownLeft size={20} className="text-rose-600" />;
                            })()}
                          </div>
                          <div>
                            <p className={`font-medium ${t.settled ? 'line-through text-stone-400' : ''}`}>{t.description}</p>
                            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">
                              <span className="text-stone-300">{t.category}</span>
                              <span className="mx-1 text-stone-200">/</span>
                              <span className="text-stone-500">{t.account}</span>
                            </p>
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
                    {computedCards.filter(c => c.type === 'bank').map((acc: any) => (
                      <div key={acc.id} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white border border-stone-100 rounded-xl flex items-center justify-center shadow-sm overflow-hidden transition-transform group-hover:scale-110">
                              {(() => {
                                const domain = acc.bankLogo || acc.logo || getAutoLogo(acc.name);
                                  
                                if (domain) {
                                  return (
                                    <img 
                                      src={getCardLogoUrl(domain)} 
                                      alt="" 
                                      className="w-6 h-6 object-contain" 
                                      referrerPolicy="no-referrer" 
                                      onError={(e) => handleLogoError(e, domain)}
                                    />
                                  );
                                }
                                return <Wallet size={18} className="text-stone-300" />;
                              })()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-800">{acc.name}</p>
                              <p className="text-[9px] text-stone-400 uppercase tracking-[0.1em] font-bold">Conta Corrente</p>
                            </div>
                          </div>
                          <p className="font-bold text-sm text-stone-900 tracking-tight" title="Saldo Atual">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.used)}
                          </p>
                        </div>
                        <div className="mt-2 w-full bg-emerald-500/10 h-1 rounded-full overflow-hidden border border-emerald-500/20" title="Uso do Saldo">
                          <div 
                            className="h-full bg-rose-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" 
                            style={{ width: `${Math.max(0, Math.min(100 - (acc.used / (acc.limit || 1)) * 100, 100))}%` }} 
                          />
                        </div>
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
              className="space-y-12"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold tracking-tight">Cartões e Contas</h2>
                <button 
                  onClick={() => setShowNewCardForm(true)}
                  className="bg-stone-900 text-white px-6 py-2 rounded-2xl text-sm font-medium hover:bg-stone-800 transition-all hover:scale-105 hover:shadow-xl hover:shadow-stone-200 active:scale-95 flex items-center gap-2 group"
                >
                  <PlusCircle size={18} className="group-hover:rotate-90 transition-transform" />
                  Novo
                </button>
              </div>

              <AnimatePresence>
                {showNewCardForm && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => { setShowNewCardForm(false); resetCardForm(); }}
                      className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative w-full max-w-md"
                    >
                      <Card className="shadow-2xl border-stone-200">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-bold tracking-tight">{editingCard ? 'Editar' : 'Adicionar Novo'}</h3>
                          <button onClick={() => { setShowNewCardForm(false); resetCardForm(); }} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                            <X size={20} className="text-stone-400" />
                          </button>
                        </div>
                        <form onSubmit={handleSaveCard} className="space-y-4">
                          <div className="grid grid-cols-2 gap-2 p-1.5 bg-stone-100 rounded-2xl mb-4">
                            <button
                              type="button"
                              onClick={() => setNewCardType('credit')}
                              className={`py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${newCardType === 'credit' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
                            >
                              Cartão de Crédito
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewCardType('bank')}
                              className={`py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${newCardType === 'bank' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
                            >
                              Conta Bancária
                            </button>
                          </div>

                          <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                            <div>
                              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Nome Identificador</label>
                              <input 
                                type="text" 
                                value={newCardName}
                                onChange={(e) => setNewCardName(e.target.value)}
                                placeholder={newCardType === 'credit' ? "Ex: Nubank Ultravioleta" : "Ex: Itaú Personalité"}
                                className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 ring-stone-900/5 font-medium"
                                required
                              />
                            </div>

                            {newCardType === 'credit' && (
                              <div className="relative group/brand-dropdown">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Bandeira</label>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const el = document.getElementById('brand-dropdown-list');
                                      if (el) el.classList.toggle('hidden');
                                    }}
                                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 ring-stone-900/5 text-left flex items-center justify-between group"
                                  >
                                    <div className="flex items-center gap-3">
                                      {(() => {
                                        const brand = CARD_BRANDS.find(b => b.id === newCardBrand);
                                        if (brand?.logo) {
                                          return (
                                            <img 
                                              src={getCardLogoUrl(brand.logo)} 
                                              alt="" 
                                              className="w-5 h-6 object-contain"
                                              referrerPolicy="no-referrer"
                                              onError={(e) => handleLogoError(e, brand.logo)}
                                            />
                                          );
                                        }
                                        return (
                                          <div className="w-5 h-5 bg-stone-200 rounded flex items-center justify-center text-stone-500">
                                            <CreditCard size={12} />
                                          </div>
                                        );
                                      })()}
                                      <span className="text-sm font-medium text-stone-900">
                                        {CARD_BRANDS.find(b => b.id === newCardBrand)?.name || 'Selecionar Bandeira'}
                                      </span>
                                    </div>
                                    <ChevronDown size={16} className="text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                                  </button>

                                  <div 
                                    id="brand-dropdown-list"
                                    className="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                                  >
                                    <div className="p-3 border-b border-stone-100">
                                      <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input 
                                          type="text"
                                          value={bankSearch}
                                          onChange={(e) => setBankSearch(e.target.value)}
                                          placeholder="Pesquisar bandeira..."
                                          className="w-full bg-stone-50/50 border border-stone-100 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:ring-2 ring-stone-900/5"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                      {CARD_BRANDS
                                        .filter(brand => brand.name.toLowerCase().includes(bankSearch.toLowerCase()))
                                        .map(brand => (
                                        <button
                                          key={brand.id}
                                          type="button"
                                          onClick={() => {
                                            setNewCardBrand(brand.id);
                                            document.getElementById('brand-dropdown-list')?.classList.add('hidden');
                                          }}
                                          className={`w-full p-2.5 flex items-center gap-3 transition-all hover:bg-stone-50 ${newCardBrand === brand.id ? 'bg-stone-50/80' : ''}`}
                                        >
                                          <div className="w-6 h-6 flex items-center justify-center bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden shrink-0">
                                            {brand.logo ? (
                                              <img 
                                                src={getCardLogoUrl(brand.logo)} 
                                                alt={brand.name} 
                                                className="w-4 h-4 object-contain" 
                                                referrerPolicy="no-referrer"
                                                onError={(e) => handleLogoError(e, brand.logo)}
                                              />
                                            ) : (
                                              <CreditCard size={12} className="text-stone-400" />
                                            )}
                                          </div>
                                          <span className="text-xs font-medium text-stone-700">{brand.name}</span>
                                          {newCardBrand === brand.id && (
                                            <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {newCardType === 'bank' && (
                              <div className="relative group/dropdown">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Banco</label>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const el = document.getElementById('bank-dropdown-list');
                                      if (el) el.classList.toggle('hidden');
                                      setBankSearch('');
                                    }}
                                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 ring-stone-900/5 text-left flex items-center justify-between group"
                                  >
                                    <div className="flex items-center gap-3">
                                      {(() => {
                                        const bank = BRAZILIAN_BANKS.find(b => b.id === newCardBank);
                                        if (bank?.logo) {
                                          return (
                                            <img 
                                              src={getCardLogoUrl(bank.logo)} 
                                              alt="" 
                                              className="w-5 h-5 object-contain"
                                              referrerPolicy="no-referrer"
                                              onError={(e) => handleLogoError(e, bank.logo)}
                                            />
                                          );
                                        }
                                        return (
                                          <div className="w-5 h-5 bg-stone-200 rounded flex items-center justify-center text-stone-500">
                                            <Wallet size={12} />
                                          </div>
                                        );
                                      })()}
                                      <span className="text-sm font-medium text-stone-900">
                                        {BRAZILIAN_BANKS.find(b => b.id === newCardBank)?.name || 'Selecionar Banco'}
                                      </span>
                                    </div>
                                    <ChevronDown size={16} className="text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                                  </button>

                                  <div 
                                    id="bank-dropdown-list"
                                    className="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                                  >
                                    <div className="p-3 border-b border-stone-100">
                                      <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input 
                                          type="text" 
                                          value={bankSearch}
                                          onChange={(e) => setBankSearch(e.target.value)}
                                          placeholder="Pesquisar banco..."
                                          className="w-full bg-stone-50/50 border border-stone-100 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:ring-2 ring-stone-900/5"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                      {BRAZILIAN_BANKS
                                        .filter(bank => bank.name.toLowerCase().includes(bankSearch.toLowerCase()))
                                        .map(bank => (
                                          <button
                                            key={bank.id}
                                            type="button"
                                            onClick={() => {
                                              setNewCardBank(bank.id);
                                              document.getElementById('bank-dropdown-list')?.classList.add('hidden');
                                              setBankSearch('');
                                            }}
                                            className={`w-full p-2.5 flex items-center gap-3 transition-all hover:bg-stone-50 ${newCardBank === bank.id ? 'bg-stone-50/80' : ''}`}
                                          >
                                            <div className="w-6 h-6 flex items-center justify-center bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden shrink-0">
                                              {bank.logo ? (
                                                <img 
                                                  src={getCardLogoUrl(bank.logo)} 
                                                  alt={bank.name} 
                                                  className="w-4 h-4 object-contain" 
                                                  referrerPolicy="no-referrer"
                                                  onError={(e) => handleLogoError(e, bank.logo)}
                                                />
                                              ) : (
                                                <Wallet size={12} className="text-stone-400" />
                                              )}
                                            </div>
                                            <span className="text-xs font-medium text-stone-700">{bank.name}</span>
                                            {newCardBank === bank.id && (
                                              <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                            )}
                                          </button>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">
                                {newCardType === 'credit' ? 'Limite Total' : 'Saldo Atual'}
                              </label>
                              <input 
                                type="text" 
                                value={newCardLimit}
                                onChange={(e) => setNewCardLimit(maskCurrency(e.target.value))}
                                placeholder="0,00"
                                className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 ring-stone-900/5 text-right font-black text-lg"
                                required
                              />
                            </div>
                            
                            {newCardType === 'bank' && (
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Limite (Cheque Especial)</label>
                                <input 
                                  type="text" 
                                  value={newCardOverdraft}
                                  onChange={(e) => setNewCardOverdraft(maskCurrency(e.target.value))}
                                  placeholder="0,00"
                                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 ring-stone-900/5 text-right font-bold text-stone-600"
                                />
                              </div>
                            )}
                            
                            {newCardType === 'credit' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Fechamento (Dia)</label>
                                  <input 
                                    type="number" 
                                    value={newCardClosing}
                                    onChange={(e) => setNewCardClosing(e.target.value)}
                                    placeholder="Ex: 25"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 ring-stone-900/5 font-medium"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Vencimento (Dia)</label>
                                  <input 
                                    type="number" 
                                    value={newCardDue}
                                    onChange={(e) => setNewCardDue(e.target.value)}
                                    placeholder="Ex: 01"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 ring-stone-900/5 font-medium"
                                    required
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-3 pt-6 border-t border-stone-100">
                            <button 
                              type="button" 
                              onClick={() => { setShowNewCardForm(false); resetCardForm(); }}
                              className="flex-1 px-6 py-3 border border-stone-200 rounded-2xl text-sm font-bold text-stone-500 hover:bg-stone-50 transition-all active:scale-95"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="submit" 
                              disabled={isSubmitting}
                              className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-2xl text-sm font-bold hover:shadow-xl hover:shadow-stone-200/50 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                              {isSubmitting ? 'Salvando...' : (editingCard ? 'Atualizar' : 'Salvar')}
                            </button>
                          </div>
                        </form>
                      </Card>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Contas Correntes */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Contas Correntes</h3>
                  <div className="h-px flex-1 bg-stone-100" />
                  <span className="text-[10px] font-black text-stone-400 bg-stone-50 px-2.5 py-1 rounded-full border border-stone-100">
                    {computedCards.filter(c => c.type === 'bank').length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {computedCards.filter(c => c.type === 'bank').map((card) => (
                    <motion.div 
                      layout
                      key={card.id} 
                      className="group bg-white rounded-3xl border border-stone-100 p-5 hover:shadow-xl hover:shadow-stone-200/50 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center border border-stone-100 shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                            {(() => {
                              const logoDomain = card.bankLogo || getAutoLogo(card.name) || '';
                              if (logoDomain) {
                                return (
                                  <img 
                                    src={getCardLogoUrl(logoDomain)} 
                                    alt="" 
                                    className="w-7 h-7 object-contain" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleLogoError(e, logoDomain)}
                                  />
                                );
                              }
                              return <Wallet size={18} className="text-stone-300" />;
                            })()}
                          </div>
                          <div>
                            <h4 className="font-bold text-stone-900 truncate max-w-[140px] text-sm">{card.name}</h4>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Saldo Disponível</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditCardClick(card)} className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-lg"><Edit2 size={12} /></button>
                          <button onClick={() => confirmDeleteCard(card)} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xl font-black text-stone-900 tracking-tighter">
                          <span className="text-xs font-medium mr-1 text-stone-400">R$</span>
                          {card.used.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="mt-3 w-full bg-emerald-500/20 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.max(0, Math.min(100 - (card.used / (card.limit || 1)) * 100, 100))}%` }} 
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Cartões de Crédito */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Cartões de Crédito</h3>
                  <div className="h-px flex-1 bg-stone-100" />
                  <span className="text-[10px] font-black text-stone-400 bg-stone-50 px-2.5 py-1 rounded-full border border-stone-100">
                    {computedCards.filter(c => c.type === 'credit').length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {computedCards.filter(c => c.type === 'credit').map((card) => (
                    <motion.div 
                      layout
                      key={card.id} 
                      className="group bg-white rounded-3xl border border-stone-100 p-5 hover:shadow-xl hover:shadow-stone-200/50 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center border border-stone-100 shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                            {(() => {
                              const logoDomain = CARD_BRANDS.find(b => b.id === card.brand)?.logo || card.bankLogo || getAutoLogo(card.name) || '';
                              if (logoDomain) {
                                return (
                                  <img 
                                    src={getCardLogoUrl(logoDomain)} 
                                    alt="" 
                                    className="w-7 h-7 object-contain" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleLogoError(e, logoDomain)}
                                  />
                                );
                              }
                              return <CreditCard size={18} className="text-stone-300" />;
                            })()}
                          </div>
                          <div>
                            <h4 className="font-bold text-stone-900 truncate max-w-[140px] text-sm">{card.name}</h4>
                            <div className="flex gap-2">
                              <span className="text-[8px] font-black text-stone-400 bg-stone-100 px-1 py-0.5 rounded uppercase">F. {card.closingDate}</span>
                              <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-1 py-0.5 rounded uppercase font-bold">V. {card.dueDate}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditCardClick(card)} className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-lg"><Edit2 size={12} /></button>
                          <button onClick={() => confirmDeleteCard(card)} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={12} /></button>
                        </div>
                      </div>
                <div className="flex flex-col">
                  <div className="flex justify-between items-end">
                    <p className="text-xl font-black text-stone-900 tracking-tighter" title={`Limite Disponível: R$ ${card.used.toLocaleString('pt-BR')}`}>
                      <span className="text-xs font-medium mr-1 text-stone-400">R$</span>
                      {card.used.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Limite Disponível</p>
                  </div>
                  <div className="mt-3 w-full bg-emerald-500/10 h-1.5 rounded-full overflow-hidden border border-emerald-500/20" title="Uso do Limite">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" 
                      style={{ width: `${Math.max(0, Math.min(100 - (card.used / (card.limit || 1)) * 100, 100))}%` }} 
                    />
                  </div>
                </div>
                    </motion.div>
                  ))}
                </div>
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

              <div className="space-y-6 flex-1 w-full">
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
                              <optgroup label="Contas Correntes">
                                {cards.filter(c => c.type === 'bank').map(acc => (
                                  <option key={acc.id} value={acc.name}>{acc.name}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Cartões de Crédito">
                                {cards.filter(c => c.type === 'credit').map(card => (
                                  <option key={card.id} value={card.name}>{card.name}</option>
                                ))}
                              </optgroup>
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
                                <option key={`${cat.type}-${cat.name}`} value={cat.name}>{cat.name} ({cat.type === 'income' ? 'Rec' : 'Desp'})</option>
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
                            <th className="pb-4 px-4 w-10">
                              <button 
                                onClick={() => handleSelectAll(filteredTransactions.map(t => t.id.toString()))}
                                className={`p-2 rounded-lg transition-all ${filteredTransactions.length > 0 && filteredTransactions.every(t => selectedTransactions.includes(t.id.toString())) ? 'text-stone-900 bg-stone-100' : 'text-stone-300 hover:text-stone-900 hover:bg-stone-50'}`}
                              >
                                {filteredTransactions.length > 0 && filteredTransactions.every(t => selectedTransactions.includes(t.id.toString())) ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                            </th>
                            <th className="pb-4 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 group cursor-pointer hover:text-stone-900 transition-colors" onClick={() => handleSort('date')}>
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
                              <tr key={t.id} className={`group hover:bg-stone-50 transition-all duration-300 ${t.settled ? 'opacity-40 grayscale-[0.2]' : ''} ${selectedTransactions.includes(t.id.toString()) ? 'bg-emerald-50/30' : ''}`}>
                                <td className="py-4 px-4">
                                  <button 
                                    onClick={() => handleToggleSelect(t.id.toString())}
                                    className={`p-2 rounded-lg transition-all ${selectedTransactions.includes(t.id.toString()) ? 'text-emerald-600 bg-emerald-100' : 'text-stone-300 hover:text-stone-600 hover:bg-stone-100 opacity-0 group-hover:opacity-100'}`}
                                  >
                                    {selectedTransactions.includes(t.id.toString()) ? <CheckSquare size={16} /> : <Square size={16} />}
                                  </button>
                                </td>
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
                                          title="Concluir"
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
                              <td colSpan={6} className="py-12 text-center">
                                <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">Nenhum lançamento para este período</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
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
                className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/5"
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
                
                <div className="p-8 max-h-[70vh] overflow-y-auto space-y-10 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
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
                      <DragDropContext onDragEnd={(res) => onDragEnd(res, 'expense')}>
                        <Droppable droppableId="expense-categories">
                          {(provided) => (
                            <div 
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className="space-y-1"
                            >
                              {summary?.categories.filter(c => c.type === 'expense').map((c, index) => {
                                const DraggableAny = Draggable as any;
                                return (
                                  <DraggableAny key={`${c.type}-${c.name}`} draggableId={`${c.type}-${c.name}`} index={index}>
                                    {(provided: any, snapshot: any) => (
                                      <div 
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`flex items-center justify-between group p-3 rounded-2xl transition-all ${snapshot.isDragging ? 'bg-white shadow-xl ring-1 ring-black/5 z-50' : 'hover:bg-stone-50'}`}
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div className="text-stone-300 group-hover:text-stone-500 transition-colors cursor-grab p-1">
                                            <GripVertical size={14} />
                                          </div>
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
                                        </div>
                                        <div className="flex gap-1 items-center ml-2">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingCategoryInModal({ name: c.name, type: 'expense' });
                                              setNewCategoryNameInModal(c.name);
                                            }}
                                            className="p-2 hover:bg-stone-100 rounded-xl text-stone-500 hover:text-stone-900 transition-all font-medium flex items-center justify-center"
                                            title="Editar"
                                          >
                                            <Edit2 size={16} />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteCategory('expense', c.name);
                                            }}
                                            className="p-2 hover:bg-rose-100 rounded-xl text-rose-500 hover:text-rose-600 transition-all font-medium flex items-center justify-center"
                                            title="Excluir"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </DraggableAny>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
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
                        <DragDropContext onDragEnd={(res) => onDragEnd(res, 'income')}>
                          <Droppable droppableId="income-categories">
                            {(provided) => (
                              <div 
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-1"
                              >
                                {summary?.categories.filter(c => c.type === 'income').map((c, index) => {
                                  const DraggableAny = Draggable as any;
                                  return (
                                    <DraggableAny key={`${c.type}-${c.name}`} draggableId={`${c.type}-${c.name}`} index={index}>
                                      {(provided: any, snapshot: any) => (
                                        <div 
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`flex items-center justify-between group p-3 rounded-2xl transition-all ${snapshot.isDragging ? 'bg-white shadow-xl ring-1 ring-black/5 z-50' : 'hover:bg-stone-50'}`}
                                        >
                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="text-stone-300 group-hover:text-stone-500 transition-colors cursor-grab p-1">
                                              <GripVertical size={14} />
                                            </div>
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
                                          </div>
                                          <div className="flex gap-1 items-center ml-2">
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingCategoryInModal({ name: c.name, type: 'income' });
                                                setNewCategoryNameInModal(c.name);
                                              }}
                                              className="p-2 hover:bg-stone-100 rounded-xl text-stone-500 hover:text-stone-900 transition-all font-medium flex items-center justify-center"
                                              title="Editar"
                                            >
                                              <Edit2 size={16} />
                                            </button>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCategory('income', c.name);
                                              }}
                                              className="p-2 hover:bg-rose-100 rounded-xl text-rose-500 hover:text-rose-600 transition-all font-medium flex items-center justify-center"
                                              title="Excluir"
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </DraggableAny>
                                  );
                                })}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
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
                      Concluir assim mesmo
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

          {showNewTransactionForm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto"
              onClick={(e) => e.target === e.currentTarget && resetTransForm()}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-black/5 relative my-auto"
              >
                <div className="p-8 sm:p-10">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-stone-900 tracking-tight">
                        {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
                      </h3>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">Gestão de Fluxo de Caixa</p>
                    </div>
                    <button onClick={resetTransForm} className="p-2 hover:bg-stone-50 rounded-xl transition-all text-stone-400 hover:text-stone-900">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <form onSubmit={handleCreateTransaction} className="space-y-6">
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

                    <div className="flex p-1 bg-stone-100 rounded-xl max-w-xs">
                      <button 
                        type="button" 
                        onClick={() => {
                          setTransType('expense');
                          setTransCategory('');
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${transType === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-stone-400'}`}
                      >
                        Despesa
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setTransType('income');
                          setTransCategory('');
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${transType === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-400'}`}
                      >
                        Receita
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                      <div className="md:col-span-2 lg:col-span-4">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Descrição</label>
                        <input 
                          type="text" 
                          value={transDescription}
                          onChange={(e) => setTransDescription(e.target.value)}
                          placeholder="Ex: Almoço, Salário..."
                          className="w-full bg-transparent border-none rounded-none py-1.5 px-0 outline-none focus:ring-0 placeholder:text-stone-300 text-lg font-semibold text-stone-900 border-b border-stone-100 focus:border-stone-400 transition-all"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Valor</label>
                        <input 
                          type="text" 
                          value={transAmount}
                          onChange={(e) => setTransAmount(maskCurrency(e.target.value))}
                          placeholder="0,00"
                          className={`w-full bg-transparent border-none rounded-none py-1.5 px-0 outline-none focus:ring-0 placeholder:text-stone-300 text-lg font-bold border-b border-stone-100 focus:border-stone-400 transition-all ${transType === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Data</label>
                        <input 
                          type="date" 
                          value={transDate}
                          onChange={(e) => setTransDate(e.target.value)}
                          className="w-full bg-transparent border-none rounded-none py-1 px-0 outline-none focus:ring-0 text-stone-600 font-semibold border-b border-stone-100 focus:border-stone-400 transition-all text-sm"
                          required
                        />
                      </div>

                      <div className="relative space-y-1 md:col-span-2 lg:col-span-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Categoria</label>
                        <div 
                          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                          className="w-full py-1 cursor-pointer flex justify-between items-center border-b border-stone-100 hover:border-stone-300 transition-all"
                        >
                          <span className={`font-semibold text-sm ${transCategory ? 'text-stone-900' : 'text-stone-300'}`}>
                            {transCategory || 'Selecionar...'}
                          </span>
                        </div>
                        
                        <AnimatePresence>
                          {showCategoryDropdown && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute z-[120] left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-black/5 p-4 space-y-4 min-w-[280px]"
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
                              <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                                  {summary?.categories
                                    .filter(c => c.type === transType && c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                    .map(c => (
                                      <button 
                                        key={`${c.type}-${c.name}`}
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
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="relative space-y-1 md:col-span-2 lg:col-span-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Conta/Cartão</label>
                        <button 
                          type="button"
                          onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                          className="w-full flex items-center justify-between py-1 text-stone-600 font-semibold border-b border-stone-100 hover:border-stone-300 transition-all group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {transAccount && (
                              <div className="text-stone-400">
                                {(() => {
                                  const card = computedCards.find(c => c.name === transAccount);
                                  if (!card) return <Landmark size={14} />;
                                  const logoDomain = card.type === 'credit' 
                                    ? (CARD_BRANDS.find(b => b.id === card.brand)?.logo || card.bankLogo || getAutoLogo(card.name) || '')
                                    : (card.bankLogo || getAutoLogo(card.name) || '');
                                  
                                  if (logoDomain) {
                                    return (
                                      <img 
                                        src={getCardLogoUrl(logoDomain)} 
                                        alt="" 
                                        className="w-4 h-4 object-contain"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => handleLogoError(e, logoDomain)}
                                      />
                                    );
                                  }
                                  return card.type === 'credit' ? <CreditCard size={14} /> : <Landmark size={14} />;
                                })()}
                              </div>
                            )}
                            <span className={`truncate text-sm ${!transAccount ? 'text-stone-400 font-normal italic' : ''}`}>
                              {transAccount || 'Selecionar...'}
                            </span>
                          </div>
                          <ChevronDown size={14} className={`text-stone-300 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {showAccountDropdown && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute z-[120] left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-black/5 p-4 space-y-4 min-w-[280px]"
                            >
                              <div className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2">
                                <Search size={14} className="text-stone-400" />
                                <input 
                                  type="text" 
                                  value={accountSearch}
                                  onChange={(e) => setAccountSearch(e.target.value)}
                                  placeholder="Pesquisar..."
                                  className="bg-transparent border-none outline-none text-sm w-full"
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-60 overflow-y-auto space-y-6 custom-scrollbar pr-1">
                                {['bank', 'credit'].map((groupType) => {
                                  const filtered = computedCards.filter(c => 
                                    (c.type === groupType || (!c.type && groupType === 'bank')) && 
                                    c.name.toLowerCase().includes(accountSearch.toLowerCase())
                                  );
                                  
                                  if (filtered.length === 0) return null;

                                  return (
                                    <div key={groupType} className="space-y-3">
                                      <div className="flex items-center gap-3 px-3 py-1 bg-stone-50 rounded-lg">
                                        <p className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] whitespace-nowrap">
                                          {groupType === 'bank' ? 'Contas Bancárias' : 'Cartões de Crédito'}
                                        </p>
                                        <div className="h-px flex-1 bg-stone-200/50"></div>
                                      </div>
                                      <div className="space-y-1">
                                        {filtered.map(acc => (
                                          <button 
                                            key={acc.id}
                                            type="button"
                                            onClick={() => {
                                              setTransAccount(acc.name);
                                              setShowAccountDropdown(false);
                                              setAccountSearch('');
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-stone-50 transition-all text-left group/acc"
                                          >
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-stone-100 shadow-sm group-hover/acc:scale-110 transition-transform overflow-hidden">
                                              {(() => {
                                                const logoDomain = acc.type === 'credit' 
                                                  ? (CARD_BRANDS.find(b => b.id === acc.brand)?.logo || acc.bankLogo || getAutoLogo(acc.name) || '')
                                                  : (acc.bankLogo || getAutoLogo(acc.name) || '');
                                                
                                                if (logoDomain) {
                                                  return (
                                                    <img 
                                                      src={getCardLogoUrl(logoDomain)} 
                                                      alt="" 
                                                      className="w-6 h-6 object-contain"
                                                      referrerPolicy="no-referrer"
                                                      onError={(e) => handleLogoError(e, logoDomain)}
                                                    />
                                                  );
                                                }
                                                return acc.type === 'credit' ? <CreditCard size={18} className="text-stone-400" /> : <Landmark size={18} className="text-stone-400" />;
                                              })()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-bold text-stone-900 leading-tight truncate">{acc.name}</p>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-4 border-t border-stone-50">
                      <button 
                        type="button" 
                        onClick={() => {
                          const nextValue = !showRealizedFields;
                          setShowRealizedFields(nextValue);
                          if (nextValue && transPayments.length === 0) {
                            setTransPayments([{ amount: transAmount, date: new Date().toISOString().split('T')[0] }]);
                          }
                        }}
                        className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full border transition-all ${showRealizedFields ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-transparent border-stone-200 text-stone-400 hover:text-stone-600'}`}
                      >
                        <CheckCircle2 size={12} />
                        Pagamento realizado
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setIsRecurring(!isRecurring)}
                        className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full border transition-all ${isRecurring ? 'bg-stone-900 border-stone-900 text-white shadow-lg shadow-stone-200' : 'bg-transparent border-stone-200 text-stone-400 hover:text-stone-600'}`}
                      >
                        <Repeat size={12} />
                        Lançamento Recorrente
                      </button>
                    </div>

                    <AnimatePresence>
                      {(showRealizedFields || isRecurring) && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden bg-stone-50/50 rounded-3xl border border-stone-100 p-6 space-y-6"
                        >
                          {showRealizedFields && (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-600">Pagamentos Realizados</p>
                                <button 
                                  type="button"
                                  onClick={() => setTransPayments([...transPayments, { amount: '', date: new Date().toISOString().split('T')[0] }])}
                                  className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                                >
                                  <Plus size={10} />
                                  Adicionar Pagamento
                                </button>
                              </div>
                              <div className="space-y-3">
                                {transPayments.map((payment, index) => (
                                  <div key={index} className="grid grid-cols-2 gap-4 relative group/payment p-3 bg-white rounded-2xl border border-stone-100 shadow-sm transition-all hover:border-emerald-100">
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-bold text-stone-400 uppercase">Valor Pago</label>
                                      <input 
                                        type="text" 
                                        value={payment.amount}
                                        onChange={(e) => {
                                          const newPayments = [...transPayments];
                                          newPayments[index].amount = maskCurrency(e.target.value);
                                          setTransPayments(newPayments);
                                        }}
                                        placeholder="0,00"
                                        className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-bold text-stone-400 uppercase">Data Pagto</label>
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="date" 
                                          value={payment.date}
                                          onChange={(e) => {
                                            const newPayments = [...transPayments];
                                            newPayments[index].date = e.target.value;
                                            setTransPayments(newPayments);
                                          }}
                                          className="flex-1 bg-transparent border-none p-0 text-sm font-semibold focus:ring-0"
                                        />
                                        {transPayments.length > 1 && (
                                          <button 
                                            type="button"
                                            onClick={() => setTransPayments(transPayments.filter((_, i) => i !== index))}
                                            className="text-stone-300 hover:text-rose-500 transition-colors"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {isRecurring && (
                            <div className="space-y-4 pt-4 border-t border-stone-100">
                              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">Configuração de Recorrência</p>
                              
                              <div className="space-y-4">
                                <div className="flex flex-wrap gap-x-6 gap-y-3">
                                  <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                      type="radio" 
                                      name="recurrenceMode"
                                      checked={recurrenceMode === 'continuous'} 
                                      onChange={() => setRecurrenceMode('continuous')} 
                                      className="accent-stone-900 w-4 h-4" 
                                    />
                                    <span className="text-[11px] text-stone-600 font-bold uppercase tracking-tight group-hover:text-stone-900">Recorrente</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                      type="radio" 
                                      name="recurrenceMode"
                                      checked={recurrenceMode === 'installments'} 
                                      onChange={() => setRecurrenceMode('installments')} 
                                      className="accent-stone-900 w-4 h-4" 
                                    />
                                    <span className="text-[11px] text-stone-600 font-bold uppercase tracking-tight group-hover:text-stone-900">Parcelado</span>
                                  </label>
                                </div>

                                {recurrenceMode === 'continuous' && (
                                  <div className="flex flex-wrap gap-x-4 gap-y-2 p-3 bg-white rounded-2xl border border-stone-100">
                                    {[
                                      { id: 'weekly', label: 'Semanal' },
                                      { id: 'monthly', label: 'Mensal' },
                                      { id: 'annually', label: 'Anual' }
                                    ].map((freq) => (
                                      <button
                                        key={freq.id}
                                        type="button"
                                        onClick={() => setTransFrequency(freq.id as any)}
                                        className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${transFrequency === freq.id ? 'bg-stone-900 border-stone-900 text-white' : 'bg-transparent border-stone-100 text-stone-400 hover:bg-stone-50'}`}
                                      >
                                        {freq.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {recurrenceMode === 'installments' && (
                                <div className="max-w-xs space-y-1">
                                  <label className="text-[8px] font-bold text-stone-400 uppercase">Número de Parcelas</label>
                                  <input 
                                    type="number" 
                                    value={installmentsCount} 
                                    onChange={(e) => setInstallmentsCount(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl py-2 px-4 text-sm font-semibold"
                                    placeholder="Ex: 12"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full py-5 bg-stone-900 text-white rounded-[2rem] text-sm font-bold uppercase tracking-[0.2em] hover:bg-stone-800 shadow-2xl shadow-stone-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingTransaction ? 'Atualizar Lançamento' : 'Confirmar Lançamento')}
                    </button>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showCardDeleteModal && cardToDelete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
              onClick={(e) => e.target === e.currentTarget && setShowCardDeleteModal(false)}
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
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Excluir {cardToDelete.type === 'bank' ? 'Conta' : 'Cartão'}?</h3>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Você está prestes a excluir <span className="font-semibold text-stone-900">"{cardToDelete.name}"</span>. Esta ação removerá o acesso a este recurso mas <span className="italic">não</span> excluirá os lançamentos vinculados a ele.
                  </p>

                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setShowCardDeleteModal(false)}
                      className="w-full py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => handleDeleteCard(cardToDelete.id.toString())}
                      disabled={isSubmitting}
                      className="w-full py-4 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirmar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showCategoryDeleteModal && categoryToDelete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
              onClick={(e) => e.target === e.currentTarget && setShowCategoryDeleteModal(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/5"
              >
                <div className="p-8 text-center">
                  <div className={`w-16 h-16 ${isCategoryInUse ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                    {isCategoryInUse ? <AlertCircle size={32} /> : <Trash2 size={32} />}
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Excluir Categoria?</h3>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Você está prestes a excluir a categoria <span className="font-semibold text-stone-900">"{categoryToDelete.name}"</span>.
                  </p>
                  
                  {isCategoryInUse && (
                    <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                      <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        Esta categoria está sendo usada em lançamentos existentes. Se você excluí-la, os lançamentos continuarão existindo, mas sem uma categoria vinculada no gerenciador.
                      </p>
                    </div>
                  )}

                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setShowCategoryDeleteModal(false)}
                      className="w-full py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={confirmDeleteCategory}
                      className={`w-full py-4 ${isCategoryInUse ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'} text-white rounded-2xl text-sm font-bold transition-all shadow-xl active:scale-95`}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showBulkDeleteModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
              onClick={(e) => e.target === e.currentTarget && setShowBulkDeleteModal(false)}
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
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight">Excluir em Lote?</h3>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Você selecionou <span className="font-bold text-rose-600">{selectedTransactions.length}</span> lançamentos para excluir. Esta ação não poderá ser desfeita.
                  </p>
                  
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <button 
                      disabled={isBulkSubmitting}
                      onClick={() => setShowBulkDeleteModal(false)}
                      className="w-full py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all active:scale-95 disabled:opacity-50"
                    >
                      Voltar
                    </button>
                    <button 
                      disabled={isBulkSubmitting}
                      onClick={confirmBulkDelete}
                      className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-bold transition-all shadow-xl shadow-rose-200 active:scale-95 flex items-center justify-center gap-2"
                    >
                      {isBulkSubmitting && <Loader2 size={16} className="animate-spin" />}
                      {isBulkSubmitting ? 'Excluindo...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Bulk Action Toolbar */}
          <AnimatePresence>
            {selectedTransactions.length > 0 && activeTab === 'transactions' && (
              <motion.div
                initial={{ y: 50, opacity: 0, x: '-50%', scale: 0.95 }}
                animate={{ y: 0, opacity: 1, x: '-50%', scale: 1 }}
                exit={{ y: 50, opacity: 0, x: '-50%', scale: 0.95 }}
                className="fixed bottom-28 left-1/2 z-[100] w-full max-w-sm sm:max-w-md px-4"
              >
                <div className="bg-stone-900/90 text-white p-2.5 rounded-3xl shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-xl ring-1 ring-white/10">
                  <div className="flex items-center gap-3 ml-3">
                    <div className="w-8 h-8 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20 flex items-center justify-center text-[10px] font-black">
                      {selectedTransactions.length}
                    </div>
                    <p className="text-[10px] font-bold tracking-tight uppercase opacity-80">Selecionados</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setSelectedTransactions([])}
                      className="h-9 px-3 hover:bg-white/10 rounded-2xl text-[9px] font-bold uppercase tracking-wider transition-colors"
                    >
                      Limpar
                    </button>
                    <button 
                      disabled={isBulkSubmitting}
                      onClick={handleBulkQuitar}
                      className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      {isBulkSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Quitar
                    </button>
                    <button 
                      disabled={isBulkSubmitting}
                      onClick={handleBulkDeleteRequest}
                      className="h-9 px-4 bg-rose-500 hover:bg-rose-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-rose-500/20"
                    >
                      {isBulkSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Excluir
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatePresence>

      </main>
    </div>
  );
}
