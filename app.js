/* SMART SENSI AI — interface. Tudo local (localStorage), offline, sem rede. */
(function () {
  const E = window.SensiEngine;
  const KEY = 'smartsensi.v1';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emptyVals = () => ({ geral: '', redDot: '', x2: '', x4: '', awm: '', olhadinha: '' });
  const PRESETS = ['Celular Android', 'iPhone', 'Curta distância', 'Média distância', 'Longa distância', 'Precisão ponto vermelho', 'Precisão 2x e 4x', 'Personalizado'];

  let S = load();
  let tab = 'home';
  let ui = { situation: 'above', scope: 'all', severity: 2, symptoms: {}, result: null, resultType: null, dpiNote: '' };
  let device = { os: '—', model: '—', res: '—', hz: 'medindo…', dpr: window.devicePixelRatio || 1 };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.values) return s;
    } catch (e) {}
    return { values: emptyVals(), model: '', dpi: '', profiles: [], active: null, history: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Não foi possível salvar neste navegador.'); } }
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }

  /* ---------- dispositivo ---------- */
  function detectDevice() {
    const ua = navigator.userAgent || '';
    device.os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : (navigator.platform || '—');
    const m = ua.match(/Android[^;]*;\s*([^;)]+)\sBuild|Android[^;]*;\s*([^;)]+)\)/);
    device.model = (m && (m[1] || m[2])) || (device.os === 'iOS' ? 'iPhone (modelo não exposto pelo sistema)' : '—');
    const sw = Math.round(screen.width * device.dpr), sh = Math.round(screen.height * device.dpr);
    device.res = `${sw}×${sh} px (${screen.width}×${screen.height} pt, ${device.dpr}x)`;
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['model']).then(r => { if (r.model) { device.model = r.model; if (tab === 'home') render(); } }).catch(() => {});
    }
    let n = 0, t0 = 0;
    function f(ts) {
      if (!t0) t0 = ts;
      if (++n < 40) return requestAnimationFrame(f);
      const hz = 1000 / ((ts - t0) / (n - 1));
      const std = [30, 48, 60, 90, 120, 144];
      device.hz = '~' + std.reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a) + ' Hz (estimada)';
      if (tab === 'home') render();
    }
    requestAnimationFrame(f);
  }

  /* ---------- gráficos ---------- */
  function barChart(values) {
    const P = E.PARAMS, w = 300, h = 130;
    const bw = 34, gap = (w - P.length * bw) / (P.length + 1);
    let s = `<svg viewBox="0 0 ${w} ${h + 22}" width="100%" role="img" aria-label="Gráfico da configuração atual"><defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>`;
    P.forEach((p, i) => {
      const v = Number(values[p]); const ok = values[p] !== '' && !isNaN(v);
      const bh = ok ? v / 100 * h : 0, x = gap + i * (bw + gap);
      s += `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" rx="5" fill="url(#g)"/>`;
      s += `<text x="${x + bw / 2}" y="${h - bh - 4}" text-anchor="middle">${ok ? v : '—'}</text>`;
      s += `<text x="${x + bw / 2}" y="${h + 14}" text-anchor="middle">${esc(E.LABELS[p].replace('Mira ', '').replace('Ponto vermelho', 'P.verm.'))}</text>`;
    });
    return s + '</svg>';
  }
  function lineChart(entries) {
    if (entries.length < 2) return '<div class="info">O gráfico aparece quando houver ao menos 2 ajustes aplicados.</div>';
    const w = 300, h = 120, colors = ['#3b82f6', '#8b5cf6', '#34d399', '#fbbf24', '#f87171', '#22d3ee'];
    let s = `<svg viewBox="0 0 ${w} ${h + 20}" width="100%" role="img" aria-label="Evolução dos valores aplicados">`;
    E.PARAMS.forEach((p, k) => {
      const pts = entries.map((e, i) => `${(i / (entries.length - 1)) * (w - 20) + 10},${h - Number(e.after[p]) / 100 * h}`).join(' ');
      s += `<polyline points="${pts}" fill="none" stroke="${colors[k]}" stroke-width="2"/>`;
    });
    s += E.PARAMS.map((p, k) => `<text x="${6 + k * 49}" y="${h + 16}" style="fill:${colors[k]}">${esc(E.LABELS[p].replace('Mira ', ''))}</text>`).join('');
    return s + '</svg>';
  }

  /* ---------- telas ---------- */
  function sliderRow(p) {
    const v = S.values[p];
    return `<label>${esc(E.LABELS[p])}</label><div class="slider"><input type="range" min="0" max="100" data-r="${p}" value="${v === '' ? 50 : v}"><input type="number" inputmode="numeric" min="0" max="100" data-n="${p}" value="${esc(v)}" placeholder="—"></div>`;
  }
  const missingList = () => E.validate(S.values).map(p => E.LABELS[p]);

  function vHome() {
    const miss = missingList();
    return `
    <div class="card"><h3>Dispositivo</h3>
      <div class="row"><span>Sistema</span><b>${esc(device.os)}</b></div>
      <div class="row"><span>Modelo</span><b>${esc(S.model || device.model)}</b></div>
      <div class="row"><span>Resolução</span><b>${esc(device.res)}</b></div>
      <div class="row"><span>Taxa de atualização</span><b>${esc(device.hz)}</b></div>
      <label>Modelo manual (se o sistema não informar)</label>
      <input type="text" id="model" value="${esc(S.model)}" placeholder="Ex.: Galaxy A54">
    </div>
    <div class="card"><h3>Configuração atual</h3>${barChart(S.values)}
      ${miss.length ? `<div class="note">Faltam valores: ${esc(miss.join(', '))}. Preencha na aba Sensi.</div>` : '<div class="info">Valores completos.</div>'}
    </div>
    <div class="card"><h3>Painel de diagnóstico</h3>
      <div class="info">${S.history.length} ajuste(s) no histórico · ${S.profiles.length} perfil(is) salvo(s).</div>
      <button class="btn" data-go="diag">Análise inteligente</button>
      <button class="btn sec" data-go="calib">Gerar sensibilidade (calibração)</button>
    </div>
    <div class="card"><h3>DPI (somente informação)</h3>
      <div class="info">Densidade estimada pela tela: ~${Math.round(device.dpr * 160)} dpi (${device.dpr}x). Este app não lê nem altera o DPI do aparelho ou do jogo. Recomendação: mantenha o DPI padrão do sistema e ajuste a mira apenas pela sensibilidade dentro do jogo.</div>
      <label>DPI que você usa (opcional, apenas registro)</label>
      <input type="number" id="dpi" inputmode="numeric" value="${esc(S.dpi)}" placeholder="Ex.: 420">
    </div>
    <div class="card"><h3>Segurança</h3><div class="info">Ferramenta externa: não injeta código, não lê memória do jogo, não usa macro, overlay nem automação de toque e não altera nada no Free Fire. Você digita os valores manualmente. Nenhum método elimina por completo o risco de punição por parte do jogo; por isso o app evita qualquer interferência.</div></div>`;
  }

  function vSensi() {
    return `<div class="card"><h3>Sensibilidades (0–100)</h3>${E.PARAMS.map(sliderRow).join('')}
      <div class="info" style="margin-top:10px">Digite os valores que você usa hoje no Free Fire. Ajuste cada um individualmente.</div>
      <button class="btn" id="saveProfile">Salvar no perfil${S.active ? ' ativo' : ''}</button>
      <button class="btn sec" id="clearVals">Limpar valores</button></div>`;
  }

  function recTable(r) {
    let h = '<div class="rec"><b>Parâmetro</b><span>Atual</span><span></span><b>Novo</b>';
    E.PARAMS.forEach(p => {
      const d = r.after[p] - Number(r.before[p]);
      h += `<span>${esc(E.LABELS[p])}</span><span>${esc(r.before[p])}</span><span class="${d > 0 ? 'up' : d < 0 ? 'down' : 'eq'}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '='}</span><b>${r.after[p]}</b>`;
    });
    return h + '</div>';
  }
  function resultCard() {
    const r = ui.result; if (!r) return '';
    if (!r.ok) return `<div class="card"><div class="err">${esc(r.message)}</div></div>`;
    const same = E.PARAMS.every(p => r.after[p] === Number(r.before[p]));
    return `<div class="card"><h3>Recomendação</h3>${recTable(r)}${r.notes.map(n => `<div class="note">${esc(n)}</div>`).join('')}
      ${same ? '<div class="info">Nenhuma mudança necessária com os dados informados.</div>' : ''}
      <div class="info" style="margin-top:8px">Digite estes valores manualmente no jogo e teste. Nada é aplicado automaticamente. Depois volte ao Histórico e marque se melhorou, ficou igual ou piorou.</div>
      <button class="btn" id="applyRec">Registrar e usar como configuração atual</button></div>`;
  }
  const scopeChips = () => `<label>Em qual mira ocorre?</label><div class="chips">${E.SCOPES.map(s => `<button class="chip ${ui.scope === s ? 'on' : ''}" data-scope="${s}">${s === 'all' ? 'Todas' : esc(E.LABELS[s])}</button>`).join('')}</div>`;

  function vDiag() {
    const sit = [['above', 'A) Passa por cima da cabeça'], ['below', 'B) Para abaixo da cabeça'], ['unstable', 'C) Fica instável']];
    return `<div class="card"><h3>Análise inteligente</h3>
      <div class="chips">${sit.map(([k, l]) => `<button class="chip ${ui.situation === k ? 'on' : ''}" data-sit="${k}">${l}</button>`).join('')}</div>
      ${ui.situation !== 'unstable' ? scopeChips() + `<label>Intensidade do problema (1 leve – 3 forte)</label><div class="chips">${[1, 2, 3].map(n => `<button class="chip ${ui.severity === n ? 'on' : ''}" data-sev="${n}">${n}</button>`).join('')}</div>` : ''}
      <button class="btn" id="runDiag">Analisar</button>
      ${missingList().length ? `<div class="note">Preencha primeiro: ${esc(missingList().join(', '))} (aba Sensi).</div>` : ''}</div>${ui.resultType === 'diag' ? resultCard() : ''}`;
  }

  function vCalib() {
    return `<div class="card"><h3>Assistente de calibração</h3>
      <div class="info">Teste em um treino, sempre no mesmo cenário, e marque o que observou (0 = não ocorre).</div>
      ${Object.entries(E.SYMPTOMS).map(([k, s]) => `<div class="sym"><div>${esc(s.label)}</div><div class="lv">${[0, 1, 2, 3].map(n => `<button data-sy="${k}" data-lv="${n}" class="${(ui.symptoms[k] || 0) === n ? 'on' : ''}">${n === 0 ? 'Não' : n}</button>`).join('')}</div></div>`).join('')}
      ${scopeChips()}
      <button class="btn" id="runCalib">Calcular recomendação</button></div>${ui.resultType === 'calib' ? resultCard() : ''}`;
  }

  function vProfiles() {
    const list = S.profiles.map(p => `<div class="card"><b>${esc(p.name)}</b> ${S.active === p.id ? '<span class="up">• ativo</span>' : ''}<div class="info">${esc(p.tag)} · ${E.PARAMS.map(k => E.LABELS[k].replace('Mira ', '') + ' ' + esc(p.values[k] === '' ? '—' : p.values[k])).join(' · ')}</div>
      <button class="btn sm" data-pa="use" data-id="${p.id}">Usar</button><button class="btn sm sec" data-pa="dup" data-id="${p.id}">Duplicar</button><button class="btn sm sec" data-pa="ren" data-id="${p.id}">Renomear</button><button class="btn sm sec" data-pa="rest" data-id="${p.id}">Restaurar original</button><button class="btn sm bad" data-pa="del" data-id="${p.id}">Excluir</button></div>`).join('');
    return `<div class="card"><h3>Novo perfil</h3><label>Nome</label><input type="text" id="pname" placeholder="Ex.: Minha sensi AWM">
      <label>Tipo</label><select id="ptag">${PRESETS.map(p => `<option>${esc(p)}</option>`).join('')}</select>
      <div class="info" style="margin-top:6px">O perfil guarda os valores atuais da aba Sensi.</div>
      <button class="btn" id="mkProfile">Criar perfil</button></div>${list || '<div class="info">Nenhum perfil ainda.</div>'}
      <div class="card"><h3>Backup</h3><button class="btn sec" id="exp">Exportar dados (JSON)</button><label>Importar (cole o JSON)</label><input type="text" id="impTxt"><button class="btn sec" id="imp">Importar</button></div>`;
  }

  function vHistory() {
    const applied = S.history.filter(h => h.applied);
    const items = S.history.slice().reverse().map(h => `<div class="card"><b>${h.type === 'calib' ? 'Calibração' : 'Análise'}</b> <span class="info">${new Date(h.ts).toLocaleString('pt-BR')}</span>
      <div class="info">${E.PARAMS.map(p => `${esc(E.LABELS[p].replace('Mira ', ''))}: ${esc(h.before[p])}→${h.after[p]}`).join(' · ')}</div>
      <div class="info">Resultado: ${h.result ? { better: 'melhorou', same: 'igual', worse: 'piorou' }[h.result] : 'não informado'}</div>
      <button class="btn sm ${h.result === 'better' ? '' : 'sec'}" data-res="better" data-id="${h.id}">Melhorou</button><button class="btn sm ${h.result === 'same' ? '' : 'sec'}" data-res="same" data-id="${h.id}">Igual</button><button class="btn sm ${h.result === 'worse' ? '' : 'sec'}" data-res="worse" data-id="${h.id}">Piorou</button><button class="btn sm bad" data-hdel="${h.id}">Apagar</button></div>`).join('');
    return `<div class="card"><h3>Evolução</h3>${lineChart(applied)}</div>${items || '<div class="info">Sem ajustes registrados.</div>'}`;
  }

  const VIEWS = { home: vHome, sensi: vSensi, diag: vDiag, calib: vCalib, profiles: vProfiles, history: vHistory };
  function render() {
    $('#view').innerHTML = VIEWS[tab]();
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  }
  function go(t) { tab = t; ui.result = null; ui.resultType = null; render(); window.scrollTo(0, 0); }

  /* ---------- ações ---------- */
  function parseVal(v) { if (v === '') return ''; const n = Math.round(Number(v)); return isNaN(n) ? '' : Math.max(0, Math.min(100, n)); }
  function currentKey() { return ui.resultType === 'calib' ? 'calib' : ui.result && ui.result.key; }
  function applyRec() {
    const r = ui.result; if (!r || !r.ok) return;
    S.history.push({ id: uid(), ts: Date.now(), key: r.key, type: ui.resultType, before: r.before, after: r.after, notes: r.notes, applied: true, result: null });
    S.values = { ...r.after };
    if (S.active) { const p = S.profiles.find(x => x.id === S.active); if (p) p.values = { ...r.after }; }
    save(); toast('Registrado. Digite os valores no jogo e teste.'); go('history');
  }
  function mkProfile(name, tag) {
    const p = { id: uid(), name: name || tag, tag, values: { ...S.values }, original: { ...S.values }, updated: Date.now() };
    S.profiles.push(p); S.active = p.id; save(); return p;
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.tab) return go(d.tab);
    if (d.go) return go(d.go);
    if (d.sit) { ui.situation = d.sit; ui.result = null; return render(); }
    if (d.scope) { ui.scope = d.scope; return render(); }
    if (d.sev) { ui.severity = +d.sev; return render(); }
    if (d.sy) { ui.symptoms[d.sy] = +d.lv; return render(); }
    if (t.id === 'runDiag') { ui.result = E.diagnose({ values: S.values, situation: ui.situation, scope: ui.scope, severity: ui.severity, history: S.history }); ui.resultType = 'diag'; return render(); }
    if (t.id === 'runCalib') { ui.result = E.calibrate({ values: S.values, symptoms: ui.symptoms, scope: ui.scope, history: S.history }); ui.resultType = 'calib'; return render(); }
    if (t.id === 'applyRec') return applyRec();
    if (t.id === 'clearVals') { S.values = emptyVals(); save(); return render(); }
    if (t.id === 'saveProfile') {
      const p = S.profiles.find(x => x.id === S.active);
      if (p) { p.values = { ...S.values }; p.updated = Date.now(); save(); toast('Perfil atualizado.'); }
      else { mkProfile('', 'Personalizado'); toast('Perfil criado.'); }
      return;
    }
    if (t.id === 'mkProfile') { mkProfile($('#pname').value.trim(), $('#ptag').value); toast('Perfil criado.'); return render(); }
    if (d.pa) {
      const p = S.profiles.find(x => x.id === d.id); if (!p) return;
      if (d.pa === 'use') { S.values = { ...p.values }; S.active = p.id; toast('Perfil carregado.'); }
      if (d.pa === 'dup') S.profiles.push({ ...p, id: uid(), name: p.name + ' (cópia)', values: { ...p.values }, original: { ...p.original }, updated: Date.now() });
      if (d.pa === 'ren') { const n = prompt('Novo nome:', p.name); if (n && n.trim()) p.name = n.trim(); }
      if (d.pa === 'rest') { if (confirm('Voltar este perfil aos valores com que foi criado?')) { p.values = { ...p.original }; if (S.active === p.id) S.values = { ...p.original }; } }
      if (d.pa === 'del') { if (confirm('Excluir perfil?')) { S.profiles = S.profiles.filter(x => x.id !== p.id); if (S.active === p.id) S.active = null; } }
      save(); return render();
    }
    if (d.res) { const h = S.history.find(x => x.id === d.id); if (h) { h.result = d.res; save(); render(); } return; }
    if (d.hdel) { if (confirm('Apagar este registro?')) { S.history = S.history.filter(x => x.id !== d.hdel); save(); render(); } return; }
    if (t.id === 'exp') { const j = JSON.stringify(S); try { navigator.clipboard.writeText(j); toast('JSON copiado.'); } catch (e) { prompt('Copie o JSON:', j); } return; }
    if (t.id === 'imp') {
      try { const o = JSON.parse($('#impTxt').value); if (!o.values || !Array.isArray(o.profiles) || !Array.isArray(o.history)) throw 0; S = o; save(); toast('Importado.'); render(); }
      catch (e) { toast('JSON inválido.'); } return;
    }
  });
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.r) { S.values[t.dataset.r] = parseVal(t.value); const n = document.querySelector(`[data-n="${t.dataset.r}"]`); if (n) n.value = S.values[t.dataset.r]; save(); }
    if (t.dataset.n) { S.values[t.dataset.n] = parseVal(t.value); const r = document.querySelector(`[data-r="${t.dataset.n}"]`); if (r && S.values[t.dataset.n] !== '') r.value = S.values[t.dataset.n]; save(); }
    if (t.id === 'model') { S.model = t.value; save(); }
    if (t.id === 'dpi') { S.dpi = t.value; save(); }
  });

  detectDevice(); render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
