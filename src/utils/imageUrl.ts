import React from 'react';

export const DEFAULT_PRODUCT_IMAGE = '/categories/geral.png';
export const DEFAULT_BANNER_IMAGE = '/hero_background.png';

/**
 * Sanitizes and validates an image URL or data URI.
 * Removes newlines, whitespace, and handles malformed data URIs gracefully.
 */
export function cleanImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return DEFAULT_PRODUCT_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_PRODUCT_IMAGE;

  // Handle data URIs
  if (trimmed.startsWith('data:')) {
    if (!trimmed.startsWith('data:image/')) {
      return DEFAULT_PRODUCT_IMAGE;
    }
    // Strip all whitespaces, tabs, newlines which break Chrome data URL parser
    const cleaned = trimmed.replace(/[\r\n\s]+/g, '');
    if (!cleaned.includes(';base64,')) {
      return DEFAULT_PRODUCT_IMAGE;
    }
    return cleaned;
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

  if (trimmed.startsWith('data:')) {
    if (!trimmed.startsWith('data:image/')) return fallback;
    const cleaned = trimmed.replace(/[\r\n\s]+/g, '');
    if (!cleaned.includes(';base64,')) return fallback;
    return cleaned;
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

