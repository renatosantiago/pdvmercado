// src/renderer/src/components/FooterActions.tsx
import React from 'react';

interface FooterActionsProps {
  isConnected: boolean;
  isListening?: boolean;
}

const FooterActions: React.FC<FooterActionsProps> = ({ 
  isConnected, 
  isListening = false 
}) => {
  return (
    <div className="bg-gray-100 p-4 rounded-b-lg border-t">
      <div className="flex justify-center space-x-4 text-xs text-gray-600">
        {/* Atalhos principais do PDV */}
        <div className="flex space-x-4">
          <span><strong>F1</strong> Adicionar</span>
          <span><strong>F2</strong> Finalizar</span>
          <span><strong>F3</strong> Cancelar Item</span>
          <span><strong>F4</strong> Cancelar Venda</span>
          <span><strong>ESC</strong> Limpar</span>
        </div>

        {/* Separador */}
        <span className="text-gray-400">|</span>

        {/* Atalhos de sistema */}
        <div className="flex space-x-4">
          <span><strong>Ctrl+B</strong> Backup</span>
          {isConnected && (
            <>
              <span><strong>Ctrl+S</strong> Sync</span>
              <span><strong>Ctrl+I</strong> Status</span>
            </>
          )}
        </div>

        {/* Status indicators */}
        {isListening && (
          <>
            <span className="text-gray-400">|</span>
            <span className="text-blue-600"><strong>📷</strong> Leitor Ativo</span>
          </>
        )}

        {isConnected && (
          <>
            <span className="text-gray-400">|</span>
            <span className="text-green-600"><strong>🌐</strong> Multi-Caixa</span>
          </>
        )}
      </div>
    </div>
  );
};

export default FooterActions;