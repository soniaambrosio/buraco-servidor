# Escolha autoritativa de assento no servidor — V1 (OS 41)

Branch `correcao/servidor-escolha-autoritativa-assento-v1`, sobre
`claude/comunicacao-controlada-transporte-v1` @ `ff3ddbe`.

Zero Flutter. Nenhuma alteração em Chat, Ranking, economia ou partida. A OS 38.3
não foi executada nem reemitida. O CI externo do servidor não foi tocado.

---

## 1. Gate Zero — qual é a ponta canônica, e por que

A OS exige uma base única que preserve três autoridades. Medido por
`git ls-remote` (27 heads no remoto; 27 refs de rastreamento locais mais
`origin/HEAD` — refspec íntegro, `+refs/heads/*:refs/remotes/origin/*`):

| autoridade | onde nasce | contida em |
| --- | --- | --- |
| controlador de assento | `26a08fc` | `ff3ddbe`, `d1de8a7`, `e0c7560`→`7a858b1`→`c9edff1` |
| transporte aceito | `ff3ddbe` | **só `ff3ddbe`** |
| reconexão e propriedade autoritativa | `388025f`, dentro de `26a08fc` | as quatro folhas |

**`ff3ddbe` é a única folha que contém as três.** Ela é `26a08fc` mais um
commit, e `26a08fc` é a composição canônica que já carrega o controlador
(`388025f`) e a meta (`1d7c0be`).

A terceira linha da lista mereceu medição, e não leitura. `entrarMesa`,
`reconectar` e `sair` são **byte a byte idênticas** nas quatro folhas
descendentes de `26a08fc` (corpo extraído por casamento de chaves, comparado por
sha256), e o `case "entrarMesa"` do despachante também. Ou seja: não existe
trabalho de reconexão ou de propriedade posterior a `26a08fc` em folha nenhuma —
o item se resolve dentro da base e não escolhe folha.

### Os cinco STOP, um a um

1. **base única com as autoridades** — existe: `ff3ddbe`.
2. **ponta comprovável remotamente** — `ff3ddbe9d99fa2c9275aee0674ecc8ad323916cb`
   está em `origin/claude/comunicacao-controlada-transporte-v1`.
3. **outra folha alterando `entrarMesa` ou propriedade de assento** — nenhuma.
   `d1de8a7` altera `criarMesa` (carimbo `criadaEm` da OS 38.1), não a posse.
4. **compensação no Flutter** — nenhuma. O cliente hoje não envia `assento`;
   campo ausente continua caindo na escolha automática, byte a byte como antes.
5. **política de comunicação** — intocada.

### O que a escolha de base custa, e é preciso dizer em voz alta

`d1de8a7` (OS 38.1, descoberta de mesas e presença) **não está nesta base**, e
não podia estar: ela e `ff3ddbe` são irmãs divergentes de `26a08fc`, e nenhuma
contém a outra. Quem retomar a OS 38.3 vai precisar compor as três — esta
entrega, `ff3ddbe` e `d1de8a7` —, e essa composição é trabalho próprio, não
consequência automática.

---

## 2. O defeito

`entrarMesa` já aceitava `assento` desde a folha do controlador, e decidia assim:

```js
if (Number.isInteger(assento) && assento >= 0 && assento < 4 && sala.assentos[assento] === null) {
  alvo = assento;
} else {
  for (const s of ORDEM) { if (sala.assentos[s] === null) { alvo = s; break; } }
}
```

Um pedido que não pudesse ser atendido — lugar ocupado, número fora da faixa,
tipo errado — **caía no laço automático**. A pessoa entrava, em outra cadeira, e
a resposta não carregava sinal nenhum de que o pedido tinha sido descartado. É o
fallback silencioso: um seletor de cadeira construído sobre ele mostra a cadeira
errada e não tem como descobrir.

Dois agravantes que só apareceram ao medir:

- **o despachante nunca passava `msg.assento`**, então o parâmetro era
  inalcançável pelo fio — o seletor de cadeira não tinha por onde existir;
