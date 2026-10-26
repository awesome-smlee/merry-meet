import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { applyEventAction, validateEventPayload } from '../lib/events.mjs';
import { POST } from '../app/api/meeting/route.js';

const wedding = { title: 'A친구 결혼식', date: '2027-01-10', memo: '오후 1시' };
test('event validation and demo ownership preserve other meeting data', () => {
  for (const date of ['2027-02-29', '2028-02-30', '2027-13-01', '', '1999-01-01']) assert.throws(() => validateEventPayload('event-add', { ...wedding, date }));
  assert.equal(validateEventPayload('event-add', { ...wedding, date: '2028-02-29' }).date, '2028-02-29');
  assert.throws(() => validateEventPayload('event-add', { ...wedding, title: ' ' }));
  assert.throws(() => validateEventPayload('event-add', { ...wedding, memo: 'x'.repeat(501) }));
  const initial = { members: [{ id: 'a', slots: ['2027-01-10|10:00'] }, { id: 'b' }], me: 'a', confirmed: '2027-01-10|10:00' };
  const added = applyEventAction(initial, 'event-add', wedding, 'event-a');
  assert.equal(initial.events, undefined);
  assert.deepEqual(added.members, initial.members);
  assert.equal(added.confirmed, initial.confirmed);
  assert.throws(() => applyEventAction({ ...added, me: 'b' }, 'event-update', { ...wedding, id: 'event-a' }), /등록한/);
  assert.throws(() => applyEventAction({ ...added, me: 'b' }, 'event-delete', { id: 'event-a' }), /등록한/);
  const updated = applyEventAction(added, 'event-update', { ...wedding, title: '변경', id: 'event-a' });
  assert.equal(updated.events[0].title, '변경');
  assert.deepEqual(applyEventAction(updated, 'event-delete', { id: 'event-a' }).events, []);
});

test('database shares events within a room and only permits their creator to edit or delete', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase.sql', import.meta.url), 'utf8'));
    const call = async (action, payload = [], token = 'a', room = 'events') => (await db.query('select meeting_action($1,$2,$3,$4,$5::jsonb) as s', [room, action, token, token, JSON.stringify(payload)])).rows[0].s;
    const a = await call('join'); await call('join', [], 'b');
    await call('save', ['2027-01-10|10:00']);
    await assert.rejects(call('event-add', wedding, 'forged'), /참여/);
    await assert.rejects(call('event-add', { ...wedding, date: '2027-02-30' }));
    const added = await call('event-add', { ...wedding, addedBy: 'forged' });
    const id = added.events[0].id;
    assert.equal(added.events[0].addedBy, a.me);
    assert.deepEqual((await call('read', [], 'b')).events, added.events);
    await assert.rejects(call('event-update', { ...wedding, id }, 'b'), /등록한/);
    await assert.rejects(call('event-delete', { id }, 'b'), /등록한/);
    assert.deepEqual((await call('join', [], 'a', 'other')).events, []);
    await assert.rejects(call('event-delete', { id }, 'a', 'other'), /삭제/);
    const updated = await call('event-update', { ...wedding, id, title: 'B친구 출산 예정일', date: '2027-02-20' });
    assert.equal(updated.events[0].title, 'B친구 출산 예정일');
    assert.deepEqual(updated.members.find(member => member.id === a.me).slots, ['2027-01-10|10:00']);
    assert.equal((await call('reset')).events.length, 1);
    assert.deepEqual((await call('event-delete', { id })).events, []);
    await assert.rejects(call('event-delete', { id }), /삭제/);
  } finally { await db.close(); }
});

test('event API validates input and passes a hashed participant token to the database', async t => {
  const originalEnv = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'secret', MEETING_ID: 'test-room' });
  let captured;
  globalThis.fetch = async (url, options) => { captured = JSON.parse(options.body); return Response.json({ members: [], events: [] }); };
  const request = body => new Request('http://localhost/api/meeting', { method: 'POST', body: JSON.stringify({ room: 'test-room', action: 'event-add', payload: wedding, ...body }) });
  assert.equal((await POST(request({ token: 'a'.repeat(64) }))).status, 200);
  assert.equal(captured.p_action, 'event-add');
  assert.deepEqual(captured.p_slots, wedding);
  assert.notEqual(captured.p_token, 'a'.repeat(64));
  assert.equal((await POST(request({}))).status, 401);
  assert.equal((await POST(request({ token: 'a'.repeat(64), payload: { ...wedding, date: 'bad' } }))).status, 400);
});
