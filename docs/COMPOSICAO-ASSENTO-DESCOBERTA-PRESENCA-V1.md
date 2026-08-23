# Composição canônica: assento autoritativo + descoberta e presença — V1 (OS 44)

Branch `integracao/servidor-assento-descoberta-presenca-v1`.
Composição de `13ea6f1` (OS 41) com `d1de8a7` (OS 38.1), por merge, sobre a base
comum `26a08fc`.

Zero Flutter, zero Functions, zero Rules — este repositório não tem nenhum dos
três. Sem PR, sem merge em `main`, sem deploy, sem tag. A OS 38.3 não foi
retomada.

---

## 1. Gate Zero

### As duas entradas, resolvidas remotamente

| papel | branch remota | SHA completo |
| --- | --- | --- |
| base / assento | `correcao/servidor-escolha-autoritativa-assento-v1` | `13ea6f1df29681ec709a32d91391564d4bb3d491` |
| fonte a absorver | `integracao/descoberta-mesas-publicas-presenca-v1` | `d1de8a7b2b91dfeb5b409fec61473f10fc21afe4` |
| proveniência (transporte) | `claude/comunicacao-controlada-transporte-v1` | `ff3ddbe9d99fa2c9275aee0674ecc8ad323916cb` |
| ancestral comum | `integracao/servidor-canonico-chat-assento-meta-v1` | `26a08fcbcc7013586d7218d9dbd60b11b7a70ab0` |

O mapa de refs de rastreamento foi conferido contra `ls-remote` linha a linha —
nenhuma ref obsoleta. Sem isso, `--contains` e `--is-ancestor` respondem de
forma coerente e falsa.

### As provas de topologia

- **`ff3ddbe` é ancestral de `13ea6f1`**: `merge-base --is-ancestor` responde
  sim. Ele **não** foi recomposto: a composição executável é `13ea6f1 + d1de8a7`,
  e o transporte entra por herança.
- **`d1de8a7` não está absorvido** em `13ea6f1`, nem o contrário.
- **`merge-base --all` devolve UMA base**, `26a08fc` — sem criss-cross.
- **Divergência**: 2 commits só na linhagem A (`ff3ddbe`, `13ea6f1`), 1 só na B
  (`d1de8a7`).

### Os STOP que não dispararam, e por quê

- **Supersede de `d1de8a7`**: nenhuma folha remota o contém além dele mesmo.
- **Terceira folha nas mesmas autoridades**: o universo que desce de `26a08fc`
  tem a família OS 23.1-P (`e0c7560`→`7a858b1`→`c9edff1`, e `99c670c`). Ela
  **não** disputa estas autoridades: `entrarMesa`, `reconectar` e `sair` são
  **byte a byte idênticas** às de `26a08fc` nela (sha256 do corpo extraído por
  casamento de chaves), e ela não tem os módulos `descoberta` nem `presenca`.
  Também não tem PASS final — a OS 23.1-P segue reprovada na R2 e na R3.
- **Flutter/Functions/Rules**: `git ls-tree -d` de `13ea6f1` devolve
  `contrato/ docs/ test/`. Não há o que tocar.

### Baselines, antes de editar

| árvore | testes | suítes | falhas |
| --- | --- | --- | --- |
| `26a08fc` (ancestral) | 497 | — | 0 |
| `13ea6f1` (A) | 526 | 73 | 0 |
| `d1de8a7` (B) | 594 | 69 | 0 |

---

## 2. O delta, arquivo a arquivo

**Só `server.js` é tocado pelas duas linhagens.** Os outros dezesseis arquivos
do delta são exclusivos de um lado.

Exclusivos de `d1de8a7`: `contrato/descoberta-mesas-v1.json`,
`docs/DESCOBERTA-MESAS-PRESENCA-V1.md`, `mutacoes_descoberta.js`,
`test/descoberta.test.js`.

