import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  Ban,
  Eye,
  EyeOff,
  Gem,
  Headphones,
  MapPin,
  ShoppingBag,
  User,
} from 'lucide-react';
import { functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { isRecognizedSale } from '../../utils/adminAnalytics';
import { useAdminData, type AdminClient } from '../AdminDataContext';
import {
  EmptyState,
  formatCurrency,
  formatDateTime,
  maskCpf,
  OrderStatusBadge,
  PageHeader,
  PaymentStatusBadge,
  PriorityBadge,
  ReasonConfirmModal,
  TicketStatusBadge,
} from '../components/AdminUi';

interface SavedAddress {
  id: string;
  label?: string;
  condominio?: string;
  bloco?: string;
  apartamento?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

interface ClubeProfileDoc {
  diamonds?: number;
  streak?: number;
  history?: Array<{ desc: string; date: string; value: string; isPlus?: boolean }>;
}

export const AdminCustomerDetailPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const { canAny } = useAuth();
  const {
    clients,
    orders,
    tickets,
    actionLoading,
    handleGrantDiamonds,
    handleBanUser,
  } = useAdminData();

  const [fetchedClient, setFetchedClient] = useState<AdminClient | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [clube, setClube] = useState<ClubeProfileDoc | null>(null);
  const [revealCpf, setRevealCpf] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [diamondOpen, setDiamondOpen] = useState(false);
  const [diamondAmount, setDiamondAmount] = useState(50);
  const [diamondReason, setDiamondReason] = useState('');

  const liveClient = clients.find((c) => c.id === customerId);
  const client = liveClient || fetchedClient;

  const canRevealPii = canAny(['clientes:edit', 'usuarios:admin']);
  const canEditDiamonds = canAny(['clube:edit', 'clube:admin', 'clientes:edit']);
  const canBan = canAny(['usuarios:archive', 'usuarios:admin', 'clientes:archive']);

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    const fn = httpsCallable<
      { customerId: string },
      { customer: AdminClient; addresses: SavedAddress[]; clube: ClubeProfileDoc | null }
    >(functions, 'adminGetCustomer');
    fn({ customerId })
      .then((res) => {
        if (!active) return;
        if (res.data?.customer && !liveClient) {
          setFetchedClient(res.data.customer);
        }
        setAddresses(res.data?.addresses || []);
        setClube(res.data?.clube || null);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [customerId, liveClient]);

  const customerOrders = useMemo(
    () => orders.filter((o) => o.uid === customerId),
    [orders, customerId],
  );

  const customerTickets = useMemo(
    () => tickets.filter((t) => t.uid === customerId),
    [tickets, customerId],
  );

  const totalSpent = useMemo(
    () =>
      customerOrders
        .filter((o) => isRecognizedSale(o))
        .reduce((acc, o) => acc + Number(o.total || 0), 0),
    [customerOrders],
  );

  if (!client) {
    return (
      <EmptyState
        icon={<User size={24} />}
        title="Ficha do morador não localizada"
        description={`Não encontramos o cadastro #${customerId}.`}
        action={
          <Link
            to="/admin/customers"
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Voltar para Clientes
          </Link>
        }
      />
    );
  }

  const isBanned = client.role === 'banned';

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name || 'Morador'}
        subtitle={`UID: ${client.id} • Cadastrado em ${formatDateTime(client.createdAt)}`}
        badge={isBanned ? 'Conta Suspensa' : 'Morador Ativo'}
        backTo="/admin/customers"
        backLabel="Voltar para Clientes"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/admin/support?uid=${encodeURIComponent(client.id)}`}
              className="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Headphones size={14} />
              Novo Chamado p/ Morador
            </Link>
            {canEditDiamonds && !isBanned && (
              <button
                type="button"
                onClick={() => setDiamondOpen(true)}
                className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Gem size={14} />
                Ajustar Diamantes
              </button>
            )}
            {canBan && !isBanned && client.role !== 'admin' && (
              <button
                type="button"
                onClick={() => setBanOpen(true)}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Ban size={14} />
                Suspender Conta
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile, Addresses & Clube VIP */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-3">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <User size={16} className="text-amber-400" />
              Dados Cadastrais (Minimização LGPD)
            </h2>
            <div className="text-xs space-y-2 text-slate-300">
              <div>
                <span className="text-slate-400 block text-[11px]">E-mail</span>
                <span className="font-bold text-white">{client.email || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Telefone / WhatsApp</span>
                <span className="font-bold text-white">{client.telefone || 'Não informado'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">CPF</span>
                  <span className="font-mono font-bold text-white">
                    {maskCpf(client.cpf, revealCpf)}
                  </span>
                </div>
                {canRevealPii && client.cpf && (
                  <button
                    type="button"
                    onClick={() => setRevealCpf((r) => !r)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs inline-flex items-center gap-1"
                  >
                    {revealCpf ? <EyeOff size={13} /> : <Eye size={13} />}
                    {revealCpf ? 'Ocultar' : 'Revelar'}
                  </button>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Último Login</span>
                <span>{formatDateTime(client.lastLogin)}</span>
              </div>
            </div>
          </div>

          {/* Clube VIP Balance */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Gem size={16} className="text-indigo-400" />
                Clube VIP & Fidelidade
              </h2>
              <span className="text-lg font-black text-indigo-400">
                {clube?.diamonds ?? client.diamonds ?? 0} 💎
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-bold">Total Gasto</div>
                <div className="text-sm font-extrabold text-emerald-400">
                  {formatCurrency(totalSpent)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-bold">Pedidos</div>
                <div className="text-sm font-extrabold text-white">{customerOrders.length}</div>
              </div>
            </div>
            {clube?.history && clube.history.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-bold uppercase text-slate-400">
                  Últimas Movimentações de Diamantes
                </div>
                {clube.history.slice(0, 4).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/70"
                  >
                    <span className="text-slate-300 truncate">{h.desc}</span>
                    <span
                      className={`font-bold shrink-0 ${
                        h.isPlus ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Addresses */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-3">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <MapPin size={16} className="text-emerald-400" />
              Endereços Cadastrados ({addresses.length})
            </h2>
            {addresses.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum endereço salvo pelo morador.</p>
            ) : (
              <div className="space-y-2.5">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-0.5"
                  >
                    <div className="font-bold text-amber-300">
                      {addr.condominio || addr.label || 'Endereço'}
                    </div>
                    {(addr.bloco || addr.apartamento) && (
                      <div className="text-white font-semibold">
                        {addr.bloco ? `Bloco ${addr.bloco} ` : ''}
                        {addr.apartamento ? `• Apto ${addr.apartamento}` : ''}
                      </div>
                    )}
                    {addr.street && (
                      <div className="text-slate-300">
                        {addr.street}, {addr.number}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Orders History & Support Tickets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Orders */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg">
            <h2 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
              <ShoppingBag size={17} className="text-amber-400" />
              Histórico de Pedidos ({customerOrders.length})
            </h2>
            {customerOrders.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center bg-slate-950/50 rounded-xl border border-slate-800">
                Este morador ainda não realizou pedidos.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {customerOrders.map((o) => (
                  <div
                    key={o.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className="font-mono font-extrabold text-amber-400 hover:underline text-xs"
                        >
                          #{(o.orderNumber || o.id).slice(0, 8).toUpperCase()}
                        </Link>
                        <OrderStatusBadge status={o.status} />
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {formatDateTime(o.createdAt)} • {o.items?.length || 0} itens
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-emerald-400">
                        {formatCurrency(o.total)}
                      </span>
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700"
                      >
                        Abrir
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Support Tickets */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Headphones size={17} className="text-sky-400" />
                Chamados de Suporte ({customerTickets.length})
              </h2>
              <Link
                to={`/admin/support?uid=${encodeURIComponent(client.id)}`}
                className="text-xs font-bold text-sky-400 hover:underline"
              >
                + Registrar Atendimento
              </Link>
            </div>
            {customerTickets.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center bg-slate-950/50 rounded-xl border border-slate-800">
                Nenhum chamado de suporte registrado para este morador.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {customerTickets.map((t) => (
                  <div
                    key={t.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/support/${t.id}`}
                          className="font-mono font-bold text-sky-400 hover:underline text-xs"
                        >
                          {t.ticketNumber || `#${t.id.slice(0, 8)}`}
                        </Link>
                        <span className="text-xs font-bold text-white">{t.subject}</span>
                        <TicketStatusBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {formatDateTime(t.createdAt)} • Categoria: {t.category}
                      </div>
                    </div>
                    <Link
                      to={`/admin/support/${t.id}`}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 self-start sm:self-center"
                    >
                      Ver Chamado
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diamond Modal */}
      {diamondOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              Ajustar Diamantes — {client.name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Quantidade (+ crédito / - débito)
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
                  Justificativa Auditada *
                </label>
                <textarea
                  rows={2}
                  value={diamondReason}
                  onChange={(e) => setDiamondReason(e.target.value)}
                  placeholder="Informe o motivo do ajuste..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiamondOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!diamondAmount || diamondReason.trim().length < 3}
                onClick={async () => {
                  const ok = await handleGrantDiamonds(
                    client.id,
                    diamondAmount,
                    diamondReason.trim(),
                  );
                  if (ok) setDiamondOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold"
              >
                Aplicar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      <ReasonConfirmModal
        open={banOpen}
        title={`Suspender Conta — ${client.name}`}
        description="Esta ação bloqueia imediatamente o acesso do usuário e registra o motivo na auditoria."
        confirmLabel="Confirmar Suspensão"
        danger
        loading={actionLoading === `ban-${client.id}`}
        onClose={() => setBanOpen(false)}
        onConfirm={async (reason) => {
          const ok = await handleBanUser(client.id, reason);
          if (ok) setBanOpen(false);
        }}
      />
    </div>
  );
};

