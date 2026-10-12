import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
const SKILL = join(homedir(), ".claude/skills/anatomy");
const k = await import(join(SKILL, "kit/iso-kit.mjs"));
const G = await import(join(SKILL, "kit/lathe.mjs"));
const A = await import(join(SKILL, "kit/audit.mjs"));
const { turning } = await import(join(SKILL, "kit/turn-build.mjs"));
const TA = await import(join(SKILL, "kit/turn-audit.mjs"));
const { turnScript, glScript } = await import(join(SKILL, "scripts/inline-kit.mjs"));
const { glCamera } = await import(join(SKILL, "kit/gl.mjs"));
import { M, throwX, cylX, axisOf, follow, ORDER, FIRING, fireOf, torqueOf, liftOf } from "./model.mjs";
import { catalogue } from "./atlas.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";

const WIDTH = 760;
const HEIGHT = 560;
const AZIMUTH = 38;
const ELEVATION = 30;
const H = M.H;
const PLATTER_R = 168;
const PLINTH_R = 184;
const PLINTH = [-40, -6]; // plinth z range; the platter sits on it from -6 to 0
const FACET = (AZIMUTH * Math.PI) / 180; // the plinth facet that faces the camera carries the torque screen
const CIRCUM = 200;
const APOTHEM = CIRCUM * Math.cos(Math.PI / 8);
const OCT = Array.from({ length: 8 }, (_, j) => [CIRCUM * Math.cos(FACET + Math.PI / 8 + (j * Math.PI) / 4), CIRCUM * Math.sin(FACET + Math.PI / 8 + (j * Math.PI) / 4)]);

// ── the engine's layout, in world units (1 = 2 mm) ────────────────────────────
const X = (i) => throwX(i);
const WEB = [10.8, 18.8]; // web faces from the throw centre
const JOURNAL_R = 17;
const BIG_R = 17.5;
const DECK = 65; // top of the bulkheads along each bank axis
const HEAD = [125.6, 140]; // the head along the bank axis
const COVER = [140, 152];
const HALF = 30; // half the width of the bank across its axis
const journal = (j) => [X(j) + WEB[1], X(j + 1) - WEB[1]]; // j = 0..6, with X(0) and X(7) one pitch out
const bulkhead = (j) => {
  const [a, b] = journal(j);
  return [a + 0.3, b - 0.3];
};
const plateA = (i) => (i === 0 ? [X(1) - 33.6, X(1) - 29.6] : [X(i) + 19.4, X(i) + 23.4]);
const plateB = (i) => (i === 0 ? [X(1) - 23.1, X(1) - 19.1] : [X(i) + 29.6, X(i) + 33.6]);
const BANK_X = [
  [plateA(0)[0], plateA(6)[1]],
  [plateB(0)[0], plateB(6)[1]],
];
const ENGINE_X = [bulkhead(0)[0], bulkhead(6)[1]];

export const P = k.fitProjection(
  [
    ...Array.from({ length: 24 }, (_, j) => [CIRCUM * Math.cos((j / 24) * Math.PI * 2), CIRCUM * Math.sin((j / 24) * Math.PI * 2), PLINTH[0] - 6]),
    ...Array.from({ length: 24 }, (_, j) => [192 * Math.cos((j / 24) * Math.PI * 2), 192 * Math.sin((j / 24) * Math.PI * 2), H + 166]),
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

export const R = A.recorder(P);
const put = (item) => R.put({ ...item, shapes: item.shapes.map((shape, index) => R.solid(Object.assign(shape, { name: shape.name ?? (index ? `${item.name}#${index + 1}` : item.name) }))) });

// ── frames ────────────────────────────────────────────────────────────────────
const O = [0, 0, H];
const XF = (x = 0) => ({ o: [x, 0, H], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }); // polygons in (y, z) about the crank axis
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const yz = (bank, s, l) => {
  const d = axisOf(bank);
  return [s * d[1] - l * d[2], s * d[2] + l * d[1]];
};
const bankQuad = (bank, [s0, s1], half) => [yz(bank, s0, -half), yz(bank, s0, half), yz(bank, s1, half), yz(bank, s1, -half)];
const AXF = (x, bank) => {
  const d = axisOf(bank);
  return { o: [x, 0, H], a: d, u: [1, 0, 0], v: [0, -d[2], d[1]] };
};

// ── the stand: a plinth with a degree ring (static) and a turntable (live) ──────
function plinth() {
  const z0 = PLINTH[0];
  const top = PLINTH[1];
  const h = top - z0;
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(OCT.map(([x, y]) => [x * 0.86, y * 0.86]).filter((_, j) => j % 2 === 0))) {
    const fz = z0 - 6;
    const svg = S(k.cylinder(x, y, 14, fz, 1.8, P, 32), { tone: "lo" }) + S(k.cylinder(x, y, 11, fz + 1.8, 4.2, P, 32), { tone: "mid", crease: "none" });
    put({ name: `stand.foot.${Math.round(x)}.${Math.round(y)}`, layer: "back", at: [x, y, fz], svg, shapes: [A.cylinder(x, y, 14, fz, 1.8, { ground: true }), A.cylinder(x, y, 11, fz + 1.8, 4.2)] });
  }
  const ticks = k.radialTicks(0, 0, PLATTER_R + 12.4, 72, 6, top, [3.2, 10], P);
  const rings = L(k.ring(0, 0, PLATTER_R + 12.4, top, P, 180), { tone: "lo" }) + L(k.ring(0, 0, PLATTER_R + 2.4, top, P, 180), { tone: "faint" });
  const screws = OCT.map(([x, y]) => [x * 0.93, y * 0.93]);
  const inner = L(k.ringSeam(OCT, z0 + 5, P), { tone: "faint" });
  const body = S(k.extrude(OCT, z0, h, P, { bevel: 1.2 }), { tone: "mid", inner });
  // the torque screen on the facet that faces the camera
  const n = [Math.cos(FACET), Math.sin(FACET)];
  const c = [APOTHEM * n[0], APOTHEM * n[1]];
  let right = [n[1], -n[0]];
  if (at([c[0] + right[0], c[1] + right[1], top])[0] < at([c[0], c[1], top])[0]) right = [-right[0], -right[1]];
  const o = at([c[0], c[1], top]);
  const ex = at([c[0] + right[0], c[1] + right[1], top]);
  const dn = at([c[0], c[1], top - 1]);
  const matrix = `matrix(${(ex[0] - o[0]).toFixed(5)} ${(ex[1] - o[1]).toFixed(5)} ${(dn[0] - o[0]).toFixed(5)} ${(dn[1] - o[1]).toFixed(5)} ${o[0].toFixed(3)} ${o[1].toFixed(3)})`;
  const { w, y0, y1 } = SCREEN;
  const yOf = (q) => y1 - ((q - SCREEN.lo) / (SCREEN.hi - SCREEN.lo)) * (y1 - y0);
  const xOf = (t) => -w / 2 + (w * t) / 720;
  const curve = (list) => list.map((q, t) => `${t ? "L" : "M"}${xOf(t * 2).toFixed(2)} ${yOf(q).toFixed(2)}`).join("");
  const grid = [0, 250, 500, 750, 1000].map((q) => `M${-w / 2} ${yOf(q).toFixed(2)}H${w / 2}`).join("");
  const beats = Array.from({ length: 13 }, (_, j) => `M${xOf(j * 60).toFixed(2)} ${y0}V${y1}`).join("");
  const frameD = `M${-w / 2 - 2} ${y0 - 2}H${w / 2 + 2}V${y1 + 2}H${-w / 2 - 2}Z`;
  const screen = [
    `<defs><clipPath id="v12-screen"><path d="M${-w / 2} ${y0}H${w / 2}V${y1}H${-w / 2}Z"/></clipPath></defs>`,
    `<path class="v12-screen-glass" d="M${-w / 2} ${y0}H${w / 2}V${y1}H${-w / 2}Z"/>`,
    `<g clip-path="url(#v12-screen)">`,
    `<path class="iso-line v12-grid" data-tone="faint" d="${grid}${beats}"/>`,
    `<path class="iso-line v12-zero" data-tone="lo" d="M${-w / 2} ${yOf(0).toFixed(2)}H${w / 2}"/>`,
    `<path class="v12-trace v12-single" d="${curve(SCREEN.single)}"/>`,
    `<path class="v12-trace v12-sum" d="${curve(SCREEN.sum)}"/>`,
    `<text class="v12-screen-text" font-size="2.9" x="${-w / 2 + 1.6}" y="${y0 + 3.1}">N·m</text>`,
    `<text class="v12-screen-text" font-size="2.6" x="${-w / 2 + 1.6}" y="${(yOf(0) - 0.7).toFixed(2)}">0</text>`,
    `<text class="v12-screen-text" data-k="sum" font-size="2.9" text-anchor="end" x="${w / 2 - 16}" y="${y0 + 3.1}">V12</text>`,
    `<text class="v12-screen-text" data-k="single" font-size="2.9" text-anchor="end" x="${w / 2 - 1.6}" y="${y0 + 3.1}">1 cyl.</text>`,
    `<g class="v12-cursor"><path class="v12-cursor-line" d="M0 ${y0}V${y1}"/><circle class="v12-cursor-dot" r="1.6" cy="${yOf(SCREEN.sum[0]).toFixed(2)}"/></g>`,
    `</g>`,
    `<path class="iso-line" data-tone="lo" d="${frameD}"/>`,
    `<path class="iso-line" data-tone="mid" d="M${-w / 2} ${y0}H${w / 2}V${y1}H${-w / 2}Z"/>`,
  ].join("");
  const svg = body + rings + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }) + D(screws.map(([x, y]) => at([x, y, top])), { size: 0.5 }) + `<g class="v12-scope" data-name="stand.scope" transform="${matrix}">${screen}</g>`;
  put({ name: "stand.plinth", layer: "back", at: [0, 0, z0], svg, shapes: [A.extruded(OCT, z0, h, { ground: true })] });
  return { xOf, yOf };
}

