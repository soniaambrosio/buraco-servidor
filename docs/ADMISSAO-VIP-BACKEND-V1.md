# Composição gate VIP + credencial renovável, e o adaptador servidor → backend

Branch `integracao/gate-vip-credencial-backend-v1`.

| Entrada | Branch | SHA |
| --- | --- | --- |
| A — gate VIP | `claude/gate-autoritativo-entrada-vip-ranqueada-v1` | `504d68fe9eaa5af6d26c880e95fcf23b3bf553d8` |
| B — credencial | `claude/credencial-renovavel-motor-railway-v1` | `85d0eee5286fd1deba5c2ae85176b76e714e6690` |
| merge-base | `claude/versionamento-visao-autoritativa-v1` | `7e7572b3471bcec2a6968e6084f56dd407cef601` |

Diamante: as duas descendem de `7e7572b`, nenhuma contém a outra.

## A composição

Conflito **único**, e só de documentação: as duas folhas anexaram um bloco
"EXCEÇÃO DOCUMENTADA" na mesma âncora do cabeçalho. Resolvido preservando os
dois. Nenhuma linha de código esteve em conflito.

Os hunks **auto-mesclados** foram auditados fatia a fatia — merge limpo já
reintroduziu defeito neste repositório antes. Os doze módulos do bundle foram
comparados contra a folha de origem: `carta`, `canastra`, `bot`, `jogo`,
`bot_motor`, `contas`, `outbox`, `salas`, `auth_firebase`, `servidor` e
`ws_server` idênticos a A; `credencial_motor` idêntico a B.

Baselines: A = 222, B = 228, composição = **269** (= 222 + 228 − 181 da base
comum). Aditivo exato.

### O módulo novo mora ANTES da credencial, e isso não é estético

`test/credencial_motor.test.js` recorta o módulo por
`indexOf('__fabricas["credencial_motor"]')` até
`indexOf('__fabricas["servidor"]')`. Inserir `admissao_vip` entre os dois puxava
o módulo novo para dentro do recorte, e duas provas de B passavam a medir código
que não é delas (`CRED-32`, log; `CRED-33`, dependências). A ordem do registro
de módulos é irrelevante para `__require`, que é preguiçoso — então o módulo foi
posto **antes** de `credencial_motor`, e as provas de B voltaram a medir B.

## A API da credencial reutilizada

Nada foi recriado. O que a composição consome, e só isto:

```js
criarCredencialDoMotor({ env, pedirToken, agora, margemMs })
  → { obterIdToken(), estado(), configurada() }
```

`obterIdToken()` já traz cache com margem de 5 min, **coalescência** de chamadas
simultâneas (`emVoo` atribuído antes de qualquer `await`), rotação do refresh
token em memória e descarte do token na falha. Não há segundo cliente de
credencial, não há segunda política de cache e não há `firebase-admin`.

## O adaptador único

Módulo `admissao_vip`. Devolve a função que o gate injeta como porta:

```js
criarAdaptadorAdmissaoVip({ url, credencial, pedir, timeoutMs, registrar })
  → autorizarEntradaVip(contexto) | null
```

`null` quando não há endereço utilizável **ou** não há credencial — e `null` é
exatamente o estado que o gate já sabia tratar desde a OS 1: entrada VIP
recusada, antes da ocupação do assento. Devolver um adaptador que sempre falha
faria o mesmo por um caminho mais longo, e deixaria em pé a chance de alguém
interpretar a falha dele como transitória.

Ele **não** ocupa assento e **não** conhece assinatura, passe ou cortesia: ele
transporta a pergunta e lê a resposta.

## Contrato `admissao-vip-v1`

Requisição — exatamente estes oito campos, e o conjunto é fixado por teste:

```json
{
  "versaoContrato": "admissao-vip-v1",
  "uidAutenticado": "…",       // da autenticação, nunca do socket
  "codigoDaSala": "…",
  "identidadeDaPartida": null,  // partidaId, quando já existe
  "assento": 0,
  "categoriaCompetitiva": "vip_ranqueada",  // da sala imutável
  "tentativaEntradaId": "te_…", // cunhado pelo servidor
  "reconexao": false            // derivado da classificação do gate
}
```

Não viajam: `publicId`, apelido, avatar, moldura, e-mail, perfil. A credencial
vai em `authorization: Bearer`, **nunca** no corpo e **nunca** na query.

Resposta — só libera assento com **todas** as condições:

