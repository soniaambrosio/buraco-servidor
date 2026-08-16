# Homologação — Conquista canônica "Primeira Batida Real" v1

Homologação independente do produtor autoritativo de encerramento, na pergunta
específica: **o assento que bateu de verdade chega ao envelope, uma vez só, e
sem premiar quem não bateu?**

| | |
|---|---|
| Candidata | `claude/produtor-encerramento-autoritativo-v1` @ `16a692bbe95597536b3f9975ecf32e1bde58ebcb` |
| Base / ancestral | `integracao/ws-auth-visao-espectador-v1` @ `8cd14c6bc1bc984c3fa1eb8ca742c869fbb79092` |
| Branch | `homologacao/primeira-batida-real-v1` |
| Veredito | **PASS** — nenhuma correção de produção foi necessária |

O código da candidata passou. O que **não** passou foi a *prova* de um dos
caminhos: ver "O buraco de evidência", abaixo.

---

## Os dois caminhos de encerramento

O motor encerra rodada em três lugares, e só dois são batida:

| # | Origem | Chamada | Autoria |
|---|---|---|---|
| 1 | `descartar` — batida final no descarte | `encerrarRodada(jogo, dupla, assento)` | assento de quem descartou |
| 2 | `aoZerarMaoBaixando` — batida direta, a mão zerou baixando ou estendendo | `encerrarRodada(jogo, dupla, assento)` | assento de quem baixou |
| 3 | `encerrarRodadaPorEsgotamento` | `encerrarRodada(jogo, null)` | nenhuma — não houve batida |

O caminho 2 tem **dois gatilhos** (`baixar` e `estender`), e ambos desembocam em
`aoZerarMaoBaixando`.

Nos dois caminhos de batida, o `assento` já estava em escopo antes da entrega e
era descartado na chamada. A autoria é **prova de legalidade** e não só de
identidade: só se chega ali depois de `duplaPodeBater` e depois de esgotado o
morto da dupla.

---

## O buraco de evidência (o achado desta homologação)

`BAT-01`, na suíte da candidata, **não é um teste de comportamento**. Ele lê o
`server.js` como texto e conta ocorrências de
`encerrarRodada(jogo, dupla, assento)` por expressão regular.

Isso prova que a chamada tem três argumentos. **Não** prova que a autoria chegue
ao envelope, nem que o assento seja o certo. Com ele sozinho, o caminho da
batida direta — o caminho 2 inteiro, os dois gatilhos — não tinha nenhuma
execução real em teste algum.

A medição por mutação mostra o tamanho do buraco. Removendo o assento da batida
direta (`encerrarRodada(jogo, dupla)`, o comportamento anterior à entrega):

| Suíte | Falhas detectadas |
|---|---|
| `produtor.test.js` (candidata) | **1** — e só a varredura de texto |
| `homologacao_batida.test.js` (esta) | **7**, por comportamento |

Uma varredura de texto morre no primeiro refactor que preserve a forma da
chamada e quebre o valor — renomear a variável, reatribuí-la antes, extrair um
helper. Por isso o caminho 2 foi coberto por execução real, nos quatro assentos,
pelos dois gatilhos, até o `uidQueBateuFinal` do envelope.

`BAT-01` foi **mantido**: como tripwire de forma ele é barato e útil. O que
mudou é que ele deixou de ser a única prova.

---

## Cobertura acrescentada

`test/homologacao_batida.test.js` — 17 casos, fechando os itens da matriz sem
cobertura:

- **HML/BATIDA-DIRETA** (`HB-01`…`HB-05`) — batida ao baixar e ao estender, nos
  quatro assentos; a que cruza a meta grava o assento final; zerar a mão com
  morto disponível pega o morto e **não** é batida; e o percurso ponta a ponta,
  da mesa autenticada até o UID no envelope.
- **HML/AUTORIA** (`HB-06`…`HB-09`) — o parceiro de dupla não é creditado;
  adversário e espectador tampouco; sair da mesa depois do encerramento não
  troca a autoria; liquidação repetida não reescreve nem duplica.
- **HML/IDEMPOTÊNCIA** (`HB-10`…`HB-12`) — replay da mesma jogada, reconexão do
  mesmo UID e duas partidas distintas.
- **HML/ORDEM** (`HB-13`, `HB-14`) — partida em curso não deixa evento, e todo
  evento da outbox tem partida encerrada correspondente.
- **HML/CONTRATO** (`HB-15`…`HB-17`) — o envelope basta para a "Última
  Conquista" sem consultar a mesa; não carrega credencial nem dado privado; e a
  armadilha abaixo.

### Armadilha do contrato, fixada em `HB-17`

`validaParaConquistas` responde **"esta partida conta?"**, não **"houve
batida?"**. Uma partida encerrada por esgotamento é elegível — contou, teve
vencedor — e mesmo assim **não tem autor**.

Quem for conceder a "Primeira Batida Real" precisa exigir as duas coisas:

```
validaParaConquistas === true   E   uidQueBateuFinal !== null
```

Ler só a primeira concederia uma conquista de batida numa partida em que
ninguém bateu.

### Uma suposição que o teste não pode fazer

`entrarMesa` preenche os assentos na ordem `[2, 1, 3]` depois do criador, para
separar as duplas. Logo **`uid-N` não senta no assento `N`**. Supor a identidade
faz o teste acusar o produtor de trocar autoria quando quem trocou foi o teste —
aconteceu na primeira rodada desta homologação. O UID vem do mapa congelado da
própria partida, e conferi-lo contra o envelope é justamente a pergunta em jogo.

---

## Regras do Buraco: intocadas

O delta no motor são cinco pontos, todos de transporte do assento:
`criarJogo` (campo novo), `distribuirRodada` (zera o campo por rodada),
`aoZerarMaoBaixando` e `descartar` (passam o assento) e `encerrarRodada`
(parâmetro novo + duas atribuições).

Nenhuma função de regra foi alterada — verificado uma a uma no delta:
`duplaPodeBater`, `duplaTemCanastraLimpa`, `contarPontos`, `valorCarta`,
`validarJogoMesa`, `validarSequencia`, `comprarMonte`, `comprarLixo`,
`minimoParaDescer`, `baixadaTravaria`, `podeBatidaFinal`, `estender`.

---

## Pendências que não são desta OS

Nenhuma bloqueia o PASS. As duas primeiras são do **transporte**, que ainda não
existe:

1. **Falha de escrita na outbox não é reprocessada.** `sala.liquidada` é travado
   *antes* de `produzirEncerramento`, então um erro de disco faz o envelope
   sobreviver só em memória (`sala.envelopeEncerramento`), sem nova tentativa. O
   comentário no código diz "o evento continua devendo", mas não há mecanismo
   que o torne devido de novo. Hoje é inofensivo — ninguém consome a outbox.
2. **`pendentes()` lista todo `.json` do diretório**, sem olhar `estado`. Quando
   o transporte começar a gravar `entregue`, vai super-relatar.
3. **`jogadorId` aparece na visão do espectador.** É anterior a esta entrega —
   é como a visão pública desenha o avatar de cada assento — e não é campo do
   produtor. Registrado para não ser confundido com vazamento do envelope, que
   não ocorre.

---

## Execução

```
npm run check                    # node --check server.js
npm test                         # 174 casos, 21 suítes, 0 falhas, 0 pulados
```

174 = 157 da candidata + 17 desta homologação. Suíte estável em execuções
repetidas, e cada arquivo passa isolado — não há dependência de ordem.
