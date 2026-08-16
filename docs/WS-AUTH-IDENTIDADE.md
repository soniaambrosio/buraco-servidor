# Autenticação do handshake WebSocket e vinculação de identidade

Branch: `seguranca/ws-auth-identidade` · base `origin/main` @ `1828d42`
Estado: **sem merge, sem deploy, produção intocada.**

Fecha o P0 de identidade: o handshake WebSocket não autenticava ninguém e o
`jogadorId` usado pelo servidor era o que o cliente **dizia** ser.

Depois desta mudança vale a afirmação:

> O cliente pode dizer quem afirma ser; somente o servidor decide quem ele
> realmente é.

---

## 1. Auditoria — como era antes (base `1828d42`)

| # | Pergunta | O que foi encontrado |
|---|---|---|
| 1 | Onde o WebSocket é criado | `__fabricas["ws_server"]` → `iniciar()` → `http_server.on("upgrade", …)` |
| 2 | Como era o handshake | RFC 6455 puro: confere `Sec-WebSocket-Key`, devolve `101 Switching Protocols`. **Zero verificação de credencial.** Logo depois, `servidor.conectar(...)` já dava uma conexão utilizável |
| 3 | Onde entrava a identidade do cliente | `servidor.processar`: `criarMesa` e `entrarMesa` faziam `c.jogadorId = msg.jogadorId`; `perfil` e `definirAvatar` faziam `msg.jogadorId \|\| c.jogadorId` |
| 4 | Onde ficava armazenada | `conexoes[id].jogadorId`, campo comum e gravável |
| 5 | Quem confiava nela | cofre de contas (`contas.obterOuCriar`, `obter`, `posicaoNoRanking`, `definirAvatarFoto/Galeria`, `removerAvatar`), assento da sala (`sala.assentos[i].jogadorId`) e **a liquidação da partida** (`liquidar` credita moedas/XP por `jogadorId`) |
| 6 | Onde o app abre o WebSocket | `app/lib/services/online_service.dart` → `WebSocketChannel.connect('wss://buraco-servidor-production.up.railway.app')` |
| 7 | Como o app obtém identidade | `FirebaseAuth.instance.currentUser` (login Google já em produção). **Essa identidade nunca era enviada ao servidor** — o app mandava só `apelido` |
| 8 | Conexão / reconexão / retomada / fila / rodada / mesa | conexão em `_abrir()`; reconexão com backoff 2..12s em `_agendarReconexao()`; "retomada" é só um `entrarMesa` no mesmo código de mesa; fila de comandos é `_pendentes`, esvaziada logo após abrir; troca de rodada e saída/entrada são mensagens comuns |
| 9 | Firebase Admin no servidor | **não existe.** O repositório é Node puro, sem `node_modules`, sem `npm install` no deploy |
| 10 | Credenciais em runtime | só `PORT`, `PUBLIC_DIR`, `RESPIRO_MS`, `DADOS_DIR`. Nenhuma credencial |

### Achados adicionais da auditoria

- **`app.html` (cliente web no repo do servidor) inventa a identidade em
  `localStorage`**: `bmv_jogadorId = 'j-' + Date.now() + random`. Era literalmente
  uma identidade escolhida pelo navegador, e ela dirigia carteira, ranking,
  presentes e login diário.
- **O protocolo não tem `eventoId`, `versaoEstado`, janela de idempotência nem
  deduplicação.** A §15 da OS pede para preservar essa semântica; ela **não
  existe** nesta base e nada foi inventado. O que existe — a fila `_pendentes` do
  app e a reentrada por `entrarMesa` — foi preservado e passou a rodar só depois
  da autenticação.
- **O servidor não tem retomada de assento.** Quem cai vira bot e não reassume.
  Comportamento pré-existente, fora do escopo desta OS.
- `app.html` fala tipos (`listarAmigos`, `loginDiario`, `presente`, `missao`,
  `desafio`) que **não existem** no `servidor` desta base. Divergência
  pré-existente entre o cliente web e o servidor; não foi tocada.

---

## 2. Como é agora

