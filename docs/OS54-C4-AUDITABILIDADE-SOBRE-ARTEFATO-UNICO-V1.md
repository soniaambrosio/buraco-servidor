# OS 54-C4 — a auditabilidade externa portada sobre o artefato único homologado

**Base:** `correcao/os52-c4-artefato-unico-v1 @ 9795df7d0dc520bafd3f78596146f721397f3556`
(OS 52-R4 — 814 casos / 87 suítes, artefato produtivo `[package.json, server.js]`)

**Fonte semântica, consultada e não herdada:** a implementação local `f83b584`
(OS 54-C3), que nasceu sobre `99d2eb6` e foi reprovada com a base dela. Nenhum
commit daquela ponta é ancestral desta; nenhum piso, nenhuma contagem e nenhum
nome de caso veio de lá sem nova medição.

---

## 1. O que esta correção resolve

A OS 54-C1 escreveu três guardas corretas para o rastro do CI — `CI-18` (o
artefato do run), `CI-19` (o resumo do painel) e `CI-19b` (o conteúdo do resumo)
— e as pôs **dentro da suíte que elas protegem**. A OS 54-R2 mostrou o preço:
dezesseis sabotagens passaram, porque cada guarda podia ser apagada ou
trivializada isoladamente com o portão oficial VERDE, e o bloco inteiro podia
sumir desde que os nomes ficassem num comentário — o piso por arquivo contava
`test(` no FONTE, inclusive em prosa.

Guarda que mora dentro do que protege não é guarda. A saída é mover a
**autoridade** para fora do conjunto varrido pelo glob, e é isso que esta ponta
entrega — sobre a árvore que a OS 52-R4 homologou, e sem tocar em nada do que
ela decidiu.

## 2. As quatro autoridades externas, e o que cada uma decide

| arquivo | pergunta que ele responde | onde roda |
| --- | --- | --- |
| `ci/portao_do_ci.js` | a EVIDÊNCIA do run é de uma execução real do alvo oficial, e não encolheu? | passo próprio do CI |
| `ci/auditabilidade.js` | o run publica rastro legível, do que foi julgado, e as autoridades continuam invocadas? | passo próprio do CI **e** `pretest` |
| `ci/inventario_de_execucao.js` | quantos casos CADA arquivo executou e aprovou, e quais casos NOMINAIS rodaram? | passo próprio do CI |
| `ci/artefato.js` | o que seria implantado é EXATAMENTE `[package.json, server.js]`? | passo próprio do CI, `pretest`, censo e juiz |

Nenhuma delas mora em `test/*.test.js`. As quatro se vigiam: o guardião cobra a
**presença** das outras três no workflow, e ele mesmo roda também no `pretest` —
tirá-lo do YAML reprova de dentro do `npm test`, que é o único caminho que a
ausência dele não desliga.

## 3. O que esta OS acrescentou à semântica portada

A folha `f83b584` nasceu numa árvore **anterior à OS 52-C4**: `ci/artefato.js`
não existia lá. Portar aquela auditabilidade sem mais nada teria produzido o pior
resultado possível — a metade auditável verde, gritando que tudo está no lugar,
enquanto a autoridade que decide o que pode ser implantado sai da cadeia oficial
com uma edição de duas linhas, e nenhuma campanha de origem enxergando.

As duas famílias dividem **os mesmos quatro endereços**: o workflow, o `pretest`,
o censo e o piso. Por isso a composição foi refeita, e não transplantada:

* **`INVOCACOES_OBRIGATORIAS`** ganhou `node ci/artefato.js --conferir` — o passo
  do artefato passou a estar sob a mesma exigência dos outros três: presente, sem
  `if:`, sem `continue-on-error:`;
* **`CHAMADAS_DO_PRETEST`** ganhou `exigirArtefatoUnico(...)`, lido do PROGRAMA e
  não do texto — comentar a linha é a sabotagem mais barata que existe;
* **`ci/pisos_autorizados.js`** ganhou `artefato_unico.test.js` nas TRÊS listas:
  piso textual, piso executado e **nomes obrigatórios** (`ART-01`, `ART-03`,
  `ART-04`, `ART-05`, `ART-15`, `ART-19`, `ART-22`, `ART-23`, `ART-24`) — os nove
  que carregam conjunto ampliado, `server.js` fora do conjunto, pacote
  implantável, segundo arranque e neutralização da própria guarda;
* **`test/arvore_forjada.js`** passou a copiar a autoridade do artefato e a
  expor `TRECHOS.invocacaoArtefato`;
* **`test/auditabilidade_ci.test.js`** ganhou `AUD-18`, `AUD-18b`, `AUD-19` e
  `AUD-20`, e **`test/ci_obrigatorio.test.js`** ganhou `CI-20d` — os casos que
  exercitam exatamente essa costura;
* **`test/inventario_executado.test.js`** ganhou `INV-15`, que impede a entrada
  do artefato de sumir das listas em silêncio;
