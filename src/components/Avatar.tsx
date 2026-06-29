import type { CSSProperties } from 'react';
import { userColor } from '../lib/avatar';
import { initial } from '../lib/format';

type Props = {
  id: string;
  name: string;
  size?: number;
  isMe?: boolean;
  style?: CSSProperties;
};

// Цветной круг с первой буквой display-имени. Цвет детерминирован по id участника.
export function Avatar({ id, name, size = 22, isMe = false, style }: Props) {
  return (
    <span
      className={'avatar' + (isMe ? ' me' : '')}
      style={{
        width: size,
        height: size,
        background: userColor(id),
        fontSize: Math.round(size * 0.45),
        ...style,
      }}
    >
      {initial(name)}
    </span>
  );
}
