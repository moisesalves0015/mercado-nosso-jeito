import { db } from '../firebase';
import { doc, runTransaction } from 'firebase/firestore';

const REWARDS: Record<number, number> = {
  1: 15, 2: 15, 3: 15, 4: 15, 5: 20, 6: 20, 7: 50
};

export const performCheckinTransaction = async (userId: string) => {
  const profileRef = doc(db, 'users', userId, 'clube', 'profile');

  return await runTransaction(db, async (transaction) => {
    const profileDoc = await transaction.get(profileRef);
    
    // Se o perfil não existir, inicializamos no próprio transaction
    let data = profileDoc.exists() ? profileDoc.data() : null;
    
    if (!data) {
      data = {
        diamonds: 0,
        current_day: 0,
        streak: 0,
        last_checkin_at: null,
        history: []
      };
    }

    const now = new Date();
    const todayUTC = now.toISOString().split('T')[0];

    const lastCheckinStr = data.last_checkin_at;

    let currentDay = data.current_day || 0;
    let streak = data.streak || 0;
    let diamonds = data.diamonds || 0;

    if (lastCheckinStr) {
      const lastCheckinDate = new Date(lastCheckinStr);
      const lastCheckinUTC = lastCheckinDate.toISOString().split('T')[0];

      if (todayUTC === lastCheckinUTC) {
        throw new Error("Você já realizou o check-in de hoje.");
      }

      // Verifica se é o próximo dia consecutivo
      const expectedNextDate = new Date(lastCheckinDate);
      expectedNextDate.setUTCDate(expectedNextDate.getUTCDate() + 1);
      const expectedNextUTC = expectedNextDate.toISOString().split('T')[0];

      if (todayUTC === expectedNextUTC) {
        // Sequência mantida
        currentDay += 1;
        streak += 1;
        if (currentDay > 7) {
          currentDay = 1;
        }
      } else {
        // Dia perdido
        currentDay = 1;
        streak = 1;
      }
    } else {
      // Primeiro check-in
      currentDay = 1;
      streak = 1;
    }

    const rewardAmount = REWARDS[currentDay];

    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newHistoryItem = {
      id: now.getTime().toString(),
      desc: `Check-in Diário (Dia ${currentDay})`,
      date: `Hoje, ${timeStr}`,
      value: `+${rewardAmount}`,
      isPlus: true
    };

    const history = data.history || [];
    history.unshift(newHistoryItem);

    if (!profileDoc.exists()) {
      transaction.set(profileRef, {
        current_day: currentDay,
        streak: streak,
        diamonds: diamonds + rewardAmount,
        last_checkin_at: now.toISOString(),
        history: history,
        freeSpinUsed: false,
        missions: { order: false, refer: false, combo: false }
      });
    } else {
      transaction.update(profileRef, {
        current_day: currentDay,
        streak: streak,
        diamonds: diamonds + rewardAmount,
        last_checkin_at: now.toISOString(),
        history: history
      });
    }

    return {
      success: true,
      reward: rewardAmount,
      currentDay,
      streak
    };
  });
};
