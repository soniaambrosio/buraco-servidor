# OS 23.1-P — Produtor e envelope de encerramento V2

Base congelada: `integracao/servidor-canonico-chat-assento-meta-v1` @
`26a08fcbcc7013586d7218d9dbd60b11b7a70ab0`.
Produtor V1 incorporado: `16a692bbe95597536b3f9975ecf32e1bde58ebcb` (ancestral).
Fonte normativa: laudo da OS 23.2.

Esta entrega **não** implementa tradutor nem despachante, e não faz nenhuma
chamada de saída.

---

## 1. O que mudou no contrato

`VERSAO_CONTRATO_ENCERRAMENTO` passou de **1** para **2**. Três campos novos, e
nenhum campo do V1 saiu.

| Campo | Tipo | Autoridade | Momento de captura |
|---|---|---|---|
| `partidaCriadaEm` | ISO-8601 UTC | `agoraIso()` do gerenciador | `iniciarPartida`, junto da cunhagem do `partidaId` |
| `categoriaCompetitiva` | `casual` \| `vip_ranqueada` | configuração do processo → `sala`, imutável | `criarMesa` |
| `canastrasLimpasFinais` | `{nos:int≥0, eles:int≥0}` | `pontuarDuplaJogo`, somado por rodada | acumulado a cada apuração; congelado no encerramento |

### Por que o instante é o de `iniciarPartida`

O destino pergunta pela criação **da identidade**, e a identidade é o
`partidaId`. Antes de `iniciarPartida` existe uma SALA — reaproveitável —, e usar
o instante de `criarMesa` faria a revanche na mesma sala herdar a data da
primeira partida. `D2-05` prova que a revanche recebe instante novo.

O relógio é o mesmo já injetado que carimba `encerradaEm`, `desdeIso` e
`voltouEmIso`. Nenhum `new Date()` solto entrou: sem isso, nenhuma prova de tempo
seria determinística.

### Por que a categoria precisa atravessar

`tipoPartida` é **topologia** (como se chega à mesa); `categoriaCompetitiva` é
**natureza competitiva** (o que a partida vale). O destino precisa das duas para
resolver `TipoDePartida`, e `TipoDePartida.alteraRanking` é — nas palavras do
domínio — "a ÚNICA fonte de 'isto vale ranking' no sistema". Derivar uma da outra
seria inventar exatamente o fato que decide a competição.

### Como as canastras são contadas

Não são contadas aqui. `contarPontos` já classificou cada canastra e deixou o
detalhe em `jogo.pontosRodada`; `absorverCanastras` apenas **soma**. As três
faixas de zero curinga entram (`limpas`, `de500`, `asas`); `sujas` não. É a mesma
definição que o destino usa.

`jogo.pontosRodada` é zerado por `distribuirRodada`, então a soma acontece em três
pontos, e a função é **idempotente por número de rodada** para que isso seja
seguro:

1. antes de `J.distribuirRodada` em `avancarBots`;
2. antes de `J.distribuirRodada` em `jogarUmBot`;
3. no `produzirEncerramento` — e **só** este alcança a última rodada, porque
   depois dela não se distribui rodada nenhuma.

---

## 2. Invariantes fail-closed

`invariantesVioladas(envelope)` devolve os códigos violados. Se a lista não for
vazia, `produzirEncerramento` **não persiste** e falha alto no log com os códigos.

| Código | Regra |
|---|---|
| `I1_ordem_temporal` | `partidaCriadaEm` existe e é ≤ `encerradaEm` |
| `I2_vencedor_e_motivo` | vencedor existe ⟺ motivo é a meta |
| `I3_batida_do_vencedor` | quem bateu é do lado vencedor |
| `I4_quatro_assentos` | exatamente 4, assentos 0..3 sem repetição |
| `I5_dupla_do_assento` | dupla é função do assento |
| `I6_humano_tem_uid` | humano ⟺ tem uid |
| `I7_uid_unico` | nenhum uid em dois assentos |
| `I9_categoria_ausente` | categoria no enum fechado — nunca vira `casual` |
| `I10_canastras_ausentes` | dois lados, inteiros ≥ 0 — nunca vira zero |

