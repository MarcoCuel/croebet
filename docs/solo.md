# Solo

## Escopo e referência

Disponível exclusivamente em desenvolvimento, sem Croins nem estatísticas oficiais. Administradores criam os testes; participantes convidados acessam a mesma sala. Usa salas, persistência, abandono para bot, histórico, duração e replay compartilhados. Catálogo inserido incrementalmente pela migration `0039_solo_development.sql`, sem alterar partidas existentes. A migration `0040_bind_solo_module.sql` vincula um cadastro anterior com slug `solo` e identificador de placeholder ao motor, preservando ID, apresentação, publicação e históricos; não reinterpreta registros vinculados a outro jogo.

Referência: [Solo do Board Game Arena](https://boardgamearena.com/gamepanel?game=solo), incluindo seu resumo em português. Não usar como substituto a edição posterior do manual com Trinca+, Presente ou Proteção. Motor/driver em `apps/api/src/modules/games/solo`; contratos em `packages/shared/src/solo.ts`; apresentação em `apps/web/features/games/solo`.

## Regras

2–10 participantes, 8 cartas por pessoa. Baralho clássico de 112 cartas: duas cópias de 1–9 por cor, duas de Pular/Inverter/+2 por cor, uma de Trocar mãos por cor e quatro de cada coringa (Escolher cor, +4 e Rodízio). A distribuição começa na primeira vaga sorteada e segue em ciclos. Abre-se o descarte até uma carta numérica. Cores: vermelho, amarelo, verde e azul.

Na vez, jogar cor, número ou símbolo correspondente; coringas combinam com qualquer carta. Comprar uma carta é permitido mesmo tendo jogada. Após comprar, pode-se jogar a comprada ou passar; uma intervenção idêntica ao topo continua possível. Não há Trinca+. Cartas idênticas (mesma cor e número/símbolo) podem ser jogadas fora da vez; o turno segue a partir de quem interveio, respeitando o efeito jogado.

Pular remove a próxima vez. Inverter muda o sentido, inclusive com dois participantes, sem acrescentar um efeito de Pular. +2 acumula somente com +2; +4 somente com +4. Quem paga a penalidade mantém sua vez normal. +4 também escolhe a cor, sem desafio do Uno. Trocar mãos exige alvo e mantém o próximo jogador da sequência normal, conforme a versão BGA. Rodízio transfere todas as mãos no sentido atual e permite qualquer carta na jogada seguinte.

O botão de anúncio pode acompanhar a jogada que deixa uma carta, ou ser usado enquanto o aviso está pendente. A próxima compra/descarte aplica automaticamente duas cartas a quem esqueceu. Bots anunciam Solo; suas escolhas e intervenções usam somente suas próprias projeções. A última carta encerra a rodada antes de resolver seu efeito.

Duração configurável: uma rodada, 3 ou 4 rodadas, ou limite de 100/250/500 penalidades. Números valem seu valor; Inverter 10; Pular 20; +2/Trocar mãos 30; Escolher cor/Rodízio 40; +4 50. Vence a menor penalidade, com empates compartilhados. Estado guarda penalidades positivas; resumo e placar compartilhado usam o equivalente negativo, preservando a ordenação existente.

## Adaptações online e privacidade

O servidor serializa intervenções por versão e lock da sala; uma disputa recusa o comando obsoleto e exige ressincronização, sem reaplicação automática. Bots e próxima rodada são automações persistidas com intervalo de 2,4 segundos, permitindo reação entre jogadas. Testes só com bots preservam pausa e avanço manual. Desconectar não abandona nem passa a vez humana.

Quando o baralho acaba, embaralhar os descartes preservando o topo. Se todas as cartas estiverem nas mãos, comprar não inventa cartas; um ciclo completo de passes sem reposição encerra a rodada pela menor penalidade de mão. Esta resolução de bloqueio é uma adaptação explícita da implementação online.

Durante a rodada, cada destinatário recebe somente sua mão, descartes e contagens adversárias. Eventos/recibos não persistem o payload privado de compra nem ações disponíveis; o replay consome a projeção pública. As mãos são abertas ao encerrar a rodada para conferir a pontuação. Identidades visuais de cartas ocultas são locais à apresentação, sem consultar o snapshot privado do servidor.

A mesa usa fundos nas quatro cores, com cor independente para números/símbolos e legendas contrastantes. Cartas pretas conservam fundo neutro. O laboratório permite conferir a arte e ajustar separadamente fundo e número no baralho neutro; presets antigos continuam acompanhando o tema.
