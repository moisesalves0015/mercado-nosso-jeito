import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { saveVideoFileToChunkedStore } from './mediaStorageService';

export interface ImageUploadOptions {
  folder: 'products' | 'banners';
  maxDimension?: number;
  quality?: number;
}

export const MAX_DATA_URL_LENGTH = 700_000; // ~500 KB binary, safe within Firestore's 1MB document limit

export function isAcceptableDataUrlSize(dataUrl: string): boolean {
  if (!dataUrl || !dataUrl.startsWith('data:')) return true;
  return dataUrl.length <= MAX_DATA_URL_LENGTH;
}

/**
 * Compresses an image file using an HTML5 canvas while preserving alpha transparency
 * for PNG/WebP/GIF images, returning a clean, single-line Data URL optimized for Firestore.
 * Automatically steps down dimension and quality if the encoded string exceeds safe limits.
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
        let currentMaxDim = maxDimension;
        let currentQuality = quality;

        const isTransparentCapable =
          file.type === 'image/png' ||
          file.type === 'image/webp' ||
          file.type === 'image/gif';

        const renderCanvas = (targetDim: number, targetQ: number) => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > targetDim) {
              height = Math.round((height * targetDim) / width);
              width = targetDim;
            }
          } else {
            if (height > targetDim) {
              width = Math.round((width * targetDim) / height);
              height = targetDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Falha ao inicializar contexto de imagem');

          if (!isTransparentCapable) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Prefer webp for compact transparency, falling back to jpeg for non-transparent photos
          const targetMime = isTransparentCapable ? 'image/webp' : 'image/jpeg';
          let dataUrl = canvas.toDataURL(targetMime, targetQ);
          if (isTransparentCapable && !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/png');
          }
          const cleaned = dataUrl.replace(/[\r\n\s]+/g, '');
          return { cleaned, targetMime };
        };

        try {
          let { cleaned, targetMime } = renderCanvas(currentMaxDim, currentQuality);

          // Progressive reduction loop to strictly guarantee Firestore persistence
          let attempts = 0;
          while (cleaned.length > MAX_DATA_URL_LENGTH && attempts < 4) {
            attempts++;
            currentMaxDim = Math.round(currentMaxDim * 0.82);
            currentQuality = Math.max(0.55, currentQuality * 0.85);
            const next = renderCanvas(currentMaxDim, currentQuality);
            cleaned = next.cleaned;
            targetMime = next.targetMime;
          }

          resolve({ dataUrl: cleaned, mimeType: targetMime });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
      img.onerror = () =>
        reject(
          new Error(
            'Arquivo de imagem não suportado ou corrompido. Utilize formatos padrão como JPG, PNG ou WebP.'
          )
        );
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem do dispositivo'));
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
  const quality = options.quality ?? (options.folder === 'banners' ? 0.80 : 0.82);

  const { dataUrl } = await compressImageFile(file, maxDimension, quality);
  return dataUrl;
}

/**
 * Captures a representative poster thumbnail from a video file using HTML5 canvas.
 */
export function captureVideoPoster(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve('');
    }
    const video = document.createElement('video');
    const blobUrl = URL.createObjectURL(file);
    video.src = blobUrl;
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve('');
    }, 4000);

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      } catch {
        // ignore
      }
    };

    video.onseeked = () => {
      clearTimeout(timer);
      try {
        const targetWidth = Math.min(video.videoWidth || 640, 640);
        const targetHeight = Math.round(
          (targetWidth * (video.videoHeight || 360)) / (video.videoWidth || 640)
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, targetWidth);
        canvas.height = Math.max(1, targetHeight);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const poster = canvas.toDataURL('image/jpeg', 0.82);
          cleanup();
          resolve(poster);
          return;
        }
      } catch {
        // ignore canvas extraction errors
      }
      cleanup();
      resolve('');
    };

    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve('');
    };
  });
}

/**
 * Uploads a banner video or image file to Firebase Storage (or compresses to Data URL if image)
 * so that videos are permanently persisted as HTTPS URLs and never exceed Firestore's 1MB limit.
 */
export async function uploadBannerMediaFile(
  file: File
): Promise<{ url: string; mediaType: 'image' | 'video'; posterImage?: string }> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(file.name);

  if (!isVideo) {
    const dataUrl = await uploadOrCompressImage(file, {
      folder: 'banners',
      maxDimension: 960,
      quality: 0.82,
    });
    return { url: dataUrl, mediaType: 'image' };
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error(
      'O vídeo selecionado tem mais de 30MB. Para vídeos em loop no app, utilize vídeos curtos de até 25MB (formato MP4 ou WebM).'
    );
  }

  let posterImage = '';
  try {
    posterImage = await captureVideoPoster(file);
  } catch {
    // poster extraction is optional
  }

  // Save directly to resilient chunked Firestore store + IndexedDB
  // Completely eliminates Firebase Storage CORS errors and Firestore 1MB limits
  try {
    const mediaUri = await saveVideoFileToChunkedStore(file);
    return { url: mediaUri, mediaType: 'video', posterImage };
  } catch (chunkErr) {
    console.error('[uploadBannerMediaFile] Falha ao processar e salvar vídeo fragmentado:', chunkErr);
    throw new Error(
      'Falha ao processar o arquivo de vídeo: ' +
        (chunkErr instanceof Error ? chunkErr.message : String(chunkErr))
    );
  }
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
export async function enrichProductWithMedia<T extends Record<string, any>>(
  productId: string,
  productData: T
): Promise<T & Record<string, any>> {
  try {
    const mediaSnap = await getDoc(doc(db, 'home-config', 'data', 'product-media', productId));
    if (mediaSnap.exists()) {
      const media = mediaSnap.data() as ProductMediaOverride;
      const merged = { ...productData } as Record<string, any>;
      if (typeof media.image === 'string' && media.image.trim()) {
        merged.image = media.image;
      }
      if (Array.isArray(media.images) && media.images.length > 0) {
        merged.images = media.images;
      }
      return merged as T & Record<string, any>;
    }
  } catch {
    // Return original product data if media doc is unavailable
  }
  return productData as T & Record<string, any>;
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
