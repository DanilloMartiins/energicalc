import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import {
  Distribuidora,
  DistribuidorasPaginadas,
  DistribuidorasPaginacao,
} from '../../../../core/models/distribuidora.model';
import { ConsultaApiService } from '../../../../core/services/consulta-api.service';

@Component({
  selector: 'app-distribuidoras-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './distribuidoras-page.html',
  styleUrl: './distribuidoras-page.scss',
})
export class DistribuidorasPage implements OnInit {
  private readonly consultaApiService = inject(ConsultaApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly filtrosForm = this.formBuilder.group({
    uf: [''],
    nome: [''],
  });

  distribuidoras: Distribuidora[] = [];
  carregando = false;
  erro = '';

  page = 1;
  limit = 5;
  totalItems = 0;
  totalPages = 0;
  private carregamentoId = 0;

  ngOnInit(): void {
    this.activatedRoute.queryParamMap.subscribe((params) => {
      const uf = params.get('uf') ?? '';
      const nome = params.get('nome') ?? '';
      const page = this.toPositiveInteger(params.get('page'), 1);
      const limit = this.toPositiveInteger(params.get('limit'), this.limit);

      this.filtrosForm.patchValue({ uf, nome }, { emitEvent: false });
      this.page = page;
      this.limit = limit;

      this.carregarDistribuidoras();
    });
  }

  aplicarFiltros(): void {
    this.atualizarQueryParams({
      page: 1,
      limit: this.limit,
      uf: this.normalizarTexto(this.filtrosForm.controls.uf.value),
      nome: this.normalizarTexto(this.filtrosForm.controls.nome.value),
    });
  }

  limparFiltros(): void {
    this.filtrosForm.reset({ uf: '', nome: '' });
    this.atualizarQueryParams({
      page: 1,
      limit: this.limit,
      uf: null,
      nome: null,
    });
  }

  paginaAnterior(): void {
    if (this.page > 1) {
      this.atualizarQueryParams({
        page: this.page - 1,
        limit: this.limit,
        uf: this.normalizarTexto(this.filtrosForm.controls.uf.value),
        nome: this.normalizarTexto(this.filtrosForm.controls.nome.value),
      });
    }
  }

  proximaPagina(): void {
    if (this.page < this.totalPages) {
      this.atualizarQueryParams({
        page: this.page + 1,
        limit: this.limit,
        uf: this.normalizarTexto(this.filtrosForm.controls.uf.value),
        nome: this.normalizarTexto(this.filtrosForm.controls.nome.value),
      });
    }
  }

  irParaPagina(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.page) {
      this.atualizarQueryParams({
        page,
        limit: this.limit,
        uf: this.normalizarTexto(this.filtrosForm.controls.uf.value),
        nome: this.normalizarTexto(this.filtrosForm.controls.nome.value),
      });
    }
  }

  trackByCodigo(_: number, item: Distribuidora): string {
    return item.codigo;
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  private carregarDistribuidoras(): void {
    const carregamentoAtual = ++this.carregamentoId;
    this.carregando = true;
    this.erro = '';
    const uf = this.normalizarTexto(this.filtrosForm.controls.uf.value);
    const nome = this.normalizarTexto(this.filtrosForm.controls.nome.value);

    this.consultaApiService
      .listarDistribuidorasPaginadas({
        page: this.page,
        limit: this.limit,
        uf,
        nome,
      })
      .pipe(
        switchMap((payload) => {
          if (payload.items.length > 0 || !nome) {
            return of(payload);
          }

          // Fallback local para suportar busca por codigo sem depender do backend.
          return this.consultaApiService.listarDistribuidoras().pipe(
            map((lista) => this.filtrarLocalPorNomeOuCodigo(lista, { uf, nome })),
          );
        }),
      )
      .subscribe({
        next: (payload) => {
          if (carregamentoAtual !== this.carregamentoId) {
            return;
          }

          this.carregando = false;
          this.distribuidoras = payload.items;
          this.totalItems = payload.pagination.totalItems;
          this.totalPages = payload.pagination.totalPages;
          this.page = payload.pagination.page;
          this.limit = payload.pagination.limit;
        },
        error: (error) => {
          if (carregamentoAtual !== this.carregamentoId) {
            return;
          }

          this.carregando = false;
          if ((error as { name?: string })?.name === 'TimeoutError') {
            this.erro = 'A API demorou para responder. Verifique backend/proxy e tente novamente.';
            return;
          }

          this.erro =
            error?.error?.error?.message ||
            error?.error?.message ||
            'Nao foi possivel carregar as distribuidoras.';
        },
      });
  }

  private filtrarLocalPorNomeOuCodigo(
    lista: Distribuidora[],
    filtros: { uf: string; nome: string },
  ): DistribuidorasPaginadas {
    const ufNormalizada = filtros.uf.trim().toUpperCase();
    const termoBusca = filtros.nome.trim().toLowerCase();

    const filtradas = lista.filter((item) => {
      const ufOk = !ufNormalizada || item.uf.toUpperCase() === ufNormalizada;
      const nomeOuCodigo = `${item.nome} ${item.codigo}`.toLowerCase();
      const nomeOk = !termoBusca || nomeOuCodigo.includes(termoBusca);
      return ufOk && nomeOk;
    });

    const inicio = (this.page - 1) * this.limit;
    const fim = inicio + this.limit;

    const pagination: DistribuidorasPaginacao = {
      page: this.page,
      limit: this.limit,
      totalItems: filtradas.length,
      totalPages: filtradas.length === 0 ? 0 : Math.ceil(filtradas.length / this.limit),
    };

    return {
      items: filtradas.slice(inicio, fim),
      pagination,
    };
  }

  private normalizarTexto(valor: string | null | undefined): string {
    return String(valor ?? '').trim();
  }

  private atualizarQueryParams(params: {
    page: number;
    limit: number;
    uf: string | null;
    nome: string | null;
  }): void {
    const queryParams: Params = {
      page: params.page,
      limit: params.limit,
      uf: params.uf || null,
      nome: params.nome || null,
    };

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams,
    });
  }

  private toPositiveInteger(value: string | null, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
