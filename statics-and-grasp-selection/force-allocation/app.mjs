import { calculate, format, matchPreset, reduce, stateFromQuery, stateQuery, validateConfig } from "./model.mjs";
import { diagram } from "./diagram.mjs";
import { describe, tangentialSymbol } from "./readouts.mjs";
const byId = (id) => document.getElementById(id);
const FOCUS_ROW = { selected: "row-selected", contacts: "row-contacts", cap: "row-cap" };
const still = (name) => `../fallback/force-allocation/${name}.png`;
const URL_DEBOUNCE_MS = 300;
function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  window.b4 = { error: message, ready: false };
  for (const element of document.querySelectorAll("main button, main input")) element.disabled = true;
  for (const id of ["scene", "headline", "selected-title", "selected-text", "cap-title", "cap-text", "contacts"]) byId(id).replaceChildren();
  const link = document.createElement("a");
  link.href = still("centered");
  link.textContent = "prepared still";
  const notice = byId("notice");
  notice.dataset.kind = "load";
  notice.replaceChildren(`The live explainer could not load its cases (${message}). Reload the page or use the `, link, ".");
  notice.hidden = false;
  console.error(error);
}
try {
  let dispatch = function(action, urlDelay = 0) {
    try {
      ({ state, notice } = reduce(state, action, config));
      render(urlDelay);
    } catch (error) {
      fail(error);
    }
  }, writeURL = function(delay) {
    clearTimeout(urlTimer);
    const write = () => {
      const search = `?${stateQuery(state, context, config)}`;
      if (search !== location.search) history.replaceState(null, "", search);
    };
    if (delay) urlTimer = setTimeout(write, delay);
    else write();
  }, setRange = function(key, value, valuetext) {
    const input = byId(key);
    input.value = value;
    input.setAttribute("aria-valuetext", valuetext);
  }, render = function(urlDelay = 0) {
    const result = calculate(state, config);
    const text = describe(result, state, config);
    const preset = matchPreset(state, config);
    byId("scene").innerHTML = diagram(state, result, config);
    const results = byId("results");
    Object.assign(results.dataset, { status: result.status, selected: result.selectedKey, cap: result.capKey });
    byId("headline").textContent = text.headline;
    byId("selected-title").textContent = text.selected.title;
    byId("selected-text").textContent = text.selected.text;
    byId("cap-title").textContent = text.cap.title;
    byId("cap-text").textContent = text.cap.text;
    byId("row-selected").dataset.value = state.squeeze;
    byId("row-cap").dataset.value = state.cap;
    byId("row-cap").dataset.minimum = result.minimumSqueeze ?? "";
    const focus = config.presets[context].focus;
    for (const [key, id] of Object.entries(FOCUS_ROW)) {
      const row = byId(id);
      row.classList.toggle("is-focus", key === focus);
      row.classList.toggle("is-context", key !== focus);
    }
    byId("row-selected").classList.toggle("is-fail", text.selected.fail);
    byId("row-cap").classList.toggle("is-fail", text.cap.fail);
    for (const [i, row] of text.contacts.entries()) {
      const item = byId(`contact-${i + 1}`);
      Object.assign(item.dataset, { need: row.need, bound: row.bound, capBound: row.capBound, relation: row.relation });
      item.classList.toggle("is-fail", row.fail);
      item.classList.toggle("is-larger", row.larger);
      const need = item.querySelector(".need-value"), bound = item.querySelector(".bound-value");
      need.textContent = row.needText;
      need.dataset.value = row.need;
      bound.textContent = row.boundText;
      bound.dataset.value = row.bound;
      const rel = item.querySelector(".rel");
      rel.textContent = row.relation;
      rel.setAttribute("aria-label", { "<": "needs less than it may supply", "=": "needs exactly what it may supply", ">": "needs more than it may supply" }[row.relation]);
      item.querySelector(".need").style.width = track(Math.abs(row.need));
      item.querySelector(".bound-tick").style.left = track(row.bound);
      item.querySelector(".cap-tick").style.left = track(row.capBound);
      item.querySelector(".track").dataset.pinned = String(Math.max(Math.abs(row.need), row.bound, row.capBound) > 10);
    }
    byId("squeeze").max = state.cap;
    const side = state.x === 0 ? "at O" : `${format(Math.abs(state.x), 4)} m ${state.x > 0 ? "right" : "left"} of O`;
    setRange("x", state.x, side);
    setRange("squeeze", state.squeeze, `${format(state.squeeze, 3)} N per finger`);
    setRange("mu", state.mu, `friction coefficient ${format(state.mu, 3)}`);
    setRange("cap", state.cap, `${format(state.cap, 3)} N per finger`);
    byId("x-value").textContent = `${format(state.x, 4)} m`;
    byId("squeeze-value").textContent = `${format(state.squeeze, 3)} N`;
    byId("mu-value").textContent = format(state.mu, 3);
    byId("cap-value").textContent = `${format(state.cap, 3)} N`;
    for (const button of byId("presets").children) button.setAttribute("aria-pressed", String(button.dataset.preset === preset));
    byId("question").textContent = config.presets[context].question;
    byId("question").dataset.context = context;
    byId("still").href = still(context);
    byId("still").textContent = `Prepared still (${config.presets[context].label})`;
    const noticeNode = byId("notice");
    noticeNode.textContent = notice?.text ?? "";
    noticeNode.dataset.kind = notice?.kind ?? "";
    noticeNode.hidden = false;
    writeURL(urlDelay);
    window.b4 = structuredClone({ state, result, text, preset, context, notice, ready: true });
  };
  const response = await fetch("./cases.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const config = validateConfig(await response.json());
  const initial = stateFromQuery(location.search, config);
  let { state, context } = initial;
  let notice = initial.notes.length ? { kind: "query", text: initial.notes.join(" ") } : null;
  for (const key of ["x", "squeeze", "mu", "cap"]) {
    const input = byId(key), control = config.controls[key];
    input.min = control.min;
    if (key !== "squeeze") input.max = control.max;
    input.step = control.step;
    input.addEventListener("input", () => dispatch({ type: "set", field: key, value: Number(input.value) }, URL_DEBOUNCE_MS));
  }
  for (const [name, preset] of Object.entries(config.presets)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.preset = name;
    button.textContent = preset.label;
    button.addEventListener("click", () => {
      context = name;
      dispatch({ type: "preset", name });
    });
    byId("presets").append(button);
  }
  for (const [i, contact] of config.contacts.entries()) {
    const item = document.createElement("li");
    item.id = `contact-${i + 1}`;
    item.dataset.contact = contact.name;
    item.innerHTML = `<span class="who">${tangentialSymbol(i + 1)} <span></span></span><span class="cmp">needs <span class="need-value"></span> N \xB7 may supply <span class="bound-value"></span> N</span><span class="rel"></span><span class="track" aria-hidden="true"><span class="need"></span><span class="cap-tick"></span><span class="bound-tick"></span><span class="pin">\u203A</span></span>`;
    item.querySelector(".who > span").textContent = contact.label;
    byId("contacts").append(item);
  }
  byId("use-minimum").addEventListener("click", () => dispatch({ type: "useMinimum" }));
  byId("reset").addEventListener("click", () => {
    context = config.defaultPreset;
    byId("secondary").open = false;
    dispatch({ type: "reset" });
  });
  if (initial.openSecondary) byId("secondary").open = true;
  let urlTimer = 0;
  const track = (value) => `${Math.min(Math.max(value, 0), 10) * 10}%`;
  render();
} catch (error) {
  fail(error);
}
