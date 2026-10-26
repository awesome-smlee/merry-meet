'use client';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { dateLabel } from '../lib/meeting.mjs';

function slotLabel(slot) {
  if (!slot) return '미확정';
  const [date, time] = slot.split('|');
  return `${dateLabel(date)} ${time}`;
}

export default function MeetingChanges({ changes = [], storageKey }) {
  const [seen, setSeen] = useState(null);
  useEffect(() => {
    try { setSeen(localStorage.getItem(storageKey) || ''); }
    catch { setSeen(''); }
    const sync = event => { if (event.key === storageKey) setSeen(event.newValue || ''); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);
  const visibleChanges = changes.filter(change =>
    (change.from.slot && change.from.slot !== change.to.slot) ||
    (change.from.place?.id && change.from.place.id !== change.to.place?.id),
  );
  if (!visibleChanges.length) return null;
  const index = changes.findIndex(change => change.id === seen);
  const unreadIds = new Set(changes.slice(0, index < 0 ? changes.length : index).map(change => change.id));
  const unread = seen === null ? 0 : visibleChanges.filter(change => unreadIds.has(change.id)).length;
  function markRead() {
    const latest = changes[0].id;
    setSeen(latest);
    try { localStorage.setItem(storageKey, latest); } catch {}
  }
  return <section className={`meeting-changes${unread ? ' has-unread' : ''}`} aria-label="일정과 장소 변경 안내">
    <details>
      <summary>확정·변경 내역 {unread > 0 && <span className="change-unread" role="status">새 안내 {unread}개</span>}</summary>
      <ol>{visibleChanges.map(change => {
        const slotChanged = !!change.from.slot && change.from.slot !== change.to.slot;
        const placeChanged = !!change.from.place?.id && change.from.place.id !== change.to.place?.id;
        return <li key={change.id}>
          <strong>{slotChanged && placeChanged ? '일정·장소 변경' : slotChanged ? '일정 변경' : '장소 변경'}</strong>
          {slotChanged && <p><span>이전: {slotLabel(change.from.slot)}</span><span>변경: {slotLabel(change.to.slot)}</span></p>}
          {placeChanged && <p><span>이전 장소: {change.from.place?.name || '미확정'}</span><span>변경 장소: {change.to.place?.name || '미확정'}</span></p>}
          <small>{change.changedByName} · <time dateTime={change.createdAt}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(change.createdAt))}</time></small>
        </li>;
      })}</ol>
      {unread > 0 && <button type="button" className="outline-button" onClick={markRead}>모두 확인했어요 <Check aria-hidden="true" /></button>}
    </details>
  </section>;
}
