const { Redis }          = require('@upstash/redis');
const { getUserFromCookie } = require('./_helpers');

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VALID_STATUSES = ['Not Started', 'In Progress', 'Revision Needed', 'Confident'];

// Redis key per user: "progress:rahul"
// Stored as a Hash: { questionId: status, questionId2: status2 }
// HGETALL = load everything in one command
// HSET    = save one status in one command

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const username = getUserFromCookie(req);
  if (!username) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const redisKey = `progress:${username}`;

  // ── GET — load all progress for this user ──
  if (req.method === 'GET') {
    try {
      const progress = await redis.hgetall(redisKey);
      // hgetall returns null if key doesn't exist yet (new user)
      return res.status(200).json(progress || {});
    } catch (err) {
      console.error('Redis HGETALL error:', err);
      return res.status(500).json({ error: 'Failed to load progress' });
    }
  }

  // ── POST — save one status update ──
  if (req.method === 'POST') {
    const { questionId, status } = req.body || {};

    // Validate questionId — must be a valid Notion page ID format
    if (!questionId || typeof questionId !== 'string') {
      return res.status(400).json({ error: 'questionId is required' });
    }
    if (!/^[a-f0-9-]{32,36}$/.test(questionId)) {
      return res.status(400).json({ error: 'Invalid questionId format' });
    }

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    try {
      await redis.hset(redisKey, { [questionId]: status });
      return res.status(200).json({ success: true, username, questionId, status });
    } catch (err) {
      console.error('Redis HSET error:', err);
      return res.status(500).json({ error: 'Failed to save progress' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
