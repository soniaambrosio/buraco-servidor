# OS 54-C5 — placar das provas

Node `v24.14.0` / npm `11.9.0`. Base: `0f6565551eef7d0aa13528e11471c96ae5c2ed32`.

---

## 1. O escape, reproduzido antes de ser fechado

Antes de escrever uma linha de correção, o defeito da OS 54-R4 foi medido na
base, com o guardião da OS 54-C4 rodando contra árvores forjadas:

| neutralização | veredito do guardião da C4 |
| --- | --- |
| `run: echo node ci/portao_do_ci.js …` | `[]` — **VERDE** |
| `run: echo node ci/auditabilidade.js` | `[]` — **VERDE** |
| `run: echo node ci/inventario_de_execucao.js` | `[]` — **VERDE** |
| `run: echo node ci/artefato.js --conferir --raiz .` | `[]` — **VERDE** |
| `CMD="node ci/auditabilidade.js"` + `true` | `[]` — **VERDE** |

Quatro autoridades, um prefixo. Depois da correção, todas VERMELHAS.

## 2. A cadeia oficial na árvore final

| etapa | resultado |
| --- | --- |
| `npm test` | **exit 0** — 927 casos, 87 suítes, 0 falhas |
| `node ci/auditabilidade.js` | **AUDITABILIDADE VERDE** |
| `node ci/inventario_de_execucao.js` | **INVENTÁRIO VERDE** — 13 suítes obrigatórias |
| `node ci/portao_do_ci.js …` | **PORTÃO VERDE** — 927/87 contra piso 927/87 |
| `node ci/artefato.js --conferir --raiz .` | **ARTEFATO VERDE** — `[package.json, server.js]` |
| `node test/guarda_do_portao.js` (`pretest`) | verde — 33 comparações de piso ancorado, 7 amarrações |

## 3. Censo e pisos

| medida | base `0f65655` | esta ponta |
| --- | --- | --- |
| casos | 883 | **927** |
| suítes (`describe`) | 87 | **87** |
| `casos_minimos` | 883 | **927** |
| `suites_minimas` | 87 | **87** |
| suítes obrigatórias | 12 | **13** |

Pisos remedidos (textual = contagem REAL do arquivo, sem folga; executado =
`node ci/inventario_de_execucao.js --json`):

| suíte | textual | executado |
| --- | --- | --- |
| `auditabilidade_ci.test.js` | 29 → **42** | 28 → **41** |
| `invocacao_executavel.test.js` | — → **32** | — → **31** |
| (as onze restantes) | inalteradas | inalteradas |

## 4. Campanha nominal — `mutacoes_c5.js`

**27/27 detectadas · 0 escapes · controles de partida e chegada VERDES (927
casos nas duas pontas).**

Toda sabotagem desta campanha **preserva o texto** e só tira dele a qualidade de
comando. Se a detecção dependesse de quebra de âncora — como nas campanhas
anteriores, que sabotavam por remoção — todas passariam.

| id | sabotagem | veredito |
| --- | --- | --- |
| `E01`–`E04` | `echo` no juiz, guardião, inventário e artefato | vermelho |
| `E05`–`E08` | `printf` nos mesmos quatro | vermelho |
| `E09` | guardião comentado no bloco | vermelho |
| `E10` | inventário dentro de heredoc | vermelho |
| `E11` | juiz guardado numa variável | vermelho |
| `E12` | artefato substituído por `true` | vermelho |
| `E13` | guardião substituído por `:` | vermelho |
| `E14` | inventário depois de saída antecipada | vermelho |
| `E15` | passo do juiz renomeado | vermelho |
| `E16` | isca: chamada real movida para um passo novo | vermelho |
| `E17` | juiz como texto em comando composto | vermelho |
| `E18` | remoção do passo (a forma antiga, para comparação) | vermelho |
| `E19` | `continue-on-error` no passo das provas | vermelho |
| `E20` | passo do juiz condicionado por `if:` | vermelho |
| `E21` | resumo neutralizado por `echo` | vermelho |
| `E22` | resumo truncando o painel (`>` em vez de `>>`) | vermelho |
| `E23` | **deliberadamente vermelho** (piso acima do que existe) | vermelho |
| `E24` | autoridade das invocações removida do disco | vermelho |
| `E25` | autoridade das invocações trivializada (aprova tudo) | vermelho |
| `E26` | **CONTROLE ÍNTEGRO** | **verde** |
| `E27` | **CONTROLE: a outra forma canônica do `run:`** | **verde** |

### O que `E27` custou, e por que valeu

