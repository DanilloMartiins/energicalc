export type ModoCalculo = 'post' | 'get';

export interface CalculoPostPayload {
  consumo: number;
  distribuidora: string;
  bandeira: string;
}

export interface CalculoGetPayload {
  leituraAnterior: number;
  leituraAtual: number;
  diasDecorridos: number;
  distribuidoraId: string;
  bandeira: string;
  cidade?: string;
  uf?: string;
}

export interface ItemCalculo {
  codigo: string;
  valor: number;
  tipo?: string;
  escopo?: string;
  modelo?: string;
}

export interface CipCalculo {
  status: 'oficial' | 'estimado' | 'nao_encontrado';
  valor: number;
  modeloCobranca: string | null;
  confianca: 'alta' | 'media' | 'baixa' | null;
  lei: {
    numero: string | null;
    descricao: string | null;
  };
  fonteUrl: string | null;
  ultimaAtualizacao: string | null;
  mensagem?: string | null;
}

export interface ResultadoCalculo {
  statusSimulacao: string;
  distribuidora: string;
  consumoKwh: number;
  mediaDiaria: number;
  diasDecorridos: number;
  valorEnergia: number;
  bandeira: {
    tipo: string;
    valor: number;
  };
  icms: number;
  cip: CipCalculo;
  itens: ItemCalculo[];
  total: number;
  aviso: string;
}
