function academy() {
  const courseCards = data.courses
    .map((course) =>
      [
        '<article class="coursecard"><div class="flex">',
        `<div class="courseicon">${icon('book')}</div>`,
        `<span class="chip ${course.completed ? 'approved' : ''}">${course.completed ? 'Завершён' : 'Назначен'}</span>`,
        '</div>',
        `<p class="eyebrow" style="margin-top:22px">${esc(course.category)} · ${esc(course.duration)}</p>`,
        `<h2>${esc(course.title)}</h2><p class="muted">${esc(course.summary)}</p>`,
        `<div class="flex"><span class="small muted">Прогресс</span><b>${course.progress}%</b></div>`,
        `<div class="progress"><div style="width:${course.progress}%"></div></div>`,
        `<button class="arrow-button" data-course="${course.id}" aria-label="Открыть курс">${icon('arrow')}</button>`,
        '</article>',
      ].join(''),
    )
    .join('');

  return [
    heading('Моё обучение', 'Курсы Jana Academy и ваш прогресс.'),
    `<div class="coursegrid">${courseCards}</div>`,
  ].join('');
}

function learningOverview() {
  const summaries = data.learning.courses
    .map((course) => {
      const completedWidth = course.assigned ? (course.completed / course.assigned) * 100 : 0;
      const inProgressWidth = course.assigned ? (course.inProgress / course.assigned) * 100 : 0;
      return `
        <article class="learning-course-card">
          <div class="learning-course-topline"><span>${esc(course.category)}</span><span>${course.assigned} назначений</span></div>
          <h3>${esc(course.title)}</h3>
          <div class="learning-card-body">
            <div class="learning-ring" style="--completion:${course.completionRate * 3.6}deg" aria-label="${course.completionRate}% завершили курс">
              <span><strong>${course.completionRate}%</strong><small>готово</small></span>
            </div>
            <div class="learning-breakdown">
              <span><i class="is-completed"></i>Завершили <b>${course.completed}</b></span>
              <span><i class="is-active"></i>В процессе <b>${course.inProgress}</b></span>
              <span><i class="is-not-started"></i>Не начали <b>${course.notStarted}</b></span>
            </div>
          </div>
          <div class="learning-card-actions">
            <button class="soft-button" data-course-filter="${esc(course.id)}">Смотреть прогресс</button>
            <button class="learning-assign-icon" data-assign-course data-course-id="${esc(course.id)}" aria-label="Назначить курс «${esc(course.title)}»">+</button>
          </div>
        </article>
      `;
    })
    .join('');
  const departments = [...new Set(data.learning.rows.map((row) => row.department))].sort();
  const courseOptions = data.learning.courses
    .map((course) => `<option value="${esc(course.id)}">${esc(course.title)}</option>`)
    .join('');
  const departmentOptions = departments
    .map((department) => `<option value="${esc(department)}">${esc(department)}</option>`)
    .join('');
  const rows = data.learning.rows
    .map(
      (row) => `
        <tr data-learning-row data-course="${esc(row.courseId)}" data-status="${esc(row.status)}" data-department="${esc(row.department)}">
          <td><b>${esc(row.userName)}</b><div class="muted small">${esc(row.title)}</div></td>
          <td>${esc(row.courseTitle)}</td>
          <td><span class="learning-status ${esc(row.status)}">${learningStatusLabel(row.status)}</span></td>
          <td><div class="learning-progress"><span style="width:${row.progress}%"></span></div><small>${row.progress}%</small></td>
          <td>${new Date(row.dueDate + 'T00:00:00').toLocaleDateString(uiLocale())}</td>
          <td>${row.completedAt ? new Date(row.completedAt).toLocaleDateString(uiLocale()) : '—'}</td>
        </tr>
      `,
    )
    .join('');

  return [
    '<div class="learning-page">',
    heading(
      'Обучение сотрудников',
      'Курсы Jana Academy: назначения и прогресс каждого сотрудника.',
      '<button class="primary learning-primary-action" id="assign-course">+ <span>Назначить курс</span></button>',
    ),
    `<section class="learning-course-grid">${summaries}</section>`,
    '<section class="learning-progress-section"><h2>Прогресс по сотрудникам</h2>',
    '<div class="learning-filters">',
    `<select class="input" id="learning-course-filter" aria-label="Фильтр по курсу"><option value="">Все курсы</option>${courseOptions}</select>`,
    '<select class="input" id="learning-status-filter" aria-label="Фильтр по статусу"><option value="">Все статусы</option><option value="completed">Завершён</option><option value="in_progress">В процессе</option><option value="not_started">Не начат</option></select>',
    `<select class="input" id="learning-department-filter" aria-label="Фильтр по подразделению"><option value="">Все подразделения</option>${departmentOptions}</select>`,
    '</div>',
    `<div class="tablewrap card learning-table-wrap"><table class="table"><thead><tr><th>Сотрудник</th><th>Курс</th><th>Статус</th><th>Прогресс</th><th>Срок</th><th>Завершён</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Назначений пока нет.</td></tr>'}</tbody></table></div>`,
    '</section>',
    '</div>',
  ].join('');
}

