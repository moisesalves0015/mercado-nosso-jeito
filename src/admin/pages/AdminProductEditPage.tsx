import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ArrowLeft,
  Boxes,
  Check,
  DollarSign,
  Image as ImageIcon,
  Package,
  RefreshCw,
  Save,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { db, functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData } from '../AdminDataContext';
import { formatCurrency, PageHeader } from '../components/AdminUi';
import { getAdminCategories, type AdminCategory } from '../../services/categoryService';
import {
  computeProductDiff,
  recordProductAudit,
} from '../../services/productAuditService';

// Commercial Flags
const ALL_FLAGS = [
  { id: 'super-oferta', label: 'Super Oferta', emoji: '🔥', color: '#ef4444' },
  { id: 'mais-vendido', label: 'Mais Vendido', emoji: '📈', color: '#10b981' },
  { id: 'destaque', label: 'Destaque', emoji: '⭐', color: '#f59e0b' },
  { id: 'promocao', label: 'Promoção', emoji: '🏷️', color: '#ec4899' },
  { id: 'oferta-relampago', label: 'Oferta Relâmpago', emoji: '⚡', color: '#eab308' },
  { id: 'novidade', label: 'Novidade', emoji: '🆕', color: '#0ea5e9' },
  { id: 'recomendado', label: 'Recomendado', emoji: '👍', color: '#818cf8' },
  { id: 'queima-estoque', label: 'Queima de Estoque', emoji: '🚨', color: '#f97316' },
  { id: 'combo', label: 'Combo', emoji: '🤝', color: '#a78bfa' },
];

