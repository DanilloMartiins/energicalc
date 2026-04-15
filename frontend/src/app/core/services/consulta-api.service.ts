import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, retry, timeout } from 'rxjs';
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

@Injectable({
  providedIn: 'root',
})
export class ConsultaApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api';
  private readonly timeoutMs = 8000;
  private readonly retryCount = 4;
  private readonly retryDelayMs = 1200;

  obterHealthStatus(): Observable<HealthStatus> {
    const request$ = this.http
      .get<ApiSuccessResponse<HealthStatus>>('/health')
      .pipe(timeout(this.timeoutMs), map((response) => response.data));

    return this.comRetry(request$);
  }

  listarDistribuidoras(): Observable<Distribuidora[]> {
    const request$ = this.http
      .get<ApiSuccessResponse<Distribuidora[] | DistribuidorasPaginadas>>(
        `${this.apiBaseUrl}/distribuidoras`,
      )
      .pipe(
        timeout(this.timeoutMs),
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

    return this.comRetry(request$);
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
      .pipe(timeout(this.timeoutMs), map((response) => response.data));

    return this.comRetry(request$);
  }

  obterBandeiraAtual(): Observable<BandeiraAtual> {
    const request$ = this.http
      .get<ApiSuccessResponse<BandeiraAtual>>(`${this.apiBaseUrl}/bandeira`)
      .pipe(timeout(this.timeoutMs), map((response) => response.data));

    return this.comRetry(request$);
  }

  listarTarifas(): Observable<TarifaDistribuidora[]> {
    const request$ = this.http
      .get<ApiSuccessResponse<TarifaDistribuidora[]>>(`${this.apiBaseUrl}/tarifas`)
      .pipe(timeout(this.timeoutMs), map((response) => response.data));

    return this.comRetry(request$);
  }

  obterImpostos(): Observable<Impostos> {
    const request$ = this.http
      .get<ApiSuccessResponse<Impostos>>(`${this.apiBaseUrl}/impostos`)
      .pipe(timeout(this.timeoutMs), map((response) => response.data));

    return this.comRetry(request$);
  }

  private comRetry<T>(request$: Observable<T>): Observable<T> {
    return request$.pipe(
      retry({
        count: this.retryCount,
        delay: this.retryDelayMs,
      }),
    );
  }
}
