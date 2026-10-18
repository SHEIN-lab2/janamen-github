const navItems = [
  ['dashboard', 'home', 'Главная'],
  ['requests', 'file', 'Заявки'],
  ['academy', 'book', 'Обучение'],
  ['ai', 'assistant', 'AI Jana'],
  ['notifications', 'bell', 'Уведомления'],
  ['knowledge', 'library', 'База знаний'],
  ['profile', 'user', 'Мой профиль'],
];
const iconPaths = {
  home: `M3 10.5 12 3l9 7.5
      M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9
      M9 21v-7h6v7`,
  file: `
      M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z
      M14 3v6h6
      M8 13h8
      M8 17h5
    `,
  book: `
      M12 6C9 4 6 3 3 4v15c3-1 6 0 9 2 3-2 6-3 9-2V4c-3-1-6 0-9 2Z
      M12 6v15
      M6 8l3 1
      M15 9l3-1
    `,
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  assistant: `
      M12 3v2
      m-5 0h10a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z
      m-4 7H2v4h2
      m16-4h2v4h-2
      m-8 4v3
      m-4 0h8
      m-9-10h.01
      M15 11h.01
    `,
  bell: `
      M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z
      M10 21h4
    `,
  user: `
      M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z
      M4 21v-2a8 8 0 0 1 16 0v2
    `,
  library: `
      M3 3h4v18H3Z
      M10 3h4v18h-4Z
      M17 3l4 17
      M16 4l4-1
      M20 21l4-1
    `,
  team: `
      M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z
      M1 21v-3a6 6 0 0 1 12 0v3
      M17 4a3 3 0 0 1 0 6
      M17 13a6 6 0 0 1 6 6v2
    `,
  sync: `
      M4 9a8 8 0 0 1 14-4l3 3
      M21 3v5h-5
      M20 15A8 8 0 0 1 6 19l-3-3
      M3 21v-5h5
    `,
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  logout: 'M9 3H3v18h6M9 12h12m-5-5 5 5-5 5',
};

const iconAttributes = [
  'class="ui-icon"',
  'viewBox="0 0 24 24"',
  'fill="none"',
  'stroke="currentColor"',
  'stroke-width="1.65"',
  'stroke-linecap="round"',
  'stroke-linejoin="round"',
  'aria-hidden="true"',
].join(' ');

function icon(name) {
  const path = iconPaths[name] || iconPaths.file;
  return `<svg ${iconAttributes}><path d="${path}"></path></svg>`;
}

function requestTitle() {
  return 'Заявки';
}

function visibleNav() {
  return [
    ...navItems.map((x) => (x[0] === 'requests' ? [x[0], x[1], requestTitle()] : x)),
    ...(user && user.role !== 'employee' ? [['learning', 'book', 'Обучение сотрудников']] : []),
    ...(user && user.role !== 'employee' ? [['team', 'team', 'Моя команда']] : []),
    ...(user?.role === 'hr' ? [['integrations', 'sync', 'Интеграции']] : []),
  ];
}

function shell() {
  const unread = (data.notifications || []).filter((n) => !n.read).length;
  const title = visibleNav().find((x) => x[0] === view)?.[2] || 'Главная';
  const nav = visibleNav();
  const navItem = ([key, symbol, label]) => {
    const active = key === view;
    const badge =
      key === 'notifications' && unread
        ? `<span class="nav-count" aria-label="${unread} непрочитанных">${unread > 99 ? '99+' : unread}</span>`
        : '';
    const activeClass = active ? 'active' : '';
    const currentPage = active ? 'aria-current="page"' : '';

    return `
      <button class="nav ${activeClass}" data-nav="${key}" ${currentPage}>
        ${icon(symbol)}
        <span class="navlabel">${label}</span>
        ${badge}
      </button>
    `;
  };
  const managementKeys = ['team', 'learning', 'integrations'];
  const workspaceNav = nav
    .filter((item) => user.role === 'employee' || !managementKeys.includes(item[0]))
    .map(navItem)
    .join('');
  const managementItems = nav
    .filter((item) => user.role !== 'employee' && managementKeys.includes(item[0]))
    .map(navItem)
    .join('');
  const managementNav =
    user.role !== 'employee'
      ? `<div class="nav-group">${user.role === 'hr' ? 'HR' : 'УПРАВЛЕНИЕ'}</div>${managementItems}`
      : '';
  const demoLabel = data.session?.mode === 'demo' ? ' · Демо' : '';

  return `
    <a class="skip-link" href="#page">Перейти к содержимому</a>
    <div class="layout">
      <button class="menu-backdrop" id="menu-backdrop" aria-label="Закрыть меню" hidden></button>

      <aside class="sidebar" id="sidebar" aria-label="Навигация">
        <div class="sidebar-brand">
          <img class="brand-logo" src="/logo.svg" alt="JanaМен" width="180" height="48">
          <button class="icon-button mobile-close" id="close-menu" aria-label="Закрыть меню">
            ${icon('close')}
          </button>
        </div>

        <nav aria-label="Основные разделы">
          <div class="nav-group">МОЁ ПРОСТРАНСТВО</div>
          ${workspaceNav}
          ${managementNav}
        </nav>

        <div class="side-bottom">
          <button class="profile-mini account-link" data-nav="profile">
            <span class="avatar">${catAvatar(user)}</span>
            <span><strong>${esc(user.name)}</strong><small>${esc(role[user.role])}${demoLabel}</small></span>
          </button>
          <button class="ghost mini logout-button" id="logout">${icon('logout')} Выйти</button>
        </div>
      </aside>

      <main class="content">
        <header class="top">
          <div class="top-location">
            <button
              class="icon-button mobile-menu"
              id="open-menu"
              aria-label="Открыть меню"
              aria-controls="sidebar"
              aria-expanded="false"
            >
              ${icon('menu')}
            </button>
            <div class="page-location">${esc(title)}</div>
          </div>
          <div class="top-right">
            ${languageSwitch()}
            <button class="avatar account-link" data-nav="profile" aria-label="Открыть мой профиль">
              ${catAvatar(user)}
            </button>
          </div>
        </header>

        <div id="navigation-status" class="navigation-status" role="status" hidden></div>
        <div id="page" tabindex="-1"></div>
        <footer class="workspace-footer">POST-TECH HAKATON <span>JanaМен</span></footer>
      </main>
    </div>
  `;
}

