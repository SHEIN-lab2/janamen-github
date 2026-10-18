'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('./lib/env').loadEnv(path.join(__dirname, '.env'));

const { createApi, send, days } = require('./lib/api');
const { createAssistant } = require('./lib/assistant');
const { buildDemo, migrateDemo } = require('./lib/demo');
const { createIntegrations } = require('./lib/integrations');
const { applyCatNames } = require('./lib/presentation');
const { createSessions, demoAllowed } = require('./lib/sessions');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json');
const STATIC = path.join(ROOT, 'public');
const personnel = require('./fixtures/personnel.json');
const knowledgeBase = require('./fixtures/knowledge.json');
const assistant = createAssistant({ documents: knowledgeBase });
const sessions = createSessions();

const baseEmails = {
  u1: 'employee',
  u2: 'manager',
  u3: 'hr',
  u4: 'outsider',
};
const users = personnel.map((person) => ({
  ...person,
  email: (baseEmails[person.id] || 'employee' + person.id.slice(1)) + '@jana.test',
  role:
    person.id === 'u3'
      ? 'hr'
      : ['u2', 'u5', 'u6', 'u7'].includes(person.id)
        ? 'manager'
        : 'employee',
}));

const courses = [
  {
    id: 'c1',
    title: 'Информационная безопасность',
    category: 'Обязательный курс',
    duration: '12 минут',
    summary: 'Правила работы с данными и паролями',
    material:
      'Никогда не передавайте пароли коллегам. Проверяйте адрес сайта перед вводом учетных данных. Не пересылайте внутренние документы на личную почту. Сообщайте о подозрительных письмах специалистам по безопасности.',
    question: 'Что делать с подозрительным письмом?',
    answers: [
      'Переслать всем коллегам',
      'Сообщить специалисту по безопасности',
      'Открыть вложение',
    ],
    correct: 1,
  },
  {
    id: 'c2',
    title: 'Основы кадровых заявок',
    category: 'Вводный курс',
    duration: '8 минут',
    summary: 'Как подать и отследить заявку',
    material:
      'Создайте заявку на отпуск в разделе «Заявки». Укажите даты и при необходимости комментарий. После отправки руководитель увидит запрос. Отслеживайте статус в списке заявок и в уведомлениях.',
    question: 'Где проверить решение по отпуску?',
    answers: ['В разделе «Заявки»', 'Только по телефону', 'В настройках'],
    correct: 0,
  },
];

const bootstrapPassword = process.env.DEMO_PASSWORD || crypto.randomBytes(18).toString('base64url');

function hash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
}

function valid(password, stored) {
  const [salt, digest] = (stored || '').split(':');
  if (!salt || !digest) return false;

  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function demoData() {
  return buildDemo(users, courses, hash, bootstrapPassword);
}

function save() {
  const temporaryFile = FILE + '.tmp';
  fs.writeFileSync(temporaryFile, JSON.stringify(db, null, 2));
  fs.renameSync(temporaryFile, FILE);
}

fs.mkdirSync(path.dirname(FILE), { recursive: true });
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(demoData(), null, 2));

let db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (db.presentationNamesVersion !== 1) {
  const backupFile = FILE + '.before-cats.backup';
  if (!fs.existsSync(backupFile)) fs.copyFileSync(FILE, backupFile);
  applyCatNames(db, personnel);
}

for (const user of users) {
  if (!db.users.some((existingUser) => existingUser.id === user.id))
    db.users.push({ ...user, pass: hash(bootstrapPassword) });
}

migrateDemo(db, demoData());
if (!db.assignments) {
  db.assignments = db.users.flatMap((user) =>
    courses.slice(0, 1).map((course) => ({
      userId: user.id,
      courseId: course.id,
      assignedAt: new Date().toISOString(),
    })),
  );
  save();
}

const integrations = createIntegrations(db);
if (!db.integrations.lastPersonnelSync) integrations.personnelProvider.sync('system');
for (const request of db.requests) {
  if (!request.externalId)
    request.externalId = integrations.workflowAdapter.submitLeave(request, 'system').externalId;
}
save();

function sessionCookie(value, maxAge) {
  const secureFlag = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `sid=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureFlag}`;
}

function viewerCanSee(request, user) {
  return (
    request.ownerId === user.id ||
    user.role === 'hr' ||
    (user.role === 'manager' &&
      db.users.some((member) => member.id === request.ownerId && member.managerId === user.id))
  );
}

function canDecide(request, user) {
  if (request.ownerId === user.id) return false;
  if (request.status === 'hr_pending') return user.role === 'hr';
  return (
    request.status === 'pending' &&
    (user.role === 'manager' || user.role === 'hr') &&
    db.users.some((member) => member.id === request.ownerId && member.managerId === user.id)
  );
}

const api = createApi({
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
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const STATIC_FILES = {
  '/cat-avatars.png': 'cat-avatars.png',
  '/': 'index.html',
  '/app.js': 'app.js',
  '/js/core.js': 'js/core.js',
  '/js/auth.js': 'js/auth.js',
  '/js/navigation.js': 'js/navigation.js',
  '/js/views.js': 'js/views.js',
  '/js/dashboard.js': 'js/dashboard.js',
  '/js/learning.js': 'js/learning.js',
  '/js/notifications.js': 'js/notifications.js',
  '/js/pages.js': 'js/pages.js',
  '/js/dialogs.js': 'js/dialogs.js',
  '/js/events.js': 'js/events.js',
  '/styles.css': 'styles.css',
  '/css/base.css': 'css/base.css',
  '/css/workspace.css': 'css/workspace.css',
  '/css/theme.css': 'css/theme.css',
  '/css/features.css': 'css/features.css',
  '/favicon.svg': 'favicon.svg',
  '/logo.svg': 'logo.svg',
  '/i18n.js': 'i18n.js',
};

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Метод не поддерживается' });

  const fileName = STATIC_FILES[pathname];
  if (!fileName) return send(res, 404, { error: 'Файл не найден' });

  const filePath = path.join(STATIC, fileName);
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    if (error instanceof SyntaxError) return send(res, 400, { error: 'Некорректный JSON' });
    console.error(error);
    send(res, 500, { error: 'Ошибка сервера' });
  }
});

if (require.main === module) {
  server.listen(PORT, () =>
    console.log(
      `JanaMen: http://localhost:${PORT}\nDemo roles: use quick login buttons. No shared password in source.`,
    ),
  );
}

module.exports = { server, viewerCanSee, canDecide, days };
