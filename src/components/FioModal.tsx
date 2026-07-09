import { useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../api/http';
import type { User } from '../types';

type Props = {
  me: User;
  onClose: () => void;
};

// Редактирование ФИО текущего пользователя в профиле.
export function FioModal({ me, onClose }: Props) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [last, setLast] = useState(me.lastName);
  const [first, setFirst] = useState(me.firstName);
  const [middle, setMiddle] = useState(me.middleName);
  const [bad, setBad] = useState<{ last?: boolean; first?: boolean }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const lastName = last.trim();
    const firstName = first.trim();
    if (!lastName || !firstName) {
      setBad({ last: !lastName, first: !firstName });
      return toast.error('Фамилия и имя обязательны');
    }
    setSaving(true);
    try {
      // middleName: '' сбрасывает отчество на сервере — так и передаём.
      await dispatch({ type: 'updateProfile', lastName, firstName, middleName: middle.trim() });
      toast.success('Профиль обновлён');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.field === 'lastName') { setBad({ last: true }); toast.error('Укажи фамилию'); }
      else if (e instanceof ApiError && e.field === 'firstName') { setBad({ first: true }); toast.error('Укажи имя'); }
      else if (e instanceof ApiError) toast.error(e.message);
      else toast.error('Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Изменить ФИО" onClose={onClose}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input
          className={'input' + (bad.last ? ' invalid' : '')}
          style={{ flex: 1, minWidth: 130 }}
          placeholder="Фамилия"
          value={last}
          onChange={(e) => { setLast(e.target.value); setBad((b) => ({ ...b, last: false })); }}
          autoFocus
        />
        <input
          className={'input' + (bad.first ? ' invalid' : '')}
          style={{ flex: 1, minWidth: 130 }}
          placeholder="Имя"
          value={first}
          onChange={(e) => { setFirst(e.target.value); setBad((b) => ({ ...b, first: false })); }}
        />
      </div>
      <div className="row">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Отчество (необязательно)"
          value={middle}
          onChange={(e) => setMiddle(e.target.value)}
        />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn chip-on sm" onClick={save} disabled={saving}>
          {saving ? '…' : 'Сохранить'}
        </button>
        <button type="button" className="link" onClick={onClose} disabled={saving}>Отмена</button>
      </div>
    </Modal>
  );
}
