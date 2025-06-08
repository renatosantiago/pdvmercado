// ================================
// services/ProductService.ts - Atualizado para NetworkDatabaseService
// ================================

import { NetworkDatabaseService } from './NetworkDatabaseService';

export class ProductService {
  private db: NetworkDatabaseService;

  constructor(databaseService: NetworkDatabaseService) {
    this.db = databaseService;
  }

  async findByCode(codigo: string): Promise<any> {
    if (!codigo || typeof codigo !== 'string') {
      throw new Error('Código é obrigatório e deve ser uma string');
    }

    try {
      const produto = await this.db.findProductByCode(codigo.trim());
      
      if (!produto) {
        throw new Error(`Produto com código "${codigo}" não encontrado`);
      }

      return produto;
    } catch (error: any) {
      console.error('Erro no ProductService.findByCode:', error);
      throw new Error(error.message || 'Erro ao buscar produto');
    }
  }

  async findAll(): Promise<any[]> {
    try {
      return await this.db.findAllProducts();
    } catch (error: any) {
      console.error('Erro no ProductService.findAll:', error);
      throw new Error(error.message || 'Erro ao buscar produtos');
    }
  }

  async findById(id: number): Promise<any> {
    if (!this.db.database) {
      throw new Error('Database not initialized');
    }

    try {
      const produto = await this.db.database.get(`
        SELECT id, codigo, ean13, descricao, preco, custo, estoque,
               estoque_minimo, categoria_id, unidade, ativo,
               created_at, updated_at
        FROM produtos 
        WHERE id = ? AND ativo = true
      `, [id]);

      if (!produto) {
        throw new Error(`Produto com ID ${id} não encontrado`);
      }

      return produto;
    } catch (error: any) {
      console.error('Erro no ProductService.findById:', error);
      throw error;
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
      // Validar e preparar itens
      const processedItems = [];

      for (const item of vendaData.items) {
        if (!item.codigo || !item.quantidade || !item.preco_unitario) {
          throw new Error('Item inválido - código, quantidade e preço são obrigatórios');
        }

        // Buscar produto para obter ID
        const produto = await this.findByCode(item.codigo);
        
        if (!produto) {
          throw new Error(`Produto ${item.codigo} não encontrado`);
        }

        // Verificar estoque
        if (produto.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para ${produto.descricao}. Disponível: ${produto.estoque}`);
        }

        processedItems.push({
          produto_id: produto.id,
          quantidade: parseFloat(item.quantidade),
          preco_unitario: parseFloat(item.preco_unitario)
        });
      }

      // Criar venda via NetworkDatabaseService
      const venda = await this.db.createSale(processedItems);
      
      console.log('✅ Venda criada via ProductService:', venda.id);
      return venda;

    } catch (error: any) {
      console.error('Erro no ProductService.createSale:', error);
      throw new Error(error.message || 'Erro ao criar venda');
    }
  }

  async updateStock(productId: number, newStock: number): Promise<void> {
    if (typeof productId !== 'number' || typeof newStock !== 'number') {
      throw new Error('ID do produto e novo estoque devem ser números');
    }

    if (newStock < 0) {
      throw new Error('Estoque não pode ser negativo');
    }

    try {
      await this.db.updateProductStock(productId, newStock);
      console.log(`📦 Estoque atualizado - Produto ${productId}: ${newStock}`);
    } catch (error: any) {
      console.error('Erro no ProductService.updateStock:', error);
      throw error;
    }
  }

  async createProduct(productData: {
    codigo: string;
    descricao: string;
    preco: number;
    estoque?: number;
    ean13?: string;
    custo?: number;
    estoque_minimo?: number;
    categoria_id?: number;
    unidade?: string;
  }): Promise<any> {
    if (!this.db.database) {
      throw new Error('Database not initialized');
    }

    // Validações
    if (!productData.codigo || !productData.descricao || !productData.preco) {
      throw new Error('Código, descrição e preço são obrigatórios');
    }

    if (productData.preco <= 0) {
      throw new Error('Preço deve ser maior que zero');
    }

    try {
      const result = await this.db.database.run(`
        INSERT INTO produtos (
          codigo, ean13, descricao, preco, custo, estoque, 
          estoque_minimo, categoria_id, unidade, caixa_origem
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        productData.codigo,
        productData.ean13 || null,
        productData.descricao,
        productData.preco,
        productData.custo || 0,
        productData.estoque || 0,
        productData.estoque_minimo || 5,
        productData.categoria_id || null,
        productData.unidade || 'UN',
        this.db.getConnectionInfo().caixa_id
      ]);

      console.log(`✅ Produto criado - ID: ${result.lastID}`);
      
      return {
        id: result.lastID,
        ...productData,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Produto com código "${productData.codigo}" já existe`);
      }
      
      console.error('Erro no ProductService.createProduct:', error);
      throw error;
    }
  }

  async updateProduct(id: number, productData: Partial<{
    descricao: string;
    preco: number;
    estoque: number;
    ean13: string;
    custo: number;
    estoque_minimo: number;
    categoria_id: number;
    unidade: string;
    ativo: boolean;
  }>): Promise<any> {
    if (!this.db.database) {
      throw new Error('Database not initialized');
    }

    if (!id || typeof id !== 'number') {
      throw new Error('ID do produto é obrigatório');
    }

    // Verificar se produto existe
    const existingProduct = await this.findById(id);
    if (!existingProduct) {
      throw new Error(`Produto com ID ${id} não encontrado`);
    }

    try {
      // Construir query de update dinamicamente
      const updateFields = [];
      const updateValues = [];

      for (const [key, value] of Object.entries(productData)) {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('Nenhum campo para atualizar');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      const query = `
        UPDATE produtos 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      await this.db.database.run(query, updateValues);
      
      console.log(`✅ Produto atualizado - ID: ${id}`);
      
      // Retornar produto atualizado
      return await this.findById(id);

    } catch (error: any) {
      console.error('Erro no ProductService.updateProduct:', error);
      throw error;
    }
  }

  async deleteProduct(id: number): Promise<void> {
    if (!this.db.database) {
      throw new Error('Database not initialized');
    }

    if (!id || typeof id !== 'number') {
      throw new Error('ID do produto é obrigatório');
    }

    try {
      // Soft delete - marcar como inativo
      await this.db.database.run(`
        UPDATE produtos 
        SET ativo = false, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [id]);

      console.log(`🗑️ Produto desativado - ID: ${id}`);

    } catch (error: any) {
      console.error('Erro no ProductService.deleteProduct:', error);
      throw error;
    }
  }

  async getLowStockProducts(): Promise<any[]> {
    try {
      return await this.db.getLowStockProducts();
    } catch (error: any) {
      console.error('Erro no ProductService.getLowStockProducts:', error);
      throw error;
    }
  }

  async getProductsByCategory(categoryId: number): Promise<any[]> {
    if (!this.db.database) {
      throw new Error('Database not initialized');
    }

    try {
      return await this.db.database.all(`
        SELECT id, codigo, ean13, descricao, preco, custo, estoque,
               estoque_minimo, categoria_id, unidade, ativo,
               created_at, updated_at
        FROM produtos 
        WHERE categoria_id = ? AND ativo = true
        ORDER BY descricao
      `, [categoryId]);
    } catch (error: any) {
      console.error('Erro no ProductService.getProductsByCategory:', error);
      throw error;
    }
  }

  async searchProducts(searchTerm: string): Promise<any[]> {
    if (!this.db.database) {
      throw new Error('Database not initialized');
    }

    if (!searchTerm || typeof searchTerm !== 'string') {
      throw new Error('Termo de busca é obrigatório');
    }

    try {
      const term = `%${searchTerm.trim()}%`;
      
      return await this.db.database.all(`
        SELECT id, codigo, ean13, descricao, preco, custo, estoque,
               estoque_minimo, categoria_id, unidade, ativo,
               created_at, updated_at
        FROM produtos 
        WHERE (
          descricao LIKE ? OR 
          codigo LIKE ? OR 
          ean13 LIKE ?
        ) AND ativo = true
        ORDER BY descricao
        LIMIT 50
      `, [term, term, term]);
    } catch (error: any) {
      console.error('Erro no ProductService.searchProducts:', error);
      throw error;
    }
  }

  // Método para verificar status do serviço
  getStatus(): any {
    return {
      database_connected: !!this.db.database,
      network_status: this.db.getConnectionInfo()
    };
  }
}