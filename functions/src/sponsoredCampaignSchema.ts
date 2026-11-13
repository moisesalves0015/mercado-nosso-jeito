/**
 * Schema, sanitization, URL validation and public/private projection for
 * Sponsored Ad Campaigns (`ad_campaigns/{campaignId}`).
 */

export type AdCampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'archived';
export type AdRewardType = 'diamonds' | 'coupon' | 'shipping' | 'none';
export type AdCtaActionType = 'whatsapp' | 'external_url' | 'redeem_benefit' | 'none';
export type AssetApprovalStatus = 'pending_license' | 'approved' | 'internal_placeholder';
export type AdEligibilityRule = 'all_residents' | 'vip_only' | 'first_order_only';
export type AdVerificationMode = 'server_watch_timer_only' | 's2s_provider_callback';

export interface SponsoredCampaignInput {
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
  startsAt?: string | number | null;
  endsAt?: string | number | null;
  targetCondos: string[];
  eligibilityRule: AdEligibilityRule;
  maxClaimsPerUserPerDay: number;
  maxClaimsPerUserTotal: number | null;
  totalBudgetDiamonds: number;
  totalBudgetClaims: number | null;
  internalNotes?: string;
  sponsorContact?: string;
}

export interface ValidatedSponsoredCampaign extends SponsoredCampaignInput {
  startsAtMs: number | null;
  endsAtMs: number | null;
  rewardCouponCode: string | null;
  verificationMode: AdVerificationMode;
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
}

const HTML_OR_SCRIPT_RE = /<[^>]*>|javascript:|vbscript:|data:text\/html|on[a-z]+\s*=/i;
const COUPON_RE = /^[A-Z0-9_-]{3,32}$/;
const SAFE_RELATIVE_PATH_RE = /^\/(?!\/)[a-zA-Z0-9._~!$&'()*+,;=:@/-]{1,300}$/;

export function hasForbiddenHtmlOrScript(value: string): boolean {
  return HTML_OR_SCRIPT_RE.test(value);
}

export function sanitizePlainText(
  value: unknown,
  field: string,
  min: number,
  max: number,
  required = true,
): string {
  if (value == null || value === '') {
    if (!required && min === 0) return '';
    throw new Error(`${field} é obrigatório (${min}–${max} caracteres).`);
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} deve ser texto.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new Error(`${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  if (hasForbiddenHtmlOrScript(trimmed)) {
    throw new Error(`${field} contém HTML ou script não permitido.`);
  }
  return trimmed;
}

export function validateSafeMediaUrl(value: unknown, field: string, required = false): string {
  if (value == null || String(value).trim() === '') {
    if (!required) return '';
    throw new Error(`${field} é obrigatório.`);
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} deve ser uma URL válida.`);
  }
  const raw = value.trim();
  if (hasForbiddenHtmlOrScript(raw)) {
    throw new Error(`${field} contém padrão inseguro.`);
  }
  if (SAFE_RELATIVE_PATH_RE.test(raw)) {
    return raw;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${field} deve ser uma URL https:// válida ou caminho relativo local (/...).`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${field} deve usar HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${field} não pode conter credenciais na URL.`);
  }
  return parsed.toString();
}

export function validateCtaTarget(actionType: AdCtaActionType, rawTarget: unknown): string {
  const target = typeof rawTarget === 'string' ? rawTarget.trim() : '';
  if (actionType === 'none') {
    return '';
  }
  if (!target || hasForbiddenHtmlOrScript(target)) {
    throw new Error('Destino do CTA inválido ou contém conteúdo não permitido.');
  }
  if (actionType === 'redeem_benefit') {
    if (SAFE_RELATIVE_PATH_RE.test(target) || COUPON_RE.test(target.toUpperCase())) {
      return SAFE_RELATIVE_PATH_RE.test(target) ? target : target.toUpperCase();
    }
    throw new Error('Destino de resgate de benefício deve ser uma rota interna (/...) ou código válido.');
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('Destino do CTA deve ser uma URL https:// válida.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Destino do CTA deve usar HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Destino do CTA não pode conter credenciais.');
  }
  if (actionType === 'whatsapp') {
    const host = parsed.hostname.toLowerCase();
    if (host !== 'wa.me' && host !== 'api.whatsapp.com') {
      throw new Error('CTA de WhatsApp deve apontar para https://wa.me/... ou https://api.whatsapp.com/...');
    }
  }
  return parsed.toString();
}

export function parseOptionalTimestampMs(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    if (Number.isNaN(ms)) throw new Error('Data/hora inválida.');
    return ms;
  }
  if (typeof val === 'object' && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  throw new Error('Formato de data/hora inválido.');
}