* **`mutacoes_c2.js`** e **`mutacoes_cruzada.js`** passaram a ter o artefato como
  **quarto passo do oráculo**: sem ele, toda sabotagem que atravessasse a
  auditabilidade e morresse no artefato seria contada como ESCAPE.

## 4. A colisão de nomes, resolvida conscientemente

A base tinha `CI-17`, `CI-18` e `CI-19` **duas vezes** no mesmo arquivo: uma no
bloco do workflow e da auditabilidade, outra no bloco da autoridade do piso da
OS 52-C3. Enquanto os nomes eram só títulos, a duplicata era feia e inofensiva.
Deixou de ser: `ci/pisos_autorizados.js` cobra casos **pelo nome e pela origem**,
e com dois `CI-18` no mesmo arquivo apagar o da auditabilidade seria coberto pelo
do piso — a exigência nominal aprovaria uma suíte da qual a metade auditável
tinha sumido.

Os três do bloco do piso viraram `CI-21`, `CI-22` e `CI-23`, e os três entraram
na lista de nomes obrigatórios. A renumeração não afrouxou nada: eles passaram a
ser exigidos por execução e por origem, o que antes não eram.

## 5. O piso textual FICOU, e isso é uma decisão

A folha `f83b584` apagou o contador textual de `test/censo_de_suites.js` e a
asserção de piso por arquivo, delegando quantidade inteiramente ao inventário.
Aqui não: aquele piso **já estava na base homologada**, roda barato no `pretest`
e não decide sozinho nada — o mínimo externo de `ci/pisos_autorizados.js` e a
comparação com o commit anterior de `test/piso_ancorado.js` o cercam dos dois
lados, e `UNI-P3` exige que ele seja a contagem REAL, sem folga.

Trocar uma proteção por outra não é compor; é empatar. A hierarquia mudou — o
texto virou heurística barata, a EXECUÇÃO virou autoridade —, mas nada foi
devolvido.

## 6. As 87 suítes, ditas em voz alta

`883 casos / 87 suítes`. Os casos subiram 69; as suítes **não subiram**, e isso
é medido, não esquecido: o contador `suites` do `node --test` conta blocos
`describe`, e as duas suítes novas usam grupos `test(...)` — exatamente como
`test/ci_obrigatorio.test.js`, a suíte irmã, já usava desde a OS 54.

Quem apagar qualquer uma das duas cai em quatro autoridades independentes, e
nenhuma delas é esse contador: o piso de CASOS (883), o censo (`OBRIGATORIAS`),
o inventário por execução (suíte que não executa é reprovação) e a comparação de
arquivos de suíte contra o commit anterior.

## 7. O que NÃO mudou

Confirmado por blob contra `9795df7`:

* `server.js` — `c8307640324b748a60b30929472ef6ebc6eace7c`
* `app.html` — `8a223df08b1c92fd1f1438d3a9055f076fd6de60`
* `contrato/chat-transporte-v1.json` — `d7d4f4613a6508f67527fa391deb3ba89cdf87df`
* `contrato/descoberta-mesas-v1.json` — `e6b34a0f4015223f6db41b130c90d15e40f99e85`

O conjunto produtivo continua `[package.json, server.js]`; `ci/artefato_produtivo.json`
não foi tocado; `scripts.start`, `scripts.test` e `scripts.pretest` continuam
literalmente o que eram. Política de ingresso, assento, chat e reconexão: nada.

## 8. O que continua em aberto

* **A Railway.** Esta OS não autoriza implantar `9795df7` nem alterar `main`, e o
  estado do provedor não faz parte desta correção.
* **O contador de `suites`.** Ele mede `describe`, e este repositório escreve as
  suítes de guarda com grupos `test(...)`. O número não sobe quando uma suíte
  dessas nasce. Está cercado (§6), mas continua sendo um número que não acompanha
  o que ele parece medir.
* **Um caso de guarda pode ser esvaziado em silêncio.** `X07` da campanha
  cruzada trivializa `UNI-B4` preservando o título e SOBREVIVE: nenhuma
  autoridade desta árvore lê o CORPO de um caso — o nome executa e passa, a
  contagem por origem não muda, e a textual também não. Não é escape material,
  e isso foi MEDIDO e não argumentado: `X24` aplica a mesma trivialização junto
  com o defeito que `UNI-B4` existe para pegar, e fica VERMELHO. Também não é
  regressão desta composição — a base `9795df7` tem a mesma propriedade, com
  menos defesas ao redor. Fecha-se dando SUBSTÂNCIA em subcasos ao caso, que é
  o que a auditabilidade fez (por isso `X08` é vermelho e `X07` não), e isso
  significa reescrever a suíte da OS 52-C3 — fora do escopo deste porte.
* **Rebaixar os dois pisos ao mesmo tempo** continua possível — é a intenção do
  desenho: o custo passa a ser uma edição em duas famílias, visível na revisão,
  em vez de um dígito num arquivo só. E mesmo isso não alcança os nomes
  obrigatórios.
