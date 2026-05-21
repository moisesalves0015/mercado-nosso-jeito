import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import {
  Gem, ShoppingBag, Users, TrendingUp, Plus, Edit2, Trash2, Power,
  Store, Search, Filter, Award, X, Package, BarChart2, ChevronDown,
  CheckCircle, Clock, Truck, AlertCircle, Shield, Ban, RefreshCw,
  Star, Zap, ArrowUp, ArrowDown, Eye, EyeOff
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { collection, getDocs, doc, updateDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ─── TYPES ─────────────────────────────────────────────────────────────────
interface Product {
  id: string; title: string; price: number; image: string; category: string;
  badge?: string; badgeStyle?: 'orange' | 'light'; diamondReward?: number;
  active?: boolean; stock?: number;
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

type TabType = 'dashboard' | 'produtos' | 'pedidos' | 'clientes' | 'analytics' | 'roleta';

// ─── CHART DATA (mock enriched) ─────────────────────────────────────────────
const salesData = [
  { day: 'Seg', vendas: 340, pedidos: 4 },
  { day: 'Ter', vendas: 520, pedidos: 7 },
  { day: 'Qua', vendas: 280, pedidos: 3 },
  { day: 'Qui', vendas: 890, pedidos: 11 },
  { day: 'Sex', vendas: 1200, pedidos: 15 },
  { day: 'Sáb', vendas: 1650, pedidos: 20 },
  { day: 'Dom', vendas: 980, pedidos: 12 },
];
const categoryData = [
  { name: 'Bebidas', value: 42, color: '#818cf8' },
  { name: 'Tabacaria', value: 28, color: '#f59e0b' },
  { name: 'Eletrônicos', value: 18, color: '#10b981' },
  { name: 'Limpeza', value: 8, color: '#ec4899' },
  { name: 'Alimentos', value: 4, color: '#0ea5e9' },
];
const monthlyData = [
  { mes: 'Jan', receita: 4200 }, { mes: 'Fev', receita: 5800 },
  { mes: 'Mar', receita: 4900 }, { mes: 'Abr', receita: 7200 },
  { mes: 'Mai', receita: 8900 }, { mes: 'Jun', receita: 6100 },
];

// ─── STATUS CONFIG ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'Pendente':          { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  icon: Clock },
  'Aprovado':          { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.25)',  icon: CheckCircle },
  'Saiu para Entrega': { color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.25)', icon: Truck },
  'Entregue':          { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)',  icon: CheckCircle },
};

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '10px 14px' }}>
        <p style={{ color: '#FFDF73', fontWeight: 900, fontSize: 12, margin: '0 0 4px' }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color, fontSize: 11, margin: 0, fontWeight: 700 }}>
            {p.name}: {p.name === 'vendas' || p.name === 'receita' ? `R$ ${p.value.toFixed(2)}` : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── STAT CARD COMPONENT ─────────────────────────────────────────────────────
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
      {trend !== undefined && (
        trend >= 0
          ? <ArrowUp size={10} color="#10b981" />
          : <ArrowDown size={10} color="#ef4444" />
      )}
      <span style={{ fontSize: 9.5, fontWeight: 700, color: sub?.startsWith('⚡') || sub?.startsWith('💎') ? '#10b981' : 'rgba(255,255,255,0.4)' }}>{sub}</span>
    </div>
  </div>
);

