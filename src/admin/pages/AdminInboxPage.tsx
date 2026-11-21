import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BellOff,
  Bot,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flame,
  History,
  Inbox,
  Link2,
  Loader2,
  Lock,
  MailOpen,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Users,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData } from '../AdminDataContext';
import { EmptyState, MetricCard, PageHeader, formatDateTime } from '../components/AdminUi';
import {
  INBOX_PRIORITY_META,
  INBOX_STATUS_LABELS,
  INBOX_TYPE_LABELS,
  SYSTEM_AGENTS,
  SYSTEM_AGENTS_BY_ID,
  buildDefaultAgentRule,
} from '../inbox/agents';
import {
  ENTITY_REQUIRED_PERMISSION,
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
  InboxEntityType,
  InboxHistoryEntry,
  InboxMessageType,
  InboxPriority,
  InboxReaction,
  InboxReactionType,
  InboxTask,
  PartnerAdminMember,
  SystemAgentId,
} from '../inbox/types';
import {
  addInboxComment,
  convertInboxMessageToTask,
  createInboxMessage,
  decideInboxMessage,
  getInboxAttachmentDownloadUrl,
  listInboxPartners,
  markInboxMessageRead,
  muteSimilarInboxAlerts,
  runInboxAgents,
  saveInboxAgentRule,
  subscribeAgentRules,
  subscribeInboxMessages,
  subscribeMessageAttachments,
  subscribeMessageComments,
  subscribeMessageHistory,
  subscribeMessageReactions,
  subscribeMessageTasks,
  testInboxAgentRule,
  toggleInboxReaction,
  updateInboxMessageStatus,
  updateInboxTask,
  uploadInboxAttachment,
} from '../../services/adminInboxService';

type QuickFilter =
  | 'all'
  | 'human'
  | 'system_agent'
  | 'unread'
  | 'critical'
  | 'important'
  | 'to_me'
  | 'to_all'
  | 'awaiting_my_reply'
  | 'awaiting_decision'
  | 'alert'
  | 'insight'
  | 'task_suggestion'
  | 'approved'
  | 'rejected'
  | 'resolved'
  | 'archived';

const QUICK_FILTERS: Array<{ id: QuickFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Não lidas' },
  { id: 'critical', label: 'Críticas' },
  { id: 'important', label: 'Importantes' },
  { id: 'human', label: 'Humanas' },
  { id: 'system_agent', label: 'Automáticas' },
  { id: 'to_me', label: 'Para mim' },
  { id: 'to_all', label: 'Para todos' },
  { id: 'awaiting_my_reply', label: 'Aguard. minha resposta' },
  { id: 'awaiting_decision', label: 'Aguard. decisão' },
  { id: 'alert', label: 'Alertas' },
  { id: 'insight', label: 'Insights' },
  { id: 'task_suggestion', label: 'Tarefas sugeridas' },
  { id: 'approved', label: 'Aprovadas' },
  { id: 'rejected', label: 'Rejeitadas' },
  { id: 'resolved', label: 'Resolvidas' },
  { id: 'archived', label: 'Arquivadas' },
];

const REACTION_BUTTONS: Array<{
  type: InboxReactionType;
  label: string;
  icon: React.ReactNode;
}> = [
  { type: 'like', label: 'Curtir', icon: <ThumbsUp size={13} /> },
  { type: 'agree', label: 'Concordo', icon: <Check size={13} /> },
  { type: 'disagree', label: 'Discordo', icon: <ThumbsDown size={13} /> },
  { type: 'attention', label: 'Atenção', icon: <AlertTriangle size={13} /> },
  { type: 'check', label: 'Ciente', icon: <CheckCheck size={13} /> },
];

const PRIORITY_BADGE_CLASSES: Record<InboxPriority, string> = {
  informative: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
  attention: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  important: 'bg-orange-500/15 text-orange-200 border-orange-500/30',
  critical: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
};

