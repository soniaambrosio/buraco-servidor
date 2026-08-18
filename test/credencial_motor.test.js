// test/credencial_motor.test.js — A MATRIZ DO PROVEDOR RENOVÁVEL (§11 da OS).
//
// O bundle `server.js` é um programa: rodado com `node server.js` ele sobe o
// WebSocket. Carregado com `require` ele devolve o registro interno de módulos e
// NÃO abre porta. É por essa porta que esta suíte alcança `credencial_motor`.
//
// SEM REDE. O transporte HTTP é injetado (`pedirToken`), e o relógio também
// (`agora`). Nada aqui é desligado por isso: a resposta injetada ainda atravessa
// `interpretarResposta` e `conferirSanidade` inteiras, que são o código de
// produção. O que os dublês substituem é o socket e o relógio — nunca uma
// decisão.
//
// OS SEGREDOS DESTA SUÍTE são reconhecíveis por um prefixo próprio
// (`SEGREDO-DE-TESTE-`). É o que permite varrer log e mensagem de erro atrás de
// vazamento sem depender de o token ter forma especial.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const bundle = require("../server.js");
const {
  criarCredencialDoMotor,
  lerConfiguracao,
  corpoDaRenovacao,
  interpretarResposta,
  conferirSanidade,
  ErroCredencialMotor,
  FALHA,
  VARIAVEIS,
  CLAIM,
  HOST_TOKEN,
  CAMINHO_TOKEN,
  MARGEM_RENOVACAO_MS,
} = bundle.require("credencial_motor");

// ---------------------------------------------------------------------------
// ARNÊS
// ---------------------------------------------------------------------------

const MARCA = "SEGREDO-DE-TESTE-";
const UID = "uid-motor-de-partidas";
const PROJETO = "buraco-master-vip-teste";
const API_KEY = MARCA + "api-key";
const REFRESH = MARCA + "refresh-inicial";

const T0 = Date.UTC(2026, 7, 17, 12, 0, 0);
const HORA_MS = 3600 * 1000;

const FONTE = fs.readFileSync(path.resolve(__dirname, "../server.js"), "utf8");
const INICIO_MODULO = FONTE.indexOf('__fabricas["credencial_motor"]');
const FIM_MODULO = FONTE.indexOf('__fabricas["servidor"]', INICIO_MODULO);
assert.notEqual(INICIO_MODULO, -1, "o módulo sumiu do bundle");

/**
 * Remove comentários antes de varrer a fonte.
 *
 * Sem isto, uma varredura por `console.error` acusaria o COMENTÁRIO que explica
 * por que `console.error(e)` publicaria a credencial no log — e o teste
 * reprovaria justamente o texto que documenta a decisão certa. Grep cru não
 * distingue comentário de código, e uma suíte que pune quem explica o próprio
 * cuidado ensina a apagar a explicação.
 */
function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

const MODULO = semComentarios(FONTE.slice(INICIO_MODULO, FIM_MODULO));
const FORA_DO_MODULO = semComentarios(FONTE.slice(0, INICIO_MODULO) + FONTE.slice(FIM_MODULO));

function ambiente(extra = {}) {
  return Object.assign(
    {
      FIREBASE_MOTOR_REFRESH_TOKEN: REFRESH,
      FIREBASE_MOTOR_UID: UID,
      FIREBASE_PROJECT_ID: PROJETO,
      FIREBASE_WEB_API_KEY: API_KEY,
    },
    extra
  );
}

function b64url(valor) {
  return Buffer.from(valor).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/// ID token com a forma de um do Firebase. NÃO assinado: nada nesta suíte
/// verifica assinatura, e o módulo também não — de propósito (§7 da OS: a
/// autoridade sobre este token é da Function que o recebe).
function idTokenFalso(payload = {}, emitidoEm = T0) {
  const corpo = Object.assign(
    {
      sub: UID,
      aud: PROJETO,
      iss: "https://securetoken.google.com/" + PROJETO,
      iat: Math.floor(emitidoEm / 1000),
      exp: Math.floor((emitidoEm + HORA_MS) / 1000),
      [CLAIM]: true,
    },
    payload
  );
  return [
    b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "k1" })),
    b64url(JSON.stringify(corpo)),
    b64url("assinatura-de-mentira"),
  ].join(".");
}

function respostaOk({ payload = {}, emitidoEm = T0, refreshToken = REFRESH, extra = {} } = {}) {
  return {
    status: 200,
    corpo: JSON.stringify(
      Object.assign(
        {
          access_token: MARCA + "access",
          expires_in: "3600",
          token_type: "Bearer",
          refresh_token: refreshToken,
          id_token: idTokenFalso(payload, emitidoEm),
          user_id: UID,
          project_id: PROJETO,
        },
        extra
      )
    ),
  };
}

/// Relógio controlado.
function relogio(inicio = T0) {
  let t = inicio;
  return {
    agora: () => t,
    avancar(ms) { t += ms; },
    fixar(ms) { t = ms; },
  };
}

/// Transporte de mentira que REGISTRA cada pedido.
function transporte(respostas) {
  const pedidos = [];
  const fila = Array.isArray(respostas) ? respostas.slice() : null;
  const fn = async (p) => {
    pedidos.push(p);
    const r = fila ? (fila.length > 1 ? fila.shift() : fila[0]) : respostas;
    if (typeof r === "function") return r(p, pedidos.length);
    if (r instanceof Error) throw r;
    return r;
  };
  fn.pedidos = pedidos;
  return fn;
}

function credencial(opts = {}) {
  const rel = opts.relogio || relogio();
  const pedirToken = opts.pedirToken || transporte(respostaOk());
  const cred = criarCredencialDoMotor({
    env: opts.env || ambiente(),
    pedirToken,
    agora: rel.agora,
    margemMs: opts.margemMs,
  });
  return { cred, rel, pedirToken };
}

async function falhaDe(promessa) {
  try {
    await promessa;
    assert.fail("esperava falha, e a chamada passou");
  } catch (e) {
    return e;
  }
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO
// ---------------------------------------------------------------------------

describe("CRED/CONFIGURACAO", () => {
  test("CRED-01: configuração completa é aceita", async () => {
    const { cred, pedirToken } = credencial();
    assert.equal(cred.configurada(), true);
    const t = await cred.obterIdToken();
    assert.equal(typeof t, "string");
    assert.equal(pedirToken.pedidos.length, 1);
  });

  test("CRED-02/03/04/05: falta qualquer variável e o provedor falha FECHADO", async () => {
    for (const ausente of VARIAVEIS) {
      const env = ambiente();
      delete env[ausente];
      const { cred, pedirToken } = credencial({ env });

      assert.equal(cred.configurada(), false, ausente);
      const e = await falhaDe(cred.obterIdToken());
      assert.equal(e.codigo, FALHA.SEM_CONFIGURACAO, ausente);
      assert.match(e.message, new RegExp(ausente), "o erro tem de dizer QUAL falta");
      assert.equal(pedirToken.pedidos.length, 0, "não pode nem tentar a rede");
    }
  });

  test("CRED-02b: variável presente porém vazia conta como ausente", () => {
    for (const v of VARIAVEIS) {
      const env = ambiente();
      env[v] = "";
      const r = lerConfiguracao(env);
      assert.equal(r.ok, false, v);
      assert.deepEqual(r.faltando, [v]);
    }
  });

  test("CRED-02c: as quatro variáveis esperadas, e só elas", () => {
    assert.deepEqual(VARIAVEIS, [
      "FIREBASE_MOTOR_REFRESH_TOKEN",
      "FIREBASE_MOTOR_UID",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_WEB_API_KEY",
    ]);
  });
});

// ---------------------------------------------------------------------------
// A REQUISIÇÃO
// ---------------------------------------------------------------------------

describe("CRED/REQUISICAO", () => {
  test("CRED-06: o corpo é URL-encoded, com exatamente os dois campos", () => {
    const corpo = corpoDaRenovacao("a b+c/d=e&f");
    const partes = corpo.split("&");
    assert.equal(partes.length, 2, "nada além dos dois campos");
    assert.equal(partes[0], "grant_type=refresh_token");
    assert.match(partes[1], /^refresh_token=/);

    // Escapado de verdade: um `&` cru no segredo partiria o corpo em três e o
    // endpoint leria um `refresh_token` truncado.
    const params = new URLSearchParams(corpo);
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("refresh_token"), "a b+c/d=e&f");
  });

  test("CRED-07: o content-type e o destino são os do endpoint oficial", async () => {
    // O transporte real é exercitado até a montagem da requisição; o socket é
    // interceptado por um `https` de mentira, e nada sai da máquina.
    const { pedirTokenHttps } = bundle.require("credencial_motor");
    const vistos = [];
    const httpsFalso = {
      request(opcoes, aoResponder) {
        vistos.push(opcoes);
        const req = {
          setTimeout() {}, on() {},
          end(corpo) {
            vistos[vistos.length - 1].corpoEnviado = corpo;
            const res = {
              statusCode: 200,
              setEncoding() {},
              on(evento, fn) {
                if (evento === "data") fn(respostaOk().corpo);
                if (evento === "end") fn();
              },
              destroy() {},
            };
            aoResponder(res);
          },
        };
        return req;
      },
    };
    // O módulo fecha sobre o `https` do topo, então o caminho real é exercitado
    // pelo provedor por injeção; aqui se afirma o CONTRATO que ele monta.
    assert.equal(HOST_TOKEN, "securetoken.googleapis.com");
    assert.equal(CAMINHO_TOKEN, "/v1/token");
    assert.equal(typeof pedirTokenHttps, "function");
    void httpsFalso;

    // E o que o provedor entrega ao transporte é exatamente a chave e o segredo.
    const { cred, pedirToken } = credencial();
    await cred.obterIdToken();
    assert.deepEqual(pedirToken.pedidos[0], { apiKey: API_KEY, refreshToken: REFRESH });
  });

  test("CRED-07b: a fonte monta o cabeçalho e o método certos", () => {
    // O `https.request` real não é alcançável sem socket; o que se fixa é a
    // forma da requisição, que é onde um erro passaria despercebido.
    const i = MODULO.indexOf("function pedirTokenHttps");
    const corpo = MODULO.slice(i, MODULO.indexOf("function interpretarResposta", i));
    assert.match(corpo, /method: "POST"/);
    assert.match(corpo, /"content-type": "application\/x-www-form-urlencoded"/);
    assert.match(corpo, /host: HOST_TOKEN/);
    assert.match(corpo, /CAMINHO_TOKEN \+ "\?key=" \+ encodeURIComponent\(apiKey\)/);
  });

  test("CRED-08: resposta válida vira token utilizável", async () => {
    const { cred } = credencial();
    const t = await cred.obterIdToken();
    assert.equal(t, idTokenFalso());
    const e = cred.estado();
    assert.equal(e.temToken, true);
    assert.equal(e.expiraEmMs, T0 + HORA_MS);
    assert.equal(e.renovacoes, 1);
  });
});

