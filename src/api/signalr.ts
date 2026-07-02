// SignalR-хаб для realtime-обновлений поездки.
// Подключается к /hubs/trip, рассылает события trip:updated, expense:added и т.д.
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { getAccessToken } from './tokens';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5010';

export type FriendAcceptedPayload = { id: string; name: string; handle: string; email: string };

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
  if (_connection && _connection.state === HubConnectionState.Connected) return;

  _connection = new HubConnectionBuilder()
    .withUrl(`${BASE}/hubs/trip`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
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

  _connection.onreconnected(rejoinAll);

  await _connection.start();
  // После установки соединения присоединяемся к поездкам, запрошенным до ready.
  rejoinAll();
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
