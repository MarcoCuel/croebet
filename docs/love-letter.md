# Love Letter

## Escopo

Disponível exclusivamente em partidas de desenvolvimento. Administradores abrem diretamente o modo dev, mesmo sem `teste=1` na URL; o switch permanece ligado e desabilitado enquanto não existir modo normal. O catálogo continua com a indicação “Em breve”; apenas administradores criam e iniciam lobbies, e convidados participam sem movimentação de Croins ou estatísticas. Infraestrutura em [Partidas de desenvolvimento](backend-architecture.md#partidas-de-desenvolvimento).

## Modos

| Modo | Edição | Jogadores | Baralho | Fichas para vencer |
| --- | --- | --- | --- | --- |
| Clássico | Original (2012) | 2–4 | 16 cartas, valores 1–8 | 7 / 5 / 4 para 2 / 3 / 4 jogadores |
| Moderno | Segunda Edição (2019) | 2–6 | 21 cartas, valores 0–9 | 6 / 5 / 4 / 3 / 3 para 2 / 3 / 4 / 5 / 6 jogadores |

O Clássico desempata pela soma dos descartes antes de dividir a vitória. O Moderno divide empates de mão e inclui Espiã e Chanceler; a ficha da Espiã depende de sobrevivência e não equivale a vencer a rodada. Preparação retira uma carta oculta e, com duas pessoas, outras três abertas. O primeiro jogador é sorteado; entre vencedores empatados da rodada anterior, sorteia-se o próximo primeiro jogador.

Referências: [regras clássicas de 2–4 jogadores, publicadas na edição Premium](https://images-cdn.zmangames.com/us-east-1/filer_public/06/8d/068d4a49-8501-4e6d-b505-64341d6680eb/aeg_loveletterprem_small.pdf) e [manual de 2019](https://images.zmangames.com/filer_public/5b/6c/5b6c17d7-7e0e-4b70-a311-9a6c32066010/ll-rulebook.pdf). Não usar a variante clássica de 2019 como substituta das regras de 2012.

## Execução e informação privada

Motor em `apps/api/src/modules/games/love-letter/engine.ts`, contratos em `packages/shared/src/love-letter.ts` e integração em `apps/web/features/games/test-game.tsx`. O servidor valida cartas, alvos, proteção, Condessa obrigatória, eliminação, escolha e ordem de devolução do Chanceler, rodadas e fichas. Bots escolhem entre ações legais usando a projeção da própria vaga, sem acesso ao baralho ou às mãos adversárias. A API envia mão e informações de Sacerdote/Barão apenas ao respectivo jogador; espectadores recebem descartes e contagens. Logs públicos não revelam cartas privadas.

## Interface da mesa

`apps/web/features/games/love-letter/love-table.tsx` controla decisões e entrega sua apresentação à mesa compartilhada em `three/table`. Toda a interação acontece dentro da prévia 3D: mão ativa na borda inferior, identificação, instruções, informações privadas e escolha de alvos. Cartas já jogadas ficam abertas junto ao respectivo participante, separadas da mão ativa; não são acumuladas num descarte central nem repetidas em cards externos. O fallback acessível continua dentro da mesma prévia.

A compra é apresentada automaticamente no início da vez, com a carta já confirmada pelo motor e o movimento a partir do baralho, sem clique para comprar. A mão do próprio jogador permanece visível também fora da vez. Toque na carta para jogar e na identificação de um jogador para escolher o alvo. Quando o Guarda tem somente um alvo válido nas ações autorizadas pela API, ele é selecionado automaticamente e os palpites aparecem direto, inclusive em mesas maiores com os demais alvos protegidos ou eliminados. No palpite do Guarda, a própria mão passa temporariamente a mostrar somente as opções legais; escolher envia a ação e restaura a mão real. Essas cartas de opção não revelam a carta oculta do alvo. Cancelar restaura a seleção sem alterar a partida. O Chanceler usa as próprias cartas: primeiro a que será mantida, depois as devoluções em ordem; cartas iguais continuam distinguíveis pela posição. Rei, cartas jogadas e devoluções ao deck preservam identidades visuais quando a projeção permite, sem deduzir valores privados.

Padre (Sacerdote) e Barão abrem uma inspeção persistida pelo motor, antes de passar a vez ou comprar outra carta. O Padre mostra a carta do alvo; o Barão mostra as duas cartas restantes lado a lado. As cartas saem visualmente das mãos e ocupam temporariamente a região do descarte, com identificação do dono, sem alterar posse nem virar descartes. As frentes do Padre são enviadas apenas a quem o jogou; as do Barão, apenas aos dois envolvidos. Os demais jogadores e espectadores recebem versos e a indicação de espera, sem valores privados em frames, recibos ou histórico público.

“Continuar” é a única ação legal durante a inspeção e não tem prazo automático. Quem jogou controla a confirmação; no Barão jogado por bot contra humano, o alvo humano confirma. Bots sem observador humano envolvido confirmam automaticamente. O servidor autoriza, persiste e deduplica esse comando pelo fluxo comum de partidas. Recarregar, ocultar a aba ou reconectar não encerra a inspeção. Confirmar devolve visualmente as cartas; no Barão, o motor então aplica a eliminação por menor valor (empate mantém ambos) e continua o turno. Abandonar transfere o controle ao bot conforme o fluxo existente. Snapshots anteriores sem o novo campo continuam válidos; não há migração ou reset de partidas.

O executor resolve cada ação atomicamente e interrompe as automações ao encontrar uma decisão humana, inclusive a confirmação de inspeção. `use-game-playback.ts` apresenta os frames públicos em sequência, bloqueia decisões durante a reprodução e então aplica a projeção privada confirmada. Durante os frames públicos da mesma rodada, apenas a mão do observador usa a projeção privada confirmada mais recente, limitada à quantidade de cartas daquele frame para não antecipar a próxima compra; as mãos adversárias continuam ocultas e as decisões permanecem bloqueadas. Rodadas encerradas têm uma pausa maior. A fila também aguarda a conclusão dos movimentos informada pela mesa antes de avançar. Aba oculta, movimento reduzido, recarga ou ressincronização completa vão direto ao estado confirmado, preservando inspeções pendentes. Frames e recibos não incluem mãos ocultas, valores privados de inspeção, informações privadas nem a ordem de devolução do Chanceler. Compras e descartes têm deslocamento visual; a compra local parte do baralho. O histórico mostra a miniatura da carta jogada.

O catálogo de cartas fica em `/admin/jogos/laboratorio/love-letter`, acessível pelo laboratório. Mostra ambas as edições, quantidades, efeitos, frentes nos três tamanhos e versos, reutilizando `love-card.tsx` da mesa. Continua restrito à administração; Love Letter permanece exclusivamente no ambiente de desenvolvimento.
