# OS 54-C1 — Proteção da auditabilidade do CI externo

> ## `PASS`
>
> **O rastro do veredito deixou de poder sumir em silêncio.** O artefato e o
> resumo passaram a ser exigidos pela suíte — existência, `if: always()`,
> escrita efetiva no painel e correspondência entre o que é arquivado e o que
> foi julgado.
>
> **686 casos · 75 suítes · 0 falhas · 49/49 sabotagens detectadas · enforcement
> da OS 54 preservado integralmente · zero segredo · `server.js` intocado · zero
> deploy, PR, merge ou tag.**

Branch `correcao/os54-c1-auditabilidade-ci-v1`, um commit sobre
`infra/ci-obrigatorio-buraco-servidor-v1` @ `9ddaea4b28bae106b6f2182fb6d4b4f8e260424f`.

## A lacuna, dita sem eufemismo

O portão da OS 54 responde "passou ou não passou". Isso basta para barrar, e não
basta para **auditar**. O artefato e o resumo existiam no workflow, e **nada os
exigia**: apagar os dois deixava o portão inteiro, verde quando devia e vermelho
quando devia — só que um vermelho sem rastro legível obriga quem revisa a
reproduzir a corrida para saber o que aconteceu, que é exatamente o que o CI
existe para dispensar.

Esta não é a sabotagem que apaga o gate. É a que **apaga o rastro e mantém o
gate** — e é assim que um portão morre de morte natural: ninguém consegue dizer
por que ficou vermelho, e a próxima pessoa o desliga por incômodo.

## Gate Zero

| # | o que | resultado |
| --- | --- | --- |
| 1 | base no remoto | `9ddaea4b28bae106b6f2182fb6d4b4f8e260424f`, confirmada por `git ls-remote` |
| 2 | árvore limpa | sim, antes e depois |
| 3 | portão na base | **682/682 em 75 suítes**, exit 0, juiz verde |
| 4 | enforcement herdado | 29 mutações de árvore + 10 de evidência, todas repetidas nesta rodada |

## As três guardas novas

**CI-18 — o artefato.** Exige o passo de upload exatamente uma vez, com
`if: always()`, com `name:`, e com `path:` que **contém os dois arquivos que o
veredito lê**. A última parte é comparação, não literal: o caminho do upload é
normalizado (`${{ env.EVIDENCIA }}` e `$EVIDENCIA` são a mesma variável em duas
gramáticas) e conferido contra os argumentos reais do passo do juiz. Artefato
apontando para outro lugar arquiva diretório vazio e **parece cuidado**.

**CI-19 — o resumo.** Exige o passo exatamente uma vez, com `if: always()`,
produzido pelo próprio juiz (`--resumo`), lendo a mesma evidência julgada, e
**anexando** ao painel com `>>`. O `>` é reprovado à parte: truncar apagaria o
que outros passos escreveram.

**CI-19b — o resumo não pode ser um corpo vazio.** Prova executável, no molde de
CI-14: o texto é gerado de verdade e tem de nomear suítes, casos aprovados,
falhas, cancelados, duração e desfecho, com mais de 200 bytes. Sem ela, esvaziar
`resumo()` deixaria CI-19 verde — o passo continuaria lá, escrevendo nada.

`if: always()` não é zelo. Os dois passos importam **mais** quando o job falha,
e uma condição comum os desliga justamente no caso em que alguém vai olhar.

## O que a §4 mandou manter, e como isso passou a ser verificado

`permissions: contents: read`, `fetch-depth: 0`, `npm test` como alvo, juiz
fail-closed, ausência de segredos e de permissão de escrita já eram guardados
por CI-03/04/05/06/07/08/10/13/14. Faltavam dois valores que a OS nomeia:

- **Node 24** — CI-11 exigia só `>= engines` (20). Agora exige também
  `>= NODE_HOMOLOGADO`, que é 24: a major que rodou as provas é a que vale, e
  descer troca o ambiente medido por outro sem medir.
- **`timeout-minutes: 20`** — CI-09 exigia só `> 0`. Agora exige `>= 20`: limite
  curto demais mata a corrida antes do rodapé, e o que sobra é evidência
  truncada.

**Os pisos ficaram em 682/75, como mandado.** Isso deixaria os quatro casos
novos removíveis sem reprovar pelo piso do portão — folga que foi fechada pelo
**outro** piso, o do censo por arquivo: `ci_obrigatorio.test.js` subiu de 55
para 70 (medidos 77). Não é o mesmo número nem o mesmo mecanismo: um guarda o
tamanho da corrida, o outro guarda o tamanho da suíte.

## As provas negativas — 49/49

As 39 herdadas continuam sendo detectadas (29 de árvore + 10 de evidência), e as
dez novas fecham a §3:

| # | sabotagem | pega por |
| --- | --- | --- |
| 30 | o upload do artefato é removido | CI-18 |
| 31 | o artefato troca `always()` por condição comum | CI-18 |
| 32 | o artefato aponta para caminho diferente da evidência julgada | CI-18 |
| 33 | o resumo é removido | CI-19 |
| 34 | o resumo deixa de escrever no painel | CI-19 |
| 35 | o resumo passa a rodar só em sucesso | CI-19 |
| 36 | o resumo trunca o painel (`>`) em vez de anexar | CI-19 |
| 37 | o `resumo()` do juiz é esvaziado — o passo fica, o painel fica vazio | CI-19b |
| 38 | o Node é rebaixado abaixo do homologado | CI-11 |
| 39 | o limite de tempo do job é rebaixado | CI-09 |

Campanha com verde de partida, verde de chegada e controle (a evidência íntegra
continua sendo aceita pelo juiz): `node mutacoes_ci.js`.

## Limites — inalterados desde a OS 54

Tornar o workflow um **status check obrigatório** em `main` continua sendo
proteção de branch, não YAML: `/branches/main/protection` responde `401` e não há
`gh` nesta máquina. O CI reprova visivelmente; ainda **não impede merge**.

## Uma armadilha de bancada

O worktree novo materializou os arquivos em **CRLF** (`core.autocrlf=true`),
enquanto o worktree da OS 54 os tinha em LF — os mesmos blobs, EOL diferente no
disco. Âncora escrita com `\n` não casa com arquivo CRLF, e a edição parece
"âncora ausente" quando o texto está exatamente lá. Toda edição desta rodada
normaliza antes de casar e regrava preservando o EOL de origem.
