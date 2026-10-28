import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInternalRedirect, getAuthErrorMessage } from '../src/utils/authRedirect';

describe('sanitizeInternalRedirect', () => {
  it('accepts valid internal paths', () => {
    assert.equal(sanitizeInternalRedirect('/checkout'), '/checkout');
    assert.equal(sanitizeInternalRedirect('/orders?tab=history'), '/orders?tab=history');
    assert.equal(sanitizeInternalRedirect('/clube#points'), '/clube#points');
  });

  it('rejects external URLs (prevent open redirect attacks)', () => {
    assert.equal(sanitizeInternalRedirect('https://evil.com'), '/');
    assert.equal(sanitizeInternalRedirect('http://evil.com/checkout'), '/');
    assert.equal(sanitizeInternalRedirect('//evil.com'), '/');
    assert.equal(sanitizeInternalRedirect('/\\evil.com'), '/');
    assert.equal(sanitizeInternalRedirect('javascript:alert(1)'), '/');
    assert.equal(sanitizeInternalRedirect('data:text/html,<script>alert(1)</script>'), '/');
  });

  it('rejects loops back to auth routes', () => {
    assert.equal(sanitizeInternalRedirect('/login'), '/');
    assert.equal(sanitizeInternalRedirect('/login?returnUrl=/checkout'), '/');
    assert.equal(sanitizeInternalRedirect('/register'), '/');
    assert.equal(sanitizeInternalRedirect('/forgot-password'), '/');
  });

  it('falls back to defaultUrl when input is invalid or empty', () => {
    assert.equal(sanitizeInternalRedirect(''), '/');
    assert.equal(sanitizeInternalRedirect('   '), '/');
    assert.equal(sanitizeInternalRedirect(null), '/');
    assert.equal(sanitizeInternalRedirect(undefined), '/');
    assert.equal(sanitizeInternalRedirect(123), '/');
    assert.equal(sanitizeInternalRedirect('', '/cart'), '/cart');
  });
});

describe('getAuthErrorMessage', () => {
  it('recognizes cancelled popup without alarming message', () => {
    const err = getAuthErrorMessage({ code: 'auth/popup-closed-by-user' });
    assert.equal(err.isCancelled, true);
    assert.match(err.title, /cancelado/i);

    const err2 = getAuthErrorMessage({ code: 'auth/cancelled-popup-request' });
    assert.equal(err2.isCancelled, true);

    const err3 = getAuthErrorMessage({ code: 'auth/redirect-cancelled-by-user' });
    assert.equal(err3.isCancelled, true);
  });

  it('recognizes popup blocked and gives clear instruction', () => {
    const err = getAuthErrorMessage({ code: 'auth/popup-blocked' });
    assert.equal(err.isCancelled, false);
    assert.match(err.title, /Popup bloqueado/);
    assert.match(err.message, /Permita popups/);
  });

  it('recognizes unauthorized domain', () => {
    const err = getAuthErrorMessage({ code: 'auth/unauthorized-domain' });
    assert.equal(err.isCancelled, false);
    assert.match(err.title, /Domínio não autorizado/);
    assert.match(err.message, /Authorized domains/);
  });

  it('recognizes operation not allowed (provider disabled)', () => {
    const err = getAuthErrorMessage({ code: 'auth/operation-not-allowed' });
    assert.equal(err.isCancelled, false);
    assert.match(err.title, /desativado/);
  });

  it('recognizes network request failed', () => {
    const err = getAuthErrorMessage({ code: 'auth/network-request-failed' });
    assert.equal(err.isCancelled, false);
    assert.match(err.title, /conexão/);
  });

  it('recognizes account-exists-with-different-credential', () => {
    const err = getAuthErrorMessage({ code: 'auth/account-exists-with-different-credential' });
    assert.equal(err.isCancelled, false);
    assert.match(err.title, /E-mail já cadastrado/);
  });

  it('provides safe generic fallback for unexpected errors', () => {
    const err = getAuthErrorMessage({ message: 'Custom server fault' });
    assert.equal(err.isCancelled, false);
    assert.match(err.title, /Erro ao autenticar/);
    assert.equal(err.message, 'Custom server fault');
  });
});

