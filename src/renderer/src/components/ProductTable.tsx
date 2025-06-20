import React from 'react';

interface Item {
  id: number;
  codigo: string;
  descricao: string;
  qtde: number;
  vlrUnit: number;
  total: number;
  produto_id?: number;
}

interface ProductTableProps {
  items: Item[];
  isConnected: boolean;
}

const ProductTable: React.FC<ProductTableProps> = ({ items, isConnected }) => {
  // Função para formatação de moeda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Items Table */}
      <div className="bg-gray-50 rounded-lg overflow-hidden flex flex-col h-full max-h-[calc(100vh-335px)]">
        {/* Table Header - Fixed */}
        <div className="bg-gray-200 flex-shrink-0">
          <table className="w-full table-fixed">
            <thead>
              <tr>
                <th className="text-left p-3 font-semibold text-sm w-1/12">ITEM</th>
                <th className="text-left p-3 font-semibold text-sm w-1/6">CÓDIGO</th>
                <th className="text-left p-3 font-semibold text-sm w-1/3">DESCRIÇÃO</th>
                <th className="text-center p-3 font-semibold text-sm w-1/6">QTDE.</th>
                <th className="text-right p-3 font-semibold text-sm w-1/6">VLR. UNIT.</th>
                <th className="text-right p-3 font-semibold text-sm w-1/6">TOTAL</th>
              </tr>
            </thead>
          </table>
        </div>
        
        {/* Table Body - Scrollable */}
        <div className="flex-1 overflow-y-auto h-full">
          <table className="w-full table-fixed">
            <tbody>
              {items.map((item: Item, index: number) => (
                <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="p-3 text-sm font-medium w-1/12">{index + 1}</td>
                  <td className="p-3 text-sm w-1/6 truncate" title={item.codigo}>{item.codigo}</td>
                  <td className="p-3 text-sm truncate w-1/3" title={item.descricao}>{item.descricao}</td>
                  <td className="p-3 text-sm text-center w-1/6">{item.qtde}</td>
                  <td className="p-3 text-sm text-right w-1/6">{formatCurrency(item.vlrUnit)}</td>
                  <td className="p-3 text-sm text-right font-medium w-1/6">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              {/* Espaço extra para quando há poucos itens */}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 text-lg">
                    Nenhum item adicionado à venda
                    <br />
                    <span className="text-sm">
                      {isConnected ? 
                        'Escaneie um código de barras ou digite manualmente' : 
                        'Digite um código de produto'
                      }
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductTable;