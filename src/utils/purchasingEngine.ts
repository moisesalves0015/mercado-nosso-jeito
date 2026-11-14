import { isRecognizedSale, timestampToDate } from './adminAnalytics';

/**
 * Pure, deterministic calculation engine and domain model for the
 * "Assistente de Compras" (Purchasing & Replenishment Assistant) in Mercado Nosso Jeito.
 *
 * Strictly separates:
 *  1. Observed Historical Data (vendas reais registradas)
 *  2. User-Provided Assumptions / Hypotheses (premissas informadas pelo usuário)
 *  3. Calculated Projections (projeções e cenários simulados)
 *  4. Execution & Effective Receipt (compra autorizada, em trânsito e recebida)
 */

export type ProductCommercialStatus = 'ativo' | 'sazonal' | 'pausado' | 'descontinuado';

export type ProductHistoryState =
  | 'com_vendas'
  | 'sem_vendas_registradas'
  | 'dados_insuficientes';

export type PurchaseReason =
  | 'reposicao'
  | 'novo_produto'
  | 'sazonalidade'
  | 'manual'
  | 'promocao'
  | 'seguranca';

export type PurchaseListStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'rejeitada'
  | 'em_compra'
  | 'parcialmente_recebida'
  | 'recebida'
  | 'cancelada';

export const PURCHASE_STATUS_LABELS: Record<PurchaseListStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada / Ajuste',
  em_compra: 'Em Compra (Execução)',
  parcialmente_recebida: 'Parcialmente Recebida',
  recebida: 'Recebida (Concluída)',
  cancelada: 'Cancelada',
};

