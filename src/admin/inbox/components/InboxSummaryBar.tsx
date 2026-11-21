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
    sublabel: string;
    value: number;
    icon: React.ReactNode;
    tone: 'sky' | 'rose' | 'amber' | 'indigo';
  }> = [
    {
      id: 'unread',
      label: 'Não Lidas',
      sublabel: 'Para sua leitura',
      value: kpis.unread,
      icon: <MailOpen size={16} />,
      tone: 'sky',
    },
    {
      id: 'critical',
      label: 'Críticas Abertas',
      sublabel: 'Prioridade máxima',
      value: kpis.critical,
      icon: <Flame size={16} />,
      tone: 'rose',
    },
    {
      id: 'awaiting_my_reply',
      label: 'Aguard. Resposta',
      sublabel: 'Direcionadas a você',
      value: kpis.awaitingReply,
      icon: <UserCheck size={16} />,
      tone: 'amber',
    },
    {
      id: 'awaiting_decision',
      label: 'Aguard. Decisão',
      sublabel: 'Aprovações & propostas',
      value: kpis.awaitingDecision,
      icon: <ShieldAlert size={16} />,
      tone: 'indigo',
    },
  ];

  const toneClasses: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    sky: {
      bg: 'hover:bg-sky-500/10 active:bg-sky-500/15',
      text: 'text-sky-300',
      border: 'border-sky-500/25',
      badge: 'bg-sky-500/15 text-sky-200',
    },
    rose: {
      bg: 'hover:bg-rose-500/10 active:bg-rose-500/15',
      text: 'text-rose-300',
      border: 'border-rose-500/25',
      badge: 'bg-rose-500/15 text-rose-200',
    },
    amber: {
      bg: 'hover:bg-amber-500/10 active:bg-amber-500/15',
      text: 'text-amber-300',
      border: 'border-amber-500/25',
      badge: 'bg-amber-500/15 text-amber-200',
    },
    indigo: {
      bg: 'hover:bg-teal-500/10 active:bg-teal-500/15',
      text: 'text-teal-300',
      border: 'border-teal-500/25',
      badge: 'bg-teal-500/15 text-teal-200',
    },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {items.map((item) => {
        const isSelected = activeFilter === item.id;
        const tone = toneClasses[item.tone];

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectFilter(isSelected ? 'all' : item.id)}
            className={`group text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 ${
              isSelected
                ? 'bg-[var(--adm-surface-elevated)] border-[var(--adm-gold-border)] shadow-sm'
                : 'bg-[var(--adm-surface)] border-[var(--adm-border)] hover:border-[var(--adm-border-strong)] ' +
                  tone.bg
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`${tone.text} shrink-0`}>{item.icon}</span>
                <span className="text-[11px] font-semibold tracking-wide uppercase text-[var(--adm-text-muted)] truncate">
                  {item.label}
                </span>
              </div>
              <p className="text-[11px] text-[var(--adm-text-dim)] truncate">{item.sublabel}</p>
            </div>
            <div
              className={`text-lg font-bold tabular-nums px-2.5 py-1 rounded-lg border ${
                isSelected
                  ? 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border-[var(--adm-gold-border)]'
                  : 'bg-[var(--adm-bg)] text-[var(--adm-text)] border-[var(--adm-border)]'
              }`}
            >
              {item.value}
            </div>
          </button>
        );
      })}
    </div>
  );
};
