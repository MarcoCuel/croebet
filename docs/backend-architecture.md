# Arquitetura da primeira versão funcional

Atualizado em 18/11/2026. Referência técnica e roadmap. Fundação iniciada; consultar o estado de implementação e validação ao final.

## Referências e situação atual

Este documento concentra decisões técnicas e roadmap. [../CROEBET.md](../CROEBET.md) continua sendo a referência de produto; [frontend-architecture.md](frontend-architecture.md) documenta interface e implementação atual; [flip7.md](flip7.md) detalha regras e apresentação do jogo; [../AGENTS.md](../AGENTS.md) define convenções de desenvolvimento. Ao aprovar uma mudança arquitetural, atualizar esta referência e corrigir os links ou instruções afetados, sem copiar o planejamento inteiro para outros arquivos.

A inspeção atual encontrou Next.js 16.4.6, React 19.2.8, TypeScript 6.0.3, Tailwind 4, Radix, GSAP, Lenis e Three.js/React Three Fiber. O workspace agora separa `apps/web`, `apps/api` e `packages/shared`. A fundação da API e os contratos estão escritos, mas a instalação das novas dependências está bloqueada no ambiente atual. O código de autenticação real foi acrescentado na rodada seguinte; sua execução com PostgreSQL ainda depende das pendências de ambiente. Não há multiplayer online.

Sessão, carteira, apostas, partidas e configurações usam o navegador. O login não verifica a senha. O Flip 7 tem motores puros para Clássico, Vingança e Brutal, pessoas no mesmo dispositivo e bots; os demais jogos do catálogo exibem “Em breve”. Rankings, conquistas e parte dos usuários administrativos são fixtures. O novo admin de cupons também é um protótipo local, sem resgate público integrado. Existem testes Node de regras/persistência e Playwright de interface.

## Decisões confirmadas e limites

| Tema | Decisão aprovada |
| --- | --- |
| Organização | Monorepo pnpm com frontend e backend separados. |
| Frontend | Next.js + React + TypeScript; preservar componentes, estilos, animações e navegação. |
| Backend | Fastify + Node.js + TypeScript, monólito modular responsável por toda a lógica de negócio. |
| Persistência | PostgreSQL, Drizzle + `pg`, migrations de schema e restrições relacionais. |
| Contratos | Zod, validação em runtime e tipos compartilháveis. |
| Autenticação | Username e senha, sem e-mail obrigatório; Argon2id e sessões opacas persistidas. |
| Multiplayer | Socket.IO + HTTP desde a primeira etapa multiplayer; PostgreSQL como fonte de verdade. |
| Avatares | Armazenamento compatível com S3. |
| Economia | Livro imutável, operações atômicas, idempotência e auditoria. |
| Dados atuais | Descartáveis, sem importação ou compatibilidade com o protótipo. |
| Escala inicial | Uma instância da API; sem necessidade concreta de Redis. |
| Docker inicial | Somente PostgreSQL em container no desenvolvimento; Next.js e Fastify continuam como processos Node no host. |

Não usar Route Handlers do Next.js como backend principal, polling da aplicação como transporte principal de partidas, banco acessível pelo frontend ou saldo/resultado calculado como autoridade no cliente. Não introduzir microsserviços, containerização das aplicações, filas externas ou workers separados sem necessidade demonstrada. O fallback HTTP long-polling do protocolo Socket.IO pode permanecer habilitado: ele não equivale à proposta descartada de consultar periodicamente a API para conduzir partidas.

Recomendações de implantação e desenho abaixo são propostas técnicas; valores de economia, regras de recuperação e políticas de partidas continuam abertos quando explicitamente indicados.

## Monorepo e responsabilidades

| Destino proposto | Conteúdo e responsabilidade |
| --- | --- |
| `apps/web/` | Aplicação Next.js existente: `app`, `components`, `features` de interface, `lib` cliente, `three`, fontes e `public`. |
| `apps/api/src/modules/` | Módulos de auth, users, wallet, rewards, coupons, betting, games, pages e administração, criados conforme utilizados. |
| `apps/api/src/db/` | Pool `pg`, schemas Drizzle, migrations e seeds necessários. Credenciais exclusivas da API. |
| `apps/api/src/realtime/` | Inicialização Socket.IO, autenticação de conexões, assinaturas e adaptação de comandos aos serviços. |
| `apps/api/src/scheduling/` | Executor interno de automações persistidas, no mesmo processo da API. |
| `packages/shared/` | Schemas Zod de entrada/saída, erros públicos, contratos HTTP/eventos e tipos de estado público. |
| Raiz | Workspace, lockfile único, comandos de coordenação, documentação e convenções. |

A menor reorganização recomendada é mover o frontend inteiro em uma etapa mecânica e isolada. Manter relações entre pastas e o alias `@/` apontando para `apps/web`, sem extrair o design system ou reescrever features. Mover testes de frontend junto dele; transferir testes de regras para a API quando o motor mudar de responsabilidade. Ajustar scripts, globs de ESLint/TypeScript, Playwright, `components.json` e raiz do Turbopack para o workspace, preservando configurações existentes. O `tsconfig` atual inclui `**/*.ts`: cada aplicação precisará de escopo próprio para não compilar a outra incidentalmente.

Usar recursos nativos do pnpm e dependências `workspace:`; não há justificativa atual para outro orquestrador de monorepo. Cada aplicação terá configuração, build e variáveis próprios. `shared` não pode importar React, Next.js, Fastify, Drizzle, banco, segredos ou módulos internos das aplicações.

O Next.js apresenta páginas e estados de interface, comunica-se por HTTP/Socket.IO e pode consultar a API durante SSR. O Fastify valida, autoriza, executa serviços e persiste. HTTP e Socket.IO chamam os mesmos serviços; não duplicar regras nos handlers. O frontend não importa serviços internos da API, nem mesmo em Server Components.

