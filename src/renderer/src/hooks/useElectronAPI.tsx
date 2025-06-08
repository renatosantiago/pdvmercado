import { useEffect, useState } from "react";

// Interfaces TypeScript
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

type ShortcutKey = 'F1' | 'F2' | 'F3' | 'F4' | 'ESC';

// Hook customizado para integração com Electron
export const useElectronAPI = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Verifica se está rodando no Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsConnected(true);
      
      // Inicia listener do código de barras
      (window as any).electronAPI.barcode.listen();
      
      // Cleanup
      return () => {
        (window as any).electronAPI.barcode.removeListener();
      };
    }
  }, []);

  const findProductByCode = async (codigo: string): Promise<Product | null> => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      // Fallback para desenvolvimento web
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

  const createSale = async (items: Item[]): Promise<Sale> => {
    console.log('🛒 Tentando criar venda...', items);
    
    // Fallback garantido
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

    // Verificações progressivas
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
      console.log('APIs disponíveis:', Object.keys(electronAPI));
      return fallbackSale();
    }

    // Tentar usar a API do Electron
    try {
      const vendaData = {
        items: items.map(item => ({
          codigo: item.codigo,
          quantidade: item.qtde,
          preco_unitario: item.vlrUnit
        }))
      };

      console.log('📤 Enviando dados da venda:', vendaData);
      const response = await electronAPI.sale.create(vendaData);
      console.log('📥 Resposta recebida:', response);
      
      if (response.success) {
        return response.data;
      } else {
        console.error('Erro na API:', response.error);
        return fallbackSale();
      }
    } catch (error) {
      console.error('Erro ao comunicar com Electron:', error);
      return fallbackSale();
    }
  };

  const onBarcodeScanned = (callback: (codigo: string) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.barcode.onScanned(callback);
    }
  };

  // ATALHOS via IPC
  const onShortcut = (callback: (key: string) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.shortcuts) {
      (window as any).electronAPI.shortcuts.onShortcut(callback);
      
      return () => {
        (window as any).electronAPI.shortcuts.removeShortcutListener();
      };
    }
    return () => {};
  };

  // NOTIFICAÇÕES via IPC  
  const onNotification = (callback: (notification: any) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notifications) {
      (window as any).electronAPI.notifications.onNotification(callback);
      
      return () => {
        (window as any).electronAPI.notifications.removeNotificationListener();
      };
    }
    return () => {};
  };

  return {
    isConnected,
    findProductByCode,
    createSale,
    onBarcodeScanned,
    onShortcut,
    onNotification
  };
};