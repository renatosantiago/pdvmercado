import * as path from 'path';
import * as fs from 'fs';

export interface PdvClientConfig {
  caixaId: string;
  serverUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
  syncInterval: number;
}

export class ApiConfig {
  private static instance: ApiConfig;
  public config: PdvClientConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }

  private loadConfiguration(): PdvClientConfig {
    console.log('🔧 Carregando configuração da API...');
    
    // Valores padrão
    const defaultConfig: PdvClientConfig = {
      caixaId: 'CAIXA01',
      serverUrl: 'http://localhost:8080/api/pdv',
      apiKey: 'PDV-SECRET-KEY-2025',
      timeout: 10000,
      retries: 3,
      syncInterval: 300000 // 5 minutos
    };

    // Tentar carregar do .env.pdv
    const envPath = path.join('C:/PDV-Caixa', '.env.pdv');
    
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envConfig = this.parseEnvFile(envContent);
        
        return {
          ...defaultConfig,
          ...envConfig
        };
      } catch (error) {
        console.warn('⚠️ Erro ao carregar .env.pdv:', error);
      }
    }

    console.log('📋 Usando configuração padrão da API');
    return defaultConfig;
  }

  private parseEnvFile(content: string): Partial<PdvClientConfig> {
    const config: any = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();

        switch (key.trim()) {
          case 'PDV_CAIXA_ID':
            config.caixaId = value;
            break;
          case 'PDV_SERVER_URL':
            config.serverUrl = value;
            break;
          case 'PDV_API_KEY':
            config.apiKey = value;
            break;
          case 'PDV_API_TIMEOUT':
            config.timeout = parseInt(value) || 10000;
            break;
          case 'PDV_API_RETRIES':
            config.retries = parseInt(value) || 3;
            break;
          case 'PDV_SYNC_INTERVAL':
            config.syncInterval = parseInt(value) || 300000;
            break;
        }
      }
    }

    return config;
  }

  public createConfigFile(): void {
    const configContent = `# Configuração PDV Cliente - API
# Gerado automaticamente em ${new Date().toISOString()}

# ✅ IDENTIFICAÇÃO
PDV_CAIXA_ID=${this.config.caixaId}

# ✅ SERVIDOR API
PDV_SERVER_URL=${this.config.serverUrl}
PDV_API_KEY=${this.config.apiKey}

# ✅ CONFIGURAÇÕES DE REDE
PDV_API_TIMEOUT=${this.config.timeout}
PDV_API_RETRIES=${this.config.retries}
PDV_SYNC_INTERVAL=${this.config.syncInterval}

# ================================
# EXEMPLOS DE CONFIGURAÇÃO:
# ================================

# SERVIDOR LOCAL:
# PDV_SERVER_URL=http://127.0.0.1:8080/api/pdv

# SERVIDOR REMOTO:
# PDV_SERVER_URL=http://192.168.10.1:8080/api/pdv

# TIMEOUT PERSONALIZADO (10 segundos):
# PDV_API_TIMEOUT=10000

# SINCRONIZAÇÃO A CADA 2 MINUTOS:
# PDV_SYNC_INTERVAL=120000
`;

    const configPath = path.join('C:/PDV-Caixa', '.env.pdv');
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`📁 Arquivo de configuração API criado: ${configPath}`);
  }

  public printConfiguration(): void {
    console.log('🔧 ================================');
    console.log('🔧 === CONFIGURAÇÃO API PDV ===');
    console.log('🔧 ================================');
    console.log(`📋 Caixa ID: ${this.config.caixaId}`);
    console.log(`🌐 Server URL: ${this.config.serverUrl}`);
    console.log(`🔑 API Key: ${this.config.apiKey.substring(0, 8)}...`);
    console.log(`⏱️ Timeout: ${this.config.timeout}ms`);
    console.log(`🔄 Retries: ${this.config.retries}`);
    console.log(`⏰ Sync Interval: ${this.config.syncInterval}ms`);
    console.log('🔧 ================================');
  }
}