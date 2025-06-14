import { PdvApiService } from './PdvApiService';
import type { Product } from '../types/NetworkTypes';
import { LogService } from './LogService';


export class ProductService {
  private apiService: PdvApiService;
  private logger: LogService;

  constructor(apiService: PdvApiService) {
    this.apiService = apiService;
    this.logger = LogService.getInstance();
  }

  async findByCode(codigo: string): Promise<Product> {
    if (!codigo || typeof codigo !== 'string') {
      this.logger.error('PRODUCT_SERVICE', 'Codigo invalido fornecido', { codigo });
      throw new Error('Código é obrigatório e deve ser uma string');
    }

    try {
      const produto = await this.apiService.findProductByCode(codigo.trim());
      
      if (!produto) {
        this.logger.warn('PRODUCT_SERVICE', `Produto nao encontrado: ${codigo}`);
        throw new Error(`Produto com codigo "${codigo}" nao encontrado`);
      }

      return produto;
    } catch (error: any) {
      this.logger.error('PRODUCT_SERVICE', `Erro ao buscar produto ${codigo}`, error);
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
      this.logger.error('PRODUCT_SERVICE', 'Dados de venda invalidos', vendaData);
      throw new Error('Dados da venda invalidos - items eh obrigatorio');
    }

    if (vendaData.items.length === 0) {
      this.logger.error('PRODUCT_SERVICE', 'Tentativa de venda sem itens');
      throw new Error('Venda deve conter pelo menos um item');
    }

    try {
      // Validar itens
      for (const item of vendaData.items) {
        if (!item.codigo || !item.quantidade || !item.preco_unitario) {
          this.logger.error('PRODUCT_SERVICE', 'Item invalido na venda', item);
          throw new Error('Item invalido - codigo, quantidade e preço sao obrigatorios');
        }

        // Verificar se produto existe no cache
        const produto = await this.findByCode(item.codigo);
        if (!produto) {
          this.logger.error('PRODUCT_SERVICE', `Produto inexistente na venda: ${item.codigo}`);
          throw new Error(`Produto ${item.codigo} não encontrado`);
        }

        // Verificar estoque
        if (produto.estoque < item.quantidade) {
          this.logger.warn('PRODUCT_SERVICE', `Estoque insuficiente para produto ${item.codigo}`)
          throw new Error(`Estoque insuficiente para ${produto.descricao}. Disponivel: ${produto.estoque}`);
        }
      }

      // Criar venda via API
      const venda = await this.apiService.createSale(vendaData);
      
       this.logger.logVenda(venda.id, venda.total, vendaData.items);
      return venda;

    } catch (error: any) {
      this.logger.error('PRODUCT_SERVICE', 'Erro ao criar venda')
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