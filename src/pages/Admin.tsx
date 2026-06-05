import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import {
  Gem, ShoppingBag, Users, TrendingUp, Plus, Edit2, Trash2, Power,
  Store, Search, Filter, Award, X, Package, BarChart2, ChevronDown,
  CheckCircle, Clock, Truck, AlertCircle, Shield, Ban, RefreshCw,
  Star, Zap, ArrowUp, ArrowDown, Eye, EyeOff, DollarSign,
  Percent, Target, Layers
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { collection, getDocs, doc, updateDoc, query, orderBy, setDoc, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminMarketing } from '../components/AdminMarketing';

// ─── TYPES ─────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  costPrice?: number;
  image: string;
  category: string;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  diamondReward?: number;
  active?: boolean;
  stock?: number;
  minStock?: number;
  tags?: string;
  promoActive?: boolean;
  promoDiscount?: number;
  promoPrice?: number;
  promoExpiry?: string;
  comboProductId?: string;
  comboDiscount?: number;
  availableInRoulette?: boolean;
  minQtyForDiscount?: number;
}
interface OrderItem { id: string; title: string; price: number; quantity: number; }
interface Order {
  id: string; clientName: string; clientEmail: string; items: OrderItem[];
  total: number; status: 'Pendente' | 'Aprovado' | 'Saiu para Entrega' | 'Entregue';
  createdAt: string; address: string;
}
interface FirestoreClient {
  id: string; name: string; email: string; role: string;
  diamonds?: number; createdAt?: any;
}
type TabType = 'dashboard' | 'produtos' | 'pedidos' | 'clientes' | 'analytics' | 'roleta' | 'financeiro' | 'marketing';
// ─── VIP LEVELS ──────────────────────────────────────────────────────────────
const getVipLevel = (diamonds: number = 0) => {
  if (diamonds >= 5000) return { label: 'Black', emoji: '⬛', color: '#e2e8f0', border: 'rgba(226,232,240,0.3)', bg: 'rgba(255,255,255,0.07)' };
  if (diamonds >= 1000) return { label: 'Diamante', emoji: '💎', color: '#818cf8', border: 'rgba(129,140,248,0.35)', bg: 'rgba(129,140,248,0.1)' };
  if (diamonds >= 500)  return { label: 'Ouro',     emoji: '🥇', color: '#D4AF37', border: 'rgba(212,175,55,0.35)',  bg: 'rgba(212,175,55,0.1)' };
  if (diamonds >= 100)  return { label: 'Prata',    emoji: '🥈', color: '#94a3b8', border: 'rgba(148,163,184,0.35)', bg: 'rgba(148,163,184,0.1)' };
  return                       { label: 'Bronze',   emoji: '🥉', color: '#cd7f32', border: 'rgba(205,127,50,0.35)',  bg: 'rgba(205,127,50,0.1)' };
};

// ─── DIAMOND & MARGIN HELPERS ─────────────────────────────────────────────────
const DIAMOND_VALUE = 0.01; // R$ per diamond

const calcDiamondCost = (d: number = 0) => d * DIAMOND_VALUE;

const calcRealMargin = (price: number, costPrice: number, diamonds: number = 0): number | null => {
  if (!price || !costPrice || costPrice <= 0 || price <= 0) return null;
  return ((price - costPrice - calcDiamondCost(diamonds)) / price) * 100;
};



const getMarginStatus = (margin: number | null) => {
  if (margin === null) return null;
  if (margin < 0)   return { label: '⛔ PREJUÍZO',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)' };
  if (margin < 15)  return { label: '🔴 Risco Alto',  color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.4)' };
  if (margin < 30)  return { label: '🟡 Aceitável',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)' };
  return                   { label: '🟢 Saudável',    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.4)' };
};

// ─── KNOWN IMAGES (quick gallery) ────────────────────────────────────────────
// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const salesData = [
  { day: 'Seg', vendas: 340, pedidos: 4 },{ day: 'Ter', vendas: 520, pedidos: 7 },
  { day: 'Qua', vendas: 280, pedidos: 3 },{ day: 'Qui', vendas: 890, pedidos: 11 },
  { day: 'Sex', vendas: 1200, pedidos: 15 },{ day: 'Sáb', vendas: 1650, pedidos: 20 },
  { day: 'Dom', vendas: 980, pedidos: 12 },
];
const categoryData = [
  { name: 'Bebidas', value: 42, color: '#818cf8' },{ name: 'Tabacaria', value: 28, color: '#f59e0b' },
  { name: 'Eletrônicos', value: 18, color: '#10b981' },{ name: 'Limpeza', value: 8, color: '#ec4899' },
  { name: 'Alimentos', value: 4, color: '#0ea5e9' },
];
const monthlyData = [
  { mes: 'Jan', receita: 4200 },{ mes: 'Fev', receita: 5800 },{ mes: 'Mar', receita: 4900 },
  { mes: 'Abr', receita: 7200 },{ mes: 'Mai', receita: 8900 },{ mes: 'Jun', receita: 6100 },
];


