'use strict';
const crypto = require('node:crypto');
function createSessions({ now = Date.now, ttl = 8 * 3600000 } = {}) {
  const sessions = new Map();
  return {
    create(userId, mode, previous) {
      this.remove(previous);
      for (const [id, s] of sessions) if (s.expiresAt <= now()) sessions.delete(id);
      const token = crypto.randomBytes(32).toString('hex');
      const session = { userId, mode, expiresAt: now() + ttl };
      sessions.set(token, session);
      return { token, ...session };
    },
    get(token) {
      const s = sessions.get(token);
      if (!s || s.expiresAt <= now()) {
        sessions.delete(token);
        return null;
      }
      return { ...s };
    },
    remove(token) {
      sessions.delete(token);
    },
  };
}
function demoAllowed(req, env = process.env) {
  return (
    env.DEMO_LOGIN !== '0' &&
    (env.DEMO_LOGIN === '1' ||
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
  );
}
module.exports = { createSessions, demoAllowed };
