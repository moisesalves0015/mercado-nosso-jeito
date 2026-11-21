import React from 'react';
import {
  AlertTriangle,
  Archive,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  MailOpen,
  Sparkles,
  Star,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type { QuickFilter } from '../types';

interface FolderItem {
  id: QuickFilter;
  label: string;
  icon: React.ReactNode;
}

const FOLDER_ITEMS: FolderItem[] = [
  { id: 'all', label: 'Caixa de entrada', icon: <Inbox size={15} /> },
  { id: 'unread', label: 'Não lidas', icon: <MailOpen size={15} /> },
  { id: 'important', label: 'Importantes', icon: <Star size={15} /> },
  { id: 'critical', label: 'Críticas', icon: <Flame size={15} /> },
  { id: 'human', label: 'Humanas', icon: <Users size={15} /> },
  { id: 'system_agent', label: 'Automáticas', icon: <Bot size={15} /> },
  { id: 'to_me', label: 'Para mim', icon: <UserCheck size={15} /> },
  { id: 'to_all', label: 'Para todos', icon: <Users size={15} /> },
  { id: 'awaiting_my_reply', label: 'Aguard. resposta', icon: <Clock size={15} /> },
  { id: 'awaiting_decision', label: 'Aguard. decisão', icon: <CheckCircle2 size={15} /> },
  { id: 'task_suggestion', label: 'Tarefas sugeridas', icon: <Check size={15} /> },
  { id: 'alert', label: 'Alertas', icon: <AlertTriangle size={15} /> },
  { id: 'insight', label: 'Insights', icon: <Sparkles size={15} /> },
  { id: 'approved', label: 'Aprovadas', icon: <CheckCircle2 size={15} /> },
  { id: 'rejected', label: 'Rejeitadas', icon: <XCircle size={15} /> },
  { id: 'resolved', label: 'Resolvidas', icon: <Check size={15} /> },
  { id: 'archived', label: 'Arquivadas', icon: <Archive size={15} /> },
];

interface InboxFolderNavProps {
  activeFilter: QuickFilter;
  onSelectFilter: (filter: QuickFilter) => void;
  counts?: Partial<Record<QuickFilter, number>>;
  variant?: 'sidebar' | 'tabs';
}

export const InboxFolderNav: React.FC<InboxFolderNavProps> = ({
  activeFilter,
  onSelectFilter,
  counts = {},
  variant = 'tabs',
}) => {
  if (variant === 'sidebar') {
    return (
      <nav
        aria-label="Pastas da Inbox"
        className="bg-white border border-[#e3e7ec] rounded-xl p-2 space-y-0.5 shadow-2xs"
      >
        <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#838e9b]">
          Pastas
        </div>
        {FOLDER_ITEMS.map((item) => {
          const isSelected = activeFilter === item.id;
          const count = counts[item.id];

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectFilter(item.id)}
              aria-current={isSelected ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                isSelected
                  ? 'bg-[#eef5ff] text-[#1d4ed8] font-semibold'
                  : 'text-[#5b6573] hover:bg-[#f1f4f7] hover:text-[#17202a] font-medium'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className={isSelected ? 'text-[#2563eb]' : 'text-[#838e9b]'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold shrink-0 ${
                    isSelected
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-[#f1f4f7] text-[#5b6573]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Pastas e filtros da Inbox"
      className="flex items-center gap-1.5 overflow-x-auto pb-1.5"
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
              isSelected
                ? 'bg-[#eef5ff] text-[#1d4ed8] border-[#bfdbfe] font-semibold'
                : 'bg-white text-[#5b6573] border-[#e3e7ec] hover:text-[#17202a] hover:bg-[#f1f4f7]'
            }`}
          >
            <span className={isSelected ? 'text-[#2563eb]' : 'text-[#838e9b]'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {typeof count === 'number' && count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold ${
                  isSelected
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-[#f1f4f7] text-[#5b6573]'
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
