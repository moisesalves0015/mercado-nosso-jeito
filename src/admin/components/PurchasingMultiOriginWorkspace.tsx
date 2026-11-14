import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  PackagePlus,
  Plus,
  Store,
} from 'lucide-react';
import type { AdminOrder, AdminProduct } from '../AdminDataContext';
import { formatCurrency, formatDateTime } from './AdminUi';
import {
  computeFinancialScenarios,
  computeFinancialSeparationReport,
  computePartnerFinancialScenarios,
  diagnoseCatalogOrigins,
  findPotentialDuplicateProducts,
  isPartnerOfferAvailabilityExpired,
  OWN_LIFECYCLE_LABELS,
  PARTNER_LIFECYCLE_LABELS,
  roundCurrency,
  SUPPLY_ORIGIN_LABELS,
  SUPPLY_ORIGIN_SHORT_LABELS,
  type CustodyMovementRecord,
  type CustodyMovementType,
  type PartnerCommercialRule,
  type PartnerCommercialRuleType,
  type PartnerSettlementRecord,
  type PartnerVendorRecord,
  type ProductOfferRecord,
  type PurchasingProductMetadata,
  type SupplierRecord,
  type SupplyOriginChannel,
} from '../../utils/purchasingEngine';
import {
  authorizeProductOffer,
  confirmPartnerOfferAvailability,
  onboardProductAndOfferViaAssistant,
  recordPartnerCustodyMovement,
  savePartnerVendor,
  updateProductOfferWithGuard,
  type PurchasingActor,
} from '../../services/purchasingService';