- **no lobby, o mesmo uid podia ocupar dois assentos**: reentrar dava um lugar
  NOVO, sem que nada recusasse.

---

## 3. O contrato entregue

`entrarMesa` distingue quatro respostas, e só quatro:

| pedido | resposta |
| --- | --- |
| ausente (`undefined`) | escolha automática `[2, 1, 3]` (parceiro-primeiro, intacta) |
| válido e livre | **exatamente** o solicitado |
| ocupado | recusa tipada `ASSENTO_OCUPADO` — sem segunda tentativa |
| inválido | recusa tipada `ASSENTO_INVALIDO` |

O ACK (`{tipo:"entrou"}`) devolve o assento **confirmado**; com pedido explícito,
`confirmado == solicitado` — garantido por construção, porque não existe caminho
que sente a pessoa em outro lugar.

**Ausência é `undefined`, e só.** `null` no fio é um valor que alguém escreveu,
não um campo que não veio; aceitá-lo como ausência reabriria o fallback pela
porta do cliente que serializa "nenhuma escolha" como `null`. Quem não escolheu
omite o campo.

**Os dois códigos são distinguíveis, e a recusa de admissão não é.** Não é
descuido. A admissão usa mensagem única de propósito, porque motivos diferentes
contariam a quem insistisse o direito que falta a quem tentou. Ocupação de
assento não é desse tipo de fato — ela já vai, assento a assento, em toda visão
de estado que qualquer espectador recebe. Um código que diga "ocupado" não revela
nada que a mesa já não mostre, e calar sobre ele só obrigaria o cliente a
adivinhar.

**A recusa acontece ANTES do gate.** Mesma disciplina de `criarMesa`: pedido
recusado não deixa rastro. Uma tentativa que chega ao adaptador é uma tentativa
que um backend de direitos pode contabilizar, e pedir uma cadeira ocupada não
pode custar nada a ninguém.

---

## 4. Concorrência: a janela real, e a trava

O regime casual é **síncrono de ponta a ponta** — `entrarMesa` roda inteiro sem
ponto de suspensão —, então nele duas entradas nunca se cruzam, e um teste de
disputa escrito sobre ele passaria sem exercitar nada. A janela existe no
**regime VIP**, onde a admissão é assíncrona: entre decidir o alvo e escrever no
assento há uma espera, e durante ela `sala.assentos[alvo]` continua `null`.

Antes desta entrega, duas tentativas pelo mesmo lugar liam "livre" as duas, e a
**segunda a voltar do backend gravava por cima da primeira**. O vencedor era quem
respondesse por último, e o outro ficava deslocado sem receber recusa nenhuma.
Vale registrar que isso valia **também para a escolha automática**: sem pedido
nenhum, as duas percorriam a mesma `ORDEM` e liam o mesmo assento 2.

A trava é `sala.reservas`, um registro de quatro posições ao lado de
`sala.assentos`:

- a marca é gravada **no mesmo passo síncrono** em que o alvo é decidido, antes
  de o gate ser chamado — então a segunda tentativa já encontra o lugar tomado e
  recebe `ASSENTO_OCUPADO` **imediatamente**, sem nem consultar o adaptador;
- `assentoLivre(sala, i)` passou a exigir **as duas** condições: assento vazio
  **e** sem reserva em voo;
- a liberação é **um ponto só**, por `finally`;
- `liberarReserva` só solta se a marca ainda for a daquela tentativa;
- no instante da escrita há uma **conferência final**: partida iniciada, assento
  já ocupado ou marca trocada ⇒ recusa. Ela cobre o que aconteceu com a MESA
  durante a espera — inclusive a partida ter começado e enchido o lugar de bot.

A reserva é **carga estrutural, não enfeite**: como a conferência final compara
`reservaDe(sala, alvo) !== marca`, remover a tomada da reserva faz TODA entrada
ser recusada. Não existe versão deste código em que a trava seja silenciosamente
desligada e a entrada continue funcionando (MUT-10 e MUT-11 medem isso).

### Por que `finally`, e não dois ramos

