// Generated lessons live in this browser only (there is no server).
const KEY = 'lesson3d:generated';
const QUOTA = 'lesson3d:quota';
export const DAILY_LIMIT = 10;

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const listLessons = () => read(KEY, []).sort((a, b) => b.created - a.created);
export const getLesson = (id) => read(KEY, []).find((l) => l.id === id) ?? null;
export function saveLesson(data, source) {
  const id = Math.random().toString(36).slice(2, 10);
  const all = read(KEY, []);
  all.push({ id, created: Date.now(), source, data });
  if (!write(KEY, all)) throw new Error('storage');
  return id;
}
export function updateLesson(id, fn) {
  const all = read(KEY, []);
  const rec = all.find((l) => l.id === id);
  if (rec) { fn(rec); write(KEY, all); }
}
export function deleteLesson(id) { write(KEY, read(KEY, []).filter((l) => l.id !== id)); }

export function quotaLeft() { return Infinity; }
export function useQuota() {}
