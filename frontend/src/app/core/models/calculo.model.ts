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
  cip: number | null;
  cipCalculadaSeparadamente: boolean;
  total: number;
  aviso: string;
}
