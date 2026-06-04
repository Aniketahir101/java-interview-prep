const { createSignedCookie } = require('./_helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.body || {};

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required' });
  }

  const normalized = username.trim().toLowerCase();

  if (!normalized || normalized.length > 50) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  // Validate against approved list from environment variable
  const approvedUsers = (process.env.APPROVED_USERS || '')
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);

  if (!approvedUsers.includes(normalized)) {
    // Intentionally vague — don't reveal whether the username exists
    return res.status(401).json({ error: 'Username not recognised. Ask the admin to add you.' });
  }

  // Create signed cookie — 7 day session
  const secret      = process.env.SESSION_SECRET;
  const cookieValue = createSignedCookie(normalized, secret);
  const maxAge      = 7 * 24 * 60 * 60; // seconds

  res.setHeader(
    'Set-Cookie',
    `session=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );

  return res.status(200).json({ success: true, username: normalized });
};
