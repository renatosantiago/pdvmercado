import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path, { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createFileRoute, createURLRoute } from 'electron-router-dom'

// IMPORTAÇÕES PARA PDV COM REDE
import { NetworkDatabaseService } from './services/NetworkDatabaseService'
import { NetworkConfig } from './config/NetworkConfig'
import { ProductService } from './services/ProductService'
import { BarcodeService } from './services/BarcodeService'
import type { NetworkStatus, PDVNotification } from './types/NetworkTypes'

// SERVIÇOS PDV COM SUPORTE A REDE
let networkDatabaseService: NetworkDatabaseService;
let networkConfig: NetworkConfig;
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
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

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
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(...fileRout)
  }
}

// FUNÇÃO PARA INICIALIZAR SERVIÇOS PDV COM REDE
async function initializePDVServices(): Promise<void> {
  try {
    console.log('🚀 Inicializando serviços PDV com suporte a rede...');
    
    // Inicializar configuração de rede
    networkConfig = NetworkConfig.getInstance();
    
    // Criar arquivo de configuração se não existir
    try {
      networkConfig.createConfigFile();
    } catch (error) {
      console.log('ℹ️ Arquivo de configuração já existe');
    }
    
    // Inicializar banco de dados com suporte a rede
    networkDatabaseService = new NetworkDatabaseService();
    await networkDatabaseService.initialize();
    
    // Inicializar serviço de produtos
    productService = new ProductService(networkDatabaseService);
    
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
      sendNetworkStatusUpdate();
    }, 2000);
    
    console.log('✅ Serviços PDV com rede inicializados com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar serviços PDV:', error);
    throw error;
  }
}

// FUNÇÃO PARA ENVIAR STATUS DE REDE PARA O RENDERER
function sendNetworkStatusUpdate(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    networkDatabaseService.getNetworkStatus().then(status => {
      mainWindow?.webContents.send('network:status-update', status);
    });
  }
}

