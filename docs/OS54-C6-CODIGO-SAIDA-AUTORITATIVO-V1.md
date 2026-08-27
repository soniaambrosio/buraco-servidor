# OS 54-C6 — o código de saída do veredito chega ao job

**Base:** `correcao/os54-c5-invocacoes-autoritativas-workflow-v1 @ 7c81bd64948b6777c74aa58845744369180cf7c9`
(OS 54-C5 — 927 casos / 87 suítes, artefato produtivo `[package.json, server.js]`)

---

## 1. O escape que a OS 54-R5 encontrou

A OS 54-C5 fechou *"isso vai RODAR?"*. `ci/invocacao_executavel.js` lê o `run:`
como o runner leria e recusa `echo`, `printf`, heredoc, string, atribuição,
comentário e chamada inalcançável. É autoridade de verdade, e continua valendo
inteira nesta ponta — não foi tocada.

A R5 mostrou que ela responde a pergunta errada **sozinha**. Trocar

```yaml
run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"
```

por

```yaml
run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt" || echo "seguimos"
```

não esconde nada: o juiz **executa**, imprime `PORTÃO VERMELHO`, sai com 1. E o
**passo** sai com 0, porque o código de saída de um `run:` é o do **script**, não
o do comando que interessa. Uma suíte vermelha embarcaria como sucesso.

Reproduzido nesta árvore antes de escrever uma linha de correção, com uma suíte
realmente vermelha (`npm test` → exit 1, 4 falhas, 924 aprovados):

| cadeia | código de saída |
| --- | --- |
| `node ci/portao_do_ci.js <saída> <marcador>` | **1** — `PORTÃO VERMELHO`, 3 reprovações |
| `bash -e -c 'node … \|\| echo "seguimos"'` | **0** — o passo ficaria VERDE |
| `bash -e -c 'node …'` (forma canônica) | **1** |

A R5 também mostrou que a lista negra não cobre o eixo: `CI-05` proibia
`|| true`, `|| exit 0` e `|| :`; `|| echo` e `|| /bin/true` passavam por baixo.
Lista negra vaza por construção — ela enumera o que alguém lembrou.

## 2. A forma estrutural escolhida para o juiz: `uses:`, e não `run:`

A §2 da OS manda avaliar **como primeira opção** tirar o juiz do campo de shell
livre. Foi o que se fez, e por uma razão que não é de gosto:

> `run:` é um campo de shell livre, e todo campo de shell livre tem essa porta.
> Fechá-la por leitura exige modelar bash. `uses:` **não tem script**, e `run:` e
> `uses:` são mutuamente exclusivos no mesmo passo — o passo decisivo deixou de
> ter campo onde compor. Não é mais uma proibição na lista: é a lista inteira
> ficando sem objeto.

O passo do veredito passou a ser:

```yaml
      - name: Portão fail-closed
        uses: ./.github/actions/portao
        with:
          saida: ${{ env.EVIDENCIA }}/npm-test.txt
          marcador: ${{ env.EVIDENCIA }}/exit.txt
```

E a ação local, sem dependência nenhuma:

* `.github/actions/portao/action.yml` — `runs.using: 'node24'` (fixado e
  amarrado ao `node-version: '24'` do `setup-node` do mesmo job),
  `runs.main: 'index.js'`, as duas entradas `required: true`;
* `.github/actions/portao/index.js` — executa `ci/portao_do_ci.js` e **devolve o
  código dele**. Três regras, que são a mesma dita de três jeitos: o código do
  juiz é devolvido e nunca traduzido; tudo o que não for um código legítimo do
  juiz vira 1 (entrada faltando, juiz ausente, processo morto por sinal, exceção
  no próprio fio); e não existe caminho que devolva 0 sem o juiz ter devolvido 0.

O runner executa `runs.main` com Node e usa o **código de saída do processo**
como resultado do passo. Não há shell no caminho.

## 3. Os passos que continuam em `run:`

Três autoridades continuam em `run:` — guardião, inventário e artefato — e a R5
mostrou que a mesma doença vive nelas: o escape `E9` dela era `|| echo` no
**guardião**. Para essas, a correção não é uma lista de proibições, e sim uma
**forma canônica única**:

> o script tem exatamente **uma linha lógica**, **nenhum separador**
> (`;`, `&&`, `||`, `|`, `&`, agrupamento), **nenhum redirecionamento** e
> **exatamente um comando**, cuja cabeça é `node` e que recebe o alvo como
> palavra própria.

Quando isso vale, o código de saída do script **é** o do comando — por definição
do shell, e não por leitura de caso particular. Não há segundo comando para vir
depois, não há `||` para absorver, não há cano para trocar o código pelo do
último estágio, não há `&` para não esperar. Tudo o que não couber nessa forma é
RECUSADO, inclusive o que seria inofensivo.

A leitura é feita por **duas varreduras independentes que têm de concordar** — a
de separadores, própria de `ci/codigo_de_saida.js`, e a tokenização de
`ci/invocacao_executavel.js`. Discordância é recusa.

**A distinção que custa caro e está feita:** `&` de redirecionamento (`2>&1`,
`>&2`, `&>arquivo`) **não** é separador. Perdê-la parte
`npm test > "$EVIDENCIA/npm-test.txt" 2>&1` no meio e mede outra coisa.

