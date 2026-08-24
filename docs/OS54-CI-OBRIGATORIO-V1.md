# OS 54 — CI externo obrigatório do `buraco-servidor`

> ## `PASS`
>
> **O `npm test` deixou de depender de alguém lembrar: o workflow dispara no
> provedor, o veredito é fail-closed, e as onze provas negativas da §5 foram
> detectadas.**
>
> Execução real comprovada: run
> [`32775989145`](https://github.com/soniaambrosio/buraco-servidor/actions/runs/32775989145),
> evento `push` sobre `23330bb`, **`success` com os dez passos verdes** — o
> passo *Portão fail-closed* entre eles, e ele só fica verde com evidência de
> uma corrida real de 682 casos em 75 suítes.
>
> **682 casos · 75 suítes · 0 falhas · 39/39 sabotagens detectadas · zero
> dependência nova · zero segredo · `server.js` intocado · zero deploy, PR ou
> merge.**
>
> Continua aberto, e não é item do §7: tornar este workflow um *status check
> obrigatório* em `main` é configuração do repositório — ver Limites.

Branch `infra/ci-obrigatorio-buraco-servidor-v1`, sobre
`correcao/os52-c1-unicidade-bundle-v1` @ `913611a743bc9262e5229c8d7a67281cf00e9315`.

## O defeito, dito sem eufemismo

O repositório tinha um portão bom e nenhuma obrigação de usá-lo. `npm test`
rodava quando alguém lembrava. Não havia `.github/` — a API do GitHub confirmava
`"total_count": 0` em `/actions/workflows` —, nenhum mecanismo equivalente e
nenhuma proteção externa. Um commit que quebrasse a suíte chegava ao
repositório com a mesma cor de um que a mantivesse verde: nenhuma.

## Gate Zero, medido antes de editar

| # | o que | resultado |
| --- | --- | --- |
| 1 | branch e SHA no remoto | `913611a743bc9262e5229c8d7a67281cf00e9315`, confirmado por `git ls-remote` |
| 2 | árvore limpa | sim |
| 3 | comando oficial | `npm test` → `node --test "test/*.test.js"` |
| 4 | portão na base | **646/646 em 75 suítes**, exit 0 |
| 5 | workflows existentes | **zero** (não havia `.github/`) |
| 6 | mecanismo equivalente | nenhum |
| 7 | Node e dependências | `engines: >=20`; **zero dependências**, sem lockfile |
| 8 | duração e recursos | ~19 s de suíte, ~23 s de parede; sem rede externa |
| 9 | credenciais | nenhuma necessária |
| 10 | proteção externa | `gh` não instalado; `/branches/main/protection` responde `401` |

## O desenho: duas metades, e nenhuma fecha sozinha

Um workflow **não consegue guardar a si mesmo** — quem edita o YAML edita
também o que o YAML afirma. Uma suíte **não consegue se obrigar a rodar**. As
duas juntas fecham o círculo, na mesma reciprocidade que o censo da OS 44
construiu para o glob.

| peça | arquivo | o que faz |
| --- | --- | --- |
| metade de fora | `.github/workflows/provas-do-servidor.yml` | dispara em todo push, roda o alvo oficial, guarda a saída |
| o juiz | `ci/portao_do_ci.js` | lê a evidência e recusa tudo que não for prova positiva |
| o piso | `ci/piso_do_portao.json` | fonte única do tamanho medido do portão |
| metade de dentro | `test/ci_obrigatorio.test.js` | lê o YAML e reprova quem o desliga (36 casos) |
| a âncora | `test/censo_de_suites.js` | registra a suíte nova: apagá-la reprova pelas outras três |

## Por que o juiz não é o `npm test`

No Actions há três desfechos e só um tem cor natural. O passo pode ter
**falhado**, pode **não ter executado** (removido, comentado, desviado, trocado
por um `echo`) e pode ter sido **cancelado**. Os dois últimos terminam sem
marca — e "não rodou" nunca deve parecer com "passou".

Por isso as provas escrevem evidência (saída literal + código de saída), e o
veredito é dado sobre ela. Reprovam:

- **evidência ausente** → `NÃO EXECUTADO`;
- **marcador de saída ausente, vazio ou ilegível** → é o rastro de cancelamento
  e de estouro de tempo;
- **rodapé incompleto** → `EXECUÇÃO SEM MARCADOR VÁLIDO`;
- **`cancelled > 0`** → reprovação com nome próprio;
- **eco do npm ausente** → o comando executado não foi o alvo oficial;
- **eco do alvo diferente do glob** → desvio para arquivo-isca;
- **soma inconsistente** (`pass+fail+cancelled+skipped ≠ tests`) → saída forjada;
- **duração zero** → não houve corrida;
- **`pass` abaixo do piso** e **`suites` abaixo do piso** → encolhimento.

O piso é conferido contra `pass`, **não** contra `tests`: caso marcado como
`skip` continua contando em `tests` e some de `pass`, então trivializar a suíte
por `skip` derruba o piso em vez de passar por ele.

O piso vive em `ci/piso_do_portao.json`, e o **piso do piso** — os números
medidos — vive em `test/ci_obrigatorio.test.js`, fora daquele arquivo e fora do
portão. Subir é livre; descer é vermelho, em dois lugares.

## O provedor reprovou a primeira versão, e isso virou guarda

A primeira publicação (`5416274`) declarava o lugar da evidência assim:

```yaml
    env:
      EVIDENCIA: ${{ runner.temp }}/evidencia
```

O run **32774431823** terminou `failure` com **zero jobs**, sem log e sem
anotação legível pela API pública: o contexto `runner` só existe **a partir dos
passos**, e no `env:` do job o workflow é reprovado na validação. Um portão que
não chega a criar job não guarda nada — e nada no repositório teria dito isso.

A correção não foi só mover a linha:

- a declaração virou um passo, `echo "EVIDENCIA=$RUNNER_TEMP/evidencia" >>
  "$GITHUB_ENV"`, que continua sendo **única** e continua alcançando os passos
  `if: always()`;
- o artefato passou a usar `${{ env.EVIDENCIA }}`, para não criar uma segunda
  verdade sobre o caminho;
- **CI-17** passou a reprovar qualquer contexto de passo (`runner.`, `steps.`,
  `job.`) usado antes de `steps:`;
- **MUT-29** replanta exatamente aquele `env:` e exige vermelho.

Na segunda publicação (`23330bb`) o run **32775989145** ficou `success`, com
job criado e os dez passos verdes. **É este run que serve de prova de execução**
— e o passo do veredito estar verde significa que o portão leu a evidência de
uma corrida real, porque sem ela ele reprova.

## A evidência mora fora da árvore, e isso não é asseio

`$RUNNER_TEMP`, não `./evidencia`. A guarda de unicidade da OS 52 varre o
repositório **inteiro** procurando um segundo servidor, e um log de teste
crescendo dentro da árvore entraria nessa varredura **enquanto a suíte ainda
roda**.

## As provas negativas — 39/39

Duas baterias, porque são duas perguntas (`node mutacoes_ci.js`; a segunda
sozinha com `--so-evidencia`).

**Árvore (29/29)** — sabota workflow, piso, portão ou `package.json`, e julga
pelo `npm test` inteiro:

| § | sabotagem | pega por |
| --- | --- | --- |
| 5.1 | `npm test` removido do workflow | CI-03 |
| 5.2 | o passo comentado | CI-03 (comentários recortados antes de medir) |
| 5.3 | o comando trocado por `echo` | CI-03 |
| 5.4 | o comando ganha `\|\| true` | CI-05 |
| 5.5a/b | alvo desviado no workflow e na fonte | CI-03 / censo |
| 5.6a/b/c | suíte do CI, suíte herdada e workflow somem | censo / CI-01 |
| 5.7a/b/c | `continue-on-error`, veredito removido, veredito com `if:` | CI-04 / CI-06 |
| 5.8a/b | gatilho restringido e gatilho removido | CI-02 |
| 5.9 | checkout removido | CI-10 |
| 5.10a/b/c | marcador não gravado; portão sem rodapé; portão aceitando ausência | CI-05 / CI-14 |
| 5.11a/b/c/d | pisos rebaixados; portão sem comparação; piso apagado | CI-13 / CI-14 |
| §4 | segredo, permissão de escrita, timeout removido, segunda `EVIDENCIA`, juiz apagado | CI-08 / CI-07 / CI-09 / CI-05b / CI-06 |
| §5 | passo da evidência removido; `runner` de volta no `env:` do job | CI-05b / CI-17 |

**Evidência (10/10)** — sabota a saída de uma execução real e julga pelo
próprio `ci/portao_do_ci.js`, com **controle**: a evidência íntegra é aceita
(exit 0), e execução ausente, sem marcador, com marcador ilegível, falhada,
truncada, fabricada por `echo`, desviada para isca, encolhida em casos,
encolhida em suítes e cancelada dão todas exit 1.

## O contador subiu, e isso está explicado

**646 → 682 casos, 75 → 75 suítes.** Os 36 casos novos são a suíte
`ci_obrigatorio.test.js`; nenhum caso da base foi perdido, e o piso subiu junto
— piso que não acompanha a guarda nova deixa apagar os casos dela sem reprovar.
`server.js`, `app.html`, `package.json`, os dois contratos e as quatro suítes
herdadas ficaram idênticos por blob.

## Limites — o que esta OS não fechou

1. **Status check *obrigatório* é configuração do repositório, não do YAML.**
   O workflow roda e reprova sozinho — está provado. Torná-lo *required* em
   `main`, de modo que um merge vermelho seja recusado pelo próprio GitHub, é
   uma mudança na proteção de branch: a API responde `401` sem token e não há
   `gh` nesta máquina. Enquanto isso não for feito, **o CI reprova
   visivelmente, mas não impede merge**. Um clique, e fora do alcance desta OS.
2. **`workflow_dispatch` só aparece na interface para workflow que já está na
   branch padrão.** O arquivo está numa branch de trabalho; o disparo manual só
   ficará visível depois de o arquivo chegar em `main`, o que esta OS não faz.
3. **Nada de deploy.** `main` segue em `1828d42`, que é o que o Railway roda.

## Duas armadilhas de bancada desta rodada

- **`execFileSync("npm.cmd", …)` dá `EINVAL` no Windows** desde a correção do
  Node contra injeção por argumento em BAT/CMD: precisa de `shell: true`. A
  primeira campanha abortou por isso — e abortar foi o comportamento certo,
  porque evidência que não veio de corrida real não prova nada.
- **Erro de validação de workflow não produz job, log nem anotação pública.**
  A única pista pela API é `conclusion: failure` com `jobs: 0`. Quem publicar
  workflow novo aqui deve conferir esses dois números antes de acreditar em
  qualquer coisa.