export const T = turning(P, { recorder: R });
const stand = T.group("stand", { turn: { pivot: [0, 0] } });
const crank = T.group("crank", { parent: stand, hinge: { point: [0, 0, H], axis: [1, 0, 0], range: [0, 360] } });
const live = T.layer("engine");
T.stack(["back", "engine", "front"]);
const E = { group: stand, layer: live };
const top = [0, 1].map((bank) => T.group(`top.${bank ? "b" : "a"}`, { parent: stand, slide: { direction: axisOf(bank), travel: M.LIFT } }));
const TOP = (bank) => ({ group: top[bank], layer: live });

// turntable
const platter = T.round({ name: "stand.platter", ...E, F: VERT(0, 0), s0: PLINTH[1], s1: 0, r: PLATTER_R, tone: "mid", crease: "lo", details: { seams: [-2] } });
const indexMark = `<path class="iso-line" data-tone="hi" d="M${PLATTER_R - 0.2} 0L${PLATTER_R - 12} 0"/><path class="iso-line" data-tone="lo" d="${Array.from({ length: 121 }, (_, j) => `${j ? "L" : "M"}${((PLATTER_R - 12) * Math.cos((j / 120) * Math.PI * 2)).toFixed(2)} ${((PLATTER_R - 12) * Math.sin((j / 120) * Math.PI * 2)).toFixed(2)}`).join("")}Z"/>`;
T.plane({ part: platter, o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], svg: indexMark, fade: [0.02, 0.2] });

// cradle rails on the platter, under the sump
for (const side of [-1, 1]) {
  const plan = { x: ENGINE_X[0] + 6, y: side > 0 ? 36 : -46, w: ENGINE_X[1] - ENGINE_X[0] - 12, d: 10, r: 1.4 };
  T.prism({ name: `stand.rail.${side > 0 ? "a" : "b"}`, ...E, plan, z: 0, h: H - 62, steps: 3, bevel: 0.6, tone: "lo", details: { seams: [3.2] } });
}

// sump and bearing caps
T.prism({ name: "block.sump", ...E, plan: { x: ENGINE_X[0], y: -50, w: ENGINE_X[1] - ENGINE_X[0], d: 100, r: 5 }, z: H - 62, h: 22, steps: 5, bevel: 1, tone: "mid", crease: "lo", details: { seams: [H - 44], dots: [-1, 1].flatMap((side) => Array.from({ length: 7 }, (_, j) => ({ at: [H - 42.2, ENGINE_X[0] + 7.3 + j * ((ENGINE_X[1] - ENGINE_X[0] - 14.6) / 6), side * 50], normal: [0, side, 0], size: 0.45 }))) } });
// the oil filter and the drain plug on the sump's bank-A flank (between two flange bolts)
const SIDE = { a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }; // axis out of the +y face
T.round({ name: "oil.filter", ...E, F: { ...SIDE, o: [26.5, 50, H - 51] }, s0: 0, s1: 13, r: 7, tone: "mid", crease: "lo", material: "gunmetal", details: { seams: [1.4, 11.6] } });
T.round({ name: "oil.drain", ...E, F: { ...SIDE, o: [ENGINE_X[1] - 24, 50, H - 57] }, s0: 0, s1: 2.4, r: 3, tone: "hi", crease: "lo", material: "steel" });
for (let j = 0; j <= 6; j++) {
  const [a, b] = bulkhead(j);
  T.prism({ name: `block.cap.${j}`, ...E, F: XF(), polygon: [[-28, -40], [28, -40], [28, -JOURNAL_R], [-28, -JOURNAL_R]], s0: a, s1: b, tone: "mid", crease: "lo", bevel: 0.4, details: { dots: [-20, 20].map((y) => ({ at: [(a + b) / 2, y, -40], normal: [0, 0, -1], size: 0.45 })) } });
  const roof = [
    [-46, JOURNAL_R],
    [46, JOURNAL_R],
    [46, (DECK - 0.5 * 46) / 0.866],
    [0, DECK / Math.sin((M.BANK[0] * Math.PI) / 180)],
    [-46, (DECK - 0.5 * 46) / 0.866],
  ];
  const wall = T.prism({ name: `block.bulkhead.${j}`, ...E, F: XF(), polygon: roof, s0: a, s1: b, tone: "mid", crease: "lo", bevel: 0.5 });
  const t0 = Math.asin(JOURNAL_R / 22);
  const arc = Array.from({ length: 25 }, (_, q) => {
    const t = t0 + ((Math.PI - 2 * t0) * q) / 24;
    return `${q ? "L" : "M"}${(22 * Math.cos(t)).toFixed(3)} ${(22 * Math.sin(t)).toFixed(3)}`;
  }).join("");
  for (const [x, n] of [[a, -1], [b, 1]]) T.plane({ part: wall, o: [x, 0, H], u: [0, n, 0], v: [0, 0, 1], normal: [n, 0, 0], svg: `<path class="iso-line" data-tone="lo" d="${arc}"/>` });
}
for (const bank of [0, 1]) {
  const tag = bank ? "b" : "a";
  for (let i = 0; i <= 6; i++) {
    const [a, b] = bank ? plateB(i) : plateA(i);
    const wall = T.prism({ name: `block.web.${tag}${i}`, ...E, F: XF(), polygon: bankQuad(bank, [DECK, HEAD[0]], HALF), s0: a, s1: b, tone: "mid", crease: "lo", bevel: 0.4 });
    const d3 = axisOf(bank);
    const lat3 = [0, -d3[2], d3[1]];
    const holes = [-1, 1].map((side) => {
      const c = [side * (HALF - 6.5), HEAD[0] - 9];
      return Array.from({ length: 20 }, (_, q) => `${q ? "L" : "M"}${(c[0] + 2.6 * Math.cos((q / 20) * Math.PI * 2)).toFixed(3)} ${(c[1] + 2.6 * Math.sin((q / 20) * Math.PI * 2)).toFixed(3)}`).join("") + "Z";
    }).join("");
    for (const [x, n] of [[a, -1], [b, 1]]) T.plane({ part: wall, o: [x, 0, H], u: G.mul3(lat3, n), v: d3, normal: [n, 0, 0], svg: `<path class="iso-line" data-tone="lo" d="${holes}"/>` });
  }
  const plates = Array.from({ length: 7 }, (_, q) => (bank ? plateB(q) : plateA(q))).map(([p0, p1]) => (p0 + p1) / 2);
  T.prism({ name: `block.head.${tag}`, ...TOP(bank), F: XF(), polygon: bankQuad(bank, HEAD, HALF), s0: BANK_X[bank][0], s1: BANK_X[bank][1], tone: "mid", crease: "lo", bevel: 0.8, details: { dots: [-1, 1].flatMap((side) => plates.map((x) => ({ at: [x, ...yz(bank, HEAD[1], side * 28.4)], normal: axisOf(bank), size: 0.5 }))) } });
  if (!bank) {
    const coverPart = T.prism({ name: `block.cover.${tag}`, ...TOP(bank), F: XF(), polygon: bankQuad(bank, COVER, HALF - 3), s0: BANK_X[bank][0] + 3, s1: BANK_X[bank][1] - 3, tone: "hi", crease: "lo", bevel: 1, material: "gunmetal", details: { dots: [-1, 1].flatMap((side) => plates.map((x, q) => ({ at: [Math.min(BANK_X[bank][1] - 7, Math.max(BANK_X[bank][0] + 7, x)), ...yz(bank, COVER[1], side * 22.5)], normal: axisOf(bank), size: 0.5 }))) } });
    const n = axisOf(bank);
    const u = [1, 0, 0];
    const v = G.cross3(n, u); // u × v = −n with y down on screen: the label reads unmirrored from the side it faces
    const at = [BANK_X[bank][0] + 17, ...yz(bank, COVER[1], 0)];
    T.plane({ part: coverPart, o: [at[0], at[1], H + at[2]], u, v, normal: n, svg: `<text class="iso-face-text v12-label" font-size="5.6" text-anchor="middle" transform="translate(0 2)">V12</text>` });
  }
}
const valley = (z) => (0.5 * z - HALF) / 0.866;
const RIDGE = DECK / 0.866;
if (false) T.prism({ name: "block.plenum", ...E, F: XF(), polygon: [[-valley(RIDGE), RIDGE], [valley(RIDGE), RIDGE], [valley(134), 134], [-valley(134), 134]], s0: ENGINE_X[0], s1: ENGINE_X[1], tone: "hi", crease: "lo", bevel: 0.8, material: "steel" });

