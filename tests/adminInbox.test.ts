import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionInboxStatus,
  computeReactionCounts,
  isMessageVisibleToPartner,
  isUnreadByUser,
  normalizeInboxMessage,
  resolveEntityRoute,
  sanitizeInboxText,
  validateInboxAttachment,
} from '../src/admin/inbox/normalizers';
import { SYSTEM_AGENTS, buildDefaultAgentRule } from '../src/admin/inbox/agents';
import { DEFAULT_ROLES, permissionsAllow } from '../src/admin/permissions';

describe('Inbox ADM — Domain, Normalizers & Security', () => {
  it('registers all 11 distinct systemic agents', () => {
    assert.equal(SYSTEM_AGENTS.length, 11);
    const ids = new Set(SYSTEM_AGENTS.map((a) => a.id));
    assert.equal(ids.size, 11);
    for (const agent of SYSTEM_AGENTS) {
      const rule = buildDefaultAgentRule(agent.id);
      assert.equal(rule.id, agent.id);
      assert.equal(rule.toAll, true);
    }
  });

  it('strips HTML/script tags when sanitizing inbox text', () => {
    const clean = sanitizeInboxText('<script>alert(1)</script><b>Estoque baixo</b> no item');
    assert.equal(clean.includes('<script>'), false);
    assert.equal(clean.includes('<b>'), false);
    assert.ok(clean.includes('Estoque baixo'));
  });

  it('keeps targeted messages visible to all partner-admins', () => {
    const msg = normalizeInboxMessage('m1', {
      type: 'message',
      source: 'human',
      senderId: 'socio_1',
      senderName: 'Sócio 1',
      toAll: false,
      toUserIds: ['socio_2'],
      subject: 'Revisar margem',
      body: 'Conferir preço',
      priority: 'important',
      status: 'new',
    });
    assert.ok(msg);
    assert.equal(msg.toAll, false);
    assert.deepEqual(msg.toUserIds, ['socio_2']);
    assert.equal(isMessageVisibleToPartner(msg, ['inbox:view']), true);
    assert.equal(isMessageVisibleToPartner(msg, ['pedidos:view']), false);
  });

  it('tracks unread state per user', () => {
    const msg = normalizeInboxMessage('m2', {
      senderId: 'socio_1',
      subject: 'Teste',
      body: 'Corpo',
      readBy: { socio_1: '2026-11-20T00:00:00.000Z' },
    });
    assert.ok(msg);
    assert.equal(isUnreadByUser(msg, 'socio_1'), false);
    assert.equal(isUnreadByUser(msg, 'socio_2'), true);
  });

  it('computes idempotent reaction counts per type', () => {
    const added = computeReactionCounts({ like: 1 }, 'like', true);
    assert.equal(added.like, 2);
    const removed = computeReactionCounts(added, 'like', false);
    assert.equal(removed.like, 1);
  });

  it('enforces valid status transitions', () => {
    assert.equal(canTransitionInboxStatus('new', 'approved'), true);
    assert.equal(canTransitionInboxStatus('archived', 'new'), false);
  });

  it('resolves internal entity routes accurately', () => {
    assert.equal(resolveEntityRoute('product', 'p123'), '/admin/products/p123/view');
    assert.equal(resolveEntityRoute('order', 'o99'), '/admin/orders/o99');
    assert.equal(resolveEntityRoute('customer', 'c55'), '/admin/customers/c55');
  });

  it('validates attachments strictly (valid, oversize, dangerous extension, invalid MIME)', () => {
    const ok = validateInboxAttachment({
      fileName: 'Nota Fiscal #01.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 500,
    });
    assert.equal(ok.valid, true);
    if (ok.valid) {
      assert.ok(ok.safeName.endsWith('.pdf'));
    }

    const tooBig = validateInboxAttachment({
      fileName: 'huge.pdf',
      mimeType: 'application/pdf',
      size: 16 * 1024 * 1024,
    });
    assert.equal(tooBig.valid, false);

    const dangerous = validateInboxAttachment({
      fileName: 'malware.exe',
      mimeType: 'application/octet-stream',
      size: 1024,
    });
    assert.equal(dangerous.valid, false);

    const svgBlocked = validateInboxAttachment({
      fileName: 'vector.svg',
      mimeType: 'image/svg+xml',
      size: 1024,
    });
    assert.equal(svgBlocked.valid, false);
  });

  it('grants inbox permissions only to superadmin and admin roles', () => {
    const roleById = (id: string) => DEFAULT_ROLES.find((r) => r.id === id)!;
    assert.equal(permissionsAllow(roleById('superadmin').permissions, 'inbox:view'), true);
    assert.equal(permissionsAllow(roleById('admin').permissions, 'inbox:approve'), true);
    assert.equal(permissionsAllow(roleById('operacoes').permissions, 'inbox:view'), false);
    assert.equal(permissionsAllow(roleById('suporte').permissions, 'inbox:view'), false);
    assert.equal(permissionsAllow(roleById('marketing').permissions, 'inbox:view'), false);
  });
});
