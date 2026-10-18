async function ask(q) {
  if (!q.trim() || asking) return;
  const epoch = chatEpoch;
  asking = true;
  chat.push({ who: 'user', text: q });
  $('#page').innerHTML = ai();
  bind();
  try {
    const d = await call('/api/ai', { method: 'POST', body: JSON.stringify({ question: q }) });
    if (epoch === chatEpoch)
      chat.push({
        who: 'bot',
        text: d.answer,
        source: d.source,
        sources: d.sources,
        mode: d.mode,
        notice: d.notice,
      });
  } catch (e) {
    if (epoch === chatEpoch) chat.push({ who: 'bot', text: e.message });
  } finally {
    if (epoch === chatEpoch) {
      asking = false;
      if (view === 'ai' && user) {
        $('#page').innerHTML = ai();
        bind();
        $('#messages').scrollTop = $('#messages').scrollHeight;
      }
    }
  }
}

function bind() {
  document
    .querySelectorAll('[data-notification]')
    .forEach((b) => (b.onclick = () => openNotification(b.dataset.notification)));
  document.querySelectorAll('[data-notification-filter]').forEach(
    (b) =>
      (b.onclick = () => {
        notificationFilter = b.dataset.notificationFilter;
        $('#page').innerHTML = notifications();
        bind();
      }),
  );
  bindLanguages();
  translateUI();
  $('#add-connection')?.addEventListener('click', () => connectionForm());
  document
    .querySelectorAll('[data-connection]')
    .forEach((b) => (b.onclick = () => connectionForm(b.dataset.connection)));
  $('.skip-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#page')?.focus();
  });
  $('#open-menu')?.addEventListener('click', openNavigation);
  $('#close-menu')?.addEventListener('click', () => {
    closeNavigation();
    $('#open-menu')?.focus();
  });
  $('#menu-backdrop')?.addEventListener('click', closeNavigation);
  $('#refresh-page')?.addEventListener('click', () => navigate(view, { push: false }));
  $('#sync-personnel')?.addEventListener('click', async () => {
    try {
      const d = await call('/api/integrations/one-c/sync', { method: 'POST' });
      toast(`Mock 1С:ЗУП: обновлено ${d.updated} профилей`);
      navigate('integrations');
    } catch (e) {
      error(e);
    }
  });
  document.querySelectorAll('[data-resubmit]').forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const d = await call(`/api/integrations/documentolog/${b.dataset.resubmit}`, {
            method: 'POST',
          });
          toast(`Тот же документ: ${d.document.externalId}`);
          navigate('integrations');
        } catch (e) {
          error(e);
        }
      }),
  );
  $('#assign-course')?.addEventListener('click', assignCourse);
  document
    .querySelectorAll('[data-assign-course]')
    .forEach((button) =>
      button.addEventListener('click', () => assignCourse(button.dataset.courseId || '')),
    );
  document.querySelectorAll('[data-course-filter]').forEach((button) =>
    button.addEventListener('click', () => {
      $('#learning-course-filter').value = button.dataset.courseFilter;
      filterLearningRows();
    }),
  );
  ['#learning-course-filter', '#learning-status-filter', '#learning-department-filter']
    .map((selector) => $(selector))
    .filter(Boolean)
    .forEach((filter) => filter.addEventListener('change', filterLearningRows));
  document
    .querySelectorAll('[data-source]')
    .forEach((b) => (b.onclick = () => showSource(b.dataset.source)));
  document
    .querySelectorAll('[data-nav]')
    .forEach((b) => (b.onclick = () => navigate(b.dataset.nav)));
  $('#logout')?.addEventListener('click', logout);
  $('#new-request')?.addEventListener('click', newRequest);
  document
    .querySelectorAll('[data-request]')
    .forEach((b) => (b.onclick = () => viewRequest(b.dataset.request)));
  document
    .querySelectorAll('[data-course]')
    .forEach((b) => (b.onclick = () => viewCourse(b.dataset.course)));
  $('#read-all')?.addEventListener('click', async () => {
    try {
      await call('/api/notifications/read', { method: 'POST' });
      navigate('notifications');
    } catch (e) {
      error(e);
    }
  });
  $('#ask-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    ask($('#question').value);
  });
  document.querySelectorAll('[data-ask]').forEach((b) => (b.onclick = () => ask(b.dataset.ask)));
}

function filterLearningRows() {
  const course = $('#learning-course-filter')?.value || '';
  const status = $('#learning-status-filter')?.value || '';
  const department = $('#learning-department-filter')?.value || '';
  document.querySelectorAll('[data-learning-row]').forEach((row) => {
    row.hidden =
      (course && row.dataset.course !== course) ||
      (status && row.dataset.status !== status) ||
      (department && row.dataset.department !== department);
  });
}
