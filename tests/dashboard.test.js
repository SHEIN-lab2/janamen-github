'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
function render(role, notifications = []) {
  const context = vm.createContext({
    console,
    fetch: () => new Promise(() => {}),
    window: { addEventListener() {} },
    setTimeout,
    clearTimeout,
  });
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  for (const [, src] of html.matchAll(/<script src="([^"\s]+)" defer><\/script>/g)) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', src), 'utf8'), context, {
      filename: src,
    });
  }
  return vm.runInContext(
    `
      user = {
        id: 'u1',
        role: ${JSON.stringify(role)},
        name: 'Тестовый сотрудник',
        company: 'Demo',
      };
      view = 'dashboard';
      data = {
        stats: { teamCount: 7 },
        session: { mode: 'demo' },
        notifications: ${JSON.stringify(notifications)},
        courses: [],
        requests: [
          {
            id: 'self',
            ownerId: 'u1',
            ownerName: 'Тест',
            status: 'pending',
            canDecide: false,
            start: '2030-01-01',
            end: '2030-01-03',
          },
        ],
      };
      ({ page: dashboard(), shell: shell(), notificationPage: notifications() });
    `,
    context,
  );
}
test('employee dashboard contains personal actions and no management navigation', () => {
  const r = render('employee');
  assert.ok(r.page.includes('Мои заявки в работе'));
  assert.ok(r.page.includes('Подать заявление'));
  assert.ok(!r.shell.includes('data-nav="team"'));
  assert.ok(!r.shell.includes('data-nav="integrations"'));
  assert.ok(!r.page.includes('Очередь согласования'));
});
test('manager dashboard does not count own pending request as actionable', () => {
  const r = render('manager');
  assert.ok(r.page.includes('Всё рассмотрено.'));
  assert.ok(r.page.includes('Очередь согласования'));
  assert.ok(r.shell.includes('data-nav="team"'));
  assert.ok(!r.shell.includes('data-nav="integrations"'));
});
test('HR navigation exposes integrations; empty dashboard remains useful', () => {
  const r = render('hr');
  assert.ok(r.shell.includes('data-nav="integrations"'));
  assert.ok(r.shell.includes('<span class="navlabel">Обучение</span>'));
  assert.ok(r.shell.includes('<span class="navlabel">Обучение сотрудников</span>'));
  assert.ok(r.page.includes('Назначенных курсов пока нет'));
  assert.ok(r.page.includes('Срочных действий нет'));
  assert.ok(r.shell.includes('aria-controls="sidebar"'));
  assert.ok(r.shell.includes('aria-current="page"'));
});

test('managers and HR have personal courses and separate employee training navigation', () => {
  for (const role of ['manager', 'hr']) {
    const r = render(role);
    assert.match(r.shell, /МОЁ ПРОСТРАНСТВО[\s\S]*data-nav="academy"[\s\S]*Обучение/);
    assert.ok(r.shell.includes('data-nav="learning"'));
  }
});

for (const role of ['employee', 'manager', 'hr'])
  test(`restored modules respect role access for ${role}`, () => {
    const r = render(role);
    for (const target of ['knowledge', 'notifications'])
      assert.ok(r.shell.includes(`data-nav="${target}"`));
    assert.equal(r.shell.includes('data-nav="team"'), role !== 'employee');
    assert.ok(r.page.includes('Последние уведомления'));
    assert.ok(r.page.includes('data-nav="knowledge"'));
    assert.ok(!r.shell.includes('id="refresh-page"'));
    assert.ok(!r.page.includes('role-pill'));
  });

test('headings, counts, avatars and notification entry points', () => {
  const r = render('hr');
  assert.ok(r.page.includes('7 <span>сотрудников'));
  assert.ok(r.page.includes('заданий выполнено'));
  assert.ok(r.shell.includes('cat-avatar'));
  assert.ok(!r.shell.includes('aria-label="Уведомления"'));
  assert.ok(r.shell.includes('<span class="navlabel">Заявки</span>'));
});

test('recent dashboard notifications open only from a static arrow button', () => {
  const r = render('hr', [
    {
      id: 'notice-1',
      text: 'Заявка обновлена',
      at: '2030-01-01T12:00:00.000Z',
      read: false,
      target: { page: 'requests' },
    },
  ]);
  assert.match(r.page, /<div class="notification-card dashboard-notification is-unread">/);
  assert.match(
    r.page,
    /<button class="arrow-button notification-open" data-notification="notice-1" aria-label="Открыть уведомление">/,
  );
  assert.doesNotMatch(r.page, /<button class="notification-card dashboard-notification/);
});

test('notification list opens only from a static arrow button without a clickable card', () => {
  const r = render('employee', [
    {
      id: 'notice-2',
      text: 'Заявка обновлена',
      at: '2030-01-01T12:00:00.000Z',
      read: false,
      target: { page: 'requests' },
    },
  ]);
  assert.match(r.notificationPage, /<div class="notification-card is-unread">/);
  assert.match(
    r.notificationPage,
    /<button class="arrow-button notification-open" data-notification="notice-2" aria-label="Открыть уведомление">/,
  );
  assert.doesNotMatch(r.notificationPage, /<button class="notification-card/);
});
