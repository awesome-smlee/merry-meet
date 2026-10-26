'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';

export default function MeetingEvents({ state, initialDate, initialMode, onAction, onClose }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const [editing, setEditing] = useState(initialMode === 'create' ? 'new' : null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const events = (state.events || []).filter(event => event.date === initialDate);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);

  function edit(event) {
    setEditing(event?.id || 'new');
    setTitle(event?.title || '');
    setDate(event?.date || initialDate);
    setMemo(event?.memo || '');
    setDeleteId(null);
    setError('');
  }
  async function mutate(action, payload) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await onAction(action, payload);
      if (action !== 'event-delete') onClose();
      else setDeleteId(null);
    } catch (err) { setError(err.message); }
    finally { pending.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} className="modal events-modal" aria-labelledby="events-title" onCancel={event => { event.preventDefault(); if (!pending.current) onClose(); }}>
    <button type="button" className="close" aria-label="이벤트 닫기" disabled={saving} onClick={onClose}><X aria-hidden="true" /></button>
    <h2 id="events-title">{editing ? editing === 'new' ? '우리 이벤트 등록' : '이벤트 수정' : `${initialDate.replaceAll('-', '. ')}`}</h2>
    {editing ? <form onSubmit={event => { event.preventDefault(); mutate(editing === 'new' ? 'event-add' : 'event-update', { ...(editing === 'new' ? {} : { id: editing }), title, date, memo }); }}>
      <label htmlFor="event-title">이벤트명</label>
      <input id="event-title" data-filled={!!title.trim()} autoFocus required maxLength={40} value={title} disabled={saving} onChange={event => setTitle(event.target.value)} placeholder="예: 💍 지민 결혼식" />
      <label htmlFor="event-date">날짜</label>
      <input id="event-date" data-filled={!!date} type="date" required min="2000-01-01" max="2100-12-31" value={date} disabled={saving} onChange={event => setDate(event.target.value)} />
      <label htmlFor="event-memo">메모 <span>(선택)</span></label>
      <textarea id="event-memo" data-filled={!!memo.trim()} rows={3} maxLength={500} value={memo} disabled={saving} onChange={event => setMemo(event.target.value)} placeholder="장소나 함께 기억할 내용을 적어 주세요." />
      <div className="event-form-actions">
        <button type="button" className="outline-button" disabled={saving} onClick={() => { setEditing(null); setError(''); }}>취소</button>
        <button className="primary" disabled={saving || !title.trim() || !date}>{saving ? '저장 중…' : editing === 'new' ? '등록하기' : '저장하기'}</button>
      </div>
    </form> : <>
      {events.length ? <ul className="event-list">{events.map(event => <li key={event.id}>
        <h3>{event.title}</h3>
        {event.memo && <p className="event-memo">{event.memo}</p>}
        <small>등록: {state.members.find(member => member.id === event.addedBy)?.nickname || '참여자'}</small>
        {event.addedBy === state.me && <div className="event-item-actions">
          {deleteId === event.id ? <>
            <span>이 이벤트를 삭제할까요?</span>
            <button type="button" disabled={saving} onClick={() => mutate('event-delete', { id: event.id })}>삭제하기</button>
            <button type="button" disabled={saving} onClick={() => setDeleteId(null)}>취소</button>
          </> : <>
            <button type="button" disabled={saving} onClick={() => edit(event)}>수정</button>
            <button type="button" disabled={saving} onClick={() => { setDeleteId(event.id); setError(''); }}>삭제</button>
          </>}
        </div>}
      </li>)}</ul> : <p>등록된 이벤트가 없어요.</p>}
      <button type="button" className="primary" disabled={saving} onClick={() => edit()}>다른 이벤트 추가하기</button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </dialog>;
}
