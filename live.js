const DATA = __DATA__;
const ATLAS = __ATLAS__;
/*__MODEL__*/
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $(".v12-app");
const stage = $(".v12-stage");
const plate = stage.closest(".iso-plate");
const readout = $("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SPEEDS = [0, 20, 60, 180]; // crank degrees per second on screen
let speedIndex = 2;
let lastSpeed = 2; // the speed that play returns to
let theta = 0;
let azimuth = 0;
let target = 0;
let frame = 0;
let last = 0;
let visible = false;
let tourOn = !still.matches; // the reader's choice
let touring = tourOn; // paused for a while after each touch
let idle = 0;
let own = false;
let drawnTheta = null;
let drawnAz = null;
const flashes = {};
const glowsOf = {};
const apart = { x: 0, v: 0 };
let apartTarget = 0;
let drawnApart = 0;
let cost = 0;
let half = false;
let skip = false;
let liveAt = 0;
const cursor = $(".v12-cursor");
const dot = $(".v12-cursor-dot");
const TOUR = 5; // turntable degrees per second while nobody touches it
const { w: VW, h: VH } = DATA.view;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (x, digits = 1) => x.toFixed(digits).replace(".", ",").replace("-", "−");
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const cycleOf = (t) => ((t % 720) + 720) % 720;
const bankOf = (tag) => (tag === "b" ? 1 : 0);
const SYSTEM = Object.fromEntries(ATLAS.systems.map((s) => [s.id, s]));
// the explode slider: its first 70 % take the engine apart, the rest lays every piece out on the mat
const EXPLODE = 0.7;
const INV = DATA.inv;
const smooth01 = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const apartOf = (e) => Math.min(1, e / EXPLODE);
const invOf = (e) => smooth01((e - EXPLODE) / (1 - EXPLODE));

// ── the engine and its readout ────────────────────────────────────────────────
const firingAt = (t) => {
  let best = null;
  for (const c of DATA.cyl) {
    const ph = phaseOf(t, c.i, c.bank);
    if (best === null || ph < best.ph) best = { n: c.n, ph };
  }
  return best;
};
const powerAt = (t) => DATA.cyl.filter((c) => strokeOf(t, c.i, c.bank) === 0).map((c) => c.n).sort((a, b) => a - b);
const show = () => {
  const t = cycleOf(theta);
  const fire = firingAt(t);
  for (const c of DATA.cyl) {
    const ph = phaseOf(t, c.i, c.bank);
    const glow = ph < 140 ? Math.min(1, ph / 6) * Math.exp(-ph / 28) : 0; // ignition: a fast rise, then the flame burns down
    const value = glow < 0.01 ? "0" : glow.toFixed(2);
    if (flashes[c.n] !== value) {
      flashes[c.n] = value;
      for (const el of glowsOf[c.n] ?? []) el.setAttribute("opacity", value);
    }
  }
  const q = torqueOf(t);
  const sc = DATA.scope;
  cursor.setAttribute("transform", `translate(${(-sc.w / 2 + (sc.w * t) / 720).toFixed(2)} 0)`);
  dot.setAttribute("cy", (sc.y1 - ((q - sc.lo) / (sc.hi - sc.lo)) * (sc.y1 - sc.y0)).toFixed(2));
  const text = invOf(apartTarget) > 0.5 ? `moteur démonté · ${INV.count} pièces` : `${t.toFixed(0).padStart(3, " ")}° · allumage ${fire.n} · détente ${powerAt(t).join(" ")} · ${Math.round(q)} N·m`;
  if (readout.textContent !== text) readout.textContent = text;
};
// the slider value is described on user actions only, so a screen reader is not flooded while the engine runs
const describe = () => {
  const t = cycleOf(theta);
  const speed = SPEEDS[speedIndex] ? `moteur en marche, ${SPEEDS[speedIndex]} degrés par seconde` : "moteur à l'arrêt";
  stage.setAttribute("aria-valuenow", String(Math.round(t)));
  stage.setAttribute("aria-valuetext", `vilebrequin à ${Math.round(t)} degrés, ${speed}, le cylindre ${firingAt(t).n} est le dernier allumé, les cylindres ${powerAt(t).join(", ")} sont en détente${invOf(apartTarget) > 0.5 ? `, les ${INV.count} pièces du moteur sont posées sur le tapis` : apartTarget > 0.02 ? `, moteur éclaté à ${Math.round(apartOf(apartTarget) * 100)} %` : ""}`);
};
const controller = TURN.mount(stage, DATA.turn, {
  follow,
  onHold: () => {
    touring = false;
    clearTimeout(idle);
  },
  onFrame: (turned) => {
    if (!own) {
      azimuth = target = drawnAz = turned.values.stand ?? azimuth;
      theta = drawnTheta = turned.values.theta ?? turned.values.crank ?? theta;
      // the runtime re-renders on its own (a resize) with the values we drew: only a different apart is news
      if (turned.values.apart !== undefined && Math.abs(turned.values.apart - apartOf(apart.x)) > 1e-6) {
        apart.x = drawnApart = apartTarget = turned.values.apart * EXPLODE;
        apart.v = 0;
      }
    }
    show();
  },
});
// the glows and the pieces are found after mount, in case the runtime rebuilt the live layer
for (const el of stage.querySelectorAll(".v12-flash, .v12-spark")) (glowsOf[el.dataset.n] ??= []).push(el);
for (const key of Object.keys(flashes)) delete flashes[key];
const nodesOf = ATLAS.pieces.map(() => []);
for (const el of stage.querySelectorAll("[data-name]")) {
  const entry = ATLAS.parts[el.dataset.name];
  if (entry) nodesOf[entry[0]].push(el);
}
// the inventory copies each piece from the live layer at rest (mount has just drawn it with every group at 0);
// a piece's world translation onto the mat is one screen shift, computed by the build
const invRoot = $(".v12-inv");
const laid = [];
{
  const byPiece = new Map();
  for (const node of stage.querySelector("svg[data-live] .iso-parts").children) {
    const entry = ATLAS.parts[node.dataset.name];
    if (entry) byPiece.set(entry[0], [...(byPiece.get(entry[0]) ?? []), node]);
  }
  const halos = $$(".v12-inv-halo", invRoot);
  const holder = $(".v12-inv-parts", invRoot);
  INV.pieces.forEach(([k, dx, dy, h], rank) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "v12-inv-piece");
    for (const node of byPiece.get(k) ?? []) {
      const copy = node.cloneNode(true);
      copy.removeAttribute("data-p");
      for (const el of copy.querySelectorAll(".v12-flash, .v12-spark")) el.remove();
      g.append(copy);
      nodesOf[k].push(copy);
    }
    holder.append(g);
    laid[k] = { g, dx, dy, halo: halos[h], delay: (0.45 * rank) / INV.pieces.length }; // the back of the mat lands first
  });
}
const engineLayers = $$(":scope > svg", stage);
const LIFT = 40; // viewBox px: the height each piece drops from onto the mat
let drawnInv = -1;
const applyInv = (e) => {
  const w = invOf(e);
  if (Math.abs(w - drawnInv) < 1e-4) return;
  drawnInv = w;
  invRoot.hidden = w <= 0;
  stage.toggleAttribute("data-inv", w > 0.5);
  const fade = 1 - smooth01(w / 0.6);
  for (const svg of engineLayers) svg.style.opacity = fade < 1 ? fade.toFixed(3) : "";
  invRoot.style.opacity = w < 0.3 ? smooth01(w / 0.3).toFixed(3) : "";
  for (const piece of laid) {
    if (!piece) continue;
    const p = smooth01((w - piece.delay) / 0.55);
    piece.g.setAttribute("transform", `translate(${piece.dx} ${(piece.dy - LIFT * (1 - p)).toFixed(2)})`);
    if (p < 1) piece.g.setAttribute("opacity", p.toFixed(3));
    else piece.g.removeAttribute("opacity");
    piece.halo.style.setProperty("--p", p.toFixed(3));
  }
};

