import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { buildAdminMock } from './__fakes__/fakeAdmin';

jest.mock('firebase-admin', () =>
  (jest.requireActual('./__fakes__/fakeAdmin') as { buildAdminMock: typeof buildAdminMock }).buildAdminMock(),
);

import { fakeDb } from './__fakes__/fakeAdmin';
import {
  validateSponsoredCampaignInput,
  toPublicCampaignPayload,
} from './sponsoredCampaignSchema';
import { adminListAdCampaigns, adminSaveAdCampaign, adminSetAdCampaignStatus } from './adCampaignAdmin';
import { createAdRewardHandlers } from './adReward';

type Callable = { run: (data: unknown, ctx: unknown) => Promise<Record<string, unknown>> };
const call = (fn: unknown, data: unknown, ctx: unknown) => (fn as Callable).run(data, ctx);

const asUser = (uid: string) => ({ auth: { uid, token: {} } });

const VALID_PAYLOAD = {
  title: 'Café da Manhã Especial',
  brand: 'Torrefação Local',
  description: 'Conheça os grãos especiais selecionados para moradores.',
  category: 'Cafeteria',
  logoUrl: '/assets/logo-parceiro.png',
  bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/demo/o/banner.jpg',
  assetApprovalStatus: 'approved',
  durationSeconds: 15,
  rewardType: 'diamonds',
  rewardDiamonds: 25,
  rewardTerms: 'Crédito em diamantes após contagem mínima no servidor.',
  ctaLabel: 'Falar no WhatsApp',
  ctaActionType: 'whatsapp',
  ctaTarget: 'https://wa.me/5511999999999',
  targetCondos: ['Condomínio Sol'],
  eligibilityRule: 'all_residents',
  maxClaimsPerUserPerDay: 1,
  maxClaimsPerUserTotal: 3,
  totalBudgetDiamonds: 100,
  totalBudgetClaims: 4,
  internalNotes: 'Contrato piloto #123 - privado',
  sponsorContact: 'contato@parceiro.local',
};

