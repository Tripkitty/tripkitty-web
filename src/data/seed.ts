import type { DB } from '../types';

// Демо-данные: пользователи @artyom / @anya / @danil / @vika (пароль у всех 1234)
// и демо-поездка «Поездка в Казань». Порт seedDb() из прототипа.
// TODO(auth): pass хранится в открытом виде только для прототипа — заменить на бэкенд.
export function seedDb(): DB {
  const users: DB['users'] = {
    u_artem: { id: 'u_artem', name: 'Артём', handle: 'artyom', email: 'me@trip.ru', pass: '1234', friends: ['u_anya', 'u_danil', 'u_vika'], incoming: [], outgoing: [] },
    u_anya: { id: 'u_anya', name: 'Аня', handle: 'anya', email: 'anya@trip.ru', pass: '1234', friends: ['u_artem', 'u_danil'], incoming: [], outgoing: [] },
    u_danil: { id: 'u_danil', name: 'Данил', handle: 'danil', email: 'danil@trip.ru', pass: '1234', friends: ['u_artem', 'u_anya'], incoming: [], outgoing: [] },
    u_vika: { id: 'u_vika', name: 'Вика', handle: 'vika', email: 'vika@trip.ru', pass: '1234', friends: ['u_artem'], incoming: [], outgoing: [] },
  };
  const trips: DB['trips'] = [
    {
      id: 't1',
      name: 'Поездка в Казань',
      cur: '₽',
      ownerId: 'u_artem',
      start: '2026-06-12',
      end: '2026-06-15',
      members: ['u_artem', 'u_anya', 'u_danil'],
      guests: [{ id: 'g_anya2', name: 'Аня' }],
      expenses: [
        { id: 'e1', title: 'Гостиница', amount: 9000, payer: 'u_artem', splitType: 0, share: [{ participantId: 'u_artem' }, { participantId: 'u_anya' }, { participantId: 'u_danil' }], createdBy: 'u_artem' },
        { id: 'e2', title: 'Такси', amount: 1200, payer: 'u_anya', splitType: 0, share: [{ participantId: 'u_artem' }, { participantId: 'u_anya' }], createdBy: 'u_anya' },
        { id: 'e3', title: 'Ужин', amount: 3600, payer: 'u_danil', splitType: 0, share: [{ participantId: 'u_artem' }, { participantId: 'u_anya' }, { participantId: 'u_danil' }], createdBy: 'u_danil' },
      ],
      events: [
        { id: 'pe1', title: 'Заселение в гостиницу', date: '2026-06-12', time: '14:00', endTime: '', createdBy: 'u_artem' },
        { id: 'pe2', title: 'Экскурсия по Кремлю', date: '2026-06-13', time: '11:00', endTime: '', createdBy: 'u_anya' },
        { id: 'pe3', title: 'Ужин в центре', date: '2026-06-13', time: '19:30', endTime: '', createdBy: 'u_danil' },
        { id: 'pe4', title: 'Выезд', date: '2026-06-15', time: '', endTime: '', createdBy: 'u_artem' },
      ],
    },
  ];
  return { users, trips };
}