O tipo atual `Game` contém `deck` e `seed`: não deve ser exportado para `shared`. Reaproveitar motores e testes dentro do módulo de jogo da API, substituindo a aleatoriedade de produção por CSPRNG e mantendo uma fonte determinística injetável para testes. Expor apenas cartas/ações visíveis e o estado público necessário à apresentação. Não criar um pacote de motor compartilhado apenas por antecipação.

## APIs HTTP e Socket.IO

Endpoints de domínio ficam no Fastify sob `/api/v1`. Usar schemas Zod tanto na borda HTTP quanto nos eventos, projeções explícitas de saída, erros estruturados e paginação. O validador padrão do Fastify é JSON Schema: a integração com Zod deve ser explícita, não somente uma anotação TypeScript.

| HTTP | Operação |
| --- | --- |
| `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/csrf` | Cadastro, sessão e proteção das mutações. Recuperação depende da decisão de produto. |
| `/me`, `/me/profile`, `/me/password`, `/me/avatar` | Identidade, configurações e avatar da conta autenticada. |
| `/me/wallet`, `/me/transactions`, `/me/predictions` | Saldo e históricos próprios, com totais e paginação. |
| `/rewards/daily/claim`, `/coupons/redeem` | Concessões transacionais e idempotentes. |
| `/games`, `/pages/:slug`, `/rankings`, `/markets` | Consultas públicas com dados permitidos para visitantes. |
| `/markets/:id/predictions` | Registro de palpite e débito numa transação. |
| `/matches`, `/matches/:id/join`, `/matches/:id/start`, `/matches/:id/leave` | Ciclo de vida persistido, entrada, início e abandono explícito. |
| `/matches/:id` | Snapshot autorizado para carregamento inicial e recuperação. |
| `/admin/*` | Usuários, ajustes, catálogo, páginas, cupons e ciclo de vida de mercados. |

Métodos HTTP devem refletir cada ação: GET para consultas; POST para comandos; PATCH/DELETE somente quando permitidos pelo domínio. Separar editar, encerrar, apurar e pagar um mercado. Não disponibilizar uma gravação genérica de saldo ou de todo o estado de uma partida. Alterações administrativas carregam versão esperada quando sujeitas a edição concorrente.

| Evento Socket.IO proposto | Finalidade |
| --- | --- |
| Cliente → `match:subscribe` | Assinar atualizações após verificar sessão e participação; não cria vaga nem cobra entrada. |
| Cliente → `match:command` | Enviar decisão humana com `commandId`, `matchId`, `expectedVersion` e ação validada. |
| Cliente → `match:sync` | Solicitar eventos posteriores à versão aplicada ou snapshot atual. |
| Cliente → `match:unsubscribe` | Encerrar assinatura; não abandonar a partida. |
| Servidor → `match:updated` | Envelope versionado com eventos ordenados e estado público pertinente. |
| Servidor → `match:presence` | Presença transitória; não altera resultado ou saldo. |
| Servidor → `session:revoked` | Avisar revogação e desconectar a sessão afetada. |

Criação e ingresso via HTTP emitem atualizações do lobby pelo Socket.IO. Room de transporte não é a entidade de domínio. Código da sala e `socket.id` não autorizam jogadas; identidade vem da sessão e vínculo persistido com a vaga. Manter a URL atual `/jogos/flip7?partida=CODIGO`, passando a resolver um código do servidor.

### Comandos, concorrência e recuperação

1. Validar payload, sessão vigente, status da conta e participação. Decisões pendentes podem pertencer a alguém diferente do turno comum; validar o controlador efetivo.
2. Abrir transação e bloquear a partida. Consultar recibo do `commandId` antes de rejeitar uma versão antiga: um retry de comando aceito deve retornar o resultado original.
3. Conferir versão, prazo pelo relógio do servidor e ação legal. Reutilização do ID com conteúdo diferente é conflito. Bloquear contas econômicas em ordem consistente quando necessário.
4. Executar a transição e salvar snapshot privado, versão, comando, eventos públicos e próxima automação. Quando há efeito financeiro imediato, registrar lançamentos na mesma transação.
5. Confirmar no PostgreSQL antes do ack e do broadcast. Não manter transação aberta enquanto aguarda rede ou animação.

Socket.IO mantém ordenação, mas sua entrega padrão é “no máximo uma vez”. A aplicação não pode presumir entrega garantida nem execução única do efeito por receber um evento. Persistir recibos e eventos; repetir com o mesmo `commandId` após ack incerto. Se a aba recarregar, consultar estado/recibo antes de reenviar uma decisão incerta com um novo ID.

Eventos de partida persistidos terão controle de despacho. O executor da API retoma eventos confirmados ainda não despachados se houver queda entre commit e broadcast. Emitir antes de marcar o despacho admite duplicatas, que o cliente descarta pela versão. Despacho não significa confirmação de recebimento de cada navegador; replay/snapshot continua necessário.

Na reconexão, autenticar novamente, reautorizar assinaturas e informar a última versão aplicada. Retornar eventos faltantes disponíveis ou snapshot consistente. Durante a assinatura inicial, armazenar eventos recebidos até concluir o snapshot e aplicar somente versões posteriores; lacunas provocam sincronização. A recuperação automática do Socket.IO não é a garantia de durabilidade: inicialmente pode ficar desativada para usar um único protocolo de recuperação pelo banco. Se habilitada depois, não pular middlewares e revalidar permissões.

O cliente mantém estado confirmado separado da fila visual GSAP. Compras, trocas, estouros e resultados são apresentados em ordem, sem o término de uma animação autorizar o próximo turno. Ao receber snapshot após desconexão prolongada, não é obrigatório reproduzir todas as animações históricas. Comandos de bot, compras obrigatórias e avanço de rodada são internos; o cliente não pode acionar livremente `step` ou `next`.

