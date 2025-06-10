// ================================
// config/NetworkConfig.ts - VERSaO CORRIGIDA - Deteccao Automática
// ================================

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface NetworkConfiguration {
  CAIXA_ID: string;
  CAIXA_ROLE: 'server' | 'client';
  NETWORK_PATH: string;
  LOCAL_BACKUP_PATH: string;
  SYNC_INTERVAL: number;
  RECONNECTION_INTERVAL: number;
  OFFLINE_TIMEOUT: number;
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
    console.log('🔧 === CARREGANDO CONFIGURAcaO PDV ===');
    
    // ✅ CORRIGIDO: Primeiro tenta carregar .env.pdv
    const envPath = path.join(process.cwd(), '.env.pdv');
    let envConfig: Partial<NetworkConfiguration> = {};
    
    try {
      if (fs.existsSync(envPath)) {
        console.log(`📁 Carregando configuracao: ${envPath}`);
        const envContent = fs.readFileSync(envPath, 'utf8');
        envConfig = this.parseEnvFile(envContent);
        console.log(`✅ Configuracao .env.pdv carregada:`, envConfig);
      } else {
        console.log(`⚠️ Arquivo .env.pdv NaO encontrado em: ${envPath}`);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar .env.pdv:', error);
    }

    // ✅ CORRIGIDO: Detectar automaticamente se é servidor
    const detectedRole = this.detectServerRole(envConfig);
    console.log(`🔍 Papel detectado: ${detectedRole}`);

    // ✅ CORRIGIDO: Merge com deteccao automática
    const finalConfig = {
      ...this.getDefaultConfiguration(detectedRole),
      ...envConfig
    };

    console.log(`✅ Configuracao final carregada para: ${finalConfig.CAIXA_ID} (${finalConfig.CAIXA_ROLE})`);
    console.log('🔧 ================================');
    
    return finalConfig;
  }

  // 🆕 NOVO: Deteccao automática inteligente de servidor
  private detectServerRole(envConfig: Partial<NetworkConfiguration>): 'server' | 'client' {
    console.log('🔍 === DETECTANDO PAPEL (SERVER/CLIENT) ===');

    // 1. Se especificado explicitamente no .env.pdv
    if (envConfig.CAIXA_ROLE) {
      console.log(`1️⃣ Papel definido no .env.pdv: ${envConfig.CAIXA_ROLE}`);
      return envConfig.CAIXA_ROLE;
    }

    // 2. Se CAIXA_ID contém "SERVIDOR"
    if (envConfig.CAIXA_ID && envConfig.CAIXA_ID.includes('SERVIDOR')) {
      console.log(`2️⃣ CAIXA_ID indica servidor: ${envConfig.CAIXA_ID}`);
      return 'server';
    }

    // 3. Verificar variáveis de ambiente do sistema
    if (process.env.PDV_ROLE === 'server') {
      console.log(`3️⃣ Variável de ambiente PDV_ROLE=server`);
      return 'server';
    }

    if (process.env.PDV_CAIXA_ID && process.env.PDV_CAIXA_ID.includes('SERVIDOR')) {
      console.log(`4️⃣ Variável de ambiente PDV_CAIXA_ID: ${process.env.PDV_CAIXA_ID}`);
      return 'server';
    }

    // 4. ✅ NOVO: Detectar baseado na existência da pasta compartilhada
    const sharedPath = 'C:\\PDV-Shared';
    if (fs.existsSync(sharedPath)) {
      try {
        // Verificar se é realmente uma pasta de servidor (tem banco)
        const bankPath = path.join(sharedPath, 'banco');
        if (fs.existsSync(bankPath) || this.canCreateDirectory(bankPath)) {
          console.log(`5️⃣ Pasta compartilhada detectada: ${sharedPath} - ASSUMINDO SERVIDOR`);
          return 'server';
        }
      } catch (error) {
        console.log(`5️⃣ Pasta compartilhada existe mas sem acesso: ${error}`);
      }
    } else {
      console.log(`5️⃣ Pasta compartilhada NaO existe: ${sharedPath}`);
    }

    // 6. ✅ NOVO: Detectar baseado no hostname
    const hostname = os.hostname().toLowerCase();
    if (hostname.includes('server') || hostname.includes('servidor')) {
      console.log(`6️⃣ Hostname indica servidor: ${hostname}`);
      return 'server';
    }

    // 7. ✅ NOVO: Detectar baseado na pasta atual
    const currentDir = process.cwd();
    if (currentDir.includes('PDV-Shared') || currentDir.includes('server')) {
      console.log(`7️⃣ Diretorio atual indica servidor: ${currentDir}`);
      return 'server';
    }

    // 8. ✅ NOVO: Verificar se tem executável em C:\PDV-Shared
    const serverExePaths = [
      'C:\\PDV-Shared\\PDV.exe',
      'C:\\PDV-Shared\\PDVMercado.exe'
    ];
    
    for (const exePath of serverExePaths) {
      if (fs.existsSync(exePath)) {
        console.log(`8️⃣ Executável servidor detectado: ${exePath}`);
        return 'server';
      }
    }

    // 9. Default: cliente
    console.log(`9️⃣ Nenhuma condicao de servidor atendida - ASSUMINDO CLIENTE`);
    return 'client';
  }

  // ✅ CORRIGIDO: Configuracao padrao baseada no papel detectado
  private getDefaultConfiguration(role: 'server' | 'client'): NetworkConfiguration {
    const isServer = role === 'server';
    
    console.log(`🛠️ Gerando configuracao padrao para: ${role}`);

    return {
      // ✅ CORRIGIDO: ID baseado no papel detectado
      CAIXA_ID: isServer ? 'SERVIDOR' : 'CAIXA01',
      CAIXA_ROLE: role,
      
      // ✅ CORRIGIDO: Caminho baseado no papel
      NETWORK_PATH: isServer ? 'C:\\PDV-Shared' : '\\\\192.168.10.1\\PDV',
      LOCAL_BACKUP_PATH: path.join(process.cwd(), 'data', 'local'),
      
      // Intervalos em milissegundos
      SYNC_INTERVAL: parseInt(process.env.PDV_SYNC_INTERVAL || '5000'),
      RECONNECTION_INTERVAL: parseInt(process.env.PDV_RECONNECT_INTERVAL || '30000'),
      OFFLINE_TIMEOUT: parseInt(process.env.PDV_OFFLINE_TIMEOUT || '10000'),
      
      // Status inicial
      isNetworkEnabled: process.env.PDV_NETWORK_ENABLED !== 'false',
      isOfflineMode: false
    };
  }

  // ✅ MELHORADO: Parse do .env.pdv com mais opcoes
  private parseEnvFile(content: string): Partial<NetworkConfiguration> {
    const config: any = {};
    const lines = content.split('\n');

    console.log('📄 Parsing .env.pdv:');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        
        console.log(`   ${key.trim()} = ${value}`);
        
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
          // ✅ NOVO: Mais opcoes de configuracao
          case 'PDV_STATION_NAME':
          case 'PDV_STATION_ID':
          case 'PDV_TERMINAL_ID':
            config.CAIXA_ID = value; // Aliases para CAIXA_ID
            break;
        }
      }
    }

    return config;
  }

  // ✅ NOVO: Funcao auxiliar para testar criacao de diretorio
  private canCreateDirectory(dirPath: string): boolean {
    try {
      const parentDir = path.dirname(dirPath);
      if (!fs.existsSync(parentDir)) {
        return false;
      }
      
      // Testa criacao temporária
      const testDir = path.join(parentDir, 'test_' + Date.now());
      fs.mkdirSync(testDir);
      fs.rmdirSync(testDir);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ✅ MELHORADO: Deteccao de caminho de rede mais robusta
  private detectNetworkPath(): string {
    const serverIP = process.env.PDV_SERVER_IP || '192.168.10.1';
    
    const commonPaths = [
      process.env.PDV_NETWORK_PATH,
      process.env.PDV_SHARED_FOLDER,
      `\\\\${serverIP}\\PDV`,
      '\\\\192.168.10.1\\PDV',
      'C:\\PDV-Shared',
    ].filter((p): p is string => typeof p === 'string' && !!p);

    for (const networkPath of commonPaths) {
      try {
        if (fs.existsSync(networkPath)) {
          console.log(`✅ Pasta de rede detectada: ${networkPath}`);
          return networkPath;
        }
      } catch (error: any) {
        console.log(`⚠️ Tentativa falhou: ${networkPath} - ${error.message}`);
      }
    }

    const fallbackPath = 'C:\\PDV-Shared';
    console.log(`⚠️ Usando fallback: ${fallbackPath}`);
    
    try {
      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
        console.log(`📁 Pasta fallback criada: ${fallbackPath}`);
      }
    } catch (error: any) {
      console.error(`❌ Erro ao criar pasta fallback: ${error.message}`);
    }
    
    return fallbackPath;
  }

  public getNetworkDatabasePath(): string {
    if (this.config.CAIXA_ROLE === 'server') {
      return path.join('C:\\PDV-Shared', 'banco', 'pdv.db');
    } else {
      return path.join(this.config.NETWORK_PATH, 'banco', 'pdv.db');
    }
  }

  public getLocalBackupPath(): string {
    const filename = `pdv_backup_${this.config.CAIXA_ID.toLowerCase()}.db`;
    return path.join(this.config.LOCAL_BACKUP_PATH, filename);
  }

  public createConfigFile(): void {
    const configContent = `# Configuracao PDV Multi-Caixa
# Gerado automaticamente em ${new Date().toISOString()}

# ✅ IDENTIFICAcaO - Configure aqui se deteccao automática falhar
PDV_CAIXA_ID=${this.config.CAIXA_ID}
PDV_ROLE=${this.config.CAIXA_ROLE}

# ✅ REDE
PDV_NETWORK_PATH=${this.config.NETWORK_PATH}
PDV_NETWORK_ENABLED=${this.config.isNetworkEnabled}
PDV_SERVER_IP=192.168.10.1

# ✅ SINCRONIZAcaO
PDV_SYNC_INTERVAL=${this.config.SYNC_INTERVAL}
PDV_RECONNECT_INTERVAL=${this.config.RECONNECTION_INTERVAL}
PDV_OFFLINE_TIMEOUT=${this.config.OFFLINE_TIMEOUT}

# ================================
# EXEMPLOS DE CONFIGURAcaO:
# ================================

# SERVIDOR (execute em C:\\PDV-Shared):
# PDV_CAIXA_ID=SERVIDOR
# PDV_ROLE=server
# PDV_NETWORK_PATH=C:\\PDV-Shared

# CLIENTE:
# PDV_CAIXA_ID=CAIXA01
# PDV_ROLE=client
# PDV_NETWORK_PATH=\\\\192.168.10.1\\PDV
`;

    const configPath = path.join(process.cwd(), '.env.pdv');
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`📁 Arquivo de configuracao criado: ${configPath}`);
  }

  public validateNetworkAccess(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.config.CAIXA_ROLE === 'server') {
        try {
          const localSharedPath = 'C:\\PDV-Shared\\banco';
          fs.accessSync(localSharedPath, fs.constants.R_OK | fs.constants.W_OK);
          console.log(`✅ Servidor: Acesso OKa pasta compartilhada: ${localSharedPath}`);
          resolve(true);
        } catch (error: any) {
          console.error(`❌ Servidor: Sem acessoa pasta compartilhada: ${error.message}`);
          resolve(false);
        }
        return;
      }

      try {
        const networkDbPath = this.getNetworkDatabasePath();
        const networkDir = path.dirname(networkDbPath);
        
        console.log(`🔍 Cliente testando acesso: ${networkDir}`);
        fs.accessSync(networkDir, fs.constants.R_OK | fs.constants.W_OK);
        
        console.log(`✅ Cliente: Acesso OK a rede: ${networkDir}`);
        resolve(true);
      } catch (error: any) {
        console.warn(`❌ Cliente: Sem acesso a rede: ${error.message}`);
        resolve(false);
      }
    });
  }

  public ensureDirectoriesExist(): void {
    const backupDir = path.dirname(this.getLocalBackupPath());
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Diretorio de backup criado: ${backupDir}`);
    }

    if (this.config.CAIXA_ROLE === 'server') {
      const sharedDir = 'C:\\PDV-Shared\\banco';
      if (!fs.existsSync(sharedDir)) {
        fs.mkdirSync(sharedDir, { recursive: true });
        console.log(`📁 Pasta compartilhada criada: ${sharedDir}`);
      }

      const backupsDir = 'C:\\PDV-Shared\\backups';
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
        console.log(`📁 Pasta de backups criada: ${backupsDir}`);
      }
    }
  }

  // ✅ NOVO: Método para forcar reconfiguracao
  public forceServerConfiguration(): void {
    console.log('🔧 FORcANDO CONFIGURAcaO COMO SERVIDOR...');
    
    this.config.CAIXA_ID = 'SERVIDOR';
    this.config.CAIXA_ROLE = 'server';
    this.config.NETWORK_PATH = 'C:\\PDV-Shared';
    
    // Criar arquivo .env.pdv correto
    this.createConfigFile();
    
    console.log('✅ Configuracao forcada como servidor!');
    this.printConfiguration();
  }

  // ✅ NOVO: Método para forcar reconfiguracao como cliente
  public forceClientConfiguration(caixaId: string = 'CAIXA01'): void {
    console.log(`🔧 FORcANDO CONFIGURAcaO COMO CLIENTE ${caixaId}...`);
    
    this.config.CAIXA_ID = caixaId;
    this.config.CAIXA_ROLE = 'client';
    this.config.NETWORK_PATH = '\\\\192.168.10.1\\PDV';
    
    this.createConfigFile();
    
    console.log(`✅ Configuracao forcada como cliente ${caixaId}!`);
    this.printConfiguration();
  }

  // Getters
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
    console.log(`🔄 Modo offline alterado para: ${offline}`);
  }

  // ✅ MELHORADO: Debug completo
  public printConfiguration(): void {
    console.log('🔧 ================================');
    console.log('🔧 === CONFIGURAcaO PDV DEBUG ===');
    console.log('🔧 ================================');
    console.log(`📋 Caixa ID: ${this.config.CAIXA_ID}`);
    console.log(`🎭 Papel: ${this.config.CAIXA_ROLE}`);
    console.log(`🌐 Rede habilitada: ${this.config.isNetworkEnabled}`);
    console.log(`📡 Modo offline: ${this.config.isOfflineMode}`);
    console.log(`📁 Caminho de rede: ${this.config.NETWORK_PATH}`);
    console.log(`💾 Backup local: ${this.getLocalBackupPath()}`);
    console.log(`🗄️ Banco principal: ${this.getNetworkDatabasePath()}`);
    console.log(`📂 Diretorio atual: ${process.cwd()}`);
    console.log(`🖥️ Hostname: ${os.hostname()}`);
    
    // ✅ NOVO: Variáveis de ambiente relevantes
    const envVars = ['PDV_ROLE', 'PDV_CAIXA_ID', 'PDV_NETWORK_PATH', 'PDV_SERVER_IP'];
    console.log('🌍 Variáveis de ambiente:');
    envVars.forEach(envVar => {
      const value = process.env[envVar];
      console.log(`   ${envVar}: ${value || 'NaO DEFINIDA'}`);
    });
    
    // Testar acessos
    const dbPath = this.getNetworkDatabasePath();
    const dbExists = fs.existsSync(dbPath);
    const dbDir = path.dirname(dbPath);
    const dirExists = fs.existsSync(dbDir);
    
    console.log(`📂 Diretorio existe: ${dirExists} (${dbDir})`);
    console.log(`🗄️ Banco existe: ${dbExists} (${dbPath})`);
    
    if (dbExists) {
      try {
        const stats = fs.statSync(dbPath);
        console.log(`📊 Tamanho banco: ${stats.size} bytes`);
        console.log(`🕒 Modificado: ${stats.mtime}`);
      } catch (error: any) {
        console.log(`⚠️ Erro ao ler stats: ${error.message}`);
      }
    }
    
    console.log('🔧 ================================');
  }

  public async testConnectivity(): Promise<void> {
    console.log('🔍 === TESTE DE CONECTIVIDADE COMPLETO ===');
    
    console.log(`1️⃣ Configuracao: ${this.config.CAIXA_ID} (${this.config.CAIXA_ROLE})`);
    
    this.ensureDirectoriesExist();
    
    const networkOK = await this.validateNetworkAccess();
    console.log(`2️⃣ Acessoa rede: ${networkOK ? '✅' : '❌'}`);
    
    const dbPath = this.getNetworkDatabasePath();
    const dbExists = fs.existsSync(dbPath);
    console.log(`3️⃣ Banco acessível: ${dbExists ? '✅' : '❌'} (${dbPath})`);
    
    if (dbExists) {
      try {
        fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
        console.log(`4️⃣ Permissoes RW: ✅`);
      } catch (error: any) {
        console.log(`4️⃣ Permissoes RW: ❌ (${error.message})`);
      }
    }
    
    console.log('🔍 ===========================');
  }
}