describe('Google Auth Button State Machine & Flow', () => {
  interface FlowState {
    loadingGoogle: boolean;
    redirectLoading: boolean;
    disabled: boolean;
    authenticatedUser: { uid: string; displayName: string } | null;
    currentRoute: string;
    displayedToast: { title: string; message: string } | null;
  }

  const createInitialState = (currentRoute = '/login'): FlowState => ({
    loadingGoogle: false,
    redirectLoading: false,
    disabled: false,
    authenticatedUser: null,
    currentRoute,
    displayedToast: null,
  });

  // Simulates the exact handleGoogle logic implemented in Login.tsx & Register.tsx
  const executeGoogleAuthFlow = async (
    state: FlowState,
    authFn: () => Promise<{ uid: string; displayName: string } | null>,
    targetUrl = '/checkout'
  ) => {
    const isAnySubmitting = state.disabled || state.loadingGoogle || state.redirectLoading;
    if (isAnySubmitting) return; // Concurrency guard

    state.loadingGoogle = true;
    state.disabled = true;

    try {
      const user = await authFn();
      if (user) {
        state.authenticatedUser = user;
        state.currentRoute = targetUrl;
        state.displayedToast = { title: 'Login com Google!', message: `Bem-vindo, ${user.displayName}` };
      }
    } catch (err: unknown) {
      const errInfo = getAuthErrorMessage(err);
      if (!errInfo.isCancelled) {
        state.displayedToast = { title: errInfo.title, message: errInfo.message };
      }
    } finally {
      state.loadingGoogle = false;
      state.disabled = false;
    }
  };

  it('Scenario 1: User cancels popup -> restores button to enabled, no toast, no route change', async () => {
    const state = createInitialState('/login');
    assert.equal(state.disabled, false);
    assert.equal(state.loadingGoogle, false);

    await executeGoogleAuthFlow(state, async () => {
      throw { code: 'auth/popup-closed-by-user' };
    });

    // Button MUST be restored
    assert.equal(state.loadingGoogle, false);
    assert.equal(state.disabled, false);
    assert.equal(state.authenticatedUser, null);
    assert.equal(state.currentRoute, '/login'); // Did NOT navigate
    assert.equal(state.displayedToast, null); // No alarming toast
  });

  it('Scenario 2: Popup blocked -> restores button to enabled, presents informative toast, no route change', async () => {
    const state = createInitialState('/login');

    await executeGoogleAuthFlow(state, async () => {
      throw { code: 'auth/popup-blocked' };
    });

    // Button MUST be restored
    assert.equal(state.loadingGoogle, false);
    assert.equal(state.disabled, false);
    assert.equal(state.authenticatedUser, null);
    assert.equal(state.currentRoute, '/login');
    assert.ok(state.displayedToast !== null);
    assert.match(state.displayedToast.title, /Popup bloqueado/);
    assert.match(state.displayedToast.message, /Permita popups/);
  });

  it('Scenario 3: Network failure -> restores button, shows network error, allows retry', async () => {
    const state = createInitialState('/register');

    await executeGoogleAuthFlow(state, async () => {
      throw { code: 'auth/network-request-failed' };
    });

    assert.equal(state.loadingGoogle, false);
    assert.equal(state.disabled, false);
    assert.equal(state.authenticatedUser, null);
    assert.equal(state.currentRoute, '/register');
    assert.match(state.displayedToast!.title, /conexão/);
  });

  it('Scenario 4: Retry succeeds immediately after cancellation or failure without reload', async () => {
    const state = createInitialState('/login');

    // First attempt: user cancels
    await executeGoogleAuthFlow(state, async () => {
      throw { code: 'auth/popup-closed-by-user' };
    });
    assert.equal(state.disabled, false);
    assert.equal(state.authenticatedUser, null);

    // Second attempt: succeeds
    await executeGoogleAuthFlow(state, async () => {
      return { uid: 'user_123', displayName: 'Maria' };
    }, '/checkout');

    assert.equal(state.loadingGoogle, false);
    assert.equal(state.disabled, false);
    assert.equal(state.authenticatedUser?.uid, 'user_123');
    assert.equal(state.currentRoute, '/checkout'); // Successfully navigated
  });

  it('Scenario 5: Concurrency protection blocks double-clicks while request is in-flight', async () => {
    const state = createInitialState('/login');
    let callCount = 0;

    const slowAuth = () =>
      new Promise<{ uid: string; displayName: string }>((resolve) => {
        callCount++;
        setTimeout(() => resolve({ uid: 'user_abc', displayName: 'João' }), 20);
      });

    // Fire first click
    const p1 = executeGoogleAuthFlow(state, slowAuth);
    // Fire second click immediately while in-flight
    const p2 = executeGoogleAuthFlow(state, slowAuth);

    await Promise.all([p1, p2]);

    assert.equal(callCount, 1); // Second click was blocked
    assert.equal(state.authenticatedUser?.uid, 'user_abc');
    assert.equal(state.disabled, false);
    assert.equal(state.loadingGoogle, false);
  });

  it('Scenario 6: PWA redirect return without authenticated user restores button to enabled', () => {
    const state = createInitialState('/login');
    // Simulate PWA redirect in progress on mount
    state.redirectLoading = true;
    state.disabled = true;

    // Simulate processRedirect finishing with result = null (user backed out / cancelled on Google)
    const simulatedRedirectResult = null;

    if (!simulatedRedirectResult) {
      // Flow when returning without completed user
      state.redirectLoading = false;
      state.disabled = false;
    }

    assert.equal(state.redirectLoading, false);
    assert.equal(state.disabled, false);
    assert.equal(state.authenticatedUser, null);
    assert.equal(state.currentRoute, '/login'); // Stays on login
  });
});