## Autenticação e segurança por topologia

O Fastify cria contas com username normalizado único, nome público separado e hash Argon2id. Não há e-mail obrigatório nem endereço fictício para satisfazer uma biblioteca. Usar biblioteca mantida para Argon2id e APIs criptográficas padrão para tokens, sem implementar algoritmos próprios. Papel inicial `user`; promoção inicial a `admin` por procedimento controlado, sem credenciais padrão em seeds.

Tokens de sessão aleatórios ficam somente em cookie HttpOnly; o banco guarda hash, usuário, expiração absoluta/inatividade e revogação. Logout revoga no banco; troca/recuperação de senha revoga outras sessões; suspensão bloqueia operações. Duração e renovação precisam ser definidas. As conexões Socket.IO também expiram e são desconectadas ao revogar a sessão. Handshake autenticado não substitui validação de sessão/permissão em comandos posteriores e em assinaturas privadas. Hooks HTTP do Fastify não protegem automaticamente os eventos Socket.IO.

Recomendação inicial: mesma origem pública, com proxy HTTPS direcionando `/api/v1` e `/socket.io` ao Fastify e páginas ao Next.js. Cookie de produção host-only, prefixo `__Host-`, `Secure`, `HttpOnly`, `Path=/` e `SameSite=Lax` explícito. O Next.js pode encaminhar somente o cookie necessário ao endereço interno confiável da API em consultas SSR; autenticação continua na API. Login/logout e renovação do cookie passam pelo navegador até o Fastify. Um fetch durante SSR não retransmite automaticamente `Set-Cookie` ao navegador.

| Topologia | Requisitos |
| --- | --- |
| Mesma origem pública recomendada | Evita CORS entre aplicações, mesmo implantadas em máquinas diferentes atrás do proxy. CSRF e autorização continuam obrigatórios. |
| Desenvolvimento em portas diferentes de `localhost` | CORS com origem e porta exatas e credenciais; cookie de desenvolvimento sem `Secure`/prefixo `__Host-`. Portas não isolam cookies. |
| Subdomínios separados | Origens distintas exigem CORS explícito e credenciais. Cookie host-only da API não chega ao SSR do frontend; manter o proxy de mesma origem é preferível a ampliar `Domain`. |
| Domínios de sites diferentes | `SameSite=None; Secure` pode ser necessário, mas bloqueios de cookies de terceiros permanecem. Não adotar como topologia inicial. |

Mutações HTTP, inclusive autenticação, precisam de política CSRF: origem permitida e token adequado ao contexto/sessão, não somente `SameSite`. No Socket.IO, validar origem também no handshake/upgrade com `allowRequest` e validar token CSRF de conexão; CORS sozinho não restringe WebSocket. O token CSRF pode ser acessível ao cliente; o token de sessão não.

Aplicar limites por conta/IP a login, cadastro e recuperação, além de limites de conexões, comandos e tamanho de payload. Na instância única, limites de tráfego podem começar em memória; contadores de tentativas sensíveis que devam sobreviver a reinícios ficam no PostgreSQL. Unicidade de resgates e idempotência nunca dependem de rate limiting. Configurar confiança somente no proxy conhecido, impedir spoofing de IP e excluir senhas, tokens e estado privado dos logs.

Inicialmente, `user` e `admin` bastam; “Moderador” nos fixtures não confirma um terceiro papel. Cada serviço autoriza sujeito, ação e recurso, incluindo administração via HTTP e Socket.IO. O Next.js pode controlar renderização consultando `/me`, mas não concede acesso. Manter 404 para administração não autorizada e respostas de sessão apropriadas nos endpoints pessoais.

Recuperação sem e-mail é questão de produto: recomendação de código de recuperação aleatório mostrado uma vez, hash no banco, consumo único, rotação e limites de tentativas; alternativa de não oferecer recuperação automática, documentando perda de acesso sem credencial. Atendimento manual só com comprovação previamente definida, nunca por conhecer username ou saldo. Não presumir um fluxo de e-mail ou perguntas de segurança.

## Banco, Croins e regras preservadas

O modelo anterior continua adequado; mudar a aplicação proprietária do banco não exige redesenhar os domínios. As tabelas serão introduzidas por etapa, não todas no bootstrap.

| Domínio | Modelo proposto e garantias |
| --- | --- |
| Contas | `users`, `sessions`; `recovery_codes` se aprovado o fluxo. Username normalizado único, IDs internos estáveis e sessões por usuário. |
| Croins | `wallet_accounts`, `wallet_operations`, `wallet_entries`. Conta por usuário, contas internas de emissão/casa/potes, chave de idempotência e lançamentos imutáveis. |
| Recompensas | `daily_claims` único por usuário/dia; `coupons` e `coupon_redemptions` único por usuário/cupom. |
| Jogos | `games`, `matches`, `match_players`, `match_actions`, `match_events`. Vaga única por posição, usuário autenticado por participação online, versão de regras e snapshot privado. |
| Apostas | `markets`, `market_options`, `predictions`, `market_settlements`, `settlement_items`. FKs, opções estáveis, apuração única e recibos de pagamentos. |
| Conteúdo e auditoria | `pages`, `audit_logs`; metadados de avatar conforme necessário. Documento JSON com tags permitidas, autoria e versões. |
| Gamificação | `achievements`, `user_achievements`, `user_daily_activity`. Concessões únicas e dias de atividade registrados pelo servidor. Rankings começam como consultas sobre resultados reais. |

Acrescentar à partida versão monotônica, prazo do turno, `next_action_at` e motivo da próxima automação. Expandir `match_actions` com autor, `commandId`, hash do conteúdo e resultado aceito; criar eventos públicos com unicidade por partida/versão e estado de despacho. Separar esses contratos do snapshot privado. Na liquidação, distinguir “apurada aguardando autorização” de “pagamento solicitado e pendente”.

