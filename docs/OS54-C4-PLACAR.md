# OS 54-C4 — placar das provas

Todas as medições abaixo foram feitas nesta árvore, com Node `v24.14.0` / npm
`11.9.0`. Nenhum número foi herdado da OS 54-C2 (`d137048`) nem da OS 54-C3
(`f83b584`) — as duas mediam árvores que não têm `ci/artefato.js`.

## 1. A cadeia oficial, na ordem em que o CI a roda

| etapa | comando | resultado |
| --- | --- | --- |
| provas | `npm test` | **exit 0** — 883 casos, 87 suítes, 0 falhas, 0 cancelados |
| guardião | `node ci/auditabilidade.js` | **AUDITABILIDADE VERDE** |
| inventário | `node ci/inventario_de_execucao.js` | **INVENTÁRIO VERDE** — 12 suítes obrigatórias, nenhum piso furado, casos nominais presentes |
| juiz | `node ci/portao_do_ci.js <saída> <marcador>` | **PORTÃO VERDE** — 883/87 contra piso 883/87 |
| artefato | `node ci/artefato.js --conferir --raiz .` | **ARTEFATO VERDE** — `[package.json, server.js]`, todo o resto excluído por regra declarada, 3 âncoras históricas (`HEAD`, `HEAD^`, base medida) |
| resumo | `node ci/portao_do_ci.js --resumo ...` | tabela com desfecho, alvo, código de saída, suítes, casos, falhas, cancelados, pulados e duração |
| `pretest` | `node test/guarda_do_portao.js` | verde — artefato, unicidade (árvore inteira varrida), glob (28 suítes alcançadas), piso ancorado (30 comparações contra `HEAD` e `9795df7`), 7 amarrações |

## 2. Censo e pisos

| medida | base `9795df7` | esta ponta |
| --- | --- | --- |
| casos (`npm test`) | 814 | **883** |
| suítes (`describe`) | 87 | **87** |
| `casos_minimos` | 814 | **883** |
| `suites_minimas` | 87 | **87** |
| suítes obrigatórias no censo | 10 | **12** |

Pisos por suíte — o textual é a contagem REAL do arquivo (sem folga, cobrada por
`UNI-P3`); o executado veio de `node ci/inventario_de_execucao.js --json`:

| suíte | textual | executado |
| --- | --- | --- |
| `assento_autoritativo.test.js` | 30 | 34 |
| `descoberta.test.js` | 98 | 98 |
| `costura_assento_descoberta.test.js` | 18 | 15 |
| `chat_transporte.test.js` | 31 | 31 |
| `chat_contrato.test.js` | 11 | 10 |
| `controlador_assento.test.js` | 27 | 37 |
| `gate_vip.test.js` | 64 | 49 |
| `unicidade_do_portador.test.js` | 48 | 112 |
| `artefato_unico.test.js` | 54 | 32 |
| `ci_obrigatorio.test.js` | 83 → **99** | 63 |
| `auditabilidade_ci.test.js` | — → **29** | 28 |
| `inventario_executado.test.js` | — → **24** | 22 |

Os dois números medem coisas diferentes e nenhum é derivável do outro: o textual
enxerga `regex.test(`, prosa e chamadas que não são casos; o executado conta
eventos `test:pass` por `data.file`.

## 3. Campanhas

### 3.1 `mutacoes_c4.js` — autoridade do artefato produtivo (OS 52-C4)

**26/26 conforme · 0 divergente · 0 inconclusivo · 0 âncora inválida · árvore
limpa ao final.**

Sete duplicatas indetectáveis por scanner (colchetes, concatenação, vetor de
nomes, template, base64, ingresso computado, notação de ponto), cinco evasões
dinâmicas (`new Function`, `createRequire`, `Reflect.get`, `net` computado, par
`.js`+`.txt`), oito desvios de arranque, três neutralizações da guarda e dois
pacotes concorrentes — todos VERMELHOS, e vinte e cinco deles **pela autoridade
do artefato**, não pela heurística de capacidade. O controle positivo (arquivo
novo em `docs/`) continua VERDE.

