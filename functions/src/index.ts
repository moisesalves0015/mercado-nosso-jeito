import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { applyStaffRole, requirePermission } from './admin/rbac';

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type TransactionType =
  | 'DAILY_CHECKIN'
  | 'FREE_SPIN'
  | 'PREMIUM_SPIN_DEBIT'
  | 'PREMIUM_SPIN_CREDIT'
  | 'MISSION_REWARD'
  | 'REFERRAL_BONUS'
  | 'FIRST_ORDER_BONUS'
  | 'WELCOME_BONUS'
  | 'ADMIN_GRANT';

type RewardClaimStatus = 'PENDING' | 'ELIGIBLE' | 'GRANTED' | 'REVERSED' | 'EXPIRED';

interface RoulettePrize {
  id: string;
  weight: number;
  amount: number;
  description: string;
}

interface CampaignConfig {
  id: string;
  version: number;
  active: boolean;
  roulette: {
    premiumCost: number;
    prizes: RoulettePrize[];
  };
  missions: {
    firstOrder: { reward: number };
    referral: { reward: number };
    combo: { reward: number };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const CHECKIN_REWARDS: Record<number, number> = { 1: 15, 2: 15, 3: 15, 4: 15, 5: 20, 6: 20, 7: 50 };

const DEFAULT_CAMPAIGN: CampaignConfig = {
  id: 'default',
  version: 1,
  active: true,
  roulette: {
    premiumCost: 50,
    prizes: [
      { id: 'none',   weight: 70, amount: 0,   description: 'Tente de Novo' },
      { id: 'small',  weight: 25, amount: 15,  description: '15 Diamantes' },
      { id: 'medium', weight: 3,  amount: 50,  description: '50 Diamantes' },
      { id: 'large',  weight: 2,  amount: 100, description: '100 Diamantes' },
    ],
  },
  missions: {
    firstOrder: { reward: 100 },
    referral:   { reward: 80  },
    combo:      { reward: 50  },
  },
};

/** Returns a BRT (UTC-3) date string: "YYYY-MM-DD" */
const getBRTDateString = (date: Date = new Date()): string => {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().split('T')[0];
};

const formatTime = (date: Date): string => {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return `${brt.getUTCHours()}:${brt.getUTCMinutes().toString().padStart(2, '0')}`;
};

/** Weighted random draw from a list of prizes. Throws if weights don't sum to 100. */
function drawPrize(prizes: RoulettePrize[]): RoulettePrize {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new functions.https.HttpsError(
      'internal',
      `Configuração de roleta inválida: pesos somam ${total}, esperado 100.`,
    );
  }
  const rand = Math.random() * 100;
  let accumulated = 0;
  for (const prize of prizes) {
    accumulated += prize.weight;
    if (rand < accumulated) return prize;
  }
  return prizes[prizes.length - 1];
}

/** Load the currently active campaign from Firestore, falling back to hardcoded default. */
async function loadActiveCampaign(): Promise<CampaignConfig> {
  try {
    const snap = await db
      .collection('campaign_configs')
      .where('active', '==', true)
      .orderBy('version', 'desc')
      .limit(1)
      .get();
    if (!snap.empty) {
      return snap.docs[0].data() as CampaignConfig;
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_CAMPAIGN;
}

// ─────────────────────────────────────────────────────────────────────────────
// grantReward — internal, never callable directly by clients
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Central function for all diamond credits and debits.
 * - Checks idempotency key to prevent double-grants.
 * - Reads current balance from the materialised profile.
 * - Creates an immutable ledger entry in `diamond_transactions`.
 * - Updates `profile.diamonds` (materialised balance).
 * All operations run inside the caller's Firestore transaction.
 */
async function grantReward(
  transaction: admin.firestore.Transaction,
  opts: {
    uid: string;
    type: TransactionType;
    amount: number;
    sourceId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    historyEntry?: { desc: string; date: string; value: string; isPlus: boolean } | null;
  },
): Promise<{ newBalance: number; alreadyProcessed: boolean }> {
  const profileRef = db.collection('users').doc(opts.uid).collection('clube').doc('profile');

  // Check idempotency before writing anything
  const txnRef = db.collection('diamond_operations').doc(opts.idempotencyKey);
  const existingSnap = await transaction.get(txnRef);

  if (existingSnap.exists) {
    const existingTxn = existingSnap.data()!;
    return { newBalance: existingTxn.balanceAfter as number, alreadyProcessed: true };
  }

  const profileSnap = await transaction.get(profileRef);
  const userDocRef = db.collection('users').doc(opts.uid);
  const userSnap = await transaction.get(userDocRef);

  const profileData = profileSnap.exists
    ? profileSnap.data()!
    : { diamonds: userSnap.exists ? ((userSnap.data()?.diamonds as number) ?? 0) : 0, history: [] as unknown[] };

  const balanceBefore: number = (profileData.diamonds as number) ?? 0;
  const balanceAfter: number = balanceBefore + opts.amount;

  if (balanceAfter < 0) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Saldo insuficiente para realizar esta operação.',
    );
  }

  // Immutable ledger entry
  transaction.set(txnRef, {
    userId: opts.uid,
    type: opts.type,
    amount: opts.amount,
    balanceBefore,
    balanceAfter,
    sourceId: opts.sourceId,
    idempotencyKey: opts.idempotencyKey,
    metadata: opts.metadata ?? {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system',
  });

  // Materialised balance update
  const updateData: Record<string, unknown> = { diamonds: balanceAfter };

  if (opts.historyEntry) {
    const currentHistory = (profileData.history as unknown[]) ?? [];
    // Cap history at 100 items to prevent unbounded document growth
    updateData.history = [opts.historyEntry, ...currentHistory].slice(0, 100);
  }

  if (profileSnap.exists) {
    transaction.update(profileRef, updateData);
  } else {
    transaction.set(profileRef, {
      diamonds: balanceAfter,
      streak: 0,
      current_day: 0,
      history: opts.historyEntry ? [opts.historyEntry] : [],
      freeSpinUsed: false,
      freeSpinDate: '',
      missions: { order: false, refer: false, combo: false },
      completedAds: [],
    });
  }

  if (userSnap.exists) {
    transaction.update(userDocRef, { diamonds: balanceAfter });
  }

  return { newBalance: balanceAfter, alreadyProcessed: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// initClubeProfile — callable; creates profile without touching diamonds
// ─────────────────────────────────────────────────────────────────────────────
export const initClubeProfile = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const uid = context.auth.uid;
  const profileRef = db.collection('users').doc(uid).collection('clube').doc('profile');

  const snap = await profileRef.get();
  if (snap.exists) {
    return { alreadyExists: true };
  }

  const now = new Date();
  const idempotencyKey = `welcome-bonus:${uid}`;

  await db.runTransaction(async (transaction) => {
    await grantReward(transaction, {
      uid,
      type: 'WELCOME_BONUS',
      amount: 320,
      sourceId: `welcome:${uid}`,
      idempotencyKey,
      historyEntry: {
        desc: 'Bem-vindo ao Clube!',
        date: `Hoje, ${formatTime(now)}`,
        value: '+320',
        isPlus: true,
      },
    });
  });

  return { alreadyExists: false, welcomeBonus: 320 };
});

// ─────────────────────────────────────────────────────────────────────────────
// dailyCheckin — idempotent via idempotencyKey in diamond_transactions
// ─────────────────────────────────────────────────────────────────────────────
export const dailyCheckin = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const uid = context.auth.uid;
  const now = new Date();
  const todayBRT = getBRTDateString(now);
  const idempotencyKey = `daily-checkin:${uid}:${todayBRT}`;

  // Pre-check before opening transaction for efficiency
  const existingSnap = await db
    .collection('diamond_transactions')
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();
  if (!existingSnap.empty) {
    throw new functions.https.HttpsError('already-exists', 'Você já realizou o check-in de hoje.');
  }

  const profileRef = db.collection('users').doc(uid).collection('clube').doc('profile');

  return await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(profileRef);
    const profileData = docSnap.exists
      ? docSnap.data()!
      : { diamonds: 0, current_day: 0, streak: 0, history: [], last_checkin_at: null };

    const lastCheckinStr: string | null = (profileData.last_checkin_at as string) ?? null;
    let currentDay: number = (profileData.current_day as number) || 0;
    let streak: number = (profileData.streak as number) || 0;

    if (lastCheckinStr) {
      const lastCheckinDate = new Date(lastCheckinStr);
      const lastCheckinBRT = getBRTDateString(lastCheckinDate);

      if (todayBRT === lastCheckinBRT) {
        throw new functions.https.HttpsError('already-exists', 'Você já realizou o check-in de hoje.');
      }

      const expectedNextDate = new Date(lastCheckinDate.getTime() + 24 * 60 * 60 * 1000);
      if (todayBRT === getBRTDateString(expectedNextDate)) {
        currentDay = currentDay >= 7 ? 1 : currentDay + 1;
        streak += 1;
      } else {
        currentDay = 1;
        streak = 1;
      }
    } else {
      currentDay = 1;
      streak = 1;
    }

    const rewardAmount = CHECKIN_REWARDS[currentDay] ?? 15;

    const { newBalance } = await grantReward(transaction, {
      uid,
      type: 'DAILY_CHECKIN',
      amount: rewardAmount,
      sourceId: `checkin:${todayBRT}`,
      idempotencyKey,
      metadata: { day: currentDay, streak },
      historyEntry: {
        desc: `Check-in Diário (Dia ${currentDay})`,
        date: `Hoje, ${formatTime(now)}`,
        value: `+${rewardAmount}`,
        isPlus: true,
      },
    });

    // Update check-in tracking fields (separate from balance — grantReward handles diamonds)
    transaction.update(profileRef, {
      current_day: currentDay,
      streak,
      last_checkin_at: now.toISOString(),
    });

    // Gamification event for downstream processors
    const eventRef = db.collection('gamification_events').doc();
    transaction.set(eventRef, {
      type: 'DAILY_CHECKIN_COMPLETED',
      userId: uid,
      entityId: idempotencyKey,
      occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      payload: { day: currentDay, streak, reward: rewardAmount },
    });

    return { success: true, reward: rewardAmount, currentDay, streak, diamondsBalance: newBalance };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// spinRoulette — type-validated, backend-drawn prize, idempotent for free spins
// ─────────────────────────────────────────────────────────────────────────────
export const spinRoulette = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const uid = context.auth.uid;

  // Explicit type validation — reject anything outside the allowed set
  const { type } = data as { type: unknown };
  if (type !== 'free' && type !== 'premium') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Tipo de giro inválido: "${String(type)}". Use "free" ou "premium".`,
    );
  }

  const now = new Date();
  const todayBRT = getBRTDateString(now);

  const idempotencyKey = type === 'free'
    ? `free-spin:${uid}:${todayBRT}`
    : `premium-spin:${uid}:${Date.now()}`;

  // Free spin: pre-check idempotency before opening transaction
  if (type === 'free') {
    const existingSnap = await db
      .collection('diamond_transactions')
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      throw new functions.https.HttpsError('already-exists', 'Giro diário gratuito já utilizado hoje.');
    }
  }

  // Load campaign config from backend — client never controls prizes
  const campaign = await loadActiveCampaign();
  const { premiumCost, prizes } = campaign.roulette;

  // Draw prize on the backend — result is never supplied by the client
  const prize = drawPrize(prizes);

  const profileRef = db.collection('users').doc(uid).collection('clube').doc('profile');

  return await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(profileRef);
    if (!docSnap.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Perfil do clube não encontrado. Inicialize o clube primeiro.',
      );
    }
    const profile = docSnap.data()!;
    const currentDiamonds: number = (profile.diamonds as number) ?? 0;

    if (type === 'premium') {
      if (currentDiamonds < premiumCost) {
        throw new functions.https.HttpsError(
          'permission-denied',
          `Diamantes insuficientes. Necessário: ${premiumCost}, disponível: ${currentDiamonds}.`,
        );
      }

      // Debit premium cost atomically in the same transaction
      await grantReward(transaction, {
        uid,
        type: 'PREMIUM_SPIN_DEBIT',
        amount: -premiumCost,
        sourceId: `premium-spin-cost:${uid}:${Date.now()}`,
        idempotencyKey: `${idempotencyKey}:debit`,
        metadata: { campaignId: campaign.id, campaignVersion: campaign.version },
      });
    }

    let newBalance: number = currentDiamonds - (type === 'premium' ? premiumCost : 0);

    if (prize.amount > 0) {
      const creditResult = await grantReward(transaction, {
        uid,
        type: type === 'free' ? 'FREE_SPIN' : 'PREMIUM_SPIN_CREDIT',
        amount: prize.amount,
        sourceId: `spin-prize:${uid}:${Date.now()}`,
        idempotencyKey,
        metadata: {
          prizeId: prize.id,
          prizeDescription: prize.description,
          campaignId: campaign.id,
          campaignVersion: campaign.version,
          spinType: type,
        },
        historyEntry: {
          desc: `Roleta (${type === 'free' ? 'Grátis' : 'Premium'}): ${prize.description}`,
          date: `Hoje, ${formatTime(now)}`,
          value: `+${prize.amount}`,
          isPlus: true,
        },
      });
      newBalance = creditResult.newBalance;
    } else if (type === 'free') {
      // Record that free spin was used even without prize (idempotency)
      await grantReward(transaction, {
        uid,
        type: 'FREE_SPIN',
        amount: 0,
        sourceId: `spin-no-prize:${uid}:${todayBRT}`,
        idempotencyKey,
        metadata: { prizeId: prize.id, spinType: 'free', result: 'no_prize' },
      });
    }

    // Mark free spin status on profile for display
    if (type === 'free') {
      transaction.update(profileRef, {
        freeSpinUsed: true,
        freeSpinDate: todayBRT,
      });
    }

    // Gamification event
    const eventRef = db.collection('gamification_events').doc();
    transaction.set(eventRef, {
      type: 'ROULETTE_SPIN_COMPLETED',
      userId: uid,
      entityId: idempotencyKey,
      occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      payload: {
        spinType: type,
        prizeId: prize.id,
        prizeAmount: prize.amount,
        prizeDescription: prize.description,
        campaignId: campaign.id,
      },
    });

    return {
      success: true,
      prizeAmount: prize.amount,
      prizeDescription: prize.description,
      prizeId: prize.id,
      newBalance,
    };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processOrderDelivered — Firestore trigger; grants referral rewards only
// after an order is confirmed as delivered, not at order creation.
// ─────────────────────────────────────────────────────────────────────────────
export const processOrderDelivered = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const orderId = context.params.orderId;

    // Only process transitions TO 'delivered'
    if (before.status === 'delivered' || after.status !== 'delivered') {
      return null;
    }

    const uid: string = after.uid as string;
    const now = new Date();
    const tasks: Promise<unknown>[] = [];

    // ── Referral reward ──────────────────────────────────────────────────────
    const claimsSnap = await db
      .collection('reward_claims')
      .where('userId', '==', uid)
      .where('rewardType', '==', 'REFERRAL_TRIGGERED')
      .where('status', '==', 'PENDING')
      .limit(1)
      .get();

    if (!claimsSnap.empty) {
      const claim = claimsSnap.docs[0];
      const claimData = claim.data();
      const referrerUid: string = claimData.referrerUid as string;
      const claimId = claim.id;
      const referralKey = `referral:${referrerUid}:${uid}:delivered`;

      tasks.push(
        db.runTransaction(async (transaction) => {
          const claimRef = db.collection('reward_claims').doc(claimId);
          const freshClaim = await transaction.get(claimRef);
          if (!freshClaim.exists || freshClaim.data()!.status !== 'PENDING') return;

          await grantReward(transaction, {
            uid: referrerUid,
            type: 'REFERRAL_BONUS',
            amount: 80,
            sourceId: `referral:${uid}:${orderId}`,
            idempotencyKey: referralKey,
            metadata: { referredUid: uid, orderId, triggeredAt: 'delivered' },
            historyEntry: {
              desc: 'Indicação recompensada (1º pedido entregue)',
              date: `Hoje, ${formatTime(now)}`,
              value: '+80',
              isPlus: true,
            },
          });

          transaction.update(claimRef, {
            status: 'GRANTED' as RewardClaimStatus,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
            sourceOrderId: orderId,
          });

          const eventRef = db.collection('gamification_events').doc();
          transaction.set(eventRef, {
            type: 'REFERRAL_ORDER_COMPLETED',
            userId: referrerUid,
            entityId: orderId,
            occurredAt: admin.firestore.FieldValue.serverTimestamp(),
            payload: { referredUid: uid, reward: 80 },
          });
        }),
      );
    }

    // ── First-order delivery bonus for the buyer ─────────────────────────────
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists && !userSnap.data()!.firstOrderDeliveredRewarded) {
      const firstOrderKey = `first-order:${uid}:${orderId}`;
      tasks.push(
        db.runTransaction(async (transaction) => {
          const userRef = db.collection('users').doc(uid);
          const freshUser = await transaction.get(userRef);
          if (!freshUser.exists || freshUser.data()!.firstOrderDeliveredRewarded) return;

          await grantReward(transaction, {
            uid,
            type: 'FIRST_ORDER_BONUS',
            amount: 50,
            sourceId: `first-order:${orderId}`,
            idempotencyKey: firstOrderKey,
            metadata: { orderId },
            historyEntry: {
              desc: 'Bônus: 1º Pedido Entregue!',
              date: `Hoje, ${formatTime(now)}`,
              value: '+50',
              isPlus: true,
            },
          });

          transaction.update(userRef, { firstOrderDeliveredRewarded: true });
        }),
      );
    }

    await Promise.all(tasks);
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// claimMissionReward — callable; backend recalculates eligibility before grant
// ─────────────────────────────────────────────────────────────────────────────
export const claimMissionReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const uid = context.auth.uid;
  const now = new Date();

  type MissionId = 'firstOrder' | 'referral' | 'combo';
  const { missionId } = data as { missionId: unknown };
  const validMissions: MissionId[] = ['firstOrder', 'referral', 'combo'];
  if (!validMissions.includes(missionId as MissionId)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Missão inválida: "${String(missionId)}". Opções: ${validMissions.join(', ')}.`,
    );
  }

  const period = getBRTDateString(now).slice(0, 7); // "YYYY-MM"
  const idempotencyKey = `mission:${uid}:${String(missionId)}:${period}`;

  // Pre-check idempotency
  const existingSnap = await db
    .collection('diamond_transactions')
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();
  if (!existingSnap.empty) {
    throw new functions.https.HttpsError('already-exists', 'Esta missão já foi completada neste período.');
  }

  const campaign = await loadActiveCampaign();
  const profileRef = db.collection('users').doc(uid).collection('clube').doc('profile');

  let eligible = false;
  let reward = 0;
  let desc = '';

  // Recalculate eligibility from authoritative Firestore data — never trust the client
  if (missionId === 'firstOrder') {
    const ordersSnap = await db
      .collection('orders')
      .where('uid', '==', uid)
      .where('status', '==', 'delivered')
      .limit(1)
      .get();
    eligible = !ordersSnap.empty;
    reward = campaign.missions.firstOrder.reward;
    desc = 'Missão: Primeiro Pedido Entregue';
  } else if (missionId === 'referral') {
    const referredSnap = await db
      .collection('users')
      .where('referredBy', '==', uid)
      .where('firstOrderPlaced', '==', true)
      .limit(1)
      .get();
    eligible = !referredSnap.empty;
    reward = campaign.missions.referral.reward;
    desc = 'Missão: Indicação Concluída';
  } else if (missionId === 'combo') {
    const [ordersSnap, referredSnap] = await Promise.all([
      db.collection('orders').where('uid', '==', uid).where('status', '==', 'delivered').limit(1).get(),
      db.collection('users').where('referredBy', '==', uid).where('firstOrderPlaced', '==', true).limit(1).get(),
    ]);
    eligible = !ordersSnap.empty && !referredSnap.empty;
    reward = campaign.missions.combo.reward;
    desc = 'Missão Combo: Pedido + Indicação';
  }

  if (!eligible) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Você ainda não completou os requisitos desta missão.',
    );
  }

  return await db.runTransaction(async (transaction) => {
    const { newBalance, alreadyProcessed } = await grantReward(transaction, {
      uid,
      type: 'MISSION_REWARD',
      amount: reward,
      sourceId: `mission:${String(missionId)}:${period}`,
      idempotencyKey,
      metadata: { missionId, period, campaignId: campaign.id },
      historyEntry: {
        desc,
        date: `Hoje, ${formatTime(now)}`,
        value: `+${reward}`,
        isPlus: true,
      },
    });

    if (alreadyProcessed) {
      throw new functions.https.HttpsError('already-exists', 'Esta missão já foi completada neste período.');
    }

    transaction.update(profileRef, {
      [`missions.${String(missionId)}`]: true,
    });

    const eventRef = db.collection('gamification_events').doc();
    transaction.set(eventRef, {
      type: 'MISSION_COMPLETED',
      userId: uid,
      entityId: idempotencyKey,
      occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      payload: { missionId, reward, period },
    });

    return { success: true, reward, newBalance };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers (server-only)
// ─────────────────────────────────────────────────────────────────────────────

/** Normalises condos map from various Firestore shapes into Record<name, fee>. */
function normalizeCondosServer(rawCondos: unknown): Record<string, number> {
  if (!rawCondos) return {};
  if (Array.isArray(rawCondos)) {
    const result: Record<string, number> = {};
    for (const item of rawCondos) {
      if (typeof item === 'string' && item.trim()) {
        result[item.trim()] = 0;
      } else if (item && typeof item === 'object' && 'name' in item) {
        const o = item as { name: unknown; fee?: unknown };
        result[String(o.name).trim()] = Math.max(0, Number(o.fee) || 0);
      }
    }
    return result;
  }
  if (typeof rawCondos === 'object') {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawCondos as Record<string, unknown>)) {
      if (k && k.trim()) {
        result[k.trim()] = Math.max(0, Number(v) || 0);
      }
    }
    return result;
  }
  return {};
}

