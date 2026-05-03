const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function assessGold(formData) {
  const res = await fetch(`${BASE}/assess`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

export async function fetchHealth() {
  return fetch(`${BASE}/health`).then(r => r.json()).catch(() => ({ status: 'offline' }));
}

export async function fetchConfig() {
  return fetch(`${BASE}/config`).then(r => r.json()).catch(() => ({}));
}

export function getRiskColor(r) {
  if (!r) return 'var(--text-secondary)';
  if (r === 'LOW')    return 'var(--success)';
  if (r === 'MEDIUM') return 'var(--warning)';
  return 'var(--danger)';
}

export function getRecColor(r) {
  if (!r) return 'var(--text-secondary)';
  if (r === 'PRE-APPROVE')   return 'var(--success)';
  if (r === 'MANUAL-REVIEW') return 'var(--warning)';
  return 'var(--danger)';
}

export function getConfLabel(s) {
  if (s >= 0.70) return 'High Confidence';
  if (s >= 0.45) return 'Moderate';
  if (s >= 0.25) return 'Low';
  return 'Very Low';
}

export function formatINR(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
