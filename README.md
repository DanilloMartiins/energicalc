# Calculadora de Fatura de Energia - Backend

API backend em Node.js + Express para simulacao de fatura de energia de distribuidoras brasileiras.

## Status do projeto

Em desenvolvimento (MVP funcional da API).

## Registro de execucao (evolucao por dia)

### 26/03/2026
- Criacao da estrutura inicial do backend com Node.js + Express
- Definicao da arquitetura em camadas (`route -> controller -> service -> data`)
- Implementacao dos arquivos base (`app.js`, `server.js`, rotas, controllers, services e JSONs)
- Configuracao de scripts (`start` e `dev`) e instalacao das dependencias
- Primeira versao do README e subida inicial do projeto

### 27/03/2026
- Revisao geral da base para manter padrao de codigo simples e legivel (nivel Dev Jr bom)
- Melhorias no tratamento de erros da API (404 e JSON invalido)
- Ajustes de validacoes no fluxo de calculo e padronizacao das respostas
- Organizacao de detalhes do projeto para facilitar manutencao

### 28/03/2026
- Alinhamento do fluxo de calculo ponta a ponta (`route -> controller -> service`)
- Padronizacao do endpoint de calculo para `GET /api/calculo` com query params
- Ajustes de validacao para cenarios obrigatorios e entradas invalidas
- Validacao de cenarios principais de sucesso e erro (400 e 404)

### 29/03/2026
- Refatoracao da camada de dados para centralizar acesso aos JSON
- Criacao dos modulos:
  - `src/data/distribuidorasData.js`
  - `src/data/bandeiraData.js`
- Refatoracao dos services para consumir funcoes da camada `data`
- Atualizacao do README com o estado real da API e historico de evolucao

### 31/03/2026
- Revisao manual dos principais cenarios da API (sucesso, validacao, 404 e rota desconhecida)
- Refinamento do `calculoService` para melhorar organizacao interna com funcoes menores
- Separacao do fluxo de calculo em etapas claras (validacao, consumo, media, energia, bandeira, ICMS, CIP e total)
- Mantida a mesma arquitetura e o mesmo comportamento externo da API

## Arquitetura

Padrao usado no projeto:
- `route -> controller -> service -> data`

Responsabilidades:
- `routes`: mapeamento de endpoints
- `controllers`: leitura de request, chamada de service e retorno JSON
- `services`: regra de negocio e validacoes
- `data`: acesso centralizado aos dados JSON

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
|       |-- bandeira.json
|       |-- distribuidorasData.js
|       `-- bandeiraData.js
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
- Resposta:

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

### 4) Calculo de fatura
- Metodo: `GET`
- URL: `/api/calculo`
- Query params obrigatorios:
  - `leituraAnterior`
  - `leituraAtual`
  - `diasDecorridos`
  - `distribuidoraId`

Exemplo:

```http
GET /api/calculo?leituraAnterior=100&leituraAtual=150&diasDecorridos=30&distribuidoraId=1
```

Exemplo de resposta de sucesso:

```json
{
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
```

## Padrao de erro (controllers)

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

## Objetivo do repositorio

Servir como base de estudo e evolucao de um backend em camadas, com codigo simples, legivel e pronto para crescer por etapas.
