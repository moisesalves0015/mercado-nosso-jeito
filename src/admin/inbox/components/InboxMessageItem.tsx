import React, { useRef, useState } from 'react';
import { Archive, Bot, Loader2, MessageSquare, Paperclip, Pin, Star, Trash2 } from 'lucide-react';
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

const LEFT_SWIPE_OPEN_X = -148;
const RIGHT_SWIPE_TRIGGER_X = 68;
const MAX_RIGHT_SWIPE_X = 96;

interface InboxMessageItemProps {
  message: AdminInboxMessage;
  isSelected: boolean;
  isUnread: boolean;
  currentUid: string;
  canArchive?: boolean;
  canPin?: boolean;
  busyLabel?: string;
  onSelect: () => void;
  onArchive?: (message: AdminInboxMessage) => void;
  onDelete?: (message: AdminInboxMessage) => void;
  onTogglePin?: (message: AdminInboxMessage, nextPinned: boolean) => void;
}

export const InboxMessageItem: React.FC<InboxMessageItemProps> = ({
  message,
  isSelected,
  isUnread,
  currentUid,
  canArchive = false,
  canPin = true,
  busyLabel,
  onSelect,
  onArchive,
  onDelete,
  onTogglePin,
}) => {
  const agent = message.agentId ? SYSTEM_AGENTS_BY_ID[message.agentId] : undefined;
  const isStarred = Boolean(message.starredBy?.[currentUid]);
  const isPinned = Boolean(message.pinnedBy?.[currentUid]);

  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const dragStartRef = useRef<{
    x: number;
    y: number;
    baseOffset: number;
    pointerId: number;
    moved: boolean;
    lockedAxis: 'h' | 'v' | null;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      baseOffset: offsetX,
      pointerId: e.pointerId,
      moved: false,
      lockedAxis: null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!start.lockedAxis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        start.lockedAxis = 'v';
        return;
      }
      start.lockedAxis = 'h';
      start.moved = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(start.pointerId);
      } catch {
        /* ignore capture errors */
      }
    }

    if (start.lockedAxis !== 'h') return;

    let next = start.baseOffset + dx;
    if (!canArchive && next < 0) next = 0;
    if (!canPin && next > 0) next = 0;
    next = Math.max(LEFT_SWIPE_OPEN_X - 24, Math.min(MAX_RIGHT_SWIPE_X, next));
    setOffsetX(next);
  };

  const finishDrag = () => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start) return;

    setDragging(false);
    if (start.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 150);
    }

    if (canPin && offsetX >= RIGHT_SWIPE_TRIGGER_X) {
      setOffsetX(0);
      onTogglePin?.(message, !isPinned);
      return;
    }

    if (canArchive && offsetX <= -48) {
      setOffsetX(LEFT_SWIPE_OPEN_X);
      return;
    }

    setOffsetX(0);
  };

  const handleRowClick = () => {
    if (suppressClickRef.current) return;
    if (offsetX !== 0) {
      setOffsetX(0);
      return;
    }
    onSelect();
  };

  return (
    <div className="relative overflow-hidden border-b border-[#eceff4] last:border-b-0 select-none">
      {/* Right-swipe background: Fixar / Desafixar */}
      {canPin && offsetX > 0 && (
        <div
          className={`absolute inset-y-0 left-0 flex items-center px-4 text-white text-xs font-semibold transition-colors ${
            offsetX >= RIGHT_SWIPE_TRIGGER_X ? 'bg-[#d97706]' : 'bg-[#f59e0b]'
          }`}
          style={{ width: `${Math.max(offsetX + 12, 80)}px` }}
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Pin size={14} className={isPinned ? 'fill-white' : ''} />
            {isPinned ? 'Desafixar' : 'Fixar'}
          </span>
        </div>
      )}

      {/* Left-swipe background: Arquivar e Excluir */}
      {canArchive && offsetX < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: `${Math.abs(LEFT_SWIPE_OPEN_X)}px` }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOffsetX(0);
              onArchive?.(message);
            }}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-[#1967d2] hover:bg-[#1557b0] text-white text-[11px] font-semibold transition-colors"
            title={message.status === 'archived' ? 'Desarquivar' : 'Arquivar'}
          >
            <Archive size={14} />
            <span>{message.status === 'archived' ? 'Restaurar' : 'Arquivar'}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOffsetX(0);
              onDelete?.(message);
            }}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[11px] font-semibold transition-colors"
            title="Excluir mensagem"
          >
            <Trash2 size={14} />
            <span>Excluir</span>
          </button>
        </div>
      )}

      {/* Foreground swipeable row */}
      <div
        role="option"
        tabIndex={0}
        aria-selected={isSelected}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: dragging ? 'none' : 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className={`w-full text-left px-3 py-2 cursor-pointer relative group touch-pan-y ${
          busyLabel ? 'opacity-65 pointer-events-none' : ''
        } ${
          isSelected
            ? 'bg-[#e8f0fe]'
            : isPinned
            ? 'bg-[#fffbeb]/70 hover:bg-[#fef3c7]/60'
            : isUnread
            ? 'bg-white hover:bg-[#f5f8fd] hover:shadow-[inset_0_-1px_0_#dadce0]'
            : 'bg-[#f9fafb] hover:bg-[#f2f4f8]'
        }`}
      >
        {/* Subtle left bar for unread or pinned */}
        {(isUnread || isPinned) && (
          <span
            className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r ${
              isPinned ? 'bg-[#d97706]' : 'bg-[#1a73e8]'
            }`}
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

          {isPinned && (
            <Pin
              size={12}
              className="shrink-0 text-[#d97706] fill-[#d97706]"
              aria-label="Fixada"
            />
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

        {/* Right: Type badge, Busy indicator, Attachment/Comment counts, and Date */}
        <div className="flex items-center gap-2.5 pl-6 md:pl-0 shrink-0">
          {busyLabel ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e8f0fe] text-[#1967d2]">
              <Loader2 size={10} className="animate-spin" />
              {busyLabel}
            </span>
          ) : (
            <span className="hidden lg:inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#f1f3f4] text-[#5f6368]">
              {INBOX_TYPE_LABELS[message.type]}
            </span>
          )}

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
      </div>
    </div>
  );
};
