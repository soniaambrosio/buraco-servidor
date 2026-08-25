# OS 52-C3 — placar da campanha negativa

Medido em `40bb81975643257be730c516409601ff27320e37`, com `node mutacoes_c3.js`.
Cada vetor é injetado na árvore de trabalho, julgado pelo **portão oficial**
(`npm test`; e `ci/portao_do_ci.js` sobre a evidência real nos vetores marcados
com juiz), e a árvore é restaurada e conferida antes do vetor seguinte.

## Placar

```
CONTROLE INICIAL (árvore íntegra): VERDE · npm exit 0 · juiz exit 0
CONTROLE FINAL   (árvore íntegra): VERDE · npm exit 0 · juiz exit 0
PLACAR: conforme=68 · divergente=0 · inconclusivo=0 · âncora-inválida=0 · total=68
árvore limpa ao final: true
INTEGRIDADE DO LOG: bruto=5895 sem-NUL=5895 (ok)
```

`npm test` na árvore íntegra: **786 casos aprovados em 83 suítes**, 0 falhas,
0 cancelados. Juiz oficial: **PORTÃO VERDE** (piso 786/83).

## Prova funcional de E1

A duplicata fragmentada não é literária: ela **sobe e responde**. Antes e depois
da correção, `dup/nucleo.js` cria o servidor e `dup/arranque.js` chama
`.listen()`; `node dup/arranque.js` respondeu **HTTP 200** com o corpo
`duplicata fragmentada viva` na porta isolada 8394, e o processo foi encerrado
pelo PID (42560), com a porta conferida livre depois.

O que mudou foi o veredito do portão. Na base `4577048` o `npm test` terminava
**verde** com ela na árvore. Depois da correção:

```
SEGUNDO SERVIDOR NA ÁRVORE — só `server.js` pode sê-lo:
  `dup/arranque.js` escuta numa porta concreta
  `dup/arranque.js` cria um servidor de rede e escuta numa porta
      — em COMPOSIÇÃO no escopo `conjunto`, com: dup/nucleo.js
  `dup/nucleo.js` cria um servidor de rede e escuta numa porta
      — em COMPOSIÇÃO no escopo `conjunto`, com: dup/arranque.js
```

## Antes e depois, nos seis vetores obrigatórios da R2

| vetor | base `4577048` | OS 52-C3 |
|---|---|---|
| E1 servidor fragmentado (criação / `.listen()` em arquivos diferentes) | VERDE (escape) | VERMELHO |
| E2 segundo arranque do bundle por `__require`, em arquivo textual | VERDE (escape) | VERMELHO |
| E3 `new WebSocketServer({port})` sem `.listen()` | VERDE (escape) | VERMELHO |
| E4 ingresso/assento por `Map` | VERDE (escape) | VERMELHO |
| E5 servidor UDP por `dgram.createSocket().bind()` | VERDE (escape) | VERMELHO |
| E6 encolhimento coordenado com pisos realinhados | VERDE (escape, juiz verde) | VERMELHO (npm e juiz) |

A reprodução na base foi feita nesta sessão, com o portão oficial, e não
reaproveita log da R2.

## O que a primeira volta encontrou, e como foi fechado

A primeira volta deu **62/65**. Os três divergentes:

| vetor | o que era | desfecho |
|---|---|---|
| `PIS-D` rebaixar `CASOS_MEDIDOS_NA_BASE` de 786 para 700 | **escape real**: `786 >= 700` continua verdadeiro, então o piso do piso afrouxava sem mudar limiar nenhum *hoje* — e é por isso que passaria despercebido amanhã | fechado: o piso do piso entrou na monotonicidade ancorada no commit anterior |
| `ISC-A` isca de 60 casos triviais no lugar da suíte de unicidade | **escape local**: 60 ≥ 48 satisfaz o piso por arquivo e o `npm test` fica verde; o juiz reprovava (743 < 786 casos, 74 < 83 suítes), mas só depois | fechado **também localmente**: cada obrigatória tem de continuar CARREGANDO o módulo que exercita, lido pelos especificadores de `require` do texto bruto |
| `PRV-A` neutralizar a afirmação "todo ramo disparou" | **mutante equivalente**: numa árvore íntegra todos os ramos disparam, então a defesa removida não deixa de detectar nada. Sobreviver aqui não é escapar | mantido no catálogo com `esperado: VERDE` e nota explícita, e acompanhado de `PRV-A2`, `PRV-B` e `PRV-C`, que acoplam a neutralização a um ramo MORTO de verdade |

Fechar `ISC-A` derrubou `GLOB-02`, e pelo motivo certo: as suítes forjadas
daquele caso eram arquivos com um comentário dentro, que a guarda nova reprova.
A fixture passou a escrever uma suíte mínima **porém ligada** ao que exercita —
fixture que a guarda legítima reprovaria faz o caso reprovar por um motivo que
não é o dele.

Uma âncora saiu inválida numa volta intermediária (`E6`, depois de
`ALCANCE_OBRIGATORIO` mudar de forma). O arnês **parou o vetor** em vez de
contá-lo como detecção, e recusou rodar com a árvore suja. As duas travas
fizeram o que existem para fazer.

## Higiene do arnês

* nenhum laço de fundo: cada execução é `spawnSync`, síncrona — não há PID de
  wrapper a matar porque não há wrapper;
* árvore suja é recusa, no início e entre vetores;
* âncora tem de aparecer exatamente uma vez, e os bytes têm de mudar;
* timeout e sinal são `INCONCLUSIVO`, nunca detecção;
* controle de integridade no começo e no fim, e o placar é inválido se qualquer
  das duas pontas não for verde;
* log em arquivo novo por rodada, com o tamanho bruto comparado ao tamanho sem
  NUL;
* mutação de JSON é feita no **objeto** — `scripts.test` tem aspas escapadas, e
  trocá-lo por expressão regular grava um manifesto inválido.

## A campanha, vetor a vetor

