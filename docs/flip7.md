# Flip7 local

## Referência analisada

URL: https://flip-7-618523404455.us-west1.run.app/ — analisada em 17/11/2026.

O HTML público contém um import map com módulos JavaScript embutidos em data URLs. Foram lidos o baralho, regras, ações, gerenciador de partidas, tela de configuração e estratégias dos bots. A referência credita o jogo a Eric Olsen e a implementação a Dirk Aporius e Google AI Studio; módulos consultados contêm cabeçalho SPDX Apache-2.0.

As regras e os bots são executados no navegador. As dependências React e fontes da referência são carregadas de CDNs, e o documento registra um service worker. Não foi confirmado o funcionamento offline desse service worker. O proxy de API presente no HTML não é necessário para a lógica local de partidas analisada.

## Implementação na Croebet

A adaptação reimplementa o jogo em TypeScript e React com os primitives existentes, textos em português e integração ao catálogo. Nenhum script remoto, proxy ou service worker da referência é executado ou incorporado. A arte do catálogo é um SVG local criado para esta integração.

- `features/games/flip7/engine.ts`: estado e transições independentes de React, DOM, autenticação ou carteira.
- `features/games/flip7/match-storage.ts`: snapshot versionado, validação e persistência local de uma única partida.
- `features/games/flip7/flip7-game.tsx`: configuração, mesa, cartas, regras, histórico de rodadas e timer cancelável dos bots/compras forçadas.
- `features/games/flip7/flip7-loader.tsx`: fronteira cliente com carregamento dinâmico exclusivo da página do jogo.
- `app/jogos/[slug]/page.tsx`: composição da plataforma; mantém o comportamento dos demais jogos.

O jogo recebe ações e devolve um novo estado sem alterar o anterior. O embaralhamento usa uma semente aleatória criada no navegador ao iniciar, com transições determinísticas para testes e compatibilidade com verificações do React. Não é um gerador adequado a apostas controladas por servidor.

## Modalidade e regras

De 2 a 12 participantes, com pelo menos uma pessoa e bots opcionais em três níveis. A referência permite de 2 a 4; doze é uma extensão da adaptação. Pessoas compartilham o dispositivo; não existem salas ou multiplayer online.

Baralho de 94 cartas: um 0; N cópias de cada número N entre 1 e 12; bônus +2/+4/+6/+8/+10; um ×2; três cartas de cada ação (Congelar, Compre 3 e Segunda chance).

Cada turno permite uma compra ou parar após obter uma carta numérica. Repetir um número estoura. Segunda chance descarta automaticamente a proteção e a carta repetida, preservando a primeira. Sete números diferentes encerram imediatamente a rodada e somam 15 pontos extras. ×2 dobra apenas os números. O maior total vence na rodada em que alguém chega a 200; empate mantém todos os vencedores.

Ações de Congelar/Compre 3 permitem escolher qualquer participante ativo, inclusive quem comprou a carta. Ações compradas durante Compre 3 ficam em fila até concluir a sequência; estourar descarta as ações dessa pessoa. Uma segunda chance adicional fora de uma sequência pode ser doada a outra pessoa ativa sem proteção; durante uma sequência ela é descartada, seguindo a referência.

Congelar e Compre 3 resolvidos ficam na mão do destinatário, sem somar pontos, e vão ao descarte somente ao preparar a próxima rodada. Cartas consumidas por segunda chance ou ações canceladas vão ao descarte. Isso corrige um problema identificado no original, que removia algumas dessas cartas sem devolvê-las ao descarte. Cartas são conservadas entre rodadas, e descartes só são embaralhados ao esgotar o baralho. Bots usam informações públicas, sem consultar a ordem escondida do baralho; estratégias foram reimplementadas.

## Limites atuais

Cada partida recebe um código aleatório de 12 caracteres e uma URL com `?partida=CODIGO`. Existe somente uma partida salva de Flip7, na chave `croebet:flip7:match` do localStorage. O estado completo é salvo antes de renderizar cada jogada, incluindo automações e escolhas de alvo. O snapshot tem versão e validação estrutural, índices e conservação das 94 cartas. Falhas de gravação apresentam feedback sem interromper o jogo.

