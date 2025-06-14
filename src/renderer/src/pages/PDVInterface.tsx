// src/renderer/src/components/PDVInterface.tsx
import React, { useState, useEffect, useRef } from 'react';

// Importar componentes
import Header from '../components/Header';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import ProductDisplay from '../components/ProductDisplay';
import FooterActions from '../components/FooterActions';

// Importar tipos
import { Item, ShortcutKey } from '../types';
import { useElectronAPI } from '../hooks/useElectronAPI';

const PDVInterface: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [codigoAtual, setCodigoAtual] = useState<string>('');
  const [quantidadeAtual, setQuantidadeAtual] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [subtotal, setSubtotal] = useState<number>(0);

  // Estados para modais customizados
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmMessage, setConfirmMessage] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Ref para o input do código
  const codigoInputRef = useRef<HTMLInputElement>(null);

  // Hook do Electron
  const { isConnected, findProductByCode, createSale, onBarcodeScanned, onShortcut, onNotification } = useElectronAPI();

  // Cálculos derivados
  const totalGeral: number = items.reduce((sum: number, item: Item) => sum + item.total, 0);
  const valorUnitarioAtual: number = items.length > 0 ? items[items.length - 1].vlrUnit : 0;

  // Função para focar no input de código de forma robusta
  const focusCodigoInput = (delay: number = 100): void => {
    setTimeout(() => {
      // Método 1: Usar ref (preferencial)
      if (codigoInputRef.current) {
        codigoInputRef.current.focus();
        codigoInputRef.current.select(); // Seleciona todo o texto
        console.log('✅ Foco restaurado via ref');
        return;
      }

      // Método 2: Fallback com ID específico
      const inputById = document.getElementById('codigo-input') as HTMLInputElement;
      if (inputById) {
        inputById.focus();
        inputById.select();
        console.log('✅ Foco restaurado via ID');
        return;
      }

      // Método 3: Fallback com seletor melhorado
      const inputByClass = document.querySelector('[data-testid="codigo-input"]') as HTMLInputElement;
      if (inputByClass) {
        inputByClass.focus();
        inputByClass.select();
        console.log('✅ Foco restaurado via data-testid');
        return;
      }

      // Método 4: Último recurso - seletor genérico
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

  // Modal de confirmação customizado (substitui confirm())
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
    
    // Focar imediatamente após fechar modal
    focusCodigoInput(50);
  };

  // Função para mostrar notificações (substitui alert())
  const showNotification = (message: string, type: 'success' | 'error' = 'success'): void => {
    if (type === 'success') {
      setSuccess(message);
      setError('');
    } else {
      setError(message);
      setSuccess('');
    }

    // Auto-limpar após 3 segundos
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 3000);
  };

  // Listener para código de barras e atalhos
  useEffect(() => {
    // Código de barras
    onBarcodeScanned((codigo: string) => {
      console.log('Código escaneado:', codigo);
      setCodigoAtual(codigo);
      // Auto-adicionar produto quando código for escaneado
      setTimeout(() => {
        addItemByCodigo(codigo);
      }, 100);
    });

    // Atalhos via IPC
    const removeShortcutListener = onShortcut((key: string) => {
      console.log('🔥 Atalho recebido:', key);
      handleShortcut(key as ShortcutKey);
    });

    // Notificações do sistema
    const removeNotificationListener = onNotification((notification: any) => {
      console.log('🔔 Notificação recebida:', notification);
      showNotification(notification.message, notification.type);
    });

    // Cleanup
    return () => {
      removeShortcutListener();
      removeNotificationListener();
    };
  }, [onBarcodeScanned, onShortcut, onNotification]);

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

      // Verificar se o produto já existe na lista
      const itemExistente = items.find(item => item.codigo === codigo);
      
      if (itemExistente) {
        // Se já existe, atualizar quantidade
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
        // Se não existe, adicionar novo item
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
        setSubtotal(novoItem.total);
      }

      limparCampos();
      showNotification(`Produto "${produto.descricao}" adicionado com sucesso!`, 'success');
      
      // Focar no campo código após adicionar
      focusCodigoInput(100);
      
    } catch (error: any) {
      showNotification(error.message, 'error');
      setCodigoAtual('');
      
      // Focar no campo código após erro
      focusCodigoInput(100);
    } finally {
      setLoading(false);
    }
  };

  // Função para lidar com atalhos
  const handleShortcut = (key: ShortcutKey): void => {
    switch (key) {
      case 'F1':
        addItem();
        break;
      case 'F2':
        finalizarVenda();
        break;
      case 'F3':
        cancelarItem();
        break;
      case 'F4':
        cancelarVenda();
        break;
      case 'ESC':
        limparCampos();
        focusCodigoInput();
        break;
    }
  };

  // Funções de ação
  const addItem = (): void => {
    addItemByCodigo(codigoAtual, quantidadeAtual);
  };

  // Finalizar venda sem bloqueio de foco
  const finalizarVenda = async (): Promise<void> => {
    if (items.length === 0) {
      showNotification('Não há itens para finalizar a venda!', 'error');
      focusCodigoInput();
      return;
    }

    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const resumo = `RESUMO DA VENDA:\n${items.map((item, index) => 
      `${index + 1}. ${item.descricao} - Qtd: ${item.qtde} - ${formatCurrency(item.total)}`
    ).join('\n')}\n\nTOTAL: ${formatCurrency(totalGeral)}`;
    
    // Usar modal customizado em vez de confirm()
    showCustomConfirm(
      `${resumo}\n\nConfirma a finalização da venda?`,
      async () => {
        setLoading(true);
        try {
          const venda = await createSale(items);
          
          // Usar notificação em vez de alert()
          showNotification(`Venda finalizada com sucesso! ID: ${venda.id}`, 'success');
          
        } catch (error: any) {
          showNotification(`Erro ao finalizar venda: ${error.message}`, 'error');
          focusCodigoInput(100);
        } finally {
          setItems([]);
          limparCampos();
          setSubtotal(0);
          setLoading(false);
          // Focar após operação completa
          focusCodigoInput(200);
        }
      }
    );
  };

  // Cancelar item sem bloqueio de foco
  const cancelarItem = (): void => {
    if (items.length > 0) {
      const ultimoItem = items[items.length - 1];
      
      showCustomConfirm(
        `Deseja remover o item "${ultimoItem.descricao}"?`,
        () => {
          setItems(items.slice(0, -1));
          showNotification('Item removido com sucesso!', 'success');
          focusCodigoInput();
        }
      );
    } else {
      showNotification('Não há itens para cancelar!', 'error');
      focusCodigoInput();
    }
  };

  // Cancelar venda sem bloqueio de foco
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
          limparCampos();
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

  // Event listener para teclas de atalho (fallback para modo web)
  useEffect(() => {
    if (!isConnected) {
      console.log('🌐 Modo web - usando atalhos do DOM');
      const handleKeyPress = (e: KeyboardEvent): void => {
        // Ignorar se modal estiver aberto
        if (showConfirmModal) return;
        
        if (e.key === 'F1') {
          e.preventDefault();
          console.log('🔥 F1 pressionado (DOM)');
          handleShortcut('F1');
        } else if (e.key === 'F2') {
          e.preventDefault();
          console.log('🔥 F2 pressionado (DOM)');
          handleShortcut('F2');
        } else if (e.key === 'F3') {
          e.preventDefault();
          console.log('🔥 F3 pressionado (DOM)');
          handleShortcut('F3');
        } else if (e.key === 'F4') {
          e.preventDefault();
          console.log('🔥 F4 pressionado (DOM)');
          handleShortcut('F4');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (showConfirmModal) {
            handleConfirmModalClose(false);
          } else {
            console.log('🔥 ESC pressionado (DOM)');
            handleShortcut('ESC');
          }
        }
      };

      window.addEventListener('keydown', handleKeyPress);
      return (): void => {
        window.removeEventListener('keydown', handleKeyPress);
      };
    } else {
      console.log('🔗 Modo Electron - usando atalhos globais');
    }
  }, [isConnected, codigoAtual, quantidadeAtual, items, showConfirmModal]);

  // Auto-foco inicial e quando componente monta
  useEffect(() => {
    focusCodigoInput(500); // Foco inicial
  }, []);

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
            valorUnitarioAtual={valorUnitarioAtual}
            subtotal={subtotal}
            totalGeral={totalGeral}
            itemsCount={items.length}
            onCodigoChange={handleCodigoChange}
            onCodigoKeyPress={handleCodigoKeyPress}
            onQuantidadeChange={handleQuantidadeChange}
            onQuantidadeKeyPress={handleQuantidadeKeyPress}
            // Passar ref para o componente filho
            codigoInputRef={codigoInputRef}
          />
        </div>

        {/* Product Display Component */}
        <ProductDisplay items={items} />

        {/* Footer Actions Component */}
        <FooterActions 
          isConnected={isConnected}
          isListening={isConnected}
        />

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