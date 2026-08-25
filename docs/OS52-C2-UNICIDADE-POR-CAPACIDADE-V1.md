# OS 52-C2 — Proteção por capacidade da autoridade única do servidor

Base: `correcao/os54-c1-auditabilidade-ci-v1` @ `750a012e65b6fd9a62e6f6871d45e3f12bd8a03e`.

## Por que a guarda da C1 precisou ser substituída

A OS 52-C1 protegia por **nome, trecho canônico e extensão**, e as três premissas
eram frágeis pelo mesmo motivo: descreviam **o servidor que existe**, não a
capacidade de ser um servidor.

| A guarda antiga | O que ela deixava passar |
|---|---|
| varria **só a raiz** com as assinaturas fortes | duplicata numa subpasta |
| procurava **uma linha** (o arranque deste bundle) no resto da árvore | servidor escrito do zero, com outros nomes |
| proibia pacote pela **extensão** | ZIP renomeado para `entrega`, `.bin`, sem extensão |

A limitação à raiz não era descuido: no texto **cru**, sete arquivos de `test/`
e um de `docs/` casavam com as assinaturas largas — todos legítimos, todos
citando o bundle dentro de string, expressão regular ou comentário. Varrer a
árvore inteira com aquelas assinaturas teria reprovado o repositório íntegro.

## O que destravou a varredura recursiva

Um **scanner léxico** no lugar do recorte por expressão regular.

A OS 52-C1 já tinha pago para descobrir que `/\/\*[\s\S]*?\*\//g` não sabe o que
é string — ele casou com a abertura de comentário dentro do literal
`"test/*.test.js"` e engoliu meio arquivo. O scanner novo percorre o texto
caractere a caractere sabendo quando está numa string, num template (com
interpolação, que **é** código e por isso é analisada), num literal de expressão
regular ou num comentário. O conteúdo de literal vira `""`, comentário vira
espaço, e o que sobra é **programa**.

Com isso os oito falsos positivos **desaparecem** — eram todos texto dentro de
literal. É por isso que a varredura pôde ficar recursiva sem ganhar uma única
exceção. Os dois únicos diretórios fora dela são `.git` (banco de objetos: guarda
cópias comprimidas de tudo que já existiu, inclusive das quatro duplicatas
removidas pela C1) e `node_modules` (dependência de terceiro; aqui nem existe).

## Detecção por capacidade

Sinal isolado não é veredito. Cada capacidade exige **combinação**:

| Capacidade | Combinação |
|---|---|
| servidor de rede autônomo | `create(Secure)?Server` ou `new …Server` **e** `.listen(` |
| transporte WebSocket | GUID do RFC 6455 **e** (criação, escuta ou upgrade) |
| handshake respondido | cabeçalho `Sec-WebSocket-*` **e** upgrade **e** (escuta ou criação) |
| portador do contrato | declara ou despacha `entrarMesa` **e** concede assento |
| arranque deste bundle | a chamada que sobe o transporte |
| segundo alvo de deploy | `package.json` fora da raiz, ou `start` desviado |

É a combinação que separa **capacidade** de **menção**: um documento que explica
o handshake, um teste que simula transporte sem abrir porta e um comentário que
cita `entrarMesa` têm sinal e não têm capacidade — e a guarda não pode reprová-los,
sob pena de virar incômodo e ser removida.

## Compactados pelos bytes, não pelo nome

Oito formatos por *magic bytes*: ZIP, GZIP, XZ, BZIP2, 7z, RAR, ZSTD e **TAR**,
cuja marca `ustar` mora no **byte 257** — é por isso que TAR passa despercebido
por qualquer verificação que só olhe o começo do arquivo.

Quando o formato permite, o **inventário** é lido dos cabeçalhos (diretório
central do ZIP, cabeçalhos de 512 do TAR) para **nomear** o portador implantável
que o pacote carrega. Nada é descomprimido, e há teto explícito de bytes lidos,
de entradas de inventário e de profundidade — inspeção sem limite vira vetor de
expansão abusiva.

## Isenção é resultado de análise, nunca caminho numa lista

