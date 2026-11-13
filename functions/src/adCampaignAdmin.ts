import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { publicCallable } from './invoker';
import { writeAudit } from './admin/audit';
import { requireAnyPermission, requirePermission, requireReason } from './admin/rbac';
import {
  AdCampaignStatus,
  validateSponsoredCampaignInput,
} from './sponsoredCampaignSchema';

const db = () => admin.firestore();
const HttpsError = functions.https.HttpsError;
const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

export const adminListAdCampaigns = publicCallable.https.onCall(async (_data, context) => {
  await requireAnyPermission(context.auth, [
    'marketing:view',
    'marketing:create',
    'marketing:edit',
    'marketing:publish',
    'marketing:archive',
  ]);

  const [campaignsSnap, legacySnap] = await Promise.all([
    db().collection('ad_campaigns').orderBy('updatedAt', 'desc').get().catch(() =>
      db().collection('ad_campaigns').get(),
    ),
    db().collection('premium_offers').get(),
  ]);

  const campaigns = campaignsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const legacyOffers = legacySnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { campaigns, legacyOffers };
});

export const adminSaveAdCampaign = publicCallable.https.onCall(async (data, context) => {
  const req = (data ?? {}) as {
    campaignId?: unknown;
    payload?: Record<string, unknown>;
    reason?: unknown;
    migratedFromLegacyId?: unknown;
  };

  const isUpdate = typeof req.campaignId === 'string' && req.campaignId.trim().length > 0;
  const actor = await requirePermission(context.auth, isUpdate ? 'marketing:edit' : 'marketing:create');
  const reason = requireReason(req.reason, 5, 300);

  if (!req.payload || typeof req.payload !== 'object') {
    throw new HttpsError('invalid-argument', 'payload da campanha é obrigatório.');
  }

  let validated;
  try {
    validated = validateSponsoredCampaignInput(req.payload);
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Dados inválidos.');
  }

  const campaignId = isUpdate ? String(req.campaignId).trim() : db().collection('ad_campaigns').doc().id;
  if (!ID_RE.test(campaignId)) {
    throw new HttpsError('invalid-argument', 'campaignId inválido.');
  }

  const migratedFromLegacyId =
    typeof req.migratedFromLegacyId === 'string' && ID_RE.test(req.migratedFromLegacyId.trim())
      ? req.migratedFromLegacyId.trim()
      : null;

  const ref = db().collection('ad_campaigns').doc(campaignId);

  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (isUpdate && !snap.exists) {
      throw new HttpsError('not-found', 'Campanha não encontrada.');
    }

    const before = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    const spentDiamonds = before ? Number(before.spentDiamonds ?? 0) : 0;
    const claimsCount = before ? Number(before.claimsCount ?? 0) : 0;

    if (validated.rewardType === 'diamonds' && validated.totalBudgetDiamonds < spentDiamonds) {
      throw new HttpsError(
        'failed-precondition',
        `Orçamento de diamantes (${validated.totalBudgetDiamonds}) não pode ser menor que o já consumido (${spentDiamonds}).`,
      );
    }
    if (validated.totalBudgetClaims !== null && validated.totalBudgetClaims < claimsCount) {
      throw new HttpsError(
        'failed-precondition',
        `Limite global de resgates (${validated.totalBudgetClaims}) não pode ser menor que os resgates já realizados (${claimsCount}).`,
      );
    }

    const currentStatus: AdCampaignStatus = before
      ? ((before.status as AdCampaignStatus) ?? (before.active === true ? 'active' : 'paused'))
      : 'draft';
    const nextVersion = before ? Number(before.version ?? 1) + 1 : 1;

    const docData = {
      ...validated,
      minWatchSeconds: validated.durationSeconds,
      status: currentStatus,
      active: currentStatus === 'active',
      spentDiamonds,
      claimsCount,
      version: nextVersion,
      migratedFromLegacyId: before?.migratedFromLegacyId ?? migratedFromLegacyId,
      lastAuditReason: reason,
      updatedBy: actor.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(before
        ? {}
        : {
            createdBy: actor.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
    };

    if (before) {
      tx.update(ref, docData);
    } else {
      tx.set(ref, docData);
    }

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: isUpdate ? 'ad_campaign.update' : 'ad_campaign.create',
        module: 'marketing',
        entityType: 'ad_campaign',
        entityId: campaignId,
        before: before
          ? {
              title: before.title,
              brand: before.brand,
              status: currentStatus,
              rewardType: before.rewardType,
              rewardDiamonds: before.rewardDiamonds,
              totalBudgetDiamonds: before.totalBudgetDiamonds,
              version: before.version ?? 1,
            }
          : null,
        after: {
          title: validated.title,
          brand: validated.brand,
          status: currentStatus,
          rewardType: validated.rewardType,
          rewardDiamonds: validated.rewardDiamonds,
          totalBudgetDiamonds: validated.totalBudgetDiamonds,
          version: nextVersion,
        },
        reason,
        result: 'success',
        source: 'callable',
      },
      tx,
    );

    return {
      campaignId,
      status: currentStatus,
      version: nextVersion,
    };
  });

  return { success: true, ...result };
});

