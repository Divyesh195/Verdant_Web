import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

for (const path of ['.env.development.local', '.env.local', '.env']) dotenv.config({ path, quiet: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });
const userId = randomUUID();
const rollback = new Error('ROLLBACK_TEST_FIXTURE');
try {
  await prisma.$transaction(async tx => {
    await tx.user.create({ data: { id: userId, email: `events-test-${userId}@example.invalid` } });
    const dueAt = new Date(Date.now() + 86_400_000);
    const event = await tx.event.create({ data: { userId, title: 'Temporary smoke test', dueAt, requestKey: 'test-request' } });
    const expectConstraint = async work => {
      await tx.$executeRawUnsafe('SAVEPOINT expected_constraint');
      let rejected = false;
      try { await work(); } catch { rejected = true; }
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT expected_constraint');
      assert.ok(rejected, 'Database constraint must reject invalid data');
    };
    await expectConstraint(() => tx.event.create({ data: { userId, title: 'Duplicate request', requestKey: 'test-request' } }));
    await expectConstraint(() => tx.event.create({ data: { userId, title: 'Missing deadline', autoCompleteOnDue: true } }));
    const reminders = await Promise.all([1, 5].map(day => tx.reminder.create({ data: {
      eventId: event.id, frequency: 'WEEKLY', channels: ['EMAIL'], target: 'DUE', offsetMinutes: 0,
      firstRunAt: dueAt, nextRunAt: dueAt, rule: { weekdays: [day] },
    } })));
    assert.equal(reminders.length, 2, 'Different weekly schedules must coexist');
    const delivery = { reminderId: reminders[0].id, channel: 'WEB_PUSH', scheduledFor: dueAt };
    await tx.reminderDelivery.createMany({ data: [{ ...delivery, recipientKey: 'device-a' }, { ...delivery, recipientKey: 'device-b' }] });
    await expectConstraint(() => tx.reminderDelivery.create({ data: { ...delivery, recipientKey: 'device-a' } }));
    assert.equal(await tx.event.findFirst({ where: { id: event.id, userId: randomUUID() } }), null);
    await tx.event.update({ where: { id: event.id }, data: { status: 'COMPLETED', completedAt: new Date(), completionSource: 'MANUAL' } });
    const next = await tx.event.create({ data: { title: event.title, userId, dueAt, previousEventId: event.id } });
    await expectConstraint(() => tx.event.create({ data: { title: 'Duplicate successor', userId, previousEventId: event.id } }));
    assert.equal((await tx.event.findUnique({ where: { id: event.id } })).status, 'COMPLETED');
    assert.equal(next.previousEventId, event.id);
    throw rollback;
  }, { timeout: 30_000 });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  assert.equal(await prisma.user.findUnique({ where: { id: userId } }), null, 'All smoke-test data must roll back');
  await prisma.$disconnect();
}
console.log('Database smoke checks passed; all temporary records rolled back.');
