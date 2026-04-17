# EnergiCalc

Projeto de simulação de fatura de energia elétrica no Brasil.

A proposta é estimar a conta de forma transparente, mostrando os principais componentes da fatura (energia, uso da rede, tributos, bandeira e CIP), com suporte a fallback local quando APIs externas ficam instáveis.

## Estrutura do repositório

```text
.
├─ backend/   # API Node.js + Express
├─ frontend/  # Angular standalone
├─ scripts/   # scripts de orquestração local (dev/reset)
└─ status-projeto-energia.txt  # ponto de pausa e pendências
```

## Stack

- Backend: Node.js, Express, Jest, Supertest
- Frontend: Angular standalone
- Dados: JSON local + sincronização externa (quando disponível)
- Banco (opcional): PostgreSQL para repositório de distribuidoras

## Como rodar local

### 1) Instalar dependências de tudo

Na raiz:

```bash
npm run install:all
```

### 2) Subir backend + frontend

Na raiz:

```bash
npm run dev
```

Endereços:
- Frontend: `http://localhost:4301`
- Backend: `http://localhost:3000`
- Health backend: `http://localhost:3000/health`

### 3) Se travar por porta ocupada (Windows)

```bash
npm run dev:reset
npm run dev
```

## Scripts da raiz

```bash
npm run dev           # sobe backend + frontend
npm run dev:backend   # sobe só backend
npm run dev:frontend  # sobe só frontend
npm run dev:reset     # tenta limpar processos presos nas portas 3000/4301 (Windows)
npm run install:all   # instala backend + frontend
npm run cip:sync      # executa sincronização CIP (repasse de args para backend)
```

## Principais funcionalidades

- Simulador por leitura anterior/atual e dias
- Resolução automática de distribuidora por cidade + UF
- Consulta de bandeira vigente
- Consulta de CIP por município
- Cálculo com itens detalhados e aviso de escopo da simulação
- Fallback local para manter o sistema operacional mesmo com fontes externas instáveis

## Endpoints principais

- `GET /health`
- `GET /api/distribuidoras`
- `GET /api/distribuidoras/resolver?cidade=...&uf=...`
- `GET /api/bandeira`
- `GET /api/tarifas`
- `GET /api/impostos`
- `GET /api/cip?cidade=...&uf=...`
- `GET /api/calculo`
- `POST /api/calculo`

## Testes

Backend:

```bash
npm --prefix backend test
```

Frontend:

```bash
npm --prefix frontend test
```

## Documentação por módulo

- Backend: `backend/README.md`
- Frontend: `frontend/README.md`

## Estado atual do projeto

Se você estiver retomando depois de uma pausa, leia:

- `status-projeto-energia.txt`

Esse arquivo resume o ponto atual, pendências e próximas ações recomendadas.
