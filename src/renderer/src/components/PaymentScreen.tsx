// src/renderer/src/components/PaymentScreen.tsx - COM ATALHOS LOCAIS

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { usePaymentShortcuts } from '../hooks/useShortcuts'; // ✅ NOVO: usar hook de atalhos

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

interface PaymentScreenProps {
  items: Item[];
  totalVenda: number;
  onPaymentComplete: (payments: Payment[]) => void;
  onCancel: () => void;
  isConnected: boolean;
}

// Converter valor para centavos (elimina problemas de ponto flutuante)
const toCents = (value: number): number => {
  return Math.round(value * 100);
};

// Converter centavos para valor decimal
const fromCents = (cents: number): number => {
  return cents / 100;
};

// Somar valores monetários com precisão
const addMoney = (...values: number[]): number => {
  const totalCents = values.reduce((sum, value) => sum + toCents(value), 0);
  return fromCents(totalCents);
};

// Subtrair valores monetários com precisão
const subtractMoney = (a: number, b: number): number => {
  return fromCents(toCents(a) - toCents(b));
};

// Comparar valores monetários com tolerância
const isEqual = (a: number, b: number): boolean => {
  return Math.abs(toCents(a) - toCents(b)) <= 1; // Tolerância de 1 centavo
};

const isGreaterThan = (a: number, b: number): boolean => {
  return toCents(a) > toCents(b);
};

const isLessOrEqual = (a: number, b: number): boolean => {
  return toCents(a) <= toCents(b);
};

// Arredondar para 2 casas decimais
const roundMoney = (value: number): number => {
  return fromCents(toCents(value));
};

// Parse de string para valor monetário com validação
const parseMoneyValue = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  
  // Remover espaços e caracteres especiais, manter apenas números, vírgula e ponto
  let cleanValue = value.replace(/[^\d,.-]/g, '');
  
  // Se não há números, retornar 0
  if (!/\d/.test(cleanValue)) return 0;
  
  // Tratar casos com vírgula como separador decimal (padrão brasileiro)
  if (cleanValue.includes(',')) {
    // Se há vírgula e ponto, assumir que ponto é separador de milhares
    if (cleanValue.includes('.') && cleanValue.indexOf(',') > cleanValue.lastIndexOf('.')) {
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else {
      // Apenas vírgula como separador decimal
      cleanValue = cleanValue.replace(',', '.');
    }
  }
  
  const parsed = parseFloat(cleanValue);
  if (isNaN(parsed) || parsed < 0) return 0;
  
  // Limitar a 2 casas decimais
  return roundMoney(parsed);
};

