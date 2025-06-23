// src/renderer/src/pages/PDVInterface.tsx - SISTEMA DE ATALHOS LOCAIS

import React, { useState, useEffect, useRef } from 'react';

// Importar componentes
import Header from '../components/Header';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import ProductDisplay from '../components/ProductDisplay';
import FooterActions from '../components/FooterActions';

// Importar tipos
import { Item, ShortcutKey, Payment, AppScreen } from '../types';
import { useElectronAPI } from '../hooks/useElectronAPI';
import PaymentScreen from '../components/PaymentScreen';

const PDVInterface: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [codigoAtual, setCodigoAtual] = useState<string>('');
  const [quantidadeAtual, setQuantidadeAtual] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [subtotal, setSubtotal] = useState<number>(0);
  const [quantidadeProduto, setQuantidadeProduto] = useState<number>(1);
  const [valorUnitario, setValorUnitario] = useState<number>(0);

  const [currentScreen, setCurrentScreen] = useState<AppScreen>('PDV');

  // Estados para modais customizados
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmMessage, setConfirmMessage] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Ref para o input do código
  const codigoInputRef = useRef<HTMLInputElement>(null);

  // Hook do Electron
  const { 
    isConnected, 
    findProductByCode, 
    createSale, 
    syncCache, // ✅ NOVO: função para sincronizar cache
    onBarcodeScanned, 
    onShortcut, 
    onNotification 
  } = useElectronAPI();

  // Cálculos derivados
  const totalGeral: number = items.reduce((sum: number, item: Item) => sum + item.total, 0);
  const quantidadeItens: number = items.reduce((sum: number, item: Item) => sum + item.qtde, 0);

  // Função para focar no input de código de forma robusta
  const focusCodigoInput = (delay: number = 100): void => {
    setTimeout(() => {
      if (codigoInputRef.current) {
        codigoInputRef.current.focus();
        codigoInputRef.current.select();
        console.log('✅ Foco restaurado via ref');
        return;
      }

      const inputById = document.getElementById('codigo-input') as HTMLInputElement;
      if (inputById) {
        inputById.focus();
        inputById.select();
        console.log('✅ Foco restaurado via ID');
        return;
      }

      const inputByClass = document.querySelector('[data-testid="codigo-input"]') as HTMLInputElement;
      if (inputByClass) {
        inputByClass.focus();
        inputByClass.select();
        console.log('✅ Foco restaurado via data-testid');
        return;
      }

      const inputGeneric = document.querySelector('input[type="text"]:first-of-type') as HTMLInputElement;
      if (inputGeneric) {
        inputGeneric.focus();
        inputGeneric.select();
        console.log('✅ Foco restaurado via seletor genérico');
      } else {
        console.warn('⚠️ Não foi possível focar no input de código');
      }
    }, delay);
  };

  // Modal de confirmação customizado
  const showCustomConfirm = (message: string, onConfirm: () => void): void => {
    setConfirmMessage(message);
    setPendingAction(() => onConfirm);
    setShowConfirmModal(true);
  };

  const handleConfirmModalClose = (confirmed: boolean): void => {
    setShowConfirmModal(false);
    
    if (confirmed && pendingAction) {
      pendingAction();
    }
    
    setPendingAction(null);
    setConfirmMessage('');
    
    if (currentScreen === 'PDV') {
      focusCodigoInput(50);
    }
  };

  // Função para mostrar notificações
  const showNotification = (message: string, type: 'success' | 'error' = 'success'): void => {
    if (type === 'success') {
      setSuccess(message);
      setError('');
    } else {
      setError(message);
      setSuccess('');
    }

    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 3000);
  };

  // ✅ NOVO: Função para sincronizar cache manualmente
  const handleManualSync = async (): Promise<void> => {
    try {
      setLoading(true);
      console.log('🔄 Sincronização manual de cache iniciada...');
      
      const success = await syncCache();
      
      showNotification(
        success ? 'Cache atualizado com sucesso!' : 'Erro na sincronização do cache',
        success ? 'success' : 'error'
      );
    } catch (error) {
      console.error('Erro na sincronização:', error);
      showNotification('Erro na sincronização do cache', 'error');
    } finally {
      setLoading(false);
      focusCodigoInput();
    }
  };

  // ✅ SISTEMA DE ATALHOS LOCAIS APRIMORADO
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Ignorar se modal estiver aberto ou não estiver na tela PDV
      if (showConfirmModal || currentScreen !== 'PDV') return;
      
      // Ignorar se o foco estiver em um input específico (exceto o código)
      const activeElement = document.activeElement as HTMLElement;
      const isInputActive = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );

      // Permitir atalhos mesmo com input de código ativo
      const isCodigoInput = activeElement && (
        activeElement.id === 'codigo-input' ||
        activeElement.getAttribute('data-testid') === 'codigo-input'
      );

      // Se há input ativo (que não seja o código), só processar ESC
      if (isInputActive && !isCodigoInput && e.key !== 'Escape') return;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          console.log('🔥 F1 - Adicionar item');
          addItem();
          break;

        case 'F2':
          e.preventDefault();
          console.log('🔥 F2 - Ir para pagamento');
          irParaTelaPagamento();
          break;

        case 'F3':
          e.preventDefault();
          console.log('🔥 F3 - Cancelar item');
          cancelarItem();
          break;

        case 'F4':
          e.preventDefault();
          console.log('🔥 F4 - Cancelar venda');
          cancelarVenda();
          break;

        case 'F5':
          e.preventDefault();
          console.log('🔥 F5 - Sincronizar cache');
          handleManualSync();
          break;

        case 'Escape':
          e.preventDefault();
          console.log('🔥 ESC - Limpar campos');
          if (showConfirmModal) {
            handleConfirmModalClose(false);
          } else {
            limparCampos();
            focusCodigoInput();
          }
          break;

        // ✅ ATALHOS ADICIONAIS ÚTEIS
        case 'F6':
          e.preventDefault();
          console.log('🔥 F6 - Focar código');
          focusCodigoInput();
          break;

        case 'Delete':
          if (e.ctrlKey) {
            e.preventDefault();
            console.log('🔥 Ctrl+Del - Cancelar venda');
            cancelarVenda();
          }
          break;

        case 'Backspace':
          if (e.ctrlKey) {
            e.preventDefault();
            console.log('🔥 Ctrl+Backspace - Cancelar item');
            cancelarItem();
          }
          break;
      }
    };

    // ✅ ADICIONAR LISTENER PARA TELA PDV
    if (currentScreen === 'PDV') {
      console.log('🎹 Ativando atalhos locais para tela PDV');
      document.addEventListener('keydown', handleKeyPress);
      
      return () => {
        console.log('🎹 Removendo atalhos locais da tela PDV');
        document.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [currentScreen, showConfirmModal, codigoAtual, quantidadeAtual, items]);

  // Listener para código de barras e notificações
  useEffect(() => {
    // Código de barras
    onBarcodeScanned((codigo: string) => {
      if (currentScreen === 'PDV') {
        console.log('📷 Código escaneado:', codigo);
        setCodigoAtual(codigo);
        setTimeout(() => {
          addItemByCodigo(codigo);
        }, 100);
      }
    });

    // Notificações do sistema
    const removeNotificationListener = onNotification((notification: any) => {
      console.log('🔔 Notificação recebida:', notification);
      showNotification(notification.message, notification.type);
    });

    return () => {
      removeNotificationListener();
    };
  }, [onBarcodeScanned, onNotification, currentScreen]);

  // Função para adicionar item por código
  const addItemByCodigo = async (codigo: string, quantidade: number = quantidadeAtual): Promise<void> => {
    if (!codigo.trim()) return;

    setLoading(true);
    setError('');

    try {
      const produto = await findProductByCode(codigo.trim());
      
      if (!produto) {
        throw new Error(`Produto com código "${codigo}" não encontrado`);
      }

      const itemExistente = items.find(item => item.codigo === codigo);
      
      if (itemExistente) {
        setItems(items.map(item => 
          item.codigo === codigo 
            ? { 
                ...item, 
                qtde: item.qtde + quantidade,
                total: (item.qtde + quantidade) * item.vlrUnit
              }
            : item
        ));
      } else {
        const novoItem: Item = {
          id: Date.now(),
          codigo: produto.codigo,
          descricao: produto.descricao,
          qtde: quantidade,
          vlrUnit: produto.preco,
          total: quantidade * produto.preco,
          produto_id: produto.id
        };
        setItems([...items, novoItem]);
        setValorUnitario(novoItem.vlrUnit);
        setSubtotal(novoItem.total);
        setQuantidadeProduto(quantidade);
      }

      limparCampos();
      showNotification(`Produto "${produto.descricao}" adicionado com sucesso!`, 'success');
      focusCodigoInput(100);
      
    } catch (error: any) {
      showNotification(error.message, 'error');
      setCodigoAtual('');
      focusCodigoInput(100);
    } finally {
      setLoading(false);
    }
  };

  // Ir para tela de pagamento
  const irParaTelaPagamento = (): void => {
    if (items.length === 0) {
      showNotification('Não há itens para finalizar a venda!', 'error');
      focusCodigoInput();
      return;
    }

    setCurrentScreen('PAYMENT');
  };

  // Voltar da tela de pagamento
  const voltarTelaPrincipal = (): void => {
    setCurrentScreen('PDV');
    focusCodigoInput(200);
  };

  // Finalizar venda com múltiplas formas de pagamento
  const finalizarVendaComPagamentos = async (payments: Payment[]): Promise<void> => {
    setLoading(true);
    try {
      const venda = await createSale(items);
      
      setItems([]);
      limparCampos();
      setSubtotal(0);
      setValorUnitario(0);
      setQuantidadeProduto(1);
      
      setCurrentScreen('PDV');
      
      const formasPagamento = payments.map(p => {
        const tipos = {
          'DINHEIRO': 'Dinheiro',
          'CARTAO_CREDITO': 'Cartão Crédito',
          'CARTAO_DEBITO': 'Cartão Débito',
          'PIX': 'PIX',
          'OUTROS': 'Outros'
        };
        return `${tipos[p.tipo]}: R$ ${p.valor.toFixed(2)}`;
      }).join(', ');

      showNotification(
        `Venda finalizada! ID: ${venda.id} | ${formasPagamento}`, 
        'success'
      );
      
      focusCodigoInput(200);
      
    } catch (error: any) {
      showNotification(`Erro ao finalizar venda: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Funções de ação
  const addItem = (): void => {
    addItemByCodigo(codigoAtual, quantidadeAtual);
  };

  const cancelarItem = (): void => {
    if (items.length > 0) {
      const ultimoItem = items[items.length - 1];
      
      showCustomConfirm(
        `Deseja remover o item "${ultimoItem.descricao}"?`,
        () => {
          setItems(items.slice(0, -1));
          setValorUnitario(0);
          setSubtotal(0);
          setQuantidadeProduto(1);
          showNotification('Item removido com sucesso!', 'success');
          focusCodigoInput();
        }
      );
    } else {
      showNotification('Não há itens para cancelar!', 'error');
      focusCodigoInput();
    }
  };

  const cancelarVenda = (): void => {
    if (items.length > 0) {
      const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(value);
      };

      showCustomConfirm(
        `Deseja cancelar toda a venda? Total: ${formatCurrency(totalGeral)}`,
        () => {
          setItems([]);
          setValorUnitario(0);
          setSubtotal(0);
          setQuantidadeProduto(1);
          showNotification('Venda cancelada com sucesso!', 'success');
          focusCodigoInput();
        }
      );
    } else {
      showNotification('Não há venda em andamento!', 'error');
      focusCodigoInput();
    }
  };

  const limparCampos = (): void => {
    setCodigoAtual('');
    setQuantidadeAtual(1);
  };

  // Auto-foco inicial
  useEffect(() => {
    if (currentScreen === 'PDV') {
      focusCodigoInput(500);
    }
  }, [currentScreen]);

  // Handlers para o formulário
  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setCodigoAtual(e.target.value);
  };

  const handleCodigoKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const handleQuantidadeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value) || 1;
    setQuantidadeAtual(Math.max(1, value));
  };

  const handleQuantidadeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  // Renderização condicional baseada na tela atual
  if (currentScreen === 'PAYMENT') {
    return (
      <PaymentScreen
        items={items}
        totalVenda={totalGeral}
        onPaymentComplete={finalizarVendaComPagamentos}
        onCancel={voltarTelaPrincipal}
        isConnected={isConnected}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header Component */}
      <Header 
        isConnected={isConnected} 
        isListening={isConnected} 
      />

      <div className="bg-white rounded-b-lg shadow-lg flex flex-col h-[calc(100vh-120px)]">

        {/* Main Content */}
        <div className="flex flex-1 p-6 gap-6 overflow-hidden">
          {/* Product Table Component */}
          <ProductTable 
            items={items}
            isConnected={isConnected}
          />

          {/* Product Form Component */}
          <ProductForm
            codigoAtual={codigoAtual}
            quantidadeAtual={quantidadeAtual}
            loading={loading}
            isConnected={isConnected}
            isListening={isConnected}
            valorUnitarioAtual={valorUnitario}
            subtotal={subtotal}
            totalGeral={totalGeral}
            itemsCount={quantidadeItens}
            onCodigoChange={handleCodigoChange}
            onCodigoKeyPress={handleCodigoKeyPress}
            onQuantidadeChange={handleQuantidadeChange}
            onQuantidadeKeyPress={handleQuantidadeKeyPress}
            quantidadeProduto={quantidadeProduto}
            codigoInputRef={codigoInputRef}
          />
        </div>

        {/* Product Display Component */}
        <ProductDisplay items={items} />

        {/* Footer Actions Component - ATUALIZADO com novos atalhos */}
        <div className="bg-gray-100 p-4 rounded-b-lg border-t">
          <div className="flex justify-center space-x-4 text-xs text-gray-600">
            <div className="flex space-x-4">
              <span><strong>F1</strong> Adicionar</span>
              <span><strong>F2</strong> Pagamento</span>
              <span><strong>F3</strong> Cancelar Item</span>
              <span><strong>F4</strong> Cancelar Venda</span>
              <span><strong>F5</strong> Sincronizar</span>
              <span><strong>F6</strong> Focar Código</span>
              <span><strong>ESC</strong> Limpar</span>
            </div>

            <span className="text-gray-400">|</span>

            <div className="flex space-x-4">
              <span><strong>Ctrl+Del</strong> Cancelar Venda</span>
              <span><strong>Ctrl+⌫</strong> Cancelar Item</span>
            </div>

            {isConnected && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-green-600"><strong>🌐</strong> Online</span>
              </>
            )}
          </div>
        </div>

        {/* Notificações customizadas */}
        {(error || success) && (
          <div className="fixed top-4 right-4 z-50">
            {error && (
              <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2 animate-pulse">
                ❌ {error}
              </div>
            )}
            {success && (
              <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2 animate-pulse">
                ✅ {success}
              </div>
            )}
          </div>
        )}

        {/* Modal de confirmação customizado */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Confirmação</h3>
              <div className="text-gray-600 mb-6 whitespace-pre-line font-mono text-sm">
                {confirmMessage}
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => handleConfirmModalClose(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleConfirmModalClose(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDVInterface;