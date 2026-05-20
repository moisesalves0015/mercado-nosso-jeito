import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Gem, 
  ShoppingBag, 
  Users, 
  TrendingUp, 
  Plus, 
  Edit2, 
  Trash2, 
  Power, 
  ChevronRight, 
  Store, 
  Search, 
  Filter,
  Award,
  X
} from 'lucide-react';

interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  diamondReward?: number;
}

interface OrderItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  clientName: string;
  clientEmail: string;
  items: OrderItem[];
  total: number;
  status: 'Pendente' | 'Aprovado' | 'Saiu para Entrega' | 'Entregue';
  createdAt: string;
  address: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  role: string;
  diamonds: number;
  createdAt: string;
}

export const Admin: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'produtos' | 'pedidos' | 'clientes'>('dashboard');
  
  // Product state
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form State
  const [prodTitle, setProdTitle] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodCategory, setProdCategory] = useState('Bebidas');
  const [prodBadge, setProdBadge] = useState('');
  const [prodBadgeStyle, setProdBadgeStyle] = useState<'orange' | 'light'>('orange');
  const [prodDiamondReward, setProdDiamondReward] = useState('');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Clients State
  const [clients, setClients] = useState<Client[]>([]);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [awardAmount, setAwardAmount] = useState('50');

  // Load Initial Data from localStorage or populate defaults
  useEffect(() => {
    // 1. Products
    const storedProducts = localStorage.getItem('app-products');
    if (storedProducts) {
      let allProds = JSON.parse(storedProducts) as Product[];
      let updated = false;
      allProds = allProds.map(p => {
        if (p.id === 'heineken-330ml' && p.image !== '/heineken.png') {
          p.image = '/heineken.png';
          updated = true;
        }
        if (p.id === 'coca-cola-350ml' && p.image !== '/coca_cola_zero.png') {
          p.image = '/coca_cola_zero.png';
          updated = true;
        }
        if (p.id === 'monster-energy' && p.image !== '/monster_energy.webp') {
          p.image = '/monster_energy.webp';
          updated = true;
        }
        if (p.id === 'spaten-350ml' && p.image !== '/spaten.webp') {
          p.image = '/spaten.webp';
          updated = true;
        }
        return p;
      });
      if (updated) {
        localStorage.setItem('app-products', JSON.stringify(allProds));
      }
      setProducts(allProds);
    } else {
      const defaultProducts: Product[] = [
        {
          id: 'heineken-330ml',
          title: "Cerveja Heineken Long Neck (330ml)",
          price: 7.90,
          image: "/heineken.png",
          category: "Bebidas",
          badge: "Trincando",
          badgeStyle: "orange",
          diamondReward: 2
        },
        {
          id: 'coca-cola-350ml',
          title: "Refrigerante Coca-Cola Sem Açúcar Lata (350ml)",
          price: 4.50,
          image: "/coca_cola_zero.png",
          category: "Bebidas",
          diamondReward: 1
        },
        {
          id: 'monster-energy',
          title: "Energético Monster Energy Tradicional (473ml)",
          price: 9.90,
          image: "/monster_energy.webp",
          category: "Bebidas",
          badge: "Mais Vendido",
          badgeStyle: "orange",
          diamondReward: 3
        },
        {
          id: 'spaten-350ml',
          title: "Cerveja Spaten Puro Malte Lata (350ml)",
          price: 5.20,
          image: "/spaten.webp",
          category: "Bebidas",
          diamondReward: 1
        },
        {
          id: 'marlboro-gold',
          title: "Cigarro Marlboro Gold Box (20un)",
          price: 13.50,
          image: "https://images.unsplash.com/photo-1627140469085-fcd84814df2a?q=80&w=600",
          category: "Tabacaria",
          badge: "Mais Vendido",
          badgeStyle: "orange",
          diamondReward: 2
        },
        {
          id: 'ignite-v50',
          title: "Vape Pod Ignite V50 Mentol (5000 Puffs)",
          price: 89.90,
          image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=600",
          category: "Tabacaria",
          badge: "Premium",
          badgeStyle: "orange",
          diamondReward: 10
        },
        {
          id: 'bic-grande',
          title: "Isqueiro Bic Grande Tradicional (1un)",
          price: 9.90,
          image: "https://images.unsplash.com/photo-1516245834210-c4c142787335?q=80&w=600",
          category: "Tabacaria",
          diamondReward: 1
        },
        {
          id: 'fone-bluetooth',
          title: "Fone de Ouvido Bluetooth JBL Wave Flex",
          price: 289.90,
          image: "https://images.unsplash.com/photo-1608156639585-b3a032ef9689?q=80&w=600",
          category: "Eletrônicos",
          badge: "Frete Grátis",
          badgeStyle: "light",
          diamondReward: 40
        },
        {
          id: 'carregador-turbo',
          title: "Carregador de Tomada Turbo Anker 20W USB-C",
          price: 79.90,
          image: "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600",
          category: "Eletrônicos",
          diamondReward: 8
        }
      ];
      localStorage.setItem('app-products', JSON.stringify(defaultProducts));
      setProducts(defaultProducts);
    }

    // 2. Orders
    const storedOrders = localStorage.getItem('app-orders');
    if (storedOrders) {
      setOrders(JSON.parse(storedOrders));
    } else {
      const defaultOrders: Order[] = [
        {
          id: 'ped-1002',
          clientName: "Moisés Alves",
          clientEmail: "moises@exemplo.com",
          items: [
            { id: 'heineken-330ml', title: "Cerveja Heineken Long Neck (330ml)", price: 7.90, quantity: 4 },
            { id: 'monster-energy', title: "Energético Monster Energy Tradicional (473ml)", price: 9.90, quantity: 2 }
          ],
          total: 51.40,
          status: 'Aprovado',
          createdAt: new Date(Date.now() - 3600000 * 2).toLocaleDateString('pt-BR') + ' ' + new Date(Date.now() - 3600000 * 2).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
          address: "Rua das Palmeiras, 105 - Centro, Blumenau - SC"
        },
        {
          id: 'ped-1003',
          clientName: "Ana Silva",
          clientEmail: "ana@exemplo.com",
          items: [
            { id: 'ignite-v50', title: "Vape Pod Ignite V50 Mentol (5000 Puffs)", price: 89.90, quantity: 1 }
          ],
          total: 89.90,
          status: 'Pendente',
          createdAt: new Date(Date.now() - 600000).toLocaleDateString('pt-BR') + ' ' + new Date(Date.now() - 600000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
          address: "Av. Beira Rio, 450, Ap 402 - Centro, Blumenau - SC"
        },
        {
          id: 'ped-1001',
          clientName: "Carlos Souza",
          clientEmail: "carlos@exemplo.com",
          items: [
            { id: 'fone-bluetooth', title: "Fone de Ouvido Bluetooth JBL Wave Flex", price: 289.90, quantity: 1 },
            { id: 'coca-cola-350ml', title: "Refrigerante Coca-Cola Sem Açúcar Lata (350ml)", price: 4.50, quantity: 3 }
          ],
          total: 303.40,
          status: 'Entregue',
          createdAt: new Date(Date.now() - 3600000 * 24).toLocaleDateString('pt-BR') + ' ' + new Date(Date.now() - 3600000 * 24).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
          address: "Rua Joinville, 88 - Vila Nova, Blumenau - SC"
        }
      ];
      localStorage.setItem('app-orders', JSON.stringify(defaultOrders));
      setOrders(defaultOrders);
    }

    // 3. Clients
    const storedClients = localStorage.getItem('app-clients');
    if (storedClients) {
      setClients(JSON.parse(storedClients));
    } else {
      const defaultClients: Client[] = [
        {
          id: 'cli-001',
          name: "Moisés Alves",
          email: "moises@exemplo.com",
          role: "Cliente",
          diamonds: 320,
          createdAt: "10/05/2026"
        },
        {
          id: 'cli-002',
          name: "Ana Silva",
          email: "ana@exemplo.com",
          role: "Cliente",
          diamonds: 140,
          createdAt: "12/05/2026"
        },
        {
          id: 'cli-003',
          name: "Carlos Souza",
          email: "carlos@exemplo.com",
          role: "Cliente",
          diamonds: 890,
          createdAt: "01/05/2026"
        },
        {
          id: 'cli-admin',
          name: "Administrador Geral",
          email: "admin@mercado.com",
          role: "Admin",
          diamonds: 9999,
          createdAt: "01/01/2026"
        }
      ];
      localStorage.setItem('app-clients', JSON.stringify(defaultClients));
      setClients(defaultClients);
    }
  }, []);

  // Sync Products to localStore on changes
  const saveProducts = (updatedProds: Product[]) => {
    localStorage.setItem('app-products', JSON.stringify(updatedProds));
    setProducts(updatedProds);
    // Dispatch event to warn storefront in real-time
    window.dispatchEvent(new Event('app-products-updated'));
  };

  // Sync Orders on changes
  const saveOrders = (updatedOrders: Order[]) => {
    localStorage.setItem('app-orders', JSON.stringify(updatedOrders));
    setOrders(updatedOrders);
  };

  // Sync Clients on changes
  const saveClients = (updatedClients: Client[]) => {
    localStorage.setItem('app-clients', JSON.stringify(updatedClients));
    setClients(updatedClients);
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
    }
  };

  // PRODUCT CRUD IMPLEMENTATION
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setProdTitle('');
    setProdPrice('');
    setProdImage('');
    setProdCategory('Bebidas');
    setProdBadge('');
    setProdBadgeStyle('orange');
    setProdDiamondReward('');
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setProdTitle(product.title);
    setProdPrice(product.price.toString());
    setProdImage(product.image);
    setProdCategory(product.category);
    setProdBadge(product.badge || '');
    setProdBadgeStyle(product.badgeStyle || 'orange');
    setProdDiamondReward(product.diamondReward ? product.diamondReward.toString() : '');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle || !prodPrice || !prodImage) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const priceNum = parseFloat(prodPrice);
    if (isNaN(priceNum)) {
      alert('Insira um preço válido.');
      return;
    }

    const diamondRewardNum = prodDiamondReward ? parseInt(prodDiamondReward) : undefined;

    if (editingProduct) {
      // Edit mode
      const updated = products.map(p => 
        p.id === editingProduct.id 
          ? { 
              ...p, 
              title: prodTitle, 
              price: priceNum, 
              image: prodImage, 
              category: prodCategory,
              badge: prodBadge || undefined,
              badgeStyle: prodBadgeStyle,
              diamondReward: diamondRewardNum
            } 
          : p
      );
      saveProducts(updated);
    } else {
      // Add mode
      const newProduct: Product = {
        id: 'prod-' + Date.now(),
        title: prodTitle,
        price: priceNum,
        image: prodImage,
        category: prodCategory,
        badge: prodBadge || undefined,
        badgeStyle: prodBadgeStyle,
        diamondReward: diamondRewardNum
      };
      saveProducts([...products, newProduct]);
    }

    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (window.confirm('Tem certeza absoluta que deseja excluir este produto do catálogo?')) {
      const updated = products.filter(p => p.id !== id);
      saveProducts(updated);
    }
  };

  // ORDER ACTIONS
  const handleUpdateOrderStatus = (orderId: string, nextStatus: 'Pendente' | 'Aprovado' | 'Saiu para Entrega' | 'Entregue') => {
    const updated = orders.map(o => 
      o.id === orderId ? { ...o, status: nextStatus } : o
    );
    saveOrders(updated);
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: nextStatus });
    }
  };

  // CLIENT ACTIONS (Award Diamonds)
  const handleOpenAwardModal = (client: Client) => {
    setSelectedClient(client);
    setAwardAmount('50');
    setIsAwardModalOpen(true);
  };

  const handleSaveAward = () => {
    if (!selectedClient) return;
    const amountNum = parseInt(awardAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Por favor, preencha uma quantidade válida de diamantes.');
      return;
    }

    const updated = clients.map(c => 
      c.id === selectedClient.id ? { ...c, diamonds: c.diamonds + amountNum } : c
    );
    saveClients(updated);
    setIsAwardModalOpen(false);
    alert(`Bônus de ${amountNum} 💎 creditado para ${selectedClient.name} com sucesso!`);
  };

  // Calculate Dashboard Metrics
  const totalRevenue = orders
    .filter(o => o.status !== 'Pendente')
    .reduce((acc, o) => acc + o.total, 0);

  const averageTicket = orders.length > 0 
    ? totalRevenue / orders.filter(o => o.status !== 'Pendente').length 
    : 0;

  const totalDiamondsInCirculation = clients.reduce((acc, c) => acc + c.diamonds, 0);

  // Filter & Search Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchProduct.toLowerCase());
    const matchesCategory = filterCategory === 'Todos' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #020617 0%, #0b0f19 50%, #020617 100%)',
      color: '#fff',
      fontFamily: 'Manrope, sans-serif',
      paddingBottom: '40px'
    }}>
      {/* GLOW DECORATIONS */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, rgba(212,175,55,0) 70%)',
        top: '5%',
        right: '5%',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }}></div>

      {/* PREMIUM HEADER PANEL */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)',
            borderRadius: '10px',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(212,175,55,0.3)'
          }}>
            <Gem size={18} color="#000" />
          </div>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Console Administrativo</h1>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#FFDF73', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mercado Nosso Jeito</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '6px 12px',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '11px',
            fontWeight: 800,
            textDecoration: 'none',
            transition: 'all 0.3s ease'
          }} className="btn-hover-scale">
            <Store size={14} color="#FFDF73" />
            <span>Ver Loja</span>
          </Link>

          <button onClick={handleLogout} style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }} className="btn-hover-scale">
            <Power size={14} />
          </button>
        </div>
      </header>

      {/* CORE ADMIN LAYOUT */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px 16px', position: 'relative', zIndex: 1 }}>
        {/* TAB NAVIGATION ROW */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '24px',
          gap: '4px'
        }}>
          {(['dashboard', 'produtos', 'pedidos', 'clientes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                height: '36px',
                background: activeTab === tab ? 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: activeTab === tab ? '#000' : 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {tab === 'pedidos' ? 'Pedidos' : tab === 'produtos' ? 'Produtos' : tab === 'clientes' ? 'Clientes' : 'Estatísticas'}
            </button>
          ))}
        </div>

        {/* ======================= TAB 1: DASHBOARD STATS ======================= */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              
              {/* Stat card 1: Revenue */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px solid rgba(212, 175, 55, 0.15)',
                borderRadius: '16px',
                padding: '16px',
                position: 'relative',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.03)'
              }}>
                <TrendingUp size={16} color="#D4AF37" style={{ position: 'absolute', top: '16px', right: '16px' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Faturamento</span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: '8px 0 2px' }}>R$ {totalRevenue.toFixed(2)}</h3>
                <span style={{ fontSize: '9px', color: '#10B981', fontWeight: 700 }}>⚡ Aprovados/Entregues</span>
              </div>

              {/* Stat card 2: Orders Count */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '16px',
                position: 'relative'
              }}>
                <ShoppingBag size={16} color="#0EA5E9" style={{ position: 'absolute', top: '16px', right: '16px' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Pedidos Totais</span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: '8px 0 2px' }}>{orders.length}</h3>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Fluxo operacional total</span>
              </div>

              {/* Stat card 3: Ticket Medio */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '16px',
                position: 'relative'
              }}>
                <Gem size={16} color="#10B981" style={{ position: 'absolute', top: '16px', right: '16px' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Ticket Médio</span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: '8px 0 2px' }}>R$ {averageTicket.toFixed(2)}</h3>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Valor médio por compra</span>
              </div>

              {/* Stat card 4: Active Clients */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '16px',
                position: 'relative'
              }}>
                <Users size={16} color="#EC4899" style={{ position: 'absolute', top: '16px', right: '16px' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Clientes</span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: '8px 0 2px' }}>{clients.filter(c => c.role !== 'Admin').length}</h3>
                <span style={{ fontSize: '9px', color: '#EC4899', fontWeight: 700 }}>💎 {totalDiamondsInCirculation} 💎 em jogo</span>
              </div>

            </div>

            {/* Recent Orders Sneak-Peek */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 900, margin: '0 0 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📦</span>
                <span>Pedidos Pendentes de Homologação</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').map(order => (
                  <div 
                    key={order.id}
                    onClick={() => { setSelectedOrder(order); setActiveTab('pedidos'); }}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    className="admin-list-item-click"
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#fff' }}>{order.clientName}</span>
                        <span style={{
                          fontSize: '8px',
                          fontWeight: 900,
                          padding: '2px 6px',
                          borderRadius: '99px',
                          background: order.status === 'Pendente' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                          color: order.status === 'Pendente' ? '#f59e0b' : '#10b981',
                          border: order.status === 'Pendente' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(16,185,129,0.2)'
                        }}>{order.status}</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{order.createdAt}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#FFDF73' }}>R$ {order.total.toFixed(2)}</span>
                      <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                    </div>
                  </div>
                ))}
                {orders.filter(o => o.status === 'Pendente' || o.status === 'Aprovado').length === 0 && (
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '12px 0' }}>Tudo em ordem! Nenhum pedido pendente de triagem.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 2: PRODUCTS MANAGER (CRUD) ======================= */}
        {activeTab === 'produtos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Action Bar */}
            <div style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {/* Search Product */}
              <div style={{
                position: 'relative',
                flex: 1,
                minWidth: '200px'
              }}>
                <Search size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Pesquisar produto pelo nome..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    background: 'rgba(15, 23, 42, 0.45)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Category Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '0 10px',
                  height: '38px'
                }}>
                  <Filter size={12} color="#FFDF73" style={{ marginRight: '6px' }} />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12.5px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Todos" style={{background:'#0f172a'}}>Todas Categorias</option>
                    <option value="Bebidas" style={{background:'#0f172a'}}>Bebidas</option>
                    <option value="Tabacaria" style={{background:'#0f172a'}}>Tabacaria</option>
                    <option value="Eletrônicos" style={{background:'#0f172a'}}>Eletrônicos</option>
                  </select>
                </div>

                {/* Add Product Button */}
                <button 
                  onClick={handleOpenAddModal}
                  style={{
                    height: '38px',
                    background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '12px',
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(212,175,55,0.2)'
                  }}
                >
                  <Plus size={14} />
                  <span>Cadastrar</span>
                </button>
              </div>
            </div>

            {/* Products Table/List */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              overflowX: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Produto</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Preço</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Categoria</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Selo/Missão</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr 
                      key={product.id} 
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      className="admin-table-row-hover"
                    >
                      <td style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={product.image} 
                          alt={product.title} 
                          style={{ width: '36px', height: '36px', objectFit: 'contain', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }} 
                        />
                        <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#fff', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.title}</span>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: 900, color: '#FFDF73' }}>
                        R$ {product.price.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                        {product.category}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {product.badge && (
                            <span style={{
                              alignSelf: 'flex-start',
                              fontSize: '8px',
                              fontWeight: 900,
                              background: product.badgeStyle === 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.12)',
                              color: product.badgeStyle === 'light' ? '#fff' : '#f59e0b',
                              border: product.badgeStyle === 'light' ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(245,158,11,0.2)',
                              padding: '1px 6px',
                              borderRadius: '99px'
                            }}>{product.badge}</span>
                          )}
                          {product.diamondReward && (
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <span>💎</span>
                              <span>+{product.diamondReward}</span>
                            </span>
                          )}
                          {!product.badge && !product.diamondReward && (
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Nenhum</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleOpenEditModal(product)}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#FFDF73',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ef4444',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: ORDERS TRACKING ======================= */}
        {activeTab === 'pedidos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            
            {/* Orders Dashboard Grid layout split on desk, sequential on mobile */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 900, margin: 0, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Fila Operacional de Pedidos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {orders.map(order => (
                  <div 
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.45)',
                      border: selectedOrder?.id === order.id ? '1.2px solid rgba(212, 175, 55, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '16px',
                      padding: '16px',
                      cursor: 'pointer',
                      boxShadow: selectedOrder?.id === order.id ? '0 4px 20px rgba(212,175,55,0.12)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 900, color: '#fff' }}>{order.clientName}</span>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#FFDF73' }}>#{order.id}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{order.createdAt}</span>
                      </div>

                      <span style={{
                        fontSize: '9px',
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: '99px',
                        background: 
                          order.status === 'Pendente' ? 'rgba(245,158,11,0.12)' : 
                          order.status === 'Aprovado' ? 'rgba(14,165,233,0.12)' :
                          order.status === 'Saiu para Entrega' ? 'rgba(99,102,241,0.12)' :
                          'rgba(16,185,129,0.12)',
                        color: 
                          order.status === 'Pendente' ? '#f59e0b' : 
                          order.status === 'Aprovado' ? '#0ea5e9' :
                          order.status === 'Saiu para Entrega' ? '#818cf8' :
                          '#10b981',
                        border: 
                          order.status === 'Pendente' ? '1px solid rgba(245,158,11,0.2)' : 
                          order.status === 'Aprovado' ? '1px solid rgba(14,165,233,0.2)' :
                          order.status === 'Saiu para Entrega' ? '1px solid rgba(99,102,241,0.2)' :
                          '1px solid rgba(16,185,129,0.2)'
                      }}>{order.status}</span>
                    </div>

                    {/* Order summary */}
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', margin: '0 0 10px 0', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {order.items.map(i => `${i.quantity}x ${i.title}`).join(', ')}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor Total</span>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#FFDF73' }}>R$ {order.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ORDER DETAIL FLOATING MODAL/DRAWER */}
            {selectedOrder && (
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 100,
                backdropFilter: 'blur(4px)'
              }}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1.2px solid rgba(212,175,55,0.3)',
                  borderRadius: '20px',
                  width: '100%',
                  maxWidth: '450px',
                  padding: '24px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                  position: 'relative'
                }}>
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>

                  <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>Detalhes do Pedido #{selectedOrder.id}</h3>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Realizado em {selectedOrder.createdAt}</span>

                  <div style={{ margin: '16px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 0' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Itens Comprados</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedOrder.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>{item.quantity}x {item.title}</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Endereço de Entrega</h4>
                    <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: '1.4' }}>{selectedOrder.address}</p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 850 }}>Valor Total:</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#FFDF73' }}>R$ {selectedOrder.total.toFixed(2)}</span>
                  </div>

                  <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>Alterar Status Operacional</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    <button 
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'Pendente')}
                      style={{
                        height: '34px',
                        background: selectedOrder.status === 'Pendente' ? '#f59e0b' : 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        color: selectedOrder.status === 'Pendente' ? '#000' : '#fff',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >Pendente</button>
                    <button 
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'Aprovado')}
                      style={{
                        height: '34px',
                        background: selectedOrder.status === 'Aprovado' ? '#0ea5e9' : 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        color: selectedOrder.status === 'Aprovado' ? '#000' : '#fff',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >Aprovado</button>
                    <button 
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'Saiu para Entrega')}
                      style={{
                        height: '34px',
                        background: selectedOrder.status === 'Saiu para Entrega' ? '#818cf8' : 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        color: selectedOrder.status === 'Saiu para Entrega' ? '#000' : '#fff',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >Em Trânsito</button>
                    <button 
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'Entregue')}
                      style={{
                        height: '34px',
                        background: selectedOrder.status === 'Entregue' ? '#10b981' : 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        color: selectedOrder.status === 'Entregue' ? '#000' : '#fff',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >Entregue</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 4: CLIENTS MANAGER ======================= */}
        {activeTab === 'clientes' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            overflowX: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Cliente</th>
                  <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>E-mail</th>
                  <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Fidelidade</th>
                  <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr 
                    key={client.id} 
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    className="admin-table-row-hover"
                  >
                    <td style={{ padding: '12px 8px', fontSize: '12.5px', fontWeight: 800, color: '#fff' }}>
                      {client.name}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      {client.email}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 900,
                        padding: '2px 6px',
                        borderRadius: '99px',
                        background: client.role === 'Admin' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)',
                        color: client.role === 'Admin' ? '#D4AF37' : 'rgba(255,255,255,0.6)',
                        border: client.role === 'Admin' ? '1px solid rgba(212,175,55,0.2)' : '1px solid rgba(255,255,255,0.08)'
                      }}>{client.role}</span>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: 900, color: '#10B981' }}>
                      💎 {client.diamonds}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {client.role !== 'Admin' ? (
                        <button 
                          onClick={() => handleOpenAwardModal(client)}
                          style={{
                            background: 'rgba(16,185,129,0.08)',
                            border: '1px solid rgba(16,185,129,0.2)',
                            borderRadius: '8px',
                            color: '#10b981',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Award size={12} />
                          <span>Premiar</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Nenhuma</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {/* =========================================================
         PRODUCT ADD/EDIT FULL MODAL DIALOG
      ========================================================= */}
      {isProductModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
          fontFamily: 'Manrope, sans-serif'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.2px solid rgba(212,175,55,0.3)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setIsProductModalOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#fff', margin: '0 0 16px' }}>
              {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </h3>

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Product Title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Título do Produto *</label>
                <input 
                  type="text" 
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  placeholder="Ex: Cerveja Heineken Long Neck (330ml)"
                  style={{
                    width: '100%',
                    height: '36px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '0 10px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Price & Category row */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* Price */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Preço (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="7.90"
                    style={{
                      width: '100%',
                      height: '36px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '0 10px',
                      color: '#fff',
                      fontSize: '12.5px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Category */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Categoria *</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '0 8px',
                      color: '#fff',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  >
                    <option value="Bebidas">Bebidas</option>
                    <option value="Tabacaria">Tabacaria</option>
                    <option value="Eletrônicos">Eletrônicos</option>
                  </select>
                </div>
              </div>

              {/* Product Image URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>URL da Imagem *</label>
                <input 
                  type="text" 
                  value={prodImage}
                  onChange={(e) => setProdImage(e.target.value)}
                  placeholder="https://images.unsplash.com/... ou caminhos"
                  style={{
                    width: '100%',
                    height: '36px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '0 10px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Promo Badge & Reward */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* Badge text */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Selo Promocional</label>
                  <input 
                    type="text" 
                    value={prodBadge}
                    onChange={(e) => setProdBadge(e.target.value)}
                    placeholder="Ex: Trincando, Novo"
                    style={{
                      width: '100%',
                      height: '36px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '0 10px',
                      color: '#fff',
                      fontSize: '12.5px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Diamonds Reward */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Bônus 💎 Clube</label>
                  <input 
                    type="number" 
                    value={prodDiamondReward}
                    onChange={(e) => setProdDiamondReward(e.target.value)}
                    placeholder="Ex: 5"
                    style={{
                      width: '100%',
                      height: '36px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '0 10px',
                      color: '#fff',
                      fontSize: '12.5px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Badge Style select if badge exists */}
              {prodBadge && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Estilo do Selo</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="badgeStyle" 
                        value="orange" 
                        checked={prodBadgeStyle === 'orange'} 
                        onChange={() => setProdBadgeStyle('orange')}
                      />
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>Dourado/Laranja</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="badgeStyle" 
                        value="light" 
                        checked={prodBadgeStyle === 'light'} 
                        onChange={() => setProdBadgeStyle('light')}
                      />
                      <span>Translúcido Light</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Save Product Submit */}
              <button
                type="submit"
                style={{
                  height: '40px',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginTop: '10px',
                  boxShadow: '0 6px 20px rgba(212,175,55,0.2)'
                }}
              >
                Salvar Produto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
         AWARD DIAMONDS FULL MODAL DIALOG
      ========================================================= */}
      {isAwardModalOpen && selectedClient && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
          fontFamily: 'Manrope, sans-serif'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.2px solid rgba(212,175,55,0.3)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '380px',
            padding: '24px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setIsAwardModalOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>Premiar Cliente com Diamantes</h3>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Creditando saldo de fidelidade para {selectedClient.name}</span>

            <div style={{ margin: '16px 0 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Saldo Atual:</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#10B981' }}>💎 {selectedClient.diamonds}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Quantidade de Diamantes</label>
                <input 
                  type="number" 
                  value={awardAmount}
                  onChange={(e) => setAwardAmount(e.target.value)}
                  placeholder="50"
                  style={{
                    width: '100%',
                    height: '38px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '0 10px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleSaveAward}
              style={{
                width: '100%',
                height: '40px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 900,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(16,185,129,0.2)'
              }}
            >
              Confirmar Premiação 💎
            </button>
          </div>
        </div>
      )}

      <style>{`
        .btn-hover-scale:active {
          transform: scale(0.96) !important;
        }
        .admin-list-item-click:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(212,175,55,0.25) !important;
        }
        .admin-table-row-hover:hover {
          background: rgba(255,255,255,0.02) !important;
        }
      `}</style>
    </div>
  );
};
