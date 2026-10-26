import { koreaToday, validSlot } from './meeting.mjs';

export function validateReschedule(payload = {}) {
  if (!validSlot(payload.slot)) throw Error('변경할 날짜와 시간을 확인해 주세요.');
  if (typeof payload.expectedConfirmed !== 'string' || !payload.expectedConfirmed) throw Error('기존 일정을 다시 확인해 주세요.');
  return { slot: payload.slot, expectedConfirmed: payload.expectedConfirmed };
}

export function applyReschedule(state, payload) {
  if (!state.me || !state.members.some(member => member.id === state.me)) throw Error('먼저 입장해 주세요.');
  const { slot, expectedConfirmed } = validateReschedule(payload);
  if (!state.confirmed || state.confirmed !== expectedConfirmed) throw Error('일정이 변경되었어요. 다시 확인해 주세요.');
  return { ...state, confirmed: slot };
}

export function validateDeadline(payload = {}) {
  if (!payload || typeof payload !== 'object' || typeof payload.allowLateResponses !== 'boolean') throw Error('마감 후 수정 허용 여부를 선택해 주세요.');
  const date = payload.responseDeadline;
  if (date !== null) {
    if (typeof date !== 'string' || !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(date)) throw Error('마감일을 확인해 주세요.');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw Error('마감일을 확인해 주세요.');
  }
  return { responseDeadline: date, allowLateResponses: payload.allowLateResponses };
}

export function responsesClosed(state, now = new Date()) {
  return !!state.responseDeadline && koreaToday(now) > state.responseDeadline && !state.allowLateResponses;
}

export function applyDeadline(state, payload) {
  if (!state.me || !state.members.some(member => member.id === state.me)) throw Error('먼저 입장해 주세요.');
  return { ...state, ...validateDeadline(payload) };
}

export function recordMeetingChange(previous, next, id, now = new Date()) {
  const from = { slot: previous.confirmed || null, place: previous.places?.find(place => place.id === previous.confirmedPlace) || null };
  const to = { slot: next.confirmed || null, place: next.places?.find(place => place.id === next.confirmedPlace) || null };
  if (from.slot === to.slot && from.place?.id === to.place?.id) return next;
  const actor = previous.members.find(member => member.id === previous.me);
  return { ...next, changes: [{ id, from, to, changedBy: previous.me, changedByName: actor?.nickname || '참여자', createdAt: now.toISOString() }, ...(previous.changes || [])].slice(0, 30) };
}
