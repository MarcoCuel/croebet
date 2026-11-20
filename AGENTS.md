# Desenvolvimento da Croebet

## Contexto

- Projeto em operação, com usuários e dados reais. Preserve contas, saldos, partidas, cupons, históricos e auditoria. Não execute resets, limpezas destrutivas ou consolidação de migrations existentes em bases reais.
- Alterações de schema exigem migrations incrementais compatíveis com os dados existentes. Planeje implantação, preservação e recuperação; testes destrutivos somente em banco exclusivo de test, com as proteções de ambiente/destino existentes.
- Históricos de partidas devem permanecer disponíveis para auditoria, reprodução administrativa e futuros rankings, inclusive após exclusão de conta. Não registre segredos nem exponha estados privados do motor.
- Preserve funcionalidades, regras aprovadas e apresentação existente; refatorar não autoriza redesign nem expansão de escopo.

## Consulta por assunto

Leia somente a seção necessária: localize títulos com `rg -n '^##' arquivo.md` e consulte o trecho. Não carregue toda a documentação por padrão.

| Quando | Referência |
| --- | --- |
| Produto, textos, identidade ou economia | [CROEBET.md](CROEBET.md), seções 3–4 (conta/funcionalidades), 5–8 (marca/textos) e 10–11 (futuro) |
| Ambiente, comandos, API, banco ou próximas integrações | [docs/backend-architecture.md](docs/backend-architecture.md), pela seção correspondente |
| Componentes, estilos, carregamento inicial ou 3D | [docs/frontend-architecture.md](docs/frontend-architecture.md), pela seção correspondente |
| Regras ou apresentação do Flip 7 | [docs/flip7.md](docs/flip7.md) |

O código descreve o que existe; a documentação registra decisões e limites. Uma decisão ainda não implementada deve ser marcada como pendente, não descartada. Preserve o documento de produto da raiz; não o exclua nem substitua por um resumo durante limpezas.

## Responsabilidades

- Monorepo pnpm: `apps/web` (Next.js App Router/React), `apps/api` (Fastify) e `packages/shared` (contratos Zod). Preserve a stack; versões e scripts estão nos respectivos `package.json`.
- Regras de negócio, autenticação, permissões e persistência pertencem à API. Next consulta endpoints HTTP; não importa serviços internos nem acessa o banco. O motor do Flip 7 executa na API; o frontend apresenta estados confirmados. Entradas, potes, prêmios e devoluções em Croins são autoritativos e transacionais na API.
- `shared` não depende de frameworks, banco, segredos ou módulos internos das aplicações. Crie módulos e abstrações somente quando utilizados.

## Validação e manutenção

- Código: execute `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Interações: acrescente o E2E pertinente. Banco/transações: integração em banco `test`. Preparação em [Validação](docs/backend-architecture.md#validação).
- Documentação apenas: confira links, caminhos, consistência com o código e `git diff --check`; não exige repetir suítes funcionais.
- Não ignore erros nem desative regras globalmente para passar checks. Relate o que executou, falhas e impedimentos reais da rodada.
- Atualize a seção responsável pela mudança, substituindo o texto obsoleto. Não acrescente diário de entregas, contagens de testes, relatos de permissões do executor, cópias de contratos ou planos concorrentes. Prefira referências ao código e links entre documentos; crie outro documento somente se os existentes não comportarem o assunto.
