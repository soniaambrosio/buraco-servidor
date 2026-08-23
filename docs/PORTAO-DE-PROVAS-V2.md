# Portão de provas V2 — integridade e execução real

Entregue pela **OS 23.1-P-C2**, sobre a folha da C1
(`correcao/os23-1-p-c1-gate-produtor-v2` @ `7a858b1`).
Fecha os dois falsos-verdes que a **OS 23.1-P-R1** mediu e reproduziu.

> **Contrato de prova v4.** A primeira volta da C2 (`55b5a64`) fechou os dois
> falsos-verdes da R1 e foi auditada de novo antes de virar entrega. A auditoria
> achou **dez escapes** que sobreviviam a ela — inclusive o padrão exato da
> R1/2.2 vivo numa segunda lista. A seção 8 registra o que era, o que fechou, e
> o que ficou de residual.
>
> **A terceira volta (OS 23.1-P-C3)** fecha os dois escapes que a **OS 23.1-P-R2**
> mediu em `c9edff1`, os dois com `npm test` verde: `FORJA-01` (o identificador
> obrigatório não estava atribuído ao arquivo) e `FER-02` (o executor podia ser
> neutralizado com o digest realinhado). O comando oficial passou a ser um trio —
> `pretest`, `test`, `posttest` — e a seção 9 registra a arquitetura, as provas
> novas e o residual atualizado.

Nenhuma linha funcional do Produtor V2 foi tocada: `server.js`,
`test/produtor_v2.test.js`, `mutacoes_composicao.js`, `mutacoes_os7.js`,
`contrato/` e o restante de `docs/` estão byte a byte idênticos a
`e0c7560` — a entrega funcional original da OS 23.1-P.

---

## 1. Os dois defeitos, e por que eles aconteceram

### 1.1 Execução zero aceita como sucesso

O comando oficial da C1 era uma cadeia de shell:

```json
"test": "node ferramentas/gate-de-provas.js && node --test \"test/*.test.js\""
```

Trocando `&&` por `;`, o portão ficava **verde com zero testes executados**:

```
> node ferramentas/gate-de-provas.js ; node --test "test/*.test.js"
gate de provas: 2 suites obrigatorias conferidas (contrato v1) · OK
EXIT=0
```

**Causa técnica.** O npm executa scripts pelo `cmd.exe` no Windows, e o
`cmd.exe` **não trata `;` como separador de comandos** — ele o entrega como
argumento. A guarda recebia `argv = [";", "node", "--test", "test/*.test.js"]`,
ignorava o que não reconhecia, imprimia a mensagem de sucesso e saía com
código 0. O `node --test` nunca era invocado.

O `GS-04` da C1 existia exatamente para este caso e estava **correto** — mas
vivia dentro do glob que deixara de rodar. A metade que sempre rodava, a guarda
externa, lia o script como texto e nunca modelava o shell.

A lição não é "escolher melhor o operador". É que **quem imprime o veredito tem
de ser quem executou as provas**.

### 1.2 Conteúdo relevante substituível por teste trivial

As defesas da guarda eram condicionais ao campo existir:

```js
if (s.digestSha256 && digest !== s.digestSha256) { … }
if (Number.isInteger(s.pisoDeCasos) && casos < s.pisoDeCasos) { … }
for (const bloco of s.blocosNormativos || []) { … }
```

Apagando os três campos da entrada — e **mantendo o `caminho`** — a proteção
degradava para exatamente o que a OS proíbe: *nome do arquivo* e *existência do
arquivo*. `test/produtor_v2.test.js` podia então virar
`test("irrelevante", () => {})` com o portão verde.

O `GS-05` guardava o contrato, mas conferia apenas que os dois **caminhos**
estavam listados. Apagar a entrada inteira acendia; desarmá-la campo a campo,
não — e o efeito era o mesmo.

---

## 2. A arquitetura

Um comando, dois scripts, cinco estágios. Nenhum encadeamento de shell.

```json
"pretest": "node ferramentas/gate-de-provas.js",
"test":    "node ferramentas/portao.js"
```