let mobileMenuOpen = false;
function closeNavigation() {
  mobileMenuOpen = false;
  document.body.classList.remove('menu-open');
  $('#sidebar')?.classList.remove('is-open');
  if ($('.content')) $('.content').inert = false;
  if ($('#menu-backdrop')) $('#menu-backdrop').hidden = true;
  $('#open-menu')?.setAttribute('aria-expanded', 'false');
}

function openNavigation() {
  mobileMenuOpen = true;
  document.body.classList.add('menu-open');
  $('#sidebar').classList.add('is-open');
  $('#menu-backdrop').hidden = false;
  $('#open-menu').setAttribute('aria-expanded', 'true');
  $('.content').inert = true;
  $('#close-menu').focus();
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 720) closeNavigation();
});

window.addEventListener('keydown', (e) => {
  if (!mobileMenuOpen) return;
  if (e.key === 'Escape') {
    closeNavigation();
    $('#open-menu')?.focus();
  }
  if (e.key === 'Tab') {
    const items = [...$('#sidebar').querySelectorAll('button')].filter((b) => !b.disabled);
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

function requestedView() {
  return location.hash.slice(1).split('?')[0] || 'dashboard';
}

window.addEventListener('popstate', () => {
  if (user) navigate(requestedView(), { push: false });
});

async function navigate(key, { push = true } = {}) {
  closeNavigation();
  document.querySelectorAll('.modalback').forEach((n) => n.remove());
  const oldKey = key;
  const indicator = $('#navigation-status');
  if (indicator) {
    indicator.hidden = false;
    indicator.textContent = 'Обновляем данные…';
  }
  const epoch = chatEpoch,
    ticket = ++navEpoch;
  try {
    const me = await call('/api/me');
    const notes = await call('/api/notifications');
    if (epoch !== chatEpoch || ticket !== navEpoch) return;
    if (
      !pages[key] ||
      (key === 'integrations' && me.user.role !== 'hr') ||
      (key === 'team' && me.user.role === 'employee') ||
      (key === 'learning' && me.user.role === 'employee')
    )
      key = 'dashboard';
    if (user && user.id !== me.user.id) {
      await authPage('Аккаунт изменён. Войдите снова.');
      return;
    }
    const next = {
      ...data,
      session: me.session,
      stats: me.stats,
      notifications: notes.notifications,
    };
    if (['dashboard', 'requests'].includes(key))
      next.requests = (await call('/api/requests')).requests;
    if (['dashboard', 'academy', 'learning', 'profile'].includes(key))
      next.courses = (await call('/api/courses')).courses;
    if (key === 'learning' && ['hr', 'manager'].includes(me.user.role)) {
      next.learning = await call('/api/learning');
      next.members = (await call('/api/team')).members;
      next.catalog = await call('/api/catalog');
    }
    if (key === 'knowledge') next.documents = (await call('/api/knowledge')).documents;
    if (key === 'integrations') next.integrations = await call('/api/integrations');
    if (key === 'ai') next.aiStatus = await call('/api/ai/status');
    if (key === 'team') {
      next.members = (await call('/api/team')).members;
      if (['hr', 'manager'].includes(me.user.role)) next.catalog = await call('/api/catalog');
    }
    if (epoch !== chatEpoch || ticket !== navEpoch) return;
    user = me.user;
    data = next;
    view = key;
    if (location.hash !== '#' + key) {
      if (push && key === oldKey) history.pushState(null, '', '#' + key);
      else history.replaceState(null, '', '#' + key);
    }
    document.title = (visibleNav().find((x) => x[0] === key)?.[2] || 'JanaМен') + ' · JanaМен';
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(
      () => authPage('Сессия завершена. Войдите снова.'),
      Math.max(0, data.session.expiresAt - Date.now()),
    );
    $('#app').innerHTML = shell();
    $('#page').innerHTML = pages[key]();
    bind();
    $('#page').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (e) {
    if (epoch === chatEpoch && ticket === navEpoch) {
      if (e.status === 401) authPage('Сессия завершена. Войдите снова.');
      else {
        if (indicator) {
          indicator.hidden = false;
          indicator.textContent = 'Не удалось обновить данные. Попробуйте ещё раз.';
        }
        error(e);
      }
    }
  }
}
