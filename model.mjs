// The V12's truth: geometry and kinematics in world units (1 unit = 2 mm).
// 60° V12, bore 95 mm, stroke 76.4 mm (6.5 L, like a Lamborghini L539), rod 155 mm.
// Cylinders 1–6 are bank A (+y), 7–12 bank B (−y); B_i shares crank pin i with A_i.
// Firing order 1-7-5-11-3-9-6-12-2-8-4-10: one power stroke every 60° of crank.

export const M = {
  H: 72, // crank axis height above the platter top
  BORE: 23.75, // piston radius
  CR: 19.1, // crank radius (half the stroke)
  ROD: 77.5, // rod length, eye to eye
  PITCH: 53, // cylinder spacing along the crank
  OFFSET: 5.5, // bank offset along x from the throw centre
  BANK: [60, 120], // cylinder axis angle in the yz plane: A at 60°, B at 120°
  FIRE: [0, 480, 240, 600, 120, 360], // crank angle of A_i's ignition (throw i = 1..6)
  SMALL: 7, // rod small-end radius
  PISTON: 20, // piston length
  CAM: { rb: 7.5, rn: 3.6, offset: 8.4 }, // a lobe is the hull of the base circle and the nose: 4.5 units (9 mm) of lift
  PEAK_IN: 470, // full intake lift, crank degrees after ignition (110° after top dead centre)
  LIFT: 64, // how far each head lifts off along its bank axis in the exploded view
  PEAK_EX: 250, // full exhaust lift (110° before top dead centre)
  // the second and third stages of the exploded view, each relative to the part it leaves
  OUT: { coils: 16, cams: 28, plugs: 18, intake: 34, exhaust: 28, piston: 46 },
};

// the exploded view in three overlapping stages: the heads lift, then what sits on them
// comes off, then the pistons leave their bores (by then the heads are clear above them)
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const stagesOf = (apart) => ({ heads: smooth(0, 0.4, apart), parts: smooth(0.3, 0.7, apart), pistons: smooth(0.6, 1, apart) });
// a valve lifts while the cam is within ±acos((rb − rn)/offset) of full lift: 124° of cam, 248° of crank

export const throwX = (i) => (i - 3.5) * M.PITCH; // i = 1..6
export const cylX = (i, bank) => throwX(i) + (bank ? M.OFFSET : -M.OFFSET);
export const axisOf = (bank) => {
  const a = (M.BANK[bank] * Math.PI) / 180;
  return [0, Math.cos(a), Math.sin(a)];
};
// ignition angle of cylinder (i, bank): B fires 60° after A on the same pin
export const fireOf = (i, bank) => M.FIRE[i - 1] + (bank ? 60 : 0);
// crank pin angle (deg, atan2(z, y)) of throw i at crank angle 0: on bank A's axis at A's ignition
export const pinAt0 = (i) => (((M.BANK[0] - M.FIRE[i - 1]) % 360) + 360) % 360;

// wrist-pin distance from the crank axis along the cylinder axis, and the crank pin (y, z)
export function slider(theta, i, bank) {
  const phi = ((pinAt0(i) + theta) * Math.PI) / 180;
  const alpha = phi - (M.BANK[bank] * Math.PI) / 180;
  const s = M.CR * Math.cos(alpha) + Math.sqrt(M.ROD ** 2 - (M.CR * Math.sin(alpha)) ** 2);
  return { s, pin: [M.CR * Math.cos(phi), M.CR * Math.sin(phi)] };
}

// the stroke of a cylinder at crank angle theta (0…720)
export function liftOf(theta, i, cam) {
  const peak = cam === "in" ? M.PEAK_IN : M.PEAK_EX;
  const delta = ((((theta - M.FIRE[i - 1] - 60 - peak) / 2) % 360) + 540) % 360 - 180;
  return Math.max(0, M.CAM.offset * Math.cos((delta * Math.PI) / 180) + M.CAM.rn - M.CAM.rb);
}

export const STROKES = ["détente", "échappement", "admission", "compression"];
export function phaseOf(theta, i, bank) {
  return ((((theta - fireOf(i, bank)) % 720) + 720) % 720);
}
export const strokeOf = (theta, i, bank) => Math.floor(phaseOf(theta, i, bank) / 180);

// cylinder pressure over the cycle (bar), a simple Otto-like model: compression, a peak
// 15° after ignition, expansion until the exhaust opens 40° before bottom dead centre.
export function pressureOf(phase) {
  const s = (x) => {
    const a = (x * Math.PI) / 180;
    const lam = M.CR / M.ROD;
    return 1 - Math.cos(a) + (1 - Math.sqrt(1 - (lam * Math.sin(a)) ** 2)) / lam; // 0 at TDC, 2 at BDC (in crank radii)
  };
  const volume = (x) => 1 / 10.7 + s(x) / 2 / (1 - 1 / 10.7) * (1 - 1 / 10.7); // clearance + swept share, ε ≈ 11.7
  if (phase < 140) return Math.max(1, 75 * (volume(15) / volume(phase)) ** 1.3 * Math.min(1, 0.35 + phase / 23));
  if (phase < 180) return 1 + (75 * (volume(15) / volume(140)) ** 1.3 - 1) * (1 - (phase - 140) / 40);
  if (phase < 540) return 1;
  return Math.min(75, (volume(180) / volume(phase)) ** 1.3);
}

