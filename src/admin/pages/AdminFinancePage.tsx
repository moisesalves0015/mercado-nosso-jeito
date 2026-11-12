import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isRecognizedSale } from '../../utils/adminAnalytics';
import { useAdminData } from '../AdminDataContext';
import {
  formatCurrency,
  formatDateTime,
  MetricCard,
  PageHeader,
  PaymentStatusBadge,
} from '../components/AdminUi';

export const AdminFinancePage: React.FC = () => {
  const { canAny } = useAuth();
  const { orders, products, actionLoading, handleConfirmPayment } = useAdminData();

  const [simSalePrice, setSimSalePrice] = useState(24.9);
  const [simCostPrice, setSimCostPrice] = useState(14.5);
  const [simDiamonds, setSimDiamonds] = useState(10);
  const [pixRefs, setPixRefs] = useState<Record<string, string>>({});

  const canApprove = canAny(['financeiro:approve', 'pedidos:approve']);

  const financeStats = useMemo(() => {
    const approvedOrders = orders.filter((o) => isRecognizedSale(o));
    const awaitingPix = orders.filter(
      (o) => o.status !== 'cancelled' && o.paymentStatus === 'awaiting_confirmation',
    );
    const onDelivery = orders.filter(
      (o) => o.status !== 'cancelled' && o.paymentStatus === 'on_delivery',
    );

    const recognizedRevenue = approvedOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const pendingPixAmount = awaitingPix.reduce((s, o) => s + Number(o.total || 0), 0);
    const onDeliveryAmount = onDelivery.reduce((s, o) => s + Number(o.total || 0), 0);

    // Margin analysis on catalogue products with costPrice
    const productsWithCost = products.filter(
      (p) => p.active !== false && Number(p.costPrice || 0) > 0 && Number(p.price || 0) > 0,
    );
    let sumMarginPct = 0;
    const riskProducts: Array<{
      id: string;
      title: string;
      price: number;
      costPrice: number;
      marginPct: number;
    }> = [];

    for (const p of productsWithCost) {
      const pr = Number(p.price);
      const cs = Number(p.costPrice);
      const m = ((pr - cs) / pr) * 100;
      sumMarginPct += m;
      if (m < 18) {
        riskProducts.push({ id: p.id, title: p.title, price: pr, costPrice: cs, marginPct: m });
      }
    }

    const avgMarginPct =
      productsWithCost.length > 0 ? sumMarginPct / productsWithCost.length : 0;

    return {
      recognizedRevenue,
      approvedCount: approvedOrders.length,
      awaitingPix,
      pendingPixAmount,
      onDeliveryAmount,
      avgMarginPct,
      riskProducts: riskProducts.sort((a, b) => a.marginPct - b.marginPct),
    };
  }, [orders, products]);

  // Simulator calculation
  const diamondCashbackCost = simDiamonds * 0.05; // R$ 0.05 per diamond
  const netProfit = simSalePrice - simCostPrice - diamondCashbackCost;
  const realMarginPct = simSalePrice > 0 ? (netProfit / simSalePrice) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro & Conciliação Pix"
        subtitle="Conciliação auditada de pagamentos Pix, receita reconhecida, margem real do catálogo e simulador de precificação."
        badge={`${financeStats.awaitingPix.length} Pix pendentes`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Receita Reconhecida (Paga)"
          value={formatCurrency(financeStats.recognizedRevenue)}
          subtitle={`${financeStats.approvedCount} pedidos conciliados`}
          icon={<DollarSign size={18} />}
          tone="emerald"
        />
        <MetricCard
          label="Aguardando Conciliação Pix"
          value={formatCurrency(financeStats.pendingPixAmount)}
          subtitle={`${financeStats.awaitingPix.length} pedidos aguardando baixa`}
          icon={<Clock size={18} />}
          tone="amber"
        />
        <MetricCard
          label="Receber na Entrega"
          value={formatCurrency(financeStats.onDeliveryAmount)}
          subtitle="Pedidos em modalidade presencial"
          icon={<TrendingUp size={18} />}
          tone="sky"
        />
        <MetricCard
          label="Margem Bruta Média"
          value={`${financeStats.avgMarginPct.toFixed(1)}%`}
          subtitle={`${financeStats.riskProducts.length} produtos com margem < 18%`}
          icon={<Calculator size={18} />}
          tone={financeStats.riskProducts.length > 0 ? 'rose' : 'indigo'}
        />
      </div>

      {/* Pix Reconciliation Queue */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" />
              Fila de Conciliação Pix
            </h2>
            <p className="text-xs text-slate-400">
              Confira o extrato bancário da chave Pix e aprove os pedidos abaixo para liberar a separação.
            </p>
          </div>
          <Link
            to="/admin/settings"
            className="text-xs font-bold text-amber-400 hover:underline"
          >
            Configurar Chave Pix
          </Link>
        </div>

        {financeStats.awaitingPix.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
            Nenhum pedido aguardando confirmação de pagamento Pix no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {financeStats.awaitingPix.map((o) => (
              <div
                key={o.id}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/orders/${o.id}`}
                      className="font-mono text-xs font-extrabold text-amber-400 hover:underline"
                    >
                      #{(o.orderNumber || o.id).slice(0, 8).toUpperCase()}
                    </Link>
                    <span className="text-xs font-bold text-white">{o.userName || 'Morador'}</span>
                    <PaymentStatusBadge status={o.paymentStatus} />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Criado em {formatDateTime(o.createdAt)} • {o.items?.length || 0} itens
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-black text-emerald-400 mr-1">
                    {formatCurrency(o.total)}
                  </span>
                  <input
                    type="text"
                    value={pixRefs[o.id] || ''}
                    onChange={(e) =>
                      setPixRefs((prev) => ({ ...prev, [o.id]: e.target.value }))
                    }
                    placeholder="ID E2E / Ref comprovante..."
                    aria-label="Referência do comprovante Pix"
                    className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-400 w-44"
                  />
                  <button
                    type="button"
                    disabled={!canApprove || actionLoading === `pay-${o.id}`}
                    onClick={() =>
                      handleConfirmPayment(o.id, pixRefs[o.id]?.trim() || undefined)
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    Aprovar Pix
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Margin Risk Alerts + Pricing Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin Risk Products */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <AlertTriangle size={17} className="text-rose-400" />
              Alertas de Margem Comprimida (&lt; 18%)
            </h2>
            <p className="text-xs text-slate-400">
              Produtos ativos cujo preço de venda está próximo ou abaixo do custo de reposição
            </p>
          </div>

          {financeStats.riskProducts.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center bg-slate-950/50 rounded-xl border border-slate-800">
              Nenhum produto com margem crítica identificado.
            </p>
          ) : (
            <div className="space-y-2">
              {financeStats.riskProducts.slice(0, 8).map((p) => (
                <Link
                  key={p.id}
                  to={`/admin/products/${p.id}`}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 text-xs transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{p.title}</div>
                    <div className="text-[11px] text-slate-400">
                      Custo: {formatCurrency(p.costPrice)} → Venda: {formatCurrency(p.price)}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-black shrink-0 ${
                      p.marginPct < 0
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {p.marginPct.toFixed(1)}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Profit Simulator */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Calculator size={17} className="text-indigo-400" />
              Simulador de Lucro & Cashback (Clube VIP)
            </h2>
            <p className="text-xs text-slate-400">
              Simule o impacto do custo de mercadoria e diamantes concedidos na margem líquida unitária
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold uppercase text-slate-400 mb-1">
                Preço de Venda (R$)
              </label>
              <input
                type="number"
                step="0.1"
                value={simSalePrice}
                onChange={(e) => setSimSalePrice(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-bold"
              />
            </div>
            <div>
              <label className="block font-bold uppercase text-slate-400 mb-1">
                Custo Unitário (R$)
              </label>
              <input
                type="number"
                step="0.1"
                value={simCostPrice}
                onChange={(e) => setSimCostPrice(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-bold"
              />
            </div>
            <div>
              <label className="block font-bold uppercase text-slate-400 mb-1">
                Diamantes (💎)
              </label>
              <input
                type="number"
                value={simDiamonds}
                onChange={(e) => setSimDiamonds(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Custo Cashback</div>
              <div className="text-sm font-bold text-indigo-300 mt-0.5">
                {formatCurrency(diamondCashbackCost)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Lucro Unitário</div>
              <div
                className={`text-sm font-black mt-0.5 ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(netProfit)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Margem Real</div>
              <div
                className={`text-sm font-black mt-0.5 ${
                  realMarginPct >= 20
                    ? 'text-emerald-400'
                    : realMarginPct >= 0
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {realMarginPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

