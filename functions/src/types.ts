// ─────────────────────────────────────────────────────────────────────────────
// Shared types for Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────
import type * as admin from 'firebase-admin';

// ── createOrder ──────────────────────────────────────────────────────────────

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  productItems: OrderItemInput[];
  /** ID of a document in users/{uid}/addresses/{addressId} */
  addressId: string;
  deliveryMethod: 'apartment' | 'lobby';
  paymentMethod: 'pix' | 'credit_card' | 'on_delivery';
  couponCode?: string;
  /** Client-generated UUID — prevents duplicate submissions */
  idempotencyKey: string;
  notes?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponApplied: boolean;
  status: 'pending';
}

// ── Firestore document shapes (server-side) ───────────────────────────────────

export interface CouponDoc {
  code: string;
  type: 'percentage' | 'fixed';
  /** Percentage 0–1 or fixed BRL amount */
  value: number;
  active: boolean;
  maxUses?: number;
  usesCount?: number;
  expiresAt?: admin.firestore.Timestamp;
  minOrderValue?: number;
}

export interface OrderAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  label?: string;
}

export interface ShippingConfigServer {
  freeShippingThreshold: number;
  baseShippingFee: number;
  /** Map of condo name → fee in BRL */
  condos: Record<string, number>;
}

// ── adminGrantDiamonds ────────────────────────────────────────────────────────

export interface AdminGrantDiamondsRequest {
  targetUid: string;
  amount: number;
  reason: string;
  idempotencyKey?: string;
}

export interface AdminGrantDiamondsResponse {
  success: boolean;
  newBalance: number;
  alreadyProcessed?: boolean;
}

// ── adminBanUser ──────────────────────────────────────────────────────────────

export interface AdminBanUserRequest {
  targetUid: string;
  reason?: string;
}

export interface AdminBanUserResponse {
  success: boolean;
  targetUid: string;
}

// ── setAdminClaim ─────────────────────────────────────────────────────────────

export interface SetAdminClaimRequest {
  targetUid: string;
  isAdmin: boolean;
}

export interface SetAdminClaimResponse {
  success: boolean;
  targetUid: string;
  isAdmin: boolean;
}

// ── redeemReward ─────────────────────────────────────────────────────────────

export interface RedeemRewardRequest {
  rewardId: string | number;
  cost: number;
  title: string;
  idempotencyKey: string;
}

export interface RedeemRewardResponse {
  success: boolean;
  newBalance: number;
  alreadyProcessed?: boolean;
}

// ── Order status & payment types ─────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export type OrderPaymentStatus =
  | 'awaiting_confirmation'
  | 'approved'
  | 'rejected'
  | 'on_delivery';

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: OrderStatus;
  note?: string;
}

export interface ConfirmPaymentRequest {
  orderId: string;
  paymentMethod?: string;
  paymentReference?: string;
  note?: string;
}

export interface CancelOrderRequest {
  orderId: string;
  reason?: string;
}

