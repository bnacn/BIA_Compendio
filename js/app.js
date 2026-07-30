/* ============================================================
   Compendio BIA — app.js
   SPA liviana, sin dependencias externas.
   ============================================================ */

const state = {
  hierarchy: null,
  salidas: null,        // { id: {...} }
  salidasList: [],       // array ordenado
};

// ---------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------
// URL del Worker que sirve los datos protegidos (mismo que usa Portal_BIA).
// Los datos ya no viven en /data del repo: se piden acá, y Cloudflare
// Access exige login con email @bna.com.ar antes de devolver nada.
const WORKER_BASE_URL = 'https://bia-api.cfranco-0ba.workers.dev';

function irALoginYVolver() {
  const yaReintentado = new URLSearchParams(location.search).has('authRetry');
  if (yaReintentado) return false;
  const separador = location.href.includes('?') ? '&' : '?';
  const volverA = location.href + separador + 'authRetry=1';
  location.href = `${WORKER_BASE_URL}/api/login?return=${encodeURIComponent(volverA)}`;
  return true;
}

async function fetchProtegido(clave){
  let res;
  try {
    res = await fetch(`${WORKER_BASE_URL}/api/data/${clave}`, {
      cache: 'no-cache',
      credentials: 'include', // manda la cookie de sesión de Cloudflare Access
    });
  } catch (err) {
    if (irALoginYVolver()) {
      return new Promise(() => {});
    }
    throw new Error(
      `No se pudo conectar con la API de datos. Si ya iniciaste sesión y ` +
      `seguís viendo esto, recargá la página o avisale a Carlos.`
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `No autorizado para acceder a "${clave}". Iniciá sesión con tu email ` +
      `@bna.com.ar en la pantalla de login que debería haber aparecido.`
    );
  }
  if (!res.ok) {
    throw new Error(`No se pudo cargar "${clave}" (HTTP ${res.status}).`);
  }
  return res.json();
}

