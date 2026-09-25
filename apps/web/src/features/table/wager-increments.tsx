export function WagerIncrements({
  amount,
  max,
  locked,
  change,
}: {
  amount: number;
  max: number;
  locked: boolean;
  change: (amount: number) => void;
}) {
  return (
    <div className="wager-increments" role="group" aria-label="Cộng chip vào tổng cược">
      {[1, 2, 5, 10, 20, 50].map((step) => (
        <button
          key={step}
          type="button"
          disabled={
            locked ||
            !Number.isSafeInteger(amount) ||
            amount < 0 ||
            !Number.isSafeInteger(amount + step) ||
            amount + step > max
          }
          onClick={() => change(amount + step)}
        >
          +{step}
        </button>
      ))}
    </div>
  );
}
