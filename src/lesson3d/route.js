// Which lesson to open: the built-in ketamine book (#/), or a lesson generated in this browser (#/g/<id>).
import { tr, t, lang } from './i18n.js';

export const route = () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'new') return { page: 'studio' };
  const m = h.match(/^g\/([\w-]+)/);
  return m ? { page: 'generated', id: m[1] } : { page: 'book' };
};

// A generated script -> the same lesson shape the book reads
export async function generatedLesson(id) {
  const [{ getLesson, updateLesson }, { loadRDKit }, { buildReaction }, { TYPES }] = await Promise.all([
    import('./studio/store.js'), import('./chem/rdkit.js'), import('./chem/build.js'), import('./lessons/ketamine-reaction.js'),
  ]);
  const rec = getLesson(id);
  if (!rec) throw Object.assign(new Error('not found'), { code: 'notfound' });
  const rdkit = loadRDKit();
  let d = rec.data;
  let note = null;
  // written in one language: translate the texts once into the language being viewed, then keep them
  if (d.lang && d.lang !== lang) {
    const [{ getTexts, withTexts }, gem] = await Promise.all([import('./studio/texts.js'), import('./studio/gemini.js')]);
    let items = d.translations?.[lang];
    if (!items) {
      document.getElementById('loaderTitle').textContent = t('translating');
      try {
        items = await gem.translateTexts(getTexts(d), d.lang, lang);
        updateLesson(id, (r) => { r.data.translations = { ...(r.data.translations ?? {}), [lang]: items }; });
      } catch (err) { console.warn(err); note = t('translateFailed'); }
    }
    if (items) d = withTexts(d, items);
  }
  const RD = await rdkit;
  const R = buildReaction(RD, d, tr);
  const scale = R.scale;
  const originY = 2.6 + R.halfHeight;
  const origin = [-15, originY, -1];
  const options = (d.predict?.options ?? []).map(tr);
  return {
    key: `g:${id}`,
    n: '',
    generated: true,
    autoTheater: true,
    folios: ['', ''],
    title: tr(d.title) ?? t('newLesson'),
    figure: tr(d.figure) ?? '',
    explanation: (d.summary ?? []).map(tr),
    equation: d.overall ? { symbols: d.overall, words: tr(d.overallWords) ?? '' } : null,
    keywords: (d.keywords ?? []).map((k) => ({ term: tr(k.term), definition: tr(k.definition) })),
    predict: options.length >= 2 ? { question: tr(d.predict.question), options, answer: Math.min(options.length - 1, Math.max(0, d.predict.answer | 0)) } : null,
    explain: tr(d.predict?.explain) ?? '',
    tryHint: t('genTry'),
    jarsTitle: t('genJarsTitle'),
    jarsCaption: t('genJarsCaption'),
    sources: [t('genWarning'), ...(d.warnings?.length ? [t('genSoft')] : []), ...(note ? [note] : [])],
    things: [],
    jars: [],
    reaction: {
      atoms: R.atoms, keys: R.keys, center: R.center, scale, halfWidth: R.halfWidth, halfHeight: R.halfHeight,
      origin,
      view: { pos: [-13.5, originY + 6.5, 27], look: [-14.6, originY + 0.1, -1] },
      steps: R.steps, types: TYPES,
    },
  };
}

export async function loadLesson() {
  const r = route();
  if (r.page === 'generated') return generatedLesson(r.id);
  return (await import('./lessons/ketamine.js')).default;
}
