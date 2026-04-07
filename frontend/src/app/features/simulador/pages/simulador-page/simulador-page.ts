import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CalculoGetPayload, ResultadoCalculo } from '../../../../core/models/calculo.model';
import { BandeiraAtual } from '../../../../core/models/bandeira.model';
import { Distribuidora } from '../../../../core/models/distribuidora.model';
import { ConsultaApiService } from '../../../../core/services/consulta-api.service';
import { SimuladorApiService } from '../../../../core/services/simulador-api.service';

@Component({
  selector: 'app-simulador-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './simulador-page.html',
  styleUrl: './simulador-page.scss',
})
export class SimuladorPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly simuladorApiService = inject(SimuladorApiService);
  private readonly consultaApiService = inject(ConsultaApiService);

  readonly formulario = this.formBuilder.group({
    leituraAnterior: [null as number | null, [Validators.required, Validators.min(0.01)]],
    leituraAtual: [null as number | null, [Validators.required, Validators.min(0.01)]],
    diasDecorridos: [30 as number | null, [Validators.required, Validators.min(0.01)]],
    distribuidora: ['', Validators.required],
    bandeira: ['', Validators.required],
  });

  carregandoOpcoes = false;
  enviando = false;
  erroCarregamento = '';
  erroSimulacao = '';

  distribuidoras: Distribuidora[] = [];
  bandeiraVigente = '';
  resultado: ResultadoCalculo | null = null;

  ngOnInit(): void {
    this.carregarDadosIniciais();
  }

  simular(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const distribuidoraCodigo = String(this.formulario.controls.distribuidora.value).trim();
    const bandeira = String(this.formulario.controls.bandeira.value).trim();

    this.erroSimulacao = '';
    this.resultado = null;
    this.enviando = true;

    this.simuladorApiService
      .calcularFaturaGet(this.montarPayloadGet(distribuidoraCodigo, bandeira))
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: (resultado) => {
          this.resultado = resultado;
        },
        error: (error) => {
          this.erroSimulacao = this.extrairMensagemErro(
            error,
            'Nao foi possivel calcular a fatura no momento.',
          );
        },
      });
  }

  recarregarDadosIniciais(): void {
    this.carregarDadosIniciais();
  }

  get consumoCalculado(): number | null {
    const leituraAnterior = Number(this.formulario.controls.leituraAnterior.value);
    const leituraAtual = Number(this.formulario.controls.leituraAtual.value);

    if (!Number.isFinite(leituraAnterior) || !Number.isFinite(leituraAtual)) {
      return null;
    }

    if (leituraAtual <= leituraAnterior) {
      return null;
    }

    return leituraAtual - leituraAnterior;
  }

  campoComErro(
    nomeCampo: 'leituraAnterior' | 'leituraAtual' | 'diasDecorridos' | 'distribuidora',
  ): boolean {
    const campo = this.formulario.controls[nomeCampo];
    return campo.invalid && (campo.touched || campo.dirty);
  }

  formatarBandeira(tipoBandeira: string): string {
    return tipoBandeira
      .split('_')
      .map((trecho) => trecho.charAt(0).toUpperCase() + trecho.slice(1))
      .join(' ');
  }

  private carregarDadosIniciais(): void {
    this.carregandoOpcoes = true;
    this.erroCarregamento = '';
    this.bandeiraVigente = '';
    let erroDistribuidoras = '';
    let erroBandeira = '';

    forkJoin({
      distribuidoras: this.consultaApiService.listarDistribuidoras().pipe(
        catchError((error) => {
          erroDistribuidoras = this.extrairMensagemErro(
            error,
            'Nao foi possivel carregar as distribuidoras.',
          );
          return of([] as Distribuidora[]);
        }),
      ),
      bandeiraAtual: this.consultaApiService.obterBandeiraAtual().pipe(
        catchError((error) => {
          erroBandeira = this.extrairMensagemErro(
            error,
            'Nao foi possivel carregar a bandeira vigente.',
          );
          return of(null as BandeiraAtual | null);
        }),
      ),
    })
      .pipe(finalize(() => (this.carregandoOpcoes = false)))
      .subscribe({
        next: ({ distribuidoras, bandeiraAtual }) => {
          this.distribuidoras = distribuidoras;
          this.bandeiraVigente = bandeiraAtual?.vigente?.trim() ?? '';

          if (!this.formulario.controls.distribuidora.value && distribuidoras.length > 0) {
            this.formulario.patchValue({ distribuidora: distribuidoras[0].codigo });
          }

          if (this.bandeiraVigente) {
            this.formulario.patchValue({ bandeira: this.bandeiraVigente });
          }

          if (!distribuidoras.length && !this.bandeiraVigente) {
            this.erroCarregamento =
              'Nao foi possivel conectar com o backend. Verifique se ele esta rodando na porta 3000.';
          } else if (!distribuidoras.length) {
            this.erroCarregamento =
              erroDistribuidoras || 'Nao foi possivel carregar as distribuidoras.';
          } else if (!this.bandeiraVigente) {
            this.erroCarregamento = erroBandeira || 'Nao foi possivel carregar a bandeira vigente.';
          }
        },
      });
  }

  private montarPayloadGet(distribuidoraCodigo: string, bandeira: string): CalculoGetPayload {
    return {
      leituraAnterior: Number(this.formulario.controls.leituraAnterior.value),
      leituraAtual: Number(this.formulario.controls.leituraAtual.value),
      diasDecorridos: Number(this.formulario.controls.diasDecorridos.value),
      distribuidoraId: distribuidoraCodigo,
      bandeira,
    };
  }

  private extrairMensagemErro(error: unknown, mensagemPadrao: string): string {
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
