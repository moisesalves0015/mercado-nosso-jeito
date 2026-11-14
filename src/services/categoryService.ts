import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { VISUAL_CATEGORIES } from '../data/homeCategories';

export interface AdminCategory {
  id: string;
  name: string;
  description?: string;
  image?: string;
  icon?: string;
  order: number;
  active: boolean;
  type?: 'route' | 'search' | 'category';
  target?: string;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_CATEGORIES: AdminCategory[] = VISUAL_CATEGORIES.map((cat, index) => ({
  id: cat.id,
  name: cat.label,
  description: `Categoria oficial ${cat.label}`,
  image: cat.image,
  icon: cat.icon,
  order: cat.order ?? index + 1,
  active: cat.active ?? true,
  type: cat.type,
  target: cat.target,
}));

/**
 * Normalizes a name into a clean URL-safe slug ID.
 */
export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;
}

/**
 * Fetches all categories merged from Firestore and the default catalog.
 * Firestore categories take precedence if custom fields exist.
 */
export async function getAdminCategories(): Promise<AdminCategory[]> {
  try {
    const colRef = collection(db, 'categories');
    const snap = await getDocs(query(colRef, orderBy('order', 'asc'))).catch(async () => {
      // If order index does not exist, fetch raw collection
      return getDocs(colRef);
    });

    const firestoreMap = new Map<string, AdminCategory>();
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      firestoreMap.set(docSnap.id, {
        id: docSnap.id,
        name: data.name || data.label || docSnap.id,
        description: data.description || '',
        image: data.image || '',
        icon: data.icon || '',
        order: Number(data.order ?? 99),
        active: data.active !== false,
        type: data.type || 'search',
        target: data.target || docSnap.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // Merge defaults that are not in Firestore yet
    const merged: AdminCategory[] = [];
    const seenIds = new Set<string>();

    // Add Firestore categories first
    for (const [id, cat] of firestoreMap.entries()) {
      merged.push(cat);
      seenIds.add(id);
    }

    // Add default categories if not already present in Firestore
    for (const def of DEFAULT_CATEGORIES) {
      if (!seenIds.has(def.id)) {
        merged.push(def);
        seenIds.add(def.id);
      }
    }

    return merged.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch (error) {
    console.warn('Erro ao carregar categorias do Firestore, utilizando padrão:', error);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Saves or updates a category in Firestore collection `categories`.
 */
export async function saveAdminCategory(category: AdminCategory): Promise<AdminCategory> {
  const colRef = collection(db, 'categories');
  const catId = category.id || slugifyCategory(category.name);
  const docRef = doc(colRef, catId);

  const payload: Record<string, unknown> = {
    id: catId,
    name: category.name.trim(),
    label: category.name.trim(),
    description: category.description?.trim() || '',
    image: category.image || '',
    icon: category.icon || '',
    order: Number(category.order ?? 99),
    active: category.active !== false,
    type: category.type || 'search',
    target: category.target || catId,
    updatedAt: new Date().toISOString(),
    serverTimestamp: serverTimestamp(),
  };

  const existing = await getDoc(docRef);
  if (!existing.exists()) {
    payload.createdAt = new Date().toISOString();
  }

  await setDoc(docRef, payload, { merge: true });

  return {
    ...category,
    id: catId,
  };
}

/**
 * Toggles a category's active status.
 */
export async function toggleAdminCategoryActive(id: string, active: boolean): Promise<boolean> {
  try {
    const docRef = doc(db, 'categories', id);
    await setDoc(
      docRef,
      {
        active,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.error('Erro ao alternar status da categoria:', error);
    return false;
  }
}

/**
 * Deletes a category from Firestore.
 */
export async function deleteAdminCategory(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'categories', id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    return false;
  }
}
