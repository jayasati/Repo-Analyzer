/**
 * ui.js — UI state: loading steps, error display, status pill.
 */

const STEPS = [
  'Scanning repository...',
  'Building dependency graph...',
  'Running cycle detection...',
  'Detecting architecture smells...',
  'Computing metrics & scores...',
  'Generating diagrams...',
  'Assembling report...',
];

let _stepInterval = null;

// ── Status pill ───────────────────────────────────────────────────────────────

export function setConnectionStatus(online) {
  const pill  = document.getElementById('status-pill');
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  if (!pill || !dot || !label) return;

  if (online) {
    pill.classList.add('connected');
    label.textContent = 'connected';
  } else {
    pill.classList.remove('connected');
    label.textContent = 'disconnected';
  }
}

// ── Loading animation ─────────────────────────────────────────────────────────

export function startLoading() {
  const wrap  = document.getElementById('loading-wrap');
  const steps = document.getElementById('loading-steps');
  const fill  = document.getElementById('loading-fill');
  if (!wrap || !steps || !fill) return;

  // Reset
  wrap.classList.add('--active');
  fill.style.width = '4%';
  steps.innerHTML = STEPS.map((text, i) => `
    <div class="loading-step" id="step-${i}">
      <span class="loading-step__icon" id="step-icon-${i}">○</span>
      <span>${text}</span>
    </div>
  `).join('');

  let current = 0;
  _stepInterval = setInterval(() => {
    if (current >= STEPS.length) return;

    // Mark previous done
    if (current > 0) {
      const prev = document.getElementById(`step-${current - 1}`);
      const prevIcon = document.getElementById(`step-icon-${current - 1}`);
      if (prev) prev.className = 'loading-step --done';
      if (prevIcon) prevIcon.textContent = '✓';
    }

    // Activate current
    const cur     = document.getElementById(`step-${current}`);
    const curIcon = document.getElementById(`step-icon-${current}`);
    if (cur) cur.className = 'loading-step --active';
    if (curIcon) {
      curIcon.innerHTML = '<span class="spinner"></span>';
    }

    fill.style.width = `${8 + (current / STEPS.length) * 80}%`;
    current++;
  }, 800);
}

export function stopLoading(success = true) {
  clearInterval(_stepInterval);
  _stepInterval = null;

  const fill = document.getElementById('loading-fill');
  if (fill) fill.style.width = success ? '100%' : '0%';

  if (success) {
    STEPS.forEach((_, i) => {
      const step = document.getElementById(`step-${i}`);
      const icon = document.getElementById(`step-icon-${i}`);
      if (step) step.className = 'loading-step --done';
      if (icon) icon.textContent = '✓';
    });
  }

  setTimeout(() => {
    const wrap = document.getElementById('loading-wrap');
    if (wrap) wrap.classList.remove('--active');
  }, success ? 700 : 300);
}

// ── Error display ─────────────────────────────────────────────────────────────

export function showError(message) {
  const errorEl = document.getElementById('error-area');
  if (!errorEl) return;

  errorEl.innerHTML = `
    <div class="error-box">
      <span class="error-box__icon">✕</span>
      <div class="error-box__msg">${message}</div>
    </div>`;
}

export function clearError() {
  const errorEl = document.getElementById('error-area');
  if (errorEl) errorEl.innerHTML = '';
}

// ── Disable/enable analyze button ─────────────────────────────────────────────

export function setAnalyzeDisabled(disabled) {
  const btn = document.getElementById('analyze-btn');
  if (btn) btn.disabled = disabled;
}

// ── Clear results ─────────────────────────────────────────────────────────────

export function clearResults() {
  const results = document.getElementById('results');
  if (results) results.classList.remove('--active');
}