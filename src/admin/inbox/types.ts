/**
 * Modelos de domínio da Inbox ADM — compartilhados entre UI, serviços e testes.
 */

export type QuickFilter =
  | 'all'
  | 'human'
  | 'system_agent'
  | 'unread'
  | 'critical'
  | 'important'
  | 'to_me'
  | 'to_all'
  | 'awaiting_my_reply'
  | 'awaiting_decision'
  | 'alert'
  | 'insight'
  | 'task_suggestion'
  | 'approved'
  | 'rejected'
  | 'resolved'
  | 'archived';

export type SystemAgentId =
  | 'ana_estoque'
  | 'bia_vendas'
  | 'clara_entregas'
  | 'pedro_pedidos'
  | 'fabio_financeiro'
  | 'marina_produtos'
  | 'lucas_crm'
  | 'sofia_marketing'
  | 'rafael_compras'
  | 'julia_qualidade'
  | 'eduardo_sistema';

export type InboxMessageType =
  | 'message'
  | 'note'
  | 'alert'
  | 'insight'
  | 'task_suggestion'
  | 'decision'
  | 'incident'
  | 'announcement';

export type InboxMessageSource = 'human' | 'system_agent' | 'system';

export type InboxPriority = 'informative' | 'attention' | 'important' | 'critical';

export type InboxStatus =
  | 'new'
  | 'read'
  | 'in_review'
  | 'awaiting_reply'
  | 'in_discussion'
  | 'approved'
  | 'rejected'
  | 'converted_to_task'
  | 'in_progress'
  | 'resolved'
  | 'archived';

export type InboxEntityType =
  | 'product'
  | 'order'
  | 'customer'
  | 'purchase_list'
  | 'supplier'
  | 'quote'
  | 'report'
  | 'task'
  | 'ticket'
  | 'campaign';

export interface InboxEntityReference {
  type: InboxEntityType;
  id: string;
  label: string;
  route?: string;
  snapshot?: {
    name?: string;
    number?: string;
    status?: string;
  };
}

export interface InboxInsightDetails {
  observedFact: string;
  dataUsed: string;
  interpretation: string;
  suggestion: string;
  confidence?: 'high' | 'medium' | 'low';
  requiresHumanApproval: boolean;
  analyzedPeriod?: string;
  metricsSummary?: Record<string, string | number>;
  ruleVersion?: string;
}

export interface InboxSuggestedTask {
  title: string;
  description: string;
  reason: string;
  suggestedAssigneeUid?: string;
  suggestedAssigneeLabel?: string;
  priority: InboxPriority;
  dueDays?: number;
  checklist: string[];
  estimatedImpact?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'ignored';
  rejectionReason?: string;
  createdTaskId?: string;
}

export interface AdminInboxMessage {
  id: string;
  threadId?: string;
  type: InboxMessageType;
  source: InboxMessageSource;
  senderId: string;
  senderName: string;
  senderRole?: string;
  agentId?: SystemAgentId;
  agentSector?: string;
  toUserIds: string[];
  toAll: boolean;
  ccUserIds?: string[];
  subject: string;
  body: string;
  bodyFormat: 'plain_text' | 'safe_markdown';
  priority: InboxPriority;
  status: InboxStatus;
  assignedToUserId?: string;
  requestedResponseFromUserId?: string;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  sourceEvent?: string;
  sourceEntityId?: string;
  deduplicationKey?: string;
  occurrenceCount: number;
  requiresApproval?: boolean;
  relatedEntities: InboxEntityReference[];
  attachmentIds: string[];
  suggestedTaskId?: string;
  suggestedTask?: InboxSuggestedTask;
  insightDetails?: InboxInsightDetails;
  decision?: {
    outcome: 'approved' | 'rejected' | 'disagreed';
    decidedBy: string;
    decidedByName?: string;
    decidedAt: string;
    justification?: string;
  };
  readBy: Record<string, string>;
  starredBy: Record<string, boolean>;
  importantBy: Record<string, boolean>;
  confirmedBy: Record<string, string>;
  commentCount: number;
  attachmentCount: number;
  reactionCounts: Record<string, number>;
  createdBy: string;
}

export interface InboxComment {
  id: string;
  messageId: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  body: string;
  createdAt: string;
  kind?: 'comment' | 'forward' | 'request_info' | 'decision_note';
}

export type InboxReactionType = 'like' | 'agree' | 'disagree' | 'attention' | 'check';

export interface InboxReaction {
  id: string; // `${userId}_${type}`
  messageId: string;
  userId: string;
  userName: string;
  type: InboxReactionType;
  justification?: string;
  createdAt: string;
}

export interface InboxHistoryEntry {
  id: string;
  messageId: string;
  actorId: string;
  actorName: string;
  actorType: 'human' | 'system_agent' | 'system';
  action: string;
  fromStatus?: InboxStatus;
  toStatus?: InboxStatus;
  details?: string;
  justification?: string;
  createdAt: string;
}

export interface InboxAttachment {
  id: string;
  messageId: string;
  originalName: string;
  internalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  sha256?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
  status: 'uploading' | 'ready' | 'rejected';
  validationNote?: string;
}

export interface InboxTask {
  id: string;
  messageId: string;
  title: string;
  description: string;
  reason?: string;
  originAgentId?: SystemAgentId;
  assignedToUserId?: string;
  assignedToName?: string;
  priority: InboxPriority;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  dueAt?: string | null;
  checklist: Array<{ id: string; label: string; done: boolean }>;
  relatedEntities: InboxEntityReference[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemAgentDefinition {
  id: SystemAgentId;
  name: string;
  roleTitle: string;
  sector: string;
  iconName: string;
  description: string;
  accentColor: string;
  badgeBg: string;
  defaultActive: boolean;
  allowedDataSources: string[];
  insightTypes: InboxMessageType[];
  allowedPriorities: InboxPriority[];
  minIntervalMinutes: number;
  suggestedActions: string[];
  forbiddenDirectActions: string[];
  defaultThreshold?: number;
}

export interface AgentRuleConfig {
  id: SystemAgentId;
  active: boolean;
  stockThreshold: number;
  analysisWindowHours: number;
  minIntervalMinutes: number;
  defaultPriority: InboxPriority;
  toAll: boolean;
  defaultRecipientIds: string[];
  suggestedAssigneeUid?: string;
  autoCreateTaskOnCritical: boolean;
  isCriticalAgent: boolean;
  mutedKeys: string[];
  lastExecutedAt?: string | null;
  lastExecutionSummary?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PartnerAdminMember {
  uid: string;
  name: string;
  email: string;
  roleId: string;
  roleLabel: string;
  photoURL?: string;
}

