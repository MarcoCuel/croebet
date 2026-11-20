# Flip 7

## Escopo

Jogo gratuito em `/jogos/flip7`, com lobbies públicos entre contas da Croebet. Quem cria escolhe modalidade e limite de 2 a 12 vagas; o host inicia com qualquer quantidade entre duas pessoas e esse limite. Cada pessoa ocupa uma vaga e controla somente suas decisões. Bots não são adicionados na criação: assumem vagas após abandono ou expulsão durante o jogo. Motor e partidas ficam na API/PostgreSQL; Croins permanecem bloqueados. Pontos não viram Croins nem atualizam rankings/conquistas.

A execução segue a [base compartilhada dos jogos](backend-architecture.md#base-compartilhada-dos-jogos), com regras específicas do Flip 7. Não há importação de snapshots locais. [Operação e contratos](backend-architecture.md#partidas-livres-integradas).

## Mapa do código

| Destino | Responsabilidade |
| --- | --- |
| `apps/api/src/modules/games/flip7/` | Motor puro, regras, bots, invariantes privadas e driver com RNG seguro |
| `apps/api/src/modules/matches/` | Executor compartilhado, transações, comandos idempotentes, eventos, HTTP e sincronização Socket.IO |
| `packages/shared/src/matches.ts` | Contratos públicos de criação, decisões, snapshots e frames; sem ordem do baralho/seed |
| `apps/web/features/games/flip7/` | Lobby, configuração, loaders HTTP, sincronização Socket.IO, projeções visuais, mesa, histórico e animações; sem execução de jogadas |

## Clássico

- Baralho de 94 cartas: um 0, N cópias de cada número N de 1 a 12, +2/+4/+6/+8/+10, ×2 e três de cada ação (Congelar, Compre 3 e Segunda chance).
- Comprar ou parar após obter número. Repetir número estoura e zera a rodada; Segunda chance descarta proteção e repetida, mantendo a primeira. Sete números distintos encerram a rodada com +15. ×2 dobra só a soma numérica, antes dos bônus.
- Congelar/Compre 3 escolhem participante ativo, inclusive quem comprou. Ações encontradas em Compre 3 aguardam a sequência; estouro cancela as ações dessa pessoa. Segunda chance extra fora da sequência pode ser doada a ativo sem proteção; dentro da sequência é descartada.
- Congelar/Compre 3 resolvidos permanecem na mão até a próxima rodada, sem pontuar. Todas as cartas são conservadas entre mãos/baralho/descarte/filas; só reembaralhar descartes quando faltar baralho.
- Ao fim da rodada em que alguém atinge 200, maior total vence; empates mantêm todos os líderes. Bots usam somente informações públicas, sem consultar ordem do baralho.

## Vingança e Brutal

- “A vingança nunca é plena” usa 108 cartas: 92 numéricas, seis modificadores e dez ações. Há números 1–13, Zero, 7 de merda e 13 da sorte (estes substituem uma cópia comum de 7/13); modificadores −2/−4/−6/−8/−10 e ÷2; duas de cada ação Só mais uma!, Compre 4, Roubar, Trocar e Descartar.
- Zero obriga comprar e zera a pontuação, exceto no Flip 7. 7 de merda descarta as outras cartas e efeitos já recebidos na sequência forçada. 13 da sorte permite segundo 13, ambos contando para o Flip 7.
- Pontuação: somar números, dividir por dois arredondando para baixo, subtrair modificadores e aplicar bônus. Vingança comum limita o resultado a zero. Brutal permite negativos e modificadores novos sobre base zero de quem estourou; cartas já estouradas continuam fora de jogo.
- Completar Flip 7 no Brutal pausa para escolher ganhar +15 ou tirar 15 de outro participante, inclusive estourado. Escolher o próprio participante aplica +15. Contabilizar rodada só após resolver essa escolha.
- Compre 4 adia ações/modificadores na ordem comprada. Estouro durante as compras cancela efeitos ainda presos à sequência; estouro em Só mais uma! posterior não cancela efeitos já liberados. Compra forçada interrompe no estouro/Flip 7. Pessoas que pararam continuam elegíveis aos efeitos sem voltar à atividade.
- Roubar/Descartar: quem comprou seleciona diretamente uma carta, sem escolher destinatário nem confirmar. Roubar usa outra mão; Descartar aceita própria mão ou outra não estourada.
- Trocar: quem comprou seleciona cartas de duas pessoas diferentes; prévia reversível com Confirmar/Cancelar. Só confirmar muda o motor/snapshot; troca pode estourar ambas as pessoas. Ações usadas são descartadas.

## Persistência e navegação

- Código de 12 caracteres em `?partida=CODIGO`. Lobbies e partidas em andamento são públicos, inclusive sem login. Qualquer visitante pode visualizar a mesa em tempo real como espectador, sem ocupar vaga nem controlar decisões. Listagem/retomada carregadas no servidor; indisponibilidade é distinta de ausência. Sem sessão, criar usa o login existente.
- Criar, entrar e sair do lobby atualiza a URL pela History API após a confirmação da API, preservando o painel montado e seus avatares. Fechar o convite também só atualiza a URL; iniciar ou continuar uma partida carrega a mesa pelo servidor.
- Uma conta pode entrar em vários lobbies abertos, mas só criar um lobby próprio enquanto continua como host dele. Entrar em outras salas não bloqueia a criação do próprio lobby. A interface permite voltar a qualquer lobby em que participa e retoma o próprio na entrada sem código. O primeiro início confirmado escolhe uma única partida ativa para cada participante e, na mesma transação, remove essas pessoas dos outros lobbies e libera seus convites/reservas. Se um host sair por essa escolha, a função passa ao participante mais antigo; salas sem participantes fecham. Repetições de comando são idempotentes e inícios simultâneos com a mesma pessoa não criam duas partidas. Enquanto controla uma vaga em jogo, a conta não cria nem entra em outros lobbies; concluir ou abandonar libera essa possibilidade.
- A preparação mantém um painel único: modo, Brutal e regras à esquerda; limite, participantes/vagas e ação principal à direita; lista de lobbies abaixo. Criar abre o lobby e troca a ação por Jogar para o host ou espera para os demais. Configuração continua visível e somente o host pode editar, com salvamento direto e sincronização Socket.IO; capacidade nunca fica abaixo da ocupação. Entrar/sair só é permitido antes do início; ao sair, o host passa para o participante mais antigo. Última saída fecha a sala. Seletores de modo e número de jogadores ficam ao lado dos rótulos, com largura ajustada ao conteúdo. Avatares circulares aparecem lado a lado, nomes abaixo; só a próxima vaga disponível mostra “+”. Ações Jogar/Cancelar ficam na mesma linha, sem resumo redundante da configuração ou texto de mínimo de jogadores. Cards de lobbies mostram o modo ao lado do nome da sala e Brutal em badge primário; participantes e vagas livres aparecem lado a lado, com “+” em cada vaga livre para entrar. O total de vagas disponíveis substitui o contador de ocupação. Cards das salas em que a conta já participa oferecem Ver lobby para alternar entre filas; Meu lobby retorna à criação própria, e Criar meu lobby permanece disponível quando a conta só entrou em salas de outras pessoas. Partidas iniciadas oferecem Visualizar ou Continuar partida para quem ainda controla uma vaga.
- O host pode buscar contas Online/Offline para convidar ou copiar o link da sala. Antes de existir sala, “+” cria o lobby com a configuração atual. Convites persistidos reservam vagas por até um dia e mostram o convidado com opacidade reduzida até entrar. Aparecem nas notificações e em alerta com Aceitar/Recusar; aceitar entra e abre a sala, recusar libera a reserva. Contas autenticadas que abrem o link entram automaticamente. O host pode remover reservas e só inicia com todos os convidados presentes na sala; vagas livres não precisam ser preenchidas. Online na busca indica presença renovada por página autenticada visível; após 75 segundos sem renovação, a conta aparece Offline. A página de jogos mantém presença em todos os lobbies em que a conta participa, mesmo ao visualizar outra sala, com leases Socket.IO de 30 segundos renovados a cada 15 segundos. Sair da página de jogos ou fechar a conexão remove esses leases; múltiplas abas contam até a última sair. Contas suspensas não aparecem na busca.
- O host pode expulsar outra pessoa no lobby ou durante o jogo, com confirmação. No lobby, isso remove a participação e libera a vaga; não é um banimento. Durante a partida, expulsão ou abandono transfere permanentemente o controle para um bot normal, conservando cartas, pontos e escolhas pendentes. Os demais continuam jogando; a conta que saiu não pode retomar o controle. Se o host abandona, a função passa à pessoa mais antiga ainda no controle de uma vaga. Sem humanos restantes, a partida gratuita é encerrada.
- Navegar, desconectar ou recarregar mantém a participação. Não há timeout ou substituição automática por ausência: a mesa aguarda indefinidamente, e o host pode expulsar manualmente. Jogar novamente volta à criação de lobby e mantém o resultado anterior.
- Estado e automações confirmam no banco antes da apresentação. Respostas incluem frames de ações já aplicadas para a fila visual. Reload usa o estado confirmado sem repetir compras nem importar animações antigas.
- Decisão humana usa ID de comando e versão esperada. Resposta incerta permite repetir o mesmo ID; atualizações remotas recuperam eventos ordenados ou snapshot. Não enviar `step`, `next`, seed, pontuação ou snapshot para autorizar jogadas.
- Preferências em `croebet:flip7:setup`: modalidade, Brutal e limite de lugares; sem nomes/tipos. Fallback: Clássico, dois lugares, sem Brutal. Não ler nem converter partidas do localStorage; não é necessário preencher todas as vagas para iniciar.

## Apresentação

- Baralho/status/ações no topo; mãos em linhas por participante, números e modificadores dimensionados pelo container. Histórico lateral em telas largas, abaixo no mobile, com controle para esconder. Avatar ativo usa box-shadow de 2px com transição; fundo permanece igual.
- Cada participante vê sua própria mão e avatar primeiro, com os demais em ordem circular a partir de sua vaga. A ordem visual preserva os índices das vagas e os turnos; espectadores veem a ordem original.
- Primeira compra de cada pessoa na rodada é automática. Zero automatiza compras na ordem normal dos turnos, pausando para decisões; remover Zero restaura Comprar/Parar. Compras forçadas aguardam entrega visual, sem compras sobrepostas.
- Snapshot confirma primeiro; apresentação mantém status/pontos anteriores durante a viagem e revela estouro/resultado na chegada. Cartas estouradas viram para o verso, sem vazar valores em tooltip/nome acessível. Ações pendentes/enfileiradas ficam visíveis junto ao baralho.
- Congelar/Compre 3 seguem permanência do Clássico. Compre 4/Só mais uma ficam visíveis durante o efeito e saem após a última entrega, com pausa visual de 0,5s; próxima ação/resultado aguardam a saída.
- Troca/roubo/descartes têm animação entre mãos/baralho. Passar no Vingança deita a primeira carta numérica e o primeiro modificador; isso não impede ações posteriores.
- Próxima rodada automática após animações e resumo de 1,6s. Cancelar timers ao desmontar, abrir saída ou mudar estado; fim da partida não avança. Respeitar movimento reduzido em deslocamentos, rotações e pausas. Durações finas ficam no código, sem tabela duplicada aqui.

## Economia pendente

Implementação futura, após concluir o gratuito. O host escolherá a entrada, igual por lugar. Saldo insuficiente será informado e impedirá entrar no lobby; a cobrança acontecerá ao iniciar, com nova validação atômica do saldo de todos. Vencedores dividem o pote, empates são rateados em inteiros e sobras seguem a ordem dos lugares; não gerar transações de valor zero.

Abandono voluntário perderá a entrada, e um bot assumirá enquanto os demais continuam. Desconexão não será abandono nem terá prazo automático. Antes de habilitar, ainda é necessário definir efeitos econômicos da expulsão, destino do prêmio de uma vaga controlada por bot e devoluções em cancelamentos/falhas. Não transportar contribuições simuladas, recibos ou carteira do protótipo para a API.

## Referências e verificação

- Referência da adaptação clássica: [implementação analisada em 17/11/2026](https://flip-7-618523404455.us-west1.run.app/), que credita Eric Olsen (jogo), Dirk Aporius e Google AI Studio (implementação), com cabeçalhos SPDX Apache-2.0 nos módulos consultados. Não incorporamos scripts remotos, proxy ou service worker dessa referência.
- Vingança: [manual The Op, Edition 1](https://cdn.shopify.com/s/files/1/0611/3958/3198/files/26_FLIP_7_VENGEANCE_RULES_C.pdf?v=1770853610) e [FAQ oficial](https://theop.games/pages/flip-7-wav-faqs). As escolhas diretas de ações acima são decisões específicas da Croebet.
- Testes atuais: `apps/api/tests/flip7*.test.mjs` para regras, bots e conservação; testes de matches para contratos, executor, autorização, transações, retries e substituição de controle; testes web para preferências/apresentação e E2E com duas contas para lobby, edição de configuração, início com vagas livres, turnos, host, expulsão, abandono, resposta perdida, retomada e ausência de criação com bots/Croins. A integração usa duas instâncias reais da API e PostgreSQL de test para verificar propagação após commit, recuperação por versão, repetição de comando e revogação de sessão. Fixtures de navegador servem Socket.IO pelo proxy do Next e exercitam reconexão sem reload. Comandos em [Validação](backend-architecture.md#validação). Não preservar testes exclusivos de formatos descartados ao substituir persistência.
