import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  applyCustodyMovementToOffer,
  computePurchaseListSummary,
  evaluatePostApprovalChange,
  evaluatePostApprovalOfferChange,
  evaluatePurchaseReceiptStatus,
  roundCurrency,
  SUPPLY_ORIGIN_SHORT_LABELS,
  type CourierPickupStatus,
  type CustodyMovementRecord,
  type CustodyMovementType,
  type OrderPickupTaskRecord,
  type OwnProductLifecycleStatus,
  type PartnerCommercialRule,
  type PartnerOfferLifecycleStatus,
  type PartnerSettlementRecord,
  type PartnerSettlementStatus,
  type PartnerVendorRecord,
  type ProductOfferRecord,
  type PurchaseAuditEntry,
  type PurchaseListItem,
  type PurchaseListRecord,
  type PurchaseListStatus,
  type PurchaseReceiptEvent,
  type PurchasingProductMetadata,
  type SupplierQuoteRecord,
  type SupplierRecord,
  type SupplyOriginChannel,
} from '../utils/purchasingEngine';
import { recordProductAudit } from './productAuditService';

const SUPPLIERS_COL = 'suppliers';
const QUOTES_COL = 'supplier_quotes';
const PRODUCT_META_COL = 'purchasing_product_meta';
const PURCHASE_LISTS_COL = 'purchase_lists';
const PARTNERS_COL = 'partners';
const OFFERS_COL = 'product_offers';
const CUSTODY_MOVEMENTS_COL = 'custody_movements';
const PARTNER_SETTLEMENTS_COL = 'partner_settlements';
const ORDER_PICKUP_TASKS_COL = 'order_fulfillment_tasks';

const LS_SUPPLIERS_KEY = 'mnj_purchasing_suppliers_v1';
const LS_QUOTES_KEY = 'mnj_purchasing_quotes_v1';
const LS_META_KEY = 'mnj_purchasing_product_meta_v1';
const LS_LISTS_KEY = 'mnj_purchasing_lists_v1';
const LS_PARTNERS_KEY = 'mnj_purchasing_partners_v1';
const LS_OFFERS_KEY = 'mnj_purchasing_offers_v1';
const LS_CUSTODY_KEY = 'mnj_purchasing_custody_v1';
const LS_SETTLEMENTS_KEY = 'mnj_purchasing_settlements_v1';
const LS_PICKUP_TASKS_KEY = 'mnj_purchasing_pickup_tasks_v1';

function readLocalCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function logLocalCacheFallback(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  // Se for falta de permissão ou offline, o fallback para o cache local é o comportamento
  // previsto da governança e não deve despejar logs de erro nem stack traces no console.
  if (
    msg.includes('insufficient permissions') ||
    msg.includes('permission-denied') ||
    msg.includes('Missing or insufficient') ||
    msg.includes('offline')
  ) {
    return;
  }
  console.warn(`${context}:`, msg);
}

export interface PurchasingActor {
  uid: string;
  name: string;
  role?: string | null;
}

export function generatePurchaseCode(existingCount = 0): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(existingCount + 1).padStart(3, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CMP-${ym}-${seq}-${rand}`;
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function listSuppliers(): Promise<SupplierRecord[]> {
  try {
    const snap = await getDocs(collection(db, SUPPLIERS_COL));
    const list: SupplierRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as Partial<SupplierRecord>;
      if (data && data.name) {
        list.push({
          id: d.id,
          name: String(data.name).trim(),
          contactName: String(data.contactName || '').trim(),
          phone: String(data.phone || '').trim(),
          email: String(data.email || '').trim(),
          document: String(data.document || '').trim(),
          paymentTerms: String(data.paymentTerms || 'À vista / Pix').trim(),
          leadTimeDays: Math.max(1, Number(data.leadTimeDays) || 3),
          minOrderValue: Math.max(0, roundCurrency(Number(data.minOrderValue) || 0)),
          notes: String(data.notes || '').trim(),
          status: data.status === 'inactive' ? 'inactive' : 'active',
          suppliedProductIds: Array.isArray(data.suppliedProductIds)
            ? data.suppliedProductIds
            : [],
          createdAt: String(data.createdAt || new Date().toISOString()),
          updatedAt: String(data.updatedAt || new Date().toISOString()),
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        });
      }
    });
    const sorted = list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    writeLocalCache(LS_SUPPLIERS_KEY, sorted);
    return sorted;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de fornecedores', err);
    return readLocalCache<SupplierRecord[]>(LS_SUPPLIERS_KEY, []);
  }
}

export async function saveSupplier(
  input: Partial<SupplierRecord> & { name: string },
  actor: PurchasingActor,
): Promise<SupplierRecord> {
  const nowIso = new Date().toISOString();
  const id = input.id?.trim() || `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const record: SupplierRecord = {
    id,
    name: input.name.trim(),
    contactName: (input.contactName || '').trim(),
    phone: (input.phone || '').trim(),
    email: (input.email || '').trim(),
    document: (input.document || '').trim(),
    paymentTerms: (input.paymentTerms || 'À vista / Pix').trim(),
    leadTimeDays: Math.max(1, Math.floor(Number(input.leadTimeDays) || 3)),
    minOrderValue: Math.max(0, roundCurrency(Number(input.minOrderValue) || 0)),
    notes: (input.notes || '').trim(),
    status: input.status === 'inactive' ? 'inactive' : 'active',
    suppliedProductIds: Array.isArray(input.suppliedProductIds)
      ? Array.from(new Set(input.suppliedProductIds))
      : [],
    createdAt: input.createdAt || nowIso,
    updatedAt: nowIso,
    createdBy: input.createdBy || actor.uid,
    updatedBy: actor.uid,
  };

  // Update local cache immediately
  const cached = readLocalCache<SupplierRecord[]>(LS_SUPPLIERS_KEY, []);
  const nextCache = [...cached.filter((s) => s.id !== id), record].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  writeLocalCache(LS_SUPPLIERS_KEY, nextCache);

  try {
    await setDoc(doc(db, SUPPLIERS_COL, id), record, { merge: true });
  } catch (err) {
    logLocalCacheFallback('Fornecedor salvo localmente (sincronização Firestore pendente)', err);
  }
  return record;
}

// ─── Supplier Quotes (Append-Only History) ──────────────────────────────────

export async function listSupplierQuotes(): Promise<SupplierQuoteRecord[]> {
  try {
    const q = query(collection(db, QUOTES_COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: SupplierQuoteRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as Partial<SupplierQuoteRecord>;
      if (data && data.productId && data.supplierId) {
        list.push({
          id: d.id,
          supplierId: String(data.supplierId),
          supplierName: String(data.supplierName || ''),
          productId: String(data.productId),
          productTitle: String(data.productTitle || ''),
          unitCost: Math.max(0, roundCurrency(Number(data.unitCost) || 0)),
          unit: String(data.unit || 'UN'),
          minQuantity: Math.max(1, Math.floor(Number(data.minQuantity) || 1)),
          packMultiple: Math.max(1, Math.floor(Number(data.packMultiple) || 1)),
          leadTimeDays: Math.max(1, Math.floor(Number(data.leadTimeDays) || 3)),
          validUntil: String(data.validUntil || ''),
          notes: String(data.notes || ''),
          createdAt: String(data.createdAt || new Date().toISOString()),
          createdBy: String(data.createdBy || ''),
          createdByName: String(data.createdByName || ''),
        });
      }
    });
    writeLocalCache(LS_QUOTES_KEY, list);
    return list;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de cotações', err);
    return readLocalCache<SupplierQuoteRecord[]>(LS_QUOTES_KEY, []);
  }
}

