import{a as e,i as t,o as n,r,t as i}from"./i18n-06VfP6Cy.js";var a=e=>String(e).replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]),o=e=>a(e).replace(/_([A-Za-z0-9]+)/g,`<sub>$1</sub>`).replace(/\^2/g,`²`).replace(/\^3/g,`³`);function s(s,c,l,u,d={}){let f=document.createElement(`aside`);f.className=`panel`,f.dir=t?`rtl`:`ltr`,f.lang=r,f.setAttribute(`aria-label`,`${c.kicker}: ${c.title}`),f.innerHTML=`
    <button class="sheet" aria-expanded="true" aria-controls="panelBody">${a(c.kicker)} · ${a(c.title)}</button>
    <div id="panelBody" class="body">
      <nav class="langs" aria-label="${a(n(`language`))}">${i.map(e=>`<button type="button" data-lang="${e.id}" lang="${e.id}" aria-pressed="${e.id===r}" title="${a(e.label)}">${a(e.label)}</button>`).join(``)}</nav>
      <nav class="nav"><a href="#/" ${c.generated?``:`aria-current="page"`}>${a(n(`exampleLesson`))}</a><a href="#/new" class="ai">${a(n(`newLesson`))}</a></nav>
      <header><div class="kicker">${a(c.kicker)}</div><h1>${a(c.title)}</h1>
        <p class="fig">${c.generated?``:`${n(`figure`)} ${c.n} · `}${a(c.figure)}</p></header>
      ${c.explanation.map(e=>`<p>${a(e)}</p>`).join(``)}
      ${c.equation?`<div class="eq"><div class="sym" dir="ltr">${o(c.equation.symbols)}</div><div class="words">${a(c.equation.words)}</div></div>`:``}
      ${c.reaction?`<h2>${n(`theaterTitle`)}</h2><p>${a(n(`theaterIntro`))}</p>
        <button class="theater-cta" data-act="theater">${a(n(`theater`))}</button>
        <ol class="rx">${c.reaction.steps.map(e=>`<li><button data-rx="${e.n}"><b>${e.n}</b><span><span>${a(e.name)}</span>
          <span class="tys">${e.types.map(e=>`<span class="ty" style="--c:${c.reaction.types[e].color}">${a(c.reaction.types[e].name)}</span>`).join(``)}</span></span></button></li>`).join(``)}</ol>`:``}
      ${c.predict?`<h2>${n(`predict`)}</h2><p>${a(c.predict.question)}</p>
      <div class="opts" role="radiogroup">${c.predict.options.map((e,t)=>`<label><input type="radio" name="predict" value="${t}"> <span>${a(e)}</span></label>`).join(``)}</div>`:``}
      ${c.things.length?`<h2>${n(`tryIt`)}</h2><p>${a(c.tryHint)}</p>`:``}
      <div class="actions">
        ${c.event?`<button data-act="event">${a(c.event.label)}</button>`:``}
        ${c.watch?`<button data-act="watch">${n(`watch`)}</button>`:``}
        <button data-act="reset" class="quiet">${n(`reset`)}</button>
      </div>
      ${c.things.length?`<div class="margin" aria-live="polite"><p class="hint">${n(`tapHint`)}</p></div>`:`<div class="margin" hidden></div>`}
      <p class="readout" aria-live="off"></p>
      ${c.explain?`<h2>${n(`why`)}</h2>
      <details class="flap"><summary>${n(`flap`)}</summary><p class="verdict"></p><p>${a(c.explain)}</p></details>`:``}
      ${c.challenge?`<h2>${n(`challenge`)}</h2><p>${a(c.challenge.text)} <span class="prog"></span></p>
      <div class="stamp" hidden>✓ ${a(c.challenge.done)}</div>`:``}
      ${c.keywords.length?`<h2>${n(`keywords`)}</h2><dl>${c.keywords.map(e=>`<dt>${a(e.term)}</dt><dd>${a(e.definition)}</dd>`).join(``)}</dl>`:``}
      ${c.sources?`<h2>${n(`sources`)}</h2><ol class="sources">${c.sources.map(e=>`<li>${a(e)}</li>`).join(``)}</ol>`:``}
    </div>`,s.appendChild(f);let p=e=>f.querySelector(e),m=p(`.flap`),h=p(`.sheet`);h.addEventListener(`click`,()=>{let e=f.classList.toggle(`collapsed`)===!1;h.setAttribute(`aria-expanded`,String(e)),l.onLayout?.()}),f.querySelectorAll(`[data-lang]`).forEach(t=>t.addEventListener(`click`,()=>{t.dataset.lang!==r&&e(t.dataset.lang)}));let g=u.predict??null,_=()=>{!c.predict||!p(`.verdict`)||(p(`.verdict`).textContent=g==null?n(`predictFirst`):g===c.predict.answer?n(`right`):`${n(`notQuite`)} « ${c.predict.options[c.predict.answer]} ».`)};return f.querySelectorAll(`input[name=predict]`).forEach(e=>{Number(e.value)===g&&(e.checked=!0),e.addEventListener(`change`,()=>{g=Number(e.value),l.onPredict(g),_()})}),m?.addEventListener(`toggle`,()=>{m.open&&g==null&&(m.open=!1,p(`.margin`).innerHTML=`<p class="hint">${n(`tickFirst`)}</p>`),_()}),f.querySelectorAll(`[data-act]`).forEach(e=>e.addEventListener(`click`,()=>l[e.dataset.act]())),f.querySelectorAll(`[data-rx]`).forEach(e=>e.addEventListener(`click`,()=>l.theaterStep(Number(e.dataset.rx)))),{el:f,margin(e){let t=e.def;p(`.margin`).innerHTML=`<p class="who"><b>${a(t.name)}</b></p>
        ${t.formula?`<p class="sym" dir="ltr">${a(t.formula)}</p>`:``}
        <p class="res">→ ${a(d[t.store]??t.store)}</p>
        ${t.note?`<p class="note">${a(t.note)}</p>`:``}`},readout(e){p(`.readout`).textContent=e??``},progress(e,t,r){p(`.prog`)&&(p(`.prog`).textContent=`(${e} ${n(`of`)} ${t})`,p(`.stamp`).hidden=!r)},collapse(e){f.classList.contains(`collapsed`)!==e&&(f.classList.toggle(`collapsed`,e),h.setAttribute(`aria-expanded`,String(!e)),l.onLayout?.())},currentStep(e){f.querySelectorAll(`[data-rx]`).forEach(t=>t.setAttribute(`aria-current`,String(Number(t.dataset.rx)===e)))},get height(){return f.getBoundingClientRect().height},get collapsed(){return f.classList.contains(`collapsed`)}}}export{a as n,s as r,o as t};