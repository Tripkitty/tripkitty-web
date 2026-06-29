// SignalR-хаб для realtime-обновлений поездки.
// Подключается к /hubs/trip, рассылает события trip:updated, expense:added и т.д.
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { getAccessToken } from './tokens';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5010';

export type TripHubEvent =
  | { type: 'trip:updated'; payload: unknown }
  | { type: 'trip:deleted'; payload: { tripId: string } }
  | { type: 'expense:added'; payload: unknown }
  | { type: 'expense:removed'; payload: { expenseId: string } }
  | { type: 'member:added'; payload: { id: string; name: string } }
  | { type: 'participant:removed'; payload: { participantId: string } }
  | { type: 'event:added'; payload: unknown }
  | { type: 'event:removed'; payload: { eventId: string } };

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
    'trip:updated', 'trip:deleted',
    'expense:added', 'expense:removed',
    'member:added', 'participant:removed',
    'event:added', 'event:removed',
  ];

  for (const name of events) {
    _connection.on(name, (payload: unknown) => emit({ type: name, payload } as TripHubEvent));
  }

  _connection.onreconnected(() => {
    // Возобновить подписку на активные поездки после реконнекта.
    _activeTripIds.forEach((id) => _connection?.invoke('JoinTrip', id).catch(() => {}));
  });

  await _connection.start();
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