**Onde a regra NÃO se aplica, e por quê.** O passo das *Provas oficiais* existe
justamente para ABSORVER o código do `npm test` e gravá-lo num marcador — quem
julga o marcador é o juiz. O passo do *Resumo* roda com `always()`, escreve no
painel e não decide nada. Autoridade aplicada onde não cabe reprova o
repositório íntegro.

## 4. As duas metades, e nenhuma responde sozinha pela própria presença

A §3 manda que a validação não dependa só do passo do juiz, que seja alcançada
antes do julgamento, e que a suíte obrigatória também a exercite.

| metade | onde | o que a derruba |
| --- | --- | --- |
| `ci/codigo_de_saida.js` | passo próprio do workflow (**antes** do juiz), `pretest`, e dentro de `ci/auditabilidade.js` | apagá-la quebra o `require` das três pontas; trivializá-la deixa a suíte vermelha |
| `test/codigo_de_saida.test.js` | `npm test`, censo, piso textual, piso executado, nomes obrigatórios | apagá-la cai em cinco autoridades; trivializar um caso nominal cai no **peso** |

O guardião cobra a presença do passo próprio da autoridade nova; a autoridade
nova cobra que o passo do guardião é comando único; e a autoridade nova está na
**própria** lista de comando único — quem puder compor o passo que confere
composição desliga a conferência sem tocar em mais nada.

**O peso dos casos nominais** (`ci/pisos_autorizados.js`) é novo e fecha a última
sabotagem barata: um caso nominal cujo corpo vira `assert.ok(true)` continua
existindo, continua executando e continua aprovando — nenhum contador o alcança.
Os mínimos foram medidos, vivem fora do conjunto varrido pelo glob, e o limite
está declarado em voz alta no arquivo: isso pega o corpo apagado, não o corpo
reescrito com o mesmo número de afirmações fracas.

## 5. A prova comportamental, e ela é execução

Nada aqui afirma que a linha do workflow está certa e para por aí.

`ci/codigo_de_saida.js` **executa** o entrypoint que o `runs.main` apontar —
não um caminho escrito no código — contra evidência forjada, e exige a
invariante:

> código de saída do entrypoint **===** código de saída do juiz

nos dois sentidos, mais dois cenários sem evidência nenhuma (que têm de dar
diferente de zero). É **igualdade**, e não "aprovada é zero", justamente para
nunca reprovar uma árvore que esteja vermelha por outro motivo: vermelho pelo
motivo errado esconde o que estava sendo medido. A trava anti-vácuo mora na
suíte, que controla a árvore inteira.

`SAI-19` faz a cadeia da §4 inteira: executa uma suíte deliberadamente vermelha
de verdade, transforma a saída dela em evidência, roda o juiz, roda a forma
declarada, observa o código final e exige vermelho — e, no mesmo caso, exige
verde para a evidência íntegra.

`SAI-20` mede o shell em vez de deduzi-lo: `bash -e` de verdade, mostrando que a
forma canônica propaga o vermelho e que `|| echo`, `| cat` e `set +e … exit 0`
não propagam. É o que justifica a autoridade **recusar** a forma composta em vez
de confiar numa lista.

## 6. O que esta OS NÃO fez

* **Não tocou em `ci/invocacao_executavel.js`.** A autoridade da C5 continua
  byte a byte como estava, e continua respondendo a pergunta dela.
* **Não tocou em `server.js`, `app.html`, `package.json`, nem nos contratos.**
* **Não mexeu na campanha `mutacoes_c5.js`.** O que foi generalizado é o
  extrator de âncoras em `test/arvore_forjada.js`: `runDoPasso` passou a
  devolver a linha do `uses:` quando o passo não tem `run:`. Sem isso, as quatro
  sabotagens daquela campanha que miram o juiz morreriam por âncora — e caso que
  morre por âncora não mede coisa nenhuma, só some do placar. Com a
  generalização elas continuam dizendo o que sempre disseram: *o texto fica no
  lugar certo e a invocação deixa de ser invocação*.
* **Não publicou nada.** Nenhum push, nenhum PR, nenhuma tag, nenhum deploy.

## 7. Os limites, ditos em voz alta

1. **O runtime da ação é `node24`, e isso é uma aposta declarada.** Se um dia o
   runner deixar de conhecê-lo, o passo morre na inicialização — vermelho, o que
   é a direção certa do erro, mas vermelho sem julgar nada. O valor está fixado
   num lugar só e amarrado ao `setup-node` do job.
2. **A prova comportamental do entrypoint roda com Node local, não com o
   runner.** Que o runner use o código de saída do processo de uma ação
   JavaScript é propriedade do provedor, e nenhum arnês local a demonstra. O que
   está provado aqui é que o fio devolve o código do juiz.
3. **O peso dos casos nominais pega corpo apagado, não corpo fraco.** Não existe
   leitura barata que separe uma afirmação forte de uma trivial.
4. **Rebaixar os dois pisos ao mesmo tempo continua possível**, e é a intenção
   herdada: o custo é uma edição em duas famílias, visível na revisão.
