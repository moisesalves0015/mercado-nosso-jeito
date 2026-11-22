import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { requireAnyPermission, requirePermission, StaffAccess } from './rbac';
import { writeAudit, writeAuditSafe } from './audit';
import {
  BACKEND_AGENTS,
  BackendAgentRuleConfig,
  defaultBackendRule,
  evaluateAgentInsights,
  InboxMessageType,
  InboxPriority,
  redactAgentText,
  shouldDeduplicate,
  SystemAgentId,
} from './inboxAgents';

const db = () => admin.firestore();
const HttpsError = functions.https.HttpsError;

const VALID_TYPES = new Set<string>([
  'message',
  'note',
  'alert',
  'insight',
  'task_suggestion',
  'decision',
  'incident',
  'announcement',
]);

const VALID_PRIORITIES = new Set<string>(['informative', 'attention', 'important', 'critical']);

const VALID_STATUSES = new Set<string>([
  'new',
  'read',
  'in_review',
  'awaiting_reply',
  'in_discussion',
  'approved',
  'rejected',
  'converted_to_task',
  'in_progress',
  'resolved',
  'archived',
]);

const VALID_REACTIONS = new Set<string>(['like', 'agree', 'disagree', 'attention', 'check']);

const ALLOWED_MIMES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const DANGEROUS_EXT = /\.(exe|bat|cmd|sh|ps1|vbs|js|mjs|cjs|jar|msi|dll|scr|com|php|py|rb|html|htm|svg)$/i;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return redactAgentText(
    raw
      .replace(/<[^>]*>/g, '')
      .replace(/\b(?:javascript|vbscript|data:text\/html):[^\s]*/gi, '[link removido]')
      .trim(),
  ).slice(0, maxLen);
}

function sanitizeEntities(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const validTypes = new Set([
    'product',
    'order',
    'customer',
    'purchase_list',
    'supplier',
    'quote',
    'report',
    'task',
    'ticket',
    'campaign',
  ]);
  const out: Array<Record<string, unknown>> = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const type = String(r.type || '');
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const label = sanitizeText(r.label, 120);
    if (!validTypes.has(type) || !id || !label) continue;
    out.push({
      type,
      id,
      label,
      ...(r.snapshot && typeof r.snapshot === 'object' ? { snapshot: r.snapshot } : {}),
    });
  }
  return out;
}

async function resolveActorProfile(access: StaffAccess): Promise<{ name: string; roleLabel: string }> {
  const userSnap = await db().collection('users').doc(access.uid).get();
  const u = userSnap.exists ? (userSnap.data() as { name?: string; displayName?: string; email?: string }) : undefined;
  const name = sanitizeText(u?.name || u?.displayName || u?.email || access.uid, 80) || 'Administrador';
  const roleLabel = access.isSuperadmin ? 'Superadmin' : access.roleId || 'Administrador';
  return { name, roleLabel };
}

async function audited<T>(
  access: StaffAccess,
  meta: { action: string; module: string; entityType: string; entityId: string },
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpsError && (err.code === 'permission-denied' || err.code === 'failed-precondition')) {
      await writeAuditSafe({
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        ...meta,
        result: 'denied',
        error: err.message,
        source: 'callable',
      });
    }
    throw err;
  }
}

export const inboxListPartners = functions.https.onCall(async (_data, context) => {
  const access = await requirePermission(context.auth, 'inbox:view');
  const partners: Array<{ uid: string; name: string; email: string; roleId: string; roleLabel: string; photoURL?: string }> = [];
  const seen = new Set<string>();

  const raSnap = await db().collection('role_assignments').where('status', '==', 'active').get();
  for (const d of raSnap.docs) {
    const ra = d.data() as { roleId?: string; displayName?: string; email?: string };
    if (ra.roleId === 'superadmin' || ra.roleId === 'admin') {
      seen.add(d.id);
      const userSnap = await db().collection('users').doc(d.id).get();
      const u = userSnap.exists ? (userSnap.data() as { name?: string; email?: string; photoURL?: string }) : {};
      partners.push({
        uid: d.id,
        name: sanitizeText(u.name || ra.displayName || ra.email || 'Sócio Admin', 80),
        email: String(u.email || ra.email || ''),
        roleId: ra.roleId,
        roleLabel: ra.roleId === 'superadmin' ? 'Superadmin' : 'Administrador',
        photoURL: typeof u.photoURL === 'string' ? u.photoURL : undefined,
      });
    }
  }

  // Fallback for legacy admins in `users` collection without `role_assignments`
  const legacySnap = await db().collection('users').where('role', 'in', ['admin', 'superadmin']).get();
  for (const d of legacySnap.docs) {
    if (seen.has(d.id)) continue;
    const u = d.data() as { name?: string; email?: string; role?: string; photoURL?: string };
    seen.add(d.id);
    partners.push({
      uid: d.id,
      name: sanitizeText(u.name || u.email || 'Sócio Admin', 80),
      email: String(u.email || ''),
      roleId: u.role || 'admin',
      roleLabel: u.role === 'superadmin' ? 'Superadmin' : 'Administrador',
      photoURL: typeof u.photoURL === 'string' ? u.photoURL : undefined,
    });
  }

  if (!seen.has(access.uid)) {
    const actor = await resolveActorProfile(access);
    partners.push({
      uid: access.uid,
      name: actor.name,
      email: '',
      roleId: access.roleId || 'admin',
      roleLabel: actor.roleLabel,
    });
  }

  return { partners };
});

export const inboxCreateMessage = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:create', 'inbox:admin']);
  return audited(access, { action: 'inbox_create_message', module: 'inbox', entityType: 'admin_inbox_message', entityId: 'new' }, async () => {
    const subject = sanitizeText(data?.subject, 160);
    const body = sanitizeText(data?.body, 8000);
    if (subject.length < 2) throw new HttpsError('invalid-argument', 'Assunto obrigatório (mín. 2 caracteres).');
    if (body.length < 2) throw new HttpsError('invalid-argument', 'Corpo da mensagem obrigatório.');

    const type = VALID_TYPES.has(data?.type) ? (data.type as InboxMessageType) : 'message';
    const priority = VALID_PRIORITIES.has(data?.priority) ? (data.priority as InboxPriority) : 'informative';
    const toAll = data?.toAll !== false;
    const toUserIds = Array.isArray(data?.toUserIds)
      ? data.toUserIds.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 15)
      : [];
    if (!toAll && toUserIds.length === 0) {
      throw new HttpsError('invalid-argument', 'Selecione ao menos um sócio destinatário ou marque "Todos".');
    }

    const assignedToUserId =
      typeof data?.assignedToUserId === 'string' && data.assignedToUserId.trim()
        ? data.assignedToUserId.trim()
        : null;
    const requestedResponseFromUserId =
      typeof data?.requestedResponseFromUserId === 'string' && data.requestedResponseFromUserId.trim()
        ? data.requestedResponseFromUserId.trim()
        : data?.requestReply === true && !toAll && toUserIds[0]
        ? toUserIds[0]
        : null;
    const dueAt =
      typeof data?.dueAt === 'string' && data.dueAt.trim() && Number.isFinite(Date.parse(data.dueAt))
        ? admin.firestore.Timestamp.fromDate(new Date(data.dueAt))
        : null;
    const relatedEntities = sanitizeEntities(data?.relatedEntities);
    const createTaskAlong = data?.createTaskAlong === true;

    const actor = await resolveActorProfile(access);
    const msgRef = db().collection('admin_inbox_messages').doc();
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const initialStatus = requestedResponseFromUserId ? 'awaiting_reply' : createTaskAlong ? 'converted_to_task' : 'new';

    await db().runTransaction(async (tx) => {
      let suggestedTaskId: string | null = null;
      if (createTaskAlong) {
        const taskRef = db().collection('admin_inbox_tasks').doc();
        suggestedTaskId = taskRef.id;
        const taskDoc = {
          messageId: msgRef.id,
          title: sanitizeText(data?.taskTitle || subject, 160),
          description: body.slice(0, 1000),
          assignedToUserId: assignedToUserId || requestedResponseFromUserId || null,
          priority,
          status: 'open',
          dueAt,
          checklist: [],
          relatedEntities,
          createdBy: access.uid,
          createdAt: nowTs,
          updatedAt: nowTs,
        };
        tx.set(taskRef, taskDoc);
        tx.set(msgRef.collection('tasks').doc(taskRef.id), taskDoc);
      }

      tx.set(msgRef, {
        type,
        source: 'human',
        senderId: access.uid,
        senderName: actor.name,
        senderRole: actor.roleLabel,
        toUserIds,
        toAll,
        subject,
        body,
        bodyFormat: 'plain_text',
        priority,
        status: initialStatus,
        assignedToUserId,
        requestedResponseFromUserId,
        dueAt,
        createdAt: nowTs,
        updatedAt: nowTs,
        archivedAt: null,
        occurrenceCount: 1,
        requiresApproval: type === 'decision',
        relatedEntities,
        attachmentIds: [],
        suggestedTaskId,
        readBy: { [access.uid]: nowTs },
        starredBy: {},
        importantBy: {},
        confirmedBy: {},
        commentCount: 0,
        attachmentCount: 0,
        reactionCounts: {},
        createdBy: access.uid,
      });

      const histRef = msgRef.collection('history').doc();
      tx.set(histRef, {
        messageId: msgRef.id,
        actorId: access.uid,
        actorName: actor.name,
        actorType: 'human',
        action: 'created',
        toStatus: initialStatus,
        details: toAll ? 'Enviada para todos os sócios administradores' : `Direcionada a ${toUserIds.length} destinatário(s)`,
        createdAt: nowTs,
      });

      await writeAudit(
        {
          actorUid: access.uid,
          actorRole: access.roleId,
          actorPermissions: access.permissions,
          action: 'inbox_message_created',
          module: 'inbox',
          entityType: 'admin_inbox_message',
          entityId: msgRef.id,
          after: { subject, type, priority, toAll, toUserIds, createTaskAlong },
          result: 'success',
          source: 'callable',
        },
        tx,
      );
    });

    return { messageId: msgRef.id };
  });
});

