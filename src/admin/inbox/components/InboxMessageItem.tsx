import React from 'react';
import { Bot, MessageSquare, Paperclip, Star } from 'lucide-react';
import { formatDateTime } from '../../components/AdminUi';
import {
  INBOX_PRIORITY_META,
  INBOX_STATUS_LABELS,
  INBOX_TYPE_LABELS,
  SYSTEM_AGENTS_BY_ID,
} from '../agents';
import type { AdminInboxMessage, InboxPriority } from '../types';

const PRIORITY_CHIP_CLASSES: Record<InboxPriority, string> = {
  informative: 'bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]',
  attention: 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]',
  important: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
  critical: 'bg-[#fef2f2] text-[#c2414b] border-[#fecaca]',
};

interface InboxMessageItemProps {
  message: AdminInboxMessage;
  isSelected: boolean;
  isUnread: boolean;
  currentUid: string;
  onSelect: () => void;
}

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
      className={`w-full text-left px-4 py-3.5 transition-colors border-b border-[#e3e7ec] last:border-b-0 relative group ${
        isSelected
          ? 'bg-[#eef5ff]'
          : isUnread
          ? 'bg-[#f8fbff] hover:bg-[#f1f5f9]'
          : 'bg-white hover:bg-[#f6f7f9]'
      }`}
    >
      {/* Left selection / unread indicator */}
      {isSelected ? (
        <span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#2563eb]"
          aria-hidden="true"
        />
      ) : isUnread ? (
        <span
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-[#60a5fa]"
          aria-hidden="true"
        />
      ) : null}

      {/* Row 1: Sender avatar + Name + Source badge + Time */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {message.source === 'human' ? (
            <span
              className="w-6 h-6 rounded-full bg-[#e8f4ee] text-[#167a52] border border-[#b9ddc8] flex items-center justify-center text-[11px] font-bold shrink-0"
              title={`Sócio: ${message.senderName}`}
            >
              {message.senderName.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <span
              className="w-6 h-6 rounded-full bg-[#eef5ff] text-[#2563eb] border border-[#bfdbfe] flex items-center justify-center shrink-0"
              title={`Agente Sistêmico: ${agent?.name || message.senderName}`}
            >
              <Bot size={13} />
            </span>
          )}

          <span
            className={`text-xs truncate ${
              isUnread ? 'font-bold text-[#17202a]' : 'font-medium text-[#374151]'
            }`}
          >
            {message.senderName}
          </span>

          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium border shrink-0 ${
              message.source === 'human'
                ? 'bg-[#f6f7f9] text-[#5b6573] border-[#e3e7ec]'
                : 'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]'
            }`}
          >
            {message.source === 'human' ? 'Humana' : agent ? `Automática · ${agent.sector}` : 'Automática'}
          </span>
        </div>

        <span className="text-[11px] text-[#838e9b] font-medium shrink-0 tabular-nums">
          {formatDateTime(message.createdAt)}
        </span>
      </div>

      {/* Row 2: Unread dot + Star + Subject */}
      <div className="flex items-center gap-1.5 mb-1 pl-8">
        {isUnread && (
          <span
            className="w-2 h-2 rounded-full bg-[#2563eb] shrink-0"
            title="Não lida"
            aria-label="Mensagem não lida"
          />
        )}
        {isStarred && (
          <Star size={12} className="text-[#d97706] fill-[#f59e0b] shrink-0" aria-label="Favorita" />
        )}
        <h4
          className={`text-[13px] truncate flex-1 ${
            isUnread ? 'font-bold text-[#17202a]' : 'font-semibold text-[#1f2937]'
          }`}
        >
          {message.subject}
        </h4>
      </div>

      {/* Row 3: Short Preview */}
      <p className="text-xs text-[#5b6573] line-clamp-2 leading-relaxed mb-2 pl-8">
        {message.body}
      </p>

      {/* Row 4: Discreet semantic chips & counts */}
      <div className="flex flex-wrap items-center gap-1.5 pl-8">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
            PRIORITY_CHIP_CLASSES[message.priority]
          }`}
        >
          {INBOX_PRIORITY_META[message.priority].label}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f6f7f9] text-[#5b6573] border border-[#e3e7ec]">
          {INBOX_TYPE_LABELS[message.type]}
        </span>
        {message.status !== 'new' && message.status !== 'read' && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f6f7f9] text-[#5b6573] border border-[#e3e7ec]">
            {INBOX_STATUS_LABELS[message.status]}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 text-[#838e9b]">
          {message.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" title="Comentários">
              <MessageSquare size={11} /> {message.commentCount}
            </span>
          )}
          {message.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" title="Anexos">
              <Paperclip size={11} /> {message.attachmentCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
