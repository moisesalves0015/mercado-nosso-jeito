import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  Archive,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Gem,
  Megaphone,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData } from '../AdminDataContext';
import { EmptyState, MetricCard, PageHeader, ReasonConfirmModal } from '../components/AdminUi';
import {
  type AdCampaignStatus,
  type AdCtaActionType,
  type AdEligibilityRule,
  type AdRewardType,
  type AssetApprovalStatus,
  CAMPAIGN_STATUS_LABEL,
  type LegacyOfferRecord,
  type SponsoredCampaignRecord,
  isSafeActionUrl,
} from '../../shared/sponsoredCampaign';

interface CampaignFormState {
  title: string;
  brand: string;
  description: string;
  category: string;
  logoUrl: string;
  bannerUrl: string;
  assetApprovalStatus: AssetApprovalStatus;
  assetLicenseNote: string;
  durationSeconds: number;
  rewardType: AdRewardType;
  rewardDiamonds: number;
  rewardCouponCode: string;
  rewardTerms: string;
  ctaLabel: string;
  ctaActionType: AdCtaActionType;
  ctaTarget: string;
  startsAt: string;
  endsAt: string;
  targetCondosText: string;
  eligibilityRule: AdEligibilityRule;
  maxClaimsPerUserPerDay: number;
  maxClaimsPerUserTotal: string;
  totalBudgetDiamonds: number;
  totalBudgetClaims: string;
  internalNotes: string;
  sponsorContact: string;
  reason: string;
}

const EMPTY_FORM: CampaignFormState = {
  title: '',
  brand: '',
  description: '',
  category: 'Parceiro Local',
  logoUrl: '',
  bannerUrl: '',
  assetApprovalStatus: 'pending_license',
  assetLicenseNote: '',
  durationSeconds: 15,
  rewardType: 'diamonds',
  rewardDiamonds: 20,
  rewardCouponCode: '',
  rewardTerms: 'Crédito em diamantes após contagem mínima no servidor.',
  ctaLabel: 'Saiba mais',
  ctaActionType: 'none',
  ctaTarget: '',
  startsAt: '',
  endsAt: '',
  targetCondosText: '',
  eligibilityRule: 'all_residents',
  maxClaimsPerUserPerDay: 1,
  maxClaimsPerUserTotal: '',
  totalBudgetDiamonds: 1000,
  totalBudgetClaims: '',
  internalNotes: '',
  sponsorContact: '',
  reason: '',
};

