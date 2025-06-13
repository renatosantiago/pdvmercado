import { HttpApiService, ApiConfig } from './HttpApiService';
import { LocalCacheService } from './LocalCacheService';
import type { Product, Sale } from '../types/NetworkTypes';

export class PdvApiService {
  private httpApi: HttpApiService;
  private cache: LocalCacheService;
  private isOnline: boolean = true;
  private syncInterval: NodeJS.Timeout | null = null;
  private caixaId: string;
  
  constructor(caixaId: string, apiConfig: ApiConfig) {
    this.caixaId = caixaId;
    this.httpApi = new HttpApiService(apiConfig);
    this.cache = new LocalCacheService(caixaId);
  }
  
  async initialize(): Promise<void> {
    console.log('🚀 Inicializando PdvApiService...');
    
    // Inicializar cache local
    await this.cache.initialize();
    
    // Tentar sincronização inicial
    await this.syncProducts();
    
    // Configurar sincronização automática a cada 5 minutos
    // this.startAutoSync();
    
    console.log('✅ PdvApiService inicializado');
  }
  
  async findProductByCode(codigo: string): Promise<Product | null> {
    try {
      // 1. Tentar buscar no cache local primeiro (mais rápido)
      let produto = await this.cache.findProductByCode(codigo);
      
      if (produto) {
        console.log(`📦 Produto encontrado no cache: ${codigo}`);
        return produto;
      }
      
      // 2. Se não encontrou no cache e está online, tentar na API
      if (this.isOnline) {
        console.log(`🌐 Buscando produto na API: ${codigo}`);
        const response = await this.httpApi.get<Product>(`/produtos/codigo/${codigo}`);
        
        if (response.success && response.data) {
          return response.data;
        }
      }
      
      // 3. Produto não encontrado
      console.log(`❌ Produto não encontrado: ${codigo}`);
      return null;
      
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      // Em caso de erro, tentar cache como fallback
      return await this.cache.findProductByCode(codigo);
    }
  }
  
  async createSale(vendaData: any): Promise<Sale> {
    try {
      console.log('💰 Criando venda...', vendaData);
      
      // Preparar dados da venda
      const salePayload = {
        subtotal: vendaData.items.reduce((sum: number, item: any) => 
          sum + (item.quantidade * item.preco_unitario), 0),
        desconto: 0,
        total: vendaData.items.reduce((sum: number, item: any) => 
          sum + (item.quantidade * item.preco_unitario), 0),
        formaPagamento: 'DINHEIRO',
        status: 'FINALIZADA',
        caixaId: this.caixaId,
        items: vendaData.items.map((item: any) => ({
          codigo: item.codigo,
          quantidade: item.quantidade,
          precoUnitario: item.preco_unitario
        }))
      };
      
      if (this.isOnline) {
        // Tentar enviar direto para a API
        const response = await this.httpApi.post<Sale>('/vendas', salePayload);
        
        if (response.success && response.data) {
          console.log('✅ Venda sincronizada em tempo real');
          return response.data;
        } else {
          throw new Error(response.error || 'Erro ao criar venda na API');
        }
      } else {
        // Modo offline - adicionar à fila
        await this.cache.addPendingSale(salePayload);
        
        // Retornar venda "fake" para o frontend
        const fakeVenda: Sale = {
          id: Date.now(),
          numero_venda: Date.now(),
          subtotal: salePayload.subtotal,
          desconto: salePayload.desconto,
          total: salePayload.total,
          forma_pagamento: salePayload.formaPagamento,
          status: salePayload.status,
          data_venda: new Date().toISOString(),
          caixa_id: this.caixaId,
          sincronizado: false
        };
        
        console.log('💾 Venda salva para sincronização posterior');
        return fakeVenda;
      }
      
    } catch (error) {
      console.error('Erro ao criar venda:', error);
      
      // Fallback - salvar no cache para sincronizar depois
      await this.cache.addPendingSale(vendaData);
      throw error;
    }
  }
  
  async syncProducts(force: boolean = false): Promise<boolean> {
    try {
      console.log('🔄 Iniciando sincronização de produtos...');
      
      let ultimaSync = null;
      if (!force) {
        ultimaSync = await this.cache.getLastSyncTime();
      }
      
      // Buscar produtos da API
      const params = ultimaSync ? { ultimaSync: ultimaSync.toISOString() } : {};
      const response = await this.httpApi.get<Product[]>('/produtos/sync', params);
      
      if (response.success && response.data) {
        await this.cache.syncProdutos(response.data);
        this.isOnline = true;
        
        console.log(`✅ Sincronização concluída: ${response.data.length} produtos`);
        return true;
      } else {
        throw new Error(response.error || 'Erro na sincronização');
      }
      
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      this.isOnline = false;
      return false;
    }
  }
  
  async syncPendingSales(): Promise<void> {
    try {
      const pendingSales = await this.cache.getPendingSales();
      
      if (pendingSales.length === 0) {
        console.log('📭 Nenhuma venda pendente para sincronizar');
        return;
      }
      
      console.log(`📤 Sincronizando ${pendingSales.length} vendas pendentes...`);
      
      for (const sale of pendingSales) {
        try {
          const vendaData = JSON.parse(sale.venda_data);
          const response = await this.httpApi.post<Sale>('/vendas', vendaData);
          
          if (response.success) {
            await this.cache.markSaleAsSynced(sale.id);
            console.log(`✅ Venda ${sale.id} sincronizada`);
          } else {
            await this.cache.markSaleAsError(sale.id, response.error || 'Erro desconhecido');
            console.error(`❌ Erro ao sincronizar venda ${sale.id}:`, response.error);
          }
        } catch (error: any) {
          await this.cache.markSaleAsError(sale.id, error.message);
          console.error(`❌ Erro ao sincronizar venda ${sale.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Erro na sincronização de vendas:', error);
    }
  }
  
  private startAutoSync(): void {
    // Sincronizar a cada 5 minutos
    this.syncInterval = setInterval(async () => {
      await this.syncProducts();
      await this.syncPendingSales();
    }, 5 * 60 * 1000);
    
    console.log('⏰ Sincronização automática configurada (5min)');
  }
  
  async forceSync(): Promise<boolean> {
    console.log('🔄 Sincronização forçada pelo usuário...');
    const success = await this.syncProducts(true);
    await this.syncPendingSales();
    return success;
  }
  
  async getStatus(): Promise<any> {
    const cacheStats = await this.cache.getCacheStats();
    
    return {
      caixa_id: this.caixaId,
      is_online: this.isOnline,
      api_available: this.isOnline,
      cache: cacheStats,
      last_sync: cacheStats.ultima_sync,
      pending_sales: cacheStats.vendas_pendentes || 0
    };
  }
  
  async searchProducts(termo: string): Promise<Product[]> {
    // Buscar sempre no cache local para performance
    return await this.cache.searchProducts(termo);
  }
  
  async getAllProducts(): Promise<Product[]> {
    return await this.cache.getAllProducts();
  }
  
  async close(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    await this.cache.close();
    console.log('🔒 PdvApiService fechado');
  }
}