import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Gift, Save, Sparkles } from 'lucide-react';
import { db, functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { AdminClube } from '../../pages/AdminClube';
import { useAdminData } from '../AdminDataContext';
import { PageHeader } from '../components/AdminUi';

export const AdminLoyaltyPage: React.FC = () => {
  const { canAny } = useAuth();
  const { showToast } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'clube';

  const [roletaActive, setRoletaActive] = useState(true);
  const [roletaLimit, setRoletaLimit] = useState(1);
  const [savingRoleta, setSavingRoleta] = useState(false);

  const canEdit = canAny(['clube:edit', 'marketing:edit', 'clube:admin']);

  useEffect(() => {
    getDoc(doc(db, 'configs', 'roleta'))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setRoletaActive(d.active ?? true);
          setRoletaLimit(d.dailyLimit ?? 1);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveRoleta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRoleta(true);
    try {
      const fn = httpsCallable(functions, 'adminUpdateLoyaltyConfig');
      await fn({
        payload: {
          active: roletaActive,
          dailyLimit: Number(roletaLimit),
        },
      });
      showToast('Configurações da Roleta Premiável salvas!', 'ok');
    } catch {
      showToast('Erro ao salvar configurações da Roleta.', 'err');
    } finally {
      setSavingRoleta(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fidelidade, Clube VIP & Roleta"
        subtitle="Gerencie missões de diamantes, catálogo de resgates e regras da roleta diária de prêmios."
        badge="Gamificação"
        actions={
          <div className="flex items-center gap-1.5 bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'clube' }, { replace: true })}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'clube'
                  ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                  : 'text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]'
              }`}
            >
              <Sparkles size={14} />
              Clube VIP & Missões
            </button>
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'roleta' }, { replace: true })}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'roleta'
                  ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                  : 'text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]'
              }`}
            >
              <Gift size={14} />
              Roleta Premiável
            </button>
          </div>
        }
      />

      {activeTab === 'roleta' ? (
        <form
          onSubmit={handleSaveRoleta}
          className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 sm:p-6 max-w-xl space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
              <Gift size={18} className="text-[var(--adm-gold)]" />
              Parâmetros da Roleta Diária
            </h2>
            <p className="text-xs text-[var(--adm-text-muted)] mt-1">
              Controle a disponibilidade da roleta para os moradores e o limite diário de giros por conta.
            </p>
          </div>

          <label className="flex items-center justify-between p-4 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] cursor-pointer">
            <div>
              <div className="text-xs font-bold text-[var(--adm-text)]">Roleta Ativa no App</div>
              <div className="text-[11px] text-[var(--adm-text-muted)]">
                Quando desativada, o widget da roleta fica oculto na tela inicial.
              </div>
            </div>
            <input
              type="checkbox"
              checked={roletaActive}
              disabled={!canEdit}
              onChange={(e) => setRoletaActive(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
          </label>

          <div>
            <label className="block text-xs font-bold uppercase text-[var(--adm-text-muted)] mb-1.5">
              Limite Diário de Giros por Morador
            </label>
            <input
              type="number"
              min={1}
              max={10}
              disabled={!canEdit}
              value={roletaLimit}
              onChange={(e) => setRoletaLimit(Math.max(1, Number(e.target.value)))}
              className="adm-input w-full px-3.5 py-2 text-sm font-bold tabular-nums"
            />
          </div>

          {canEdit && (
            <button
              type="submit"
              disabled={savingRoleta}
              className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center gap-2"
            >
              <Save size={15} />
              {savingRoleta ? 'Salvando...' : 'Salvar Configuração da Roleta'}
            </button>
          )}
        </form>
      ) : (
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 sm:p-6">
          <AdminClube />
        </div>
      )}
    </div>
  );
};