const PaymentScreen: React.FC<PaymentScreenProps> = ({
  items,
  totalVenda,
  onPaymentComplete,
  onCancel,
  isConnected
}) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentPaymentType, setCurrentPaymentType] = useState<Payment['tipo']>('DINHEIRO');
  const [currentPaymentValue, setCurrentPaymentValue] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const valueInputRef = useRef<HTMLInputElement>(null);

  // Arredondar total da venda para evitar problemas
  const totalVendaRounded = roundMoney(totalVenda);
  
  // Calcular total pago com precisão
  const totalPago = payments.length > 0 
    ? addMoney(...payments.map(p => p.valor))
    : 0;
  
  // Calcular restante com precisão
  const restante = subtractMoney(totalVendaRounded, totalPago);
  
  // Verificar se pagamento está completo
  const isComplete = isLessOrEqual(restante, 0);

  // ✅ CONFIGURAR ATALHOS ESPECÍFICOS PARA TELA DE PAGAMENTO
  const { getShortcutsList } = usePaymentShortcuts({
    addPayment: () => {
      if (isComplete && !showConfirmModal) {
        handleFinalizeSale();
      } else {
        handleAddPayment();
      }
    },
    finalizeSale: handleFinalizeSale,
    cancel: () => {
      if (showConfirmModal) {
        setShowConfirmModal(false);
      } else {
        onCancel();
      }
    },
    selectDinheiro: () => {
      setCurrentPaymentType('DINHEIRO');
      focusValueInput();
    },
    selectCartaoCredito: () => {
      setCurrentPaymentType('CARTAO_CREDITO');
      focusValueInput();
    },
    selectCartaoDebito: () => {
      setCurrentPaymentType('CARTAO_DEBITO');
      focusValueInput();
    },
    selectPix: () => {
      setCurrentPaymentType('PIX');
      focusValueInput();
    },
    selectOutros: () => {
      setCurrentPaymentType('OUTROS');
      focusValueInput();
    }
  }, {
    enabled: true, // Habilitar atalhos
    ignoreInputs: true, // Ignorar atalhos quando inputs estão focados
    allowedInputs: ['payment-value-input'] // Exceto o input de valor
  });

  // Foco no input ao montar
  useEffect(() => {
    focusValueInput();
  }, []);

  const focusValueInput = () => {
    setTimeout(() => {
      if (valueInputRef.current) {
        valueInputRef.current.focus();
        valueInputRef.current.select();
      }
    }, 100);
  };

  const formatCurrency = (value: number): string => {
    const rounded = roundMoney(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rounded);
  };

  const parseValue = (value: string): number => {
    const cleanValue = value.replace(/[^0-9,]/g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  const handleAddPayment = () => {
    const valor = parseMoneyValue(currentPaymentValue);
    
    if (valor <= 0) {
      alert('Valor deve ser maior que zero!');
      focusValueInput();
      return;
    }

    if (isGreaterThan(valor, restante)) {
      alert(`Valor não pode ser maior que o restante: ${formatCurrency(restante)}`);
      focusValueInput();
      return;
    }

    const newPayment: Payment = {
      id: Date.now(),
      tipo: currentPaymentType,
      valor: roundMoney(valor), // Garantir arredondamento
      timestamp: new Date().toISOString()
    };

    setPayments([...payments, newPayment]);
    setCurrentPaymentValue('');
    focusValueInput();
  };

  const handleRemovePayment = (paymentId: number) => {
    setPayments(payments.filter(p => p.id !== paymentId));
    focusValueInput();
  };

  const handleAutoComplete = () => {
    if (isGreaterThan(restante, 0)) {
      setCurrentPaymentValue(restante.toFixed(2).replace('.', ','));
      focusValueInput();
    }
  };

  function handleFinalizeSale() {
    if (!isComplete) {
      alert('Venda ainda não foi totalmente paga!');
      return;
    }
    setShowConfirmModal(true);
  }

  const confirmFinalizeSale = () => {
    onPaymentComplete(payments);
  };

  const getPaymentTypeLabel = (tipo: Payment['tipo']): string => {
    const labels = {
      'DINHEIRO': 'Dinheiro',
      'CARTAO_CREDITO': 'Cartão de Crédito',
      'CARTAO_DEBITO': 'Cartão de Débito',
      'PIX': 'PIX',
      'OUTROS': 'Outros'
    };
    return labels[tipo];
  };

  const getPaymentTypeColor = (tipo: Payment['tipo']): string => {
    const colors = {
      'DINHEIRO': 'bg-green-100 text-green-800',
      'CARTAO_CREDITO': 'bg-blue-100 text-blue-800',
      'CARTAO_DEBITO': 'bg-purple-100 text-purple-800',
      'PIX': 'bg-orange-100 text-orange-800',
      'OUTROS': 'bg-gray-100 text-gray-800'
    };
    return colors[tipo];
  };

  const handleValueInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permitir apenas números, vírgula e ponto
    const filteredValue = value.replace(/[^0-9,.]/g, '');
    setCurrentPaymentValue(filteredValue);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={onCancel}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-400 px-3 py-2 rounded"
          >
            <ArrowLeft size={20} />
            <span>Voltar (ESC)</span>
          </button>
          <h1 className="text-xl font-bold">Formas de Pagamento</h1>
        </div>
        <div className="text-sm">
          {isConnected ? '🟢 Online' : '🔴 Offline'}
        </div>
      </div>

      <div className="bg-white rounded-b-lg shadow-lg flex flex-col h-[calc(100vh-120px)]">
        <div className="flex flex-1 p-6 gap-6">
          {/* Resumo da Venda */}
          <div className="w-1/3 space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Resumo da Venda</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Itens:</span>
                  <span>{items.length}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span className='text-2xl'>{formatCurrency(totalVenda)}</span>
                </div>
              </div>
            </div>

            {/* Status do Pagamento */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Status do Pagamento</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total da Venda:</span>
                  <span className="font-semibold text-3xl">{formatCurrency(totalVenda)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor Pago:</span>
                  <span className="text-3xl font-semibold text-green-600">{formatCurrency(totalPago)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span>Restante:</span>
                  <span className={`font-bold text-3xl ${restante > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(restante)}
                  </span>
                </div>
                {isComplete && (
                  <div className="text-center text-green-600 font-bold">
                    ✓ PAGAMENTO COMPLETO
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Formas de Pagamento */}
          <div className="flex-1 space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Adicionar Pagamento</h3>
              
              {/* Seleção de Forma de Pagamento */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[
                  { tipo: 'DINHEIRO' as const, label: 'Dinheiro', key: 'F6' },
                  { tipo: 'CARTAO_CREDITO' as const, label: 'Cartão Créd.', key: 'F7' },
                  { tipo: 'CARTAO_DEBITO' as const, label: 'Cartão Déb.', key: 'F8' },
                  { tipo: 'PIX' as const, label: 'PIX', key: 'F9' },
                  { tipo: 'OUTROS' as const, label: 'Outros', key: 'F10' }
                ].map(({ tipo, label, key }) => (
                  <button
                    key={tipo}
                    onClick={() => {
                      setCurrentPaymentType(tipo);
                      focusValueInput();
                    }}
                    className={`p-3 rounded text-2xl font-medium transition-colors ${
                      currentPaymentType === tipo
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border hover:bg-gray-100'
                    }`}
                  >
                    <div className='text-2xl'>{label}</div>
                    <div className="text-xs opacity-75">({key})</div>
                  </button>
                ))}
              </div>

              {/* Valor do Pagamento */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Valor ({getPaymentTypeLabel(currentPaymentType)})
                  </label>
                  <input
                    id="payment-value-input" // ✅ ID para permitir atalhos
                    ref={valueInputRef}
                    type="text"
                    value={currentPaymentValue}
                    onChange={handleValueInputChange}
                    className="w-full p-3 border rounded-lg text-lg text-center"
                    placeholder="0,00"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (isComplete && !showConfirmModal) {
                          handleFinalizeSale();
                        } else {
                          handleAddPayment();
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleAutoComplete}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                    disabled={restante <= 0}
                  >
                    Completar
                  </button>
                  <button
                    onClick={handleAddPayment}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    disabled={!currentPaymentValue || parseValue(currentPaymentValue) <= 0}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Pagamentos */}
            <div className="bg-gray-50 p-4 rounded-lg flex-1">
              <h3 className="text-lg font-semibold mb-4">Pagamentos Adicionados</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {payments.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum pagamento adicionado
                  </div>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center bg-white p-3 rounded border">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentTypeColor(payment.tipo)}`}>
                          {getPaymentTypeLabel(payment.tipo)}
                        </span>
                        <span className="font-semibold">{formatCurrency(payment.valor)}</span>
                      </div>
                      <button
                        onClick={() => handleRemovePayment(payment.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer com Ações - ATUALIZADO COM NOVOS ATALHOS */}
        <div className="bg-gray-100 p-4 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <span><strong>F6-F10</strong> Formas Pagamento | <strong>Enter</strong> {isComplete ? 'Finalizar' : 'Adicionar'} | <strong>ESC</strong> Cancelar</span>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancelar (ESC)
              </button>
              <button
                onClick={handleFinalizeSale}
                disabled={!isComplete}
                className={`px-6 py-2 rounded ${
                  isComplete
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isComplete ? 'Finalizar Venda (Enter)' : `Falta ${formatCurrency(restante)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-center">Confirmar Finalização</h3>
            
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span>Total da Venda:</span>
                <span className="font-semibold">{formatCurrency(totalVenda)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="font-medium mb-2">Formas de Pagamento:</div>
                {payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between text-xs ml-4">
                    <span>{getPaymentTypeLabel(payment.tipo)}:</span>
                    <span>{formatCurrency(payment.valor)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total Pago:</span>
                <span className="text-green-600">{formatCurrency(totalPago)}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Voltar
              </button>
              <button
                onClick={confirmFinalizeSale}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center space-x-2"
              >
                <Check size={16} />
                <span>Confirmar Venda</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentScreen;