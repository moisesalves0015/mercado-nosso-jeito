import type {
  AdminInboxMessage,
  InboxAttachment,
  InboxComment,
  InboxEntityReference,
  InboxEntityType,
  InboxHistoryEntry,
  InboxMessageSource,
  InboxMessageType,
  InboxPriority,
  InboxReactionType,
  InboxStatus,
  InboxTask,
  SystemAgentId,
} from './types';
import { SYSTEM_AGENTS_BY_ID } from './agents';

export const MAX_SUBJECT_LENGTH = 160;
export const MAX_BODY_LENGTH = 8000;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB

export const ALLOWED_ATTACHMENT_MIME_TYPES: ReadonlySet<string> = new Set([
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

const ALLOWED_EXTENSIONS_BY_MIME: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'application/csv': ['csv'],
  'application/vnd.ms-excel': ['xls', 'csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
};

const DANGEROUS_EXT = /\.(exe|bat|cmd|sh|ps1|vbs|js|mjs|cjs|jar|msi|dll|scr|com|php|py|rb|html|htm|svg)$/i;

const VALID_TYPES: ReadonlySet<InboxMessageType> = new Set([
  'message',
  'note',
  'alert',
  'insight',
  'task_suggestion',
  'decision',
  'incident',
  'announcement',
]);

const VALID_SOURCES: ReadonlySet<InboxMessageSource> = new Set([
  'human',
  'system_agent',
  'system',
]);

const VALID_PRIORITIES: ReadonlySet<InboxPriority> = new Set([
  'informative',
  'attention',
  'important',
  'critical',
]);

const VALID_STATUSES: ReadonlySet<InboxStatus> = new Set([
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

const VALID_ENTITY_TYPES: ReadonlySet<InboxEntityType> = new Set([
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

export const ENTITY_TYPE_LABELS: Record<InboxEntityType, string> = {
  product: 'Produto',
  order: 'Pedido',
  customer: 'Cliente',
  purchase_list: 'Lista de Compra',
  supplier: 'Fornecedor',
  quote: 'Cotação',
  report: 'Relatório',
  task: 'Tarefa',
  ticket: 'Chamado',
  campaign: 'Campanha',
};

export const ENTITY_REQUIRED_PERMISSION: Record<InboxEntityType, string> = {
  product: 'produtos:view',
  order: 'pedidos:view',
  customer: 'clientes:view',
  purchase_list: 'estoque:view',
  supplier: 'estoque:view',
  quote: 'estoque:view',
  report: 'relatorios:view',
  task: 'inbox:view',
  ticket: 'suporte:view',
  campaign: 'marketing:view',
};

/**
 * Redacts accidental PII (CPF, card numbers) and secret tokens from text content,
 * and strips dangerous HTML/script/javascript: constructs.
 */
export function sanitizeInboxText(raw: unknown, maxLen = MAX_BODY_LENGTH): string {
  if (typeof raw !== 'string') return '';
  let text = raw
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Strip dangerous URI schemes
    .replace(/\b(?:javascript|vbscript|data:text\/html):[^\s]*/gi, '[link removido]')
    // Redact CPF patterns (000.000.000-00 or 11 digits prefixed by CPF)
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF protegido]')
    // Redact long token-like secrets (Bearer ..., AIza..., sk_...)
    .replace(/\b(?:Bearer\s+[A-Za-z0-9._-]+|AIza[0-9A-Za-z_-]{20,}|sk_[A-Za-z0-9_]{16,})\b/g, '[credencial protegida]')
    .trim();

  if (text.length > maxLen) {
    text = `${text.slice(0, maxLen - 1)}…`;
  }
  return text;
}

export function sanitizeSafeFileName(raw: string): string {
  const base = raw
    .replace(/[/\\]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '');
  return (base || 'anexo').slice(0, 120);
}

export function validateInboxAttachment(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): { valid: true; safeName: string } | { valid: false; reason: string } {
  const fileName = String(input.fileName || '').trim();
  const mime = String(input.mimeType || '').trim().toLowerCase();
  const size = Number(input.size);

  if (!fileName) {
    return { valid: false, reason: 'Nome de arquivo ausente.' };
  }
  if (DANGEROUS_EXT.test(fileName)) {
    return { valid: false, reason: 'Tipo de arquivo potencialmente perigoso não permitido.' };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { valid: false, reason: 'Arquivo vazio ou tamanho inválido.' };
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    return { valid: false, reason: 'O arquivo excede o limite máximo de 15 MB.' };
  }
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mime)) {
    return { valid: false, reason: `Tipo MIME não permitido (${mime || 'desconhecido'}).` };
  }

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
  const expectedExts = ALLOWED_EXTENSIONS_BY_MIME[mime] ?? [];
  if (!ext || !expectedExts.includes(ext)) {
    return { valid: false, reason: 'A extensão do arquivo não corresponde ao tipo MIME informado.' };
  }

  return { valid: true, safeName: sanitizeSafeFileName(fileName) };
}

export function toIsoString(value: unknown, fallback = ''): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object' && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return fallback;
}

export function resolveEntityRoute(type: InboxEntityType, id: string): string {
  const safeId = encodeURIComponent(id);
  switch (type) {
    case 'product':
      return `/admin/products/${safeId}/view`;
    case 'order':
      return `/admin/orders/${safeId}`;
    case 'customer':
      return `/admin/customers/${safeId}`;
    case 'purchase_list':
      return '/admin/purchasing';
    case 'supplier':
      return '/admin/purchasing';
    case 'quote':
      return '/admin/purchasing';
    case 'report':
      return '/admin/reports';
    case 'ticket':
      return `/admin/support/${safeId}`;
    case 'campaign':
      return '/admin/marketing/campaigns';
    case 'task':
    default:
      return '/admin/inbox';
  }
}

export function normalizeEntityReference(raw: unknown): InboxEntityReference | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = String(r.type || '') as InboxEntityType;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const label = sanitizeInboxText(r.label, 120);
  if (!VALID_ENTITY_TYPES.has(type) || !id || !label) return null;

  const snapshotRaw = r.snapshot && typeof r.snapshot === 'object'
    ? (r.snapshot as Record<string, unknown>)
    : undefined;

  return {
    type,
    id,
    label,
    route: resolveEntityRoute(type, id),
    snapshot: snapshotRaw
      ? {
          name: typeof snapshotRaw.name === 'string' ? sanitizeInboxText(snapshotRaw.name, 80) : undefined,
          number: typeof snapshotRaw.number === 'string' ? sanitizeInboxText(snapshotRaw.number, 40) : undefined,
          status: typeof snapshotRaw.status === 'string' ? sanitizeInboxText(snapshotRaw.status, 40) : undefined,
        }
      : undefined,
  };
}

export function normalizeInboxMessage(id: string, raw: unknown): AdminInboxMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;

  const subject = sanitizeInboxText(d.subject, MAX_SUBJECT_LENGTH);
  const body = sanitizeInboxText(d.body, MAX_BODY_LENGTH);
  if (!subject && !body) return null;

  const type = VALID_TYPES.has(d.type as InboxMessageType)
    ? (d.type as InboxMessageType)
    : 'message';
  const source = VALID_SOURCES.has(d.source as InboxMessageSource)
    ? (d.source as InboxMessageSource)
    : 'human';
  const priority = VALID_PRIORITIES.has(d.priority as InboxPriority)
    ? (d.priority as InboxPriority)
    : 'informative';
  const status = VALID_STATUSES.has(d.status as InboxStatus)
    ? (d.status as InboxStatus)
    : 'new';

  const agentId =
    typeof d.agentId === 'string' && d.agentId in SYSTEM_AGENTS_BY_ID
      ? (d.agentId as SystemAgentId)
      : undefined;

  const readBy: Record<string, string> = {};
  if (d.readBy && typeof d.readBy === 'object') {
    for (const [uid, ts] of Object.entries(d.readBy as Record<string, unknown>)) {
      const iso = toIsoString(ts);
      if (iso) readBy[uid] = iso;
    }
  }

  const confirmedBy: Record<string, string> = {};
  if (d.confirmedBy && typeof d.confirmedBy === 'object') {
    for (const [uid, ts] of Object.entries(d.confirmedBy as Record<string, unknown>)) {
      const iso = toIsoString(ts);
      if (iso) confirmedBy[uid] = iso;
    }
  }

  const relatedEntities = Array.isArray(d.relatedEntities)
    ? d.relatedEntities.map(normalizeEntityReference).filter((x): x is InboxEntityReference => x !== null)
    : [];

  const reactionCounts: Record<string, number> = {};
  if (d.reactionCounts && typeof d.reactionCounts === 'object') {
    for (const [k, v] of Object.entries(d.reactionCounts as Record<string, unknown>)) {
      if (typeof v === 'number' && v >= 0) reactionCounts[k] = Math.floor(v);
    }
  }

  const createdAt = toIsoString(d.createdAt, new Date(0).toISOString());
  const updatedAt = toIsoString(d.updatedAt, createdAt);

  return {
    id,
    threadId: typeof d.threadId === 'string' ? d.threadId : undefined,
    type,
    source,
    senderId: typeof d.senderId === 'string' ? d.senderId : 'system',
    senderName: sanitizeInboxText(d.senderName, 80) || 'Sistema',
    senderRole: typeof d.senderRole === 'string' ? sanitizeInboxText(d.senderRole, 60) : undefined,
    agentId,
    agentSector: typeof d.agentSector === 'string' ? sanitizeInboxText(d.agentSector, 80) : undefined,
    toUserIds: Array.isArray(d.toUserIds) ? d.toUserIds.filter((x): x is string => typeof x === 'string') : [],
    toAll: d.toAll === true,
    ccUserIds: Array.isArray(d.ccUserIds) ? d.ccUserIds.filter((x): x is string => typeof x === 'string') : undefined,
    subject: subject || '(Sem assunto)',
    body,
    bodyFormat: d.bodyFormat === 'safe_markdown' ? 'safe_markdown' : 'plain_text',
    priority,
    status,
    assignedToUserId: typeof d.assignedToUserId === 'string' && d.assignedToUserId ? d.assignedToUserId : undefined,
    requestedResponseFromUserId:
      typeof d.requestedResponseFromUserId === 'string' && d.requestedResponseFromUserId
        ? d.requestedResponseFromUserId
        : undefined,
    dueAt: d.dueAt ? toIsoString(d.dueAt, '') || null : null,
    createdAt,
    updatedAt,
    archivedAt: d.archivedAt ? toIsoString(d.archivedAt, '') || null : null,
    sourceEvent: typeof d.sourceEvent === 'string' ? d.sourceEvent : undefined,
    sourceEntityId: typeof d.sourceEntityId === 'string' ? d.sourceEntityId : undefined,
    deduplicationKey: typeof d.deduplicationKey === 'string' ? d.deduplicationKey : undefined,
    occurrenceCount: typeof d.occurrenceCount === 'number' && d.occurrenceCount > 0 ? d.occurrenceCount : 1,
    requiresApproval: d.requiresApproval === true,
    relatedEntities,
    attachmentIds: Array.isArray(d.attachmentIds)
      ? d.attachmentIds.filter((x): x is string => typeof x === 'string')
      : [],
    suggestedTaskId: typeof d.suggestedTaskId === 'string' && d.suggestedTaskId ? d.suggestedTaskId : undefined,
    suggestedTask: d.suggestedTask && typeof d.suggestedTask === 'object'
      ? (d.suggestedTask as AdminInboxMessage['suggestedTask'])
      : undefined,
    insightDetails: d.insightDetails && typeof d.insightDetails === 'object'
      ? (d.insightDetails as AdminInboxMessage['insightDetails'])
      : undefined,
    decision: d.decision && typeof d.decision === 'object'
      ? (d.decision as AdminInboxMessage['decision'])
      : undefined,
    readBy,
    starredBy: (d.starredBy && typeof d.starredBy === 'object' ? d.starredBy : {}) as Record<string, boolean>,
    importantBy: (d.importantBy && typeof d.importantBy === 'object' ? d.importantBy : {}) as Record<string, boolean>,
    confirmedBy,
    commentCount: typeof d.commentCount === 'number' && d.commentCount >= 0 ? d.commentCount : 0,
    attachmentCount: typeof d.attachmentCount === 'number' && d.attachmentCount >= 0 ? d.attachmentCount : 0,
    reactionCounts,
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : 'system',
  };
}

