import {
  collection,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { db, functions, storage } from '../firebase';
import {
  normalizeInboxAttachment,
  normalizeInboxComment,
  normalizeInboxHistory,
  normalizeInboxMessage,
  normalizeInboxTask,
  validateInboxAttachment,
} from '../admin/inbox/normalizers';
import type {
  AdminInboxMessage,
  AgentRuleConfig,
  InboxAttachment,
  InboxComment,
  InboxEntityReference,
  InboxHistoryEntry,
  InboxMessageType,
  InboxPriority,
  InboxReaction,
  InboxReactionType,
  InboxStatus,
  InboxTask,
  PartnerAdminMember,
  SystemAgentId,
} from '../admin/inbox/types';

// ── Callable helper ──────────────────────────────────────────────────────────

async function callInbox<TReq, TRes>(name: string, payload: TReq): Promise<TRes> {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  const res = await fn(payload);
  return res.data;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeInboxMessages(
  limitCount: number,
  onData: (messages: AdminInboxMessage[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'admin_inbox_messages'),
    orderBy('createdAt', 'desc'),
    fsLimit(Math.max(10, Math.min(limitCount, 300))),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => normalizeInboxMessage(d.id, d.data() as Record<string, unknown>))
        .filter((x): x is AdminInboxMessage => x !== null);
      onData(items);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export function subscribeMessageComments(
  messageId: string,
  onData: (comments: InboxComment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'admin_inbox_messages', messageId, 'comments'),
    orderBy('createdAt', 'asc'),
    fsLimit(200),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => normalizeInboxComment(d.id, d.data() as Record<string, unknown>))
          .filter((x): x is InboxComment => x !== null),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeMessageReactions(
  messageId: string,
  onData: (reactions: InboxReaction[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'admin_inbox_messages', messageId, 'reactions'),
    fsLimit(100),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            messageId,
            userId: String(data.userId ?? ''),
            userName: String(data.userName ?? 'Sócio'),
            type: (data.type as InboxReactionType) || 'like',
            justification: typeof data.justification === 'string' ? data.justification : undefined,
            createdAt:
              typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
          };
        }),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeMessageHistory(
  messageId: string,
  onData: (entries: InboxHistoryEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'admin_inbox_messages', messageId, 'history'),
    orderBy('createdAt', 'desc'),
    fsLimit(150),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => normalizeInboxHistory(d.id, d.data() as Record<string, unknown>))
          .filter((x): x is InboxHistoryEntry => x !== null),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeMessageAttachments(
  messageId: string,
  onData: (attachments: InboxAttachment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'admin_inbox_messages', messageId, 'attachments'),
    orderBy('uploadedAt', 'desc'),
    fsLimit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => normalizeInboxAttachment(d.id, d.data() as Record<string, unknown>))
          .filter((x): x is InboxAttachment => x !== null),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeMessageTasks(
  messageId: string,
  onData: (tasks: InboxTask[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'admin_inbox_messages', messageId, 'tasks'),
    orderBy('createdAt', 'desc'),
    fsLimit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => normalizeInboxTask(d.id, d.data() as Record<string, unknown>))
          .filter((x): x is InboxTask => x !== null),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeAgentRules(
  onData: (rules: Record<string, AgentRuleConfig>) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'admin_agent_rules'), fsLimit(50));
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, AgentRuleConfig> = {};
      for (const d of snap.docs) {
        map[d.id] = { ...(d.data() as AgentRuleConfig), id: d.id as SystemAgentId };
      }
      onData(map);
    },
    (err) => onError?.(err),
  );
}

// ── Callables ────────────────────────────────────────────────────────────────

export async function listInboxPartners(): Promise<PartnerAdminMember[]> {
  const res = await callInbox<Record<string, never>, { partners: PartnerAdminMember[] }>(
    'inboxListPartners',
    {},
  );
  return res.partners ?? [];
}

export interface CreateInboxMessageInput {
  type: InboxMessageType;
  toAll: boolean;
  toUserIds: string[];
  subject: string;
  body: string;
  priority: InboxPriority;
  assignedToUserId?: string;
  requestedResponseFromUserId?: string;
  requestReply?: boolean;
  dueAt?: string | null;
  relatedEntities?: InboxEntityReference[];
  createTaskAlong?: boolean;
  taskTitle?: string;
  clientRequestId?: string;
}

export function createInboxMessage(
  input: CreateInboxMessageInput,
): Promise<{ messageId: string; deduplicated?: boolean }> {
  return callInbox<CreateInboxMessageInput, { messageId: string; deduplicated?: boolean }>(
    'inboxCreateMessage',
    input,
  );
}

export function addInboxComment(
  messageId: string,
  body: string,
  kind: 'comment' | 'forward' | 'request_info' | 'decision_note' = 'comment',
): Promise<{ ok: boolean }> {
  return callInbox('inboxAddComment', { messageId, body, kind });
}

export function toggleInboxReaction(
  messageId: string,
  type: InboxReactionType,
  justification?: string,
): Promise<{ ok: boolean; added: boolean }> {
  return callInbox('inboxToggleReaction', { messageId, type, justification });
}

export function markInboxMessageRead(messageId: string, unread = false): Promise<{ ok: boolean }> {
  return callInbox('inboxMarkRead', { messageId, unread });
}