/**
 * Checks whether the caller is active and not banned.
 */
async function checkIsCallerBanned(contextAuth: { uid: string; token?: Record<string, unknown> }): Promise<boolean> {
  if (contextAuth.token && contextAuth.token['banned'] === true) return true;
  try {
    const snap = await db.collection('users').doc(contextAuth.uid).get();
    return snap.exists && snap.data()?.role === 'banned';
  } catch {
    return false;
  }
}

/**
 * Checks whether the caller has administrator privileges.
 * Automatically denies access if the user is banned (even if their token still carries admin: true).
 */
async function checkIsCallerAdmin(contextAuth: { uid: string; token?: Record<string, unknown> }): Promise<boolean> {
  if (contextAuth.token && contextAuth.token['banned'] === true) return false;
  try {
    const snap = await db.collection('users').doc(contextAuth.uid).get();
    if (snap.exists && snap.data()?.role === 'banned') return false;
    if (contextAuth.token && contextAuth.token['admin'] === true) return true;
    return snap.exists && snap.data()?.role === 'admin';
  } catch {
    return false;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// createOrder — Callable; all price/stock/coupon/shipping logic runs server-side
// ─────────────────────────────────────────────────────────────────────────────
export const createOrder = functions.https.onCall(async (data, context) => {
  try {
    // ── 1. Authentication & Ban check ──────────────────────────────────────────
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const uid = context.auth.uid;

    if (await checkIsCallerBanned({ uid, token: context.auth.token })) {
      throw new functions.https.HttpsError('permission-denied', 'Conta suspensa. Entre em contato com o suporte.');
    }

    // ── 2. Payload validation ─────────────────────────────────────────────────
    const req = data as {
      productItems?: unknown;
      addressId?: unknown;
      deliveryMethod?: unknown;
      paymentMethod?: unknown;
      couponCode?: unknown;
      idempotencyKey?: unknown;
      notes?: unknown;
    };

    if (typeof req.idempotencyKey !== 'string' || req.idempotencyKey.length < 8 || req.idempotencyKey.length > 128) {
      throw new functions.https.HttpsError('invalid-argument', 'Chave de idempotência inválida (8–128 caracteres).');
    }

    if (!Array.isArray(req.productItems) || req.productItems.length === 0 || req.productItems.length > 50) {
      throw new functions.https.HttpsError('invalid-argument', 'Lista de produtos inválida (1–50 itens).');
    }

    for (const item of req.productItems) {
      const it = item as { productId?: unknown; quantity?: unknown };
      if (typeof it.productId !== 'string' || !it.productId.trim() || it.productId.length > 128) {
        throw new functions.https.HttpsError('invalid-argument', 'ID de produto inválido.');
      }
      if (
        typeof it.quantity !== 'number' ||
        !Number.isInteger(it.quantity) ||
        it.quantity < 1 ||
        it.quantity > 50
      ) {
        throw new functions.https.HttpsError('invalid-argument', `Quantidade inválida para produto ${String(it.productId)}.`);
      }
    }

    const rawProductItems = req.productItems as Array<{ productId: string; quantity: number }>;
    const consolidated = new Map<string, number>();
    for (const item of rawProductItems) {
      consolidated.set(item.productId, (consolidated.get(item.productId) ?? 0) + item.quantity);
    }
    const productItems = Array.from(consolidated.entries()).map(([productId, quantity]) => ({ productId, quantity }));

    if (typeof req.addressId !== 'string' || !req.addressId.trim() || req.addressId.length > 128) {
      throw new functions.https.HttpsError('invalid-argument', 'ID de endereço inválido.');
    }

    const validDelivery = ['apartment', 'lobby'];
    if (!validDelivery.includes(String(req.deliveryMethod))) {
      throw new functions.https.HttpsError('invalid-argument', 'Método de entrega inválido.');
    }

    const validPayment = ['pix', 'on_delivery'];
    if (!validPayment.includes(String(req.paymentMethod))) {
      throw new functions.https.HttpsError('invalid-argument', 'Método de pagamento inválido.');
    }

    if (req.couponCode) {
      if (typeof req.couponCode !== 'string' || req.couponCode.trim().length === 0 || req.couponCode.length > 50) {
        throw new functions.https.HttpsError('invalid-argument', 'Código de cupom inválido.');
      }
    }

    if (req.notes) {
      if (typeof req.notes !== 'string' || req.notes.length > 500) {
        throw new functions.https.HttpsError('invalid-argument', 'Observações devem ter no máximo 500 caracteres.');
      }
    }

    const addressId = String(req.addressId);
    const deliveryMethod = req.deliveryMethod as 'apartment' | 'lobby';
    const paymentMethod = req.paymentMethod as 'pix' | 'on_delivery';
    const couponCode = req.couponCode ? String(req.couponCode).trim().toUpperCase() : undefined;
    const notes = req.notes ? String(req.notes).trim() : undefined;
    const idempotencyKey = `order:${uid}:${String(req.idempotencyKey)}`;

    // Fingerprint of the order content: the same key must always mean the same order.
    const fingerprint = JSON.stringify({
      items: [...productItems].sort((a, b) => a.productId.localeCompare(b.productId)),
      addressId,
      deliveryMethod,
      paymentMethod,
      couponCode: couponCode ?? null,
      notes: notes ?? null,
    });

    // ── 3. Idempotency check ──────────────────────────────────────────────────
    // Use a deterministic document for idempotency to avoid race conditions.
    const idempotencyRef = db.collection('users').doc(uid).collection('order_requests').doc(String(req.idempotencyKey));
    
    // We'll perform the idempotency check and creation inside the main transaction.
    // However, we pre-check outside to fail fast if it's already there.
    const existingReqSnap = await idempotencyRef.get();
    if (existingReqSnap.exists) {
      const existingReq = existingReqSnap.data();
      functions.logger.info('createOrder: idempotent return (pre-check)', { orderId: existingReq?.orderId, uid });
      if (!existingReq || !existingReq.orderId) {
        throw new functions.https.HttpsError('aborted', 'Requisição anterior ainda em processamento.');
      }
      if (typeof existingReq.fingerprint === 'string' && existingReq.fingerprint !== fingerprint) {
        throw new functions.https.HttpsError(
          'already-exists',
          'Esta chave já foi usada para um pedido diferente. Revise o carrinho e tente novamente.',
        );
      }
      
      // Fetch the actual order to return
      const orderSnap = await db.collection('orders').doc(existingReq.orderId as string).get();
      if (orderSnap.exists) {
        const d = orderSnap.data()!;
        return {
          orderId: orderSnap.id,
          orderNumber: String(d['orderNumber'] ?? ''),
          total: Number(d['total'] ?? 0),
          subtotal: Number(d['subtotal'] ?? 0),
          deliveryFee: Number(d['deliveryFee'] ?? 0),
          discount: Number(d['discount'] ?? 0),
          couponApplied: !!d['coupon'],
          // Real current state — the order may already have advanced since creation.
          status: String(d['status'] ?? 'pending'),
          paymentStatus: String(d['paymentStatus'] ?? ''),
        };
      }
    }

    // ── 4. Load and validate address (must belong to this user) ───────────────
    const addressRef = db.collection('users').doc(uid).collection('addresses').doc(addressId);
    const addressSnap = await addressRef.get();
    if (!addressSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Endereço não encontrado.');
    }
    const ad = addressSnap.data()!;
    const address = {
      street:       String(ad['street']       ?? ''),
      number:       String(ad['number']       ?? ''),
      complement:   ad['complement'] ? String(ad['complement']) : null,
      neighborhood: String(ad['neighborhood'] ?? ''),
      city:         String(ad['city']         ?? ''),
      state:        String(ad['state']        ?? ''),
      zipCode:      String(ad['zipCode']      ?? ''),
      label:        ad['label'] ? String(ad['label']) : null,
    };

    // ── 5. Load shipping config from Firestore ────────────────────────────────
    let shippingThreshold = 60;
    let baseShippingFee = 5;
    let condos: Record<string, number> = {};
    let shippingConfigFound = false;

    try {
      const shippingSnap = await db.collection('settings').doc('shipping').get();
      if (shippingSnap.exists) {
        const sd = shippingSnap.data()!;
        shippingThreshold = Math.max(0, Number(sd['freeShippingThreshold'] ?? 60));
        baseShippingFee   = Math.max(0, Number(sd['baseShippingFee']       ?? 5));
        condos = normalizeCondosServer(sd['condos'] || sd['condosList'] || {});
        shippingConfigFound = true;
      } else {
        const configSnap = await db.collection('configs').doc('shipping').get();
        if (configSnap.exists) {
          const cd = configSnap.data()!;
          shippingThreshold = Math.max(0, Number(cd['freeShippingThreshold'] ?? 60));
          baseShippingFee   = Math.max(0, Number(cd['baseShippingFee']       ?? 5));
          condos = normalizeCondosServer(cd['condos'] || cd['condosList'] || {});
          shippingConfigFound = true;
        }
      }
    } catch (e) {
      functions.logger.error('createOrder: erro ao carregar configurações de frete', { error: String(e) });
    }

    if (!shippingConfigFound) {
      // Fail closed: never charge default fees silently when the store has not configured shipping.
      functions.logger.error('createOrder: /settings/shipping ausente ou ilegível — pedido recusado.');
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Frete não configurado. Tente novamente em instantes ou contate o suporte.',
      );
    }

    // ── 6. Transactional: validate products + stock + coupon → create order ───
    return await db.runTransaction(async (transaction) => {
      // Re-check idempotency strictly inside the transaction
      const txnIdempSnap = await transaction.get(idempotencyRef);
      if (txnIdempSnap.exists) {
        const idempData = txnIdempSnap.data();
        if (idempData?.orderId) {
          if (typeof idempData.fingerprint === 'string' && idempData.fingerprint !== fingerprint) {
            throw new functions.https.HttpsError(
              'already-exists',
              'Esta chave já foi usada para um pedido diferente. Revise o carrinho e tente novamente.',
            );
          }
          const racedOrderSnap = await transaction.get(db.collection('orders').doc(idempData.orderId as string));
          if (racedOrderSnap.exists) {
            const d = racedOrderSnap.data()!;
            return {
              orderId: racedOrderSnap.id,
              orderNumber: String(d['orderNumber'] ?? ''),
              total: Number(d['total'] ?? 0),
              subtotal: Number(d['subtotal'] ?? 0),
              deliveryFee: Number(d['deliveryFee'] ?? 0),
              discount: Number(d['discount'] ?? 0),
              couponApplied: !!d['coupon'],
              status: String(d['status'] ?? 'pending'),
              paymentStatus: String(d['paymentStatus'] ?? ''),
            };
          }
        }
        throw new functions.https.HttpsError('already-exists', 'Idempotência: Pedido já foi criado ou está em processamento.');
      }

      // 6a. Load all product docs
      const productRefs = productItems.map(item => db.collection('products').doc(item.productId));
      const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

      let serverSubtotal = 0;
      const verifiedItems: Array<{
        id: string; title: string; price: number; quantity: number; image: string;
      }> = [];
      const stockUpdates: Array<{ ref: admin.firestore.DocumentReference; newStock: number }> = [];

      for (let i = 0; i < productItems.length; i++) {
        const { productId, quantity } = productItems[i];
        const pDoc = productDocs[i];

        if (!pDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            `Produto não encontrado: ${productId}. Atualize o carrinho e tente novamente.`,
          );
        }

        const pData = pDoc.data()!;

        if (pData['active'] === false) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `O produto "${String(pData['title'] ?? productId)}" não está mais disponível.`,
          );
        }

        // Authoritative price — never trust client
        const serverPrice: number =
          pData['promoActive'] && pData['promoPrice'] && Number(pData['promoPrice']) > 0
            ? Number(pData['promoPrice'])
            : Number(pData['price'] ?? 0);

        if (serverPrice <= 0 || isNaN(serverPrice)) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Preço inválido para "${String(pData['title'] ?? productId)}". Preço deve ser numérico e positivo.`,
          );
        }

        serverSubtotal += serverPrice * quantity;

        verifiedItems.push({
          id:       productId,
          title:    String(pData['title']  ?? ''),
          price:    serverPrice,
          quantity,
          image:    String(pData['image']  ?? ''),
        });

        // Stock check — all sellable items MUST have a defined integer stock
        const currentStock = pData['stock'];
        if (currentStock === undefined || currentStock === null || typeof currentStock !== 'number' || isNaN(currentStock)) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Estoque não definido para o produto "${String(pData['title'] ?? productId)}". Contate o suporte.`,
          );
        }

        const numericStock = Number(currentStock);
        if (numericStock < quantity) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Estoque insuficiente para "${String(pData['title'] ?? productId)}". Disponível: ${String(numericStock)}.`,
          );
        }
        stockUpdates.push({ ref: productRefs[i], newStock: numericStock - quantity });
      }

      // 6b. Validate coupon
      let discount = 0;
      let appliedCoupon: string | null = null;

      if (couponCode) {
        const couponRef = db.collection('coupons').doc(couponCode);
        const couponSnap = await transaction.get(couponRef);

        if (!couponSnap.exists) {
          throw new functions.https.HttpsError('not-found', `Cupom "${couponCode}" não encontrado.`);
        }

        const cd = couponSnap.data()!;

        if (!cd['active']) {
          throw new functions.https.HttpsError('failed-precondition', `Cupom "${couponCode}" não está ativo.`);
        }

        const expiresAt = cd['expiresAt'] as admin.firestore.Timestamp | undefined;
        if (expiresAt && expiresAt.toDate() < new Date()) {
          throw new functions.https.HttpsError('failed-precondition', `Cupom "${couponCode}" expirado.`);
        }

        const maxUses   = cd['maxUses']   !== undefined ? Number(cd['maxUses'])   : undefined;
        const usesCount = cd['usesCount'] !== undefined ? Number(cd['usesCount']) : 0;
        if (maxUses !== undefined && usesCount >= maxUses) {
          throw new functions.https.HttpsError('failed-precondition', `Cupom "${couponCode}" atingiu o limite de usos.`);
        }

        const minOrder = cd['minOrderValue'] !== undefined ? Number(cd['minOrderValue']) : undefined;
        if (minOrder !== undefined && serverSubtotal < minOrder) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Pedido mínimo para este cupom: R$ ${minOrder.toFixed(2)}.`,
          );
        }

        const couponType  = String(cd['type']  ?? 'fixed');
        const couponValue = Number(cd['value'] ?? 0);

        if (couponType === 'percentage') {
          discount = serverSubtotal * Math.min(Math.max(couponValue, 0), 1);
        } else {
          discount = Math.min(couponValue, serverSubtotal);
        }
        discount = Math.max(0, discount);
        appliedCoupon = couponCode;

        // Increment usage atomically
        transaction.update(couponRef, {
          usesCount: admin.firestore.FieldValue.increment(1),
        });
      }

      // 6c. Calculate delivery fee — server-side only, cannot be set by client
      const afterDiscount = serverSubtotal - discount;
      let deliveryFee = 0;
      if (afterDiscount < shippingThreshold) {
        const streetLower  = address.street.toLowerCase();
        const neighLower   = address.neighborhood.toLowerCase();
        const labelLower   = (address.label ?? '').toLowerCase();
        let matchedCondo   = false;

        for (const [condoName, fee] of Object.entries(condos)) {
          const nl = condoName.toLowerCase();
          if (streetLower.includes(nl) || neighLower.includes(nl) || labelLower.includes(nl)) {
            deliveryFee = Math.max(0, fee);
            matchedCondo = true;
            break;
          }
        }
        if (!matchedCondo) {
          deliveryFee = Math.max(0, baseShippingFee);
        }
      }

      // 6d. Final totals
      const clampedDiscount = Math.min(discount, serverSubtotal);
      const total = Math.max(0.01, serverSubtotal - clampedDiscount + deliveryFee);

      // 6g. Create order document
      const orderRef = db.collection('orders').doc();
      const orderId = orderRef.id;
      // Generate a secure, pseudo-random but clean order number based on the Firestore document ID to prevent collisions
      const safeSuffix = orderId.slice(-6).toUpperCase();
      const orderNumber = `MNJ-${Date.now().toString().slice(-4)}${safeSuffix}`;
      const nowTs = admin.firestore.FieldValue.serverTimestamp();
      const timelineNow = admin.firestore.Timestamp.now();

      const paymentLabel = paymentMethod === 'pix' ? 'Pix' : 'Pagamento na Entrega';

      const deliveryLabel = deliveryMethod === 'apartment'
        ? 'Entrega no Apartamento'
        : 'Entrega na Portaria';

      // 6f. Apply stock updates
      for (const upd of stockUpdates) {
        transaction.update(upd.ref, { stock: upd.newStock });
      }

      // 6g. Create order document
      // orderRef and orderId were already generated earlier (lines 1054-1055)
      
      // Write idempotency document atomically
      transaction.set(idempotencyRef, {
        orderId,
        fingerprint,
        createdAt: nowTs,
        payload: { ...req }
      });

      const initialPaymentStatus = paymentMethod === 'on_delivery' ? 'on_delivery' : 'awaiting_confirmation';

      transaction.set(orderRef, {
        uid,
        orderNumber,
        status: 'pending',
        items: verifiedItems,
        subtotal:      serverSubtotal,
        discount:      clampedDiscount,
        deliveryFee,
        total,
        coupon:        appliedCoupon,
        paymentMethod: paymentLabel,
        paymentStatus: initialPaymentStatus,
        paymentDetails: null,
        deliveryMethod: deliveryLabel,
        address,
        notes:          notes ?? null,
        idempotencyKey,
        createdAt:      nowTs,
        updatedAt:      nowTs,
        timeline: [{
          status:    'pending',
          label:     'Pedido criado',
          timestamp: timelineNow,
          actor:     'Sistema',
        }],
      });

      functions.logger.info('createOrder: success', { orderId: orderRef.id, uid, total });

      return {
        orderId:      orderRef.id,
        orderNumber,
        total,
        subtotal:     serverSubtotal,
        deliveryFee,
        discount:     clampedDiscount,
        couponApplied: !!appliedCoupon,
        status: 'pending' as const,
        paymentStatus: initialPaymentStatus,
      };
    });
  } catch (err: unknown) {
    const errorObj = err as { message?: string; stack?: string };
    await db.collection('debug_errors').add({
      endpoint: 'createOrder',
      message: errorObj?.message ? String(errorObj.message) : String(err),
      stack: errorObj?.stack ? String(errorObj.stack) : 'no stack',
      data: data ? JSON.parse(JSON.stringify(data)) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(console.error);

    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    throw new functions.https.HttpsError('internal', (err as Error)?.message || 'Erro interno.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// adminGrantDiamonds — Callable; routes all admin diamond grants through ledger
// ─────────────────────────────────────────────────────────────────────────────
export const adminGrantDiamonds = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const isAdmin = await checkIsCallerAdmin({ uid: context.auth.uid, token: context.auth.token });
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem conceder diamantes.');
  }

  const req = data as { targetUid?: unknown; amount?: unknown; reason?: unknown; idempotencyKey?: unknown };

  if (typeof req.targetUid !== 'string' || !req.targetUid.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid inválido.');
  }
  if (
    typeof req.amount !== 'number' ||
    !Number.isInteger(req.amount) ||
    req.amount === 0 ||
    Math.abs(req.amount) > 10_000
  ) {
    throw new functions.https.HttpsError('invalid-argument', 'amount deve ser inteiro ≠ 0 no intervalo [-10000, 10000].');
  }
  if (typeof req.reason !== 'string' || !req.reason.trim() || req.reason.length > 200) {
    throw new functions.https.HttpsError('invalid-argument', 'reason inválido (1–200 caracteres).');
  }

  if (typeof req.idempotencyKey !== 'string' || !req.idempotencyKey.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey inválido.');
  }

  const targetUid = req.targetUid.trim();
  const amount    = req.amount as number;
  const reason    = req.reason.trim();
  const now       = new Date();
  const idempotencyKey = `admin-grant:${context.auth.uid}:${targetUid}:${req.idempotencyKey.trim()}`;

  const result = await db.runTransaction(async (transaction) => {
    return grantReward(transaction, {
      uid: targetUid,
      type: 'ADMIN_GRANT',
      amount,
      sourceId:        `admin:${context.auth!.uid}`,
      idempotencyKey,
      metadata: { adminUid: context.auth!.uid, reason },
      historyEntry: {
        desc:   `Ajuste administrativo: ${reason}`,
        date:   `Hoje, ${formatTime(now)}`,
        value:  amount > 0 ? `+${amount}` : String(amount),
        isPlus: amount > 0,
      },
    });
  });

  functions.logger.info('adminGrantDiamonds', { targetUid, amount, adminUid: context.auth.uid, reason });

  return { success: true, newBalance: result.newBalance, alreadyProcessed: result.alreadyProcessed };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminBanUser — Callable; bans user account completely (Auth disabled + claims + Firestore)
// ─────────────────────────────────────────────────────────────────────────────
export const adminBanUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const isAdmin = await checkIsCallerAdmin({ uid: context.auth.uid, token: context.auth.token });
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem banir contas.');
  }

  const req = data as { targetUid?: unknown; reason?: unknown };
  if (typeof req.targetUid !== 'string' || !req.targetUid.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid é obrigatório.');
  }

  const targetUid = req.targetUid.trim();
  const callerUid = context.auth.uid;
  const reason    = typeof req.reason === 'string' && req.reason.trim() ? req.reason.trim() : 'Suspensão administrativa';

  if (targetUid === callerUid) {
    throw new functions.https.HttpsError('failed-precondition', 'Você não pode banir sua própria conta.');
  }

  // An active superadmin can only be removed through the access-management flow
  // (adminSetStaffStatus), which enforces the "last superadmin" protection.
  const targetAssignment = await db.collection('role_assignments').doc(targetUid).get();
  const targetRa = targetAssignment.exists ? (targetAssignment.data() as { roleId?: string; status?: string }) : null;
  if (targetRa?.roleId === 'superadmin' && targetRa?.status === 'active') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Este usuário é superadmin. Suspenda ou rebaixe o acesso na gestão de usuários antes de banir.',
    );
  }

  // 1. Firebase Auth: revoga tokens, desabilita conta e marca claim banned: true, admin: false
  try {
    await admin.auth().setCustomUserClaims(targetUid, { admin: false, banned: true });
    await admin.auth().updateUser(targetUid, { disabled: true });
    await admin.auth().revokeRefreshTokens(targetUid);
  } catch (authErr) {
    functions.logger.warn('adminBanUser: aviso ao atualizar Firebase Auth (usuário pode inexistir no Auth)', { targetUid, error: authErr });
  }

  // 2. Firestore: marca role: 'banned' imediatamente
  await db.collection('users').doc(targetUid).set({
    role: 'banned',
    bannedAt: admin.firestore.FieldValue.serverTimestamp(),
    bannedBy: callerUid,
    banReason: reason,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  functions.logger.info('adminBanUser', { targetUid, callerUid, reason });

  return { success: true, targetUid };
});

