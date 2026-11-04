import { CHARS, type CharId } from '@kb/shared';
import { OPEN_PLAYER_NAMES, type LobbyMsg } from '@kb/shared/net/protocol';
import type { RoomSummary } from '@kb/shared/net/rooms';
import { ROSTER, STATS } from './CharSelect.js';
import { button, el, screen } from './dom.js';
import { mountRoomList } from './RoomList.js';

/** Spec §15 online entry: sign-in (invitation from `#invite=` or open join), then the room list. */
export interface OnlineLobbyActions {
  /** Throws ClientError('UNAUTHENTICATED') when there is no session. */
  list(): Promise<RoomSummary[]>;
  join(roomCode: string): Promise<void>;
  login(invite: string, name: string): Promise<void>;
  openLogin(name: string): Promise<boolean>;
  back(): void;
}

/** Reads an invitation token from the page hash (`#invite=...`); never from the query string. */
export function inviteFromHash(hash: string): string | null {
  const m = /(?:^#|&)invite=([A-Za-z0-9_-]{8,128})(?:&|$)/.exec(hash);
  return m ? m[1]! : null;
}

export function showOnlineLobby(root: HTMLElement, a: OnlineLobbyActions): () => void {
  const body = el('div');
  const status = el('p', { class: 'kb-hint', role: 'status' });
  const panel = screen('Play Online', [body, status, button('Back', a.back)], 'kb-wide');
  let closeList: (() => void) | null = null;
  let disposed = false;
  const showRooms = (): void => {
    body.replaceChildren();
    closeList = mountRoomList(body, { list: a.list, join: r => a.join(r.roomCode) });
  };
  const showSignIn = (): void => {
    closeList?.(); closeList = null;
    const invite = inviteFromHash(location.hash);
    const name = el('input', { class: 'kb-field', maxlength: '16', placeholder: 'Display name', 'aria-label': 'Display name' });
    const kids: Node[] = [el('p', {}, ['Sign in to see rooms.'])];
    if (invite) kids.push(el('div', { class: 'kb-row' }, [name, button('Join with invitation', () => { void run(() => a.login(invite, name.value.trim())); })]));
    kids.push(el('div', { class: 'kb-row' }, OPEN_PLAYER_NAMES.map(n => button(`Play as ${n}`, () => {
      void run(async () => { if (!(await a.openLogin(n))) throw new Error('open join is off'); });
    }))));
    body.replaceChildren(...kids);
  };
  const run = async (f: () => Promise<void>): Promise<void> => {
    status.textContent = 'Signing in…';
    try { await f(); if (!disposed) { status.textContent = ''; showRooms(); } }
    catch { if (!disposed) status.textContent = 'Sign-in failed. Ask the host for an invitation link.'; }
  };
  const probe = async (): Promise<void> => {
    try { await a.list(); if (!disposed) showRooms(); }
    catch { if (!disposed) showSignIn(); }
  };
  root.replaceChildren(panel);
  void probe();
  return () => { disposed = true; closeList?.(); panel.remove(); };
}

/** In-room panel: pick a fighter, ready up, or (lone host) add a server CPU (decision 0008). */
export interface RoomPanelActions { pick(c: CharId): void; ready(): void; addCpu(c: CharId): void; leave(): void }
export interface RoomPanel { update(m: LobbyMsg): void; close(): void }

export function slotText(s: LobbyMsg['slots'][number]): string {
  const who = s.bot ? 'CPU' : s.name;
  return `${who}: ${s.char ? CHARS[s.char].name : 'choosing…'}${s.ready ? ' (ready)' : ''}`;
}

export function showRoomPanel(root: HTMLElement, initial: CharId, a: RoomPanelActions): RoomPanel {
  let mine: CharId = initial;
  let cpuChar: CharId = ROSTER[(ROSTER.indexOf(initial) + 1) % ROSTER.length]!;
  let slots: LobbyMsg['slots'] = [];
  const picks = el('div', { class: 'kb-picks' });
  const slotList = el('div');
  const cpuRow = el('div', { class: 'kb-row' });
  const paint = (): void => {
    picks.replaceChildren(...ROSTER.map(id => button(`${CHARS[id].name} · ${STATS[id].tag}`, () => { mine = id; a.pick(id); paint(); },
      { class: `kb-btn${id === mine ? ' kb-on' : ''}` })));
    slotList.replaceChildren(...slots.map(s => el('p', { class: 'kb-slot' }, [slotText(s)])));
    const alone = slots.length === 1 && !slots[0]!.bot;
    const hasCpu = slots.some(s => s.bot);
    cpuRow.replaceChildren(...(alone || hasCpu ? [
      el('span', {}, ['CPU opponent']),
      ...ROSTER.map(id => button(CHARS[id].name, () => { cpuChar = id; a.addCpu(id); paint(); }, { class: `kb-btn${hasCpu && id === cpuChar ? ' kb-on' : ''}` })),
    ] : []));
  };
  paint();
  const panel = screen('Room', [el('h3', {}, ['Choose your fighter']), picks, slotList, cpuRow,
    el('div', { class: 'kb-menu' }, [button('Ready', a.ready), button('Leave room', a.leave)]),
    el('p', { class: 'kb-hint' }, ['The match starts when both players are ready.'])], 'kb-wide');
  root.replaceChildren(panel);
  a.pick(mine);
  return { update: m => { slots = m.slots; paint(); }, close: () => panel.remove() };
}
