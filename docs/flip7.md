# Flip 7

## Escopo

Jogo em `/jogos/flip7`, de 2 a 12 participantes, com pessoas no mesmo dispositivo e bots opcionais. A conta conectada controla a partida e ocupa o primeiro lugar; outras pessoas são convidados locais, sem vínculo com contas. Motor e partidas ficam na API/PostgreSQL. Não há salas entre contas; Croins permanecem bloqueados. Pontos não viram Croins nem atualizam rankings/conquistas.

A execução segue a [base compartilhada dos jogos](backend-architecture.md#base-compartilhada-dos-jogos), com regras específicas do Flip 7. Não há importação de snapshots locais. [Operação e contratos](backend-architecture.md#partidas-livres-integradas).

## Mapa do código

| Destino | Responsabilidade |
| --- | --- |
| `apps/api/src/modules/games/flip7/` | Motor puro, regras, bots, invariantes privadas e driver com RNG seguro |
| `apps/api/src/modules/matches/` | Executor compartilhado, transações, comandos idempotentes, eventos e HTTP |
| `packages/shared/src/matches.ts` | Contratos públicos de criação, decisões, snapshots e frames; sem ordem do baralho/seed |
| `apps/web/features/games/flip7/` | Configuração, loaders HTTP, projeções visuais, mesa, histórico e animações; sem execução de jogadas |

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

- Código de 12 caracteres em `?partida=CODIGO`, resolvido pela API somente para o titular. Lista/retomada carregadas no servidor; indisponibilidade é distinta de ausência. Sem sessão, iniciar usa o login existente.
- Configuração continua disponível com partidas em andamento; lista só as não finalizadas. Navegar/recarregar preserva partidas. Abandonar encerra apenas a escolhida; Jogar novamente mantém resultado final acessível pela URL.
- Estado e automações confirmam no banco antes da apresentação. Respostas incluem frames de ações já aplicadas para a fila visual. Reload usa o estado confirmado sem repetir compras nem importar animações antigas.
- Decisão humana usa ID de comando e versão esperada. Resposta incerta permite repetir o mesmo ID; conflito exige recarregar. Não enviar `step`, `next`, seed, pontuação ou snapshot para autorizar jogadas.
- Preferências em `croebet:flip7:setup`: modalidade, Brutal e quantidade de lugares; sem nomes/tipos. Fallback: Clássico, dois lugares, sem Brutal. Não ler nem converter partidas do localStorage; todos os lugares selecionados devem estar preenchidos.

## Apresentação

- Baralho/status/ações no topo; mãos em linhas por participante, números e modificadores dimensionados pelo container. Histórico lateral em telas largas, abaixo no mobile, com controle para esconder. Avatar ativo usa box-shadow de 2px com transição; fundo permanece igual.
- Primeira compra de cada pessoa na rodada é automática. Zero automatiza compras na ordem normal dos turnos, pausando para decisões; remover Zero restaura Comprar/Parar. Bots e compras forçadas aguardam entrega visual, sem compras sobrepostas.
- Snapshot confirma primeiro; apresentação mantém status/pontos anteriores durante a viagem e revela estouro/resultado na chegada. Cartas estouradas viram para o verso, sem vazar valores em tooltip/nome acessível. Ações pendentes/enfileiradas ficam visíveis junto ao baralho.
- Congelar/Compre 3 seguem permanência do Clássico. Compre 4/Só mais uma ficam visíveis durante o efeito e saem após a última entrega, com pausa visual de 0,5s; próxima ação/resultado aguardam a saída.
- Troca/roubo/descartes têm animação entre mãos/baralho. Passar no Vingança deita a primeira carta numérica e o primeiro modificador; isso não impede ações posteriores.
- Próxima rodada automática após animações e resumo de 1,6s. Cancelar timers ao desmontar, abrir saída ou mudar estado; fim da partida não avança. Respeitar movimento reduzido em deslocamentos, rotações e pausas. Durações finas ficam no código, sem tabela duplicada aqui.

## Economia pendente

Direção do modo com Croins: mesma entrada por lugar, vencedores dividem pote, empates rateados em inteiros e sobras pela ordem dos lugares; não gerar transações de valor zero. Financiamento dos bots e regras definitivas de abandono/recuperação precisam de aprovação antes de habilitar. Não transportar contribuições simuladas, recibos ou carteira do protótipo para a API.

## Referências e verificação

- Referência da adaptação clássica: [implementação analisada em 17/11/2026](https://flip-7-618523404455.us-west1.run.app/), que credita Eric Olsen (jogo), Dirk Aporius e Google AI Studio (implementação), com cabeçalhos SPDX Apache-2.0 nos módulos consultados. Não incorporamos scripts remotos, proxy ou service worker dessa referência.
- Vingança: [manual The Op, Edition 1](https://cdn.shopify.com/s/files/1/0611/3958/3198/files/26_FLIP_7_VENGEANCE_RULES_C.pdf?v=1770853610) e [FAQ oficial](https://theop.games/pages/flip-7-wav-faqs). As escolhas diretas de ações acima são decisões específicas da Croebet.
- Testes atuais: `apps/api/tests/flip7*.test.mjs` para regras, bots e conservação; testes de matches para contratos, executor, autorização, transações e retries; testes web para preferências/apresentação e E2E de criação, comandos, resposta perdida, retomada e bloqueio de Croins. Comandos em [Validação](backend-architecture.md#validação). Não preservar testes exclusivos de formatos descartados ao substituir persistência.