// ── the view: zoom and pan on top of the turntable, eased; the exploded view zooms out to fit ──
const view = { s: 1, x: VW / 2, y: VH / 2 }; // what the reader asked for
const shown = { s: 1, x: VW / 2, y: VH / 2 }; // what is on screen now
let viewKey = "";
// the mat is framed whole in the part of the stage no side panel covers, measured again on each resize
let matFit = { s: 0.5, dx: 0, dy: 0 };
const measureMat = () => {
  const r = stage.getBoundingClientRect();
  if (!r.width) return;
  let x0 = r.left;
  let x1 = r.right;
  const mid = r.top + r.height / 2;
  for (const el of $$(".v12-systems, .v12-detail, .v12-views")) {
    const b = el.getBoundingClientRect();
    if (!b.width || b.width > innerWidth * 0.6 || b.top > mid || b.bottom < mid) continue; // phone sheets come and go: ignored
    if (b.left + b.width / 2 < r.left + r.width / 2) x0 = Math.max(x0, b.right + 16);
    else x1 = Math.min(x1, b.left - 16);
  }
  const y1 = Math.min(r.bottom, $(".v12-caption").getBoundingClientRect().top - 6);
  const u = r.width / VW;
  const [fx0, fx1, fy0, fy1] = [(x0 - r.left) / u, (x1 - r.left) / u, 6 / u, (y1 - r.top) / u];
  const [bx0, by0, bx1, by1] = INV.box;
  const s = Math.min((fx1 - fx0) / (bx1 - bx0), (fy1 - fy0) / (by1 - by0));
  matFit = { s, dx: (bx0 + bx1) / 2 - ((fx0 + fx1) / 2 - VW / 2) / s - VW / 2, dy: (by0 + by1) / 2 - ((fy0 + fy1) / 2 - VH / 2) / s - VH / 2 };
};
// the exploded engine zooms out a little; the mat is framed whole
const fitOf = (e) => {
  const k = smooth01(apartOf(e));
  const w = invOf(e);
  const s = 1 - DATA.fit.s * k;
  const dy = -DATA.fit.dy * k;
  return { s: s + (matFit.s - s) * w, dx: matFit.dx * w, dy: dy + (matFit.dy - dy) * w };
};
const goalOf = () => {
  const fit = fitOf(clamp(apartTarget, 0, 1));
  return { s: view.s * fit.s, x: view.x + fit.dx, y: view.y + fit.dy, fit };
};
const laidOut = () => invOf(apartTarget) > 0.5;
const unit = () => stage.clientWidth / VW;
const applyView = () => {
  const u = unit();
  const tx = (VW / 2 - shown.s * shown.x) * u;
  const ty = (VH / 2 - shown.s * shown.y) * u;
  const key = `${tx.toFixed(1)} ${ty.toFixed(1)} ${shown.s.toFixed(4)}`;
  if (key === viewKey) return;
  viewKey = key;
  stage.style.setProperty("--v12-view", `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${shown.s.toFixed(4)})`);
  stage.toggleAttribute("data-zoomed", shown.s > 1.02 || shown.s < 0.98);
};
const clampView = () => {
  view.s = clamp(view.s, 0.7, 6);
  if (view.s <= 1) {
    view.x = VW / 2;
    view.y = VH / 2;
  } else if (laidOut()) {
    const { fit } = goalOf(); // the centre of the view stays on the mat
    view.x = clamp(view.x, INV.box[0] - fit.dx, INV.box[2] - fit.dx);
    view.y = clamp(view.y, INV.box[1] - fit.dy, INV.box[3] - fit.dy);
  } else {
    view.x = clamp(view.x, 0, VW);
    view.y = clamp(view.y, -VH * 0.15, VH);
  }
};
const viewMoving = () => {
  const goal = goalOf();
  return Math.abs(goal.s - shown.s) > 1e-4 || Math.abs(goal.x - shown.x) > 0.02 || Math.abs(goal.y - shown.y) > 0.02;
};
// zoom by a factor about a point of the stage (CSS px from its corner), keeping that point still
const zoomAt = (factor, px = stage.clientWidth / 2, py = stage.clientHeight / 2) => {
  const u = unit();
  const goal = goalOf();
  const wx = goal.x + (px / u - VW / 2) / goal.s;
  const wy = goal.y + (py / u - VH / 2) / goal.s;
  view.s = clamp(view.s * factor, 0.7, 6);
  const s = view.s * goal.fit.s;
  view.x = wx - goal.fit.dx - (px / u - VW / 2) / s;
  view.y = wy - goal.fit.dy - (py / u - VH / 2) / s;
  clampView();
  run();
};
const resetView = () => {
  view.s = 1;
  view.x = VW / 2;
  view.y = VH / 2;
  run();
};

