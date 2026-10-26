import { randomBytes, createHash } from 'node:crypto';
import { parseRoomCode, roomName } from '../../../lib/rooms.mjs';
import { findRoom, roomStore } from '../../../lib/room-store.js';
import { createRoomInvitation, resolveRoomInvitation } from '../../../lib/room-invitation.js';
import { isAllowedRequestOrigin } from '../../../lib/request-origin.mjs';

export async function POST(req) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'DB 연결 설정이 필요합니다.' }, { status: 503 });
    if (!isAllowedRequestOrigin(req)) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    const text = await req.text();
    if (text.length > 2048) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    const body = JSON.parse(text);
    let room;
    let ownerToken;
    if (body.action === 'create') {
      ownerToken = randomBytes(32).toString('hex');
      room = { id: randomBytes(5).toString('base64url').slice(0, 6), owner_token_hash: createHash('sha256').update(ownerToken).digest('hex'), data: { name: roomName(body.name), members: [], confirmed: null } };
      room.creation_pending = true;
      const result = await roomStore('', { method: 'POST', body: JSON.stringify(room) });
      if (!result.ok) throw Error('모임을 만들지 못했어요. 다시 시도해 주세요.');
    } else if (['complete-create', 'abort-create'].includes(body.action)) {
      if (typeof body.code !== 'string' || parseRoomCode(body.code) !== body.code || typeof body.ownerToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.ownerToken)) return Response.json({ error: '모임 생성 권한을 확인할 수 없어요.' }, { status: 403 });
      const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/finish_meeting_creation', {
        method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_room: body.code, p_owner_token_hash: createHash('sha256').update(body.ownerToken).digest('hex'), p_abort: body.action === 'abort-create', p_member_token_hash: typeof body.token === 'string' && /^[a-f0-9]{64}$/.test(body.token) ? createHash('sha256').update(body.token).digest('hex') : null }), cache: 'no-store',
      });
      if (!response.ok) return Response.json({ error: '생성 상태를 처리하지 못했어요. 다시 시도해 주세요.' }, { status: 503 });
      return Response.json({ completed: await response.json() }, { headers: { 'Cache-Control': 'no-store' } });
    } else if (body.action === 'delete') {
      if (typeof body.code !== 'string' || parseRoomCode(body.code) !== body.code || !/^[a-f0-9]{64}$/.test(body.ownerToken || '')) return Response.json({ error: '모임 삭제 권한을 확인할 수 없어요.' }, { status: 403 });
      const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/schedule_meeting_deletion', {
        method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_room: body.code, p_owner_token_hash: createHash('sha256').update(body.ownerToken).digest('hex') }), cache: 'no-store',
      });
      if (!response.ok) {
        const error = await response.json();
        return Response.json({ error: error.message === '모임을 만든 기기에서만 삭제할 수 있어요.' ? error.message : '삭제 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: error.message === '모임을 만든 기기에서만 삭제할 수 있어요.' ? 403 : 503 });
      }
      return Response.json(await response.json(), { headers: { 'Cache-Control': 'no-store' } });
    } else if (body.action === 'lookup' || body.action === 'resolve-invitation') {
      const code = body.action === 'resolve-invitation' ? resolveRoomInvitation(body.invitationToken) : parseRoomCode(body.code);
      if (!code) throw Error('모임 코드를 다시 확인해 주세요.');
      room = await findRoom(code);
      // Preserve existing invitations for the original single-room deployment.
      if (!room && code === process.env.MEETING_ID) room = { id: code, data: { name: '우리 모임' } };
      if (!room) return Response.json({ error: '해당 코드의 모임을 찾을 수 없어요.' }, { status: 404 });
    } else throw Error('잘못된 요청입니다.');
    return Response.json({ room: room.id, name: room.data.name || '우리 모임', invitationToken: createRoomInvitation(room.id), ...(ownerToken ? { ownerToken } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? '잘못된 요청입니다.' : error.message }, { status: 400 });
  }
}
