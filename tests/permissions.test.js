const { test } = require('node:test');
const assert = require('node:assert/strict');
const { viewerCanSee, canDecide, days } = require('../server');
const employee = { id: 'u1', role: 'employee' },
  manager = { id: 'u2', role: 'manager' },
  hr = { id: 'u3', role: 'hr' },
  outsider = { id: 'u4', role: 'employee' };
const pending = { ownerId: 'u1', status: 'pending' };
test('employee sees own leave', () => assert.equal(viewerCanSee(pending, employee), true));
test('other employee cannot see it', () => assert.equal(viewerCanSee(pending, outsider), false));
test('manager sees subordinate leave', () => assert.equal(viewerCanSee(pending, manager), true));
test('HR can view all requests', () => assert.equal(viewerCanSee(pending, hr), true));
test('employee cannot self-approve', () => assert.equal(canDecide(pending, employee), false));
test('manager can review first-stage requests', () =>
  assert.equal(canDecide(pending, manager), true));
test('HR can review requests after manager approval', () =>
  assert.equal(canDecide({ ...pending, status: 'hr_pending' }, hr), true));
test('manager cannot make the final HR decision', () =>
  assert.equal(canDecide({ ...pending, status: 'hr_pending' }, manager), false));
test('approved requests cannot be decided twice', () =>
  assert.equal(canDecide({ ...pending, status: 'approved' }, hr), false));
test('duration is inclusive', () => assert.equal(days('2026-10-20', '2026-10-22'), 3));
