// src/renderer/src/components/PaymentSummary.tsx
import React from 'react';
import { Payment } from '../types';

interface PaymentSummaryProps {
  payments: Payment[];
  totalVenda: number;
  className?: string;
}

const PaymentSummary: React.FC<PaymentSummaryProps> = ({ 
  payments, 
  totalVenda, 
  className = '' 
}) => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPaymentTypeLabel = (tipo: Payment['tipo']): string => {
    const labels = {
      'DINHEIRO': 'Dinheiro',
      'CARTAO_CREDITO': 'Cartão Crédito',
      'CARTAO_DEBITO': 'Cartão Débito',
      'PIX': 'PIX',
      'OUTROS': 'Outros'
    };
    return labels[tipo];
  };

  const getPaymentTypeIcon = (tipo: Payment['tipo']): string => {
    const icons = {
      'DINHEIRO': '💵',
      'CARTAO_CREDITO': '💳',
      'CARTAO_DEBITO': '💳',
      'PIX': '📱',
      'OUTROS': '📄'
    };
    return icons[tipo];
  };

  const totalPago = payments.reduce((sum, payment) => sum + payment.valor, 0);
  const restante = totalVenda - totalPago;

  if (payments.length === 0) {
    return (
      <div className={`bg-gray-50 p-3 rounded text-center text-gray-500 text-sm ${className}`}>
        Nenhuma forma de pagamento selecionada
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded-lg p-4 space-y-3 ${className}`}>
      <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">
        Formas de Pagamento
      </h4>
      
      {/* Lista de Pagamentos */}
      <div className="space-y-2">
        {payments.map((payment, index) => (
          <div key={payment.id} className="flex justify-between items-center text-sm">
            <div className="flex items-center space-x-2">
              <span>{getPaymentTypeIcon(payment.tipo)}</span>
              <span className="text-gray-600">
                {getPaymentTypeLabel(payment.tipo)}
              </span>
            </div>
            <span className="font-medium">
              {formatCurrency(payment.valor)}
            </span>
          </div>
        ))}
      </div>

      {/* Resumo */}
      <div className="border-t pt-2 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Venda:</span>
          <span className="font-medium">{formatCurrency(totalVenda)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Pago:</span>
          <span className="font-medium text-green-600">
            {formatCurrency(totalPago)}
          </span>
        </div>
        {restante > 0 && (
          <div className="flex justify-between text-sm font-medium">
            <span className="text-red-600">Restante:</span>
            <span className="text-red-600">{formatCurrency(restante)}</span>
          </div>
        )}
        {restante <= 0 && (
          <div className="text-center text-green-600 font-medium text-sm">
            ✓ Pagamento Completo
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSummary;