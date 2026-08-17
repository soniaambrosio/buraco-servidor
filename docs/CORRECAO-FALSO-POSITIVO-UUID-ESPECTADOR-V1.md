# Correção do falso positivo de UUID na auditoria do espectador — V1

**Repositório:** `soniaambrosio/buraco-servidor`
**Base:** `claude/credencial-renovavel-motor-railway-v1` @ `85d0eee5286fd1deba5c2ae85176b76e714e6690`
**Branch:** `correcao/teste-espectador-uuid-falso-positivo-v1`
**Escopo tocado:** `test/ajuda.js`, `test/uuid_falso_positivo.test.js` (novo), este documento.
**Produção:** intocada. `server.js`, `package.json` e scripts de inicialização não mudaram.

---

## 1. O defeito

A prova de não-vazamento do espectador varre cada payload atrás dos ids das cartas
secretas (as quatro mãos, o monte e os mortos). A varredura vivia em
`test/ajuda.js`, em `varrerSegredos`, e o ramo de texto era:

```js
if (segredos.has(no)) achados.push(caminho + " = " + no);
// substring: pega o segredo embutido em texto (mensagem de erro, dica...)
for (const s of segredos) {
  if (no !== s && no.includes(s)) achados.push(caminho + " contém " + s);
}
```

`no.includes(s)` é substring cega. E os dois lados dessa comparação têm alfabetos
que se sobrepõem:

| | forma | alfabeto |
|---|---|---|
| id de carta | `c` + dígitos (`novoId`, `server.js:125`) | `c` e `0-9` |
| `eventoId` | `crypto.randomUUID()` (`carimbarEstado`, `server.js:3952`) | `0-9a-f` e `-` |

Todo dígito decimal é dígito hexadecimal, e `c` é hexadecimal. Logo **todo id de
carta é uma sequência que um UUID pode conter por sorteio**. Quando isso acontecia,
o arnês acusava vazamento onde não houve vazamento nenhum: a prova ora reprovava,
ora não, sem que uma linha do servidor tivesse mudado.

### Onde o carimbo entra na varredura

Não era um caso hipotético. Três pontos passam `eventoId` para `varrerSegredos`
com ids de carta crus (sem o carimbo `SEGREDO-` de `marcarSegredos`), e os três
foram vistos reprovando por coincidência durante esta correção:

- `test/espectador.test.js:514` — **§8**, o espectador vigiado ao longo da partida
  inteira, onde cada `estado` carrega o carimbo.
  Visto: `raiz.eventoId contém c1785`, `raiz.eventoId contém c1788`.
- `test/costura.test.js:179` — a prova de que **o parceiro não recebe a mão do
  parceiro**. Visto: `a mão do assento 2 vazou para o assento 0`, por
  `raiz[4].eventoId contém c379`.
- `test/versao.test.js:455` — **VER-19**, que varre exatamente
  `{versaoEstado, eventoId}`.

O segundo é o mais grave dos três: a coincidência estava corrompendo justamente a
prova de vazamento entre parceiros — o caso 11 da OS. Uma prova que acusa sozinha
não protege ninguém; ela ensina a equipe a reexecutar até ficar verde, e nesse dia
o vazamento de verdade passa junto.

### A medida do defeito

Medido nesta base, com `node v24.14.0`:

| ids-alvo vivos | UUIDs que reprovam |
|---|---|
| `c1818` sozinho | 0,0010 % |
| `c181` sozinho | 0,0290 % |
| `c18` sozinho | 0,5075 % |
| `c1` sozinho | 9,3970 % |
| baralho vivo `c1..c108` | **60,34 %** |
| baralho vivo `c1000..c1107` | 0,120 % |
| baralho vivo `c10000..c10107` | 0,002 % |

