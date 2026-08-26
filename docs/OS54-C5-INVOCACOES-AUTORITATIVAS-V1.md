# OS 54-C5 — a invocação obrigatória passa a ser executável, e não textual

**Base:** `correcao/os54-c4-auditabilidade-sobre-artefato-unico-v1 @ 0f6565551eef7d0aa13528e11471c96ae5c2ed32`
(OS 54-C4 — 883 casos / 87 suítes, artefato produtivo `[package.json, server.js]`)

---

## 1. O escape que a OS 54-R4 encontrou

Até a OS 54-C4, `ci/auditabilidade.js` respondia *"o workflow chama o juiz?"*
com uma expressão regular aplicada ao **corpo inteiro do passo**:

```js
/node\s+ci\/portao_do_ci\.js\s+"\$EVIDENCIA/.test(passo.corpo)
```

Isso mede **presença de texto**, e presença de texto não é execução. Trocar

```yaml
run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"
```

por

```yaml
run: echo node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"
```

mantinha o texto e desligava o juiz. Medido nesta árvore **antes** da correção,
com o guardião da C4: as **quatro** invocações obrigatórias — juiz, guardião,
inventário e autoridade do artefato — caíam pelo mesmo caminho, e o veredito
continuava `[]`, isto é, VERDE.

**Por que nenhuma campanha tinha visto.** Todas sabotavam por REMOÇÃO: apagavam
o passo. Remover quebra a âncora, e o texto some junto — a detecção vinha do
acidente, não de autoridade nenhuma. Foi por isso que a §1 desta OS insistiu que
não bastava corrigir o juiz: guardião e inventário estavam exatamente na mesma
situação, e ninguém tinha medido.

## 2. A autoridade nova

`ci/invocacao_executavel.js` lê o `run:` do **passo canônico** como o runner
leria, e só então pergunta:

> existe um comando **alcançável** cuja **cabeça** é o binário exigido e que
> recebe o alvo como **palavra própria**?

Para chegar a essa pergunta ele precisa acertar seis leituras, e cada uma delas
é um caso da suíte `test/invocacao_executavel.test.js`:

| leitura | o que ela impede |
| --- | --- |
| escalar de `run:` — fluxo e bloco, com recuo pela primeira linha não vazia | confundir o corpo do bloco com atributos do passo |
| linhas lógicas — continuação com `\` | perder a segunda metade de um comando quebrado em duas linhas |
| heredoc (nu, citado, recuado) descartado | tratar entrada de programa como comando |
| comentário de shell que **abre palavra** | comer `echo "a#b"`, ou aceitar `# node …` |
| separadores reais (`;`, `&&`, `\|\|`, `\|`, `&`, agrupamentos) | partir `2>&1` no meio e medir lixo |
| alcançabilidade — `exit`/`return` incondicional | aceitar chamada escrita depois de uma saída antecipada |

Com isso as dez formas da §2 caem **por construção**, e não por lista:

* `echo node …` e `printf … node …` — a cabeça é `echo`/`printf`;
* `true`, `:` — a cabeça não é o binário;
* comando comentado — comentário de shell não vira comando;
* texto dentro de string — o valor da palavra é a string inteira, e uma string
  inteira nunca é igual ao caminho do alvo;
* heredoc — corpo é dado;
* `CMD="node ci/x.js"` — atribuição não é comando com cabeça;
* depois de `exit` incondicional — inalcançável;
* passo diferente do canônico — a exigência é ancorada no `name:`;
* ocorrência textual em comando composto — quem a carrega tem outra cabeça.

### Fail-closed, dito em voz alta

Ele **não é um shell**. Não expande variável, não resolve alias, não segue
`source`, não sabe o que uma função definida no próprio script faz. Isso não é
uma lacuna escondida — é a direção do erro: **tudo o que ele não consegue
classificar como invocação executável é RECUSADO**. Uma forma legítima que ele
não entenda deixa o portão VERMELHO e pede uma linha de contrato; nunca deixa
passar por não ter entendido.

## 3. O contrato, e por que ele ancora no nome do passo

Cada exigência declara o passo canônico onde a invocação tem de viver:

| autoridade | passo canônico | exige | proíbe |
| --- | --- | --- | --- |
| juiz fail-closed | `Portão fail-closed` | os dois arquivos de evidência | `--resumo` |
| guardião | `Guardião da auditabilidade` | — | — |
| inventário | `Inventário por execução` | — | — |
| artefato produtivo | `Artefato produtivo único` | `--conferir` | — |
| gerador do resumo | `Resumo (verde, vermelho, …)` | `--resumo` + os dois arquivos | — |

