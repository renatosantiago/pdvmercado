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

interface ProductDisplayProps {
  items: Item[];
}

const ProductDisplay: React.FC<ProductDisplayProps> = ({ items }) => {
  // Produto em destaque (último item ou mensagem padrão)
  const produtoDestaque: string = items.length > 0 
    ? items[items.length - 1].descricao.toUpperCase()
    : 'CAIXA LIVRE...';

  return (
    <div className="bg-white p-6 border-t border-gray-200">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-blue-600 tracking-wide">
          {produtoDestaque}
        </h2>
      </div>
    </div>
  );
};

export default ProductDisplay;