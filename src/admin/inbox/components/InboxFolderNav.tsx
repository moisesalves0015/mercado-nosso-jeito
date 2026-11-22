import React from 'react';
import {
  Archive,
  Check,
  CheckCircle2,
  Inbox,
  Loader2,
  MailOpen,
  PenSquare,
  RefreshCw,
  Star,
} from 'lucide-react';
import type { QuickFilter } from '../types';

interface FolderItem {
  id: QuickFilter;
  label: string;
  icon: React.ReactNode;
}

const FOLDER_ITEMS: FolderItem[] = [
  { id: 'all', label: 'Caixa de entrada', icon: <Inbox size={14} /> },
  { id: 'unread', label: 'Não lidas', icon: <MailOpen size={14} /> },
  { id: 'important', label: 'Importantes', icon: <Star size={14} /> },
  { id: 'awaiting_decision', label: 'Aguard. decisão', icon: <CheckCircle2 size={14} /> },
  { id: 'resolved', label: 'Resolvidas', icon: <Check size={14} /> },
  { id: 'archived', label: 'Arquivadas', icon: <Archive size={14} /> },
];

interface InboxFolderNavProps {
  activeFilter: QuickFilter;
  onSelectFilter: (filter: QuickFilter) => void;
  counts?: Partial<Record<QuickFilter, number>>;
  variant?: 'sidebar' | 'tabs';
  canCreate?: boolean;
  canRefresh?: boolean;
  refreshBusy?: boolean;
  onCompose?: () => void;
  onRefresh?: () => void;
}

export const InboxFolderNav: React.FC<InboxFolderNavProps> = ({
  activeFilter,
  onSelectFilter,
  counts = {},
  variant = 'tabs',
  canCreate = false,
  canRefresh = false,
  refreshBusy = false,
  onCompose,
  onRefresh,
}) => {
  if (variant === 'sidebar') {
    return (
      <div className="space-y-2.5">
        {(canCreate || canRefresh) && (
          <div className="flex items-center gap-1.5">
            {canCreate && onCompose && (
              <button
                type="button"
                onClick={onCompose}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#167a52] hover:bg-[#106441] text-white shadow-2xs transition-colors"
              >
                <PenSquare size={14} />
                <span>Escrever</span>
              </button>
            )}
            {canRefresh && onRefresh && (
              <button
                type="button"
                disabled={refreshBusy}
                onClick={onRefresh}
                title="Atualizar / Executar agentes"
                aria-label="Atualizar caixa e executar agentes"
                className="p-2 rounded-xl bg-white hover:bg-[#f1f3f4] text-[#444746] border border-[#dadce0] disabled:opacity-50 transition-colors shrink-0"
              >
                {refreshBusy ? (
                  <Loader2 size={14} className="animate-spin text-[#167a52]" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </button>
            )}
          </div>
        )}

        <nav aria-label="Pastas da Inbox" className="space-y-0.5">
          {FOLDER_ITEMS.map((item) => {
            const isSelected = activeFilter === item.id;
            const count = counts[item.id];

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectFilter(item.id)}
                aria-current={isSelected ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  isSelected
                    ? 'bg-[#e8f0fe] text-[#1967d2] font-semibold'
                    : 'text-[#444746] hover:bg-[#eaebef] hover:text-[#1f1f1f] font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
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
      className="flex items-center gap-1 overflow-x-auto"
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition-colors ${
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
                className={`text-[10px] px-1 rounded-full tabular-nums font-semibold ${
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