Croins são inteiros. Usar `BIGINT` no PostgreSQL e `BigInt` nos cálculos proporcionais, com limites definidos e serialização consistente. Para preservar controles numéricos atuais, restringir valores públicos à faixa inteira segura do JavaScript; não converter silenciosamente inteiros maiores. Datas são instantes UTC; dias de bônus/presença usam `America/Sao_Paulo`.

Cada operação registra origem, autor, motivo, referência e chave de idempotência vinculada ao conteúdo e ao escopo do usuário/comando. Transferências somam zero entre contas; emissão explícita usa conta técnica própria. Contas de usuários e potes não podem ficar negativas; a conta técnica de emissão tem tratamento separado. A transação deve garantir lançamentos, saldo materializado e vínculo de domínio juntos, com validação da soma e restrição diferida apropriada no banco. Correções econômicas criam lançamentos compensatórios; não alteram lançamentos anteriores.

No palpite, bloquear mercado e contas, revalidar prazo após o bloqueio e registrar débito, pote e palpite atomicamente. Apuração fixa participantes e plano imutável; manter rateio proporcional sem taxa, acerto exato para números, devolução sem vencedores e sobras determinísticas. Resultado de evento é informado por administrador autorizado e auditado, não comprovado automaticamente pelo servidor. Não permitir editar pergunta, critérios e opções após entrada de participantes. Pagamentos repetidos não duplicam crédito; cancelamento só termina após devoluções. Começar com liquidação inteira transacional; lotes somente se o volume justificar.

Partidas com Croins exigem financiamento antes do início e prêmio ligado ao resultado persistido do motor. O pote atual contra bots usa entradas simuladas: recomendação pendente de produto é a casa financiar as vagas dos bots e receber seus prêmios de volta. Não criar Croins implicitamente ao multiplicar entrada por lugares. A política de financiamento deve ser aprovada antes de habilitar essa modalidade.

Cupons preservam a configuração visual atual: código definido pelo administrador, valor por resgate, limite global opcional, início/término opcionais, pausa e um uso por usuário. Datas ausentes viram `NULL`; o fuso de entrada administrativa precisa ser explícito, sem interpretar silenciosamente horários locais dos mocks. Guardar o valor efetivamente concedido em cada resgate; alterações posteriores não reescrevem histórico. Checagem de limite, unicidade, resgate e crédito ficam na mesma transação.

Avatar é validado e reprocessado pela API, com limites de arquivo e dimensões; salvar chave de objeto/metadados, não data URL no perfil. Credenciais S3 ficam na API. Documento de página é validado no servidor e renderizado sem HTML arbitrário. IDs de usuário e relações não dependem de nomes públicos editáveis.

## Tarefas persistentes sem serviços adicionais

O mesmo processo Fastify executará um loop interno, iniciado após conexão com o banco e encerrado com a aplicação. O PostgreSQL guarda o trabalho pendente: prazo, próxima ação e versão da partida; pedido de pagamento autorizado; eventos ainda não despachados. Não é necessário um worker separado ou uma fila externa inicialmente.

O loop busca lotes pequenos vencidos, bloqueia linhas (`FOR UPDATE`, podendo usar `SKIP LOCKED` para concorrência entre executores) e confere novamente versão/condições na transação. Cada automação usa identidade determinística para não executar duas vezes. Ao reiniciar, reler o banco e retomar pendências. Timers em memória só acordam o executor; não são a agenda durável. A política de tolerância após indisponibilidade não deve punir automaticamente jogadores por uma queda do servidor.

Retomar apenas pagamentos já solicitados/autorizados; não pagar automaticamente mercados somente apurados. Falha entre lançamento e confirmação é resolvida por atomicidade e recibo, não por crédito manual presumido. O encerramento normal deve parar novas conexões, drenar operações e fechar Socket.IO/pool; a recuperação também precisa funcionar em queda abrupta.

Uma instância usa o adapter em memória do Socket.IO para presença e roteamento. PostgreSQL preserva partidas, não conexões. Se houver necessidade medida de múltiplas instâncias, avaliar adapter de broadcast e afinidade de conexões quando houver long-polling; locks, versões e idempotência já deverão funcionar entre processos. Não pressupor que subir duas instâncias resolve distribuição de rooms.

## Dados descartáveis, schema e produção

A Croebet não tem dados reais de produção a migrar. Usuários, saldos, partidas, apostas, cupons, históricos, IDs e formatos do protótipo podem ser descartados. Não criar importadores de localStorage, dual-write, adaptadores de versões antigas, conciliação de saldos fictícios ou rotinas de preservação de fixtures. Caches de interface são dispensáveis. Não há obrigação de manter um modo demo paralelo ao backend para proteger esses dados.

**Migrations de schema** versionam tabelas, colunas, índices, constraints e demais estruturas; **migração de dados antigos** transfere/adapta informações históricas. Precisamos da primeira para reproduzir o banco, não da segunda para transportar o protótipo. Durante desenvolvimento descartável, recriar o banco e consolidar migrations ainda não publicadas é aceitável se a equipe partir da mesma base e a criação limpa continuar reproduzível. Não reescrever migrations já aplicadas em produção.

Seeds devem ser reproduzíveis, com chaves estáveis e execução idempotente para configurações, catálogo e referências necessárias. Não sobrescrever conteúdo administrativo em produção ao repetir seed. Não criar usuários fictícios, partidas ou extratos no seed normal; cenários de testes pertencem às fixtures isoladas dos testes. Criar primeiro administrador por procedimento explícito, sem senha fixa em código.