export async function addSupplierQuote(
  input: Omit<SupplierQuoteRecord, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>,
  actor: PurchasingActor,
): Promise<SupplierQuoteRecord> {
  const nowIso = new Date().toISOString();
  const id = `qt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const record: SupplierQuoteRecord = {
    id,
    supplierId: input.supplierId,
    supplierName: input.supplierName.trim(),
    productId: input.productId,
    productTitle: input.productTitle.trim(),
    unitCost: Math.max(0.01, roundCurrency(Number(input.unitCost) || 0)),
    unit: (input.unit || 'UN').trim(),
    minQuantity: Math.max(1, Math.floor(Number(input.minQuantity) || 1)),
    packMultiple: Math.max(1, Math.floor(Number(input.packMultiple) || 1)),
    leadTimeDays: Math.max(1, Math.floor(Number(input.leadTimeDays) || 3)),
    validUntil: input.validUntil || '',
    notes: (input.notes || '').trim(),
    createdAt: nowIso,
    createdBy: actor.uid,
    createdByName: actor.name,
  };

  const cached = readLocalCache<SupplierQuoteRecord[]>(LS_QUOTES_KEY, []);
  writeLocalCache(LS_QUOTES_KEY, [record, ...cached]);

  try {
    await setDoc(doc(db, QUOTES_COL, id), record);
  } catch (err) {
    logLocalCacheFallback('Cotação salva localmente (sincronização Firestore pendente)', err);
  }
  return record;
}

// ─── Product Purchasing Metadata ────────────────────────────────────────────

export async function listPurchasingProductMeta(): Promise<
  Record<string, PurchasingProductMetadata>
> {
  try {
    const snap = await getDocs(collection(db, PRODUCT_META_COL));
    const map: Record<string, PurchasingProductMetadata> = {};
    snap.forEach((d) => {
      const data = d.data() as PurchasingProductMetadata;
      map[d.id] = { ...data, productId: d.id };
    });
    writeLocalCache(LS_META_KEY, map);
    return map;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de metadados de compras', err);
    return readLocalCache<Record<string, PurchasingProductMetadata>>(LS_META_KEY, {});
  }
}

export async function savePurchasingProductMeta(
  meta: PurchasingProductMetadata,
  actor: PurchasingActor,
): Promise<PurchasingProductMetadata> {
  const nowIso = new Date().toISOString();
  const record: PurchasingProductMetadata = {
    ...meta,
    updatedAt: nowIso,
    updatedBy: actor.uid,
  };

  const cached = readLocalCache<Record<string, PurchasingProductMetadata>>(LS_META_KEY, {});
  cached[meta.productId] = record;
  writeLocalCache(LS_META_KEY, cached);

  try {
    await setDoc(doc(db, PRODUCT_META_COL, meta.productId), record, { merge: true });
  } catch (err) {
    logLocalCacheFallback('Metadados de produto salvos localmente', err);
  }
  return record;
}

// ─── Purchase Lists (Full Audited Lifecycle) ────────────────────────────────

export async function listPurchaseLists(): Promise<PurchaseListRecord[]> {
  try {
    const q = query(collection(db, PURCHASE_LISTS_COL), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    const list: PurchaseListRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as PurchaseListRecord;
      if (data && data.title) {
        list.push({
          ...data,
          id: d.id,
          items: Array.isArray(data.items) ? data.items : [],
          receiptHistory: Array.isArray(data.receiptHistory) ? data.receiptHistory : [],
          auditTrail: Array.isArray(data.auditTrail) ? data.auditTrail : [],
        });
      }
    });
    writeLocalCache(LS_LISTS_KEY, list);
    return list;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de listas de compra', err);
    return readLocalCache<PurchaseListRecord[]>(LS_LISTS_KEY, []);
  }
}

export async function savePurchaseList(
  record: PurchaseListRecord,
): Promise<PurchaseListRecord> {
  const cached = readLocalCache<PurchaseListRecord[]>(LS_LISTS_KEY, []);
  const nextCache = [record, ...cached.filter((l) => l.id !== record.id)];
  writeLocalCache(LS_LISTS_KEY, nextCache);

  try {
    await setDoc(doc(db, PURCHASE_LISTS_COL, record.id), record, { merge: true });
  } catch (err) {
    logLocalCacheFallback('Lista de compra salva localmente (sincronização Firestore pendente)', err);
  }
  return record;
}

export function buildAuditEntry(
  actor: PurchasingActor,
  action: string,
  opts?: {
    previousStatus?: PurchaseListStatus | null;
    newStatus?: PurchaseListStatus | null;
    comment?: string;
    beforeSummary?: string;
    afterSummary?: string;
  },
): PurchaseAuditEntry {
  return {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role || null,
    action,
    previousStatus: opts?.previousStatus ?? null,
    newStatus: opts?.newStatus ?? null,
    comment: opts?.comment,
    beforeSummary: opts?.beforeSummary,
    afterSummary: opts?.afterSummary,
  };
}

/**
 * Creates or updates a Purchase List, enforcing post-approval integrity rules:
 * If an approved list is modified such that its total or quantities/costs/suppliers increase,
 * its approval is automatically invalidated (`aguardando_aprovacao`) and logged in the audit trail.
 */
export async function upsertPurchaseListWithGuard(
  existing: PurchaseListRecord | null,
  draftInput: {
    title: string;
    purpose: string;
    desiredDate: string;
    notes: string;
    items: PurchaseListItem[];
    freightCost: number;
    taxCost: number;
    otherCost: number;
    paymentTerms: string;
  },
  actor: PurchasingActor,
  existingCount = 0,
): Promise<{
  record: PurchaseListRecord;
  approvalInvalidated: boolean;
  invalidationReasons: string[];
}> {
  const nowIso = new Date().toISOString();
  const normalizedItems: PurchaseListItem[] = draftInput.items.map((item) => {
    const qty = Math.max(1, Math.floor(Number(item.requestedQty) || 1));
    const cost = Math.max(0, roundCurrency(Number(item.quotedUnitCost) || 0));
    return {
      ...item,
      requestedQty: qty,
      quotedUnitCost: cost,
      estimatedItemTotal: roundCurrency(qty * cost),
    };
  });

  const summary = computePurchaseListSummary({
    items: normalizedItems,
    freightCost: draftInput.freightCost,
    taxCost: draftInput.taxCost,
    otherCost: draftInput.otherCost,
  });

  if (!existing) {
    const id = `plist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const code = generatePurchaseCode(existingCount);
    const auditEntry = buildAuditEntry(actor, 'Lista de compra criada (Rascunho)', {
      previousStatus: null,
      newStatus: 'rascunho',
      afterSummary: `${normalizedItems.length} itens • Total estimado R$ ${summary.estimatedGrandTotal.toFixed(2)}`,
    });

    const newRecord: PurchaseListRecord = {
      id,
      code,
      title: draftInput.title.trim() || `Compra ${code}`,
      purpose: draftInput.purpose.trim() || 'Reposição de estoque',
      desiredDate: draftInput.desiredDate || nowIso.slice(0, 10),
      notes: draftInput.notes.trim(),
      status: 'rascunho',
      items: normalizedItems,
      freightCost: roundCurrency(Number(draftInput.freightCost) || 0),
      taxCost: roundCurrency(Number(draftInput.taxCost) || 0),
      otherCost: roundCurrency(Number(draftInput.otherCost) || 0),
      paymentTerms: draftInput.paymentTerms.trim() || 'Pix / Boleto',
      estimatedItemsTotal: summary.estimatedItemsTotal,
      estimatedGrandTotal: summary.estimatedGrandTotal,
      approvedLimitTotal: null,
      effectiveItemsTotal: summary.effectiveItemsTotal,
      effectiveGrandTotal: summary.effectiveGrandTotal,
      createdBy: actor.uid,
      createdByName: actor.name,
      createdAt: nowIso,
      updatedAt: nowIso,
      receiptHistory: [],
      auditTrail: [auditEntry],
    };

    await savePurchaseList(newRecord);
    return {
      record: newRecord,
      approvalInvalidated: false,
      invalidationReasons: [],
    };
  }

  // Check if editing an approved list invalidates authorization
  const postApprovalCheck = evaluatePostApprovalChange(existing, normalizedItems, {
    freightCost: draftInput.freightCost,
    taxCost: draftInput.taxCost,
    otherCost: draftInput.otherCost,
  });

  const nextStatus: PurchaseListStatus = postApprovalCheck.invalidatesApproval
    ? 'aguardando_aprovacao'
    : existing.status;

  const auditEntry = buildAuditEntry(
    actor,
    postApprovalCheck.invalidatesApproval
      ? 'Edição pós-aprovação invalidou autorização anterior (Requer nova aprovação)'
      : 'Lista de compra atualizada',
    {
      previousStatus: existing.status,
      newStatus: nextStatus,
      comment: postApprovalCheck.invalidatesApproval
        ? postApprovalCheck.reasons.join(' | ')
        : undefined,
      beforeSummary: `${existing.items.length} itens • R$ ${existing.estimatedGrandTotal.toFixed(2)}`,
      afterSummary: `${normalizedItems.length} itens • R$ ${summary.estimatedGrandTotal.toFixed(2)}`,
    },
  );

  const updatedRecord: PurchaseListRecord = {
    ...existing,
    title: draftInput.title.trim() || existing.title,
    purpose: draftInput.purpose.trim() || existing.purpose,
    desiredDate: draftInput.desiredDate || existing.desiredDate,
    notes: draftInput.notes.trim(),
    status: nextStatus,
    items: normalizedItems,
    freightCost: roundCurrency(Number(draftInput.freightCost) || 0),
    taxCost: roundCurrency(Number(draftInput.taxCost) || 0),
    otherCost: roundCurrency(Number(draftInput.otherCost) || 0),
    paymentTerms: draftInput.paymentTerms.trim() || existing.paymentTerms,
    estimatedItemsTotal: summary.estimatedItemsTotal,
    estimatedGrandTotal: summary.estimatedGrandTotal,
    approvedLimitTotal: postApprovalCheck.invalidatesApproval
      ? null
      : existing.approvedLimitTotal,
    effectiveItemsTotal: summary.effectiveItemsTotal,
    effectiveGrandTotal: summary.effectiveGrandTotal,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(existing.auditTrail || [])],
  };

  await savePurchaseList(updatedRecord);
  return {
    record: updatedRecord,
    approvalInvalidated: postApprovalCheck.invalidatesApproval,
    invalidationReasons: postApprovalCheck.reasons,
  };
}

