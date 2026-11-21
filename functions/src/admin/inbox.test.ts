import {
  BACKEND_AGENTS,
  defaultBackendRule,
  evaluateAgentInsights,
  redactAgentText,
  shouldDeduplicate,
} from './inboxAgents';
import { DEFAULT_ROLES, permissionsAllow } from './permissions';

describe('Inbox ADM — Backend Agents, RBAC & Redaction', () => {
  it('defines all 11 systemic agents on backend', () => {
    const agents = Object.values(BACKEND_AGENTS);
    expect(agents).toHaveLength(11);
    const ids = new Set(agents.map((a) => a.id));
    expect(ids.size).toBe(11);
  });

  it('grants inbox:* only to superadmin and admin roles', () => {
    const roleById = (id: string) => DEFAULT_ROLES.find((r) => r.id === id)!;
    expect(permissionsAllow(roleById('superadmin').permissions, 'inbox:admin')).toBe(true);
    expect(permissionsAllow(roleById('admin').permissions, 'inbox:approve')).toBe(true);
    expect(permissionsAllow(roleById('operacoes').permissions, 'inbox:view')).toBe(false);
    expect(permissionsAllow(roleById('financeiro').permissions, 'inbox:view')).toBe(false);
    expect(permissionsAllow(roleById('suporte').permissions, 'inbox:view')).toBe(false);
    expect(permissionsAllow(roleById('marketing').permissions, 'inbox:view')).toBe(false);
  });

  it('redacts sensitive PII (email, CPF, phone, URLs, tokens)', () => {
    const raw =
      'Cliente joao.silva@example.com CPF 123.456.789-00 tel (11) 99999-8888 link https://evil.com/x Bearer abcdefghij1234567890';
    const safe = redactAgentText(raw);
    expect(safe).not.toContain('joao.silva@example.com');
    expect(safe).not.toContain('123.456.789-00');
    expect(safe).not.toContain('https://evil.com');
    expect(safe).not.toContain('abcdefghij1234567890');
  });

  it('deduplicates repeated agent keys within interval or muted keys', () => {
    const now = Date.parse('2026-11-20T12:00:00.000Z');
    const recent = '2026-11-20T11:30:00.000Z';
    const old = '2026-11-20T05:00:00.000Z';
    expect(shouldDeduplicate({ updatedAt: recent }, 180, [], 'k1', now).skip).toBe(true);
    expect(shouldDeduplicate({ updatedAt: old }, 180, [], 'k1', now).skip).toBe(false);
    expect(shouldDeduplicate(null, 180, [], 'k1', now).skip).toBe(false);
    expect(shouldDeduplicate(null, 180, ['k1'], 'k1', now).skip).toBe(true);
  });

  it('does not fabricate insights when Firestore collections are empty', async () => {
    const emptySnap = { docs: [], size: 0 };
    const mockDb = {
      collection: () => ({
        limit: () => ({ get: async () => emptySnap }),
        orderBy: () => ({ limit: () => ({ get: async () => emptySnap }) }),
        where: () => ({
          orderBy: () => ({ limit: () => ({ get: async () => emptySnap }) }),
          limit: () => ({ get: async () => emptySnap }),
        }),
      }),
    } as unknown as FirebaseFirestore.Firestore;

    for (const agent of Object.values(BACKEND_AGENTS)) {
      const rule = defaultBackendRule(agent.id);
      const proposals = await evaluateAgentInsights(mockDb, agent.id, rule);
      expect(proposals).toEqual([]);
    }
  });
});