export function normalizeInboxComment(id: string, raw: unknown): InboxComment | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const body = sanitizeInboxText(d.body, MAX_COMMENT_LENGTH);
  if (!body) return null;
  return {
    id,
    messageId: typeof d.messageId === 'string' ? d.messageId : '',
    authorId: typeof d.authorId === 'string' ? d.authorId : '',
    authorName: sanitizeInboxText(d.authorName, 80) || 'Administrador',
    authorRole: typeof d.authorRole === 'string' ? d.authorRole : undefined,
    body,
    createdAt: toIsoString(d.createdAt, new Date(0).toISOString()),
    kind: typeof d.kind === 'string' ? (d.kind as InboxComment['kind']) : 'comment',
  };
}

export function normalizeInboxHistory(id: string, raw: unknown): InboxHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  return {
    id,
    messageId: typeof d.messageId === 'string' ? d.messageId : '',
    actorId: typeof d.actorId === 'string' ? d.actorId : 'system',
    actorName: sanitizeInboxText(d.actorName, 80) || 'Sistema',
    actorType: d.actorType === 'human' || d.actorType === 'system_agent' ? d.actorType : 'system',
    action: sanitizeInboxText(d.action, 80) || 'updated',
    fromStatus: VALID_STATUSES.has(d.fromStatus as InboxStatus) ? (d.fromStatus as InboxStatus) : undefined,
    toStatus: VALID_STATUSES.has(d.toStatus as InboxStatus) ? (d.toStatus as InboxStatus) : undefined,
    details: typeof d.details === 'string' ? sanitizeInboxText(d.details, 300) : undefined,
    justification: typeof d.justification === 'string' ? sanitizeInboxText(d.justification, 500) : undefined,
    createdAt: toIsoString(d.createdAt, new Date(0).toISOString()),
  };
}