export function validateSponsoredCampaignInput(raw: Record<string, unknown>): ValidatedSponsoredCampaign {
  const title = sanitizePlainText(raw.title, 'Título', 3, 100);
  const brand = sanitizePlainText(raw.brand, 'Marca patrocinadora', 2, 60);
  const description = sanitizePlainText(raw.description, 'Descrição', 5, 300);
  const category = sanitizePlainText(raw.category, 'Categoria', 2, 40);

  const assetApprovalStatus = (raw.assetApprovalStatus ?? 'pending_license') as AssetApprovalStatus;
  if (!['pending_license', 'approved', 'internal_placeholder'].includes(assetApprovalStatus)) {
    throw new Error('Status de licença de mídia inválido.');
  }
  const assetLicenseNote = sanitizePlainText(raw.assetLicenseNote ?? '', 'Nota de licença', 0, 200, false);

  const logoUrl = validateSafeMediaUrl(raw.logoUrl ?? '', 'Logo URL', false);
  const bannerUrl = validateSafeMediaUrl(raw.bannerUrl ?? '', 'Banner URL', false);

  const durationSeconds = Number(raw.durationSeconds ?? raw.minWatchSeconds ?? 15);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 300) {
    throw new Error('Duração deve ser um número inteiro entre 5 e 300 segundos.');
  }

  const rewardType = (raw.rewardType ?? 'diamonds') as AdRewardType;
  if (!['diamonds', 'coupon', 'shipping', 'none'].includes(rewardType)) {
    throw new Error('Tipo de recompensa inválido.');
  }

  let rewardDiamonds = Number(raw.rewardDiamonds ?? 0);
  if (rewardType === 'diamonds') {
    if (!Number.isInteger(rewardDiamonds) || rewardDiamonds < 1 || rewardDiamonds > 500) {
      throw new Error('Recompensa em diamantes deve ser inteiro entre 1 e 500.');
    }
  } else {
    rewardDiamonds = 0;
  }

  let rewardCouponCode: string | null = null;
  if (rewardType === 'coupon' || rewardType === 'shipping') {
    const rawCode = typeof raw.rewardCouponCode === 'string' ? raw.rewardCouponCode.trim().toUpperCase() : '';
    if (!COUPON_RE.test(rawCode)) {
      throw new Error('Código de cupom/benefício inválido (3–32 caracteres A-Z, 0-9, _, -).');
    }
    rewardCouponCode = rawCode;
  }

  const rewardTerms = sanitizePlainText(
    raw.rewardTerms ?? (rewardType === 'diamonds' ? 'Crédito confirmado após contagem no servidor.' : 'Válido conforme regras do Clube.'),
    'Termos da recompensa',
    3,
    240,
  );

  const ctaActionType = (raw.ctaActionType ?? 'none') as AdCtaActionType;
  if (!['whatsapp', 'external_url', 'redeem_benefit', 'none'].includes(ctaActionType)) {
    throw new Error('Tipo de ação do CTA inválido.');
  }
  const ctaLabel =
    ctaActionType === 'none'
      ? sanitizePlainText(raw.ctaLabel ?? '', 'Rótulo do CTA', 0, 40, false)
      : sanitizePlainText(raw.ctaLabel, 'Rótulo do CTA', 2, 40);
  const ctaTarget = validateCtaTarget(ctaActionType, raw.ctaTarget);

  const startsAtMs = parseOptionalTimestampMs(raw.startsAt);
  const endsAtMs = parseOptionalTimestampMs(raw.endsAt);
  if (startsAtMs !== null && endsAtMs !== null && startsAtMs >= endsAtMs) {
    throw new Error('Data inicial deve ser anterior à data final.');
  }

  const targetCondos = Array.isArray(raw.targetCondos)
    ? Array.from(
        new Set(
          raw.targetCondos
            .map((c) => (typeof c === 'string' ? c.trim() : ''))
            .filter((c) => c.length > 0 && c.length <= 80 && !hasForbiddenHtmlOrScript(c)),
        ),
      )
    : [];

  const eligibilityRule = (raw.eligibilityRule ?? 'all_residents') as AdEligibilityRule;
  if (!['all_residents', 'vip_only', 'first_order_only'].includes(eligibilityRule)) {
    throw new Error('Regra de elegibilidade inválida.');
  }

  const maxClaimsPerUserPerDay = Number(raw.maxClaimsPerUserPerDay ?? 1);
  if (!Number.isInteger(maxClaimsPerUserPerDay) || maxClaimsPerUserPerDay < 1 || maxClaimsPerUserPerDay > 50) {
    throw new Error('Limite diário por usuário deve ser entre 1 e 50.');
  }

  const maxClaimsPerUserTotal =
    raw.maxClaimsPerUserTotal === null || raw.maxClaimsPerUserTotal === undefined || raw.maxClaimsPerUserTotal === ''
      ? null
      : Number(raw.maxClaimsPerUserTotal);
  if (
    maxClaimsPerUserTotal !== null &&
    (!Number.isInteger(maxClaimsPerUserTotal) || maxClaimsPerUserTotal < 1 || maxClaimsPerUserTotal > 500)
  ) {
    throw new Error('Limite total por usuário deve ser entre 1 e 500.');
  }

  let totalBudgetDiamonds = Number(raw.totalBudgetDiamonds ?? 0);
  if (rewardType === 'diamonds') {
    if (!Number.isInteger(totalBudgetDiamonds) || totalBudgetDiamonds < rewardDiamonds) {
      throw new Error('Orçamento total de diamantes deve ser maior ou igual ao valor de uma recompensa.');
    }
  } else {
    totalBudgetDiamonds = Number.isInteger(totalBudgetDiamonds) && totalBudgetDiamonds >= 0 ? totalBudgetDiamonds : 0;
  }

  const totalBudgetClaims =
    raw.totalBudgetClaims === null || raw.totalBudgetClaims === undefined || raw.totalBudgetClaims === ''
      ? null
      : Number(raw.totalBudgetClaims);
  if (totalBudgetClaims !== null && (!Number.isInteger(totalBudgetClaims) || totalBudgetClaims < 1)) {
    throw new Error('Limite global de resgates deve ser um inteiro positivo.');
  }

  const internalNotes = sanitizePlainText(raw.internalNotes ?? '', 'Notas internas', 0, 500, false);
  const sponsorContact = sanitizePlainText(raw.sponsorContact ?? '', 'Contato do patrocinador', 0, 160, false);

  return {
    title,
    brand,
    description,
    category,
    logoUrl,
    bannerUrl,
    assetApprovalStatus,
    assetLicenseNote,
    durationSeconds,
    rewardType,
    rewardDiamonds,
    rewardCouponCode,
    rewardTerms,
    ctaLabel,
    ctaActionType,
    ctaTarget,
    startsAt: startsAtMs !== null ? new Date(startsAtMs).toISOString() : null,
    endsAt: endsAtMs !== null ? new Date(endsAtMs).toISOString() : null,
    startsAtMs,
    endsAtMs,
    targetCondos,
    eligibilityRule,
    maxClaimsPerUserPerDay,
    maxClaimsPerUserTotal,
    totalBudgetDiamonds,
    totalBudgetClaims,
    internalNotes,
    sponsorContact,
    verificationMode: 'server_watch_timer_only',
  };
}

