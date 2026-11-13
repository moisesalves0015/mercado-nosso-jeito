import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { publicCallable } from '../invoker';
import { permissionsAllow } from './permissions';
import { requireAnyPermission, requirePermission, requireReason, StaffAccess } from './rbac';
import { writeAudit } from './audit';

const db = () => admin.firestore();
const HttpsError = functions.https.HttpsError;

function str(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpsError('invalid-argument', `${field} inválido (${min}–${max} caracteres).`);
  }
  return value.trim();
}

function optStr(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function toMillis(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof val === 'object' && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return null;
}

function maskCpf(cpf: unknown): string | null {
  if (typeof cpf !== 'string') return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `***.***.***-${digits.slice(-2)}`;
}

function maskEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `****-${digits.slice(-4)}`;
}

function hasAny(access: StaffAccess, perms: string[]): boolean {
  return perms.some((p) => permissionsAllow(access.permissions, p));
}

function sanitizeOrderForAccess(id: string, data: Record<string, unknown>, access: StaffAccess) {
  const canSeeContact = hasAny(access, ['pedidos:view', 'clientes:view', 'suporte:view', 'financeiro:view']);
  const addr = (data.address as Record<string, unknown> | undefined) ?? undefined;
  return {
    id,
    orderNumber: data.orderNumber ?? null,
    uid: data.uid ?? null,
    userName: data.userName ?? null,
    userEmail: canSeeContact ? (data.userEmail ?? null) : maskEmail(data.userEmail),
    userPhone: canSeeContact ? (data.userPhone ?? null) : maskPhone(data.userPhone),
    status: data.status ?? 'pending',
    paymentStatus: data.paymentStatus ?? 'pending',
    paymentMethod: data.paymentMethod ?? null,
    paymentReference: data.paymentReference ?? null,
    paymentNote: data.paymentNote ?? null,
    subtotal: Number(data.subtotal ?? 0),
    shippingFee: Number(data.shippingFee ?? 0),
    discountValue: Number(data.discountValue ?? 0),
    couponCode: data.couponCode ?? null,
    total: Number(data.total ?? 0),
    deliveryMethod: data.deliveryMethod ?? null,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    paidAt: toMillis(data.paidAt),
    confirmedBy: data.confirmedBy ?? null,
    cancelledBy: data.cancelledBy ?? null,
    cancellationReason: data.cancellationReason ?? null,
    items: Array.isArray(data.items) ? data.items : [],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    address: addr
      ? {
          condominio: addr.condominio ?? null,
          bloco: addr.bloco ?? null,
          apartamento: addr.apartamento ?? null,
          street: canSeeContact ? (addr.street ?? null) : null,
          number: canSeeContact ? (addr.number ?? null) : null,
          complement: canSeeContact ? (addr.complement ?? null) : null,
          neighborhood: addr.neighborhood ?? null,
          city: addr.city ?? null,
          state: addr.state ?? null,
          zipCode: canSeeContact ? (addr.zipCode ?? null) : null,
          referencia: canSeeContact ? (addr.referencia ?? null) : null,
          apelido: addr.apelido ?? null,
        }
      : undefined,
  };
}

function sanitizeCustomerListRow(id: string, data: Record<string, unknown>, access: StaffAccess) {
  const canSeeContact = hasAny(access, ['clientes:view', 'suporte:view']);
  return {
    id,
    name: data.name ?? '',
    email: canSeeContact ? (data.email ?? '') : (maskEmail(data.email) ?? ''),
    telefone: canSeeContact ? (data.telefone ?? undefined) : (maskPhone(data.telefone) ?? undefined),
    // Never expose raw CPF in list endpoints
    cpfMasked: maskCpf(data.cpf),
    role: data.role ?? 'client',
    diamonds: Number(data.diamonds ?? 0),
    createdAt: toMillis(data.createdAt),
    lastLogin: toMillis(data.lastLogin),
    bannedAt: toMillis(data.bannedAt),
    banReason: data.banReason ?? undefined,
    firstOrderPlaced: Boolean(data.firstOrderPlaced),
  };
}