Não existe lista de isentos. `app.html` fica porque a análise **não encontra**
nele criação de servidor, escuta, handshake, despachante nem concessão de
assento — ele fala `entrarMesa` como **string**, que é o que um cliente faz.
UNI-A3 afirma essa ausência item por item, e ainda exige que ele **continue**
falando `entrarMesa`: um `app.html` que deixasse de ser cliente teria virado
outra coisa, e a isenção estaria protegendo um arquivo que ninguém examinou.

`server.js` é o portador declarado — e **também é conferido**. Se a análise
parar de reconhecer capacidade de servidor nele, ela está cega, e cega ela
aprovaria qualquer duplicata. Esse é o cenário POR-01 do catálogo.

## Reciprocidade sem ponto único

O anel tem quatro peças, todas fora do glob exceto a suíte:

```
as suítes obrigatórias  ->  conferirCenso
conferirCenso           ->  conferirProvaDaUnicidade + conferirGlobOficial
conferirProvaDaUnicidade->  executa 31 fixtures contra conferirUnicidadeDoPortador
unicidade_do_portador.test.js -> exercita o catálogo cenário a cenário
                              (e está em OBRIGATORIAS, com piso)
```

**Não há digest, e a ausência é deliberada.** Digest protege contra edição
acidental e cai na primeira edição intencional: quem muda a regra realinha o
número na mesma alteração, e o portão nunca vê. O que não se realinha é
**comportamento contra fixture**: para fazer os 24 cenários negativos passarem
seria preciso escrever uma regra que de fato os detecta.

## Três defeitos que a própria correção encontrou

**1. A guarda casava consigo mesma, duas vezes.** O GUID do RFC 6455 estava
literal no módulo, e a propriedade chamada `upgrade` casava com o padrão
`\bupgrade\b` que ela mesma define. A árvore íntegra reprovava. O GUID passou a
ser montado por junção de pedaços e a propriedade foi renomeada; UNI-A5 afirma
que nenhum dos quatro arquivos da família acusa a si mesmo.

**2. Cache que atravessa mudança de estado é indistinguível de guarda
desligada.** A prova era memorizada por processo — resultado inteiro. Plantar um
servidor novo e chamar o censo de novo devolvia o veredito **antigo**: o caso
CENSO-UNI ficou vermelho acusando a guarda de estar cega, quando era o cache
respondendo. Hoje só a parte cara (o catálogo, que não depende da árvore do
repositório) é memorizada; a varredura da árvore real roda sempre.

**3. Afirmação única é ponto único.** A conformidade do catálogo era afirmada
uma vez, por uma lista de divergentes. Trocar essa lista por `[]` cegava a prova
inteira com nome, comentário e estrutura preservados — a mutação R-07 passou. Hoje
a conformidade é afirmada de **três formas independentes**, e R-07/R-07b provam
que apagar uma e depois duas ainda esbarra nas restantes. As duas mutações só
fazem sentido acopladas a uma regra oca: sem violação na árvore, afirmação
apagada não deixa de detectar coisa nenhuma.

## Glob oficial (§6)

O censo já cobrava a **forma** do comando. O que faltava era o **alcance**:
`conferirGlobOficial` expande os alvos de `scripts.test` de verdade e exige que
o conjunto resultante contenha toda suíte que está no disco, mais as cinco que
precisam rodar por obrigação — as três que chamam o censo, a da unicidade e a do
CI. Alvo nomeado (arquivo único) é rejeitado por construção: alvo nomeado é suíte
escolhida a dedo, não portão.

## Nomenclatura da R1

O laudo da OS 52-R1 não estava disponível nesta sessão, então a correspondência
entre os rótulos `M06b/c/d`, `M08b/c`, `M16`, `M17b/c` e `M13b` e os vetores
desta campanha foi **inferida da descrição dos requisitos** desta OS, e está
declarada vetor a vetor na tabela da campanha. Os vetores cobrem o que os
requisitos descrevem; o mapeamento dos rótulos é a parte inferida.

## O que esta OS preservou

`server.js`, `app.html`, os contratos, o protocolo 2, as regras de ingresso e
assento, a Comunicação Controlada, o workflow do CI, o juiz (`ci/portao_do_ci.js`),
o artefato, o resumo e as permissões somente-leitura saem daqui **byte a byte**
como entraram. Nenhum segredo foi introduzido e nada implanta.

Os pisos subiram para o total **real** medido nesta árvore, sem margem criada
pela própria correção — margem seria espaço para perder caso sem reprovar.