// ── the loop ───────────────────────────────────────────────────────────────────
const hold = () => {
  touring = false;
  clearTimeout(idle);
  if (tourOn)
    idle = setTimeout(() => {
      touring = tourOn && !still.matches;
      run();
    }, 4000);
};
const draw = () => {
  own = true;
  const a = performance.now();
  controller.set({ stand: azimuth, theta, apart: apartOf(apart.x) });
  cost = cost * 0.9 + (performance.now() - a) * 0.1;
  own = false;
  drawnTheta = theta;
  drawnAz = azimuth;
  drawnApart = apart.x;
};
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  const laid_ = laidOut(); // laid out on the mat, the engine neither runs nor tours
  if (!calm && !laid_) theta += SPEEDS[speedIndex] * dt;
  if (touring && !calm && !laid_) target += TOUR * dt;
  azimuth = calm ? target : azimuth + (target - azimuth) * (1 - Math.exp(-dt / 0.14));
  if (Math.abs(target - azimuth) < 1e-3) azimuth = target;
  // the exploded view rides a critically damped spring (0.35 s)
  const springing = Math.abs(apartTarget - apart.x) > 1e-4 || Math.abs(apart.v) > 1e-4;
  if (calm) {
    apart.x = apartTarget;
    apart.v = 0;
  } else if (springing) {
    const w = 1 / 0.35;
    for (let k = 0; k < 4; k++) {
      const h = dt / 4;
      apart.v += (w * w * (apartTarget - apart.x) - 2 * w * apart.v) * h;
      apart.x += apart.v * h;
    }
  } else apart.x = apartTarget;
  apart.x = clamp(apart.x, 0, 1);
  applyInv(apart.x);
  const goal = goalOf();
  const ease = calm ? 1 : 1 - Math.exp(-dt / 0.12);
  shown.s += (goal.s - shown.s) * ease;
  shown.x += (goal.x - shown.x) * ease;
  shown.y += (goal.y - shown.y) * ease;
  applyView();
  // half rate: above 14 ms a frame, the live layers render every other frame (motion stays time-based)
  if (cost > 14) half = true;
  else if (cost < 9) half = false;
  skip = half ? !skip : false;
  const changed = drawnTheta === null || Math.abs(theta - drawnTheta) > 1e-4 || Math.abs(azimuth - drawnAz) > 1e-4 || Math.abs(apart.x - drawnApart) > 1e-5;
  if (changed && !skip && invOf(apart.x) < 1) draw(); // the engine is not drawn while it is hidden by the mat
  if (now - liveAt > 120) {
    liveAt = now;
    updateLive();
  }
  const settled = calm || ((SPEEDS[speedIndex] === 0 || laid_) && (!touring || laid_) && azimuth === target && !springing && !viewMoving());
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  },
  { rootMargin: "120px 0px" },
).observe(stage);
new ResizeObserver(() => {
  viewKey = "";
  measureMat();
  applyView();
  run();
}).observe(stage);

