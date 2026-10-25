'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, CalendarDays, QrCode, ArrowLeft } from 'lucide-react';
import Meeting from './meeting';
import { parseRoomCode, roomName } from '../lib/rooms.mjs';
const QrScanner = dynamic(() => import('./qr-scanner'), { ssr: false, loading: () => <p role="status">카메라 준비 중…</p> });

export default function MeetingEntry(props) {
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const pending = useRef(false);

  async function enter(action, value) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setScanning(false);
    setMessage('');
    try {
      let room;
      if (props.configured) {
        const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'create' ? { action, name: value } : { action, code: value }) });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        room = data;
      } else if (action === 'create') {
        room = { room: crypto.randomUUID().replaceAll('-', '').slice(0, 16), name: roomName(value) };
        localStorage.setItem('mm-room:' + room.room, JSON.stringify(room));
      } else {
        const parsed = parseRoomCode(value);
        room = parsed && JSON.parse(localStorage.getItem('mm-room:' + parsed) || 'null');
        if (!room) throw Error('해당 모임을 찾을 수 없어요.');
      }
      const url = new URL(location.href);
      url.searchParams.set('room', room.room);
      history.replaceState(null, '', url);
      setSelected(room);
    } catch (error) {
      setMessage(error.message);
      setScreen(action === 'create' ? 'create' : 'join');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !props.configured) {
      const testRoom = { room: 'TEST2026', name: '코드 참여 테스트 모임' };
      localStorage.setItem('mm-room:' + testRoom.room, JSON.stringify(testRoom));
    }
    const invited = new URLSearchParams(location.search).get('room');
    if (invited) { setCode(invited); setScreen('join'); enter('lookup', invited); }
  }, []);

  function navigate(next) { setMessage(''); setScanning(false); setScreen(next); }
  if (selected) return <Meeting key={selected.room} {...props} roomName={selected.name} />;
  return <main className="entry-page">
    <a className="brand entry-brand" href="/">Meet Soon</a>
    <section className="entry-card" aria-labelledby="entry-title">
      {screen !== 'home' && <button type="button" className="entry-back" disabled={busy} onClick={() => navigate('home')}><ArrowLeft size={18} /> 처음으로</button>}
      <span className="entry-icon"><CalendarDays aria-hidden="true" /></span>
     
      <h1 id="entry-title">{screen === 'home' ? '우리, 언제 만날까요?' : screen === 'create' ? '모임 만들기' : '코드로 참여하기'}</h1>
      <p className="entry-description">{screen === 'home' ? '' : screen === 'create' ? '모임 이름을 정해 주세요. 나중에 닉네임으로 참여해요.' : '초대 코드를 입력하거나 QR 코드를 스캔해 주세요.'}</p>
      {screen === 'home' ? <div className="entry-actions">
        <button className="primary" onClick={() => navigate('create')}>모임 만들기</button>
        <button className="outline-button" onClick={() => navigate('join')}><QrCode aria-hidden="true" /> 코드로 참여하기</button>
      </div> : screen === 'create' ? <form onSubmit={event => { event.preventDefault(); enter('create', name); }}>
        <label htmlFor="meeting-name">모임 이름 <span>(선택)</span></label>
        <input id="meeting-name" autoFocus maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="예: 오랜만에 만나는 우리" />
        <p className="entry-hint">비워 두면 ‘우리 모임’으로 시작해요.</p>
        <button className="primary" disabled={busy}>{busy ? '만드는 중…' : '모임 만들기'}</button>
        <button type="button" className="entry-alternative" disabled={busy} onClick={() => navigate('join')}>또는 코드로 참여하기</button>
      </form> : <form onSubmit={event => { event.preventDefault(); enter('lookup', code); }}>
        <label htmlFor="room-code">모임 코드</label>
        <input id="room-code" autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={event => setCode(event.target.value)} placeholder="초대 코드 또는 초대 링크 입력" required />
        <button className="primary" disabled={busy || !code.trim()}>{busy ? '모임 확인 중…' : '다음'} <ArrowRight aria-hidden="true" /></button>
        <div className="entry-divider">또는</div>
        {scanning ? <QrScanner onScan={value => { setCode(value); enter('lookup', value); }} onClose={() => setScanning(false)} /> : <button type="button" className="outline-button" disabled={busy} onClick={() => setScanning(true)}><QrCode aria-hidden="true" /> QR 스캔으로 참여하기</button>}
      </form>}
      {message && <p className="form-error" role="alert">{message}</p>}
      
    </section>
  </main>;
}
