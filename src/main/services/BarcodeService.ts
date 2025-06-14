// ================================
// BarcodeService.ts - Serviço para Leitor de Código de Barras
// ================================

import { BrowserWindow } from 'electron';
import { LogService } from './LogService';

export class BarcodeService {
  private mainWindow: BrowserWindow | null;
  private isListening: boolean = false;
  private logger: LogService;
  private barcodeBuffer: string = '';
  private lastKeyTime: number = 0;
  private readonly BARCODE_TIMEOUT = 100; // ms entre teclas do leitor
  private readonly MIN_BARCODE_LENGTH = 8;
  private readonly MAX_BARCODE_LENGTH = 20;

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
    this.logger = LogService.getInstance();
  }

  async initialize(): Promise<void> {
    this.logger.info('BARCODE_SERVICE', 'Inicializando serviço de codigo de barras...');
    
    // Verificar se há leitores USB conectados (implementação opcional)
    // await this.detectUSBReaders();
    
    // Por enquanto, usar captura de teclado global para leitores HID
    this.setupKeyboardCapture();
    
    this.logger.info('BARCODE_SERVICE', 'Servico de codigo de barras inicializado');
  }

  private setupKeyboardCapture(): void {
    // Simular leitura de código de barras via eventos de teclado rápidos
    // Leitores HID geralmente digitam muito rápido (>50 char/sec)
    
    if (!this.mainWindow) return;

    // Escutar eventos de input da janela principal
    this.mainWindow.webContents.on('before-input-event', (event, input) => {
      if (!this.isListening) return;

      const currentTime = Date.now();
      
      // Se passou muito tempo entre teclas, limpar buffer
      if (currentTime - this.lastKeyTime > this.BARCODE_TIMEOUT) {
        this.barcodeBuffer = '';
      }
      
      this.lastKeyTime = currentTime;

      // Processar apenas caracteres alfanuméricos
      if (input.type === 'keyDown' && this.isValidBarcodeChar(input.key)) {
        this.barcodeBuffer += input.key;
        
        // Verificar se completou um código de barras
        if (input.key === 'Enter' || this.barcodeBuffer.length >= this.MAX_BARCODE_LENGTH) {
          this.processBarcodeBuffer();
        }
      }
    });
  }

  private isValidBarcodeChar(char: string): boolean {
    // Aceitar apenas números, letras e alguns símbolos comuns em códigos
    return /^[a-zA-Z0-9\-_]$/.test(char);
  }

  private processBarcodeBuffer(): void {
    const codigo = this.barcodeBuffer.trim();
    
    // Validar tamanho mínimo
    if (codigo.length >= this.MIN_BARCODE_LENGTH) {
      this.logger.logBarcode(codigo, true);
      
      // Enviar para o renderer process
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('barcode:scanned', codigo);
      }
    }
    
    // Limpar buffer
    this.barcodeBuffer = '';
  }

  async startListening(): Promise<void> {
    this.isListening = true;
    this.logger.info('BARCODE_SERVICE', 'Iniciando escuta de codigos de barras');
    
    // Notificar renderer que está escutando
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('barcode:listening', true);
    }
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    this.barcodeBuffer = '';
    this.logger.info('BARCODE_SERVICE', 'Parou de escutar codigos de barras');
    
    // Notificar renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('barcode:listening', false);
    }
  }

  // Método para simular escaneamento (útil para testes)
  simulateScan(codigo: string): void {
    console.log(`🎭 Simulando escaneamento: ${codigo}`);
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('barcode:scanned', codigo);
    }
  }

  // Método para configurar códigos de teste automático
  startTestMode(): void {
    if (!this.isListening) return;
    
    const codigosTest = [
      '37658990198',
      '88769022', 
      '123456789',
      '987654321'
    ];
    
    let index = 0;
    
    const interval = setInterval(() => {
      if (!this.isListening) {
        clearInterval(interval);
        return;
      }
      
      this.simulateScan(codigosTest[index]);
      index = (index + 1) % codigosTest.length;
    }, 10000); // A cada 10 segundos
    
    console.log('🧪 Modo de teste ativado - códigos automáticos a cada 10s');
  }

  async disconnect(): Promise<void> {
    await this.stopListening();
    this.mainWindow = null;
    console.log('🔌 Serviço de código de barras desconectado');
  }

  // Getters para status
  get isActive(): boolean {
    return this.isListening;
  }

  get hasWindow(): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }
}

// ================================
// IMPLEMENTAÇÃO ALTERNATIVA PARA LEITORES USB/SERIAL
// (Descomente e adapte se usar leitor USB dedicado)
// ================================

/*
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export class USBBarcodeService extends BarcodeService {
  private serialPort: SerialPort | null = null;
  private parser: ReadlineParser | null = null;

  async initialize(): Promise<void> {
    try {
      // Tentar conectar na porta COM3 (Windows) ou /dev/ttyUSB0 (Linux)
      const portPath = process.platform === 'win32' ? 'COM3' : '/dev/ttyUSB0';
      
      this.serialPort = new SerialPort({
        path: portPath,
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      
      this.parser.on('data', (data: string) => {
        const codigo = data.trim();
        if (codigo && this.isListening) {
          console.log(`📷 USB Reader - Código escaneado: ${codigo}`);
          
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('barcode:scanned', codigo);
          }
        }
      });

      this.serialPort.on('error', (error) => {
        console.error('❌ Erro no leitor USB:', error);
      });

      console.log('✅ Leitor USB conectado');
      
    } catch (error) {
      console.error('❌ Erro ao conectar leitor USB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.close();
    }
    await super.disconnect();
  }
}
*/