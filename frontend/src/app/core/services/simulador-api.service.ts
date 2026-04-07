import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiSuccessResponse } from '../models/api-response.model';
import {
  CalculoGetPayload,
  CalculoPostPayload,
  ResultadoCalculo,
} from '../models/calculo.model';

@Injectable({
  providedIn: 'root',
})
export class SimuladorApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api';

  calcularFaturaPost(payload: CalculoPostPayload): Observable<ResultadoCalculo> {
    return this.http
      .post<ApiSuccessResponse<ResultadoCalculo>>(`${this.apiBaseUrl}/calculo`, payload)
      .pipe(map((response) => response.data));
  }

  calcularFaturaGet(payload: CalculoGetPayload): Observable<ResultadoCalculo> {
    return this.http
      .get<ApiSuccessResponse<ResultadoCalculo>>(`${this.apiBaseUrl}/calculo`, {
        params: {
          leituraAnterior: String(payload.leituraAnterior),
          leituraAtual: String(payload.leituraAtual),
          diasDecorridos: String(payload.diasDecorridos),
          distribuidoraId: payload.distribuidoraId,
          bandeira: payload.bandeira,
        },
      })
      .pipe(map((response) => response.data));
  }
}
