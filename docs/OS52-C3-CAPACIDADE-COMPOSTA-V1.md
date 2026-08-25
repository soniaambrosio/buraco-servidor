# OS 52-C3 — Unicidade do servidor por capacidade COMPOSTA da árvore

Base: `4577048536fd3a674fbd97559080138b837704db`
(branch `correcao/os52-c2-unicidade-por-capacidade-v1`, pai `750a012e65b6fd9a62e6f6871d45e3f12bd8a03e`)

## O que a OS 52-R2 derrubou

A C2 fechou os nove escapes da R1 e trocou a detecção por nome e extensão pela
detecção por **capacidade executável**. Ficou boa para o servidor que cabe num
arquivo — e a R2 mostrou a premissa escondida: **a decisão era tomada arquivo a
arquivo, e capacidade não é propriedade de arquivo**.

Uma duplicata implantável partida em dois arquivos — um cria o servidor, o outro
chama `.listen()` — subiu de verdade numa porta isolada, respondeu HTTP 200 e
atravessou `npm test` (734/734), o juiz e o pipeline inteiros. Nenhum dos dois
arquivos, sozinho, formava capacidade.

## O desenho: resumo por arquivo, decisão sobre o conjunto

A análise passou a ter duas camadas.

**1. Resumo por arquivo**, com dois tipos de sinal — e a distinção é a espinha
do desenho:

* **sinais de programa**, medidos depois do scanner léxico, sobre o que
  EXECUTA. São eles que **compõem** entre arquivos: criar, escutar, vincular
  porta, declarar ingresso, despachar caso, conceder assento;
* **sinais brutos**, medidos no texto cru porque vivem dentro de literais que o
  scanner esvazia (o GUID do RFC 6455, o cabeçalho do handshake, a palavra
  `entrarMesa`, o nome do módulo do bundle). Esses **não compõem** entre
  arquivos: texto no arquivo A não vira código no arquivo B. É essa regra que
  impede prosa de virar capacidade quando existe um servidor noutro canto.

**2. Decisão sobre o conjunto**, em três escopos:

| escopo | o que é | como se forma |
|---|---|---|
| `arquivo` | o arquivo sozinho | sinais do próprio arquivo |
| `conjunto` | a componente conexa do grafo de ligação | `require`, `__require`, `import`, `from`, com especificador relativo resolvido para arquivo que EXISTE na árvore |
| `arvore` | a união residual, sem o portador | pega a fragmentação que não declara ligação nenhuma |

Em qualquer escopo o veredito de um arquivo `F` é calculado sobre
`sinais brutos de F` + `sinais de programa do escopo`.

**A acusação tem endereço.** Num escopo composto só é acusado o arquivo que
CONTRIBUI com pelo menos um dos sinais do ramo, e a mensagem nomeia os outros
contribuintes. Sem essa regra a fragmentação deixaria sessenta linhas idênticas
apontando para todo lado menos para os dois arquivos culpados — vermelho
ilegível é quase tão ruim quanto verde indevido. No escopo `arvore` o veredito é
**consolidado**: uma linha por ramo, com os contribuintes nomeados.

**O portador não conduz e não contribui.** `server.js` é a autoridade
autorizada: os sinais de programa dele não entram em união nenhuma, e arestas
que o tocam não juntam componentes. Sem isso toda suíte que exercita o bundle
herdaria a capacidade dele, e a guarda reprovaria a árvore íntegra — que é como
uma guarda nova morre, removida por incômodo.

## Matriz de capacidades e ramos

| ramo | condição | escopo máximo | cenário exclusivo |
|---|---|---|---|
| `REDE` | `criaServidor && escuta` | árvore | `FRG-01` |
| `ESCUTA-DE-PORTA` | `escutaPorta` | árvore | `CAP-11` |
| `PORTA-NO-CONSTRUTOR` | `portaNoConstrutor` | árvore | `CAP-09` |
| `DATAGRAMA` | `criaSoquete && vinculaPorta` | árvore | `UDP-01` |
| `HANDSHAKE-GUID` | `guid && (criaServidor \|\| escuta \|\| ouveUpgrade)` | arquivo | `CAP-04` |
| `HANDSHAKE-UPGRADE` | `cabecalhoDeHandshake && ouveUpgrade && (escuta \|\| criaServidor \|\| portaNoConstrutor)` | arquivo | `UPG-01` |
| `INGRESSO-DECLARADO` | `declaraIngresso && concedeAssento` | árvore | `ASS-01` |
| `INGRESSO-DESPACHADO` | `despachaCaso && mencionaEntrarMesa && concedeAssento` | árvore | `DES-01` |
| `ARRANQUE` | `arranqueChamado && mencionaModuloDoBundle` | arquivo | `ARR-01` |

