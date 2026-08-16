# EVIDÊNCIA — Produtor autoritativo e outbox V1

Veredito: **PASS**

- Branch: `claude/produtor-encerramento-autoritativo-v1`
- Base: `origin/integracao/ws-auth-visao-espectador-v1` @ `8cd14c6bc1bc984c3fa1eb8ca742c869fbb79092`
- Contrato: `docs/PRODUTOR-ENCERRAMENTO-V1.md`

---

## 1. Gate zero

```
$ git fetch --all --prune                                        exit 0
$ git ls-remote origin refs/heads/integracao/ws-auth-visao-espectador-v1
8cd14c6bc1bc984c3fa1eb8ca742c869fbb79092                         confere
$ git status --porcelain --untracked-files=all                   (vazio)
$ git checkout -b claude/produtor-encerramento-autoritativo-v1 8cd14c6...
```

Ancestralidade — todas provadas com `git merge-base --is-ancestor`:

| SHA | ancestral do HEAD? |
|---|---|
| `8cd14c6` (base) | sim |
| `71199e8` (ws-auth) | sim |
| `3c8b07e` (espectador) | sim |
| `1828d42` (main) | sim |

Baseline no ponto de partida: `npm run check` **exit 0**; `npm test`
**118 testes · 118 passaram · 0 falhas · 0 pulados**.

Handlers únicos conferidos (1 ocorrência de cada): `autenticar`, `expirar`,
`armarExpiracao`, `papelDe`, `visaoDaConexao`, `broadcastSala`,
`emitirFimSeAcabou`, `processar`, `conectar`.

Pontos localizados: `iniciarPartida` · `encerrarRodada` · `contarPontos` ·
`liquidar` · `registrarPartida` · `emitirFimSeAcabou` · `aoZerarMaoBaixando` ·
`descartar` · `DADOS_DIR` · escrita atômica do cofre (`.tmp` + `renameSync`).

## 2. Commits

| SHA | Camada |
|---|---|
| `5e4304a` | motor — `encerrarRodada` transporta o assento |
| `ed38f62` | salas — identidade da partida e mapa de participantes |
| `27cb428` | salas — envelope autoritativo |
| `faa3612` | outbox — persistência durável e ligação em `liquidar` |
| `da4e7b5` | testes — 39 provas |
| *(este)* | documentação |

> **Nota de processo, registrada porque afeta a leitura do histórico.** O
> primeiro commit desta OS juntou as quatro camadas num só. Foi desfeito
> (`reset --hard` para a base, com a versão final preservada fora da árvore) e
> refeito em quatro commits, cada um com `check` e `npm test` verdes antes de
> ser gravado. A reconstrução foi conferida contra a versão preservada: idêntica,
> exceto pela ordem de dois blocos de constantes.

## 3. Arquivos alterados

| Arquivo | O quê |
|---|---|
| `server.js` | motor (assento), módulo `outbox` novo, salas (identidade, envelope, produção), ws_server (fiação) |
| `test/produtor.test.js` | **novo** — 39 provas |
| `docs/PRODUTOR-ENCERRAMENTO-V1.md` | **novo** — contrato |
| `docs/PRODUTOR-ENCERRAMENTO-EVIDENCIA-V1.md` | **novo** — esta evidência |

`package.json` **não** foi alterado: nenhuma dependência foi adicionada, e a
outbox usa só `fs`/`path`/`crypto` do Node.

## 4. Testes

| Suíte | Passaram | Falhas |
|---|---|---|
| `auth_token.test.js` | 18 | 0 |
| `regressao_auth.test.js` | 12 | 0 |
| `ws_auth.test.js` | 34 | 0 |
| `espectador.test.js` | 23 | 0 |
| `regressao.test.js` | 14 | 0 |
| `ws.test.js` | 1 | 0 |
| `costura.test.js` | 16 | 0 |
| **`produtor.test.js`** | **39** | **0** |
| **`npm test`** | **157** | **0** |

`npm run check` → **exit 0**. `npm test` → **exit 0**, 0 pulados, 0 todo.
Zero ocorrências de `.skip(`, `.only(` e `.todo(` em `test/`.

As 118 provas da base (64 autenticação + 38 espectador/visão + 16 costura)
continuam com **contagem idêntica**, por arquivo.

### Achado registrado — não é regressão desta OS

**Os robôs do servidor não batem.** 25 partidas completas pelo gerenciador e 20
rodadas puras pelo motor terminaram **todas** por esgotamento de baralho:
`duplaQueBateu` ficou `null` em todas. O mesmo foi medido na base `8cd14c6`,
antes de qualquer alteração — logo é comportamento anterior, e não efeito desta
entrega.

Consequência prática: um teste que esperasse o robô bater seria intermitente ou
sempre falho. Por isso **BAT-03 monta o cenário legal de batida** (canastra
limpa na mesa, morto pego, mão de uma carta) e usa a porta pública
`J.descartar`, nos quatro assentos. Quem decide se a batida vale continua sendo
o motor.

## 5. Varredura de segredos

Limpa. Sem chave privada, API key, `client_secret`, e-mail pessoal ou token em
log. As duas únicas linhas de log que citam credencial dizem apenas *"credencial
expirada e não renovada"* e `e.message` — nenhum valor.

Os logs novos de encerramento carregam `partidaId`, `versaoContrato`, `motivo`,
`tipoPartida`, `valida` e `codigoMotivo`. **Sem uid, sem apelido, sem e-mail,
sem carta e sem o mapa de participantes** — conferido por grep.

Outras verificações:

- `grep -c "fetch(|https?.request(|axios|net.connect"` em `server.js` → **0**;
- payload de `fim` **inalterado** (diff vazio nas linhas `tipo: "fim"`);
- `partidaId` **não aparece** em nenhum caminho de envio ao cliente;
- rotas HTTP: `/health`, `/avatar/<id>`, `PUBLIC_DIR` — nenhuma alcança
  `DADOS_DIR`;
- `PROTOCOLO_MINIMO` continua **2**;
- `iniciar(porta, opts)` continua fail-closed sem `FIREBASE_PROJECT_ID`, e a
  injeção de verificador só é alcançável por argumento de código — não por
  mensagem WebSocket nem por variável de ambiente.

## 6. Idempotência — o que foi provado

| Cenário | Prova |
|---|---|
| `liquidar` duas vezes | OUT-02 (e a trava `sala.liquidada`) |
| duas tentativas de persistir o mesmo encerramento | OUT-02 (registro direto repetido) |
| reinício do processo | OUT-04 (segunda instância sobre o mesmo diretório) |
| partidas diferentes | OUT-03 |
| partida nova = id novo | PART-03 |
| nenhum crédito adicional | OUT-08 |
| segundo encerramento não reescreve o assento | BAT-07 |

## 7. Fronteiras

Sem chamada a Firebase ou Cloud Functions · sem credencial de serviço · sem
webhook · sem deploy · sem dashboard · sem alteração no app Flutter · sem
Firestore ou Rules · economia local preservada · nenhuma conquista concedida ·
`transporte-srv2` não integrada · `main` intocada · sem PR · sem force-push ·
nenhuma partida real executada.

## 8. Veredito

```
PASS
```
