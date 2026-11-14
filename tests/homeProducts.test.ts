import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSearchPath,
  findMissingProductIds,
  getCategoryHref,
  getHomeProductPrice,
  getPeriodForHour,
  hasCurrentPromotion,
  isWithinWindow,
  normalizeHeroBanner,
  normalizeHomeProduct,
  normalizeMegaOferta,
  normalizeSearchQuery,
  normalizeSubtitle,
  normalizeVitrine,
  resolveHomeProducts,
  resolveLink,
  resolveVitrineDestination,
} from '../src/utils/homeProducts';
import type { HomePeriod, HomeProduct } from '../src/types/home';
import { buildShowcases } from '../src/utils/homeShowcases';
import { QUICK_CATEGORIES, VISUAL_CATEGORIES } from '../src/data/homeCategories';
import { resolveCategoryIcon, resolvePeriodIcon } from '../src/utils/homeCategoryIcons';
import { cleanImageUrl, sanitizeBannerImageUrl, DEFAULT_PRODUCT_IMAGE, DEFAULT_BANNER_IMAGE } from '../src/utils/imageUrl';

const make = (over: Record<string, unknown> = {}): HomeProduct =>
  normalizeHomeProduct({ id: 'p1', title: 'Café', price: '10,50', image: '/c.png', category: 'cafe', stock: 3, ...over })!;

describe('normalizeHomeProduct', () => {
  it('exige id e título', () => {
    assert.equal(normalizeHomeProduct({ title: 'x' }), null);
    assert.equal(normalizeHomeProduct({ id: 'a' }), null);
    assert.equal(normalizeHomeProduct(null), null);
  });

  it('converte preço, estoque e remove campos indefinidos', () => {
    const p = make({ stock: '4.9' });
    assert.equal(p.price, 10.5);
    assert.equal(p.stock, 4);
    assert.equal(p.active, true);
    assert.equal(p.badge, undefined);
  });

  it('produto arquivado ou inativo não é comprável', () => {
    const inactive = resolveHomeProducts(['p1'], new Map([['p1', make({ active: false })]]));
    const archived = resolveHomeProducts(['p1'], new Map([['p1', make({ archivedAt: 'x' })]]));
    assert.equal(inactive.length, 0);
    assert.equal(archived.length, 0);
  });
});

describe('preço efetivo', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  it('usa promoção só quando vigente', () => {
    const promo = make({ promoActive: true, promoPrice: 8, promoExpiry: '2026-12-01T00:00:00Z' });
    assert.equal(getHomeProductPrice(promo, now), 8);
    assert.equal(hasCurrentPromotion(promo, now), true);
    const expired = make({ promoActive: true, promoPrice: 8, promoExpiry: '2026-01-01T00:00:00Z' });
    assert.equal(getHomeProductPrice(expired, now), 10.5);
    assert.equal(hasCurrentPromotion(expired, now), false);
  });
});

describe('resolveHomeProducts', () => {
  const byId = new Map<string, HomeProduct>([
    ['a', make({ id: 'a' })],
    ['b', make({ id: 'b', stock: 0 })],
    ['c', make({ id: 'c' })],
    ['d', make({ id: 'd' })],
  ]);

  it('descarta inexistentes, sem estoque e duplicados; respeita limite e ordem', () => {
    assert.deepEqual(resolveHomeProducts(['d', 'x', 'b', 'd', 'a', 'c'], byId).map(p => p.id), ['d', 'a', 'c']);
    assert.deepEqual(resolveHomeProducts(['d', 'a', 'c'], byId, 2).map(p => p.id), ['d', 'a']);
  });

  it('lista IDs ausentes do catálogo', () => {
    assert.deepEqual(findMissingProductIds(['a', 'zzz'], byId), ['zzz']);
  });
});

describe('vigência', () => {
  const now = new Date(2026, 9, 20, 15, 0, 0);
  it('data sem hora vale até o fim do dia local', () => {
    assert.equal(isWithinWindow(null, '2026-10-20', now), true);
    assert.equal(isWithinWindow(null, '2026-10-19', now), false);
    assert.equal(isWithinWindow('2026-10-20', null, now), true);
    assert.equal(isWithinWindow('2026-10-21', null, now), false);
  });
  it('data ilegível invalida a configuração', () => {
    assert.equal(isWithinWindow(null, 'lixo', now), false);
  });
  it('sem limites é sempre vigente', () => {
    assert.equal(isWithinWindow(undefined, undefined, now), true);
  });
});

