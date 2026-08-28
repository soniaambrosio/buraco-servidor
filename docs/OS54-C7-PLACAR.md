# OS 54-C7 — placar das provas

Node `v24.14.0` / npm `11.9.0`. Base: `d85adca59250dd17803c578db6f78b1399600642`.
Bancada: `C:\os54c7` (worktree próprio, criado do SHA da base; nenhuma bancada da
R5/R6 reutilizada).

---

## 1. Gate Zero

| item | resultado |
| --- | --- |
| base, por três leituras | local = remote-tracking = `ls-remote` em `d85adca59250dd17803c578db6f78b1399600642` |
| árvore limpa (inclusive não rastreados) | sim |
| pai único | `7c81bd64948b6777c74aa58845744369180cf7c9` |
| C5 → C6 | 1 commit, 0 merges |
| `main` | `1828d42ef2c95329e81b439b4939353326c2b036`, no SHA declarado |
| worktree e branch | `C:\os54c7`, `correcao/os54-c7-autoridade-nominal-pisos-ancorados-v1`, criada da base |
| tree hash inicial | `bcfba443d0e696b7cbebe77566ca44792f559761` |
| `npm test` reproduzido na base | **956 casos / 87 suítes**, 0 falhas, exit 0 |

**Processos alheios, registrados.** O item 6 pedia ausência de processo
Node/npm. Havia dois, e **não eram da missão**: laços de espera
(`node -e "const t=Date.now();while(...)"` e `setTimeout`), sem porta e sem
relação com esta árvore — outra sessão na mesma máquina. Não foram mortos: matar
processo de terceiro é destrutivo e não era autorizado. Eles disputaram CPU e
inflaram os tempos medidos (a mesma suíte foi de 78 s a 271 s conforme a carga);
não alteram veredito nenhum. Nenhuma porta da missão (8137/8080/3000) em escuta,
antes ou depois.

## 2. O defeito da R6, reproduzido antes de ser fechado

Sonda em cópia descartável, sobre a **base C6**, com a autoridade da C6:

| vetor | peso declarado | peso de `assert.ok(true)` | cadeia oficial |
| --- | --- | --- | --- |
| `E36` — `SAI-02` trivializado | 1 | 1 | **VERDE** |
| `E38` — `SAI-22` com duas triviais | 2 | 2 | **VERDE** |
| `X07` — `UNI-B4` trivializado | (não protegido) | — | **VERDE** |

Cinco dos nove protegidos pesavam 1. Contar afirmações mede a forma da prova,
não o conteúdo.

## 3. A cadeia oficial na árvore final

| etapa | resultado |
| --- | --- |
| `npm test` (com o `pretest`) | **exit 0** — 964 casos, 87 suítes, 0 falhas |
| `node ci/auditabilidade.js` | **AUDITABILIDADE VERDE** |
| `node ci/pisos_autorizados.js` (autoridade nova) | **CONTEÚDO NOMINAL ÍNTEGRO** — 12 casos protegidos |
| `node ci/codigo_de_saida.js` | **CÓDIGO DE SAÍDA PRESERVADO** |
| `node ci/inventario_de_execucao.js` | **INVENTÁRIO VERDE** — 14 suítes obrigatórias |
| `node ci/portao_do_ci.js <evidência real>` | **PORTÃO VERDE** — 964/87 contra piso 964/87 |
| a **ação local do juiz**, sobre a mesma evidência | **PORTÃO VERDE** — exit 0, idêntico ao juiz |
| `node ci/artefato.js --conferir --raiz .` | **ARTEFATO VERDE** — `[package.json, server.js]` |
| `node test/guarda_do_portao.js` (`pretest`) | verde — 104 comparações de piso ancorado, 8 amarrações |

## 4. Censo e pisos — só crescimento

| medida | base `d85adca` | esta ponta |
| --- | --- | --- |
| casos | 956 | **964** |
| suítes | 87 | **87** |
| `casos_minimos` | 956 | **964** |
| `suites_minimas` | 87 | **87** |
| `CASOS_MEDIDOS_NA_BASE` | 956 | **964** |
| `medido_sobre` | `7c81bd6` | **`d85adca`** (ancestral de `HEAD`, descende do anterior) |
| suítes obrigatórias | 14 | **14** |
| comparações do piso ancorado | 35 | **104** |
| arquivos na autoridade ancorada | 4 | **5** (`ci/pisos_autorizados.js` entrou) |

