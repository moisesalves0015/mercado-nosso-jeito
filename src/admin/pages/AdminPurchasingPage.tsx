import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData } from '../AdminDataContext';
import {
  EmptyState,
  formatCurrency,
  formatDateTime,
  MetricCard,
  PageHeader,
} from '../components/AdminUi';
import {
  analyzeProductReplenishment,
  computeFinancialScenarios,
  computePurchaseListSummary,
  isPartnerOfferAvailabilityExpired,
  PURCHASE_STATUS_LABELS,
  resolvePurchasingPermissions,
  roundCurrency,
  type CustodyMovementRecord,
  type NewProductHypothesis,
  type PartnerSettlementRecord,
  type PartnerVendorRecord,
  type ProductCommercialStatus,
  type ProductOfferRecord,
  type PurchaseListItem,
  type PurchaseListRecord,
  type PurchaseListStatus,
  type PurchaseReason,
  type PurchasingProductMetadata,
  type ReplenishmentAnalysisResult,
  type SupplierQuoteRecord,
  type SupplierRecord,
} from '../../utils/purchasingEngine';
import {
  addSupplierQuote,
  authorizePurchaseList,
  cancelPurchaseList,
  duplicatePurchaseListAsDraft,
  listCustodyMovements,
  listPartnerSettlements,
  listPartnerVendors,
  listProductOffers,
  listPurchaseLists,
  listPurchasingProductMeta,
  listSupplierQuotes,
  listSuppliers,
  recordPurchaseReceipt,
  savePurchasingProductMeta,
  saveSupplier,
  startPurchaseExecution,
  submitPurchaseListForApproval,
  upsertPurchaseListWithGuard,
} from '../../services/purchasingService';
import { PurchasingMultiOriginWorkspace } from '../components/PurchasingMultiOriginWorkspace';

type PurchasingTabId =
  | 'overview'
  | 'onboarding'
  | 'planning'
  | 'lists'
  | 'products'
  | 'partners'
  | 'suppliers'
  | 'analytics';

const REASON_LABELS: Record<PurchaseReason, string> = {
  reposicao: 'Reposição de Estoque',
  novo_produto: 'Novo Produto / Teste',
  sazonalidade: 'Sazonalidade / Evento',
  manual: 'Solicitação Manual',
  promocao: 'Campanha Promocional',
  seguranca: 'Reforço de Segurança',
};

const URGENCY_BADGE: Record<
  ReplenishmentAnalysisResult['urgencyLevel'],
  { label: string; cls: string }