`E27` reprovou nas duas primeiras rodadas — e a autoridade não tinha nada a ver
com isso. Medido: `ci/auditabilidade.js` aprovava o bloco escalar; quem caía eram
**doze casos** (depois cinco) cujas âncoras e substituições eram texto literal
preso à forma de fluxo, e `forjar` abortava por âncora ausente.

Alarme falso de verdade: reformatar o YAML derrubaria o portão sem defeito
nenhum. Corrigido derivando as âncoras do arquivo (`runDoPasso`, `passoInteiro`,
como *getters*) e fazendo as substituições operarem sobre o COMANDO dentro do
escalar (`comComandoTrocado`, `comPrefixoNoComando`, `outraFormaDoRun`). Só
então o controle passou a medir o que dizia medir.

## 5. Suítes próprias

* `test/invocacao_executavel.test.js` — **31/31**. Exercita o leitor por dentro:
  escalar de fluxo × bloco, recuo, atributos, continuação de linha, heredoc nu ×
  citado × recuado, comentário de shell dentro e fora de aspas, `&` de
  redirecionamento, `>` × `>>`, alcançabilidade (`exit` no topo × condicional ×
  dentro de bloco), e a amarração com o guardião.
* `test/auditabilidade_ci.test.js` — **41/41**, com `AUD-21`..`AUD-32` novos:
  cada forma da §2 exercitada contra uma autoridade **diferente**, para a suíte
  não provar doze vezes a mesma coisa.

## 6. Prova externa da §3 — o job vermelho de verdade

Medida em ramo de sonda temporário, apagado depois; o run e o artefato ficam.
A sonda introduziu **apenas** um teste que falha — workflow, guardião, juiz,
piso e artefato intactos, para o vermelho vir do runner e não de uma guarda.

**Run `32979399949`** — https://github.com/soniaambrosio/buraco-servidor/actions/runs/32979399949
`head_sha` `9f311ffdf92f13f90137d604535177ebce66e548` · evento `push`

| # | passo | conclusão |
| --- | --- | --- |
| 7 | Provas oficiais do servidor | `success` (o passo captura; quem falha é o alvo) |
| 8 | Guardião da auditabilidade | `success` |
| 9 | Inventário por execução | `success` |
| 10 | **Portão fail-closed** | **`failure`** |
| 11 | Artefato produtivo único | `skipped` (sem `if:`, o anterior falhou) |
| 12 | **Resumo** (`always()`) | `success` |
| 13 | **Evidência arquivada** (`always()`) | `success` |
| — | **JOB** | **`failure`** |

Evidência arquivada: `evidencia-provas-do-servidor`, id `9610818676`,
**31.918 bytes**, não expirada. Conteúdo conferido: `exit.txt` = `1`; rodapé
`tests 928 / pass 927 / fail 1`; `SONDA-01` com o `AssertionError` deliberado.

**Os dois passos `always()` executaram, terminaram `success`, e o job continuou
`failure`.** É essa a afirmação que a §3 pedia, e ela agora é medida.

## 7. Campanhas herdadas

* `mutacoes_c2.js` (auditabilidade, 56 vetores) — âncoras revalidadas **56/56**
  após a mudança de pisos; **não re-executada em cheio** nesta OS, porque as
  propriedades que ela mede são da OS 54-C4 e esta correção só as endureceu. A
  dívida está declarada aqui em vez de ficar implícita num placar antigo.
* `mutacoes_cruzada.js` (composição, 24 vetores) — re-executada nesta árvore:
  **23/24 detectadas**, controles de partida e chegada VERDES com 927 casos. O
  único sobrevivente é `X07` — o caso da unicidade trivializado com o título
  preservado —, que já era o residual DECLARADO da OS 54-C4 e que a §4 desta
  missão proíbe expressamente tocar. Não é regressão: o número e o nome são os
  mesmos de antes, e `X24` continua vermelho, que é a prova de que `X07` é
  perda de cobertura e não escape material.
* `mutacoes_c4.js` (artefato) — inalterada, e a árvore não tocou em
  `ci/artefato.js` nem no manifesto.

## 8. Preservação, por blob contra `0f65655`

| caminho | situação |
| --- | --- |
| `server.js` | idêntico |
| `app.html` | idêntico |
| `contrato/chat-transporte-v1.json` | idêntico |
| `contrato/descoberta-mesas-v1.json` | idêntico |
| `package.json` | idêntico |
| `ci/artefato_produtivo.json` | idêntico |
| `ci/artefato.js` | idêntico |
| `ci/portao_do_ci.js` | idêntico |
| `ci/inventario_de_execucao.js` | idêntico |
| `test/piso_ancorado.js` | idêntico |
| `test/unicidade_do_portador.js` | idêntico |

Gatilhos, branches e permissões do workflow: inalterados. Nenhum
`continue-on-error` introduzido — passou a ser proibido por leitura.
