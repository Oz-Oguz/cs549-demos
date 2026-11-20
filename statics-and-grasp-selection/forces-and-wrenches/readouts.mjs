import { calculate, format, momentSense } from "./model.mjs";
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const symbol = (name, component) => `<msub><mi>${name}</mi><mi>${component}</mi></msub>`;
const number = (value) => {
  const label = format(value);
  return label.startsWith("\u2212") ? `<mo>\u2212</mo><mn>${label.slice(1)}</mn>` : `<mn>${label}</mn>`;
};
const units = (moment) => moment ? '<mi mathvariant="normal">N</mi><mo>\xB7</mo><mi mathvariant="normal">m</mi>' : '<mi mathvariant="normal">N</mi>';
function quantity(value, { moment = false, variable = "", label }) {
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="${escape(label)}"><mrow>${variable ? `${variable}<mo>=</mo>` : ""}${number(value)}<mspace width="0.25em"/>${units(moment)}</mrow></math>`;
}
function readouts(state, config, { horizontal = false, staticFigure = false, contributionsOpen = false } = {}) {
  const values = calculate(state, config);
  const reference = horizontal ? "O" : state.reference;
  const context = `<p class="readout-context">About <span class="reference-name">${reference}</span><span class="context-separator">\xB7</span>world frame W</p>`;
  if (horizontal) {
    const [x, , z] = config.horizontal.application;
    const [fx, , fz] = config.horizontal.force;
    const moment2 = z * fx - x * fz;
    return `${context}<dl class="net-results"><div class="net-result"><dt>Horizontal force</dt><dd data-value="${fx}">${quantity(fx, { variable: symbol("f", "x"), label: `f_x = ${format(fx)} N` })}</dd></div><div class="net-result critical"><dt>Moment of this force</dt><dd data-value="${moment2}">${quantity(moment2, { moment: true, variable: symbol("\u03C4", "y"), label: `\u03C4_y = ${format(moment2)} N m` })}</dd><dd class="moment-sense">${momentSense(moment2)}</dd></div></dl><p class="readout-note">One force contribution.</p>`;
  }
  if (!state.reveal) return `${context}<div class="prediction"><p class="prediction-label">Make a prediction</p><h2>Can the box remain at rest?</h2><p>Check the forces.<br>Then check their moments.</p></div>`;
  const force = values.net[2], moment = values.net[0];
  const nonzero = (value) => Math.abs(value) > 1e-9;
  const contributions = `<dl><div><dt>Support</dt><dd data-contribution="support" data-value="${values.support[0]}">${quantity(values.support[0], { moment: true, label: `support: ${format(values.support[0])} N m` })}</dd></div><div><dt>Gravity</dt><dd data-contribution="gravity" data-value="${values.gravity[0]}">${quantity(values.gravity[0], { moment: true, label: `gravity: ${format(values.gravity[0])} N m` })}</dd></div></dl>`;
  const contributionView = staticFigure ? reference === "Q" ? `<div class="moment-contributions-static"><p class="contribution-title">Moment contributions</p>${contributions}</div>` : "" : `<details id="moment-contributions" ${contributionsOpen ? "open" : ""}><summary>Moment contributions</summary>${contributions}</details>`;
  return `${context}
    <dl class="net-results">
      <div class="net-result ${nonzero(force) ? "critical" : ""}">
        <dt>Net vertical force</dt>
        <dd id="net-force" data-value="${force}">${quantity(force, { variable: symbol("f", "z"), label: `f_z = ${format(force)} N` })}</dd>
      </div>
      <div class="net-result ${nonzero(moment) ? "critical" : ""}">
        <dt>Net moment</dt>
        <dd id="net-moment" data-value="${moment}">${quantity(moment, { moment: true, variable: symbol("\u03C4", "y"), label: `\u03C4_y = ${format(moment)} N m` })}</dd>
        <dd class="moment-sense">${momentSense(moment)}</dd>
      </div>
    </dl>
    ${contributionView}`;
}
export {
  readouts
};
