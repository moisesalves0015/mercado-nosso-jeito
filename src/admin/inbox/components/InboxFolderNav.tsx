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
  countKey?: string;
}

const FOLDER_ITEMS: FolderItem[] = [
  { id: 'all', label: 'Todas', icon: <Inbox size={13} /> },
  { id: 'unread', label: 'Não lidas', icon: <MailOpen size={13} /> },
  { id: 'critical', label: 'Críticas', icon: <Flame size={13} /> },
  { id: 'important', label: 'Importantes', icon: <Star size={13} /> },
  { id: 'human', label: 'Humanas', icon: <Users size={13} /> },
  { id: 'system_agent', label: 'Automáticas', icon: <Bot size={13} /> },
  { id: 'to_me', label: 'Para mim', icon: <UserCheck size={13} /> },
  { id: 'to_all', label: 'Para todos', icon: <Users size={13} /> },
  { id: 'awaiting_my_reply', label: 'Aguard. resposta', icon: <Clock size={13} /> },
  { id: 'awaiting_decision', label: 'Aguard. decisão', icon: <CheckCircle2 size={13} /> },
  { id: 'alert', label: 'Alertas', icon: <AlertTriangle size={13} /> },
  { id: 'insight', label: 'Insights', icon: <Sparkles size={13} /> },
  { id: 'task_suggestion', label: 'Tarefas sugeridas', icon: <Check size={13} /> },
  { id: 'approved', label: 'Aprovadas', icon: <CheckCircle2 size={13} /> },
  { id: 'rejected', label: 'Rejeitadas', icon: <XCircle size={13} /> },
  { id: 'resolved', label: 'Resolvidas', icon: <Check size={13} /> },
  { id: 'archived', label: 'Arquivadas', icon: <Archive size={13} /> },
];

interface InboxFolderNavProps {
  activeFilter: QuickFilter;
  onSelectFilter: (filter: QuickFilter) => void;
  counts?: Partial<Record<QuickFilter, number>>;
}

export const InboxFolderNav: React.FC<InboxFolderNavProps> = ({
  activeFilter,
  onSelectFilter,
  counts = {},
}) => {
  return (
    <div
      role="tablist"
      aria-label="Pastas e filtros da Inbox"
      className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-[var(--adm-border)]"
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all duration-150 ${
              isSelected
                ? 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border-[var(--adm-gold-border)] font-semibold shadow-xs'
                : 'bg-[var(--adm-bg)] text-[var(--adm-text-muted)] border-[var(--adm-border)] hover:text-[var(--adm-text)] hover:border-[var(--adm-border-strong)]'
            }`}
          >
            <span className={isSelected ? 'text-[var(--adm-gold)]' : 'text-[var(--adm-text-dim)]'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {typeof count === 'number' && count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold ${
                  isSelected
                    ? 'bg-[var(--adm-gold)] text-[#09120e]'
                    : 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-dim)] border border-[var(--adm-border)]'
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
