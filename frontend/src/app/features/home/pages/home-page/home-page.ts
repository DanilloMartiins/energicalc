import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { Impostos } from '../../../../core/models/impostos.model';
import { ConsultaApiService } from '../../../../core/services/consulta-api.service';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit {
  private readonly consultaApiService = inject(ConsultaApiService);
  private carregamentoId = 0;

  carregando = false;
  erro = '';
  statusApi: string | null = null;
  totalDistribuidoras: number | null = null;
  bandeiraAtual = '';
  valoresBandeira: { tipo: string; valor: number }[] = [];
  mediaTarifaKwh: number | null = null;
  impostos: Impostos | null = null;

  ngOnInit(): void {
    this.carregarResumo();
  }

  formatarBandeira(tipo: string): string {
    return tipo
      .split('_')
      .map((trecho) => trecho.charAt(0).toUpperCase() + trecho.slice(1))
      .join(' ');
  }

  private carregarResumo(): void {
    const carregamentoAtual = ++this.carregamentoId;
    this.carregando = true;
    this.erro = '';

    forkJoin({
      health: this.consultaApiService.obterHealthStatus(),
      distribuidoras: this.consultaApiService.listarDistribuidoras(),
      bandeira: this.consultaApiService.obterBandeiraAtual(),
      tarifas: this.consultaApiService.listarTarifas(),
      impostos: this.consultaApiService.obterImpostos(),
    })
      .pipe(
        finalize(() => {
          if (carregamentoAtual === this.carregamentoId) {
            this.carregando = false;
          }
        }),
      )
      .subscribe({
        next: ({ health, distribuidoras, bandeira, tarifas, impostos }) => {
          if (carregamentoAtual !== this.carregamentoId) {
            return;
          }

          this.statusApi = health.status === 'ok' ? 'Online' : 'Indisponivel';
          this.totalDistribuidoras = distribuidoras.length;
          this.impostos = impostos;
          this.mediaTarifaKwh = this.calcularMediaTarifa(tarifas.map((item) => item.tarifaKwh));

          this.bandeiraAtual = bandeira.vigente;
          this.valoresBandeira = Object.entries(bandeira.valoresKwh || {}).map(([tipo, valor]) => ({
            tipo,
            valor,
          }));
        },
        error: (error) => {
          if (carregamentoAtual !== this.carregamentoId) {
            return;
          }

          this.erro = this.extrairMensagemErro(
            error,
            'Nao foi possivel carregar os dados iniciais da home.',
          );
        },
      });
  }

  private calcularMediaTarifa(valores: number[]): number {
    if (valores.length === 0) {
      return 0;
    }

    const soma = valores.reduce((acumulado, atual) => acumulado + atual, 0);
    return soma / valores.length;
  }

  private extrairMensagemErro(error: unknown, mensagemPadrao: string): string {
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return 'A API demorou para responder. Verifique backend/proxy e tente novamente.';
    }

    const erro = error as {
      error?: {
        error?: {
          message?: string;
        };
        message?: string;
      };
    };

    return erro?.error?.error?.message || erro?.error?.message || mensagemPadrao;
  }
}
