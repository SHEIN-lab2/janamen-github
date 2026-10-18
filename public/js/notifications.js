let notificationFilter = 'all';
function notificationTarget(n) {
  if (n.target && ['requests', 'academy', 'knowledge', 'profile'].includes(n.target.page))
    return n.target;
  return {
    page: /курс|обучен/i.test(n.text)
      ? 'academy'
      : /заявк|отпуск/i.test(n.text)
        ? 'requests'
        : 'profile',
  };
}

function notificationCard(n, compact = false) {
  const target = notificationTarget(n);
  const category =
    target.page === 'academy' ? 'Обучение' : target.page === 'requests' ? 'Заявки' : 'Информация';
  const unreadLabel = n.read ? '' : ' · Новое';
  const cardClass = compact ? 'notification-card dashboard-notification' : 'notification-card';
  const readClass = n.read ? 'is-read' : 'is-unread';

  return [
    `<div class="${cardClass} ${readClass}">`,
    `<span class="notification-symbol">${icon(target.page === 'academy' ? 'book' : 'file')}</span>`,
    '<span class="notification-copy">',
    `<span class="notification-category">${category}${unreadLabel}</span>`,
    `<strong>${esc(n.text)}</strong>`,
    `<time>${new Date(n.at).toLocaleString(uiLocale())}</time>`,
    '</span>',
    `<button class="arrow-button notification-open" data-notification="${esc(n.id)}" aria-label="Открыть уведомление">${icon('arrow')}</button>`,
    '</div>',
  ].join('');
}

async function openNotification(id) {
  const n = data.notifications.find((n) => n.id === id);
  if (!n) return;
  const target = notificationTarget(n),
    epoch = chatEpoch;
  try {
    await call('/api/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' });
    await navigate(target.page);
    if (epoch !== chatEpoch || view !== target.page) return;
    if (target.id) {
      if (target.page === 'requests') viewRequest(target.id);
      if (target.page === 'academy') viewCourse(target.id);
    }
  } catch (e) {
    error(e);
  }
}

function notifications() {
  const unreadCount = data.notifications.filter((notification) => !notification.read).length;
  const totalCount = data.notifications.length;
  const visibleNotifications =
    notificationFilter === 'unread'
      ? data.notifications.filter((notification) => !notification.read)
      : data.notifications;
  const notificationCards =
    visibleNotifications.map(notificationCard).join('') ||
    '<div class="card empty">Новых уведомлений нет</div>';
  const readAllButton = `<button class="ghost" id="read-all" ${unreadCount ? '' : 'disabled'}>Отметить все прочитанными</button>`;
  const allFilterClass = notificationFilter === 'all' ? 'selected' : '';
  const unreadFilterClass = notificationFilter === 'unread' ? 'selected' : '';
  const filterTabs = `
    <div class="notification-tabs">
      <button class="ghost ${allFilterClass}" data-notification-filter="all">
        Все <b>${totalCount}</b>
      </button>
      <button class="ghost ${unreadFilterClass}" data-notification-filter="unread">
        Непрочитанные <b>${unreadCount}</b>
      </button>
    </div>
  `;

  return `
    ${heading('Уведомления', 'Важные изменения и события вашей работы.', readAllButton)}
    ${filterTabs}
    <section class="notification-list">${notificationCards}</section>
  `;
}
