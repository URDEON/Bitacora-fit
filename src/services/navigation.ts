import type { ActiveTab } from '../types';

export interface ViewBackController {
  hasActiveEditor: () => boolean;
  closeEditor: () => boolean;
  hasActiveSubview: () => boolean;
  leaveSubview: () => boolean;
}

export interface BackNavigationSnapshot {
  hasOpenDialog: boolean;
  hasVisualModal: boolean;
  hasActiveEditor: boolean;
  hasActiveSubview: boolean;
  currentTab: ActiveTab;
  tabHistory: readonly ActiveTab[];
}

export type BackActionResult =
  | { type: 'dismiss-dialog' }
  | { type: 'close-visual-modal' }
  | { type: 'close-editor' }
  | { type: 'leave-subview' }
  | { type: 'navigate-tab'; tab: ActiveTab; nextHistory: ActiveTab[] }
  | { type: 'exit-app' };

export function pushTabHistory(
  history: readonly ActiveTab[],
  fromTab: ActiveTab,
  toTab: ActiveTab,
  options?: { resetOnHome?: boolean; maxEntries?: number },
): ActiveTab[] {
  if (fromTab === toTab) return [...history];
  if (toTab === 'home' && options?.resetOnHome) return [];
  const maxEntries = options?.maxEntries ?? 24;
  const next = history[history.length - 1] === fromTab ? [...history] : [...history, fromTab];
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
}

export function pushSubviewHistory<T extends string>(
  history: readonly T[],
  fromView: T,
  toView: T,
  rootView: T,
  maxEntries = 12,
): T[] {
  if (fromView === toView) return [...history];
  if (toView === rootView) return [];
  const next = history[history.length - 1] === fromView ? [...history] : [...history, fromView];
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
}

export function popSubviewHistory<T extends string>(
  history: readonly T[],
  currentView: T,
  rootView: T,
): { handled: boolean; nextView: T; nextHistory: T[] } {
  const stack = [...history];
  while (stack.length > 0 && stack[stack.length - 1] === currentView) {
    stack.pop();
  }
  if (stack.length > 0) {
    const nextView = stack.pop()!;
    return { handled: true, nextView, nextHistory: stack };
  }
  if (currentView !== rootView) {
    return { handled: true, nextView: rootView, nextHistory: [] };
  }
  return { handled: false, nextView: currentView, nextHistory: [] };
}

/**
 * Resuelve la acción del botón Atrás respetando estrictamente la prioridad:
 * 1) Diálogo de alerta/confirmación -> 2) Modal visual -> 3) Editor activo ->
 * 4) Subvista -> 5) Historial de navegación -> 6) Salida de la app (solo en Inicio limpio).
 */
export function resolveBackNavigation(snapshot: BackNavigationSnapshot): BackActionResult {
  if (snapshot.hasOpenDialog) return { type: 'dismiss-dialog' };
  if (snapshot.hasVisualModal) return { type: 'close-visual-modal' };
  if (snapshot.hasActiveEditor) return { type: 'close-editor' };
  if (snapshot.hasActiveSubview) return { type: 'leave-subview' };

  const stack = [...snapshot.tabHistory];
  while (stack.length > 0 && stack[stack.length - 1] === snapshot.currentTab) {
    stack.pop();
  }
  if (stack.length > 0) {
    const tab = stack.pop()!;
    return { type: 'navigate-tab', tab, nextHistory: stack };
  }
  if (snapshot.currentTab !== 'home') {
    return { type: 'navigate-tab', tab: 'home', nextHistory: [] };
  }
  return { type: 'exit-app' };
}
