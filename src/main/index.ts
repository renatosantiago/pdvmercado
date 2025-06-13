import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path, { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createFileRoute, createURLRoute } from 'electron-router-dom'

// IMPORTAÇÕES ATUALIZADAS PARA API
import { PdvApiService } from './services/PdvApiService'
import { ApiConfig } from './config/ApiConfig'
import { ProductService } from './services/ProductService'
import { BarcodeService } from './services/BarcodeService'
import type { PDVNotification } from './types/NetworkTypes'

// SERVIÇOS PDV COM API
let pdvApiService: PdvApiService;
let apiConfig: ApiConfig;
let productService: ProductService;
let barcodeService: BarcodeService | null = null;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    fullscreen: false,
    show: true,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { 
      icon: join(__dirname, '../assets/icon.png')
     } :  process.platform === 'win32' && {
      icon: join(__dirname, 'resources/icon.png')
     }),
    webPreferences: {
      devTools: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // mainWindow.setMenu(null);

  // Set main window icon for macOS
  if (process.platform === 'darwin') {
    const pathIcon = path.resolve(__dirname, 'resources', 'icon.png')
    if (app.dock) {
      app.dock.setIcon(pathIcon)
    }
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devServerUrl = createURLRoute(process.env['ELECTRON_RENDERER_URL']!, 'main')

  const fileRout = createFileRoute(
    join(__dirname, '../renderer/index.html'),
    'main',
  )

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(...fileRout)
  }
}

// ✅ FUNÇÃO ATUALIZADA PARA INICIALIZAR SERVIÇOS COM API
async function initializePDVServices(): Promise<void> {
  try {
    console.log('🚀 Inicializando serviços PDV com API...');
    
    // Inicializar configuração da API
    apiConfig = ApiConfig.getInstance();
    
    // Criar arquivo de configuração se não existir
    try {
      apiConfig.createConfigFile();
    } catch (error) {
      console.log('ℹ️ Arquivo de configuração já existe');
    }
    
    // Mostrar configuração atual
    apiConfig.printConfiguration();
    
    // Inicializar serviço API integrado com cache
    pdvApiService = new PdvApiService(apiConfig.config.caixaId, {
      baseUrl: apiConfig.config.serverUrl,
      apiKey: apiConfig.config.apiKey,
      timeout: apiConfig.config.timeout,
      retries: apiConfig.config.retries
    });
    
    await pdvApiService.initialize();
    
    // Inicializar serviço de produtos
    productService = new ProductService(pdvApiService);
    
    // Inicializar leitor de código de barras (opcional)
    try {
      barcodeService = new BarcodeService(mainWindow);
      await barcodeService.initialize();
      console.log('✅ Leitor de código de barras conectado');
    } catch (error) {
      console.log('⚠️  Leitor de código de barras não encontrado - modo manual ativo');
    }
    
    // Enviar status inicial para o renderer
    setTimeout(() => {
      sendStatusUpdate();
    }, 2000);
    
    console.log('✅ Serviços PDV com API inicializados com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar serviços PDV:', error);
    throw error;
  }
}

// ✅ FUNÇÃO ATUALIZADA PARA ENVIAR STATUS
function sendStatusUpdate(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    productService.getStatus().then(status => {
      mainWindow?.webContents.send('api:status-update', status);
    });
  }
}