// ─────────────────────────────────────────────────────────────────────────────
// setAdminClaim — Callable; grants/revokes Firebase Custom Claim "admin: true"
//
// Usage (from a privileged client or admin panel):
//   const setAdmin = httpsCallable(functions, 'setAdminClaim');
//   await setAdmin({ targetUid: '<uid>', isAdmin: true });
//
// After this call, the target user must sign out and sign back in (or call
// firebase.auth().currentUser?.getIdToken(true)) for the new claim to apply.
// ─────────────────────────────────────────────────────────────────────────────
export const setAdminClaim = functions.https.onCall(async (data, context) => {
  // Legacy entry point kept for compatibility. It now requires the granular
  // `usuarios:admin` permission (superadmin by default) and delegates to the RBAC engine,
  // which audits the change, merges claims and protects the last superadmin.
  const actor = await requirePermission(context.auth, 'usuarios:admin');

  const req = data as { targetUid?: unknown; isAdmin?: unknown; reason?: unknown };

  if (typeof req.targetUid !== 'string' || !req.targetUid.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid inválido.');
  }
  if (typeof req.isAdmin !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'isAdmin deve ser boolean.');
  }

  const targetUid    = req.targetUid.trim();
  const makeAdmin    = req.isAdmin as boolean;
  const callerUid    = actor.uid;
  const reason       = typeof req.reason === 'string' && req.reason.trim().length >= 5
    ? req.reason.trim().slice(0, 300)
    : 'Alteração via setAdminClaim (legado)';

  // Prevent self-demotion to avoid accidental lockout
  if (targetUid === callerUid && !makeAdmin) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Você não pode remover seus próprios privilégios de administrador.',
    );
  }

  await applyStaffRole({
    actor,
    targetUid,
    roleId: makeAdmin ? 'admin' : undefined,
    status: makeAdmin ? 'active' : 'archived',
    reason,
    action: makeAdmin ? 'staff.assign_role' : 'staff.archive',
  });

  functions.logger.info('setAdminClaim', { targetUid, makeAdmin, callerUid });

  return { success: true, targetUid, isAdmin: makeAdmin };
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelOrder — Callable; allows a user to cancel their own order or admin to cancel
// ─────────────────────────────────────────────────────────────────────────────
export const cancelOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const callerUid = context.auth.uid;
  if (await checkIsCallerBanned({ uid: callerUid, token: context.auth.token })) {
    throw new functions.https.HttpsError('permission-denied', 'Conta suspensa.');
  }

  const { orderId, reason } = data as { orderId?: string; reason?: string };
  if (!orderId || typeof orderId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'orderId é obrigatório.');
  }

  const isAdmin = await checkIsCallerAdmin({ uid: callerUid, token: context.auth.token });

  return await db.runTransaction(async (transaction) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Pedido não encontrado.');
    }

    const orderData = orderSnap.data()!;

    if (orderData.uid !== callerUid && !isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Você não tem permissão para cancelar este pedido.');
    }

    // Check if already cancelled
    if (orderData.status === 'cancelled') {
      throw new functions.https.HttpsError('failed-precondition', 'Este pedido já está cancelado.');
    }

    // Users can only cancel while pending or confirmed (before preparation starts)
    if (orderData.status !== 'pending' && orderData.status !== 'confirmed' && !isAdmin) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Não é possível cancelar um pedido em preparação ou entrega. Contate o suporte.',
      );
    }

    // Idempotency subdocument lock to ensure single stock refund even under high concurrency
    const idempotencyRef = db.collection('orders').doc(orderId).collection('cancellation_requests').doc('cancel_req');
    const idempSnap = await transaction.get(idempotencyRef);
    if (idempSnap.exists) {
      throw new functions.https.HttpsError('already-exists', 'Cancelamento deste pedido já está em processamento.');
    }

    transaction.set(idempotencyRef, {
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      by: callerUid,
      reason: reason || (isAdmin ? 'Cancelado pelo administrador' : 'Cancelado pelo cliente'),
    });

    // Refund stock atomically (only if not already refunded)
    const items = (orderData.items ?? []) as Array<{ id: string; quantity: number }>;
    for (const item of items) {
      const productRef = db.collection('products').doc(item.id);
      const productSnap = await transaction.get(productRef);
      if (productSnap.exists) {
        const pData = productSnap.data()!;
        if (pData.stock !== undefined) {
          transaction.update(productRef, { stock: Number(pData.stock) + item.quantity });
        }
      }
    }

    // Update order status, paymentStatus (if not approved/completed), and timeline
    const existingTimeline = (orderData.timeline ?? []) as unknown[];
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const cancelReason = reason ? `: ${reason}` : '';
    const newEvent = {
      status: 'cancelled',
      label: `Pedido Cancelado${cancelReason}`,
      timestamp: admin.firestore.Timestamp.now(),
      actor: isAdmin ? 'Administrador' : 'Cliente',
    };

    const updatePayload: Record<string, unknown> = {
      status: 'cancelled',
      updatedAt: nowTs,
      timeline: [...existingTimeline, newEvent],
      cancellationReason: reason || null,
      cancelledBy: callerUid,
      cancelledAt: nowTs,
    };

    // If payment was awaiting_confirmation, mark as rejected/cancelled
    if (orderData.paymentStatus === 'awaiting_confirmation') {
      updatePayload.paymentStatus = 'rejected';
    }

    transaction.update(orderRef, updatePayload);

    return { success: true };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// confirmPayment — Callable; admin only
