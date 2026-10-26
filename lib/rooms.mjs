export function parseRoomCode(input) {
  let code = String(input || '').trim();
  if (/^https?:\/\//i.test(code)) {
    try { code = new URL(code).searchParams.get('room') || ''; } catch { return ''; }
  }
  return /^[a-zA-Z0-9_-]{6,128}$/.test(code) ? code : '';
}

export function roomInvitation(currentUrl, room, name) {
  const url = new URL(currentUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('join', '1');
  return { title: `${name} 초대`, text: `${name}에 초대합니다!\n모임코드: ${room}\n링크를 열고 모임코드를 입력해 주세요.`, url: url.href };
}

export function invitationCode(input, invitedRoom = '') {
  const code = String(input || '').trim();
  if (!code || parseRoomCode(code) !== code) throw Error('공유받은 모임코드를 입력해 주세요.');
  if (invitedRoom && code !== invitedRoom) throw Error('초대받은 모임의 코드와 일치하지 않아요. 다시 확인해 주세요.');
  return code;
}

export function roomName(input) {
  if (typeof input !== 'string' || input.trim().length > 40) throw Error('모임명은 40자 이내로 입력해 주세요.');
  return input.trim() || '우리 모임';
}

export function parseCreatedRooms(raw) {
  try {
    const entries = JSON.parse(raw || '[]');
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    return entries.filter(entry => {
      if (!entry || typeof entry.room !== 'string' || parseRoomCode(entry.room) !== entry.room || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 40 || seen.has(entry.room)) return false;
      seen.add(entry.room);
      return true;
    }).map(({ room, name }) => ({ room, name }));
  } catch { return []; }
}
