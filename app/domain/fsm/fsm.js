import { TRANSITIONS } from './transitions.js';

export function canTransition(from, to) {
  if (!from) return true;
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
