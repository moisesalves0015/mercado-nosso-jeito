import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Helpers
const REWARDS: Record<number, number> = { 1: 15, 2: 15, 3: 15, 4: 15, 5: 20, 6: 20, 7: 50 };

// Consistent UTC-3 (BRT) date string generator
const getBRTDateString = (date: Date = new Date()): string => {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().split('T')[0];
};

const formatTime = (date: Date) => {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return `${brt.getUTCHours()}:${brt.getUTCMinutes().toString().padStart(2, '0')}`;
};

export const dailyCheckin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  const uid = context.auth.uid;
  const profileRef = db.collection('users').doc(uid).collection('clube').doc('profile');

  return await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(profileRef);
    let profileData = docSnap.exists ? docSnap.data()! : { diamonds: 0, current_day: 0, streak: 0, history: [] };

    const todayBRT = getBRTDateString(new Date());
    const lastCheckinStr = profileData.last_checkin_at;

    let currentDay = profileData.current_day || 0;
    let streak = profileData.streak || 0;
    let diamonds = profileData.diamonds || 0;

    if (lastCheckinStr) {
      const lastCheckinDate = new Date(lastCheckinStr);
      const lastCheckinBRT = getBRTDateString(lastCheckinDate);

      if (todayBRT === lastCheckinBRT) {
        throw new functions.https.HttpsError('already-exists', 'Você já realizou o check-in de hoje.');
      }

      const expectedNextDate = new Date(lastCheckinDate.getTime() + 24 * 60 * 60 * 1000);
      const expectedNextBRT = getBRTDateString(expectedNextDate);

      if (todayBRT === expectedNextBRT) {
        currentDay = currentDay >= 7 ? 1 : currentDay + 1;
        streak += 1;
      } else {
        currentDay = 1;
        streak = 1; // reset
      }
    } else {
      currentDay = 1;
      streak = 1;
    }

    const rewardAmount = REWARDS[currentDay];
    diamonds += rewardAmount;

    // Registrar transação na coleção raiz `diamond_transactions`
    const transactionRef = db.collection('diamond_transactions').doc();
    transaction.set(transactionRef, {
      user_id: uid,
      type: 'CHECKIN_REWARD',
      amount: rewardAmount,
      balance_before: profileData.diamonds || 0,
      balance_after: diamonds,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Atualizar perfil do usuário
    const historyItem = {
      id: Date.now().toString(),
      desc: `Check-in Diário (Dia ${currentDay})`,
      date: `Hoje, ${formatTime(now)}`,
      value: `+${rewardAmount}`,
      isPlus: true
    };
    
    const history = profileData.history || [];
    history.unshift(historyItem);

    const now = new Date();
    transaction.set(profileRef, {
      current_day: currentDay,
      streak,
      diamonds,
      last_checkin_at: now.toISOString(),
      history

    }, { merge: true });

    return { success: true, reward: rewardAmount, currentDay, streak, diamondsBalance: diamonds };
  });
});

export const spinRoulette = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Unauthenticated');
  const uid = context.auth.uid;
  const { type } = data; // 'free' or 'premium'

  const profileRef = db.collection('users').doc(uid).collection('clube').doc('profile');

  return await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(profileRef);
    if (!docSnap.exists) throw new functions.https.HttpsError('not-found', 'Perfil não encontrado');
    const profile = docSnap.data()!;

    const todayBr = getBRTDateString(new Date());

    if (type === 'free') {
      if (profile.freeSpinDate === todayBr && profile.freeSpinUsed) {
        throw new functions.https.HttpsError('permission-denied', 'Giro diário já utilizado.');
      }
    } else {
      if ((profile.diamonds || 0) < 50) {
        throw new functions.https.HttpsError('permission-denied', 'Diamantes insuficientes para girar.');
      }
    }

    // Backend sorteia (simples prob.)
    const rand = Math.random() * 100;
    // ... Aqui puxaríamos da coleção roulette_prizes, mas pro MVP vamos fixar a lógica base:
    let prizeAmount = 0;
    let desc = 'Tente de Novo';
    if (rand < 5) { prizeAmount = 100; desc = '100 Diamantes'; }
    else if (rand < 25) { prizeAmount = 15; desc = '15 Diamantes'; }
    else if (rand < 30) { prizeAmount = 50; desc = '50 Diamantes'; }
    
    let diamonds = profile.diamonds || 0;
    const balanceBefore = diamonds;

    if (type === 'premium') {
      diamonds -= 50;
    }
    if (prizeAmount > 0) {
      diamonds += prizeAmount;
    }

    // Gravar a transação de giro
    const transactionRef = db.collection('diamond_transactions').doc();
    transaction.set(transactionRef, {
      user_id: uid,
      type: 'SPIN_ROULETTE',
      amount: type === 'premium' ? prizeAmount - 50 : prizeAmount,
      balance_before: balanceBefore,
      balance_after: diamonds,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { type, prizeDesc: desc }
    });

    const updates: any = { diamonds };
    if (type === 'free') {
      updates.freeSpinUsed = true;
      updates.freeSpinDate = todayBr;
    }

    if (prizeAmount > 0) {
      const history = profile.history || [];
      history.unshift({
        id: Date.now().toString(),
        desc: `Ganhou na Roleta: ${desc}`,
        date: `Hoje, ${formatTime(new Date())}`,
        value: `+${prizeAmount}`,
        isPlus: true
      });
      updates.history = history;
    }

    transaction.set(profileRef, updates, { merge: true });

    return { success: true, prizeAmount, prizeDesc: desc, newBalance: diamonds };
  });
});
