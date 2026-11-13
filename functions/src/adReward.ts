import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { publicCallable } from './invoker';
import * as crypto from 'crypto';
import {
  AdRewardType,
  AdVerificationMode,
  toPublicCampaignPayload,
} from './sponsoredCampaignSchema';

const HttpsError = functions.https.HttpsError;

export interface GrantRewardFn {
  (
    transaction: admin.firestore.Transaction,
    opts: {
      uid: string;
      type: 'MISSION_REWARD';
      amount: number;
      sourceId: string;
      idempotencyKey: string;
      metadata?: Record<string, unknown>;
      historyEntry?: { desc: string; date: string; value: string; isPlus: boolean } | null;
    },
  ): Promise<{ newBalance: number; alreadyProcessed: boolean }>;
}

const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const START_COOLDOWN_MS = 3_000;
const RATE_WINDOW_MS = 60 * 60_000;
const MAX_STARTS_PER_HOUR = 30;
const MAX_GLOBAL_CLAIMS_PER_DAY = 20;

function toMillis(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof val === 'object' && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Returns YYYY-MM-DD in America/Sao_Paulo. */
export function getSaoPauloDateKey(nowMs: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function formatSaoPauloTime(nowMs: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(nowMs));
}

function assertAppCheckIfEnforced(context: functions.https.CallableContext): void {
  if (process.env.ENFORCE_APP_CHECK === 'true' && !context.app) {
    throw new HttpsError(
      'failed-precondition',
      'Verificação de integridade do aplicativo (App Check) necessária.',
    );
  }
}

interface ParsedCampaign {
  id: string;
  title: string;
  brand: string;
  active: boolean;
  rewardType: AdRewardType;
  rewardDiamonds: number;
  rewardCouponCode: string | null;
  rewardTerms: string;
  minWatchSeconds: number;
  maxClaimsPerUserPerDay: number;
  maxClaimsPerUserTotal: number | null;
  totalBudgetDiamonds: number;
  spentDiamonds: number;
  totalBudgetClaims: number | null;
  claimsCount: number;
  startsAtMs: number | null;
  endsAtMs: number | null;
  targetCondos: string[];
  verificationMode: AdVerificationMode;
}

function isCampaignActiveStatus(raw: Record<string, unknown> | undefined): boolean {
  if (!raw) return false;
  if (typeof raw.status === 'string') {
    return raw.status === 'active';
  }
  return raw.active === true;
}

function validateCampaign(id: string, raw: Record<string, unknown> | undefined, nowMs: number): ParsedCampaign {
  if (!raw || !isCampaignActiveStatus(raw)) {
    throw new HttpsError('failed-precondition', 'Campanha de anúncio indisponível ou pausada.');
  }
  const startsAtMs = toMillis(raw.startsAt);
  const endsAtMs = toMillis(raw.endsAt);
  if (startsAtMs !== null && nowMs < startsAtMs) {
    throw new HttpsError('failed-precondition', 'Campanha de anúncio ainda não iniciou.');
  }
  if (endsAtMs !== null && nowMs > endsAtMs) {
    throw new HttpsError('failed-precondition', 'Campanha de anúncio expirada.');
  }

  const rewardType: AdRewardType =
    raw.rewardType === 'coupon' || raw.rewardType === 'shipping' || raw.rewardType === 'none'
      ? raw.rewardType
      : 'diamonds';

  const rewardDiamonds = rewardType === 'diamonds' ? Number(raw.rewardDiamonds) : 0;
  if (rewardType === 'diamonds' && (!Number.isInteger(rewardDiamonds) || rewardDiamonds <= 0 || rewardDiamonds > 500)) {
    throw new HttpsError('failed-precondition', 'Configuração de recompensa da campanha inválida.');
  }

  const rewardCouponCode =
    rewardType === 'coupon' || rewardType === 'shipping'
      ? (typeof raw.rewardCouponCode === 'string' && raw.rewardCouponCode.trim()
          ? raw.rewardCouponCode.trim().toUpperCase()
          : null)
      : null;

  if ((rewardType === 'coupon' || rewardType === 'shipping') && !rewardCouponCode) {
    throw new HttpsError('failed-precondition', 'Cupom/benefício da campanha não configurado.');
  }

  const minWatchSeconds = Number(raw.durationSeconds ?? raw.minWatchSeconds ?? 10);
  if (!Number.isInteger(minWatchSeconds) || minWatchSeconds < 5 || minWatchSeconds > 300) {
    throw new HttpsError('failed-precondition', 'Tempo mínimo da campanha inválido.');
  }

  const maxClaimsPerUserPerDay = Number(raw.maxClaimsPerUserPerDay ?? 1);
  if (!Number.isInteger(maxClaimsPerUserPerDay) || maxClaimsPerUserPerDay < 1) {
    throw new HttpsError('failed-precondition', 'Limite diário da campanha inválido.');
  }

  const maxClaimsPerUserTotal =
    raw.maxClaimsPerUserTotal !== undefined && raw.maxClaimsPerUserTotal !== null
      ? Number(raw.maxClaimsPerUserTotal)
      : null;

  const totalBudgetDiamonds = Number(raw.totalBudgetDiamonds ?? 0);
  const spentDiamonds = Number(raw.spentDiamonds ?? 0);
  if (rewardType === 'diamonds') {
    if (!Number.isFinite(totalBudgetDiamonds) || totalBudgetDiamonds <= 0) {
      throw new HttpsError('failed-precondition', 'Orçamento da campanha não configurado.');
    }
    if (spentDiamonds + rewardDiamonds > totalBudgetDiamonds) {
      throw new HttpsError('resource-exhausted', 'Orçamento total desta campanha foi esgotado.');
    }
  }

  const totalBudgetClaims =
    raw.totalBudgetClaims !== undefined && raw.totalBudgetClaims !== null
      ? Number(raw.totalBudgetClaims)
      : null;
  const claimsCount = Number(raw.claimsCount ?? 0);
  if (totalBudgetClaims !== null && claimsCount + 1 > totalBudgetClaims) {
    throw new HttpsError('resource-exhausted', 'Limite global de resgates desta campanha foi esgotado.');
  }

  const targetCondos = Array.isArray(raw.targetCondos)
    ? raw.targetCondos.map((c) => String(c).trim()).filter(Boolean)
    : [];

  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `Campanha ${id}`,
    brand: typeof raw.brand === 'string' && raw.brand.trim() ? raw.brand.trim() : 'Parceiro',
    active: true,
    rewardType,
    rewardDiamonds,
    rewardCouponCode,
    rewardTerms: typeof raw.rewardTerms === 'string' ? raw.rewardTerms : '',
    minWatchSeconds,
    maxClaimsPerUserPerDay,
    maxClaimsPerUserTotal,
    totalBudgetDiamonds,
    spentDiamonds,
    totalBudgetClaims,
    claimsCount,
    startsAtMs,
    endsAtMs,
    targetCondos,
    verificationMode:
      raw.verificationMode === 's2s_provider_callback' ? 's2s_provider_callback' : 'server_watch_timer_only',
  };
}

