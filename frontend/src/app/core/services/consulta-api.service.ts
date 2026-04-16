import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, retry, timeout } from 'rxjs';
import { ApiSuccessResponse } from '../models/api-response.model';
import { BandeiraAtual } from '../models/bandeira.model';
import {
  Distribuidora,
  DistribuidorasPaginadas,
  FiltroDistribuidoras,
} from '../models/distribuidora.model';
import { HealthStatus } from '../models/health.model';
import { Impostos } from '../models/impostos.model';
import { TarifaDistribuidora } from '../models/tarifa.model';
import fallbackBandeira from '../fallback/bandeira.json';
import fallbackDistribuidoras from '../fallback/distribuidoras.json';
import fallbackHealth from '../fallback/health.json';
import fallbackImpostos from '../fallback/impostos.json';
import fallbackTarifas from '../fallback/tarifas.json';

@Injectable({
  providedIn: 'root',
})
export class ConsultaApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api';
  private readonly timeoutMs = 3500;
  private readonly retryCount = 0;
  private readonly retryDelayMs = 0;

  obterHealthStatus(): Observable<HealthStatus> {
    const request$ = this.http
      .get<ApiSuccessResponse<HealthStatus>>('/health')
      .pipe(map((response) => response.data));

    return this.comResiliencia(request$, () => this.getFallbackHealth());
  }

  listarDistribuidoras(): Observable<Distribuidora[]> {
    const request$ = this.http
      .get<ApiSuccessResponse<Distribuidora[] | DistribuidorasPaginadas>>(
        `${this.apiBaseUrl}/distribuidoras`,
      )
      .pipe(
        map((response) => {
          const payload = response.data;

          if (Array.isArray(payload)) {
            return payload;
          }

          if (payload && Array.isArray(payload.items)) {
            return payload.items;
          }

          return [];
        }),
      );

    return this.comResiliencia(request$, () => this.getFallbackDistribuidoras());
  }

  listarDistribuidorasPaginadas(
    filtros: FiltroDistribuidoras,
  ): Observable<DistribuidorasPaginadas> {
    let params = new HttpParams()
      .set('page', String(filtros.page ?? 1))
      .set('limit', String(filtros.limit ?? 5));

    const uf = String(filtros.uf ?? '').trim();
    const nome = String(filtros.nome ?? '').trim();

    if (uf) {
      params = params.set('uf', uf);
    }

    if (nome) {
      params = params.set('nome', nome);
    }

    const request$ = this.http
      .get<ApiSuccessResponse<DistribuidorasPaginadas>>(`${this.apiBaseUrl}/distribuidoras`, {
        params,
      })
      .pipe(map((response) => response.data));

    return this.comResiliencia(request$, () => this.getFallbackDistribuidorasPaginadas(filtros));
  }

  obterBandeiraAtual(): Observable<BandeiraAtual> {
    const request$ = this.http
      .get<ApiSuccessResponse<BandeiraAtual>>(`${this.apiBaseUrl}/bandeira`)
      .pipe(map((response) => response.data));

    return this.comResiliencia(request$, () => this.getFallbackBandeira());
  }

  listarTarifas(): Observable<TarifaDistribuidora[]> {
    const request$ = this.http
      .get<ApiSuccessResponse<TarifaDistribuidora[]>>(`${this.apiBaseUrl}/tarifas`)
      .pipe(map((response) => response.data));

    return this.comResiliencia(request$, () => this.getFallbackTarifas());
  }

  obterImpostos(): Observable<Impostos> {
    const request$ = this.http
      .get<ApiSuccessResponse<Impostos>>(`${this.apiBaseUrl}/impostos`)
      .pipe(map((response) => response.data));

    return this.comResiliencia(request$, () => this.getFallbackImpostos());
  }

  resolverDistribuidoraPorCidadeUf(cidade: string, uf: string): Observable<Distribuidora | null> {
    const cidadeNormalizada = String(cidade ?? '').trim();
    const ufNormalizada = String(uf ?? '')
      .trim()
      .toUpperCase();

    if (!cidadeNormalizada || ufNormalizada.length !== 2) {
      return of(null);
    }

    const params = new HttpParams()
      .set('cidade', cidadeNormalizada)
      .set('uf', ufNormalizada);

    const request$ = this.http
      .get<ApiSuccessResponse<Distribuidora>>(`${this.apiBaseUrl}/distribuidoras/resolver`, { params })
      .pipe(map((response) => response.data));

    return this.comResiliencia(request$, () =>
      this.getFallbackDistribuidoraPorCidadeUf(cidadeNormalizada, ufNormalizada),
    );
  }

  private comResiliencia<T>(request$: Observable<T>, fallbackFactory: () => T): Observable<T> {
    const requestComTimeout$ = request$.pipe(timeout(this.timeoutMs));
    const requestComRetry$ =
      this.retryCount > 0
        ? requestComTimeout$.pipe(
            retry({
              count: this.retryCount,
              delay: this.retryDelayMs,
            }),
          )
        : requestComTimeout$;

    return requestComRetry$.pipe(catchError(() => of(fallbackFactory())));
  }

  private getFallbackHealth(): HealthStatus {
    return { ...(fallbackHealth as HealthStatus) };
  }

  private getFallbackBandeira(): BandeiraAtual {
    const dados = fallbackBandeira as BandeiraAtual;
    return {
      vigente: dados.vigente,
      valoresKwh: { ...(dados.valoresKwh || {}) },
    };
  }

  private getFallbackDistribuidoras(): Distribuidora[] {
    const lista = fallbackDistribuidoras as Distribuidora[];
    return lista.map((item) => ({
      codigo: item.codigo,
      nome: item.nome,
      uf: item.uf,
    }));
  }

  private getFallbackDistribuidorasPaginadas(filtros: FiltroDistribuidoras): DistribuidorasPaginadas {
    const pagina = Number(filtros.page) > 0 ? Number(filtros.page) : 1;
    const limite = Number(filtros.limit) > 0 ? Number(filtros.limit) : 5;
    const uf = String(filtros.uf ?? '')
      .trim()
      .toUpperCase();
    const nome = String(filtros.nome ?? '')
      .trim()
      .toLowerCase();

    const filtradas = this.getFallbackDistribuidoras().filter((item) => {
      const ufValida = !uf || item.uf.toUpperCase() === uf;
      const nomeValido =
        !nome ||
        `${item.nome} ${item.codigo}`
          .toLowerCase()
          .includes(nome);

      return ufValida && nomeValido;
    });

    const totalItems = filtradas.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limite);
    const inicio = (pagina - 1) * limite;
    const fim = inicio + limite;

    return {
      items: filtradas.slice(inicio, fim),
      pagination: {
        page: pagina,
        limit: limite,
        totalItems,
        totalPages,
      },
    };
  }

  private getFallbackTarifas(): TarifaDistribuidora[] {
    const lista = fallbackTarifas as TarifaDistribuidora[];
    return lista.map((item) => ({
      distribuidora: item.distribuidora,
      tarifaKwh: Number(item.tarifaKwh),
    }));
  }

  private getFallbackImpostos(): Impostos {
    return { ...(fallbackImpostos as Impostos) };
  }

  private getFallbackDistribuidoraPorCidadeUf(cidade: string, uf: string): Distribuidora | null {
    const cidadeNormalizada = this.normalizarCidade(cidade);
    const chave = `${uf}|${cidadeNormalizada}`;

    const mapaFallback: Record<string, string> = {
      'SP|SAO PAULO': 'ENEL_SP',
      'SP|GUARULHOS': 'ENEL_SP',
      'SP|OSASCO': 'ENEL_SP',
      'SP|CAMPINAS': 'CPFL_PAULISTA',
      'SP|RIBEIRAO PRETO': 'CPFL_PAULISTA',
      'SP|PIRACICABA': 'CPFL_PAULISTA',
      'BA|SALVADOR': 'COELBA',
      'BA|FEIRA DE SANTANA': 'COELBA',
      'BA|VITORIA DA CONQUISTA': 'COELBA',
    };

    const codigo = mapaFallback[chave];
    if (!codigo) {
      return null;
    }

    return this.getFallbackDistribuidoras().find((item) => item.codigo === codigo) || null;
  }

  private normalizarCidade(cidade: string): string {
    return String(cidade ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  getFallbackSnapshot(): {
    health: HealthStatus;
    distribuidoras: Distribuidora[];
    bandeira: BandeiraAtual;
    tarifas: TarifaDistribuidora[];
    impostos: Impostos;
  } {
    return {
      health: this.getFallbackHealth(),
      distribuidoras: this.getFallbackDistribuidoras(),
      bandeira: this.getFallbackBandeira(),
      tarifas: this.getFallbackTarifas(),
      impostos: this.getFallbackImpostos(),
    };
  }
}
