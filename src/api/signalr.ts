// SignalR-хаб для realtime-обновлений поездки.
// Подключается к /hubs/trip, рассылает события trip:updated, expense:added и т.д.
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { getAccessToken } from './tokens';
import { refreshOnce } from './http';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5010';

// true, если JWT истёк или истекает в ближайшие 30с (или не парсится).
function isTokenExpiring(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 - Date.now() < 30_000;
  } catch {
    return true;
  }
}

// Отдаёт свежий access-токен для (пере)подключения хаба; рефрешит, если протух.
// Критично для reconnect: пассивный зритель не делает API-запросов, его токен
// истекает за 15 мин, и без рефреша негоциация reconnect падает в 401.
async function freshAccessToken(): Promise<string> {
  let at = getAccessToken();
  if (!at || isTokenExpiring(at)) {
    try {
      await refreshOnce();
    } catch {
      /* оставим что есть — пусть сервер решает */
    }
    at = getAccessToken();
  }
  return at ?? '';
}

export type FriendAcceptedPayload = {
  id: string;
  name: string;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  handle: string;
  email: string;
};

export type TripHubEvent =
  | { type: 'trip:updated'; payload: { id: string } }
  | { type: 'trip:deleted'; payload: { tripId: string } }
  | { type: 'trip:joined'; payload: { tripId: string } }
  | { type: 'expense:added'; payload: { tripId: string } }
  | { type: 'expense:removed'; payload: { tripId: string; expenseId: string } }
  | { type: 'member:added'; payload: { tripId: string; id: string; name: string } }
  | { type: 'participant:removed'; payload: { tripId: string; participantId: string } }
  | { type: 'event:added'; payload: { tripId: string } }
  | { type: 'event:removed'; payload: { tripId: string; eventId: string } }
  | { type: 'friend:accepted'; payload: FriendAcceptedPayload }
  | { type: 'friend:request'; payload: FriendAcceptedPayload };

let _connection: HubConnection | null = null;
const _handlers = new Set<(event: TripHubEvent) => void>();

function emit(event: TripHubEvent) {
  _handlers.forEach((h) => h(event));
}

export async function connectHub(): Promise<void> {
  // Уже подключены или подключаемся/переподключаемся — второй connect не нужен.
  if (_connection && _connection.state !== HubConnectionState.Disconnected) return;

  _connection = new HubConnectionBuilder()
    .withUrl(`${BASE}/hubs/trip`, {
      accessTokenFactory: () => freshAccessToken(),
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Information)
    .build();

  const events: TripHubEvent['type'][] = [
    'trip:updated', 'trip:deleted', 'trip:joined',
    'expense:added', 'expense:removed',
    'member:added', 'participant:removed',
    'event:added', 'event:removed',
    'friend:accepted', 'friend:request',
  ];

  for (const name of events) {
    _connection.on(name, (payload: unknown) => emit({ type: name, payload } as TripHubEvent));
  }

  const rejoinAll = () => {
    _activeTripIds.forEach((id) => _connection?.invoke('JoinTrip', id).catch(() => {}));
  };

  _connection.onreconnecting((err) => console.warn('[hub] reconnecting…', err?.message ?? ''));
  _connection.onreconnected((id) => {
    console.info('[hub] reconnected', id, 'rejoining', [..._activeTripIds]);
    rejoinAll();
  });
  _connection.onclose((err) => console.warn('[hub] closed', err?.message ?? 'clean'));

  await startWithRetry();
  // После установки соединения присоединяемся к поездкам, запрошенным до ready.
  rejoinAll();
}

// Первичный start() с ретраем: withAutomaticReconnect НЕ ретраит провал самого
// первого подключения, только уже установленное и потом упавшее.
async function startWithRetry(maxAttempts = 5): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await _connection!.start();
      console.info('[hub] connected');
      return;
    } catch (err) {
      if (attempt >= maxAttempts) {
        console.error('[hub] initial connect failed, giving up', err);
        return;
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 15_000);
      console.warn(`[hub] connect attempt ${attempt} failed, retry in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function disconnectHub(): Promise<void> {
  await _connection?.stop();
  _connection = null;
}

const _activeTripIds = new Set<string>();

export async function joinTrip(tripId: string): Promise<void> {
  _activeTripIds.add(tripId);
  if (_connection?.state === HubConnectionState.Connected) {
    await _connection.invoke('JoinTrip', tripId);
  }
}

export async function leaveTrip(tripId: string): Promise<void> {
  _activeTripIds.delete(tripId);
  if (_connection?.state === HubConnectionState.Connected) {
    await _connection.invoke('LeaveTrip', tripId);
  }
}

export function onHubEvent(handler: (event: TripHubEvent) => void): () => void {
  _handlers.add(handler);
  return () => _handlers.delete(handler);
}
