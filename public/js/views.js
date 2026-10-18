function heading(h, p, action = '') {
  return `<div class="headline flex"><div><h1>${h}</h1><p>${p}</p></div>${action}</div>`;
}

function requestRows(items) {
  if (!items.length) return '<div class="empty">Заявок пока нет. Создайте первую заявку.</div>';

  const rows = items
    .map((request) =>
      [
        '<tr>',
        `<td><b>${esc(request.ownerName)}</b><div class="muted">Отпуск</div></td>`,
        `<td>${esc(request.start)} — ${esc(request.end)}</td>`,
        `<td>${new Date(request.createdAt).toLocaleDateString(uiLocale())}</td>`,
        `<td><span class="chip ${request.status}">${status[request.status]}</span></td>`,
        `<td><button class="ghost mini" data-request="${esc(request.id)}">Подробнее →</button></td>`,
        '</tr>',
      ].join(''),
    )
    .join('');

  return [
    '<div class="tablewrap"><table class="table"><thead><tr>',
    '<th>Сотрудник</th><th>Период</th><th>Дата подачи</th><th>Статус</th><th>Действия</th>',
    `</tr></thead><tbody>${rows}</tbody></table></div>`,
  ].join('');
}

function dateLabel(value) {
  return new Date(value + 'T00:00:00').toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'short',
  });
}
