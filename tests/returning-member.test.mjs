import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { POST } from '../app/api/meeting/route.js';
import { koreaToday } from '../lib/meeting.mjs';

test('returning participant restores identity and old responses through the API and edits without creating another member', async t => {
  const db = new PGlite();
  const originalEnv = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(async () => { process.env = originalEnv; globalThis.fetch = originalFetch; await db.close(); });
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase.sql', import.meta.url), 'utf8'));
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'secret', MEETING_ID: 'return-room' });
  globalThis.fetch = async (url, options) => {
    const args = JSON.parse(options.body);
    try {
      const result = await db.query('select meeting_action($1,$2,$3,$4,$5::jsonb,$6,$7) as s', [args.p_room, args.p_action, args.p_token, args.p_nickname, JSON.stringify(args.p_slots), args.p_slot, args.p_admin]);
      return Response.json(result.rows[0].s);
    } catch (error) { return Response.json({ message: error.message }, { status: 400 }); }
  };
  const call = async body => {
    const response = await POST(new Request('http://localhost/api/meeting', { method: 'POST', body: JSON.stringify({ room: 'return-room', ...body }) }));
    return { status: response.status, ...(await response.json()) };
  };
  const joined = await call({ action: 'join', nickname: '돌아온 친구' });
  assert.equal(joined.status, 200);
  const token = joined.token, identity = joined.state.me;
  const day = koreaToday(), originalSlot = `${day}|10:00`, newSlot = `${day}|11:00`;
  assert.equal((await call({ action: 'save', token, slots: [originalSlot] })).status, 200);
  // Simulate responses last saved days ago, then make a fresh read with the persisted token.
  await db.query("update meeting_rooms set data=jsonb_set(data,'{members,0,votedAt}',to_jsonb(clock_timestamp()-interval '4 days')) where id=$1", ['return-room']);
  const restored = await call({ action: 'read', token });
  assert.equal(restored.status, 200);
  assert.equal(restored.state.me, identity);
  assert.equal(restored.state.members.length, 1);
  assert.equal(restored.state.members[0].nickname, '돌아온 친구');
  assert.deepEqual(restored.state.members[0].slots, [originalSlot]);
  assert.equal(restored.state.members[0].token, undefined);
  const edited = await call({ action: 'save', token, slots: [newSlot] });
  assert.equal(edited.status, 200);
  assert.equal(edited.state.me, identity);
  assert.equal(edited.state.members.length, 1);
  assert.deepEqual(edited.state.members[0].slots, [newSlot]);
  assert.deepEqual((await call({ action: 'read', token })).state.members[0].slots, [newSlot]);
  assert.equal((await call({ action: 'read' })).status, 401);
  assert.notEqual((await call({ action: 'read', token: 'f'.repeat(64) })).status, 200);
  const yesterday = koreaToday(new Date(Date.now() - 86400000));
  await call({ action: 'deadline-set', token, payload: { responseDeadline: yesterday, allowLateResponses: false } });
  assert.equal((await call({ action: 'save', token, slots: [] })).status, 409);
  assert.equal((await call({ action: 'read', token })).state.me, identity);
  await call({ action: 'deadline-set', token, payload: { responseDeadline: yesterday, allowLateResponses: true } });
  assert.equal((await call({ action: 'save', token, slots: [newSlot] })).status, 200);
  await call({ action: 'confirm', token, slot: newSlot });
  assert.equal((await call({ action: 'save', token, slots: [] })).status, 400);
  await call({ action: 'unconfirm', token });
  assert.equal((await call({ action: 'save', token, slots: [originalSlot] })).status, 200);
});
