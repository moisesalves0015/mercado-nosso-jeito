import React from 'react';
import {
  Archive,
  Check,
  CheckCircle2,
  Inbox,
  MailOpen,
  PenSquare,
  Star,
} from 'lucide-react';
import type { QuickFilter } from '../types';

interface FolderItem {
  id: QuickFilter;
  label: string;
  icon: React.ReactNode;
}

const FOLDER_ITEMS: FolderItem[] = [
  { id: 'all', label: 'Caixa de entrada', icon: <Inbox size={16} /> },
  { id: 'unread', label: 'Não lidas', icon: <MailOpen size={16} /> },
  { id: 'important', label: 'Importantes', icon: <Star size={16} /> },
  { id: 'awaiting_decision', label: 'Aguard. decisão', icon: <CheckCircle2 size={16} /> },
  { id: 'resolved', label: 'Resolvidas', icon: <Check size={16} /> },
  { id: 'archived', label: 'Arquivadas', icon: <Archive size={16} /> },
];

interface InboxFolderNavProps {
  activeFilter: QuickFilter;
  onSelectFilter: (filter: QuickFilter) => void;
  counts?: Partial<Record<QuickFilter, number>>;
  variant?: 'sidebar' | 'tabs';
  canCreate?: boolean;
  onCompose?: () => void;
}

export const InboxFolderNav: React.FC<InboxFolderNavProps> = ({
  activeFilter,
  onSelectFilter,
  counts = {},
  variant = 'tabs',
  canCreate = false,
  onCompose,
}) => {
  if (variant === 'sidebar') {
    return (
      <div className="space-y-4">
        {canCreate && onCompose && (
          <button
            type="button"
            onClick={onCompose}
            className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl text-[13px] font-semibold bg-[#167a52] hover:bg-[#106441] text-white shadow-sm hover:shadow transition-all"
          >
            <PenSquare size={16} />
            <span>Escrever</span>
          </button>
        )}

        <nav aria-label="Pastas da Inbox" className="space-y-1">
          {FOLDER_ITEMS.map((item) => {
            const isSelected = activeFilter === item.id;
            const count = counts[item.id];

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectFilter(item.id)}
                aria-current={isSelected ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-full text-[13px] transition-colors ${
                  isSelected
                    ? 'bg-[#e8f0fe] text-[#1967d2] font-semibold'
                    : 'text-[#444746] hover:bg-[#eaebef] hover:text-[#1f1f1f] font-medium'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className={isSelected ? 'text-[#1967d2]' : 'text-[#5f6368]'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof count === 'number' && count > 0 && (
                  <span
                    className={`text-[11px] tabular-nums font-semibold shrink-0 ${
                      isSelected ? 'text-[#1967d2]' : 'text-[#5f6368]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Pastas da Inbox"
      className="flex items-center gap-1.5 overflow-x-auto pb-1"
    >
      {FOLDER_ITEMS.map((item) => {
        const isSelected = activeFilter === item.id;
        const count = counts[item.id];

        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isSelected}
            type="button"
            onClick={() => onSelectFilter(item.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              isSelected
                ? 'bg-[#e8f0fe] text-[#1967d2] border-[#d2e3fc] font-semibold'
                : 'bg-white text-[#444746] border-[#e3e7ec] hover:bg-[#f1f3f4]'
            }`}
          >
            <span className={isSelected ? 'text-[#1967d2]' : 'text-[#5f6368]'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {typeof count === 'number' && count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold ${
                  isSelected
                    ? 'bg-[#1967d2] text-white'
                    : 'bg-[#f1f3f4] text-[#5f6368]'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
