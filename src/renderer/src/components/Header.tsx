// src/renderer/src/components/Header.tsx
import React, { useState, useEffect } from 'react';

interface NetworkStatus {
  caixa_id: string;
  is_online: boolean;
  is_server: boolean;
  network_path: string;
  last_sync: string;
}

interface HeaderProps {
  isConnected: boolean;
  isListening?: boolean;
}

const Header: React.FC<HeaderProps> = ({ isConnected, isListening = false }) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);

  // Formatação de data
  const currentDate: string = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Buscar status de rede quando conectado
  useEffect(() => {
    if (isConnected && typeof window !== 'undefined' && (window as any).electronAPI?.network) {
      const fetchNetworkStatus = async () => {
        try {
          const response = await (window as any).electronAPI.network.getStatus();
          if (response.success) {
            setNetworkStatus(response.data);
          }
        } catch (error) {
          console.error('Erro ao buscar status de rede:', error);
        }
      };

      fetchNetworkStatus();

      // Listener para atualizações de status
      const removeListener = (window as any).electronAPI.network.onStatusUpdate((status: NetworkStatus) => {
        setNetworkStatus(status);
      });

      return () => {
        removeListener();
      };
    }
  }, [isConnected]);

  // Determinar o nome do caixa para exibir
  const getCaixaDisplay = (): string => {
    if (networkStatus) {
      return networkStatus.is_server ? 'SERVIDOR' : networkStatus.caixa_id;
    }
    return 'Caixa: 01'; // Fallback padrão
  };

  // Determinar status de conexão
  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        label: '🌐 Modo Web',
        className: 'bg-yellow-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    if (networkStatus?.is_server) {
      return {
        label: '🖥️ Servidor',
        className: 'bg-blue-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    if (networkStatus?.is_online) {
      return {
        label: '🔗 Online',
        className: 'bg-green-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    if (networkStatus && !networkStatus.is_online) {
      return {
        label: '🔄 Offline',
        className: 'bg-orange-500 text-white px-2 py-1 rounded text-xs'
      };
    }

    return {
      label: '🔗 Conectado',
      className: 'bg-green-500 text-white px-2 py-1 rounded text-xs'
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

        {isListening && (
          <span className="bg-blue-400 text-white px-2 py-1 rounded text-xs">
            📷 Leitor Ativo
          </span>
        )}

        {/* Informações extras para debug (apenas em desenvolvimento) */}
        {process.env.NODE_ENV === 'development' && networkStatus && (
          <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs">
            {networkStatus.is_online ? 'NET' : 'LOCAL'}
          </span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Mostrar último sync se for cliente */}
        {networkStatus && !networkStatus.is_server && (
          <span className="text-xs opacity-75">
            Sync: {new Date(networkStatus.last_sync).toLocaleTimeString('pt-BR', { 
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