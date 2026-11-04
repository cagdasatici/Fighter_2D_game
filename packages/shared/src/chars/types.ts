export type Level = "mid" | "low" | "overhead";
export type MoveKind = "normal" | "command" | "special" | "super" | "throw";
export interface Box { x: number; y: number; w: number; h: number } // px, local space, (x,y) = bottom-left corner
export interface Invuln { from: number; to: number; kind: "full" | "strike" | "projectile" } // move frames, inclusive
export interface Velocity { frame: number; vx: number; vy: number | null } // set at move frame; vy null = unchanged; units/frame, vx forward
export interface HitDef {
  frames: [number, number];   // active move frames inclusive
  box: Box;
  damage: number; chip: number;
  hitstun: number; blockstun: number; hitstop: number;
  pushback: number;           // units total
  level: Level;
  knockdown: boolean;         // true: defender enters KNOCKDOWN after hitstun-free launch
  launch: { vx: number; vy: number } | null; // overrides knockdown trajectory
  meterOnHit: number;         // attacker meter gain on hit (block gives half)
}
export interface ProjectileDef {
  spawnFrame: number; offset: { x: number; y: number }; // px
  vx: number; vy: number; gravity: number;               // units
  w: number; h: number;                                    // px, centred
  hits: number; hitInterval: number; lifetime: number;
  damage: number; chip: number; hitstun: number; blockstun: number; hitstop: number; pushback: number;
  level: Level; knockdown: boolean; meterOnHit: number;
  kind: string;               // render key, e.g. "rivet", "spark"
  explodeOnGround: boolean;   // egg: becomes a 20-frame explosion hitbox w=80 h=60 on ground contact
}
export interface MoveDef {
  id: string; kind: MoveKind; name: string;
  input: { motion: "none" | "qcf" | "qcb" | "dp" | "dqcf" | "dd" | "spin" | "charge"; button: "LP" | "HP" | "LK" | "HK" | "P" | "K" | "LP+LK"; dir: number | null; stance: "stand" | "crouch" | "air" };
  startup: number; active: number; recovery: number;
  hits: HitDef[];
  projectile: ProjectileDef | null;
  velocities: Velocity[];
  invuln: Invuln[];
  hurtExtend: Box | null;     // extra hurtbox during active+recovery (makes whiffs punishable)
  cancelInto: ("special" | "super" | "chain")[]; // chain = LP->LP, LK->LK same-button rapid
  airborneFrames: [number, number] | null; // move frames during which fighter is airborne (rising specials)
  landingRecovery: number;    // for air moves / rising specials
  pose: string;               // animation key (render side, §9)
  sfx: string;                // render side
  heal: number;               // super heal, default 0
  grab: { range: number; damage: number; throwVx: number; throwVy: number } | null; // command grabs
  counter: { from: number; to: number; damage: number } | null; // parry stance
  gravityScale: number;       // % of GRAVITY while in this move, default 100
  lockOnHit: { hits: number; interval: number; damage: number; finalDamage: number; finalLaunch: { vx: number; vy: number } } | null; // supers that freeze positions after first hit (Bolt, Kaze)
}
export interface CharDef {
  id: "bolt" | "volt" | "chompa" | "kaze" | "bao";
  name: string; hp: number;
  walkFwd: number; walkBack: number;            // units/frame
  jumpVy: number; jumpVx: number;              // units/frame (vx used for 7/9 jumps)
  dashFwd: { frames: number; speed: number };   // 66 / 44 double-tap; speed units/frame
  dashBack: { frames: number; speed: number; invuln: number };
  pushWidth: number;                            // px, pushbox full width
  airJumpMax: number;                           // extra jumps in air (Kaze 1, others 0)
  hurt: { stand: Box; crouch: Box; air: Box };
  moves: MoveDef[];
}
export type CharId = CharDef["id"];
