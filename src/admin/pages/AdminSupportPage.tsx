import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  Headphones,
  Plus,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData, type SupportTicket } from '../AdminDataContext';
import {
  EmptyState,
  formatDateTime,
  PageHeader,
  PriorityBadge,
  TicketStatusBadge,
} from '../components/AdminUi';

export const AdminSupportPage: React.FC = () => {
  const { canAny } = useAuth();
  const { tickets, clients, actionLoading, handleCreateTicket } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const statusFilter = searchParams.get('status') || 'all';
  const priorityFilter = searchParams.get('priority') || 'all';
  const queryText = searchParams.get('q') || '';
  const prefillUid = searchParams.get('uid') || '';
  const prefillOrderId = searchParams.get('orderId') || '';

  const [createOpen, setCreateOpen] = useState(false);
  const [targetUid, setTargetUid] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Pedido / Entrega');
  const [priority, setPriority] = useState<SupportTicket['priority']>('medium');
  const [orderId, setOrderId] = useState('');
  const [description, setDescription] = useState('');

  const canCreate = canAny(['suporte:create', 'suporte:edit', 'crm:create']);

  useEffect(() => {
    if (prefillUid || prefillOrderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetUid(prefillUid);
      setOrderId(prefillOrderId);
      if (prefillOrderId) {
        setSubject(`Atendimento referente ao pedido #${prefillOrderId.slice(0, 8).toUpperCase()}`);
      }
      setCreateOpen(true);
    }
  }, [prefillUid, prefillOrderId]);

  const updateParam = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams);
    if (!v || v === 'all') next.delete(k);
    else next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  const filteredTickets = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (q) {
        const mNum = t.ticketNumber?.toLowerCase().includes(q);
        const mSub = t.subject?.toLowerCase().includes(q);
        const mCust = t.customerName?.toLowerCase().includes(q);
        const mOrd = t.orderId?.toLowerCase().includes(q);
        if (!mNum && !mSub && !mCust && !mOrd) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, queryText]);

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 4 || description.trim().length < 5) return;
    const res = await handleCreateTicket({
      uid: targetUid.trim() || undefined,
      subject: subject.trim(),
      category,
      priority,
      orderId: orderId.trim() || undefined,
      description: description.trim(),
    });
    if (res) {
      setCreateOpen(false);
      setSubject('');
      setDescription('');
      navigate(`/admin/support/${res.ticketId}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suporte & Chamados (CRM)"
        subtitle="Fila centralizada de solicitações de moradores, ocorrências de pedidos e histórico auditado."
        badge={`${filteredTickets.length} chamados`}
        actions={
          canCreate && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              <Plus size={15} />
              Registrar Chamado
            </button>
          )
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
              placeholder="Buscar por protocolo, assunto, morador ou ID do pedido..."
              aria-label="Buscar chamados"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs sm:text-sm text-white placeholder-slate-400"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => updateParam('priority', e.target.value)}
            aria-label="Filtrar por prioridade"
            className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-bold text-slate-200"
          >
            <option value="all">Todas as Prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'open', label: 'Abertos' },
            { id: 'in_progress', label: 'Em Atendimento' },
            { id: 'waiting_customer', label: 'Aguard. Morador' },
            { id: 'resolved', label: 'Resolvidos' },
            { id: 'archived', label: 'Arquivados' },
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

      {filteredTickets.length === 0 ? (
        <EmptyState
          icon={<Headphones size={22} />}
          title="Nenhum chamado na fila"
          description="Não há chamados correspondentes aos filtros selecionados."
          action={
            canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Abrir Primeiro Chamado
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md transition-all"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/admin/support/${t.id}`}
                    className="font-mono text-xs font-extrabold text-sky-400 hover:underline"
                  >
                    {t.ticketNumber || `#${t.id.slice(0, 8)}`}
                  </Link>
                  <TicketStatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                    {t.category}
                  </span>
                </div>

                <Link
                  to={`/admin/support/${t.id}`}
                  className="text-sm sm:text-base font-extrabold text-white hover:text-amber-400 block truncate"
                >
                  {t.subject}
                </Link>

                <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                  <Link
                    to={`/admin/customers/${t.uid}`}
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-amber-300 font-semibold"
                  >
                    <User size={12} />
                    {t.customerName || 'Morador'}
                  </Link>
                  {t.orderId && (
                    <Link
                      to={`/admin/orders/${t.orderId}`}
                      className="inline-flex items-center gap-1 text-amber-400 hover:underline font-mono"
                    >
                      <ShoppingBag size={12} />
                      Pedido #{t.orderId.slice(0, 8).toUpperCase()}
                    </Link>
                  )}
                  <span>• Aberto em {formatDateTime(t.createdAt)}</span>
                  {t.assignedName && <span>• Resp: {t.assignedName}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Link
                  to={`/admin/support/${t.id}`}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  Tratar Chamado
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Headphones size={18} className="text-sky-400" />
                Registrar Novo Chamado de Suporte
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitNew} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Morador (Opcional / UID)
                  </label>
                  <input
                    type="text"
                    list="crm-clients-list"
                    value={targetUid}
                    onChange={(e) => setTargetUid(e.target.value)}
                    placeholder="UID do morador..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                  />
                  <datalist id="crm-clients-list">
                    {clients.slice(0, 50).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    ID do Pedido Vinculado
                  </label>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Opcional..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                  >
                    <option value="Pedido / Entrega">Pedido / Entrega</option>
                    <option value="Pagamento / Pix">Pagamento / Pix</option>
                    <option value="Produto / Qualidade">Produto / Qualidade</option>
                    <option value="Clube VIP / Diamantes">Clube VIP / Diamantes</option>
                    <option value="Dúvida / Sugestão">Dúvida / Sugestão</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as SupportTicket['priority'])}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Assunto *
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Resumo objetivo da solicitação..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Descrição Detalhada *
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Relato do morador ou observação inicial do atendimento..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'ticket-create'}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold"
                >
                  Criar Chamado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