### 3.2 `mutacoes_c2.js` — auditabilidade externa

**56/56 detectadas.** Controle de partida e de chegada VERDES, os dois com
883 casos em 87 suítes. Oráculo: a cadeia oficial inteira, em cópia descartável
com histórico próprio.

Dois mutantes **equivalentes**, declarados como tal em vez de virarem número:

* `M26` — a chamada de `conferirCenso()` de dentro da suíte do CI. Ela virou
  defesa redundante quando a obrigatoriedade passou para o `pretest`, e a prova
  disso é `N34`: remover a chamada de LÁ é vermelho. Verde aqui é redundância
  medida, não cobertura acidental.
* `N24b` — a guarda de evento sem `file`. O executor sempre emite origem em
  árvore íntegra, então removê-la não muda saída nenhuma hoje.

Os três vetores que esta OS acrescentou à campanha ficaram vermelhos: `N37`
(invocação do juiz removida do workflow), `N38` (invocação da autoridade do
artefato removida do workflow) e `N39` (chamada do artefato removida do
`pretest`).

### 3.3 `mutacoes_cruzada.js` — composição

**23/24 detectadas · 1 sobrevivente (`X07`), com a não-materialidade PROVADA por
`X24`.** Controles de partida e chegada VERDES nas duas rodadas, ambas sobre a
mesma árvore copiada — `mutacoes_*.js` não entra na cópia, então acrescentar
`X24` ao catálogo não mudou o que foi medido.

Os oito vetores da composição nova, todos VERMELHOS:

| id | sabotagem | quem pegou |
| --- | --- | --- |
| `X16` | passo do ARTEFATO removido do workflow, auditabilidade intacta | `npm test` (guardião no `pretest`) |
| `X17` | chamada do ARTEFATO removida do `pretest` | `npm test` |
| `X18` | conjunto produtivo AMPLIADO (caminho promovido) | `npm test` (âncora histórica) |
| `X19` | `server.js` retirado do conjunto declarado | `npm test` |
| `X20` | ZIP implantável na raiz, sem extensão | `npm test` |
| `X21` | segundo arranque implantável no manifesto | `npm test` |
| `X22` | autoridade do artefato trivializada, o resto intacto | `npm test` |
| `X23` | regressão COORDENADA: artefato trivializado E auditabilidade esvaziada | `npm test` |

E `X06` — nome obrigatório mantido, mas em OUTRO arquivo — é o caso que mostra a
cadeia funcionando por camadas: o `npm test` ficou **verde com 884 casos**, um a
mais que o controle, e quem reprovou foi o **inventário**, pela origem.

## 4. `X07` — o que sobreviveu, e por que não é escape material

`X07` trivializa `UNI-B4` (`ramo tornado MORTO derruba a prova externa`)
preservando o título. Ele sobrevive, e o motivo é estrutural: **nenhuma
autoridade desta árvore lê o CORPO de um caso**. O nome continua executando e
passando (a exigência nominal é satisfeita), a contagem por origem não muda
(o arquivo continua com 112 casos aprovados), e a contagem textual do censo
também não — o corpo daquele caso não carrega ocorrência nenhuma de `test(`.

Sobreviver não é escapar. A pergunta que decide é se algum DEFEITO passou por
causa disso, e `X24` responde medindo em vez de argumentar: ele aplica a
trivialização de `X07` **e** o defeito que `UNI-B4` existe para pegar — o ramo do
analisador tornado morto. Resultado: **VERMELHO**. A autoridade
(`conferirProvaDaUnicidade`, exercitada contra as 57 fixtures no `pretest`)
continua de pé sem o caso que a descreve, e `X13` e `X02` confirmam o mesmo por
outros dois caminhos.