function sanitizeProductRow(id: string, data: Record<string, unknown>, access: StaffAccess) {
  const canSeeCost = hasAny(access, ['produtos:edit', 'financeiro:view']);
  return {
    id,
    title: data.title ?? '',
    price: Number(data.price ?? 0),
    costPrice: canSeeCost && data.costPrice !== undefined ? Number(data.costPrice) : undefined,
    oldPrice: data.oldPrice !== undefined ? Number(data.oldPrice) : undefined,
    category: data.category ?? 'Outros',
    stock: Number(data.stock ?? 0),
    minStock: data.minStock !== undefined ? Number(data.minStock) : undefined,
    sku: data.sku ?? undefined,
    ean: data.ean ?? undefined,
    unit: data.unit ?? undefined,
    weight: data.weight ?? undefined,
    supplier: canSeeCost ? (data.supplier ?? undefined) : undefined,
    location: data.location ?? undefined,
    image: data.image ?? '',
    description: data.description ?? undefined,
    active: data.active !== false,
    featured: Boolean(data.featured),
    tags: data.tags ?? undefined,
    InternalNotes: canSeeCost ? (data.InternalNotes ?? undefined) : undefined,
    updatedAt: data.updatedAt ?? undefined,
    stockHistory: Array.isArray(data.stockHistory) ? data.stockHistory : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Read Callables (paginated + RBAC + PII minimized)
// ─────────────────────────────────────────────────────────────────────────────

export const adminListOrders = publicCallable.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, [
    'pedidos:view',
    'financeiro:view',
    'suporte:view',
  ]);
  const req = (data ?? {}) as { limit?: unknown; startAfterMillis?: unknown; status?: unknown; paymentStatus?: unknown };
  const limit = Math.min(Math.max(Number(req.limit) || 50, 1), 100);

  let q: FirebaseFirestore.Query = db().collection('orders');
  if (typeof req.status === 'string' && req.status.trim()) {
    q = q.where('status', '==', req.status.trim());
  } else if (typeof req.paymentStatus === 'string' && req.paymentStatus.trim()) {
    q = q.where('paymentStatus', '==', req.paymentStatus.trim());
  }
  q = q.orderBy('createdAt', 'desc');
  if (typeof req.startAfterMillis === 'number' && Number.isFinite(req.startAfterMillis)) {
    q = q.startAfter(admin.firestore.Timestamp.fromMillis(req.startAfterMillis));
  }
  const snap = await q.limit(limit).get();

  const orders = snap.docs.map((d) => sanitizeOrderForAccess(d.id, d.data() as Record<string, unknown>, access));
  const last = snap.docs.length === limit ? snap.docs[snap.docs.length - 1] : null;
  const nextCursor = last ? toMillis((last.data() as Record<string, unknown>).createdAt) : null;

  return { orders, nextCursor };
});

export const adminGetOrder = publicCallable.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['pedidos:view', 'financeiro:view', 'suporte:view']);
  const req = (data ?? {}) as { orderId?: unknown };
  const orderId = str(req.orderId, 'orderId', 1, 128);
  const snap = await db().collection('orders').doc(orderId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
  return { order: sanitizeOrderForAccess(snap.id, snap.data() as Record<string, unknown>, access) };
});

export const adminListCustomers = publicCallable.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['clientes:view', 'crm:view', 'suporte:view']);
  const req = (data ?? {}) as { limit?: unknown; startAfterId?: unknown };
  const limit = Math.min(Math.max(Number(req.limit) || 50, 1), 100);

  let q: FirebaseFirestore.Query = db().collection('users').orderBy(admin.firestore.FieldPath.documentId());
  if (typeof req.startAfterId === 'string' && req.startAfterId.trim()) {
    q = q.startAfter(req.startAfterId.trim());
  }
  const snap = await q.limit(limit).get();
  const customers = snap.docs.map((d) => sanitizeCustomerListRow(d.id, d.data() as Record<string, unknown>, access));
  const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;
  return { customers, nextCursor };
});