A taxa depende de quantos dígitos o contador global `_contadorId` já acumulou
quando a partida do teste é criada — por isso a intermitência não é uniforme e
por isso ela muda de lugar quando alguém acrescenta ou remove um teste acima.
No cenário do VER-19 (108 segredos vivos, 14 carimbos inspecionados por execução),
o risco por execução chega a ~100 % quando o contador está baixo.

O `c1818` que a OS nomeia é o regime intermediário: cinco caracteres, contador na
casa dos milhares — raro o bastante para parecer sorte, frequente o bastante para
derrubar CI.

---

## 2. A correção

A correção **não** ignora `eventoId`, **não** troca UUID por valor fixo, **não**
tira id de carta da auditoria e **não** reduz o conjunto de payloads inspecionados.
Ela separa os três fatos que a substring confundia num só:

| fato | como é comparado |
|---|---|
| id presente como **DADO** — `visao.x = "c1818"`, item de lista, chave de objeto, `carta.id` | **valor inteiro**, exato, sem heurística |
| id citado em **TEXTO** — `"carta c1818 recusada"` | **token completo**, não pedaço de palavra |
| sequência dentro de **identidade opaca** — `...4466c1818000` | não é nem um nem outro: não conta |

Um UUID é atômico: os 36 caracteres valem juntos, e um recorte no meio deles não
referencia coisa nenhuma. Então a **forma canônica** de UUID é reconhecida como
valor — onde quer que ela apareça no payload, e não num campo escolhido a dedo — e
sai antes da tokenização.

O que ela **não** ganha é passe livre. A comparação estrutural continua valendo
sobre ela: se um `eventoId` fosse exatamente um id secreto, ou se um id secreto
ficasse colado do lado de fora do UUID, a varredura continua acusando. É o caso 2
e o caso 6b da suíte focal.

Três regras novas, todas em `test/ajuda.js`:

1. **`FORMA_UUID`** — a forma canônica `8-4-4-4-12` hexadecimal, com guardas para
   não fatiar uma corrida hexadecimal maior.
2. **`tokensDe(texto)`** — troca cada identidade opaca por **espaço** (separador,
   nunca vazio: assim tirá-la não cola dois vizinhos num token que não existia) e
   devolve as corridas de identificador. Uma corrida com hífen entrega também as
   suas partes, para que `SEGREDO-MAO0-1` case inteiro e `mao0-c1818` ainda
   entregue `c1818`.
3. **Objeto de carta** — objeto cujo `.id` é secreto passa a ser relatado como
   carta inteira, e não só como id solto. A recursão já pegava o `.id`; o achado
   novo é para o relatório dizer que forma o vazamento teve.

### Por que a substring não foi só "afrouxada"

Trocar substring por token não é lista permissiva: não há nome de campo, nem tipo
de mensagem, nem id conhecido dispensado da varredura. O critério é estrutural e
vale para qualquer payload, inclusive os que ainda não existem.

E o ganho é determinístico, não estatístico: um id de carta tem no máximo ~6
caracteres e um UUID tem 36 — nenhum id de carta pode **ser** um UUID, então a
coincidência deixa de existir por construção, não por ficar mais rara. Uma
tokenização que dividisse o UUID nos seus cinco grupos deixaria um resíduo (um id
de 4 caracteres pode ser igual ao 2º grupo, ~1 em 65 536); tratar o UUID como
átomo fecha esse resíduo em zero.

### O que foi abandonado de propósito

Uma coisa a varredura deixou de fazer: acusar um id de carta contido **no meio de
uma corrida hexadecimal opaca** — um UUID, e por extensão qualquer identidade da
mesma forma. Isso não é perda de detecção; é exatamente o defeito. Uma corrida
hexadecimal contém ids de carta por sorteio, com a frequência medida na tabela
acima, e um achado desses nunca distinguiu vazamento de coincidência.

O que continua sendo pego, e está provado caso a caso: id como valor inteiro, id
como item de lista, id como chave de objeto, id dentro de objeto de carta, id em
campo aninhado a qualquer profundidade, e id citado como token em texto livre —
inclusive colado do lado de fora de um UUID, e inclusive como parte de um composto
com hífen (`mao0-c1818`).

