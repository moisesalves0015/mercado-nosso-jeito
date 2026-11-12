import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  CheckCircle2,
  Clock,
  Headphones,
  Lock,
  MessageSquare,
  Send,
  ShoppingBag,
  User,
  UserCheck,
} from 'lucide-react';
import { functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData, type SupportTicket } from '../AdminDataContext';
import {
  EmptyState,
  formatDateTime,
  PageHeader,
  PriorityBadge,
  TicketStatusBadge,
} from '../components/AdminUi';

export const AdminSupportDetailPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user, userProfile, canAny } = useAuth();
  const { tickets, actionLoading, handleUpdateTicket } = useAdminData();

  const [fetchedTicket, setFetchedTicket] = useState<SupportTicket | null>(null);
  const [note, setNote] = useState('');
  const [internal, setInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState<SupportTicket['status']>('in_progress');
  const [nextPriority, setNextPriority] = useState<SupportTicket['priority']>('medium');

  const liveTicket = tickets.find((t) => t.id === ticketId);
  const ticket = liveTicket || fetchedTicket;

  const canEdit = canAny(['suporte:edit', 'suporte:approve', 'suporte:archive']);

  useEffect(() => {
    if (liveTicket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNextStatus(liveTicket.status);
      setNextPriority(liveTicket.priority);
      return;
    }
    if (!ticketId) return;
    let active = true;
    const fn = httpsCallable<{ ticketId: string }, { ticket: SupportTicket }>(functions, 'adminGetTicket');
    fn({ ticketId })
      .then((res) => {
        if (active && res.data?.ticket) {
          setFetchedTicket(res.data.ticket);
          setNextStatus(res.data.ticket.status);
          setNextPriority(res.data.ticket.priority);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ticketId, liveTicket]);

  if (!ticket) {
    return (
      <EmptyState
        icon={<Headphones size={24} />}
        title="Chamado não localizado"
        description={`Não encontramos o chamado #${ticketId}.`}
        action={
          <Link
            to="/admin/support"
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Voltar para Fila de Suporte
          </Link>
        }
      />
    );
  }

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await handleUpdateTicket({
      ticketId: ticket.id,
      status: nextStatus,
      priority: nextPriority,
      note: note.trim() || undefined,
      internal,
    });
    if (ok) {
      setNote('');
    }
  };

  const handleClaimTicket = async () => {
    if (!user) return;
    await handleUpdateTicket({
      ticketId: ticket.id,
      status: ticket.status === 'open' ? 'in_progress' : ticket.status,
      assignedTo: user.uid,
      note: `Chamado assumido por ${userProfile?.name || 'Operador'}`,
      internal: true,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${ticket.ticketNumber || `#${ticket.id.slice(0, 8)}`} — ${ticket.subject}`}
        subtitle={`Aberto em ${formatDateTime(ticket.createdAt)} • Categoria: ${ticket.category}`}
        backTo="/admin/support"
        backLabel="Voltar para Fila de Suporte"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {canEdit && ticket.assignedTo !== user?.uid && (
              <button
                type="button"
                onClick={handleClaimTicket}
                disabled={actionLoading === `ticket-${ticket.id}`}
                className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <UserCheck size={14} />
                Assumir Atendimento
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Initial Description + Timeline + Reply Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Original Request */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
              Relato Inicial do Chamado
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </p>
          </div>

          {/* Timeline */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Clock size={17} className="text-sky-400" />
              Histórico de Interações & Notas ({ticket.timeline?.length || 0})
            </h2>

            {!ticket.timeline || ticket.timeline.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma interação registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {ticket.timeline.map((ev, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border text-xs ${
                      ev.internal
                        ? 'bg-amber-950/25 border-amber-500/30 text-amber-100'
                        : 'bg-slate-950/70 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 font-bold">
                        <span>{ev.actorRole === 'client' ? 'Morador' : `Equipe (${ev.actorRole || 'Staff'})`}</span>
                        {ev.internal && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] uppercase">
                            <Lock size={10} /> Nota Interna
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(ev.createdAtMillis)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{ev.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reply / Status Form */}
          {canEdit && (
            <form
              onSubmit={handleSubmitUpdate}
              className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4"
            >
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <MessageSquare size={17} className="text-emerald-400" />
                Registrar Tratativa / Atualizar Status
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Novo Status
                  </label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as SupportTicket['status'])}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-bold"
                  >
                    <option value="open">Aberto</option>
                    <option value="in_progress">Em Atendimento</option>
                    <option value="waiting_customer">Aguardando Morador</option>
                    <option value="resolved">Resolvido</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={nextPriority}
                    onChange={(e) => setNextPriority(e.target.value as SupportTicket['priority'])}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-bold"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Mensagem ou Anotação da Equipe
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Descreva a solução adotada, orientação ao morador ou nota operacional..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-amber-500"
                  />
                  <span>Marcar como nota interna (visível apenas para a equipe)</span>
                </label>

                <div className="flex items-center gap-2">
                  {ticket.status !== 'resolved' && (
                    <button
                      type="button"
                      disabled={actionLoading === `ticket-${ticket.id}`}
                      onClick={() =>
                        handleUpdateTicket({
                          ticketId: ticket.id,
                          status: 'resolved',
                          note: note.trim() || 'Chamado concluído e resolvido pela equipe.',
                          internal,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      Marcar Resolvido
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={actionLoading === `ticket-${ticket.id}`}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5"
                  >
                    <Send size={14} />
                    Salvar Atualização
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Context Cards */}
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-3">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <User size={16} className="text-indigo-400" />
              Morador Vinculado
            </h2>
            <div className="text-xs space-y-1">
              <div className="font-bold text-white text-sm">{ticket.customerName}</div>
              {ticket.customerEmail && <div className="text-slate-400">{ticket.customerEmail}</div>}
              <div className="text-[11px] text-slate-400 font-mono">UID: {ticket.uid}</div>
              <div className="pt-2">
                <Link
                  to={`/admin/customers/${ticket.uid}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-bold text-xs"
                >
                  Abrir Ficha 360° do Morador
                </Link>
              </div>
            </div>
          </div>

          {ticket.orderId && (
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-3">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ShoppingBag size={16} className="text-amber-400" />
                Pedido Relacionado
              </h2>
              <div className="text-xs space-y-2">
                <div className="font-mono font-bold text-amber-400">#{ticket.orderId}</div>
                <Link
                  to={`/admin/orders/${ticket.orderId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-xs"
                >
                  Inspecionar Pedido
                </Link>
              </div>
            </div>
          )}

          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-2 text-xs">
            <div className="font-bold text-white">Responsável pelo Chamado</div>
            <div className="text-slate-300">
              {ticket.assignedName ? (
                <span>Atribuído a: {ticket.assignedName}</span>
              ) : (
                <span className="text-slate-400">Ainda não atribuído a um operador específico</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
