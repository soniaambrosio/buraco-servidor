# Correção V2 — o contrato do Secure Token (servidor)

> ## `PASS` da correção
>
> **O `project_id` do envelope deixou de decidir qualquer coisa, e nenhuma
> barreira do token foi afrouxada.**
>
> A homologação independente mediu o campo contra o endpoint: vem o **número** do
> projeto, não o id textual. A V1 o comparava com `FIREBASE_PROJECT_ID` e recusava
> na divergência — `obterIdToken()` lançaria `PROJETO_DIVERGENTE` em **toda**
> chamada, o Railway nunca obteria ID token, e o defeito só apareceria na
> ativação.
>
> **241 casos · 0 falhas · zero dependência nova · `npm start` inalterado ·
> zero deploy · zero segredo.**

| | |
|---|---|
| Branch | `correcao/credencial-motor-secure-token-v2` |
| Base | `claude/credencial-renovavel-motor-railway-v1` @ `85d0eee5286fd1deba5c2ae85176b76e714e6690` |
| Metade do app | `soniaambrosio/buraco-master-vip-app`, `docs/CORRECAO-CREDENCIAL-MOTOR-CONTRATO-E-RUNBOOK-V2.md` |
| Data | 2026-08-17 |

---

## 1. O que estava errado

```text
FIREBASE_PROJECT_ID esperado ... "bmv-homolog"
resposta.project_id ............ "12345"         ← número do projeto
resposta.user_id ............... == uid          (correto)
payload.aud .................... "bmv-homolog"   ← o id textual está AQUI
payload.iss .................... "https://securetoken.google.com/bmv-homolog"
```

`interpretarResposta` recusava com `PROJETO_DIVERGENTE`. Falha **fechada** — sem
risco de segurança — e sem funcionar.

E a suíte não pegava: a fixture `respostaOk()` codificava `project_id: PROJETO`.
Ela **afirmava a suposição** do módulo em vez de testá-la.

---

## 2. O que mudou em `server.js`

Somente dentro do módulo `credencial_motor`.

| | V1 | V2 |
|---|---|---|
| `json.project_id !== esperado.projectId` | recusava | **removido** |
| `typeof json.project_id !== "string"` na completude | exigido | **não é exigido** |
| `FALHA.PROJETO_DIVERGENTE` | existia | **não existe** |
| `esperado.projectId` em `interpretarResposta` | lido | **não é lido** |
| `json.user_id !== esperado.uid` | recusava | **recusa** |
| `sub`, `aud`, `iss`, `exp`, `motorDePartidas === true` | conferidos | **conferidos** |

A remoção **não foi substituída** por uma comparação contra o número. O campo
virou **informativo**: texto, número em texto, número JSON ou ausência — nada
decide.

### Por que remover não abre nada

| Quem guarda o quê | Onde |
|---|---|
| O projeto do refresh token bate com a API key | **o próprio endpoint** valida; um par incompatível volta como erro HTTP, que já recusa aqui |
| A **identidade** | `user_id` do envelope |
| O **projeto textual** | `aud` e `iss` do ID token — assinados **dentro** dele, e exatamente os campos que a Function verifica do outro lado |

Um envelope pode dizer qualquer coisa; o token, não. Guardar o projeto pelo
envelope era guardar pela metade mais fraca.

### Por que o campo deixou de ser exigido

Exigir a **forma** de um dado que não decide nada é mais um jeito de a credencial
inteira falhar fechada por causa de um campo que o servidor não lê. Se o endpoint
mudar `"12345"` para `12345`, ou parar de devolver o campo, nada quebra.

A documentação registra a decisão como **6** em
`docs/CREDENCIAL-RENOVAVEL-MOTOR-V1.md`.

---

## 3. Os casos novos — `CRED/CONTRATO`

**14 acrescentados, 1 removido.** O removido é o antigo `CRED-18`
("project_id divergente é recusado"), que afirmava um contrato inexistente.

### A fixture

`respostaOk()` passou a carregar a forma **medida**:
`project_id: "1234567890"`. Nenhum caso depende de ela coincidir com
`FIREBASE_PROJECT_ID`.

### Metade 1 — o envelope não decide projeto

| Caso | O que fixa |
|---|---|
| `CRED-18` | `project_id` numérico com `aud`/`iss` corretos é **aceito** — o caso que a V1 reprovava |
| `CRED-18b` | quatro números diferentes, todos aceitos |
| `CRED-18c` | `project_id` **textual** (a forma que a V1 supunha) também é aceito — a correção não trocou uma comparação por outra |
| `CRED-18d` | ausente, `null`, número JSON, `{}`, `[]` — nada derruba |
| `CRED-18e` | **rede estrutural**: a fonte não compara `json.project_id`, `FALHA.PROJETO_DIVERGENTE` não existe, e `interpretarResposta` não lê `projectId` |

`CRED-18e` é o que pega uma restauração escrita com **outro** código de falha.

### Metade 2 — o token decide, e continua estrito

| Caso | Barreira | Formas exercitadas |
|---|---|---|
| `CRED-18f` | `aud === FIREBASE_PROJECT_ID` | 5, inclusive o **número** do projeto e o id com espaço à direita |
| `CRED-18g` | `iss === https://securetoken.google.com/<id>` | 6, inclusive `http://` e barra final |
| `CRED-18h` | `sub === FIREBASE_MOTOR_UID` | 4 |
| `CRED-18i` | `user_id === FIREBASE_MOTOR_UID` | 3 |
| `CRED-18j` | `motorDePartidas === true`, estrito | **12**: ausente, `false`, `"true"`, `"TRUE"`, `"false"`, `1`, `"1"`, `0`, `"0"`, `null`, `{}`, `[]` |
| `CRED-18k` | expiração | token vencido com envelope impecável |
| `CRED-18l` | resposta sem ID token | 5 formas |
| `CRED-18m` | par projeto × API key incompatível | `PROJECT_NUMBER_MISMATCH`, `INVALID_REFRESH_TOKEN`, `PERMISSION_DENIED` — recusados pelo **status**, e o corpo **não** é propagado |
| `CRED-18n` | sigilo | **8** cenários de falha: nem mensagem, nem stack, nem `console` carregam refresh token, ID token ou API key |

