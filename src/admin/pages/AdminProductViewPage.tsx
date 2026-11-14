import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  EyeOff,
  History,
  Image as ImageIcon,
  Package,
  RefreshCw,
  Star,
  Tag,
  User,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData, type AdminProduct } from '../AdminDataContext';
import { formatCurrency } from '../components/AdminUi';
import { cleanImageUrl, handleImageError } from '../../utils/imageUrl';
import {
  getProductAuditHistory,
  type ProductAuditRecord,
} from '../../services/productAuditService';

export const AdminProductViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canAny } = useAuth();
  const { actionLoading, handleToggleProductActive, showToast } = useAdminData();

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditRecords, setAuditRecords] = useState<ProductAuditRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const canEdit = canAny(['produtos:edit', 'produtos:create']);

  const loadProductData = async (prodId: string) => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'products', prodId));
      if (snap.exists()) {
        setProduct({ id: snap.id, ...snap.data() } as AdminProduct);
      } else {
        showToast('Produto não encontrado.', 'err');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar dados do produto.', 'err');
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async (prodId: string) => {
    setLoadingAudit(true);
    try {
      const history = await getProductAuditHistory(prodId, 30);
      setAuditRecords(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadProductData(id);
      loadAudit(id);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[var(--adm-text-muted)] space-y-3">
        <RefreshCw size={24} className="animate-spin text-[var(--adm-brand)]" />
        <p className="text-xs font-semibold">Carregando detalhes do produto...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/admin/products')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
        >
          <ArrowLeft size={14} /> Voltar para lista de produtos
        </button>
        <div className="p-8 text-center bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px]">
          <Package size={36} className="mx-auto text-[var(--adm-text-dim)] mb-2" />
          <h2 className="text-base font-bold text-[var(--adm-text)]">Produto não localizado</h2>
          <p className="text-xs text-[var(--adm-text-muted)] mt-1">
            O identificador solicitado não existe ou foi removido do catálogo.
          </p>
        </div>
      </div>
    );
  }

  const price = Number(product.price || 0);
  const cost = Number(product.costPrice || 0);
  const margin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;
  const unitProfit = price > 0 && cost > 0 ? price - cost : 0;
  const stock = Number(product.stock ?? 0);
  const minStock = Number(product.minStock ?? 5);
  const isActive = product.active !== false;

  const stockStatus =
    stock === 0
      ? { label: 'Esgotado / Zerado', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' }
      : stock <= minStock
      ? { label: 'Estoque Crítico', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' }
      : { label: 'Estoque Saudável', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="p-2 rounded-lg bg-[var(--adm-surface)] hover:bg-[var(--adm-surface-elevated)] border border-[var(--adm-border)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] transition-colors"
            title="Voltar ao catálogo"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]">
                {product.category || 'Geral'}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {isActive ? 'Ativo na Loja' : 'Pausado'}
              </span>
              {product.featured && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)] inline-flex items-center gap-1">
                  <Star size={10} /> Destaque
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-[var(--adm-text)] mt-1">{product.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              disabled={actionLoading === `toggle-${product.id}`}
              onClick={async () => {
                await handleToggleProductActive(product);
                await loadProductData(product.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)] transition-colors"
            >
              {isActive ? <EyeOff size={14} /> : <Eye size={14} />}
              {isActive ? 'Pausar' : 'Ativar'}
            </button>
          )}

          <Link
            to={`/admin/products/${product.id}/metrics`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-emerald-400 font-bold text-xs border border-[var(--adm-border)] transition-colors"
          >
            <BarChart3 size={15} />
            Métricas de Vendas
          </Link>

          {canEdit && (
            <Link
              to={`/admin/products/${product.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors"
            >
              <Edit3 size={15} />
              Editar Produto
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid: Info + Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Image & Stock */}
        <div className="space-y-6">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 text-center">
            {product.image ? (
              <img
                src={cleanImageUrl(product.image)} onError={handleImageError}
                alt={product.title}
                className="w-full h-64 object-contain rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] p-2"
              />
            ) : (
              <div className="w-full h-64 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] flex flex-col items-center justify-center text-[var(--adm-text-dim)]">
                <ImageIcon size={48} className="mb-2" />
                <span className="text-xs">Sem foto cadastrada</span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs text-[var(--adm-text-dim)] font-mono">
                ID: {product.id}
              </span>
            </div>
          </div>

          {/* Stock Card */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
                <Boxes size={14} /> Situação do Estoque
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${stockStatus.bg} ${stockStatus.color}`}>
                {stockStatus.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--adm-border)]">
              <div>
                <div className="text-[10px] text-[var(--adm-text-dim)] uppercase font-semibold">
                  Saldo Físico Atual
                </div>
                <div className="text-lg font-bold text-[var(--adm-text)] tabular-nums mt-0.5">
                  {stock} un.
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--adm-text-dim)] uppercase font-semibold">
                  Alerta Mínimo
                </div>
                <div className="text-lg font-bold text-[var(--adm-text-muted)] tabular-nums mt-0.5">
                  {minStock} un.
                </div>
              </div>
            </div>

            {product.stockHistory && product.stockHistory.length > 0 && (
              <div className="pt-3 border-t border-[var(--adm-border)]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-dim)] mb-2 flex items-center gap-1">
                  <Clock size={12} /> Últimas movimentações
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {product.stockHistory.slice(0, 5).map((mov, i) => (
                    <div
                      key={i}
                      className="text-xs flex items-center justify-between p-2 rounded bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)]"
                    >
                      <span className="text-[var(--adm-text-muted)] truncate max-w-[160px]">
                        {mov.note || 'Ajuste manual'}
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          mov.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {mov.delta > 0 ? `+${mov.delta}` : mov.delta} un.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center / Right Column: Product Details & Audit */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Breakdown */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
              <DollarSign size={14} /> Precificação & Rentabilidade
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--adm-text-dim)]">
                  Preço de Venda
                </div>
                <div className="text-base font-bold text-emerald-400 mt-1 tabular-nums">
                  {formatCurrency(price)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--adm-text-dim)]">
                  Preço de Custo
                </div>
                <div className="text-base font-bold text-[var(--adm-text)] mt-1 tabular-nums">
                  {cost > 0 ? formatCurrency(cost) : 'Não informado'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--adm-text-dim)]">
                  Margem Bruta
                </div>
                <div
                  className={`text-base font-bold mt-1 tabular-nums ${
                    margin !== null && margin >= 20 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--adm-text-dim)]">
                  Lucro Unitário
                </div>
                <div className="text-base font-bold text-[var(--adm-text)] mt-1 tabular-nums">
                  {unitProfit > 0 ? formatCurrency(unitProfit) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Identification & Commercial Information */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
              <Tag size={14} /> Ficha Técnica & Identificação
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[var(--adm-text-dim)] block">Categoria:</span>
                <span className="font-bold text-[var(--adm-text)] mt-0.5 block">
                  {product.category || 'Geral'}
                </span>
              </div>
              <div>
                <span className="text-[var(--adm-text-dim)] block">Código SKU:</span>
                <span className="font-mono font-bold text-[var(--adm-text)] mt-0.5 block">
                  {product.sku || '—'}
                </span>
              </div>
              <div>
                <span className="text-[var(--adm-text-dim)] block">Código EAN / Barras:</span>
                <span className="font-mono font-bold text-[var(--adm-text)] mt-0.5 block">
                  {product.ean || '—'}
                </span>
              </div>
              <div>
                <span className="text-[var(--adm-text-dim)] block">Unidade de Medida:</span>
                <span className="font-bold text-[var(--adm-text)] mt-0.5 block">
                  {product.unit || 'UN'}
                </span>
              </div>
              <div>
                <span className="text-[var(--adm-text-dim)] block">Peso / Volume:</span>
                <span className="font-bold text-[var(--adm-text)] mt-0.5 block">
                  {product.weight || '—'}
                </span>
              </div>
              <div>
                <span className="text-[var(--adm-text-dim)] block">Fornecedor:</span>
                <span className="font-bold text-[var(--adm-text)] mt-0.5 block">
                  {product.supplier || '—'}
                </span>
              </div>
            </div>

            {product.description && (
              <div className="pt-3 border-t border-[var(--adm-border)]">
                <span className="text-[var(--adm-text-dim)] text-xs block mb-1">
                  Descrição detalhada:
                </span>
                <p className="text-xs text-[var(--adm-text-muted)] leading-relaxed whitespace-pre-line bg-[var(--adm-bg-subtle)] p-3 rounded-lg border border-[var(--adm-border)]">
                  {product.description}
                </p>
              </div>
            )}
          </div>

          {/* Audit History Timeline */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
                <History size={14} /> Trilha de Auditoria & Modificações
              </h3>
              <span className="text-[11px] text-[var(--adm-text-dim)]">
                {auditRecords.length} registros persistidos
              </span>
            </div>

            {loadingAudit ? (
              <div className="p-4 text-center text-xs text-[var(--adm-text-dim)]">
                Carregando histórico de auditoria...
              </div>
            ) : auditRecords.length === 0 ? (
              <div className="p-4 text-center rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] text-xs text-[var(--adm-text-dim)]">
                Nenhuma alteração registrada após a ativação da auditoria compulsória.
              </div>
            ) : (
              <div className="space-y-3">
                {auditRecords.map((record) => {
                  const dateStr = record.createdAt
                    ? new Date(record.createdAt).toLocaleString('pt-BR')
                    : 'Recentemente';

                  return (
                    <div
                      key={record.id}
                      className="p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              record.operation === 'create'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : record.operation === 'archive'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {record.operation}
                          </span>
                          <span className="font-semibold text-[var(--adm-text)] flex items-center gap-1">
                            <User size={12} className="text-[var(--adm-text-dim)]" />
                            {record.userName} ({record.userEmail || 'admin'})
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--adm-text-dim)] font-mono">
                          {dateStr}
                        </span>
                      </div>

                      {record.note && (
                        <div className="text-[11px] text-[var(--adm-text-muted)] italic">
                          Motivo: &quot;{record.note}&quot;
                        </div>
                      )}

                      {record.changes && record.changes.length > 0 && (
                        <div className="pt-2 border-t border-[var(--adm-border)] space-y-1">
                          {record.changes.map((ch, idx) => (
                            <div
                              key={idx}
                              className="text-[11px] flex items-center gap-2 flex-wrap"
                            >
                              <span className="font-semibold text-[var(--adm-text-muted)]">
                                {ch.label}:
                              </span>
                              <span className="text-rose-400 line-through">
                                {String(ch.oldValue ?? 'vazio')}
                              </span>
                              <span className="text-[var(--adm-text-dim)]">→</span>
                              <span className="text-emerald-400 font-bold">
                                {String(ch.newValue ?? 'vazio')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
