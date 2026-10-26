import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { memberAvatar, animalAvatar } from '../lib/avatars.mjs';
import { POST } from '../app/api/meeting/route.js';

test('selected avatars use local assets with stable fallback', () => {
  assert.equal(memberAvatar({ id: 'a', avatar: 'fox' }), '/avatars/fox.svg');
  assert.equal(memberAvatar({ id: 'a', avatar: '../../bad' }), animalAvatar('a'));
});

test('profile edits authenticate the member, enforce uniqueness and preserve votes', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase.sql', import.meta.url), 'utf8'));
    const call = async (action, token, nickname, payload = []) => (await db.query('select meeting_action($1,$2,$3,$4,$5::jsonb) as s', ['profile-room', action, token, nickname, JSON.stringify(payload)])).rows[0].s;
    const first = await call('join', 'token-a', 'Alice');
    const second = await call('join', 'token-b', 'Bob');
    await call('save', 'token-a', null, ['2027-01-01|10:00']);
    await assert.rejects(call('profile', 'forged', 'Other', { avatar: 'fox' }), /참여/);
    await assert.rejects(call('profile', 'token-a', 'bOB', { avatar: 'fox' }), /이미/);
    await assert.rejects(call('profile', 'token-a', 'Alice', { avatar: '../bad' }), /이미지/);
    await assert.rejects(call('profile', 'token-a', ' ', { avatar: 'fox' }), /닉네임/);
    const updated = await call('profile', 'token-a', ' 새 이름 ', { avatar: 'fox' });
    const me = updated.members.find(member => member.id === first.me);
    assert.equal(me.nickname, '새 이름');
    assert.equal(me.avatar, 'fox');
    assert.deepEqual(me.slots, ['2027-01-01|10:00']);
    assert.equal(me.responded, true);
    assert.equal(updated.members.find(member => member.id === second.me).nickname, 'Bob');
    assert.equal(me.token, undefined);
    assert.equal((await call('read', 'token-a')).me, first.me);
    const restored = await call('join', 'new-browser-token', ' 새 이름 ');
    assert.equal(restored.me, first.me);
    assert.equal(restored.members.length, 2);
    assert.deepEqual(restored.members.find(member => member.id === first.me), me);
    assert.ok(restored.members.every(member => !('token' in member) && !('reentryTokens' in member)));
    assert.equal((await call('read', 'token-a')).me, first.me);
    const edited = await call('profile', 'new-browser-token', '복귀한 이름', { avatar: 'cat' });
    assert.equal(edited.members.find(member => member.id === first.me).avatar, 'cat');
    const saved = await call('save', 'new-browser-token', null, ['2027-01-02|10:00']);
    assert.deepEqual(saved.members.find(member => member.id === first.me).slots, ['2027-01-02|10:00']);
    const repeated = await call('join', 'new-browser-token', '복귀한 이름');
    assert.equal(repeated.members.length, 2);
    const isolated = (await db.query('select meeting_action($1,$2,$3,$4) as s', ['another-room', 'join', 'another-token', '복귀한 이름'])).rows[0].s;
    assert.notEqual(isolated.me, first.me);
  } finally { await db.close(); }
});

test('profile API validates avatars and hashes the existing participant token', async t => {
  const originalEnv = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'secret', MEETING_ID: 'test-room' });
  let captured;
  globalThis.fetch = async (url, options) => { captured = JSON.parse(options.body); return Response.json({ members: [], me: 'a' }); };
  const request = body => new Request('http://localhost/api/meeting', { method: 'POST', body: JSON.stringify({ room: 'test-room', action: 'profile', ...body }) });
  const token = 'a'.repeat(64);
  assert.equal((await POST(request({ token, nickname: '새 이름', avatar: 'fox' }))).status, 200);
  assert.equal(captured.p_action, 'profile');
  assert.notEqual(captured.p_token, token);
  assert.deepEqual(captured.p_slots, { avatar: 'fox' });
  assert.equal((await POST(request({ token, nickname: '새 이름', avatar: 'bad' }))).status, 400);
  assert.equal((await POST(request({ nickname: '새 이름', avatar: 'fox' }))).status, 401);
});
