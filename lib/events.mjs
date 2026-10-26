export const EVENT_ACTIONS = ['event-add', 'event-update', 'event-delete'];

export function validateEventPayload(action, payload = {}) {
  if (!EVENT_ACTIONS.includes(action) || !payload || typeof payload !== 'object') throw Error('잘못된 이벤트 요청입니다.');
  const result = {};
  if (action !== 'event-add') {
    if (typeof payload.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(payload.id)) throw Error('이벤트를 다시 선택해 주세요.');
    result.id = payload.id;
  }
  if (action === 'event-delete') return result;
  if (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.trim().length > 40) throw Error('이벤트명은 1~40자로 입력해 주세요.');
  if (typeof payload.date !== 'string' || !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(payload.date)) throw Error('날짜를 확인해 주세요.');
  const date = new Date(`${payload.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== payload.date) throw Error('날짜를 확인해 주세요.');
  if (payload.memo !== undefined && (typeof payload.memo !== 'string' || payload.memo.trim().length > 500)) throw Error('메모는 500자 이내로 입력해 주세요.');
  return { ...result, title: payload.title.trim(), date: payload.date, memo: (payload.memo || '').trim() };
}

export function applyEventAction(state, action, raw, id) {
  const payload = validateEventPayload(action, raw);
  if (!state.me || !state.members.some(member => member.id === state.me)) throw Error('먼저 입장해 주세요.');
  const events = [...(state.events || [])];
  if (action === 'event-add') {
    if (events.length >= 200) throw Error('이벤트는 모임당 최대 200개까지 등록할 수 있어요.');
    events.push({ ...payload, id, addedBy: state.me });
  } else {
    const index = events.findIndex(event => event.id === payload.id);
    if (index < 0) throw Error('이벤트가 삭제되었어요. 목록을 다시 확인해 주세요.');
    if (events[index].addedBy !== state.me) throw Error('등록한 사람만 수정하거나 삭제할 수 있어요.');
    if (action === 'event-delete') events.splice(index, 1);
    else events[index] = { ...events[index], ...payload };
  }
  return { ...state, events };
}