interface Props {
  mode: 'onboarding' | 'partners';
  products: AdminProduct[];
  orders: AdminOrder[];
  suppliers: SupplierRecord[];
  partners: PartnerVendorRecord[];
  offers: ProductOfferRecord[];
  custodyMovements: CustodyMovementRecord[];
  settlements: PartnerSettlementRecord[];
  productMetaMap: Record<string, PurchasingProductMetadata>;
  actor: PurchasingActor;
  perms: {
    canView: boolean;
    canManageCatalogAndSuppliers: boolean;
    canCreateAndSubmitList: boolean;
    canApproveProductOrOffer: boolean;
    canApproveOrReject: boolean;
    canExecuteAndReceive: boolean;
    canManagePartnersAndCustody: boolean;
  };
  onRefreshAll: () => Promise<void>;
  onAddApprovedOfferToPurchaseDraft: (offer: ProductOfferRecord) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const CUSTODY_MOVEMENT_LABELS: Record<CustodyMovementType, string> = {
  recebimento_consignacao: 'Entrada Física em Consignação (Propriedade do Parceiro)',
  reserva_pedido: 'Reserva para Pedido em Separação',
  baixa_venda_consignada: 'Baixa por Venda Consignada',
  devolucao_ao_parceiro: 'Devolução Física ao Parceiro',
  perda_ou_avaria: 'Registro de Perda ou Avaria em Custódia',
  ajuste_conferencia: 'Ajuste de Conferência de Custódia',
};

const RULE_TYPE_LABELS: Record<PartnerCommercialRuleType, string> = {
  percentual_comissao: 'Comissão Percentual do Mercado (%)',
  valor_fixo_unidade: 'Taxa Fixa do Mercado por Unidade (R$/un.)',
  preco_liquido_parceiro: 'Preço Líquido Fixo Devido ao Parceiro (R$/un.)',
};

export const PurchasingMultiOriginWorkspace: React.FC<Props> = ({
  mode,
  products,
  orders,
  suppliers,
  partners,
  offers,
  custodyMovements,
  settlements,
  productMetaMap,
  actor,
  perms,
  onRefreshAll,
  onAddApprovedOfferToPurchaseDraft,
  showToast,
}) => {
  const [busy, setBusy] = useState(false);

  // ─── Onboarding Wizard State (Porta de Entrada de Produto Novo) ─────────
  const [linkedExistingProductId, setLinkedExistingProductId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [ean, setEan] = useState('');
  const [category, setCategory] = useState('Mercearia');
  const [unit, setUnit] = useState('UN');
  const [image, setImage] = useState('');
  const [originChannel, setOriginChannel] =
    useState<SupplyOriginChannel>('mercado_proprio');
  const [salePrice, setSalePrice] = useState<number>(19.9);
  const [inclusionJustification, setInclusionJustification] = useState(
    'Demanda recorrente de moradores identificada na operação.',
  );

  // Model A (`mercado_proprio`) state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [unitAcquisitionCost, setUnitAcquisitionCost] = useState<number>(11.5);
  const [plannedPurchaseQty, setPlannedPurchaseQty] = useState<number>(24);
  const [simFreightCost, setSimFreightCost] = useState<number>(0);
  const [simTaxCost, setSimTaxCost] = useState<number>(0);

  // Model B & C (`parceiro_*`) state
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [ruleType, setRuleType] =
    useState<PartnerCommercialRuleType>('percentual_comissao');
  const [commissionPct, setCommissionPct] = useState<number>(18);
  const [fixedFeePerUnit, setFixedFeePerUnit] = useState<number>(3.5);
  const [partnerNetUnitAmount, setPartnerNetUnitAmount] = useState<number>(15.0);
  const [deliveryCostPerUnit, setDeliveryCostPerUnit] = useState<number>(1.0);
  const [packagingCostPerUnit, setPackagingCostPerUnit] = useState<number>(0.5);
  const [paymentFeePct, setPaymentFeePct] = useState<number>(1.5);
  const [custodyLocation, setCustodyLocation] = useState(
    'Prateleira Consignada A1 — Unidade Mercado',
  );
  const [custodianName, setCustodianName] = useState(actor.name);
  const [initialReportedAvailableQty, setInitialReportedAvailableQty] =
    useState<number>(20);

  // Filters for Offers list
  const [offerOriginFilter, setOfferOriginFilter] = useState<string>('all');
  const [offerPartnerFilter, setOfferPartnerFilter] = useState<string>('all');
  const [offerStatusFilter, setOfferStatusFilter] = useState<string>('all');
  const [offerSearch, setOfferSearch] = useState<string>('');

  // Modals for Offer Governance, Custody Movement, Availability & Partner Registration
  const [approvalModalOffer, setApprovalModalOffer] =
    useState<ProductOfferRecord | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  const [custodyModalOffer, setCustodyModalOffer] =
    useState<ProductOfferRecord | null>(null);
  const [custodyMoveType, setCustodyMoveType] = useState<CustodyMovementType>(
    'recebimento_consignacao',
  );
  const [custodyMoveQty, setCustodyMoveQty] = useState<number>(10);
  const [custodyMoveNotes, setCustodyMoveNotes] = useState('');

  const [availModalOffer, setAvailModalOffer] =
    useState<ProductOfferRecord | null>(null);
  const [availQtyInput, setAvailQtyInput] = useState<number>(15);
  const [availTtlHoursInput, setAvailTtlHoursInput] = useState<number>(24);
  const [availNoteInput, setAvailNoteInput] = useState('');

  const [editOfferModal, setEditOfferModal] = useState<ProductOfferRecord | null>(null);
  const [editOfferSalePrice, setEditOfferSalePrice] = useState<number>(0);
  const [editOfferCost, setEditOfferCost] = useState<number>(0);
  const [editOfferReason, setEditOfferReason] = useState('');

  // Partner CRUD Modal
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerTradeName, setPartnerTradeName] = useState('');
  const partnerDoc = '';
  const [partnerContact, setPartnerContact] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const partnerEmail = '';
  const [partnerPixKey, setPartnerPixKey] = useState('');
  const [partnerAddress, setPartnerAddress] = useState('');
  const [partnerPickupInstructions, setPartnerPickupInstructions] = useState(
    'Apresentar número do pedido no balcão para conferência.',
  );
  const partnerPrepMinutes = 15;
  const partnerTtlHours = 24;
  const [partnerDefaultChannel, setPartnerDefaultChannel] = useState<
    'parceiro_consignado_mercado' | 'parceiro_retirada_estabelecimento'
  >('parceiro_consignado_mercado');
  const [partnerRuleType, setPartnerRuleType] =
    useState<PartnerCommercialRuleType>('percentual_comissao');
  const [partnerRuleCommPct, setPartnerRuleCommPct] = useState<number>(18);
  const [partnerRuleFixedFee, setPartnerRuleFixedFee] = useState<number>(3.0);
  const [partnerRuleNetAmount, setPartnerRuleNetAmount] = useState<number>(15.0);
  const [partnerFiscalPolicy, setPartnerFiscalPolicy] = useState<
    'definicao_pendente' | 'parceiro_emite_nf' | 'mercado_intermediador'
  >('definicao_pendente');
  const partnerPublicDesc = '';
  const partnerPublicHours = 'Seg a Sáb • 08h às 21h';

  // Anti-duplication check in real time
  const duplicateCheck = useMemo(
    () =>
      findPotentialDuplicateProducts(
        { title, sku, ean, unit },
        products,
      ),
    [title, sku, ean, unit, products],
  );

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) || null,
    [partners, selectedPartnerId],
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || null,
    [suppliers, selectedSupplierId],
  );

  // Active commercial rule for Onboarding simulator
  const activeOnboardingRule: PartnerCommercialRule = useMemo(
    () => ({
      version: selectedPartner?.currentCommercialRule?.version || 1,
      ruleType,
      commissionPct,
      fixedFeePerUnit,
      partnerNetUnitAmount,
      deliveryCostPerUnit,
      packagingCostPerUnit,
      paymentFeePct,
      validFrom: new Date().toISOString().slice(0, 10),
      fiscalResponsibilityPolicy:
        selectedPartner?.currentCommercialRule?.fiscalResponsibilityPolicy ||
        'definicao_pendente',
    }),
    [
      selectedPartner,
      ruleType,
      commissionPct,
      fixedFeePerUnit,
      partnerNetUnitAmount,
      deliveryCostPerUnit,
      packagingCostPerUnit,
      paymentFeePct,
    ],
  );

  // Financial Simulator 10 / 50 / 100 for Own Product (Model A)
  const ownScenarioResult = useMemo(
    () =>
      computeFinancialScenarios({
        unitCost: unitAcquisitionCost,
        salePrice,
        plannedPurchaseQty,
        freightCost: simFreightCost,
        taxCost: simTaxCost,
      }),
    [unitAcquisitionCost, salePrice, plannedPurchaseQty, simFreightCost, simTaxCost],
  );

  // Financial Simulator 10 / 50 / 100 for Partner Product (Model B & C)
  const partnerScenarioResult = useMemo(
    () =>
      computePartnerFinancialScenarios({
        salePrice,
        rule: activeOnboardingRule,
        plannedAvailableQty: initialReportedAvailableQty,
      }),
    [salePrice, activeOnboardingRule, initialReportedAvailableQty],
  );

  // Financial Separation Report (Own vs Partner)
  const financialSeparation = useMemo(
    () =>
      computeFinancialSeparationReport({
        orders,
        products,
        offers,
        settlements,
      }),
    [orders, products, offers, settlements],
  );

  // Catalog Origin Diagnostic
  const catalogDiagnostic = useMemo(
    () => diagnoseCatalogOrigins(products, offers, productMetaMap),
    [products, offers, productMetaMap],
  );

  // Filtered Offers
  const filteredOffers = useMemo(() => {
    const q = offerSearch.trim().toLowerCase();
    return offers.filter((off) => {
      if (offerOriginFilter !== 'all' && off.originChannel !== offerOriginFilter) {
        return false;
      }
      if (offerPartnerFilter !== 'all' && off.partnerId !== offerPartnerFilter) {
        return false;
      }
      const status = off.ownLifecycleStatus || off.partnerLifecycleStatus || '';
      if (offerStatusFilter !== 'all' && status !== offerStatusFilter) {
        return false;
      }
      if (q) {
        const mTitle = off.productTitle.toLowerCase().includes(q);
        const mSku = (off.sku || '').toLowerCase().includes(q);
        const mPartner = (off.partnerName || off.supplierName || '')
          .toLowerCase()
          .includes(q);
        if (!mTitle && !mSku && !mPartner) return false;
      }
      return true;
    });
  }, [offers, offerOriginFilter, offerPartnerFilter, offerStatusFilter, offerSearch]);

  const handleSelectPartnerInWizard = (pid: string) => {
    setSelectedPartnerId(pid);
    const found = partners.find((p) => p.id === pid);
    if (found && found.currentCommercialRule) {
      setRuleType(found.currentCommercialRule.ruleType);
      if (found.currentCommercialRule.commissionPct !== undefined) {
        setCommissionPct(found.currentCommercialRule.commissionPct);
      }
      if (found.currentCommercialRule.fixedFeePerUnit !== undefined) {
        setFixedFeePerUnit(found.currentCommercialRule.fixedFeePerUnit);
      }
      if (found.currentCommercialRule.partnerNetUnitAmount !== undefined) {
        setPartnerNetUnitAmount(found.currentCommercialRule.partnerNetUnitAmount);
      }
    }
  };

  const handleLinkDuplicateProduct = (prod: {
    id: string;
    title: string;
    sku?: string;
    ean?: string;
    category?: string;
    unit?: string;
    price?: number;
    costPrice?: number;
  }) => {
    setLinkedExistingProductId(prod.id);
    setTitle(prod.title);
    if (prod.sku) setSku(prod.sku);
    if (prod.ean) setEan(prod.ean);
    if (prod.category) setCategory(prod.category);
    if (prod.unit) setUnit(prod.unit);
    if (prod.price && prod.price > 0) setSalePrice(prod.price);
    if (prod.costPrice && prod.costPrice > 0) setUnitAcquisitionCost(prod.costPrice);
    showToast(
      `Vinculado ao produto mestre "${prod.title}" (#${prod.id.slice(0, 8)}) — sem duplicar o catálogo!`,
      'success',
    );
  };

  const handleOnboardSubmit = async (submitForApproval: boolean) => {
    if (!title.trim()) {
      showToast('Informe o nome do produto para continuar.', 'error');
      return;
    }
    if (duplicateCheck.hasExactDuplicate && !linkedExistingProductId) {
      showToast(
        'Produto já existe no catálogo mestre (SKU, EAN ou Nome+Unidade idêntico). Clique em "Vincular ao Produto Existente" para criar uma nova oferta sem duplicar o catálogo.',
        'error',
      );
      return;
    }
    if (salePrice <= 0) {
      showToast('Informe um preço de venda previsto maior que zero.', 'error');
      return;
    }
    if (
      originChannel !== 'mercado_proprio' &&
      !selectedPartner
    ) {
      showToast('Selecione ou cadastre um Parceiro Vendedor para esta oferta.', 'error');
      return;
    }
    if (!inclusionJustification.trim() || inclusionJustification.trim().length < 5) {
      showToast('Informe a justificativa comercial de inclusão.', 'error');
      return;
    }

    setBusy(true);
    try {
      const res = await onboardProductAndOfferViaAssistant(
        {
          existingProductId: linkedExistingProductId,
          title,
          sku,
          ean,
          category,
          unit,
          image,
          originChannel,
          salePrice,
          inclusionJustification,
          submitImmediatelyForApproval: submitForApproval,
          supplierId: selectedSupplier?.id || '',
          supplierName: selectedSupplier?.name || '',
          unitAcquisitionCost,
          plannedPurchaseQty,
          partner: selectedPartner,
          customCommercialRule: activeOnboardingRule,
          custodyLocation,
          custodianName,
          initialReportedAvailableQty,
        },
        actor,
      );

      await onRefreshAll();
      showToast(
        submitForApproval
          ? `Produto/Oferta "${res.offer.productTitle}" enviado para aprovação (${SUPPLY_ORIGIN_SHORT_LABELS[originChannel]}). Estoque próprio mantido em 0 até o fluxo de recebimento.`
          : `Rascunho de "${res.offer.productTitle}" salvo no Assistente de Compras.`,
        'success',
      );

      // Reset form
      setLinkedExistingProductId(null);
      setTitle('');
      setSku('');
      setEan('');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Erro ao registrar produto/oferta.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSavePartner = async () => {
    if (!partnerName.trim()) {
      showToast('Informe a razão social ou nome do parceiro.', 'error');
      return;
    }
    setBusy(true);
    try {
      const rule: PartnerCommercialRule = {
        version: 1,
        ruleType: partnerRuleType,
        commissionPct: partnerRuleCommPct,
        fixedFeePerUnit: partnerRuleFixedFee,
        partnerNetUnitAmount: partnerRuleNetAmount,
        deliveryCostPerUnit: 1.0,
        packagingCostPerUnit: 0.5,
        paymentFeePct: 1.5,
        validFrom: new Date().toISOString().slice(0, 10),
        fiscalResponsibilityPolicy: partnerFiscalPolicy,
      };

      const saved = await savePartnerVendor(
        {
          id: editingPartnerId || undefined,
          name: partnerName,
          tradeName: partnerTradeName || partnerName,
          document: partnerDoc,
          contactName: partnerContact,
          phone: partnerPhone,
          email: partnerEmail,
          pixKey: partnerPixKey,
          address: partnerAddress,
          pickupInstructions: partnerPickupInstructions,
          estimatedPrepMinutes: partnerPrepMinutes,
          availabilityTtlHours: partnerTtlHours,
          defaultChannel: partnerDefaultChannel,
          currentCommercialRule: rule,
          publicProfile: {
            published: false, // Strictly false by default per Section 12
            moderationStatus: 'rascunho',
            publicName: partnerTradeName || partnerName,
            slug: '',
            shortDescription: partnerPublicDesc,
            categories: [category],
            serviceRegion: 'Condomínio & Entorno',
            operatingHours: partnerPublicHours,
          },
        },
        actor,
      );

      await onRefreshAll();
      setSelectedPartnerId(saved.id);
      setPartnerModalOpen(false);
      setEditingPartnerId(null);
      showToast(
        `Parceiro "${saved.tradeName}" salvo com regra comercial v${saved.currentCommercialRule.version} (Perfil público mantido como não publicado).`,
        'success',
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Erro ao salvar parceiro.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── MODE 1: PORTA DE ENTRADA DE PRODUTO NOVO & CICLO DE ORIGENS (A / B / C) ─── */}
      {mode === 'onboarding' && (
        <>
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[12px] p-5 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-[var(--adm-border)] pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 mb-1.5">
                  <PackagePlus size={13} />
                  Porta de Entrada Oficial de Produtos & Ofertas
                </span>
                <h2 className="text-base font-extrabold text-[var(--adm-text)]">
                  Cadastrar ou Vincular Produto por Modelo de Operação (A, B ou C)
                </h2>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Todo produto novo inicia como rascunho no Assistente de Compras. O sistema verifica duplicidade no catálogo mestre, separa aprovação do produto da aprovação de compra e impede entrada prematura de estoque.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPartnerId(null);
                  setPartnerName('');
                  setPartnerTradeName('');
                  setPartnerModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-bold text-amber-300 border border-amber-500/30 self-start"
              >
                <Store size={14} />
                + Cadastrar Novo Parceiro Vendedor
              </button>
            </div>

            {/* ETAPA 1: Identidade no Catálogo & Anti-Duplicidade */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  1. Identidade do Produto no Catálogo Mestre (Prevenção de Duplicidade)
                </h3>
                {linkedExistingProductId && (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/15 text-sky-200 border border-sky-500/30 text-xs font-semibold">
                    Vinculado ao ID #{linkedExistingProductId.slice(0, 10)}
                    <button
                      type="button"
                      onClick={() => setLinkedExistingProductId(null)}
                      className="underline text-rose-300 ml-1"
                    >
                      Desvincular
                    </button>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Café Torrado Especial 500g"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                    SKU Interno
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ex.: CAF-500"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                    Código de Barras / EAN
                  </label>
                  <input
                    type="text"
                    value={ean}
                    onChange={(e) => setEan(e.target.value)}
                    placeholder="789..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Bebidas, Padaria..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                    Unidade
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="PCT">PCT (Pacote)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="KG">KG (Quilo)</option>
                    <option value="LT">LT (Litro)</option>
                    <option value="BDJ">BDJ (Bandeja)</option>
                  </select>
                </div>
              </div>

              {/* Duplicate matches alert */}
              {duplicateCheck.hasSimilarMatch && !linkedExistingProductId && (
                <div
                  className={`p-3.5 rounded-lg border ${
                    duplicateCheck.hasExactDuplicate
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  } space-y-2`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <AlertTriangle size={15} />
                    {duplicateCheck.hasExactDuplicate
                      ? 'Duplicidade Exata Detectada no Catálogo Mestre! Reutilize o registro existente:'
                      : 'Itens semelhantes encontrados no catálogo mestre — verifique antes de criar um novo:'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {duplicateCheck.matches.slice(0, 4).map((m) => (
                      <div
                        key={m.product.id}
                        className="flex items-center justify-between gap-2 p-2 rounded bg-black/25 border border-white/10 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{m.product.title}</div>
                          <div className="text-[11px] opacity-80">
                            {m.reasonLabel} • Estoque próprio: {m.product.stock ?? 0}{' '}
                            {m.product.unit || 'UN'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLinkDuplicateProduct(m.product)}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-bold text-[11px] shrink-0"
                        >
                          Vincular a Este Produto
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 2: Escolha do Modelo de Operação (A, B ou C) */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                2. Origem, Propriedade do Estoque e Modelo de Atendimento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(
                  [
                    {
                      id: 'mercado_proprio' as const,
                      title: 'A. Produto Próprio do Mercado',
                      ownership: 'Propriedade: MERCADO',
                      storage: 'Local: Estoque Físico Mercado',
                      desc: 'Mercado compra do fornecedor, aprova compra e recebe fisicamente. Só entra no estoque vendável após conferência de recebimento.',
                      badgeCls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
                    },
                    {
                      id: 'parceiro_consignado_mercado' as const,
                      title: 'B. Parceiro Consignado no Mercado',
                      ownership: 'Propriedade: PARCEIRO',
                      storage: 'Local: Custódia Física no Mercado',
                      desc: 'Mercadoria armazenada no Mercado, mas pertence ao parceiro. Registra custódia e repasse por venda. Não contabiliza como compra nem estoque próprio.',
                      badgeCls: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
                    },
                    {
                      id: 'parceiro_retirada_estabelecimento' as const,
                      title: 'C. Parceiro Externo (Retirada)',
                      ownership: 'Propriedade: PARCEIRO',
                      storage: 'Local: Estabelecimento do Parceiro',
                      desc: 'Estoque permanece no parceiro com validade de disponibilidade. No pedido, gera instruções de coleta para o entregador sem somar ao estoque do Mercado.',
                      badgeCls: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
                    },
                  ] as const
                ).map((opt) => {
                  const selected = originChannel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOriginChannel(opt.id)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        selected
                          ? `${opt.badgeCls} ring-2 ring-amber-400/50`
                          : 'bg-[var(--adm-bg)] border-[var(--adm-border)] text-[var(--adm-text-muted)] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-extrabold text-xs text-[var(--adm-text)]">
                          {opt.title}
                        </span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            selected
                              ? 'border-amber-300 bg-amber-400 text-emerald-950'
                              : 'border-white/30'
                          }`}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="px-2 py-0.5 rounded bg-black/30 text-[10px] font-bold">
                          {opt.ownership}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/30 text-[10px] font-bold">
                          {opt.storage}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ETAPA 3: Condições Comerciais & Simulador 10/50/100 Dinâmico conforme Origem */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
              {/* Left Column: Inputs tailored to Origin Channel */}
              <div className="lg:col-span-5 space-y-4 bg-[var(--adm-bg)] border border-[var(--adm-border)] rounded-xl p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  3. Parâmetros Comerciais ({SUPPLY_ORIGIN_SHORT_LABELS[originChannel]})
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                      Preço de Venda ao Cliente (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={salePrice}
                      onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs font-bold text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                      URL da Imagem (opcional)
                    </label>
                    <input
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="/logo.png ou https://..."
                      className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                    />
                  </div>
                </div>

                {originChannel === 'mercado_proprio' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                        Fornecedor para Compra do Mercado
                      </label>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                      >
                        <option value="">Selecione um fornecedor cadastrado...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Prazo {s.leadTimeDays}d • Mín.{' '}
                            {formatCurrency(s.minOrderValue)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Custo Unitário Cotado (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={unitAcquisitionCost}
                          onChange={(e) =>
                            setUnitAcquisitionCost(Number(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Lote Planejado p/ Compra ({unit})
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={plannedPurchaseQty}
                          onChange={(e) =>
                            setPlannedPurchaseQty(
                              Math.max(1, Math.floor(Number(e.target.value) || 1)),
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Frete Estimado do Lote (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={simFreightCost}
                          onChange={(e) => setSimFreightCost(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Impostos / Outros do Lote (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={simTaxCost}
                          onChange={(e) => setSimTaxCost(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                        Parceiro Vendedor (Dono da Mercadoria) *
                      </label>
                      <select
                        value={selectedPartnerId}
                        onChange={(e) => handleSelectPartnerInWizard(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                      >
                        <option value="">Selecione um parceiro cadastrado...</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.tradeName || p.name} ({RULE_TYPE_LABELS[p.currentCommercialRule.ruleType]})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Modelo de Regra Comercial
                        </label>
                        <select
                          value={ruleType}
                          onChange={(e) =>
                            setRuleType(e.target.value as PartnerCommercialRuleType)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        >
                          <option value="percentual_comissao">
                            Comissão Percentual (%)
                          </option>
                          <option value="valor_fixo_unidade">
                            Valor Fixo p/ Unidade (R$)
                          </option>
                          <option value="preco_liquido_parceiro">
                            Preço Líquido do Parceiro (R$)
                          </option>
                        </select>
                      </div>
                      <div>
                        {ruleType === 'percentual_comissao' && (
                          <>
                            <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                              Comissão do Mercado (%)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              value={commissionPct}
                              onChange={(e) =>
                                setCommissionPct(Number(e.target.value) || 0)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                            />
                          </>
                        )}
                        {ruleType === 'valor_fixo_unidade' && (
                          <>
                            <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                              Taxa Fixa Mercado (R$/un.)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={fixedFeePerUnit}
                              onChange={(e) =>
                                setFixedFeePerUnit(Number(e.target.value) || 0)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                            />
                          </>
                        )}
                        {ruleType === 'preco_liquido_parceiro' && (
                          <>
                            <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                              Repasse Líquido Parceiro (R$/un.)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={partnerNetUnitAmount}
                              onChange={(e) =>
                                setPartnerNetUnitAmount(Number(e.target.value) || 0)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                            />
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Custo Coleta/Entr. (R$/un)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={deliveryCostPerUnit}
                          onChange={(e) =>
                            setDeliveryCostPerUnit(Number(e.target.value) || 0)
                          }
                          className="w-full px-2.5 py-1.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Embalagem (R$/un)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={packagingCostPerUnit}
                          onChange={(e) =>
                            setPackagingCostPerUnit(Number(e.target.value) || 0)
                          }
                          className="w-full px-2.5 py-1.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Taxa Pagto (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={paymentFeePct}
                          onChange={(e) => setPaymentFeePct(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                    </div>

                    {originChannel === 'parceiro_consignado_mercado' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                            Local de Custódia no Mercado
                          </label>
                          <input
                            type="text"
                            value={custodyLocation}
                            onChange={(e) => setCustodyLocation(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                            Custodiante Responsável
                          </label>
                          <input
                            type="text"
                            value={custodianName}
                            onChange={(e) => setCustodianName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                          Disponibilidade Inicial Informada pelo Parceiro ({unit})
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={initialReportedAvailableQty}
                          onChange={(e) =>
                            setInitialReportedAvailableQty(
                              Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                    Justificativa Comercial & Observações Operacionais *
                  </label>
                  <textarea
                    rows={2}
                    value={inclusionJustification}
                    onChange={(e) => setInclusionJustification(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy || !perms.canCreateAndSubmitList}
                    onClick={() => handleOnboardSubmit(false)}
                    className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-bold text-[var(--adm-text)] border border-[var(--adm-border)] disabled:opacity-50"
                  >
                    Salvar como Rascunho
                  </button>
                  <button
                    type="button"
                    disabled={busy || !perms.canCreateAndSubmitList}
                    onClick={() => handleOnboardSubmit(true)}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-extrabold text-xs transition-colors disabled:opacity-50"
                  >
                    Enviar Produto/Oferta para Aprovação
                  </button>
                </div>
              </div>

              {/* Right Column: Live 10 / 50 / 100 Scenario Simulator adapted to Origin */}
              <div className="lg:col-span-7 bg-[var(--adm-bg)] border border-[var(--adm-border)] rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                      Simulador Financeiro em Tempo Real (Cenários 10, 50 e 100 un.)
                    </h3>
                    <p className="text-[11px] text-[var(--adm-text-muted)]">
                      {originChannel === 'mercado_proprio'
                        ? 'Modelo A (Estoque Próprio): separa receita estimada, CMV das unidades vendidas, desembolso do lote e valor do estoque remanescente.'
                        : 'Modelo B/C (Parceiro): separa valor pago pelo cliente, repasse devido ao parceiro, comissão bruta do Mercado e contribuição após custos atribuíveis (Desembolso de compra = R$ 0,00).'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Projeção Calculada (Não é lucro líquido contábil)
                  </span>
                </div>

                {originChannel === 'mercado_proprio' ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)]">
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Lucro Bruto Unitário
                        </div>
                        <div className="text-sm font-extrabold text-emerald-300">
                          {formatCurrency(ownScenarioResult.unitGrossProfit)}
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)]">
                          Margem bruta:{' '}
                          {ownScenarioResult.grossMarginPct !== null
                            ? `${ownScenarioResult.grossMarginPct}%`
                            : '—'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)]">
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Desembolso Total do Lote ({plannedPurchaseQty} un.)
                        </div>
                        <div className="text-sm font-extrabold text-amber-300">
                          {formatCurrency(ownScenarioResult.totalPurchaseOutlay)}
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)]">
                          Custo efetivo c/ extras:{' '}
                          {formatCurrency(ownScenarioResult.effectiveUnitCostWithExtras)}/un
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)] sm:col-span-2">
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Recuperação do Desembolso do Lote
                        </div>
                        <div className="text-xs font-bold text-[var(--adm-text)] mt-0.5">
                          {ownScenarioResult.unitsToRecoverOutlay !== null
                            ? `Recupera o investimento do lote ao vender ${ownScenarioResult.unitsToRecoverOutlay} ${unit} (${
                                ownScenarioResult.canRecoverOutlayWithinPurchase
                                  ? 'dentro do lote planejado'
                                  : 'exige reposição adicional'
                              }).`
                            : 'Informe preço e custo para calcular.'}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--adm-border)] text-[10px] uppercase text-[var(--adm-text-muted)]">
                            <th className="py-2 pr-2">Cenário de Venda</th>
                            <th className="py-2 px-2">Receita Estimada</th>
                            <th className="py-2 px-2">CMV (Unid. Vendidas)</th>
                            <th className="py-2 px-2">Lucro Bruto / Contrib.</th>
                            <th className="py-2 px-2">Desembolso do Lote</th>
                            <th className="py-2 pl-2">Estoque Remanescente (a Custo)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--adm-border)]">
                          {ownScenarioResult.scenarios.map((row) => (
                            <tr key={row.quantity} className="hover:bg-white/[0.02]">
                              <td className="py-2 pr-2 font-bold text-[var(--adm-text)]">
                                {row.label}
                              </td>
                              <td className="py-2 px-2 text-emerald-300 font-semibold">
                                {formatCurrency(row.grossRevenue)}
                              </td>
                              <td className="py-2 px-2 text-[var(--adm-text-muted)]">
                                {formatCurrency(row.cogsSoldUnits)}
                              </td>
                              <td className="py-2 px-2 font-bold text-emerald-200">
                                {formatCurrency(row.projectedGrossProfit)}
                              </td>
                              <td className="py-2 px-2 text-amber-300">
                                {formatCurrency(row.purchaseOutlay)}
                              </td>
                              <td className="py-2 pl-2 text-sky-200">
                                {row.unsoldUnitsFromPurchase} un. (
                                {formatCurrency(row.remainingInventoryValueAtCost)})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)]">
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Repasse ao Parceiro / un.
                        </div>
                        <div className="text-sm font-extrabold text-amber-300">
                          {formatCurrency(partnerScenarioResult.unitSplit.partnerUnitRepasse)}
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)]">
                          Pertence ao Parceiro
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)]">
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Comissão Bruta Mercado / un.
                        </div>
                        <div className="text-sm font-extrabold text-emerald-300">
                          {formatCurrency(
                            partnerScenarioResult.unitSplit.mercadoUnitGrossCommission,
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)]">
                          {partnerScenarioResult.unitSplit.commissionEffectivePct !== null
                            ? `${partnerScenarioResult.unitSplit.commissionEffectivePct}% sobre o preço`
                            : '—'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)]">
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Custos Atribuíveis / un.
                        </div>
                        <div className="text-sm font-extrabold text-rose-300">
                          {formatCurrency(
                            partnerScenarioResult.unitSplit.attributableUnitCost,
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)]">
                          Coleta + emb. + taxa pagto
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[var(--adm-surface)] border border-[var(--adm-border)]">
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Contribuição Mercado / un.
                        </div>
                        <div className="text-sm font-extrabold text-sky-300">
                          {formatCurrency(
                            partnerScenarioResult.unitSplit.mercadoUnitContribution,
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)]">
                          Desembolso compra: R$ 0,00
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--adm-border)] text-[10px] uppercase text-[var(--adm-text-muted)]">
                            <th className="py-2 pr-2">Cenário</th>
                            <th className="py-2 px-2">Pago pelo Cliente (GMV)</th>
                            <th className="py-2 px-2">Devido ao Parceiro</th>
                            <th className="py-2 px-2">Comissão Bruta Mercado</th>
                            <th className="py-2 px-2">Custos Atribuíveis</th>
                            <th className="py-2 pl-2">Contribuição Mercado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--adm-border)]">
                          {partnerScenarioResult.scenarios.map((row) => (
                            <tr key={row.quantity} className="hover:bg-white/[0.02]">
                              <td className="py-2 pr-2 font-bold text-[var(--adm-text)]">
                                {row.label}
                              </td>
                              <td className="py-2 px-2 text-[var(--adm-text)] font-semibold">
                                {formatCurrency(row.customerGrossRevenue)}
                              </td>
                              <td className="py-2 px-2 text-amber-300 font-semibold">
                                {formatCurrency(row.partnerRepasseTotal)}
                              </td>
                              <td className="py-2 px-2 text-emerald-300 font-bold">
                                {formatCurrency(row.mercadoGrossCommissionTotal)}
                              </td>
                              <td className="py-2 px-2 text-rose-300">
                                {formatCurrency(row.attributableCostsTotal)}
                              </td>
                              <td className="py-2 pl-2 font-extrabold text-sky-200">
                                {formatCurrency(row.mercadoEstimatedContribution)}{' '}
                                {row.mercadoContributionPct !== null && (
                                  <span className="text-[10px] opacity-80">
                                    ({row.mercadoContributionPct}%)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ─── FILA DE OFERTAS, APROVAÇÕES DE PRODUTO E DISPONIBILIDADE POR CANAL ─── */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[12px] p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
                  Ciclo de Vida de Produtos & Ofertas por Origem ({filteredOffers.length})
                </h3>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Aprovação de produto/oferta separada da aprovação de compra. Alterações de preço, custo, fornecedor ou regra comercial após aprovação exigem nova validação.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={offerSearch}
                  onChange={(e) => setOfferSearch(e.target.value)}
                  placeholder="Buscar produto, SKU ou parceiro..."
                  className="px-3 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
                <select
                  value={offerOriginFilter}
                  onChange={(e) => setOfferOriginFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="all">Todas as Origens (A, B e C)</option>
                  <option value="mercado_proprio">A. Próprio Mercado</option>
                  <option value="parceiro_consignado_mercado">
                    B. Consignado no Mercado
                  </option>
                  <option value="parceiro_retirada_estabelecimento">
                    C. Retirada no Parceiro
                  </option>
                </select>
                <select
                  value={offerPartnerFilter}
                  onChange={(e) => setOfferPartnerFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="all">Todos os Parceiros</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tradeName || p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={offerStatusFilter}
                  onChange={(e) => setOfferStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="all">Todos os Status</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="aguardando_aprovacao_produto">
                    Aguardando Aprovação Produto
                  </option>
                  <option value="aguardando_aprovacao_parceiro_produto">
                    Aguardando Aprovação Parceiro
                  </option>
                  <option value="aprovado_para_compra">Aprovado p/ Compra</option>
                  <option value="aprovado">Oferta Aprovada</option>
                  <option value="ativo">Ativo</option>
                  <option value="devolvido_para_ajustes">Devolvido p/ Ajustes</option>
                  <option value="rejeitado">Rejeitado</option>
                </select>
              </div>
            </div>

            {filteredOffers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--adm-text-muted)] border border-dashed border-[var(--adm-border)] rounded-xl">
                Nenhuma oferta/produto encontrado para os filtros selecionados. Utilize o formulário acima para cadastrar ou vincular um produto.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOffers.map((off) => {
                  const isOwn = off.originChannel === 'mercado_proprio';
                  const availCheck = isPartnerOfferAvailabilityExpired(off);
                  const statusLabel = isOwn
                    ? OWN_LIFECYCLE_LABELS[off.ownLifecycleStatus || 'rascunho']
                    : PARTNER_LIFECYCLE_LABELS[off.partnerLifecycleStatus || 'rascunho'];

                  return (
                    <div
                      key={off.id}
                      className="p-4 rounded-xl bg-[var(--adm-bg)] border border-[var(--adm-border)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-[var(--adm-text)]">
                            {off.productTitle}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {SUPPLY_ORIGIN_SHORT_LABELS[off.originChannel]}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-200 border border-amber-500/30">
                            Propriedade: {off.ownership.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-200 border border-sky-500/30">
                            {statusLabel}
                          </span>
                          {off.originChannel === 'parceiro_retirada_estabelecimento' &&
                            availCheck.isExpired && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Disponibilidade Vencida / Pendente
                              </span>
                            )}
                        </div>

                        <div className="text-xs text-[var(--adm-text-muted)] flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Preço Venda: <strong>{formatCurrency(off.salePrice)}</strong>
                          </span>
                          {isOwn ? (
                            <>
                              <span>
                                Custo Aquisição:{' '}
                                <strong>
                                  {formatCurrency(off.unitAcquisitionCost || 0)}
                                </strong>
                              </span>
                              <span>
                                Fornecedor:{' '}
                                <strong>{off.supplierName || 'Não definido'}</strong>
                              </span>
                              <span>
                                Lote Planejado:{' '}
                                <strong>
                                  {off.plannedPurchaseQty || 0} {off.unit}
                                </strong>
                              </span>
                            </>
                          ) : (
                            <>
                              <span>
                                Parceiro: <strong>{off.partnerName || '—'}</strong>
                              </span>
                              {off.originChannel === 'parceiro_consignado_mercado' ? (
                                <span>
                                  Custódia Física no Mercado:{' '}
                                  <strong className="text-amber-300">
                                    {off.consignedAvailableQty} disp. /{' '}
                                    {off.consignedPhysicalQty} físico
                                  </strong>{' '}
                                  ({off.custodyLocation || 'Área Consignada'})
                                </span>
                              ) : (
                                <span>
                                  Disponibilidade no Parceiro:{' '}
                                  <strong className="text-sky-300">
                                    {off.partnerReportedAvailableQty} {off.unit}
                                  </strong>
                                  {off.availabilityExpiresAt &&
                                    ` (válida até ${formatDateTime(off.availabilityExpiresAt)})`}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {off.auditTrail && off.auditTrail.length > 0 && (
                          <div className="text-[11px] text-[var(--adm-text-dim)]">
                            Último evento: {off.auditTrail[0].action} por{' '}
                            {off.auditTrail[0].actorName} em{' '}
                            {formatDateTime(off.auditTrail[0].timestamp)}
                          </div>
                        )}
                      </div>

                      {/* Actions per Lifecycle & Origin */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {perms.canApproveProductOrOffer && (
                          <button
                            type="button"
                            onClick={() => {
                              setApprovalModalOffer(off);
                              setApprovalComment('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30 text-xs font-bold"
                          >
                            Aprovar / Revisar Produto
                          </button>
                        )}

                        {isOwn &&
                          off.ownLifecycleStatus === 'aprovado_para_compra' && (
                            <button
                              type="button"
                              onClick={() => onAddApprovedOfferToPurchaseDraft(off)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold inline-flex items-center gap-1"
                            >
                              <ArrowRight size={13} />
                              Incluir em Lista de Compra
                            </button>
                          )}

                        {off.originChannel === 'parceiro_consignado_mercado' &&
                          perms.canManagePartnersAndCustody && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustodyModalOffer(off);
                                setCustodyMoveType('recebimento_consignacao');
                                setCustodyMoveQty(10);
                                setCustodyMoveNotes('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 text-xs font-bold"
                            >
                              Movimentar Custódia Consignada
                            </button>
                          )}

                        {off.originChannel === 'parceiro_retirada_estabelecimento' &&
                          perms.canManagePartnersAndCustody && (
                            <button
                              type="button"
                              onClick={() => {
                                setAvailModalOffer(off);
                                setAvailQtyInput(off.partnerReportedAvailableQty || 15);
                                setAvailTtlHoursInput(24);
                                setAvailNoteInput('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/30 text-xs font-bold"
                            >
                              Confirmar Disponibilidade
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditOfferModal(off);
                            setEditOfferSalePrice(off.salePrice);
                            setEditOfferCost(off.unitAcquisitionCost || 0);
                            setEditOfferReason('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text-muted)] border border-[var(--adm-border)]"
                        >
                          Alterar Preço/Custo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── MODE 2: PARCEIROS VENDEDORES, CUSTÓDIA CONSIGNADA, REPASSES & DIAGNÓSTICO ─── */}
      {mode === 'partners' && (
        <>
          {/* KPIs de Separação Financeira: Receita Própria vs Repasse de Parceiros */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[12px] p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-[var(--adm-text)]">
                  Conciliação Financeira: Receita Própria do Mercado vs. Repasses a Parceiros
                </h2>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  O valor pertencente ao parceiro nunca é contabilizado como receita própria ou lucro do Mercado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPartnerId(null);
                  setPartnerName('');
                  setPartnerTradeName('');
                  setPartnerModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-extrabold text-xs self-start"
              >
                <Plus size={14} />
                Novo Parceiro Vendedor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--adm-bg)] border border-[var(--adm-border)]">
                <div className="text-[11px] text-[var(--adm-text-muted)]">
                  Receita Produtos Próprios
                </div>
                <div className="text-base font-extrabold text-emerald-300 mt-1">
                  {formatCurrency(financialSeparation.ownProductsGrossRevenue)}
                </div>
                <div className="text-[11px] text-[var(--adm-text-dim)]">
                  Lucro bruto próprio:{' '}
                  {formatCurrency(financialSeparation.ownProductsGrossProfit)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--adm-bg)] border border-[var(--adm-border)]">
                <div className="text-[11px] text-[var(--adm-text-muted)]">
                  GMV Vendas de Parceiros
                </div>
                <div className="text-base font-extrabold text-[var(--adm-text)] mt-1">
                  {formatCurrency(financialSeparation.partnerSalesCustomerTotal)}
                </div>
                <div className="text-[11px] text-[var(--adm-text-dim)]">
                  Pago pelos clientes (B + C)
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--adm-bg)] border border-amber-500/30">
                <div className="text-[11px] text-amber-200 font-semibold">
                  Valor Devido aos Parceiros
                </div>
                <div className="text-base font-extrabold text-amber-300 mt-1">
                  {formatCurrency(financialSeparation.partnerRepasseTotalDue)}
                </div>
                <div className="text-[11px] text-[var(--adm-text-dim)]">
                  Liquidado: {formatCurrency(financialSeparation.partnerRepasseLiquidado)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--adm-bg)] border border-emerald-500/30">
                <div className="text-[11px] text-emerald-200 font-semibold">
                  Comissão Bruta do Mercado
                </div>
                <div className="text-base font-extrabold text-emerald-300 mt-1">
                  {formatCurrency(financialSeparation.mercadoPartnerGrossCommission)}
                </div>
                <div className="text-[11px] text-[var(--adm-text-dim)]">
                  Contrib. após custos:{' '}
                  {formatCurrency(financialSeparation.mercadoPartnerNetContribution)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--adm-bg)] border border-sky-500/30">
                <div className="text-[11px] text-sky-200 font-semibold">
                  Receita Real do Mercado
                </div>
                <div className="text-base font-extrabold text-sky-300 mt-1">
                  {formatCurrency(financialSeparation.mercadoTrueRecognizedRevenue)}
                </div>
                <div className="text-[11px] text-[var(--adm-text-dim)]">
                  Própria + Comissão (Sem repasse)
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Parceiros Vendedores & Preparação de Perfil Público */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[12px] p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
              Parceiros Vendedores Cadastrados & Regras Comerciais ({partners.length})
            </h3>

            {partners.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--adm-text-muted)] border border-dashed border-[var(--adm-border)] rounded-xl">
                Nenhum parceiro comercial cadastrado ainda. Clique em "Novo Parceiro Vendedor" para configurar consignação ou retirada externa.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {partners.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-sm text-[var(--adm-text)]">
                          {p.tradeName || p.name}
                        </div>
                        <div className="text-[11px] text-[var(--adm-text-muted)]">
                          Contato: {p.contactName || '—'} • {p.phone || '—'} • Pix:{' '}
                          {p.pixKey || '—'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                        Perfil Público:{' '}
                        {p.publicProfile?.published ? 'Publicado' : 'Oculto (published=false)'}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--adm-text-muted)] space-y-1">
                      <div>
                        Canal padrão:{' '}
                        <strong className="text-emerald-300">
                          {SUPPLY_ORIGIN_SHORT_LABELS[p.defaultChannel]}
                        </strong>{' '}
                        • Validade de disponibilidade: <strong>{p.availabilityTtlHours}h</strong>
                      </div>
                      <div>
                        Regra Comercial (v{p.currentCommercialRule.version}):{' '}
                        <strong className="text-amber-300">
                          {p.currentCommercialRule.ruleType === 'percentual_comissao'
                            ? `${p.currentCommercialRule.commissionPct}% comissão Mercado`
                            : p.currentCommercialRule.ruleType === 'valor_fixo_unidade'
                            ? `${formatCurrency(p.currentCommercialRule.fixedFeePerUnit || 0)} fixo/un.`
                            : `Repasse líquido ${formatCurrency(p.currentCommercialRule.partnerNetUnitAmount || 0)}/un.`}
                        </strong>
                      </div>
                      <div>
                        Endereço / Coleta: {p.address || 'Não informado'} ({p.pickupInstructions})
                      </div>
                      <div className="text-[11px] text-amber-200/90">
                        Responsabilidade Fiscal/NF:{' '}
                        <strong>{p.currentCommercialRule.fiscalResponsibilityPolicy}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Livro Razão de Custódia Consignada (`custody_movements`) */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[12px] p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
              Trilha Auditada de Custódia Consignada no Mercado ({custodyMovements.length})
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Movimentações de mercadorias que estão fisicamente no Mercado sob propriedade de parceiros (não somam ao estoque próprio).
            </p>
            {custodyMovements.length === 0 ? (
              <div className="p-4 text-xs text-[var(--adm-text-muted)] border border-dashed border-[var(--adm-border)] rounded-lg">
                Nenhuma movimentação de custódia consignada registrada até o momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--adm-border)] text-[10px] uppercase text-[var(--adm-text-muted)]">
                      <th className="py-2 pr-2">Data/Hora</th>
                      <th className="py-2 px-2">Produto</th>
                      <th className="py-2 px-2">Parceiro (Proprietário)</th>
                      <th className="py-2 px-2">Tipo de Movimento</th>
                      <th className="py-2 px-2">Variação</th>
                      <th className="py-2 px-2">Saldo Custódia</th>
                      <th className="py-2 pl-2">Custodiante / Local</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--adm-border)]">
                    {custodyMovements.slice(0, 20).map((mov) => (
                      <tr key={mov.id}>
                        <td className="py-2 pr-2 text-[var(--adm-text-muted)]">
                          {formatDateTime(mov.timestamp)}
                        </td>
                        <td className="py-2 px-2 font-bold text-[var(--adm-text)]">
                          {mov.productTitle}
                        </td>
                        <td className="py-2 px-2 text-amber-300">{mov.partnerName}</td>
                        <td className="py-2 px-2">
                          {CUSTODY_MOVEMENT_LABELS[mov.movementType]}
                        </td>
                        <td
                          className={`py-2 px-2 font-bold ${
                            mov.deltaQty >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {mov.deltaQty >= 0 ? `+${mov.deltaQty}` : mov.deltaQty}
                        </td>
                        <td className="py-2 px-2 font-bold text-[var(--adm-text)]">
                          {mov.previousQty} → {mov.newQty}
                        </td>
                        <td className="py-2 pl-2 text-[var(--adm-text-muted)]">
                          {mov.custodianName} ({mov.custodyLocation})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Diagnóstico de Compatibilidade do Catálogo Existente (Seção 13) */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[12px] p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
              Diagnóstico de Compatibilidade do Catálogo Existente (Sem Reclassificação Forçada)
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Todos os {catalogDiagnostic.totalCatalogProducts} produtos existentes continuam funcionando normalmente. Itens sem custo/fornecedor ou origem explícita são listados abaixo para revisão gradual.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)]">
                <div className="text-[var(--adm-text-muted)]">Mapeados Próprios (A)</div>
                <div className="text-base font-extrabold text-emerald-300">
                  {catalogDiagnostic.mappedOwnProductsCount}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)]">
                <div className="text-[var(--adm-text-muted)]">Consignados (B)</div>
                <div className="text-base font-extrabold text-amber-300">
                  {catalogDiagnostic.mappedConsignedProductsCount}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)]">
                <div className="text-[var(--adm-text-muted)]">Retirada Externa (C)</div>
                <div className="text-base font-extrabold text-sky-300">
                  {catalogDiagnostic.mappedExternalPickupCount}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)]">
                <div className="text-[var(--adm-text-muted)]">
                  Legado sem Custo/Fornecedor
                </div>
                <div className="text-base font-extrabold text-rose-300">
                  {catalogDiagnostic.unclassifiedLegacyCount}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── MODAL: APROVAÇÃO DE PRODUTO / OFERTA (SEPARADA DA COMPRA) ─── */}
      {approvalModalOffer && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-lg w-full p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
              Decisão de Aprovação do Produto / Oferta: {approvalModalOffer.productTitle}
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Origem: <strong>{SUPPLY_ORIGIN_LABELS[approvalModalOffer.originChannel]}</strong> • Preço de venda:{' '}
              <strong>{formatCurrency(approvalModalOffer.salePrice)}</strong>.
              {approvalModalOffer.originChannel === 'mercado_proprio' &&
                ' Aprovar o produto autoriza sua inclusão em listas de compra, mas NÃO adiciona estoque antes do recebimento físico.'}
            </p>
            <div>
              <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                Comentário / Parecer da Autorização *
              </label>
              <textarea
                rows={3}
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Justifique a aprovação, pedido de ajuste ou rejeição..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setApprovalModalOffer(null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--adm-bg)] text-xs font-semibold text-[var(--adm-text-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!approvalComment.trim()) {
                    showToast('Informe um comentário para devolver para ajustes.', 'error');
                    return;
                  }
                  setBusy(true);
                  try {
                    await authorizeProductOffer(
                      approvalModalOffer,
                      'return_for_adjustment',
                      actor,
                      approvalComment,
                    );
                    await onRefreshAll();
                    setApprovalModalOffer(null);
                    showToast('Devolvido para ajustes com registro na auditoria.', 'success');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 text-xs font-bold"
              >
                Devolver p/ Ajustes
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!approvalComment.trim()) {
                    showToast('Informe o motivo da rejeição.', 'error');
                    return;
                  }
                  setBusy(true);
                  try {
                    await authorizeProductOffer(
                      approvalModalOffer,
                      'reject',
                      actor,
                      approvalComment,
                    );
                    await onRefreshAll();
                    setApprovalModalOffer(null);
                    showToast('Produto/Oferta rejeitado.', 'success');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 text-xs font-bold"
              >
                Rejeitar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await authorizeProductOffer(
                      approvalModalOffer,
                      'approve',
                      actor,
                      approvalComment || 'Aprovado conforme parâmetros comerciais.',
                    );
                    await onRefreshAll();
                    setApprovalModalOffer(null);
                    showToast('Produto/Oferta aprovado com sucesso!', 'success');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-[var(--adm-brand)] text-emerald-950 text-xs font-extrabold"
              >
                Aprovar Produto/Oferta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: MOVIMENTAR CUSTÓDIA CONSIGNADA (MODELO B) ─── */}
      {custodyModalOffer && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-lg w-full p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
              Movimentar Custódia Consignada: {custodyModalOffer.productTitle}
            </h3>
            <p className="text-xs text-amber-200/90">
              Propriedade: <strong>PARCEIRO ({custodyModalOffer.partnerName})</strong> • Saldo atual em custódia no Mercado:{' '}
              <strong>{custodyModalOffer.consignedPhysicalQty} físico</strong> ({custodyModalOffer.consignedAvailableQty} disponível). Esta operação NÃO altera o estoque próprio do Mercado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Tipo de Movimento
                </label>
                <select
                  value={custodyMoveType}
                  onChange={(e) =>
                    setCustodyMoveType(e.target.value as CustodyMovementType)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="recebimento_consignacao">
                    Entrada em Consignação (+Custódia)
                  </option>
                  <option value="baixa_venda_consignada">
                    Baixa por Venda Consignada (-Custódia)
                  </option>
                  <option value="devolucao_ao_parceiro">
                    Devolução ao Parceiro (-Custódia)
                  </option>
                  <option value="perda_ou_avaria">
                    Perda ou Avaria (-Custódia)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Quantidade ({custodyModalOffer.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  value={custodyMoveQty}
                  onChange={(e) =>
                    setCustodyMoveQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                Observação / Comprovante de Conferência *
              </label>
              <input
                type="text"
                value={custodyMoveNotes}
                onChange={(e) => setCustodyMoveNotes(e.target.value)}
                placeholder="Ex.: Guia de remessa consignada #104 conferida no balcão"
                className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustodyModalOffer(null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--adm-bg)] text-xs text-[var(--adm-text-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!custodyMoveNotes.trim()) {
                    showToast('Informe a observação de conferência da custódia.', 'error');
                    return;
                  }
                  setBusy(true);
                  try {
                    await recordPartnerCustodyMovement(
                      custodyModalOffer,
                      {
                        movementType: custodyMoveType,
                        quantity: custodyMoveQty,
                        notes: custodyMoveNotes,
                      },
                      actor,
                    );
                    await onRefreshAll();
                    setCustodyModalOffer(null);
                    showToast(
                      'Movimentação de custódia consignada registrada com sucesso!',
                      'success',
                    );
                  } catch (err) {
                    showToast(
                      err instanceof Error ? err.message : 'Erro na custódia.',
                      'error',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-[var(--adm-brand)] text-emerald-950 text-xs font-extrabold"
              >
                Confirmar Movimento de Custódia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONFIRMAR DISPONIBILIDADE EXTERNA NO PARCEIRO (MODELO C) ─── */}
      {availModalOffer && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
              Confirmar Disponibilidade no Parceiro: {availModalOffer.productTitle}
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Parceiro: <strong>{availModalOffer.partnerName}</strong>. A quantidade fica no estabelecimento do parceiro (não é somada ao estoque físico do Mercado) e expira automaticamente após o prazo configurado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Qtd. Disponível no Parceiro ({availModalOffer.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  value={availQtyInput}
                  onChange={(e) =>
                    setAvailQtyInput(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Validade da Confirmação (Horas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={availTtlHoursInput}
                  onChange={(e) =>
                    setAvailTtlHoursInput(
                      Math.max(1, Math.floor(Number(e.target.value) || 24)),
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                Observação (Ex.: confirmado via WhatsApp com gerente)
              </label>
              <input
                type="text"
                value={availNoteInput}
                onChange={(e) => setAvailNoteInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAvailModalOffer(null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--adm-bg)] text-xs text-[var(--adm-text-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await confirmPartnerOfferAvailability(
                      availModalOffer,
                      availQtyInput,
                      availTtlHoursInput,
                      actor,
                      availNoteInput,
                    );
                    await onRefreshAll();
                    setAvailModalOffer(null);
                    showToast(
                      `Disponibilidade de ${availQtyInput} ${availModalOffer.unit} confirmada por ${availTtlHoursInput}h!`,
                      'success',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-[var(--adm-brand)] text-emerald-950 text-xs font-extrabold"
              >
                Confirmar Disponibilidade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ALTERAR PREÇO/CUSTO COM GUARDA DE REVALIDAÇÃO PÓS-APROVAÇÃO ─── */}
      {editOfferModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-[var(--adm-text)]">
              Alterar Parâmetros: {editOfferModal.productTitle}
            </h3>
            <p className="text-xs text-amber-200/90">
              Atenção: Alterar o preço de venda ou aumentar o custo após a aprovação invalida automaticamente a autorização anterior e retorna o item para nova aprovação.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Novo Preço de Venda (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editOfferSalePrice}
                  onChange={(e) => setEditOfferSalePrice(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              {editOfferModal.originChannel === 'mercado_proprio' && (
                <div>
                  <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                    Novo Custo Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editOfferCost}
                    onChange={(e) => setEditOfferCost(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                Motivo da Alteração *
              </label>
              <input
                type="text"
                value={editOfferReason}
                onChange={(e) => setEditOfferReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOfferModal(null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--adm-bg)] text-xs text-[var(--adm-text-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await updateProductOfferWithGuard(
                      editOfferModal,
                      {
                        salePrice: roundCurrency(editOfferSalePrice),
                        unitAcquisitionCost:
                          editOfferModal.originChannel === 'mercado_proprio'
                            ? roundCurrency(editOfferCost)
                            : editOfferModal.unitAcquisitionCost,
                      },
                      actor,
                      editOfferReason,
                    );
                    await onRefreshAll();
                    setEditOfferModal(null);
                    showToast(
                      res.approvalInvalidated
                        ? `Alteração exige nova aprovação: ${res.invalidationReasons.join(' ')}`
                        : 'Oferta atualizada com sucesso.',
                      res.approvalInvalidated ? 'error' : 'success',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-[var(--adm-brand)] text-emerald-950 text-xs font-extrabold"
              >
                Salvar Alteração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CADASTRAR PARCEIRO VENDEDOR (SEÇÃO 9 E 12) ─── */}
      {partnerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl max-w-2xl w-full p-5 space-y-4 my-8">
            <h3 className="text-base font-extrabold text-[var(--adm-text)]">
              Cadastrar Parceiro Vendedor (Consignação ou Retirada Externa)
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Entidade separada de Fornecedor. Modela regra comercial versionada, instruções de coleta e preparação controlada para perfil público futuro (mantido como <code>published = false</code> nesta etapa).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Razão Social / Nome *
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Ex.: Padaria Artesanal do Bairro Ltda"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Nome Fantasia / Público
                </label>
                <input
                  type="text"
                  value={partnerTradeName}
                  onChange={(e) => setPartnerTradeName(e.target.value)}
                  placeholder="Ex.: Padaria Dom Bosco"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Responsável / Contato
                </label>
                <input
                  type="text"
                  value={partnerContact}
                  onChange={(e) => setPartnerContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Telefone / WhatsApp Operacional
                </label>
                <input
                  type="text"
                  value={partnerPhone}
                  onChange={(e) => setPartnerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Chave Pix para Repasse
                </label>
                <input
                  type="text"
                  value={partnerPixKey}
                  onChange={(e) => setPartnerPixKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Modalidade Padrão do Parceiro
                </label>
                <select
                  value={partnerDefaultChannel}
                  onChange={(e) =>
                    setPartnerDefaultChannel(
                      e.target.value as
                        | 'parceiro_consignado_mercado'
                        | 'parceiro_retirada_estabelecimento',
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="parceiro_consignado_mercado">
                    B. Consignado Fisicamente no Mercado
                  </option>
                  <option value="parceiro_retirada_estabelecimento">
                    C. Retirada pelo Entregador no Parceiro
                  </option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Tipo de Regra Comercial
                </label>
                <select
                  value={partnerRuleType}
                  onChange={(e) =>
                    setPartnerRuleType(e.target.value as PartnerCommercialRuleType)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="percentual_comissao">Comissão Percentual (%)</option>
                  <option value="valor_fixo_unidade">Valor Fixo p/ Unidade (R$)</option>
                  <option value="preco_liquido_parceiro">
                    Preço Líquido do Parceiro (R$)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Valor / Percentual da Regra
                </label>
                {partnerRuleType === 'percentual_comissao' && (
                  <input
                    type="number"
                    step="0.5"
                    value={partnerRuleCommPct}
                    onChange={(e) => setPartnerRuleCommPct(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                )}
                {partnerRuleType === 'valor_fixo_unidade' && (
                  <input
                    type="number"
                    step="0.1"
                    value={partnerRuleFixedFee}
                    onChange={(e) => setPartnerRuleFixedFee(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                )}
                {partnerRuleType === 'preco_liquido_parceiro' && (
                  <input
                    type="number"
                    step="0.1"
                    value={partnerRuleNetAmount}
                    onChange={(e) => setPartnerRuleNetAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                  />
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Definição Fiscal / NF
                </label>
                <select
                  value={partnerFiscalPolicy}
                  onChange={(e) =>
                    setPartnerFiscalPolicy(
                      e.target.value as
                        | 'definicao_pendente'
                        | 'parceiro_emite_nf'
                        | 'mercado_intermediador',
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                >
                  <option value="definicao_pendente">
                    Definição Fiscal Pendente
                  </option>
                  <option value="parceiro_emite_nf">
                    Parceiro Emite NF ao Cliente
                  </option>
                  <option value="mercado_intermediador">
                    Mercado Intermediador / Consignação
                  </option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Endereço p/ Retirada pelo Entregador
                </label>
                <input
                  type="text"
                  value={partnerAddress}
                  onChange={(e) => setPartnerAddress(e.target.value)}
                  placeholder="Rua, Número, Loja..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--adm-text-muted)] mb-1">
                  Instruções Operacionais de Coleta
                </label>
                <input
                  type="text"
                  value={partnerPickupInstructions}
                  onChange={(e) => setPartnerPickupInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPartnerModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-[var(--adm-bg)] text-xs text-[var(--adm-text-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSavePartner}
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 text-xs font-extrabold"
              >
                Salvar Parceiro Vendedor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
