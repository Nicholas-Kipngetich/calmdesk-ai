export function HistoryView(): React.JSX.Element {
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <h2 className="view-title">Session history</h2>
          <p className="view-subtitle muted">Your own data · only you</p>
        </div>
      </header>

      <div className="card guidance-card">
        <h3 className="card-title">Arriving in Phase 6</h3>
        <ul className="roadmap">
          <li>Session summaries - duration, measured breathing, signal quality</li>
          <li>Personal trends - compared against <strong>your own</strong> history, never a universal score</li>
          <li>Full transparency - local-only storage with one-click deletion controls</li>
        </ul>
      </div>
    </section>
  )
}