export const adminGetCustomer = publicCallable.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['clientes:view', 'crm:view', 'suporte:view']);
  const req = (data ?? {}) as { customerId?: unknown };
  const customerId = str(req.customerId, 'customerId', 1, 128);

  const [userSnap, addrSnap, clubeSnap] = await Promise.all([
    db().collection('users').doc(customerId).get(),
    db().collection('users').doc(customerId).collection('addresses').get(),
    db().collection('users').doc(customerId).collection('clube').doc('profile').get(),
  ]);

  if (!userSnap.exists) throw new HttpsError('not-found', 'Cliente não encontrado.');
  const profile = sanitizeCustomerListRow(userSnap.id, userSnap.data() as Record<string, unknown>, access);
  const addresses = addrSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  const clube = clubeSnap.exists
    ? {
        diamonds: Number((clubeSnap.data() as Record<string, unknown>).diamonds ?? 0),
        streak: Number((clubeSnap.data() as Record<string, unknown>).streak ?? 0),
      }
    : null;

  return { customer: profile, addresses, clube };
});

export const adminListProducts = publicCallable.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, [
    'produtos:view',
    'estoque:view',
  ]);
  const req = (data ?? {}) as { limit?: unknown; startAfterId?: unknown };
  const limit = Math.min(Math.max(Number(req.limit) || 100, 1), 200);

  let q: FirebaseFirestore.Query = db().collection('products').orderBy(admin.firestore.FieldPath.documentId());
  if (typeof req.startAfterId === 'string' && req.startAfterId.trim()) {
    q = q.startAfter(req.startAfterId.trim());
  }
  const snap = await q.limit(limit).get();
  const products = snap.docs.map((d) => sanitizeProductRow(d.id, d.data() as Record<string, unknown>, access));
  const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;
  return { products, nextCursor };
});

export const adminListTickets = publicCallable.https.onCall(async (data, context) => {
  await requirePermission(context.auth, 'suporte:view');
  const req = (data ?? {}) as { limit?: unknown; startAfterMillis?: unknown };
  const limit = Math.min(Math.max(Number(req.limit) || 50, 1), 100);

  let q: FirebaseFirestore.Query = db().collection('support_tickets').orderBy('createdAt', 'desc');
  if (typeof req.startAfterMillis === 'number' && Number.isFinite(req.startAfterMillis)) {
    q = q.startAfter(admin.firestore.Timestamp.fromMillis(req.startAfterMillis));
  }
  const snap = await q.limit(limit).get();
  const tickets = snap.docs.map((d) => {
    const raw = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      ...raw,
      createdAt: toMillis(raw.createdAt),
      updatedAt: toMillis(raw.updatedAt),
    };
  });
  const last = snap.docs.length === limit ? snap.docs[snap.docs.length - 1] : null;
  const nextCursor = last ? toMillis((last.data() as Record<string, unknown>).createdAt) : null;
  return { tickets, nextCursor };
});

