import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { buildAdminMock } from './__fakes__/fakeAdmin';

jest.mock('firebase-admin', () =>
  (jest.requireActual('./__fakes__/fakeAdmin') as { buildAdminMock: typeof buildAdminMock }).buildAdminMock(),
);

import { fakeDb } from './__fakes__/fakeAdmin';
import { createAdRewardHandlers } from './adReward';

type Callable = { run: (data: unknown, ctx: unknown) => Promise<Record<string, unknown>> };
const call = (fn: unknown, data: unknown, ctx: unknown) => (fn as Callable).run(data, ctx);

const USER = 'user1';
const OTHER_USER = 'user2';
const asUser = (uid = USER, extra: Record<string, unknown> = {}) => ({
  auth: { uid, token: {} },
  ...extra,
});

describe('Ad Reward Hardening (startAdWatchSession & claimAdReward)', () => {
  let nowMs = 1_750_000_000_000;

  const grantRewardMock = jest.fn(
    async (
      tx: FirebaseFirestore.Transaction,
      opts: { uid: string; amount: number; idempotencyKey: string },
    ) => {
      const ref = (await import('firebase-admin')).firestore().collection('users').doc(opts.uid).collection('clube').doc('profile');
      const snap = await tx.get(ref);
      const before = snap.exists ? Number((snap.data() as { diamonds?: number })?.diamonds ?? 0) : 0;
      const after = before + opts.amount;
      if (snap.exists) tx.update(ref, { diamonds: after });
      else tx.set(ref, { diamonds: after });
      return { newBalance: after, alreadyProcessed: false };
    },
  );

  const { startAdWatchSession, claimAdReward } = createAdRewardHandlers({
    grantReward: grantRewardMock,
    now: () => nowMs,
  });

  beforeEach(() => {
    fakeDb.reset();
    grantRewardMock.mockClear();
    nowMs = 1_750_000_000_000;
    delete process.env.ENFORCE_APP_CHECK;
    fakeDb.seed(`users/${USER}`, { role: 'client', name: 'Morador 1', diamonds: 10 });
    fakeDb.seed(`users/${USER}/clube/profile`, { diamonds: 10 });
    fakeDb.seed('ad_campaigns/camp1', {
      title: 'Campanha Melitta',
      active: true,
      rewardDiamonds: 7,
      minWatchSeconds: 10,
      maxClaimsPerUserPerDay: 2,
      maxClaimsPerUserTotal: 5,
      totalBudgetDiamonds: 100,
      spentDiamonds: 0,
    });
  });

  it('rejeita chamadas sem autenticação', async () => {
    await expect(call(startAdWatchSession, { campaignId: 'camp1' }, { auth: undefined })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(call(claimAdReward, { sessionId: 'sess1' }, { auth: undefined })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('ignora valor, duração e prova enviados pelo cliente e credita apenas após tempo mínimo no servidor', async () => {
    const started = await call(
      startAdWatchSession,
      { campaignId: 'camp1', reward: 9999, duration: 1, proof: 'fake' },
      asUser(USER),
    );
    expect(started.rewardDiamonds).toBe(7);
    expect(started.minWatchSeconds).toBe(10);

    // Tentativa imediata antes de 10s deve falhar
    nowMs += 4_000;
    await expect(
      call(claimAdReward, { sessionId: started.sessionId, amount: 9999, duration: 999 }, asUser(USER)),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    // Após 10s no relógio do servidor, credita exatamente 7 (da campanha)
    nowMs += 7_000;
    const claimed = await call(
      claimAdReward,
      { sessionId: started.sessionId, amount: 9999, campaignName: 'Fake' },
      asUser(USER),
    );
    expect(claimed.success).toBe(true);
    expect(claimed.grantedAmount).toBe(7);
    expect(claimed.newBalance).toBe(17);
    expect(claimed.alreadyProcessed).toBe(false);
    expect(grantRewardMock).toHaveBeenCalledTimes(1);
  });

  it('impede replay da mesma sessão sem creditar duas vezes', async () => {
    const started = await call(startAdWatchSession, { campaignId: 'camp1' }, asUser(USER));
    nowMs += 11_000;

    const first = await call(claimAdReward, { sessionId: started.sessionId }, asUser(USER));
    const second = await call(claimAdReward, { sessionId: started.sessionId }, asUser(USER));

    expect(first.newBalance).toBe(17);
    expect(second.newBalance).toBe(17);
    expect(second.alreadyProcessed).toBe(true);
    expect(grantRewardMock).toHaveBeenCalledTimes(1);
  });

  it('bloqueia nova tentativa/chave quando limite diário por usuário é atingido', async () => {
    // 1º resgate
    const s1 = await call(startAdWatchSession, { campaignId: 'camp1' }, asUser(USER));
    nowMs += 11_000;
    await call(claimAdReward, { sessionId: s1.sessionId }, asUser(USER));

    // 2º resgate (limite diário = 2)
    const s2 = await call(startAdWatchSession, { campaignId: 'camp1' }, asUser(USER));
    nowMs += 11_000;
    await call(claimAdReward, { sessionId: s2.sessionId }, asUser(USER));

    // 3º start no mesmo dia deve ser bloqueado
    await expect(call(startAdWatchSession, { campaignId: 'camp1' }, asUser(USER))).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('garante concorrência segura contra estouro de limite diário e orçamento total', async () => {
    fakeDb.seed('ad_campaigns/camp1', {
      title: 'Campanha Curta',
      active: true,
      rewardDiamonds: 10,
      minWatchSeconds: 10,
      maxClaimsPerUserPerDay: 1,
      totalBudgetDiamonds: 10,
      spentDiamonds: 0,
    });

    const s1 = await call(startAdWatchSession, { campaignId: 'camp1' }, asUser(USER));
    nowMs += 4_000; // respeita cooldown de 3s entre sessões
    // Outro usuário também inicia antes do primeiro resgate
    fakeDb.seed(`users/${OTHER_USER}`, { role: 'client', diamonds: 0 });
    fakeDb.seed(`users/${OTHER_USER}/clube/profile`, { diamonds: 0 });
    const s2 = await call(startAdWatchSession, { campaignId: 'camp1' }, asUser(OTHER_USER));

    nowMs += 11_000;

    const results = await Promise.allSettled([
      call(claimAdReward, { sessionId: s1.sessionId }, asUser(USER)),
      call(claimAdReward, { sessionId: s2.sessionId }, asUser(OTHER_USER)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(fakeDb.read('ad_campaigns/camp1')?.spentDiamonds).toBe(10);
  });

  it('rejeita campanha pausada ou expirada', async () => {
    fakeDb.seed('ad_campaigns/paused', {
      active: false,
      rewardDiamonds: 5,
      minWatchSeconds: 10,
      maxClaimsPerUserPerDay: 1,
      totalBudgetDiamonds: 50,
      spentDiamonds: 0,
    });
    await expect(call(startAdWatchSession, { campaignId: 'paused' }, asUser(USER))).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    fakeDb.seed('ad_campaigns/expired', {
      active: true,
      rewardDiamonds: 5,
      minWatchSeconds: 10,
      maxClaimsPerUserPerDay: 1,
      totalBudgetDiamonds: 50,
      spentDiamonds: 0,
      endsAt: nowMs - 1_000,
    });
    await expect(call(startAdWatchSession, { campaignId: 'expired' }, asUser(USER))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('rejeita quando orçamento total está esgotado', async () => {
    fakeDb.seed('ad_campaigns/empty', {
      active: true,
      rewardDiamonds: 5,
      minWatchSeconds: 10,
      maxClaimsPerUserPerDay: 2,
      totalBudgetDiamonds: 10,
      spentDiamonds: 10,
    });
    await expect(call(startAdWatchSession, { campaignId: 'empty' }, asUser(USER))).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('exige App Check quando ENFORCE_APP_CHECK=true', async () => {
    process.env.ENFORCE_APP_CHECK = 'true';
    await expect(call(startAdWatchSession, { campaignId: 'camp1' }, asUser(USER))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    const ok = await call(startAdWatchSession, { campaignId: 'camp1' }, asUser(USER, { app: { appId: 'app1' } }));
    expect(ok.sessionId).toBeTruthy();
  });
});
