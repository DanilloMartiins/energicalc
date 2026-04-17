# EnergiCalc - Frontend

Frontend em Angular (standalone) para consulta de dados e simulação de fatura.

A ideia aqui é manter uma interface simples: preencher dados, simular e enxergar o resumo da conta com os principais itens.

## Requisitos

- Node.js 22+
- npm

## Instalação

```bash
cd frontend
npm install
```

## Como rodar

### Modo frontend apenas

```bash
npm start
```

Frontend: `http://localhost:4301`

### Modo completo (frontend + backend)

Na raiz do projeto:

```bash
npm run dev
```

Esse comando sobe os dois em paralelo:
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:4301`

## Proxy

O frontend usa `proxy.conf.json` para encaminhar:

- `/api/*` -> `http://localhost:3000`
- `/health` -> `http://localhost:3000`

Ou seja, para funcionar completo, o backend precisa estar ativo.

## Rotas da aplicação

- `/` -> Home
- `/simulador` -> Simulador de fatura
- `/distribuidoras` -> Lista/filtro de distribuidoras
- `/bandeiras` -> Bandeira vigente e valores
- `**` -> Not found

## Fluxo do simulador

No simulador, o usuário informa:
- leitura anterior
- leitura atual
- dias decorridos
- cidade
- UF

A tela:
- calcula consumo automaticamente
- busca bandeira vigente pela API
- resolve distribuidora por cidade + UF
- chama `/api/calculo`
- exibe resumo com os itens da fatura (TE, TUSD, impostos, CIP etc.)

## Scripts úteis

```bash
npm start           # ng serve com proxy na porta 4301
npm run build       # build de produção
npm run watch       # build em watch mode
npm test            # testes
```

## Estrutura resumida

```text
frontend/src/app/
  core/
    models/
    services/
  features/
    home/
    simulador/
    distribuidoras/
    bandeiras/
    not-found/
```

## Dicas de troubleshooting

### 1) Página travada em "Carregando"
- Verifique se o backend está no ar (`http://localhost:3000/health`)
- Verifique se o frontend está na `4301` com proxy ativo

### 2) Erro de conexão com backend
- Rode `npm run dev` na raiz para subir os dois juntos
- Se porta estiver ocupada, rode `npm run dev:reset` na raiz e inicie novamente

### 3) Simulação não dispara
- Confira validações do formulário
- Confira cidade e UF válidas

## Observação

A interface prioriza clareza para usuário final (nome do item + descrição curta + valor), enquanto metadados técnicos continuam no backend para auditoria.
