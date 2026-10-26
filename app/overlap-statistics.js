'use client';

import { useEffect, useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, ChartNoAxesCombined, Users } from 'lucide-react';
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
  const [chartWidth, setChartWidth] = useState(0);
  const [touchInput, setTouchInput] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setTouchInput(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const compactChart = chartWidth > 0 && chartWidth < 380;
  const total = members.length;
  const overlapCount = ranks.filter((candidate) => candidate.count >= 2).length;
  const everyoneCount = total >= 2
    ? ranks.filter((candidate) => candidate.count === total).length
    : 0;
  const maximum = ranks[0]?.count || 0;
  const topCandidates = ranks.slice(0, 6).map((candidate) => {
    const [day, time] = candidate.slot.split('|');
    return {
      ...candidate,
      day,
      time,
      total,
      label: `${Number(day.slice(5, 7))}/${Number(day.slice(8))} ${time}`,
      percent: total ? Math.round(candidate.count / total * 100) : 0,
      participants: members.filter((member) => member.responded && member.slots.includes(candidate.slot)),
    };
  });

  return (
    <>
      <div className="overlap-metrics">
        <div className="overlap-metric featured">
          <span><Users aria-hidden="true" /> 최대 가능 인원</span>
          <strong>{maximum}<small> / {total}명</small></strong>
        </div>
        <div className="overlap-metric">
          <span><ChartNoAxesCombined aria-hidden="true" /> 겹치는 시간</span>
          <strong>{overlapCount}<small>개</small></strong>
        </div>
        <div className="overlap-metric">
          <span><CalendarCheck aria-hidden="true" /> 전원 가능</span>
          <strong>{everyoneCount}<small>개</small></strong>
          
        </div>
      </div>
      {!ranks.length ? (
        <div className="empty">
          <span><ChartNoAxesCombined aria-hidden="true" /></span>
          <h3>아직 시간 응답이 없어요.</h3>
          <p>달력에서 가능한 시간을 선택하면 응답 통계를 확인할 수 있어요.</p>
        </div>
      ) : topCandidates.length <= 3 ? (
        <ul className="overlap-shortlist">{topCandidates.map(candidate => <li key={candidate.slot}>
          <span>{Number(candidate.day.slice(5, 7))}/{Number(candidate.day.slice(8))} {new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${candidate.day}T00:00:00+09:00`))} · {candidate.time} · {candidate.count}명 가능</span>
        </li>)}</ul>
      ) : (
        <>
          <div className="overlap-chart-panel">
            <div className="stats-chart-heading">
              <div>
                <h3>{topCandidates.length}개로 추려봤어요</h3>
                <p>가능 인원 많은 순 · 인원이 같으면 날짜와 시간이 빠른 순으로 정리했어요.</p>
              </div>
              
            </div>
            <div className="overlap-chart" style={{ height: Math.max(160, topCandidates.length * 48 + 40) }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} onResize={width => setChartWidth(width)}>
                <BarChart data={topCandidates} layout="vertical" margin={{ top: 8, right: compactChart ? 28 : 38, bottom: 0, left: 0 }} accessibilityLayer>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8bb7ff" />
                      <stop offset="100%" stopColor="#3479ed" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" />
                  <XAxis type="number" domain={[0, Math.max(total, 1)]} allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={compactChart ? 88 : 106} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink)', fontSize: compactChart ? 10 : 12 }} interval={0} />
                  <Tooltip trigger={touchInput ? 'click' : 'hover'} content={<CandidateTooltip />} cursor={{ fill: '#e6effc', radius: 10 }} />
                  <Bar dataKey="count" name="가능 인원" fill={`url(#${gradientId})`} radius={[0, 8, 8, 0]} barSize={20} isAnimationActive={false}>
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
