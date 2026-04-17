# EnergiCalc - Backend

API em Node.js + Express para simulação de fatura de energia elétrica.

Este backend nasceu como projeto de estudo e foi evoluindo em camadas (`routes -> controllers -> services -> data/repository`) para manter o código organizado e fácil de manter.

## O que a API já faz

- Simulação de fatura com itens separados (`TE`, `TUSD`, `Bandeira`, `PIS`, `COFINS`, `ICMS`, `CIP`)
- Consulta de distribuidoras (com filtro e paginação)
- Resolução de distribuidora por cidade + UF
- Consulta da bandeira vigente
- Consulta de tarifas
- Consulta de impostos base
- Consulta de CIP por município
- Fallback local quando fontes externas falham
- Testes automatizados com Jest + Supertest

## Stack

- Node.js
- Express
- Jest
- Supertest
- PostgreSQL (opcional para persistência de distribuidoras)
- JSON local como fallback de dados

## Arquitetura

Padrão adotado:

`routes -> controllers -> services -> data/repository`

Resumo das responsabilidades:

- `routes`: define endpoints
- `controllers`: valida entrada e monta resposta HTTP
- `services`: regra de negócio
- `data`: leitura/sincronização/cache/fallback
- `repository`: integração com banco quando habilitado

## Como rodar

### 1) Instalar dependências

```bash
cd backend
npm install
```

### 2) Configurar `.env` (opcional)

Arquivo: `backend/.env`

```env
PORT=3000
NODE_ENV=development

# Opcional: habilitar banco de distribuidoras
DB_DISTRIBUIDORAS_ENABLED=false
DATABASE_URL=
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_SSL=false

# Opcional: ajuste de sincronização de dados externos
ANEEL_TARIFAS_SYNC_INTERVAL_MS=21600000
```

### 3) Subir servidor

```bash
npm run dev
```

API disponível em: `http://localhost:3000`

Health check: `http://localhost:3000/health`

## Scripts

```bash
npm run dev        # sobe backend
npm start          # sobe backend
npm test           # roda testes
npm run cip:sync   # sincronização incremental da base CIP
```

## Endpoints principais

### `GET /health`
Retorno básico de saúde da API.

### `GET /api/distribuidoras`
Lista distribuidoras.

Query params opcionais:
- `uf`
- `nome`
- `page`
- `limit`

### `GET /api/distribuidoras/resolver?cidade=...&uf=...`
Resolve a distribuidora com base em cidade + UF.

### `GET /api/bandeira`
Retorna bandeira vigente e valores por kWh.

### `GET /api/tarifas`
Lista tarifas de distribuidoras (com base em cache e fallback local).

### `GET /api/impostos`
Retorna impostos base usados na simulação.

### `GET /api/cip?cidade=...&uf=...`
Retorna status e estrutura de CIP por município.

Status possíveis:
- `oficial`
- `estimado`
- `nao_encontrado`

### `GET /api/calculo`
Simulação principal com leituras.

Query params obrigatórios:
- `leituraAnterior`
- `leituraAtual`
- `diasDecorridos`
- `bandeira`
- e uma origem de distribuidora:
  - `distribuidoraId`, ou
  - `cidade + uf`

### `POST /api/calculo`
Simulação por consumo direto.

Body esperado:
- `consumo`
- `bandeira`
- `distribuidora` (nome) **ou** `cidade + uf`

## Exemplo rápido de cálculo

```http
GET /api/calculo?leituraAnterior=1000&leituraAtual=2000&diasDecorridos=30&cidade=Vila%20Velha&uf=ES&bandeira=verde
```

Exemplo de retorno (resumido):

```json
{
  "success": true,
  "data": {
    "statusSimulacao": "simulado",
    "distribuidora": "EDP Espírito Santo",
    "consumoKwh": 1000,
    "itens": [
      { "codigo": "te", "valor": 0 },
      { "codigo": "tusd", "valor": 0 },
      { "codigo": "pis", "valor": 0 },
      { "codigo": "cofins", "valor": 0 },
      { "codigo": "icms", "valor": 0 },
      { "codigo": "cip", "valor": 0 }
    ],
    "cip": {
      "status": "oficial",
      "valor": 0,
      "modeloCobranca": "faixa_consumo",
      "confianca": "media",
      "lei": {
        "numero": "...",
        "descricao": "..."
      },
      "fonteUrl": "...",
      "ultimaAtualizacao": "..."
    },
    "total": 0,
    "aviso": "Esta simulação não considera valores adicionais como multas..."
  }
}
```

## Sincronização e fallback

No boot do servidor, o projeto inicializa sincronizações em background para:
- tarifas
- bandeira
- distribuidoras
- cobertura de distribuidoras
- cache CIP

Se algum provedor externo ficar indisponível, o sistema continua com base local/cache para não travar a aplicação.

## Testes

Rodar:

```bash
npm test
```

Os testes cobrem rotas e serviços principais (incluindo cálculo e CIP).

## Estrutura de pastas

```text
backend/
  src/
    app.js
    server.js
    routes/
    controllers/
    services/
    data/
    repositories/
    middlewares/
    utils/
  scripts/
  tests/
```

## Observação importante

Este projeto está em fase de refinamento de fidelidade com faturas reais.
A base está estável para evolução incremental, sem precisar refatorar tudo de uma vez.
