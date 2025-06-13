import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// ✅ APIS CORRIGIDAS - RETORNANDO FUNÇÕES DE CLEANUP
const api = {
  // Produtos
  product: {
    findByCode: (codigo: string) => ipcRenderer.invoke('product:findByCode', codigo),
    findAll: () => ipcRenderer.invoke('product:findAll'),
    search: (termo: string) => ipcRenderer.invoke('product:search', termo)
  },
  
  // Vendas
  sale: {
    create: (vendaData: any) => ipcRenderer.invoke('sale:create', vendaData)
  },
  
  // ✅ CORRIGIDO: Cache
  cache: {
    sync: () => ipcRenderer.invoke('cache:sync'),
    getStats: () => ipcRenderer.invoke('cache:getStats')
  },
  
  // ✅ CORRIGIDO: Código de barras com cleanup function
  barcode: {
    listen: () => ipcRenderer.invoke('barcode:listen'),
    onScanned: (callback: (codigo: string) => void) => {
      const handler = (event: any, codigo: string) => callback(codigo);
      ipcRenderer.on('barcode:scanned', handler);
      
      // ✅ RETORNA FUNÇÃO DE CLEANUP
      return () => {
        ipcRenderer.removeListener('barcode:scanned', handler);
      };
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('barcode:scanned');
    }
  },

  // Sistema
  system: {
    getVersion: () => ipcRenderer.invoke('system:getVersion'),
    minimize: () => ipcRenderer.invoke('system:minimize'),
    maximize: () => ipcRenderer.invoke('system:maximize'),
    close: () => ipcRenderer.invoke('system:close')
  },

  // ✅ CORRIGIDO: ATALHOS com cleanup function
  shortcuts: {
    onShortcut: (callback: (key: string) => void) => {
      const handler = (event: any, key: string) => callback(key);
      ipcRenderer.on('pdv:shortcut', handler);
      
      // ✅ RETORNA FUNÇÃO DE CLEANUP
      return () => {
        ipcRenderer.removeListener('pdv:shortcut', handler);
      };
    },
    removeShortcutListener: () => {
      ipcRenderer.removeAllListeners('pdv:shortcut');
    }
  },

  // ✅ CORRIGIDO: NOTIFICAÇÕES com cleanup function
  notifications: {
    onNotification: (callback: (notification: any) => void) => {
      const handler = (event: any, notification: any) => callback(notification);
      ipcRenderer.on('pdv:notification', handler);
      
      // ✅ RETORNA FUNÇÃO DE CLEANUP
      return () => {
        ipcRenderer.removeListener('pdv:notification', handler);
      };
    },
    removeNotificationListener: () => {
      ipcRenderer.removeAllListeners('pdv:notification');
    }
  },

  // ✅ CORRIGIDO: API com cleanup function
  api: {
    getStatus: () => ipcRenderer.invoke('api:getStatus'),
    onStatusUpdate: (callback: (status: any) => void) => {
      const handler = (event: any, status: any) => callback(status);
      ipcRenderer.on('api:status-update', handler);
      
      // ✅ RETORNA FUNÇÃO DE CLEANUP
      return () => {
        ipcRenderer.removeListener('api:status-update', handler);
      };
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners('api:status-update');
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electronAPI', api)
    
    console.log('✅ APIs do PDV com funções de cleanup expostas com sucesso!')
  } catch (error) {
    console.error('❌ Erro ao expor APIs:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.electronAPI = api
}