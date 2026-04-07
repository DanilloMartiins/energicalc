# EnergiCalc Frontend

Frontend do projeto **EnergiCalc**, construído com **Angular standalone** e proxy para o backend local.

## Requisitos

- Node.js 22 LTS
- npm

## Instalação

```bash
cd frontend
npm install
```

## Rodando em desenvolvimento

```bash
npm start
```

Aplicação: `http://localhost:4301`

## Backend e proxy

O frontend usa `proxy.conf.json` para encaminhar:

- `/api/*` -> `http://localhost:3000`
- `/health` -> `http://localhost:3000`

Por isso, o backend precisa estar rodando em paralelo na porta `3000`.

## Rotas principais

- `/` Home
- `/simulador` Simulador de fatura
- `/distribuidoras` Lista de distribuidoras
- `/bandeiras` Bandeira vigente

## Simulador (fluxo atual)

- Consumo calculado automaticamente por `leituraAtual - leituraAnterior`
- Distribuidora carregada da API
- Bandeira vigente carregada automaticamente da API
- Envio para `GET /api/calculo`

## Build

```bash
npm run build
```

## Observações

- Se aparecer erro de carregamento no simulador, valide primeiro se o backend está ativo em `http://localhost:3000/health`.
- Em ambiente Windows, se `npm` não for reconhecido no terminal, valide o PATH do Node.js.
