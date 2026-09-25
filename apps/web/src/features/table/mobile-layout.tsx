'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function usePortraitTable() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
    const update = () => setPortrait(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return portrait;
}

export function TableMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>('.portrait-menu-toggle')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="table-menu" ref={ref}>
      <button className="portrait-menu-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Menu
      </button>
      <nav data-open={open} aria-label="Menu bàn" onClick={() => setOpen(false)}>
        {children}
      </nav>
    </div>
  );
}
