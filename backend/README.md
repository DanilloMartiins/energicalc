# EnergiCalc - Backend

API backend em Node.js + Express para simulacao de fatura de energia de distribuidoras brasileiras.

Arquitetura: route -> controller -> service -> data (JSON)

## Objetivo do projeto

Este projeto foi criado para praticar desenvolvimento backend com arquitetura em camadas, validacao de entrada, tratamento de erros e testes automatizados.

O foco e manter um codigo simples, legivel e facil de evoluir.

## Tecnologias usadas

- Node.js
- Express
- CommonJS
- Dotenv
- Jest
- Supertest
- JSON local como fonte de dados (sem banco de dados)

## Arquitetura

Padrao utilizado:

`routes -> controllers -> services -> data`

Responsabilidade de cada camada:

- `routes`: define os endpoints
- `controllers`: recebe request, valida entrada e devolve response
- `services`: contem as regras de negocio
- `data`: acesso aos dados JSON locais

## Como instalar e rodar

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` na raiz:

```env
PORT=3000
NODE_ENV=development
```

3. Rode em desenvolvimento:

```bash
npm run dev
```

4. Rode em modo normal:

```bash
npm start
```

Servidor padrao:

- `http://localhost:3000`

## Variaveis de ambiente

- `PORT`: porta da aplicacao
- `NODE_ENV`: ambiente de execucao (`development`, `production`, etc.)

## Padrao de resposta da API

Sucesso:

```json
{
  "success": true,
  "data": {}
}
```

Erro:

```json
{
  "success": false,
  "error": {
    "message": "Mensagem de erro"
  }
}
```

## Endpoints disponiveis

### 1) Health check

- Metodo: `GET`
- URL: `/health`

Exemplo de resposta:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### 2) Listar distribuidoras

- Metodo: `GET`
- URL: `/api/distribuidoras`
- Query params opcionais:
  - `uf` (filtro exato, ex: `PE`)
  - `nome` (filtro parcial, sem diferenciar maiuscula/minuscula)
  - `page` (paginacao)
  - `limit` (paginacao)

Exemplo de resposta:

```json
{
  "success": true,
  "data": [
    {
      "codigo": "ENEL_SP",
      "nome": "Enel Sao Paulo",
      "uf": "SP"
    }
  ]
}
```

Exemplo com filtros:

```http
GET /api/distribuidoras?uf=BA&nome=neoenergia
```

Exemplo de resposta com filtros:

```json
{
  "success": true,
  "data": [
    {
      "codigo": "COELBA",
      "nome": "Neoenergia Coelba",
      "uf": "BA"
    }
  ]
}
```

Exemplo com paginacao:

```http
GET /api/distribuidoras?page=1&limit=2
```

Exemplo de resposta com paginacao:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "codigo": "ENEL_SP",
        "nome": "Enel Sao Paulo",
        "uf": "SP"
      },
      {
        "codigo": "CPFL_PAULISTA",
        "nome": "CPFL Paulista",
        "uf": "SP"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 2,
      "totalItems": 3,
      "totalPages": 2
    }
  }
}
```

### 3) Obter bandeira atual

- Metodo: `GET`
- URL: `/api/bandeira`

Exemplo de resposta:

```json
{
  "success": true,
  "data": {
    "vigente": "verde",
    "valoresKwh": {
      "verde": 0,
      "amarela": 0.01874,
      "vermelha_p1": 0.03971,
      "vermelha_p2": 0.09492
    }
  }
}
```

### 4) Listar tarifas

- Metodo: `GET`
- URL: `/api/tarifas`

Exemplo de resposta:

```json
{
  "success": true,
  "data": [
    {
      "distribuidora": "Enel Sao Paulo",
      "tarifaKwh": 0.82
    },
    {
      "distribuidora": "CPFL Paulista",
      "tarifaKwh": 0.82
    },
    {
      "distribuidora": "Neoenergia Coelba",
      "tarifaKwh": 0.82
    }
  ]
}
```

### 5) Listar impostos

- Metodo: `GET`
- URL: `/api/impostos`

Exemplo de resposta:

```json
{
  "success": true,
  "data": {
    "icms": 0.25,
    "pis": 0.0165,
    "cofins": 0.076
  }
}
```

### 6) Calcular fatura

- Metodo: `GET`
- URL: `/api/calculo`
- Query params obrigatorios:
  - `leituraAnterior`
  - `leituraAtual`
  - `diasDecorridos`
  - `distribuidoraId`
  - `bandeira`

Exemplo de requisicao:

```http
GET /api/calculo?leituraAnterior=100&leituraAtual=150&diasDecorridos=30&distribuidoraId=1&bandeira=verde
```

Exemplo de resposta de sucesso:

```json
{
  "success": true,
  "data": {
    "distribuidora": "Enel Sao Paulo",
    "consumoKwh": 50,
    "mediaDiaria": 1.67,
    "diasDecorridos": 30,
    "valorEnergia": 41,
    "bandeira": {
      "tipo": "verde",
      "valor": 0
    },
    "icms": 10.25,
    "cip": 0,
    "total": 51.25
  }
}
```

Exemplo de erro de validacao:

```json
{
  "success": false,
  "error": {
    "message": "leitura anterior, leitura atual e dias decorridos devem ser maiores que zero."
  }
}
```

### 7) Calcular fatura (POST)

- Metodo: `POST`
- URL: `/api/calculo`
- Body JSON:
  - `consumo`
  - `distribuidora`
  - `bandeira`

Observacao atual:

- O service principal ainda usa `leituraAnterior`, `leituraAtual` e `diasDecorridos`.
- No `POST /api/calculo`, existe uma adaptacao simples:
  - `leituraAnterior = 0`
  - `leituraAtual = consumo`
  - `diasDecorridos = 30`

Essa abordagem atende o MVP e podera ser melhorada nas proximas evolucoes.

## Como rodar os testes

```bash
npm test
```

## Estrutura de pastas (resumo)

```text
src/
  app.js
  server.js
  routes/
  controllers/
  services/
  data/
  middlewares/
  utils/
tests/
  services/
  controllers/
  routes/
```

## Proximo passo sugerido

Como evolucao futura, pode ser adicionada documentacao com Swagger para facilitar consumo da API, mas isso ainda nao foi implementado neste projeto.

## Melhorias futuras (espaco para evolucao)

- [ ] Permitir informar `diasDecorridos` no `POST /api/calculo`
- [ ] Evoluir o mapeamento de consumo para suportar novos cenarios de negocio
- [ ] Validar regras de bandeira com fonte externa em tempo real
- [ ] Adicionar autenticacao da API (se necessario)
- [ ] Documentar endpoints com Swagger/OpenAPI
- [ ] ______________________________
- [ ] ______________________________
