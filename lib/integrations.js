'use strict';
const personnel = require('../fixtures/personnel.json');
const FIELDS = ['name', 'company', 'title', 'department', 'managerId', 'hired', 'leaveDays'];

function createIntegrations(db) {
  db.integrations ??= { documents: [], events: [], lastPersonnelSync: null };
  const state = db.integrations;
  state.connections ??= [];
  function log(system, operation, externalId, actorId) {
    state.events.unshift({
      id: require('node:crypto').randomUUID(),
      system,
      operation,
      externalId,
      actorId,
      at: new Date().toISOString(),
    });
    state.events = state.events.slice(0, 200);
  }
  const personnelProvider = {
    mode: 'mock',
    getEmployee(id) {
      const source = personnel.find((p) => p.id === id);
      return source ? { ...source } : null;
    },
    getLeaveBalance(id) {
      return this.getEmployee(id)?.leaveDays ?? null;
    },
    sync(actorId) {
      let updated = 0;
      for (const employee of personnel) {
        const target = db.users.find((u) => u.id === employee.id);
        if (!target) continue;
        for (const field of FIELDS) target[field] = employee[field];
        updated++;
      }
      state.lastPersonnelSync = new Date().toISOString();
      log('1c-zup', 'personnel.read', null, actorId);
      return { mode: 'mock', updated, at: state.lastPersonnelSync };
    },
  };
  const workflowAdapter = {
    mode: 'mock',
    submitLeave(request, actorId) {
      let document = state.documents.find((d) => d.requestId === request.id);
      if (document) {
        log('documentolog', 'workflow.replayed', document.externalId, actorId);
        return { ...document };
      } // request.id is the idempotency key.
      document = {
        externalId: 'DOC-' + request.id,
        requestId: request.id,
        ownerId: request.ownerId,
        type: 'leave',
        start: request.start,
        end: request.end,
        status: request.status,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      state.documents.push(document);
      log('documentolog', 'workflow.submit', document.externalId, actorId);
      return { ...document };
    },
    getStatus(externalId) {
      const d = state.documents.find((d) => d.externalId === externalId);
      return d ? { ...d } : null;
    },
    decide(externalId, status, actorId) {
      const d = state.documents.find((d) => d.externalId === externalId);
      if (!d) throw Error('Mock workflow not found');
      if (d.status === status) return { ...d };
      if (d.status !== 'pending' || !['approved', 'rejected'].includes(status))
        throw Error('Invalid workflow transition');
      d.status = status;
      d.version++;
      d.updatedAt = new Date().toISOString();
      log('documentolog', 'workflow.decision', externalId, actorId);
      return { ...d };
    },
  };
  return {
    personnelProvider,
    workflowAdapter,
    configure(input, actorId) {
      if (!['1c-zup', 'documentolog'].includes(input.system)) throw Error('Выберите систему');
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80)
        throw Error('Укажите название до 80 символов');
      let endpoint;
      try {
        endpoint = new URL(input.endpoint);
      } catch {
        throw Error('Укажите корректный HTTPS-адрес');
      }
      if (
        endpoint.protocol !== 'https:' ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash ||
        endpoint.href.length > 500
      )
        throw Error('Нужен HTTPS-адрес без пароля, параметров и фрагмента');
      const connection = {
        system: input.system,
        name: input.name.trim(),
        endpoint: endpoint.href,
        status: 'adapter_required',
        updatedAt: new Date().toISOString(),
      };
      const index = state.connections.findIndex((c) => c.system === input.system);
      if (index >= 0) state.connections[index] = connection;
      else state.connections.push(connection);
      log(input.system, 'connection.configured', null, actorId);
      return { ...connection };
    },
    summary() {
      return {
        mode: 'mock',
        connections: state.connections.map((c) => ({ ...c })),
        lastPersonnelSync: state.lastPersonnelSync,
        documents: state.documents.map((d) => ({ ...d })),
        events: state.events.map((e) => ({ ...e })),
      };
    },
  };
}
module.exports = { createIntegrations };
