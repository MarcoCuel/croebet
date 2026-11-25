# Croebet

Plataforma da comunidade Cromunismo, com jogos multiplayer e economia fictícia em **Croins**, sem dinheiro real. Este guia reúne os comandos de instalação, desenvolvimento, validação e operação.

## Stack e estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `apps/web` | Next.js 16, React 19, TypeScript, Tailwind CSS 4 e componentes Radix; interface e proxy HTTP/Socket.IO |
| `apps/api` | Fastify, autenticação, regras dos jogos, economia, persistência e Socket.IO |
| `packages/shared` | Contratos e validações Zod compartilhados |
| `scripts` | Supervisão dos processos, deploy, backup e rollback |
| `ops` | Configuração do PostgreSQL de produção |
| `docs` | Documentação técnica e regras dos jogos |

PostgreSQL 18 em Docker, com Drizzle ORM. Sessões ficam no banco; senhas usam Argon2id. Imagens podem usar armazenamento local ou S3 compatível. O frontend consulta a API; não acessa diretamente o banco nem executa as regras autoritativas dos jogos.

## Requisitos

- Node.js **22.18.0 ou superior**, conforme `engines` do projeto.
- **pnpm 12.21.0**, versão fixada em `packageManager` na raiz.
- Docker com Docker Compose disponível e iniciado; no Mac, Docker Desktop.
- Google Chrome para os testes de navegador.

Execute os comandos deste guia na raiz do repositório, salvo indicação contrária. As versões exatas das dependências estão nos `package.json` e no `pnpm-lock.yaml`.

## Instalação local

### 1. Configurar os ambientes

Em uma instalação nova, copie os exemplos abaixo. Se os arquivos já existirem, preserve os valores atuais e confira apenas as variáveis necessárias.

```sh
cp -n .env.example .env
cp -n apps/api/.env.example apps/api/.env
cp -n apps/web/.env.example apps/web/.env.local
```

| Arquivo | Configuração |
| --- | --- |
| `.env` | Credenciais e porta do PostgreSQL de desenvolvimento |
| `apps/api/.env` | Ambiente, conexão do banco, origem web, segredo CSRF e armazenamento |
| `apps/web/.env.local` | Endereço interno da API e origem pública do site |

Na raiz, defina uma senha em `POSTGRES_PASSWORD`. Na API, configure `DATABASE_URL` com o mesmo usuário, senha, porta e banco do Compose. Para uma instalação nova com os valores padrão:

```dotenv
# apps/api/.env — substitua SUA_SENHA e SEU_SEGREDO
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=3001
DATABASE_URL=postgresql://croebet:SUA_SENHA@127.0.0.1:5432/croebet_development
WEB_ORIGIN=http://localhost:3000
CSRF_SECRET=SEU_SEGREDO
AVATAR_STORAGE=local
AVATAR_LOCAL_DIR=.data/avatars
```

Se a senha tiver caracteres especiais, codifique-os para uso na URL de conexão. Gere um segredo CSRF aleatório com pelo menos 32 caracteres:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No frontend, mantenha:

```dotenv
API_INTERNAL_URL=http://127.0.0.1:3001
WEB_ORIGIN=http://localhost:3000
```

Não versione arquivos de ambiente nem compartilhe seus segredos. As opções de S3 e demais variáveis estão nos [exemplos da API](apps/api/.env.example) e do [frontend](apps/web/.env.example).

### 2. Instalar e preparar o banco

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

`db:migrate` aplica migrations pendentes. O seed identifica o ambiente e cadastra Flip 7 sem sobrescrever edições; não popula contas, cupons, páginas ou apostas de exemplo. Em um banco existente, confirme o destino antes de aplicar alterações.

## Desenvolvimento

```sh
pnpm dev
```

Inicia web e API com hot reload em primeiro plano. `Ctrl+C` encerra os processos dessa execução; o PostgreSQL permanece ativo.

| Serviço | Endereço de desenvolvimento |
| --- | --- |
| Site | <http://localhost:3000> |
| API | <http://127.0.0.1:3001> |
| Health do processo | <http://127.0.0.1:3001/api/v1/health> |
| Prontidão do banco/ambiente | <http://127.0.0.1:3001/api/v1/health/ready> |
| PostgreSQL | `127.0.0.1:5432` |

Também é possível manter o desenvolvimento em segundo plano:

| Comando | Uso |
| --- | --- |
| `pnpm dev:start` | Iniciar web e API em segundo plano |
| `pnpm dev:stop` | Parar os processos supervisionados de desenvolvimento |
| `pnpm dev:status` | Consultar o estado dos processos |
| `pnpm dev:logs` | Mostrar as últimas linhas dos logs |
| `pnpm dev:web` | Iniciar somente o frontend |
| `pnpm dev:api` | Iniciar somente a API |

