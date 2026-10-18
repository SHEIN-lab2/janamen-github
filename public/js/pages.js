function requests() {
  const sectionTitle = user.role === 'employee' ? 'Мои заявления' : 'Заявки, доступные вашей роли';
  const pageHeading = heading(
    requestTitle(),
    'Подавайте заявления и отслеживайте их движение.',
    '<button class="primary" id="new-request">+ Моя заявка</button>',
  );
  const requestCard = `
    <div class="card">
      <h3>${sectionTitle}</h3>
      ${requestRows(data.requests)}
    </div>
  `;
  const demoNote = `
    <p class="section-note small">
      Заявки на отпуск проходят два этапа: согласование руководителем и окончательное решение HR.
      Официальные кадровые данные неизменяемы.
    </p>
  `;

  return `
    ${pageHeading}
    ${requestCard}
    ${demoNote}
  `;
}

function profile() {
  const leadTitle =
    user.title === 'Руководитель отдела' ? `Руководитель отдела ${user.department}` : user.title;
  const managerField =
    user.role === 'manager' && (!user.managerName || user.managerName === '—')
      ? ['Роль в подразделении', leadTitle]
      : ['Руководитель', user.managerName === '—' ? 'Не назначен' : user.managerName];
  const profileFields = [
    ['Ф.И.О.', user.name],
    ['Электронная почта', user.email],
    ['Компания', 'Jana Demo Company'],
    ['Должность', leadTitle],
    ['Подразделение', user.department],
    managerField,
    ['Дата приёма', user.hired],
    ['Остаток отпуска', user.leaveDays + ' дней'],
  ]
    .map(
      ([label, value]) =>
        `<div class="info"><small>${label}</small><strong>${esc(value)}</strong></div>`,
    )
    .join('');
  const departmentLabel = user.title === 'Руководитель отдела' ? '' : ' · ' + esc(user.department);
  const learningCourses = (data.courses || [])
    .map((course) => {
      const progressLabel = course.completed ? 'Завершён' : `Прогресс: ${course.progress}%`;

      return `
        <li class="profile-course">
          <div class="profile-course-heading">
            <strong>${esc(course.title)}</strong>
            <span class="muted small">${progressLabel}</span>
          </div>
          <div class="progress" role="progressbar" aria-label="${esc(course.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${course.progress}">
            <div style="width:${course.progress}%"></div>
          </div>
        </li>
      `;
    })
    .join('');

  return [
    heading('Мой профиль', 'Официальные данные доступны только для просмотра.'),
    '<div class="card"><div class="flex" style="justify-content:flex-start;gap:17px">',
    `<div class="avatar" style="width:68px;height:68px;font-size:27px">${catAvatar(user)}</div>`,
    '<div>',
    `<h2 style="margin:0">${esc(user.name)}</h2>`,
    `<p class="muted">${esc(leadTitle)}${departmentLabel}</p>`,
    user.role === 'manager' ? '' : `<span class="chip">${role[user.role]}</span>`,
    '</div></div></div>',
    `<div class="card"><h3>Данные сотрудника</h3><div class="profile-grid">${profileFields}</div></div>`,
    '<div class="card"><h3>Обучение</h3>',
    learningCourses
      ? `<ul class="profile-course-list">${learningCourses}</ul>`
      : '<p class="muted">Назначенных курсов пока нет.</p>',
    '</div>',
  ].join('');
}

function team() {
  const memberRows = data.members
    .map((member) => {
      const details = `${esc(member.title)} · ${esc(member.department)}`;

      return `
        <div class="rowlist flex">
          <div class="member-identity">
            ${catAvatar(member)}
            <div>
              <b>${esc(member.name)}</b>
              <div class="muted small">${details}</div>
            </div>
          </div>
          <span class="chip">${role[member.role]}</span>
        </div>
      `;
    })
    .join('');
  const memberList = memberRows || '<div class="empty">Нет сотрудников в подчинении</div>';

  return [
    heading('Моя команда', 'Список сотрудников в пределах вашей роли.'),
    `<div class="card">${memberList}</div>`,
    '<p class="section-note">Руководителю доступны только его прямые подчинённые. HR видит всех демонстрационных пользователей.</p>',
  ].join('');
}