export type AdCampaignTransitionAction = 'publish' | 'pause' | 'end' | 'archive' | 'restore';

export const adminSetAdCampaignStatus = publicCallable.https.onCall(async (data, context) => {
  const req = (data ?? {}) as {
    campaignId?: unknown;
    action?: unknown;
    reason?: unknown;
  };

  if (typeof req.campaignId !== 'string' || !ID_RE.test(req.campaignId.trim())) {
    throw new HttpsError('invalid-argument', 'campaignId inválido.');
  }
  const campaignId = req.campaignId.trim();

  const action = req.action as AdCampaignTransitionAction;
  if (!['publish', 'pause', 'end', 'archive', 'restore'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Ação de status inválida.');
  }

  const requiredPerm =
    action === 'archive'
      ? 'marketing:archive'
      : action === 'restore'
        ? 'marketing:restore'
        : 'marketing:publish';

  const actor = await requirePermission(context.auth, requiredPerm);
  const reason = requireReason(req.reason, 5, 300);

  const ref = db().collection('ad_campaigns').doc(campaignId);
  const nowMs = Date.now();

  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Campanha não encontrada.');
    }
    const before = snap.data() as Record<string, unknown>;
    const previousStatus: AdCampaignStatus =
      (before.status as AdCampaignStatus) ?? (before.active === true ? 'active' : 'paused');

    let nextStatus: AdCampaignStatus;
    if (action === 'publish') {
      if (previousStatus === 'archived') {
        throw new HttpsError('failed-precondition', 'Restaure a campanha antes de publicar.');
      }
      const startsAtMs = typeof before.startsAtMs === 'number' ? before.startsAtMs : null;
      const endsAtMs = typeof before.endsAtMs === 'number' ? before.endsAtMs : null;
      if (endsAtMs !== null && nowMs >= endsAtMs) {
        throw new HttpsError('failed-precondition', 'Não é possível publicar uma campanha já expirada.');
      }
      nextStatus = startsAtMs !== null && startsAtMs > nowMs ? 'scheduled' : 'active';
    } else if (action === 'pause') {
      nextStatus = 'paused';
    } else if (action === 'end') {
      nextStatus = 'ended';
    } else if (action === 'archive') {
      nextStatus = 'archived';
    } else {
      nextStatus = 'paused';
    }

    const nextVersion = Number(before.version ?? 1) + 1;

    tx.update(ref, {
      status: nextStatus,
      active: nextStatus === 'active',
      version: nextVersion,
      lastAuditReason: reason,
      updatedBy: actor.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(action === 'publish' ? { publishedBy: actor.uid, publishedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
      ...(action === 'pause' ? { pausedBy: actor.uid, pausedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
      ...(action === 'archive' ? { archivedBy: actor.uid, archivedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    });

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: `ad_campaign.${action}`,
        module: 'marketing',
        entityType: 'ad_campaign',
        entityId: campaignId,
        before: { status: previousStatus, active: before.active === true, version: before.version ?? 1 },
        after: { status: nextStatus, active: nextStatus === 'active', version: nextVersion },
        reason,
        result: 'success',
        source: 'callable',
      },
      tx,
    );

    return {
      campaignId,
      previousStatus,
      status: nextStatus,
      version: nextVersion,
    };
  });

  return { success: true, ...result };
});
