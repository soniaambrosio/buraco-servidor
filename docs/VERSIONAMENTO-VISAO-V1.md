# Versionamento da visão autoritativa — V1

Todo evento `estado` passa a carregar um par que permite ao cliente **ordenar e
deduplicar** o que chega pelo fio: uma versão monotônica do estado autoritativo
e um identificador opaco de emissão.

- Branch: `claude/versionamento-visao-autoritativa-v1`
- Base: `claude/produtor-encerramento-autoritativo-v1` @ `16a692b`
- Nenhum deploy, nenhuma mudança no aplicativo Flutter, nenhuma regra de jogo
  tocada.

---

## 1. O que faltava

O evento `estado` saía assim:

```json
{ "tipo": "estado", "visao": { } }
```

Sem nenhuma marca de emissão. Três consequências, todas do lado do cliente:

- duas visões idênticas no fio eram **indistinguíveis** de uma visão repetida;
- uma visão **atrasada** (reenvio, reconexão, corrida entre conexões) chegava
  sem nada que permitisse recusá-la;
- o cliente Dart já tinha uma heurística de *"este estado pode substituir o
  anterior?"* (`app/lib/casca/mesa_online/estado_mesa_online.dart`) — sem base
  formal nenhuma para decidir.

Agora sai assim:

```json
{ "tipo": "estado", "visao": { }, "versaoEstado": 7, "eventoId": "…" }
```

## 2. Contrato

### `versaoEstado`

| Regra | Como é garantida |
|---|---|
| inteiro seguro, não negativo | contador em memória, só `+1` |
| monotônico na instância da partida | monotônico na **sala inteira** — nunca reinicia, nem na revanche |
| atribuído pelo servidor | nenhum caminho lê `msg.versaoEstado` |
| `+1` por mutação autoritativa consolidada | a impressão do estado decide (§4) |
| serialização não incrementa | carimbo idempotente: sem mudança, mesmo par |
| reconexão / troca de assinante não incrementa | entrar na sala não muta a sala |
| geração das quatro visões não incrementa | o laço do broadcast é síncrono |
| comando recusado não incrementa | estado igual ⇒ impressão igual |
| reenvio reutiliza a versão vigente | idem |

`0` é reservado para **"não há estado autoritativo"**. Mesa viva nunca emite
zero: o primeiro carimbo já entrega `1`.

### `eventoId`

`crypto.randomUUID()`. Opaco, sorteado — **não derivado** da versão, da partida
nem de nada do estado.

| Regra | Como é garantida |
|---|---|
| estável para aquela versão | só é re-sorteado quando a versão avança |
| igual em todas as visões da mesma mutação | é da sala, não do destinatário |
| reutilizado no reenvio | idem |
| nunca reutilizado para outra mutação | UUID v4 |
| não colide entre partidas, mesmo com `versaoEstado` igual | idem — e é o caso que VER-17 exercita de propósito |
| não carrega uid, token, carta nem mão | é sorteado, não calculado |

Sendo sorteado, **não é parseável**. Id derivado convidaria o cliente a ler
dentro dele, e aí o formato viraria contrato.

### Onde os campos moram

São **irmãos** de `visao`, não filhos. `visao` é o recorte que o papel autoriza;
a versão é da mesa e igual para todos os papéis. Dentro da visão, o par passaria
pela lista de permissão do espectador e sumiria justamente para quem mais
precisa dele — quem assiste não tem outra forma de ordenar o fluxo.

## 3. Onde a versão é atribuída

Ponto único: **`carimbarEstado(sala)`**, no módulo `salas`.

```
mutação consolidada
        ↓
carimbarEstado  ← chamado por visaoPara, a porta única de projeção
        ↓
(versaoEstado, eventoId)
        ↓
visões dos assentos e dos espectadores  ← todas com o MESMO par
```

