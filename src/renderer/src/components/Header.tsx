import React, { useState, useEffect } from 'react';

interface ApiStatus {
  caixa_id: string;
  is_online: boolean;
  api_available: boolean;
  cache: {
    total_produtos: number;
    vendas_pendentes: number;
    cache_size_mb: number;
    ultima_sync: string | null;
  };
  pending_sales: number;
}

interface HeaderProps {
  isConnected: boolean;
  isListening?: boolean;
}

const Header: React.FC<HeaderProps> = ({ isConnected, isListening = false }) => {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);

  // Formatação de data
  const currentDate: string = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  // ✅ ATUALIZADO: Buscar status da API
  useEffect(() => {
    if (isConnected && typeof window !== 'undefined' && (window as any).electronAPI?.api) {
      const fetchApiStatus = async () => {
        try {
          const response = await (window as any).electronAPI.api.getStatus();
          if (response.success) {
            setApiStatus(response.data);
          }
        } catch (error) {
          console.error('Erro ao buscar status da API:', error);
        }
      };

      fetchApiStatus();

      // Listener para atualizações de status
      const removeListener = (window as any).electronAPI.api.onStatusUpdate((status: ApiStatus) => {
        setApiStatus(status);
      });

      return () => {
        removeListener();
      };
    }
  }, [isConnected]);

  // Determinar o nome do caixa para exibir
  const getCaixaDisplay = (): string => {
    if (apiStatus) {
      return apiStatus.caixa_id;
    }
    return 'PDV Cliente'; // Fallback padrão
  };

  // ✅ ATUALIZADO: Status de conexão com API
  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        label: '🌐 Modo Web',
        className: 'bg-yellow-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    if (apiStatus?.is_online && apiStatus?.api_available) {
      return {
        label: '🟢 API Online',
        className: 'bg-green-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    if (apiStatus && !apiStatus.is_online) {
      return {
        label: '🔄 Cache Offline',
        className: 'bg-orange-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    return {
      label: '🔗 Conectado',
      className: 'bg-blue-500 text-white px-2 py-1 rounded text-xs'
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">{getCaixaDisplay()}</h1>
        
        <span className={connectionStatus.className}>
          {connectionStatus.label}
        </span>

        {/* ✅ NOVO: Vendas pendentes */}
        {(apiStatus?.pending_sales ?? 0) > 0 && (
          <span className="bg-red-500 text-white px-2 py-1 rounded text-xs animate-pulse">
            ⏳ {apiStatus?.pending_sales ?? 0} pendente{(apiStatus?.pending_sales ?? 0) > 1 ? 's' : ''}
          </span>
        )}

        {isListening && (
          <span className="bg-blue-400 text-white px-2 py-1 rounded text-xs">
            📷 Leitor Ativo
          </span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* ✅ NOVO: Última sincronização */}
        {apiStatus?.cache?.ultima_sync && (
          <span className="text-xs opacity-75">
            Sync: {new Date(apiStatus.cache.ultima_sync).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        )}
        
        <span className="text-sm">{currentDate}</span>
      </div>
    </div>
  );
};

export default Header;