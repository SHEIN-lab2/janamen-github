function modal(body) {
  const bg = document.createElement('div');
  bg.className = 'modalback';
  bg.innerHTML = `<div class="modal">${body}</div>`;
  document.body.append(bg);
  translateUI(bg);
  bg.onclick = (e) => {
    if (e.target === bg) bg.remove();
  };
  return bg;
}

function newRequest() {
  const bg = modal(
    [
      '<div class="flex"><h2>Новая заявка</h2><button class="ghost mini" id="cancel">✕</button></div>',
      `<p class="muted">Оформление отпуска · доступно: ${user.leaveDays} дней</p>`,
      '<form id="request-form">',
      '<label class="field">Начало отпуска</label>',
      `<input type="date" class="input" id="start" required min="${new Date().toISOString().slice(0, 10)}">`,
      '<label class="field">Окончание отпуска</label>',
      `<input type="date" class="input" id="end" required min="${new Date().toISOString().slice(0, 10)}">`,
      '<label class="field">Комментарий (необязательно)</label>',
      '<textarea class="input" id="note" rows="3" maxlength="500" placeholder="Дополнительная информация"></textarea>',
      '<div class="actions"><button class="primary">Отправить заявку</button></div>',
      '</form>',
    ].join(''),
  );
  bg.querySelector('#cancel').onclick = () => bg.remove();
  bg.querySelector('#request-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await call('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'leave',
          start: bg.querySelector('#start').value,
          end: bg.querySelector('#end').value,
          note: bg.querySelector('#note').value,
        }),
      });
      bg.remove();
      toast('Заявка отправлена на согласование');
      navigate('requests');
    } catch (e) {
      error(e);
    }
  };
}

function viewRequest(id) {
  const request = data.requests.find((item) => item.id === id);
  if (!request) return;

  const historyItems = request.history
    .map(
      (historyEntry) => `
        <div class="rowlist">
          <b>${status[historyEntry.status]}</b>
          <div class="muted small">${new Date(historyEntry.at).toLocaleString(uiLocale())}</div>
        </div>
      `,
    )
    .join('');
  const documentReference = request.externalId
    ? `<p class="muted small">Documentolog · MOCK<br>${esc(request.externalId)}</p>`
    : '';
  const decisionActions = request.canDecide
    ? `
        <div class="actions">
          <button class="primary" id="approve">${request.status === 'pending' ? 'Согласовать и передать HR' : 'Согласовать окончательно'}</button>
          <button class="ghost" id="reject">Отклонить</button>
        </div>
      `
    : '';
  const modalElement = modal(`
    <div class="flex">
      <h2>Заявка на отпуск</h2>
      <button class="ghost mini" id="cancel">✕</button>
    </div>

    <p class="muted">${esc(request.ownerName)} · ${esc(request.start)} — ${esc(request.end)}</p>
    <span class="chip ${request.status}">${status[request.status]}</span>
    <p>Комментарий: ${esc(request.note || '—')}</p>
    ${documentReference}

    <h3>История заявки</h3>
    ${historyItems}
    ${decisionActions}
  `);

  modalElement.querySelector('#cancel').onclick = () => modalElement.remove();

  async function submitDecision(nextStatus) {
    try {
      await call(`/api/requests/${request.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus }),
      });
      modalElement.remove();
      toast('Решение сохранено');
      navigate('requests');
    } catch (e) {
      error(e);
    }
  }

  if (request.canDecide) {
    modalElement.querySelector('#approve').onclick = () => submitDecision('approved');
    modalElement.querySelector('#reject').onclick = () => submitDecision('rejected');
  }
}

function viewCourse(id) {
  const course = data.courses.find((item) => item.id === id);
  if (!course) return;
  const answers = course.answers
    .map(
      (answer, index) =>
        `<label class="rowlist" style="display:block"><input type="radio" name="answer" value="${index}" required> ${esc(answer)}</label>`,
    )
    .join('');
  const bg = modal(
    [
      `<div class="flex"><h2>${esc(course.title)}</h2><button class="ghost mini" id="cancel">✕</button></div>`,
      '<p class="eyebrow">Учебный материал</p>',
      `<p style="line-height:1.9">${esc(course.material)}</p>`,
      '<button class="ghost" id="mark-read">Материал изучен · сохранить 50%</button>',
      '<hr style="border:0;border-top:1px solid var(--line)">',
      `<h3>${esc(course.question)}</h3>`,
      `<form id="test">${answers}<div class="actions"><button class="primary">Проверить ответ</button></div></form>`,
    ].join(''),
  );
  bg.querySelector('#cancel').onclick = () => bg.remove();
  bg.querySelector('#mark-read').onclick = async () => {
    try {
      await call(`/api/courses/${id}/read`, { method: 'POST' });
      toast('Прогресс сохранён: 50%');
      bg.querySelector('#mark-read').textContent = 'Материал изучен ✓';
    } catch (e) {
      error(e);
    }
  };
  bg.querySelector('#test').onsubmit = async (e) => {
    e.preventDefault();
    const a = bg.querySelector('input[name="answer"]:checked');
    if (!a) return;
    try {
      await call(`/api/courses/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ answer: Number(a.value) }),
      });
      bg.remove();
      toast('Курс успешно завершён!');
      navigate('academy');
    } catch (e) {
      error(e);
    }
  };
}

