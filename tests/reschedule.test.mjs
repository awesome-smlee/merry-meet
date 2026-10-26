import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { koreaToday } from '../lib/meeting.mjs';
import { applyReschedule, recordMeetingChange } from '../lib/meeting-updates.mjs';
import { POST } from '../app/api/meeting/route.js';

test('demo rescheduling preserves places and responses and rejects stale changes', () => {
  const confirmed = `${koreaToday()}|10:00`, slot = `${koreaToday()}|11:00`;
  const state = { me: 'a', members: [{ id: 'a', slots: [confirmed] }], confirmed, confirmedPlace: 'p', places: [{ id: 'p' }], placeVotes: { a: ['p'] } };
  const next = applyReschedule(state, { slot, expectedConfirmed: confirmed });
  assert.deepEqual(next, { ...state, confirmed: slot });
  assert.equal(state.confirmed, confirmed);
  const history = recordMeetingChange(state, next, 'change').changes[0];
  assert.equal(history.from.place.id, history.to.place.id);
  assert.equal(history.to.slot, slot);
  assert.throws(() => applyReschedule(next, { slot, expectedConfirmed: confirmed }));
  assert.throws(() => applyReschedule({ ...state, me: null }, { slot, expectedConfirmed: confirmed }));
  assert.throws(() => applyReschedule(state, { slot: 'invalid', expectedConfirmed: confirmed }));
});

test('database reschedules atomically, retaining confirmed place, votes and responses', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase.sql', import.meta.url), 'utf8'));
    const call = async (action, payload = [], slot = null, token = 'a') => (await db.query('select meeting_action($1,$2,$3,$4,$5::jsonb,$6) as s', ['reschedule-room', action, token, token, JSON.stringify(payload), slot])).rows[0].s;
    const confirmed = `${koreaToday()}|10:00`, slot = `${koreaToday()}|11:00`;
    await call('join');
    await assert.rejects(call('reschedule', { expectedConfirmed: confirmed }, slot));
    await call('save', [confirmed]);
    await call('confirm', [], confirmed);
    const added = await call('place-add', { name: 'Cafe', region: 'Seoul', address: 'Seoul', url: 'https://naver.me/example' });
    const id = added.places[0].id;
    await call('place-vote', { id });
    const before = await call('place-confirm', { id });
    await assert.rejects(call('reschedule', { expectedConfirmed: confirmed }, slot, 'forged'));
    for (const invalid of ['invalid', '2027-02-30|10:00', '2020-01-01|10:00', `${koreaToday()}|08:00`, `${koreaToday()}|10:15`]) {
      await assert.rejects(call('reschedule', { expectedConfirmed: confirmed }, invalid));
    }
    const after = await call('reschedule', { expectedConfirmed: confirmed }, slot);
    assert.equal(after.confirmed, slot);
    for (const key of ['confirmedPlace', 'places', 'placeVotes', 'regionVotes', 'members']) assert.deepEqual(after[key], before[key]);
    assert.equal(after.changes.length, before.changes.length + 1);
    assert.equal(after.changes[0].from.place.id, after.changes[0].to.place.id);
    await assert.rejects(call('reschedule', { expectedConfirmed: confirmed }, confirmed));
    assert.equal((await call('read')).confirmed, slot);
    await assert.rejects(call('save', [slot]));
    await assert.rejects(call('save', [slot], confirmed));
    const availability = await call('save', [confirmed, slot], slot);
    assert.deepEqual(availability.members[0].slots, [confirmed, slot]);
    assert.equal(availability.confirmed, slot);
    assert.equal(availability.confirmedPlace, id);
    assert.deepEqual(availability.placeVotes, after.placeVotes);
    assert.deepEqual(availability.changes, after.changes);
    await call('unconfirm');
    await assert.rejects(call('save', [slot], slot));
    await assert.rejects(call('reschedule', { expectedConfirmed: slot }, confirmed));
  } finally { await db.close(); }
});

test('API validates and forwards rescheduling through authenticated RPC', async t => {
  const originalEnv = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'test', MEETING_ID: 'test-room' });
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push(JSON.parse(options.body)); return Response.json({ members: [] }); };
  const payload = { slot: `${koreaToday()}|11:00`, expectedConfirmed: `${koreaToday()}|10:00` };
  const request = (body, origin = 'http://localhost') => new Request('http://localhost/api/meeting', { method: 'POST', headers: { origin }, body: JSON.stringify({ room: 'test-room', action: 'reschedule', token: 'a'.repeat(64), ...body }) });
  assert.equal((await POST(request({ payload }))).status, 200);
  assert.equal(calls[0].p_action, 'reschedule');
  assert.equal(calls[0].p_slot, payload.slot);
  assert.deepEqual(calls[0].p_slots, { expectedConfirmed: payload.expectedConfirmed });
  assert.equal((await POST(request({ payload, token: null }))).status, 401);
  assert.equal((await POST(request({ payload }, 'https://other.example'))).status, 403);
  assert.equal((await POST(request({ payload: { ...payload, slot: 'invalid' } }))).status, 400);
  assert.equal(calls.length, 1);
  assert.equal((await POST(request({ action: 'save', slots: [payload.slot], slot: payload.expectedConfirmed }))).status, 200);
  assert.equal(calls[1].p_action, 'save');
  assert.equal(calls[1].p_slot, payload.expectedConfirmed);
  assert.deepEqual(calls[1].p_slots, [payload.slot]);
});
