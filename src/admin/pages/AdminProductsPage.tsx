import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive,
  Boxes,
  Edit3,
  Eye,
  EyeOff,
  Package,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
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
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de Produtos"
        subtitle="Gerencie preços, margens, fotos, categorias e visibilidade dos produtos na vitrine do condomínio."
        badge={`${filteredProducts.length} itens`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/inventory"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
            >
              <Boxes size={15} />
              Controle de Estoque
            </Link>
            {canEdit && (
              <Link
                to="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <Plus size={15} />
                Novo Produto
              </Link>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              value={queryText}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="Buscar produto por nome, SKU, código de barras (EAN) ou categoria..."
              aria-label="Buscar produtos"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs sm:text-sm text-white placeholder-slate-400"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => updateParam('category', e.target.value)}
            aria-label="Filtrar por categoria"
            className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-bold text-slate-200"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800'
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
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
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
                className={`bg-slate-900/90 border rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-lg transition-all ${
                  isActive ? 'border-slate-800/90 hover:border-slate-700' : 'border-slate-800/40 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start gap-3">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-16 h-16 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Package size={22} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {p.category || 'Geral'}
                        </span>
                        {p.featured && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 inline-flex items-center gap-0.5">
                            <Star size={10} /> Destaque
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="text-sm font-extrabold text-white hover:text-amber-400 line-clamp-2 leading-snug"
                      >
                        {p.title}
                      </Link>
                      {p.sku && (
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          SKU: {p.sku}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price, Cost & Stock */}
                  <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Venda</div>
                      <div className="text-xs font-black text-emerald-400 mt-0.5">
                        {formatCurrency(price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Margem</div>
                      <div className="text-xs font-extrabold text-white mt-0.5">
                        {margin !== null ? `${margin}%` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Estoque</div>
                      <div
                        className={`text-xs font-extrabold mt-0.5 ${
                          stock === 0
                            ? 'text-rose-400'
                            : stock <= minStock
                            ? 'text-amber-400'
                            : 'text-white'
                        }`}
                      >
                        {stock} un.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <button
                        type="button"
                        disabled={actionLoading === `toggle-${p.id}`}
                        onClick={() => handleToggleProductActive(p)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                        title={isActive ? 'Pausar na vitrine' : 'Reativar na vitrine'}
                      >
                        {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    )}
                    {canArchive && isActive && (
                      <button
                        type="button"
                        onClick={() => setArchiveTarget(p)}
                        className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                        title="Arquivar produto com justificativa"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/admin/products/${p.id}`}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
                  >
                    <Edit3 size={13} />
                    Editar Ficha
                  </Link>
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

