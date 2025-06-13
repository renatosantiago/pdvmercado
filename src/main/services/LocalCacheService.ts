import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs';
import type { Product } from '../types/NetworkTypes';

export class LocalCacheService {
  private db: Database | null = null;
  private cacheDbPath: string;
  private lastSyncTime: Date | null = null;
  
  constructor(caixaId: string) {
    const dataDir = path.join(process.cwd(), 'data', 'cache');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.cacheDbPath = path.join(dataDir, `cache_${caixaId.toLowerCase()}.db`);
  }
  
  async initialize(): Promise<void> {
    console.log('🗃️ Inicializando cache local...');
    
    this.db = await open({
      filename: this.cacheDbPath,
      driver: sqlite3.Database
    });
    
    // Otimizações para cache local
    await this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = 10000;
      PRAGMA foreign_keys = ON;
    `);
    
    await this.createCacheSchema();
    await this.loadLastSyncTime();
    
    console.log('✅ Cache local inicializado');
  }
  
  private async createCacheSchema(): Promise<void> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    await this.db.exec(`
      -- Cache de produtos
      CREATE TABLE IF NOT EXISTS cache_produtos (
        id INTEGER PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        ean13 TEXT,
        descricao TEXT NOT NULL,
        preco REAL NOT NULL,
        custo REAL DEFAULT 0,
        estoque INTEGER DEFAULT 0,
        estoque_minimo INTEGER DEFAULT 5,
        categoria_id INTEGER,
        unidade TEXT DEFAULT 'UN',
        ativo BOOLEAN DEFAULT true,
        created_at TEXT,
        updated_at TEXT,
        caixa_origem TEXT,
        cached_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Fila de vendas para sincronização
      CREATE TABLE IF NOT EXISTS vendas_pendentes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_data TEXT NOT NULL,
        status TEXT DEFAULT 'PENDENTE',
        tentativas INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT
      );
      
      -- Log de sincronização
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL, -- 'PRODUTOS', 'VENDAS'
        status TEXT NOT NULL, -- 'SUCCESS', 'ERROR'
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        detalhes TEXT
      );
      
