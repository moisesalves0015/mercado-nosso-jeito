import React from 'react';
import { Flame, MailOpen, ShieldAlert, UserCheck } from 'lucide-react';
import type { QuickFilter } from '../types';

interface InboxSummaryBarProps {
  kpis: {
    unread: number;
    critical: number;
    awaitingReply: number;
    awaitingDecision: number;
  };
  activeFilter: QuickFilter;
  onSelectFilter: (filter: QuickFilter) => void;
}

export const InboxSummaryBar: React.FC<InboxSummaryBarProps> = ({
  kpis,
  activeFilter,
  onSelectFilter,
}) => {
  const items: Array<{
    id: QuickFilter;
    label: string;
    value: number;
    icon: React.ReactNode;
    dotClass: string;
    activeClass: string;
  }> = [
    {
      id: 'unread',
      label: 'Não lidas',
      value: kpis.unread,
      icon: <MailOpen size={13} className="text-[#2563eb]" />,
      dotClass: 'bg-[#2563eb]',
      activeClass: 'bg-[#eef5ff] border-[#bfdbfe] text-[#1d4ed8]',
    },
    {
      id: 'critical',
      label: 'Críticas',
      value: kpis.critical,
      icon: <Flame size={13} className="text-[#c2414b]" />,
      dotClass: 'bg-[#c2414b]',
      activeClass: 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]',
    },
    {
      id: 'awaiting_my_reply',
      label: 'Aguard. resposta',
      value: kpis.awaitingReply,
      icon: <UserCheck size={13} className="text-[#b7791f]" />,
      dotClass: 'bg-[#b7791f]',
      activeClass: 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]',
    },
    {
      id: 'awaiting_decision',
      label: 'Aguard. decisão',
      value: kpis.awaitingDecision,
      icon: <ShieldAlert size={13} className="text-[#6d28d9]" />,
      dotClass: 'bg-[#6d28d9]',
      activeClass: 'bg-[#f5f3ff] border-[#ddd6fe] text-[#5b21b6]',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Resumo operacional">
      {items.map((item) => {
        const isSelected = activeFilter === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectFilter(isSelected ? 'all' : item.id)}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isSelected
                ? `${item.activeClass} font-semibold shadow-2xs`
                : 'bg-white border-[#e3e7ec] text-[#5b6573] hover:bg-[#f1f4f7] hover:text-[#17202a]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums ${
                isSelected
                  ? 'bg-white/80 text-current'
                  : 'bg-[#f1f4f7] text-[#17202a]'
              }`}
            >
              {item.value}
            </span>
          </button>
        );
      })}
    </div>
  );
};
