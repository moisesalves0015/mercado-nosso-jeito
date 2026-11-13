export type AdCampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'archived';
export type AdRewardType = 'diamonds' | 'coupon' | 'shipping' | 'none';
export type AdCtaActionType = 'whatsapp' | 'external_url' | 'redeem_benefit' | 'none';
export type AssetApprovalStatus = 'pending_license' | 'approved' | 'internal_placeholder';
export type AdEligibilityRule = 'all_residents' | 'vip_only' | 'first_order_only';
export type AdVerificationMode = 'server_watch_timer_only' | 's2s_provider_callback';

export interface SponsoredCampaignRecord {
  id: string;
  title: string;
  brand: string;
  description: string;
  category: string;
  logoUrl: string;
  bannerUrl: string;
  assetApprovalStatus: AssetApprovalStatus;
  assetLicenseNote?: string;
  durationSeconds: number;
  rewardType: AdRewardType;
  rewardDiamonds: number;
  rewardCouponCode?: string | null;
  rewardTerms: string;
  ctaLabel: string;
  ctaActionType: AdCtaActionType;
  ctaTarget: string;
  status: AdCampaignStatus;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  startsAtMs?: number | null;
  endsAtMs?: number | null;
  targetCondos: string[];
  eligibilityRule: AdEligibilityRule;
  maxClaimsPerUserPerDay: number;
  maxClaimsPerUserTotal: number | null;
  totalBudgetDiamonds: number;
  totalBudgetClaims: number | null;
  spentDiamonds: number;
  claimsCount: number;
  verificationMode?: AdVerificationMode;
  version: number;
  internalNotes?: string;
  sponsorContact?: string;
  migratedFromLegacyId?: string | null;
  lastAuditReason?: string;
}

export interface PublicSponsoredCampaign {
  id: string;
  title: string;
  brand: string;
  description: string;
  category: string;
  logoUrl: string;
  bannerUrl: string;
  assetApprovalStatus: AssetApprovalStatus;
  durationSeconds: number;
  rewardType: AdRewardType;
  rewardDiamonds: number;
  rewardCouponCode: string | null;
  rewardTerms: string;
  ctaLabel: string;
  ctaActionType: AdCtaActionType;
  ctaTarget: string;
  status: AdCampaignStatus;
  startsAtMs: number | null;
  endsAtMs: number | null;
  targetCondos: string[];
  eligibilityRule: AdEligibilityRule;
  maxClaimsPerUserPerDay: number;
  maxClaimsPerUserTotal: number | null;
  verificationMode: AdVerificationMode;
  version: number;
  userClaimsToday: number;
  userClaimsTotal: number;
  canClaim: boolean;
  activeSession: {
    sessionId: string;
    startedAtMillis: number;
    minWatchSeconds: number;
    expiresAtMillis: number;
  } | null;
}

export interface LegacyOfferRecord {
  id: string;
  brand?: string;
  title?: string;
  desc?: string;
  logo?: string;
  bannerImage?: string;
  rewardVal?: number;
  type?: string;
  duration?: number;
  category?: string;
}

const SAFE_RELATIVE_RE = /^\/(?!\/)[a-zA-Z0-9._~!$&'()*+,;=:@/-]{1,300}$/;

export function isSafeActionUrl(actionType: AdCtaActionType, target: string): boolean {
  const trimmed = target.trim();
  if (actionType === 'none') return true;
  if (!trimmed) return false;
  if (actionType === 'redeem_benefit') {
    return SAFE_RELATIVE_RE.test(trimmed) || /^[A-Z0-9_-]{3,32}$/.test(trimmed.toUpperCase());
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (actionType === 'whatsapp') {
      const host = parsed.hostname.toLowerCase();
      return host === 'wa.me' || host === 'api.whatsapp.com';
    }
    return true;
  } catch {
    return false;
  }
}

export const CAMPAIGN_STATUS_LABEL: Record<AdCampaignStatus, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  active: 'Ativa',
  paused: 'Pausada',
  ended: 'Encerrada',
  archived: 'Arquivada',
};

