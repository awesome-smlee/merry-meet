'use client';
import FadeUpWrapper from './fade-up-wrapper';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import MeetingSkeleton, { PlaceSkeleton, StatisticsSkeleton } from './skeleton';
import MemberIdentity from './member-identity';
import { roomInvitation } from '../lib/rooms.mjs';
import { applyPlaceAction } from '../lib/places.mjs';
import { holidayLabel } from '../lib/holidays.mjs';
import { applyEventAction, EVENT_ACTIONS } from '../lib/events.mjs';
import { applyDeadline, applyReschedule, responsesClosed, recordMeetingChange } from '../lib/meeting-updates.mjs';
import MeetingChanges from './meeting-changes';
import {
  ArrowUpRight,
  ArrowUp,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  MapPin,
  CalendarDays,
  House,
  CalendarPlus,
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
  validSlot,
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
const MeetingEvents = dynamic(() => import('./meeting-events'), { ssr: false });
export default function Meeting({ configured, initialDate, holidayCalendar, roomCode, invitationToken, roomName = '우리 모임', createdRooms = [], onCreateMeeting, onDeleteMeeting, onInitialEntryComplete, animateJoin = false }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [votingSlot, setVotingSlot] = useState(null);
  const [eventView, setEventView] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const updateScrollTop = () => setShowScrollTop(window.scrollY > 240);
    updateScrollTop();
    window.addEventListener('scroll', updateScrollTop, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollTop);
  }, []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const sharePending = useRef(false);
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
  const [initialReadError, setInitialReadError] = useState('');
  const [scheduleEdit, setScheduleEdit] = useState(null);
  const scheduleEditOpen = scheduleEdit !== null;
  const calendarSection = useRef(null);
  useEffect(() => {
    if (scheduleEditOpen) calendarSection.current?.focus();
  }, [scheduleEditOpen]);
  function openScheduleEdit() {
    if (!state.confirmed) return;
    const date = state.confirmed.split('|')[0];
    E('');
    setScheduleEdit({ expectedConfirmed: state.confirmed });
    F(state.confirmed);
    D(date < today ? today : date);
    M((date < today ? today : date).slice(0, 7));
    setStep('time');
  }
  async function saveScheduleEdit(slot = pick) {
    if (!me || busy || dirtyRef.current || savingRef.current || !scheduleEdit) return;
    const payload = { slot, expectedConfirmed: scheduleEdit.expectedConfirmed };
    try {
      if (configured) {
        if (!await request('reschedule', { payload })) return;
      } else demoSave(applyReschedule(state, payload));
      setTimeOpen(false);
      setScheduleEdit(null);
      F('');
      E('장소는 유지하고 일정을 변경했어요.');
    } catch (error) { E(error.message); }
  }
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
  const responseClosed = responsesClosed(state, new Date(now));
  useEffect(() => {
    if (!state.responseDeadline) return;
    const remaining = Date.parse(`${state.responseDeadline}T00:00:00+09:00`) + 86400000 - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 50, 2147483647));
    return () => clearTimeout(timer);
  }, [state.responseDeadline, now]);
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
      if (data.code === 'ROOM_DELETED') {
        window.location.replace('/');
        return null;
      }
      if (!res.ok) throw Object.assign(Error(data.error), { code: data.code });
      if (action === 'read' && (dirtyRef.current || savingRef.current))
        return data;
      S(data.state);
      if (action === 'join') {
        // The join response already contains the member state needed to render the room.
        setInitialReadComplete(true);
        setInitialReadError('');
      }
      if (action === 'read') setInitialReadError('');
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
      if (action === 'read') setInitialReadError(e.message);
      if (action === 'profile' || action === 'save' || action === 'deadline-set' || EVENT_ACTIONS.includes(action)) throw e;
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
    const r = roomCode;
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
  }, [configured, roomCode]);
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
    if (scheduleEditOpen) F('');
    setTimeCounts(rankSlots(state.members, today || koreaToday()));
    setTimeOpen(true);
  }
  function closeTime() {
    if (savingRef.current || (scheduleEditOpen && busy)) return;
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
    const timer = setTimeout(() => { setWelcomeName(''); onInitialEntryComplete?.(); }, 2000);
    return () => {
      clearTimeout(timer);
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [welcomeName, onInitialEntryComplete]);
  function demoSave(next) {
    next = recordMeetingChange(latestState.current, next, crypto.randomUUID());
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
      let ownerToken;
      try { ownerToken = localStorage.getItem('mm-owner:server:' + room) || undefined; } catch {}
      const result = await request('join', { nickname, ownerToken });
      const joined = result?.state.members.find(
        (member) => member.id === result.state.me,
      );
      if (joined) {
        E('');
        setWelcomeName(joined.nickname);
      }
      return;
    }
    const returningMember = state.members.find(
      (m) => m.nickname.toLowerCase() === nickname.trim().toLowerCase(),
    );
    if (returningMember) {
      demoSave({ ...state, me: returningMember.id });
      draftRef.current = returningMember.slots || [];
      V(draftRef.current);
      setSaveStatus('saved');
      E('');
      setWelcomeName(returningMember.nickname);
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
    if (!me || (state.confirmed && !scheduleEditOpen)) return;
    if (responsesClosed(latestState.current)) { setNow(Date.now()); E('응답이 마감되어 시간을 수정할 수 없어요.'); return; }
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
    if (savingRef.current || !me || (state.confirmed && !scheduleEditOpen)) return;
    let refreshAfterDeadline = false;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      do {
        if (scheduleEditOpen && latestState.current.confirmed !== scheduleEdit.expectedConfirmed) throw Error('일정이 변경되었어요. 다시 확인해 주세요.');
        if (responsesClosed(latestState.current)) throw Object.assign(Error('응답이 마감되어 시간을 수정할 수 없어요.'), { code: 'RESPONSE_CLOSED' });
        const revision = revisionRef.current,
          snapshot = [...draftRef.current];
        if (configured) {
          const result = await request('save', { slots: snapshot, ...(scheduleEditOpen ? { slot: scheduleEdit.expectedConfirmed } : {}) }, true);
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
      if (e.code === 'RESPONSE_CLOSED') {
        const saved = latestState.current.members.find(member => member.id === latestState.current.me)?.slots || [];
        draftRef.current = saved;
        V(saved);
        dirtyRef.current = false;
        U(false);
        setNow(Date.now());
        setSaveStatus('saved');
        refreshAfterDeadline = configured;
      } else setSaveStatus('error');
      E(e.message);
      return false;
    } finally {
      savingRef.current = false;
      if (refreshAfterDeadline) void request('read');
    }
  }
  async function voteForCandidate(slot) {
    if (!me || busy || savingRef.current || (state.confirmed && !scheduleEditOpen)) return;
    if (me.responded && me.slots.includes(slot)) return;
    if (responsesClosed(latestState.current)) {
      setNow(Date.now());
      E('응답이 마감되어 시간을 수정할 수 없어요.');
      return;
    }
    if (!validSlot(slot, today)) return;
    E('');
    setVotingSlot(slot);
    try {
      changeSlots([...new Set([...draftRef.current, slot])]);
      if (await save()) E('투표했어요. 후보와 참여 인원이 다시 집계됐어요.');
    } finally {
      setVotingSlot(null);
    }
  }
  async function confirm(candidateSlot) {
    if (scheduleEditOpen && typeof candidateSlot === 'string') return saveScheduleEdit(candidateSlot);
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
  async function share(copyOnly = false) {
    if (sharePending.current) return;
    sharePending.current = true;
    setSharing(true);
    setInviteMessage('');
    try {
      const invitation = roomInvitation(location.href, room, roomName, invitationToken);
      if (!copyOnly && navigator.share) {
        await navigator.share(invitation);
      } else {
        await navigator.clipboard.writeText(`${invitation.text}\n${invitation.url}`);
        setInviteMessage('초대 링크와 모임코드를 복사했어요. 친구에게 보내 주세요.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setInviteMessage('공유하지 못했어요. 링크·코드 복사를 다시 시도해 주세요.');
    } finally {
      sharePending.current = false;
      setSharing(false);
    }
  }
  async function placeAction(action, payload) {
    if (busy) return false;
    if (configured) return !!(await request(action, { payload }));
    demoSave(applyPlaceAction(latestState.current, action, payload, crypto.randomUUID()));
    return true;
  }
  async function openPlaceEdit() {
    if (!me || !latestState.current.confirmedPlace || busy || dirtyRef.current || savingRef.current) return;
    E('');
    try {
      if (state.confirmedPlace && !await placeAction('place-unconfirm', {})) return;
      setScheduleEdit(null);
      F('');
      setStep('place');
      E('일정은 유지하고 장소를 다시 선택할 수 있어요.');
    } catch (error) { E(error.message); }
  }
  async function eventAction(action, payload) {
    if (configured) await request(action, { payload });
    else demoSave(applyEventAction(latestState.current, action, payload, crypto.randomUUID()));
    if (action !== 'event-delete') M(payload.date.slice(0, 7));
  }
  async function saveDeadline(payload) {
    if (configured) await request('deadline-set', { payload });
    else demoSave(applyDeadline(latestState.current, payload));
    setNow(Date.now());
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
  const bestDay = state.confirmed && !scheduleEditOpen
    ? null
    : recommendedDays[0]?.slot.slice(0, 10);
  const confirmedMembers = members.filter(
    (member) => member.responded && member.slots.includes(state.confirmed),
  );
  const confirmedPlace = state.places?.find(place => place.id === state.confirmedPlace);
  const showPlaces = step === 'place' && !!state.confirmed && !scheduleEditOpen;
  if (!ready || (configured && token && !initialReadComplete)) return <MeetingSkeleton />;
  if (configured && token && !me) return <main className="entry-page">
    <a className="brand entry-brand" href={`?room=${encodeURIComponent(room)}`}>Meet Soon</a>
    <section className="entry-card" aria-labelledby="returning-member-title">
      <h1 id="returning-member-title">참여 정보를 불러오지 못했어요</h1>
      <p className="entry-description">기존 참여 정보로 다시 연결할게요. 잠시 후 다시 시도해 주세요.</p>
      {initialReadError && <p className="form-error" role="alert">{initialReadError}</p>}
      <button type="button" className="primary" disabled={busy} onClick={() => request('read')}>{busy ? '불러오는 중…' : '다시 시도'}</button>
    </section>
  </main>;
  return (
    <>
      <header className="topbar">
        <div className="topbar-heading">
        <a href={`?room=${encodeURIComponent(room)}`} className="brand">
          Meet Soon
        </a>
        <span className="topbar-divider" aria-hidden="true" />
        <h1 className="topbar-room-name" title={roomName}><House aria-hidden="true" /><span>{roomName}</span></h1>
        </div>
        {/* <span className="header-note">
          <span /> A little closer, together.
        </span> */}
        <div className="topbar-actions">
        <button type="button" className="outline-button topbar-create" onClick={onCreateMeeting}>
          모임 만들기 <CalendarPlus aria-hidden="true" />
        </button>
        <button className="outline-button topbar-share" onClick={() => { setInviteMessage(''); setInviteOpen(true); }}>
          친구 초대 <UserPlus aria-hidden="true" />
        </button>
        {me && <button type="button" className="topbar-profile" aria-label={`${me.nickname}, 내 정보 수정`} aria-haspopup="dialog" disabled={busy || dirty || saveStatus === 'saving'} onClick={() => setProfileOpen(true)}><MemberIdentity member={me} /></button>}
        </div>
      </header>
      {profileOpen && me && <ProfileEditor member={me} createdRooms={createdRooms} currentRoom={room} onSave={saveProfile} onClose={() => setProfileOpen(false)} />}
      {eventView && me && <MeetingEvents state={state} initialDate={eventView.date} initialMode={eventView.mode} onAction={eventAction} onClose={() => setEventView(null)} />}
      <dialog ref={inviteDialog} className="modal" aria-labelledby="invite-title" onCancel={() => setInviteOpen(false)}>
        <button type="button" className="close" aria-label="친구 초대 닫기" onClick={() => setInviteOpen(false)}><XIcon aria-hidden="true" /></button>
        {inviteOpen && <div className="invite-modal">
          <h2 id="invite-title">{roomName}에 초대하기</h2>
          <p>링크와 모임코드를 공유해 친구를 초대하세요.</p>
          <button type="button" className="primary" autoFocus disabled={sharing} onClick={() => share()}>초대 공유</button>
          <button type="button" className="outline-button invite-copy" disabled={sharing} onClick={() => share(true)}>링크·코드 복사 <Copy aria-hidden="true" /></button>
          {inviteMessage && <p role="status">{inviteMessage}</p>}
        </div>}
      </dialog>
      {state.confirmed && <FadeUpWrapper as="section" className="confirmed-focus" aria-labelledby="confirmed-focus-title">
        <div className="confirmed-focus-details">
          <h2 id="confirmed-focus-title" className="confirmed-focus-label"><CalendarCheck aria-hidden="true" /> {confirmedPlace ? '최종 확정' : '일정 확정'}</h2>
          <dl className="confirmed-focus-summary">
            <div><dt>일정</dt><dd>{dateLabel(state.confirmed.split('|')[0])} · {state.confirmed.split('|')[1]}</dd></div>
            <div><dt>장소</dt><dd>{confirmedPlace ? <>{confirmedPlace.region && <>{confirmedPlace.region} · </>}{confirmedPlace.name}</> : '미정'}</dd></div>
          </dl>
          {confirmedPlace ? (
            <ul className="confirmed-focus-members" aria-label="참여 가능한 참여자">
              {confirmedMembers.map((member) => <li key={member.id}><MemberIdentity member={member} /></li>)}
            </ul>
          ) : <p>{confirmedMembers.length}명 참여 예정 / 이제 만날 장소를 정해보세요.</p>}
        </div>
        {me && <div className="confirmed-focus-actions">
          <button type="button" className="outline-button" disabled={busy || dirty || saveStatus === 'saving'} onClick={() => { if (scheduleEditOpen) { setScheduleEdit(null); F(''); } else openScheduleEdit(); }}>{scheduleEditOpen ? '변경 취소' : '일정 변경'}</button>
          <button type="button" className="outline-button" disabled={!confirmedPlace || busy || dirty || saveStatus === 'saving'} onClick={openPlaceEdit}>장소 변경</button>
        </div>}
      </FadeUpWrapper>}
      <main className={showPlaces ? 'place-workspace' : 'time-workspace'}>
        <nav className="meeting-steps" aria-label="약속 정하기 단계">
          <button aria-current={!showPlaces ? 'step' : undefined} onClick={() => setStep('time')}><span>{state.confirmed && !scheduleEditOpen ? '✓' : '1'}</span><strong>날짜/시간 정하기</strong><small>{scheduleEditOpen ? '일정 변경 중' : state.confirmed ? '확정 완료' : '가능한 시간 선택'}</small></button>
          <button aria-current={showPlaces ? 'step' : undefined} disabled={!state.confirmed || scheduleEditOpen} onClick={() => setStep('place')}><span>{confirmedPlace ? '✓' : '2'}</span><strong>장소 정하기</strong><small>{confirmedPlace ? '확정 완료' : state.confirmed ? '장소 선택 및 투표' : '시간 확정 후 가능'}</small></button>
        </nav>
        {me && <>
          <MeetingChanges key={`${room}:${state.me}`} changes={state.changes} storageKey={`mm-changes-seen:v1:${configured ? 'server' : 'demo'}:${room}:${state.me}`} />
        </>}
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
        
          <div className={`schedule-dashboard${state.confirmed && !scheduleEditOpen ? ' is-confirmed' : ''}`} hidden={showPlaces}>
          {(!state.confirmed || scheduleEditOpen) && (
            <FadeUpWrapper as="section" className="recommend" aria-labelledby="recommend-title">
              <div className="recommend-heading">
                <div className="section-symbol"><CalendarCheck aria-hidden="true" /></div>
                <div>
                  <h2 id="recommend-title">확정 일정 후보</h2>
                  <p>날짜별로 가장 많은 인원이 가능한 시간을 추천해요.</p>
                  <p className="confirm-speech">약속 확정은 한 명이 마지막에 해주세요!</p>
                </div>
              </div>
              {recommendedDays.length > 0 && recommendedDays.length <= 3 ? (
                <div className="recommend-shortlist">{recommendedDays.map(r => <div className="recommend-short-row recommend-option" key={r.slot} tabIndex={0}>
                  <div className="recommend-details">
                    <strong>{dateLabel(r.slot.slice(0, 10))} · {r.slot.split('|')[1]}</strong>
                    <span className="recommend-attendees"><span>{r.count}명 가능 |</span>{members.filter((m) => m.responded && m.slots.includes(r.slot)).map((m) => <MemberIdentity key={m.id} member={m} />)}</span>
                  </div>
                  <div className="recommend-actions">
                    <button type="button" className="candidate-vote" disabled={!me || busy || responseClosed || saveStatus === 'saving' || (me.responded && me.slots.includes(r.slot))} onClick={() => voteForCandidate(r.slot)}>
                      {votingSlot === r.slot ? '투표 중…' : me?.responded && me.slots.includes(r.slot) ? '투표 완료' : '투표하기'}
                    </button>
                    <button type="button" className="confirm-action card-confirm" disabled={!me || busy || dirty || saveStatus === 'saving'} onClick={() => confirm(r.slot)}>
                      {busy ? '확정 중…' : '약속 확정'}<CalendarCheck aria-hidden="true" />
                    </button>
                  </div>
                </div>)}</div>
              ) : recommendedDays.length ? (
                <div className="recommend-grid">
                  {recommendedDays.map((r, i) => (
                    <div key={r.slot} className={'recommend-option ' + (i === 0 ? 'best ' : '') + (pick === r.slot ? 'selected' : '')}>
                      <button className="recommend-choice" onClick={() => F(r.slot)} aria-pressed={pick === r.slot}>
                        <strong>{dateLabel(r.slot.slice(0, 10))} {r.slot.split('|')[1]}</strong>
                        <span className="recommend-attendees"><span>{r.count}명 가능 |</span>{members.filter((m) => m.responded && m.slots.includes(r.slot)).map((m) => <MemberIdentity key={m.id} member={m} />)}</span>
                        <span className="recommend-link">
                          {pick === r.slot ? <Check aria-hidden="true" /> : null}
                        </span>
                      </button>
                      <div className="recommend-actions">
                        <button type="button" className="candidate-vote" disabled={!me || busy || responseClosed || saveStatus === 'saving' || (me.responded && me.slots.includes(r.slot))} onClick={() => voteForCandidate(r.slot)}>
                          {votingSlot === r.slot ? '투표 중…' : me?.responded && me.slots.includes(r.slot) ? '투표 완료' : '투표하기'}
                        </button>
                        <button type="button" className="confirm-action card-confirm" disabled={!me || busy || dirty || saveStatus === 'saving'} onClick={() => confirm(r.slot)}>
                          {busy ? '확정 중…' : '약속 확정'}<CalendarCheck aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="recommend-empty">아직 추천할 일정이 없어요.<br /><span>달력에서 가능한 시간을 선택하면 추천 일정을 확인할 수 있어요.</span></div>
              )}
            </FadeUpWrapper>
          )}
          <FadeUpWrapper as="section" className="card friends" aria-labelledby="friends-title" hidden={showPlaces}>
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
                const dates = [...new Set(m.slots.filter((slot) => validSlot(slot, today)).map((slot) => slot.slice(0, 10)))].sort();
                return (
                  <article className="friend" key={m.id}>
                    <strong className="friend-name">
                      <MemberIdentity member={m}>
                      {m.id === state.me && (
                        <small className="me-badge">나</small>
                      )}
                      </MemberIdentity>
                    </strong>
                    
                    <span className={`vote-age${!m.responded || !m.votedAt ? ' empty-state-text' : ''}`}>
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
                        <span role="img" aria-label="아직 응답하지 않았어요" title="아직 응답하지 않았어요">😴</span>
                      )}
                    </span>
                    <div className="friend-availability">
                      <strong>가능한 일정</strong>
                      <span className={!dates.length ? 'empty-state-text' : undefined}>
                        {dates.length
                          ? dates.map((date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} (${new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T00:00:00+09:00`))})`).join(', ')
                          : '선택한 날짜 없음'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
            {!memberCount && (
              <p className="subtext empty-state-text">아직 참여자가 없어요. 초대 링크를 공유해 주세요.</p>
            )}
          </FadeUpWrapper>
            <div className="schedule-calendar">
              <div className="calendar-disclosure">
                {state.confirmed && <div className="calendar-edit-notice"><p>{scheduleEditOpen ? '기존에 선택한 일정과 참여 가능 인원을 확인하고, 달력에서 새 날짜/시간을 선택해 주세요. 장소는 그대로 유지돼요.' : '확정된 장소를 유지하면서 날짜와 시간만 바꿀 수 있어요.'}</p><button type="button" className="outline-button" disabled={!me || busy || dirty} onClick={() => { if (scheduleEditOpen) { setScheduleEdit(null); F(''); } else openScheduleEdit(); }}>{scheduleEditOpen ? '변경 취소' : '일정 변경'}</button></div>}
              <FadeUpWrapper as="section" className="card calendar" ref={calendarSection} tabIndex={-1}>
                <div className="card-heading">
                  <div>
                    <h2>언제가 좋아요?</h2>
                  </div>
                  <div className="calendar-heading-actions">
                  <button type="button" className="outline-button calendar-add-event" disabled={!me || busy || dirty || saveStatus === 'saving'} onClick={() => setEventView({ date: selected < today ? today : selected, mode: 'create' })}>이벤트 추가 <CalendarPlus aria-hidden="true" /></button>
                  <button
                    className="text-button calendar-today-button"
                    onClick={() => {
                      M(today.slice(0, 7));
                      D(today);
                    }}
                  >
                    오늘로 이동
                  </button>
                  </div>
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
                      dayMembers = members.filter((member) =>
                        member.slots.some((slot) => slot.startsWith(d + '|')),
                      ),
                      count = dayMembers.length;
                    const dayTooltip = [
                      holidays.join(' · '),
                      count ? `선택한 참여자 (${count}명): ${dayMembers.map(member => member.nickname).join(', ')}` : '아직 선택한 참여자가 없어요.',
                    ].filter(Boolean).join('\n');
                    const dayEvents = (state.events || []).filter(event => event.date === d);
                    return (
                      <div className="calendar-day-cell" key={d} title={dayTooltip}>
                      <button
                        disabled={d < today}
                        aria-label={`${d}${d === today ? ' 오늘' : ''}${state.confirmed?.startsWith(d + '|') ? ' 확정' : ''}${d === bestDay ? ' 추천 1순위 날짜' : ''}${holidays.length ? ' ' + holidays.join(', ') : ''}${mine ? ' 내가 선택한 날짜' : ''} ${count}명 선택`}
                        aria-current={d === today ? 'date' : undefined}
                        title={dayTooltip}
                        aria-pressed={mine}
                        aria-haspopup="dialog"
                        onClick={() => openTime(d)}
                        className={`day ${mine ? 'mine' : ''} ${d === today ? 'today' : ''} ${holidays.length ? 'holiday' : ''} ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''} ${d === bestDay ? 'recommended' : ''} ${state.confirmed?.startsWith(d + '|') ? 'is-confirmed' : ''}`}
                      >
                        <span className="day-heading">
                          <span>{i + 1}</span>
                          {holidays.length > 0 && (
                            <span className="day-caption">{holidayLabel(holidays)}</span>
                          )}
                        </span>
                        {d === today && <span className="day-today">오늘</span>}
                        {state.confirmed?.startsWith(d + '|') && <span className="day-confirmed"><Check aria-hidden="true" /> 확정</span>}
                        {count > 0 && <small>{count}명 선택</small>}
                      </button>
                      {dayEvents.length > 0 && <button type="button" className="calendar-event-preview" disabled={!me || busy || dirty || saveStatus === 'saving'} aria-label={`${d} 이벤트 ${dayEvents.length}개: ${dayEvents[0].title}`} onClick={() => setEventView({ date: d, mode: 'list' })}>
                        <span>{dayEvents[0].title}</span>
                        {dayEvents.length > 1 && <small>+{dayEvents.length - 1}개</small>}
                      </button>}
                      </div>
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
              </FadeUpWrapper>
              </div>
            </div>
            {(!state.confirmed || scheduleEditOpen) && <div className="schedule-statistics">
              {(!state.confirmed || scheduleEditOpen) && <>
              <FadeUpWrapper as="section" className="card results">
                <div className="card-heading">
                  <div>
                    <h2>많이 겹치는 시간</h2>
                  </div>
                  <span className="tag">응답 통계</span>
                </div>
          
                {!showPlaces && <OverlapStatistics
                  ranks={ranks}
                  members={members}
                  onOpenDay={(day) => {
                    openTime(day);
                    M(day.slice(0, 7));
                  }}
                />}
              </FadeUpWrapper>
              </>}
            </div>}
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
                    <span>
                      체험 참여자 추가
                      <small>이 기기에서 다른 참여자의 응답을 추가해요</small>
                    </span>
                    <UserPlus aria-hidden="true" />
                  </button>
                )}
              </div>
            </aside>}
          </div>
          {showPlaces && <PlacePlanner key={`${room}:${state.me}:${state.resetVersion || ''}`} storageKey={`mm-place-drafts:${configured ? room : 'demo'}:${state.me}:${state.resetVersion || ''}`} state={state} busy={busy} onAction={placeAction} />}
          {me && <div className="meeting-reset-area"><button type="button" className="meeting-reset-button" disabled={busy || saveStatus === 'saving'} onClick={() => setResetOpen(true)}>일정·장소 초기화</button></div>}
          <footer>
            <span className="footer-brand">Meet Soon</span>
            <p className="footer-copyright">© Sso's</p>
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
            {responseClosed ? '응답이 마감되어 시간을 수정할 수 없어요.' : scheduleEditOpen ? '가능한 시간을 모두 선택한 뒤 저장해 주세요. 상단 추천 날짜와 시간에 반영돼요.' : '참여 가능한 시간을 선택한 뒤 저장해 주세요.'}
          </p>
          <div className="time-actions">
            <button
              disabled={!me || responseClosed || (!!state.confirmed && !scheduleEditOpen) || selected < today || saveStatus === 'saving'}
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
              disabled={!me || responseClosed || (!!state.confirmed && !scheduleEditOpen) || selected < today || saveStatus === 'saving'}
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
                  disabled={!me || busy || selected < today || saveStatus === 'saving' || (responseClosed || (!!state.confirmed && !scheduleEditOpen))}
                  key={t}
                  aria-pressed={slots.includes(slot)}
                  className={slots.includes(slot) ? 'chosen' : ''}
                  onClick={() => toggle(slot)}
                >
                  <span>{t}</span>
                  {count > 0 ? (
                    <small className="availability-badge has-people">
                      {count}명 가능
                      <Users aria-hidden="true" />
                    </small>
                  ) : !scheduleEditOpen && (responseClosed || state.confirmed || selected < today) ? (
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
          {((state.confirmed && !scheduleEditOpen) || statusText) && (
            <p className={'save-status ' + saveStatus} role="status">
              {state.confirmed && !scheduleEditOpen ? '약속이 확정되어 시간을 수정할 수 없어요' : statusText}
            </p>
          )}
          {!responseClosed && (!state.confirmed || scheduleEditOpen) && me && selected >= today ? (
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
          <form className={`modal join-modal${animateJoin ? ' join-modal-enter' : ''}`} onSubmit={join}>
            <span className="modal-emoji">
              <CalendarDays aria-hidden="true" />
            </span>
            <div className="script">Meet Soon</div>
            <h2>닉네임을 입력해주세요</h2>
            <label htmlFor="nickname">닉네임</label>
            <p>전에 참여했다면 같은 닉네임으로 이어서 입장할 수 있어요.</p>
            <input
              id="nickname"
              data-filled={!!nickname.trim()}
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
                  참여하기
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
              {!confirmedPlace && <button className="primary confirmation-place-action" autoFocus onClick={() => { setConfirmOpen(false); setStep('place'); }}>장소 정하기</button>}
              <button className={confirmedPlace ? 'primary' : 'outline-button'} autoFocus={!!confirmedPlace} onClick={() => setConfirmOpen(false)}>확인</button>
              <button className="cancel-button confirmation-cancel" disabled={busy || dirty || !me} onClick={confirm}>{busy ? '취소 중…' : '확정 취소'}</button>
            </div>
          </>
        )}
      </dialog>
      {showScrollTop && me && <button type="button" className="scroll-to-top" aria-label="맨 위로 이동" title="맨 위로 이동" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ArrowUp aria-hidden="true" /></button>}
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
