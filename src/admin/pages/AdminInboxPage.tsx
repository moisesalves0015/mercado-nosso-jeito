import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData } from '../AdminDataContext';
import { EmptyState, PageHeader } from '../components/AdminUi';
import { SYSTEM_AGENTS } from '../inbox/agents';
import {
  isMessageVisibleToPartner,
  isUnreadByUser,
  resolveEntityRoute,
  validateInboxAttachment,
} from '../inbox/normalizers';
import type {
  AdminInboxMessage,
  AgentRuleConfig,
  InboxAttachment,
  InboxComment,
  InboxEntityReference,
  InboxHistoryEntry,
  InboxReaction,
  InboxReactionType,
  InboxTask,
  PartnerAdminMember,
  QuickFilter,
  SystemAgentId,
} from '../inbox/types';
import {
  addInboxComment,
  decideInboxMessage,
  getInboxAttachmentDownloadUrl,
  listInboxPartners,
  markInboxMessageRead,
  muteSimilarInboxAlerts,
  runInboxAgents,
  subscribeAgentRules,
  subscribeInboxMessages,
  subscribeMessageAttachments,
  subscribeMessageComments,
  subscribeMessageHistory,
  subscribeMessageReactions,
  subscribeMessageTasks,
  toggleInboxReaction,
  updateInboxMessageStatus,
  updateInboxTask,
  uploadInboxAttachment,
} from '../../services/adminInboxService';
import { InboxSummaryBar } from '../inbox/components/InboxSummaryBar';
import { InboxFolderNav } from '../inbox/components/InboxFolderNav';
import { InboxMessageItem } from '../inbox/components/InboxMessageItem';
import { InboxDetailPane } from '../inbox/components/InboxDetailPane';
import { InboxComposeModal } from '../inbox/components/InboxComposeModal';
import { InboxTaskModal } from '../inbox/components/InboxTaskModal';
import { InboxAttachmentPreviewModal } from '../inbox/components/InboxAttachmentPreviewModal';
import { InboxAgentRulesView } from '../inbox/components/InboxAgentRulesView';

const SECTORS = Array.from(new Set(SYSTEM_AGENTS.map((a) => a.sector)));

