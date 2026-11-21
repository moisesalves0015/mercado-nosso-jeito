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
  PenSquare,
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
  group: 'primary' | 'origin' | 'workflow';
}

const FOLDER_ITEMS: FolderItem[] = [
  { id: 'all', label: 'Caixa de entrada', icon: <Inbox size={15} />, group: 'primary' },
  { id: 'unread', label: 'Não lidas', icon: <MailOpen size={15} />, group: 'primary' },
  { id: 'important', label: 'Importantes', icon: <Star size={15} />, group: 'primary' },
  { id: 'critical', label: 'Críticas', icon: <Flame size={15} />, group: 'primary' },
  { id: 'human', label: 'Humanas', icon: <Users size={15} />, group: 'origin' },
  { id: 'system_agent', label: 'Automáticas', icon: <Bot size={15} />, group: 'origin' },
  { id: 'to_me', label: 'Para mim', icon: <UserCheck size={15} />, group: 'origin' },
  { id: 'to_all', label: 'Para todos', icon: <Users size={15} />, group: 'origin' },
  { id: 'awaiting_my_reply', label: 'Aguard. resposta', icon: <Clock size={15} />, group: 'workflow' },
  { id: 'awaiting_decision', label: 'Aguard. decisão', icon: <CheckCircle2 size={15} />, group: 'workflow' },
  { id: 'task_suggestion', label: 'Tarefas sugeridas', icon: <Check size={15} />, group: 'workflow' },
  { id: 'alert', label: 'Alertas', icon: <AlertTriangle size={15} />, group: 'workflow' },
  { id: 'insight', label: 'Insights', icon: <Sparkles size={15} />, group: 'workflow' },
  { id: 'approved', label: 'Aprovadas', icon: <CheckCircle2 size={15} />, group: 'workflow' },
  { id: 'rejected', label: 'Rejeitadas', icon: <XCircle size={15} />, group: 'workflow' },
  { id: 'resolved', label: 'Resolvidas', icon: <Check size={15} />, group: 'workflow' },
  { id: 'archived', label: 'Arquivadas', icon: <Archive size={15} />, group: 'workflow' },
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
    const groups: Array<{ key: FolderItem['group']; label: string }> = [
      { key: 'primary', label: 'Caixa' },
      { key: 'origin', label: 'Origem & Destino' },
      { key: 'workflow', label: 'Fluxo & Status' },
    ];

    return (
      <div className="space-y-3">
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

        <nav aria-label="Pastas da Inbox" className="space-y-3">
          {groups.map((grp) => {
            const items = FOLDER_ITEMS.filter((i) => i.group === grp.key);
            return (
              <div key={grp.key} className="space-y-0.5">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#838e9b]">
                  {grp.label}
                </div>
                {items.map((item) => {
                  const isSelected = activeFilter === item.id;
                  const count = counts[item.id];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectFilter(item.id)}
                      aria-current={isSelected ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-full text-[13px] transition-colors ${
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
              </div>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Pastas e filtros da Inbox"
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