Três ramos são **só de arquivo** porque dependem de sinal bruto, e sinal bruto
não atravessa arquivo. A fragmentação de um servidor WebSocket continua pega:
quem parte criação e escuta cai em `REDE`, que compõe.

Dois ramos têm **um sinal só**, e é deliberado: `.listen(3000)` e
`X…Server({ port })` em posição executável não são menção — são a chamada que
abre a porta. O que os separa de prosa é o scanner léxico, que apaga string,
comentário e regex antes de a medição começar.

## As correções, uma a uma

**C3-01 — capacidade composta no conjunto.** Feito: componente conexa do grafo
de ligação mais o escopo residual da árvore. Cobre A cria / B escuta, A exporta
/ B inicia, `require`, `__require`, `import`, `from`, mesmo diretório,
diretórios diferentes e três ou mais arquivos na mesma porta.

**C3-02 — arranque real do transporte.** O `\brequire` da C2 não casava depois
de `_`, e o bundle real chama `__require("ws_server").iniciar()`. O prefixo de
identificador passou a ser aceito. Cenário negativo próprio: `ARR-01` (por
`__require`, em arquivo textual), `ARR-02` (por `require`) e `ARR-03` (por
auxiliar).

**C3-03 — handshake e upgrade alcançáveis.** `on("upgrade", …)` vira `on("", …)`
depois do scanner, e a C2 procurava a palavra no programa — não achava o caso
real e achava toda prosa que explicasse o handshake. O sinal passou a exigir a
FORMA executável (registro de ouvinte com literal) casada com o literal bruto.
Cenário executável: `UPG-01`. Cenários que têm de PASSAR: `OK-08` (a palavra só
em string) e `OK-09` (prosa com todos os tokens, inclusive o GUID).

**C3-04 — portas abertas sem `.listen()`.** Entraram `new WebSocketServer({port})`,
`WebSocketServer({port})` por fábrica, `app.listen(…)`, `server.listen(…)`,
`dgram.createSocket(…).bind(…)` e os aliases de `.listen` e de `.bind`. O
argumento é lido com **parênteses balanceados** — foi um parêntese no meio de
`bind(Number(process.env.PORT_UDP) || 41234)` que deixou o UDP passar na C2.

**C3-05 — concessão de assento por semântica.** `assentos[i] =` virou uma
escrita entre sete: índice, par assento/código, `Map.set` numa coleção de
assentos, `set` de coleção com outro nome, função auxiliar que senta alguém,
objeto devolvido com assento confirmado e recusa tipada, e atribuição indireta
de jogador a lugar. Os positivos legítimos (contrato JSON, `app.html`,
comentário) continuam passando.

**C3-06 — cobertura obrigatória dos ramos.** Cada ramo tem cenário exclusivo
declarado em `RAMO_EXERCITADO_POR`, no catálogo — **fora** da implementação que
ele cobra. A prova externa confronta nos dois sentidos: todo ramo da tabela tem
de estar declarado, todo declarado tem de existir na tabela, e todo ramo tem de
ter DISPARADO de verdade em algum cenário. A observação é do laudo da regra, não
de um contador que ela mantenha.

> Foi assim que apareceu que a C2 tinha um **ramo morto**: o handshake por GUID
> nunca disparava, porque a fixture montava o GUID por concatenação e o texto
> contíguo jamais existia no arquivo escrito. Verde por três semanas.

**C3-07 — fechamento do encolhimento coordenado.** A autoridade do piso passou a
ser o **commit anterior** (`test/piso_ancorado.js`). Um commit é imutável: não
existe edição na árvore de trabalho que baixe o que `HEAD` e `HEAD^` declaram.
Não é uma terceira fonte paralela — é o MESMO `ci/piso_do_portao.json`, o MESMO
`test/censo_de_suites.js` e a MESMA lista de suítes, lidos de onde não dá para
editá-los. A regra é de monotonicidade: **nada do que já foi medido pode
diminuir**.