---

## 3. Casos obrigatórios

Todos em `test/uuid_falso_positivo.test.js`, 15 testes.

| # | caso | teste | base | candidata |
|---|---|---|---|---|
| 1 | `eventoId` contendo `c1818` internamente **não** reprova | CASO 1 | ✖ | ✔ |
| 2 | valor exatamente `c1818` reprova (no próprio `eventoId`) | CASO 2 | ✔ | ✔ |
| 3 | lista contendo `c1818` reprova | CASO 3 | ✔ | ✔ |
| 4 | objeto de carta oculto reprova | CASO 4 | ✖ | ✔ |
| 5 | campo aninhado com id exato reprova | CASO 5 | ✔ | ✔ |
| 6 | texto com o id como token independente reprova | CASO 6 | ✔ | ✔ |
| 7 | UUID comum permanece aceito | CASO 7 | ✖ | ✔ |
| 8 | vários ids-alvo continuam detectados | CASO 8 | ✖ | ✔ |
| 9 | o caminho do jogador recebe o que lhe pertence | CASO 9 | ✔ | ✔ |
| 10 | o espectador continua sem receber carta oculta | CASO 10 | ✔ | ✔ |
| 11 | o parceiro continua sem receber carta que não pode conhecer | CASO 11 | ✔ | ✔ |
| 12 | a correção não depende do acaso | CASO 12 | ✖ | ✔ |

Contra a base: **8 passam, 7 reprovam**. Os que reprovam são o falso positivo
(1, 7, 7b, 12) e as capacidades novas (4, 8, tokenização). Os oito que passam na
base são justamente os de detecção real — é a prova de que a correção não comprou
o verde afrouxando a auditoria.

O caso 12 é **exaustivo, não amostral**: um id de 5 caracteres cabe em 12 posições
de um UUID v4 sintaticamente válido (4 no 1º grupo, 8 no 5º; os grupos 2, 3 e 4
têm 4 casas e não comportam 5, e o 3 e o 4 começam com os dígitos de versão e
variante). As 12 são construídas e conferidas. O caso 7 acrescenta 100 mil UUIDs
reais contra o baralho vivo `c1..c108` — o regime em que a base reprovava 60 %.

---

## 4. Poder de detecção — mutações

Sete regressões injetadas mecanicamente em `varrerSegredos`, cada uma seguida da
suíte completa. Âncoras conferidas antes de aplicar: mutação que não altera o
texto é reportada como erro, não como "mutante não detectado".

| mutação | vive? | derruba |
|---|---|---|
| M1 — volta a busca por substring | morre | CASO 1, 7, 7b, 12 |
| M2 — ignora todas as strings | morre | CASO 2, 3, 5, 6 |
| M3 — ignora todo `eventoId` | morre | CASO 2 |
| M4 — aceita id exato | morre | CASO 2, 3, 5, 8 |
| M5 — aceita id em lista | morre | CASO 3 + §21 do espectador + costura |
| M6 — aceita objeto de carta | morre | CASO 4 + §21 do espectador + costura |
| M7 — interrompe a recursão em objetos aninhados | morre | CASO 5, 8 |

**Sobreviventes: 0/7.** Cada mutação derruba um caso específico, e as duas que
mexem na travessia (M5, M6) derrubam também os testes de aceite que já existiam —
sinal de que a varredura continua sustentando as provas antigas.

---

## 5. Estabilidade

Base e candidata em cópias separadas, **em série**. A base saiu de
`git archive 85d0eee`, com o blob conferido contra `git rev-parse 85d0eee:test/ajuda.js`
(`e38edaf`), e sem o teste focal — comparar a base contra uma suíte que ela não
tem inflaria o resultado. `node v24.14.0`.

