import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer - APIS DO PDV COM REDE
const api = {
  // Produtos
  product: {
    findByCode: (codigo: string) => ipcRenderer.invoke('product:findByCode', codigo),
    findAll: () => ipcRenderer.invoke('product:findAll'),
    lowStock: () => ipcRenderer.invoke('product:lowStock')
  },
  
  // Vendas
  sale: {
    create: (vendaData: any) => ipcRenderer.invoke('sale:create', vendaData)
  },
  
  // Código de barras
  barcode: {
    listen: () => ipcRenderer.invoke('barcode:listen'),
    onScanned: (callback: (codigo: string) => void) => {
      ipcRenderer.on('barcode:scanned', (event, codigo) => callback(codigo));
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('barcode:scanned');
    }
  },

  // Relatórios
  report: {
    dailySales: (date?: string) => ipcRenderer.invoke('report:dailySales', date)
  },

  // Database
  database: {
    backup: () => ipcRenderer.invoke('database:backup'),
    optimize: () => ipcRenderer.invoke('database:optimize')
  },

  // Sistema
  system: {
    getVersion: () => ipcRenderer.invoke('system:getVersion'),
    getStats: () => ipcRenderer.invoke('system:getStats'),
    minimize: () => ipcRenderer.invoke('system:minimize'),
    maximize: () => ipcRenderer.invoke('system:maximize'),
    close: () => ipcRenderer.invoke('system:close')
  },

  // ATALHOS - ADICIONANDO SUPORTE
  shortcuts: {
    onShortcut: (callback: (key: string) => void) => {
      ipcRenderer.on('pdv:shortcut', (event, key) => callback(key));
    },
    removeShortcutListener: () => {
      ipcRenderer.removeAllListeners('pdv:shortcut');
    }
  },

  // NOTIFICAÇÕES - ADICIONANDO SUPORTE
  notifications: {
    onNotification: (callback: (notification: any) => void) => {
      ipcRenderer.on('pdv:notification', (event, notification) => callback(notification));
    },
    removeNotificationListener: () => {
      ipcRenderer.removeAllListeners('pdv:notification');
    }
  },

  // REDE - NOVAS APIS PARA MULTI-CAIXA
  network: {
    getStatus: () => ipcRenderer.invoke('network:getStatus'),
    forceSync: () => ipcRenderer.invoke('network:forceSync'),
    onStatusUpdate: (callback: (status: any) => void) => {
      ipcRenderer.on('network:status-update', (event, status) => callback(status));
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners('network:status-update');
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    
    // EXPOR COMO electronAPI PARA COMPATIBILIDADE COM SEU CÓDIGO
    contextBridge.exposeInMainWorld('electronAPI', api)
    
    console.log('✅ APIs do PDV Multi-Caixa expostas com sucesso!')
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