// ── pieces: hover, pick, select, isolate, systems ─────────────────────────────────
const tip = $(".v12-tip");
const detail = $(".v12-detail");
let hovered = -1;
let sel = { pieces: [], group: -1, part: null };
let isolated = false;
const shownSystems = new Set(ATLAS.systems.map((s) => s.id));
const off = new Uint8Array(ATLAS.pieces.length);
const mark = (k, attr, on) => {
  if (k < 0) return;
  for (const el of nodesOf[k]) el.toggleAttribute(attr, on);
  if (attr === "data-off" && laid[k]) laid[k].halo.toggleAttribute(attr, on);
};
const pieceOf = (el) => {
  const named = el && el.closest ? el.closest("[data-name]") : null;
  const entry = named && stage.contains(named) ? ATLAS.parts[named.dataset.name] : null;
  return entry && !off[entry[0]] ? { k: entry[0], part: named.dataset.name } : null;
};
const pieceAt = (x, y) => {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!stage.contains(el)) continue;
    const found = pieceOf(el);
    if (found) return found;
  }
  return null;
};
const hoverOn = (found, x, y) => {
  const k = found ? found.k : -1;
  if (k !== hovered) {
    mark(hovered, "data-hover", false);
    hovered = k;
    mark(k, "data-hover", true);
  }
  if (k < 0) {
    tip.hidden = true;
    return;
  }
  const p = ATLAS.pieces[k];
  const zone = ATLAS.parts[found.part][2];
  tip.innerHTML = `<i style="--c:${SYSTEM[p.system].color}"></i><b>${esc(p.name)}</b>${zone ? `<span>${esc(zone)}</span>` : ""}`;
  tip.hidden = false;
  const r = plate.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  tip.style.left = `${clamp(x - r.left + 14, 8, r.width - w - 8)}px`;
  tip.style.top = `${clamp(y - r.top + 18, 8, r.height - h - 8)}px`;
};
const applyVisibility = () => {
  const picked = new Set(sel.pieces);
  let count = 0;
  ATLAS.pieces.forEach((p, k) => {
    const on = isolated ? picked.has(k) : shownSystems.has(p.system) || picked.has(k);
    if (on) count++;
    if (off[k] === (on ? 0 : 1)) return;
    off[k] = on ? 0 : 1;
    mark(k, "data-off", !on);
  });
  if (hovered >= 0 && off[hovered]) hoverOn(null);
  stage.toggleAttribute("data-isolated", isolated);
  stage.toggleAttribute("data-bare", off[ATLAS.pieces.findIndex((p) => p.id === "socle")] === 1);
  $("[data-visible]").textContent = `${count} pièce${count > 1 ? "s" : ""} visible${count > 1 ? "s" : ""}`;
  for (const input of $$("[data-toggle]")) input.checked = shownSystems.has(input.dataset.toggle);
  for (const row of $$(".v12-sys")) row.toggleAttribute("data-on", shownSystems.has(row.dataset.sys));
  const only = (list) => shownSystems.size === list.length && list.every((id) => shownSystems.has(id));
  for (const button of $$("[data-preset]")) button.setAttribute("aria-pressed", String(only(PRESETS[button.dataset.preset])));
  caption();
};
const PRESETS = {
  all: ATLAS.systems.map((s) => s.id),
  moving: ["mobile", "distribution"],
  flow: ["culasses", "admission", "injection", "echappement", "allumage"],
};
const select = (pieces, { group = -1, part = null, focus = false } = {}) => {
  hoverOn(null);
  for (const k of sel.pieces) mark(k, "data-pick", false);
  sel = { pieces, group, part };
  for (const k of pieces) mark(k, "data-pick", true);
  if (pieces.length) {
    tourOn = touring = false; // stay on the piece the reader is studying
    clearTimeout(idle);
  } else isolated = false;
  applyVisibility();
  renderDetail(focus);
  if (isolated) fitSelection();
  sync();
  run();
};
const fitSelection = () => {
  let box = null;
  const add = (b, dx = 0, dy = 0) => {
    if (!b.width && !b.height) return;
    const [x0, y0, x1, y1] = [b.x + dx, b.y + dy, b.x + b.width + dx, b.y + b.height + dy];
    box = box ? { x0: Math.min(box.x0, x0), y0: Math.min(box.y0, y0), x1: Math.max(box.x1, x1), y1: Math.max(box.y1, y1) } : { x0, y0, x1, y1 };
  };
  // on the mat, the copies where they land; otherwise the engine's own pieces (the hidden copies measure nothing)
  for (const k of sel.pieces)
    if (laidOut()) laid[k] && add(laid[k].g.getBBox(), laid[k].dx, laid[k].dy);
    else for (const el of nodesOf[k]) if (!invRoot.contains(el)) add(el.getBBox());
  if (!box) return;
  const fit = goalOf().fit;
  const s = Math.min((VW * 0.62) / Math.max(box.x1 - box.x0, 1), (VH * 0.62) / Math.max(box.y1 - box.y0, 1), 5);
  view.s = clamp(s / fit.s, 0.7, 6);
  view.x = (box.x0 + box.x1) / 2 - fit.dx;
  view.y = (box.y0 + box.y1) / 2 - fit.dy;
  run();
};
const isolate = (on = !isolated) => {
  if (!sel.pieces.length) return;
  isolated = on;
  applyVisibility();
  if (isolated) fitSelection();
  else resetView();
  renderDetail();
};

