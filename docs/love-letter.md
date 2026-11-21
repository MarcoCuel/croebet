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

`apps/web/features/games/love-letter/love-table.tsx` mantém a mão ancorada na parte inferior da mesa. A compra é apresentada ao tocar no baralho; o motor já confirmou essa carta e o clique apenas a revela, sem sortear ou alterar regras localmente. Toque na carta para descartar, no card de um jogador para escolher o alvo e em uma miniatura para dar o palpite do Guarda. Somente alvos e cartas legais ficam interativos. Cancelar permite refazer uma seleção ainda não enviada. O Chanceler usa as próprias cartas: primeiro a que será mantida, depois as devoluções em ordem; cartas iguais continuam distinguíveis pela posição.

O executor continua resolvendo as regras atomicamente. `use-game-playback.ts` apresenta os frames públicos em sequência, bloqueia decisões durante a reprodução e então aplica a projeção privada confirmada. Rodadas encerradas têm uma pausa maior. Aba oculta, movimento reduzido, recarga ou ressincronização completa vão direto ao estado confirmado. Frames e recibos não incluem mãos ocultas, informações privadas nem a ordem de devolução do Chanceler. Compras e descartes têm deslocamento visual; a compra local parte do baralho. O histórico mostra a miniatura da carta jogada.

O catálogo de cartas fica em `/admin/jogos/laboratorio/love-letter`, acessível pelo laboratório. Mostra ambas as edições, quantidades, efeitos, frentes nos três tamanhos e versos, reutilizando `love-card.tsx` da mesa. Continua restrito à administração; Love Letter permanece exclusivamente no ambiente de desenvolvimento.
