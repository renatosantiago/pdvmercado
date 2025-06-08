// ================================
// config/NetworkConfig.ts - Configuração de Rede Multi-Caixa
// ================================

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface NetworkConfiguration {
  // Identificação do caixa
  CAIXA_ID: string;
  CAIXA_ROLE: 'server' | 'client';
  
  // Caminhos de rede
  NETWORK_PATH: string;
  LOCAL_BACKUP_PATH: string;
  
  // Configurações de sincronização
  SYNC_INTERVAL: number;
  RECONNECTION_INTERVAL: number;
  OFFLINE_TIMEOUT: number;
  
  // Status
  isNetworkEnabled: boolean;
  isOfflineMode: boolean;
}

export class NetworkConfig {
  private static instance: NetworkConfig;
  public config: NetworkConfiguration;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): NetworkConfig {
    if (!NetworkConfig.instance) {
      NetworkConfig.instance = new NetworkConfig();
    }
    return NetworkConfig.instance;
  }

  private loadConfiguration(): NetworkConfiguration {
    // Carregar variáveis de ambiente ou arquivo de configuração
    const envPath = path.join(process.cwd(), '.env.pdv');
    const defaultConfig = this.getDefaultConfiguration();

    try {
      // Tentar carregar arquivo de configuração personalizado
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = this.parseEnvFile(envContent);
        
        return {
          ...defaultConfig,
          ...envVars
        };
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar configuração, usando padrões:', error);
    }

    return defaultConfig;
  }

  private getDefaultConfiguration(): NetworkConfiguration {
    const hostname = os.hostname();
    const isServer = hostname.toLowerCase().includes('servidor') || 
                    hostname.toLowerCase().includes('server') ||
                    process.env.PDV_ROLE === 'server';

    return {
      // Identificação automática
      CAIXA_ID: process.env.PDV_CAIXA_ID || (isServer ? 'SERVIDOR' : `CAIXA-${hostname.substring(0, 6).toUpperCase()}`),
      CAIXA_ROLE: isServer ? 'server' : 'client',
      
      // Caminhos padrão
      NETWORK_PATH: process.env.PDV_NETWORK_PATH || this.detectNetworkPath(),
      LOCAL_BACKUP_PATH: path.join(process.cwd(), 'data', 'local'),
      
      // Intervalos em milissegundos
      SYNC_INTERVAL: parseInt(process.env.PDV_SYNC_INTERVAL || '5000'),        // 5 segundos
      RECONNECTION_INTERVAL: parseInt(process.env.PDV_RECONNECT_INTERVAL || '30000'), // 30 segundos
      OFFLINE_TIMEOUT: parseInt(process.env.PDV_OFFLINE_TIMEOUT || '10000'),   // 10 segundos
      
      // Status inicial
      isNetworkEnabled: process.env.PDV_NETWORK_ENABLED !== 'false',
      isOfflineMode: false
    };
  }

  private detectNetworkPath(): string {
    // Tentar detectar caminhos de rede comuns
    const commonPaths = [
      '\\\\SERVIDOR\\PDV',
      '\\\\192.168.1.100\\PDV',
      'Z:\\PDV',
      '/mnt/pdv',
      process.env.PDV_SHARED_FOLDER
    ].filter((p): p is string => typeof p === 'string' && !!p);

    for (const networkPath of commonPaths) {
      try {
        if (fs.existsSync(networkPath)) {
          console.log(`✅ Pasta de rede detectada: ${networkPath}`);
          return networkPath;
        }
      } catch (error) {
        // Ignorar erros de acesso
      }
    }

    // Se não encontrar, usar caminho local como fallback
    console.log('⚠️ Pasta de rede não detectada, usando modo local');
    return path.join(process.cwd(), 'data', 'shared');
  }

  private parseEnvFile(content: string): Partial<NetworkConfiguration> {
    const config: any = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        
        switch (key.trim()) {
          case 'PDV_CAIXA_ID':
            config.CAIXA_ID = value;
            break;
          case 'PDV_ROLE':
            config.CAIXA_ROLE = value as 'server' | 'client';
            break;
          case 'PDV_NETWORK_PATH':
            config.NETWORK_PATH = value;
            break;
          case 'PDV_SYNC_INTERVAL':
            config.SYNC_INTERVAL = parseInt(value);
            break;
          case 'PDV_NETWORK_ENABLED':
            config.isNetworkEnabled = value.toLowerCase() === 'true';
            break;
        }
      }
    }

    return config;
  }

  // Métodos para gerenciamento da configuração
  public getNetworkDatabasePath(): string {
    if (this.config.CAIXA_ROLE === 'server') {
      // Servidor usa pasta local
      return path.join(process.cwd(), 'data', 'pdv.db');
    } else {
      // Cliente usa pasta de rede
      return path.join(this.config.NETWORK_PATH, 'banco', 'pdv.db');
    }
  }

  public getLocalBackupPath(): string {
    const filename = `pdv_backup_${this.config.CAIXA_ID.toLowerCase()}.db`;
    return path.join(this.config.LOCAL_BACKUP_PATH, filename);
  }

  public createConfigFile(): void {
    const configContent = `# Configuração PDV Multi-Caixa
# Gerado automaticamente em ${new Date().toISOString()}

# Identificação do caixa
PDV_CAIXA_ID=${this.config.CAIXA_ID}
PDV_ROLE=${this.config.CAIXA_ROLE}

# Rede
PDV_NETWORK_PATH=${this.config.NETWORK_PATH}
PDV_NETWORK_ENABLED=${this.config.isNetworkEnabled}

# Sincronização (em milissegundos)
PDV_SYNC_INTERVAL=${this.config.SYNC_INTERVAL}
PDV_RECONNECT_INTERVAL=${this.config.RECONNECTION_INTERVAL}
PDV_OFFLINE_TIMEOUT=${this.config.OFFLINE_TIMEOUT}

# Exemplo de configurações para diferentes tipos de instalação:
#
# SERVIDOR PRINCIPAL:
# PDV_CAIXA_ID=SERVIDOR
# PDV_ROLE=server
# PDV_NETWORK_PATH=C:\\PDV\\Shared
#
# CAIXA CLIENTE:
# PDV_CAIXA_ID=CAIXA01
# PDV_ROLE=client
# PDV_NETWORK_PATH=\\\\SERVIDOR\\PDV
`;

    const configPath = path.join(process.cwd(), '.env.pdv');
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`📁 Arquivo de configuração criado: ${configPath}`);
  }

  public validateNetworkAccess(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.config.CAIXA_ROLE === 'server') {
        // Servidor sempre tem acesso
        resolve(true);
        return;
      }

      try {
        const networkDbPath = this.getNetworkDatabasePath();
        const networkDir = path.dirname(networkDbPath);
        
        // Verificar se consegue acessar a pasta de rede
        fs.accessSync(networkDir, fs.constants.R_OK | fs.constants.W_OK);
        resolve(true);
      } catch (error) {
        console.warn(`❌ Sem acesso à rede: ${error}`);
        resolve(false);
      }
    });
  }

  public ensureDirectoriesExist(): void {
    // Criar diretório de backup local
    const backupDir = path.dirname(this.getLocalBackupPath());
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Diretório de backup criado: ${backupDir}`);
    }

    // Se for servidor, criar diretório compartilhado
    if (this.config.CAIXA_ROLE === 'server') {
      const sharedDir = path.join(this.config.NETWORK_PATH, 'banco');
      if (!fs.existsSync(sharedDir)) {
        fs.mkdirSync(sharedDir, { recursive: true });
        console.log(`📁 Diretório compartilhado criado: ${sharedDir}`);
      }
    }
  }

  // Getters para facilitar o acesso
  public get caixaId(): string {
    return this.config.CAIXA_ID;
  }

  public get isServer(): boolean {
    return this.config.CAIXA_ROLE === 'server';
  }

  public get isClient(): boolean {
    return this.config.CAIXA_ROLE === 'client';
  }

  public get isNetworkEnabled(): boolean {
    return this.config.isNetworkEnabled;
  }

  public get isOfflineMode(): boolean {
    return this.config.isOfflineMode;
  }

  public setOfflineMode(offline: boolean): void {
    this.config.isOfflineMode = offline;
  }

  // Método para debug
  public printConfiguration(): void {
    console.log('🔧 === CONFIGURAÇÃO PDV ===');
    console.log(`Caixa ID: ${this.config.CAIXA_ID}`);
    console.log(`Papel: ${this.config.CAIXA_ROLE}`);
    console.log(`Rede habilitada: ${this.config.isNetworkEnabled}`);
    console.log(`Modo offline: ${this.config.isOfflineMode}`);
    console.log(`Caminho de rede: ${this.config.NETWORK_PATH}`);
    console.log(`Backup local: ${this.getLocalBackupPath()}`);
    console.log(`Banco principal: ${this.getNetworkDatabasePath()}`);
    console.log('🔧 ========================');
  }
}