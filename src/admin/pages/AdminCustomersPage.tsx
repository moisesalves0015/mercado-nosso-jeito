import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Ban,
  Eye,
  Gem,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isRecognizedSale } from '../../utils/adminAnalytics';
import { useAdminData, type AdminClient } from '../AdminDataContext';
import {
  EmptyState,
  formatCurrency,
  formatDateTime,
  maskCpf,
  PageHeader,
  ReasonConfirmModal,
} from '../components/AdminUi';

export const AdminCustomersPage: React.FC = () => {
  const { canAny } = useAuth();
  const { clients, orders, tickets, actionLoading, handleGrantDiamonds, handleBanUser } =
    useAdminData();

  const [searchParams, setSearchParams] = useSearchParams();
  const segment = searchParams.get('segment') || 'all';
  const queryText = searchParams.get('q') || '';

  const [diamondTarget, setDiamondTarget] = useState<AdminClient | null>(null);
  const [diamondAmount, setDiamondAmount] = useState(50);
  const [diamondReason, setDiamondReason] = useState('');
  const [banTarget, setBanTarget] = useState<AdminClient | null>(null);

  const canEditDiamonds = canAny(['clube:edit', 'clube:admin', 'clientes:edit']);
  const canBan = canAny(['usuarios:archive', 'usuarios:admin', 'clientes:archive']);

  // Aggregate per-customer stats from orders and tickets
  const customerStats = useMemo(() => {
    const map = new Map<
      string,
      { orderCount: number; totalSpent: number; openTickets: number }
    >();
    for (const o of orders) {
      if (!o.uid) continue;
      const cur = map.get(o.uid) || { orderCount: 0, totalSpent: 0, openTickets: 0 };
      cur.orderCount += 1;
      if (isRecognizedSale(o)) {
        cur.totalSpent += Number(o.total || 0);
      }
      map.set(o.uid, cur);
    }
    for (const t of tickets) {
      if (!t.uid) continue;
      const cur = map.get(t.uid) || { orderCount: 0, totalSpent: 0, openTickets: 0 };
      if (t.status === 'open' || t.status === 'in_progress') {
        cur.openTickets += 1;
      }
      map.set(t.uid, cur);
    }
    return map;
  }, [orders, tickets]);

  const filteredClients = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return clients.filter((c) => {
      const stats = customerStats.get(c.id) || { orderCount: 0, totalSpent: 0, openTickets: 0 };
      if (segment === 'vip' && stats.totalSpent < 150 && stats.orderCount < 3) return false;
      if (segment === 'inactive' && stats.orderCount > 0) return false;
      if (segment === 'banned' && c.role !== 'banned') return false;

      if (q) {
        const mName = c.name?.toLowerCase().includes(q);
        const mEmail = c.email?.toLowerCase().includes(q);
        const mPhone = c.telefone?.toLowerCase().includes(q);
        const mId = c.id.toLowerCase().includes(q);
        if (!mName && !mEmail && !mPhone && !mId) return false;
      }
      return true;
    });
  }, [clients, customerStats, segment, queryText]);

  const updateParam = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams);
    if (!v || v === 'all') next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes & CRM 360°"
        subtitle="Base de moradores do condomínio, histórico de compras, saldo do Clube VIP e atendimento integrado."
        badge={`${filteredClients.length} moradores`}
      />

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
            placeholder="Buscar morador por nome, e-mail, telefone ou UID..."
            aria-label="Buscar morador"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs sm:text-sm text-white placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Todos os Moradores' },
            { id: 'vip', label: 'Recorrentes / VIP' },
            { id: 'inactive', label: 'Sem Pedidos Realizados' },
            { id: 'banned', label: 'Contas Suspensas' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateParam('segment', tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                segment === tab.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Nenhum morador encontrado"
          description="Ajuste os filtros de segmento ou o termo de busca."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const stats = customerStats.get(client.id) || {
              orderCount: 0,
              totalSpent: 0,
              openTickets: 0,
            };
            const isBanned = client.role === 'banned';

            return (
              <div
                key={client.id}
                className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/customers/${client.id}`}
                        className="text-sm font-extrabold text-white hover:text-amber-400 truncate block"
                      >
                        {client.name || 'Morador sem nome'}
                      </Link>
                      <div className="text-xs text-slate-400 truncate">{client.email}</div>
                      {client.telefone && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{client.telefone}</div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border shrink-0 ${
                        isBanned
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : client.role === 'admin'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isBanned ? 'Suspenso' : client.role === 'admin' ? 'Staff' : 'Ativo'}
                    </span>
                  </div>

                  {/* Mini KPIs */}
                  <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Pedidos</div>
                      <div className="text-xs font-extrabold text-white mt-0.5">
                        {stats.orderCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">LTV Pago</div>
                      <div className="text-xs font-extrabold text-emerald-400 mt-0.5">
                        {formatCurrency(stats.totalSpent)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">CPF</div>
                      <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                        {maskCpf(client.cpf, false)}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 mt-3 flex items-center justify-between">
                    <span>Último acesso: {formatDateTime(client.lastLogin)}</span>
                    {stats.openTickets > 0 && (
                      <span className="text-sky-400 font-bold">
                        {stats.openTickets} chamado(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {canEditDiamonds && !isBanned && (
                      <button
                        type="button"
                        onClick={() => {
                          setDiamondTarget(client);
                          setDiamondAmount(50);
                          setDiamondReason('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-bold inline-flex items-center gap-1"
                        title="Creditar ou debitar diamantes com auditoria"
                      >
                        <Gem size={13} />
                        Diamantes
                      </button>
                    )}
                    {canBan && !isBanned && client.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => setBanTarget(client)}
                        className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                        title="Suspender conta do morador"
                        aria-label="Suspender conta"
                      >
                        <Ban size={14} />
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/admin/customers/${client.id}`}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Eye size={13} />
                    Ficha 360°
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diamond Grant Modal */}
      {diamondTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Gem size={18} className="text-indigo-400" />
              Ajustar Diamantes — {diamondTarget.name}
            </h3>
            <p className="text-xs text-slate-400">
              Use valor positivo para bonificar ou negativo para estornar diamantes do Clube VIP.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Quantidade de Diamantes
                </label>
                <input
                  type="number"
                  value={diamondAmount}
                  onChange={(e) => setDiamondAmount(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Motivo Auditado *
                </label>
                <textarea
                  rows={2}
                  value={diamondReason}
                  onChange={(e) => setDiamondReason(e.target.value)}
                  placeholder="Ex: Cortesia por atraso na entrega #1024"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDiamondTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !diamondAmount ||
                  diamondReason.trim().length < 3 ||
                  actionLoading === `diamonds-${diamondTarget.id}`
                }
                onClick={async () => {
                  const ok = await handleGrantDiamonds(
                    diamondTarget.id,
                    diamondAmount,
                    diamondReason.trim(),
                  );
                  if (ok) setDiamondTarget(null);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ShoppingBag size={13} />
                Confirmar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      <ReasonConfirmModal
        open={Boolean(banTarget)}
        title={`Suspender Conta — ${banTarget?.name || ''}`}
        description="A suspensão revoga imediatamente as sessões ativas do usuário e bloqueia novos pedidos no aplicativo."
        confirmLabel="Suspender Conta"
        danger
        loading={Boolean(banTarget && actionLoading === `ban-${banTarget.id}`)}
        onClose={() => setBanTarget(null)}
        onConfirm={async (reason) => {
          if (!banTarget) return;
          const ok = await handleBanUser(banTarget.id, reason);
          if (ok) setBanTarget(null);
        }}
      />
    </div>
  );
};

