import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ResultadoCalculo } from '../../../../core/models/calculo.model';
import { ConsultaApiService } from '../../../../core/services/consulta-api.service';
import { SimuladorApiService } from '../../../../core/services/simulador-api.service';
import { SimuladorPage } from './simulador-page';

describe('SimuladorPage', () => {
  let fixture: ComponentFixture<SimuladorPage>;
  let component: SimuladorPage;
  let consultaApiServiceMock: {
    obterBandeiraAtual: ReturnType<typeof vi.fn>;
    resolverDistribuidoraPorCidadeUf: ReturnType<typeof vi.fn>;
  };
  let simuladorApiServiceMock: {
    calcularFaturaGet: ReturnType<typeof vi.fn>;
  };

  const resultadoBase: ResultadoCalculo = {
    statusSimulacao: 'simulado',
    distribuidora: 'Enel Sao Paulo',
    consumoKwh: 1000,
    mediaDiaria: 33.33,
    diasDecorridos: 30,
    valorEnergia: 950,
    bandeira: {
      tipo: 'verde',
      valor: 0,
    },
    icms: 205,
    cip: {
      status: 'oficial',
      valor: 31.14,
      modeloCobranca: 'valor_fixo',
      confianca: 'alta',
      lei: {
        numero: '1234/2024',
        descricao: 'Lei municipal CIP',
      },
      fonteUrl: 'https://prefeitura.exemplo/cip',
      ultimaAtualizacao: '2026-04-01T10:00:00.000Z',
      mensagem: null,
    },
    itens: [
      { codigo: 'te', valor: 380 },
      { codigo: 'tusd', valor: 570 },
      { codigo: 'pis', valor: 15.68 },
      { codigo: 'cofins', valor: 72.2 },
      { codigo: 'icms', valor: 205 },
      { codigo: 'cip', valor: 31.14 },
    ],
    total: 1274.02,
    aviso:
      'Esta simulacao nao considera valores adicionais como multas, juros por atraso, parcelamentos, emprestimos na fatura ou compensacoes/creditos. Caso existam, o valor real pode ser diferente.',
  };

  beforeEach(async () => {
    consultaApiServiceMock = {
      obterBandeiraAtual: vi.fn(),
      resolverDistribuidoraPorCidadeUf: vi.fn(),
    };
    simuladorApiServiceMock = {
      calcularFaturaGet: vi.fn(),
    };

    consultaApiServiceMock.obterBandeiraAtual.mockReturnValue(
      of({
        vigente: 'verde',
        valoresKwh: {
          verde: 0,
          amarela: 0.0189,
          vermelha_p1: 0.0446,
          vermelha_p2: 0.0788,
        },
      }),
    );
    consultaApiServiceMock.resolverDistribuidoraPorCidadeUf.mockReturnValue(
      of({
        codigo: 'ENEL_SP',
        nome: 'Enel Sao Paulo',
        uf: 'SP',
      }),
    );
    simuladorApiServiceMock.calcularFaturaGet.mockReturnValue(of(resultadoBase));

    await TestBed.configureTestingModule({
      imports: [SimuladorPage],
      providers: [
        { provide: ConsultaApiService, useValue: consultaApiServiceMock as unknown as ConsultaApiService },
        { provide: SimuladorApiService, useValue: simuladorApiServiceMock as unknown as SimuladorApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SimuladorPage);
    component = fixture.componentInstance;
  });

  it('deve exibir CIP como item da fatura e remover mensagem de calculo separado', () => {
    component.resultado = resultadoBase;
    fixture.detectChanges();

    const textoTela = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(textoTela).toContain('CIP');
    expect(textoTela).toContain('Tributo municipal');
    expect(textoTela).not.toContain('CIP calculada separadamente');
  });

  it('deve enviar cidade e uf junto com distribuidoraId para o backend', () => {
    fixture.detectChanges();

    component.formulario.patchValue({
      leituraAnterior: 1000,
      leituraAtual: 2000,
      diasDecorridos: 30,
      cidade: 'Campinas',
      uf: 'sp',
      bandeira: 'verde',
    });

    component.simular();

    expect(simuladorApiServiceMock.calcularFaturaGet).toHaveBeenCalled();
    expect(simuladorApiServiceMock.calcularFaturaGet).toHaveBeenCalledWith(
      expect.objectContaining({
        distribuidoraId: 'ENEL_SP',
        cidade: 'Campinas',
        uf: 'SP',
      }),
    );
  });
});
