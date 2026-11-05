import type { CpuDifficulty, StageId } from '@kb/shared';

/** TXT: display copy shared by the menus. Pure (no DOM) so it is unit-tested. Ids never reach the screen. */

export const STAGE_NAMES: Readonly<Record<StageId, string>> = { rooftop: 'Rooftop', bamboo: 'Bamboo Grove', volcano: 'Volcano' };
export function stageName(id: StageId): string { return STAGE_NAMES[id] ?? id; }

export const DIFFICULTY_INFO: Readonly<Record<CpuDifficulty, { name: string; blurb: string }>> = {
  easy: { name: 'Easy', blurb: 'Slow reactions, rarely blocks, no combos.' },
  normal: { name: 'Normal', blurb: 'Blocks half the time and punishes mistakes.' },
  hard: { name: 'Hard', blurb: 'Quick reactions, blocks most attacks, combos.' },
};

export type ActionId = 'up' | 'down' | 'left' | 'right' | 'LP' | 'HP' | 'LK' | 'HK' | 'SP' | 'SU';
export const ACTION_NAMES: Readonly<Record<ActionId, string>> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', LP: 'Light Punch', HP: 'Heavy Punch', LK: 'Light Kick', HK: 'Heavy Kick', SP: 'Special (SP)', SU: 'Super',
};

const KEY_SPECIAL: Readonly<Record<string, string>> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Backspace: 'Backspace',
  ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt',
  MetaLeft: 'L Cmd', MetaRight: 'R Cmd', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', NumpadEnter: 'Num Enter',
};
/** KeyboardEvent.code → short label: "KeyW"→"W", "Digit1"→"1", "Numpad4"→"Num 4", "ArrowUp"→"↑". */
export function keyLabel(code: string): string {
  const special = KEY_SPECIAL[code];
  if (special) return special;
  const m = /^(?:Key|Digit)(.+)$/.exec(code);
  if (m) return m[1]!;
  const n = /^Numpad(.+)$/.exec(code);
  if (n) return `Num ${n[1]}`;
  return code;
}

/** Client error codes (net/RoomClient ClientErrorCode) → player-facing sentence. */
export type NetErrorCode = 'SERVER_OFFLINE' | 'VERSION_MISMATCH' | 'INVITE_INVALID' | 'UNAUTHENTICATED' | 'ROOM_FULL' | 'OPEN_JOIN_OFF';
export const NET_ERRORS: Readonly<Record<NetErrorCode, string>> = {
  SERVER_OFFLINE: "Can't reach the game server. Check the host is running and you're on the same network.",
  VERSION_MISMATCH: 'This game is out of date. Reload the page to get the latest version.',
  INVITE_INVALID: 'That invitation link has expired or was already used. Ask the host for a new one.',
  UNAUTHENTICATED: 'Your session ended. Sign in again.',
  ROOM_FULL: 'That room is full. Pick another room or try again in a moment.',
  OPEN_JOIN_OFF: 'Quick sign-in is off on this server. Ask the host for an invitation link.',
};
export function netErrorText(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  return (NET_ERRORS as Record<string, string>)[code] ?? 'Something went wrong. Try again.';
}
export const DISCONNECTED_TEXT = 'Disconnected from the room. Check your connection and join again.';
