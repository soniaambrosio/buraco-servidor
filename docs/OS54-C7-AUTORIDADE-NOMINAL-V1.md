# OS 54-C7 — o caso nominal protegido não pode perder o conteúdo

**Base:** `correcao/os54-c6-codigo-saida-autoritativo-workflow-v1 @ d85adca59250dd17803c578db6f78b1399600642`
(OS 54-C6 — 956 casos / 87 suítes; publicada, run externo `33032609180` verde)

---

## 1. O que a OS 54-R6 derrubou

A C6 introduziu `PESO_DOS_NOMINAIS`: um mínimo de **afirmações** por caso
nominal, medido e guardado fora do arquivo protegido. A R6 mostrou que o
mecanismo não fecha o eixo que dizia fechar, e o erro é aritmético:

| caso | peso declarado pela C6 | peso de `assert.ok(true)` |
| --- | --- | --- |
| `SAI-00`, `SAI-02`, `SAI-04`, `SAI-09`, `SAI-17`, `SAI-18` | **1** | **1** |
| `SAI-22` | **2** | 2, com duas triviais |

Cinco dos nove protegidos concentram a afirmação num ajudante (`exigeMotivo`), e
por isso pesavam 1. Trocar o corpo inteiro por `assert.ok(true)` preserva o
número. `E36` (`SAI-02`) e `E38` (`SAI-22`) passaram com a **cadeia oficial
verde**, e `X07` (`UNI-B4`) fazia o mesmo desde antes da C6.

Contar afirmações mede a **forma** da prova, nunca o conteúdo dela. A C6
documentou isso como se fechasse o eixo; a documentação foi corrigida nesta
ponta, e não apagada — o erro fica legível.

E mais cinco escapes tinham a mesma origem: `E21` (peso reduzido), `E22` (fonte
de pesos removida), `E32` (piso executado rebaixado), `E33` (piso textual
rebaixado) e `E34` (nomes obrigatórios esvaziados). Todos esses números viviam
só em `ci/pisos_autorizados.js` — **um arquivo editável, fora da autoridade
ancorada**.

## 2. A correção: o PROGRAMA do corpo, e a monotonicidade do commit

`PESO_DOS_NOMINAIS` foi **removido** (não desativado: o código saiu). No lugar,
`CONTEUDO_DOS_NOMINAIS`, com duas medidas independentes por caso protegido:

* **`peso`** — quantidade de **tokens de programa**. Comentário não conta;
  literal de string, de template e de expressão regular contam **um** token
  cada, seja qual for o tamanho;
* **`digest`** — impressão do mesmo fluxo de tokens, e nele cada literal entra
  com a **impressão do próprio conteúdo**.

A separação entre as duas não é detalhe:

| sabotagem | por que morre |
| --- | --- |
| corpo → `assert.ok(true)` | o peso desaba |
| corpo → N afirmações triviais | o peso desaba na mesma proporção |
| corpo movido para **string** | o literal vale 1 token: o peso desaba |
| corpo movido para **comentário** | comentário é descartado: o peso desaba |
| corpo trocado por ajudante benigno | o digest não bate |
| mensagens trocadas entre dois casos | o digest não bate (a impressão do literal entra nele) |
| reformatação e prosa nova | **nada acontece** — e isso é a trava anti-veto |

### E o que impede o recarimbo

Sozinha, a tabela seria recarimbável: quem trivializa o caso e atualiza `peso` e
`digest` na mesma alteração reconcilia a declaração com o corpo. Ela **não está
sozinha**.

`test/piso_ancorado.js` — a autoridade ancorada da OS 52-C3, que compara com o
**commit anterior** — passou a ler `ci/pisos_autorizados.js` e os **corpos dos
casos protegidos** do commit, e a exigir monotonicidade:

1. o conjunto de casos protegidos não pode encolher;
2. o `peso` **declarado** não pode cair;
3. o `peso` **real** do corpo de hoje não pode cair abaixo do peso real que
   aquele mesmo corpo tinha no commit âncora.

A terceira é a que fecha o recarimbo: ela não compara declaração com
declaração — compara o **corpo de hoje com o corpo de ontem**, e ontem não se
edita.

## 3. `ci/pisos_autorizados.js` entrou na autoridade ancorada

Era essa a §2 da OS, e é o que fecha `E21`, `E22`, `E32`, `E33` e `E34` de uma
vez. A partir desta ponta, e sempre contra o commit:

* `MINIMO_DECLARADO_NO_CENSO` e `MINIMO_EXECUTADO` — chave que some reprova,
  valor que cai reprova;