// ── the detail sheet: what the piece is, what it does, and what it does right now ──
const STROKE_FROM = ["PMH", "PMB", "PMH", "PMB"];
const cylinderState = (p, t) => {
  const bank = bankOf(p.bank);
  const ph = phaseOf(t, p.i, bank);
  const stroke = Math.floor(ph / 180);
  return { bank, ph, stroke, text: `${STROKES[stroke]}, ${Math.round(ph % 180)}° après le ${STROKE_FROM[stroke]}` };
};
const valveLift = (p, t, cam) => liftOf(t + (bankOf(p.bank) ? 0 : 60), p.i, cam) * 2; // mm; bank A fires 60° before bank B
const gas = (p, t) => {
  const bank = bankOf(p.bank);
  const ph = phaseOf(t, p.i, bank);
  const { s, pin } = slider(t, p.i, bank);
  const ax = axisOf(bank);
  const e = [pin[0] - s * ax[1], pin[1] - s * ax[2]];
  const len = Math.hypot(e[0], e[1]);
  const cosB = -(e[0] * ax[1] + e[1] * ax[2]) / len;
  const bar = pressureOf(ph);
  const force = ((bar - 1) * 1e5 * Math.PI * 0.0475 ** 2) / 1000; // kN on the crown, gauge pressure
  return { s, bar, force, rod: force / cosB, lean: (Math.acos(clamp(cosB, -1, 1)) * 180) / Math.PI };
};
const liveRows = (p) => {
  const t = cycleOf(theta);
  const rows = [];
  if (p.cyl) rows.push(["Temps du cylindre", cylinderState(p, t).text]);
  switch (p.kind) {
    case "piston": {
      const g = gas(p, t);
      rows.push(["Position", `${num((M.CR + M.ROD - g.s) * 2)} mm sous le point mort haut`], ["Pression", `${num(g.bar, 0)} bar`], ["Poussée des gaz", `${num(g.force)} kN`]);
      break;
    }
    case "bielle": {
      const g = gas(p, t);
      rows.push(["Inclinaison", `${num(g.lean)}° sur l'axe du cylindre`], ["Effort dans la bielle", `${num(g.rod)} kN`]);
      break;
    }
    case "poussoir": {
      const lift = liftOf(t, p.i, p.cam) * 2;
      rows.push(["Levée", lift > 0.05 ? `${num(lift)} mm, soupape ouverte` : "0 mm, soupape fermée"]);
      break;
    }
    case "bobine":
    case "bougie":
    case "capuchon": {
      const ph = phaseOf(t, p.i, bankOf(p.bank));
      rows.push(["Allumage", ph < 8 ? "étincelle maintenant" : `il y a ${Math.round(ph)}°, prochain dans ${Math.round(720 - ph)}°`]);
      break;
    }
    case "conduit":
    case "papillon":
    case "cornet":
    case "injecteur": {
      const lift = valveLift(p, t, "in");
      rows.push(["Soupapes d'admission", lift > 0.05 ? `ouvertes, ${num(lift)} mm : l'air entre` : "fermées"]);
      break;
    }
    case "primaire": {
      const lift = valveLift(p, t, "ex");
      rows.push(["Soupapes d'échappement", lift > 0.05 ? `ouvertes, ${num(lift)} mm : les gaz sortent` : "fermées"]);
      break;
    }
    case "vilebrequin":
    case "amortisseur":
    case "volant":
      rows.push(["Angle du vilebrequin", `${Math.round(t)}° sur 720°`], ["Couple", `${Math.round(torqueOf(t))} N·m (591 en moyenne)`], ["En détente", `cylindres ${powerAt(t).join(", ")}`]);
      break;
    case "arbre":
    case "pignon": {
      const open = [1, 2, 3, 4, 5, 6].filter((i) => liftOf(t, i, p.cam) > 0.025).map((i) => i + 6);
      rows.push(["Angle de l'arbre", `${Math.round(t / 2)}° (moitié du vilebrequin)`], ["Soupapes ouvertes", open.length ? `cylindres ${open.join(", ")}` : "aucune"]);
      break;
    }
    case "ecran":
      rows.push(["Couple", `${Math.round(torqueOf(t))} N·m`], ["Un cylindre seul", `${Math.round(torqueOf(t, { i: 1, bank: 0 }))} N·m`]);
      break;
    case "plateau":
      rows.push(["Orientation", `${Math.round((((-azimuth % 360) + 360) % 360))}°`]);
      break;
  }
  return rows;
};
const updateLive = () => {
  const box = detail.querySelector("[data-live]");
  if (!box || sel.pieces.length !== 1) return;
  const html = liveRows(ATLAS.pieces[sel.pieces[0]]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  if (box.dataset.html !== html) {
    box.dataset.html = html;
    box.innerHTML = html;
    box.hidden = !html;
  }
};
const ICON = DATA.icons;
const chip = (k, label = ATLAS.pieces[k].name) => `<button type="button" class="v12-chip" data-piece="${k}"><i style="--c:${SYSTEM[ATLAS.pieces[k].system].color}"></i>${esc(label)}</button>`;
const renderDetail = (focus = false) => {
  app.toggleAttribute("data-picked", sel.pieces.length > 0);
  if (!sel.pieces.length) {
    detail.innerHTML = $("#v12-intro").innerHTML;
    detail.dataset.state = "intro";
    if (app.dataset.sheet === "detail") app.dataset.sheet = "";
    return;
  }
  const actions = `<div class="v12-actions"><button type="button" class="v12-btn v12-primary" data-act="isolate" aria-pressed="${isolated}">${ICON.focus}<span>${isolated ? "Montrer tout le moteur" : sel.pieces.length > 1 ? "Isoler ces pièces" : "Isoler la pièce"}</span></button><button type="button" class="v12-btn v12-ghost" data-act="clear">Effacer la sélection</button></div>`;
  const close = `<button type="button" class="v12-btn v12-icon v12-close" data-act="clear" aria-label="Fermer la fiche">${ICON.close}</button>`;
  if (sel.group >= 0 || sel.pieces.length > 1) {
    const group = ATLAS.groups[sel.group];
    const systems = [...new Set(sel.pieces.map((k) => ATLAS.pieces[k].system))];
    const head = systems.length === 1 ? SYSTEM[systems[0]] : null;
    detail.innerHTML = `<div class="v12-detail-head" style="--c:${head ? head.color : "var(--v12-muted)"}"><div class="v12-eyebrow">${head ? `<i style="--c:${head.color}"></i>${esc(head.name)}` : "Groupe de pièces"}</div><h2 class="v12-h2" tabindex="-1">${esc(group ? group.name : `${sel.pieces.length} pièces`)}</h2>${close}</div><div class="v12-scroll"><p class="v12-text">${esc(head ? head.text : "Ces pièces appartiennent à plusieurs systèmes ; elles sont surlignées dans le moteur. Choisissez-en une pour lire sa fiche.")}</p><div class="v12-meta"><span>Pièces<b>${sel.pieces.length}</b></span><span>Formes dessinées<b>${sel.pieces.reduce((n, k) => n + ATLAS.pieces[k].parts.length, 0)}</b></span></div><h3 class="v12-h3">Pièces incluses</h3><div class="v12-members">${sel.pieces.map((k) => `<button type="button" class="v12-member" data-piece="${k}"><i style="--c:${SYSTEM[ATLAS.pieces[k].system].color}"></i><span>${esc(ATLAS.pieces[k].name)}</span>${ICON.chevron}</button>`).join("")}</div></div>${actions}`;
  } else {
    const k = sel.pieces[0];
    const p = ATLAS.pieces[k];
    const kind = ATLAS.kinds[p.kind];
    const system = SYSTEM[p.system];
    const [, sub, zone] = sel.part ? ATLAS.parts[sel.part] : [k, null, null];
    const subText = sub && kind.sub ? kind.sub[sub] : null;
    const siblings = p.cyl ? ATLAS.pieces.flatMap((q, j) => (j !== k && q.cyl === p.cyl ? [j] : [])) : [];
    const cylGroup = p.cyl ? ATLAS.groups.findIndex((g) => g.id === `g.cyl.${p.cyl}`) : -1;
    detail.innerHTML = `<div class="v12-detail-head" style="--c:${system.color}"><div class="v12-eyebrow">${esc(system.name)}</div><h2 class="v12-h2" tabindex="-1">${esc(p.name)}</h2>${zone ? `<p class="v12-zone">Zone pointée : <b>${esc(zone)}</b></p>` : ""}${close}</div><div class="v12-scroll">${subText ? `<p class="v12-text v12-lead">${esc(subText)}</p>` : ""}<p class="v12-text">${esc(kind.text)}</p>${p.extra ? `<p class="v12-text">${esc(p.extra)}</p>` : ""}${kind.note ? `<p class="v12-note">${esc(kind.note)}</p>` : ""}<dl class="v12-live" data-live hidden></dl><div class="v12-meta"><span>Référence<b>${esc(p.id)}</b></span><span>Formes dessinées<b>${p.parts.length}</b></span>${p.bank ? `<span>Rangée<b>${p.bank.toUpperCase()}</b></span>` : ""}</div>${siblings.length ? `<h3 class="v12-h3">Le même cylindre</h3><div class="v12-chips">${siblings.map((j) => chip(j)).join("")}${cylGroup >= 0 ? `<button type="button" class="v12-chip v12-chip-all" data-group="${cylGroup}">Tout le cylindre ${p.cyl}</button>` : ""}</div>` : ""}</div>${actions}`;
  }
  detail.dataset.state = "piece";
  liveAt = 0;
  updateLive();
  if (focus) detail.querySelector(".v12-h2")?.focus({ preventScroll: true });
};

// ── the caption above the stage says what the stage shows ─────────────────────────
const caption = () => {
  const out = $("[data-caption]");
  let text = "V12 à 60° · 6,5 L · 12 cylindres";
  const e = apartTarget;
  const a = apartOf(e);
  if (isolated) text = sel.group >= 0 ? ATLAS.groups[sel.group].name : sel.pieces.length === 1 ? ATLAS.pieces[sel.pieces[0]].name : `${sel.pieces.length} pièces isolées`;
  else if (invOf(e) > 0.5) text = `Chaque pièce · ${INV.count} pièces sur le tapis`;
  else if (a > 0.66) text = "Vue éclatée · pistons sortis";
  else if (a > 0.33) text = "Vue éclatée · accessoires déposés";
  else if (a > 0.02) text = "Culasses soulevées";
  else if (shownSystems.size === 0) text = "Tous les systèmes masqués";
  else if (shownSystems.size < ATLAS.systems.length) text = shownSystems.size === 1 ? SYSTEM[[...shownSystems][0]].name : `${shownSystems.size} systèmes sur ${ATLAS.systems.length}`;
  if (out.textContent !== text) out.textContent = text;
};

// ── search: every piece and every group, by name, reference or another word for it ──
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ENTRIES = [
  ...ATLAS.groups.map((g, k) => ({ group: k, name: g.name, key: norm(`${g.name} ${g.id}`), meta: `${g.pieces.length} pièces` })),
  ...ATLAS.pieces.map((p, k) => ({ piece: k, name: p.name, key: norm(`${p.name} ${p.id} ${p.words}`), meta: SYSTEM[p.system].name })),
];
const search = $(".v12-search");
const field = search.querySelector("input");
const list = search.querySelector(".v12-results");
let results = [];
let active = 0;
const entryOf = (id) => ENTRIES.find((e) => (e.group !== undefined ? ATLAS.groups[e.group].id : ATLAS.pieces[e.piece].id) === id);
const find = (query) => {
  const words = norm(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ATLAS.suggest.map(entryOf).filter(Boolean);
  const name = (e) => norm(e.name);
  return ENTRIES.filter((e) => words.every((w) => e.key.includes(w)))
    .sort((a, b) => Number(!name(b).startsWith(words[0])) - Number(!name(a).startsWith(words[0])) || Number(!words.every((w) => name(a).includes(w))) - Number(!words.every((w) => name(b).includes(w))) || a.name.length - b.name.length)
    .slice(0, 60);
};
const renderResults = () => {
  results = find(field.value);
  active = clamp(active, 0, Math.max(0, results.length - 1));
  list.innerHTML = results.length
    ? results.map((e, j) => `<li role="option" id="v12-r${j}" aria-selected="${j === active}" data-j="${j}"><i style="--c:${e.piece !== undefined ? SYSTEM[ATLAS.pieces[e.piece].system].color : "var(--anatomy-muted)"}"></i><span>${esc(e.name)}</span><small>${esc(e.meta)}</small></li>`).join("")
    : `<li class="v12-empty">Aucune pièce ne correspond.</li>`;
  field.setAttribute("aria-activedescendant", results.length ? `v12-r${active}` : "");
  $("[data-search-note]").textContent = field.value.trim() ? `${results.length} résultat${results.length > 1 ? "s" : ""}${results.length === 60 ? ", affinez la recherche" : ""}` : "Suggestions. Tapez un nom de pièce, un numéro de cylindre ou un mot anglais.";
  list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
};
const openSearch = () => {
  search.hidden = false;
  app.dataset.sheet = "search";
  field.value = "";
  active = 0;
  renderResults();
  field.focus();
};
const closeSearch = (refocus = true) => {
  if (search.hidden) return;
  search.hidden = true;
  if (app.dataset.sheet === "search") app.dataset.sheet = "";
  if (refocus) stage.focus({ preventScroll: true });
};
const choose = (e) => {
  if (!e) return;
  closeSearch(false);
  if (e.group !== undefined) select(ATLAS.groups[e.group].pieces, { group: e.group, focus: true });
  else select([e.piece], { focus: true });
  if (matchMedia("(max-width: 1179px)").matches) app.dataset.sheet = "detail";
};
field.addEventListener("input", () => {
  active = 0;
  renderResults();
});
field.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    active = clamp(active + (event.key === "ArrowDown" ? 1 : -1), 0, results.length - 1);
    renderResults();
  } else if (event.key === "Enter") {
    event.preventDefault();
    choose(results[active]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeSearch();
  }
});
list.addEventListener("click", (event) => {
  const li = event.target.closest("[data-j]");
  if (li) choose(results[Number(li.dataset.j)]);
});

