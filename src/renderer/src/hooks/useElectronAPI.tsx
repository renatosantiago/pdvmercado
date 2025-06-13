import { useEffect, useState } from "react";

// Interfaces TypeScript (mantidas iguais)
interface Product {
  id: number;
  codigo: string;
  descricao: string;
  preco: number;
  estoque: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface Item {
  id: number;
  codigo: string;
  descricao: string;
  qtde: number;
  vlrUnit: number;
  total: number;
  produto_id?: number;
}

interface Sale {
  id: number;
  total: number;
  data_venda: string;
  items: any[];
}

interface ApiStatus {
  caixa_id: string;
  is_online: boolean;
  api_available: boolean;
  cache: {
    total_produtos: number;
    vendas_pendentes: number;
    cache_size_mb: number;
    ultima_sync: string | null;
  };
  pending_sales: number;
}

type ShortcutKey = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'ESC';

// ✅ HOOK CORRIGIDO PARA USAR FUNÇÕES DE CLEANUP
export const useElectronAPI = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);

  useEffect(() => {
    // Verifica se está rodando no Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsConnected(true);
      
      // Inicia listener do código de barras
      (window as any).electronAPI.barcode.listen();
      
      // ✅ CORRIGIDO: Usar função de cleanup retornada
      const removeStatusListener = (window as any).electronAPI.api.onStatusUpdate((status: ApiStatus) => {
        setApiStatus(status);
      });
      
      // ✅ CORRIGIDO: Cleanup usando a função retornada
      return () => {
        (window as any).electronAPI.barcode.removeListener();
        if (removeStatusListener && typeof removeStatusListener === 'function') {
          removeStatusListener();
        }
      };
    }
  }, []);

  const findProductByCode = async (codigo: string): Promise<Product | null> => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      // Fallback para desenvolvimento web (mantido igual)
      const produtosFallback: { [key: string]: Omit<Product, 'id' | 'estoque' | 'ativo' | 'created_at' | 'updated_at'> } = {
        '37658990198': { codigo: '37658990198', descricao: 'Macarrão Romanha 500G', preco: 4.87 },
        '88769022': { codigo: '88769022', descricao: 'Arroz Tio João 5kg', preco: 27.90 },
        '123456789': { codigo: '123456789', descricao: 'Feijão Carioca 1kg', preco: 8.50 },
        '987654321': { codigo: '987654321', descricao: 'Açúcar Cristal 1kg', preco: 5.99 },
        '456789123': { codigo: '456789123', descricao: 'Óleo de Soja 900ml', preco: 6.75 },
        '789123456': { codigo: '789123456', descricao: 'Café Pilão 500g', preco: 12.90 },
        '321654987': { codigo: '321654987', descricao: 'Leite Integral 1L', preco: 4.25 },
        '654987321': { codigo: '654987321', descricao: 'Pão de Açúcar Integral', preco: 3.80 }
      };

      const produto = produtosFallback[codigo];
      if (!produto) {
        throw new Error(`Produto com código "${codigo}" não encontrado`);
      }

      return {
        id: Date.now(),
        ...produto,
        estoque: 100,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    const response = await (window as any).electronAPI.product.findByCode(codigo);
    
    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data;
  };

  const searchProducts = async (termo: string): Promise<Product[]> => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return []; // Fallback vazio para modo web
    }

    const response = await (window as any).electronAPI.product.search(termo);
    
    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data || [];
  };

  const createSale = async (items: Item[]): Promise<Sale> => {
    console.log('🛒 Criando venda via API...', items);
    
    // Fallback garantido para modo web
    const fallbackSale = (): Sale => ({
      id: Date.now(),
      total: items.reduce((sum, item) => sum + item.total, 0),
      data_venda: new Date().toISOString(),
      items: items.map(item => ({
        codigo: item.codigo,
        quantidade: item.qtde,
        preco_unitario: item.vlrUnit
      }))
    });

    if (typeof window === 'undefined') {
      console.log('🌐 Modo servidor');
      return fallbackSale();
    }

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      console.log('🌐 Modo web - electronAPI não disponível');
      return fallbackSale();
    }

    if (!electronAPI.sale?.create) {
      console.log('⚠️ API de vendas não configurada - usando fallback');
      return fallbackSale();
    }

    // Usar a API do Electron
    try {
      const vendaData = {
        items: items.map(item => ({
          codigo: item.codigo,
          quantidade: item.qtde,
          preco_unitario: item.vlrUnit
        }))
      };

      console.log('📤 Enviando venda para API:', vendaData);
      const response = await electronAPI.sale.create(vendaData);
      console.log('📥 Resposta da API:', response);
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Erro na API:', response.error);
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Erro ao comunicar com API:', error);
      throw error;
    }
  };

  const syncCache = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.cache) {
      console.log('🌐 Cache sync não disponível no modo web');
      return false;
    }

    try {
      const response = await (window as any).electronAPI.cache.sync();
      return response.success;
    } catch (error) {
      console.error('Erro ao sincronizar cache:', error);
      return false;
    }
  };

  const getApiStatus = async (): Promise<ApiStatus | null> => {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.api) {
      return null;
    }

    try {
      const response = await (window as any).electronAPI.api.getStatus();
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Erro ao obter status da API:', error);
      return null;
    }
  };

  // ✅ CORRIGIDO: onBarcodeScanned com cleanup
  const onBarcodeScanned = (callback: (codigo: string) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return (window as any).electronAPI.barcode.onScanned(callback);
    }
    return () => {}; // Retorna função vazia se não conectado
  };

  // ✅ CORRIGIDO: onShortcut com cleanup
  const onShortcut = (callback: (key: string) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.shortcuts) {
      return (window as any).electronAPI.shortcuts.onShortcut(callback);
    }
    return () => {}; // Retorna função vazia se não conectado
  };

  // ✅ CORRIGIDO: onNotification com cleanup
  const onNotification = (callback: (notification: any) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notifications) {
      return (window as any).electronAPI.notifications.onNotification(callback);
    }
    return () => {}; // Retorna função vazia se não conectado
  };

  return {
    isConnected,
    apiStatus,
    findProductByCode,
    searchProducts,
    createSale,
    syncCache,
    getApiStatus,
    onBarcodeScanned,
    onShortcut,
    onNotification
  };
};
