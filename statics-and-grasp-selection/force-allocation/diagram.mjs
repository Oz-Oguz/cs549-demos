import { PX_PER_M, PX_PER_N, format, formatAll } from "./model.mjs";
const color = { navy: "#17334a", slate: "#566c7b", coral: "#be513b", green: "#07825e" };
const { navy, slate, coral, green } = color;
const OX = 310, OY = 205, LEFT = 220, RIGHT = 400, TOP = 85, BOTTOM = 325;
const HEAD = 14;
const TINY = 1.2 * PX_PER_N;
const MAX_NORMAL = 18;
const GAP = 30, FLOOR = 190, CEILING = 30;
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const r = (value) => Math.round(value * 100) / 100;
const f = (value) => format(value, 3);
const attrs = (map) => Object.entries(map).filter(([, v]) => v !== void 0 && v !== null && v !== false).map(([k, v]) => `${k}="${esc(v)}"`).join(" ");
const text = (x, y, value, { size = 24, fill = navy, anchor = "middle", ...rest } = {}) => `<text ${attrs({ x: r(x), y: r(y), "font-size": size, fill, "text-anchor": anchor, ...rest })}>${esc(value)}</text>`;
const line = (x1, y1, x2, y2, stroke = slate, width = 2, rest = {}) => `<path ${attrs({ d: `M${r(x1)},${r(y1)} L${r(x2)},${r(y2)}`, stroke, "stroke-width": width, fill: "none", ...rest })}/>`;
const dot = (x, y, radius, fill = navy, id) => `<circle ${attrs({ id, cx: r(x), cy: r(y), r: radius, fill })}/>`;
function arrow(x1, y1, x2, y2, name, { dash, width = 4, hollow = false } = {}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 0.5) return "";
  const ux = (x2 - x1) / length, uy = (y2 - y1) / length;
  if (length < TINY) {
    const w = 6 * Math.max(0.5, length / TINY);
    const d = `M${r(x2)},${r(y2)} L${r(x1 - uy * w)},${r(y1 + ux * w)} L${r(x1 + uy * w)},${r(y1 - ux * w)} Z`;
    return `<path ${attrs({
      d,
      fill: hollow ? "white" : color[name],
      stroke: hollow ? color[name] : void 0,
      "stroke-width": hollow ? 1.6 : void 0,
      "data-head-only": "true",
      "data-hollow": hollow ? "true" : void 0
    })}/>`;
  }
  return line(
    x1,
    y1,
    x2 - ux * (HEAD - 1),
    y2 - uy * (HEAD - 1),
    color[name],
    width,
    { "stroke-dasharray": dash, "marker-end": `url(#b4-head-${name}${hollow ? "-hollow" : ""})` }
  );
}
const markers = Object.entries(color).map(([name, fill]) => `<marker id="b4-head-${name}" viewBox="0 0 ${HEAD} 12" markerWidth="${HEAD}" markerHeight="12" refX="1" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L${HEAD},6 L0,12 Z" fill="${fill}"/></marker>`).join("") + `<marker id="b4-head-coral-hollow" viewBox="0 0 ${HEAD} 12" markerWidth="${HEAD}" markerHeight="12" refX="1" refY="6" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><path d="M1,1.5 L${HEAD - 1},6 L1,10.5 Z" fill="white" stroke="${coral}" stroke-width="1.6"/></marker>`;
function breakMark(xm) {
  const slash = (dx) => line(xm + dx - 4, OY + 12, xm + dx + 4, OY - 12, green, 2.5);
  return `<path d="M${xm - 6},${OY + 6} L${xm - 2},${OY - 6} L${xm + 6},${OY - 6} L${xm + 2},${OY + 6} Z" fill="white"/>${slash(-4)}${slash(4)}`;
}
function resolve(items) {
  items.sort((a, b) => a.want - b.want);
  items.forEach((item, i) => {
    item.y = i ? Math.max(item.want, items[i - 1].y + GAP) : item.want;
  });
  for (let i = items.length - 1; i >= 0; i -= 1) items[i].y = Math.min(items[i].y, i === items.length - 1 ? FLOOR : items[i + 1].y - GAP);
  items.forEach((item, i) => {
    item.y = Math.max(item.y, i ? items[i - 1].y + GAP : CEILING);
  });
  return items;
}
function contact(i, state, result) {
  const sign = i === 0 ? -1 : 1;
  const face = i === 0 ? LEFT : RIGHT;
  const ft = result.tangential[i];
  const dashed = result.requiredForBalance;
  const failing = !result.selectedByContact[i];
  const index = i + 1;
  let svg = "";
  const truncated = state.squeeze > MAX_NORMAL;
  const length = Math.min(state.squeeze, MAX_NORMAL) * PX_PER_N;
  const tail = face + sign * length;
  svg += `<g ${attrs({ id: `b4-fn-${index}`, "data-value": state.squeeze, "data-truncated": String(truncated) })}>${arrow(tail, OY, face, OY, "green")}${truncated ? breakMark((tail + face) / 2) : ""}</g>`;
  svg += text(face + sign * 64, 244, `${f(state.squeeze)} N`, { size: 25, fill: green, id: `b4-fn-label-${index}` });
  const tip = OY - ft * PX_PER_N;
  const shaft = Math.abs(ft) * PX_PER_N;
  svg += `<g ${attrs({ id: `b4-ft-${index}`, "data-value": ft, "data-tail": `${face},${OY}`, "data-tip": `${face},${r(tip)}`, "data-dashed": String(dashed) })}>${arrow(face, OY, face, tip, "coral", { dash: dashed ? shaft < 24 ? "3 2" : "7 5" : void 0, hollow: dashed })}</g>`;
  const anchor = i === 0 ? "end" : "start";
  const labelX = face + sign * 18;
  const above = [];
  const [ftText, limitText] = failing ? formatAll([ft, result.frictionBound]) : [f(ft), f(result.frictionBound)];
  const value = { id: `b4-ft-label-${index}`, value: `${ftText} N`, size: 26, fill: coral, want: tip - 12, anchor: [face + sign * 4, tip] };
  if (ft >= 0) above.push(value);
  if (failing && result.frictionBound > 0) {
    const by = OY - (Math.sign(ft) || 1) * result.frictionBound * PX_PER_N;
    svg += line(face + sign * 7, by, face + sign * 15, by, slate, 2.5, { id: `b4-limit-tick-${index}` });
    above.push({ id: `b4-limit-${index}`, value: `limit: ${limitText} N`, size: 22, fill: slate, want: by + 8, anchor: [face + sign * 15, by] });
  } else if (failing) above.push({ id: `b4-limit-${index}`, value: `limit: ${limitText} N`, size: 22, fill: slate, want: FLOOR });
  for (const item of resolve(above)) {
    if (item.anchor && Math.abs(item.y - item.want) > 10) {
      svg += line(labelX - sign * 3, item.y - 8, ...item.anchor, slate, 1.3);
    }
    svg += text(labelX, item.y, item.value, { size: item.size, fill: item.fill, anchor, id: item.id });
  }
  if (ft < 0) svg += text(labelX, Math.min(400, Math.max(280, tip + 30)), value.value, { size: 26, fill: coral, anchor, id: value.id });
  return svg;
}
function diagram(state, result, config) {
  const xc = OX + state.x * PX_PER_M;
  const weight = result.weight;
  const dashed = result.requiredForBalance;
  let svg = `<rect x="${LEFT}" y="${TOP}" width="${RIGHT - LEFT}" height="${BOTTOM - TOP}" fill="#f2f5f6" stroke="${navy}" stroke-width="2"/>`;
  svg += text(OX, 117, `${format(config.mass)} kg box`, { size: 25 });
  svg += arrow(48, 351, 100, 351, "slate", { width: 2.5 }) + arrow(48, 351, 48, 299, "slate", { width: 2.5 });
  svg += text(115, 359, "x", { size: 24, "font-style": "italic" }) + text(48, 285, "z", { size: 24, "font-style": "italic" });
  svg += text(20, 400, "\u2297 +y into page", { size: 20, anchor: "start" });
  if (state.x === 0) {
    svg += text(OX, 179, "O = CoM", { size: 24, id: "b4-o-label" });
  } else {
    svg += text(OX + (state.x > 0 ? -19 : 19), 231, "O", { size: 24, id: "b4-o-label" });
    svg += text(Math.min(368, Math.max(252, xc)), 182, "CoM", { size: 24, id: "b4-com-label" });
    svg += line(OX, 67, xc, 67) + line(OX, 59, OX, 75) + line(xc, 59, xc, 75);
    svg += line(OX, 75, OX, TOP, slate, 2, { "stroke-dasharray": "3 3" }) + line(xc, 75, xc, TOP, slate, 2, { "stroke-dasharray": "3 3" });
    svg += text((OX + xc) / 2, 48, `${format(Math.abs(state.x) * 100, 2)} cm`, { size: 24, fill: slate, id: "b4-offset-label" });
  }
  svg += `<g ${attrs({ id: "b4-gravity", "data-value": weight })}>${arrow(xc, OY, xc, OY + weight * PX_PER_N, "navy")}</g>`;
  svg += line(xc, OY + weight * PX_PER_N + 8, xc, 347) + text(xc, 379, `${f(weight)} N`, { size: 26, id: "b4-gravity-label" });
  svg += contact(0, state, result) + contact(1, state, result);
  svg += dot(OX, OY, state.x === 0 ? 5 : 4, navy, "b4-o") + (state.x === 0 ? "" : dot(xc, OY, 5, navy, "b4-com"));
  svg += dot(LEFT, OY, 5) + dot(RIGHT, OY, 5);
  for (const [i, face, home] of [[1, LEFT, LEFT + 18], [2, RIGHT, RIGHT - 18]]) {
    const bx = Math.abs(xc - home) < 16 ? face : home;
    svg += `<g id="b4-badge-${i}"><circle cx="${r(bx)}" cy="230" r="10" fill="white" stroke="${navy}" stroke-width="1.5"/>${text(bx, 235, String(i), { size: 15, "font-weight": 700 })}</g>`;
  }
  if (dashed) {
    svg += `<g id="b4-key">${arrow(204, 404, 244, 404, "coral", { dash: "7 5", hollow: true })}${text(252, 410, "required for balance", { size: 18, fill: coral, anchor: "start" })}</g>`;
  }
  const [ft1, ft2] = result.tangential.map(f);
  const title = `Forces on the box: ${dashed ? "balance would need more friction than the squeeze allows" : "friction can balance the box"}`;
  const desc = `A ${format(config.mass)} kg box with its centre of mass ${state.x === 0 ? "at O" : `${format(Math.abs(state.x), 4)} m ${state.x > 0 ? "right" : "left"} of O`}. Each finger squeezes ${f(state.squeeze)} N inward (green normal force). Upward friction ${dashed ? "required for balance (dashed shafts, hollow heads; not forces the grasp produces)" : "at the contacts"}: ${ft1} N left, ${ft2} N right; each contact may supply ${f(result.frictionBound)} N. Gravity ${f(weight)} N acts at the centre of mass. Drawn at 10 px per N, 3000 px per m.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 420" role="img" aria-labelledby="b4-title b4-desc" data-dashed="${dashed}" data-status="${esc(result.status)}"><title id="b4-title">${esc(title)}</title><desc id="b4-desc">${esc(desc)}</desc><style>text{font-family:Arial,Helvetica,sans-serif}</style><rect width="620" height="420" fill="white"/><defs>${markers}</defs>${svg}</svg>`;
}
export {
  diagram
};