Recarregar ou voltar à página recupera a única partida automaticamente e atualiza a URL com seu identificador. Não há campo de código na configuração, recuperação manual ou múltiplas partidas simultâneas. O botão com o código copia seu valor. Ao fim da partida, Jogar novamente limpa o salvamento e retorna à configuração. A retomada restaura o resultado da última jogada, sem repetir a animação nem comprar a mesma carta novamente; compras automáticas ainda pendentes continuam normalmente. Dados inválidos ou incompatíveis exibem erro na configuração.

Os códigos identificam partidas salvas somente neste navegador e origem; não são credenciais ou salas online. Limpar os dados do site remove as partidas; outro dispositivo não consegue recuperá-las. A aplicação precisa carregar seus arquivos inicialmente; esta integração não adiciona suporte PWA/offline ao site. Depois de carregado, o motor não depende de requisições para jogar.

Pontos do Flip7 não debitam nem creditam Croins e não atualizam rankings/conquistas globais. A economia dessa modalidade ainda precisa ser definida. Para um futuro modo online com economia compartilhada, regras, aleatoriedade, turnos e resultados deverão ser validados no backend.

## Validação

`tests/flip7.test.mjs` cobre baralho, pontuação, estouros, proteção, ações em fila, alvos, término e rotação de rodadas. Simulações com 80 sementes conferem conservação/identidade das 94 cartas e término das partidas.

`tests/flip7-storage.test.mjs` verifica snapshots e a próxima transição em partidas completas, incluindo ações pendentes, compras forçadas, resumo e fim; também cobre o salvamento único, dados corrompidos/incompatíveis e falhas de gravação. O E2E inclui reload, URL e retorno automático à partida ao reabrir o jogo.

`tests/e2e/flip7.spec.ts` cobre entrada pelo catálogo, configuração, regras e foco, turnos locais, confirmação de nova partida e overflow em desktop/mobile. A execução depende de Chrome e permissão para abrir a porta local do servidor Playwright.

Validação desta implementação: lint, TypeScript, 17 testes e build de produção aprovados (build com Node 22.22.0). A tentativa de executar a suíte E2E foi bloqueada antes de abrir o navegador: `listen EPERM 127.0.0.1:3100`. Não houve validação visual automatizada nesta sessão.

## Interface mínima

Configuração compacta com quantidade de jogadores e nomes sem edição. O primeiro participante é sempre a conta conectada, como pessoa, sem seletor; os seletores de tipo aparecem do segundo participante em diante. Sem sessão, o botão principal abre o login existente antes de permitir iniciar a partida. A sessão é lida somente na configuração; o motor continua independente dela. O topo reúne baralho, última carta comprada e Comprar/Parar. As mãos ficam em colunas abaixo, com modificadores antes dos números; o histórico de jogadas e totais aparece na lateral em containers largos e abaixo no mobile. Cartas escuras têm número colorido, marca superior e nome; especiais usam cores próprias. O turno é indicado pela borda do participante. Regras ficam apenas na configuração inicial. A partida tem controles para copiar o código e esconder/mostrar o histórico; ao esconder, o espaço lateral é liberado para as mãos. As regras do motor e a economia não mudam.

## Animações de compra e estouro

A carta em trânsito sai de trás do baralho, é revelada ao lado dele e percorre a mesa até o espaço reservado na mão do destinatário. A interface usa uma timeline GSAP cancelável, coordenadas medidas após o layout e um bloqueio síncrono de ações para impedir compras sobrepostas. Bots e Compre 3 aguardam o movimento terminar. Cartas de ação e segunda chance consumida usam um espaço temporário na mão durante a animação. A última carta não fica duplicada ao lado do baralho.

Após a chegada de uma carta que causa estouro, todas as cartas da mão giram em 3D para o verso, sem valores no nome acessível ou tooltip. O verso permanece até a próxima rodada. Preferência por movimento reduzido remove os deslocamentos e a rotação. A timeline é cancelada ao sair da partida ou desmontar o jogo.

## Faixa de status

A mesa usa fundo transparente. Status contextual e ações ficam na faixa superior; Comprar/Parar aparecem somente no turno de uma pessoa, sem compra em andamento ou ação especial pendente. O resumo de usuários e totais ocupa a faixa junto ao baralho. A lateral contém apenas o histórico. Durante o movimento da carta, o status informa o destinatário antes de anunciar o próximo turno.

