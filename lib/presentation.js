'use strict';
const legacy = require('../fixtures/legacy-demo-names.json');
function applyCatNames(db, personnel) {
  if (db.presentationNamesVersion === 1) return false;
  const replacements = new Map();
  for (const entry of personnel) {
    const user = db.users.find((u) => u.id === entry.id);
    if (!user) continue;
    if (legacy[entry.id]) replacements.set(legacy[entry.id], entry.name);
    if (user.name && user.name !== entry.name) replacements.set(user.name, entry.name);
    user.name = entry.name;
  }

  for (const n of db.notifications || []) {
    for (const [before, after] of replacements) n.text = n.text.split(before).join(after);
  }
  for (const r of db.requests || []) {
    if (typeof r.note === 'string')
      for (const [before, after] of replacements) r.note = r.note.split(before).join(after);
  }
  db.presentationNamesVersion = 1;
  return true;
}
module.exports = { applyCatNames };
