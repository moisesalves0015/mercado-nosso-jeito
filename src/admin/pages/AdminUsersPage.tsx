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
    <div className="space-y-6">
      <PageHeader
        title="Equipe & Controle de Acessos (RBAC)"
        subtitle="Gerencie membros da equipe, atribua papéis granulares e suspenda/arquive acessos de forma reversível e auditada."
        badge={`${staff.length} membros`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/roles"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
            >
              <KeyRound size={15} />
              Matriz de Papéis
            </Link>
            <button
              type="button"
              onClick={fetchStaff}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Recarregar lista"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManageStaff && (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors"
              >
                <UserPlus size={15} />
                Atribuir Papel a Membro
              </button>
            )}
          </div>
        }
      />

      {/* Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === tab.id
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
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
                className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/users/${m.uid}`}
                          className="text-sm font-extrabold text-white hover:text-amber-400 truncate"
                        >
                          {m.name || m.email || m.uid}
                        </Link>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-amber-300">
                            Você
                          </span>
                        )}
                        {m.legacy && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                            Legado (Migrar)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{m.email || 'Sem e-mail'}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">UID: {m.uid}</div>
                    </div>

                    <RoleBadge roleId={m.roleId} status={m.status} />
                  </div>

                  {m.notes && (
                    <p className="text-xs text-slate-300 mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      {m.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canModifyThisMember && m.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({ member: m, nextStatus: 'suspended' })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <PauseCircle size={13} />
                          Suspender
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({ member: m, nextStatus: 'archived' })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold inline-flex items-center gap-1"
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
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} />
                        Restaurar Acesso
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/admin/users/${m.uid}`}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Plus size={18} className="text-amber-400" />
                Atribuir ou Alterar Papel da Equipe
              </h3>
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  E-mail ou UID do Usuário *
                </label>
                <input
                  type="text"
                  required
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="operador@loja.com ou UID..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Papel RBAC *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-bold"
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
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Motivo para Trilha de Auditoria *
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Ex: Contratação para turno noturno de separação"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Observações Internas (Opcional)
                </label>
                <input
                  type="text"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Turno, condomínio alocado..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold"
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