Exclusivos da linhagem de `13ea6f1`: `contrato/chat-transporte-v1.json`,
`docs/ESCOLHA-AUTORITATIVA-ASSENTO-V1.md`, `mutacoes_assento.js`,
`mutacoes_composicao.js`, `test/assento_autoritativo.test.js`,
`test/chat_contrato.test.js`, `test/chat_transporte.test.js`,
`test/composicao_canonica.test.js`, `test/espectador.test.js`,
`test/gate_vip.test.js`, `test/versao.test.js`.

### Conflitos textuais

**Nenhum.** O merge de `server.js` resolveu sozinho — e é exatamente por isso
que o §1 proíbe aceitá-lo como prova. O que segue é o que o merge textual não
viu.

---

## 3. Sobreposições SEM conflito textual, e as decisões de união

### 3.1 O literal de `criarMesa` — os dois lados acrescentaram campo

`d1de8a7` acrescentou `criadaEm` (o desempate de ordenação); `13ea6f1`
acrescentou `reservas` (a trava atômica). O merge juntou as duas linhas sem
conflito. **Conferido: os dois campos sobreviveram**, e cada um continua a
alimentar o seu lado.

### 3.2 DUAS listas de exclusão, e elas não são a mesma

| lista | sobre o quê | de quem |
| --- | --- | --- |
| `CAMPOS_FORA_DA_IMPRESSAO` | `sala` — versão do estado autoritativo | ganhou `reservas` na OS 41 |
| `CAMPOS_FORA_DA_REVISAO` | `mesa` — revisão do retrato de descoberta | `aguardandoHaMs`, `revisao` (OS 38.1) |

O risco real era `reservas` entrar na revisão da descoberta e fazer cada
tentativa de entrada mover o retrato de todos os clientes. **Não entra**: a
segunda lista opera sobre o objeto `mesa`, que é montado campo a campo em
`registroDaMesa` — projeção explícita, não varredura de chaves. As duas listas
convivem sem se conhecer, e nenhuma precisou mudar.

### 3.3 A DECISÃO: a descoberta não conhece reserva

`ocupacaoSanitizada` lê `sala.assentos`, e só. Um assento com **reserva em voo**
aparece como **livre** na fotografia. Foi decidido assim, e está escrito no
código e no caso `COST-11` — não é omissão:

- a reserva dura o tempo de um backend responder; publicá-la faria a mesa piscar
  entre cheia e vaga a cada tentativa frustrada;
- publicá-la moveria `ocupados`, `vagas` e `ingressavel`, e portanto a REVISÃO
  da mesa — retrato novo para todos os clientes por causa de um estado que
  nenhum deles pode ver;
- e não custa correção nenhuma: quem pedir o assento reservado recebe recusa
  tipada, que é o mesmo desfecho que a fotografia velha já produz.

`MUT-03` da campanha da costura sabota justamente isto e fica vermelha.

### 3.4 OS DOIS REGIMES DE ADMISSÃO SÃO DISJUNTOS

Isto não estava escrito em lugar nenhum e é o achado que mais muda a leitura da
composição:

- a descoberta só publica mesa **pública e casual** (`ehPublicavel`);
- mesa casual admite de forma **SÍNCRONA** — `entrarMesa` roda inteiro sem ponto
  de suspensão;
- a trava de reserva da OS 41 existe para o regime **VIP**, que é assíncrono —
  e mesa VIP **não é descobrível**.

Consequência prática: na disputa entre dois clientes vindos da descoberta, quem
decide é a ordem em que as mensagens são processadas, e a segunda encontra
`sala.assentos[i]` já escrito. A reserva nunca chega a ser consultada por um
concorrente nesse caminho. **Cada regime tem a sua prova, e as duas existem**: a
disputa descobrível em `COST-02`, a assíncrona em `DISP-01..DISP-10`. Quem
procurar prova de reserva na suíte de costura não vai achar, e o cabeçalho dela
diz por quê.

### 3.5 Presença nasce na autenticação, não no Lobby

`presenca.renovar` fica em dois pontos: a vinculação de identidade (que cobre
autenticação nova E renovação de credencial) e a fronteira de mensagem. Nenhum
deles foi tocado pela OS 41, cuja mudança no despachante fica depois da
fronteira. O contrato do §8 vem pronto da fonte.

---

## 4. As autoridades, uma a uma