// ── the dock and the panels ─────────────────────────────────────────────────────
const slider_ = $("#v12-apart");
const VIEWS = DATA.views;
const nearest = (angle) => azimuth + ((((angle - azimuth) % 360) + 540) % 360) - 180;
const sync = () => {
  slider_.value = String(Math.round(apartTarget * 100));
  $("[data-apart]").textContent = `${Math.round(apartTarget * 100)} %`;
  const runButton = $('[data-act="run"]');
  runButton.setAttribute("aria-pressed", String(speedIndex > 0));
  runButton.setAttribute("aria-label", speedIndex > 0 ? "Arrêter le moteur" : "Faire tourner le moteur");
  runButton.innerHTML = speedIndex > 0 ? ICON.pause : ICON.play;
  for (const b of $$("[data-speed]")) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === speedIndex));
  $('[data-act="tour"]').setAttribute("aria-pressed", String(tourOn));
  const az = ((target % 360) + 360) % 360;
  for (const b of $$("[data-view]")) b.setAttribute("aria-pressed", String(Math.abs(((az - VIEWS[b.dataset.view] + 540) % 360) - 180) < 0.5));
  // on the mat the engine is in pieces: it neither runs nor turns
  const laid_ = laidOut();
  for (const b of $$('[data-view], [data-act="tour"], [data-act="run"], [data-speed]')) b.disabled = laid_;
  app.toggleAttribute("data-laid", laid_);
  show();
  caption();
};
const setApart = (value) => {
  apartTarget = clamp(value, 0, 1);
  if (invOf(apartTarget) > 0) {
    measureMat();
    target = nearest(VIEWS.iso); // the copies on the mat are drawn from this side: the engine turns to it as it fades
    touring = false;
    clearTimeout(idle);
  }
  sync();
  describe();
  if (isolated) setTimeout(fitSelection, 380);
  run();
};
slider_.addEventListener("input", () => {
  hold();
  setApart(Number(slider_.value) / 100);
});
const actions = {
  search: openSearch,
  "close-search": () => closeSearch(),
  about: () => $(".v12-about").showModal(),
  systems: () => (app.dataset.sheet = app.dataset.sheet === "systems" ? "" : "systems"),
  close: () => (app.dataset.sheet = ""),
  "hide-all": () => {
    shownSystems.clear();
    applyVisibility();
  },
  clear: () => select([]),
  isolate: () => isolate(),
  run: () => {
    if (speedIndex) {
      lastSpeed = speedIndex;
      speedIndex = 0;
    } else speedIndex = lastSpeed;
    sync();
    describe();
    run();
  },
  tour: () => {
    tourOn = touring = !tourOn && !still.matches;
    clearTimeout(idle);
    sync();
    run();
  },
  "zoom-in": () => zoomAt(1.4),
  "zoom-out": () => zoomAt(1 / 1.4),
  reset: () => {
    select([]);
    shownSystems.clear();
    for (const s of ATLAS.systems) shownSystems.add(s.id);
    applyVisibility();
    speedIndex = lastSpeed = 2;
    tourOn = touring = !still.matches;
    target = nearest(VIEWS.iso);
    resetView();
    setApart(0);
  },
};
app.addEventListener("click", (event) => {
  const button = event.target.closest("button, [data-piece], [data-group]");
  if (!button || !app.contains(button)) return;
  if (button.dataset.act && actions[button.dataset.act]) actions[button.dataset.act]();
  else if (button.dataset.to !== undefined) {
    hold();
    setApart(Number(button.dataset.to));
  } else if (button.dataset.piece !== undefined) select([Number(button.dataset.piece)]);
  else if (button.dataset.group !== undefined) select(ATLAS.groups[Number(button.dataset.group)].pieces, { group: Number(button.dataset.group) });
  else if (button.dataset.view) {
    target = nearest(VIEWS[button.dataset.view]);
    tourOn = touring = false;
    clearTimeout(idle);
    sync();
    run();
  } else if (button.dataset.speed) {
    speedIndex = lastSpeed = Number(button.dataset.speed);
    sync();
    describe();
    run();
  } else if (button.dataset.preset) {
    shownSystems.clear();
    for (const id of PRESETS[button.dataset.preset]) shownSystems.add(id);
    applyVisibility();
  } else if (button.dataset.only) {
    shownSystems.clear();
    shownSystems.add(button.dataset.only);
    applyVisibility();
  }
});
app.addEventListener("change", (event) => {
  const id = event.target.dataset.toggle;
  if (!id) return;
  if (event.target.checked) shownSystems.add(id);
  else shownSystems.delete(id);
  applyVisibility();
});
document.addEventListener("keydown", (event) => {
  const typing = event.target.closest("input, textarea, select");
  if (event.key === "/" && !typing) {
    event.preventDefault();
    openSearch();
  } else if (event.key === "Escape" && !typing && !$(".v12-about").open) {
    if (!search.hidden) closeSearch();
    else if (app.dataset.sheet) app.dataset.sheet = "";
    else if (isolated) isolate(false);
    else if (sel.pieces.length) select([]);
  }
});

