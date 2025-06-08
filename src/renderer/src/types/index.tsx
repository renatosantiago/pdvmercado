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

export interface Item {
  id: number;
  codigo: string;
  descricao: string;
  qtde: number;
  vlrUnit: number;
  total: number;
  produto_id?: number;
}

export interface Sale {
  id: number;
  total: number;
  data_venda: string;
  items: any[];
}

export type ShortcutKey = 'F1' | 'F2' | 'F3' | 'F4' | 'ESC';