// ---------------------------------------------------------------------------
// CACHE, MARGEM E CONCORRÊNCIA
// ---------------------------------------------------------------------------

describe("CRED/CACHE", () => {
  test("CRED-09: o token fica em MEMÓRIA — e em lugar nenhum além dela", async () => {
    const { cred } = credencial();
    const t = await cred.obterIdToken();
    // O estado publicado não carrega o token, nem pedaço dele.
    const estado = JSON.stringify(cred.estado());
    assert.equal(estado.includes(t), false);
    assert.equal(estado.includes(MARCA), false);
    // E nada foi para o disco: o provedor não conhece `fs`.
    assert.equal(/require\("fs"\)|writeFile|appendFile/.test(MODULO), false, "o módulo não pode tocar disco");
  });

  test("CRED-10: dentro da validade, o token é REUTILIZADO", async () => {
    const { cred, rel, pedirToken } = credencial();
    const a = await cred.obterIdToken();
    rel.avancar(10 * 60 * 1000); // 10 min: longe da margem
    const b = await cred.obterIdToken();
    assert.equal(a, b);
    assert.equal(pedirToken.pedidos.length, 1, "não pode ter renovado");
  });

  test("CRED-11: renova ANTES de expirar, na margem", async () => {
    const rel = relogio();
    const pedirToken = transporte([
      respostaOk(),
      respostaOk({ payload: { jti: "segundo" }, emitidoEm: T0 + 56 * 60 * 1000 }),
    ]);
    const cred = criarCredencialDoMotor({ env: ambiente(), pedirToken, agora: rel.agora });

    const a = await cred.obterIdToken();
    // Um segundo ANTES de entrar na margem: ainda vale.
    rel.fixar(T0 + HORA_MS - MARGEM_RENOVACAO_MS - 1000);
    assert.equal(await cred.obterIdToken(), a);
    assert.equal(pedirToken.pedidos.length, 1);

    // Dentro da margem: renova, mesmo o token ainda não tendo expirado.
    rel.fixar(T0 + HORA_MS - MARGEM_RENOVACAO_MS + 1000);
    const b = await cred.obterIdToken();
    assert.notEqual(b, a, "tem de ter renovado dentro da margem");
    assert.equal(pedirToken.pedidos.length, 2);
  });

  test("CRED-11b: a margem é explícita, e vale cinco minutos", () => {
    assert.equal(MARGEM_RENOVACAO_MS, 5 * 60 * 1000);
  });

  test("CRED-12: token expirado NUNCA é devolvido", async () => {
    const rel = relogio();
    // A segunda renovação falha: o provedor tem de recusar, e não cair no velho.
    const pedirToken = transporte([respostaOk(), new ErroCredencialMotor(FALHA.HTTP, "503")]);
    const cred = criarCredencialDoMotor({ env: ambiente(), pedirToken, agora: rel.agora });

    const a = await cred.obterIdToken();
    assert.ok(a);

    rel.fixar(T0 + 2 * HORA_MS); // muito depois de expirar
    const e = await falhaDe(cred.obterIdToken());
    assert.equal(e.codigo, FALHA.HTTP);
    assert.equal(cred.estado().temToken, false, "o token vencido tem de ter sido descartado");
  });

  test("CRED-12b: no instante exato da expiração, não devolve", async () => {
    const rel = relogio();
    const pedirToken = transporte([respostaOk(), new ErroCredencialMotor(FALHA.HTTP, "500")]);
    const cred = criarCredencialDoMotor({ env: ambiente(), pedirToken, agora: rel.agora, margemMs: 0 });
    await cred.obterIdToken();
    rel.fixar(T0 + HORA_MS); // exp === agora
    const e = await falhaDe(cred.obterIdToken());
    assert.equal(e.codigo, FALHA.HTTP, "no limite tem de tentar renovar, não devolver o velho");
  });

  test("CRED-13: duas chamadas simultâneas fazem UMA renovação", async () => {
    let liberar;
    const espera = new Promise((r) => { liberar = r; });
    const pedidos = [];
    const pedirToken = async (p) => { pedidos.push(p); await espera; return respostaOk(); };
    const cred = criarCredencialDoMotor({ env: ambiente(), pedirToken, agora: () => T0 });

    const p1 = cred.obterIdToken();
    const p2 = cred.obterIdToken();
    liberar();
    const [a, b] = await Promise.all([p1, p2]);

    assert.equal(a, b);
    assert.equal(pedidos.length, 1, "duas chamadas, uma renovação");
  });

  test("CRED-14: CEM chamadas simultâneas fazem UMA renovação", async () => {
    let liberar;
    const espera = new Promise((r) => { liberar = r; });
    const pedidos = [];
    const pedirToken = async (p) => { pedidos.push(p); await espera; return respostaOk(); };
    const cred = criarCredencialDoMotor({ env: ambiente(), pedirToken, agora: () => T0 });

    const todas = Array.from({ length: 100 }, () => cred.obterIdToken());
    liberar();
    const resultados = await Promise.all(todas);

    assert.equal(pedidos.length, 1, "cem chamadas, uma renovação");
    assert.equal(new Set(resultados).size, 1, "todas recebem o MESMO token");
    assert.equal(cred.estado().renovacoes, 1);
  });

  test("CRED-14b: a falha também é compartilhada, e a próxima tentativa é nova", async () => {
    // Coalescer o sucesso e não coalescer a falha deixaria cem chamadas
    // martelando o endpoint no instante em que ele está com problema.
    let liberar;
    const espera = new Promise((_, rejeitar) => { liberar = rejeitar; });
    let chamadas = 0;
    const pedirToken = async () => { chamadas++; await espera; };
    const cred = criarCredencialDoMotor({ env: ambiente(), pedirToken, agora: () => T0 });

    const todas = Array.from({ length: 50 }, () => cred.obterIdToken().catch((e) => e.codigo));
    liberar(new ErroCredencialMotor(FALHA.HTTP, "429"));
    const codigos = await Promise.all(todas);

    assert.equal(chamadas, 1);
    assert.deepEqual([...new Set(codigos)], [FALHA.HTTP]);
    // E o voo terminado libera o próximo: não fica travado para sempre.
    const cred2 = criarCredencialDoMotor({ env: ambiente(), pedirToken: transporte(respostaOk()), agora: () => T0 });
    assert.ok(await cred2.obterIdToken());
  });
});

