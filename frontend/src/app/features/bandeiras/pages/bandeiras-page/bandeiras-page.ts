import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import { ConsultaApiService } from '../../../../core/services/consulta-api.service';

@Component({
  selector: 'app-bandeiras-page',
  imports: [CommonModule],
  templateUrl: './bandeiras-page.html',
  styleUrl: './bandeiras-page.scss',
})
export class BandeirasPage implements OnInit {
  private readonly consultaApiService = inject(ConsultaApiService);
  private carregamentoId = 0;

  carregando = false;
  erro = '';
  bandeiraAtual = '';
  valores: { tipo: string; valor: number }[] = [];

  ngOnInit(): void {
    this.carregarBandeira();
  }

  recarregar(): void {
    this.carregarBandeira();
  }

  formatarBandeira(tipo: string): string {
    return tipo
      .split('_')
      .map((trecho) => trecho.charAt(0).toUpperCase() + trecho.slice(1))
      .join(' ');
  }

  private carregarBandeira(): void {
    const carregamentoAtual = ++this.carregamentoId;
    this.carregando = true;
    this.erro = '';

    this.consultaApiService
      .obterBandeiraAtual()
      .pipe(
        finalize(() => {
          if (carregamentoAtual === this.carregamentoId) {
            this.carregando = false;
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (carregamentoAtual !== this.carregamentoId) {
            return;
          }

          this.bandeiraAtual = response.vigente;
          this.valores = Object.entries(response.valoresKwh || {}).map(([tipo, valor]) => ({
            tipo,
            valor,
          }));
        },
        error: (error) => {
          if (carregamentoAtual !== this.carregamentoId) {
            return;
          }

          this.erro =
            error?.error?.error?.message ||
            error?.error?.message ||
            'Não foi possível carregar a bandeira atual.';
        },
      });
  }
}