Piso por arquivo: só `codigo_de_saida.test.js` mudou — textual **31 → 46**,
executado **29 → 37**. Os treze restantes, inalterados. Nenhum piso caiu.

**`CONTEUDO_DOS_NOMINAIS`, medido e sem folga** (peso = tokens de programa):

| caso | peso | caso | peso |
| --- | --- | --- | --- |
| `SAI-00` | 34 | `SAI-19` | 420 |
| `SAI-02` | 66 | `SAI-20` | 221 |
| `SAI-04` | 67 | `SAI-22` | 73 |
| `SAI-09` | 130 | `SAI-25` | 277 |
| `SAI-17` | 68 | `SAI-29` | 115 |
| `SAI-18` | 68 | `UNI-B4` | 89 |

`PESO_DOS_NOMINAIS` foi **removido do código** — não desativado. Não sobraram
duas autoridades concorrentes: `grep` por `PESO_DOS_NOMINAIS`,
`conferirPesoDosNominais` e `contarAssercoes` nos `.js` da árvore devolve **uma**
ocorrência, e ela é um COMENTÁRIO em `test/guarda_do_portao.js` que explica a
substituição. Zero em programa.

## 5. Campanha da OS 54-C7 — 30 sabotagens materiais + 3 controles

Oráculo: a cadeia oficial inteira. A coluna `conteudo=` é uma segunda leitura na
mesma cópia — a §3 manda atribuir a causa das trivializações à autoridade de
conteúdo, e ela responde mesmo quando outra autoridade reprova primeiro.

Controle de partida **VERDE** (964/87); controle de chegada **VERDE**.

| id | sabotagem | causa na cadeia | voz do conteúdo |
| --- | --- | --- | --- |
| T01–T09 | os **nove** casos `SAI` trivializados, um a um | `CASO NOMINAL TRIVIALIZADO` (T07: `CASOS ENCOLHERAM`) | `CONTEÚDO DO CASO NOMINAL DIVERGE` |
| T10 | `SAI-25` trivializado | idem | idem |
| T11 | `SAI-29` trivializado | idem | idem |
| **T12** | **`X07` — `UNI-B4` trivializado** | `CASO NOMINAL TRIVIALIZADO` | `CONTEÚDO DO CASO NOMINAL DIVERGE` |
| **V13** | **`E38`** — mesmo número de afirmações triviais | `CASO NOMINAL TRIVIALIZADO` | diverge |
| V14 | afirmações duplicadas até o mesmo número | idem | diverge |
| V15 | corpo trocado por ajudante benigno | idem | diverge |
| V16 | conteúdo movido para **comentário** | idem | diverge |
| V17 | conteúdo movido para **string** | idem | diverge |
| **V18** | **recarimbo coordenado** (trivializa + atualiza peso e digest) | `PESO MATERIAL DECLARADO REBAIXADO` | **verde** |
| V19 | autoridade nominal removida do disco | `Cannot find module` | idem |
| V20 | chamada retirada do `pretest` | `CHAMADA AUSENTE NO \`pretest\`` | verde |
| V21 | passo do workflow neutralizado por `echo` | `INVOCAÇÃO AUSENTE` | verde |
| V22 | trivialização **com o piso reduzido junto** | `PISO POR SUÍTE REBAIXADO COM FOLGA` | diverge |
| **P23** | **`E21`** — peso material declarado reduzido | `PESO MATERIAL DECLARADO REBAIXADO` | verde |
| **P24** | **`E22`** — fonte de conteúdo apagada | `CASO PROTEGIDO REMOVIDO DA AUTORIDADE` | verde |
| **P25** | **`E32`** — piso executado rebaixado | `PISO EXTERNO REBAIXADO` | verde |
| **P26** | **`E33`** — piso textual rebaixado | `PISO EXTERNO REBAIXADO` | verde |
| **P27** | **`E34`** — nomes obrigatórios esvaziados | `NOME OBRIGATÓRIO REMOVIDO` | verde |
| P28 | SHA de medição trocado por um conveniente | `SHA DE MEDIÇÃO FORA DA HISTÓRIA` | verde |
| P29 | o arquivo retirado da autoridade ancorada | `caso SAI-30` | verde |
| P30 | coordenada: trivializa **e** neutraliza o piso ancorado | `caso CI-21` | verde |
| **C31** | controle: árvore íntegra | **VERDE** | verde |
| **C32** | controle: prosa nova num caso protegido | **VERDE** | verde |
| **C33** | controle: caso protegido que **cresce** e é redeclarado | **VERDE** | verde |