function toDateTimeLocal(isoOrMs: unknown): string {
  if (!isoOrMs) return '';
  const ms =
    typeof isoOrMs === 'number'
      ? isoOrMs
      : typeof isoOrMs === 'string'
        ? Date.parse(isoOrMs)
        : NaN;
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusBadge({ status }: { status: AdCampaignStatus }) {
  const styles: Record<AdCampaignStatus, string> = {
    draft: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    scheduled: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    paused: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    ended: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
    archived: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${styles[status]}`}>
      {CAMPAIGN_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export const AdminSponsoredCampaignsPage: React.FC = () => {
  const { id: routeCampaignId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { showToast } = useAdminData();

  const canCreate = can('marketing:create');
  const canEdit = can('marketing:edit');
  const canPublish = can('marketing:publish');
  const canArchive = can('marketing:archive');
  const canRestore = can('marketing:restore');

  const [campaigns, setCampaigns] = useState<SponsoredCampaignRecord[]>([]);
  const [legacyOffers, setLegacyOffers] = useState<LegacyOfferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdCampaignStatus>('all');
  const [showEditor, setShowEditor] = useState(() => routeCampaignId === 'new');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [migratingLegacyId, setMigratingLegacyId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [previewCampaign, setPreviewCampaign] = useState<CampaignFormState | null>(null);
  const [transitionModal, setTransitionModal] = useState<{
    campaign: SponsoredCampaignRecord;
    action: 'publish' | 'pause' | 'end' | 'archive' | 'restore';
  } | null>(null);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const fn = httpsCallable<unknown, { campaigns: SponsoredCampaignRecord[]; legacyOffers: LegacyOfferRecord[] }>(
        functions,
        'adminListAdCampaigns',
      );
      const res = await fn({});
      setCampaigns(res.data.campaigns ?? []);
      setLegacyOffers(res.data.legacyOffers ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar campanhas patrocinadas.', 'err');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    const fn = httpsCallable<unknown, { campaigns: SponsoredCampaignRecord[]; legacyOffers: LegacyOfferRecord[] }>(
      functions,
      'adminListAdCampaigns',
    );
    fn({})
      .then((res) => {
        if (!active) return;
        setCampaigns(res.data.campaigns ?? []);
        setLegacyOffers(res.data.legacyOffers ?? []);
      })
      .catch((err) => {
        if (!active) return;
        showToast(err instanceof Error ? err.message : 'Erro ao carregar campanhas patrocinadas.', 'err');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const openCreate = () => {
    setEditingId(null);
    setMigratingLegacyId(null);
    setForm(EMPTY_FORM);
    setShowEditor(true);
  };

  const openEdit = useCallback((c: SponsoredCampaignRecord) => {
    setEditingId(c.id);
    setMigratingLegacyId(c.migratedFromLegacyId ?? null);
    setForm({
      title: c.title ?? '',
      brand: c.brand ?? '',
      description: c.description ?? '',
      category: c.category ?? 'Parceiro Local',
      logoUrl: c.logoUrl ?? '',
      bannerUrl: c.bannerUrl ?? '',
      assetApprovalStatus: c.assetApprovalStatus ?? 'pending_license',
      assetLicenseNote: c.assetLicenseNote ?? '',
      durationSeconds: Number(c.durationSeconds ?? 15),
      rewardType: c.rewardType ?? 'diamonds',
      rewardDiamonds: Number(c.rewardDiamonds ?? 0),
      rewardCouponCode: c.rewardCouponCode ?? '',
      rewardTerms: c.rewardTerms ?? '',
      ctaLabel: c.ctaLabel ?? '',
      ctaActionType: c.ctaActionType ?? 'none',
      ctaTarget: c.ctaTarget ?? '',
      startsAt: toDateTimeLocal(c.startsAt ?? c.startsAtMs),
      endsAt: toDateTimeLocal(c.endsAt ?? c.endsAtMs),
      targetCondosText: Array.isArray(c.targetCondos) ? c.targetCondos.join(', ') : '',
      eligibilityRule: c.eligibilityRule ?? 'all_residents',
      maxClaimsPerUserPerDay: Number(c.maxClaimsPerUserPerDay ?? 1),
      maxClaimsPerUserTotal: c.maxClaimsPerUserTotal != null ? String(c.maxClaimsPerUserTotal) : '',
      totalBudgetDiamonds: Number(c.totalBudgetDiamonds ?? 0),
      totalBudgetClaims: c.totalBudgetClaims != null ? String(c.totalBudgetClaims) : '',
      internalNotes: c.internalNotes ?? '',
      sponsorContact: c.sponsorContact ?? '',
      reason: '',
    });
    setShowEditor(true);
  }, []);

  useEffect(() => {
    if (!routeCampaignId || routeCampaignId === 'new') return;
    const found = campaigns.find((c) => c.id === routeCampaignId);
    if (found && editingId !== found.id) {
      queueMicrotask(() => openEdit(found));
    }
  }, [routeCampaignId, campaigns, editingId, openEdit]);

  const openMigrateLegacy = (legacy: LegacyOfferRecord) => {
    setEditingId(null);
    setMigratingLegacyId(legacy.id);
    const isShipping = legacy.type === 'shipping';
    setForm({
      ...EMPTY_FORM,
      title: legacy.title || `${legacy.brand || 'Parceiro'} Especial`,
      brand: legacy.brand || 'Parceiro Legado',
      description: legacy.desc || 'Campanha importada do catálogo legado para revisão.',
      category: legacy.category || 'Parceiro Local',
      // Nunca aprovar automaticamente imagens remotas legadas (ex.: Unsplash) sem revisão humana
      logoUrl: legacy.logo?.startsWith('/') ? legacy.logo : '',
      bannerUrl: legacy.bannerImage?.startsWith('/') ? legacy.bannerImage : '',
      assetApprovalStatus: 'pending_license',
      assetLicenseNote: 'Migrado de premium_offers — mídia remota legada requer aprovação ou upload próprio.',
      durationSeconds: Math.max(5, Math.min(300, Number(legacy.duration ?? 15))),
      rewardType: isShipping ? 'shipping' : 'diamonds',
      rewardDiamonds: isShipping ? 0 : Math.max(1, Number(legacy.rewardVal ?? 15)),
      rewardCouponCode: isShipping ? 'FRETEPARCEIRO' : '',
      rewardTerms: isShipping
        ? 'Benefício de frete sujeito às regras vigentes da loja.'
        : 'Crédito em diamantes após contagem mínima no servidor.',
      ctaLabel: 'Saiba mais',
      ctaActionType: 'none',
      ctaTarget: '',
      internalNotes: `Migrado de premium_offers/${legacy.id} (dados originais preservados).`,
      reason: `Migração inicial do item legado ${legacy.id} para rascunho`,
    });
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.ctaActionType !== 'none' && !isSafeActionUrl(form.ctaActionType, form.ctaTarget)) {
      showToast('URL/destino do CTA inválido ou usando esquema não permitido.', 'err');
      return;
    }
    if (form.reason.trim().length < 5) {
      showToast('Informe o motivo da alteração (mínimo 5 caracteres) para trilha de auditoria.', 'err');
      return;
    }

    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'adminSaveAdCampaign');
      const targetCondos = form.targetCondosText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await fn({
        campaignId: editingId ?? undefined,
        migratedFromLegacyId: migratingLegacyId ?? undefined,
        reason: form.reason.trim(),
        payload: {
          title: form.title,
          brand: form.brand,
          description: form.description,
          category: form.category,
          logoUrl: form.logoUrl,
          bannerUrl: form.bannerUrl,
          assetApprovalStatus: form.assetApprovalStatus,
          assetLicenseNote: form.assetLicenseNote,
          durationSeconds: Number(form.durationSeconds),
          rewardType: form.rewardType,
          rewardDiamonds: form.rewardType === 'diamonds' ? Number(form.rewardDiamonds) : 0,
          rewardCouponCode:
            form.rewardType === 'coupon' || form.rewardType === 'shipping'
              ? form.rewardCouponCode.trim().toUpperCase()
              : null,
          rewardTerms: form.rewardTerms,
          ctaLabel: form.ctaLabel,
          ctaActionType: form.ctaActionType,
          ctaTarget: form.ctaTarget,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          targetCondos,
          eligibilityRule: form.eligibilityRule,
          maxClaimsPerUserPerDay: Number(form.maxClaimsPerUserPerDay),
          maxClaimsPerUserTotal: form.maxClaimsPerUserTotal ? Number(form.maxClaimsPerUserTotal) : null,
          totalBudgetDiamonds: form.rewardType === 'diamonds' ? Number(form.totalBudgetDiamonds) : 0,
          totalBudgetClaims: form.totalBudgetClaims ? Number(form.totalBudgetClaims) : null,
          internalNotes: form.internalNotes,
          sponsorContact: form.sponsorContact,
        },
      });
      showToast(editingId ? 'Campanha atualizada e auditada.' : 'Campanha criada em rascunho.', 'ok');
      setShowEditor(false);
      if (routeCampaignId) navigate('/admin/marketing/campaigns');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao salvar campanha.', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleTransitionConfirm = async (reason: string) => {
    if (!transitionModal) return;
    const { campaign, action } = transitionModal;
    try {
      const fn = httpsCallable(functions, 'adminSetAdCampaignStatus');
      await fn({ campaignId: campaign.id, action, reason });
      showToast(`Status da campanha "${campaign.title}" atualizado (${action}).`, 'ok');
      setTransitionModal(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao atualizar status.', 'err');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter !== 'all' && (c.status ?? (c.active ? 'active' : 'paused')) !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        c.title?.toLowerCase().includes(q) ||
        c.brand?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q)
      );
    });
  }, [campaigns, search, statusFilter]);

  const metrics = useMemo(() => {
    const activeCount = campaigns.filter((c) => (c.status ?? (c.active ? 'active' : 'paused')) === 'active').length;
    const totalClaims = campaigns.reduce((acc, c) => acc + Number(c.claimsCount ?? 0), 0);
    const totalSpentDiamonds = campaigns.reduce((acc, c) => acc + Number(c.spentDiamonds ?? 0), 0);
    const pendingLicense = campaigns.filter((c) => c.assetApprovalStatus === 'pending_license').length;
    return { activeCount, totalClaims, totalSpentDiamonds, pendingLicense };
  }, [campaigns]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Anúncios Patrocinados (Clube)"
        subtitle="Gerencie campanhas patrocinadas exibidas no Clube VIP com orçamento, RBAC, trilha de auditoria e controle de licença."
        badge="Clube & Patrocinadores"
        backTo="/admin/marketing"
        backLabel="Marketing & Cupons"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="px-3 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-xs font-semibold text-[var(--adm-text-muted)] inline-flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                className="px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus size={15} />
                Nova Campanha
              </button>
            )}
          </div>
        }
      />

      {/* Aviso de garantia limitada */}
      <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 text-xs text-amber-100">
        <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-200">Garantia técnica de visualização</p>
          <p className="text-amber-100/80 mt-0.5">
            Campanhas sem callback S2S de ad network operam com <strong>temporizador mínimo no servidor + idempotência + limite por usuário</strong>. Isso previne replay e farming imediato, mas não comprova atenção humana ao vídeo. Mídias marcadas como <em>Licença Pendente</em> exigem aprovação antes de operação comercial paga.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Campanhas Ativas" value={metrics.activeCount} icon={<Megaphone size={16} />} tone="emerald" />
        <MetricCard label="Resgates Confirmados" value={metrics.totalClaims} icon={<CheckCircle2 size={16} />} tone="indigo" />
        <MetricCard label="Diamantes Consumidos" value={metrics.totalSpentDiamonds} icon={<Gem size={16} />} tone="amber" />
        <MetricCard
          label="Mídias Pendentes"
          value={metrics.pendingLicense}
          icon={<ShieldAlert size={16} />}
          tone={metrics.pendingLicense > 0 ? 'rose' : 'sky'}
        />
      </div>

      {/* Filtros */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-3.5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-dim)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, marca ou categoria..."
            className="adm-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | AdCampaignStatus)}
          className="adm-input px-3 py-2 text-xs"
          aria-label="Filtrar por status"
        >
          <option value="all">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="scheduled">Agendada</option>
          <option value="active">Ativa</option>
          <option value="paused">Pausada</option>
          <option value="ended">Encerrada</option>
          <option value="archived">Arquivada</option>
        </select>
      </div>

      {/* Lista de Campanhas */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--adm-text-muted)]">Carregando campanhas...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Megaphone size={22} />}
            title="Nenhuma campanha patrocinada encontrada"
            description="Crie uma campanha em rascunho ou migre um registro legado abaixo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--adm-bg-subtle)] text-[var(--adm-text-dim)] uppercase text-[10px] tracking-wider border-b border-[var(--adm-border)]">
                <tr>
                  <th scope="col" className="px-4 py-3">Campanha / Marca</th>
                  <th scope="col" className="px-4 py-3">Recompensa</th>
                  <th scope="col" className="px-4 py-3">Orçamento / Resgates</th>
                  <th scope="col" className="px-4 py-3">Status / Licença</th>
                  <th scope="col" className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {filtered.map((c) => {
                  const status: AdCampaignStatus = c.status ?? (c.active ? 'active' : 'paused');
                  return (
                    <tr key={c.id} className="hover:bg-[var(--adm-surface-hover)]/40">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[var(--adm-text)]">{c.title}</div>
                        <div className="text-[11px] text-[var(--adm-text-muted)]">
                          {c.brand} · {c.category} · {c.durationSeconds}s · v{c.version ?? 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {c.rewardType === 'diamonds' && (
                          <span className="inline-flex items-center gap-1 font-bold text-[var(--adm-gold)]">
                            <Gem size={12} /> +{c.rewardDiamonds}
                          </span>
                        )}
                        {(c.rewardType === 'coupon' || c.rewardType === 'shipping') && (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                            <Truck size={12} /> {c.rewardCouponCode}
                          </span>
                        )}
                        {c.rewardType === 'none' && <span className="text-[var(--adm-text-dim)]">Informativo</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <div>
                          {c.rewardType === 'diamonds'
                            ? `${c.spentDiamonds ?? 0} / ${c.totalBudgetDiamonds ?? 0} 💎`
                            : 'Sem custo 💎'}
                        </div>
                        <div className="text-[11px] text-[var(--adm-text-dim)]">
                          {c.claimsCount ?? 0}
                          {c.totalBudgetClaims != null ? ` / ${c.totalBudgetClaims}` : ''} resgates
                        </div>
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <div>
                          <StatusBadge status={status} />
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)]">
                          {c.assetApprovalStatus === 'approved'
                            ? 'Mídia aprovada'
                            : c.assetApprovalStatus === 'internal_placeholder'
                              ? 'Placeholder interno'
                              : 'Licença pendente'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewCampaign({
                                ...EMPTY_FORM,
                                title: c.title,
                                brand: c.brand,
                                description: c.description,
                                category: c.category,
                                logoUrl: c.logoUrl,
                                bannerUrl: c.bannerUrl,
                                assetApprovalStatus: c.assetApprovalStatus ?? 'pending_license',
                                durationSeconds: c.durationSeconds ?? 15,
                                rewardType: c.rewardType ?? 'diamonds',
                                rewardDiamonds: c.rewardDiamonds ?? 0,
                                rewardCouponCode: c.rewardCouponCode ?? '',
                                rewardTerms: c.rewardTerms ?? '',
                                ctaLabel: c.ctaLabel ?? '',
                                ctaActionType: c.ctaActionType ?? 'none',
                                ctaTarget: c.ctaTarget ?? '',
                              })
                            }
                            className="p-1.5 rounded-md border border-[var(--adm-border)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)]"
                            title="Pré-visualizar no Clube"
                          >
                            <Eye size={14} />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              className="p-1.5 rounded-md border border-[var(--adm-border)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)]"
                              title="Editar"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                          {canPublish && status !== 'active' && status !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => setTransitionModal({ campaign: c, action: 'publish' })}
                              className="p-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                              title="Publicar"
                            >
                              <PlayCircle size={14} />
                            </button>
                          )}
                          {canPublish && status === 'active' && (
                            <button
                              type="button"
                              onClick={() => setTransitionModal({ campaign: c, action: 'pause' })}
                              className="p-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
                              title="Pausar"
                            >
                              <PauseCircle size={14} />
                            </button>
                          )}
                          {canArchive && status !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => setTransitionModal({ campaign: c, action: 'archive' })}
                              className="p-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"
                              title="Arquivar"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                          {canRestore && status === 'archived' && (
                            <button
                              type="button"
                              onClick={() => setTransitionModal({ campaign: c, action: 'restore' })}
                              className="p-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300"
                              title="Restaurar para pausada"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Migração compatível de registros legados (somente leitura) */}
      {legacyOffers.length > 0 && (
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--adm-text)]">
                Registros legados em `premium_offers` ({legacyOffers.length})
              </h3>
              <p className="text-xs text-[var(--adm-text-muted)]">
                Mantidos intactos sem exclusão. Você pode importar um item para criar um rascunho revisado em `ad_campaigns`.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {legacyOffers.map((l) => (
              <div
                key={l.id}
                className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-bg-subtle)] p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-[var(--adm-text)]">{l.title || l.brand || l.id}</div>
                  <div className="text-[11px] text-[var(--adm-text-muted)] line-clamp-2">{l.desc}</div>
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => openMigrateLegacy(l)}
                    className="self-start px-2.5 py-1 rounded-md border border-[var(--adm-brand-border)] bg-[var(--adm-brand-soft)] text-[var(--adm-brand)] text-[11px] font-bold"
                  >
                    Importar como rascunho
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Editor */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="adm-glass w-full max-w-3xl rounded-[10px] border border-[var(--adm-border)] p-5 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--adm-text)]">
                  {editingId ? 'Editar Campanha Patrocinada' : 'Nova Campanha Patrocinada (Rascunho)'}
                </h2>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Alterações exigem motivo auditável e não publicam automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)]"
                aria-label="Fechar editor"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Título *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Marca Patrocinadora *</label>
                <input
                  required
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Descrição *</label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Categoria *</label>
                <input
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Duração (segundos, 5–300) *</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  required
                  value={form.durationSeconds}
                  onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Logo URL (HTTPS ou /local)</label>
                <input
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  placeholder="/assets/... ou https://firebasestorage..."
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Banner URL (HTTPS ou /local)</label>
                <input
                  value={form.bannerUrl}
                  onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
                  placeholder="/assets/... ou https://firebasestorage..."
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Status de Licença da Mídia</label>
                <select
                  value={form.assetApprovalStatus}
                  onChange={(e) => setForm({ ...form, assetApprovalStatus: e.target.value as AssetApprovalStatus })}
                  className="adm-input w-full px-3 py-2"
                >
                  <option value="pending_license">Licença Pendente (requer aprovação)</option>
                  <option value="approved">Aprovada / Licenciada</option>
                  <option value="internal_placeholder">Placeholder Interno</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Nota de Licença / Origem</label>
                <input
                  value={form.assetLicenseNote}
                  onChange={(e) => setForm({ ...form, assetLicenseNote: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Tipo de Recompensa</label>
                <select
                  value={form.rewardType}
                  onChange={(e) => setForm({ ...form, rewardType: e.target.value as AdRewardType })}
                  className="adm-input w-full px-3 py-2"
                >
                  <option value="diamonds">Diamantes</option>
                  <option value="coupon">Cupom</option>
                  <option value="shipping">Benefício de Frete</option>
                  <option value="none">Sem recompensa (informativo)</option>
                </select>
              </div>
              {form.rewardType === 'diamonds' ? (
                <div>
                  <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Diamantes por visualização (1–500)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={form.rewardDiamonds}
                    onChange={(e) => setForm({ ...form, rewardDiamonds: Number(e.target.value) })}
                    className="adm-input w-full px-3 py-2"
                  />
                </div>
              ) : form.rewardType === 'coupon' || form.rewardType === 'shipping' ? (
                <div>
                  <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Código do Cupom / Benefício *</label>
                  <input
                    required
                    value={form.rewardCouponCode}
                    onChange={(e) => setForm({ ...form, rewardCouponCode: e.target.value.toUpperCase() })}
                    placeholder="EX: PARCEIRO10"
                    className="adm-input w-full px-3 py-2 uppercase"
                  />
                </div>
              ) : (
                <div />
              )}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Termos da Recompensa *</label>
                <input
                  required
                  value={form.rewardTerms}
                  onChange={(e) => setForm({ ...form, rewardTerms: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Ação do CTA</label>
                <select
                  value={form.ctaActionType}
                  onChange={(e) => setForm({ ...form, ctaActionType: e.target.value as AdCtaActionType })}
                  className="adm-input w-full px-3 py-2"
                >
                  <option value="none">Sem CTA externo</option>
                  <option value="whatsapp">WhatsApp (https://wa.me/...)</option>
                  <option value="external_url">Site / Link HTTPS</option>
                  <option value="redeem_benefit">Resgatar benefício / rota interna</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Rótulo do Botão CTA</label>
                <input
                  value={form.ctaLabel}
                  onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
                  disabled={form.ctaActionType === 'none'}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              {form.ctaActionType !== 'none' && (
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Destino do CTA *</label>
                  <input
                    required
                    value={form.ctaTarget}
                    onChange={(e) => setForm({ ...form, ctaTarget: e.target.value })}
                    placeholder={
                      form.ctaActionType === 'whatsapp'
                        ? 'https://wa.me/5511999999999'
                        : form.ctaActionType === 'external_url'
                          ? 'https://parceiro.com.br'
                          : '/cart ou CODIGO'
                    }
                    className="adm-input w-full px-3 py-2"
                  />
                </div>
              )}
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Início (opcional)</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Término (opcional)</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Condomínios elegíveis (vírgula; vazio = todos)</label>
                <input
                  value={form.targetCondosText}
                  onChange={(e) => setForm({ ...form, targetCondosText: e.target.value })}
                  placeholder="Ex: Condomínio Bela Vista, Residencial Sol"
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Regra de Elegibilidade</label>
                <select
                  value={form.eligibilityRule}
                  onChange={(e) => setForm({ ...form, eligibilityRule: e.target.value as AdEligibilityRule })}
                  className="adm-input w-full px-3 py-2"
                >
                  <option value="all_residents">Todos os moradores</option>
                  <option value="vip_only">Apenas Clube VIP</option>
                  <option value="first_order_only">Primeiro pedido</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Limite por usuário / dia</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxClaimsPerUserPerDay}
                  onChange={(e) => setForm({ ...form, maxClaimsPerUserPerDay: Number(e.target.value) })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Limite total por usuário (opcional)</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={form.maxClaimsPerUserTotal}
                  onChange={(e) => setForm({ ...form, maxClaimsPerUserTotal: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Orçamento total em diamantes</label>
                <input
                  type="number"
                  min={0}
                  value={form.totalBudgetDiamonds}
                  onChange={(e) => setForm({ ...form, totalBudgetDiamonds: Number(e.target.value) })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Limite global de resgates (opcional)</label>
                <input
                  type="number"
                  min={1}
                  value={form.totalBudgetClaims}
                  onChange={(e) => setForm({ ...form, totalBudgetClaims: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Contato do Patrocinador (privado)</label>
                <input
                  value={form.sponsorContact}
                  onChange={(e) => setForm({ ...form, sponsorContact: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">Notas Internas (privado)</label>
                <input
                  value={form.internalNotes}
                  onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                  className="adm-input w-full px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-[var(--adm-text-muted)] mb-1">
                  Motivo da alteração (auditoria obrigatória) *
                </label>
                <input
                  required
                  minLength={5}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Ex: Cadastro inicial da campanha de parceiro local"
                  className="adm-input w-full px-3 py-2"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--adm-border)]">
              <button
                type="button"
                onClick={() => setPreviewCampaign(form)}
                className="px-3 py-2 rounded-lg border border-[var(--adm-border)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] inline-flex items-center gap-1.5"
              >
                <Eye size={14} />
                Pré-visualizar (não publica)
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-3.5 py-2 rounded-lg border border-[var(--adm-border)] text-xs font-semibold text-[var(--adm-text-muted)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 text-xs font-bold disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Rascunho'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Preview (somente leitura) */}
      {previewCampaign && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="adm-glass w-full max-w-sm rounded-[10px] border border-[var(--adm-border)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Pré-visualização do Card (Rascunho)
              </span>
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="p-1 rounded-md hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-[10px] overflow-hidden border border-[var(--adm-border)] bg-[var(--adm-bg-subtle)]">
              <div className="relative h-32 bg-emerald-950/60 flex items-center justify-center">
                {previewCampaign.bannerUrl ? (
                  <img src={previewCampaign.bannerUrl} alt={previewCampaign.brand} className="w-full h-full object-cover" />
                ) : (
                  <Sparkles className="text-[var(--adm-gold)] opacity-60" size={28} />
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/65 text-[10px] font-bold text-white">
                  {previewCampaign.category || 'Parceiro'}
                </span>
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/65 text-[10px] font-bold text-amber-300 inline-flex items-center gap-1">
                  <Clock size={10} /> {previewCampaign.durationSeconds}s
                </span>
              </div>
              <div className="p-3.5 text-center space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-gold)]">
                  {previewCampaign.brand || 'Marca'}
                </div>
                <div className="text-sm font-bold text-[var(--adm-text)]">{previewCampaign.title || 'Título'}</div>
                <p className="text-xs text-[var(--adm-text-muted)]">{previewCampaign.description}</p>
                <div className="pt-1">
                  {previewCampaign.rewardType === 'diamonds' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold">
                      <Gem size={12} /> Até +{previewCampaign.rewardDiamonds} diamantes
                    </span>
                  )}
                  {(previewCampaign.rewardType === 'coupon' || previewCampaign.rewardType === 'shipping') && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold">
                      <Truck size={12} /> {previewCampaign.rewardCouponCode || 'BENEFÍCIO'}
                    </span>
                  )}
                </div>
                {previewCampaign.ctaActionType !== 'none' && previewCampaign.ctaLabel && (
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] border border-[var(--adm-border)] text-xs font-semibold text-[var(--adm-text)]">
                      {previewCampaign.ctaActionType === 'whatsapp' ? <MessageCircle size={13} /> : <ExternalLink size={13} />}
                      {previewCampaign.ctaLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de status auditado */}
      {transitionModal && (
        <ReasonConfirmModal
          open={true}
          title={`Confirmar ação: ${transitionModal.action.toUpperCase()}`}
          description={`Campanha "${transitionModal.campaign.title}". Esta transição será registrada na trilha de auditoria.`}
          confirmLabel="Confirmar"
          danger={transitionModal.action === 'archive'}
          onClose={() => setTransitionModal(null)}
          onConfirm={handleTransitionConfirm}
        />
      )}
    </div>
  );
};
