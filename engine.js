/* SMART SENSI AI — motor de recomendação (puro, sem dependências).
 * Funciona no navegador (window.SensiEngine) e no Node (require).
 * Não toca no jogo: só calcula valores para o jogador digitar manualmente.
 * São heurísticas de ajuste gradual, não garantem resultado: o jogador
 * sempre deve testar e informar o resultado para refinar. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SensiEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PARAMS = ['geral', 'redDot', 'x2', 'x4', 'awm', 'olhadinha'];
  const LABELS = {
    geral: 'Geral', redDot: 'Ponto vermelho', x2: 'Mira 2x',
    x4: 'Mira 4x', awm: 'Mira AWM', olhadinha: 'Olhadinha'
  };
  const SCOPES = ['all', 'redDot', 'x2', 'x4', 'awm'];
  const SYMPTOMS = {
    overshoot: { label: 'A mira ultrapassa a cabeça', dir: -1 },
    chest: { label: 'A mira fica no peito', dir: +1 },
    slowRise: { label: 'A mira sobe lentamente', dir: +1 },
    jitter: { label: 'A mira treme', dir: -0.5 },
    tooFast: { label: 'A mira está muito rápida', dir: -1 },
    tooSlow: { label: 'A mira está muito lenta', dir: +1 },
    inconsistent: { label: 'Comportamento inconsistente', dir: 0 }
  };
  const MAX_STEP = 8;      // variação máxima por parâmetro em cada rodada
  const BASE_STEP = 2;     // pontos por nível de intensidade (1..3)
  const MAX_GAP = 25;      // diferença máxima aceitável entre mira vizinha
  const CHAIN = ['geral', 'redDot', 'x2', 'x4', 'awm'];

  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

  function validate(values) {
    const missing = [];
    for (const p of PARAMS) {
      const v = values && values[p];
      if (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) || v < 0 || v > 100) missing.push(p);
    }
    return missing;
  }

  function scopeWeights(scope) {
    const w = {};
    if (scope === 'all' || !scope) {
      Object.assign(w, { geral: 1, redDot: 0.7, x2: 0.7, x4: 0.7, awm: 0.3, olhadinha: 0.3 });
    } else {
      PARAMS.forEach(p => (w[p] = 0.15));
      w[scope] = 1; w.geral = 0.5;
    }
    return w;
  }

  /* Fator de aprendizado com base no último ajuste e no resultado informado. */
  function feedbackFactor(history, key) {
    const last = (history || []).filter(h => h.key === key && h.result).slice(-1)[0];
    if (!last) return { factor: 1, note: null, flip: false };
    if (last.result === 'better') return { factor: 0.5, note: 'O último ajuste melhorou: passo reduzido para refinar.', flip: false };
    if (last.result === 'same') return { factor: 1.25, note: 'O último ajuste não mudou nada: passo levemente maior.', flip: false };
    if (last.result === 'worse') return { factor: 0.5, note: 'O último ajuste piorou: sentido invertido com passo menor.', flip: true };
    return { factor: 1, note: null, flip: false };
  }

  /* Ajuste de equilíbrio entre mira (cadeia geral >= ponto vermelho >= 2x >= 4x >= AWM). */
  function balanceAdjust(values) {
    const issues = []; const delta = {};
    for (let i = 1; i < CHAIN.length; i++) {
      const a = CHAIN[i - 1], b = CHAIN[i];
      const va = Number(values[a]), vb = Number(values[b]);
      if (vb > va) {
        issues.push(`${LABELS[b]} (${vb}) está acima de ${LABELS[a]} (${va}): mira de maior alcance mais rápida costuma causar passada.`);
        delta[b] = (delta[b] || 0) - Math.min(MAX_STEP, Math.ceil((vb - va) / 2));
      } else if (va - vb > MAX_GAP) {
        issues.push(`Diferença grande entre ${LABELS[a]} (${va}) e ${LABELS[b]} (${vb}): troca de mira fica desconfortável.`);
        delta[b] = (delta[b] || 0) + Math.min(MAX_STEP, Math.ceil((va - vb - MAX_GAP) / 2));
      }
    }
    return { issues, delta };
  }

  function finalize(values, delta) {
    const out = {};
    PARAMS.forEach(p => { out[p] = clamp(Math.round(Number(values[p]) + (delta[p] || 0))); });
    return out;
  }

  /* Diagnóstico A/B/C.  situation: 'above' | 'below' | 'unstable' */
  function diagnose({ values, situation, scope = 'all', severity = 2, history = [] }) {
    const missing = validate(values);
    if (missing.length) return { ok: false, needs: missing, message: 'Informe todos os valores (0–100) antes de analisar.' };
    const notes = []; let delta = {};
    if (situation === 'above' || situation === 'below') {
      const dir = situation === 'above' ? -1 : +1;
      const fb = feedbackFactor(history, 'diag:' + situation);
      const dirF = fb.flip ? -dir : dir;
      if (fb.note) notes.push(fb.note);
      const w = scopeWeights(scope);
      PARAMS.forEach(p => {
        delta[p] = Math.max(-MAX_STEP, Math.min(MAX_STEP, dirF * BASE_STEP * severity * fb.factor * w[p]));
      });
      notes.push(situation === 'above'
        ? 'Possível excesso de sensibilidade: redução gradual, priorizando os parâmetros de maior influência.'
        : 'Possível sensibilidade insuficiente: aumento gradual.');
    } else if (situation === 'unstable') {
      const b = balanceAdjust(values);
      delta = b.delta; notes.push(...b.issues);
      if (!b.issues.length) notes.push('Não encontrei desequilíbrio entre as sensibilidades informadas. A instabilidade pode vir de outros fatores (DPI/toque do aparelho, tela suja, desempenho do celular). Use a calibração com os sintomas observados.');
    } else return { ok: false, needs: ['situation'], message: 'Escolha a situação observada.' };
    return { ok: true, key: 'diag:' + situation, before: { ...values }, after: finalize(values, delta), notes };
  }

  /* Calibração: symptoms = { overshoot: 0..3, ... } (0 = não ocorre). */
  function calibrate({ values, symptoms, scope = 'all', history = [] }) {
    const missing = validate(values);
    if (missing.length) return { ok: false, needs: missing, message: 'Informe todos os valores (0–100) antes de calibrar.' };
    const active = Object.entries(symptoms || {}).filter(([, s]) => s > 0);
    if (!active.length) return { ok: false, needs: ['symptoms'], message: 'Marque ao menos um comportamento observado e a intensidade.' };
    const notes = []; const w = scopeWeights(scope);
    const dirs = active.filter(([k]) => SYMPTOMS[k].dir !== 0).map(([k, s]) => SYMPTOMS[k].dir * s);
    const hasDown = dirs.some(d => d < 0), hasUp = dirs.some(d => d > 0);
    if (hasDown && hasUp) notes.push('Você marcou sintomas opostos (ex.: passa da cabeça e está lenta). Isso costuma indicar desequilíbrio entre mira ou alvo diferente por situação; apliquei só a tendência líquida. Teste uma mira por vez.');
    const fb = feedbackFactor(history, 'calib');
    if (fb.note) notes.push(fb.note);
    const net = dirs.reduce((a, b) => a + b, 0);
    const dir = (net === 0 ? 0 : Math.sign(net)) * (fb.flip ? -1 : 1);
    const mag = Math.min(3, Math.abs(net));
    const delta = {};
    PARAMS.forEach(p => {
      delta[p] = Math.max(-MAX_STEP, Math.min(MAX_STEP, dir * BASE_STEP * mag * fb.factor * w[p]));
    });
    if (symptoms.jitter) notes.push('Tremor: além da redução leve, verifique tela limpa, película, modo de desempenho e temperatura do aparelho.');
    if (symptoms.inconsistent) {
      const b = balanceAdjust(values);
      notes.push(...b.issues);
      Object.entries(b.delta).forEach(([p, d]) => { delta[p] = (delta[p] || 0) + d; });
      if (!b.issues.length) notes.push('Sem desequilíbrio visível nos valores; repita o teste sempre no mesmo cenário (mesma distância/arma) para comparar.');
    }
    PARAMS.forEach(p => { delta[p] = Math.max(-MAX_STEP, Math.min(MAX_STEP, delta[p] || 0)); });
    return { ok: true, key: 'calib', before: { ...values }, after: finalize(values, delta), notes };
  }

  return { PARAMS, LABELS, SCOPES, SYMPTOMS, MAX_STEP, validate, diagnose, calibrate, balanceAdjust };
});