### Autoridade 1 — transporte da Comunicação Controlada (`ff3ddbe`)

Preservado por **herança**, não por reaplicação. As suítes `chat_transporte`
(31 casos), `chat_contrato` (11) e o contrato v2 vieram inteiros na base.
`mutacoes_composicao` (16/16) e `mutacoes_os7` (12/12) rodam verdes sobre a
árvore composta — é assim que se prova que a política não afrouxou.

### Autoridade 2 — escolha autoritativa de assento (`13ea6f1`)

Íntegra. `mutacoes_assento` **20/20** sobre a árvore composta, incluindo a
mutação que restaura o fallback silencioso. Nenhum dos 29 casos de
`assento_autoritativo.test.js` foi tocado; o arquivo só GANHOU um caso (o censo
recíproco, §5 abaixo).

### Autoridade 3 — descoberta de mesas públicas (`d1de8a7`)

Íntegra. `mutacoes_descoberta` **45/45**. `test/descoberta.test.js` manteve os
97 casos e ganhou um (o censo).

### Autoridade 4 — presença online (`d1de8a7`)

Íntegra, mesma campanha. A separação matemática entre total geral
(`jogadoresOnlineTotal`) e subconjunto público (`jogadoresEmMesasPublicas`) é
medida também pela costura, no cenário da disputa (`COST-03`).

### O item que NÃO foi entregue como a letra pede: `sbtl → STBL`

O §8 pede a chave de fio `sbtl` e o rótulo `STBL` mostrado ao jogador, e o
§10.5 pede prova de que `sbtl` aparece como `STBL` "no contrato de saída
destinado à UI".

**No servidor, `sbtl` é o vocabulário do MOTOR** — `MODALIDADES.sbtl`,
`criarJogo({modalidade})`, `decidirCompra`. `STBL` aparece em dois comentários e
em nenhum valor. Não existe campo de rótulo no contrato de descoberta.

Acrescentar um seria criar superfície de produto nova (e decidir idioma e
caixa dentro do servidor), duplicando uma autoridade que **já existe no app** —
que o §13 me proíbe de tocar. E o próprio §8 diz: *não realizar saneamento cego
de valores de fio*.

Então a metade que é deste repositório está provada em `COST-09`: a modalidade
do fio vem da autoridade (`sala.modalidade`), é `sbtl`, é a mesma chave da
contagem por modalidade, e **o servidor não emite `STBL`**. `MUT-04` sabota
exatamente o saneamento cego e fica vermelha. A metade do rótulo é da tela, e
está fora desta OS.

---

## 5. A costura (§9), e o portão que é um glob

`test/costura_assento_descoberta.test.js` — 14 casos. Ela não pertence a
nenhuma das entradas: existe porque a composição criou uma pergunta que nenhuma
delas podia responder sozinha.

O cenário obrigatório do §9 está inteiro em `COST-02`, num caso só — porque as
partes dele não se provam separadas: "um entra" sem "o outro é recusado" é meia
prova, e as duas sem "o perdedor não foi movido" é a metade que esconderia o
fallback silencioso.

Os demais: o fio completo da fotografia ao ACK (`COST-01`), presença sem
duplicação na disputa (`COST-03`), a listagem que não reserva (`COST-04`), a
fotografia atrasada que não autoriza tomada (`COST-05`), ocupação e vagas
batendo com a autoridade (`COST-06`), repetição idempotente (`COST-07`), a
varredura de vazamento incluindo a marca de reserva (`COST-08`), a modalidade
(`COST-09`), a recusa que não move presença/revisão/versão (`COST-10`), e a
decisão semântica (`COST-11`).

### O censo recíproco, e as duas voltas que ele custou

**O único portão deste repositório é `npm test`, e ele é um GLOB.** Glob não tem
manifesto: apagar um arquivo de suíte, ou renomeá-lo para fora do padrão, faz os
casos dele pararem de rodar e o portão continuar VERDE. Numa composição isso é o
risco número um, e o §10.1 exige que nenhum caso desapareça.

