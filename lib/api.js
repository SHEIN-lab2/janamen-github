'use strict';
const crypto = require('node:crypto');
const { visibleDocuments } = require('./assistant');

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function days(start, end) {
  return Math.round((new Date(end + 'T00:00:00Z') - new Date(start + 'T00:00:00Z')) / 86400000) + 1;
}

function createApi({
  db,
  users,
  courses,
  knowledgeBase,
  assistant,
  integrations,
  sessions,
  demoAllowed,
  hash,
  valid,
  save,
  sessionCookie,
  viewerCanSee,
  canDecide,
}) {
  const loginAttempts = new Map();
  const aiBusy = new Set();
  const dummyHash = hash(crypto.randomBytes(32).toString('hex'));

  function cookie(req) {
    const value = (req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('sid='));
    return value ? value.slice(4) : null;
  }

  function current(req) {
    const session = sessions.get(cookie(req));
    return session ? db.users.find((user) => user.id === session.userId) || null : null;
  }

  function publicUser(user) {
    if (!user) return null;

    const { pass, ...result } = user;
    return {
      ...result,
      company: user.company || 'Jana Demo Company',
      managerName: db.users.find((item) => item.id === user.managerId)?.name || '—',
    };
  }

  function authenticate(req, res) {
    const user = current(req);
    if (!user)
      send(res, 401, {
        error: 'Сессия завершена. Войдите снова.',
        code: 'AUTH_REQUIRED',
      });
    return user;
  }

  function notify(userId, text, target) {
    db.notifications.unshift({
      id: crypto.randomUUID(),
      userId,
      text,
      target,
      at: new Date().toISOString(),
      read: false,
    });
  }

  function assigned(userId, courseId) {
    return db.assignments.some(
      (assignment) => assignment.userId === userId && assignment.courseId === courseId,
    );
  }

  function validDate(value) {
    return (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
    );
  }

  function userProgress(userId) {
    return db.progress.filter((progress) => progress.userId === userId);
  }

  async function parse(req) {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 20000) throw Error('Слишком большой запрос');
    }
    return body ? JSON.parse(body) : {};
  }

  function guardOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;

    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }

  async function api(req, res, url) {
    const { method } = req;
    const route = url.pathname;

    if (method !== 'GET' && !guardOrigin(req))
      return send(res, 403, { error: 'Неверный источник запроса' });

    if (route === '/api/auth/config' && method === 'GET')
      return send(res, 200, { demoEnabled: demoAllowed(req), sessionHours: 8 });

    if ((route === '/api/login' || route === '/api/demo/login') && method === 'POST') {
      const { email, password } = await parse(req);
      if (
        typeof email !== 'string' ||
        email.length > 254 ||
        (route === '/api/login' &&
          (typeof password !== 'string' || !password.length || password.length > 256))
      )
        return send(res, 400, {
          error: 'Укажите почту и пароль допустимой длины',
        });

      const ip = req.socket.remoteAddress;
      for (const [key, entry] of loginAttempts)
        if (entry.until <= Date.now()) loginAttempts.delete(key);
      const limit = loginAttempts.get(ip);
      if (limit?.count >= 8)
        return send(
          res,
          429,
          {
            error: 'Слишком много неудачных попыток. Повторите вход через минуту.',
          },
          {
            'Retry-After': String(Math.max(1, Math.ceil((limit.until - Date.now()) / 1000))),
          },
        );

      const user = db.users.find(
        (item) =>
          item.email ===
          String(email || '')
            .toLowerCase()
            .trim(),
      );
      if (route === '/api/demo/login') {
        if (!demoAllowed(req)) return send(res, 403, { error: 'Демонстрационный вход отключён' });
        if (!user || !users.some((item) => item.id === user.id && item.email === user.email))
          return send(res, 401, { error: 'Неизвестная демонстрационная роль' });
      } else {
        const matches = valid(password, user?.pass || dummyHash);
        if (!user || !matches) {
          loginAttempts.set(ip, {
            count: (limit?.count || 0) + 1,
            until: limit?.until || Date.now() + 60000,
          });
          return send(res, 401, {
            error: 'Неверная почта или пароль',
            code: 'INVALID_CREDENTIALS',
          });
        }
      }

      loginAttempts.delete(ip);
      const session = sessions.create(
        user.id,
        route === '/api/demo/login' ? 'demo' : 'password',
        cookie(req),
      );
      return send(
        res,
        200,
        {
          user: publicUser(user),
          session: { mode: session.mode, expiresAt: session.expiresAt },
        },
        { 'Set-Cookie': sessionCookie(session.token, 28800) },
      );
    }

    if (route === '/api/logout' && method === 'POST') {
      sessions.remove(cookie(req));
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    const user = authenticate(req, res);
    if (!user) return;

    if (route === '/api/integrations' && method === 'GET') {
      if (user.role !== 'hr')
        return send(res, 403, {
          error: 'Только HR может просматривать интеграции',
        });
      return send(res, 200, integrations.summary());
    }

    if (route === '/api/integrations/connections' && method === 'POST') {
      if (user.role !== 'hr')
        return send(res, 403, {
          error: 'Только HR может изменять подключения',
        });
      try {
        const connection = integrations.configure(await parse(req), user.id);
        save();
        return send(res, 200, { connection });
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
    }

    if (route === '/api/integrations/one-c/sync' && method === 'POST') {
      if (user.role !== 'hr')
        return send(res, 403, {
          error: 'Только HR может запускать синхронизацию',
        });
      const result = integrations.personnelProvider.sync(user.id);
      save();
      return send(res, 200, result);
    }

    const workflow = route.match(/^\/api\/integrations\/documentolog\/([^/]+)$/);
    if (workflow && method === 'GET') {
      const request = db.requests.find((item) => item.id === workflow[1]);
      if (!request || !viewerCanSee(request, user))
        return send(res, 404, { error: 'Документ не найден' });
      return send(res, 200, {
        mode: 'mock',
        document: integrations.workflowAdapter.getStatus(request.externalId),
      });
    }

    if (workflow && method === 'POST') {
      if (user.role !== 'hr')
        return send(res, 403, {
          error: 'Повторная отправка доступна только HR',
        });
      const request = db.requests.find((item) => item.id === workflow[1]);
      if (!request) return send(res, 404, { error: 'Заявка не найдена' });
      const document = integrations.workflowAdapter.submitLeave(request, user.id);
      request.externalId = document.externalId;
      save();
      return send(res, 200, { mode: 'mock', document });
    }

    if (route === '/api/me' && method === 'GET') {
      const session = sessions.get(cookie(req));
      return send(res, 200, {
        user: publicUser(user),
        session: { mode: session.mode, expiresAt: session.expiresAt },
        stats: {
          teamCount:
            user.role === 'hr'
              ? db.users.length
              : user.role === 'manager'
                ? db.users.filter((item) => item.managerId === user.id).length
                : 0,
          requests: db.requests.filter((request) => request.ownerId === user.id).length,
          pending: db.requests.filter(
            (request) =>
              (request.ownerId === user.id && ['pending', 'hr_pending'].includes(request.status)) ||
              canDecide(request, user),
          ).length,
          completed: userProgress(user.id).filter((progress) => progress.completed).length,
        },
      });
    }

    if (route === '/api/team' && method === 'GET') {
      if (user.role === 'employee') return send(res, 403, { error: 'Недостаточно прав' });
      const members =
        user.role === 'hr' ? db.users : db.users.filter((member) => member.managerId === user.id);
      return send(res, 200, { members: members.map(publicUser) });
    }

    if (route === '/api/requests' && method === 'GET')
      return send(res, 200, {
        requests: db.requests
          .filter((request) => viewerCanSee(request, user))
          .map((request) => ({
            ...request,
            ownerName: db.users.find((item) => item.id === request.ownerId)?.name,
            canDecide: canDecide(request, user),
          }))
          .sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
      });

    if (route === '/api/requests' && method === 'POST') {
      const body = await parse(req);
      if (!validDate(body.start) || !validDate(body.end))
        return send(res, 400, {
          error: 'Укажите существующие календарные даты',
        });

      const duration = days(body.start, body.end);
      if (
        body.type !== 'leave' ||
        !Number.isFinite(duration) ||
        duration < 1 ||
        duration > user.leaveDays ||
        duration > 60 ||
        body.start < new Date().toISOString().slice(0, 10)
      )
        return send(res, 400, {
          error: 'Проверьте даты и доступный остаток отпуска',
        });

      if (
        db.requests.some(
          (request) =>
            request.ownerId === user.id &&
            ['pending', 'hr_pending', 'approved'].includes(request.status) &&
            request.start <= body.end &&
            request.end >= body.start,
        )
      )
        return send(res, 409, {
          error: 'Этот период пересекается с действующей заявкой',
        });

      const at = new Date().toISOString();
      const request = {
        id: crypto.randomUUID(),
        ownerId: user.id,
        type: 'leave',
        start: body.start,
        end: body.end,
        note: String(body.note || '').slice(0, 500),
        status: 'pending',
        createdAt: at,
        history: [{ status: 'pending', at, actor: user.id }],
      };
      request.externalId = integrations.workflowAdapter.submitLeave(request, user.id).externalId;
      db.requests.unshift(request);
      notify(user.id, 'Заявка на отпуск отправлена на согласование', {
        page: 'requests',
        id: request.id,
      });
      if (user.managerId)
        notify(user.managerId, `${user.name}: новая заявка на отпуск`, {
          page: 'requests',
          id: request.id,
        });
      save();
      return send(res, 201, { request });
    }

    const decision = route.match(/^\/api\/requests\/([^/]+)\/decision$/);
    if (decision && method === 'POST') {
      const request = db.requests.find((item) => item.id === decision[1]);
      if (!request) return send(res, 404, { error: 'Заявка не найдена' });
      if (!canDecide(request, user))
        return send(res, 403, { error: 'Нет права согласовать эту заявку' });

      const body = await parse(req);
      if (!['approved', 'rejected'].includes(body.status))
        return send(res, 400, { error: 'Недопустимый статус' });

      const managerApproval = request.status === 'pending' && body.status === 'approved';
      const nextStatus = managerApproval ? 'hr_pending' : body.status;
      if (!managerApproval)
        integrations.workflowAdapter.decide(request.externalId, body.status, user.id);
      request.status = nextStatus;
      request.history.push({
        status: nextStatus,
        at: new Date().toISOString(),
        actor: user.id,
      });
      if (managerApproval) {
        const owner = db.users.find((item) => item.id === request.ownerId);
        notify(
          request.ownerId,
          'Руководитель согласовал заявку. Она передана HR на окончательное рассмотрение.',
          { page: 'requests', id: request.id },
        );
        for (const hrUser of db.users.filter((item) => item.role === 'hr'))
          notify(hrUser.id, `${owner.name}: заявка ожидает согласования HR`, {
            page: 'requests',
            id: request.id,
          });
      } else {
        notify(
          request.ownerId,
          `Ваша заявка ${body.status === 'approved' ? 'согласована' : 'отклонена'}: ${request.start} — ${request.end}`,
          { page: 'requests', id: request.id },
        );
      }
      save();
      return send(res, 200, { request });
    }

    if (route === '/api/notifications' && method === 'GET')
      return send(res, 200, {
        notifications: db.notifications
          .filter((notification) => notification.userId === user.id)
          .sort((first, second) => second.at.localeCompare(first.at)),
      });

    const noteRead = route.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (noteRead && method === 'POST') {
      const notification = db.notifications.find(
        (item) => item.id === noteRead[1] && item.userId === user.id,
      );
      if (!notification) return send(res, 404, { error: 'Уведомление не найдено' });
      notification.read = true;
      save();
      return send(res, 200, { ok: true });
    }

    if (route === '/api/notifications/read' && method === 'POST') {
      for (const notification of db.notifications)
        if (notification.userId === user.id) notification.read = true;
      save();
      return send(res, 200, { ok: true });
    }

    if (route === '/api/learning' && method === 'GET') {
      if (!['hr', 'manager'].includes(user.role))
        return send(res, 403, { error: 'Недостаточно прав' });
      const members =
        user.role === 'hr' ? db.users : db.users.filter((item) => item.managerId === user.id);
      const memberIds = new Set(members.map((member) => member.id));
      const rows = db.assignments
        .filter((assignment) => memberIds.has(assignment.userId))
        .map((assignment) => {
          const member = members.find((item) => item.id === assignment.userId);
          const course = courses.find((item) => item.id === assignment.courseId);
          const progress = db.progress.find(
            (item) => item.userId === assignment.userId && item.courseId === assignment.courseId,
          );
          const assignedAt = assignment.assignedAt;
          const dueDate =
            assignment.dueDate ||
            new Date(new Date(assignedAt).getTime() + 30 * 86400000).toISOString().slice(0, 10);
          return {
            userId: member.id,
            userName: member.name,
            title: member.title,
            department: member.department,
            courseId: course.id,
            courseTitle: course.title,
            status: progress?.completed
              ? 'completed'
              : progress?.read
                ? 'in_progress'
                : 'not_started',
            progress: progress?.completed ? 100 : progress?.read ? 50 : 0,
            assignedAt,
            dueDate,
            completedAt: progress?.at || null,
          };
        });
      const courseStats = courses.map((course) => {
        const assignments = rows.filter((row) => row.courseId === course.id);
        const completed = assignments.filter((row) => row.status === 'completed').length;
        const inProgress = assignments.filter((row) => row.status === 'in_progress').length;
        const notStarted = assignments.filter((row) => row.status === 'not_started').length;
        return {
          id: course.id,
          title: course.title,
          category: course.category,
          assigned: assignments.length,
          completed,
          inProgress,
          notStarted,
          completionRate: assignments.length
            ? Math.round((completed / assignments.length) * 100)
            : 0,
        };
      });
      return send(res, 200, { courses: courseStats, rows });
    }

    if (route === '/api/courses' && method === 'GET')
      return send(res, 200, {
        courses: courses
          .filter((course) => assigned(user.id, course.id))
          .map((course) => {
            const { correct, ...publicCourse } = course;
            const progress = userProgress(user.id).find((item) => item.courseId === course.id);
            return {
              ...publicCourse,
              progress: progress?.completed ? 100 : progress?.read ? 50 : 0,
              completed: !!progress?.completed,
            };
          }),
      });

    if (route === '/api/assignments' && method === 'POST') {
      if (!['hr', 'manager'].includes(user.role))
        return send(res, 403, { error: 'Недостаточно прав' });
      const body = await parse(req);
      const course = courses.find((item) => item.id === body.courseId);
      const userIds =
        body.userIds === undefined
          ? [body.userId]
          : Array.isArray(body.userIds)
            ? body.userIds
            : [];
      if (
        !course ||
        !userIds.length ||
        userIds.length > 100 ||
        userIds.some((id) => typeof id !== 'string') ||
        new Set(userIds).size !== userIds.length ||
        userIds.some((id) => !db.users.some((item) => item.id === id))
      )
        return send(res, 400, { error: 'Выберите курс и хотя бы одного сотрудника' });
      if (
        body.dueDate !== undefined &&
        body.dueDate !== null &&
        (!validDate(body.dueDate) || body.dueDate < new Date().toISOString().slice(0, 10))
      )
        return send(res, 400, { error: 'Срок должен быть сегодняшней или будущей датой' });
      if (
        user.role === 'manager' &&
        userIds.some((id) => !db.users.some((item) => item.id === id && item.managerId === user.id))
      )
        return send(res, 403, {
          error: 'Можно назначать обучение только своей команде',
        });
      const existingAssignments = userIds.filter((id) => assigned(id, body.courseId));
      if (existingAssignments.length && body.restart !== true)
        return send(res, 409, {
          error: 'Подтвердите повторное назначение курса сотрудникам с сохранённым прогрессом',
          userIds: existingAssignments,
        });

      const assignedAt = new Date().toISOString();
      for (const userId of userIds) {
        const assignment = db.assignments.find(
          (item) => item.userId === userId && item.courseId === body.courseId,
        );
        if (assignment) {
          assignment.assignedAt = assignedAt;
          if (body.dueDate) assignment.dueDate = body.dueDate;
          else delete assignment.dueDate;
          const progress = db.progress.find(
            (item) => item.userId === userId && item.courseId === body.courseId,
          );
          if (progress) {
            progress.read = false;
            progress.completed = false;
            delete progress.at;
          }
        } else {
          db.assignments.push({
            userId,
            courseId: body.courseId,
            assignedAt,
            ...(body.dueDate ? { dueDate: body.dueDate } : {}),
          });
        }
        notify(
          userId,
          `Вам ${existingAssignments.includes(userId) ? 'повторно ' : ''}назначен курс «${course.title}»`,
          {
            page: 'academy',
            id: course.id,
          },
        );
      }
      save();
      return send(res, 201, { ok: true, assigned: userIds.length });
    }

    if (route === '/api/catalog' && method === 'GET') {
      if (!['hr', 'manager'].includes(user.role))
        return send(res, 403, { error: 'Недостаточно прав' });
      return send(res, 200, {
        courses: courses.map(({ id, title }) => ({ id, title })),
        assignments: db.assignments.filter(
          (assignment) =>
            user.role === 'hr' ||
            db.users.some(
              (member) => member.id === assignment.userId && member.managerId === user.id,
            ),
        ),
      });
    }

    const reading = route.match(/^\/api\/courses\/([^/]+)\/read$/);
    if (reading && method === 'POST') {
      if (!assigned(user.id, reading[1])) return send(res, 403, { error: 'Курс не назначен' });
      let progress = db.progress.find(
        (item) => item.userId === user.id && item.courseId === reading[1],
      );
      if (!progress) {
        progress = { userId: user.id, courseId: reading[1], completed: false };
        db.progress.push(progress);
      }
      progress.read = true;
      save();
      return send(res, 200, { ok: true });
    }

    const courseCompletion = route.match(/^\/api\/courses\/([^/]+)\/complete$/);
    if (courseCompletion && method === 'POST') {
      const course = courses.find((item) => item.id === courseCompletion[1]);
      if (!course) return send(res, 404, { error: 'Курс не найден' });
      if (!assigned(user.id, course.id)) return send(res, 403, { error: 'Курс не назначен' });
      const progress = db.progress.find(
        (item) => item.userId === user.id && item.courseId === course.id,
      );
      if (!progress?.read) return send(res, 400, { error: 'Сначала изучите материал' });

      const body = await parse(req);
      if (body.answer !== course.correct)
        return send(res, 400, { error: 'Неверный ответ. Попробуйте ещё раз.' });
      if (!progress.completed) {
        Object.assign(progress, {
          completed: true,
          at: new Date().toISOString(),
        });
        notify(user.id, `Курс «${course.title}» успешно завершён`, {
          page: 'academy',
          id: course.id,
        });
        save();
      }
      return send(res, 200, { ok: true });
    }

    if (route === '/api/ai/status' && method === 'GET') return send(res, 200, assistant.status());

    if (route === '/api/ai' && method === 'POST') {
      const body = await parse(req);
      const question = String(body.question || '').trim();
      if (question.length < 3 || question.length > 500)
        return send(res, 400, { error: 'Введите вопрос от 3 до 500 символов' });
      if (aiBusy.has(user.id))
        return send(res, 429, {
          error: 'Дождитесь предыдущего ответа AI Jana',
        });

      aiBusy.add(user.id);
      try {
        return send(res, 200, await assistant.answer(question, user.role));
      } finally {
        aiBusy.delete(user.id);
      }
    }

    if (route === '/api/knowledge' && method === 'GET')
      return send(res, 200, {
        documents: visibleDocuments(knowledgeBase, user.role).map(
          ({ id, title, body, section, version }) => ({
            id,
            title,
            body,
            section,
            version,
          }),
        ),
      });

    return send(res, 404, { error: 'Маршрут не найден' });
  }

  return api;
}

module.exports = { createApi, send, days };
