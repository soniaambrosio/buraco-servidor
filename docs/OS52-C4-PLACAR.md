# OS 52-C4 — placar da campanha negativa

Medido em `d5a17d1cd4325f8d98ba7aa89ccca56ee3905bcd`, com `node mutacoes_c4.js`.
Cada vetor é injetado na árvore de trabalho, julgado pelo **portão oficial**
(`npm test`, que roda o `pretest` antes do glob), e a árvore é restaurada e
conferida antes do vetor seguinte.

## Placar

```
CONTROLE INICIAL (árvore íntegra): VERDE · npm exit 0
CONTROLE FINAL   (árvore íntegra): VERDE · npm exit 0
PLACAR: conforme=26 · divergente=0 · inconclusivo=0 · âncora-inválida=0 · total=26
árvore limpa ao final: true
INTEGRIDADE DO LOG: bruto=2767 sem-NUL=2767 (ok)
```

25 vetores obrigatórios (F1×7, F2×5, F3×8, F4×3, F5×2) mais um controle
positivo. `npm test` na árvore íntegra: **813 casos aprovados em 87 suítes**,
0 falhas, 0 cancelados, 0 pulados.

## Não basta ficar vermelho: importa quem reprovou

A coluna **recusa por** é o ponto da OS. O `pretest` chama a autoridade do
artefato **antes** de qualquer heurística, então quando ela reprova o laudo
começa com `ARTEFATO PRODUTIVO VIOLADO` e a unicidade por capacidade nem chega a
rodar. Vinte e quatro dos vinte e cinco vetores são recusados assim.

O único `outro` é `F4-1`, e está certo que seja: apagar `ci/artefato.js` tira do
ar a própria autoridade, e quem acusa passa a ser a amarração externa — o `require`
do `pretest` não resolve e o juiz reprova por `AUTORIDADE DO ARTEFATO AUSENTE`.
É exatamente o desenho: a guarda não sobrevive à própria remoção **em silêncio**.

## Prova funcional por rede

Uma duplicata da família F1 tem de funcionar, senão não prova nada — seria só um
arquivo esquisito que a guarda recusa. `dup/colchetes.js`:

```js
const h = require('node:http');
const s = h['createServer'](function (q, r) { r.end('viva'); });
s['listen'](Number(process.env.PORT_DUP) || 9401);
```

Três medições, na mesma árvore:

| # | medição | resultado |
|---|---|---|
| 1 | sinais medidos pelo scanner de capacidade da OS 52-C3 | **(nenhum)** — zero sinais, zero acusações |
| 2 | subir e responder | PID 31852, porta 9401, **HTTP 200**, corpo `viva` |
| 3 | encerramento e porta | processo encerrado pelo PID, porta livre depois |
| 4 | veredito do portão | **VERMELHO**, pela autoridade do artefato |

E a mensagem não fala de capacidade nenhuma:

```
ARTEFATO PRODUTIVO VIOLADO — 1 reprovação(ões):
  CAMINHO NÃO CLASSIFICADO: dup/colchetes.js. Todo caminho versionado tem de ser
  produtivo declarado ou casar com uma exclusão declarada. Arquivo que ninguém
  classificou é arquivo que sobe sem ninguém ter decidido que sobe.
```

Um servidor completo, invisível para o melhor scanner desta linhagem, recusado
sem que ninguém precisasse entendê-lo. É a tese da OS 52-A2 medida.

## As duas armadilhas de arnês que esta OS pagou

1. **`spawnSync("npm", …)` depende do PATH de quem chamou.** A primeira campanha
   completa morreu com `exit 127` logo depois de escrever o cabeçalho — arnês que
   morre sem veredito é pior que arnês que reprova.
2. **`npm.cmd` sem `shell: true` devolve `status: null` no Windows**, porque um
   `.cmd` não é executável para o `CreateProcess`.

A saída sem nenhuma das duas é chamar o `npm-cli.js` com o próprio Node: mesmo
interpretador, caminho absoluto, sem shell no meio, e continua sendo o alvo
oficial.

**E uma terceira, de leitura.** O log da campanha se chamava
`campanha-os52c4-<pid>.txt`, e outra sessão desta máquina — trabalhando noutra
OS 52-C4, noutra branch — escreveu um arquivo com o mesmo prefixo no mesmo
diretório temporário. O prefixo passou a carregar a família
(`campanha-os52c4-artefato-<pid>.txt`): ler o placar da árvore errada é mais
fácil do que parece.

