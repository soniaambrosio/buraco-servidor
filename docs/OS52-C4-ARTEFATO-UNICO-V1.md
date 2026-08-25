# OS 52-C4 — Autoridade canônica do artefato produtivo único

Base: `99d2eb6c93c9e29132124d2392276a85201155d4`
(branch `correcao/os52-c3-capacidade-composta-arvore-v1`, pai `4577048536fd3a674fbd97559080138b837704db`)

## A pergunta trocou

As OS 52-C1 a C3 protegiam o repositório perguntando **"isto se parece com um
servidor?"**. A resposta foi ficando boa — nome, depois trecho canônico, depois
capacidade executável, depois capacidade composta da árvore, com nove ramos e
três escopos. E a pergunta continuava errada.

Reconhecimento sintático tem um teto que nenhuma expressão regular atravessa.
Está medido nesta entrega: o scanner da C3, o melhor que esta linhagem já teve,
devolve **zero sinais e zero acusações** para

```js
const h = require('node:http');
const s = h['createServer'](function (q, r) { r.end('viva'); });
s['listen'](Number(process.env.PORT_DUP) || 9401);
```

que é um servidor completo — sobe, responde `HTTP 200` com o corpo `viva`. Cada
evasão dessas exige uma regra nova, e a regra nova chega **depois** do escape.

A OS 52-A2 trocou a pergunta para **"isto pertence ao que é implantado?"**. A
propriedade autoritativa passa a ser a **unicidade implantável**, e ela não lê o
conteúdo de arquivo nenhum.

## A propriedade, em três cláusulas

1. o conjunto de caminhos do artefato produtivo é **exatamente** o declarado —
   igualdade de conjunto, nunca contenção;
2. `scripts.start` é literalmente `node server.js`, e nenhum segundo script
   **arranca** um arquivo do artefato;
3. o artefato não carrega compactado, elo simbólico, segundo manifesto nem
   diretório com manifesto próprio.

**Conjunto produtivo:** `server.js` e `package.json`. Os outros 70 caminhos
versionados são classificados como excluídos por uma regra declarada. Caminho
que não caia em nenhum dos dois montes **reprova** — é arquivo que subiria sem
ninguém ter decidido que sobe.

## Como a autoridade funciona

`ci/artefato.js` não amplia scanner, não abre parser e não executa arquivo
nenhum da árvore. Ele faz aritmética de conjunto sobre caminhos:

| passo | fonte | o que decide |
|---|---|---|
| classificação | união de `git ls-tree -r HEAD` com `git ls-files -c -o --exclude-standard` | todo caminho é produtivo declarado ou casa com uma exclusão declarada |
| modo | `git ls-tree` | `120000` é elo simbólico, `160000` é submódulo — os dois trazem conteúdo de fora |
| arranque | `package.json` do commit **e** do disco | `start` literal; nenhum segundo script arranca produtivo |
| artefato | `git archive --format=tar HEAD` | depois das exclusões declaradas, o que sobra é exatamente o artefato |
| âncora | `HEAD`, `HEAD^` e a base medida | o conjunto produtivo não muda por edição da declaração |

**Os dois mundos.** O que o provedor recebe é o **commit** — por isso o artefato
sai de `git archive`. Mas uma guarda que só olhasse o commit acusaria depois do
commit feito, e o `pretest` existe para acusar antes. Por isso a classificação
roda sobre a união, e o arranque é lido nas duas pontas. Arquivo ignorado pelo
`.gitignore` não entra: ele não é commitado, logo não é implantado.

**A âncora.** Promover uma duplicata a `produtivos` e realinhar o manifesto no
mesmo movimento é a sabotagem que a declaração sozinha não pega — quem edita a
declaração edita também o que ela declara. Quando o commit ancestral não tem
manifesto (a base `99d2eb6` não tem), o conjunto é **derivado** dele: o alvo de
`scripts.start` mais o próprio `package.json`. Derivado da história, não
declarado por ninguém.

## Uma premissa da OS que colide com o manifesto congelado

