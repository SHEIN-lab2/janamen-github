function employeeCountWord(count) {
  return count % 100 >= 11 && count % 100 <= 14
    ? 'сотрудников'
    : count % 10 === 1
      ? 'сотрудник'
      : count % 10 >= 2 && count % 10 <= 4
        ? 'сотрудника'
        : 'сотрудников';
}

function employeeCount(n) {
  return `${n} <span>${employeeCountWord(n)}</span>`;
}

function employeeCountLabel(count) {
  return `${count} ${employeeCountWord(count)}`;
}

function catAvatar(person) {
  const personNumber = Number(String(person.id).replace(/\D/g, '')) || 1;
  const spriteIndex = Math.max(0, Math.min(29, personNumber - 1));
  const column = (spriteIndex % 5) * 25;
  const row = Math.floor(spriteIndex / 5) * 20;

  return `
    <span
      class="cat-avatar"
      role="img"
      aria-label="Аватар: ${esc(person.name)}"
      style="background-position: ${column}% ${row}%"
    ></span>
  `;
}

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
let asking = false,
  chatEpoch = 0,
  navEpoch = 0,
  expiryTimer;
let user = null,
  view = 'dashboard',
  data = {},
  chat = [
    {
      who: 'bot',
      text: 'Сәлем! Я AI Jana. Задайте вопрос об отпуске, согласовании заявок или обучении. Мои ответы основаны только на демонстрационной базе знаний.',
    },
  ];
const role = { employee: 'Сотрудник', manager: 'Руководитель', hr: 'HR / Администратор' };
const status = {
  pending: 'У руководителя',
  hr_pending: 'На согласовании у HR',
  approved: 'Согласована',
  rejected: 'Отклонена',
};
async function call(url, options = {}) {
  const epoch = chatEpoch;
  let res;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw Error('Нет связи с сервером. Проверьте подключение и повторите действие.');
  }
  const b = await res.json();
  if (!res.ok) {
    const e = Error(b.error || 'Ошибка запроса');
    e.status = res.status;
    if (res.status === 401 && b.code === 'AUTH_REQUIRED' && epoch === chatEpoch && user)
      authPage('Сессия завершена. Войдите снова.');
    throw e;
  }
  if (epoch !== chatEpoch) throw Error('Пользователь изменился. Повторите действие.');
  return b;
}

function toast(s) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = translateText(s);
  document.body.append(node);
  setTimeout(() => node.remove(), 3100);
}

function error(e) {
  toast('Ошибка: ' + e.message);
}
