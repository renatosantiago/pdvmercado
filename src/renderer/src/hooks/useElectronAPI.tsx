// src/renderer/src/hooks/useElectronAPI.tsx - ATUALIZADO
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

interface Payment {
  id: number;
  tipo: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'OUTROS';
  valor: number;
  timestamp: string;
}

interface Sale {
  id: number;
  total: number;
  data_venda: string;
  items: any[];
  payments?: Payment[]; // ✅ ATUALIZADO: incluir pagamentos
}

interface SaleData {
  items: Item[];
  payments?: Payment[]; // ✅ NOVO: formas de pagamento
  total: number;
  subtotal: number;
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

export const useElectronAPI = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsConnected(true);
      
      (window as any).electronAPI.barcode.listen();
      
      const removeStatusListener = (window as any).electronAPI.api.onStatusUpdate((status: ApiStatus) => {
        setApiStatus(status);
      });
      
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

  const searchProducts = async (termo: string): Promise<Product[]> => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return [];
    }

    const response = await (window as any).electronAPI.product.search(termo);
    
    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data || [];
  };

  // ✅ ATUALIZADO: createSale agora suporta múltiplas formas de pagamento
  const createSale = async (items: Item[], payments?: Payment[]): Promise<Sale> => {
    console.log('🛒 Criando venda via API...', { items, payments });
    
    // Fallback garantido para modo web
    const fallbackSale = (): Sale => ({
      id: Date.now(),
      total: items.reduce((sum, item) => sum + item.total, 0),
      data_venda: new Date().toISOString(),
      items: items.map(item => ({
        codigo: item.codigo,
        quantidade: item.qtde,
        preco_unitario: item.vlrUnit
      })),
      payments: payments || []
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

    try {
      // ✅ ATUALIZADO: Incluir formas de pagamento na requisição
      const vendaData = {
        items: items.map(item => ({
          codigo: item.codigo,
          quantidade: item.qtde,
          preco_unitario: item.vlrUnit
        })),
        payments: payments || [], // ✅ NOVO: incluir formas de pagamento
        total: items.reduce((sum, item) => sum + item.total, 0),
        subtotal: items.reduce((sum, item) => sum + item.total, 0),
        // Determinar forma de pagamento principal para compatibilidade
        forma_pagamento: payments && payments.length > 0 ? 
          getMainPaymentMethod(payments) : 'DINHEIRO'
      };

      console.log('📤 Enviando venda para API:', vendaData);
      const response = await electronAPI.sale.create(vendaData);
      console.log('📥 Resposta da API:', response);
      
      if (response.success) {
        return {
          ...response.data,
          payments: payments || []
        };
      } else {
        console.error('Erro na API:', response.error);
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Erro ao comunicar com API:', error);
      throw error;
    }
  };

  // ✅ NOVO: Função para determinar forma de pagamento principal
  const getMainPaymentMethod = (payments: Payment[]): string => {
    if (!payments || payments.length === 0) return 'DINHEIRO';
    
    // Se há apenas uma forma de pagamento, usar ela
    if (payments.length === 1) {
      return payments[0].tipo;
    }
    
    // Se há múltiplas, encontrar a de maior valor
    const mainPayment = payments.reduce((max, current) => 
      current.valor > max.valor ? current : max
    );
    
    return mainPayment.tipo;
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

  const onBarcodeScanned = (callback: (codigo: string) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return (window as any).electronAPI.barcode.onScanned(callback);
    }
    return () => {};
  };

  const onShortcut = (callback: (key: string) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.shortcuts) {
      return (window as any).electronAPI.shortcuts.onShortcut(callback);
    }
    return () => {};
  };

  const onNotification = (callback: (notification: any) => void) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notifications) {
      return (window as any).electronAPI.notifications.onNotification(callback);
    }
    return () => {};
  };

  return {
    isConnected,
    apiStatus,
    findProductByCode,
    searchProducts,
    createSale, // ✅ ATUALIZADO: agora suporta pagamentos
    syncCache,
    getApiStatus,
    onBarcodeScanned,
    onShortcut,
    onNotification
  };
};