**33/33 · zero escapes · zero inconclusivas.** `server.js` da árvore real
conferido por hash no começo e no fim (`c8307640…`), zero temporários
abandonados.

**A linha que explica a arquitetura é a `V18`.** O recarimbo coordenado deixa a
autoridade de conteúdo **verde** — a declaração volta a bater com o corpo — e
morre na autoridade ancorada, que compara o corpo de hoje com o corpo do commit.
É por isso que são duas metades e não uma.

## 6. Regressão integral

Sequencial, em bancada limpa, na ordem da §7 da OS:

| campanha | resultado |
| --- | --- |
| `mutacoes_c7.js` | **33/33** · 0 escapes · 0 inconclusivas · controles verdes |
| `mutacoes_c6.js` | **27/27** · controles de partida e chegada verdes (964 casos) |
| `mutacoes_c5.js` | **27/27** · controles verdes |
| `mutacoes_c4.js` | **26/26 conforme** · 0 divergente · 0 inconclusivo · 0 âncora inválida · árvore limpa ao final |
| `mutacoes_cruzada.js` | **24/24** · controles verdes · **`X07` VERMELHO** (era o único escape da C6) |
| `mutacoes_c3.js` | **64/68 conforme** · 4 divergentes · 0 inconclusivo · 0 âncora inválida — ver abaixo |
| `mutacoes_c2.js` | **56/56** · controles verdes · `M28`, `N20` e `N37` voltaram a EXECUTAR |
| `mutacoes_assento.js` | **20/20** · verde de chegada 0 falhas · `server.js` restaurado |
| `mutacoes_costura.js` | **13/13** · verde de chegada 0 falhas · `server.js` restaurado |

`server.js` conferido por hash depois de cada uma das duas que o mutam **no
lugar**: `c8307640324b748a60b30929472ef6ebc6eace7c`, o blob da base, e árvore
limpa nos dois casos.

### As quatro divergências da `mutacoes_c3.js` são HERDADAS

`UPG-B`, `LEG-A`, `PNG-A` e `MEI-A` esperam **VERDE** e dão **VERMELHO**. Os
quatro escrevem um arquivo novo num caminho que **não** cai em nenhuma regra de
exclusão do artefato — `constantes/eventos.js`, e semelhantes. A expectativa foi
escrita na OS 52-C3; a OS 52-**C4** introduziu depois a autoridade do artefato
produtivo, que reprova todo caminho versionado fora do conjunto declarado. O
contraste está no próprio placar da `c4`: `OK-1` — arquivo novo num caminho
EXCLUÍDO (`docs/`) — continua verde.

**Medido, não deduzido.** Os quatro foram rodados numa árvore descartável da
**base `d85adca`**, com a `mutacoes_c3.js` da própria base:

    # PLACAR: conforme=0 · divergente=4 · inconclusivo=0 · total=4

Idênticos. Não são regressão desta OS, e não foram "corrigidos" mexendo na regra
funcional do artefato — o alvo desta OS é outro. Ficam nomeados para quem cuidar
daquela família.

### Um incidente de bancada, e o vazamento que ele revelou

A primeira corrida de `mutacoes_assento.js` fechou com **"verde de chegada: 29
falhas"** numa árvore limpa e com `server.js` no blob da base. A causa não era o
produto:

    [guarda do portão] REPROVADO
    ENOSPC: no space left on device, write

`forjar()`, em `test/arvore_forjada.js`, cria um diretório temporário por
chamada e **nunca o removia**. Cada `npm test` deixa dezenas para trás e cada
campanha roda `npm test` dezenas de vezes: a bancada acumulou **8053**
diretórios órfãos e encheu o disco.

