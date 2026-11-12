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
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--adm-border)]">
    <div className="min-w-0">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-gold)] transition-colors mb-2"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--adm-text)] tracking-tight">
          {title}
        </h1>
        {badge && (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)]">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs sm:text-sm text-[var(--adm-text-muted)] mt-1">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const MetricCard: React.FC<{
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone?: 'amber' | 'emerald' | 'indigo' | 'rose' | 'sky';
  to?: string;
}> = ({ label, value, subtitle, icon, tone = 'emerald', to }) => {
  const toneClasses: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    indigo: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    sky: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  };

  const content = (
    <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] hover:border-[var(--adm-border-strong)] rounded-[10px] p-4 sm:p-5 transition-colors h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
            toneClasses[tone] ?? toneClasses.emerald
          }`}
        >
          {icon}
        </div>
      </div>
      <div>
        <div className="text-xl sm:text-2xl font-extrabold text-[var(--adm-text)] tracking-tight tabular-nums">
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-[var(--adm-text-dim)] mt-1 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-[10px] focus-visible:outline-2 focus-visible:outline-[var(--adm-brand)]"
      >
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
      cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
      icon: <Clock size={12} />,
    },
    confirmed: {
      label: 'Confirmado',
      cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
      icon: <CheckCircle2 size={12} />,
    },
    preparing: {
      label: 'Em Preparo',
      cls: 'bg-teal-500/15 text-teal-200 border-teal-500/30',
      icon: <RefreshCw size={12} />,
    },
    delivering: {
      label: 'Em Rota',
      cls: 'bg-lime-500/15 text-lime-200 border-lime-500/30',
      icon: <Truck size={12} />,
    },
    delivered: {
      label: 'Entregue',
      cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
      icon: <CheckCircle2 size={12} />,
    },
    cancelled: {
      label: 'Cancelado',
      cls: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
      icon: <XCircle size={12} />,
    },
  };
  const cfg = map[status] ?? {
    label: status || 'Desconhecido',
    cls: 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border-[var(--adm-border)]',
    icon: <Clock size={12} />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

export const PaymentStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: 'Pago / Conciliado', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
    awaiting_confirmation: { label: 'Aguardando Pix', cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30' },
    on_delivery: { label: 'Pagar na Entrega', cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30' },
    pending: { label: 'Pendente', cls: 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border-[var(--adm-border)]' },
    rejected: { label: 'Rejeitado / Cancelado', cls: 'bg-rose-500/15 text-rose-200 border-rose-500/30' },
  };
  const cfg = map[status || 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const TicketStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Aberto', cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30' },
    in_progress: { label: 'Em Atendimento', cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30' },
    waiting_customer: { label: 'Aguard. Morador', cls: 'bg-teal-500/15 text-teal-200 border-teal-500/30' },
    resolved: { label: 'Resolvido', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
    archived: { label: 'Arquivado', cls: 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-dim)] border-[var(--adm-border)]' },
  };
  const cfg = map[status] ?? {
    label: status,
    cls: 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border-[var(--adm-border)]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const map: Record<string, { label: string; cls: string }> = {
    low: { label: 'Baixa', cls: 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border-[var(--adm-border)]' },
    medium: { label: 'Média', cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30' },
    high: { label: 'Alta', cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30' },
    urgent: { label: 'Urgente', cls: 'bg-rose-500/20 text-rose-200 border-rose-500/40' },
  };
  const cfg = map[priority] ?? map.medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const RoleBadge: React.FC<{ roleId?: string | null; status?: string }> = ({ roleId, status }) => {
  const isSuper = roleId === 'superadmin';
  const isSuspended = status === 'suspended' || status === 'archived';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
        isSuspended
          ? 'bg-rose-500/15 text-rose-200 border-rose-500/30'
          : isSuper
          ? 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border-[var(--adm-gold-border)]'
          : 'bg-[var(--adm-brand-soft)] text-emerald-200 border-[var(--adm-brand-border)]'
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
  <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-8 sm:p-10 text-center max-w-lg mx-auto my-4">
    {icon && (
      <div className="w-11 h-11 rounded-lg bg-[var(--adm-surface-elevated)] border border-[var(--adm-border)] flex items-center justify-center mx-auto mb-3 text-[var(--adm-text-muted)]">
        {icon}
      </div>
    )}
    <h3 className="text-base font-bold text-[var(--adm-text)] mb-1">{title}</h3>
    <p className="text-xs sm:text-sm text-[var(--adm-text-muted)] mb-5 leading-relaxed">
      {description}
    </p>
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onClose]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-confirm-title"
    >
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border-strong)] rounded-[10px] max-w-md w-full p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                danger
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)]'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <h3 id="modal-confirm-title" className="text-base font-bold text-[var(--adm-text)]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] p-1 rounded-md"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[var(--adm-text-muted)] mb-4 leading-relaxed">
          {description}
        </p>

        <form onSubmit={handleSubmit}>
          {requireReason && (
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                Motivo / Justificativa Auditada *
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="adm-input w-full px-3 py-2 text-sm placeholder-[var(--adm-text-dim)]"
                autoFocus
              />
              {err && <p className="text-xs text-rose-300 mt-1.5 font-semibold">{err}</p>}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                danger
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950'
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