export interface SupplierRecord {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  document?: string;
  paymentTerms: string;
  leadTimeDays: number;
  minOrderValue: number;
  notes: string;
  status: 'active' | 'inactive';
  suppliedProductIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface SupplierQuoteRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productTitle: string;
  unitCost: number;
  unit: string;
  minQuantity: number;
  packMultiple: number;
  leadTimeDays: number;
  validUntil: string; // ISO date YYYY-MM-DD
  notes: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export interface NewProductHypothesis {
  inclusionReason: string;
  notes: string;
  quotedUnitCost: number;
  supplierId?: string;
  supplierName?: string;
  plannedSalePrice: number;
  initialPlannedQty: number;
  estimatedDailySales?: number | null;
  confidenceLevel: 'baixa' | 'media' | 'alta';
  confidenceJustification: string;
  scenarios: {
    conservadorQty: number;
    baseQty: number;
    otimistaQty: number;
  };
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface PurchasingProductMetadata {
  productId: string;
  primarySupplierId?: string;
  alternativeSupplierIds?: string[];
  minLot?: number;
  packMultiple?: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
  commercialStatus?: ProductCommercialStatus;
  lastCostUpdatedAt?: string;
  lastPriceUpdatedAt?: string;
  newProductHypothesis?: NewProductHypothesis | null;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PurchaseListItem {
  productId: string;
  productTitle: string;
  sku?: string;
  category?: string;
  unit: string;
  supplierId: string;
  supplierName: string;
  requestedQty: number;
  quotedUnitCost: number;
  currentSalePrice: number;
  estimatedItemTotal: number;
  reason: PurchaseReason;
  notes: string;
  isNewProduct?: boolean;
  quoteId?: string;
  quoteValidUntil?: string;
  // Execution & Receipt fields (populated only during em_compra / recebimento)
  purchasedQty?: number;
  effectiveUnitCost?: number;
  actualSupplierId?: string;
  actualSupplierName?: string;
  receivedQty?: number;
  receivingNotes?: string;
  invoiceRef?: string;
}

export interface PurchaseAuditEntry {
  id: string;
  timestamp: string;
  actorUid: string;
  actorName: string;
  actorRole?: string | null;
  action: string;
  previousStatus?: PurchaseListStatus | null;
  newStatus?: PurchaseListStatus | null;
  comment?: string;
  beforeSummary?: string;
  afterSummary?: string;
}

export interface PurchaseReceiptEvent {
  id: string;
  timestamp: string;
  actorUid: string;
  actorName: string;
  invoiceRef?: string;
  notes?: string;
  itemsReceived: Array<{
    productId: string;
    productTitle: string;
    deltaReceivedQty: number;
    effectiveUnitCost: number;
  }>;
}

export interface PurchaseListRecord {
  id: string;
  code: string;
  title: string;
  purpose: string;
  desiredDate: string;
  notes: string;
  status: PurchaseListStatus;
  items: PurchaseListItem[];
  freightCost: number;
  taxCost: number;
  otherCost: number;
  paymentTerms: string;
  estimatedItemsTotal: number;
  estimatedGrandTotal: number;
  /** Frozen ceiling value set when the authorizer approves the list. */
  approvedLimitTotal: number | null;
  effectiveItemsTotal: number;
  effectiveGrandTotal: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  submittedBy?: string | null;
  submittedByName?: string | null;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvalComment?: string | null;
  rejectedBy?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  assignedBuyerUid?: string | null;
  assignedBuyerName?: string | null;
  assignedAt?: string | null;
  closedShortJustification?: string | null;
  receiptHistory: PurchaseReceiptEvent[];
  auditTrail: PurchaseAuditEntry[];
}

export interface CatalogProductLike {
  id: string;
  title: string;
  price?: number;
  costPrice?: number;
  category?: string;
  stock?: number;
  minStock?: number;
  sku?: string;
  ean?: string;
  unit?: string;
  supplier?: string;
  active?: boolean;
  updatedAt?: string;
}

export interface OrderLike {
  id?: string;
  status?: string;
  paymentStatus?: string;
  createdAt?: unknown;
  items?: Array<{
    id?: string;
    productId?: string;
    title?: string;
    quantity?: number;
    price?: number;
  }>;
}

export interface ReplenishmentAnalysisInput {
  product: CatalogProductLike;
  meta?: PurchasingProductMetadata | null;
  orders: OrderLike[] | null;
  purchaseLists?: Array<Partial<PurchaseListRecord>>;
  suppliers?: SupplierRecord[];
  quotes?: SupplierQuoteRecord[];
  periodDays: number;
  now?: Date;
  nowMs?: number;
  defaultLeadTimeDays?: number;
  defaultSafetyStockDays?: number;
  onlyRecognizedSales?: boolean;
}

export interface ReplenishmentAnalysisResult {
  productId: string;
  productTitle: string;
  sku: string;
  category: string;
  unit: string;
  commercialStatus: ProductCommercialStatus;
  historyState: ProductHistoryState;
  periodDays: number;
  daysWithData: number;
  periodStartIso: string;
  periodEndIso: string;
  // Sales metrics
  unitsSoldInPeriod: number;
  unitsSoldPreviousPeriod: number;
  totalHistoricalUnitsSold: number;
  revenueInPeriod: number;
  dailyAvgSales: number;
  weeklyAvgSales: number;
  monthlyAvgSales: number;
  trendPct: number | null;
  trendDirection: 'up' | 'down' | 'stable' | 'new_momentum' | 'no_data';
  // Stock metrics
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  inTransitQty: number;
  minStock: number;
  coverageDays: number | null;
  // Replenishment parameters
  leadTimeDays: number;
  leadTimeIsAssumed: boolean;
  safetyStockDays: number;
  safetyStockIsAssumed: boolean;
  minLot: number;
  packMultiple: number;
  demandDuringLeadTime: number | null;
  safetyStockUnits: number | null;
  reorderPoint: number | null;
  rawSuggestedQty: number;
  suggestedQty: number;
  needsReplenishment: boolean;
  urgencyLevel: 'critico' | 'atencao' | 'confortavel' | 'sem_historico' | 'pausado';
  // Cost & Supplier
  unitCost: number;
  unitCostSource: string;
  salePrice: number;
  estimatedReplenishmentCost: number;
  preferredSupplierId: string;
  preferredSupplierName: string;
  hasExpiredQuote: boolean;
  bestQuote: SupplierQuoteRecord | null;
  explanation: string;
  missingDataWarnings: string[];
}

export interface SalesScenarioRow {
  quantity: number;
  label: string;
  grossRevenue: number;
  cogsSoldUnits: number;
  projectedGrossProfit: number;
  grossMarginPct: number | null;
  purchaseOutlay: number;
  unsoldUnitsFromPurchase: number;
  remainingInventoryValueAtCost: number;
  netCashFlowAfterSales: number;
  exceedsPlannedPurchase: boolean;
}

export interface FinancialAnalysisResult {
  unitCost: number;
  salePrice: number;
  plannedPurchaseQty: number;
  freightCost: number;
  taxCost: number;
  otherCost: number;
  unitGrossProfit: number;
  grossMarginPct: number | null;
  itemsSubtotalCost: number;
  totalPurchaseOutlay: number;
  effectiveUnitCostWithExtras: number;
  /** Number of units that must be sold at `salePrice` to recover `totalPurchaseOutlay`. */
  unitsToRecoverOutlay: number | null;
  canRecoverOutlayWithinPurchase: boolean;
  scenarios: SalesScenarioRow[];
  warnings: string[];
}

/**
 * Safe currency rounding to 2 decimal places (avoids IEEE 754 float drift).
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Safe decimal rounding to N decimal places.
 */
export function roundNumber(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Applies minimum lot (`minLot`) and packaging multiple (`packMultiple`) to a raw positive quantity.
 */
export function applyLotAndPackConstraints(
  rawQty: number,
  minLot = 1,
  packMultiple = 1,
): number {
  if (!Number.isFinite(rawQty) || rawQty <= 0) return 0;
  let qty = Math.ceil(rawQty);
  const safeMinLot = Number.isFinite(minLot) && minLot > 1 ? Math.ceil(minLot) : 1;
  const safeMultiple = Number.isFinite(packMultiple) && packMultiple > 1 ? Math.ceil(packMultiple) : 1;

  if (qty < safeMinLot) {
    qty = safeMinLot;
  }
  if (safeMultiple > 1) {
    qty = Math.ceil(qty / safeMultiple) * safeMultiple;
  }
  return qty;
}

/**
 * Computes reserved stock (from active pending/preparing orders) and
 * confirmed in-transit quantity (from approved/in_execution/partially_received purchase lists).
 * Never merges in-transit quantity into physical stock.
 */
export function computeReservedAndInTransit(
  productId: string,
  productTitle: string,
  orders: OrderLike[] | null,
  purchaseLists: Array<Partial<PurchaseListRecord>> = [],
): { reservedStock: number; inTransitQty: number } {
  let reservedStock = 0;
  if (Array.isArray(orders)) {
    for (const order of orders) {
      if (
        order.status === 'pending' ||
        order.status === 'confirmed' ||
        order.status === 'preparing'
      ) {
        for (const item of order.items || []) {
          if (
            item.id === productId ||
            item.productId === productId ||
            (item.title && item.title === productTitle)
          ) {
            const q = Number(item.quantity || 0);
            if (Number.isFinite(q) && q > 0) reservedStock += q;
          }
        }
      }
    }
  }

  let inTransitQty = 0;
  for (const list of purchaseLists) {
    if (
      list.status === 'aprovada' ||
      list.status === 'em_compra' ||
      list.status === 'parcialmente_recebida'
    ) {
      for (const item of list.items || []) {
        if (item.productId === productId) {
          const targetQty =
            item.purchasedQty !== undefined && item.purchasedQty > 0
              ? item.purchasedQty
              : item.requestedQty;
          const received = Number(item.receivedQty || 0);
          const pending = Math.max(0, targetQty - received);
          if (Number.isFinite(pending) && pending > 0) {
            inTransitQty += pending;
          }
        }
      }
    }
  }

  return { reservedStock, inTransitQty };
}

/**
 * Evaluates a single product's sales history, stock coverage, reorder point,
 * and explainable purchase recommendation.
 */
export function analyzeProductReplenishment(
  input: ReplenishmentAnalysisInput,
): ReplenishmentAnalysisResult {
  const {
    product,
    meta,
    orders,
    purchaseLists = [],
    suppliers = [],
    quotes = [],
    periodDays: rawPeriodDays,
    now,
    nowMs,
    defaultLeadTimeDays = 3,
    defaultSafetyStockDays = 5,
    onlyRecognizedSales = false,
  } = input;

  const effectiveNow = now ?? (typeof nowMs === 'number' ? new Date(nowMs) : new Date());
  const periodDays = Math.max(1, Math.floor(Number(rawPeriodDays) || 30));
  const periodEndMs = effectiveNow.getTime();
  const periodStartMs = periodEndMs - periodDays * 86_400_000;
  const prevPeriodStartMs = periodStartMs - periodDays * 86_400_000;

  const physicalStock = Math.max(0, Math.floor(Number(product.stock ?? 0)));
  const minStock = Math.max(0, Math.floor(Number(product.minStock ?? 5)));
  const commercialStatus: ProductCommercialStatus =
    meta?.commercialStatus || (product.active === false ? 'pausado' : 'ativo');

  const { reservedStock, inTransitQty } = computeReservedAndInTransit(
    product.id,
    product.title,
    orders,
    purchaseLists,
  );
  const availableStock = Math.max(0, physicalStock - reservedStock);

  // Quotes & Supplier resolution
  const productQuotes = quotes
    .filter((q) => q.productId === product.id && Number(q.unitCost) > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const todayIso = effectiveNow.toISOString().slice(0, 10);
  const validQuotes = productQuotes.filter((q) => !q.validUntil || q.validUntil >= todayIso);
  const bestQuote =
    validQuotes.length > 0
      ? [...validQuotes].sort((a, b) => a.unitCost - b.unitCost)[0]
      : productQuotes[0] || null;
  const hasExpiredQuote =
    productQuotes.length > 0 && validQuotes.length === 0;

  const primarySupplier = suppliers.find((s) => s.id === meta?.primarySupplierId);
  const preferredSupplierId =
    primarySupplier?.id || bestQuote?.supplierId || '';
  const preferredSupplierName =
    primarySupplier?.name ||
    bestQuote?.supplierName ||
    product.supplier ||
    'Não definido';

  // Cost & Price resolution
  const catalogCost = Number(product.costPrice || 0);
  const hypothesisCost = Number(meta?.newProductHypothesis?.quotedUnitCost || 0);
  let unitCost = 0;
  let unitCostSource = 'Sem custo informado';

  if (bestQuote && validQuotes.length > 0) {
    unitCost = roundCurrency(bestQuote.unitCost);
    unitCostSource = `Cotação (${bestQuote.supplierName})`;
  } else if (catalogCost > 0) {
    unitCost = roundCurrency(catalogCost);
    unitCostSource = 'Cadastro do produto';
  } else if (bestQuote) {
    unitCost = roundCurrency(bestQuote.unitCost);
    unitCostSource = `Cotação vencida (${bestQuote.supplierName})`;
  } else if (hypothesisCost > 0) {
    unitCost = roundCurrency(hypothesisCost);
    unitCostSource = 'Hipótese manual de novo produto';
  }

  const salePrice = roundCurrency(
    Number(product.price || meta?.newProductHypothesis?.plannedSalePrice || 0),
  );

  // Lead time & Safety stock resolution
  const explicitLeadTime =
    Number(meta?.leadTimeDays || 0) ||
    Number(primarySupplier?.leadTimeDays || 0) ||
    Number(bestQuote?.leadTimeDays || 0);
  const leadTimeIsAssumed = explicitLeadTime <= 0;
  const leadTimeDays = explicitLeadTime > 0 ? explicitLeadTime : defaultLeadTimeDays;

  const explicitSafetyDays = Number(meta?.safetyStockDays || 0);
  const safetyStockIsAssumed = explicitSafetyDays <= 0;
  const safetyStockDays = explicitSafetyDays > 0 ? explicitSafetyDays : defaultSafetyStockDays;

  const minLot = Math.max(1, Math.floor(Number(meta?.minLot || bestQuote?.minQuantity || 1)));
  const packMultiple = Math.max(
    1,
    Math.floor(Number(meta?.packMultiple || bestQuote?.packMultiple || 1)),
  );

  const missingDataWarnings: string[] = [];
  if (unitCost <= 0) missingDataWarnings.push('Custo unitário de aquisição não cadastrado.');
  if (salePrice <= 0) missingDataWarnings.push('Preço de venda não cadastrado.');
  if (preferredSupplierName === 'Não definido') {
    missingDataWarnings.push('Fornecedor principal não vinculado.');
  }
  if (hasExpiredQuote) {
    missingDataWarnings.push('Todas as cotações deste produto estão vencidas.');
  }

  // If orders failed to load (null), never infer that the product is new!
  if (orders === null) {
    missingDataWarnings.push(
      'Histórico de pedidos indisponível no momento. Não é possível confirmar giro real.',
    );
    return {
      productId: product.id,
      productTitle: product.title,
      sku: product.sku || product.ean || '—',
      category: product.category || 'Geral',
      unit: product.unit || 'UN',
      commercialStatus,
      historyState: 'dados_insuficientes',
      periodDays,
      daysWithData: 0,
      periodStartIso: new Date(periodStartMs).toISOString(),
      periodEndIso: new Date(periodEndMs).toISOString(),
      unitsSoldInPeriod: 0,
      unitsSoldPreviousPeriod: 0,
      totalHistoricalUnitsSold: 0,
      revenueInPeriod: 0,
      dailyAvgSales: 0,
      weeklyAvgSales: 0,
      monthlyAvgSales: 0,
      trendPct: null,
      trendDirection: 'no_data',
      physicalStock,
      reservedStock,
      availableStock,
      inTransitQty,
      minStock,
      coverageDays: null,
      leadTimeDays,
      leadTimeIsAssumed,
      safetyStockDays,
      safetyStockIsAssumed,
      minLot,
      packMultiple,
      demandDuringLeadTime: null,
      safetyStockUnits: null,
      reorderPoint: null,
      rawSuggestedQty: 0,
      suggestedQty: 0,
      needsReplenishment: false,
      urgencyLevel: 'sem_historico',
      unitCost,
      unitCostSource,
      salePrice,
      estimatedReplenishmentCost: 0,
      preferredSupplierId,
      preferredSupplierName,
      hasExpiredQuote,
      bestQuote,
      explanation:
        'Dados insuficientes: a consulta de pedidos não pôde ser concluída. Planejamento disponível apenas em modo manual.',
      missingDataWarnings,
    };
  }

  // Aggregate sales across orders
  let unitsSoldInPeriod = 0;
  let unitsSoldPreviousPeriod = 0;
  let totalHistoricalUnitsSold = 0;
  let revenueInPeriod = 0;

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    if (onlyRecognizedSales && !isRecognizedSale(order)) continue;

    const orderDate = timestampToDate(order.createdAt);
    const orderMs = orderDate ? orderDate.getTime() : null;

    for (const item of order.items || []) {
      if (
        item.id === product.id ||
        item.productId === product.id ||
        (item.title && item.title === product.title)
      ) {
        const qty = Number(item.quantity || 1);
        const itemPrice = Number(item.price ?? product.price ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        totalHistoricalUnitsSold += qty;

        if (orderMs !== null) {
          if (orderMs >= periodStartMs && orderMs <= periodEndMs) {
            unitsSoldInPeriod += qty;
            revenueInPeriod += qty * itemPrice;
          } else if (orderMs >= prevPeriodStartMs && orderMs < periodStartMs) {
            unitsSoldPreviousPeriod += qty;
          }
        } else {
          // Order without timestamp counts in current window fallback
          unitsSoldInPeriod += qty;
          revenueInPeriod += qty * itemPrice;
        }
      }
    }
  }

  revenueInPeriod = roundCurrency(revenueInPeriod);
  const daysWithData = periodDays;

  // Determine history state
  const historyState: ProductHistoryState =
    totalHistoricalUnitsSold > 0 ? 'com_vendas' : 'sem_vendas_registradas';

  // If product has zero historical sales, do NOT invent demand or reorder point!
  if (historyState === 'sem_vendas_registradas') {
    const manualQty = Number(meta?.newProductHypothesis?.initialPlannedQty || 0);
    const constrainedManualQty =
      manualQty > 0 ? applyLotAndPackConstraints(manualQty, minLot, packMultiple) : 0;

    return {
      productId: product.id,
      productTitle: product.title,
      sku: product.sku || product.ean || '—',
      category: product.category || 'Geral',
      unit: product.unit || 'UN',
      commercialStatus,
      historyState: 'sem_vendas_registradas',
      periodDays,
      daysWithData,
      periodStartIso: new Date(periodStartMs).toISOString(),
      periodEndIso: new Date(periodEndMs).toISOString(),
      unitsSoldInPeriod: 0,
      unitsSoldPreviousPeriod: 0,
      totalHistoricalUnitsSold: 0,
      revenueInPeriod: 0,
      dailyAvgSales: 0,
      weeklyAvgSales: 0,
      monthlyAvgSales: 0,
      trendPct: null,
      trendDirection: 'no_data',
      physicalStock,
      reservedStock,
      availableStock,
      inTransitQty,
      minStock,
      coverageDays: null,
      leadTimeDays,
      leadTimeIsAssumed,
      safetyStockDays,
      safetyStockIsAssumed,
      minLot,
      packMultiple,
      demandDuringLeadTime: null,
      safetyStockUnits: null,
      reorderPoint: null,
      rawSuggestedQty: manualQty,
      suggestedQty: constrainedManualQty,
      needsReplenishment: false,
      urgencyLevel: commercialStatus === 'pausado' || commercialStatus === 'descontinuado' ? 'pausado' : 'sem_historico',
      unitCost,
      unitCostSource,
      salePrice,
      estimatedReplenishmentCost: roundCurrency(constrainedManualQty * unitCost),
      preferredSupplierId,
      preferredSupplierName,
      hasExpiredQuote,
      bestQuote,
      explanation:
        manualQty > 0
          ? `Produto sem vendas registradas nos últimos ${periodDays} dias. Possui planejamento manual inicial de ${constrainedManualQty} ${product.unit || 'UN'} (premissa informada pelo usuário).`
          : `Sem vendas registradas nos últimos ${periodDays} dias (${daysWithData} dias consultados). Avalie manualmente a quantidade inicial antes de comprar.`,
      missingDataWarnings,
    };
  }

  // Product HAS sales history
  const dailyAvgSales = daysWithData > 0 ? roundNumber(unitsSoldInPeriod / daysWithData, 3) : 0;
  const weeklyAvgSales = roundNumber(dailyAvgSales * 7, 2);
  const monthlyAvgSales = roundNumber(dailyAvgSales * 30, 1);

  let trendPct: number | null = null;
  let trendDirection: ReplenishmentAnalysisResult['trendDirection'] = 'stable';

  if (unitsSoldPreviousPeriod > 0) {
    trendPct = roundNumber(
      ((unitsSoldInPeriod - unitsSoldPreviousPeriod) / unitsSoldPreviousPeriod) * 100,
      1,
    );
    if (trendPct > 10) trendDirection = 'up';
    else if (trendPct < -10) trendDirection = 'down';
    else trendDirection = 'stable';
  } else if (unitsSoldInPeriod > 0) {
    trendDirection = 'new_momentum';
  }

  const coverageDays =
    dailyAvgSales > 0 ? roundNumber(availableStock / dailyAvgSales, 1) : null;

  const demandDuringLeadTime = roundNumber(dailyAvgSales * leadTimeDays, 2);
  const safetyStockUnits = roundNumber(dailyAvgSales * safetyStockDays, 2);
  const reorderPoint = roundNumber(demandDuringLeadTime + safetyStockUnits, 2);

  const isPausedOrDiscontinued =
    commercialStatus === 'pausado' || commercialStatus === 'descontinuado';

  const rawDeficit = Math.max(0, reorderPoint - availableStock - inTransitQty);
  // If product has historical sales globally, but 0 in the recent small window, also check minStock deficit
  const minStockDeficit =
    unitsSoldInPeriod === 0 && availableStock + inTransitQty < minStock
      ? Math.max(0, minStock - availableStock - inTransitQty)
      : 0;

  const rawSuggestedQty = isPausedOrDiscontinued
    ? 0
    : Math.max(rawDeficit, minStockDeficit);

  const suggestedQty =
    rawSuggestedQty > 0
      ? applyLotAndPackConstraints(rawSuggestedQty, minLot, packMultiple)
      : 0;

  const needsReplenishment = !isPausedOrDiscontinued && suggestedQty > 0;

  let urgencyLevel: ReplenishmentAnalysisResult['urgencyLevel'] = 'confortavel';
  if (isPausedOrDiscontinued) {
    urgencyLevel = 'pausado';
  } else if (
    availableStock === 0 ||
    (coverageDays !== null && coverageDays <= leadTimeDays)
  ) {
    urgencyLevel = 'critico';
  } else if (
    needsReplenishment ||
    availableStock <= minStock ||
    (coverageDays !== null && coverageDays <= leadTimeDays + safetyStockDays)
  ) {
    urgencyLevel = 'atencao';
  }

  const estimatedReplenishmentCost = roundCurrency(suggestedQty * unitCost);

  // Build transparent plain-Portuguese explanation
  const parts: string[] = [];
  parts.push(
    `Vendeu ${unitsSoldInPeriod} ${product.unit || 'UN'} nos últimos ${periodDays} dias (média de ${dailyAvgSales.toLocaleString('pt-BR')} un./dia).`,
  );
  parts.push(
    `Estoque disponível: ${availableStock} un.${reservedStock > 0 ? ` (${physicalStock} físico − ${reservedStock} reservado)` : ''}${inTransitQty > 0 ? ` + ${inTransitQty} un. em trânsito` : ''}.`,
  );
  if (coverageDays !== null) {
    parts.push(`Cobertura estimada: ${coverageDays.toLocaleString('pt-BR')} dias.`);
  } else {
    parts.push(
      `Sem vendas na janela de ${periodDays} dias (${totalHistoricalUnitsSold} un. no histórico total).`,
    );
  }
  if (!isPausedOrDiscontinued) {
    parts.push(
      `Ponto de reposição: ${Math.ceil(reorderPoint)} un. (prazo ${leadTimeDays}d${leadTimeIsAssumed ? ' [hipótese padrão]' : ''} + segurança ${safetyStockDays}d${safetyStockIsAssumed ? ' [hipótese padrão]' : ''}).`,
    );
    if (suggestedQty > 0) {
      const roundingNote =
        minLot > 1 || packMultiple > 1
          ? ` (ajustado para lote mín. ${minLot} / múltiplo ${packMultiple})`
          : '';
      parts.push(`Sugestão de compra: ${suggestedQty} ${product.unit || 'UN'}${roundingNote}.`);
    } else {
      parts.push('Estoque atual mais compras em trânsito cobrem o ponto de reposição.');
    }
  } else {
    parts.push(`Produto com status comercial "${commercialStatus}" — reposição automática suspensa.`);
  }

  return {
    productId: product.id,
    productTitle: product.title,
    sku: product.sku || product.ean || '—',
    category: product.category || 'Geral',
    unit: product.unit || 'UN',
    commercialStatus,
    historyState: 'com_vendas',
    periodDays,
    daysWithData,
    periodStartIso: new Date(periodStartMs).toISOString(),
    periodEndIso: new Date(periodEndMs).toISOString(),
    unitsSoldInPeriod,
    unitsSoldPreviousPeriod,
    totalHistoricalUnitsSold,
    revenueInPeriod,
    dailyAvgSales,
    weeklyAvgSales,
    monthlyAvgSales,
    trendPct,
    trendDirection,
    physicalStock,
    reservedStock,
    availableStock,
    inTransitQty,
    minStock,
    coverageDays,
    leadTimeDays,
    leadTimeIsAssumed,
    safetyStockDays,
    safetyStockIsAssumed,
    minLot,
    packMultiple,
    demandDuringLeadTime,
    safetyStockUnits,
    reorderPoint,
    rawSuggestedQty: roundNumber(rawSuggestedQty, 2),
    suggestedQty,
    needsReplenishment,
    urgencyLevel,
    unitCost,
    unitCostSource,
    salePrice,
    estimatedReplenishmentCost,
    preferredSupplierId,
    preferredSupplierName,
    hasExpiredQuote,
    bestQuote,
    explanation: parts.join(' '),
    missingDataWarnings,
  };
}

/**
 * Financial & Sales Scenario Simulator (10, 50, 100 units + planned quantity + custom volumes).
 * Never deducts the full upfront purchase outlay from partial unit sales without separating
 * COGS of sold units vs remaining inventory value at cost.
 */
export function computeFinancialScenarios(input: {
  unitCost: number;
  salePrice: number;
  plannedPurchaseQty: number;
  freightCost?: number;
  taxCost?: number;
  otherCost?: number;
  customVolumes?: number[];
}): FinancialAnalysisResult {
  const unitCost = Math.max(0, roundCurrency(Number(input.unitCost) || 0));
  const salePrice = Math.max(0, roundCurrency(Number(input.salePrice) || 0));
  const plannedPurchaseQty = Math.max(0, Math.floor(Number(input.plannedPurchaseQty) || 0));
  const freightCost = Math.max(0, roundCurrency(Number(input.freightCost) || 0));
  const taxCost = Math.max(0, roundCurrency(Number(input.taxCost) || 0));
  const otherCost = Math.max(0, roundCurrency(Number(input.otherCost) || 0));

  const warnings: string[] = [];
  if (unitCost <= 0) warnings.push('Custo unitário igual a zero: lucro projetado pode estar superestimado.');
  if (salePrice <= 0) warnings.push('Preço de venda igual a zero: não é possível calcular receita nem margem.');
  if (salePrice > 0 && unitCost > salePrice) {
    warnings.push('Alerta crítico: Custo unitário superior ao preço de venda (margem negativa).');
  }

  const unitGrossProfit = roundCurrency(salePrice - unitCost);
  const grossMarginPct =
    salePrice > 0 ? roundCurrency(((salePrice - unitCost) / salePrice) * 100) : null;

  const itemsSubtotalCost = roundCurrency(unitCost * plannedPurchaseQty);
  const totalPurchaseOutlay = roundCurrency(
    itemsSubtotalCost + freightCost + taxCost + otherCost,
  );
  const effectiveUnitCostWithExtras =
    plannedPurchaseQty > 0
      ? roundCurrency(totalPurchaseOutlay / plannedPurchaseQty)
      : unitCost;

  const unitsToRecoverOutlay =
    salePrice > 0 && totalPurchaseOutlay > 0
      ? Math.ceil(totalPurchaseOutlay / salePrice)
      : null;

  const canRecoverOutlayWithinPurchase =
    unitsToRecoverOutlay !== null && unitsToRecoverOutlay <= plannedPurchaseQty;

  const baseVolumes = [10, 50, 100];
  const allVolumes = new Set<number>(baseVolumes);
  if (plannedPurchaseQty > 0) allVolumes.add(plannedPurchaseQty);
  for (const v of input.customVolumes || []) {
    if (Number.isFinite(v) && v > 0) allVolumes.add(Math.floor(v));
  }

  const sortedVolumes = Array.from(allVolumes).sort((a, b) => a - b);

  const scenarios: SalesScenarioRow[] = sortedVolumes.map((q) => {
    const grossRevenue = roundCurrency(salePrice * q);
    const cogsSoldUnits = roundCurrency(unitCost * q);
    const projectedGrossProfit = roundCurrency(grossRevenue - cogsSoldUnits);
    const unsoldUnitsFromPurchase = Math.max(0, plannedPurchaseQty - q);
    const remainingInventoryValueAtCost = roundCurrency(unsoldUnitsFromPurchase * unitCost);
    const netCashFlowAfterSales = roundCurrency(grossRevenue - totalPurchaseOutlay);
    const exceedsPlannedPurchase = plannedPurchaseQty > 0 && q > plannedPurchaseQty;

    const isPlanned = q === plannedPurchaseQty && !baseVolumes.includes(q);
    const isBoth = q === plannedPurchaseQty && baseVolumes.includes(q);

    return {
      quantity: q,
      label: isBoth
        ? `${q} un. (Planejado)`
        : isPlanned
        ? `${q} un. (Lote Planejado)`
        : `${q} unidades`,
      grossRevenue,
      cogsSoldUnits,
      projectedGrossProfit,
      grossMarginPct,
      purchaseOutlay: totalPurchaseOutlay,
      unsoldUnitsFromPurchase,
      remainingInventoryValueAtCost,
      netCashFlowAfterSales,
      exceedsPlannedPurchase,
    };
  });

  return {
    unitCost,
    salePrice,
    plannedPurchaseQty,
    freightCost,
    taxCost,
    otherCost,
    unitGrossProfit,
    grossMarginPct,
    itemsSubtotalCost,
    totalPurchaseOutlay,
    effectiveUnitCostWithExtras,
    unitsToRecoverOutlay,
    canRecoverOutlayWithinPurchase,
    scenarios,
    warnings,
  };
}

/**
 * Computes totals and supplier breakdown for a Purchase List.
 */
export function computePurchaseListSummary(list: {
  items: PurchaseListItem[];
  freightCost?: number;
  taxCost?: number;
  otherCost?: number;
}): {
  estimatedItemsTotal: number;
  estimatedGrandTotal: number;
  effectiveItemsTotal: number;
  effectiveGrandTotal: number;
  projectedTotalRevenue: number;
  projectedGrossProfit: number;
  projectedMarginPct: number | null;
  totalRequestedUnits: number;
  totalReceivedUnits: number;
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    itemCount: number;
    totalUnits: number;
    estimatedSubtotal: number;
  }>;
} {
  const freight = Math.max(0, roundCurrency(Number(list.freightCost) || 0));
  const tax = Math.max(0, roundCurrency(Number(list.taxCost) || 0));
  const other = Math.max(0, roundCurrency(Number(list.otherCost) || 0));

  let estimatedItemsTotal = 0;
  let effectiveItemsTotal = 0;
  let projectedTotalRevenue = 0;
  let totalRequestedUnits = 0;
  let totalReceivedUnits = 0;

  const supplierMap = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      itemCount: number;
      totalUnits: number;
      estimatedSubtotal: number;
    }
  >();

  for (const item of list.items || []) {
    const reqQty = Math.max(0, Number(item.requestedQty) || 0);
    const qCost = Math.max(0, Number(item.quotedUnitCost) || 0);
    const salePrice = Math.max(0, Number(item.currentSalePrice) || 0);
    const sub = roundCurrency(reqQty * qCost);

    estimatedItemsTotal = roundCurrency(estimatedItemsTotal + sub);
    projectedTotalRevenue = roundCurrency(projectedTotalRevenue + reqQty * salePrice);
    totalRequestedUnits += reqQty;

    const execQty =
      item.purchasedQty !== undefined && item.purchasedQty > 0
        ? Number(item.purchasedQty)
        : reqQty;
    const execCost =
      item.effectiveUnitCost !== undefined && item.effectiveUnitCost > 0
        ? Number(item.effectiveUnitCost)
        : qCost;
    effectiveItemsTotal = roundCurrency(effectiveItemsTotal + roundCurrency(execQty * execCost));
    totalReceivedUnits += Math.max(0, Number(item.receivedQty || 0));

    const supKey = item.supplierId || item.supplierName || 'sem_fornecedor';
    const supName = item.supplierName || 'Fornecedor não definido';
    const existing = supplierMap.get(supKey) || {
      supplierId: item.supplierId || '',
      supplierName: supName,
      itemCount: 0,
      totalUnits: 0,
      estimatedSubtotal: 0,
    };
    existing.itemCount += 1;
    existing.totalUnits += reqQty;
    existing.estimatedSubtotal = roundCurrency(existing.estimatedSubtotal + sub);
    supplierMap.set(supKey, existing);
  }

  const estimatedGrandTotal = roundCurrency(estimatedItemsTotal + freight + tax + other);
  const effectiveGrandTotal = roundCurrency(effectiveItemsTotal + freight + tax + other);
  const projectedGrossProfit = roundCurrency(projectedTotalRevenue - estimatedItemsTotal);
  const projectedMarginPct =
    projectedTotalRevenue > 0
      ? roundCurrency((projectedGrossProfit / projectedTotalRevenue) * 100)
      : null;

  return {
    estimatedItemsTotal,
    estimatedGrandTotal,
    effectiveItemsTotal,
    effectiveGrandTotal,
    projectedTotalRevenue,
    projectedGrossProfit,
    projectedMarginPct,
    totalRequestedUnits,
    totalReceivedUnits,
    bySupplier: Array.from(supplierMap.values()).sort(
      (a, b) => b.estimatedSubtotal - a.estimatedSubtotal,
    ),
  };
}

/**
 * Post-approval integrity check:
 * Determines whether an edit to an already-approved Purchase List exceeds the
 * approved limit or alters critical parameters (quantity, supplier, unit cost, total),
 * requiring re-authorization (`aguardando_aprovacao`).
 */
export function evaluatePostApprovalChange(
  previousList: PurchaseListRecord,
  updatedItems: PurchaseListItem[],
  updatedExtras: { freightCost: number; taxCost: number; otherCost: number },
): {
  invalidatesApproval: boolean;
  reasons: string[];
  newGrandTotal: number;
} {
  const summary = computePurchaseListSummary({
    items: updatedItems,
    ...updatedExtras,
  });

  const isApprovedState =
    previousList.status === 'aprovada' || previousList.status === 'em_compra';

  if (!isApprovedState) {
    return {
      invalidatesApproval: false,
      reasons: [],
      newGrandTotal: summary.estimatedGrandTotal,
    };
  }

  const reasons: string[] = [];
  const ceiling =
    previousList.approvedLimitTotal ?? previousList.estimatedGrandTotal;

  if (summary.estimatedGrandTotal > ceiling) {
    reasons.push(
      `O novo total (R$ ${summary.estimatedGrandTotal.toFixed(2)}) ultrapassa o limite aprovado (R$ ${ceiling.toFixed(2)}).`,
    );
  }

  if (updatedItems.length !== previousList.items.length) {
    reasons.push('A quantidade de itens da lista foi alterada após a aprovação.');
  } else {
    const prevByProd = new Map(previousList.items.map((i) => [i.productId, i]));
    for (const item of updatedItems) {
      const prev = prevByProd.get(item.productId);
      if (!prev) {
        reasons.push(`Novo produto adicionado (${item.productTitle}) após aprovação.`);
        continue;
      }
      if (item.requestedQty > prev.requestedQty) {
        reasons.push(
          `Quantidade de "${item.productTitle}" aumentada de ${prev.requestedQty} para ${item.requestedQty}.`,
        );
      }
      if (roundCurrency(item.quotedUnitCost) > roundCurrency(prev.quotedUnitCost)) {
        reasons.push(
          `Custo unitário de "${item.productTitle}" aumentou de R$ ${prev.quotedUnitCost.toFixed(2)} para R$ ${item.quotedUnitCost.toFixed(2)}.`,
        );
      }
      if ((item.supplierId || item.supplierName) !== (prev.supplierId || prev.supplierName)) {
        reasons.push(
          `Fornecedor de "${item.productTitle}" foi alterado de "${prev.supplierName}" para "${item.supplierName}".`,
        );
      }
    }
  }

  return {
    invalidatesApproval: reasons.length > 0,
    reasons,
    newGrandTotal: summary.estimatedGrandTotal,
  };
}

/**
 * Validates receipt progression for a Purchase List and determines the resulting status.
 * Prevents marking a list as 'recebida' when there are pending items unless an explicit
 * justification (`closeShortJustification`) is provided.
 */
export function evaluatePurchaseReceiptStatus(
  items: PurchaseListItem[],
  closeShortJustification?: string | null,
): {
  canMarkFullyReceived: boolean;
  nextStatus: 'em_compra' | 'parcialmente_recebida' | 'recebida';
  pendingItemsCount: number;
  totalTargetUnits: number;
  totalReceivedUnits: number;
  error?: string;
} {
  let pendingItemsCount = 0;
  let totalTargetUnits = 0;
  let totalReceivedUnits = 0;

  for (const item of items) {
    const target =
      item.purchasedQty !== undefined && item.purchasedQty > 0
        ? Number(item.purchasedQty)
        : Number(item.requestedQty || 0);
    const received = Math.max(0, Number(item.receivedQty || 0));
    totalTargetUnits += target;
    totalReceivedUnits += received;
    if (received < target) {
      pendingItemsCount += 1;
    }
  }

  if (totalReceivedUnits <= 0) {
    return {
      canMarkFullyReceived: false,
      nextStatus: 'em_compra',
      pendingItemsCount,
      totalTargetUnits,
      totalReceivedUnits,
    };
  }

  if (pendingItemsCount === 0) {
    return {
      canMarkFullyReceived: true,
      nextStatus: 'recebida',
      pendingItemsCount: 0,
      totalTargetUnits,
      totalReceivedUnits,
    };
  }

  const hasJustification =
    typeof closeShortJustification === 'string' &&
    closeShortJustification.trim().length >= 5;

  if (hasJustification) {
    return {
      canMarkFullyReceived: true,
      nextStatus: 'recebida',
      pendingItemsCount,
      totalTargetUnits,
      totalReceivedUnits,
    };
  }

  return {
    canMarkFullyReceived: false,
    nextStatus: 'parcialmente_recebida',
    pendingItemsCount,
    totalTargetUnits,
    totalReceivedUnits,
    error: `Existem ${pendingItemsCount} item(ns) com quantidade pendente (${totalReceivedUnits}/${totalTargetUnits} recebidos). Registre o recebimento parcial ou informe justificativa para encerrar com saldo pendente.`,
  };
}

/**
 * Role-based permission resolver for Purchasing Assistant operations.
 * Uses the existing CRM permission model (`estoque`, `produtos`, `financeiro`, `pedidos`).
 */
export function resolvePurchasingPermissions(canAny: (perms: string[]) => boolean): {
  canView: boolean;
  canManageCatalogAndSuppliers: boolean;
  canCreateAndSubmitList: boolean;
  canApproveProductOrOffer: boolean;
  canApproveOrReject: boolean;
  canExecuteAndReceive: boolean;
  canManagePartnersAndCustody: boolean;
  canManageOrderPickup: boolean;
} {
  return {
    canView: canAny([
      'estoque:view',
      'produtos:view',
      'financeiro:view',
      'relatorios:view',
      'dashboard:view',
    ]),
    canManageCatalogAndSuppliers: canAny([
      'estoque:create',
      'estoque:edit',
      'produtos:create',
      'produtos:edit',
    ]),
    canCreateAndSubmitList: canAny([
      'estoque:create',
      'estoque:edit',
      'produtos:edit',
      'financeiro:create',
    ]),
    canApproveProductOrOffer: canAny([
      'produtos:approve',
      'produtos:edit',
      'financeiro:approve',
      'estoque:approve',
    ]),
    canApproveOrReject: canAny([
      'financeiro:approve',
      'estoque:approve',
      'pedidos:approve',
    ]),
    canExecuteAndReceive: canAny([
      'estoque:edit',
      'estoque:create',
      'financeiro:edit',
      'pedidos:edit',
    ]),
    canManagePartnersAndCustody: canAny([
      'produtos:edit',
      'estoque:edit',
      'financeiro:edit',
      'financeiro:approve',
    ]),
    canManageOrderPickup: canAny([
      'pedidos:edit',
      'pedidos:approve',
      'estoque:edit',
    ]),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-ORIGIN LIFECYCLE: OWN PRODUCTS, CONSIGNED PARTNER & COURIER PICKUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Operating models / supply channels supported by Mercado Nosso Jeito:
 *  - `mercado_proprio`: Model A — Mercado buys from supplier, owns stock, stores & fulfills from Mercado.
 *  - `parceiro_consignado_mercado`: Model B — Partner owns merchandise, stored under Mercado custody, Mercado fulfills & pays partner per commercial rule.
 *  - `parceiro_retirada_estabelecimento`: Model C — Partner owns & keeps stock at partner's store; courier picks up on order.
 */
export type SupplyOriginChannel =
  | 'mercado_proprio'
  | 'parceiro_consignado_mercado'
  | 'parceiro_retirada_estabelecimento';

export const SUPPLY_ORIGIN_LABELS: Record<SupplyOriginChannel, string> = {
  mercado_proprio: 'A. Produto Próprio (Comprado pelo Mercado)',
  parceiro_consignado_mercado: 'B. Parceiro Consignado (Custódia Física no Mercado)',
  parceiro_retirada_estabelecimento: 'C. Parceiro Externo (Retirada pelo Entregador)',
};

export const SUPPLY_ORIGIN_SHORT_LABELS: Record<SupplyOriginChannel, string> = {
  mercado_proprio: 'Próprio Mercado',
  parceiro_consignado_mercado: 'Consignado no Mercado',
  parceiro_retirada_estabelecimento: 'Retirada no Parceiro',
};

export type StockOwnership = 'mercado' | 'parceiro';
export type StockStorageLocation = 'mercado' | 'estabelecimento_parceiro';

/**
 * Explicit lifecycle for Own Product (`mercado_proprio`), separating Product Approval from Purchase Approval.
 */
export type OwnProductLifecycleStatus =
  | 'rascunho'
  | 'aguardando_aprovacao_produto'
  | 'aprovado_para_compra'
  | 'compra_em_preparacao'
  | 'aguardando_aprovacao_compra'
  | 'aprovado_para_pedido'
  | 'pedido_enviado_fornecedor'
  | 'parcialmente_recebido'
  | 'recebido'
  | 'ativo_em_estoque'
  | 'rejeitado'
  | 'devolvido_para_ajustes'
  | 'cancelado'
  | 'recebimento_com_divergencia';

export const OWN_LIFECYCLE_LABELS: Record<OwnProductLifecycleStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao_produto: 'Aguardando Aprovação do Produto',
  aprovado_para_compra: 'Aprovado para Compra',
  compra_em_preparacao: 'Compra em Preparação',
  aguardando_aprovacao_compra: 'Aguardando Aprovação da Compra',
  aprovado_para_pedido: 'Aprovado para Pedido',
  pedido_enviado_fornecedor: 'Pedido Enviado ao Fornecedor (Em Trânsito)',
  parcialmente_recebido: 'Parcialmente Recebido',
  recebido: 'Recebido Fisicamente',
  ativo_em_estoque: 'Ativo em Estoque Próprio',
  rejeitado: 'Rejeitado',
  devolvido_para_ajustes: 'Devolvido para Ajustes',
  cancelado: 'Cancelado',
  recebimento_com_divergencia: 'Recebimento com Divergência',
};

/**
 * Explicit lifecycle for Partner Product/Offer (`parceiro_consignado_mercado` | `parceiro_retirada_estabelecimento`).
 */
export type PartnerOfferLifecycleStatus =
  | 'rascunho'
  | 'aguardando_aprovacao_parceiro_produto'
  | 'termos_pendentes'
  | 'aprovado'
  | 'disponibilidade_confirmada'
  | 'ativo'
  | 'pausado_indisponivel'
  | 'rejeitado'
  | 'devolvido_para_ajustes'
  | 'cancelado';

export const PARTNER_LIFECYCLE_LABELS: Record<PartnerOfferLifecycleStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao_parceiro_produto: 'Aguardando Aprovação do Parceiro/Oferta',
  termos_pendentes: 'Termos Comerciais Pendentes',
  aprovado: 'Oferta Aprovada (Aguardando Disponibilidade)',
  disponibilidade_confirmada: 'Disponibilidade Confirmada',
  ativo: 'Oferta Ativa para Venda',
  pausado_indisponivel: 'Pausado / Indisponível',
  rejeitado: 'Rejeitado',
  devolvido_para_ajustes: 'Devolvido para Ajustes',
  cancelado: 'Cancelado',
};

/**
 * Configurable commercial rule between Mercado and a Partner Vendor.
 * Never hardcodes a single universal commission percentage.
 */
export type PartnerCommercialRuleType =
  | 'percentual_comissao' // e.g. 18% commission to Mercado -> 82% owed to partner
  | 'valor_fixo_unidade' // fixed R$ per sold unit retained by Mercado
  | 'preco_liquido_parceiro'; // fixed net R$ per unit owed to partner; difference is Mercado's gross commission

export interface PartnerCommercialRule {
  version: number;
  ruleType: PartnerCommercialRuleType;
  /** If `percentual_comissao`, e.g. 15 means 15% for Mercado and 85% for Partner. */
  commissionPct?: number;
  /** If `valor_fixo_unidade`, R$ retained by Mercado per unit sold. */
  fixedFeePerUnit?: number;
  /** If `preco_liquido_parceiro`, net R$ owed to partner per unit sold. */
  partnerNetUnitAmount?: number;
  /** Known attributable variable costs per unit (pickup, packaging, payment fee) if applicable. */
  pickupFeePerOrder?: number;
  deliveryCostPerUnit?: number;
  packagingCostPerUnit?: number;
  paymentFeePct?: number;
  validFrom: string;
  validUntil?: string | null;
  approvedByUid?: string;
  approvedByName?: string;
  approvedAt?: string;
  /** Legal/fiscal policy note — never improvised without explicit business decision. */
  fiscalResponsibilityPolicy: 'definicao_pendente' | 'parceiro_emite_nf' | 'mercado_intermediador';
  notes?: string;
}

/**
 * Controlled preparation for future public partner profile (Section 12).
 * `published` is strictly `false` by default and never exposed publicly without moderation.
 */
export interface PartnerPublicProfilePrep {
  published: boolean;
  moderationStatus: 'rascunho' | 'aprovado_interno' | 'oculto';
  publicName: string;
  slug: string;
  logoUrl?: string;
  shortDescription?: string;
  categories: string[];
  serviceRegion?: string;
  operatingHours?: string;
}

/**
 * Partner Vendor entity (`parceiros`), distinct from `SupplierRecord` (`fornecedores`).
 * A partner sells through Mercado via consignment (`parceiro_consignado_mercado`) or courier pickup (`parceiro_retirada_estabelecimento`).
 */
export interface PartnerVendorRecord {
  id: string;
  name: string;
  tradeName: string;
  document?: string;
  contactName: string;
  phone: string;
  email: string;
  pixKey: string;
  address: string;
  pickupInstructions: string;
  estimatedPrepMinutes: number;
  /** Maximum hours before partner-reported availability expires if not reconfirmed. */
  availabilityTtlHours: number;
  defaultChannel: 'parceiro_consignado_mercado' | 'parceiro_retirada_estabelecimento';
  status: 'active' | 'pending_terms' | 'suspended' | 'inactive';
  /** Optional link if this partner also acts as a wholesale supplier to Mercado. */
  linkedSupplierId?: string | null;
  currentCommercialRule: PartnerCommercialRule;
  commercialRuleHistory: PartnerCommercialRule[];
  publicProfile: PartnerPublicProfilePrep;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Offer / Channel Listing (`product_offers`) linking a master catalog product (`productId`)
 * to a specific supply origin, ownership, partner/supplier, custody or external availability,
 * and lifecycle state. A single catalog product can have multiple offers simultaneously.
 */
export interface ProductOfferRecord {
  id: string;
  productId: string;
  productTitle: string;
  sku?: string;
  ean?: string;
  category: string;
  unit: string;
  image?: string;
  originChannel: SupplyOriginChannel;
  ownership: StockOwnership;
  storageLocation: StockStorageLocation;
  /** Lifecycle status for `mercado_proprio` offers. */
  ownLifecycleStatus?: OwnProductLifecycleStatus;
  /** Lifecycle status for partner offers (`parceiro_consignado_mercado` | `parceiro_retirada_estabelecimento`). */
  partnerLifecycleStatus?: PartnerOfferLifecycleStatus;
  // Supplier reference (for `mercado_proprio`)
  supplierId?: string;
  supplierName?: string;
  unitAcquisitionCost?: number;
  plannedPurchaseQty?: number;
  linkedPurchaseListId?: string | null;
  // Partner reference (for partner channels)
  partnerId?: string;
  partnerName?: string;
  commercialRule?: PartnerCommercialRule;
  // Pricing
  salePrice: number;
  // Custody balance (only for `parceiro_consignado_mercado` — NEVER added to Mercado's own stock)
  custodyLocation?: string;
  custodianName?: string;
  consignedPhysicalQty: number;
  consignedReservedQty: number;
  consignedAvailableQty: number;
  consignedDamagedOrLostQty: number;
  // External availability (only for `parceiro_retirada_estabelecimento` — NEVER added to Mercado's own stock)
  partnerReportedAvailableQty: number;
  availabilityConfirmedAt?: string | null;
  availabilityExpiresAt?: string | null;
  pickupAddress?: string;
  pickupInstructions?: string;
  estimatedPrepMinutes?: number;
  // Governance & Approvals
  inclusionJustification: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvalComment?: string | null;
  rejectedReason?: string | null;
  auditTrail: PurchaseAuditEntry[];
}

/**
 * Audited movement in Partner Consigned Custody (`custody_movements`).
 * Records physical custody changes at Mercado for goods owned by a Partner.
 */
export type CustodyMovementType =
  | 'recebimento_consignacao'
  | 'reserva_pedido'
  | 'baixa_venda_consignada'
  | 'devolucao_ao_parceiro'
  | 'perda_ou_avaria'
  | 'ajuste_conferencia';

export interface CustodyMovementRecord {
  id: string;
  offerId: string;
  productId: string;
  productTitle: string;
  partnerId: string;
  partnerName: string;
  movementType: CustodyMovementType;
  deltaQty: number; // positive for entry, negative for sale/return/loss
  previousQty: number;
  newQty: number;
  custodyLocation: string;
  custodianName: string;
  orderId?: string | null;
  notes: string;
  timestamp: string;
  actorUid: string;
  actorName: string;
}

/**
 * Courier pickup & fulfillment tracking for partner items in customer orders (`order_fulfillment_tasks`).
 */
export type CourierPickupStatus =
  | 'aguardando_confirmacao_parceiro'
  | 'aguardando_coleta'
  | 'coletado_no_parceiro'
  | 'entregue_ao_cliente'
  | 'divergencia_coleta'
  | 'cancelado';

export const COURIER_PICKUP_STATUS_LABELS: Record<CourierPickupStatus, string> = {
  aguardando_confirmacao_parceiro: 'Aguardando Confirmação do Parceiro',
  aguardando_coleta: 'Pronto p/ Coleta no Parceiro',
  coletado_no_parceiro: 'Coletado pelo Entregador',
  entregue_ao_cliente: 'Entregue ao Cliente',
  divergencia_coleta: 'Divergência / Falta na Coleta',
  cancelado: 'Coleta Cancelada',
};

export interface OrderPickupTaskRecord {
  id: string;
  orderId: string;
  orderNumber?: string;
  productId: string;
  productTitle: string;
  quantity: number;
  originChannel: SupplyOriginChannel;
  ownership: StockOwnership;
  partnerId?: string;
  partnerName?: string;
  pickupAddress?: string;
  pickupInstructions?: string;
  assignedCourierName?: string | null;
  pickupStatus: CourierPickupStatus;
  divergenceNote?: string | null;
  updatedAt: string;
  updatedByName?: string;
  timeline: Array<{
    timestamp: string;
    status: CourierPickupStatus;
    actorName: string;
    note?: string;
  }>;
}

/**
 * Partner Financial Settlement / Repasse record (`partner_settlements`).
 */
export type PartnerSettlementStatus =
  | 'previsto'
  | 'pendente_conferencia'
  | 'autorizado_repasse'
  | 'liquidado'
  | 'contestacao';

export interface PartnerSettlementRecord {
  id: string;
  partnerId: string;
  partnerName: string;
  orderId: string;
  orderNumber?: string;
  productId: string;
  productTitle: string;
  originChannel: 'parceiro_consignado_mercado' | 'parceiro_retirada_estabelecimento';
  unitsSold: number;
  customerUnitPrice: number;
  grossCustomerAmount: number;
  partnerAmountDue: number;
  mercadoGrossCommission: number;
  attributableCosts: number;
  mercadoNetContribution: number;
  status: PartnerSettlementStatus;
  paymentReference?: string | null;
  settledAt?: string | null;
  settledByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 1. Anti-duplication check when onboarding a new product in the Assistente de Compras.
 * Matches by exact normalized SKU, exact EAN/barcode, or normalized Title + Unit.
 */
export function normalizeCatalogToken(val?: string | null): string {
  if (!val) return '';
  return val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export interface DuplicateCheckResult {
  hasExactDuplicate: boolean;
  hasSimilarMatch: boolean;
  matches: Array<{
    product: CatalogProductLike;
    reason: 'sku_exato' | 'ean_exato' | 'nome_unidade_exato' | 'nome_similar';
    reasonLabel: string;
  }>;
}

export function findPotentialDuplicateProducts(
  candidate: {
    title: string;
    sku?: string;
    ean?: string;
    unit?: string;
  },
  catalog: CatalogProductLike[],
): DuplicateCheckResult {
  const normTitle = normalizeCatalogToken(candidate.title);
  const normSku = normalizeCatalogToken(candidate.sku);
  const normEan = normalizeCatalogToken(candidate.ean);
  const normUnit = normalizeCatalogToken(candidate.unit || 'UN');

  const matches: DuplicateCheckResult['matches'] = [];

  for (const prod of catalog) {
    const pSku = normalizeCatalogToken(prod.sku);
    const pEan = normalizeCatalogToken(prod.ean);
    const pTitle = normalizeCatalogToken(prod.title);
    const pUnit = normalizeCatalogToken(prod.unit || 'UN');

    if (normSku && pSku && normSku === pSku) {
      matches.push({
        product: prod,
        reason: 'sku_exato',
        reasonLabel: `SKU idêntico (${prod.sku})`,
      });
      continue;
    }
    if (normEan && pEan && normEan === pEan) {
      matches.push({
        product: prod,
        reason: 'ean_exato',
        reasonLabel: `Código de barras / EAN idêntico (${prod.ean})`,
      });
      continue;
    }
    if (normTitle && pTitle && normTitle === pTitle && normUnit === pUnit) {
      matches.push({
        product: prod,
        reason: 'nome_unidade_exato',
        reasonLabel: `Mesmo nome e unidade (${prod.title} • ${prod.unit || 'UN'})`,
      });
      continue;
    }
    if (
      normTitle.length >= 4 &&
      pTitle.length >= 4 &&
      (pTitle.includes(normTitle) || normTitle.includes(pTitle))
    ) {
      matches.push({
        product: prod,
        reason: 'nome_similar',
        reasonLabel: `Nome semelhante no catálogo (${prod.title})`,
      });
    }
  }

  const hasExactDuplicate = matches.some(
    (m) =>
      m.reason === 'sku_exato' ||
      m.reason === 'ean_exato' ||
      m.reason === 'nome_unidade_exato',
  );

  return {
    hasExactDuplicate,
    hasSimilarMatch: matches.length > 0,
    matches,
  };
}

/**
 * 2. Partner Commercial Rule Unit Breakdown:
 * Given customer sale price and a PartnerCommercialRule, computes:
 * - amount owed to partner per unit (`partnerUnitRepasse`)
 * - Mercado gross commission per unit (`mercadoUnitGrossCommission`)
 * - known attributable variable costs per unit (`attributableUnitCost`)
 * - Mercado estimated net contribution per unit (`mercadoUnitContribution`)
 */
export function computePartnerUnitSplit(
  salePrice: number,
  rule: PartnerCommercialRule,
): {
  salePrice: number;
  partnerUnitRepasse: number;
  mercadoUnitGrossCommission: number;
  commissionEffectivePct: number | null;
  attributableUnitCost: number;
  mercadoUnitContribution: number;
  warnings: string[];
} {
  const safePrice = Math.max(0, roundCurrency(Number(salePrice) || 0));
  const warnings: string[] = [];

  let partnerUnitRepasse = 0;
  let mercadoUnitGrossCommission = 0;

  if (rule.ruleType === 'percentual_comissao') {
    const pct = Math.min(100, Math.max(0, Number(rule.commissionPct) || 0));
    mercadoUnitGrossCommission = roundCurrency((safePrice * pct) / 100);
    partnerUnitRepasse = roundCurrency(safePrice - mercadoUnitGrossCommission);
  } else if (rule.ruleType === 'valor_fixo_unidade') {
    const fixedFee = Math.max(0, roundCurrency(Number(rule.fixedFeePerUnit) || 0));
    mercadoUnitGrossCommission = Math.min(safePrice, fixedFee);
    partnerUnitRepasse = roundCurrency(safePrice - mercadoUnitGrossCommission);
    if (fixedFee > safePrice && safePrice > 0) {
      warnings.push('Taxa fixa do Mercado supera o preço de venda ao cliente.');
    }
  } else {
    // preco_liquido_parceiro
    const netPartner = Math.max(0, roundCurrency(Number(rule.partnerNetUnitAmount) || 0));
    partnerUnitRepasse = netPartner;
    mercadoUnitGrossCommission = roundCurrency(safePrice - netPartner);
    if (netPartner > safePrice && safePrice > 0) {
      warnings.push(
        'Alerta crítico: Valor líquido devido ao parceiro é maior que o preço de venda ao cliente (comissão negativa).',
      );
    }
  }

  const deliveryCost = Math.max(0, roundCurrency(Number(rule.deliveryCostPerUnit) || 0));
  const packagingCost = Math.max(0, roundCurrency(Number(rule.packagingCostPerUnit) || 0));
  const paymentFeePct = Math.max(0, Number(rule.paymentFeePct) || 0);
  const paymentFeeUnit = roundCurrency((safePrice * paymentFeePct) / 100);

  const attributableUnitCost = roundCurrency(deliveryCost + packagingCost + paymentFeeUnit);
  const mercadoUnitContribution = roundCurrency(
    mercadoUnitGrossCommission - attributableUnitCost,
  );

  if (mercadoUnitContribution < 0 && safePrice > 0) {
    warnings.push(
      'Contribuição estimada do Mercado é negativa após deduzir custos atribuíveis (coleta/entrega/taxa).',
    );
  }

  const commissionEffectivePct =
    safePrice > 0 ? roundCurrency((mercadoUnitGrossCommission / safePrice) * 100) : null;

  return {
    salePrice: safePrice,
    partnerUnitRepasse,
    mercadoUnitGrossCommission,
    commissionEffectivePct,
    attributableUnitCost,
    mercadoUnitContribution,
    warnings,
  };
}

/**
 * 3. Partner Financial Scenarios (10, 50, 100 units + planned volume).
 * Explicitly separates customer gross amount, partner payout (`repasseDevidoParceiro`),
 * Mercado gross commission, attributable costs, and Mercado net contribution.
 * Purchase outlay by Mercado is strictly R$ 0,00 because partner owns the inventory.
 */
export interface PartnerScenarioRow {
  quantity: number;
  label: string;
  customerGrossRevenue: number;
  partnerRepasseTotal: number;
  mercadoGrossCommissionTotal: number;
  attributableCostsTotal: number;
  mercadoEstimatedContribution: number;
  mercadoContributionPct: number | null;
  /** Always 0 for partner products — Mercado does not purchase consigned/partner stock. */
  mercadoPurchaseOutlay: 0;
}

export function computePartnerFinancialScenarios(input: {
  salePrice: number;
  rule: PartnerCommercialRule;
  plannedAvailableQty: number;
  customVolumes?: number[];
}): {
  salePrice: number;
  plannedAvailableQty: number;
  unitSplit: ReturnType<typeof computePartnerUnitSplit>;
  scenarios: PartnerScenarioRow[];
  warnings: string[];
} {
  const unitSplit = computePartnerUnitSplit(input.salePrice, input.rule);
  const plannedQty = Math.max(0, Math.floor(Number(input.plannedAvailableQty) || 0));
  const pickupFixedPerOrder = Math.max(
    0,
    roundCurrency(Number(input.rule.pickupFeePerOrder) || 0),
  );

  const baseVolumes = [10, 50, 100];
  const allVolumes = new Set<number>(baseVolumes);
  if (plannedQty > 0) allVolumes.add(plannedQty);
  for (const v of input.customVolumes || []) {
    if (Number.isFinite(v) && v > 0) allVolumes.add(Math.floor(v));
  }

  const sortedVolumes = Array.from(allVolumes).sort((a, b) => a - b);

  const scenarios: PartnerScenarioRow[] = sortedVolumes.map((q) => {
    const customerGrossRevenue = roundCurrency(unitSplit.salePrice * q);
    const partnerRepasseTotal = roundCurrency(unitSplit.partnerUnitRepasse * q);
    const mercadoGrossCommissionTotal = roundCurrency(
      unitSplit.mercadoUnitGrossCommission * q,
    );
    const attributableCostsTotal = roundCurrency(
      unitSplit.attributableUnitCost * q + pickupFixedPerOrder,
    );
    const mercadoEstimatedContribution = roundCurrency(
      mercadoGrossCommissionTotal - attributableCostsTotal,
    );
    const mercadoContributionPct =
      customerGrossRevenue > 0
        ? roundCurrency((mercadoEstimatedContribution / customerGrossRevenue) * 100)
        : null;

    const isPlanned = q === plannedQty;

    return {
      quantity: q,
      label: isPlanned ? `${q} un. (Disponibilidade)` : `${q} unidades`,
      customerGrossRevenue,
      partnerRepasseTotal,
      mercadoGrossCommissionTotal,
      attributableCostsTotal,
      mercadoEstimatedContribution,
      mercadoContributionPct,
      mercadoPurchaseOutlay: 0,
    };
  });

  return {
    salePrice: unitSplit.salePrice,
    plannedAvailableQty: plannedQty,
    unitSplit,
    scenarios,
    warnings: unitSplit.warnings,
  };
}

/**
 * 4. Checks whether a partner offer's availability has expired or is valid.
 * Partner pickup offers (`parceiro_retirada_estabelecimento`) automatically become
 * unavailable for sale if `availabilityExpiresAt` is in the past or missing.
 */
export function isPartnerOfferAvailabilityExpired(
  offer: Pick<
    ProductOfferRecord,
    | 'originChannel'
    | 'partnerReportedAvailableQty'
    | 'availabilityConfirmedAt'
    | 'availabilityExpiresAt'
    | 'consignedAvailableQty'
  >,
  now: Date = new Date(),
): {
  isExpired: boolean;
  isSellableQtyPositive: boolean;
  effectiveAvailableQty: number;
  reason?: string;
} {
  if (offer.originChannel === 'parceiro_consignado_mercado') {
    const qty = Math.max(0, Math.floor(Number(offer.consignedAvailableQty) || 0));
    return {
      isExpired: false,
      isSellableQtyPositive: qty > 0,
      effectiveAvailableQty: qty,
      reason: qty <= 0 ? 'Sem saldo físico em custódia consignada no Mercado.' : undefined,
    };
  }

  if (offer.originChannel === 'parceiro_retirada_estabelecimento') {
    const qty = Math.max(0, Math.floor(Number(offer.partnerReportedAvailableQty) || 0));
    if (!offer.availabilityConfirmedAt || !offer.availabilityExpiresAt) {
      return {
        isExpired: true,
        isSellableQtyPositive: false,
        effectiveAvailableQty: 0,
        reason: 'Disponibilidade no estabelecimento parceiro ainda não foi confirmada.',
      };
    }
    const expMs = new Date(offer.availabilityExpiresAt).getTime();
    if (!Number.isFinite(expMs) || expMs <= now.getTime()) {
      return {
        isExpired: true,
        isSellableQtyPositive: false,
        effectiveAvailableQty: 0,
        reason: `Disponibilidade informada pelo parceiro expirou em ${new Date(expMs).toLocaleString('pt-BR')}.`,
      };
    }
    return {
      isExpired: false,
      isSellableQtyPositive: qty > 0,
      effectiveAvailableQty: qty,
      reason: qty <= 0 ? 'Parceiro informou disponibilidade zero no momento.' : undefined,
    };
  }

  return {
    isExpired: false,
    isSellableQtyPositive: true,
    effectiveAvailableQty: 0,
  };
}

/**
 * 5. Post-approval revalidation for Product Offers (`ProductOfferRecord`).
 * Any change to salePrice, acquisitionCost, partnerId, supplierId, originChannel, or
 * commercialRule after an offer was approved requires re-authorization.
 */
export function evaluatePostApprovalOfferChange(
  previousOffer: ProductOfferRecord,
  updatedFields: Partial<ProductOfferRecord>,
): {
  invalidatesApproval: boolean;
  reasons: string[];
} {
  const wasApprovedOwn =
    previousOffer.originChannel === 'mercado_proprio' &&
    previousOffer.ownLifecycleStatus &&
    [
      'aprovado_para_compra',
      'compra_em_preparacao',
      'aguardando_aprovacao_compra',
      'aprovado_para_pedido',
      'pedido_enviado_fornecedor',
      'parcialmente_recebido',
      'recebido',
      'ativo_em_estoque',
    ].includes(previousOffer.ownLifecycleStatus);

  const wasApprovedPartner =
    previousOffer.originChannel !== 'mercado_proprio' &&
    previousOffer.partnerLifecycleStatus &&
    ['aprovado', 'disponibilidade_confirmada', 'ativo'].includes(
      previousOffer.partnerLifecycleStatus,
    );

  if (!wasApprovedOwn && !wasApprovedPartner) {
    return { invalidatesApproval: false, reasons: [] };
  }

  const reasons: string[] = [];

  if (
    updatedFields.originChannel &&
    updatedFields.originChannel !== previousOffer.originChannel
  ) {
    reasons.push(
      `Origem/canal alterado de "${SUPPLY_ORIGIN_SHORT_LABELS[previousOffer.originChannel]}" para "${SUPPLY_ORIGIN_SHORT_LABELS[updatedFields.originChannel]}".`,
    );
  }

  if (
    updatedFields.salePrice !== undefined &&
    roundCurrency(updatedFields.salePrice) !== roundCurrency(previousOffer.salePrice)
  ) {
    reasons.push(
      `Preço de venda alterado de R$ ${previousOffer.salePrice.toFixed(2)} para R$ ${roundCurrency(updatedFields.salePrice).toFixed(2)}.`,
    );
  }

  if (
    updatedFields.unitAcquisitionCost !== undefined &&
    roundCurrency(updatedFields.unitAcquisitionCost) >
      roundCurrency(previousOffer.unitAcquisitionCost || 0)
  ) {
    reasons.push(
      `Custo de aquisição aumentou de R$ ${(previousOffer.unitAcquisitionCost || 0).toFixed(2)} para R$ ${roundCurrency(updatedFields.unitAcquisitionCost).toFixed(2)}.`,
    );
  }

  if (
    updatedFields.partnerId !== undefined &&
    updatedFields.partnerId !== previousOffer.partnerId
  ) {
    reasons.push('Parceiro vendedor vinculado à oferta foi alterado.');
  }

  if (
    updatedFields.supplierId !== undefined &&
    updatedFields.supplierId !== previousOffer.supplierId
  ) {
    reasons.push('Fornecedor vinculado ao produto foi alterado.');
  }

  if (updatedFields.commercialRule && previousOffer.commercialRule) {
    const prevRule = previousOffer.commercialRule;
    const nextRule = updatedFields.commercialRule;
    if (
      prevRule.ruleType !== nextRule.ruleType ||
      prevRule.commissionPct !== nextRule.commissionPct ||
      prevRule.fixedFeePerUnit !== nextRule.fixedFeePerUnit ||
      prevRule.partnerNetUnitAmount !== nextRule.partnerNetUnitAmount
    ) {
      reasons.push('Regra comercial de comissão/repasse do parceiro foi modificada.');
    }
  }

  return {
    invalidatesApproval: reasons.length > 0,
    reasons,
  };
}

/**
 * 6. Pure calculation for Partner Consigned Custody movements (`parceiro_consignado_mercado`).
 * Prevents negative custody balances and never modifies Mercado's own stock.
 */
export function applyCustodyMovementToOffer(
  offer: ProductOfferRecord,
  movementType: CustodyMovementType,
  quantity: number,
): {
  consignedPhysicalQty: number;
  consignedReservedQty: number;
  consignedAvailableQty: number;
  consignedDamagedOrLostQty: number;
  signedDelta: number;
} {
  if (offer.originChannel !== 'parceiro_consignado_mercado') {
    throw new Error(
      'Movimentação de custódia consignada só é permitida para ofertas do canal "parceiro_consignado_mercado".',
    );
  }
  const absQty = Math.max(1, Math.floor(Math.abs(Number(quantity) || 0)));
  let physical = Math.max(0, Math.floor(Number(offer.consignedPhysicalQty) || 0));
  let reserved = Math.max(0, Math.floor(Number(offer.consignedReservedQty) || 0));
  let damaged = Math.max(0, Math.floor(Number(offer.consignedDamagedOrLostQty) || 0));
  let signedDelta = 0;

  if (movementType === 'recebimento_consignacao') {
    physical += absQty;
    signedDelta = absQty;
  } else if (movementType === 'reserva_pedido') {
    if (physical - reserved < absQty) {
      throw new Error(
        `Saldo disponível em custódia insuficiente (${physical - reserved} un.) para reservar ${absQty} un.`,
      );
    }
    reserved += absQty;
    signedDelta = 0;
  } else if (movementType === 'baixa_venda_consignada') {
    if (physical < absQty) {
      throw new Error(
        `Saldo físico em custódia insuficiente (${physical} un.) para baixar venda de ${absQty} un.`,
      );
    }
    physical -= absQty;
    reserved = Math.max(0, reserved - absQty);
    signedDelta = -absQty;
  } else if (movementType === 'devolucao_ao_parceiro') {
    if (physical - reserved < absQty) {
      throw new Error(
        `Saldo livre em custódia insuficiente (${physical - reserved} un.) para devolver ${absQty} un. ao parceiro.`,
      );
    }
    physical -= absQty;
    signedDelta = -absQty;
  } else if (movementType === 'perda_ou_avaria') {
    if (physical < absQty) {
      throw new Error(
        `Saldo físico em custódia insuficiente (${physical} un.) para registrar avaria de ${absQty} un.`,
      );
    }
    physical -= absQty;
    damaged += absQty;
    signedDelta = -absQty;
  } else if (movementType === 'ajuste_conferencia') {
    signedDelta = Number(quantity) >= 0 ? absQty : -absQty;
    if (physical + signedDelta < 0) {
      throw new Error('Ajuste de conferência não pode resultar em custódia física negativa.');
    }
    physical += signedDelta;
  }

  const available = Math.max(0, physical - reserved);
  return {
    consignedPhysicalQty: physical,
    consignedReservedQty: reserved,
    consignedAvailableQty: available,
    consignedDamagedOrLostQty: damaged,
    signedDelta,
  };
}

/**
 * 7. Financial Settlement & Revenue Separation Report (Section 10).
 * Ensures partner share (`partnerAmountDue`) is NEVER counted as Mercado's own revenue or profit.
 */
export function computeFinancialSeparationReport(input: {
  orders: OrderLike[];
  products: CatalogProductLike[];
  offers: ProductOfferRecord[];
  settlements: PartnerSettlementRecord[];
}): {
  ownProductsGrossRevenue: number;
  ownProductsEstimatedCogs: number;
  ownProductsGrossProfit: number;
  partnerSalesCustomerTotal: number;
  partnerRepasseTotalDue: number;
  partnerRepassePrevisto: number;
  partnerRepassePendenteConferencia: number;
  partnerRepasseAutorizado: number;
  partnerRepasseLiquidado: number;
  mercadoPartnerGrossCommission: number;
  mercadoPartnerAttributableCosts: number;
  mercadoPartnerNetContribution: number;
  /** True revenue belonging to Mercado = Own Product Revenue + Mercado's Commission on Partner Sales. */
  mercadoTrueRecognizedRevenue: number;
  /** Total GMV paid by customers across all channels (Own + Partner). */
  totalCustomerGmv: number;
  byPartner: Array<{
    partnerId: string;
    partnerName: string;
    unitsSold: number;
    customerGmv: number;
    partnerDue: number;
    mercadoCommission: number;
    mercadoContribution: number;
    liquidadoAmount: number;
    pendenteAmount: number;
  }>;
} {
  const offerByProduct = new Map<string, ProductOfferRecord>();
  for (const off of input.offers) {
    if (off.originChannel !== 'mercado_proprio') {
      offerByProduct.set(off.productId, off);
    }
  }
  const prodById = new Map<string, CatalogProductLike>(
    input.products.map((p) => [p.id, p]),
  );

  let ownProductsGrossRevenue = 0;
  let ownProductsEstimatedCogs = 0;
  let partnerSalesCustomerTotal = 0;
  let partnerRepasseTotalDue = 0;
  let mercadoPartnerGrossCommission = 0;
  let mercadoPartnerAttributableCosts = 0;
  let mercadoPartnerNetContribution = 0;

  const partnerMap = new Map<
    string,
    {
      partnerId: string;
      partnerName: string;
      unitsSold: number;
      customerGmv: number;
      partnerDue: number;
      mercadoCommission: number;
      mercadoContribution: number;
      liquidadoAmount: number;
      pendenteAmount: number;
    }
  >();

  // First process explicit partner settlements if recorded
  const settledOrderProdKeys = new Set<string>();
  let partnerRepassePrevisto = 0;
  let partnerRepassePendenteConferencia = 0;
  let partnerRepasseAutorizado = 0;
  let partnerRepasseLiquidado = 0;

  for (const st of input.settlements) {
    settledOrderProdKeys.add(`${st.orderId}::${st.productId}`);
    partnerSalesCustomerTotal = roundCurrency(
      partnerSalesCustomerTotal + st.grossCustomerAmount,
    );
    partnerRepasseTotalDue = roundCurrency(partnerRepasseTotalDue + st.partnerAmountDue);
    mercadoPartnerGrossCommission = roundCurrency(
      mercadoPartnerGrossCommission + st.mercadoGrossCommission,
    );
    mercadoPartnerAttributableCosts = roundCurrency(
      mercadoPartnerAttributableCosts + st.attributableCosts,
    );
    mercadoPartnerNetContribution = roundCurrency(
      mercadoPartnerNetContribution + st.mercadoNetContribution,
    );

    if (st.status === 'previsto') {
      partnerRepassePrevisto = roundCurrency(partnerRepassePrevisto + st.partnerAmountDue);
    } else if (st.status === 'pendente_conferencia' || st.status === 'contestacao') {
      partnerRepassePendenteConferencia = roundCurrency(
        partnerRepassePendenteConferencia + st.partnerAmountDue,
      );
    } else if (st.status === 'autorizado_repasse') {
      partnerRepasseAutorizado = roundCurrency(
        partnerRepasseAutorizado + st.partnerAmountDue,
      );
    } else if (st.status === 'liquidado') {
      partnerRepasseLiquidado = roundCurrency(
        partnerRepasseLiquidado + st.partnerAmountDue,
      );
    }

    const pEntry = partnerMap.get(st.partnerId) || {
      partnerId: st.partnerId,
      partnerName: st.partnerName,
      unitsSold: 0,
      customerGmv: 0,
      partnerDue: 0,
      mercadoCommission: 0,
      mercadoContribution: 0,
      liquidadoAmount: 0,
      pendenteAmount: 0,
    };
    pEntry.unitsSold += st.unitsSold;
    pEntry.customerGmv = roundCurrency(pEntry.customerGmv + st.grossCustomerAmount);
    pEntry.partnerDue = roundCurrency(pEntry.partnerDue + st.partnerAmountDue);
    pEntry.mercadoCommission = roundCurrency(
      pEntry.mercadoCommission + st.mercadoGrossCommission,
    );
    pEntry.mercadoContribution = roundCurrency(
      pEntry.mercadoContribution + st.mercadoNetContribution,
    );
    if (st.status === 'liquidado') {
      pEntry.liquidadoAmount = roundCurrency(pEntry.liquidadoAmount + st.partnerAmountDue);
    } else {
      pEntry.pendenteAmount = roundCurrency(pEntry.pendenteAmount + st.partnerAmountDue);
    }
    partnerMap.set(st.partnerId, pEntry);
  }

  // Next process recognized orders for own products and any partner items not yet in settlements
  for (const order of input.orders) {
    if (!isRecognizedSale(order)) continue;
    for (const item of order.items || []) {
      const pid = item.id || item.productId || '';
      const qty = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Math.max(0, Number(item.price) || 0);
      const itemTotal = roundCurrency(qty * unitPrice);
      if (qty <= 0) continue;

      const partnerOffer = pid ? offerByProduct.get(pid) : undefined;
      if (partnerOffer && partnerOffer.commercialRule) {
        if (settledOrderProdKeys.has(`${order.id}::${pid}`)) continue;
        const split = computePartnerUnitSplit(unitPrice, partnerOffer.commercialRule);
        const pDue = roundCurrency(split.partnerUnitRepasse * qty);
        const mComm = roundCurrency(split.mercadoUnitGrossCommission * qty);
        const mCost = roundCurrency(split.attributableUnitCost * qty);
        const mContrib = roundCurrency(mComm - mCost);

        partnerSalesCustomerTotal = roundCurrency(partnerSalesCustomerTotal + itemTotal);
        partnerRepasseTotalDue = roundCurrency(partnerRepasseTotalDue + pDue);
        partnerRepassePrevisto = roundCurrency(partnerRepassePrevisto + pDue);
        mercadoPartnerGrossCommission = roundCurrency(
          mercadoPartnerGrossCommission + mComm,
        );
        mercadoPartnerAttributableCosts = roundCurrency(
          mercadoPartnerAttributableCosts + mCost,
        );
        mercadoPartnerNetContribution = roundCurrency(
          mercadoPartnerNetContribution + mContrib,
        );

        const partnerId = partnerOffer.partnerId || 'parceiro_nao_id';
        const partnerName = partnerOffer.partnerName || 'Parceiro Comercial';
        const pEntry = partnerMap.get(partnerId) || {
          partnerId,
          partnerName,
          unitsSold: 0,
          customerGmv: 0,
          partnerDue: 0,
          mercadoCommission: 0,
          mercadoContribution: 0,
          liquidadoAmount: 0,
          pendenteAmount: 0,
        };
        pEntry.unitsSold += qty;
        pEntry.customerGmv = roundCurrency(pEntry.customerGmv + itemTotal);
        pEntry.partnerDue = roundCurrency(pEntry.partnerDue + pDue);
        pEntry.mercadoCommission = roundCurrency(pEntry.mercadoCommission + mComm);
        pEntry.mercadoContribution = roundCurrency(pEntry.mercadoContribution + mContrib);
        pEntry.pendenteAmount = roundCurrency(pEntry.pendenteAmount + pDue);
        partnerMap.set(partnerId, pEntry);
      } else {
        // Own product (`mercado_proprio`)
        ownProductsGrossRevenue = roundCurrency(ownProductsGrossRevenue + itemTotal);
        const catalogProd = pid ? prodById.get(pid) : undefined;
        const unitCost = Math.max(0, Number(catalogProd?.costPrice) || 0);
        ownProductsEstimatedCogs = roundCurrency(
          ownProductsEstimatedCogs + roundCurrency(unitCost * qty),
        );
      }
    }
  }

  const ownProductsGrossProfit = roundCurrency(
    ownProductsGrossRevenue - ownProductsEstimatedCogs,
  );
  const mercadoTrueRecognizedRevenue = roundCurrency(
    ownProductsGrossRevenue + mercadoPartnerGrossCommission,
  );
  const totalCustomerGmv = roundCurrency(
    ownProductsGrossRevenue + partnerSalesCustomerTotal,
  );

  return {
    ownProductsGrossRevenue,
    ownProductsEstimatedCogs,
    ownProductsGrossProfit,
    partnerSalesCustomerTotal,
    partnerRepasseTotalDue,
    partnerRepassePrevisto,
    partnerRepassePendenteConferencia,
    partnerRepasseAutorizado,
    partnerRepasseLiquidado,
    mercadoPartnerGrossCommission,
    mercadoPartnerAttributableCosts,
    mercadoPartnerNetContribution,
    mercadoTrueRecognizedRevenue,
    totalCustomerGmv,
    byPartner: Array.from(partnerMap.values()).sort(
      (a, b) => b.customerGmv - a.customerGmv,
    ),
  };
}

/**
 * 8. Order Item Fulfillment Source Resolver (Section 11).
 * Identifies for every item in an order whether it is fulfilled from:
 *  - Mercado's own stock (`mercado_proprio`)
 *  - Partner's consigned custody at Mercado (`parceiro_consignado_mercado`)
 *  - Courier pickup at Partner's establishment (`parceiro_retirada_estabelecimento`)
 * And flags multi-partner pickup complexity when an order requires pickups at >1 external partner.
 */
export function resolveOrderFulfillmentPlan(
  order: OrderLike,
  offers: ProductOfferRecord[],
): {
  items: Array<{
    productId: string;
    title: string;
    quantity: number;
    price: number;
    originChannel: SupplyOriginChannel;
    ownership: StockOwnership;
    storageLocation: StockStorageLocation;
    partnerId?: string;
    partnerName?: string;
    pickupAddress?: string;
    pickupInstructions?: string;
    custodyLocation?: string;
  }>;
  hasConsignedItems: boolean;
  hasExternalPickupItems: boolean;
  externalPartnersCount: number;
  hasMultiPartnerPickupWarning: boolean;
} {
  const offerByProd = new Map<string, ProductOfferRecord>();
  for (const off of offers) {
    // Prefer active/approved partner offer if mapped
    offerByProd.set(off.productId, off);
  }

  const externalPartnerIds = new Set<string>();
  let hasConsignedItems = false;
  let hasExternalPickupItems = false;

  const resolvedItems = (order.items || []).map((item) => {
    const pid = item.id || item.productId || '';
    const off = pid ? offerByProd.get(pid) : undefined;

    if (off && off.originChannel === 'parceiro_consignado_mercado') {
      hasConsignedItems = true;
      return {
        productId: pid,
        title: item.title || off.productTitle,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || off.salePrice || 0),
        originChannel: 'parceiro_consignado_mercado' as const,
        ownership: 'parceiro' as const,
        storageLocation: 'mercado' as const,
        partnerId: off.partnerId,
        partnerName: off.partnerName,
        custodyLocation: off.custodyLocation || 'Área Consignada do Mercado',
      };
    }

    if (off && off.originChannel === 'parceiro_retirada_estabelecimento') {
      hasExternalPickupItems = true;
      if (off.partnerId) externalPartnerIds.add(off.partnerId);
      return {
        productId: pid,
        title: item.title || off.productTitle,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || off.salePrice || 0),
        originChannel: 'parceiro_retirada_estabelecimento' as const,
        ownership: 'parceiro' as const,
        storageLocation: 'estabelecimento_parceiro' as const,
        partnerId: off.partnerId,
        partnerName: off.partnerName,
        pickupAddress: off.pickupAddress || 'Endereço do parceiro no cadastro',
        pickupInstructions:
          off.pickupInstructions || 'Apresentar código do pedido na retirada.',
      };
    }

    return {
      productId: pid,
      title: item.title || 'Produto',
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      originChannel: 'mercado_proprio' as const,
      ownership: 'mercado' as const,
      storageLocation: 'mercado' as const,
    };
  });

  return {
    items: resolvedItems,
    hasConsignedItems,
    hasExternalPickupItems,
    externalPartnersCount: externalPartnerIds.size,
    hasMultiPartnerPickupWarning: externalPartnerIds.size > 1,
  };
}

/**
 * 9. Non-destructive Catalog & Origin Diagnostic (Section 13).
 * Inspects existing catalog products without reclassifying uncertain items automatically.
 */
export function diagnoseCatalogOrigins(
  products: CatalogProductLike[],
  offers: ProductOfferRecord[],
  metaMap: Record<string, PurchasingProductMetadata>,
): {
  totalCatalogProducts: number;
  mappedOwnProductsCount: number;
  mappedConsignedProductsCount: number;
  mappedExternalPickupCount: number;
  unclassifiedLegacyCount: number;
  missingCostCount: number;
  missingSkuOrEanCount: number;
  duplicateGroupsCount: number;
  unclassifiedItems: Array<{
    productId: string;
    title: string;
    stock: number;
    hasCost: boolean;
    hasSupplier: boolean;
    hasSkuOrEan: boolean;
  }>;
} {
  const offerByProd = new Map<string, ProductOfferRecord>();
  for (const off of offers) {
    offerByProd.set(off.productId, off);
  }

  let mappedOwnProductsCount = 0;
  let mappedConsignedProductsCount = 0;
  let mappedExternalPickupCount = 0;
  let unclassifiedLegacyCount = 0;
  let missingCostCount = 0;
  let missingSkuOrEanCount = 0;

  const titleUnitSeen = new Map<string, number>();
  const unclassifiedItems: Array<{
    productId: string;
    title: string;
    stock: number;
    hasCost: boolean;
    hasSupplier: boolean;
    hasSkuOrEan: boolean;
  }> = [];

  for (const p of products) {
    const hasCost = Number(p.costPrice || 0) > 0;
    const hasSkuOrEan = Boolean(p.sku?.trim() || p.ean?.trim());
    const hasSupplier = Boolean(
      p.supplier?.trim() || metaMap[p.id]?.primarySupplierId,
    );

    if (!hasCost) missingCostCount += 1;
    if (!hasSkuOrEan) missingSkuOrEanCount += 1;

    const key = `${normalizeCatalogToken(p.title)}::${normalizeCatalogToken(p.unit || 'UN')}`;
    titleUnitSeen.set(key, (titleUnitSeen.get(key) || 0) + 1);

    const off = offerByProd.get(p.id);
    if (off) {
      if (off.originChannel === 'mercado_proprio') mappedOwnProductsCount += 1;
      else if (off.originChannel === 'parceiro_consignado_mercado')
        mappedConsignedProductsCount += 1;
      else if (off.originChannel === 'parceiro_retirada_estabelecimento')
        mappedExternalPickupCount += 1;
    } else if (hasSupplier || hasCost) {
      mappedOwnProductsCount += 1;
    } else {
      unclassifiedLegacyCount += 1;
      unclassifiedItems.push({
        productId: p.id,
        title: p.title,
        stock: Number(p.stock || 0),
        hasCost,
        hasSupplier,
        hasSkuOrEan,
      });
    }
  }

  let duplicateGroupsCount = 0;
  for (const count of titleUnitSeen.values()) {
    if (count > 1) duplicateGroupsCount += 1;
  }

  return {
    totalCatalogProducts: products.length,
    mappedOwnProductsCount,
    mappedConsignedProductsCount,
    mappedExternalPickupCount,
    unclassifiedLegacyCount,
    missingCostCount,
    missingSkuOrEanCount,
    duplicateGroupsCount,
    unclassifiedItems: unclassifiedItems.slice(0, 50),
  };
}
