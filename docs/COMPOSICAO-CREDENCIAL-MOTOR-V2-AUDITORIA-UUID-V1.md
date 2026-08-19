# Composição — credencial do motor V2 + correção da auditoria UUID V1

Composição **estritamente mecânica** de duas linhagens irmãs do servidor. Nenhuma
linha de código foi redesenhada, refatorada ou corrigida aqui: o merge é o único
ato de autoria deste documento, e a árvore que ele produziu é idêntica, bit a bit,
à árvore que o `merge-tree` previu **antes** de a branch existir.

**Nada foi ativado.** Sem deploy, sem PR, sem token real, sem credencial ligada,
sem merge em outra branch.

---

## 1. Identidades

| papel | branch | SHA completo |
|---|---|---|
| base comum | — | `85d0eee5286fd1deba5c2ae85176b76e714e6690` |
| Entrada A — credencial | `correcao/credencial-motor-secure-token-v2` | `deed131f7f880cee3c86d1c7c12f184d459b5e08` |
| Entrada B — auditoria UUID | `correcao/teste-espectador-uuid-falso-positivo-v1` | `fd99260b07a25be6587c017bd172d21ebff4f641` |
| composição | `integracao/credencial-motor-v2-auditoria-uuid-v1` | `72bc99c8f3482508103ef03bd2641830c42928bf` |

O SHA do merge e o HEAD final são **coisas diferentes**: o merge é `72bc99c…`, e o
commit deste documento vem depois dele, deslocando o HEAD. Os dois são informados
separadamente no relatório de publicação — quem for substituir a entrada do
servidor na OS pausada precisa do **HEAD final**, não do SHA do merge.

Merge-base calculada — não presumida:

```
git merge-base --all deed131 fd99260  ->  85d0eee5286fd1deba5c2ae85176b76e714e6690
```

Merge-base **única**, e igual à base declarada na OS. As duas entradas descendem
dela (`merge-base --is-ancestor` verdadeiro dos dois lados).

Os dois SHAs foram resolvidos por **duas consultas remotas independentes** — uma
pelo remote nomeado, outra pela URL crua — antes de qualquer fetch, e o refspec do
remote foi conferido como completo (`+refs/heads/*:refs/remotes/origin/*`): um
refspec truncado responderia "atualizado" sobre refs congeladas e mentiria sobre
ancestralidade.

## 2. Commits exclusivos de cada lado

Entrada A (2 commits):

```
deed131  docs(correcao): laudo do contrato do Secure Token no servidor
82368fb  fix(credencial): o envelope do Secure Token nao decide projeto
```

Entrada B (1 commit):

```
fd99260  test(espectador): matar o falso positivo de UUID na varredura de segredos
```

## 3. Inventário e interseção

| arquivo | Entrada A | Entrada B |
|---|---|---|
| `docs/CORRECAO-CONTRATO-SECURE-TOKEN-V2.md` | +214 / −0 | — |
| `docs/CREDENCIAL-RENOVAVEL-MOTOR-V1.md` | +109 / −13 | — |
| `server.js` | +45 / −9 | — |
| `test/credencial_motor.test.js` | +236 / −11 | — |
| `docs/CORRECAO-FALSO-POSITIVO-UUID-ESPECTADOR-V1.md` | — | +284 / −0 |
| `test/ajuda.js` | — | +65 / −4 |
| `test/uuid_falso_positivo.test.js` | — | +280 / −0 |

**Interseção: vazia.** Quatro arquivos de um lado, três do outro, nenhum em comum.

Confirmado item a item, como a OS exige:

- `server.js` é alterado **apenas** pela Entrada A;
- `test/ajuda.js` e `test/uuid_falso_positivo.test.js` vêm **apenas** da Entrada B
  (o primeiro é modificação de um arquivo que já existia na base; o segundo é
  arquivo novo);
- nenhum lockfile existe no repositório — nem antes nem depois; `package.json` é
  idêntico ao de `deed131` (blob `6b56ac79`);
- nenhum `.env`, `cred.env`, chave privada, `AIza…`, `ya29.` ou refresh token
  aparece nos sete arquivos do delta nem no restante da árvore composta;
- as três árvores de trabalho envolvidas estavam limpas antes e depois.

## 4. Previsão e árvore real

```
git merge-tree --write-tree deed131 fd99260  ->  a05771b4b875fa5d1785277b67bc76b5046ca201
                                                  (sem conflito, sem arquivo em disputa)

git rev-parse 72bc99c^{tree}                 ->  a05771b4b875fa5d1785277b67bc76b5046ca201
```