| Peça | Onde vive | Responde por |
|---|---|---|
| `ferramentas/contrato-de-provas.json` | fora das suítes e das ferramentas | a lista versionada: caminhos, digests, pisos, blocos, **casos obrigatórios**, alvo de execução, comandos oficiais |
| `ferramentas/gate-de-provas.js` | fora do alvo, roda no `pretest` **e** dentro do portão | integridade: existe, é alcançada, digest bate, blocos, piso, casos presentes, ferramentas íntegras, comandos exatos |
| `ferramentas/portao.js` | fora do alvo, é o comando oficial | executa, conta, sela o marcador e decide |
| `test/gate_sobrevivencia.test.js` | **dentro** do alvo | que os comandos continuam exatos e que as **ferramentas** continuam íntegras |

### Por que `pretest`, e não uma cadeia

O `pretest` é executado pelo npm **por semântica própria**, não por operador de
shell: se ele sai diferente de zero, o npm aborta antes do `test`. Isso fecha o
único caminho que sobrava depois de tirar o encadeamento — **neutralizar o
próprio portão**. Sem o `pretest`, esvaziar o `main()` de `portao.js` daria
verde, porque o portão era o seu próprio primeiro conferente. Com ele, a guarda
roda antes e confere o **digest do portão**, sem que o portão precise cooperar.

E remover o `pretest` também acende: o contrato declara os **dois** scripts, e
a guarda exige os dois exatos (`COMANDO_OFICIAL_AUSENTE`).

### Os cinco estágios do portão

| | Estágio | Pergunta que responde |
|---|---|---|
| 1 | integridade | as provas existem, estão registradas e não foram adulteradas? |
| 2 | execução | o `node --test` rodou de verdade, e com que código saiu? |
| 3 | contabilidade | quantos casos **terminaram**, e todos os obrigatórios passaram? |
| 4 | marcador | registro selado do que aconteceu — só escrito depois de 1–3 |
| 5 | agregador | relê o marcador do disco, confere o selo, e só então aprova |

Saída do caminho feliz:

```
[1/5] integridade: 2 suites obrigatorias conferidas (contrato v2)
[2/5] execucao: node --test --test-reporter=tap test/*.test.js
[3/5] contabilidade: 572 casos executados e aprovados (80 blocos), 0 falhas, 0 pulados
      test/produtor_v2.test.js: 61/61 casos obrigatorios aprovados
      test/gate_sobrevivencia.test.js: 14/14 casos obrigatorios aprovados
[4/5] marcador: ferramentas/.marcador-de-execucao.json selado
[5/5] agregador: marcador conferido — 572 provas executadas, 0 falhas

PORTAO: APROVADO (integridade + execucao real + contabilidade + marcador selado)
```

O TAP bruto fica suprimido no verde e é despejado inteiro no vermelho. Quem
quiser o detalhe tem `npm run test:marcador`.

### O selo do marcador

O `nonce` nasce no início do processo e vive só na memória. O marcador leva um
HMAC-SHA-256 das contagens chaveado por ele, e o estágio 5 relê o arquivo do
disco antes de aprovar. Um marcador fabricado à mão — ou sobrado de outra
execução — não tem como conhecer o nonce. O portão também **apaga** o marcador
anterior antes de qualquer coisa, para que sobra nunca vire resultado.

*"Marcador existe" nunca vira "suíte aprovada".*

---

## 3. As três defesas de conteúdo, e o que cada uma pega

- **digest SHA-256** — torna qualquer alteração um ato deliberado: mexeu,
  atualiza o contrato no mesmo commit. É a única que pega *"arquivo presente,
  prova ausente"*;
- **blocos normativos** (prefixo do `describe`) — impedem que uma CATEGORIA
  inteira suma. Casar por prefixo deixa o título ganhar subtítulo sem quebrar;
- **casos obrigatórios por ID** — os identificadores estáveis (`C-01`, `D3-07`,
  `GS-04`…) declarados **fora** do arquivo que protegem. A guarda confere a
  presença textual; o portão exige que cada um tenha **realmente passado** na
  execução. É a defesa contra reduzir a suíte preservando só a aparência, e
  contra marcar um caso obrigatório como `skip`;
- **piso de casos** e **piso global** — auxiliares, **nunca** a autoridade: 61
  `test("x", () => {})` vazios passariam pelo piso e morreriam no digest.

