import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
  status?: string;
}

export class HttpApiService {
  private config: ApiConfig;
  
  constructor(config: ApiConfig) {
    this.config = config;
  }
  
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint, params);
    return this.makeRequest<T>('GET', url);
  }
  
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    return this.makeRequest<T>('POST', url, data);
  }
  
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    return this.makeRequest<T>('PUT', url, data);
  }
  
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    return this.makeRequest<T>('PATCH', url, data);
  }
  
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    return this.makeRequest<T>('DELETE', url);
  }
  
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, this.config.baseUrl);
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, String(params[key]));
        }
      });
    }
    
    return url.toString();
  }
  
  private async makeRequest<T>(
    method: string, 
    url: string, 
    data?: any,
    retryCount: number = 0
  ): Promise<ApiResponse<T>> {
    
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: '/api/pdv' + parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'User-Agent': 'PDV-Client/1.0.0',
          'Content-Length': 0
        },
        timeout: this.config.timeout
      };
      
      // Adicionar Content-Length se houver dados
      if (data) {
        const jsonData = JSON.stringify(data);
        requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }
      
      const req = httpModule.request(requestOptions, (res) => {
        let responseBody = ''

        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          console.log(`Resposta da API (${method} ${url}):`, responseBody);
          try {
            const parsedResponse = JSON.parse(responseBody);
            
            const statusCode = res.statusCode ?? 0;
            if (statusCode >= 200 && statusCode < 300) {
              resolve(parsedResponse);
            } else {
              resolve({
                success: false,
                message: 'Erro HTTP',
                error: `Status ${statusCode}: ${parsedResponse.error || parsedResponse.message || 'Erro desconhecido'}`,
                timestamp: new Date().toISOString()
              });
            }
          } catch (error: any) {
            resolve({
              success: false,
              message: 'Erro ao processar resposta',
              error: `JSON inválido: ${error.message}`,
              timestamp: new Date().toISOString()
            });
          }
        });
      });
      
      req.on('error', async (error) => {
        console.error(`Erro na requisição ${method} ${url}:`, error);
        
        // Retry logic
        if (retryCount < this.config.retries) {
          console.log(`Tentativa ${retryCount + 1}/${this.config.retries} em 2s...`);
          setTimeout(() => {
            this.makeRequest<T>(method, url, data, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000);
        } else {
          resolve({
            success: false,
            message: 'Erro de conexão',
            error: `Falha após ${this.config.retries} tentativas: ${error.message}`,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          message: 'Timeout na requisição',
          error: `Timeout após ${this.config.timeout}ms`,
          timestamp: new Date().toISOString()
        });
      });
      
      // Enviar dados se houver
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }
}