Falha do adaptador — exceção síncrona, promessa rejeitada, timeout — **não chega
a `entrarMesa` como rejeição**: `avaliarAdmissaoAoAssento` já a converte em
RECUSA, de propósito, porque falha externa não pode virar entrada liberada. Um
tratador de rejeição ali documentaria uma garantia que nenhum caminho exercita.
Escrevi um, medi que era inalcançável, e troquei por `finally` — que cobre as
saídas que existem com um callback só. `DISP-05` pinga essa conversão.

---

## 5. Posse: `assento` é preferência só antes da ocupação

- **Partida iniciada:** a volta passa por `reconectar`, que deriva o lugar da
  posse registrada. O pedido não participa — titular volta ao assento dele, e
  quem não é titular não senta.
- **Lobby, quem já está sentado:** `alvo` é o assento que já é dele, nunca o
  pedido. Isso fecha a entrada repetida (o mesmo uid em dois lugares) e a troca
  de cadeira por reentrada — que seria "sair e tentar outra cadeira" com outro
  nome, e essa operação não existe neste servidor.
- **A reentrada continua passando pelo gate**, classificada como
  `admissao_reconexao`. Curto-circuitá-la pouparia uma chamada e apagaria
  justamente o dado que a chamada existe para carregar: um backend de direitos
  precisa ver a volta marcada para não cobrar um segundo passe. Foi o primeiro
  desenho que escrevi, e `FIO-05`/`PAPEL-02` o derrubaram — corretamente.
- A reentrada **não regrava o ocupante**: regravar trocaria a prova de admissão
  que sentou a pessoa ali pela da tentativa de agora.

---

## 6. `reservas` fora da impressão do estado

`CAMPOS_FORA_DA_IMPRESSAO` ganhou `"reservas"`, e é um ato deliberado — a lista é
de exclusão justamente para que campo autoritativo novo versione sozinho.

A reserva **não é estado da partida**: é a trava que decide, em voo, qual de duas
entradas fica com o assento, e ela é invisível em toda visão. Sem a exclusão,
tomar e soltar uma reserva faria a versão andar sem que nada do que o cliente vê
tivesse mudado — que é exatamente o que a §5 do versionamento proíbe.

Duas decisões de detalhe que evitam uma defesa de mentira:

- a marca é **string sorteada**, não `Symbol`. Símbolo seria descartado por
  `JSON.stringify` e a exclusão ficaria letra morta — funcionaria por acidente de
  serialização, e mutá-la não mudaria nada;
- `EST-03` guarda que `reservas` só carrega `null` ou marca. No dia em que
  alguém guardar estado de verdade ali, ele deixa de versionar.

`VER-23` foi atualizado com a justificativa; a ocupação que a reserva protege
continua versionando normalmente, porque quem versiona é a escrita no assento
(`DISP-07` mede as duas metades).

---

## 7. Onde a decisão mora

O despachante **entrega** `msg.assento` cru e não decide nada: não valida faixa,
não escolhe ordem, não consulta posse, não cunha recusa. `EST-01` guarda isso —
`msg.assento` aparece uma vez no módulo `servidor`, e é a entrega.

O gate obrigatório do controlador (`GATE-09`) **não foi tocado nem afrouxado**:
as escritas em assento continuam sendo quatro, as duas por `[assento]` continuam
liberando, e `admitirNoAssento` continua sendo chamado exatamente duas vezes,
sempre antes da escrita. Ele ganhou um ponteiro para a companheira estrutural do
caminho novo: `EST-02` enumera as três escritas em `reservas` e exige que a
tomada venha **antes** do gate — depois dele a janela já passou.

---

## 8. Provas

| | |
| --- | --- |
| suíte | **497 → 526**, 0 falhas |
| casos novos | 29 (`test/assento_autoritativo.test.js`) |
| campanha desta OS | `mutacoes_assento.js` — **20/20** |
| campanhas herdadas | `mutacoes_composicao.js` **16/16** · `mutacoes_os7.js` **12/12** |
| `node --check` | verde |

