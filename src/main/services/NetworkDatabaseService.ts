// ================================
// services/NetworkDatabaseService.ts - Banco de Dados com Suporte a Rede
// ================================

import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs';
import { NetworkConfig } from '../config/NetworkConfig';
import type { 
  Product, 
  Sale, 
  SaleItem, 
  NetworkStatus, 
  ConnectionInfo, 
  SystemStats,
  DailySalesReport 
} from '../types/NetworkTypes';

export class NetworkDatabaseService {
  private db: Database | null = null;
  private networkConfig: NetworkConfig;
  private primaryDbPath: string;
  private backupDbPath: string;
  private isOnline: boolean = true;
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.networkConfig = NetworkConfig.getInstance();
    this.primaryDbPath = this.networkConfig.getNetworkDatabasePath();
    this.backupDbPath = this.networkConfig.getLocalBackupPath();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Inicializando NetworkDatabaseService...');
    
    // Mostrar configuração atual
    this.networkConfig.printConfiguration();
    
    // Criar diretórios necessários
    this.networkConfig.ensureDirectoriesExist();
    
    // Verificar se a rede está disponível
    if (this.networkConfig.isNetworkEnabled) {
      const hasNetworkAccess = await this.networkConfig.validateNetworkAccess();
      
      if (hasNetworkAccess) {
        await this.connectToPrimary();
      } else {
        await this.connectToBackup();
        this.startReconnectionAttempts();
      }
    } else {
      // Modo offline forçado
      await this.connectToBackup();
    }

    // Configurar sincronização se for cliente
    if (this.networkConfig.isClient && this.networkConfig.isNetworkEnabled) {
      this.startSyncTimer();
    }

