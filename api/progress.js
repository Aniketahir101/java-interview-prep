const { Redis }          = require('@upstash/redis');
const { getUserFromCookie } = require('./_helpers');

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VALID_STATUSES = ['Not Started', 'In Progress', 'Revision Needed', 'Confident'];

function safeJSON(raw, fallback) {
  if (!raw) return fallback;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return fallback; }
}

function dateString(msOffset = 0) {
  return new Date(Date.now() + msOffset).toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const username = getUserFromCookie(req);
  if (!username) return res.status(401).json({ error: 'Not authenticated' });

  const redisKey = `progress:${username}`;

  // ── GET — load all progress for this user ──
  if (req.method === 'GET') {
    try {
      const progress = await redis.hgetall(redisKey);
      return res.status(200).json(progress || {});
    } catch (err) {
      console.error('Redis HGETALL error:', err);
      return res.status(500).json({ error: 'Failed to load progress' });
    }
  }

  // ── POST — save one status update ──
  if (req.method === 'POST') {
    const { questionId, status, questionTitle = '' } = req.body || {};

    if (!questionId || typeof questionId !== 'string')
      return res.status(400).json({ error: 'questionId is required' });
    if (!/^[a-f0-9-]{32,36}$/.test(questionId))
      return res.status(400).json({ error: 'Invalid questionId format' });
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });

    try {
      // ── Save status ──
      await redis.hset(redisKey, { [questionId]: status });

      // ── Update streak (fire-and-forget, don't fail the request) ──
      updateStreak(username).catch(e => console.error('Streak error:', e));

      // ── Update recent activity ──
      updateRecent(username, questionId, String(questionTitle).slice(0, 200), status)
        .catch(e => console.error('Recent error:', e));

      return res.status(200).json({ success: true, username, questionId, status });
    } catch (err) {
      console.error('Redis HSET error:', err);
      return res.status(500).json({ error: 'Failed to save progress' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function updateStreak(username) {
  const key       = `streak:${username}`;
  const today     = dateString();
  const yesterday = dateString(-86400000);

  const raw    = await redis.get(key);
  const streak = safeJSON(raw, { count: 0, lastDate: null, longest: 0 });

  if (streak.lastDate === today) return; // already counted today

  streak.count   = streak.lastDate === yesterday ? streak.count + 1 : 1;
  streak.lastDate = today;
  streak.longest  = Math.max(streak.longest || 0, streak.count);

  await redis.set(key, JSON.stringify(streak));
}

async function updateRecent(username, questionId, questionTitle, status) {
  const key = `recent:${username}`;
  const raw = await redis.get(key);
  let recent = safeJSON(raw, []);
  if (!Array.isArray(recent)) recent = [];

  recent.unshift({ questionId, questionTitle, status, timestamp: new Date().toISOString() });
  if (recent.length > 10) recent = recent.slice(0, 10);

  await redis.set(key, JSON.stringify(recent));
}
