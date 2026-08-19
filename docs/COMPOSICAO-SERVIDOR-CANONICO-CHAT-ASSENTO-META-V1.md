# Composição canônica do servidor — chat + controlador de assento + meta de partida V1

Laudo da OS 1. Uma folha só, publicável, que preserva ao mesmo tempo a
credencial do motor, o transporte real do chat, o controlador de assento /
ausência / retorno humano, a admissão VIP, a correção do falso positivo de
espectador e a meta canônica 1500 / 2000 / 3000.

Branch: `integracao/servidor-canonico-chat-assento-meta-v1`.
Sem merge em `main`, sem PR, sem deploy, sem alteração de Railway.

---

## 1. Gate Zero

`git ls-remote` duas vezes, resultado idêntico nas duas:

| Ref | SHA |
| --- | --- |
| `controlador/assento-ausencia-retorno-v1` | `388025f07b250e4e283c7d7913fc80f19098aa22` |
| `claude/meta-canonica-partida-v1` | `1d7c0bea303a5066630a57b3527dd4783912c883` |
| `main` | `1828d42ef2c95329e81b439b4939353326c2b036` |

`remote.origin.fetch` é `+refs/heads/*:refs/remotes/origin/*` — refspec inteiro,
então a ancestralidade calculada abaixo não é a de um grafo truncado.

### Ancestralidade

Nenhuma folha contém a outra. E não há **uma** base: há **duas**.

```
git merge-base --all 388025f 1d7c0be
  fd99260  test(espectador): matar o falso positivo de UUID na varredura
  deed131  docs(correcao): laudo do contrato do Secure Token no servidor
```

É um criss-cross: as duas folhas incorporaram as mesmas duas correções por
merges diferentes (`72bc99c` de um lado; `a04b18a` + `99cf718` do outro). Ambas
descendem de `main` `1828d42`.

**Commits exclusivos** (diferença simétrica, não contra uma base escolhida):

| Só em `388025f` (controlador) | Só em `1d7c0be` (meta) |
| --- | --- |
| `388025f` controlador de assento | `1d7c0be` meta autoritativa da mesa |
| `cc8bd15` transporte real do chat | `3016f64` `/versao` — prova do commit implantado |
| `c8ab95c` laudo da união credencial V2 + UUID | `274c50d` mesa privada, aposta fora do cliente |
| `72bc99c` merge credencial V2 + UUID | `99cf718` merge do falso positivo de UUID |
| | `e4bad52` cadeia composta com `project_id` numérico |
| | `a04b18a` merge do contrato do Secure Token |
| | `938c293` adaptador servidor → backend de admissão |
| | `c1c5007` merge gate VIP + credencial renovável |
| | `504d68f` gate autoritativo de entrada VIP/Ranqueada |

Por conteúdo, o lado do controlador acrescenta **chat + controlador**; o lado da
meta acrescenta **gate VIP + admissão VIP + mesa privada + `/versao` + meta**.
Por isso a composição foi construída **sobre `1d7c0be`**, trazendo o outro lado —
é o caminho com a menor superfície de recomposição, não uma escolha de folha.

### Arquivos tocados dos dois lados

`server.js`, `test/ajuda.js`, `test/costura.test.js`,
`test/credencial_motor.test.js` e os dois docs da credencial (idênticos, porque
vêm da base comum `deed131`).

### Suítes das folhas, medidas antes de compor

Extraídas com `git archive` para árvores limpas — nunca dentro do worktree em
edição — e executadas **em série**, porque `test/ws.test.js` liga a porta fixa
8137 e duas execuções simultâneas colidem.

| Folha | Casos | Falhas |
| --- | --- | --- |
| `388025f` controlador | 323 | 0 |
| `1d7c0be` meta | 418 | 0 |
| **composição** | **497** | **0** |

---

## 2. Matriz de invariantes

`invariante → folha produtora → arquivo → teste que prova → destino`

### Chat

| Invariante | Folha | Arquivo | Teste | Destino |
| --- | --- | --- | --- | --- |
| servidor é transporte, não autoridade de moderação | controlador | `server.js` (`chat_ponte`, `servidor`) | `CHT-A-05`, `CHT-C-04` | preservado |
| mesmo `messageId` em retry | controlador | `server.js` (`servidor`) | `CHT-D-01` | preservado |
| retry entrega à lista da AUTORIDADE, não à sala | composição | `server.js` (`servidor`) | `CHT-D-07` (novo) | acrescentado |
| espectador não recebe | controlador + espectador | `server.js` (`entregarChat`) | `CHT-C-03`, `COMP-06` | preservado, cruzado |
| credencial do motor continua única | ambas | `server.js` (bootstrap `ws_server`) | `CRED-34b` (recomposto) | **recomposto** |
| contrato cross-repo íntegro | controlador | `contrato/chat-transporte-v1.json` | `chat_contrato.test.js` | preservado |

