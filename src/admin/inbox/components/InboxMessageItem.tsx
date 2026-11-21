import React from 'react';
import {
  Bot,
  MessageSquare,
  Paperclip,
  Star,
} from 'lucide-react';
import { formatDateTime } from '../../components/AdminUi';
import {
  INBOX_PRIORITY_META,
  INBOX_STATUS_LABELS,
  INBOX_TYPE_LABELS,
  SYSTEM_AGENTS_BY_ID,
} from '../agents';
import type { AdminInboxMessage, InboxPriority } from '../types';

interface InboxMessageItemProps {
  message: AdminInboxMessage;
  isSelected: boolean;
  isUnread: boolean;
  currentUid: string;
  onSelect: () => void;
}

const PRIORITY_CHIP_CLASSES: Record<InboxPriority, string> = {
  informative: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  attention: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  important: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  critical: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export const InboxMessageItem: React.FC<InboxMessageItemProps> = ({
  message,
  isSelected,
  isUnread,
  currentUid,
  onSelect,
}) => {
  const agent = message.agentId ? SYSTEM_AGENTS_BY_ID[message.agentId] : undefined;
  const isStarred = Boolean(message.starredBy?.[currentUid]);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`w-full text-left p-3.5 transition-all duration-150 border-b border-[var(--adm-border)]/60 last:border-b-0 relative group ${
        isSelected
          ? 'bg-[var(--adm-surface-elevated)] shadow-xs'
          : isUnread
          ? 'bg-emerald-500/[0.03] hover:bg-[var(--adm-surface-elevated)]/70'
          : 'bg-transparent hover:bg-[var(--adm-surface-elevated)]/50'
      }`}
    >
      {/* Accent selection bar */}
      {isSelected && (
        <span
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[var(--adm-gold)]"
          aria-hidden="true"
        />
      )}

      {/* Row 1: Sender info + Time */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {message.source === 'human' ? (
            <span
              className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold shrink-0"
              title={`Sócio: ${message.senderName}`}
            >
              {message.senderName.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <span
              className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0"
              title={`Agente Sistêmico: ${agent?.name || message.senderName}`}
            >
              <Bot size={11} />
            </span>
          )}

          <span
            className={`text-xs truncate ${
              isUnread ? 'font-bold text-[var(--adm-text)]' : 'font-medium text-[var(--adm-text-muted)]'
            }`}
          >
            {message.senderName}
          </span>

          {agent && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/25 shrink-0">
              {agent.sector}
            </span>
          )}
        </div>

        <span className="text-[10px] text-[var(--adm-text-dim)] font-medium shrink-0">
          {formatDateTime(message.createdAt)}
        </span>
      </div>

      {/* Row 2: Unread indicator + Star + Subject */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {isUnread && (
          <span
            className="w-2 h-2 rounded-full bg-[var(--adm-gold)] shrink-0"
            title="Não lida"
            aria-label="Mensagem não lida"
          />
        )}
        {isStarred && (
          <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" aria-label="Favorita" />
        )}
        <h4
          className={`text-xs truncate flex-1 ${
            isUnread
              ? 'font-bold text-[var(--adm-text)] tracking-tight'
              : 'font-medium text-[var(--adm-text)]'
          }`}
        >
          {message.subject}
        </h4>
      </div>

      {/* Row 3: Body Preview */}
      <p className="text-[11px] text-[var(--adm-text-dim)] line-clamp-2 leading-relaxed mb-2.5">
        {message.body}
      </p>

      {/* Row 4: Metadata chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
            PRIORITY_CHIP_CLASSES[message.priority]
          }`}
        >
          {INBOX_PRIORITY_META[message.priority].label}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--adm-bg)] text-[var(--adm-text-dim)] border border-[var(--adm-border)]">
          {INBOX_TYPE_LABELS[message.type]}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--adm-bg)] text-[var(--adm-text-dim)] border border-[var(--adm-border)]">
          {INBOX_STATUS_LABELS[message.status]}
        </span>

        {message.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--adm-text-dim)] ml-auto font-medium">
            <MessageSquare size={10} /> {message.commentCount}
          </span>
        )}
        {message.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--adm-text-dim)] font-medium">
            <Paperclip size={10} /> {message.attachmentCount}
          </span>
        )}
      </div>
    </button>
  );
};