async function showSource(id) {
  try {
    const d = await call('/api/knowledge');
    const source = d.documents.find((x) => x.id === id);
    if (source) {
      const bg = modal(
        [
          `<h2>${esc(source.title)}</h2>`,
          `<p style="line-height:1.8">${esc(source.body)}</p>`,
          `<p class="muted">Демонстрационный документ · ${esc(source.id)} · ${esc(source.section || '')} · v${esc(source.version || '1.0')}</p>`,
          '<button class="ghost">Закрыть</button>',
        ].join(''),
      );
      bg.querySelector('button').onclick = () => bg.remove();
    }
  } catch (e) {
    error(e);
  }
}

function assignCourse(preselectedCourse = '') {
  const members = data.members || [];
  const courses = data.catalog.courses;
  const departments = [...new Set(members.map((member) => member.department))].sort();
  const courseOptions = courses
    .map(
      (course) =>
        `<option value="${esc(course.id)}" ${course.id === preselectedCourse ? 'selected' : ''}>${esc(course.title)}</option>`,
    )
    .join('');
  const departmentOptions = departments
    .map((department) => `<option value="${esc(department)}">${esc(department)}</option>`)
    .join('');
  const employeeRows = members
    .map(
      (member) => `
        <label class="assignment-person" data-assignment-person data-name="${esc(member.name.toLocaleLowerCase('ru'))}" data-department="${esc(member.department)}">
          <input type="checkbox" name="userIds" value="${esc(member.id)}">
          ${catAvatar(member)}
          <span class="assignment-person-copy"><strong>${esc(member.name)}</strong><small>${esc(member.title)} · ${esc(member.department)}</small></span>
          <span class="assignment-check" aria-hidden="true">✓</span>
        </label>
      `,
    )
    .join('');
  const modalElement = modal(`
    <section class="assignment-modal">
      <header class="assignment-modal-header">
        <div class="assignment-modal-mark" aria-hidden="true">${icon('book')}</div>
        <div><span class="assignment-kicker">JANA ACADEMY · НОВОЕ НАЗНАЧЕНИЕ</span><h2>Назначить курс</h2><p>Подберите программу и определите, кто будет её проходить.</p></div>
        <button class="assignment-close" id="cancel" type="button" aria-label="Закрыть">×</button>
      </header>
      <form id="assignment" class="assignment-form">
        <label class="field" for="assignment-course">Учебная программа <span class="assignment-required">*</span></label>
        <select class="input assignment-control" id="assignment-course" name="courseId" required>
          <option value="">Выберите курс</option>${courseOptions}
        </select>
        <div class="assignment-section-heading"><label class="field">Кому назначить <span class="assignment-required">*</span></label><span class="assignment-audience-count" id="assignment-count">0 сотрудников</span></div>
        <div class="assignment-mode" role="tablist" aria-label="Способ выбора сотрудников">
          <button class="assignment-mode-button is-selected" type="button" data-assignment-mode="people" role="tab" aria-selected="true">Сотрудникам</button>
          <button class="assignment-mode-button" type="button" data-assignment-mode="department" role="tab" aria-selected="false">Подразделению</button>
        </div>
        <div class="assignment-audience-panel" data-audience-panel="people">
          <div class="assignment-people-tools"><input class="input assignment-control" id="assignment-search" type="search" placeholder="Найти сотрудника по имени" aria-label="Найти сотрудника"><button class="ghost mini" id="assignment-select-visible" type="button">Выбрать всех</button></div>
          <div class="assignment-people-list">${employeeRows || '<p class="muted">Нет сотрудников, доступных для назначения.</p>'}</div>
        </div>
        <div class="assignment-audience-panel" data-audience-panel="department" hidden>
          <label class="field" for="assignment-department">Подразделение</label>
          <select class="input assignment-control" id="assignment-department"><option value="">Выберите подразделение</option>${departmentOptions}</select>
          <p class="assignment-department-hint">Курс получат сотрудники вашего списка из выбранного подразделения.</p>
        </div>
        <label class="field" for="assignment-deadline">Срок прохождения <span class="muted">(необязательно)</span></label>
        <input class="input assignment-control" id="assignment-deadline" name="dueDate" type="date" min="${new Date().toISOString().slice(0, 10)}">
        <div class="assignment-repeat" id="assignment-repeat" hidden>
          <label><input id="assignment-restart" type="checkbox"><span><strong>Перезапустить уже назначенный курс</strong><small>Прогресс выбранных сотрудников по этому курсу будет сброшен.</small></span></label>
        </div>
        <footer class="assignment-modal-footer">
          <span class="assignment-footer-note">Сотрудники получат уведомление и увидят курс в своём разделе обучения.</span>
          <div><button class="ghost" id="assignment-cancel" type="button">Отмена</button><button class="primary" type="submit" id="assignment-submit">Назначить курс</button></div>
        </footer>
      </form>
    </section>
  `);
  modalElement.querySelector('.modal').classList.add('assignment-modal-shell');
  const form = modalElement.querySelector('#assignment');
  const courseSelect = form.elements.courseId;
  const searchInput = modalElement.querySelector('#assignment-search');
  const departmentSelect = modalElement.querySelector('#assignment-department');
  const submitButton = modalElement.querySelector('#assignment-submit');
  const repeatNotice = modalElement.querySelector('#assignment-repeat');
  const restartCheck = modalElement.querySelector('#assignment-restart');
  let targetMode = 'people';

  function selectedMembers() {
    if (targetMode === 'department') {
      return members.filter(
        (member) => member.department === departmentSelect.value && departmentSelect.value,
      );
    }
    return [...modalElement.querySelectorAll('input[name="userIds"]:checked')].map((input) =>
      members.find((member) => member.id === input.value),
    );
  }

  function updateAssignmentStatus() {
    const selected = selectedMembers().filter(Boolean);
    const assignedIds = new Set(
      data.catalog.assignments
        .filter((assignment) => assignment.courseId === courseSelect.value)
        .map((assignment) => assignment.userId),
    );
    const repeats = selected.filter((member) => assignedIds.has(member.id));
    modalElement.querySelector('#assignment-count').textContent = employeeCountLabel(
      selected.length,
    );
    repeatNotice.hidden = !repeats.length;
    submitButton.disabled =
      !courseSelect.value || !selected.length || (repeats.length > 0 && !restartCheck.checked);
    translateUI(modalElement);
  }

  function updateVisiblePeople() {
    const query = searchInput.value.trim().toLocaleLowerCase('ru');
    let visible = 0;
    modalElement.querySelectorAll('[data-assignment-person]').forEach((person) => {
      const matches = person.dataset.name.includes(query);
      person.hidden = !matches;
      if (matches) visible++;
    });
    modalElement.querySelector('#assignment-select-visible').textContent =
      visible > 0 &&
      [...modalElement.querySelectorAll('[data-assignment-person]:not([hidden]) input')].every(
        (input) => input.checked,
      )
        ? 'Снять выбор'
        : 'Выбрать всех';
  }

  function switchMode(mode) {
    targetMode = mode;
    modalElement.querySelectorAll('[data-assignment-mode]').forEach((button) => {
      const active = button.dataset.assignmentMode === mode;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-selected', String(active));
    });
    modalElement.querySelectorAll('[data-audience-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.audiencePanel !== mode;
    });
    updateAssignmentStatus();
  }

  modalElement.querySelector('#cancel').onclick = () => modalElement.remove();
  modalElement.querySelector('#assignment-cancel').onclick = () => modalElement.remove();
  courseSelect.onchange = updateAssignmentStatus;
  departmentSelect.onchange = updateAssignmentStatus;
  restartCheck.onchange = updateAssignmentStatus;
  searchInput.oninput = updateVisiblePeople;
  modalElement.querySelectorAll('input[name="userIds"]').forEach((checkbox) => {
    checkbox.onchange = () => {
      updateAssignmentStatus();
      updateVisiblePeople();
    };
  });
  modalElement.querySelectorAll('[data-assignment-mode]').forEach((button) => {
    button.onclick = () => switchMode(button.dataset.assignmentMode);
  });
  modalElement.querySelector('#assignment-select-visible').onclick = () => {
    const visibleCheckboxes = [
      ...modalElement.querySelectorAll('[data-assignment-person]:not([hidden]) input'),
    ];
    const selectVisible = visibleCheckboxes.some((checkbox) => !checkbox.checked);
    visibleCheckboxes.forEach((checkbox) => {
      checkbox.checked = selectVisible;
    });
    updateVisiblePeople();
    updateAssignmentStatus();
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    const selected = selectedMembers().filter(Boolean);
    try {
      const result = await call('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          userIds: selected.map((member) => member.id),
          courseId: courseSelect.value,
          dueDate: form.elements.dueDate.value || null,
          restart: restartCheck.checked,
        }),
      });
      modalElement.remove();
      toast(`Курс назначен: ${employeeCountLabel(result.assigned)}`);
      navigate(view === 'learning' ? 'learning' : view === 'academy' ? 'academy' : 'team');
    } catch (errorMessage) {
      error(errorMessage);
      updateAssignmentStatus();
    }
  };
  updateVisiblePeople();
  updateAssignmentStatus();
}

