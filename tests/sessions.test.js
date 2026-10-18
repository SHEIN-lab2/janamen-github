const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSessions, demoAllowed } = require('../lib/sessions');
test('session expires at exact deadline', () => {
  let time = 0;
  const s = createSessions({ now: () => time, ttl: 100 });
  const a = s.create('u1', 'password');
  time = 99;
  assert.equal(s.get(a.token).userId, 'u1');
  time = 100;
  assert.equal(s.get(a.token), null);
});
test('switching account revokes old session and creates independent token', () => {
  const s = createSessions();
  const a = s.create('u1', 'demo');
  const b = s.create('u3', 'password', a.token);
  assert.notEqual(a.token, b.token);
  assert.equal(s.get(a.token), null);
  assert.equal(s.get(b.token).userId, 'u3');
  s.remove(b.token);
  assert.equal(s.get(b.token), null);
});
test('demo mode obeys explicit disable, local default and remote opt-in', () => {
  const local = { socket: { remoteAddress: '127.0.0.1' } },
    remote = { socket: { remoteAddress: '10.0.0.5' } };
  assert.equal(demoAllowed(local, {}), true);
  assert.equal(demoAllowed(remote, {}), false);
  assert.equal(demoAllowed(local, { DEMO_LOGIN: '0' }), false);
  assert.equal(demoAllowed(remote, { DEMO_LOGIN: '1' }), true);
});