```
HTTP 200  ∧  JSON objeto  ∧  versaoContrato === "admissao-vip-v1"
          ∧  ok === true (estrito)  ∧  admissaoId string não vazia
```

## Política de falhas

| Resultado | Conduta |
| --- | --- |
| aprovação válida | ocupa o assento |
| negativa comercial (`ok:false`) | recusa, sem retry |
| credencial inválida/revogada | recusa — e **não chega a perguntar** ao backend |
| timeout · 429 · 5xx | recusa (temporária) |
| JSON inválido · versão desconhecida · `admissaoId` vazio | recusa |
| URL ausente/inválida | não existe adaptador → `ADMISSAO_VIP_INDISPONIVEL` |
| casual | não busca credencial, não chama backend |

**Sem retry no adaptador.** Uma tentativa produz no máximo uma chamada. A
recuperação é a da credencial canônica e só dela: repetir aqui seria uma segunda
política sobre a mesma falha, e as duas juntas multiplicariam a carga sobre um
backend que já está em 5xx.

O que chega ao cliente é sempre a mesma recusa redigida
(`ADMISSAO_VIP_INDISPONIVEL`, "entrada indisponível nesta mesa"): o motivo real,
a categoria, a classificação e o `tentativaEntradaId` não saem no fio.

## Os dois regimes da admissão

O gate da OS 1 era síncrono; um adaptador de rede não é. A saída **não** foi
tornar tudo assíncrono — isso custaria um microtask em toda entrada de mesa
casual, que é o caminho de todo mundo hoje, e transformaria em corrida silenciosa
metade das suítes deste repositório.

```
mesa casual         admitirNoAssento → decisão (valor)    → escreve, síncrono
mesa vip_ranqueada  admitirNoAssento → decisão (promessa) → escreve ao responder
```

`concluirAdmissao(admissao, escrever)` é o ponto único que converte decisão em
efeito nos dois regimes, e `escrever` só roda com decisão aprovada. A assimetria
é **por processo**, não por dado: um servidor roda mesas de uma categoria só,
fixada na construção.

### A janela que a assincronia abriu, e que foi fechada

Entre a pergunta e a resposta o jogador pode cair. Aplicar a entrada depois disso
deixaria um assento ocupado por uma conexão que não existe mais — uma mesa que
nunca mais enche. `aplicarEntrada` confere que a conexão ainda é a **mesma**
(`conexoes[id] !== c`, e não `!conexoes[id]`: um id pode ter sido reaproveitado)
e, se não for, chama `desfazerAdmissao`, que libera o assento — ou remove a sala,
quando quem caiu era o criador de uma mesa recém-criada. `desfazerAdmissao` só
libera: ele reaproveita `sair` e não abre nenhum caminho de ocupação novo.

## Idempotência

Chamadas **simultâneas** com a mesma `tentativaEntradaId` compartilham um voo —
o backend recebe uma pergunta só. Tentativas diferentes nunca compartilham.
`emVoo.set` acontece sincronamente, antes de qualquer ponto de suspensão, pela
mesma disciplina da credencial.

O adaptador **não cunha** identidade (não há `randomUUID` nem `Math.random` no
módulo) e não a reescreve: ela vem do gate inteira e viaja igual em toda
repetição técnica daquele voo. Depois que o voo assenta, a entrada sai do mapa —
uma repetição posterior é pergunta nova, que o backend deduplica pela mesma
chave. **Aqui se deduplica concorrência; lá se deduplica repetição.**

## Reconexão

O assento aprovado conserva o `admissaoId` internamente
(`sala.assentos[i].admissaoId`), e ele **não** aparece na visão de jogador nem na
de espectador. Cada identidade tem a sua admissão — não há caminho em que ela
viaje para outro uid. A classificação (`reconexao: true|false`) chega ao backend
derivada de quem já está sentado, nunca declarada pelo cliente.

Retomada de assento continua **não existindo**, e esta OS não a inventou.

## Testes

`test/admissao_vip.test.js` — 48 provas em cinco eixos (`END`, `CTR`, `FAL`,
`VOO`, `FIO`). Baseline integral da composição: **318/318**.

### Provas negativas (§13)

