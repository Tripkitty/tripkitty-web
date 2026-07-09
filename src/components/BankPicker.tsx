import { useEffect, useRef, useState } from 'react';
import type { Bank } from '../types';

type Props = {
  banks: Bank[];
  selected: string[];
  onChange: (codes: string[]) => void;
  invalid?: boolean;
};

type Pos = { top: number; left: number; width: number };

// Мультивыбор банков для СБП: выпадающий список с чекбоксами. Список банков приходит
// из /banks, поэтому при добавлении новых банков на сервере фронт менять не нужно.
// Панель — position: fixed с координатами от кнопки-триггера, а не position: absolute:
// `.card` (в котором обычно лежит форма реквизитов) задаёт overflow: hidden и обрезал бы
// абсолютно спозиционированную панель по границе карточки.
export function BankPicker({ banks, selected, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const reposition = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  const openPanel = () => {
    reposition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  };

  if (banks.length === 0) {
    return <div className="hint">Загрузка списка банков…</div>;
  }

  const selectedNames = banks.filter((b) => selected.includes(b.code)).map((b) => b.name);
  const summary =
    selectedNames.length === 0
      ? 'Выберите банки'
      : selectedNames.length <= 2
        ? selectedNames.join(', ')
        : `${selectedNames[0]} и ещё ${selectedNames.length - 1}`;

  return (
    <div className="bank-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={
          'bank-picker-trigger' +
          (invalid ? ' invalid' : '') +
          (selectedNames.length === 0 ? ' placeholder' : '')
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span className="bank-picker-summary">{summary}</span>
        <svg
          className={'bank-picker-chevron' + (open ? ' open' : '')}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && (
        <div
          className="bank-picker-panel"
          role="listbox"
          aria-multiselectable="true"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {banks.map((b) => {
            const on = selected.includes(b.code);
            return (
              <button
                key={b.code}
                type="button"
                className={'bank-picker-option' + (on ? ' on' : '')}
                role="option"
                aria-selected={on}
                onClick={() => toggle(b.code)}
              >
                <span className="bank-picker-checkbox" aria-hidden="true">
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="4 12 9 17 20 6" />
                    </svg>
                  )}
                </span>
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
