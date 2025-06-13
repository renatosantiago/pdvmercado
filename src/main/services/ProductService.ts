import { PdvApiService } from './PdvApiService';
import type { Product } from '../types/NetworkTypes';

export class ProductService {
  private apiService: PdvApiService;

  constructor(apiService: PdvApiService) {
    this.apiService = apiService;
  }

  async findByCode(codigo: string): Promise<Product> {
    if (!codigo || typeof codigo !== 'string') {
      throw new Error('Código é obrigatório e deve ser uma string');
    }

    try {
      const produto = await this.apiService.findProductByCode(codigo.trim());
      
      if (!produto) {
        throw new Error(`Produto com código "${codigo}" não encontrado`);
      }

      return produto;
    } catch (error: any) {
      console.error('Erro no ProductService.findByCode:', error);
      throw new Error(error.message || 'Erro ao buscar produto');
    }
  }

  async findAll(): Promise<Product[]> {
    try {
      return await this.apiService.getAllProducts();
    } catch (error: any) {
      console.error('Erro no ProductService.findAll:', error);
      throw new Error(error.message || 'Erro ao buscar produtos');
    }
  }

  async searchProducts(termo: string): Promise<Product[]> {
    try {
      return await this.apiService.searchProducts(termo);
    } catch (error: any) {
      console.error('Erro no ProductService.searchProducts:', error);
      throw new Error(error.message || 'Erro na busca de produtos');
    }
  }

  async createSale(vendaData: { items: any[] }): Promise<any> {
    if (!vendaData || !vendaData.items || !Array.isArray(vendaData.items)) {
      throw new Error('Dados da venda inválidos - items é obrigatório');
    }

    if (vendaData.items.length === 0) {
      throw new Error('Venda deve conter pelo menos um item');
    }

    try {
      // Validar itens
      for (const item of vendaData.items) {
        if (!item.codigo || !item.quantidade || !item.preco_unitario) {
          throw new Error('Item inválido - código, quantidade e preço são obrigatórios');
        }

        // Verificar se produto existe no cache
        const produto = await this.findByCode(item.codigo);
        if (!produto) {
          throw new Error(`Produto ${item.codigo} não encontrado`);
        }

        // Verificar estoque
        if (produto.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para ${produto.descricao}. Disponível: ${produto.estoque}`);
        }
      }

      // Criar venda via API
      const venda = await this.apiService.createSale(vendaData);
      
      console.log('✅ Venda criada via ProductService:', venda.id);
      return venda;

    } catch (error: any) {
      console.error('Erro no ProductService.createSale:', error);
      throw new Error(error.message || 'Erro ao criar venda');
    }
  }

  // Método para forçar sincronização
  async forceSync(): Promise<boolean> {
    try {
      return await this.apiService.forceSync();
    } catch (error: any) {
      console.error('Erro ao forçar sincronização:', error);
      return false;
    }
  }

  // Método para obter status
  async getStatus(): Promise<any> {
    try {
      return await this.apiService.getStatus();
    } catch (error: any) {
      console.error('Erro ao obter status:', error);
      return {
        caixa_id: 'DESCONHECIDO',
        is_online: false,
        error: error.message
      };
    }
  }
}