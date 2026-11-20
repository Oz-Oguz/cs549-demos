import { FIELDS, PX_PER_N, VIEWBOX, calculate, fieldControl, format, getField, matchPreset, reduce, stateFromQuery, stateQuery, stillPreset, validateConfig } from "./model.mjs";
import { diagram } from "./diagram.mjs";
import { describe } from "./readouts.mjs";
const byId = (id) => document.getElementById(id);
const still = (name) => `../fallback/friction-cone/${name}.png`;
const URL_WRITE_MS = 150;
const GRAB_RADIUS = 24;
function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  window.fc = { error: message, ready: false };
  for (const element of document.querySelectorAll("main button, main input, main select")) element.disabled = true;
  for (const id of ["diagram", "headline", "statuses", "selected-forces", "wrench-values", "closure", "alpha", "mass-aside", "announce"]) byId(id).replaceChildren();
  const link = document.createElement("a");
  link.href = still("inside");
  link.textContent = "prepared still";
  const notice = byId("notice");
  notice.replaceChildren(`The live explainer could not load its cases (${message}). Reload the page or use the `, link, ".");
  notice.hidden = false;
  console.error(error);
}
try {
  let dispatch = function(action, { throttled = false, commit: commit2 = false } = {}) {
    try {
      if (["preset", "reset", "view", "components"].includes(action.type)) labelMemory.clear();
      state = reduce(state, action, config);
      notice = "";
      render({ throttled, commit: commit2 });
    } catch (error) {
      fail(error);
    }
  }, commit = function() {
    render({ commit: true });
  }, writeURL = function(throttled) {
    const write = () => {
      clearTimeout(urlTimer);
      urlTimer = 0;
      lastWrite = throttled ? performance.now() : -Infinity;
      const search = `?${stateQuery(state, context, config)}`;
      if (search !== location.search) history.replaceState(null, "", search);
    };
    if (!throttled || performance.now() - lastWrite >= URL_WRITE_MS) {
      write();
      return;
    }
    if (!urlTimer) urlTimer = setTimeout(write, URL_WRITE_MS - (performance.now() - lastWrite));
  }, render = function({ throttled = false, commit: commit2 = false } = {}) {
    const result = calculate(state, config);
    const text = describe(result, state, config);
    const preset = matchPreset(state, config);
    if (preset && commit2) context = preset;
    if (state.push !== 0) pushSide = state.push < 0 ? "right" : "left";
    document.body.dataset.view = state.view;
    svg.innerHTML = diagram(state, result, config, void 0, labelMemory, { side: pushSide });
    svg.dataset.view = state.view;
    for (const button of document.querySelectorAll(".views button")) button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
    modified.hidden = Boolean(preset);
    modified.textContent = "Modified";
    select.value = preset ?? "";
    select.dataset.modified = String(!preset);
    select.title = preset ? config.presets[preset].label : `Modified from ${config.presets[context].label}`;
    for (const field of FIELDS) {
      const input = byId(field), value = getField(state, field);
      input.value = value;
      const text2 = `${format(value, decimals(field))}${units(field)}`;
      input.setAttribute("aria-valuetext", text2);
      byId(`${field}-value`).textContent = text2;
      byId(`${field}-value`).dataset.value = value;
    }
    setHTML("alpha", text.alpha);
    setHTML("mass-aside", text.mass ?? "");
    byId("components").checked = state.components;
    const pair = state.view === "pair";
    const readout = byId("readout");
    readout.dataset.status = pair ? result.contacts.map((c) => c.status).join(" ") : result.box.noPush ? `${result.box.status} no-push` : result.box.status;
    byId("headline").textContent = text.headline;
    if (text.headline !== announced) {
      byId("announce").textContent = text.headline;
      announced = text.headline;
    }
    setHTML("statuses", text.contacts.map((c, i) => `<li data-status="${c.key}"${pair ? ` data-contact="${i + 1}"` : ""}><span class="status-title">${c.title}:</span> ${c.text}${c.note ? `<span class="note">${c.note}</span>` : ""}</li>`).join(""));
    byId("wrench").hidden = !pair;
    byId("closure").hidden = !pair;
    if (pair) {
      byId("selected-forces").textContent = text.wrench.summary;
      setHTML("wrench-values", text.wrench.values.map((v) => `<span data-key="${v.key}" data-value="${v.value}">${v.label} = <span class="value">${v.text}</span>${v.note ? ` <span class="dir">${v.note}</span>` : ""}</span>`).join(""));
      setHTML("closure", text.closure.text);
      byId("closure").dataset.key = text.closure.key;
    }
    const noticeNode = byId("notice");
    noticeNode.textContent = notice;
    noticeNode.hidden = !notice;
    const stillName = stillPreset(state, context, config);
    byId("still").href = still(stillName);
    byId("still").textContent = `Prepared still (${config.presets[stillName].label})`;
    writeURL(throttled && !commit2);
    drawScaleBar();
    window.fc = structuredClone({ state, result, text, preset, context, notice, pushSide, ready: true });
  }, drawScaleBar = function() {
    const px = svg.getBoundingClientRect().width / VIEWBOX.width * 5 * PX_PER_N;
    const bar = byId("scale-bar");
    bar.setAttribute("width", Math.ceil(px + 4));
    bar.setAttribute("viewBox", `0 0 ${Math.ceil(px + 4)} 12`);
    bar.dataset.px = px;
    byId("scale-bar-path").setAttribute("d", `M2,1 V11 M2,6 H${px + 2} M${px + 2},1 V11`);
  };
  const response = await fetch("./cases.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const config = validateConfig(await response.json());
  const initial = stateFromQuery(location.search, config);
  let { state, context } = initial;
  let notice = initial.notes.join(" ");
  for (const field of FIELDS) {
    const input = byId(field), control = fieldControl(field, config);
    input.min = control.min;
    input.max = control.max;
    input.step = control.step;
    input.addEventListener("input", () => dispatch({ type: "set", field, value: Number(input.value) }, { throttled: true }));
    input.addEventListener("change", commit);
  }
  const select = byId("preset");
  const modified = document.createElement("option");
  modified.value = "";
  modified.disabled = true;
  modified.id = "preset-modified";
  select.append(modified);
  for (const view of ["single", "pair"]) {
    const group = document.createElement("optgroup");
    group.label = config.views[view].label;
    for (const [name, p] of Object.entries(config.presets)) {
      if (p.view !== view) continue;
      const option = document.createElement("option");
      option.value = name;
      option.textContent = p.label;
      group.append(option);
    }
    select.append(group);
  }
  select.addEventListener("change", () => {
    if (!select.value) return;
    context = select.value;
    dispatch({ type: "preset", name: select.value });
  });
  for (const button of document.querySelectorAll(".views button")) {
    button.addEventListener("click", () => dispatch({ type: "view", view: button.dataset.view }, { commit: true }));
  }
  byId("components").addEventListener("change", (event) => dispatch({ type: "components", on: event.target.checked }, { commit: true }));
  byId("reset").addEventListener("click", () => {
    context = config.defaultPreset;
    dispatch({ type: "reset" });
  });
  const svg = byId("diagram");
  let drag = null, lastDragged = null;
  let pushSide = state.push < 0 ? "right" : "left";
  const toViewBox = (event) => {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [point.x, point.y];
  };
  const nearestHandle = (x, y) => {
    const hits = [];
    for (const handle of svg.querySelectorAll(".handle")) {
      const push = handle.classList.contains("push-handle");
      const [hx, hy] = (push ? handle.dataset.tail : handle.dataset.tip).split(",").map(Number);
      const d = Math.hypot(x - hx, y - hy);
      if (d <= GRAB_RADIUS) hits.push(push ? { kind: "push", side: handle.dataset.side, d, hx, hy } : { kind: "tip", contact: Number(handle.dataset.contact), d, hx, hy });
    }
    hits.sort((p, q) => p.d - q.d);
    if (hits.length > 1 && hits[1].d - hits[0].d < 2 && hits[0].contact === lastDragged) return hits[1];
    return hits[0] ?? null;
  };
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag) return;
    const [x, y] = toViewBox(event);
    const hit = nearestHandle(x, y);
    if (!hit) return;
    drag = { ...hit, pointerId: event.pointerId, dx: hit.hx - x, dy: hit.hy - y };
    if (hit.kind === "tip") lastDragged = hit.contact;
    else pushSide = hit.side;
    svg.setPointerCapture(event.pointerId);
    svg.classList.add("dragging");
    event.preventDefault();
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const [x, y] = toViewBox(event);
    if (drag.kind === "push") dispatch({ type: "dragPush", x: x + drag.dx, side: drag.side }, { throttled: true });
    else dispatch({ type: "drag", contact: drag.contact, x: x + drag.dx, y: y + drag.dy }, { throttled: true });
  });
  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    svg.classList.remove("dragging");
    commit();
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("lostpointercapture", endDrag);
  addEventListener("pagehide", () => writeURL(false));
  const labelMemory = /* @__PURE__ */ new Map();
  let urlTimer = 0, lastWrite = -Infinity;
  const units = (field) => field === "mu" ? "" : field === "mass" ? " kg" : " N";
  const decimals = (field) => field === "mu" ? 2 : field === "push" ? 3 : 1;
  let announced = null;
  const shown = {};
  const setHTML = (id, markup) => {
    if (shown[id] !== markup) {
      byId(id).innerHTML = markup;
      shown[id] = markup;
    }
  };
  addEventListener("resize", drawScaleBar);
  render({ commit: true });
} catch (error) {
  fail(error);
}
