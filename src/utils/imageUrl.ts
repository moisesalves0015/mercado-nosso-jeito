import React from 'react';

export const DEFAULT_PRODUCT_IMAGE = '/categories/geral.png';

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
 * Fallback event handler for <img> onError to prevent broken images.
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (!target.src.endsWith(DEFAULT_PRODUCT_IMAGE)) {
    target.src = DEFAULT_PRODUCT_IMAGE;
  }
}

