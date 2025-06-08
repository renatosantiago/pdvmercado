import { useEffect } from 'react';

export function useBarcode(onScanned: (codigo: string) => void) {
  useEffect(() => {
    const electron = (window as any)?.electronAPI?.barcode;
    if (electron) {
      electron.listen();
      electron.onScanned(onScanned);
      return () => {
        electron.removeListener();
      };
    }
  }, [onScanned]);
}
