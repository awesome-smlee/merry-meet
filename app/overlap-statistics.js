'use client';

import { useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, CalendarCheck, ChartNoAxesCombined, Users } from 'lucide-react';
import { dateLabel } from '../lib/meeting.mjs';

function CandidateTooltip({ active, payload }) {
  const candidate = payload?.[0]?.payload;
  if (!active || !candidate) return null;
  return (
    <div className="stats-tooltip">
      <strong>{dateLabel(candidate.day)} · {candidate.time}</strong>
      <span>{candidate.count} / {candidate.total}명 가능 · {candidate.percent}%</span>
      <p>{candidate.names}</p>
    </div>
  );
}

export default function OverlapStatistics({ ranks, members, onOpenDay }) {
  const gradientId = useId();
  const [visibleCount, setVisibleCount] = useState(10);
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
      names: members.filter((member) => member.responded && member.slots.includes(candidate.slot))
        .map((member) => member.nickname).join(', '),
    };
  });

  return (
    <>
      <div className="overlap-metrics">
        <div className="overlap-metric featured">
          <span><Users aria-hidden="true" /> 최대 인원</span>
          <strong>{maximum}<small> / {total}명</small></strong>
          <p>{total ? Math.round(maximum / total * 100) : 0}% 참석 가능</p>
        </div>
        <div className="overlap-metric">
          <span><ChartNoAxesCombined aria-hidden="true" /> 겹치는 시간</span>
          <strong>{overlapCount}<small>개</small></strong>
          <p>2명 이상 가능한 시간</p>
        </div>
        <div className="overlap-metric">
          <span><CalendarCheck aria-hidden="true" /> 전원 가능</span>
          <strong>{everyoneCount}<small>개</small></strong>
          <p>{total >= 2 ? '입장한 친구 모두 가능' : '친구가 더 참여하면 집계해요'}</p>
        </div>
      </div>
      {!ranks.length ? (
        <div className="empty">
          <span><ChartNoAxesCombined aria-hidden="true" /></span>
          <h3>아직 등록된 시간이 없어요.</h3>
          <p>달력에서 가능한 시간을 선택하면 통계가 채워져요.</p>
        </div>
      ) : (
        <>
          <div className="overlap-chart-panel">
            <div className="stats-chart-heading">
              <div>
                <h3>함께할 수 있는 시간 TOP {topCandidates.length}</h3>
                <p>참석 가능한 인원순 · 같은 인원이면 빠른 날짜순</p>
              </div>
              <span className="stats-chart-key"><i /> 가능 인원</span>
            </div>
            <div className="overlap-chart" style={{ height: Math.max(160, topCandidates.length * 48 + 40) }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={topCandidates} layout="vertical" margin={{ top: 8, right: 38, bottom: 0, left: 0 }} accessibilityLayer>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8bb7ff" />
                      <stop offset="100%" stopColor="#3479ed" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" />
                  <XAxis type="number" domain={[0, Math.max(total, 1)]} allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={106} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink)', fontSize: 12 }} interval={0} />
                  <Tooltip content={<CandidateTooltip />} cursor={{ fill: '#e6effc', radius: 10 }} />
                  <Bar dataKey="count" name="가능 인원" fill={`url(#${gradientId})`} radius={[0, 8, 8, 0]} barSize={20} isAnimationActive={false}>
                    <LabelList dataKey="count" position="right" formatter={(value) => `${value}명`} fill="var(--blue-dark)" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="stats-chart-note">전체 {ranks.length}개 후보 중 상위 {topCandidates.length}개 · 각 후보는 30분 단위예요.</p>
          </div>
          <details className="stats-details">
            <summary>전체 후보와 참여 친구 보기 <span>{ranks.length}개</span></summary>
            <div className="stats-candidate-list">
              {ranks.slice(0, visibleCount).map((candidate) => (
                <button className="stats-candidate" key={candidate.slot} onClick={() => onOpenDay(candidate.slot.split('|')[0])}>
                  <span>
                    <strong>{dateLabel(candidate.slot.split('|')[0])} · {candidate.slot.split('|')[1]}</strong>
                    <small>{members.filter((member) => member.responded && member.slots.includes(candidate.slot)).map((member) => member.nickname).join(', ')}</small>
                  </span>
                  <span className="stats-candidate-count">{candidate.count} / {total}명 <ArrowUpRight aria-hidden="true" /></span>
                </button>
              ))}
            </div>
            {visibleCount < ranks.length && (
              <button className="outline-button stats-more" onClick={() => setVisibleCount((count) => count + 10)}>후보 10개 더 보기</button>
            )}
          </details>
        </>
      )}
    </>
  );
}