A primeira compra de cada participante em cada rodada é automática, mantendo a animação e aguardando escolhas humanas de cartas especiais. O motor marca a compra realizada mesmo quando a carta de ação não permanece na mão, evitando compras automáticas repetidas. O marcador é reiniciado na próxima rodada.

Ritmo de compra: saída de 0,12s, revelação de 0,02s na primeira compra ou 0,65s nas seguintes, deslocamento até a mão de 0,2s. Não há espera após a chegada; a próxima jogada é liberada enquanto uma eventual virada por estouro acontece. A distribuição inicial começa após 60ms e as automações seguintes usam intervalos curtos.

As cartas de ação pendentes e enfileiradas ficam visíveis ao lado do baralho, com área adicional reservada para a próxima revelação. A animação de uma ação termina nesse local, sem passar pela mão. Ações encontradas em Compre 3 permanecem no topo durante as compras seguintes; só somem ao resolver o alvo ou ao serem descartadas por estouro/fim da rodada.

As mãos usam uma grade de linha única para números e outra para modificadores. Ambas compartilham a mesma largura proporcional de carta, limitada pelo tamanho original. Unidades de container escalam texto, ícones, cantos e verso junto das cartas. A animação de entrega também reduz a carta até a largura final da mão.

## Configuração por vagas

O seletor define de 2 a 12 lugares. A conta conectada ocupa o primeiro lugar fixo. Os demais aparecem como Disponível; o botão + abre um diálogo com Nome e Tipo (Pessoa ou Bot). Bots adicionados usam a estratégia média. Lugares preenchidos permitem editar ou remover o participante pelo mesmo diálogo. É preciso preencher todos os lugares selecionados antes de começar. Diminuir e aumentar a quantidade preserva as configurações dos lugares temporariamente ocultos.

## Vingança e modo Brutal

A configuração permite escolher Clássico ou A vingança nunca é plena. Brutal é uma opção exclusiva do Vingança. A mesa identifica a modalidade; regras, bots, alvos e pontuação seguem a opção salva na partida. A adaptação mantém de 2 a 12 pessoas em todos os modos.

Referências oficiais consultadas:

