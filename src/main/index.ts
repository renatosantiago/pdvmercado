import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path, { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createFileRoute, createURLRoute } from 'electron-router-dom'

// IMPORTAÇÕES ATUALIZADAS PARA API
import { PdvApiService } from './services/PdvApiService'
import { ApiConfig } from './config/ApiConfig'
import { ProductService } from './services/ProductService'
import { BarcodeService } from './services/BarcodeService'
import { LogService, setupEnhancedLogging } from './services/LogService'

// SERVIÇOS PDV COM API
let logger: LogService;
let pdvApiService: PdvApiService;
let apiConfig: ApiConfig;
let productService: ProductService;
let barcodeService: BarcodeService | null = null;
let mainWindow: BrowserWindow | null = null;
let healthCheckTimer: NodeJS.Timeout | null = null;

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

// INICIALIZAR SERVIÇOS COM API
async function initializePDVServices(): Promise<void> {
  try {
    logger = setupEnhancedLogging('CAIXA-LOCAL-TESTE'); // ou pegar do config
    logger.info('STARTUP', '🚀 Inicializando servicos PDV...');
    
    // Inicializar configuração da API
    apiConfig = ApiConfig.getInstance();
    
    // Criar arquivo de configuração se não existir
    try {
      apiConfig.createConfigFile();
      logger.debug('CONFIG', 'Arquivo de configuracao verificado');
    } catch (error) {
      logger.debug('CONFIG', 'Arquivo de configuracao ja existe');
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
    logger.info('API', 'Servico API inicializado com sucesso');
    logger.info('PRODUCTS', 'Servico de produtos inicializado');
    
    // Inicializar serviço de produtos
    productService = new ProductService(pdvApiService);
    
    // Inicializar leitor de código de barras (opcional)
    try {
      barcodeService = new BarcodeService(mainWindow);
      await barcodeService.initialize();
      logger.info('BARCODE', 'Leitor de codigo de barras conectado');
    } catch (error) {
      logger.warn('BARCODE', 'Leitor de codigo de barras nao encontrado - modo manual ativo', error);
    }
    
    // Enviar status inicial para o renderer
    setTimeout(() => {
      sendStatusUpdate();
    }, 2000);
    
    logger.info('STARTUP', '✅ Servicos PDV inicializados com sucesso');
  } catch (error) {
    logger.fatal('STARTUP', 'Erro critico ao inicializar servicos PDV', error);
    throw error;
  }
}

// FUNÇÃO PARA ENVIAR STATUS API PDV
function sendStatusUpdate(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    productService.getStatus().then(status => {
      mainWindow?.webContents.send('api:status-update', status);
    });
  }
}