Ancorar no `name:` não é asseio. A **ordem** dos passos decide QUANDO um comando
roda: mover a chamada do juiz para depois do upload, ou para dentro de um passo
`if: always()`, muda o significado sem mudar uma letra do comando. A §2 manda
recusar "ocorrência em passo diferente do passo canônico", e é a âncora do nome
que torna isso verificável.

## 4. O que mais entrou

* **`continue-on-error` em qualquer passo do job** passa a reprovar — inclusive
  no das provas, que não está na lista de invocações. Um passo que perdoa o
  próprio erro tira do job a única cor que ele produz sozinho.
* **O passo do upload** passou a ser lido por atributos (`if`, `name`, `path`,
  `if-no-files-found`, `uses`) em vez de por expressão regular sobre o corpo, e
  o caminho arquivado é comparado com os argumentos REAIS do comando do juiz.
* **O resumo** passou a ser cobrado pela mesma autoridade: um `echo` no lugar do
  gerador reprova, e o operador de redirecionamento (`>` × `>>`) é lido do
  comando, não do texto do passo.

## 5. A lição que o controle anti-veto deu

A campanha tem um controle que quase ninguém pensaria em escrever: **trocar a
forma canônica do `run:` de escalar de fluxo para bloco escalar, e exigir que a
cadeia continue VERDE**.

Ele reprovou — e a autoridade não tinha nada a ver com isso. `ci/auditabilidade.js`
aceitava as duas formas; quem caía eram **doze casos** cujas âncoras de sabotagem
eram texto literal preso à forma de fluxo, e `forjar` abortava por âncora
ausente.

Isso é um alarme falso de verdade: reformatar o YAML — quebrar uma linha
comprida, por exemplo — derrubaria o portão sem defeito nenhum, e vermelho pelo
motivo errado é tão cego quanto verde indevido. Corrigido em duas frentes:

* as **âncoras** passaram a ser DERIVADAS do arquivo (`runDoPasso`,
  `passoInteiro`), como `trechoDoPasso` já fazia — e são *getters*, porque numa
  cópia onde a sabotagem apagou o passo, calcular tudo no `require` mataria
  todas as suítes importadoras pelo motivo errado;
* as **substituições** passaram a operar sobre o COMANDO dentro do escalar
  (`comComandoTrocado`, `comPrefixoNoComando`, `outraFormaDoRun`), em vez de
  sobre o texto de uma forma específica.

Sem isso o controle era decorativo. Com isso ele mede o que diz medir.

## 6. Números

| medida | base `0f65655` | esta ponta |
| --- | --- | --- |
| casos (`npm test`) | 883 | **927** |
| suítes (`describe`) | 87 | **87** |
| `casos_minimos` | 883 | **927** |
| `suites_minimas` | 87 | **87** |
| suítes obrigatórias no censo | 12 | **13** |

Nenhum piso desceu, nenhum caso foi removido ou trivializado.

## 7. O que NÃO mudou

`server.js`, `app.html`, os dois contratos, `package.json` e
`ci/artefato_produtivo.json` — idênticos por blob. `scripts.start`,
`scripts.test` e `scripts.pretest` continuam literalmente o que eram. O artefato
produtivo continua `[package.json, server.js]`. Gatilhos, branches e permissões
do workflow: inalterados. Nenhum `continue-on-error` introduzido — ao contrário,
ele passou a ser proibido por leitura.

`X07`/`UNI-B4`, `D2`, `C04` e `D06` **não** foram tocados nesta missão, como a
§4 manda.

## 8. O que continua em aberto

* **A Railway**, e a pendência de implantação, seguem fora do escopo.
* **O contador de `suites`** continua medindo `describe`, e as suítes de guarda
  deste repositório usam grupos `test(...)`. Cercado, mas ainda um número que
  não acompanha o que parece medir.
* **`X07`** — um caso de guarda pode ser esvaziado em silêncio — segue como
  residual declarado da OS 54-C4, e esta OS foi proibida de tocá-lo.
* **O leitor de shell não é um shell.** Formas exóticas mas legítimas
  (`eval`, `source`, função definida no próprio script) são RECUSADAS. É a
  direção segura, e o custo é uma linha de contrato no dia em que alguém
  precisar de uma delas.
