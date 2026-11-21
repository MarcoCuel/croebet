# Croebet — Conceito, identidade e direção do projeto

> Documento de referência para produto, design e conteúdo.
> Referência de **produto, identidade, linguagem, moeda e direção das funcionalidades**, revisada em 19 de novembro de 2026.
> Consulte apenas o assunto da tarefa: seções 3–4 (conta, escopo e economia), 5–8 (marca e textos), 9 (conteúdo), 10–11 (futuro e questões abertas). Estado técnico e ambiente em [docs/backend-architecture.md](docs/backend-architecture.md); convenções em [AGENTS.md](AGENTS.md).

## 1. Resumo do projeto

A **Croebet** é uma plataforma de jogos e apostas fictícias, criada pela comunidade da streamer **Croezinha**. Nasceu de uma piada: a streamer era contra as bets, mas a comunidade passou a brincar que ela tinha sua própria casa de apostas e jogava nela. A piada cresceu, a Croezinha entrou na brincadeira e, dentro desse universo, virou a dona da Croebet.

Apesar da origem satírica, a plataforma deve **funcionar de verdade**: ter jogos jogáveis, apostas organizadas, saldos, rankings e sistemas de participação. A diferença fundamental é que tudo acontece com **Croins**, uma moeda fictícia, sem apostas ou perdas de dinheiro real.

**Síntese:** uma casa de apostas de mentira, com jogos de verdade, criada por uma comunidade que levou uma piada longe demais.

## 2. Propósito e proposta

- Oferecer entretenimento e competição para a comunidade da Croezinha.
- Reproduzir a experiência de uma plataforma de cassino/apostas, **sem depósitos nem perdas de dinheiro real**.
- Permitir que as pessoas joguem, apostem, ganhem, percam e disputem posições usando Croins.
- Dar vida à piada de uma “bet” administrada por uma casa descaradamente gananciosa.
- Construir um espaço comunitário que seja divertido e funcional, e não apenas uma página de piadas.

A crítica não é necessariamente aos jogos de azar em si: o ponto principal é o **vício em apostas e o prejuízo que a perda de dinheiro real pode causar**. Na Croebet, as moedas não têm valor monetário.

## 3. Público e acesso

- Público principal: quem acompanha ou participa das lives da Croezinha.
- O cadastro não é fechado: qualquer pessoa pode participar. Solicita apenas nome de usuário e senha, sem e-mail. Depois, o onboarding pede Nome e foto; enquanto faltar um deles, volta a aparecer. “Agora não” ou fechar adia por 12 horas, com prazo persistido na conta.
- Nome de exibição e nome de usuário são distintos: o nome aparece publicamente e pode se repetir; o usuário é único, identifica a conta no login e nos endereços de perfil. O usuário mantém as letras maiúsculas e minúsculas escolhidas no cadastro, mas o login e a disponibilidade do usuário não distinguem essa diferença: `Tonho`, `tonho` e `TONHO` identificam a mesma conta.
- A primeira alteração de usuário é livre; após cada alteração bem-sucedida, a próxima fica disponível 30 dias depois. Trocar somente maiúsculas e minúsculas também conta. O nome de exibição continua independente desse prazo.
- Exclusão pelo admin inativa a conta imediatamente e agenda a remoção permanente para 30 dias depois. Reativar pelo status nesse período cancela a exclusão. Históricos de partidas, movimentações e auditoria permanecem preservados. O último administrador ativo não pode ser excluído.
- A linguagem e as referências podem ter piadas internas da comunidade, mas a navegação e as regras precisam ser compreensíveis para quem chega pela primeira vez.
- A plataforma tem identidade própria; não precisa colocar o rosto, o nome ou as falas da streamer em todo lugar. O nome **Croebet** já faz a conexão.

## 4. Funcionamento da plataforma

