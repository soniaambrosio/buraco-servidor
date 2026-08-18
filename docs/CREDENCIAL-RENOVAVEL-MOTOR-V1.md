# Credencial renovável do Motor — V1 (servidor)

O servidor Node/Railway passa a saber obter, sozinho e para sempre, um **Firebase
ID token** com o claim `motorDePartidas` — **sem** `firebase-admin`, **sem**
dependência nova, **sem** chave de conta de serviço e **sem** login interativo.

> **PASS — O MOTOR TEM CREDENCIAL RENOVÁVEL SEM CHAVE**
> **ATIVAÇÃO OPERACIONAL NÃO EXECUTADA**
>
> Esta entrega é **infraestrutura**. Ela **não** envia a outbox, **não** traduz o
> envelope da partida e **não** está ligada a nada: `ws_server` não carrega o
> módulo e `npm start` faz exatamente o que fazia.

| | |
|---|---|
| Repositório | `soniaambrosio/buraco-servidor` |
| Branch | `claude/credencial-renovavel-motor-railway-v1` |
| Base | `claude/versionamento-visao-autoritativa-v1` |
| SHA da base | `7e7572b3471bcec2a6968e6084f56dd407cef601` |
| Metade administrativa | `functions/scripts/bootstrap_credencial_motor.js`, no repo do app |

---

## 1. O problema, e por que as saídas óbvias estavam fechadas

A Cloud Function `registrarEncerramentoPartida` só aceita **ID token do
Firebase**, e ID token **expira em uma hora**. Nenhuma das saídas diretas servia:

| Saída | Por que não |
|---|---|
| `firebase-admin` no servidor | Este repositório é **zero-dependência** por decisão documentada, e o deploy roda `npm start` **sem** `npm install` |
| Chave de conta de serviço | Segredo de altíssimo poder no Railway, e **nada o expira** |
| Custom token guardado | Expira em uma hora e **só credencial administrativa o emite** — teria de ser renovado à mão, para sempre |
| ID token estático | Morre em uma hora |

## 2. A saída

Um **refresh token**, obtido **uma vez** pela ferramenta administrativa e
guardado como segredo do Railway. Trocá-lo por ID token novo exige só a **Web API
Key**, que não é segredo, e é uma requisição HTTPS — `https` do Node, nada
instalado.

```text
operador (uma vez, na máquina dele, com credencial administrativa)
  → createCustomToken(uid)
  → POST identitytoolkit /v1/accounts:signInWithCustomToken
  → { idToken, refreshToken }
  → o REFRESH TOKEN vira segredo do Railway

Railway (para sempre, sem credencial administrativa)
  → POST securetoken /v1/token   (grant_type=refresh_token)
  → idToken novo, só em memória
```

O refresh token **não expira por tempo**, é **revogável de fora**
(`revokeRefreshTokens`), e não dá poder administrativo nenhum: ele só produz
tokens **daquela identidade**.

## 3. O módulo

`credencial_motor`, novo no bundle, marcado com `// [CREDENCIAL]`.

É o **simétrico exato** de `auth_firebase`: aquele verifica a credencial de quem
**entra** (o jogador, no handshake); este produz a credencial de quando
**saímos**.

```js
const { criarCredencialDoMotor } = require("./credencial_motor");
const cred = criarCredencialDoMotor();
const idToken = await cred.obterIdToken();   // renova sozinho quando precisa
```

### Cinco decisões

**1 — Fail closed.** Configuração faltando, resposta estranha, projeto ou UID
divergente, claim ausente: tudo recusa. Não existe caminho degradado nem token
"provisório". Um servidor que não consegue provar quem é simplesmente não fala
com a Function.

**2 — Nada em disco, nada em log.** O ID token vive **só em memória**; o refresh
token, na memória e no ambiente. Nenhum dos dois entra em log, mensagem de erro
ou arquivo. Há teste que **roda o módulo com o `console` interceptado** e afirma
que nada foi impresso, no sucesso e na falha.

**3 — Renovação preguiçosa, sem timer.** O módulo **não agenda nada**. Um
`setInterval` manteria o processo vivo, renovaria em servidor ocioso e
continuaria batendo no Google depois de a credencial ser revogada. A renovação
acontece quando alguém pede um token; se ninguém pede, nada acontece.

**4 — Não foi ligado a nada.** A outbox está intocada, o envelope não foi
traduzido, `ws_server` não carrega o módulo. Fixado em teste (`CRED-34b`).

**5 — A leitura local do JWT não é autoridade.** O payload é decodificado para
conferir `sub`, `aud`, `iss`, `exp` e o claim. A **assinatura não é verificada**,
e não deve ser: quem tem autoridade sobre este token é a Function que o recebe.
Verificação criptográfica paralela criaria uma segunda opinião sobre um token que
não é nosso para julgar. O **parser é o mesmo** de `auth_firebase` — um só
analisador de JWT no bundle, para os dois não divergirem.

## 4. Momento exato da renovação

| | |
|---|---|
| Token válido, longe da margem | devolvido do cache, **sem rede** |
| `agora + 5 min ≥ exp` | **renova**, mesmo o token ainda não tendo expirado |
| Token expirado | **nunca** é devolvido; se a renovação falhar, a chamada falha |

A margem é **cinco minutos**, e o número tem razão: entre pedir o token e a
Function verificá-lo há a viagem de rede, a fila do Cloud Functions e a
tolerância de relógio do Google (até um minuto para cada lado). Um token entregue
no limite chegaria expirado, e o encerramento da partida — que só acontece uma
vez — falharia por alguns segundos de diferença.

