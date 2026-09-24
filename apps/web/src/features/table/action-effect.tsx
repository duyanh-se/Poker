export function ActionEffect({ action }: { action?: string }) {
  if (action === 'check')
    return (
      <span className="table-action-effect check-hand" aria-hidden="true">
        <svg viewBox="0 0 80 80">
          <path
            d="M30 65V29c0-8 12-8 12 0v18l5-13c3-6 12-2 10 4l-3 14 5-7c5-5 12 1 8 7L56 70H34Z"
            fill="#e9bd98"
            stroke="#684734"
            strokeWidth="3"
          />
          <path
            className="tap-rings"
            d="M13 71q20 12 43 0M18 65q15 9 32 0"
            fill="none"
            stroke="#ffe5ac"
            strokeWidth="3"
          />
        </svg>
      </span>
    );
  if (action === 'fold')
    return (
      <span className="table-action-effect fold-cards" aria-hidden="true">
        <i>♠</i>
        <i>♠</i>
      </span>
    );
  if (action === 'all-in')
    return (
      <span className="table-action-effect all-in-effect" aria-hidden="true">
        <b>ALL IN</b>
        <span>● ● ●</span>
      </span>
    );
  return null;
}