* `NOMES_OBRIGATORIOS` — lista que encolhe reprova;
* `CONTEUDO_DOS_NOMINAIS` — as três regras acima;
* `medido_sobre` — **só quando muda**: o SHA novo tem de estar na história e tem
  de descender do antigo.

A ressalva do `medido_sobre` não é indulgência, e custou uma medição: toda
campanha deste repositório roda em cópia descartável, que é um repositório novo
com um commit só. O `medido_sobre` herdado aponta para um commit que aquela
cópia nunca teve, e exigir ancestralidade ali reprovava a **árvore íntegra** por
falta de história — o controle da sonda caiu antes de qualquer sabotagem.

## 4. As duas moradas

| metade | onde roda | o que a derruba |
| --- | --- | --- |
| `ci/pisos_autorizados.js` | `pretest` **e** passo próprio do workflow (`Conteúdo dos casos nominais`) | apagá-la quebra o `require` das duas pontas; trivializá-la deixa a suíte vermelha |
| `test/codigo_de_saida.test.js` (`SAI-24`…`SAI-30`) | `npm test`, censo, pisos, inventário, nomes obrigatórios | apagá-la cai em cinco autoridades; trivializar `SAI-25` ou `SAI-29` cai no próprio conteúdo protegido |

O passo novo é `run: node ci/pisos_autorizados.js`, e está na lista de **comando
único** de `ci/codigo_de_saida.js`: quem puder compor o passo que confere
composição desliga a conferência sem tocar em mais nada.

## 5. As campanhas reancoradas

A R6 encontrou quatro sabotagens herdadas que **tinham deixado de executar** —
morriam por âncora e sumiam do placar parecendo cobertura:

| campanha | vetor | o literal obsoleto | como ficou |
| --- | --- | --- | --- |
| `mutacoes_c2.js` | `M28` | `"ci_obrigatorio.test.js": 99,` | a linha do censo é lida do arquivo |
| `mutacoes_c2.js` | `N20` | `"casos_minimos": 927,` | o piso é lido do JSON |
| `mutacoes_c2.js` | `N37` | o passo do juiz na forma `run:` | o passo é lido do workflow, seja `run:` ou `uses:` |
| `mutacoes_c3.js` | `E6` | a linha do censo com o comentário de outra OS | a linha é lida do arquivo |

E dois que **já estavam sem âncora na base da C6**:

* **`PIS-D`** — a propriedade continua existindo (o piso do piso ainda mora na
  suíte do CI); só o literal `883` estava obsoleto. **Reconstituído**, lendo a
  constante de hoje.
* **`REC-B`** — idem, para as duas constantes do recarimbo coordenado.

Nenhum vetor saiu do placar. `mutacoes_c6.js` também teve `C21` reancorado pelo
mesmo motivo (os pisos subiram nesta ponta).

`mutacoes_c3.js` ganhou `--secar`, que faltava: ele **copia a árvore**, roda a
secagem dentro da cópia e confere `server.js` por hash antes e depois. A árvore
real não é tocada — a OS 54-C6 registrou o preço de uma campanha que muta
`server.js` no lugar e é morta no meio.

## 6. Os limites, ditos em voz alta

1. **Isto não pega enchimento.** Um corpo do mesmo tamanho em tokens que não
   prova nada passa. Nenhuma leitura barata separa código forte de código
   inerte, e fingir que separa foi exatamente o erro da C6. O que existe contra
   o enchimento é o inventário por execução, o piso ancorado e a campanha.
2. **A monotonicidade do corpo só vale a partir do commit desta OS.** O commit
   âncora anterior (`d85adca`) não tem `CONTEUDO_DOS_NOMINAIS`, então a terceira
   regra da §2 não tem o que comparar contra ele. Nas campanhas ela é exercitada
   de verdade — a cópia descartável commita a árvore íntegra antes de sabotar —,
   e no repositório real ela passa a valer do commit seguinte em diante.
3. **A última guarda continua removível por quem tem escrita.** Apagar a
   autoridade ancorada, as amarrações e a suíte é uma edição maior e mais
   visível, e cada passo dela é vermelho antes do seguinte. Não há saída dessa
   circularidade dentro de um repositório.
4. **Um vazamento de bancada, fechado de passagem.** `forjar()` criava um
   diretório temporário por chamada e nunca o removia; 8053 órfãos encheram o
   disco e produziram um vermelho falso numa campanha. A remoção passou a
   acontecer na saída do processo. Não é o assunto desta OS, mas é o tipo de
   defeito que faz uma medição mentir — e mediu errado uma vez.
5. **Pendência operacional herdada:** conferir os BYTES do artefato publicado
   exige acesso autenticado ao provedor, que esta bancada não tem. O que está
   provado localmente é o conjunto (`git archive` → `[package.json, server.js]`).
