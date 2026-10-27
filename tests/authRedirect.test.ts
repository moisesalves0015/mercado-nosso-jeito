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
  it('recognizes cancelled popup', () => {
    const err = getAuthErrorMessage({ code: 'auth/popup-closed-by-user' });
    assert.equal(err.isCancelled, true);
  });

  it('recognizes popup blocked', () => {
    const err = getAuthErrorMessage({ code: 'auth/popup-blocked' });
    assert.equal(err.isCancelled, false);
    assert.match(err.title, /Popup bloqueado/);
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
});