`X07` é, portanto, **perda de cobertura declarada** — um caso de guarda pode ser
esvaziado em silêncio — e não escape material. Não é regressão desta composição:
a base `9795df7` tem exatamente a mesma propriedade, e com menos defesas ao
redor, já que não tinha inventário por execução nenhum. Fica registrado como
residual (§8 do documento da OS).

A medicina que fecharia isso é a mesma que a auditabilidade já tomou: dar
SUBSTÂNCIA mensurável ao caso, em subcasos — foi por isso que `X08` (as três
guardas do rastro trivializadas de uma vez) ficou vermelho, enquanto `X07` não.
Aplicá-la a `UNI-B4` significa reescrever a suíte da OS 52-C3, que não é o
escopo desta correção.

## 5. Os vinte itens que a §7 manda deixar vermelhos

| # | item | vetor(es) |
| --- | --- | --- |
| 1 | upload removido | `N01`, `C01`, `C03` |
| 2 | `if: always()` removido | `N02` (upload), `N07` (resumo) |
| 3 | caminho da evidência desviado | `N03`, `N05` |
| 4 | resumo removido | `N06`, `C02`, `C04`, `X14` |
| 5 | resumo estático ou trivial | `N08`, `N10` |
| 6 | escrita no painel neutralizada | `N09` |
| 7 | guardião trivializado | `N26` |
| 8 | guardião removido | `N25` (disco), `N27` / `X09` (workflow) |
| 9 | inventário reduzido | `N31`, `N23`, `N33`, `X01`, `X03`, `X13` |
| 10 | origem obrigatória falsificada | `N24`, `N22`, `X05`, `X06` |
| 11 | piso rebaixado | `N20`, `N21`, `H28`, `M28`, `X11` |
| 12 | chamada do juiz neutralizada | `N37` (fora do workflow), `N11`, `N12`, `N14` |
| 13 | evidência julgada diferente da publicada | `N03`, `N05` |
| 14 | artefato produtivo ampliado | `X18`, `F4-3` |
| 15 | `server.js` retirado do conjunto | `X19` |
| 16 | ZIP implantável introduzido | `X20`, `F5-1` |
| 17 | segundo arranque implantável | `X21`, `F3-1`..`F3-8` |
| 18 | proteção de unicidade neutralizada | `X22`, `F4-1`, `F4-2`, `X02` |
| 19 | remoção conjunta das guardas de auditabilidade | `C07`, `C08`, `C09`, `X08` |
| 20 | regressão coordenada unicidade × auditabilidade | `X23`, `X12`, `X11` |

Os vinte ficaram vermelhos.

## 6. Preservação, por blob

Idênticos a `9795df7`:

| caminho | blob |
| --- | --- |
| `server.js` | `c8307640324b748a60b30929472ef6ebc6eace7c` |
| `app.html` | `8a223df08b1c92fd1f1438d3a9055f076fd6de60` |
| `contrato/chat-transporte-v1.json` | `d7d4f4613a6508f67527fa391deb3ba89cdf87df` |
| `contrato/descoberta-mesas-v1.json` | `e6b34a0f4015223f6db41b130c90d15e40f99e85` |
| `package.json` | `87f12f3b5d3629b5a99a603e9c7f66d5cb76c28d` |
| `ci/artefato_produtivo.json` | `bed0d3cca0a18b077ddf16a4bef9f2f4bf424f2d` |
| `ci/artefato.js` | `52a802dc28b31e88cec14bd633bcf9337d5eaadb` |
| `ci/portao_do_ci.js` | `06f2cb93162e90fecb7da7329807c935fb3468f3` |
| `test/piso_ancorado.js` | `decb280c7a3333fb7a9eca19748a8cd2a747eafe` |
| `test/unicidade_do_portador.js` | `0a9e6e719479f72ae21b9b2600a61e5b6ede939a` |
