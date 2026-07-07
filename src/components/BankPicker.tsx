import type { Bank } from '../types';

type Props = {
  banks: Bank[];
  selected: string[];
  onChange: (codes: string[]) => void;
  invalid?: boolean;
};

// Мультивыбор банков для СБП: чипы-переключатели. Список банков приходит из /banks,
// поэтому при добавлении новых банков на сервере фронт менять не нужно.
export function BankPicker({ banks, selected, onChange, invalid }: Props) {
  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  };

  if (banks.length === 0) {
    return <div className="hint">Загрузка списка банков…</div>;
  }

  return (
    <div className={'bank-picker' + (invalid ? ' invalid' : '')}>
      {banks.map((b) => {
        const on = selected.includes(b.code);
        return (
          <button
            key={b.code}
            type="button"
            className={'bank-chip' + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={() => toggle(b.code)}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