A expectativa **não mora dentro da suíte protegida**. Declarar um digest em
comentário dentro do próprio arquivo adulterado não muda nada — é o que a
sabotagem `E10` prova.

---

## 4. Uma sutileza de contagem que muda o veredito

O `node --test` conta como *test* o próprio **arquivo** quando ele não declara
caso nenhum: um `test/vazia.test.js` sem uma linha de `test()` produz
`# tests 1 / # pass 1` e sai com código 0.

Ler só o rodapé faria *"nenhuma prova existe"* parecer *"uma prova passou"* — a
mesma família de engano da R1, um andar abaixo. Por isso cada `ok` é
classificado pelo `type:` que o próprio TAP declara: `suite` é estrutura,
`test` cujo nome termina em `.test.js` é envelope de arquivo, e só o que sobra
conta como **caso executado**. Um arquivo executado sem declarar caso nenhum é
`ARQUIVO_SEM_PROVA`.

Diretivas `# SKIP` e `# TODO` viajam como `ok` no TAP e **não** são aprovação.

---

## 5. Códigos de recusa

| Código | Significado |
|---|---|
| `CONTRATO_AUSENTE` / `CONTRATO_ILEGIVEL` | a lista do que é obrigatório sumiu ou não é legível |
| `SEM_VERSAO` / `LISTA_VAZIA` | contrato sem versão, ou esvaziado |
| `SEM_CAMPOS_OBRIGATORIOS` | o contrato deixou de exigir as defesas das entradas |
| `CAMPO_OBRIGATORIO_AUSENTE` | uma entrada não carrega digest, piso, blocos ou casos |
| `FERRAMENTA_AUSENTE` / `FERRAMENTA_ADULTERADA` | a guarda ou o portão sumiram ou mudaram sem o contrato |
| `COMANDO_OFICIAL_AUSENTE` / `COMANDO_OFICIAL_DIVERGENTE` | `pretest`/`test` sumiram ou deixaram de ser exatos |
| `SEM_PADROES_DE_EXECUCAO` | o contrato não declara alvo — nada roda |
| `ARGUMENTO_INESPERADO` | argumento não reconhecido; tipicamente um `;` engolido pelo `cmd.exe` |
| `SUITE_AUSENTE` | apagada, renomeada ou movida |
| `FORA_DO_COMANDO` | existe no disco e o alvo não a alcança |
| `ABAIXO_DO_PISO` / `ABAIXO_DO_TOTAL_MINIMO` | a suíte, ou o conjunto, encolheu |
| `BLOCO_NORMATIVO_AUSENTE` | uma categoria normativa inteira sumiu |
| `CASO_OBRIGATORIO_AUSENTE` | o ID sumiu do arquivo |
| `CASO_OBRIGATORIO_NAO_EXECUTADO` | o ID está no arquivo e não passou na execução |
| `ZERO_TESTES` / `ARQUIVO_SEM_PROVA` | nenhuma prova executada |
| `PROVAS_VERMELHAS` | há teste reprovando — falha de prova, não de portão |
| `RELATORIO_ILEGIVEL` | o TAP não trouxe contagens; código zero não basta |
| `MARCADOR_ILEGIVEL` / `MARCADOR_NAO_CONFERE` / `MARCADOR_DIVERGENTE` | o selo não descreve esta execução |

---

## 6. Manutenção

Alteração legítima de uma suíte obrigatória, da guarda ou do portão exige
atualizar o contrato **no mesmo commit**:

```
npm run test:digests      # recalcula digests, pisos e casos obrigatórios
npm run test:integridade   # só a conferência estática
npm run test:marcador      # o marcador da última execução
```

O piso global `execucao.totalMinimoDeTestes` também é versionado. Se a suíte
crescer, ele pode subir; se encolher, a redução tem de ser deliberada.

Os digests são de conteúdo **normalizado para LF**. O repositório está em CRLF
e o `autocrlf` do git pode trocar o EOL no checkout — digest de bytes crus daria
falso vermelho por causa do sistema de arquivos, e um gate que dá falso vermelho
é desligado na primeira semana.

---

## 7. Campanha negativa

`node mutacoes_sobrevivencia.js` — **42 sabotagens, 42 detectadas**, cada uma
com o **código de recusa** exigido. Roda numa cópia em diretório temporário;
nada é escrito na árvore de trabalho.