// torque on the crank (N·m) from the gas force of every cylinder at crank angle theta
export function torqueOf(theta, only = null) {
  const area = Math.PI * 0.0475 ** 2; // m²
  let total = 0;
  for (let i = 1; i <= 6; i++)
    for (const bank of [0, 1]) {
      if (only && (only.i !== i || only.bank !== bank)) continue;
      const { s, pin } = slider(theta, i, bank);
      const ax = axisOf(bank);
      const e = [pin[0] - s * ax[1], pin[1] - s * ax[2]];
      const len = Math.hypot(e[0], e[1]);
      const force = (pressureOf(phaseOf(theta, i, bank)) - 1) * 1e5 * area; // N along the cylinder, toward the crank
      const cosB = -(e[0] * ax[1] + e[1] * ax[2]) / len;
      const push = [(e[0] / len) * (force / cosB), (e[1] / len) * (force / cosB)]; // the rod's thrust on the pin
      const r = 0.002; // m per world unit
      total += r * (pin[0] * push[1] - pin[1] * push[0]); // about +x, the crank's direction of turn
    }
  return total;
}

export const FIRING = [];
for (let i = 1; i <= 6; i++) for (const bank of [0, 1]) FIRING.push({ i, bank, n: i + 6 * bank, at: fireOf(i, bank) });
FIRING.sort((a, b) => a.at - b.at);
export const ORDER = FIRING.map((c) => c.n).join("-");

// every group value from the figure's two values: the turntable and the crank angle
export function follow(values) {
  const D = Math.PI / 180;
  const theta = values.theta ?? 0;
  const st = stagesOf(values.apart ?? 0);
  const out = { stand: values.stand ?? 0, crank: theta, "top.a": st.heads * M.LIFT, "top.b": st.heads * M.LIFT };
  out["coils.a"] = st.parts * M.OUT.coils;
  out["cams.b"] = st.parts * M.OUT.cams;
  out["plugs.b"] = st.parts * M.OUT.plugs;
  for (const tag of ["a", "b"]) {
    out[`intake.${tag}`] = st.parts * M.OUT.intake;
    out[`exhaust.${tag}`] = st.parts * M.OUT.exhaust;
  }
  for (let i = 1; i <= 6; i++)
    for (let bank = 0; bank < 2; bank++) {
      const tag = `${bank ? "b" : "a"}${i}`;
      const pin0 = (((M.BANK[0] - M.FIRE[i - 1]) % 360) + 360) % 360;
      const at = (t) => {
        const phi = (pin0 + t) * D;
        const alpha = phi - M.BANK[bank] * D;
        const s = M.CR * Math.cos(alpha) + Math.sqrt(M.ROD * M.ROD - (M.CR * Math.sin(alpha)) ** 2);
        const ax = [Math.cos(M.BANK[bank] * D), Math.sin(M.BANK[bank] * D)];
        const w = [s * ax[0], s * ax[1]];
        const c = [M.CR * Math.cos(phi), M.CR * Math.sin(phi)];
        return { s, psi: Math.atan2(c[1] - w[1], c[0] - w[0]) / D };
      };
      const now = at(theta);
      const rest = at(0);
      let dpsi = now.psi - rest.psi;
      dpsi = ((((dpsi + 180) % 360) + 360) % 360) - 180;
      out[`wrist.${tag}`] = now.s - rest.s; // the wrist pin follows the crank; the piston rides on it
      out[`piston.${tag}`] = st.pistons * M.OUT.piston;
      out[`rod.${tag}`] = dpsi;
    }
  // bank B's two camshafts turn at half crank speed; each lobe lifts a pair of buckets
  out["cam.in"] = theta / 2;
  out["cam.ex"] = theta / 2;
  for (let i = 1; i <= 6; i++)
    for (const [cam, peak] of [["in", M.PEAK_IN], ["ex", M.PEAK_EX]]) {
      const fire = M.FIRE[i - 1] + 60;
      const lift = (t) => {
        const delta = ((((t - fire - peak) / 2) % 360) + 540) % 360 - 180; // cam degrees from full lift
        return Math.max(0, M.CAM.offset * Math.cos(delta * D) + M.CAM.rn - M.CAM.rb);
      };
      out[`bucket.${cam}${i}`] = lift(theta) - lift(0); // the buckets are built where they sit at crank 0
    }
  return out;
}
