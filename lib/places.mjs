export const PLACE_ACTIONS = ['region-vote', 'place-add', 'place-vote', 'place-confirm', 'place-unconfirm'];
export const REGIONS = ['서울', '경기', '인천', '대전', '세종', '대구', '부산', '울산', '광주', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
export function validatePlacePayload(action, payload = {}) {
  const text = (key, max) => {
    if (typeof payload[key] !== 'string' || !payload[key].trim() || payload[key].trim().length > max) throw Error('입력 내용을 확인해 주세요.');
    return payload[key].trim();
  };
  if (action === 'region-vote') return { region: text('region', 30) };
  if (action === 'place-add') {
    const result = { region: text('region', 30), name: text('name', 60), address: text('address', 160), url: text('url', 500) };
    let url;
    try { url = new URL(result.url); } catch { throw Error('네이버 지도 링크를 확인해 주세요.'); }
    if (url.protocol !== 'https:' || !['map.naver.com', 'naver.me', 'm.place.naver.com', 'pcmap.place.naver.com'].includes(url.hostname) || url.username || url.password || url.port) throw Error('네이버 지도에서 복사한 https 링크를 입력해 주세요.');
    return { ...result, url: url.href };
  }
  if (['place-vote', 'place-confirm'].includes(action)) return { id: text('id', 80) };
  if (action === 'place-unconfirm') return {};
  throw Error('잘못된 장소 요청입니다.');
}
export function applyPlaceAction(state, action, raw, id) {
  const payload = validatePlacePayload(action, raw);
  if (!state.members.some(member => member.id === state.me)) throw Error('먼저 입장해 주세요.');
  if (!state.confirmed) throw Error('시간을 먼저 확정해 주세요.');
  if (state.confirmedPlace && action !== 'place-unconfirm') throw Error('장소 확정을 먼저 취소해 주세요.');
  const next = { ...state, places: [...(state.places || [])], regionVotes: { ...(state.regionVotes || {}) }, placeVotes: { ...(state.placeVotes || {}) } };
  if (action === 'region-vote') next.regionVotes[state.me] = payload.region;
  if (action === 'place-add') {
    if (next.places.length >= 50) throw Error('장소 후보는 최대 50개까지 등록할 수 있어요.');
    next.places.push({ ...payload, id, addedBy: state.me });
  }
  if (['place-vote', 'place-confirm'].includes(action) && !next.places.some(place => place.id === payload.id)) throw Error('장소 후보를 다시 선택해 주세요.');
  if (action === 'place-vote') next.placeVotes[state.me] = payload.id;
  if (action === 'place-confirm') next.confirmedPlace = payload.id;
  if (action === 'place-unconfirm') next.confirmedPlace = null;
  return next;
}