A MUT-01 da campanha é a que a OS pede por nome: ela **restaura o fallback
silencioso**. Se ficar verde, a entrega não existe.

### O arnês de mutação estava mentindo, e o conserto ficou

`falhasDe` devolve `-1` quando a saída não traz sumário — o que acontece quando a
suíte **trava** e o processo morre no timeout. O laço herdado comparava
`falhas > 0`, então `-1` caía no ramo do sobrevivente: uma mutação catastrófica
demais para a suíte terminar era relatada como NÃO DETECTADA.

Foi exatamente o que aconteceu na primeira volta com MUT-10 e MUT-11, que
derrubam 16 e 17 casos. Elas desligam a tomada da reserva; a conferência final
passa a recusar toda entrada, e `ws.test.js` fica esperando um `entrou` que nunca
chega.

Contar timeout como detecção esconde arnês quebrado; contá-lo como escape esconde
mutação letal. As duas versões mentem. Então a campanha passou a **remedir**, ao
encontrar `-1`, com a suíte desta OS — que não abre porta de rede e não trava —,
e o veredito sai anotado com a origem. Se nenhuma bateria produzir sumário, ela
aborta.

### Os dois escapes reais, e o que eles ensinaram

`MUT-12` (a liberação deixa de conferir a marca) e `MUT-15` (a conferência final
deixa de olhar `sala.iniciada`) sobreviveram na primeira volta, e as duas pelo
mesmo motivo: **eram defesas que viviam de carona em outra defesa**.

- `sala.iniciada` é redundante hoje porque `iniciarPartida` enche os vazios de
  bot, então a guarda de "assento ocupado" já pegava o caso;
- a guarda por marca é inalcançável porque a segunda tentativa é recusada antes
  de reservar — e essa impossibilidade vem da **ordem em que as microtarefas
  rodam**, não de uma regra.

Nenhuma das duas foi apagada, e nenhuma foi declarada equivalente. `DISP-09` e
`DISP-10` forjam o estado que as torna necessárias, e dizem no próprio caso que o
estado é forjado e por quê: basta um `await` a mais na cadeia da admissão para a
janela da marca nascer, e basta uma mesa que comece sem encher todos os lugares
para a de `sala.iniciada` nascer. Cada um mata exatamente a sua mutação.

### Os três casos existentes que MUDARAM, e por quê

Nenhum foi afrouxado.

- **`P0-02`** (`test/espectador.test.js`) media `notEqual(entrou.assento, 0)` —
  ou seja, media o próprio fallback: o intruso entrava, só que em outro lugar. Um
  servidor que o sentasse no assento 2 passava. Agora mede que ele **não entra em
  lugar nenhum**, com recusa tipada, dono intacto e mesa com um ocupante só.
- **`VER-23`** (`test/versao.test.js`) fixa o conteúdo de
  `CAMPOS_FORA_DA_IMPRESSAO`; ganhou `"reservas"` e a justificativa por escrito.
- **`mutacoes_composicao.js`, MUT-04**: a âncora dela é a linha do despachante
  que chama `entrarMesa`, e essa linha ganhou `assento: msg.assento`. A mutação é
  a mesma; mudou a linha em que ela é injetada. A campanha abortou sozinha até a
  âncora ser corrigida — que é o arnês funcionando.

---

## 9. Residuais declarados

1. **Admissão aprovada e não consumida.** Se a conferência final recusar (partida
   começou durante o voo), o `admissaoId` já cunhado pelo backend não é usado.
   Não existe consumo de passe neste servidor hoje, então não há o que estornar —
   mas quando existir, este é o ponto.
2. **Promessa de admissão que nunca resolve** mantém a reserva de pé
   indefinidamente. Não inventei relógio nem temporizador aqui: seria autoridade
   nova, e a mesma janela já existe para a conexão inteira. Fica declarado.
3. **A composição com `d1de8a7`** (OS 38.1) é pré-requisito da retomada da OS
   38.3 e não foi feita nesta OS.
4. **Sem deploy e sem merge.** `main` segue em `1828d42`.