**`I8` (mesa simulada) não mora aqui, de propósito.** Simulada PRODUZ envelope, e
persistir o fato é obrigação de durabilidade. A recusa de `simulada` é do
tradutor, e confundir as duas coisas perderia o registro de uma partida que
aconteceu.

Gravar um envelope que viola invariante seria pior que não gravar: o defeito só
apareceria do outro lado da cadeia, tarde e sem como voltar atrás.

---

## 3. Política V1 / V2 — quarentena

Os três campos novos **não são deriváveis** de um envelope V1: a categoria só
existia na sala em memória, o instante nunca foi carimbado e as canastras eram
zeradas a cada rodada. Não há migração determinística, e inventá-los é proibido.

A superfície da outbox é **aditiva** — nenhum nome antigo mudou de significado:

| Função | Responde |
|---|---|
| `pendentes()` | *inalterada*: "o que está lá" (durabilidade) |
| `pendentesTraduziveis(v)` | "o que é entregável" — só a versão `v` |
| `quarentena(v)` | contrato incompatível: existe, é legível, não é traduzível |
| `corrompidos()` | existe e não é legível — problema de disco, não de contrato |
| `versaoDe(id)` | a versão do registro, ou `null` |

A versão alvo é **sempre explícita**: `pendentesTraduziveis()` sem argumento
lança. A outbox não tem opinião sobre qual contrato é o corrente — quem sabe isso
é o produtor, e um padrão aqui viraria uma segunda fonte da verdade no dia em que
o contrato subisse para 3.

**Quarentena não apaga e não converte.** Nada nesta camada escreve, remove ou
reescreve registro. `Q-04` prova que o arquivo V1 continua no disco e continua
sendo V1 depois de ser classificado.

O custo disso é zero: a auditoria da OS 23-C1 provou que o despachante nunca
existiu, logo **nenhum envelope V1 jamais foi entregue**. Não há concessão a
preservar nem idempotência a reconciliar.

---

## 4. O que NÃO entrou no envelope

- `historico` — projetar é da autoridade Dart (`projetarParaJogador`), e
  reprojetar aqui criaria uma segunda regra de privacidade;
- `lancamentos` — ledger competitivo não é do produtor;
- qualquer saldo, prêmio, XP, delta de ranking ou progressão;
- qualquer prova de admissão (`admissaoId`, token) — já era proibido no V1 e
  continua sendo.

`D6-01`, `D6-02` e `D6-03` guardam isso estruturalmente.

---

## 5. Duas afirmações datadas que foram atualizadas

`MESA-10` (gate VIP) e `FIO-13` (admissão VIP) afirmavam que o contrato seguia na
versão 1 e que a categoria **não** entrava no envelope. As duas fechavam com a
razão: acrescentar campo seria mudança de contrato, "e esta OS não a autoriza".
"Esta OS" era a delas. A OS 23.1-P é a autorizada.

As duas ficaram **mais fortes**, não mais fracas: antes exigiam que o campo NÃO
existisse; agora exigem que ele exista **e** que seja exatamente o que a sala
congelou — o que também prova que ninguém o inventou no caminho. `FIO-13` roda
numa mesa `vip_ranqueada`, o que faz dela a melhor prova de D1 do repositório.

Nada mais foi tocado nas duas: as guardas de vazamento de `FIO-13` (`admissaoId`
fora, token `adm-` em canto nenhum) seguem idênticas.

---

## 6. Achado do arnês que virou prova

`tipoPartida` **não entra por mensagem do cliente**. Passá-lo em `criarMesa`
resolve para o padrão do processo, exatamente como a categoria. Isso não estava
provado em lugar nenhum — o comentário do produtor dizia, mas nenhum teste
media. Virou `D4-05`.

---

## 7. Contagens

- Suíte: **497 → 558** (61 casos novos em `test/produtor_v2.test.js`), 0 falhas,
  0 pulados.
- Campanha de mutação: **28 → 52** (24 novas), todas detectadas.
- `node --check server.js` verde.
