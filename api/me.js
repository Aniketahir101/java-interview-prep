const { getUserFromCookie } = require('./_helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = getUserFromCookie(req);

  if (!username) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.status(200).json({ username });
};
