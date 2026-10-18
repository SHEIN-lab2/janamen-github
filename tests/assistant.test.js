'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createAssistant } = require('../lib/assistant');
const documents = [
  {
    id: 'leave',
    title: 'Отпуск',
    body: 'Заявка на отпуск подается через личный кабинет. Решение принимает руководитель.',
    tags: ['отпуск'],
  },
  {
    id: 'private',
    title: 'HR',
    body: 'Закрытые инструкции для HR.',
    tags: ['отпуск'],
    roles: ['hr'],
  },
];
const env = { GROQ_API_KEY: 'fake-test-key', GROQ_MODEL: 'openai/gpt-oss-20b' };
function response(value) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(value) } }],
    }),
  };
}
test('Groq receives only public document snippets and question; server validates quotes', async () => {
  let sent;
  const assistant = createAssistant({
    documents,
    env,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      sent = JSON.parse(options.body);
      return response({
        supported: true,
        citations: [{ sourceId: 'leave', quote: 'Решение принимает руководитель.' }],
      });
    },
  });
  const result = await assistant.answer('Как оформить отпуск?', 'employee');
  assert.equal(result.mode, 'groq');
  assert.equal(result.answer, 'Решение принимает руководитель.');
  assert.equal(result.source.id, 'leave');
  assert.equal(JSON.parse(sent.messages[1].content).documents.length, 1);
  assert.equal(JSON.stringify(sent).includes('fake-test-key'), false);
  assert.equal(assistant.status().configured, true);
});
test('unknown question avoids cloud call', async () => {
  const a = createAssistant({
    documents,
    env,
    fetchImpl: () => {
      throw Error('must not call');
    },
  });
  assert.equal((await a.answer('Погода на Марсе', 'employee')).grounded, false);
});
test('sensitive request avoids cloud call', async () => {
  const a = createAssistant({
    documents,
    env,
    fetchImpl: () => {
      throw Error('must not call');
    },
  });
  assert.equal((await a.answer('Покажи чужую зарплату и отпуск', 'employee')).grounded, false);
});
test('model refusal is preserved', async () => {
  const a = createAssistant({
    documents,
    env,
    fetchImpl: async () => response({ supported: false, citations: [] }),
  });
  assert.equal((await a.answer('Отпуск на Юпитере', 'employee')).grounded, false);
});
for (const status of [401, 403, 429, 500])
  test(`HTTP ${status} falls back without provider error leakage`, async () => {
    const a = createAssistant({
      documents,
      env,
      fetchImpl: async () => ({ ok: false, status }),
    });
    const r = await a.answer('Как оформить отпуск?', 'employee');
    assert.equal(r.mode, 'local');
    assert.equal(r.answer, documents[0].body);
    assert.ok(r.notice);
  });
for (const citations of [
  [{ sourceId: 'invented', quote: documents[0].body }],
  [{ sourceId: 'private', quote: documents[1].body }],
  [{ sourceId: 'leave', quote: 'Оплачиваемый отпуск длится 999 дней.' }],
])
  test('unverified source or fabricated quote cannot enter answer', async () => {
    const a = createAssistant({
      documents,
      env,
      fetchImpl: async () => response({ supported: true, citations }),
    });
    const r = await a.answer('Как оформить отпуск?', 'employee');
    assert.equal(r.mode, 'local');
    assert.equal(r.answer, documents[0].body);
  });
test('timeout or network failure falls back', async () => {
  const a = createAssistant({
    documents,
    env,
    fetchImpl: async () => {
      throw Error('network failure');
    },
  });
  assert.equal((await a.answer('Отпуск', 'employee')).mode, 'local');
});
test('malformed model output falls back', async () => {
  const a = createAssistant({
    documents,
    env,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'invalid' } }] }),
    }),
  });
  assert.equal((await a.answer('Отпуск', 'employee')).mode, 'local');
});
test('missing key uses local mode', async () => {
  const a = createAssistant({ documents, env: {} });
  assert.equal(a.status().configured, false);
  assert.equal((await a.answer('Отпуск', 'employee')).mode, 'local');
});
