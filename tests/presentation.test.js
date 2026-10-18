const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { applyCatNames } = require('../lib/presentation');
const people = require('../fixtures/personnel.json');
test('presentation renames existing accounts while preserving IDs, roles and credentials', () => {
  const db = {
    users: [
      {
        id: 'u1',
        name: 'Айдана Садыкова',
        role: 'employee',
        pass: 'preserved-hash',
        email: 'employee@jana.test',
      },
    ],
    notifications: [{ id: 'n1', text: 'Айдана Садыкова: новая заявка' }],
    requests: [{ id: 'r1', ownerId: 'u1', note: 'Отпуск Айдана Садыкова', status: 'approved' }],
    progress: [{ userId: 'u1', courseId: 'c1', completed: true }],
  };
  applyCatNames(db, people);
  assert.equal(db.users[0].name, 'Барсик');
  assert.equal(db.users[0].pass, 'preserved-hash');
  assert.equal(db.users[0].role, 'employee');
  assert.equal(db.requests[0].ownerId, 'u1');
  assert.equal(db.requests[0].status, 'approved');
  assert.equal(db.progress[0].completed, true);
  assert.ok(db.notifications[0].text.includes('Барсик'));
  const after = JSON.stringify(db);
  assert.equal(applyCatNames(db, people), false);
  assert.equal(JSON.stringify(db), after);
});
test('30 cat names remain unique and are used by personnel mock', () => {
  assert.equal(people.length, 30);
  assert.equal(new Set(people.map((p) => p.name)).size, 30);
  const { createIntegrations } = require('../lib/integrations');
  const db = { users: [{ id: 'u1', name: 'Old' }] };
  createIntegrations(db).personnelProvider.sync('u3');
  assert.equal(db.users[0].name, 'Барсик');
});