/**
 * Duplicates a previous Purchase List as a new fresh 'rascunho' without copying approval status.
 */
export async function duplicatePurchaseListAsDraft(
  source: PurchaseListRecord,
  actor: PurchasingActor,
  existingCount = 0,
): Promise<PurchaseListRecord> {
  const cleanItems: PurchaseListItem[] = source.items.map((item) => ({
    productId: item.productId,
    productTitle: item.productTitle,
    sku: item.sku,
    category: item.category,
    unit: item.unit,
    supplierId: item.supplierId,
    supplierName: item.supplierName,
    requestedQty: item.requestedQty,
    quotedUnitCost: item.quotedUnitCost,
    currentSalePrice: item.currentSalePrice,
    estimatedItemTotal: roundCurrency(item.requestedQty * item.quotedUnitCost),
    reason: item.reason,
    notes: item.notes,
    isNewProduct: item.isNewProduct,
  }));

  const res = await upsertPurchaseListWithGuard(
    null,
    {
      title: `Cópia de ${source.title}`,
      purpose: source.purpose,
      desiredDate: new Date().toISOString().slice(0, 10),
      notes: source.notes,
      items: cleanItems,
      freightCost: source.freightCost,
      taxCost: source.taxCost,
      otherCost: source.otherCost,
      paymentTerms: source.paymentTerms,
    },
    actor,
    existingCount,
  );

  return res.record;
}

/**
 * Submits a 'rascunho' or 'rejeitada' list to 'aguardando_aprovacao'.
 */
export async function submitPurchaseListForApproval(
  list: PurchaseListRecord,
  actor: PurchasingActor,
  comment?: string,
): Promise<PurchaseListRecord> {
  if (list.items.length === 0) {
    throw new Error('A lista precisa ter pelo menos um item para ser submetida à aprovação.');
  }
  const nowIso = new Date().toISOString();
  const auditEntry = buildAuditEntry(actor, 'Submetida para aprovação', {
    previousStatus: list.status,
    newStatus: 'aguardando_aprovacao',
    comment: comment?.trim() || list.purpose,
    afterSummary: `Total solicitado: R$ ${list.estimatedGrandTotal.toFixed(2)} (${list.items.length} itens)`,
  });

  const updated: PurchaseListRecord = {
    ...list,
    status: 'aguardando_aprovacao',
    submittedBy: actor.uid,
    submittedByName: actor.name,
    submittedAt: nowIso,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(list.auditTrail || [])],
  };

  return savePurchaseList(updated);
}

/**
 * Authorizer action: Approve, Reject, or Return for Adjustment.
 * When approved, freezes `approvedLimitTotal` to `estimatedGrandTotal`.
 */
export async function authorizePurchaseList(
  list: PurchaseListRecord,
  decision: 'approve' | 'reject' | 'request_adjustment',
  actor: PurchasingActor,
  opts: {
    comment: string;
    assignedBuyerUid?: string;
    assignedBuyerName?: string;
  },
): Promise<PurchaseListRecord> {
  const nowIso = new Date().toISOString();
  const isApprove = decision === 'approve';
  const nextStatus: PurchaseListStatus = isApprove ? 'aprovada' : 'rejeitada';

  const actionLabel =
    decision === 'approve'
      ? 'Compra aprovada pelo autorizador'
      : decision === 'reject'
      ? 'Compra rejeitada pelo autorizador'
      : 'Solicitado ajuste na lista de compra';

  const auditEntry = buildAuditEntry(actor, actionLabel, {
    previousStatus: list.status,
    newStatus: nextStatus,
    comment: opts.comment.trim(),
    beforeSummary: `Status: ${list.status}`,
    afterSummary: isApprove
      ? `Teto aprovado: R$ ${list.estimatedGrandTotal.toFixed(2)}${opts.assignedBuyerName ? ` • Comprador: ${opts.assignedBuyerName}` : ''}`
      : `Motivo: ${opts.comment.trim()}`,
  });

  const updated: PurchaseListRecord = {
    ...list,
    status: nextStatus,
    approvedLimitTotal: isApprove ? list.estimatedGrandTotal : null,
    approvedBy: isApprove ? actor.uid : list.approvedBy,
    approvedByName: isApprove ? actor.name : list.approvedByName,
    approvedAt: isApprove ? nowIso : list.approvedAt,
    approvalComment: isApprove ? opts.comment.trim() : list.approvalComment,
    rejectedBy: !isApprove ? actor.uid : list.rejectedBy,
    rejectedByName: !isApprove ? actor.name : list.rejectedByName,
    rejectedAt: !isApprove ? nowIso : list.rejectedAt,
    rejectionReason: !isApprove ? opts.comment.trim() : list.rejectionReason,
    assignedBuyerUid: opts.assignedBuyerUid || list.assignedBuyerUid || null,
    assignedBuyerName: opts.assignedBuyerName || list.assignedBuyerName || null,
    assignedAt: opts.assignedBuyerUid ? nowIso : list.assignedAt,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(list.auditTrail || [])],
  };

  return savePurchaseList(updated);
}

