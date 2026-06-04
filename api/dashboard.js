const { Redis }          = require('@upstash/redis');
const { getUserFromCookie } = require('./_helpers');

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function safeJSON(raw, fallback) {
  if (!raw) return fallback;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return fallback; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const username = getUserFromCookie(req);
  if (!username) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const [streakRaw, recentRaw] = await Promise.all([
      redis.get(`streak:${username}`),
      redis.get(`recent:${username}`),
    ]);

    const streak = safeJSON(streakRaw, { count: 0, lastDate: null, longest: 0 });
    const recent = safeJSON(recentRaw, []);

    return res.status(200).json({ streak, recent });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
};
