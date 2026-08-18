# Gate autoritativo de entrada VIP/Ranqueada — V1

Branch `claude/gate-autoritativo-entrada-vip-ranqueada-v1`, sobre
`claude/versionamento-visao-autoritativa-v1` @ `7e7572b3471bcec2a6968e6084f56dd407cef601`.

## O que faltava

O servidor sabia dizer **que tipo de sala** uma mesa é — pública, privada,
simulada — e não sabia dizer **nada** sobre a natureza competitiva dela. Não
existia instante em que o servidor pudesse afirmar, por conta própria e sem
consultar o cliente:

> "Este UID autenticado está tentando confirmar entrada nesta partida
> VIP/Ranqueada."

Sem esse instante não há onde pendurar autorização, consumo de passe,
idempotência ou recusa. Esta OS cria o instante. Ela **não** implementa
assinatura, passe quinzenal, concessão nem consumo.

## Duas dimensões, não uma

```
tipoPartida           topologia da sala      publica | privada | simulada
categoriaCompetitiva  natureza competitiva   casual  | vip_ranqueada
```

Elas se cruzam, não se substituem. Uma mesa pública pode ser casual; a
modalidade competitiva oficial é a VIP/Ranqueada. Enfiar `vip` dentro de
`TIPOS_DE_PARTIDA` colapsaria as duas e faria a topologia responder por uma
pergunta que ela não sabe responder — `CAT-01` derruba a suíte se isso
acontecer.

Não existe booleano paralelo (`isVip`, `ehVip`, `mesaVip`). Um booleano ao lado
de uma enumeração fechada é uma segunda autoridade, e as duas divergem no
primeiro caminho que esquecer de atualizar uma delas — `CAT-07` varre o código
do bundle atrás de qualquer um deles.

## Origem confiável da categoria

Três saltos, todos dentro do servidor:

```
process.env.CATEGORIA_COMPETITIVA   → ws_server/iniciar()
  → criarServidor({ categoriaCompetitiva })
    → criarGerenciador → normalizarCategoria(opts.categoriaCompetitiva)
      → sala.categoriaCompetitiva  (writable:false, na criação da mesa)
```

Ela mora na **construção** do gerenciador pela mesma razão que `tipoPartida`
mora: o despachante monta `criarMesa` a partir de `msg`, e um campo que morasse
lá seria escolhível pelo cliente. O módulo `salas` não conhece `msg`, e o
despachante não constrói categoria nenhuma — as duas coisas são afirmadas por
`CAT-08`.

`normalizarCategoria` tem três respostas e só três:

| Configuração              | Resolve para   | Efeito                          |
| ------------------------- | -------------- | ------------------------------- |
| ausente                   | `casual`       | a mesa de sempre                |
| valor da enumeração       | ele mesmo      |                                 |
| qualquer outra coisa      | `desconhecida` | **não admite ninguém**          |

Categoria desconhecida **não** vira casual. `tipoPartida` resolve valor inválido
para `simulada`, que é o conservador *dele*; aqui o conservador é outro:
rebaixar para casual transformaria erro de configuração em mesa aberta e
gratuita, silenciosamente, e justamente na dimensão que decide se alguém paga
para entrar.

A categoria é **imutável** pela vida da sala (`Object.defineProperty`,
`writable:false`), revanche inclusive. Sem isso, um caminho futuro poderia
rebaixar uma mesa ranqueada no meio da partida e a decisão de admissão que já
aconteceu ficaria valendo para uma mesa que não existe mais.

## O ponto único

```js
avaliarAdmissaoAoAssento({
  uidAutenticado, codigoDaSala, identidadeDaPartida, assento,
  categoriaCompetitiva, tentativaEntradaId, reconexao
}, { autorizarEntradaVip })
```

Devolve uma decisão congelada com `ok`, `classificacao`, `categoriaCompetitiva`,
`tentativaEntradaId` e, na recusa, `codigoRecusa` + `erro`.

O gerenciador expõe a porta `admitirNoAssento`, e ela é chamada pelos **dois — e
só dois — caminhos que sentam um humano**:

* `criarMesa` — assento 0, **antes** de a sala existir;
* `entrarMesa` — assentos 1/2/3, **antes** da escrita em `sala.assentos[alvo]`.

`GATE-09` prova estruturalmente que essas são as únicas escritas de ocupação do
módulo, que o gate é chamado exatamente duas vezes, e que em ambos os casos a
chamada precede a escrita. Uma escrita nova em assento derruba a suíte — que é o
ponto.

