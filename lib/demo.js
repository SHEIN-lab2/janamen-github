'use strict';
function buildDemo(users, courses, hash, password, now = new Date()) {
  const at = (offset) => new Date(now.getTime() + offset * 86400000).toISOString();
  const date = (offset) => at(offset).slice(0, 10);
  const specifications = [
    ['demo-pending', 'u1', 7, 9, 'pending', 'Плановый отпуск для демонстрации согласования'],
    ['demo-approved', 'u1', -15, -12, 'approved', 'Завершённый отпуск: пример истории'],
    ['demo-rejected', 'u1', 20, 22, 'rejected', 'Отклонённая заявка: сотрудник может подать новую'],
    ['demo-outsider', 'u4', 14, 15, 'pending', 'Заявка другого подразделения: проверка изоляции'],
    [
      'demo-manager',
      'u2',
      30,
      31,
      'pending',
      'Собственная заявка руководителя: без самосогласования',
    ],
  ];
  const requests = specifications.map(([id, ownerId, start, end, status, note], i) => {
    const owner = users.find((u) => u.id === ownerId),
      createdAt = at(Math.min(start - 5, -5 - i));
    const history = [{ status: 'pending', at: createdAt, actor: ownerId }];
    if (status !== 'pending')
      history.push({
        status,
        at: at(status === 'approved' ? -20 : -1),
        actor: owner.managerId || 'u3',
      });
    return {
      id,
      ownerId,
      type: 'leave',
      start: date(start),
      end: date(end),
      note,
      status,
      createdAt,
      history,
    };
  });
  const assignments = users.map((u) => ({ userId: u.id, courseId: 'c1', assignedAt: at(-3) }));
  assignments.push({ userId: 'u4', courseId: 'c2', assignedAt: at(-3) });
  const progress = [
    { userId: 'u2', courseId: 'c1', read: true, completed: true, at: at(-1) },
    { userId: 'u4', courseId: 'c1', read: true, completed: false },
  ];
  const notifications = users.map((u) => ({
    id: 'demo-course-' + u.id,
    userId: u.id,
    text: 'Вам назначен курс «Информационная безопасность»',
    at: at(-3),
    read: false,
  }));
  notifications.push(
    {
      id: 'demo-approved-note',
      userId: 'u1',
      text: 'Ваша заявка согласована: ' + date(-15) + ' — ' + date(-12),
      at: at(-20),
      read: false,
    },
    {
      id: 'demo-rejected-note',
      userId: 'u1',
      text: 'Ваша заявка отклонена: ' + date(20) + ' — ' + date(22),
      at: at(-1),
      read: false,
    },
    {
      id: 'demo-course-complete',
      userId: 'u2',
      text: 'Курс «Информационная безопасность» успешно завершён',
      at: at(-1),
      read: true,
    },
    {
      id: 'demo-incoming',
      userId: 'u2',
      text: users.find((u) => u.id === 'u1').name + ': новая заявка на отпуск',
      at: at(-5),
      read: false,
    },
  );
  return {
    schemaVersion: 4,
    demoVersion: 5,
    users: users.map((u) => ({ ...u, pass: hash(password) })),
    requests,
    assignments,
    notifications,
    progress,
    courses: courses.map((c) => c.id),
  };
}

function migrateDemo(db, seed) {
  if (db.demoVersion >= 5) return false;
  for (const field of ['requests', 'notifications']) {
    db[field] ??= [];
    for (const item of seed[field]) {
      if (db[field].some((x) => x.id === item.id)) continue;
      if (
        field === 'requests' &&
        item.status !== 'rejected' &&
        db.requests.some(
          (r) =>
            r.ownerId === item.ownerId &&
            ['pending', 'hr_pending', 'approved'].includes(r.status) &&
            r.start <= item.end &&
            r.end >= item.start,
        )
      )
        continue;
      if (
        field === 'notifications' &&
        item.id === 'demo-approved-note' &&
        !db.requests.some((r) => r.id === 'demo-approved')
      )
        continue;
      if (
        field === 'notifications' &&
        item.id === 'demo-rejected-note' &&
        !db.requests.some((r) => r.id === 'demo-rejected')
      )
        continue;
      db[field].push(item);
    }
  }
  for (const item of seed.assignments) {
    db.assignments ??= [];
    if (!db.assignments.some((a) => a.userId === item.userId && a.courseId === item.courseId))
      db.assignments.push(item);
  }
  for (const item of seed.progress) {
    db.progress ??= [];
    if (!db.progress.some((a) => a.userId === item.userId && a.courseId === item.courseId))
      db.progress.push(item);
  }

  db.demoVersion = 5;
  db.schemaVersion = 4;
  return true;
}
module.exports = { buildDemo, migrateDemo };