describe('links e busca', () => {
  it('aceita só rota interna ou http(s)', () => {
    assert.deepEqual(resolveLink('/promotions'), { kind: 'internal', href: '/promotions' });
    assert.equal(resolveLink('javascript:alert(1)'), null);
    assert.equal(resolveLink('//evil.com'), null);
    assert.equal(resolveLink('https://exemplo.com/x')?.kind, 'external');
    assert.equal(resolveLink(''), null);
  });

  it('normaliza consulta e monta URL', () => {
    assert.equal(normalizeSearchQuery('  pão   de\tqueijo \n'), 'pão de queijo');
    assert.equal(buildSearchPath('  pão  de queijo '), '/search?q=p%C3%A3o+de+queijo');
    assert.equal(buildSearchPath('   '), null);
    assert.equal(buildSearchPath('', 'Bebidas'), '/search?category=Bebidas');
  });
});

describe('período', () => {
  it('mapeia horas para períodos', () => {
    assert.equal(getPeriodForHour(6), 'morning');
    assert.equal(getPeriodForHour(13), 'lunch');
    assert.equal(getPeriodForHour(17), 'afternoon');
    assert.equal(getPeriodForHour(23), 'night');
    assert.equal(getPeriodForHour(3), 'dawn');
  });
});

describe('configuração de vitrine', () => {
  it('padroniza subtitle, limites e tema', () => {
    assert.deepEqual(normalizeSubtitle('a'), ['a']);
    assert.deepEqual(normalizeSubtitle(['a', ' ', 'b']), ['a', 'b']);
    const { value } = normalizeVitrine('v', { title: 'T', subtitle: 'S', theme: 'x', maxProducts: 999, productIds: ['a', 'a', 'b'] });
    assert.equal(value?.theme, 'green');
    assert.equal(value?.maxProducts, 30);
    assert.deepEqual(value?.productIds, ['a', 'b']);
    assert.deepEqual(value?.subtitle, ['S']);
  });

  it('ignora vitrine sem título e avisa vitrine vazia', () => {
    assert.equal(normalizeVitrine('v', { productIds: ['a'] }).value, null);
    assert.equal(normalizeVitrine('v', { title: 'T' }).issues.length, 1);
  });

  it('destino: linkTo > category > categoria predominante', () => {
    const products = [make({ id: '1', category: 'Bebidas' }), make({ id: '2', category: 'Bebidas' }), make({ id: '3', category: 'cafe' })];
    assert.equal(resolveVitrineDestination({ linkTo: '/bebidas' }, products), '/bebidas');
    assert.equal(resolveVitrineDestination({ category: 'Limpeza' }, products), '/search?category=Limpeza');
    assert.equal(resolveVitrineDestination({}, products), '/search?category=Bebidas');
    assert.equal(resolveVitrineDestination({}, []), undefined);
  });
});

