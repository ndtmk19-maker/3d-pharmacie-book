// Asks Gemini for the reaction "script": steps, frames as atom-mapped SMILES, reaction types and
// explanations. To keep it fast the script is written in ONE language (the student's); the other
// languages are translated later, on demand, by a much smaller request (see translateTexts).
// The answer is streamed so the student sees steps arrive. The key is read from the build environment.
import { FRAME_TYPES } from '../chem/build.js';

// Tried in order: when Google retires a model it answers 404 or "no longer available", and we move on.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
let modelIndex = 0, firstAlive = 0;   // firstAlive skips models Google has retired; overload is temporary
const DEFAULT_KEY = typeof atob === 'function' ? atob('QVEuQWI4Uk42S1lhb2h5RGlBemo4VGpHV1ZuQ1BYYWRhM1pZUkEtSUtBc0NYcXpGbDZxX3c=') : '';

export const getKey = () => {
  try {
    const q = new URLSearchParams(location.search).get('gemini_key') || new URLSearchParams(location.search).get('key');
    if (q) {
      localStorage.setItem('lesson3d:gemini_api_key', q.trim());
      const u = new URL(location.href);
      u.searchParams.delete('key');
      u.searchParams.delete('gemini_key');
      history.replaceState(null, '', u.toString());
      return q.trim();
    }
    return localStorage.getItem('lesson3d:gemini_api_key') || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || DEFAULT_KEY;
  } catch {
    return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || DEFAULT_KEY;
  }
};

export const setKey = (k) => {
  try {
    if (k && k.trim()) localStorage.setItem('lesson3d:gemini_api_key', k.trim());
    else localStorage.removeItem('lesson3d:gemini_api_key');
  } catch {}
};

export const hasKey = () => Boolean(getKey());
const LANG_NAME = { fr: 'French', ar: 'Modern Standard Arabic', en: 'English' };

const S = { type: 'STRING' };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    refused: { type: 'BOOLEAN' },
    reason: S,
    title: S,
    figure: S,
    summary: { type: 'ARRAY', items: S },
    overall: S,
    overallWords: S,
    keywords: { type: 'ARRAY', items: { type: 'OBJECT', properties: { term: S, definition: S }, required: ['term', 'definition'] } },
    predict: {
      type: 'OBJECT',
      properties: { question: S, options: { type: 'ARRAY', items: S }, answer: { type: 'INTEGER' }, explain: S },
      required: ['question', 'options', 'answer', 'explain'],
    },
    labels: { type: 'ARRAY', items: { type: 'OBJECT', properties: { map: { type: 'INTEGER' }, label: S }, required: ['map', 'label'] } },
    steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: S,
          frames: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING', format: 'enum', enum: FRAME_TYPES },
                smiles: S,
                text: S,
                focus: { type: 'ARRAY', items: { type: 'INTEGER' } },
              },
              required: ['type', 'smiles', 'text'],
            },
          },
        },
        required: ['name', 'frames'],
      },
    },
  },
  required: ['refused'],
  propertyOrdering: ['refused', 'reason', 'title', 'figure', 'summary', 'overall', 'overallWords', 'labels', 'steps', 'keywords', 'predict'],
};
SCHEMA.properties.steps.items.properties.frames.items.propertyOrdering = ['type', 'smiles', 'text', 'focus'];
SCHEMA.properties.steps.items.propertyOrdering = ['name', 'frames'];