export function toPublicCampaignPayload(id: string, raw: Record<string, unknown>): PublicSponsoredCampaign {
  const startsAtMs = parseOptionalTimestampMs(raw.startsAt ?? raw.startsAtMs ?? null);
  const endsAtMs = parseOptionalTimestampMs(raw.endsAt ?? raw.endsAtMs ?? null);
  const status: AdCampaignStatus =
    typeof raw.status === 'string' && ['draft', 'scheduled', 'active', 'paused', 'ended', 'archived'].includes(raw.status)
      ? (raw.status as AdCampaignStatus)
      : raw.active === true
        ? 'active'
        : 'paused';

  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : `Campanha ${id}`,
    brand: typeof raw.brand === 'string' ? raw.brand : 'Parceiro Local',
    description: typeof raw.description === 'string' ? raw.description : '',
    category: typeof raw.category === 'string' ? raw.category : 'Parceiro',
    logoUrl: typeof raw.logoUrl === 'string' ? raw.logoUrl : '',
    bannerUrl: typeof raw.bannerUrl === 'string' ? raw.bannerUrl : '',
    assetApprovalStatus:
      raw.assetApprovalStatus === 'approved' || raw.assetApprovalStatus === 'internal_placeholder'
        ? raw.assetApprovalStatus
        : 'pending_license',
    durationSeconds: Number(raw.durationSeconds ?? raw.minWatchSeconds ?? 15),
    rewardType:
      raw.rewardType === 'coupon' || raw.rewardType === 'shipping' || raw.rewardType === 'none'
        ? raw.rewardType
        : 'diamonds',
    rewardDiamonds: Number(raw.rewardDiamonds ?? 0),
    rewardCouponCode: typeof raw.rewardCouponCode === 'string' ? raw.rewardCouponCode : null,
    rewardTerms: typeof raw.rewardTerms === 'string' ? raw.rewardTerms : '',
    ctaLabel: typeof raw.ctaLabel === 'string' ? raw.ctaLabel : '',
    ctaActionType:
      raw.ctaActionType === 'whatsapp' || raw.ctaActionType === 'external_url' || raw.ctaActionType === 'redeem_benefit'
        ? raw.ctaActionType
        : 'none',
    ctaTarget: typeof raw.ctaTarget === 'string' ? raw.ctaTarget : '',
    status,
    startsAtMs,
    endsAtMs,
    targetCondos: Array.isArray(raw.targetCondos) ? raw.targetCondos.map(String) : [],
    eligibilityRule:
      raw.eligibilityRule === 'vip_only' || raw.eligibilityRule === 'first_order_only'
        ? raw.eligibilityRule
        : 'all_residents',
    maxClaimsPerUserPerDay: Number(raw.maxClaimsPerUserPerDay ?? 1),
    maxClaimsPerUserTotal:
      raw.maxClaimsPerUserTotal != null ? Number(raw.maxClaimsPerUserTotal) : null,
    verificationMode:
      raw.verificationMode === 's2s_provider_callback' ? 's2s_provider_callback' : 'server_watch_timer_only',
    version: Number(raw.version ?? 1),
  };
}

