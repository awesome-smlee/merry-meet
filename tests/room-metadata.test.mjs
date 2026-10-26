import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { POST } from '../app/api/meeting/route.js';

test('room metadata preserves unknown history and captures only the verified creator nickname', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table meeting_rooms(id text primary key, data jsonb not null default '{"members":[],"confirmed":null}');
    insert into meeting_rooms(id) values ('legacy-room');`);
  const schema = await readFile(new URL('../supabase.sql', import.meta.url), 'utf8');
  await db.exec(schema);
  assert.equal((await db.query("select created_at from meeting_rooms where id='legacy-room'")).rows[0].created_at, null);
  await db.query('insert into meeting_rooms(id,owner_token_hash) values ($1,$2)', ['new-room', 'owner-hash']);
  const call = (action, token, nickname, payload = {}) => db.query(
    'select meeting_action($1,$2,$3,$4,$5::jsonb)', ['new-room', action, token, nickname, JSON.stringify(payload)]);
  const metadata = async () => (await db.query("select created_at,creator_nickname from meeting_rooms where id='new-room'")).rows[0];
  const createdAt = (await metadata()).created_at;
  assert.ok(createdAt);
  await call('join', 'visitor', '방문자', { ownerTokenHash: 'wrong-hash' });
  assert.equal((await metadata()).creator_nickname, null);
  await call('join', 'owner', '생성자', { ownerTokenHash: 'owner-hash' });
  assert.equal((await metadata()).creator_nickname, '생성자');
  await call('profile', 'owner', '바뀐닉네임', { avatar: 'cat' });
  await call('join', 'owner-again', '재입장', { ownerTokenHash: 'owner-hash' });
  await db.exec(schema);
  assert.equal((await metadata()).creator_nickname, '생성자');
  assert.deepEqual((await metadata()).created_at, createdAt);
});

test('join API hashes ownership proof and ignores client supplied ownership hashes', async t => {
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(() => { process.env = env; globalThis.fetch = originalFetch; });
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'test', MEETING_ID: 'new-room' });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return Response.json({ members: [], me: 'owner' });
  };
  const join = body => POST(new Request('http://localhost/api/meeting', { method: 'POST', body: JSON.stringify({ room: 'new-room', action: 'join', nickname: '생성자', ...body }) }));
  const ownerToken = 'a'.repeat(64);
  assert.equal((await join({ ownerToken })).status, 200);
  assert.deepEqual(calls[0].p_slots, { ownerTokenHash: createHash('sha256').update(ownerToken).digest('hex') });
  assert.equal((await join({ slots: { ownerTokenHash: 'forged' } })).status, 200);
  assert.deepEqual(calls[1].p_slots, { ownerTokenHash: null });
});
