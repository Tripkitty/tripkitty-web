# Бэкенд для «Делим счёт» — спецификация API и бизнес-логики

Документ описывает, какой бэкенд нужно реализовать, чтобы перевести приложение с
localStorage-прототипа на реальный API. Фронтенд уже спроектирован под эту замену:

- весь UI работает через интерфейс `Repository` (`src/data/repository.ts`) — заменяется на HTTP-клиент;
- каждая мутация — это `Action` (`src/store/actions.ts`), и эти экшены маппятся 1:1 на вызовы API;
- доменные алгоритмы вынесены в `src/lib/` (`settlements`, `participants`, `ics`, `migrate`, `format`) —
  часть из них (расчёт долгов, ICS, дедупликация `@handle`) переносится на сервер.

Цель миграции — серверная истина данных, аутентификация, авторизация по доступу к поездкам и
realtime-обновления вместо cross-tab `storage`-события.

---

## 1. Общие принципы

- **Транспорт:** REST/JSON поверх HTTPS. Все тела запросов/ответов — `application/json; charset=utf-8`.
- **Аутентификация:** JWT (access + refresh) либо серверная сессия в httpOnly-cookie. Все эндпоинты,
  кроме `/auth/*`, требуют авторизации. Текущий заголовок: `Authorization: Bearer <access>`.
- **Идентификаторы:** генерирует сервер. Сохраняем существующие префиксы для совместимости с фронтом:
  `u_*` (user), `g_*` (guest), произвольные id у trip/expense/event. Клиент больше **не** генерирует id
  для сущностей, которые создаёт сервер (user, guest, trip) — он получает их в ответе.
- **Ошибки:** единый формат
  ```json
  { "error": { "code": "HANDLE_TAKEN", "message": "Логин @anya уже занят", "field": "handle" } }
  ```
  `message` — на русском, готов к показу (фронт сейчас сам формирует тексты в `AuthPage`/`FriendsPage`;
  при переходе на API эти тексты отдаёт сервер). HTTP-коды: `400` валидация, `401` нет/протух токен,
  `403` нет доступа, `404` не найдено, `409` конфликт (занятый handle/email, дубль заявки), `422` бизнес-правило.
- **Конкурентность:** у `trip` ввести `version` (или `updatedAt`). Мутации принимают `If-Match`/`version`
  и при расхождении возвращают `409`; клиент перезапрашивает поездку. Это заменяет «последняя запись
  побеждает» из прототипа (где сохранялся весь `DB` целиком).
- **Realtime:** WebSocket (или SSE) — замена `Repository.subscribe`. Два потока событий:
  - персональный (заявки в друзья, изменения списка моих поездок);
  - по конкретной поездке (расходы, участники, события, даты) — для всех её members.
  Сервер шлёт инкрементальные события; клиент применяет их через тот же reducer (`externalDB`/точечные экшены).

---

## 2. Модель данных на сервере

Базируется на `src/types.ts`, с поправками под бэкенд:

| Сущность | Поля | Отличия от прототипа |
|---|---|---|
| **User** | `id`, `lastName`, `firstName`, `middleName?`, `name` (вычисляемое), `handle`, `email`, `friends[]`, `incoming[]`, `outgoing[]` | ФИО хранится 3 полями; `name` = «Имя Фамилия» вычисляется сервером и отдаётся во всех user-объектах. `pass` → **`passwordHash`** (bcrypt/argon2), наружу никогда не отдаётся. `email`/`handle` — уникальные индексы. |
| **Trip** | `id`, `name`, `cur`, `ownerId`, `start`, `end`, `members[]`, `guests[]`, `version`, `status` | добавлен `version`/`updatedAt` для оптимистичной блокировки; `status` — стадия подсчёта `active`/`settling`/`settled` (см. §3.5a). |
| **Guest** | `id` (`g_*`), `lastName`, `firstName`, `middleName?`, `name` (вычисляемое) | ФИО 3 полями, как у User. |
| **Expense** | `id`, `title`, `amount`, `payer`, `splitType`, `share[]`, `createdBy`, `isTransfer`, `grossAmount?`, `discountPercent?`, `discountAmount?`, `sponsors` | `splitType`: 0 — поровну, 1 — по частям, 2 — точные суммы. `share` — массив `{ participantId, weight?, amount? }`. `isTransfer: true` — служебный расход-перевод из reopen (§3.5a), read-only. `amount` хранить аккуратно (см. §4.4 про деньги). Скидка: `grossAmount` + один из `discountPercent`(0..100)/`discountAmount` (не оба сразу) — только для отображения «было/стало», `amount` уже содержит итог после скидки и делится через `share`; сервер проверяет `grossAmount - скидка == amount` (±0.01). `sponsors` — снапшот пар общего бюджета `{подопечный → спонсор}` этого расхода (см. §3.4); `{}` — каждый сам за себя. |
| **TripEvent** | `id`, `title`, `date`, `time`, `endTime`, `createdBy` | без изменений. |

**Граф друзей** (`friends`/`incoming`/`outgoing`) на сервере удобнее хранить отдельной таблицей рёбер
`friendship(user_a, user_b, status: pending|accepted, requested_by)` и проецировать в три массива при отдаче
пользователю — так проще держать инварианты (взаимность, отсутствие дублей).

**Тема** (`ThemeName`) — чистый UI-preference. Можно оставить на клиенте (localStorage) или хранить в
профиле (`GET/PUT /me/preferences`). Для бэкенда некритично; не блокирует миграцию.

---

## 3. Эндпоинты

Ниже сгруппировано по доменам. Справа — соответствующий `Action`/место в текущем коде.

### 3.1 Аутентификация

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `POST` | `/auth/register` | `{ lastName, firstName, middleName?, handle, email, password }` | Регистрация → создаёт User, возвращает `{ user, tokens }`. ← `register` + логика `AuthPage.register` |
| `POST` | `/auth/login` | `{ email, password }` | Вход → `{ user, tokens }`. ← `AuthPage.login` |
| `POST` | `/auth/refresh` | `{ refreshToken }` | Обновление access-токена. |
| `POST` | `/auth/logout` | — | Инвалидация сессии/refresh. ← `setSession(null)` |
| `GET` | `/auth/me` | — | Текущий пользователь по токену (бутстрап сессии при загрузке). |
| `PATCH` | `/auth/me` | `{ lastName?, firstName?, middleName? }` | Обновление ФИО. Опущенное/`null` — не менять; `middleName:""` — сброс отчества; пустой `lastName`/`firstName` → `400 VALIDATION_ERROR (field)`. Возвращает `{ user }`. ← `updateProfile` |

Валидация регистрации (порт из `AuthPage.register`, выполнять **на сервере**):
- `lastName`, `firstName` — непустые (trim); `middleName` опционален;
- `handle` — `^[a-z0-9_]{3,20}$`, привести к lowercase, срезать ведущие `@`, **уникален** → иначе `409 HANDLE_TAKEN`;
- `email` — формат `^\S+@\S+\.\S+$`, lowercase, **уникален** → иначе `409 EMAIL_TAKEN`;
- `password` — в прототипе ≥ 4 символа; на бэкенде поднять до разумного минимума (≥ 8) и хэшировать.

