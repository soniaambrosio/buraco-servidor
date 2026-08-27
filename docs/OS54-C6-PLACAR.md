# OS 54-C6 — placar das provas

Node `v24.14.0` / npm `11.9.0`. Base: `7c81bd64948b6777c74aa58845744369180cf7c9`.
Bancada: `C:\os54c6` (worktree próprio, criado do SHA da base).

---

## 1. Gate Zero

| item | resultado |
| --- | --- |
| HEAD na base | `7c81bd64948b6777c74aa58845744369180cf7c9` |
| árvore limpa (inclusive não rastreados) | sim |
| branch `correcao/os54-c6-…` no remoto | não existe |
| pai / cadeia / merge | pai `0f65655`; cadeia linear `9ddaea4 → 750a012 → 4577048 → 99d2eb6 → d4c94f8 → 9795df7 → 0f65655 → 7c81bd6`; nenhum merge na linhagem OS 54 |
| `npm test` reproduzido | **927 casos / 87 suítes**, 0 falhas, exit 0 |
| controle inicial da campanha C5 | `--secar` 27/27 âncoras válidas |
| processos e portas da missão | nenhum processo `node`; só sockets `TIME_WAIT` da própria corrida |
| bancada `C:\os54r5\wesc` | **não tocada** — só lida como evidência da R5 |

**Discrepância declarada.** A OS diz que a base é local e não publicada. Ela
**está** publicada: `git ls-remote origin` devolve
`refs/heads/correcao/os54-c5-invocacoes-autoritativas-workflow-v1 → 7c81bd6`.
Nada foi publicado por esta OS; o fato é registrado porque a instrução
"não publicar a base reprovada" pressupõe o contrário.

## 2. O defeito da R5, reproduzido antes de ser fechado

Numa cópia descartável, com uma suíte **realmente vermelha** (`npm test` →
exit 1, 928 casos declarados, 924 aprovados, **4 falhas**):

| cadeia | código de saída |
| --- | --- |
| `node ci/portao_do_ci.js <saída> <marcador>` | **1** — `PORTÃO VERMELHO`, 3 reprovações |
| `bash -e -c 'node … \|\| echo "seguimos"'` | **0** — o passo terminaria VERDE |
| `bash -e -c 'node …'` (forma canônica) | **1** — o problema desaparece |

## 3. A cadeia oficial na árvore final

| etapa | resultado |
| --- | --- |
| `npm test` | **exit 0** — 956 casos, 87 suítes, 0 falhas, 78 108 ms |
| `node ci/auditabilidade.js` | **AUDITABILIDADE VERDE** |
| `node ci/codigo_de_saida.js` | **CÓDIGO DE SAÍDA PRESERVADO** |
| `node ci/inventario_de_execucao.js` | **INVENTÁRIO VERDE** — 14 suítes obrigatórias |
| `node ci/portao_do_ci.js <evidência real>` | **PORTÃO VERDE** — 956/87 contra piso 956/87 |
| a **ação do portão** sobre a mesma evidência | **PORTÃO VERDE** — exit 0, idêntico ao juiz |
| `node ci/artefato.js --conferir --raiz .` | **ARTEFATO VERDE** — `[package.json, server.js]` |
| `node ci/portao_do_ci.js --resumo …` | painel completo, **VERDE** |
| `node test/guarda_do_portao.js` (`pretest`) | verde — 33 comparações de piso ancorado, 7 amarrações |

## 4. Censo e pisos

| medida | base `7c81bd6` | esta ponta |
| --- | --- | --- |
| casos | 927 | **956** |
| suítes | 87 | **87** |
| `casos_minimos` | 927 | **956** |
| `suites_minimas` | 87 | **87** |
| `medido_na_arvore_desta_os` | 927 / 87 | **956 / 87** |
| `CASOS_MEDIDOS_NA_BASE` (2ª leitura) | 927 | **956** |
| suítes obrigatórias no censo | 13 | **14** |

Piso por arquivo, medido e sem folga:

| arquivo | textual | executado |
| --- | --- | --- |
| `codigo_de_saida.test.js` (**nova**) | 31 | 29 |
| `ci_obrigatorio.test.js` | 99 → **100** | 63 |
| `auditabilidade_ci.test.js` | 42 → **43** | 41 |
| os onze restantes | inalterados | inalterados |