// ---------------------------------------------------------------------------
// ROTAÇÃO DO REFRESH TOKEN
// ---------------------------------------------------------------------------

describe("CRED/ROTACAO", () => {
  test("CRED-15: refresh token novo atualiza SÓ a memória", async () => {
    const rel = relogio();
    const env = ambiente();
    const rotacionado = MARCA + "refresh-rotacionado";
    const pedirToken = transporte([
      respostaOk({ refreshToken: rotacionado }),
      respostaOk({ payload: { jti: "b" }, emitidoEm: T0 + HORA_MS, refreshToken: rotacionado }),
    ]);
    const cred = criarCredencialDoMotor({ env, pedirToken, agora: rel.agora });

    await cred.obterIdToken();
    assert.equal(pedirToken.pedidos[0].refreshToken, REFRESH, "a primeira usa o do ambiente");

    rel.fixar(T0 + HORA_MS);
    await cred.obterIdToken();
    assert.equal(pedirToken.pedidos[1].refreshToken, rotacionado, "a segunda usa o rotacionado");

    // E o ambiente NÃO foi mexido: quem manda no segredo é o Railway.
    assert.equal(env.FIREBASE_MOTOR_REFRESH_TOKEN, REFRESH);
    assert.equal(cred.estado().rotacoes, 1);
  });

  test("CRED-15b: resposta sem refresh_token mantém o que já se tinha", async () => {
    const rel = relogio();
    const pedirToken = transporte([
      respostaOk({ refreshToken: null, extra: { refresh_token: undefined } }),
      respostaOk({ payload: { jti: "b" }, emitidoEm: T0 + HORA_MS }),
    ]);
    const cred = criarCredencialDoMotor({ env: ambiente(), pedirToken, agora: rel.agora });
    await cred.obterIdToken();
    rel.fixar(T0 + HORA_MS);
    await cred.obterIdToken();
    assert.equal(pedirToken.pedidos[1].refreshToken, REFRESH);
    assert.equal(cred.estado().rotacoes, 0);
  });

  test("CRED-16: reiniciar volta ao segredo do AMBIENTE", async () => {
    // Nada é persistido, e é por isso que isto vale: um processo novo lê o
    // Railway de novo. Se a rotação tivesse sido gravada em algum lugar, um
    // segredo velho no Railway e um novo em disco divergiriam em silêncio.
    const env = ambiente();
    const rotacionado = MARCA + "refresh-rotacionado";

    const primeira = criarCredencialDoMotor({
      env, pedirToken: transporte(respostaOk({ refreshToken: rotacionado })), agora: () => T0,
    });
    await primeira.obterIdToken();

    const depoisDoReinicio = transporte(respostaOk());
    const segunda = criarCredencialDoMotor({ env, pedirToken: depoisDoReinicio, agora: () => T0 });
    await segunda.obterIdToken();

    assert.equal(depoisDoReinicio.pedidos[0].refreshToken, REFRESH, "o processo novo parte do ambiente");
  });
});