function connectionForm(system = '') {
  const currentConnection =
    (data.integrations.connections || []).find((item) => item.system === system) || {};
  const bg = modal(
    `
      <div class="flex">
        <h2>Подключение системы</h2>
        <button class="icon-button" id="close-connection" aria-label="Закрыть">
          ${icon('close')}
        </button>
      </div>

      <form id="connection-form">
        <label class="field" for="connection-system">Система</label>
        <select class="input" id="connection-system" name="system">
          <option value="1c-zup" ${system === '1c-zup' ? 'selected' : ''}>1С:ЗУП</option>
          <option value="documentolog" ${system === 'documentolog' ? 'selected' : ''}>
            Documentolog
          </option>
        </select>

        <label class="field" for="connection-name">Название подключения</label>
        <input
          class="input"
          id="connection-name"
          name="name"
          required
          maxlength="80"
          value="${esc(currentConnection.name || '')}"
          placeholder="HR-система компании"
        >

        <label class="field" for="connection-endpoint">Адрес API (HTTPS)</label>
        <input
          class="input"
          type="url"
          id="connection-endpoint"
          name="endpoint"
          required
          maxlength="500"
          value="${esc(currentConnection.endpoint || '')}"
          placeholder="https://api.company.kz/"
        >

        <p class="hint">
          Сохраняются только название и адрес. Пароли и токены вводить не нужно.
          Для реального обмена необходим API-адаптер вашей системы.
        </p>
        <div class="alert" id="connection-error" hidden role="alert"></div>
        <button class="primary" type="submit">Сохранить подключение</button>
      </form>
    `,
  );

  const form = bg.querySelector('#connection-form');
  const systemSelect = bg.querySelector('#connection-system');

  bg.querySelector('#close-connection').onclick = () => bg.remove();
  systemSelect.onchange = (event) => {
    const selectedConnection = (data.integrations.connections || []).find(
      (item) => item.system === event.target.value,
    );
    bg.querySelector('#connection-name').value = selectedConnection?.name || '';
    bg.querySelector('#connection-endpoint').value = selectedConnection?.endpoint || '';
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    button.disabled = true;

    try {
      await call('/api/integrations/connections', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      bg.remove();
      toast('Параметры подключения сохранены');
      await navigate('integrations');
    } catch (err) {
      const errorMessage = bg.querySelector('#connection-error');
      errorMessage.textContent = translateText(err.message);
      errorMessage.hidden = false;
    } finally {
      button.disabled = false;
    }
  };
}