// ── the crankshaft: six throws at 120°, seven main journals ─────────────────────
const D2R = Math.PI / 180;
const pinOf = (i) => {
  const a = (((M.BANK[0] - M.FIRE[i - 1]) % 360) + 360) % 360;
  return [M.CR * Math.cos(a * D2R), M.CR * Math.sin(a * D2R)];
};
const C = { group: crank, layer: live, material: "chrome", tone: "hi", crease: "lo" };
for (let j = 0; j <= 6; j++) {
  const [a, b] = journal(j);
  const oil = ((40 + 70 * j) * Math.PI) / 180;
  T.round({ name: `crank.journal.${j}`, ...C, F: XF(), s0: a, s1: b, r: JOURNAL_R, details: { dots: [{ at: [(a + b) / 2, JOURNAL_R * Math.cos(oil), JOURNAL_R * Math.sin(oil)], normal: [0, Math.cos(oil), Math.sin(oil)], size: 0.55, tone: "lo" }] } });
}
for (let i = 1; i <= 6; i++) {
  const [py, pz] = pinOf(i);
  const pa = Math.atan2(pz, py);
  const pts = [];
  for (let j = 0; j < 24; j++) {
    const t = (j / 24) * Math.PI * 2;
    pts.push([py + 15.5 * Math.cos(t), pz + 15.5 * Math.sin(t)]);
    pts.push([20.5 * Math.cos(t), 20.5 * Math.sin(t)]);
  }
  for (let j = -6; j <= 6; j++) {
    const t = pa + Math.PI + (j / 6) * 0.95;
    pts.push([34 * Math.cos(t), 34 * Math.sin(t)]);
  }
  const web = G.hullOf(pts);
  for (const side of [-1, 1]) {
    const s0 = side < 0 ? X(i) - WEB[1] : X(i) + WEB[0];
    T.prism({ name: `crank.web.${i}${side < 0 ? "f" : "r"}`, ...C, F: XF(), polygon: web, s0, s1: s0 + (WEB[1] - WEB[0]), material: "steel" });
  }
}
const FRONT = journal(0)[0];
T.round({ name: "crank.snout", ...C, F: XF(), s0: FRONT - 12, s1: FRONT, r: 12 });
T.round({ name: "crank.damper", ...C, F: XF(), s0: FRONT - 22, s1: FRONT - 12, r: 30, tone: "mid", material: "gunmetal", details: { seams: [FRONT - 19, FRONT - 15] } });
const REAR = journal(6)[1];
T.round({ name: "crank.flange", ...C, F: XF(), s0: REAR, s1: REAR + 4, r: 21 });
T.round({ name: "crank.flywheel", ...C, F: XF(), s0: REAR + 4, s1: REAR + 10, r: 48, tone: "mid", material: "steel", details: { ribs: { s0: REAR + 4.6, s1: REAR + 9.4, count: 132, seams: true, fade: [0.1, 0.55], tone: "lo" }, bolts: [{ s: REAR + 10, r: 14, count: 8, size: 0.5, fade: [0.04, 0.42] }] } });

// ── pistons and rods: twelve slides, twelve hinges ────────────────────────────
export const CYL = [];
for (let i = 1; i <= 6; i++)
  for (const bank of [0, 1]) {
    const tag = `${bank ? "b" : "a"}${i}`;
    const d = axisOf(bank);
    const x = cylX(i, bank);
    const pin0 = pinOf(i);
    const phi = Math.atan2(pin0[1], pin0[0]);
    const alpha = phi - M.BANK[bank] * D2R;
    const s = M.CR * Math.cos(alpha) + Math.sqrt(M.ROD ** 2 - (M.CR * Math.sin(alpha)) ** 2);
    const W = [s * d[1], s * d[2]];
    // the wrist pin follows the crank; the rod hangs from it and the piston rides on it, so the
    // exploded view can lift the piston out of its bore and leave the rod on its crank pin
    const wrist = T.group(`wrist.${tag}`, { parent: stand, slide: { direction: d, travel: 2 * M.CR } });
    const piston = T.group(`piston.${tag}`, { parent: wrist, slide: { direction: d, travel: M.OUT.piston } });
    const rodG = T.group(`rod.${tag}`, { parent: wrist, hinge: { point: [x, W[0], H + W[1]], axis: [1, 0, 0], range: [-30, 30] } });
    const crown = s + M.SMALL + M.PISTON;
    const part = T.round({ name: `piston.${tag}`, group: piston, layer: live, F: AXF(x, bank), s0: s + M.SMALL, s1: crown, r: M.BORE, tone: "hi", crease: "lo", material: "steel", details: { seams: [crown - 2.2, crown - 4.2, crown - 6.2, s + M.SMALL + 2], rings: [[-9, -9.5], [9, -9.5], [-9, 9.5], [9, 9.5]].map(([px, py]) => ({ at: [crown, px, py], normal: d, r: 5.4, tone: "lo" })) } });
    const slab = bank ? [X(i) + 0.2, X(i) + WEB[0]] : [X(i) - WEB[0], X(i) - 0.2];
    const R_ = { group: rodG, layer: live, tone: "mid", crease: "lo", material: "gunmetal" };
    T.round({ name: `rod.${tag}.small`, ...R_, F: { ...XF(), o: [0, W[0], H + W[1]] }, s0: slab[0] + 1.6, s1: slab[1] - 1.6, r: M.SMALL });
    const ax = [pin0[0] - W[0], pin0[1] - W[1]];
    const al = Math.hypot(ax[0], ax[1]);
    const mm = [-ax[1] / al, ax[0] / al];
    T.round({ name: `rod.${tag}.big`, ...R_, F: { ...XF(), o: [0, pin0[0], H + pin0[1]] }, s0: slab[0], s1: slab[1], r: BIG_R, details: { rules: [[slab[0], -1], [slab[1], 1]].map(([sx, nx]) => ({ points: [[sx, -BIG_R * mm[0], -BIG_R * mm[1]], [sx, BIG_R * mm[0], BIG_R * mm[1]]], normal: [nx, 0, 0], tone: "lo" })) } });
    const e = [pin0[0] - W[0], pin0[1] - W[1]];
    const len = Math.hypot(e[0], e[1]);
    const u = [e[0] / len, e[1] / len];
    const m = [-u[1], u[0]];
    const p = (base, along, side) => [base[0] + u[0] * along + m[0] * side, base[1] + u[1] * along + m[1] * side];
    const beam = [p(W, M.SMALL, -3.2), p(W, M.SMALL, 3.2), p(pin0, -BIG_R, 5.4), p(pin0, -BIG_R, -5.4)];
    T.prism({ name: `rod.${tag}.beam`, ...R_, F: XF(), polygon: beam, s0: slab[0] + 2.6, s1: slab[1] - 2.6 });
    CYL.push({ tag, i, bank, n: i + 6 * bank, fire: fireOf(i, bank), x, crown, part });
  }