export const inboxAddComment = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:create', 'inbox:edit', 'inbox:admin']);
  const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
  const body = sanitizeText(data?.body, 2000);
  if (!messageId || body.length < 1) {
    throw new HttpsError('invalid-argument', 'Mensagem e texto do comentário são obrigatórios.');
  }

  const actor = await resolveActorProfile(access);
  const msgRef = db().collection('admin_inbox_messages').doc(messageId);
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(msgRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
    const prev = snap.data() as { status?: string };

    const commentRef = msgRef.collection('comments').doc();
    tx.set(commentRef, {
      messageId,
      authorId: access.uid,
      authorName: actor.name,
      authorRole: actor.roleLabel,
      body,
      kind: typeof data?.kind === 'string' ? data.kind : 'comment',
      createdAt: nowTs,
    });

    const nextStatus =
      prev.status === 'new' || prev.status === 'read' || prev.status === 'awaiting_reply'
        ? 'in_discussion'
        : prev.status || 'in_discussion';

    tx.update(msgRef, {
      commentCount: admin.firestore.FieldValue.increment(1),
      status: nextStatus,
      updatedAt: nowTs,
      [`readBy.${access.uid}`]: nowTs,
    });

    tx.set(msgRef.collection('history').doc(), {
      messageId,
      actorId: access.uid,
      actorName: actor.name,
      actorType: 'human',
      action: 'commented',
      fromStatus: prev.status || 'new',
      toStatus: nextStatus,
      details: body.slice(0, 140),
      createdAt: nowTs,
    });

    await writeAudit(
      {
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        action: 'inbox_comment_added',
        module: 'inbox',
        entityType: 'admin_inbox_message',
        entityId: messageId,
        result: 'success',
        source: 'callable',
      },
      tx,
    );
  });

  return { ok: true };
});

export const inboxToggleReaction = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:view', 'inbox:edit', 'inbox:admin']);
  const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
  const type = typeof data?.type === 'string' ? data.type.trim() : '';
  if (!messageId || !VALID_REACTIONS.has(type)) {
    throw new HttpsError('invalid-argument', 'Reação inválida.');
  }

  const justification = sanitizeText(data?.justification, 400);
  const actor = await resolveActorProfile(access);
  const msgRef = db().collection('admin_inbox_messages').doc(messageId);
  const reactionRef = msgRef.collection('reactions').doc(`${access.uid}_${type}`);
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  const added = await db().runTransaction(async (tx) => {
    const [msgSnap, reactSnap] = await Promise.all([tx.get(msgRef), tx.get(reactionRef)]);
    if (!msgSnap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
    const msgData = msgSnap.data() as { reactionCounts?: Record<string, number> };
    const prevCount = Number(msgData.reactionCounts?.[type] ?? 0);

    if (reactSnap.exists) {
      tx.delete(reactionRef);
      tx.update(msgRef, {
        [`reactionCounts.${type}`]: Math.max(0, prevCount - 1),
        updatedAt: nowTs,
      });
      return false;
    }

    tx.set(reactionRef, {
      messageId,
      userId: access.uid,
      userName: actor.name,
      type,
      ...(justification ? { justification } : {}),
      createdAt: nowTs,
    });
    tx.update(msgRef, {
      [`reactionCounts.${type}`]: prevCount + 1,
      updatedAt: nowTs,
    });

    if (type === 'disagree' || type === 'agree') {
      tx.set(msgRef.collection('history').doc(), {
        messageId,
        actorId: access.uid,
        actorName: actor.name,
        actorType: 'human',
        action: `reaction_${type}`,
        ...(justification ? { justification } : {}),
        createdAt: nowTs,
      });
      await writeAudit(
        {
          actorUid: access.uid,
          actorRole: access.roleId,
          actorPermissions: access.permissions,
          action: `inbox_reaction_${type}`,
          module: 'inbox',
          entityType: 'admin_inbox_message',
          entityId: messageId,
          reason: justification || null,
          result: 'success',
          source: 'callable',
        },
        tx,
      );
    }
    return true;
  });

  return { ok: true, added };
});

export const inboxMarkRead = functions.https.onCall(async (data, context) => {
  const access = await requirePermission(context.auth, 'inbox:view');
  const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
  const unread = data?.unread === true;
  if (!messageId) throw new HttpsError('invalid-argument', 'messageId obrigatório.');

  const msgRef = db().collection('admin_inbox_messages').doc(messageId);
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(msgRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
    const cur = snap.data() as { status?: string };

    if (unread) {
      tx.update(msgRef, {
        [`readBy.${access.uid}`]: admin.firestore.FieldValue.delete(),
        ...(cur.status === 'read' ? { status: 'new' } : {}),
      });
    } else {
      tx.update(msgRef, {
        [`readBy.${access.uid}`]: nowTs,
        ...(cur.status === 'new' ? { status: 'read' } : {}),
      });
    }
  });

  return { ok: true };
});