**Idênticas.** A previsão foi feita antes de a branch existir; a árvore real é a
mesma. E a previsão fecha dos dois lados:

- `deed131` → previsão = exatamente os três arquivos da Entrada B;
- `fd99260` → previsão = exatamente os quatro arquivos da Entrada A.

Isto é o que "composição ortogonal" significa aqui: cada lado enxerga o outro como
o seu delta inteiro, e nada além disso.

Método: branch criada **diretamente em `deed131`** (HEAD conferido entre os dois
passos, porque um `checkout -b` que falha deixa o merge na branch errada), seguida
de `git merge --no-ff` de `fd99260`. Sem squash, sem rebase, sem cherry-pick, sem
`--force` e sem resolução manual — o merge foi limpo pela estratégia `ort`, sem
nenhum conflito a resolver.

Pais, na ordem:

```
72bc99c8f3482508103ef03bd2641830c42928bf
  parent 1: deed131f7f880cee3c86d1c7c12f184d459b5e08   (credencial V2)
  parent 2: fd99260b07a25be6587c017bd172d21ebff4f641   (auditoria UUID V1)
```

## 5. Equivalência de produção com `deed131`

```
git diff --numstat deed131 HEAD -- . ':(exclude)test/**' ':(exclude)docs/**'
  (vazio)
```

**Delta de produção vazio.** O único arquivo de produção do repositório é
`server.js`, e o blob é o mesmo dos dois lados:

```
deed131:server.js   66b6c8dd28799bfa613299d2046d406162fc9b05
72bc99c:server.js   66b6c8dd28799bfa613299d2046d406162fc9b05
85d0eee:server.js   bc165eb239c3702bbef2b42ab55aef73a080e4d4   (a base, para contraste)
```

O terceiro SHA está aqui de propósito: mostra que a Entrada A **de fato** mudou
produção, e que a composição preservou essa mudança inteira — o delta vazio não é
o delta de duas árvores que nunca se mexeram.

A Entrada B não tocou em produção: os três arquivos dela vivem em `docs/` e
`test/`.

Invariantes do contrato Secure Token, todos preservados e provados na seção 8:

- `project_id` **não** decide confiança — a comparação removida não voltou, nem sob
  outro nome (`CRED-18e`), e não existe código de falha `PROJETO_DIVERGENTE`;
- `aud`, `iss`, `sub`, `user_id`, expiração e `motorDePartidas === true` (estrito)
  continuam obrigatórios em `conferirSanidade`;
- erro HTTP não tem fallback permissivo;
- existe **um** verificador de ID token no servidor, e `credencial_motor` usa o
  mesmo parser de JWT de `auth_firebase` (`CRED-34d`). Não há segunda verificação
  paralela. A ausência de `checkRevoked` é a DECISÃO 2 declarada na base — risco
  residual anterior às duas entradas, registrado na seção 11, e nenhuma das duas
  o alterou.

## 6. Contagem — demonstrada por arquivo, não presumida

Medição por arquivo, nas quatro árvores, com `node --test <arquivo>` um de cada vez:

| arquivo | base `85d0eee` | A `deed131` | B `fd99260` | composição `72bc99c` |
|---|---:|---:|---:|---:|
| `auth_token.test.js` | 18 | 18 | 18 | 18 |
| `costura.test.js` | 16 | 16 | 16 | 16 |
| **`credencial_motor.test.js`** | 47 | **60** | 47 | **60** |
| `espectador.test.js` | 23 | 23 | 23 | 23 |
| `produtor.test.js` | 39 | 39 | 39 | 39 |
| `regressao.test.js` | 14 | 14 | 14 | 14 |
| `regressao_auth.test.js` | 12 | 12 | 12 | 12 |
| **`uuid_falso_positivo.test.js`** | — | — | **15** | **15** |
| `versao.test.js` | 24 | 24 | 24 | 24 |
| `ws.test.js` | 1 | 1 | 1 | 1 |
| `ws_auth.test.js` | 34 | 34 | 34 | 34 |
| **total** | **228** | **241** | **243** | **256** |

A conta fecha e é atribuível:

```
228 (base)
+13  credencial_motor.test.js: 47 -> 60   (Entrada A)
+15  uuid_falso_positivo.test.js: arquivo novo   (Entrada B)
= 256
```

Os três totais de referência da OS foram **reproduzidos**, não copiados: 228, 241 e
243 saíram da medição. E os nove arquivos que nenhuma das entradas tocou têm
contagem **idêntica** nas quatro árvores — nenhum teste foi substituído, movido ou
apagado em silêncio.

Confirmação pela suíte inteira na composição: `npm test` → `tests 256, suites 34,
pass 256, fail 0`.