// ── bank B's valvetrain, open: two camshafts at half speed over 24 bucket tappets ─────
const SC = 155.55; // cam axis along bank B
const SHAFT_R = 4.2;
const LOBE = [5.5, 11.5]; // lobe x faces from the cylinder centre
const BUCKET = { r: 4.6, len: 3 };
const TOWER_TOP = SC - SHAFT_R;
for (let i = 0; i <= 6; i++) {
  const [a, b] = plateB(i);
  T.prism({ name: `head.tower.${i}`, ...TOP(1), F: XF(), polygon: bankQuad(1, [HEAD[1], TOWER_TOP], 19), s0: a, s1: b, tone: "mid", crease: "lo", bevel: 0.3, details: { dots: [-15, 15].map((l) => ({ at: [(a + b) / 2, ...yz(1, TOWER_TOP, l)], normal: [0, ...axisOf(1).slice(1)], size: 0.4 })) } });
}
const camFrame = (l) => ({ o: [0, yz(1, SC, l)[0], H + yz(1, SC, l)[1]], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] });
const lobeAt = (angle) => {
  const pts = [];
  for (let j = 0; j < 28; j++) {
    const t = (j / 28) * Math.PI * 2;
    pts.push([M.CAM.rb * Math.cos(t), M.CAM.rb * Math.sin(t)]);
    pts.push([M.CAM.offset * Math.cos(angle) + M.CAM.rn * Math.cos(t), M.CAM.offset * Math.sin(angle) + M.CAM.rn * Math.sin(t)]);
  }
  return G.hullOf(pts);
};
const camsB = T.group("cams.b", { parent: top[1], slide: { direction: axisOf(1), travel: M.OUT.cams } }); // both camshafts lift off their towers together
for (const [cam, l, peak] of [["in", -12, M.PEAK_IN], ["ex", 12, M.PEAK_EX]]) {
  const g = T.group(`cam.${cam}`, { parent: camsB, hinge: { point: camFrame(l).o, axis: [1, 0, 0], range: [0, 360] } });
  const F = camFrame(l);
  const CM = { group: g, layer: live, tone: "hi", crease: "lo", material: "steel" };
  const cuts = [BANK_X[1][0]];
  for (let i = 1; i <= 6; i++) {
    const cx = cylX(i, 1);
    const fire = fireOf(i, 1);
    const nose = ((300 - (fire + peak) / 2) * D2R) % (2 * Math.PI);
    for (const [lo, hi] of [[cx - LOBE[1], cx - LOBE[0]], [cx + LOBE[0], cx + LOBE[1]]]) {
      T.prism({ name: `cam.${cam}.lobe.${i}${lo < cx ? "f" : "r"}`, ...CM, F, polygon: lobeAt(nose), s0: lo, s1: hi, material: "chrome" });
      cuts.push(lo, hi);
    }
    const bucketG = T.group(`bucket.${cam}${i}`, { parent: top[1], slide: { direction: G.mul3(axisOf(1), -1), travel: M.CAM.offset + M.CAM.rn - M.CAM.rb } });
    for (const side of [-1, 1]) {
      const bx = cx + side * (LOBE[0] + LOBE[1]) / 2;
      const top = SC - M.CAM.rb - liftOf(0, i, cam); // tangent to the lobe at crank 0
      T.round({ name: `bucket.${cam}${i}${side < 0 ? "f" : "r"}`, group: bucketG, layer: live, F: { ...AXF(bx, 1), o: [bx, yz(1, 0, l)[0], H + yz(1, 0, l)[1]] }, s0: top - BUCKET.len, s1: top, r: BUCKET.r, tone: "mid", crease: "lo", material: "brass", details: { seams: [top - 0.8] } });
    }
  }
  cuts.push(BANK_X[1][1]);
  for (let j = 0; j + 1 < cuts.length; j += 2) T.round({ name: `cam.${cam}.shaft.${j / 2}`, ...CM, F, s0: cuts[j], s1: cuts[j + 1], r: SHAFT_R });
  T.round({ name: `cam.${cam}.sprocket`, ...CM, F, s0: BANK_X[1][0] - 4.6, s1: BANK_X[1][0] - 0.4, r: 11.4, tone: "mid", material: "steel", details: { ribs: { s0: BANK_X[1][0] - 4.2, s1: BANK_X[1][0] - 0.8, count: 40, seams: true, fade: [0.1, 0.55], tone: "lo" }, bolts: [{ s: BANK_X[1][0] - 4.6, r: 6, count: 3, size: 0.45, fade: [0.04, 0.42] }] } });
  T.round({ name: `cam.${cam}.nose`, ...CM, F, s0: BANK_X[1][0] - 0.4, s1: BANK_X[1][0], r: SHAFT_R });
}

// ── intake: per cylinder a runner on the head's inner flank, a throttle body and a trumpet;
// an injector in each runner, fed by a rail that runs down the V ───────────────────────
for (const bank of [0, 1]) {
  const tag = bank ? "b" : "a";
  const sy = bank ? -1 : 1;
  const IN = { group: T.group(`intake.${tag}`, { parent: top[bank], slide: { direction: [0, 0, 1], travel: M.OUT.intake } }), layer: live };
  const inner = yz(bank, HEAD[0] + 1.4, bank ? -HALF : HALF);
  const corner = yz(bank, HEAD[1], bank ? -HALF : HALF);
  const block = [inner, corner, [corner[0], 140], [sy * 24, 140], [sy * 24, inner[1]]];
  for (let i = 1; i <= 6; i++) {
    const x = cylX(i, bank);
    // one runner per cylinder, each under its trumpet: six short contacts with the head instead of one long one
    T.prism({ name: `intake.runner.${tag}${i}`, ...IN, F: XF(), polygon: block, s0: x - 9.5, s1: x + 9.5, tone: "mid", crease: "lo", bevel: 0.4, material: "steel", details: { dots: [-6.5, 6.5].map((dx) => ({ at: [x + dx, sy * 26.5, 140], normal: [0, 0, 1], size: 0.42 })) } });
    // the throttle body: its butterfly spindle shows as a boss on each side
    T.round({ name: `intake.throttle.${tag}${i}`, ...IN, F: VERT(x, sy * 34), s0: H + 140, s1: H + 147, r: 6.2, tone: "mid", crease: "lo", material: "gunmetal", details: { seams: [H + 145.8], dots: [-1, 1].map((side) => ({ at: [H + 143, side * 6.2, 0], normal: [side, 0, 0], size: 0.55, tone: "mid" })) } });
    T.round({ name: `intake.trumpet.${tag}${i}`, ...IN, F: VERT(x, sy * 34), s0: H + 147, s1: H + 167, r: [6.2, 8.6], ends: ["flat", "open"], tone: "hi", crease: "lo", material: "chrome", details: { seams: [H + 148.2, H + 165.4] } });
    // the injector leaves the runner's V-side face and ends on the rail
    const a = [0, -sy, 0];
    T.round({ name: `fuel.injector.${tag}${i}`, ...IN, F: { o: [x, sy * 24, H + 133], a, u: [1, 0, 0], v: G.cross3(a, [1, 0, 0]) }, s0: 0, s1: 9, r: 2.4, tone: "mid", crease: "lo", material: "gunmetal", details: { seams: [2.6, 6.2] } });
  }
  T.round({ name: `fuel.rail.${tag}`, ...IN, F: { o: [0, sy * 12.4, H + 133], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }, s0: cylX(1, bank) - 12, s1: cylX(6, bank) + 12, r: 2.6, tone: "hi", crease: "lo", material: "steel" });
}

