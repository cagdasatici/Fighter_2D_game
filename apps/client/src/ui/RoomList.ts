import { roomIsFull, type RoomSummary } from '@kb/shared/net/rooms';
import { button, el } from './dom.js';
import { netErrorText } from './text.js';

/** Room list panel (copied from battlegrounds RoomList, restyled with dom.ts). */
export interface RoomListActions {
  list(): Promise<RoomSummary[]>;
  join(room: RoomSummary): Promise<void>;
}
export const ROOM_REFRESH_MS = 10_000;

export function roomLabel(r: RoomSummary): string {
  const bots = r.bots > 0 ? ` + CPU` : '';
  return `${r.name} · ${r.players}/${r.capacity} players${bots}`;
}

/** One in-flight request at a time; the refresh timer, listeners and DOM are removed on dispose. */
export function mountRoomList(root: HTMLElement, actions: RoomListActions): () => void {
  const list = el('ul', { class: 'kb-rooms' });
  const status = el('p', { class: 'kb-hint', role: 'status', 'aria-live': 'polite' });
  const refresh = button('Refresh', () => { void load(); }, { 'aria-label': 'Refresh room list' });
  const panel = el('div', { 'data-ui': 'room-list' }, [el('h3', {}, ['Rooms']), refresh, list, status]);
  let pending = false, disposed = false;
  let rooms: RoomSummary[] = [];
  const paint = (): void => {
    list.replaceChildren(...rooms.map(r => {
      const full = roomIsFull(r);
      const join = button(full ? 'Full' : 'Join', () => { void doJoin(r.roomCode); }, { 'data-join': r.roomCode });
      join.disabled = full || pending;
      return el('li', {}, [el('span', {}, [roomLabel(r)]), join]);
    }));
    refresh.disabled = pending;
    panel.setAttribute('aria-busy', String(pending));
  };
  const load = async (): Promise<void> => {
    if (pending || disposed) return;
    pending = true; paint();
    try {
      const next = await actions.list();
      if (disposed) return;
      rooms = next;
      status.textContent = rooms.length === 0 ? 'No rooms are open right now. Ask the host to create one.' : '';
    } catch (e) {
      if (!disposed) status.textContent = `Couldn't load rooms. ${netErrorText(e)}`;
    } finally { if (!disposed) { pending = false; paint(); } }
  };
  const doJoin = async (code: string): Promise<void> => {
    const room = rooms.find(r => r.roomCode === code);
    if (!room || pending || disposed) return;
    pending = true; status.textContent = 'Joining…'; paint();
    try { await actions.join(room); }
    catch (e) { if (!disposed) { status.textContent = netErrorText(e); void load(); } }
    finally { if (!disposed) { pending = false; paint(); } }
  };
  const timer = window.setInterval(() => { void load(); }, ROOM_REFRESH_MS);
  root.append(panel);
  void load();
  return () => { if (disposed) return; disposed = true; window.clearInterval(timer); panel.remove(); };
}
