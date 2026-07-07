import { formatRuPhoneInput, ruPhoneDigits } from '../lib/format';

type Props = {
  value: string; // маскированная строка «+7 (999) 123-45-67» или ''
  onChange: (masked: string) => void;
  invalid?: boolean;
  placeholder?: string;
};

// Поле ввода телефона РФ с маской: пользователь набирает только цифры, «+7 (…)» и
// разделители подставляются автоматически, ввести произвольные символы нельзя.
export function PhoneInput({ value, onChange, invalid, placeholder }: Props) {
  const handle = (raw: string) => {
    let d = ruPhoneDigits(raw);
    // Пользователь стёр разделитель (строка короче, а набор цифр не изменился) —
    // трактуем как удаление последней цифры, иначе Backspace «застревал» бы на «)», «-».
    if (raw.length < value.length && d === ruPhoneDigits(value)) {
      d = d.slice(0, -1);
    }
    onChange(formatRuPhoneInput(d));
  };

  return (
    <input
      className={'input' + (invalid ? ' invalid' : '')}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder={placeholder ?? '+7 (900) 000-00-00'}
      value={value}
      onChange={(e) => handle(e.target.value)}
    />
  );
}