/**
 * Assigns a buyer and transitions an approved list to 'em_compra' (Execution).
 */
export async function startPurchaseExecution(
  list: PurchaseListRecord,
  buyer: { uid: string; name: string },
  actor: PurchasingActor,
  notes?: string,
): Promise<PurchaseListRecord> {
  const nowIso = new Date().toISOString();
  const auditEntry = buildAuditEntry(
    actor,
    `Execução de compra iniciada (Responsável: ${buyer.name})`,
    {
      previousStatus: list.status,
      newStatus: 'em_compra',
      comment: notes?.trim(),
    },
  );

  const updated: PurchaseListRecord = {
    ...list,
    status: 'em_compra',
    assignedBuyerUid: buyer.uid,
    assignedBuyerName: buyer.name,
    assignedAt: nowIso,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(list.auditTrail || [])],
  };

  return savePurchaseList(updated);
}

/**
 * Records execution details and partial or full receipt of items.
 * Enforces:
 * 1. If effectiveGrandTotal exceeds `approvedLimitTotal`, blocks or invalidates unless re-approved.
 * 2. Cannot mark 'recebida' if there are pending quantities without `closeShortJustification`.
 */
export async function recordPurchaseReceipt(
  list: PurchaseListRecord,
  payload: {
    updatedItems: PurchaseListItem[];
    invoiceRef?: string;
    notes?: string;
    closeShortJustification?: string;
  },
  actor: PurchasingActor,
): Promise<{
  record: PurchaseListRecord;
  requiresReapproval: boolean;
  reapprovalReason?: string;
  deltasToApplyToStock: Array<{ productId: string; delta: number; productTitle: string; unitCost: number }>;
}> {
  const nowIso = new Date().toISOString();
  const prevByProd = new Map(list.items.map((i) => [i.productId, i]));

  const summary = computePurchaseListSummary({
    items: payload.updatedItems,
    freightCost: list.freightCost,
    taxCost: list.taxCost,
    otherCost: list.otherCost,
  });

  // Check if effective total exceeds approved limit
  const approvedCeiling = list.approvedLimitTotal ?? list.estimatedGrandTotal;
  if (summary.effectiveGrandTotal > approvedCeiling) {
    const reason = `O valor efetivo da compra (R$ ${summary.effectiveGrandTotal.toFixed(2)}) excede o limite aprovado (R$ ${approvedCeiling.toFixed(2)}). A lista retornou para Aguardando Aprovação.`;
    const auditEntry = buildAuditEntry(
      actor,
      'Execução bloqueada: custo efetivo superior ao teto aprovado (Requer nova aprovação)',
      {
        previousStatus: list.status,
        newStatus: 'aguardando_aprovacao',
        comment: reason,
        beforeSummary: `Teto aprovado: R$ ${approvedCeiling.toFixed(2)}`,
        afterSummary: `Total efetivo tentado: R$ ${summary.effectiveGrandTotal.toFixed(2)}`,
      },
    );

    const reverted: PurchaseListRecord = {
      ...list,
      status: 'aguardando_aprovacao',
      items: payload.updatedItems,
      effectiveItemsTotal: summary.effectiveItemsTotal,
      effectiveGrandTotal: summary.effectiveGrandTotal,
      approvedLimitTotal: null,
      updatedAt: nowIso,
      auditTrail: [auditEntry, ...(list.auditTrail || [])],
    };
    await savePurchaseList(reverted);
    return {
      record: reverted,
      requiresReapproval: true,
      reapprovalReason: reason,
      deltasToApplyToStock: [],
    };
  }

  // Compute positive received deltas for this receipt event
  const deltasToApplyToStock: Array<{
    productId: string;
    delta: number;
    productTitle: string;
    unitCost: number;
  }> = [];

  for (const item of payload.updatedItems) {
    const prev = prevByProd.get(item.productId);
    const prevReceived = Math.max(0, Number(prev?.receivedQty || 0));
    const nextReceived = Math.max(0, Number(item.receivedQty || 0));
    const delta = nextReceived - prevReceived;
    if (delta > 0) {
      deltasToApplyToStock.push({
        productId: item.productId,
        delta,
        productTitle: item.productTitle,
        unitCost: Number(item.effectiveUnitCost || item.quotedUnitCost || 0),
      });
    }
  }

  const receiptEval = evaluatePurchaseReceiptStatus(
    payload.updatedItems,
    payload.closeShortJustification,
  );

  const receiptEvent: PurchaseReceiptEvent | null =
    deltasToApplyToStock.length > 0
      ? {
          id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowIso,
          actorUid: actor.uid,
          actorName: actor.name,
          invoiceRef: payload.invoiceRef?.trim(),
          notes: payload.notes?.trim(),
          itemsReceived: deltasToApplyToStock.map((d) => ({
            productId: d.productId,
            productTitle: d.productTitle,
            deltaReceivedQty: d.delta,
            effectiveUnitCost: d.unitCost,
          })),
        }
      : null;

  const auditEntry = buildAuditEntry(
    actor,
    receiptEval.nextStatus === 'recebida'
      ? 'Recebimento concluído'
      : 'Recebimento parcial / atualização de execução registrada',
    {
      previousStatus: list.status,
      newStatus: receiptEval.nextStatus,
      comment:
        payload.closeShortJustification?.trim() ||
        payload.notes?.trim() ||
        (payload.invoiceRef ? `NF/Ref: ${payload.invoiceRef}` : undefined),
      afterSummary: `Recebidos ${receiptEval.totalReceivedUnits}/${receiptEval.totalTargetUnits} un. • Total efetivo R$ ${summary.effectiveGrandTotal.toFixed(2)}`,
    },
  );

  const updated: PurchaseListRecord = {
    ...list,
    status: receiptEval.nextStatus,
    items: payload.updatedItems,
    effectiveItemsTotal: summary.effectiveItemsTotal,
    effectiveGrandTotal: summary.effectiveGrandTotal,
    closedShortJustification: payload.closeShortJustification?.trim() || list.closedShortJustification || null,
    updatedAt: nowIso,
    receiptHistory: receiptEvent
      ? [receiptEvent, ...(list.receiptHistory || [])]
      : list.receiptHistory || [],
    auditTrail: [auditEntry, ...(list.auditTrail || [])],
  };

  await savePurchaseList(updated);
  return {
    record: updated,
    requiresReapproval: false,
    deltasToApplyToStock,
  };
}

/**
 * Cancels a Purchase List with mandatory justification.
 */
export async function cancelPurchaseList(
  list: PurchaseListRecord,
  reason: string,
  actor: PurchasingActor,
): Promise<PurchaseListRecord> {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Informe o motivo do cancelamento.');
  }
  const nowIso = new Date().toISOString();
  const auditEntry = buildAuditEntry(actor, 'Lista de compra cancelada', {
    previousStatus: list.status,
    newStatus: 'cancelada',
    comment: reason.trim(),
  });

  const updated: PurchaseListRecord = {
    ...list,
    status: 'cancelada',
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(list.auditTrail || [])],
  };

  return savePurchaseList(updated);
}