- **Atômico** porque é síncrono: o Node roda uma linha de execução, e entre ler
  a impressão e gravar o carimbo não existe ponto de suspensão. Duas conexões
  não conseguem carimbar em paralelo nem produzir versão regressiva.
- **Idempotente**: chamar de novo sem mutação no meio devolve o mesmo par. É o
  que faz as quatro visões saírem carimbadas igual, e o que faz reenvio e
  reconexão reaproveitarem a versão vigente.
- **Único escritor**: `metadadosDe` só lê; o despachante e o transporte não
  atribuem nada. Fixado por teste estrutural (VER-21).

## 4. Por que impressão de estado, e não um contador nos pontos de mutação

Esta é a decisão central da OS, e ela merece o registro.

Um contador exigiria um `++` em cada lugar que muta a mesa. **Esses lugares não
são um só**: `entrarMesa`, `iniciarPartida`, `aplicarJogada`, `avancarBots`,
`jogarUmBot`, `sair`, `liquidar` — e ainda `afkBot`/`afkVoltar`, que mexem em
`sala.jogo.assentos[i].tipo` de dentro do **despachante**, fora do gerenciador.

Esquecer um `++` produziria o pior defeito possível: **estado novo emitido com a
versão velha**, que o cliente descartaria como repetido. Silencioso, e nenhum
teste de regra o pegaria.

A impressão inverte o risco. Ela pergunta ao próprio estado se ele mudou:

- cobre de graça as mutações feitas **fora** do gerenciador (VER-24);
- cobre as que alguém escrever amanhã, sem registro manual (VER-23);
- falha para o lado **seguro** — incrementa a mais, nunca a menos. O cliente
  reprocessa uma visão que já tinha, em vez de descartar uma visão nova.

E acerta um caso que o contador erraria: **uma jogada recusada pode mudar o
estado**. O foul de abertura vulnerável devolve as cartas à mão, e
`aplicarJogada` retransmite antes de responder o erro. Contar "comandos
aceitos" daria a mesma versão a dois estados diferentes.

### O que fica fora da impressão

Só dois grupos, e a lista está fixada por teste (VER-23):

| Campo | Por quê |
|---|---|
| `versaoEstado`, `eventoId`, `impressaoEstado` | é o próprio carimbo — incluí-lo faria a versão avançar a cada leitura, para sempre |
| `fimEmitido` | escrituração de emissão: registra que a **notificação** `fim` saiu, não que a partida mudou |

`fimEmitido` foi encontrado pela matriz de testes. Ele é gravado *depois* do
broadcast do encerramento, então o próximo reenvio do mesmo estado aparecia como
versão nova. O estado do encerramento em si — `liquidada`, `resumoFinal`,
`envelopeEncerramento` — é gravado por `liquidar` **antes** do broadcast e
continua versionando normalmente.

`log` entra pela **contagem**, não pelo conteúdo: ele só cresce, nunca é
reescrito, e serializá-lo inteiro custaria proporcionalmente ao tamanho da
partida sem detectar nada que o tamanho já não detecte.

## 5. Comportamento por situação

| Situação | Versão | `eventoId` |
|---|---|---|
| primeira visão da mesa | `1` | novo |
| jogada válida | `+1` | novo |
| jogada fora do turno / malformada / tipo desconhecido | **inalterada** | reaproveitado |
| jogada recusada **que mudou o estado** (foul vulnerável) | `+1` | novo |
| broadcast para 4 assentos + espectadores | `+1` **no total** | um só, igual para todos |
| reenvio do mesmo estado | inalterada | reaproveitado |
| entrar para assistir / reconectar sem assento | inalterada | reaproveitado |
| falha de autenticação | inalterada | — (não recebe estado) |
| `afkBot` / `afkVoltar` | `+1` | novo |
| encerramento da partida | `+1` | novo |
| evento `fim` | inalterada | reaproveitado |
| outra mesa muta | inalterada | reaproveitado |
| partida nova (outra sala) | contador próprio | jamais colide |

