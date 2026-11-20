import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_SNAPSHOT_SCHEMA_VERSION,
  HOME_SNAPSHOT_TTL_MS,
  buildHomeSnapshotForCache,
  evaluateHomeReadiness,
  getCriticalHeroImageUrls,
  validateHomeSnapshotCache,
} from '../src/utils/homeBootstrap.ts';

describe('homeBootstrap — cache coerente v2', () => {
  const baseData = {
    vitrines: [
      {
        id: 'v1',
        title: 'Bebidas',
        subtitle: ['Geladas'],
        theme: 'purple' as const,
        active: true,
        order: 0,
        layout: 'horizontal' as const,
        maxProducts: 8,
        productIds: ['heineken-330ml'],
      },
    ],
    periodConfig: {
      morning: {
        id: 'morning' as const,
        title: 'Manhã',
        active: true,
        productIds: [],
        isAuto: true,
      },
    },
    megaOfertas: [],
    heroBanners: [
      {
        id: 'b1',
        title: 'Oferta',
        subtitle: '',
        image: '/hero_background.png',
        link: '/promotions',
        buttonText: 'Ver',
        highlightWords: [],
        order: 0,
        active: true,
        placement: 'home',
      },
    ],
    condoFavorites: [],
    homeLayout: [
      { id: 'block-hero', type: 'hero' as const, label: 'Hero', order: 0, active: true },
    ],
    brands: [
      { id: 'br1', name: 'Heineken', image: '/heineken.png', link: '/bebidas', order: 0, active: true },
    ],
    localPartners: [],
  };

  it('valida snapshot v2 completo e coerente dentro do TTL', () => {
    const now = 1_700_000_000_000;
    const snap = buildHomeSnapshotForCache(baseData, now);
    const validated = validateHomeSnapshotCache(snap, now + 60_000);
    assert.ok(validated);
    assert.equal(validated.version, HOME_SNAPSHOT_SCHEMA_VERSION);
    assert.equal(validated.vitrines.length, 1);
    assert.equal(validated.heroBanners.length, 1);
    assert.equal(validated.homeLayout.length, 1);
    assert.equal(validated.brands.length, 1);
  });

  it('rejeita cache com versão antiga, parcial (allSourcesSynced != true), corrompido ou expirado', () => {
    const now = 1_700_000_000_000;
    const snap = buildHomeSnapshotForCache(baseData, now);

    // Expirado
    assert.equal(validateHomeSnapshotCache(snap, now + HOME_SNAPSHOT_TTL_MS + 1000), null);
    // Versão antiga
    assert.equal(validateHomeSnapshotCache({ ...snap, version: 1 }, now), null);
    // Incompleto
    assert.equal(validateHomeSnapshotCache({ ...snap, allSourcesSynced: false }, now), null);
    // Coleção faltando
    const partial = { ...snap } as Record<string, unknown>;
    delete partial.homeLayout;
    assert.equal(validateHomeSnapshotCache(partial, now), null);
    // Corrompido
    assert.equal(validateHomeSnapshotCache('invalid-json', now), null);
    assert.equal(validateHomeSnapshotCache(null, now), null);
  });

  it('remove Data URI gigante de vídeo ao montar snapshot para cache', () => {
    const hugeVideo = `data:video/mp4;base64,${'A'.repeat(600_000)}`;
    const snap = buildHomeSnapshotForCache({
      ...baseData,
      heroBanners: [
        { ...baseData.heroBanners[0], videoUrl: hugeVideo, mediaType: 'video' },
      ],
    });
    assert.equal(snap.heroBanners[0].videoUrl, '');
  });
});

describe('homeBootstrap — máquina de estados de prontidão', () => {
  it('mantém loading enquanto catálogo, homeConfig, settings ou assets críticos não finalizaram (cache frio)', () => {
    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'loading',
        catalogCount: 0,
        homeConfigStatus: 'ready',
        adminConfigLoading: false,
        shippingConfigLoading: false,
        criticalAssetsReady: true,
        hasCoherentCache: false,
      }),
      'loading',
    );

    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'ready',
        catalogCount: 10,
        homeConfigStatus: 'loading',
        adminConfigLoading: false,
        shippingConfigLoading: false,
        criticalAssetsReady: true,
        hasCoherentCache: false,
      }),
      'loading',
    );

    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'ready',
        catalogCount: 10,
        homeConfigStatus: 'ready',
        adminConfigLoading: true,
        shippingConfigLoading: false,
        criticalAssetsReady: true,
        hasCoherentCache: false,
      }),
      'loading',
    );

    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'ready',
        catalogCount: 10,
        homeConfigStatus: 'ready',
        adminConfigLoading: false,
        shippingConfigLoading: false,
        criticalAssetsReady: false,
        hasCoherentCache: false,
      }),
      'loading',
    );
  });

  it('libera como ready quando todas as fontes responderam — inclusive com coleções vazias válidas', () => {
    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'ready',
        catalogCount: 0,
        homeConfigStatus: 'ready',
        adminConfigLoading: false,
        shippingConfigLoading: false,
        criticalAssetsReady: true,
        hasCoherentCache: false,
      }),
      'ready',
    );
  });

  it('libera como stale imediatamente quando existe cache coerente validado + catálogo + assets prontos', () => {
    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'ready',
        catalogCount: 12,
        homeConfigStatus: 'stale',
        adminConfigLoading: true,
        shippingConfigLoading: true,
        criticalAssetsReady: true,
        hasCoherentCache: true,
      }),
      'stale',
    );
  });

  it('retorna error em falha crítica sem cache coerente (nunca expõe Home parcial)', () => {
    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'error',
        catalogCount: 0,
        homeConfigStatus: 'ready',
        adminConfigLoading: false,
        shippingConfigLoading: false,
        criticalAssetsReady: true,
        hasCoherentCache: false,
      }),
      'error',
    );

    assert.equal(
      evaluateHomeReadiness({
        catalogStatus: 'ready',
        catalogCount: 10,
        homeConfigStatus: 'error',
        adminConfigLoading: false,
        shippingConfigLoading: false,
        criticalAssetsReady: true,
        hasCoherentCache: false,
      }),
      'error',
    );
  });
});

describe('homeBootstrap — extração e sanitização de assets críticos do Hero', () => {
  it('prioriza apenas a imagem ou pôster do primeiro slide e bloqueia URLs perigosas', () => {
    assert.deepEqual(
      getCriticalHeroImageUrls([
        { image: '/hero_background.png' },
        { image: '/hero_bebidas.png' },
      ]),
      ['/hero_background.png'],
    );

    assert.deepEqual(
      getCriticalHeroImageUrls([
        { mediaType: 'video', videoUrl: 'firestore-media://vid1', posterImage: '/poster.jpg' },
      ]),
      ['/poster.jpg'],
    );

    assert.deepEqual(
      getCriticalHeroImageUrls([
        { image: 'javascript:alert(1)' },
      ]),
      [],
    );
  });
});

