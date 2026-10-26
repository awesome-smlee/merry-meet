import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoomCode, roomName, parseCreatedRooms, roomInvitation, invitationCode, roomEntry } from '../lib/rooms.mjs';
import { POST } from '../app/api/rooms/route.js';
import { createRoomInvitation, resolveRoomInvitation } from '../lib/room-invitation.js';

test('legacy invitations retain their target and take precedence over saved rooms and join flags', () => {
  for (const code of ['Ab3_-9', 'a'.repeat(32), 'a'.repeat(128)]) {
    for (const param of ['invite', 'room']) {
      const entry = roomEntry(`?${param}=${code}&join=1`, 'bbbbbbbb');
      assert.equal(entry.target, code);
      assert.equal(entry.legacy, true);
      assert.equal(entry.joinOnly, false);
      assert.equal(entry.invitation, param === 'invite' ? code : '');
      assert.equal(invitationCode(code, entry.target), code);
    }
  }
  assert.equal(roomEntry('?invite=aaaaaaaa&room=bbbbbbbb').target, 'aaaaaaaa');
  assert.equal(roomEntry('?join=1', 'aaaaaaaa').target, '');
  assert.equal(roomEntry('?meeting=1', 'aaaaaaaa').target, 'aaaaaaaa');
  assert.equal(roomEntry('?meeting=1').target, '');
  assert.equal(roomEntry('', 'aaaaaaaa').target, '');
});

test('room codes accept invitations and reject malformed query values', () => {
  assert.equal(parseRoomCode('Ab3_-9'), 'Ab3_-9');
  assert.equal(parseRoomCode('abc12'), '');
  assert.equal(parseRoomCode('  a1b2c3d4e5f60708  '), 'a1b2c3d4e5f60708');
  assert.equal(parseRoomCode('https://example.com/?room=a1b2c3d4e5f60708'), 'a1b2c3d4e5f60708');
  for (const input of ['', 'abc', 'a1b2c3d4&select=*', 'https://example.com/', 'javascript:alert(1)']) assert.equal(parseRoomCode(input), '');
});
test('created room history restores distinct rooms and ignores corrupt entries', () => {
  const first = { room: 'aaaaaaaa', name: 'A 모임' };
  const second = { room: 'bbbbbbbb', name: 'B 모임' };
  assert.deepEqual(parseCreatedRooms(JSON.stringify([second, first, first, null, { room: 'javascript:alert(1)', name: 'invalid' }, { room: 'cccccccc', name: 123 }])), [second, first]);
  for (const raw of [null, '{broken', '{}', 'null']) assert.deepEqual(parseCreatedRooms(raw), []);
  assert.deepEqual(parseCreatedRooms(JSON.stringify([{ ...first, token: 'not-for-history' }])), [first]);
});

test('invitation shares a code and entry link without unrelated URL data', () => {
  const invite = roomInvitation('https://example.com/?room=aaaaaaaa&other=private#details', 'aaaaaaaa', '친구 모임', 'opaque-token');
  assert.equal(invite.url, 'https://example.com/?join=1&invitation=opaque-token');
  assert.ok(!invite.url.includes('aaaaaaaa'));
  assert.throws(() => roomInvitation('https://example.com', 'aaaaaaaa', '친구 모임'));
  assert.match(invite.text, /모임코드: aaaaaaaa/);
  assert.equal(invite.title, '친구 모임 초대');
});

test('invitation entry requires the matching typed code, not a link or another room', () => {
  assert.equal(invitationCode(' aaaaaaaa ', 'aaaaaaaa'), 'aaaaaaaa');
  assert.equal(invitationCode('bbbbbbbb'), 'bbbbbbbb');
  assert.throws(() => invitationCode('bbbbbbbb', 'aaaaaaaa'), /일치하지/);
  assert.throws(() => invitationCode('https://example.com/?room=aaaaaaaa', 'aaaaaaaa'), /모임코드/);
  assert.throws(() => invitationCode('', 'aaaaaaaa'), /모임코드/);
});

