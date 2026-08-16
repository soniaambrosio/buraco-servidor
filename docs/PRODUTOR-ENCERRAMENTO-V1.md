# Produtor autoritativo e outbox de encerramento — V1

O servidor passa a produzir, para cada partida encerrada, um **envelope
autoritativo** e a persistí-lo numa **outbox durável**. Nada é enviado a lugar
nenhum: o transporte autenticado Railway→Functions é a próxima OS.

- Branch: `claude/produtor-encerramento-autoritativo-v1`
- Base: `integracao/ws-auth-visao-espectador-v1` @ `8cd14c6`
- Evidência: `docs/PRODUTOR-ENCERRAMENTO-EVIDENCIA-V1.md`

---

## 1. O que faltava, e o que passou a existir

A auditoria anterior mediu o encerramento contra os oito fatos que a conquista
precisa. Cinco faltavam. Quatro passam a existir aqui.

| Fato | Antes | Agora |
|---|---|---|
| identificador único da partida | não existia | `partidaId` (UUID do servidor) |
| rodada × partida final | existia | preservado, e agora **carregado no envelope** |
| motivo do encerramento | não existia | `meta_alcancada`, único concedível |
| validade competitiva | não existia | `tipoPartida` + `validaParaConquistas` |
| dupla vencedora | existia | preservado |
| **assento que bateu** | **descartado** | `assentoQueBateuFinal` |
| UID autenticado do assento | existia (composição) | `uidQueBateuFinal`, derivado do mapa |
| chave idempotente | por processo | **id de documento na outbox** |

## 2. `partidaId` — onde nasce, e por que ali

Nasce em `iniciarPartida`, por `crypto.randomUUID()`.

Nasce **ali**, e não em `criarMesa`, porque antes daquele ponto existe uma
*sala* — código digitável, reaproveitável, que sobrevive à partida — e a partir
dele existe *uma partida*. Revanche passa pelo mesmo caminho, logo recebe id
novo.

O que **não** serve como identificador, e por quê:

- **código da sala**: repete entre partidas, e foi feito para ser digitável;
- **horário**: colide em partidas simultâneas;
- **UIDs concatenados**: colidem na revanche e vazam quem jogou para dentro do
  identificador.

O cliente não escolhe nem move: nenhum caminho lê `msg.partidaId`.

## 3. Mapa de participantes — a fronteira de identidade

`sala.participantes` é um retrato **congelado** (`Object.freeze`), tirado no
início da partida:

```
{ assento, uid, dupla, tipo }
```

Congelado de propósito. Durante a partida um assento pode virar bot (queda,
AFK) e a conexão pode trocar — mas o **titular** daquele assento não muda. Sem o
retrato, quem caiu no meio perderia o crédito do que fez, e quem entrou depois
herdaria.

- `uid` vem de `sala.assentos[i].jogadorId`, que o despachante preenche com
  `c.jogadorId` — gravado por `vincularIdentidade` a partir do `sub` do token
  verificado, e imutável (`writable:false`);
- bot não recebe uid; espectador não aparece (não ocupa assento);
- **apelido não entra**: muda no meio da partida e convidaria a inferir
  identidade por nome.

Removida a linha `c.jogadorId = msg.jogadorId || ...` de `assistirMesa` — era
no-op silencioso, mas sugeria que uma mensagem pode definir identidade.

## 4. O assento da batida

Contrato novo:

```js
encerrarRodada(jogo, duplaQueBateu, assentoQueBateu = null)
```

Os dois caminhos de batida já tinham o `assento` em escopo e o descartavam:

| Caminho | Onde | Validação anterior à passagem |
|---|---|---|
| batida direta (mão zera baixando) | `aoZerarMaoBaixando` | `duplaPodeBater` + morto da dupla esgotado |
| batida final por descarte | `descartar` | `podeBatidaFinal` + `duplaPodeBater` |

**Não existe booleano `batidaLegal`, e não deve passar a existir.** O assento só
chega ao encerramento depois das validações — ele *é* a prova de legalidade. Um
segundo campo seria um segundo lugar onde a mesma verdade poderia divergir.

Dois campos, com vidas diferentes:

- `assentoQueBateu` — **por rodada**, zerado em `distribuirRodada` junto da
  dupla. Sem isso, a batida de uma rodada intermediária ficaria pendurada e
  seria lida, no fim, como se tivesse sido a final;
- `assentoQueBateuFinal` — gravado **só** quando a rodada encerra a partida,
  depois de `contarPontos`, que é quem decide se a meta caiu. É o campo que
  separa "bateu numa rodada" de "bateu a rodada que acabou com o jogo".

## 5. Envelope

Capturado uma vez, em `liquidar`, depois de o estado final estar consolidado.

```
versaoContrato             1
partidaId                  UUID do servidor
versaoEstadoFinal          rodada final
encerradaEm                ISO-8601, relógio do servidor
motivoEncerramento         meta_alcancada | desconhecido
modalidade                 sbtl | aberto | fechado
tipoPartida                publica | privada | simulada
validaParaConquistas       booleano
rodadaFinal                número
meta                       metaPontos
placarFinal                { nos, eles }
duplaVencedora             nos | eles | null
duplaQueBateuUltimaRodada  nos | eles | null
assentoQueBateuFinal       0..3 | null
uidQueBateuFinal           uid | null
participantes              [{ assento, uid, dupla, tipo }]
```

