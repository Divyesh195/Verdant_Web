import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Load real TypeScript modules with isolated I/O adapters. No real mail or database calls.
function load(path, overrides = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in overrides ? overrides[name] : require(name), module, module.exports);
  return module.exports;
}
const schedule = load('src/lib/reminders/schedule.ts');
const input = load('src/lib/events/input.ts', { '../reminders/schedule': schedule });
const now = new Date('2026-11-11T00:00:00Z');
const remind = { frequency: 'ONCE', firstRunAt: '2026-11-12T10:00:00Z', channels: ['EMAIL'] };

test('accepts dateless events, custom categories and multiple offset reminders', () => {
  assert.equal(input.parseEvent({ title: 'Shopping', category: 'Custom category', reminders: [remind] }, now).startsAt, null);
  const data = input.parseEvent({ title: 'Meeting', startsAt: '2026-11-12T12:00Z', reminders: [
    { ...remind, target: 'START', offsetMinutes: -60 }, { ...remind, target: 'START', offsetMinutes: -10 },
  ] }, now);
  assert.deepEqual(data.reminders.map(r => r.firstRunAt.toISOString()), ['2026-11-12T11:00:00.000Z', '2026-11-12T11:50:00.000Z']);
});
test('rejects ambiguous dates, unsafe URLs, invalid recurrence and missing targets', () => {
  for (const patch of [{ dueAt: '2026-11-12T10:00' }, { url: 'javascript:alert(1)' },
    { autoCompleteOnDue: true }, { endsAt: '2026-11-12T10:00Z' },
    { reminders: [{ ...remind, channels: [] }] }, { reminders: [{ ...remind, frequency: 'HOURLY' }] },
    { reminders: [{ ...remind, target: 'DUE', offsetMinutes: -60 }] },
    { reminders: [{ ...remind, timeZone: 'Not/AZone' }] },
    { reminders: [{ ...remind, rule: { weekdays: [9] } }] },
    { reminders: [{ ...remind, repeatUntil: '2026-11-11T00:00Z' }] }]) {
    assert.throws(() => input.parseEvent({ title: 'Test', ...patch }, now), input.InputError);
  }
});

