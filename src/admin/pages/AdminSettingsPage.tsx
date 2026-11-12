import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, Save, Settings, Trash2, Truck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData, type ShippingSettings, type StoreSettings } from '../AdminDataContext';
import { formatCurrency, PageHeader } from '../components/AdminUi';

export const AdminSettingsPage: React.FC = () => {
  const { canAny } = useAuth();
  const {
    storeSettings,
    shippingSettings,
    actionLoading,
    saveStoreSettings,
    saveShippingSettings,
  } = useAdminData();

  const [storeForm, setStoreForm] = useState<StoreSettings>(storeSettings);
  const [shipForm, setShipForm] = useState<ShippingSettings>(shippingSettings);
  const [newCondoName, setNewCondoName] = useState('');
  const [newCondoFee, setNewCondoFee] = useState(5);

  const canEdit = canAny(['configuracoes:edit', 'configuracoes:admin']);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoreForm(storeSettings);
  }, [storeSettings]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShipForm(shippingSettings);
  }, [shippingSettings]);

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveStoreSettings(storeForm);
  };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveShippingSettings(shipForm);
  };

  const handleAddCondo = () => {
    const name = newCondoName.trim();
    if (!name) return;
    setShipForm((prev) => ({
      ...prev,
      condos: {
        ...(prev.condos || {}),
        [name]: Math.max(0, Number(newCondoFee)),
      },
    }));
    setNewCondoName('');
  };

  const handleRemoveCondo = (name: string) => {
    setShipForm((prev) => {
      const nextCondos = { ...(prev.condos || {}) };
      delete nextCondos[name];
      return { ...prev, condos: nextCondos };
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações Operacionais da Loja"
        subtitle="Dados de recebimento Pix exibidos no checkout, canais de atendimento ao morador e política de frete por condomínio."
        badge="Parâmetros"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Store & Pix Settings */}
        <form
          onSubmit={handleStoreSubmit}
          className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 sm:p-6 space-y-4 h-fit"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--adm-border)]">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--adm-text)]">
                Recebimento Pix & Atendimento
              </h2>
              <p className="text-xs text-[var(--adm-text-muted)]">
                Informações oficiais apresentadas aos moradores durante a compra
              </p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                Chave Pix Oficial (CNPJ / E-mail / Telefone / Aleatória)
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={storeForm.pixKey || ''}
                onChange={(e) => setStoreForm({ ...storeForm, pixKey: e.target.value })}
                placeholder="Ex: pix@mercadonossojeito.com.br"
                className="adm-input w-full px-3.5 py-2.5 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Nome do Favorecido Pix
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={storeForm.pixName || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, pixName: e.target.value })}
                  placeholder="Mercado Nosso Jeito Ltda"
                  className="adm-input w-full px-3.5 py-2"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Instituição / Banco
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={storeForm.pixBank || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, pixBank: e.target.value })}
                  placeholder="Ex: Banco Inter / Cora"
                  className="adm-input w-full px-3.5 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  WhatsApp de Plantão do Condomínio
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={storeForm.storePhone || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, storePhone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="adm-input w-full px-3.5 py-2 tabular-nums"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                  Horário de Atendimento Operacional
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={storeForm.supportHours || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, supportHours: e.target.value })}
                  placeholder="Seg a Sáb • 08h às 22h"
                  className="adm-input w-full px-3.5 py-2"
                />
              </div>
            </div>
          </div>

          {canEdit && (
            <button
              type="submit"
              disabled={actionLoading === 'save-store'}
              className="w-full py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center justify-center gap-2"
            >
              <Save size={15} />
              {actionLoading === 'save-store'
                ? 'Salvando...'
                : 'Salvar Dados de Pix e Atendimento'}
            </button>
          )}
        </form>

        {/* Shipping & Condos Settings */}
        <form
          onSubmit={handleShippingSubmit}
          className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 sm:p-6 space-y-4 h-fit"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--adm-border)]">
            <div className="w-9 h-9 rounded-lg bg-[var(--adm-gold-soft)] text-[var(--adm-gold)] border border-[var(--adm-gold-border)] flex items-center justify-center">
              <Truck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--adm-text)]">
                Política de Frete & Condomínios
              </h2>
              <p className="text-xs text-[var(--adm-text-muted)]">
                Valores validados no servidor pela Cloud Function createOrder
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                Frete Grátis Acima de (R$)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                disabled={!canEdit}
                value={shipForm.freeShippingThreshold}
                onChange={(e) =>
                  setShipForm({
                    ...shipForm,
                    freeShippingThreshold: Math.max(0, Number(e.target.value)),
                  })
                }
                className="adm-input w-full px-3.5 py-2 font-bold tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[var(--adm-text-muted)] mb-1">
                Taxa Padrão de Entrega (R$)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                disabled={!canEdit}
                value={shipForm.baseShippingFee}
                onChange={(e) =>
                  setShipForm({
                    ...shipForm,
                    baseShippingFee: Math.max(0, Number(e.target.value)),
                  })
                }
                className="adm-input w-full px-3.5 py-2 font-bold tabular-nums"
              />
            </div>
          </div>

          {/* Per-condo custom fees */}
          <div className="space-y-2.5 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
              <Settings size={13} />
              Taxas Específicas por Condomínio ({Object.keys(shipForm.condos || {}).length})
            </div>

            {canEdit && (
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="text"
                  value={newCondoName}
                  onChange={(e) => setNewCondoName(e.target.value)}
                  placeholder="Nome do Condomínio..."
                  className="adm-input flex-1 min-w-0 px-3 py-1.5 text-xs"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newCondoFee}
                  onChange={(e) => setNewCondoFee(Number(e.target.value))}
                  className="adm-input w-24 px-3 py-1.5 text-xs tabular-nums"
                />
                <button
                  type="button"
                  onClick={handleAddCondo}
                  className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-gold)] border border-[var(--adm-border)] text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Plus size={13} />
                  Adicionar
                </button>
              </div>
            )}

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {Object.entries(shipForm.condos || {}).map(([condo, fee]) => (
                <div
                  key={condo}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] text-xs"
                >
                  <span className="font-semibold text-[var(--adm-text)]">{condo}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-300 tabular-nums">
                      {Number(fee) === 0 ? 'Frete Grátis' : formatCurrency(Number(fee))}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCondo(condo)}
                        className="text-rose-300 hover:text-rose-200 p-1"
                        aria-label={`Remover condomínio ${condo}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canEdit && (
            <button
              type="submit"
              disabled={actionLoading === 'save-shipping'}
              className="w-full py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center justify-center gap-2"
            >
              <Save size={15} />
              {actionLoading === 'save-shipping'
                ? 'Salvando...'
                : 'Salvar Regras de Frete'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
