# Calculadora de Fatura de Energia - Backend

API backend em Node.js + Express para simulacao de fatura de energia de distribuidoras brasileiras.

## Status do projeto

Em desenvolvimento (MVP em construcao).

Ja implementado ate agora:
- Estrutura base do backend com arquitetura em camadas
- Bootstrap do Express
- Rotas iniciais em `/api`
- Controllers com tratamento de erro
- Services iniciais usando dados locais em JSON
- Dados exemplo de distribuidoras e bandeira tarifaria
- Tratamento global de 404 e JSON invalido

## Arquitetura

Padrao usado no projeto:
- `controller -> service -> data`

Responsabilidades:
- `controllers`: leem request, chamam service e retornam JSON
- `services`: regra de negocio
- `data`: fonte local em arquivos JSON

## Stack

- Node.js
- Express
- CommonJS
- Nodemon (dev)
- JSON local (sem banco de dados)

## Estrutura de pastas

```text
.
|-- src/
|   |-- app.js
|   |-- server.js
|   |-- controllers/
|   |   |-- distribuidorasController.js
|   |   |-- bandeiraController.js
|   |   `-- calculoController.js
|   |-- services/
|   |   |-- distribuidorasService.js
|   |   |-- bandeiraService.js
|   |   `-- calculoService.js
|   |-- routes/
|   |   `-- index.js
|   `-- data/
|       |-- distribuidoras.json
|       `-- bandeira.json
|-- .gitignore
|-- package.json
|-- package-lock.json
`-- README.md
```

## Como rodar localmente

1. Instalar dependencias:

```bash
npm install
```

2. Rodar em desenvolvimento:

```bash
npm run dev
```

3. Rodar modo normal:

```bash
npm start
```

Servidor padrao:
- `http://localhost:3000`

## Observacao para PowerShell (Windows)

Se o PowerShell bloquear `npm` por politica de execucao, use:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd start
```

## Rotas atuais

### 1) Health check
- Metodo: `GET`
- URL: `/health`
- Resposta esperada:

```json
{
  "status": "ok"
}
```

### 2) Listar distribuidoras
- Metodo: `GET`
- URL: `/api/distribuidoras`

### 3) Obter bandeira atual
- Metodo: `GET`
- URL: `/api/bandeira`

### 4) Calculo (controller preparado)
- Metodo: `POST`
- URL: `/api/calculo`
- Parametros esperados (query string):
  - `leituraAnterior`
  - `leituraAtual`
  - `diasDecorridos`
  - `distribuidoraId`

Exemplo:

```http
POST /api/calculo?leituraAnterior=1200&leituraAtual=1350&diasDecorridos=30&distribuidoraId=ENEL_SP
```

Observacao importante:
- O controller de calculo ja esta validando entrada e tratamento de erro.
- A camada de service para essa nova assinatura (`calculoService.calcular`) ainda precisa ser concluida para fechar o fluxo completo desta rota.

## Padrao de erro usado nos controllers

Para erros esperados:

```json
{
  "error": "Invalid input",
  "message": "Detalhe do erro"
}
```

Codigos usados:
- `400` para validacao
- `404` para recurso nao encontrado
- `500` para erro inesperado

## Scripts disponiveis

```json
{
  "start": "node src/server.js",
  "dev": "nodemon src/server.js"
}
```

## Dados locais de exemplo

- `src/data/distribuidoras.json`
- `src/data/bandeira.json`

## Objetivo do repositorio

Servir como base de estudo e evolucao de um backend em camadas, com codigo simples, legivel e pronto para crescer por etapas.
