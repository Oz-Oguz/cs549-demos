import { calculate, presetState, stateFromQuery, stateQuery, format } from "./model.mjs";
import { diagram } from "./diagram.mjs";
import { readouts } from "./readouts.mjs";
const byId = (id) => document.getElementById(id);
try {
  let render = function(updateURL = true) {
    const values = calculate(state, config);
    byId("scene").innerHTML = diagram(state, config, false, { variant: "scene" });
    byId("readout").innerHTML = readouts(state, config, { contributionsOpen });
    const contributions = byId("moment-contributions");
    if (contributions) contributions.querySelector("summary").addEventListener("click", (event) => {
      event.preventDefault();
      contributionsOpen = !contributions.open;
      contributions.open = contributionsOpen;
    });
    byId("position").value = state.x;
    byId("position-value").textContent = format(state.x, 4);
    byId("reference").value = state.reference;
    byId("reveal").textContent = state.reveal ? "Hide balances" : "Reveal balances";
    byId("reveal").setAttribute("aria-pressed", String(state.reveal));
    for (const button of byId("presets").children) {
      const preset = config.presets[button.dataset.preset];
      const matches = button.dataset.preset === state.preset && state.x === preset.x && state.force === preset.force;
      button.setAttribute("aria-pressed", String(matches));
    }
    if (updateURL) history.replaceState(null, "", `?${stateQuery(state)}`);
    window.b1 = { state: { ...state }, result: values };
  };
  const response = await fetch("./cases.json");
  if (!response.ok) throw new Error(`Cannot load cases (${response.status}).`);
  const config = await response.json();
  const initial = stateFromQuery(location.search, config);
  let state = initial.state;
  let contributionsOpen = state.reference === "Q";
  byId("notice").textContent = initial.notes.join(" ");
  byId("position").min = config.slider.min;
  byId("position").max = config.slider.max;
  byId("position").step = "any";
  for (const [name, preset] of Object.entries(config.presets)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.preset = name;
    button.textContent = preset.label;
    button.addEventListener("click", () => {
      state = presetState(name, config);
      contributionsOpen = false;
      byId("reference-options").open = false;
      byId("notice").textContent = "";
      render();
    });
    byId("presets").append(button);
  }
  byId("position").addEventListener("input", (event) => {
    state.x = Number(event.target.value);
    byId("notice").textContent = "";
    render();
  });
  byId("position").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const direction = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1;
    state.x = Math.max(config.slider.min, Math.min(config.slider.max, Number((state.x + direction * config.slider.step).toFixed(6))));
    render();
  });
  byId("reference").addEventListener("change", (event) => {
    state.reference = event.target.value;
    contributionsOpen = state.reference === "Q";
    render();
  });
  byId("reveal").addEventListener("click", () => {
    state.reveal = !state.reveal;
    render();
  });
  byId("reset").addEventListener("click", () => {
    state = presetState("centered", config);
    contributionsOpen = false;
    byId("reference-options").open = false;
    byId("notice").textContent = "";
    render();
  });
  if (state.reference === "Q") byId("reference-options").open = true;
  render();
} catch (error) {
  byId("notice").textContent = `The live diagram could not load. Reload the page. ${error.message}`;
  byId("reveal").disabled = true;
  console.error(error);
}