| # | Defeito injetado | Detectado | Quem pegou |
| - | --- | --- | --- |
| 1 | bypass do gate quando o backend falha | sim (1) | `FAL-14` |
| 2 | segundo cliente de credencial | sim (1) | `CRED-34b` |
| 3 | retry criando nova `tentativaEntradaId` | sim (2) | `FAL: timeout`, `FAL: conexão caída` |
| 4 | casual chamando backend | sim (1) | `FIO-06` |
| 5 | token aparecendo em log | sim (1) | `FIO-10` |
| 6 | `{ok:true}` sem `admissaoId` aceito | sim (2) | `CTR-05`, `FAL: admissaoId vazio` |
| 7 | voos de tentativas diferentes compartilhados | sim (7) | `VOO-02/03/04`, `FIO-02/04/05` |

**A prova 1 não foi detectada na primeira rodada, e isso valeu um teste novo.**
O ramo de promessa rejeitada do gate nunca era percorrido: o adaptador real
sempre *resolve*, inclusive na falha (`{ok:false}`). A guarda existia e ninguém
sabia se funcionava. `FAL-14` (porta que rejeita) e `FAL-15` (decisão rejeitada
não escreve assento) fecharam a lacuna, e a prova passou a ser detectada.

### Dois testes mudaram de afirmação — deliberadamente

Ambos afirmavam a **ausência** do que esta OS entrega. Nenhum foi apagado: os
dois foram reescritos para proteger o mesmo invariante no mundo novo.

* **`MESA-12`** (folha A) dizia "produção NÃO injeta adaptador". Agora injeta.
  Passou a afirmar que a autoridade vem da configuração do processo (categoria e
  URL do ambiente), que nenhuma URL de produção está embutida, e o fail-closed
  migrou para `MESA-13`: sem endereço, não nasce adaptador.
* **`CRED-34b`** (folha B) dizia "ninguém pode carregar o módulo ainda". Agora
  há um consumidor. Passou a afirmar que há **exatamente um** — a credencial é
  carregada e construída uma vez só, pelo bootstrap do transporte, e nenhum
  módulo do motor a conhece. É o mesmo perigo de sempre: duas credenciais teriam
  caches independentes e rotações concorrentes que se invalidam.

## Limites respeitados

Não foi tocado: Flutter, Functions, Rules, Firestore, endpoint real, assinatura
VIP, passe quinzenal, `playerEntitlements`, contrato de encerramento (segue em
`versaoContrato: 1`, sem categoria e sem `admissaoId`), secrets, Railway,
Firebase. Sem deploy, sem PR, sem merge em branch protegida. `main` intocada.
`npm start` continua `node server.js`, e o `package.json` continua sem
`dependencies`.

## Riscos residuais

1. **A folha B está atrás de uma correção que já existe.** `deed131`
   (`correcao/credencial-motor-secure-token-v2`) é descendente linear de
   `85d0eee` e traz `fix(credencial): o envelope do Secure Token nao decide
   projeto`: em `85d0eee`, `interpretarResposta` compara `json.project_id` com
   `FIREBASE_PROJECT_ID`, e a homologação mediu que aquele campo vem com o
   **número** do projeto — logo `obterIdToken()` lançaria `PROJETO_DIVERGENTE`
   em **toda** chamada real. A OS fixa `85d0eee` três vezes e manda não recriar,
   então foi ele o composto. Consequência prática hoje: nenhuma, porque nada é
   ativado e a entrada VIP falha fechada de qualquer forma. Consequência na
   ativação: o adaptador nunca obteria token. Remediação: mesclar `deed131` — é
   descendente de B, então o merge é trivial e sem conflito.
2. **Falso positivo intermitente na suíte do espectador.** Um id de carta
   (`c432`) colide por substring com um `eventoId` aleatório e derruba a
   varredura de vazamento. Já diagnosticado e corrigido em
   `correcao/teste-espectador-uuid-falso-positivo-v1` @ `fd99260` — terceira
   folha irmã de `7e7572b`, que nem A nem B contêm, e que esta OS não podia
   trazer. Reproduziu uma vez em ~15 execuções.
3. **O ramo de rejeição do despachante segue sem caminho de produção.**
   `concluirPortaDeMesa` trata rejeição, mas nem o gate nem o adaptador rejeitam
   hoje. `FAL-15` prova que a rejeição não escreve assento e que o tratador
   recusa; é guarda de último recurso, e está assumida como tal.
4. **`http://` é aceito em loopback.** Necessário para bancada local sem
   certificado. A exceção é por host, não por flag — mas um endpoint em
   `http://localhost` num container de produção passaria. Provisionar a URL real
   (fora do escopo desta OS) deve usar HTTPS.
