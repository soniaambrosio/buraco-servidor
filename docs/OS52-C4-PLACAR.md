# OS 52-C4 — placar da campanha negativa

Medido em `2d7da7b5d07f3fbcf7612e27e9096d3896de6c55`, com `node mutacoes_c4.js`.
Cada vetor é injetado na árvore de trabalho, julgado pelo **portão oficial**
(`npm test`), e a árvore é restaurada e conferida antes do vetor seguinte.

## Placar

```
CONTROLE INICIAL (árvore íntegra): VERDE · npm exit 0
CONTROLE FINAL   (árvore íntegra): VERDE · npm exit 0
PLACAR: conforme=26 · divergente=0 · inconclusivo=0 · âncora-inválida=0 · total=26
árvore limpa ao final: true
INTEGRIDADE DO LOG: bruto=2766 sem-NUL=2766 (ok)
```

25 vetores obrigatórios (F1×7, F2×5, F3×8, F4×3, F5×2) mais um controle
positivo. `npm test` na árvore íntegra: **814 casos aprovados em 87 suítes**.

## Não basta ficar vermelho — importa QUEM reprovou

A coluna `recusa por` é o ponto desta OS. O `pretest` chama
`exigirArtefatoUnico()` **antes** de qualquer heurística, então quando a
autoridade reprova o laudo começa com `ARTEFATO PRODUTIVO VIOLADO` e a unicidade
por capacidade nem chega a rodar. A campanha classifica a origem e reprova o
vetor se a recusa vier de quem não devia — vermelho pela razão errada é tão
inútil quanto verde indevido.

Os vetores que declaram `porQuem: "artefato"` foram todos recusados **pela
autoridade do artefato**, e nenhuma das mensagens cita `createServer`, `listen`,
handshake ou capacidade. `F4-1` (apagar `ci/artefato.js`) declara `qualquer` e
cai na amarração externa, como previsto.

## A prova funcional: a duplicata que o scanner não vê, e que funciona

Vetor `F1-1`, medido na mesma árvore, em três leituras.

**1. O scanner de capacidade da OS 52-C3 não vê nada.**

```
acusações da unicidade contra dup/colchetes.js: 0
sinais medidos: (NENHUM)
```

O arquivo é:

```js
'use strict';
const h = require('node:http');
const s = h['createServer'](function (q, r) { r.end('viva'); });
s['listen'](Number(process.env.PORT_DUP) || 9401);
```

**2. Ela é um servidor de verdade.**

```json
{ "arquivo": "dup/colchetes.js", "porta": 9401, "pid": 31852,
  "respondeu": true, "status": 200, "corpo": "viva",
  "encerrado": true, "portaLivreDepois": true }
```

**3. O portão reprova mesmo assim, e sem falar de capacidade.**

```
ARTEFATO PRODUTIVO VIOLADO — 1 reprovação(ões):
  CAMINHO NÃO CLASSIFICADO: dup/colchetes.js. Todo caminho versionado tem de ser
  produtivo declarado ou casar com uma exclusão declarada.
```

Uma duplicata que não funcionasse não provaria a propriedade — seria só um
arquivo esquisito que a guarda recusa. O que está provado é o contrário: ela é
um servidor completo, indetectável por reconhecimento sintático, e é recusada
por **não pertencer ao artefato**.

## O run externo que reprovou, e por quê

O run `32885163307`, em `d4c94f8`, terminou **failure**: passo 7 (provas) verde,
passo 8 (juiz) **vermelho**, passo 9 (artefato) **pulado**. O artefato de
evidência saiu com **543 bytes** — o da OS 52-C3 tinha 27.432 —, o que dizia que
o `npm test` morreu no `pretest` sem rodar suíte nenhuma.

A causa era um defeito da própria correção, e foi **reproduzida localmente antes
de ser corrigida**: o passo canônico de dependências do workflow roda
`npm install --no-audit --no-fund`, o npm escreve `package-lock.json` mesmo num
projeto sem dependência nenhuma, e a classificação — que lê a união do commit
com a árvore de trabalho — o tratava como caminho não classificado.

A correção é a regra `gerado`, a única que depende do estado:

| estado do caminho | decisão | por quê |
|---|---|---|
| fora do commit | excluído | subproduto de build: não é commitado, logo não é implantado |
| dentro do commit | a regra **não se aplica** | o npm o lê no deploy; faz parte do que sobe e tem de ser DECLARADO |

`ART-28` prova as duas metades num repositório forjado. Isenção que valesse nos
dois estados esconderia justamente o estado que importa.

