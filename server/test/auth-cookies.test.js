const test = require('node:test');
const assert = require('node:assert/strict');
const authCookieOptions = require('../src/utils/authCookies');

test('HTTP local cookies use Lax and remain HttpOnly', () => {
  assert.deepEqual(authCookieOptions({ secure: false, headers: {} }), {
    httpOnly: true, secure: false, sameSite: 'lax', path: '/',
  });
});

test('HTTPS cookies retain cross-site support with Secure', () => {
  for (const req of [
    { secure: true, headers: {} },
    { secure: false, headers: { 'x-forwarded-proto': 'https' } },
  ]) {
    assert.deepEqual(authCookieOptions(req), {
      httpOnly: true, secure: true, sameSite: 'none', path: '/',
    });
  }
});
