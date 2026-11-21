import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BellOff,
  Bot,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  History,
  Link2,
  Lock,
  MailOpen,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
} from 'lucide-react';
import { formatDateTime } from '../../components/AdminUi';
import {
  INBOX_PRIORITY_META,
  INBOX_STATUS_LABELS,
  INBOX_TYPE_LABELS,
} from '../agents';
import { ENTITY_REQUIRED_PERMISSION } from '../normalizers';
import type {
  AdminInboxMessage,
  InboxAttachment,
  InboxComment,
  InboxEntityReference,
  InboxHistoryEntry,
  InboxPriority,
  InboxReaction,
  InboxReactionType,
  InboxStatus,
  InboxTask,
  PartnerAdminMember,
} from '../types';

interface InboxDetailPaneProps {
  message: AdminInboxMessage;
  currentUid: string;
  partners: PartnerAdminMember[];
  canEdit: boolean;
  canApprove: boolean;
  canArchive: boolean;
  canAdminAgents: boolean;
  can: (perm: string) => boolean;
  comments: InboxComment[];
  reactions: InboxReaction[];
  history: InboxHistoryEntry[];
  attachments: InboxAttachment[];
  tasks: InboxTask[];
  busyAction: string | null;
  uploadProgress: number | null;
  onBackMobile: () => void;
  onToggleRead: (unread: boolean) => void;
  onToggleStarred: (starred: boolean) => void;
  onConfirmReceipt: () => void;
  onReaction: (type: InboxReactionType) => void;
  onPromptDecision: (kind: 'approved' | 'rejected' | 'disagreed' | 'disagree_reaction', label: string, requireReason: boolean) => void;
  onOpenTaskModal: () => void;
  onUpdateStatus: (patch: {
    messageId: string;
    status?: InboxStatus;
    priority?: InboxPriority;
    assignedToUserId?: string | null;
    requestedResponseFromUserId?: string | null;
    dueAt?: string | null;
    starred?: boolean;
    important?: boolean;
    confirmReceipt?: boolean;
  }, toastMsg?: string) => void;
  onMuteSimilarAlerts: (agentId: string, deduplicationKey: string) => void;
  onOpenAttachment: (att: InboxAttachment, preview?: boolean) => void;
  onAttachFile: (file: File) => void;
  onSendComment: (text: string, kind: 'comment' | 'forward' | 'request_info') => Promise<void>;
  onToggleChecklist: (task: InboxTask, itemId: string) => void;
  onNavigateEntity: (entity: InboxEntityReference) => void;
}

const REACTION_BUTTONS: Array<{
  type: InboxReactionType;
  label: string;
  icon: React.ReactNode;
}> = [
  { type: 'like', label: 'Curtir', icon: <ThumbsUp size={12} /> },
  { type: 'agree', label: 'Concordo', icon: <Check size={12} /> },
  { type: 'disagree', label: 'Discordo', icon: <ThumbsDown size={12} /> },
  { type: 'attention', label: 'Atenção', icon: <AlertTriangle size={12} /> },
  { type: 'check', label: 'Ciente', icon: <CheckCheck size={12} /> },
];

