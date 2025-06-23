// src/renderer/src/hooks/useShortcuts.tsx - HOOK PARA GERENCIAR ATALHOS POR TELA

import { useEffect, useRef } from 'react';

export interface ShortcutConfig {
  key: string;
  action: () => void;
  description?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean;
}

export interface UseShortcutsOptions {
  enabled?: boolean;
  context?: string; // Nome da tela/contexto para debug
  ignoreInputs?: boolean; // Ignorar atalhos quando inputs estão focados
  allowedInputs?: string[]; // IDs de inputs que podem receber atalhos
}

export function useShortcuts(
  shortcuts: ShortcutConfig[], 
  options: UseShortcutsOptions = {}
) {
  const {
    enabled = true,
    context = 'unknown',
    ignoreInputs = true,
    allowedInputs = []
  } = options;

  const shortcutsRef = useRef<ShortcutConfig[]>([]);
  
  // Atualizar shortcuts quando mudarem
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (e: KeyboardEvent): void => {
      // Verificar se deve ignorar inputs
      if (ignoreInputs) {
        const activeElement = document.activeElement as HTMLElement;
        const isInputActive = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.contentEditable === 'true'
        );

        // Se há input ativo e não está na lista de permitidos, ignorar
        if (isInputActive) {
          const inputId = activeElement.id;
          const isAllowed = allowedInputs.includes(inputId);
          
          if (!isAllowed) {
            // Permitir apenas ESC em inputs não permitidos
            if (e.key !== 'Escape') return;
          }
        }
      }

      // Procurar atalho correspondente
      const matchingShortcut = shortcutsRef.current.find(shortcut => {
        const keyMatches = shortcut.key.toLowerCase() === e.key.toLowerCase();
        const ctrlMatches = (shortcut.ctrlKey || false) === e.ctrlKey;
        const shiftMatches = (shortcut.shiftKey || false) === e.shiftKey;
        const altMatches = (shortcut.altKey || false) === e.altKey;
        
        return keyMatches && ctrlMatches && shiftMatches && altMatches;
      });

      if (matchingShortcut) {
        if (matchingShortcut.preventDefault !== false) {
          e.preventDefault();
        }
        
        console.log(`🎹 [${context}] Atalho executado: ${matchingShortcut.key}${matchingShortcut.ctrlKey ? ' + Ctrl' : ''}${matchingShortcut.shiftKey ? ' + Shift' : ''}${matchingShortcut.altKey ? ' + Alt' : ''}`);
        
        matchingShortcut.action();
      }
    };

    console.log(`🎹 [${context}] Ativando ${shortcuts.length} atalhos`);
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      console.log(`🎹 [${context}] Removendo atalhos`);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [enabled, context, ignoreInputs, allowedInputs.join(',')]);

  // Função para obter lista de atalhos formatada
  const getShortcutsList = (): string[] => {
    return shortcuts.map(shortcut => {
      let keyDisplay = shortcut.key;
      if (shortcut.ctrlKey) keyDisplay = `Ctrl+${keyDisplay}`;
      if (shortcut.shiftKey) keyDisplay = `Shift+${keyDisplay}`;
      if (shortcut.altKey) keyDisplay = `Alt+${keyDisplay}`;
      
      return shortcut.description ? 
        `${keyDisplay}: ${shortcut.description}` : 
        keyDisplay;
    });
  };

  return {
    getShortcutsList,
    isEnabled: enabled
  };
}

// ✅ HOOK ESPECÍFICO PARA PDV
export function usePDVShortcuts(actions: {
  addItem: () => void;
  goToPayment: () => void;
  cancelItem: () => void;
  cancelSale: () => void;
  clearFields: () => void;
  syncCache: () => void;
  focusCode: () => void;
}, options: Omit<UseShortcutsOptions, 'context'> = {}) {
  
  const shortcuts: ShortcutConfig[] = [
    {
      key: 'F1',
      action: actions.addItem,
      description: 'Adicionar item'
    },
    {
      key: 'F2',
      action: actions.goToPayment,
      description: 'Ir para pagamento'
    },
    {
      key: 'F3',
      action: actions.cancelItem,
      description: 'Cancelar último item'
    },
    {
      key: 'F4',
      action: actions.cancelSale,
      description: 'Cancelar venda inteira'
    },
    {
      key: 'F5',
      action: actions.syncCache,
      description: 'Sincronizar cache'
    },
    {
      key: 'F6',
      action: actions.focusCode,
      description: 'Focar campo código'
    },
    {
      key: 'Escape',
      action: actions.clearFields,
      description: 'Limpar campos'
    },
    {
      key: 'Delete',
      ctrlKey: true,
      action: actions.cancelSale,
      description: 'Cancelar venda (Ctrl+Del)'
    },
    {
      key: 'Backspace',
      ctrlKey: true,
      action: actions.cancelItem,
      description: 'Cancelar item (Ctrl+Backspace)'
    }
  ];

  return useShortcuts(shortcuts, {
    ...options,
    context: 'PDV',
    allowedInputs: ['codigo-input', 'quantidade-input'] // Permitir atalhos nesses inputs
  });
}

// ✅ HOOK PARA TELA DE PAGAMENTO
export function usePaymentShortcuts(actions: {
  addPayment: () => void;
  finalizeSale: () => void;
  cancel: () => void;
  selectDinheiro: () => void;
  selectCartaoCredito: () => void;
  selectCartaoDebito: () => void;
  selectPix: () => void;
  selectOutros: () => void;
}, options: Omit<UseShortcutsOptions, 'context'> = {}) {

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'Enter',
      action: actions.addPayment,
      description: 'Adicionar/Finalizar pagamento'
    },
    {
      key: 'Escape',
      action: actions.cancel,
      description: 'Voltar para PDV'
    },
    {
      key: 'F6',
      action: actions.selectDinheiro,
      description: 'Selecionar Dinheiro'
    },
    {
      key: 'F7',
      action: actions.selectCartaoCredito,
      description: 'Selecionar Cartão Crédito'
    },
    {
      key: 'F8',
      action: actions.selectCartaoDebito,
      description: 'Selecionar Cartão Débito'
    },
    {
      key: 'F9',
      action: actions.selectPix,
      description: 'Selecionar PIX'
    },
    {
      key: 'F10',
      action: actions.selectOutros,
      description: 'Selecionar Outros'
    }
  ];

  return useShortcuts(shortcuts, {
    ...options,
    context: 'PAYMENT',
    allowedInputs: ['payment-value-input'] // Input de valor do pagamento
  });
}

// ✅ EXEMPLO DE USO EM OUTRAS TELAS
export function useGenericShortcuts(
  customShortcuts: ShortcutConfig[],
  screenName: string,
  options: UseShortcutsOptions = {}
) {
  return useShortcuts(customShortcuts, {
    ...options,
    context: screenName
  });
}