export function normalizeInboxAttachment(id: string, raw: unknown): InboxAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  return {
    id,
    messageId: typeof d.messageId === 'string' ? d.messageId : '',
    originalName: sanitizeSafeFileName(String(d.originalName || 'anexo')),
    internalName: sanitizeSafeFileName(String(d.internalName || 'anexo')),
    mimeType: String(d.mimeType || 'application/octet-stream'),
    size: typeof d.size === 'number' ? d.size : 0,
    storagePath: typeof d.storagePath === 'string' ? d.storagePath : '',
    sha256: typeof d.sha256 === 'string' ? d.sha256 : undefined,
    uploadedBy: typeof d.uploadedBy === 'string' ? d.uploadedBy : '',
    uploadedByName: typeof d.uploadedByName === 'string' ? d.uploadedByName : undefined,
    uploadedAt: toIsoString(d.uploadedAt, new Date(0).toISOString()),
    status: d.status === 'ready' || d.status === 'rejected' ? d.status : 'uploading',
    validationNote: typeof d.validationNote === 'string' ? d.validationNote : undefined,
  };
}

export function normalizeInboxTask(id: string, raw: unknown): InboxTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const title = sanitizeInboxText(d.title, 160);
  if (!title) return null;
  return {
    id,
    messageId: typeof d.messageId === 'string' ? d.messageId : '',
    title,
    description: sanitizeInboxText(d.description, 2000),
    reason: typeof d.reason === 'string' ? sanitizeInboxText(d.reason, 400) : undefined,
    originAgentId:
      typeof d.originAgentId === 'string' && d.originAgentId in SYSTEM_AGENTS_BY_ID
        ? (d.originAgentId as SystemAgentId)
        : undefined,
    assignedToUserId: typeof d.assignedToUserId === 'string' ? d.assignedToUserId : undefined,
    assignedToName: typeof d.assignedToName === 'string' ? d.assignedToName : undefined,
    priority: VALID_PRIORITIES.has(d.priority as InboxPriority) ? (d.priority as InboxPriority) : 'attention',
    status:
      d.status === 'in_progress' || d.status === 'done' || d.status === 'cancelled'
        ? d.status
        : 'open',
    dueAt: d.dueAt ? toIsoString(d.dueAt, '') || null : null,
    checklist: Array.isArray(d.checklist)
      ? d.checklist.map((item, idx) => {
          const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            id: typeof obj.id === 'string' ? obj.id : `chk_${idx}`,
            label: sanitizeInboxText(obj.label ?? item, 180),
            done: obj.done === true,
          };
        })
      : [],
    relatedEntities: Array.isArray(d.relatedEntities)
      ? d.relatedEntities.map(normalizeEntityReference).filter((x): x is InboxEntityReference => x !== null)
      : [],
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : '',
    createdAt: toIsoString(d.createdAt, new Date(0).toISOString()),
    updatedAt: toIsoString(d.updatedAt, new Date(0).toISOString()),
  };
}

/**
 * Toda mensagem da Inbox ADM é visível para qualquer administrador autorizado (os 3 sócios),
 * mesmo quando direcionada a um destinatário específico.
 */
export function isMessageVisibleToPartner(
  _msg: AdminInboxMessage,
  userPermissions: readonly string[],
): boolean {
  return userPermissions.includes('*') || userPermissions.includes('inbox:view') || userPermissions.includes('inbox:admin');
}

export function isUnreadByUser(msg: AdminInboxMessage, uid: string): boolean {
  if (!uid) return false;
  return !msg.readBy[uid] && msg.status !== 'archived';
}

export function computeReactionCounts(
  current: Record<string, number>,
  type: InboxReactionType,
  added: boolean,
): Record<string, number> {
  const next = { ...current };
  const prevVal = next[type] ?? 0;
  next[type] = added ? prevVal + 1 : Math.max(0, prevVal - 1);
  return next;
}

export function canTransitionInboxStatus(
  from: InboxStatus,
  to: InboxStatus,
): boolean {
  if (from === to) return true;
  if (from === 'archived' && to !== 'read' && to !== 'in_review') return false;
  return VALID_STATUSES.has(to);
}