const PRIORITY_BADGE_CLASSES: Record<InboxPriority, string> = {
  informative: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  attention: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  important: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  critical: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const InboxDetailPane: React.FC<InboxDetailPaneProps> = ({
  message,
  currentUid,
  partners,
  canEdit,
  canApprove,
  canArchive,
  canAdminAgents,
  can,
  comments,
  reactions,
  history,
  attachments,
  tasks,
  busyAction,
  uploadProgress,
  onBackMobile,
  onToggleRead,
  onToggleStarred,
  onConfirmReceipt,
  onReaction,
  onPromptDecision,
  onOpenTaskModal,
  onUpdateStatus,
  onMuteSimilarAlerts,
  onOpenAttachment,
  onAttachFile,
  onSendComment,
  onToggleChecklist,
  onNavigateEntity,
}) => {
  const [commentText, setCommentText] = useState('');
  const [commentKind, setCommentKind] = useState<'comment' | 'forward' | 'request_info'>('comment');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Collapsible section states for Apple-like disclosure
  const [showInsight, setShowInsight] = useState(true);
  const [showEntities, setShowEntities] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showAttachments, setShowAttachments] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const partnerNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of partners) map[p.uid] = p.name;
    return map;
  }, [partners]);

  const isUnread = !message.readBy?.[currentUid] && message.status !== 'archived';
  const isStarred = Boolean(message.starredBy?.[currentUid]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await onSendComment(commentText.trim(), commentKind);
      setCommentText('');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Detail Header */}
      <div className="pb-4 border-b border-[var(--adm-border)] space-y-3">
        {/* Mobile back button */}
        <div className="flex items-center justify-between lg:hidden">
          <button
            type="button"
            onClick={onBackMobile}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--adm-gold)] hover:underline"
          >
            <ArrowLeft size={14} /> Voltar à lista
          </button>
        </div>

        {/* Top Chips & Quick Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                PRIORITY_BADGE_CLASSES[message.priority]
              }`}
            >
              {INBOX_PRIORITY_META[message.priority].label}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text-muted)]">
              {INBOX_TYPE_LABELS[message.type]}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)]">
              {INBOX_STATUS_LABELS[message.status]}
            </span>
            {message.occurrenceCount > 1 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
                {message.occurrenceCount}x ocorrências
              </span>
            )}
          </div>

          {/* Quick Header Icons */}
          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                title={isUnread ? 'Marcar como lida' : 'Marcar como não lida'}
                onClick={() => onToggleRead(!isUnread)}
                aria-label={isUnread ? 'Marcar como lida' : 'Marcar como não lida'}
                className="p-1.5 rounded-lg border border-[var(--adm-border)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:bg-[var(--adm-surface-elevated)] transition-colors"
              >
                <MailOpen size={13} />
              </button>
              <button
                type="button"
                title={isStarred ? 'Remover favorito' : 'Marcar como favorito'}
                onClick={() => onToggleStarred(!isStarred)}
                aria-label="Favoritar mensagem"
                className="p-1.5 rounded-lg border border-[var(--adm-border)] text-amber-300 hover:bg-[var(--adm-surface-elevated)] transition-colors"
              >
                <Star size={13} className={isStarred ? 'fill-amber-400' : ''} />
              </button>
              <button
                type="button"
                title="Confirmar ciência desta mensagem"
                onClick={onConfirmReceipt}
                aria-label="Confirmar ciência"
                className="p-1.5 rounded-lg border border-[var(--adm-border)] text-emerald-300 hover:bg-[var(--adm-surface-elevated)] transition-colors"
              >
                <CheckCheck size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Subject */}
        <h2 className="text-base sm:text-lg font-bold text-[var(--adm-text)] tracking-tight leading-snug">
          {message.subject}
        </h2>

        {/* Sender & Recipient Details */}
        <div className="p-3 rounded-xl bg-[var(--adm-bg)]/60 border border-[var(--adm-border)]/60 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {message.source === 'human' ? (
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {message.senderName.slice(0, 1).toUpperCase()}
                </span>
              ) : (
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
                  <Bot size={13} />
                </span>
              )}
              <div className="min-w-0">
                <span className="font-bold text-[var(--adm-text)]">{message.senderName}</span>
                {message.senderRole && (
                  <span className="text-[var(--adm-text-dim)] ml-1">({message.senderRole})</span>
                )}
              </div>
            </div>

            <span className="text-[11px] text-[var(--adm-text-dim)] shrink-0 font-medium">
              {formatDateTime(message.createdAt)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--adm-border)]/40 text-[11px]">
            <span className="text-[var(--adm-text-dim)] truncate">
              Para:{' '}
              <strong className="text-[var(--adm-text-muted)]">
                {message.toAll
                  ? 'Todos os sócios administradores'
                  : message.toUserIds.map((id) => partnerNameMap[id] || id).join(', ') || 'Sócios'}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-300/90 shrink-0 font-medium">
              <Users size={11} /> Visível para todos os administradores
            </span>
          </div>
        </div>
      </div>

      {/* Main Message Body */}
      <div className="p-4 rounded-xl bg-[var(--adm-bg)] border border-[var(--adm-border)]/80 text-xs sm:text-sm text-[var(--adm-text)] whitespace-pre-wrap leading-relaxed selection:bg-[var(--adm-brand)]/20">
        {message.body}
      </div>

      {/* Decision Banner (if already decided) */}
      {message.decision && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-200 uppercase tracking-wide">
              Decisão: {message.decision.outcome}
            </span>
            <span className="text-[11px] text-[var(--adm-text-dim)]">
              {formatDateTime(message.decision.decidedAt)}
            </span>
          </div>
          <p className="text-[var(--adm-text-muted)]">
            Registrado por:{' '}
            <strong className="text-[var(--adm-text)]">
              {message.decision.decidedByName || message.decision.decidedBy}
            </strong>
          </p>
          {message.decision.justification && (
            <p className="text-[var(--adm-text-dim)] italic pt-0.5">
              Justificativa: &ldquo;{message.decision.justification}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Action Toolbar (Grouped by Intent) */}
      <div className="p-3 rounded-xl bg-[var(--adm-surface-elevated)]/40 border border-[var(--adm-border)] flex flex-wrap items-center justify-between gap-2">
        {/* Left: Decisions & Approvals */}
        <div className="flex flex-wrap items-center gap-1.5">
          {canApprove && !message.decision && (
            <>
              <button
                type="button"
                onClick={() => onPromptDecision('approved', 'Aprovar proposta / comunicado', false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30 transition-colors"
              >
                <CheckCircle2 size={13} /> Aprovar
              </button>
              <button
                type="button"
                onClick={() => onPromptDecision('rejected', 'Rejeitar proposta', true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 transition-colors"
              >
                <XCircle size={13} /> Rejeitar
              </button>
            </>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={onOpenTaskModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--adm-bg)] hover:bg-[var(--adm-surface)] text-[var(--adm-text)] border border-[var(--adm-border)] transition-colors"
            >
              <ClipboardList size={13} /> Converter em Tarefa
            </button>
          )}
        </div>

        {/* Right: Status actions */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {canEdit && message.status !== 'resolved' && (
            <button
              type="button"
              onClick={() => onUpdateStatus({ messageId: message.id, status: 'resolved' }, 'Mensagem marcada como resolvida.')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--adm-bg)] hover:bg-emerald-500/15 text-emerald-200 border border-[var(--adm-border)] hover:border-emerald-500/30 transition-colors"
            >
              <Check size={13} /> Resolver
            </button>
          )}

          {canArchive && message.status !== 'archived' && (
            <button
              type="button"
              onClick={() => onUpdateStatus({ messageId: message.id, status: 'archived' }, 'Mensagem arquivada.')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--adm-bg)] hover:bg-[var(--adm-surface)] text-[var(--adm-text-muted)] border border-[var(--adm-border)] transition-colors"
            >
              <Archive size={13} /> Arquivar
            </button>
          )}

          {canAdminAgents && message.agentId && message.deduplicationKey && (
            <button
              type="button"
              onClick={() => onMuteSimilarAlerts(message.agentId!, message.deduplicationKey!)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--adm-bg)] hover:bg-[var(--adm-surface)] text-[var(--adm-text-dim)] border border-[var(--adm-border)] transition-colors"
              title="Silenciar novos comunicados semelhantes deste agente"
            >
              <BellOff size={13} /> Silenciar
            </button>
          )}
        </div>
      </div>

      {/* Assignment / Due Date / Routing Row */}
      {canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-[var(--adm-text-dim)] mb-1">
              Responsável
            </label>
            <select
              value={message.assignedToUserId ?? ''}
              onChange={(e) =>
                onUpdateStatus(
                  { messageId: message.id, assignedToUserId: e.target.value || null },
                  'Responsável atualizado.',
                )
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
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
              value={message.requestedResponseFromUserId ?? ''}
              onChange={(e) =>
                onUpdateStatus(
                  { messageId: message.id, requestedResponseFromUserId: e.target.value || null },
                  'Solicitação de resposta atualizada.',
                )
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
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
              value={message.priority}
              onChange={(e) =>
                onUpdateStatus(
                  { messageId: message.id, priority: e.target.value as InboxPriority },
                  'Prioridade atualizada.',
                )
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
            >
              <option value="informative">Informativa</option>
              <option value="attention">Atenção</option>
              <option value="important">Importante</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
        </div>
      )}

      {/* Accordion 1: Insight Breakdown (Agent Insight) */}
      {message.insightDetails && (
        <div className="rounded-xl border border-teal-500/25 overflow-hidden bg-teal-500/[0.04]">
          <button
            type="button"
            onClick={() => setShowInsight(!showInsight)}
            aria-expanded={showInsight}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-teal-500/[0.07] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-teal-500/20 text-teal-300">
                <Sparkles size={13} />
              </span>
              <span className="text-xs font-bold text-teal-200">
                Análise do Funcionário Sistêmico
              </span>
              {message.insightDetails.confidence && (
                <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-200">
                  Confiança: {message.insightDetails.confidence}
                </span>
              )}
            </div>
            {showInsight ? <ChevronUp size={14} className="text-teal-300" /> : <ChevronDown size={14} className="text-teal-300" />}
          </button>

          {showInsight && (
            <div className="p-4 pt-1 border-t border-teal-500/20 space-y-2 text-xs">
              <p>
                <strong className="text-[var(--adm-text)]">Fato observado:</strong>{' '}
                <span className="text-[var(--adm-text-muted)]">{message.insightDetails.observedFact}</span>
              </p>
              <p>
                <strong className="text-[var(--adm-text)]">Dados reais usados:</strong>{' '}
                <span className="text-[var(--adm-text-muted)]">{message.insightDetails.dataUsed}</span>
              </p>
              <p>
                <strong className="text-[var(--adm-text)]">Interpretação:</strong>{' '}
                <span className="text-[var(--adm-text-muted)]">{message.insightDetails.interpretation}</span>
              </p>
              <p>
                <strong className="text-[var(--adm-text)]">Sugestão de ação:</strong>{' '}
                <span className="text-emerald-200">{message.insightDetails.suggestion}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Accordion 2: Related Entities */}
      {message.relatedEntities.length > 0 && (
        <div className="rounded-xl border border-[var(--adm-border)] overflow-hidden bg-[var(--adm-surface)]">
          <button
            type="button"
            onClick={() => setShowEntities(!showEntities)}
            aria-expanded={showEntities}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[var(--adm-surface-elevated)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Link2 size={13} className="text-[var(--adm-text-dim)]" />
              <span className="text-xs font-bold text-[var(--adm-text)]">
                Entidades Vinculadas ({message.relatedEntities.length})
              </span>
            </div>
            {showEntities ? <ChevronUp size={14} className="text-[var(--adm-text-dim)]" /> : <ChevronDown size={14} className="text-[var(--adm-text-dim)]" />}
          </button>

          {showEntities && (
            <div className="p-4 pt-2 border-t border-[var(--adm-border)] flex flex-wrap gap-2">
              {message.relatedEntities.map((ent, idx) => {
                const perm = ENTITY_REQUIRED_PERMISSION[ent.type];
                const allowed = !perm || can(perm);
                return (
                  <button
                    key={`${ent.type}_${ent.id}_${idx}`}
                    type="button"
                    onClick={() => onNavigateEntity(ent)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      allowed
                        ? 'bg-[var(--adm-bg)] hover:border-[var(--adm-gold-border)] text-[var(--adm-text)] border-[var(--adm-border)] font-medium'
                        : 'bg-[var(--adm-bg)] text-[var(--adm-text-dim)] border-[var(--adm-border)] opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {allowed ? <ExternalLink size={12} /> : <Lock size={12} />}
                    <span>{ent.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Accordion 3: Linked Tasks & Interactive Checklist */}
      {tasks.length > 0 && (
        <div className="rounded-xl border border-[var(--adm-border)] overflow-hidden bg-[var(--adm-surface)]">
          <button
            type="button"
            onClick={() => setShowTasks(!showTasks)}
            aria-expanded={showTasks}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[var(--adm-surface-elevated)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <ClipboardList size={13} className="text-[var(--adm-text-dim)]" />
              <span className="text-xs font-bold text-[var(--adm-text)]">
                Tarefas Operacionais Vinculadas ({tasks.length})
              </span>
            </div>
            {showTasks ? <ChevronUp size={14} className="text-[var(--adm-text-dim)]" /> : <ChevronDown size={14} className="text-[var(--adm-text-dim)]" />}
          </button>

          {showTasks && (
            <div className="p-4 pt-2 border-t border-[var(--adm-border)] space-y-2.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--adm-text)]">{t.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-[var(--adm-text-muted)] font-medium">
                      {t.status}
                    </span>
                  </div>
                  {t.assignedToName && (
                    <p className="text-[11px] text-[var(--adm-text-muted)]">
                      Responsável: <strong className="text-[var(--adm-text)]">{t.assignedToName}</strong>
                    </p>
                  )}
                  {t.checklist.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {t.checklist.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 text-xs text-[var(--adm-text-muted)] cursor-pointer hover:text-[var(--adm-text)] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            disabled={!canEdit}
                            onChange={() => onToggleChecklist(t, item.id)}
                            className="rounded"
                          />
                          <span className={item.done ? 'line-through opacity-50' : ''}>
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
        </div>
      )}

      {/* Accordion 4: Private Attachments */}
      <div className="rounded-xl border border-[var(--adm-border)] overflow-hidden bg-[var(--adm-surface)]">
        <div className="px-4 py-2.5 flex items-center justify-between bg-[var(--adm-surface)] border-b border-[var(--adm-border)]">
          <button
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            aria-expanded={showAttachments}
            className="flex items-center gap-2 text-xs font-bold text-[var(--adm-text)]"
          >
            <Paperclip size={13} className="text-[var(--adm-text-dim)]" />
            <span>Anexos Privados ({attachments.length})</span>
            {showAttachments ? <ChevronUp size={14} className="text-[var(--adm-text-dim)] ml-1" /> : <ChevronDown size={14} className="text-[var(--adm-text-dim)] ml-1" />}
          </button>

          {canEdit && (
            <label className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--adm-gold)] hover:underline cursor-pointer">
              <Plus size={13} />
              Adicionar Anexo
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onAttachFile(file);
                }}
              />
            </label>
          )}
        </div>

        {uploadProgress !== null && (
          <div className="px-4 py-2 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
            <span>Enviando anexo com segurança ({uploadProgress}%)...</span>
          </div>
        )}

        {showAttachments && (
          <div className="p-4">
            {attachments.length === 0 ? (
              <p className="text-xs text-[var(--adm-text-dim)]">Nenhum anexo nesta mensagem.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)]"
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
                      {(att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') && (
                        <button
                          type="button"
                          onClick={() => onOpenAttachment(att, true)}
                          title="Visualizar"
                          className="p-1.5 rounded-lg border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)]"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenAttachment(att, false)}
                        title="Baixar com link seguro"
                        className="p-1.5 rounded-lg border border-[var(--adm-border)] hover:bg-[var(--adm-surface-elevated)] text-[var(--adm-gold)]"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion 5: Reactions Row */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {REACTION_BUTTONS.map((btn) => {
          const count = message.reactionCounts[btn.type] ?? 0;
          const mine = reactions.some((r) => r.userId === currentUid && r.type === btn.type);

          return (
            <button
              key={btn.type}
              type="button"
              onClick={() => onReaction(btn.type)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                mine
                  ? 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border-[var(--adm-gold-border)] font-semibold'
                  : 'bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)] hover:text-[var(--adm-text)]'
              }`}
            >
              {btn.icon}
              <span>{btn.label}</span>
              {count > 0 && <span className="font-bold tabular-nums">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Accordion 6: Comments & Discussion */}
      <div className="rounded-xl border border-[var(--adm-border)] overflow-hidden bg-[var(--adm-surface)]">
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          aria-expanded={showComments}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[var(--adm-surface-elevated)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={13} className="text-[var(--adm-text-dim)]" />
            <span className="text-xs font-bold text-[var(--adm-text)]">
              Discussão Interna ({comments.length})
            </span>
          </div>
          {showComments ? <ChevronUp size={14} className="text-[var(--adm-text-dim)]" /> : <ChevronDown size={14} className="text-[var(--adm-text-dim)]" />}
        </button>

        {showComments && (
          <div className="p-4 pt-2 border-t border-[var(--adm-border)] space-y-3">
            {comments.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[var(--adm-text)]">{c.authorName}</span>
                  <span className="text-[var(--adm-text-dim)]">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="text-xs text-[var(--adm-text-muted)] whitespace-pre-wrap leading-relaxed">
                  {c.body}
                </p>
              </div>
            ))}

            {canEdit && (
              <form onSubmit={handleCommentSubmit} className="space-y-2 pt-2 border-t border-[var(--adm-border)]/60">
                <div className="flex items-center gap-2">
                  <select
                    value={commentKind}
                    onChange={(e) => setCommentKind(e.target.value as 'comment' | 'forward' | 'request_info')}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  >
                    <option value="comment">Comentário interno</option>
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
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)] focus:outline-none focus:border-[var(--adm-gold-border)]"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || isSubmittingComment || busyAction === 'comment'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[var(--adm-gold)] text-[#09120e] disabled:opacity-50 hover:opacity-95 transition-opacity"
                  >
                    <Send size={13} /> Enviar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Accordion 7: Immutable Audit History */}
      <div className="rounded-xl border border-[var(--adm-border)] overflow-hidden bg-[var(--adm-surface)]">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          aria-expanded={showHistory}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[var(--adm-surface-elevated)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <History size={13} className="text-[var(--adm-text-dim)]" />
            <span className="text-xs font-bold text-[var(--adm-text)]">
              Histórico Imutável & Auditoria ({history.length})
            </span>
          </div>
          {showHistory ? <ChevronUp size={14} className="text-[var(--adm-text-dim)]" /> : <ChevronDown size={14} className="text-[var(--adm-text-dim)]" />}
        </button>

        {showHistory && (
          <div className="p-4 pt-2 border-t border-[var(--adm-border)] max-h-56 overflow-y-auto space-y-1.5">
            {history.map((h) => (
              <div
                key={h.id}
                className="text-[11px] text-[var(--adm-text-dim)] flex items-center justify-between gap-2 py-1 border-b border-[var(--adm-border)]/40 last:border-b-0"
              >
                <span>
                  <strong className="text-[var(--adm-text-muted)]">{h.actorName}</strong> •{' '}
                  {h.details || h.action}
                  {h.justification ? ` — "${h.justification}"` : ''}
                </span>
                <span className="shrink-0 tabular-nums">{formatDateTime(h.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
