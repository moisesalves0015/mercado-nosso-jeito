import React from 'react';
import { Bot, MessageSquare, Paperclip, Star } from 'lucide-react';
import { formatDateTime } from '../../components/AdminUi';
import {
  INBOX_PRIORITY_META,
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
      className={`w-full text-left px-3 py-2 transition-colors border-b border-[#eceff4] last:border-b-0 relative group ${
        isSelected
          ? 'bg-[#e8f0fe]'
          : isUnread
          ? 'bg-white hover:bg-[#f5f8fd] hover:shadow-[inset_0_-1px_0_#dadce0]'
          : 'bg-[#f9fafb]/80 hover:bg-[#f2f4f8]'
      }`}
    >
      {/* Subtle left bar for unread */}
      {isUnread && (
        <span
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-[#1a73e8]"
          aria-hidden="true"
        />
      )}

      {/* Desktop Gmail-style horizontal row + Clean mobile stacking */}
      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2.5 min-w-0">
        {/* Left: Unread dot + Avatar + Star + Sender Name */}
        <div className="flex items-center gap-2 md:w-52 lg:w-56 shrink-0 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isUnread ? 'bg-[#1a73e8]' : 'bg-transparent'
            }`}
            aria-label={isUnread ? 'Não lida' : undefined}
          />

          {message.source === 'human' ? (
            <span
              className="w-6 h-6 rounded-full bg-[#e8f4ee] text-[#167a52] border border-[#b9ddc8] flex items-center justify-center text-[10px] font-bold shrink-0"
              title={`Sócio: ${message.senderName}`}
            >
              {message.senderName.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <span
              className="w-6 h-6 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] flex items-center justify-center shrink-0"
              title={`Agente Sistêmico: ${agent?.name || message.senderName}`}
            >
              <Bot size={12} />
            </span>
          )}

          <Star
            size={13}
            className={`shrink-0 ${
              isStarred ? 'text-[#f59e0b] fill-[#f59e0b]' : 'text-[#cbd5e1]'
            }`}
            aria-label={isStarred ? 'Favorita' : undefined}
          />

          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <span
              className={`text-[13px] truncate ${
                isUnread ? 'font-bold text-[#1f1f1f]' : 'font-medium text-[#444746]'
              }`}
            >
              {message.senderName}
            </span>
            {message.source !== 'human' && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f3e8ff] text-[#6d28d9] font-medium shrink-0">
                Bot
              </span>
            )}
          </div>

          {/* Mobile Date */}
          <span
            className={`md:hidden text-[11px] tabular-nums ml-auto shrink-0 ${
              isUnread ? 'font-bold text-[#1f1f1f]' : 'text-[#5f6368]'
            }`}
          >
            {formatDateTime(message.createdAt)}
          </span>
        </div>

        {/* Center: Subject — Snippet (Gmail-style single line on desktop) */}
        <div className="flex-1 min-w-0 flex items-center gap-2 pl-6 md:pl-0">
          {message.priority !== 'informative' && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                PRIORITY_CHIP_CLASSES[message.priority]
              }`}
            >
              {INBOX_PRIORITY_META[message.priority].label}
            </span>
          )}

          <p className="text-[13px] truncate min-w-0 flex-1">
            <span className={isUnread ? 'font-bold text-[#1f1f1f]' : 'font-medium text-[#1f1f1f]'}>
              {message.subject}
            </span>
            <span className="text-[#5f6368] font-normal">
              {' '}
              — {message.body}
            </span>
          </p>
        </div>

        {/* Right: Type badge, Attachment/Comment counts, and Date */}
        <div className="flex items-center gap-2.5 pl-6 md:pl-0 shrink-0">
          <span className="hidden lg:inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#f1f3f4] text-[#5f6368]">
            {INBOX_TYPE_LABELS[message.type]}
          </span>

          {message.commentCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-[#5f6368] font-medium"
              title="Comentários"
            >
              <MessageSquare size={12} /> {message.commentCount}
            </span>
          )}

          {message.attachmentCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-[#5f6368] font-medium"
              title="Anexos"
            >
              <Paperclip size={12} /> {message.attachmentCount}
            </span>
          )}

          <span
            className={`hidden md:inline-block text-[11px] tabular-nums w-28 text-right ${
              isUnread ? 'font-bold text-[#1f1f1f]' : 'font-medium text-[#5f6368]'
            }`}
          >
            {formatDateTime(message.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
};
