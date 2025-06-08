import { createContext, useContext } from 'react';
import { useProductAPI } from './useProductAPI';
import { useSaleAPI } from './useSaleAPI';

const ElectronContext = createContext(null as any);

export const ElectronProvider = ({ children }: { children: React.ReactNode }) => {
  const product = useProductAPI();
  const sale = useSaleAPI();

  return (
    <ElectronContext.Provider value={{ product, sale }}>
      {children}
    </ElectronContext.Provider>
  );
};

export const useElectron = () => useContext(ElectronContext);