**Determinístico** para o mesmo encerramento: todo campo sai do estado canônico,
e o único não-determinístico (`encerradaEm`) é carimbado uma vez e guardado
junto, não recalculado a cada leitura.

**Não entra**, e é decisão e não esquecimento: mão, carta, monte, morto, token,
e-mail e apelido. O envelope responde "quem venceu, quem bateu e se isso vale".

Sem batida conhecida, `assentoQueBateuFinal` e `uidQueBateuFinal` são `null` — e
o encerramento continua existindo para outros consumidores. **Não se infere.**

### Motivo

`meta_alcancada` é o único concedível, porque o motor encerra num lugar só
(`contarPontos`, quando o placar cruza a meta). Abandono, WO, expulsão e
anulação **não foram inventados**: seria vocabulário sem código por trás.
Encerramento que chegue por outro caminho vira `desconhecido`, que é inelegível
— nunca classificado como vitória normal.

### Validade

`validaParaConquistas` é uma conjunção escrita em três linhas separadas, uma por
condição, para que afrouxar qualquer uma seja uma edição visível no diff:

1. motivo é `meta_alcancada`;
2. `tipoPartida` está na lista fechada `{publica, privada}`;
3. há dupla vencedora.

`tipoPartida` fica na **construção do gerenciador**, e não em `criarMesa({...})`:
o despachante monta `criarMesa` a partir de `msg`, então um campo ali seria
escolhível pelo cliente. Padrão `privada` — a verdade da base, onde toda mesa
nasce de código compartilhado. Valor fora da enumeração vira `simulada`, que não
conta.

**Mesa privada conta para a conquista pessoal** e continua fora do ranking: são
perguntas diferentes, e quem jogou jogou.

## 6. Outbox

```
DADOS_DIR/encerramentos/<partidaId>.json
```

```
partidaId, versaoContrato, estado: "pendente", tentativas: 0,
criadoEm, atualizadoEm, envelope
```

**Um arquivo por partida**, e não um log único, por três razões:

1. criação idempotente vira uma pergunta de existência, sem
   ler-modificar-escrever — que é onde duas liquidações simultâneas se
   atropelariam;
2. um envelope corrompido não leva os outros junto;
3. o reinício não reconstrói índice: os pendentes são os arquivos que ficaram.

**Atomicidade** por `.tmp` + `renameSync` — o mesmo idioma que `contas.js` já usa
para o cofre. Nunca existe envelope pela metade.

**Falha de escrita não vira entrega**: o `.tmp` é removido, nada é guardado em
memória (guardar mentiria sobre durabilidade) e o erro sobe para o log.

**Arquivo corrompido lança** `RegistroCorrompido` na leitura, e continua contando
como pendente. Silenciar faria um envelope perdido parecer inexistente.

`partidaId` é validado contra travessia de caminho antes de virar nome de
arquivo — mesmo nunca vindo do cliente.

A outbox **não é servida por HTTP**: as rotas são `/health`, `/avatar/<id>` e o
`PUBLIC_DIR` opcional, e nenhuma alcança `DADOS_DIR`.

## 7. Relação com a economia local — atenção para a próxima OS

`registrarPartida` está **inalterada**. A outbox registra um fato; ela não paga
nada, não credita moeda nem XP, e não substitui o cofre.

A captura do envelope fica **antes** do `if (!contas) return null` em `liquidar`,
porque o fato autoritativo não pode depender de existir cofre local — e **depois**
de `sala.liquidada = true`, então a mesma trava que impede pagar duas vezes
impede envelopar duas vezes.

> **Cortar a economia local para a autoridade do Firestore exigirá homologação e
> ativação coordenadas.** Enquanto os dois caminhos existirem — o cofre daqui e
> quem vier a consumir o envelope —, ligar o consumidor sem desligar o cofre
> paga o jogador **duas vezes**. Isso não é problema desta OS, e é exatamente
> por isso que está escrito aqui.

## 8. WebSocket

O payload de `fim` **não mudou** — conferido por diff. `partidaId` não é exposto
ao cliente: não há necessidade funcional comprovada, e expor um identificador
autoritativo convida a tratá-lo como autoridade do lado de lá.

A outbox **não depende** de o cliente receber ou confirmar o `fim`.

## 9. Bloqueadores para o transporte Railway→Functions

1. **Credencial de serviço**: a Function `registrarEncerramentoPartida` exige o
   claim `motorDePartidas` ou `admin`. O servidor precisa de uma identidade
   própria para obtê-lo — decisão de operação, não de código.
2. **Endereço e ambiente**: a URL da callable por ambiente, e como distinguir
   produção de homologação sem hard-code.
3. **Política de retry**: `tentativas` já existe no registro e é sempre `0`
   nesta versão. Quem entregar precisa definir backoff, teto e o que fazer com
   um envelope que falha para sempre.
4. **Formato de consumo**: o envelope daqui e o `plano` que
   `registrarEncerramentoPartida` espera **não são o mesmo objeto**. Alguém
   precisa traduzir — e a tradução é decisão de contrato, não de transporte.
5. **Dupla concessão** (§7): o corte da economia precisa ser coordenado com a
   ativação do consumidor.
6. **Retenção**: nada apaga registro entregue. Antes de ligar o envio, decidir
   por quanto tempo o histórico fica no volume.
