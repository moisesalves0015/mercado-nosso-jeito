import React from 'react';
import { Bot, Flame, Inbox, Users } from 'lucide-react';

export type InboxCategoryTab = 'all' | 'human' | 'system_agent' | 'critical';

interface InboxSummaryBarProps {
  counts: {
    all: number;
    human: number;
    systemAgent: number;
    critical: number;
  };
  activeTab: InboxCategoryTab;
  onSelectTab: (tab: InboxCategoryTab) => void;
}

export const InboxSummaryBar: React.FC<InboxSummaryBarProps> = ({
  counts,
  activeTab,
  onSelectTab,
}) => {
  const tabs: Array<{
    id: InboxCategoryTab;
    label: string;
    value: number;
    icon: React.ReactNode;
    accentColor: string;
  }> = [
    {
      id: 'all',
      label: 'Todas',
      value: counts.all,
      icon: <Inbox size={15} />,
      accentColor: 'text-[#167a52] border-[#167a52]',
    },
    {
      id: 'human',
      label: 'Humanas',
      value: counts.human,
      icon: <Users size={15} />,
      accentColor: 'text-[#1967d2] border-[#1967d2]',
    },
    {
      id: 'system_agent',
      label: 'Automáticas',
      value: counts.systemAgent,
      icon: <Bot size={15} />,
      accentColor: 'text-[#6d28d9] border-[#6d28d9]',
    },
    {
      id: 'critical',
      label: 'Críticas',
      value: counts.critical,
      icon: <Flame size={15} />,
      accentColor: 'text-[#c2414b] border-[#c2414b]',
    },
  ];

  return (
    <div
      className="flex items-center overflow-x-auto border-b border-[#eceff4] bg-white px-2"
      role="tablist"
      aria-label="Categorias de mensagens"
    >
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectTab(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              isSelected
                ? `${tab.accentColor} font-semibold bg-[#f8fafc]/60`
                : 'border-transparent text-[#5f6368] hover:text-[#1f1f1f] hover:bg-[#f6f8fc]'
            }`}
          >
            <span className={isSelected ? 'opacity-100' : 'opacity-75'}>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.value > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                  isSelected
                    ? 'bg-[#e8f0fe] text-[#1967d2]'
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