Observação de arnês, para quem repetir a medição: o glob do `npm test` é
`test/*.test.js`. `test/ajuda.js` e `test/ajuda_auth.js` são auxiliares e não
entram na contagem — o que a Entrada B mudou em `ajuda.js` aparece no **resultado**
das outras suítes, não como casos novos.

## 7. Baterias

Todas na composição, todas verdes:

| # | bateria | resultado |
|---|---|---|
| 1 | `npm test` nominal | 256/256 |
| 2 | credencial isolada | 60/60 |
| 3 | espectador | 23/23 |
| 4 | `costura.test.js` | 16/16 |
| 5 | versão | 24/24 |
| 6 | `uuid_falso_positivo.test.js` | 15/15 |
| 7 | autenticação, cache, renovação e revogação | `auth_token` 18/18, `ws_auth` 34/34, `regressao_auth` 12/12, e dentro da credencial: `CRED/CACHE` (margem de 5 min, coalescência, token expirado nunca devolvido) e `CRED/ROTACAO` (refresh token novo só em memória) |
| 8 | inicialização do servidor, sem conexão externa | `npm run check` limpo; `PORT=8231 node server.js` sobe, imprime `[auth] FIREBASE_PROJECT_ID não configurado — NENHUMA conexão vai autenticar` e fica ouvindo. Fail closed na partida, como a base já fazia. |

## 8. Campanha de estabilidade

Sequencial, por causa da porta fixa `8137` de `test/ws.test.js`. Base e candidata
**nunca** rodaram ao mesmo tempo.

| bateria | repetições | verdes | vermelhas | invalidadas por `EADDRINUSE` | tempo |
|---|---:|---:|---:|---:|---:|
| `npm test` | 30 | **30** | 0 | 0 | 304 s |
| espectador | 50 | **50** | 0 | 0 | 251 s |
| costura | 50 | **50** | 0 | 0 | 437 s |
| versão | 30 | **30** | 0 | 0 | 26 s |
| credencial isolada | 30 | **30** | 0 | 0 | 17 s |
| focal UUID | 50 | **50** | 0 | 0 | 43 s |
| **total** | **240** | **240** | **0** | **0** | ~18 min |

**Zero falso positivo de UUID em 240 execuções.** Nenhuma execução precisou ser
descartada por porta presa — e o arnês estava preparado para descartar, porque
`EADDRINUSE` não é falha funcional nem verde.

### O contraste que dá sentido ao número

240 verdes só provam ausência se houvesse algo a ausentar. Por isso a mesma bateria
de espectador rodou **na base `85d0eee`**, em série, depois da candidata:

| árvore | espectador ×50 | vermelhas |
|---|---:|---|
| base `85d0eee` | 49/50 | **1** — rodada 43: `nenhum segredo atravessa em NENHUM evento, do início ao fim da partida` |
| composição `72bc99c` | **50/50** | 0 |

O flake existia, é aquele caso, e a composição o removeu. A taxa medida na base
(1/50) explica também por que ele passou despercebido tanto tempo.

## 9. Provas cruzadas

### Credencial

| exigência | onde está provada |
|---|---|
| `project_id` numérico é aceito quando os claims assinados estão corretos | `CRED-18`, `18b` (número diferente), `18c` (textual), `18d` (ausente/nulo) |
| `aud` divergente é recusado | `CRED-18f`, `CRED-21` |
| `iss` divergente é recusado | `CRED-18g`, `CRED-21` |
| claim não booleano é recusado | `CRED-18j` (12 formas: ausente, `false`, `"true"`, `1`, `null`, `{}`, `[]`…), `CRED-20` |
| erro HTTP não tem fallback permissivo | `CRED-23/24/25/26` (400, 401, 429, 500), `CRED-18m` (par projeto × API key: recusado pelo **status**, corpo não propagado) |
| não existe segunda verificação sem `checkRevoked` | `CRED-34d` — o parser de JWT é o **mesmo** de `auth_firebase`; há um único verificador no servidor. A revogação segue fora do escopo pela DECISÃO 2 da base (seção 11) |
| a comparação removida não voltou sob outro nome | `CRED-18e` |
| sigilo | `CRED-18n` (8 cenários), `CRED-31`, `CRED-32`, `CRED-32b`, `CRED-32c` |

### UUID

