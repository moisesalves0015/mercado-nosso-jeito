import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  Archive,
  CheckCircle2,
  Eye,
  KeyRound,
  PauseCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { DEFAULT_ROLES } from '../permissions';
import { useAdminData } from '../AdminDataContext';
import {
  EmptyState,
  PageHeader,
  ReasonConfirmModal,
  RoleBadge,
} from '../components/AdminUi';

export interface StaffMemberItem {
  uid: string;
  name?: string | null;
  email?: string | null;
  roleId: string;
  status: 'active' | 'suspended' | 'archived';
  legacy: boolean;
  notes?: string | null;
  assignedBy?: string | null;
}

export const AdminUsersPage: React.FC = () => {
  const { user, staffAccess, can } = useAuth();
  const { showToast } = useAdminData();

  const [staff, setStaff] = useState<StaffMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'archived'>('all');

  // Assign Role Modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('operacoes');
  const [assignReason, setAssignReason] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Status Change Modal (suspend / archive / restore)
  const [statusModal, setStatusModal] = useState<{
    member: StaffMemberItem;
    nextStatus: 'active' | 'suspended' | 'archived';
  } | null>(null);

  const canManageStaff = can('usuarios:admin');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const fn = httpsCallable<unknown, { staff: StaffMemberItem[] }>(functions, 'adminListStaff');
      const res = await fn({});
      setStaff(res.data.staff || []);
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Erro ao carregar equipe.', 'err');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStaff();
  }, [fetchStaff]);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = targetInput.trim();
    if (!trimmed || assignReason.trim().length < 4) return;
    setSubmitting(true);
    try {
      const fn = httpsCallable(functions, 'adminAssignRole');
      const isEmail = trimmed.includes('@');
      await fn({
        targetUid: isEmail ? undefined : trimmed,
        targetEmail: isEmail ? trimmed : undefined,
        roleId: selectedRole,
        reason: assignReason.trim(),
        notes: assignNotes.trim() || undefined,
      });
      showToast('Papel administrativo atribuído e auditado com sucesso!', 'ok');
      setAssignOpen(false);
      setTargetInput('');
      setAssignReason('');
      setAssignNotes('');
      await fetchStaff();
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Erro ao atribuir papel.', 'err');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staff.filter((m) =>
    statusFilter === 'all' ? true : m.status === statusFilter,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Equipe & Controle de Acessos (RBAC)"
        subtitle="Gerencie membros da equipe, atribua papéis granulares e suspenda/arquive acessos de forma reversível e auditada."
        badge={`${staff.length} membros`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/roles"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)]"
            >
              <KeyRound size={15} />
              Matriz de Papéis
            </Link>
            <button
              type="button"
              onClick={fetchStaff}
              className="p-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]"
              title="Recarregar lista"
              aria-label="Recarregar lista"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManageStaff && (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors"
              >
                <UserPlus size={15} />
                Atribuir Papel a Membro
              </button>
            )}
          </div>
        }
      />

      {/* Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todos os Membros' },
          { id: 'active', label: 'Ativos' },
          { id: 'suspended', label: 'Suspensos' },
          { id: 'archived', label: 'Arquivados' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                : 'bg-[var(--adm-surface)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--adm-text-muted)]">
          Consultando atribuições de acesso no servidor...
        </div>
      ) : filteredStaff.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={24} />}
          title="Nenhum membro encontrado neste filtro"
          description="Use o botão 'Atribuir Papel a Membro' para conceder acesso administrativo ou operacional."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStaff.map((m) => {
            const isSelf = m.uid === user?.uid;
            const isTargetSuper = m.roleId === 'superadmin';
            const canModifyThisMember =
              canManageStaff && !isSelf && (!isTargetSuper || staffAccess.isSuperadmin);

            return (
              <div
                key={m.uid}
                className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/admin/users/${m.uid}`}
                          className="text-sm font-bold text-[var(--adm-text)] hover:text-[var(--adm-gold)] truncate"
                        >
                          {m.name || m.email || m.uid}
                        </Link>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-md bg-[var(--adm-gold-soft)] border border-[var(--adm-gold-border)] text-[10px] font-bold text-[var(--adm-gold)]">
                            Você
                          </span>
                        )}
                        {m.legacy && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-[10px] font-bold text-amber-200 border border-amber-500/30">
                            Legado (Migrar)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--adm-text-muted)] truncate">
                        {m.email || 'Sem e-mail'}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--adm-text-dim)] mt-0.5">
                        UID: {m.uid}
                      </div>
                    </div>

                    <RoleBadge roleId={m.roleId} status={m.status} />
                  </div>

                  {m.notes && (
                    <p className="text-xs text-[var(--adm-text-muted)] mt-3 p-2.5 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)]">
                      {m.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--adm-border)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canModifyThisMember && m.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({ member: m, nextStatus: 'suspended' })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <PauseCircle size={13} />
                          Suspender
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({ member: m, nextStatus: 'archived' })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Archive size={13} />
                          Arquivar
                        </button>
                      </>
                    )}

                    {canModifyThisMember && m.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() =>
                          setStatusModal({ member: m, nextStatus: 'active' })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} />
                        Restaurar Acesso
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/admin/users/${m.uid}`}
                    className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] border border-[var(--adm-border)] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Eye size={13} />
                    Detalhes & Permissões
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Role Modal */}
      {assignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border-strong)] rounded-[10px] max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
                <Plus size={18} className="text-[var(--adm-gold)]" />
                Atribuir ou Alterar Papel da Equipe
              </h3>
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] p-1 rounded-md"
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  E-mail ou UID do Usuário *
                </label>
                <input
                  type="text"
                  required
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="operador@loja.com ou UID..."
                  className="adm-input w-full px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Papel RBAC *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="adm-input w-full px-3 py-2 font-semibold"
                >
                  {DEFAULT_ROLES.filter(
                    (r) => r.id !== 'superadmin' || staffAccess.isSuperadmin,
                  ).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} — {r.description.slice(0, 55)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Motivo para Trilha de Auditoria *
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Ex: Contratação para turno noturno de separação"
                  className="adm-input w-full px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Observações Internas (Opcional)
                </label>
                <input
                  type="text"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Turno, condomínio alocado..."
                  className="adm-input w-full px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-[var(--adm-text-muted)] font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold"
                >
                  {submitting ? 'Salvando...' : 'Confirmar Papel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Confirm Modal */}
      <ReasonConfirmModal
        open={Boolean(statusModal)}
        title={
          statusModal?.nextStatus === 'active'
            ? `Restaurar Acesso — ${statusModal.member.name || statusModal.member.uid}`
            : statusModal?.nextStatus === 'suspended'
            ? `Suspender Acesso — ${statusModal?.member.name || statusModal?.member.uid}`
            : `Arquivar Membro — ${statusModal?.member.name || statusModal?.member.uid}`
        }
        description={
          statusModal?.nextStatus === 'active'
            ? 'O membro voltará a ter acesso ativo às rotas do seu papel.'
            : 'As sessões ativas serão revogadas imediatamente e o acesso administrativo será bloqueado sem apagar o histórico.'
        }
        confirmLabel="Confirmar Alteração"
        danger={statusModal?.nextStatus !== 'active'}
        loading={submitting}
        onClose={() => setStatusModal(null)}
        onConfirm={async (reason) => {
          if (!statusModal) return;
          setSubmitting(true);
          try {
            const fn = httpsCallable(functions, 'adminSetStaffStatus');
            await fn({
              targetUid: statusModal.member.uid,
              status: statusModal.nextStatus,
              reason,
            });
            showToast('Status do membro atualizado e registrado na auditoria!', 'ok');
            setStatusModal(null);
            await fetchStaff();
          } catch (err: unknown) {
            showToast((err as { message?: string })?.message || 'Erro ao alterar status.', 'err');
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
};