## O controle instável, e por que ele não some no silêncio

A volta anterior terminou **26/26 conformes com o controle final vermelho**, numa
árvore limpa que passava logo em seguida (813/87, exit 0), sem processo
concorrente e sem a porta 8137 ocupada. Foi instabilidade de medição — e não
havia como provar isso, porque a saída dos controles não era guardada.

O arnês passou a persistir a saída de cada controle em disco e a repetir um
controle vermelho **uma vez**:

* duas leituras vermelhas seguidas — defeito, e o placar não vale;
* uma vermelha e uma verde — `INSTAVEL`, registrado como tal, com as duas saídas
  em disco para quem quiser conferir.

Nenhuma das duas vira veredito por conveniência.

## Higiene do arnês

* sem laço de fundo: tudo é `spawnSync`, síncrono — não há PID de wrapper a matar
  porque não há wrapper;
* árvore suja é recusa, no início e entre vetores;
* âncora tem de aparecer exatamente uma vez, e os bytes têm de mudar;
* timeout e sinal são `INCONCLUSIVO`, nunca detecção;
* log em arquivo novo por rodada, com o tamanho bruto comparado ao tamanho sem
  NUL;
* mutação de JSON é feita no **objeto** — `scripts.test` tem aspas escapadas, e
  trocá-lo por expressão regular grava um manifesto inválido.

## A campanha, vetor a vetor

| vetor | veredito | classe | sabotagem | recusa por |
|---|---|---|---|---|
| `F1-1` | VERMELHO | OK | duplicata por COLCHETES | artefato |
| `F1-2` | VERMELHO | OK | duplicata por CONCATENACAO | artefato |
| `F1-3` | VERMELHO | OK | duplicata por VETOR de nomes | artefato |
| `F1-4` | VERMELHO | OK | duplicata por TEMPLATE | artefato |
| `F1-5` | VERMELHO | OK | duplicata por BASE64 | artefato |
| `F1-6` | VERMELHO | OK | ingresso/assento COMPUTADO | artefato |
| `F1-7` | VERMELHO | OK | controle em NOTACAO DE PONTO | artefato |
| `F2-1` | VERMELHO | OK | `new Function` com carga em base64 | artefato |
| `F2-2` | VERMELHO | OK | `createRequire` | artefato |
| `F2-3` | VERMELHO | OK | `Reflect.get` | artefato |
| `F2-4` | VERMELHO | OK | `net` com acesso computado | artefato |
| `F2-5` | VERMELHO | OK | par `.js` + `.txt` com carga base64 | artefato |
| `F3-1` | VERMELHO | OK | `node server.js & node duplicata.js` no start | artefato |
| `F3-2` | VERMELHO | OK | `npm run arrancar` indireto | artefato |
| `F3-3` | VERMELHO | OK | `node -e` num segundo script | artefato |
| `F3-4` | VERMELHO | OK | `node --eval` num segundo script | artefato |
| `F3-5` | VERMELHO | OK | alvo `.mjs` | artefato |
| `F3-6` | VERMELHO | OK | alvo SEM EXTENSAO | artefato |
| `F3-7` | VERMELHO | OK | SEGUNDO script invocando node contra o produtivo | artefato |
| `F3-8` | VERMELHO | OK | start alterado COM realinhamento simultaneo de CRED-34 e do manifesto | artefato |
| `F4-1` | VERMELHO | OK | apagar `ci/artefato.js` | outro |
| `F4-2` | VERMELHO | OK | remover a CHAMADA do pretest, mantendo `require` e o texto | artefato |
| `F4-3` | VERMELHO | OK | incluir uma duplicata em `produtivos` e realinhar o manifesto | artefato |
| `F5-1` | VERMELHO | OK | restaurar `buraco-servidor.zip` de origin/main | artefato |
| `F5-2` | VERMELHO | OK | criar `sub/package.json` | artefato |
| `OK-1` | VERDE | OK | arquivo novo em caminho EXCLUIDO (docs/) continua verde | outro |

**26 vetores, 26 conformes.** `node mutacoes_c4.js --listar` reproduz a lista;
`node mutacoes_c4.js` reproduz a medição inteira.
