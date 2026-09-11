"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimMissionReward = exports.processOrderDelivered = exports.spinRoulette = exports.dailyCheckin = exports.initClubeProfile = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const CHECKIN_REWARDS = { 1: 15, 2: 15, 3: 15, 4: 15, 5: 20, 6: 20, 7: 50 };
const DEFAULT_CAMPAIGN = {
    id: 'default',
    version: 1,
    active: true,
    roulette: {
        premiumCost: 50,
        prizes: [
            { id: 'none', weight: 70, amount: 0, description: 'Tente de Novo' },
            { id: 'small', weight: 25, amount: 15, description: '15 Diamantes' },
            { id: 'medium', weight: 3, amount: 50, description: '50 Diamantes' },
            { id: 'large', weight: 2, amount: 100, description: '100 Diamantes' },
        ],
    },
    missions: {
        firstOrder: { reward: 100 },
        referral: { reward: 80 },
        combo: { reward: 50 },
    },
};
/** Returns a BRT (UTC-3) date string: "YYYY-MM-DD" */
const getBRTDateString = (date = new Date()) => {
    const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return brt.toISOString().split('T')[0];
};
const formatTime = (date) => {
    const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return `${brt.getUTCHours()}:${brt.getUTCMinutes().toString().padStart(2, '0')}`;
};
/** Weighted random draw from a list of prizes. Throws if weights don't sum to 100. */
function drawPrize(prizes) {
    const total = prizes.reduce((s, p) => s + p.weight, 0);
    if (Math.abs(total - 100) > 0.01) {
        throw new functions.https.HttpsError('internal', `Configuração de roleta inválida: pesos somam ${total}, esperado 100.`);
    }
    const rand = Math.random() * 100;
    let accumulated = 0;
    for (const prize of prizes) {
        accumulated += prize.weight;
        if (rand < accumulated)
            return prize;
    }
    return prizes[prizes.length - 1];
}
/** Load the currently active campaign from Firestore, falling back to hardcoded default. */
async function loadActiveCampaign() {
    try {
        const snap = await db
            .collection('campaign_configs')
            .where('active', '==', true)
            .orderBy('version', 'desc')
            .limit(1)
            .get();
        if (!snap.empty) {
            return snap.docs[0].data();
        }
    }
    catch (_) {
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
async function grantReward(transaction, opts) {
    var _a, _b, _c;
    const profileRef = db.collection('users').doc(opts.uid).collection('clube').doc('profile');
    // Check idempotency before writing anything
    const existingSnap = await db
        .collection('diamond_transactions')
        .where('idempotencyKey', '==', opts.idempotencyKey)
        .limit(1)
        .get();
    if (!existingSnap.empty) {
        const existingTxn = existingSnap.docs[0].data();
        return { newBalance: existingTxn.balanceAfter, alreadyProcessed: true };
    }
    const profileSnap = await transaction.get(profileRef);
    const profileData = profileSnap.exists
        ? profileSnap.data()
        : { diamonds: 0, history: [] };
    const balanceBefore = (_a = profileData.diamonds) !== null && _a !== void 0 ? _a : 0;
    const balanceAfter = balanceBefore + opts.amount;
    if (balanceAfter < 0) {
        throw new functions.https.HttpsError('permission-denied', 'Saldo insuficiente para realizar esta operação.');
    }
    // Immutable ledger entry
    const txnRef = db.collection('diamond_transactions').doc();
    transaction.set(txnRef, {
        userId: opts.uid,
        type: opts.type,
        amount: opts.amount,
        balanceBefore,
        balanceAfter,
        sourceId: opts.sourceId,
        idempotencyKey: opts.idempotencyKey,
        metadata: (_b = opts.metadata) !== null && _b !== void 0 ? _b : {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system',
    });
    // Materialised balance update
    const updateData = { diamonds: balanceAfter };
    if (opts.historyEntry) {
        const currentHistory = (_c = profileData.history) !== null && _c !== void 0 ? _c : [];
        // Cap history at 100 items to prevent unbounded document growth
        updateData.history = [opts.historyEntry, ...currentHistory].slice(0, 100);
    }
    if (profileSnap.exists) {
        transaction.update(profileRef, updateData);
    }
    else {
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
    return { newBalance: balanceAfter, alreadyProcessed: false };
}
// ─────────────────────────────────────────────────────────────────────────────
// initClubeProfile — callable; creates profile without touching diamonds
// ─────────────────────────────────────────────────────────────────────────────
exports.initClubeProfile = functions.https.onCall(async (_data, context) => {
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
        transaction.set(profileRef, {
            diamonds: 0,
            streak: 0,
            current_day: 0,
            history: [],
            freeSpinUsed: false,
            freeSpinDate: '',
            missions: { order: false, refer: false, combo: false },
            completedAds: [],
        });
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
exports.dailyCheckin = functions.https.onCall(async (_data, context) => {
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
        var _a, _b;
        const docSnap = await transaction.get(profileRef);
        const profileData = docSnap.exists
            ? docSnap.data()
            : { diamonds: 0, current_day: 0, streak: 0, history: [], last_checkin_at: null };
        const lastCheckinStr = (_a = profileData.last_checkin_at) !== null && _a !== void 0 ? _a : null;
        let currentDay = profileData.current_day || 0;
        let streak = profileData.streak || 0;
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
            }
            else {
                currentDay = 1;
                streak = 1;
            }
        }
        else {
            currentDay = 1;
            streak = 1;
        }
        const rewardAmount = (_b = CHECKIN_REWARDS[currentDay]) !== null && _b !== void 0 ? _b : 15;
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
exports.spinRoulette = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const uid = context.auth.uid;
    // Explicit type validation — reject anything outside the allowed set
    const { type } = data;
    if (type !== 'free' && type !== 'premium') {
        throw new functions.https.HttpsError('invalid-argument', `Tipo de giro inválido: "${String(type)}". Use "free" ou "premium".`);
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
        var _a;
        const docSnap = await transaction.get(profileRef);
        if (!docSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Perfil do clube não encontrado. Inicialize o clube primeiro.');
        }
        const profile = docSnap.data();
        const currentDiamonds = (_a = profile.diamonds) !== null && _a !== void 0 ? _a : 0;
        if (type === 'premium') {
            if (currentDiamonds < premiumCost) {
                throw new functions.https.HttpsError('permission-denied', `Diamantes insuficientes. Necessário: ${premiumCost}, disponível: ${currentDiamonds}.`);
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
        let newBalance = currentDiamonds - (type === 'premium' ? premiumCost : 0);
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
        }
        else if (type === 'free') {
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
exports.processOrderDelivered = functions.firestore
    .document('orders/{orderId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const orderId = context.params.orderId;
    // Only process transitions TO 'delivered'
    if (before.status === 'delivered' || after.status !== 'delivered') {
        return null;
    }
    const uid = after.uid;
    const now = new Date();
    const tasks = [];
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
        const referrerUid = claimData.referrerUid;
        const claimId = claim.id;
        const referralKey = `referral:${referrerUid}:${uid}:delivered`;
        tasks.push(db.runTransaction(async (transaction) => {
            const claimRef = db.collection('reward_claims').doc(claimId);
            const freshClaim = await transaction.get(claimRef);
            if (!freshClaim.exists || freshClaim.data().status !== 'PENDING')
                return;
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
                status: 'GRANTED',
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
        }));
    }
    // ── First-order delivery bonus for the buyer ─────────────────────────────
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists && !userSnap.data().firstOrderDeliveredRewarded) {
        const firstOrderKey = `first-order:${uid}:${orderId}`;
        tasks.push(db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const freshUser = await transaction.get(userRef);
            if (!freshUser.exists || freshUser.data().firstOrderDeliveredRewarded)
                return;
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
        }));
    }
    await Promise.all(tasks);
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// claimMissionReward — callable; backend recalculates eligibility before grant
// ─────────────────────────────────────────────────────────────────────────────
exports.claimMissionReward = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    const uid = context.auth.uid;
    const now = new Date();
    const { missionId } = data;
    const validMissions = ['firstOrder', 'referral', 'combo'];
    if (!validMissions.includes(missionId)) {
        throw new functions.https.HttpsError('invalid-argument', `Missão inválida: "${String(missionId)}". Opções: ${validMissions.join(', ')}.`);
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
    }
    else if (missionId === 'referral') {
        const referredSnap = await db
            .collection('users')
            .where('referredBy', '==', uid)
            .where('firstOrderPlaced', '==', true)
            .limit(1)
            .get();
        eligible = !referredSnap.empty;
        reward = campaign.missions.referral.reward;
        desc = 'Missão: Indicação Concluída';
    }
    else if (missionId === 'combo') {
        const [ordersSnap, referredSnap] = await Promise.all([
            db.collection('orders').where('uid', '==', uid).where('status', '==', 'delivered').limit(1).get(),
            db.collection('users').where('referredBy', '==', uid).where('firstOrderPlaced', '==', true).limit(1).get(),
        ]);
        eligible = !ordersSnap.empty && !referredSnap.empty;
        reward = campaign.missions.combo.reward;
        desc = 'Missão Combo: Pedido + Indicação';
    }
    if (!eligible) {
        throw new functions.https.HttpsError('failed-precondition', 'Você ainda não completou os requisitos desta missão.');
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
//# sourceMappingURL=index.js.map