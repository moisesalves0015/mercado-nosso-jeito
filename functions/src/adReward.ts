import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

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
  active: boolean;
  rewardDiamonds: number;
  minWatchSeconds: number;
  maxClaimsPerUserPerDay: number;
  maxClaimsPerUserTotal: number | null;
  totalBudgetDiamonds: number;
  spentDiamonds: number;
  startsAtMs: number | null;
  endsAtMs: number | null;
}

function validateCampaign(id: string, raw: Record<string, unknown> | undefined, nowMs: number): ParsedCampaign {
  if (!raw || raw.active !== true) {
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

  const rewardDiamonds = Number(raw.rewardDiamonds);
  if (!Number.isInteger(rewardDiamonds) || rewardDiamonds <= 0 || rewardDiamonds > 500) {
    throw new HttpsError('failed-precondition', 'Configuração de recompensa da campanha inválida.');
  }

  const minWatchSeconds = Number(raw.minWatchSeconds ?? 10);
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
  if (!Number.isFinite(totalBudgetDiamonds) || totalBudgetDiamonds <= 0) {
    throw new HttpsError('failed-precondition', 'Orçamento da campanha não configurado.');
  }
  if (spentDiamonds + rewardDiamonds > totalBudgetDiamonds) {
    throw new HttpsError('resource-exhausted', 'Orçamento total desta campanha foi esgotado.');
  }

  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `Campanha ${id}`,
    active: true,
    rewardDiamonds,
    minWatchSeconds,
    maxClaimsPerUserPerDay,
    maxClaimsPerUserTotal,
    totalBudgetDiamonds,
    spentDiamonds,
    startsAtMs,
    endsAtMs,
  };
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

  const startAdWatchSession = functions.https.onCall(async (data, context) => {
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

      if (userSnap.exists && (userSnap.data() as { role?: string })?.role === 'banned') {
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

      const campaign = validateCampaign(
        campaignId,
        campaignSnap.exists ? (campaignSnap.data() as Record<string, unknown>) : undefined,
        nowMs,
      );

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
      const expiresAtMillis = nowMs + Math.max(campaign.minWatchSeconds * 1000 + 5 * 60_000, 10 * 60_000);

      tx.set(sessionRef, {
        uid,
        campaignId,
        campaignTitle: campaign.title,
        status: 'started',
        startedAtMillis: nowMs,
        expiresAtMillis,
        minWatchSeconds: campaign.minWatchSeconds,
        rewardDiamonds: campaign.rewardDiamonds,
        periodKey,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(rateRef, {
        lastStartedAtMillis: nowMs,
        windowStartedAtMillis: inSameWindow ? windowStart : nowMs,
        windowCount: windowCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        sessionId: sessionRef.id,
        campaignId,
        campaignTitle: campaign.title,
        minWatchSeconds: campaign.minWatchSeconds,
        rewardDiamonds: campaign.rewardDiamonds,
        startedAtMillis: nowMs,
      };
    });
  });

  const claimAdReward = functions.https.onCall(async (data, context) => {
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
      if (userSnap.exists && (userSnap.data() as { role?: string })?.role === 'banned') {
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
          newBalance: Number(session.balanceAfter ?? 0),
          grantedAmount: Number(session.rewardDiamonds ?? 0),
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

      const [campaignSnap, usageSnap] = await Promise.all([tx.get(campaignRef), tx.get(usageRef)]);
      const campaign = validateCampaign(
        campaignId,
        campaignSnap.exists ? (campaignSnap.data() as Record<string, unknown>) : undefined,
        nowMs,
      );

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
          verificationMode: 'server_watch_timer_only',
        },
        historyEntry: {
          desc: `Anúncio: ${campaign.title}`,
          date: `Hoje, ${formatSaoPauloTime(nowMs)}`,
          value: `+${campaign.rewardDiamonds}`,
          isPlus: true,
        },
      });

      tx.update(sessionRef, {
        status: 'claimed',
        claimedAtMillis: nowMs,
        balanceAfter: grantResult.newBalance,
        rewardDiamonds: campaign.rewardDiamonds,
        idempotencyKey,
      });

      tx.update(campaignRef, {
        spentDiamonds: campaign.spentDiamonds + campaign.rewardDiamonds,
        claimsCount: Number((campaignSnap.data() as Record<string, unknown>)?.claimsCount ?? 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(usageRef, {
        uid,
        campaignId,
        dailyCounts: { ...dailyCounts, [periodKey]: nextDailyCount },
        totalCount: totalClaims + 1,
        lastClaimedAtMillis: nowMs,
      });

      return {
        success: true,
        newBalance: grantResult.newBalance,
        grantedAmount: campaign.rewardDiamonds,
        alreadyProcessed: grantResult.alreadyProcessed,
      };
    });
  });

  return { startAdWatchSession, claimAdReward };
}