A OS exige *"nenhum segundo script invoca node"* **e** proíbe alterar
`scripts.test` — que é `node --test "test/*.test.js"`. `pretest` e `check`
também chamam `node`. Lido ao pé da letra, o requisito reprovaria a base no
primeiro segundo e não haveria correção possível sem violar a proibição.

A regra implementada é a que o §START EXATO sustenta — a lista de recusas dele é
toda de formas de **arrancar o produto por outro caminho**:

> nenhum script além de `start` pode **arrancar** um arquivo do artefato.

Script que chama `node` contra caminho excluído (`test/`, `ci/`) é ferramenta,
não deploy. `node --check server.js` toca um produtivo e não arranca nada:
`--check` analisa a sintaxe e sai. As recusas categóricas valem para qualquer
script, alvo nenhum importa: `-e`, `--eval`, `-p`, `--print`, composição de
shell, `npm run` indireto, `.mjs`, `.cjs` e alvo sem extensão.

**Esta é a única interpretação declarada.** Se a arbitragem quiser a leitura
literal, o caminho é liberar `scripts.test` — e aí a regra vira uma linha.

## Amarração, em quatro pontos que se cobram

| ponto | o que faz | o que a remoção custa |
|---|---|---|
| `pretest` (`test/guarda_do_portao.js`) | chama `exigirArtefatoUnico()` **antes do glob** | estreitar `scripts.test` não desliga a autoridade |
| censo (`test/censo_de_suites.js`) | chama a autoridade de dentro do anel recíproco | as suítes obrigatórias ficam vermelhas |
| juiz (`ci/portao_do_ci.js`) | confere existência **e chamada executável** | passo separado do `npm test` |
| workflow | `node ci/artefato.js --conferir --raiz .`, depois do juiz, sem `if:` nem `continue-on-error:` | job não fica verde por conta própria |

O juiz distingue **chamada** de **menção** com um scanner léxico próprio: nome
dentro de string, em comentário ou num `require` sem invocação **não** satisfaz
a amarração. As trinta linhas de scanner são duplicadas de propósito — a
autoridade do artefato não pode depender da heurística de capacidade, senão
apagar a heurística apaga as duas.

## Pisos

| | casos | suítes |
|---|---|---|
| base `99d2eb6` | 786 | 83 |
| OS 52-C4 | **813** | **87** |

Pisos iguais à medição real, sem margem. Margem é espaço para perder caso sem
reprovar.

## A unicidade por capacidade continua

Ela roda, continua útil e **deixou de decidir**. Segue pegando compactado em
qualquer canto da árvore, prosa que não é capacidade, fragmentação entre
arquivos e as 68 sabotagens da campanha da C3. O que mudou é a ordem: a
autoridade do artefato roda **primeiro**, e quando ela reprova a heurística nem
chega a ser consultada.

## Limites, ditos em voz alta

* **Código deliberadamente hostil não é impedido.** Um `server.js` que baixasse
  e executasse carga em tempo de execução continuaria sendo um caminho só, e
  passaria. A propriedade guardada é o CONJUNTO, não a intenção do conteúdo.
* **A guarda por capacidade permanece heurística.** Ela não decide mais, e
  continua tendo o teto que a R2 e esta OS mediram.
* **O painel do Railway pode substituir o `start`.** A autoridade confere o
  `package.json`; ela não alcança uma configuração feita fora do repositório.
* **A autoridade externa do deploy ainda precisa ser verificada.** Ninguém
  confirmou que o provedor implanta o commit desta linhagem, e não outro.
* **`main` não tem proteção nem status check obrigatório.** Nada impede um push
  direto que ignore tudo isto.
* **A linhagem ainda não está em `main`.** Todo o trabalho das OS 52 e 54 vive
  em branches de correção.
* **O artefato implantado por `main` contém duplicatas e ZIP autônomo.** Não é
  suposição — `git ls-tree -r origin/main` devolve sete caminhos:
  `app.html`, `buraco-servidor.zip`, `mesa-online.html`, `mesa-online_rc.html`,
  `package.json`, `server.js`, `server_js.txt`.

## Campanha

`node mutacoes_c4.js` — 25 vetores obrigatórios mais um controle positivo. O
laudo medido está em `docs/OS52-C4-PLACAR.md`.