```
                       upgrade HTTP
                            │
              Authorization: Bearer <ID Token>?
                     │                    │
                    sim                  não
                     │                    │
              AUTENTICANDO      CONECTADO_NAO_AUTENTICADO
                     │                    │
                     │       {tipo:"auth", token, protocolo}
                     │                    │
                     └────────┬───────────┘
                              │
                     protocolo >= 2?  ──não──> ATUALIZACAO_OBRIGATORIA
                              │                 + conexão fechada
                             sim
                              │
                    verificação criptográfica
                     │                    │
                  válido               inválido
                     │                    │
               AUTENTICADO        recusa genérica
          uid = payload.sub       + conexão fechada
       jogadorId = jogadorIdDoUid(uid)
       (ambos NÃO-GRAVÁVEIS na conexão)
       validade = exp do token
                     │
              (chegou o exp)
                     │
           CREDENCIAL_EXPIRADA ──token novo do MESMO uid──> AUTENTICADO
                     │
            (30s sem renovar)
                     │
             conexão encerrada
```

Enquanto não estiver `AUTENTICADO`, o único tipo aceito é `auth`. Mesa, jogada,
perfil, avatar, ranking, carteira, denúncia — tudo devolve
`{tipo:"erro", codigo:"NAO_AUTENTICADO"}` sem efeito colateral.

### Arquivos

| Arquivo | O quê |
|---|---|
| `server.js` → módulo novo `auth_firebase` | verificação do Firebase ID Token, sem dependências |
| `server.js` → módulo `servidor` | máquina de estados, identidade vinculada e imutável, fim da leitura de `msg.jogadorId` |
| `server.js` → módulo `ws_server` | credencial no upgrade HTTP + injeção do verificador real |
| `server.js` → fim do arquivo | fronteira de teste (`require` não abre porta) |
| `package.json` | scripts `test` e `check` |
| `test/*` | suítes novas |

Todos os trechos alterados no bundle estão marcados com `// [PATCH WS-AUTH]`.

---

## 3. Decisões

### 3.1 Fonte de identidade: Firebase ID Token

O app já autentica com Firebase Auth (Google Sign-In em produção), então o ID
Token é a credencial natural. **O uid é `payload.sub` do token verificado** —
nunca um campo da mensagem.

Não existia mecanismo servidor-side anterior a substituir: o servidor não tinha
autenticação nenhuma.

### 3.2 Verificação sem `firebase-admin`

O repositório é Node puro e o deploy roda `npm start` sem `npm install`. O
verificador é implementado com `node:crypto` + `node:https` e aplica o mesmo
conjunto de checagens do `verifyIdToken` do Admin SDK, menos revogação:

- `alg === "RS256"` e `kid` presente — `none`, `HS256` e outros são recusados
  (confusão de algoritmo);
- assinatura RSA-SHA256 conferida contra o certificado x509 **público** do Google
  correspondente ao `kid`, buscado de
  `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
  e cacheado respeitando o `max-age` da resposta;
- `aud === FIREBASE_PROJECT_ID`;
- `iss === https://securetoken.google.com/<FIREBASE_PROJECT_ID>`;
- `exp` no futuro, `iat`/`auth_time` não no futuro, tolerância de relógio 60s;
- `sub` string não vazia.

### 3.3 Transporte da credencial (§8)

Nunca em URL nem em query string. `req.url` não é lido para identidade em lugar
nenhum; um `?token=` é simplesmente ignorado.

Dois caminhos, ambos verificados pelo mesmo verificador:

1. **`Authorization: Bearer <token>` no upgrade HTTP** — fronteira preferida.
   Cliente nativo que consiga mandar cabeçalho no upgrade autentica antes de
   qualquer frame.
2. **`{tipo:"auth", token}` como primeira mensagem** — necessário porque a API
   `WebSocket` do navegador não permite cabeçalhos. É o caminho usado hoje pelo
   app Flutter (o `web_socket_channel` não expõe cabeçalhos de forma
   multiplataforma) e pelos clientes web.

### 3.4 UID × jogadorId do domínio (§12)

Hoje o cofre de contas é chaveado pelo próprio uid: `jogadorIdDoUid(uid) = uid`.
**A associação é decidida no servidor**, num único ponto injetável
(`opts.jogadorIdDoUid`), e nunca informada pelo cliente. Se um dia houver tabela
de perfis, troca-se só essa derivação.