// ── the stage: drag turns, a tap picks, shift-drag or right-drag pans, wheel and pinch zoom ──
const pointers = new Map();
let gesture = null;
const pinchState = () => {
  const [a, b] = [...pointers.values()];
  const r = stage.getBoundingClientRect();
  return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
};
stage.addEventListener("pointerdown", (event) => {
  if (event.button === 1) event.preventDefault();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY, t0: performance.now() });
  hold();
  if (pointers.size === 2) {
    const start = pinchState();
    gesture = { type: "pinch", start, view: { ...view }, goal: goalOf() };
    hoverOn(null);
  } else if (pointers.size === 1) gesture = { type: event.button === 1 || event.button === 2 || event.shiftKey || laidOut() ? "pan" : "turn", started: false, base: target, view: { ...view }, id: event.pointerId };
  else gesture = { type: "none" };
});
stage.addEventListener("pointermove", (event) => {
  const p = pointers.get(event.pointerId);
  if (!p) {
    if (event.pointerType === "mouse") hoverOn(pieceOf(event.target), event.clientX, event.clientY);
    return;
  }
  p.x = event.clientX;
  p.y = event.clientY;
  if (!gesture || gesture.type === "none") return;
  if (gesture.type === "pinch") {
    const now = pinchState();
    const u = unit();
    const s0 = gesture.goal.s;
    const wx = gesture.goal.x + (gesture.start.mx / u - VW / 2) / s0; // the world point under the fingers when they landed
    const wy = gesture.goal.y + (gesture.start.my / u - VH / 2) / s0;
    view.s = clamp(gesture.view.s * (now.d / Math.max(gesture.start.d, 1)), 0.7, 6);
    const s = view.s * gesture.goal.fit.s;
    view.x = wx - gesture.goal.fit.dx - (now.mx / u - VW / 2) / s;
    view.y = wy - gesture.goal.fit.dy - (now.my / u - VH / 2) / s;
    clampView();
    run();
    return;
  }
  const dx = p.x - p.x0;
  const dy = p.y - p.y0;
  if (!gesture.started) {
    if (Math.hypot(dx, dy) < (event.pointerType === "mouse" ? 4 : 9)) return;
    gesture.started = true;
    stage.setPointerCapture(event.pointerId);
    stage.setAttribute("data-drag", gesture.type);
    hoverOn(null);
  }
  if (gesture.type === "turn") target = gesture.base - dx * 0.45;
  else {
    const s = gesture.view.s * goalOf().fit.s * unit();
    view.x = gesture.view.x - dx / s;
    view.y = gesture.view.y - dy / s;
    clampView();
  }
  hold();
  run();
});
const release = (event) => {
  const p = pointers.get(event.pointerId);
  if (!p) return;
  pointers.delete(event.pointerId);
  const tap = gesture && (gesture.type === "turn" || gesture.type === "pan") && !gesture.started && event.type === "pointerup" && performance.now() - p.t0 < 700 && event.button !== 2;
  if (gesture && gesture.type === "pinch") gesture = pointers.size ? { type: "none" } : null;
  else if (!pointers.size) gesture = null;
  stage.removeAttribute("data-drag");
  try {
    stage.releasePointerCapture(event.pointerId);
  } catch {}
  if (tap) {
    const found = pieceAt(event.clientX, event.clientY);
    if (found) {
      select([found.k], { part: found.part });
      if (event.pointerType !== "mouse" && matchMedia("(max-width: 1179px)").matches) app.dataset.sheet = "detail";
    } else if (sel.pieces.length && !isolated) select([]);
  }
  describe();
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("pointerleave", (event) => {
  if (!pointers.has(event.pointerId)) hoverOn(null);
});
stage.addEventListener("contextmenu", (event) => event.preventDefault());
stage.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const r = stage.getBoundingClientRect();
    hold();
    zoomAt(Math.exp(-event.deltaY * (event.deltaMode ? 0.05 : 0.0018)), event.clientX - r.left, event.clientY - r.top);
  },
  { passive: false },
);
stage.addEventListener("keydown", (event) => {
  let used = true;
  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && laidOut()) {
    view.x += ((event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 180 : 60)) / goalOf().s; // on the mat the arrows pan
    clampView();
  } else if (event.key === "ArrowLeft") target += event.shiftKey ? 45 : 15;
  else if (event.key === "ArrowRight") target -= event.shiftKey ? 45 : 15;
  else if (event.key === "ArrowUp") speedIndex = lastSpeed = Math.min(SPEEDS.length - 1, speedIndex + 1);
  else if (event.key === "ArrowDown") speedIndex = Math.max(0, speedIndex - 1);
  else if (event.key === " ") return actions.run(), event.preventDefault();
  else if (event.key === "." || event.key === ">") theta += 60;
  else if (event.key === "e" || event.key === "E") return setApart(apartTarget > 0.02 ? 0 : EXPLODE), event.preventDefault();
  else if (event.key === "+" || event.key === "=") zoomAt(1.4);
  else if (event.key === "-" || event.key === "_") zoomAt(1 / 1.4);
  else if (event.key === "0") resetView();
  else if (event.key === "i" || event.key === "I") isolate();
  else used = false;
  if (!used) return;
  if (speedIndex) lastSpeed = speedIndex;
  event.preventDefault();
  hold();
  sync();
  describe();
  run();
});

