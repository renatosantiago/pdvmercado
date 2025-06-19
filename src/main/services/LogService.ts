// src/main/services/LogService.ts - VERSÃO CORRIGIDA
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  caixa_id?: string;
  user_id?: string;
}

// ARMAZENAR REFERÊNCIAS ORIGINAIS GLOBALMENTE
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
};

export class LogService {
  private static instance: LogService;
  private logDir: string;
  private currentLogFile: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5;
  private caixaId: string;
  private isWriting: boolean = false; // ✅ PREVENIR RECURSÃO

  private constructor(caixaId: string) {
    this.caixaId = caixaId;
    
    try {
      this.logDir = path.join(app.getPath('userData'), 'logs');
      this.currentLogFile = path.join(this.logDir, `pdv-${caixaId.toLowerCase()}-${this.getDateString()}.log`);
      this.ensureLogDirectory();
    } catch (error) {
      // USAR CONSOLE ORIGINAL EM CASO DE ERRO DE INICIALIZAÇÃO
      originalConsole.error('❌ Erro ao inicializar LogService:', error);
      
      // Fallback para pasta temporária
      this.logDir = path.join(process.cwd(), 'logs');
      this.currentLogFile = path.join(this.logDir, `pdv-${caixaId.toLowerCase()}-${this.getDateString()}.log`);
      this.ensureLogDirectory();
    }
  }