Reconexão merece nota: este servidor **não tem retomada de assento**
(`entrarMesa` recusa partida começada). Quem cai e volta entra pelo caminho de
espectador, que não muta a sala — por isso a reconexão não cria versão
artificial. Se um dia existir retomada de assento, ela *será* uma mutação e
*deverá* versionar.

## 6. Compatibilidade

- Nenhum campo removido ou renomeado.
- `PROTOCOLO_MINIMO` e `PROTOCOLO_ATUAL` **inalterados**.
- Nenhum campo novo exigido do cliente.
- Clientes que ignoram os campos continuam funcionando: `app.html` despacha por
  cadeia de `if (m.tipo === …)` e o leitor Dart consome apenas o sub-mapa
  `visao`. Campos irmãos não os alcançam.
- **181 testes verdes**, dos quais 157 preexistentes.

## 7. Riscos residuais

1. **`versaoEstadoFinal` no envelope de encerramento é outra coisa.** Ele já
   existia, vale `jogo.rodada`, e o nome colide com o conceito criado aqui. Não
   foi tocado — mudá-lo alteraria o contrato do encerramento, que esta OS proíbe.
   Quem for consumir os dois precisa saber que **não são o mesmo número**.
2. **Custo da impressão.** A impressão serializa o estado da sala a cada
   emissão, e o broadcast a calcula uma vez por destinatário (4–5 vezes por
   mutação). Para uma mesa de Buraco isso é da ordem de poucos KB e é
   irrelevante na escala atual. Se um dia pesar, o caminho é calcular uma vez
   por broadcast em vez de uma por conexão — sem mudar o contrato.
3. **A versão não é persistida.** Ela vive em memória, com a sala. Reinício do
   processo perde a sala inteira, então não há caso em que a versão volte atrás
   para um cliente que ainda tenha aquela sala.
4. **O cliente ainda não usa o par.** Esta OS entrega o lado do servidor. Fazer
   o Flutter recusar visão antiga é trabalho de outra OS — e é explicitamente
   proibido aqui.

## 8. Matriz de testes

`test/versao.test.js` — 24 provas, cinco eixos.

| Eixo | Provas |
|---|---|
| CONTRATO | VER-01 campos presentes · VER-02 inteiro seguro e não negativo · VER-03 id opaco e não derivado |
| MUTAÇÃO | VER-04 uma mutação, um incremento · VER-05 fora do turno não incrementa · VER-06 comando malformado não incrementa · VER-07 reenvio reutiliza o par · VER-08 reconexão sem versão artificial · VER-09 mutações sucessivas crescem com ids distintos · VER-10 falha de auth não versiona · VER-11 nunca regride, e versão↔id é bijeção |
| COERÊNCIA | VER-12 quatro visões, mesmo par · VER-13 quatro visões, um incremento · VER-14 espectador com o mesmo par · VER-15 duas conexões não concorrem · VER-16 encerramento e produtor de conquista no mesmo evento |
| ISOLAMENTO | VER-17 partidas distintas com a mesma versão não colidem · VER-18 mesa não anda por causa de outra · VER-19 metadados não vazam uid, token, carta nem mão |
| ESTRUTURA | VER-20 nenhuma conexão tem contador próprio · VER-21 escrita só em `carimbarEstado` · VER-22 evento `estado` montado num lugar só · VER-23 lista de exclusão fixada · VER-24 mutação de fora do gerenciador versiona |

### Prova de que a matriz morde

Dois defeitos injetados de propósito, e revertidos:

| Defeito injetado | Testes que caíram |
|---|---|
| contador por conexão (`c._v++`) | 7 — VER-05, 07, 08, 12, 14, 15, 16 |
| carimbo avança a cada serialização | 12 — VER-03 a 08, 12 a 16, 23 |

O primeiro é exatamente o que os testes estruturais existem para impedir.
