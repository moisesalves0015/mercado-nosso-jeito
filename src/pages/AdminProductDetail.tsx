import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ArrowLeft, Save, Package, DollarSign, Target,
  Image as ImageIcon, Shield, AlertCircle
} from 'lucide-react';

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

export const AdminProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form State
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
  
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      loadProduct(id);
    }
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
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao carregar produto.');
    } finally {
      setLoading(false);
    }
  };

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
    const data = {
      title, description, category, image, tags, badge, badgeStyle,
      price: pPrice,
      costPrice: pCost,
      diamondReward: pDiamonds,
      stock: stock ? parseInt(stock) : undefined,
      minStock: minStock ? parseInt(minStock) : undefined,
      promoActive,
      promoDiscount: promoDiscount ? parseFloat(promoDiscount) : undefined,
      availableInRoulette,
      active,
      updatedAt: new Date().toISOString()
    };

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

  // UI Helpers
  const wizPrice = parseFloat(price) || 0;
  const wizCost = parseFloat(costPrice) || 0;
  const wizDiamonds = parseInt(diamondReward) || 0;
  const wizMargin = calcRealMargin(wizPrice, wizCost, wizDiamonds);

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '44px', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
    padding: '0 14px', color: '#fff', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'Manrope, sans-serif',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8
  };
  const cardStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 20
  };

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: 50 }}>Carregando produto...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #020617 0%, #0b0f19 60%, #020617 100%)', paddingBottom: 100 }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin')} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: 0 }}>{isNew ? 'Novo Produto' : 'Editar Produto'}</h1>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700 }}>{isNew ? 'Preencha os detalhes' : title}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span style={{ color: active ? '#10b981' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 800 }}>{active ? 'Ativo na Loja' : 'Pausado'}</span>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#10b981' }} />
          </label>
          <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 10, padding: '0 20px', height: 40, display: 'flex', alignItems: 'center', gap: 8, color: '#000', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Produto'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: '30px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Card: Info Básica */}
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Package size={18} color="#D4AF37"/> Informações Básicas</h2>
            
            <div>
              <label style={labelStyle}>Nome do Produto *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Ex: Cerveja Heineken Long Neck" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                <label style={labelStyle}>Tags (separadas por vírgula)</label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)} style={inputStyle} placeholder="ex: cerveja, gelada, long neck" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Descrição (Opcional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, height: 100, paddingTop: 12, resize: 'vertical' }} placeholder="Detalhes do produto..." />
            </div>
          </div>

          {/* Card: Mídia */}
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><ImageIcon size={18} color="#0ea5e9"/> Mídia do Produto</h2>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ width: 120, height: 120, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {image ? <img src={image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImageIcon color="rgba(255,255,255,0.2)" size={32} />}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={labelStyle}>URL da Imagem</label>
                <input type="text" value={image} onChange={e => setImage(e.target.value)} style={inputStyle} placeholder="https://..." />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>OU</span>
                  <label style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={14}/> {uploadingImg ? 'Comprimindo...' : 'Fazer Upload'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Promoção e Destaques */}
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Target size={18} color="#ec4899"/> Destaques e Promoções</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Badge (Etiqueta)</label>
                <input type="text" value={badge} onChange={e => setBadge(e.target.value)} style={inputStyle} placeholder="Ex: Mais Vendido, Novidade" />
              </div>
              <div>
                <label style={labelStyle}>Cor do Badge</label>
                <select value={badgeStyle} onChange={e => setBadgeStyle(e.target.value as any)} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="orange">Laranja (Destaque)</option>
                  <option value="light">Claro (Premium)</option>
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={availableInRoulette} onChange={e => setAvailableInRoulette(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#D4AF37' }} />
              <div>
                <span style={{ display: 'block', color: '#fff', fontSize: 13, fontWeight: 800 }}>Disponível na Roleta VIP</span>
                <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Usuários podem ganhar este item como prêmio</span>
              </div>
            </label>
          </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Card: Precificação e Margem */}
          <div style={{ ...cardStyle, border: '1px solid rgba(212,175,55,0.3)', background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.6) 100%)' }}>
            <h2 style={{ color: '#FFDF73', fontSize: 15, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign size={18}/> Precificação</h2>
            
            <div>
              <label style={labelStyle}>Preço de Venda (R$) *</label>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} style={{ ...inputStyle, fontSize: 18, fontWeight: 900, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Custo Unitário (R$)</label>
                <input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Diamantes 💎 (Retorno)</label>
                <input type="number" value={diamondReward} onChange={e => setDiamondReward(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Simulação de Margem ao Vivo */}
            {(wizCost > 0 || wizPrice > 0) && (
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>Custo do Produto:</span>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 900 }}>R$ {wizCost.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>Custo em 💎:</span>
                  <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 900 }}>R$ {calcDiamondCost(wizDiamonds).toFixed(2)}</span>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />
                
                {wizMargin !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, display: 'block', marginBottom: 4 }}>Margem Real</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: wizMargin < 0 ? '#ef4444' : wizMargin < 15 ? '#f97316' : wizMargin < 30 ? '#f59e0b' : '#10b981' }}>{wizMargin.toFixed(1)}%</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, display: 'block', marginBottom: 4 }}>Lucro Líquido</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>R$ {(wizPrice - wizCost - calcDiamondCost(wizDiamonds)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {wizMargin !== null && wizMargin < 0 && (
                  <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} color="#ef4444" />
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 800 }}>Prejuízo detectado! O sistema impedirá o salvamento.</span>
                  </div>
                )}
              </div>
            )}

            {/* Auto Suggestion */}
            {wizCost > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>Margem Alvo:</span>
                <input type="number" value={targetMargin} onChange={e => setTargetMargin(e.target.value)} style={{ ...inputStyle, width: 60, height: 30, padding: 0, textAlign: 'center' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>%</span>
                <button onClick={() => setPrice(calcSuggestedPrice(wizCost, wizDiamonds, parseFloat(targetMargin) || 35).toFixed(2))} style={{ height: 30, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 6, color: '#FFDF73', fontSize: 11, fontWeight: 900, cursor: 'pointer', padding: '0 10px', marginLeft: 'auto' }}>
                  Sugerir Preço
                </button>
              </div>
            )}

          </div>

          {/* Card: Estoque */}
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={18} color="#818cf8"/> Controle de Estoque</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

      </main>
    </div>
  );
};
