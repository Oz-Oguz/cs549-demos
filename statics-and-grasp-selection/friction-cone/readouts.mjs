import { format, formatAll } from "./model.mjs";
const mi = (x, normal = false) => `<mi${normal ? ' mathvariant="normal"' : ""}>${x}</mi>`;
const math = (body, label) => `<math aria-label="${label}">${body}</math>`;
const subscript = (base, s, label) => math(`<msub>${base}<mrow>${s}</mrow></msub>`, label);
const sym = {
  fn: (i = "") => subscript(mi("f"), mi("n", true) + (i ? `<mo>,</mo><mn>${i}</mn>` : ""), `f n${i ? ` ${i}` : ""}`),
  ft: (i = "") => subscript(mi("f"), mi("t", true) + (i ? `<mo>,</mo><mn>${i}</mn>` : ""), `f t${i ? ` ${i}` : ""}`),
  fp: () => subscript(mi("f"), mi("p", true), "f p"),
  mg: () => math(`${mi("m")}${mi("g")}`, "m g"),
  mu: () => subscript(mi("\u03BC"), mi("f", true), "mu f"),
  alpha: () => math(mi("\u03B1"), "alpha"),
  tau: () => subscript(mi("\u03C4"), mi("y"), "tau y"),
  fx: () => subscript(mi("f"), mi("x"), "f x"),
  fz: () => subscript(mi("f"), mi("z"), "f z"),
  F: () => subscript(mi("\u{1D405}"), mi("ct", true), "F ct"),
  f: (i = "") => i ? subscript(mi("f"), `<mn>${i}</mn>`, `f ${i}`) : math(mi("f"), "f")
};
const N = (value) => `${format(value, 3)}&nbsp;N`;
const keep = (html) => `<span class="nowrap">${html}</span>`;
const deg = (value) => `${format(value, 1)}\xB0`;
function pairText(c, mu) {
  const i = c.index;
  switch (c.status) {
    case "zero":
      return { key: "zero", title: `Contact ${i}`, text: "no force (the apex)" };
    case "inside":
      return { key: "inside", title: `Contact ${i}`, text: `inside: ${keep(`${sym.ft(i)} = ${N(c.ftRequested)}`)} within ${keep(`\xB1${N(c.bound)}`)}` };
    case "boundary":
      return { key: "boundary", title: `Contact ${i}`, text: mu === 0 ? `on the normal ray (${keep(`${sym.mu()} = 0`)})` : `boundary: ${keep(`|${sym.ft(i)}| = ${N(Math.abs(c.ftRequested))}`)} at the limit` };
    default:
      return { key: "outside", title: `Contact ${i}`, text: c.fn === 0 ? `outside: ${sym.fn(i)} = 0, so the solid force is zero` : `outside: requested ${keep(`${sym.ft(i)} = ${N(c.ftRequested)}`)}, clipped to ${keep(N(c.ftAdmissible))} (${sym.fn(i)} kept)` };
  }
}
function boxText(b, mu, alphaDeg, components) {
  const [pushAbs, bound, margin, excess] = formatAll([Math.abs(b.push), b.bound, Math.abs(b.margin), b.excess], 3).map((v) => `${v}&nbsp;N`);
  const limit = keep(`${sym.mu()}${sym.fn()} = ${bound}`);
  const alphaText = keep(`${sym.alpha()} = ${deg(alphaDeg)}`);
  const angle = deg(Math.abs(b.requiredAngle));
  const weightEq = keep(`${sym.fn()} = ${sym.mg()} = ${N(b.fn)}`);
  const required = { key: "required", title: "Rest needs", text: b.noPush ? `the table to supply ${weightEq} upward and no tangential force: there is no push to oppose.` : `the table to supply ${weightEq} upward and ${keep(`${sym.ft()} = \u2212${sym.fp()} = ${N(b.ftRequired)}`)} along the table, opposing the push.` };
  let cone;
  if (b.noPush) {
    cone = { key: mu === 0 ? "boundary" : "inside", title: "No friction needed", text: mu === 0 ? `With no push the required force is the normal force itself; with ${keep(`${sym.mu()} = 0`)} the cone is that normal ray.` : `With no push the required force is the normal force itself, on the cone\u2019s axis (${alphaText}).` };
  } else if (b.status === "inside") {
    cone = { key: "inside", title: "Inside the cone", text: `${keep(`|${sym.ft()}| = ${pushAbs}`)} is within the friction limit ${limit} (margin ${margin}). The required force makes ${angle} with the normal; ${alphaText}.` };
  } else if (b.status === "boundary") {
    cone = { key: "boundary", title: "On the cone boundary", text: `${keep(`|${sym.ft()}| = ${pushAbs}`)} equals the friction limit ${limit}: at the friction limit, with no reserve. The required force lies on the cone edge, at the half-angle ${alphaText}.` };
  } else {
    cone = {
      key: "outside",
      title: "Outside the cone",
      text: mu === 0 ? `With ${keep(`${sym.mu()} = 0`)} friction supplies no tangential force: any push breaks rest, and ${keep(`|${sym.ft()}| = ${pushAbs}`)} cannot be supplied.` : `${keep(`|${sym.ft()}| = ${pushAbs}`)} exceeds the friction limit ${limit} by ${excess}: the table cannot supply it, so friction cannot maintain rest. The required force makes ${angle} with the normal, more than ${alphaText}.`,
      note: components ? "The dashed arrows show what rest would need, not forces the contact supplies." : "The dashed arrow shows what rest would need, not a force the contact supplies."
    };
  }
  const headline = b.noPush ? "No push: rest needs no friction." : b.status === "inside" ? "Friction can maintain rest: the table can supply what rest needs." : b.status === "boundary" ? "At the friction limit: rest needs exactly the friction available." : "Friction cannot maintain rest.";
  return { headline, lines: [required, cone] };
}
function describe(result, state) {
  const pair = state.view === "pair";
  const alpha = keep(`${sym.alpha()} = arctan ${sym.mu()} = ${deg(result.alpha.deg)}`);
  if (!pair) {
    const box = boxText(result.box, state.mu, result.alpha.deg, state.components);
    return { headline: box.headline, contacts: box.lines, wrench: null, closure: null, alpha, mass: keep(`${sym.mg()} = ${N(result.box.weight)}`) };
  }
  const contacts = [0, 1].map((i) => pairText(result.contacts[i], state.mu));
  const out = result.contacts.filter((c) => c.clipped).map((c) => c.index);
  const headline = out.length === 0 ? "Both forces are admissible." : out.length === 2 ? "Both requests lie outside their cones." : `Contact ${out[0]}\u2019s request lies outside its cone.`;
  const [tau, fx, fz] = result.pair.wrench;
  const turn = Math.abs(tau) <= 1e-10 ? "no moment" : tau > 0 ? "clockwise" : "counterclockwise";
  const wrench = {
    summary: `Selected solid forces: ${Math.hypot(fx, fz) <= 1e-9 ? "zero" : "nonzero"} net force; ${Math.abs(tau) <= 1e-10 ? "zero moment" : `nonzero moment (${turn})`}.`,
    values: [
      // Tiny nonzero moments get more digits, so a direction note never sits beside a printed 0.
      { key: "tau", label: sym.tau(), value: tau, text: `${format(tau, Math.abs(tau) > 1e-10 && format(tau, 3) === "0" ? 6 : 3)}&nbsp;N&nbsp;m`, note: turn },
      { key: "fx", label: sym.fx(), value: fx, text: N(fx), note: Math.abs(fx) <= 1e-9 ? "" : fx > 0 ? "right" : "left" },
      { key: "fz", label: sym.fz(), value: fz, text: N(fz), note: Math.abs(fz) <= 1e-9 ? "" : fz > 0 ? "up" : "down" }
    ]
  };
  const closure = result.closure.planar ? { key: "closure", text: `<strong>Grasp capability: planar force closure \u2014 yes.</strong> With ${sym.mu()} &gt; 0 and sufficient squeeze, these cones allow forces that oppose any planar force and moment. Capability does not imply the selected forces balance.` } : { key: "no-closure", text: `<strong>Grasp capability: planar force closure \u2014 no.</strong> At ${sym.mu()} = 0, both cones collapse onto the contact line: only horizontal pushes through <i>O</i>, no vertical force and no moment. A balanced selection alone does not establish force closure.` };
  return { headline, contacts, wrench, closure, alpha, mass: null };
}
export {
  describe,
  sym
};