// HANDLERS IPC PARA PDV COM REDE
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

  // Handler para criar venda
  ipcMain.handle('sale:create', async (event, vendaData) => {
    try {
      const venda = await productService.createSale(vendaData);
      
      // Enviar atualização de status após venda
      sendNetworkStatusUpdate();
      
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

  // Handler para relatório diário
  ipcMain.handle('report:dailySales', async (event, date?: string) => {
    try {
      const relatorio = await networkDatabaseService.getDailySalesReport(date);
      return {
        success: true,
        data: relatorio
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler para produtos com estoque baixo
  ipcMain.handle('product:lowStock', async () => {
    try {
      const produtos = await networkDatabaseService.getLowStockProducts();
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

  // Handler para backup do banco
  ipcMain.handle('database:backup', async () => {
    try {
      const backupPath = await networkDatabaseService.createBackup();
      return {
        success: true,
        data: { backupPath }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler para otimização do banco
  ipcMain.handle('database:optimize', async () => {
    try {
      await networkDatabaseService.optimize();
      return {
        success: true,
        data: 'Banco otimizado com sucesso'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // NOVOS HANDLERS PARA REDE
  
  // Status da rede
  ipcMain.handle('network:getStatus', async () => {
    try {
      const status = await networkDatabaseService.getNetworkStatus();
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

  // Forçar sincronização
  ipcMain.handle('network:forceSync', async () => {
    try {
      const success = await networkDatabaseService.forceSyncToNetwork();
      
      // Atualizar status após sincronização
      sendNetworkStatusUpdate();
      
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

  // Estatísticas do sistema
  ipcMain.handle('system:getStats', async () => {
    try {
      const stats = await networkDatabaseService.getSystemStats();
      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Configuração do leitor de código de barras
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

  console.log('✅ Handlers IPC do PDV com rede configurados');
}

// FUNÇÃO PARA CONFIGURAR ATALHOS ESPECÍFICOS DO PDV
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

  // Atalho para backup rápido
  globalShortcut.register('CommandOrControl+B', async () => {
    try {
      const backupPath = await networkDatabaseService.createBackup();
      mainWindow?.webContents.send('pdv:notification', {
        type: 'success',
        message: `Backup criado: ${path.basename(backupPath)}`
      });
    } catch (error) {
      mainWindow?.webContents.send('pdv:notification', {
        type: 'error',
        message: 'Erro ao criar backup'
      });
    }
  });

  // Atalho para forçar sincronização
  globalShortcut.register('CommandOrControl+S', async () => {
    try {
      const success = await networkDatabaseService.forceSyncToNetwork();
      mainWindow?.webContents.send('pdv:notification', {
        type: success ? 'success' : 'warning',
        message: success ? 'Sincronização realizada' : 'Sem conectividade para sincronizar'
      });
      
      if (success) {
        sendNetworkStatusUpdate();
      }
    } catch (error) {
      mainWindow?.webContents.send('pdv:notification', {
        type: 'error',
        message: 'Erro na sincronização'
      });
    }
  });

  // Atalho para mostrar status
  globalShortcut.register('CommandOrControl+I', async () => {
    try {
      const status = await networkDatabaseService.getConnectionInfo();
      const pendingSync = await networkDatabaseService.getSyncPendingCount();
      
      mainWindow?.webContents.send('pdv:notification', {
        type: 'info',
        message: `${status.caixa_id} | ${status.is_online ? 'ONLINE' : 'OFFLINE'} | Pendente: ${pendingSync}`,
        duration: 5000
      });
    } catch (error) {
      console.error('Erro ao obter status:', error);
    }
  });

  console.log('✅ Atalhos PDV configurados');
}

// TAREFAS AUTOMÁTICAS DO PDV COM REDE
function setupPDVAutomation(): void {
  // Backup automático diário às 23:00
  const scheduleBackup = () => {
    const now = new Date();
    const backup = new Date();
    backup.setHours(23, 0, 0, 0);
    
    if (backup <= now) {
      backup.setDate(backup.getDate() + 1);
    }
    
    const msUntilBackup = backup.getTime() - now.getTime();
    
    setTimeout(async () => {
      try {
        await networkDatabaseService.createBackup();
        console.log('📁 Backup automático realizado');
        
        // Reagendar para próximo dia
        scheduleBackup();
      } catch (error) {
        console.error('❌ Erro no backup automático:', error);
      }
    }, msUntilBackup);
  };

  // Otimização automática do banco a cada 4 horas
  const optimizationTimer: NodeJS.Timeout = setInterval(async () => {
    try {
      await networkDatabaseService.optimize();
      console.log('🔧 Otimização automática realizada');
    } catch (error) {
      console.error('❌ Erro na otimização automática:', error);
    }
  }, 4 * 60 * 60 * 1000); // 4 horas

  // Atualização de status de rede a cada 30 segundos
  const statusTimer: NodeJS.Timeout = setInterval(() => {
    sendNetworkStatusUpdate();
  }, 30000);

  scheduleBackup();
  
  // Cleanup quando app fechar
  app.on('before-quit', () => {
    clearInterval(optimizationTimer);
    clearInterval(statusTimer);
  });

  console.log('✅ Automação PDV com rede configurada');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.pdv.multicaixa')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test (mantendo o original)
  ipcMain.on('ping', () => console.log('pong'))

  try {
    // INICIALIZAR SERVIÇOS PDV COM REDE ANTES DE CRIAR JANELA
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
  // CLEANUP DOS SERVIÇOS PDV COM REDE
  try {
    if (barcodeService) {
      await barcodeService.disconnect();
    }
    if (networkDatabaseService) {
      await networkDatabaseService.close();
    }
    console.log('✅ Serviços PDV com rede finalizados corretamente');
  } catch (error) {
    console.error('❌ Erro ao finalizar serviços PDV:', error);
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// TRATAMENTO DE ERROS GLOBAIS
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Notificar renderer se disponível
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdv:error', {
      type: 'uncaught-exception',
      message: error.message
    });
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  
  // Notificar renderer se disponível
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdv:error', {
      type: 'unhandled-rejection',
      message: String(reason)
    });
  }
});