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
  SlidersHorizontal,
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
  SYSTEM_AGENTS_BY_ID,
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
  onPromptDecision: (
    kind: 'approved' | 'rejected' | 'disagreed' | 'disagree_reaction',
    label: string,
    requireReason: boolean,
  ) => void;
  onOpenTaskModal: () => void;
  onUpdateStatus: (
    patch: {
      messageId: string;
      status?: InboxStatus;
      priority?: InboxPriority;
      assignedToUserId?: string | null;
      requestedResponseFromUserId?: string | null;
      dueAt?: string | null;
      starred?: boolean;
      important?: boolean;
      confirmReceipt?: boolean;
    },
    toastMsg?: string,
  ) => void;
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
  informative: 'bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]',
  attention: 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]',
  important: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
  critical: 'bg-[#fef2f2] text-[#c2414b] border-[#fecaca]',
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

  // Secondary blocks start CLOSED by default for calm initial reading
  const [showRouting, setShowRouting] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const [showEntities, setShowEntities] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const partnerNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of partners) map[p.uid] = p.name;
    return map;
  }, [partners]);

  const agent = message.agentId ? SYSTEM_AGENTS_BY_ID[message.agentId] : undefined;
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
    <div className="space-y-5">
      {/* Gmail / iOS Mail Top Sticky Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#eceff4]">
        <button
          type="button"
          onClick={onBackMobile}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-[#1f1f1f] hover:bg-[#f1f3f4] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Voltar para a caixa</span>
        </button>

        {/* Grouped Quick Actions (Gmail/Outlook style) */}
        <div className="flex flex-wrap items-center gap-1">
          {canEdit && (
            <>
              <button
                type="button"
                title={isUnread ? 'Marcar como lida' : 'Marcar como não lida'}
                onClick={() => onToggleRead(!isUnread)}
                aria-label={isUnread ? 'Marcar como lida' : 'Marcar como não lida'}
                className="p-2 rounded-full text-[#5f6368] hover:text-[#1f1f1f] hover:bg-[#f1f3f4] transition-colors"
              >
                <MailOpen size={16} />
              </button>
              <button
                type="button"
                title={isStarred ? 'Remover favorito' : 'Marcar como favorito'}
                onClick={() => onToggleStarred(!isStarred)}
                aria-label={isStarred ? 'Remover favorito' : 'Marcar como favorito'}
                className="p-2 rounded-full text-[#d97706] hover:bg-[#fef3c7]/50 transition-colors"
              >
                <Star size={16} className={isStarred ? 'fill-[#f59e0b]' : ''} />
              </button>
              <button
                type="button"
                title="Confirmar ciência desta mensagem"
                onClick={onConfirmReceipt}
                aria-label="Confirmar ciência"
                className="p-2 rounded-full text-[#167a52] hover:bg-[#e8f4ee] transition-colors"
              >
                <CheckCheck size={16} />
              </button>
            </>
          )}

          {(canEdit || canArchive || canAdminAgents) && (
            <span className="w-px h-5 bg-[#e3e7ec] mx-1 hidden sm:inline-block" aria-hidden="true" />
          )}

          {canEdit && message.status !== 'resolved' && (
            <button
              type="button"
              onClick={() =>
                onUpdateStatus(
                  { messageId: message.id, status: 'resolved' },
                  'Mensagem marcada como resolvida.',
                )
              }
              title="Marcar como resolvida"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#167a52] hover:bg-[#e8f4ee] transition-colors"
            >
              <Check size={14} />
              <span className="hidden sm:inline">Resolver</span>
            </button>
          )}

          {canArchive && message.status !== 'archived' && (
            <button
              type="button"
              onClick={() =>
                onUpdateStatus({ messageId: message.id, status: 'archived' }, 'Mensagem arquivada.')
              }
              title="Arquivar mensagem"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#5f6368] hover:text-[#1f1f1f] hover:bg-[#f1f3f4] transition-colors"
            >
              <Archive size={14} />
              <span className="hidden sm:inline">Arquivar</span>
            </button>
          )}

          {canAdminAgents && message.agentId && message.deduplicationKey && (
            <button
              type="button"
              onClick={() => onMuteSimilarAlerts(message.agentId!, message.deduplicationKey!)}
              title="Silenciar novos comunicados semelhantes deste agente"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#b7791f] hover:bg-[#fffbeb] transition-colors"
            >
              <BellOff size={14} />
              <span className="hidden sm:inline">Silenciar</span>
            </button>
          )}
        </div>
      </div>

      {/* Subject & Discreet Status Tags */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1f1f1f] tracking-tight leading-snug mr-1">
            {message.subject}
          </h2>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              PRIORITY_BADGE_CLASSES[message.priority]
            }`}
          >
            {INBOX_PRIORITY_META[message.priority].label}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#f1f3f4] text-[#5f6368]">
            {INBOX_TYPE_LABELS[message.type]}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#f1f3f4] text-[#1f1f1f]">
            {INBOX_STATUS_LABELS[message.status]}
          </span>
          {message.source !== 'human' && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#f3e8ff] text-[#6d28d9]">
              Automática {agent ? `· ${agent.sector}` : ''}
            </span>
          )}
          {message.occurrenceCount > 1 && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
              {message.occurrenceCount}x ocorrências
            </span>
          )}
        </div>

        {/* Gmail-style Sender & Recipient Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-3 min-w-0">
            {message.source === 'human' ? (
              <span className="w-10 h-10 rounded-full bg-[#e8f4ee] text-[#167a52] border border-[#b9ddc8] flex items-center justify-center text-sm font-bold shrink-0">
                {message.senderName.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <span className="w-10 h-10 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] flex items-center justify-center shrink-0">
                <Bot size={18} />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-[#1f1f1f]">{message.senderName}</span>
                {message.senderRole && (
                  <span className="text-xs text-[#5f6368]">&lt;{message.senderRole}&gt;</span>
                )}
              </div>
              <div className="text-xs text-[#5f6368] truncate">
                para{' '}
                <span className="font-medium text-[#1f1f1f]">
                  {message.toAll
                    ? 'Todos os sócios administradores'
                    : message.toUserIds.map((id) => partnerNameMap[id] || id).join(', ') || 'Sócios'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 pl-13 sm:pl-0">
            <span className="text-xs text-[#5f6368] font-medium tabular-nums">
              {formatDateTime(message.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#167a52] font-medium">
              <Users size={11} /> Visível aos 3 sócios
            </span>
          </div>
        </div>
      </div>

      {/* Main Message Body (Spacious, open by default) */}
      <div className="py-4 px-1 sm:px-2 text-[14px] sm:text-[15px] text-[#1f1f1f] whitespace-pre-wrap leading-7 selection:bg-[#e8f0fe]">
        {message.body}
      </div>

      {/* Decision Banner (if already decided) */}
      {message.decision && (
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-1 ${
            message.decision.outcome === 'rejected'
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-[#e8f4ee] border-[#b9ddc8] text-[#14532d]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wide">
              Decisão: {message.decision.outcome}
            </span>
            <span className="text-[11px] opacity-80 tabular-nums">
              {formatDateTime(message.decision.decidedAt)}
            </span>
          </div>
          <p>
            Registrado por:{' '}
            <strong>{message.decision.decidedByName || message.decision.decidedBy}</strong>
          </p>
          {message.decision.justification && (
            <p className="italic pt-0.5">
              Justificativa: &ldquo;{message.decision.justification}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Primary Decision / Task Bar */}
      {(canApprove && !message.decision) || canEdit ? (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#eceff4]">
          {canApprove && !message.decision && (
            <>
              <button
                type="button"
                onClick={() => onPromptDecision('approved', 'Aprovar proposta / comunicado', false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#167a52] hover:bg-[#106441] text-white shadow-2xs transition-colors"
              >
                <CheckCircle2 size={14} /> Aprovar
              </button>
              <button
                type="button"
                onClick={() => onPromptDecision('rejected', 'Rejeitar proposta', true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#fef2f2] hover:bg-[#fee2e2] text-[#c2414b] border border-[#fecaca] transition-colors"
              >
                <XCircle size={14} /> Rejeitar
              </button>
            </>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={onOpenTaskModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-white hover:bg-[#f1f3f4] text-[#1f1f1f] border border-[#dadce0] transition-colors"
            >
              <ClipboardList size={14} /> Converter em Tarefa
            </button>
          )}
        </div>
      ) : null}

      {/* Reactions Row */}
      <div className="flex flex-wrap items-center gap-1.5">
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
                  ? 'bg-[#eef5ff] text-[#1d4ed8] border-[#bfdbfe] font-semibold'
                  : 'bg-white text-[#5b6573] border-[#e3e7ec] hover:text-[#17202a] hover:bg-[#f6f7f9]'
              }`}
            >
              {btn.icon}
              <span>{btn.label}</span>
              {count > 0 && <span className="font-bold tabular-nums">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Collapsible Secondary Sections (CLOSED BY DEFAULT) */}
      <div className="space-y-2.5 pt-1">
        {/* Accordion: Insight Breakdown (Agent Insight) */}
        {message.insightDetails && (
          <div className="rounded-xl border border-[#ddd6fe] overflow-hidden bg-[#f5f3ff]/50">
            <button
              type="button"
              onClick={() => setShowInsight(!showInsight)}
              aria-expanded={showInsight}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#f5f3ff] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-[#ede9fe] text-[#6d28d9]">
                  <Sparkles size={13} />
                </span>
                <span className="text-xs font-semibold text-[#4c1d95]">
                  Análise do Funcionário Sistêmico
                </span>
                {message.insightDetails.confidence && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white border border-[#ddd6fe] text-[#6d28d9] font-semibold">
                    Confiança: {message.insightDetails.confidence}
                  </span>
                )}
              </div>
              {showInsight ? (
                <ChevronUp size={15} className="text-[#6d28d9]" />
              ) : (
                <ChevronDown size={15} className="text-[#6d28d9]" />
              )}
            </button>

            {showInsight && (
              <div className="p-4 pt-2 border-t border-[#ddd6fe] bg-white space-y-2 text-xs">
                <p>
                  <strong className="text-[#17202a]">Fato observado:</strong>{' '}
                  <span className="text-[#5b6573]">{message.insightDetails.observedFact}</span>
                </p>
                <p>
                  <strong className="text-[#17202a]">Dados reais usados:</strong>{' '}
                  <span className="text-[#5b6573]">{message.insightDetails.dataUsed}</span>
                </p>
                <p>
                  <strong className="text-[#17202a]">Interpretação:</strong>{' '}
                  <span className="text-[#5b6573]">{message.insightDetails.interpretation}</span>
                </p>
                <p>
                  <strong className="text-[#17202a]">Sugestão de ação:</strong>{' '}
                  <span className="text-[#167a52] font-medium">
                    {message.insightDetails.suggestion}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Accordion: Routing & Assignment (Closed by default) */}
        {canEdit && (
          <div className="rounded-xl border border-[#e3e7ec] overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowRouting(!showRouting)}
              aria-expanded={showRouting}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#f6f7f9] transition-colors"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-[#838e9b]" />
                <span className="text-xs font-semibold text-[#17202a]">
                  Atribuição, Prioridade & Resposta
                </span>
              </div>
              {showRouting ? (
                <ChevronUp size={15} className="text-[#838e9b]" />
              ) : (
                <ChevronDown size={15} className="text-[#838e9b]" />
              )}
            </button>

            {showRouting && (
              <div className="p-4 pt-3 border-t border-[#e3e7ec] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#fbfcfd]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
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
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a]"
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
                  <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
                    Aguardando resposta de
                  </label>
                  <select
                    value={message.requestedResponseFromUserId ?? ''}
                    onChange={(e) =>
                      onUpdateStatus(
                        {
                          messageId: message.id,
                          requestedResponseFromUserId: e.target.value || null,
                        },
                        'Solicitação de resposta atualizada.',
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a]"
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
                  <label className="block text-[11px] font-semibold text-[#5b6573] mb-1">
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
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a]"
                  >
                    <option value="informative">Informativa</option>
                    <option value="attention">Atenção</option>
                    <option value="important">Importante</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accordion: Related Entities */}
        {message.relatedEntities.length > 0 && (
          <div className="rounded-xl border border-[#e3e7ec] overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowEntities(!showEntities)}
              aria-expanded={showEntities}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#f6f7f9] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-[#838e9b]" />
                <span className="text-xs font-semibold text-[#17202a]">
                  Entidades Vinculadas ({message.relatedEntities.length})
                </span>
              </div>
              {showEntities ? (
                <ChevronUp size={15} className="text-[#838e9b]" />
              ) : (
                <ChevronDown size={15} className="text-[#838e9b]" />
              )}
            </button>

            {showEntities && (
              <div className="p-4 pt-3 border-t border-[#e3e7ec] flex flex-wrap gap-2 bg-[#fbfcfd]">
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
                          ? 'bg-white hover:border-[#2563eb] text-[#17202a] border-[#e3e7ec] font-medium'
                          : 'bg-[#f6f7f9] text-[#838e9b] border-[#e3e7ec] opacity-70 cursor-not-allowed'
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

        {/* Accordion: Linked Tasks & Interactive Checklist */}
        {tasks.length > 0 && (
          <div className="rounded-xl border border-[#e3e7ec] overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowTasks(!showTasks)}
              aria-expanded={showTasks}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#f6f7f9] transition-colors"
            >
              <div className="flex items-center gap-2">
                <ClipboardList size={14} className="text-[#838e9b]" />
                <span className="text-xs font-semibold text-[#17202a]">
                  Tarefas vinculadas ({tasks.length})
                </span>
              </div>
              {showTasks ? (
                <ChevronUp size={15} className="text-[#838e9b]" />
              ) : (
                <ChevronDown size={15} className="text-[#838e9b]" />
              )}
            </button>

            {showTasks && (
              <div className="p-4 pt-3 border-t border-[#e3e7ec] space-y-2.5 bg-[#fbfcfd]">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-lg bg-white border border-[#e3e7ec] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#17202a]">{t.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#f6f7f9] border border-[#e3e7ec] text-[#5b6573] font-medium">
                        {t.status}
                      </span>
                    </div>
                    {t.assignedToName && (
                      <p className="text-[11px] text-[#5b6573]">
                        Responsável: <strong className="text-[#17202a]">{t.assignedToName}</strong>
                      </p>
                    )}
                    {t.checklist.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {t.checklist.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-xs text-[#5b6573] cursor-pointer hover:text-[#17202a] transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={item.done}
                              disabled={!canEdit}
                              onChange={() => onToggleChecklist(t, item.id)}
                              className="rounded accent-[#167a52]"
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
          </div>
        )}

        {/* Accordion: Private Attachments */}
        <div className="rounded-xl border border-[#e3e7ec] overflow-hidden bg-white">
          <div className="px-4 py-2.5 flex items-center justify-between bg-white">
            <button
              type="button"
              onClick={() => setShowAttachments(!showAttachments)}
              aria-expanded={showAttachments}
              className="flex items-center gap-2 text-xs font-semibold text-[#17202a] flex-1 text-left"
            >
              <Paperclip size={14} className="text-[#838e9b]" />
              <span>Anexos ({attachments.length})</span>
              {showAttachments ? (
                <ChevronUp size={15} className="text-[#838e9b] ml-1" />
              ) : (
                <ChevronDown size={15} className="text-[#838e9b] ml-1" />
              )}
            </button>

            {canEdit && (
              <label className="inline-flex items-center gap-1 text-xs font-semibold text-[#167a52] hover:text-[#106441] cursor-pointer shrink-0">
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
            <div className="px-4 py-2 bg-[#fffbeb] text-[#b45309] border-t border-[#fde68a] text-xs flex items-center gap-2">
              <span>Enviando anexo com segurança ({uploadProgress}%)...</span>
            </div>
          )}

          {showAttachments && (
            <div className="p-4 pt-3 border-t border-[#e3e7ec] bg-[#fbfcfd]">
              {attachments.length === 0 ? (
                <p className="text-xs text-[#838e9b]">Nenhum anexo nesta mensagem.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white border border-[#e3e7ec]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#17202a] truncate">
                          {att.originalName}
                        </p>
                        <p className="text-[10px] text-[#838e9b]">
                          {formatFileSize(att.size)} • {att.uploadedByName || 'Sócio'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {(att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') && (
                          <button
                            type="button"
                            onClick={() => onOpenAttachment(att, true)}
                            title="Visualizar"
                            aria-label={`Visualizar ${att.originalName}`}
                            className="p-1.5 rounded-lg border border-[#e3e7ec] hover:bg-[#f1f4f7] text-[#5b6573]"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenAttachment(att, false)}
                          title="Baixar com link seguro"
                          aria-label={`Baixar ${att.originalName}`}
                          className="p-1.5 rounded-lg border border-[#e3e7ec] hover:bg-[#e8f4ee] text-[#167a52]"
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

        {/* Accordion: Comments & Discussion */}
        <div className="rounded-xl border border-[#e3e7ec] overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            aria-expanded={showComments}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#f6f7f9] transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-[#838e9b]" />
              <span className="text-xs font-semibold text-[#17202a]">
                Discussão ({comments.length})
              </span>
            </div>
            {showComments ? (
              <ChevronUp size={15} className="text-[#838e9b]" />
            ) : (
              <ChevronDown size={15} className="text-[#838e9b]" />
            )}
          </button>

          {showComments && (
            <div className="p-4 pt-3 border-t border-[#e3e7ec] space-y-3 bg-[#fbfcfd]">
              {comments.length === 0 ? (
                <p className="text-xs text-[#838e9b]">Nenhum comentário ainda.</p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-white border border-[#e3e7ec] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#17202a]">{c.authorName}</span>
                      <span className="text-[#838e9b] tabular-nums">
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#5b6573] whitespace-pre-wrap leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                ))
              )}

              {canEdit && (
                <form
                  onSubmit={handleCommentSubmit}
                  className="space-y-2 pt-2 border-t border-[#e3e7ec]"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={commentKind}
                      onChange={(e) =>
                        setCommentKind(e.target.value as 'comment' | 'forward' | 'request_info')
                      }
                      aria-label="Tipo de comentário"
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a]"
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
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#e3e7ec] text-xs text-[#17202a] placeholder:text-[#838e9b]"
                    />
                    <button
                      type="submit"
                      disabled={
                        !commentText.trim() || isSubmittingComment || busyAction === 'comment'
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#167a52] hover:bg-[#106441] text-white disabled:opacity-50 transition-colors"
                    >
                      <Send size={13} /> Enviar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Accordion: Immutable Audit History */}
        <div className="rounded-xl border border-[#e3e7ec] overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#f6f7f9] transition-colors"
          >
            <div className="flex items-center gap-2">
              <History size={14} className="text-[#838e9b]" />
              <span className="text-xs font-semibold text-[#17202a]">
                Histórico ({history.length})
              </span>
            </div>
            {showHistory ? (
              <ChevronUp size={15} className="text-[#838e9b]" />
            ) : (
              <ChevronDown size={15} className="text-[#838e9b]" />
            )}
          </button>

          {showHistory && (
            <div className="p-4 pt-3 border-t border-[#e3e7ec] max-h-56 overflow-y-auto space-y-1.5 bg-[#fbfcfd]">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="text-[11px] text-[#5b6573] flex items-center justify-between gap-2 py-1 border-b border-[#e3e7ec] last:border-b-0"
                >
                  <span>
                    <strong className="text-[#17202a]">{h.actorName}</strong> •{' '}
                    {h.details || h.action}
                    {h.justification ? ` — "${h.justification}"` : ''}
                  </span>
                  <span className="shrink-0 text-[#838e9b] tabular-nums">
                    {formatDateTime(h.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
