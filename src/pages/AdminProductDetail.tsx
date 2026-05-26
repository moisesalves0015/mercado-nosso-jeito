import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ArrowLeft, Save, Package, DollarSign, Target,
  Image as ImageIcon, Shield, AlertCircle, BarChart2,
  TrendingUp, Tag, Zap, Star, Flame, ShoppingBag,
  Clock, Box, ArrowUp, ArrowDown, RefreshCw, CheckCircle, Info,
  Percent, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// ─── CONSTANTS & HELPERS ──────────────────────────────────────────────────────
const DIAMOND_VALUE = 0.01;
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

// ─── COMMERCIAL FLAGS ─────────────────────────────────────────────────────────
const ALL_FLAGS = [
  { id: 'super-oferta',     label: 'Super Oferta',       emoji: '🔥', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
  { id: 'mais-vendido',     label: 'Mais Vendido',        emoji: '📈', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)' },
  { id: 'destaque',         label: 'Destaque',            emoji: '⭐', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  { id: 'promocao',         label: 'Promoção',            emoji: '🏷️', color: '#ec4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.35)' },
  { id: 'oferta-relampago', label: 'Oferta Relâmpago',   emoji: '⚡', color: '#FFDF73', bg: 'rgba(212,175,55,0.12)',  border: 'rgba(212,175,55,0.35)' },
  { id: 'novidade',         label: 'Novidade',            emoji: '🆕', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.35)' },
  { id: 'recomendado',      label: 'Recomendado',         emoji: '👍', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.35)' },
  { id: 'queima-estoque',   label: 'Queima de Estoque',  emoji: '🚨', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)' },
  { id: 'combo',            label: 'Combo',               emoji: '🤝', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
];

// ─── IMAGE COMPRESSION ────────────────────────────────────────────────────────
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

// ─── TOOLTIP FOR RECHARTS ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) return (
    <div style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ color: '#FFDF73', fontWeight: 900, fontSize: 12, margin: '0 0 4px' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#fff', fontSize: 11, margin: 0, fontWeight: 700 }}>
          {p.name}: {typeof p.value === 'number' && p.name !== 'unidades' ? `R$ ${p.value.toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
  return null;
};

// ─── SKELETON LOADER ──────────────────────────────────────────────────────────
const Skeleton = ({ w = '100%', h = 20, radius = 8 }: { w?: string | number; h?: number; radius?: number }) => (
  <div style={{ width: w, height: h, borderRadius: radius, background: 'rgba(255,255,255,0.05)', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
);

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color, trend }: any) => (
  <div style={{
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16, padding: '16px 14px', position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={14} color={color} />
    </div>
    <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '6px 0 4px', letterSpacing: -0.5 }}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {trend !== undefined && (trend >= 0 ? <ArrowUp size={10} color="#10b981" /> : <ArrowDown size={10} color="#ef4444" />)}
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{sub}</span>
    </div>
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export const AdminProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  // ── UI State ──
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'analytics' | 'financeiro' | 'marketing' | 'estoque'>('dados');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [stockAdjustVal, setStockAdjustVal] = useState('');
  const [stockAdjustNote, setStockAdjustNote] = useState('');
  const [savingStockAdj, setSavingStockAdj] = useState(false);

  // ── Form State (ORIGINAL — preserved) ──
  const [active, setActive] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Bebidas');
  const [image, setImage] = useState('');
  const [tags, setTags] = useState('');
  const [badge, setBadge] = useState('');
  const [badgeStyle, setBadgeStyle] = useState<'orange' | 'light'>('orange');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [diamondReward, setDiamondReward] = useState('');
  const [targetMargin, setTargetMargin] = useState('35');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [promoActive, setPromoActive] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState('');
  const [availableInRoulette, setAvailableInRoulette] = useState(false);

  // ── New State ──
  const [flags, setFlags] = useState<string[]>([]);
  const [promoExpiry, setPromoExpiry] = useState('');
  const [stockHistory, setStockHistory] = useState<{ delta: number; note: string; date: string }[]>([]);

  // ── Analytics Data ──
  const [ordersData, setOrdersData] = useState<{ totalOrders: number; totalQty: number; totalRevenue: number; chartData: any[] }>({
    totalOrders: 0, totalQty: 0, totalRevenue: 0, chartData: []
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ─── Load Product ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNew && id) loadProduct(id);
  }, [id]);

  const loadProduct = async (prodId: string) => {
    try {
      const snap = await getDoc(doc(db, 'products', prodId));
      if (snap.exists()) {
        const p = snap.data();
        setTitle(p.title || '');
        setDescription(p.description || '');
        setCategory(p.category || 'Bebidas');
        setImage(p.image || '');
        setTags(p.tags || '');
        setBadge(p.badge || '');
        setBadgeStyle(p.badgeStyle || 'orange');
        setCostPrice(p.costPrice?.toString() || '');
        setPrice(p.price?.toString() || '');
        setDiamondReward(p.diamondReward?.toString() || '');
        setStock(p.stock?.toString() || '');
        setMinStock(p.minStock?.toString() || '');
        setPromoActive(p.promoActive || false);
        setPromoDiscount(p.promoDiscount?.toString() || '');
        setAvailableInRoulette(p.availableInRoulette || false);
        setActive(p.active ?? true);
        setFlags(p.flags || []);
        setPromoExpiry(p.promoExpiry || '');
        setStockHistory(p.stockHistory || []);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao carregar produto.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Load Analytics ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'analytics' && !isNew && id) loadAnalytics(id);
  }, [activeTab, id]);

  const loadAnalytics = async (prodId: string) => {
    setLoadingAnalytics(true);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      let totalOrders = 0;
      let totalQty = 0;
      let totalRevenue = 0;
      const dayMap: Record<string, { receita: number; unidades: number }> = {};

      allOrders.forEach(order => {
        const items = order.items || [];
        const productItems = items.filter((item: any) =>
          item.id === prodId || item.title === title
        );
        if (productItems.length > 0) {
          totalOrders++;
          productItems.forEach((item: any) => {
            totalQty += item.quantity || 1;
            totalRevenue += (item.price || 0) * (item.quantity || 1);
          });

          // Group by day for chart
          const date = order.createdAt ? new Date(order.createdAt) : new Date();
          const dayKey = date.toLocaleDateString('pt-BR', { weekday: 'short' });
          if (!dayMap[dayKey]) dayMap[dayKey] = { receita: 0, unidades: 0 };
          productItems.forEach((item: any) => {
            dayMap[dayKey].receita += (item.price || 0) * (item.quantity || 1);
            dayMap[dayKey].unidades += item.quantity || 1;
          });
        }
      });

      const chartData = Object.entries(dayMap).map(([day, v]) => ({ day, ...v }));
      setOrdersData({ totalOrders, totalQty, totalRevenue, chartData });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // ─── Image Upload ──────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
    } catch { alert('Erro ao processar imagem.'); }
    finally { setUploadingImg(false); }
  };

  // ─── Toggle Flag ───────────────────────────────────────────────────────────
  const toggleFlag = (flagId: string) => {
    setFlags(prev => prev.includes(flagId) ? prev.filter(f => f !== flagId) : [...prev, flagId]);
  };

  // ─── Stock Adjustment ─────────────────────────────────────────────────────
  const handleStockAdjust = async (delta: number) => {
    const currentStock = parseInt(stock) || 0;
    const newStock = Math.max(0, currentStock + delta);
    const note = stockAdjustNote.trim() || (delta > 0 ? 'Entrada manual' : 'Saída manual');
    const entry = { delta, note, date: new Date().toISOString() };

    setSavingStockAdj(true);
    try {
      const newHistory = [entry, ...stockHistory].slice(0, 20);
      if (!isNew && id) {
        await updateDoc(doc(db, 'products', id), {
          stock: newStock,
          stockHistory: newHistory,
        });
      }
      setStock(newStock.toString());
      setStockHistory(newHistory);
      setStockAdjustNote('');
    } catch (e) {
      alert('Erro ao ajustar estoque.');
    } finally {
      setSavingStockAdj(false);
    }
  };

  // ─── Save (ORIGINAL logic + new fields) ────────────────────────────────────
  const handleSave = async () => {
    if (!title || !price || !image) {
      alert('Preencha nome, preço e imagem.');
      return;
    }

    const pPrice = parseFloat(price);
    const pCost = costPrice ? parseFloat(costPrice) : undefined;
    const pDiamonds = diamondReward ? parseInt(diamondReward) : undefined;

    if (pCost && pDiamonds !== undefined) {
      const margin = calcRealMargin(pPrice, pCost, pDiamonds);
      if (margin !== null && margin < 0) {
        alert('⛔ Não é possível salvar um produto com margem negativa (Prejuízo).');
        return;
      }
    }

    setSaving(true);

    // Build raw data — then strip undefined to satisfy Firestore
    const rawData: Record<string, any> = {
      title,
      description,
      category,
      image,
      tags,
      badge,
      badgeStyle,
      price: pPrice,
      costPrice: pCost || null,
      diamondReward: pDiamonds || null,
      stock: stock ? parseInt(stock) : null,
      minStock: minStock ? parseInt(minStock) : null,
      promoActive,
      promoDiscount: promoDiscount ? parseFloat(promoDiscount) : null,
      promoExpiry: promoExpiry || null,
      availableInRoulette,
      active,
      flags,
      stockHistory,
      updatedAt: new Date().toISOString(),
    };

    // Remove null/undefined so Firestore doesn't complain
    const data = Object.fromEntries(
      Object.entries(rawData).filter(([, v]) => v !== undefined && v !== null)
    );


    try {
      if (isNew) {
        const newId = 'prod-' + Date.now();
        await setDoc(doc(db, 'products', newId), { id: newId, ...data, createdAt: new Date().toISOString() });
      } else {
        await updateDoc(doc(db, 'products', id!), data);
      }
      alert('Produto salvo com sucesso!');
      navigate('/admin');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Computed Values ───────────────────────────────────────────────────────
  const wizPrice = parseFloat(price) || 0;
  const wizCost = parseFloat(costPrice) || 0;
  const wizDiamonds = parseInt(diamondReward) || 0;
  const wizMargin = calcRealMargin(wizPrice, wizCost, wizDiamonds);
  const wizProfit = wizPrice > 0 ? wizPrice - wizCost - calcDiamondCost(wizDiamonds) : 0;

  const marginColor = wizMargin === null ? '#818cf8'
    : wizMargin < 0 ? '#ef4444'
    : wizMargin < 15 ? '#f97316'
    : wizMargin < 30 ? '#f59e0b'
    : '#10b981';

  const stockNum = parseInt(stock) || 0;
  const minStockNum = parseInt(minStock) || 0;
  const stockPct = minStockNum > 0 ? Math.min(100, Math.round((stockNum / (minStockNum * 3)) * 100)) : 50;
  const stockStatus = stockNum === 0 ? { label: 'Zerado', color: '#ef4444' }
    : minStockNum > 0 && stockNum <= minStockNum ? { label: 'Crítico', color: '#ef4444' }
    : minStockNum > 0 && stockNum <= minStockNum * 1.5 ? { label: 'Atenção', color: '#f59e0b' }
    : { label: 'OK', color: '#10b981' };

  const promoPrice = wizPrice > 0 && promoDiscount ? wizPrice * (1 - parseFloat(promoDiscount) / 100) : 0;

  // Scenario calculator
  const scenarios = [10, 50, 100].map(units => ({
    units,
    revenue: wizPrice * units,
    profit: wizProfit * units,
    margin: wizMargin,
  }));
  const discountScenarios = [10, 20].map(disc => {
    const discountedPrice = wizPrice * (1 - disc / 100);
    const discProfit = discountedPrice - wizCost - calcDiamondCost(wizDiamonds);
    const discMargin = wizCost > 0 ? ((discountedPrice - wizCost - calcDiamondCost(wizDiamonds)) / discountedPrice) * 100 : null;
    return { disc, discountedPrice, discProfit, discMargin };
  });

  // insights
  const generateInsights = () => {
    const insights: { type: 'success' | 'warning' | 'danger' | 'info'; text: string }[] = [];
    if (ordersData.totalOrders >= 5) insights.push({ type: 'success', text: `Alta recorrência — ${ordersData.totalOrders} pedidos registrados.` });
    else if (ordersData.totalOrders >= 2) insights.push({ type: 'info', text: `Recorrência moderada — ${ordersData.totalOrders} pedidos registrados.` });
    else insights.push({ type: 'warning', text: 'Poucas vendas registradas. Considere ativar uma promoção ou flag.' });

    if (wizMargin !== null) {
      if (wizMargin >= 30) insights.push({ type: 'success', text: `Margem saudável de ${wizMargin.toFixed(1)}% — produto lucrativo.` });
      else if (wizMargin >= 15) insights.push({ type: 'info', text: `Margem aceitável de ${wizMargin.toFixed(1)}%. Meta recomendada: 30%+.` });
      else if (wizMargin > 0) insights.push({ type: 'danger', text: `Margem em risco (${wizMargin.toFixed(1)}%). Considere aumentar o preço.` });
      else insights.push({ type: 'danger', text: 'Produto com PREJUÍZO. Corrija o preço imediatamente.' });
    } else {
      insights.push({ type: 'info', text: 'Cadastre o preço de custo para análise de margem completa.' });
    }

    if (stockNum > 0 && minStockNum > 0 && stockNum <= minStockNum) {
      insights.push({ type: 'danger', text: `Estoque crítico: ${stockNum} unidades (mínimo: ${minStockNum}).` });
    }

    if (flags.length === 0) insights.push({ type: 'info', text: 'Nenhuma flag comercial ativa. Use o painel de Marketing para destacar o produto.' });

    return insights;
  };

  // ─── Styles ────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '44px', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
    padding: '0 14px', color: '#fff', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'Manrope, sans-serif',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8,
  };
  const cardStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 20,
  };
  const sectionCard: React.CSSProperties = {
    background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 18, padding: '20px',
  };

  // ─── TABS CONFIG ───────────────────────────────────────────────────────────
  const TABS = [
    { key: 'dados' as const, label: 'Dados', icon: Package },
    { key: 'analytics' as const, label: 'Analytics', icon: BarChart2 },
    { key: 'financeiro' as const, label: 'Financeiro', icon: DollarSign },
    { key: 'marketing' as const, label: 'Marketing', icon: Tag },
    { key: 'estoque' as const, label: 'Estoque', icon: Box },
  ];

  // ─── SKELETON LOADER ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #020617 0%, #0b0f19 60%, #020617 100%)', paddingBottom: 80 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton w={160} h={16} />
          <Skeleton w={100} h={10} />
        </div>
      </div>
      <div style={{ maxWidth: 1000, margin: '30px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map(t => <Skeleton key={t.key} w={90} h={36} radius={10} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton h={180} radius={20} />
            <Skeleton h={140} radius={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton h={220} radius={20} />
            <Skeleton h={100} radius={20} />
          </div>
        </div>
      </div>
    </div>
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const activeFlags = ALL_FLAGS.filter(f => flags.includes(f.id));

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #020617 0%, #0b0f19 60%, #020617 100%)', paddingBottom: 100, fontFamily: 'Manrope, sans-serif' }}>

      {/* Background glows */}
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)', top: '-10%', right: '-5%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Main header row */}
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => navigate('/admin')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ color: '#fff', fontSize: 17, fontWeight: 900, margin: 0, letterSpacing: -0.3 }}>
                {isNew ? 'Novo Produto' : 'Central do Produto'}
              </h1>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}>
                {isNew ? 'Preencha os detalhes' : title || 'Carregando...'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{
                width: 36, height: 20, borderRadius: 99, background: active ? '#10b981' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.25s',
              }}>
                <div style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
              </div>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ display: 'none' }} />
              <span style={{ color: active ? '#10b981' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 800 }}>{active ? 'Ativo' : 'Pausado'}</span>
            </label>

            <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 10, padding: '0 20px', height: 40, display: 'flex', alignItems: 'center', gap: 8, color: '#000', fontSize: 13, fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Save size={15} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Status strip with active flags */}
        {!isNew && (title || activeFlags.length > 0) && (
          <div style={{ padding: '8px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {wizMargin !== null && (
              <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 99, background: `${marginColor}18`, color: marginColor, border: `1px solid ${marginColor}40`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Margem: {wizMargin.toFixed(1)}%
              </span>
            )}
            {stockNum > 0 && (
              <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 99, background: `${stockStatus.color}18`, color: stockStatus.color, border: `1px solid ${stockStatus.color}40`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Estoque: {stockNum} un • {stockStatus.label}
              </span>
            )}
            {activeFlags.map(f => (
              <span key={f.id} style={{ fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 99, background: f.bg, color: f.color, border: `1px solid ${f.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {f.emoji} {f.label}
              </span>
            ))}
          </div>
        )}
      </header>

      <main style={{ maxWidth: 1000, margin: '24px auto', padding: '0 20px', position: 'relative', zIndex: 1 }}>

        {/* ── TAB NAV ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px',
                background: isActive ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'rgba(15,23,42,0.6)',
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, color: isActive ? '#000' : 'rgba(255,255,255,0.55)',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'Manrope, sans-serif',
                boxShadow: isActive ? '0 4px 12px rgba(212,175,55,0.3)' : 'none',
              }}>
                <Icon size={13} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: DADOS (Original form — preserved exactly)
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dados' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Informações Básicas */}
              <div style={cardStyle}>
                <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={16} color="#D4AF37" /> Informações Básicas
                </h2>
                <div>
                  <label style={labelStyle}>Nome do Produto *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Ex: Cerveja Heineken Long Neck" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Categoria *</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Tabacaria">Tabacaria</option>
                      <option value="Eletrônicos">Eletrônicos</option>
                      <option value="Limpeza">Limpeza</option>
                      <option value="Doces">Doces/Snacks</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Tags (vírgula)</label>
                    <input type="text" value={tags} onChange={e => setTags(e.target.value)} style={inputStyle} placeholder="cerveja, gelada" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Descrição (Opcional)</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, height: 90, paddingTop: 12, resize: 'vertical' }} placeholder="Detalhes do produto..." />
                </div>
              </div>

              {/* Mídia */}
              <div style={cardStyle}>
                <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ImageIcon size={16} color="#0ea5e9" /> Mídia do Produto
                </h2>
                <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                  <div style={{ width: 110, height: 110, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {image ? <img src={image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" /> : <ImageIcon color="rgba(255,255,255,0.2)" size={28} />}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={labelStyle}>URL da Imagem</label>
                    <input type="text" value={image} onChange={e => setImage(e.target.value)} style={inputStyle} placeholder="https://..." />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 800 }}>OU</span>
                      <label style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 800, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <ImageIcon size={13} /> {uploadingImg ? 'Comprimindo...' : 'Upload'}
                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Destaques e Promoções */}
              <div style={cardStyle}>
                <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={16} color="#ec4899" /> Destaques e Promoções
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Badge (Etiqueta)</label>
                    <input type="text" value={badge} onChange={e => setBadge(e.target.value)} style={inputStyle} placeholder="Ex: Mais Vendido" />
                  </div>
                  <div>
                    <label style={labelStyle}>Cor do Badge</label>
                    <select value={badgeStyle} onChange={e => setBadgeStyle(e.target.value as any)} style={{ ...inputStyle, appearance: 'none' }}>
                      <option value="orange">Laranja (Destaque)</option>
                      <option value="light">Claro (Premium)</option>
                    </select>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 12, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <input type="checkbox" checked={availableInRoulette} onChange={e => setAvailableInRoulette(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#D4AF37' }} />
                  <div>
                    <span style={{ display: 'block', color: '#fff', fontSize: 13, fontWeight: 800 }}>Disponível na Roleta VIP</span>
                    <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Usuários podem ganhar este item como prêmio</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Precificação */}
              <div style={{ ...cardStyle, border: '1px solid rgba(212,175,55,0.25)' }}>
                <h2 style={{ color: '#FFDF73', fontSize: 14, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={16} /> Precificação
                </h2>
                <div>
                  <label style={labelStyle}>Preço de Venda (R$) *</label>
                  <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} style={{ ...inputStyle, fontSize: 20, fontWeight: 900, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Custo Unitário (R$)</label>
                    <input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Diamantes 💎</label>
                    <input type="number" value={diamondReward} onChange={e => setDiamondReward(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                {/* Live Margin Simulator */}
                {(wizCost > 0 || wizPrice > 0) && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 16, gap: 10, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 800 }}>Custo produto:</span>
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 900 }}>R$ {wizCost.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 800 }}>Custo em 💎:</span>
                      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 900 }}>R$ {calcDiamondCost(wizDiamonds).toFixed(2)}</span>
                    </div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    {wizMargin !== null && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, display: 'block', marginBottom: 3 }}>Margem Real</span>
                            <span style={{ fontSize: 26, fontWeight: 900, color: marginColor }}>{wizMargin.toFixed(1)}%</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, display: 'block', marginBottom: 3 }}>Lucro/Unidade</span>
                            <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>R$ {wizProfit.toFixed(2)}</span>
                          </div>
                        </div>
                        {/* Margin bar */}
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, wizMargin))}%`, height: '100%', background: marginColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                          <span>0%</span><span style={{ color: '#ef4444' }}>15% mín</span><span style={{ color: '#10b981' }}>30% ideal</span>
                        </div>
                      </>
                    )}
                    {wizMargin !== null && wizMargin < 0 && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={14} color="#ef4444" />
                        <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 800 }}>Prejuízo detectado! O salvamento será bloqueado.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Price suggestion */}
                {wizCost > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>Meta:</span>
                    <input type="number" value={targetMargin} onChange={e => setTargetMargin(e.target.value)} style={{ ...inputStyle, width: 55, height: 30, padding: 0, textAlign: 'center', fontSize: 12 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>%</span>
                    <button onClick={() => setPrice(calcSuggestedPrice(wizCost, wizDiamonds, parseFloat(targetMargin) || 35).toFixed(2))} style={{ height: 30, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, color: '#FFDF73', fontSize: 11, fontWeight: 900, cursor: 'pointer', padding: '0 12px', marginLeft: 'auto', fontFamily: 'Manrope, sans-serif' }}>
                      Sugerir Preço
                    </button>
                  </div>
                )}
              </div>

              {/* Estoque (quick) */}
              <div style={cardStyle}>
                <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={16} color="#818cf8" /> Controle de Estoque
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Estoque Atual</label>
                    <input type="number" value={stock} onChange={e => setStock(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Alerta Mínimo</label>
                    <input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} style={inputStyle} placeholder="Ex: 5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: ANALYTICS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* KPI row */}
            {loadingAnalytics ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={90} radius={16} />)}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <KpiCard label="Pedidos c/ este produto" value={ordersData.totalOrders} sub="Pedidos registrados" icon={ShoppingBag} color="#D4AF37" trend={ordersData.totalOrders > 0 ? 1 : 0} />
                <KpiCard label="Unidades Vendidas" value={ordersData.totalQty} sub="Total acumulado" icon={Activity} color="#10b981" trend={ordersData.totalQty > 0 ? 1 : 0} />
                <KpiCard label="Receita Gerada" value={`R$ ${ordersData.totalRevenue.toFixed(2)}`} sub="Faturamento real" icon={TrendingUp} color="#818cf8" trend={ordersData.totalRevenue > 0 ? 1 : 0} />
                <KpiCard label="Margem Atual" value={wizMargin !== null ? `${wizMargin.toFixed(1)}%` : '—'} sub={wizMargin !== null ? (wizMargin >= 30 ? '🟢 Saudável' : wizMargin >= 15 ? '🟡 Aceitável' : '🔴 Risco') : 'Sem custo cadastrado'} icon={Percent} color={marginColor} />
              </div>
            )}

            {/* Sales chart */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={15} color="#818cf8" /> Histórico de Vendas deste Produto
              </h3>
              {ordersData.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ordersData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `R$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="receita" fill="#D4AF37" radius={[6, 6, 0, 0]} name="receita" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(255,255,255,0.3)' }}>
                  <BarChart2 size={36} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Sem histórico de vendas</div>
                  <div style={{ fontSize: 11 }}>Este produto ainda não aparece em pedidos registrados.</div>
                </div>
              )}
            </div>

            {/* Insights */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={15} color="#FFDF73" /> Insights Automáticos
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {generateInsights().map((ins, i) => {
                  const cfg = {
                    success: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: CheckCircle },
                    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: AlertCircle },
                    danger:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   icon: AlertCircle },
                    info:    { color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)', icon: Info },
                  }[ins.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <Icon size={14} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 700, lineHeight: 1.5 }}>{ins.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: FINANCEIRO
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {wizCost <= 0 && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={16} color="#f59e0b" />
                <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>Cadastre o preço de custo na aba Dados para desbloquear cenários e simulações financeiras completas.</span>
              </div>
            )}

            {/* Volume scenarios */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={15} color="#10b981" /> Cenários de Volume de Vendas
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {scenarios.map(s => (
                  <div key={s.units} style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 14, padding: '16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>× {s.units} UNIDADES</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#FFDF73', marginBottom: 4 }}>R$ {s.revenue.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Faturamento previsto</div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
                    <div style={{ fontSize: 16, fontWeight: 900, color: wizCost > 0 ? (s.profit >= 0 ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.3)' }}>
                      {wizCost > 0 ? `R$ ${s.profit.toFixed(2)}` : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Lucro estimado</div>
                    {s.margin !== null && (
                      <div style={{ fontSize: 10, fontWeight: 900, marginTop: 8, color: marginColor }}>Margem: {s.margin.toFixed(1)}%</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Discount impact */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Percent size={15} color="#ec4899" /> Impacto de Descontos Promocionais
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {discountScenarios.map(d => {
                  const dc = d.discMargin !== null
                    ? (d.discMargin >= 30 ? '#10b981' : d.discMargin >= 15 ? '#f59e0b' : '#ef4444')
                    : 'rgba(255,255,255,0.3)';
                  return (
                    <div key={d.disc} style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 14, padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>DESCONTO DE {d.disc}%</span>
                        <span style={{ fontSize: 10, fontWeight: 900, background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', padding: '2px 8px', borderRadius: 99 }}>-{d.disc}%</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 2 }}>R$ {d.discountedPrice.toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                        <s style={{ color: 'rgba(255,255,255,0.25)' }}>R$ {wizPrice.toFixed(2)}</s>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Lucro/un</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: wizCost > 0 ? (d.discProfit >= 0 ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.3)' }}>
                            {wizCost > 0 ? `R$ ${d.discProfit.toFixed(2)}` : '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Margem</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: dc }}>
                            {d.discMargin !== null ? `${d.discMargin.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {wizCost <= 0 && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '10px 0 0', fontStyle: 'italic' }}>
                  * Cadastre o preço de custo para ver o lucro e a margem pós-desconto.
                </p>
              )}
            </div>

            {/* Margin health panel */}
            {wizMargin !== null && (
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={15} color="#818cf8" /> Saúde Financeira do Produto
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Margem Mínima Sustentável', value: 15, current: wizMargin },
                    { label: 'Margem Alvo Recomendada', value: 30, current: wizMargin },
                    { label: 'Margem Excelente', value: 40, current: wizMargin },
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{row.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: row.current >= row.value ? '#10b981' : '#ef4444' }}>
                          {row.current >= row.value ? '✓ Atingida' : `Faltam ${(row.value - row.current).toFixed(1)}%`}
                        </span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.max(0, (row.current / row.value) * 100))}%`, height: '100%', background: row.current >= row.value ? '#10b981' : '#ef4444', borderRadius: 99, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: MARKETING
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'marketing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Flags Grid */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={15} color="#ef4444" /> Flags Comerciais
              </h3>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px', lineHeight: 1.5 }}>
                Selecione as flags que se aplicam a este produto. Elas alimentam listas dinâmicas da loja e melhoram a visibilidade.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {ALL_FLAGS.map(flag => {
                  const isOn = flags.includes(flag.id);
                  return (
                    <button key={flag.id} onClick={() => toggleFlag(flag.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      background: isOn ? flag.bg : 'rgba(255,255,255,0.02)',
                      border: `1.5px solid ${isOn ? flag.border : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s ease', fontFamily: 'Manrope, sans-serif',
                      boxShadow: isOn ? `0 4px 16px ${flag.bg}` : 'none',
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{flag.emoji}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: isOn ? flag.color : 'rgba(255,255,255,0.6)' }}>{flag.label}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: isOn ? flag.color + '99' : 'rgba(255,255,255,0.25)', marginTop: 2 }}>{isOn ? '● Ativa' : '○ Inativa'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {flags.length > 0 && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#FFDF73' }}>
                    {flags.length} {flags.length === 1 ? 'flag ativa' : 'flags ativas'} — Salve o produto para persistir as alterações.
                  </span>
                </div>
              )}
            </div>

            {/* Promo Panel */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={15} color="#ec4899" /> Configuração de Promoção
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: promoActive ? 'rgba(236,72,153,0.08)' : 'rgba(255,255,255,0.02)', border: `1.5px solid ${promoActive ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                  <input type="checkbox" checked={promoActive} onChange={e => setPromoActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#ec4899' }} />
                  <div>
                    <span style={{ display: 'block', color: promoActive ? '#ec4899' : '#fff', fontSize: 13, fontWeight: 900 }}>Promoção Ativa</span>
                    <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Ativa o preço com desconto e exibe a badge de promoção</span>
                  </div>
                </label>

                {promoActive && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Desconto (%)</label>
                      <input type="number" min="1" max="90" value={promoDiscount} onChange={e => setPromoDiscount(e.target.value)} style={inputStyle} placeholder="Ex: 20" />
                    </div>
                    <div>
                      <label style={labelStyle}>Validade da Promoção</label>
                      <input type="datetime-local" value={promoExpiry} onChange={e => setPromoExpiry(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                )}

                {promoActive && promoDiscount && wizPrice > 0 && (
                  <div style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 6 }}>PRÉ-VISUALIZAÇÃO DO PREÇO</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#ec4899' }}>R$ {promoPrice.toFixed(2)}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>R$ {wizPrice.toFixed(2)}</span>
                      <span style={{ fontSize: 10, fontWeight: 900, background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', padding: '3px 8px', borderRadius: 99 }}>-{promoDiscount}%</span>
                    </div>
                    {promoExpiry && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={11} /> Válida até: {new Date(promoExpiry).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Combos sugeridos */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={15} color="#f59e0b" /> Combos Sugeridos por Categoria
              </h3>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 14px' }}>Ideias de produtos complementares para aumentar o ticket médio.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(category === 'Bebidas' ? [
                  { a: '🍺 Cerveja', b: '🔥 Carvão', tag: 'Churrasco' },
                  { a: '🥤 Refrigerante', b: '🍕 Pizza', tag: 'Jantar' },
                  { a: '⚡ Energético', b: '🍫 Snack', tag: 'Lanche' },
                ] : category === 'Tabacaria' ? [
                  { a: '🚬 Cigarro', b: '🔥 Isqueiro', tag: 'Essencial' },
                  { a: '🚬 Cigarro', b: '🥤 Bebida', tag: 'Combo Popular' },
                ] : category === 'Limpeza' ? [
                  { a: '🧴 Detergente', b: '🧽 Esponja', tag: 'Kit Limpeza' },
                  { a: '🧺 Sabão', b: '🌸 Amaciante', tag: 'Lavanderia' },
                ] : [
                  { a: '📦 Este produto', b: '🎁 Produto Complementar', tag: 'Sugestão Geral' },
                ]).map((combo, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{combo.a}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>+</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{combo.b}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 900, background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)', padding: '2px 8px', borderRadius: 99 }}>{combo.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: ESTOQUE
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'estoque' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stock health panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <KpiCard label="Estoque Atual" value={stockNum > 0 ? `${stockNum} un` : 'Sem dados'} sub={stockStatus.label} icon={Box} color={stockStatus.color} />
              <KpiCard label="Estoque Mínimo" value={minStockNum > 0 ? `${minStockNum} un` : '—'} sub="Alerta configurado" icon={AlertCircle} color="#f59e0b" />
              <KpiCard label="Saúde do Estoque" value={`${stockPct}%`} sub={stockNum === 0 ? 'Zerado' : stockNum <= minStockNum ? 'Repor imediatamente' : 'Dentro do limite'} icon={Activity} color={stockStatus.color} />
              <KpiCard
                label="Previsão de Ruptura"
                value={ordersData.totalOrders > 0 && stockNum > 0 && ordersData.totalQty > 0
                  ? `~${Math.ceil(stockNum / (ordersData.totalQty / Math.max(ordersData.totalOrders, 1)))} pedidos`
                  : '—'}
                sub={ordersData.totalOrders > 0 ? 'Com base nas vendas' : 'Sem histórico'}
                icon={Clock}
                color="#818cf8"
              />
            </div>

            {/* Visual health bar */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={15} color={stockStatus.color} /> Status Visual do Estoque
              </h3>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                    {stockNum} unidades disponíveis
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: stockStatus.color }}>
                    {stockStatus.label}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 12, overflow: 'hidden' }}>
                  <div style={{
                    width: `${stockPct}%`, height: '100%',
                    background: stockPct > 60 ? '#10b981' : stockPct > 30 ? '#f59e0b' : '#ef4444',
                    borderRadius: 99, transition: 'width 0.5s ease',
                    boxShadow: `0 0 8px ${stockPct > 60 ? 'rgba(16,185,129,0.4)' : stockPct > 30 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                  <span>0</span>
                  {minStockNum > 0 && <span style={{ color: '#f59e0b' }}>Mín: {minStockNum}</span>}
                  <span>Máx</span>
                </div>
              </div>

              {stockNum <= minStockNum && minStockNum > 0 && stockNum > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} color="#ef4444" />
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 800 }}>
                    Estoque abaixo do mínimo. Repor {minStockNum - stockNum + 10} unidades recomendado.
                  </span>
                </div>
              )}
              {stockNum === 0 && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} color="#ef4444" />
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 800 }}>⚠️ Estoque ZERADO. O produto pode estar indisponível para clientes.</span>
                </div>
              )}
            </div>

            {/* Quick adjustment */}
            {!isNew && (
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={15} color="#0ea5e9" /> Ajuste Rápido de Estoque
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Quantidade</label>
                      <input type="number" value={stockAdjustVal} onChange={e => setStockAdjustVal(e.target.value)} style={inputStyle} placeholder="Ex: 10" />
                    </div>
                    <div>
                      <label style={labelStyle}>Motivo (opcional)</label>
                      <input type="text" value={stockAdjustNote} onChange={e => setStockAdjustNote(e.target.value)} style={inputStyle} placeholder="Ex: Reposição de fornecedor" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { const v = parseInt(stockAdjustVal); if (!v || isNaN(v)) return; handleStockAdjust(Math.abs(v)); }}
                      disabled={savingStockAdj}
                      style={{ flex: 1, height: 42, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, color: '#10b981', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Manrope, sans-serif' }}>
                      <ArrowUp size={14} /> Entrada
                    </button>
                    <button
                      onClick={() => { const v = parseInt(stockAdjustVal); if (!v || isNaN(v)) return; handleStockAdjust(-Math.abs(v)); }}
                      disabled={savingStockAdj}
                      style={{ flex: 1, height: 42, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#ef4444', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Manrope, sans-serif' }}>
                      <ArrowDown size={14} /> Saída
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                    Estoque atual após ajuste será atualizado imediatamente no Firestore.
                  </p>
                </div>
              </div>
            )}

            {/* Stock history */}
            {stockHistory.length > 0 && (
              <div style={sectionCard}>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={15} color="#818cf8" /> Histórico de Movimentações
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stockHistory.slice(0, 10).map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {entry.delta > 0
                          ? <ArrowUp size={14} color="#10b981" />
                          : <ArrowDown size={14} color="#ef4444" />}
                        <div>
                          <div style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{entry.note}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                            {new Date(entry.date).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color: entry.delta > 0 ? '#10b981' : '#ef4444' }}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Configurações de Estoque */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={15} color="#818cf8" /> Configurações de Estoque
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Estoque Atual</label>
                  <input type="number" value={stock} onChange={e => setStock(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Alerta Mínimo</label>
                  <input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} style={inputStyle} placeholder="Ex: 5" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} style={{ marginTop: 4, height: 42, background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', fontFamily: 'Manrope, sans-serif' }}>
                <Save size={14} /> Salvar Configurações de Estoque
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Skeleton animation */}
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
