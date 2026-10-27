import { api } from './api.js';
import { toast } from './ui.js';

export const state = {
  data: null,
  loading: true,
  error: null,
  requiresAuth: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

export async function loadState({ silent = false } = {}) {
  if (!silent && !state.data) {
    state.loading = true;
    emit();
  }
  try {
    state.data = await api('/api/state');
    state.loading = false;
    state.error = null;
    state.requiresAuth = false;
  } catch (error) {
    state.loading = false;
    if (error.status === 401) {
      state.requiresAuth = true;
      state.data = null;
    } else {
      state.error = error.status === 0 ? error.message : error.message;
    }
  }
  emit();
  return state;
}

/** Mutasi + muat ulang state. Listener chrome akan ikut diperbarui. */
export async function apiChange(path, { method = 'POST', body } = {}, successMessage = '') {
  const result = await api(path, { method, body });
  await loadState({ silent: true });
  if (successMessage) toast(successMessage, 'success');
  return result;
}

export function data() {
  return state.data;
}

export function agentById(id) {
  return state.data?.agents.find((a) => a.id === id) || null;
}

export function brandById(id) {
  return state.data?.brands.find((b) => b.id === id) || null;
}

export function missionById(id) {
  return state.data?.missions.find((m) => m.id === id) || null;
}

export function taskById(id) {
  return state.data?.tasks.find((t) => t.id === id) || null;
}

export function docById(id) {
  return state.data?.docs.find((d) => d.id === id) || null;
}

export function chatById(id) {
  return state.data?.chats.find((c) => c.id === id) || null;
}

export function fileById(id) {
  return state.data?.files.find((f) => f.id === id) || null;
}

export function dnaCompleteness(brand) {
  if (!brand) return 0;
  const fields = [
    brand.dna?.brandName,
    brand.dna?.archetype,
    brand.dna?.description,
    brand.dna?.typography,
    brand.dna?.voiceTone,
    brand.dna?.keyMessage,
    brand.dna?.statement,
    brand.dna?.niche,
    brand.dna?.specificNiche,
    brand.dna?.superSpecificNiche,
    brand.dna?.positioning,
  ];
  const palette = brand.dna?.palette?.length ? 1 : 0;
  const personas = brand.personas?.length ? 1 : 0;
  const filled = fields.filter((v) => String(v || '').trim()).length + palette + personas;
  return Math.round((filled / (fields.length + 2)) * 100);
}

export function activeAgents() {
  return state.data?.agents.filter((a) => a.status === 'active') || [];
}