A validade que vale é a do **`exp` do próprio token**, e não a do `expires_in` do
envelope da resposta: quem verifica lê o token (`CRED-22b`).

## 5. Concorrência

`emVoo` é atribuído **sincronamente**, antes de qualquer `await`. É esse detalhe
que faz **cem chamadas simultâneas produzirem uma renovação**: se a atribuição
acontecesse depois de um ponto de suspensão, todas as chamadas do mesmo tique
veriam `emVoo === null` e disparariam a própria — o Google devolveria um refresh
token novo para cada uma, e as **rotações concorrentes invalidariam umas às
outras**.

A **falha também é compartilhada** (`CRED-14b`). Coalescer só o sucesso deixaria
cem chamadas martelando o endpoint exatamente quando ele está com problema.

## 6. Rotação do refresh token

O Firebase **pode** devolver um refresh token novo. Quando devolve, é ele que
vale daqui em diante — continuar usando o antigo funcionaria por um tempo e
pararia sem aviso.

A rotação atualiza **somente a memória**. Nada é gravado, e **reiniciar volta ao
segredo do ambiente** (`CRED-16`) — que é o desejado: o Railway é a fonte da
verdade. Se a rotação fosse persistida, um segredo velho no Railway e um novo em
disco divergiriam em silêncio.

## 7. Segredos esperados no Railway

**Nenhum valor real aparece em Git, teste, fixture, log, mensagem de erro,
documentação ou linha de comando.** Abaixo só os **nomes**.

| Variável | Natureza | Origem |
|---|---|---|
| `FIREBASE_MOTOR_REFRESH_TOKEN` | **segredo** | `bootstrap_credencial_motor.js` |
| `FIREBASE_MOTOR_UID` | identidade esperada | o UID técnico |
| `FIREBASE_PROJECT_ID` | projeto esperado | **já existe** (WS-AUTH) |
| `FIREBASE_WEB_API_KEY` | configuração | Console → Configurações → Geral |
| `FIREBASE_REGISTRAR_ENCERRAMENTO_URL` | *(futura)* | OS do transporte |

`FIREBASE_PROJECT_ID` **não é nova**: o verificador de entrada do WS-AUTH já a
usa, e é a mesma. As outras três não existiam.

**O custom token e o ID token não são segredos permanentes.** O custom token
serve só ao bootstrap; o ID token existe apenas em memória. Nenhum dos dois vai
para o Railway.

## 8. Testes

| Suíte | Casos | Resultado |
|---|---|---|
| `credencial_motor` (nova) | 47 | ✅ |
| regressão do servidor (as 10 anteriores) | 181 | ✅ |
| **total** | **228** | **✅** |

```bash
npm test
```

### Um defeito de prova pré-existente, e por que ele não é desta entrega

A suíte tem um **falso positivo intermitente**, presente **na base** (`7e7572b`)
e **anterior** a esta OS.

`carimbarEstado` gera `eventoId = crypto.randomUUID()`, e o arnês
`varrerSegredos` procura os ids de carta **por substring**. Um UUID que por acaso
contenha `c366`, `c1818`, `c1786`… é acusado de vazar um segredo que não vazou. O
defeito é **de prova, não de código**: nenhuma carta atravessou nada.

Medido nas duas pontas, na mesma máquina:

| Árvore | Falhas | Execuções de `npm test` | Achados |
|---|---|---|---|
| Base `7e7572b`, intocada | **2** | 33 | `c366`, `c1786`, `c1819` |
| Esta branch | **2** | 24 | `c1791`, `c1808` |

Taxas indistinguíveis, e o módulo novo **não é carregado por ninguém**
(`CRED-34b`) — não existe caminho por onde ele pudesse influenciar o resultado.
Está **registrado, não corrigido**: mexer no arnês do espectador é escopo de
outra frente, e alterá-lo aqui misturaria uma correção de teste alheio a uma
entrega de credencial.

## 9. O que NÃO foi feito

- Nenhuma variável criada ou alterada no Railway;
- nenhum deploy;
- nenhuma chamada contra produção;
- nenhum envio de outbox;
- nenhuma tradução de envelope;
- nenhuma regra do Buraco, pontuação, encerramento, economia ou moderação tocada;
- nenhuma dependência acrescentada (`package.json` continua sem `dependencies`);
- `npm start` inalterado.

## 10. Riscos residuais

1. **O refresh token não expira sozinho.** Quem o obtiver produz ID tokens com
   `motorDePartidas` até alguém revogar as sessões. É o preço de não ter chave de
   serviço, e a mitigação é o corte: `revokeRefreshTokens` + o `checkRevoked` que
   o receptor agora exige.
2. **Não há rotação automática programada.** Trocar a credencial é rodar o
   bootstrap de novo e substituir o segredo — manual, como a concessão do claim.
3. **A Web API Key é configuração, não segredo — mas permite tentar a troca.**
   Sozinha ela não vale nada: sem o refresh token não produz token nenhum.
4. **O módulo não está ligado.** Enquanto o transporte não existir, esta
   credencial não é exercitada em produção, e um defeito de integração só
   aparecerá na OS seguinte.
5. **O bundle continua sendo editado à mão.** A fonte `cliente/` segue ausente;
   a exceção está documentada no cabeçalho, como nas quatro anteriores.
