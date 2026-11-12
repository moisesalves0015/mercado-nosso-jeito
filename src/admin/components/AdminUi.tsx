/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  Shield,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { timestampToDate } from '../../utils/adminAnalytics';
import { getRoleLabel } from '../permissions';

export function formatCurrency(value: number | undefined | null): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateTime(ts: unknown): string {
  const d = timestampToDate(ts);
  if (!d) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function maskCpf(cpf: string | undefined | null, reveal = false): string {
  if (!cpf) return 'Não informado';
  if (reveal) return cpf;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  badge?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, badge, backTo, backLabel = 'Voltar', actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
    <div>
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors mb-2"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{title}</h1>
        {badge && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs sm:text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
  </div>
);

export const MetricCard: React.FC<{
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone?: 'amber' | 'emerald' | 'indigo' | 'rose' | 'sky';
  to?: string;
}> = ({ label, value, subtitle, icon, tone = 'indigo', to }) => {
  const toneClasses: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
  };

  const content = (
    <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all h-full flex flex-col justify-between shadow-lg">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-xl sm:text-2xl font-black text-white tracking-tight">{value}</div>
        {subtitle && <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-2xl">
        {content}
      </Link>
    );
  }
  return content;
};

export const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending: {
      label: 'Pendente',
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: <Clock size={12} />,
    },
    confirmed: {
      label: 'Confirmado',
      cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      icon: <CheckCircle2 size={12} />,
    },
    preparing: {
      label: 'Em Preparo',
      cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      icon: <RefreshCw size={12} />,
    },
    delivering: {
      label: 'Em Rota',
      cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      icon: <Truck size={12} />,
    },
    delivered: {
      label: 'Entregue',
      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      icon: <CheckCircle2 size={12} />,
    },
    cancelled: {
      label: 'Cancelado',
      cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      icon: <XCircle size={12} />,
    },
  };
  const cfg = map[status] ?? {
    label: status || 'Desconhecido',
    cls: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: <Clock size={12} />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

export const PaymentStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: 'Pago / Conciliado', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    awaiting_confirmation: { label: 'Aguardando Pix', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    on_delivery: { label: 'Pagar na Entrega', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    pending: { label: 'Pendente', cls: 'bg-slate-800 text-slate-300 border-slate-700' },
    rejected: { label: 'Rejeitado / Cancelado', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  };
  const cfg = map[status || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const TicketStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Aberto', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    in_progress: { label: 'Em Atendimento', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    waiting_customer: { label: 'Aguard. Morador', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
    resolved: { label: 'Resolvido', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    archived: { label: 'Arquivado', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  };
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-800 text-slate-300 border-slate-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const map: Record<string, { label: string; cls: string }> = {
    low: { label: 'Baixa', cls: 'bg-slate-800 text-slate-300 border-slate-700' },
    medium: { label: 'Média', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    high: { label: 'Alta', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    urgent: { label: 'Urgente', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  };
  const cfg = map[priority] ?? map.medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const RoleBadge: React.FC<{ roleId?: string | null; status?: string }> = ({ roleId, status }) => {
  const isSuper = roleId === 'superadmin';
  const isSuspended = status === 'suspended' || status === 'archived';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
        isSuspended
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : isSuper
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
      }`}
    >
      <Shield size={12} />
      {getRoleLabel(roleId)}
      {isSuspended && ` (${status === 'suspended' ? 'Suspenso' : 'Arquivado'})`}
    </span>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto my-4">
    {icon && (
      <div className="w-12 h-12 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
        {icon}
      </div>
    )}
    <h3 className="text-base font-bold text-white mb-1">{title}</h3>
    <p className="text-xs sm:text-sm text-slate-400 mb-5 leading-relaxed">{description}</p>
    {action && <div>{action}</div>}
  </div>
);

export const ReasonConfirmModal: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar Ação',
  danger = false,
  requireReason = true,
  reasonPlaceholder = 'Descreva o motivo para registro na trilha de auditoria...',
  loading = false,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason('');
      setErr('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (requireReason && trimmed.length < 4) {
      setErr('Informe um motivo válido (mínimo de 4 caracteres) para auditoria.');
      return;
    }
    setErr('');
    await onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-confirm-title"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                danger
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 id="modal-confirm-title" className="text-base font-bold text-white">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">{description}</p>

        <form onSubmit={handleSubmit}>
          {requireReason && (
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Motivo / Justificativa Auditada *
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none px-3.5 py-2.5 text-sm text-white placeholder-slate-500"
                autoFocus
              />
              {err && <p className="text-xs text-rose-400 mt-1.5 font-semibold">{err}</p>}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                danger
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {loading && <RefreshCw size={13} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
