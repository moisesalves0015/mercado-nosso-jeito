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
    <div className="space-y-6">
      <PageHeader
        title="Estoque & Inventário"
        subtitle="Controle transacional de saldo físico, alertas de ruptura e histórico auditado de movimentações."
        badge={`${activeProducts.length} SKUs ativos`}
        actions={
          <Link
            to="/admin/products"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
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
          tone="indigo"
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
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="search"
            value={queryText}
            onChange={(e) => updateParam('q', e.target.value)}
            placeholder="Buscar item por título, SKU, corredor/localização ou fornecedor..."
            aria-label="Buscar no inventário"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs sm:text-sm text-white placeholder-slate-400"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                levelFilter === tab.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory List */}
        <div className="lg:col-span-2 space-y-3">
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
                  className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-12 h-12 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="text-sm font-extrabold text-white hover:text-amber-400 truncate block"
                      >
                        {p.title}
                      </Link>
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
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
                        className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                          s === 0
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : s <= min
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
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
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Plus size={13} />
                          Entrada
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdjustModal(p, 'remove')}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold"
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
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg h-fit space-y-4">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <History size={16} className="text-amber-400" />
            Últimas Movimentações Auditadas
          </h2>
          {recentMovements.length === 0 ? (
            <p className="text-xs text-slate-400">
              Nenhuma movimentação manual registrada recentemente.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentMovements.map((m, idx) => (
                <div
                  key={`${m.productId}-${idx}`}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/admin/products/${m.productId}`}
                      className="font-bold text-white hover:text-amber-400 truncate"
                    >
                      {m.productTitle}
                    </Link>
                    <span
                      className={`font-black inline-flex items-center gap-0.5 shrink-0 ${
                        m.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {m.delta >= 0 ? `+${m.delta}` : m.delta} un.
                    </span>
                  </div>
                  <div className="text-slate-300">{m.note}</div>
                  <div className="text-[10px] text-slate-400">{formatDateTime(m.date)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transactional Stock Adjustment Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-white">
                {deltaMode === 'add' ? 'Registrar Entrada de Estoque' : 'Registrar Baixa de Estoque'}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Produto: <span className="font-bold text-amber-300">{adjustTarget.title}</span> (Saldo atual:{' '}
              <span className="font-bold text-white">{adjustTarget.stock ?? 0} un.</span>)
            </p>

            <form onSubmit={handleSubmitAdjust} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Quantidade ({deltaMode === 'add' ? '+' : '-'}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Estoque Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minStockVal}
                    onChange={(e) => setMinStockVal(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Motivo / Documento para Auditoria *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Nota Fiscal 1092, Contagem física, Vencimento..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === `stock-${adjustTarget.id}`}
                  className={`px-4 py-2 rounded-xl font-extrabold ${
                    deltaMode === 'add'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
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