      -- Configurações do cache
      CREATE TABLE IF NOT EXISTS cache_config (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_cache_produtos_codigo ON cache_produtos(codigo);
      CREATE INDEX IF NOT EXISTS idx_cache_produtos_ean13 ON cache_produtos(ean13);
      CREATE INDEX IF NOT EXISTS idx_cache_produtos_ativo ON cache_produtos(ativo) WHERE ativo = true;
      CREATE INDEX IF NOT EXISTS idx_vendas_pendentes_status ON vendas_pendentes(status);
    `);
  }
  
  async syncProdutos(produtos: Product[]): Promise<void> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    console.log(`📥 Sincronizando ${produtos.length} produtos para cache...`);
    
    // Transação para melhor performance
    await this.db.exec('BEGIN TRANSACTION');
    
    try {
      // Limpar cache atual
      await this.db.run('DELETE FROM cache_produtos');
      
      // Inserir produtos atualizados
      const stmt = await this.db.prepare(`
        INSERT INTO cache_produtos (
          id, codigo, ean13, descricao, preco, custo, estoque, 
          estoque_minimo, categoria_id, unidade, ativo, 
          created_at, updated_at, caixa_origem
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const produto of produtos) {
        await stmt.run([
          produto.id,
          produto.codigo,
          produto.ean13,
          produto.descricao,
          produto.preco,
          produto.custo,
          produto.estoque,
          produto.estoque_minimo,
          produto.categoria_id,
          produto.unidade,
          produto.ativo,
          produto.created_at,
          produto.updated_at,
          produto.caixa_origem
        ]);
      }
      
      await stmt.finalize();
      await this.db.exec('COMMIT');
      
      // Atualizar timestamp de sincronização
      this.lastSyncTime = new Date();
      await this.updateSyncTime();
      
      // Log de sucesso
      await this.logSync('PRODUTOS', 'SUCCESS', `${produtos.length} produtos sincronizados`);
      
      console.log('✅ Cache de produtos atualizado');
    } catch (error: any) {
      await this.db.exec('ROLLBACK');
      await this.logSync('PRODUTOS', 'ERROR', error.message);
      throw error;
    }
  }
  
  async findProductByCode(codigo: string): Promise<Product | null> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    const produto = await this.db.get(`
      SELECT * FROM cache_produtos 
      WHERE (codigo = ? OR ean13 = ?) AND ativo = true
      LIMIT 1
    `, [codigo, codigo]);
    
    return produto || null;
  }
  
  async getAllProducts(): Promise<Product[]> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    return await this.db.all(`
      SELECT * FROM cache_produtos 
      WHERE ativo = true 
      ORDER BY descricao
    `);
  }
  
  async searchProducts(termo: string): Promise<Product[]> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    const searchTerm = `%${termo}%`;
    return await this.db.all(`
      SELECT * FROM cache_produtos 
      WHERE (descricao LIKE ? OR codigo LIKE ? OR ean13 LIKE ?) 
        AND ativo = true 
      ORDER BY descricao 
      LIMIT 50
    `, [searchTerm, searchTerm, searchTerm]);
  }
  
  async addPendingSale(vendaData: any): Promise<void> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    await this.db.run(`
      INSERT INTO vendas_pendentes (venda_data, status)
      VALUES (?, 'PENDENTE')
    `, [JSON.stringify(vendaData)]);
    
    console.log('💾 Venda adicionada à fila de sincronização');
  }
  
  async getPendingSales(): Promise<any[]> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    return await this.db.all(`
      SELECT * FROM vendas_pendentes 
      WHERE status = 'PENDENTE' 
      ORDER BY created_at ASC
    `);
  }
  
  async markSaleAsSynced(id: number): Promise<void> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    await this.db.run(`
      UPDATE vendas_pendentes 
      SET status = 'SINCRONIZADA' 
      WHERE id = ?
    `, [id]);
  }
  
  async markSaleAsError(id: number, errorMessage: string): Promise<void> {
    if (!this.db) throw new Error('Cache database not initialized');
    
    await this.db.run(`
      UPDATE vendas_pendentes 
      SET status = 'ERRO', tentativas = tentativas + 1, error_message = ?
      WHERE id = ?
    `, [errorMessage, id]);
  }
  
  async getLastSyncTime(): Promise<Date | null> {
    return this.lastSyncTime;
  }
  
  private async loadLastSyncTime(): Promise<void> {
    if (!this.db) return;
    
    const result = await this.db.get(`
      SELECT valor FROM cache_config WHERE chave = 'last_sync_time'
    `);
    
    if (result?.valor) {
      this.lastSyncTime = new Date(result.valor);
    }
  }
  
  private async updateSyncTime(): Promise<void> {
    if (!this.db) return;
    
    await this.db.run(`
      INSERT OR REPLACE INTO cache_config (chave, valor, updated_at)
      VALUES ('last_sync_time', ?, CURRENT_TIMESTAMP)
    `, [this.lastSyncTime?.toISOString()]);
  }
  
  private async logSync(tipo: string, status: string, detalhes: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.run(`
      INSERT INTO sync_log (tipo, status, detalhes)
      VALUES (?, ?, ?)
    `, [tipo, status, detalhes]);
  }
  
  async getCacheStats(): Promise<any> {
    if (!this.db) return null;
    
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_produtos,
        (SELECT COUNT(*) FROM vendas_pendentes WHERE status = 'PENDENTE') as vendas_pendentes,
        (SELECT valor FROM cache_config WHERE chave = 'last_sync_time') as ultima_sync
    `);
    
    return {
      ...stats,
      cache_size_mb: this.getCacheSize(),
      ultima_sync: stats.ultima_sync ? new Date(stats.ultima_sync) : null
    };
  }
  
  private getCacheSize(): number {
    try {
      const stats = fs.statSync(this.cacheDbPath);
      return Math.round(stats.size / 1024 / 1024 * 100) / 100; // MB
    } catch (error) {
      return 0;
    }
  }
  
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('🔒 Cache local fechado');
    }
  }
}