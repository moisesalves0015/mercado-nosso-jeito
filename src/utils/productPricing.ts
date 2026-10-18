export interface PricedProduct {
  price: number | string;
  promoActive?: boolean;
  promoPrice?: number | string;
  promoExpiry?: string | number | Date | { toDate?: () => Date; seconds?: number } | null;
}

function toPrice(value: number | string | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/R\$/gi, '').trim();
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toExpiry(value: PricedProduct['promoExpiry']): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object') {
    try {
      const parsed = typeof value.toDate === 'function'
        ? value.toDate()
        : typeof value.seconds === 'number'
          ? new Date(value.seconds * 1000)
          : null;
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function getEffectiveProductPrice(product: PricedProduct, now = new Date()): number {
  const regularPrice = toPrice(product.price);
  if (product.promoActive !== true) return regularPrice;

  const promotionalPrice = toPrice(product.promoPrice);
  if (promotionalPrice <= 0 || promotionalPrice >= regularPrice) return regularPrice;

  if (product.promoExpiry) {
    const expiry = toExpiry(product.promoExpiry);
    if (!expiry || expiry.getTime() <= now.getTime()) return regularPrice;
  }

  return promotionalPrice;
}

export function isProductPromotionCurrent(product: PricedProduct, now = new Date()): boolean {
  return product.promoActive === true && getEffectiveProductPrice(product, now) < toPrice(product.price);
}
