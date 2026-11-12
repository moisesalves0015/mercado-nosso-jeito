import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  Check,
  Database,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import {
  ACTION_LABELS,
  ACTIONS,
  DEFAULT_ROLES,
  MODULE_LABELS,
  MODULES,
  permissionsAllow,
  type RoleDefinition,
} from '../permissions';
import { useAdminData } from '../AdminDataContext';
import { PageHeader, ReasonConfirmModal } from '../components/AdminUi';

export const AdminRolesPage: React.FC = () => {
  const { can } = useAuth();
  const { showToast } = useAdminData();

  const [roles, setRoles] = useState<RoleDefinition[]>(() => [...DEFAULT_ROLES]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('operacoes');
  const [customRoleId, setCustomRoleId] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [editedPerms, setEditedPerms] = useState<string[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canManageRoles = can('usuarios:admin');

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const fn = httpsCallable<unknown, { roles: RoleDefinition[] }>(functions, 'adminListRoles');
      const res = await fn({});
      if (res.data.roles && res.data.roles.length > 0) {
        setRoles(res.data.roles);
      }
    } catch {
      // Fallback to DEFAULT_ROLES already loaded
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoles();
  }, [fetchRoles]);

  const currentRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  useEffect(() => {
    if (!isCreatingNew && currentRole) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabel(currentRole.label);
      setDescription(currentRole.description || '');
      setEditedPerms([...currentRole.permissions]);
    }
  }, [currentRole, isCreatingNew]);

  const togglePermission = (perm: string) => {
    if (!canManageRoles || (!isCreatingNew && selectedRoleId === 'superadmin')) return;
    setEditedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const startNewRole = () => {
    setIsCreatingNew(true);
    setCustomRoleId('');
    setLabel('');
    setDescription('');
    setEditedPerms(['dashboard:view']);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Papéis & Matriz de Permissões (RBAC)"
        subtitle="Inspecione e customize permissões por módulo e ação. Alterações são versionadas e auditadas."
        badge={`${roles.length} papéis`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
            >
              <ShieldCheck size={15} />
              Equipe & Acessos
            </Link>
            {canManageRoles && (
              <>
                <button
                  type="button"
                  onClick={() => setSeedModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700"
                  title="Inicializar catálogo de papéis no Firestore de forma aditiva"
                >
                  <Database size={14} />
                  Sincronizar Catálogo Base
                </button>
                <button
                  type="button"
                  onClick={startNewRole}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs"
                >
                  <Plus size={15} />
                  Novo Papel Customizado
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Roles List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Catálogo de Papéis
            </span>
            <button
              type="button"
              onClick={fetchRoles}
              className="text-slate-400 hover:text-white p-1"
              title="Atualizar papéis"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {roles.map((r) => {
            const active = !isCreatingNew && selectedRoleId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setSelectedRoleId(r.id);
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/40 text-white shadow-md'
                    : 'bg-slate-900/80 border-slate-800/90 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-white">{r.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                    {r.id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{r.description}</p>
              </button>
            );
          })}
        </div>

        {/* Right 3 Columns: Permission Matrix */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <KeyRound size={18} className="text-amber-400" />
                {isCreatingNew
                  ? 'Criar Novo Papel Customizado'
                  : `Matriz de Permissões — ${currentRole?.label}`}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {!isCreatingNew && selectedRoleId === 'superadmin'
                  ? 'O papel Superadmin possui acesso irrestrito (*) e é imutável por segurança.'
                  : 'Marque ou desmarque as ações permitidas em cada módulo abaixo.'}
              </p>
            </div>

            {canManageRoles && (isCreatingNew || selectedRoleId !== 'superadmin') && (
              <button
                type="button"
                onClick={() => setSaveModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5 shrink-0"
              >
                <Save size={14} />
                Salvar Papel
              </button>
            )}
          </div>

          {/* Metadata inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {isCreatingNew && (
              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Identificador (slug) *
                </label>
                <input
                  type="text"
                  value={customRoleId}
                  onChange={(e) =>
                    setCustomRoleId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  placeholder="ex: supervisor_turno"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono"
                />
              </div>
            )}
            <div>
              <label className="block font-bold uppercase text-slate-400 mb-1">
                Nome de Exibição *
              </label>
              <input
                type="text"
                disabled={!canManageRoles || (!isCreatingNew && selectedRoleId === 'superadmin')}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white font-bold"
              />
            </div>
            <div className={isCreatingNew ? '' : 'sm:col-span-2'}>
              <label className="block font-bold uppercase text-slate-400 mb-1">
                Descrição Operacional
              </label>
              <input
                type="text"
                disabled={!canManageRoles || (!isCreatingNew && selectedRoleId === 'superadmin')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <th className="py-3 px-3">Módulo</th>
                  {ACTIONS.map((act) => (
                    <th key={act} className="py-3 px-2 text-center">
                      {ACTION_LABELS[act]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {MODULES.map((mod) => (
                  <tr key={mod} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                      {MODULE_LABELS[mod]}
                    </td>
                    {ACTIONS.map((act) => {
                      const perm = `${mod}:${act}`;
                      const isSuper = !isCreatingNew && selectedRoleId === 'superadmin';
                      const checked = isSuper || permissionsAllow(editedPerms, perm);

                      return (
                        <td key={act} className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            disabled={!canManageRoles || isSuper}
                            onClick={() => togglePermission(perm)}
                            aria-label={`${MODULE_LABELS[mod]} - ${ACTION_LABELS[act]}`}
                            className={`w-6 h-6 rounded-lg inline-flex items-center justify-center border transition-colors ${
                              checked
                                ? 'bg-amber-500 border-amber-400 text-slate-950'
                                : 'bg-slate-950 border-slate-800 text-transparent hover:border-slate-600'
                            }`}
                          >
                            <Check size={13} strokeWidth={3} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Save Role Modal */}
      <ReasonConfirmModal
        open={saveModalOpen}
        title={
          isCreatingNew
            ? `Criar Papel "${label || customRoleId}"`
            : `Salvar Alterações em "${label}"`
        }
        description="Toda alteração na matriz de permissões gera uma nova versão do papel e registra o diff completo na trilha de auditoria."
        confirmLabel="Salvar Papel"
        loading={submitting}
        onClose={() => setSaveModalOpen(false)}
        onConfirm={async (reason) => {
          const targetRoleId = isCreatingNew ? customRoleId.trim() : selectedRoleId;
          if (!targetRoleId || !label.trim()) return;
          setSubmitting(true);
          try {
            const fn = httpsCallable(functions, 'adminUpsertRole');
            await fn({
              roleId: targetRoleId,
              label: label.trim(),
              description: description.trim(),
              permissions: editedPerms,
              active: true,
              reason,
            });
            showToast('Papel salvo e versionado com sucesso!', 'ok');
            setSaveModalOpen(false);
            setIsCreatingNew(false);
            setSelectedRoleId(targetRoleId);
            await fetchRoles();
          } catch (err: unknown) {
            showToast((err as { message?: string })?.message || 'Erro ao salvar papel.', 'err');
          } finally {
            setSubmitting(false);
          }
        }}
      />

      {/* Seed Default Roles Modal */}
      <ReasonConfirmModal
        open={seedModalOpen}
        title="Sincronizar Catálogo Base de Papéis"
        description="Esta operação é 100% aditiva e idempotente: ela cria apenas os papéis padrão que ainda não existem na coleção 'roles' do Firestore, sem sobrescrever papéis já editados."
        confirmLabel="Aplicar Catálogo Base"
        loading={submitting}
        onClose={() => setSeedModalOpen(false)}
        onConfirm={async (reason) => {
          setSubmitting(true);
          try {
            const fn = httpsCallable<
              { dryRun: boolean; reason: string },
              { created: string[]; existing: string[] }
            >(functions, 'adminSeedRoles');
            const res = await fn({ dryRun: false, reason });
            showToast(
              `Catálogo sincronizado! Criados: ${res.data.created.length}, Preservados: ${res.data.existing.length}.`,
              'ok',
            );
            setSeedModalOpen(false);
            await fetchRoles();
          } catch (err: unknown) {
            showToast((err as { message?: string })?.message || 'Erro ao sincronizar papéis.', 'err');
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
};