const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 480;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas context error'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const AdminProductEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { refreshData, showToast } = useAdminData();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);

  // Original snapshot for diff calculation
  const [originalProduct, setOriginalProduct] = useState<Record<string, unknown> | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Bebidas');
  const [image, setImage] = useState('');
  const [sku, setSku] = useState('');
  const [ean, setEan] = useState('');
  const [unit, setUnit] = useState('UN');
  const [weight, setWeight] = useState('');
  const [supplier, setSupplier] = useState('');
  const [tags, setTags] = useState('');

  // Pricing & Margins
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [diamondReward, setDiamondReward] = useState('0');

  // Stock
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [stockAdjustDelta, setStockAdjustDelta] = useState('0');
  const [stockAdjustNote, setStockAdjustNote] = useState('');

  // Promotions & Marketing
  const [promoActive, setPromoActive] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoExpiry, setPromoExpiry] = useState('');
  const [availableInRoulette, setAvailableInRoulette] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [active, setActive] = useState(true);
  const [flags, setFlags] = useState<string[]>([]);

  // Load Categories dynamically
  useEffect(() => {
    getAdminCategories()
      .then((cats) => {
        setCategories(cats);
        if (isNew && cats.length > 0) {
          setCategory(cats[0].name);
        }
      })
      .catch((err) => console.error(err));
  }, [isNew]);

  // Load Existing Product
  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      getDoc(doc(db, 'products', id))
        .then((snap) => {
          if (snap.exists()) {
            const p = snap.data();
            setOriginalProduct({ id: snap.id, ...p });
            setTitle(p.title || '');
            setDescription(p.description || '');
            setCategory(p.category || 'Bebidas');
            setImage(p.image || '');
            setSku(p.sku || '');
            setEan(p.ean || '');
            setUnit(p.unit || 'UN');
            setWeight(p.weight || '');
            setSupplier(p.supplier || '');
            setTags(p.tags || '');

            setPrice(p.price?.toString() || '');
            setCostPrice(p.costPrice?.toString() || '');
            setOldPrice(p.oldPrice?.toString() || '');
            setDiamondReward(p.diamondReward?.toString() || '0');

            setStock(p.stock?.toString() || '0');
            setMinStock(p.minStock?.toString() || '5');

            setPromoActive(Boolean(p.promoActive));
            setPromoDiscount(p.promoDiscount?.toString() || '');
            setPromoExpiry(p.promoExpiry || '');
            setAvailableInRoulette(Boolean(p.availableInRoulette));
            setFeatured(Boolean(p.featured));
            setActive(p.active !== false);
            setFlags(Array.isArray(p.flags) ? p.flags : []);
          } else {
            showToast('Produto não encontrado.', 'err');
            navigate('/admin/products');
          }
        })
        .catch((err) => {
          console.error(err);
          showToast('Erro ao carregar dados do produto.', 'err');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate, showToast]);

  // Computed Real-time Metrics
  const numPrice = parseFloat(price) || 0;
  const numCost = parseFloat(costPrice) || 0;
  const numDiscount = parseFloat(promoDiscount) || 0;
  const realMargin =
    numPrice > 0 && numCost > 0 ? ((numPrice - numCost) / numPrice) * 100 : null;
  const unitProfit = numPrice > 0 && numCost > 0 ? numPrice - numCost : 0;
  const promoPrice =
    promoActive && numDiscount > 0
      ? Number((numPrice * (1 - numDiscount / 100)).toFixed(2))
      : null;

  // Toggle commercial flag
  const toggleFlag = (flagId: string) => {
    setFlags((prev) =>
      prev.includes(flagId) ? prev.filter((f) => f !== flagId) : [...prev, flagId],
    );
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      showToast('Imagem processada e anexada com sucesso!', 'ok');
    } catch {
      showToast('Erro ao processar imagem.', 'err');
    } finally {
      setUploadingImg(false);
    }
  };

  // Save Product Handler with Audit Trail
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('O título do produto é obrigatório.', 'err');
      return;
    }
    if (!numPrice || numPrice <= 0) {
      showToast('O preço de venda deve ser maior que zero.', 'err');
      return;
    }

    setSaving(true);
    try {
      const pStock = parseInt(stock, 10) || 0;
      const pMinStock = parseInt(minStock, 10) || 0;

      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        image: image.trim(),
        sku: sku.trim() || null,
        ean: ean.trim() || null,
        unit: unit.trim() || 'UN',
        weight: weight.trim() || null,
        supplier: supplier.trim() || null,
        tags: tags.trim() || null,
        price: numPrice,
        costPrice: numCost > 0 ? numCost : null,
        oldPrice: parseFloat(oldPrice) || null,
        diamondReward: parseInt(diamondReward, 10) || 0,
        minStock: pMinStock,
        promoActive,
        promoDiscount: promoActive && numDiscount > 0 ? numDiscount : null,
        promoPrice,
        promoExpiry: promoActive && promoExpiry ? promoExpiry : null,
        availableInRoulette,
        featured,
        active,
        flags,
        updatedAt: new Date().toISOString(),
      };

      if (isNew) {
        payload.stock = pStock;
        payload.createdAt = new Date().toISOString();
      }

      // 1. Save or Update via Cloud Function or direct Firestore
      let targetId = id;
      try {
        const fn = httpsCallable(functions, 'adminUpsertProduct');
        if (isNew) {
          const res = (await fn({
            ...payload,
            initialStock: pStock,
          })) as { data?: { productId?: string } };
          targetId = res.data?.productId || `prod_${Date.now()}`;
        } else {
          await fn({
            productId: id,
            ...payload,
          });
        }
      } catch (cloudErr) {
        console.warn('Fallback para Firestore local:', cloudErr);
        // Direct Firestore fallback
        if (isNew) {
          targetId = `prod_${Date.now()}`;
          await setDoc(doc(db, 'products', targetId), { ...payload, stock: pStock });
        } else {
          await setDoc(doc(db, 'products', id!), payload, { merge: true });
        }
      }

      // If existing product and an explicit stock delta was entered:
      const deltaNum = parseInt(stockAdjustDelta, 10) || 0;
      if (!isNew && id && deltaNum !== 0) {
        const productRef = doc(db, 'products', id);
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(productRef);
          if (snap.exists()) {
            const currentStock = snap.data().stock || 0;
            const newStockVal = Math.max(0, currentStock + deltaNum);
            const history = Array.isArray(snap.data().stockHistory)
              ? snap.data().stockHistory
              : [];
            transaction.update(productRef, {
              stock: newStockVal,
              stockHistory: [
                {
                  delta: deltaNum,
                  note: stockAdjustNote.trim() || 'Ajuste manual no formulário',
                  date: new Date().toISOString(),
                },
                ...history,
              ].slice(0, 25),
            });
          }
        });
      }

      // 2. Record Audit Trail in `productHistory`
      const diffs = computeProductDiff(originalProduct, payload);
      if (diffs.length > 0 || isNew) {
        await recordProductAudit({
          productId: targetId || id || 'novo',
          productTitle: title.trim(),
          userId: user?.uid || 'admin',
          userName: userProfile?.name || user?.displayName || 'Administrador',
          userEmail: user?.email || '',
          operation: isNew ? 'create' : 'update',
          changes: diffs,
          note: isNew
            ? 'Cadastro de novo produto no catálogo'
            : 'Atualização da ficha cadastral via painel administrativo',
        });
      }

      showToast(
        isNew
          ? 'Produto cadastrado e auditado com sucesso!'
          : 'Alterações salvas e auditadas no histórico!',
        'ok',
      );
      await refreshData();
      navigate(`/admin/products/${targetId}/view`);
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar produto. Verifique as permissões.', 'err');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[var(--adm-text-muted)] space-y-3">
        <RefreshCw size={24} className="animate-spin text-[var(--adm-brand)]" />
        <p className="text-xs font-semibold">Carregando ficha do produto...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={isNew ? 'Novo Produto' : `Editar — ${title || 'Produto'}`}
        subtitle="Preencha as informações cadastrais, precificação, estoque e campanhas comerciais."
        badge={isNew ? 'Novo Cadastro' : `SKU: ${sku || id?.slice(0, 8)}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(isNew ? '/admin/products' : `/admin/products/${id}/view`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)] transition-colors"
            >
              <ArrowLeft size={14} /> Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors"
            >
              <Save size={15} />
              {saving ? 'Gravando...' : 'Salvar Produto'}
            </button>
          </div>
        }
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--adm-border)] pb-3">
            <Package size={16} className="text-[var(--adm-gold)]" />
            <h2 className="text-sm font-bold text-[var(--adm-text)]">
              1. Identificação Básica & Categoria
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                Nome do Produto *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Coca-Cola Lata 350ml, Pão Francês 500g..."
                className="adm-input w-full p-2.5 text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Categoria *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="adm-input w-full p-2.5 text-xs font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {/* Keep fallback if category not in categories list */}
                  {!categories.some((c) => c.name === category) && (
                    <option value={category}>{category}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Código SKU
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="ex: BEB-COC-350"
                  className="adm-input w-full p-2.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Código de Barras (EAN)
                </label>
                <input
                  type="text"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  placeholder="ex: 7894900010015"
                  className="adm-input w-full p-2.5 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Unidade de Medida
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="UN, KG, LT, CX..."
                  className="adm-input w-full p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Peso / Volume
                </label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="ex: 350ml, 1kg..."
                  className="adm-input w-full p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Fornecedor / Fabricante
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="ex: Ambev, Nestlé..."
                  className="adm-input w-full p-2.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                Descrição Detalhada do Produto
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes, ingredientes, modo de conservação ou informações adicionais para o cliente..."
                className="adm-input w-full p-2.5 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Media & Image */}
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--adm-border)] pb-3">
            <ImageIcon size={16} className="text-[var(--adm-gold)]" />
            <h2 className="text-sm font-bold text-[var(--adm-text)]">2. Imagem do Produto</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs">
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  URL da Imagem
                </label>
                <input
                  type="text"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://... ou caminho local"
                  className="adm-input w-full p-2.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                  Ou faça upload do arquivo
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-[var(--adm-text)] font-semibold text-xs transition-colors">
                    <UploadCloud size={15} />
                    {uploadingImg ? 'Processando imagem...' : 'Selecionar Imagem'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImg}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-[var(--adm-text-dim)]">
                    PNG, JPG ou WEBP (otimizado automaticamente)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] min-h-[140px]">
              {image ? (
                <img
                  src={image}
                  alt="Pré-visualização"
                  className="w-28 h-28 object-contain rounded-md"
                />
              ) : (
                <div className="text-center text-[var(--adm-text-dim)]">
                  <ImageIcon size={32} className="mx-auto mb-1" />
                  <span className="text-[11px]">Sem imagem</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Pricing & Margins */}
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--adm-border)] pb-3">
            <DollarSign size={16} className="text-[var(--adm-gold)]" />
            <h2 className="text-sm font-bold text-[var(--adm-text)]">
              3. Precificação, Custos & Rentabilidade
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                Preço de Venda (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="adm-input w-full p-2.5 font-mono text-sm font-bold text-emerald-400"
              />
            </div>

            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                Preço de Custo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="adm-input w-full p-2.5 font-mono text-sm text-[var(--adm-text)]"
              />
            </div>

            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                Preço Original / De (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={oldPrice}
                onChange={(e) => setOldPrice(e.target.value)}
                placeholder="0.00"
                className="adm-input w-full p-2.5 font-mono text-sm text-[var(--adm-text-dim)]"
              />
            </div>

            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                Recompensa Diamantes
              </label>
              <input
                type="number"
                min="0"
                value={diamondReward}
                onChange={(e) => setDiamondReward(e.target.value)}
                placeholder="0"
                className="adm-input w-full p-2.5 font-mono text-sm text-cyan-400"
              />
            </div>
          </div>

          {/* Margins Feedback Badge */}
          <div className="p-3.5 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] flex items-center justify-between flex-wrap gap-3 text-xs">
            <div>
              <span className="text-[var(--adm-text-dim)] font-semibold">Margem Bruta Estimada: </span>
              <span
                className={`font-bold font-mono text-sm ${
                  realMargin !== null && realMargin >= 25
                    ? 'text-emerald-400'
                    : realMargin !== null && realMargin > 0
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {realMargin !== null ? `${realMargin.toFixed(1)}%` : '—'}
              </span>
            </div>

            <div>
              <span className="text-[var(--adm-text-dim)] font-semibold">Lucro Bruto Unitário: </span>
              <span className="font-bold font-mono text-sm text-emerald-400">
                {unitProfit > 0 ? formatCurrency(unitProfit) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Stock & Inventory */}
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--adm-border)] pb-3">
            <Boxes size={16} className="text-[var(--adm-gold)]" />
            <h2 className="text-sm font-bold text-[var(--adm-text)]">
              4. Gestão de Estoque
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                {isNew ? 'Estoque Inicial (unidades)' : 'Saldo Atual em Estoque'}
              </label>
              <input
                type="number"
                min="0"
                disabled={!isNew}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className={`adm-input w-full p-2.5 font-mono text-sm font-bold ${
                  !isNew ? 'opacity-70 bg-black/30' : ''
                }`}
              />
              {!isNew && (
                <span className="text-[11px] text-[var(--adm-text-dim)] mt-1 block">
                  Para alterar o saldo físico de produtos existentes, use o ajuste auditado abaixo.
                </span>
              )}
            </div>

            <div>
              <label className="block text-[var(--adm-text-muted)] font-semibold mb-1">
                Alerta de Estoque Mínimo (unidades)
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="adm-input w-full p-2.5 font-mono text-sm"
              />
            </div>
          </div>

          {!isNew && (
            <div className="p-3.5 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] space-y-3 text-xs">
              <span className="font-bold text-[var(--adm-text)] block">
                Ajuste Imediato de Estoque (Transacional)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--adm-text-dim)] mb-1">
                    Variação (ex: +10 para entrada, -3 para saída)
                  </label>
                  <input
                    type="number"
                    value={stockAdjustDelta}
                    onChange={(e) => setStockAdjustDelta(e.target.value)}
                    placeholder="0"
                    className="adm-input w-full p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[var(--adm-text-dim)] mb-1">
                    Justificativa do Ajuste
                  </label>
                  <input
                    type="text"
                    value={stockAdjustNote}
                    onChange={(e) => setStockAdjustNote(e.target.value)}
                    placeholder="ex: Contagem física, avaria..."
                    className="adm-input w-full p-2"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Commercial Flags & Visibility */}
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--adm-border)] pb-3">
            <Sparkles size={16} className="text-[var(--adm-gold)]" />
            <h2 className="text-sm font-bold text-[var(--adm-text)]">
              5. Flags Comerciais & Visibilidade
            </h2>
          </div>

          {/* Visibility Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pb-3 border-b border-[var(--adm-border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--adm-border)] text-[var(--adm-brand)]"
              />
              <span className="font-semibold text-[var(--adm-text)]">Ativo na Loja</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--adm-border)] text-[var(--adm-brand)]"
              />
              <span className="font-semibold text-[var(--adm-text)]">Destaque na Vitrine</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={availableInRoulette}
                onChange={(e) => setAvailableInRoulette(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--adm-border)] text-[var(--adm-brand)]"
              />
              <span className="font-semibold text-[var(--adm-text)]">Disponível na Roleta VIP</span>
            </label>
          </div>

          {/* Commercial Flags Selector */}
          <div>
            <label className="block text-[var(--adm-text-muted)] font-semibold text-xs mb-2">
              Selecione as Etiquetas Promocionais:
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_FLAGS.map((f) => {
                const isSelected = flags.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFlag(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[var(--adm-bg-subtle)] border-[var(--adm-border)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]'
                    }`}
                  >
                    <span>{f.emoji}</span>
                    <span>{f.label}</span>
                    {isSelected && <Check size={12} className="text-emerald-400 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Form Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(isNew ? '/admin/products' : `/admin/products/${id}/view`)}
            className="px-4 py-2.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)] font-semibold text-xs border border-[var(--adm-border)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg"
          >
            <Save size={16} />
            {saving ? 'Gravando Alterações...' : isNew ? 'Cadastrar Produto' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};
