// 生成「哑铃肩外旋」的示范图线稿(本仓库自绘,非上游素材)
// 用法:node scripts/draw-shoulder-external-rotation.mjs [输出目录]
// 默认写入 public/exercises/shoulder-external-rotation/frame-{1,2}.svg
// 上游插画库(workout-guide/Everkinetic)没有肩外旋/古巴旋转,所以这个动作由这里出图:
//   frame-1 = 内旋起始(前臂向下) / frame-2 = 外旋终点(前臂向上)
// 改比例或姿势就改下面的骨架,重跑本脚本即可(不要手改生成的 SVG)。

import fs from "node:fs";

const R = (n) => Number(n.toFixed(1));
const P = (x, y) => `${R(x)},${R(y)}`;

/** 折线外轮廓(圆角连接 + 两端圆帽);widths 是各段直径 */
const outline = (pts, widths) => {
  const rs = widths.map((w) => w / 2);
  const segs = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1;
    segs.push({ x1, y1, x2, y2, nx: -dy / L, ny: dx / L });
  }
  const sweep = (a, b) => (a.nx * b.ny - a.ny * b.nx > 0 ? 0 : 1);

  let d = `M${P(pts[0][0] + segs[0].nx * rs[0], pts[0][1] + segs[0].ny * rs[0])}`;
  segs.forEach((s, i) => {
    d += ` L${P(s.x2 + s.nx * rs[i], s.y2 + s.ny * rs[i])}`;
    if (i < segs.length - 1) {
      const next = segs[i + 1];
      d += ` A${R(rs[i])},${R(rs[i])} 0 0 ${sweep(s, next)} ${P(next.x1 + next.nx * rs[i + 1], next.y1 + next.ny * rs[i + 1])}`;
    }
  });
  const last = segs[segs.length - 1];
  const rl = rs[rs.length - 1];
  d += ` A${R(rl)},${R(rl)} 0 0 0 ${P(last.x2 - last.nx * rl, last.y2 - last.ny * rl)}`;
  for (let i = segs.length - 1; i >= 0; i -= 1) {
    const s = segs[i];
    d += ` L${P(s.x1 - s.nx * rs[i], s.y1 - s.ny * rs[i])}`;
    if (i > 0) {
      const prev = segs[i - 1];
      d += ` A${R(rs[i])},${R(rs[i])} 0 0 ${sweep(s, prev)} ${P(prev.x2 - prev.nx * rs[i - 1], prev.y2 - prev.ny * rs[i - 1])}`;
    }
  }
  d += ` A${R(rs[0])},${R(rs[0])} 0 0 1 ${P(pts[0][0] + segs[0].nx * rs[0], pts[0][1] + segs[0].ny * rs[0])} Z`;
  return d;
};

const TORSO =
  "M190,150 C212,138 300,138 322,150 C330,176 320,212 312,242 C308,264 316,288 314,306 " +
  "C282,318 230,318 198,306 C196,288 204,264 200,242 C192,212 182,176 190,150 Z";

// 骨架:正面视角,右臂(画面左侧)外展 90 度、肘屈 90 度
const body = [
  { d: "M256,88 m-34,0 a34,34 0 1,0 68,0 a34,34 0 1,0 -68,0" }, // 头
  { d: outline([[256, 116], [256, 150]], [22, 22]) }, // 颈
  { d: TORSO }, // 躯干
  { d: outline([[244, 312], [236, 404], [232, 438]], [48, 34, 30]) }, // 左腿
  { d: outline([[268, 312], [276, 404], [280, 438]], [48, 34, 30]) }, // 右腿
  { d: outline([[232, 442], [202, 450]], [30, 26]) }, // 左脚
  { d: outline([[280, 442], [310, 450]], [30, 26]) }, // 右脚
  { d: outline([[318, 172], [344, 246], [350, 296]], [42, 32, 26]) }, // 垂在身侧的手臂
  { d: outline([[198, 170], [112, 170]], [42, 38]) }, // 外展的上臂
];

/** forearmEnd: 前臂末端 y 坐标(手的位置) */
const buildFrame = (forearmEnd) => {
  const elbow = [112, 170];
  const hand = [112, forearmEnd];
  const barY = forearmEnd;
  return [
    ...body.map((b) => `<path d="${b.d}"/>`),
    `<path d="${outline([elbow, hand], [34, 28])}"/>`, // 前臂,末端圆帽即手
    `<path d="${outline([[76, barY], [148, barY]], [8, 8])}"/>`, // 哑铃横杆,穿过手掌
    `<path d="${outline([[76, barY - 14], [76, barY + 14]], [13, 13])}"/>`, // 铃片
    `<path d="${outline([[148, barY - 14], [148, barY + 14]], [13, 13])}"/>`,
  ].join("");
};

const svg = (content) =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
  `<g fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round">${content}</g></svg>\n`;

const outDir = process.argv[2] ?? "public/exercises/shoulder-external-rotation";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/frame-1.svg`, svg(buildFrame(268))); // 内旋:前臂向下
fs.writeFileSync(`${outDir}/frame-2.svg`, svg(buildFrame(72))); // 外旋:前臂向上
console.log("wrote", `${outDir}/frame-1.svg`, `${outDir}/frame-2.svg`);
