module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Expire the cookie immediately by setting Max-Age=0
  res.setHeader(
    'Set-Cookie',
    'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  );

  return res.status(200).json({ success: true });
};