export const inboxUpdateStatus = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:edit', 'inbox:archive', 'inbox:admin']);
  return audited(access, { action: 'inbox_update_status', module: 'inbox', entityType: 'admin_inbox_message', entityId: String(data?.messageId || '') }, async () => {
    const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
    if (!messageId) throw new HttpsError('invalid-argument', 'messageId obrigatório.');

    const actor = await resolveActorProfile(access);
    const msgRef = db().collection('admin_inbox_messages').doc(messageId);
    const nowTs = admin.firestore.FieldValue.serverTimestamp();

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(msgRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
      const prev = snap.data() as Record<string, unknown>;

      const updates: Record<string, unknown> = { updatedAt: nowTs };
      const actions: string[] = [];

      if (typeof data?.status === 'string') {
        if (!VALID_STATUSES.has(data.status)) {
          throw new HttpsError('invalid-argument', 'Status inválido.');
        }
        if (data.status === 'archived' && !access.permissions.includes('*') && !access.permissions.includes('inbox:archive') && !access.permissions.includes('inbox:admin')) {
          throw new HttpsError('permission-denied', 'Sem permissão para arquivar mensagens.');
        }
        updates.status = data.status;
        if (data.status === 'archived') updates.archivedAt = nowTs;
        const stPt: Record<string, string> = {
          new: 'Nova',
          read: 'Lida',
          in_review: 'Em análise',
          awaiting_reply: 'Aguardando resposta',
          in_discussion: 'Em discussão',
          approved: 'Aprovada',
          rejected: 'Rejeitada',
          converted_to_task: 'Convertida em tarefa',
          in_progress: 'Em andamento',
          resolved: 'Resolvida',
          archived: 'Arquivada',
        };
        actions.push(`Status alterado para ${stPt[data.status] || data.status}`);
      }

      if (typeof data?.priority === 'string' && VALID_PRIORITIES.has(data.priority)) {
        updates.priority = data.priority;
        const prPt: Record<string, string> = {
          informative: 'Informativa',
          attention: 'Atenção',
          important: 'Importante',
          critical: 'Crítica',
        };
        actions.push(`Prioridade alterada para ${prPt[data.priority] || data.priority}`);
      }

      if ('assignedToUserId' in (data || {})) {
        updates.assignedToUserId = typeof data.assignedToUserId === 'string' && data.assignedToUserId.trim() ? data.assignedToUserId.trim() : null;
        actions.push('responsável atribuído');
      }

      if ('requestedResponseFromUserId' in (data || {})) {
        updates.requestedResponseFromUserId =
          typeof data.requestedResponseFromUserId === 'string' && data.requestedResponseFromUserId.trim()
            ? data.requestedResponseFromUserId.trim()
            : null;
        actions.push('encaminhada / solicitada resposta');
      }

      if (typeof data?.dueAt === 'string' && Number.isFinite(Date.parse(data.dueAt))) {
        updates.dueAt = admin.firestore.Timestamp.fromDate(new Date(data.dueAt));
        actions.push('prazo definido');
      }

      if (typeof data?.starred === 'boolean') {
        updates[`starredBy.${access.uid}`] = data.starred;
      }
      if (typeof data?.important === 'boolean') {
        updates[`importantBy.${access.uid}`] = data.important;
      }
      if (data?.confirmReceipt === true) {
        updates[`confirmedBy.${access.uid}`] = nowTs;
        updates[`readBy.${access.uid}`] = nowTs;
        actions.push('recebimento confirmado');
      }

      tx.update(msgRef, updates);

      if (actions.length > 0) {
        const detailsText = sanitizeText(data?.details, 280);
        const justificationText = sanitizeText(data?.justification, 400);
        const historyDoc: Record<string, unknown> = {
          messageId,
          actorId: access.uid,
          actorName: actor.name,
          actorType: 'human',
          action: actions.join('; '),
          createdAt: nowTs,
        };
        if (typeof prev.status === 'string') historyDoc.fromStatus = prev.status;
        if (typeof updates.status === 'string') historyDoc.toStatus = updates.status;
        if (detailsText) historyDoc.details = detailsText;
        if (justificationText) historyDoc.justification = justificationText;

        tx.set(msgRef.collection('history').doc(), historyDoc);

        await writeAudit(
          {
            actorUid: access.uid,
            actorRole: access.roleId,
            actorPermissions: access.permissions,
            action: 'inbox_message_updated',
            module: 'inbox',
            entityType: 'admin_inbox_message',
            entityId: messageId,
            before: {
              status: prev.status ?? null,
              priority: prev.priority ?? null,
              assignedToUserId: prev.assignedToUserId ?? null,
            },
            after: updates,
            reason: sanitizeText(data?.justification, 300) || null,
            result: 'success',
            source: 'callable',
          },
          tx,
        );
      }
    });

    return { ok: true };
  });
});

export const inboxDecideMessage = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:approve', 'inbox:admin']);
  return audited(access, { action: 'inbox_decide_message', module: 'inbox', entityType: 'admin_inbox_message', entityId: String(data?.messageId || '') }, async () => {
    const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
    const outcome = data?.outcome === 'approved' || data?.outcome === 'rejected' || data?.outcome === 'disagreed' ? data.outcome : null;
    const justification = sanitizeText(data?.justification, 600);
    if (!messageId || !outcome) throw new HttpsError('invalid-argument', 'Decisão inválida.');
    if ((outcome === 'rejected' || outcome === 'disagreed') && justification.length < 3) {
      throw new HttpsError('invalid-argument', 'Informe uma justificativa (mín. 3 caracteres) para rejeitar ou discordar.');
    }

    const actor = await resolveActorProfile(access);
    const msgRef = db().collection('admin_inbox_messages').doc(messageId);
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const nextStatus = outcome === 'approved' ? 'approved' : outcome === 'rejected' ? 'rejected' : 'in_discussion';

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(msgRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
      const prev = snap.data() as { status?: string; suggestedTask?: Record<string, unknown> };

      const updates: Record<string, unknown> = {
        status: nextStatus,
        decision: {
          outcome,
          decidedBy: access.uid,
          decidedByName: actor.name,
          decidedAt: new Date().toISOString(),
          justification: justification || null,
        },
        updatedAt: nowTs,
        [`readBy.${access.uid}`]: nowTs,
      };

      if (prev.suggestedTask && outcome === 'rejected') {
        updates['suggestedTask.status'] = 'rejected';
        updates['suggestedTask.rejectionReason'] = justification;
      }

      tx.update(msgRef, updates);

      tx.set(msgRef.collection('history').doc(), {
        messageId,
        actorId: access.uid,
        actorName: actor.name,
        actorType: 'human',
        action: `decision_${outcome}`,
        fromStatus: prev.status ?? null,
        toStatus: nextStatus,
        ...(justification ? { justification } : {}),
        createdAt: nowTs,
      });

      await writeAudit(
        {
          actorUid: access.uid,
          actorRole: access.roleId,
          actorPermissions: access.permissions,
          action: `inbox_decision_${outcome}`,
          module: 'inbox',
          entityType: 'admin_inbox_message',
          entityId: messageId,
          reason: justification || null,
          after: { status: nextStatus, outcome },
          result: 'success',
          source: 'callable',
        },
        tx,
      );
    });

    return { ok: true, status: nextStatus };
  });
});