`CRED-18m` é a defesa que a comparação do envelope **fingia** ser: o endpoint
valida o par e responde com **erro**, não com um `project_id` diferente.

### O que NÃO foi afrouxado

HTTPS, host fixo (`securetoken.googleapis.com`), caminho, `content-type`, método,
timeout finito, teto de 64 KB lido **em fluxo**, cache com margem de 5 min,
coalescência de chamadas simultâneas e descarte no erro: **intocados**, e todos
continuam com os casos da V1 passando.

---

## 4. Mutações — 7 no servidor, 7 detectadas

| # | Mutação | Caso derrubado | Total de falhas |
|---|---|---|---|
| 1 | restaurar `project_id === FIREBASE_PROJECT_ID` | `CRED-18`, `18b`, `18c`, `18d`, `18e` | **33** |
| 2 | aceitar `aud` incorreto | **`CRED-18f`**, `CRED-21` | 2 |
| 3 | aceitar `iss` incorreto | **`CRED-18g`**, `CRED-21` | 2 |
| 4 | aceitar UID divergente | **`CRED-18i`**, `CRED-17` | 2 |
| 5 | aceitar claim *truthy* (`!p[CLAIM]`) | **`CRED-18j`**, `CRED-20` | 2 |
| 6 | reutilizar token expirado | `CRED-11`, `12`, `12b`, `15`, `15b` | 5 |
| 7 | abrir segunda renovação concorrente | `CRED-13`, `14`, `14b` | 3 |

**A mutação 1 derruba 33 casos, e é isso que mede a correção da prova.** Na V1 ela
não derrubaria nenhum, porque a fixture carregava a suposição. A diferença entre
0 e 33 é o defeito de prova que a homologação apontou.

**A mutação 7 quase escapou por um erro do arnês.** `if (emVoo) return emVoo;`
aparece **duas** vezes no bundle — em `auth_firebase` e em `credencial_motor`. A
primeira tentativa mutou a ocorrência errada, a suíte ficou verde, e o relatório
teria dito "não detectado" sobre um mutante aplicado em outro módulo. O arnês
passou a exigir **escopo**, com o alvo aparecendo exatamente uma vez dentro do
módulo declarado, e o `numstat` de cada mutação foi conferido antes de creditar
qualquer veredito.

Todas revertidas. Árvore limpa.

---

## 5. Regressão

| | V1 | V2 |
|---|---|---|
| `test/credencial_motor.test.js` | 47 | **60** ✅ |
| As dez suítes anteriores | 181 | **181** ✅ |
| **`npm test`** | **228** | **241** ✅ |
| `npm start` | `node server.js` | idem |
| `package.json` | sem `dependencies` | **não está no delta** |

O falso positivo intermitente do UUID (§8 de
`docs/CREDENCIAL-RENOVAVEL-MOTOR-V1.md`) é **anterior** e alheio: `credencial_motor`
não usa `randomUUID` e ninguém o carrega (`CRED-34b`). Não apareceu nas execuções
desta correção.

---

## 6. O que continua sem prova

`aud`, `iss`, `sub` e a assinatura **RS256 com `kid`** são verificados **pela
Function** que recebe o token — Admin SDK, com `checkRevoked`. Este módulo faz
**sanidade local** e não verifica assinatura, de propósito (decisão 5): quem tem
autoridade sobre o token é quem o recebe, e uma verificação paralela criaria uma
segunda opinião sobre um token que não é nosso para julgar.

A **junta** entre os dois lados nunca foi exercitada. O emulador de Auth emite
token `{"alg":"none"}`, e um token assinado à mão mediria o nosso arnês, não o
contrato do Google. O **smoke com token real** continua obrigatório — está escrito
em `docs/CREDENCIAL-MOTOR-BOOTSTRAP-E-REVOGACAO-V1.md` §7.1, no repositório do
app.

E que `project_id` seja o número do projeto foi medido contra o **emulador**, não
contra o endpoint real. A correção é imune a isso: o campo deixou de decidir em
**qualquer** forma.

---

## 7. Veredito

| Critério | Resultado |
|---|---|
| O bloqueio do `project_id` morre | ✅ |
| Não foi substituído por comparação equivalente | ✅ `CRED-18c`, `CRED-18e` |
| As validações do ID token permanecem estritas | ✅ nove casos novos só para isso |
| Nada afrouxado (HTTPS, host, timeout, limite, cache, concorrência) | ✅ |
| Nenhuma dependência, nenhum Admin SDK, nenhuma service account | ✅ `CRED-33` |
| Todas as mutações detectadas | ✅ 7/7 aqui, 13/13 no total das duas metades |
| Sem regressão | ✅ 241/241 |

# `PASS` da correção

**Zero deploy. Zero ativação. Zero secret.** O módulo continua **não ligado a
nada**: `ws_server` não o carrega, a outbox está intocada, e `npm start` faz
exatamente o que fazia (`CRED-34b`, `CRED-34c`). A ativação depende de
re-homologação independente e de OS operacional.
