/**
 * app.js — Main entry point.
 * Wires API, UI, and render modules together.
 */

import { pingBackend, analyzeRepo, normalizeInput } from './api.js';
import { renderResults, toggleDiagram }             from './render.js';
import {
  setConnectionStatus,
  startLoading,
  stopLoading,
  showError,
  clearError,
  setAnalyzeDisabled,
  clearResults,
} from './ui.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

(async function init() {
  // Expose diagram toggle globally (called from inline onclick in render.js HTML)
  window._toggleDiagram = toggleDiagram;

  // Check backend connection
  const online = await pingBackend();
  setConnectionStatus(online);

  // Periodically re-check connection
  setInterval(async () => {
    setConnectionStatus(await pingBackend());
  }, 15_000);

  // Wire analyze button
  const btn   = document.getElementById('analyze-btn');
  const input = document.getElementById('url-input');

  if (btn)   btn.addEventListener('click', runAnalysis);
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter') runAnalysis();
  });
})();

// ── Run analysis ──────────────────────────────────────────────────────────────

async function runAnalysis() {
  const input  = document.getElementById('url-input');
  const rawVal = input?.value ?? '';
  const source = normalizeInput(rawVal);

  clearError();
  clearResults();

  if (!source) {
    showError('Please enter a GitHub URL (e.g. https://github.com/owner/repo) or an owner/repo shorthand.');
    return;
  }

  setAnalyzeDisabled(true);
  startLoading();
  setConnectionStatus(true);

  try {
    const data = await analyzeRepo(source);
    stopLoading(true);
    renderResults(data);
    setConnectionStatus(true);
  } catch (err) {
    stopLoading(false);
    setConnectionStatus(false);

    const isNetworkErr = err instanceof TypeError && err.message.includes('fetch');
    const hint = isNetworkErr
      ? ' — Is the backend running? Start it with: npm run start:dev'
      : '';

    showError((err.message ?? 'Analysis failed') + hint);
  } finally {
    setAnalyzeDisabled(false);
  }
}