const SECTORS = Array.from(new Set(SYSTEM_AGENTS.map((a) => a.sector)));

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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
  const [commentText, setCommentText] = useState('');
  const [commentKind, setCommentKind] = useState<'comment' | 'forward' | 'request_info'>('comment');
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      if (quickFilter === 'important' && !m.importantBy[currentUid] && m.priority !== 'important')
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

  const partnerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of partners) map[p.uid] = p.name;
    return map;
  }, [partners]);

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

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage || !commentText.trim()) return;
    setBusyAction('comment');
    try {
      await addInboxComment(selectedMessage.id, commentText.trim(), commentKind);
      setCommentText('');
      showToast('Comentário registrado.', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao comentar.', 'err');
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

  const handleAttachFileToSelected = async (file: File | undefined) => {
    if (!file || !selectedMessage) return;
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    const reqPerm = ENTITY_REQUIRED_PERMISSION[entity.type];
    if (reqPerm && !can(reqPerm)) {
      showToast(`Sem permissão (${reqPerm}) para abrir este item.`, 'err');
      return;
    }
    const route = entity.route || resolveEntityRoute(entity.type, entity.id);
    navigate(route);
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
    <div className="space-y-5">
      <PageHeader
        title="Inbox ADM"
        badge="Sócios & Agentes"
        subtitle="Caixa administrativa compartilhada entre os sócios, fórum de decisões, tarefas e comunicados de funcionários sistêmicos."
        actions={
          <>
            {isOffline && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/30">
                <WifiOff size={14} /> Offline
              </span>
            )}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'inbox' ? 'agents' : 'inbox')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                viewMode === 'agents'
                  ? 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border-[var(--adm-gold-border)]'
                  : 'bg-[var(--adm-surface)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border-[var(--adm-border)]'
              }`}
            >
              <Settings size={14} />
              {viewMode === 'agents' ? 'Voltar para Caixa' : 'Config. Agentes (11)'}
            </button>
            {canAdminAgents && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleRunAgents()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--adm-surface)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text)] border border-[var(--adm-border)] disabled:opacity-50"
              >
                {busyAction === 'run_all' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Executar Agentes
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[var(--adm-gold)] text-[#09120e] hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                Nova Mensagem
              </button>
            )}
          </>
        }
      />

      {syncError && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle size={15} />
          <span>{syncError}</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Não Lidas"
          value={kpis.unread}
          subtitle="Para sua leitura"
          icon={<MailOpen size={17} />}
          tone="sky"
        />
        <MetricCard
          label="Críticas Abertas"
          value={kpis.critical}
          subtitle="Prioridade máxima"
          icon={<Flame size={17} />}
          tone="rose"
        />
        <MetricCard
          label="Aguardando Sua Resposta"
          value={kpis.awaitingReply}
          subtitle="Direcionadas a você"
          icon={<UserCheck size={17} />}
          tone="amber"
        />
        <MetricCard
          label="Aguardando Decisão"
          value={kpis.awaitingDecision}
          subtitle="Aprovações & sugestões"
          icon={<ShieldAlert size={17} />}
          tone="indigo"
        />
      </div>

      {viewMode === 'agents' ? (
        <AgentRulesPanel
          rules={agentRules}
          partners={partners}
          canAdmin={canAdminAgents}
          busyAction={busyAction}
          onRunAgent={handleRunAgents}
          onShowToast={showToast}
        />
      ) : (
        <>
          {/* Search + Advanced Filters */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-3.5 space-y-3">
            <div className="flex flex-col lg:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-dim)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por assunto, texto, remetente, setor ou entidade vinculada..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)] placeholder:text-[var(--adm-text-dim)] focus:outline-none focus:border-[var(--adm-gold-border)]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  aria-label="Filtrar por agente"
                  className="px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="all">Todos os agentes</option>
                  {SYSTEM_AGENTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.sector})
                    </option>
                  ))}
                </select>
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  aria-label="Filtrar por setor"
                  className="px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="all">Todos os setores</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  aria-label="Filtrar por prioridade"
                  className="px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="all">Todas prioridades</option>
                  <option value="critical">Crítica</option>
                  <option value="important">Importante</option>
                  <option value="attention">Atenção</option>
                  <option value="informative">Informativa</option>
                </select>
                <select
                  value={periodFilter}
                  onChange={(e) => {
                    setPeriodFilter(e.target.value as 'all' | '24h' | '7d' | '30d');
                    setPeriodRefMs(Date.now());
                  }}
                  aria-label="Filtrar por período"
                  className="px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="all">Todo o período</option>
                  <option value="24h">Últimas 24h</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                </select>
              </div>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <Filter size={13} className="text-[var(--adm-text-dim)] shrink-0 mr-1" />
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQuickFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                    quickFilter === f.id
                      ? 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border-[var(--adm-gold-border)]'
                      : 'bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)] hover:text-[var(--adm-text)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Master-Detail Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Message List */}
            <div
              className={`lg:col-span-5 bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] overflow-hidden ${
                selectedMessage ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="px-3.5 py-2.5 border-b border-[var(--adm-border)] flex items-center justify-between text-xs text-[var(--adm-text-muted)]">
                <span className="font-semibold">
                  {filteredMessages.length} mensagem(ns)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                  <Users size={12} /> Visível a todos os sócios
                </span>
              </div>

              {loadingList ? (
                <div className="p-8 text-center text-xs text-[var(--adm-text-muted)]">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                  Carregando Inbox ADM...
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Inbox size={20} />}
                    title="Nenhuma mensagem neste filtro"
                    description="Envie uma nova mensagem entre sócios ou execute os agentes sistêmicos para gerar comunicados reais do mercado."
                  />
                </div>
              ) : (
                <div className="divide-y divide-[var(--adm-border)] max-h-[70vh] overflow-y-auto">
                  {filteredMessages.map((msg) => {
                    const unread = isUnreadByUser(msg, currentUid);
                    const isSelected = msg.id === selectedMessageId;
                    const agent = msg.agentId ? SYSTEM_AGENTS_BY_ID[msg.agentId] : undefined;
                    return (
                      <button
                        key={msg.id}
                        type="button"
                        onClick={() => setSelectedMessageId(msg.id)}
                        className={`w-full text-left p-3.5 transition-colors hover:bg-[var(--adm-surface-elevated)] ${
                          isSelected
                            ? 'bg-[var(--adm-surface-elevated)] border-l-2 border-l-[var(--adm-gold)]'
                            : unread
                            ? 'bg-emerald-500/[0.04]'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {msg.source === 'human' ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {msg.senderName.slice(0, 1).toUpperCase()}
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                                <Bot size={12} />
                              </span>
                            )}
                            <span className="text-xs font-semibold text-[var(--adm-text)] truncate">
                              {msg.senderName}
                            </span>
                            {agent && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/25 shrink-0">
                                {agent.sector}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--adm-text-dim)] shrink-0">
                            {formatDateTime(msg.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-1">
                          {unread && (
                            <span
                              className="w-2 h-2 rounded-full bg-[var(--adm-gold)] shrink-0"
                              title="Não lida"
                            />
                          )}
                          {msg.starredBy[currentUid] && (
                            <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                          )}
                          <p
                            className={`text-xs truncate ${
                              unread
                                ? 'font-bold text-[var(--adm-text)]'
                                : 'font-semibold text-[var(--adm-text-muted)]'
                            }`}
                          >
                            {msg.subject}
                          </p>
                        </div>

                        <p className="text-[11px] text-[var(--adm-text-dim)] line-clamp-2 mb-2">
                          {msg.body}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              PRIORITY_BADGE_CLASSES[msg.priority]
                            }`}
                          >
                            {INBOX_PRIORITY_META[msg.priority].label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]">
                            {INBOX_TYPE_LABELS[msg.type]}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]">
                            {INBOX_STATUS_LABELS[msg.status]}
                          </span>
                          {msg.commentCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--adm-text-dim)] ml-auto">
                              <MessageSquare size={10} /> {msg.commentCount}
                            </span>
                          )}
                          {msg.attachmentCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--adm-text-dim)]">
                              <Paperclip size={10} /> {msg.attachmentCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {messages.length >= limitCount && (
                <div className="p-2.5 border-t border-[var(--adm-border)] text-center">
                  <button
                    type="button"
                    onClick={() => setLimitCount((c) => c + 50)}
                    className="text-xs font-semibold text-[var(--adm-gold)] hover:underline"
                  >
                    Carregar mais mensagens
                  </button>
                </div>
              )}
            </div>

            {/* Detail Pane */}
            <div
              className={`lg:col-span-7 bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 sm:p-5 ${
                selectedMessage ? 'block' : 'hidden lg:block'
              }`}
            >
              {!selectedMessage ? (
                <EmptyState
                  icon={<Inbox size={22} />}
                  title="Selecione uma mensagem"
                  description="Escolha uma mensagem ou comunicado de agente sistêmico na lista ao lado para ler detalhes, comentar, reagir, decidir ou converter em tarefa."
                />
              ) : (
                <div className="space-y-4">
                  {/* Mobile back + header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--adm-border)]">
                    <div className="min-w-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => setSelectedMessageId(null)}
                        className="lg:hidden inline-flex items-center gap-1 text-xs font-semibold text-[var(--adm-gold)] mb-1"
                      >
                        <ArrowLeft size={14} /> Voltar à lista
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            PRIORITY_BADGE_CLASSES[selectedMessage.priority]
                          }`}
                        >
                          {INBOX_PRIORITY_META[selectedMessage.priority].label}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text-muted)]">
                          {INBOX_TYPE_LABELS[selectedMessage.type]}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]">
                          {INBOX_STATUS_LABELS[selectedMessage.status]}
                        </span>
                        {selectedMessage.occurrenceCount > 1 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/30">
                            {selectedMessage.occurrenceCount}x ocorrências
                          </span>
                        )}
                      </div>
                      <h2 className="text-base sm:text-lg font-extrabold text-[var(--adm-text)]">
                        {selectedMessage.subject}
                      </h2>
                      <p className="text-xs text-[var(--adm-text-muted)]">
                        De: <strong className="text-[var(--adm-text)]">{selectedMessage.senderName}</strong>
                        {selectedMessage.senderRole ? ` (${selectedMessage.senderRole})` : ''} •{' '}
                        {formatDateTime(selectedMessage.createdAt)}
                      </p>
                      <p className="text-[11px] text-[var(--adm-text-dim)] flex flex-wrap items-center gap-2">
                        <span>
                          Para:{' '}
                          {selectedMessage.toAll
                            ? 'Todos os sócios administradores'
                            : selectedMessage.toUserIds
                                .map((id) => partnerNameMap[id] || id)
                                .join(', ') || 'Sócios'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <Users size={11} /> Visível para todos os administradores
                        </span>
                      </p>
                    </div>

                    {/* Quick icon actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title={
                            isUnreadByUser(selectedMessage, currentUid)
                              ? 'Marcar como lida'
                              : 'Marcar como não lida'
                          }
                          onClick={() =>
                            markInboxMessageRead(
                              selectedMessage.id,
                              !isUnreadByUser(selectedMessage, currentUid),
                            )
                          }
                          className="p-1.5 rounded-lg border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)]"
                        >
                          <MailOpen size={14} />
                        </button>
                        <button
                          type="button"
                          title="Favoritar"
                          onClick={() =>
                            handleStatusPatch({
                              messageId: selectedMessage.id,
                              starred: !selectedMessage.starredBy[currentUid],
                            })
                          }
                          className="p-1.5 rounded-lg border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)] text-amber-300"
                        >
                          <Star
                            size={14}
                            className={
                              selectedMessage.starredBy[currentUid] ? 'fill-amber-400' : ''
                            }
                          />
                        </button>
                        <button
                          type="button"
                          title="Confirmar ciência"
                          onClick={() =>
                            handleStatusPatch(
                              { messageId: selectedMessage.id, confirmReceipt: true },
                              'Ciência confirmada.',
                            )
                          }
                          className="p-1.5 rounded-lg border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)] text-emerald-300"
                        >
                          <CheckCheck size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-3.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs sm:text-sm text-[var(--adm-text)] whitespace-pre-wrap leading-relaxed">
                    {selectedMessage.body}
                  </div>

                  {/* Insight Breakdown (for systemic insights/alerts) */}
                  {selectedMessage.insightDetails && (
                    <div className="p-3.5 rounded-lg bg-teal-500/[0.06] border border-teal-500/25 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-200 inline-flex items-center gap-1.5">
                          <Sparkles size={14} /> Análise do Funcionário Sistêmico
                        </span>
                        {selectedMessage.insightDetails.confidence && (
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-200">
                            Confiança: {selectedMessage.insightDetails.confidence}
                          </span>
                        )}
                      </div>
                      <p>
                        <strong className="text-[var(--adm-text)]">Fato observado:</strong>{' '}
                        <span className="text-[var(--adm-text-muted)]">
                          {selectedMessage.insightDetails.observedFact}
                        </span>
                      </p>
                      <p>
                        <strong className="text-[var(--adm-text)]">Dados reais usados:</strong>{' '}
                        <span className="text-[var(--adm-text-muted)]">
                          {selectedMessage.insightDetails.dataUsed}
                        </span>
                      </p>
                      <p>
                        <strong className="text-[var(--adm-text)]">Interpretação:</strong>{' '}
                        <span className="text-[var(--adm-text-muted)]">
                          {selectedMessage.insightDetails.interpretation}
                        </span>
                      </p>
                      <p>
                        <strong className="text-[var(--adm-text)]">Sugestão de ação:</strong>{' '}
                        <span className="text-emerald-200">
                          {selectedMessage.insightDetails.suggestion}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Assignment / Due Date / Routing controls */}
                  {canEdit && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--adm-text-dim)] mb-1">
                          Responsável
                        </label>
                        <select
                          value={selectedMessage.assignedToUserId ?? ''}
                          onChange={(e) =>
                            handleStatusPatch(
                              {
                                messageId: selectedMessage.id,
                                assignedToUserId: e.target.value || null,
                              },
                              'Responsável atualizado.',
                            )
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        >
                          <option value="">Sem responsável</option>
                          {partners.map((p) => (
                            <option key={p.uid} value={p.uid}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--adm-text-dim)] mb-1">
                          Aguardando resposta de
                        </label>
                        <select
                          value={selectedMessage.requestedResponseFromUserId ?? ''}
                          onChange={(e) =>
                            handleStatusPatch(
                              {
                                messageId: selectedMessage.id,
                                requestedResponseFromUserId: e.target.value || null,
                              },
                              'Solicitação de resposta atualizada.',
                            )
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        >
                          <option value="">Ninguém específico</option>
                          {partners.map((p) => (
                            <option key={p.uid} value={p.uid}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--adm-text-dim)] mb-1">
                          Prioridade
                        </label>
                        <select
                          value={selectedMessage.priority}
                          onChange={(e) =>
                            handleStatusPatch(
                              {
                                messageId: selectedMessage.id,
                                priority: e.target.value as InboxPriority,
                              },
                              'Prioridade atualizada.',
                            )
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        >
                          <option value="informative">Informativa</option>
                          <option value="attention">Atenção</option>
                          <option value="important">Importante</option>
                          <option value="critical">Crítica</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Related Entities */}
                  {selectedMessage.relatedEntities.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase text-[var(--adm-text-dim)] inline-flex items-center gap-1">
                        <Link2 size={12} /> Referências no sistema
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMessage.relatedEntities.map((ent, idx) => {
                          const perm = ENTITY_REQUIRED_PERMISSION[ent.type];
                          const allowed = !perm || can(perm);
                          return (
                            <button
                              key={`${ent.type}_${ent.id}_${idx}`}
                              type="button"
                              onClick={() => handleNavigateEntity(ent)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                                allowed
                                  ? 'bg-[var(--adm-bg)] hover:border-[var(--adm-gold-border)] text-[var(--adm-text)] border-[var(--adm-border)]'
                                  : 'bg-[var(--adm-bg)] text-[var(--adm-text-dim)] border-[var(--adm-border)] opacity-70'
                              }`}
                            >
                              {allowed ? <ExternalLink size={12} /> : <Lock size={12} />}
                              <span>{ent.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Decision & Action Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {canApprove && !selectedMessage.decision && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setDecisionPrompt({
                              kind: 'approved',
                              label: 'Aprovar mensagem/proposta',
                              requireReason: false,
                            });
                            setDecisionReason('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30"
                        >
                          <CheckCircle2 size={14} /> Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDecisionPrompt({
                              kind: 'rejected',
                              label: 'Rejeitar proposta',
                              requireReason: true,
                            });
                            setDecisionReason('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30"
                        >
                          <XCircle size={14} /> Rejeitar
                        </button>
                      </>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setTaskModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--adm-bg)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text)] border border-[var(--adm-border)]"
                      >
                        <ClipboardList size={14} /> Converter em Tarefa
                      </button>
                    )}

                    {canEdit && selectedMessage.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusPatch(
                            { messageId: selectedMessage.id, status: 'resolved' },
                            'Mensagem marcada como resolvida.',
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--adm-bg)] hover:bg-[var(--adm-surface-elevated)] text-emerald-200 border border-[var(--adm-border)]"
                      >
                        <Check size={14} /> Resolver
                      </button>
                    )}

                    {canArchive && selectedMessage.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusPatch(
                            { messageId: selectedMessage.id, status: 'archived' },
                            'Mensagem arquivada.',
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--adm-bg)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]"
                      >
                        <Archive size={14} /> Arquivar
                      </button>
                    )}

                    {canAdminAgents &&
                      selectedMessage.agentId &&
                      selectedMessage.deduplicationKey && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await muteSimilarInboxAlerts(
                                selectedMessage.agentId!,
                                selectedMessage.deduplicationKey!,
                              );
                              showToast('Alertas semelhantes silenciados para este agente.', 'ok');
                            } catch (err) {
                              showToast(
                                err instanceof Error ? err.message : 'Erro ao silenciar.',
                                'err',
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--adm-bg)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]"
                        >
                          <BellOff size={14} /> Silenciar semelhantes
                        </button>
                      )}
                  </div>

                  {selectedMessage.decision && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs">
                      <span className="font-bold text-emerald-200">
                        Decisão: {selectedMessage.decision.outcome.toUpperCase()}
                      </span>{' '}
                      por {selectedMessage.decision.decidedByName || selectedMessage.decision.decidedBy} em{' '}
                      {formatDateTime(selectedMessage.decision.decidedAt)}
                      {selectedMessage.decision.justification && (
                        <p className="text-[var(--adm-text-muted)] mt-1">
                          Justificativa: {selectedMessage.decision.justification}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reactions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {REACTION_BUTTONS.map((btn) => {
                      const count = selectedMessage.reactionCounts[btn.type] ?? 0;
                      const mine = reactions.some(
                        (r) => r.userId === currentUid && r.type === btn.type,
                      );
                      return (
                        <button
                          key={btn.type}
                          type="button"
                          onClick={() => handleReaction(btn.type)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            mine
                              ? 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border-[var(--adm-gold-border)]'
                              : 'bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)] hover:text-[var(--adm-text)]'
                          }`}
                        >
                          {btn.icon}
                          <span>{btn.label}</span>
                          {count > 0 && <span className="font-bold">({count})</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tasks linked */}
                  {tasks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[var(--adm-border)]">
                      <h3 className="text-xs font-bold uppercase text-[var(--adm-text-dim)] flex items-center gap-1.5">
                        <ClipboardList size={13} /> Tarefas Vinculadas ({tasks.length})
                      </h3>
                      {tasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[var(--adm-text)]">
                              {t.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text-muted)]">
                              {t.status}
                            </span>
                          </div>
                          {t.assignedToName && (
                            <p className="text-[11px] text-[var(--adm-text-muted)]">
                              Responsável: {t.assignedToName}
                            </p>
                          )}
                          {t.checklist.length > 0 && (
                            <div className="space-y-1">
                              {t.checklist.map((item) => (
                                <label
                                  key={item.id}
                                  className="flex items-center gap-2 text-xs text-[var(--adm-text-muted)] cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.done}
                                    onChange={() => handleToggleChecklistItem(t, item.id)}
                                  />
                                  <span className={item.done ? 'line-through opacity-60' : ''}>
                                    {item.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attachments */}
                  <div className="space-y-2 pt-2 border-t border-[var(--adm-border)]">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase text-[var(--adm-text-dim)] flex items-center gap-1.5">
                        <Paperclip size={13} /> Anexos Privados ({attachments.length})
                      </h3>
                      {canEdit && (
                        <label className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--adm-gold)] cursor-pointer hover:underline">
                          <Plus size={13} /> Adicionar anexo
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx,.docx,.txt"
                            onChange={(e) => handleAttachFileToSelected(e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </div>
                    {uploadProgress !== null && (
                      <div className="text-[11px] text-[var(--adm-gold)]">
                        Enviando anexo... {uploadProgress}%
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)]"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[var(--adm-text)] truncate">
                                {att.originalName}
                              </p>
                              <p className="text-[10px] text-[var(--adm-text-dim)]">
                                {formatFileSize(att.size)} • {att.uploadedByName || 'Sócio'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {(att.mimeType.startsWith('image/') ||
                                att.mimeType === 'application/pdf') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAttachment(att, true)}
                                  title="Visualizar"
                                  className="p-1.5 rounded border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)]"
                                >
                                  <Eye size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenAttachment(att, false)}
                                title="Baixar"
                                className="p-1.5 rounded border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-gold)]"
                              >
                                <Download size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comments */}
                  <div className="space-y-2.5 pt-2 border-t border-[var(--adm-border)]">
                    <h3 className="text-xs font-bold uppercase text-[var(--adm-text-dim)] flex items-center gap-1.5">
                      <MessageSquare size={13} /> Discussão ({comments.length})
                    </h3>
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[var(--adm-text)]">{c.authorName}</span>
                          <span className="text-[var(--adm-text-dim)]">
                            {formatDateTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--adm-text-muted)] whitespace-pre-wrap">
                          {c.body}
                        </p>
                      </div>
                    ))}

                    {canEdit && (
                      <form onSubmit={handleSendComment} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={commentKind}
                            onChange={(e) =>
                              setCommentKind(
                                e.target.value as 'comment' | 'forward' | 'request_info',
                              )
                            }
                            className="px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                          >
                            <option value="comment">Comentário</option>
                            <option value="request_info">Pedir esclarecimento</option>
                            <option value="forward">Encaminhamento</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Escreva um comentário para os sócios..."
                            className="flex-1 px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                          />
                          <button
                            type="submit"
                            disabled={!commentText.trim() || busyAction === 'comment'}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--adm-gold)] text-[#09120e] disabled:opacity-50"
                          >
                            <Send size={13} /> Enviar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Immutable History */}
                  <div className="space-y-2 pt-2 border-t border-[var(--adm-border)]">
                    <h3 className="text-xs font-bold uppercase text-[var(--adm-text-dim)] flex items-center gap-1.5">
                      <History size={13} /> Histórico Imutável ({history.length})
                    </h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="text-[11px] text-[var(--adm-text-dim)] flex items-center justify-between gap-2 py-1 border-b border-[var(--adm-border)]/50 last:border-b-0"
                        >
                          <span>
                            <strong className="text-[var(--adm-text-muted)]">{h.actorName}</strong>{' '}
                            • {h.details || h.action}
                            {h.justification ? ` — "${h.justification}"` : ''}
                          </span>
                          <span className="shrink-0">{formatDateTime(h.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Compose New Human Message Modal */}
      {composeOpen && (
        <ComposeMessageModal
          partners={partners}
          products={products}
          orders={orders}
          clients={clients}
          tickets={tickets}
          onClose={() => setComposeOpen(false)}
          onCreated={(messageId) => {
            setComposeOpen(false);
            setSelectedMessageId(messageId);
            showToast('Mensagem enviada na Inbox ADM.', 'ok');
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {/* Decision / Disagreement Justification Modal */}
      {decisionPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-md w-full p-5 space-y-3">
            <h3 className="text-sm font-bold text-[var(--adm-text)]">{decisionPrompt.label}</h3>
            <textarea
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              rows={3}
              placeholder={
                decisionPrompt.requireReason
                  ? 'Justificativa obrigatória...'
                  : 'Observação opcional...'
              }
              className="w-full p-2.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecisionPrompt(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--adm-border)] text-[var(--adm-text-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction === 'decision'}
                onClick={handleDecisionConfirm}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--adm-gold)] text-[#09120e]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Task Modal */}
      {taskModalOpen && selectedMessage && (
        <ConvertTaskModal
          message={selectedMessage}
          partners={partners}
          onClose={() => setTaskModalOpen(false)}
          onCreated={() => {
            setTaskModalOpen(false);
            showToast('Tarefa criada e vinculada à mensagem.', 'ok');
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {/* Safe Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--adm-border)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--adm-text)] truncate">
                {previewAttachment.attachment.originalName}
              </span>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="p-1 rounded hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-black/40">
              {previewAttachment.attachment.mimeType.startsWith('image/') ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.attachment.originalName}
                  className="max-w-full max-h-[75vh] object-contain rounded"
                />
              ) : (
                <iframe
                  src={previewAttachment.url}
                  title={previewAttachment.attachment.originalName}
                  className="w-full h-[75vh] rounded border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Subcomponent: Compose Message Modal ──────────────────────────────────────

const ComposeMessageModal: React.FC<{
  partners: PartnerAdminMember[];
  products: Array<{ id: string; title?: string; name?: string }>;
  orders: Array<{ id: string; orderNumber?: string; customerName?: string }>;
  clients: Array<{ id: string; name: string }>;
  tickets: Array<{ id: string; ticketNumber?: string; subject: string }>;
  onClose: () => void;
  onCreated: (messageId: string) => void;
  onError: (msg: string) => void;
}> = ({ partners, products, orders, clients, tickets, onClose, onCreated, onError }) => {
  const [type, setType] = useState<InboxMessageType>('message');
  const [toAll, setToAll] = useState(true);
  const [toUserIds, setToUserIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<InboxPriority>('attention');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [requestedResponseFromUserId, setRequestedResponseFromUserId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [createTaskAlong, setCreateTaskAlong] = useState(false);
  const [relatedEntities, setRelatedEntities] = useState<InboxEntityReference[]>([]);
  const [entityType, setEntityType] = useState<InboxEntityType>('product');
  const [entityId, setEntityId] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const entityChoices = useMemo(() => {
    if (entityType === 'product') {
      return products.slice(0, 60).map((p) => ({ id: p.id, label: p.title || p.name || p.id }));
    }
    if (entityType === 'order') {
      return orders.slice(0, 60).map((o) => ({
        id: o.id,
        label: `Pedido #${o.orderNumber || o.id.slice(0, 6)} — ${o.customerName || 'Cliente'}`,
      }));
    }
    if (entityType === 'customer') {
      return clients.slice(0, 60).map((c) => ({ id: c.id, label: c.name }));
    }
    if (entityType === 'ticket') {
      return tickets.slice(0, 60).map((t) => ({
        id: t.id,
        label: `Ticket #${t.ticketNumber || t.id.slice(0, 6)} — ${t.subject}`,
      }));
    }
    return [];
  }, [entityType, products, orders, clients, tickets]);

  const handleAddEntity = () => {
    if (!entityId) return;
    const found = entityChoices.find((e) => e.id === entityId);
    if (!found) return;
    if (relatedEntities.some((e) => e.type === entityType && e.id === found.id)) return;
    setRelatedEntities((prev) => [
      ...prev,
      { type: entityType, id: found.id, label: found.label, route: resolveEntityRoute(entityType, found.id) },
    ]);
    setEntityId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      onError('Preencha o assunto e a mensagem.');
      return;
    }
    if (!toAll && toUserIds.length === 0) {
      onError('Selecione pelo menos um sócio ou marque Todos os sócios.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createInboxMessage({
        type,
        toAll,
        toUserIds: toAll ? partners.map((p) => p.uid) : toUserIds,
        subject: subject.trim(),
        body: body.trim(),
        priority,
        assignedToUserId: assignedToUserId || undefined,
        requestedResponseFromUserId: requestedResponseFromUserId || undefined,
        requestReply: Boolean(requestedResponseFromUserId),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        relatedEntities,
        createTaskAlong,
      });

      for (const file of pendingFiles) {
        await uploadInboxAttachment(res.messageId, file).promise;
      }

      onCreated(res.messageId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-2 border-b border-[var(--adm-border)]">
          <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
            Nova Mensagem Administrativa
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)]"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
          <Users size={13} /> Todos os sócios administradores visualizam todas as mensagens, mesmo quando direcionadas a um sócio específico.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InboxMessageType)}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="message">Mensagem</option>
              <option value="note">Aviso</option>
              <option value="decision">Decisão</option>
              <option value="incident">Incidente</option>
              <option value="announcement">Comunicado</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Prioridade
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as InboxPriority)}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="informative">Informativa</option>
              <option value="attention">Atenção</option>
              <option value="important">Importante</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-1.5 text-xs">
          <label className="flex items-center gap-2 font-semibold text-[var(--adm-text)]">
            <input
              type="checkbox"
              checked={toAll}
              onChange={(e) => setToAll(e.target.checked)}
            />
            Enviar para todos os sócios administradores
          </label>
          {!toAll && (
            <div className="flex flex-wrap gap-2 pt-1">
              {partners.map((p) => {
                const checked = toUserIds.includes(p.uid);
                return (
                  <label
                    key={p.uid}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer ${
                      checked
                        ? 'bg-[var(--adm-gold-soft)] border-[var(--adm-gold-border)] text-[var(--adm-gold)]'
                        : 'bg-[var(--adm-bg)] border-[var(--adm-border)] text-[var(--adm-text-muted)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setToUserIds((prev) =>
                          checked ? prev.filter((id) => id !== p.uid) : [...prev, p.uid],
                        )
                      }
                      className="hidden"
                    />
                    {p.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto claro da mensagem..."
          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Descreva o contexto, problema, decisão ou encaminhamento..."
          className="w-full p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Responsável
            </label>
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="">Opcional</option>
              {partners.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Solicitar resposta de
            </label>
            <select
              value={requestedResponseFromUserId}
              onChange={(e) => setRequestedResponseFromUserId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="">Ninguém específico</option>
              {partners.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
              Prazo
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            />
          </div>
        </div>

        {/* Entity Picker */}
        <div className="space-y-1.5 text-xs">
          <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)]">
            Vincular entidade do sistema (opcional)
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value as InboxEntityType);
                setEntityId('');
              }}
              className="px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="product">Produto</option>
              <option value="order">Pedido</option>
              <option value="customer">Cliente</option>
              <option value="ticket">Ticket</option>
            </select>
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="flex-1 min-w-[180px] px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            >
              <option value="">Selecione...</option>
              {entityChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddEntity}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--adm-border)] text-[var(--adm-gold)] font-semibold"
            >
              Vincular
            </button>
          </div>
          {relatedEntities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {relatedEntities.map((ent) => (
                <span
                  key={`${ent.type}_${ent.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[11px]"
                >
                  {ent.label}
                  <button
                    type="button"
                    onClick={() =>
                      setRelatedEntities((prev) =>
                        prev.filter((x) => !(x.type === ent.type && x.id === ent.id)),
                      )
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className="space-y-1.5 text-xs">
          <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)]">
            Anexos (JPG, PNG, WEBP, PDF, CSV, XLSX, DOCX, TXT — máx. 15 MB)
          </label>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx,.docx,.txt"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              const valid: File[] = [];
              for (const f of files) {
                const v = validateInboxAttachment({ fileName: f.name, mimeType: f.type, size: f.size });
                if (!v.valid) {
                  onError(v.reason || `Arquivo inválido: ${f.name}`);
                } else {
                  valid.push(f);
                }
              }
              setPendingFiles((prev) => [...prev, ...valid]);
            }}
            className="text-xs text-[var(--adm-text-muted)]"
          />
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <span
                  key={`${f.name}_${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[11px]"
                >
                  <FileText size={11} /> {f.name}
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--adm-text)]">
          <input
            type="checkbox"
            checked={createTaskAlong}
            onChange={(e) => setCreateTaskAlong(e.target.checked)}
          />
          Criar tarefa operacional vinculada automaticamente
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--adm-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--adm-border)] text-[var(--adm-text-muted)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[var(--adm-gold)] text-[#09120e] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar Mensagem
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Subcomponent: Convert to Task Modal ──────────────────────────────────────

const ConvertTaskModal: React.FC<{
  message: AdminInboxMessage;
  partners: PartnerAdminMember[];
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}> = ({ message, partners, onClose, onCreated, onError }) => {
  const [title, setTitle] = useState(
    message.suggestedTask?.title || `[Inbox] ${message.subject}`,
  );
  const [description, setDescription] = useState(
    message.suggestedTask?.description || message.body.slice(0, 600),
  );
  const [priority, setPriority] = useState<InboxPriority>(
    message.suggestedTask?.priority || message.priority,
  );
  const [assignedToUserId, setAssignedToUserId] = useState(
    message.assignedToUserId || message.suggestedTask?.suggestedAssigneeUid || '',
  );
  const [dueAt, setDueAt] = useState('');
  const [checklistText, setChecklistText] = useState(
    (message.suggestedTask?.checklist || []).join('\n'),
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onError('Informe o título da tarefa.');
      return;
    }
    setSubmitting(true);
    try {
      const partner = partners.find((p) => p.uid === assignedToUserId);
      const checklist = checklistText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label) => ({ label, done: false }));
      await convertInboxMessageToTask({
        messageId: message.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedToUserId: assignedToUserId || undefined,
        assignedToName: partner?.name,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        checklist,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao criar tarefa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-lg w-full p-5 space-y-3 text-xs"
      >
        <div className="flex items-center justify-between pb-2 border-b border-[var(--adm-border)]">
          <h3 className="text-sm font-bold text-[var(--adm-text)]">Converter em Tarefa</h3>
          <button type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da tarefa"
          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descrição / contexto"
          className="w-full p-2.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as InboxPriority)}
            className="px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
          >
            <option value="informative">Informativa</option>
            <option value="attention">Atenção</option>
            <option value="important">Importante</option>
            <option value="critical">Crítica</option>
          </select>
          <select
            value={assignedToUserId}
            onChange={(e) => setAssignedToUserId(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
          >
            <option value="">Sem responsável</option>
            {partners.map((p) => (
              <option key={p.uid} value={p.uid}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Calendar size={12} className="hidden" />
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--adm-text-muted)] mb-1">
            Checklist (um item por linha)
          </label>
          <textarea
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
            rows={3}
            placeholder="Ex: Conferir estoque físico&#10;Acionar fornecedor"
            className="w-full p-2.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[var(--adm-border)] text-[var(--adm-text-muted)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg font-bold bg-[var(--adm-gold)] text-[#09120e]"
          >
            {submitting ? 'Criando...' : 'Criar Tarefa'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Subcomponent: Systemic Agents Rules Panel ────────────────────────────────

const AgentRulesPanel: React.FC<{
  rules: Record<string, AgentRuleConfig>;
  partners: PartnerAdminMember[];
  canAdmin: boolean;
  busyAction: string | null;
  onRunAgent: (agentId: SystemAgentId) => void;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}> = ({ rules, partners, canAdmin, busyAction, onRunAgent, onShowToast }) => {
  const [drafts, setDrafts] = useState<Record<string, AgentRuleConfig>>({});
  const [dryRunResults, setDryRunResults] = useState<
    Record<string, Array<{ subject: string; priority: InboxPriority; observedFact: string }>>
  >({});

  const getRule = useCallback(
    (agentId: SystemAgentId): AgentRuleConfig =>
      drafts[agentId] ?? rules[agentId] ?? buildDefaultAgentRule(agentId),
    [drafts, rules],
  );

  const patchDraft = (agentId: SystemAgentId, patch: Partial<AgentRuleConfig>) => {
    setDrafts((prev) => ({
      ...prev,
      [agentId]: { ...getRule(agentId), ...patch },
    }));
  };

  const handleSave = async (agentId: SystemAgentId) => {
    const r = getRule(agentId);
    try {
      await saveInboxAgentRule({
        agentId,
        active: r.active,
        stockThreshold: r.stockThreshold,
        analysisWindowHours: r.analysisWindowHours,
        minIntervalMinutes: r.minIntervalMinutes,
        defaultPriority: r.defaultPriority,
        toAll: r.toAll,
        defaultRecipientIds: r.defaultRecipientIds,
        suggestedAssigneeUid: r.suggestedAssigneeUid,
        autoCreateTaskOnCritical: r.autoCreateTaskOnCritical,
        isCriticalAgent: r.isCriticalAgent,
        mutedKeys: r.mutedKeys,
      });
      onShowToast('Regra do agente salva.', 'ok');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Erro ao salvar regra.', 'err');
    }
  };

  const handleReset = async (agentId: SystemAgentId) => {
    try {
      await saveInboxAgentRule({ agentId, reset: true });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
      onShowToast('Regra restaurada ao padrão.', 'ok');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Erro ao restaurar.', 'err');
    }
  };

  const handleTest = async (agentId: SystemAgentId) => {
    try {
      const res = await testInboxAgentRule(agentId);
      setDryRunResults((prev) => ({ ...prev, [agentId]: res.proposals }));
      onShowToast(`Teste dry-run: ${res.proposals.length} proposta(s) gerada(s).`, 'ok');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Erro ao testar regra.', 'err');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SYSTEM_AGENTS.map((agent) => {
        const rule = getRule(agent.id);
        const testProposals = dryRunResults[agent.id];
        return (
          <div
            key={agent.id}
            className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Bot size={15} className="text-teal-300" />
                  <h3 className="font-bold text-sm text-[var(--adm-text)]">{agent.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-200 border border-teal-500/25">
                    {agent.sector}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--adm-text-muted)] mt-1">
                  {agent.roleTitle} — {agent.description}
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                <input
                  type="checkbox"
                  disabled={!canAdmin}
                  checked={rule.active}
                  onChange={(e) => patchDraft(agent.id, { active: e.target.checked })}
                />
                Ativo
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-[var(--adm-text-dim)] mb-0.5">
                  Janela (horas)
                </label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  disabled={!canAdmin}
                  value={rule.analysisWindowHours}
                  onChange={(e) =>
                    patchDraft(agent.id, { analysisWindowHours: Number(e.target.value) || 24 })
                  }
                  className="w-full px-2 py-1 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--adm-text-dim)] mb-0.5">
                  Intervalo mín (min)
                </label>
                <input
                  type="number"
                  min={15}
                  max={10080}
                  disabled={!canAdmin}
                  value={rule.minIntervalMinutes}
                  onChange={(e) =>
                    patchDraft(agent.id, { minIntervalMinutes: Number(e.target.value) || 180 })
                  }
                  className="w-full px-2 py-1 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--adm-text-dim)] mb-0.5">
                  Prioridade padrão
                </label>
                <select
                  disabled={!canAdmin}
                  value={rule.defaultPriority}
                  onChange={(e) =>
                    patchDraft(agent.id, { defaultPriority: e.target.value as InboxPriority })
                  }
                  className="w-full px-2 py-1 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
                >
                  <option value="informative">Informativa</option>
                  <option value="attention">Atenção</option>
                  <option value="important">Importante</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[var(--adm-text-dim)] mb-0.5">
                  Responsável sugerido
                </label>
                <select
                  disabled={!canAdmin}
                  value={rule.suggestedAssigneeUid ?? ''}
                  onChange={(e) =>
                    patchDraft(agent.id, { suggestedAssigneeUid: e.target.value || undefined })
                  }
                  className="w-full px-2 py-1 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
                >
                  <option value="">Automático / Todos</option>
                  {partners.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {(agent.id === 'ana_estoque' || agent.id === 'rafael_compras') && (
                <div>
                  <label className="block text-[10px] text-[var(--adm-text-dim)] mb-0.5">
                    Limiar de estoque
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    disabled={!canAdmin}
                    value={rule.stockThreshold ?? 5}
                    onChange={(e) =>
                      patchDraft(agent.id, { stockThreshold: Number(e.target.value) || 0 })
                    }
                    className="w-full px-2 py-1 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]"
                  />
                </div>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-[11px] text-[var(--adm-text-muted)]">
              <input
                type="checkbox"
                disabled={!canAdmin}
                checked={rule.autoCreateTaskOnCritical}
                onChange={(e) =>
                  patchDraft(agent.id, { autoCreateTaskOnCritical: e.target.checked })
                }
              />
              Sugerir/gerar tarefa em eventos críticos
            </label>

            {rule.mutedKeys.length > 0 && (
              <div className="text-[11px] text-[var(--adm-text-dim)] flex flex-wrap items-center gap-1">
                <span>Silenciados:</span>
                {rule.mutedKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={!canAdmin}
                    onClick={() =>
                      patchDraft(agent.id, {
                        mutedKeys: rule.mutedKeys.filter((x) => x !== k),
                      })
                    }
                    className="px-1.5 py-0.5 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] hover:text-rose-300"
                    title="Clique para reativar"
                  >
                    {k} ×
                  </button>
                ))}
              </div>
            )}

            {canAdmin && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--adm-border)]">
                <button
                  type="button"
                  onClick={() => handleSave(agent.id)}
                  className="px-2.5 py-1 rounded bg-[var(--adm-gold)] text-[#09120e] font-bold"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => handleTest(agent.id)}
                  className="px-2.5 py-1 rounded border border-[var(--adm-border)] text-[var(--adm-text)]"
                >
                  Testar (dry-run)
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => onRunAgent(agent.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--adm-border)] text-emerald-300"
                >
                  <Play size={11} /> Executar
                </button>
                <button
                  type="button"
                  onClick={() => handleReset(agent.id)}
                  className="px-2.5 py-1 rounded border border-[var(--adm-border)] text-[var(--adm-text-dim)] ml-auto"
                >
                  Restaurar padrão
                </button>
              </div>
            )}

            {testProposals && (
              <div className="p-2 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-1 text-[11px]">
                <p className="font-bold text-teal-300">
                  Dry-run ({testProposals.length} proposta(s)):
                </p>
                {testProposals.length === 0 ? (
                  <p className="text-[var(--adm-text-dim)]">
                    Nenhuma anomalia/insight encontrado nos dados atuais.
                  </p>
                ) : (
                  testProposals.map((p, idx) => (
                    <div key={idx} className="text-[var(--adm-text-muted)]">
                      • [{p.priority}] {p.subject}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