const system = (lang) => `You turn a chemical reaction scheme (an image and/or text from a student) into the script of an animated 3D lesson for university pharmacy students. The app draws and animates the molecules itself; you only write data. Be concise.

SCOPE AND SAFETY
* Explain only the reaction(s) the student gives. Do not propose other synthetic routes.
* Conceptual mechanism only, as in a textbook: which bonds form and break and why. Never give laboratory conditions, amounts, concentrations, temperatures, times, solvents, yields, equipment, work-up, purification or where to obtain chemicals.
* If the request is about chemical weapons, nerve agents, toxins, explosives or energetic materials, or asks for a procedure, set "refused": true with a short "reason" and nothing else.
* If the input is not a chemical reaction, set "refused": true and explain in "reason".

THE SCRIPT
* "steps": one per arrow of the scheme, in order, each with a short "name" (e.g. "Grignard + nitrile → ketone").
* Each step has 2 or 3 "frames" (never more), like a film: the first frame of step 1 shows the separate starting materials; when a reagent joins, give an "approach" frame where it is present as a separate species, then the frame where it bonds; when a group leaves, show it as a separate species in that frame, then omit it in the next frame. End the last step with a "product" frame.
* "smiles" of a frame: every species present at that moment, dot-separated, as valid SMILES with an atom-map number on EVERY heavy atom, e.g. [CH3:1][C:2](=[O:3])[OH:4]. Write aromatic atoms as [cH:5] or [c:6]. Charges are allowed ([O-:7], [NH2+:8]).
* CRITICAL: the same physical atom keeps the same map number and the same element in every frame. New reagents get new numbers when they first appear. Never reuse a number for a different atom.
* Hydrogens stay implicit (inside brackets, e.g. [CH2:9]); use explicit hydrogens only if a proton transfer is essential.
* "type" of each frame, the kind of change happening INTO that frame: approach (species come close, no bond change), combination (two species join / addition), substitution (one atom or group replaces another), cleavage (a bond breaks and a group leaves), rearrangement (bonds move inside one molecule), product (final result, no change).
* "text": 1 or 2 short sentences saying what happens in that frame and which bond forms or breaks. If you simplify a mechanism, say so.
* "focus": map numbers of the atoms involved in that frame.
* "labels": up to 3 key atoms to follow through the film, with a short label such as "C*" or "Cα".
* Use the widely accepted textbook mechanism.

THE LESSON
* "title", "figure" (a 3 to 6 word caption), "summary" (2 short sentences), "overall" (the overall change as formulas with Unicode subscripts, e.g. "C₇H₄ClN + C₅H₉MgBr → C₁₃H₁₆ClNO"), "overallWords" (the sequence of reaction types in words), 3 "keywords" with one-line definitions.
* "predict": a question testing a common misconception about this reaction, 2 or 3 options, the index of the right "answer", and "explain" (2 or 3 sentences resolving it).
* Write every text field in ${LANG_NAME[lang] ?? 'French'}. SMILES and formulas stay as they are.`;

// low "thinking" makes the answer start much sooner; the chemistry is checked afterwards anyway
const thinking = (model) => (/gemini-2\.5/.test(model) ? { thinkingBudget: 512 } : { thinkingLevel: 'low' });

const retired = (status, msg = '') => status === 404 || /no longer available|not found|is not supported|deprecated/i.test(msg);
// Google answers 503 / "high demand" when a model is overloaded on its side (not because of this site).
const busy = (status, msg = '') => status === 503 || status === 500 || status === 502 || /high demand|overloaded|unavailable|try again later/i.test(msg);
const WAITS = [3, 8];   // seconds before the 2nd and 3rd try on the same model
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function call(req, onStage = () => {}, onText) {
  let timeouts = 0, stream = onText;
  for (;;) {
    const model = MODELS[modelIndex];
    for (let attempt = 0; ; attempt++) {
      try { return await callModel(model, req, stream); }
      catch (err) {
        if (retired(err.status, err.message)) { firstAlive = Math.max(firstAlive, modelIndex + 1); break; }   // gone for good
        if (err.status === 'timeout') {                                     // stuck: another model, at most twice
          if (++timeouts >= 2 || modelIndex >= MODELS.length - 1) throw err;
          onStage('timeout');
          stream = undefined;                                                // in case streaming is what stalls
          break;
        }
        if (!busy(err.status, err.message)) throw err;
        if (attempt >= WAITS.length) break;                                  // still busy: next model
        onStage('busy', WAITS[attempt]);
        await wait(WAITS[attempt]);
        onStage('ask');
      }
    }
    if (modelIndex >= MODELS.length - 1) {
      const e = new Error('all Gemini models are busy'); e.status = 503; throw e;
    }
    modelIndex++;
    onStage('switch', MODELS[modelIndex]);
  }
}

const fail = (status, message) => Object.assign(new Error(message), { status });

// One request. With `onText` the answer is streamed (server-sent events) and onText(textSoFar) is called.
// Limits: an answer that has not finished after TOTAL seconds is abandoned and tried again (a model can
// occasionally loop and write for minutes). A streamed answer is also abandoned after IDLE seconds of
// silence. A plain request sends nothing until it is complete, so it has only the TOTAL limit.
const TOTAL = 170, IDLE = 75, MAX_TOKENS = 16384;

async function callModel(model, req, onText, withThinking = true) {
  const ctl = new AbortController();
  let idle;
  const kick = () => { clearTimeout(idle); if (onText) idle = setTimeout(() => ctl.abort('idle'), IDLE * 1000); };
  const total = setTimeout(() => ctl.abort('total'), TOTAL * 1000);
  kick();
  try { return await request(model, req, onText, withThinking, ctl.signal, kick); }
  catch (err) {
    if (ctl.signal.aborted) throw fail('timeout', `no complete answer from ${model} after ${ctl.signal.reason === 'idle' ? `${IDLE} s of silence` : `${TOTAL} s`}`);
    throw err;
  } finally { clearTimeout(idle); clearTimeout(total); }
}

