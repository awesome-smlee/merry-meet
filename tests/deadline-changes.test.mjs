import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateDeadline, responsesClosed, applyDeadline, recordMeetingChange } from '../lib/meeting-updates.mjs';
import { POST } from '../app/api/meeting/route.js';

test('deadline uses the end of the Korean day, supports reopening, and validates dates', () => {
  const state = { members: [{ id: 'a', nickname: '친구' }], me: 'a', responseDeadline: '2026-10-29', allowLateResponses: false };
  assert.equal(responsesClosed(state, new Date('2026-10-29T14:59:59.999Z')), false);
  assert.equal(responsesClosed(state, new Date('2026-10-29T15:00:00.000Z')), true);
  assert.equal(responsesClosed({ ...state, allowLateResponses: true }, new Date('2026-11-01')), false);
  assert.equal(responsesClosed({ ...state, responseDeadline: null }, new Date('2026-11-01')), false);
  assert.throws(() => validateDeadline({ responseDeadline: '2026-02-30', allowLateResponses: false }));
  assert.throws(() => validateDeadline({ responseDeadline: null, allowLateResponses: 'false' }));
  assert.throws(() => applyDeadline({ ...state, me: null }, { responseDeadline: null, allowLateResponses: false }), /입장/);
  assert.equal(applyDeadline(state, { responseDeadline: null, allowLateResponses: false }).responseDeadline, null);
});

test('demo change history records snapshots, ignores unrelated edits and retains 30 changes', () => {
  const initial = { members: [{ id: 'a', nickname: '친구' }], me: 'a', confirmed: '2027-01-01|10:00', confirmedPlace: 'p', places: [{ id: 'p', name: '카페' }] };
  assert.equal(recordMeetingChange(initial, initial, 'same'), initial);
  let changed = recordMeetingChange(initial, { ...initial, confirmed: null, confirmedPlace: null, places: [] }, 'change-1');
  assert.equal(changed.changes[0].from.place.name, '카페');
  assert.equal(changed.changes[0].from.slot, initial.confirmed);
  assert.equal(changed.changes[0].to.slot, null);
  assert.equal(changed.changes[0].changedByName, '친구');
  for (let i = 0; i < 35; i++) changed = recordMeetingChange(changed, { ...changed, confirmed: changed.confirmed ? null : initial.confirmed }, `change-${i + 2}`);
  assert.equal(changed.changes.length, 30);
  assert.equal(changed.changes[0].id, 'change-36');
});

test('database enforces deadline and publishes room-scoped confirmation history', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase.sql', import.meta.url), 'utf8'));
    const call = async (action, payload = [], token = 'a', slot = null, room = 'deadlines') => (await db.query('select meeting_action($1,$2,$3,$4,$5::jsonb,$6) as s', [room, action, token, token, JSON.stringify(payload), slot])).rows[0].s;
    const dates = (await db.query("select ((clock_timestamp() at time zone 'Asia/Seoul')::date - 1)::text as yesterday, ((clock_timestamp() at time zone 'Asia/Seoul')::date)::text as today")).rows[0];
    const first = await call('join'); await call('join', [], 'b');
    assert.deepEqual(first.changes, []);
    await assert.rejects(call('deadline-set', { responseDeadline: dates.today, allowLateResponses: false }, 'forged'), /참여/);
    await assert.rejects(call('deadline-set', { responseDeadline: '2026-02-30', allowLateResponses: false }));
    await assert.rejects(call('deadline-set', { responseDeadline: null, allowLateResponses: 'false' }));
    const setting = await call('deadline-set', { responseDeadline: dates.today, allowLateResponses: false });
    assert.equal(setting.responseDeadline, dates.today);
    const slot = '2027-01-01|10:00';
    await call('save', [slot]);
    await call('deadline-set', { responseDeadline: dates.yesterday, allowLateResponses: false });
    await assert.rejects(call('save', []), /마감/);
    await assert.rejects(call('save', [], 'b'), /마감/);
    await call('deadline-set', { responseDeadline: dates.yesterday, allowLateResponses: true });
    await call('save', [slot]);
    await call('deadline-set', { responseDeadline: null, allowLateResponses: false });
    await call('save', [slot]);
    const confirmed = await call('confirm', [], 'a', slot);
    assert.equal(confirmed.changes[0].to.slot, slot);
    assert.equal(confirmed.changes[0].changedBy, first.me);
    assert.equal(confirmed.changes[0].changedByName, 'a');
    const place = { name: '카페', region: '서울', address: '서울', url: 'https://naver.me/example' };
    const added = await call('place-add', place);
    assert.equal(added.changes.length, confirmed.changes.length);
    const placeConfirmed = await call('place-confirm', { id: added.places[0].id }, 'b');
    assert.equal(placeConfirmed.changes[0].to.place.name, '카페');
    const unconfirmed = await call('unconfirm');
    assert.equal(unconfirmed.changes[0].from.slot, slot);
    assert.equal(unconfirmed.changes[0].from.place.name, '카페');
    assert.equal(unconfirmed.changes[0].to.place, null);
    const otherSlot = '2027-01-02|11:00';
    await call('save', [otherSlot]);
    const reconfirmed = await call('confirm', [], 'a', otherSlot);
    assert.equal(reconfirmed.changes[0].to.slot, otherSlot);
    assert.deepEqual((await call('read', [], 'b')).changes, reconfirmed.changes);
    assert.deepEqual((await call('join', [], 'a', null, 'other-room')).changes, []);
    const reset = await call('reset');
    assert.equal(reset.changes[0].from.slot, otherSlot);
    assert.equal(reset.changes[0].to.slot, null);
    assert.equal(reset.changes.length, reconfirmed.changes.length + 1);
    const unchanged = await call('reset');
    assert.equal(unchanged.changes.length, reset.changes.length);
  } finally { await db.close(); }
});

test('deadline API validates configuration and exposes deadline rejection distinctly', async t => {
  const originalEnv = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'secret', MEETING_ID: 'test-room' });
  let captured;
  globalThis.fetch = async (url, options) => { captured = JSON.parse(options.body); return Response.json({ members: [] }); };
  const request = body => new Request('http://localhost/api/meeting', { method: 'POST', body: JSON.stringify({ room: 'test-room', action: 'deadline-set', token: 'a'.repeat(64), ...body }) });
  const payload = { responseDeadline: '2026-10-29', allowLateResponses: false };
  assert.equal((await POST(request({ payload }))).status, 200);
  assert.deepEqual(captured.p_slots, payload);
  assert.equal((await POST(request({ payload: { ...payload, responseDeadline: 'bad' } }))).status, 400);
  assert.equal((await POST(request({ payload, token: null }))).status, 401);
  globalThis.fetch = async () => Response.json({ message: '응답이 마감되어 시간을 수정할 수 없어요.' }, { status: 400 });
  const rejected = await POST(request({ action: 'save', slots: [] }));
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).code, 'RESPONSE_CLOSED');
});