### Assento

| Invariante | Folha | Arquivo | Teste | Destino |
| --- | --- | --- | --- | --- |
| posse ≠ controle | controlador | `server.js` (`salas`) | `CTRL-01`, `COMP-02` | preservado |
| graça de 15 s em queda | controlador | `server.js` (`ausentar`) | `CTRL-03`, `REG-08` | preservado |
| AFK sem graça | controlador | `server.js` (`ausentar`) | `CTRL-23`, `CTRL-24`, `COST-14` | preservado |
| saída voluntária terminal | controlador | `server.js` (`sair`) | `CTRL-11`, `CTRL-12` | preservado |
| retorno só em fronteira segura | controlador | `server.js` (`retornar`) | `CTRL-08` | preservado |
| takeover não cria duas autoridades | controlador | `server.js` (`desalojarOutrasConexoes`) | `CTRL-09`, `CTRL-10`, `COMP-11` | **movido de lugar** |
| `substituicoes.botAgiu` preservado | controlador | `server.js` (`proporAcaoDoAssento`) | `CTRL-18`, `CTRL-19`, `COMP-02` | preservado |

### Meta

| Invariante | Folha | Arquivo | Teste | Destino |
| --- | --- | --- | --- | --- |
| apenas 1500, 2000 e 3000 | meta | `server.js` (`resolverMetaDePontos`) | `META-01..17`, `COMP-08` | preservado |
| ausência → 2000 | meta | `server.js` (`META_PADRAO`) | `COMP-09` | preservado |
| valor presente inválido → recusa | meta | `server.js` (`criarMesa`) | `COMP-08` | preservado |
| meta congelada na sala | meta | `server.js` (`defineProperty`) | `COMP-03` | preservado |
| entrada / reconexão / revanche não alteram | meta + controlador | `server.js` (despachante) | `COMP-01`, `COMP-03`, `COMP-05` | **cruzado** |
| `msg.aposta` continua morto | meta | `server.js` (despachante) | `APO-GUARDA-01..05` | preservado |

---

## 3. As cinco costuras que não eram conflito textual

**1. UMA credencial, DOIS consumidores.** Cada folha construía a sua
`criarCredencialDoMotor` — uma para a admissão VIP, outra para a ponte de chat —
e cada uma afirmava, com razão, que só podia existir UMA. A união ingênua criava
exatamente a segunda credencial que as duas proibiam: dois caches, duas rotações
de refresh token, uma invalidando a outra, e o defeito só apareceria na
ativação. Existe **uma**, `credencialDoMotor`, injetada nos dois consumidores.

**2. `entrarMesa` tem uma porta só, e ela pode ser assíncrona.** A admissão VIP
consulta o backend; o assento só existe depois da resposta. O §15.10 do
controlador (desalojar outras conexões do assento) **desceu do despachante para
`aplicarEntrada`**, que é o único ponto por onde os regimes síncrono e assíncrono
passam. Deixá-lo onde estava rebaixaria a conexão velha por uma entrada que ainda
pode ser recusada — é o que `COMP-10` mede.

**3. A superfície do módulo `salas` é a UNIÃO das três folhas.** O que some do
`return` não some do arquivo: some do alcance de quem chama, e o defeito aparece
em produção como `undefined is not a function` numa mesa com gente dentro.

**4. `GATE-09` ganhou a segunda escrita por assento e uma trava nova.** O
controlador trouxe `ausentar` no lobby, que solta o assento pelo mesmo caminho de
`sair`. Só acrescentar a linha à lista esperada seria afrouxar — duas ocorrências
da mesma forma textual, e uma ocupação disfarçada de liberação passaria sem
alterar a lista. Cada escrita por `[assento]` agora é conferida **no valor**:
`= null` é soltar, e é só isso que essa forma pode fazer.

**5. `PAPEL-03` proibia a palavra "reconexão" no despachante.** Enquanto o
despachante não falava de reconexão, "não mencionar" e "não decidir" coincidiam.
O controlador precisa dizer ao cliente que ele VOLTOU ao próprio assento em vez
de ganhar um novo — e esse dado é `r.reconexao`, a resposta de `salas`, nunca
`msg.reconexao`. A proibição virou a que sempre importou, e é mais estreita:
nenhuma leitura de reconexão vinda da mensagem, e toda menção no despachante tem
de ser `r.reconexao`.

### O custo que a meta canônica cobrou do arnês do controlador

`CTRL-16` criava mesa de meta 60 para a partida acabar depressa. Com a lista
branca, 60 não é meta de mesa nenhuma e `criarMesa` recusa — corretamente.
**Nenhuma porta de teste foi aberta no servidor**: uma porta dessas faria a suíte
inteira medir um servidor que não é o que roda. A mesa nasce canônica e quem
encurta é `sala.jogo.metaPontos` depois de `iniciarPartida`, exatamente a
disciplina que `test/ajuda.js` já usava. `METAS_DE_MESA` passou a ser exportado
de lá para não haver duas listas.