| exigência | onde está provada |
|---|---|
| as 12 posições possíveis do id curto dentro de um UUID v4 não acusam carta | `CASO 12`; e `CASO 7` (100 mil UUIDs reais contra o baralho inteiro de segredos vivos) |
| id exato **fora** de UUID continua detectado | `CASO 2`, `CASO 6b` |
| id em lista continua detectado | `CASO 3` |
| objeto de carta continua detectado | `CASO 4` |
| segredos com hífen continuam detectados | `tokensDe` entrega a corrida inteira **e** as partes, então `SEGREDO-MAO0-1` casa inteiro e `mao0-c1818` ainda entrega `c1818` — exercitado em `CASO 8` e no caso de tokenização |
| a recursão continua cobrindo objetos e listas | `CASO 5` (aninhado fundo), `CASO 3` (lista), `CASO 4` (objeto) |
| nenhum caso volta ao `includes` bruto | `no.includes(s)` não existe mais em `varrerSegredos`; sobrou apenas como citação em comentário. O único `includes` remanescente é `corrida.includes("-")`, que trata hífen em token e não detecta segredo |

### Mutações focais — 6 aplicadas, 6 detectadas, 0 sobreviventes

Arnês com duas travas: âncora exigida **única dentro do módulo declarado** (foi
assim que a Entrada A descobriu que `if (emVoo) return emVoo;` aparece duas vezes
no bundle) e `numstat` conferido **antes** de creditar qualquer veredito — mutação
que não altera o texto é erro de arnês, nunca "mutante não detectado".

| # | mutação | arquivo | `numstat` | falhas | casos derrubados |
|---|---|---|---|---:|---|
| A1 | restaurar `project_id === FIREBASE_PROJECT_ID` | `server.js` | +3 / −0 | **33** | `CRED-18`, `18b`, `18c`, `18d`, `18e` e a cascata do módulo |
| A2 | aceitar `aud` incorreto | `server.js` | +1 / −1 | 2 | `CRED-18f`, `CRED-21` |
| A5 | claim *truthy* em vez de `=== true` | `server.js` | +1 / −1 | 2 | `CRED-18j`, `CRED-20` |
| B1 | voltar à substring bruta | `test/ajuda.js` | +2 / −2 | 6 | `CASO 1`, `7`, `7b`, `12`, `8` **e a varredura estrutural do espectador** |
| B5 | aceitar id secreto em item de lista | `test/ajuda.js` | +1 / −1 | 2 | `CASO 3`, `CASO 8` |
| B6 | aceitar o objeto de carta viajando inteiro | `test/ajuda.js` | +1 / −1 | 6 | `CASO 4`, `CASO 8`, `CASO 9`, §21 do espectador, `COST-15b` |

Todas revertidas, árvore limpa conferida após cada uma.

Três leituras que importam:

**A1 derruba 33 casos, e é esse número que mede a correção da prova.** É o mesmo
33 da Entrada A: a composição não afrouxou o instrumento que a homologação
construiu.

**B1 derruba a varredura estrutural do espectador junto com os casos focais.** É a
demonstração direta do mecanismo do flake medido na seção 8 — restaurada a
substring, o caso volta a reprovar.

**B5 aqui é mais estreita que a M5 documentada na Entrada B.** A minha só ignora
item de lista do tipo string, e por isso derruba 2 casos em vez de alcançar
espectador e costura como a original. Foi detectada, mas registro a diferença: não
é a mesma mutação da linhagem, e quem comparar as duas tabelas não deve ler os
números como equivalentes.

## 10. Riscos residuais

1. **Revogação de sessão** — DECISÃO 2 da base: um ID Token já emitido vale até
   expirar (1 h) mesmo se a sessão for revogada no intervalo. Anterior às duas
   entradas, não alterado por nenhuma delas, e fora do escopo desta composição.
2. **Nada foi ativado.** A credencial do motor continua sem variáveis de ambiente
   configuradas, sem refresh token real e sem ligação com a outbox (`CRED-34b`).
   O servidor sobe sem nenhuma das variáveis novas (`CRED-34c`). A ativação segue
   proibida até ordem própria.
3. **O `emulators`/Play e o lado do app não entram aqui.** Esta composição é só do
   servidor.
4. **A campanha é uma amostra.** 240 execuções verdes contra uma taxa medida de
   1/50 na base é forte, mas é evidência estatística, não prova de ausência.
5. **`buraco-servidor.zip` e `server_js.txt`** continuam versionados na raiz, como
   na base. Não foram tocados e não são objeto desta OS, mas são superfície que
   merece decisão própria um dia.

## 11. Ausência de ativação

Nesta composição **não** houve: deploy, PR, `--force`, merge em outra branch,
token real, credencial ligada, alteração de produção vinda de `fd99260`, nem
qualquer correção de código. O único ato de escrita foi o merge e este documento.