export interface UpdateInboxStatusInput {
  messageId: string;
  status?: InboxStatus;
  priority?: InboxPriority;
  assignedToUserId?: string | null;
  requestedResponseFromUserId?: string | null;
  dueAt?: string | null;
  starred?: boolean;
  pinned?: boolean;
  important?: boolean;
  deleted?: boolean;
  confirmReceipt?: boolean;
  details?: string;
  justification?: string;
}

export function updateInboxMessageStatus(input: UpdateInboxStatusInput): Promise<{ ok: boolean }> {
  return callInbox('inboxUpdateStatus', input);
}

export function decideInboxMessage(
  messageId: string,
  outcome: 'approved' | 'rejected' | 'disagreed',
  justification?: string,
): Promise<{ ok: boolean; status: InboxStatus }> {
  return callInbox('inboxDecideMessage', { messageId, outcome, justification });
}

export interface ConvertToTaskInput {
  messageId: string;
  title: string;
  description: string;
  reason?: string;
  priority: InboxPriority;
  assignedToUserId?: string;
  assignedToName?: string;
  dueAt?: string | null;
  checklist?: Array<{ label: string; done?: boolean }>;
}

export function convertInboxMessageToTask(
  input: ConvertToTaskInput,
): Promise<{ taskId: string }> {
  return callInbox('inboxConvertToTask', input);
}

export function updateInboxTask(input: {
  taskId: string;
  messageId: string;
  status?: 'open' | 'in_progress' | 'done' | 'cancelled';
  checklist?: Array<{ id: string; label: string; done: boolean }>;
}): Promise<{ ok: boolean }> {
  return callInbox('inboxUpdateTask', input);
}

export function getInboxAttachmentDownloadUrl(
  messageId: string,
  attachmentId: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  return callInbox('inboxGetAttachmentDownloadUrl', { messageId, attachmentId });
}

export function runInboxAgents(
  agentId?: SystemAgentId,
): Promise<{ createdCount: number; updatedCount: number; deduplicatedCount: number }> {
  return callInbox('inboxRunAgents', agentId ? { agentId } : {});
}

export function saveInboxAgentRule(
  rule: Partial<AgentRuleConfig> & { agentId: SystemAgentId; reset?: boolean },
): Promise<{ ok: boolean }> {
  return callInbox('inboxSaveAgentRule', rule);
}

export function muteSimilarInboxAlerts(
  agentId: SystemAgentId,
  deduplicationKey: string,
): Promise<{ ok: boolean }> {
  return callInbox('inboxMuteSimilarAlerts', { agentId, deduplicationKey });
}

export function testInboxAgentRule(agentId: SystemAgentId): Promise<{
  dryRun: boolean;
  proposals: Array<{
    agentId: SystemAgentId;
    subject: string;
    priority: InboxPriority;
    deduplicationKey: string;
    observedFact: string;
  }>;
}> {
  return callInbox('inboxTestAgentRule', { agentId });
}

// ── Attachment upload (private Storage + callable registration) ──────────────

async function computeSha256Hex(blob: Blob): Promise<string | undefined> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return undefined;
  }
}

async function compressImageIfNeeded(file: File): Promise<{ blob: Blob; mimeType: string }> {
  if (!file.type.startsWith('image/') || file.size <= 1.5 * 1024 * 1024) {
    return { blob: file, mimeType: file.type };
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      image.src = url;
    });
    const maxDim = 1800;
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, mimeType: file.type };
    ctx.drawImage(img, 0, 0, width, height);
    const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, targetMime, 0.84),
    );
    if (compressed && compressed.size < file.size) {
      return { blob: compressed, mimeType: targetMime };
    }
    return { blob: file, mimeType: file.type };
  } catch {
    return { blob: file, mimeType: file.type };
  }
}

export interface AttachmentUploadHandle {
  promise: Promise<void>;
  cancel: () => void;
}

export function uploadInboxAttachment(
  messageId: string,
  file: File,
  onProgress?: (percent: number) => void,
): AttachmentUploadHandle {
  const validation = validateInboxAttachment({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  });
  if (!validation.valid) {
    return {
      promise: Promise.reject(new Error(validation.reason || 'Arquivo inválido.')),
      cancel: () => { },
    };
  }

  let activeTask: UploadTask | null = null;
  let cancelled = false;

  const promise = (async () => {
    const attachmentId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { blob, mimeType } = await compressImageIfNeeded(file);
    if (cancelled) throw new Error('Upload cancelado.');

    const sha256 = await computeSha256Hex(blob);
    if (cancelled) throw new Error('Upload cancelado.');

    const storagePath = `admin-inbox/${messageId}/${attachmentId}/${validation.safeName}`;
    const storageRef = ref(storage, storagePath);

    activeTask = uploadBytesResumable(storageRef, blob, {
      contentType: mimeType || file.type,
      customMetadata: {
        originalName: file.name.slice(0, 120),
        messageId,
      },
    });

    await new Promise<void>((resolve, reject) => {
      activeTask!.on(
        'state_changed',
        (snap) => {
          const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          onProgress?.(pct);
        },
        (err) => reject(err),
        () => resolve(),
      );
    });

    await callInbox('inboxRegisterAttachment', {
      messageId,
      attachmentId,
      originalName: file.name,
      internalName: validation.safeName,
      mimeType: mimeType || file.type,
      size: blob.size,
      storagePath,
      sha256,
    });
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      activeTask?.cancel();
    },
  };
}

