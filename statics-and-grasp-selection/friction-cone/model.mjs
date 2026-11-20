const VIEWBOX = { width: 700, height: 500 };
const ORIGIN = { x: 350, y: 250 };
const PX_PER_M = 5500;
const TABLE = { x: 350, y: 300 };
const PX_PER_M_TABLE = 2e3;
const PX_PER_N = 14;
const FIELDS = ["mu", "push", "mass", "n1", "t1", "n2", "t2"];
const VIEWS = ["single", "pair"];
const STATUS_KEYS = ["zero", "inside", "boundary", "outside"];
const FIELD_INFO = {
  mu: { control: "mu", key: "mu" },
  push: { control: "push", key: "push" },
  mass: { control: "mass", key: "mass" },
  n1: { control: "fn", contact: 0, key: "fn" },
  t1: { control: "ft", contact: 0, key: "ft" },
  n2: { control: "fn", contact: 1, key: "fn" },
  t2: { control: "ft", contact: 1, key: "ft" }
};
const zero = (value) => value + 0;
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const pair = (value) => Array.isArray(value) && value.length === 2 && value.every(finite);
function validateConfig(config) {
  if (!finite(config.gravity) || config.gravity <= 0) throw new Error("cases.json: gravity must be positive");
  if (!finite(config.snap?.dragWindow) || config.snap.dragWindow <= 0) throw new Error("cases.json: snap.dragWindow must be positive");
  const pb = config.pushedBox;
  if (!pb || !finite(pb.width) || !finite(pb.height) || !finite(pb.pushHeight) || pb.width <= 0 || pb.height <= 0) throw new Error("cases.json: pushedBox needs width, height and pushHeight");
  if (pb.pushHeight < 0 || pb.pushHeight > pb.height) throw new Error("cases.json: pushedBox.pushHeight must lie on the box face");
  if (!pair(pb.normal) || !pair(pb.tangent) || pb.normal[0] !== 0 || pb.normal[1] !== 1 || pb.tangent[0] !== 1 || pb.tangent[1] !== 0) throw new Error("cases.json: pushedBox normal must be [0, 1] and tangent [1, 0]");
  if (!finite(config.halfSpacing) || config.halfSpacing <= 0) throw new Error("cases.json: halfSpacing must be positive");
  if (!finite(config.box?.width) || !finite(config.box?.height)) throw new Error("cases.json: box needs width and height");
  if (!Array.isArray(config.contacts) || config.contacts.length !== 2) throw new Error("cases.json: two contacts expected");
  config.contacts.forEach((c, i) => {
    if (!pair(c.position) || !pair(c.normal) || !pair(c.tangent)) throw new Error(`cases.json: contact ${i + 1} needs position, normal and tangent pairs`);
    if (Math.abs(Math.hypot(...c.normal) - 1) > 1e-12 || Math.abs(Math.hypot(...c.tangent) - 1) > 1e-12) throw new Error(`cases.json: contact ${i + 1} directions must be unit vectors`);
    if (Math.abs(c.normal[0] * c.tangent[0] + c.normal[1] * c.tangent[1]) > 1e-12) throw new Error(`cases.json: contact ${i + 1} normal and tangent must be orthogonal`);
    if (-(c.position[0] * c.normal[0] + c.position[1] * c.normal[1]) <= 0) throw new Error(`cases.json: contact ${i + 1} normal must point inward`);
    if (typeof c.label !== "string") throw new Error(`cases.json: contact ${i + 1} needs a label`);
  });
  for (const key of ["push", "mass", "fn", "ft", "mu"]) {
    const control = config.controls?.[key];
    if (!control || !finite(control.min) || !finite(control.max) || !finite(control.step) || control.step <= 0 || control.max <= control.min) throw new Error(`cases.json: controls.${key} needs min < max and a positive step`);
    if (!Number.isInteger(control.decimals) || control.decimals < 0) throw new Error(`cases.json: controls.${key} needs integer decimals`);
  }
  if (config.controls.fn.min < 0) throw new Error("cases.json: normal force must stay compressive (min >= 0)");
  if (config.controls.mass.min <= 0) throw new Error("cases.json: mass must stay positive (the weight is the normal force)");
  if (config.controls.mu.min < 0) throw new Error("cases.json: friction coefficient must be nonnegative");
  const a = pb.width / 2;
  if (config.controls.mu.max * pb.pushHeight > a) throw new Error("cases.json: pushedBox: the push height admits tipping before sliding (mu_f h > a)");
  const largestPush = Math.max(Math.abs(config.controls.push.min), Math.abs(config.controls.push.max));
  if (largestPush * pb.pushHeight > a * config.controls.mass.min * config.gravity) throw new Error("cases.json: pushedBox: the largest push would put the centre of pressure outside the base of the lightest box");
  for (const key of ["force", "moment", "match"]) {
    if (!finite(config.tolerance?.[key]) || config.tolerance[key] <= 0) throw new Error(`cases.json: tolerance.${key} must be positive`);
  }
  for (const view of VIEWS) {
    const v = config.views?.[view];
    if (!v || typeof v.label !== "string" || !Array.isArray(v.contacts) || typeof v.components !== "boolean") throw new Error(`cases.json: views.${view} needs label, contacts and components`);
  }
  const inRange = (value, key) => finite(value) && value >= config.controls[key].min && value <= config.controls[key].max;
  const h = config.hidden;
  if (!h || !inRange(h.push, "push") || !inRange(h.mass, "mass") || !Array.isArray(h.contacts) || h.contacts.length !== 2 || !h.contacts.every(pair)) throw new Error("cases.json: hidden needs push, mass and two [fn, ft] pairs");
  if (!config.presets || !Object.hasOwn(config.presets, config.defaultPreset)) throw new Error("cases.json: defaultPreset is not a preset");
  for (const [name, p] of Object.entries(config.presets)) {
    if (!VIEWS.includes(p.view)) throw new Error(`cases.json: preset ${name} has an unknown view`);
    if (!inRange(p.mu, "mu")) throw new Error(`cases.json: preset ${name} mu outside its range`);
    if (p.view === "single") {
      if (!inRange(p.push, "push") || !inRange(p.mass, "mass")) throw new Error(`cases.json: preset ${name} needs push and mass within their ranges`);
    } else {
      if (!Array.isArray(p.contacts) || p.contacts.length !== 2 || !p.contacts.every(pair)) throw new Error(`cases.json: preset ${name} needs two [fn, ft] pairs`);
      for (const [fn, ft] of p.contacts) {
        if (!inRange(fn, "fn") || !inRange(ft, "ft")) throw new Error(`cases.json: preset ${name} force outside its range`);
      }
    }
    if (typeof p.label !== "string" || typeof p.observation !== "string") throw new Error(`cases.json: preset ${name} needs label and observation`);
  }
  return config;
}
function physicsSubset(config) {
  const presets = {};
  for (const name of Object.keys(config.presets).sort()) {
    const p = config.presets[name];
    presets[name] = p.view === "single" ? { mass: p.mass, mu: p.mu, push: p.push, view: p.view } : { contacts: p.contacts, mu: p.mu, view: p.view };
  }
  const control = (key) => ({ min: config.controls[key].min, max: config.controls[key].max, step: config.controls[key].step });
  return {
    box: { width: config.box.width, height: config.box.height },
    contacts: config.contacts.map((c) => ({ name: c.name, normal: c.normal, position: c.position, tangent: c.tangent })),
    controls: { fn: control("fn"), ft: control("ft"), mass: control("mass"), mu: control("mu"), push: control("push") },
    defaultPreset: config.defaultPreset,
    gravity: config.gravity,
    snap: { dragWindow: config.snap.dragWindow },
    halfSpacing: config.halfSpacing,
    hidden: { contacts: config.hidden.contacts, mass: config.hidden.mass, push: config.hidden.push },
    presets,
    pushedBox: { height: config.pushedBox.height, normal: config.pushedBox.normal, pushHeight: config.pushedBox.pushHeight, tangent: config.pushedBox.tangent, width: config.pushedBox.width },
    views: Object.fromEntries(VIEWS.map((v) => [v, { components: config.views[v].components, contacts: config.views[v].contacts }]))
  };
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const degrees = (radians) => radians * 180 / Math.PI;
function classify(fn, ft, mu, tol) {
  const bound = mu * fn, magnitude = Math.abs(ft);
  return fn === 0 && ft === 0 ? "zero" : magnitude < bound - tol ? "inside" : magnitude <= bound + tol ? "boundary" : "outside";
}
function boxResult(state, config) {
  const tol = config.tolerance.force;
  const { mass, push, mu } = state;
  const g = config.gravity, h = config.pushedBox.pushHeight, a = config.pushedBox.width / 2;
  const weight = zero(mass * g);
  const fn = weight;
  const ft = zero(-push);
  const bound = frictionLimit(state, config);
  const magnitude = Math.abs(push);
  const status = classify(fn, ft, mu, tol);
  const xcp = zero(h * push / weight);
  const tippingPush = zero(a * weight / h);
  return {
    mass,
    weight,
    push,
    pushHeight: h,
    halfWidth: a,
    height: config.pushedBox.height,
    comHeight: config.pushedBox.height / 2,
    face: push > 0 ? "left" : push < 0 ? "right" : "none",
    // the face the push acts on
    fn,
    ftRequired: ft,
    bound,
    status,
    holds: status !== "outside",
    noPush: push === 0,
    margin: zero(bound - magnitude),
    excess: zero(Math.max(0, magnitude - bound)),
    requiredAngle: zero(degrees(Math.atan2(ft, fn))),
    // from the upward normal, negative when leaning towards -x
    required: [ft, fn],
    // the force the table must supply, world (x, z)
    moment: { xcp, withinBase: Math.abs(xcp) <= a + 1e-12, tippingPush, slidingPush: bound, slidingFirst: bound <= tippingPush + tol, pushBelowTipping: magnitude <= tippingPush + tol },
    balance: { force: [zero(push + ft), zero(fn - weight)], momentAboutT: zero(h * push - xcp * weight) }
  };
}
function contactResult(i, contact, mu, config) {
  const tol = config.tolerance.force;
  const { fn, ft } = contact;
  const { position: [px, pz], normal: [nx, nz], tangent: [tx, tz] } = config.contacts[i];
  const bound = zero(mu * fn);
  const ftAdmissible = zero(clamp(ft, -bound, bound));
  const magnitude = Math.abs(ft);
  const status = classify(fn, ft, mu, tol);
  const world = (t) => [zero(fn * nx + t * tx), zero(fn * nz + t * tz)];
  const requested = world(ft), admissible = world(ftAdmissible);
  const wrench = [zero(pz * admissible[0] - px * admissible[1]), admissible[0], admissible[1]];
  return {
    index: i + 1,
    fn,
    ftRequested: ft,
    bound,
    ftAdmissible,
    status,
    admissibleRequest: status !== "outside",
    clipped: status === "outside",
    clip: zero(ft - ftAdmissible),
    margin: zero(bound - magnitude),
    solidZero: fn === 0,
    requestedAngle: status === "zero" ? null : zero(degrees(Math.atan2(ft, fn))),
    admissibleAngle: fn === 0 ? null : zero(degrees(Math.atan2(ftAdmissible, fn))),
    requested,
    admissible,
    wrench
  };
}
function calculate(state, config) {
  const { view, mu } = state;
  const isPair = view === "pair";
  const contacts = state.contacts.map((contact, i) => contactResult(i, contact, mu, config));
  const net = [0, 1, 2].map((k) => zero(contacts[0].wrench[k] + contacts[1].wrench[k]));
  const alpha = Math.atan(mu);
  return {
    view,
    mu,
    visible: [isPair, isPair],
    boxVisible: !isPair,
    alpha: { rad: alpha, deg: zero(degrees(alpha)) },
    box: boxResult(state, config),
    contacts,
    // Pair results always use both solid (admissible) vectors; gravity is omitted.
    pair: {
      wrench: net,
      zeroMoment: Math.abs(net[0]) <= config.tolerance.moment,
      zeroForce: Math.abs(net[1]) <= config.tolerance.force && Math.abs(net[2]) <= config.tolerance.force
    },
    // Opposed contacts: the joining line runs along both inward normals, strictly inside both
    // cones exactly when mu_f > 0 (planar force closure with sufficient squeeze).
    closure: { planar: mu > 0 }
  };
}
const viewDefaults = (view, config) => config.views[view].components;
function presetState(name, config) {
  const preset = Object.hasOwn(config.presets, name) ? name : config.defaultPreset;
  const p = config.presets[preset];
  const single = p.view === "single";
  return {
    view: p.view,
    mu: zero(p.mu),
    push: zero(single ? p.push : config.hidden.push),
    mass: zero(single ? p.mass : config.hidden.mass),
    contacts: (single ? config.hidden.contacts : p.contacts).map(([fn, ft]) => ({ fn: zero(fn), ft: zero(ft) })),
    components: viewDefaults(p.view, config)
  };
}
function getField(state, field) {
  const info = FIELD_INFO[field];
  return info.contact === void 0 ? state[info.key] : state.contacts[info.contact][info.key];
}
function withField(state, field, value) {
  const info = FIELD_INFO[field];
  if (info.contact === void 0) return { ...state, [info.key]: value };
  const contacts = state.contacts.map((c, i) => i === info.contact ? { ...c, [info.key]: value } : { ...c });
  return { ...state, contacts };
}
const fieldControl = (field, config) => config.controls[FIELD_INFO[field].control];
const visibleFields = (view) => view === "single" ? ["mu", "push", "mass"] : ["mu", "n1", "t1", "n2", "t2"];
const frictionLimit = (state, config) => zero(state.mu * (state.mass * config.gravity));
function presetFields(p) {
  return p.view === "single" ? { mu: p.mu, push: p.push, mass: p.mass } : { mu: p.mu, n1: p.contacts[0][0], t1: p.contacts[0][1], n2: p.contacts[1][0], t2: p.contacts[1][1] };
}
function matchPreset(state, config) {
  const tol = config.tolerance.match;
  for (const [name, p] of Object.entries(config.presets)) {
    if (p.view !== state.view) continue;
    const want = presetFields(p);
    if (visibleFields(state.view).every((field) => Math.abs(getField(state, field) - want[field]) <= tol)) return name;
  }
  return null;
}
const resolveContext = (state, context, config) => matchPreset(state, config) ?? context;
function restStatus(state, config) {
  if (state.push === 0) return "inside";
  return classify(state.mass * config.gravity, -state.push, state.mu, config.tolerance.force);
}
function stillPreset(state, context, config) {
  const match = matchPreset(state, config);
  if (match) return match;
  const weightOf = (field) => field === "mu" ? 10 : field === "mass" ? config.gravity : 1;
  const single = state.view === "single";
  const verdict = single ? restStatus(state, config) : null;
  const value = (field, v) => single && field === "push" ? Math.abs(v) : v;
  let best = null, bestSame = null;
  for (const [name, p] of Object.entries(config.presets)) {
    if (p.view !== state.view) continue;
    const want = presetFields(p);
    const d = visibleFields(state.view).reduce((s, field) => s + weightOf(field) * Math.abs(value(field, getField(state, field)) - value(field, want[field])), 0);
    if (!best || d < best.d) best = { name, d };
    if (single && restStatus(presetState(name, config), config) === verdict && (!bestSame || d < bestSame.d)) bestSame = { name, d };
  }
  return (bestSame ?? best).name;
}
function fullMatch(state, name, config) {
  if (!Object.hasOwn(config.presets, name)) return false;
  const want = presetState(name, config), tol = config.tolerance.match;
  return state.view === want.view && FIELDS.every((field) => Math.abs(getField(state, field) - getField(want, field)) <= tol);
}
function quantize(value, control) {
  const steps = Math.round((value - control.min) / control.step);
  const snapped = Number((control.min + steps * control.step).toFixed(control.decimals));
  return zero(clamp(snapped, control.min, control.max));
}
function snapToLimit(push, state, config, window = config.controls.push.step / 2) {
  const limit = frictionLimit(state, config);
  if (push !== 0 && limit > 0 && Math.abs(Math.abs(push) - limit) <= window + 1e-12) return zero(Math.sign(push) * limit);
  return push;
}
function pushedBoxGeometry(config) {
  const { width, height, pushHeight } = config.pushedBox;
  const s = PX_PER_M_TABLE;
  return {
    left: TABLE.x - width / 2 * s,
    right: TABLE.x + width / 2 * s,
    top: TABLE.y - height * s,
    bottom: TABLE.y,
    com: [TABLE.x, TABLE.y - height / 2 * s],
    T: [TABLE.x, TABLE.y],
    pushY: TABLE.y - pushHeight * s,
    a: width / 2,
    h: pushHeight,
    height,
    width
  };
}
function boxApex(push, mass, mu, config) {
  const weight = mass * config.gravity;
  const limit = mu * weight;
  const held = Math.min(limit, Math.max(-limit, push));
  return [TABLE.x + config.pushedBox.pushHeight * held / weight * PX_PER_M_TABLE, TABLE.y];
}
function boxTipPoint(push, mass, mu, config) {
  const [ax, ay] = boxApex(push, mass, mu, config);
  return [ax - push * PX_PER_N, ay - mass * config.gravity * PX_PER_N];
}
function pushArrow(push, config, side) {
  const geo = pushedBoxGeometry(config);
  const which = push > 0 ? "left" : push < 0 ? "right" : side === "right" ? "right" : "left";
  const face = which === "right" ? geo.right : geo.left;
  return { face: [face, geo.pushY], tail: [face - push * PX_PER_N, geo.pushY], side: which };
}
function pushFromPoint(x, side, state, config) {
  const geo = pushedBoxGeometry(config);
  const face = side === "right" ? geo.right : geo.left;
  const raw = (face - x) / PX_PER_N;
  const kept = side === "right" ? Math.min(0, raw) : Math.max(0, raw);
  return snapToLimit(quantize(kept, config.controls.push), state, config, config.snap.dragWindow);
}
const boxFrame = (push, mass, mu, config) => ({ point: boxApex(push, mass, mu, config), normal: config.pushedBox.normal, tangent: config.pushedBox.tangent });
function contactPoint(i, config) {
  const [x, z] = config.contacts[i].position;
  return [ORIGIN.x + x * PX_PER_M, ORIGIN.y - z * PX_PER_M];
}
function tipPoint(i, fn, ft, config) {
  const [px, py] = contactPoint(i, config);
  const { normal: [nx, nz], tangent: [tx, tz] } = config.contacts[i];
  return [px + (fn * nx + ft * tx) * PX_PER_N, py - (fn * nz + ft * tz) * PX_PER_N];
}
function forceFromPoint(i, x, y, config) {
  const [px, py] = contactPoint(i, config);
  const fx = (x - px) / PX_PER_N, fz = (py - y) / PX_PER_N;
  const { normal: [nx, nz], tangent: [tx, tz] } = config.contacts[i];
  return { fn: quantize(fx * nx + fz * nz, config.controls.fn), ft: quantize(fx * tx + fz * tz, config.controls.ft) };
}
const contactFrame = (i, config) => ({ point: contactPoint(i, config), normal: config.contacts[i].normal, tangent: config.contacts[i].tangent });
function frameConeDirections(frame, mu) {
  const { normal: [nx, nz], tangent: [tx, tz] } = frame;
  const alpha = Math.atan(mu);
  const ray = (sign) => {
    const wx = nx * Math.cos(alpha) + sign * tx * Math.sin(alpha);
    const wz = nz * Math.cos(alpha) + sign * tz * Math.sin(alpha);
    return [wx, -wz];
  };
  return mu > 0 ? [ray(1), ray(-1)] : [ray(0)];
}
const coneDirections = (i, mu, config) => frameConeDirections(contactFrame(i, config), mu);
function exitPoint([x, y], [dx, dy]) {
  const ts = [];
  if (dx > 0) ts.push((VIEWBOX.width - x) / dx);
  else if (dx < 0) ts.push(-x / dx);
  if (dy > 0) ts.push((VIEWBOX.height - y) / dy);
  else if (dy < 0) ts.push(-y / dy);
  const t = Math.min(...ts);
  return [x + t * dx, y + t * dy];
}
function frameWedge(frame, mu) {
  const apex = frame.point;
  const directions = frameConeDirections(frame, mu);
  if (directions.length === 1) return { apex, rays: [exitPoint(apex, directions[0])], polygon: null };
  const rays = directions.map((d) => exitPoint(apex, d));
  const { normal: [nx, nz] } = frame;
  const axis = Math.atan2(-nz, nx);
  const half = Math.atan(mu);
  const offset = ([x, y]) => {
    let d = Math.atan2(y - apex[1], x - apex[0]) - axis;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  const corners = [[0, 0], [VIEWBOX.width, 0], [VIEWBOX.width, VIEWBOX.height], [0, VIEWBOX.height]].filter((corner) => Math.abs(offset(corner)) < half);
  const ring = [...rays, ...corners].sort((p, q) => offset(p) - offset(q));
  return { apex, rays, polygon: [apex, ...ring] };
}
const wedgePolygon = (i, mu, config) => frameWedge(contactFrame(i, config), mu);
const boxWedge = (push, mass, mu, config) => frameWedge(boxFrame(push, mass, mu, config), mu);
function reduce(state, action, config) {
  switch (action.type) {
    case "preset":
      return presetState(action.name, config);
    case "reset":
      return presetState(config.defaultPreset, config);
    case "view":
      if (!VIEWS.includes(action.view) || action.view === state.view) return state;
      return { ...state, view: action.view, components: viewDefaults(action.view, config) };
    case "components":
      return { ...state, components: Boolean(action.on) };
    case "set": {
      if (!FIELDS.includes(action.field) || !finite(action.value)) return state;
      const value = quantize(action.value, fieldControl(action.field, config));
      return withField(state, action.field, action.field === "push" ? snapToLimit(value, state, config) : value);
    }
    case "drag": {
      const i = action.contact;
      if (![0, 1].includes(i) || !finite(action.x) || !finite(action.y)) return state;
      if (!config.views[state.view].contacts.includes(i + 1)) return state;
      const { fn, ft } = forceFromPoint(i, action.x, action.y, config);
      return withField(withField(state, `n${i + 1}`, fn), `t${i + 1}`, ft);
    }
    case "dragPush": {
      if (state.view !== "single" || !finite(action.x) || !["left", "right"].includes(action.side)) return state;
      return { ...state, push: pushFromPoint(action.x, action.side, state, config) };
    }
    default:
      return state;
  }
}
function stateFromQuery(search, config) {
  const params = new URLSearchParams(search);
  const notes = [];
  const defaultLabel = config.presets[config.defaultPreset].label;
  const rawPreset = params.get("preset");
  const validPreset = rawPreset !== null && Object.hasOwn(config.presets, rawPreset);
  const context = validPreset ? rawPreset : config.defaultPreset;
  let state = presetState(context, config);
  const rawView = params.get("view");
  if (rawView !== null) {
    if (VIEWS.includes(rawView)) state = { ...state, view: rawView, components: viewDefaults(rawView, config) };
    else notes.push(`Unknown view "${rawView.slice(0, 24)}": showing ${config.views[state.view].label}.`);
  }
  if (rawPreset !== null && !validPreset) {
    const name = rawPreset.slice(0, 24);
    notes.unshift(state.view === config.presets[config.defaultPreset].view ? `Unknown preset "${name}": opened ${defaultLabel}.` : `Unknown preset "${name}": used the ${defaultLabel} inputs in the ${config.views[state.view].label} view.`);
  }
  const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
  const names = { mu: "friction coefficient", push: "push", mass: "mass", n1: "normal force 1", t1: "requested tangential force 1", n2: "normal force 2", t2: "requested tangential force 2" };
  const units = { mu: "", push: " N", mass: " kg", n1: " N", t1: " N", n2: " N", t2: " N" };
  for (const field of FIELDS) {
    let raw = params.get(field);
    if (raw === null) continue;
    if (/^ [^ ]/.test(raw)) raw = `+${raw.slice(1)}`;
    const value = NUMBER.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(value)) {
      notes.push(`Invalid ${names[field]}: kept the preset value.`);
      continue;
    }
    const control = fieldControl(field, config);
    const Name = `${names[field][0].toUpperCase()}${names[field].slice(1)}`;
    const limited = zero(clamp(value, control.min, control.max));
    const snapped = field === "push" ? limited : quantize(limited, control);
    if (limited !== zero(value)) notes.push(`${Name} limited to the range ${format(control.min, 3)} to ${format(control.max, 3)}${units[field]}.`);
    else if (snapped !== limited) notes.push(`${Name} rounded to the slider step: ${format(snapped, control.decimals)}${units[field]}.`);
    state = withField(state, field, snapped);
  }
  const rawComponents = params.get("components");
  if (rawComponents !== null) {
    if (rawComponents === "1" || rawComponents === "0") state = { ...state, components: rawComponents === "1" };
    else notes.push("Invalid components value (use 1 or 0): kept the view default.");
  }
  return { state, context, notes };
}
function stateQuery(state, context, config) {
  const params = new URLSearchParams({ view: state.view, preset: context });
  if (!fullMatch(state, context, config)) {
    for (const field of FIELDS) params.set(field, String(getField(state, field)));
  }
  if (state.components !== viewDefaults(state.view, config)) params.set("components", state.components ? "1" : "0");
  return params.toString();
}
function format(value, digits = 3) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "\u2014";
  const scaled = Math.round(Number((Math.abs(value) * 10 ** digits).toPrecision(12)));
  const rounded = scaled === 0 ? 0 : Math.sign(value) * scaled / 10 ** digits;
  const text = rounded.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return (text === "-0" ? "0" : text).replace("-", "\u2212");
}
function formatAll(values, digits = 3) {
  const distinct = [...new Set(values)];
  let d = digits;
  while (d < 6 && new Set(distinct.map((v) => format(v, d))).size < distinct.length) d += 1;
  return values.map((v) => format(v, d));
}
export {
  FIELDS,
  ORIGIN,
  PX_PER_M,
  PX_PER_M_TABLE,
  PX_PER_N,
  STATUS_KEYS,
  TABLE,
  VIEWBOX,
  VIEWS,
  boxApex,
  boxFrame,
  boxTipPoint,
  boxWedge,
  calculate,
  canonical,
  coneDirections,
  contactPoint,
  exitPoint,
  fieldControl,
  forceFromPoint,
  format,
  formatAll,
  frameConeDirections,
  frameWedge,
  frictionLimit,
  fullMatch,
  getField,
  matchPreset,
  physicsSubset,
  presetState,
  pushArrow,
  pushFromPoint,
  pushedBoxGeometry,
  quantize,
  reduce,
  resolveContext,
  restStatus,
  snapToLimit,
  stateFromQuery,
  stateQuery,
  stillPreset,
  tipPoint,
  validateConfig,
  viewDefaults,
  visibleFields,
  wedgePolygon
};