| vetor | veredito | classe | sabotagem |
|---|---|---|---|
| `E1` | VERMELHO | OK | servidor fragmentado: criacao num arquivo e `.listen()` noutro |
| `E2` | VERMELHO | OK | segundo arranque real do bundle em arquivo textual (`__require`) |
| `E3` | VERMELHO | OK | `new WebSocketServer({port})` sem `.listen()` |
| `E4` | VERMELHO | OK | ingresso/assento implementado por `Map` |
| `E5` | VERMELHO | OK | servidor UDP com `dgram.createSocket().bind()` |
| `E6` | VERMELHO | OK | encolhimento coordenado: suite removida, censo, alcance, limiar e piso realinhados |
| `FRG-A` | VERMELHO | OK | fragmentacao em dois arquivos no MESMO diretorio |
| `FRG-B` | VERMELHO | OK | fragmentacao em diretorios DISTINTOS |
| `FRG-C` | VERMELHO | OK | fragmentacao em TRES arquivos |
| `FRG-D` | VERMELHO | OK | criacao exportada por `module.exports` |
| `FRG-E` | VERMELHO | OK | criacao importada por destructuring, sem ligacao declarada |
| `ALI-A` | VERMELHO | OK | alias de `.listen`, chamado por `call` |
| `ALI-B` | VERMELHO | OK | alias de `.bind` sobre soquete de datagrama |
| `POR-A` | VERMELHO | OK | `WebSocketServer({port})` por fabrica, sem `new` |
| `POR-B` | VERMELHO | OK | `app.listen(3311)` |
| `UDP-A` | VERMELHO | OK | servidor UDP por `dgram` |
| `ARR-A` | VERMELHO | OK | arranque por `__require` |
| `ARR-B` | VERMELHO | OK | arranque por `require` |
| `ARR-C` | VERMELHO | OK | arranque dividido por auxiliar |
| `UPG-A` | VERMELHO | OK | upgrade EXECUTAVEL com cabecalho de handshake |
| `UPG-B` | VERDE | OK | upgrade somente em STRING, sem execucao |
| `HSK-A` | VERDE | OK | handshake somente em PROSA |
| `ASS-A` | VERMELHO | OK | assento por `Map` |
| `ASS-B` | VERMELHO | OK | assento por objeto devolvido, com recusa tipada |
| `ASS-C` | VERMELHO | OK | assento por funcao auxiliar |
| `DES-A` | VERMELHO | OK | despachante com `case 'entrarMesa'` que senta o jogador |
| `CEN-A` | VERMELHO | OK | cenario que cobre ramo exclusivo apontado para id inexistente |
| `RAM-A` | VERMELHO | OK | neutralizacao individual do ramo DATAGRAMA |
| `RAM-B` | VERMELHO | OK | neutralizacao individual do ramo REDE |
| `RAM-C` | VERMELHO | OK | neutralizacao individual do ramo ARRANQUE |
| `CMP-A` | VERMELHO | OK | a decisao COMPOSTA desligada (retorno constante vazio) |
| `OCA-A` | VERMELHO | OK | retorno constante de capacidades vazias |
| `VET-A` | VERMELHO | OK | analisador que REPROVA tudo |
| `CAT-A` | VERMELHO | OK | catalogo esvaziado |
| `PRV-A` | VERDE | OK | afirmacao 'todo ramo disparou' neutralizada, SEM ramo morto [mutante equivalente: defesa removida sem violacao na arvore] |
| `PRV-A2` | VERMELHO | OK | afirmacao 'todo ramo disparou' neutralizada + ramo DATAGRAMA morto |
| `PRV-B` | VERMELHO | OK | laco do cenario exclusivo neutralizado + ramo DATAGRAMA morto |
| `PRV-C` | VERMELHO | OK | as DUAS afirmacoes de cobertura neutralizadas + ramo DATAGRAMA morto |
| `REC-A` | VERMELHO | OK | varredura deixa de ser recursiva |
| `PRF-A` | VERMELHO | OK | arquivo alem de uma profundidade (seis niveis) |
| `PAC-A` | VERMELHO | OK | pacote RENOMEADO (ZIP com nome `.md`) |
| `PAC-B` | VERMELHO | OK | pacote SEM EXTENSAO (TAR pelo byte 257) |
| `PAC-C` | VERMELHO | OK | compactado TRUNCADO (XZ cortado) |
| `GLB-A` | VERMELHO | OK | desvio do glob para suite-isca |
| `PRE-A` | VERMELHO | OK | remocao do `pretest` |
| `PIS-A` | VERMELHO | OK | rebaixamento do piso de CASOS |
| `PIS-B` | VERMELHO | OK | rebaixamento do piso de SUITES |
| `PIS-C` | VERMELHO | OK | rebaixamento de um piso POR SUITE |
| `PIS-D` | VERMELHO | OK | rebaixamento do piso do piso (CI-13) na suite do CI |
| `PIS-E` | VERMELHO | OK | entrada do censo APAGADA para uma suite obrigatoria |
| `REC-B` | VERMELHO | OK | recarimbo coordenado de TODOS os numeros editaveis, de uma vez |
| `AUT-A` | VERMELHO | OK | a AUTORIDADE do piso ancorado e apagada do disco |
| `AUT-B` | VERMELHO | OK | a CHAMADA do piso ancorado e removida do censo |
| `AUT-C` | VERMELHO | OK | a comparacao com o commit anterior vira corpo trivial |
| `ISC-A` | VERMELHO | OK | isca com titulos e corpos triviais no lugar da suite de unicidade |
| `PRO-A` | VERDE | OK | prosa contendo TODOS os tokens sensiveis |
| `LEG-A` | VERDE | OK | arquivo legitimo de tipo desconhecido |
| `PNG-A` | VERDE | OK | binario legitimo que NAO e pacote (PNG) |
| `MEI-A` | VERDE | OK | peca de criacao SOZINHA, sem escuta em lugar nenhum |
| `M06b` | VERMELHO | OK | [R1] segundo servidor com nomes inteiramente novos (http) |
| `M06c` | VERMELHO | OK | [R1] servidor em `net.createServer`, em subpasta |
| `M06d` | VERMELHO | OK | [R1] servidor em `https.createServer` |
| `M08b` | VERMELHO | OK | [R1] ZIP sem extensao, com `server.js` dentro |
| `M08c` | VERMELHO | OK | [R1] XZ com nome `.txt` |
| `M13b` | VERMELHO | OK | [R1] glob estreitado para uma suite so |
| `M16` | VERMELHO | OK | [R1] duplicata dois niveis abaixo |
| `M17b` | VERMELHO | OK | [R1] regra oca (a analise nunca acusa) |
| `M17c` | VERMELHO | OK | [R1] a CHAMADA da prova removida do censo, corpo intacto |

**68 vetores, 68 conformes.** `node mutacoes_c3.js --listar` reproduz a lista;
`node mutacoes_c3.js` reproduz a medição inteira.