function resolveUserCondo(userData: Record<string, unknown> | undefined): string | null {
  if (!userData) return null;
  const raw = userData.condominium ?? userData.condo ?? userData.condoName ?? null;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function matchesCondoEligibility(targetCondos: string[], userCondo: string | null): boolean {
  if (targetCondos.length === 0) return true;
  if (!userCondo) return false;
  const normalized = userCondo.toLowerCase();
  return targetCondos.some((c) => c.toLowerCase() === normalized);
}

/**
 * NOTE ON LIMITATIONS:
 * Without a trusted server-to-server callback from an ad network (S2S postback),
 * server-side watch-session timing + App Check + rate limiting can prevent instant
 * replay and burst farming, but CANNOT cryptographically prove human ad viewing.
 */
export function createAdRewardHandlers(deps: {
  grantReward: GrantRewardFn;
  now?: () => number;
}) {
  const db = () => admin.firestore();
  const now = deps.now ?? (() => Date.now());

  const listPublicAdCampaigns = publicCallable.https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    assertAppCheckIfEnforced(context);
    if (context.auth.token?.['banned'] === true) {
      throw new HttpsError('permission-denied', 'Conta suspensa.');
    }

    const uid = context.auth.uid;
    const nowMs = now();
    const periodKey = getSaoPauloDateKey(nowMs);

    const [userSnap, campaignsSnap, sessionsSnap] = await Promise.all([
      db().collection('users').doc(uid).get(),
      db().collection('ad_campaigns').where('active', '==', true).get(),
      db()
        .collection('ad_watch_sessions')
        .where('uid', '==', uid)
        .where('status', '==', 'started')
        .get(),
    ]);

    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : undefined;
    if (userData?.role === 'banned') {
      throw new HttpsError('permission-denied', 'Conta suspensa.');
    }
    const userCondo = resolveUserCondo(userData);

    const activeSessionsByCampaign = new Map<string, { sessionId: string; startedAtMillis: number; minWatchSeconds: number; expiresAtMillis: number }>();
    for (const doc of sessionsSnap.docs) {
      const s = doc.data() as Record<string, unknown>;
      const expiresAtMillis = Number(s.expiresAtMillis ?? 0);
      if (expiresAtMillis > nowMs && typeof s.campaignId === 'string') {
        activeSessionsByCampaign.set(s.campaignId, {
          sessionId: doc.id,
          startedAtMillis: Number(s.startedAtMillis ?? nowMs),
          minWatchSeconds: Number(s.minWatchSeconds ?? 10),
          expiresAtMillis,
        });
      }
    }

    const eligibleRaw: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const doc of campaignsSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!isCampaignActiveStatus(data)) continue;
      const startsAtMs = toMillis(data.startsAt);
      const endsAtMs = toMillis(data.endsAt);
      if (startsAtMs !== null && nowMs < startsAtMs) continue;
      if (endsAtMs !== null && nowMs > endsAtMs) continue;

      const rewardType = (data.rewardType as string) ?? 'diamonds';
      if (rewardType === 'diamonds') {
        const budget = Number(data.totalBudgetDiamonds ?? 0);
        const spent = Number(data.spentDiamonds ?? 0);
        const reward = Number(data.rewardDiamonds ?? 0);
        if (budget <= 0 || spent + reward > budget) continue;
      }
      if (data.totalBudgetClaims != null) {
        const claimsCount = Number(data.claimsCount ?? 0);
        if (claimsCount >= Number(data.totalBudgetClaims)) continue;
      }

      const targetCondos = Array.isArray(data.targetCondos)
        ? data.targetCondos.map((c) => String(c).trim()).filter(Boolean)
        : [];
      if (!matchesCondoEligibility(targetCondos, userCondo)) continue;

      eligibleRaw.push({ id: doc.id, data });
    }

    const usageSnaps = await Promise.all(
      eligibleRaw.map((item) => db().collection('ad_usage').doc(`${uid}_${item.id}`).get()),
    );

    const campaigns = eligibleRaw.map((item, idx) => {
      const pub = toPublicCampaignPayload(item.id, item.data);
      const usage = usageSnaps[idx]?.exists ? (usageSnaps[idx].data() as Record<string, unknown>) : {};
      const dailyCounts = (usage.dailyCounts as Record<string, number> | undefined) ?? {};
      const userClaimsToday = Number(dailyCounts[periodKey] ?? 0);
      const userClaimsTotal = Number(usage.totalCount ?? 0);
      const reachedDaily = userClaimsToday >= pub.maxClaimsPerUserPerDay;
      const reachedTotal = pub.maxClaimsPerUserTotal !== null && userClaimsTotal >= pub.maxClaimsPerUserTotal;
      return {
        ...pub,
        userClaimsToday,
        userClaimsTotal,
        canClaim: !reachedDaily && !reachedTotal,
        activeSession: activeSessionsByCampaign.get(item.id) ?? null,
      };
    });

    return { campaigns };
  });

  const startAdWatchSession = publicCallable.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    assertAppCheckIfEnforced(context);
    if (context.auth.token?.['banned'] === true) {
      throw new HttpsError('permission-denied', 'Conta suspensa.');
    }

    const req = (data ?? {}) as { campaignId?: unknown };
    if (typeof req.campaignId !== 'string' || !ID_RE.test(req.campaignId.trim())) {
      throw new HttpsError('invalid-argument', 'campaignId inválido.');
    }
    const campaignId = req.campaignId.trim();
    const uid = context.auth.uid;
    const nowMs = now();
    const periodKey = getSaoPauloDateKey(nowMs);

    return db().runTransaction(async (tx) => {
      const userRef = db().collection('users').doc(uid);
      const campaignRef = db().collection('ad_campaigns').doc(campaignId);
      const usageRef = db().collection('ad_usage').doc(`${uid}_${campaignId}`);
      const rateRef = db().collection('ad_watch_rate').doc(uid);

      const [userSnap, campaignSnap, usageSnap, rateSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(campaignRef),
        tx.get(usageRef),
        tx.get(rateRef),
      ]);

      const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : undefined;
      if (userData?.role === 'banned') {
        throw new HttpsError('permission-denied', 'Conta suspensa.');
      }

      // Rate-limit session creation per user
      const rate = rateSnap.exists ? (rateSnap.data() as Record<string, unknown>) : {};
      const lastStarted = Number(rate.lastStartedAtMillis ?? 0);
      if (lastStarted > 0 && nowMs - lastStarted < START_COOLDOWN_MS) {
        throw new HttpsError('resource-exhausted', 'Aguarde alguns segundos antes de iniciar outro anúncio.');
      }
      const windowStart = Number(rate.windowStartedAtMillis ?? 0);
      const inSameWindow = windowStart > 0 && nowMs - windowStart < RATE_WINDOW_MS;
      const windowCount = inSameWindow ? Number(rate.windowCount ?? 0) : 0;
      if (windowCount >= MAX_STARTS_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Limite de sessões de anúncio por hora atingido.');
      }

      const globalDailyCounts = (rate.dailyClaims as Record<string, number> | undefined) ?? {};
      if (Number(globalDailyCounts[periodKey] ?? 0) >= MAX_GLOBAL_CLAIMS_PER_DAY) {
        throw new HttpsError('resource-exhausted', 'Limite diário global de anúncios atingido.');
      }

      const campaign = validateCampaign(
        campaignId,
        campaignSnap.exists ? (campaignSnap.data() as Record<string, unknown>) : undefined,
        nowMs,
      );

      const userCondo = resolveUserCondo(userData);
      if (!matchesCondoEligibility(campaign.targetCondos, userCondo)) {
        throw new HttpsError('permission-denied', 'Campanha não disponível para o seu condomínio.');
      }

      const usage = usageSnap.exists ? (usageSnap.data() as Record<string, unknown>) : {};
      const dailyCounts = (usage.dailyCounts as Record<string, number> | undefined) ?? {};
      const todayClaims = Number(dailyCounts[periodKey] ?? 0);
      const totalClaims = Number(usage.totalCount ?? 0);

      if (todayClaims >= campaign.maxClaimsPerUserPerDay) {
        throw new HttpsError('resource-exhausted', 'Limite diário de recompensas para este anúncio atingido.');
      }
      if (campaign.maxClaimsPerUserTotal !== null && totalClaims >= campaign.maxClaimsPerUserTotal) {
        throw new HttpsError('resource-exhausted', 'Limite total de resgates para este anúncio atingido.');
      }

      const sessionRef = db().collection('ad_watch_sessions').doc();
      const sessionToken = crypto.randomBytes(16).toString('hex');
      const expiresAtMillis = nowMs + Math.max(campaign.minWatchSeconds * 1000 + 5 * 60_000, 10 * 60_000);

      tx.set(sessionRef, {
        uid,
        campaignId,
        campaignTitle: campaign.title,
        sessionToken,
        status: 'started',
        startedAtMillis: nowMs,
        expiresAtMillis,
        minWatchSeconds: campaign.minWatchSeconds,
        rewardType: campaign.rewardType,
        rewardDiamonds: campaign.rewardDiamonds,
        rewardCouponCode: campaign.rewardCouponCode,
        verificationMode: campaign.verificationMode,
        periodKey,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(
        rateRef,
        {
          lastStartedAtMillis: nowMs,
          windowStartedAtMillis: inSameWindow ? windowStart : nowMs,
          windowCount: windowCount + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        sessionId: sessionRef.id,
        campaignId,
        campaignTitle: campaign.title,
        minWatchSeconds: campaign.minWatchSeconds,
        rewardType: campaign.rewardType,
        rewardDiamonds: campaign.rewardDiamonds,
        rewardCouponCode: campaign.rewardCouponCode,
        verificationMode: campaign.verificationMode,
        startedAtMillis: nowMs,
        expiresAtMillis,
      };
    });
  });

  const claimAdReward = publicCallable.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    assertAppCheckIfEnforced(context);
    if (context.auth.token?.['banned'] === true) {
      throw new HttpsError('permission-denied', 'Conta suspensa.');
    }

    const req = (data ?? {}) as { sessionId?: unknown };
    if (typeof req.sessionId !== 'string' || !ID_RE.test(req.sessionId.trim())) {
      throw new HttpsError('invalid-argument', 'sessionId inválido.');
    }
    const sessionId = req.sessionId.trim();
    const uid = context.auth.uid;
    const nowMs = now();

    return db().runTransaction(async (tx) => {
      const sessionRef = db().collection('ad_watch_sessions').doc(sessionId);
      const userRef = db().collection('users').doc(uid);

      const [sessionSnap, userSnap] = await Promise.all([tx.get(sessionRef), tx.get(userRef)]);
      const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : undefined;
      if (userData?.role === 'banned') {
        throw new HttpsError('permission-denied', 'Conta suspensa.');
      }
      if (!sessionSnap.exists) {
        throw new HttpsError('not-found', 'Sessão de visualização não encontrada.');
      }

      const session = sessionSnap.data() as Record<string, unknown>;
      if (session.uid !== uid) {
        throw new HttpsError('permission-denied', 'Esta sessão não pertence ao usuário autenticado.');
      }

      if (session.status === 'claimed') {
        return {
          success: true,
          rewardType: (session.rewardType as AdRewardType) ?? 'diamonds',
          newBalance: session.balanceAfter != null ? Number(session.balanceAfter) : undefined,
          grantedAmount: Number(session.rewardDiamonds ?? 0),
          grantedCouponCode: (session.rewardCouponCode as string | null) ?? null,
          rewardTerms: (session.rewardTerms as string) ?? '',
          verificationMode: (session.verificationMode as AdVerificationMode) ?? 'server_watch_timer_only',
          alreadyProcessed: true,
        };
      }

      const expiresAtMillis = Number(session.expiresAtMillis ?? 0);
      if (nowMs > expiresAtMillis) {
        throw new HttpsError('failed-precondition', 'Sessão de visualização expirada.');
      }

      const startedAtMillis = Number(session.startedAtMillis ?? 0);
      const minWatchSeconds = Number(session.minWatchSeconds ?? 10);
      if (nowMs - startedAtMillis < minWatchSeconds * 1000) {
        throw new HttpsError('failed-precondition', 'Tempo mínimo de visualização ainda não atingido.');
      }

      const campaignId = String(session.campaignId ?? '');
      const periodKey = String(session.periodKey ?? getSaoPauloDateKey(nowMs));
      const campaignRef = db().collection('ad_campaigns').doc(campaignId);
      const usageRef = db().collection('ad_usage').doc(`${uid}_${campaignId}`);
      const rateRef = db().collection('ad_watch_rate').doc(uid);
      const profileRef = db().collection('users').doc(uid).collection('clube').doc('profile');

      const [campaignSnap, usageSnap, rateSnap, profileSnap] = await Promise.all([
        tx.get(campaignRef),
        tx.get(usageRef),
        tx.get(rateRef),
        tx.get(profileRef),
      ]);

      const campaign = validateCampaign(
        campaignId,
        campaignSnap.exists ? (campaignSnap.data() as Record<string, unknown>) : undefined,
        nowMs,
      );

      const userCondo = resolveUserCondo(userData);
      if (!matchesCondoEligibility(campaign.targetCondos, userCondo)) {
        throw new HttpsError('permission-denied', 'Campanha não disponível para o seu condomínio.');
      }

      const rate = rateSnap.exists ? (rateSnap.data() as Record<string, unknown>) : {};
      const globalDailyClaims = (rate.dailyClaims as Record<string, number> | undefined) ?? {};
      const globalToday = Number(globalDailyClaims[periodKey] ?? 0);
      if (globalToday >= MAX_GLOBAL_CLAIMS_PER_DAY) {
        throw new HttpsError('resource-exhausted', 'Limite diário global de anúncios atingido.');
      }

      const usage = usageSnap.exists ? (usageSnap.data() as Record<string, unknown>) : {};
      const dailyCounts = (usage.dailyCounts as Record<string, number> | undefined) ?? {};
      const todayClaims = Number(dailyCounts[periodKey] ?? 0);
      const totalClaims = Number(usage.totalCount ?? 0);

      if (todayClaims >= campaign.maxClaimsPerUserPerDay) {
        throw new HttpsError('resource-exhausted', 'Limite diário de recompensas para este anúncio atingido.');
      }
      if (campaign.maxClaimsPerUserTotal !== null && totalClaims >= campaign.maxClaimsPerUserTotal) {
        throw new HttpsError('resource-exhausted', 'Limite total de resgates para este anúncio atingido.');
      }

      const nextDailyCount = todayClaims + 1;
      const idempotencyKey = `ad-reward:${uid}:${campaignId}:${periodKey}:${nextDailyCount}`;

      let newBalance: number | undefined;
      let alreadyProcessed = false;

      if (campaign.rewardType === 'diamonds') {
        const grantResult = await deps.grantReward(tx, {
          uid,
          type: 'MISSION_REWARD',
          amount: campaign.rewardDiamonds,
          sourceId: campaignId,
          idempotencyKey,
          metadata: {
            action: 'watched_ad',
            campaignId,
            sessionId,
            periodKey,
            verificationMode: campaign.verificationMode,
          },
          historyEntry: {
            desc: `Anúncio: ${campaign.title}`,
            date: `Hoje, ${formatSaoPauloTime(nowMs)}`,
            value: `+${campaign.rewardDiamonds}`,
            isPlus: true,
          },
        });
        newBalance = grantResult.newBalance;
        alreadyProcessed = grantResult.alreadyProcessed;
      } else if (campaign.rewardType === 'coupon' || campaign.rewardType === 'shipping') {
        const claimDocRef = db().collection('reward_claims').doc(idempotencyKey);
        const existingClaim = await tx.get(claimDocRef);
        if (existingClaim.exists) {
          alreadyProcessed = true;
        } else {
          tx.set(claimDocRef, {
            userId: uid,
            campaignId,
            sessionId,
            rewardType: campaign.rewardType,
            couponCode: campaign.rewardCouponCode,
            rewardTerms: campaign.rewardTerms,
            periodKey,
            verificationMode: campaign.verificationMode,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        if (profileSnap.exists) {
          const pData = profileSnap.data() as { history?: unknown[] };
          const curHistory = Array.isArray(pData.history) ? pData.history : [];
          const entry = {
            desc: `Benefício (${campaign.brand}): ${campaign.rewardCouponCode}`,
            date: `Hoje, ${formatSaoPauloTime(nowMs)}`,
            value: campaign.rewardType === 'shipping' ? 'FRETE' : 'CUPOM',
            isPlus: true,
          };
          tx.update(profileRef, {
            history: [entry, ...curHistory].slice(0, 100),
          });
        }
      }

      if (profileSnap.exists) {
        const pData = profileSnap.data() as { completedAds?: unknown[] };
        const curCompleted = Array.isArray(pData.completedAds) ? pData.completedAds.map(String) : [];
        if (!curCompleted.includes(campaignId)) {
          tx.update(profileRef, {
            completedAds: [...curCompleted, campaignId],
          });
        }
      }

      tx.update(sessionRef, {
        status: 'claimed',
        claimedAtMillis: nowMs,
        rewardType: campaign.rewardType,
        balanceAfter: newBalance ?? null,
        rewardDiamonds: campaign.rewardDiamonds,
        rewardCouponCode: campaign.rewardCouponCode,
        rewardTerms: campaign.rewardTerms,
        verificationMode: campaign.verificationMode,
        idempotencyKey,
      });

      tx.update(campaignRef, {
        spentDiamonds: campaign.spentDiamonds + campaign.rewardDiamonds,
        claimsCount: campaign.claimsCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(usageRef, {
        uid,
        campaignId,
        dailyCounts: { ...dailyCounts, [periodKey]: nextDailyCount },
        totalCount: totalClaims + 1,
        lastClaimedAtMillis: nowMs,
      });

      tx.set(
        rateRef,
        {
          dailyClaims: { ...globalDailyClaims, [periodKey]: globalToday + 1 },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        success: true,
        rewardType: campaign.rewardType,
        newBalance,
        grantedAmount: campaign.rewardDiamonds,
        grantedCouponCode: campaign.rewardCouponCode,
        rewardTerms: campaign.rewardTerms,
        verificationMode: campaign.verificationMode,
        alreadyProcessed,
      };
    });
  });

  return { listPublicAdCampaigns, startAdWatchSession, claimAdReward };
}
