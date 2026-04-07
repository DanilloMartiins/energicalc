import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
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

  obterHealthStatus(): Observable<HealthStatus> {
    return this.http
      .get<ApiSuccessResponse<HealthStatus>>('/health')
      .pipe(map((response) => response.data));
  }

  listarDistribuidoras(): Observable<Distribuidora[]> {
    return this.http
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

    return this.http
      .get<ApiSuccessResponse<DistribuidorasPaginadas>>(`${this.apiBaseUrl}/distribuidoras`, {
        params,
      })
      .pipe(map((response) => response.data));
  }

  obterBandeiraAtual(): Observable<BandeiraAtual> {
    return this.http
      .get<ApiSuccessResponse<BandeiraAtual>>(`${this.apiBaseUrl}/bandeira`)
      .pipe(map((response) => response.data));
  }

  listarTarifas(): Observable<TarifaDistribuidora[]> {
    return this.http
      .get<ApiSuccessResponse<TarifaDistribuidora[]>>(`${this.apiBaseUrl}/tarifas`)
      .pipe(map((response) => response.data));
  }

  obterImpostos(): Observable<Impostos> {
    return this.http
      .get<ApiSuccessResponse<Impostos>>(`${this.apiBaseUrl}/impostos`)
      .pipe(map((response) => response.data));
  }
}