---

## 4. Nenhum caso foi perdido

Comparação dos nomes de caso das três árvores (`--test-reporter=tap`, nomes
ordenados). Só dois nomes das folhas não aparecem na composição, e os dois são
**renomeações**, com afirmação mais forte:

| Nome que some | Onde estava | O que ficou |
| --- | --- | --- |
| `CRED-34b: o módulo tem UM consumidor só, e é a autorização de entrada` | meta | `CRED-34b: UMA credencial, DOIS consumidores — admissão VIP e chat` |
| `CRED-34b: o módulo foi ligado ao CHAT, e a outbox segue intocada` | controlador | idem |
| `REG-08: … (comportamento preservado)` | meta | `REG-08: … (agora em duas etapas)` — a queda não entrega o assento na hora, e a etapa 2 continua provando que a mesa não trava |

O `CRED-34b` composto afirma tudo o que as duas versões afirmavam **mais** que os
dois consumidores recebem a MESMA instância — que é o defeito que a composição
podia introduzir e nenhuma das duas folhas conseguia ver sozinha.

Zero skip, zero `todo`, nenhuma suíte retirada.

---

## 5. Provas cruzadas (§3)

`test/composicao_canonica.test.js`, 11 casos. O critério de entrada é estreito:
o caso tem de **falhar** se alguém escolher uma folha em vez de compor.

| Caso | O que cruza |
| --- | --- |
| `COMP-01` | mesa de 1500 + queda + retorno dentro da graça — a meta não se move em nenhum passo |
| `COMP-02` | mesa de 3000 + takeover com a vez na mão — `botAgiu`, posse intacta, meta intacta |
| `COMP-03` | reconexão com `metaPontos` no payload não troca nada; a trava é estrutural |
| `COMP-04` | queda → takeover → volta mantêm o MESMO canal e a MESMA composição |
| `COMP-05` | revanche mantém a meta, renova a identidade da partida e reabre o canal |
| `COMP-06` | espectador autenticado não age, não fala e não recebe — nem quando a autoridade o lista por engano |
| `COMP-07` | credencial vencida recusa o chat pela ponte REAL, sem tocar a rede e sem destruir a partida |
| `COMP-08` | meta inválida não cria sala nem declara canal (8 valores) |
| `COMP-09` | a AUSÊNCIA da meta cria mesa de 2000, com canal |
| `COMP-10` | com o backend pendente, ninguém senta e ninguém é desalojado |
| `COMP-11` | reconexão em mesa VIP desaloja a conexão anterior e se declara reconexão |

---

## 6. Campanha de mutação

Duas campanhas, ambas com as duas travas anti-vácuo (âncora exatamente 1×; bytes
do arquivo têm de mudar) e reversão garantida por `finally`.

`mutacoes_composicao.js` — 16 mutações, julgadas pela **suíte inteira**:

| # | Mutação | Falhas |
| --- | --- | --- |
| 01 | a validação da meta some | 20 |
| 02 | o padrão volta a ser 3000 | 2 |
| 03 | a lista branca aceita a string `"2000"` | 4 |
| 04 | a reconexão passa a trocar a meta da partida | 1 |
| 05 | a meta da sala deixa de ser congelada | 2 |
| 06 | `msg.aposta` volta a ser lido | 2 |
| 07 | a queda perde a graça | 9 |
| 08 | o AFK passa a esperar a graça | 9 |
| 09 | outro UID retoma o assento alheio | 1 |
| 10 | o gate de `proporAcaoDoAssento` some | 1 |
| 11 | duas conexões controlam o mesmo assento | 2 |
| 12 | o fato competitivo perde `botAgiu` | 2 |
| 13 | o espectador entra na entrega do chat | 1 |
| 14 | o retry recalcula os destinatários pela sala | 1 |
| 15 | o autor da mensagem vem do payload | 1 |
| 16 | a ponte segue em frente sem credencial | 1 |

**16/16 detectadas.** Verde de partida e de chegada: 0 falhas.

`mutacoes_os7.js` (o da folha do controlador, mantido intacto): **12/12
detectadas** sobre a árvore composta. Total: **28/28**.

---

## 7. O que esta OS NÃO fez

- Nenhum merge em `main`, nenhum PR, nenhum deploy, nada mexido no Railway.
- `main` continua em `1828d42`, e é o que roda hoje.
- O produtor no CLIENTE do controlador de assento continua fora — o motivo é o
  mesmo STOP da OS 7: nenhuma linhagem do `online_service` é canônica.
- A credencial do motor continua **não provisionada** no Railway. O
  comportamento é falha fechada: o chat recusa, a admissão VIP recusa, e o jogo
  roda. `COMP-07` é exatamente esse cenário, medido.
