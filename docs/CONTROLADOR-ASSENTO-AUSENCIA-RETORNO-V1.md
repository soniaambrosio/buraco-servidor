# OS 7 — CONTROLADOR CANÔNICO DE ASSENTO, AUSÊNCIA E RETORNO HUMANO V1

**Veredito: PASS — CONTROLADOR CANÔNICO DE ASSENTO, AUSÊNCIA E RETORNO HUMANO ONLINE V1**

Base: `claude/chat-transporte-real-v1` = `cc8bd157c288db41056d9a96a25c016eb3c76f7f`.
Suíte: **296 → 323 testes, 323 verdes, 0 falhas, 0 skip** (~8 s).
Provas negativas: **12/12 mutações detectadas**, base verde antes e depois.

---

## 0. O defeito que isto conserta

Antes desta OS, no servidor online, `desconectar` chamava `sair`, e `sair`
escrevia `assentos[i].tipo = "bot"` **na hora**. Quem perdia 4G por três
segundos perdia o assento; e não havia volta, porque `entrarMesa` recusava mesa
iniciada em bloco. O jogador só reentrava como **espectador da própria partida**.

Agora: a queda **reserva** o assento por 15 s, o proprietário reconecta pelo
mesmo `entrarMesa`, e o bot só assume quando a graça vence.

---

## 1. Gate Zero

| exigência (§2) | resultado |
|---|---|
| base do servidor resolvida remotamente | `cc8bd15` por `ls-remote` |
| `cc8bd15` contém `c8ab95c` | **SIM** (é `c8ab95c` + 1 commit) |
| `e4bad52` fora | ok |
| `274c50d` fora | ok |
| `504d68f` fora | ok |
| `baa3d8f` fora | ok |
| `2fdeda5` fora | ok |
| árvore de trabalho limpa | worktree novo em `cc8bd15`, limpa |

### O STOP do cliente (§2) — disparou

A OS mandou resolver, antes de editar o cliente, se existe linhagem operacional
mais recente com o mesmo `OnlineService`, e **parar e relatar** se houvesse
candidata canônica. O censo das 154 heads do app achou o oposto de uma:

| linhagem | `online_service.dart` | tem `auth`? | tem versão da visão? | tem chat? |
|---|---|---|---|---|
| `d3effdc` (bot, referência da OS) | 6.808 B | **NÃO** | não | não |
| `claude/chat-transporte-real-v1` `3d124b0` | 32.688 B | sim | não | **sim** |
| `claude/encerramento-ui-pendente-ack-v1` `e7bc236` | 38.821 B | sim | **sim** | não |

- **`d3effdc` está DESQUALIFICADA como base de cliente**, e isso não é
  preferência: o `OnlineService` dela não envia `auth`, e a base mandada
  (`cc8bd15`) recusa conexão não autenticada com `ATUALIZACAO_OBRIGATORIA`. Um
  cliente daquela linhagem não conecta.
- As duas linhagens operacionais **divergem** (merge-base `4b3c460`; 40 commits
  de um lado, 7 do outro) e **diferem em 121 linhas no arquivo que a OS 7
  precisaria editar**. Nenhuma contém a outra.

A pergunta foi levada e não houve escolha. **Nada foi editado no cliente** — o
produtor de presença/reconexão fica como residual declarado (§9 abaixo). O
servidor, cuja base é inequívoca, foi entregue inteiro.

---

## 2. O modelo (§3, §4)

Duas verdades que antes moravam num campo só:

| | onde vive | quem escreve | takeover altera? |
|---|---|---|---|
| **POSSE** — de quem é o assento | `sala.assentos[i]` (`tipo`, `jogadorId`) | só a admissão à mesa | **não** |
| **CONTROLE** — quem propõe a próxima intenção | `sala.controle[i]` (novo) | só o produtor de takeover | sim |

`sala.controle` fica **fora de `sala.jogo`** de propósito: o controlador não é
regra de Buraco e não pode encostar em mão, monte, lixo, morto, vez, obrigação
de topo ou placar. `sala.jogo.assentos[i].tipo` continua alternando
`"humano"`/`"bot"` — mas virou **derivado**: quem decide é `controle`.

Estados: `humano_ativo`, `humano_ausente`, `bot_substituto`, `bot_de_mesa`.
Motivos: `queda_de_conexao`, `afk`, `saida_voluntaria`.

`bot_de_mesa` existe separado de `bot_substituto` porque **devolver o assento só
faz sentido onde há a quem devolver**: o assento que nasceu bot em
`iniciarPartida` nunca teve dono.

---

## 3. Instante do takeover (§5, §7, §8)

| evento | efeito | graça? |
|---|---|---|
| socket fecha | `humano_ausente`, assento **reservado** | **15 s** |
| graça vence | `bot_substituto` | — |
| `afkBot` | `bot_substituto` na hora | **não** |
| `sair` | `bot_substituto` **terminal** | **não** |

