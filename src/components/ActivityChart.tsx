export function ActivityChart({ data }: { data: { day: string; changes: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.changes));
  const total = data.reduce((sum, d) => sum + d.changes, 0);
  return (
    <div className="activity-chart">
      <div className="chart-scale">
        <span>{max}</span>
        <span>0</span>
      </div>
      <div className="chart-main">
        <div className="chart-bars">
          {data.map((entry, index) => {
            const height = Math.max(3, (entry.changes / max) * 100);
            const label = new Date(`${entry.day}T12:00:00`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
            return (
              <div className="chart-bar-wrap" key={entry.day} title={`${label}: ${entry.changes} changes`}>
                <div
                  className={`chart-bar ${entry.changes === 0 ? 'chart-bar-empty' : ''}`}
                  style={{ height: `${height}%` }}
                >
                  {entry.changes > 0 && <span className="chart-bar-value">{entry.changes}</span>}
                </div>
                <span className="chart-label">{index % 2 === 0 ? label.split(' ')[1] : ''}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="chart-foot">
        <span>{total} tracked changes · last 14 days</span>
        <span className="chart-legend">
          <i className="legend-swatch" /> material changes
        </span>
      </div>
    </div>
  );
}
