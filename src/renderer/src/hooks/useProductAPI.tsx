import { useCallback } from 'react';

export interface Product {
  id: number;
  codigo: string;
  descricao: string;
  preco: number;
  estoque: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useProductAPI() {
  const findByCode = useCallback(async (codigo: string): Promise<Product | null> => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      const fallback: { [key: string]: { codigo: string; descricao: string; preco: number } } = {
        '123456789': { codigo: '123456789', descricao: 'Produto Exemplo', preco: 10.0 },
      };
      const produto = fallback[codigo];
      if (!produto) throw new Error('Produto não encontrado');
      return {
        id: Date.now(),
        ...produto,
        estoque: 100,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const response = await (window as any).electronAPI.product.findByCode(codigo);
    if (!response.success) throw new Error(response.error);
    return response.data;
  }, []);

  return { findByCode };
}