Composição das 42: as **10 originais** da C1 (`S1`–`S10`), os **2 bloqueios**
da R1 (`R1-A`, `R1-B`), **20 endurecimentos** (`E1`–`E18`, `E4b`, `E4c`) e a
remoção **individual** de cada um dos **10 blocos** normativos.

Duas regras de método, herdadas e mantidas:

1. **exigir o código, não só o vermelho.** Uma sabotagem que derruba o comando
   por qualquer motivo pareceria detectada sem que a defesa existisse;
2. **isolar a defesa sob teste.** Remover um bloco também muda o digest — a
   sabotagem tem de realinhar digest e piso, senão mede o digest e não o bloco.
   O mesmo vale para o piso global ao medir um caso `skip`.

### O limite honesto

Não existe proteção absoluta contra apagar tudo de uma vez, e a OS não pede
isso. O que existe é que **qualquer remoção parcial acende alguma coisa**, e a
remoção total vira um diff grande e deliberado.

Fora do alcance desta arquitetura, e registrado como tal: `buraco-servidor` não
tem CI. Enquanto isso for verdade, o portão depende de alguém digitar
`npm test`. Isso é matéria de arbitragem, não desta correção.

---

## 8. A segunda volta: validade não é presença

A primeira volta da C2 cobrou que a entrada obrigatória **carregasse** os
campos de defesa (`camposObrigatoriosPorSuite`). A auditoria seguinte mediu o
que sobra quando *carregar* é tudo que se pede — e o que sobra é muito.

### 8.1 Os dez escapes

Todos medidos pelo comando oficial (`npm test`), numa árvore descartável, com
a folha `55b5a64` intacta. Todos saíam **verdes**.

| # | sabotagem | por que passava |
|---|---|---|
| 1 | `id` removido da entrada | nada conferia `id`; ele não estava na lista de campos |
| 2 | `id` vazio | idem |
| 3 | `id` só com espaços | `"   "` não é `""`: passava pela checagem de vazio |
| 4 | `id` duplicado nas duas entradas | não havia checagem de unicidade |
| 5 | `pisoDeCasos: 0` | o piso vira `casos < 0`, que nunca é verdade |
| 6 | `pisoDeCasos: -1` | idem |
| 7 | `pisoDeCasos: 61.5` | `Number.isInteger(61.5)` é falso: o `if` inteiro era pulado |
| 8 | `pisoDeCasos: "61"` | idem — string não é inteiro, e a comparação sumia |
| 9 | digest de `portao.js` apagado **+ `portao.js` esvaziado** | `if (f.digestSha256 && …)` |
| 10 | `ferramentasProtegidas: []` **+ `portao.js` esvaziado** | `for (const f of [])` não confere nem reclama |

Os dois últimos são a falha grave, e merecem o nome certo: **é o falso-verde
R1/2.1 de volta por outra porta**. Com o digest desarmado, dava para trocar o
`main()` do portão por um `console.log("PORTAO: APROVADO")` e obter:

```
> npm test
integridade das provas: 2 suites obrigatorias conferidas (contrato v2)
PORTAO: APROVADO (integridade + execucao real + contabilidade + marcador selado)
EXIT=0
```

Zero testes executados. A mensagem inteira é literal, e é mentira.

O padrão `if (campo && …)` tinha sido corrigido nas suítes e **sobreviveu
intacto na lista de ferramentas**, que a própria C2 havia criado. Corrigir uma
ocorrência de um padrão não corrige o padrão.

### 8.2 O que fechou

**Um schema, não uma lista de nomes.** Cada campo obrigatório passou a ter um
validador (`VALIDADORES`, em `gate-de-provas.js`):

| campo | regra |
|---|---|
| `id` | texto não vazio depois de `trim`, único no contrato |
| `caminho` | relativo, dentro do repositório, único, existente |
| `digestSha256` | `/^[0-9a-f]{64}$/i` |
| `pisoDeCasos` | inteiro **estritamente positivo** |
| `blocosNormativos` | lista não vazia de textos não vazios |
| `casosObrigatorios` | lista não vazia de textos não vazios |

