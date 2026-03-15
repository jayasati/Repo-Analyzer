/**
 * render.js — Pure DOM rendering functions.
 * Each function receives data and returns/inserts HTML.
 * No API calls here — this is view-only logic.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return 'var(--lime)';
  if (score >= 55) return 'var(--amber)';
  return 'var(--red)';
}

function scoreClass(score) {
  if (score >= 80) return '--good';
  if (score >= 55) return '--warn';
  return '--bad';
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Score hero ────────────────────────────────────────────────────────────────

export function renderScoreHero(data) {
  const score = data.score?.overall ?? 0;
  const circumference = 291;
  const offset = circumference - (score / 100) * circumference;
  const color  = scoreColor(score);

  const arc = document.getElementById('score-arc');
  if (arc) {
    arc.style.stroke = color;
    requestAnimationFrame(() => setTimeout(() => {
      arc.style.strokeDashoffset = offset;
    }, 100));
  }

  const numEl = document.getElementById('score-number');
  if (numEl) {
    numEl.textContent = score;
    numEl.style.color = color;
  }

  const projectEl = document.getElementById('score-project');
  if (projectEl) projectEl.textContent = data.projectName ?? 'Repository';

  const fw   = data.detection?.framework ? ` · ${data.detection.framework}` : '';
  const lang = data.detection?.languages?.[0]?.name ?? '';
  const subEl = document.getElementById('score-sub');
  if (subEl) {
    subEl.innerHTML = escHtml(lang + fw) || '&mdash;';
  }

  const bd = data.score?.breakdown ?? {};
  const pillsEl = document.getElementById('breakdown-pills');
  if (pillsEl) {
    pillsEl.innerHTML = [
      { label: 'modularity', val: bd.modularity },
      { label: 'coupling',   val: bd.coupling },
      { label: 'smells',     val: bd.smells },
    ].map(p => `
      <div class="breakdown-pill">
        <span class="breakdown-pill__label">${p.label}</span>
        <span class="breakdown-pill__val" style="color:${scoreColor(p.val ?? 0)}">${p.val ?? '—'}</span>
      </div>
    `).join('');
  }
}

// ── Detection strip ───────────────────────────────────────────────────────────

export function renderDetection(det) {
  const el = document.getElementById('detection-strip');
  if (!el || !det) return;

  const chips = [
    { label: 'Language',   value: det.languages?.[0]?.name ?? 'unknown', accent: false },
    { label: 'Framework',  value: det.framework ?? 'none',                accent: !!det.framework },
    { label: 'ORM',        value: det.orm ?? 'none',                      accent: !!det.orm },
    { label: 'Depth',      value: det.analysisDepth ?? '—',               accent: false },
    { label: 'Confidence', value: det.languages?.[0]?.confidence != null
        ? `${Math.round(det.languages[0].confidence * 100)}%` : '—',      accent: false },
  ];

  el.innerHTML = chips.map(c => `
    <div class="det-chip">
      <span class="det-chip__label">${c.label}</span>
      <span class="det-chip__value ${c.accent ? '--accent' : ''}">${escHtml(c.value)}</span>
    </div>
  `).join('');
}

// ── Health ────────────────────────────────────────────────────────────────────

export function renderHealth(health) {
  const el = document.getElementById('health-grid');
  if (!el || !health) return;

  const strengths  = health.strengths  ?? [];
  const weaknesses = health.weaknesses ?? [];

  const makeItems = (items, icon, color) =>
    items.length
      ? items.map(i => `
          <div class="health-item">
            <span class="health-item__icon" style="color:${color}">${icon}</span>
            ${escHtml(i)}
          </div>`).join('')
      : `<div class="health-item" style="color:var(--dim)">None identified</div>`;

  el.innerHTML = `
    <div class="health-col">
      <div class="health-col__title">Strengths</div>
      <div class="health-list">${makeItems(strengths, '✓', 'var(--lime)')}</div>
    </div>
    <div class="health-col">
      <div class="health-col__title">Weaknesses</div>
      <div class="health-list">${makeItems(weaknesses, '✕', 'var(--red)')}</div>
    </div>
  `;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export function renderMetrics(metrics) {
  const el = document.getElementById('metric-grid');
  if (!el || !metrics) return;

  const cards = [
    { label: 'Modules',     value: metrics.moduleCount,        unit: 'packages' },
    { label: 'Deps',        value: metrics.dependencyCount,    unit: 'edges' },
    { label: 'Cycles',      value: metrics.cycleCount,         unit: 'detected' },
    { label: 'Avg Fan-In',  value: metrics.averageFanIn,       unit: 'per module' },
    { label: 'Avg Fan-Out', value: metrics.averageFanOut,      unit: 'per module' },
    { label: 'Max Fan-Out', value: metrics.maxFanOut,          unit: 'hotspot' },
    { label: 'Density',     value: metrics.dependencyDensity != null
        ? (metrics.dependencyDensity * 100).toFixed(1) + '%' : '—', unit: 'coupling' },
  ];

  el.innerHTML = cards.map(c => `
    <div class="metric-card">
      <div class="metric-card__label">${c.label}</div>
      <div class="metric-card__value">${c.value ?? '—'}</div>
      <div class="metric-card__unit">${c.unit}</div>
    </div>
  `).join('');
}

// ── Smells ────────────────────────────────────────────────────────────────────

export function renderSmells(smells) {
  const countEl = document.getElementById('smell-count');
  const listEl  = document.getElementById('smells-list');
  if (!listEl) return;

  smells = smells ?? [];
  if (countEl) countEl.textContent = smells.length;

  if (!smells.length) {
    listEl.innerHTML = `<div class="empty-state">No architecture smells detected</div>`;
    return;
  }

  listEl.innerHTML = `<div class="issue-list">` +
    smells.map(s => `
      <div class="issue-item --${s.severity}">
        <span class="issue-item__badge badge--${s.severity}">${escHtml(s.severity)}</span>
        <div class="issue-item__body">
          <div class="issue-item__message">${escHtml(s.message)}</div>
          <div class="issue-item__type">${escHtml(s.type)}</div>
        </div>
      </div>`).join('') + `</div>`;
}

// ── Cycles ────────────────────────────────────────────────────────────────────

export function renderCycles(cycles) {
  const countEl = document.getElementById('cycle-count');
  const listEl  = document.getElementById('cycles-list');
  if (!listEl) return;

  cycles = cycles ?? [];
  if (countEl) countEl.textContent = cycles.length;

  if (!cycles.length) {
    listEl.innerHTML = `<div class="empty-state">No circular dependencies detected</div>`;
    return;
  }

  listEl.innerHTML = `<div class="issue-list">` +
    cycles.map(c => `
      <div class="issue-item --cycle">
        <span class="issue-item__badge badge--cycle">cycle</span>
        <div class="issue-item__body">
          <div class="issue-item__path">${c.nodes.map(escHtml).join(' → ')}</div>
        </div>
      </div>`).join('') + `</div>`;
}

// ── Hotspots ──────────────────────────────────────────────────────────────────

export function renderHotspots(hotspots) {
  const countEl = document.getElementById('hotspot-count');
  const listEl  = document.getElementById('hotspots-list');
  if (!listEl) return;

  hotspots = hotspots ?? [];
  if (countEl) countEl.textContent = hotspots.length;

  if (!hotspots.length) {
    listEl.innerHTML = `<div class="empty-state">No hotspots detected</div>`;
    return;
  }

  listEl.innerHTML = `<div class="hotspot-list">` +
    hotspots.map(h => `
      <div class="hotspot-item --${h.risk}">
        <span class="issue-item__badge badge--${h.risk}">${escHtml(h.risk)}</span>
        <span class="hotspot-item__module">${escHtml(h.module)}</span>
        <span class="hotspot-item__fanout">fan-out: ${h.fanOut}</span>
      </div>`).join('') + `</div>`;
}

// ── Baseline ──────────────────────────────────────────────────────────────────

export function renderBaseline(baseline) {
  const listEl = document.getElementById('baseline-list');
  if (!listEl) return;

  baseline = baseline ?? [];
  if (!baseline.length) {
    listEl.innerHTML = `<div class="empty-state">No baseline data</div>`;
    return;
  }

  const top8 = baseline.slice(0, 8);
  listEl.innerHTML = top8.map((b, i) => {
    const pct = Math.round(b.similarity * 100);
    const isTop = i === 0;
    return `
      <div class="baseline-item ${isTop ? '--top' : ''}">
        ${isTop ? `<span class="baseline-item__top-tag">best match</span>` : ''}
        <span class="baseline-item__name">${escHtml(b.name)}</span>
        <div class="baseline-item__bar-track">
          <div class="baseline-item__bar-fill" data-pct="${pct}"></div>
        </div>
        <span class="baseline-item__pct">${pct}%</span>
      </div>`;
  }).join('');

  // Animate bars after DOM insert
  requestAnimationFrame(() => setTimeout(() => {
    listEl.querySelectorAll('.baseline-item__bar-fill').forEach(el => {
      el.style.width = el.dataset.pct + '%';
    });
  }, 80));
}

// ── Confidence ────────────────────────────────────────────────────────────────

export function renderConfidence(confidence) {
  const el = document.getElementById('confidence-section');
  if (!el || !confidence) return;

  const pct = Math.round(confidence.score * 100);
  const f   = confidence.factors ?? {};

  el.innerHTML = `
    <div class="confidence-card">
      <div class="confidence-card__label">Analysis Confidence</div>
      <div class="confidence-card__value" style="color:${scoreColor(pct)}">${pct}%</div>
      <div class="confidence-bar-track">
        <div class="confidence-bar-fill" data-pct="${pct}"></div>
      </div>
      <div class="confidence-factors">
        <div class="confidence-factor">
          <span class="confidence-factor__name">Repo Size</span>
          <span class="confidence-factor__val">${f.repoSizeFactor ?? '—'}</span>
        </div>
        <div class="confidence-factor">
          <span class="confidence-factor__name">Stability</span>
          <span class="confidence-factor__val">${f.stability ?? '—'}</span>
        </div>
        <div class="confidence-factor">
          <span class="confidence-factor__name">Cycle Penalty</span>
          <span class="confidence-factor__val">${f.cyclePenalty ?? '—'}</span>
        </div>
        <div class="confidence-factor">
          <span class="confidence-factor__name">Smell Penalty</span>
          <span class="confidence-factor__val">${f.smellPenalty ?? '—'}</span>
        </div>
      </div>
    </div>`;

  requestAnimationFrame(() => setTimeout(() => {
    el.querySelector('.confidence-bar-fill')?.style.setProperty('width', pct + '%');
  }, 80));
}

// ── Diagrams ──────────────────────────────────────────────────────────────────

function syntaxHighlight(code) {
  const arrows = ['-->', '->>', '->'];
  let out = escHtml(code)
    .replace(/@startuml|@enduml/g, m => `<span class="kw">${m}</span>`)
    .replace(/\b(class|component|participant)\b/g, m => `<span class="kw">${m}</span>`);

  arrows.forEach(ar => {
    out = out.split(escHtml(ar)).join(`<span class="ar">${escHtml(ar)}</span>`);
  });

  return out.replace(/\b([A-Z][A-Za-z0-9]+)\b/g, m => `<span class="nm">${m}</span>`);
}

export function renderDiagrams(diagrams) {
  const el = document.getElementById('diagrams-list');
  if (!el) return;

  const entries = [
    { key: 'classDiagram',     label: 'Class Diagram' },
    { key: 'componentDiagram', label: 'Component Diagram' },
    { key: 'sequenceDiagram',  label: 'Sequence Diagram' },
  ].filter(e => diagrams?.[e.key]);

  if (!entries.length) {
    el.innerHTML = `<div class="empty-state">No diagrams generated</div>`;
    return;
  }

  el.innerHTML = entries.map(e => `
    <div class="diagram-block" id="diag-${e.key}">
      <div class="diagram-block__header" onclick="window._toggleDiagram('${e.key}')">
        <span class="diagram-block__title">${e.label}</span>
        <span class="diagram-block__toggle">
          expand
          <span class="diagram-block__toggle-icon">▾</span>
        </span>
      </div>
      <div class="diagram-block__body">
        <pre class="diagram-block__code">${syntaxHighlight(diagrams[e.key])}</pre>
      </div>
    </div>
  `).join('');
}

// ── Toggle diagram ────────────────────────────────────────────────────────────

export function toggleDiagram(key) {
  const block = document.getElementById(`diag-${key}`);
  if (!block) return;
  block.classList.toggle('--open');
  const toggleText = block.querySelector('.diagram-block__toggle');
  if (toggleText) {
    const isOpen = block.classList.contains('--open');
    toggleText.innerHTML = `${isOpen ? 'collapse' : 'expand'} <span class="diagram-block__toggle-icon">${isOpen ? '▴' : '▾'}</span>`;
  }
}

// ── Full render ───────────────────────────────────────────────────────────────

export function renderResults(data) {
  renderScoreHero(data);
  renderDetection(data.detection);
  renderHealth(data.health);
  renderMetrics(data.metrics);
  renderSmells(data.smells);
  renderCycles(data.cycles);
  renderHotspots(data.hotspots);
  renderBaseline(data.baseline);
  renderConfidence(data.confidence);
  renderDiagrams(data.diagrams);

  const results = document.getElementById('results');
  if (results) {
    results.classList.add('--active');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}