export const inboxConvertToTask = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:create', 'inbox:edit', 'inbox:admin']);
  const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
  const title = sanitizeText(data?.title, 160);
  if (!messageId || title.length < 2) {
    throw new HttpsError('invalid-argument', 'Mensagem e título da tarefa são obrigatórios.');
  }

  const actor = await resolveActorProfile(access);
  const msgRef = db().collection('admin_inbox_messages').doc(messageId);
  const taskRef = db().collection('admin_inbox_tasks').doc();
  const nowTs = admin.firestore.FieldValue.serverTimestamp();
  const priority = VALID_PRIORITIES.has(data?.priority) ? (data.priority as InboxPriority) : 'attention';
  const assignedToUserId = typeof data?.assignedToUserId === 'string' && data.assignedToUserId.trim() ? data.assignedToUserId.trim() : null;
  const dueAt =
    typeof data?.dueAt === 'string' && Number.isFinite(Date.parse(data.dueAt))
      ? admin.firestore.Timestamp.fromDate(new Date(data.dueAt))
      : null;

  const checklist = Array.isArray(data?.checklist)
    ? data.checklist.slice(0, 15).map((item: unknown, idx: number) => ({
        id: `chk_${idx}`,
        label: sanitizeText(typeof item === 'object' && item !== null ? (item as { label?: unknown }).label : item, 180),
        done: false,
      }))
    : [];

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(msgRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
    const msgData = snap.data() as {
      status?: string;
      agentId?: SystemAgentId;
      relatedEntities?: unknown[];
      suggestedTask?: Record<string, unknown>;
    };

    const taskDoc = {
      messageId,
      title,
      description: sanitizeText(data?.description, 2000),
      reason: sanitizeText(data?.reason, 400) || null,
      originAgentId: msgData.agentId || null,
      assignedToUserId,
      assignedToName: sanitizeText(data?.assignedToName, 80) || null,
      priority,
      status: 'open',
      dueAt,
      checklist,
      relatedEntities: Array.isArray(msgData.relatedEntities) ? msgData.relatedEntities : [],
      createdBy: access.uid,
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    tx.set(taskRef, taskDoc);
    tx.set(msgRef.collection('tasks').doc(taskRef.id), taskDoc);

    const msgUpdates: Record<string, unknown> = {
      status: 'converted_to_task',
      suggestedTaskId: taskRef.id,
      assignedToUserId: assignedToUserId || null,
      updatedAt: nowTs,
      [`readBy.${access.uid}`]: nowTs,
    };
    if (msgData.suggestedTask) {
      msgUpdates['suggestedTask.status'] = 'accepted';
      msgUpdates['suggestedTask.createdTaskId'] = taskRef.id;
    }

    tx.update(msgRef, msgUpdates);

    tx.set(msgRef.collection('history').doc(), {
      messageId,
      actorId: access.uid,
      actorName: actor.name,
      actorType: 'human',
      action: 'converted_to_task',
      fromStatus: msgData.status,
      toStatus: 'converted_to_task',
      details: `Tarefa criada: ${title}`,
      createdAt: nowTs,
    });

    await writeAudit(
      {
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        action: 'inbox_task_created',
        module: 'inbox',
        entityType: 'admin_inbox_task',
        entityId: taskRef.id,
        after: { messageId, title, assignedToUserId, priority },
        result: 'success',
        source: 'callable',
      },
      tx,
    );
  });

  return { taskId: taskRef.id };
});

export const inboxUpdateTask = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:edit', 'inbox:admin']);
  const taskId = typeof data?.taskId === 'string' ? data.taskId.trim() : '';
  const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
  if (!taskId || !messageId) throw new HttpsError('invalid-argument', 'taskId e messageId obrigatórios.');

  const actor = await resolveActorProfile(access);
  const taskRef = db().collection('admin_inbox_tasks').doc(taskId);
  const msgRef = db().collection('admin_inbox_messages').doc(messageId);
  const subTaskRef = msgRef.collection('tasks').doc(taskId);
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  await db().runTransaction(async (tx) => {
    const tSnap = await tx.get(taskRef);
    if (!tSnap.exists) throw new HttpsError('not-found', 'Tarefa não encontrada.');

    const updates: Record<string, unknown> = { updatedAt: nowTs };
    if (typeof data?.status === 'string' && ['open', 'in_progress', 'done', 'cancelled'].includes(data.status)) {
      updates.status = data.status;
    }
    if (Array.isArray(data?.checklist)) {
      updates.checklist = data.checklist.slice(0, 20).map((item: unknown, idx: number) => {
        const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
          id: typeof obj.id === 'string' ? obj.id : `chk_${idx}`,
          label: sanitizeText(obj.label, 180),
          done: obj.done === true,
        };
      });
    }

    tx.update(taskRef, updates);
    tx.set(subTaskRef, updates, { merge: true });

    if (updates.status === 'done') {
      tx.update(msgRef, { status: 'resolved', updatedAt: nowTs });
    } else if (updates.status === 'in_progress') {
      tx.update(msgRef, { status: 'in_progress', updatedAt: nowTs });
    }

    tx.set(msgRef.collection('history').doc(), {
      messageId,
      actorId: access.uid,
      actorName: actor.name,
      actorType: 'human',
      action: `task_updated_${String(updates.status || 'checklist')}`,
      details:
        updates.status === 'done'
          ? 'Tarefa concluída e mensagem resolvida automaticamente'
          : updates.status === 'in_progress'
          ? 'Tarefa colocada em andamento'
          : updates.status === 'open'
          ? 'Tarefa reaberta'
          : updates.status === 'cancelled'
          ? 'Tarefa cancelada'
          : 'Checklist da tarefa atualizado',
      createdAt: nowTs,
    });

    await writeAudit(
      {
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        action: 'inbox_task_updated',
        module: 'inbox',
        entityType: 'admin_inbox_task',
        entityId: taskId,
        after: updates,
        result: 'success',
        source: 'callable',
      },
      tx,
    );
  });

  return { ok: true };
});