## Higiene do arnês, e as três armadilhas pagas

* sem laço de fundo: tudo é `spawnSync`, não há PID de wrapper a matar;
* árvore suja é recusa, no início e entre vetores;
* âncora tem de aparecer uma vez só, e os bytes têm de mudar;
* timeout e sinal são `INCONCLUSIVO`, nunca detecção;
* mutação de JSON é feita no **objeto** — `scripts.test` tem aspas escapadas.

As três armadilhas que custaram rodada:

1. **`spawnSync("npm", …)` morreu com `exit 127`** num shell de fundo sem `npm`
   no PATH — a campanha escreveu o cabeçalho e parou, sem veredito;
2. **apontar para `npm.cmd` sem `shell: true`** devolve `status: null` no
   Windows, porque um `.cmd` não é executável para o `CreateProcess`. A saída
   sem nenhuma das duas é chamar `npm-cli.js` com o próprio Node;
3. **o controle final saiu vermelho** numa árvore limpa que passava logo depois,
   e a saída não estava guardada. Agora cada controle grava a saída em disco e
   um controle vermelho é **repetido uma vez**: duas leituras vermelhas são
   defeito; uma vermelha e uma verde são `INSTAVEL`, registrado como tal.

Uma nota de ambiente: esta máquina roda mais de uma sessão ao mesmo tempo, e o
prefixo genérico do log produziu dois `campanha-os52c4-*.txt` de campanhas
DIFERENTES no mesmo diretório temporário. O prefixo passou a carregar a família
(`campanha-os52c4-artefato-*`) — ler o log errado é mais fácil do que parece.

## A campanha, vetor a vetor

| vetor | veredito | classe | recusa por | sabotagem |
|---|---|---|---|---|
| `F1-1` | VERMELHO | OK | artefato | duplicata por COLCHETES |
| `F1-2` | VERMELHO | OK | artefato | duplicata por CONCATENACAO |
| `F1-3` | VERMELHO | OK | artefato | duplicata por VETOR de nomes |
| `F1-4` | VERMELHO | OK | artefato | duplicata por TEMPLATE |
| `F1-5` | VERMELHO | OK | artefato | duplicata por BASE64 |
| `F1-6` | VERMELHO | OK | artefato | ingresso/assento COMPUTADO |
| `F1-7` | VERMELHO | OK | artefato | controle em NOTACAO DE PONTO |
| `F2-1` | VERMELHO | OK | artefato | `new Function` com carga em base64 |
| `F2-2` | VERMELHO | OK | artefato | `createRequire` |
| `F2-3` | VERMELHO | OK | artefato | `Reflect.get` |
| `F2-4` | VERMELHO | OK | artefato | `net` com acesso computado |
| `F2-5` | VERMELHO | OK | artefato | par `.js` + `.txt` com carga base64 |
| `F3-1` | VERMELHO | OK | artefato | `node server.js & node duplicata.js` no start |
| `F3-2` | VERMELHO | OK | artefato | `npm run arrancar` indireto |
| `F3-3` | VERMELHO | OK | artefato | `node -e` num segundo script |
| `F3-4` | VERMELHO | OK | artefato | `node --eval` num segundo script |
| `F3-5` | VERMELHO | OK | artefato | alvo `.mjs` |
| `F3-6` | VERMELHO | OK | artefato | alvo SEM EXTENSAO |
| `F3-7` | VERMELHO | OK | artefato | SEGUNDO script invocando node contra o produtivo |
| `F3-8` | VERMELHO | OK | artefato | start alterado COM realinhamento simultaneo de CRED-34 e do manifesto |
| `F4-1` | VERMELHO | OK | outro | apagar `ci/artefato.js` |
| `F4-2` | VERMELHO | OK | artefato | remover a CHAMADA do pretest, mantendo `require` e o texto |
| `F4-3` | VERMELHO | OK | artefato | incluir uma duplicata em `produtivos` e realinhar o manifesto |
| `F5-1` | VERMELHO | OK | artefato | restaurar `buraco-servidor.zip` de origin/main |
| `F5-2` | VERMELHO | OK | artefato | criar `sub/package.json` |
| `OK-1` | VERDE | OK | outro | arquivo novo em caminho EXCLUIDO (docs/) continua verde |

**26 vetores, 26 conformes**, zero divergentes, zero inconclusivos, zero
âncoras inválidas. `node mutacoes_c4.js --listar` reproduz a lista;
`node mutacoes_c4.js` reproduz a medição inteira.