describe('Sponsored Campaigns Schema, RBAC, Privacy & Rewards', () => {
  let nowMs = 1_750_000_000_000;

  const grantRewardMock = jest.fn(
    async (tx: FirebaseFirestore.Transaction, opts: { uid: string; amount: number }) => {
      const ref = (await import('firebase-admin'))
        .firestore()
        .collection('users')
        .doc(opts.uid)
        .collection('clube')
        .doc('profile');
      const snap = await tx.get(ref);
      const before = snap.exists ? Number((snap.data() as { diamonds?: number })?.diamonds ?? 0) : 0;
      const after = before + opts.amount;
      if (snap.exists) tx.update(ref, { diamonds: after });
      else tx.set(ref, { diamonds: after });
      return { newBalance: after, alreadyProcessed: false };
    },
  );

  const { listPublicAdCampaigns, startAdWatchSession, claimAdReward } = createAdRewardHandlers({
    grantReward: grantRewardMock,
    now: () => nowMs,
  });

  beforeEach(() => {
    fakeDb.reset();
    grantRewardMock.mockClear();
    nowMs = 1_750_000_000_000;

    fakeDb.seed('role_assignments/mkt1', { roleId: 'marketing', status: 'active' });
    fakeDb.seed('role_assignments/sup1', { roleId: 'suporte', status: 'active' });
    fakeDb.seed('users/resident1', { role: 'client', condominium: 'Condomínio Sol' });
    fakeDb.seed('users/resident1/clube/profile', { diamonds: 10, completedAds: [] });
    fakeDb.seed('users/resident_other_condo', { role: 'client', condominium: 'Outro Residencial' });
    fakeDb.seed('users/resident_other_condo/clube/profile', { diamonds: 0, completedAds: [] });
    fakeDb.seed('premium_offers/legacy1', {
      brand: 'Marca Legada',
      title: 'Oferta Antiga',
      desc: 'Descrição antiga',
      rewardVal: 10,
      duration: 5,
    });
  });

  it('rejeita HTML/script e URLs inseguras na validação de schema', () => {
    expect(() =>
      validateSponsoredCampaignInput({ ...VALID_PAYLOAD, title: '<script>alert(1)</script>' }),
    ).toThrow(/HTML|script/i);

    expect(() =>
      validateSponsoredCampaignInput({ ...VALID_PAYLOAD, bannerUrl: 'javascript:alert(1)' }),
    ).toThrow(/inseguro|HTTPS/i);

    expect(() =>
      validateSponsoredCampaignInput({
        ...VALID_PAYLOAD,
        ctaActionType: 'whatsapp',
        ctaTarget: 'https://evil.example.com/phish',
      }),
    ).toThrow(/WhatsApp/i);

    expect(() =>
      validateSponsoredCampaignInput({
        ...VALID_PAYLOAD,
        ctaActionType: 'external_url',
        ctaTarget: 'http://insecure.example.com',
      }),
    ).toThrow(/HTTPS/i);
  });

  it('impede usuário comum e staff sem permissão marketing de criar, editar ou publicar campanhas', async () => {
    await expect(
      call(adminSaveAdCampaign, { payload: VALID_PAYLOAD, reason: 'Tentativa sem permissão' }, asUser('resident1')),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(
      call(adminSaveAdCampaign, { payload: VALID_PAYLOAD, reason: 'Suporte não cria campanha' }, asUser('sup1')),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    // Marketing cria rascunho + auditoria
    const created = await call(
      adminSaveAdCampaign,
      { payload: VALID_PAYLOAD, reason: 'Criação de campanha piloto' },
      asUser('mkt1'),
    );
    expect(created.success).toBe(true);
    expect(created.status).toBe('draft');

    // Suporte não pode publicar
    await expect(
      call(
        adminSetAdCampaignStatus,
        { campaignId: created.campaignId, action: 'publish', reason: 'Tentativa indevida' },
        asUser('sup1'),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('audita ciclo create -> publish -> pause, preserva dados legados e oculta campos internos no payload público', async () => {
    const created = await call(
      adminSaveAdCampaign,
      { payload: VALID_PAYLOAD, reason: 'Cadastro inicial' },
      asUser('mkt1'),
    );
    const campaignId = String(created.campaignId);

    // Enquanto rascunho, não aparece para moradores
    const beforePublish = await call(listPublicAdCampaigns, {}, asUser('resident1'));
    expect(beforePublish.campaigns).toHaveLength(0);

    // Publica via marketing:publish
    const pubRes = await call(
      adminSetAdCampaignStatus,
      { campaignId, action: 'publish', reason: 'Aprovado para exibição' },
      asUser('mkt1'),
    );
    expect(pubRes.status).toBe('active');

    // Morador do condomínio elegível enxerga sem campos internos
    const publicList = await call(listPublicAdCampaigns, {}, asUser('resident1'));
    const list = publicList.campaigns as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(campaignId);
    expect(list[0].internalNotes).toBeUndefined();
    expect(list[0].sponsorContact).toBeUndefined();
    expect(list[0].totalBudgetDiamonds).toBeUndefined();
    expect(list[0].spentDiamonds).toBeUndefined();

    // Morador de outro condomínio não recebe a campanha segmentada
    const otherCondoList = await call(listPublicAdCampaigns, {}, asUser('resident_other_condo'));
    expect(otherCondoList.campaigns).toHaveLength(0);

    // Admin list retorna campanhas e legacyOffers intactas
    const adminList = await call(adminListAdCampaigns, {}, asUser('mkt1'));
    expect((adminList.legacyOffers as unknown[]).length).toBe(1);

    // Pausa e valida que sai da lista pública
    await call(
      adminSetAdCampaignStatus,
      { campaignId, action: 'pause', reason: 'Pausa operacional' },
      asUser('mkt1'),
    );
    const afterPause = await call(listPublicAdCampaigns, {}, asUser('resident1'));
    expect(afterPause.campaigns).toHaveLength(0);

    // Trilha de auditoria contém os registros
    const auditSnap = await fakeDb.collection('audit_logs').get();
    const audits = auditSnap.docs.map((d) => d.data() as Record<string, unknown>);
    expect(audits.some((a) => a.action === 'ad_campaign.create' && a.actorUid === 'mkt1')).toBe(true);
    expect(audits.some((a) => a.action === 'ad_campaign.publish' && a.actorUid === 'mkt1')).toBe(true);
    expect(audits.some((a) => a.action === 'ad_campaign.pause' && a.actorUid === 'mkt1')).toBe(true);
  });

  it('suporta campanha de cupom/frete sem diamantes, respeitando timer no servidor e atualizando completedAds pelo backend', async () => {
    const created = await call(
      adminSaveAdCampaign,
      {
        payload: {
          ...VALID_PAYLOAD,
          rewardType: 'shipping',
          rewardDiamonds: 0,
          rewardCouponCode: 'FRETEPARCEIRO',
          totalBudgetDiamonds: 0,
          totalBudgetClaims: 2,
          ctaActionType: 'redeem_benefit',
          ctaLabel: 'Ir ao Carrinho',
          ctaTarget: '/cart',
        },
        reason: 'Campanha de benefício de frete',
      },
      asUser('mkt1'),
    );
    const campaignId = String(created.campaignId);
    await call(adminSetAdCampaignStatus, { campaignId, action: 'publish', reason: 'Publicar frete' }, asUser('mkt1'));

    const started = await call(startAdWatchSession, { campaignId }, asUser('resident1'));
    expect(started.rewardType).toBe('shipping');

    nowMs += 16_000;
    const claimed = await call(claimAdReward, { sessionId: started.sessionId }, asUser('resident1'));
    expect(claimed.success).toBe(true);
    expect(claimed.rewardType).toBe('shipping');
    expect(claimed.grantedCouponCode).toBe('FRETEPARCEIRO');
    expect(claimed.grantedAmount).toBe(0);
    expect(grantRewardMock).not.toHaveBeenCalled();

    const profile = fakeDb.read('users/resident1/clube/profile');
    expect(profile?.completedAds).toContain(campaignId);
  });

  it('toPublicCampaignPayload remove campos privados explicitamente', () => {
    const pub = toPublicCampaignPayload('c1', {
      ...VALID_PAYLOAD,
      spentDiamonds: 50,
      claimsCount: 2,
      createdBy: 'admin_secret',
    });
    expect((pub as unknown as Record<string, unknown>).internalNotes).toBeUndefined();
    expect((pub as unknown as Record<string, unknown>).totalBudgetDiamonds).toBeUndefined();
    expect((pub as unknown as Record<string, unknown>).createdBy).toBeUndefined();
  });
});