#### Contas legadas `j-<random>` — CORTE LIMPO (decisão fechada)

As contas atuais estão chaveadas pelos `j-<random>` que os navegadores
inventaram em `localStorage`. Depois do deploy elas ficam **órfãs**: quem entrar
autenticado recebe conta nova sob o uid do Firebase.

**Decisão da Sônia: não haverá migração automática, e isso é definitivo.**

Nenhum mecanismo deste servidor aceita um `jogadorId` vindo do cliente para
transferir carteira, XP, ranking ou qualquer outro patrimônio para um uid. Não é
omissão — é a decisão.

O motivo é o mesmo desta OS inteira: o identificador legado nasceu em
`localStorage`, era escolhido pelo cliente e **não tem prova de posse**. Aceitá-lo
como fundamento de migração seria reabrir a impersonação exatamente na fronteira
que este trabalho fecha — bastaria dizer "eu sou o `j-abc123`" para herdar a
carteira de outra pessoa.

As contas atuais são de ambiente anterior ao lançamento público. Benefícios que
precisarem ser preservados serão concedidos depois, por mecanismo administrativo
confiável, fora do protocolo do cliente.

**Não implementar "migração por jogadorId" mesmo que alguém peça depois.**

### 3.5 Expiração do token durante a partida (§16)

**Token válido no handshake NÃO compra sessão eterna.** A validade da conexão é
o `exp` do token que a autenticou, e nada mais.

```
AUTENTICADO ──(chegou o exp)──> CREDENCIAL_EXPIRADA ──(token novo, MESMO uid)──> AUTENTICADO
                                        │
                                        └──(30s sem renovar, ou outro uid)──> conexão fechada
```

O que acontece exatamente ao cruzar o `exp`:

| | Antes do `exp` | Depois do `exp` |
|---|---|---|
| comando de jogador | executa | recusado, `CREDENCIAL_EXPIRADA` |
| `estado` (visão do assento) | recebe | **para de receber** |
| `fim` (resumo com moedas/XP) | recebe | **não recebe** |
| `auth` com token novo do mesmo uid | renova a validade | volta a `AUTENTICADO`, sem derrubar |
| `auth` com token de outro uid | conexão fechada | conexão fechada |
| nada, por 30s | — | conexão encerrada |

A expiração é aplicada por **duas** vias, de propósito: um agendador armado no
instante da autenticação (pega a conexão parada, que só recebe broadcast) e uma
conferência no ato de cada comando (pega o caso do timer atrasado — processo
suspenso, máquina hibernada).

**Por que renovar em vez de derrubar direto.** As duas saídas eram aceitáveis.
Derrubar a cada hora entregaria ao bot o assento de quem está numa partida longa
— o servidor não tem retomada de assento, quem cai vira bot e não reassume. A
renovação no mesmo socket evita esse dano sem afrouxar nada: durante a carência,
o único tipo aceito é `auth`, igual ao estado inicial, e a identidade continua
imutável (token de outro uid derruba a conexão).

Também vale, como antes: **toda conexão nova exige credencial válida**, inclusive
reconexão; token expirado não estabelece sessão nenhuma; e o app pede o token ao
Firebase SDK antes de cada tentativa de conexão.

Não há refresh periódico em conexão aberta — a renovação é **reativa**, disparada
pelo servidor quando a credencial vence, não um relógio do cliente.

### 3.6 Revogação (§17) — risco residual declarado

**Só assinatura, expiração, audience e issuer são verificados. Revogação NÃO.**

Checar token revogado exige credencial administrativa (ler o `validSince` do
usuário), o que traria service account para o runtime — exatamente o que a §18
manda evitar.

Risco aceito, explicitamente: **um ID Token já emitido continua sendo aceito até
expirar (Firebase: 1 hora) mesmo que a sessão seja revogada nesse intervalo.**
Desativar uma conta ou revogar as sessões dela não derruba na hora quem já está
com token na mão. Nenhuma cobertura maior do que essa está sendo alegada.

O que **não** faz parte deste risco: sessão sobrevivendo à expiração do token.
Isso está fechado — ver 3.5. O limite superior do estrago de uma credencial
comprometida é o `exp` dela, não a duração da conexão.