## O escape que a campanha encontrou, e como ele foi fechado

O vetor **V16 — glob reduzido a uma suíte-isca — escapou**: `pass=1 fail=0`,
portão verde. A causa é estrutural e a OS 44 já a tinha nomeado: **uma suíte não
consegue se obrigar a rodar**. A guarda de unicidade e a do glob moram dentro de
`conferirCenso`, o censo é chamado pelas suítes obrigatórias, e um comando que
não alcança nenhuma delas não chama guarda nenhuma.

O fecho tem duas metades, e cada uma sozinha tem ponto cego:

* **local** — `test/guarda_do_portao.js`, instalado como `pretest`. É a primeira
  etapa do **mesmo** `npm test`, não um segundo comando: `scripts.test` continua
  byte a byte o que era, que é o que o CI ecoa e o que `ci/portao_do_ci.js`
  compara. Reprovando, o `npm test` morre antes de chegar ao glob;
* **externo** — `ci/portao_do_ci.js`, que já reprovava esse cenário por três
  motivos independentes (alvo não comprovado, alvo desviado, execução sem
  marcador válido), com saída 1 medida contra a evidência da suíte-isca.

Sobra **um** vetor que o portão local não fecha: apagar o `pretest` **e**
estreitar o glob na mesma alteração. Ele está na campanha como `V16f`, medido e
classificado como escape local que fecha no CI — declarado em vez de omitido.

## Campanha

Contra o portão real, com árvore conferida antes e depois de cada vetor.

| Grupo | Vetores | Resultado |
|---|---|---|
| §2 capacidade (M06b/c/d): nomes novos, `net`, `https`, WS manual, porta fixa, `package.json` secundário, `start` desviado | V01–V07 | 7/7 detectadas |
| §3 compactados (M08b/c): ZIP sem extensão, XZ chamado `.txt`, TAR pelo byte 257 | V08–V10 | 3/3 detectadas |
| §1 recursão (M16): duplicata dois níveis abaixo | V11 | detectada |
| §4 isenção positiva: comentário com as palavras proibidas, teste que simula transporte, `app.html` íntegro | V12–V14 | 3/3 corretas, sem falso positivo |
| §5 reciprocidade (M17b/c): regra oca; chamada removida; as duas + suíte esvaziada | V15b, V15c, V15 | 3/3 detectadas |
| censo e CI: censo apagado, censo neutralizado, workflow removido, piso rebaixado, suíte obrigatória removida, catálogo encolhido | V17–V22 | 6/6 detectadas |
| §6 glob (M13b): suíte-isca, arquivo único, glob estreitado, glob que perde só a unicidade, `pretest` removido, guarda apagada | V16, V16b–V16d, V16g, V16h | 6/6 detectadas |
| §6 glob: comando íntegro segue verde | V16e | correta |
| §6 glob: `pretest` removido **e** glob estreitado, juntos | V16f | escape local, fecha no CI |

Além da campanha, a suíte roda o catálogo de 31 cenários caso a caso e as nove
mutações de reciprocidade (R-01 a R-09) em cópias do trio de módulos.

**Duas correções de arnês**, registradas porque campanha com arnês quebrado sai
com número errado:

1. Os três vetores do §6 saíram INCONCLUSIVOS na primeira rodada. A causa era o
   arnês: `scripts.test` é `node --test \"test/*.test.js\"` — com aspas escapadas
   dentro do JSON —, e mutá-lo por expressão regular sobre o texto parava na
   primeira aspa escapada e gravava um manifesto inválido. `npm` morria antes de
   rodar, e sem rodapé não há veredito. **Mutação de JSON tem de ser feita no
   objeto.**
2. `npm test` saindo diferente de zero **sem rodapé** é reprovação, não ausência
   de veredito: é o que acontece quando o `pretest` barra a execução. O
   classificador passou a ler o código de saída antes de exigir sumário.

## Medição final

* Portão: **734 casos / 80 suítes / zero falhas**. Eram 686/75 na base — 48 casos
  acrescentados, nenhum perdido.
* Catálogo: **31/31 conforme** (24 negativos, 7 positivos).
* Pisos subidos ao total real: `casos_minimos` 682 → **734**, `suites_minimas`
  75 → **80**, e o piso do piso em `test/ci_obrigatorio.test.js` junto.