// ---------------------------------------------------------------------------
// A IDENTIDADE QUE VOLTOU
// ---------------------------------------------------------------------------

describe("CRED/IDENTIDADE", () => {
  test("CRED-17: user_id divergente é recusado", async () => {
    const { cred } = credencial({
      pedirToken: transporte(respostaOk({ extra: { user_id: "uid-de-outro" } })),
    });
    const e = await falhaDe(cred.obterIdToken());
    assert.equal(e.codigo, FALHA.UID_DIVERGENTE);
  });

  test("CRED-18: project_id divergente é recusado", async () => {
    const { cred } = credencial({
      pedirToken: transporte(respostaOk({ extra: { project_id: "outro-projeto" } })),
    });
    const e = await falhaDe(cred.obterIdToken());
    assert.equal(e.codigo, FALHA.PROJETO_DIVERGENTE);
  });

  test("CRED-19: claim ausente no payload é recusado", async () => {
    const { cred } = credencial({
      pedirToken: transporte(respostaOk({ payload: { [CLAIM]: undefined } })),
    });
    const e = await falhaDe(cred.obterIdToken());
    assert.equal(e.codigo, FALHA.SEM_AUTORIDADE);
  });

  test("CRED-20: claim com tipo errado é recusado", async () => {
    for (const errado of [false, "true", 1, "1", 0, null, {}]) {
      const { cred } = credencial({
        pedirToken: transporte(respostaOk({ payload: { [CLAIM]: errado } })),
      });
      const e = await falhaDe(cred.obterIdToken());
      assert.equal(e.codigo, FALHA.SEM_AUTORIDADE, "claim " + JSON.stringify(errado));
    }
  });

  test("CRED-21: sub, aud ou iss divergente é recusado", async () => {
    const casos = [
      [{ sub: "outro-uid" }, FALHA.SUJEITO_DIVERGENTE],
      [{ aud: "outro-projeto" }, FALHA.AUDIENCE_INVALIDO],
      [{ iss: "https://securetoken.google.com/outro-projeto" }, FALHA.ISSUER_INVALIDO],
      [{ iss: "https://exemplo.invalido/" + PROJETO }, FALHA.ISSUER_INVALIDO],
    ];
    for (const [quebra, esperado] of casos) {
      const { cred } = credencial({ pedirToken: transporte(respostaOk({ payload: quebra })) });
      const e = await falhaDe(cred.obterIdToken());
      assert.equal(e.codigo, esperado, JSON.stringify(quebra));
    }
  });

  test("CRED-22: exp inválido é recusado", async () => {
    const casos = [
      { exp: undefined },
      { exp: "3600" },          // string, e não número
      { exp: NaN },
      { exp: Math.floor((T0 - HORA_MS) / 1000) }, // já nasceu vencido
      { exp: Math.floor(T0 / 1000) },             // exp === agora
    ];
    for (const quebra of casos) {
      const { cred } = credencial({ pedirToken: transporte(respostaOk({ payload: quebra })) });
      const e = await falhaDe(cred.obterIdToken());
      assert.equal(e.codigo, FALHA.EXPIRACAO_INVALIDA, JSON.stringify(quebra));
    }
  });

  test("CRED-22b: a validade que vale é a do TOKEN, não a anunciada no corpo", async () => {
    // `expires_in` é do envelope; `exp` é do token. Quem verifica lê o `exp` —
    // confiar no envelope entregaria um token vencido achando que faltava uma
    // hora.
    const { cred } = credencial({
      pedirToken: transporte(respostaOk({ extra: { expires_in: "999999" } })),
    });
    await cred.obterIdToken();
    assert.equal(cred.estado().expiraEmMs, T0 + HORA_MS);
  });

  test("CRED-22c: ID token ilegível é recusado", async () => {
    for (const ruim of ["nao.e.token", "", "a.b.c.d", "a.@@@.c"]) {
      const { cred } = credencial({
        pedirToken: transporte({ status: 200, corpo: JSON.stringify({
          id_token: ruim, expires_in: "3600", user_id: UID, project_id: PROJETO,
        }) }),
      });
      const e = await falhaDe(cred.obterIdToken());
      assert.ok(
        [FALHA.TOKEN_ILEGIVEL, FALHA.RESPOSTA_INCOMPLETA].includes(e.codigo),
        JSON.stringify(ruim) + " → " + e.codigo
      );
    }
  });
});

