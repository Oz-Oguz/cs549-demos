function calculate(state, config) {
  const referenceX = state.reference === "Q" ? config.referenceQ[0] : 0;
  const weight = config.mass * config.gravity;
  const support = [-(state.x - referenceX) * state.force, 0, state.force];
  const gravity = [-referenceX * weight, 0, -weight];
  const net = support.map((component, index) => component + gravity[index]);
  return { support, gravity, net };
}
function presetState(name, config) {
  const preset = Object.hasOwn(config.presets, name) ? name : "centered";
  return {
    preset,
    x: config.presets[preset].x,
    force: config.presets[preset].force,
    reference: "O",
    reveal: false
  };
}
function stateFromQuery(search, config) {
  const params = new URLSearchParams(search);
  const notes = [];
  const name = params.get("preset") || "centered";
  const state = presetState(name, config);
  if (!Object.hasOwn(config.presets, name)) notes.push("Unknown preset: using Centered.");
  if (params.has("x")) {
    const raw = params.get("x");
    const x = Number(raw);
    if (!raw.trim() || !Number.isFinite(x)) notes.push("Invalid position: using the preset position.");
    else {
      state.x = Math.max(config.slider.min, Math.min(config.slider.max, x));
      if (state.x !== x) notes.push("Position limited to the bottom-face slider range.");
    }
  }
  if (params.has("reference")) {
    const reference = params.get("reference");
    if (["O", "Q"].includes(reference)) state.reference = reference;
    else notes.push("Unknown reporting point: using O.");
  }
  if (params.has("reveal")) {
    const reveal = params.get("reveal");
    if (["0", "1"].includes(reveal)) state.reveal = reveal === "1";
    else notes.push("Invalid reveal state: starting with the prediction.");
  }
  return { state, notes };
}
function stateQuery(state) {
  return new URLSearchParams({
    preset: state.preset,
    x: String(state.x),
    reference: state.reference,
    reveal: state.reveal ? "1" : "0"
  }).toString();
}
function format(value, digits = 4) {
  const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return rounded.toFixed(digits).replace(/\.?0+$/, "").replace("-", "\u2212") || "0";
}
function momentSense(moment) {
  return Math.abs(moment) < 1e-9 ? "zero moment" : moment > 0 ? "clockwise as drawn" : "counterclockwise as drawn";
}
export {
  calculate,
  format,
  momentSense,
  presetState,
  stateFromQuery,
  stateQuery
};
