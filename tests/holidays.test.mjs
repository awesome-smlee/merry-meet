import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeHolidays, holidayLabel } from '../lib/holidays.mjs';

const snapshot = JSON.parse(
  readFileSync(
    new URL('../lib/data/korean-holidays.json', import.meta.url),
    'utf8',
  ),
);

test('holiday snapshot includes lunar holiday spans and substitute holidays', () => {
  const calendar = normalizeHolidays(snapshot);
  assert.deepEqual(calendar['2026']['2026-02-16'], ['설날 전날']);
  assert.deepEqual(calendar['2026']['2026-02-17'], ['설날']);
  assert.deepEqual(calendar['2026']['2026-02-18'], ['설날 다음 날']);
  assert.deepEqual(calendar['2026']['2026-09-24'], ['추석 전날']);
  assert.deepEqual(calendar['2026']['2026-09-25'], ['추석']);
  assert.deepEqual(calendar['2026']['2026-09-26'], ['추석 다음 날']);
  assert.deepEqual(calendar['2026']['2026-10-05'], ['대체공휴일(개천절)']);
  assert.equal(calendar['2026']['2026-10-23'], undefined);
  assert.ok(calendar['2027']);
});

test('calendar rejects malformed dates, mismatched years and empty upstream data', () => {
  for (const data of [
    {},
    [],
    { 2026: {} },
    { 2026: { '2026-02-30': ['공휴일'] } },
    { 2026: { '2027-01-01': ['공휴일'] } },
    { 2026: { '2026-01-01': [] } },
    { 2026: { '2026-01-01': [''] } },
  ]) {
    assert.throws(() => normalizeHolidays(data));
  }
});

test('overlapping holidays keep all names and compact labels do not mutate data', () => {
  const names = ['어린이날', '부처님 오신 날'];
  const calendar = normalizeHolidays({ 2025: { '2025-05-05': names } });
  assert.deepEqual(calendar['2025']['2025-05-05'], names);
  assert.equal(holidayLabel(names), '어린이날 · 부처님 오신 날');
  assert.equal(holidayLabel(['대체공휴일(개천절)']), '대체공휴일');
});
