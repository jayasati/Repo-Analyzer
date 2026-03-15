/**
 * api.js — Backend communication layer
 * All fetch calls go through here. Change API_BASE to point at your server.
 */

const API_BASE = 'http://localhost:3000';

/**
 * HEAD ping to check if the backend is alive.
 * @returns {Promise<boolean>}
 */
export async function pingBackend() {
  try {
    await fetch(API_BASE, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2500),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /analyze — run a full analysis on a repo URL or local path.
 * @param {string} source  GitHub URL or local path
 * @returns {Promise<Object>}  PipelineResult JSON
 */
export async function analyzeRepo(source) {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
    signal: AbortSignal.timeout(120_000), // 2 min – GitHub clone can be slow
  });

  if (!response.ok) {
    let errorMessage;
    try {
      const body = await response.json();
      errorMessage = body?.message ?? `Server error ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status} — ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Normalise raw user input into a full GitHub URL or return it as-is.
 * Accepts:
 *   - Full URLs:     https://github.com/owner/repo
 *   - Short form:   owner/repo
 *   - Local paths:  /home/user/project
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeInput(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  // Already a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Absolute local path
  if (trimmed.startsWith('/') || trimmed.match(/^[A-Za-z]:\\/)) {
    return trimmed;
  }

  // owner/repo short form
  if (trimmed.includes('/') && !trimmed.startsWith('.')) {
    return `https://github.com/${trimmed}`;
  }

  return null;
}