Não herdar `1067` de saldo inicial nem `67` de bônus do protótipo. `CROEBET.md` ainda não fixa esses valores: tratá-los como pendência de produto. Cadastro com concessão e bônus só serão habilitados após configuração aprovada; a configuração deve ser explícita, sem fallback silencioso aos mocks. A concessão inicial ocorre numa transação com a criação da conta/carteira.

| Prática | Desenvolvimento/teste descartável | Produção e dados reais |
| --- | --- | --- |
| Reset/recriação | Permitido no banco explicitamente identificado para esse ambiente. | Proibido nos comandos de desenvolvimento e nas rotinas normais de implantação. |
| Evolução do schema | Pode recriar tabelas/base; validar criação limpa. | Migrations revisadas e não destrutivas; preservar dados e compatibilidade do deploy. |
| Dados | Sem importação dos mocks; fixtures isoladas podem ser recriadas. | Preservar usuários, livros, partidas e auditoria; definir retenção explicitamente. |
| Credenciais | Bancos e usuários próprios para desenvolvimento/teste. | Credenciais separadas, acesso mínimo e segredos fora do repositório. |
| Backup | Dados descartáveis não exigem rotina para preservar os mocks. | Backup e restauração testada obrigatórios antes de receber usuários reais. |
| Segurança de domínio | Atomicidade, autorização, validação e idempotência são exigidas desde o começo. | Mesmas garantias, com operação monitorada. |

O futuro comando de reset deve negar por padrão: exigir ambiente development/test, destino de banco explicitamente permitido e confirmação do nome/destino; rejeitar produção mesmo com flag de força. Não confiar somente em `NODE_ENV`, nome parcial ou host localhost, que pode ser túnel para outro ambiente. Combinar identificação de ambiente do banco, allowlist do destino e credenciais segregadas. Não distribuir credenciais de produção ao fluxo de reset/testes; a conta de runtime não deve possuir permissões de DROP/DDL. Testar que configuração ausente, ambígua ou de produção é recusada antes de qualquer operação destrutiva. Não executar reset nesta etapa documental.

O marco de produção é a primeira abertura para usuários reais, mesmo em beta: antes dele, implantar restrições de reset, backups com restauração e migrations não destrutivas. Recriar banco de desenvolvimento continua permitido depois desse marco, desde que isolado e sem dados reais.

## Integração do frontend e descarte dos mocks

Substituir fontes de dados por domínio, preservando apresentação e navegação. O provider de sessão obtém identidade/permissões da API; comandos de carteira, bônus e palpites deixam de gravar localStorage. Manter interfaces de hooks quando coerentes, adaptando ações síncronas a promessas e distinguindo carregamento, erro e sessão expirada. Falha da API não concede saldo inicial, restaura carteira demo ou confirma sucesso localmente.

O `SiteConfigProvider` pode manter uma fachada de leitura para evitar reescrever componentes, mas consultas públicas e administrativas terão respostas distintas. Separar `save` genérico em operações por entidade, com versão esperada e sem enviar toda a configuração obsoleta. Substituir `useDemoCoupons` por consultas/comandos reais, mantendo cards, editor interno e histórico. Sessão não precisa carregar todo o extrato ou palpites; totais devem vir do servidor ao paginar.

O Flip 7 troca a função que hoje executa `transition` e grava snapshots por envio de comandos e aplicação de eventos confirmados. Remover agendamentos de regras no navegador; manter os timers exclusivamente visuais. Reaproveitar regras e testes no módulo da API sem importar snapshots antigos. Caso o modo de pessoas no mesmo dispositivo permaneça, definir controle de vagas convidadas como modalidade livre, sem converter nomes digitados em contas autenticadas.

Tema, visibilidade de painéis e preferências de configuração podem continuar locais. Não é necessário converter seus formatos antigos: valores inválidos podem voltar ao padrão. Remover helpers de migração, limpeza de palpites antigos e fixtures conforme cada domínio deixar de usá-los. Nunca misturar carteira persistente com partidas/apostas locais que controlem Croins; enquanto uma integração não estiver pronta, sua operação econômica permanece indisponível na versão funcional.

## Infraestrutura mínima

Desenvolvimento: Next.js e Fastify como processos Node no host, PostgreSQL em Docker Compose, e bucket S3 exclusivo quando avatares forem integrados. Testes de banco usam destino separado. Docker foi aprovado inicialmente somente para o banco; não adicionar containers das aplicações, emulador S3 ou processo de worker. Um adaptador de arquivos local pode servir apenas ao desenvolvimento de avatar se necessário, sem virar a persistência de produção.

Produção inicial recomendada: um servidor com Next.js e uma instância Fastify em processos separados, supervisionados pelo sistema, com PostgreSQL em container ou serviço gerenciado conforme a implantação definida; bucket S3 para avatares. Proxy reverso termina HTTPS e encaminha páginas ao Next.js e `/api/v1` e `/socket.io` ao Fastify, suportando upgrade WebSocket e timeouts compatíveis com heartbeat. Banco não exposto à internet. Backups ficam fora desse servidor e a restauração é validada antes do lançamento. PostgreSQL gerenciado é alternativa caso a redução de manutenção justifique o custo; provedor e dimensionamento permanecem abertos.

O Next.js não precisa reiniciar para publicar a API, nem a API para publicar o frontend. Cada build inclui a versão dos contratos que utiliza. Antes de mover qualquer processo para outra máquina, preservar a mesma origem pública pelo proxy e manter APIs/eventos compatíveis com clientes já abertos. Alterações de schema são executadas uma vez por implantação, com credenciais de migration separadas. Redis e workers externos só serão reavaliados diante de necessidade concreta de escala, isolamento ou carga.

## Roadmap incremental

As etapas 1–3 tiveram implementação autorizada e iniciada; validar os bloqueios de ambiente antes de considerá-las concluídas. As demais continuam planejadas. Cada entrega funcional inclui seus testes; o objetivo é integrar código/interface, nunca migrar dados mockados.

