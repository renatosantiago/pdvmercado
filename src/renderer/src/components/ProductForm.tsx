// src/renderer/src/components/ProductForm.tsx
import React, { RefObject } from 'react';

interface ProductFormProps {
  codigoAtual: string;
  quantidadeAtual: number;
  loading: boolean;
  isConnected: boolean;
  isListening?: boolean;
  valorUnitarioAtual: number;
  subtotal: number;
  totalGeral: number;
  itemsCount: number;
  onCodigoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCodigoKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onQuantidadeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onQuantidadeKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  codigoInputRef?: RefObject<HTMLInputElement | null>;
}

const ProductForm: React.FC<ProductFormProps> = ({
  codigoAtual,
  quantidadeAtual,
  loading,
  isConnected,
  isListening = false,
  valorUnitarioAtual,
  subtotal,
  totalGeral,
  itemsCount,
  onCodigoChange,
  onCodigoKeyPress,
  onQuantidadeChange,
  onQuantidadeKeyPress,
  codigoInputRef
}) => {
  // Função para formatação de moeda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="w-80 space-y-6 flex flex-col flex-shrink-0">
      {/* Code Input */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Código
          {isListening && (
            <span className="text-xs text-blue-600 ml-2">(Leitor conectado)</span>
          )}
        </label>
        <input
          id="codigo-input"
          ref={codigoInputRef}
          data-testid="codigo-input"
          type="text"
          value={codigoAtual}
          onChange={onCodigoChange}
          onKeyPress={onCodigoKeyPress}
          className={`w-full p-3 border rounded-lg text-center text-lg font-mono ${
            loading ? 'bg-gray-200' : 'border-gray-300'
          }`}
          placeholder="Digite o código"
          autoFocus
          disabled={loading}
        />
      </div>

      {/* Quantity Input */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quantidade
        </label>
        <input
          type="number"
          value={quantidadeAtual}
          onChange={onQuantidadeChange}
          onKeyPress={onQuantidadeKeyPress}
          className={`w-full p-3 border rounded-lg text-center text-lg ${
            loading ? 'bg-gray-200' : 'border-gray-300'
          }`}
          min="1"
          disabled={loading}
        />
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Valor Unitário</span>
          <span className="text-sm">Subtotal</span>
        </div>
        <div className="flex justify-between items-center text-lg">
          <span className="font-semibold">{formatCurrency(valorUnitarioAtual)}</span>
          <span className="font-semibold">{formatCurrency(subtotal)}</span>
        </div>
      </div>

      {/* Total */}
      <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg text-center">
        <h3 className="text-base font-bold text-gray-800 mb-1">TOTAL</h3>
        <div className="text-3xl font-bold text-blue-600">
          {formatCurrency(totalGeral)}
        </div>
      </div>

      {/* Items Count */}
      <div className="text-center text-sm text-gray-600">
        {itemsCount} {itemsCount === 1 ? 'item' : 'itens'} na venda
      </div>
    </div>
  );
};

export default ProductForm;