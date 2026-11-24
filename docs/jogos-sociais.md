# Jogos de mesa no catálogo

Em Coup, cada assento exibe as moedas e as influências já reveladas. As cartas de personagem na área de ações anunciam o papel que se pretende reivindicar. As influências da própria mão ficam dentro do dossiê privado. Em Dixit, tocar numa imagem amplia a ilustração antes de confirmar a pista ou o voto. A revelação associa cada imagem ao resultado da votação. Em Secret Hitler, os carimbos marcam as políticas aprovadas nas duas trilhas. Em Spyfall, o relógio e a pergunta ficam no centro, e o dossiê separa as informações individuais dos locais que todos podem consultar.

As mesas usam o controle de som do site e respeitam a preferência de movimento reduzido. O histórico das quatro mesas sociais abre pelo controle da partida. No Solo, a mesa 3D e as cartas da interface compartilham o motivo de órbitas do baralho.

| Jogo | Mesa | Decisão central | Economia da sala |
| --- | --- | --- | --- |
| Coup | 2–6 | Reivindicar um papel, bloquear ou desafiar antes da resolução | Grátis ou entrada em Croins |
| Dixit | 3–6 | Dar uma pista ambígua e votar na imagem do narrador | Grátis |
| Secret Hitler | 5–10 | Eleger governos, deliberar e interpretar políticas públicas | Grátis |
| Solo | 2–10 | Descartar, anunciar a última carta e intervir com carta idêntica | Grátis ou entrada em Croins |
| Spyfall | 3–8 | Interrogar o grupo sem entregar o local ao espião | Grátis |

O modo de teste administrativo usa o mesmo motor e as mesmas regras. Os bots permitem exercitar ações e finais. Suas pistas e respostas são simples e servem para testar o fluxo. Partidas públicas começam com pessoas. Quem abandona cede a vaga ao bot conforme a regra comum do site.

## Coup

Baralho clássico com cinco papéis e três cópias de cada. Cada participante recebe duas influências. A primeira pessoa começa com uma moeda no duelo. Renda, ajuda e tributo rendem uma, duas e três moedas. Golpe custa sete e se torna obrigatório a partir de dez. Extorsão transfere até duas moedas. Assassinato custa três mesmo quando a ação é bloqueada. Na troca, o embaixador compra duas e devolve duas, conservando a quantidade de influências.

A mesa resolve reivindicação, desafio, bloqueio e desafio do bloqueio em etapas. Os adversários recebem a oportunidade de reagir em ordem de assento. A pessoa derrotada no desafio escolhe a carta que revela. Se comprovou o papel, a carta volta à corte e é substituída. Durante a partida, a mão só aparece no dossiê da pessoa que a controla. O tesouro usado para realizar ações existe apenas naquela mesa. A entrada opcional em Croins é tratada pela carteira do site. [Referência de Rikki Tahta e Indie Boards & Cards](https://indieboardsandcards.com/our-games/coup/)

## Dixit

Adotada a edição clássica para três a seis pessoas. O narrador escolhe uma imagem da própria mão e escreve uma pista curta. Os outros contribuem com uma imagem cada. Na mesa de três, recebem sete cartas e cada adversário envia duas. A galeria aparece embaralhada e sem autoria. O voto fica privado durante a votação, e a API recusa votos na própria imagem.

Quando parte da mesa acerta, o narrador e quem acertou recebem três pontos. Quando todos ou ninguém acertam, cada adversário recebe dois. Cada voto em uma contribuição adversária rende um ponto a quem a enviou. A revelação permite conferir autoria e votos recebidos. A maior pontuação vence quando alguém chega a 30 ou o monte termina. O baralho desta implementação tem 84 ilustrações originais em WebP com texto alternativo. O gerador em `apps/web/scripts/generate-dream-deck.mjs` combina doze motivos narrativos e sete cenários. [Manual da edição usada](https://images-cdn.asmodee.us/filer_public/71/db/71db4c28-aa59-4d4f-ad0a-af2c7e8167dc/dix01_rules.pdf)

## Secret Hitler

A composição de papéis e a trilha de poderes dependem da quantidade inicial de participantes. O presidente indica uma pessoa elegível, os vivos votam e a aprovação exige maioria absoluta. Os votos aparecem juntos após o último voto. O presidente descarta uma das três políticas. O chanceler promulga uma das duas restantes. Três eleições frustradas promulgam a política do topo, suspendem limites de mandato e dispensam o poder executivo daquela política.

Investigação mostra a filiação em privado. A presidência extraordinária retorna à ordem anterior na eleição seguinte. Consulta do topo, eliminação e veto seguem a trilha correspondente. Liberais vencem com cinco políticas ou com a eliminação de Hitler. Fascistas vencem com seis políticas ou com a eleição de Hitler para chanceler a partir da terceira política fascista. Na mesa de cinco ou seis Hitler conhece o aliado. Em mesas maiores, só os fascistas comuns conhecem o grupo. A interface usa ícones de urna, parlamento e documentos. [Manual e créditos do original](https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf)

O jogo original é publicado por Goat, Wolf & Cabbage. Esta adaptação digital contém interface e iconografia próprias e está disponibilizada sob CC BY-NC-SA 4.0. Antes de um lançamento comercial, a equipe precisa confirmar a autorização aplicável com os titulares. [Condições dos criadores](https://www.secrethitler.com/) · [Texto da licença](https://creativecommons.org/licenses/by-nc-sa/4.0/)

## Solo

Usa o motor clássico já presente na Croebet e seus modos de rodada e pontuação. A mudança abre o fluxo público e o replay, preserva as preferências por usuário e oferece entrada opcional pela carteira existente. [Regras da variante da Croebet](solo.md) · [Manual de referência AMIGO](https://blog.amigo-spiele.de/content/ap/rule/03900-MLV-AmigoRule.pdf)

## Spyfall

São cinco rodadas. A cada distribuição, uma pessoa recebe o papel de espião e as demais recebem o local e uma profissão. O catálogo de 30 locais inclui o buteco, a rádio comunitária e o brechó. Perguntas e respostas são escritas na mesa e ficam no histórico público. Quem responde passa a perguntar e deve escolher alguém diferente de quem acabou de perguntar.

O servidor guarda o horário de término dos oito minutos e pausa a contagem durante uma acusação. Cada pessoa pode acusar uma vez nessa fase. O acusado se abstém e a mesa precisa de unanimidade. O espião também pode arriscar um local. Acabar o tempo abre a última sequência de acusações. Na pontuação, o espião recebe dois pontos por escapar ou quatro por acertar o local ou deixar um inocente ser condenado. Quem identificou o espião ganha um ponto, e quem fez a acusação correta ganha mais um. [Regras da Cryptozoic](https://cryptozoic.com/products/spyfall-game)

## Integração e revisão

As definições compartilhadas registram opções, limites, saldo e capacidades. A API valida o assento autenticado, a ação, a versão e a expectativa de texto antes de modificar o estado. O driver projeta uma visão individual por assento e uma visão pública para histórico e espectadores. O replay recebe a projeção pública e um marcador de avanço. Cartas privadas, votos individuais ainda pendentes, dossiês e ações privadas disponíveis ficam fora dos eventos públicos.

A interface reutiliza o lobby, os convites, a conexão Socket.IO, o componente de mesa, o histórico, os controles e o resultado. No catálogo, a disponibilidade segue a definição do módulo. Cadastros com slug personalizado continuam vinculados ao mesmo identificador. A migração aproveita os placeholders elegíveis e preserva capas, identificadores e publicação administrados pelo site.
