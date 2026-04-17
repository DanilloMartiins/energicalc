import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { catchError, finalize, map, of, Subscription, switchMap, throwError, timeout } from 'rxjs';
import { CalculoGetPayload, ResultadoCalculo } from '../../../../core/models/calculo.model';
import { BandeiraAtual } from '../../../../core/models/bandeira.model';
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
export class SimuladorPage implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly simuladorApiService = inject(SimuladorApiService);
  private readonly consultaApiService = inject(ConsultaApiService);

  readonly formulario = this.formBuilder.group(
    {
      leituraAnterior: [null as number | null, [Validators.required, Validators.min(0.01)]],
      leituraAtual: [null as number | null, [Validators.required, Validators.min(0.01)]],
      diasDecorridos: [30 as number | null, [Validators.required, Validators.min(0.01)]],
      cidade: ['', Validators.required],
      uf: [
        '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(2), Validators.pattern(/^[a-zA-Z]{2}$/)],
      ],
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

  bandeiraVigente = '';
  resultado: ResultadoCalculo | null = null;
  ultimaChaveSimulacao = '';
  requisicaoSimulacao: Subscription | null = null;
  simulacaoWatchdogId: number | null = null;

  ngOnInit(): void {
    this.sincronizarEstadoCampos();
    this.carregarDadosIniciais();
  }

  ngOnDestroy(): void {
    this.requisicaoSimulacao?.unsubscribe();

    if (this.simulacaoWatchdogId !== null) {
      window.clearTimeout(this.simulacaoWatchdogId);
      this.simulacaoWatchdogId = null;
    }
  }

  simular(): void {
    if (this.enviando) {
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const cidade = String(this.formulario.controls.cidade.value).trim();
    const uf = String(this.formulario.controls.uf.value)
      .trim()
      .toUpperCase();
    const bandeira = String(this.formulario.controls.bandeira.value).trim();
    const chaveSimulacaoAtual = this.montarChaveSimulacao(cidade, uf, bandeira);

    if (chaveSimulacaoAtual === this.ultimaChaveSimulacao) {
      this.avisoSimulacao = 'Altere algum campo para simular novamente.';
      return;
    }

    this.erroSimulacao = '';
    this.avisoSimulacao = '';
    this.enviando = true;
    this.sincronizarEstadoCampos();

    this.simulacaoWatchdogId = window.setTimeout(() => {
      if (!this.enviando) {
        return;
      }

      this.requisicaoSimulacao?.unsubscribe();
      this.enviando = false;
      this.sincronizarEstadoCampos();
      this.erroSimulacao =
        'A simulação não retornou a tempo. Verifique backend/proxy e tente novamente.';
    }, 16000);

    this.requisicaoSimulacao = this.consultaApiService
      .resolverDistribuidoraPorCidadeUf(cidade, uf)
      .pipe(
        timeout(8000),
        switchMap((distribuidora) => {
          if (!distribuidora) {
            return throwError(() => new Error('DISTRIBUIDORA_NAO_ENCONTRADA_POR_CIDADE_UF'));
          }

          const payload = this.montarPayloadGet(distribuidora.codigo, bandeira);
          return this.simuladorApiService.calcularFaturaGet(payload).pipe(
            timeout(15000),
            map((resultado) => ({ resultado })),
          );
        }),
        finalize(() => {
          this.enviando = false;
          this.sincronizarEstadoCampos();
          this.requisicaoSimulacao = null;

          if (this.simulacaoWatchdogId !== null) {
            window.clearTimeout(this.simulacaoWatchdogId);
            this.simulacaoWatchdogId = null;
          }
        }),
      )
      .subscribe({
        next: ({ resultado }) => {
          this.resultado = resultado;
          this.ultimaChaveSimulacao = chaveSimulacaoAtual;
        },
        error: (error) => {
          if (error instanceof Error && error.message === 'DISTRIBUIDORA_NAO_ENCONTRADA_POR_CIDADE_UF') {
            this.erroSimulacao =
              'Não encontramos distribuidora para essa cidade/UF. Confira os dados e tente novamente.';
            return;
          }

          if ((error as { name?: string })?.name === 'TimeoutError') {
            this.erroSimulacao =
              'A simulação demorou mais do que o esperado. Confira se o backend está ativo e tente novamente.';
            return;
          }

          this.erroSimulacao = this.extrairMensagemErro(
            error,
            'Não conseguimos calcular sua fatura agora. Tente novamente em instantes.',
          );
        },
      });
  }

  recarregarDadosIniciais(): void {
    this.carregarDadosIniciais();
  }

  get podeSimular(): boolean {
    if (this.enviando || this.carregandoOpcoes || !this.bandeiraVigente) {
      return false;
    }

    if (this.formulario.invalid) {
      return false;
    }

    const cidade = String(this.formulario.controls.cidade.value).trim();
    const uf = String(this.formulario.controls.uf.value)
      .trim()
      .toUpperCase();
    const bandeira = String(this.formulario.controls.bandeira.value).trim();
    const chaveAtual = this.montarChaveSimulacao(cidade, uf, bandeira);

    return chaveAtual !== this.ultimaChaveSimulacao;
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
      return 'Vamos começar pela leitura anterior para calcular seu consumo.';
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
      return 'Agora informe a leitura atual para fecharmos o cálculo.';
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

  mensagemErroCidade(): string {
    const campo = this.formulario.controls.cidade;

    if (!(campo.touched || campo.dirty) || !campo.errors) {
      return '';
    }

    if (campo.errors['required']) {
      return 'Informe a cidade onde você mora.';
    }

    return 'Confira a cidade informada para continuar.';
  }

  mensagemErroUf(): string {
    const campo = this.formulario.controls.uf;

    if (!(campo.touched || campo.dirty) || !campo.errors) {
      return '';
    }

    if (campo.errors['required']) {
      return 'Informe a UF com 2 letras (ex.: PE).';
    }

    if (campo.errors['minlength'] || campo.errors['maxlength'] || campo.errors['pattern']) {
      return 'A UF deve conter apenas 2 letras.';
    }

    return 'Confira a UF informada para continuar.';
  }

  formatarBandeira(tipoBandeira: string): string {
    return tipoBandeira
      .split('_')
      .map((trecho) => trecho.charAt(0).toUpperCase() + trecho.slice(1))
      .join(' ');
  }

  private carregarDadosIniciais(): void {
    this.carregandoOpcoes = true;
    this.sincronizarEstadoCampos();
    this.erroCarregamento = '';
    this.bandeiraVigente = '';
    let erroBandeira = '';

    this.consultaApiService
      .obterBandeiraAtual()
      .pipe(
        catchError((error) => {
          erroBandeira = this.extrairMensagemErro(
            error,
            'Não conseguimos carregar a bandeira vigente no momento.',
          );
          return of(null as BandeiraAtual | null);
        }),
      )
      .pipe(
        finalize(() => {
          this.carregandoOpcoes = false;
          this.sincronizarEstadoCampos();
        }),
      )
      .subscribe({
        next: (bandeiraAtual) => {
          this.bandeiraVigente = bandeiraAtual?.vigente?.trim() ?? '';

          if (this.bandeiraVigente) {
            this.formulario.patchValue({ bandeira: this.bandeiraVigente });
          }

          if (!this.bandeiraVigente) {
            this.erroCarregamento =
              erroBandeira || 'A bandeira vigente não carregou agora. Tente novamente.';
          }

          this.sincronizarEstadoCampos();
        },
      });
  }

  private sincronizarEstadoCampos(): void {
    const camposEditaveis = !this.enviando && !this.carregandoOpcoes;

    this.definirEstadoControle(this.formulario.controls.leituraAnterior, camposEditaveis);
    this.definirEstadoControle(this.formulario.controls.leituraAtual, camposEditaveis);
    this.definirEstadoControle(this.formulario.controls.diasDecorridos, camposEditaveis);
    this.definirEstadoControle(this.formulario.controls.cidade, camposEditaveis);
    this.definirEstadoControle(this.formulario.controls.uf, camposEditaveis);
  }

  private definirEstadoControle(controle: AbstractControl, habilitado: boolean): void {
    if (habilitado && controle.disabled) {
      controle.enable({ emitEvent: false });
      return;
    }

    if (!habilitado && controle.enabled) {
      controle.disable({ emitEvent: false });
    }
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

  private montarChaveSimulacao(cidade: string, uf: string, bandeira: string): string {
    const leituraAnterior = Number(this.formulario.controls.leituraAnterior.value);
    const leituraAtual = Number(this.formulario.controls.leituraAtual.value);
    const diasDecorridos = Number(this.formulario.controls.diasDecorridos.value);
    const cidadeNormalizada = cidade
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');

    return [
      leituraAnterior,
      leituraAtual,
      diasDecorridos,
      uf.trim().toUpperCase(),
      cidadeNormalizada,
      bandeira.trim().toLowerCase(),
    ].join('|');
  }

  private extrairMensagemErro(error: unknown, mensagemPadrao: string): string {
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return 'A requisição demorou demais para responder. Confira backend/proxy e tente novamente.';
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
