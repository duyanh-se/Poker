import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WagerIncrements } from './wager-increments';

describe('wager increments', () => {
  it('accumulates chips without submitting, respecting the maximum', () => {
    function Example() {
      const [amount, change] = useState(10);
      return (
        <>
          <output>{amount}</output>
          <WagerIncrements amount={amount} max={35} locked={false} change={change} />
        </>
      );
    }
    render(<Example />);
    fireEvent.click(screen.getByRole('button', { name: /^\+5$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^\+20$/ }));
    expect(screen.getByRole('status')).toHaveTextContent('35');
    expect(screen.getByRole('button', { name: /^\+1$/ })).toBeDisabled();
  });
  it('locks additions while pending/offline or outside safe integers', () => {
    const change = vi.fn();
    const { rerender } = render(<WagerIncrements amount={10} max={100} locked change={change} />);
    fireEvent.click(screen.getByRole('button', { name: /^\+5$/ }));
    expect(change).not.toHaveBeenCalled();
    rerender(
      <WagerIncrements
        amount={Number.MAX_SAFE_INTEGER}
        max={Infinity}
        locked={false}
        change={change}
      />,
    );
    expect(screen.getByRole('button', { name: /^\+1$/ })).toBeDisabled();
  });
});
