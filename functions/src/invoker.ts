import * as functions from 'firebase-functions';

/**
 * Firebase Callable clients (browser SDK) carry a Firebase ID token, not a Google IAM
 * identity, so the transport layer must accept unauthenticated IAM callers
 * (`allUsers` -> Cloud Functions Invoker). That is the standard Firebase callable model.
 *
 * Declaring it here makes the invoker policy part of the deploy instead of a manual
 * console step. This is NOT the authorization layer: every callable using this builder
 * must still enforce Firebase Auth (`context.auth`) and, for admin operations,
 * `requirePermission` / `requireAnyPermission` on the server.
 *
 * Do not use this builder for maintenance or destructive functions that should stay
 * private at the IAM layer (e.g. `adminCleanAllDiamonds`, `setAdminClaim`).
 */
export const publicCallable = functions.runWith({ invoker: 'public' });

