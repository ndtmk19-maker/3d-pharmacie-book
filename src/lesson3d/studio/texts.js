// Every human-readable text of a generated lesson, in a fixed order, so it can be translated as one list
// and put back. Works on lessons written in one language (strings).
export function textSlots(d) {
  const slots = [];
  const add = (obj, key) => { if (typeof obj?.[key] === 'string' && obj[key].trim()) slots.push([obj, key]); };
  add(d, 'title'); add(d, 'figure'); add(d, 'overallWords');
  (d.summary ?? []).forEach((_, i) => add(d.summary, i));
  for (const k of d.keywords ?? []) { add(k, 'term'); add(k, 'definition'); }
  if (d.predict) { add(d.predict, 'question'); add(d.predict, 'explain'); (d.predict.options ?? []).forEach((_, i) => add(d.predict.options, i)); }
  for (const st of d.steps ?? []) { add(st, 'name'); for (const f of st.frames ?? []) add(f, 'text'); }
  return slots;
}
export const getTexts = (d) => textSlots(d).map(([o, k]) => o[k]);
// a copy of the lesson with the translated texts in place
export function withTexts(d, items) {
  const copy = structuredClone(d);
  textSlots(copy).forEach(([o, k], i) => { if (items[i] != null) o[k] = items[i]; });
  return copy;
}
