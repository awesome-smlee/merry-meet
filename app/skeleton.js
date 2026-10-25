function Block({ className = '' }) {
  return <div className={`skeleton-block ${className}`} />;
}

function Placeholder({ label, children, className = '' }) {
  return <div className={`skeleton ${className}`} role="status" aria-busy="true" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>;
}

export function StatisticsSkeleton() {
  return <Placeholder label="시간 통계를 불러오는 중이에요.">
    <div className="skeleton-columns">{Array.from({ length: 3 }, (_, i) => <Block key={i} className="skeleton-metric" />)}</div>
    <Block className="skeleton-chart" />
  </Placeholder>;
}

export function PlaceSkeleton() {
  return <Placeholder label="장소 정보를 불러오는 중이에요." className="place-planner">
    <section className="card"><Block className="skeleton-title" /><Block className="skeleton-line" />
      <div className="skeleton-columns">{Array.from({ length: 3 }, (_, i) => <Block key={i} className="skeleton-choice" />)}</div>
      <div className="skeleton-place-columns">{[0, 1].map(i => <Block key={i} className="skeleton-chart" />)}</div>
    </section>
  </Placeholder>;
}

export default function MeetingSkeleton() {
  return <>
    <header className="topbar"><span className="brand">Meet Soon</span><Block className="skeleton-share" /></header>
    <main><Placeholder label="약속 정보를 불러오는 중이에요.">
      <Block className="skeleton-steps" />
      <section className="recommend"><Block className="skeleton-title" /><Block className="skeleton-line" />
        <div className="skeleton-columns">{[0, 1, 2].map(i => <Block key={i} className="skeleton-recommendation" />)}</div>
      </section>
      <div className="layout"><div className="main-column">
        <section className="card calendar"><Block className="skeleton-title" /><Block className="skeleton-month" />
          <div className="skeleton-calendar">{Array.from({ length: 42 }, (_, i) => <Block key={i} className="skeleton-day" />)}</div>
        </section>
        <section className="card"><Block className="skeleton-title" /><div className="skeleton-columns">{[0, 1, 2].map(i => <Block key={i} className="skeleton-metric" />)}</div><Block className="skeleton-chart" /></section>
        <section className="card"><Block className="skeleton-title" />{[0, 1, 2].map(i => <Block key={i} className="skeleton-person" />)}</section>
      </div></div>
    </Placeholder></main>
  </>;
}
