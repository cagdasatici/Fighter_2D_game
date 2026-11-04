import { GAME_NAME } from "@kb/shared";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("missing #game canvas");
canvas.width = 640;
canvas.height = 360;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2d context unavailable");
ctx.fillStyle = "#1b1b2f";
ctx.fillRect(0, 0, 640, 360);
ctx.fillStyle = "#ffd84a";
ctx.font = "bold 48px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText(GAME_NAME, 320, 180);
