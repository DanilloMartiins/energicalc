export interface Distribuidora {
  codigo: string;
  nome: string;
  uf: string;
}

export interface DistribuidorasPaginacao {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface DistribuidorasPaginadas {
  items: Distribuidora[];
  pagination: DistribuidorasPaginacao;
}

export interface FiltroDistribuidoras {
  uf?: string;
  nome?: string;
  page?: number;
  limit?: number;
}
