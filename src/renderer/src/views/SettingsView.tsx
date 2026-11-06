export function SettingsView(): React.JSX.Element {
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <h2 className="view-title">Settings &amp; privacy</h2>
          <p className="view-subtitle muted">You stay in control</p>
        </div>
      </header>

      <div className="card guidance-card">
        <h3 className="card-title">Arriving in Phase 6</h3>
        <ul className="roadmap">
          <li>Camera consent screen - clear explanation before any camera access</li>
          <li>Emergency stop - one click ends monitoring immediately</li>
          <li>Data controls - see what is stored, delete it, or turn history off entirely</li>
          <li>Telemetry disclosure - what the SmartSpectra SDK does and does not send</li>
        </ul>
      </div>
    </section>
  )
}
