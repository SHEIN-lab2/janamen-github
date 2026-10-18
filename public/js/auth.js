function broadcastAuth() {
  try {
    localStorage.setItem('jana-auth-event', String(Date.now()) + Math.random());
  } catch {}
}

window.addEventListener('storage', (e) => {
  if (e.key === 'jana-auth-event') authPage('Аккаунт изменён в другой вкладке. Войдите заново.');
});

window.addEventListener('focus', async () => {
  if (!user) return;
  try {
    const me = await call('/api/me');
    if (user && me.user.id !== user.id) authPage('Аккаунт изменён. Войдите снова.');
  } catch (e) {
    if (user) error(e);
  }
});

async function logout() {
  const button = $('#logout');
  if (button) button.disabled = true;
  try {
    await call('/api/logout', { method: 'POST' });
    broadcastAuth();
    authPage('Вы вышли из аккаунта.');
  } catch (e) {
    error(e);
    if (button) button.disabled = false;
  }
}

async function authPage(message = '') {
  closeNavigation();
  clearTimeout(expiryTimer);
  const epoch = ++chatEpoch;
  navEpoch++;
  asking = false;
  user = null;
  data = {};
  view = 'login';
  document.querySelectorAll('.modalback,.toast').forEach((n) => n.remove());
  chat = [{ who: 'bot', text: 'Сәлем! Задайте вопрос по демонстрационной базе HR.' }];
  $('#app').innerHTML = '<div class="auth-loading" role="status">Загрузка экрана входа…</div>';
  let config;
  try {
    config = await call('/api/auth/config');
  } catch {
    if (epoch === chatEpoch) {
      $('#app').innerHTML =
        '<div class="auth-loading"><p>Не удалось связаться с сервером.</p><button class="primary" id="retry-login">Повторить</button></div>';
      $('#retry-login').onclick = () => authPage(message);
    }
    return;
  }
  if (epoch !== chatEpoch) return;
  const demoRoles = [
    ['employee', 'Барсик', 'Сотрудник', 'Личный кабинет, заявки и обучение'],
    ['manager', 'Мурзик', 'Руководитель', 'Согласование заявок'],
    ['hr', 'Рыжик', 'HR / Администратор', 'Заявки и интеграции'],
    ['outsider', 'Пушок', 'Другой сотрудник', 'Проверка доступа другого подразделения'],
  ]
    .map(
      ([id, name, label, hint]) =>
        `<button type="button" class="demo-role" data-demo="${id}@jana.test"><strong>${label}</strong><span>${name}</span><small>${hint}</small></button>`,
    )
    .join('');
  const demoPanel = [
    `<section id="demo-panel" ${config.demoEnabled ? '' : 'hidden'}>`,
    '<p class="small muted">Вымышленные сотрудники. Выберите роль, чтобы проверить её возможности.</p>',
    `<div class="demo-roles">${demoRoles}</div>`,
    '</section>',
  ].join('');
  const passwordForm = [
    `<form id="login" ${config.demoEnabled ? 'hidden' : ''}>`,
    '<label class="field" for="email">Рабочая почта</label>',
    '<input class="input" id="email" name="email" type="email" autocomplete="username" maxlength="254" placeholder="name@company.kz" required>',
    '<label class="field" for="pass">Пароль</label>',
    '<div class="password-row">',
    '<input class="input" id="pass" name="password" type="password" autocomplete="current-password" maxlength="256" required>',
    '<button type="button" class="ghost mini" id="toggle-pass" aria-label="Показать пароль" aria-pressed="false">Показать</button>',
    '</div>',
    '<p id="caps-lock" class="small" hidden>Включён Caps Lock</p>',
    '<button class="primary" id="login-submit" type="submit">Войти →</button>',
    '<p class="small muted">Если нет учётных данных, обратитесь к администратору проекта.</p>',
    '</form>',
  ].join('');
  $('#app').innerHTML = [
    '<div class="auth">',
    '<section class="auth-art">',
    '<img class="brand-logo" src="/logo.svg" alt="JanaМен" width="180" height="48">',
    '<div><div class="eyebrow">Единое пространство сотрудника</div>',
    '<h1>Меньше рутины.<br>Больше возможностей.</h1>',
    '<p>Заявки, обучение и поддержка HR — рядом, когда они нужны.</p>',
    '</div><footer>POST-TECH HAKATON</footer></section>',
    '<section class="auth-panel"><div class="login-card">',
    `<div class="auth-tools">${languageSwitch()}</div>`,
    '<img class="login-logo brand-logo" src="/logo.svg" alt="JanaМен" width="180" height="48">',
    '<div class="eyebrow">Добро пожаловать</div>',
    '<h2>Войти в JanaМен</h2>',
    '<p>Выберите способ входа в рабочее пространство.</p>',
    message ? `<div class="auth-notice" role="status">${esc(message)}</div>` : '',
    '<div class="auth-tabs" role="group" aria-label="Способ входа">',
    config.demoEnabled
      ? '<button type="button" id="tab-demo" class="selected" aria-pressed="true">Демонстрация</button>'
      : '',
    `<button type="button" id="tab-password" class="${config.demoEnabled ? '' : 'selected'}" aria-pressed="${!config.demoEnabled}">По почте и паролю</button>`,
    '</div>',
    '<div id="auth-error" class="alert" role="alert" hidden></div>',
    demoPanel,
    passwordForm,
    '<p class="auth-footer">Доступ к разделам определяется вашей ролью.</p>',
    '</div></section></div>',
  ].join('');
  bindLanguages();
  translateUI();
  let busy = false;
  const setMode = (demo) => {
    $('#demo-panel').hidden = !demo;
    $('#login').hidden = demo;
    $('#auth-error').hidden = true;
    for (const [id, active] of [
      ['tab-demo', demo],
      ['tab-password', !demo],
    ]) {
      const b = $('#' + id);
      if (b) {
        b.classList.toggle('selected', active);
        b.setAttribute('aria-pressed', String(active));
      }
    }
    const panel = $(demo ? '#demo-panel' : '#login');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      panel.animate(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 240, easing: 'ease-out' },
      );
    if (!demo) $('#email').focus();
  };
  $('#tab-demo')?.addEventListener('click', () => setMode(true));
  $('#tab-password').onclick = () => setMode(false);
  $('#toggle-pass').onclick = () => {
    const shown = $('#pass').type === 'password';
    $('#pass').type = shown ? 'text' : 'password';
    $('#toggle-pass').textContent = translateText(shown ? 'Скрыть' : 'Показать');
    $('#toggle-pass').setAttribute('aria-label', shown ? 'Скрыть пароль' : 'Показать пароль');
    $('#toggle-pass').setAttribute('aria-pressed', String(shown));
  };
  $('#pass').onkeyup = (e) => {
    $('#caps-lock').hidden = !e.getModifierState('CapsLock');
  };
  async function enter(url, payload, button) {
    if (busy) return;
    busy = true;
    const label = button.innerHTML;
    button.textContent = 'Входим…';
    document.querySelectorAll('.login-card button').forEach((b) => (b.disabled = true));
    $('#auth-error').hidden = true;
    try {
      const result = await call(url, { method: 'POST', body: JSON.stringify(payload) });
      if (epoch !== chatEpoch) return;
      user = result.user;
      data.session = result.session;
      broadcastAuth();
      await navigate('dashboard');
    } catch (e) {
      if (epoch !== chatEpoch) return;
      $('#auth-error').textContent = translateText(e.message);
      $('#auth-error').hidden = false;
      $('#pass').value = '';
    } finally {
      if (epoch === chatEpoch) {
        busy = false;
        button.innerHTML = label;
        document.querySelectorAll('.login-card button').forEach((b) => (b.disabled = false));
      }
    }
  }
  $('#login').onsubmit = (e) => {
    e.preventDefault();
    enter(
      '/api/login',
      { email: $('#email').value.trim(), password: $('#pass').value },
      $('#login-submit'),
    );
  };
  document
    .querySelectorAll('[data-demo]')
    .forEach((b) => (b.onclick = () => enter('/api/demo/login', { email: b.dataset.demo }, b)));
}