// ─── MAIN ADMIN COMPONENT ────────────────────────────────────────────────────
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
  const [prodTitle, setProdTitle] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodCategory, setProdCategory] = useState('Bebidas');
  const [prodBadge, setProdBadge] = useState('');
  const [prodBadgeStyle, setProdBadgeStyle] = useState<'orange' | 'light'>('orange');
  const [prodDiamondReward, setProdDiamondReward] = useState('');
  const [prodStock, setProdStock] = useState('');

  // ── Orders ──
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderFilter, setOrderFilter] = useState<string>('Todos');

  // ── Firestore Clients ──
  const [clients, setClients] = useState<FirestoreClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<FirestoreClient | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [awardAmount, setAwardAmount] = useState('50');
  const [clientSearch, setClientSearch] = useState('');

  // ── Roulette Admin States ──
  const [rouletteItems, setRouletteItems] = useState<{ text: string; color: string }[]>([]);
  const [newRouletteText, setNewRouletteText] = useState('');
  const [savingRoulette, setSavingRoulette] = useState(false);
  const [loadingRoulette, setLoadingRoulette] = useState(false);

  // ─── Load from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    // Products
    const storedProducts = localStorage.getItem('app-products');
    if (storedProducts) {
      setProducts(JSON.parse(storedProducts));
    } else {
      const defaults: Product[] = [
        { id: 'heineken-330ml', title: 'Cerveja Heineken Long Neck (330ml)', price: 7.90, image: '/heineken.png', category: 'Bebidas', badge: 'Trincando', badgeStyle: 'orange', diamondReward: 2, active: true, stock: 48 },
        { id: 'coca-cola-350ml', title: 'Refrigerante Coca-Cola Sem Açúcar Lata (350ml)', price: 4.50, image: '/coca_cola_zero.png', category: 'Bebidas', diamondReward: 1, active: true, stock: 120 },
        { id: 'monster-energy', title: 'Energético Monster Energy Tradicional (473ml)', price: 9.90, image: '/monster_energy.webp', category: 'Bebidas', badge: 'Mais Vendido', badgeStyle: 'orange', diamondReward: 3, active: true, stock: 32 },
        { id: 'spaten-350ml', title: 'Cerveja Spaten Puro Malte Lata (350ml)', price: 5.20, image: '/spaten.webp', category: 'Bebidas', diamondReward: 1, active: true, stock: 60 },
        { id: 'marlboro-gold', title: 'Cigarro Marlboro Gold Box (20un)', price: 13.50, image: 'https://images.unsplash.com/photo-1627140469085-fcd84814df2a?q=80&w=600', category: 'Tabacaria', badge: 'Mais Vendido', badgeStyle: 'orange', diamondReward: 2, active: true, stock: 85 },
        { id: 'ignite-v50', title: 'Vape Pod Ignite V50 Mentol (5000 Puffs)', price: 89.90, image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=600', category: 'Tabacaria', badge: 'Premium', badgeStyle: 'orange', diamondReward: 10, active: true, stock: 15 },
        { id: 'fone-bluetooth', title: 'Fone de Ouvido Bluetooth JBL Wave Flex', price: 289.90, image: 'https://images.unsplash.com/photo-1608156639585-b3a032ef9689?q=80&w=600', category: 'Eletrônicos', badge: 'Frete Grátis', badgeStyle: 'light', diamondReward: 40, active: true, stock: 8 },
        { id: 'carregador-turbo', title: 'Carregador de Tomada Turbo Anker 20W USB-C', price: 79.90, image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600', category: 'Eletrônicos', diamondReward: 8, active: true, stock: 22 },
      ];
      localStorage.setItem('app-products', JSON.stringify(defaults));
      setProducts(defaults);
    }

    // Orders
    const storedOrders = localStorage.getItem('app-orders');
    if (storedOrders) {
      setOrders(JSON.parse(storedOrders));
    } else {
      const now = Date.now();
      const fmt = (ts: number) => new Date(ts).toLocaleDateString('pt-BR') + ' ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const defaults: Order[] = [
        { id: 'ped-1002', clientName: 'Moisés Alves', clientEmail: 'moises@exemplo.com', items: [{ id: 'heineken-330ml', title: 'Cerveja Heineken Long Neck (330ml)', price: 7.90, quantity: 4 }, { id: 'monster-energy', title: 'Energético Monster Energy (473ml)', price: 9.90, quantity: 2 }], total: 51.40, status: 'Aprovado', createdAt: fmt(now - 7200000), address: 'Rua das Palmeiras, 105 - Centro, Blumenau - SC' },
        { id: 'ped-1003', clientName: 'Ana Silva', clientEmail: 'ana@exemplo.com', items: [{ id: 'ignite-v50', title: 'Vape Pod Ignite V50 Mentol', price: 89.90, quantity: 1 }], total: 89.90, status: 'Pendente', createdAt: fmt(now - 600000), address: 'Av. Beira Rio, 450, Ap 402 - Centro, Blumenau - SC' },
        { id: 'ped-1001', clientName: 'Carlos Souza', clientEmail: 'carlos@exemplo.com', items: [{ id: 'fone-bluetooth', title: 'Fone Bluetooth JBL Wave Flex', price: 289.90, quantity: 1 }, { id: 'coca-cola-350ml', title: 'Coca-Cola Zero Lata (350ml)', price: 4.50, quantity: 3 }], total: 303.40, status: 'Entregue', createdAt: fmt(now - 86400000), address: 'Rua Joinville, 88 - Vila Nova, Blumenau - SC' },
        { id: 'ped-1004', clientName: 'Beatriz Santos', clientEmail: 'bea@exemplo.com', items: [{ id: 'marlboro-gold', title: 'Cigarro Marlboro Gold Box', price: 13.50, quantity: 3 }], total: 40.50, status: 'Saiu para Entrega', createdAt: fmt(now - 3600000), address: 'Rua XV de Novembro, 200 - Centro, Blumenau - SC' },
      ];
      localStorage.setItem('app-orders', JSON.stringify(defaults));
      setOrders(defaults);
    }
  }, []);

  // ─── Load Clients from Firestore ─────────────────────────────────────────
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data: FirestoreClient[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreClient));
      setClients(data);
    } catch (e) {
      console.error('Firestore fetch error:', e);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'clientes') fetchClients();
    if (activeTab === 'roleta') fetchRoulette();
  }, [activeTab]);

  // ─── Persist helpers ─────────────────────────────────────────────────────
  const saveProducts = (p: Product[]) => {
    localStorage.setItem('app-products', JSON.stringify(p));
    setProducts(p);
    window.dispatchEvent(new Event('app-products-updated'));
  };
  const saveOrders = (o: Order[]) => {
    localStorage.setItem('app-orders', JSON.stringify(o));
    setOrders(o);
  };

  // ─── Logout ──────────────────────────────────────────────────────────────
  const handleLogout = async () => { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } };

  // ─── Product CRUD ────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingProduct(null); setProdTitle(''); setProdPrice(''); setProdImage('');
    setProdCategory('Bebidas'); setProdBadge(''); setProdBadgeStyle('orange');
    setProdDiamondReward(''); setProdStock('');
    setIsProductModalOpen(true);
  };
  const openEditModal = (p: Product) => {
    setEditingProduct(p); setProdTitle(p.title); setProdPrice(p.price.toString());
    setProdImage(p.image); setProdCategory(p.category); setProdBadge(p.badge || '');
    setProdBadgeStyle(p.badgeStyle || 'orange');
    setProdDiamondReward(p.diamondReward?.toString() || '');
    setProdStock(p.stock?.toString() || '');
    setIsProductModalOpen(true);
  };
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle || !prodPrice || !prodImage) { alert('Preencha todos os campos obrigatórios.'); return; }
    const price = parseFloat(prodPrice);
    if (isNaN(price)) { alert('Preço inválido.'); return; }
    const diamond = prodDiamondReward ? parseInt(prodDiamondReward) : undefined;
    const stock = prodStock ? parseInt(prodStock) : undefined;
    if (editingProduct) {
      saveProducts(products.map(p => p.id === editingProduct.id ? { ...p, title: prodTitle, price, image: prodImage, category: prodCategory, badge: prodBadge || undefined, badgeStyle: prodBadgeStyle, diamondReward: diamond, stock } : p));
    } else {
      saveProducts([...products, { id: 'prod-' + Date.now(), title: prodTitle, price, image: prodImage, category: prodCategory, badge: prodBadge || undefined, badgeStyle: prodBadgeStyle, diamondReward: diamond, active: true, stock }]);
    }
    setIsProductModalOpen(false);
  };
  const handleDeleteProduct = (id: string) => { if (window.confirm('Excluir produto?')) saveProducts(products.filter(p => p.id !== id)); };
  const toggleProductActive = (id: string) => saveProducts(products.map(p => p.id === id ? { ...p, active: !p.active } : p));

  // ─── Order Actions ───────────────────────────────────────────────────────
  const updateOrderStatus = (id: string, status: Order['status']) => {
    const updated = orders.map(o => o.id === id ? { ...o, status } : o);
    saveOrders(updated);
    if (selectedOrder?.id === id) setSelectedOrder({ ...selectedOrder, status });
  };

  // ─── Client Actions (Firestore) ──────────────────────────────────────────
  const promoteToAdmin = async (client: FirestoreClient) => {
    if (!window.confirm(`Promover ${client.name} a administrador?`)) return;
    try {
      await updateDoc(doc(db, 'users', client.id), { role: 'admin' });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, role: 'admin' } : c));
    } catch (e) { alert('Erro ao promover usuário.'); }
  };
  const banClient = async (client: FirestoreClient) => {
    if (!window.confirm(`Banir ${client.name}? Isso revogará o acesso.`)) return;
    try {
      await updateDoc(doc(db, 'users', client.id), { role: 'banned' });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, role: 'banned' } : c));
    } catch (e) { alert('Erro ao banir usuário.'); }
  };
  const handleAwardDiamonds = async () => {
    if (!selectedClient) return;
    const amount = parseInt(awardAmount);
    if (isNaN(amount) || amount <= 0) { alert('Quantidade inválida.'); return; }
    try {
      const newTotal = (selectedClient.diamonds || 0) + amount;
      await updateDoc(doc(db, 'users', selectedClient.id), { diamonds: newTotal });
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, diamonds: newTotal } : c));
      setIsAwardModalOpen(false);
      alert(`✅ ${amount} 💎 creditados para ${selectedClient.name}!`);
    } catch (e) { alert('Erro ao conceder diamantes.'); }
  };

  // ─── Roulette Helpers & CRUD ──────────────────────────────────────────────
  const DEFAULT_ROULETTE_ITEMS = [
    { text: "15 Diamantes 💎", color: "#D4AF37" },
    { text: "Monster Gelado ⚡", color: "#E25C1D" },
    { text: "Tente de Novo 😢", color: "#1E150F" },
    { text: "Frete Grátis 🚚", color: "#059669" },
    { text: "50 Diamantes 💎", color: "#D4AF37" },
    { text: "10% de Desconto 🏷️", color: "#5B21B6" },
    { text: "Cerveja Spaten 🍺", color: "#059669" },
    { text: "100 Diamantes 💎", color: "#D4AF37" },
    { text: "Tente de Novo 😢", color: "#1E150F" }
  ];

  const fetchRoulette = async () => {
    setLoadingRoulette(true);
    try {
      const snap = await getDoc(doc(db, 'configs', 'roulette'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.items && Array.isArray(data.items)) {
          setRouletteItems(data.items);
        } else {
          setRouletteItems(DEFAULT_ROULETTE_ITEMS);
        }
      } else {
        setRouletteItems(DEFAULT_ROULETTE_ITEMS);
      }
    } catch (e) {
      console.error("Erro ao carregar roleta:", e);
      setRouletteItems(DEFAULT_ROULETTE_ITEMS);
    } finally {
      setLoadingRoulette(false);
    }
  };

  const handleSaveRoulette = async () => {
    if (rouletteItems.length < 2) {
      alert("A roleta precisa ter no mínimo 2 itens para girar!");
      return;
    }
    setSavingRoulette(true);
    try {
      await setDoc(doc(db, 'configs', 'roulette'), {
        items: rouletteItems,
        updatedAt: new Date().toISOString()
      });
      alert("Configuração da roleta salva no Firestore com sucesso! 🎉");
    } catch (e: any) {
      console.error("Erro ao salvar roleta:", e);
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSavingRoulette(false);
    }
  };

  const handleAddRouletteItem = () => {
    const text = newRouletteText.trim();
    if (!text) return;
    const premiumColors = ["#D4AF37", "#1E150F", "#E25C1D", "#5B21B6", "#059669"];
    const color = premiumColors[rouletteItems.length % premiumColors.length];
    setRouletteItems([...rouletteItems, { text, color }]);
    setNewRouletteText('');
  };

  const handleRemoveRouletteItem = (index: number) => {
    setRouletteItems(rouletteItems.filter((_, i) => i !== index));
  };

  const handleUpdateRouletteItemText = (index: number, newText: string) => {
    setRouletteItems(rouletteItems.map((item, i) => i === index ? { ...item, text: newText } : item));
  };

  const handleUpdateRouletteItemColor = (index: number, newColor: string) => {
    setRouletteItems(rouletteItems.map((item, i) => i === index ? { ...item, color: newColor } : item));
  };

  const moveRouletteItem = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= rouletteItems.length) return;
    const updated = [...rouletteItems];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    setRouletteItems(updated);
  };

  // ─── Computed Metrics ────────────────────────────────────────────────────
  const approvedOrders = orders.filter(o => o.status !== 'Pendente');
  const totalRevenue = approvedOrders.reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter(o => o.status === 'Pendente').length;
  const avgTicket = approvedOrders.length > 0 ? totalRevenue / approvedOrders.length : 0;
  const filteredProducts = products.filter(p => {
    return p.title.toLowerCase().includes(searchProduct.toLowerCase()) && (filterCategory === 'Todos' || p.category === filterCategory);
  });
  const filteredOrders = orderFilter === 'Todos' ? orders : orders.filter(o => o.status === orderFilter);
  const filteredClients = clients.filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.email?.toLowerCase().includes(clientSearch.toLowerCase()));

  // ─── STYLE HELPERS ───────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '40px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    paddingLeft: 12, paddingRight: 12, color: '#fff', fontSize: 13,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Manrope, sans-serif',
  };
  const labelStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 };
  const sectionCard: React.CSSProperties = { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' };

  const TABS: { key: TabType; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { key: 'produtos', label: 'Produtos', icon: Package },
    { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag, badge: pendingCount },
    { key: 'clientes', label: 'Clientes', icon: Users },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
    { key: 'roleta', label: 'Roleta', icon: RefreshCw },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #020617 0%, #0b0f19 60%, #020617 100%)', color: '#fff', fontFamily: 'Manrope, sans-serif', paddingBottom: 60 }}>

      {/* Ambient glow */}
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)', top: '-10%', right: '-5%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 70%)', bottom: '10%', left: '-5%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── HEADER ── */}
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

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', position: 'relative', zIndex: 1 }}>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px',
                background: active ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'rgba(15,23,42,0.5)',
                border: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, color: active ? '#000' : 'rgba(255,255,255,0.55)',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.25s ease',
                position: 'relative', fontFamily: 'Manrope, sans-serif',
              }}>
                <Icon size={13} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 900, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══════════════════ TAB: DASHBOARD ══════════════════ */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Faturamento" value={`R$ ${totalRevenue.toFixed(2)}`} sub="⚡ Pedidos aprovados" icon={TrendingUp} iconColor="#D4AF37" gold trend={12} />
              <StatCard label="Pedidos Totais" value={orders.length} sub={`${pendingCount} pendentes`} icon={ShoppingBag} iconColor="#0ea5e9" trend={5} />
              <StatCard label="Ticket Médio" value={`R$ ${avgTicket.toFixed(2)}`} sub="Por pedido aprovado" icon={Zap} iconColor="#10b981" trend={3} />
              <StatCard label="Produtos" value={products.length} sub={`${products.filter(p => p.active !== false).length} ativos`} icon={Package} iconColor="#818cf8" />
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Sales Line Chart */}
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={15} color="#D4AF37" /> Vendas da Semana
                </h3>
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

              {/* Category Pie */}
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart2 size={15} color="#818cf8" /> Vendas por Categoria
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>
                        {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
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

            {/* Recent Pending Orders */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={15} color="#f59e0b" /> Pedidos Aguardando Ação
                </h3>
                <button onClick={() => setActiveTab('pedidos')} style={{ background: 'none', border: 'none', color: '#FFDF73', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Ver todos <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>✅ Tudo em ordem! Nenhum pedido pendente.</div>
                ) : (
                  orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').map(order => {
                    const sc = STATUS_CONFIG[order.status];
                    return (
                      <div key={order.id} onClick={() => { setSelectedOrder(order); setActiveTab('pedidos'); }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s ease' }}>
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
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: PRODUTOS ══════════════════ */}
        {activeTab === 'produtos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Toolbar */}
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

            {/* Product Table */}
            <div style={{ ...sectionCard, padding: '8px 0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Produto', 'Preço', 'Estoque', 'Categoria', 'Status', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', textAlign: h === 'Ações' ? 'center' : 'left', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: p.active === false ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                      <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={p.image} alt={p.title} style={{ width: 38, height: 38, objectFit: 'contain', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{p.title}</div>
                          {p.badge && <span style={{ fontSize: 8, fontWeight: 900, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', padding: '1px 6px', borderRadius: 99 }}>{p.badge}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 900, color: '#FFDF73' }}>R$ {p.price.toFixed(2)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: (p.stock || 0) < 15 ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>{p.stock ?? '—'}</span>
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
                          <button onClick={() => openEditModal(p)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFDF73', cursor: 'pointer' }}>
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => handleDeleteProduct(p.id)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum produto encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: PEDIDOS ══════════════════ */}
        {activeTab === 'pedidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filter bar */}
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

            {/* Orders List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredOrders.map(order => {
                const sc = STATUS_CONFIG[order.status];
                const Icon = sc.icon;
                return (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} style={{
                    background: selectedOrder?.id === order.id ? 'rgba(212,175,55,0.06)' : 'rgba(15,23,42,0.5)',
                    border: selectedOrder?.id === order.id ? '1.5px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 16, padding: '16px', cursor: 'pointer', transition: 'all 0.25s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 900, color: '#fff' }}>{order.clientName}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#FFDF73' }}>#{order.id}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{order.createdAt}</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 9px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon size={9} />{order.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '0 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      {order.items.map(i => `${i.quantity}x ${i.title}`).join(', ')}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 10 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{order.items.reduce((s, i) => s + i.quantity, 0)} item(s)</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#FFDF73' }}>R$ {order.total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
              {filteredOrders.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum pedido com este status.</div>}
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: CLIENTES ══════════════════ */}
        {activeTab === 'clientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Search + Refresh */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={13} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Buscar por nome ou email..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>
              <button onClick={fetchClients} disabled={loadingClients} style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFDF73', cursor: 'pointer' }}>
                <RefreshCw size={14} style={{ animation: loadingClients ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>

            {/* Clients List */}
            {loadingClients ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Carregando usuários do Firebase...</div>
            ) : filteredClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum usuário encontrado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredClients.map(client => {
                  const isAdmin = client.role === 'admin';
                  const isBanned = client.role === 'banned';
                  return (
                    <div key={client.id} style={{ ...sectionCard, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      {/* Avatar + Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: isAdmin ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : isBanned ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, fontWeight: 900, color: isAdmin ? '#000' : isBanned ? '#ef4444' : '#818cf8' }}>
                          {client.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{client.name || 'Sem nome'}</span>
                            <span style={{
                              fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 99,
                              background: isAdmin ? 'rgba(212,175,55,0.12)' : isBanned ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                              color: isAdmin ? '#FFDF73' : isBanned ? '#ef4444' : '#818cf8',
                              border: isAdmin ? '1px solid rgba(212,175,55,0.25)' : isBanned ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(99,102,241,0.25)',
                            }}>
                              {isAdmin ? '👑 ADMIN' : isBanned ? '🚫 BANIDO' : 'Cliente'}
                            </span>
                          </div>
                          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{client.email}</span>
                          <span style={{ fontSize: 10, color: '#10b981', fontWeight: 800 }}>💎 {client.diamonds ?? 0} diamantes</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setSelectedClient(client); setIsAwardModalOpen(true); }} title="Conceder Diamantes" style={{ width: 30, height: 30, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', cursor: 'pointer' }}>
                          <Award size={13} />
                        </button>
                        {!isAdmin && !isBanned && (
                          <button onClick={() => promoteToAdmin(client)} title="Promover a Admin" style={{ width: 30, height: 30, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', cursor: 'pointer' }}>
                            <Shield size={13} />
                          </button>
                        )}
                        {!isAdmin && !isBanned && (
                          <button onClick={() => banClient(client)} title="Banir usuário" style={{ width: 30, height: 30, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}>
                            <Ban size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ TAB: ANALYTICS ══════════════════ */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Monthly Revenue Bar Chart */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={15} color="#D4AF37" /> Receita Mensal (R$)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="receita" name="receita" radius={[6, 6, 0, 0]} fill="url(#goldGrad)" />
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFDF73" stopOpacity={1} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Orders + Sales */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={15} color="#818cf8" /> Pedidos vs Vendas na Semana
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
                  <Line yAxisId="left" type="monotone" dataKey="vendas" stroke="#D4AF37" strokeWidth={2.5} dot={{ fill: '#D4AF37', r: 4, strokeWidth: 0 }} name="vendas" />
                  <Line yAxisId="right" type="monotone" dataKey="pedidos" stroke="#818cf8" strokeWidth={2} dot={{ fill: '#818cf8', r: 3, strokeWidth: 0 }} name="pedidos" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatCard label="Melhor Dia" value="Sábado" sub="R$ 1.650 em vendas" icon={Star} iconColor="#f59e0b" />
              <StatCard label="Categoria Top" value="Bebidas" sub="42% das vendas" icon={TrendingUp} iconColor="#818cf8" />
              <StatCard label="Pedido Máximo" value="R$ 303,40" sub="Carlos Souza" icon={Award} iconColor="#10b981" />
              <StatCard label="Taxa Entrega" value="100%" sub="Frete grátis ativo" icon={Truck} iconColor="#0ea5e9" />
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: ROLETA (ADMIN) ══════════════════ */}
        {activeTab === 'roleta' && (
          <div style={sectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={15} color="#D4AF37" /> Configurar Roleta de Prêmios
                </h3>
                <p style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)', margin: '4px 0 0' }}>Configure os prêmios da roleta do Nosso Clube. Salve para persistir no Firestore.</p>
              </div>
              
              <button 
                onClick={handleSaveRoulette} 
                disabled={savingRoulette || loadingRoulette}
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #FFDF73)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s ease',
                  fontFamily: 'Manrope, sans-serif'
                }}
              >
                {savingRoulette ? 'Salvando...' : '💾 Salvar na Nuvem'}
              </button>
            </div>

            {loadingRoulette ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                Carregando configuração da roleta...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                {/* Adicionar prêmio bar */}
                <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 }}>
                  <input 
                    type="text" 
                    value={newRouletteText} 
                    onChange={e => setNewRouletteText(e.target.value)} 
                    placeholder="Novo prêmio (Ex: 20 Diamantes 💎)" 
                    style={{ ...inputStyle, flex: 1 }}
                    onKeyDown={e => e.key === 'Enter' && handleAddRouletteItem()}
                  />
                  <button 
                    onClick={handleAddRouletteItem}
                    style={{
                      background: 'rgba(212,175,55,0.15)',
                      border: '1px solid rgba(212,175,55,0.3)',
                      color: '#FFDF73',
                      padding: '0 18px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 850,
                      cursor: 'pointer',
                      fontFamily: 'Manrope, sans-serif'
                    }}
                  >
                    Adicionar
                  </button>
                </div>

                {/* Tabela de itens da roleta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'grid', gridTemplateColumns: '1fr 140px 100px', padding: '0 12px' }}>
                    <span>Texto do Prêmio</span>
                    <span>Cor de Fundo</span>
                    <span style={{ textAlign: 'right' }}>Ações</span>
                  </div>

                  {rouletteItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      Nenhum item na roleta. Adicione prêmios acima.
                    </div>
                  ) : (
                    rouletteItems.map((item, index) => (
                      <div 
                        key={index}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 140px 100px',
                          alignItems: 'center',
                          gap: 12,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          padding: '10px 12px',
                          borderRadius: 12,
                          transition: 'border-color 0.2s ease'
                        }}
                      >
                        {/* Nome do prêmio */}
                        <input 
                          type="text" 
                          value={item.text} 
                          onChange={e => handleUpdateRouletteItemText(index, e.target.value)}
                          style={{ ...inputStyle, height: '36px', background: 'transparent', border: 'none', padding: 0 }}
                        />

                        {/* Seletor de cores HSL */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: item.color, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                          <input 
                            type="text" 
                            value={item.color} 
                            onChange={e => handleUpdateRouletteItemColor(index, e.target.value)}
                            placeholder="#hex ou hsl"
                            style={{ ...inputStyle, height: '32px', fontSize: 11, padding: '0 6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}
                          />
                        </div>

                        {/* Ações (cima, baixo, excluir) */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button 
                            onClick={() => moveRouletteItem(index, 'up')}
                            disabled={index === 0}
                            style={{
                              width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(255,255,255,0.02)', color: index === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                              cursor: index === 0 ? 'default' : 'pointer', display: 'grid', placeItems: 'center'
                            }}
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button 
                            onClick={() => moveRouletteItem(index, 'down')}
                            disabled={index === rouletteItems.length - 1}
                            style={{
                              width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(255,255,255,0.02)', color: index === rouletteItems.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                              cursor: index === rouletteItems.length - 1 ? 'default' : 'pointer', display: 'grid', placeItems: 'center'
                            }}
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button 
                            onClick={() => handleRemoveRouletteItem(index)}
                            style={{
                              width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                              cursor: 'pointer', display: 'grid', placeItems: 'center'
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ══ ORDER DETAIL MODAL ══ */}
      {selectedOrder && activeTab === 'pedidos' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'rgba(10,15,35,0.98)', border: '1.5px solid rgba(212,175,55,0.3)', borderRadius: 22, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 16px 60px rgba(0,0,0,0.9)', position: 'relative' }}>
            <button onClick={() => setSelectedOrder(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 30, height: 30, borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>

            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#fff', margin: '0 0 2px' }}>Pedido #{selectedOrder.id}</h3>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{selectedOrder.createdAt} • {selectedOrder.clientName}</span>

            {/* Items */}
            <div style={{ margin: '18px 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
              <label style={labelStyle}>Itens do Pedido</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedOrder.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{item.quantity}x {item.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Address */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Endereço de Entrega</label>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>{selectedOrder.address}</p>
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>Total do Pedido</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#FFDF73' }}>R$ {selectedOrder.total.toFixed(2)}</span>
            </div>

            {/* Status buttons */}
            <label style={labelStyle}>Atualizar Status</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {(['Pendente', 'Aprovado', 'Saiu para Entrega', 'Entregue'] as Order['status'][]).map(s => {
                const sc = STATUS_CONFIG[s];
                const active = selectedOrder.status === s;
                return (
                  <button key={s} onClick={() => updateOrderStatus(selectedOrder.id, s)} style={{
                    height: 38, background: active ? sc.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? sc.border : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, color: active ? sc.color : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', transition: 'all 0.2s ease',
                  }}>{s}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ PRODUCT MODAL ══ */}
      {isProductModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'rgba(10,15,35,0.98)', border: '1.5px solid rgba(212,175,55,0.25)', borderRadius: 22, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 16px 60px rgba(0,0,0,0.9)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setIsProductModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 30, height: 30, borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: '0 0 20px' }}>{editingProduct ? 'Editar Produto' : 'Cadastrar Produto'}</h3>
            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Nome do Produto *</label><input style={inputStyle} value={prodTitle} onChange={e => setProdTitle(e.target.value)} placeholder="Ex: Cerveja Heineken Long Neck (330ml)" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>Preço (R$) *</label><input style={inputStyle} type="number" step="0.01" value={prodPrice} onChange={e => setProdPrice(e.target.value)} placeholder="0.00" /></div>
                <div><label style={labelStyle}>Estoque (un)</label><input style={inputStyle} type="number" value={prodStock} onChange={e => setProdStock(e.target.value)} placeholder="0" /></div>
              </div>
              <div><label style={labelStyle}>URL da Imagem *</label><input style={inputStyle} value={prodImage} onChange={e => setProdImage(e.target.value)} placeholder="https://... ou /nome-arquivo.png" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select value={prodCategory} onChange={e => setProdCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {['Bebidas', 'Tabacaria', 'Eletrônicos', 'Limpeza', 'Alimentos'].map(c => <option key={c} value={c} style={{ background: '#0f172a' }}>{c}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Recompensa (💎)</label><input style={inputStyle} type="number" value={prodDiamondReward} onChange={e => setProdDiamondReward(e.target.value)} placeholder="0" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>Selo (badge)</label><input style={inputStyle} value={prodBadge} onChange={e => setProdBadge(e.target.value)} placeholder="Ex: Mais Vendido" /></div>
                <div>
                  <label style={labelStyle}>Cor do Selo</label>
                  <select value={prodBadgeStyle} onChange={e => setProdBadgeStyle(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="orange" style={{ background: '#0f172a' }}>Laranja (Destaque)</option>
                    <option value="light" style={{ background: '#0f172a' }}>Claro (Suave)</option>
                  </select>
                </div>
              </div>
              <button type="submit" style={{ height: 44, background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 900, fontSize: 14, cursor: 'pointer', marginTop: 6, fontFamily: 'Manrope, sans-serif' }}>
                {editingProduct ? '✅ Salvar Alterações' : '🚀 Cadastrar Produto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ AWARD DIAMONDS MODAL ══ */}
      {isAwardModalOpen && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'rgba(10,15,35,0.98)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 22, width: '100%', maxWidth: 380, padding: 24, boxShadow: '0 16px 60px rgba(0,0,0,0.9)', position: 'relative' }}>
            <button onClick={() => setIsAwardModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 30, height: 30, borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
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
                <button key={v} onClick={() => setAwardAmount(v.toString())} style={{ height: 34, background: awardAmount === v.toString() ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${awardAmount === v.toString() ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, color: awardAmount === v.toString() ? '#10b981' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                  +{v}
                </button>
              ))}
            </div>
            <button onClick={handleAwardDiamonds} style={{ width: '100%', height: 44, background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
              Confirmar Premiação 💎
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Admin;
