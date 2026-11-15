import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';

const DB_NAME = 'app_media_cache';
const STORE_NAME = 'blobs';
const CHUNK_SIZE = 400_000; // ~300KB per document, safely within Firestore's 1MB document limit

/**
 * Opens or initializes IndexedDB for client-side multi-megabyte media caching.
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves a Blob to IndexedDB by key.
 */
export async function saveBlobToIndexedDB(key: string, blob: Blob): Promise<void> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(blob, key);
    });
  } catch (err) {
    console.warn('[IndexedDB] Erro ao gravar blob localmente:', err);
  }
}

/**
 * Retrieves a Blob from IndexedDB by key.
 */
export async function getBlobFromIndexedDB(key: string): Promise<Blob | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Erro ao ler blob localmente:', err);
    return null;
  }
}

/**
 * Converts a File or Blob into a base64 Data URL string.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Saves a video file into chunked Firestore documents and caches it in IndexedDB.
 * Completely eliminates Firestore 1MB limits and Firebase Storage CORS errors.
 */
export async function saveVideoFileToChunkedStore(file: File, preferredId?: string): Promise<string> {
  const mediaId = preferredId || `banner_video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Immediately cache in IndexedDB and memory for instant zero-latency playback
  await saveBlobToIndexedDB(mediaId, file);
  try {
    const objUrl = URL.createObjectURL(file);
    memoryObjectUrlCache.set(mediaId, objUrl);
  } catch {
    // ignore
  }

  // 2. Read as base64 string
  const fullDataUrl = await fileToDataUrl(file);
  const totalLength = fullDataUrl.length;
  const totalChunks = Math.ceil(totalLength / CHUNK_SIZE);

  // 3. Save chunks in Firestore under home-config/data/media-vault/{mediaId}_chunk_{i}
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalLength);
    const chunkData = fullDataUrl.slice(start, end);

    await setDoc(
      doc(db, 'home-config', 'data', 'media-vault', `${mediaId}_chunk_${i}`),
      {
        mediaId,
        index: i,
        data: chunkData,
      },
      { merge: true }
    );
  }

  // 4. Save metadata document
  await setDoc(
    doc(db, 'home-config', 'data', 'media-vault', `${mediaId}_meta`),
    {
      mediaId,
      totalChunks,
      mimeType: file.type || 'video/mp4',
      size: file.size,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return `firestore-media://${mediaId}`;
}

const memoryObjectUrlCache = new Map<string, string>();

/**
 * Resolves any media URI (http, https, blob, data:, firestore-media://) into a playable URL.
 */
export async function resolveMediaUrl(uri?: string): Promise<string> {
  if (!uri || !uri.trim()) return '';
  const trimmed = uri.trim();

  // If already a playable URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    (trimmed.startsWith('data:') && trimmed.length < 500_000)
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('firestore-media://')) {
    const mediaId = trimmed.replace('firestore-media://', '').trim();
    if (memoryObjectUrlCache.has(mediaId)) {
      return memoryObjectUrlCache.get(mediaId)!;
    }

    // Check IndexedDB first
    const cachedBlob = await getBlobFromIndexedDB(mediaId);
    if (cachedBlob) {
      const objUrl = URL.createObjectURL(cachedBlob);
      memoryObjectUrlCache.set(mediaId, objUrl);
      return objUrl;
    }

    // Fetch chunks from Firestore
    try {
      const metaSnap = await getDoc(doc(db, 'home-config', 'data', 'media-vault', `${mediaId}_meta`));
      if (!metaSnap.exists()) {
        console.warn(`[resolveMediaUrl] Metadados de vídeo não encontrados para ${mediaId}`);
        return '';
      }
      const meta = metaSnap.data() as { totalChunks: number; mimeType?: string };
      const totalChunks = meta.totalChunks || 0;
      const chunks: string[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkSnap = await getDoc(doc(db, 'home-config', 'data', 'media-vault', `${mediaId}_chunk_${i}`));
        if (chunkSnap.exists()) {
          chunks.push(chunkSnap.data().data || '');
        }
      }

      const fullDataUrl = chunks.join('');
      if (!fullDataUrl) return '';

      // Convert data URL to Blob
      const res = await fetch(fullDataUrl);
      const blob = await res.blob();

      // Cache in IndexedDB for subsequent visits
      await saveBlobToIndexedDB(mediaId, blob);
      const objUrl = URL.createObjectURL(blob);
      memoryObjectUrlCache.set(mediaId, objUrl);
      return objUrl;
    } catch (err) {
      console.warn(`[resolveMediaUrl] Falha ao recuperar vídeo fragmentado do Firestore (${mediaId}):`, err);
      return '';
    }
  }

  return trimmed;
}

/**
 * React hook to reactively resolve a media URL (handles firestore-media:// automatically).
 */
export function useResolvedMediaUrl(url?: string): string {
  const [resolved, setResolved] = useState<string>(() => {
    if (!url) return '';
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('blob:') ||
      url.startsWith('/') ||
      url.startsWith('data:')
    ) {
      return url;
    }
    if (url.startsWith('firestore-media://')) {
      const mediaId = url.replace('firestore-media://', '').trim();
      return memoryObjectUrlCache.get(mediaId) || '';
    }
    return url;
  });

  useEffect(() => {
    if (!url) {
      setResolved('');
      return;
    }
    let cancelled = false;
    resolveMediaUrl(url).then((res) => {
      if (!cancelled) setResolved(res);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}

