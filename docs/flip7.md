# Flip 7

## Escopo

Jogo em `/jogos/flip7`, de 2 a 12 participantes, com pessoas no mesmo dispositivo e bots opcionais. Conta conectada ocupa o primeiro lugar; sem sessão, iniciar abre o login. Não há salas online. Só partidas livres estão habilitadas: início e retomada com Croins estão bloqueados até a integração econômica da API. Pontos não viram Croins nem atualizam rankings/conquistas.

O motor é local, puro e determinístico a partir da seed; não é autoridade para a carteira. Snapshots e formatos antigos são descartáveis, sem obrigação de migração. Direção de integração em [Próximas integrações](backend-architecture.md#próximas-integrações).

## Mapa do código

Caminhos relativos a `apps/web/features/games/flip7`:

| Arquivo | Responsabilidade |
| --- | --- |
| `types.ts`, `rules.ts` | Estado, baralhos, pontuação e nomes |
| `engine.ts`, `vengeance.ts` | Transições, ações e decisões dos bots |
| `match-storage.ts`, `setup-storage.ts` | Partidas por código e preferências locais |
| `flip7-game.tsx`, `action-presentation.ts` | Configuração, mesa, histórico e coordenação visual |
| `flip7-loader.tsx` | Carregamento dinâmico restrito à página do jogo |
| `match-actions.ts`, `wager.ts` | Escritas protegidas das partidas livres e regras puras de validação/rateio; sem carteira local |

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

- Cada partida tem código de 12 caracteres e URL `?partida=CODIGO`, válido somente neste navegador/origem. `croebet:flip7:match` guarda a coleção; validar estrutura, alvos e conservação do baralho antes de retomar.
- Salvar estado antes da animação/jogada apresentada para evitar compra repetida no reload. Persistir escolhas de ação e automações pendentes; prévia de troca é visual e pode ser refeita após recarregar.
- Configuração continua disponível enquanto existem partidas; lista só as não finalizadas. Navegar/recarregar preserva partidas. Abandonar remove apenas o código escolhido e volta à configuração do Flip 7.
- Jogar novamente volta à configuração e mantém resultado/classificação na URL da partida finalizada. Retomar fim abre novamente o resultado; fechar o diálogo permite consultar a mesa.
- Preferências em `croebet:flip7:setup`: modalidade, Brutal e quantidade de lugares; sem nomes/tipos. Fallback: Clássico, dois lugares, sem Brutal. Reduzir/aumentar lugares na configuração preserva participantes temporariamente ocultos; todos os lugares selecionados devem estar preenchidos.

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
- Testes atuais: `apps/web/tests/flip7*.test.mjs` para motor, conservação, bots, retomada e apresentação; `apps/web/tests/e2e/flip7*.spec.ts` para configuração/interação/reload e bloqueio de Croins. Comandos em [Validação](backend-architecture.md#validação). Não preservar testes exclusivos de formatos descartados ao substituir persistência.