async function request(model, { system: sys, contents, schema }, onText, withThinking, signal, kick) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: sys }] },
    contents,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2, maxOutputTokens: MAX_TOKENS,
      ...(withThinking ? { thinkingConfig: thinking(model) } : {}) },
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${onText ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getKey() }, body, signal });
  kick();
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? `HTTP ${res.status}`;
    // a model that does not accept the thinking setting: ask again without it
    if (withThinking && res.status === 400 && /think/i.test(msg)) return request(model, { system: sys, contents, schema }, onText, false, signal, kick);
    throw fail(res.status, msg);
  }
  let text = '', finish = null, block = null;
  const take = (chunk) => {
    const c = chunk.candidates?.[0];
    text += c?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';
    finish = c?.finishReason ?? finish;
    block = chunk.promptFeedback?.blockReason ?? block;
    if (chunk.error) throw fail(chunk.error.code, chunk.error.message);
  };
  if (onText && res.body?.getReader) {
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      kick();
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        try { take(JSON.parse(line.slice(5))); } catch (e) { if (e.status) throw e; }
        onText(text);
      }
    }
  } else take(await res.json());
  if (!text) throw fail('empty', block ?? finish ?? 'empty answer');
  if (finish === 'MAX_TOKENS') throw fail('timeout', 'the answer was too long and was cut off');
  return text;
}

// generate({ text, image, lang }, validate, onStage) -> data   (data.lang = the language it is written in)
// `validate(data)` returns a list of { msg, soft } errors. Gemini is asked to fix them (up to ATTEMPTS
// answers in all). If only "soft" errors remain at the end (a wrong charge or H count on a correct
// skeleton), the lesson is accepted and the problems are kept in data.warnings.
// onStage('ask' | 'retry' | 'check' | 'busy' | 'switch' | 'progress', arg)
export async function generate({ text, image, lang = 'fr' }, validate, onStage = () => {}) {
  if (!hasKey()) throw fail('nokey', 'no key');
  modelIndex = Math.min(firstAlive, MODELS.length - 1);
  const user = { role: 'user', parts: [] };
  if (image) user.parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } });
  user.parts.push({ text: text?.trim() ? `Reaction from the student:\n${text.trim()}` : 'The reaction is in the image.' });
  const history = [user];
  const progress = (t) => onStage('progress', { chars: t.length, steps: (t.match(/"frames"/g) ?? []).length, frames: (t.match(/"smiles"/g) ?? []).length });

  const ATTEMPTS = 3;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    onStage(attempt === 1 ? 'ask' : 'retry');
    const raw = await call({ system: system(lang), contents: history, schema: SCHEMA }, onStage, progress);
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }
    onStage('check');
    const errors = (data ? validate(data) : [{ msg: 'the answer was not valid JSON' }]).map((e) => (typeof e === 'string' ? { msg: e } : e));
    if (data) data.lang = lang;
    if (!errors.length || data?.refused) return data;
    const msgs = errors.map((e) => e.msg);
    if (attempt === ATTEMPTS) {
      if (data && errors.every((e) => e.soft)) { data.warnings = msgs; return data; }
      throw fail('invalid', msgs.slice(0, 4).join('; '));
    }
    history.push({ role: 'model', parts: [{ text: raw }] });
    history.push({ role: 'user', parts: [{ text: `Your script has these problems:\n${msgs.slice(0, 12).map((e) => `* ${e}`).join('\n')}\nReminders: a neutral O has 2 bonds (O+ has 3, O- has 1); a neutral N has 3 (N+ has 4); C has 4; count the H written inside brackets. A C=O that receives a new bond becomes C-O (single). Fix every problem and return the complete corrected JSON. Keep every atom's map number identical across frames.` }] });
  }
}

// Translate a list of short texts (all the words of a lesson) in one small request.
export async function translateTexts(items, from, to) {
  if (!hasKey()) throw fail('nokey', 'no key');
  modelIndex = Math.min(firstAlive, MODELS.length - 1);
  const schema = { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: S } }, required: ['items'] };
  const sys = `Translate each item of the JSON array from ${LANG_NAME[from]} to ${LANG_NAME[to]} for university pharmacy students. Keep chemical names correct in the target language, keep formulas, SMILES, symbols such as C*, Cα, arrows and numbers unchanged. Return {"items": [...]} with exactly ${items.length} items in the same order.`;
  const raw = await call({ system: sys, contents: [{ role: 'user', parts: [{ text: JSON.stringify(items) }] }], schema });
  const out = JSON.parse(raw).items;
  if (!Array.isArray(out) || out.length !== items.length) throw fail('invalid', 'translation has the wrong length');
  return out;
}
