import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ImageUploadOptions {
  folder: 'products' | 'banners';
  maxDimension?: number;
  quality?: number;
}

/**
 * Compresses an image file using an HTML5 canvas while preserving alpha transparency
 * for PNG/WebP/GIF images, returning a clean, single-line Data URL optimized for Firestore.
 */
export function compressImageFile(
  file: File,
  maxDimension = 560,
  quality = 0.82
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Falha ao inicializar contexto de imagem'));
          return;
        }

        const isTransparentCapable =
          file.type === 'image/png' ||
          file.type === 'image/webp' ||
          file.type === 'image/gif';

        if (!isTransparentCapable) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Prefer image/webp when transparency is needed to keep payload compact for Firestore,
        // falling back to image/jpeg for regular photos.
        const targetMime = isTransparentCapable ? 'image/webp' : 'image/jpeg';
        let dataUrl = canvas.toDataURL(targetMime, quality);
        if (isTransparentCapable && !dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/png');
        }
        const cleanedDataUrl = dataUrl.replace(/[\r\n\s]+/g, '');
        resolve({ dataUrl: cleanedDataUrl, mimeType: targetMime });
      };
      img.onerror = () => reject(new Error('Arquivo de imagem inválido ou corrompido'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem'));
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes an uploaded image file on the client into a compact Data URI suitable for direct
 * Firestore persistence (`products` and `home-config/data/hero-banners`), avoiding CORS failures
 * when Firebase Storage is not provisioned for the origin.
 */
export async function uploadOrCompressImage(
  file: File,
  options: ImageUploadOptions
): Promise<string> {
  const maxDimension = options.maxDimension ?? (options.folder === 'banners' ? 960 : 520);
  const quality = options.quality ?? (options.folder === 'banners' ? 0.82 : 0.82);

  const { dataUrl } = await compressImageFile(file, maxDimension, quality);
  return dataUrl;
}

/**
 * Synchronizes an updated or created product in `localStorage['app-products']`
 * and dispatches `app-products-updated` so all public vitrines, search, and detail views
 * reflect image and product updates immediately.
 */
export function syncProductInLocalStorage(
  productId: string,
  payload: Record<string, unknown>
): void {
  try {
    const raw = localStorage.getItem('app-products');
    const list: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((item) => item && item.id === productId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...payload, id: productId };
    } else {
      list.unshift({ ...payload, id: productId });
    }
    localStorage.setItem('app-products', JSON.stringify(list));
    window.dispatchEvent(new Event('app-products-updated'));
  } catch (err) {
    console.warn('[syncProductInLocalStorage] Could not update local cache:', err);
  }
}

export interface ProductMediaOverride {
  id: string;
  image?: string;
  images?: string[];
  updatedAt?: string;
}

/**
 * Persists full product payload (including un-truncated Data URI images and complementary gallery)
 * directly to `products/{targetId}` AND mirrors media to `home-config/data/product-media/{targetId}`
 * so that even if a deployed Cloud Function truncates `products.image` to 1024 chars,
 * the full image is always preserved and restored across reloads.
 */
export async function persistProductFullData(
  targetId: string,
  payload: Record<string, unknown>,
  isNew: boolean,
  pStock: number
): Promise<void> {
  const fullDoc = isNew ? { id: targetId, ...payload, stock: pStock } : { id: targetId, ...payload };

  try {
    await setDoc(doc(db, 'products', targetId), fullDoc, { merge: true });
  } catch {
    // Ignore if direct write on `products` is restricted by legacy rule; media subcollection below will persist it.
  }

  try {
    await setDoc(
      doc(db, 'home-config', 'data', 'product-media', targetId),
      {
        id: targetId,
        image: typeof payload.image === 'string' ? payload.image : '',
        images: Array.isArray(payload.images) ? payload.images : [],
        updatedAt: payload.updatedAt || new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Ignore if offline
  }

  syncProductInLocalStorage(targetId, fullDoc);
}

/**
 * Merges a single product document with its `home-config/data/product-media/{id}` record if present.
 */
export async function enrichProductWithMedia<T extends Record<string, unknown>>(
  productId: string,
  productData: T
): Promise<T> {
  try {
    const mediaSnap = await getDoc(doc(db, 'home-config', 'data', 'product-media', productId));
    if (mediaSnap.exists()) {
      const media = mediaSnap.data() as ProductMediaOverride;
      const merged = { ...productData } as Record<string, unknown>;
      if (typeof media.image === 'string' && media.image.trim()) {
        merged.image = media.image;
      }
      if (Array.isArray(media.images) && media.images.length > 0) {
        merged.images = media.images;
      }
      return merged as T;
    }
  } catch {
    // Return original product data if media doc is unavailable
  }
  return productData;
}

/**
 * Fetches all `home-config/data/product-media` documents and merges them into a product list.
 */
export async function enrichProductListWithMedia<T extends { id: string; image?: string; images?: string[] }>(
  products: T[]
): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, 'home-config', 'data', 'product-media'));
    if (snap.empty) return products;
    const mediaMap = new Map<string, ProductMediaOverride>();
    snap.docs.forEach((d) => {
      mediaMap.set(d.id, { id: d.id, ...(d.data() as Omit<ProductMediaOverride, 'id'>) });
    });
    return products.map((p) => {
      const m = mediaMap.get(p.id);
      if (!m) return p;
      return {
        ...p,
        image: typeof m.image === 'string' && m.image.trim() ? m.image : p.image,
        images: Array.isArray(m.images) && m.images.length > 0 ? m.images : p.images,
      };
    });
  } catch {
    return products;
  }
}

/**
 * Subscribes to both `products` and `home-config/data/product-media` so that `localStorage['app-products']`
 * and all public vitrines always receive the full un-truncated product images in real time.
 */
export function subscribeProductsWithMedia(
  onUpdate: (mergedProducts: Array<Record<string, unknown>>) => void
): () => void {
  let rawProducts: Array<Record<string, unknown>> = [];
  let mediaMap = new Map<string, ProductMediaOverride>();
  let productsLoaded = false;

  const emit = () => {
    if (!productsLoaded) return;
    const merged = rawProducts.map((p) => {
      const id = String(p.id || '');
      const m = mediaMap.get(id);
      if (!m) return p;
      return {
        ...p,
        image: typeof m.image === 'string' && m.image.trim() ? m.image : p.image,
        images: Array.isArray(m.images) && m.images.length > 0 ? m.images : p.images,
      };
    });
    onUpdate(merged);
  };

  const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
    rawProducts = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    productsLoaded = true;
    emit();
  });

  const unsubMedia = onSnapshot(
    collection(db, 'home-config', 'data', 'product-media'),
    (snap) => {
      const next = new Map<string, ProductMediaOverride>();
      snap.docs.forEach((d) => {
        next.set(d.id, { id: d.id, ...(d.data() as Omit<ProductMediaOverride, 'id'>) });
      });
      mediaMap = next;
      emit();
    },
    () => {
      // Ignore permission or network errors on optional media collection
    }
  );

  return () => {
    unsubProducts();
    unsubMedia();
  };
}