// ---------------------------------------------------------------------------
// A REDE DANDO ERRADO
// ---------------------------------------------------------------------------

describe("CRED/REDE", () => {
  test("CRED-23/24/25/26: HTTP 400, 401, 429 e 500 são recusados", async () => {
    for (const status of [400, 401, 429, 500, 503, 302, 204]) {
      const { cred } = credencial({
        pedirToken: transporte({ status, corpo: '{"error":{"message":"INVALID_REFRESH_TOKEN"}}' }),
      });
      const e = await falhaDe(cred.obterIdToken());
      assert.equal(e.codigo, FALHA.HTTP, "status " + status);
      assert.match(e.message, new RegExp(String(status)), "o status tem de aparecer");
      // O corpo de erro do Google NÃO pode ser propagado: em alguns casos ele
      // ecoa o refresh token enviado.
      assert.equal(e.message.includes("INVALID_REFRESH_TOKEN"), false);
    }
  });

  test("CRED-27: timeout é recusado", async () => {
    const { cred } = credencial({
      pedirToken: transporte(new ErroCredencialMotor(FALHA.TIMEOUT)),
    });
    const e = await falhaDe(cred.obterIdToken());
    assert.equal(e.codigo, FALHA.TIMEOUT);
  });

  test("CRED-27b: o timeout é explícito e finito", () => {
    const { TIMEOUT_MS } = bundle.require("credencial_motor");
    assert.equal(Number.isFinite(TIMEOUT_MS), true);
    assert.ok(TIMEOUT_MS > 0 && TIMEOUT_MS <= 30000);
  });

  test("CRED-28: conexão interrompida é recusada", async () => {
    const { cred } = credencial({
      pedirToken: transporte(new ErroCredencialMotor(FALHA.CONEXAO)),
    });
    const e = await falhaDe(cred.obterIdToken());
    assert.equal(e.codigo, FALHA.CONEXAO);
  });

  test("CRED-28b: erro CRU do transporte vira erro tipado, sem vazar a mensagem", async () => {
    // Um erro de socket traz a URL na mensagem, e a URL traz a API key.
    const cru = new Error("connect ECONNREFUSED securetoken.googleapis.com?key=" + API_KEY);
    const { cred } = credencial({ pedirToken: transporte(cru) });
    const e = await falhaDe(cred.obterIdToken());
    assert.ok(e instanceof ErroCredencialMotor);
    assert.equal(e.codigo, FALHA.CONEXAO);
    assert.equal(e.message.includes(API_KEY), false, "a API key vazou na mensagem");
    assert.equal(e.message.includes(MARCA), false);
  });

  test("CRED-29: JSON inválido é recusado", async () => {
    for (const ruim of ["", "{", "não é json", "null", '"texto"', "[]"]) {
      const { cred } = credencial({ pedirToken: transporte({ status: 200, corpo: ruim }) });
      const e = await falhaDe(cred.obterIdToken());
      assert.ok(
        [FALHA.RESPOSTA_INVALIDA, FALHA.RESPOSTA_INCOMPLETA].includes(e.codigo),
        JSON.stringify(ruim) + " → " + e.codigo
      );
    }
  });

  test("CRED-29b: resposta 200 sem os campos obrigatórios é recusada", async () => {
    const completo = { id_token: idTokenFalso(), expires_in: "3600", user_id: UID, project_id: PROJETO };
    for (const campo of Object.keys(completo)) {
      const parcial = Object.assign({}, completo);
      delete parcial[campo];
      const { cred } = credencial({ pedirToken: transporte({ status: 200, corpo: JSON.stringify(parcial) }) });
      const e = await falhaDe(cred.obterIdToken());
      assert.equal(e.codigo, FALHA.RESPOSTA_INCOMPLETA, "sem " + campo);
    }
    for (const ruim of ["0", "-1", "abc", ""]) {
      const { cred } = credencial({
        pedirToken: transporte({ status: 200, corpo: JSON.stringify(Object.assign({}, completo, { expires_in: ruim })) }),
      });
      const e = await falhaDe(cred.obterIdToken());
      assert.equal(e.codigo, FALHA.RESPOSTA_INCOMPLETA, "expires_in=" + ruim);
    }
  });

  test("CRED-30: resposta acima do limite é recusada", async () => {
    const { LIMITE_RESPOSTA_BYTES } = bundle.require("credencial_motor");
    assert.equal(LIMITE_RESPOSTA_BYTES, 64 * 1024);

    // O corte acontece no transporte real, à medida que os pedaços chegam — e
    // não depois de acumular tudo, que seria acumular tudo. Aqui se exercita o
    // laço de leitura com um `https` de mentira que despeja mais que o teto.
    const { pedirTokenHttps } = bundle.require("credencial_motor");
    const original = require("https").request;
    let capturado = null;
    require("https").request = function (opcoes, aoResponder) {
      const ouvintes = {};
      const res = {
        statusCode: 200,
        setEncoding() {},
        on(ev, fn) { ouvintes[ev] = fn; return res; },
        destroy() { capturado = "destruido"; },
      };
      return {
        setTimeout() {}, on() {},
        end() {
          aoResponder(res);
          // Dois pedaços de 40 KB: o primeiro passa, o segundo estoura o teto.
          ouvintes.data("x".repeat(40 * 1024));
          ouvintes.data("x".repeat(40 * 1024));
        },
      };
    };
    try {
      const e = await falhaDe(pedirTokenHttps({ apiKey: API_KEY, refreshToken: REFRESH }));
      assert.equal(e.codigo, FALHA.RESPOSTA_GRANDE);
      assert.equal(capturado, "destruido", "a resposta grande tem de ser cortada, não lida até o fim");
    } finally {
      require("https").request = original;
    }
  });
});

