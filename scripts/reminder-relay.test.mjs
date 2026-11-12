import test from 'node:test';
import assert from 'node:assert/strict';
import { handleReminderCron } from '../supabase/functions/reminder-cron/handler.js';

const config = { edgeSecret: 'edge-test-secret', apiSecret: 'api-test-secret', apiUrl: 'https://example.com/api/cron/reminders' };
const request = (authorization = 'Bearer edge-test-secret', method = 'POST') => new Request('https://example.supabase.co/functions/v1/reminder-cron', { method, headers: { authorization } });
test('relay rejects missing/incorrect authentication without invoking the API', async () => {
  for (const token of ['', 'Bearer wrong', 'Bearer ééé']) {
    assert.equal((await handleReminderCron(request(token), config, () => assert.fail('Must not call API'))).status, 401);
  }
});
test('relay requires POST, complete configuration and fixed HTTPS endpoint', async () => {
  assert.equal((await handleReminderCron(request('', 'GET'), config)).status, 405);
  assert.equal((await handleReminderCron(request(), { ...config, apiSecret: '' })).status, 503);
  for (const apiUrl of ['http://example.com/api/cron/reminders', 'https://example.com/other', 'https://example.com/api/cron/reminders?token=secret']) {
    assert.equal((await handleReminderCron(request(), { ...config, apiUrl })).status, 503);
  }
});
test('relay calls existing API using its separate token and reports safe counters', async () => {
  const result = await handleReminderCron(request(), config, async (url, init) => {
    assert.equal(url, config.apiUrl); assert.equal(init.method, 'GET');
    assert.equal(init.headers.Authorization, 'Bearer api-test-secret'); assert.equal(init.redirect, 'error');
    return Response.json({ autoCompleted: 1, processed: 2, errors: 0, secret: 'must-not-forward' });
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { autoCompleted: 1, processed: 2, errors: 0 });
});
test('relay surfaces HTTP, worker and network failures without leaking upstream content', async () => {
  for (const fetcher of [async () => new Response('sensitive upstream text', { status: 401 }), async () => { throw new Error('sensitive error'); }, async () => Response.json({ autoCompleted: 0, processed: 0, errors: 1 }), async () => Response.json({ invalid: true })]) {
    const result = await handleReminderCron(request(), config, fetcher);
    assert.equal(result.status, 502); assert.ok(!(await result.text()).includes('sensitive'));
  }
});
