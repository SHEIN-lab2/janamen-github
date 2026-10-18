function dashboard() {
  const mine = data.requests.filter((request) => request.ownerId === user.id);
  const queue = data.requests.filter((request) => request.canDecide);
  const pending = mine.filter((request) => ['pending', 'hr_pending'].includes(request.status));
  const unfinished = data.courses.filter((course) => !course.completed);
  const unread = data.notifications.filter((notification) => !notification.read);
  const isLead = user.role !== 'employee';
  const headline =
    user.role === 'hr'
      ? 'HR'
      : user.role === 'manager'
        ? 'Руководитель IT отдела'
        : 'Ваш рабочий день';
  let priority;
  if (queue.length) {
    priority = {
      title: `На согласовании: ${queue.length}`,
      body: 'Откройте заявку, проверьте даты и примите решение.',
      attrs: `data-request="${esc(queue[0].id)}"`,
      action: 'Рассмотреть заявку',
    };
  } else if (unfinished.length) {
    priority = {
      title: 'Продолжите своё обучение',
      body: unfinished[0].title,
      attrs: `data-course="${esc(unfinished[0].id)}"`,
      action: unfinished[0].progress ? 'Продолжить курс' : 'Открыть курс',
    };
  } else {
    priority = {
      title: 'Срочных действий нет',
      body: 'Проверьте свои заявки или задайте вопрос AI Jana.',
      attrs: 'data-nav="ai"',
      action: 'Спросить AI Jana',
    };
  }

  const stat = (label, value, attrs) =>
    [
      '<article class="stat stat-action">',
      `<small>${label}</small>`,
      `<strong>${value}</strong>`,
      `<button class="arrow-button stat-arrow" ${attrs} aria-label="${label}">${icon('arrow')}</button>`,
      '</article>',
    ].join('');
  const requestCard = (request) =>
    [
      '<article class="request-preview">',
      `<span class="preview-symbol">${icon('file')}</span>`,
      '<span class="preview-text">',
      `<strong>${request.ownerId === user.id ? 'Мой отпуск' : esc(request.ownerName)}</strong>`,
      `<small>${dateLabel(request.start)} — ${dateLabel(request.end)}</small>`,
      '</span>',
      `<span class="chip ${request.status}">${status[request.status]}</span>`,
      `<button class="arrow-button" data-request="${esc(request.id)}" aria-label="Открыть заявку">${icon('arrow')}</button>`,
      '</article>',
    ].join('');
  const coursePreview = (course) =>
    [
      '<article class="learning-preview">',
      `<span class="eyebrow">${course.completed ? 'Завершено' : course.progress ? 'В процессе' : 'Назначено'}</span>`,
      `<strong>${esc(course.title)}</strong>`,
      `<span class="learning-meta">${esc(course.duration)} <b>${course.progress}%</b></span>`,
      `<span class="progress"><span style="width:${course.progress}%"></span></span>`,
      `<button class="arrow-button course-arrow" data-course="${esc(course.id)}" aria-label="Открыть курс">${icon('arrow')}</button>`,
      '</article>',
    ].join('');
  const visibleRecent = (isLead ? data.requests : mine).slice(0, 4);
  const completedCourses = data.courses.filter((course) => course.completed).length;
  const dashboardStats = [
    stat('Доступно отпуска', user.leaveDays + ' <span>дн.</span>', 'data-nav="profile"'),
    isLead
      ? stat(
          'Ждут вашего решения',
          employeeCount(new Set(queue.map((request) => request.ownerId)).size),
          'data-nav="requests"',
        )
      : stat('Мои заявки в работе', pending.length, 'data-nav="requests"'),
    isLead
      ? stat('Моя команда', employeeCount(data.stats.teamCount), 'data-nav="team"')
      : stat('Заявки', mine.length, 'data-nav="requests"'),
    stat(
      'Моё обучение',
      `${completedCourses}<span> / ${data.courses.length}</span><small class="stat-caption">заданий выполнено</small>`,
      'data-nav="academy"',
    ),
  ].join('');
  const recentRequests = visibleRecent.length
    ? visibleRecent.map(requestCard).join('')
    : '<div class="empty">Заявок пока нет. Подайте первую через быстрое действие выше.</div>';
  const approvalQueue = isLead
    ? [
        '<section class="card"><div class="section-title"><h3>Очередь согласования</h3>',
        `<span class="chip">${queue.length}</span></div>`,
        queue.length
          ? queue.slice(0, 3).map(requestCard).join('')
          : '<div class="calm-state">Всё рассмотрено. Новые заявки появятся здесь.</div>',
        '</section>',
      ].join('')
    : '';
  const learning = data.courses.length
    ? data.courses.map(coursePreview).join('')
    : '<div class="calm-state">Назначенных курсов пока нет.</div>';
  const recentNotifications =
    data.notifications
      .slice(0, 3)
      .map((notification) => notificationCard(notification, true))
      .join('') || '<div class="calm-state">Уведомлений пока нет</div>';
  const unreadBadge = unread.length ? `<span class="chip">${unread.length}</span>` : '';
  const today = new Date().toLocaleDateString(uiLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const firstName = esc(user.name.split(' ')[0]);
  const greeting = isLead
    ? 'Решения и события — в одном месте.'
    : 'Заявки, развитие и поддержка — под рукой.';
  const priorityLabel = queue.length ? 'Требует внимания' : 'Следующий шаг';
  const recentRequestsTitle = isLead ? 'Последние доступные заявки' : 'Мои последние заявки';

  return [
    '<div class="dashboard-heading"><div>',
    `<div class="eyebrow">${today}</div>`,
    `<h1>${headline}</h1>`,
    `<p>Привет, ${firstName}. ${greeting}</p>`,
    '</div></div>',
    `<div class="dashboard-stats">${dashboardStats}</div>`,
    '<div class="dashboard-columns"><div class="dashboard-primary">',
    '<section class="priority-card">',
    `<div class="eyebrow">${priorityLabel}</div>`,
    `<h2>${priority.title}</h2><p>${esc(priority.body)}</p>`,
    `<button class="primary" ${priority.attrs}>${priority.action} ${icon('arrow')}</button>`,
    '</section>',
    '<section class="card quick-section"><h3>Быстрые действия</h3><div class="quick-actions">',
    `<button id="new-request">${icon('file')}<strong>Подать заявление</strong><small>Отпуск и его статус</small></button>`,
    `<button data-nav="ai">${icon('assistant')}<strong>Спросить AI Jana</strong><small>Ответы с источниками</small></button>`,
    `<button data-nav="academy">${icon('book')}<strong>Обучение</strong><small>Мои курсы</small></button>`,
    '</div></section>',
    '<section class="card"><div class="section-title">',
    `<h3>${recentRequestsTitle}</h3>`,
    '<div class="section-link"><span>Все заявки</span>',
    `<button class="arrow-button" data-nav="requests" aria-label="Все заявки">${icon('arrow')}</button></div>`,
    `</div>${recentRequests}</section>`,
    approvalQueue,
    '</div>',
    '<aside class="dashboard-secondary" aria-label="Обучение и помощь">',
    `<section class="card"><div class="section-title"><h3>Моё обучение</h3></div>${learning}</section>`,
    `<section class="card"><div class="section-title"><h3>Последние уведомления</h3>${unreadBadge}</div>${recentNotifications}</section>`,
    '<section class="card"><div class="section-title"><h3>База знаний</h3>',
    `<button class="arrow-button" data-nav="knowledge" aria-label="Открыть базу знаний">${icon('arrow')}</button>`,
    '</div><p class="muted small">Правила, инструкции и ответы на вопросы HR.</p></section>',
    '<section class="help-card"><span class="eyebrow">AI Jana</span><h3>Нужна подсказка?</h3>',
    '<p>Узнайте, как оформить отпуск или пройти курс.</p>',
    `<button class="ghost" data-nav="ai">Задать вопрос ${icon('arrow')}</button></section>`,
    '</aside></div>',
  ].join('');
}