// ── exhaust: a port stub and an elbow block on each head's outer flank, a drop to a log ─
for (const bank of [0, 1]) {
  const sgn = bank ? 1 : -1; // the lateral sign that points out of the V
  const d = axisOf(bank);
  const lat = [0, -d[2], d[1]];
  const out3 = G.mul3(lat, sgn);
  const PORT_S = (HEAD[0] + HEAD[1]) / 2;
  const P1 = yz(bank, PORT_S - 5, sgn * (HALF + 7));
  const P2 = yz(bank, PORT_S + 5, sgn * (HALF + 7));
  const P1o = [P1[0] + 10 * out3[1], P1[1] + 10 * out3[2]];
  const P2o = [P2[0] + 10 * out3[1], P2[1] + 10 * out3[2]];
  const zb = Math.min(P1[1], P1o[1]) - 2;
  const block = G.hullOf([P1, P2, P2o, P1o, [P1[0], zb], [P1o[0], zb]]);
  const pipeY = (P1[0] + P1o[0]) / 2;
  const LOG = { z: 30, half: 7, tall: 12 };
  const tag = bank ? "b" : "a";
  const EX = { group: T.group(`exhaust.${tag}`, { parent: top[bank], slide: { direction: out3, travel: M.OUT.exhaust } }), layer: live };
  for (let i = 1; i <= 6; i++) {
    const x = cylX(i, bank);
    const port = yz(bank, PORT_S, sgn * HALF);
    T.round({ name: `exhaust.port.${tag}${i}`, ...EX, F: { o: [x, port[0], H + port[1]], a: out3, u: [1, 0, 0], v: G.cross3(out3, [1, 0, 0]) }, s0: 0, s1: 7, r: 3.6, tone: "mid", crease: "lo", material: "steel", details: { seams: [1.2] } });
    T.prism({ name: `exhaust.elbow.${tag}${i}`, ...EX, F: XF(), polygon: block, s0: x - 5.2, s1: x + 5.2, tone: "mid", crease: "lo", bevel: 0.3, material: "steel" });
    T.round({ name: `exhaust.drop.${tag}${i}`, ...EX, F: VERT(x, pipeY), s0: H + LOG.z, s1: H + zb, r: 3.3, tone: "hi", crease: "lo", material: "steel", details: { seams: [H + zb - 2] } });
  }
  // the oxygen sensor stands on the log, halfway down the bank
  T.round({ name: `exhaust.lambda.${tag}`, ...EX, F: VERT((cylX(3, bank) + cylX(4, bank)) / 2, pipeY), s0: H + LOG.z, s1: H + LOG.z + 8, r: 2.1, tone: "hi", crease: "lo", material: "steel", details: { seams: [H + LOG.z + 3.2] } });
  const logPoly = [];
  for (let j = 0; j < 24; j++) {
    const t = (j / 24) * Math.PI * 2;
    const cx = Math.cos(t) > 0 ? LOG.half - 3 : -(LOG.half - 3);
    const cz = Math.sin(t) > 0 ? -3 : -(LOG.tall - 3);
    logPoly.push([pipeY + cx + 3 * Math.cos(t), LOG.z + cz + 3 * Math.sin(t)]);
  }
  T.prism({ name: `exhaust.log.${tag}`, ...EX, F: XF(), polygon: G.hullOf(logPoly), s0: cylX(1, bank) - 9, s1: cylX(6, bank) + 9, tone: "hi", crease: "lo", bevel: 0.4, material: "steel" });
}

// ── ignition: coil packs on bank A's cover, plugs between bank B's cams ─────────
const sparkSvg = (n) => `<g class="v12-spark" data-n="${n}" opacity="0"><circle r="${(6.5 * G.scaleOf(P)).toFixed(2)}" class="v12-spark-halo"/><circle r="${(2.6 * G.scaleOf(P)).toFixed(2)}" class="v12-spark-core"/></g>`;
const COILS = { group: T.group("coils.a", { parent: top[0], slide: { direction: axisOf(0), travel: M.OUT.coils } }), layer: live };
const PLUGS = { group: T.group("plugs.b", { parent: top[1], slide: { direction: axisOf(1), travel: M.OUT.plugs } }), layer: live };
for (const c of CYL) {
  const d = axisOf(c.bank);
  if (c.bank === 0) {
    const coil = T.prism({ name: `ignition.coil.${c.tag}`, ...COILS, F: XF(), polygon: bankQuad(0, [COVER[1], COVER[1] + 7], 6), s0: c.x - 5, s1: c.x + 5, tone: "mid", crease: "lo", bevel: 0.3, material: "rubber", details: { dots: [{ at: [c.x, ...yz(0, COVER[1] + 7, 0)], normal: d, size: 0.5, tone: "mid" }] } });
    T.billboard({ part: coil, at: [c.x, yz(0, COVER[1] + 7.2, 0)[0], H + yz(0, COVER[1] + 7.2, 0)[1]], normal: [0, 0, 1], fade: [-3, -2], svg: sparkSvg(c.n) });
  } else {
    const F = AXF(c.x, 1);
    T.round({ name: `ignition.plug.${c.tag}`, ...PLUGS, F, s0: HEAD[1], s1: HEAD[1] + 9, r: 2.2, tone: "hi", crease: "lo", material: "steel" });
    const boot = T.round({ name: `ignition.boot.${c.tag}`, ...PLUGS, F, s0: HEAD[1] + 9, s1: HEAD[1] + 21, r: 3.3, tone: "mid", crease: "lo", material: "rubber", details: { seams: [HEAD[1] + 18.5] } });
    T.billboard({ part: boot, at: [c.x, yz(1, HEAD[1] + 21.2, 0)[0], H + yz(1, HEAD[1] + 21.2, 0)[1]], normal: [0, 0, 1], fade: [-3, -2], svg: sparkSvg(c.n) });
  }
}

// ── combustion: a flash over each crown, faded in by the live code ───────────────
for (const c of CYL) {
  const d = axisOf(c.bank);
  const tip = [c.x, (c.crown - 0.4) * d[1] + 0, H + (c.crown - 0.4) * d[2]];
  T.billboard({ part: c.part, at: tip, normal: [0, 0, 1], fade: [-3, -2], svg: `<g class="v12-flash" data-n="${c.n}" opacity="0"><circle r="${(15 * G.scaleOf(P)).toFixed(2)}" class="v12-flash-halo"/><circle r="${(7 * G.scaleOf(P)).toFixed(2)}" class="v12-flash-core"/></g>` });
}

const SCREEN = { w: 118, y0: 5, y1: 30, lo: -250, hi: 1100, sum: Array.from({ length: 361 }, (_, j) => torqueOf(j * 2)), single: Array.from({ length: 361 }, (_, j) => torqueOf(j * 2, { i: 1, bank: 0 })) };
const SCOPE = plinth();

export const poses = () => {
  const out = [];
  for (let t = 0; t < 720; t += 3) out.push(follow({ theta: t, stand: (t * 1.7) % 360 }));
  for (let a = 0; a < 360; a += 5) out.push(follow({ theta: (a * 7) % 720, stand: a }));
  // the exploded view's three stages, at every crank angle (the engine may run while it is apart)
  for (let t = 0; t < 720; t += 9) for (const apart of [0.2, 0.4, 0.55, 0.7, 0.85, 1]) out.push(follow({ theta: t, stand: (t * 2.3) % 360, apart }));
  return out;
};

const verify = argv.includes("--verify");
const t0 = Date.now();
const out = T.build({ statics: R.items, poses, verify, fullClouds: true }); // full clouds: the half clouds missed the flush contacts between the exploded groups
A.settle(R, P);
// each static item is named in the page, so a click can find the piece it belongs to
const layerOf = (name) => R.items.filter((item) => item.layer === name).sort((a, b) => a.key - b.key).map((item) => `<g data-name="${item.name}">${item.svg}</g>`);
const BACK = [`<path class="iso-halo" d="${k.haloOf({ x: -APOTHEM, y: -APOTHEM, w: 2 * APOTHEM, d: 2 * APOTHEM, r: 70 }, PLINTH[0] - 6, 6, P)}"/>`, ...layerOf("back")];
const FRONT_ITEMS = layerOf("front");
if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  TA.orbitOrExit(T, R, P, {
    sweep: { at: (x) => follow({ stand: x, theta: 0 }), from: 0, to: 360, frame: 0.3 },
    clips: [
      { name: "run", at: (t) => follow({ stand: 30 + 4 * t, theta: 90 * t }), from: 0, to: 8, frame: 1 / 60 },
      { name: "apart", at: (t) => follow({ stand: 200 + 6 * t, theta: 120 * t, apart: Math.min(1, t / 1.5) }), from: 0, to: 3, frame: 1 / 60 },
    ],
    quick: argv.includes("--quick"),
    only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null,
    log: argv.includes("--verbose") ? (text) => console.log(`  … ${text}`) : null,
  });
}