Se isso virar requisito, o caminho é adotar Firebase Admin com service account
por variável de ambiente — e aí a §18 precisa ser reaberta com a Sônia.

### 3.7 Fail closed (§9)

Não existe fallback e não existe modo legado:

- `criarServidor` sem `verificarToken` recusa **toda** autenticação (o padrão é
  recusar, não permitir);
- `FIREBASE_PROJECT_ID` ausente → nenhuma conexão autentica, e o servidor avisa
  no log ao subir;
- certificados do Google fora do ar → nenhuma conexão autentica;
- credencial recusada → conexão **fechada** (código 1008).

### 3.8 Logging (§19)

O token nunca é registrado, em nenhum caminho — nem inteiro, nem em pedaço, nem
o cabeçalho `Authorization`. O log de falha traz só o id da conexão e um código
seco (`EXPIRADO`, `ASSINATURA_INVALIDA`, …).

Ao cliente vai sempre a **mesma** resposta genérica,
`{tipo:"authFalhou", motivo:"credencial recusada"}`, para qualquer causa — há um
teste que prova que as recusas são indistinguíveis do lado de fora.

---

## 4. Variáveis de ambiente

| Nome | Obrigatória | O que é | Exemplo (placeholder) |
|---|---|---|---|
| `FIREBASE_PROJECT_ID` | **sim** | id do projeto Firebase que emite os ID Tokens. **Não é segredo** — é o mesmo id que já vai embutido no app | `meu-projeto-firebase` |

Nenhum segredo foi versionado e nenhum é necessário: verificar ID Token usa só
chave pública. Não existe service account, private key, token ou credencial
Railway neste repositório.

Nada foi alterado em produção nem no Railway.

---

## 5. Versionamento do protocolo e rollout (§20)

### 5.1 A ponte de versão

O protocolo de conexão passou a ter número:

| Versão | O que é |
|---|---|
| 1 | protocolo antigo, sem autenticação: identidade declarada pelo cliente |
| 2 | este: a conexão apresenta credencial e o servidor deriva a identidade |

`PROTOCOLO_MINIMO = 2`, e **não vai baixar**: aceitar 1 seria exatamente o
fallback que reabriria a confiança em `jogadorId` vindo do cliente.

O cliente declara a versão junto com a credencial — `{tipo:"auth", token,
protocolo:2}`, ou o cabeçalho `X-BMV-Protocolo: 2` no upgrade HTTP. O servidor
devolve a versão dele no `autenticado`.

**A checagem de versão acontece ANTES de olhar o token.** Duas razões: um cliente
velho não precisa nem ter credencial para receber uma resposta que ele consiga
explicar para a pessoa, e nenhum detalhe de autenticação vaza para ele.

### 5.2 Como cada combinação se comporta

| Situação | O que o servidor faz | O que a pessoa vê |
|---|---|---|
| app antigo (protocolo 1) manda comando sem autenticar | recusa com `codigo:"ATUALIZACAO_OBRIGATORIA"` + `protocoloMinimo`, **sem executar nada** | "atualize o aplicativo para continuar jogando online" |
| app manda `auth` com protocolo < 2 (ou sem o campo) | `{tipo:"atualizacaoObrigatoria"}` e fecha a conexão — **antes** de tocar no token | mesma mensagem |
| app novo × servidor antigo | o servidor antigo responde `"tipo desconhecido: auth"` | o app entra em `servidorDesatualizado`: "o servidor ainda não foi atualizado — tente de novo mais tarde" |
| app novo × servidor antigo **mudo** | — | o app desiste em 15s e tenta de novo pelo backoff, em vez de ficar pendurado |
| app novo × servidor novo | autentica | joga |

O ponto que resolve o pedido "cliente velho não opera anonimamente": um cliente
do protocolo 1 nunca manda `auth`. Esse é o assinatura dele. Por isso o primeiro
comando de jogador de uma conexão que **nunca tentou autenticar** leva
`ATUALIZACAO_OBRIGATORIA` em vez de um erro genérico — e nenhum comando executa.

