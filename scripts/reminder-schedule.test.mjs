import test from 'node:test';
import assert from 'node:assert/strict';
import { getFirstRunAt, getNextRunAt, shouldAutoComplete, resolveReminderRecipient } from '../src/lib/reminders/schedule.ts';

const schedule = (extra = {}) => ({
  firstRunAt: new Date('2026-11-11T03:30:00Z'),
  frequency: 'DAILY', timeZone: 'Asia/Kolkata', enabled: true, ...extra,
});
const next = (s, now) => getNextRunAt(s, 'ACTIVE', new Date(now))?.toISOString() ?? null;

test('offset and dateless anchors validate their inputs', () => {
  assert.equal(getFirstRunAt(new Date('2026-11-12T10:00Z'), -60).toISOString(), '2026-11-12T09:00:00.000Z');
  assert.equal(getFirstRunAt(null, null, new Date('2026-11-12T10:00Z')).toISOString(), '2026-11-12T10:00:00.000Z');
  assert.throws(() => getFirstRunAt(null, -60));
});
test('once stops after processing; late sends do not shift daily schedules', () => {
  assert.equal(next(schedule({ frequency: 'ONCE' }), '2026-11-11T03:30Z'), '2026-11-11T03:30:00.000Z');
  assert.equal(next(schedule({ frequency: 'ONCE', lastScheduledFor: new Date('2026-11-11T03:30Z') }), '2026-11-11T03:30Z'), null);
  assert.equal(next(schedule({ lastScheduledFor: new Date('2026-11-11T03:30Z') }), '2026-11-11T04:15Z'), '2026-11-12T03:30:00.000Z');
});
test('weekly selected days and fortnightly intervals', () => {
  assert.equal(next(schedule({ frequency: 'WEEKLY', rule: { weekdays: [1, 3] } }), '2026-11-12T00:00Z'), '2026-11-16T03:30:00.000Z');
  assert.equal(next(schedule({ frequency: 'WEEKLY', rule: { interval: 2, weekdays: [1, 3] } }), '2026-11-12T00:00Z'), '2026-11-23T03:30:00.000Z');
});
test('monthly 31st and leap day skip invalid dates', () => {
  assert.equal(next(schedule({ firstRunAt: new Date('2026-01-31T03:30Z'), frequency: 'MONTHLY' }), '2026-02-01T00:00Z'), '2026-03-31T03:30:00.000Z');
  assert.equal(next(schedule({ firstRunAt: new Date('2024-02-29T03:30Z'), frequency: 'YEARLY' }), '2025-01-01T00:00Z'), '2028-02-29T03:30:00.000Z');
});
test('DST preserves local clock, skips gaps and chooses one repeated time', () => {
  assert.equal(next(schedule({ firstRunAt: new Date('2026-03-07T14:00Z'), timeZone: 'America/New_York' }), '2026-03-08T00:00Z'), '2026-03-08T13:00:00.000Z');
  assert.equal(next(schedule({ firstRunAt: new Date('2026-03-07T07:30Z'), timeZone: 'America/New_York' }), '2026-03-08T00:00Z'), '2026-03-09T06:30:00.000Z');
  assert.equal(next(schedule({ firstRunAt: new Date('2026-10-31T05:30Z'), timeZone: 'America/New_York', lastScheduledFor: new Date('2026-11-01T05:30Z') }), '2026-11-01T05:45Z'), '2026-11-02T06:30:00.000Z');
});
test('disabled, completed, cancelled and expired reminders stop', () => {
  assert.equal(next(schedule({ enabled: false }), '2026-11-11T00:00Z'), null);
  for (const status of ['COMPLETED', 'CANCELLED']) assert.equal(getNextRunAt(schedule(), status), null);
  assert.equal(next(schedule({ repeatUntil: new Date('2026-11-11T03:30Z') }), '2026-11-12T00:00Z'), null);
  assert.throws(() => next(schedule({ rule: { interval: 0 } }), '2026-11-11T00:00Z'));
});
test('automatic completion requires opt-in, active status and a reached deadline', () => {
  const event = { status: 'ACTIVE', autoCompleteOnDue: true, dueAt: new Date('2026-11-11T10:00Z') };
  const now = new Date('2026-11-11T10:00Z');
  assert.equal(shouldAutoComplete(event, now), true);
  assert.equal(shouldAutoComplete({ ...event, autoCompleteOnDue: false }, now), false);
  assert.equal(shouldAutoComplete({ ...event, dueAt: null }, now), false);
  assert.equal(shouldAutoComplete({ ...event, status: 'COMPLETED' }, now), false);
});
test('recipient must be the active event owner', async () => {
  const owner = { id: 'owner', email: 'owner@example.com', isActive: true };
  assert.deepEqual(await resolveReminderRecipient('owner', async () => owner), owner);
  assert.equal(await resolveReminderRecipient('owner', async () => ({ ...owner, isActive: false })), null);
  assert.equal(await resolveReminderRecipient('other', async () => owner), null);
});
