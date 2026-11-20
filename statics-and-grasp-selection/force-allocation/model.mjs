const PX_PER_M = 3e3, PX_PER_N = 10;
const FIELDS = ["x", "squeeze", "mu", "cap"];
const STATUS_KEYS = {
  selected: ["enough", "exactly-enough", "not-enough"],
  cap: ["within-cap", "at-cap", "beyond-cap", "no-finite"],
  status: ["balanced", "limiting", "more-squeeze", "beyond-cap", "no-friction"],
  limiting: ["none", "left", "right", "both"]
};
const zero = (value) => value + 0;
const finite = (value) => typeof value === "number" && Number.isFinite(value);
function validateConfig(config) {
  for (const key of ["mass", "gravity", "halfSpacing"]) {
    if (!finite(config[key]) || config[key] <= 0) throw new Error(`cases.json: ${key} must be a positive number`);
  }
  for (const key of ["x", "squeeze", "mu", "cap"]) {
    const control = config.controls?.[key];
    if (!control || !finite(control.min) || !finite(control.step) || control.step <= 0) throw new Error(`cases.json: controls.${key} needs min and step`);
    if (key !== "squeeze" && !finite(control.max)) throw new Error(`cases.json: controls.${key} needs max`);
    if (!Number.isInteger(control.decimals) || control.decimals < 0) throw new Error(`cases.json: controls.${key} needs integer decimals`);
  }
  for (const key of ["force", "moment", "match"]) {
    if (!finite(config.tolerance?.[key]) || config.tolerance[key] <= 0) throw new Error(`cases.json: tolerance.${key} must be positive`);
  }
  if (!config.presets || !Object.hasOwn(config.presets, config.defaultPreset)) throw new Error("cases.json: defaultPreset is not a preset");
  for (const [name, preset] of Object.entries(config.presets)) {
    for (const key of FIELDS) {
      if (!finite(preset[key])) throw new Error(`cases.json: preset ${name} lacks ${key}`);
    }
    const ranges = effectiveRanges(config, preset.cap);
    for (const key of FIELDS) {
      if (preset[key] < ranges[key].min - 1e-12 || preset[key] > ranges[key].max + 1e-12) throw new Error(`cases.json: preset ${name} ${key} is outside its control range`);
    }
    if (typeof preset.label !== "string" || typeof preset.question !== "string") throw new Error(`cases.json: preset ${name} needs label and question`);
  }
  return config;
}
function effectiveRanges(config, cap) {
  const c = config.controls;
  return {
    x: { min: c.x.min, max: c.x.max },
    squeeze: { min: c.squeeze.min, max: cap },
    mu: { min: c.mu.min, max: c.mu.max },
    cap: { min: c.cap.min, max: c.cap.max }
  };
}
function physicsSubset(config) {
  const presets = {};
  for (const name of Object.keys(config.presets).sort()) {
    const p = config.presets[name];
    presets[name] = { cap: p.cap, mu: p.mu, squeeze: p.squeeze, x: p.x };
  }
  const control = (key) => {
    const c = config.controls[key];
    return finite(c.max) ? { min: c.min, max: c.max, step: c.step } : { min: c.min, step: c.step };
  };
  return {
    box: { width: config.box.width, height: config.box.height, depth: config.box.depth },
    contacts: config.contacts.map((c) => ({ name: c.name, position: c.position, normal: c.normal, tangent: c.tangent })),
    controls: { x: control("x"), squeeze: control("squeeze"), mu: control("mu"), cap: control("cap") },
    defaultPreset: config.defaultPreset,
    gravity: config.gravity,
    halfSpacing: config.halfSpacing,
    mass: config.mass,
    presets
  };
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function side(flags) {
  return flags[0] && flags[1] ? "both" : flags[0] ? "left" : flags[1] ? "right" : "none";
}
function calculate(state, config) {
  const tol = config.tolerance.force;
  const a = config.halfSpacing;
  const { x, squeeze, mu, cap } = state;
  const weight = config.mass * config.gravity;
  const tangential = [weight / 2 * (1 - x / a), weight / 2 * (1 + x / a)].map(zero);
  const need = tangential.map(Math.abs);
  const largest = Math.max(need[0], need[1]);
  const frictionBound = zero(mu * squeeze);
  const capBound = zero(mu * cap);
  const minimumFinite = mu > 0;
  const minimumSqueeze = minimumFinite ? zero(largest / mu) : null;
  const margin = need.map((n) => zero(frictionBound - n));
  const selectedByContact = margin.map((m) => m >= -tol);
  const selectedSuffices = selectedByContact.every(Boolean);
  const atLimit = margin.map((m) => Math.abs(m) <= tol);
  const capSuffices = minimumFinite && minimumSqueeze <= cap + tol;
  const noReserve = selectedSuffices && atLimit.some(Boolean);
  const limiting = selectedSuffices ? side(atLimit) : side(margin.map((m) => m < -tol));
  const governing = side(need.map((n) => Math.abs(n - largest) <= tol));
  const selectedKey = !selectedSuffices ? "not-enough" : noReserve ? "exactly-enough" : "enough";
  const capKey = !minimumFinite ? "no-finite" : Math.abs(minimumSqueeze - cap) <= tol ? "at-cap" : minimumSqueeze < cap ? "within-cap" : "beyond-cap";
  const status = !minimumFinite ? "no-friction" : !capSuffices ? "beyond-cap" : !selectedSuffices ? "more-squeeze" : noReserve ? "limiting" : "balanced";
  const offsetLimitRaw = minimumFinite ? a * (2 * mu * cap / weight - 1) : null;
  const offsetLimit = offsetLimitRaw !== null && offsetLimitRaw >= 0 ? zero(offsetLimitRaw) : null;
  const useMinimum = !minimumFinite ? { action: "refuse", reason: "no-finite" } : !capSuffices ? { action: "refuse", reason: "exceeds-cap" } : { action: "apply", squeeze: zero(Math.min(minimumSqueeze, cap)) };
  const contacts = [[zero(a * tangential[0]), squeeze, tangential[0]], [zero(-a * tangential[1]), zero(-squeeze), tangential[1]]];
  const gravity = [zero(weight * x), 0, -weight];
  const net = [0, 1, 2].map((i) => zero(contacts[0][i] + contacts[1][i] + gravity[i]));
  return {
    inputs: { x, squeeze, mu, cap },
    weight,
    tangential,
    normal: [squeeze, squeeze],
    frictionBound,
    capBound,
    minimumSqueeze,
    minimumFinite,
    margin,
    selectedByContact,
    selectedSuffices,
    capSuffices,
    noReserve,
    requiredForBalance: !selectedSuffices,
    limiting,
    governing,
    selectedKey,
    capKey,
    status,
    offsetLimit,
    useMinimum,
    wrench: { contacts, gravity, net }
  };
}
function presetState(name, config) {
  const preset = Object.hasOwn(config.presets, name) ? name : config.defaultPreset;
  const p = config.presets[preset];
  return { x: zero(p.x), squeeze: zero(p.squeeze), mu: zero(p.mu), cap: zero(p.cap) };
}
function matchPreset(state, config) {
  const tol = config.tolerance.match;
  for (const [name, p] of Object.entries(config.presets)) {
    if (FIELDS.every((key) => Math.abs(state[key] - p[key]) <= tol)) return name;
  }
  return null;
}
function quantize(value, control, max = control.max) {
  const steps = Math.round((value - control.min) / control.step);
  const snapped = Number((control.min + steps * control.step).toFixed(control.decimals));
  return zero(Math.min(max, Math.max(control.min, snapped)));
}
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
function reduce(state, action, config) {
  const f = (value) => format(value, 3);
  switch (action.type) {
    case "preset":
      return { state: presetState(action.name, config), notice: null };
    case "reset":
      return { state: presetState(config.defaultPreset, config), notice: null };
    case "set": {
      const { field, value } = action;
      if (!FIELDS.includes(field) || !finite(value)) return { state, notice: null };
      const next = { ...state };
      const control = config.controls[field];
      if (field === "squeeze") next.squeeze = quantize(value, control, state.cap);
      else next[field] = quantize(value, control);
      if (field === "cap" && state.squeeze > next.cap) {
        next.squeeze = next.cap;
        const result = calculate(next, config);
        const minimum = result.minimumFinite ? `${f(result.minimumSqueeze)} N per finger.` : "no finite squeeze.";
        return { state: next, notice: {
          kind: "cap",
          text: `Cap lowered to ${f(next.cap)} N: squeeze reduced from ${f(state.squeeze)} to ${f(next.cap)} N per finger. Required minimum: ${minimum}`
        } };
      }
      return { state: next, notice: null };
    }
    case "useMinimum": {
      const result = calculate(state, config);
      const stays = `Squeeze stays at ${f(state.squeeze)} N per finger.`;
      if (result.useMinimum.action === "refuse") {
        const text2 = result.useMinimum.reason === "no-finite" ? `Use minimum: without friction no finite squeeze can balance the box. ${stays}` : `Use minimum: the required ${f(result.minimumSqueeze)} N per finger exceeds the ${f(state.cap)} N cap, so no squeeze within the cap can balance this load. ${stays}`;
        return { state, notice: { kind: "minimum", text: text2 } };
      }
      const next = { ...state, squeeze: result.useMinimum.squeeze };
      const text = Math.abs(state.squeeze - next.squeeze) <= config.tolerance.force ? `Squeeze already equals the minimum, ${f(next.squeeze)} N per finger.` : `Squeeze set to the minimum, ${f(next.squeeze)} N per finger: a friction limit is reached exactly, with no reserve.`;
      return { state: next, notice: { kind: "minimum", text } };
    }
    default:
      return { state, notice: null };
  }
}
function stateFromQuery(search, config) {
  const params = new URLSearchParams(search);
  const notes = [];
  const defaultLabel = config.presets[config.defaultPreset].label;
  const rawPreset = params.get("preset");
  const validPreset = rawPreset !== null && Object.hasOwn(config.presets, rawPreset);
  if (rawPreset !== null && !validPreset) notes.push(`Unknown preset "${rawPreset.slice(0, 24)}": opened ${defaultLabel}.`);
  const context = validPreset ? rawPreset : config.defaultPreset;
  const state = presetState(context, config);
  const preset = config.presets[context];
  const f = (value) => format(value, 3);
  const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
  const number = (key) => {
    const raw = params.get(key);
    if (raw === null) return void 0;
    if (!NUMBER.test(raw)) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? zero(value) : null;
  };
  const c = config.controls;
  let openSecondary = false;
  const mu = number("mu");
  if (mu === null) notes.push("Invalid friction coefficient: kept the preset value.");
  else if (mu !== void 0) {
    state.mu = clamp(mu, c.mu.min, c.mu.max);
    if (state.mu !== mu) notes.push(`Friction coefficient limited to ${f(c.mu.min)}\u2013${f(c.mu.max)}.`);
    if (state.mu !== preset.mu) openSecondary = true;
  }
  const cap = number("cap");
  if (cap === null) notes.push("Invalid cap: kept the preset value.");
  else if (cap !== void 0) {
    state.cap = clamp(cap, c.cap.min, c.cap.max);
    if (state.cap !== cap) notes.push(`Cap limited to ${f(c.cap.min)}\u2013${f(c.cap.max)} N.`);
    if (state.cap !== preset.cap) openSecondary = true;
  }
  const x = number("x");
  if (x === null) notes.push("Invalid offset: kept the preset value.");
  else if (x !== void 0) {
    state.x = clamp(x, c.x.min, c.x.max);
    if (state.x !== x) notes.push(`Offset limited to the \xB1${f(c.x.max)} m range.`);
  }
  const squeeze = number("squeeze");
  if (squeeze === null) notes.push("Invalid squeeze: kept the preset value.");
  else if (squeeze !== void 0) {
    if (squeeze < c.squeeze.min) {
      state.squeeze = c.squeeze.min;
      notes.push(`Squeeze limited to ${f(c.squeeze.min)}\u2013${f(state.cap)} N.`);
    } else state.squeeze = squeeze;
  }
  if (state.squeeze > state.cap) {
    state.squeeze = state.cap;
    notes.push(`Squeeze reduced to the ${f(state.cap)} N cap.`);
  }
  for (const key of FIELDS) state[key] = zero(state[key]);
  return { state, context, notes, openSecondary };
}
function stateQuery(state, context, config) {
  if (matchPreset(state, config) === context) return `preset=${encodeURIComponent(context)}`;
  const params = new URLSearchParams({ preset: context });
  for (const key of FIELDS) params.set(key, String(state[key]));
  return params.toString();
}
function format(value, digits = 3) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "\u2014";
  const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  const text = rounded.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return (text === "-0" ? "0" : text).replace("-", "\u2212");
}
function formatAll(values, digits = 3) {
  const distinct = [...new Set(values)];
  let d = digits;
  while (d < 6 && new Set(distinct.map((v) => format(v, d))).size < distinct.length) d += 1;
  return values.map((v) => format(v, d));
}
const formatPair = (a, b, digits = 3) => formatAll([a, b], digits);
export {
  FIELDS,
  PX_PER_M,
  PX_PER_N,
  STATUS_KEYS,
  calculate,
  canonical,
  effectiveRanges,
  format,
  formatAll,
  formatPair,
  matchPreset,
  physicsSubset,
  presetState,
  quantize,
  reduce,
  stateFromQuery,
  stateQuery,
  validateConfig
};
