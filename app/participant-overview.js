'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CalendarCheck, Users } from 'lucide-react';

export default function ParticipantOverview({ members, canIntroduce }) {
  const container = useRef(null);
  const introduced = useRef(false);
  const tooltipId = useId();
  const [automatic, setAutomatic] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const active = hovered || focused || (automatic ? 'all' : null);
  const completed = members.filter((member) => member.responded);
  const shown = active === 'completed' ? completed : members;

  useEffect(() => {
    if (!active) return;
    const dismiss = (event) => {
      if (event.key !== 'Escape') return;
      setAutomatic(false);
      setHovered(null);
      setFocused(null);
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [active]);

  useEffect(() => {
    if (!canIntroduce || introduced.current) return;
    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      introduced.current = true;
      setAutomatic(true);
      timer = setTimeout(() => setAutomatic(false), 5000);
      observer.disconnect();
    }, { threshold: 0.6 });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      setAutomatic(false);
    };
  }, [canIntroduce]);

  return (
    <div
      ref={container}
      className="participant-overview"
      onMouseLeave={() => setHovered(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
      }}
    >
      <div className="overview-stats">
        {[
          { key: 'all', label: '함께하는 친구', count: members.length, Icon: Users },
          { key: 'completed', label: '시간 선택 완료', count: completed.length, Icon: CalendarCheck },
        ].map(({ key, label, count, Icon }) => (
          <div key={key}>
            <Icon aria-hidden="true" />
            <button
              type="button"
              className="participant-count"
              aria-label={`${label} ${count}명, 닉네임 보기`}
              aria-describedby={active === key ? tooltipId : undefined}
              onMouseEnter={() => setHovered(key)}
              onFocus={() => setFocused(key)}
              onClick={() => setFocused(key)}
            >
              <strong>{count}<small>명</small></strong>
            </button>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {active && (
        <div className="participant-tooltip" id={tooltipId} role="tooltip" data-side={active} onMouseEnter={() => setHovered(active)}>
          <strong>{active === 'completed' ? '시간 선택을 마친 친구' : '함께하는 친구'} · {shown.length}명</strong>
          {shown.length ? (
            <ul>{shown.map((member) => <li key={member.id}>{member.nickname}</li>)}</ul>
          ) : (
            <p>{active === 'completed' ? '아직 시간을 선택한 친구가 없어요.' : '아직 참여한 친구가 없어요.'}</p>
          )}
        </div>
      )}
    </div>
  );
}
