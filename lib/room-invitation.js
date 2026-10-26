import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { parseRoomCode } from './rooms.mjs';

// Server-only: never import this module from a client component.
function invitationKey() {
  const secret = process.env.ROOM_INVITATION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw Error('초대 링크 설정을 확인해 주세요.');
  return hkdfSync('sha256', secret, '', 'meet-soon:room-invitation:v1', 32);
}

export function createRoomInvitation(code) {
  if (!code || parseRoomCode(code) !== code) throw Error('모임 코드를 다시 확인해 주세요.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', invitationKey(), iv);
  cipher.setAAD(Buffer.from('meet-soon:room-invitation:v1'));
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return 'v1.' + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function resolveRoomInvitation(token) {
  try {
    if (typeof token !== 'string' || !/^v1\.[A-Za-z0-9_-]{46,208}$/.test(token)) throw Error();
    const payload = Buffer.from(token.slice(3), 'base64url');
    if (payload.toString('base64url') !== token.slice(3)) throw Error();
    const decipher = createDecipheriv('aes-256-gcm', invitationKey(), payload.subarray(0, 12));
    decipher.setAAD(Buffer.from('meet-soon:room-invitation:v1'));
    decipher.setAuthTag(payload.subarray(12, 28));
    const code = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
    if (!code || parseRoomCode(code) !== code) throw Error();
    return code;
  } catch {
    throw Error('올바르지 않거나 만료된 초대 링크예요. 새 링크를 받아 주세요.');
  }
}
