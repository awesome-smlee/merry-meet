export function parseRoomCode(input) {
  let code = String(input || '').trim();
  if (/^https?:\/\//i.test(code)) {
    try { code = new URL(code).searchParams.get('room') || ''; } catch { return ''; }
  }
  return /^[a-zA-Z0-9_-]{8,128}$/.test(code) ? code : '';
}

export function roomName(input) {
  if (typeof input !== 'string' || input.trim().length > 40) throw Error('모임명은 40자 이내로 입력해 주세요.');
  return input.trim() || '우리 모임';
}
