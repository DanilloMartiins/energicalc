import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { catchError, finalize, forkJoin, of, Subscription, timeout } from 'rxjs';
import { CalculoGetPayload, ResultadoCalculo } from '../../../../core/models/calculo.model';
import { BandeiraAtual } from '../../../../core/models/bandeira.model';
import { Distribuidora } from '../../../../core/models/distribuidora.model';
import { ConsultaApiService } from '../../../../core/services/consulta-api.service';
import { SimuladorApiService } from '../../../../core/services/simulador-api.service';

function validarLeituras(formulario: AbstractControl): ValidationErrors | null {
  const leituraAnterior = Number(formulario.get('leituraAnterior')?.value);
  const leituraAtual = Number(formulario.get('leituraAtual')?.value);

  if (!Number.isFinite(leituraAnterior) || !Number.isFinite(leituraAtual)) {
    return null;
  }

  if (leituraAtual <= leituraAnterior) {
    return { leiturasInvalidas: true };
  }

  return null;
}

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

  readonly formulario = this.formBuilder.group(
    {
      leituraAnterior: [null as number | null, [Validators.required, Validators.min(0.01)]],
      leituraAtual: [null as number | null, [Validators.required, Validators.min(0.01)]],
      diasDecorridos: [30 as number | null, [Validators.required, Validators.min(0.01)]],
      distribuidora: ['', Validators.required],
      bandeira: ['', Validators.required],
    },
    {
      validators: [validarLeituras],
    },
  );

  carregandoOpcoes = false;
  enviando = false;
  erroCarregamento = '';
  erroSimulacao = '';
  avisoSimulacao = '';

  distribuidoras: Distribuidora[] = [];
  bandeiraVigente = '';
  resultado: ResultadoCalculo | null = null;
  ultimoPayloadSimulado: CalculoGetPayload | null = null;
  requisicaoSimulacao: Subscription | null = null;
  simulacaoWatchdogId: number | null = null;

  ngOnInit(): void {
    this.carregarDadosIniciais();
  }

  simular(): void {
    if (this.enviando) {
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const distribuidoraCodigo = String(this.formulario.controls.distribuidora.value).trim();
    const bandeira = String(this.formulario.controls.bandeira.value).trim();
    const payload = this.montarPayloadGet(distribuidoraCodigo, bandeira);

    if (this.payloadEhIgualAoUltimo(payload)) {
      this.avisoSimulacao = 'Altere algum campo para simular novamente.';
      return;
    }

    this.erroSimulacao = '';
    this.avisoSimulacao = '';
    this.enviando = true;

    this.simulacaoWatchdogId = window.setTimeout(() => {
      if (!this.enviando) {
        return;
      }

      this.requisicaoSimulacao?.unsubscribe();
      this.enviando = false;
      this.erroSimulacao =
        'A simulacao nao retornou a tempo. Verifique backend/proxy e tente novamente.';
    }, 16000);

    this.requisicaoSimulacao = this.simuladorApiService
      .calcularFaturaGet(payload)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.enviando = false;
          this.requisicaoSimulacao = null;

          if (this.simulacaoWatchdogId !== null) {
            window.clearTimeout(this.simulacaoWatchdogId);
            this.simulacaoWatchdogId = null;
          }
        }),
      )
      .subscribe({
        next: (resultado) => {
          this.resultado = resultado;
          this.ultimoPayloadSimulado = { ...payload };
        },
        error: (error) => {
          if ((error as { name?: string })?.name === 'TimeoutError') {
            this.erroSimulacao =
              'A simulacao demorou mais do que o esperado. Confira se o backend esta ativo e tente novamente.';
            return;
          }

          this.erroSimulacao = this.extrairMensagemErro(
            error,
            'Nao conseguimos calcular sua fatura agora. Tente novamente em instantes.',
          );
        },
      });
  }

  recarregarDadosIniciais(): void {
    this.carregarDadosIniciais();
  }

  get podeSimular(): boolean {
    if (this.enviando || this.carregandoOpcoes || this.distribuidoras.length === 0 || !this.bandeiraVigente) {
      return false;
    }

    if (this.formulario.invalid) {
      return false;
    }

    const distribuidoraCodigo = String(this.formulario.controls.distribuidora.value).trim();
    const bandeira = String(this.formulario.controls.bandeira.value).trim();
    const payloadAtual = this.montarPayloadGet(distribuidoraCodigo, bandeira);

    return !this.payloadEhIgualAoUltimo(payloadAtual);
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

  mensagemErroLeituraAnterior(): string {
    const campo = this.formulario.controls.leituraAnterior;

    if (!(campo.touched || campo.dirty) || !campo.errors) {
      return '';
    }

    if (campo.errors['required']) {
      return 'Vamos comecar pela leitura anterior para calcular seu consumo.';
    }

    if (campo.errors['min']) {
      return 'A leitura anterior precisa ser maior que zero.';
    }

    return 'Confira esse valor e tente novamente.';
  }

  mensagemErroLeituraAtual(): string {
    const campo = this.formulario.controls.leituraAtual;
    const tocado = campo.touched || campo.dirty;

    if (this.formulario.hasError('leiturasInvalidas') && tocado) {
      return 'A leitura atual precisa ser maior que a leitura anterior.';
    }

    if (!tocado || !campo.errors) {
      return '';
    }

    if (campo.errors['required']) {
      return 'Agora informe a leitura atual para fecharmos o calculo.';
    }

    if (campo.errors['min']) {
      return 'A leitura atual precisa ser maior que zero.';
    }

    return 'Confira esse valor e tente novamente.';
  }

  mensagemErroDiasDecorridos(): string {
    const campo = this.formulario.controls.diasDecorridos;

    if (!(campo.touched || campo.dirty) || !campo.errors) {
      return '';
    }

    if (campo.errors['required']) {
      return 'Informe quantos dias se passaram entre as leituras.';
    }

    if (campo.errors['min']) {
      return 'Os dias decorridos precisam ser maiores que zero.';
    }

    return 'Confira esse valor e tente novamente.';
  }

  mensagemErroDistribuidora(): string {
    const campo = this.formulario.controls.distribuidora;

    if (!(campo.touched || campo.dirty) || !campo.errors) {
      return '';
    }

    if (campo.errors['required']) {
      return 'Escolha uma distribuidora para a simulacao.';
    }

    return 'Escolha uma distribuidora valida para continuar.';
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
            'Nao conseguimos carregar as distribuidoras agora.',
          );
          return of([] as Distribuidora[]);
        }),
      ),
      bandeiraAtual: this.consultaApiService.obterBandeiraAtual().pipe(
        catchError((error) => {
          erroBandeira = this.extrairMensagemErro(
            error,
            'Nao conseguimos carregar a bandeira vigente no momento.',
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
              'Nao conseguimos conectar com o backend. Verifique se ele esta rodando na porta 3000 e tente novamente.';
          } else if (!distribuidoras.length) {
            this.erroCarregamento = erroDistribuidoras || 'As distribuidoras nao carregaram agora.';
          } else if (!this.bandeiraVigente) {
            this.erroCarregamento =
              erroBandeira || 'A bandeira vigente nao carregou agora. Tente novamente.';
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
      bandeira: bandeira.toLowerCase(),
    };
  }

  private payloadEhIgualAoUltimo(payloadAtual: CalculoGetPayload): boolean {
    if (!this.ultimoPayloadSimulado) {
      return false;
    }

    return (
      this.ultimoPayloadSimulado.leituraAnterior === payloadAtual.leituraAnterior &&
      this.ultimoPayloadSimulado.leituraAtual === payloadAtual.leituraAtual &&
      this.ultimoPayloadSimulado.diasDecorridos === payloadAtual.diasDecorridos &&
      this.ultimoPayloadSimulado.distribuidoraId === payloadAtual.distribuidoraId &&
      this.ultimoPayloadSimulado.bandeira === payloadAtual.bandeira
    );
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
