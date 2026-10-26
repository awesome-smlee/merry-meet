'use client';
import { useEffect, useRef, useState } from 'react';
import { Clock3, Settings2, X } from 'lucide-react';
import { dateLabel } from '../lib/meeting.mjs';

export default function ResponseDeadline({ state, today, closed, disabled, onSave }) {
  const [open, setOpen] = useState(false);
  const expired = state.responseDeadline && today > state.responseDeadline;
  const dueToday = state.responseDeadline === today;
  const status = !state.responseDeadline ? '미설정' : closed ? '마감됨' : expired ? '추가 응답 가능' : dueToday ? '오늘 마감' : '응답 중';
  return <>
    <section className={`response-deadline${closed ? ' is-closed' : dueToday ? ' is-due-today' : ''}`} aria-label="응답 마감 안내">
      <div className="deadline-summary">
        <span className="deadline-symbol"><Clock3 aria-hidden="true" /></span>
        <div className="deadline-copy">
          <div className="deadline-eyebrow"><span>응답 마감</span><span className="deadline-status">{status}</span></div>
          <strong>{state.responseDeadline ? expired ? `${dateLabel(state.responseDeadline)}에 응답 마감됐어요` : `응답은 ${dateLabel(state.responseDeadline)}까지 해주세요.` : '마감일을 정해주세요'}</strong>
          <p>{state.responseDeadline ? `23:59 · 한국 시간 · ${state.allowLateResponses ? '마감 후 수정 가능' : '마감 후 수정 불가'}` : '언제까지 응답하면 될까요?'}</p>
        </div>
      </div>
      <button type="button" className="outline-button" disabled={disabled} onClick={() => setOpen(true)}>마감 설정 <Settings2 aria-hidden="true" /></button>
    </section>
    {open && <DeadlineEditor state={state} today={today} onSave={onSave} onClose={() => setOpen(false)} />}
  </>;
}

function DeadlineEditor({ state, today, onSave, onClose }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const [date, setDate] = useState(state.responseDeadline || '');
  const [allow, setAllow] = useState(!!state.allowLateResponses);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  async function save(values, action) {
    if (pending.current) return;
    pending.current = true;
    setSaving(action);
    setError('');
    try { await onSave(values); onClose(); }
    catch (err) { setError(err.message); }
    finally { pending.current = false; setSaving(''); }
  }
  return <dialog ref={dialog} className="modal deadline-modal" aria-labelledby="deadline-title" onCancel={event => { event.preventDefault(); if (!pending.current) onClose(); }}>
    <button type="button" className="close" disabled={saving} aria-label="마감 설정 닫기" onClick={onClose}><X aria-hidden="true" /></button>
    <h2 id="deadline-title">응답 마감 설정</h2>
    <p>마감일 23:59까지 · 한국 시간</p>
    <form onSubmit={event => { event.preventDefault(); save({ responseDeadline: date || null, allowLateResponses: allow }, 'save'); }}>
      <label htmlFor="response-deadline">마감일</label>
      <input id="response-deadline" data-filled={!!date} type="date" min={today} max="2100-12-31" value={date} disabled={saving} onChange={event => setDate(event.target.value)} />
      <label className="deadline-option"><input type="checkbox" checked={allow} disabled={saving} onChange={event => setAllow(event.target.checked)} /><span>마감 후 수정 허용</span></label>
      <p>약속 확정 후에는 수정 불가</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="deadline-actions">
        <button type="button" className="outline-button" disabled={!!saving || !state.responseDeadline} onClick={() => save({ responseDeadline: null, allowLateResponses: !!state.allowLateResponses }, 'clear')}>{saving === 'clear' ? '해제 중…' : '마감 해제'}</button>
        <button className="primary" disabled={!!saving}>{saving === 'save' ? '저장 중…' : '저장하기'}</button>
      </div>
    </form>
  </dialog>;
}