// Confirms payment atomically and transitions order to confirmed
// ─────────────────────────────────────────────────────────────────────────────
export const confirmPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const isAdmin = await checkIsCallerAdmin({ uid: context.auth.uid, token: context.auth.token });
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem confirmar pagamento.');
  }

  const { orderId, paymentMethod, paymentReference, note } = data as {
    orderId?: string;
    paymentMethod?: string;
    paymentReference?: string;
    note?: string;
  };

  if (!orderId || typeof orderId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'orderId é obrigatório.');
  }

  return await db.runTransaction(async (transaction) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Pedido não encontrado.');
    }

    const orderData = orderSnap.data()!;

    if (orderData.status === 'cancelled') {
      throw new functions.https.HttpsError('failed-precondition', 'Não é possível confirmar pagamento de um pedido cancelado.');
    }

    // Idempotency: if already approved, return success without duplicate timeline
    if (orderData.paymentStatus === 'approved') {
      return { success: true, message: 'Pagamento já estava aprovado.' };
    }

    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const existingTimeline = (orderData.timeline ?? []) as unknown[];

    const timelineEvent = {
      status: 'confirmed',
      label: `Pagamento confirmado (${paymentMethod || orderData.paymentMethod || 'Pix'})`,
      timestamp: admin.firestore.Timestamp.now(),
      actor: 'Administrador',
      details: paymentReference ? `Ref: ${paymentReference}` : undefined,
    };

    const updatePayload: Record<string, unknown> = {
      paymentStatus: 'approved',
      paidAt: nowTs,
      confirmedBy: context.auth!.uid,
      paymentReference: paymentReference || null,
      updatedAt: nowTs,
      timeline: [...existingTimeline, timelineEvent],
    };

    if (paymentMethod) {
      updatePayload.paymentMethod = paymentMethod;
    }
    if (note) {
      updatePayload.paymentNote = note;
    }

    // If order was pending, advance to confirmed
    if (orderData.status === 'pending') {
      updatePayload.status = 'confirmed';
    }

    transaction.update(orderRef, updatePayload);

    return { success: true, orderId };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateOrderStatus — Callable; admin only