export const AdminInboxPage: React.FC = () => {
  const { user, userProfile, staffAccess, can } = useAuth();
  const { orders, products, clients, tickets, showToast } = useAdminData();
  const navigate = useNavigate();

  const currentUid = user?.uid ?? userProfile?.uid ?? '';
  const canCreate = can('inbox:create') || can('inbox:admin');
  const canEdit = can('inbox:edit') || can('inbox:admin');
  const canApprove = can('inbox:approve') || can('inbox:admin');
  const canArchive = can('inbox:archive') || can('inbox:admin');
  const canAdminAgents = can('inbox:admin');

  // Top-level view mode
  const [viewMode, setViewMode] = useState<'inbox' | 'agents'>('inbox');

  // Messages & pagination
  const [messages, setMessages] = useState<AdminInboxMessage[]>([]);
  const [limitCount, setLimitCount] = useState(50);
  const [loadingList, setLoadingList] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  // Partners & Agent rules
  const [partners, setPartners] = useState<PartnerAdminMember[]>([]);
  const [agentRules, setAgentRules] = useState<Record<string, AgentRuleConfig>>({});

  // Filters
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [periodRefMs, setPeriodRefMs] = useState<number>(() => Date.now());

  // Collapsible Advanced Filters state (defaults to MINIMIZED as requested)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Selection & Detail subcollections
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [comments, setComments] = useState<InboxComment[]>([]);
  const [reactions, setReactions] = useState<InboxReaction[]>([]);
  const [history, setHistory] = useState<InboxHistoryEntry[]>([]);
  const [attachments, setAttachments] = useState<InboxAttachment[]>([]);
  const [tasks, setTasks] = useState<InboxTask[]>([]);

  // Composer / modals / busy flags
  const [composeOpen, setComposeOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [decisionPrompt, setDecisionPrompt] = useState<{
    kind: 'approved' | 'rejected' | 'disagreed' | 'disagree_reaction';
    label: string;
    requireReason: boolean;
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{
    attachment: InboxAttachment;
    url: string;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Online/offline watcher
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Load partners
  useEffect(() => {
    listInboxPartners()
      .then((list) => setPartners(list))
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  // Subscribe messages
  useEffect(() => {
    const unsub = subscribeInboxMessages(
      limitCount,
      (items) => {
        setMessages(items);
        setLoadingList(false);
        setSyncError(null);
      },
      (err) => {
        setLoadingList(false);
        setSyncError(err.message || 'Falha ao sincronizar Inbox ADM.');
      },
    );
    return unsub;
  }, [limitCount]);

  // Subscribe agent rules
  useEffect(() => {
    const unsub = subscribeAgentRules(
      (rules) => setAgentRules(rules),
      () => {
        /* fallback to defaults */
      },
    );
    return unsub;
  }, []);

  const selectedMessage = useMemo(
    () => messages.find((m) => m.id === selectedMessageId) ?? null,
    [messages, selectedMessageId],
  );

  // Subscribe detail subcollections for selected message
  useEffect(() => {
    if (!selectedMessageId) {
      return;
    }

    const u1 = subscribeMessageComments(selectedMessageId, setComments);
    const u2 = subscribeMessageReactions(selectedMessageId, setReactions);
    const u3 = subscribeMessageHistory(selectedMessageId, setHistory);
    const u4 = subscribeMessageAttachments(selectedMessageId, setAttachments);
    const u5 = subscribeMessageTasks(selectedMessageId, setTasks);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [selectedMessageId]);

  // Auto-mark as read when opening a new unread message
  useEffect(() => {
    if (!selectedMessage || !currentUid) return;
    if (isUnreadByUser(selectedMessage, currentUid) && canEdit) {
      markInboxMessageRead(selectedMessage.id, false).catch(() => {});
    }
  }, [selectedMessage, currentUid, canEdit]);

  // KPIs
  const kpis = useMemo(() => {
    const active = messages.filter((m) => m.status !== 'archived');
    const unread = active.filter((m) => isUnreadByUser(m, currentUid)).length;
    const critical = active.filter((m) => m.priority === 'critical' && m.status !== 'resolved').length;
    const awaitingReply = active.filter(
      (m) =>
        m.requestedResponseFromUserId === currentUid &&
        m.status !== 'resolved' &&
        m.status !== 'archived',
    ).length;
    const awaitingDecision = active.filter(
      (m) =>
        (m.requiresApproval || m.type === 'decision' || m.type === 'task_suggestion') &&
        !m.decision &&
        m.status !== 'resolved',
    ).length;
    return { unread, critical, awaitingReply, awaitingDecision };
  }, [messages, currentUid]);

  // Real counts for folders
  const folderCounts = useMemo<Partial<Record<QuickFilter, number>>>(() => {
    const active = messages.filter((m) => m.status !== 'archived');
    return {
      all: active.length,
      unread: active.filter((m) => isUnreadByUser(m, currentUid)).length,
      critical: active.filter((m) => m.priority === 'critical').length,
      important: active.filter((m) => m.importantBy?.[currentUid] || m.priority === 'important').length,
      human: active.filter((m) => m.source === 'human').length,
      system_agent: active.filter((m) => m.source !== 'human').length,
      to_me: active.filter((m) => m.toUserIds.includes(currentUid) || m.assignedToUserId === currentUid).length,
      to_all: active.filter((m) => m.toAll).length,
      awaiting_my_reply: active.filter((m) => m.requestedResponseFromUserId === currentUid).length,
      awaiting_decision: active.filter(
        (m) => (m.requiresApproval || m.type === 'decision' || m.type === 'task_suggestion') && !m.decision
      ).length,
      alert: active.filter((m) => m.type === 'alert' || m.type === 'incident').length,
      insight: active.filter((m) => m.type === 'insight').length,
      task_suggestion: active.filter((m) => m.type === 'task_suggestion').length,
      approved: active.filter((m) => m.status === 'approved').length,
      rejected: active.filter((m) => m.status === 'rejected').length,
      resolved: active.filter((m) => m.status === 'resolved').length,
      archived: messages.filter((m) => m.status === 'archived').length,
    };
  }, [messages, currentUid]);

  // Filtered messages
  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const periodMs =
      periodFilter === '24h'
        ? 24 * 3600 * 1000
        : periodFilter === '7d'
        ? 7 * 24 * 3600 * 1000
        : periodFilter === '30d'
        ? 30 * 24 * 3600 * 1000
        : null;

    return messages.filter((m) => {
      if (!isMessageVisibleToPartner(m, staffAccess?.permissions ?? [])) return false;

      if (quickFilter !== 'archived' && m.status === 'archived') return false;

      if (quickFilter === 'human' && m.source !== 'human') return false;
      if (quickFilter === 'system_agent' && m.source === 'human') return false;
      if (quickFilter === 'unread' && !isUnreadByUser(m, currentUid)) return false;
      if (quickFilter === 'critical' && m.priority !== 'critical') return false;
      if (quickFilter === 'important' && !m.importantBy?.[currentUid] && m.priority !== 'important')
        return false;
      if (quickFilter === 'to_me' && !m.toUserIds.includes(currentUid) && m.assignedToUserId !== currentUid)
        return false;
      if (quickFilter === 'to_all' && !m.toAll) return false;
      if (quickFilter === 'awaiting_my_reply' && m.requestedResponseFromUserId !== currentUid)
        return false;
      if (
        quickFilter === 'awaiting_decision' &&
        !((m.requiresApproval || m.type === 'decision' || m.type === 'task_suggestion') && !m.decision)
      )
        return false;
      if (quickFilter === 'alert' && m.type !== 'alert' && m.type !== 'incident') return false;
      if (quickFilter === 'insight' && m.type !== 'insight') return false;
      if (quickFilter === 'task_suggestion' && m.type !== 'task_suggestion') return false;
      if (quickFilter === 'approved' && m.status !== 'approved') return false;
      if (quickFilter === 'rejected' && m.status !== 'rejected') return false;
      if (quickFilter === 'resolved' && m.status !== 'resolved') return false;
      if (quickFilter === 'archived' && m.status !== 'archived') return false;

      if (agentFilter !== 'all' && m.agentId !== agentFilter) return false;
      if (sectorFilter !== 'all' && m.agentSector !== sectorFilter) return false;
      if (priorityFilter !== 'all' && m.priority !== priorityFilter) return false;

      if (periodMs !== null) {
        const createdMs = Date.parse(m.createdAt);
        if (Number.isFinite(createdMs) && periodRefMs - createdMs > periodMs) return false;
      }

      if (q) {
        const hay = [
          m.subject,
          m.body,
          m.senderName,
          m.senderRole ?? '',
          m.agentSector ?? '',
          ...m.relatedEntities.map((e) => `${e.label} ${e.id}`),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    messages,
    quickFilter,
    currentUid,
    agentFilter,
    sectorFilter,
    priorityFilter,
    periodFilter,
    periodRefMs,
    searchQuery,
    staffAccess?.permissions,
  ]);

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (agentFilter !== 'all') count++;
    if (sectorFilter !== 'all') count++;
    if (priorityFilter !== 'all') count++;
    if (periodFilter !== 'all') count++;
    return count;
  }, [agentFilter, sectorFilter, priorityFilter, periodFilter]);

  const handleClearAdvancedFilters = () => {
    setAgentFilter('all');
    setSectorFilter('all');
    setPriorityFilter('all');
    setPeriodFilter('all');
  };

  const handleRunAgents = async (agentId?: SystemAgentId) => {
    setBusyAction(agentId ? `run_${agentId}` : 'run_all');
    try {
      const res = await runInboxAgents(agentId);
      showToast(
        `Análise concluída: ${res.createdCount} nova(s), ${res.deduplicatedCount} deduplicada(s).`,
        'ok',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao executar agentes.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendComment = async (text: string, kind: 'comment' | 'forward' | 'request_info') => {
    if (!selectedMessage) return;
    setBusyAction('comment');
    try {
      await addInboxComment(selectedMessage.id, text, kind);
      showToast('Comentário registrado.', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao comentar.', 'err');
      throw err;
    } finally {
      setBusyAction(null);
    }
  };

  const handleReaction = async (type: InboxReactionType) => {
    if (!selectedMessage) return;
    if (type === 'disagree') {
      const alreadyDisagreed = reactions.some(
        (r) => r.userId === currentUid && r.type === 'disagree',
      );
      if (!alreadyDisagreed) {
        setDecisionPrompt({
          kind: 'disagree_reaction',
          label: 'Registrar discordância',
          requireReason: true,
        });
        setDecisionReason('');
        return;
      }
    }
    setBusyAction(`react_${type}`);
    try {
      await toggleInboxReaction(selectedMessage.id, type);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao reagir.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDecisionConfirm = async () => {
    if (!selectedMessage || !decisionPrompt) return;
    const trimmed = decisionReason.trim();
    if (decisionPrompt.requireReason && trimmed.length < 3) {
      showToast('Informe uma justificativa com pelo menos 3 caracteres.', 'err');
      return;
    }
    setBusyAction('decision');
    try {
      if (decisionPrompt.kind === 'disagree_reaction') {
        await toggleInboxReaction(selectedMessage.id, 'disagree', trimmed);
        showToast('Discordância registrada com justificativa.', 'ok');
      } else {
        await decideInboxMessage(selectedMessage.id, decisionPrompt.kind, trimmed || undefined);
        showToast('Decisão registrada na trilha de auditoria.', 'ok');
      }
      setDecisionPrompt(null);
      setDecisionReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao registrar decisão.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleStatusPatch = async (
    patch: Parameters<typeof updateInboxMessageStatus>[0],
    toastMsg?: string,
  ) => {
    setBusyAction('status');
    try {
      await updateInboxMessageStatus(patch);
      if (toastMsg) showToast(toastMsg, 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar status.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAttachFileToSelected = async (file: File) => {
    if (!selectedMessage) return;
    const validation = validateInboxAttachment({ fileName: file.name, mimeType: file.type, size: file.size });
    if (!validation.valid) {
      showToast(validation.reason || 'Arquivo inválido.', 'err');
      return;
    }
    setUploadProgress(0);
    const handle = uploadInboxAttachment(selectedMessage.id, file, (pct) => setUploadProgress(pct));
    try {
      await handle.promise;
      showToast(`Anexo "${file.name}" enviado com segurança.`, 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha no upload do anexo.', 'err');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleOpenAttachment = async (att: InboxAttachment, preview = false) => {
    if (!selectedMessage) return;
    setBusyAction(`att_${att.id}`);
    try {
      const { url } = await getInboxAttachmentDownloadUrl(selectedMessage.id, att.id);
      if (preview && (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf')) {
        setPreviewAttachment({ attachment: att, url });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao gerar link seguro.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleNavigateEntity = (entity: InboxEntityReference) => {
    const reqPerm = resolveEntityRoute(entity.type, entity.id);
    if (!reqPerm) return;
    navigate(reqPerm);
  };

  const handleToggleChecklistItem = async (task: InboxTask, itemId: string) => {
    if (!canEdit) return;
    const updated = task.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    const allDone = updated.length > 0 && updated.every((c) => c.done);
    try {
      await updateInboxTask({
        taskId: task.id,
        messageId: task.messageId,
        checklist: updated,
        status: allDone ? 'done' : task.status === 'open' ? 'in_progress' : task.status,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar checklist.', 'err');
    }
  };

  return (
    <div className="space-y-4">
      {/* Apple-style Top Header */}
      <PageHeader
        title="Inbox ADM"
        badge="Sócios & Agentes"
        subtitle="Caixa administrativa compartilhada entre os sócios, fórum de decisões, tarefas e comunicados de funcionários sistêmicos."
        actions={
          <div className="flex items-center gap-2">
            {isOffline && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/30">
                <WifiOff size={13} /> Offline
              </span>
            )}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'inbox' ? 'agents' : 'inbox')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                viewMode === 'agents'
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 font-semibold'
                  : 'bg-slate-800/70 hover:bg-slate-750 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <Settings size={13} />
              {viewMode === 'agents' ? 'Voltar para Caixa' : 'Funcionários Sistêmicos (11)'}
            </button>
            {canAdminAgents && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleRunAgents()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/70 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 disabled:opacity-50 transition-colors"
              >
                {busyAction === 'run_all' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Executar Agentes
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-sm transition-colors"
              >
                <Plus size={14} />
                Nova Mensagem
              </button>
            )}
          </div>
        }
      />

      {syncError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle size={15} />
          <span>{syncError}</span>
        </div>
      )}

      {/* Operational Summary Bar (KPIs with click-to-filter) */}
      <InboxSummaryBar
        kpis={kpis}
        activeFilter={quickFilter}
        onSelectFilter={(f) => setQuickFilter(f)}
      />

      {viewMode === 'agents' ? (
        <InboxAgentRulesView
          rules={agentRules}
          partners={partners}
          canAdmin={canAdminAgents}
          busyAction={busyAction}
          onRunAgent={handleRunAgents}
          onShowToast={showToast}
        />
      ) : (
        <>
          {/* Apple Mail Toolbar (Search + Collapsible Filters + Folder Navigation) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm backdrop-blur-sm">
            {/* Search Input & Advanced Filters Toggle */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mensagens, remetente, setor, assunto ou entidade..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-700/80 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  aria-expanded={showAdvancedFilters}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    showAdvancedFilters || activeAdvancedFilterCount > 0
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Filter size={13} />
                  <span>Filtros avançados</span>
                  {activeAdvancedFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {activeAdvancedFilterCount}
                    </span>
                  )}
                  {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {activeAdvancedFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAdvancedFilters}
                    className="p-2 rounded-xl border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800/70"
                    title="Limpar filtros avançados"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Advanced Filters Section (Minimized by default) */}
            {showAdvancedFilters && (
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-150 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Funcionário Sistêmico
                  </label>
                  <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    aria-label="Filtrar por agente"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Todos os agentes</option>
                    {SYSTEM_AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.sector})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Setor do Mercado
                  </label>
                  <select
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value)}
                    aria-label="Filtrar por setor"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Todos os setores</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    aria-label="Filtrar por prioridade"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Todas as prioridades</option>
                    <option value="critical">Crítica</option>
                    <option value="important">Importante</option>
                    <option value="attention">Atenção</option>
                    <option value="informative">Informativa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Período
                  </label>
                  <select
                    value={periodFilter}
                    onChange={(e) => {
                      setPeriodFilter(e.target.value as 'all' | '24h' | '7d' | '30d');
                      setPeriodRefMs(Date.now());
                    }}
                    aria-label="Filtrar por período"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Todo o histórico</option>
                    <option value="24h">Últimas 24 horas</option>
                    <option value="7d">Últimos 7 dias</option>
                    <option value="30d">Últimos 30 dias</option>
                  </select>
                </div>
              </div>
            )}

            {/* Folder Navigation Tabs */}
            <InboxFolderNav
              activeFilter={quickFilter}
              onSelectFilter={(f) => setQuickFilter(f)}
              counts={folderCounts}
            />
          </div>

          {/* Master-Detail Split Pane (Apple Mail Layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Message List */}
            <div
              className={`lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm ${
                selectedMessage ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-800/40">
                <span className="font-semibold text-slate-200">
                  {filteredMessages.length} mensagem(ns)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <Users size={12} /> Visível aos sócios
                </span>
              </div>

              {loadingList ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
                  Carregando mensagens da Inbox...
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Inbox size={22} />}
                    title="Nenhuma mensagem nesta pasta"
                    description="Envie uma nova mensagem interna ou execute os agentes sistêmicos para gerar análises operacionais."
                  />
                </div>
              ) : (
                <div
                  role="listbox"
                  aria-label="Lista de mensagens da Inbox"
                  className="divide-y divide-slate-800/70 max-h-[72vh] overflow-y-auto"
                >
                  {filteredMessages.map((msg) => (
                    <InboxMessageItem
                      key={msg.id}
                      message={msg}
                      isSelected={msg.id === selectedMessageId}
                      isUnread={isUnreadByUser(msg, currentUid)}
                      currentUid={currentUid}
                      onSelect={() => setSelectedMessageId(msg.id)}
                    />
                  ))}
                </div>
              )}

              {messages.length >= limitCount && (
                <div className="p-3 border-t border-slate-800 text-center bg-slate-800/30">
                  <button
                    type="button"
                    onClick={() => setLimitCount((c) => c + 50)}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                  >
                    Carregar mais mensagens
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Reading Detail Pane */}
            <div
              className={`lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur-sm ${
                selectedMessage ? 'block' : 'hidden lg:block'
              }`}
            >
              {!selectedMessage ? (
                <div className="py-12">
                  <EmptyState
                    icon={<Inbox size={24} />}
                    title="Nenhuma mensagem selecionada"
                    description="Escolha uma mensagem na lista ao lado para ler o conteúdo, discutir com os sócios, registrar decisões ou converter em tarefa."
                  />
                </div>
              ) : (
                <InboxDetailPane
                  message={selectedMessage}
                  currentUid={currentUid}
                  partners={partners}
                  canEdit={canEdit}
                  canApprove={canApprove}
                  canArchive={canArchive}
                  canAdminAgents={canAdminAgents}
                  can={can}
                  comments={comments}
                  reactions={reactions}
                  history={history}
                  attachments={attachments}
                  tasks={tasks}
                  busyAction={busyAction}
                  uploadProgress={uploadProgress}
                  onBackMobile={() => setSelectedMessageId(null)}
                  onToggleRead={(unread) => markInboxMessageRead(selectedMessage.id, unread)}
                  onToggleStarred={(starred) =>
                    handleStatusPatch({ messageId: selectedMessage.id, starred })
                  }
                  onConfirmReceipt={() =>
                    handleStatusPatch(
                      { messageId: selectedMessage.id, confirmReceipt: true },
                      'Ciência confirmada com sucesso.',
                    )
                  }
                  onReaction={handleReaction}
                  onPromptDecision={(kind, label, requireReason) => {
                    setDecisionPrompt({ kind, label, requireReason });
                    setDecisionReason('');
                  }}
                  onOpenTaskModal={() => setTaskModalOpen(true)}
                  onUpdateStatus={handleStatusPatch}
                  onMuteSimilarAlerts={async (agentId, deduplicationKey) => {
                    try {
                      await muteSimilarInboxAlerts(agentId as SystemAgentId, deduplicationKey);
                      showToast('Alertas semelhantes silenciados.', 'ok');
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Erro ao silenciar.', 'err');
                    }
                  }}
                  onOpenAttachment={handleOpenAttachment}
                  onAttachFile={handleAttachFileToSelected}
                  onSendComment={handleSendComment}
                  onToggleChecklist={handleToggleChecklistItem}
                  onNavigateEntity={handleNavigateEntity}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Compose Message Modal */}
      {composeOpen && (
        <InboxComposeModal
          partners={partners}
          products={products}
          orders={orders}
          clients={clients}
          tickets={tickets}
          onClose={() => setComposeOpen(false)}
          onCreated={(messageId) => {
            setComposeOpen(false);
            setSelectedMessageId(messageId);
            showToast('Mensagem enviada com sucesso.', 'ok');
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {/* Convert to Task Modal */}
      {taskModalOpen && selectedMessage && (
        <InboxTaskModal
          message={selectedMessage}
          partners={partners}
          onClose={() => setTaskModalOpen(false)}
          onCreated={() => {
            setTaskModalOpen(false);
            showToast('Tarefa operacional criada com sucesso.', 'ok');
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {/* Decision / Disagreement Justification Prompt Modal */}
      {decisionPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-3.5 shadow-2xl">
            <h3 id="decision-modal-title" className="text-sm font-bold text-slate-100">
              {decisionPrompt.label}
            </h3>
            <p className="text-xs text-slate-400">
              {decisionPrompt.requireReason
                ? 'Informe obrigatoriamente a justificativa para registro na auditoria:'
                : 'Você pode registrar uma observação opcional para registro na auditoria:'}
            </p>
            <textarea
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              rows={3}
              placeholder={
                decisionPrompt.requireReason
                  ? 'Justificativa obrigatória...'
                  : 'Observação opcional...'
              }
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDecisionPrompt(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction === 'decision'}
                onClick={handleDecisionConfirm}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <InboxAttachmentPreviewModal
          attachment={previewAttachment.attachment}
          url={previewAttachment.url}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
};
