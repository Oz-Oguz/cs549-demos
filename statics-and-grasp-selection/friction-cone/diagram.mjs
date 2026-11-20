import { VIEWBOX, ORIGIN, PX_PER_N, contactPoint, tipPoint, wedgePolygon, boxWedge, boxApex, boxTipPoint, pushArrow, pushedBoxGeometry, format } from "./model.mjs";
const COLORS = { navy: "#17334a", slate: "#566c7b", coral: "#be513b", green: "#07825e", ochre: "#8f6400", purple: "#ab3378", pale: "#f2f5f6" };
const { navy, slate, coral, green, ochre, purple, pale } = COLORS;
const W = VIEWBOX.width, H = VIEWBOX.height;
const BOX = { left: 185, right: 515, top: 30, bottom: 470 };
const HEAD = 15;
const SOLID = 5, GHOST = 3, COMPONENT = 3.5, LOAD = 4.5;
const FT_LIFT = 5, FN_GAP = 7;
const ARC = 36;
const r = (value) => Math.round(value * 100) / 100;
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const attrs = (map) => Object.entries(map).filter(([, v]) => v !== void 0 && v !== null && v !== false).map(([k, v]) => `${k}="${esc(v)}"`).join(" ");
const path = (d, stroke, width, rest = {}) => `<path ${attrs({ d, stroke, "stroke-width": width, fill: "none", ...rest })}/>`;
const segment = (x1, y1, x2, y2, stroke, width, rest) => path(`M${r(x1)},${r(y1)} L${r(x2)},${r(y2)}`, stroke, width, rest);
const markers = [["coral", coral], ["green", green], ["navy", navy], ["slate", slate], ["ochre", ochre], ["purple", purple]].map(([name, fill]) => `<marker id="fc-head-${name}" viewBox="0 0 ${HEAD} 12" markerWidth="${HEAD}" markerHeight="12" refX="1" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L${HEAD},6 L0,12 Z" fill="${fill}"/></marker>`).join("") + [["ghost", coral], ["ghost-purple", purple]].map(([name, stroke]) => `<marker id="fc-head-${name}" viewBox="0 0 ${HEAD} 12" markerWidth="${HEAD}" markerHeight="12" refX="1" refY="6" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><path d="M1,1.5 L${HEAD - 1},6 L1,10.5 Z" fill="white" stroke="${stroke}" stroke-width="1.8"/></marker>`).join("");
function arrow(x1, y1, x2, y2, name, width, { dash, ghost = false, id, arrowName } = {}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 0.5) return "";
  const ux = (x2 - x1) / length, uy = (y2 - y1) / length;
  const fill = { coral, green, navy, slate, ochre, purple }[name];
  const data = { "data-arrow": arrowName };
  if (length < HEAD + 3) {
    const w = 6 * Math.max(0.5, length / (HEAD + 3));
    const d = `M${r(x2)},${r(y2)} L${r(x1 - uy * w)},${r(y1 + ux * w)} L${r(x1 + uy * w)},${r(y1 - ux * w)} Z`;
    return `<path ${attrs({ id, d, fill: ghost ? "white" : fill, stroke: ghost ? fill : void 0, "stroke-width": ghost ? 1.8 : void 0, "data-head-only": "true", ...data })}/>`;
  }
  return segment(
    x1,
    y1,
    x2 - ux * (HEAD - 1),
    y2 - uy * (HEAD - 1),
    fill,
    width,
    { id, "stroke-dasharray": dash, "marker-end": `url(#fc-head-${ghost ? name === "coral" ? "ghost" : `ghost-${name}` : name})`, ...data }
  );
}
const WIDE = {
  "\u2014": 1,
  "\u2297": 0.85,
  "m": 0.833,
  "w": 0.722,
  "M": 0.833,
  "W": 0.944,
  " ": 0.278,
  ".": 0.278,
  ",": 0.278,
  ":": 0.278,
  "i": 0.222,
  "l": 0.222,
  "j": 0.222,
  "t": 0.278,
  "f": 0.278,
  "r": 0.333,
  "(": 0.333,
  ")": 0.333,
  "-": 0.333,
  "=": 0.584,
  "\u2212": 0.584,
  "+": 0.584,
  "\xB0": 0.4,
  "\xB1": 0.584,
  "\u03BC": 0.6,
  "g": 0.556,
  "p": 0.556
};
const charWidth = (ch) => WIDE[ch] ?? (/[0-9]/.test(ch) ? 0.556 : /[A-Z]/.test(ch) ? 0.68 : 0.556);
const lineWidth = (parts, size) => 1.04 * parts.reduce((sum, part) => sum + [...part.text].reduce((s, ch) => s + charWidth(ch), 0) * size * (part.sub || part.sup ? 0.7 : 1) * (part.italic ? 1.05 : 1), 0) + 2;
const italic = (text2) => ({ text: text2, italic: true });
const sub = (text2) => ({ text: text2, sub: true });
const sup = (text2) => ({ text: text2, sup: true });
const plain = (text2) => ({ text: text2 });
const LINE = 1.2;
function spans(parts, size) {
  return parts.map((part) => part.italic ? `<tspan font-family="Georgia,serif" font-style="italic">${esc(part.text)}</tspan>` : part.sub ? `<tspan baseline-shift="sub" font-size="${r(size * 0.7)}">${esc(part.text)}</tspan>` : part.sup ? `<tspan baseline-shift="super" font-size="${r(size * 0.7)}">${esc(part.text)}</tspan>` : esc(part.text)).join("");
}
function bbox(label, { x, y, anchor }) {
  const width = label.width;
  const left = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
  const first = label.lines[0][0], lastLine = label.lines[label.lines.length - 1], last = lastLine[lastLine.length - 1];
  const parts = label.lines.flat();
  const sub2 = parts.some((part) => part.sub), it = parts.some((part) => part.italic), high = parts.some((part) => part.sup);
  const extra = (label.lines.length - 1) * LINE * label.size;
  const outer = {
    left: left - (first.italic ? 0.22 * label.size : 0),
    right: left + width + (last.italic || last.sub ? 0.16 * label.size : 0),
    top: y - (high ? 1.05 : 0.95) * label.size,
    bottom: y + extra + (sub2 ? 0.58 : it ? 0.27 : 0.25) * label.size
  };
  return { ...outer, core: { left: outer.left + 1, right: outer.right - 1, top: y - (high ? 1.01 : 0.93) * label.size, bottom: y + extra + (sub2 ? 0.56 : 0.24) * label.size } };
}
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function nearestOn([px, py], [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return [ax + t * dx, ay + t * dy];
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const pointToRect = ([x, y], b) => Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
function crosses([[ax, ay], [bx, by]], box) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
  for (let k = 0; k <= n; k += 1) {
    const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
    if (x > box.left && x < box.right && y > box.top && y < box.bottom) return true;
  }
  return false;
}
function rectToSegment(box, s) {
  if (crosses(s, box)) return 0;
  const corners = [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]];
  return Math.min(pointToRect(s[0], box), pointToRect(s[1], box), ...corners.map((c) => dist(c, nearestOn(c, s))));
}
function segmentsCross([p1, p2], [q1, q2]) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(q1, q2, p1), d2 = d(q1, q2, p2), d3 = d(p1, p2, q1), d4 = d(p1, p2, q2);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}
const centre = (box) => [(box.left + box.right) / 2, (box.top + box.bottom) / 2];
const segmentGap = ([p1, p2], [q1, q2]) => Math.min(dist(p1, nearestOn(p1, [q1, q2])), dist(p2, nearestOn(p2, [q1, q2])), dist(q1, nearestOn(q1, [p1, p2])), dist(q2, nearestOn(q2, [p1, p2])));
function strictlyCross([p1, p2], [q1, q2]) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return d(q1, q2, p1) * d(q1, q2, p2) < -1e-6 && d(p1, p2, q1) * d(p1, p2, q2) < -1e-6;
}
function besideSegment(label, [[ax, ay], [bx, by]], { fractions = [0.5, 0.35, 0.65, 0.2, 0.8, 0.95], gaps = [1.5, 5, 11], pad = 4, end = true } = {}) {
  const length = Math.hypot(bx - ax, by - ay);
  if (length < 1) return [];
  const ux = (bx - ax) / length, uy = (by - ay) / length;
  const probe = bbox(label, { x: 0, y: 0, anchor: "middle" });
  const width = probe.right - probe.left, height = probe.bottom - probe.top;
  const dx = (probe.left + probe.right) / 2, dy = (probe.top + probe.bottom) / 2;
  const extent = (nx, ny) => Math.abs(nx) * width / 2 + Math.abs(ny) * height / 2;
  const at = (x, y) => ({ x: x - dx, y: y - dy, anchor: "middle" });
  const out = [];
  for (const gap of gaps) {
    for (const f of fractions) {
      for (const side of [1, -1]) {
        const nx = -uy * side, ny = ux * side, d = pad + gap + extent(nx, ny);
        out.push(at(ax + (bx - ax) * f + nx * d, ay + (by - ay) * f + ny * d));
      }
    }
    if (end) {
      for (let k = 0; k < 16; k += 1) {
        const nx = Math.cos(k * Math.PI / 8), ny = Math.sin(k * Math.PI / 8), d = pad + 4 + gap + extent(nx, ny);
        out.push(at(bx + nx * d, by + ny * d));
      }
    }
  }
  return out;
}
const TAIL = 12;
const NEAR = 20;
const MARGIN = 3;
const LEADER_MAX = 130;
function trimNear(lines, point, radius) {
  const out = [];
  for (const [a, b] of lines) {
    const da = dist(a, point), db = dist(b, point);
    if (da < radius && db < radius) continue;
    if (da >= radius && db >= radius) {
      out.push([a, b]);
      continue;
    }
    const [inner, outer] = da < radius ? [a, b] : [b, a];
    const dx = outer[0] - inner[0], dy = outer[1] - inner[1], fx = inner[0] - point[0], fy = inner[1] - point[1];
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - radius * radius;
    const t = (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A);
    out.push([[inner[0] + t * dx, inner[1] + t * dy], outer]);
  }
  return out;
}
function leaderSegment(box, [tx, ty]) {
  const start = [clampTo(tx, box.left, box.right), clampTo(ty, box.top, box.bottom)];
  const length = Math.hypot(tx - start[0], ty - start[1]);
  if (length < 8) return null;
  const k = (length - 5) / length;
  return [start, [start[0] + (tx - start[0]) * k, start[1] + (ty - start[1]) * k]];
}
const ring = ([x, y], radii, size) => radii.flatMap((radius) => Array.from({ length: 24 }, (_, k) => {
  const c = Math.cos(k * Math.PI / 12), s = Math.sin(k * Math.PI / 12);
  return { x: x + radius * c, y: y + radius * s + size * 0.3, anchor: c > 0.3 ? "start" : c < -0.3 ? "end" : "middle" };
}));
function place(labels, obstacles, segments, { debug, dropped, memory, strict = true, raySegments = [] } = {}) {
  const placed = [], leaders = [];
  const evaluate = (label, candidate) => {
    const box = bbox(label, candidate);
    let hard = 0, soft = 0, lead = null;
    const reject = () => {
      debug?.push({ id: label.id, x: Math.round(candidate.x), y: Math.round(candidate.y), anchor: candidate.anchor, leader: Boolean(candidate.leader), hard: Math.round(hard), soft: Math.round(soft) });
      return { candidate, box, lead, cost: hard + soft, clear: false, usable: false };
    };
    hard += 1e6 * (Math.max(0, 3 - box.left) + Math.max(0, box.right - (W - 3)) + Math.max(0, 3 - box.top) + Math.max(0, box.bottom - (H - 3)));
    for (const p of placed) hard += 1e3 * overlap(box, { left: p.box.left - 7, right: p.box.right + 7, top: p.box.top - 4, bottom: p.box.bottom + 4 });
    for (const l of leaders) if (crosses(l, { left: box.left - 3, right: box.right + 3, top: box.top - 3, bottom: box.bottom + 3 })) hard += 5e3;
    if (hard >= 30) return reject();
    if (label.within && !label.within(box.core)) {
      hard += 5e3;
      return reject();
    }
    for (const o of obstacles) {
      if (o.label === label.id) continue;
      const area = overlap(box, o);
      if (!area) continue;
      if (label.thin && o.arrow?.startsWith("clip")) soft += area * 0.15;
      else if ((o.weight ?? 1) >= 1) hard += area * (o.weight ?? 1);
      else soft += area * (o.ray && (label.role === "normal" || label.role === "tangential") ? 0.5 : o.weight);
    }
    if (hard >= 30) return reject();
    if (label.nearTo && !candidate.leader && Math.min(...label.nearTo.map((seg) => rectToSegment(box, seg))) > NEAR) {
      hard += 5e3;
      return reject();
    }
    const own = label.owner && segments[label.owner];
    if (label.assoc && own) {
      const core = box.core;
      const near = Math.min(...own.lines.map((s) => rectToSegment(core, s)));
      if (!candidate.leader && near > NEAR) {
        hard += 5e3;
        return reject();
      }
      if (label.nearAll && label.nearAll.some((lines) => Math.min(...lines.map((s) => rectToSegment(core, s))) > NEAR)) {
        hard += 5e3;
        return reject();
      }
      const index = label.owner.replace(/\D+/, "");
      const others = label.role === "normal" ? [`tangential${index}`] : label.role === "tangential" ? [`normal${index}`] : label.role === "force" && label.strictSight ? [`normal${index}`, `tangential${index}`] : [];
      const ownEnds = own.lines[0];
      const shares = (name, e) => name.replace(/\D+/, "") === index ? ownEnds.flatMap((p) => e.lines[0].filter((q) => dist(p, q) < 1)).filter((q) => own.tail && dist(q, own.tail) < 1 || label.role === "force" && name === `tangential${index}`) : [];
      const rivals = Object.entries(segments).filter(([name, e]) => name !== label.owner && name !== "ghosts" && !(label.twins ?? []).includes(name) && (e.family === own.family || e.family === "clip" && own.family === "purple" || others.includes(name))).map(([name, e]) => shares(name, e).reduce((lines, shared) => trimNear(lines, shared, TAIL), e.lines)).filter((lines) => lines.length);
      const mid = centre(core), nearMid = Math.min(...own.lines.map((s) => dist(mid, nearestOn(mid, s))));
      for (const lines of rivals) {
        const rival = Math.min(...lines.map((s) => rectToSegment(core, s)));
        const rivalMid = Math.min(...lines.map((s) => dist(mid, nearestOn(mid, s))));
        if (candidate.leader ? rival < 20 : rival < near + MARGIN || rivalMid < nearMid + MARGIN) {
          hard += 5e3;
          return reject();
        }
      }
      if (!candidate.leader) {
        const target = own.lines.map((s) => nearestOn(mid, s)).sort((p, q) => dist(mid, p) - dist(mid, q))[0];
        const gap = dist(mid, target);
        const sight = gap > 10 ? [mid, [target[0] - (target[0] - mid[0]) * 10 / gap, target[1] - (target[1] - mid[1]) * 10 / gap]] : null;
        const family = label.owner.replace(/\D+/, "");
        const ignore = label.role === "force" ? label.strictSight ? [`tangential${family}`, `contact${family}`] : [`normal${family}`, `tangential${family}`, `contact${family}`] : label.ignoreSight ?? [];
        if (sight && obstacles.some((o) => o.arrow && o.arrow !== label.owner && !ignore.includes(o.arrow) && (o.weight ?? 1) >= 1 && crosses(sight, o))) {
          hard += 5e3;
          return reject();
        }
        if (label.role === "normal" || label.role === "tangential") {
          const onAxis = nearestOn(mid, own.lines[0]);
          const length = dist(mid, onAxis);
          const end = length > 3 ? [onAxis[0] - (onAxis[0] - mid[0]) * 3 / length, onAxis[1] - (onAxis[1] - mid[1]) * 3 / length] : mid;
          if (raySegments.some((ray) => strictlyCross([mid, end], ray) || segmentGap([mid, end], ray) < 2.5)) {
            hard += 5e3;
            return reject();
          }
        }
      }
    }
    if (candidate.leader) {
      lead = leaderSegment(box, candidate.leader);
      if (!lead || Math.hypot(lead[1][0] - lead[0][0], lead[1][1] - lead[0][1]) > LEADER_MAX) {
        hard += 5e3;
        return reject();
      }
      if (own) {
        const length = Math.hypot(lead[1][0] - lead[0][0], lead[1][1] - lead[0][1]);
        for (let t = 0; t <= length - 8; t += 2) {
          const p = [lead[0][0] + (lead[1][0] - lead[0][0]) * t / length, lead[0][1] + (lead[1][1] - lead[0][1]) * t / length];
          if (own.lines.some((seg) => dist(p, nearestOn(p, seg)) < 4)) {
            hard += 5e3;
            return reject();
          }
        }
      }
      if (placed.some((p) => crosses(lead, { left: p.box.left - 3, right: p.box.right + 3, top: p.box.top - 3, bottom: p.box.bottom + 3 }))) {
        hard += 5e3;
        return reject();
      }
      if (leaders.some((l) => segmentsCross(l, lead))) {
        hard += 5e3;
        return reject();
      }
      if (obstacles.some((o) => ((o.weight ?? 1) >= 1 || o.label === "fc-joining-label") && o.arrow !== label.owner && o.label !== label.id && !(label.thin && o.arrow?.startsWith("clip")) && crosses(lead, o))) {
        hard += 5e3;
        return reject();
      }
    }
    debug?.push({ id: label.id, x: Math.round(candidate.x), y: Math.round(candidate.y), anchor: candidate.anchor, leader: Boolean(candidate.leader), hard: Math.round(hard), soft: Math.round(soft) });
    return { candidate, box, lead, cost: hard + soft, clear: soft <= 25, usable: true };
  };
  const scan = (label, candidates) => {
    let best = null;
    for (const candidate of candidates) {
      const e = evaluate(label, candidate);
      if (e.clear) return e;
      if (!best || e.usable && !best.usable || e.usable === best.usable && e.cost < best.cost) best = e;
    }
    return best;
  };
  const better = (e, best) => !best || e.clear && !best.clear || e.usable && !best.usable || e.usable === best.usable && e.clear === best.clear && e.cost < best.cost;
  for (const label of labels) {
    const forms = [label.lines, ...label.alternates ?? []];
    const remembered = memory?.get(label.id);
    const target = label.leaderTarget ?? (() => label.at);
    let pick = null;
    const tryForm = (k, candidates) => {
      label.lines = forms[k];
      label.width = Math.max(...label.lines.map((line) => lineWidth(line, label.size)));
      const e = scan(label, candidates);
      if (e && better(e, pick)) pick = { ...e, form: k };
    };
    const first = remembered && label.at && remembered.form < forms.length ? [{ x: label.at[0] + remembered.dx, y: label.at[1] + remembered.dy, anchor: remembered.anchor, leader: remembered.leader ? target({ x: label.at[0] + remembered.dx }) : void 0 }] : [];
    const near = () => {
      if (first.length && !remembered.leader) tryForm(remembered.form, first);
      for (let k = 0; k < forms.length && !pick?.clear; k += 1) {
        tryForm(k, label.candidates);
        if (pick.clear) break;
        label.lines = forms[k];
        label.width = Math.max(...label.lines.map((line) => lineWidth(line, label.size)));
        tryForm(k, [...(label.along ?? []).flatMap((seg) => besideSegment(label, seg, label.alongOptions)), ...label.at ? ring(label.at, [22, 30, 38, 46], label.size) : []]);
      }
    };
    let relaxed = false;
    if (label.role === "force" && strict) {
      label.strictSight = true;
      near();
      label.strictSight = false;
      if (!pick.clear) {
        const strict2 = pick;
        near();
        relaxed = pick !== strict2;
      }
    } else near();
    if (first.length && remembered.leader && !pick.clear) tryForm(remembered.form, first);
    if (!pick.clear && label.at && !label.noLeader) {
      const far = ring(label.at, [58, 66, 76, 88, 100, 114, 128], label.size).map((c) => ({ ...c, leader: target(c) }));
      for (let k = 0; k < forms.length && !pick.clear; k += 1) tryForm(k, [...label.leaderCandidates ?? [], ...far]);
    }
    label.lines = forms[pick.form];
    label.width = Math.max(...label.lines.map((line) => lineWidth(line, label.size)));
    if (!pick.usable) {
      dropped?.push(label.id);
      memory?.delete(label.id);
      continue;
    }
    if (memory && label.at) memory.set(label.id, { dx: pick.candidate.x - label.at[0], dy: pick.candidate.y - label.at[1], anchor: pick.candidate.anchor, leader: Boolean(pick.lead), form: pick.form });
    if (pick.lead) leaders.push(pick.lead);
    placed.push({ ...label, ...pick.candidate, box: pick.box, lead: pick.lead, clear: pick.clear, relaxed, form: pick.form });
  }
  return placed;
}
function arrowLines(x1, y1, x2, y2) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 0.5) return [[[x1, y1], [x2, y2]]];
  const ux = (x2 - x1) / length, uy = (y2 - y1) / length;
  const back = Math.min(HEAD - 1, length), half = length < HEAD + 3 ? 6 * Math.max(0.5, length / (HEAD + 3)) : 6;
  const bx = x2 - ux * back, by = y2 - uy * back;
  const c1 = [bx - uy * half, by + ux * half], c2 = [bx + uy * half, by - ux * half];
  return [[[x1, y1], [x2, y2]], [c1, [x2, y2]], [c2, [x2, y2]], [c1, c2]];
}
function along(x1, y1, x2, y2, width, head = false, extra = {}) {
  const out = [];
  const length = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.ceil(length / 7));
  for (let k = 0; k <= n; k += 1) {
    const x = x1 + (x2 - x1) * k / n, y = y1 + (y2 - y1) * k / n;
    const pad = head && length * (1 - k / n) <= HEAD + 1 ? 8 : width / 2 + 2;
    out.push({ left: x - pad, right: x + pad, top: y - pad, bottom: y + pad, ...extra });
  }
  if (head) out.push({ left: x2 - 9, right: x2 + 9, top: y2 - 9, bottom: y2 + 9, ...extra });
  return out;
}
const text = (label) => {
  const lines = label.lines.map((line, k) => k === 0 ? spans(line, label.size) : `<tspan x="${r(label.x)}" dy="${LINE}em">${spans(line, label.size)}</tspan>`).join("");
  return `<text ${attrs({
    id: label.id,
    x: r(label.x),
    y: r(label.y),
    "font-size": label.size,
    fill: label.fill,
    "text-anchor": label.anchor,
    "paint-order": "stroke",
    stroke: "white",
    "stroke-width": 5,
    "stroke-linejoin": "round",
    "data-role": label.role,
    "data-owner": label.owner,
    "data-assoc": label.assoc ? "true" : void 0,
    "data-anchor": label.at ? `${r(label.at[0])},${r(label.at[1])}` : void 0,
    "data-clear": String(label.clear),
    "data-leader": label.lead ? `${r(label.lead[1][0])},${r(label.lead[1][1])}` : void 0,
    "data-estimate": [label.box.left, label.box.top, label.box.right, label.box.bottom].map(r).join(",")
  })}>${lines}</text>`;
};
const leaderLine = (label) => label.lead ? segment(label.lead[0][0], label.lead[0][1], label.lead[1][0], label.lead[1][1], slate, 1.3, { id: `${label.id}-leader`, "data-leader-of": label.id }) : "";
const SOFT_RAY = { weight: 0.12, ray: true };
function cone(wedge, index, raySegments, obstacles) {
  let fill = "", rays = "";
  if (wedge.polygon) fill = `<path ${attrs({ id: `fc-wedge-${index}`, d: `M${wedge.polygon.map(([x, y]) => `${r(x)},${r(y)}`).join(" L")} Z`, fill: green, stroke: "none" })}/>`;
  wedge.rays.forEach((end, k) => {
    if (wedge.rays.length === 2) raySegments.push([wedge.apex, end]);
    rays += segment(wedge.apex[0], wedge.apex[1], end[0], end[1], green, 2.5, { id: `fc-ray-${index}-${k + 1}`, "data-end": `${r(end[0])},${r(end[1])}` });
    obstacles.push(...along(wedge.apex[0], wedge.apex[1], end[0], end[1], 2.5, false, SOFT_RAY));
  });
  return { fill, rays };
}
function alphaArc({ apex: [cx, cy], n, t, side, mu, index }, obstacles) {
  if (mu < 0.05) return { under: "", label: null };
  const a = Math.atan(mu);
  const ts = [t[0] * side, t[1] * side];
  const at = (radius, angle) => [cx + radius * (n[0] * Math.cos(angle) + ts[0] * Math.sin(angle)), cy + radius * (n[1] * Math.cos(angle) + ts[1] * Math.sin(angle))];
  const [ax, ay] = at(ARC, a), [sx, sy] = at(ARC, 0);
  const sweep = n[0] * ts[1] - n[1] * ts[0] > 0 ? 1 : 0;
  const under = path(`M${r(sx)},${r(sy)} A${ARC},${ARC} 0 0 ${sweep} ${r(ax)},${r(ay)}`, slate, 1.6, { id: `fc-alpha-arc-${index}` });
  for (let k = 0; k <= 6; k += 1) {
    const [px, py] = at(ARC, a * k / 6);
    obstacles.push({ left: px - 3, right: px + 3, top: py - 3, bottom: py + 3, weight: 0.5 });
  }
  const glyph = (radius, angle) => {
    const [x, y] = at(radius, angle);
    return { x, y: y + 7, anchor: "middle" };
  };
  const angleOf = ([x, y]) => {
    const dx = x - cx, dy = y - cy;
    return [Math.atan2(dx * ts[0] + dy * ts[1], dx * n[0] + dy * n[1]), Math.hypot(dx, dy), dx * n[0] + dy * n[1]];
  };
  const inSector = (box) => {
    const [mid, distance] = angleOf([(box.left + box.right) / 2, (box.top + box.bottom) / 2]);
    if (!(mid > 0.06 && mid < a - 0.06 && distance > ARC + 10)) return false;
    return [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]].every((corner) => {
      const [angle, , along2] = angleOf(corner);
      return along2 > 0 && angle > -0.03 && angle < a + 0.03;
    });
  };
  const radii = [ARC + 16, ARC + 24, ARC + 34, ARC + 46, ARC + 60, ARC + 76, ARC + 94, ARC + 114];
  const label = {
    id: `fc-alpha-${index}`,
    role: "alpha",
    owner: "alpha",
    lines: [[italic("\u03B1")]],
    size: 20,
    fill: slate,
    priority: 2.9,
    optional: true,
    within: inSector,
    candidates: radii.flatMap((radius) => [0.5, 0.38, 0.62].map((f) => glyph(radius, a * f)))
  };
  return { under, label };
}
const outsideConeTest = ([cx, cy], n, t, mu) => (box) => {
  const dx = (box.left + box.right) / 2 - cx, dy = (box.top + box.bottom) / 2 - cy;
  const along2 = dx * n[0] + dy * n[1], across = dx * t[0] + dy * t[1];
  return along2 <= 0 || Math.abs(Math.atan2(across, along2)) > Math.atan(mu) + 0.02;
};
function pairScene(state, result, config) {
  const visible = [0, 1];
  const obstacles = [];
  const labels = [];
  const segments = {};
  let under = "", over = "", handles = "";
  const raySegments = [];
  const svg = `<rect x="${BOX.left}" y="${BOX.top}" width="${BOX.right - BOX.left}" height="${BOX.bottom - BOX.top}" fill="${pale}" stroke="${navy}" stroke-width="2.5"/>`;
  for (const [x1, y1, x2, y2] of [[BOX.left, BOX.top, BOX.right, BOX.top], [BOX.right, BOX.top, BOX.right, BOX.bottom], [BOX.left, BOX.bottom, BOX.right, BOX.bottom], [BOX.left, BOX.top, BOX.left, BOX.bottom]]) {
    obstacles.push(...along(x1, y1, x2, y2, 2.5, false, { weight: 0.3 }));
  }
  let fills = "";
  for (const i of visible) {
    const c = cone(wedgePolygon(i, state.mu, config), i + 1, raySegments, obstacles);
    fills += c.fill;
    under += c.rays;
  }
  under = (fills ? `<g opacity="0.09" id="fc-wedges">${fills}</g>` : "") + under;
  const tips = [];
  for (const i of visible) {
    const c = result.contacts[i];
    const [cx, cy] = contactPoint(i, config);
    const sigma = i === 0 ? 1 : -1;
    const inner = sigma > 0 ? "start" : "end", outer = sigma > 0 ? "end" : "start";
    const suffix = `,${i + 1}`;
    const [gx, gy] = tipPoint(i, c.fn, c.ftRequested, config);
    const [sx, sy] = tipPoint(i, c.fn, c.ftAdmissible, config);
    const [nx, ny] = tipPoint(i, c.fn, 0, config);
    const up = c.ftRequested >= 0 ? 1 : -1;
    const alpha = alphaArc({ apex: [cx, cy], n: [sigma, 0], t: [0, -1], side: -up, mu: state.mu, index: i + 1 }, obstacles);
    under += alpha.under;
    if (alpha.label) labels.push(alpha.label);
    if (c.clipped) {
      over += arrow(cx, cy, gx, gy, "coral", GHOST, { dash: "8 5", ghost: true, id: `fc-ghost-${i + 1}`, arrowName: `ghost${i}` });
      tips.push([gx, gy]);
      obstacles.push(...along(cx, cy, gx, gy, GHOST, true, { arrow: `ghost${i}` }));
      segments[`ghost${i}`] = { family: "coral", tail: [cx, cy], lines: arrowLines(cx, cy, gx, gy) };
      if (Math.abs(gy - sy) > 1) {
        over += segment(gx, gy, sx, sy, slate, 1.6, { id: `fc-clip-${i + 1}`, "stroke-dasharray": "2 4", "data-arrow": `clip${i}` });
        obstacles.push(...along(gx, gy, sx, sy, 1.6, false, { arrow: `clip${i}` }));
        segments[`clip${i}`] = { family: "clip", lines: [[[gx, gy], [sx, sy]]] };
      }
      const twins = Math.hypot(gx - sx, gy - sy) < PX_PER_N ? [`solid${i}`] : [];
      const two = [[plain("Requested\u2014")], [plain("outside cone")]];
      const one = [[plain("Requested\u2014outside cone")]];
      const beside = (dy) => ({ x: gx + sigma * 16, y: gy + dy, anchor: inner });
      labels.push({
        id: `fc-ghost-label-${i + 1}`,
        role: "ghost",
        owner: `ghost${i}`,
        assoc: true,
        twins,
        lines: one,
        alternates: [two],
        size: 18,
        fill: coral,
        priority: 1,
        at: [gx, gy],
        within: outsideConeTest([cx, cy], [sigma, 0], [0, -1], state.mu),
        along: [[[cx, cy], [gx, gy]]],
        alongOptions: { fractions: [0.9, 0.75, 0.6], pad: GHOST / 2 + 2 },
        candidates: [
          beside(6),
          { x: gx, y: up > 0 ? gy - 17 : gy + 29, anchor: "middle" },
          { x: gx + sigma * 12, y: up > 0 ? gy - 14 : gy + 26, anchor: inner },
          { x: gx - sigma * 12, y: up > 0 ? gy - 14 : gy + 26, anchor: outer },
          { x: gx - sigma * 16, y: gy + 6, anchor: outer },
          { x: gx + sigma * 16, y: gy + (up > 0 ? 28 : -18), anchor: inner },
          { x: gx, y: up > 0 ? gy - 40 : gy + 52, anchor: "middle" },
          { x: gx + sigma * 16, y: gy - up * 40, anchor: inner }
        ]
      });
    }
    if (state.components && c.fn > 0) {
      const coincident = c.ftAdmissible === 0;
      if (!coincident) {
        over += arrow(cx, cy, nx, ny, "green", COMPONENT, { id: `fc-fn-${i + 1}`, arrowName: `normal${i}` });
        tips.push([nx, ny]);
        obstacles.push(...along(cx, cy, nx, ny, COMPONENT, true, { arrow: `normal${i}` }));
        segments[`normal${i}`] = { family: "green", tail: [cx, cy], lines: arrowLines(cx, cy, nx, ny) };
      }
      const side = c.ftAdmissible >= 0 ? 1 : -1;
      const below = (y) => side > 0 ? y + 27 : y - 13;
      const mid = (f) => cx + sigma * c.fn * PX_PER_N * f;
      const twinRequest = coincident && c.clipped && Math.abs(c.ftRequested) * PX_PER_N < PX_PER_N ? [`ghost${i}`] : [];
      labels.push({
        id: `fc-fn-label-${i + 1}`,
        role: "normal",
        owner: coincident ? `solid${i}` : `normal${i}`,
        assoc: true,
        twins: twinRequest,
        size: 19,
        fill: green,
        priority: 3,
        at: [mid(0.6), cy],
        along: [[[cx, cy], [nx, ny]]],
        alongOptions: { pad: COMPONENT / 2 + 2 },
        lines: [[italic("f"), sub(`n${suffix}`)]],
        alternates: [],
        candidates: [
          { x: mid(0.8), y: below(cy), anchor: "middle" },
          { x: mid(0.62), y: below(cy), anchor: "middle" },
          { x: mid(0.92), y: below(cy), anchor: "middle" },
          { x: mid(0.45), y: below(cy), anchor: "middle" },
          { x: nx + sigma * 10, y: below(cy), anchor: inner },
          { x: cx + sigma * 8, y: below(cy) + side * 22, anchor: inner },
          { x: mid(0.5), y: side > 0 ? cy - 13 : cy + 27, anchor: "middle" }
        ]
      });
      if (Math.abs(c.ftAdmissible) * PX_PER_N >= 1) {
        over += arrow(nx, ny, sx, sy, "purple", COMPONENT, { id: `fc-ft-${i + 1}`, arrowName: `tangential${i}` });
        obstacles.push(...along(nx, ny, sx, sy, COMPONENT, true, { arrow: `tangential${i}` }));
        segments[`tangential${i}`] = { family: "purple", lines: arrowLines(nx, ny, sx, sy) };
        const my = (ny + sy) / 2;
        const sideFirst = [{ x: nx - sigma * 10, y: my + 6, anchor: outer }, { x: nx + sigma * 10, y: my + 6, anchor: inner }];
        labels.push({
          id: `fc-ft-label-${i + 1}`,
          role: "tangential",
          owner: `tangential${i}`,
          assoc: true,
          size: 19,
          fill: purple,
          priority: 2.8,
          at: [nx, my],
          along: [[[nx, ny], [sx, sy]]],
          alongOptions: { fractions: [0.5, 0.3, 0.7, 0.1, 0.9], pad: COMPONENT / 2 + 2 },
          lines: [[italic("f"), sub(`t${suffix}`), ...c.clipped ? [sup("adm")] : []]],
          alternates: [],
          candidates: [
            ...sideFirst,
            { x: nx + sigma * 10, y: sy + (side > 0 ? 14 : 2), anchor: inner },
            { x: nx + sigma * 10, y: ny - side * 8 + 6, anchor: inner },
            { x: nx + sigma * 10, y: my + 6 + side * 24, anchor: inner },
            { x: nx + sigma * 10, y: my + 6 - side * 26, anchor: inner },
            { x: nx + sigma * 10, y: side > 0 ? ny + 26 : ny - 12, anchor: inner },
            { x: nx - sigma * 10, y: side > 0 ? ny + 26 : ny - 12, anchor: outer }
          ]
        });
      }
    }
    if (c.solidZero) {
      over += `<circle ${attrs({ id: `fc-solid-${i + 1}`, cx, cy, r: 8, fill: "none", stroke: coral, "stroke-width": 3, "data-zero": "true" })}/>`;
      segments[`solid${i}`] = { family: "coral", tail: [cx, cy], lines: [[[cx - 8, cy], [cx + 8, cy]], [[cx, cy - 8], [cx, cy + 8]]] };
    } else {
      over += arrow(cx, cy, sx, sy, "coral", SOLID, { id: `fc-solid-${i + 1}`, arrowName: `solid${i}` });
      tips.push([sx, sy]);
      obstacles.push(...along(cx, cy, sx, sy, SOLID, true, { arrow: `solid${i}` }));
      segments[`solid${i}`] = { family: "coral", tail: [cx, cy], lines: arrowLines(cx, cy, sx, sy) };
    }
    const len = Math.hypot(sx - cx, sy - cy);
    const ux = len ? (sx - cx) / len : sigma, uy = len ? (sy - cy) / len : 0;
    let px = uy, py = -ux;
    if (py > 0 === (c.ftAdmissible > 0 || c.ftAdmissible === 0 && up > 0)) {
      px = -px;
      py = -py;
    }
    const onShaft = (f, d) => ({ x: cx + ux * len * f + px * d, y: cy + uy * len * f + py * d + 7, anchor: "middle" });
    const toward = c.clipped ? -1 : 1;
    const away = up > 0 ? 1 : -1;
    const nearTip = c.clipped ? [[15, 26], [15, 34], [26, 22], [26, 32], [15, 44]].map(([dx, dy]) => ({ x: sx + sigma * dx, y: sy + away * dy + (away > 0 ? 0 : 14), anchor: inner })) : [];
    const twinGhost = c.clipped && Math.hypot(gx - sx, gy - sy) < PX_PER_N ? [`ghost${i}`] : [];
    labels.push({
      id: `fc-solid-label-${i + 1}`,
      role: "force",
      owner: `solid${i}`,
      assoc: true,
      twins: twinGhost,
      along: c.solidZero ? [] : [[[cx, cy], [sx, sy]]],
      alongOptions: { fractions: [0.55, 0.4, 0.7, 0.85, 0.92, 0.25, 1], pad: SOLID / 2 + 2 },
      lines: [c.solidZero ? [italic("f"), sub(`${i + 1}`), plain(" = 0")] : [italic("f"), sub(`${i + 1}`)]],
      size: 23,
      fill: coral,
      priority: 0.5,
      at: c.solidZero ? [cx, cy] : [cx + ux * len * 0.55, cy + uy * len * 0.55],
      candidates: c.solidZero ? [{ x: cx + sigma * 14, y: cy + 30, anchor: inner }, { x: cx + sigma * 14, y: cy - 16, anchor: inner }, { x: cx + sigma * 14, y: cy + 54, anchor: inner }] : [
        onShaft(0.55, 18 * toward),
        onShaft(0.62, 14 * toward),
        onShaft(0.72, 18 * toward),
        onShaft(0.4, 18 * toward),
        ...nearTip,
        onShaft(0.55, -18 * toward),
        onShaft(0.72, -18 * toward),
        onShaft(0.55, 30 * toward),
        { x: sx + ux * 18, y: sy + uy * 18 + 7, anchor: "middle" },
        onShaft(0.9, 22),
        onShaft(0.25, 24),
        // At the tail, outside the box face, below or above the contact name (the force acts at the contact).
        ...[[12, 30], [12, 40], [16, 50], [12, -34]].map(([dx, dy]) => ({ x: cx - sigma * dx, y: cy + dy, anchor: outer }))
      ]
    });
    obstacles.push({ left: gx - 11, right: gx + 11, top: gy - 11, bottom: gy + 11, weight: 0.3 });
    over += `<circle ${attrs({ cx, cy, r: 5.5, fill: navy, id: `fc-contact-${i + 1}` })}/>`;
    obstacles.push({ left: cx - 8, right: cx + 8, top: cy - 8, bottom: cy + 8, arrow: `contact${i}` });
    labels.push({
      id: `fc-contact-label-${i + 1}`,
      role: "contact",
      owner: `contact${i}`,
      lines: [[plain(`contact ${i + 1}`)]],
      size: 19,
      fill: navy,
      priority: 0,
      candidates: [{ x: cx - sigma * 12, y: cy - 14, anchor: outer }, { x: cx - sigma * 12, y: cy + 30, anchor: outer }]
    });
    handles += `<g ${attrs({ class: "handle", "data-contact": i, "data-tip": `${r(gx)},${r(gy)}`, "data-solid-tip": `${r(sx)},${r(sy)}` })}><circle ${attrs({ cx: r(gx), cy: r(gy), r: 22, fill: "transparent", class: "hit" })}/><circle ${attrs({ cx: r(gx), cy: r(gy), r: 10, fill: "none", stroke: slate, "stroke-width": 1.6, class: "ring" })}/></g>`;
  }
  let originDot = "", originUnder = "", longest = null;
  const c1 = contactPoint(0, config), c2 = contactPoint(1, config);
  under += segment(c1[0], c1[1], c2[0], c2[1], navy, 13, { id: "fc-joining-band", "stroke-opacity": 0.13, "stroke-linecap": "round" });
  under += segment(c1[0], c1[1], c2[0], c2[1], navy, 3, { id: "fc-joining-line", "stroke-dasharray": "9 6" });
  obstacles.push(...along(c1[0], c1[1], c2[0], c2[1], 3, false, { weight: 0.3, label: "fc-joining-label" }));
  const arrows = Object.entries(segments).filter(([name]) => /^(solid|ghost|normal|tangential)\d$/.test(name)).map(([, e]) => e.lines[0]);
  const gaps = [];
  let from = null;
  for (let x = c1[0]; x <= c2[0] + 1; x += 1) {
    const p = [x, c1[1]];
    const hidden = x > c2[0] || Math.abs(x - ORIGIN.x) < 12 || x - c1[0] < 10 || c2[0] - x < 10 || arrows.some((seg) => dist(p, nearestOn(p, seg)) < 7);
    if (!hidden && from === null) from = x;
    if (hidden && from !== null) {
      if (x - from >= 12) gaps.push([from, x - 1]);
      from = null;
    }
  }
  longest = [...gaps].sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
  const onLine = (c) => [longest ? clampTo(c.x, longest[0] + 4, longest[1] - 4) : ORIGIN.x + 20, ORIGIN.y];
  labels.push({
    id: "fc-joining-label",
    role: "joining",
    owner: "joining",
    thin: true,
    nearTo: gaps.length ? gaps.map(([a, b]) => [[a, c1[1]], [b, c1[1]]]) : [[c1, c2]],
    lines: [[plain("contact line")]],
    size: 18,
    fill: navy,
    priority: 3.5,
    at: [longest ? (longest[0] + longest[1]) / 2 : ORIGIN.x + 20, ORIGIN.y],
    leaderTarget: onLine,
    along: gaps.map(([a, b]) => [[a, c1[1]], [b, c1[1]]]),
    alongOptions: { fractions: [0.5, 0.25, 0.75, 0, 1], gaps: [2, 6, 12], pad: 3.5, end: false },
    candidates: [[350, 238], [350, 276], [282, 276], [418, 276], [282, 238], [418, 238], [240, 276], [460, 276], [240, 238], [460, 238], [350, 300], [350, 214]].map(([x, y]) => ({ x, y, anchor: "middle" })),
    leaderCandidates: [[350, 340], [350, 160], [270, 340], [430, 340], [270, 160], [430, 160], [350, 440], [350, 72]].map(([x, y]) => ({ x, y, anchor: "middle", leader: onLine({ x }) }))
  });
  const dot = `<circle cx="${ORIGIN.x}" cy="${ORIGIN.y}" r="4" fill="${navy}" stroke="white" stroke-width="1.5" id="fc-origin"/>`;
  if (tips.some(([x, y]) => Math.hypot(x - ORIGIN.x, y - ORIGIN.y) < 9)) originUnder = dot;
  else originDot = dot;
  obstacles.push({ left: ORIGIN.x - 6, right: ORIGIN.x + 6, top: ORIGIN.y - 6, bottom: ORIGIN.y + 6, arrow: "origin" });
  segments.origin = { family: "origin", lines: [[[ORIGIN.x, ORIGIN.y], [ORIGIN.x, ORIGIN.y]]] };
  labels.push({
    id: "fc-origin-label",
    role: "origin",
    owner: "origin",
    assoc: true,
    noLeader: true,
    lines: [[italic("O")]],
    size: 21,
    fill: navy,
    priority: 1.5,
    at: [ORIGIN.x, ORIGIN.y],
    candidates: [[362, 274, "start"], [362, 241, "start"], [338, 274, "end"], [338, 241, "end"], [350, 290, "middle"], [350, 228, "middle"]].map(([x, y, anchor]) => ({ x, y, anchor }))
  });
  const longestGap = longest ? longest[1] - longest[0] + 1 : 0;
  const required = (label) => ["force", "ghost", "contact"].includes(label.role) || !state.components && (label.role === "origin" || label.role === "joining" && longestGap >= 60);
  const weight = (label) => required(label) ? 1e3 : label.role === "normal" || label.role === "tangential" || label.role === "origin" ? 10 : label.role === "joining" ? 5 : 1;
  const second = labels.map((l) => l.role === "force" && state.components ? { ...l, priority: 3.2 } : l);
  const third = labels.map((l) => l.role === "origin" ? { ...l, priority: 0.1 } : l.role === "ghost" ? { ...l, priority: 0.2 } : l.role === "joining" ? { ...l, priority: 0.3 } : l);
  const fourth = third.map((l) => l.role === "force" && state.components ? { ...l, priority: 3.2 } : l);
  let sharedOrders = [];
  if (segments.ghost0 && segments.ghost1) {
    const [g1, g2] = [0, 1].map((i) => tipPoint(i, result.contacts[i].fn, result.contacts[i].ftRequested, config));
    if (dist(g1, g2) < 90) {
      segments.ghosts = { family: "coral", lines: [...segments.ghost0.lines, ...segments.ghost1.lines] };
      const separate = labels.filter((l) => l.role === "ghost");
      const twins = ["ghost0", "ghost1", ...separate.flatMap((l) => l.twins ?? [])];
      const mid = [(g1[0] + g2[0]) / 2, (g1[1] + g2[1]) / 2], up = mid[1] < ORIGIN.y ? -1 : 1;
      const sharedLabel = {
        ...separate[0],
        id: "fc-ghost-label-12",
        owner: "ghosts",
        twins,
        at: mid,
        nearAll: [segments.ghost0.lines, segments.ghost1.lines],
        lines: [[plain("Requested\u2014outside cones")]],
        alternates: [[[plain("Requested\u2014")], [plain("outside cones")]]],
        along: [[[ORIGIN.x, ORIGIN.y], g1], [[ORIGIN.x, ORIGIN.y], g2]],
        alongOptions: { fractions: [1], pad: 6 },
        candidates: [10, 16, 24, 32, 42].flatMap((dy) => [0, -15, 15, -30, 30, -45, 45, -60, 60].flatMap((dx) => [-1, 1].map((side) => ({ x: mid[0] + dx, y: mid[1] + side * dy + (side > 0 ? 14 : 0), anchor: "middle" }))))
      };
      const withShared = (order) => [...order.filter((l) => l.role !== "ghost"), { ...sharedLabel, priority: order.find((l) => l.role === "ghost").priority }];
      sharedOrders = [labels, second, third, fourth].map((order) => [withShared(order), false]);
    }
  }
  const lenient = [[labels, false, false], [second, false, false]];
  const orders = (remembering) => remembering ? [[labels, true], [second, true], [third, true], [labels, false], [second, false], [third, false], [fourth, false], ...sharedOrders, ...lenient] : [[labels, false], [second, false], [third, false], [fourth, false], ...sharedOrders, ...lenient];
  const title = "Friction cones at two opposed contacts";
  const desc = visible.map((i) => {
    const c = result.contacts[i];
    return `Contact ${i + 1}: normal ${format(c.fn, 2)} N, requested tangential ${format(c.ftRequested, 2)} N, limit ${format(c.bound, 3)} N, ${c.status}${c.clipped ? `, solid arrow's tangential part clipped to ${format(c.ftAdmissible, 3)} N` : ""}.`;
  }).join(" ") + ` Friction coefficient ${format(state.mu, 2)}, cone half-angle ${format(result.alpha.deg, 1)} degrees. Forces drawn at ${PX_PER_N} px per newton in both directions.`;
  return { parts: { svg, under, originUnder, over, originDot, handles }, obstacles, labels, segments, raySegments, required, weight, orders, title, desc };
}
function boxScene(state, result, config, options = {}) {
  const b = result.box;
  const geo = pushedBoxGeometry(config);
  const [tx, ty] = geo.T, [mx, my] = geo.com;
  const [ax, ay] = boxApex(b.push, b.mass, state.mu, config);
  const obstacles = [];
  const labels = [];
  const segments = {};
  const raySegments = [];
  let svg = "", under = "", over = "", handles = "";
  const inner = "start", outer = "end";
  const lean = b.push > 0 ? -1 : b.push < 0 ? 1 : 0;
  const away = lean === 0 ? 1 : -lean;
  const outside = b.status === "outside";
  const half = b.bound * PX_PER_N;
  svg += `<rect ${attrs({ id: "fc-box", x: geo.left, y: geo.top, width: geo.right - geo.left, height: geo.bottom - geo.top, fill: pale, stroke: navy, "stroke-width": 2.5 })}/>`;
  for (const [x1, y1, x2, y2] of [[geo.left, geo.top, geo.right, geo.top], [geo.right, geo.top, geo.right, geo.bottom], [geo.left, geo.top, geo.left, geo.bottom]]) {
    obstacles.push(...along(x1, y1, x2, y2, 2.5, false, { weight: 0.3 }));
  }
  const lx = ax - half, rx = ax + half;
  if (half >= 1) {
    svg += `<rect ${attrs({ id: "fc-limit-1", x: r(lx), y: ty - 10, width: r(rx - lx), height: 10, fill: green, "fill-opacity": 0.22, stroke: "none", "data-ticks": `${r(lx)},${r(rx)}` })}/>`;
    for (let x = lx; x <= rx; x += 7) obstacles.push({ left: x - 4, right: x + 4, top: ty - 11, bottom: ty, weight: 0.3 });
  }
  const tickD = half >= 1 ? `M${r(lx)},${ty - 14} L${r(lx)},${ty + 4} M${r(rx)},${ty - 14} L${r(rx)},${ty + 4}` : `M${r(ax)},${ty - 14} L${r(ax)},${ty + 4}`;
  const ticks = path(tickD, "white", 5, { id: "fc-limit-ticks-casing-1" }) + path(tickD, green, 2.5, { id: "fc-limit-ticks-1", "data-ticks": `${r(lx)},${r(rx)}` });
  for (const x of half >= 1 ? [lx, rx] : [ax]) obstacles.push({ left: x - 5, right: x + 5, top: ty - 20, bottom: ty + 8, arrow: "limit", weight: 2 });
  segments.limit = { family: "limit", lines: half >= 1 ? [[[lx, ty - 5], [rx, ty - 5]]] : [[[ax, ty - 14], [ax, ty + 4]]] };
  svg += segment(40, ty, W - 40, ty, slate, 2.5, { id: "fc-table" });
  let hatch = "";
  for (let x = 54; x <= W - 46; x += 14) {
    if (Math.abs(x - mx) < 20) continue;
    hatch += `M${x},${ty + 2.5} L${x - 9},${ty + 12} `;
  }
  svg += path(hatch.trim(), slate, 1.3, { id: "fc-table-hatch", "stroke-linecap": "round" });
  obstacles.push(...along(40, ty, W - 40, ty, 2.5, false, { weight: 0.3 }));
  for (let x = 44; x <= W - 44; x += 7) obstacles.push({ left: x - 4, right: x + 4, top: ty + 1, bottom: ty + 12, weight: 0.2 });
  const c = cone(boxWedge(b.push, b.mass, state.mu, config), 1, raySegments, obstacles);
  under += (c.fill ? `<g opacity="0.09" id="fc-wedges">${c.fill}</g>` : "") + c.rays;
  const alpha = alphaArc({ apex: [ax, ay], n: [0, -1], t: [1, 0], side: away, mu: state.mu, index: 1 }, obstacles);
  under += alpha.under;
  if (alpha.label) labels.push(alpha.label);
  const ex = away > 0 ? rx : lx, anchorOut = away > 0 ? inner : outer;
  const collapsed = half < 1;
  const limitText = [italic("\u03BC"), sub("f"), italic("f"), sub("n"), plain(` = ${format(b.bound, 3)} N`)];
  labels.push({
    id: "fc-limit-label-1",
    role: "limit",
    owner: "limit",
    assoc: true,
    size: 18,
    fill: green,
    priority: collapsed ? -0.1 : 2.5,
    at: [ex, ty - 5],
    ignoreSight: ["limit"],
    within: collapsed ? ((box) => box.top > ty + 2) : void 0,
    lines: collapsed ? [limitText, [plain("no friction available")]] : [limitText],
    alternates: collapsed ? [[limitText], [[italic("\u03BC"), sub("f"), italic("f"), sub("n")]]] : [[[italic("\u03BC"), sub("f"), italic("f"), sub("n")]]],
    candidates: collapsed ? [{ x: ex + away * 16, y: ty + 29, anchor: anchorOut }, { x: ex + away * 22, y: ty + 29, anchor: anchorOut }, { x: ex + away * 16, y: ty + 40, anchor: anchorOut }, { x: ex - away * 16, y: ty + 29, anchor: away > 0 ? outer : inner }] : [
      { x: ex - away * 10, y: ty + 31, anchor: anchorOut },
      { x: ex + away * 9, y: ty + 31, anchor: anchorOut },
      { x: ex, y: ty + 31, anchor: "middle" },
      { x: ex + away * 9, y: ty - 3, anchor: anchorOut },
      { x: ex + away * 9, y: ty - 22, anchor: anchorOut }
    ]
  });
  over += `<circle ${attrs({ cx: tx, cy: ty, r: 5.5, fill: navy, id: "fc-contact-1" })}/>`;
  const wy = my + b.weight * PX_PER_N;
  over += arrow(mx, my, mx, wy, "navy", LOAD, { id: "fc-weight", arrowName: "weight" });
  obstacles.push(...along(mx, my, mx, wy, LOAD, true, { arrow: "weight" }));
  segments.weight = { family: "navy", tail: [mx, my], lines: arrowLines(mx, my, mx, wy) };
  const wmid = (ty + 16 + wy) / 2;
  const shortWeight = wy - ty < 50;
  const weightSpots = [{ x: mx + 12, y: wy - 6, anchor: inner }, { x: mx - 12, y: wy - 6, anchor: outer }, { x: mx + 12, y: wmid + 10, anchor: inner }, { x: mx - 12, y: wmid + 10, anchor: outer }];
  labels.push({
    id: "fc-weight-label",
    role: "weight",
    owner: "weight",
    assoc: true,
    size: 19,
    fill: navy,
    priority: 1.4,
    at: [mx, wmid],
    lines: [[italic("m"), italic("g"), plain(` = ${format(b.weight, 3)} N`)]],
    alternates: [[[italic("m"), italic("g")]]],
    along: [[[mx, ty + 16], [mx, wy]]],
    alongOptions: { fractions: [0.5, 0.35, 0.65, 0.8], pad: LOAD / 2 + 2 },
    candidates: shortWeight ? [{ x: mx, y: wy + 34, anchor: "middle" }, ...weightSpots] : [...weightSpots, { x: mx, y: wy + 24, anchor: "middle" }]
  });
  const push = pushArrow(b.push, config, options.side);
  const [fx, fy] = push.face, [hx, hy] = push.tail;
  const pside = push.side === "left" ? -1 : 1;
  if (b.push !== 0) {
    over += arrow(hx, hy, fx, fy, "ochre", LOAD, { id: "fc-push", arrowName: "push" });
    obstacles.push(...along(hx, hy, fx, fy, LOAD, true, { arrow: "push" }));
    segments.push = { family: "ochre", tail: [hx, hy], lines: arrowLines(hx, hy, fx, fy) };
  } else {
    segments.push = { family: "ochre", tail: [hx, hy], lines: [[[hx - 10, hy], [hx + 10, hy]], [[hx, hy - 10], [hx, hy + 10]]] };
  }
  const pmid = (hx + fx) / 2;
  labels.push({
    id: "fc-push-label",
    role: "push",
    owner: "push",
    assoc: true,
    size: 19,
    fill: ochre,
    priority: 1.2,
    at: [pmid, fy],
    lines: [[italic("f"), sub("p"), plain(` = ${format(b.push, 3)} N`)]],
    alternates: [[[italic("f"), sub("p")]]],
    along: b.push !== 0 ? [[[hx, hy], [fx, fy]]] : [],
    alongOptions: { fractions: [0.5, 0.35, 0.65, 0.2], pad: LOAD / 2 + 2 },
    candidates: b.push !== 0 ? [
      { x: pmid, y: fy - 13, anchor: "middle" },
      { x: pmid, y: fy + 28, anchor: "middle" },
      { x: hx + pside * 14, y: fy + 6, anchor: pside < 0 ? outer : inner },
      { x: hx + pside * 6, y: fy - 16, anchor: pside < 0 ? outer : inner },
      { x: hx + pside * 6, y: fy + 30, anchor: pside < 0 ? outer : inner }
    ] : [{ x: hx + pside * 14, y: fy + 6, anchor: pside < 0 ? outer : inner }, { x: hx + pside * 6, y: fy - 16, anchor: pside < 0 ? outer : inner }, { x: hx + pside * 6, y: fy + 30, anchor: pside < 0 ? outer : inner }]
  });
  const [gx, gy] = boxTipPoint(b.push, b.mass, state.mu, config);
  const fnx = Math.abs(ax - mx) < FN_GAP ? mx + (Math.sign(ax - mx) || away) * FN_GAP : ax;
  const [nx, ny] = [fnx, ay - b.fn * PX_PER_N];
  const fty = ay - FT_LIFT;
  const [sx, sy] = [gx, fty];
  const tipName = outside ? "ghost0" : "solid0";
  const ghostStyle = outside ? { dash: "8 5", ghost: true } : {};
  over += arrow(ax, ay, gx, gy, "coral", outside ? GHOST : SOLID, { id: outside ? "fc-ghost-1" : "fc-solid-1", arrowName: tipName, ...ghostStyle });
  if (state.components) {
    const coincident = b.push === 0;
    if (!coincident) {
      over += arrow(fnx, ay, nx, ny, "green", COMPONENT, { id: "fc-fn-1", arrowName: "normal0" });
      obstacles.push(...along(fnx, ay, nx, ny, COMPONENT, true, { arrow: "normal0" }));
      segments.normal0 = { family: "green", tail: [fnx, ay], lines: arrowLines(fnx, ay, nx, ny) };
      over += arrow(ax, fty, sx, sy, "purple", COMPONENT, { id: "fc-ft-1", arrowName: "tangential0", ...ghostStyle });
      obstacles.push(...along(ax, fty, sx, sy, COMPONENT, true, { arrow: "tangential0" }));
      segments.tangential0 = { family: "purple", tail: [ax, fty], lines: arrowLines(ax, fty, sx, sy) };
      under += path(`M${r(sx)},${r(sy)} L${r(gx)},${r(gy)} M${r(nx)},${r(ny)} L${r(gx)},${r(gy)}`, slate, 1.2, { id: "fc-construct-1", "stroke-dasharray": "2 4" });
      obstacles.push(...along(sx, sy, gx, gy, 1.2, false, { weight: 0.25 }), ...along(nx, ny, gx, gy, 1.2, false, { weight: 0.25 }));
      const tmid = (ax + sx) / 2;
      labels.push({
        id: "fc-ft-label-1",
        role: "tangential",
        owner: "tangential0",
        assoc: true,
        size: 19,
        fill: purple,
        priority: 1.6,
        at: [tmid, fty],
        ignoreSight: ["limit", "contact0"],
        along: [[[ax, fty], [sx, sy]]],
        alongOptions: { fractions: [0.5, 0.3, 0.7, 0.9], pad: COMPONENT / 2 + 2 },
        lines: [[italic("f"), sub("t"), plain(` = ${format(b.ftRequired, 3)} N`)]],
        alternates: [[[italic("f"), sub("t")]]],
        candidates: [
          { x: lean < 0 ? mx - 14 : mx + 14, y: ty + 29, anchor: lean < 0 ? outer : inner },
          { x: tmid, y: ty + 29, anchor: "middle" },
          { x: sx + lean * 10, y: ty + 29, anchor: lean < 0 ? outer : inner },
          { x: tmid, y: ty - 16, anchor: "middle" },
          { x: sx + lean * 10, y: ty + 6, anchor: lean < 0 ? outer : inner },
          { x: sx + lean * 12, y: ty - 10, anchor: lean < 0 ? outer : inner }
        ]
      });
    }
    const side2 = away;
    const mid = (f) => ay - b.fn * PX_PER_N * f;
    const lx0 = coincident ? ax : fnx;
    labels.push({
      id: "fc-fn-label-1",
      role: "normal",
      owner: coincident ? tipName : "normal0",
      assoc: true,
      size: 19,
      fill: green,
      priority: 3,
      at: [lx0, mid(0.6)],
      along: [[[lx0, ay], [lx0, ny]]],
      alongOptions: { pad: COMPONENT / 2 + 2 },
      lines: [[italic("f"), sub("n"), plain(` = ${format(b.fn, 3)} N`)]],
      alternates: [[[italic("f"), sub("n")]]],
      candidates: [
        { x: lx0 + side2 * 10, y: mid(0.6) + 6, anchor: side2 > 0 ? inner : outer },
        { x: lx0 + side2 * 10, y: mid(0.45) + 6, anchor: side2 > 0 ? inner : outer },
        { x: lx0 + side2 * 10, y: mid(0.8) + 6, anchor: side2 > 0 ? inner : outer },
        { x: lx0 + side2 * 10, y: mid(0.3) + 6, anchor: side2 > 0 ? inner : outer },
        { x: lx0 - side2 * 10, y: mid(0.6) + 6, anchor: side2 > 0 ? outer : inner }
      ]
    });
  }
  obstacles.push(...along(ax, ay, gx, gy, outside ? GHOST : SOLID, true, { arrow: tipName }));
  segments[tipName] = { family: "coral", tail: [ax, ay], lines: arrowLines(ax, ay, gx, gy) };
  const len = Math.hypot(gx - ax, gy - ay);
  const ux = (gx - ax) / len, uy = (gy - ay) / len;
  let px = uy, py = -ux;
  if (px > 0 !== away > 0) {
    px = -px;
    py = -py;
  }
  const onShaft = (f, d) => ({ x: ax + ux * len * f + px * d, y: ay + uy * len * f + py * d + 7, anchor: "middle" });
  labels.push({
    id: outside ? "fc-ghost-label-1" : "fc-solid-label-1",
    role: outside ? "ghost" : "force",
    owner: tipName,
    assoc: true,
    size: outside ? 19 : 23,
    fill: coral,
    priority: 0.5,
    at: [ax + ux * len * 0.55, ay + uy * len * 0.55],
    along: [[[ax, ay], [gx, gy]]],
    alongOptions: { fractions: [0.55, 0.4, 0.7, 0.85, 0.92, 0.25, 1], pad: SOLID / 2 + 2 },
    lines: outside ? [[italic("f"), plain(" needed \u2014 not available")]] : [[italic("f")]],
    alternates: outside ? [[[italic("f"), plain(" needed \u2014")], [plain("not available")]]] : [],
    within: outside ? outsideConeTest([ax, ay], [0, -1], [1, 0], state.mu) : void 0,
    candidates: [
      onShaft(0.55, 18),
      onShaft(0.62, 14),
      onShaft(0.72, 18),
      onShaft(0.4, 18),
      onShaft(0.55, -18),
      onShaft(0.72, -18),
      onShaft(0.55, 30),
      { x: gx + ux * 18, y: gy + uy * 18 + 7, anchor: "middle" },
      { x: gx + lean * 12, y: gy - 14, anchor: lean > 0 ? inner : outer },
      { x: gx, y: gy - 17, anchor: "middle" },
      onShaft(0.9, 22),
      onShaft(0.25, 24)
    ]
  });
  obstacles.push({ left: tx - 8, right: tx + 8, top: ty - 8, bottom: ty + 8, arrow: "contact0" });
  const tBelow = [{ x: tx + away * 13, y: ty + 31, anchor: away > 0 ? inner : outer }, { x: tx - away * 13, y: ty + 31, anchor: away > 0 ? outer : inner }];
  const tAbove = [{ x: tx + away * 13, y: ty - 12, anchor: away > 0 ? inner : outer }, { x: tx - away * 13, y: ty - 12, anchor: away > 0 ? outer : inner }];
  labels.push({
    id: "fc-contact-label-1",
    role: "contact",
    owner: "contact0",
    lines: [[italic("T")]],
    size: 20,
    fill: navy,
    priority: 0,
    candidates: half < 1 ? [tBelow[0], tAbove[0], tBelow[1], tAbove[1]] : [...tBelow, ...tAbove]
  });
  over += `<circle ${attrs({ cx: mx, cy: my, r: 4, fill: navy, stroke: "white", "stroke-width": 1.5, id: "fc-com" })}/>`;
  obstacles.push({ left: mx - 6, right: mx + 6, top: my - 6, bottom: my + 6, arrow: "com" });
  over += ticks;
  obstacles.push({ left: hx - 11, right: hx + 11, top: hy - 11, bottom: hy + 11, weight: 0.3 });
  handles += `<g ${attrs({ class: "handle push-handle", "data-side": push.side, "data-tail": `${r(hx)},${r(hy)}`, "data-face": `${r(fx)},${r(fy)}`, "data-tip": `${r(gx)},${r(gy)}`, "data-apex": `${r(ax)},${r(ay)}` })}><circle ${attrs({ cx: r(hx), cy: r(hy), r: 22, fill: "transparent", class: "hit" })}/><circle ${attrs({ cx: r(hx), cy: r(hy), r: 10, fill: "none", stroke: slate, "stroke-width": 1.6, class: "ring" })}/></g>`;
  const required = (label) => ["force", "ghost", "push", "weight", "contact"].includes(label.role) || label.role === "tangential" && Math.abs(b.push) >= 1;
  const weight = (label) => required(label) ? 1e3 : label.role === "normal" ? 10 : label.role === "limit" ? 5 : 1;
  const second = labels.map((l) => l.role === "force" && state.components ? { ...l, priority: 3.2 } : l);
  const third = labels.map((l) => l.role === "ghost" ? { ...l, priority: 0.2 } : l.role === "push" ? { ...l, priority: 0.3 } : l.role === "tangential" ? { ...l, priority: 0.35 } : l.role === "weight" ? { ...l, priority: 0.4 } : l);
  const fourth = third.map((l) => l.role === "force" && state.components ? { ...l, priority: 3.2 } : l);
  const fifth = labels.map((l) => l.role === "tangential" ? { ...l, priority: 0.3 } : l.role === "ghost" || l.role === "force" ? { ...l, priority: 0.6 } : l);
  const sixth = fifth.map((l) => l.role === "force" && state.components ? { ...l, priority: 3.2 } : l);
  const lenient = [[labels, false, false], [second, false, false], [fifth, false, false]];
  const orders = (remembering) => remembering ? [[labels, true], [second, true], [third, true], [labels, false], [second, false], [third, false], [fourth, false], [fifth, false], [sixth, false], ...lenient] : [[labels, false], [second, false], [third, false], [fourth, false], [fifth, false], [sixth, false], ...lenient];
  const title = "A box on a table: the friction cone at the table contact";
  const side = (x) => x > 0 ? "right of" : "left of";
  const drawnMm = (ax - tx) / 2;
  const dashed = state.components ? "the dashed arrows show" : "the dashed arrow shows";
  const verdict = outside ? `, so friction cannot maintain rest (${dashed} what rest would need)` : b.status === "boundary" ? ", exactly what rest needs: at the friction limit" : ", so friction can maintain rest";
  const where = b.noPush ? "The contact force is drawn at the support midpoint T." : outside ? Math.abs(drawnMm) < 0.05 ? "The dashed force is drawn at the support midpoint T, where the friction limit (zero) is reached." : `The dashed force is drawn where rest is lost, at the centre of pressure of the friction limit, ${format(Math.abs(drawnMm), 1)} mm ${side(drawnMm)} the support midpoint T.` : `The contact force is drawn at its centre of pressure, ${format(Math.abs(drawnMm), 1)} mm ${side(drawnMm)} the support midpoint T.`;
  const desc = `Box of ${format(b.mass, 2)} kg (weight ${format(b.weight, 3)} N) on a table, ` + (b.noPush ? `with no push. Rest needs the table to supply ${format(b.fn, 3)} N upward and no friction (friction could supply up to ${format(b.bound, 3)} N). ${where}` : `pushed with ${format(Math.abs(b.push), 3)} N from the ${b.face} at ${format(b.pushHeight * 1e3, 1)} mm above the table. Rest needs the table to supply ${format(b.fn, 3)} N upward and ${format(Math.abs(b.ftRequired), 3)} N of friction to the ${b.push > 0 ? "left" : "right"}; friction can supply up to ${format(b.bound, 3)} N${verdict}. ${where}`) + ` Friction coefficient ${format(state.mu, 2)}, cone half-angle ${format(result.alpha.deg, 1)} degrees around the upward normal. Forces drawn at ${PX_PER_N} px per newton in both directions.`;
  return { parts: { svg, under, originUnder: "", over, originDot: "", handles }, obstacles, labels, segments, raySegments, required, weight, orders, title, desc };
}
function diagram(state, result, config, debug, memory, options = {}) {
  const scene = state.view === "pair" ? pairScene(state, result, config) : boxScene(state, result, config, options);
  const { obstacles, labels, segments, raySegments, required, weight } = scene;
  const remembering = memory && memory.size > 0;
  const orders = scene.orders(remembering);
  let best = null;
  for (const [k, [order, remember, strict = true]] of orders.entries()) {
    if (k >= 2 && best.score < 1e3) break;
    const trial = { dropped: [], memory: memory ? remember ? new Map(memory) : /* @__PURE__ */ new Map() : void 0, debug: debug ? [] : void 0, strict, raySegments };
    const copies = order.map((l) => ({ ...l })).sort((a, b) => a.priority - b.priority);
    const placedTrial = place(copies, obstacles, segments, trial);
    const score = trial.dropped.reduce((sum, id) => sum + weight(copies.find((l) => l.id === id)), 0) + 3 * placedTrial.filter((l) => l.relaxed).length + 0.5 * placedTrial.filter((l) => l.form > 0).length + 0.01 * placedTrial.filter((l) => !l.clear).length;
    debug?.push({ order: k, remember, dropped: trial.dropped, score }, ...trial.debug.map((d) => ({ ...d, order: k })));
    if (!best || score < best.score - 1e-9) best = { score, result: placedTrial, trial };
    if (score === 0) break;
  }
  if (memory) {
    memory.clear();
    for (const [k, v] of best.trial.memory) memory.set(k, v);
  }
  void required;
  const dropped = best.trial.dropped, placed = best.result;
  const { svg, under, originUnder, over, originDot, handles } = scene.parts;
  return `<title id="fc-title">${esc(scene.title)}</title><desc id="fc-desc">${esc(scene.desc)}</desc><defs>${markers}</defs>` + svg + under + originUnder + over + originDot + placed.map(leaderLine).join("") + placed.map(text).join("") + handles + `<g id="fc-dropped" data-ids="${dropped.join(" ")}"></g>`;
}
export {
  BOX,
  COLORS,
  diagram
};