describe('mega-ofertas e banners', () => {
  it('exige productId', () => {
    assert.equal(normalizeMegaOferta('m', { badge: 'x' }).value, null);
    assert.equal(normalizeMegaOferta('m', { productId: 'p' }).value?.productId, 'p');
  });

  it('banner: descarta vazio, avisa link inválido, falta de imagem e preserva flag active', () => {
    assert.equal(normalizeHeroBanner('b', {}).value, null);
    const r = normalizeHeroBanner('b', { title: 'Oi', link: 'javascript:x' });
    assert.equal(r.value?.link, '');
    assert.equal(r.value?.active, true);
    assert.equal(r.issues.length, 2);

    const inactive = normalizeHeroBanner('b2', { title: 'Banner Inativo', image: '/hero_bebidas.png', active: false });
    assert.equal(inactive.value?.active, false);
  });

  it('preserva imagens complementares de produtos e sanitiza URLs de imagem e banners', () => {
    const prod = make({ images: [' https://cdn.exemplo.com/1.png ', '', 'data:image/webp;base64,AAAA'] });
    assert.deepEqual(prod.images, ['https://cdn.exemplo.com/1.png', 'data:image/webp;base64,AAAA']);

    assert.equal(cleanImageUrl('data:image/png;base64,iVBOR\n w0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(cleanImageUrl(''), DEFAULT_PRODUCT_IMAGE);
    assert.equal(sanitizeBannerImageUrl('data:image/jpeg;base64,/9j/4AAQ\r\nSkZJRg=='), 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    assert.equal(sanitizeBannerImageUrl('   '), DEFAULT_BANNER_IMAGE);
  });
});

describe('getCategoryHref', () => {
  it('padroniza destinos de rota, busca e categoria', () => {
    assert.equal(getCategoryHref({ type: 'route', target: '/promotions' }), '/promotions');
    assert.equal(getCategoryHref({ type: 'route', target: 'javascript:x' }), '/categories');
    assert.equal(getCategoryHref({ type: 'search', target: 'doces' }), '/search?q=doces');
    assert.equal(getCategoryHref({ type: 'category', target: 'Limpeza' }), '/search?category=Limpeza');
    assert.equal(getCategoryHref({ type: 'search', target: '  ' }), '/search');
  });
});

describe('buildShowcases', () => {
  const now = new Date(2026, 9, 20, 12, 0, 0);
  const prods = [
    make({ id: 'a', category: 'Bebidas' }),
    make({ id: 'b', category: 'Bebidas' }),
    make({ id: 'c', category: 'Bebidas' }),
    make({ id: 'd', category: 'limpeza', stock: 0 }),
    make({ id: 'e', category: 'limpeza' }),
  ];
  const byId = new Map(prods.map(p => [p.id, p]));
  const vit = (over: Record<string, unknown>) =>
    normalizeVitrine((over.id as string) ?? 'v', { title: 'T', productIds: ['a', 'b', 'c', 'zz'], ...over }).value!;

  it('aplica maxProducts, vigência, ativo e ordem estável', () => {
    const result = buildShowcases(
      [
        vit({ id: 'v2', order: 2, maxProducts: 2 }),
        vit({ id: 'v1', order: 1 }),
        vit({ id: 'old', order: 0, validUntil: '2026-10-01' }),
        vit({ id: 'off', order: 0, active: false }),
      ],
      prods,
      byId,
      now,
    );
    assert.deepEqual(result.map(s => s.key), ['v1', 'v2']);
    assert.equal(result[1].products.length, 2);
    assert.deepEqual(result[0].missingIds, ['zz']);
    assert.equal(result[0].to, '/search?category=Bebidas');
  });

  it('sem vitrines vigentes usa fallback só com produtos reais e compráveis', () => {
    const result = buildShowcases([], prods, byId, now);
    assert.deepEqual(result.map(s => s.key), ['fallback-bebidas', 'fallback-alimentos', 'fallback-limpeza']);
    assert.equal(result[0].products.length, 3);
    assert.deepEqual(result[2].products.map(p => p.id), ['e']);
  });
});

describe('homeCategoryIcons (Estilo 02 — Mercado Premium)', () => {
  it('resolve ícone semântico para todas as QUICK_CATEGORIES e VISUAL_CATEGORIES', () => {
    for (const item of [...QUICK_CATEGORIES, ...VISUAL_CATEGORIES]) {
      const icon = resolveCategoryIcon(item);
      assert.ok(icon, `Ícone ausente para categoria ${item.id} (${item.label})`);
    }
  });

  it('usa fallback seguro para categoria desconhecida', () => {
    const fallback = resolveCategoryIcon({ id: 'desconhecida-xyz' });
    assert.ok(fallback);
  });

  it('resolve ícone vetorial para todos os 5 períodos do dia', () => {
    const periods: HomePeriod[] = ['morning', 'lunch', 'afternoon', 'night', 'dawn'];
    for (const periodId of periods) {
      const icon = resolvePeriodIcon(periodId);
      assert.ok(icon, `Ícone ausente para período ${periodId}`);
    }
  });
});