**O que NÃO foi feito, e por quê.** Não existe modo em que o app novo consiga
jogar contra o servidor antigo. Qualquer ponte assim exigiria o app voltar a
declarar `jogadorId`, que é a vulnerabilidade sendo corrigida. O que dá para
garantir — e está garantido — é que o app **falhe de forma explícita e
diagnosticável** em vez de travar, e que volte a funcionar sozinho assim que o
servidor subir. Uma janela de indisponibilidade do online é inevitável; a
alternativa seria manter a falha de segurança aberta durante a janela.

### 5.3 Ordem segura de rollout

Nada disso foi feito nesta OS.

1. Configurar `FIREBASE_PROJECT_ID` no Railway. **Antes** de qualquer deploy —
   sem ele o servidor novo sobe recusando todo mundo.
2. Publicar o app novo nas lojas e esperar a adoção. Enquanto o servidor antigo
   estiver no ar, o app novo mostra "servidor em atualização" no online; o resto
   do app (jogo local, torneios, perfil) segue funcionando.
3. Implantar o servidor. A partir daqui: app novo joga; app antigo mostra
   "atualize o aplicativo" e **não consegue mais jogar anonimamente**.
4. Portar ou aposentar `app.html` / `mesa-online*.html`. Eles continuam no
   protocolo 1 e ficam sem online — não têm Firebase Auth. Trabalho próprio.

A janela entre 2 e 3 é a de indisponibilidade do online para quem já atualizou.
Quanto mais adoção antes do passo 3, menor o incômodo — mas **a segurança não
depende da ordem**: em qualquer momento depois do passo 3, ninguém joga sem
credencial verificada.

### 5.4 Efeito na integração com `enforcement/visao-espectador`

A ponte de versão **não muda a ordem recomendada** (autenticação → espectador).
Ela vive no preâmbulo de `processar`, antes do `switch`; `assistirMesa` entra
como mais um `case` e herda a fronteira de graça. Se o espectador entrasse
primeiro, `assistirMesa` seria um comando pré-autenticação e teria de ser
retrabalhado depois.

---

## 6. Relação com `enforcement/visao-espectador` (§25)

As duas branches continuam **separadas**. Nenhum merge foi feito.

Arquivos que as duas tocam:

| Arquivo | Espectador | Esta OS | Conflito |
|---|---|---|---|
| `server.js`, cabeçalho | bloco de exceção documentada | outro bloco de exceção | **textual**, trivial: manter os dois |
| `server.js`, módulo `servidor` | `assistirMesa`, `papelDe`, visão pública, `conexoes[id].assento` | `processar` ganha a fronteira de auth no topo, fim de `msg.jogadorId` | **real.** `assistirMesa` precisa passar a exigir autenticação, e a leitura de `jogadorId` dele precisa sair |
| `server.js`, fim do arquivo | fronteira de teste (`module.exports = { require: __require }`) | fronteira de teste **idêntica em efeito** | **textual**, resolve-se ficando com uma só |
| `package.json` | scripts `test`/`check` | scripts `test`/`check` idênticos | nenhum de fato |
| `test/` | `ajuda.js`, `espectador.test.js`, `regressao.test.js`, `ws.test.js` | `ajuda_auth.js`, `auth_token.test.js`, `ws_auth.test.js`, `regressao_auth.test.js` | **nenhum**: nomes distintos |

**Ordem recomendada de integração: autenticação primeiro, espectador depois.**
A autenticação muda a fronteira de entrada de todo comando; integrar o
espectador em cima dela é uma adaptação pequena (fazer `assistirMesa` respeitar
o estado de auth e derivar identidade da conexão). Na ordem inversa, o
`assistirMesa` entraria como um comando pré-autenticação e precisaria ser
retrabalhado de novo.

Nada do enforcement de espectador foi copiado, adaptado ou antecipado aqui.

---

## 7. O que NÃO foi tocado (§24)

Regra do Buraco, pontuação, baralho, ranking, economia, preços, Billing,
entitlement VIP, moderação, política de espectador, UI sem relação com
autenticação, infraestrutura de deploy. A suíte `test/regressao_auth.test.js`
existe para provar isso: mesa, distribuição, visão por assento, ritmo dos bots,
AFK, saída, queda, perfil, ranking e encerramento continuam iguais — só que a
partir de uma conexão que provou quem é.
