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
import { SYSTEM_AGENTS, SYSTEM_AGENTS_BY_ID } from '../inbox/agents';
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

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (agentFilter !== 'all') {
      const ag = SYSTEM_AGENTS_BY_ID[agentFilter as SystemAgentId];
      parts.push(`Agente: ${ag ? ag.name : agentFilter}`);
    }
    if (sectorFilter !== 'all') parts.push(`Setor: ${sectorFilter}`);
    if (priorityFilter !== 'all') {
      const pLabels: Record<string, string> = {
        critical: 'Crítica',
        important: 'Importante',
        attention: 'Atenção',
        informative: 'Informativa',
      };
      parts.push(`Prioridade: ${pLabels[priorityFilter] || priorityFilter}`);
    }
    if (periodFilter !== 'all') {
      const dLabels: Record<string, string> = {
        '24h': 'Últimas 24h',
        '7d': 'Últimos 7 dias',
        '30d': 'Últimos 30 dias',
      };
      parts.push(dLabels[periodFilter] || periodFilter);
    }
    return parts.join(' · ');
  }, [agentFilter, sectorFilter, priorityFilter, periodFilter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (decisionPrompt) setDecisionPrompt(null);
        else if (showAdvancedFilters) setShowAdvancedFilters(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [decisionPrompt, showAdvancedFilters]);

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
    <div className="inbox-light-shell p-4 sm:p-5 border border-[#e3e7ec] shadow-sm space-y-4">
      {/* Email Client Top Header (Clean & Horizontal) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#e3e7ec]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#e8f4ee] border border-[#b9ddc8] text-[#167a52] flex items-center justify-center shrink-0">
            <Inbox size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-[#17202a] tracking-tight leading-none">
                Inbox ADM
              </h1>
              {kpis.unread > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eef5ff] text-[#1d4ed8] border border-[#bfdbfe] tabular-nums">
                  {kpis.unread} não lida{kpis.unread > 1 ? 's' : ''}
                </span>
              )}
              {isOffline && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
                  <WifiOff size={12} /> Offline
                </span>
              )}
            </div>
            <p className="text-xs text-[#5b6573] mt-1 truncate">
              Caixa compartilhada dos sócios & funcionários sistêmicos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'inbox' ? 'agents' : 'inbox')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              viewMode === 'agents'
                ? 'bg-[#eef5ff] text-[#1d4ed8] border-[#bfdbfe] font-semibold'
                : 'bg-white hover:bg-[#f1f4f7] text-[#17202a] border-[#e3e7ec]'
            }`}
          >
            <Settings size={14} />
            {viewMode === 'agents' ? 'Voltar para Caixa' : 'Agentes (11)'}
          </button>

          {canAdminAgents && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleRunAgents()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white hover:bg-[#f1f4f7] text-[#17202a] border border-[#e3e7ec] disabled:opacity-50 transition-colors"
            >
              {busyAction === 'run_all' ? (
                <Loader2 size={14} className="animate-spin text-[#167a52]" />
              ) : (
                <RefreshCw size={14} className="text-[#5b6573]" />
              )}
              Executar agentes
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#167a52] hover:bg-[#106441] text-white shadow-2xs transition-colors"
            >
              <Plus size={14} />
              Nova mensagem
            </button>
          )}
        </div>
      </header>

      {syncError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#c2414b] text-xs flex items-center gap-2"
        >
          <AlertTriangle size={15} className="shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Compact Operational Summary Strip (Secondary to Mail List) */}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Desktop Mail Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 xl:col-span-2 sticky top-20">
            <InboxFolderNav
              variant="sidebar"
              activeFilter={quickFilter}
              onSelectFilter={(f) => setQuickFilter(f)}
              counts={folderCounts}
            />
          </aside>

          {/* Main Mail Workspace */}
          <div className="lg:col-span-9 xl:col-span-10 space-y-3 min-w-0">
            {/* Search & Collapsible Advanced Filters Toolbar */}
            <div className="bg-white border border-[#e3e7ec] rounded-xl p-3 space-y-2.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#838e9b]"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar mensagens, remetente, setor, assunto ou entidade..."
                    aria-label="Buscar na Inbox ADM"
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a] placeholder:text-[#838e9b] focus:bg-white focus:outline-none focus:border-[#2563eb]"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    aria-expanded={showAdvancedFilters}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      showAdvancedFilters || activeAdvancedFilterCount > 0
                        ? 'bg-[#eef5ff] text-[#1d4ed8] border-[#bfdbfe]'
                        : 'bg-white text-[#5b6573] border-[#e3e7ec] hover:text-[#17202a] hover:bg-[#f1f4f7]'
                    }`}
                  >
                    <Filter size={13} />
                    <span>Filtros</span>
                    {activeAdvancedFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#2563eb] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {activeAdvancedFilterCount}
                      </span>
                    )}
                    {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {activeAdvancedFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAdvancedFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#e3e7ec] bg-white text-xs font-medium text-[#5b6573] hover:text-[#17202a] hover:bg-[#f1f4f7]"
                      title="Limpar filtros avançados"
                    >
                      <X size={13} />
                      <span>Limpar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filters Summary when panel is collapsed */}
              {!showAdvancedFilters && activeAdvancedFilterCount > 0 && (
                <div className="text-[11px] text-[#5b6573] bg-[#f6f7f9] px-3 py-1.5 rounded-lg border border-[#e3e7ec]">
                  <strong className="text-[#17202a]">
                    {activeAdvancedFilterCount} filtro{activeAdvancedFilterCount > 1 ? 's' : ''} ativo{activeAdvancedFilterCount > 1 ? 's' : ''}
                  </strong>{' '}
                  — {activeFilterSummary}
                </div>
              )}

              {/* Collapsible Advanced Filters Panel (Minimized by default) */}
              {showAdvancedFilters && (
                <div className="pt-2.5 border-t border-[#e3e7ec] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
                      Funcionário Sistêmico
                    </label>
                    <select
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      aria-label="Filtrar por agente"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a]"
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
                    <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
                      Setor do Mercado
                    </label>
                    <select
                      value={sectorFilter}
                      onChange={(e) => setSectorFilter(e.target.value)}
                      aria-label="Filtrar por setor"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a]"
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
                    <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
                      Prioridade
                    </label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      aria-label="Filtrar por prioridade"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a]"
                    >
                      <option value="all">Todas as prioridades</option>
                      <option value="critical">Crítica</option>
                      <option value="important">Importante</option>
                      <option value="attention">Atenção</option>
                      <option value="informative">Informativa</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
                      Período
                    </label>
                    <select
                      value={periodFilter}
                      onChange={(e) => {
                        setPeriodFilter(e.target.value as 'all' | '24h' | '7d' | '30d');
                        setPeriodRefMs(Date.now());
                      }}
                      aria-label="Filtrar por período"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#f6f7f9] border border-[#e3e7ec] text-xs text-[#17202a]"
                    >
                      <option value="all">Todo o histórico</option>
                      <option value="24h">Últimas 24 horas</option>
                      <option value="7d">Últimos 7 dias</option>
                      <option value="30d">Últimos 30 dias</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Mobile/Tablet Horizontal Folder Tabs */}
              <div className="lg:hidden pt-1">
                <InboxFolderNav
                  variant="tabs"
                  activeFilter={quickFilter}
                  onSelectFilter={(f) => setQuickFilter(f)}
                  counts={folderCounts}
                />
              </div>
            </div>

            {/* Master-Detail Split Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column: Email List */}
              <div
                className={`lg:col-span-5 bg-white border border-[#e3e7ec] rounded-xl overflow-hidden shadow-2xs ${
                  selectedMessage ? 'hidden lg:block' : 'block'
                }`}
              >
                <div className="px-4 py-2.5 border-b border-[#e3e7ec] flex items-center justify-between text-xs bg-[#fbfcfd]">
                  <span className="font-semibold text-[#17202a]">
                    {filteredMessages.length} mensagem(ns)
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#167a52] font-medium">
                    <Users size={12} /> Visível aos sócios
                  </span>
                </div>

                {loadingList ? (
                  <div className="p-10 text-center text-xs text-[#5b6573]" aria-live="polite">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2 text-[#167a52]" />
                    Carregando mensagens da Inbox...
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-11 h-11 rounded-full bg-[#f6f7f9] border border-[#e3e7ec] text-[#838e9b] flex items-center justify-center mx-auto">
                      <Inbox size={20} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-[#17202a]">
                        {messages.length === 0
                          ? 'Sua caixa de entrada está vazia'
                          : 'Nenhuma mensagem encontrada'}
                      </h3>
                      <p className="text-xs text-[#5b6573] max-w-xs mx-auto leading-relaxed">
                        {messages.length === 0
                          ? 'Envie uma nova mensagem entre os sócios ou execute os agentes sistêmicos para iniciar as comunicações.'
                          : 'Os filtros aplicados não retornaram resultados nesta pasta.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {messages.length > 0 && (activeAdvancedFilterCount > 0 || quickFilter !== 'all' || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickFilter('all');
                            setSearchQuery('');
                            handleClearAdvancedFilters();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#e3e7ec] text-[#17202a] hover:bg-[#f1f4f7]"
                        >
                          Limpar filtros
                        </button>
                      )}
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => setComposeOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#167a52] hover:bg-[#106441] text-white"
                        >
                          <Plus size={13} /> Nova mensagem
                        </button>
                      )}
                      {canAdminAgents && (
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => handleRunAgents()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#e3e7ec] text-[#17202a] hover:bg-[#f1f4f7]"
                        >
                          <RefreshCw size={13} /> Executar agentes
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    role="listbox"
                    aria-label="Lista de mensagens da Inbox"
                    className="max-h-[72vh] overflow-y-auto"
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
                  <div className="p-3 border-t border-[#e3e7ec] text-center bg-[#fbfcfd]">
                    <button
                      type="button"
                      onClick={() => setLimitCount((c) => c + 50)}
                      className="text-xs font-semibold text-[#2563eb] hover:underline"
                    >
                      Carregar mais mensagens
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Email Reading Detail Pane */}
              <div
                className={`lg:col-span-7 bg-white border border-[#e3e7ec] rounded-xl p-5 sm:p-6 shadow-2xs ${
                  selectedMessage ? 'block' : 'hidden lg:block'
                }`}
              >
                {!selectedMessage ? (
                  <div className="py-16 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-[#f6f7f9] border border-[#e3e7ec] text-[#838e9b] flex items-center justify-center mx-auto">
                      <Inbox size={22} />
                    </div>
                    <h3 className="text-sm font-semibold text-[#17202a]">
                      Nenhuma mensagem selecionada
                    </h3>
                    <p className="text-xs text-[#5b6573] max-w-sm mx-auto leading-relaxed">
                      Selecione um e-mail na lista à esquerda para ler o conteúdo completo, registrar decisões, comentar ou converter em tarefa.
                    </p>
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
          </div>
        </div>
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
          className="fixed inset-0 z-50 bg-[#17202a]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#e3e7ec] rounded-2xl max-w-md w-full p-6 space-y-3.5 shadow-2xl text-[#17202a]">
            <h3 id="decision-modal-title" className="text-sm font-bold text-[#17202a]">
              {decisionPrompt.label}
            </h3>
            <p className="text-xs text-[#5b6573]">
              {decisionPrompt.requireReason
                ? 'Informe obrigatoriamente a justificativa para registro na auditoria:'
                : 'Você pode registrar uma observação opcional para registro na auditoria:'}
            </p>
            <textarea
              autoFocus
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              rows={3}
              placeholder={
                decisionPrompt.requireReason
                  ? 'Justificativa obrigatória...'
                  : 'Observação opcional...'
              }
              className="w-full p-3 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a] placeholder:text-[#838e9b]"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDecisionPrompt(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium border border-[#e3e7ec] bg-white text-[#5b6573] hover:text-[#17202a] hover:bg-[#f1f4f7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction === 'decision'}
                onClick={handleDecisionConfirm}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white ${
                  decisionPrompt.kind === 'rejected' || decisionPrompt.kind === 'disagree_reaction'
                    ? 'bg-[#c2414b] hover:bg-[#a6343d]'
                    : 'bg-[#167a52] hover:bg-[#106441]'
                }`}
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
