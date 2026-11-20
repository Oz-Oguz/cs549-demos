import { format } from "./model.mjs";
const navy = "#17334a", slate = "#566c7b", coral = "#be513b", pale = "#f2f5f6";
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const line = (x1, y1, x2, y2, opts = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${opts}/>`;
function diagram(state, config, horizontal = false, { variant = "chapter" } = {}) {
  const slide = variant === "slide" || variant === "scene";
  const size = (chapter, projection = 30) => slide ? projection : chapter;
  const text = (x, y, value, opts = "") => `<text x="${x}" y="${y}" aria-label="${esc(value)}" ${opts}>${esc(value).replace(/([A-Za-zτ])_([A-Za-z]+)/g, `$1<tspan baseline-shift="sub" font-size="${slide ? "75%" : "65%"}">$2</tspan>`)}</text>`;
  const cx = 310, cy = 200, scale = 2400, forceScale = 8;
  const width = config.box.width * scale, height = config.box.height * scale;
  const bottom = cy + height / 2, top = cy - height / 2;
  const xs = cx + state.x * scale;
  const ref = horizontal ? "O" : state.reference;
  const rx = cx + (ref === "Q" ? config.referenceQ[0] * scale : 0);
  const weight = config.mass * config.gravity;
  const [hxMetres, , hzMetres] = config.horizontal.application;
  const [horizontalFx, , horizontalFz] = config.horizontal.force;
  const arrow = slide ? 15 : 10, stroke = slide ? 4.5 : 3.5;
  const defs = `<defs>
    <marker id="force" markerWidth="${arrow}" markerHeight="${arrow}" refX="${arrow}" refY="${arrow / 2}" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L${arrow},${arrow / 2} L0,${arrow} Z" fill="${coral}"/></marker>
    <marker id="weight" markerWidth="${arrow}" markerHeight="${arrow}" refX="${arrow}" refY="${arrow / 2}" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L${arrow},${arrow / 2} L0,${arrow} Z" fill="${navy}"/></marker>
    <marker id="axis" markerWidth="${slide ? 11 : 8}" markerHeight="${slide ? 11 : 8}" refX="${slide ? 11 : 8}" refY="${slide ? 5.5 : 4}" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L${slide ? 11 : 8},${slide ? 5.5 : 4} L0,${slide ? 11 : 8} Z" fill="${slate}"/></marker>
  </defs>`;
  const leader = `stroke="${slate}" stroke-width="${slide ? 2 : 1.3}" fill="none"`;
  const construction = (color = slate) => `stroke="${color}" stroke-width="${slide ? 2 : 1.2}" stroke-dasharray="5 5"`;
  const bracket = (x1, x2, y, label, color) => `<g data-lever-arm="${label.split(":")[0]}">
    ${line(x1, y, x2, y, `stroke="${color}" stroke-width="${slide ? 2.5 : 1.5}"`)}
    ${line(x1, y - 5, x1, y + 5, `stroke="${color}" stroke-width="2"`)}
    ${line(x2, y - 5, x2, y + 5, `stroke="${color}" stroke-width="2"`)}
    ${text((x1 + x2) / 2, y - 12, label, `text-anchor="middle" font-size="${size(22, 28)}" fill="${color}"`)}</g>`;
  let geometry = `<rect x="${cx - width / 2}" y="${top}" width="${width}" height="${height}" rx="3" fill="${pale}" stroke="${navy}" stroke-width="${slide ? 3.5 : 2.5}"/>
    <path d="M${cx + width / 2},${top + 20} L422,143 L431,143" ${leader}/>
    ${text(438, 153, `${format(config.mass)} kg box`, `font-size="${size(22, 26)}" fill="${slate}"`)}
    ${line(65, 325, 120, 325, `stroke="${slate}" stroke-width="${slide ? 3 : 2}" marker-end="url(#axis)"`)}
    ${line(65, 325, 65, 275, `stroke="${slate}" stroke-width="${slide ? 3 : 2}" marker-end="url(#axis)"`)}
    ${text(130, 334, "x", `font-size="${size(22, 26)}" font-style="italic"`)}${text(57, 264, "z", `font-size="${size(22, 26)}" font-style="italic"`)}
    ${text(20, 365, "\u2297 +y into page", `font-size="${size(20, 24)}"`)}
    ${text(20, 400, "W axes", `font-size="${size(20, 24)}" fill="${slate}"`)}`;
  if (!horizontal) {
    if (state.reveal) {
      const extension = (x, end, color) => ref === "Q" ? line(x, 39, x, 44, construction(color)) + line(x, 92, x, end, construction(color)) : line(x, 39, x, end, construction(color));
      geometry += `${extension(xs, bottom - 8, coral)}
        ${extension(rx, cy - 20, slate)}
        ${bracket(xs, rx, 40, `support: ${format(Math.abs(xs - rx) / scale)} m`, coral)}`;
      if (ref === "Q") geometry += `${line(cx, 84, cx, cy - 8, construction(navy))}
        ${bracket(cx, rx, 84, `gravity: ${format(Math.abs(cx - rx) / scale)} m`, navy)}`;
    }
    geometry += `${line(cx, cy, cx, cy + weight * forceScale, `stroke="${navy}" stroke-width="${stroke}" marker-end="url(#weight)"`)}
      ${text(214, 188, "Weight", `text-anchor="end" font-size="${size(20, 24)}" fill="${slate}"`)}
      ${text(214, 225, `${format(weight)} N`, `text-anchor="end" font-size="${size(24, 30)}"`)}
      <path d="M220,227 L275,249 L${cx - 7},249" ${leader}/>
      ${line(xs, bottom + state.force * forceScale, xs, bottom, `stroke="${coral}" stroke-width="${stroke}" marker-end="url(#force)"`)}
      <circle cx="${xs}" cy="${bottom}" r="4" fill="${coral}"/>
      ${text(xs + 15, bottom + 28, "S", `fill="${coral}" font-weight="700"`)}
      ${text(440, bottom + 38, "Support", `font-size="${size(20, 24)}" fill="${slate}"`)}
      ${text(440, bottom + 73, `${format(state.force)} N`, `fill="${coral}" font-size="${size(24, 30)}"`)}`;
  } else {
    const hx = cx + hxMetres * scale, hy = cy - hzMetres * scale;
    geometry += `${line(40, hy, cx + 25, hy, construction(coral))}
      ${line(hx - horizontalFx * forceScale, hy + horizontalFz * forceScale, hx, hy, `stroke="${coral}" stroke-width="${stroke}" marker-end="url(#force)"`)}
      <circle cx="${hx}" cy="${hy}" r="4" fill="${coral}"/>
      ${text(hx - 17, hy - 18, "Push", `text-anchor="end" fill="${coral}" font-size="${size(22, 28)}"`)}
      ${text(55, hy + 43, `${format(horizontalFx)} N \u2192`, `fill="${coral}" font-size="${size(24, 30)}"`)}
      ${line(cx + 5, hy, 419, hy, construction())}
      ${line(cx + 5, cy, 419, cy, construction())}
      ${line(414, hy, 414, cy, `stroke="${slate}" stroke-width="2"`)}
      ${line(408, hy, 420, hy, `stroke="${slate}" stroke-width="2"`)}
      ${line(408, cy, 420, cy, `stroke="${slate}" stroke-width="2"`)}
      ${text(432, (hy + cy) / 2 + 10, `${format(Math.abs(hzMetres))} m`, `font-size="${size(22, 30)}"`)}
      ${text(250, 360, "One push contribution", `font-size="${size(22, 28)}" fill="${slate}"`)}`;
  }
  const pointLabel = (x, label, color) => `<rect x="${x - 13 - size(24, 30)}" y="${cy - 12 - size(24, 30)}" width="${size(24, 30) + 3}" height="${size(24, 30) + 6}" fill="${pale}"/>${text(x - 13, cy - 12, label, `text-anchor="end" font-weight="700" fill="${color}"`)}`;
  geometry += `<circle cx="${cx}" cy="${cy}" r="5" fill="${navy}"/>
    ${pointLabel(cx, "O", navy)}`;
  if (ref === "Q") geometry += `<circle cx="${rx}" cy="${cy}" r="5" fill="${coral}"/>${pointLabel(rx, "Q", coral)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 420" data-variant="${variant}" style="font-size:${size(24, 30)}px;fill:#17334a" role="img" aria-labelledby="title desc">
    <title id="title">${esc(horizontal ? "Horizontal force applied to the box" : `Forces on the box; reporting point ${ref}`)}</title>
    <desc id="desc">${esc(horizontal ? `A force [${horizontalFx}, 0, ${horizontalFz}] N at [${hxMetres}, 0, ${hzMetres}] m, measured from O.` : `A box with downward weight ${format(weight)} N at O and upward support ${format(state.force)} N at S. Forces and positions are expressed in W. ${state.reveal ? "Perpendicular lever arms are shown." : "Predict the effect of these loads."}`)}</desc>
    <style>text{font-family:Arial,Helvetica,sans-serif;}svg{background:white}</style>
    <rect width="620" height="420" fill="white"/>${defs}${geometry}</svg>`;
}
export {
  diagram
};