Campo ausente é `CAMPO_OBRIGATORIO_AUSENTE`; campo presente e inválido é
`CAMPO_OBRIGATORIO_INVALIDO`. A distinção existe porque as duas coisas são
reprovação, mas só a segunda é fácil de confundir com uma configuração legítima
ao ler o diff.

**Recusar, não estourar.** `caminho` ausente fazia `path.join(RAIZ, undefined)`
lançar `TypeError`. Vermelho, sim — mas vermelho de código quebrado, que a
seção 10 da OS recusa como prova ("uma falha de sintaxe acidental não substitui
a prova de que a defesa correspondente funcionou"). Entradas com caminho
inválido são anotadas e **puladas**, e `GS-18` exige o código estável junto com
a ausência de `TypeError` na saída.

**A cobertura das ferramentas vem do disco.** Enquanto `ferramentasProtegidas`
fosse a autoridade sobre o próprio tamanho, esvaziá-la desprotegia tudo de uma
vez. Agora quem enumera é `ferramentas/*.js`: toda peça presente **tem** de
estar declarada, com digest válido. Lista vazia deixou de ser "nada a
conferir" e passou a ser `FERRAMENTA_NAO_DECLARADA`, duas vezes.

É o mesmo princípio das coleções derivadas: **duas listas digitadas divergem;
uma lista derivada não tem como.**

### 8.3 Espelhamento externo (seção 9 da OS)

`GS-15`..`GS-21` cobram de fora o que a guarda cobra de dentro, rodando a
guarda de verdade numa caixa de areia e lendo o código de recusa:

| prova | o que congela |
|---|---|
| `GS-15` | `id` e `caminho` estão entre os campos obrigatórios |
| `GS-16` | piso `0`, negativo, fracionário e string reprovam |
| `GS-17` | `id` ausente, vazio, em branco e duplicado reprovam |
| `GS-18` | `caminho` inválido **recusa** em vez de estourar |
| `GS-19` | digest não hexadecimal ou de tamanho errado reprova |
| `GS-20` | toda peça de `ferramentas/` está declarada e bate |
| `GS-21` | desarmar o digest não libera adulterar a ferramenta |

A guarda está sob digest, então alterá-la para ignorar uma checagem acende
`FERRAMENTA_ADULTERADA` no `pretest` — antes de a checagem alterada rodar.
As sabotagens `V12` e `V13` medem exatamente isso.

### 8.4 O residual, dito por inteiro

**Invocação direta de um portão adulterado.** As sabotagens 9 e 10 acima são
detectadas pelo comando oficial, porque quem as pega é o `pretest` — uma etapa
que o **npm** garante, não o portão. Rodando `node ferramentas/portao.js`
**diretamente**, com o `main()` esvaziado *e* o digest desarmado no mesmo ato,
não há quem acenda: um arquivo não pode ser a autoridade sobre a própria
integridade.

Isso não é conserto pendente, é o limite da forma. O que existe é: o comando
oficial é `npm test`, e por ele as duas sabotagens são vermelhas; e o desarme
exige editar o contrato, que é um diff visível e deliberado. Quem auditar este
portão deve auditar **`npm test`** — invocar o portão à mão pula, por
construção, a metade externa do mecanismo.

**Cardinalidade de `casosObrigatorios`.** Reduzir a lista no contrato (de 61
para 1, por exemplo) é aceito pela guarda: `listaDeTextos` só exige que não
seja vazia. É a mesma escolha de sempre — a expectativa mora no contrato, e
mexer nela é um ato auditável no diff, não uma perda silenciosa.

### 8.5 Cuidado ao rodar as campanhas

`mutacoes_composicao.js` e `mutacoes_os7.js` mutam o **`server.js` real**, em
vez de uma cópia, e restauram no fim. Uma execução **interrompida** deixa a
mutação na árvore de trabalho — e a próxima leitura acusa "a base já está
vermelha", que parece defeito do servidor e é resíduo do arnês. Confira
`git status` depois de qualquer campanha interrompida.

(`mutacoes_sobrevivencia.js` não tem esse problema: ele monta uma cópia
descartável e nunca escreve no original.)

## 9. A terceira volta: atribuição e executor (OS 23.1-P-C3)

A rehomologação independente da C2 (OS 23.1-P-R2) fechou dois escapes, os dois
com `npm test` **verde** e `exit 0`, e os dois pela mesma pergunta mal feita:
*a expectativa está atribuída a quem tem de cumpri-la?*

### 9.1 `FORJA-01` — o identificador não estava preso ao arquivo

O portão juntava os identificadores aprovados num `Set` **plano**, somado de
todos os arquivos, e depois perguntava apenas *"o `C-01` está aí?"*. Então:

1. `test/produtor_v2.test.js` vira casca — os dez `describe` normativos ficam
   vazios e os 61 `test("<ID>: …")` vão para dentro de um `if (false)`;
2. digest e piso são **realinhados pelo procedimento documentado** (§6), o que
   deixa a guarda impecável: o texto ainda tem 61 ocorrências de `test(` e ainda
   contém os 61 identificadores;
3. um `test/zz_falso.test.js` **não registrado** executa os mesmos 61 nomes.

Saída: `PORTAO: APROVADO`, e a linha
`test/produtor_v2.test.js: 61/61 casos obrigatórios aprovados` **sobre um arquivo
que executou zero**. Nenhuma ferramenta havia sido tocada.

**O conserto: atribuição por arquivo de origem.** A pergunta passou a ser *"o
`C-01` passou **no arquivo que o contrato manda prová-lo**?"*.

O relatório TAP **não carrega essa informação**. Quando um arquivo declara
`describe`/`test` no topo, o executor iça os blocos para o nível raiz do
relatório e o nome do arquivo simplesmente não aparece — só o arquivo *vazio*
vira uma linha com nome de arquivo. Não há, no TAP, o que atribuir. A *stream de
eventos* do executor, essa sim, carrega `file` em cada `test:pass`/`test:fail`.

Daí `ferramentas/relator-de-atribuicao.js`: um `--test-reporter` que escreve uma
linha JSON por evento. O TAP continua sendo emitido **em paralelo, no mesmo
processo**, e toda a contabilidade da C2 continua lendo o TAP palavra por
palavra — nada do que ela afirma passou a depender da peça nova.

O que a atribuição acrescenta ao veredito:

| código | o que pega |
|---|---|
| `CASO_OBRIGATORIO_FORA_DO_ARQUIVO` | o ID passou, mas em **outro** arquivo |
| `CASO_OBRIGATORIO_NAO_EXECUTADO` | o ID não passou em lugar nenhum |
| `ABAIXO_DO_PISO_EXECUTADO` | o arquivo executou menos casos que seu piso |
| `ATRIBUICAO_AUSENTE` / `ATRIBUICAO_VAZIA` | não há registro: **não há veredito** |
| `ATRIBUICAO_INCOMPLETA` | o registro e o rodapé do TAP discordam |
| `ATRIBUICAO_DIVERGENTE` | o registro em disco não é o que o marcador selou |

Note o par `pisoDeCasos`: a guarda conta `test(` no **texto**, o portão conta o
que **executou naquele arquivo**. Sessenta e um casos dentro de um `if (false)`
passam no primeiro e morrem no segundo.

### 9.2 `FER-02` — a integridade da ferramenta não estava presa a ninguém

Tornar inalcançável a chamada final de `main()` no `portao.js` e **atualizar** a
linha do digest no contrato deixava o `npm test` sair com código zero, sem
marcador e sem veredito. O `pretest` conferia o digest — e o digest estava em
dia. A campanha da C2 realinhava digest de **suíte** em nove cenários e **nunca**
de **ferramenta**: media o digest, nunca o comportamento de uma peça enfraquecida
com o contrato em ordem. Era a única combinação que ficava verde.

O conserto tem três partes, e nenhuma delas é mais digest.

**(a) O comando oficial virou um trio.** `pretest` → `test` → `posttest`, os três
garantidos pelo **npm**, não por operador de shell. O `posttest` é
`ferramentas/aferidor.js`, a única voz **depois** do portão. Os seis campos de
`comandoOficial` são obrigatórios: a versão anterior fazia
`if (!nome || !esperado) continue;`, então apagar a declaração apagava a
conferência junto — o mesmo padrão "campo ausente desarma a defesa" que a C2
fechou nas suítes e deixou vivo aqui.

**(b) A sonda de alcance mede comportamento, não bytes.** A guarda invoca **toda**
peça de `ferramentas/` (cobertura derivada do disco, §8.2) com um argumento que
nenhuma delas aceita, e exige recusa explícita e `exit != 0`. Uma peça com o
executor retirado, tornado inalcançável, ou com o corpo esvaziado, carrega, não
faz nada e sai **zero** — e é esse zero que acende `EXECUTOR_INALCANCAVEL`.
Digest responde *"o arquivo é o mesmo?"*; só a execução responde *"ele ainda
fala?"*.

A sonda tenta até três vezes enquanto o que vê for falha de **ambiente** (o V8
não conseguir nem iniciar sob pressão de memória, o que acontece de verdade
quando dezenas de processos de teste correm juntos). Persistindo, é reprovação
com código próprio, `EXECUTOR_NAO_SONDAVEL`: *"não consegui medir"* nunca vira
*"está tudo bem"*, e um gate que dá falso vermelho é desligado na primeira
semana.

**(c) O aperto de mão amarra os três scripts a uma execução.** O `pretest` apaga
as sobras e emite um **desafio** (um nonce em disco). O portão o lê, executa, e
sela o marcador com um HMAC chaveado por esse nonce. O aferidor relê os dois,
confere o selo, **reconta a evidência crua** — o registro de atribuição, cujo
digest o marcador jurou — e consome o desafio.

| sabotagem | o que acontece |
|---|---|
| portão não rodou | não há marcador → `EXECUCAO_NAO_ACONTECEU` |
| marcador de ontem | o `pretest` já o apagou; e o selo não bateria |
| marcador escrito à mão | `SELO_DE_DESAFIO_NAO_CONFERE` |
| portão que só **imprime** a frase | a sonda passa (ele ainda recusa argumento), o aferidor não: sem marcador |

A frase `PORTAO: APROVADO` deixou de ser o veredito. O veredito é prova selada.

### 9.3 `--pretest`, e por que ele não é decorativo

Emitir o desafio e apagar as sobras são **efeitos** sobre estado compartilhado, e
efeito só pode acontecer quando a guarda está de fato abrindo uma execução.

Sem essa separação, qualquer prova que rode a guarda contra a árvore de verdade
— `GS-08` roda, e roda **no meio** de uma execução do próprio portão — apagaria
a atribuição da execução que a estava executando e trocaria o desafio que o
portão já tinha lido. Isso aconteceu, e o sintoma foi `ATRIBUICAO_AUSENTE` numa
árvore intacta.

Então: `node ferramentas/gate-de-provas.js --pretest` tem efeito; sem o
argumento, a guarda é **somente-leitura** e diz isso na saída. A forma exata está
em `comandoOficial.invocacaoPreviaExata` e é conferida caractere a caractere.

O portão, por sua vez, confere no estágio 5 que o desafio **em disco ainda é o
mesmo** que ele leu no estágio 2 (`DESAFIO_TROCADO`) — para que um desafio
reemitido no meio do caminho vire um vermelho sobre a coisa certa.

### 9.4 A ordem dos estágios foi medida

A integridade vem **antes** do desafio. Quando falta o desafio, quase sempre
falta porque o `pretest` sumiu do `package.json` — e quem sabe dizer *isso*, com
código estável, é a guarda (`COMANDO_OFICIAL_AUSENTE`). Perguntando pelo desafio
primeiro, a resposta seria `DESAFIO_AUSENTE`: verdadeira, e mudando de assunto.
`E4c` de `mutacoes_sobrevivencia.js` mede exatamente esta diferença.

### 9.5 A âncora ambígua, que quase custou quatro provas

As provas negativas `GS-26`..`GS-33` sabotam uma cópia da ferramenta por
**texto exato**. Na primeira escrita, o comentário de cabeçalho do `portao.js`
**citava** a linha do executor para explicar o escape FER-02 — e
`String.replace` com texto literal troca só a **primeira** ocorrência. A
sabotagem reescreveu a citação, o código ficou intacto, e quatro provas
negativas ficaram verdes medindo uma caixa que nunca foi sabotada.

Duas consequências, e as duas ficaram no código:

* `mutarPeca()` exige que a âncora ocorra **exatamente uma vez**. Zero é
  sabotagem que não aplica; duas é sabotagem que aplica no lugar errado. As duas
  são falso-verde.
* As peças do portão mantêm a chamada final de `main()` em **uma linha só**, e
  não a repetem em comentário. Há uma nota nos arquivos dizendo isso.

### 9.6 Espelhamento externo — `GS-22`..`GS-36`

Quinze provas novas em `test/gate_sobrevivencia.test.js`, todas medindo o
**ciclo oficial inteiro** (`pretest` + `test` + `posttest`) numa caixa de areia,
e todas passando por `realinharDigestsDasFerramentas()` — o gesto que a campanha
da C2 nunca fez e por isso não viu o `FER-02`.

| id | o que congela |
|---|---|
| `GS-22` | identificador servido por arquivo isca não aprova o protegido |
| `GS-23` | provas movidas para fora do alvo não contam |
| `GS-24` | piso **executado** por arquivo é independente do piso textual |
| `GS-25` | trocar o conteúdo do arquivo protegido, com digests em dia |
| `GS-26` | executor do portão inalcançável, digest realinhado |
| `GS-27` | executor do portão **retirado**, digest realinhado |
| `GS-28` | portão que só imprime o veredito → o `posttest` recusa |
| `GS-29` | `posttest` retirado do pacote **ou** do contrato |
| `GS-30` | aferidor apagado **ou** neutralizado |
| `GS-31` | guarda sem `node --test`; e o marcador de ontem não serve |
| `GS-32` | o relator não pode ser desligado pelo contrato |
| `GS-33` | atribuição e executor retirados **juntos** |
| `GS-34` | **o controle**: o ciclo intacto aprova, e as três vozes falam |
| `GS-35` | o portão sozinho, sem o `pretest`, recusa |
| `GS-36` | atribuição adulterada depois da execução não passa |

### 9.7 O residual, dito por inteiro

**O que a C3 fechou do residual da §8.4.** Aquela seção dizia que o escape só
existia invocando `node ferramentas/portao.js` **diretamente**. Isso deixou de
ser verdade nos dois sentidos: pelo comando oficial, a sonda de alcance pega o
executor neutralizado **mesmo com o digest realinhado**; e a invocação direta
agora **recusa** (`DESAFIO_AUSENTE`), porque o portão exige ter sido alcançado
pelo `pretest`.

**O que continua sendo limite da forma, e não conserto pendente.**

*Neutralizar as três peças ao mesmo tempo.* Guarda, portão e aferidor sondam uns
aos outros; qualquer subconjunto próprio que seja silenciado deixa um sondador
vivo, e ele acende. Silenciar **as três** de uma vez, com os três digests
realinhados, não deixa ninguém para falar. Isso não é uma brecha nova: é a
remoção total do portão, que a §7 já declarava fora de escopo — e é um diff que
toca todas as ferramentas e todas as linhas de digest.

*Reescrever o `portao.js` inteiro num forjador.* Um portão que leia o desafio,
não execute nada e fabrique um marcador selado com o nonce (que está em disco,
legível) passa pela sonda e pelo aferidor. Exige reescrever o corpo do portão e
realinhar o digest. Nenhuma peça dentro do repositório pode distinguir isso de
uma execução real, porque a chave do selo é, por construção, legível por quem
está dentro. O que existe contra isso é o mesmo de sempre: o diff.

*Cardinalidade de `casosObrigatorios`.* Continua como na §8.4 — reduzir a lista
no contrato é aceito, porque a expectativa mora no contrato e mexer nela é ato
auditável no diff.

**Onde auditar.** Continua valendo, e agora com mais força: auditar este portão é
auditar **`npm test`**. As três metades do mecanismo são três scripts do ciclo do
npm, e invocar qualquer uma delas à mão pula, por construção, as outras duas.

### 9.8 Custo

O ciclo oficial passou de ~22 s para ~40 s numa árvore intacta. A diferença é a
sonda de alcance (quatro processos por `conferir()`, três `conferir()` por ciclo)
e as quinze provas negativas novas, cada uma montando e rodando um ciclo inteiro
em caixa de areia. A execução da suíte em si não mudou: continua um único
`node --test`, com dois relatores no mesmo processo.