### 3.2 Пользователи и друзья

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/users/search?handle=<h>` | Поиск пользователя по точному `@handle`. ← `FriendsPage` поиск |
| `GET` | `/me/friends` | Списки: `friends`, `incoming`, `outgoing` (с `name`, `handle`). |
| `POST` | `/me/friends/requests` `{ handle }` или `{ userId }` | Отправить заявку. ← `friendRequest` |
| `POST` | `/me/friends/requests/{userId}/accept` | Принять входящую. ← `acceptFriend` |
| `POST` | `/me/friends/requests/{userId}/decline` | Отклонить входящую. ← `declineFriend` |
| `DELETE` | `/me/friends/{userId}` | Удалить из друзей (взаимно). ← `removeFriend` |

Правила отправки заявки (порт из `FriendsPage.add`):
- нельзя себе самому → `422`;
- уже в друзьях → `409`/`422 ALREADY_FRIENDS`;
- уже отправлена исходящая → `409 REQUEST_EXISTS`;
- **если есть встречная входящая заявка от этого пользователя — заявка сразу превращается в дружбу**
  (как `acceptFriend`), а не создаёт второй pending.

Инвариант взаимности: `accept` добавляет обе стороны в `friends` и чистит `incoming`/`outgoing`;
`remove` удаляет ребро у обоих. Это серверная транзакция, а не два независимых апдейта.

### 3.3 Поездки

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `GET` | `/trips` | — | Поездки, где я owner **или** member, по умолчанию только неархивные; `?archived=true` — только архивные (отдельный список). ← `TripsListPage` |
| `POST` | `/trips` | `{ name, cur }` | Создать. `ownerId = me`, `members = [me]`. ← `createTrip` |
| `GET` | `/trips/{id}` | — | Полная поездка (members, guests, expenses, events). ← `TripDetailPage` |
| `PATCH` | `/trips/{id}` | `{ name?, start?, end? }` | Переименование/даты. ← `renameTrip`, `setTripStart`, `setTripEnd` |
| `POST` | `/trips/{id}/clear` | — | Очистить: `expenses=[]`, `guests=[]`, зафиксированный подсчёт; `status` → `active` (members и даты остаются). ← `clearTrip` |
| `DELETE` | `/trips/{id}` | — | Удалить поездку. Отказывает `409 TRIP_HAS_EXPENSES`, если в поездке есть хоть один расход — сначала удалить расходы или очистить поездку через `/clear`. ← `deleteTrip`, обработка кода в `TripsListPage.tsx` |
| `POST` | `/trips/{id}/archive` | — | Архивировать (доступно любому участнику, ничем не блокируется). Ответ `{ trip }` (полный TripDetail), `isArchived: true`, шлёт `trip:updated`. ← `archiveTrip` |
| `POST` | `/trips/{id}/unarchive` | — | Разархивировать. Ответ `{ trip }`, `isArchived: false`, шлёт `trip:updated`. ← `unarchiveTrip` |

**Архивация** (CLIENT_API_GUIDE.md §3.6) — способ убрать завершённые поездки со списка активных, не удаляя
их; в отличие от `DELETE`, работает при любом количестве расходов. На архивную поездку по-прежнему можно
зайти через `GET /trips/{id}` и работать с ней как обычно. `TripSummary`/`TripDetail` несут поле `isArchived:
boolean`. Фронт при бутстрапе (`bootstrapFromApi`) грузит оба списка (`/trips` и `/trips?archived=true`) и
хранит все поездки в одном `db.trips` с флагом `isArchived` — фильтрация (табы «Активные»/«Архив») чисто
клиентская, в `TripsListPage`.

### 3.4 Участники

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `POST` | `/trips/{id}/members` | `{ userId }` | Добавить друга как участника (идемпотентно). ← `addMember` |
| `POST` | `/trips/{id}/guests` | `{ lastName, firstName, middleName? }` | Добавить гостя без аккаунта. Сервер генерит `g_*`, вычисляет `name` и возвращает `Guest`. ← `addGuest` |
| `PATCH` | `/trips/{id}/guests/{guestId}` | `{ lastName?, firstName?, middleName?, paymentDetails?, clearPayment? }` | Обновить ФИО/реквизиты гостя (любой участник; If-Match не нужен). ФИО — как у `/auth/me`. `paymentDetails` задан → задать/заменить; `clearPayment:true` (без `paymentDetails`) → сброс в `null`; ни того ни другого → не менять. Шлёт `trip:updated` по SignalR. ← `updateGuest` |
| `DELETE` | `/trips/{id}/participants/{participantId}` | — | Удалить участника (member или guest). ← `removeParticipant` |
| `PATCH` | `/trips/{id}/participants/{participantId}/sponsor` | `{ sponsorId }` | Общий бюджет: назначить себя спонсором участника (`sponsorId` = id вызывающего) или снять (`null`). Ответ — `{ trip }` (полный TripDetail), шлёт `trip:updated`. ← `setSponsor` / `Participants` |

**Удаление участника без каскада**: если участник фигурирует хоть в одном расходе (как `payer`,
в чьём-либо `share` или как спонсор в карте `sponsors` расхода, где подопечный реально участвует),
сервер отвечает `409 PARTICIPANT_HAS_EXPENSES` с `error.details.expenseIds` —
списком блокирующих расходов. Клиент должен сначала удалить/переназначить эти расходы
(`DELETE /trips/{id}/expenses/{expenseId}` либо `PATCH` с новым `payer`/`share`) и повторить удаление.
`removeParticipant` в `StoreContext.tsx` пробрасывает `ApiError`, UI (`Participants.tsx`) ловит
`PARTICIPANT_HAS_EXPENSES` и показывает названия блокирующих расходов тостом. Аналогично блокируется
удаление участника-спонсора: `409 PARTICIPANT_IS_SPONSOR`, `error.details.participantIds` — его подопечные.

**Общий бюджет (спонсор)** (CLIENT_API_GUIDE.md §4.4): у member/guest в DTO есть `sponsorId: string | null` —
id участника, который берёт его расходы на себя. Правила сервера: назначить спонсором можно только себя
(иначе `403 NOT_SPONSOR`; снять — только текущий спонсор), не себе (`422 SPONSOR_SELF`), цепочки запрещены
(`409 SPONSOR_CHAIN`), за участника уже платят (`409 SPONSOR_TAKEN`), в `settling`/`settled` — `409 TRIP_SETTLING`.
Расходы вводятся как обычно (подопечный может быть `payer` и участвовать в `share`).

**Спонсорство по-расходное, не глобальное**: флаг на участнике — дефолт для НОВЫХ расходов.
При создании расхода сервер снапшотит живое спонсорство поездки в `Expense.sponsors`
(`{подопечный → спонсор}`); включение/снятие флага уже внесённые расходы не трогает — они хранят
свой снапшот. Точечное исключение — PATCH расхода с полем `sponsors` (§3.5): пару можно убрать
или вернуть у конкретного расхода. В расчёте доля/платёж подопечного зачисляются спонсору только
в расходах с записанной парой; в переводы по покрытым расходам подопечный не попадает.
На фронте мапа `trip.sponsors` (`participantId → sponsorId`) собирается в `mapApiTripDetail`,
`Expense.sponsors` мапится в `mapApiExpense`; UI — бейдж «платит …» и кнопки взять/снять
в `Participants`, чипы пар в `NewExpense`/`ExpenseModal`, строки «из них за …» (покрытая часть
`ownBalances - balances`) в `Balances`, подпись «за X платит Y» в `ExpenseLog`.

Бизнес-правило для `addMember`: добавлять можно только из числа друзей (или участников, у кого есть доступ —
определить политику). Гостей может добавлять любой участник.

### 3.5 Расходы

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `POST` | `/trips/{id}/expenses` | `{ title, amount, payer, splitType, share[], grossAmount?, discountPercent?, discountAmount?, sponsors? }` | Добавить расход. `sponsors` не передан — сервер снапшотит живое спонсорство поездки; передан — как есть (только живые пары, иначе `422 INVALID_SPONSORS`); `{}` — каждый сам за себя. ← `addExpense` / `NewExpense` |
| `PATCH` | `/trips/{id}/expenses/{expenseId}` | как у `POST` (полная замена) | Отредактировать расход. Исключение — `sponsors`: не передан = оставить карту расхода как есть; передан — заменяет целиком (живые пары ПЛЮС уже записанные на расходе, иначе `422 INVALID_SPONSORS`). ← `editExpense` / `ExpenseModal` |
| `DELETE` | `/trips/{id}/expenses/{expenseId}` | — | Удалить. ← `removeExpense` |
| `GET` | `/trips/{id}/settlements` | — | `{ status, balances, ownBalances, transactions[] }` — балансы + минимальный набор переводов. `balances` — с учётом общих бюджетов (§3.4: доля подопечного в расходах с парой `sponsors` зачислена спонсору; непокрытый остаток висит на самом подопечном), `ownBalances` — персональные до переливаний (покрытая часть = `ownBalances - balances`). Каждый перевод несёт `toPayment` — реквизиты получателя (СБП), см. §3.8; после финализации ещё `id`/`isPaid`/`paidAt` (§3.5a). ← `useSettlements` |

Способы разбивки (`splitType`, элементы `share` — `{ participantId, weight?, amount? }`):
- `0` Equal — поровну между участниками `share` (поля `weight`/`amount` не нужны);
- `1` ByShares — пропорционально `weight` (все `weight` обязательны и `> 0`);
- `2` ByAmounts — точные суммы `amount` (все обязательны, `> 0`, их сумма = `amount` расхода ±0.01).

Валидация расхода (на сервере):
- `amount > 0`;
- `payer` — id участника **этой** поездки (member или guest);
- `share` — непустой, все id — участники этой поездки;
- `createdBy` проставляет сервер из токена (не доверять клиенту);
- скидка (необязательна): нельзя указать `discountPercent` и `discountAmount` одновременно;
  если указана скидка — `grossAmount` обязателен и `> 0`; `discountPercent` — `0..100`;
  `discountAmount` — `>= 0`; `grossAmount` минус скидка должен равняться `amount` ±0.01;
- `sponsors` (необязателен): при POST — только пары живого спонсорства поездки, при PATCH —
  живые пары плюс уже записанные на расходе; чужие пары → `422 INVALID_SPONSORS` (field `sponsors`).

`GET /settlements` переносит `src/lib/settlements.ts` на бэкенд: балансы (плательщику +amount, каждому из
`share` — его доля по `splitType`, округление до копеек) и жадная минимизация переводов. Можно считать на лету.

### 3.5a Финализация подсчёта

Жизненный цикл поездки: `active` → `settling` → `settled` (CLIENT_API_GUIDE.md §5.5).
Пока `active`, `/settlements` — предварительный расчёт (`id`/`isPaid`/`paidAt` у переводов — `null`).
В `settling`/`settled` мутации денег (расходы, участники, гости) → `409 TRIP_SETTLING`;
события, `PATCH /trips/{id}` и редактирование профиля гостя — разрешены.

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `POST` | `/trips/{id}/settlement` | — | Завершить подсчёт (только owner, иначе `403`): фиксирует переводы, `status` → `settling` (или сразу `settled`, если переводить нечего). Повторно — `409 ALREADY_FINALIZED`. ← `Settlements` |
| `PATCH` | `/trips/{id}/settlement/transactions/{txId}` | `{ paid }` | Отметить оплату/снять отметку. Может любой из концов перевода; за гостя — любой участник (чужой — `403`). До финализации — `409 NOT_FINALIZED`; неизвестный `txId` — `404 TRANSACTION_NOT_FOUND`. Все переводы оплачены → `status` `settled` автоматически. ← `Settlements` |
| `POST` | `/trips/{id}/settlement/reopen` | — | Переоткрыть подсчёт (только owner): `status` → `active`, неоплаченные переводы удаляются, оплаченные конвертируются в расходы-переводы (`isTransfer: true`, `title: "Перевод"`), чтобы уже переведённые деньги учлись в новом расчёте. ← `Settlements` |

Все три возвращают полный `{ settlements }` (формат `GET /settlements`). Расходы-переводы нельзя
редактировать/удалять → `409 TRANSFER_READONLY`. По SignalR при финализации/оплате/reopen рассылается
`settlement:updated` `{ tripId, settlements }` — клиент применяет снапшот в `useSettlements` без рефетча
(при reopen дополнительно перезагружает поездку — появились расходы-переводы).

### 3.6 Программа поездки (события)

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `POST` | `/trips/{id}/events` | `{ title, date, time, endTime }` | Добавить событие. ← `addEvent` |
| `DELETE` | `/trips/{id}/events/{eventId}` | — | Удалить. ← `removeEvent` |
| `GET` | `/trips/{id}/calendar.ics` | — | Экспорт программы в `.ics` (`text/calendar`). ← `src/lib/ics.ts` |

`calendar.ics` — порт `buildICS`: VEVENT на саму поездку (если задан `start`) + по событию на каждый
`TripEvent`, с экранированием и логикой all-day/таймслотов. Отдавать с
`Content-Disposition: attachment; filename="<name>.ics"`.

### 3.7 Realtime

| Канал | Назначение |
|---|---|
| `WS /ws` (после авторизации) | Персональные события: заявки в друзья, появление/удаление поездок. |
| подписка на `trip:{id}` | События по поездке для всех members: расходы, участники, события, даты, переименование. |

Заменяет `Repository.subscribe`. Сервер шлёт `{ type, payload }`, клиент применяет через reducer.
Минимально достаточно слать «измени поездку X» → клиент делает refetch `/trips/{id}`.

### 3.8 Реквизиты и способы оплаты (СБП)

Три уровня реквизитов `{ phone, banks[], label }` (`phone` нормализуется к `+7XXXXXXXXXX`, только RU →
иначе `INVALID_PHONE`; `banks` — непустой список кодов из `GET /banks` → иначе `INVALID_BANK`):

1. **Способы оплаты в профиле** — глобальный список пользователя.
2. **Override в поездке** — опциональные реквизиты поверх профиля; нет override → дефолт из профиля.
3. **Реквизиты гостя** — хранятся на госте (задаются при добавлении, `POST /trips/{id}/guests`).

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `GET` | `/banks` | — | Справочник банков `{ banks: [{ code, name }] }` (без авторизации). |
| `GET` | `/me/payment-methods` | — | Список способов `{ paymentMethods: [PaymentMethodDto] }`. |
| `POST` | `/me/payment-methods` | `{ phone, banks[], label?, isDefault? }` | Добавить способ. Первый становится дефолтным. |
| `PATCH` | `/me/payment-methods/{id}` | частичное | Изменить; `isDefault:true` снимает флаг с прочих. |
| `DELETE` | `/me/payment-methods/{id}` | — | Удалить; дефолт переходит к любому оставшемуся. |
| `GET` | `/trips/{id}/me/payment` | — | Эффективные реквизиты `{ payment, source }`, `source`: `trip`/`profile`/`none`. |
| `PATCH` | `/trips/{id}/me/payment` | `{ payment }` | Задать override; `payment:null` — сбросить к профилю. |

`PaymentMethodDto` = `{ id, phone, banks[], label, isDefault }`. Реквизиты к расходу **не** привязываются —
куда переводить, определяется на этапе взаиморасчётов по `toPayment` получателя в `GET /settlements` (§3.5).
Клиент: `src/api/api.ts` (`banks`, `paymentMethods`, `trips.getMyPayment/setMyPayment`), UI —
`PaymentMethods` (профиль), `MyTripPayment` (поездка), `BankPicker`, реквизиты гостя в `Participants`.

### 3.9 Что нового (What's New)

Плашка «что нового» после обновления. Контент задаётся на бэкенде статически; фронт сам решает,
показывать ли её, сравнивая версию с сохранённой локально.

| Метод | Путь | Тело | Назначение |
|---|---|---|---|
| `GET` | `/whats-new?since={version}` | — | `{ whatsNew: { latestVersion, releases[] } }` (без авторизации). Без `since` — вся история. |

`ReleaseDto` = `{ version, title, date?, items[] }`; `releases` отсортированы от новых к старым, `since`
отдаёт только релизы новее указанной версии. Паттерн клиента: последняя показанная версия — в
`localStorage` (`whatsNewSeenVersion`); первый запуск (ключа нет) — записать `latestVersion` и **не**
показывать; иначе `GET ?since={seen}`, при непустом `releases` — показать и записать `latestVersion`.
`items` рендерить как plain-текст, не HTML. Клиент: `whatsNew` в `src/api/api.ts`, хук `useWhatsNew`,
компонент `WhatsNew` (bottom sheet, монтируется в `AppLayout` для залогиненных).

---

## 4. Сквозная бизнес-логика

### 4.1 Авторизация доступа
- **Чтение/мутация поездки** (расходы, участники, гости, события, даты, переименование) — owner **или** member.
- **Удаление поездки** — только `ownerId`.
- **Удаление участника** — owner; самоудаление (member выходит из поездки) — разрешить.
- Любой эндпоинт под `/trips/{id}` сначала проверяет членство; иначе `403`/`404` (для приватности лучше `404`).

### 4.2 Дедупликация `@handle`
Порт `src/lib/migrate.ts` (`migrateHandles`): при импорте/бэкфилле пользователей без handle — генерировать
из локальной части email, санитизировать `[^a-z0-9_]`, добивать до 3+ символов, разрешать коллизии суффиксом.
На «зелёном» бэкенде это нужно только для миграции существующих данных прототипа; в обычном потоке handle
задаётся при регистрации и проверяется на уникальность.

### 4.3 Отображение имён и дизамбигуация
`disp()` (только первое слово) и `disambiguate()` (`src/lib/participants.ts`) — **презентационная** логика,
остаётся на клиенте. Сервер отдаёт полный `name` и `handle`; решение, как показывать, принимает фронт.

### 4.4 Деньги
`amount` сейчас `number` с округлением до копеек в расчётах. На бэкенде хранить как целое число
минимальных единиц (копейки/центы) либо `decimal`, чтобы избежать ошибок float. Алгоритм settlements
округляет до 2 знаков и отсекает «пыль» < 0.005 — сохранить это поведение, чтобы цифры совпадали с прототипом.

---

## 5. Что меняется на фронте

1. Реализовать `HttpRepository implements Repository` (`src/data/`): `loadDB/saveDB` → REST,
   `subscribe` → WebSocket. На первом этапе можно сохранить «толстый» `DB`-снимок (бутстрап `GET /trips` +
   `GET /auth/me`), затем перейти на точечные запросы.
2. `loadSession/saveSession` → хранение токена (httpOnly-cookie предпочтительнее localStorage).
3. Экшены (`src/store/actions.ts`) остаются формой описания мутации, но dispatch начинает уходить в API;
   reducer применяет либо оптимистичный апдейт, либо ответ сервера/realtime-событие.
4. Тексты ошибок: переиспользовать серверные `message` вместо хардкода в `AuthPage`/`FriendsPage`.
5. `exportICS` может перестать строить файл в браузере и просто открывать `GET /trips/{id}/calendar.ics`.

## 6. Рекомендуемый порядок реализации

1. **Auth** (`/auth/*`) + модель User с хэшем пароля + JWT.
2. **Trips CRUD** + авторизация доступа + `GET /trips`.
3. **Участники и расходы** + блокировка удаления участника с расходами (`409 PARTICIPANT_HAS_EXPENSES`) + `GET /settlements`.
4. **Друзья** (граф, заявки, авто-accept встречной заявки).
5. **События** + `calendar.ics`.
6. **Realtime** (WS) вместо cross-tab подписки.
7. **Миграция данных** прототипа (handle-бэкфилл, импорт seed при необходимости).

> Все алгоритмы, помеченные «порт», должны давать **тот же результат**, что и текущие функции в `src/lib/` —
> это позволит сверять бэкенд с эталонным поведением прототипа из `design_handoff_split_app`.