A primeira versão da guarda era um caso dentro da própria suíte de costura. A
campanha a derrubou no ato: **tirar essa suíte do glob levava a guarda junto**.
Guarda que não sobrevive à própria remoção não é guarda.

A segunda versão moveu o censo para `test/censo_de_suites.js` (fora do glob) e o
chamou das TRÊS suítes — as duas entradas e a costura. A campanha derrubou de
novo, por outra porta: `COST-12b` verificava a reciprocidade com `assert.match`
sobre o arquivo **cru**, e trocar `conferirCenso();` por `// conferirCenso();`
mantinha o texto, a asserção verde e a chamada morta. **Prova textual que não
separa código de comentário mede a prosa, não o programa.** A versão final
recorta comentários antes de medir, com trava contra o próprio recorte.

Isto **não** é um segundo manifesto, agregador ou porteiro — o §12 proíbe os
três, e não há um primeiro para este ser o segundo. É uma asserção
compartilhada, chamada de dentro do portão que já existe, na disciplina do
`GATE-09`.

---

## 6. Provas

| | |
| --- | --- |
| suíte | **639/639**, 74 suítes, 0 falhas |
| soma esperada | 526 (A) + 97 (descoberta) + 14 (costura) + 2 (censos) = 639 |
| casos perdidos | **zero** |
| `node --check` | verde |

### Campanhas de sabotagem — 106/106

| campanha | resultado | o que guarda |
| --- | --- | --- |
| `mutacoes_costura.js` | **13/13** | o fio entre as duas entradas, a decisão semântica, o censo |
| `mutacoes_assento.js` | **20/20** | escolha de assento (§11 itens 1–8) |
| `mutacoes_descoberta.js` | **45/45** | descoberta e presença (§11 itens 9–21) |
| `mutacoes_composicao.js` | **16/16** | comunicação, meta, credencial |
| `mutacoes_os7.js` | **12/12** | controlador de assento |

**Mapeamento dos §11 itens 29–31.** Ancestralidade e autoria não são
comportamento e não se sabotam por mutação — elas se provam pelos comandos de
topologia da §1. O que a mutação prova é o corolário delas: se a autoridade de
`ff3ddbe`, `13ea6f1` ou `d1de8a7` não estivesse presente, as campanhas 16/16,
20/20 e 45/45 não teriam onde morder. Uma autoridade ausente não tem sabotagem
vermelha.

**Os §11 itens 26–28** (registro de suíte, execução de gate, participação no
agregador) foram traduzidos para o que este repositório de fato tem: `MUT-09`,
`MUT-10` e `MUT-11` tiram cada suíte obrigatória do glob, e `MUT-12`/`MUT-13`
desarmam a reciprocidade do censo. As cinco ficam vermelhas.

### A terceira trava do arnês, herdada da OS 41

`falhasDe` devolve `-1` quando a suíte TRAVA e morre no timeout, e o laço
original contava isso como sobrevivente. A campanha da costura já nasce com a
correção: `-1` remede com a suíte da costura e aborta se nenhuma bateria
produzir veredito.

---

## 7. Dívida registrada, não paga aqui

**Este repositório não tem CI, manifesto de provas nem agregador.** Não há
`ferramentas/`, não há `.github/`, e `npm test` é executado à mão. O portão de
provas com digest de ferramenta e piso por arquivo existe **apenas** na família
OS 23.1-P, que não é ancestral desta linhagem e **não tem PASS final**.

O §12 manda registrar a dívida e não ampliar a composição para criar CI externo
sem autoridade de predecessora. É o que foi feito: a dívida fica declarada aqui,
e o único buraco que dava para fechar de dentro do portão existente — suíte que
some em silêncio — foi fechado pelo censo recíproco.

---

## 8. Residuais

1. **`sbtl → STBL`**: metade da §10.5 é do app e não foi tocada (§4 acima).
2. **CI/manifesto**: dívida do repositório, declarada em §7.
3. **Admissão aprovada e não consumida** e **promessa de admissão que nunca
   resolve**: residuais herdados da OS 41, inalterados por esta composição.
4. **Sem deploy, sem PR, sem tag, sem merge em `main`.** `main` segue em
   `1828d42`.
