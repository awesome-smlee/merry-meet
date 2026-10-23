'use client';
import { useState } from 'react';
import { MapPin, ExternalLink, Check } from 'lucide-react';
import { REGIONS } from '../lib/places.mjs';

export default function PlacePlanner({ state, busy, onAction }) {
  const [region, setRegion] = useState('');
  const [error, setError] = useState('');
  const regionVotes = state.regionVotes || {};
  const placeVotes = state.placeVotes || {};
  const regions = [...new Set([...REGIONS, ...Object.values(regionVotes), ...(state.places || []).map(p => p.region)])];
  const regionCount = value => Object.values(regionVotes).filter(v => v === value).length;
  const leading = [...regions].sort((a, b) => regionCount(b) - regionCount(a))[0];
  const selectedRegion = region || regionVotes[state.me] || leading;
  const locked = !state.me || busy || !!state.confirmedPlace;
  const places = (state.places || []).filter(p => p.region === selectedRegion);
  const voters = id => state.members.filter(m => placeVotes[m.id] === id);
  const confirmed = (state.places || []).find(p => p.id === state.confirmedPlace);
  async function act(action, payload) {
    setError('');
    try { return await onAction(action, payload); } catch (e) { setError(e.message); return false; }
  }
  return (
    <section className="card place-planner" aria-labelledby="place-heading">
      <span className="eyebrow">FIND OUR PLACE</span>
      <h2 id="place-heading">이제, 어디서 만날까요?</h2>
      <p className="subtext">지역을 고르고, 마음에 드는 장소에 한 표를 남겨 주세요. 투표는 바꿀 수 있어요.</p>
      {confirmed && <div className="place-confirmed"><Check aria-hidden="true" /><div><strong>만날 장소가 정해졌어요 · {confirmed.name}</strong><p>{confirmed.address}</p><a href={confirmed.url} target="_blank" rel="noopener noreferrer">네이버 지도에서 보기 ↗</a></div><button className="outline-button" disabled={busy || !state.me} onClick={() => act('place-unconfirm', {})}>장소 확정 취소</button></div>}
      <h3>1. 만날 지역 정하기</h3>
      <p className="subtext">지역별 1인 1표 · 현재 선택: {regionVotes[state.me] || '아직 투표 전'}</p>
      <div className="region-options">{regions.map(value => <button key={value} className={selectedRegion === value ? 'active' : ''} aria-pressed={selectedRegion === value} onClick={() => setRegion(value)}>{value}<small>{regionCount(value)}표</small></button>)}</div>
      <div className="region-vote-action"><button className="outline-button" disabled={locked} onClick={() => act('region-vote', { region: selectedRegion })}>{regionVotes[state.me] === selectedRegion ? '이 지역에 투표했어요 ✓' : `${selectedRegion}에 투표`}</button><span>{state.members.filter(m => regionVotes[m.id] === selectedRegion).map(m => m.nickname).join(', ') || '첫 번째 표를 기다려요'}</span></div>
      <h3>2. 장소 후보 모으기 <small>· {selectedRegion}</small></h3>
      <p className="subtext">동네까지 적어 주세요. 예: 서울 성수동 · 식당, 카페 어디든 좋아요.</p>
      {!state.confirmedPlace && <details className="place-form-wrap"><summary>+ 장소 후보 추가</summary><form className="place-form" onSubmit={async event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        if (await act('place-add', { region: selectedRegion, name: data.get('name'), address: data.get('address'), url: data.get('url') })) form.reset();
      }}>
        <label>장소 이름<input name="name" required maxLength={60} placeholder="예: 우리 카페" /></label>
        <label>동네 · 주소<input name="address" required maxLength={160} placeholder="예: 서울 성동구 성수동 …" /></label>
        <label>네이버 지도 링크<input name="url" type="url" required maxLength={500} placeholder="https://naver.me/…" /></label>
        <p className="subtext">네이버 지도에서 장소를 찾은 뒤 공유 링크를 복사해 붙여 넣어 주세요.</p>
        <button className="primary" disabled={locked}>장소 후보 등록</button>
      </form></details>}
      <div className="place-options">{places.map(place => <article className="place-option" key={place.id}>
        <MapPin aria-hidden="true" /><h4>{place.name}</h4><p>{place.address}</p>
        <a href={place.url} target="_blank" rel="noopener noreferrer">네이버 지도 보기 <ExternalLink aria-hidden="true" /></a>
        <div className="place-voters"><strong>{voters(place.id).length}표</strong><span>{voters(place.id).map(m => m.nickname).join(', ') || '아직 투표 전'}</span></div>
        <button className="outline-button" disabled={locked} aria-pressed={placeVotes[state.me] === place.id} onClick={() => act('place-vote', { id: place.id })}>{placeVotes[state.me] === place.id ? '내가 고른 장소 ✓' : '이 장소에 투표'}</button>
        {placeVotes[state.me] === place.id && !state.confirmedPlace && <button className="primary" disabled={locked} onClick={() => act('place-confirm', { id: place.id })}>이 장소로 확정</button>}
      </article>)}</div>
      {!places.length && <p className="empty">{selectedRegion}의 첫 장소를 제안해 주세요.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
  );
}