export const inboxRegisterAttachment = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:create', 'inbox:edit', 'inbox:admin']);
  const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
  const attachmentId = typeof data?.attachmentId === 'string' ? data.attachmentId.trim() : '';
  const originalName = typeof data?.originalName === 'string' ? data.originalName.trim() : '';
  const internalName = typeof data?.internalName === 'string' ? data.internalName.trim() : '';
  const mimeType = typeof data?.mimeType === 'string' ? data.mimeType.trim().toLowerCase() : '';
  const size = Number(data?.size);
  const storagePath = typeof data?.storagePath === 'string' ? data.storagePath.trim() : '';

  if (!messageId || !attachmentId || !originalName || !internalName) {
    throw new HttpsError('invalid-argument', 'Dados do anexo incompletos.');
  }
  if (DANGEROUS_EXT.test(originalName) || !ALLOWED_MIMES.has(mimeType)) {
    throw new HttpsError('invalid-argument', 'Tipo de arquivo ou MIME não permitido na Inbox ADM.');
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    throw new HttpsError('invalid-argument', 'Tamanho de anexo inválido (máx. 15 MB).');
  }
  const expectedPrefix = `admin-inbox/${messageId}/${attachmentId}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new HttpsError('invalid-argument', 'Caminho privado no Storage inválido.');
  }

  const actor = await resolveActorProfile(access);
  const msgRef = db().collection('admin_inbox_messages').doc(messageId);
  const attRef = msgRef.collection('attachments').doc(attachmentId);
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  await db().runTransaction(async (tx) => {
    const msgSnap = await tx.get(msgRef);
    if (!msgSnap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');

    tx.set(attRef, {
      messageId,
      originalName: originalName.slice(0, 120),
      internalName: internalName.slice(0, 120),
      mimeType,
      size,
      storagePath,
      sha256: typeof data?.sha256 === 'string' ? data.sha256.slice(0, 128) : null,
      uploadedBy: access.uid,
      uploadedByName: actor.name,
      uploadedAt: nowTs,
      status: 'ready',
    });

    tx.update(msgRef, {
      attachmentIds: admin.firestore.FieldValue.arrayUnion(attachmentId),
      attachmentCount: admin.firestore.FieldValue.increment(1),
      updatedAt: nowTs,
    });

    tx.set(msgRef.collection('history').doc(), {
      messageId,
      actorId: access.uid,
      actorName: actor.name,
      actorType: 'human',
      action: 'attachment_added',
      details: originalName.slice(0, 100),
      createdAt: nowTs,
    });

    await writeAudit(
      {
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        action: 'inbox_attachment_uploaded',
        module: 'inbox',
        entityType: 'admin_inbox_attachment',
        entityId: attachmentId,
        after: { messageId, originalName, mimeType, size },
        result: 'success',
        source: 'callable',
      },
      tx,
    );
  });

  return { ok: true };
});

export const inboxGetAttachmentDownloadUrl = functions.https.onCall(async (data, context) => {
  const access = await requirePermission(context.auth, 'inbox:view');
  const messageId = typeof data?.messageId === 'string' ? data.messageId.trim() : '';
  const attachmentId = typeof data?.attachmentId === 'string' ? data.attachmentId.trim() : '';
  if (!messageId || !attachmentId) {
    throw new HttpsError('invalid-argument', 'messageId e attachmentId obrigatórios.');
  }

  const attSnap = await db()
    .collection('admin_inbox_messages')
    .doc(messageId)
    .collection('attachments')
    .doc(attachmentId)
    .get();
  if (!attSnap.exists) throw new HttpsError('not-found', 'Anexo não encontrado.');

  const att = attSnap.data() as { storagePath?: string; originalName?: string };
  if (!att.storagePath || !att.storagePath.startsWith(`admin-inbox/${messageId}/`)) {
    throw new HttpsError('failed-precondition', 'Caminho de anexo inválido.');
  }

  const file = admin.storage().bucket().file(att.storagePath);
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  await writeAuditSafe({
    actorUid: access.uid,
    actorRole: access.roleId,
    actorPermissions: access.permissions,
    action: 'inbox_attachment_downloaded',
    module: 'inbox',
    entityType: 'admin_inbox_attachment',
    entityId: attachmentId,
    after: { messageId, originalName: att.originalName },
    result: 'success',
    source: 'callable',
  });

  return { url: signedUrl, expiresInSeconds: 600 };
});

export const inboxRunAgents = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:admin', 'inbox:create']);
  const targetAgentId =
    typeof data?.agentId === 'string' && data.agentId in BACKEND_AGENTS
      ? (data.agentId as SystemAgentId)
      : null;

  const agentIds: SystemAgentId[] = targetAgentId
    ? [targetAgentId]
    : (Object.keys(BACKEND_AGENTS) as SystemAgentId[]);

  let createdCount = 0;
  let updatedCount = 0;
  let deduplicatedCount = 0;

  for (const agentId of agentIds) {
    const ruleSnap = await db().collection('admin_agent_rules').doc(agentId).get();
    const rule: BackendAgentRuleConfig = ruleSnap.exists
      ? ({ ...defaultBackendRule(agentId), ...(ruleSnap.data() as Partial<BackendAgentRuleConfig>) })
      : defaultBackendRule(agentId);

    if (!rule.active) continue;

    const proposals = await evaluateAgentInsights(db(), agentId, rule);
    const meta = BACKEND_AGENTS[agentId];

    for (const proposal of proposals) {
      const existingQuery = await db()
        .collection('admin_inbox_messages')
        .where('deduplicationKey', '==', proposal.deduplicationKey)
        .limit(1)
        .get();

      const existingDoc = existingQuery.empty ? null : existingQuery.docs[0];
      const dedupDecision = shouldDeduplicate(
        existingDoc ? (existingDoc.data() as { updatedAt?: unknown; createdAt?: unknown }) : null,
        rule.minIntervalMinutes,
        rule.mutedKeys || [],
        proposal.deduplicationKey,
      );

      if (dedupDecision.skip) {
        deduplicatedCount++;
        if (existingDoc && dedupDecision.updateExisting) {
          await existingDoc.ref.update({
            occurrenceCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        continue;
      }

      const nowTs = admin.firestore.FieldValue.serverTimestamp();

      if (existingDoc && dedupDecision.updateExisting) {
        await existingDoc.ref.update({
          body: proposal.body,
          priority: proposal.priority,
          relatedEntities: proposal.relatedEntities,
          insightDetails: proposal.insightDetails,
          occurrenceCount: admin.firestore.FieldValue.increment(1),
          updatedAt: nowTs,
        });
        await existingDoc.ref.collection('history').add({
          messageId: existingDoc.id,
          actorId: agentId,
          actorName: `${meta.name} — ${meta.roleTitle}`,
          actorType: 'system_agent',
          action: 'insight_updated',
          details: 'Nova ocorrência agrupada pela chave de deduplicação',
          createdAt: nowTs,
        });
        updatedCount++;
        continue;
      }

      const msgRef = db().collection('admin_inbox_messages').doc();
      const shouldAutoTask =
        rule.autoCreateTaskOnCritical === true &&
        proposal.priority === 'critical' &&
        Boolean(proposal.suggestedTask);

      let createdTaskId: string | null = null;
      if (shouldAutoTask && proposal.suggestedTask) {
        const taskRef = db().collection('admin_inbox_tasks').doc();
        createdTaskId = taskRef.id;
        const tDoc = {
          messageId: msgRef.id,
          title: proposal.suggestedTask.title,
          description: proposal.suggestedTask.description,
          reason: proposal.suggestedTask.reason,
          originAgentId: agentId,
          assignedToUserId: rule.suggestedAssigneeUid || null,
          priority: proposal.suggestedTask.priority,
          status: 'open',
          checklist: proposal.suggestedTask.checklist.map((lbl, idx) => ({
            id: `chk_${idx}`,
            label: lbl,
            done: false,
          })),
          relatedEntities: proposal.relatedEntities,
          createdBy: agentId,
          createdAt: nowTs,
          updatedAt: nowTs,
        };
        await taskRef.set(tDoc);
        await msgRef.collection('tasks').doc(taskRef.id).set(tDoc);
      }

      await msgRef.set({
        type: proposal.type,
        source: 'system_agent',
        senderId: agentId,
        senderName: meta.name,
        senderRole: meta.roleTitle,
        agentId,
        agentSector: meta.sector,
        toUserIds: rule.defaultRecipientIds || [],
        toAll: rule.toAll !== false,
        subject: proposal.subject,
        body: proposal.body,
        bodyFormat: 'plain_text',
        priority: proposal.priority,
        status: shouldAutoTask ? 'converted_to_task' : 'new',
        assignedToUserId: rule.suggestedAssigneeUid || null,
        createdAt: nowTs,
        updatedAt: nowTs,
        archivedAt: null,
        sourceEvent: proposal.sourceEvent,
        deduplicationKey: proposal.deduplicationKey,
        occurrenceCount: 1,
        requiresApproval: proposal.requiresApproval,
        relatedEntities: proposal.relatedEntities,
        attachmentIds: [],
        suggestedTaskId: createdTaskId,
        ...(proposal.suggestedTask
          ? {
              suggestedTask: {
                ...proposal.suggestedTask,
                status: shouldAutoTask ? 'accepted' : 'pending',
                ...(createdTaskId ? { createdTaskId } : {}),
              },
            }
          : {}),
        insightDetails: proposal.insightDetails,
        readBy: {},
        starredBy: {},
        importantBy: {},
        confirmedBy: {},
        commentCount: 0,
        attachmentCount: 0,
        reactionCounts: {},
        createdBy: agentId,
      });

      await msgRef.collection('history').add({
        messageId: msgRef.id,
        actorId: agentId,
        actorName: `${meta.name} — ${meta.roleTitle}`,
        actorType: 'system_agent',
        action: 'agent_generated',
        toStatus: shouldAutoTask ? 'converted_to_task' : 'new',
        details: `Regra ${proposal.insightDetails.ruleVersion} executada`,
        createdAt: nowTs,
      });

      createdCount++;
    }

    await db()
      .collection('admin_agent_rules')
      .doc(agentId)
      .set(
        {
          ...rule,
          lastExecutedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastExecutionSummary: `${proposals.length} insight(s) avaliado(s)`,
        },
        { merge: true },
      );
  }

  await writeAuditSafe({
    actorUid: access.uid,
    actorRole: access.roleId,
    actorPermissions: access.permissions,
    action: 'inbox_agents_executed',
    module: 'inbox',
    entityType: 'admin_system_agents',
    entityId: targetAgentId || 'all',
    after: { createdCount, updatedCount, deduplicatedCount },
    result: 'success',
    source: 'callable',
  });

  return { createdCount, updatedCount, deduplicatedCount };
});

export const inboxSaveAgentRule = functions.https.onCall(async (data, context) => {
  const access = await requirePermission(context.auth, 'inbox:admin');
  const agentId = typeof data?.agentId === 'string' && data.agentId in BACKEND_AGENTS ? (data.agentId as SystemAgentId) : null;
  if (!agentId) throw new HttpsError('invalid-argument', 'Agente inválido.');

  const reset = data?.reset === true;
  const payload: Record<string, unknown> = reset
    ? { ...defaultBackendRule(agentId), updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: access.uid }
    : {
        id: agentId,
        active: data?.active !== false,
        stockThreshold: Math.max(1, Math.min(Number(data?.stockThreshold ?? 5), 500)),
        analysisWindowHours: Math.max(1, Math.min(Number(data?.analysisWindowHours ?? 24), 720)),
        minIntervalMinutes: Math.max(5, Math.min(Number(data?.minIntervalMinutes ?? 120), 10080)),
        defaultPriority: VALID_PRIORITIES.has(data?.defaultPriority) ? data.defaultPriority : 'attention',
        toAll: data?.toAll !== false,
        defaultRecipientIds: Array.isArray(data?.defaultRecipientIds) ? data.defaultRecipientIds.slice(0, 10) : [],
        suggestedAssigneeUid: typeof data?.suggestedAssigneeUid === 'string' && data.suggestedAssigneeUid.trim() ? data.suggestedAssigneeUid.trim() : null,
        autoCreateTaskOnCritical: data?.autoCreateTaskOnCritical === true,
        isCriticalAgent: data?.isCriticalAgent === true,
        mutedKeys: Array.isArray(data?.mutedKeys) ? data.mutedKeys.slice(0, 50) : [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: access.uid,
      };

  const ruleRef = db().collection('admin_agent_rules').doc(agentId);
  await db().runTransaction(async (tx) => {
    const prev = await tx.get(ruleRef);
    tx.set(ruleRef, payload, { merge: true });
    await writeAudit(
      {
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        action: reset ? 'inbox_agent_rule_reset' : 'inbox_agent_rule_updated',
        module: 'inbox',
        entityType: 'admin_agent_rule',
        entityId: agentId,
        before: prev.exists ? prev.data() : null,
        after: payload,
        result: 'success',
        source: 'callable',
      },
      tx,
    );
  });

  return { ok: true };
});

export const inboxMuteSimilarAlerts = functions.https.onCall(async (data, context) => {
  const access = await requireAnyPermission(context.auth, ['inbox:admin', 'inbox:edit']);
  const agentId = typeof data?.agentId === 'string' && data.agentId in BACKEND_AGENTS ? (data.agentId as SystemAgentId) : null;
  const deduplicationKey = typeof data?.deduplicationKey === 'string' ? data.deduplicationKey.trim() : '';
  if (!agentId || !deduplicationKey) {
    throw new HttpsError('invalid-argument', 'agentId e deduplicationKey são obrigatórios.');
  }

  await db()
    .collection('admin_agent_rules')
    .doc(agentId)
    .set(
      {
        id: agentId,
        mutedKeys: admin.firestore.FieldValue.arrayUnion(deduplicationKey),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: access.uid,
      },
      { merge: true },
    );

  await writeAuditSafe({
    actorUid: access.uid,
    actorRole: access.roleId,
    actorPermissions: access.permissions,
    action: 'inbox_alert_muted',
    module: 'inbox',
    entityType: 'admin_agent_rule',
    entityId: agentId,
    after: { deduplicationKey },
    result: 'success',
    source: 'callable',
  });

  return { ok: true };
});

export const inboxTestAgentRule = functions.https.onCall(async (data, context) => {
  const access = await requirePermission(context.auth, 'inbox:admin');
  const agentId = typeof data?.agentId === 'string' && data.agentId in BACKEND_AGENTS ? (data.agentId as SystemAgentId) : null;
  if (!agentId) throw new HttpsError('invalid-argument', 'Agente inválido.');

  const ruleSnap = await db().collection('admin_agent_rules').doc(agentId).get();
  const rule: BackendAgentRuleConfig = ruleSnap.exists
    ? ({ ...defaultBackendRule(agentId), ...(ruleSnap.data() as Partial<BackendAgentRuleConfig>) })
    : defaultBackendRule(agentId);

  const proposals = await evaluateAgentInsights(db(), agentId, rule);
  await writeAuditSafe({
    actorUid: access.uid,
    actorRole: access.roleId,
    actorPermissions: access.permissions,
    action: 'inbox_agent_rule_tested',
    module: 'inbox',
    entityType: 'admin_agent_rule',
    entityId: agentId,
    after: { proposalsCount: proposals.length },
    result: 'success',
    source: 'callable',
  });

  return { dryRun: true, proposals };
});

