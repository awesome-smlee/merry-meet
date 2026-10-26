'use client';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, KeyRound, ArrowLeft } from 'lucide-react';
import Meeting from './meeting';
import MeetingSkeleton from './skeleton';
import { parseRoomCode, roomName, parseCreatedRooms, invitationCode } from '../lib/rooms.mjs';

class FirstEntryBoundary extends Component {
  state = { failed: false, message: '화면을 복구하는 중이에요.' };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { void this.recover(); }
  recover = async () => {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const message = await this.props.onFailure();
      if (message) this.setState({ message });
    }
    catch { this.setState({ message: '방 정리를 완료하지 못했어요. 다시 시도해 주세요.' }); }
    finally { this.recovering = false; }
  };
  render() {
    if (this.state.failed) return <main className="entry-page"><section className="entry-card" role="alert"><p>{this.state.message}</p><button onClick={this.recover}>다시 시도</button><a href="/">처음으로</a></section></main>;
    return this.props.children;
  }
}

export default function MeetingEntry(props) {
  const [screen, setScreen] = useState('home');
  const [initializing, setInitializing] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState(null);
  const [createdRooms, setCreatedRooms] = useState([]);
  const createdRoomsKey = `mm-created-rooms:v1:${props.configured ? 'server' : 'demo'}`;
  const activeRoomKey = `mm-active-room:${props.configured ? 'server' : 'demo'}`;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [invitedRoom, setInvitedRoom] = useState('');
  const [animateJoin, setAnimateJoin] = useState(false);
  const entryPage = useRef(null);
  const pending = useRef(false);
  const firstCreation = useRef(null);
  const completeFirstEntry = useCallback(() => {
    const creation = firstCreation.current;
    if (!creation) return;
    // Once the initial welcome succeeds, later errors must never delete this room.
    firstCreation.current = null;
    if (props.configured) {
      void fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete-create', code: creation.room, ownerToken: creation.ownerToken }) }).catch(() => {});
    }
  }, [props.configured]);
  async function recoverFirstEntry() {
    const creation = firstCreation.current;
    if (!creation) return '화면에 오류가 발생했어요. 기존 모임은 유지됩니다. 새로고침해 주세요.';
    let completed = true;
    if (props.configured) {
      let token;
      try { token = localStorage.getItem('mm-token:' + creation.room); } catch {}
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'abort-create', code: creation.room, ownerToken: creation.ownerToken, token }) });
      if (!response.ok) throw Error('방 정리 실패');
      completed = (await response.json()).completed;
    }
    if (completed) {
      const next = createdRooms.filter(item => item.room !== creation.room);
      setCreatedRooms(next);
      try {
        localStorage.setItem(createdRoomsKey, JSON.stringify(next));
        for (const key of [ownerKey(creation.room), 'mm-token:' + creation.room, 'mm-demo:' + creation.room, 'mm-room:' + creation.room]) localStorage.removeItem(key);
      } catch {}
    }
    firstCreation.current = null;
    const url = new URL(location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('meeting');
    url.searchParams.delete('join');
    try { sessionStorage.removeItem(activeRoomKey); } catch {}
    history.replaceState(null, '', url);
    setSelected(null);
    setScreen('create');
    setMessage(completed ? '첫 입장에 실패하여 방 생성을 취소했어요. 다시 만들어 주세요.' : '방은 삭제하지 않았어요. 다른 참여자가 있거나 이미 생성이 완료된 모임이에요.');
  }
  const ownerKey = code => `mm-owner:${props.configured ? 'server' : 'demo'}:${code}`;
  const deletionPrefix = props.configured ? 'mm-deleted-server-room:' : 'mm-deleted-room:';
  function readCreatedRooms() {
    return parseCreatedRooms(localStorage.getItem(createdRoomsKey)).map(room => ({ ...room, canDelete: !!localStorage.getItem(ownerKey(room.room)) }));
  }

  async function deleteMeeting(code) {
    const ownerToken = localStorage.getItem(ownerKey(code));
    if (!ownerToken) throw Error('새로 만든 모임만 생성한 기기에서 삭제할 수 있어요.');
    if (props.configured) {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', code, ownerToken }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      try { localStorage.setItem(deletionPrefix + code, JSON.stringify({ deleteAfter: data.deleteAfter })); } catch {}
    } else {
      localStorage.setItem('mm-deleted-room:' + code, JSON.stringify({ deleteAfter: new Date(Date.now() + 10 * 86400000).toISOString() }));
    }
    const next = createdRooms.filter(room => room.room !== code);
    setCreatedRooms(next);
    try { localStorage.setItem(createdRoomsKey, JSON.stringify(next)); } catch {}
    if (selected?.room === code) {
      const url = new URL(location.href);
      url.searchParams.delete('room');
      url.searchParams.delete('invite');
      url.searchParams.delete('meeting');
      url.searchParams.delete('join');
      try { sessionStorage.removeItem(activeRoomKey); } catch {}
      history.replaceState(null, '', url);
      setSelected(null);
      setScreen('home');
      setMessage('모임 삭제를 요청했어요. 데이터는 10일 후 삭제돼요.');
    }
  }

  async function enter(action, value) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (action === 'lookup') value = invitationCode(value, invitedRoom);
      let room;
      if (props.configured) {
        const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'create' ? { action, name: value } : { action, code: value }) });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        room = data;
      } else if (action === 'create') {
        const bytes = crypto.getRandomValues(new Uint8Array(5));
        const code = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').slice(0, 6);
        room = { room: code, name: roomName(value), ownerToken: crypto.randomUUID() };
        localStorage.setItem('mm-room:' + room.room, JSON.stringify({ room: code, name: room.name }));
      } else {
        const parsed = parseRoomCode(value);
        if (parsed && localStorage.getItem('mm-deleted-room:' + parsed)) throw Error('삭제 요청된 모임이에요.');
        room = parsed && JSON.parse(localStorage.getItem('mm-room:' + parsed) || 'null');
        if (!room) throw Error('해당 모임을 찾을 수 없어요.');
      }
      if (action === 'create') {
        firstCreation.current = room;
        let canDelete = false;
        try { localStorage.setItem(ownerKey(room.room), room.ownerToken); canDelete = true; } catch {}
        let previous = createdRooms;
        try { previous = readCreatedRooms(); } catch {}
        const next = [{ room: room.room, name: room.name, canDelete }, ...previous.filter(item => item.room !== room.room)];
        setCreatedRooms(next);
        try { localStorage.setItem(createdRoomsKey, JSON.stringify(next)); } catch {}
      }
      const url = new URL(location.href);
      url.searchParams.delete('invite');
      url.searchParams.delete('room');
      url.searchParams.delete('join');
      url.searchParams.set('meeting', '1');
      try { sessionStorage.setItem(activeRoomKey, room.room); } catch {}
      history.replaceState(null, '', url);
      if (action === 'create' && entryPage.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const page = entryPage.current;
        page.inert = true;
        const animation = page.animate(
          [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-35vh)', opacity: 0 }],
          { duration: 320, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
        );
        await animation.finished.catch(() => {});
      }
      setAnimateJoin(action === 'create');
      if (action !== 'create') firstCreation.current = null;
      setSelected(room);
    } catch (error) {
      setMessage(error.message);
      setScreen(action === 'create' ? 'create' : 'join');
    } finally {
      pending.current = false;
      setBusy(false);
      setInitializing(false);
    }
  }
  useEffect(() => {
    try {
        for (const key of Object.keys(localStorage).filter(key => key.startsWith(deletionPrefix))) {
          const deletion = JSON.parse(localStorage.getItem(key));
          const due = Date.parse(deletion?.deleteAfter);
          if (!Number.isFinite(due) || due > Date.now()) continue;
          const code = key.slice(deletionPrefix.length);
          if (props.configured) {
            for (const storedKey of Object.keys(localStorage).filter(key => key.startsWith(`mm-place-drafts:${code}:`) || key.startsWith(`mm-changes-seen:v1:server:${code}:`))) localStorage.removeItem(storedKey);
            localStorage.removeItem('mm-token:' + code);
          } else {
            const saved = JSON.parse(localStorage.getItem('mm-demo:' + code) || 'null');
            for (const member of saved?.members || []) {
              for (const draftKey of Object.keys(localStorage).filter(key => key.startsWith(`mm-place-drafts:demo:${member.id}:`) || key.startsWith(`mm-changes-seen:v1:demo:${code}:`))) localStorage.removeItem(draftKey);
            }
            localStorage.removeItem('mm-demo:' + code);
            localStorage.removeItem('mm-room:' + code);
          }
          localStorage.removeItem(ownerKey(code));
        }
      setCreatedRooms(readCreatedRooms().filter(room => !localStorage.getItem(deletionPrefix + room.room)));
    } catch {}
    if (process.env.NODE_ENV === 'development' && !props.configured) {
      const testRoom = { room: 'TEST2026', name: '코드 참여 테스트 모임' };
      localStorage.setItem('mm-room:' + testRoom.room, JSON.stringify(testRoom));
    }
    const params = new URLSearchParams(location.search);
    // Remove legacy room codes from the visible URL before doing any lookup.
    if (params.has('invite') || params.has('room')) {
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete('invite');
      cleanUrl.searchParams.delete('room');
      cleanUrl.searchParams.set('join', '1');
      history.replaceState(null, '', cleanUrl);
    }
    if (params.get('join') === '1') {
      setScreen('join');
      setInitializing(false);
      return;
    }
    const invitation = params.get('invite');
    let existingRoom = params.get('room');
    if (!existingRoom && params.get('meeting') === '1') {
      try { existingRoom = sessionStorage.getItem(activeRoomKey); } catch {}
      if (!existingRoom) setScreen('join');
    }
    const target = invitation || existingRoom;
    if (target) {
      setScreen('join');
      if (!parseRoomCode(target) || parseRoomCode(target) !== target) {
        setInitializing(false);
        setMessage('올바르지 않은 초대 링크예요. 공유받은 모임코드를 입력해 주세요.');
        return;
      }
      let returning = false;
      try {
        returning = props.configured
          ? !!localStorage.getItem('mm-token:' + target)
          : !!JSON.parse(localStorage.getItem('mm-demo:' + target) || 'null')?.me;
        returning ||= parseCreatedRooms(localStorage.getItem(createdRoomsKey)).some(item => item.room === target);
      } catch {}
      if (!invitation && returning) {
        // Keep the initial loader visible until the saved room lookup settles.
        enter('lookup', target);
        return;
      }
      setInvitedRoom(target);
    }
    setInitializing(false);
  }, []);

  function navigate(next) { setMessage(''); setScreen(next); }
  function createMeeting() {
    firstCreation.current = null;
    const url = new URL(location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('invite');
    url.searchParams.delete('meeting');
    url.searchParams.delete('join');
    try { sessionStorage.removeItem(activeRoomKey); } catch {}
    history.replaceState(null, '', url);
    setName('');
    setInvitedRoom('');
    setCode('');
    navigate('create');
    setSelected(null);
  }
  if (initializing) return <MeetingSkeleton />;
  if (selected) return <FirstEntryBoundary key={selected.room} onFailure={recoverFirstEntry}><Meeting {...props} roomCode={selected.room} roomName={selected.name} createdRooms={createdRooms} onCreateMeeting={createMeeting} onDeleteMeeting={deleteMeeting} onInitialEntryComplete={completeFirstEntry} animateJoin={animateJoin} /></FirstEntryBoundary>;
  return <main ref={entryPage} className="entry-page">
    <a className="brand entry-brand" href="/">Meet Soon</a>
    <section className="entry-card" aria-labelledby="entry-title">
      {screen !== 'home' && <button type="button" className="entry-back" disabled={busy} onClick={() => navigate('home')}>처음으로 <ArrowLeft size={18} aria-hidden="true" /></button>}
      <span className="entry-icon"><CalendarDays aria-hidden="true" /></span>
     
      <h1 id="entry-title">{screen === 'home' ? '우리, 언제 만날까요?' : screen === 'create' ? '모임 만들기' : '코드로 참여하기'}</h1>
      <p className="entry-description">{screen === 'home' ? '' : screen === 'create' ? '' : '초대 링크와 함께 받은 모임코드를 입력해 주세요.'}</p>
      {screen === 'home' ? <div className="entry-actions">
        <button className="primary" onClick={() => navigate('create')}>모임 만들기</button>
        <button className="outline-button" onClick={() => navigate('join')}>코드로 참여하기 <KeyRound aria-hidden="true" /></button>
      </div> : screen === 'create' ? <form onSubmit={event => { event.preventDefault(); enter('create', name); }}>
        <label htmlFor="meeting-name">모임 이름 <span>(선택)</span></label>
        <input id="meeting-name" data-filled={!!name.trim()} autoFocus maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="예: 오랜만에 만나는 우리" />
        <p className="entry-hint">비워 두면 ‘우리 모임’으로 시작해요.</p>
        <button className="primary" disabled={busy}>{busy ? '만드는 중…' : '모임 만들기'}</button>
        <button type="button" className="entry-alternative" disabled={busy} onClick={() => navigate('join')}>또는 코드로 참여하기</button>
      </form> : <form onSubmit={event => { event.preventDefault(); enter('lookup', code); }}>
        <label htmlFor="room-code">모임 코드</label>
        <input id="room-code" data-filled={!!code.trim()} autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={event => setCode(event.target.value)} placeholder="공유받은 모임코드 입력" required />
        <button className="primary" disabled={busy || !code.trim()}>{busy ? '모임 확인 중…' : '다음'}</button>
      </form>}
      {message && <p className="form-error" role="alert">{message}</p>}
      
    </section>
  </main>;
}
