export type ScopeSelection = {
  type: 'PERSONAL' | 'ORGANIZATION';
  id: string;
  label: string;
};

const KEY = 'lifeos:scope';

export function loadScope(): ScopeSelection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScopeSelection) : null;
  } catch {
    return null;
  }
}

export function saveScope(scope: ScopeSelection) {
  localStorage.setItem(KEY, JSON.stringify(scope));
}
