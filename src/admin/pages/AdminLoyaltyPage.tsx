import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Gift, Save, Sparkles } from 'lucide-react';
import { db } from '../../firebase';
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
      await setDoc(
        doc(db, 'configs', 'roleta'),
        {
          active: roletaActive,
          dailyLimit: Number(roletaLimit),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      showToast('Configurações da Roleta Premiável salvas!', 'ok');
    } catch {
      showToast('Erro ao salvar configurações da Roleta.', 'err');
    } finally {
      setSavingRoleta(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fidelidade, Clube VIP & Roleta"
        subtitle="Gerencie missões de diamantes, catálogo de resgates e regras da roleta diária de prêmios."
        badge="Gamificação"
        actions={
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'clube' }, { replace: true })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'clube'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles size={14} />
              Clube VIP & Missões
            </button>
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'roleta' }, { replace: true })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'roleta'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
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
          className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 max-w-xl shadow-lg space-y-5"
        >
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Gift size={18} className="text-amber-400" />
              Parâmetros da Roleta Diária
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Controle a disponibilidade da roleta para os moradores e o limite diário de giros por conta.
            </p>
          </div>

          <label className="flex items-center justify-between p-4 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-white">Roleta Ativa no App</div>
              <div className="text-[11px] text-slate-400">
                Quando desativada, o widget da roleta fica oculto na tela inicial.
              </div>
            </div>
            <input
              type="checkbox"
              checked={roletaActive}
              disabled={!canEdit}
              onChange={(e) => setRoletaActive(e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500"
            />
          </label>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
              Limite Diário de Giros por Morador
            </label>
            <input
              type="number"
              min={1}
              max={10}
              disabled={!canEdit}
              value={roletaLimit}
              onChange={(e) => setRoletaLimit(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-sm text-white font-bold"
            />
          </div>

          {canEdit && (
            <button
              type="submit"
              disabled={savingRoleta}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2"
            >
              <Save size={15} />
              {savingRoleta ? 'Salvando...' : 'Salvar Configuração da Roleta'}
            </button>
          )}
        </form>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-lg">
          <AdminClube />
        </div>
      )}
    </div>
  );
};

