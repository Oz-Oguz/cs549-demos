import { format, formatAll, formatPair } from "./model.mjs";
const f = (value) => format(value, 3);
const sideWords = { left: "left", right: "right" };
const HEADLINES = {
  balanced: "Balance is possible with this squeeze.",
  limiting: "Balance is possible, exactly at a friction limit.",
  "more-squeeze": "Not enough squeeze here, but a squeeze within the cap would work.",
  "beyond-cap": "No squeeze within the cap can balance this load.",
  "no-friction": "Without friction, no squeeze can balance the box."
};
const tangentialSymbol = (index) => `<math aria-label="f t ${index}"><msub><mi>f</mi><mrow><mi>t</mi><mo>,</mo><mn>${index}</mn></mrow></msub></math>`;
const relation = (need, bound, tol) => need - bound > tol ? ">" : bound - need > tol ? "<" : "=";
function selectedSentence(result, state) {
  if (result.selectedKey === "enough") {
    const [B, L, R] = formatAll([result.frictionBound, ...result.tangential]);
    return `Enough. Each contact may supply up to ${B} N upward; balance needs ${L} N left and ${R} N right.`;
  }
  if (result.selectedKey === "exactly-enough") {
    const B = f(result.frictionBound);
    return result.limiting === "both" ? `Exactly enough. Both friction limits (${B} N) are reached; no reserve.` : `Exactly enough. The ${sideWords[result.limiting]} friction limit (${B} N) is reached; no reserve.`;
  }
  if (state.mu === 0) return "Not enough. Without friction, squeeze supplies no upward force.";
  if (state.squeeze === 0) return "Not enough. With no squeeze, friction supplies no upward force.";
  if (result.limiting === "both") {
    const [L, R, B] = formatAll([...result.tangential, result.frictionBound]);
    return `Not enough. Both contacts need more (${L} and ${R} N) than the ${B} N each may supply.`;
  }
  const i = result.limiting === "left" ? 0 : 1;
  const [need, bound] = formatPair(Math.abs(result.tangential[i]), result.frictionBound);
  return `Not enough. The ${result.limiting} contact needs ${need} N upward but may supply only ${bound} N.`;
}
function capSentence(result, state) {
  if (result.capKey === "no-finite") return "No finite squeeze. Without friction, no squeeze supplies upward force.";
  const [min] = formatPair(result.minimumSqueeze, state.cap);
  if (result.capKey === "within-cap") return `Yes. Minimum squeeze ${min} N per finger.`;
  if (result.capKey === "at-cap") return `Only at the cap. Minimum squeeze ${f(result.minimumSqueeze)} N per finger equals the cap; no reserve.`;
  if (state.cap === 0) return `No. A 0 N cap allows no squeeze, so friction supplies no upward force. Minimum squeeze ${min} N per finger.`;
  const largest = Math.max(...result.tangential.map(Math.abs));
  const [need, capBound] = formatPair(largest, result.capBound);
  const who = result.governing === "both" ? "both contacts need" : `the ${result.governing} contact needs`;
  return `No. Minimum squeeze ${min} N per finger exceeds the cap. At the cap each contact may supply ${capBound} N; ${who} ${need} N.`;
}
function describe(result, state, config) {
  const tol = config.tolerance.force;
  const needs = result.tangential.map(Math.abs);
  const larger = Math.abs(needs[0] - needs[1]) <= tol ? -1 : needs[0] > needs[1] ? 0 : 1;
  const contacts = config.contacts.map((contact, i) => {
    const rel = relation(needs[i], result.frictionBound, tol);
    const [need, bound] = rel === "=" ? [f(result.tangential[i]), f(result.frictionBound)] : formatPair(result.tangential[i], result.frictionBound);
    return {
      name: contact.name,
      label: contact.label,
      need: result.tangential[i],
      bound: result.frictionBound,
      capBound: result.capBound,
      relation: rel,
      needText: need,
      boundText: bound,
      text: `needs ${need} N \xB7 may supply ${bound} N`,
      fail: !result.selectedByContact[i],
      larger: larger === i
    };
  });
  return {
    headline: HEADLINES[result.status],
    selected: { title: `Selected squeeze, ${f(state.squeeze)} N per finger`, text: selectedSentence(result, state), fail: !result.selectedSuffices },
    cap: { title: `Any squeeze within the ${f(state.cap)} N cap`, text: capSentence(result, state), fail: !result.capSuffices },
    contacts
  };
}
export {
  describe,
  tangentialSymbol
};
