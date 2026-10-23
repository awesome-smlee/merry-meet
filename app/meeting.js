'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ParticipantOverview from './participant-overview';
import PlacePlanner from './place-planner';
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
  Quote,
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
  avatarSeed,
} from '../lib/meeting.mjs';
const OverlapStatistics = dynamic(() => import('./overlap-statistics'), {
  ssr: false,
  loading: () => <p className="subtext" role="status">시간 통계를 불러오고 있어요.</p>,
});
const icons = [
  <Heart key="heart" aria-hidden="true" />,
  <CalendarDays key="calendar" aria-hidden="true" />,
  <Star key="star" aria-hidden="true" />,
  <Hand key="hand" aria-hidden="true" />,
  <Users key="users" aria-hidden="true" />,
];
const empty = { members: [], confirmed: null, me: null };
export default function Meeting({ configured, initialDate, holidayCalendar }) {
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
  const [step, setStep] = useState('time');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [welcomeName, setWelcomeName] = useState('');
  const welcomeDialog = useRef(null);
  const confirmationDialog = useRef(null);
  const draftRef = useRef([]),
    revisionRef = useRef(0),
    savingRef = useRef(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const timeDialog = useRef(null);
  const touch = useRef(null),
    tokenRef = useRef(''),
    dirtyRef = useRef(false),
    inflight = useRef(false);
  dirtyRef.current = dirty;
  const me = state.members.find((m) => m.id === state.me),
    ranks = rankSlots(
      state.members.map((m) =>
        m.id === state.me && dirty ? { ...m, responded: true, slots } : m,
      ),
      today || koreaToday(),
    ),
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
      Y('3초마다 자동 갱신');
      return data;
    } catch (e) {
      Y('연결 확인 필요');
      if (!quiet) E(e.message);
      return null;
    } finally {
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
        const saved = JSON.parse(localStorage.getItem('mm-demo') || 'null');
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
    setTimeOpen(true);
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
    S(next);
    localStorage.setItem('mm-demo', JSON.stringify(next));
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
      E('이미 사용 중인 닉네임이에요.');
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
    setSaveStatus('saving');
    void save();
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
    } catch (e) {
      setSaveStatus('error');
      E(e.message);
    } finally {
      savingRef.current = false;
    }
  }
  async function confirm() {
    if (!me || busy || dirtyRef.current || savingRef.current) return;
    const wasConfirmed = !!state.confirmed,
      slot = pick;
    if (!wasConfirmed && !ranks.some((r) => r.slot === slot)) {
      E('응답이 있는 후보를 선택해 주세요.');
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
      E('초대 링크를 복사했어요. 단체 채팅방에 붙여 넣어 주세요.');
    } catch {
      E('주소창의 링크를 복사해서 공유해 주세요.');
    }
  }
  async function placeAction(action, payload) {
    if (busy) return false;
    if (configured) return !!(await request(action, { payload }));
    demoSave(applyPlaceAction(state, action, payload, crypto.randomUUID()));
    return true;
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
  const selectedRanks = ranks.filter((r) => r.slot.startsWith(selected + '|'));
  const members = state.members.map((m) =>
    m.id === state.me ? { ...m, slots, responded: m.responded || dirty } : m,
  );
  const statusText =
    saveStatus === 'error'
      ? '저장 실패 · 다시 시도해 주세요'
      : dirty || saveStatus === 'saving'
        ? '저장 중…'
        : me?.responded
          ? '자동 저장 완료'
          : '시간을 선택하면 자동 저장';
  const recommendedDays = [],
    recommendedDates = new Set();
  for (const candidate of ranks) {
    const day = candidate.slot.slice(0, 10);
    if (!recommendedDates.has(day)) {
      recommendedDates.add(day);
      recommendedDays.push(candidate);
    }
    if (recommendedDays.length === 3) break;
  }
  const bestDay = state.confirmed
    ? null
    : recommendedDays[0]?.slot.slice(0, 10);
  const confirmedMembers = members.filter(
    (member) => member.responded && member.slots.includes(state.confirmed),
  );
  const confirmedPlace = state.places?.find(place => place.id === state.confirmedPlace);
  const showPlaces = step === 'place' && !!state.confirmed;
  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-icon">
            <Sparkles aria-hidden="true" />
          </span>{' '}
          Meet Soon<span className="tiny">언제 만날까?</span>
        </a>
        {/* <span className="header-note">
          <span /> A little closer, together.
        </span> */}
        <button className="outline-button topbar-share" onClick={share}>
          초대 링크 복사 <ArrowUpRight aria-hidden="true" />
        </button>
      </header>
      <main>
        <nav className="meeting-steps" aria-label="약속 정하기 단계">
          <button aria-current={!showPlaces ? 'step' : undefined} onClick={() => setStep('time')}><span>{state.confirmed ? '✓' : '1'}</span><strong>시간 정하기</strong><small>{state.confirmed ? '확정 완료' : '먼저 시간을 맞춰요'}</small></button>
          <ArrowRight aria-hidden="true" />
          <button aria-current={showPlaces ? 'step' : undefined} disabled={!state.confirmed} onClick={() => setStep('place')}><span>{confirmedPlace ? '✓' : '2'}</span><strong>장소 정하기</strong><small>{confirmedPlace ? '확정 완료' : state.confirmed ? '어디서 만날까요?' : '시간 확정 후 시작'}</small></button>
        </nav>
        <section className="hero">
          <div className="hero-text">
            <div className="eyebrow">
              GOOD TIMES
            </div>
            <h1>좋은 날, 우리, 로맨틱, 성공적</h1>
            <p>
              손은 가볍게
              <br />
              마음은 가깝게
            </p>
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
          </div>
          <div className="calendar-scene" aria-hidden="true">
            <div className="scene-orbit" />
            <div className="floating-note note-top">
              <span>
                <Users />
              </span>
              <div>
                그릇이 깨질만큼<small>떠들어요</small>
              </div>
              <Check />
            </div>
            <div className="mini-calendar">
              <div className="calendar-rings">
                <i />
                <i />
              </div>
              <div className="mini-heading">
                MAKE TIME FOR US
                <CalendarDays />
              </div>
              <strong>좋은 날, 함께.</strong>
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
              우리 만나는 날<Heart />
            </div>
          </div>
        </section>
        <div className="content">
          <div className="notice"></div>
          {state.confirmed ? (
            <section className="confirmed-hero" aria-labelledby="confirmed-heading">
              <div className="confirmed-hero-icon"><PartyPopper aria-hidden="true" /></div>
              <div className="confirmed-hero-content">
                <span className="eyebrow">IT’S A DATE!</span>
                <h2 id="confirmed-heading">우리 약속이 확정되었습니다</h2>
                <div className="confirmed-date">
                  <strong>{dateLabel(state.confirmed.split('|')[0])}</strong>
                  <time>{state.confirmed.split('|')[1]}</time>
                </div>
                <p className="confirmed-people"><Users aria-hidden="true" /> {confirmedMembers.length}명 가능</p>
                <ul className="confirmed-names">{confirmedMembers.map((member) => <li key={member.id}>{member.nickname}</li>)}</ul>
                {confirmedPlace && <div className="confirmed-place-summary"><strong>{confirmedPlace.name}</strong><span>{confirmedPlace.address}</span><a href={confirmedPlace.url} target="_blank" rel="noopener noreferrer">네이버 지도 보기 ↗</a></div>}
              </div>
              <button className="outline-button" onClick={() => { E(''); setConfirmOpen(true); }}>확정 내용 보기 <ArrowUpRight aria-hidden="true" /></button>
              <button className="outline-button" onClick={() => setStep('place')}>{confirmedPlace ? '장소 확인하기' : '이제 장소 정하기'} <ArrowRight aria-hidden="true" /></button>
            </section>
          ) : (
            <section className="recommend" aria-labelledby="recommend-title">
              <div className="recommend-heading">
                <div className="section-symbol"><CalendarCheck aria-hidden="true" /></div>
                <div>
                  <span className="eyebrow">OUR BEST DAYS</span>
                  <h2 id="recommend-title">함께 만나기 좋은 날짜</h2>
                  <p>가능한 친구가 많고, 가장 많이 겹치는 시간대로 추려봤어요</p>
                </div>
              </div>
              {recommendedDays.length ? (
                <div className="recommend-options">
                  {recommendedDays.map((r, i) => (
                    <div key={r.slot} className={'recommend-option ' + (i === 0 ? 'best ' : '') + (pick === r.slot ? 'selected' : '')}>
                      <button className="recommend-choice" onClick={() => F(r.slot)} aria-pressed={pick === r.slot}>
                        <span className="recommend-label">{i === 0 ? '가장 추천' : i + 1 + '번째 추천'}</span>
                        <strong>{dateLabel(r.slot.slice(0, 10))}</strong>
                        <time>{r.slot.split('|')[1]} <small>시작 · 30분</small></time>
                        <span className="recommend-people">
                          <Users aria-hidden="true" /><b>{r.count}명 가능</b><small>/ {memberCount}명</small>
                          {r.count === memberCount && <em>전원 가능</em>}
                        </span>
                        <span className="recommend-names">{members.filter((m) => m.responded && m.slots.includes(r.slot)).map((m) => m.nickname).join(', ')}</span>
                        <span className="recommend-link">
                          {pick === r.slot ? '선택한 시간' : '이 시간 선택'}
                          {pick === r.slot ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                        </span>
                      </button>
                      {pick === r.slot && (
                        <button className="confirm-action card-confirm" disabled={!me || busy || dirty} onClick={confirm}>
                          <CalendarCheck aria-hidden="true" />{busy ? '확정 중…' : '약속 확정'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="recommend-empty">아직 추천할 날짜가 없어요.<br /><span>달력에서 가능한 시간을 선택하면 여기에 모아드려요.</span></div>
              )}
            </section>
          )}
          {showPlaces && <PlacePlanner state={state} busy={busy} onAction={placeAction} />}
          <div className="layout" hidden={showPlaces}>
            <div className="main-column">
              <section className="card calendar">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">FIND YOUR DAY</span>
                    <h2>어느 날이 좋아요?</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      M(today.slice(0, 7));
                      D(today);
                    }}
                  >
                    TODAY
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
                      count = Math.max(
                        0,
                        ...ranks
                          .filter((r) => r.slot.startsWith(d + '|'))
                          .map((r) => r.count),
                      );
                    return (
                      <button
                        key={d}
                        disabled={d < today}
                        aria-label={`${d}${d === today ? ' 오늘' : ''}${d === bestDay ? ' 가장 추천하는 날짜' : ''}${holidays.length ? ' ' + holidays.join(', ') : ''}${mine ? ' 내가 선택한 날짜' : ''}${count ? ` 최대 ${count}명 가능` : ''}`}
                        aria-current={d === today ? 'date' : undefined}
                        title={holidays.join(' · ') || undefined}
                        aria-pressed={mine}
                        aria-haspopup="dialog"
                        onClick={() => openTime(d)}
                        className={`day ${selected === d ? 'selected' : ''} ${mine ? 'mine' : ''} ${d === today ? 'today' : ''} ${holidays.length ? 'holiday' : ''} ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''} ${d === bestDay ? 'recommended' : ''}`}
                      >
                        <span>{i + 1}</span>
                        <span className="day-caption">
                          {holidays.length
                            ? holidayLabel(holidays)
                            : d === today
                              ? '오늘'
                              : ''}
                        </span>
                        {count > 0 && count === memberCount ? (
                          <small>
                            <CalendarCheck aria-hidden="true" />
                          </small>
                        ) : count > 0 ? (
                          <small>{count}명</small>
                        ) : mine ? (
                          <small>
                            <Check aria-hidden="true" />
                          </small>
                        ) : (
                          <small />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="legend">
                  <span>
                    <i className="legend-today" />
                    오늘
                  </span>
                  <span>
                    <i className="legend-holiday" />
                    공휴일
                  </span>
                  <span>
                    <i className="legend-selected" />
                    내가 선택한 날짜
                  </span>
                  <span>
                    <CalendarCheck aria-hidden="true" /> 전원 가능한 시간 있음
                  </span>
                </div>
                {monthHolidays.length > 0 && (
                  <ul className="holiday-list" aria-label="이번 달 공휴일">
                    {monthHolidays.map(([date, names]) => (
                      <li key={date}>
                        <time dateTime={date}>{Number(date.slice(8))}일</time>
                        <span>{names.join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!yearHolidays ? (
                  <p className="subtext" role="status">
                    {yy}년 공휴일 자료는 아직 제공되지 않았어요.
                  </p>
                ) : (
                  holidayCalendar.fallback && (
                    <p className="subtext" role="status">
                      저장된 공휴일 자료를 표시 중이에요. 최신 변경사항은 연결
                      후 반영돼요.
                    </p>
                  )
                )}
              </section>
              <section className="card results">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">BETTER TOGETHER</span>
                    <h2>겹치는 시간 모아보기</h2>
                  </div>
                  <span className="tag">한눈에 보는 통계</span>
                </div>
                <p className="subtext">
                  가능 인원 ÷ 입장한 친구 {memberCount}명으로 표시해요. 각
                  후보는 30분이에요.
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
            <aside>
              <div className="group-overview">
                <span className="eyebrow">A LITTLE CLOSER</span>
                <h2>누가 누가 모였나</h2>
                <ParticipantOverview
                  members={state.members}
                  canIntroduce={ready && !!me && !welcomeName}
                />
                <div className="quote">
                  <span>
                    <Quote aria-hidden="true" />
                  </span>
                  함께할 시간을 고르는 일도,
                  <br />
                  이미 즐거운 약속의 시작.
                  <small>Merry moments begin here.</small>
                </div>
              </div>
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
                      다른 친구 초대
                      <small>체험 모드 · 친구 응답 추가하기</small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                )}
              </div>
            </aside>
          </div>
          <section className="card friends" aria-labelledby="friends-title" hidden={showPlaces}>
            <div className="card-heading">
              <div>
                <span className="eyebrow">OUR LITTLE GROUP</span>
                <h2 id="friends-title">친구들 응답 현황</h2>
              </div>
              <span className="response-summary">
                <strong>{responded}</strong> / {memberCount}명 투표 완료
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="친구 투표 진행률"
              aria-valuenow={responded}
              aria-valuemin={0}
              aria-valuemax={memberCount || 1}
            >
              <i style={{ width: responsePercent + '%' }} />
            </div>
            <div className="friend-list">
              {state.members.map((m) => {
                const seed = avatarSeed(m.id),
                  days = availableDays(m.slots, today);
                return (
                  <article className="friend" key={m.id}>
                    <span
                      className="avatar"
                      style={{
                        backgroundColor: [
                          'var(--red-tint)',
                          'var(--green-tint)',
                          'var(--surface-muted)',
                        ][seed % 3],
                        color: ['var(--wine)', 'var(--forest)', 'var(--brown)'][
                          seed % 3
                        ],
                      }}
                      aria-hidden="true"
                    >
                      {icons[seed % icons.length]}
                    </span>
                    <strong className="friend-name">
                      {m.nickname}
                      {m.id === state.me && (
                        <small className="me-badge">나</small>
                      )}
                    </strong>
                    <span className={'status ' + (m.responded ? 'done' : '')}>
                      {m.responded ? '투표 완료' : '아직 투표 전'}
                    </span>
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
                          '투표 시각 기록 없음'
                        )
                      ) : (
                        '가능한 시간을 골라 주세요'
                      )}
                    </span>
                    <div className="friend-availability">
                      <strong>가능한 요일 {days.weekdays.length}개</strong>
                      <span>
                        {days.weekdays.length
                          ? days.weekdays.join(' · ') +
                            ' · ' +
                            days.count +
                            '일 선택'
                          : '선택한 날짜 없음'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
            {!memberCount && (
              <p className="subtext">첫 번째 친구를 기다리고 있어요.</p>
            )}
          </section>
          <footer>
            <span className="footer-brand">Meet Soon</span>
            <p>우리 얼른 만나요</p>
            <small>MADE FOR OUR MERRY MOMENTS</small>
          </footer>
        </div>
      </main>
      <dialog
        ref={timeDialog}
        className="modal time-modal"
        aria-labelledby="time-modal-title"
        onCancel={() => setTimeOpen(false)}
        onClose={() => setTimeOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              setTimeOpen(false);
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
            onClick={() => setTimeOpen(false)}
          >
            <XIcon aria-hidden="true" />
          </button>
          <div className="card-heading">
            <div>
              <span className="eyebrow">SAVE A LITTLE TIME</span>
              <h2 id="time-modal-title">
                {selected ? dateLabel(selected) : '날짜를 선택해 주세요'}
              </h2>
            </div>
            <span className="tag">30분 단위</span>
          </div>
          <p className="subtext">
            가능한 시간을 모두 눌러 주세요. 한 칸은 30분이에요.
          </p>
          <div className="time-actions">
            <button
              disabled={!me || !!state.confirmed || selected < today}
              onClick={() =>
                changeSlots([
                  ...new Set([
                    ...draftRef.current,
                    ...TIMES.map((t) => selected + '|' + t),
                  ]),
                ])
              }
            >
              이 날 모두 선택
            </button>
            <button
              disabled={!me || !!state.confirmed || selected < today}
              onClick={() =>
                changeSlots(
                  draftRef.current.filter((s) => !s.startsWith(selected + '|')),
                )
              }
            >
              이 날 비우기
            </button>
          </div>
          <div className="time-grid">
            {TIMES.map((t) => {
              const slot = selected + '|' + t,
                count = selectedRanks.find((r) => r.slot === slot)?.count || 0;
              return (
                <button
                  disabled={!me || !!state.confirmed || selected < today}
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
                  ) : (
                    <small className="availability-hint">
                      {state.confirmed || selected < today
                        ? '선택 마감'
                        : '선택 가능'}
                    </small>
                  )}
                </button>
              );
            })}
          </div>
          {!me && (
            <p className="subtext">
              닉네임으로 입장하면 시간을 선택할 수 있어요.
            </p>
          )}
          <p className="subtext">
            이 날짜에 {slots.filter((s) => s.startsWith(selected + '|')).length}
            개 시간대 선택 · 선택하거나 해제하면 자동 저장돼요.
          </p>
          <p className={'save-status ' + saveStatus} role="status">
            {state.confirmed ? '약속 확정 · 수정 잠김' : statusText}
          </p>
          {saveStatus === 'error' && (
            <button className="outline-button" onClick={save}>
              저장 다시 시도
            </button>
          )}
          <button className="primary" onClick={() => setTimeOpen(false)}>
            선택 완료 · 다른 날짜 선택하기
          </button>
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
            <span className="eyebrow">GOOD TO SEE YOU</span>
            <h2 id="welcome-title">반가워 <span>{welcomeName}</span> !</h2>
            <p>우리, 좋은 날에 만나요.</p>
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
            <h2>
              반가워요!
              <br />
              어떤 이름으로 참여할까요?
            </h2>
            <label htmlFor="nickname">닉네임</label>
            <input
              id="nickname"
              autoFocus
              autoComplete="nickname"
              maxLength={12}
              value={nickname}
              onChange={(e) => N(e.target.value)}
              placeholder="예: 쏘맹"
              required
            />
            <button
              className="primary"
              disabled={busy || (configured && !room)}
            >
              {busy ? (
                '입장 중…'
              ) : (
                <>
                  참여하기 <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
            <p className="demo-warning">
              {configured
                ? room
                  ? '초대 링크를 가진 친구만 입장할 수 있어요.'
                  : '초대 링크에 ?room=초대코드가 필요해요.'
                : '체험 모드입니다. 실제 친구들과의 데이터 공유는 DB 연결 후 사용할 수 있어요.'}
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
            <h2 id="confirmation-title">확정되었습니다</h2>
            <div className="confirmation-date"><strong>{dateLabel(state.confirmed.split('|')[0])}</strong><time>{state.confirmed.split('|')[1]}</time></div>
            <div className="confirm-attendees">
              <strong>{confirmedMembers.length}명 가능</strong>
              <ul className="confirmed-names">{confirmedMembers.map((member) => <li key={member.id}>{member.nickname}</li>)}</ul>
            </div>
            {confirmedPlace && <div className="confirmed-place-summary"><strong>{confirmedPlace.name}</strong><span>{confirmedPlace.address}</span><a href={confirmedPlace.url} target="_blank" rel="noopener noreferrer">네이버 지도 보기 ↗</a></div>}
            {!confirmedPlace && <button className="text-button" onClick={() => { setConfirmOpen(false); setStep('place'); }}>이제 만날 장소를 정해볼까요? →</button>}
            {message && <p role="alert" className="form-error">{message}</p>}
            <div className="confirmation-buttons">
              <button className="primary" autoFocus onClick={() => setConfirmOpen(false)}>확인</button>
              <button className="outline-button" disabled={busy || dirty || !me} onClick={confirm}>{busy ? '취소 중…' : '확정 취소'}</button>
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
