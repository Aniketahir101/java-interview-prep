const crypto = require('crypto');

function signValue(value, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64url');
}

// Creates a signed cookie value: "username.HMAC_SIGNATURE"
function createSignedCookie(username, secret) {
  const sig = signValue(username, secret);
  return `${username}.${sig}`;
}

// Reads and verifies the session cookie — returns username or null
function getUserFromCookie(req) {
  const cookieHeader = req.headers.cookie || '';

  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map(c => {
        const eq = c.indexOf('=');
        if (eq === -1) return null;
        return [c.slice(0, eq).trim(), c.slice(eq + 1).trim()];
      })
      .filter(Boolean)
  );

  const cookieValue = cookies['session'];
  if (!cookieValue) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const username    = cookieValue.substring(0, dotIndex);
  const sig         = cookieValue.substring(dotIndex + 1);
  const expectedSig = signValue(username, secret);

  try {
    const sigBuf      = Buffer.from(sig,         'base64url');
    const expectedBuf = Buffer.from(expectedSig,  'base64url');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    return username;
  } catch {
    return null;
  }
}

module.exports = { createSignedCookie, getUserFromCookie };
