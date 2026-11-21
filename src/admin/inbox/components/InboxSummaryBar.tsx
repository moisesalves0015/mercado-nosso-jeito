import React from 'react';
import { Flame, Inbox, MailOpen, ShieldAlert, UserCheck } from 'lucide-react';
import type { QuickFilter } from '../types';

interface InboxSummaryBarProps {
  kpis: {
    unread: number;
    critical: number;
    awaitingReply: number;
    awaitingDecision: number;
  };
  totalCount?: number;
  activeFilter: QuickFilter;
  onSelectFilter: (filter: QuickFilter) => void;
}

export const InboxSummaryBar: React.FC<InboxSummaryBarProps> = ({
  kpis,
  totalCount,
  activeFilter,
  onSelectFilter,
}) => {
  const tabs: Array<{
    id: QuickFilter;
    label: string;
    value?: number;
    icon: React.ReactNode;
    accentColor: string;
  }> = [
    {
      id: 'all',
      label: 'Principal',
      value: totalCount,
      icon: <Inbox size={15} />,
      accentColor: 'text-[#167a52] border-[#167a52]',
    },
    {
      id: 'unread',
      label: 'Não lidas',
      value: kpis.unread,
      icon: <MailOpen size={15} />,
      accentColor: 'text-[#2563eb] border-[#2563eb]',
    },
    {
      id: 'critical',
      label: 'Críticas',
      value: kpis.critical,
      icon: <Flame size={15} />,
      accentColor: 'text-[#c2414b] border-[#c2414b]',
    },
    {
      id: 'awaiting_my_reply',
      label: 'Aguard. resposta',
      value: kpis.awaitingReply,
      icon: <UserCheck size={15} />,
      accentColor: 'text-[#b7791f] border-[#b7791f]',
    },
    {
      id: 'awaiting_decision',
      label: 'Aguard. decisão',
      value: kpis.awaitingDecision,
      icon: <ShieldAlert size={15} />,
      accentColor: 'text-[#6d28d9] border-[#6d28d9]',
    },
  ];

  return (
    <div
      className="flex items-center overflow-x-auto border-b border-[#e3e7ec] bg-white px-2"
      role="tablist"
      aria-label="Categorias principais da caixa de entrada"
    >
      {tabs.map((tab) => {
        const isSelected = activeFilter === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectFilter(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              isSelected
                ? `${tab.accentColor} font-semibold bg-[#f8fafc]/60`
                : 'border-transparent text-[#5f6368] hover:text-[#1f1f1f] hover:bg-[#f6f8fc]'
            }`}
          >
            <span className={isSelected ? 'opacity-100' : 'opacity-75'}>{tab.icon}</span>
            <span>{tab.label}</span>
            {typeof tab.value === 'number' && tab.value > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                  isSelected
                    ? 'bg-[#e8f0fe] text-[#1a73e8]'
                    : 'bg-[#f1f3f4] text-[#5f6368]'
                }`}
              >
                {tab.value}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
