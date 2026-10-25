'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import RecommendationCarousel from './recommendation-carousel';
import MeetingSkeleton, { PlaceSkeleton, StatisticsSkeleton } from './skeleton';
import MemberIdentity from './member-identity';
import { QRCodeSVG } from 'qrcode.react';
import { applyPlaceAction } from '../lib/places.mjs';
import { holidayLabel } from '../lib/holidays.mjs';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CalendarDays,
  Heart,
  Hand,
  PartyPopper,
  CalendarCheck,
  UserPlus,
  Users,
  Sparkles,
  Star,
  X as XIcon,
} from 'lucide-react';
import {
  TIMES,
  koreaToday,
  rankSlots,
  dateLabel,
  voteAgeLabel,
  availableDays,
} from '../lib/meeting.mjs';
const OverlapStatistics = dynamic(() => import('./overlap-statistics'), {
  ssr: false,
  loading: () => <StatisticsSkeleton />,
});
const PlacePlanner = dynamic(() => import('./place-planner'), {
  loading: () => <PlaceSkeleton />,
});
const empty = { members: [], confirmed: null, me: null };
const ProfileEditor = dynamic(() => import('./profile-editor'), { ssr: false });
export default function Meeting({ configured, initialDate, holidayCalendar, roomName = '우리 모임' }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteDialog = useRef(null);
  useEffect(() => {
    if (!inviteOpen) return;
    const dialog = inviteDialog.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [inviteOpen]);
  const [state, S] = useState(empty),
    [today, T] = useState(initialDate),
    [month, M] = useState(initialDate.slice(0, 7)),
    [selected, D] = useState(initialDate),
    [slots, V] = useState([]),
    [nickname, N] = useState(''),
    [ready, R] = useState(false),
    [token, K] = useState(''),
    [room, Q] = useState(''),
    [busy, B] = useState(false),
    [message, E] = useState(''),
    [dirty, U] = useState(false),
    [confirmOpen, setConfirmOpen] = useState(false),
    [pick, F] = useState(''),
    [sync, Y] = useState('연결 중');
  const [now, setNow] = useState(() => Date.now());
  const [initialReadComplete, setInitialReadComplete] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const resetDialog = useRef(null);
  useEffect(() => {
    if (!resetOpen) return;
    const dialog = resetDialog.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [resetOpen]);
  const latestState = useRef(state);
  latestState.current = state;
  const [step, setStep] = useState('time');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [welcomeName, setWelcomeName] = useState('');
  const welcomeDialog = useRef(null);
  const confirmationDialog = useRef(null);
  const draftRef = useRef([]),
    revisionRef = useRef(0),
    savingRef = useRef(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeCounts, setTimeCounts] = useState([]);
  const timeDialog = useRef(null);
  const touch = useRef(null),
    tokenRef = useRef(''),
    dirtyRef = useRef(false),
    inflight = useRef(false);
  dirtyRef.current = dirty;
  const me = state.members.find((m) => m.id === state.me),
    ranks = rankSlots(state.members, today || koreaToday()),
    responded = state.members.filter((m) => m.responded).length;
  async function request(action, payload = {}, quiet = false) {
    if (
      action === 'read' &&
      (inflight.current || dirtyRef.current || savingRef.current)
    )
      return;
    if (!quiet) B(true);
    inflight.current = true;
    try {
      const res = await fetch('/api/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          room,
          token: tokenRef.current,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      if (action === 'read' && (dirtyRef.current || savingRef.current))
        return data;
      S(data.state);
      T(data.today);
      if (data.token) {
        tokenRef.current = data.token;
        K(data.token);
        localStorage.setItem('mm-token:' + room, data.token);
      }
      if (action === 'join' || !dirtyRef.current) {
        const mine = data.state.members.find((m) => m.id === data.state.me);
        draftRef.current = mine?.slots || [];
        V(draftRef.current);
      }
      Y('자동 업데이트 중');
      return data;
    } catch (e) {
      if (action === 'profile') throw e;
      Y('연결 확인 필요');
      if (!quiet) E(e.message);
      return null;
    } finally {
      if (action === 'read') setInitialReadComplete(true);
      inflight.current = false;
      if (!quiet) B(false);
    }
  }
  useEffect(() => {
    const day = koreaToday();
    T(day);
    M(day.slice(0, 7));
    D(day);
    const r = new URLSearchParams(location.search).get('room') || '';
    Q(r);
    if (!configured) {
      try {
        const saved = JSON.parse(localStorage.getItem('mm-demo:' + r) || 'null');
        if (saved) {
          S(saved);
          draftRef.current =
            saved.members.find((m) => m.id === saved.me)?.slots || [];
          V(draftRef.current);
        }
      } catch {}
      Y('이 기기에만 저장');
      R(true);
      return;
    }
    const saved = localStorage.getItem('mm-token:' + r) || '';
    tokenRef.current = saved;
    K(saved);
    R(true);
  }, [configured]);
  useEffect(() => {
    if (!ready || !configured || !token) return;
    request('read');
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') request('read', {}, true);
    }, 3000);
    return () => clearInterval(timer);
  }, [ready, configured, token, room]);
  useEffect(() => {
    const update = () => {
      T(koreaToday());
      setNow(Date.now());
    };
    const id = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', update);
    };
  }, []);
  useEffect(() => {
    if (!timeOpen) return;
    const dialog = timeDialog.current,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [timeOpen]);
  function openTime(day) {
    D(day);
    setTimeCounts(rankSlots(state.members, today || koreaToday()));
    setTimeOpen(true);
  }
  function closeTime() {
    if (savingRef.current) return;
    const current = latestState.current;
    const savedSlots = current.members.find(member => member.id === current.me)?.slots || [];
    draftRef.current = savedSlots;
    V(savedSlots);
    dirtyRef.current = false;
    U(false);
    setSaveStatus('saved');
    setTimeOpen(false);
  }
  useEffect(() => {
    if (!welcomeName) return;
    const dialog = welcomeDialog.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => setWelcomeName(''), 2000);
    return () => {
      clearTimeout(timer);
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [welcomeName]);
  function demoSave(next) {
    latestState.current = next;
    S(next);
    localStorage.setItem('mm-demo:' + room, JSON.stringify(next));
  }
  async function saveProfile(profile) {
    if (configured) { await request('profile', profile); return; }
    const current = latestState.current;
    if (current.members.some(member => member.id !== current.me && member.nickname.toLowerCase() === profile.nickname.toLowerCase())) throw Error('이미 사용 중인 닉네임이에요.');
    demoSave({ ...current, members: current.members.map(member => member.id === current.me ? { ...member, ...profile } : member) });
  }
  async function join(e) {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (configured) {
      const result = await request('join', { nickname });
      const joined = result?.state.members.find(
        (member) => member.id === result.state.me,
      );
      if (joined) {
        E('');
        setWelcomeName(joined.nickname);
      }
      return;
    }
    if (
      state.members.some(
        (m) => m.nickname.toLowerCase() === nickname.trim().toLowerCase(),
      )
    ) {
      E('이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.');
      return;
    }
    const id = crypto.randomUUID();
    demoSave({
      ...state,
      me: id,
      members: [
        ...state.members,
        { id, nickname: nickname.trim(), responded: false, slots: [] },
      ],
    });
    draftRef.current = [];
    V([]);
    setSaveStatus('saved');
    E('');
    setWelcomeName(nickname.trim());
  }
  function changeMonth(n) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    M(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function changeSlots(next) {
    if (!me || state.confirmed) return;
    draftRef.current = next.filter((s) => s.slice(0, 10) >= today);
    revisionRef.current++;
    dirtyRef.current = true;
    V(draftRef.current);
    U(true);
    setSaveStatus('unsaved');
  }
  function toggle(slot) {
    changeSlots(
      draftRef.current.includes(slot)
        ? draftRef.current.filter((s) => s !== slot)
        : [...draftRef.current, slot],
    );
  }
  async function save() {
    if (savingRef.current || !me || state.confirmed) return;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      do {
        const revision = revisionRef.current,
          snapshot = [...draftRef.current];
        if (configured) {
          const result = await request('save', { slots: snapshot }, true);
          if (!result)
            throw Error(
              '시간을 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
            );
        } else
          demoSave({
            ...state,
            members: state.members.map((m) =>
              m.id === state.me
                ? {
                    ...m,
                    slots: snapshot,
                    responded: true,
                    votedAt: new Date().toISOString(),
                  }
                : m,
            ),
          });
        if (revision === revisionRef.current) {
          dirtyRef.current = false;
          U(false);
          setSaveStatus('saved');
          break;
        }
      } while (true);
      return true;
    } catch (e) {
      setSaveStatus('error');
      E(e.message);
      return false;
    } finally {
      savingRef.current = false;
    }
  }
  async function confirm(candidateSlot) {
    if (!me || busy || dirtyRef.current || savingRef.current) return;
    const wasConfirmed = !!state.confirmed,
      slot = typeof candidateSlot === 'string' ? candidateSlot : pick;
    if (!wasConfirmed && !ranks.some((r) => r.slot === slot)) {
      E('참여 가능한 인원이 있는 시간을 선택해 주세요.');
      return;
    }
    if (configured) {
      const result = await request(wasConfirmed ? 'unconfirm' : 'confirm', {
        slot,
      });
      if (!result) return;
    } else demoSave({ ...state, confirmed: wasConfirmed ? null : slot, confirmedPlace: null });
    if (wasConfirmed) setStep('time');
    setConfirmOpen(!wasConfirmed);
    F('');
    E(
      wasConfirmed
        ? '확정을 취소했어요. 다시 시간을 선택할 수 있어요.'
        : '',
    );
  }
  useEffect(() => {
    if (!confirmOpen || !state.confirmed) return;
    const dialog = confirmationDialog.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [confirmOpen, state.confirmed]);
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      E('초대 링크를 복사했어요. 함께할 사람에게 공유해 주세요.');
    } catch {
      E('주소창의 링크를 복사해서 공유해 주세요.');
    }
  }
  async function placeAction(action, payload) {
    if (busy) return false;
    if (configured) return !!(await request(action, { payload }));
    demoSave(applyPlaceAction(latestState.current, action, payload, crypto.randomUUID()));
    return true;
  }
  async function resetMeeting() {
    if (!me || busy || savingRef.current) return;
    if (configured) {
      if (!await request('reset')) return;
    } else {
      demoSave({ ...state, members: state.members.map(member => ({ ...member, slots: [], responded: false, votedAt: null })), confirmed: null, confirmedPlace: null, places: [], regionVotes: {}, placeVotes: {}, resetVersion: crypto.randomUUID() });
    }
    revisionRef.current++;
    draftRef.current = [];
    dirtyRef.current = false;
    V([]);
    U(false);
    setSaveStatus('saved');
    setStep('time');
    setConfirmOpen(false);
    setTimeOpen(false);
    F('');
    D(today);
    M(today.slice(0, 7));
    setResetOpen(false);
    E('일정과 장소를 초기화했어요.');
  }
  const yy = Number(month.slice(0, 4)),
    mm = Number(month.slice(5)),
    days = month ? new Date(yy, mm, 0).getDate() : 0,
    start = month ? new Date(yy, mm - 1, 1).getDay() : 0;
  const memberCount = state.members.length;
  const yearHolidays = holidayCalendar.dates[yy];
  const monthHolidays = Object.entries(yearHolidays || {})
    .filter(([date]) => date.startsWith(month + '-'))
    .sort(([a], [b]) => a.localeCompare(b));
  const responsePercent = memberCount
    ? Math.round((responded / memberCount) * 100)
    : 0;
  const selectedRanks = timeCounts.filter((r) => r.slot.startsWith(selected + '|'));
  const members = state.members;
  const statusText =
    saveStatus === 'error'
      ? '저장 실패 · 다시 시도해 주세요'
      : saveStatus === 'saving'
        ? '저장 중…'
        : dirty ? '' : '';
  const recommendedDays = [],
    recommendedDates = new Set();
  for (const candidate of ranks) {
    const day = candidate.slot.slice(0, 10);
    if (!recommendedDates.has(day)) {
      recommendedDates.add(day);
      recommendedDays.push(candidate);
    }
  }
  const bestDay = state.confirmed
    ? null
    : recommendedDays[0]?.slot.slice(0, 10);
  const confirmedMembers = members.filter(
    (member) => member.responded && member.slots.includes(state.confirmed),
  );
  const confirmedPlace = state.places?.find(place => place.id === state.confirmedPlace);
  const showPlaces = step === 'place' && !!state.confirmed;
  if (!ready || (configured && token && !initialReadComplete)) return <MeetingSkeleton />;
  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">
          Meet Soon
        </a>
        {/* <span className="header-note">
          <span /> A little closer, together.
        </span> */}
        <div className="topbar-actions">
        <button className="outline-button topbar-share" onClick={() => setInviteOpen(true)}>
          친구 초대 <ArrowUpRight aria-hidden="true" />
        </button>
        {me && <button type="button" className="topbar-profile" aria-label={`${me.nickname}, 내 정보 수정`} aria-haspopup="dialog" disabled={busy || dirty || saveStatus === 'saving'} onClick={() => setProfileOpen(true)}><MemberIdentity member={me} /></button>}
        </div>
      </header>
      {profileOpen && me && <ProfileEditor member={me} onSave={saveProfile} onClose={() => setProfileOpen(false)} />}
      <dialog ref={inviteDialog} className="modal" aria-labelledby="invite-title" onCancel={() => setInviteOpen(false)}>
        {inviteOpen && <div className="invite-modal">
          <h2 id="invite-title">{roomName}에 초대하기</h2>
          <QRCodeSVG value={typeof location !== 'undefined' ? location.href : ''} size={192} marginSize={4} />
          <p>모임 코드</p><strong className="invite-code">{room}</strong>
          <p>코드를 입력하거나 QR을 스캔하면 참여할 수 있어요.</p>
          {!configured && <p className="demo-warning">체험 모드는 다른 기기와 공유되지 않아요.</p>}
          <button className="primary" autoFocus onClick={share}>초대 링크 복사</button>
          <button className="outline-button" onClick={() => setInviteOpen(false)}>닫기</button>
        </div>}
      </dialog>
      {state.confirmed && (
        <section className={`confirmed-hero confirmed-banner${confirmedPlace ? ' is-sliding' : ''}`} aria-label={confirmedPlace ? '시간과 장소 확정 완료' : '시간 확정, 장소 선택 필요'}>
          {confirmedPlace ? (
            <div className="confirmed-banner-track">
              {[0, 1].map(group => <div className="confirmed-banner-group" key={group} aria-hidden={group === 1 ? true : undefined}>
                {[0, 1].map(copy => <div className="confirmed-banner-item" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                  <span className="confirmed-banner-label"><CalendarCheck aria-hidden="true" />약속 확정</span>
                  <strong>{dateLabel(state.confirmed.split('|')[0])} · {state.confirmed.split('|')[1]}</strong>
                  <span className="confirmed-banner-people">{confirmedMembers.length}명 가능</span>
                  <a className="confirmed-banner-place" href={confirmedPlace.url} target="_blank" rel="noopener noreferrer" tabIndex={group === 0 && copy === 0 ? 0 : -1}>{confirmedPlace.name}<ArrowUpRight aria-hidden="true" /></a>
                </div>)}
              </div>)}
            </div>
          ) : <>
          <div className="confirmed-banner-main">
            <span className="confirmed-banner-label"><CalendarCheck aria-hidden="true" />시간 확정</span>
            <strong>{dateLabel(state.confirmed.split('|')[0])} · {state.confirmed.split('|')[1]}</strong>
            <span className="confirmed-banner-people">{confirmedMembers.length}명 가능</span>
            <span className="confirmed-banner-pending">장소 선택 필요</span>
          </div>
          </>}
        </section>
      )}
      <main className={showPlaces ? 'place-workspace' : 'time-workspace'}>
        <section className="meeting-room" aria-label="현재 모임과 내 참여 정보">
            <div className="meeting-room-title">
              <span className="meeting-room-label">모임명</span>
              <h1 className="meeting-room-name">{roomName}</h1>
            </div>
        </section>
        <nav className="meeting-steps" aria-label="약속 정하기 단계">
          <button aria-current={!showPlaces ? 'step' : undefined} onClick={() => setStep('time')}><span>{state.confirmed ? '✓' : '1'}</span><strong>시간 정하기</strong><small>{state.confirmed ? '확정 완료' : '가능한 시간 선택'}</small></button>
          <ArrowRight aria-hidden="true" />
          <button aria-current={showPlaces ? 'step' : undefined} disabled={!state.confirmed} onClick={() => setStep('place')}><span>{confirmedPlace ? '✓' : '2'}</span><strong>장소 정하기</strong><small>{confirmedPlace ? '확정 완료' : state.confirmed ? '장소 선택 및 투표' : '시간 확정 후 가능'}</small></button>
        </nav>
        {/* <section className="hero">
          <div className="hero-text">
            <h1>모두에게 맞는 시간을 찾아보세요</h1>
            <p>
              가능한 시간을 선택하고
              <br />
              함께할 약속을 정해보세요
            </p>
            */}
            {/* <div className="hero-tags">
              <span>
                <CalendarDays aria-hidden="true" /> 날짜 선택
              </span>
              <span>
                <Users aria-hidden="true" /> 시간 선택
              </span>
              <span>
                <Heart aria-hidden="true" /> 함께 만나기
              </span>
            </div> */}
            {/*
          </div>
          <div className="calendar-scene" aria-hidden="true">
            <div className="scene-orbit" />
            <div className="floating-note note-top">
              <span>
                <Users />
              </span>
              <div>
                가능한 시간<small>함께 확인해요</small>
              </div>
              <Check />
            </div>
            <div className="mini-calendar">
              <div className="calendar-rings">
                <i />
                <i />
              </div>
              <div className="mini-heading">
                일정 선택
                <CalendarDays />
              </div>
              <strong>함께할 시간</strong>
              <div className="mini-week">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
              <div className="mini-dates">
                {Array.from({ length: 14 }, (_, i) => (
                  <span className={i === 9 ? 'marked' : ''} key={i}>
                    {i === 9 ? <Heart /> : i + 1}
                  </span>
                ))}
              </div>
            </div>
            <div className="floating-note note-bottom">
              <span>
                <CalendarCheck />
              </span>
              확정된 약속<Heart />
            </div>
          </div>
        </section> */}
        <div className="content">
          <div className="notice"></div>
          {!state.confirmed && (
            <section className="recommend" aria-labelledby="recommend-title">
              <div className="recommend-heading">
                <div className="section-symbol"><CalendarCheck aria-hidden="true" /></div>
                <div>
                  <h2 id="recommend-title">추천 날짜와 시간</h2>
                  <p>날짜별로 가장 많은 인원이 가능한 시간을 추천해요.</p>
                </div>
              </div>
              {recommendedDays.length ? (
                <RecommendationCarousel count={recommendedDays.length}>
                  {recommendedDays.map((r, i) => (
                    <div key={r.slot} className={'recommend-option ' + (i === 0 ? 'best ' : '') + (pick === r.slot ? 'selected' : '')}>
                      <button className="recommend-choice" onClick={() => F(r.slot)} aria-pressed={pick === r.slot}>
                        <span className="recommend-label">추천 {i + 1}순위</span>
                        <strong>{dateLabel(r.slot.slice(0, 10))}</strong>
                        <time>{r.slot.split('|')[1]}</time>
                        <span className="recommend-people">
                          <Users aria-hidden="true" /><b>{r.count}명 가능</b><small>/ {memberCount}명</small>
                          {r.count === memberCount && <em>전원 가능</em>}
                        </span>
                        <span className="recommend-names member-identity-list">{members.filter((m) => m.responded && m.slots.includes(r.slot)).map((m) => <MemberIdentity key={m.id} member={m} />)}</span>
                        <span className="recommend-link">
                          {pick === r.slot ? '선택한 시간' : '이 시간 선택'}
                          {pick === r.slot ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                        </span>
                      </button>
                      {(i === 0 || pick === r.slot) && (
                        <div className="recommend-confirm-overlay">
                          <button className="confirm-action card-confirm" disabled={!me || busy || dirty} onClick={() => confirm(r.slot)}>
                            <CalendarCheck aria-hidden="true" />{busy ? '확정 중…' : '약속 확정'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </RecommendationCarousel>
              ) : (
                <div className="recommend-empty">아직 추천할 일정이 없어요.<br /><span>달력에서 가능한 시간을 선택하면 추천 일정을 확인할 수 있어요.</span></div>
              )}
            </section>
          )}
          {showPlaces && <PlacePlanner key={`${room}:${state.me}:${state.resetVersion || ''}`} storageKey={`mm-place-drafts:${configured ? room : 'demo'}:${state.me}:${state.resetVersion || ''}`} state={state} busy={busy} onAction={placeAction} />}
          <div className="layout" hidden={showPlaces}>
            <div className="main-column">
              <section className="card calendar">
                <div className="card-heading">
                  <div>
                    <h2>언제가 좋아요?</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      M(today.slice(0, 7));
                      D(today);
                    }}
                  >
                    오늘로 이동
                  </button>
                </div>
                <div className="month-nav">
                  <button aria-label="이전 달" onClick={() => changeMonth(-1)}>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <h3>
                    {yy}년 <em>{mm}월</em>
                  </h3>
                  <button aria-label="다음 달" onClick={() => changeMonth(1)}>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
                <div className="weekdays">
                  {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div
                  className="calendar-grid"
                  onTouchStart={(e) => {
                    touch.current = {
                      x: e.touches[0].clientX,
                      y: e.touches[0].clientY,
                    };
                  }}
                  onTouchEnd={(e) => {
                    if (!touch.current) return;
                    const dx = e.changedTouches[0].clientX - touch.current.x,
                      dy = e.changedTouches[0].clientY - touch.current.y;
                    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4)
                      changeMonth(dx < 0 ? 1 : -1);
                    touch.current = null;
                  }}
                >
                  {Array.from({ length: start }, (_, i) => (
                    <span key={'blank' + i} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const d = month + '-' + String(i + 1).padStart(2, '0'),
                      mine = slots.some((s) => s.startsWith(d + '|')),
                      holidays = yearHolidays?.[d] || [],
                      weekday = (start + i) % 7,
                      count = members.filter((member) =>
                        member.slots.some((slot) => slot.startsWith(d + '|')),
                      ).length;
                    return (
                      <button
                        key={d}
                        disabled={d < today}
                        aria-label={`${d}${d === today ? ' 오늘' : ''}${d === bestDay ? ' 추천 1순위 날짜' : ''}${holidays.length ? ' ' + holidays.join(', ') : ''}${mine ? ' 내가 선택한 날짜' : ''} ${count}명 선택`}
                        aria-current={d === today ? 'date' : undefined}
                        title={holidays.join(' · ') || undefined}
                        aria-pressed={mine}
                        aria-haspopup="dialog"
                        onClick={() => openTime(d)}
                        className={`day ${selected === d && d !== today ? 'selected' : ''} ${mine ? 'mine' : ''} ${d === today ? 'today' : ''} ${holidays.length ? 'holiday' : ''} ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''} ${d === bestDay ? 'recommended' : ''}`}
                      >
                        <span className="day-heading">
                          <span>{i + 1}</span>
                          {holidays.length > 0 && (
                            <span className="day-caption">{holidayLabel(holidays)}</span>
                          )}
                        </span>
                        {d === today && <span className="day-today">오늘</span>}
                        {count > 0 && <small>{count}명 선택</small>}
                      </button>
                    );
                  })}
                </div>
                {!yearHolidays ? (
                  <p className="subtext" role="status">
                    {yy}년 공휴일 정보를 불러올 수 없어요.
                  </p>
                ) : (
                  holidayCalendar.fallback && (
                    <p className="subtext" role="status">
                      저장된 공휴일 정보를 표시하고 있어요. 최근 변경사항은 반영되지 않았을 수 있어요.
                    </p>
                  )
                )}
              </section>
              <section className="card results">
                <div className="card-heading">
                  <div>
                    <h2>참여 가능한 시간</h2>
                  </div>
                  <span className="tag">응답 통계</span>
                </div>
                <p className="subtext">
                  참여 가능 인원: {memberCount}명
                </p>
                {!showPlaces && <OverlapStatistics
                  ranks={ranks}
                  members={members}
                  onOpenDay={(day) => {
                    openTime(day);
                    M(day.slice(0, 7));
                  }}
                />}
              </section>
            </div>
            {!configured && !me && state.members.length > 0 && <aside>
              <div className="meeting-actions">
                {!configured && !me && state.members.length > 0 && (
                  <button
                    className="join-action"
                    disabled={dirty || busy}
                    onClick={() => {
                      demoSave({ ...state, me: null });
                      draftRef.current = [];
                      V([]);
                      N('');
                      E('');
                      setSaveStatus('saved');
                    }}
                  >
                    <UserPlus aria-hidden="true" />
                    <span>
                      체험 참여자 추가
                      <small>이 기기에서 다른 참여자의 응답을 추가해요</small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                )}
              </div>
            </aside>}
          </div>
          <section className="card friends" aria-labelledby="friends-title" hidden={showPlaces}>
            <div className="card-heading">
              <div>
                <h2 id="friends-title">참여자별 응답 현황</h2>
              </div>
              <span className="response-summary">
                <strong>{responded}</strong> / {memberCount}명 응답 완료
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="참여자 응답률"
              aria-valuenow={responded}
              aria-valuemin={0}
              aria-valuemax={memberCount || 1}
            >
              <i style={{ width: responsePercent + '%' }} />
            </div>
            <div className="friend-list">
              {state.members.map((m) => {
                const days = availableDays(m.slots, today);
                return (
                  <article className="friend" key={m.id}>
                    <strong className="friend-name">
                      <MemberIdentity member={m}>
                      {m.id === state.me && (
                        <small className="me-badge">나</small>
                      )}
                      </MemberIdentity>
                    </strong>
                    {!m.responded && <span className="status">응답 대기</span>}
                    <span className="vote-age">
                      {m.responded ? (
                        m.votedAt ? (
                          <time
                            dateTime={m.votedAt}
                            title={new Date(m.votedAt).toLocaleString('ko-KR', {
                              timeZone: 'Asia/Seoul',
                            })}
                          >
                            {voteAgeLabel(m.votedAt, now)}
                          </time>
                        ) : (
                          '응답 시각 정보 없음'
                        )
                      ) : (
                        '아직 응답하지 않았어요'
                      )}
                    </span>
                    <div className="friend-availability">
                      <strong>가능한 요일 {days.weekdays.length}개</strong>
                      <span>
                        {days.weekdays.length
                          ? days.weekdays.join(' · ')
                          : '선택한 날짜 없음'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
            {!memberCount && (
              <p className="subtext">아직 참여자가 없어요. 초대 링크를 공유해 주세요.</p>
            )}
          </section>
          {me && <div className="meeting-reset-area"><button type="button" className="meeting-reset-button" disabled={busy || saveStatus === 'saving'} onClick={() => setResetOpen(true)}>일정·장소 초기화</button></div>}
          <footer>
            <span className="footer-brand">Meet Soon</span>
            <p className="footer-copyright">© Sso. All Rights Reserved.</p>
          </footer>
        </div>
      </main>
      <dialog ref={resetDialog} className="modal meeting-reset-modal" aria-labelledby="reset-title" onCancel={event => { if (busy) event.preventDefault(); else setResetOpen(false); }}>
        <h2 id="reset-title">일정과 장소를 초기화할까요?</h2>
        <p>모든 참여자의 시간 응답, 확정 일정, 장소 후보와 투표가 삭제돼요. 참여자 정보는 유지되며, 삭제한 내용은 복구할 수 없어요.</p>
        <div className="meeting-reset-actions"><button type="button" className="cancel-button" autoFocus disabled={busy} onClick={() => setResetOpen(false)}>취소</button><button type="button" className="meeting-reset-confirm" disabled={busy || saveStatus === 'saving'} onClick={resetMeeting}>{busy ? '초기화 중…' : '전체 초기화'}</button></div>
      </dialog>
      <dialog
        ref={timeDialog}
        className="modal time-modal"
        aria-labelledby="time-modal-title"
        onCancel={event => { event.preventDefault(); closeTime(); }}
        onClose={closeTime}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              closeTime();
          }
        }}
      >
        {' '}
        <div className="time-modal-content">
          <button
            type="button"
            className="close"
            aria-label="시간 선택 닫기"
            autoFocus
            onClick={closeTime}
          >
            <XIcon aria-hidden="true" />
          </button>
          <div className="card-heading">
            <div>
              <h2 id="time-modal-title">
                {selected ? dateLabel(selected) : '날짜를 선택해 주세요'}
              </h2>
            </div>
          </div>
          <p className="subtext">
            참여 가능한 시간을 선택한 뒤 저장해 주세요.
          </p>
          <div className="time-actions">
            <button
              disabled={!me || !!state.confirmed || selected < today || saveStatus === 'saving'}
              onClick={() =>
                changeSlots([
                  ...new Set([
                    ...draftRef.current,
                    ...TIMES.map((t) => selected + '|' + t),
                  ]),
                ])
              }
            >
              모두 선택
            </button>
            <button
              disabled={!me || !!state.confirmed || selected < today || saveStatus === 'saving'}
              onClick={() =>
                changeSlots(
                  draftRef.current.filter((s) => !s.startsWith(selected + '|')),
                )
              }
            >
              선택 해제
            </button>
          </div>
          <div className="time-grid">
            {TIMES.map((t) => {
              const slot = selected + '|' + t,
                count = selectedRanks.find((r) => r.slot === slot)?.count || 0;
              return (
                <button
                  disabled={!me || !!state.confirmed || selected < today || saveStatus === 'saving'}
                  key={t}
                  aria-pressed={slots.includes(slot)}
                  className={slots.includes(slot) ? 'chosen' : ''}
                  onClick={() => toggle(slot)}
                >
                  <span>{t}</span>
                  {count > 0 ? (
                    <small className="availability-badge has-people">
                      <Users aria-hidden="true" />
                      {count}명 가능
                    </small>
                  ) : state.confirmed || selected < today ? (
                    <small className="availability-hint">
                      선택 마감
                    </small>
                  ) : null}
                </button>
              );
            })}
          </div>
          {!me && (
            <p className="subtext">
              닉네임을 입력하고 참여하면 시간을 선택할 수 있어요.
            </p>
          )}
   
          <div className="time-modal-footer">
          {(state.confirmed || statusText) && (
            <p className={'save-status ' + saveStatus} role="status">
              {state.confirmed ? '약속이 확정되어 시간을 수정할 수 없어요' : statusText}
            </p>
          )}
          {!state.confirmed && me && selected >= today ? (
            <button className="primary" disabled={!dirty || saveStatus === 'saving'} onClick={async () => { if (await save()) setTimeOpen(false); }}>
              {saveStatus === 'saving' ? '저장 중…' : '저장'}
            </button>
          ) : <button className="primary" onClick={closeTime}>닫기</button>}
          </div>
        </div>
      </dialog>
      <dialog
        ref={welcomeDialog}
        className="welcome-splash"
        aria-labelledby="welcome-title"
        onCancel={(event) => event.preventDefault()}
      >
        {welcomeName && (
          <div className="welcome-card">
            <span className="welcome-icon" aria-hidden="true">
              <Hand />
            </span>
            <h2 id="welcome-title"><MemberIdentity member={{ id: state.me, nickname: welcomeName }} />님, 환영해요</h2>
            <span className="welcome-sparkles" aria-hidden="true">
              <Sparkles />
            </span>
          </div>
        )}
      </dialog>
      {ready && !me && (
        <div className="overlay">
          <form className="modal join-modal" onSubmit={join}>
            <span className="modal-emoji">
              <CalendarDays aria-hidden="true" />
            </span>
            <div className="script">Meet Soon</div>
            <h2>닉네임을 입력해주세요</h2>
            <label htmlFor="nickname">닉네임</label>
            <input
              id="nickname"
              autoFocus
              autoComplete="nickname"
              maxLength={12}
              value={nickname}
              onChange={(e) => N(e.target.value)}
              placeholder="닉네임 입력 (최대 12자)"
              required
            />
            <button
              className="primary"
              disabled={busy || (configured && !room)}
            >
              {busy ? (
                '참여 중…'
              ) : (
                <>
                  참여하기 <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
            <p className="demo-warning">
              {configured
                ? room
                  ? '초대 링크를 받은 사람만 참여할 수 있어요.'
                  : '초대 링크가 올바르지 않아요. 공유받은 링크를 다시 확인해 주세요.'
                : '체험 모드예요. 응답은 이 기기에만 저장되며 다른 참여자와 공유되지 않아요.'}
            </p>
            {message && (
              <p role="alert" className="form-error">
                {message}
              </p>
            )}
          </form>
        </div>
      )}
      <dialog ref={confirmationDialog} className="modal confirmation-modal" aria-labelledby="confirmation-title" onCancel={() => setConfirmOpen(false)}>
        {state.confirmed && (
          <>
            <button type="button" className="close" aria-label="확정 안내 닫기" onClick={() => setConfirmOpen(false)}><XIcon aria-hidden="true" /></button>
            <span className="modal-emoji"><CalendarCheck aria-hidden="true" /></span>
            <h2 id="confirmation-title">약속이 확정되었어요</h2>
            <div className="confirmation-date"><strong>{dateLabel(state.confirmed.split('|')[0])}</strong><time>{state.confirmed.split('|')[1]}</time></div>
            <div className="confirm-attendees">
              <strong>{confirmedMembers.length}명 가능</strong>
              <ul className="confirmed-names">{confirmedMembers.map((member) => <li key={member.id}><MemberIdentity member={member} /></li>)}</ul>
            </div>
            {confirmedPlace && <div className="confirmed-place-summary"><strong>{confirmedPlace.name}</strong><span>{confirmedPlace.address}</span><a href={confirmedPlace.url} target="_blank" rel="noopener noreferrer">지도 보기 <ArrowUpRight aria-hidden="true" /></a></div>}
            {message && <p role="alert" className="form-error">{message}</p>}
            <div className="confirmation-buttons">
              {!confirmedPlace && <button className="primary confirmation-place-action" autoFocus onClick={() => { setConfirmOpen(false); setStep('place'); }}>장소 정하기 <ArrowRight aria-hidden="true" /></button>}
              <button className={confirmedPlace ? 'primary' : 'outline-button'} autoFocus={!!confirmedPlace} onClick={() => setConfirmOpen(false)}>확인</button>
              <button className="cancel-button confirmation-cancel" disabled={busy || dirty || !me} onClick={confirm}>{busy ? '취소 중…' : '확정 취소'}</button>
            </div>
          </>
        )}
      </dialog>
      {message && me && (
        <div className="toast" role="status" onClick={() => E('')}>
          {message}
          <button aria-label="알림 닫기">
            <XIcon aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