Use os comandos separados em terminais distintos quando precisar acompanhar cada aplicação. Não inicie dois modos ao mesmo tempo nas mesmas portas. Logs do supervisor ficam em `.data/development/logs`.

Para testar no celular, configure `DEV_WEB_ORIGINS=http://<IP-do-Mac>:3000` nos ambientes da API e do frontend, reinicie os processos e acesse esse endereço na mesma rede. A API continua em loopback; HTTP e Socket.IO passam pelo Next. Veja os detalhes em [acesso pela rede local](docs/backend-architecture.md#testar-no-celular-pela-rede-local).

## Banco de dados e migrations

| Comando | Uso |
| --- | --- |
| `pnpm db:up` | Iniciar o PostgreSQL de desenvolvimento e aguardar prontidão |
| `pnpm db:stop` | Parar o PostgreSQL de desenvolvimento, preservando o volume |
| `pnpm db:logs` | Acompanhar os logs do banco |
| `pnpm db:generate` | Gerar migrations a partir das alterações no schema Drizzle |
| `pnpm db:migrate` | Aplicar migrations pendentes no destino configurado |
| `pnpm db:seed` | Executar o seed do projeto |

Alterações de schema devem gerar migrations incrementais, compatíveis com os dados existentes. Revise o SQL gerado, valide em banco exclusivo de teste e mantenha backup recuperável antes da implantação em bases reais. Não edite ou consolide migrations já aplicadas.

O Compose mantém os dados em volume persistente. Alterar `POSTGRES_USER`, `POSTGRES_PASSWORD` ou `POSTGRES_DB` no `.env` não reconfigura um volume já inicializado.

`pnpm db:reset` é destrutivo e exclusivo de bases descartáveis explicitamente autorizadas. Exige as proteções de ambiente e confirmação documentadas em [preservação de dados e reset](docs/backend-architecture.md#preservação-de-dados-e-reset). Não execute esse comando na base local existente nem em produção. Não remova volumes para resolver erros de conexão ou migration.

## Validação e build

Para alterações de código, execute:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

| Comando | Uso |
| --- | --- |
| `pnpm lint` | ESLint de todos os pacotes, sem warnings |
| `pnpm typecheck` | Compilar os contratos compartilhados e verificar TypeScript |
| `pnpm test` | Compilar shared/API e executar testes unitários e operacionais |
| `pnpm build` | Compilar todos os pacotes; frontend com Next/Turbopack |
| `pnpm test:e2e` | Executar a configuração padrão do Playwright |
| `pnpm test:integration` | Executar integração da API em PostgreSQL exclusivo de teste |
| `pnpm test:ops` | Executar testes unitários dos scripts operacionais |
| `pnpm test:ops:integration` | Executar ensaios operacionais em infraestrutura sintética de teste |

O workflow `.github/workflows/validation.yml` executa lint, typecheck, testes unitários, migrations/seed, integração e build em push/PR, além de uma agenda diária. A família E2E roda na agenda e em execução manual.

Integração exige banco separado com marcador `test`, migrations/seed aplicados e `TEST_DATABASE_URL` configurada. E2E possui configurações específicas, algumas com build próprio; execute as suítes de navegador sequencialmente. A preparação completa está em [Validação](docs/backend-architecture.md#validação).

`pnpm build` gera os artefatos das aplicações. Para executá-las após o build, use `pnpm start` para o frontend e `pnpm start:api` para a API, com os ambientes configurados.

## Implantação

Os comandos de publicação, backup e recuperação estão documentados em [Produção independente no Mac](docs/backend-architecture.md#produção-independente-no-mac). Revise os requisitos e a configuração do ambiente antes de utilizá-los.

## Problemas comuns

| Sintoma | O que conferir |
| --- | --- |
| Docker indisponível | Inicie o Docker Desktop antes de `db:up` |
| Porta ocupada | Consulte `dev:status` e identifique o processo que usa a porta |
| Erro de conexão com o banco | Confira `DATABASE_URL`, credenciais do volume existente, porta e `db:logs` |
| Aplicações não ficam prontas | Consulte logs da API e migrations; health de prontidão não substitui migrations |
| Login/CSRF falhando | Confira `WEB_ORIGIN`, segredo CSRF e origens adicionais de desenvolvimento |

## Documentação do projeto

- [Produto, identidade e economia](CROEBET.md)
- [Backend, ambiente, operação e validação](docs/backend-architecture.md)
- [Frontend, componentes, estilos e 3D](docs/frontend-architecture.md)
- [Flip 7: regras e apresentação](docs/flip7.md)
- [Orientações de desenvolvimento](AGENTS.md)
