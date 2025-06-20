// src/renderer/src/types/index.tsx - ATUALIZADO
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

export interface Payment {
  id: number;
  tipo: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'OUTROS';
  valor: number;
  timestamp: string;
}

export interface Sale {
  id: number;
  total: number;
  data_venda: string;
  items: any[];
  payments?: Payment[]; // ✅ NOVO: formas de pagamento
  forma_pagamento?: string; // Compatibilidade com API existente
}

export interface SaleData {
  items: Item[];
  payments: Payment[];
  total: number;
  subtotal: number;
  desconto?: number;
}

export type ShortcutKey = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'ESC';

export type AppScreen = 'PDV' | 'PAYMENT'; // ✅ NOVO: controle de telas