Novo: `PESO_DOS_NOMINAIS` em `ci/pisos_autorizados.js` — afirmações mínimas por
caso nominal, medidas: `SAI-00` 1, `SAI-02` 1, `SAI-04` 1, `SAI-09` 1,
`SAI-17` 1, `SAI-18` 1, `SAI-19` 8, `SAI-20` 6, `SAI-22` 2.

## 5. Campanha da OS 54-C6 — 24 sabotagens + 4 controles

Oráculo: `npm test` (com o `pretest`) → guardião → preservação → inventário →
**ação do portão** → artefato. A evidência é a real: a saída literal do
`npm test` daquela árvore e o código de saída real dele.

Controle de partida: **VERDE**, 956 casos / 87 suítes. Controle de chegada:
**VERDE**, 956 casos.

| id | sabotagem | veredito |
| --- | --- | --- |
| A01 | juiz seguido por mensagem que termina com sucesso (`\|\| echo`) | VERMELHO |
| A02 | juiz seguido por comando neutro do sistema (`; :`) | VERMELHO |
| A03 | juiz seguido por executável de sucesso explícito (`\|\| /bin/true`) | VERMELHO |
| A04 | juiz seguido por encerramento explícito com zero | VERMELHO |
| A05 | resultado do juiz encaminhado por cano | VERMELHO |
| A06 | juiz em segundo plano sem espera | VERMELHO |
| A07 | modo tolerante a erro antes do juiz (`set +e`) | VERMELHO |
| A08 | juiz envolvido por interpretador intermediário (`bash -c`) | VERMELHO |
| B09 | `continue-on-error` habilitado | VERMELHO |
| B10 | condição que pula o passo (`if: false`) | VERMELHO |
| B11 | condição de cenário incompatível (`runner.os == 'Windows'`) | VERMELHO |
| B12 | shell substituído (`shell: pwsh`) | VERMELHO |
| B13 | passo duplicado, sendo um permissivo | VERMELHO |
| B14 | nome preservado com conteúdo diferente | VERMELHO |
| B15 | evidência trocada | VERMELHO |
| B16 | marcador trocado | VERMELHO |
| C17 | autoridade externa removida do disco | VERMELHO |
| C18 | chamada externa retirada do `pretest` | VERMELHO |
| C19 | teste nominal trivializado | VERMELHO |
| C20 | forma canônica retirada da lista protegida | VERMELHO |
| C21 | identidade recarimbada após a neutralização | VERMELHO |
| C22 | entrypoint da ação substituído por um que aprova | VERMELHO |
| C23 | runtime Node alterado (`node20`) | VERMELHO |
| C24 | invocação movida para variável | VERMELHO |
| **D25** | controle negativo: suíte deliberadamente vermelha | **VERMELHO** (esperado) |
| **D26** | controle: árvore íntegra | **VERDE** |
| **D28** | controle: chamada canônica alternativa (bloco escalar) | **VERDE** |

**27/27 · zero escapes · zero inconclusivas.**

## 6. Campanha herdada da OS 54-C5 — 27/27

Controle de partida **VERDE** (956/87), controle de chegada **VERDE**.
Todas as 25 sabotagens vermelhas; `E26` e `E27` verdes.

`mutacoes_c5.js` recebeu **uma** mudança, declarada: a âncora de `E23` era o
literal `"casos_minimos": 927,`. Com o piso em 956 o caso **abortou por âncora**
— e caso que morre por âncora não mede nada, só some do placar. A âncora passou
a sair do arquivo. A sabotagem é a mesma: *o piso exige mais casos do que
existem*.

O extrator `runDoPasso` de `test/arvore_forjada.js` foi generalizado para
devolver a linha do `uses:` quando o passo não tem `run:`. Sem isso, `E01`,
`E05`, `E11` e `E17` — as quatro que miram o juiz — morreriam por âncora. Com a
generalização elas continuam dizendo o que sempre disseram.

## 7. Preservação — por blob, contra a base

| caminho | blob |
| --- | --- |
| `server.js` | `c8307640324b748a60b30929472ef6ebc6eace7c` |
| `app.html` | `8a223df08b1c92fd1f1438d3a9055f076fd6de60` |
| `package.json` | `87f12f3b5d3629b5a99a603e9c7f66d5cb76c28d` |
| `contrato/chat-transporte-v1.json` | `d7d4f4613a6508f67527fa391deb3ba89cdf87df` |
| `contrato/descoberta-mesas-v1.json` | `e6b34a0f4015223f6db41b130c90d15e40f99e85` |
| `ci/artefato.js` | `52a802dc28b31e88cec14bd633bcf9337d5eaadb` |
| `ci/artefato_produtivo.json` | `bed0d3cca0a18b077ddf16a4bef9f2f4bf424f2d` |
| `ci/portao_do_ci.js` | `06f2cb93162e90fecb7da7329807c935fb3468f3` |
| `ci/inventario_de_execucao.js` | `ef0141b187228639e7f5a4822bf7f3f5a4eb62cc` |
| `ci/invocacao_executavel.js` | `ce6879778d2eb2fca6f091515c1def5e58ca8489` |