**Por que AFK não ganha graça, e isso é leitura declarada:** a graça do §5 existe
para a *incerteza de rede* — o servidor não sabe se o jogador voltou. No AFK não
há incerteza: o próprio jogador avisou que está no aparelho e ausente. Dar-lhe
15 s de mesa parada seria pagar por uma dúvida que não existe. O retorno
continua aberto (`afkVoltar`).

**`afkBot`/`afkVoltar` deixaram de ser ordem e viraram aviso (§8).** O cliente
diz "estou ausente / voltei"; quem decide assento, identidade e instante é o
servidor, a partir da conexão autenticada. Provado em `CTRL-23` (o assento do
payload é ignorado), `CTRL-24` (um jogador não devolve o assento de outro) e
`CTRL-25` (espectador não move controlador nenhum).

**A graça é configuração do servidor**, não payload: entra por
`criarGerenciador({ gracaAusenciaMs })`, padrão 15.000 ms (`CTRL-26`).

### Como a expiração é avaliada (§17)

Preguiçosamente, por **relógio injetado**, em dois pontos que chamam a **mesma**
função (`verificarAusencias`): o despachante, a cada mensagem autenticada, e a
cadência com respiro. Há também um despertar agendado logo após a graça, para
que a mesa em silêncio não fique parada — mas ele não tem regra própria: chama a
mesma função.

Comparação `t - desde >= graca`. **T−1 ainda é ausente, T já é bot, T+1 continua
bot** (`CTRL-03`), e nenhum teste dorme.

---

## 4. Retorno (§6, §9)

- **Reconexão passa pelo próprio `entrarMesa`.** Mesa iniciada deixou de recusar
  em bloco: se o UID autenticado é o proprietário preservado de um assento, isto
  não é entrada, é reconexão. Qualquer outro UID continua recebendo a recusa de
  sempre (`CTRL-07`, e a metade nova de `ESPEC-04`/`P0-02`).
- **Fronteira segura.** A troca só vale entre turnos. Se o turno daquele assento
  já começou (`jogo.vez === assento && jogo.jaComprou`), o retorno fica
  `pendente` e é aplicado antes do próximo turno — nos dois laços (o síncrono e
  o da cadência). Provado em `CTRL-08`.
- **Uma autoridade por assento.** Quem assume desaloja qualquer outra conexão que
  ainda segure o mesmo assento; ela vira espectador e recebe
  `codigo: "ASSENTO_ASSUMIDO"`. Rebaixar em vez de desconectar é deliberado: o
  aparelho velho ainda pode assistir, só não age (`CTRL-10`).
- **Saída voluntária é terminal**: sem graça e sem volta nesta partida
  (`CTRL-11`, `CTRL-12`).

---

## 5. Fronteira de proposta (§11)

`proporAcaoDoAssento({ codigo, assento })` é o **único** ponto por onde uma ação
de bot entra na partida. Ele responde à pergunta de autoridade — *este assento
pode propor agora?* — antes de qualquer regra de Buraco ser tocada. `avancarBots`
e `jogarUmBot` passaram a chamá-lo em vez de `jogarTurnoBot` direto.

**RESIDUAL DECLARADO PARA A OS 10, no código e aqui:** o decisor JS ainda
*aplica* a jogada dentro de `jogarTurnoBot`, em vez de devolver uma intenção
para esta função validar e aplicar. Separar decisão de aplicação exigiria
reescrever o bot JS, que a §12 proíbe. O que esta OS entrega é o **soquete**: o
gate de autoridade, o ponto único de entrada e o registro do fato. Trocar o
decisor depois é trocar **uma linha**, marcada no código.

Que o gate é real, e não decorativo: `CTRL-09` exige que a recusa venha **da
fronteira** (`/controle de bot/`), não do motor lá dentro — se o gate sumisse, o
motor ainda recusaria, por outro motivo, e um teste que só olhasse `ok` não veria
diferença. A mutação **MUT-05** confirma.

---

## 6. Continuidade de fase (§10)

O controlador não representa a fase — ela já está no jogo, e é isso que faz o
takeover no meio do turno funcionar sem nada novo. `CTRL-02` afirma que uma
queda não move `vez`, `jaComprou`, mão, monte, lixo, mortos, placar nem
`deveUsarTopo`.

**Um defeito real foi encontrado e corrigido aqui.** `jogarTurnoBotCore` comprava
**incondicionalmente** no começo do turno. Um bot que assumisse depois de o
humano ter comprado tentaria comprar de novo; `validarVez` recusaria e o turno
morreria sem jogada — a mesa penduraria exatamente no caso que esta OS existe
para consertar. A guarda é uma: turno com `jaComprou` entra depois da compra
(`CTRL-13`, `CTRL-14`; mutações **MUT-08** e **MUT-09**).

---

## 7. Fato competitivo (§13)

O servidor **não calcula rating** — a autoridade do ranking vive fora dele. Ele
produz o fato, em `sala.substituicoes` e no envelope de encerramento:

```
{ assento, uid, motivo, desdeIso, botAgiu, humanoVoltou, voltouEmIso }
```

