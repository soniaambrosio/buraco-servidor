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
| Branch | `correcao/credencial-motor-secure-token-v2` |
| Base | `claude/credencial-renovavel-motor-railway-v1` |
| SHA da base | `85d0eee5286fd1deba5c2ae85176b76e714e6690` |
| Metade administrativa | `functions/scripts/bootstrap_credencial_motor.js`, no repo do app |

> **V2 — o contrato do Secure Token foi corrigido.** A homologação independente
> mediu o campo `project_id` da resposta do endpoint: vem o **número do projeto**,
> não o id textual. A V1 o comparava com `FIREBASE_PROJECT_ID` e recusava na
> divergência — o Railway **nunca** obteria token, para sempre, e o defeito só
> apareceria na ativação. A comparação foi **removida**, e não substituída por
> outra. Ver §3, decisão **6**.

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

### Seis decisões

**1 — Fail closed.** Configuração faltando, resposta estranha, UID divergente,
`aud`/`iss` de outro projeto, claim ausente: tudo recusa. Não existe caminho
degradado nem token "provisório". Um servidor que não consegue provar quem é
simplesmente não fala com a Function.

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

**6 — `project_id` do envelope não é o Project ID, e não é autoridade.** *(V2 — a
correção.)*

A V1 comparava `json.project_id` da resposta do Secure Token com
`FIREBASE_PROJECT_ID`. A homologação independente mediu o campo contra o endpoint:

```text
FIREBASE_PROJECT_ID esperado ... "bmv-homolog"
resposta.project_id ............ "12345"         ← número do projeto, não o id
resposta.user_id ............... == uid          (correto)
payload.aud .................... "bmv-homolog"   ← o id textual está AQUI
payload.iss .................... "https://securetoken.google.com/bmv-homolog"
```

Com a comparação de pé, `obterIdToken()` lançaria `PROJETO_DIVERGENTE` em **toda**
chamada. Falha fechada — sem risco de segurança — e sem funcionar: o Railway
nunca obteria token, e ninguém descobriria antes da ativação.

**A comparação foi removida, e não trocada por uma equivalente contra o número.**
Ela nunca acrescentou segurança:

| Quem guarda o quê | Onde |
|---|---|
| O projeto do refresh token bate com a API key | **o próprio endpoint** valida, e um par incompatível volta como erro HTTP — que já recusa aqui (`CRED-18m`) |
| A **identidade** | `user_id` do envelope, conferido (`CRED-18i`) |
| O **projeto textual** | `aud` e `iss` do ID token, conferidos (`CRED-18f`, `CRED-18g`) |

Um envelope pode dizer qualquer coisa; o token, não — `aud` e `iss` vêm assinados
dentro dele, e são exatamente os campos que a Function verifica do outro lado.
Guardar o projeto pelo envelope era guardar pela metade mais fraca.

O campo passou a ser **informativo**: não é comparado, **não é exigido**, e a sua
forma — texto, número em texto, número JSON ou ausência — não decide nada
(`CRED-18b`, `CRED-18c`, `CRED-18d`). Exigir a forma de um dado que não decide
nada seria só mais um jeito de a credencial inteira falhar fechada por causa de um
campo que o servidor não lê.

**Não existe mais o código `PROJETO_DIVERGENTE`.** `CRED-18e` é a rede
estrutural: ela reprova se a comparação voltar, inclusive escrita com outro nome
de falha.

### O que a correção NÃO afrouxou

A remoção de uma barreira frouxa só é segura porque as fortes estão medidas.
Todas continuam de pé, e o bloco `CRED/CONTRATO` as fixa **uma a uma**:

| Barreira | Caso | Continua |
|---|---|---|
| `aud === FIREBASE_PROJECT_ID` | `CRED-18f` | ✅ recusa |
| `iss === https://securetoken.google.com/<id>` | `CRED-18g` | ✅ recusa |
| `sub === FIREBASE_MOTOR_UID` | `CRED-18h` | ✅ recusa |
| `user_id === FIREBASE_MOTOR_UID` | `CRED-18i` | ✅ recusa |
| `motorDePartidas === true`, estrito | `CRED-18j` | ✅ recusa 12 formas |
| Expiração | `CRED-18k` | ✅ recusa |
| Resposta sem ID token | `CRED-18l` | ✅ recusa |
| Erro do endpoint (par projeto × chave) | `CRED-18m` | ✅ recusa, sem ecoar o corpo |
| Nada vazado em falha | `CRED-18n` | ✅ 8 cenários |

HTTPS, host fixo, timeout, teto de resposta, cache com margem e coalescência:
**intocados**.

### A fixture que afirmava a suposição

A suíte da V1 não pegava o defeito porque `respostaOk()` codificava
`project_id: PROJETO` — ela **afirmava** a suposição do módulo em vez de testá-la.
A fixture da V2 carrega a forma **medida** (`"1234567890"`), e nenhum caso depende
de ela coincidir com `FIREBASE_PROJECT_ID`.

### O que continua sem prova

`aud`, `iss`, `sub` e a assinatura RS256 com `kid` são verificados **pela
Function** que recebe o token, via Admin SDK, com `checkRevoked`. Este módulo faz
sanidade local e **não** verifica assinatura, de propósito (decisão 5). A junta
entre os dois lados **nunca foi exercitada**: o emulador de Auth emite token
`alg: none`, e um token assinado à mão mediria o nosso arnês, não o contrato do
Google. O **smoke com token real** continua obrigatório — está escrito em
`docs/CREDENCIAL-MOTOR-BOOTSTRAP-E-REVOGACAO-V1.md` §7.1, no repositório do app.

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

| Suíte | V1 | V2 | Resultado |
|---|---|---|---|
| `credencial_motor` | 47 | **60** | ✅ |
| regressão do servidor (as 10 anteriores) | 181 | 181 | ✅ |
| **total** | **228** | **241** | **✅** |

A V2 acrescenta **14** casos (o bloco `CRED/CONTRATO`) e remove **1**: o antigo
`CRED-18`, "project_id divergente é recusado", que afirmava um contrato
inexistente. Nenhum outro caso da V1 mudou de veredito.

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
6. **O contrato do envelope só foi medido no emulador.** *(V2.)* Que
   `project_id` é o número do projeto foi medido contra o Secure Token do
   emulador e é o que a documentação do fluxo de refresh sugere
   (`PROJECT_NUMBER_MISMATCH`); contra o endpoint **real** ninguém mediu, porque
   nenhuma chamada real é autorizada. A correção é imune a isso — o campo deixou
   de decidir qualquer coisa, em **qualquer** forma —, mas o que prova o contrato
   inteiro continua sendo o smoke com token real, não este documento.
