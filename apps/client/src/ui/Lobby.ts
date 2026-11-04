import { CHARS, type CharId } from '@kb/shared';
import { OPEN_PLAYER_NAMES, type LobbyMsg } from '@kb/shared/net/protocol';
import type { RoomSummary } from '@kb/shared/net/rooms';
import { ROSTER, STATS } from './CharSelect.js';
import { button, el, focusFirst, menuNav, screen } from './dom.js';
import { netErrorText } from './text.js';
import { mountRoomList } from './RoomList.js';

/** Spec §15 online entry: sign-in (invitation from `#invite=` or open join), then the room list. */
export interface OnlineLobbyActions {
  /** Throws ClientError('UNAUTHENTICATED') when there is no session. */
  list(): Promise<RoomSummary[]>;
  join(roomCode: string): Promise<void>;
  login(invite: string, name: string): Promise<void>;
  openLogin(name: string): Promise<boolean>;
  back(): void;
  /** Message shown on arrival (e.g. after a disconnect). */
  notice?: string | undefined;
}

/** Reads an invitation token from the page hash (`#invite=...`); never from the query string. */
export function inviteFromHash(hash: string): string | null {
  const m = /(?:^#|&)invite=([A-Za-z0-9_-]{8,128})(?:&|$)/.exec(hash);
  return m ? m[1]! : null;
}

export function showOnlineLobby(root: HTMLElement, a: OnlineLobbyActions): () => void {
  const body = el('div');
  const status = el('p', { class: 'kb-hint', role: 'status', 'aria-live': 'polite' }, [a.notice ?? 'Connecting…']);
  const panel = screen('Play Online', [body, status, el('div', { class: 'kb-actions' }, [button('Back', a.back)])], 'kb-wide');
  let closeList: (() => void) | null = null;
  let disposed = false;
  const showRooms = (): void => {
    body.replaceChildren();
    closeList = mountRoomList(body, { list: a.list, join: r => a.join(r.roomCode) });
  };
  const showSignIn = (): void => {
    closeList?.(); closeList = null;
    const invite = inviteFromHash(location.hash);
    const name = el('input', { class: 'kb-field', type: 'text', maxlength: '16', placeholder: 'Your name', 'aria-label': 'Your name' });
    const kids: Node[] = [el('p', {}, [invite ? 'You have an invitation. Enter a name to join.' : 'Pick a name to sign in.'])];
    if (invite) {
      const join = (): void => {
        const n = name.value.trim();
        if (n.length === 0) { status.textContent = 'Enter a name first.'; name.focus(); return; }
        void run(() => a.login(invite, n));
      };
      name.addEventListener('keydown', e => { if (e.code === 'Enter') { e.preventDefault(); join(); } });
      kids.push(el('div', { class: 'kb-row' }, [name, button('Join with Invitation', join)]));
    }
    kids.push(el('div', { class: 'kb-row kb-wrap' }, OPEN_PLAYER_NAMES.map(n => button(`Play as ${n}`, () => {
      void run(async () => { if (!(await a.openLogin(n))) throw { code: 'OPEN_JOIN_OFF' }; });
    }))));
    if (status.textContent === 'Connecting…') status.textContent = '';
    body.replaceChildren(...kids);
    focusFirst(body);
  };
  const run = async (f: () => Promise<void>): Promise<void> => {
    status.textContent = 'Signing in…';
    try { await f(); if (!disposed) { status.textContent = ''; showRooms(); } }
    catch (e) { if (!disposed) status.textContent = `Sign-in failed. ${netErrorText(e)}`; }
  };
  const probe = async (): Promise<void> => {
    try { await a.list(); if (!disposed) { if (status.textContent === 'Connecting…') status.textContent = ''; showRooms(); } }
    catch (e) {
      if (disposed) return;
      // No session yet is the normal first visit; anything else (server down, old build) is worth saying.
      const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: unknown }).code : '';
      if (code !== 'UNAUTHENTICATED' && !a.notice) status.textContent = netErrorText(e);
      showSignIn();
    }
  };
  root.replaceChildren(panel);
  void probe();
  const stopNav = menuNav(panel, { back: a.back });
  return () => { disposed = true; stopNav(); closeList?.(); panel.remove(); };
}

/** In-room panel: pick a fighter, ready up, or (lone host) add a server CPU (decision 0008). */
export interface RoomPanelActions { pick(c: CharId): void; ready(): void; addCpu(c: CharId): void; leave(): void }
export interface RoomPanel { update(m: LobbyMsg): void; close(): void }

export function slotText(s: LobbyMsg['slots'][number]): string {
  const who = s.bot ? 'CPU' : s.name;
  return `${who}: ${s.char ? CHARS[s.char].name : 'choosing…'}${s.ready ? ' · Ready!' : ''}`;
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
      el('span', {}, [hasCpu ? 'CPU fighter' : 'No one here yet? Add a CPU:']),
      ...ROSTER.map(id => button(CHARS[id].name, () => { cpuChar = id; a.addCpu(id); paint(); }, { class: `kb-btn${hasCpu && id === cpuChar ? ' kb-on' : ''}` })),
    ] : []));
  };
  paint();
  const waiting = el('p', { class: 'kb-hint', role: 'status', 'aria-live': 'polite' });
  const readyBtn = button('Ready', () => { a.ready(); });
  const paintWaiting = (): void => {
    waiting.textContent = slots.length < 2 ? 'Waiting for opponent… (or add a CPU above)'
      : slots.every(s => s.ready) ? 'Starting…'
      : slots.some(s => s.ready) ? 'Waiting for both players to be ready…' : 'The match starts when both players are ready.';
  };
  const panel = screen('Room', [el('h3', {}, ['Choose your fighter']), picks, el('h3', {}, ['Players']), slotList, cpuRow,
    el('div', { class: 'kb-menu' }, [readyBtn, button('Leave Room', a.leave)]), waiting], 'kb-wide');
  root.replaceChildren(panel);
  a.pick(mine);
  paintWaiting();
  const stopNav = menuNav(panel, { back: a.leave });
  return { update: m => { slots = m.slots; paint(); paintWaiting(); }, close: () => { stopNav(); panel.remove(); } };
}