| Etapa | Entrega | Dependências | Critério de conclusão |
| --- | --- | --- | --- |
| 1 | Reorganização mecânica do monorepo pnpm | Aprovação para implementar | Frontend em `apps/web`, aliases/assets/rotas preservados, configurações isoladas e verificações existentes aprovadas. Sem redesign. |
| 2 | Fastify, shared, PostgreSQL e Drizzle | 1 | API inicia isolada; migrations constroem base vazia; Zod valida contratos; resets recusam produção/ambiguidade; seeds somente de referência. |
| 3 | Cadastro, sessões e permissões | 2; decisão de username/sessões | Senha verificada, unicidade concorrente, cookie/CSRF/CORS e revogação testados. Recuperação só se houver política aprovada. |
| 4 | Livro de Croins e concessão inicial | 3; valores aprovados | Cadastro/carteira/concessão atômicos; concorrência não permite gasto excessivo; retry não duplica lançamento. |
| 5 | Perfil, avatar e usuários administrativos | 3–4 | Dados reais substituem fixtures; suspensão revoga acesso; ajustes têm motivo e auditoria; arquivos validados na API. |
| 6 | Bônus diário | 4; recompensa aprovada | Uma concessão por usuário/dia de São Paulo, inclusive sob concorrência e retry. |
| 7 | Cupons e resgates | 4–5 | Editor existente integrado; datas/limites/pausa/uso único/crédito validados juntos; histórico exibe valor concedido. |
| 8 | Catálogo e páginas | 2–3 | Publicação compartilhada, rascunhos privados e pausa conferida pelo servidor. Seeds de referência reproduzíveis. |
| 9 | Mercados e registro de palpites | 4 e 8 | Seleção, prazo, débito, pote e palpite atômicos; fechamento concorrente não aceita entrada indevida. |
| 10 | Apuração, pagamento e devolução | 9 | Plano imutável conserva o pote; autor auditado; repetição/rollback não duplicam créditos. |
| 11 | Motor Flip 7 no servidor | 2–3 e 8 | Regras atuais reaproveitadas, RNG seguro em produção e determinístico em testes; snapshot privado persistido sem vazamento nos DTOs. |
| 12 | Salas e comandos multiplayer Socket.IO | 11 | Duas contas reais entram e jogam com autorização, versões, acks e IDs de comandos; lobby sincronizado. Sem polling da aplicação como transporte principal. |
| 13 | Reconexão, bots e timeouts recuperáveis | 12; políticas de tempo/abandono | Queda/reinício entre commit e envio recupera estado; replay não repete ações; automações retomam do banco sem aba aberta. |
| 14 | Croins em partidas | 4 e 13; financiamento/abandono aprovados | Entradas financiadas antes de iniciar; conclusão e prêmio consistentes; empate e retries não duplicam pagamento. |
| 15 | Rankings, conquistas e visão geral | Fontes reais de 6, 9–10 e 13–14 | Métricas conferem com operações/resultados; bônus, ajustes e devoluções não são ganhos/perdas de jogo. Critérios aprovados. |
| 16 | Preparação e abertura para produção | Recorte funcional escolhido | E2E, testes de reinício/concorrência/rollback, isolamento de resets, deploy independente e restauração de backup aprovados antes dos primeiros dados reais. |

Etapas independentes podem ser reordenadas quando seus pré-requisitos estiverem prontos. Não é obrigatório completar todos os recursos para um lançamento parcial, mas nenhum fluxo econômico pode ficar parcialmente autoritativo. Primeiro recorte recomendado: etapas 1–4. Segurança, limites de produção e backups não podem ser adiados para depois da abertura de um beta real.

Não existem etapas de importação de usuários, conciliação de saldos fictícios, conversão de snapshots ou compatibilidade com dados locais. Testar migrations desde banco vazio é validação de estrutura, não migração do protótipo.

## Validação e decisões ainda abertas

Manter Node test runner e Playwright existentes, sem trocar ferramentas sem necessidade. Reaproveitar testes das regras e substituir testes exclusivos de persistência antiga por integração com PostgreSQL real. Testar comandos duplicados, versões obsoletas, turno/alvos indevidos, duas abas, contas suspensas, cookies/origens, resgates concorrentes, saldo insuficiente, rollback e queda antes/depois do commit. Clientes Socket.IO reais de teste exercitam conexão, autorização e replay; testes HTTP podem usar a injeção do Fastify. Verificar que DTOs, bundles e logs não expõem senhas, tokens, baralho ou estado aleatório.

Após mudanças de implementação, executar lint, typecheck, testes e build por aplicação e as suítes agregadas da raiz; em mudanças interativas, E2E com web + API e banco de teste. Mudança somente documental exige conferir links, consistência e diff, sem alegar execução de testes funcionais inexistente.

Pendências de produto: saldo inicial e bônus; política de username/senha e duração das sessões; recuperação sem e-mail; financiamento dos bots; acesso às salas e eventual espectador; controle do modo no mesmo dispositivo; início/entrada/saída do lobby; tolerância a desconexão, timeouts e abandono; tratamento de indisponibilidade; métricas/períodos dos rankings e concessão de conquistas. A consulta atual ao `CROEBET.md` não autoriza inventar valores finais de economia.

Pendências operacionais: domínio/provedor, dimensionamento e frequência/retenção de backups. Recomendações deste documento não tornam essas escolhas automaticamente aprovadas. Registrar aqui as decisões quando forem fechadas.

## Referências técnicas verificadas

