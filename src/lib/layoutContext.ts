import { useOutletContext } from 'react-router-dom';

export interface LayoutContext {
  openStockChart: (stock: any) => void;
}

export function useLayout(): LayoutContext {
  return useOutletContext<LayoutContext>();
}
