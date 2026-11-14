import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive,
  BarChart3,
  Boxes,
  Edit3,
  Eye,
  EyeOff,
  FolderTree,
  Package,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cleanImageUrl, handleImageError } from '../../utils/imageUrl';
import { useAdminData, type AdminProduct } from '../AdminDataContext';
import {
  EmptyState,
  formatCurrency,
  PageHeader,
  ReasonConfirmModal,
} from '../components/AdminUi';

export const AdminProductsPage: React.FC = () => {
  const { canAny } = useAuth();
  const {
    products,
    actionLoading,
    handleToggleProductActive,
    handleArchiveProduct,
  } = useAdminData();

  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || 'all';
  const statusFilter = searchParams.get('status') || 'active';
  const queryText = searchParams.get('q') || '';

  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);

  const canEdit = canAny(['produtos:edit', 'produtos:create']);
  const canArchive = canAny(['produtos:archive', 'produtos:edit']);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return products.filter((p) => {
      const isActive = p.active !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'paused' && isActive) return false;
      if (statusFilter === 'featured' && !p.featured) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (q) {
        const mTitle = p.title?.toLowerCase().includes(q);
        const mSku = p.sku?.toLowerCase().includes(q);
        const mEan = p.ean?.toLowerCase().includes(q);
        const mCat = p.category?.toLowerCase().includes(q);
        if (!mTitle && !mSku && !mEan && !mCat) return false;
      }
      return true;
    });
  }, [products, statusFilter, categoryFilter, queryText]);

  const updateParam = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams);
    if (!v || v === 'all') next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catálogo de Produtos"
        subtitle="Gerencie preços, margens, fotos, categorias e visibilidade dos produtos na vitrine do condomínio."
        badge={`${filteredProducts.length} itens`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/categories"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)] transition-colors"
            >
              <FolderTree size={15} />
              Categorias
            </Link>
            <Link
              to="/admin/inventory"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)]"
            >
              <Boxes size={15} />
              Controle de Estoque
            </Link>
            {canEdit && (
              <Link
                to="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors"
              >
                <Plus size={15} />
                Novo Produto
              </Link>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-dim)] pointer-events-none"
            />
            <input
              type="search"
              value={queryText}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="Buscar produto por nome, SKU, código de barras (EAN) ou categoria..."
              aria-label="Buscar produtos"
              className="adm-input w-full pl-9 pr-4 py-2 text-xs sm:text-sm placeholder-[var(--adm-text-dim)]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => updateParam('category', e.target.value)}
            aria-label="Filtrar por categoria"
            className="adm-input px-3 py-2 text-xs font-semibold"
          >
            <option value="all">Todas as Categorias ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'active', label: 'Ativos na Vitrine' },
            { id: 'paused', label: 'Pausados / Arquivados' },
            { id: 'featured', label: 'Destaques' },
            { id: 'all', label: 'Todos os Produtos' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateParam('status', tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                  : 'bg-[var(--adm-bg-subtle)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={<Package size={22} />}
          title="Nenhum produto encontrado"
          description="Ajuste os filtros ou cadastre um novo produto no catálogo."
          action={
            canEdit && (
              <Link
                to="/admin/products/new"
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                Cadastrar Produto
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const isActive = p.active !== false;
            const price = Number(p.price || 0);
            const cost = Number(p.costPrice || 0);
            const margin =
              price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
            const stock = Number(p.stock ?? 0);
            const minStock = Number(p.minStock ?? 5);

            return (
              <div
                key={p.id}
                className={`bg-[var(--adm-surface)] border rounded-[10px] p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isActive
                    ? 'border-[var(--adm-border)] hover:border-[var(--adm-border-strong)]'
                    : 'border-[var(--adm-border)] opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start gap-3">
                    {p.image ? (
                      <img
                        src={cleanImageUrl(p.image)} onError={handleImageError}
                        alt={p.title}
                        className="w-16 h-16 rounded-lg object-cover bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] flex items-center justify-center text-[var(--adm-text-dim)] shrink-0">
                        <Package size={22} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]">
                          {p.category || 'Geral'}
                        </span>
                        {p.featured && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)] inline-flex items-center gap-0.5">
                            <Star size={10} /> Destaque
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/admin/products/${p.id}/view`}
                        className="text-sm font-bold text-[var(--adm-text)] hover:text-[var(--adm-gold)] line-clamp-2 leading-snug"
                      >
                        {p.title}
                      </Link>
                      {p.sku && (
                        <div className="text-[11px] font-mono text-[var(--adm-text-dim)] mt-0.5 tabular-nums">
                          SKU: {p.sku}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price, Cost & Stock */}
                  <div className="grid grid-cols-3 gap-2 mt-3.5 p-2.5 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] text-center">
                    <div>
                      <div className="text-[10px] uppercase text-[var(--adm-text-dim)] font-bold">Venda</div>
                      <div className="text-xs font-bold text-emerald-300 mt-0.5 tabular-nums">
                        {formatCurrency(price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[var(--adm-text-dim)] font-bold">Margem</div>
                      <div className="text-xs font-bold text-[var(--adm-text)] mt-0.5 tabular-nums">
                        {margin !== null ? `${margin}%` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[var(--adm-text-dim)] font-bold">Estoque</div>
                      <div
                        className={`text-xs font-bold mt-0.5 tabular-nums ${
                          stock === 0
                            ? 'text-rose-300'
                            : stock <= minStock
                            ? 'text-amber-300'
                            : 'text-[var(--adm-text)]'
                        }`}
                      >
                        {stock} un.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-[var(--adm-border)] flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <button
                          type="button"
                          disabled={actionLoading === `toggle-${p.id}`}
                          onClick={() => handleToggleProductActive(p)}
                          className="p-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)] border border-[var(--adm-border)] transition-colors"
                          title={isActive ? 'Pausar na vitrine' : 'Reativar na vitrine'}
                        >
                          {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      {canArchive && isActive && (
                        <button
                          type="button"
                          onClick={() => setArchiveTarget(p)}
                          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 transition-colors"
                          title="Arquivar produto com justificativa"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>

                    <Link
                      to={`/admin/products/${p.id}/metrics`}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-emerald-400 font-semibold text-xs inline-flex items-center gap-1 border border-[var(--adm-border)] transition-colors"
                      title="Métricas e vendas reais deste produto"
                    >
                      <BarChart3 size={13} />
                      Métricas
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/admin/products/${p.id}/view`}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs inline-flex items-center justify-center gap-1 border border-[var(--adm-border)] transition-colors"
                      title="Visualização estruturada do produto"
                    >
                      <Eye size={13} />
                      Visualizar
                    </Link>

                    {canEdit ? (
                      <Link
                        to={`/admin/products/${p.id}/edit`}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center justify-center gap-1 transition-colors"
                        title="Editar cadastro do produto"
                      >
                        <Edit3 size={13} />
                        Editar
                      </Link>
                    ) : (
                      <Link
                        to={`/admin/products/${p.id}/view`}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] text-[var(--adm-text-dim)] font-semibold text-xs inline-flex items-center justify-center gap-1 border border-[var(--adm-border)]"
                      >
                        <Eye size={13} />
                        Detalhes
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReasonConfirmModal
        open={Boolean(archiveTarget)}
        title={`Arquivar Produto — ${archiveTarget?.title || ''}`}
        description="Produtos nunca são deletados fisicamente para preservar o histórico de pedidos. Ao arquivar, o item é ocultado imediatamente da loja."
        confirmLabel="Arquivar Produto"
        danger
        loading={Boolean(archiveTarget && actionLoading === `archive-${archiveTarget.id}`)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async (reason) => {
          if (!archiveTarget) return;
          const ok = await handleArchiveProduct(archiveTarget.id, reason);
          if (ok) setArchiveTarget(null);
        }}
      />
    </div>
  );
};

