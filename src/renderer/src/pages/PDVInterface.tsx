// src/renderer/src/components/PDVInterface.tsx
import React, { useState, useEffect } from 'react';

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

  // Hook do Electron
  const { isConnected, findProductByCode, createSale, onBarcodeScanned, onShortcut, onNotification } = useElectronAPI();

  // Cálculos derivados
  const totalGeral: number = items.reduce((sum: number, item: Item) => sum + item.total, 0);
  const valorUnitarioAtual: number = items.length > 0 ? items[items.length - 1].vlrUnit : 0;

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
      if (notification.type === 'success') {
        setSuccess(notification.message);
      } else if (notification.type === 'error') {
        setError(notification.message);
      }
      
      // Auto-limpar após duração especificada
      setTimeout(() => {
        setError('');
        setSuccess('');
      }, notification.duration || 3000);
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
      setSuccess(`Produto "${produto.descricao}" adicionado com sucesso!`);
      
      // Focar no campo código após adicionar
      setTimeout(() => {
        const codigoInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (codigoInput) codigoInput.focus();
      }, 100);
      
    } catch (error: any) {
      setError(error.message);
      setCodigoAtual('');
      setTimeout(() => {
        const codigoInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (codigoInput) codigoInput.focus();
      }, 100);
    } finally {
      setLoading(false);
      // Limpar mensagens após alguns segundos
      setTimeout(() => {
        setError('');
        setSuccess('');
      }, 3000);
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
        break;
    }
  };

  // Funções de ação
  const addItem = (): void => {
    addItemByCodigo(codigoAtual, quantidadeAtual);
  };

  const finalizarVenda = async (): Promise<void> => {
    if (items.length === 0) {
      alert('Não há itens para finalizar a venda!');
      return;
    }

    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const resumo = `
      RESUMO DA VENDA:
      ${items.map((item, index) => 
        `${index + 1}. ${item.descricao} - Qtd: ${item.qtde} - ${formatCurrency(item.total)}`
      ).join('\n')}

      TOTAL: ${formatCurrency(totalGeral)}
    `;
    
    if (confirm(`${resumo}\n\nConfirma a finalização da venda?`)) {
      setLoading(true);
      try {
        const venda = await createSale(items);
        alert(`Venda finalizada com sucesso!\nID da Venda: ${venda.id}`);
        setItems([]);
        limparCampos();
        setSuccess('Venda finalizada com sucesso!');
      } catch (error: any) {
        setError(`Erro ao finalizar venda: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const cancelarItem = (): void => {
    if (items.length > 0) {
      const confirmacao = confirm(`Deseja remover o item "${items[items.length - 1].descricao}"?`);
      if (confirmacao) {
        setItems(items.slice(0, -1));
        setSuccess('Item removido com sucesso!');
      }
    } else {
      alert('Não há itens para cancelar!');
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

      if (confirm(`Deseja cancelar toda a venda? Total: ${formatCurrency(totalGeral)}`)) {
        setItems([]);
        limparCampos();
        setSuccess('Venda cancelada com sucesso!');
      }
    } else {
      alert('Não há venda em andamento!');
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
          console.log('🔥 ESC pressionado (DOM)');
          handleShortcut('ESC');
        }
      };

      window.addEventListener('keydown', handleKeyPress);
      return (): void => {
        window.removeEventListener('keydown', handleKeyPress);
      };
    } else {
      console.log('🔗 Modo Electron - usando atalhos globais');
    }
  }, [isConnected, codigoAtual, quantidadeAtual, items]);

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
          />
        </div>

        {/* Product Display Component */}
        <ProductDisplay items={items} />

        {/* Footer Actions Component */}
        <FooterActions 
          isConnected={isConnected}
          isListening={isConnected}
        />
      </div>
    </div>
  );
};

export default PDVInterface;