// ✅ HANDLERS IPC ATUALIZADOS PARA API
function setupPDVHandlers(): void {
  // Handler para buscar produto por código
  ipcMain.handle('product:findByCode', async (event, codigo: string) => {
    try {
      const produto = await productService.findByCode(codigo);
      return {
        success: true,
        data: produto
      };
    } catch (error: any) {
      console.error('Erro ao buscar produto:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler para buscar todos os produtos
  ipcMain.handle('product:findAll', async () => {
    try {
      const produtos = await productService.findAll();
      return {
        success: true,
        data: produtos
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ✅ NOVO: Handler para buscar produtos (autocomplete)
  ipcMain.handle('product:search', async (event, termo: string) => {
    try {
      const produtos = await productService.searchProducts(termo);
      return {
        success: true,
        data: produtos
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler para criar venda
  ipcMain.handle('sale:create', async (event, vendaData) => {
    try {
      const venda = await productService.createSale(vendaData);
      
      // Enviar atualização de status após venda
      sendStatusUpdate();
      
      return {
        success: true,
        data: venda
      };
    } catch (error: any) {
      console.error('Erro ao criar venda:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ✅ NOVO: Handler para sincronização manual de cache
  ipcMain.handle('cache:sync', async () => {
    try {
      const success = await productService.forceSync();
      
      // Enviar atualização de status após sincronização
      sendStatusUpdate();
      
      return {
        success: true,
        data: { synchronized: success }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ✅ NOVO: Handler para status da API e cache
  ipcMain.handle('api:getStatus', async () => {
    try {
      const status = await productService.getStatus();
      return {
        success: true,
        data: status
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler para leitor de código de barras
  ipcMain.handle('barcode:listen', async () => {
    try {
      if (barcodeService) {
        await barcodeService.startListening();
        return { success: true };
      } else {
        return { 
          success: false, 
          error: 'Leitor de código de barras não disponível' 
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('✅ Handlers IPC do PDV com API configurados');
}

// ✅ ATALHOS ATUALIZADOS COM SINCRONIZAÇÃO DE CACHE
function setupPDVShortcuts(): void {
  // Atalhos específicos do PDV
  globalShortcut.register('F1', () => {
    mainWindow?.webContents.send('pdv:shortcut', 'F1');
  });

  globalShortcut.register('F2', () => {
    mainWindow?.webContents.send('pdv:shortcut', 'F2');
  });

  globalShortcut.register('F3', () => {
    mainWindow?.webContents.send('pdv:shortcut', 'F3');
  });

  globalShortcut.register('F4', () => {
    mainWindow?.webContents.send('pdv:shortcut', 'F4');
  });

  globalShortcut.register('Escape', () => {
    mainWindow?.webContents.send('pdv:shortcut', 'ESC');
  });

  // ✅ NOVO: Atalho para sincronização de cache (F5)
  globalShortcut.register('F5', async () => {
    try {
      console.log('🔄 Sincronização manual de cache (F5)...');
      const success = await productService.forceSync();
      
      mainWindow?.webContents.send('pdv:notification', {
        type: success ? 'success' : 'warning',
        message: success ? 'Cache atualizado com sucesso!' : 'Erro na sincronização do cache',
        duration: 3000
      });
      
      if (success) {
        sendStatusUpdate();
      }
    } catch (error) {
      mainWindow?.webContents.send('pdv:notification', {
        type: 'error',
        message: 'Erro na sincronização do cache'
      });
    }
  });

  // ✅ ATUALIZADO: Atalho para mostrar status (agora inclui cache)
  globalShortcut.register('CommandOrControl+I', async () => {
    try {
      const status = await productService.getStatus();
      
      mainWindow?.webContents.send('pdv:notification', {
        type: 'info',
        message: `${status.caixa_id} | ${status.is_online ? 'ONLINE' : 'OFFLINE'} | Cache: ${status.cache?.total_produtos || 0} produtos | Pendente: ${status.pending_sales || 0}`,
        duration: 5000
      });
    } catch (error) {
      console.error('Erro ao obter status:', error);
    }
  });

  // ✅ NOVO: Atalho para estatísticas do cache (Ctrl+C)
  globalShortcut.register('CommandOrControl+C', async () => {
    try {
      const status = await productService.getStatus();
      const cache = status.cache;
      
      if (cache) {
        mainWindow?.webContents.send('pdv:notification', {
          type: 'info',
          message: `CACHE: ${cache.total_produtos} produtos | ${cache.cache_size_mb}MB | Última sync: ${cache.ultima_sync ? new Date(cache.ultima_sync).toLocaleTimeString() : 'Nunca'}`,
          duration: 7000
        });
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas do cache:', error);
    }
  });

  console.log('✅ Atalhos PDV configurados (F1-F5, Ctrl+I, Ctrl+C)');
}

// ✅ AUTOMAÇÃO ATUALIZADA PARA API
function setupPDVAutomation(): void {
  // Atualização de status a cada 30 segundos
  const statusTimer: NodeJS.Timeout = setInterval(() => {
    sendStatusUpdate();
  }, 30000);

  // Sincronização automática a cada 10 minutos (além da configurada no serviço)
  // const syncTimer: NodeJS.Timeout = setInterval(async () => {
  //   try {
  //     const success = await productService.forceSync();
  //     if (success) {
  //       console.log('🔄 Sincronização automática realizada');
  //     }
  //   } catch (error) {
  //     console.error('❌ Erro na sincronização automática:', error);
  //   }
  // }, 10 * 60 * 1000); // 10 minutos

  // Cleanup quando app fechar
  app.on('before-quit', () => {
    clearInterval(statusTimer);
    // clearInterval(syncTimer);
  });

  console.log('✅ Automação PDV com API configurada');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.pdv.api')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test (mantendo o original)
  ipcMain.on('ping', () => console.log('pong'))

  try {
    // ✅ INICIALIZAR SERVIÇOS PDV COM API ANTES DE CRIAR JANELA
    await initializePDVServices();
    
    // Configurar handlers IPC
    setupPDVHandlers();
    
    // Criar janela
    createWindow();
    
    // Configurar atalhos após janela criada
    setupPDVShortcuts();
    
    // Configurar automação
    setupPDVAutomation();
    
  } catch (error) {
    console.error('❌ Erro crítico na inicialização:', error);
    
    // Ainda assim criar a janela para mostrar erro ao usuário
    createWindow();
    
    // Enviar erro para o renderer após alguns segundos
    setTimeout(() => {
      mainWindow?.webContents.send('pdv:initialization-error', {
        message: 'Erro ao inicializar sistema PDV',
        error: error
      });
    }, 2000);
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', async () => {
  // ✅ CLEANUP ATUALIZADO PARA API
  try {
    if (barcodeService) {
      await barcodeService.disconnect();
    }
    if (pdvApiService) {
      await pdvApiService.close();
    }
    console.log('✅ Serviços PDV com API finalizados corretamente');
  } catch (error) {
    console.error('❌ Erro ao finalizar serviços PDV:', error);
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// TRATAMENTO DE ERROS GLOBAIS (mantido)
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdv:error', {
      type: 'uncaught-exception',
      message: error.message
    });
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdv:error', {
      type: 'unhandled-rejection',
      message: String(reason)
    });
  }
});