function memory({ channels = ['EMAIL'], alreadyLocked = false, auto = false } = {}) {
  const state = { sends: [], rows: [], subscriptionActive: true, alreadyLocked };
  const event = { id: 'event', userId: 'owner', title: 'Pay bill', notes: null, dueAt: auto ? new Date(Date.now() - 60_000) : null, status: 'ACTIVE', autoCompleteOnDue: auto };
  const reminder = { id: 'reminder', eventId: event.id, event, frequency: 'DAILY', firstRunAt: new Date(Date.now() - 86_400_000),
    nextRunAt: new Date(Date.now() - 86_400_000), lastScheduledFor: null, enabled: true, channels, timeZone: 'Asia/Kolkata', rule: null, repeatUntil: null };
  const pending = row => row.status === 'PENDING' || row.status === 'FAILED';
  const db = {
    $queryRaw: async () => [],
    $transaction: async work => typeof work === 'function' ? work(db) : Promise.all(work),
    event: {
      findMany: async () => auto && event.status === 'ACTIVE' ? [{ id: event.id }] : [],
      findUnique: async () => event,
      update: async ({ data }) => Object.assign(event, data),
    },
    user: { findUnique: async () => ({ id: 'owner', email: 'owner@example.com', isActive: true }) },
    emailPreference: { findUnique: async () => null },
    pushSubscription: {
      findMany: async () => state.subscriptionActive ? [{ id: 'device', endpoint: 'https://fcm.googleapis.com/test', p256dh: 'test', auth: 'test' }] : [],
      findFirst: async () => state.subscriptionActive ? { id: 'device', endpoint: 'test', p256dh: 'test', auth: 'test' } : null,
      update: async () => { state.subscriptionActive = false; },
    },
    reminder: {
      findMany: async () => reminder.enabled && event.status === 'ACTIVE' ? [{ id: reminder.id, eventId: event.id }] : [],
      findUnique: async () => reminder,
      count: async () => state.alreadyLocked ? 1 : 0,
      updateMany: async ({ where, data }) => {
        if (where?.lockToken && where.lockToken !== reminder.lockToken) return { count: 0 };
        if (where?.nextRunAt && state.alreadyLocked) return { count: 0 };
        Object.assign(reminder, data); return { count: 1 };
      },
      update: async ({ data }) => Object.assign(reminder, data),
    },
    reminderDelivery: {
      count: async ({ where }) => where.status ? state.rows.filter(pending).length : state.rows.length,
      createMany: async ({ data }) => { state.rows.push(...data.map((d, i) => ({ id: 'd' + i, attemptCount: 0, ...d }))); },
      findMany: async () => state.rows.filter(pending),
      updateMany: async ({ data }) => { state.rows.filter(pending).forEach(r => Object.assign(r, data)); },
      update: async ({ where, data }) => {
        const row = state.rows.find(r => r.id === where.id);
        Object.assign(row, { ...data, ...(typeof data.attemptCount === 'object' ? { attemptCount: row.attemptCount + data.attemptCount.increment } : {}) });
        return row;
      },
    },
  };
  return { db, state, reminder, event };
}
function worker(fixture, sendPush = async () => {}) {
  return load('src/lib/reminders/worker.ts', {
    '@/lib/prisma': fixture.db, './schedule': schedule,
    './delivery': {
      isQuietHour: () => false,
      sendEmail: async () => { fixture.state.sends.push('email'); },
      sendPush: async () => { fixture.state.sends.push('push'); await sendPush(); },
    },
  });
}
test('worker records success and advances an overdue occurrence without replaying missed days', async () => {
  const f = memory();
  const result = await worker(f).runReminders();
  assert.equal(result.processed, 1); assert.deepEqual(f.state.sends, ['email']);
  assert.equal(f.state.rows[0].status, 'SENT'); assert.ok(f.reminder.lastSentAt);
  assert.ok(f.reminder.nextRunAt >= new Date()); assert.equal(f.reminder.lockToken, null);
});
test('failed push retries without resending the successful email', async () => {
  const f = memory({ channels: ['EMAIL', 'WEB_PUSH'] });
  let fail = true;
  const w = worker(f, async () => { if (fail) throw new Error('Temporary failure'); });
  await w.runReminders();
  assert.deepEqual(f.state.sends, ['email', 'push']);
  assert.equal(f.state.rows[1].status, 'FAILED'); assert.equal(f.reminder.lastScheduledFor, null);
  f.state.rows[1].nextAttemptAt = new Date(0); fail = false;
  await w.runReminders();
  assert.deepEqual(f.state.sends, ['email', 'push', 'push']); assert.ok(f.reminder.lastScheduledFor);
});
test('worker leaves a claimed reminder alone', async () => {
  const f = memory({ alreadyLocked: true });
  await worker(f).runReminders(); assert.deepEqual(f.state.sends, []);
});
test('automatic completion suppresses reminders and preserves the event', async () => {
  const f = memory({ auto: true });
  const result = await worker(f).runReminders();
  assert.equal(result.autoCompleted, 1); assert.equal(f.event.status, 'COMPLETED');
  assert.equal(f.event.completionSource, 'AUTOMATIC'); assert.equal(f.reminder.nextRunAt, null);
  assert.deepEqual(f.state.sends, []);
});
test('expired browser subscriptions are retired rather than retried', async () => {
  const f = memory({ channels: ['WEB_PUSH'] });
  await worker(f, async () => { throw { statusCode: 410 }; }).runReminders();
  assert.equal(f.state.subscriptionActive, false); assert.equal(f.state.rows[0].status, 'CANCELLED');
  assert.ok(f.reminder.lastScheduledFor);
});

const { NextResponse } = require('next/server');
const http = {
  ownerId: async () => 'owner', body: request => request.json(),
  failure: error => NextResponse.json({ error: error.message }, { status: 400 }),
};
test('event update scopes reads to authenticated owner and rejects another owner', async () => {
  const db = { $transaction: async work => work(db), $queryRaw: async () => [], event: { findFirst: async ({ where }) => { assert.deepEqual(where, { id: 'foreign-event', userId: 'owner' }); return null; } } };
  const route = load('src/app/api/events/[id]/route.ts', { '@/lib/prisma': db, '@/lib/events/http': http, '@/lib/events/input': input });
  const result = await route.PATCH(new Request('https://example.com/api/events/foreign-event', { method: 'PATCH', body: JSON.stringify({ action: 'complete' }) }), { params: Promise.resolve({ id: 'foreign-event' }) });
  assert.equal(result.status, 400); assert.equal((await result.json()).error, 'Event not found.');
});
test('follow-up retries return existing successor without creating another', async () => {
  const db = { $transaction: async work => work(db), $queryRaw: async () => [], event: { findFirst: async () => ({ status: 'COMPLETED', nextEvent: { id: 'successor' } }) } };
  const route = load('src/app/api/events/[id]/route.ts', { '@/lib/prisma': db, '@/lib/events/http': http, '@/lib/events/input': input });
  const result = await route.PATCH(new Request('https://example.com/api/events/event', { method: 'PATCH', body: JSON.stringify({ action: 'followup' }) }), { params: Promise.resolve({ id: 'event' }) });
  assert.equal(result.status, 200); assert.equal((await result.json()).event.id, 'successor');
});
