'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
export function Panel({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  function requestClose() {
    if (closing) return;
    if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      close();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(close, 200);
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      clearTimeout(timer.current);
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`panel ${closing ? 'panel-closing' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" onClick={requestClose} aria-label="Đóng bảng">
          ✕
        </button>
      </header>
      <div className="panel-content">{children}</div>
    </dialog>
  );
}