**Quem não passa pelo gate:**

* **espectador** — não ocupa assento; `assistirMesa` não chama a admissão
  (`PAPEL-01`, comportamental *e* estrutural);
* **bots** — sentados por `iniciarPartida`; não têm uid e não pagam entrada
  (`PAPEL-05`);
* **lobby, consulta, botão, fila** — nada disso ocupa assento.

O sujeito é o `uid` autenticado, gravado por `vincularIdentidade` a partir do
`sub` do token verificado e imutável na conexão. Não é apelido, não é `publicId`
(que o bundle não lê em lugar nenhum — `GATE-10`) e não é `jogadorId` declarado
em mensagem.

## Comportamento provisório: falha fechada

| Situação                          | Resultado                          |
| --------------------------------- | ---------------------------------- |
| categoria fora da enumeração      | recusa `ADMISSAO_CATEGORIA_DESCONHECIDA` |
| tentativa sem id do servidor      | recusa `ADMISSAO_VIP_INDISPONIVEL` |
| `vip_ranqueada` sem uid           | recusa `ADMISSAO_VIP_INDISPONIVEL` |
| `vip_ranqueada` **sem adaptador** | recusa `ADMISSAO_VIP_INDISPONIVEL` ← o estado de hoje |
| `vip_ranqueada`, adaptador ≠ `{ok:true}` | recusa                      |
| `casual`                          | segue, exatamente como antes       |

`portas.autorizarEntradaVip` é a porta única do adaptador autoritativo da
próxima OS. **Ausente por padrão, e ausente recusa** — não existe liberação
automática na falta de quem autorize, e não existe bypass de desenvolvimento
ligado sozinho. Em produção (`iniciar()`) nenhum adaptador é injetado, e
`MESA-12` afirma isso lendo o transporte.

Só `{ ok: true }` aprova. Resposta truthy qualquer, `undefined` ou exceção
recusam (`GATE-06`).

A recusa tem **código estável** e **mensagem redigida** — uma só mensagem para
todos os motivos, porque mensagens diferentes viram oráculo: quem tentasse
várias vezes leria nas diferenças o estado interno que o código não conta.
Categoria, classificação e `tentativaEntradaId` nunca saem no fio (`MESA-06`,
`MESA-08`).

`casual` não exige uid **de propósito**: é o comportamento preexistente da mesa,
e esta OS não pode mudá-lo. A exigência de identidade é da mesa que cobra.

## Identidade da tentativa

`tentativaEntradaId` = `"te_" + crypto.randomUUID()`, cunhado dentro de
`admitirNoAssento`, uma vez por tentativa.

* **opaco**: sorteado, nunca calculado — não deriva de uid, código de sala,
  assento nem horário;
* **por tentativa**: duas tentativas do mesmo uid na mesma sala têm ids
  diferentes — é isso que o torna utilizável como chave de idempotência quando o
  consumo existir;
* **não é concessão**: ele nomeia a tentativa; o efeito dela é outra coisa, e
  essa outra coisa não existe neste servidor;
* **não é `eventoId`**: o prefixo existe exatamente para que a troca entre os
  dois seja *detectável*. `eventoId` nunca usa o prefixo, e um `eventoId`
  apresentado como tentativa é recusado (`TENT-03`);
* **o cliente não o escolhe**: o despachante nem conhece o nome do campo
  (`TENT-04`), e ele não vaza para o fio (`TENT-05`).

## Reconexão

A classificação sai de **quem já está sentado**, nunca de campo de mensagem:

```js
reconexao: assentoDoTitular(sala, jogadorId) !== -1
```

| Situação                                     | Classificação                  |
| -------------------------------------------- | ------------------------------ |
| `criarMesa`                                   | `admissao_nova`                |
| jogador novo em `entrarMesa`                  | `admissao_nova`                |
| uid que **já ocupa** assento nesta sala       | `reconexao_ao_proprio_assento` |
| payload declarando `reconexao: true`          | ignorado — `admissao_nova`     |

Nesta OS a classificação **não muda o veredito**: sala VIP falha fechada nos
dois casos. Ela existe para que a próxima OS receba a tentativa já classificada
e não cobre um segundo passe de quem só caiu e voltou — garantir isso depois,
sem o campo, seria adivinhação.

**O que esta camada não faz** (e não é omissão): ela não *retoma* o assento. Em
mesa casual, o segundo `entrarMesa` do mesmo uid continua recebendo um assento
novo, exatamente como antes desta OS — mudar isso seria alterar o
comportamento casual, o que esta OS proíbe. A classificação é observacional.
Retomada de assento é decisão de outra OS.

