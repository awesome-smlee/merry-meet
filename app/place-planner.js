'use client';
import FadeUpWrapper from './fade-up-wrapper';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Check, ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { REGIONS, validatePlacePayload, validatePlaceUrl, placeVoteIds } from '../lib/places.mjs';
import MemberIdentity from './member-identity';
import { PlaceSkeleton } from './skeleton';

export default function PlacePlanner({ state, busy, onAction, storageKey }) {
  const [region, setRegion] = useState('');
  const [voteChoice, setVoteChoice] = useState(null);
  const [resultChoice, setResultChoice] = useState(null);
  const [voteMessage, setVoteMessage] = useState('');
  const [showResults, setShowResults] = useState(null);
  const [completedPlace, setCompletedPlace] = useState(null);
  const placeConfirmDialog = useRef(null);
  useEffect(() => {
    if (!completedPlace) return;
    const dialog = placeConfirmDialog.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [completedPlace]);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState([]);
  const [input, setInput] = useState({ name: '', url: '' });
  const [linkTouched, setLinkTouched] = useState(false);
  let linkError = '';
  if (input.url.trim()) {
    try { validatePlaceUrl(input.url); }
    catch (error) { linkError = error.message; }
  }
  const showLinkError = linkTouched && !!linkError;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved?.version === 1 || saved?.version === 2) {
        const restoredDrafts = (Array.isArray(saved.drafts) ? saved.drafts : []).slice(0, 50).filter(draft => {
          try { return typeof draft.draftId === 'string' && !!validatePlacePayload('place-add', draft); }
          catch { return false; }
        });
        setDrafts(restoredDrafts);
        setSelectedDraftIds(Array.isArray(saved.selectedDraftIds) && (saved.version === 2 || saved.selectedDraftIds.length)
          ? saved.selectedDraftIds.filter(id => restoredDrafts.some(draft => draft.draftId === id))
          : restoredDrafts.map(draft => draft.draftId));
        if (typeof saved.region === 'string') setRegion(saved.region);
        setInput({ name: typeof saved.input?.name === 'string' ? saved.input.name.slice(0, 60) : '', url: typeof saved.input?.url === 'string' ? saved.input.url.slice(0, 500) : '' });
      }
    } catch {
      setError('저장된 장소를 불러오지 못했어요. 브라우저 저장 설정을 확인해 주세요.');
    }
    setRestored(true);
  }, [storageKey]);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 2, drafts, selectedDraftIds, region, input }));
    } catch {
      setError('장소를 이 기기에 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    }
  }, [restored, storageKey, drafts, selectedDraftIds, region, input]);
  const selectedDrafts = drafts.filter(draft => selectedDraftIds.includes(draft.draftId));
  const [registering, setRegistering] = useState(false);
  const [progress, setProgress] = useState('');
  const submitting = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deleteDialog = useRef(null);
  useEffect(() => {
    if (!deleteTarget) return;
    const dialog = deleteDialog.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteTarget]);
  const regionVotes = state.regionVotes || {};
  const placeVotes = state.placeVotes || {};
  const regions = [...new Set([...REGIONS, ...Object.values(regionVotes), ...(state.places || []).map(p => p.region)])];
  const regionCount = value => Object.values(regionVotes).filter(v => v === value).length;
  const leading = [...regions].sort((a, b) => regionCount(b) - regionCount(a))[0];
  const selectedRegion = region || regionVotes[state.me] || leading;
  const locked = !restored || !state.me || busy || registering || !!state.confirmedPlace;
  const places = state.places || [];
  const voters = id => state.members.filter(m => placeVoteIds(placeVotes[m.id]).includes(id));
  const confirmed = (state.places || []).find(p => p.id === state.confirmedPlace);
  const confirmedMapQuery = confirmed
    ? [...new Set([confirmed.region, confirmed.address, confirmed.name].filter(value => value && value !== '어디든 좋아요'))].join(' ')
    : '';
  const votedPlaces = places.filter(place => placeVoteIds(placeVotes[state.me]).includes(place.id));
  const resultsOpen = places.length > 0 && (showResults ?? (votedPlaces.length > 0 || !!state.confirmedPlace));
  const selectedVoteId = voteChoice ?? votedPlaces[0]?.id;
  const selectedResult = places.find(place => place.id === resultChoice);
  const voteCount = state.members.filter(member => places.some(place => placeVoteIds(placeVotes[member.id]).includes(place.id))).length;
  async function act(action, payload) {
    setError('');
    try { return await onAction(action, payload); } catch (e) { setError(e.message); return false; }
  }
  async function registerDrafts() {
    if (locked || submitting.current || !selectedDrafts.length) return;
    submitting.current = true;
    setRegistering(true);
    setError('');
    const candidates = selectedDrafts;
    let completed = 0;
    try {
      for (const draft of candidates) {
        setProgress(`${candidates.length}개 중 ${completed + 1}번째 등록 중…`);
        const { draftId, ...payload } = draft;
        if (!await act('place-add', payload)) {
          setProgress(`${completed}개 등록 완료 · 남은 장소를 다시 등록해 주세요.`);
          return;
        }
        completed++;
        setDrafts(current => current.filter(item => item.draftId !== draftId));
        setSelectedDraftIds(current => current.filter(id => id !== draftId));
      }
      setProgress(`장소 ${completed}개를 등록했어요. 다른 장소도 계속 추가할 수 있어요.`);
    } finally {
      submitting.current = false;
      setRegistering(false);
    }
  }
  if (!restored) return <PlaceSkeleton />;
  return (
    <>
    {confirmed && <FadeUpWrapper as="section" className="place-confirmed-summary" aria-label="확정된 장소">
      <div className="place-confirmed-info"><span className="place-confirmed-label"><Check aria-hidden="true" />장소 확정</span><strong>{confirmed.region} · {confirmed.name}</strong><a href={confirmed.url} target="_blank" rel="noopener noreferrer">지도 앱에서 열기 <ArrowUpRight aria-hidden="true" /></a></div>
      <button type="button" className="place-reopen-button cancel-button" disabled={busy || !state.me || registering} onClick={() => act('place-unconfirm', {})}>{busy ? '취소 중…' : '장소 확정 취소'}</button>
      <div className="place-confirmed-map">
        <iframe
          key={confirmed.id}
          title={`${confirmed.name} 지도 미리보기`}
          src={`https://maps.google.com/maps?${new URLSearchParams({ q: confirmedMapQuery, output: 'embed', hl: 'ko', z: '16' })}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <p>장소명으로 검색한 지도예요. 정확한 위치는 지도 앱에서 확인해 주세요.</p>
      </div>
    </FadeUpWrapper>}
      <div className={'card place-voting-workspace' + (state.confirmedPlace ? ' is-locked' : '') + (!places.length ? ' is-empty' : '')}>
      {places.length > 0 && <div className="place-voting-tabs" aria-label="장소 투표 화면">
        <button type="button" aria-pressed={!resultsOpen} disabled={!!state.confirmedPlace} onClick={() => setShowResults(false)}>투표하기</button>
        <button type="button" aria-pressed={resultsOpen} onClick={() => setShowResults(true)}>투표 결과 <small className="place-vote-count">({voteCount}명 투표)</small></button>
      </div>}
      <FadeUpWrapper as="section" className="place-voting-view" hidden={resultsOpen} aria-labelledby="place-voting-heading">
      <h3 id="place-voting-heading">장소 투표 <small>· {places.length}개</small></h3>
      {places.length > 0 && <div className="place-ballot-summary"><span>{state.confirmedPlace ? '장소 확정 완료' : '가고 싶은 장소 한 곳을 선택하세요'}</span><span>{voteCount} / {state.members.length}명 투표</span></div>}
      <fieldset className="place-ballot" disabled={locked}>
        <legend className="sr-only">투표할 장소 선택</legend>
        {places.map(place => {
          const count = voters(place.id).length;
          const percent = voteCount ? Math.round(count / voteCount * 100) : 0;
          const chosen = selectedVoteId === place.id;
          return <div className={'place-ballot-option' + (chosen ? ' is-selected' : '')} key={place.id}>
            <label className="place-ballot-choice">
              <input type="radio" name="place-vote" value={place.id} checked={chosen} onChange={() => { setVoteChoice(place.id); setVoteMessage(''); }} />
              <span className="place-ballot-check" aria-hidden="true"><Check /></span>
              <span className="place-ballot-info"><strong>{place.region !== '어디든 좋아요' && <>{place.region} / </>}{place.name}</strong>{(state.confirmedPlace === place.id || placeVoteIds(placeVotes[state.me]).includes(place.id)) && <small>{state.confirmedPlace === place.id ? '확정된 장소' : '투표 완료'}</small>}</span>
              <span className="place-ballot-result"><strong>{count}표</strong><small>{percent}%</small></span>
            </label>
            <div className="place-ballot-bottom">
              <div className="place-ballot-meter" aria-label={`투표 참여자 중 ${percent}% 선택`}><span style={{ width: `${percent}%` }} /></div>
              <a href={place.url} target="_blank" rel="noopener noreferrer" aria-label={`${place.name} 지도 보기`}>지도 <ExternalLink aria-hidden="true" /></a>
            </div>
          </div>;
        })}
      </fieldset>
      {places.length > 0 && !state.confirmedPlace && <div className="place-ballot-footer"><span>{voteMessage || '선택한 장소로 투표를 제출하세요.'}</span><button type="button" className="primary" disabled={locked || !places.some(place => place.id === selectedVoteId)} onClick={async () => {
        if (await act('place-vote', { id: selectedVoteId })) {
          setVoteMessage('투표를 완료했어요.');
          setResultChoice(null);
          setShowResults(true);
        }
      }}>{busy ? '투표 중…' : '장소 투표'}</button></div>}
      {!places.length && <p className="place-empty-prompt">장소를 추천해주세요.</p>}
      </FadeUpWrapper>
      {resultsOpen && <FadeUpWrapper as="section" className="place-results-view" aria-labelledby="place-results-heading">
        <div className="place-results-heading"><h3 id="place-results-heading">현재 투표 현황</h3></div>
        <p className="subtext">{voteCount} / {state.members.length}명 투표</p>
        <div className="place-result-chart" aria-label="장소별 득표 현황">
          {[...places].sort((a, b) => voters(b.id).length - voters(a.id).length).map(place => {
            const count = voters(place.id).length;
            const percent = voteCount ? Math.round(count / voteCount * 100) : 0;
            return <button type="button" key={place.id} className={'place-result-card' + (resultChoice === place.id ? ' is-selected' : '')} disabled={locked} aria-pressed={resultChoice === place.id} onClick={() => setResultChoice(place.id)}>
              <span className="place-result-title"><strong>{place.region !== '어디든 좋아요' && <>{place.region} / </>}{place.name}</strong><span>{count}표 · {percent}%</span></span>
              <span className="place-result-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
              <span className="place-result-meta member-identity-list">{count ? voters(place.id).map(member => <MemberIdentity key={member.id} member={member} />) : '투표 대기'}</span>
            </button>;
          })}
        </div>
        {!state.confirmedPlace && <div className="place-ballot-footer"><span>{selectedResult ? <><strong>{selectedResult.name}</strong> 선택</> : '확정할 장소 카드를 선택하세요.'}</span><div className="place-result-actions"><button type="button" className="outline-button" disabled={locked} onClick={() => { setShowResults(false); setResultChoice(null); }}>투표 변경</button><button type="button" className="primary" disabled={locked || !selectedResult || voteCount === 0} onClick={async () => {
          if (selectedResult && await act('place-confirm', { id: selectedResult.id })) setCompletedPlace(selectedResult);
        }}>{busy ? '확정 중…' : '장소 확정'}</button></div></div>}
      </FadeUpWrapper>}
      </div>
    <FadeUpWrapper as="section" className={'card place-planner' + (state.confirmedPlace ? ' is-locked' : '')} aria-labelledby="place-heading">
      <h2 id="place-heading">어디서 만날까요?</h2>
      {state.confirmedPlace && <p className="place-locked-note">장소가 확정되어 선택을 변경할 수 없어요. 변경하려면 장소 확정을 취소해 주세요.</p>}

      {!confirmed && <p className="place-flow-note">확정 전까지 변경할 수 있어요.</p>}
      <div className="place-planning-columns">
      <section className="place-planning-panel region-panel" aria-labelledby="region-heading">
      <h3 id="region-heading">만나고 싶은 지역</h3>
      
      <div className="region-options">{regions.map(value => <button key={value} className={selectedRegion === value ? 'active' : ''} aria-pressed={selectedRegion === value} disabled={locked} onClick={() => {
        setRegion(value);
        if (!locked) void act('region-vote', { region: value });
      }}>{value === '어디든 좋아요' ? '어디든 좋아요❤️' : value}</button>)}</div>
      </section>
      <section className="place-planning-panel venue-panel" aria-labelledby="venue-heading">
      <h3 id="venue-heading">장소 제안&nbsp;<small>· 여러 개 추가 가능</small></h3>
      {state.confirmedPlace && <p className="place-locked-note">장소 제안이 마감되었어요.</p>}
      {!state.confirmedPlace && <section className="place-form-wrap" aria-labelledby="place-form-heading"><form className="place-form" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        if (locked) return;
        setError('');
        try {
          const payload = validatePlacePayload('place-add', { region: selectedRegion, name: data.get('name'), address: selectedRegion, url: data.get('url') });
          if ((state.places || []).length + drafts.length >= 50) throw Error('장소는 최대 50개까지 등록할 수 있어요.');
          if (drafts.some(item => item.url === payload.url && item.region === payload.region)) throw Error('이미 추가한 장소예요.');
          const draftId = crypto.randomUUID();
          setDrafts(current => [...current, { ...payload, draftId }]);
          setSelectedDraftIds(current => [...current, draftId]);
          setProgress('');
          form.reset();
          setInput({ name: '', url: '' });
          setLinkTouched(false);
          form.elements.namedItem('name').focus();
        } catch (e) { setError(e.message); }
      }}>
        <label>장소 이름<input name="name" data-filled={!!input.name.trim()} required maxLength={60} placeholder="예: 성수 카페" disabled={!restored} value={input.name} onChange={event => setInput(current => ({ ...current, name: event.target.value }))} /></label>
        <label>지도 링크 (선택)<input name="url" data-filled={!!input.url.trim() && !linkError} type="url" maxLength={500} placeholder="https://naver.me/…" disabled={!restored} value={input.url} onChange={event => { setInput(current => ({ ...current, url: event.target.value })); setLinkTouched(false); }} onBlur={() => setLinkTouched(true)} aria-invalid={showLinkError} aria-describedby={showLinkError ? 'place-map-link-error' : 'place-map-link-help'} />{showLinkError ? <span id="place-map-link-error" className="form-error" role="alert">{linkError}</span> : <span id="place-map-link-help" className="place-input-help">이름만으로도 추가할 수 있어요. 링크가 없으면 지도에서 장소 이름을 검색해요.</span>}</label>
        <button className="outline-button place-add-draft" disabled={locked || !input.name.trim() || !!linkError}>장소 목록에 추가<Plus aria-hidden="true" /></button>
      </form>
      {drafts.length > 0 && <div className="place-draft-list">
        <div className="place-draft-heading"><h4>등록할 장소 <span>{drafts.length}개</span></h4></div>
        <p className="place-draft-selection-note">{selectedDrafts.length}개 선택</p>
        <ul>{drafts.map(draft => <li key={draft.draftId}>
          <label className="place-draft-choice"><input type="checkbox" checked={selectedDraftIds.includes(draft.draftId)} disabled={registering} onChange={event => {
            const checked = event.target.checked;
            setSelectedDraftIds(current => checked ? [...current, draft.draftId] : current.filter(id => id !== draft.draftId));
          }} /><span><strong>{draft.name}</strong><small>{draft.region}</small></span></label>
          <button type="button" className="text-button" disabled={registering} aria-label={`${draft.name} 장소 삭제`} onClick={() => setDeleteTarget(draft)}><Trash2 aria-hidden="true" /></button>
        </li>)}</ul>
        <button type="button" className="primary" disabled={locked || !selectedDrafts.length} onClick={registerDrafts}>{registering ? '등록 중…' : selectedDrafts.length ? `선택한 장소 ${selectedDrafts.length}개 등록` : '장소 등록'}</button>
      </div>}
      {progress && <div className="place-guide-message" role="status" aria-live="polite" aria-atomic="true">
        <img src="/avatars/rabbit.svg" width="36" height="36" alt="" className="place-guide-avatar" />
        <div className="place-guide-bubble"><span className="place-guide-name">약속 도우미</span><p>{progress}</p></div>
      </div>}
      </section>}
      </section>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <dialog ref={placeConfirmDialog} className="modal place-confirm-dialog" aria-labelledby="place-confirm-title" onCancel={() => setCompletedPlace(null)}>
        <span className="modal-emoji"><Check aria-hidden="true" /></span>
        <h2 id="place-confirm-title">장소가 확정되었어요</h2>
        {completedPlace && <div className="place-complete-info"><strong>{completedPlace.region} · {completedPlace.name}</strong></div>}
        <button type="button" className="primary" autoFocus onClick={() => setCompletedPlace(null)}>확인</button>
      </dialog>
      <dialog ref={deleteDialog} className="modal place-delete-modal" aria-labelledby="place-delete-title" onCancel={() => setDeleteTarget(null)}>
        <h2 id="place-delete-title"><span className="place-delete-name">{deleteTarget?.name}</span> 삭제할까요?</h2>
        
        <div className="place-delete-actions">
          <button type="button" className="cancel-button" autoFocus onClick={() => setDeleteTarget(null)}>취소</button>
          <button type="button" className="place-delete-confirm" onClick={() => {
            if (!deleteTarget || registering) return;
            setDrafts(current => current.filter(item => item.draftId !== deleteTarget.draftId));
            setSelectedDraftIds(current => current.filter(id => id !== deleteTarget.draftId));
            setDeleteTarget(null);
          }}>삭제</button>
        </div>
      </dialog>
    </FadeUpWrapper>
    </>
  );
}
