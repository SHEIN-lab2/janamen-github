'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createIntegrations } = require('../lib/integrations');
const { buildDemo, migrateDemo } = require('../lib/demo');
const people = require('../fixtures/personnel.json');
test('1C mock imports only official fields, never role/email/password', () => {
  const db = {
    users: [
      {
        id: 'u1',
        name: 'Old',
        role: 'employee',
        email: 'local@test.invalid',
        pass: 'test-hash',
      },
    ],
  };
  const a = createIntegrations(db);
  assert.equal(a.personnelProvider.getEmployee('unknown'), null);
  assert.equal(a.personnelProvider.getLeaveBalance('u1'), 24);
  assert.equal(a.personnelProvider.sync('u3').updated, 1);
  assert.equal(db.users[0].name, people[0].name);
  assert.equal(db.users[0].role, 'employee');
  assert.equal(db.users[0].pass, 'test-hash');
  assert.equal(db.users[0].email, 'local@test.invalid');
});
test('Documentolog mock preserves idempotency, status and version after recreation', () => {
  const db = { users: [] };
  const a = createIntegrations(db);
  const r = {
    id: 'test-r',
    ownerId: 'u1',
    status: 'pending',
    start: '2030-01-01',
    end: '2030-01-02',
  };
  const d = a.workflowAdapter.submitLeave(r, 'u1');
  assert.equal(a.workflowAdapter.submitLeave(r, 'u1').externalId, d.externalId);
  assert.equal(db.integrations.documents.length, 1);
  a.workflowAdapter.decide(d.externalId, 'approved', 'u2');
  assert.throws(() => a.workflowAdapter.decide(d.externalId, 'rejected', 'u2'));
  const next = createIntegrations(db).workflowAdapter.getStatus(d.externalId);
  assert.equal(next.status, 'approved');
  assert.equal(next.version, 2);
  assert.equal(a.workflowAdapter.getStatus('absent'), null);
});
test('demo data has valid histories, dynamic dates, statuses and learning states', () => {
  const seed = buildDemo(
    people,
    [{ id: 'c1' }, { id: 'c2' }],
    () => 'hash',
    'unused',
    new Date('2032-06-01T12:00:00Z'),
  );
  assert.equal(seed.requests.length, 5);
  assert.equal(seed.requests.find((r) => r.id === 'demo-pending').start, '2032-06-08');
  for (const r of seed.requests) {
    assert.ok(r.createdAt <= r.history.at(-1).at);
    if (r.status !== 'pending') assert.ok(r.history.at(-1).at.slice(0, 10) <= r.start);
  }
  assert.equal(
    seed.progress.some((p) => p.completed),
    true,
  );
  assert.equal(
    seed.progress.some((p) => p.read && !p.completed),
    true,
  );
});
test('migration is repeatable, keeps existing requests, hashes and course progress', () => {
  const seed = buildDemo(people, [], () => 'new-hash', 'unused', new Date('2032-06-01T12:00:00Z'));
  const existing = {
    id: 'mine',
    ownerId: 'u1',
    status: 'pending',
    start: '2032-06-08',
    end: '2032-06-10',
  };
  const db = {
    users: [{ id: 'u1', pass: 'existing-hash' }],
    requests: [existing],
    notifications: [],
    assignments: [],
    progress: [{ userId: 'u2', courseId: 'c1', read: true, completed: false }],
  };
  assert.equal(migrateDemo(db, seed), true);
  assert.ok(db.requests.includes(existing));
  assert.equal(
    db.requests.some((r) => r.id === 'demo-pending'),
    false,
  );
  assert.equal(db.users[0].pass, 'existing-hash');
  assert.equal(db.progress.find((p) => p.userId === 'u2').completed, false);
  const snapshot = JSON.stringify(db);
  assert.equal(migrateDemo(db, seed), false);
  assert.equal(JSON.stringify(db), snapshot);
});

test('connection settings persist, update idempotently and reject embedded credentials', () => {
  const db = { users: [] };
  const i = createIntegrations(db);
  const input = {
    system: 'documentolog',
    name: 'Документы',
    endpoint: 'https://docs.example.test/api/',
  };
  i.configure(input, 'u3');
  i.configure({ ...input, name: 'Обновлено', token: 'must-not-store' }, 'u3');
  const saved = createIntegrations(db).summary();
  assert.equal(saved.connections.length, 1);
  assert.equal(saved.connections[0].name, 'Обновлено');
  assert.equal(saved.connections[0].status, 'adapter_required');
  assert.ok(!JSON.stringify(db).includes('must-not-store'));
  for (const endpoint of [
    'http://example.test',
    'https://user:password@example.test',
    'https://example.test/?token=secret',
    'https://example.test/#secret',
  ])
    assert.throws(() => i.configure({ ...input, endpoint }, 'u3'));
  assert.throws(() => i.configure({ ...input, system: 'other' }, 'u3'));
});