- [pnpm workspaces](https://pnpm.io/workspaces).
- [Fastify: servidor e trustProxy](https://fastify.dev/docs/latest/Reference/Server/) e [validação/TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/).
- [Socket.IO: garantias de entrega](https://socket.io/docs/v4/delivery-guarantees/), [recuperação](https://socket.io/docs/v4/connection-state-recovery/), [CORS](https://socket.io/docs/v4/handling-cors/) e [proxy reverso](https://socket.io/docs/v4/reverse-proxy/).
- [PostgreSQL: locks](https://www.postgresql.org/docs/current/explicit-locking.html) e [SELECT / SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html).
- [Drizzle: transações](https://orm.drizzle.team/docs/transactions).
- [OWASP: sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [hash de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Fundação iniciada — operação e validação

O frontend e seus testes foram movidos integralmente para `apps/web`, com `@/` preservado e raiz Turbopack no monorepo. `apps/api` contém Fastify com liveness em `GET /api/v1/health` e readiness em `GET /api/v1/health/ready`, configuração Zod, pool `pg`, conexão Drizzle, migration inicial e seed da identificação operacional do ambiente. Nenhum usuário, valor de economia ou endpoint de domínio foi introduzido. Socket.IO será conectado na etapa multiplayer, sem transporte de polling próprio.

Comandos na raiz:

| Comando | Uso |
| --- | --- |
| `pnpm install` | Instalar/resolver dependências e atualizar o lockfile do workspace. Ainda pendente por indisponibilidade do registry. |
| `pnpm dev` | Iniciar web e API em paralelo; a API exige `.env` configurado. |
| `pnpm dev:web` / `pnpm dev:api` | Iniciar aplicações separadamente. |
| `pnpm build` | Compilar shared, API e frontend na ordem de dependências. |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Verificações agregadas; dependem da instalação completa. |
| `pnpm test:e2e` | Playwright do frontend existente. |
| `pnpm test:integration` | Integração da API com `TEST_DATABASE_URL` de banco isolado, migrado e identificado como test. |
| `pnpm db:migrate` / `pnpm db:seed` | Aplicar estrutura e inserir identificação de ambiente. |
| `pnpm db:generate` | Gerar próximas migrations a partir do schema Drizzle. |
| `pnpm db:reset` | Recriar exclusivamente o destino development/test autorizado, aplicando migration e seed. |

Preparação: copiar `apps/api/.env.example` para `apps/api/.env` e ajustar o banco de desenvolvimento; a configuração demo do frontend está em `apps/web/.env.example` e usa `.env.local` nessa aplicação. `APP_ENV` e `DATABASE_URL` são obrigatórios na API. Não são criados banco ou usuários PostgreSQL automaticamente. Criar o banco isolado, executar migrate e seed antes de esperar readiness positiva. Liveness independe do banco; readiness retorna 503 se conexão, schema ou identificação não estiverem prontos.

Reset exige `APP_ENV=development` ou `test`, `NODE_ENV` diferente de production, identificação compatível já persistida, URL exata em `DB_RESET_ALLOWED_URL` e nome real do banco em `DB_RESET_CONFIRM`. Banco sem identificação não pode ser resetado; criar/migrar e semear explicitamente primeiro. Essas variáveis ficam ausentes por padrão. Não há flag force. Em produção, migrations exigem `DATABASE_MIGRATION_URL` separada; usuário runtime deve ser provisionado sem privilégios DDL. Nunca preencher allowlist de reset com destino de produção.

Validações observadas: 118 testes existentes do frontend aprovados; lint de todo o workspace aprovado; typecheck e build de produção do frontend aprovados com Node 22.22.0; contrato público Zod compilado/testado e guarda de reset testada. O registry npm falhou com `ENOTFOUND`, sem cache de Fastify/Drizzle/pg: instalação, resolução final do lockfile, build/typecheck completo e testes HTTP/Drizzle da API permanecem pendentes. A migration inicial e seu snapshot precisam ser conferidos com Drizzle Kit instalado. O PostgreSQL local instalado não inicia por ausência de `libicui18n.74.dylib`, impedindo validar migrations e rollback reais; nenhum banco existente foi alterado. Playwright foi tentado, mas o ambiente recusou `127.0.0.1:3100` com EPERM. Não considerar as etapas 1 e 2 totalmente validadas enquanto essas pendências não forem resolvidas.

## Cadastro e sessões — implementação iniciada

Acrescentados `users`, `sessions` e `auth_rate_limits`, migration `0001_auth`, schemas Zod e endpoints de cadastro, login, logout, CSRF, identidade e edição do nome público. Hash Argon2id com 19 MiB, duas iterações e paralelismo 1; sessão de 32 bytes aleatórios, armazenada como SHA-256. Contas nascem com papel user; nenhum nome ou variável pública concede admin. Logout exclui a sessão, expiração/suspensão invalida `/me`. Criação da conta e sessão é transacional, sem conceder Croins.

Padrões iniciais de implementação, revisáveis antes da publicação: username normalizado para minúsculas, 3–24 caracteres ASCII (letras/números/ponto/sublinhado); senha de 15–128 caracteres sem trim; sessão por até 30 dias, com inatividade de 7 dias. Recuperação sem e-mail e troca de senha permanecem fora desta rodada: não há fluxo de recuperação fictício. Valores econômicos continuam em aberto.

O frontend usa o contexto existente como fachada para `/api/v1/me` e os formulários enviam username/senha à API. Não lê sessão, senha, carteira ou permissões do localStorage. Login indisponível não gera identidade local. Nome público agora é salvo por PATCH; avatar/S3 permanece para etapa própria. Croins, bônus e palpites estão indisponíveis; o valor zero na interface é placeholder de carteira ainda não integrada, não regra de saldo inicial. Testes E2E antigos que presumem login demo precisarão de fixtures de contas reais ao integrar suas respectivas features.

Configuração adicional obrigatória na API: gerar `CSRF_SECRET` aleatório com pelo menos 32 caracteres e definir `WEB_ORIGIN` como origem exata, sem barra final. Em desenvolvimento acessar o navegador por `http://localhost:3000`, ou ajustar WEB_ORIGIN. Next encaminha `/api/v1/*` para `API_INTERNAL_URL` (padrão `http://127.0.0.1:3001`); é proxy de transporte, sem lógica de negócio ou banco no Next. Mesma origem pública evita CORS entre aplicações. O proxy definitivo de produção continua pendente e deve suportar Socket.IO quando integrado.

Cookies HttpOnly, host-only, SameSite=Lax; em produção Secure e prefixo __Host-. Toda mutação exige Origin exata e HMAC CSRF vinculado ao nonce HttpOnly e à sessão atual; inclui proteção pré-login. Contadores persistentes limitam cadastro por IP e login por IP/username, com mensagens genéricas para credenciais. Ainda é necessário configurar confiança no proxy conhecido antes de publicar para não agrupar clientes sob o IP do proxy; não habilitar confiança irrestrita. As respostas de auth usam no-store e projeção pública sem hashes/tokens.

Instalar dependências com `pnpm install` (inclui @fastify/cookie e argon2, com build autorizado especificamente no workspace), configurar o banco/segredo e aplicar `pnpm db:migrate` e `pnpm db:seed` antes de usar contas reais. O lockfile completo e a comparação dos snapshots/migrations pelo Drizzle Kit continuam pendentes da instalação. Não há API real funcionando neste ambiente enquanto o registry e PostgreSQL permanecerem indisponíveis. Testes HTTP/PostgreSQL de cadastro, duplicidade, senha incorreta, CSRF, suspensão e logout estão escritos em `apps/api/tests/integration/auth.test.mjs`, sem declarar execução aprovada.

Validação desta rodada: lint do workspace e typecheck do frontend aprovados; build de produção do frontend aprovado com Node 22.22.0; 118 testes unitários existentes e quatro testes de contratos/CSRF/reset aprovados. Typecheck/build/testes agregados da API continuam bloqueados por dependências ausentes; integração não executou por falta de pg/Fastify/Argon2. Playwright voltou a falhar antes de iniciar o navegador com EPERM na porta 3100. Esses resultados não comprovam autenticação real funcionando com banco.

Atualização após instalação pelo usuário: Fastify, pg, Drizzle, cookie e Argon2 estão disponíveis; o carregamento nativo do Argon2 foi confirmado. Shared, API e frontend passaram em TypeScript; os seis testes unitários HTTP/contratos/segurança passaram e Drizzle Kit check aprovou os metadados. O `.env` local da API foi preparado com segredo aleatório, usando provisoriamente o destino de desenvolvimento do exemplo. Ainda falta confirmar/provisionar PostgreSQL e ajustar a conexão antes de aplicar migrations; não houve validação de cadastro/login com banco. O runtime Docker não pôde ser inspecionado pelo assistente por permissão no socket. A versão pnpm 12.21.0 escolhida pelo usuário não foi alterada; o Corepack deste executor tentou acessar um cache fora da área permitida, portanto os testes foram executados pelos binários locais instalados.

## PostgreSQL em Docker — ambiente local

Decisão aprovada: Docker somente para o banco inicialmente. `compose.yaml` na raiz define PostgreSQL 18, volume nomeado em `/var/lib/postgresql` (caminho da imagem oficial 18+), healthcheck `pg_isready`, restart unless-stopped e porta 5432 vinculada exclusivamente a `127.0.0.1`. Next.js e Fastify continuam no host. Não há Dockerfiles de aplicações nem nova fila/worker. Esta configuração é de desenvolvimento e não é um manifesto de produção.

Pré-requisito: Docker Desktop instalado e iniciado no Mac. Docker e Compose já foram encontrados neste computador. O assistente não consegue operar o engine pelo socket nesta sessão; isso não comprova que o Docker Desktop esteja parado. Não alterar permissões do socket para contornar essa restrição.

A raiz tem `.env.example` para POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD e POSTGRES_PORT; `.env` local recebe senha aleatória. A conexão correspondente fica em `apps/api/.env`, com segredo CSRF separado. Os arquivos de segredos são ignorados pelo Git e não devem ser enviados em mensagens. Em novas instalações, copiar o exemplo da raiz para `.env`, definir senha local e montar a mesma DATABASE_URL na API. Credenciais deste container destinam-se ao desenvolvimento, não aos papéis de runtime/migration de produção.

Na raiz do projeto, com Docker Desktop aberto:

```sh
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Depois, acessar `http://localhost:3000`; WEB_ORIGIN da API usa essa origem. `pnpm db:up` equivale ao primeiro comando. `pnpm db:stop` para o banco sem remover o volume; `pnpm db:logs` acompanha os logs. `docker compose ps` mostra a saúde do serviço. O banco continua existindo após parar/recriar o container. POSTGRES_* inicializa apenas volume vazio: mudar a senha no `.env` não altera automaticamente a senha de um banco já inicializado. Mudanças de porta precisam ser refletidas em DATABASE_URL.

Não acrescentar remoção de volumes a scripts de reset; as proteções de ambiente/destino dos comandos de banco continuam válidas. Testes de integração ainda precisam de banco separado com marcador test, nunca do banco de desenvolvimento com usuários criados pelo navegador. S3 e Dockerização das aplicações ficam fora desta entrega.

Validação: `docker compose config --quiet` passou com interpolação das variáveis; arquivos de segredos permanecem ignorados. O container não foi iniciado nem migrations aplicadas nesta sessão, por falta de acesso ao socket do engine. Após iniciar pelo terminal do usuário, validar readiness e cadastro/login com banco antes de declarar autenticação funcional.

Referências: [imagem oficial PostgreSQL](https://hub.docker.com/_/postgres), [Docker Desktop para Mac](https://docs.docker.com/desktop/setup/install/mac-install/).