// Advances operational status with strict business checks
// ─────────────────────────────────────────────────────────────────────────────
export const updateOrderStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const isAdmin = await checkIsCallerAdmin({ uid: context.auth.uid, token: context.auth.token });
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem atualizar o status.');
  }

  const { orderId, status, note } = data as { orderId?: string; status?: string; note?: string };
  if (!orderId || !status) {
    throw new functions.https.HttpsError('invalid-argument', 'orderId e status são obrigatórios.');
  }

  const validStatuses: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    preparing: 'Em preparo',
    delivering: 'Saiu para Entrega',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
  };

  if (!validStatuses[status]) {
    throw new functions.https.HttpsError('invalid-argument', `Status inválido: ${status}`);
  }

  return await db.runTransaction(async (transaction) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Pedido não encontrado.');
    }

    const orderData = orderSnap.data()!;

    if (orderData.status === 'cancelled') {
      throw new functions.https.HttpsError('failed-precondition', 'Pedido cancelado não pode ter o status alterado.');
    }

    // Commercial condition rule:
    // Advancing to 'preparing' or 'delivering' requires either:
    // 1. paymentStatus === 'approved'
    // 2. paymentStatus === 'on_delivery' (explicit payment on delivery policy)
    if (status === 'preparing' || status === 'delivering') {
      const pStatus = orderData.paymentStatus;
      const isPaid = pStatus === 'approved';
      const isOnDelivery = pStatus === 'on_delivery';

      if (!isPaid && !isOnDelivery) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Não é possível avançar para preparação/entrega sem confirmação comercial de pagamento (Aprovado ou Pagamento na Entrega).',
        );
      }
    }

    // If setting to cancelled, delegate to stock refund logic
    if (status === 'cancelled') {
      // Stock refund
      const items = (orderData.items ?? []) as Array<{ id: string; quantity: number }>;
      for (const item of items) {
        const productRef = db.collection('products').doc(item.id);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists) {
          const pData = productSnap.data()!;
          if (pData.stock !== undefined) {
            transaction.update(productRef, { stock: Number(pData.stock) + item.quantity });
          }
        }
      }
    }

    const existingTimeline = (orderData.timeline ?? []) as unknown[];
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const newEvent = {
      status,
      label: validStatuses[status] + (note ? ` - ${note}` : ''),
      timestamp: admin.firestore.Timestamp.now(),
      actor: 'Administrador',
    };

    const updatePayload: Record<string, unknown> = {
      status,
      updatedAt: nowTs,
      timeline: [...existingTimeline, newEvent],
    };

    // If delivered and was on_delivery, update payment status to approved
    if (status === 'delivered' && orderData.paymentStatus === 'on_delivery') {
      updatePayload.paymentStatus = 'approved';
      updatePayload.paidAt = nowTs;
      updatePayload.confirmedBy = context.auth!.uid;
    }

    transaction.update(orderRef, updatePayload);

    return { success: true, status };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCoupon — Callable; securely check a coupon without revealing the full document
