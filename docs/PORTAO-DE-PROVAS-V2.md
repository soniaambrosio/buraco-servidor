# Portão de provas V2 — integridade e execução real

Entregue pela **OS 23.1-P-C2**, sobre a folha da C1
(`correcao/os23-1-p-c1-gate-produtor-v2` @ `7a858b1`).
Fecha os dois falsos-verdes que a **OS 23.1-P-R1** mediu e reproduziu.

> **Contrato de prova v3.** A primeira volta da C2 (`55b5a64`) fechou os dois
> falsos-verdes da R1 e foi auditada de novo antes de virar entrega. A auditoria
> achou **dez escapes** que sobreviviam a ela — inclusive o padrão exato da
> R1/2.2 vivo numa segunda lista. A seção 8 deste documento registra o que era,
> o que fechou, e o que ficou de residual.

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