- [Manual da The Op, Ruleset Edition 1](https://cdn.shopify.com/s/files/1/0611/3958/3198/files/26_FLIP_7_VENGEANCE_RULES_C.pdf?v=1770853610).
- [FAQ oficial de Vingança](https://theop.games/pages/flip-7-wav-faqs).

`types.ts` descreve o estado e as ações. `rules.ts` compartilha baralhos, nomes, embaralhamento, classificação numérica e pontuação. `engine.ts` preserva as transições do Clássico e encaminha Vingança a `vengeance.ts`.

Vingança usa 108 cartas: 92 numéricas, seis modificadores e dez ações. O 7 azarado e o 13 da sorte substituem uma cópia comum desses valores; O Zero completa os números. O Zero obriga comprar e zera a pontuação, exceto no Flip7; o 7 azarado descarta as outras cartas e os efeitos já recebidos na sequência forçada; o 13 da sorte permite um segundo 13, ambos contando para o Flip7. Modificadores são −2/−4/−6/−8/−10 e ÷2. As ações são Só mais uma!, Compre 4, Roubar, Trocar e Descartar, com duas cópias cada. Ações usadas são descartadas nesta edição.

Quem compra uma ação escolhe quem irá resolvê-la. Em Roubar/Trocar/Descartar, o destinatário seleciona cartas da mesa, com teclado ou ponteiro; Trocar exige cartas de pessoas diferentes e pode estourar ambas. Pessoas que pararam continuam elegíveis e resolvem efeitos sem voltar à atividade. Compre 4 adia ações e modificadores, mantendo ordem de compra. A fila distingue efeitos ainda pertencentes à sequência daqueles já liberados: estourar durante as quatro compras cancela os primeiros; estourar depois em Só mais uma! não apaga os outros efeitos já liberados, conforme a FAQ. Compras forçadas interrompem no estouro ou no Flip7.

A pontuação soma números, divide por dois arredondando para baixo, subtrai modificadores e só então adiciona o bônus. Vingança padrão limita o resultado a zero. Brutal permite valores negativos e modificadores em pessoas estouradas. `bustedCards` identifica as cartas viradas e fora de jogo; novos modificadores recebidos depois do estouro ficam abertos e são contabilizados sobre base zero. Completar Flip7 no Brutal pausa para escolher +15 ou −15 para outro participante, inclusive estourado; a rodada é contabilizada uma única vez, após escolher.

A persistência conserva a chave e a versão existentes. Snapshots anteriores sem modalidade são interpretados como Clássico. A validação usa o baralho da modalidade, aceita pontos negativos somente no Brutal e confere alvos, escolha do bônus, sequências forçadas, identidade e conservação das 94/108 cartas. A seleção das duas cartas de uma troca é visual e pode ser refeita após reload. Selecionar a segunda carta anima uma prévia local da troca, sem alterar o motor, o histórico ou o snapshot. Cancelar anima as cartas de volta; Confirmar efetiva a ação sem repetir a animação local. Apenas a ação confirmada deverá ser transmitida quando houver multiplayer online. Roubar e Descartar também exigem confirmar a carta selecionada. Descartar explicita quem decide e permite selecionar cartas da própria mão ou de outros participantes; Cancelar mantém todas as cartas. Na primeira etapa, o rótulo explicita quem vai roubar e receber a carta; na segunda, o participante seleciona a carta de outra pessoa. O histórico identifica quem roubou e quem perdeu a carta. Os demais estados de escolha são persistidos.

Animações GSAP movimentam cartas roubadas/trocadas entre mãos e cartas descartadas até o baralho. O 7 azarado aguarda chegar antes de descartar as cartas anteriores. Automações aguardam as animações e respeitam movimento reduzido.

`tests/flip7-vengeance.test.mjs` cobre as novas regras, filas encadeadas, negativos, escolha do bônus, compatibilidade de salvamento, dados adulterados e decisões dos bots sem acessar ordem do baralho. Simulações de Vingança e Brutal com 2, 3, 6 e 12 participantes verificam conservação das cartas e retomada em cada transição. Os cenários de navegador cobrem configuração, seleção por teclado, roubo/troca com animação, Zero, modificadores após estouro e reload durante a escolha do bônus.

A apresentação mantém status, pontuação, destaque de turno e histórico anteriores enquanto uma carta viaja. Estouro e virada das cartas são apresentados na chegada à mão; controles de fim da rodada aguardam o término da entrega. Roubo e troca também aguardam a transferência para apresentar o resultado. O snapshot continua sendo salvo antes da animação, para não repetir uma compra ao recarregar.

### Escolha direta de Roubar e Descartar

Por decisão de interação da Croebet, quem compra Roubar ou Descartar resolve a ação diretamente: um clique na carta executa o efeito e anima a transferência ou o descarte. Não há escolha prévia de participante nem confirmação nessas duas ações. Roubar usa cartas de outras mãos; Descartar permite cartas próprias e de outros jogadores que não estouraram. Somente Trocar mantém a prévia reversível e Confirmar/Cancelar. Ações em fila seguem o mesmo fluxo ao serem liberadas. Snapshots antigos dessas ações são normalizados para a escolha direta ao retomar.

No Vingança, passar deita com rotação de 90 graus a primeira carta numérica e o primeiro modificador de cada mão. A transformação cabe na área da carta e respeita movimento reduzido. A indicação deriva do status salvo, permanece após reload e não impede roubo, troca ou descarte. Cartas estouradas continuam usando o verso.

O Zero automatiza a compra na vez do seu portador, preservando a ordem de turnos. A interface aguarda a chegada de cada carta e pausa para escolhas de ação; Comprar/Parar ficam ocultos enquanto o Zero torna a compra obrigatória. Remover o Zero restaura a escolha normal. Reload retoma a automação sem repetir compras já salvas.

A passagem de rodada é automática: após concluir entregas e transferências, o resumo fica visível por 1,6 segundo e a interface envia `next`. O timer é cancelado ao desmontar, ao abrir a confirmação de saída ou ao mudar o estado. Retomar um resumo após reload também inicia a próxima rodada automaticamente. Partidas encerradas mantêm Jogar novamente e não avançam.