function knowledge() {
  const documents = data.documents
    .map((document) =>
      [
        '<article class="card">',
        `<p class="eyebrow">${esc(document.section)} · v${esc(document.version)}</p>`,
        `<h3>${esc(document.title)}</h3>`,
        `<p class="muted small">${esc(document.body.slice(0, 130))}…</p>`,
        `<button class="ghost source-link" data-source="${esc(document.id)}">Открыть источник ${icon('arrow')}</button>`,
        '</article>',
      ].join(''),
    )
    .join('');

  return [
    heading(
      'База знаний',
      'Демонстрационные документы, доступные вашей роли. Это правила прототипа, а не нормативные акты.',
    ),
    `<div class="coursegrid">${documents}</div>`,
  ].join('');
}

function integrationsPage() {
  const integrations = data.integrations;
  const connectionRows =
    (integrations.connections || [])
      .map((connection) =>
        [
          '<div class="rowlist flex"><div>',
          `<b>${esc(connection.name)}</b>`,
          `<p class="small muted">${esc(connection.system)} · ${esc(connection.endpoint)}</p>`,
          '<span class="chip">Ожидает реализации API-адаптера</span>',
          `</div><button class="ghost mini" data-connection="${esc(connection.system)}">Изменить</button></div>`,
        ].join(''),
      )
      .join('') || '<p class="muted">Подключения ещё не добавлены.</p>';
  const lastPersonnelSync = integrations.lastPersonnelSync
    ? new Date(integrations.lastPersonnelSync).toLocaleString(uiLocale())
    : 'Ещё не было';
  const documentRows = integrations.documents
    .map((document) =>
      [
        '<tr>',
        `<td class="small">${esc(document.externalId)}</td>`,
        `<td><span class="chip ${document.status}">${status[document.status]}</span></td>`,
        `<td>${document.version}</td>`,
        `<td><button class="ghost mini" data-resubmit="${esc(document.requestId)}">Отправить повторно</button></td>`,
        '</tr>',
      ].join(''),
    )
    .join('');
  const eventRows =
    integrations.events
      .slice(0, 30)
      .map((event) => {
        const occurredAt = new Date(event.at).toLocaleString(uiLocale());
        const reference = event.externalId || 'кадровый справочник';
        const summary = `${occurredAt} · ${esc(reference)} · ${esc(event.actorId)}`;

        return `
          <div class="rowlist">
            <b>${esc(event.system)} · ${esc(event.operation)}</b>
            <div class="muted small">${summary}</div>
          </div>
        `;
      })
      .join('') || '<p>Вызовов пока нет</p>';

  return [
    heading(
      'Интеграции',
      'Настройте подключения к кадровой системе и документообороту.',
      '<button class="primary" id="add-connection">+ Добавить подключение</button>',
    ),
    '<section class="card"><h3>Подключения</h3>',
    '<p class="muted">Сейчас обмен работает в деморежиме. Сохранённые параметры не включают внешний API.</p>',
    connectionRows,
    '</section>',
    '<div class="grid2">',
    '<section class="card"><span class="chip">MOCK · 1С:ЗУП</span><h2>Кадровые данные</h2>',
    '<p>Чтение вымышленного справочника. Официальные поля профиля обновляются без изменения прав и учётных данных.</p>',
    `<p class="muted small">Последняя синхронизация: ${lastPersonnelSync}</p>`,
    '<button class="primary" id="sync-personnel">Синхронизировать 1С:ЗУП</button></section>',
    '<section class="card"><span class="chip">MOCK · Documentolog</span><h2>Маршруты заявок</h2>',
    '<p>Создание заявки вызывает submitLeave, решение — decide. Внешний ID и версия сохраняются. Повторная отправка одного ID не дублирует документ.</p>',
    `<p>${integrations.documents.length} документов в mock-хранилище</p></section></div>`,
    '<section class="card"><h3>Документы Documentolog</h3>',
    '<div class="tablewrap"><table class="table"><thead><tr>',
    '<th>Внешний ID</th><th>Статус</th><th>Версия</th><th>Проверка повторной отправки</th>',
    `</tr></thead><tbody>${documentRows}</tbody></table></div></section>`,
    `<section class="card"><h3>Журнал обмена · mock</h3>${eventRows}</section>`,
  ].join('');
}