  public static getInstance(caixaId: string = 'PDV'): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService(caixaId);
    }
    return LogService.instance;
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      // USAR CONSOLE ORIGINAL PARA EVITAR RECURSÃO
      originalConsole.error('❌ Erro ao criar diretório de logs:', error);
    }
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const dataStr = entry.data ? ` | DATA: ${JSON.stringify(entry.data)}` : '';
    return `[${entry.timestamp}] [${levelName}] [${entry.category}] [${entry.caixa_id}] ${entry.message}${dataStr}\n`;
  }

  private writeToFile(logEntry: LogEntry): void {
    // PREVENIR RECURSÃO DURANTE ESCRITA
    if (this.isWriting) {
      return;
    }

    try {
      this.isWriting = true;
      const logString = this.formatLogEntry(logEntry);
      
      // Verificar se precisa rotacionar o log
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size >= this.maxLogSize) {
          this.rotateLogFile();
        }
      }

      fs.appendFileSync(this.currentLogFile, logString);
    } catch (error) {
      // USAR CONSOLE ORIGINAL PARA EVITAR RECURSÃO
      originalConsole.error('❌ Erro ao escrever log (usando console original):', error);
    } finally {
      this.isWriting = false;
    }
  }

  private rotateLogFile(): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = path.join(this.logDir, `pdv-${this.caixaId.toLowerCase()}-${timestamp}.log`);
      
      if (fs.existsSync(this.currentLogFile)) {
        fs.renameSync(this.currentLogFile, rotatedFile);
      }

      // Limpar logs antigos
      this.cleanupOldLogs();
    } catch (error) {
      originalConsole.error('❌ Erro ao rotacionar log:', error);
    }
  }

  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith(`pdv-${this.caixaId.toLowerCase()}-`) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          time: fs.statSync(path.join(this.logDir, file)).mtime
        }))
        .sort((a, b) => b.time.getTime() - a.time.getTime());

      // Manter apenas os últimos arquivos
      if (files.length > this.maxLogFiles) {
        files.slice(this.maxLogFiles).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      originalConsole.error('❌ Erro ao limpar logs antigos:', error);
    }
  }

  public log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      caixa_id: this.caixaId
    };

    // ESCREVER NO ARQUIVO SEM INTERCEPTAÇÃO
    this.writeToFile(entry);

    // MOSTRAR NO CONSOLE ORIGINAL PARA DESENVOLVIMENTO
    const levelName = LogLevel[level];
    const logMethod = level >= LogLevel.ERROR ? originalConsole.error : 
                     level >= LogLevel.WARN ? originalConsole.warn : 
                     originalConsole.log;
    
    try {
      logMethod(`[${levelName}] [${category}] ${message}`, data || '');
    } catch (error) {
      // Em caso de erro, usar console básico
      originalConsole.error('Erro ao exibir log:', error);
    }
  }

  public debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  public info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  public warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  public error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  public fatal(category: string, message: string, data?: any): void {
    this.log(LogLevel.FATAL, category, message, data);
  }

  // Métodos específicos para o PDV
  public logVenda(vendaId: number, total: number, items: any[]): void {
    this.info('VENDA', `Venda finalizada ID: ${vendaId}`, {
      total,
      items_count: items.length,
      items
    });
  }

  public logSync(operation: string, success: boolean, details?: any): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.log(level, 'SYNC', `${operation} - ${success ? 'SUCESSO' : 'ERRO'}`, details);
  }

  public logApiCall(endpoint: string, method: string, success: boolean, response?: any): void {
    const level = success ? LogLevel.DEBUG : LogLevel.ERROR;
    this.log(level, 'API', `${method} ${endpoint} - ${success ? 'OK' : 'ERRO'}`, response);
  }

  public logBarcode(codigo: string, found: boolean): void {
    this.info('BARCODE', `Código escaneado: ${codigo} - ${found ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
  }

  // Exportar logs para análise
  public exportLogs(startDate?: Date, endDate?: Date): string[] {
    const logs: string[] = [];
    
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith(`pdv-${this.caixaId.toLowerCase()}-`) && file.endsWith('.log'))
        .sort();

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (startDate || endDate) {
          // Filtrar por data se especificado
          const lines = content.split('\n').filter(line => {
            if (!line.trim()) return false;
            
            const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)\]/);
            if (!timestampMatch) return true;
            
            const lineDate = new Date(timestampMatch[1]);
            
            if (startDate && lineDate < startDate) return false;
            if (endDate && lineDate > endDate) return false;
            
            return true;
          });
          
          logs.push(...lines);
        } else {
          logs.push(...content.split('\n'));
        }
      }
    } catch (error) {
      this.error('LOG_EXPORT', 'Erro ao exportar logs', error);
    }

    return logs.filter(log => log.trim());
  }

  // Obter estatísticas dos logs
  public getLogStats(): any {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith(`pdv-${this.caixaId.toLowerCase()}-`) && file.endsWith('.log'));

      let totalSize = 0;
      let totalLines = 0;
      let errorCount = 0;
      let warnCount = 0;

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        totalLines += lines.length;

        errorCount += lines.filter(line => line.includes('[ERROR]')).length;
        warnCount += lines.filter(line => line.includes('[WARN]')).length;
      }

      return {
        total_files: files.length,
        total_size_mb: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        total_lines: totalLines,
        error_count: errorCount,
        warn_count: warnCount,
        log_directory: this.logDir
      };
    } catch (error) {
      originalConsole.error('Erro ao obter estatísticas de logs:', error);
      return null;
    }
  }
}

// VERSÃO SEGURA DA INTEGRAÇÃO COM CONSOLE
export function setupEnhancedLogging(caixaId: string): LogService {
  const logger = LogService.getInstance(caixaId);

  // INTERCEPTAÇÃO SEGURA - SEM RECURSÃO
  console.log = (...args) => {
    try {
      // Evitar interceptar logs do próprio LogService
      const message = args.join(' ');
      if (!message.includes('LogService') && !message.includes('❌ Erro ao escrever log')) {
        logger.debug('CONSOLE', message);
      }
    } catch (error) {
      // Usar console original em caso de erro
      originalConsole.error('Erro na interceptação do console.log:', error);
    }
    originalConsole.log(...args);
  };

  console.error = (...args) => {
    try {
      const message = args.join(' ');
      // EVITAR RECURSÃO: Não interceptar erros do próprio LogService
      if (!message.includes('LogService') && 
          !message.includes('❌ Erro ao escrever log') &&
          !message.includes('Erro ao exibir log')) {
        logger.error('CONSOLE', message);
      }
    } catch (error) {
      // FALHA SILENCIOSA PARA EVITAR LOOPS
      originalConsole.error('Erro na interceptação (usando original):', error);
    }
    originalConsole.error(...args);
  };

  console.warn = (...args) => {
    try {
      const message = args.join(' ');
      if (!message.includes('LogService')) {
        logger.warn('CONSOLE', message);
      }
    } catch (error) {
      originalConsole.error('Erro na interceptação do console.warn:', error);
    }
    originalConsole.warn(...args);
  };

  console.info = (...args) => {
    try {
      const message = args.join(' ');
      if (!message.includes('LogService')) {
        logger.info('CONSOLE', message);
      }
    } catch (error) {
      originalConsole.error('Erro na interceptação do console.info:', error);
    }
    originalConsole.info(...args);
  };

  // CAPTURAR ERROS NÃO TRATADOS COM SEGURANÇA
  process.on('uncaughtException', (error) => {
    try {
      logger.fatal('UNCAUGHT_EXCEPTION', error.message, {
        stack: error.stack,
        name: error.name
      });
    } catch (logError) {
      // Usar console original se logger falhar
      originalConsole.error('Uncaught Exception (logger failed):', error);
      originalConsole.error('Logger error:', logError);
    }
  });

  process.on('unhandledRejection', (reason) => {
    try {
      logger.fatal('UNHANDLED_REJECTION', String(reason), reason);
    } catch (logError) {
      originalConsole.error('Unhandled Rejection (logger failed):', reason);
      originalConsole.error('Logger error:', logError);
    }
  });

  return logger;
}