async function loadData(){
  const [hierarchy, salidas] = await Promise.all([
    fetchProtegido('hierarchy'),
    fetchProtegido('salidas'),
  ]);
  state.hierarchy = hierarchy;
  state.salidas = salidas;
  state.salidasList = Object.values(salidas).sort((a,b)=> a.nombre.localeCompare(b.nombre,'es'));
}

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------
function esc(s){
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function countSalidas(uoNode){ return uoNode.salidas.length; }
function totalSalidas(){ return state.salidasList.length; }
function totalUnidades(){
  let n = 0;
  state.hierarchy.jefaturas_principales.forEach(jp=>jp.jefaturas.forEach(j=>n+=j.unidades.length));
  return n;
}

// ---------------------------------------------------------------
// Árbol lateral
// ---------------------------------------------------------------
function renderTree(){
  const el = document.getElementById('tree');
  const h = state.hierarchy;
  let html = `<div class="t-jp"><div class="t-label">${esc(h.nombre)}</div>`;

  h.jefaturas_principales.forEach((jp, jpIdx)=>{
    html += `<div class="t-jef" data-jp="${jpIdx}"><div class="t-label"><span class="chev">▶</span>${esc(jp.nombre)}</div><div class="t-jef-body">`;
    jp.jefaturas.forEach((jef, jefIdx)=>{
      html += `<div class="t-jef2" data-jef="${jpIdx}-${jefIdx}"><div class="t-label" style="padding-left:14px;"><span class="chev">▶</span>${esc(jef.nombre)}</div><div class="t-jef-body">`;
      jef.unidades.forEach((uo, uoIdx)=>{
        const n = countSalidas(uo);
        html += `<div class="t-uo" data-uo="${jpIdx}-${jefIdx}-${uoIdx}">
          <div class="t-label"><span class="chev">▶</span><span>${esc(uo.nombre)}</span><span class="count">${n}</span></div>
          <div class="t-uo-body">`;
        if (n === 0){
          html += `<div class="tree-empty">Sin salidas críticas relevadas aún</div>`;
        } else {
          uo.salidas.forEach(sid=>{
            const s = state.salidas[sid];
            html += `<div class="t-salida" data-sid="${sid}"><span class="n">#${sid}</span> ${esc(s.nombre)}</div>`;
          });
        }
        html += `</div></div>`;
      });
      html += `</div></div>`;
    });
    html += `</div></div>`;
  });

  el.innerHTML = html;

  // Reutilizar clases .t-jef para nivel jefatura y .t-jef2 para nivel jefatura tambien (mismo estilo)
  el.querySelectorAll('.t-jef2').forEach(n=> n.classList.add('t-jef'));

  // Eventos: togglear grupos
  el.querySelectorAll('.t-jef > .t-label').forEach(lbl=>{
    lbl.addEventListener('click', ()=> lbl.parentElement.classList.toggle('open'));
  });
  el.querySelectorAll('.t-uo > .t-label').forEach(lbl=>{
    lbl.addEventListener('click', ()=> lbl.parentElement.classList.toggle('open'));
  });
  el.querySelectorAll('.t-salida').forEach(node=>{
    node.addEventListener('click', ()=>{ location.hash = '#/salida/' + node.dataset.sid; });
  });
}

function expandPathTo(sid){
  const el = document.getElementById('tree');
  const node = el.querySelector(`.t-salida[data-sid="${sid}"]`);
  if (!node) return;
  el.querySelectorAll('.t-salida').forEach(n=>n.classList.remove('active'));
  node.classList.add('active');
  let p = node.closest('.t-uo');
  while (p){
    p.classList.add('open');
    p = p.parentElement.closest('.t-jef, .t-uo');
  }
  node.scrollIntoView({block:'nearest'});
}

// ---------------------------------------------------------------
// Buscador
// ---------------------------------------------------------------
function setupSearch(){
  const input = document.getElementById('searchInput');
  input.addEventListener('input', ()=>{
    const q = input.value.trim().toLowerCase();
    const tree = document.getElementById('tree');
    if (!q){
      tree.querySelectorAll('.t-salida, .t-uo, .t-jef').forEach(n=> n.style.display = '');
      return;
    }
    tree.querySelectorAll('.t-uo').forEach(uo=>{
      let uoMatch = uo.querySelector('.t-label span:nth-child(2)').textContent.toLowerCase().includes(q);
      let anyChild = false;
      uo.querySelectorAll('.t-salida').forEach(s=>{
        const sid = s.dataset.sid;
        const rec = state.salidas[sid];
        const hay = (rec.nombre + ' ' + rec.aplicativos.join(' ') + ' ' + rec.unidad_organizativa_agrupada)
          .toLowerCase().includes(q);
        s.style.display = hay ? '' : 'none';
        if (hay) anyChild = true;
      });
      const show = uoMatch || anyChild;
      uo.style.display = show ? '' : 'none';
      if (anyChild) uo.classList.add('open');
    });
    tree.querySelectorAll('.t-jef').forEach(jef=>{
      const visibleChild = jef.querySelector('.t-uo:not([style*="display: none"]), .t-jef:not([style*="display: none"])');
      const anyVisible = [...jef.querySelectorAll('.t-uo, .t-salida')].some(n=>n.style.display !== 'none');
      jef.style.display = anyVisible ? '' : 'none';
      if (anyVisible) jef.classList.add('open');
    });
  });
}

// ---------------------------------------------------------------
// Vistas
// ---------------------------------------------------------------
function viewHome(){
  const h = state.hierarchy;
  let jpBlocks = '';
  h.jefaturas_principales.forEach(jp=>{
    let jefCards = '';
    jp.jefaturas.forEach(jef=>{
      let chips = jef.unidades.map(uo=>{
        const n = countSalidas(uo);
        if (n===0) return `<span class="uo-chip empty">${esc(uo.nombre)} <span class="n">0</span></span>`;
        return `<span class="uo-chip" data-first-sid="${uo.salidas[0]}">${esc(uo.nombre)} <span class="n">${n}</span></span>`;
      }).join('');
      jefCards += `<div class="jef-card"><h4>${esc(jef.nombre)}</h4><div class="uo-chip-row">${chips}</div></div>`;
    });
    jpBlocks += `<div class="jp-block"><div class="jp-title">${esc(jp.nombre)}</div>${jefCards}</div>`;
  });

  const html = `
    <div class="home-hero">
      <div class="inner">
        <div class="eyebrow">Sistema de Gestión de Continuidad del Negocio · BCRA</div>
        <h1>Compendio de Salidas Críticas del BIA</h1>
        <p class="lead">Recurso de consulta para quienes llevan adelante el relevamiento de estrategias y la
        redacción de los Planes de Continuidad del Negocio. Cada salida incluida en el alcance del BIA cuenta
        aquí con su flujograma de actividades, predecesoras, sucesoras, aplicativos y proveedores asociados.</p>
        <div class="stat-row">
          <div class="stat"><b>${totalSalidas()}</b><span>Salidas críticas en alcance</span></div>
          <div class="stat"><b>${totalUnidades()}</b><span>Unidades organizativas</span></div>
          <div class="stat"><b>5</b><span>Jefaturas</span></div>
          <div class="stat"><b>2</b><span>Jefaturas principales</span></div>
        </div>
      </div>
    </div>
    <div class="home-body">
      <div class="card-grid">
        <div class="info-card">
          <h3><span class="num">1</span> Qué es una salida "incluida en alcance"</h3>
          <p>Es una salida crítica del BIA priorizada para continuidad de negocio. Sobre estas 43 salidas debe
          construirse la estrategia y, luego, el plan de continuidad.</p>
        </div>
        <div class="info-card">
          <h3><span class="num">2</span> Cómo usar el compendio en la entrevista</h3>
          <p>Abrí la ficha de la salida antes de reunirte con el referente. El flujograma y las preguntas guía
          te dan el punto de partida para relevar la estrategia de continuidad.</p>
        </div>
        <div class="info-card">
          <h3><span class="num">3</span> Navegación</h3>
          <p>Usá el índice de la izquierda (Jefatura Principal → Jefatura → Unidad → Salida) o el buscador para
          llegar directo a una salida, unidad o aplicativo.</p>
        </div>
      </div>

      <div class="jef-index">
        <h2>Índice por Jefatura</h2>
        ${jpBlocks}
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;
  document.querySelectorAll('.uo-chip[data-first-sid]').forEach(chip=>{
    chip.addEventListener('click', ()=>{ location.hash = '#/salida/' + chip.dataset.firstSid; });
  });
}

function nodeClass(tipo){
  if (tipo === 'Interno') return 'int';
  if (tipo === 'Externo') return 'ext';
  return 'free';
}

function viewSalida(sid){
  const s = state.salidas[sid];
  if (!s){
    document.getElementById('content').innerHTML = `<div class="page"><p>No se encontró la salida #${esc(sid)}.</p></div>`;
    return;
  }

  // Predecesoras: entidades tipadas + texto libre (sin duplicar si ya aparece como entidad)
  const predEntNombres = new Set(s.predecesoras_entidad.map(p=>p.entidad));
  let predHtml = '';
  s.predecesoras_entidad.forEach(p=>{
    predHtml += `<div class="node ${nodeClass(p.tipo)}"><small>${esc(p.tipo)}</small>${esc(p.entidad)}</div>`;
  });
  s.predecesoras_texto.forEach(t=>{
    if (predEntNombres.has(t)) return; // ya mostrado como entidad
    predHtml += `<div class="node free"><small>Insumo / referencia</small>${esc(t)}</div>`;
  });
  if (!predHtml) predHtml = `<div class="flow-col-empty">Sin predecesoras registradas — es punto de inicio del flujo.</div>`;

  // Sucesoras
  let sucHtml = '';
  s.sucesoras.forEach(su=>{
    sucHtml += `<div class="node ${nodeClass(su.tipo)}"><small>${esc(su.tipo)}</small>${esc(su.entidad)}</div>`;
  });
  if (!sucHtml) sucHtml = `<div class="flow-col-empty">Sin sucesoras registradas.</div>`;

  // Pasos
  let stepsHtml = '';
  if (s.actividades.length){
    s.actividades.forEach(a=>{
      stepsHtml += `<div class="step" data-n="${a.orden}"><div class="txt">${esc(a.texto)}</div></div>`;
    });
  } else {
    stepsHtml = `<div class="steps-empty">No hay actividades paso a paso relevadas todavía para esta salida — a completar en la entrevista.</div>`;
  }

  // Aplicativos / procesos / subproductos
  const appsHtml = s.aplicativos.length
    ? s.aplicativos.map(a=>{
        const rpo = s.rpo_detalle.find(r=>r.aplicativo===a);
        return `<span class="tag tag-app">${esc(a)}${rpo ? ' · RPO ' + esc(rpo.rpo) : ''}</span>`;
      }).join('')
    : '<span class="flow-col-empty">Sin aplicativos vinculados.</span>';

  const procHtml = s.procesos_centrales.length
    ? s.procesos_centrales.map(p=>`<span class="tag tag-proc">${esc(p)}</span>`).join('')
    : '';
  const subHtml = s.subproductos.length
    ? s.subproductos.map(p=>`<span class="tag">${esc(p)}</span>`).join('')
    : '';

  // Proveedores
  let provRows = '';
  if (s.proveedores.length){
    s.proveedores
      .slice()
      .sort((a,b)=> (b.servicio_critico==='SI') - (a.servicio_critico==='SI'))
      .forEach(p=>{
        provRows += `<tr>
          <td>${esc(p.proveedor)}</td>
          <td>${esc(p.rubro || '—')}</td>
          <td>${p.servicio_critico==='SI' ? '<span class="crit">Crítico</span>' : '—'}</td>
          <td>${p.vinculo ? `<span class="link-yes">Mencionado en ${esc(p.vinculo)}</span>` : `<span class="link-no">Proveedor de la unidad (sin mención textual en esta salida)</span>`}</td>
        </tr>`;
      });
  }
  const provBlock = s.proveedores.length
    ? `<table class="prov-table"><thead><tr><th>Proveedor</th><th>Rubro</th><th>Servicio</th><th>Vínculo con la salida</th></tr></thead><tbody>${provRows}</tbody></table>`
    : `<p class="flow-col-empty">No hay proveedores relevados para la unidad organizativa de esta salida.</p>`;

  const html = `
    <div class="page">
      <div class="breadcrumb">
        <a href="#/">Inicio</a><span class="sep">/</span>
        <span>${esc(s.jefatura_principal)}</span><span class="sep">/</span>
        <span>${esc(s.jefatura)}</span><span class="sep">/</span>
        <span>${esc(s.unidad_organizativa_agrupada)}</span>
      </div>

      <div class="ficha-head">
        <div>
          <h1>${esc(s.nombre)}</h1>
          <div class="ficha-meta">
            <b>Unidad:</b> ${esc(s.unidad_organizativa_agrupada)} &nbsp;·&nbsp;
            <b>Referente:</b> ${esc(s.referente || '—')} &nbsp;·&nbsp;
            <b>Frecuencia:</b> ${esc(s.frecuencia || '—')}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:10px;">
          <div class="rto-badge"><span class="lbl">RTO</span><span class="val">${esc(s.rto || '—')}</span></div>
          <button class="print-btn" onclick="window.print()">🖨 Imprimir ficha</button>
        </div>
      </div>

      <div class="section-title">Descripción</div>
      <div class="desc-block">${esc(s.descripcion || 'Sin descripción registrada.')}</div>
      ${s.nota_turnos ? `<div class="desc-block" style="border-left-color:var(--gold-500); margin-top:8px; font-style:italic;">🕑 ${esc(s.nota_turnos)}</div>` : ''}

      <div class="tag-row" style="margin-top:14px;">${procHtml}${subHtml}</div>

      <div class="section-title">Flujograma de la salida</div>
      <div class="flow">
        <div class="flow-col pred">
          <div class="flow-col-title">◀ Predecesoras</div>
          ${predHtml}
        </div>
        <div class="flow-col">
          <div class="flow-col-title">Actividades (paso a paso)</div>
          <div class="steps">${stepsHtml}</div>
        </div>
        <div class="flow-col suc">
          <div class="flow-col-title">Sucesoras ▶</div>
          ${sucHtml}
        </div>
      </div>

      <div class="section-title">Aplicativos utilizados</div>
      <div class="tag-row">${appsHtml}</div>

      <div class="section-title">Proveedores de la unidad</div>
      <p style="font-size:11.5px;color:var(--gray-500);margin:0 0 6px;">
        Los proveedores se relevan a nivel Unidad Organizativa en el BIA, no por salida individual.
        Cuando el nombre del proveedor aparece mencionado en el texto de la descripción o de alguna actividad,
        se indica el vínculo puntual; el resto figura como proveedor crítico general de la unidad a confirmar en la entrevista.
      </p>
      ${provBlock}

      <div class="interview-box">
        <h4>Guía rápida para la entrevista de continuidad</h4>
        <ul>
          <li>¿Qué pasa si cada predecesora (${s.predecesoras_entidad.map(p=>esc(p.entidad)).join(', ') || 'la fuente de origen'}) no está disponible? ¿Existe una alternativa manual?</li>
          <li>¿Cuál de las ${s.actividades.length || 'las'} actividades del flujo es la que más tiempo insume o la que depende de una sola persona?</li>
          <li>¿El RTO informado (${esc(s.rto || 'sin dato')}) es realista si falla ${s.aplicativos[0] ? esc(s.aplicativos[0]) : 'el aplicativo principal'}?</li>
          <li>¿Qué proveedor de la tabla anterior es imprescindible para poder ejecutar esta salida en particular?</li>
          <li>¿A quién se le comunica el resultado (sucesoras) si el circuito habitual no está disponible?</li>
        </ul>
      </div>

      <div class="foot-nav">
        <span>${s.comentarios_predecesoras ? '<b>Nota:</b> ' + esc(s.comentarios_predecesoras) : ''}</span>
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;
  expandPathTo(sid);
}

function viewGlosario(){
  const html = `
    <div class="page">
      <div class="breadcrumb"><a href="#/">Inicio</a><span class="sep">/</span><span>Glosario</span></div>
      <h1>Glosario y convenciones</h1>
      <dl>
        <div class="gloss-item"><dt>Salida incluida en alcance</dt>
        <dd>Salida crítica del BIA para la cual se definió (campo "Incorporación en Alcance" = SI) que debe contar
        con estrategia de continuidad y plan asociado. Son 43 sobre el total relevado.</dd></div>

        <div class="gloss-item"><dt>Predecesora</dt>
        <dd>Entidad, unidad o insumo que debe estar disponible antes de poder ejecutar la salida (entrada del proceso).</dd></div>

        <div class="gloss-item"><dt>Sucesora</dt>
        <dd>Entidad o unidad interna/externa que recibe el resultado de la salida (destino del proceso).</dd></div>

        <div class="gloss-item"><dt>RTO (Recovery Time Objective)</dt>
        <dd>Tiempo máximo tolerable de interrupción para esta salida. Es una prioridad temporal de recuperación,
        no un indicador de importancia del negocio en sí.</dd></div>

        <div class="gloss-item"><dt>RPO (Recovery Point Objective)</dt>
        <dd>Antigüedad máxima admisible de los datos al momento de la recuperación, por aplicativo.</dd></div>

        <div class="gloss-item"><dt>M.E.P.</dt>
        <dd>Medio Electrónico de Pagos. Se escribe con puntos, no "MEP".</dd></div>

        <div class="gloss-item"><dt>Entidad Interna / Externa</dt>
        <dd>Interna: otra unidad o sector de BNA. Externa: organismo o contraparte fuera del banco (BCRA, COELSA, ARCA, etc.).</dd></div>

        <div class="gloss-item"><dt>Proveedor de la unidad</dt>
        <dd>Proveedor crítico relevado a nivel Unidad Organizativa. No está atado a una salida puntual en el
        modelo de datos del BIA, por eso se muestra a nivel de unidad en cada ficha.</dd></div>
      </dl>
    </div>
  `;
  document.getElementById('content').innerHTML = html;
}

// ---------------------------------------------------------------
// Router
// ---------------------------------------------------------------
function router(){
  const hash = location.hash || '#/';
  const parts = hash.replace('#/','').split('/').filter(Boolean);
  window.scrollTo(0,0);
  if (parts[0] === 'salida' && parts[1]){
    viewSalida(parts[1]);
  } else if (parts[0] === 'glosario'){
    viewGlosario();
  } else {
    viewHome();
    document.querySelectorAll('.t-salida').forEach(n=>n.classList.remove('active'));
  }
}

// ---------------------------------------------------------------
// Sidebar toggle
// ---------------------------------------------------------------
function setupSidebarToggle(){
  const app = document.querySelector('.app');
  document.getElementById('sidebarToggle').addEventListener('click', ()=> app.classList.add('collapsed'));
  document.getElementById('sidebarToggleCollapsed').addEventListener('click', ()=> app.classList.remove('collapsed'));
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------
(async function init(){
  await loadData();
  renderTree();
  setupSearch();
  setupSidebarToggle();
  window.addEventListener('hashchange', router);
  router();
})();
