# EnergiCalc Frontend

Frontend do projeto **EnergiCalc**, construido com **Angular standalone** e proxy para o backend local.

## Requisitos

- Node.js 22 LTS
- npm

## Instalacao

```bash
cd frontend
npm install
```

## Rodando em desenvolvimento

```bash
npm start
```

Aplicacao: `http://localhost:4301`

## Subindo frontend + backend juntos (comando unico)

Na raiz do repositorio, rode:

```bash
npm run dev
```

Esse comando inicia:

- backend em `http://localhost:3000`
- frontend em `http://localhost:4301`

Para encerrar os dois processos, use `Ctrl + C`.

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

## Observacoes

- Se aparecer erro de carregamento no simulador, valide primeiro se o backend esta ativo em `http://localhost:3000/health`.
- Em ambiente Windows, se `npm` nao for reconhecido no terminal, valide o PATH do Node.js.
