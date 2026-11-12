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
            className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 font-bold text-xs"
          >
            Voltar para Clientes
          </Link>
        }
      />
    );
  }

  const isBanned = client.role === 'banned';

  return (
    <div className="space-y-5">
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
              className="px-3 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/30 font-semibold text-xs inline-flex items-center gap-1.5"
            >
              <Headphones size={14} />
              Novo Chamado p/ Morador
            </Link>
            {canEditDiamonds && !isBanned && (
              <button
                type="button"
                onClick={() => setDiamondOpen(true)}
                className="px-3 py-2 rounded-lg bg-[var(--adm-gold-soft)] hover:bg-amber-500/20 text-[var(--adm-gold)] border border-[var(--adm-gold-border)] font-semibold text-xs inline-flex items-center gap-1.5"
              >
                <Gem size={14} />
                Ajustar Diamantes
              </button>
            )}
            {canBan && !isBanned && client.role !== 'admin' && (
              <button
                type="button"
                onClick={() => setBanOpen(true)}
                className="px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 font-semibold text-xs inline-flex items-center gap-1.5"
              >
                <Ban size={14} />
                Suspender Conta
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Profile, Addresses & Clube VIP */}
        <div className="space-y-5">
          {/* Profile Card */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-3">
            <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
              <User size={16} className="text-[var(--adm-gold)]" />
              Dados Cadastrais (Minimização LGPD)
            </h2>
            <div className="text-xs space-y-2 text-[var(--adm-text-muted)]">
              <div>
                <span className="text-[var(--adm-text-dim)] block text-[11px]">E-mail</span>
                <span className="font-semibold text-[var(--adm-text)]">{client.email || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--adm-text-dim)] block text-[11px]">Telefone / WhatsApp</span>
                <span className="font-semibold text-[var(--adm-text)] tabular-nums">
                  {client.telefone || 'Não informado'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[var(--adm-text-dim)] block text-[11px]">CPF</span>
                  <span className="font-mono font-semibold text-[var(--adm-text)] tabular-nums">
                    {maskCpf(client.cpf, revealCpf)}
                  </span>
                </div>
                {canRevealPii && client.cpf && (
                  <button
                    type="button"
                    onClick={() => setRevealCpf((r) => !r)}
                    className="p-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-[var(--adm-text-muted)] text-xs inline-flex items-center gap-1"
                  >
                    {revealCpf ? <EyeOff size={13} /> : <Eye size={13} />}
                    {revealCpf ? 'Ocultar' : 'Revelar'}
                  </button>
                )}
              </div>
              <div>
                <span className="text-[var(--adm-text-dim)] block text-[11px]">Último Login</span>
                <span className="tabular-nums">{formatDateTime(client.lastLogin)}</span>
              </div>
            </div>
          </div>

          {/* Clube VIP Balance */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
                <Gem size={16} className="text-[var(--adm-gold)]" />
                Clube VIP & Fidelidade
              </h2>
              <span className="text-lg font-extrabold text-[var(--adm-gold)] tabular-nums">
                {clube?.diamonds ?? client.diamonds ?? 0} 💎
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center bg-[var(--adm-bg-subtle)] p-3 rounded-lg border border-[var(--adm-border)]">
              <div>
                <div className="text-[10px] uppercase text-[var(--adm-text-dim)] font-bold">Total Gasto</div>
                <div className="text-sm font-bold text-emerald-300 tabular-nums">
                  {formatCurrency(totalSpent)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[var(--adm-text-dim)] font-bold">Pedidos</div>
                <div className="text-sm font-bold text-[var(--adm-text)] tabular-nums">
                  {customerOrders.length}
                </div>
              </div>
            </div>
            {clube?.history && clube.history.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-bold uppercase text-[var(--adm-text-dim)]">
                  Últimas Movimentações de Diamantes
                </div>
                {clube.history.slice(0, 4).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-[var(--adm-bg-subtle)] px-2.5 py-1.5 rounded-lg border border-[var(--adm-border)]"
                  >
                    <span className="text-[var(--adm-text-muted)] truncate">{h.desc}</span>
                    <span
                      className={`font-bold shrink-0 tabular-nums ${
                        h.isPlus ? 'text-emerald-300' : 'text-rose-300'
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
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-3">
            <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
              <MapPin size={16} className="text-emerald-300" />
              Endereços Cadastrados ({addresses.length})
            </h2>
            {addresses.length === 0 ? (
              <p className="text-xs text-[var(--adm-text-muted)]">Nenhum endereço salvo pelo morador.</p>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] text-xs space-y-0.5"
                  >
                    <div className="font-bold text-[var(--adm-gold)]">
                      {addr.condominio || addr.label || 'Endereço'}
                    </div>
                    {(addr.bloco || addr.apartamento) && (
                      <div className="text-[var(--adm-text)] font-semibold">
                        {addr.bloco ? `Bloco ${addr.bloco} ` : ''}
                        {addr.apartamento ? `• Apto ${addr.apartamento}` : ''}
                      </div>
                    )}
                    {addr.street && (
                      <div className="text-[var(--adm-text-muted)]">
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
        <div className="lg:col-span-2 space-y-5">
          {/* Customer Orders */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5">
            <h2 className="text-base font-bold text-[var(--adm-text)] mb-4 flex items-center gap-2">
              <ShoppingBag size={17} className="text-[var(--adm-gold)]" />
              Histórico de Pedidos ({customerOrders.length})
            </h2>
            {customerOrders.length === 0 ? (
              <p className="text-xs text-[var(--adm-text-muted)] py-6 text-center bg-[var(--adm-bg-subtle)] rounded-lg border border-[var(--adm-border)]">
                Este morador ainda não realizou pedidos.
              </p>
            ) : (
              <div className="divide-y divide-[var(--adm-border)]">
                {customerOrders.map((o) => (
                  <div
                    key={o.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className="font-mono font-bold text-[var(--adm-gold)] hover:underline text-xs tabular-nums"
                        >
                          #{(o.orderNumber || o.id).slice(0, 8).toUpperCase()}
                        </Link>
                        <OrderStatusBadge status={o.status} />
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </div>
                      <div className="text-[11px] text-[var(--adm-text-dim)] mt-1 tabular-nums">
                        {formatDateTime(o.createdAt)} • {o.items?.length || 0} itens
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-emerald-300 tabular-nums">
                        {formatCurrency(o.total)}
                      </span>
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] border border-[var(--adm-border)]"
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
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
                <Headphones size={17} className="text-sky-300" />
                Chamados de Suporte ({customerTickets.length})
              </h2>
              <Link
                to={`/admin/support?uid=${encodeURIComponent(client.id)}`}
                className="text-xs font-semibold text-sky-300 hover:underline"
              >
                + Registrar Atendimento
              </Link>
            </div>
            {customerTickets.length === 0 ? (
              <p className="text-xs text-[var(--adm-text-muted)] py-6 text-center bg-[var(--adm-bg-subtle)] rounded-lg border border-[var(--adm-border)]">
                Nenhum chamado de suporte registrado para este morador.
              </p>
            ) : (
              <div className="divide-y divide-[var(--adm-border)]">
                {customerTickets.map((t) => (
                  <div
                    key={t.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/support/${t.id}`}
                          className="font-mono font-bold text-sky-300 hover:underline text-xs tabular-nums"
                        >
                          {t.ticketNumber || `#${t.id.slice(0, 8)}`}
                        </Link>
                        <span className="text-xs font-semibold text-[var(--adm-text)]">{t.subject}</span>
                        <TicketStatusBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <div className="text-[11px] text-[var(--adm-text-dim)] mt-1 tabular-nums">
                        {formatDateTime(t.createdAt)} • Categoria: {t.category}
                      </div>
                    </div>
                    <Link
                      to={`/admin/support/${t.id}`}
                      className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] border border-[var(--adm-border)] self-start sm:self-center"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border-strong)] rounded-[10px] max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[var(--adm-text)]">
              Ajustar Diamantes — {client.name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Quantidade (+ crédito / - débito)
                </label>
                <input
                  type="number"
                  value={diamondAmount}
                  onChange={(e) => setDiamondAmount(Number(e.target.value))}
                  className="adm-input w-full px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Justificativa Auditada *
                </label>
                <textarea
                  rows={2}
                  value={diamondReason}
                  onChange={(e) => setDiamondReason(e.target.value)}
                  placeholder="Informe o motivo do ajuste..."
                  className="adm-input w-full px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiamondOpen(false)}
                className="px-4 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-xs font-semibold text-[var(--adm-text-muted)]"
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
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 text-xs font-bold"
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

