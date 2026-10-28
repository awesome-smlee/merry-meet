'use client';

import { useEffect, useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartNoAxesCombined, Users } from 'lucide-react';
import MemberIdentity from './member-identity';

function CandidateTooltip({ active, payload }) {
  const candidate = payload?.[0]?.payload;
  if (!active || !candidate) return null;
  return (
    <div className="stats-tooltip">
      <div className="member-identity-list">{candidate.participants.map(member => <MemberIdentity key={member.id} member={member} />)}</div>
    </div>
  );
}

export default function OverlapStatistics({ ranks, members }) {
  const gradientId = useId();
  const [touchInput, setTouchInput] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setTouchInput(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const total = members.length;
  const maximum = ranks[0]?.count || 0;
  const topCandidates = ranks.slice(0, 6).map((candidate) => {
    const [day, time] = candidate.slot.split('|');
    return {
      ...candidate,
      day,
      time,
      total,
      label: `${Number(day.slice(5, 7))}/${Number(day.slice(8))} (${new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${day}T00:00:00+09:00`))}) ${time}`,
      percent: total ? Math.round(candidate.count / total * 100) : 0,
      participants: members.filter((member) => member.responded && member.slots.includes(candidate.slot)),
    };
  });

  return (
    <>
      {!ranks.length ? (
        <div className="empty">
          <span><ChartNoAxesCombined aria-hidden="true" /></span>
          <h3>아직 시간 응답이 없어요.</h3>
          <p>달력에서 가능한 시간을 선택하면 응답 통계를 확인할 수 있어요.</p>
        </div>
      ) : topCandidates.length <= 3 ? (
        <div className="overlap-shortlist-section">
          <p className="overlap-sort-note">가능 인원이 많은 순으로 모았어요.</p>
          <ul className="overlap-shortlist" aria-label="가능한 날짜와 시간 후보">{topCandidates.map(candidate => <li key={candidate.slot}>
            <div className="overlap-candidate-heading">
              <time className="overlap-candidate-date" dateTime={`${candidate.day}T${candidate.time}:00+09:00`}>
                <span>{Number(candidate.day.slice(5, 7))}월 {Number(candidate.day.slice(8))}일 ({new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${candidate.day}T00:00:00+09:00`))})</span>
                <strong>{candidate.time}</strong>
              </time>
              <span className={`overlap-candidate-count${candidate.count === total ? ' is-everyone' : ''}`}>
                <Users aria-hidden="true" />
                {candidate.count === total ? `전원 ${total}명 가능` : `${total}명 중 ${candidate.count}명 가능`}
              </span>
            </div>
            <div className="overlap-candidate-people">
              <span>가능한 참여자</span>
              <div className="member-identity-list">{candidate.participants.map(member => <MemberIdentity key={member.id} member={member} />)}</div>
            </div>
          </li>)}</ul>
        </div>
      ) : (
        <>
          <div className="overlap-chart-panel">
            <div className="stats-chart-heading">
              <div>
                <h3>{topCandidates.length}개로 추려봤어요</h3>
                <p>가능 인원 많은 순 · 인원이 같으면 날짜와 시간이 빠른 순으로 정리했어요.</p>
              </div>
              <span className="stats-chart-key"><i aria-hidden="true" />가장 많이 겹치는 시간</span>
            </div>
              <div className="overlap-chart" role="region" aria-label="시간별 가능 인원 차트" style={{ height: topCandidates.length * 48 + 40 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={topCandidates} layout="vertical" margin={{ top: 8, right: 36, bottom: 0, left: 0 }} accessibilityLayer>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8bb7ff" />
                        <stop offset="100%" stopColor="#3479ed" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" />
                    <XAxis type="number" domain={[0, Math.max(total, 1)]} allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={138} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink)', fontSize: 11 }} interval={0} />
                    <Tooltip trigger={touchInput ? 'click' : 'hover'} content={<CandidateTooltip />} cursor={{ fill: '#e6effc', radius: 10 }} />
                    <Bar dataKey="count" name="가능 인원" radius={[0, 8, 8, 0]} barSize={22} isAnimationActive={false}>
                      {topCandidates.map(candidate => <Cell key={candidate.slot} fill={candidate.count === maximum ? `url(#${gradientId})` : '#b8c9e0'} />)}
                      <LabelList dataKey="count" position="right" formatter={(value) => `${value}명`} fill="var(--blue-dark)" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </div>

        </>
      )}
    </>
  );
}