`botAgiu` é o campo que separa "caiu e voltou em 3 s" de "o bot jogou por você" —
e é ele que a política competitiva da §13 consome. Assumir **não** é agir
(`CTRL-18`). Queda com retorno dentro da graça **não produz fato nenhum**
(`CTRL-17`). O envelope carrega a lista, e não carrega delta nem rating
(`CTRL-19`).

---

## 8. O chat sobrevive (§14)

`composicaoDoCanal` lê `sala.assentos` — a **posse** —, e a posse é justamente o
que o takeover não toca. A garantia sobrevive por construção, e está provada:

- queda temporária não remove o participante e **não ressincroniza o canal à
  toa** (`CTRL-20`);
- bot substituto não entra, e o dono do assento não sai (`CTRL-21`);
- reconexão não declara canal novo nem muda o `canalId` (`CTRL-22`);
- mesa com bots de mesa declara **só** os humanos (`CTRL-27`).

---

## 9. O que NÃO foi entregue

**O produtor no cliente (Flutter).** `online_service.dart` continua sem enviar
sinal de presença e sem caminho explícito de reconexão. Sem isso, em produção,
quem exercita o controlador é a queda de socket (que o servidor detecta sozinho)
e o `afkBot` de clientes que já o mandem — mas o retorno consciente do jogador
não tem botão.

**Por quê:** o STOP da §2 disparou e a escolha de base não foi feita. Editar o
cliente sobre a linhagem errada significaria refazer o trabalho quando as duas
famílias forem compostas.

**Compatibilidade de protocolo está preservada**: `afkBot` e `afkVoltar`
continuam aceitos com os mesmos nomes, e clientes antigos que os enviem seguem
funcionando — com a semântica nova, decidida pelo servidor.

---

## 10. Baselines (§18)

Nenhum teste foi removido. Quatro tiveram a **afirmação** atualizada para a
semântica nova, e os quatro ficaram **mais fortes**:

| teste | antes | agora |
|---|---|---|
| `REG-08` | queda ⇒ bot na hora | **duas etapas**: queda reserva (posse intacta) **e** a graça vencida entrega o assento — o motivo de existir do REG-08 ("a mesa não trava") continua afirmado, no segundo passo |
| `COST-09` | assento de quem caiu virou bot | assento fica **reservado ao titular**, e a conexão nova sem identidade continua sem herdá-lo |
| `ESPEC-04` | ninguém senta em partida começada | **terceiro** não senta (a metade nova, o titular reconectando, tem prova própria) |
| `P0-02` | credencial era do próprio `uid-1` | credencial de **outra pessoa**: a recusa ficou mais forte (nem espectador vira), e o forasteiro coerente também não ganha assento por caminho nenhum |

---

## 11. Provas negativas (§16)

`node mutacoes_os7.js` — cada mutação é aplicada, o arquivo é conferido em bytes
(anti-vácuo), a suíte roda, exige-se **vermelho**, e reverte-se sempre.

| # | mutação | falhas |
|---|---|---|
| 01 | socket fechado destrói a POSSE | 15 |
| 02 | reconexão de UID diferente é aceita | 1 |
| 03 | o bot assume 1 ms antes de T | 4 |
| 04 | dois bots assumem o mesmo assento | 1 |
| 05 | humano e bot com autoridade simultânea | 1 |
| 06 | o retorno interrompe ação atômica | 1 |
| 07 | a queda reinicia a fase do turno | 2 |
| 08 | o bot compra de novo num turno já iniciado | 2 |
| 09 | o turno assumido descarta duas vezes | 1 |
| 10 | saída voluntária permite retorno | 1 |
| 11 | o bot entra no canal de chat | 1 |
| 12 | o takeover não registra o fato competitivo | 5 |

**12/12 detectadas.** Três escaparam na primeira rodada, e o que elas acharam
não foi lacuna de código — foi **teste vácuo**: o auxiliar que posicionava a vez
jogava a partida e podia desistir em silêncio (`if (!levarVezAte(...)) return;`).
Um teste que desiste passa. A correção não foi tentar mais vezes: foi parar de
depender de jogar (`porVezEm`), porque o controlador não tem opinião sobre COMO
a vez chegou ao assento. A quarta (MUT-04) escapava por outro motivo: `ausentar`
tem guarda própria, e o único caminho que alcança `assumirPorBot` sem guarda é
`sair` — o teste passou a exercitá-lo.

---

## 12. Proibições (§19)

Cumpridas: sem deploy, sem PR, sem `main`, sem Firebase real, sem Railway, sem
alteração de ranking produtivo, sem port do Bot Dart, sem recalibração do Bot
JS, sem mudança de regra de Buraco, sem armazenamento persistente novo.

O bot JS **não** foi tocado, com uma exceção declarada e necessária: a guarda de
`jaComprou` em `jogarTurnoBotCore`, que é continuidade de fase exigida pela §10 —
não é heurística, não é peso, não é regra de Buraco.