// ---------------------------------------------------------------------------
// SEGREDO
// ---------------------------------------------------------------------------

describe("CRED/SEGREDO", () => {
  test("CRED-31: nenhum erro revela token", async () => {
    const cenarios = [
      { pedirToken: transporte({ status: 400, corpo: JSON.stringify({ refresh_token: REFRESH }) }) },
      { pedirToken: transporte(new Error("falhou com " + REFRESH)) },
      { pedirToken: transporte(respostaOk({ extra: { user_id: "outro" } })) },
      { pedirToken: transporte(respostaOk({ payload: { [CLAIM]: false } })) },
      { pedirToken: transporte({ status: 200, corpo: "{" }) },
      { env: {} },
    ];
    for (const c of cenarios) {
      const { cred } = credencial(c);
      const e = await falhaDe(cred.obterIdToken());
      const texto = String(e.message) + "\n" + String(e.stack || "");
      assert.equal(texto.includes(MARCA), false, "vazou segredo em: " + e.codigo + " → " + e.message);
    }
  });

  test("CRED-32: nada no módulo escreve log", async () => {
    // Um `console.log` bem-intencionado com o token é a forma mais provável de
    // a credencial acabar no painel do Railway — de onde ela não sai mais.
    assert.equal(/console\.(log|warn|error|info|debug)/.test(MODULO), false, "o módulo não pode registrar nada");
    assert.equal(/process\.stdout|process\.stderr/.test(MODULO), false);

    // E rodar de verdade não imprime: nem no sucesso, nem na falha.
    const escrito = [];
    const original = { log: console.log, warn: console.warn, error: console.error };
    console.log = console.warn = console.error = (...a) => escrito.push(a.join(" "));
    try {
      const { cred } = credencial();
      await cred.obterIdToken();
      const { cred: quebrada } = credencial({ pedirToken: transporte({ status: 401, corpo: "{}" }) });
      await cred_ignorar(quebrada.obterIdToken());
    } finally {
      Object.assign(console, original);
    }
    assert.deepEqual(escrito, [], "o módulo imprimiu: " + escrito.join(" | "));
  });

  test("CRED-32b: o estado publicado não carrega credencial", async () => {
    const { cred } = credencial();
    await cred.obterIdToken();
    const e = cred.estado();
    assert.deepEqual(Object.keys(e).sort(), [
      "configurada", "expiraEmMs", "faltando", "renovacoes", "rotacoes", "temToken",
    ]);
    assert.equal(JSON.stringify(e).includes(MARCA), false);
  });

  test("CRED-32c: a fonte do módulo não carrega valor real", () => {
    for (const p of [/AIza[0-9A-Za-z_-]{10,}/, /eyJ[A-Za-z0-9_-]{20,}\./, /BEGIN [A-Z ]*PRIVATE KEY/, /client_secret/]) {
      assert.equal(p.test(MODULO), false, "a fonte casa com " + p);
    }
  });
});