export const adminGetTicket = publicCallable.https.onCall(async (data, context) => {
  await requirePermission(context.auth, 'suporte:view');
  const req = (data ?? {}) as { ticketId?: unknown };
  const ticketId = str(req.ticketId, 'ticketId', 1, 128);
  const snap = await db().collection('support_tickets').doc(ticketId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
  const raw = snap.data() as Record<string, unknown>;
  return {
    ticket: {
      id: snap.id,
      ...raw,
      createdAt: toMillis(raw.createdAt),
      updatedAt: toMillis(raw.updatedAt),
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Audited Write Callables (Products, Settings, Loyalty Config)
// ─────────────────────────────────────────────────────────────────────────────

export const adminUpsertProduct = publicCallable.https.onCall(async (data, context) => {
  const req = (data ?? {}) as Record<string, unknown>;
  const isCreate = !req.productId || (typeof req.productId === 'string' && !req.productId.trim());
  const actor = await requirePermission(context.auth, isCreate ? 'produtos:create' : 'produtos:edit');

  const title = str(req.title, 'title', 2, 140);
  const price = Number(req.price);
  if (!Number.isFinite(price) || price <= 0 || price > 100_000) {
    throw new HttpsError('invalid-argument', 'price deve ser maior que zero.');
  }
  const category = str(req.category, 'category', 2, 60);
  const costPrice = req.costPrice !== undefined && req.costPrice !== null && req.costPrice !== '' ? Number(req.costPrice) : undefined;
  if (costPrice !== undefined && (!Number.isFinite(costPrice) || costPrice < 0)) {
    throw new HttpsError('invalid-argument', 'costPrice inválido.');
  }
  const oldPrice = req.oldPrice !== undefined && req.oldPrice !== null && req.oldPrice !== '' ? Number(req.oldPrice) : undefined;
  if (oldPrice !== undefined && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
    throw new HttpsError('invalid-argument', 'oldPrice inválido.');
  }
  const minStock = req.minStock !== undefined && req.minStock !== null ? Number(req.minStock) : undefined;
  if (minStock !== undefined && (!Number.isInteger(minStock) || minStock < 0)) {
    throw new HttpsError('invalid-argument', 'minStock deve ser inteiro não negativo.');
  }

  // Never allow stock overwrite on existing products (must use adminAdjustStock)
  if (!isCreate && req.stock !== undefined) {
    throw new HttpsError('invalid-argument', 'Alteração direta de estoque é proibida aqui; use adminAdjustStock.');
  }

  const productId = isCreate ? db().collection('products').doc().id : str(req.productId, 'productId', 1, 128);
  const nowIso = new Date().toISOString();

  return db().runTransaction(async (tx) => {
    const ref = db().collection('products').doc(productId);
    const snap = await tx.get(ref);
    if (isCreate && snap.exists) {
      throw new HttpsError('already-exists', 'Produto já existe.');
    }
    if (!isCreate && !snap.exists) {
      throw new HttpsError('not-found', 'Produto não encontrado.');
    }

    const prev = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    const payload: Record<string, unknown> = {
      id: productId,
      title,
      price,
      category,
      active: req.active === undefined ? (prev?.active ?? true) : req.active === true,
      featured: req.featured === undefined ? Boolean(prev?.featured) : req.featured === true,
      image: optStr(req.image, 1024) ?? (prev?.image as string | undefined) ?? '',
      updatedAt: nowIso,
      updatedBy: actor.uid,
    };

    if (costPrice !== undefined) payload.costPrice = costPrice;
    if (oldPrice !== undefined) payload.oldPrice = oldPrice;
    if (minStock !== undefined) payload.minStock = minStock;
    const optionalTextFields = ['description', 'unit', 'weight', 'sku', 'ean', 'supplier', 'location', 'tags', 'InternalNotes'] as const;
    for (const f of optionalTextFields) {
      const val = optStr(req[f], 2000);
      if (val !== undefined) payload[f] = val;
    }
    if (Array.isArray(req.flags)) {
      payload.flags = req.flags.filter((x): x is string => typeof x === 'string').slice(0, 12);
    }

    if (isCreate) {
      const initialStock = req.initialStock !== undefined ? Number(req.initialStock) : 0;
      if (!Number.isInteger(initialStock) || initialStock < 0 || initialStock > 100_000) {
        throw new HttpsError('invalid-argument', 'initialStock inválido.');
      }
      payload.stock = initialStock;
      payload.createdAt = nowIso;
      payload.createdBy = actor.uid;
      tx.set(ref, payload);
    } else {
      tx.update(ref, payload);
    }

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: isCreate ? 'product.create' : 'product.update',
        module: 'produtos',
        entityType: 'product',
        entityId: productId,
        before: prev ? { title: prev.title, price: prev.price, active: prev.active, category: prev.category } : null,
        after: { title, price, active: payload.active, category },
        result: 'success',
        source: 'callable',
      },
      tx,
    );

    return { success: true, productId };
  });
});

export const adminArchiveProduct = publicCallable.https.onCall(async (data, context) => {
  const actor = await requireAnyPermission(context.auth, ['produtos:archive', 'produtos:edit']);
  const req = (data ?? {}) as { productId?: unknown; reason?: unknown };
  const productId = str(req.productId, 'productId', 1, 128);
  const reason = requireReason(req.reason, 5, 300);

  return db().runTransaction(async (tx) => {
    const ref = db().collection('products').doc(productId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Produto não encontrado.');
    const prev = snap.data() as Record<string, unknown>;
    const nowIso = new Date().toISOString();

    tx.update(ref, {
      active: false,
      archivedAt: nowIso,
      archivedBy: actor.uid,
      archiveReason: reason,
      updatedAt: nowIso,
    });

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: 'product.archive',
        module: 'produtos',
        entityType: 'product',
        entityId: productId,
        reason,
        before: { active: prev.active !== false },
        after: { active: false, archiveReason: reason },
        result: 'success',
        source: 'callable',
      },
      tx,
    );

    return { success: true, productId };
  });
});

export const adminToggleProductActive = publicCallable.https.onCall(async (data, context) => {
  const actor = await requirePermission(context.auth, 'produtos:edit');
  const req = (data ?? {}) as { productId?: unknown; active?: unknown };
  const productId = str(req.productId, 'productId', 1, 128);
  if (typeof req.active !== 'boolean') {
    throw new HttpsError('invalid-argument', 'active deve ser booleano.');
  }
  const nextActive = req.active;

  return db().runTransaction(async (tx) => {
    const ref = db().collection('products').doc(productId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Produto não encontrado.');
    const prev = snap.data() as Record<string, unknown>;
    const prevActive = prev.active !== false;

    tx.update(ref, {
      active: nextActive,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.uid,
    });

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: 'product.toggle_active',
        module: 'produtos',
        entityType: 'product',
        entityId: productId,
        before: { active: prevActive },
        after: { active: nextActive },
        result: 'success',
        source: 'callable',
      },
      tx,
    );

    return { success: true, productId, active: nextActive };
  });
});

export const adminUpdateSettings = publicCallable.https.onCall(async (data, context) => {
  const actor = await requirePermission(context.auth, 'configuracoes:edit');
  const req = (data ?? {}) as { settingId?: unknown; payload?: unknown; reason?: unknown };
  const settingId = req.settingId;
  if (settingId !== 'store' && settingId !== 'shipping') {
    throw new HttpsError('invalid-argument', "settingId deve ser 'store' ou 'shipping'.");
  }
  if (!req.payload || typeof req.payload !== 'object' || Array.isArray(req.payload)) {
    throw new HttpsError('invalid-argument', 'payload inválido.');
  }
  const p = req.payload as Record<string, unknown>;
  let clean: Record<string, unknown>;

  if (settingId === 'store') {
    clean = {
      pixKey: optStr(p.pixKey, 140) ?? '',
      pixName: optStr(p.pixName, 140) ?? '',
      pixBank: optStr(p.pixBank, 100) ?? '',
      storePhone: optStr(p.storePhone, 40) ?? '',
      storeName: optStr(p.storeName, 120) ?? 'Mercado Nosso Jeito',
      supportHours: optStr(p.supportHours, 120) ?? 'Seg a Sáb • 08h às 22h',
    };
  } else {
    const freeShippingThreshold = Number(p.freeShippingThreshold);
    const baseShippingFee = Number(p.baseShippingFee);
    if (!Number.isFinite(freeShippingThreshold) || freeShippingThreshold < 0) {
      throw new HttpsError('invalid-argument', 'freeShippingThreshold inválido.');
    }
    if (!Number.isFinite(baseShippingFee) || baseShippingFee < 0) {
      throw new HttpsError('invalid-argument', 'baseShippingFee inválido.');
    }
    const condos: Record<string, number> = {};
    if (p.condos && typeof p.condos === 'object' && !Array.isArray(p.condos)) {
      for (const [k, v] of Object.entries(p.condos as Record<string, unknown>)) {
        const fee = Number(v);
        if (!Number.isFinite(fee) || fee < 0) {
          throw new HttpsError('invalid-argument', `Taxa inválida para condomínio ${k}.`);
        }
        if (k.trim()) condos[k.trim().slice(0, 100)] = fee;
      }
    }
    clean = { freeShippingThreshold, baseShippingFee, condos };
  }

  return db().runTransaction(async (tx) => {
    const ref = db().collection('settings').doc(settingId);
    const snap = await tx.get(ref);
    const prev = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    tx.set(ref, { ...clean, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: `settings.update.${settingId}`,
        module: 'configuracoes',
        entityType: 'settings',
        entityId: settingId,
        reason: optStr(req.reason, 200),
        before: prev,
        after: clean,
        result: 'success',
        source: 'callable',
      },
      tx,
    );
    return { success: true, settingId };
  });
});

export const adminUpdateLoyaltyConfig = publicCallable.https.onCall(async (data, context) => {
  const actor = await requirePermission(context.auth, 'clube:edit');
  const req = (data ?? {}) as { payload?: unknown; reason?: unknown };
  if (!req.payload || typeof req.payload !== 'object' || Array.isArray(req.payload)) {
    throw new HttpsError('invalid-argument', 'payload inválido.');
  }
  const p = req.payload as Record<string, unknown>;
  const spinCost = p.spinCost !== undefined ? Number(p.spinCost) : undefined;
  const dailyFreeSpins = p.dailyFreeSpins !== undefined ? Number(p.dailyFreeSpins) : undefined;
  const dailyLimit = p.dailyLimit !== undefined ? Number(p.dailyLimit) : undefined;
  if (spinCost !== undefined && (!Number.isInteger(spinCost) || spinCost < 0 || spinCost > 10_000)) {
    throw new HttpsError('invalid-argument', 'spinCost inválido.');
  }
  if (dailyFreeSpins !== undefined && (!Number.isInteger(dailyFreeSpins) || dailyFreeSpins < 0 || dailyFreeSpins > 20)) {
    throw new HttpsError('invalid-argument', 'dailyFreeSpins inválido.');
  }
  if (dailyLimit !== undefined && (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 20)) {
    throw new HttpsError('invalid-argument', 'dailyLimit inválido.');
  }

  const clean: Record<string, unknown> = {};
  if (spinCost !== undefined) clean.spinCost = spinCost;
  if (dailyFreeSpins !== undefined) clean.dailyFreeSpins = dailyFreeSpins;
  if (dailyLimit !== undefined) clean.dailyLimit = dailyLimit;
  if (Array.isArray(p.prizes)) clean.prizes = p.prizes.slice(0, 24);
  if (typeof p.active === 'boolean') clean.active = p.active;

  return db().runTransaction(async (tx) => {
    const ref = db().collection('configs').doc('roleta');
    const snap = await tx.get(ref);
    const prev = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    tx.set(ref, { ...clean, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: 'clube.update_config',
        module: 'clube',
        entityType: 'config',
        entityId: 'roleta',
        reason: optStr(req.reason, 200),
        before: prev,
        after: clean,
        result: 'success',
        source: 'callable',
      },
      tx,
    );
    return { success: true };
  });
});
