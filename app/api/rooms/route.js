import { randomBytes } from 'node:crypto';
import { parseRoomCode, roomName } from '../../../lib/rooms.mjs';
import { findRoom, roomStore } from '../../../lib/room-store.js';

export async function POST(req) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'DB 연결 설정이 필요합니다.' }, { status: 503 });
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    const text = await req.text();
    if (text.length > 2048) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    const body = JSON.parse(text);
    let room;
    if (body.action === 'create') {
      room = { id: randomBytes(8).toString('hex'), data: { name: roomName(body.name), members: [], confirmed: null } };
      const result = await roomStore('', { method: 'POST', body: JSON.stringify(room) });
      if (!result.ok) throw Error('모임을 만들지 못했어요. 다시 시도해 주세요.');
    } else if (body.action === 'lookup') {
      const code = parseRoomCode(body.code);
      if (!code) throw Error('모임 코드를 다시 확인해 주세요.');
      room = await findRoom(code);
      // Preserve existing invitations for the original single-room deployment.
      if (!room && code === process.env.MEETING_ID) room = { id: code, data: { name: '우리 모임' } };
      if (!room) return Response.json({ error: '해당 코드의 모임을 찾을 수 없어요.' }, { status: 404 });
    } else throw Error('잘못된 요청입니다.');
    return Response.json({ room: room.id, name: room.data.name || '우리 모임' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? '잘못된 요청입니다.' : error.message }, { status: 400 });
  }
}