| repetição | base | candidata |
|---|---|---|
| `npm test` completo, 30× | **3/30 falharam** — 416s | **0/30** — 327s |
| espectador, 50× | **5/50 falharam** — 276s | **0/50** — 234s |
| versão, 50× | 0/50 — 85s | 0/50 — 50s |
| costura, 50× | **2/50 falharam** — 419s | **0/50** — 390s |
| credencial isolada, 30× | 0/30 — 25s | 0/30 — 27s |
| focal UUID, 50× | (não existe na base) | **0/50** — 67s |
| **total** | **10 falhas em 210 execuções** | **0 falhas em 260 execuções** |

Assinaturas colhidas na base, todas do mesmo defeito:

```
espectador: AssertionError: segredo vivo dentro de um payload de espectador
            + 'raiz.eventoId contém c1785'
            + 'raiz.eventoId contém c1788'
costura:    AssertionError: a mão do assento 2 vazou para o assento 0
            + 'raiz[4].eventoId contém c379'
```

### O que estes números NÃO provam

**Versão 0/50 na base não é prova de que o VER-19 seja imune.** Rodando
`versao.test.js` sozinho, o contador global `_contadorId` já está na casa dos
milhares quando o VER-19 chega, os ids ficam com 4–5 caracteres e a taxa cai para
a faixa de 0,03 %–0,1 % por carimbo. Em 50 execuções isso simplesmente não
aparece. O mesmo vale para a credencial isolada, que não toca a varredura.

A conclusão da candidata **não se apoia em ausência de falha**. Ela se apoia no
caso 12, que é exaustivo por construção: as 12 posições em que um id de 5
caracteres cabe num UUID v4 válido são todas montadas e conferidas, e um id de
carta não pode ser um UUID (6 caracteres contra 36). As 260 execuções limpas são
confirmação, não o argumento.

Também vale registrar duas armadilhas de medição encontradas no caminho, porque
elas produzem número falso nos dois sentidos:

1. **Medir a base dentro do worktree que está sendo editado.** A primeira campanha
   foi descartada por isso: as execuções posteriores à edição mediam a candidata
   com o rótulo da base.
2. **Rodar base e candidata em paralelo.** `test/ws.test.js` liga a porta fixa
   `8137`; duas campanhas simultâneas colidem com `EADDRINUSE` e produzem uma
   falha que parece da correção e não é. Daí a execução em série. Ao encadear
   campanhas, só `LISTENING` conta como porta presa — `TIME_WAIT` não.

---

## 6. Veredito

**PASS.**

| critério da OS | resultado |
|---|---|
| o falso positivo determinístico morre | sim — CASO 1 e CASO 12, exaustivo |
| vazamentos reais continuam detectados | sim — 8 casos de detecção, e os 8 já passavam na base |
| todas as mutações morrem | sim — 0 sobreviventes de 7 |
| a suíte completa fica estável | sim — 0 falhas em 260 execuções da candidata |
| nenhum arquivo de produção muda | sim — `git diff` sobre `server.js` e `package.json`: vazio |

Suíte completa da candidata: **243 testes, 243 passam** (228 da base + 15 do focal).

Sem PR, sem merge, sem deploy: publicado por push na branch
`correcao/teste-espectador-uuid-falso-positivo-v1`.

### O que fica em aberto

Nada bloqueia esta correção, mas dois pontos ficam anotados para quem vier depois:

- **`_contadorId` é global e nunca reinicia entre mesas do mesmo processo.** É por
  isso que a taxa do defeito dependia da posição do teste no arquivo, e é por isso
  que acrescentar um teste acima podia mover a intermitência de lugar. A correção
  torna isso irrelevante para a varredura, mas o acoplamento entre ordem dos testes
  e forma dos ids continua existindo.
- **`test/ws.test.js` liga porta fixa (`8137`).** Enquanto for assim, a suíte não
  pode ser executada duas vezes em paralelo na mesma máquina — nem por duas
  sessões, nem por dois worktrees.