// ─────────────────────────────────────────────────────────────────────────────
export const validateCoupon = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const { code } = data as { code?: string };
  if (!code || typeof code !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Código de cupom inválido.');
  }

  const couponId = code.trim().toUpperCase();
  const couponRef = db.collection('coupons').doc(couponId);
  const snap = await couponRef.get();

  if (!snap.exists) {
    return { valid: false, error: 'Cupom não encontrado' };
  }

  const cd = snap.data()!;
  if (!cd['active']) {
    return { valid: false, error: 'Cupom inativo' };
  }

  const expiresAt = cd['expiresAt'] as admin.firestore.Timestamp | undefined;
  if (expiresAt && expiresAt.toDate() < new Date()) {
    return { valid: false, error: 'Cupom expirado' };
  }

  const maxUses   = cd['maxUses']   !== undefined ? Number(cd['maxUses'])   : undefined;
  const usesCount = cd['usesCount'] !== undefined ? Number(cd['usesCount']) : 0;
  if (maxUses !== undefined && usesCount >= maxUses) {
    return { valid: false, error: 'Cupom esgotado (limite de usos atingido)' };
  }

  const couponType  = String(cd['type'] ?? cd['discountType'] ?? 'fixed');
  const couponValue = Number(cd['value'] ?? cd['discountValue'] ?? 0);
  const minOrder    = cd['minOrderValue'] !== undefined ? Number(cd['minOrderValue']) : (cd['minPurchase'] !== undefined ? Number(cd['minPurchase']) : 0);

  return {
    valid: true,
    type: couponType,
    value: couponValue,
    discountType: couponType,
    discountValue: couponValue,
    minPurchase: minOrder,
    minOrderValue: minOrder,
    maxUses,
    usesCount,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// claimAdReward — Callable; Grants diamonds for watching an ad securely
// ─────────────────────────────────────────────────────────────────────────────
export const claimAdReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  
  const req = data as { idempotencyKey?: unknown };
  if (typeof req.idempotencyKey !== 'string' || !req.idempotencyKey.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey inválido.');
  }

  const uid = context.auth.uid;
  const key = req.idempotencyKey.trim();
  const idempotencyKey = `ad-reward:${uid}:${key}`;
  const now = new Date();
  
  const result = await db.runTransaction(async (transaction) => {
    return grantReward(transaction, {
      uid,
      type: 'MISSION_REWARD',
      amount: 5,
      sourceId: 'ad',
      idempotencyKey,
      metadata: { action: 'watched_ad' },
      historyEntry: {
        desc: 'Recompensa por vídeo',
        date: `Hoje, ${formatTime(now)}`,
        value: '+5',
        isPlus: true,
      },
    });
  });

  return { success: true, newBalance: result.newBalance, alreadyProcessed: result.alreadyProcessed };
});