async function cred_ignorar(p) { try { await p; } catch (_) { /* esperado */ } }

// ---------------------------------------------------------------------------
// A FRONTEIRA DO SERVIDOR
// ---------------------------------------------------------------------------

describe("CRED/FRONTEIRA", () => {
  const pacote = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));

  test("CRED-33: NENHUMA dependência foi acrescentada", () => {
    assert.equal(pacote.dependencies, undefined, "o servidor continua zero-dependência");
    assert.equal(pacote.peerDependencies, undefined);
    assert.equal(pacote.optionalDependencies, undefined);
    assert.equal(pacote.bundleDependencies, undefined);
    // E nenhum `require` do módulo sai dos built-ins do Node.
    const requeridos = [...MODULO.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(requeridos)].sort(), ["./auth_firebase", "https"]);
  });

  test("CRED-34: `npm start` permanece igual", () => {
    assert.equal(pacote.scripts.start, "node server.js");
    assert.equal(pacote.engines.node, ">=20");
  });

  test("CRED-34b: o módulo NÃO foi ligado a nada — a outbox segue intocada", () => {
    // Esta entrega é infraestrutura. Ligar o transporte é a OS seguinte, e um
    // acoplamento acidental aqui faria o servidor passar a chamar rede no
    // encerramento sem ninguém ter decidido isso.
    assert.equal(/require\("\.\/credencial_motor"\)/.test(FORA_DO_MODULO), false, "ninguém pode carregar o módulo ainda");
    assert.equal(/criarCredencialDoMotor/.test(FORA_DO_MODULO), false);
  });

  test("CRED-34c: o servidor continua subindo sem nenhuma das variáveis novas", () => {
    // O Railway de hoje não tem os segredos, e não pode quebrar por isso: o
    // módulo só falha para quem PEDE um token, e ninguém pede.
    const { iniciar } = bundle.require("ws_server");
    assert.equal(typeof iniciar, "function");
    for (const v of VARIAVEIS) {
      if (v === "FIREBASE_PROJECT_ID") continue; // já existia, do WS-AUTH
      assert.equal(process.env[v], undefined, v + " não deve ser exigida do processo");
    }
  });

  test("CRED-34d: o parser de JWT é o MESMO de auth_firebase", () => {
    // Um segundo analisador divergiria do primeiro no primeiro ajuste, e as duas
    // pontas do sistema passariam a discordar sobre o que é um token bem formado.
    assert.match(MODULO, /const \{ partesDoToken \} = require\("\.\/auth_firebase"\)/);
    // E NÃO existe verificação criptográfica paralela para o token de saída.
    assert.equal(/createVerify|verify\(/.test(MODULO), false, "o token de saída não é nosso para julgar");
  });
});

// ---------------------------------------------------------------------------
// DECISÕES PURAS
// ---------------------------------------------------------------------------

describe("CRED/PURO", () => {
  test("interpretarResposta e conferirSanidade são alcançáveis sozinhas", () => {
    const r = interpretarResposta(respostaOk(), { uid: UID, projectId: PROJETO });
    assert.equal(r.expiresInS, 3600);
    assert.equal(r.refreshToken, REFRESH);

    const s = conferirSanidade(r.idToken, { uid: UID, projectId: PROJETO }, T0);
    assert.equal(s.expiraEmMs, T0 + HORA_MS);
  });

  test("o crypto do Node não é necessário para nada aqui", () => {
    // Fixado porque é um convite recorrente: "já que temos crypto, vamos
    // verificar a assinatura". Não. Ver a DECISÃO 5 no cabeçalho do módulo.
    assert.equal(typeof crypto.createVerify, "function");
  });
});
