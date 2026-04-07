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
  cip: number;
  total: number;
}
