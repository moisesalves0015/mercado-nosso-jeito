import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { buildAdminMock } from '../__fakes__/fakeAdmin';

jest.mock('firebase-admin', () =>
  (jest.requireActual('../__fakes__/fakeAdmin') as { buildAdminMock: typeof buildAdminMock }).buildAdminMock(),
);

import { fakeDb } from '../__fakes__/fakeAdmin';
import { adminUpdateSupportTicket } from './callables';

type Callable = { run: (data: unknown, ctx: unknown) => Promise<Record<string, unknown>> };
const call = (fn: unknown, data: unknown, ctx: unknown) => (fn as Callable).run(data, ctx);

const seedStaff = (uid: string, roleId: string, name: string, status: 'active' | 'suspended' = 'active') => {
  fakeDb.seed(`users/${uid}`, { role: 'client', name, email: `${uid}@mercado.test` });
  fakeDb.seed(`role_assignments/${uid}`, { roleId, status });
  return { auth: { uid, token: {} } };
};

describe('Support Ticket Hardening (adminUpdateSupportTicket)', () => {
  beforeEach(() => {
    fakeDb.reset();
    fakeDb.seed('support_tickets/t1', {
      ticketNumber: 'TCK-001',
      uid: 'cust1',
      subject: 'Produto avariado',
      status: 'open',
      priority: 'medium',
      assignedTo: null,
      assignedName: null,
      timeline: [],
    });
  });

  it('bloqueia permissão insuficiente (operacoes não pode arquivar; catalogo não pode editar)', async () => {
    const opCtx = seedStaff('u-op', 'operacoes', 'Operador João');
    const catCtx = seedStaff('u-cat', 'catalogo', 'Catálogo Ana');

    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', status: 'archived' }, opCtx),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', status: 'in_progress' }, catCtx),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejeita atribuição arbitrária (não-staff, suspenso, banido ou inexistente) e deriva nome do cadastro confiável', async () => {
    const supCtx = seedStaff('u-sup', 'suporte', 'Atendente Maria');
    seedStaff('u-susp', 'suporte', 'Suspenso', 'suspended');
    fakeDb.seed('users/u-client', { role: 'client', name: 'Morador Comum' });
    fakeDb.seed('users/u-banned', { role: 'banned', name: 'Banido' });
    fakeDb.seed('role_assignments/u-banned', { roleId: 'suporte', status: 'active' });

    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', assignedTo: 'nao-existe' }, supCtx),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', assignedTo: 'u-client' }, supCtx),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', assignedTo: 'u-susp' }, supCtx),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', assignedTo: 'u-banned' }, supCtx),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    // Tentativa de spoofar assignedName deve ser ignorada; nome vem de users/u-sup
    const ok = await call(
      adminUpdateSupportTicket,
      { ticketId: 't1', assignedTo: 'u-sup', assignedName: 'NOME FALSO DO CLIENTE' },
      supCtx,
    );
    expect(ok.assignedTo).toBe('u-sup');
    expect(ok.assignedName).toBe('Atendente Maria');
    expect(fakeDb.read('support_tickets/t1')?.assignedName).toBe('Atendente Maria');
  });

  it('valida transições de status e separa histórico de status, prioridade, atribuição e notas interna/externa', async () => {
    const supCtx = seedStaff('u-sup', 'suporte', 'Atendente Maria');

    // Ação combinada: status + prioridade + atribuição + nota interna
    await call(
      adminUpdateSupportTicket,
      {
        ticketId: 't1',
        status: 'in_progress',
        priority: 'urgent',
        assignedTo: 'u-sup',
        note: 'Verificando lote no estoque',
        internal: true,
      },
      supCtx,
    );

    const t1 = fakeDb.read('support_tickets/t1');
    const timeline = t1?.timeline as Array<Record<string, unknown>>;
    expect(timeline.map((e) => e.action)).toEqual([
      'status:in_progress',
      'priority:urgent',
      'assignment',
      'internal_note',
    ]);
    expect(timeline[0].internal).toBe(false);
    expect(timeline[3].internal).toBe(true);

    // Resposta externa separada
    await call(
      adminUpdateSupportTicket,
      { ticketId: 't1', status: 'resolved', note: 'Substituição enviada!', internal: false },
      supCtx,
    );

    // Transição inválida: resolved -> waiting_customer deve ser rejeitada
    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', status: 'waiting_customer' }, supCtx),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    // Arquivar com suporte:archive funciona; archived -> resolved é inválido
    await call(adminUpdateSupportTicket, { ticketId: 't1', status: 'archived' }, supCtx);
    await expect(
      call(adminUpdateSupportTicket, { ticketId: 't1', status: 'resolved' }, supCtx),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    const audits = fakeDb.childDocs('audit_logs');
    expect(audits.length).toBeGreaterThanOrEqual(3);
  });
});