O vazamento foi fechado na fonte (remoção no `exit` do processo, com a falha de
remoção engolida de propósito — limpeza que derruba a suíte troca um problema de
bancada por um veredito falso). Depois disso:

* `npm test` na MESMA árvore: **964/964, exit 0**, zero árvores forjadas
  remanescentes;
* `mutacoes_costura.js`: verde de chegada **0 falhas**;
* `mutacoes_assento.js` **re-executada**: 20/20, verde de chegada **0 falhas**.

Secagens, todas antes de qualquer corrida: **c2 56/56**, **c3 68/68**,
**c5 27/27**, **c6 27/27**, **c7 33/33**, **cruzada 24/24** âncoras válidas e com
efeito. Nenhuma sabotagem sumiu do placar.

## 7. Campanhas reancoradas

| campanha | vetor | literal obsoleto | agora |
| --- | --- | --- | --- |
| `mutacoes_c2.js` | `M28` | `"ci_obrigatorio.test.js": 99,` | linha lida do censo |
| `mutacoes_c2.js` | `N20` | `"casos_minimos": 927,` | piso lido do JSON |
| `mutacoes_c2.js` | `N37` | passo do juiz na forma `run:` | passo lido do workflow |
| `mutacoes_c3.js` | `E6` | linha do censo com comentário de outra OS | linha lida do censo |
| `mutacoes_c3.js` | `PIS-D` | `CASOS_MEDIDOS_NA_BASE = 883` | **reconstituído** — constante lida da suíte |
| `mutacoes_c3.js` | `REC-B` | idem, duas constantes | **reconstituído** |
| `mutacoes_c6.js` | `C21` | `956`, o carimbo, `31` e `29` | tudo lido dos arquivos |

`PIS-D` e `REC-B` **não foram retirados do placar**: a propriedade que eles
medem continua existindo (o piso do piso ainda mora em
`test/ci_obrigatorio.test.js`), e só o literal estava velho.

`mutacoes_c3.js` ganhou `--secar`, que não existia: copia a árvore, roda a
secagem **dentro da cópia** e confere `server.js` por hash antes e depois.

## 8. Preservação — por blob, contra `d85adca`

| caminho | blob |
| --- | --- |
| `server.js` | `c8307640324b748a60b30929472ef6ebc6eace7c` |
| `app.html` | `8a223df08b1c92fd1f1438d3a9055f076fd6de60` |
| `package.json` | `87f12f3b5d3629b5a99a603e9c7f66d5cb76c28d` |
| `contrato/chat-transporte-v1.json` | `d7d4f4613a6508f67527fa391deb3ba89cdf87df` |
| `contrato/descoberta-mesas-v1.json` | `e6b34a0f4015223f6db41b130c90d15e40f99e85` |
| `ci/artefato.js` | `52a802dc28b31e88cec14bd633bcf9337d5eaadb` |
| `ci/portao_do_ci.js` | `06f2cb93162e90fecb7da7329807c935fb3468f3` |
| `ci/inventario_de_execucao.js` | `ef0141b187228639e7f5a4822bf7f3f5a4eb62cc` |
| `ci/invocacao_executavel.js` | `ce6879778d2eb2fca6f091515c1def5e58ca8489` |
| `.github/actions/portao/action.yml` | `375f895412ae52a8c88bcfb7f00094e7aa20fa70` |
| `.github/actions/portao/index.js` | `1b70158870bc251e5c8f52bd02234999cfa080f8` |

Todos **idênticos**. O workflow mudou **só por adição**: um passo novo
(`Conteúdo dos casos nominais`) e o comentário dele. Nenhuma linha removida —
gatilhos, branches, permissões, upload, resumo, a forma `uses:` do juiz e as
entradas `saida`/`marcador` intactos.

## 9. Pendência operacional herdada

Conferir os **bytes** do artefato publicado exige acesso autenticado ao
provedor, que esta bancada não tem. O que está provado localmente é o
**conjunto**: `git archive` de `HEAD` devolve `[package.json, server.js]`, e a
autoridade do artefato compara contra `HEAD`, `HEAD^` e a base medida.
