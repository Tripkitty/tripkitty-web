import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Bank } from '../types';

type Props = {
  banks: Bank[];
  selected: string[];
  onChange: (codes: string[]) => void;
  invalid?: boolean;
};

type Pos = { left: number; width: number; maxHeight: number } & ({ top: number; bottom?: undefined } | { bottom: number; top?: undefined });

// Мультивыбор банков для СБП: выпадающий список с чекбоксами. Список банков приходит
// из /banks, поэтому при добавлении новых банков на сервере фронт менять не нужно.
// Панель — position: fixed с координатами от кнопки-триггера, а не position: absolute:
// `.card` (в котором обычно лежит форма реквизитов) задаёт overflow: hidden и обрезал бы
// абсолютно спозиционированную панель по границе карточки.
// Рендерится через createPortal в document.body: без портала панель остаётся в DOM внутри
// `.modal-sheet` (см. Modal.tsx), у которого есть CSS-анимация transform — это создаёт
// containing block для position: fixed-потомков и обрезает панель по границе модалки.
export function BankPicker({ banks, selected, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 6;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    // Открываем вверх, если снизу мало места, а сверху его заметно больше — иначе список
    // упирается в нижний край экрана/модалки и выглядит обрезанным.
    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      setPos({ bottom: window.innerHeight - r.top + margin, left: r.left, width: r.width, maxHeight: Math.min(260, spaceAbove) });
    } else {
      setPos({ top: r.bottom + margin, left: r.left, width: r.width, maxHeight: Math.min(260, spaceBelow) });
    }
  };

  const openPanel = () => {
    reposition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Панель — портал в document.body: клик по ней не входит в rootRef, проверяем отдельно.
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
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
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="bank-picker-panel"
          role="listbox"
          aria-multiselectable="true"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
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
        </div>,
        document.body,
      )}
    </div>
  );
}
