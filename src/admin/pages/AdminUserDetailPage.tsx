import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  CheckCircle2,
  KeyRound,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import {
  DEFAULT_ROLES,
  DEFAULT_ROLES_BY_ID,
  MODULE_LABELS,
  MODULES,
  permissionsAllow,
} from '../permissions';
import { useAdminData } from '../AdminDataContext';
import { EmptyState, PageHeader, RoleBadge } from '../components/AdminUi';
import type { StaffMemberItem } from './AdminUsersPage';

export const AdminUserDetailPage: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const { user, staffAccess, can } = useAuth();
  const { showToast } = useAdminData();

  const [member, setMember] = useState<StaffMemberItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState('operacoes');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const canManage = can('usuarios:admin');

  const loadMember = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const fn = httpsCallable<unknown, { staff: StaffMemberItem[] }>(functions, 'adminListStaff');
      const res = await fn({});
      const found = (res.data.staff || []).find((s) => s.uid === uid) || null;
      setMember(found);
      if (found) setNewRole(found.roleId);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMember();
  }, [loadMember]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[var(--adm-text-muted)]">
        Carregando ficha de governança do membro...
      </div>
    );
  }

  if (!member) {
    return (
      <EmptyState
        icon={<ShieldCheck size={24} />}
        title="Membro da equipe não encontrado"
        description={`Não há atribuição de equipe para o UID #${uid}.`}
        action={
          <Link
            to="/admin/users"
            className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 font-bold text-xs"
          >
            Voltar para Equipe
          </Link>
        }
      />
    );
  }

  const roleDef = DEFAULT_ROLES_BY_ID[member.roleId];
  const perms = roleDef ? roleDef.permissions : [];
  const isSelf = member.uid === user?.uid;

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 4) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'adminAssignRole');
      await fn({
        targetUid: member.uid,
        roleId: newRole,
        reason: reason.trim(),
      });
      showToast('Papel atualizado e auditado com sucesso!', 'ok');
      setReason('');
      await loadMember();
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Erro ao alterar papel.', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={member.name || member.email || member.uid}
        subtitle={`UID: ${member.uid} • E-mail: ${member.email || '—'}`}
        backTo="/admin/users"
        backLabel="Voltar para Equipe & Acessos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge roleId={member.roleId} status={member.status} />
            <Link
              to={`/admin/audit?entityId=${encodeURIComponent(member.uid)}`}
              className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] border border-[var(--adm-border)] inline-flex items-center gap-1.5"
            >
              <ScrollText size={14} />
              Auditoria deste Membro
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Role Change Form */}
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4 h-fit">
          <h2 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
            <KeyRound size={17} className="text-[var(--adm-gold)]" />
            Alterar Papel Atribuído
          </h2>
          {isSelf ? (
            <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
              Por segurança (proteção anti-lockout), você não pode rebaixar ou alterar seu próprio papel.
            </p>
          ) : !canManage ? (
            <p className="text-xs text-[var(--adm-text-muted)]">
              Você possui acesso somente leitura às atribuições da equipe.
            </p>
          ) : (
            <form onSubmit={handleChangeRole} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Novo Papel
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="adm-input w-full px-3 py-2 font-semibold"
                >
                  {DEFAULT_ROLES.filter(
                    (r) => r.id !== 'superadmin' || staffAccess.isSuperadmin,
                  ).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Justificativa Auditada *
                </label>
                <textarea
                  rows={2}
                  required
                  minLength={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo da mudança de função..."
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold"
              >
                {saving ? 'Salvando...' : 'Atualizar Papel com Auditoria'}
              </button>
            </form>
          )}
        </div>

        {/* Right 2 Columns: Effective Permissions by Module */}
        <div className="lg:col-span-2 bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[var(--adm-text)]">
              Escopo Efetivo de Permissões ({roleDef?.label || member.roleId})
            </h2>
            <p className="text-xs text-[var(--adm-text-muted)]">
              {roleDef?.description || 'Permissões ativas para este papel no backend e frontend.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULES.map((mod) => {
              const canView = permissionsAllow(perms, `${mod}:view`);
              const canEdit = permissionsAllow(perms, `${mod}:edit`);
              const canApprove = permissionsAllow(perms, `${mod}:approve`);
              const canAdmin = permissionsAllow(perms, `${mod}:admin`);
              const hasAny = canView || canEdit || canApprove || canAdmin;

              return (
                <div
                  key={mod}
                  className={`p-3 rounded-lg border text-xs ${
                    hasAny
                      ? 'bg-[var(--adm-bg-subtle)] border-[var(--adm-border)] text-[var(--adm-text)]'
                      : 'bg-[var(--adm-bg)] border-[var(--adm-border)]/50 text-[var(--adm-text-dim)]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>{MODULE_LABELS[mod]}</span>
                    {hasAny && <CheckCircle2 size={13} className="text-emerald-300" />}
                  </div>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {canView && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--adm-surface-elevated)] text-[var(--adm-text-muted)] border border-[var(--adm-border)]">
                        Visualizar
                      </span>
                    )}
                    {canEdit && (
                      <span className="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-200 border border-teal-500/30">
                        Editar
                      </span>
                    )}
                    {canApprove && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                        Aprovar
                      </span>
                    )}
                    {canAdmin && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)]">
                        Admin Total
                      </span>
                    )}
                    {!hasAny && <span>Sem acesso</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
