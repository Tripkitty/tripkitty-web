import { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { plural } from '../../lib/format';
import { Avatar } from '../../components/Avatar';
import { GuestModal } from '../../components/GuestModal';
import { AddParticipantModal } from '../../components/AddParticipantModal';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../api/http';
import type { Guest, Participant, Trip, TripStatus, User } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idDisp: Record<string, string>;
  idSub: Record<string, string>;
  me: User;
  status: TripStatus;
};

export function Participants({ trip, ps, idDisp, idSub, me, status }: Props) {
  const { db, dispatch } = useStore();
  const toast = useToast();
  // null — модалка закрыта; { guest: null } — добавление, { guest } — редактирование.
  const [guestModal, setGuestModal] = useState<{ guest: Guest | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Подсчёт зафиксирован — добавление/удаление участников и гостей заблокировано
  // сервером (409 TRIP_SETTLING); редактирование профиля гостя разрешено.
  const canMutate = status === 'active';

  // Общий бюджет (§4.4): participantId → sponsorId.
  const sponsors = trip.sponsors ?? {};
  const isSponsoring = (pid: string) => Object.values(sponsors).includes(pid);
  // Превентивные проверки правил (сервер проверяет сам): взять можно, если ни у кого
  // из пары нет спонсора (цепочки запрещены) и участник сам никого не спонсирует.
  const canTake = (p: Participant) =>
    canMutate && !p.isMe && !sponsors[p.id] && !sponsors[me.id] && !isSponsoring(p.id);
  const canRelease = (p: Participant) => canMutate && sponsors[p.id] === me.id;

  const setSponsor = async (participantId: string, sponsorId: string | null) => {
    try {
      await dispatch({ type: 'setSponsor', tripId: trip.id, participantId, sponsorId });
      // Спонсорство по-расходное (§4.4): флаг — дефолт для НОВЫХ расходов,
      // уже внесённые сохраняют свой снапшот — предупреждаем явно.
      toast.info(
        sponsorId
          ? 'Общий бюджет включён — действует на новые расходы, уже внесённые не изменились'
          : 'Общий бюджет снят — уже внесённые расходы остались на спонсоре',
      );
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      toast.error(
        code === 'SPONSOR_TAKEN' ? 'За этого участника уже платит другой'
        : code === 'SPONSOR_CHAIN' ? 'Цепочки запрещены: либо за вас уже платят, либо участник сам платит за другого'
        : code === 'SPONSOR_SELF' ? 'Нельзя взять расходы на самого себя'
        : code === 'NOT_SPONSOR' ? 'Снять общий бюджет может только текущий спонсор'
        : code === 'TRIP_SETTLING' ? 'Подсчёт завершён — общий бюджет заблокирован'
        : sponsorId ? 'Не удалось взять расходы на себя' : 'Не удалось снять общий бюджет',
      );
    }
  };

  // Кнопки и бейдж общего бюджета — общие для строк аккаунтов и гостей.
  const sponsorActions = (p: Participant) => (
    <>
      {canTake(p) && (
        <button type="button" className="member-sponsor-btn" onClick={() => setSponsor(p.id, me.id)}>
          Взять расходы на себя
        </button>
      )}
      {canRelease(p) && (
        <button type="button" className="member-sponsor-btn" onClick={() => setSponsor(p.id, null)}>
          Снять общий бюджет
        </button>
      )}
    </>
  );
  const sponsorBadge = (p: Participant): string =>
    sponsors[p.id] ? `платит ${idDisp[sponsors[p.id]] ?? '…'}` : '';

  // Нет каскадного удаления на сервере: если участник фигурирует в расходах,
  // 409 PARTICIPANT_HAS_EXPENSES — показываем, какие расходы мешают удалению.
  const removeParticipant = async (participantId: string) => {
    try {
      await dispatch({ type: 'removeParticipant', tripId: trip.id, participantId });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TRIP_SETTLING') {
        toast.error('Подсчёт завершён — состав участников заблокирован');
      } else if (e instanceof ApiError && e.code === 'PARTICIPANT_IS_SPONSOR') {
        const ids = (e.details as { participantIds?: string[] } | null)?.participantIds ?? [];
        const names = ids.map((x) => idDisp[x]).filter(Boolean);
        toast.error(
          names.length
            ? `Участник платит за: ${names.join(', ')} — сначала снимите общий бюджет`
            : 'Участник платит за других — сначала снимите общий бюджет',
        );
      } else if (e instanceof ApiError && e.code === 'PARTICIPANT_HAS_EXPENSES') {
        const ids = (e.details as { expenseIds?: string[] } | null)?.expenseIds ?? [];
        const titles = trip.expenses
          .filter((exp) => ids.includes(exp.id))
          .map((exp) => exp.title);
        toast.error(
          titles.length
            ? `Сначала удалите или переназначьте расходы: ${titles.join(', ')}`
            : 'Нельзя удалить участника, пока на нём есть расходы',
        );
      } else {
        toast.error('Не удалось убрать участника');
      }
    }
  };

  // Есть ли у гостя реквизиты для перевода (детали — на экране редактирования/взаиморасчётов).
  const guestHasPay = (p: Participant): boolean =>
    !!trip.guests.find((g) => g.id === p.id)?.paymentDetails?.phone;

  // Подпись строки аккаунта: @handle + роли «вы» / «создатель» + общий бюджет.
  const userSub = (p: Participant): string => {
    const parts: string[] = [];
    const u = db.users[p.id];
    if (u && u.handle) parts.push('@' + u.handle);
    if (p.isMe) parts.push('вы');
    if (p.isOwner) parts.push('создатель');
    if (sponsorBadge(p)) parts.push(sponsorBadge(p));
    return parts.join(' · ');
  };

  // Две группы: участники с аккаунтом и гости.
  const accounts = ps.filter((p) => p.kind !== 'guest');
  const guests = ps.filter((p) => p.kind === 'guest');
  const countLabel =
    plural(accounts.length, 'участник', 'участника', 'участников') +
    (guests.length ? ` + ${plural(guests.length, 'гость', 'гостя', 'гостей')}` : '');

  return (
    <section className="trip-block">
      <div className="member-head">
        <label className="field-label">УЧАСТНИКИ</label>
        <span className="member-count">{countLabel}</span>
      </div>

      {/* Участники с аккаунтом */}
      <div className="member-group">
        <div className="member-group-head">
          <span>Зарегистрированные</span>
          {canMutate && (
            <button
              type="button"
              className="member-add-btn"
              onClick={() => setAddOpen(true)}
            >
              + участник
            </button>
          )}
        </div>
        <div className="member-list">
          {accounts.map((p) => (
            <div key={p.id} className="member-row">
              <Avatar id={p.id} name={p.name} size={34} isMe={p.isMe} />
              <div className="member-main">
                <div className="member-name">{idDisp[p.id]}</div>
                {userSub(p) && <div className="member-sub">{userSub(p)}</div>}
                {sponsorActions(p)}
              </div>
              {!p.isOwner && canMutate && (
                <button
                  type="button"
                  className="member-act remove"
                  title="Убрать участника"
                  onClick={() => removeParticipant(p.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Гости */}
      <div className="member-group">
        <div className="member-group-head">
          <span>Гости</span>
          {canMutate && (
            <button
              type="button"
              className="member-add-btn"
              onClick={() => setGuestModal({ guest: null })}
            >
              + гость
            </button>
          )}
        </div>
        {guests.length > 0 ? (
          <div className="member-list">
            {guests.map((p) => {
              const hasPay = guestHasPay(p);
              return (
                <div key={p.id} className="member-row">
                  <Avatar id={p.id} name={p.name} size={34} />
                  <div className="member-main">
                    <div className="member-name">
                      {idDisp[p.id]}
                      {idSub[p.id] && <span className="member-dis"> · {idSub[p.id]}</span>}
                    </div>
                    <div className="member-sub">
                      {hasPay ? '💳 реквизиты указаны' : 'нет реквизитов'}
                      {sponsorBadge(p) && ` · ${sponsorBadge(p)}`}
                    </div>
                    {sponsorActions(p)}
                  </div>
                  <button
                    type="button"
                    className="member-act"
                    title="Редактировать гостя"
                    onClick={() => {
                      const g = trip.guests.find((x) => x.id === p.id);
                      if (g) setGuestModal({ guest: g });
                    }}
                  >
                    ✎
                  </button>
                  {canMutate && (
                    <button
                      type="button"
                      className="member-act remove"
                      title="Убрать гостя"
                      onClick={() => removeParticipant(p.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hint">Гостей без аккаунта пока нет</div>
        )}
      </div>

      {guestModal && (
        <GuestModal trip={trip} guest={guestModal.guest} onClose={() => setGuestModal(null)} />
      )}

      {addOpen && (
        <AddParticipantModal trip={trip} me={me} onClose={() => setAddOpen(false)} />
      )}
    </section>
  );
}
