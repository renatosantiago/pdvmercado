import { useCallback } from 'react';

export interface Item {
  codigo: string;
  qtde: number;
  vlrUnit: number;
  total: number;
}

export interface Sale {
  id: number;
  total: number;
  data_venda: string;
  items: any[];
}

export function useSaleAPI() {
  const create = useCallback(async (items: Item[]): Promise<Sale> => {
    const fallback = (): Sale => ({
      id: Date.now(),
      total: items.reduce((sum, i) => sum + i.total, 0),
      data_venda: new Date().toISOString(),
      items,
    });

    const electronAPI = (window as any)?.electronAPI;
    if (!electronAPI?.sale?.create) return fallback();

    const response = await electronAPI.sale.create({
      items: items.map(i => ({
        codigo: i.codigo,
        quantidade: i.qtde,
        preco_unitario: i.vlrUnit,
      })),
    });

    return response.success ? response.data : fallback();
  }, []);

  return { create };
}