> = {
  critico: {
    label: 'Crítico / Ruptura',
    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  atencao: {
    label: 'Repor Agora',
    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  confortavel: {
    label: 'Cobertura OK',
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  sem_historico: {
    label: 'Novo / Sem Vendas',
    cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  pausado: {
    label: 'Pausado / Inativo',
    cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
};

const STATUS_BADGE_STYLE: Record<PurchaseListStatus, string> = {
  rascunho: 'bg-slate-500/15 text-slate-200 border-slate-500/30',
  aguardando_aprovacao: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  aprovada: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejeitada: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  em_compra: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  parcialmente_recebida: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  recebida: 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40',
  cancelada: 'bg-rose-950/50 text-rose-400 border-rose-500/20',
};

export const AdminPurchasingPage: React.FC = () => {
  const { user, userProfile, staffAccess, canAny } = useAuth();
  const {
    orders,
    products,
    loading: contextLoading,
    dataError,
    showToast,
    handleAdjustStock,
  } = useAdminData();

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as PurchasingTabId) || 'overview';

  const setTab = (nextTab: PurchasingTabId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next, { replace: true });
  };

  const perms = useMemo(() => resolvePurchasingPermissions(canAny), [canAny]);

  const actor = useMemo(
    () => ({
      uid: user?.uid || 'staff',
      name: userProfile?.name || user?.email || 'Operador',
      role: staffAccess?.roleId || 'admin',
    }),
    [user, userProfile, staffAccess],
  );

  // Collections state
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [quotes, setQuotes] = useState<SupplierQuoteRecord[]>([]);
  const [productMetaMap, setProductMetaMap] = useState<Record<string, PurchasingProductMetadata>>({});
  const [purchaseLists, setPurchaseLists] = useState<PurchaseListRecord[]>([]);
  const [partners, setPartners] = useState<PartnerVendorRecord[]>([]);
  const [offers, setOffers] = useState<ProductOfferRecord[]>([]);
  const [custodyMovements, setCustodyMovements] = useState<CustodyMovementRecord[]>([]);
  const [settlements, setSettlements] = useState<PartnerSettlementRecord[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Filters for Planning & Products
  const [periodDays, setPeriodDays] = useState<number>(() => {
    const saved = sessionStorage.getItem('mnj_purch_period');
    return saved ? Number(saved) || 30 : 30;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [onlyConfirmedSales, setOnlyConfirmedSales] = useState(false);

  // Active Purchase List Editor State
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listTitle, setListTitle] = useState('Reposição Semanal do Mercado');
  const [listPurpose, setListPurpose] = useState('Reposição preventiva de itens de alto giro');
  const [listDesiredDate, setListDesiredDate] = useState(() =>
    new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
  );
  const [listPaymentTerms, setListPaymentTerms] = useState('Pix / Boleto 7 dias');
  const [listNotes, setListNotes] = useState('');
  const [listFreight, setListFreight] = useState(0);
  const [listTax, setListTax] = useState(0);
  const [listOtherCost, setListOtherCost] = useState(0);
  const [listItems, setListItems] = useState<PurchaseListItem[]>([]);

  // Detail & Governance Modal
  const [detailListModal, setDetailListModal] = useState<PurchaseListRecord | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [buyerNameInput, setBuyerNameInput] = useState('');

  // Receipt Modal
  const [receiptModalList, setReceiptModalList] = useState<PurchaseListRecord | null>(null);
  const [receiptDraftItems, setReceiptDraftItems] = useState<PurchaseListItem[]>([]);
  const [receiptInvoiceRef, setReceiptInvoiceRef] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptJustification, setReceiptJustification] = useState('');
  const [receiptApplyToStock, setReceiptApplyToStock] = useState(true);

  // Supplier & Quote Modals
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Partial<SupplierRecord> & { name: string }>({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    document: '',
    paymentTerms: 'Boleto 7/14 dias',
    leadTimeDays: 3,
    minOrderValue: 150,
    notes: '',
    status: 'active',
    suppliedProductIds: [],
  });

  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    productId: '',
    supplierId: '',
    unitCost: 5,
    unit: 'UN',
    minQuantity: 6,
    packMultiple: 6,
    leadTimeDays: 3,
    validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    notes: '',
  });

  // Product Config & New Product Hypothesis Modal
  const [productConfigModal, setProductConfigModal] = useState<ReplenishmentAnalysisResult | null>(
    null,
  );
  const [productConfigForm, setProductConfigForm] = useState<{
    primarySupplierId: string;
    minLot: number;
    packMultiple: number;
    leadTimeDays: number;
    safetyStockDays: number;
    commercialStatus: ProductCommercialStatus;
    hasHypothesis: boolean;
    inclusionReason: string;
    quotedUnitCost: number;
    plannedSalePrice: number;
    initialPlannedQty: number;
    confidenceLevel: 'baixa' | 'media' | 'alta';
    confidenceJustification: string;
    conservadorQty: number;
    baseQty: number;
    otimistaQty: number;
    notes: string;
  }>({
    primarySupplierId: '',
    minLot: 1,
    packMultiple: 1,
    leadTimeDays: 3,
    safetyStockDays: 4,
    commercialStatus: 'ativo',
    hasHypothesis: false,
    inclusionReason: 'Ampliação de mix / solicitação de clientes',
    quotedUnitCost: 5,
    plannedSalePrice: 9.9,
    initialPlannedQty: 12,
    confidenceLevel: 'media',
    confidenceJustification: 'Categoria com boa saída na loja',
    conservadorQty: 10,
    baseQty: 24,
    otimistaQty: 50,
    notes: '',
  });

  // Financial Simulator State (Tab 6)
  const [simProductId, setSimProductId] = useState<string>('');
  const [simUnitCost, setSimUnitCost] = useState<number>(8);
  const [simSalePrice, setSimSalePrice] = useState<number>(14.9);
  const [simPlannedQty, setSimPlannedQty] = useState<number>(24);
  const [simFreight, setSimFreight] = useState<number>(0);
  const [simTax, setSimTax] = useState<number>(0);
  const [simCustomVol, setSimCustomVol] = useState<number>(30);

  const loadPurchasingData = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const [
        supList,
        qtList,
        metaMap,
        pLists,
        prtList,
        offList,
        custList,
        settlList,
      ] = await Promise.all([
        listSuppliers(),
        listSupplierQuotes(),
        listPurchasingProductMeta(),
        listPurchaseLists(),
        listPartnerVendors(),
        listProductOffers(),
        listCustodyMovements(),
        listPartnerSettlements(),
      ]);
      setSuppliers(supList);
      setQuotes(qtList);
      setProductMetaMap(metaMap);
      setPurchaseLists(pLists);
      setPartners(prtList);
      setOffers(offList);
      setCustodyMovements(custList);
      setSettlements(settlList);
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  useEffect(() => {
    void loadPurchasingData();
  }, [loadPurchasingData]);

  useEffect(() => {
    sessionStorage.setItem('mnj_purch_period', String(periodDays));
  }, [periodDays]);

  const ordersUnavailable = Boolean(dataError && orders.length === 0);

  // Replenishment analysis for all catalog products
  const analyses = useMemo(() => {
    const ordersInput = ordersUnavailable ? null : orders;
    return products.map((product) =>
      analyzeProductReplenishment({
        product,
        meta: productMetaMap[product.id] || null,
        orders: ordersInput,
        purchaseLists,
        suppliers,
        quotes,
        periodDays,
        onlyRecognizedSales: onlyConfirmedSales,
      }),
    );
  }, [
    products,
    productMetaMap,
    orders,
    ordersUnavailable,
    purchaseLists,
    suppliers,
    quotes,
    periodDays,
    onlyConfirmedSales,
  ]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [products]);

  const filteredAnalyses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return analyses
      .filter((a) => {
        if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
        if (
          supplierFilter !== 'all' &&
          a.preferredSupplierId !== supplierFilter &&
          a.preferredSupplierName !== supplierFilter
        ) {
          return false;
        }
        if (urgencyFilter === 'needs_replenishment' && !a.needsReplenishment) return false;
        if (urgencyFilter === 'critico' && a.urgencyLevel !== 'critico') return false;
        if (urgencyFilter === 'atencao' && a.urgencyLevel !== 'atencao') return false;
        if (urgencyFilter === 'sem_historico' && a.historyState !== 'sem_vendas_registradas') {
          return false;
        }
        if (urgencyFilter === 'incomplete' && a.missingDataWarnings.length === 0) return false;

        if (q) {
          const matchTitle = a.productTitle.toLowerCase().includes(q);
          const matchSku = a.sku.toLowerCase().includes(q);
          const matchSup = a.preferredSupplierName.toLowerCase().includes(q);
          if (!matchTitle && !matchSku && !matchSup) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rank = { critico: 0, atencao: 1, sem_historico: 2, confortavel: 3, pausado: 4 };
        const diff = rank[a.urgencyLevel] - rank[b.urgencyLevel];
        if (diff !== 0) return diff;
        return b.unitsSoldInPeriod - a.unitsSoldInPeriod;
      });
  }, [analyses, searchQuery, categoryFilter, supplierFilter, urgencyFilter]);

  const overviewStats = useMemo(() => {
    const criticalItems = analyses.filter((a) => a.urgencyLevel === 'critico');
    const attentionItems = analyses.filter((a) => a.urgencyLevel === 'atencao');
    const suggestedItems = analyses.filter((a) => a.needsReplenishment && a.suggestedQty > 0);
    const newNoHistoryItems = analyses.filter(
      (a) => a.historyState === 'sem_vendas_registradas',
    );
    const incompleteDataItems = analyses.filter((a) => a.missingDataWarnings.length > 0);

    const totalSuggestedOutlay = roundCurrency(
      suggestedItems.reduce((sum, a) => sum + a.estimatedReplenishmentCost, 0),
    );

    const awaitingApprovalLists = purchaseLists.filter(
      (l) => l.status === 'aguardando_aprovacao',
    );
    const approvedLists = purchaseLists.filter((l) => l.status === 'aprovada');
    const inExecutionLists = purchaseLists.filter(
      (l) => l.status === 'em_compra' || l.status === 'parcialmente_recebida',
    );
    const completedLists = purchaseLists.filter((l) => l.status === 'recebida');
    const draftLists = purchaseLists.filter((l) => l.status === 'rascunho');

    const plannedBudgetTotal = roundCurrency(
      [...draftLists, ...awaitingApprovalLists].reduce(
        (s, l) => s + Number(l.estimatedGrandTotal || 0),
        0,
      ),
    );
    const authorizedPendingSpend = roundCurrency(
      [...approvedLists, ...inExecutionLists].reduce(
        (s, l) => s + Number(l.approvedLimitTotal ?? l.estimatedGrandTotal ?? 0),
        0,
      ),
    );
    const realizedSpendTotal = roundCurrency(
      completedLists.reduce(
        (s, l) => s + Number(l.effectiveGrandTotal || l.estimatedGrandTotal || 0),
        0,
      ),
    );

    const supplierSpendMap = new Map<
      string,
      { name: string; planned: number; realized: number; count: number }
    >();
    for (const list of purchaseLists) {
      if (list.status === 'cancelada' || list.status === 'rejeitada') continue;
      const isRealized = list.status === 'recebida';
      for (const item of list.items || []) {
        const key = item.supplierName || 'Fornecedor não definido';
        const cur = supplierSpendMap.get(key) || {
          name: key,
          planned: 0,
          realized: 0,
          count: 0,
        };
        const val = isRealized
          ? roundCurrency(
              Number(item.purchasedQty || item.requestedQty || 0) *
                Number(item.effectiveUnitCost || item.quotedUnitCost || 0),
            )
          : roundCurrency(Number(item.estimatedItemTotal || 0));
        if (isRealized) cur.realized = roundCurrency(cur.realized + val);
        else cur.planned = roundCurrency(cur.planned + val);
        cur.count += 1;
        supplierSpendMap.set(key, cur);
      }
    }

    return {
      criticalItems,
      attentionItems,
      suggestedItems,
      newNoHistoryItems,
      incompleteDataItems,
      totalSuggestedOutlay,
      awaitingApprovalLists,
      approvedLists,
      inExecutionLists,
      completedLists,
      draftLists,
      plannedBudgetTotal,
      authorizedPendingSpend,
      realizedSpendTotal,
      supplierConcentration: Array.from(supplierSpendMap.values()).sort(
        (a, b) => b.realized + b.planned - (a.realized + a.planned),
      ),
    };
  }, [analyses, purchaseLists]);

  const activeDraftSummary = useMemo(
    () =>
      computePurchaseListSummary({
        items: listItems,
        freightCost: listFreight,
        taxCost: listTax,
        otherCost: listOtherCost,
      }),
    [listItems, listFreight, listTax, listOtherCost],
  );

  // Simulator selection
  const selectedAnalysisForSim = useMemo(() => {
    const found = analyses.find((a) => a.productId === simProductId);
    return found || analyses[0] || null;
  }, [analyses, simProductId]);

  useEffect(() => {
    if (selectedAnalysisForSim) {
      setSimSalePrice(selectedAnalysisForSim.salePrice);
      setSimUnitCost(
        selectedAnalysisForSim.unitCost > 0
          ? selectedAnalysisForSim.unitCost
          : roundCurrency(selectedAnalysisForSim.salePrice * 0.65),
      );
      const metaHyp = productMetaMap[selectedAnalysisForSim.productId]?.newProductHypothesis;
      setSimPlannedQty(
        selectedAnalysisForSim.suggestedQty > 0
          ? selectedAnalysisForSim.suggestedQty
          : metaHyp?.initialPlannedQty || 24,
      );
    }
  }, [selectedAnalysisForSim?.productId, productMetaMap]);

  const financialSimulation = useMemo(
    () =>
      computeFinancialScenarios({
        unitCost: simUnitCost,
        salePrice: simSalePrice,
        plannedPurchaseQty: simPlannedQty,
        freightCost: simFreight,
        taxCost: simTax,
        otherCost: 0,
        customVolumes: [simCustomVol],
      }),
    [simUnitCost, simSalePrice, simPlannedQty, simFreight, simTax, simCustomVol],
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAddItemToDraft = (
    analysis: ReplenishmentAnalysisResult,
    customQty?: number,
    reasonOverride?: PurchaseReason,
  ) => {
    const qtyToAdd = Math.max(
      1,
      Math.floor(
        customQty ?? (analysis.suggestedQty > 0 ? analysis.suggestedQty : analysis.minLot || 6),
      ),
    );
    const existingIdx = listItems.findIndex((i) => i.productId === analysis.productId);
    const defaultReason: PurchaseReason =
      reasonOverride ||
      (analysis.historyState === 'sem_vendas_registradas' ? 'novo_produto' : 'reposicao');

    if (existingIdx >= 0) {
      setListItems((prev) =>
        prev.map((item, idx) => {
          if (idx !== existingIdx) return item;
          const nextQty = item.requestedQty + qtyToAdd;
          return {
            ...item,
            requestedQty: nextQty,
            estimatedItemTotal: roundCurrency(nextQty * item.quotedUnitCost),
          };
        }),
      );
      showToast(`Quantidade de "${analysis.productTitle}" somada na lista (+${qtyToAdd}).`, 'ok');
    } else {
      const cost = analysis.unitCost > 0 ? analysis.unitCost : 1;
      const newItem: PurchaseListItem = {
        productId: analysis.productId,
        productTitle: analysis.productTitle,
        sku: analysis.sku,
        category: analysis.category,
        unit: analysis.unit,
        supplierId: analysis.preferredSupplierId || suppliers[0]?.id || '',
        supplierName:
          analysis.preferredSupplierName === 'Não definido'
            ? suppliers[0]?.name || 'Fornecedor Geral'
            : analysis.preferredSupplierName,
        requestedQty: qtyToAdd,
        quotedUnitCost: cost,
        currentSalePrice: analysis.salePrice,
        estimatedItemTotal: roundCurrency(qtyToAdd * cost),
        reason: defaultReason,
        notes: '',
        isNewProduct: analysis.historyState === 'sem_vendas_registradas',
        quoteId: analysis.bestQuote?.id,
        quoteValidUntil: analysis.bestQuote?.validUntil,
      };
      setListItems((prev) => [...prev, newItem]);
      showToast(`"${analysis.productTitle}" adicionado à lista de compras.`, 'ok');
    }
  };

  const handleAddAllSuggestedToDraft = () => {
    const suggested = analyses.filter((a) => a.needsReplenishment && a.suggestedQty > 0);
    if (suggested.length === 0) {
      showToast('Nenhum item com sugestão automática pendente no momento.', 'err');
      return;
    }
    const existingIds = new Set(listItems.map((i) => i.productId));
    const additions: PurchaseListItem[] = [];
    for (const a of suggested) {
      if (existingIds.has(a.productId)) continue;
      const cost = a.unitCost > 0 ? a.unitCost : 1;
      additions.push({
        productId: a.productId,
        productTitle: a.productTitle,
        sku: a.sku,
        category: a.category,
        unit: a.unit,
        supplierId: a.preferredSupplierId || suppliers[0]?.id || '',
        supplierName:
          a.preferredSupplierName === 'Não definido'
            ? suppliers[0]?.name || 'Fornecedor Geral'
            : a.preferredSupplierName,
        requestedQty: a.suggestedQty,
        quotedUnitCost: cost,
        currentSalePrice: a.salePrice,
        estimatedItemTotal: roundCurrency(a.suggestedQty * cost),
        reason: 'reposicao',
        notes: `Sugerido: cobertura ${a.coverageDays ?? 0}d`,
        isNewProduct: false,
        quoteId: a.bestQuote?.id,
        quoteValidUntil: a.bestQuote?.validUntil,
      });
    }
    setListItems((prev) => [...prev, ...additions]);
    showToast(`${additions.length} produto(s) sugeridos adicionados ao rascunho!`, 'ok');
    setTab('lists');
  };

  const handleLoadListIntoEditor = (list: PurchaseListRecord) => {
    setEditingListId(list.id);
    setListTitle(list.title);
    setListPurpose(list.purpose);
    setListDesiredDate(list.desiredDate);
    setListPaymentTerms(list.paymentTerms);
    setListNotes(list.notes);
    setListFreight(list.freightCost);
    setListTax(list.taxCost);
    setListOtherCost(list.otherCost);
    setListItems(list.items.map((i) => ({ ...i })));
    setTab('lists');
    showToast(`Lista "${list.code}" carregada no editor.`, 'ok');
  };

  const handleResetDraftEditor = () => {
    setEditingListId(null);
    setListTitle('Reposição Semanal do Mercado');
    setListPurpose('Reposição preventiva de itens de alto giro');
    setListDesiredDate(new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10));
    setListPaymentTerms('Pix / Boleto 7 dias');
    setListNotes('');
    setListFreight(0);
    setListTax(0);
    setListOtherCost(0);
    setListItems([]);
  };

  const handleSavePurchaseList = async (submitImmediately = false) => {
    if (!perms.canCreateAndSubmitList) {
      showToast('Sua conta não possui permissão para criar ou editar listas de compra.', 'err');
      return;
    }
    if (listItems.length === 0) {
      showToast('Adicione pelo menos 1 produto à lista antes de salvar.', 'err');
      return;
    }
    for (const item of listItems) {
      if (!Number.isFinite(item.requestedQty) || item.requestedQty <= 0) {
        showToast(`Quantidade inválida para "${item.productTitle}".`, 'err');
        return;
      }
      if (!Number.isFinite(item.quotedUnitCost) || item.quotedUnitCost < 0) {
        showToast(`Custo unitário inválido para "${item.productTitle}".`, 'err');
        return;
      }
    }

    setBusyAction('save-list');
    try {
      const existing = editingListId
        ? purchaseLists.find((l) => l.id === editingListId) || null
        : null;

      const { record, approvalInvalidated, invalidationReasons } =
        await upsertPurchaseListWithGuard(
          existing,
          {
            title: listTitle,
            purpose: listPurpose,
            desiredDate: listDesiredDate,
            notes: listNotes,
            items: listItems,
            freightCost: listFreight,
            taxCost: listTax,
            otherCost: listOtherCost,
            paymentTerms: listPaymentTerms,
          },
          actor,
          purchaseLists.length,
        );

      let finalRecord = record;
      if (submitImmediately && finalRecord.status === 'rascunho') {
        finalRecord = await submitPurchaseListForApproval(finalRecord, actor, listNotes);
      }

      await loadPurchasingData();
      setEditingListId(finalRecord.id);

      if (approvalInvalidated) {
        showToast(
          `Atenção: A lista já estava aprovada, mas a edição alterou limites (${invalidationReasons[0]}). Ela voltou para Aguardando Aprovação.`,
          'err',
        );
      } else if (submitImmediately) {
        showToast(`Lista ${finalRecord.code} enviada para aprovação!`, 'ok');
      } else {
        showToast(`Lista ${finalRecord.code} salva com sucesso!`, 'ok');
      }
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao salvar lista de compra.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmitSavedListForApproval = async (list: PurchaseListRecord) => {
    if (!perms.canCreateAndSubmitList) {
      showToast('Sem permissão para enviar lista para aprovação.', 'err');
      return;
    }
    setBusyAction(`submit-${list.id}`);
    try {
      const updated = await submitPurchaseListForApproval(list, actor);
      await loadPurchasingData();
      setDetailListModal(updated);
      showToast(`Lista ${updated.code} enviada para aprovação!`, 'ok');
    } catch (err) {
      showToast((err as Error)?.message || 'Falha ao enviar para aprovação.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAuthorizeDecision = async (
    list: PurchaseListRecord,
    decision: 'approve' | 'reject' | 'request_adjustment',
  ) => {
    if (!perms.canApproveOrReject) {
      showToast(
        'Apenas usuários com permissão de aprovação podem autorizar ou rejeitar compras.',
        'err',
      );
      return;
    }
    setBusyAction(`auth-${list.id}`);
    try {
      const updated = await authorizePurchaseList(list, decision, actor, {
        comment: approvalNote || (decision === 'approve' ? 'Aprovado dentro do orçamento' : 'Necessita revisão'),
        assignedBuyerName: buyerNameInput.trim() || list.assignedBuyerName || actor.name,
      });
      await loadPurchasingData();
      setDetailListModal(updated);
      setApprovalNote('');
      showToast(
        decision === 'approve'
          ? `Lista ${updated.code} APROVADA com teto de ${formatCurrency(updated.approvedLimitTotal || updated.estimatedGrandTotal)}!`
          : `Lista ${updated.code} marcada como Rejeitada / Ajuste.`,
        decision === 'approve' ? 'ok' : 'err',
      );
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao registrar decisão.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartExecution = async (list: PurchaseListRecord) => {
    if (!perms.canExecuteAndReceive) {
      showToast('Sem permissão para iniciar execução de compra.', 'err');
      return;
    }
    setBusyAction(`exec-${list.id}`);
    try {
      const updated = await startPurchaseExecution(
        list,
        {
          uid: list.assignedBuyerUid || actor.uid,
          name: buyerNameInput.trim() || list.assignedBuyerName || actor.name,
        },
        actor,
      );
      await loadPurchasingData();
      setDetailListModal(updated);
      showToast(`Lista ${updated.code} marcada como EM COMPRA!`, 'ok');
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao iniciar compra.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenReceiptModal = (list: PurchaseListRecord) => {
    setReceiptDraftItems(
      list.items.map((item) => ({
        ...item,
        purchasedQty: item.purchasedQty ?? item.requestedQty,
        receivedQty: item.receivedQty ?? item.requestedQty,
        effectiveUnitCost: item.effectiveUnitCost ?? item.quotedUnitCost,
      })),
    );
    setReceiptInvoiceRef('');
    setReceiptJustification(list.closedShortJustification || '');
    setReceiptNote('');
    setReceiptApplyToStock(true);
    setReceiptModalList(list);
  };

  const handleConfirmReceipt = async (forceCloseShort = false) => {
    if (!receiptModalList) return;
    if (!perms.canExecuteAndReceive) {
      showToast('Sem permissão para registrar recebimento.', 'err');
      return;
    }

    setBusyAction(`receive-${receiptModalList.id}`);
    try {
      const { record, requiresReapproval, reapprovalReason, deltasToApplyToStock } =
        await recordPurchaseReceipt(
          receiptModalList,
          {
            updatedItems: receiptDraftItems,
            invoiceRef: receiptInvoiceRef,
            notes: receiptNote,
            closeShortJustification: forceCloseShort ? receiptJustification : undefined,
          },
          actor,
        );

      if (requiresReapproval) {
        await loadPurchasingData();
        setReceiptModalList(null);
        setDetailListModal(record);
        showToast(reapprovalReason || 'Valor excedeu o limite aprovado.', 'err');
        return;
      }

      if (receiptApplyToStock && deltasToApplyToStock.length > 0) {
        for (const d of deltasToApplyToStock) {
          await handleAdjustStock(
            d.productId,
            d.delta,
            `Recebimento Compra ${record.code}${receiptInvoiceRef ? ` (NF ${receiptInvoiceRef})` : ''}`,
          );
        }
      }

      await loadPurchasingData();
      setReceiptModalList(null);
      setDetailListModal(record);
      showToast(
        record.status === 'recebida'
          ? `Recebimento total da lista ${record.code} concluído!`
          : `Recebimento parcial da lista ${record.code} registrado!`,
        'ok',
      );
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao registrar recebimento.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDuplicateList = async (list: PurchaseListRecord) => {
    if (!perms.canCreateAndSubmitList) {
      showToast('Sem permissão para duplicar listas.', 'err');
      return;
    }
    setBusyAction(`dup-${list.id}`);
    try {
      const copy = await duplicatePurchaseListAsDraft(list, actor, purchaseLists.length);
      await loadPurchasingData();
      handleLoadListIntoEditor(copy);
      showToast(`Lista duplicada como novo rascunho (${copy.code}).`, 'ok');
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao duplicar lista.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelList = async (list: PurchaseListRecord) => {
    const reason = window.prompt('Informe o motivo do cancelamento desta lista de compra:');
    if (!reason || !reason.trim()) return;
    setBusyAction(`cancel-${list.id}`);
    try {
      const updated = await cancelPurchaseList(list, reason, actor);
      await loadPurchasingData();
      setDetailListModal(updated);
      showToast(`Lista ${updated.code} cancelada.`, 'err');
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao cancelar lista.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrintExecutionSheet = (list: PurchaseListRecord) => {
    const win = window.open('', '_blank', 'width=920,height=740');
    if (!win) {
      showToast('Permita pop-ups para imprimir a folha de compra.', 'err');
      return;
    }
    const rowsHtml = list.items
      .map(
        (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${item.productTitle}</strong><br/><small>${item.sku || '-'} • ${item.category || '-'}</small></td>
          <td>${item.supplierName}</td>
          <td style="text-align:center">${item.requestedQty} ${item.unit}</td>
          <td style="text-align:right">${formatCurrency(item.quotedUnitCost)}</td>
          <td style="text-align:right"><strong>${formatCurrency(item.estimatedItemTotal)}</strong></td>
          <td style="text-align:center">____</td>
        </tr>`,
      )
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${list.code} - ${list.title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
          h1 { margin: 0 0 4px; font-size: 20px; }
          .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
          .badges { display: flex; gap: 12px; margin-bottom: 16px; font-size: 12px; }
          .badge { border: 1px solid #999; padding: 6px 10px; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
          .signatures { display: flex; justify-content: space-between; margin-top: 42px; font-size: 12px; }
          .sig-box { width: 45%; border-top: 1px solid #333; padding-top: 6px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Mercado Nosso Jeito — Ordem / Lista de Compra ${list.code}</h1>
        <div class="meta">
          <strong>Título:</strong> ${list.title} &nbsp;|&nbsp;
          <strong>Status:</strong> ${PURCHASE_STATUS_LABELS[list.status] || list.status} &nbsp;|&nbsp;
          <strong>Data Desejada:</strong> ${list.desiredDate || '-'} &nbsp;|&nbsp;
          <strong>Condição Pagto:</strong> ${list.paymentTerms || '-'}
        </div>
        <div class="badges">
          <div class="badge"><strong>Solicitante:</strong> ${list.createdByName}</div>
          <div class="badge"><strong>Aprovador:</strong> ${list.approvedByName || 'Pendente'} ${list.approvedAt ? `em ${formatDateTime(list.approvedAt)}` : ''}</div>
          <div class="badge"><strong>Teto Aprovado:</strong> ${formatCurrency(list.approvedLimitTotal || list.estimatedGrandTotal)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th>Fornecedor</th>
              <th style="text-align:center">Qtd Solicitada</th>
              <th style="text-align:right">Custo Cotado</th>
              <th style="text-align:right">Total Estimado</th>
              <th style="text-align:center">Check Compra</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="text-align:right; font-size:14px;">
          Subtotal Itens: <strong>${formatCurrency(list.estimatedItemsTotal)}</strong> &nbsp;|&nbsp;
          Frete/Impostos/Outros: <strong>${formatCurrency(list.freightCost + list.taxCost + list.otherCost)}</strong> &nbsp;|&nbsp;
          Total Geral: <strong>${formatCurrency(list.estimatedGrandTotal)}</strong>
        </p>
        <div class="signatures">
          <div class="sig-box">Responsável pela Compra (${list.assignedBuyerName || list.createdByName})</div>
          <div class="sig-box">Aprovação Financeira / Gerência (${list.approvedByName || '____________________'})</div>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const handleSaveSupplierForm = async () => {
    if (!perms.canManageCatalogAndSuppliers) {
      showToast('Sem permissão para gerenciar fornecedores.', 'err');
      return;
    }
    if (!supplierForm.name || !supplierForm.name.trim()) {
      showToast('Informe o nome do fornecedor.', 'err');
      return;
    }
    setBusyAction('save-supplier');
    try {
      await saveSupplier(supplierForm, actor);
      await loadPurchasingData();
      setSupplierModalOpen(false);
      showToast(`Fornecedor "${supplierForm.name}" salvo com sucesso!`, 'ok');
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao salvar fornecedor.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveQuoteForm = async () => {
    if (!perms.canManageCatalogAndSuppliers) {
      showToast('Sem permissão para registrar cotações.', 'err');
      return;
    }
    if (!quoteForm.productId || !quoteForm.supplierId) {
      showToast('Selecione o produto e o fornecedor da cotação.', 'err');
      return;
    }
    if (!Number.isFinite(quoteForm.unitCost) || quoteForm.unitCost <= 0) {
      showToast('Informe um custo unitário válido maior que zero.', 'err');
      return;
    }
    const prod = products.find((p) => p.id === quoteForm.productId);
    const sup = suppliers.find((s) => s.id === quoteForm.supplierId);
    setBusyAction('save-quote');
    try {
      await addSupplierQuote(
        {
          productId: quoteForm.productId,
          productTitle: prod?.title || quoteForm.productId,
          supplierId: quoteForm.supplierId,
          supplierName: sup?.name || quoteForm.supplierId,
          unitCost: Number(quoteForm.unitCost),
          unit: prod?.unit || quoteForm.unit || 'UN',
          minQuantity: Math.max(1, Number(quoteForm.minQuantity || 1)),
          packMultiple: Math.max(1, Number(quoteForm.packMultiple || 1)),
          leadTimeDays: Math.max(1, Number(quoteForm.leadTimeDays || 3)),
          validUntil: quoteForm.validUntil,
          notes: quoteForm.notes,
        },
        actor,
      );
      await loadPurchasingData();
      setQuoteModalOpen(false);
      showToast('Nova cotação registrada no histórico!', 'ok');
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao registrar cotação.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenProductConfig = (analysis: ReplenishmentAnalysisResult) => {
    const existingMeta = productMetaMap[analysis.productId];
    const hyp = existingMeta?.newProductHypothesis;
    setProductConfigForm({
      primarySupplierId: existingMeta?.primarySupplierId ?? analysis.preferredSupplierId ?? '',
      minLot: existingMeta?.minLot ?? analysis.minLot ?? 1,
      packMultiple: existingMeta?.packMultiple ?? analysis.packMultiple ?? 1,
      leadTimeDays: existingMeta?.leadTimeDays ?? analysis.leadTimeDays ?? 3,
      safetyStockDays: existingMeta?.safetyStockDays ?? analysis.safetyStockDays ?? 4,
      commercialStatus: existingMeta?.commercialStatus ?? analysis.commercialStatus ?? 'ativo',
      hasHypothesis: Boolean(hyp) || analysis.historyState === 'sem_vendas_registradas',
      inclusionReason: hyp?.inclusionReason ?? 'Ampliação de mix / pedido de clientes',
      quotedUnitCost: hyp?.quotedUnitCost ?? (analysis.unitCost > 0 ? analysis.unitCost : 5),
      plannedSalePrice: hyp?.plannedSalePrice ?? (analysis.salePrice > 0 ? analysis.salePrice : 9.9),
      initialPlannedQty: hyp?.initialPlannedQty ?? 12,
      confidenceLevel: hyp?.confidenceLevel ?? 'media',
      confidenceJustification: hyp?.confidenceJustification ?? 'Demanda observada em itens similares',
      conservadorQty: hyp?.scenarios?.conservadorQty ?? 10,
      baseQty: hyp?.scenarios?.baseQty ?? 24,
      otimistaQty: hyp?.scenarios?.otimistaQty ?? 50,
      notes: hyp?.notes ?? '',
    });
    setProductConfigModal(analysis);
  };

  const handleSaveProductConfig = async () => {
    if (!productConfigModal) return;
    setBusyAction('save-prod-meta');
    try {
      const sup = suppliers.find((s) => s.id === productConfigForm.primarySupplierId);
      const nowIso = new Date().toISOString();
      const existingHyp = productMetaMap[productConfigModal.productId]?.newProductHypothesis;

      const hypothesis: NewProductHypothesis | null = productConfigForm.hasHypothesis
        ? {
            inclusionReason: productConfigForm.inclusionReason.trim() || 'Novo item em teste',
            notes: productConfigForm.notes.trim(),
            quotedUnitCost: Math.max(0, Number(productConfigForm.quotedUnitCost || 0)),
            supplierId: sup?.id,
            supplierName: sup?.name,
            plannedSalePrice: Math.max(0, Number(productConfigForm.plannedSalePrice || 0)),
            initialPlannedQty: Math.max(1, Math.floor(Number(productConfigForm.initialPlannedQty || 1))),
            confidenceLevel: productConfigForm.confidenceLevel,
            confidenceJustification:
              productConfigForm.confidenceJustification.trim() || 'Lote piloto inicial',
            scenarios: {
              conservadorQty: Math.max(1, Number(productConfigForm.conservadorQty || 10)),
              baseQty: Math.max(1, Number(productConfigForm.baseQty || 24)),
              otimistaQty: Math.max(1, Number(productConfigForm.otimistaQty || 50)),
            },
            createdAt: existingHyp?.createdAt || nowIso,
            createdBy: existingHyp?.createdBy || actor.name,
            updatedAt: nowIso,
          }
        : null;

      await savePurchasingProductMeta(
        {
          productId: productConfigModal.productId,
          primarySupplierId: sup?.id || productConfigForm.primarySupplierId || undefined,
          minLot: Math.max(1, Number(productConfigForm.minLot || 1)),
          packMultiple: Math.max(1, Number(productConfigForm.packMultiple || 1)),
          leadTimeDays: Math.max(1, Number(productConfigForm.leadTimeDays || 3)),
          safetyStockDays: Math.max(0, Number(productConfigForm.safetyStockDays || 4)),
          commercialStatus: productConfigForm.commercialStatus,
          newProductHypothesis: hypothesis,
        },
        actor,
      );
      await loadPurchasingData();
      setProductConfigModal(null);
      showToast(`Parâmetros de compra de "${productConfigModal.productTitle}" atualizados!`, 'ok');
    } catch (err) {
      showToast((err as Error)?.message || 'Erro ao salvar parâmetros do produto.', 'err');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddApprovedOfferToPurchaseDraft = (offer: ProductOfferRecord) => {
    if (offer.originChannel !== 'mercado_proprio') {
      showToast(
        'Somente ofertas do Modelo A (Produto Próprio do Mercado) entram em listas de compra próprias.',
        'err',
      );
      return;
    }
    const qty = Math.max(1, Number(offer.plannedPurchaseQty || 12));
    const unitCost = Math.max(0, roundCurrency(Number(offer.unitAcquisitionCost || 0)));
    setListItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === offer.productId);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          requestedQty: qty,
          quotedUnitCost: unitCost,
          estimatedItemTotal: roundCurrency(qty * unitCost),
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: offer.productId,
          productTitle: offer.productTitle,
          sku: offer.sku,
          category: offer.category,
          unit: offer.unit,
          supplierId: offer.supplierId || '',
          supplierName: offer.supplierName || 'Fornecedor a definir',
          requestedQty: qty,
          quotedUnitCost: unitCost,
          currentSalePrice: offer.salePrice,
          estimatedItemTotal: roundCurrency(qty * unitCost),
          reason: 'novo_produto',
          notes: `Produto aprovado no Assistente (${offer.inclusionJustification})`,
          isNewProduct: true,
        },
      ];
    });
    showToast(
      `"${offer.productTitle}" adicionado à Lista de Compra (aguardará aprovação da compra e recebimento físico).`,
      'ok',
    );
    setTab('lists');
  };

  const pendingOfferApprovalsCount = useMemo(
    () =>
      offers.filter(
        (o) =>
          o.ownLifecycleStatus === 'aguardando_aprovacao_produto' ||
          o.partnerLifecycleStatus === 'aguardando_aprovacao_parceiro_produto',
      ).length,
    [offers],
  );

  const expiredPartnerOffersCount = useMemo(
    () =>
      offers.filter(
        (o) =>
          o.originChannel === 'parceiro_retirada_estabelecimento' &&
          isPartnerOfferAvailabilityExpired(o).isExpired,
      ).length,
    [offers],
  );

  const isLoading = contextLoading || loadingLocal;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistente de Compras & Origens"
        subtitle="Porta de entrada para produtos novos, planejamento de reposição própria (A), consignação de parceiros no Mercado (B) e retirada em parceiros (C)."
        badge="Governança, Compras & Parceiros"
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadPurchasingData()}
              className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)] inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setTab('onboarding')}
              className="px-3.5 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs border border-emerald-500/30 inline-flex items-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" />
              + Cadastrar Produto / Oferta (A, B, C)
            </button>
            <button
              type="button"
              onClick={handleAddAllSuggestedToDraft}
              className="px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs border border-amber-500/30 inline-flex items-center gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Gerar Lista Sugerida ({overviewStats.suggestedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('lists')}
              className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center gap-2"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Lista Atual ({listItems.length})
            </button>
          </>
        }
      />

      {ordersUnavailable && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-bold">
                Histórico de vendas indisponível para este perfil ou falha de leitura (`dados_insuficientes`)
              </p>
              <p className="mt-1 text-xs opacity-90">
                O sistema não inventa giro quando os pedidos não podem ser lidos. As sugestões automáticas baseadas em vendas ficam suspensas até que o histórico seja consultado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--adm-border)] pb-3">
        {[
          {
            id: 'overview' as const,
            label: '1. Visão Geral',
            icon: Layers,
            badge:
              overviewStats.criticalItems.length +
              overviewStats.awaitingApprovalLists.length +
              pendingOfferApprovalsCount,
          },
          {
            id: 'onboarding' as const,
            label: '2. Porta de Entrada & Origens (A/B/C)',
            icon: Plus,
            badge: pendingOfferApprovalsCount,
          },
          {
            id: 'planning' as const,
            label: '3. Reposição Própria',
            icon: TrendingUp,
            badge: overviewStats.suggestedItems.length,
          },
          {
            id: 'lists' as const,
            label: '4. Listas & Recebimento',
            icon: ClipboardCheck,
            badge: purchaseLists.length,
          },
          {
            id: 'partners' as const,
            label: '5. Parceiros, Custódia & Repasses',
            icon: ShieldCheck,
            badge: partners.length + expiredPartnerOffersCount,
          },
          {
            id: 'products' as const,
            label: '6. Sem Giro / Hipóteses',
            icon: Sparkles,
            badge: overviewStats.newNoHistoryItems.length,
          },
          {
            id: 'suppliers' as const,
            label: '7. Fornecedores & Cotações',
            icon: Truck,
            badge: suppliers.filter((s) => s.status === 'active').length,
          },
          {
            id: 'analytics' as const,
            label: '8. Simulador (10 / 50 / 100 un.)',
            icon: Calculator,
          },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:text-sm ${
                active
                  ? 'bg-amber-500 text-neutral-950 shadow-md'
                  : 'border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                    active ? 'bg-neutral-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(tab === 'onboarding' || tab === 'partners') && (
        <PurchasingMultiOriginWorkspace
          mode={tab}
          products={products}
          orders={orders}
          suppliers={suppliers}
          partners={partners}
          offers={offers}
          custodyMovements={custodyMovements}
          settlements={settlements}
          productMetaMap={productMetaMap}
          actor={actor}
          perms={perms}
          onRefreshAll={loadPurchasingData}
          onAddApprovedOfferToPurchaseDraft={handleAddApprovedOfferToPurchaseDraft}
          showToast={(msg, type) =>
            showToast(msg, type === 'error' ? 'err' : 'ok')
          }
        />
      )}

      {/* =====================================================================
          TAB 1: VISÃO GERAL DE COMPRAS
         ===================================================================== */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Ruptura / Reposição Crítica"
              value={`${overviewStats.criticalItems.length} itens`}
              subtitle={`${overviewStats.attentionItems.length} itens adicionais em atenção`}
              tone={overviewStats.criticalItems.length > 0 ? 'rose' : 'emerald'}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <MetricCard
              label="Orçamento Sugerido (Planejado)"
              value={formatCurrency(overviewStats.totalSuggestedOutlay)}
              subtitle={`${overviewStats.suggestedItems.length} produtos abaixo do ponto de reposição`}
              tone="amber"
              icon={<Calculator className="h-4 w-4" />}
            />
            <MetricCard
              label="Compras Aprovadas / Em Trânsito"
              value={formatCurrency(overviewStats.authorizedPendingSpend)}
              subtitle={`${overviewStats.awaitingApprovalLists.length} aguardando aprovação`}
              tone="sky"
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <MetricCard
              label="Gasto Efetivo Recebido (Realizado)"
              value={formatCurrency(overviewStats.realizedSpendTotal)}
              subtitle={`${overviewStats.completedLists.length} ordens de compra concluídas`}
              tone="emerald"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--adm-text)]">
                    Prioridades Imediatas de Compra
                  </h3>
                  <p className="text-xs text-[var(--adm-text-muted)]">
                    Produtos em ruptura ou abaixo do estoque de segurança considerando lead time
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('planning')}
                  className="text-xs font-bold text-amber-400 hover:underline"
                >
                  Ver planejamento completo →
                </button>
              </div>

              {overviewStats.suggestedItems.length === 0 ? (
                <EmptyState
                  title="Nenhuma reposição urgente pendente"
                  description="Todos os produtos com giro registrado estão com cobertura saudável no momento."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[var(--adm-border)] text-[11px] uppercase tracking-wider text-[var(--adm-text-muted)]">
                        <th className="pb-2.5">Produto</th>
                        <th className="pb-2.5 text-center">Disp. / Trânsito</th>
                        <th className="pb-2.5 text-center">Cobertura</th>
                        <th className="pb-2.5 text-center">Sugerido</th>
                        <th className="pb-2.5 text-right">Custo Est.</th>
                        <th className="pb-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-border)]">
                      {overviewStats.suggestedItems.slice(0, 8).map((item) => (
                        <tr key={item.productId} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-2">
                            <div className="font-bold text-[var(--adm-text)]">
                              {item.productTitle}
                            </div>
                            <div className="text-[11px] text-[var(--adm-text-muted)]">
                              {item.category} • Giro: {item.dailyAvgSales}/dia • Forn.:{' '}
                              {item.preferredSupplierName}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <span className="font-bold text-[var(--adm-text)]">
                              {item.availableStock}
                            </span>
                            {item.inTransitQty > 0 && (
                              <span className="ml-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                                +{item.inTransitQty} trâns.
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                                URGENCY_BADGE[item.urgencyLevel]?.cls || ''
                              }`}
                            >
                              {item.coverageDays !== null ? `${item.coverageDays}d` : 'Sem giro'}
                            </span>
                          </td>
                          <td className="py-3 text-center font-extrabold text-amber-400">
                            {item.suggestedQty} {item.unit}
                          </td>
                          <td className="py-3 text-right font-semibold">
                            {formatCurrency(item.estimatedReplenishmentCost)}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleAddItemToDraft(item)}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25"
                            >
                              + Lista
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-[var(--adm-text)]">
                  Governança & Alertas de Dados
                </h3>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Controle de quem solicita, aprova e executa compras
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3">
                  <div>
                    <p className="font-bold text-[var(--adm-text)]">Aguardando Aprovação</p>
                    <p className="text-[var(--adm-text-muted)]">Listas pendentes de assinatura</p>
                  </div>
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-extrabold text-amber-300">
                    {overviewStats.awaitingApprovalLists.length}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3">
                  <div>
                    <p className="font-bold text-[var(--adm-text)]">Aprovadas / Em Compra</p>
                    <p className="text-[var(--adm-text-muted)]">Autorizadas para o comprador</p>
                  </div>
                  <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sm font-extrabold text-sky-300">
                    {overviewStats.approvedLists.length + overviewStats.inExecutionLists.length}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3">
                  <div>
                    <p className="font-bold text-[var(--adm-text)]">Qualidade do Cadastro</p>
                    <p className="text-[var(--adm-text-muted)]">Itens com avisos de dados incompletos</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-extrabold ${
                      overviewStats.incompleteDataItems.length > 0
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {overviewStats.incompleteDataItems.length}
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3">
                  <p className="mb-2 font-bold text-[var(--adm-text)]">
                    Concentração por Fornecedor
                  </p>
                  {overviewStats.supplierConcentration.length === 0 ? (
                    <p className="text-[var(--adm-text-muted)]">Nenhuma lista registrada ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {overviewStats.supplierConcentration.slice(0, 4).map((sup) => (
                        <div key={sup.name} className="flex items-center justify-between">
                          <span className="truncate pr-2 text-[var(--adm-text-muted)]">
                            {sup.name}
                          </span>
                          <span className="font-semibold text-[var(--adm-text)]">
                            {formatCurrency(sup.realized + sup.planned)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: PLANEJAMENTO DE COMPRAS & REPOSIÇÃO EXPLICÁVEL
         ===================================================================== */}
      {tab === 'planning' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--adm-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, SKU ou fornecedor..."
                className="adm-input w-full pl-9 py-2 text-xs"
              />
            </div>

            <div>
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value))}
                className="adm-input w-full py-2 px-2.5 text-xs"
                aria-label="Janela de giro"
              >
                <option value={7}>Janela de Giro: 7 dias</option>
                <option value={30}>Janela de Giro: 30 dias</option>
                <option value={60}>Janela de Giro: 60 dias</option>
                <option value={90}>Janela de Giro: 90 dias</option>
              </select>
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="adm-input w-full py-2 px-2.5 text-xs"
                aria-label="Filtrar categoria"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="adm-input w-full py-2 px-2.5 text-xs"
                aria-label="Filtrar urgência"
              >
                <option value="all">Todas as Prioridades</option>
                <option value="needs_replenishment">Com Compra Sugerida</option>
                <option value="critico">Ruptura Crítica</option>
                <option value="atencao">Repor Agora</option>
                <option value="sem_historico">Sem Giro / Novo</option>
                <option value="incomplete">Com Dados Incompletos</option>
              </select>
            </div>

            <div>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="adm-input w-full py-2 px-2.5 text-xs"
                aria-label="Filtrar fornecedor"
              >
                <option value="all">Todos os Fornecedores</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[var(--adm-text)]">
                  Motor de Reposição Explicável ({filteredAnalyses.length} produtos)
                </h3>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Cada sugestão exibe a explicação transparente: Estoque Disponível, Trânsito Separado, Giro Diário, Prazo (Lead Time), Ponto de Reposição e Lote Mínimo.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--adm-text-muted)]">
                <input
                  type="checkbox"
                  checked={onlyConfirmedSales}
                  onChange={(e) => setOnlyConfirmedSales(e.target.checked)}
                />
                <span>Considerar apenas vendas com pagamento confirmado</span>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--adm-border)] text-[11px] uppercase tracking-wider text-[var(--adm-text-muted)]">
                    <th className="pb-3 pr-2">Produto & Explicação</th>
                    <th className="pb-3 text-center">Físico / Disp. / Trâns.</th>
                    <th className="pb-3 text-center">Giro ({periodDays}d)</th>
                    <th className="pb-3 text-center">Cobertura & Ponto Pedido</th>
                    <th className="pb-3 text-center">Qtd. Sugerida</th>
                    <th className="pb-3 text-right">Custo / Preço</th>
                    <th className="pb-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--adm-border)]">
                  {filteredAnalyses.map((item) => {
                    const uBadge = URGENCY_BADGE[item.urgencyLevel] || URGENCY_BADGE.confortavel;
                    return (
                      <tr key={item.productId} className="align-top hover:bg-white/[0.02]">
                        <td className="py-3.5 pr-3 max-w-md">
                          <div className="font-bold text-[var(--adm-text)]">
                            {item.productTitle}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--adm-text-muted)]">
                            SKU: {item.sku} • {item.category} • Forn.:{' '}
                            <strong className="text-[var(--adm-text)]">
                              {item.preferredSupplierName}
                            </strong>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--adm-text-muted)] leading-relaxed">
                            {item.explanation}
                          </p>
                          {item.missingDataWarnings.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.missingDataWarnings.map((w, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {w}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 text-center">
                          <div className="font-bold text-[var(--adm-text)]">
                            Disp: {item.availableStock} {item.unit}
                          </div>
                          <div className="text-[11px] text-[var(--adm-text-muted)]">
                            Fís: {item.physicalStock} | Res: {item.reservedStock}
                          </div>
                          {item.inTransitQty > 0 && (
                            <div className="mt-1 inline-block rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                              Em trânsito: +{item.inTransitQty}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 text-center">
                          {item.historyState === 'com_vendas' ? (
                            <>
                              <div className="font-bold text-[var(--adm-text)]">
                                {item.unitsSoldInPeriod} un. ({item.dailyAvgSales}/dia)
                              </div>
                              <div className="text-[11px] text-[var(--adm-text-muted)]">
                                Sem: {item.weeklyAvgSales} | Mês: {item.monthlyAvgSales}
                              </div>
                              {item.trendPct !== null && (
                                <div
                                  className={`mt-0.5 text-[10px] font-bold ${
                                    item.trendDirection === 'up'
                                      ? 'text-emerald-400'
                                      : item.trendDirection === 'down'
                                        ? 'text-rose-400'
                                        : 'text-[var(--adm-text-muted)]'
                                  }`}
                                >
                                  Tendência: {item.trendPct > 0 ? `+${item.trendPct}%` : `${item.trendPct}%`}
                                </div>
                              )}
                            </>
                          ) : item.historyState === 'dados_insuficientes' ? (
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              Dados Insuficientes
                            </span>
                          ) : (
                            <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                              Sem Vendas Registradas
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 text-center">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${uBadge.cls}`}
                          >
                            {uBadge.label} •{' '}
                            {item.coverageDays !== null ? `${item.coverageDays} dias` : 'N/A'}
                          </span>
                          <div className="mt-1 text-[11px] text-[var(--adm-text-muted)]">
                            PP: <strong>{item.reorderPoint ?? '-'}</strong> | Seg:{' '}
                            <strong>{item.safetyStockDays}d</strong> | Lead:{' '}
                            <strong>{item.leadTimeDays}d</strong>
                          </div>
                        </td>

                        <td className="py-3.5 text-center">
                          <div className="text-sm font-extrabold text-amber-400">
                            {item.suggestedQty > 0 ? `${item.suggestedQty} ${item.unit}` : '0'}
                          </div>
                          <div className="mx-auto mt-1 text-[10px] text-[var(--adm-text-muted)]">
                            Lote mín: {item.minLot} | Múlt: {item.packMultiple}
                          </div>
                        </td>

                        <td className="py-3.5 text-right">
                          <div className="font-bold text-[var(--adm-text)]">
                            Custo: {formatCurrency(item.unitCost)}
                          </div>
                          <div className="text-[11px] text-[var(--adm-text-muted)]">
                            Venda: {formatCurrency(item.salePrice)}
                          </div>
                          {item.suggestedQty > 0 && (
                            <div className="mt-0.5 text-[11px] font-bold text-amber-300">
                              Total: {formatCurrency(item.estimatedReplenishmentCost)}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 pl-2 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddItemToDraft(item)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-neutral-950 hover:bg-amber-400"
                            >
                              <Plus className="h-3 w-3" />
                              Na Lista
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenProductConfig(item)}
                                className="rounded border border-[var(--adm-border)] px-2 py-0.5 text-[10px] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                              >
                                Parâmetros
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSimProductId(item.productId);
                                  setTab('analytics');
                                }}
                                className="rounded border border-[var(--adm-border)] px-2 py-0.5 text-[10px] text-sky-300 hover:bg-sky-500/10"
                              >
                                10/50/100
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: LISTAS DE COMPRA, GOVERNANÇA DE APROVAÇÃO & RECEBIMENTO
         ===================================================================== */}
      {tab === 'lists' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-7">
            <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[var(--adm-text)]">
                    {editingListId
                      ? `Editando Lista de Compra (${purchaseLists.find((l) => l.id === editingListId)?.code || 'Salva'})`
                      : 'Montar Nova Lista de Compra (Rascunho)'}
                  </h3>
                  <p className="text-xs text-[var(--adm-text-muted)]">
                    Se uma lista já aprovada tiver aumento de valor, quantidade, custo ou troca de fornecedor, a aprovação anterior é invalidada automaticamente.
                  </p>
                </div>
                {editingListId && (
                  <button
                    type="button"
                    onClick={handleResetDraftEditor}
                    className="text-xs font-bold text-amber-400 hover:underline shrink-0"
                  >
                    + Novo Rascunho Limpo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                    Nome / Identificação da Lista
                  </label>
                  <input
                    type="text"
                    value={listTitle}
                    onChange={(e) => setListTitle(e.target.value)}
                    className="adm-input w-full px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                    Objetivo / Finalidade
                  </label>
                  <input
                    type="text"
                    value={listPurpose}
                    onChange={(e) => setListPurpose(e.target.value)}
                    className="adm-input w-full px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                    Data Desejada da Compra
                  </label>
                  <input
                    type="date"
                    value={listDesiredDate}
                    onChange={(e) => setListDesiredDate(e.target.value)}
                    className="adm-input w-full px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                    Condição de Pagamento Prevista
                  </label>
                  <input
                    type="text"
                    value={listPaymentTerms}
                    onChange={(e) => setListPaymentTerms(e.target.value)}
                    className="adm-input w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3">
                <span className="text-xs font-bold text-[var(--adm-text-muted)]">
                  Adicionar produto rápido:
                </span>
                <select
                  onChange={(e) => {
                    const found = analyses.find((a) => a.productId === e.target.value);
                    if (found) {
                      handleAddItemToDraft(found);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="adm-input flex-1 px-2.5 py-1.5 text-xs"
                >
                  <option value="" disabled>
                    Selecione um produto do catálogo para incluir na lista...
                  </option>
                  {analyses.map((a) => (
                    <option key={a.productId} value={a.productId}>
                      {a.productTitle} — Disp: {a.availableStock} | Sug: {a.suggestedQty} | Custo:{' '}
                      {formatCurrency(a.unitCost)}
                    </option>
                  ))}
                </select>
              </div>

              {listItems.length === 0 ? (
                <EmptyState
                  title="Lista de compra vazia"
                  description="Adicione produtos a partir da aba Planejamento ou selecione no menu acima."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--adm-border)] text-[11px] uppercase text-[var(--adm-text-muted)]">
                        <th className="pb-2">Item</th>
                        <th className="pb-2">Fornecedor</th>
                        <th className="pb-2 text-center">Qtd.</th>
                        <th className="pb-2 text-right">Custo Unit. (R$)</th>
                        <th className="pb-2 text-right">Subtotal</th>
                        <th className="pb-2 text-center">Rem.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-border)]">
                      {listItems.map((item, idx) => (
                        <tr key={item.productId}>
                          <td className="py-2.5 pr-2">
                            <div className="font-bold text-[var(--adm-text)]">
                              {item.productTitle}
                            </div>
                            <select
                              value={item.reason}
                              onChange={(e) => {
                                const nextReason = e.target.value as PurchaseReason;
                                setListItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, reason: nextReason } : it,
                                  ),
                                );
                              }}
                              className="mt-1 rounded border border-[var(--adm-border)] bg-transparent px-1.5 py-0.5 text-[10px] text-[var(--adm-text-muted)]"
                            >
                              {Object.entries(REASON_LABELS).map(([k, lbl]) => (
                                <option key={k} value={k} className="bg-neutral-900">
                                  Motivo: {lbl}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 pr-2">
                            <select
                              value={item.supplierId || ''}
                              onChange={(e) => {
                                const sup = suppliers.find((s) => s.id === e.target.value);
                                setListItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? {
                                          ...it,
                                          supplierId: sup?.id || '',
                                          supplierName: sup?.name || 'Fornecedor Geral',
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              className="adm-input w-36 px-2 py-1 text-xs"
                            >
                              <option value="">{item.supplierName || 'Selecionar...'}</option>
                              {suppliers
                                .filter((s) => s.status === 'active')
                                .map((sup) => (
                                  <option key={sup.id} value={sup.id}>
                                    {sup.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="py-2.5 text-center">
                            <input
                              type="number"
                              min={1}
                              value={item.requestedQty}
                              onChange={(e) => {
                                const q = Math.max(1, Math.floor(Number(e.target.value || 1)));
                                setListItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? {
                                          ...it,
                                          requestedQty: q,
                                          estimatedItemTotal: roundCurrency(
                                            q * it.quotedUnitCost,
                                          ),
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              className="adm-input w-20 px-2 py-1 text-center text-xs"
                            />
                          </td>
                          <td className="py-2.5 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.quotedUnitCost}
                              onChange={(e) => {
                                const c = Math.max(0, Number(e.target.value || 0));
                                setListItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? {
                                          ...it,
                                          quotedUnitCost: c,
                                          estimatedItemTotal: roundCurrency(
                                            it.requestedQty * c,
                                          ),
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              className="adm-input w-24 px-2 py-1 text-right text-xs"
                            />
                          </td>
                          <td className="py-2.5 text-right font-bold text-[var(--adm-text)]">
                            {formatCurrency(item.estimatedItemTotal)}
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setListItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-rose-400 hover:text-rose-300"
                              title="Remover item"
                            >
                              <XCircle className="mx-auto h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 border-t border-[var(--adm-border)] pt-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--adm-text-muted)]">
                    Frete Estimado (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={listFreight}
                    onChange={(e) => setListFreight(Math.max(0, Number(e.target.value || 0)))}
                    className="adm-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--adm-text-muted)]">
                    Impostos / ST (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={listTax}
                    onChange={(e) => setListTax(Math.max(0, Number(e.target.value || 0)))}
                    className="adm-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--adm-text-muted)]">
                    Outros Custos (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={listOtherCost}
                    onChange={(e) => setListOtherCost(Math.max(0, Number(e.target.value || 0)))}
                    className="adm-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                  Observações para Aprovação / Comprador
                </label>
                <textarea
                  rows={2}
                  value={listNotes}
                  onChange={(e) => setListNotes(e.target.value)}
                  className="adm-input w-full px-3 py-2 text-xs"
                  placeholder="Justificativa do pedido, negociação especial ou instruções de entrega..."
                />
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-[var(--adm-text-muted)]">Itens / Unidades</span>
                    <p className="text-sm font-extrabold text-[var(--adm-text)]">
                      {listItems.length} SKUs ({activeDraftSummary.totalRequestedUnits} un.)
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--adm-text-muted)]">Desembolso Total</span>
                    <p className="text-sm font-extrabold text-amber-400">
                      {formatCurrency(activeDraftSummary.estimatedGrandTotal)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--adm-text-muted)]">Receita Projetada</span>
                    <p className="text-sm font-extrabold text-[var(--adm-text)]">
                      {formatCurrency(activeDraftSummary.projectedTotalRevenue)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--adm-text-muted)]">Lucro Bruto Proj.</span>
                    <p className="text-sm font-extrabold text-emerald-400">
                      {formatCurrency(activeDraftSummary.projectedGrossProfit)} (
                      {activeDraftSummary.projectedMarginPct ?? 0}%)
                    </p>
                  </div>
                </div>

                {activeDraftSummary.bySupplier.length > 0 && (
                  <div className="mt-3 border-t border-amber-500/20 pt-2 text-[11px]">
                    <span className="font-bold text-amber-300">Resumo por Fornecedor: </span>
                    {activeDraftSummary.bySupplier.map((sb) => (
                      <span key={sb.supplierName} className="mr-3 inline-block">
                        {sb.supplierName}: <strong>{formatCurrency(sb.estimatedSubtotal)}</strong> (
                        {sb.itemCount} itens)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={busyAction === 'save-list'}
                  onClick={() => void handleSavePurchaseList(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)]"
                >
                  Salvar Rascunho
                </button>
                <button
                  type="button"
                  disabled={busyAction === 'save-list'}
                  onClick={() => void handleSavePurchaseList(true)}
                  className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Salvar e Enviar para Aprovação
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:col-span-5">
            <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5">
              <h3 className="text-base font-bold text-[var(--adm-text)]">
                Ordens & Listas Registradas ({purchaseLists.length})
              </h3>
              <p className="text-xs text-[var(--adm-text-muted)] mb-4">
                Clique em uma lista para auditar histórico, aprovar, iniciar compra, imprimir ou registrar recebimento.
              </p>

              {purchaseLists.length === 0 ? (
                <EmptyState
                  title="Nenhuma lista salva ainda"
                  description="Monte sua primeira lista ao lado e salve como rascunho ou envie para aprovação."
                />
              ) : (
                <div className="space-y-3">
                  {purchaseLists.map((list) => {
                    const stCls = STATUS_BADGE_STYLE[list.status] || STATUS_BADGE_STYLE.rascunho;
                    return (
                      <div
                        key={list.id}
                        className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-4 transition-all hover:border-amber-500/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-extrabold text-amber-400">
                                {list.code}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${stCls}`}
                              >
                                {PURCHASE_STATUS_LABELS[list.status] || list.status}
                              </span>
                            </div>
                            <h4 className="mt-1 text-sm font-bold text-[var(--adm-text)]">
                              {list.title}
                            </h4>
                            <p className="text-[11px] text-[var(--adm-text-muted)]">
                              Solicitante: {list.createdByName} • Criada em{' '}
                              {formatDateTime(list.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-extrabold text-[var(--adm-text)]">
                              {formatCurrency(list.estimatedGrandTotal)}
                            </p>
                            <p className="text-[11px] text-[var(--adm-text-muted)]">
                              {list.items.length} SKUs
                            </p>
                          </div>
                        </div>

                        {list.approvedByName && (
                          <div className="mt-2 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300">
                            Autorizado por <strong>{list.approvedByName}</strong> • Teto:{' '}
                            <strong>
                              {formatCurrency(list.approvedLimitTotal || list.estimatedGrandTotal)}
                            </strong>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--adm-border)] pt-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailListModal(list)}
                              className="rounded-lg border border-[var(--adm-border)] px-2.5 py-1 text-xs font-bold text-[var(--adm-text)] hover:bg-white/5"
                            >
                              Abrir / Auditar
                            </button>
                            {list.status !== 'recebida' && list.status !== 'cancelada' && (
                              <button
                                type="button"
                                onClick={() => handleLoadListIntoEditor(list)}
                                className="rounded-lg border border-[var(--adm-border)] px-2.5 py-1 text-xs text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                              >
                                Editar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDuplicateList(list)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--adm-border)] px-2 py-1 text-xs text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                              title="Duplicar como novo rascunho"
                            >
                              <Copy className="h-3 w-3" />
                              Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintExecutionSheet(list)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--adm-border)] px-2 py-1 text-xs text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                              title="Imprimir Folha de Compra"
                            >
                              <Printer className="h-3 w-3" />
                            </button>
                          </div>

                          {list.status === 'rascunho' && (
                            <button
                              type="button"
                              onClick={() => void handleSubmitSavedListForApproval(list)}
                              className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
                            >
                              Pedir Aprovação
                            </button>
                          )}
                          {list.status === 'aguardando_aprovacao' && perms.canApproveOrReject && (
                            <button
                              type="button"
                              onClick={() => setDetailListModal(list)}
                              className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-bold text-neutral-950 hover:bg-emerald-400"
                            >
                              Avaliar e Aprovar
                            </button>
                          )}
                          {(list.status === 'aprovada' ||
                            list.status === 'em_compra' ||
                            list.status === 'parcialmente_recebida') && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceiptModal(list)}
                              className="rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-bold text-neutral-950 hover:bg-sky-400"
                            >
                              Receber Mercadoria
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PRODUTOS NOVOS / SEM HISTÓRICO DE VENDAS
         ===================================================================== */}
      {tab === 'products' && (
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-[var(--adm-text)]">
              Avaliação de Produtos Novos ou Sem Histórico de Vendas
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Regra de integridade: O sistema NUNCA inventa vendas para produtos com giro zero. Para comprar um item sem histórico, cadastre uma Hipótese Manual auditável (Conservador / Base / Otimista) que fica preservada mesmo após o início das vendas.
            </p>
          </div>

          {overviewStats.newNoHistoryItems.length === 0 ? (
            <EmptyState
              title="Todos os produtos atuais possuem giro ou pedidos registrados"
              description="Você ainda pode abrir qualquer produto na aba Planejamento e clicar em 'Parâmetros' para registrar uma hipótese comercial."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {overviewStats.newNoHistoryItems.map((item) => {
                const hyp = productMetaMap[item.productId]?.newProductHypothesis;
                const scenarios = hyp
                  ? computeFinancialScenarios({
                      unitCost: hyp.quotedUnitCost,
                      salePrice: hyp.plannedSalePrice,
                      plannedPurchaseQty: hyp.initialPlannedQty,
                    })
                  : null;

                return (
                  <div
                    key={item.productId}
                    className="rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-full border border-purple-500/40 bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                          Sem Vendas Registradas ({periodDays}d)
                        </span>
                        <h4 className="mt-1.5 text-base font-bold text-[var(--adm-text)]">
                          {item.productTitle}
                        </h4>
                        <p className="text-xs text-[var(--adm-text-muted)]">
                          Categoria: {item.category} • Estoque Atual: {item.availableStock}{' '}
                          {item.unit} • Preço Atual: {formatCurrency(item.salePrice)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenProductConfig(item)}
                        className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25"
                      >
                        {hyp ? 'Editar Hipótese' : 'Criar Hipótese de Teste'}
                      </button>
                    </div>

                    {hyp ? (
                      <div className="mt-4 space-y-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-purple-200">
                            Motivo: {hyp.inclusionReason} • Confiança:{' '}
                            {hyp.confidenceLevel.toUpperCase()}
                          </span>
                          <span className="text-[11px] text-[var(--adm-text-muted)]">
                            Por {hyp.createdBy}
                          </span>
                        </div>
                        <p className="italic text-[var(--adm-text-muted)]">
                          "{hyp.confidenceJustification}"
                        </p>
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="rounded-lg bg-black/20 p-2">
                            <span className="text-[10px] text-[var(--adm-text-muted)]">
                              Lote Inicial Teste
                            </span>
                            <p className="font-extrabold text-amber-400">
                              {hyp.initialPlannedQty} un. (
                              {formatCurrency(hyp.initialPlannedQty * hyp.quotedUnitCost)})
                            </p>
                          </div>
                          <div className="rounded-lg bg-black/20 p-2">
                            <span className="text-[10px] text-[var(--adm-text-muted)]">
                              Custo / Preço Alvo
                            </span>
                            <p className="font-bold text-[var(--adm-text)]">
                              {formatCurrency(hyp.quotedUnitCost)} →{' '}
                              {formatCurrency(hyp.plannedSalePrice)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-black/20 p-2">
                            <span className="text-[10px] text-[var(--adm-text-muted)]">
                              Ponto de Equilíbrio
                            </span>
                            <p className="font-bold text-emerald-400">
                              {scenarios?.unitsToRecoverOutlay ?? '-'} un. vendidas
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleAddItemToDraft(item, hyp.initialPlannedQty, 'novo_produto')
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-neutral-950 hover:bg-amber-400"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Incluir Lote de Teste ({hyp.initialPlannedQty} un.) na Lista
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-[var(--adm-border)] p-3 text-xs text-[var(--adm-text-muted)]">
                        Nenhuma hipótese manual cadastrada. O sistema mantém sugestão automática = 0
                        até que um comprador registre o lote de teste comercial e o custo cotado.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: FORNECEDORES & HISTÓRICO DE COTAÇÕES
         ===================================================================== */}
      {tab === 'suppliers' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[var(--adm-text)]">
                Base de Fornecedores & Cotações Comparativas
              </h3>
              <p className="text-xs text-[var(--adm-text-muted)]">
                Fornecedores nunca são apagados fisicamente para preservar auditoria; cotações novas não sobrescrevem o histórico anterior.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSupplierForm({
                    name: '',
                    contactName: '',
                    phone: '',
                    email: '',
                    document: '',
                    paymentTerms: 'Boleto 7/14 dias',
                    leadTimeDays: 3,
                    minOrderValue: 150,
                    notes: '',
                    status: 'active',
                    suppliedProductIds: [],
                  });
                  setSupplierModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)] inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Novo Fornecedor
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuoteForm({
                    productId: products[0]?.id || '',
                    supplierId: suppliers[0]?.id || '',
                    unitCost: 5,
                    unit: 'UN',
                    minQuantity: 6,
                    packMultiple: 6,
                    leadTimeDays: 3,
                    validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
                    notes: '',
                  });
                  setQuoteModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Registrar Nova Cotação
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5">
              <h4 className="text-sm font-bold text-[var(--adm-text)] mb-3">
                Fornecedores Cadastrados ({suppliers.length})
              </h4>
              {suppliers.length === 0 ? (
                <EmptyState
                  title="Nenhum fornecedor cadastrado"
                  description="Cadastre seus fornecedores para vincular cotações, prazos de entrega e pedidos mínimos."
                />
              ) : (
                <div className="space-y-3">
                  {suppliers.map((sup) => (
                    <div
                      key={sup.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3.5 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--adm-text)]">{sup.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              sup.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-neutral-500/20 text-neutral-300'
                            }`}
                          >
                            {sup.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--adm-text-muted)]">
                          Contato: {sup.contactName || '-'} • Tel/WhatsApp: {sup.phone || '-'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--adm-text-muted)]">
                          Lead Time: <strong>{sup.leadTimeDays}d</strong> • Pedido Mín.:{' '}
                          <strong>{formatCurrency(sup.minOrderValue)}</strong> • Pagto:{' '}
                          {sup.paymentTerms}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierForm(sup);
                          setSupplierModalOpen(true);
                        }}
                        className="rounded-lg border border-[var(--adm-border)] px-2.5 py-1 text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                      >
                        Editar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5">
              <h4 className="text-sm font-bold text-[var(--adm-text)] mb-3">
                Histórico de Cotações ({quotes.length})
              </h4>
              {quotes.length === 0 ? (
                <EmptyState
                  title="Nenhuma cotação registrada"
                  description="Clique em 'Registrar Nova Cotação' para comparar preços e prazos entre fornecedores."
                />
              ) : (
                <div className="space-y-2.5">
                  {quotes.slice(0, 12).map((q) => {
                    const expired =
                      Boolean(q.validUntil) && new Date(q.validUntil).getTime() < Date.now();
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--adm-text)]">
                            {q.productTitle}
                          </span>
                          <span className="text-sm font-extrabold text-amber-400">
                            {formatCurrency(q.unitCost)} / {q.unit}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--adm-text-muted)]">
                          <span>
                            Fornecedor: <strong className="text-[var(--adm-text)]">{q.supplierName}</strong> • Lote mín: {q.minQuantity} • Prazo: {q.leadTimeDays}d
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              expired
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {expired ? `Vencida em ${q.validUntil}` : `Válida até ${q.validUntil}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: SIMULADOR FINANCEIRO & PROJEÇÃO (10, 50, 100 UNIDADES + LOTE)
         ===================================================================== */}
      {tab === 'analytics' && (
        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-[var(--adm-text)]">
              Simulador de Resultados Financeiros (10, 50, 100 Unidades e Lote Planejado)
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Avalie faturamento bruto, CMV das unidades vendidas, lucro bruto, margem, desembolso total da compra e capital empatado em estoque remanescente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Produto de Referência
              </label>
              <select
                value={selectedAnalysisForSim?.productId || ''}
                onChange={(e) => setSimProductId(e.target.value)}
                className="adm-input w-full px-3 py-2 text-xs"
              >
                {analyses.map((a) => (
                  <option key={a.productId} value={a.productId}>
                    {a.productTitle} ({a.category}) — Giro: {a.dailyAvgSales}/dia
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Preço de Venda Unit. (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={simSalePrice}
                onChange={(e) => setSimSalePrice(Math.max(0, Number(e.target.value || 0)))}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Custo de Compra Unit. (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={simUnitCost}
                onChange={(e) => setSimUnitCost(Math.max(0, Number(e.target.value || 0)))}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Lote de Compra Planejado (un.)
              </label>
              <input
                type="number"
                min={1}
                value={simPlannedQty}
                onChange={(e) =>
                  setSimPlannedQty(Math.max(1, Math.floor(Number(e.target.value || 1))))
                }
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Frete do Pedido (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={simFreight}
                onChange={(e) => setSimFreight(Math.max(0, Number(e.target.value || 0)))}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Impostos / Outros Custos (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={simTax}
                onChange={(e) => setSimTax(Math.max(0, Number(e.target.value || 0)))}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Volume Customizado Extra (un.)
              </label>
              <input
                type="number"
                min={1}
                value={simCustomVol}
                onChange={(e) =>
                  setSimCustomVol(Math.max(1, Math.floor(Number(e.target.value || 1))))
                }
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          {financialSimulation.warnings.length > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              {financialSimulation.warnings.map((w, i) => (
                <p key={i} className="font-bold">
                  ⚠️ {w}
                </p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--adm-border)] text-[11px] uppercase tracking-wider text-[var(--adm-text-muted)]">
                  <th className="pb-3">Cenário de Venda</th>
                  <th className="pb-3 text-right">Faturamento Bruto</th>
                  <th className="pb-3 text-right">CMV (Unid. Vendidas)</th>
                  <th className="pb-3 text-right">Lucro Bruto Projetado</th>
                  <th className="pb-3 text-center">Margem Bruta</th>
                  <th className="pb-3 text-right">Desembolso da Compra</th>
                  <th className="pb-3 text-right">Estoque Restante (Custo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {financialSimulation.scenarios.map((row) => {
                  const isPlanned = row.quantity === simPlannedQty;
                  return (
                    <tr
                      key={row.quantity}
                      className={isPlanned ? 'bg-amber-500/10 font-semibold' : 'hover:bg-white/[0.02]'}
                    >
                      <td className="py-3.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[var(--adm-text)]">
                            {row.label}
                          </span>
                          {row.exceedsPlannedPurchase && (
                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                              Acima do lote planejado
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--adm-text-muted)]">
                          Equilíbrio do lote: {financialSimulation.unitsToRecoverOutlay ?? '-'} un.
                        </div>
                      </td>
                      <td className="py-3.5 text-right font-bold text-[var(--adm-text)]">
                        {formatCurrency(row.grossRevenue)}
                      </td>
                      <td className="py-3.5 text-right text-[var(--adm-text-muted)]">
                        {formatCurrency(row.cogsSoldUnits)}
                      </td>
                      <td
                        className={`py-3.5 text-right font-extrabold ${
                          row.projectedGrossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(row.projectedGrossProfit)}
                      </td>
                      <td className="py-3.5 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            (row.grossMarginPct ?? 0) >= 25
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : (row.grossMarginPct ?? 0) > 0
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {row.grossMarginPct !== null ? `${row.grossMarginPct}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-semibold text-amber-300">
                        {formatCurrency(row.purchaseOutlay)}
                      </td>
                      <td className="py-3.5 text-right text-[var(--adm-text-muted)]">
                        {row.unsoldUnitsFromPurchase > 0
                          ? `${row.unsoldUnitsFromPurchase} un. (${formatCurrency(row.remainingInventoryValueAtCost)})`
                          : '0 un. (R$ 0,00)'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3 text-xs text-[var(--adm-text-muted)]">
            <strong>Nota de Transparência Financeira:</strong> As projeções acima representam{' '}
            <strong>receita bruta e margem bruta estimada</strong> caso as quantidades simuladas
            (10, 50, 100 ou lote planejado) sejam integralmente vendidas ao preço configurado. Não
            equivalem a lucro líquido contábil nem constituem garantia de demanda.
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: DETALHES DA LISTA, APROVAÇÃO E TRILHA DE AUDITORIA
         ===================================================================== */}
      {detailListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--adm-border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-amber-400">
                    {detailListModal.code}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                      STATUS_BADGE_STYLE[detailListModal.status] || ''
                    }`}
                  >
                    {PURCHASE_STATUS_LABELS[detailListModal.status] || detailListModal.status}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-extrabold text-[var(--adm-text)]">
                  {detailListModal.title}
                </h3>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Objetivo: {detailListModal.purpose} • Data desejada:{' '}
                  {detailListModal.desiredDate || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailListModal(null)}
                className="rounded-lg border border-[var(--adm-border)] px-3 py-1 text-xs font-bold text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3 text-xs">
                <span className="text-[var(--adm-text-muted)]">1. Quem Solicitou</span>
                <p className="mt-0.5 font-bold text-[var(--adm-text)]">
                  {detailListModal.createdByName}
                </p>
                <p className="text-[11px] text-[var(--adm-text-muted)]">
                  Em {formatDateTime(detailListModal.createdAt)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3 text-xs">
                <span className="text-[var(--adm-text-muted)]">2. Quem Autorizou / Aprovou</span>
                {detailListModal.approvedByName ? (
                  <>
                    <p className="mt-0.5 font-bold text-emerald-400">
                      {detailListModal.approvedByName}
                    </p>
                    <p className="text-[11px] text-[var(--adm-text-muted)]">
                      Teto: {formatCurrency(detailListModal.approvedLimitTotal || 0)} em{' '}
                      {formatDateTime(detailListModal.approvedAt)}
                    </p>
                  </>
                ) : detailListModal.rejectedByName ? (
                  <>
                    <p className="mt-0.5 font-bold text-rose-400">
                      Rejeitada por {detailListModal.rejectedByName}
                    </p>
                    <p className="text-[11px] text-rose-300">{detailListModal.rejectionReason}</p>
                  </>
                ) : (
                  <p className="mt-1 font-semibold text-amber-300">Pendente de Aprovação</p>
                )}
              </div>
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] p-3 text-xs">
                <span className="text-[var(--adm-text-muted)]">3. Execução & Recebimento</span>
                <p className="mt-0.5 font-bold text-[var(--adm-text)]">
                  Comprador: {detailListModal.assignedBuyerName || 'A definir'}
                </p>
                <p className="text-[11px] text-[var(--adm-text-muted)]">
                  Eventos de recebimento: {detailListModal.receiptHistory?.length || 0}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--adm-border)] text-[11px] uppercase text-[var(--adm-text-muted)]">
                    <th className="pb-2">Produto</th>
                    <th className="pb-2">Fornecedor</th>
                    <th className="pb-2 text-center">Solicitado</th>
                    <th className="pb-2 text-center">Comprado / Recebido</th>
                    <th className="pb-2 text-right">Custo Cotado / Real</th>
                    <th className="pb-2 text-right">Total Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--adm-border)]">
                  {detailListModal.items.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2.5">
                        <div className="font-bold text-[var(--adm-text)]">{item.productTitle}</div>
                        <div className="text-[10px] text-[var(--adm-text-muted)]">
                          Motivo: {REASON_LABELS[item.reason]}
                        </div>
                      </td>
                      <td className="py-2.5">{item.supplierName}</td>
                      <td className="py-2.5 text-center font-bold">
                        {item.requestedQty} {item.unit}
                      </td>
                      <td className="py-2.5 text-center">
                        {item.receivedQty !== undefined ? (
                          <span className="font-bold text-emerald-400">
                            Comp: {item.purchasedQty ?? item.requestedQty} | Rec: {item.receivedQty}
                          </span>
                        ) : (
                          <span className="text-[var(--adm-text-muted)]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {formatCurrency(item.quotedUnitCost)}
                        {item.effectiveUnitCost !== undefined &&
                          item.effectiveUnitCost !== item.quotedUnitCost && (
                            <span className="block text-[10px] text-amber-300">
                              Real: {formatCurrency(item.effectiveUnitCost)}
                            </span>
                          )}
                      </td>
                      <td className="py-2.5 text-right font-bold">
                        {formatCurrency(item.estimatedItemTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(detailListModal.status === 'aguardando_aprovacao' ||
              detailListModal.status === 'rascunho') &&
              perms.canApproveOrReject && (
                <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    Deliberação de Alçada & Autorização Financeira
                  </h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      placeholder="Condição, ressalva de teto ou motivo de rejeição..."
                      className="adm-input w-full px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={buyerNameInput}
                      onChange={(e) => setBuyerNameInput(e.target.value)}
                      placeholder="Comprador designado (opcional)..."
                      className="adm-input w-full px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAuthorizeDecision(detailListModal, 'reject')}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30"
                    >
                      Rejeitar / Pedir Ajuste
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAuthorizeDecision(detailListModal, 'approve')}
                      className="rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-neutral-950 hover:bg-emerald-400"
                    >
                      Aprovar Compra ({formatCurrency(detailListModal.estimatedGrandTotal)})
                    </button>
                  </div>
                </div>
              )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--adm-border)] pt-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintExecutionSheet(detailListModal)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] text-xs font-semibold border border-[var(--adm-border)] inline-flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Ordem
                </button>
                {detailListModal.status !== 'recebida' &&
                  detailListModal.status !== 'cancelada' && (
                    <button
                      type="button"
                      onClick={() => void handleCancelList(detailListModal)}
                      className="rounded-xl border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/15"
                    >
                      Cancelar Lista
                    </button>
                  )}
              </div>

              <div className="flex flex-wrap gap-2">
                {detailListModal.status === 'aprovada' && (
                  <button
                    type="button"
                    onClick={() => void handleStartExecution(detailListModal)}
                    className="rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-neutral-950 hover:bg-sky-400"
                  >
                    Marcar "Em Compra"
                  </button>
                )}
                {(detailListModal.status === 'aprovada' ||
                  detailListModal.status === 'em_compra' ||
                  detailListModal.status === 'parcialmente_recebida') && (
                  <button
                    type="button"
                    onClick={() => handleOpenReceiptModal(detailListModal)}
                    className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-neutral-950 hover:bg-amber-400"
                  >
                    Registrar Recebimento Físico
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--adm-border)] pt-4">
              <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--adm-text-muted)]">
                Trilha de Auditoria da Lista ({detailListModal.auditTrail?.length || 0} eventos)
              </h4>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1 text-xs">
                {(detailListModal.auditTrail || []).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-elevated)] px-3 py-2"
                  >
                    <div>
                      <span className="font-bold text-[var(--adm-text)]">{ev.action}</span>
                      {ev.comment && (
                        <p className="text-[11px] text-amber-300">Obs: {ev.comment}</p>
                      )}
                      <p className="text-[11px] text-[var(--adm-text-muted)]">
                        Por {ev.actorName} ({ev.actorRole || 'staff'})
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--adm-text-muted)]">
                      {formatDateTime(ev.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: RECEBIMENTO DE MERCADORIA (PARCIAL OU TOTAL + ENTRADA ESTOQUE)
         ===================================================================== */}
      {receiptModalList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[var(--adm-text)]">
                  Conferência e Recebimento — {receiptModalList.code}
                </h3>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Informe as quantidades efetivamente compradas e recebidas. Se faltarem itens, a lista ficará como Parcialmente Recebida.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalList(null)}
                className="text-xs font-bold text-[var(--adm-text-muted)]"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--adm-border)] text-[11px] uppercase text-[var(--adm-text-muted)]">
                    <th className="pb-2">Produto</th>
                    <th className="pb-2 text-center">Solicitado</th>
                    <th className="pb-2 text-center">Qtd. Comprada</th>
                    <th className="pb-2 text-center">Qtd. Recebida</th>
                    <th className="pb-2 text-right">Custo Real Unit. (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--adm-border)]">
                  {receiptDraftItems.map((item, idx) => (
                    <tr key={item.productId}>
                      <td className="py-2.5 font-bold text-[var(--adm-text)]">
                        {item.productTitle}
                      </td>
                      <td className="py-2.5 text-center">
                        {item.requestedQty} {item.unit}
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={item.purchasedQty ?? item.requestedQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value || 0));
                            setReceiptDraftItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, purchasedQty: val } : it)),
                            );
                          }}
                          className="adm-input w-20 px-2 py-1 text-center text-xs"
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={item.receivedQty ?? item.requestedQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value || 0));
                            setReceiptDraftItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, receivedQty: val } : it)),
                            );
                          }}
                          className="adm-input w-20 px-2 py-1 text-center text-xs"
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.effectiveUnitCost ?? item.quotedUnitCost}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value || 0));
                            setReceiptDraftItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, effectiveUnitCost: val } : it,
                              ),
                            );
                          }}
                          className="adm-input w-24 px-2 py-1 text-right text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                  Número da Nota Fiscal / Recibo
                </label>
                <input
                  type="text"
                  value={receiptInvoiceRef}
                  onChange={(e) => setReceiptInvoiceRef(e.target.value)}
                  className="adm-input w-full px-3 py-1.5 text-xs"
                  placeholder="Ex: NF-e 004591"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                  Observação da Conferência
                </label>
                <input
                  type="text"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  className="adm-input w-full px-3 py-1.5 text-xs"
                  placeholder="Condição das embalagens, validade..."
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-bold text-[var(--adm-text-muted)]">
                Justificativa para Encerrar com Falta (apenas se não for receber o restante)
              </label>
              <input
                type="text"
                value={receiptJustification}
                onChange={(e) => setReceiptJustification(e.target.value)}
                className="adm-input w-full px-3 py-1.5 text-xs"
                placeholder="Ex: Fornecedor sem saldo do item restante, encerrar ordem com corte."
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs text-[var(--adm-text)]">
              <input
                type="checkbox"
                checked={receiptApplyToStock}
                onChange={(e) => setReceiptApplyToStock(e.target.checked)}
              />
              <span>
                Somar automaticamente as novas unidades recebidas ao estoque físico do catálogo
              </span>
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmReceipt(false)}
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs"
              >
                Salvar Recebimento (Automático Parcial / Total)
              </button>
              {receiptJustification.trim().length >= 5 && (
                <button
                  type="button"
                  onClick={() => void handleConfirmReceipt(true)}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-300"
                >
                  Encerrar Lista como Recebida com Corte Justificado
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: PARÂMETROS DE COMPRA DO PRODUTO & HIPÓTESE DE PRODUTO NOVO
         ===================================================================== */}
      {productConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[var(--adm-text)]">
                  Parâmetros & Hipótese — {productConfigModal.productTitle}
                </h3>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Configure lead time, lote mínimo, fornecedor preferencial e hipótese comercial para itens sem histórico.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProductConfigModal(null)}
                className="text-xs font-bold text-[var(--adm-text-muted)]"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div>
                <label className="mb-1 block font-bold text-[var(--adm-text-muted)]">
                  Prazo Entrega / Lead Time (dias)
                </label>
                <input
                  type="number"
                  min={1}
                  value={productConfigForm.leadTimeDays}
                  onChange={(e) =>
                    setProductConfigForm((p) => ({ ...p, leadTimeDays: Number(e.target.value) }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-[var(--adm-text-muted)]">
                  Dias de Segurança
                </label>
                <input
                  type="number"
                  min={0}
                  value={productConfigForm.safetyStockDays}
                  onChange={(e) =>
                    setProductConfigForm((p) => ({
                      ...p,
                      safetyStockDays: Number(e.target.value),
                    }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-[var(--adm-text-muted)]">
                  Status Comercial
                </label>
                <select
                  value={productConfigForm.commercialStatus}
                  onChange={(e) =>
                    setProductConfigForm((p) => ({
                      ...p,
                      commercialStatus: e.target.value as ProductCommercialStatus,
                    }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                >
                  <option value="ativo">Ativo</option>
                  <option value="sazonal">Sazonal</option>
                  <option value="pausado">Pausado</option>
                  <option value="descontinuado">Descontinuado</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-bold text-[var(--adm-text-muted)]">
                  Lote Mínimo Compra
                </label>
                <input
                  type="number"
                  min={1}
                  value={productConfigForm.minLot}
                  onChange={(e) =>
                    setProductConfigForm((p) => ({ ...p, minLot: Number(e.target.value) }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-[var(--adm-text-muted)]">
                  Múltiplo de Caixa / Fardo
                </label>
                <input
                  type="number"
                  min={1}
                  value={productConfigForm.packMultiple}
                  onChange={(e) =>
                    setProductConfigForm((p) => ({ ...p, packMultiple: Number(e.target.value) }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-[var(--adm-text-muted)]">
                  Fornecedor Preferencial
                </label>
                <select
                  value={productConfigForm.primarySupplierId}
                  onChange={(e) =>
                    setProductConfigForm((p) => ({
                      ...p,
                      primarySupplierId: e.target.value,
                    }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                >
                  <option value="">Selecionar...</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.leadTimeDays}d)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
              <label className="flex items-center gap-2 text-xs font-extrabold text-purple-200">
                <input
                  type="checkbox"
                  checked={productConfigForm.hasHypothesis}
                  onChange={(e) =>
                    setProductConfigForm((p) => ({ ...p, hasHypothesis: e.target.checked }))
                  }
                />
                <span>
                  Manter Hipótese Manual Registrada (para produto novo / teste comercial)
                </span>
              </label>

              {productConfigForm.hasHypothesis && (
                <div className="mt-3 space-y-3 text-xs">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-purple-200">
                        Lote Inicial de Teste (un.)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={productConfigForm.initialPlannedQty}
                        onChange={(e) =>
                          setProductConfigForm((p) => ({
                            ...p,
                            initialPlannedQty: Number(e.target.value),
                          }))
                        }
                        className="adm-input w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-purple-200">
                        Custo Cotado (R$)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={productConfigForm.quotedUnitCost}
                        onChange={(e) =>
                          setProductConfigForm((p) => ({
                            ...p,
                            quotedUnitCost: Number(e.target.value),
                          }))
                        }
                        className="adm-input w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-purple-200">
                        Preço de Venda Planejado (R$)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={productConfigForm.plannedSalePrice}
                        onChange={(e) =>
                          setProductConfigForm((p) => ({
                            ...p,
                            plannedSalePrice: Number(e.target.value),
                          }))
                        }
                        className="adm-input w-full px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-purple-200">
                      Justificativa Comercial da Hipótese
                    </label>
                    <input
                      type="text"
                      value={productConfigForm.confidenceJustification}
                      onChange={(e) =>
                        setProductConfigForm((p) => ({
                          ...p,
                          confidenceJustification: e.target.value,
                        }))
                      }
                      className="adm-input w-full px-2.5 py-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProductConfigModal(null)}
                className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] text-xs font-semibold border border-[var(--adm-border)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProductConfig()}
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 font-bold text-xs"
              >
                Salvar Parâmetros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: CADASTRO / EDIÇÃO DE FORNECEDOR
         ===================================================================== */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-[var(--adm-text)]">
              {supplierForm.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block font-bold">Razão Social / Nome Principal</label>
                <input
                  type="text"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))}
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Pessoa de Contato</label>
                <input
                  type="text"
                  value={supplierForm.contactName || ''}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, contactName: e.target.value }))}
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={supplierForm.phone || ''}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Lead Time Médio (dias)</label>
                <input
                  type="number"
                  min={1}
                  value={supplierForm.leadTimeDays ?? 3}
                  onChange={(e) =>
                    setSupplierForm((p) => ({
                      ...p,
                      leadTimeDays: Number(e.target.value),
                    }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Pedido Mínimo (R$)</label>
                <input
                  type="number"
                  min={0}
                  value={supplierForm.minOrderValue ?? 0}
                  onChange={(e) =>
                    setSupplierForm((p) => ({ ...p, minOrderValue: Number(e.target.value) }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Condição de Pagamento</label>
                <input
                  type="text"
                  value={supplierForm.paymentTerms || ''}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, paymentTerms: e.target.value }))}
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Status</label>
                <select
                  value={supplierForm.status || 'active'}
                  onChange={(e) =>
                    setSupplierForm((p) => ({
                      ...p,
                      status: e.target.value as 'active' | 'inactive',
                    }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] text-xs font-semibold border border-[var(--adm-border)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSupplierForm()}
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 font-bold text-xs"
              >
                Salvar Fornecedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: NOVA COTAÇÃO DE PREÇO
         ===================================================================== */}
      {quoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-[var(--adm-text)]">
              Registrar Nova Cotação (Histórico Imutável)
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block font-bold">Produto</label>
                <select
                  value={quoteForm.productId}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, productId: e.target.value }))}
                  className="adm-input w-full px-3 py-1.5"
                >
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.title} ({prod.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block font-bold">Fornecedor</label>
                <select
                  value={quoteForm.supplierId}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, supplierId: e.target.value }))}
                  className="adm-input w-full px-3 py-1.5"
                >
                  {suppliers
                    .filter((s) => s.status === 'active')
                    .map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-bold">Custo Unitário Cotado (R$)</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={quoteForm.unitCost}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, unitCost: Number(e.target.value) }))}
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Validade da Cotação</label>
                <input
                  type="date"
                  value={quoteForm.validUntil}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, validUntil: e.target.value }))}
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Lote Mínimo (un.)</label>
                <input
                  type="number"
                  min={1}
                  value={quoteForm.minQuantity}
                  onChange={(e) =>
                    setQuoteForm((p) => ({ ...p, minQuantity: Number(e.target.value) }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Prazo de Entrega (dias)</label>
                <input
                  type="number"
                  min={1}
                  value={quoteForm.leadTimeDays}
                  onChange={(e) =>
                    setQuoteForm((p) => ({ ...p, leadTimeDays: Number(e.target.value) }))
                  }
                  className="adm-input w-full px-3 py-1.5"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuoteModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] text-xs font-semibold border border-[var(--adm-border)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveQuoteForm()}
                className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] text-emerald-950 font-bold text-xs"
              >
                Registrar Cotação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPurchasingPage;
