import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import {
  Gem, ShoppingBag, Users, TrendingUp, Plus, Edit2, Trash2, Power,
  Store, Search, Filter, Award, X, Package, BarChart2, ChevronDown,
  CheckCircle, Clock, Truck, AlertCircle, Shield, Ban, RefreshCw,
  Star, Zap, ArrowUp, ArrowDown, Eye, EyeOff, DollarSign, Upload,
  ChevronRight, ChevronLeft, Percent, Target
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { collection, getDocs, doc, updateDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
type TabType = 'dashboard' | 'produtos' | 'pedidos' | 'clientes' | 'analytics' | 'roleta' | 'financeiro';
type WizardStep = 1 | 2 | 3 | 4 | 5;
type ImageMode = 'url' | 'upload' | 'gallery';

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

const calcSuggestedPrice = (costPrice: number, diamonds: number = 0, targetPct: number = 35): number => {
  if (!costPrice || costPrice <= 0) return 0;
  const eff = costPrice + calcDiamondCost(diamonds);
  return eff / (1 - targetPct / 100);
};

const getMarginStatus = (margin: number | null) => {
  if (margin === null) return null;
  if (margin < 0)   return { label: '⛔ PREJUÍZO',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)' };
  if (margin < 15)  return { label: '🔴 Risco Alto',  color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.4)' };
  if (margin < 30)  return { label: '🟡 Aceitável',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)' };
  return                   { label: '🟢 Saudável',    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.4)' };
};

// ─── KNOWN IMAGES (quick gallery) ────────────────────────────────────────────
const GALLERY_IMAGES = [
  { src: '/heineken.png',        label: 'Heineken' },
  { src: '/coca_cola_zero.png',  label: 'Coca-Cola Zero' },
  { src: '/monster_energy.webp', label: 'Monster Energy' },
  { src: '/spaten.webp',         label: 'Spaten' },
];

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

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'Pendente':          { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  icon: Clock },
  'Aprovado':          { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.25)',  icon: CheckCircle },
  'Saiu para Entrega': { color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.25)', icon: Truck },
  'Entregue':          { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)',  icon: CheckCircle },
};

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) return (
    <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ color: '#FFDF73', fontWeight: 900, fontSize: 12, margin: '0 0 4px' }}>{label}</p>
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
const StatCard = ({ label, value, sub, icon: Icon, iconColor, trend, gold }: any) => (
  <div style={{
    background: gold ? 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.04) 100%)' : 'rgba(15,23,42,0.5)',
    border: `1px solid ${gold ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.07)'}`,
    borderRadius: 18, padding: '18px 16px', position: 'relative', overflow: 'hidden',
    boxShadow: gold ? '0 4px 20px rgba(212,175,55,0.1)' : 'none',
  }}>
    <div style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 8, background: `${iconColor}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={16} color={iconColor} />
    </div>
    <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    <h3 style={{ fontSize: 22, fontWeight: 900, color: gold ? '#FFDF73' : '#fff', margin: '6px 0 4px', letterSpacing: -0.5 }}>{value}</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {trend !== undefined && (trend >= 0 ? <ArrowUp size={10} color="#10b981" /> : <ArrowDown size={10} color="#ef4444" />)}
      <span style={{ fontSize: 9.5, fontWeight: 700, color: sub?.startsWith('⚡') || sub?.startsWith('💎') ? '#10b981' : 'rgba(255,255,255,0.4)' }}>{sub}</span>
    </div>
  </div>
);

// ─── IMAGE COMPRESS ───────────────────────────────────────────────────────────
const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 420;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── WIZARD STEPS META ────────────────────────────────────────────────────────
const WIZARD_META: { step: WizardStep; label: string; emoji: string }[] = [
  { step: 1, label: 'Produto',  emoji: '📦' },
  { step: 2, label: 'Preço',    emoji: '💰' },
  { step: 3, label: 'Estoque',  emoji: '🎮' },
  { step: 4, label: 'Promoção', emoji: '🎁' },
  { step: 5, label: 'Resumo',   emoji: '✅' },
];

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
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // Step 1 — Produto
  const [prodTitle, setProdTitle] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodCategory, setProdCategory] = useState('Bebidas');
  const [prodImage, setProdImage] = useState('');
  const [prodTags, setProdTags] = useState('');
  const [prodBadge, setProdBadge] = useState('');
  const [prodBadgeStyle, setProdBadgeStyle] = useState<'orange' | 'light'>('orange');
  const [imageMode, setImageMode] = useState<ImageMode>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Step 2 — Preço & Diamantes
  const [prodCostPrice, setProdCostPrice] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDiamondReward, setProdDiamondReward] = useState('');
  const [targetMargin, setTargetMargin] = useState('35');

  // Step 3 — Estoque
  const [prodStock, setProdStock] = useState('');
  const [prodMinStock, setProdMinStock] = useState('');

  // Step 4 — Promoção
  const [prodPromoActive, setProdPromoActive] = useState(false);
  const [prodPromoDiscount, setProdPromoDiscount] = useState('');
  const [prodPromoExpiry, setProdPromoExpiry] = useState('');
  const [prodComboProductId, setProdComboProductId] = useState('');
  const [prodComboDiscount, setProdComboDiscount] = useState('');
  const [prodMinQtyForDiscount, setProdMinQtyForDiscount] = useState('');
  const [prodAvailableInRoulette, setProdAvailableInRoulette] = useState(false);

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

  // ─── Load from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    const storedProducts = localStorage.getItem('app-products');
    if (storedProducts) {
      setProducts(JSON.parse(storedProducts));
    } else {
      const defaults: Product[] = [
        { id: 'heineken-330ml', title: 'Cerveja Heineken Long Neck (330ml)', price: 7.90, costPrice: 4.80, image: '/heineken.png', category: 'Bebidas', badge: 'Trincando', badgeStyle: 'orange', diamondReward: 2, active: true, stock: 48, minStock: 10 },
        { id: 'coca-cola-350ml', title: 'Refrigerante Coca-Cola Sem Açúcar Lata (350ml)', price: 4.50, costPrice: 2.70, image: '/coca_cola_zero.png', category: 'Bebidas', diamondReward: 1, active: true, stock: 120, minStock: 20 },
        { id: 'monster-energy', title: 'Energético Monster Energy Tradicional (473ml)', price: 9.90, costPrice: 6.20, image: '/monster_energy.webp', category: 'Bebidas', badge: 'Mais Vendido', badgeStyle: 'orange', diamondReward: 3, active: true, stock: 32, minStock: 8 },
        { id: 'spaten-350ml', title: 'Cerveja Spaten Puro Malte Lata (350ml)', price: 5.20, costPrice: 3.10, image: '/spaten.webp', category: 'Bebidas', diamondReward: 1, active: true, stock: 60, minStock: 15 },
        { id: 'marlboro-gold', title: 'Cigarro Marlboro Gold Box (20un)', price: 13.50, costPrice: 8.90, image: 'https://images.unsplash.com/photo-1627140469085-fcd84814df2a?q=80&w=600', category: 'Tabacaria', badge: 'Mais Vendido', badgeStyle: 'orange', diamondReward: 2, active: true, stock: 85, minStock: 20 },
        { id: 'ignite-v50', title: 'Vape Pod Ignite V50 Mentol (5000 Puffs)', price: 89.90, costPrice: 52.00, image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=600', category: 'Tabacaria', badge: 'Premium', badgeStyle: 'orange', diamondReward: 10, active: true, stock: 15, minStock: 3 },
        { id: 'fone-bluetooth', title: 'Fone de Ouvido Bluetooth JBL Wave Flex', price: 289.90, costPrice: 180.00, image: 'https://images.unsplash.com/photo-1608156639585-b3a032ef9689?q=80&w=600', category: 'Eletrônicos', badge: 'Frete Grátis', badgeStyle: 'light', diamondReward: 40, active: true, stock: 8, minStock: 2 },
        { id: 'carregador-turbo', title: 'Carregador de Tomada Turbo Anker 20W USB-C', price: 79.90, costPrice: 45.00, image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600', category: 'Eletrônicos', diamondReward: 8, active: true, stock: 22, minStock: 5 },
      ];
      localStorage.setItem('app-products', JSON.stringify(defaults));
      setProducts(defaults);
    }

    const storedOrders = localStorage.getItem('app-orders');
    if (storedOrders) {
      setOrders(JSON.parse(storedOrders));
    } else {
      const now = Date.now();
      const fmt = (ts: number) => new Date(ts).toLocaleDateString('pt-BR') + ' ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const defaults: Order[] = [
        { id: 'ped-1002', clientName: 'Moisés Alves', clientEmail: 'moises@exemplo.com', items: [{ id: 'heineken-330ml', title: 'Cerveja Heineken Long Neck (330ml)', price: 7.90, quantity: 4 }, { id: 'monster-energy', title: 'Energético Monster Energy (473ml)', price: 9.90, quantity: 2 }], total: 51.40, status: 'Aprovado', createdAt: fmt(now - 7200000), address: 'Rua das Palmeiras, 105 - Centro, Blumenau - SC' },
        { id: 'ped-1003', clientName: 'Ana Silva', clientEmail: 'ana@exemplo.com', items: [{ id: 'ignite-v50', title: 'Vape Pod Ignite V50 Mentol', price: 89.90, quantity: 1 }], total: 89.90, status: 'Pendente', createdAt: fmt(now - 600000), address: 'Av. Beira Rio, 450, Ap 402 - Centro, Blumenau - SC' },
        { id: 'ped-1001', clientName: 'Carlos Souza', clientEmail: 'carlos@exemplo.com', items: [{ id: 'fone-bluetooth', title: 'Fone Bluetooth JBL Wave Flex', price: 289.90, quantity: 1 }, { id: 'coca-cola-350ml', title: 'Coca-Cola Zero Lata', price: 4.50, quantity: 3 }], total: 303.40, status: 'Entregue', createdAt: fmt(now - 86400000), address: 'Rua Joinville, 88 - Vila Nova, Blumenau - SC' },
        { id: 'ped-1004', clientName: 'Beatriz Santos', clientEmail: 'bea@exemplo.com', items: [{ id: 'marlboro-gold', title: 'Cigarro Marlboro Gold Box', price: 13.50, quantity: 3 }], total: 40.50, status: 'Saiu para Entrega', createdAt: fmt(now - 3600000), address: 'Rua XV de Novembro, 200 - Centro, Blumenau - SC' },
      ];
      localStorage.setItem('app-orders', JSON.stringify(defaults));
      setOrders(defaults);
    }
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

  // ─── Persist ──────────────────────────────────────────────────────────────
  const saveProducts = (p: Product[]) => {
    localStorage.setItem('app-products', JSON.stringify(p));
    setProducts(p);
    window.dispatchEvent(new Event('app-products-updated'));
  };
  const saveOrders = (o: Order[]) => { localStorage.setItem('app-orders', JSON.stringify(o)); setOrders(o); };
  const handleLogout = async () => { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } };

  // ─── Image Upload ─────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const compressed = await compressImage(file);
      setProdImage(compressed);
    } catch { alert('Erro ao processar imagem.'); }
    finally { setUploadingImg(false); }
  };

  // ─── Wizard helpers ───────────────────────────────────────────────────────
  const resetWizard = () => {
    setWizardStep(1);
    setProdTitle(''); setProdDescription(''); setProdCategory('Bebidas');
    setProdImage(''); setProdTags(''); setProdBadge(''); setProdBadgeStyle('orange');
    setImageMode('url');
    setProdCostPrice(''); setProdPrice(''); setProdDiamondReward(''); setTargetMargin('35');
    setProdStock(''); setProdMinStock('');
    setProdPromoActive(false); setProdPromoDiscount(''); setProdPromoExpiry('');
    setProdComboProductId(''); setProdComboDiscount(''); setProdMinQtyForDiscount('');
    setProdAvailableInRoulette(false);
  };

  const openAddModal = () => { setEditingProduct(null); resetWizard(); setIsProductModalOpen(true); };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setWizardStep(1);
    setProdTitle(p.title); setProdDescription(p.description || '');
    setProdCategory(p.category); setProdImage(p.image); setProdTags(p.tags || '');
    setProdBadge(p.badge || ''); setProdBadgeStyle(p.badgeStyle || 'orange');
    setImageMode(p.image.startsWith('data:') ? 'upload' : 'url');
    setProdCostPrice(p.costPrice?.toString() || ''); setProdPrice(p.price.toString());
    setProdDiamondReward(p.diamondReward?.toString() || ''); setTargetMargin('35');
    setProdStock(p.stock?.toString() || ''); setProdMinStock(p.minStock?.toString() || '');
    setProdPromoActive(p.promoActive || false); setProdPromoDiscount(p.promoDiscount?.toString() || '');
    setProdPromoExpiry(p.promoExpiry || ''); setProdComboProductId(p.comboProductId || '');
    setProdComboDiscount(p.comboDiscount?.toString() || ''); setProdMinQtyForDiscount(p.minQtyForDiscount?.toString() || '');
    setProdAvailableInRoulette(p.availableInRoulette || false);
    setIsProductModalOpen(true);
  };

  const canAdvanceStep = (): { ok: boolean; msg?: string } => {
    if (wizardStep === 1) {
      if (!prodTitle.trim()) return { ok: false, msg: 'Nome do produto é obrigatório.' };
      if (!prodImage.trim()) return { ok: false, msg: 'Imagem é obrigatória.' };
      return { ok: true };
    }
    if (wizardStep === 2) {
      const price = parseFloat(prodPrice);
      if (!prodPrice || isNaN(price) || price <= 0) return { ok: false, msg: 'Preço de venda inválido.' };
      if (prodCostPrice) {
        const cost = parseFloat(prodCostPrice);
        const diamonds = parseInt(prodDiamondReward) || 0;
        const margin = calcRealMargin(price, cost, diamonds);
        if (margin !== null && margin < 0) return { ok: false, msg: '⛔ Margem negativa: o produto seria vendido com PREJUÍZO. Ajuste o preço.' };
      }
      return { ok: true };
    }
    return { ok: true };
  };

  const handleSaveProduct = () => {
    const price = parseFloat(prodPrice);
    if (!prodTitle || !prodPrice || !prodImage || isNaN(price) || price <= 0) { alert('Preencha nome, imagem e preço.'); return; }
    const costPrice = prodCostPrice ? parseFloat(prodCostPrice) : undefined;
    const diamonds = prodDiamondReward ? parseInt(prodDiamondReward) : undefined;
    if (costPrice && diamonds !== undefined) {
      const margin = calcRealMargin(price, costPrice, diamonds);
      if (margin !== null && margin < 0) { alert('⛔ Não é possível salvar um produto com prejuízo. Ajuste o preço.'); return; }
    }
    const data: Omit<Product, 'id'> = {
      title: prodTitle, description: prodDescription || undefined, price, costPrice,
      image: prodImage, category: prodCategory, badge: prodBadge || undefined, badgeStyle: prodBadgeStyle,
      diamondReward: diamonds, active: editingProduct?.active ?? true,
      stock: prodStock ? parseInt(prodStock) : undefined, minStock: prodMinStock ? parseInt(prodMinStock) : undefined,
      tags: prodTags || undefined, promoActive: prodPromoActive,
      promoDiscount: prodPromoDiscount ? parseFloat(prodPromoDiscount) : undefined,
      promoExpiry: prodPromoExpiry || undefined, comboProductId: prodComboProductId || undefined,
      comboDiscount: prodComboDiscount ? parseFloat(prodComboDiscount) : undefined,
      availableInRoulette: prodAvailableInRoulette,
      minQtyForDiscount: prodMinQtyForDiscount ? parseInt(prodMinQtyForDiscount) : undefined,
    };
    if (editingProduct) {
      saveProducts(products.map(p => p.id === editingProduct.id ? { id: editingProduct.id, ...data } : p));
    } else {
      saveProducts([...products, { id: 'prod-' + Date.now(), ...data }]);
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id: string) => { if (window.confirm('Excluir produto?')) saveProducts(products.filter(p => p.id !== id)); };
  const toggleProductActive = (id: string) => saveProducts(products.map(p => p.id === id ? { ...p, active: !p.active } : p));
  const updateOrderStatus = (id: string, status: Order['status']) => {
    const updated = orders.map(o => o.id === id ? { ...o, status } : o);
    saveOrders(updated);
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
    const colors = ['#D4AF37', '#1E150F', '#E25C1D', '#5B21B6', '#059669'];
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

  // Wizard live calcs
  const wizPrice = parseFloat(prodPrice) || 0;
  const wizCost = parseFloat(prodCostPrice) || 0;
  const wizDiamonds = parseInt(prodDiamondReward) || 0;
  const wizDiamondCost = calcDiamondCost(wizDiamonds);
  const wizMargin = calcRealMargin(wizPrice, wizCost, wizDiamonds);
  const wizMarginStatus = getMarginStatus(wizMargin);
  const wizProfitUnit = wizPrice > 0 && wizCost > 0 ? wizPrice - wizCost - wizDiamondCost : 0;

  // ─── Styles ───────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '40px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    paddingLeft: 12, paddingRight: 12, color: '#fff', fontSize: 13,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Manrope, sans-serif',
  };
  const labelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 };
  const sectionCard: React.CSSProperties = { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' };

  const TABS: { key: TabType; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'dashboard',  label: 'Dashboard',  icon: TrendingUp },
    { key: 'produtos',   label: 'Produtos',   icon: Package },
    { key: 'pedidos',    label: 'Pedidos',    icon: ShoppingBag, badge: pendingCount },
    { key: 'clientes',   label: 'Clientes',   icon: Users },
    { key: 'analytics',  label: 'Analytics',  icon: BarChart2 },
    { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { key: 'roleta',     label: 'Roleta',     icon: RefreshCw },
  ];

  // ═══════ RENDER ═══════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #020617 0%, #0b0f19 60%, #020617 100%)', color: '#fff', fontFamily: 'Manrope, sans-serif', paddingBottom: 60 }}>
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)', top: '-10%', right: '-5%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 70%)', bottom: '10%', left: '-5%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(212,175,55,0.18)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(212,175,55,0.4)' }}>
            <Gem size={18} color="#000" />
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: 0 }}>Painel Administrativo</h1>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: 1 }}>Mercado Nosso Jeito • CRM Pro</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 8, color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>
            <Store size={13} color="#FFDF73" /><span>Ver Loja</span>
          </Link>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}>
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
                background: active ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'rgba(15,23,42,0.5)',
                border: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, color: active ? '#000' : 'rgba(255,255,255,0.55)',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.25s ease', position: 'relative', fontFamily: 'Manrope, sans-serif',
              }}>
                <Icon size={13} /><span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 900, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══ TAB: DASHBOARD ══════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Faturamento" value={`R$ ${totalRevenue.toFixed(2)}`} sub="⚡ Pedidos aprovados" icon={TrendingUp} iconColor="#D4AF37" gold trend={12} />
              <StatCard label="Pedidos Totais" value={orders.length} sub={`${pendingCount} pendentes`} icon={ShoppingBag} iconColor="#0ea5e9" trend={5} />
              <StatCard label="Ticket Médio" value={`R$ ${avgTicket.toFixed(2)}`} sub="Por pedido aprovado" icon={Zap} iconColor="#10b981" trend={3} />
              <StatCard label="Produtos" value={products.length} sub={`${products.filter(p => p.active !== false).length} ativos`} icon={Package} iconColor="#818cf8" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={15} color="#D4AF37" /> Vendas da Semana</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `R$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="vendas" stroke="#D4AF37" strokeWidth={2.5} dot={{ fill: '#D4AF37', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} name="vendas" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={15} color="#818cf8" /> Vendas por Categoria</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart><Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>{categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie></PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {categoryData.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{c.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>{c.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={15} color="#f59e0b" /> Pedidos Aguardando Ação</h3>
                <button onClick={() => setActiveTab('pedidos')} style={{ background: 'none', border: 'none', color: '#FFDF73', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>Ver todos <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>✅ Nenhum pedido pendente.</div>
                ) : orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').map(order => {
                  const sc = STATUS_CONFIG[order.status];
                  return (
                    <div key={order.id} onClick={() => { setSelectedOrder(order); setActiveTab('pedidos'); }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{order.clientName}</span>
                          <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{order.status}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{order.createdAt}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#FFDF73' }}>R$ {order.total.toFixed(2)}</span>
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
                <Search size={13} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Buscar produto..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0 10px', height: 40 }}>
                  <Filter size={12} color="#FFDF73" style={{ marginRight: 6 }} />
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                    {['Todos', 'Bebidas', 'Tabacaria', 'Eletrônicos', 'Limpeza', 'Alimentos'].map(c => <option key={c} value={c} style={{ background: '#0f172a' }}>{c}</option>)}
                  </select>
                </div>
                <button onClick={openAddModal} style={{ height: 40, background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 900, fontSize: 12, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                  <Plus size={14} /> Cadastrar
                </button>
              </div>
            </div>
            <div style={{ ...sectionCard, padding: '8px 0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Produto', 'Preço', 'Margem', 'Estoque', 'Categoria', 'Status', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', textAlign: h === 'Ações' ? 'center' : 'left', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const margin = p.costPrice ? calcRealMargin(p.price, p.costPrice, p.diamondReward) : null;
                    const ms = getMarginStatus(margin);
                    const stockLow = p.minStock && p.stock !== undefined && p.stock <= p.minStock;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: p.active === false ? 0.45 : 1 }}>
                        <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src={p.image} alt={p.title} style={{ width: 40, height: 40, objectFit: 'contain', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{p.title}</div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                              {p.badge && <span style={{ fontSize: 8, fontWeight: 900, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', padding: '1px 5px', borderRadius: 99 }}>{p.badge}</span>}
                              {p.promoActive && <span style={{ fontSize: 8, fontWeight: 900, background: 'rgba(236,72,153,0.1)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.2)', padding: '1px 5px', borderRadius: 99 }}>PROMO</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#FFDF73' }}>R$ {p.price.toFixed(2)}</div>
                          {p.costPrice && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>custo R${p.costPrice.toFixed(2)}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {ms ? (
                            <span style={{ fontSize: 10, fontWeight: 900, color: ms.color, background: ms.bg, border: `1px solid ${ms.border}`, padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                              {margin!.toFixed(1)}% {ms.label.split(' ')[0]}
                            </span>
                          ) : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: stockLow ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>{p.stock ?? '—'}</span>
                          {stockLow && <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 900 }}>⚠️ BAIXO</div>}
                          {p.diamondReward && <div style={{ fontSize: 9, color: '#10b981', fontWeight: 800 }}>💎 +{p.diamondReward}</div>}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{p.category}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button onClick={() => toggleProductActive(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: p.active !== false ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${p.active !== false ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 99, padding: '3px 10px', cursor: 'pointer', color: p.active !== false ? '#10b981' : '#ef4444', fontSize: 10, fontWeight: 900 }}>
                            {p.active !== false ? <><Eye size={10} />Ativo</> : <><EyeOff size={10} />Inativo</>}
                          </button>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button onClick={() => openEditModal(p)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFDF73', cursor: 'pointer' }}><Edit2 size={12} /></button>
                            <button onClick={() => handleDeleteProduct(p.id)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum produto encontrado.</td></tr>}
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
                  background: orderFilter === f ? (f === 'Todos' ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.bg || 'rgba(255,255,255,0.06)') : 'rgba(255,255,255,0.04)',
                  color: orderFilter === f ? (f === 'Todos' ? '#000' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.color || '#fff') : 'rgba(255,255,255,0.5)',
                  border: orderFilter === f ? (f === 'Todos' ? 'none' : `1px solid ${STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.border || 'transparent'}`) : '1px solid rgba(255,255,255,0.07)',
                }}>
                  {f === 'Todos' ? `Todos (${orders.length})` : `${f} (${orders.filter(o => o.status === f).length})`}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredOrders.map(order => {
                const sc = STATUS_CONFIG[order.status]; const Icon = sc.icon;
                return (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} style={{ background: selectedOrder?.id === order.id ? 'rgba(212,175,55,0.06)' : 'rgba(15,23,42,0.5)', border: selectedOrder?.id === order.id ? '1.5px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, cursor: 'pointer', transition: 'all 0.25s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 900, color: '#fff' }}>{order.clientName}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#FFDF73' }}>#{order.id}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{order.createdAt}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#FFDF73' }}>R$ {order.total.toFixed(2)}</span>
                        <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icon size={10} />{order.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {order.items.map(item => (
                        <span key={item.id} style={{ fontSize: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                          {item.quantity}× {item.title.split(' ').slice(0, 3).join(' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredOrders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Nenhum pedido encontrado.</div>}
            </div>
          </div>
        )}

        {/* ══ TAB: CLIENTES ════════════════════════════════════════════════════ */}
        {activeTab === 'clientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* VIP Legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ label: 'Bronze', emoji: '🥉', min: '0', max: '99' }, { label: 'Prata', emoji: '🥈', min: '100', max: '499' }, { label: 'Ouro', emoji: '🥇', min: '500', max: '999' }, { label: 'Diamante', emoji: '💎', min: '1.000', max: '4.999' }, { label: 'Black', emoji: '⬛', min: '5.000', max: '+' }].map(v => (
                <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '5px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>
                  <span>{v.emoji}</span><span>{v.label}</span><span style={{ color: 'rgba(255,255,255,0.3)' }}>💎{v.min}–{v.max}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={13} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>
              <button onClick={fetchClients} style={{ height: 40, padding: '0 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Manrope, sans-serif' }}>
                <RefreshCw size={13} color="#D4AF37" /> Atualizar
              </button>
            </div>
            {loadingClients ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Carregando clientes...</div>
            ) : filteredClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum cliente cadastrado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredClients.map(client => {
                  const vip = getVipLevel(client.diamonds);
                  return (
                    <div key={client.id} style={{ background: 'rgba(15,23,42,0.5)', border: `1px solid ${client.role === 'admin' ? 'rgba(212,175,55,0.3)' : client.role === 'banned' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg, ${vip.color}33, ${vip.color}11)`, border: `1.5px solid ${vip.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {vip.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 99, background: vip.bg, color: vip.color, border: `1px solid ${vip.border}`, flexShrink: 0 }}>{vip.emoji} {vip.label}</span>
                          {client.role === 'admin' && <span style={{ fontSize: 8, fontWeight: 900, background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', padding: '2px 7px', borderRadius: 99 }}>ADMIN</span>}
                          {client.role === 'banned' && <span style={{ fontSize: 8, fontWeight: 900, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', padding: '2px 7px', borderRadius: 99 }}>BANIDO</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</div>
                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 800, marginTop: 2 }}>💎 {client.diamonds ?? 0} diamantes</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setSelectedClient(client); setAwardAmount('50'); setIsAwardModalOpen(true); }} style={{ height: 32, padding: '0 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, color: '#10b981', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Gem size={11} /> +💎
                        </button>
                        {client.role !== 'admin' && <button onClick={() => promoteToAdmin(client)} style={{ height: 32, padding: '0 10px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, color: '#D4AF37', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={11} /></button>}
                        {client.role !== 'banned' && <button onClick={() => banClient(client)} style={{ height: 32, padding: '0 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#ef4444', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}><Ban size={11} /></button>}
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
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={15} color="#D4AF37" /> Receita Mensal (6 meses)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="mes" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `R$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="receita" stroke="#D4AF37" strokeWidth={2.5} dot={{ fill: '#D4AF37', r: 4, strokeWidth: 0 }} name="receita" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Melhor Dia" value="Sábado" sub="R$ 1.650 em vendas" icon={Star} iconColor="#f59e0b" />
              <StatCard label="Categoria Top" value="Bebidas" sub="42% das vendas" icon={TrendingUp} iconColor="#818cf8" />
              <StatCard label="Pedido Máximo" value="R$ 303,40" sub="Carlos Souza" icon={Award} iconColor="#10b981" />
              <StatCard label="Taxa Entrega" value="100%" sub="Frete grátis ativo" icon={Truck} iconColor="#0ea5e9" />
            </div>
          </div>
        )}

        {/* ══ TAB: FINANCEIRO ═════════════════════════════════════════════════ */}
        {activeTab === 'financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Margem Média" value={`${avgMarginPct.toFixed(1)}%`} sub={`${productsWithCost.length} produtos c/ custo`} icon={Percent} iconColor={avgMarginPct >= 30 ? '#10b981' : avgMarginPct >= 15 ? '#f59e0b' : '#ef4444'} gold={avgMarginPct >= 30} trend={avgMarginPct >= 15 ? 1 : -1} />
              <StatCard label="Em Risco" value={riskProducts.length} sub="Margem abaixo de 15%" icon={AlertCircle} iconColor="#ef4444" trend={riskProducts.length > 0 ? -1 : 1} />
              <StatCard label="Maior Lucro/un" value={productWithMargin.length > 0 ? `R$ ${productWithMargin[0].profitUnit.toFixed(2)}` : '—'} sub={productWithMargin.length > 0 ? productWithMargin[0].title.split(' ').slice(0, 2).join(' ') : ''} icon={TrendingUp} iconColor="#10b981" />
              <StatCard label="Custo 💎/mês" value={`R$ ${products.reduce((s, p) => s + (p.diamondReward ?? 0) * DIAMOND_VALUE * simUnits, 0).toFixed(2)}`} sub={`${simUnits} un/produto/mês`} icon={Gem} iconColor="#818cf8" />
            </div>

            {/* Simulator */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}><Target size={15} color="#818cf8" /> Simulador de Lucro Mensal</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <label style={labelStyle}>Vendas/produto/mês:</label>
                <input type="number" value={finSimUnits} onChange={e => setFinSimUnits(e.target.value)} style={{ ...inputStyle, width: 80, textAlign: 'center' }} min="1" />
                <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, padding: '10px 20px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>LUCRO ESTIMADO/MÊS</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: simMonthlyProfit >= 0 ? '#FFDF73' : '#ef4444' }}>R$ {simMonthlyProfit.toFixed(2)}</div>
                </div>
              </div>
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', margin: 0 }}>* Baseado em {productsWithCost.length} produtos com preço de custo cadastrado. Inclui desconto de diamantes (1💎 = R$0,01).</p>
            </div>

            {/* Margin bar chart */}
            {marginBarData.length > 0 && (
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={15} color="#818cf8" /> Margem Real por Produto</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={marginBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} domain={[0, 60]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 9 }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`${v}%`, 'Margem']} />
                    <Bar dataKey="margem" radius={[0, 6, 6, 0]}>
                      {marginBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                  {[{ c: '#10b981', l: '≥30% Saudável' }, { c: '#f59e0b', l: '15-29% Aceitável' }, { c: '#ef4444', l: '<15% Risco' }].map(x => (
                    <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />{x.l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk table */}
            {riskProducts.length > 0 && (
              <div style={{ ...sectionCard, border: '1px solid rgba(239,68,68,0.25)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#ef4444', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={15} /> Produtos em Risco de Prejuízo</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {riskProducts.map(p => {
                    const margin = calcRealMargin(p.price, p.costPrice!, p.diamondReward);
                    const ms = getMarginStatus(margin)!;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{p.title}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Venda: R${p.price.toFixed(2)} | Custo: R${p.costPrice!.toFixed(2)} | 💎×{p.diamondReward ?? 0} (R${calcDiamondCost(p.diamondReward ?? 0).toFixed(2)})</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: ms.color }}>{margin!.toFixed(1)}%</span>
                          <button onClick={() => openEditModal(p)} style={{ display: 'block', marginTop: 4, fontSize: 9, fontWeight: 900, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '2px 8px', color: '#ef4444', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>Corrigir →</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {productsWithCost.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.3)' }}>
                <DollarSign size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
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
                <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={15} color="#D4AF37" /> Configurar Roleta de Prêmios</h3>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '4px 0 0' }}>Configure os prêmios. Salve para persistir no Firestore.</p>
              </div>
              <button onClick={handleSaveRoulette} disabled={savingRoulette || loadingRoulette} style={{ background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', color: '#000', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Manrope, sans-serif' }}>
                {savingRoulette ? 'Salvando...' : '💾 Salvar na Nuvem'}
              </button>
            </div>
            {loadingRoulette ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>Carregando...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: 10, borderRadius: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" value={newRouletteText} onChange={e => setNewRouletteText(e.target.value)} placeholder="Novo prêmio (Ex: 20 Diamantes 💎)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} onKeyDown={e => e.key === 'Enter' && handleAddRouletteItem()} />
                  <select value="" onChange={e => e.target.value && setNewRouletteText(e.target.value)} style={{ ...inputStyle, width: 200, cursor: 'pointer' }}>
                    <option value="" style={{ background: '#0f172a' }}>Vincular Produto...</option>
                    {products.map(p => <option key={p.id} value={p.title} style={{ background: '#0f172a' }}>{p.title}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>Prob.:</span>
                    <input type="number" min="0" max="100" value={newRouletteProbability} onChange={e => setNewRouletteProbability(e.target.value)} placeholder="%" style={{ ...inputStyle, width: 60, textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>%</span>
                  </div>
                  <button onClick={handleAddRouletteItem} style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', color: '#FFDF73', padding: '0 18px', height: 40, borderRadius: 10, fontSize: 12, fontWeight: 850, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>Adicionar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'grid', gridTemplateColumns: '1fr 140px 100px 110px', padding: '0 12px' }}>
                    <span>Texto</span><span>Cor</span><span>Prob.(%)</span><span style={{ textAlign: 'right' }}>Ações</span>
                  </div>
                  {rouletteItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Nenhum item. Adicione prêmios acima.</div>
                  ) : (
                    <>
                      {rouletteItems.map((item, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 110px', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: 12 }}>
                          <input type="text" value={item.text} onChange={e => setRouletteItems(rouletteItems.map((it, i) => i === index ? { ...it, text: e.target.value } : it))} style={{ ...inputStyle, height: 36, background: 'transparent', border: 'none', padding: 0 }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: item.color, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                            <input type="text" value={item.color} onChange={e => setRouletteItems(rouletteItems.map((it, i) => i === index ? { ...it, color: e.target.value } : it))} style={{ ...inputStyle, height: 32, fontSize: 11, padding: '0 6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }} />
                          </div>
                          <input type="number" min="0" max="100" value={item.probability ?? ''} onChange={e => { const v = parseFloat(e.target.value); setRouletteItems(rouletteItems.map((it, i) => i === index ? { ...it, probability: isNaN(v) ? 0 : v } : it)); }} style={{ ...inputStyle, height: 32, fontSize: 12, padding: '0 6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }} />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                            <button onClick={() => moveRouletteItem(index, 'up')} disabled={index === 0} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: index === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', cursor: index === 0 ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}><ArrowUp size={11} /></button>
                            <button onClick={() => moveRouletteItem(index, 'down')} disabled={index === rouletteItems.length - 1} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: index === rouletteItems.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', cursor: index === rouletteItems.length - 1 ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}><ArrowDown size={11} /></button>
                            <button onClick={() => handleRemoveRouletteItem(index)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', marginTop: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Soma das Probabilidades:</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color: rouletteItems.reduce((a, i) => a + (i.probability || 0), 0) === 100 ? '#10B981' : '#F59E0B' }}>
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
      </main>

      {/* ═══ MODAL: ORDER DETAIL ══════════════════════════════════════════════ */}
      {selectedOrder && activeTab === 'pedidos' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'rgba(10,15,35,0.98)', border: '1.5px solid rgba(212,175,55,0.3)', borderRadius: 22, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 16px 60px rgba(0,0,0,0.9)', position: 'relative' }}>
            <button onClick={() => setSelectedOrder(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 30, height: 30, borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#fff', margin: '0 0 2px' }}>Pedido #{selectedOrder.id}</h3>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{selectedOrder.createdAt} • {selectedOrder.clientName}</span>
            <div style={{ margin: '18px 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Itens do Pedido</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedOrder.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{item.quantity}× {item.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Endereço de Entrega</label>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>{selectedOrder.address}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>Total do Pedido</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#FFDF73' }}>R$ {selectedOrder.total.toFixed(2)}</span>
            </div>
            <label style={labelStyle}>Atualizar Status</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {(['Pendente', 'Aprovado', 'Saiu para Entrega', 'Entregue'] as Order['status'][]).map(s => {
                const sc = STATUS_CONFIG[s]; const active = selectedOrder.status === s;
                return <button key={s} onClick={() => updateOrderStatus(selectedOrder.id, s)} style={{ height: 38, background: active ? sc.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? sc.border : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, color: active ? sc.color : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>{s}</button>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: PRODUCT WIZARD ════════════════════════════════════════════ */}
      {isProductModalOpen && (() => {
        const advance = canAdvanceStep();
        const isLast = wizardStep === 5;
        const promoPrice = prodPromoDiscount ? wizPrice * (1 - parseFloat(prodPromoDiscount) / 100) : undefined;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(8px)' }}>
            <div style={{ background: 'linear-gradient(180deg, rgba(10,15,35,0.99) 0%, rgba(5,10,25,0.99) 100%)', border: '1.5px solid rgba(212,175,55,0.25)', borderRadius: 24, width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,0.95)', position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '94vh' }}>
              {/* Modal header */}
              <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>
                      {editingProduct ? '✏️ Editar Produto' : '🚀 Cadastrar Produto'}
                    </h3>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                      {WIZARD_META[wizardStep - 1].emoji} Etapa {wizardStep} de 5 — {WIZARD_META[wizardStep - 1].label}
                    </span>
                  </div>
                  <button onClick={() => setIsProductModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 32, height: 32, borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                </div>
                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                  {WIZARD_META.map((m, i) => (
                    <React.Fragment key={m.step}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => {
                        if (m.step < wizardStep) setWizardStep(m.step);
                      }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: wizardStep === m.step ? 'linear-gradient(135deg,#D4AF37,#FFDF73)' : wizardStep > m.step ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)', border: `2px solid ${wizardStep === m.step ? '#FFDF73' : wizardStep > m.step ? '#10b981' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: wizardStep === m.step ? '#000' : wizardStep > m.step ? '#10b981' : 'rgba(255,255,255,0.4)', transition: 'all 0.3s ease' }}>
                          {wizardStep > m.step ? '✓' : m.step}
                        </div>
                        <span style={{ fontSize: 8, fontWeight: 800, color: wizardStep === m.step ? '#FFDF73' : 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{m.label}</span>
                      </div>
                      {i < WIZARD_META.length - 1 && <div style={{ flex: 1, height: 2, background: wizardStep > m.step ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)', margin: '0 4px', marginBottom: 16, borderRadius: 1 }} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Modal body — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>

                {/* ─── STEP 1: PRODUTO ──────────────────────────────────────────── */}
                {wizardStep === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
                    <div>
                      <label style={labelStyle}>Nome do Produto *</label>
                      <input style={inputStyle} value={prodTitle} onChange={e => setProdTitle(e.target.value)} placeholder="Ex: Cerveja Heineken Long Neck (330ml)" />
                    </div>
                    <div>
                      <label style={labelStyle}>Descrição Curta</label>
                      <textarea value={prodDescription} onChange={e => setProdDescription(e.target.value)} placeholder="Descrição opcional para o cliente..." style={{ ...inputStyle, height: 64, resize: 'vertical', paddingTop: 10, lineHeight: 1.5 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Categoria</label>
                        <select value={prodCategory} onChange={e => setProdCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                          {['Bebidas', 'Tabacaria', 'Eletrônicos', 'Limpeza', 'Alimentos'].map(c => <option key={c} value={c} style={{ background: '#0f172a' }}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Tags (busca)</label>
                        <input style={inputStyle} value={prodTags} onChange={e => setProdTags(e.target.value)} placeholder="gelada, energético..." />
                      </div>
                    </div>

                    {/* IMAGE UPGRADE */}
                    <div>
                      <label style={labelStyle}>Imagem do Produto *</label>
                      {/* Mode tabs */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {([['url', '🔗 URL'], ['upload', '⬆️ Upload'], ['gallery', '🖼️ Galeria']] as [ImageMode, string][]).map(([mode, label]) => (
                          <button key={mode} onClick={() => setImageMode(mode)} style={{ flex: 1, height: 32, border: `1px solid ${imageMode === mode ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, background: imageMode === mode ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)', color: imageMode === mode ? '#FFDF73' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>{label}</button>
                        ))}
                      </div>

                      {imageMode === 'url' && (
                        <input style={inputStyle} value={prodImage.startsWith('data:') ? '' : prodImage} onChange={e => setProdImage(e.target.value)} placeholder="https://... ou /nome-arquivo.png" />
                      )}

                      {imageMode === 'upload' && (
                        <div>
                          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImg} style={{ width: '100%', height: 44, background: 'rgba(212,175,55,0.08)', border: '2px dashed rgba(212,175,55,0.35)', borderRadius: 10, color: '#FFDF73', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Manrope, sans-serif' }}>
                            <Upload size={15} />{uploadingImg ? 'Processando...' : 'Selecionar Arquivo'}
                          </button>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '6px 0 0', textAlign: 'center' }}>JPG, PNG, WebP — comprimido automaticamente para até 420px</p>
                        </div>
                      )}

                      {imageMode === 'gallery' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                          {GALLERY_IMAGES.map(img => (
                            <button key={img.src} onClick={() => setProdImage(img.src)} style={{ background: prodImage === img.src ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${prodImage === img.src ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <img src={img.src} alt={img.label} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{img.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Preview */}
                      {prodImage && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
                          <img src={prodImage} alt="preview" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>✅ Pré-visualização</div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prodImage.startsWith('data:') ? '(arquivo enviado)' : prodImage}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Selo (badge)</label>
                        <input style={inputStyle} value={prodBadge} onChange={e => setProdBadge(e.target.value)} placeholder="Ex: Mais Vendido" />
                      </div>
                      <div>
                        <label style={labelStyle}>Cor do Selo</label>
                        <select value={prodBadgeStyle} onChange={e => setProdBadgeStyle(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer' }}>
                          <option value="orange" style={{ background: '#0f172a' }}>Laranja (Destaque)</option>
                          <option value="light" style={{ background: '#0f172a' }}>Claro (Suave)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 2: PREÇO & DIAMANTES ──────────────────────────────── */}
                {wizardStep === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
                    {/* Info box */}
                    <div style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                      💎 <strong style={{ color: '#818cf8' }}>Regra dos Diamantes:</strong> 1 diamante = R$0,01. O custo dos diamantes é <em>descontado da sua margem de lucro</em>. Defina o valor de venda já incluindo este custo.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Preço de Custo (R$)</label>
                        <input style={inputStyle} type="number" step="0.01" min="0" value={prodCostPrice} onChange={e => setProdCostPrice(e.target.value)} placeholder="0,00" />
                      </div>
                      <div>
                        <label style={labelStyle}>Recompensa 💎</label>
                        <input style={inputStyle} type="number" min="0" value={prodDiamondReward} onChange={e => setProdDiamondReward(e.target.value)} placeholder="Ex: 5" />
                        {wizDiamonds > 0 && <div style={{ fontSize: 9, color: '#818cf8', fontWeight: 800, marginTop: 4 }}>= R${calcDiamondCost(wizDiamonds).toFixed(2)} embutido no preço</div>}
                      </div>
                    </div>

                    {/* Auto-suggest */}
                    {wizCost > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Margem alvo:</span>
                        <input type="number" value={targetMargin} onChange={e => setTargetMargin(e.target.value)} style={{ ...inputStyle, width: 60, height: 34, textAlign: 'center', fontSize: 12 }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>%</span>
                        <button onClick={() => setProdPrice(calcSuggestedPrice(wizCost, wizDiamonds, parseFloat(targetMargin) || 35).toFixed(2))} style={{ height: 34, padding: '0 14px', background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.1))', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 8, color: '#FFDF73', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Zap size={12} /> Auto-sugerir preço
                        </button>
                      </div>
                    )}

                    <div>
                      <label style={labelStyle}>Preço de Venda (R$) *</label>
                      <input style={{ ...inputStyle, fontSize: 18, fontWeight: 900, height: 50, color: '#FFDF73' }} type="number" step="0.01" min="0" value={prodPrice} onChange={e => setProdPrice(e.target.value)} placeholder="0,00" />
                    </div>

                    {/* Margin breakdown */}
                    {wizPrice > 0 && wizCost > 0 && (
                      <div style={{ background: wizMarginStatus ? wizMarginStatus.bg : 'rgba(255,255,255,0.02)', border: `1.5px solid ${wizMarginStatus ? wizMarginStatus.border : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>📊 Análise de Margem</span>
                          {wizMarginStatus && <span style={{ fontSize: 13, fontWeight: 900, color: wizMarginStatus.color, padding: '3px 12px', borderRadius: 99, background: `${wizMarginStatus.color}22`, border: `1px solid ${wizMarginStatus.border}` }}>{wizMarginStatus.label}</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {[
                            ['Preço de venda', `R$ ${wizPrice.toFixed(2)}`, '#fff'],
                            ['(-) Custo do produto', `R$ ${wizCost.toFixed(2)}`, '#ef4444'],
                            ['(-) Custo diamantes', `R$ ${wizDiamondCost.toFixed(2)} (${wizDiamonds}💎 × R$0,01)`, '#818cf8'],
                            ['= Lucro por unidade', `R$ ${wizProfitUnit.toFixed(2)}`, wizProfitUnit >= 0 ? '#10b981' : '#ef4444'],
                          ].map(([label, value, color]) => (
                            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
                              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                              <span style={{ color: color as string }}>{value}</span>
                            </div>
                          ))}
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900 }}>
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Margem Real</span>
                            <span style={{ color: wizMarginStatus?.color || '#fff' }}>{wizMargin !== null ? `${wizMargin.toFixed(1)}%` : '—'}</span>
                          </div>
                        </div>
                        {wizMarginStatus && wizMargin! < 0 && (
                          <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#ef4444', fontWeight: 800 }}>
                            ⛔ ATENÇÃO: Você está vendendo com PREJUÍZO. Aumente o preço de venda antes de avançar.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── STEP 3: ESTOQUE & GAMIFICAÇÃO ─────────────────────────── */}
                {wizardStep === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
                    <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      🎮 <strong style={{ color: '#10b981' }}>Gamificação:</strong> Os diamantes conquistados motivam os clientes a comprarem mais. O custo já foi contabilizado no preço de venda.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Estoque Inicial (un)</label>
                        <input style={inputStyle} type="number" min="0" value={prodStock} onChange={e => setProdStock(e.target.value)} placeholder="0" />
                      </div>
                      <div>
                        <label style={labelStyle}>Estoque Mínimo (alerta)</label>
                        <input style={inputStyle} type="number" min="0" value={prodMinStock} onChange={e => setProdMinStock(e.target.value)} placeholder="5" />
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Alerta ⚠️ quando estoque ≤ este valor</div>
                      </div>
                    </div>

                    {/* Diamond summary */}
                    <div style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 14, padding: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#818cf8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Gem size={14} /> Resumo de Gamificação</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>💎 por compra</span>
                          <span style={{ fontWeight: 900, color: '#fff' }}>{wizDiamonds || 0} diamantes</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Valor para o cliente</span>
                          <span style={{ fontWeight: 900, color: '#10b981' }}>R$ {calcDiamondCost(wizDiamonds).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>% de cashback</span>
                          <span style={{ fontWeight: 900, color: '#818cf8' }}>{wizPrice > 0 ? ((calcDiamondCost(wizDiamonds) / wizPrice) * 100).toFixed(1) : '0'}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Simulation */}
                    {prodStock && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 8 }}>📦 Projeção de Estoque</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                          <span>Receita bruta total:</span>
                          <span style={{ fontWeight: 900, color: '#FFDF73' }}>R$ {(wizPrice * parseInt(prodStock || '0')).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                          <span>Lucro potencial total:</span>
                          <span style={{ fontWeight: 900, color: '#10b981' }}>R$ {(wizProfitUnit * parseInt(prodStock || '0')).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── STEP 4: PROMOÇÃO ───────────────────────────────────────── */}
                {wizardStep === 4 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
                    {/* Promo toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: prodPromoActive ? 'rgba(236,72,153,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${prodPromoActive ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => setProdPromoActive(!prodPromoActive)}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🎁 Ativar Promoção</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Desconto especial por tempo limitado</div>
                      </div>
                      <div style={{ width: 44, height: 24, borderRadius: 12, background: prodPromoActive ? '#ec4899' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'all 0.3s ease', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 3, left: prodPromoActive ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                      </div>
                    </div>

                    {prodPromoActive && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={labelStyle}>Desconto (%)</label>
                            <input style={inputStyle} type="number" min="0" max="99" value={prodPromoDiscount} onChange={e => setProdPromoDiscount(e.target.value)} placeholder="Ex: 15" />
                            {prodPromoDiscount && wizPrice > 0 && <div style={{ fontSize: 9, color: '#ec4899', fontWeight: 800, marginTop: 4 }}>Preço promocional: R${(wizPrice * (1 - parseFloat(prodPromoDiscount) / 100)).toFixed(2)}</div>}
                          </div>
                          <div>
                            <label style={labelStyle}>Validade (data/hora)</label>
                            <input style={inputStyle} type="datetime-local" value={prodPromoExpiry} onChange={e => setProdPromoExpiry(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Qtd mínima para desconto</label>
                          <input style={inputStyle} type="number" min="1" value={prodMinQtyForDiscount} onChange={e => setProdMinQtyForDiscount(e.target.value)} placeholder="Ex: 2 (compre 2 e ganhe desconto)" />
                        </div>
                      </>
                    )}

                    {/* Combo */}
                    <div>
                      <label style={labelStyle}>Produto Combo (opcional)</label>
                      <select value={prodComboProductId} onChange={e => setProdComboProductId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="" style={{ background: '#0f172a' }}>Nenhum combo</option>
                        {products.filter(p => !editingProduct || p.id !== editingProduct.id).map(p => <option key={p.id} value={p.id} style={{ background: '#0f172a' }}>{p.title}</option>)}
                      </select>
                      {prodComboProductId && (
                        <div style={{ marginTop: 8 }}>
                          <label style={labelStyle}>Desconto combo (%)</label>
                          <input style={inputStyle} type="number" min="0" max="99" value={prodComboDiscount} onChange={e => setProdComboDiscount(e.target.value)} placeholder="Ex: 10" />
                        </div>
                      )}
                    </div>

                    {/* Roulette toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: prodAvailableInRoulette ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${prodAvailableInRoulette ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => setProdAvailableInRoulette(!prodAvailableInRoulette)}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🎰 Disponível na Roleta</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Este produto poderá ser premiado na Roleta da Sorte</div>
                      </div>
                      <div style={{ width: 44, height: 24, borderRadius: 12, background: prodAvailableInRoulette ? '#D4AF37' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'all 0.3s ease', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 3, left: prodAvailableInRoulette ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 5: RESUMO ──────────────────────────────────────────── */}
                {wizardStep === 5 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
                    {/* Product card preview */}
                    <div>
                      <label style={labelStyle}>Pré-visualização do Produto</label>
                      <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
                        {prodImage ? <img src={prodImage} alt={prodTitle} style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }} /> : <div style={{ width: 64, height: 64, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Package size={24} color="rgba(255,255,255,0.2)" /></div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                            {prodBadge && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 99, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>{prodBadge}</span>}
                            {prodPromoActive && prodPromoDiscount && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 99, background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.25)' }}>-{prodPromoDiscount}%</span>}
                            {prodAvailableInRoulette && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 99, background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)' }}>🎰 Roleta</span>}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{prodTitle || 'Nome do produto'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            {prodPromoActive && prodPromoDiscount && promoPrice ? (
                              <>
                                <span style={{ fontSize: 15, fontWeight: 900, color: '#FFDF73' }}>R$ {promoPrice.toFixed(2)}</span>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>R$ {wizPrice.toFixed(2)}</span>
                              </>
                            ) : (
                              <span style={{ fontSize: 15, fontWeight: 900, color: '#FFDF73' }}>R$ {wizPrice > 0 ? wizPrice.toFixed(2) : '—'}</span>
                            )}
                            {wizDiamonds > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981' }}>+{wizDiamonds}💎</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign size={14} color="#D4AF37" /> Análise Financeira</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          ['Preço de venda', wizPrice > 0 ? `R$ ${wizPrice.toFixed(2)}` : '—', '#fff'],
                          ['Preço de custo', wizCost > 0 ? `R$ ${wizCost.toFixed(2)}` : 'Não informado', 'rgba(255,255,255,0.5)'],
                          ['Custo em diamantes', wizDiamonds > 0 ? `R$ ${wizDiamondCost.toFixed(2)} (${wizDiamonds} × R$0,01)` : 'R$ 0,00', '#818cf8'],
                          ['Lucro por unidade', wizCost > 0 ? `R$ ${wizProfitUnit.toFixed(2)}` : '—', wizProfitUnit > 0 ? '#10b981' : '#ef4444'],
                        ].map(([label, value, color]) => (
                          <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                            <span style={{ color: color as string }}>{value}</span>
                          </div>
                        ))}
                        {wizMargin !== null && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>Margem Real</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: wizMarginStatus?.color || '#fff', padding: '2px 12px', borderRadius: 99, background: wizMarginStatus?.bg }}>{wizMargin.toFixed(1)}% {wizMarginStatus?.label.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Other info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Categoria</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginTop: 4 }}>{prodCategory}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estoque</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginTop: 4 }}>{prodStock || '—'} un {prodMinStock && `(mín. ${prodMinStock})`}</div>
                      </div>
                    </div>

                    {prodPromoActive && (
                      <div style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#ec4899' }}>🎁 Promoção Ativa</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                          {prodPromoDiscount && `Desconto: ${prodPromoDiscount}%`}
                          {prodPromoExpiry && ` | Até: ${new Date(prodPromoExpiry).toLocaleDateString('pt-BR')}`}
                        </div>
                      </div>
                    )}

                    {wizMarginStatus && wizMargin !== null && wizMargin < 0 && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>⛔ IMPOSSÍVEL SALVAR</div>
                        <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.8)', marginTop: 4 }}>Margem negativa detectada. Volte à Etapa 2 e corrija o preço de venda.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
                {wizardStep > 1 && (
                  <button onClick={() => setWizardStep((wizardStep - 1) as WizardStep)} style={{ height: 44, padding: '0 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Manrope, sans-serif' }}>
                    <ChevronLeft size={15} /> Voltar
                  </button>
                )}
                <div style={{ flex: 1 }} />
                {!isLast ? (
                  <button
                    onClick={() => {
                      const { ok, msg } = canAdvanceStep();
                      if (!ok) { alert(msg); return; }
                      setWizardStep((wizardStep + 1) as WizardStep);
                    }}
                    style={{ height: 44, padding: '0 24px', background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 12, color: '#000', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Manrope, sans-serif', opacity: advance.ok ? 1 : 0.6 }}
                  >
                    Próximo <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    onClick={handleSaveProduct}
                    disabled={wizMargin !== null && wizMargin < 0}
                    style={{ height: 44, padding: '0 28px', background: wizMargin !== null && wizMargin < 0 ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 12, color: wizMargin !== null && wizMargin < 0 ? '#ef4444' : '#000', fontSize: 14, fontWeight: 900, cursor: wizMargin !== null && wizMargin < 0 ? 'not-allowed' : 'pointer', fontFamily: 'Manrope, sans-serif' }}
                  >
                    {editingProduct ? '✅ Salvar Alterações' : '🚀 Cadastrar Produto'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ MODAL: AWARD DIAMONDS ════════════════════════════════════════════ */}
      {isAwardModalOpen && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'rgba(10,15,35,0.98)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 22, width: '100%', maxWidth: 380, padding: 24, boxShadow: '0 16px 60px rgba(0,0,0,0.9)', position: 'relative' }}>
            <button onClick={() => setIsAwardModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 30, height: 30, borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💎</div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>Conceder Diamantes</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Para: <strong style={{ color: '#10b981' }}>{selectedClient.name}</strong></p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>Saldo atual: 💎 {selectedClient.diamonds ?? 0}</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Quantidade de Diamantes</label>
              <input type="number" value={awardAmount} onChange={e => setAwardAmount(e.target.value)} style={{ ...inputStyle, textAlign: 'center', fontSize: 22, fontWeight: 900, height: 52, color: '#10b981' }} min="1" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setAwardAmount(v.toString())} style={{ height: 34, background: awardAmount === v.toString() ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${awardAmount === v.toString() ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, color: awardAmount === v.toString() ? '#10b981' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>+{v}</button>
              ))}
            </div>
            <button onClick={handleAwardDiamonds} style={{ width: '100%', height: 44, background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>Confirmar Premiação 💎</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Admin;