Todos **idênticos** aos da base. `package.json` não mudou: o `pretest` já
apontava para `test/guarda_do_portao.js`, e a chamada nova entrou no corpo da
guarda, não no manifesto.

## 8. Um incidente da bancada, registrado

Durante o levantamento das campanhas restantes, `mutacoes_assento.js` foi
disparado por engano (ele ignora `--listar` e roda a campanha inteira). Ele muta
`server.js` **no lugar** e restaura no fim; morto pelo limite de tempo, deixou a
mutação nº 1 — *restaurar o fallback silencioso de assento* — injetada na árvore
de trabalho.

Detectado por `mutacoes_c4.js`, que recusa árvore suja e listou `M server.js`.
`server.js` foi restaurado do blob da base e reconferido: `c8307640…`, o mesmo
sha256 registrado no Gate Zero. As campanhas da C6 e da C5 já haviam terminado
**antes** do incidente, sobre `server.js` íntegro; a única corrida afetada foi a
primeira tentativa de `mutacoes_cruzada.js`, que abortou com *"a cópia limpa já
está vermelha"* e foi refeita depois da restauração.

## 9. As outras campanhas do repositório

| campanha | o que guarda | resultado nesta ponta |
| --- | --- | --- |
| `mutacoes_c4.js` | auditabilidade sobre o artefato produtivo único | **26/26 conforme · 0 divergente · 0 inconclusivo**, controle final VERDE |
| `mutacoes_cruzada.js` | a composição unicidade × auditabilidade × artefato | **23/24**, controle inicial e final VERDES — um escape, `X07` |
| `mutacoes_assento.js`, `mutacoes_costura.js`, `mutacoes_c2.js`, `mutacoes_c3.js` | invariantes de `server.js` (assento, costura) e unicidade por capacidade | **não executadas** — ver abaixo |

**Por que quatro não foram executadas, dito em voz alta.** `assento` e `costura`
mutam `server.js`, que nesta ponta é **byte a byte o da base** (blob
`c8307640…`), e são julgadas pela suíte inteira — que está verde, 956/956.
`c2` e `c3` guardam a unicidade por capacidade, cujos arquivos também não foram
tocados. Cada uma custa entre 26 e 68 corridas completas da suíte; somadas,
passam de quatro horas de bancada. A escolha foi rodar as duas que dividem
endereço com o que esta OS editou — workflow, `pretest`, censo, pisos,
auditabilidade — e declarar as outras em vez de afirmá-las sem medir.

### `X07` — um escape herdado, e não uma regressão

`X07` trivializa `UNI-B4` em `test/unicidade_do_portador.test.js` preservando o
título. O caso continua existindo, executando e **aprovando**: o censo conta
`test(` no fonte (não mudou), o inventário conta casos aprovados por origem (não
mudou), e a exigência nominal só cobra o nome (continua lá).

**Medido na base**, numa cópia de `7c81bd6` com o `mutacoes_cruzada.js` da
própria base: `X07` → **VERDE, 927 casos**. O buraco é anterior a esta OS e não
foi aberto por ela.

O mecanismo que o fecharia é o que esta OS introduziu — `PESO_DOS_NOMINAIS` em
`ci/pisos_autorizados.js`, que já reprova exatamente essa sabotagem para a suíte
nova (é o cenário `C19`). Estendê-lo à família da unicidade **não** foi feito:
exigiria declarar pesos para nove casos nominais de uma suíte que esta OS não
estudou, e piso declarado sem medida é folga com outro nome. Fica nomeado para
quem cuidar daquela família.

`X11` e `X12` traziam o piso `927` em literais e **abortavam por âncora** com o
piso em 956. As âncoras passaram a sair dos arquivos; as sabotagens são as
mesmas. `CASOS_MEDIDOS_NA_BASE` subiu de 927 para 956 — é a "segunda leitura"
que a prosa do próprio bloco promete manter em dia, e deixá-la para trás abriria
a divergência silenciosa que `CI-23` existe para fechar.