// ─────────────────────────────────────────────────────────────────────────────
// redeemReward — Callable; Spends diamonds to get a reward/coupon
// ─────────────────────────────────────────────────────────────────────────────
export const redeemReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const req = data as { rewardId?: unknown; cost?: unknown; idempotencyKey?: unknown; title?: unknown };
  const isRewardIdValid = typeof req.rewardId === 'string' || typeof req.rewardId === 'number';
  if (!isRewardIdValid || typeof req.cost !== 'number' || typeof req.idempotencyKey !== 'string' || typeof req.title !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  const uid = context.auth.uid;
  const cost = req.cost as number;
  const title = req.title as string;
  const rewardId = String(req.rewardId).trim();
  if (!rewardId) {
    throw new functions.https.HttpsError('invalid-argument', 'rewardId não pode ser vazio.');
  }
  const idempotencyKeyStr = req.idempotencyKey as string;
  const idempotencyKey = `redeem:${uid}:${idempotencyKeyStr.trim()}`;
  const now = new Date();

  const result = await db.runTransaction(async (transaction) => {
    // We pass negative amount for redemption
    return grantReward(transaction, {
      uid,
      type: 'MISSION_REWARD', // Using mission reward as general club op
      amount: -cost,
      sourceId: rewardId,
      idempotencyKey,
      metadata: { action: 'redeem_reward', rewardId },
      historyEntry: {
        desc: `Resgate: ${title}`,
        date: `Hoje, ${formatTime(now)}`,
        value: `-${cost}`,
        isPlus: false,
      },
    });
  });

  return { success: true, newBalance: result.newBalance, alreadyProcessed: result.alreadyProcessed };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminCleanAllDiamonds — Callable; Cleans all diamond data securely
// ─────────────────────────────────────────────────────────────────────────────
export const adminCleanAllDiamonds = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const isAdmin = await checkIsCallerAdmin({ uid: context.auth.uid, token: context.auth.token });
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem limpar os dados.');
  }

  const usersSnap = await db.collection('users').get();
  
  // Create a massive batch or sequential updates. Sequential is safer if many users.
  const batch = db.batch();
  let count = 0;

  for (const userDoc of usersSnap.docs) {
    const profileRef = userDoc.ref.collection('clube').doc('profile');
    batch.update(profileRef, {
      diamonds: 0,
      history: [],
      missions: {
        order: false,
        refer: false,
        combo: false
      },
      streak: 0,
      current_day: 0,
      completedAds: []
    });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
  }

  functions.logger.info('adminCleanAllDiamonds executed', { adminUid: context.auth.uid, usersCleared: count });
  return { success: true, usersCleared: count };
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin portal: RBAC / SUPERADMIN / audit callables (see ./admin)
// ─────────────────────────────────────────────────────────────────────────────
export * from './admin/callables';

