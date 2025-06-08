import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electronAPI: {
      product: {
        findByCode: (codigo: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        findAll: () => Promise<{ success: boolean; data?: any; error?: string }>;
      };
      sale: {
        create: (vendaData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      };
      barcode: {
        listen: () => Promise<{ success: boolean }>;
        onScanned: (callback: (codigo: string) => void) => void;
        removeListener: () => void;
      };
    };
  }
}

export {};