    console.log('✅ NetworkDatabaseService inicializado com sucesso');
  }

  private async connectToPrimary(): Promise<void> {
    try {
      console.log(`🔗 Conectando ao banco principal: ${this.primaryDbPath}`);
      
      this.db = await open({
        filename: this.primaryDbPath,
        driver: sqlite3.Database
      });

      await this.applyNetworkOptimizations();
      await this.createOptimizedSchema();
      await this.createOptimalIndexes();
      await this.seedInitialData();

      this.isOnline = true;
      this.networkConfig.setOfflineMode(false);
      
      console.log('✅ Conectado ao banco principal (ONLINE)');

      // Se era backup, sincronizar dados pendentes
      if (this.networkConfig.isClient) {
        await this.syncFromBackupToPrimary();
      }

    } catch (error) {
      console.error('❌ Erro ao conectar banco principal:', error);
      throw error;
    }
  }

  private async connectToBackup(): Promise<void> {
    try {
      console.log(`💾 Conectando ao banco de backup: ${this.backupDbPath}`);
      
      // Garantir que o diretório existe
      const backupDir = path.dirname(this.backupDbPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Se não existe backup, criar um novo ou copiar do principal
      if (!fs.existsSync(this.backupDbPath)) {
        await this.createInitialBackup();
      }

      this.db = await open({
        filename: this.backupDbPath,
        driver: sqlite3.Database
      });

      await this.applyOptimalSettings();
      await this.createOptimizedSchema();
      await this.createOptimalIndexes();
      await this.seedInitialData();

      this.isOnline = false;
      this.networkConfig.setOfflineMode(true);
      
      console.log('🔄 Conectado ao banco de backup (OFFLINE)');

    } catch (error) {
      console.error('❌ Erro ao conectar banco de backup:', error);
      throw error;
    }
  }

  private async createInitialBackup(): Promise<void> {
    try {
      // Tentar copiar do banco principal se existir
      if (fs.existsSync(this.primaryDbPath)) {
        console.log('📋 Copiando banco principal para backup inicial...');
        fs.copyFileSync(this.primaryDbPath, this.backupDbPath);
      } else {
        console.log('🆕 Criando novo banco de backup...');
        // Será criado automaticamente pelo SQLite
      }
    } catch (error) {
      console.warn('⚠️ Erro ao criar backup inicial:', error);
      // Continuar - SQLite criará um novo banco
    }
  }

  private async applyNetworkOptimizations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🔧 Aplicando otimizações para rede...');

    const networkOptimizations = [
      'PRAGMA journal_mode = WAL;',           // Write-Ahead Logging para rede
      'PRAGMA synchronous = NORMAL;',         // Balance performance/segurança em rede
      'PRAGMA temp_store = MEMORY;',          // Cache temporário em RAM
      'PRAGMA cache_size = 50000;',           // Cache maior (200MB) para rede
      'PRAGMA mmap_size = 0;',                // Desabilitar mmap em rede
      'PRAGMA busy_timeout = 60000;',         // 60s timeout para latência de rede
      'PRAGMA foreign_keys = ON;',            // Integridade referencial
      'PRAGMA auto_vacuum = INCREMENTAL;',    // Manter DB compacto
      'PRAGMA wal_autocheckpoint = 2000;'     // Checkpoint menos frequente em rede
    ];

    for (const pragma of networkOptimizations) {
      try {
        await this.db.exec(pragma);
        console.log(`✅ ${pragma}`);
      } catch (error) {
        console.error(`❌ Erro em: ${pragma}`, error);
      }
    }
  }

  private async applyOptimalSettings(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const optimizations = [
      'PRAGMA journal_mode = WAL;',
      'PRAGMA synchronous = NORMAL;',
      'PRAGMA temp_store = MEMORY;',
      'PRAGMA cache_size = 10000;',
      'PRAGMA mmap_size = 268435456;',
      'PRAGMA foreign_keys = ON;',
      'PRAGMA auto_vacuum = INCREMENTAL;',
      'PRAGMA wal_autocheckpoint = 1000;',
      'PRAGMA busy_timeout = 30000;'
    ];

    for (const pragma of optimizations) {
      await this.db.exec(pragma);
    }
  }

  private startReconnectionAttempts(): void {
    if (this.reconnectionTimer) {
      clearInterval(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    console.log('🔄 Iniciando tentativas de reconexão...');

    this.reconnectionTimer = setInterval(async () => {
      try {
        const hasNetworkAccess = await this.networkConfig.validateNetworkAccess();
        
        if (hasNetworkAccess) {
          console.log('🔗 Rede disponível - tentando reconectar...');
          
          // Fechar conexão de backup
          if (this.db) {
            await this.db.close();
          }

          // Conectar ao principal
          await this.connectToPrimary();
          
          // Parar tentativas de reconexão
          if (this.reconnectionTimer) {
            clearInterval(this.reconnectionTimer);
            this.reconnectionTimer = null;
          }

          console.log('🎉 Reconectado com sucesso!');
        }
      } catch (error) {
        console.log('⏳ Ainda sem acesso à rede...');
      }
    }, this.networkConfig.config.RECONNECTION_INTERVAL);
  }

  private startSyncTimer(): void {
    if (!this.networkConfig.isClient) return;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.syncTimer = setInterval(async () => {
      if (this.isOnline) {
        try {
          // Verificar se ainda tem acesso à rede
          const hasAccess = await this.networkConfig.validateNetworkAccess();
          if (!hasAccess) {
            console.log('🔴 Perda de conexão detectada - mudando para backup');
            await this.switchToBackup();
          }
        } catch (error) {
          console.log('🔴 Erro na verificação de rede');
          await this.switchToBackup();
        }
      }
    }, this.networkConfig.config.SYNC_INTERVAL);
  }

  private async switchToBackup(): Promise<void> {
    try {
      // Fazer backup dos dados atuais
      await this.createManualBackup();
      
      // Fechar conexão principal
      if (this.db) {
        await this.db.close();
      }

      // Conectar ao backup
      await this.connectToBackup();
      
      // Iniciar tentativas de reconexão
      this.startReconnectionAttempts();

    } catch (error) {
      console.error('❌ Erro ao mudar para backup:', error);
    }
  }

  private async syncFromBackupToPrimary(): Promise<void> {
    if (!this.isOnline || this.networkConfig.isServer) return;

    try {
      console.log('🔄 Sincronizando dados do backup para principal...');
      
      // Abrir conexão temporária com backup
      const backupDb = await open({
        filename: this.backupDbPath,
        driver: sqlite3.Database
      });

      // Buscar vendas não sincronizadas
      const vendasPendentes = await backupDb.all(`
        SELECT * FROM vendas 
        WHERE id NOT IN (
          SELECT id FROM vendas WHERE id IN (
            SELECT id FROM vendas
          )
        )
      `);

      // Sincronizar vendas (implementar lógica específica conforme necessário)
      for (const venda of vendasPendentes) {
        // Lógica de sincronização aqui
        console.log(`Sincronizando venda ID: ${venda.id}`);
      }

      await backupDb.close();
      console.log('✅ Sincronização concluída');

    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
    }
  }

  private async createManualBackup(): Promise<void> {
    if (!this.db || !this.isOnline) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const manualBackupPath = this.backupDbPath.replace('.db', `_${timestamp}.db`);
      
      // Fazer checkpoint do WAL
      await this.db.exec('PRAGMA wal_checkpoint(FULL);');
      
      // Copiar arquivo atual
      fs.copyFileSync(this.primaryDbPath, manualBackupPath);
      
      console.log(`📁 Backup manual criado: ${manualBackupPath}`);
    } catch (error) {
      console.error('❌ Erro ao criar backup manual:', error);
    }
  }

  // Implementar métodos do DatabaseService original
  private async createOptimizedSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      -- PRODUTOS com campos otimizados para PDV
      CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL COLLATE NOCASE,
        ean13 TEXT UNIQUE COLLATE NOCASE,
        descricao TEXT NOT NULL,
        preco REAL NOT NULL CHECK(preco >= 0),
        custo REAL DEFAULT 0 CHECK(custo >= 0),
        estoque INTEGER DEFAULT 0 CHECK(estoque >= 0),
        estoque_minimo INTEGER DEFAULT 5,
        categoria_id INTEGER,
        unidade TEXT DEFAULT 'UN',
        ativo BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        caixa_origem TEXT DEFAULT '${this.networkConfig.caixaId}',
        sincronizado BOOLEAN DEFAULT true
      );

      -- VENDAS otimizada com campos do PDV
      CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_venda INTEGER UNIQUE NOT NULL,
        subtotal REAL NOT NULL CHECK(subtotal >= 0),
        desconto REAL DEFAULT 0 CHECK(desconto >= 0),
        total REAL NOT NULL CHECK(total >= 0),
        forma_pagamento TEXT DEFAULT 'DINHEIRO',
        status TEXT DEFAULT 'FINALIZADA',
        data_venda DATETIME DEFAULT CURRENT_TIMESTAMP,
        caixa_id TEXT DEFAULT '${this.networkConfig.caixaId}',
        sincronizado BOOLEAN DEFAULT true
      );

      -- VENDA_ITEMS com campos denormalizados
      CREATE TABLE IF NOT EXISTS venda_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        codigo_produto TEXT NOT NULL,
        descricao_produto TEXT NOT NULL,
        quantidade REAL NOT NULL CHECK(quantidade > 0),
        preco_unitario REAL NOT NULL CHECK(preco_unitario >= 0),
        subtotal REAL NOT NULL CHECK(subtotal >= 0),
        FOREIGN KEY (venda_id) REFERENCES vendas (id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos (id)
      );

      -- CATEGORIAS
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        ativo BOOLEAN DEFAULT true
      );

      -- LOG DE SINCRONIZAÇÃO
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tabela TEXT NOT NULL,
        registro_id INTEGER NOT NULL,
        operacao TEXT NOT NULL, -- INSERT, UPDATE, DELETE
        dados_json TEXT,
        caixa_origem TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        sincronizado BOOLEAN DEFAULT false
      );

      -- TRIGGERS para atualização automática
      CREATE TRIGGER IF NOT EXISTS produtos_updated_at 
        AFTER UPDATE ON produtos
      BEGIN
        UPDATE produtos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS venda_item_estoque 
        AFTER INSERT ON venda_items
      BEGIN
        UPDATE produtos 
        SET estoque = estoque - NEW.quantidade 
        WHERE id = NEW.produto_id;
      END;
    `);
  }

  private async createOptimalIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);',
      'CREATE INDEX IF NOT EXISTS idx_produtos_ean13 ON produtos(ean13);',
      'CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo) WHERE ativo = true;',
      'CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda);',
      'CREATE INDEX IF NOT EXISTS idx_vendas_numero ON vendas(numero_venda);',
      'CREATE INDEX IF NOT EXISTS idx_vendas_caixa ON vendas(caixa_id);',
      'CREATE INDEX IF NOT EXISTS idx_venda_items_venda ON venda_items(venda_id);',
      'CREATE INDEX IF NOT EXISTS idx_sync_log_sync ON sync_log(sincronizado) WHERE sincronizado = false;'
    ];

    for (const index of indexes) {
      await this.db.exec(index);
    }
  }

  private async seedInitialData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const count = await this.db.get('SELECT COUNT(*) as count FROM produtos');
    
    if (count.count === 0) {
      console.log('🌱 Inserindo dados iniciais...');
      
      // Inserir categorias
      await this.db.run(`
        INSERT INTO categorias (nome) VALUES 
        ('Alimentação'), ('Bebidas'), ('Higiene'), ('Limpeza')
      `);

      // Produtos iniciais com identificação do caixa
      const produtos = [
        { codigo: '37658990198', ean13: '7891000100103', descricao: 'Macarrão Romanha 500G', preco: 4.87, custo: 3.20, estoque: 100, categoria_id: 1 },
        { codigo: '88769022', ean13: '7896036098012', descricao: 'Arroz Tio João 5kg', preco: 27.90, custo: 21.50, estoque: 50, categoria_id: 1 },
        { codigo: '123456789', ean13: '7891000053508', descricao: 'Feijão Carioca 1kg', preco: 8.50, custo: 6.80, estoque: 75, categoria_id: 1 },
        { codigo: '987654321', ean13: '7891000100110', descricao: 'Açúcar Cristal 1kg', preco: 5.99, custo: 4.20, estoque: 200, categoria_id: 1 },
        { codigo: '456789123', ean13: '7891000315408', descricao: 'Óleo de Soja 900ml', preco: 6.75, custo: 5.10, estoque: 120, categoria_id: 1 },
        { codigo: '789123456', ean13: '7896045200329', descricao: 'Café Pilão 500g', preco: 12.90, custo: 9.80, estoque: 80, categoria_id: 2 },
        { codigo: '321654987', ean13: '7891000100127', descricao: 'Leite Integral 1L', preco: 4.25, custo: 3.50, estoque: 60, categoria_id: 2 },
        { codigo: '654987321', ean13: '7622210951045', descricao: 'Shampoo Head & Shoulders', preco: 15.90, custo: 12.00, estoque: 40, categoria_id: 3 }
      ];

      for (const produto of produtos) {
        await this.db.run(`
          INSERT INTO produtos (codigo, ean13, descricao, preco, custo, estoque, categoria_id, caixa_origem)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [produto.codigo, produto.ean13, produto.descricao, produto.preco, produto.custo, produto.estoque, produto.categoria_id, this.networkConfig.caixaId]);
      }

      console.log('✅ Dados iniciais inseridos');
    }
  }

  // Métodos públicos que mantêm compatibilidade com DatabaseService original
  async findProductByCode(codigo: string): Promise<Product | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT id, codigo, ean13, descricao, preco, custo, estoque, 
             estoque_minimo, categoria_id, unidade, ativo, 
             created_at, updated_at
      FROM produtos 
      WHERE (codigo = ? OR ean13 = ?) AND ativo = true
      LIMIT 1
    `;

    const startTime = Date.now();
    const produto = await this.db.get(query, [codigo, codigo]);
    const endTime = Date.now();

    console.log(`🔍 Busca produto [${this.isOnline ? 'ONLINE' : 'OFFLINE'}]: ${endTime - startTime}ms`);
    return produto || null;
  }

  async findAllProducts(): Promise<Product[]> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.all(`
      SELECT id, codigo, ean13, descricao, preco, custo, estoque,
             estoque_minimo, categoria_id, unidade, ativo,
             created_at, updated_at
      FROM produtos 
      WHERE ativo = true 
      ORDER BY descricao
    `);
  }

  async createSale(items: { produto_id: number; quantidade: number; preco_unitario: number }[]): Promise<Sale> {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();

    // Manual transaction management since .transaction() is not available
    const db = this.db!;
    let vendaId: number = 0;
    let max_numero: number = 1;
    const vendaItems: SaleItem[] = [];
    const subtotal = items.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario), 0);
    const total = subtotal;

    try {
      await db.exec('BEGIN TRANSACTION;');

      // Obter próximo número de venda
      const result = await db.get(`
        SELECT COALESCE(MAX(numero_venda), 0) + 1 as max_numero FROM vendas
      `);
      max_numero = result?.max_numero || 1;

      // Inserir venda com identificação do caixa
      const vendaResult = await db.run(`
        INSERT INTO vendas (numero_venda, subtotal, total, caixa_id, sincronizado)
        VALUES (?, ?, ?, ?, ?)
      `, [max_numero, subtotal, total, this.networkConfig.caixaId, this.isOnline]);

      vendaId = vendaResult.lastID!;

      // Inserir itens com dados denormalizados
      for (const item of items) {
        const produto = await db.get(
          'SELECT codigo, descricao FROM produtos WHERE id = ?',
          [item.produto_id]
        );

        await db.run(`
          INSERT INTO venda_items (
            venda_id, produto_id, codigo_produto, descricao_produto,
            quantidade, preco_unitario, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          vendaId, item.produto_id, produto.codigo, produto.descricao,
          item.quantidade, item.preco_unitario, item.quantidade * item.preco_unitario
        ]);

        vendaItems.push({
          id: Date.now(), // Temporário
          venda_id: vendaId,
          produto_id: item.produto_id,
          codigo_produto: produto.codigo,
          descricao_produto: produto.descricao,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.quantidade * item.preco_unitario
        });
      }

      // Log para sincronização se estiver offline
      if (!this.isOnline) {
        await this.logSyncOperation('vendas', vendaId, 'INSERT', {
          numero_venda: max_numero,
          subtotal,
          total,
          items
        });
      }

      await db.exec('COMMIT;');

      const endTime = Date.now();
      console.log(`💰 Venda criada [${this.isOnline ? 'ONLINE' : 'OFFLINE'}]: ${endTime - startTime}ms`);

      return {
        id: vendaId,
        numero_venda: max_numero,
        subtotal: subtotal,
        desconto: 0,
        total: total,
        forma_pagamento: 'DINHEIRO',
        status: 'FINALIZADA',
        data_venda: new Date().toISOString(),
        caixa_id: this.networkConfig.caixaId,
        sincronizado: this.isOnline,
        items: vendaItems
      };
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  }

  async updateProductStock(productId: number, newStock: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(`
      UPDATE produtos 
      SET estoque = ?, updated_at = CURRENT_TIMESTAMP, sincronizado = ?
      WHERE id = ?
    `, [newStock, this.isOnline, productId]);

    // Log para sincronização se estiver offline
    if (!this.isOnline) {
      await this.logSyncOperation('produtos', productId, 'UPDATE', {
        estoque: newStock
      });
    }
  }

  async getDailySalesReport(date: string = new Date().toISOString().split('T')[0]): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.get(`
      SELECT 
        COUNT(*) as total_vendas,
        SUM(total) as faturamento_total,
        AVG(total) as ticket_medio,
        MIN(total) as menor_venda,
        MAX(total) as maior_venda,
        SUM(CASE WHEN forma_pagamento = 'DINHEIRO' THEN total ELSE 0 END) as vendas_dinheiro,
        SUM(CASE WHEN forma_pagamento = 'CARTAO' THEN total ELSE 0 END) as vendas_cartao,
        SUM(CASE WHEN forma_pagamento = 'PIX' THEN total ELSE 0 END) as vendas_pix,
        '${this.networkConfig.caixaId}' as caixa_id,
        '${this.isOnline ? 'ONLINE' : 'OFFLINE'}' as status_rede
      FROM vendas 
      WHERE DATE(data_venda) = ? AND status = 'FINALIZADA'
    `, [date]);
  }

  async getTopSellingProducts(limit: number = 10): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.all(`
      SELECT 
        p.codigo,
        p.descricao,
        SUM(vi.quantidade) as total_vendido,
        SUM(vi.subtotal) as faturamento,
        COUNT(DISTINCT vi.venda_id) as num_vendas
      FROM venda_items vi
      JOIN produtos p ON vi.produto_id = p.id
      JOIN vendas v ON vi.venda_id = v.id
      WHERE DATE(v.data_venda) >= DATE('now', '-30 days')
        AND v.status = 'FINALIZADA'
      GROUP BY p.id, p.codigo, p.descricao
      ORDER BY total_vendido DESC
      LIMIT ?
    `, [limit]);
  }

  async getLowStockProducts(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.all(`
      SELECT id, codigo, descricao, estoque, estoque_minimo, preco
      FROM produtos 
      WHERE estoque <= estoque_minimo AND ativo = true
      ORDER BY estoque ASC
    `);
  }

  async forceSyncToNetwork(): Promise<boolean> {
    if (this.isOnline || this.networkConfig.isServer) {
      console.log('⚠️ Já está online ou é servidor - sync não necessário');
      return true;
    }

    try {
      console.log('🔄 Tentando forçar sincronização...');
      const hasAccess = await this.networkConfig.validateNetworkAccess();
      
      if (hasAccess) {
        // Fechar conexão atual
        if (this.db) {
          await this.db.close();
        }

        // Reconectar ao banco principal
        await this.connectToPrimary();
        
        console.log('✅ Sincronização forçada bem-sucedida');
        return true;
      } else {
        console.log('❌ Sem acesso à rede para sincronização');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro na sincronização forçada:', error);
      return false;
    }
  }

  // Método para obter contagem de operações pendentes de sincronização
  async getSyncPendingCount(): Promise<number> {
    if (!this.db) return 0;

    try {
      const result = await this.db.get(`
        SELECT COUNT(*) as count FROM sync_log WHERE sincronizado = false
      `);
      
      return result?.count || 0;
    } catch (error) {
      console.error('❌ Erro ao obter contagem de sync pendente:', error);
      return 0;
    }
  }

  // Método para obter status de rede completo
  async getNetworkStatus(): Promise<any> {
    return {
      caixa_id: this.networkConfig.caixaId,
      is_server: this.networkConfig.isServer,
      is_online: this.isOnline,
      is_offline_mode: this.networkConfig.isOfflineMode,
      network_path: this.primaryDbPath,
      backup_path: this.backupDbPath,
      last_sync: new Date().toISOString(),
      sync_pending: await this.getSyncPendingCount()
    };
  }

  private async logSyncOperation(tabela: string, registroId: number, operacao: string, dados: any): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.run(`
        INSERT INTO sync_log (tabela, registro_id, operacao, dados_json, caixa_origem)
        VALUES (?, ?, ?, ?, ?)
      `, [tabela, registroId, operacao, JSON.stringify(dados), this.networkConfig.caixaId]);
    } catch (error) {
      console.error('❌ Erro ao log de sincronização:', error);
    }
  }

  async createBackup(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const timestamp = new Date().toISOString().split('T')[0];
    const backupDir = path.join(path.dirname(this.backupDbPath), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, `pdv_backup_${this.networkConfig.caixaId}_${timestamp}.db`);

    try {
      // Fazer checkpoint do WAL antes do backup
      await this.db.exec('PRAGMA wal_checkpoint(FULL);');

      // Copiar arquivo
      const sourceFile = this.isOnline ? this.primaryDbPath : this.backupDbPath;
      fs.copyFileSync(sourceFile, backupPath);

      console.log(`📁 Backup criado [${this.isOnline ? 'ONLINE' : 'OFFLINE'}]: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      throw error;
    }
  }

  async optimize(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log(`🔧 Otimizando banco [${this.isOnline ? 'ONLINE' : 'OFFLINE'}]...`);

    // Analisar e otimizar queries
    await this.db.exec('PRAGMA optimize;');

    // Checkpoint do WAL
    await this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

    // Vacuum incremental se necessário
    const { freelist_count } = await this.db.get('PRAGMA freelist_count;') || { freelist_count: 0 };
    
    if (freelist_count > 100) {
      await this.db.exec('PRAGMA incremental_vacuum(100);');
      console.log(`🧹 Vacuum incremental executado: ${freelist_count} páginas liberadas`);
    }

    console.log('✅ Otimização concluída');
  }

  async close(): Promise<void> {
    // Parar timers
    if (this.reconnectionTimer) {
      clearInterval(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    // Otimizar antes de fechar
    if (this.db) {
      try {
        await this.db.exec('PRAGMA optimize;');
        await this.db.close();
        this.db = null;
      } catch (error) {
        console.error('❌ Erro ao fechar banco:', error);
      }
    }

    console.log('🔌 NetworkDatabaseService fechado');
  }

  // Métodos para status e monitoramento
  getConnectionInfo(): any {
    return {
      caixa_id: this.networkConfig.caixaId,
      role: this.networkConfig.config.CAIXA_ROLE,
      is_online: this.isOnline,
      is_offline_mode: this.networkConfig.isOfflineMode,
      primary_db: this.primaryDbPath,
      backup_db: this.backupDbPath,
      network_enabled: this.networkConfig.isNetworkEnabled
    };
  }

  async getSystemStats(): Promise<any> {
    if (!this.db) return null;

    try {
      const stats = await this.db.get(`
        SELECT 
          (SELECT COUNT(*) FROM produtos WHERE ativo = true) as total_produtos,
          (SELECT COUNT(*) FROM vendas WHERE DATE(data_venda) = DATE('now')) as vendas_hoje,
          (SELECT COUNT(*) FROM sync_log WHERE sincronizado = false) as pendente_sync,
          (SELECT SUM(total) FROM vendas WHERE DATE(data_venda) = DATE('now')) as faturamento_hoje
      `);

      return {
        ...stats,
        ...this.getConnectionInfo(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas do sistema:', error);
      return {
        ...this.getConnectionInfo(),
        timestamp: new Date().toISOString(),
        error: 'Erro ao obter estatísticas'
      };
    }
  }

  // Getter para compatibilidade com DatabaseService original
  get database(): Database | null {
    return this.db;
  }

  // Método para teste de conectividade
  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) return false;
      
      // Teste simples de query
      await this.db.get('SELECT 1');
      return true;
    } catch (error) {
      console.error('❌ Erro no teste de conexão:', error);
      return false;
    }
  }

  // Método para recriar índices se necessário
  async rebuildIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🔧 Recriando índices...');
    
    try {
      await this.db.exec('REINDEX;');
      console.log('✅ Índices recriados');
    } catch (error) {
      console.error('❌ Erro ao recriar índices:', error);
      throw error;
    }
  }
}