// ─── Partner Vendors (Parceiros Vendedores — Distinct from Fornecedores) ─────

export async function listPartnerVendors(): Promise<PartnerVendorRecord[]> {
  try {
    const snap = await getDocs(collection(db, PARTNERS_COL));
    const list: PartnerVendorRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as PartnerVendorRecord;
      if (data && data.name) {
        list.push({
          ...data,
          id: d.id,
          commercialRuleHistory: Array.isArray(data.commercialRuleHistory)
            ? data.commercialRuleHistory
            : [],
          publicProfile: data.publicProfile || {
            published: false,
            moderationStatus: 'rascunho',
            publicName: data.tradeName || data.name,
            slug: d.id,
            categories: [],
          },
        });
      }
    });
    const sorted = list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    writeLocalCache(LS_PARTNERS_KEY, sorted);
    return sorted;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de parceiros vendedores', err);
    return readLocalCache<PartnerVendorRecord[]>(LS_PARTNERS_KEY, []);
  }
}

export async function savePartnerVendor(
  input: Partial<PartnerVendorRecord> & {
    name: string;
    currentCommercialRule: PartnerCommercialRule;
  },
  actor: PurchasingActor,
): Promise<PartnerVendorRecord> {
  const nowIso = new Date().toISOString();
  const id =
    input.id?.trim() || `prt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const cached = readLocalCache<PartnerVendorRecord[]>(LS_PARTNERS_KEY, []);
  const existing = cached.find((p) => p.id === id);

  const nextVersion = existing
    ? (existing.currentCommercialRule?.version || 1) + 1
    : 1;

  const versionedRule: PartnerCommercialRule = {
    ...input.currentCommercialRule,
    version: nextVersion,
    validFrom: input.currentCommercialRule.validFrom || nowIso.slice(0, 10),
    approvedByUid: actor.uid,
    approvedByName: actor.name,
    approvedAt: nowIso,
    fiscalResponsibilityPolicy:
      input.currentCommercialRule.fiscalResponsibilityPolicy || 'definicao_pendente',
  };

  const ruleHistory = existing
    ? [versionedRule, ...(existing.commercialRuleHistory || [])]
    : [versionedRule];

  const slugBase = (input.tradeName || input.name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const record: PartnerVendorRecord = {
    id,
    name: input.name.trim(),
    tradeName: (input.tradeName || input.name).trim(),
    document: (input.document || '').trim(),
    contactName: (input.contactName || '').trim(),
    phone: (input.phone || '').trim(),
    email: (input.email || '').trim(),
    pixKey: (input.pixKey || '').trim(),
    address: (input.address || '').trim(),
    pickupInstructions: (
      input.pickupInstructions || 'Apresentar código do pedido no balcão do parceiro.'
    ).trim(),
    estimatedPrepMinutes: Math.max(5, Math.floor(Number(input.estimatedPrepMinutes) || 15)),
    availabilityTtlHours: Math.max(1, Math.floor(Number(input.availabilityTtlHours) || 24)),
    defaultChannel:
      input.defaultChannel === 'parceiro_retirada_estabelecimento'
        ? 'parceiro_retirada_estabelecimento'
        : 'parceiro_consignado_mercado',
    status: input.status || 'active',
    linkedSupplierId: input.linkedSupplierId || null,
    currentCommercialRule: versionedRule,
    commercialRuleHistory: ruleHistory,
    publicProfile: {
      // Strictly false by default per Section 12 — never published without explicit moderation
      published: false,
      moderationStatus: input.publicProfile?.moderationStatus || 'rascunho',
      publicName: (input.publicProfile?.publicName || input.tradeName || input.name).trim(),
      slug: input.publicProfile?.slug || slugBase || id,
      logoUrl: input.publicProfile?.logoUrl || '',
      shortDescription: input.publicProfile?.shortDescription || '',
      categories: Array.isArray(input.publicProfile?.categories)
        ? input.publicProfile!.categories
        : [],
      serviceRegion: input.publicProfile?.serviceRegion || 'Condomínio & Entorno',
      operatingHours: input.publicProfile?.operatingHours || '08h às 22h',
    },
    notes: (input.notes || '').trim(),
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
    createdBy: existing?.createdBy || actor.uid,
    updatedBy: actor.uid,
  };

  const nextCache = [...cached.filter((p) => p.id !== id), record].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
  writeLocalCache(LS_PARTNERS_KEY, nextCache);

  try {
    await setDoc(doc(db, PARTNERS_COL, id), record, { merge: true });
  } catch (err) {
    logLocalCacheFallback('Parceiro salvo localmente (sincronização Firestore pendente)', err);
  }
  return record;
}

// ─── Product Offers & Multi-Origin Lifecycle (`product_offers`) ─────────────

export async function listProductOffers(): Promise<ProductOfferRecord[]> {
  try {
    const q = query(collection(db, OFFERS_COL), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    const list: ProductOfferRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as ProductOfferRecord;
      if (data && data.productId && data.productTitle) {
        list.push({
          ...data,
          id: d.id,
          auditTrail: Array.isArray(data.auditTrail) ? data.auditTrail : [],
        });
      }
    });
    writeLocalCache(LS_OFFERS_KEY, list);
    return list;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de ofertas/origens de produtos', err);
    return readLocalCache<ProductOfferRecord[]>(LS_OFFERS_KEY, []);
  }
}

export async function saveProductOffer(
  offer: ProductOfferRecord,
): Promise<ProductOfferRecord> {
  const cached = readLocalCache<ProductOfferRecord[]>(LS_OFFERS_KEY, []);
  const nextCache = [offer, ...cached.filter((o) => o.id !== offer.id)];
  writeLocalCache(LS_OFFERS_KEY, nextCache);

  try {
    await setDoc(doc(db, OFFERS_COL, offer.id), offer, { merge: true });
  } catch (err) {
    logLocalCacheFallback('Oferta/origem salva localmente', err);
  }
  return offer;
}

/**
 * Onboarding Entry Point (Section 4):
 * Creates a draft Product in the master `products` catalog if it does not exist yet
 * (with `stock: 0, active: false` so it NEVER gains stock or becomes sellable prematurely!),
 * and creates or updates the corresponding `ProductOfferRecord` in `rascunho` or `aguardando_aprovacao_*`.
 */
export async function onboardProductAndOfferViaAssistant(
  input: {
    existingProductId?: string | null;
    title: string;
    sku?: string;
    ean?: string;
    category: string;
    unit: string;
    image?: string;
    description?: string;
    originChannel: SupplyOriginChannel;
    salePrice: number;
    inclusionJustification: string;
    submitImmediatelyForApproval?: boolean;
    // For `mercado_proprio`
    supplierId?: string;
    supplierName?: string;
    unitAcquisitionCost?: number;
    plannedPurchaseQty?: number;
    // For partner channels (`parceiro_consignado_mercado` | `parceiro_retirada_estabelecimento`)
    partner?: PartnerVendorRecord | null;
    customCommercialRule?: PartnerCommercialRule;
    custodyLocation?: string;
    custodianName?: string;
    initialReportedAvailableQty?: number;
  },
  actor: PurchasingActor,
): Promise<{
  productId: string;
  createdNewCatalogProduct: boolean;
  offer: ProductOfferRecord;
}> {
  const nowIso = new Date().toISOString();
  let productId = input.existingProductId?.trim() || '';
  let createdNewCatalogProduct = false;

  if (!productId) {
    productId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    createdNewCatalogProduct = true;

    // Master catalog product starts with stock: 0 and active: false until approved & received/confirmed!
    const catalogDraft = {
      id: productId,
      title: input.title.trim(),
      description: (
        input.description ||
        `Cadastrado via Assistente de Compras (${SUPPLY_ORIGIN_SHORT_LABELS[input.originChannel]}).`
      ).trim(),
      category: input.category.trim() || 'Mercearia',
      image: input.image?.trim() || '/logo.png',
      sku: (input.sku || '').trim().toUpperCase(),
      ean: (input.ean || '').trim(),
      unit: (input.unit || 'UN').trim().toUpperCase(),
      supplier:
        input.originChannel === 'mercado_proprio'
          ? (input.supplierName || '').trim()
          : (input.partner?.tradeName || input.partner?.name || '').trim(),
      price: roundCurrency(Number(input.salePrice) || 0),
      costPrice:
        input.originChannel === 'mercado_proprio'
          ? roundCurrency(Number(input.unitAcquisitionCost) || 0)
          : 0,
      // CRITICAL INVARIANT: Own or partner product NEVER starts with physical stock in Mercado's catalog
      stock: 0,
      minStock: 5,
      // Remains inactive until product/offer is approved and stock/availability is confirmed
      active: false,
      featured: false,
      supplyOriginChannel: input.originChannel,
      stockOwnership: input.originChannel === 'mercado_proprio' ? 'mercado' : 'parceiro',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'products', productId), catalogDraft, { merge: true });
      await recordProductAudit({
        productId,
        productTitle: catalogDraft.title,
        userId: actor.uid,
        userName: actor.name,
        userEmail: actor.role || 'staff',
        operation: 'create',
        changes: [
          {
            field: 'title',
            label: 'Título do Produto (Rascunho via Assistente de Compras)',
            oldValue: null,
            newValue: `${catalogDraft.title} [${SUPPLY_ORIGIN_SHORT_LABELS[input.originChannel]}]`,
          },
        ],
        note: `Entrada via Assistente de Compras: ${input.inclusionJustification}`,
      });
    } catch (err) {
      logLocalCacheFallback('Rascunho de produto salvo localmente', err);
    }
  }

  const isOwn = input.originChannel === 'mercado_proprio';
  const ownership = isOwn ? 'mercado' : 'parceiro';
  const storageLocation =
    input.originChannel === 'parceiro_retirada_estabelecimento'
      ? 'estabelecimento_parceiro'
      : 'mercado';

  const ownStatus: OwnProductLifecycleStatus | undefined = isOwn
    ? input.submitImmediatelyForApproval
      ? 'aguardando_aprovacao_produto'
      : 'rascunho'
    : undefined;

  const partnerStatus: PartnerOfferLifecycleStatus | undefined = !isOwn
    ? input.submitImmediatelyForApproval
      ? 'aguardando_aprovacao_parceiro_produto'
      : 'rascunho'
    : undefined;

  const offerId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const auditEntry = buildAuditEntry(
    actor,
    input.submitImmediatelyForApproval
      ? `Produto/Oferta cadastrado no Assistente e enviado para aprovação (${SUPPLY_ORIGIN_SHORT_LABELS[input.originChannel]})`
      : `Rascunho de Produto/Oferta criado no Assistente (${SUPPLY_ORIGIN_SHORT_LABELS[input.originChannel]})`,
    {
      comment: input.inclusionJustification.trim(),
      afterSummary: `Preço previsto: R$ ${roundCurrency(input.salePrice).toFixed(2)} • Propriedade: ${ownership.toUpperCase()}`,
    },
  );

  const offer: ProductOfferRecord = {
    id: offerId,
    productId,
    productTitle: input.title.trim(),
    sku: (input.sku || '').trim().toUpperCase(),
    ean: (input.ean || '').trim(),
    category: input.category.trim() || 'Mercearia',
    unit: (input.unit || 'UN').trim().toUpperCase(),
    image: input.image?.trim() || '/logo.png',
    originChannel: input.originChannel,
    ownership,
    storageLocation,
    ownLifecycleStatus: ownStatus,
    partnerLifecycleStatus: partnerStatus,
    supplierId: isOwn ? input.supplierId || '' : undefined,
    supplierName: isOwn ? input.supplierName || '' : undefined,
    unitAcquisitionCost: isOwn
      ? roundCurrency(Number(input.unitAcquisitionCost) || 0)
      : undefined,
    plannedPurchaseQty: isOwn
      ? Math.max(0, Math.floor(Number(input.plannedPurchaseQty) || 0))
      : undefined,
    partnerId: !isOwn ? input.partner?.id || '' : undefined,
    partnerName: !isOwn
      ? input.partner?.tradeName || input.partner?.name || ''
      : undefined,
    commercialRule: !isOwn
      ? input.customCommercialRule || input.partner?.currentCommercialRule
      : undefined,
    salePrice: roundCurrency(Number(input.salePrice) || 0),
    custodyLocation:
      input.originChannel === 'parceiro_consignado_mercado'
        ? (input.custodyLocation || 'Prateleira Consignada — Mercado').trim()
        : undefined,
    custodianName:
      input.originChannel === 'parceiro_consignado_mercado'
        ? (input.custodianName || actor.name).trim()
        : undefined,
    // Starts at 0 physical custody until `recordPartnerCustodyMovement` is executed!
    consignedPhysicalQty: 0,
    consignedReservedQty: 0,
    consignedAvailableQty: 0,
    consignedDamagedOrLostQty: 0,
    partnerReportedAvailableQty:
      input.originChannel === 'parceiro_retirada_estabelecimento'
        ? Math.max(0, Math.floor(Number(input.initialReportedAvailableQty) || 0))
        : 0,
    availabilityConfirmedAt: null,
    availabilityExpiresAt: null,
    pickupAddress: !isOwn ? input.partner?.address || '' : undefined,
    pickupInstructions: !isOwn ? input.partner?.pickupInstructions || '' : undefined,
    estimatedPrepMinutes: !isOwn ? input.partner?.estimatedPrepMinutes || 15 : undefined,
    inclusionJustification: input.inclusionJustification.trim(),
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: nowIso,
    updatedAt: nowIso,
    auditTrail: [auditEntry],
  };

  await saveProductOffer(offer);
  return {
    productId,
    createdNewCatalogProduct,
    offer,
  };
}

/**
 * Separated Product/Offer Approval (Section 5 & 6):
 * Approves, rejects, or returns for adjustments a `ProductOfferRecord`.
 * Note: Approving an own product transitions it to `aprovado_para_compra` (it still requires
 * Purchase Approval and Physical Receipt before gaining stock!).
 * Approving a partner offer transitions it to `aprovado` (awaiting custody entry or availability confirmation).
 */
export async function authorizeProductOffer(
  offer: ProductOfferRecord,
  decision: 'approve' | 'reject' | 'return_for_adjustment',
  actor: PurchasingActor,
  comment: string,
): Promise<ProductOfferRecord> {
  const nowIso = new Date().toISOString();
  const isOwn = offer.originChannel === 'mercado_proprio';

  let nextOwnStatus = offer.ownLifecycleStatus;
  let nextPartnerStatus = offer.partnerLifecycleStatus;

  if (isOwn) {
    nextOwnStatus =
      decision === 'approve'
        ? 'aprovado_para_compra'
        : decision === 'reject'
        ? 'rejeitado'
        : 'devolvido_para_ajustes';
  } else {
    nextPartnerStatus =
      decision === 'approve'
        ? 'aprovado'
        : decision === 'reject'
        ? 'rejeitado'
        : 'devolvido_para_ajustes';
  }

  const label =
    decision === 'approve'
      ? isOwn
        ? 'Produto aprovado para compra (Aprovação de Produto concluída)'
        : 'Oferta de parceiro aprovada'
      : decision === 'reject'
      ? 'Produto/Oferta rejeitado'
      : 'Devolvido para ajustes';

  const auditEntry = buildAuditEntry(actor, label, {
    comment: comment.trim(),
    afterSummary: isOwn
      ? `Novo estado: ${nextOwnStatus} (Estoque permanece 0 até recebimento físico)`
      : `Novo estado: ${nextPartnerStatus}`,
  });

  const updated: ProductOfferRecord = {
    ...offer,
    ownLifecycleStatus: nextOwnStatus,
    partnerLifecycleStatus: nextPartnerStatus,
    approvedBy: decision === 'approve' ? actor.uid : offer.approvedBy,
    approvedByName: decision === 'approve' ? actor.name : offer.approvedByName,
    approvedAt: decision === 'approve' ? nowIso : offer.approvedAt,
    approvalComment: decision === 'approve' ? comment.trim() : offer.approvalComment,
    rejectedReason: decision !== 'approve' ? comment.trim() : offer.rejectedReason,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(offer.auditTrail || [])],
  };

  return saveProductOffer(updated);
}

/**
 * Confirms/Refreshes partner external availability (`parceiro_retirada_estabelecimento`),
 * setting `availabilityConfirmedAt` and computing `availabilityExpiresAt` from TTL hours.
 */
export async function confirmPartnerOfferAvailability(
  offer: ProductOfferRecord,
  reportedQty: number,
  ttlHours: number,
  actor: PurchasingActor,
  note?: string,
): Promise<ProductOfferRecord> {
  if (offer.originChannel !== 'parceiro_retirada_estabelecimento') {
    throw new Error(
      'Confirmação de disponibilidade externa aplica-se apenas ao modelo Retirada no Parceiro.',
    );
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const safeTtl = Math.max(1, Math.floor(Number(ttlHours) || 24));
  const expiresIso = new Date(now.getTime() + safeTtl * 3_600_000).toISOString();
  const safeQty = Math.max(0, Math.floor(Number(reportedQty) || 0));

  const nextStatus: PartnerOfferLifecycleStatus =
    safeQty > 0 ? 'ativo' : 'pausado_indisponivel';

  const auditEntry = buildAuditEntry(
    actor,
    `Disponibilidade no parceiro confirmada: ${safeQty} ${offer.unit} (válida por ${safeTtl}h)`,
    {
      comment: note?.trim(),
      afterSummary: `Status: ${nextStatus} • Expira em ${new Date(expiresIso).toLocaleString('pt-BR')}`,
    },
  );

  const updated: ProductOfferRecord = {
    ...offer,
    partnerReportedAvailableQty: safeQty,
    availabilityConfirmedAt: nowIso,
    availabilityExpiresAt: expiresIso,
    partnerLifecycleStatus: nextStatus,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(offer.auditTrail || [])],
  };

  // Sync active status on catalog product (without adding to Mercado's physical stock!)
  try {
    await setDoc(
      doc(db, 'products', offer.productId),
      {
        active: safeQty > 0,
        price: offer.salePrice,
        supplyOriginChannel: offer.originChannel,
        stockOwnership: 'parceiro',
        partnerId: offer.partnerId,
        partnerName: offer.partnerName,
        partnerAvailableQty: safeQty,
        partnerAvailabilityExpiresAt: expiresIso,
        updatedAt: nowIso,
      },
      { merge: true },
    );
  } catch (err) {
    logLocalCacheFallback('Sincronização de disponibilidade no catálogo local', err);
  }

  return saveProductOffer(updated);
}

// ─── Partner Consigned Custody Movements (`custody_movements`) ──────────────

export async function listCustodyMovements(): Promise<CustodyMovementRecord[]> {
  try {
    const q = query(collection(db, CUSTODY_MOVEMENTS_COL), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    const list: CustodyMovementRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as CustodyMovementRecord;
      if (data && data.offerId) {
        list.push({ ...data, id: d.id });
      }
    });
    writeLocalCache(LS_CUSTODY_KEY, list);
    return list;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de custódia consignada', err);
    return readLocalCache<CustodyMovementRecord[]>(LS_CUSTODY_KEY, []);
  }
}

/**
 * Records a physical custody movement for a Consigned Partner Product (`parceiro_consignado_mercado`).
 * CRITICAL INVARIANT: Updates `consignedPhysicalQty` / `consignedAvailableQty` on the offer,
 * and NEVER adds to Mercado's own purchase outlay or Mercado's own inventory valuation.
 */
export async function recordPartnerCustodyMovement(
  offer: ProductOfferRecord,
  payload: {
    movementType: CustodyMovementType;
    quantity: number;
    custodyLocation?: string;
    custodianName?: string;
    orderId?: string | null;
    notes: string;
  },
  actor: PurchasingActor,
): Promise<{
  updatedOffer: ProductOfferRecord;
  movement: CustodyMovementRecord;
}> {
  const nowIso = new Date().toISOString();
  const prevPhysical = offer.consignedPhysicalQty || 0;
  const calc = applyCustodyMovementToOffer(offer, payload.movementType, payload.quantity);

  const movementId = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const movement: CustodyMovementRecord = {
    id: movementId,
    offerId: offer.id,
    productId: offer.productId,
    productTitle: offer.productTitle,
    partnerId: offer.partnerId || '',
    partnerName: offer.partnerName || 'Parceiro',
    movementType: payload.movementType,
    deltaQty: calc.signedDelta,
    previousQty: prevPhysical,
    newQty: calc.consignedPhysicalQty,
    custodyLocation: (
      payload.custodyLocation ||
      offer.custodyLocation ||
      'Área Consignada do Mercado'
    ).trim(),
    custodianName: (payload.custodianName || offer.custodianName || actor.name).trim(),
    orderId: payload.orderId || null,
    notes: payload.notes.trim(),
    timestamp: nowIso,
    actorUid: actor.uid,
    actorName: actor.name,
  };

  const cachedMovements = readLocalCache<CustodyMovementRecord[]>(LS_CUSTODY_KEY, []);
  writeLocalCache(LS_CUSTODY_KEY, [movement, ...cachedMovements]);

  try {
    await setDoc(doc(db, CUSTODY_MOVEMENTS_COL, movementId), movement);
  } catch (err) {
    logLocalCacheFallback('Movimento de custódia salvo localmente', err);
  }

  const nextPartnerStatus: PartnerOfferLifecycleStatus =
    calc.consignedAvailableQty > 0 ? 'ativo' : 'pausado_indisponivel';

  const auditEntry = buildAuditEntry(
    actor,
    `Movimento de Custódia Consignada (${payload.movementType}): ${calc.signedDelta >= 0 ? `+${calc.signedDelta}` : calc.signedDelta} ${offer.unit}`,
    {
      comment: payload.notes.trim(),
      beforeSummary: `Custódia física anterior: ${prevPhysical} ${offer.unit}`,
      afterSummary: `Custódia física atual: ${calc.consignedPhysicalQty} ${offer.unit} (Disponível: ${calc.consignedAvailableQty}) • Propriedade: PARCEIRO`,
    },
  );

  const updatedOffer: ProductOfferRecord = {
    ...offer,
    consignedPhysicalQty: calc.consignedPhysicalQty,
    consignedReservedQty: calc.consignedReservedQty,
    consignedAvailableQty: calc.consignedAvailableQty,
    consignedDamagedOrLostQty: calc.consignedDamagedOrLostQty,
    custodyLocation: movement.custodyLocation,
    custodianName: movement.custodianName,
    partnerLifecycleStatus: nextPartnerStatus,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(offer.auditTrail || [])],
  };

  await saveProductOffer(updatedOffer);

  return { updatedOffer, movement };
}

/**
 * Updates an existing ProductOfferRecord with Post-Approval Revalidation guard.
 */
export async function updateProductOfferWithGuard(
  existing: ProductOfferRecord,
  changes: Partial<ProductOfferRecord>,
  actor: PurchasingActor,
  reasonNote?: string,
): Promise<{
  offer: ProductOfferRecord;
  approvalInvalidated: boolean;
  invalidationReasons: string[];
}> {
  const nowIso = new Date().toISOString();
  const check = evaluatePostApprovalOfferChange(existing, changes);

  const isOwn = (changes.originChannel || existing.originChannel) === 'mercado_proprio';
  let nextOwnStatus = changes.ownLifecycleStatus ?? existing.ownLifecycleStatus;
  let nextPartnerStatus =
    changes.partnerLifecycleStatus ?? existing.partnerLifecycleStatus;

  if (check.invalidatesApproval) {
    if (isOwn) nextOwnStatus = 'aguardando_aprovacao_produto';
    else nextPartnerStatus = 'aguardando_aprovacao_parceiro_produto';
  }

  const auditEntry = buildAuditEntry(
    actor,
    check.invalidatesApproval
      ? 'Alteração crítica após aprovação invalidou autorização do produto/oferta (Requer nova aprovação)'
      : 'Dados da oferta/produto atualizados',
    {
      comment: check.invalidatesApproval
        ? check.reasons.join(' | ')
        : reasonNote?.trim(),
    },
  );

  const updated: ProductOfferRecord = {
    ...existing,
    ...changes,
    ownLifecycleStatus: nextOwnStatus,
    partnerLifecycleStatus: nextPartnerStatus,
    updatedAt: nowIso,
    auditTrail: [auditEntry, ...(existing.auditTrail || [])],
  };

  await saveProductOffer(updated);
  return {
    offer: updated,
    approvalInvalidated: check.invalidatesApproval,
    invalidationReasons: check.reasons,
  };
}

// ─── Partner Settlements (`partner_settlements`) ────────────────────────────

export async function listPartnerSettlements(): Promise<PartnerSettlementRecord[]> {
  try {
    const q = query(
      collection(db, PARTNER_SETTLEMENTS_COL),
      orderBy('updatedAt', 'desc'),
    );
    const snap = await getDocs(q);
    const list: PartnerSettlementRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as PartnerSettlementRecord;
      if (data && data.partnerId) {
        list.push({ ...data, id: d.id });
      }
    });
    writeLocalCache(LS_SETTLEMENTS_KEY, list);
    return list;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de repasses de parceiros', err);
    return readLocalCache<PartnerSettlementRecord[]>(LS_SETTLEMENTS_KEY, []);
  }
}

export async function upsertPartnerSettlement(
  record: PartnerSettlementRecord,
  actor: PurchasingActor,
): Promise<PartnerSettlementRecord> {
  const nowIso = new Date().toISOString();
  const next: PartnerSettlementRecord = {
    ...record,
    updatedAt: nowIso,
    settledAt:
      record.status === 'liquidado' ? record.settledAt || nowIso : record.settledAt,
    settledByName:
      record.status === 'liquidado' ? actor.name : record.settledByName,
  };

  const cached = readLocalCache<PartnerSettlementRecord[]>(LS_SETTLEMENTS_KEY, []);
  writeLocalCache(
    LS_SETTLEMENTS_KEY,
    [next, ...cached.filter((s) => s.id !== next.id)],
  );

  try {
    await setDoc(doc(db, PARTNER_SETTLEMENTS_COL, next.id), next, { merge: true });
  } catch (err) {
    logLocalCacheFallback('Liquidação de parceiro salva localmente', err);
  }
  return next;
}

export async function updatePartnerSettlementStatus(
  settlement: PartnerSettlementRecord,
  newStatus: PartnerSettlementStatus,
  paymentReference: string,
  actor: PurchasingActor,
): Promise<PartnerSettlementRecord> {
  return upsertPartnerSettlement(
    {
      ...settlement,
      status: newStatus,
      paymentReference: paymentReference.trim() || settlement.paymentReference || null,
    },
    actor,
  );
}

// ─── Order Courier Pickup Tasks (`order_fulfillment_tasks`) ─────────────────

export async function listOrderPickupTasks(): Promise<OrderPickupTaskRecord[]> {
  try {
    const q = query(
      collection(db, ORDER_PICKUP_TASKS_COL),
      orderBy('updatedAt', 'desc'),
    );
    const snap = await getDocs(q);
    const list: OrderPickupTaskRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as OrderPickupTaskRecord;
      if (data && data.orderId) {
        list.push({
          ...data,
          id: d.id,
          timeline: Array.isArray(data.timeline) ? data.timeline : [],
        });
      }
    });
    writeLocalCache(LS_PICKUP_TASKS_KEY, list);
    return list;
  } catch (err) {
    logLocalCacheFallback('Utilizando cache local de tarefas de coleta', err);
    return readLocalCache<OrderPickupTaskRecord[]>(LS_PICKUP_TASKS_KEY, []);
  }
}

export async function upsertOrderPickupTask(
  input: {
    orderId: string;
    orderNumber?: string;
    productId: string;
    productTitle: string;
    quantity: number;
    originChannel: SupplyOriginChannel;
    partnerId?: string;
    partnerName?: string;
    pickupAddress?: string;
    pickupInstructions?: string;
    assignedCourierName?: string | null;
    pickupStatus: CourierPickupStatus;
    note?: string;
  },
  actor: PurchasingActor,
): Promise<OrderPickupTaskRecord> {
  const nowIso = new Date().toISOString();
  const id = `pk_${input.orderId}_${input.productId}`;
  const cached = readLocalCache<OrderPickupTaskRecord[]>(LS_PICKUP_TASKS_KEY, []);
  const existing = cached.find((t) => t.id === id);

  const event = {
    timestamp: nowIso,
    status: input.pickupStatus,
    actorName: actor.name,
    note: input.note?.trim(),
  };

  const record: OrderPickupTaskRecord = {
    id,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    productId: input.productId,
    productTitle: input.productTitle,
    quantity: input.quantity,
    originChannel: input.originChannel,
    ownership: input.originChannel === 'mercado_proprio' ? 'mercado' : 'parceiro',
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    pickupAddress: input.pickupAddress,
    pickupInstructions: input.pickupInstructions,
    assignedCourierName:
      input.assignedCourierName !== undefined
        ? input.assignedCourierName
        : existing?.assignedCourierName || null,
    pickupStatus: input.pickupStatus,
    divergenceNote:
      input.pickupStatus === 'divergencia_coleta'
        ? input.note?.trim() || existing?.divergenceNote || null
        : existing?.divergenceNote || null,
    updatedAt: nowIso,
    updatedByName: actor.name,
    timeline: [event, ...(existing?.timeline || [])],
  };

  writeLocalCache(
    LS_PICKUP_TASKS_KEY,
    [record, ...cached.filter((t) => t.id !== id)],
  );

  try {
    await setDoc(doc(db, ORDER_PICKUP_TASKS_COL, id), record, { merge: true });
  } catch (err) {
    logLocalCacheFallback('Tarefa de coleta salva localmente', err);
  }
  return record;
}
