import { useState, type KeyboardEvent } from 'react';
import { Modal } from './Modal';
import { useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import type { Trip, TripEvent } from '../types';

type Props = {
  trip: Trip;
  event: TripEvent;
  onClose: () => void;
};

export function EventModal({ trip, event, onClose }: Props) {
  const { dispatch } = useStore();
  const toast = useToast();

  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time || '');
  const [endTime, setEndTime] = useState(event.endTime || '');
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const clearBad = (k: string) => setBad((b) => (b[k] ? { ...b, [k]: false } : b));

  const submit = async () => {
    const t = title.trim();
    if (!date) {
      setBad({ date: true });
      return toast.error('Укажи дату события');
    }
    if (!t) {
      setBad({ title: true });
      return toast.error('Назови событие');
    }
    let end = endTime;
    if (end && !time) end = ''; // конец игнорируется без начала

    setSaving(true);
    try {
      await dispatch({
        type: 'editEvent',
        tripId: trip.id,
        event: { ...event, title: t, date, time, endTime: end },
      });
      toast.success('Событие обновлено');
      onClose();
    } catch {
      toast.error('Не удалось сохранить событие');
    } finally {
      setSaving(false);
    }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') submit(); };

  return (
    <Modal title="Редактировать событие" onClose={onClose}>
      <label className="field-label">Название</label>
      <input
        className={'input' + (bad.title ? ' invalid' : '')}
        placeholder="Музей, ужин, выезд…"
        value={title}
        onChange={(e) => { setTitle(e.target.value); clearBad('title'); }}
        onKeyDown={onKey}
        autoFocus
      />

      <div className="row">
        <input
          className={'input' + (bad.date ? ' invalid' : '')}
          style={{ flex: 1, minWidth: 130 }}
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); clearBad('date'); }}
        />
        <div className="time-range">
          <input className="input mono" type="time" lang="ru" value={time} onChange={(e) => setTime(e.target.value)} />
          <span style={{ color: 'var(--muted)' }}>–</span>
          <input className="input mono" type="time" lang="ru" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 4 }}>
        <button type="button" className="btn chip-on sm" onClick={submit} disabled={saving}>
          {saving ? '…' : 'Сохранить'}
        </button>
        <button type="button" className="link" onClick={onClose} disabled={saving}>Отмена</button>
      </div>
    </Modal>
  );
}
