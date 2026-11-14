import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ProductAuditChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
}

export type ProductAuditOperation =
  | 'create'
  | 'update'
  | 'toggle_active'
  | 'archive'
  | 'stock_adjust';

export interface ProductAuditRecord {
  id?: string;
  productId: string;
  productTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  operation: ProductAuditOperation;
  changes: ProductAuditChange[];
  note?: string;
  timestamp?: Timestamp | string | number | null;
  createdAt?: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Título do Produto',
  description: 'Descrição',
  category: 'Categoria',
  price: 'Preço de Venda',
  costPrice: 'Preço de Custo',
  oldPrice: 'Preço Anterior',
  stock: 'Estoque Físico',
  minStock: 'Estoque Mínimo',
  sku: 'Código SKU',
  ean: 'Código EAN / Barras',
  active: 'Status de Ativação',
  featured: 'Destaque na Vitrine',
  diamondReward: 'Recompensa em Diamantes',
  promoActive: 'Promoção Ativa',
  promoDiscount: 'Desconto Promocional (%)',
  promoPrice: 'Preço Promocional',
  promoExpiry: 'Validade da Promoção',
  availableInRoulette: 'Disponível na Roleta',
  tags: 'Tags / Palavras-chave',
  badge: 'Etiqueta Visual',
  badgeStyle: 'Estilo da Etiqueta',
  image: 'Imagem Principal',
  flags: 'Flags Comerciais',
  unit: 'Unidade de Medida',
  weight: 'Peso',
  supplier: 'Fornecedor',
  location: 'Localização no Estoque',
};

/**
 * Calculates readable diffs between previous and next product states.
 */
export function computeProductDiff(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown>,
): ProductAuditChange[] {
  if (!previous) {
    return [
      {
        field: 'product',
        label: 'Criação Inicial',
        oldValue: null,
        newValue: current.title || 'Novo Produto',
      },
    ];
  }

  const changes: ProductAuditChange[] = [];
  const checkedKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  // Keys to ignore from direct diff tracking (e.g. metadata)
  const ignoreKeys = new Set(['updatedAt', 'createdAt', 'stockHistory', 'id']);

  for (const key of checkedKeys) {
    if (ignoreKeys.has(key)) continue;

    const oldVal = previous[key];
    const newVal = current[key];

    // Normalize empty strings vs undefined vs null
    const normOld = oldVal === undefined || oldVal === null ? '' : oldVal;
    const normNew = newVal === undefined || newVal === null ? '' : newVal;

    const isEqual =
      typeof normOld === 'object' || typeof normNew === 'object'
        ? JSON.stringify(normOld) === JSON.stringify(normNew)
        : normOld === normNew;

    if (!isEqual) {
      changes.push({
        field: key,
        label: FIELD_LABELS[key] || key,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
      });
    }
  }

  return changes;
}

/**
 * Writes an immutable audit entry to Firestore collection `productHistory`.
 */
export async function recordProductAudit(
  entry: Omit<ProductAuditRecord, 'id' | 'timestamp' | 'createdAt'> & {
    note?: string;
  },
): Promise<string | null> {
  try {
    const colRef = collection(db, 'productHistory');
    const docRef = await addDoc(colRef, {
      ...entry,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.warn('Falha ao registrar auditoria de produto (verifique as regras de segurança):', error);
    // Non-blocking: audit failure should not break user operations completely,
    // but we log and return null.
    return null;
  }
}

/**
 * Fetches recent audit history for a given product from `productHistory`.
 */
export async function getProductAuditHistory(
  productId: string,
  maxRecords: number = 50,
): Promise<ProductAuditRecord[]> {
  try {
    const colRef = collection(db, 'productHistory');
    // Try query with where and limit
    let q;
    try {
      q = query(
        colRef,
        where('productId', '==', productId),
        orderBy('timestamp', 'desc'),
        limit(maxRecords),
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          productId: data.productId,
          productTitle: data.productTitle || '',
          userId: data.userId || 'sistema',
          userName: data.userName || 'Usuário',
          userEmail: data.userEmail || '',
          operation: data.operation || 'update',
          changes: Array.isArray(data.changes) ? data.changes : [],
          note: data.note,
          timestamp: data.timestamp,
          createdAt: data.createdAt,
        };
      });
    } catch {
      // Fallback query without compound order index
      q = query(colRef, where('productId', '==', productId), limit(maxRecords));
      const snap = await getDocs(q);
      const records = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          productId: data.productId,
          productTitle: data.productTitle || '',
          userId: data.userId || 'sistema',
          userName: data.userName || 'Usuário',
          userEmail: data.userEmail || '',
          operation: data.operation || 'update',
          changes: Array.isArray(data.changes) ? data.changes : [],
          note: data.note,
          timestamp: data.timestamp,
          createdAt: data.createdAt,
        };
      });
      // Sort client-side
      return records.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }
  } catch (error) {
    console.warn('Histórico de auditoria não disponível (verifique as regras de segurança):', error);
    return [];
  }
}

