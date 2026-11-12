import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  History,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData, type AdminProduct } from '../AdminDataContext';
import {
  EmptyState,
  formatCurrency,
  formatDateTime,
  MetricCard,
  PageHeader,
} from '../components/AdminUi';

export const AdminInventoryPage: React.FC = () => {
  const { canAny } = useAuth();
  const { products, actionLoading, handleAdjustStock } = useAdminData();

  const [searchParams, setSearchParams] = useSearchParams();
  const levelFilter = searchParams.get('level') || 'all';
  const queryText = searchParams.get('q') || '';

  const [adjustTarget, setAdjustTarget] = useState<AdminProduct | null>(null);
  const [deltaMode, setDeltaMode] = useState<'add' | 'remove'>('add');
  const [quantity, setQuantity] = useState(10);
  const [minStockVal, setMinStockVal] = useState(5);
  const [reason, setReason] = useState('Reposição de mercadoria / Entrada NF');

  const canEditStock = canAny(['estoque:edit', 'produtos:edit']);

  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products],
  );

  const stats = useMemo(() => {
    let outCount = 0;
    let lowCount = 0;
    let totalUnits = 0;
    let totalRetailValue = 0;

    for (const p of activeProducts) {
      const s = Number(p.stock ?? 0);
      const min = Number(p.minStock ?? 5);
      totalUnits += s;
      totalRetailValue += s * Number(p.price ?? 0);
      if (s === 0) outCount += 1;
      else if (s <= min) lowCount += 1;
    }

    return { outCount, lowCount, totalUnits, totalRetailValue };
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return activeProducts.filter((p) => {
      const s = Number(p.stock ?? 0);
      const min = Number(p.minStock ?? 5);
      if (levelFilter === 'out' && s !== 0) return false;
      if (levelFilter === 'low' && (s === 0 || s > min)) return false;
      if (levelFilter === 'alert' && s > min) return false;

      if (q) {
        const mTitle = p.title?.toLowerCase().includes(q);
        const mSku = p.sku?.toLowerCase().includes(q);
        const mLoc = p.location?.toLowerCase().includes(q);
        const mSup = p.supplier?.toLowerCase().includes(q);
        if (!mTitle && !mSku && !mLoc && !mSup) return false;
      }
      return true;
    });
  }, [activeProducts, levelFilter, queryText]);

  const recentMovements = useMemo(() => {
    const list: Array<{
      productId: string;
      productTitle: string;
      delta: number;
      note: string;
      date: string;
    }> = [];
    for (const p of products) {
      for (const h of p.stockHistory || []) {
        list.push({
          productId: p.id,
          productTitle: p.title,
          delta: h.delta,
          note: h.note,
          date: h.date,
        });
      }
    }
    return list
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [products]);

  const updateParam = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams);
    if (!v || v === 'all') next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  const openAdjustModal = (p: AdminProduct, mode: 'add' | 'remove') => {
    setAdjustTarget(p);
    setDeltaMode(mode);
    setQuantity(mode === 'add' ? 10 : 1);
    setMinStockVal(Number(p.minStock ?? 5));
    setReason(mode === 'add' ? 'Entrada de mercadoria / Reposição' : 'Baixa por avaria ou ajuste de inventário');
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || quantity <= 0 || reason.trim().length < 3) return;
    const signedDelta = deltaMode === 'add' ? Math.abs(quantity) : -Math.abs(quantity);
    const ok = await handleAdjustStock(
      adjustTarget.id,
      signedDelta,
      reason.trim(),
      minStockVal,
    );
    if (ok) {
      setAdjustTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estoque & Inventário"
        subtitle="Controle transacional de saldo físico, alertas de ruptura e histórico auditado de movimentações."
        badge={`${activeProducts.length} SKUs ativos`}
        actions={
          <Link
            to="/admin/products"
            className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)]"
          >
            Ver Catálogo de Produtos
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Unidades em Estoque"
          value={stats.totalUnits}
          subtitle={`Em ${activeProducts.length} produtos ativos`}
          icon={<Boxes size={18} />}
          tone="emerald"
        />
        <MetricCard
          label="Produtos Esgotados (Zero)"
          value={stats.outCount}
          subtitle="Ruptura imediata na vitrine"
          icon={<AlertTriangle size={18} />}
          tone={stats.outCount > 0 ? 'rose' : 'emerald'}
        />
        <MetricCard
          label="Estoque Baixo (Alerta)"
          value={stats.lowCount}
          subtitle="Abaixo do estoque mínimo"
          icon={<Package size={18} />}
          tone={stats.lowCount > 0 ? 'amber' : 'emerald'}
        />
        <MetricCard
          label="Valor de Venda em Estoque"
          value={formatCurrency(stats.totalRetailValue)}
          subtitle="Potencial bruto do inventário"
          icon={<ArrowUpRight size={18} />}
          tone="emerald"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-dim)] pointer-events-none"
          />
          <input
            type="search"
            value={queryText}
            onChange={(e) => updateParam('q', e.target.value)}
            placeholder="Buscar item por título, SKU, corredor/localização ou fornecedor..."
            aria-label="Buscar no inventário"
            className="adm-input w-full pl-9 pr-4 py-2 text-xs sm:text-sm placeholder-[var(--adm-text-dim)]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Todo o Inventário' },
            { id: 'alert', label: `Precisam de Reposição (${stats.outCount + stats.lowCount})` },
            { id: 'out', label: `Esgotados (${stats.outCount})` },
            { id: 'low', label: `Estoque Baixo (${stats.lowCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateParam('level', tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                levelFilter === tab.id
                  ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                  : 'bg-[var(--adm-bg-subtle)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Inventory List */}
        <div className="lg:col-span-2 space-y-2.5">
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={<Boxes size={22} />}
              title="Nenhum item encontrado"
              description="Não há produtos neste filtro de estoque."
            />
          ) : (
            filteredProducts.map((p) => {
              const s = Number(p.stock ?? 0);
              const min = Number(p.minStock ?? 5);
              return (
                <div
                  key={p.id}
                  className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-12 h-12 rounded-lg object-cover bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] flex items-center justify-center text-[var(--adm-text-dim)] shrink-0">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="text-sm font-bold text-[var(--adm-text)] hover:text-[var(--adm-gold)] truncate block"
                      >
                        {p.title}
                      </Link>
                      <div className="text-[11px] text-[var(--adm-text-dim)] flex flex-wrap items-center gap-2 mt-0.5 tabular-nums">
                        <span>{p.category}</span>
                        {p.sku && <span>• SKU: {p.sku}</span>}
                        {p.location && <span>• Local: {p.location}</span>}
                        <span>• Mínimo: {min} un.</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-bold border tabular-nums ${
                          s === 0
                            ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                            : s <= min
                            ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                        }`}
                      >
                        {s} {p.unit || 'un.'}
                      </span>
                    </div>

                    {canEditStock && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAdjustModal(p, 'add')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Plus size={13} />
                          Entrada
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdjustModal(p, 'remove')}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 text-xs font-semibold"
                        >
                          Baixa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Recent Stock History */}
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 h-fit space-y-4">
          <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
            <History size={16} className="text-[var(--adm-gold)]" />
            Últimas Movimentações Auditadas
          </h2>
          {recentMovements.length === 0 ? (
            <p className="text-xs text-[var(--adm-text-muted)]">
              Nenhuma movimentação manual registrada recentemente.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentMovements.map((m, idx) => (
                <div
                  key={`${m.productId}-${idx}`}
                  className="p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/admin/products/${m.productId}`}
                      className="font-semibold text-[var(--adm-text)] hover:text-[var(--adm-gold)] truncate"
                    >
                      {m.productTitle}
                    </Link>
                    <span
                      className={`font-bold inline-flex items-center gap-0.5 shrink-0 tabular-nums ${
                        m.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {m.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {m.delta >= 0 ? `+${m.delta}` : m.delta} un.
                    </span>
                  </div>
                  <div className="text-[var(--adm-text-muted)]">{m.note}</div>
                  <div className="text-[10px] text-[var(--adm-text-dim)] tabular-nums">
                    {formatDateTime(m.date)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transactional Stock Adjustment Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border-strong)] rounded-[10px] max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[var(--adm-text)]">
                {deltaMode === 'add' ? 'Registrar Entrada de Estoque' : 'Registrar Baixa de Estoque'}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] p-1 rounded-md"
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--adm-text-muted)] mb-4">
              Produto: <span className="font-bold text-[var(--adm-gold)]">{adjustTarget.title}</span> (Saldo atual:{' '}
              <span className="font-bold text-[var(--adm-text)] tabular-nums">{adjustTarget.stock ?? 0} un.</span>)
            </p>

            <form onSubmit={handleSubmitAdjust} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                    Quantidade ({deltaMode === 'add' ? '+' : '-'}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="adm-input w-full px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                    Estoque Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minStockVal}
                    onChange={(e) => setMinStockVal(Math.max(0, Number(e.target.value)))}
                    className="adm-input w-full px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Motivo / Documento para Auditoria *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Nota Fiscal 1092, Contagem física, Vencimento..."
                  className="adm-input w-full px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-[var(--adm-text-muted)] font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === `stock-${adjustTarget.id}`}
                  className={`px-4 py-2 rounded-lg font-bold ${
                    deltaMode === 'add'
                      ? 'bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  Confirmar ({deltaMode === 'add' ? `+${quantity}` : `-${quantity}`} un.)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