const LABEL = "Un moteur V12 à 60° sur un plateau tournant, coupé pour montrer ses pièces : un vilebrequin à six manetons sur sept paliers, douze bielles groupées par deux sur ses manetons, douze pistons en deux rangées de six, les culasses, la distribution à nu de la rangée B, l'admission, l'injection, l'échappement et l'allumage.";
const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: BACK });
const staticSvg = (list) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${list.join("")}</svg>`;
const stage = (inventory) => `<div class="iso-stage iso-turn v12-stage" tabindex="0" role="slider" aria-label="Moteur V12 sur un plateau tournant. Glisser ou flèches gauche et droite : tourner. Haut et bas : vitesse. Espace : pause. E : éclater. Plus et moins : zoom. Barre oblique : chercher une pièce." aria-valuemin="0" aria-valuemax="720" aria-valuenow="0" aria-valuetext="vilebrequin à 0 degré">${backSvg}${out.layerSvg("engine", { width: WIDTH, height: HEIGHT })}${staticSvg(FRONT_ITEMS)}${inventory}</div>`;

// ── the explorer around the figure: systems, search, a sheet per piece, the dock ─────
const ATLAS = catalogue([...out.data.parts.map((p) => p.name), ...R.items.filter((item) => item.layer === "back" || item.layer === "front").map((item) => item.name), "stand.scope"]);

// ── « Chaque pièce »: the far end of the slider lays every engine piece out on a mat, one zone per system ──
// A piece keeps its picture at rest (every group value 0): live.js copies the live layer's rest markup once, and a
// world translation is one screen translation in this camera. Each piece stands in its own cell on the mat, so a
// vertical plane parts any two pieces and the painter's order follows from those planes.
const INV_COLUMNS = [
  // the column at low x (up and left on screen), then the one at high x; zones from the back of the mat (low y)
  [["bloc", ["paroi", "cloison", "chapeau"]], ["culasses", ["tour", "culasse", "couvre"]], ["admission", ["cornet", "papillon", "conduit"]], ["injection", ["injecteur", "rampe"]], ["allumage", ["bobine", "capuchon", "bougie"]]],
  [["mobile", ["volant", "amortisseur", "bielle", "vilebrequin", "piston"]], ["distribution", ["pignon", "poussoir", "arbre"]], ["echappement", ["primaire", "lambda", "collecteur"]], ["lubrification", ["filtre", "vidange", "carter"]]],
];
const INV = (() => {
  const GAP = 5; // between pieces in a row
  const ROW = 7; // between rows
  const ZONE = 22; // between systems
  const COL_W = 360;
  const COL_GAP = 30;
  const MARGIN = 24;
  const boxOf = new Map(
    T.parts.map((part) => {
      const o = part.group ? part.group.origin : [0, 0, 0];
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const s of part.samples)
        for (let j = 0; j < 3; j++) {
          b[j] = Math.min(b[j], s[j] + o[j]);
          b[j + 3] = Math.max(b[j + 3], s[j] + o[j]);
        }
      return [part.name, b];
    }),
  );
  const pieces = ATLAS.pieces.flatMap((p, k) => {
    if (p.system === "banc") return [];
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const name of p.parts) {
      const q = boxOf.get(name);
      if (!q) throw new Error(`inventory: ${p.id} draws ${name}, which is not a live part`);
      for (let j = 0; j < 3; j++) {
        b[j] = Math.min(b[j], q[j]);
        b[j + 3] = Math.max(b[j + 3], q[j + 3]);
      }
    }
    return [{ k, p, b, w: b[3] - b[0], d: b[4] - b[1] }];
  });
  const rank = (p) => [p.cyl ?? 0, p.bank ?? "", p.i ?? 0, p.cam ?? "", p.id];
  const byRank = (a, c) => {
    const [x, y] = [rank(a.p), rank(c.p)];
    for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) return x[j] < y[j] ? -1 : 1;
    return 0;
  };
  const placed = [];
  const zones = [];
  const columns = INV_COLUMNS.map((column, c) => {
    const x0 = c * (COL_W + COL_GAP);
    let y = 0;
    const cells = [];
    for (const [system, kinds] of column) {
      const start = y;
      let row = [];
      let width = 0;
      const flush = () => {
        if (!row.length) return;
        const depth = Math.max(...row.map((q) => q.d));
        let x = x0 + (COL_W - (width - GAP)) / 2;
        for (const q of row) {
          cells.push({ ...q, x, yc: y + depth / 2 });
          x += q.w + GAP;
        }
        y += depth + ROW;
        row = [];
        width = 0;
      };
      for (const kind of kinds) {
        const list = pieces.filter((q) => q.p.system === system && q.p.kind === kind).sort(byRank);
        if (!list.length) throw new Error(`inventory: no ${kind} in ${system}`);
        const whole = list.reduce((n, q) => n + q.w + GAP, 0);
        if (row.length && width + whole > COL_W && whole <= COL_W) flush(); // a kind that fits in one row is not split
        for (const q of list) {
          if (row.length && width + q.w > COL_W) flush();
          row.push(q);
          width += q.w + GAP;
        }
      }
      flush();
      zones.push({ system, column: c, x0, y0: start, y1: y - ROW });
      y += ZONE - ROW;
    }
    return { cells, depth: y - ZONE };
  });
  const depth = Math.max(...columns.map((col) => col.depth));
  const width = INV_COLUMNS.length * COL_W + (INV_COLUMNS.length - 1) * COL_GAP;
  // centre the mat on the world origin; a shorter column sits in the middle of the mat's depth
  columns.forEach((col, c) => {
    const shift = (depth - col.depth) / 2;
    for (const z of zones) if (z.column === c) (z.y0 += shift - depth / 2), (z.y1 += shift - depth / 2), (z.x0 -= width / 2);
    for (const q of col.cells) {
      const d = [q.x - width / 2 - q.b[0], q.yc + shift - depth / 2 - (q.b[1] + q.b[4]) / 2, -q.b[2]];
      placed.push({ ...q, d, cell: [q.b[0] + d[0], q.b[1] + d[1], q.b[3] + d[0], q.b[4] + d[1]] });
    }
  });
  const missing = pieces.filter((q) => !placed.some((r) => r.k === q.k));
  if (missing.length) throw new Error(`inventory: no zone for ${missing.map((q) => q.p.id).join(", ")}`);
  // order: two cells parted by an x plane (or a y plane) draw the far one first; parted by both, they agree or never overlap
  const V = G.viewOf(P);
  const sideOf = (a0, a1, b0, b1, toward) => (a1 <= b0 ? -toward : b1 <= a0 ? toward : 0); // −1: a is farther
  const after = placed.map(() => []);
  const blocking = placed.map(() => 0);
  placed.forEach((a, i) =>
    placed.forEach((b, j) => {
      if (i >= j) return;
      const sx = sideOf(a.cell[0], a.cell[2], b.cell[0], b.cell[2], Math.sign(V[0]));
      const sy = sideOf(a.cell[1], a.cell[3], b.cell[1], b.cell[3], Math.sign(V[1]));
      if (sx && sy && sx !== sy) return;
      const s = sx || sy;
      if (!s) throw new Error(`inventory: ${a.p.id} and ${b.p.id} share floor`);
      const [far, near] = s < 0 ? [i, j] : [j, i];
      after[far].push(near);
      blocking[near]++;
    }),
  );
  const depthOf = (q) => (q.cell[0] + q.cell[2]) * V[0] + (q.cell[1] + q.cell[3]) * V[1];
  const order = [];
  const ready = placed.map((_, i) => i).filter((i) => !blocking[i]);
  while (ready.length) {
    ready.sort((i, j) => depthOf(placed[j]) - depthOf(placed[i]));
    const i = ready.pop();
    order.push(i);
    for (const j of after[i]) if (!--blocking[j]) ready.push(j);
  }
  if (order.length !== placed.length) throw new Error("inventory: the cells have no painter's order");
  // the mat: a rubber mat in two layers, a groove round its edge, a ruled outline and a colour tab for each system
  const o = at([0, 0, 0]);
  const shiftOf = (d) => {
    const s = at(d);
    return [+(s[0] - o[0]).toFixed(2), +(s[1] - o[1]).toFixed(2)];
  };
  const mat = { x: -width / 2 - MARGIN, y: -depth / 2 - MARGIN, w: width + 2 * MARGIN, d: depth + 2 * MARGIN, r: 18 };
  const MAT_H = 5;
  const tabs = zones.map((z) => {
    const plan = { x: z.x0 + 4, y: z.y0 - 12.5, w: 30, d: 5, r: 2 };
    return `<path class="v12-inv-tab" data-sys="${z.system}" style="--c:${ATLAS.systems.find((s) => s.id === z.system).color}" d="${k.planOutline(plan, 0.02, P, 3)}Z"/>`;
  });
  const outlines = zones.map((z) => k.planOutline({ x: z.x0 - 10, y: z.y0 - 16, w: COL_W + 20, d: z.y1 - z.y0 + 26, r: 7 }, 0, P, 4)).join("");
  const floor = [
    `<path class="iso-halo" d="${k.haloOf(mat, -MAT_H, MAT_H, P)}"/>`,
    S(k.slabOf(mat, -MAT_H, MAT_H, P, 8, 1.2), { tone: "lo", inner: L(k.sideSeam(mat, -MAT_H / 2, P), { tone: "faint" }) }),
    L(k.planOutline(k.insetPlan(mat, 9), 0, P, 8), { tone: "faint" }),
    L(outlines, { tone: "faint" }),
    ...tabs,
    ...placed.map((q, i) => `<path class="iso-halo v12-inv-halo" data-i="${i}" d="${k.haloOf({ x: q.cell[0], y: q.cell[1], w: q.cell[2] - q.cell[0], d: q.cell[3] - q.cell[1], r: 2 }, 0, 1, P)}"/>`),
  ].join("");
  // the frame that shows the whole mat
  const corners = [];
  for (const x of [mat.x, mat.x + mat.w]) for (const y of [mat.y, mat.y + mat.d]) corners.push(at([x, y, -MAT_H]));
  for (const q of placed) for (const x of [q.cell[0], q.cell[2]]) for (const y of [q.cell[1], q.cell[3]]) corners.push(at([x, y, q.b[5] - q.b[2]]));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return {
    floor,
    count: placed.length,
    pieces: order.map((i) => [placed[i].k, ...shiftOf(placed[i].d), i]),
    fit: { s: +Math.min((WIDTH * 0.92) / (box[2] - box[0]), (HEIGHT * 0.9) / (box[3] - box[1])).toFixed(4), dx: +((box[0] + box[2]) / 2 - WIDTH / 2).toFixed(1), dy: +((box[1] + box[3]) / 2 - HEIGHT / 2).toFixed(1) },
    box,
    zones,
    depths: columns.map((col) => col.depth),
    debug: { placed, order },
  };
})();
const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  layers: '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.2l8.5 4.5 8.5-4.5M3.5 16.2l8.5 4.5 8.5-4.5"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M19.5 4.5v4.2h-4.2"/>',
  play: '<path d="M8.5 5.8v12.4L18.5 12z"/>',
  pause: '<path d="M9 5.8v12.4M15 5.8v12.4"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5v4.2h4.2"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  focus: '<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/><circle cx="12" cy="12" r="2.4"/>',
  chevron: '<path d="M9.5 6.5l5.5 5.5-5.5 5.5"/>',
};
const icon = (name) => `<svg class="v12-i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const CAPTION = `Douze cylindres en deux rangées de six, à 60° l'une de l'autre, sur un seul vilebrequin à six manetons. Chaque maneton porte deux bielles, une par rangée. Les cylindres 1 à 6 forment la rangée A (couvre-culasse et bobines), les cylindres 7 à 12 la rangée B (arbres à cames à nu) ; le cylindre 1 est côté poulie. Un cycle à quatre temps dure deux tours, soit 720°, et les douze cylindres s'allument pendant ce cycle : une explosion tous les 60°, dans l'ordre ${ORDER}. Chaque détente dure 180°, donc trois cylindres poussent toujours en même temps et le couple ne retombe jamais à zéro.`;
const KEYS = [
  ["moving", "Vilebrequin, bielles, pistons, arbres à cames : les pièces qui bougent."],
  ["spark", "L'éclat orange : le cylindre qui s'allume, sur sa bobine (rangée A) ou sa bougie (rangée B), puis sur la tête de son piston."],
  ["scope", "L'écran du socle : couple du V12 (trait vif) et d'un seul cylindre (trait sombre) sur 720°."],
];
const pieceIndex = (id) => ATLAS.pieces.findIndex((p) => p.id === id);
const groupIndex = (id) => ATLAS.groups.findIndex((g) => g.id === id);
const STARTS = [["piece", "vilebrequin"], ["piece", "piston.1"], ["piece", "arbre.in"], ["group", "g.cyl.7"], ["piece", "volant"], ["piece", "ecran"]];
const starts = STARTS.map(([type, id]) => (type === "piece" ? `<button type="button" class="v12-chip" data-piece="${pieceIndex(id)}"><i style="--c:${ATLAS.systems.find((s) => s.id === ATLAS.pieces[pieceIndex(id)].system).color}"></i>${ATLAS.pieces[pieceIndex(id)].name}</button>` : `<button type="button" class="v12-chip v12-chip-all" data-group="${groupIndex(id)}">${ATLAS.groups[groupIndex(id)].name.split(",")[0]}</button>`)).join("");
const systems = ATLAS.systems.map((s) => `<li class="v12-sys" data-sys="${s.id}" data-on style="--c:${s.color}"><button type="button" class="v12-sys-name" data-only="${s.id}" title="Afficher seulement : ${s.name}"><i></i><span>${s.name}</span><b>${s.count}</b></button><label class="v12-switch"><input type="checkbox" checked data-toggle="${s.id}" aria-label="Afficher : ${s.name}"><span></span></label></li>`).join("");
const body = `<style>${out.css}\n${readFileSync(join(HERE, "v12.css"), "utf8")}</style>
<div class="v12-app" data-sheet="">
  <header class="v12-head">
    <div class="v12-eyebrow"><span class="v12-pulse"></span>Moteur interactif</div>
    <h1 class="v12-title">Atlas V12<span class="v12-badge">3D</span></h1>
    <p class="v12-sub"><b>${ATLAS.pieces.length}</b> pièces · ${Object.keys(ATLAS.parts).length} formes dessinées · V à 60° · 6,5 L</p>
  </header>
  <nav class="v12-tools" aria-label="Recherche et sources">
    <button type="button" class="v12-btn v12-find" data-act="search">${icon("search")}<span>Trouver une pièce</span><kbd>/</kbd></button>
    <button type="button" class="v12-btn v12-icon" data-act="about" aria-label="Sources et limites">${icon("info")}</button>
  </nav>
  <aside class="v12-panel v12-systems" aria-label="Systèmes">
    <div class="v12-panel-head"><span>Systèmes</span><b class="v12-pill">${ATLAS.systems.length}</b><button type="button" class="v12-btn v12-icon v12-close" data-act="close" aria-label="Fermer les systèmes">${icon("close")}</button></div>
    <div class="v12-presets" role="group" aria-label="Préréglages"><button type="button" data-preset="all" aria-pressed="true">Tout</button><button type="button" data-preset="moving" aria-pressed="false">Ce qui bouge</button><button type="button" data-preset="flow" aria-pressed="false">Air et gaz</button></div>
    <ul class="v12-sys-list">${systems}</ul>
    <div class="v12-panel-foot"><span data-visible></span><button type="button" class="v12-link" data-act="hide-all">Tout masquer</button></div>
  </aside>
  <main class="v12-main">
    <div class="v12-caption"><i></i><span data-caption>V12 à 60° · 6,5 L · 12 cylindres</span><i></i></div>
    <figure class="iso-figure v12-figure"><div class="iso-plate">${stage(`<div class="v12-inv" hidden><svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-live" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true"><g class="v12-inv-floor">${INV.floor}</g><g class="v12-inv-parts"></g></svg></div>`)}<div class="v12-tip" role="tooltip" hidden></div></div></figure>
  </main>
  <nav class="v12-panel v12-views" aria-label="Vues">
    <button type="button" data-view="iso" aria-pressed="true" title="Vue trois-quarts" aria-label="Vue trois-quarts">¾</button>
    <button type="button" data-view="front" aria-pressed="false" title="Vue de face, côté poulie" aria-label="Vue de face, côté poulie">F</button>
    <button type="button" data-view="side" aria-pressed="false" title="Vue de côté, rangée A" aria-label="Vue de côté, rangée A">C</button>
    <button type="button" data-view="back" aria-pressed="false" title="Vue arrière, côté volant" aria-label="Vue arrière, côté volant">A</button>
    <hr>
    <button type="button" data-act="tour" aria-pressed="true" title="Rotation automatique" aria-label="Rotation automatique">${icon("rotate")}</button>
    <button type="button" data-act="zoom-in" title="Zoom avant" aria-label="Zoom avant">${icon("plus")}</button>
    <button type="button" data-act="zoom-out" title="Zoom arrière" aria-label="Zoom arrière">${icon("minus")}</button>
  </nav>
  <aside class="v12-panel v12-detail" aria-label="Fiche de la pièce"></aside>
  <div class="v12-panel v12-dock">
    <div class="v12-engine"><div class="v12-dock-head"><span>Moteur</span></div><div class="v12-engine-row"><button type="button" class="v12-btn v12-play" data-act="run" aria-pressed="true" aria-label="Arrêter le moteur">${icon("pause")}</button><div class="v12-seg" role="group" aria-label="Vitesse du vilebrequin"><button type="button" data-speed="1" aria-pressed="false" title="20° de vilebrequin par seconde">Lent</button><button type="button" data-speed="2" aria-pressed="true" title="60° de vilebrequin par seconde">Normal</button><button type="button" data-speed="3" aria-pressed="false" title="180° de vilebrequin par seconde">Rapide</button></div></div><div class="v12-readout" data-readout aria-live="off">vilebrequin 0°</div></div>
    <div class="v12-explode"><div class="v12-dock-head"><label for="v12-apart">Éclater le moteur</label><output data-apart for="v12-apart">0 %</output></div><input id="v12-apart" type="range" min="0" max="100" step="1" value="0" list="v12-stops"><datalist id="v12-stops"><option value="0"></option><option value="70"></option><option value="100"></option></datalist><div class="v12-ends"><button type="button" data-to="0">Assemblé</button><button type="button" data-to="1">Chaque pièce</button></div></div>
    <button type="button" class="v12-btn v12-sheet-btn" data-act="systems">${icon("layers")}<span>Systèmes</span></button>
    <button type="button" class="v12-btn v12-reset" data-act="reset" title="Tout réinitialiser">${icon("reset")}<span>Réinitialiser</span></button>
  </div>
  <footer class="v12-foot"><span>Glisser pour tourner · Molette ou pincer pour zoomer · Maj + glisser pour déplacer · Clic pour inspecter</span><button type="button" class="v12-link" data-act="about">Sources et limites ↗</button></footer>
  <section class="v12-panel v12-search" aria-label="Trouver une pièce" hidden>
    <div class="v12-panel-head"><span>Trouver une pièce</span><button type="button" class="v12-btn v12-icon v12-close" data-act="close-search" aria-label="Fermer la recherche">${icon("close")}</button></div>
    <div class="v12-field">${icon("search")}<input type="search" placeholder="Piston, came, bougie, cylindre 7…" aria-label="Nom d'une pièce" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="v12-results" aria-autocomplete="list"></div>
    <ul id="v12-results" class="v12-results" role="listbox" aria-label="Résultats"></ul>
    <p class="v12-note" data-search-note></p>
  </section>
  <dialog class="v12-about" aria-labelledby="v12-about-title"><form method="dialog" class="v12-about-body">
    <div class="v12-eyebrow">Sources et limites</div>
    <h2 class="v12-h2" id="v12-about-title">Un V12, pièce par pièce</h2>
    <p class="v12-text">Un V12 à 60° de 6,5 L, proche du Lamborghini L539, dessiné avec le kit anatomy. Chaque pièce est un solide qui est reprojeté et réombré à chaque image ; le mouvement, la lecture en bas à droite, l'écran de couple et les valeurs des fiches viennent d'un seul modèle.</p>
    <h3 class="v12-h3">Le modèle</h3>
    <ul class="v12-list">
      <li>Alésage 95 mm, course 76,4 mm, bielle de 155 mm entre axes : 541,5 cm³ par cylindre, 6 498 cm³ en tout. Rapport volumétrique 11,7.</li>
      <li>Ordre d'allumage ${ORDER} : une explosion tous les 60° de vilebrequin.</li>
      <li>Pression : compression et détente polytropiques, pic de 75 bar 15° après le point mort haut, échappement ouvert 40° avant le point mort bas.</li>
      <li>Couple : pression des gaz seule, à pleine charge, sans les forces d'inertie. 591 N·m en moyenne, entre 382 et 847 N·m.</li>
      <li>Cames : 9 mm de levée pendant 248° de vilebrequin ; levée maximale 110° après le point mort haut (admission) et 110° avant (échappement).</li>
    </ul>
    <h3 class="v12-h3">Ce qui est simplifié</h3>
    <ul class="v12-list">
      <li>Le bloc est découpé : il ne garde que ses cloisons, ses chapeaux et les parois entre cylindres.</li>
      <li>Soupapes, ressorts, segments, axes de piston, coussinets, chaîne, pompes et accessoires ne sont pas dessinés : les pièces de la figure sont des solides convexes qui ne s'emboîtent pas. Les fiches les décrivent.</li>
      <li>Les poussoirs flottent au-dessus de la culasse, d'un écart égal à leur levée. La rangée A garde son couvre-culasse ; sa distribution est la même que celle de la rangée B.</li>
      <li>L'allumage a lieu au point mort haut ; un vrai moteur allume quelques degrés plus tôt.</li>
      <li>La combustion est un éclat sur la tête du piston, pas une flamme.</li>
      <li>Pas de boîte à air dans le V : l'espace reste libre pour voir les rampes et les conduits.</li>
      <li>La 3D du kit est en bêta : environ 30 à 50 images par seconde quand le plateau tourne.</li>
    </ul>
    <h3 class="v12-h3">Commandes</h3>
    <dl class="v12-keys"><dt>Glisser, ← →</dt><dd>tourner le plateau</dd><dt>Molette, pincer, + −</dt><dd>zoomer ; 0 recentre</dd><dt>Maj + glisser, clic droit</dt><dd>déplacer la vue</dd><dt>Clic</dt><dd>lire la fiche d'une pièce</dd><dt>/</dt><dd>trouver une pièce</dd><dt>I</dt><dd>isoler la pièce choisie</dd><dt>Espace, ↑ ↓</dt><dd>arrêt, vitesse</dd><dt>E</dt><dd>éclater ou rassembler</dd><dt>.</dt><dd>avancer de 60°</dd><dt>Échap</dt><dd>fermer, désélectionner</dd></dl>
    <button class="v12-btn v12-primary" value="close">Fermer</button>
  </form></dialog>
  <template id="v12-intro"><div class="v12-detail-head"><div class="v12-eyebrow">Comment ça marche</div><h2 class="v12-h2">Douze cylindres, un seul vilebrequin</h2></div><div class="v12-scroll"><p class="v12-text">${CAPTION}</p><ul class="v12-legend">${KEYS.map(([key, text]) => `<li data-key="${key}"><i></i>${text}</li>`).join("")}</ul><h3 class="v12-h3">Pour commencer</h3><div class="v12-chips">${starts}</div><p class="v12-hint">Cliquez une pièce du moteur pour lire sa fiche, ou tapez / pour la chercher.</p></div></template>
</div>`;
// stand angles of the view buttons: three-quarter, front (pulley end), side (bank A), back (flywheel end)
const VIEWS = { iso: 0, front: -AZIMUTH + 90, side: -AZIMUTH + 180, back: -AZIMUTH - 90 };
const DATA = { scope: { w: SCREEN.w, y0: SCREEN.y0, y1: SCREEN.y1, lo: SCREEN.lo, hi: SCREEN.hi }, turn: out.data, cyl: CYL.map(({ tag, n, fire, i, bank }) => ({ tag, n, fire, i, bank })), order: ORDER, view: { w: WIDTH, h: HEIGHT }, fit: { s: 0.24, dy: 46 }, inv: { pieces: INV.pieces, box: INV.box.map((v) => +v.toFixed(1)), count: INV.count }, views: VIEWS, icons: Object.fromEntries(Object.keys(ICONS).map((name) => [name, icon(name)])) };
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__ATLAS__", JSON.stringify(ATLAS)).replace("/*__MODEL__*/", MODEL);
const page = k.pageHtml({ title: "Atlas V12 · moteur interactif", theme, body, script: turnScript() + (verify ? `window.__isoVerify = ${JSON.stringify(out.verify)};\n` : "") + LIVE, width: 1600 }).replace('<html lang="en">', '<html lang="fr">');
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const name = `v12${verify ? "-verify" : ""}${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(HERE, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${out.report.parts} parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.framed ?? 0} framed, ${l.dynamic} dynamic`).join(" · ")} · build ${out.report.seconds.toFixed(1)} s (total ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
export { out, INV };