A amarração está em quatro lugares que se cobram: o censo, a etapa `pretest`, a
suíte do CI (CI-17/CI-18/CI-19) e o **juiz** (`ci/portao_do_ci.js`), que roda num
passo separado do workflow e reprova quando o arquivo some ou quando a chamada é
removida com o corpo intacto.

## Pisos

| | casos | suítes |
|---|---|---|
| base `4577048` | 734 | 80 |
| OS 52-C3 | **786** | **83** |

Os pisos por suíte foram **remedidos e alinhados à contagem real**, sem folga —
a C2 declarava 16 para um arquivo com 18 casos, e a diferença é espaço para
apagar dois casos sem que nada reprove (residual registrado pela R2).

## Preservações

`server.js`, `app.html`, `package.json`, `contrato/chat-transporte-v1.json`,
`contrato/descoberta-mesas-v1.json` e o workflow saem daqui **byte a byte** como
entraram — conferido por blob contra `4577048`. Nada de deploy, release, tag,
segredo ou mudança de permissão.

Continuam de pé: varredura recursiva integral, detecção de compactados por magic
bytes (ZIP, TAR, GZIP, XZ, BZIP2, 7z, RAR, ZSTD), pacote sem extensão, extensão
falsa, pacote truncado, teto de entradas, isenção por análise sem allowlist de
caminhos, reciprocidade comportamental sem digest, guarda do glob oficial, juiz
fail-closed, workflow externo, resumo e artefato.

## Residuais da R2 — classificação

| residual | decisão |
|---|---|
| profundidade de inventário declarada e não aplicada | **corrigido**: o campo foi REMOVIDO, e há asserção para que não volte como enfeite. Não faz falta — compactado é reprovado por SER compactado, em qualquer aninhamento. |
| arquivos acima de 32 MiB truncados em silêncio | **corrigido**: truncar passou a REPROVAR (`GRANDE-DEMAIS`). O que a guarda não lê inteiro ela não audita, e "não li" não pode sair como "não achei". |
| symlinks ignorados sem justificativa | **corrigido**: elo simbólico é reprovado com nome próprio. O alvo mora fora da árvore versionada e não é auditável por leitura. |
| comentário incorreto "682 casos" | **corrigido**: o histórico real da linhagem está escrito por extenso em `test/ci_obrigatorio.test.js` e em `ci/piso_do_portao.json`. |
| piso por suíte rebaixável | **corrigido**: cada piso é a contagem real, e `piso_ancorado` só permite que ele desça acompanhando o conteúdo do arquivo — nunca abrindo folga. |
| mapeamento incorreto dos rótulos da R1 | **permanece, declarado**: o laudo da R1 não está disponível nesta sessão, como já não estava na C2. Os nove vetores são preservados pela SUBSTÂNCIA descrita nos requisitos (`M06b/c/d`, `M08b/c`, `M13b`, `M16`, `M17b/c` em `mutacoes_c3.js`), e o mapa rótulo→vetor segue **inferido**. Não permite verde indevido: os nove cenários rodam e terminam vermelhos qualquer que seja o rótulo correto. |
| campanha "33/34" não versionada | **corrigido**: a campanha inteira vive em `mutacoes_c3.js`, no repositório, e roda com `node mutacoes_c3.js`. |

## O limite que continua aberto, dito em voz alta

Quem apagar `test/piso_ancorado.js` **e** as quatro amarrações dele (censo,
`pretest`, suíte do CI e juiz) volta ao estado anterior. Isso é uma alteração
maior e em quatro arquivos que se cobram mutuamente, e não é o ataque que a R2
descreveu — mas é possível. Nenhum mecanismo dentro de um repositório escapa
dessa circularidade: a última guarda é sempre removível por quem tem escrita. O
que se pode fazer, e o que esta correção faz, é tornar **cada passo do
encolhimento vermelho antes do seguinte** — e é isso que os vetores `AUT-A`,
`AUT-B` e `AUT-C` da campanha medem.

Reescrever história (force-push) também derrubaria a âncora. Não é recarimbo
silencioso: aparece.

## Campanha

`node mutacoes_c3.js` — **68 vetores, 68 conformes**, injetados de verdade na
árvore de trabalho e julgados pelo portão oficial, com a árvore conferida antes
e depois de cada um. Controle de integridade verde nas duas pontas, zero
inconclusivos, zero âncoras inválidas. O laudo completo, com o antes e depois
dos seis vetores da R2, a prova funcional de E1 e os três divergentes da
primeira volta, está em `docs/OS52-C3-PLACAR.md`.