// ─── CRM Light Mode Theme ───────────────────────────────────────────────
const crmTheme = {
  bg: '#f8fafc',
  cardBg: '#ffffff',
  headerBg: 'rgba(255, 255, 255, 0.9)',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  primary: '#4f46e5',
  primaryLight: 'rgba(79, 70, 229, 0.08)',
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.08)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.08)',
  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.08)',
  accent: '#0ea5e9',
  accentLight: 'rgba(14, 165, 233, 0.08)',
  shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
  shadowSm: '0 1px 3px rgba(0, 0, 0, 0.05)',
};

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'Pendente':          { color: '#d97706', bg: '#fef3c7',  border: '#fde68a',  icon: Clock },
  'Aprovado':          { color: '#0284c7', bg: '#e0f2fe',  border: '#bae6fd',  icon: CheckCircle },
  'Saiu para Entrega': { color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe', icon: Truck },
  'Entregue':          { color: '#059669', bg: '#d1fae5',  border: '#a7f3d0',  icon: CheckCircle },
};

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) return (
    <div style={{ background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, borderRadius: 10, padding: '10px 14px', boxShadow: crmTheme.shadow }}>
      <p style={{ color: crmTheme.textPrimary, fontWeight: 900, fontSize: 12, margin: '0 0 4px' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontSize: 11, margin: 0, fontWeight: 700 }}>
          {p.name}: {p.name === 'vendas' || p.name === 'receita' ? `R$ ${p.value.toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
  return null;
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, iconColor, trend }: any) => (
  <div style={{
    background: crmTheme.cardBg,
    border: `1px solid ${crmTheme.border}`,
    borderRadius: 18, padding: '18px 16px', position: 'relative', overflow: 'hidden',
    boxShadow: crmTheme.shadow,
  }}>
    <div style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 8, background: `${iconColor}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={16} color={iconColor} />
    </div>
    <span style={{ fontSize: 10, fontWeight: 800, color: crmTheme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    <h3 style={{ fontSize: 22, fontWeight: 900, color: crmTheme.textPrimary, margin: '6px 0 4px', letterSpacing: -0.5 }}>{value}</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {trend !== undefined && (trend >= 0 ? <ArrowUp size={10} color="#10b981" /> : <ArrowDown size={10} color="#ef4444" />)}
      <span style={{ fontSize: 9.5, fontWeight: 700, color: sub?.startsWith('⚡') || sub?.startsWith('💎') ? '#10b981' : crmTheme.textSecondary }}>{sub}</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Admin: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // ── Products ──
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  // Financial simulator
  const [finSimUnits, setFinSimUnits] = useState('30');

  // ── Orders ──
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderFilter, setOrderFilter] = useState<string>('Todos');

  // ── Clients ──
  const [clients, setClients] = useState<FirestoreClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<FirestoreClient | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [awardAmount, setAwardAmount] = useState('50');
  const [clientSearch, setClientSearch] = useState('');

  // ── Roulette ──
  const [rouletteItems, setRouletteItems] = useState<{ text: string; color: string; probability?: number }[]>([]);
  const [newRouletteText, setNewRouletteText] = useState('');
  const [newRouletteProbability, setNewRouletteProbability] = useState('10');
  const [savingRoulette, setSavingRoulette] = useState(false);
  const [loadingRoulette, setLoadingRoulette] = useState(false);

  // ─── Load from Firestore ───────────────────────────────────────────────
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'products'), async (snap) => {
      if (snap.empty) {
        const stored = localStorage.getItem('app-products');
        if (stored) {
          const arr = JSON.parse(stored);
          for (const p of arr) {
            try { await setDoc(doc(db, 'products', p.id), p); } catch(e){}
          }
        }
      }
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubO = onSnapshot(collection(db, 'orders'), async (snap) => {
      if (snap.empty) {
        const stored = localStorage.getItem('app-orders');
        if (stored) {
          const arr = JSON.parse(stored);
          for (const o of arr) {
            try { await setDoc(doc(db, 'orders', o.id), o); } catch(e){}
          }
        }
      }
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });

    return () => { unsubP(); unsubO(); };
  }, []);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreClient)));
    } catch (e) { console.error(e); }
    finally { setLoadingClients(false); }
  };

  const DEFAULT_ROULETTE_ITEMS = [
    { text: '15 Diamantes 💎', color: '#D4AF37', probability: 20 },
    { text: 'Monster Gelado ⚡', color: '#E25C1D', probability: 10 },
    { text: 'Tente de Novo 😢', color: '#1E150F', probability: 15 },
    { text: 'Frete Grátis 🚚', color: '#059669', probability: 10 },
    { text: '50 Diamantes 💎', color: '#D4AF37', probability: 5 },
    { text: '10% de Desconto 🏷️', color: '#5B21B6', probability: 15 },
    { text: 'Cerveja Spaten 🍺', color: '#059669', probability: 5 },
    { text: '100 Diamantes 💎', color: '#D4AF37', probability: 2 },
    { text: 'Tente de Novo 😢', color: '#1E150F', probability: 18 },
  ];

  const fetchRoulette = async () => {
    setLoadingRoulette(true);
    try {
      const snap = await getDoc(doc(db, 'configs', 'roulette'));
      setRouletteItems(snap.exists() && snap.data().items ? snap.data().items : DEFAULT_ROULETTE_ITEMS);
    } catch { setRouletteItems(DEFAULT_ROULETTE_ITEMS); }
    finally { setLoadingRoulette(false); }
  };

  useEffect(() => {
    if (activeTab === 'clientes') fetchClients();
    if (activeTab === 'roleta') fetchRoulette();
  }, [activeTab]);

  const handleLogout = async () => { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } };

  const handleDeleteProduct = async (id: string) => { 
    if (window.confirm('Excluir produto?')) {
      await deleteDoc(doc(db, 'products', id));
    }
  };
  
  const toggleProductActive = async (id: string, active: boolean) => {
    await updateDoc(doc(db, 'products', id), { active: !active });
  };
  
  const updateOrderStatus = async (id: string, status: Order['status']) => {
    await updateDoc(doc(db, 'orders', id), { status });
    if (selectedOrder?.id === id) setSelectedOrder({ ...selectedOrder, status });
  };

  const promoteToAdmin = async (client: FirestoreClient) => {
    if (!window.confirm(`Promover ${client.name} a administrador?`)) return;
    try { await updateDoc(doc(db, 'users', client.id), { role: 'admin' }); setClients(prev => prev.map(c => c.id === client.id ? { ...c, role: 'admin' } : c)); }
    catch { alert('Erro ao promover usuário.'); }
  };
  const banClient = async (client: FirestoreClient) => {
    if (!window.confirm(`Banir ${client.name}?`)) return;
    try { await updateDoc(doc(db, 'users', client.id), { role: 'banned' }); setClients(prev => prev.map(c => c.id === client.id ? { ...c, role: 'banned' } : c)); }
    catch { alert('Erro ao banir.'); }
  };
  const handleAwardDiamonds = async () => {
    if (!selectedClient) return;
    const amount = parseInt(awardAmount);
    if (isNaN(amount) || amount <= 0) { alert('Quantidade inválida.'); return; }
    try {
      const newTotal = (selectedClient.diamonds || 0) + amount;
      await updateDoc(doc(db, 'users', selectedClient.id), { diamonds: newTotal });
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, diamonds: newTotal } : c));
      setIsAwardModalOpen(false); alert(`✅ ${amount} 💎 creditados para ${selectedClient.name}!`);
    } catch { alert('Erro ao conceder diamantes.'); }
  };

  // Roulette
  const handleSaveRoulette = async () => {
    if (rouletteItems.length < 2) { alert('A roleta precisa de no mínimo 2 itens.'); return; }
    setSavingRoulette(true);
    try { await setDoc(doc(db, 'configs', 'roulette'), { items: rouletteItems, updatedAt: new Date().toISOString() }); alert('Roleta salva! 🎉'); }
    catch (e: any) { alert('Erro: ' + e.message); }
    finally { setSavingRoulette(false); }
  };
  const handleAddRouletteItem = () => {
    const text = newRouletteText.trim(); if (!text) return;
    const prob = parseFloat(newRouletteProbability) || 0;
    const colors = ['#4f46e5', '#475569', '#f97316', '#8b5cf6', '#10b981'];
    setRouletteItems([...rouletteItems, { text, color: colors[rouletteItems.length % colors.length], probability: prob }]);
    setNewRouletteText(''); setNewRouletteProbability('10');
  };
  const handleRemoveRouletteItem = (i: number) => setRouletteItems(rouletteItems.filter((_, idx) => idx !== i));
  const moveRouletteItem = (i: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? i - 1 : i + 1;
    if (next < 0 || next >= rouletteItems.length) return;
    const upd = [...rouletteItems]; [upd[i], upd[next]] = [upd[next], upd[i]]; setRouletteItems(upd);
  };

  // ─── Computed ────────────────────────────────────────────────────────────
  const approvedOrders = orders.filter(o => o.status !== 'Pendente');
  const totalRevenue = approvedOrders.reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter(o => o.status === 'Pendente').length;
  const avgTicket = approvedOrders.length > 0 ? totalRevenue / approvedOrders.length : 0;
  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(searchProduct.toLowerCase()) && (filterCategory === 'Todos' || p.category === filterCategory)
  );
  const filteredOrders = orderFilter === 'Todos' ? orders : orders.filter(o => o.status === orderFilter);
  const filteredClients = clients.filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.email?.toLowerCase().includes(clientSearch.toLowerCase()));

  // Financial computed
  const productsWithCost = products.filter(p => p.costPrice && p.costPrice > 0);
  const avgMarginPct = productsWithCost.length > 0
    ? productsWithCost.reduce((sum, p) => sum + (calcRealMargin(p.price, p.costPrice!, p.diamondReward) ?? 0), 0) / productsWithCost.length
    : 0;
  const riskProducts = productsWithCost.filter(p => { const m = calcRealMargin(p.price, p.costPrice!, p.diamondReward); return m !== null && m < 15; });
  const productWithMargin = productsWithCost.map(p => ({
    ...p,
    margin: calcRealMargin(p.price, p.costPrice!, p.diamondReward) ?? 0,
    profitUnit: p.price - (p.costPrice ?? 0) - calcDiamondCost(p.diamondReward ?? 0),
    diamondCostTotal: calcDiamondCost(p.diamondReward ?? 0),
  })).sort((a, b) => b.profitUnit - a.profitUnit);
  const simUnits = parseInt(finSimUnits) || 30;
  const simMonthlyProfit = productWithMargin.reduce((s, p) => s + p.profitUnit * simUnits, 0);
  const marginBarData = productWithMargin.slice(0, 8).map(p => ({
    name: p.title.length > 18 ? p.title.slice(0, 18) + '…' : p.title,
    margem: parseFloat(p.margin.toFixed(1)),
    fill: p.margin < 15 ? '#ef4444' : p.margin < 30 ? '#f59e0b' : '#10b981',
  }));

  // ─── Styles ───────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '40px', background: crmTheme.cardBg,
    border: `1px solid ${crmTheme.border}`, borderRadius: 10,
    paddingLeft: 12, paddingRight: 12, color: crmTheme.textPrimary, fontSize: 13,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Manrope, sans-serif',
  };
  const labelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, color: crmTheme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 };
  const sectionCard: React.CSSProperties = { background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, borderRadius: 20, padding: 20, boxShadow: crmTheme.shadow };

  const TABS: { key: TabType; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'dashboard',  label: 'Dashboard',  icon: TrendingUp },
    { key: 'produtos',   label: 'Produtos',   icon: Package },
    { key: 'pedidos',    label: 'Pedidos',    icon: ShoppingBag, badge: pendingCount },
    { key: 'clientes',   label: 'Clientes',   icon: Users },
    { key: 'analytics',  label: 'Analytics',  icon: BarChart2 },
    { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { key: 'marketing',  label: 'Marketing',  icon: Layers },
    { key: 'roleta',     label: 'Roleta',     icon: RefreshCw },
  ];

  // ═══════ RENDER ═══════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: crmTheme.bg, color: crmTheme.textPrimary, fontFamily: 'Manrope, sans-serif', paddingBottom: 60 }}>
      {/* Subtle modern layout accents */}
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.02) 0%, transparent 70%)', top: '-10%', right: '-5%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.02) 0%, transparent 70%)', bottom: '10%', left: '-5%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: crmTheme.headerBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${crmTheme.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: crmTheme.shadowSm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.2)' }}>
            <Gem size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 900, color: crmTheme.textPrimary, margin: 0 }}>Painel Administrativo</h1>
            <span style={{ fontSize: 9, fontWeight: 800, color: crmTheme.primary, textTransform: 'uppercase', letterSpacing: 1 }}>Mercado Nosso Jeito • CRM Pro</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 5, background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, padding: '6px 12px', borderRadius: 8, color: crmTheme.textSecondary, fontSize: 11, fontWeight: 800, textDecoration: 'none', boxShadow: crmTheme.shadowSm }}>
            <Store size={13} color={crmTheme.primary} /><span>Ver Loja</span>
          </Link>
          <button onClick={handleLogout} style={{ background: crmTheme.dangerLight, border: `1px solid ${crmTheme.border}`, width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: crmTheme.danger, cursor: 'pointer' }}>
            <Power size={14} />
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', position: 'relative', zIndex: 1 }}>
        {/* Tab Nav */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const Icon = tab.icon; const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px',
                background: active ? crmTheme.primary : crmTheme.cardBg,
                border: active ? 'none' : `1px solid ${crmTheme.border}`,
                borderRadius: 10, color: active ? '#fff' : crmTheme.textSecondary,
                fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.25s ease', position: 'relative', fontFamily: 'Manrope, sans-serif',
                boxShadow: active ? '0 4px 12px rgba(79,70,229,0.2)' : crmTheme.shadowSm,
              }}>
                <Icon size={13} /><span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -6, background: crmTheme.danger, color: '#fff', fontSize: 9, fontWeight: 900, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══ TAB: DASHBOARD ══════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Faturamento" value={`R$ ${totalRevenue.toFixed(2)}`} sub="⚡ Pedidos aprovados" icon={TrendingUp} iconColor={crmTheme.primary} trend={12} />
              <StatCard label="Pedidos Totais" value={orders.length} sub={`${pendingCount} pendentes`} icon={ShoppingBag} iconColor={crmTheme.accent} trend={5} />
              <StatCard label="Ticket Médio" value={`R$ ${avgTicket.toFixed(2)}`} sub="Por pedido aprovado" icon={Zap} iconColor={crmTheme.success} trend={3} />
              <StatCard label="Produtos" value={products.length} sub={`${products.filter(p => p.active !== false).length} ativos`} icon={Package} iconColor={crmTheme.primary} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={15} color={crmTheme.primary} /> Vendas da Semana</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={crmTheme.borderLight} />
                    <XAxis dataKey="day" tick={{ fill: crmTheme.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: crmTheme.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `R$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="vendas" stroke={crmTheme.primary} strokeWidth={2.5} dot={{ fill: crmTheme.primary, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} name="vendas" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={15} color={crmTheme.primary} /> Vendas por Categoria</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart><Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>{categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie></PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {categoryData.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                          <span style={{ fontSize: 11, color: crmTheme.textSecondary, fontWeight: 700 }}>{c.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 900, color: crmTheme.textPrimary }}>{c.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={15} color={crmTheme.warning} /> Pedidos Aguardando Ação</h3>
                <button onClick={() => setActiveTab('pedidos')} style={{ background: 'none', border: 'none', color: crmTheme.primary, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>Ver todos <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: crmTheme.textMuted, fontSize: 12 }}>✅ Nenhum pedido pendente.</div>
                ) : orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').map(order => {
                  const sc = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
                  return (
                    <div key={order.id} onClick={() => { setSelectedOrder(order); setActiveTab('pedidos'); }} style={{ background: crmTheme.bg, border: `1px solid ${crmTheme.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: crmTheme.shadowSm }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary }}>{order.clientName}</span>
                          <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{order.status}</span>
                        </div>
                        <span style={{ fontSize: 10, color: crmTheme.textMuted }}>{order.createdAt}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color: crmTheme.primary }}>R$ {order.total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: PRODUTOS ════════════════════════════════════════════════════ */}
        {activeTab === 'produtos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={13} color={crmTheme.textMuted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Buscar produto..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, borderRadius: 10, padding: '0 10px', height: 40, boxShadow: crmTheme.shadowSm }}>
                  <Filter size={12} color={crmTheme.primary} style={{ marginRight: 6 }} />
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ background: 'transparent', border: 'none', color: crmTheme.textPrimary, fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                    {['Todos', 'Bebidas', 'Tabacaria', 'Eletrônicos', 'Limpeza', 'Alimentos'].map(c => <option key={c} value={c} style={{ background: crmTheme.cardBg, color: crmTheme.textPrimary }}>{c}</option>)}
                  </select>
                </div>
                <button onClick={() => navigate('/admin/produto/novo')} style={{ height: 40, background: crmTheme.primary, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 900, fontSize: 12, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', boxShadow: '0 4px 12px rgba(79,70,229,0.2)' }}>
                  <Plus size={14} /> Cadastrar
                </button>
              </div>
            </div>
            <div style={{ ...sectionCard, padding: '8px 0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${crmTheme.border}` }}>
                    {['Produto', 'Preço', 'Margem', 'Estoque', 'Categoria', 'Status', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', fontSize: 10, fontWeight: 900, color: crmTheme.textSecondary, textTransform: 'uppercase', textAlign: h === 'Ações' ? 'center' : 'left', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const margin = p.costPrice ? calcRealMargin(p.price, p.costPrice, p.diamondReward) : null;
                    const ms = getMarginStatus(margin);
                    const stockLow = p.minStock && p.stock !== undefined && p.stock <= p.minStock;
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${crmTheme.borderLight}`, opacity: p.active === false ? 0.6 : 1 }}>
                        <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src={p.image} alt={p.title} style={{ width: 40, height: 40, objectFit: 'contain', background: '#f8fafc', borderRadius: 8, border: `1px solid ${crmTheme.border}`, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: crmTheme.textPrimary, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{p.title}</div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                              {p.badge && <span style={{ fontSize: 8, fontWeight: 900, background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: 99 }}>{p.badge}</span>}
                              {p.promoActive && <span style={{ fontSize: 8, fontWeight: 900, background: '#fce7f3', color: '#db2777', border: '1px solid #fbcfe8', padding: '1px 5px', borderRadius: 99 }}>PROMO</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: crmTheme.primary }}>R$ {p.price.toFixed(2)}</div>
                          {p.costPrice && <div style={{ fontSize: 9, color: crmTheme.textMuted, fontWeight: 700 }}>custo R${p.costPrice.toFixed(2)}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {ms ? (
                            <span style={{ fontSize: 10, fontWeight: 900, color: ms.color, background: ms.bg, border: `1px solid ${ms.border}`, padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                              {margin!.toFixed(1)}% {ms.label.split(' ')[0]}
                            </span>
                          ) : <span style={{ fontSize: 10, color: crmTheme.textMuted }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: stockLow ? crmTheme.danger : crmTheme.textSecondary }}>{p.stock ?? '—'}</span>
                          {stockLow && <div style={{ fontSize: 8, color: crmTheme.danger, fontWeight: 900 }}>⚠️ BAIXO</div>}
                          {p.diamondReward && <div style={{ fontSize: 9, color: crmTheme.success, fontWeight: 800 }}>💎 +{p.diamondReward}</div>}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: crmTheme.textSecondary, fontWeight: 700 }}>{p.category}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button onClick={() => toggleProductActive(p.id, p.active !== false)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: p.active !== false ? crmTheme.successLight : crmTheme.dangerLight, border: `1px solid ${p.active !== false ? crmTheme.success : crmTheme.danger}`, borderRadius: 99, padding: '3px 10px', cursor: 'pointer', color: p.active !== false ? crmTheme.success : crmTheme.danger, fontSize: 10, fontWeight: 900 }}>
                            {p.active !== false ? <><Eye size={10} />Ativo</> : <><EyeOff size={10} />Inativo</>}
                          </button>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button onClick={() => navigate('/admin/produto/' + p.id)} style={{ background: crmTheme.bg, border: `1px solid ${crmTheme.border}`, width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: crmTheme.primary, cursor: 'pointer' }}><Edit2 size={12} /></button>
                            <button onClick={() => handleDeleteProduct(p.id)} style={{ background: crmTheme.dangerLight, border: `1px solid ${crmTheme.border}`, width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: crmTheme.danger, cursor: 'pointer' }}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: crmTheme.textMuted, fontSize: 13 }}>Nenhum produto encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: PEDIDOS ═════════════════════════════════════════════════════ */}
        {activeTab === 'pedidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Todos', 'Pendente', 'Aprovado', 'Saiu para Entrega', 'Entregue'].map(f => (
                <button key={f} onClick={() => setOrderFilter(f)} style={{
                  height: 34, padding: '0 14px', borderRadius: 99, cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'Manrope, sans-serif',
                  background: orderFilter === f ? (f === 'Todos' ? crmTheme.primary : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.bg || '#f1f5f9') : crmTheme.cardBg,
                  color: orderFilter === f ? (f === 'Todos' ? '#fff' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.color || crmTheme.textPrimary) : crmTheme.textSecondary,
                  border: orderFilter === f ? 'none' : `1px solid ${crmTheme.border}`,
                  boxShadow: orderFilter === f ? '0 4px 12px rgba(79,70,229,0.2)' : crmTheme.shadowSm,
                }}>
                  {f === 'Todos' ? `Todos (${orders.length})` : `${f} (${orders.filter(o => o.status === f).length})`}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredOrders.map(order => {
                const sc = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', icon: Clock };
                const Icon = sc.icon;
                return (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} style={{ background: selectedOrder?.id === order.id ? crmTheme.primaryLight : crmTheme.cardBg, border: selectedOrder?.id === order.id ? `1.5px solid ${crmTheme.primary}` : `1px solid ${crmTheme.border}`, borderRadius: 16, padding: 16, cursor: 'pointer', transition: 'all 0.25s ease', boxShadow: crmTheme.shadow }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 900, color: crmTheme.textPrimary }}>{order.clientName}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: crmTheme.primary }}>#{order.id}</span>
                        </div>
                        <span style={{ fontSize: 10, color: crmTheme.textMuted }}>{order.createdAt}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: crmTheme.primary }}>R$ {order.total.toFixed(2)}</span>
                        <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icon size={10} />{order.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {order.items.map(item => (
                        <span key={item.id} style={{ fontSize: 10, background: crmTheme.bg, border: `1px solid ${crmTheme.border}`, padding: '3px 8px', borderRadius: 8, color: crmTheme.textSecondary, fontWeight: 700 }}>
                          {item.quantity}× {item.title.split(' ').slice(0, 3).join(' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredOrders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: crmTheme.textMuted }}>Nenhum pedido encontrado.</div>}
            </div>
          </div>
        )}

        {/* ══ TAB: CLIENTES ════════════════════════════════════════════════════ */}
        {activeTab === 'clientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* VIP Legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ label: 'Bronze', emoji: '🥉', min: '0', max: '99' }, { label: 'Prata', emoji: '🥈', min: '100', max: '499' }, { label: 'Ouro', emoji: '🥇', min: '500', max: '999' }, { label: 'Diamante', emoji: '💎', min: '1.000', max: '4.999' }, { label: 'Black', emoji: '⬛', min: '5.000', max: '+' }].map(v => (
                <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, padding: '5px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800, color: crmTheme.textSecondary, boxShadow: crmTheme.shadowSm }}>
                  <span>{v.emoji}</span><span>{v.label}</span><span style={{ color: crmTheme.textMuted }}>💎{v.min}–{v.max}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={13} color={crmTheme.textMuted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>
              <button onClick={fetchClients} style={{ height: 40, padding: '0 14px', background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, borderRadius: 10, color: crmTheme.textPrimary, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Manrope, sans-serif', boxShadow: crmTheme.shadowSm }}>
                <RefreshCw size={13} color={crmTheme.primary} /> Atualizar
              </button>
            </div>
            {loadingClients ? (
              <div style={{ textAlign: 'center', padding: 40, color: crmTheme.textMuted, fontSize: 13 }}>Carregando clientes...</div>
            ) : filteredClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: crmTheme.textMuted, fontSize: 13 }}>Nenhum cliente cadastrado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredClients.map(client => {
                  const vip = getVipLevel(client.diamonds);
                  return (
                    <div key={client.id} style={{ background: crmTheme.cardBg, border: `1px solid ${client.role === 'admin' ? '#fde68a' : client.role === 'banned' ? '#fecaca' : crmTheme.border}`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: crmTheme.shadow }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg, ${vip.color}33, ${vip.color}11)`, border: `1.5px solid ${vip.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {vip.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: crmTheme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 99, background: vip.bg, color: vip.color, border: `1px solid ${vip.border}`, flexShrink: 0 }}>{vip.emoji} {vip.label}</span>
                          {client.role === 'admin' && <span style={{ fontSize: 8, fontWeight: 900, background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: 99 }}>ADMIN</span>}
                          {client.role === 'banned' && <span style={{ fontSize: 8, fontWeight: 900, background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '2px 7px', borderRadius: 99 }}>BANIDO</span>}
                        </div>
                        <div style={{ fontSize: 11, color: crmTheme.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</div>
                        <div style={{ fontSize: 11, color: crmTheme.success, fontWeight: 800, marginTop: 2 }}>💎 {client.diamonds ?? 0} diamantes</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setSelectedClient(client); setAwardAmount('50'); setIsAwardModalOpen(true); }} style={{ height: 32, padding: '0 12px', background: crmTheme.successLight, border: `1px solid ${crmTheme.success}`, borderRadius: 8, color: crmTheme.success, fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Gem size={11} /> +💎
                        </button>
                        {client.role !== 'admin' && <button onClick={() => promoteToAdmin(client)} style={{ height: 32, padding: '0 10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, color: '#d97706', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={11} /></button>}
                        {client.role !== 'banned' && <button onClick={() => banClient(client)} style={{ height: 32, padding: '0 10px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, color: '#ef4444', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}><Ban size={11} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: ANALYTICS ══════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={15} color={crmTheme.primary} /> Receita Mensal (6 meses)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={crmTheme.borderLight} />
                  <XAxis dataKey="mes" tick={{ fill: crmTheme.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: crmTheme.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `R$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="receita" stroke={crmTheme.primary} strokeWidth={2.5} dot={{ fill: crmTheme.primary, r: 4, strokeWidth: 0 }} name="receita" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Melhor Dia" value="Sábado" sub="R$ 1.650 em vendas" icon={Star} iconColor={crmTheme.warning} />
              <StatCard label="Categoria Top" value="Bebidas" sub="42% das vendas" icon={TrendingUp} iconColor={crmTheme.primary} />
              <StatCard label="Pedido Máximo" value="R$ 303,40" sub="Carlos Souza" icon={Award} iconColor={crmTheme.success} />
              <StatCard label="Taxa Entrega" value="100%" sub="Frete grátis ativo" icon={Truck} iconColor={crmTheme.accent} />
            </div>
          </div>
        )}

        {/* ══ TAB: FINANCEIRO ═════════════════════════════════════════════════ */}
        {activeTab === 'financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Margem Média" value={`${avgMarginPct.toFixed(1)}%`} sub={`${productsWithCost.length} produtos c/ custo`} icon={Percent} iconColor={avgMarginPct >= 30 ? crmTheme.success : avgMarginPct >= 15 ? crmTheme.warning : crmTheme.danger} gold={avgMarginPct >= 30} trend={avgMarginPct >= 15 ? 1 : -1} />
              <StatCard label="Em Risco" value={riskProducts.length} sub="Margem abaixo de 15%" icon={AlertCircle} iconColor={crmTheme.danger} trend={riskProducts.length > 0 ? -1 : 1} />
              <StatCard label="Maior Lucro/un" value={productWithMargin.length > 0 ? `R$ ${productWithMargin[0].profitUnit.toFixed(2)}` : '—'} sub={productWithMargin.length > 0 ? productWithMargin[0].title.split(' ').slice(0, 2).join(' ') : ''} icon={TrendingUp} iconColor={crmTheme.success} />
              <StatCard label="Custo 💎/mês" value={`R$ ${products.reduce((s, p) => s + (p.diamondReward ?? 0) * DIAMOND_VALUE * simUnits, 0).toFixed(2)}`} sub={`${simUnits} un/produto/mês`} icon={Gem} iconColor={crmTheme.primary} />
            </div>

            {/* Simulator */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Target size={15} color={crmTheme.primary} /> Simulador de Lucro Mensal</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <label style={labelStyle}>Vendas/produto/mês:</label>
                <input type="number" value={finSimUnits} onChange={e => setFinSimUnits(e.target.value)} style={{ ...inputStyle, width: 80, textAlign: 'center' }} min="1" />
                <div style={{ background: crmTheme.primaryLight, border: `1px solid ${crmTheme.primary}`, borderRadius: 12, padding: '10px 20px' }}>
                  <div style={{ fontSize: 11, color: crmTheme.primary, fontWeight: 800 }}>LUCRO ESTIMADO/MÊS</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: simMonthlyProfit >= 0 ? crmTheme.success : crmTheme.danger }}>R$ {simMonthlyProfit.toFixed(2)}</div>
                </div>
              </div>
              <p style={{ fontSize: 10.5, color: crmTheme.textSecondary, margin: 0 }}>* Baseado em {productsWithCost.length} produtos com preço de custo cadastrado. Inclui desconto de diamantes (1💎 = R$0,01).</p>
            </div>

            {/* Margin bar chart */}
            {marginBarData.length > 0 && (
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={15} color={crmTheme.primary} /> Margem Real por Produto</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={marginBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={crmTheme.borderLight} horizontal={false} />
                    <XAxis type="number" tick={{ fill: crmTheme.textSecondary, fontSize: 9 }} domain={[0, 60]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: crmTheme.textPrimary, fontSize: 9 }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`${v}%`, 'Margem']} />
                    <Bar dataKey="margem" radius={[0, 6, 6, 0]}>
                      {marginBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                  {[{ c: '#10b981', l: '≥30% Saudável' }, { c: '#f59e0b', l: '15-29% Aceitável' }, { c: '#ef4444', l: '<15% Risco' }].map(x => (
                    <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: crmTheme.textSecondary, fontWeight: 700 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />{x.l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk table */}
            {riskProducts.length > 0 && (
              <div style={{ ...sectionCard, border: `1px solid ${crmTheme.danger}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: crmTheme.danger, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={15} /> Produtos em Risco de Prejuízo</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {riskProducts.map(p => {
                    const margin = calcRealMargin(p.price, p.costPrice!, p.diamondReward);
                    const ms = getMarginStatus(margin)!;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: crmTheme.dangerLight, border: `1px solid ${crmTheme.danger}`, borderRadius: 10, padding: '10px 14px' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: crmTheme.textPrimary }}>{p.title}</div>
                          <div style={{ fontSize: 10, color: crmTheme.textSecondary, marginTop: 2 }}>Venda: R${p.price.toFixed(2)} | Custo: R${p.costPrice!.toFixed(2)} | 💎×{p.diamondReward ?? 0} (R${calcDiamondCost(p.diamondReward ?? 0).toFixed(2)})</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: ms.color }}>{margin!.toFixed(1)}%</span>
                          <button onClick={() => navigate('/admin/produto/' + p.id)} style={{ display: 'block', marginTop: 4, fontSize: 9, fontWeight: 900, background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, borderRadius: 6, padding: '2px 8px', color: crmTheme.danger, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', boxShadow: crmTheme.shadowSm }}>Corrigir →</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {productsWithCost.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: crmTheme.textMuted }}>
                <ParagraphIcon size={32} style={{ marginBottom: 12, color: crmTheme.textMuted }} />
                <div style={{ fontSize: 14, fontWeight: 800 }}>Cadastre o preço de custo dos produtos</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Para ver análise de margens, adicione o "Preço de Custo" ao cadastrar produtos.</div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: ROLETA ══════════════════════════════════════════════════════ */}
        {activeTab === 'roleta' && (
          <div style={sectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 900, color: crmTheme.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={15} color={crmTheme.primary} /> Configurar Roleta de Prêmios</h3>
                <p style={{ fontSize: 11, color: crmTheme.textSecondary, margin: '4px 0 0' }}>Configure os prêmios. Salve para persistir no Firestore.</p>
              </div>
              <button onClick={handleSaveRoulette} disabled={savingRoulette || loadingRoulette} style={{ background: crmTheme.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Manrope, sans-serif', boxShadow: '0 4px 12px rgba(79,70,229,0.2)' }}>
                {savingRoulette ? 'Salvando...' : '💾 Salvar na Nuvem'}
              </button>
            </div>
            {loadingRoulette ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: crmTheme.textMuted, fontSize: 12 }}>Carregando...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 8, background: crmTheme.bg, border: `1px solid ${crmTheme.border}`, padding: 10, borderRadius: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" value={newRouletteText} onChange={e => setNewRouletteText(e.target.value)} placeholder="Novo prêmio (Ex: 20 Diamantes 💎)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onKeyDown={e => e.key === 'Enter' && handleAddRouletteItem()} />
                  <select value="" onChange={e => e.target.value && setNewRouletteText(e.target.value)} style={{ ...inputStyle, width: 200, cursor: 'pointer' }}>
                    <option value="" style={{ background: crmTheme.cardBg, color: crmTheme.textPrimary }}>Vincular Produto...</option>
                    {products.map(p => <option key={p.id} value={p.title} style={{ background: crmTheme.cardBg, color: crmTheme.textPrimary }}>{p.title}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: crmTheme.textSecondary, whiteSpace: 'nowrap' }}>Prob.:</span>
                    <input type="number" min="0" max="100" value={newRouletteProbability} onChange={e => setNewRouletteProbability(e.target.value)} placeholder="%" style={{ ...inputStyle, width: 60, textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: crmTheme.textSecondary }}>%</span>
                  </div>
                  <button onClick={handleAddRouletteItem} style={{ background: crmTheme.primaryLight, border: `1px solid ${crmTheme.primary}`, color: crmTheme.primary, padding: '0 18px', height: 40, borderRadius: 10, fontSize: 12, fontWeight: 850, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>Adicionar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: crmTheme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, display: 'grid', gridTemplateColumns: '1fr 140px 100px 110px', padding: '0 12px' }}>
                    <span>Texto</span><span>Cor</span><span>Prob.(%)</span><span style={{ textAlign: 'right' }}>Ações</span>
                  </div>
                  {rouletteItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', border: `1px dashed ${crmTheme.border}`, borderRadius: 12, color: crmTheme.textMuted, fontSize: 12 }}>Nenhum item. Adicione prêmios acima.</div>
                  ) : (
                    <>
                      {rouletteItems.map((item, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 110px', alignItems: 'center', gap: 12, background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, padding: '10px 12px', borderRadius: 12, boxShadow: crmTheme.shadowSm }}>
                          <input type="text" value={item.text} onChange={e => setRouletteItems(rouletteItems.map((it, i) => i === index ? { ...it, text: e.target.value } : it))} style={{ ...inputStyle, height: 36, background: 'transparent', border: 'none', padding: 0 }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: item.color, border: `1px solid ${crmTheme.border}`, flexShrink: 0 }} />
                            <input type="text" value={item.color} onChange={e => setRouletteItems(rouletteItems.map((it, i) => i === index ? { ...it, color: e.target.value } : it))} style={{ ...inputStyle, height: 32, fontSize: 11, padding: '0 6px', background: crmTheme.bg, border: `1px solid ${crmTheme.border}` }} />
                          </div>
                          <input type="number" min="0" max="100" value={item.probability ?? ''} onChange={e => { const v = parseFloat(e.target.value); setRouletteItems(rouletteItems.map((it, i) => i === index ? { ...it, probability: isNaN(v) ? 0 : v } : it)); }} style={{ ...inputStyle, height: 32, fontSize: 12, padding: '0 6px', background: crmTheme.bg, border: `1px solid ${crmTheme.border}`, textAlign: 'center' }} />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                            <button onClick={() => moveRouletteItem(index, 'up')} disabled={index === 0} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${crmTheme.border}`, background: crmTheme.bg, color: index === 0 ? crmTheme.textMuted : crmTheme.textSecondary, cursor: index === 0 ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}><ArrowUp size={11} /></button>
                            <button onClick={() => moveRouletteItem(index, 'down')} disabled={index === rouletteItems.length - 1} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${crmTheme.border}`, background: crmTheme.bg, color: index === rouletteItems.length - 1 ? crmTheme.textMuted : crmTheme.textSecondary, cursor: index === rouletteItems.length - 1 ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}><ArrowDown size={11} /></button>
                            <button onClick={() => handleRemoveRouletteItem(index)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${crmTheme.danger}`, background: crmTheme.dangerLight, color: crmTheme.danger, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: crmTheme.bg, padding: '12px 16px', borderRadius: 12, border: `1px solid ${crmTheme.border}`, marginTop: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: crmTheme.textSecondary }}>Soma das Probabilidades:</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color: rouletteItems.reduce((a, i) => a + (i.probability || 0), 0) === 100 ? crmTheme.success : crmTheme.warning }}>
                          {rouletteItems.reduce((a, i) => a + (i.probability || 0), 0)}%{rouletteItems.reduce((a, i) => a + (i.probability || 0), 0) !== 100 && ' ⚠️'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: MARKETING ════════════════════════════════════════════════ */}
        {activeTab === 'marketing' && <AdminMarketing />}
      </main>

      {/* ═══ MODAL: ORDER DETAIL ══════════════════════════════════════════════ */}
      {selectedOrder && activeTab === 'pedidos' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: crmTheme.cardBg, border: `1.5px solid ${crmTheme.border}`, borderRadius: 22, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', position: 'relative' }}>
            <button onClick={() => setSelectedOrder(null)} style={{ position: 'absolute', top: 16, right: 16, background: crmTheme.bg, border: `1px solid ${crmTheme.border}`, width: 30, height: 30, borderRadius: 8, color: crmTheme.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: crmTheme.textPrimary, margin: '0 0 2px' }}>Pedido #{selectedOrder.id}</h3>
            <span style={{ fontSize: 11, color: crmTheme.textSecondary }}>{selectedOrder.createdAt} • {selectedOrder.clientName}</span>
            <div style={{ margin: '18px 0', borderTop: `1px solid ${crmTheme.border}`, paddingTop: 14 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Itens do Pedido</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedOrder.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: crmTheme.bg, padding: '8px 12px', borderRadius: 8, border: `1px solid ${crmTheme.border}` }}>
                    <span style={{ fontSize: 12, color: crmTheme.textPrimary }}>{item.quantity}× {item.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: crmTheme.textPrimary, flexShrink: 0 }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Endereço de Entrega</label>
              <p style={{ fontSize: 12, color: crmTheme.textSecondary, margin: 0, lineHeight: 1.5 }}>{selectedOrder.address}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: crmTheme.primaryLight, border: `1px solid ${crmTheme.primary}`, padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: crmTheme.primary }}>Total do Pedido</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: crmTheme.primary }}>R$ {selectedOrder.total.toFixed(2)}</span>
            </div>
            <label style={labelStyle}>Atualizar Status</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {(['Pendente', 'Aprovado', 'Saiu para Entrega', 'Entregue'] as Order['status'][]).map(s => {
                const sc = STATUS_CONFIG[s] || { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' }; const active = selectedOrder.status === s;
                return <button key={s} onClick={() => updateOrderStatus(selectedOrder.id, s)} style={{ height: 38, background: active ? sc.bg : crmTheme.bg, border: `1px solid ${active ? sc.border : crmTheme.border}`, borderRadius: 10, color: active ? sc.color : crmTheme.textSecondary, fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>{s}</button>;
              })}
            </div>
          </div>
        </div>
      )}


      {/* ═══ MODAL: AWARD DIAMONDS ════════════════════════════════════════════ */}
      {isAwardModalOpen && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: crmTheme.cardBg, border: `1.5px solid ${crmTheme.border}`, borderRadius: 22, width: '100%', maxWidth: 380, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', position: 'relative' }}>
            <button onClick={() => setIsAwardModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: crmTheme.bg, border: `1px solid ${crmTheme.border}`, width: 30, height: 30, borderRadius: 8, color: crmTheme.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💎</div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: crmTheme.textPrimary, margin: '0 0 4px' }}>Conceder Diamantes</h3>
              <p style={{ fontSize: 12, color: crmTheme.textSecondary, margin: 0 }}>Para: <strong style={{ color: crmTheme.success }}>{selectedClient.name}</strong></p>
              <p style={{ fontSize: 11, color: crmTheme.textMuted, margin: '4px 0 0' }}>Saldo atual: 💎 {selectedClient.diamonds ?? 0}</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Quantidade de Diamantes</label>
              <input type="number" value={awardAmount} onChange={e => setAwardAmount(e.target.value)} style={{ ...inputStyle, textAlign: 'center', fontSize: 22, fontWeight: 900, height: 52, color: crmTheme.success }} min="1" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setAwardAmount(v.toString())} style={{ height: 34, background: awardAmount === v.toString() ? crmTheme.successLight : crmTheme.bg, border: `1px solid ${awardAmount === v.toString() ? crmTheme.success : crmTheme.border}`, borderRadius: 8, color: awardAmount === v.toString() ? crmTheme.success : crmTheme.textSecondary, fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>+{v}</button>
              ))}
            </div>
            <button onClick={handleAwardDiamonds} style={{ width: '100%', height: 44, background: crmTheme.success, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>Confirmar Premiação 💎</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// Simple stub component for placeholder icon
const ParagraphIcon = ({ size, style }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="4" y1="9" x2="20" y2="9"></line>
    <line x1="4" y1="15" x2="20" y2="15"></line>
    <line x1="10" y1="3" x2="8" y2="21"></line>
    <line x1="16" y1="3" x2="14" y2="21"></line>
  </svg>
);

export default Admin;
