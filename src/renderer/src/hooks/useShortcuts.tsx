import { useEffect } from 'react';

export function useShortcuts(onShortcut: (key: string) => void) {
  useEffect(() => {
    const shortcuts = (window as any)?.electronAPI?.shortcuts;
    if (shortcuts) {
      shortcuts.onShortcut(onShortcut);
      return () => {
        shortcuts.removeShortcutListener();
      };
    }
  }, [onShortcut]);
}