// ── agents: the same search and inspection, for browsers that expose WebMCP ─────────
const context = document.modelContext;
if (context && context.registerTool) {
  const tools = [
    {
      name: "find_engine_part",
      description: "Find pieces or groups of pieces of this V12 engine by name (French or English), reference or cylinder number.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1 } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: ({ query }) => find(String(query)).slice(0, 30).map((e) => (e.group !== undefined ? { id: ATLAS.groups[e.group].id, name: e.name, pieces: ATLAS.groups[e.group].pieces.length } : { id: ATLAS.pieces[e.piece].id, name: e.name, system: e.meta })),
    },
    {
      name: "inspect_engine_part",
      description: "Select a piece or group of the V12 by its id and open its explanation sheet.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: ({ id }) => {
        const e = entryOf(String(id));
        if (!e) throw new Error("No piece or group with that id in this engine.");
        choose(e);
        const p = e.piece !== undefined ? ATLAS.pieces[e.piece] : null;
        return p ? { id: p.id, name: p.name, system: SYSTEM[p.system].name, text: ATLAS.kinds[p.kind].text } : { id, name: e.name, pieces: ATLAS.groups[e.group].pieces.length };
      },
    },
  ];
  for (const tool of tools)
    try {
      Promise.resolve(context.registerTool(tool)).catch(() => {});
    } catch {} // optional: the page works the same without it
}

renderDetail();
applyVisibility();
applyInv(apart.x);
sync();
draw();
show();
describe();
applyView();