O projeto está em operação, com usuários reais; contas, saldos, partidas e demais registros devem ser preservados. Mudanças exigem migrations incrementais, sem reset de bases reais. As regras aprovadas abaixo orientam o produto, mas recursos futuros não devem ser apresentados como disponíveis. A implementação existente está resumida em [Estado atual](docs/backend-architecture.md#estado-atual).

### 4.1. Jogos

O primeiro jogo é o **Flip 7**, gratuito ou com Croins, com motor e partidas persistidos no servidor e lobbies públicos entre usuários da Croebet. O **Love Letter** também está implementado, disponível somente no modo de desenvolvimento, sem Croins nem replay. Os dois usam a [base compartilhada dos jogos](docs/backend-architecture.md#base-compartilhada-dos-jogos); regras e capacidades pertencem a cada módulo. O catálogo é gerenciado pelo administrador, mas cadastrar um jogo não instala seu código.

Cada conta pode participar de vários lobbies e manter uma criação própria normal por jogo, considerando salas abertas e partidas em andamento. Ao iniciar uma partida normal, suas participações e reservas nos outros lobbies do mesmo jogo são removidas; salas de jogos diferentes são preservadas. É possível jogar jogos diferentes simultaneamente. Testes de desenvolvimento não entram nesse limite. Mesas normais iniciadas aceitam espectadores, inclusive visitantes, sem ocupar vagas ou controlar decisões. Presença acompanha a conta pelo site; navegar para outra página não abandona a partida. Lobbies têm [prazos de ausência e expiração](docs/backend-architecture.md#expiração-de-lobbies); partidas iniciadas aguardam decisões humanas indefinidamente. Timeout de turno ou substituição automática por ausência ainda exigem definição.

No Flip 7 normal, salas têm limite de 2 a 12 pessoas e podem iniciar com apenas duas. O host pode alterar versão, modo e capacidade antes do início e expulsar participantes no lobby ou durante o jogo. Abandono ou expulsão durante a partida transfere a vaga para um bot. O host pode ativar entrada em Croins com aceites do valor, cobrança conjunta no início e prêmio sem taxa aos vencedores. Prêmios de vagas assumidas por bots vão para a casa. Regras, apresentação e detalhes econômicos estão em [docs/flip7.md](docs/flip7.md).

Haverá outros jogos funcionais, com identidade visual e referências próprias da comunidade. Exemplos previstos:

- Caça-níqueis;
- Roleta;
- Blackjack;
- Outros jogos a definir.

A lista é indicativa; não significa que todos já estejam implementados.

### 4.2. Apostas

As apostas em eventos ficam fora da primeira versão e estão temporariamente desabilitadas para o público. O menu exibe “Em breve”, a home apresenta apenas jogos e o acesso direto a `/apostas` redireciona ao início. A implementação administrativa permanece disponível para preparação e futura reativação.

Além dos jogos de cassino, haverá uma área de **apostas em acontecimentos ou eventos**. As apostas poderão envolver situações da comunidade, lives e outros temas escolhidos pelos responsáveis.

- Criação e gerenciamento das apostas: comunidade, organizadores e moderadores, de acordo com as permissões que vierem a ser definidas.
- Os usuários fazem suas apostas com Croins.
- O catálogo administrativo já é persistido pelo backend e começa vazio. Palpites, apuração e pagamentos ainda não estão integrados; as regras abaixo orientam essa futura implementação.

#### Regras aprovadas para a futura operação das apostas

- Apostas passam por rascunho, abertura, pausa, encerramento, apuração e pagamento. Cancelamentos devolvem os Croins após confirmação da liquidação.
- O total apostado é rateado entre os palpites vencedores proporcionalmente ao valor apostado, sem taxa da casa e incluindo a aposta inicial no crédito. Sobras de arredondamento são distribuídas de maneira determinística.
- Para apostas numéricas, vale o acerto exato. Sem vencedores, os participantes recebem de volta o valor apostado.
- Regras e opções não mudam após o primeiro palpite. Encerrar entradas, definir resultado e pagar são etapas distintas; apuração e pagamentos precisam ser verificáveis e não podem gerar créditos duplicados.
- O código local antigo de liquidação é apenas referência. Não preservar nem importar seus palpites ou carteiras; a operação futura será autorizada e transacional no backend.

### 4.3. Croins: economia fictícia

**Croin** é a moeda virtual da Croebet; **Croins** é o plural.

Formas de obter Croins previstas:

1. Saldo inicial ao criar uma conta;
2. Bônus diário;
3. Cupons distribuídos nas lives e possivelmente em outros canais;
4. Ganhos nos jogos e nas apostas.

Quando o usuário perde todos os Croins, deverá **aguardar o próximo bônus diário** ou conseguir **um cupom válido**, caso exista. Não há reposição instantânea garantida.

**Princípio inegociável da proposta atual:** Croins são fictícios; não representam dinheiro, não são comprados por depósito e não podem ser sacados como dinheiro real.

Valores iniciais aprovados em 19 de novembro de 2026:

- Ao criar uma conta: **30 Croins**, registrados como bônus de cadastro.
- Resgate diário: **10 Croins uma vez por dia, com liberação à meia-noite no fuso America/Sao_Paulo**, independentemente do saldo. O primeiro resgate fica disponível após o cadastro; não há teto de saldo. Resgatar às 22h permite novo resgate à 1h do dia seguinte.
- Sugestões de aposta: **5, 10, 15, 25 e 50 Croins**, com **5 Croins** como valor padrão. São sugestões, não uma lista obrigatória de valores aceitos.
- Cupons: código definido pelo administrador, valor inteiro positivo escolhido por cupom, sem valor padrão ou tabela fixa. Um resgate por conta, limite global opcional, pausa e início/término opcionais; sem datas, validade indefinida. Edições não alteram os valores já concedidos.

As configurações são centralizadas no backend. Cadastro e resgate devem creditar a carteira e gerar movimentações auditáveis na mesma transação. Probabilidades e demais aspectos de balanceamento continuam sujeitos a definição.

### 4.4. Rankings e gamificação

Rankings estão disponíveis publicamente em `/rankings`: Vitórias no Flip 7, Mais ricos pelo saldo atual e Maiores perdedores pelo prejuízo líquido de partidas liquidadas. Vitórias e perdas têm filtros independentes de mês atual/geral, no fuso de Brasília; saldo é sempre atual. Conquistas ficam disponíveis em `/conquistas` para contas autenticadas, com acesso pelo menu somente quando logadas.

Vitórias usam partidas finalizadas, incluindo empates; vagas assumidas por bots não dão vitória à conta original. Perdas somam entradas menos prêmios efetivamente recebidos, incluindo entradas de vagas abandonadas e potes destinados à casa; pendências e devoluções ficam fora. Bônus, cupons e ajustes administrativos só afetam Mais ricos. Contas suspensas, excluídas ou com exclusão agendada não aparecem; seus históricos permanecem preservados. Empates na métrica compartilham posição, com ordem estável por usuário. A página preserva os cards com pódio e lista, pagina dez contas por card e apresenta a própria posição mesmo fora da página.

Conquistas preservam os cards com emblema, níveis e progresso do desenho original. O catálogo inicial inclui Só mais uma (partidas concluídas: 1/25/100), Foi habilidade (vitórias: 1/10/50), Presença marcada (dias distintos de bônus: 3/15/50), Volto amanhã (maior sequência de bônus: 3/7/30), Cupom não é salário (resgates: 1/5/20) e A casa agradece (partidas com prejuízo: 1/10/50). Metas são acumuladas, sem temporada nem recompensa automática em Croins. Apenas partidas finalizadas com controle humano no resultado contam como concluídas/vitórias; empates dão vitória. Prejuízo por partida desconta o prêmio efetivamente recebido e exclui pendências/devoluções. Sequências usam o calendário de Brasília e preservam o maior recorde mesmo após interrupção.

Admin → Conquistas gerencia nome, ícone, critério entre as métricas implementadas, status, ordem e níveis com metas crescentes, sem quantidade fixa. Cada nível tem identidade própria. Desbloqueios são persistidos e não revogados por edições: alterar metas ou remover níveis conquistados e mudar o critério quando há concessões ficam bloqueados; textos e novos níveis continuam editáveis. Desativar oculta o card e pausa novas concessões, preservando os desbloqueios. Ao consultar a página, a API concilia o histórico disponível e registra os níveis alcançados; a data registrada é a de reconhecimento, sem inventar a data original de feitos anteriores. Conquistas especiais por ações do Flip 7 continuam futuras.

A competição é parte importante da experiência:

- Ranking de maiores ganhadores;
- Ranking de maiores perdedores;
- Estatísticas de desempenho;
- Emblemas, conquistas e outras mecânicas de gamificação.

O ranking de perdedores pode ser uma das principais fontes de humor — os jogadores podem ser reconhecidos por perder feio, sem serem atacados pessoalmente.

## 5. Personalidade da marca

A Croebet **fala como se fosse uma casa de apostas real, inescrupulosa e muito satisfeita em ficar com os Croins dos jogadores**. Ela é a vilã da própria história.

A casa:

- Torce pelas derrotas dos apostadores;
- Trata vitórias como um inconveniente — às vezes os jogadores ganham, mas não devem se acostumar;
- Comemora quando o usuário perde Croins;
- Oferece bônus como se fosse uma oportunidade generosa de perder tudo novamente;
- Demonstra confiança exagerada e nenhuma vergonha de suas intenções.

Tudo isso é **uma personagem satírica**, não uma justificativa para mecânicas manipuladas. Os jogos e as regras devem funcionar de maneira correta, clara e consistente.

### 5.1. Tom de voz

- **Ácido:** ironia, sarcasmo e provocações inteligentes.
- **Descarado:** a casa admite que quer os Croins dos jogadores.
- **Divertido:** a piada deve aproximar a comunidade, não criar hostilidade.
- **Direto:** títulos e descrições curtos, fáceis de entender.
- **Confiante:** comunicação de uma bet estabelecida, sem parecer um texto corporativo genérico.

### 5.2. Limites do humor

**Pode:** zoar a sorte, as derrotas, os palpites ruins, o excesso de confiança e a “ganância” da casa.

**Evitar:** insultos pessoais, humilhação genuína, preconceito, ataques a características de pessoas ou piadas que façam alguém se sentir excluído.

A regra é **rir junto dos jogadores — mesmo quando a casa está rindo da derrota deles**.

### 5.3. Misticismo e tarô

A Croezinha gosta de tarô e de temas místicos. Esse universo pode aparecer em nomes de jogos, emblemas, eventos, cartas, frases e momentos especiais.

Porém, o misticismo é **uma referência secundária**. A piada principal sempre será a casa de apostas gananciosa. Não transformar toda a marca em um produto de astrologia, tarô ou esoterismo.

## 6. Identidade visual e experiência

- A fonte padrão da plataforma é **Inter**.
- A cor principal da marca é **`#AD158F`**. A implementação técnica utiliza os tokens do design system, conforme o `AGENTS.md`.
- O site deve parecer uma plataforma de jogos e apostas legítima em sua **organização e funcionamento**.
- A aparência deve ser **simples, clara e bem resolvida**; não é necessário copiar a complexidade de grandes casas de apostas.
- Humor aparece de forma pontual e bem posicionada, sem transformar cada botão ou texto em uma piada.
- Componentes funcionais, navegação intuitiva e regras transparentes têm prioridade sobre efeitos decorativos.
- A comunidade pode influenciar a identidade de jogos, eventos, conquistas e conteúdos.

**Direção de linguagem:** use apenas **Croin/Croins** na interface, nos metadados e nos textos públicos. Não repita avisos como “moeda fictícia”, “sem valor monetário” ou “dinheiro de mentira” nas páginas, nos jogos, nas apostas ou no saldo. O caráter satírico e a origem da plataforma podem ser apresentados na página **Sobre**, com a personalidade da marca. Essa orientação de texto não altera as regras da economia descritas neste documento.

## 7. Diretrizes para textos e microcopy

### Fazer

- Apresentar primeiro **o que o usuário consegue fazer**: jogar, apostar, ganhar Croins e competir.
- Usar frases provocativas sem sacrificar a compreensão.
- Escrever do ponto de vista de uma casa que quer ganhar sempre.
- Variar as piadas; nem toda mensagem precisa falar que “a casa sempre ganha”.
- Dar personalidade a estados reais do produto: vitória, derrota, saldo zerado, bônus diário, rankings e conquistas.
- Manter CTAs objetivos: **Explorar jogos**, **Ver apostas**, **Jogar**, **Resgatar bônus**.

### Evitar

- “Bem-vindo à Croebet” ou simplesmente repetir o nome da marca como título da hero.
- Frases de efeito sem explicar o que é a plataforma.
- Textos genéricos sobre “emoção”, “experiências incríveis” ou “diversão sem limites”.
- Repetição excessiva de tarô, destino e misticismo.
- Dizer ou sugerir que Croins são dinheiro real.
- Prometer funcionalidades ainda não disponíveis como se já estivessem lançadas.
- Promessas enganosas sobre chances, resultados ou prêmios.

## 8. Exemplos de linguagem (referências, não textos obrigatórios)

Exemplos de tom, não um catálogo de recursos disponíveis. Ajuste-os ao escopo atual e à orientação da seção 6: referências explícitas a dinheiro fictício pertencem ao contexto editorial do Sobre, sem avisos repetidos nos fluxos.

### Hero — direção editorial

O título deve apresentar a Croebet como uma casa de apostas com atitude; não começar com “Bem-vindo” e não depender do nome da marca, que já aparece na identidade visual.

**Exemplo de título:**

> A casa de apostas mais sem vergonha do Brasil.

**Exemplo de descrição:**

> Jogos de cassino, apostas da comunidade e uma moeda que não vale absolutamente nada. Ganhe Croins, perca tudo e volte amanhã para tentar de novo. A casa agradece.

**Botões:** `Explorar jogos` (primário) e `Ver apostas` (secundário).

### Destaques da plataforma

**Seu dinheiro não nos interessa**  
Aceitamos apenas Croins. Seu dinheiro de verdade não vale nada aqui. O nosso também não.

**A casa torce contra você**  
Temos roleta, caça-níqueis e blackjack. Você tem esperança. Achamos uma troca justa.

**Até perder merece reconhecimento**  
Dispute rankings, conquiste emblemas e prove que você consegue ser o pior apostador da comunidade.

### Microcopy

- **Vitória:** “Isso não estava nos planos. Nosso departamento financeiro já foi notificado.”
- **Derrota:** “Obrigado pela contribuição. Seus Croins estão em boas mãos. Nas nossas.”
- **Saldo zerado:** “Acabou? Volte amanhã. A casa aceita doações em Croins diariamente.”
- **Bônus diário:** “Sentimos sua falta. Não de você, dos seus Croins.”
- **Ranking de perdas:** “Alguns nasceram para vencer. Esses aqui preferiram financiar a casa.”

A acidez deve ser calibrada conforme o contexto: mensagens de erro e regras precisam ser claras antes de serem engraçadas.

## 9. Páginas e responsabilidades de conteúdo

| Área | Função principal | Direção de linguagem |
| --- | --- | --- |
| Home | Apresentar jogos, apostas e a proposta do site | Apresentação clara com humor ácido |
| Jogos | Listar os jogos disponíveis | Nomes e descrições curtas, personalidade sem atrapalhar a navegação |
| Página do jogo | Permitir jogar e entender suas regras | Interface funcional; humor em resultados e estados |
| Apostas | Listar eventos e permitir apostas em Croins | Situação, regras, prazos e resultado bem identificados |
| Rankings | Dar visibilidade a ganhadores e perdedores | Competitivo e debochado, especialmente no ranking de perdas |
| Conta / saldo | Mostrar Croins, bônus e histórico quando existirem | Transparência em primeiro lugar |
| Sobre | Contar a origem da piada e explicar a plataforma | Mais espaço para humor, contexto e esclarecimento |

## 10. Futuro e possibilidades — ainda não são funcionalidades confirmadas

- Expansão dos jogos;
- Novas conquistas, emblemas e mecânicas comunitárias;
- Eventos sazonais e apostas temáticas;
- Possível troca de Croins por itens físicos, camisetas ou prêmios ligados à streamer.

**Atenção:** qualquer resgate por itens ou prêmios reais exige uma análise específica de regras, transparência, elegibilidade, prevenção de abusos e legislação aplicável. **Não divulgar esse recurso como disponível** antes de decidir se e como será implementado.

## 11. Pontos ainda abertos

- Balanceamento futuro da economia; valores iniciais e cupons já foram definidos na seção 4.3;
- Regras de novos jogos, probabilidades e equilíbrio; Flip 7 já tem regras documentadas;
- Permissões adicionais da moderação; formatos e rateio das apostas seguem a seção 4.2;
- Recuperação de conta sem e-mail; o Flip 7 já permite espectadores e aguarda desconexões sem timeout, com regras econômicas em [Economia](docs/flip7.md#economia);
- Futuras categorias e recompensas dos rankings;
- Novos critérios e conquistas especiais por jogo;
- Política de contas, abuso e múltiplos cadastros;
- Se haverá ou não prêmios reais no futuro e quais requisitos seriam necessários.

Esses pontos não devem ser tratados como decisões tomadas.

---

## 12. Princípio central

> **A Croebet leva os jogos a sério e os apostadores na brincadeira.** A casa quer todos os Croins, os jogadores tentam impedir, e ninguém precisa colocar dinheiro real nisso.

Sempre que surgir uma dúvida sobre texto, funcionalidade ou identidade, verificar se a decisão preserva os três pilares: **jogos funcionais**, **economia inteiramente fictícia** e **humor ácido de comunidade, sem hostilidade real**.
