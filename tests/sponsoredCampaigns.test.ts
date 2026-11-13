import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeActionUrl } from '../src/shared/sponsoredCampaign.ts';
import { DEFAULT_ROLES_BY_ID, permissionsAllow } from '../src/admin/permissions.ts';
import { resolveAdminBreadcrumbs } from '../src/admin/routes.ts';

describe('Sponsored Campaigns Frontend Schema, RBAC & Routes', () => {
  it('validates CTA URLs and blocks dangerous schemes', () => {
    assert.equal(isSafeActionUrl('whatsapp', 'https://wa.me/5511999999999'), true);
    assert.equal(isSafeActionUrl('whatsapp', 'https://api.whatsapp.com/send?phone=5511999999999'), true);
    assert.equal(isSafeActionUrl('whatsapp', 'https://evil.com/wa'), false);

    assert.equal(isSafeActionUrl('external_url', 'https://parceiro.com.br/oferta'), true);
    assert.equal(isSafeActionUrl('external_url', 'http://parceiro.com.br'), false);
    assert.equal(isSafeActionUrl('external_url', 'javascript:alert(1)'), false);

    assert.equal(isSafeActionUrl('redeem_benefit', '/cart'), true);
    assert.equal(isSafeActionUrl('redeem_benefit', 'FRETE10'), true);
    assert.equal(isSafeActionUrl('redeem_benefit', '//evil.com'), false);
  });

  it('grants marketing:publish to marketing role and denies it for suporte role', () => {
    const marketingRole = DEFAULT_ROLES_BY_ID['marketing'];
    const suporteRole = DEFAULT_ROLES_BY_ID['suporte'];
    assert.ok(marketingRole);
    assert.ok(suporteRole);
    assert.equal(permissionsAllow(marketingRole.permissions, 'marketing:publish'), true);
    assert.equal(permissionsAllow(suporteRole.permissions, 'marketing:publish'), false);
  });

  it('resolves breadcrumbs for sponsored campaigns subroutes', () => {
    const listCrumbs = resolveAdminBreadcrumbs('/admin/marketing/campaigns');
    assert.equal(listCrumbs[1]?.label, 'Marketing & Cupons');
    assert.equal(listCrumbs[2]?.label, 'Anúncios Patrocinados');

    const newCrumbs = resolveAdminBreadcrumbs('/admin/marketing/campaigns/new');
    assert.equal(newCrumbs[2]?.to, '/admin/marketing/campaigns');
    assert.equal(newCrumbs[3]?.label, 'Nova Campanha');

    const editCrumbs = resolveAdminBreadcrumbs('/admin/marketing/campaigns/camp_01');
    assert.equal(editCrumbs[2]?.to, '/admin/marketing/campaigns');
    assert.match(editCrumbs[3]?.label ?? '', /Campanha #camp_01/);
  });
});