function learningStatusLabel(value) {
  return { completed: 'Завершён', in_progress: 'В процессе', not_started: 'Не начат' }[value];
}

function ai() {
  const messages = chat
    .map((message) => {
      const modeLabel = message.mode
        ? message.mode === 'groq'
          ? 'Groq · LLM'
          : message.mode === 'local'
            ? 'Локальный поиск'
            : 'Нет подтверждённого ответа'
        : '';
      const sources = (message.sources || (message.source ? [message.source] : []))
        .map(
          (source) =>
            `<button class="ghost mini source" data-source="${esc(source.id)}">Источник: ${esc(source.title)} ↗</button>`,
        )
        .join('');

      return [
        `<div class="bubble ${message.who === 'user' ? 'user' : 'bot'}">`,
        message.who === 'user'
          ? ''
          : `<span class="bubble-author">${icon('assistant')}<b>AI Jana</b></span>`,
        esc(message.text),
        message.notice ? `<div class="hint ai-notice">${esc(message.notice)}</div>` : '',
        modeLabel ? `<div class="hint ai-mode">${modeLabel}</div>` : '',
        sources,
        '</div>',
      ].join('');
    })
    .join('');
  const typingIndicator = asking
    ? '<div class="bubble ai-typing" role="status">Ищу ответ по документам…</div>'
    : '';
  const providerStatus = data.aiStatus?.configured ? 'Groq настроен' : 'Локальный поиск';

  return [
    '<div class="ai-page">',
    `<div class="ai-guidance">${icon('library')}<span>Оригинальные HR-документы и ответы AI отображаются на языке источника.</span></div>`,
    '<div class="card chat"><div class="ai-header">',
    '<div class="ai-identity">',
    `<span class="ai-emblem">${icon('assistant')}</span>`,
    '<div><h3>AI Jana</h3><small>Помощь по HR-документам</small></div>',
    `</div><span class="chip approved ai-status"><span></span>${providerStatus}</span></div>`,
    `<div class="messages" id="messages" role="log" aria-live="polite" aria-label="Диалог с AI Jana">${messages}${typingIndicator}</div>`,
    '<form id="ask-form" class="chatbox">',
    '<input class="input" id="question" aria-label="Вопрос AI Jana" minlength="3" maxlength="500" required placeholder="Например: как оформить отпуск?">',
    `<button class="primary" ${asking ? 'disabled' : ''}>${asking ? 'Ожидайте…' : `Отправить ${icon('arrow')}`}</button>`,
    '</form>',
    '<details class="ai-details"><summary>Как формируется ответ</summary>',
    '<div class="hint">Тестовые HR-документы. Groq выбирает цитаты, сервер сверяет их с источниками. ',
    'При сбое API включается локальный поиск. В облако передаются вопрос и фрагменты документов — ',
    'не вводите реальные персональные данные.</div>',
    '</details></div>',
    '<div class="actions ai-prompts">',
    '<button class="ghost mini" data-ask="Как оформить отпуск?">Как оформить отпуск?</button>',
    '<button class="ghost mini" data-ask="Как согласовать заявку?">Как согласовать?</button>',
    '<button class="ghost mini" data-ask="Где пройти обучение?">Как пройти обучение?</button>',
    '</div>',
    '</div>',
  ].join('');
}
