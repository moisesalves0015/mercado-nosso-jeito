import React from 'react';

export const DEFAULT_PRODUCT_IMAGE = '/categories/geral.png';
export const DEFAULT_BANNER_IMAGE = '/hero_background.png';

/**
 * Validates that a string is a well-formed image Data URL and not a truncated
 * or corrupted base64 string that causes Chromium to throw net::ERR_INVALID_URL.
 */
export function isValidImageDataUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().replace(/[\r\n\s]+/g, '');
  if (!trimmed.startsWith('data:image/')) return false;
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return false;
  const meta = trimmed.slice(0, commaIdx);
  if (!meta.includes(';base64')) return false;

  const payload = trimmed.slice(commaIdx + 1);
  if (payload.length < 4) return false;
  // In standard Base64 encoding, the payload length with padding MUST be a multiple of 4.
  // Truncated streams (e.g. cut off at 1024 chars) violate this and crash Chromium's URL parser with net::ERR_INVALID_URL.
  if (payload.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return false;

  try {
    if (typeof atob === 'function') {
      atob(payload.slice(0, Math.min(payload.length, 32)));
      atob(payload.slice(-Math.min(payload.length, 32)));
    }
  } catch {
    return false;
  }

  return true;
}

const isSafeImageScheme = (url: string): boolean => {
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  if (/^https?:\/\//i.test(url)) return true;
  if (/^blob:/i.test(url)) return true;
  return false;
};

/**
 * Sanitizes and validates an image URL or data URI.
 * Removes newlines, whitespace, blocks dangerous schemes, and handles malformed data URIs gracefully.
 */
export function cleanImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return DEFAULT_PRODUCT_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_PRODUCT_IMAGE;

  // Handle data URIs
  if (/^data:/i.test(trimmed)) {
    if (!isValidImageDataUrl(trimmed)) {
      return DEFAULT_PRODUCT_IMAGE;
    }
    return trimmed.replace(/[\r\n\s]+/g, '');
  }

  if (!isSafeImageScheme(trimmed)) {
    return DEFAULT_PRODUCT_IMAGE;
  }

  return trimmed;
}

/**
 * Sanitizes a Hero or promotional banner image URL or data URI.
 */
export function sanitizeBannerImageUrl(url?: string | null, fallback = DEFAULT_BANNER_IMAGE): string {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  if (/^data:/i.test(trimmed)) {
    if (!isValidImageDataUrl(trimmed)) {
      return fallback;
    }
    return trimmed.replace(/[\r\n\s]+/g, '');
  }

  if (!isSafeImageScheme(trimmed)) {
    return fallback;
  }

  return trimmed;
}

/**
 * Fallback event handler for <img> onError to prevent broken images.
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (!target.src.endsWith(DEFAULT_PRODUCT_IMAGE)) {
    target.src = DEFAULT_PRODUCT_IMAGE;
  }
}