test('room names are optional and bounded', () => {
  assert.equal(roomName('  '), '우리 모임');
  assert.equal(roomName('  친구 모임  '), '친구 모임');
  assert.throws(() => roomName('a'.repeat(41)));
  assert.throws(() => roomName(null));
});

test('room API creates distinct rooms and only exposes invitation metadata', async t => {
  const originalEnv = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });
  Object.assign(process.env, { SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' });
  delete process.env.MEETING_ID;
  const rooms = new Map();
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.apikey, 'server-secret');
    if (options.method === 'POST') {
      const room = JSON.parse(options.body);
      rooms.set(room.id, room);
      return new Response(null, { status: 201 });
    }
    const code = new URL(url).searchParams.get('id').slice(3);
    return Response.json(rooms.has(code) ? [rooms.get(code)] : []);
  };
  const request = (body, origin = 'http://localhost') => new Request('http://localhost/api/rooms', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });
  const first = await (await POST(request({ action: 'create', name: '' }))).json();
  const second = await (await POST(request({ action: 'create', name: '친구들' }))).json();
  assert.notEqual(first.room, second.room);
  assert.match(first.room, /^[a-zA-Z0-9_-]{6}$/);
  assert.match(second.room, /^[a-zA-Z0-9_-]{6}$/);
  assert.equal(first.name, '우리 모임');
  rooms.get(second.room).data.members.push({ nickname: '비공개', token: 'private-token' });
  const lookup = await (await POST(request({ action: 'lookup', code: second.room }))).json();
  assert.deepEqual(Object.keys(lookup).sort(), ['invitationToken', 'name', 'room']);
  assert.equal(lookup.room, second.room);
  assert.equal(lookup.name, '친구들');
  assert.equal(resolveRoomInvitation(lookup.invitationToken), second.room);
  const resolvedResponse = await POST(request({ action: 'resolve-invitation', invitationToken: lookup.invitationToken }));
  assert.equal(resolvedResponse.headers.get('Cache-Control'), 'no-store');
  const resolved = await resolvedResponse.json();
  assert.equal(resolved.room, second.room);
  assert.equal(resolved.name, '친구들');
  for (const invitationToken of ['', null, 123, second.room, 'v1.invalid']) {
    assert.equal((await POST(request({ action: 'resolve-invitation', invitationToken }))).status, 400);
  }
  rooms.get(second.room).delete_after = new Date().toISOString();
  assert.equal((await POST(request({ action: 'resolve-invitation', invitationToken: lookup.invitationToken }))).status, 400);
  assert.equal((await POST(request({ action: 'lookup', code: 'ffffffffffffffff' }))).status, 404);
  assert.equal((await POST(request({ action: 'create', name: '' }, 'https://other.example'))).status, 403);
  assert.equal(rooms.size, 2);
});

test('invitation tokens conceal codes and reject tampering and a different server key', t => {
  const originalEnv = { ...process.env };
  t.after(() => { process.env = originalEnv; });
  process.env.ROOM_INVITATION_SECRET = 'test-only-secret-for-invitation-tokens';
  for (const code of ['Ab3_-9', 'a'.repeat(128)]) {
    const token = createRoomInvitation(code);
    assert.equal(resolveRoomInvitation(token), code);
    assert.notEqual(createRoomInvitation(code), token);
    assert.ok(!token.includes(code));
    const payload = Buffer.from(token.slice(3), 'base64url');
    assert.ok(!payload.includes(Buffer.from(code)));
    payload[15] ^= 1;
    assert.throws(() => resolveRoomInvitation('v1.' + payload.toString('base64url')), /초대 링크/);
  }
  const token = createRoomInvitation('Ab3_-9');
  process.env.ROOM_INVITATION_SECRET = 'a-different-server-secret';
  assert.throws(() => resolveRoomInvitation(token), /초대 링크/);
});