// HANDLERS IPC PARA API
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
      logger.error('PRODUCT_SEARCH', `Erro ao buscar produto ${codigo}`, error);
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

  // Handler para buscar produtos (autocomplete)
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
      logger.error('SALE', 'Erro ao criar venda', { error: error.message, vendaData });
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler para sincronização manual de cache
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

  // Handler para status da API e cache
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

   // ✅ NOVO HANDLER PARA LOGS
  ipcMain.handle('logs:export', async (event, filters) => {
    try {
      logger.info('LOG_EXPORT', 'Exportando logs', filters);
      
      const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
      const endDate = filters.endDate ? new Date(filters.endDate) : undefined;
      
      const logs = logger.exportLogs(startDate, endDate);
      
      return {
        success: true,
        data: {
          logs,
          count: logs.length,
          exported_at: new Date().toISOString()
        }
      };
    } catch (error: any) {
      logger.error('LOG_EXPORT', 'Erro ao exportar logs', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ✅ HANDLER PARA ESTATÍSTICAS DE LOGS
  ipcMain.handle('logs:stats', async () => {
    try {
      const stats = logger.getLogStats();
      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      logger.error('LOG_STATS', 'Erro ao obter estatisticas de logs', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('✅ Handlers IPC do PDV com API configurados');
}

// ATALHOS COM SINCRONIZAÇÃO DE CACHE
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

  // Atalho para sincronização de cache (F5)
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

  // Atalho para mostrar status (inclui cache)
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

  // Atalho para estatísticas do cache (Ctrl+C)
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

   // ✅ ATALHO PARA ABRIR LOGS (F12)
  globalShortcut.register('F12', () => {
    logger.info('SHORTCUT', 'Abrindo visualizador de logs');
    
    // Enviar comando para abrir modal de logs no renderer
    mainWindow?.webContents.send('pdv:open-logs');
  });

  // ✅ ATALHO PARA EXPORTAR LOGS (Ctrl+L)
  globalShortcut.register('CommandOrControl+L', async () => {
    try {
      logger.info('LOG_EXPORT', 'Exportacoo de logs iniciada via atalho');
      
      const logs = logger.exportLogs();
      const exportPath = path.join(app.getPath('desktop'), `pdv-logs-${new Date().toISOString().slice(0,10)}.json`);
      
      require('fs').writeFileSync(exportPath, JSON.stringify(logs, null, 2));
      
      logger.info('LOG_EXPORT', `Logs exportados para: ${exportPath}`);
      
      mainWindow?.webContents.send('pdv:notification', {
        type: 'success',
        message: `Logs exportados para Desktop: pdv-logs-${new Date().toISOString().slice(0,10)}.json`,
        duration: 5000
      });
    } catch (error: any) {
      logger.error('LOG_EXPORT', 'Erro ao exportar logs via atalho', error);
      
      mainWindow?.webContents.send('pdv:notification', {
        type: 'error',
        message: 'Erro ao exportar logs'
      });
    }
  });

  logger.info('SHORTCUTS', 'Atalhos PDV configurados (F1-F5, F12, Ctrl+L)');
}

function setupPDVAutomation(): void {
  // Atualização de status a cada 30 segundos (mantido)
  const statusTimer: NodeJS.Timeout = setInterval(() => {
    sendStatusUpdate();
  }, 30000);

  // Iniciar health check automático
  startHealthCheckTimer();

  // Cleanup quando app fechar
  app.on('before-quit', () => {
    clearInterval(statusTimer);
    
    // Limpar timer de health check
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
    }
  });

  logger.info('SETUP','✅ Automação PDV com Health Check configurada');
}

function startHealthCheckTimer(): void {
  // Verificar se já existe um timer ativo
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }

  logger.info('startHealthCheckTimer','🏥 Iniciando health check automático (a cada 1 minuto)...');

  // Executar primeira verificação imediatamente
  performHealthCheck();

  // Configurar timer para executar a cada minuto (60000ms)
  healthCheckTimer = setInterval(() => {
    performHealthCheck();
  }, 60000); // 1 minuto

  logger.info('startHealthCheckTimer','✅ Health check timer configurado');
}

// Executar health check
async function performHealthCheck(): Promise<void> {
  try {
    if (!pdvApiService) {
      logger.warn('HEALTH_CHECK', 'PDV API Service nao inicializado');
      return;
    }

    // Executar verificação de saúde da API
    const isHealthy = await pdvApiService.checkApiHealth();
    
    if (isHealthy) {
      logger.debug('HEALTH_CHECK', 'API esta online e funcionando');
    } else {
      logger.warn('HEALTH_CHECK', 'API esta offline ou com problemas');
    }

    // Enviar atualização de status para o renderer
    sendStatusUpdate();

  } catch (error: any) {
    logger.error('HEALTH_CHECK', 'Erro no health check automatico', error);
    
    // Em caso de erro, marcar como offline
    if (pdvApiService) {
      pdvApiService.isOnline = false;
      sendStatusUpdate();
    }
  }
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
    // INICIALIZAR SERVIÇOS PDV COM API ANTES DE CRIAR JANELA
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
  logger.fatal('UNCAUGHT_EXCEPTION', 'Excecao nao capturada', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdv:error', {
      type: 'uncaught-exception',
      message: error.message
    });
  }
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('UNHANDLED_REJECTION', 'Promise rejeitada nao tratada', reason);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdv:error', {
      type: 'unhandled-rejection',
      message: String(reason)
    });
  }
});