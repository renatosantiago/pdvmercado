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
  last_health_check?: string;
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

  // Buscar status da API
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

  // Status de conexão com API
  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        label: '🌐 Modo Web',
        className: 'bg-yellow-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    // Verificar se a API está online com base no health check
    if (apiStatus?.is_online && apiStatus?.api_available) {
      return {
        label: '🟢',
        className: 'bg-green-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    // API offline detectada pelo health check
    if (apiStatus && !apiStatus.is_online) {
      return {
        label: '🔴',
        className: 'bg-red-500 text-white px-2 py-1 rounded text-xs animate-pulse'
      };
    }

    // Fallback para status desconhecido
    return {
      label: '🔗 Conectando...',
      className: 'bg-blue-500 text-white px-2 py-1 rounded text-xs'
    };
  };

  // Calcular tempo desde último health check
  const getLastHealthCheckInfo = (): string | null => {
    if (!apiStatus?.last_health_check) {
      return null;
    }

    const lastCheck = new Date(apiStatus.last_health_check);
    const now = new Date();
    const diffMs = now.getTime() - lastCheck.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return `Health: ${diffSeconds}s atrás`;
    } else if (diffSeconds < 3600) {
      const diffMinutes = Math.floor(diffSeconds / 60);
      return `Health: ${diffMinutes}min atrás`;
    } else {
      return `Health: ${lastCheck.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">{getCaixaDisplay()}</h1>
        
        <span className={connectionStatus.className}>
          {connectionStatus.label}
        </span>

        {/* Mostrar informações de health check */}
        {apiStatus?.last_health_check && (
          <span className="text-xs opacity-75">
            {getLastHealthCheckInfo()}
          </span>
        )}

        {/* Vendas pendentes */}
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
        {/* Última sincronização */}
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