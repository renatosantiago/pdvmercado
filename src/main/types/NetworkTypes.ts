// ================================
// types/NetworkTypes.ts - Tipos para Sistema Multi-Caixa
// ================================

export interface NetworkConfiguration {
  CAIXA_ID: string;
  CAIXA_ROLE: 'server' | 'client';
  NETWORK_PATH: string;
  LOCAL_BACKUP_PATH: string;
  SYNC_INTERVAL: number;
  RECONNECTION_INTERVAL: number;
  OFFLINE_TIMEOUT: number;
  isNetworkEnabled: boolean;
  isOfflineMode: boolean;
}

export interface NetworkStatus {
  caixa_id: string;
  is_server: boolean;
  is_online: boolean;
  is_offline_mode: boolean;
  network_path: string;
  backup_path: string;
  last_sync: string;
  sync_pending?: number;
}

export interface ConnectionInfo {
  caixa_id: string;
  role: 'server' | 'client';
  is_online: boolean;
  is_offline_mode: boolean;
  primary_db: string;
  backup_db: string;
  network_enabled: boolean;
}

export interface SystemStats {
  total_produtos: number;
  vendas_hoje: number;
  pendente_sync: number;
  faturamento_hoje: number;
  caixa_id: string;
  role: string;
  is_online: boolean;
  timestamp: string;
}

export interface SyncOperation {
  id: number;
  tabela: string;
  registro_id: number;
  operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  dados_json: string;
  caixa_origem: string;
  timestamp: string;
  sincronizado: boolean;
}

export interface BackupInfo {
  backupPath: string;
  size?: number;
  timestamp: string;
  caixa_id: string;
  type: 'manual' | 'automatic' | 'network';
}

// Interfaces existentes mantidas para compatibilidade
export interface Product {
  id: number;
  codigo: string;
  ean13?: string;
  descricao: string;
  preco: number;
  custo?: number;
  estoque: number;
  estoque_minimo?: number;
  categoria_id?: number;
  unidade?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  caixa_origem?: string;
  sincronizado?: boolean;
}

export interface Sale {
  id: number;
  numero_venda: number;
  subtotal: number;
  desconto?: number;
  total: number;
  forma_pagamento?: string;
  status?: string;
  data_venda: string;
  caixa_id?: string;
  sincronizado?: boolean;
  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  venda_id: number;
  produto_id: number;
  codigo_produto: string;
  descricao_produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export interface Category {
  id: number;
  nome: string;
  ativo: boolean;
}

// Tipos para comunicação IPC
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PDVNotification {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  timestamp?: string;
}

export interface ShortcutEvent {
  key: 'F1' | 'F2' | 'F3' | 'F4' | 'ESC' | 'Ctrl+S' | 'Ctrl+I' | 'Ctrl+B';
  timestamp: string;
  caixa_id: string;
}

// Tipos para relatórios
export interface DailySalesReport {
  total_vendas: number;
  faturamento_total: number;
  ticket_medio: number;
  menor_venda: number;
  maior_venda: number;
  vendas_dinheiro: number;
  vendas_cartao: number;
  vendas_pix: number;
  caixa_id: string;
  status_rede: 'ONLINE' | 'OFFLINE';
}

export interface TopSellingProduct {
  codigo: string;
  descricao: string;
  total_vendido: number;
  faturamento: number;
  num_vendas: number;
}

// Tipos para configuração de instalação
export interface InstallationConfig {
  type: 'server' | 'client';
  caixa_number?: string;
  server_ip?: string;
  install_dir: string;
  network_path: string;
  auto_start: boolean;
}

// Eventos de sincronização
export interface SyncEvent {
  type: 'sync_start' | 'sync_complete' | 'sync_error' | 'connection_lost' | 'connection_restored';
  timestamp: string;
  caixa_id: string;
  details?: any;
}

// Tipos para monitoramento de performance
export interface PerformanceMetrics {
  query_time_ms: number;
  sync_time_ms?: number;
  network_latency_ms?: number;
  database_size_mb: number;
  memory_usage_mb: number;
  timestamp: string;
}

export type CaixaRole = 'server' | 'client';
export type ConnectionState = 'online' | 'offline' | 'connecting' | 'error';
export type SyncState = 'idle' | 'syncing' | 'error' | 'pending';

// Interface para status consolidado do sistema
export interface PDVSystemStatus {
  caixa: {
    id: string;
    role: CaixaRole;
    connection: ConnectionState;
    sync: SyncState;
  };
  network: NetworkStatus;
  database: {
    connected: boolean;
    path: string;
    size_mb?: number;
  };
  performance: PerformanceMetrics;
  last_update: string;
}