## Fronteira deliberada: o envelope de encerramento

A categoria fica **disponível** ao encerramento autoritativo por
`ger.categoriaDaSala(codigo)` e por `sala.categoriaCompetitiva`, que sobrevivem
a `liquidar`. Ela **não** foi acrescentada ao envelope.

O envelope está congelado em `versaoContrato: 1`. Acrescentar campo a ele
mudaria a forma de um contrato versionado sem bumpar a versão — dois payloads
diferentes alegando ser v1 — e bumpar a versão mexeria num contrato que o app
Flutter lê, que esta OS está proibida de editar. Quando houver consumidor da
categoria no encerramento, isso é uma decisão de contrato, com número de versão,
e não um efeito colateral de um gate de entrada. `MESA-10` fixa a forma atual.

## Regra comercial — registrada, não implementada

Contrato para as próximas OS. **Nada disto existe neste servidor.**

```
1 entrada VIP de cortesia a cada 15 dias
validade de 7 dias
usado ou expirado desaparece
próxima elegibilidade ancorada em recebidoEm + 15 dias
não acumula
consumo autoritativo na confirmação da entrada
```

`PAPEL-06` varre o código atrás de `playerEntitlements`, `entitlement`,
`passeQuinzenal`, `passeVip`, `consumirPasse`, `concederPasse`,
`firebase-admin` e `firestore` — a ausência é o entregável, então ela é
afirmada por teste.

## Testes

`test/gate_vip.test.js` — 41 provas em cinco eixos (`CAT`, `GATE`, `TENT`,
`PAPEL`, `MESA`). Baseline integral: **222/222**.

As provas estruturais leem o **código** do bundle, não os comentários
(`codigoDe`): este arquivo documenta as suas decisões em prosa longa, e sem
separar as duas coisas um comentário que *explica* por que `isVip` não existe
derrubaria o teste que prova que `isVip` não existe — a saída seria apagar o
comentário, exatamente ao contrário do que se quer.

### Provas negativas (§11)

Cinco defeitos injetados um a um, matriz inteira rodada, revertido e conferido
por sha256:

| # | Defeito injetado                                     | Detectado | Quem pegou |
| - | ---------------------------------------------------- | --------- | ---------- |
| 1 | confiança na categoria enviada pelo cliente          | sim (2)   | `CAT-04` |
| 2 | bypass do gate num caminho de ocupação (`entrarMesa`) | sim (4)   | `GATE-09`, `MESA-04`, `PAPEL-02/03` |
| 3 | liberação automática com o adaptador ausente          | sim (4)   | `GATE-02`, `MESA-03/05/06` |
| 4 | espectador atravessando o gate                        | sim (1)   | `PAPEL-01` |
| 5 | reconexão classificada como entrada nova              | sim (1)   | `PAPEL-02` |

## Limites respeitados

Não foi tocado: app Flutter, Functions, Rules, Firestore, `firebase-admin`,
preços, política competitiva, `versaoEstadoFinal`, `versaoEstado`/`eventoId`, o
produtor de encerramento. Sem deploy, sem PR, sem merge.

## Riscos residuais

1. **`CATEGORIA_COMPETITIVA` inválida tranca o processo inteiro.** É o
   fail-closed pedido, mas o sintoma operacional é "ninguém entra em mesa
   nenhuma". O boot loga a categoria resolvida e avisa quando ela não é
   `casual`, justamente para que o diagnóstico seja de um segundo.
2. **Retomada de assento continua não existindo.** A reconexão é *classificada*,
   não *executada*. Em mesa VIP isso é irrelevante hoje (tudo falha fechada); no
   dia em que o adaptador entrar, retomar assento precisa existir antes de a
   cobrança existir, ou reconectar vai parecer entrada nova para o usuário.
3. **`uidAutenticado` e `jogadorId` coincidem hoje** (`jogadorIdDoUid` é a
   identidade). A admissão usa o uid; a detecção de reconexão usa o
   `jogadorId`, que é quem titulariza o assento. Se um dia a derivação deixar de
   ser identidade, os dois eixos continuam corretos, mas convém reler este
   parágrafo antes de assumir que são a mesma coisa.
4. **A categoria não chega ao envelope de encerramento** — decisão deliberada,
   registrada acima. Ranking por categoria depende de resolver isso com número
   de versão de contrato.
