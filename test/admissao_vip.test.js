// test/admissao_vip.test.js — O TRANSPORTE DE AUTORIZAÇÃO DE ENTRADA VIP.
//
// Cinco eixos, na ordem em que o pedido se forma e volta:
//   ENDPOINT   de onde sai o endereço, e o que ele exige para ser usável;
//   CONTRATO   o que vai no fio e o que basta para uma resposta liberar assento;
//   FALHA      cada aresta externa, e a prova de que nenhuma delas senta ninguém;
//   VOO        idempotência: o que compartilha chamada e o que nunca compartilha;
//   FIO        o comportamento fim a fim, e quem NÃO passa por este transporte.
//
// Nada aqui abre socket. O transporte é injetado (`pedir`), a credencial é
// injetada, e não existe teste que dependa de rede, de Firebase ou de Railway.
// Nenhuma ficha, passe, assinatura ou direito é concedido ou consumido em
// nenhum caminho — dois testes deste arquivo existem para afirmar essa ausência.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { cliente, novoServidor } = require("./ajuda.js");

const bundle = require("../server.js");
const {
  criarAdaptadorAdmissaoVip,
  lerEndpoint,
  corpoDaRequisicao,
  interpretarRespostaAdmissao,
  CONTRATO,
  FALHA,
  VARIAVEL_URL,
} = bundle.require("admissao_vip");
const {
  RECUSA_VIP_INDISPONIVEL,
  VERSAO_CONTRATO_ENCERRAMENTO,
  avaliarAdmissaoAoAssento,
  concluirAdmissao,
  novaTentativaEntradaId,
} = bundle.require("salas");

const FONTE = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

// ---------------------------------------------------------------------------
// bancada
// ---------------------------------------------------------------------------

const URL_OK = "https://admissao.exemplo.test/v1/entrada";

// Marca reconhecível: se ela aparecer num log, num payload ou numa visão, o
// vazamento é óbvio no relatório em vez de precisar de interpretação.
const TOKEN = "TOKEN-SECRETO-QUE-NAO-PODE-VAZAR";

/** Credencial de teste. A INTERFACE é a da canônica — `obterIdToken` e nada
 *  mais — de propósito: se a canônica mudar de forma, este dublê para de
 *  encaixar e a composição acusa, em vez de seguir com um contrato imaginado. */
function credencialBoa() {
  return { obterIdToken: () => Promise.resolve(TOKEN) };
}
function credencialQuebrada(codigo) {
  return {
    obterIdToken: () => {
      const e = new Error("credencial do motor: " + codigo);
      e.codigo = codigo;
      return Promise.reject(e);
    },
  };
}

function respostaOk(admissaoId = "adm-001", extra = {}) {
  return {
    status: 200,
    corpo: JSON.stringify(Object.assign({ versaoContrato: CONTRATO, ok: true, admissaoId }, extra)),
  };
}

/** Um adaptador com transporte e credencial controlados, que registra tudo o
 *  que passou por ele. */
function bancada(opts = {}) {
  const chamadas = [];
  const registros = [];
  const pedir = (args) => {
    chamadas.push(args);
    const r = opts.responder ? opts.responder(args, chamadas.length) : respostaOk();
    if (r && typeof r.then === "function") return r;
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(r);
  };
  const autorizar = criarAdaptadorAdmissaoVip({
    url: opts.url === undefined ? URL_OK : opts.url,
    credencial: opts.credencial === undefined ? credencialBoa() : opts.credencial,
    pedir,
    registrar: (codigo) => registros.push(codigo),
  });
  return { autorizar, chamadas, registros };
}

/** Contexto como o gate o produz. */
function contexto(extra = {}) {
  return Object.assign({
    uidAutenticado: "uid-1",
    codigoDaSala: "MESA-1",
    identidadeDaPartida: null,
    assento: 0,
    categoriaCompetitiva: "vip_ranqueada",
    tentativaEntradaId: "te_1111-2222",
    classificacao: "admissao_nova",
  }, extra);
}

/** Servidor com mesas VIP e um autorizador controlado. */
function servidorVip(opts = {}) {
  const b = bancada(opts);
  const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada", autorizarEntradaVip: b.autorizar });
  return Object.assign({ srv }, b);
}

/** Manda uma mensagem e espera a porta concluir — VIP responde depois. */
function envia(srv, c, msg) {
  return srv.processar(c.id, msg);
}

/** Um diferido controlável, para segurar um voo no ar. */
function diferido() {
  let resolver;
  const p = new Promise((r) => { resolver = r; });
  return { promessa: p, resolve: resolver };
}

/** Deixa a fila de microtasks drenar.
 *
 *  Necessário porque o adaptador busca a credencial ANTES de falar com o
 *  backend: logo depois de chamar `autorizar(...)` o voo existe e está no mapa,
 *  mas `pedir` ainda não rodou — ele está atrás do `await obterIdToken()`.
 *  Contar chamadas sem drenar mediria o instante errado e o teste passaria (ou
 *  falharia) por acidente de agendamento, não por comportamento. */
function drenar() {
  return new Promise((r) => setImmediate(r));
}

/** Captura tudo o que for para o console durante `fn`. */
async function capturandoLog(fn) {
  const escrito = [];
  const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = console.warn = console.error = console.info = (...a) => escrito.push(a.join(" "));
  try {
    await fn();
  } finally {
    Object.assign(console, original);
  }
  return escrito.join(" | ");
}

// ===========================================================================
describe("ADM/ENDPOINT — de onde sai o endereço", () => {
  test("END-01: o endereço vem do ambiente, e o nome da variável é o do contrato", () => {
    assert.equal(VARIAVEL_URL, "URL_AUTORIZACAO_ENTRADA_VIP");
    // §12.21: o cliente não injeta URL. O despachante não conhece a variável,
    // não conhece o endereço e não constrói adaptador nenhum.
    const iServ = FONTE.indexOf('__fabricas["servidor"]');
    const iWs = FONTE.indexOf('__fabricas["ws_server"]');
    const despachante = FONTE.slice(iServ, iWs);
    assert.ok(!/URL_AUTORIZACAO_ENTRADA_VIP/.test(despachante));
    assert.ok(!/criarAdaptadorAdmissaoVip/.test(despachante));
    assert.ok(!/msg\.url|msg\.endpoint|msg\.backend/i.test(despachante));
  });

  test("END-02: HTTPS é obrigatório fora do loopback", () => {
    // §12.9. A exceção é por HOST, e não por flag: uma flag de "aceitar http"
    // é o tipo de coisa que se liga em produção para destravar um deploy.
    assert.equal(lerEndpoint("https://api.exemplo.test/x").ok, true);
    assert.equal(lerEndpoint("http://api.exemplo.test/x").codigo, FALHA.SEM_HTTPS);
    assert.equal(lerEndpoint("http://exemplo.test").codigo, FALHA.SEM_HTTPS);
    for (const local of ["http://localhost:8080/x", "http://127.0.0.1:9/x"]) {
      assert.equal(lerEndpoint(local).ok, true, "bancada local pode subir sem certificado: " + local);
    }
  });

  test("END-03: endereço ausente, ilegível ou de outro esquema não vira adaptador", () => {
    // §12.6 e §9 (URL ausente → ADMISSAO_VIP_INDISPONIVEL, via ausência de porta).
    assert.equal(lerEndpoint(undefined).codigo, FALHA.SEM_URL);
    assert.equal(lerEndpoint("").codigo, FALHA.SEM_URL);
    assert.equal(lerEndpoint("nao-e-url").codigo, FALHA.URL_INVALIDA);
    assert.equal(lerEndpoint("ftp://x/y").codigo, FALHA.URL_INVALIDA);
    for (const u of [undefined, "", "nao-e-url", "ftp://x/y", "http://externo.test/x"]) {
      assert.equal(criarAdaptadorAdmissaoVip({ url: u, credencial: credencialBoa() }), null);
    }
  });

  test("END-04: credencial embutida na URL é recusada", () => {
    // Ela vazaria em todo log que registrasse o endereço, e não há motivo
    // legítimo para ela aqui: a autenticação deste transporte é o ID token.
    assert.equal(lerEndpoint("https://usuario:senha@api.exemplo.test/x").codigo, FALHA.URL_INVALIDA);
    assert.equal(lerEndpoint("https://usuario@api.exemplo.test/x").codigo, FALHA.URL_INVALIDA);
  });

  test("END-05: sem credencial não há adaptador", () => {
    // §12.7. Um transporte sem credencial não é um transporte degradado — é a
    // ausência de transporte, que é o estado que o gate já sabe recusar.
    assert.equal(criarAdaptadorAdmissaoVip({ url: URL_OK, credencial: null }), null);
    assert.equal(criarAdaptadorAdmissaoVip({ url: URL_OK, credencial: {} }), null);
    assert.equal(criarAdaptadorAdmissaoVip({ url: URL_OK, credencial: { obterIdToken: "nao-e-funcao" } }), null);
  });

  test("END-06: nenhum endereço de produção e nenhum segredo versionados", () => {
    const iAdm = FONTE.indexOf('__fabricas["admissao_vip"]');
    const iCred = FONTE.indexOf('__fabricas["credencial_motor"]');
    const modulo = FONTE.slice(iAdm, iCred);
    assert.ok(!/https:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}/i.test(modulo.replace(/\/\/.*$/gm, "")),
      "o módulo não embute host nenhum");
    for (const p of [/AIza[0-9A-Za-z_-]{10,}/, /eyJ[A-Za-z0-9_-]{20,}\./, /BEGIN [A-Z ]*PRIVATE KEY/]) {
      assert.equal(p.test(modulo), false, "a fonte casa com " + p);
    }
  });
});

// ===========================================================================
describe("ADM/CONTRATO — o que vai no fio e o que basta para liberar", () => {
  test("CTR-01: o corpo carrega exatamente os oito campos do contrato", async () => {
    const b = bancada();
    await b.autorizar(contexto({ identidadeDaPartida: "p-9", assento: 2 }));
    const corpo = b.chamadas[0].corpo;
    assert.deepEqual(Object.keys(corpo).sort(), [
      "assento", "categoriaCompetitiva", "codigoDaSala", "identidadeDaPartida",
      "reconexao", "tentativaEntradaId", "uidAutenticado", "versaoContrato",
    ]);
    assert.equal(corpo.versaoContrato, CONTRATO);
    assert.equal(corpo.uidAutenticado, "uid-1");
    assert.equal(corpo.assento, 2);
    assert.equal(corpo.identidadeDaPartida, "p-9");
  });

  test("CTR-02: nada de perfil, apelido ou publicId viaja", () => {
    // O backend decide por identidade autenticada. Todo o resto seria dado
    // pessoal saindo do servidor sem precisar.
    const corpo = corpoDaRequisicao(contexto({
      apelido: "Sônia", publicId: "BMV-1234", avatarId: "coroa", moldura: "ouro", email: "x@y.z",
    }));
    const texto = JSON.stringify(corpo);
    for (const vazamento of ["Sônia", "BMV-1234", "coroa", "ouro", "x@y.z"]) {
      assert.ok(!texto.includes(vazamento), "vazou para o corpo: " + vazamento);
    }
  });

  test("CTR-03: `reconexao` é derivada da classificação do gate, nunca perguntada", () => {
    assert.equal(corpoDaRequisicao(contexto({ classificacao: "admissao_nova" })).reconexao, false);
    assert.equal(corpoDaRequisicao(contexto({ classificacao: "reconexao_ao_proprio_assento" })).reconexao, true);
    // e um `reconexao` declarado no contexto não decide nada
    assert.equal(corpoDaRequisicao(contexto({ classificacao: "admissao_nova", reconexao: true })).reconexao, false);
  });

  test("CTR-04: o token vai no cabeçalho, nunca no corpo e nunca na URL", async () => {
    const b = bancada();
    await b.autorizar(contexto());
    const c = b.chamadas[0];
    assert.equal(c.idToken, TOKEN, "o transporte recebe o token para o cabeçalho");
    assert.ok(!JSON.stringify(c.corpo).includes(TOKEN), "o corpo não carrega credencial");
    assert.ok(!String(c.endpoint.href).includes(TOKEN), "a URL não carrega credencial");
    // e o cliente HTTPS real põe o token só em `authorization`
    const iAdm = FONTE.indexOf('__fabricas["admissao_vip"]');
    const iCred = FONTE.indexOf('__fabricas["credencial_motor"]');
    const modulo = FONTE.slice(iAdm, iCred);
    assert.ok(/authorization: "Bearer " \+ idToken/.test(modulo));
    assert.ok(!/idToken/.test(modulo.split("function corpoDaRequisicao")[1].split("function interpretar")[0]),
      "a montagem do corpo nem vê o token");
  });

  test("CTR-05: só resposta válida e explícita aprova", () => {
    const bom = interpretarRespostaAdmissao(respostaOk("adm-7"));
    assert.equal(bom.ok, true);
    assert.equal(bom.admissaoId, "adm-7");

    // §12.16: versão desconhecida não ocupa.
    assert.equal(interpretarRespostaAdmissao({
      status: 200, corpo: JSON.stringify({ versaoContrato: "admissao-vip-v2", ok: true, admissaoId: "a" }),
    }).codigo, FALHA.CONTRATO_DESCONHECIDO);
    assert.equal(interpretarRespostaAdmissao({
      status: 200, corpo: JSON.stringify({ ok: true, admissaoId: "a" }),
    }).codigo, FALHA.CONTRATO_DESCONHECIDO);

    // §12.17: admissaoId vazio ou ausente não ocupa.
    for (const id of [undefined, null, "", 0, 7, {}, []]) {
      const r = interpretarRespostaAdmissao({
        status: 200, corpo: JSON.stringify({ versaoContrato: CONTRATO, ok: true, admissaoId: id }),
      });
      assert.equal(r.ok, false, "admissaoId inaceitável: " + JSON.stringify(id));
      assert.equal(r.codigo, FALHA.SEM_ADMISSAO_ID);
    }

    // `ok` estrito: nada de truthy.
    for (const ok of [true]) assert.equal(interpretarRespostaAdmissao({
      status: 200, corpo: JSON.stringify({ versaoContrato: CONTRATO, ok, admissaoId: "a" }),
    }).ok, true);
    for (const ok of ["true", 1, {}, [], "sim", null, undefined]) {
      assert.equal(interpretarRespostaAdmissao({
        status: 200, corpo: JSON.stringify({ versaoContrato: CONTRATO, ok, admissaoId: "a" }),
      }).ok, false, "ok ambíguo não aprova: " + JSON.stringify(ok));
    }
  });

  test("CTR-06: status e corpo estranhos recusam, cada um com o seu código", () => {
    assert.equal(interpretarRespostaAdmissao({ status: 429, corpo: "" }).codigo, FALHA.HTTP_429);
    assert.equal(interpretarRespostaAdmissao({ status: 500, corpo: "" }).codigo, FALHA.HTTP_5XX);
    assert.equal(interpretarRespostaAdmissao({ status: 503, corpo: "" }).codigo, FALHA.HTTP_5XX);
    assert.equal(interpretarRespostaAdmissao({ status: 401, corpo: "" }).codigo, FALHA.HTTP);
    assert.equal(interpretarRespostaAdmissao({ status: 404, corpo: "" }).codigo, FALHA.HTTP);
    // §12.15: JSON inválido não ocupa.
    assert.equal(interpretarRespostaAdmissao({ status: 200, corpo: "<html>opa</html>" }).codigo, FALHA.RESPOSTA_INVALIDA);
    assert.equal(interpretarRespostaAdmissao({ status: 200, corpo: "" }).codigo, FALHA.RESPOSTA_INVALIDA);
    assert.equal(interpretarRespostaAdmissao({ status: 200, corpo: "[]" }).codigo, FALHA.RESPOSTA_INVALIDA);
    assert.equal(interpretarRespostaAdmissao({ status: 200, corpo: "null" }).codigo, FALHA.RESPOSTA_INVALIDA);
    // 5xx e 429 são temporários; o resto não. A distinção é para o operador —
    // nenhum dos dois libera entrada.
    assert.equal(interpretarRespostaAdmissao({ status: 500, corpo: "" }).temporaria, true);
    assert.equal(interpretarRespostaAdmissao({ status: 200, corpo: "{}" }).temporaria, false);
  });
});

// ===========================================================================
describe("ADM/FALHA — nenhuma aresta externa senta ninguém", () => {
  const cenarios = [
    ["negativa comercial", () => ({ status: 200, corpo: JSON.stringify({ versaoContrato: CONTRATO, ok: false, codigoDecisao: "SEM_PASSE" }) })],
    ["timeout", () => Object.assign(new Error("t"), { codigo: FALHA.TIMEOUT })],
    ["429", () => ({ status: 429, corpo: "" })],
    ["500", () => ({ status: 500, corpo: "" })],
    ["502", () => ({ status: 502, corpo: "" })],
    ["JSON inválido", () => ({ status: 200, corpo: "nao-e-json" })],
    ["versão desconhecida", () => ({ status: 200, corpo: JSON.stringify({ versaoContrato: "outra", ok: true, admissaoId: "a" }) })],
    ["admissaoId vazio", () => ({ status: 200, corpo: JSON.stringify({ versaoContrato: CONTRATO, ok: true, admissaoId: "" }) })],
    ["conexão caída", () => Object.assign(new Error("c"), { codigo: FALHA.CONEXAO })],
    ["401 do backend", () => ({ status: 401, corpo: "" })],
  ];

  for (const [nome, responder] of cenarios) {
    test("FAL: " + nome + " não ocupa assento", async () => {
      // §12.11 a §12.17. Cada aresta é medida NO FIO, e não só na primitiva:
      // o que interessa não é o adaptador devolver `ok:false`, é o assento
      // continuar vazio depois disso.
      const { srv, autorizar, chamadas } = servidorVip({ responder });
      assert.ok(autorizar, "o adaptador existe neste cenário");
      const c = await cliente(srv, "uid-1");
      await envia(srv, c, { tipo: "criarMesa", apelido: "A" });

      const erro = c.ultimo("erro");
      assert.ok(erro, "recusado: " + nome);
      assert.equal(erro.codigo, RECUSA_VIP_INDISPONIVEL);
      assert.equal(c.ultimo("entrou"), null, "nenhum `entrou` foi emitido");
      assert.equal(Object.keys(srv.ger.salas).length, 0, "nenhuma sala foi criada");
      assert.equal(srv.conexoes[c.id].assento, null, "a conexão não ganhou assento");
      assert.equal(srv.conexoes[c.id].codigo, null);
      assert.equal(chamadas.length, 1, "e exatamente UMA chamada — sem retry");
    });
  }

  test("FAL-11: credencial revogada ou ausente falha fechado, sem chamar o backend", async () => {
    // §12.8. A credencial recusa ANTES de qualquer pedido: um backend não deve
    // nem receber a pergunta de quem não consegue provar quem é.
    for (const codigo of ["SEM_AUTORIDADE", "SEM_CONFIGURACAO", "UID_DIVERGENTE", "HTTP"]) {
      const { srv, chamadas, registros } = servidorVip({ credencial: credencialQuebrada(codigo) });
      const c = await cliente(srv, "uid-1");
      await envia(srv, c, { tipo: "criarMesa", apelido: "A" });
      assert.equal(c.ultimo("erro").codigo, RECUSA_VIP_INDISPONIVEL, codigo);
      assert.equal(Object.keys(srv.ger.salas).length, 0);
      assert.equal(chamadas.length, 0, "não se pergunta ao backend sem credencial: " + codigo);
      assert.deepEqual(registros, [codigo], "e o código da credencial é o que se registra");
    }
  });

  test("FAL-12: o adaptador não faz retry — uma tentativa, uma chamada", async () => {
    // §8: a recuperação é a da credencial canônica, e é só dela. Um retry aqui
    // seria uma segunda política de repetição sobre a mesma falha, e as duas
    // juntas multiplicariam a carga sobre um backend já em 5xx.
    const { autorizar, chamadas } = bancada({ responder: () => ({ status: 500, corpo: "" }) });
    const r = await autorizar(contexto());
    assert.equal(r.ok, false);
    assert.equal(chamadas.length, 1);
    const iAdm = FONTE.indexOf('__fabricas["admissao_vip"]');
    const iCred = FONTE.indexOf('__fabricas["credencial_motor"]');
    const modulo = FONTE.slice(iAdm, iCred).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // `req.setTimeout` NÃO conta: é o teto de espera de UMA chamada, e não uma
    // segunda chamada. O que se proíbe é reenviar, não desistir.
    const semTetoDeEspera = modulo.replace(/req\.setTimeout\(/g, "");
    assert.ok(!/\bretry\b|tentarDeNovo|novaTentativa|repetir\(|setTimeout\(|setInterval\(/i.test(semTetoDeEspera),
      "não existe repetição no adaptador");
  });

  test("FAL-14: porta que REJEITA a promessa recusa — e a guarda tinha de ser provada", async () => {
    // ESTA É UMA ARESTA QUE O ADAPTADOR REAL NUNCA PRODUZ, e é por isso que ela
    // precisa de teste próprio.
    //
    // `criarAdaptadorAdmissaoVip` sempre RESOLVE — inclusive na falha, com
    // `{ok:false}`. Então o ramo de rejeição do gate ficava de pé sem nunca ser
    // percorrido: a guarda existia e ninguém sabia se ela funcionava. Uma prova
    // negativa que trocasse esse ramo por uma aprovação passaria despercebida —
    // e foi exatamente o que aconteceu quando ela foi injetada.
    //
    // Qualquer porta injetada pode explodir de forma assíncrona (um adaptador
    // futuro, um dublê, um erro de programação). Falha externa não vira entrada.
    const portaQueRejeita = () =>
      Promise.reject(Object.assign(new Error("backend fora do ar"), { codigo: "CONEXAO" }));

    // na primitiva
    const d = await avaliarAdmissaoAoAssento({
      uidAutenticado: "uid-1", codigoDaSala: "MESA-1", identidadeDaPartida: null,
      assento: 0, categoriaCompetitiva: "vip_ranqueada",
      tentativaEntradaId: novaTentativaEntradaId(), reconexao: false,
    }, { autorizarEntradaVip: portaQueRejeita });
    assert.equal(d.ok, false, "promessa rejeitada NUNCA aprova");
    assert.equal(d.codigoRecusa, RECUSA_VIP_INDISPONIVEL);

    // e no fio: sem sala, sem assento, sem `entrou`
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada", autorizarEntradaVip: portaQueRejeita });
    const c = await cliente(srv, "uid-1");
    await envia(srv, c, { tipo: "criarMesa", apelido: "A" });
    assert.equal(c.ultimo("erro").codigo, RECUSA_VIP_INDISPONIVEL);
    assert.equal(c.ultimo("entrou"), null);
    assert.deepEqual(Object.keys(srv.ger.salas), []);
    assert.equal(srv.conexoes[c.id].assento, null);
  });

  test("FAL-15: decisão rejeitada não escreve assento, e o despachante ainda recusa", async () => {
    // A última guarda da cadeia. `concluirAdmissao` é o ponto único em que uma
    // decisão vira efeito: se a decisão rejeita, `escrever` não pode rodar —
    // senão a rejeição sentaria alguém.
    let escreveu = 0;
    await assert.rejects(
      () => concluirAdmissao(Promise.reject(new Error("caiu")), () => { escreveu++; return { assento: 0 }; }),
      "a rejeição atravessa em vez de virar sucesso"
    );
    assert.equal(escreveu, 0, "nada foi escrito");

    // E o despachante trata essa rejeição como recusa, nunca como entrada.
    const iServ = FONTE.indexOf('__fabricas["servidor"]');
    const iWs = FONTE.indexOf('__fabricas["ws_server"]');
    const despachante = FONTE.slice(iServ, iWs);
    const trecho = despachante.slice(despachante.indexOf("function concluirPortaDeMesa"));
    const corpo = trecho.slice(0, trecho.indexOf("function aplicarEntrada"));
    assert.ok(/\(e\) => \{/.test(corpo), "existe um tratador de rejeição");
    assert.ok(/ADMISSAO_VIP_INDISPONIVEL/.test(corpo), "e ele recusa");
    assert.ok(!/enviarPara\(id, \{ tipo: "entrou"/.test(corpo), "e nunca emite `entrou`");
  });

  test("FAL-13: falha externa nunca deixa o jogador parcialmente sentado", async () => {
    // §9. A mesa fica exatamente como estava: sem sala nova, sem assento, sem
    // versão nova e sem broadcast.
    const { srv } = servidorVip({ responder: () => ({ status: 503, corpo: "" }) });
    const c = await cliente(srv, "uid-1");
    await envia(srv, c, { tipo: "criarMesa", apelido: "A" });
    assert.deepEqual(Object.keys(srv.ger.salas), []);
    assert.deepEqual(c.todas("estado"), []);
    assert.equal(c.ultimo("fim"), null);
  });
});

// ===========================================================================
describe("ADM/VOO — idempotência da tentativa", () => {
  test("VOO-01: chamadas simultâneas da MESMA tentativa compartilham um voo", async () => {
    // §12.18. A prova é o backend ter recebido UMA pergunta: é para isso que
    // uma chave de idempotência existe.
    const d = diferido();
    const { autorizar, chamadas } = bancada({ responder: () => d.promessa });
    const ctx = contexto({ tentativaEntradaId: "te_mesma" });
    const a = autorizar(ctx);
    const b = autorizar(ctx);
    const c = autorizar(contexto({ tentativaEntradaId: "te_mesma", assento: 3 }));
    await drenar();
    assert.equal(chamadas.length, 1, "uma chamada só, mesmo com três pedidos");
    d.resolve(respostaOk("adm-unica"));
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    assert.equal(ra.admissaoId, "adm-unica");
    assert.equal(ra, rb, "os três recebem exatamente o mesmo veredito");
    assert.equal(rb, rc);
  });

  test("VOO-02: tentativas DIFERENTES nunca compartilham voo", async () => {
    // §12.19. Compartilhar aqui faria uma entrada aprovada liberar outra.
    const d1 = diferido(), d2 = diferido();
    const { autorizar, chamadas } = bancada({ responder: (_a, n) => (n === 1 ? d1.promessa : d2.promessa) });
    const a = autorizar(contexto({ tentativaEntradaId: "te_A", uidAutenticado: "uid-A" }));
    const b = autorizar(contexto({ tentativaEntradaId: "te_B", uidAutenticado: "uid-B" }));
    await drenar();
    assert.equal(chamadas.length, 2, "duas tentativas, duas perguntas");
    d1.resolve(respostaOk("adm-A"));
    d2.resolve({ status: 200, corpo: JSON.stringify({ versaoContrato: CONTRATO, ok: false }) });
    const ra = await a, rb = await b;
    assert.equal(ra.ok, true);
    assert.equal(ra.admissaoId, "adm-A");
    assert.equal(rb.ok, false, "a aprovação de A não liberou B");
  });

  test("VOO-03: repetição técnica conserva a `tentativaEntradaId`", async () => {
    // §12.20 e §10. O adaptador não cunha identidade e não a reescreve: ela
    // vem do gate inteira. Depois que o voo assenta, repetir é uma pergunta
    // nova ao backend — que a deduplica pela MESMA chave, do lado dele.
    const { autorizar, chamadas } = bancada();
    const ctx = contexto({ tentativaEntradaId: "te_estavel" });
    await autorizar(ctx);
    await autorizar(ctx);
    assert.equal(chamadas.length, 2, "voo assentado: a repetição vira pergunta nova");
    assert.equal(chamadas[0].corpo.tentativaEntradaId, "te_estavel");
    assert.equal(chamadas[1].corpo.tentativaEntradaId, "te_estavel",
      "e a identidade da tentativa é a mesma nas duas");
  });

  test("VOO-04: o voo é removido ao assentar, no sucesso e na falha", async () => {
    const { autorizar } = bancada({ responder: (_a, n) => (n === 1 ? { status: 500, corpo: "" } : respostaOk("adm-2")) });
    const ctx = contexto({ tentativaEntradaId: "te_x" });
    assert.equal((await autorizar(ctx)).ok, false);
    assert.equal(autorizar.estado().emVoo, 0, "voo falho não fica preso no mapa");
    assert.equal((await autorizar(ctx)).ok, true, "e a tentativa seguinte não herda a falha");
    assert.equal(autorizar.estado().emVoo, 0);
  });

  test("VOO-05: tentativa sem identidade não vira chamada", async () => {
    const { autorizar, chamadas } = bancada();
    for (const t of [undefined, null, "", 0, {}]) {
      const r = await autorizar(contexto({ tentativaEntradaId: t }));
      assert.equal(r.ok, false, "tentativa sem identidade: " + JSON.stringify(t));
    }
    assert.equal(chamadas.length, 0, "e nenhuma delas chegou ao backend");
  });

  test("VOO-06: o adaptador não gera identidade de tentativa nem de admissão", () => {
    // §10: não cunhar ID no retry, não gerar aprovação local. A prova é
    // estrutural: o módulo não sorteia nada.
    const iAdm = FONTE.indexOf('__fabricas["admissao_vip"]');
    const iCred = FONTE.indexOf('__fabricas["credencial_motor"]');
    const modulo = FONTE.slice(iAdm, iCred).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/randomUUID|Math\.random|randomBytes/.test(modulo),
      "o adaptador não cunha identidade nenhuma");
    assert.ok(!/novaTentativaEntradaId/.test(modulo));
  });
});

// ===========================================================================
describe("ADM/FIO — fim a fim, e quem não passa por aqui", () => {
  test("FIO-01: aprovação válida ocupa o assento", async () => {
    // §12.10 e a condição de PASS: sala VIP só senta depois do sim explícito.
    const { srv, chamadas } = servidorVip();
    const c = await cliente(srv, "uid-1");
    await envia(srv, c, { tipo: "criarMesa", apelido: "Dono" });

    const entrou = c.ultimo("entrou");
    assert.ok(entrou, "sentou");
    assert.equal(entrou.assento, 0);
    const sala = srv.ger.salas[entrou.codigo];
    assert.equal(sala.categoriaCompetitiva, "vip_ranqueada");
    assert.equal(srv.conexoes[c.id].assento, 0);
    assert.equal(chamadas.length, 1, "uma pergunta ao backend por assento");
    assert.equal(chamadas[0].corpo.assento, 0);
    assert.equal(chamadas[0].corpo.uidAutenticado, "uid-1");
  });

  test("FIO-02: os quatro assentos VIP passam, cada um pelo seu voo", async () => {
    const { srv, chamadas } = servidorVip({ responder: (_a, n) => respostaOk("adm-" + n) });
    const dono = await cliente(srv, "uid-0");
    await envia(srv, dono, { tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    for (let i = 1; i < 4; i++) {
      const c = await cliente(srv, "uid-" + i);
      await envia(srv, c, { tipo: "entrarMesa", codigo, apelido: "J" + i });
      assert.equal(c.ultimo("erro"), null, "jogador " + i);
    }
    assert.equal(chamadas.length, 4, "quatro assentos, quatro autorizações");
    const ids = new Set(chamadas.map((x) => x.corpo.tentativaEntradaId));
    assert.equal(ids.size, 4, "e quatro tentativas distintas");
    const sala = srv.ger.salas[codigo];
    assert.equal(sala.assentos.filter(Boolean).length, 4);
  });

  test("FIO-03: a prova da admissão fica no assento, e NÃO na visão", async () => {
    // §11 e §12.25. `admissaoId` é registro interno: serve para reconciliar e
    // para, um dia, uma reconexão não consumir outra entrada. Não é identidade
    // pública e não tem por que chegar a jogador nenhum.
    const { srv } = servidorVip({ responder: () => respostaOk("ADMISSAO-SECRETA-42") });
    const c = await cliente(srv, "uid-1");
    await envia(srv, c, { tipo: "criarMesa", apelido: "Dono" });
    const codigo = c.ultimo("entrou").codigo;
    const sala = srv.ger.salas[codigo];

    assert.equal(sala.assentos[0].admissaoId, "ADMISSAO-SECRETA-42", "o assento conserva a prova");
    assert.ok(!JSON.stringify(c.recebidas).includes("ADMISSAO-SECRETA-42"),
      "e ela não sai no fio para o próprio jogador");

    // nem para quem assiste
    const e = await cliente(srv, "uid-espectador");
    await envia(srv, e, { tipo: "assistirMesa", codigo });
    assert.ok(!JSON.stringify(e.recebidas).includes("ADMISSAO-SECRETA-42"),
      "nem para quem assiste");
    assert.ok(!JSON.stringify(srv.ger.visaoPara({ codigo, papel: "jogador", assento: 0 })).includes("ADMISSAO-SECRETA-42"));
  });

  test("FIO-04: outro UID não herda a admissão de um assento", async () => {
    // §11. A prova está presa ao assento junto com o `jogadorId` de quem foi
    // admitido — não existe caminho em que ela viaje para outra identidade.
    const { srv } = servidorVip({ responder: (_a, n) => respostaOk("adm-" + n) });
    const a = await cliente(srv, "uid-A");
    await envia(srv, a, { tipo: "criarMesa", apelido: "A" });
    const codigo = a.ultimo("entrou").codigo;
    const b = await cliente(srv, "uid-B");
    await envia(srv, b, { tipo: "entrarMesa", codigo, apelido: "B" });

    const sala = srv.ger.salas[codigo];
    const doA = sala.assentos[0], doB = sala.assentos[2];
    assert.equal(doA.jogadorId, "uid-A");
    assert.equal(doB.jogadorId, "uid-B");
    assert.notEqual(doA.admissaoId, doB.admissaoId, "cada identidade tem a sua admissão");
  });

  test("FIO-05: reconexão chega ao backend classificada como reconexão", async () => {
    // §11: o backend precisa saber, para não cobrar duas vezes de quem caiu e
    // voltou. Quem classifica é o servidor, olhando quem já está sentado.
    const { srv, chamadas } = servidorVip({ responder: (_a, n) => respostaOk("adm-" + n) });
    const c = await cliente(srv, "uid-1");
    await envia(srv, c, { tipo: "criarMesa", apelido: "A" });
    const codigo = c.ultimo("entrou").codigo;
    await envia(srv, c, { tipo: "entrarMesa", codigo, apelido: "A" });

    assert.equal(chamadas[0].corpo.reconexao, false, "criar mesa é entrada nova");
    assert.equal(chamadas[1].corpo.reconexao, true, "voltar ao próprio assento é reconexão");
    assert.notEqual(chamadas[0].corpo.tentativaEntradaId, chamadas[1].corpo.tentativaEntradaId,
      "e são tentativas distintas, cada uma com a sua identidade");
  });

  test("FIO-06: casual não busca credencial e não chama backend", async () => {
    // §12.2 e §12.3. O adaptador está injetado — é o mesmo processo — e mesmo
    // assim nada sai: quem decide é a categoria da mesa, não a existência do
    // transporte.
    const b = bancada();
    let pedidosDeToken = 0;
    const credencialVigiada = { obterIdToken: () => { pedidosDeToken++; return Promise.resolve(TOKEN); } };
    const autorizar = criarAdaptadorAdmissaoVip({
      url: URL_OK, credencial: credencialVigiada, pedir: (a) => { b.chamadas.push(a); return Promise.resolve(respostaOk()); },
    });
    const srv = novoServidor({ categoriaCompetitiva: "casual", autorizarEntradaVip: autorizar });

    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    for (let i = 1; i < 4; i++) {
      const c = await cliente(srv, "uid-" + i);
      c.envia({ tipo: "entrarMesa", codigo, apelido: "J" + i });
    }
    dono.envia({ tipo: "iniciarPartida" });

    assert.equal(pedidosDeToken, 0, "§12.2: casual não pede credencial");
    assert.equal(b.chamadas.length, 0, "§12.3: casual não chama backend");
    assert.equal(srv.ger.salas[codigo].assentos.filter(Boolean).length, 4);
    assert.ok(srv.ger.salas[codigo].iniciada, "e o fluxo casual roda inteiro, síncrono");
  });

  test("FIO-07: casual continua SÍNCRONO — a porta não devolve promessa", () => {
    // O que protege o fluxo de hoje: `envia(...)` seguido de ler a resposta.
    // Se a porta casual passasse a devolver promessa, metade da suíte deste
    // repositório viraria corrida silenciosa.
    const { ehPromessa } = bundle.require("salas");
    const g = bundle.require("salas").criarGerenciador({ gerarCodigo: () => "MESA-X" });
    const r = g.criarMesa({ apelido: "A", jogadorId: "uid-1" });
    assert.equal(ehPromessa(r), false, "criarMesa casual devolve VALOR");
    assert.equal(r.assento, 0);
    const r2 = g.entrarMesa({ codigo: "MESA-X", apelido: "B", jogadorId: "uid-2" });
    assert.equal(ehPromessa(r2), false, "entrarMesa casual devolve VALOR");
    assert.equal(r2.assento, 2);
  });

  test("FIO-08: espectador e bots não passam por este transporte", async () => {
    // §12.4 e §12.5. Espectador não ocupa assento; bots são sentados pelo
    // servidor em `iniciarPartida`, não têm uid e não pagam entrada.
    const { srv, chamadas } = servidorVip();
    const dono = await cliente(srv, "uid-0");
    await envia(srv, dono, { tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    const antes = chamadas.length;

    const e = await cliente(srv, "uid-espectador");
    await envia(srv, e, { tipo: "assistirMesa", codigo });
    assert.ok(e.ultimo("assistindo"), "o espectador entrou");
    assert.ok(e.ultimo("estado"), "e recebeu a projeção pública");
    assert.equal(chamadas.length, antes, "§12.4: espectador não consultou backend");

    await envia(srv, dono, { tipo: "iniciarPartida" });
    const sala = srv.ger.salas[codigo];
    assert.equal(sala.assentos.filter((a) => a && a.tipo === "bot").length, 3);
    assert.equal(chamadas.length, antes, "§12.5: os três bots não consultaram nada");
    for (const a of sala.assentos) {
      if (a && a.tipo === "bot") assert.equal(a.admissaoId, undefined, "bot não tem admissão");
    }
  });

  test("FIO-09: recusa mantém versão e estado inalterados", async () => {
    // §12.26. O dublê aprova só o assento 0, então existe uma sala VIP viva
    // para o segundo jogador ser recusado dentro dela.
    const { srv } = servidorVip({
      responder: (args) => (args.corpo.assento === 0
        ? respostaOk("adm-dono")
        : { status: 200, corpo: JSON.stringify({ versaoContrato: CONTRATO, ok: false, codigoDecisao: "SEM_PASSE" }) }),
    });
    const dono = await cliente(srv, "uid-0");
    await envia(srv, dono, { tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    const sala = srv.ger.salas[codigo];

    const assentosAntes = JSON.stringify(sala.assentos);
    const metaAntes = srv.ger.metadadosDe(codigo);
    dono.limpar();

    const invasor = await cliente(srv, "uid-9");
    await envia(srv, invasor, { tipo: "entrarMesa", codigo, apelido: "Nove" });

    assert.equal(invasor.ultimo("erro").codigo, RECUSA_VIP_INDISPONIVEL);
    assert.equal(JSON.stringify(sala.assentos), assentosAntes, "a sala não mudou");
    assert.deepEqual(srv.ger.metadadosDe(codigo), metaAntes, "e a versão da visão não andou");
    assert.equal(dono.todas("estado").length, 0, "nenhum broadcast de admitido");
  });

  test("FIO-10: nem token nem Authorization aparecem em log", async () => {
    // §12.24. O caminho de falha é o que mais registra, então é nele que se
    // mede — sucesso, negativa, 5xx, credencial quebrada, tudo junto.
    const escrito = await capturandoLog(async () => {
      const ok = servidorVip();
      const c1 = await cliente(ok.srv, "uid-1");
      await envia(ok.srv, c1, { tipo: "criarMesa", apelido: "A" });

      const ruim = servidorVip({ responder: () => ({ status: 500, corpo: JSON.stringify({ erro: TOKEN }) }) });
      const c2 = await cliente(ruim.srv, "uid-2");
      await envia(ruim.srv, c2, { tipo: "criarMesa", apelido: "B" });

      const semCred = servidorVip({ credencial: credencialQuebrada("SEM_AUTORIDADE") });
      const c3 = await cliente(semCred.srv, "uid-3");
      await envia(semCred.srv, c3, { tipo: "criarMesa", apelido: "C" });

      const explode = servidorVip({ responder: () => Object.assign(new Error("falhou em " + URL_OK), {}) });
      const c4 = await cliente(explode.srv, "uid-4");
      await envia(explode.srv, c4, { tipo: "criarMesa", apelido: "D" });
    });

    assert.ok(!escrito.includes(TOKEN), "o token não pode aparecer em log: " + escrito);
    assert.ok(!/authorization/i.test(escrito), "nem o cabeçalho de autorização");
    assert.ok(!escrito.includes("Bearer"), "nem o esquema");
    assert.ok(!escrito.includes(URL_OK), "nem a URL completa do endpoint");
  });

  test("FIO-11: cliente não injeta categoria, URL nem admissaoId", async () => {
    // §12.21, §12.22, §12.23 — as três, no fio, num pedido só.
    const { srv, chamadas } = servidorVip();
    const c = await cliente(srv, "uid-1");
    await envia(srv, c, {
      tipo: "criarMesa", apelido: "A",
      categoriaCompetitiva: "casual", categoria: "casual",
      url: "https://meu-backend-falso.test/aprova", URL_AUTORIZACAO_ENTRADA_VIP: "https://x.test",
      admissaoId: "FORJADA", tentativaEntradaId: "te_forjada", reconexao: true,
    });
    const corpo = chamadas[0].corpo;
    assert.equal(corpo.categoriaCompetitiva, "vip_ranqueada", "§12.22: o payload não rebaixa a mesa");
    assert.equal(chamadas[0].endpoint.href, URL_OK, "§12.21: o endereço é o do processo");
    assert.notEqual(corpo.tentativaEntradaId, "te_forjada", "a tentativa é cunhada pelo servidor");
    assert.equal(corpo.reconexao, false, "e a classificação não vem do payload");

    const sala = srv.ger.salas[c.ultimo("entrou").codigo];
    assert.equal(sala.assentos[0].admissaoId, "adm-001",
      "§12.23: a admissão gravada é a que o backend emitiu, não a que o cliente mandou");
    assert.notEqual(sala.assentos[0].admissaoId, "FORJADA");
  });

  test("FIO-12: queda durante a autorização não deixa assento ocupado", async () => {
    // A janela que a admissão assíncrona abriu, e que o transporte fecha: se a
    // conexão morrer entre a pergunta e a resposta, a admissão aprovada é
    // desfeita — senão o assento ficaria de pé, sem ninguém, para sempre.
    const d = diferido();
    const { srv } = servidorVip({ responder: () => d.promessa });
    const c = await cliente(srv, "uid-1");
    const voo = envia(srv, c, { tipo: "criarMesa", apelido: "A" });
    srv.desconectar(c.id);                 // o jogador cai enquanto o backend pensa
    d.resolve(respostaOk("adm-tarde"));
    await voo;
    assert.deepEqual(Object.keys(srv.ger.salas), [], "a sala aprovada tarde demais foi desfeita");

    // e o mesmo para quem entra numa sala que continua existindo
    const d2 = diferido();
    const b = servidorVip({ responder: (args, n) => (n === 1 ? respostaOk("adm-dono") : d2.promessa) });
    const dono = await cliente(b.srv, "uid-0");
    await envia(b.srv, dono, { tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    const tarde = await cliente(b.srv, "uid-2");
    const voo2 = envia(b.srv, tarde, { tipo: "entrarMesa", codigo, apelido: "Tarde" });
    b.srv.desconectar(tarde.id);
    d2.resolve(respostaOk("adm-tarde-2"));
    await voo2;
    assert.equal(b.srv.ger.salas[codigo].assentos.filter(Boolean).length, 1,
      "o assento aprovado para quem já caiu foi liberado");
  });

  test("FIO-13: o produtor de encerramento segue intacto e sem categoria no envelope", async () => {
    // §12.27 e §12.28. A composição não tocou no contrato do encerramento: ele
    // continua na versão 1, com as mesmas chaves, e a categoria competitiva
    // continua FORA dele — disponível por `categoriaDaSala`, como na OS 1.
    const { srv } = servidorVip({ responder: (_a, n) => respostaOk("adm-" + n) });
    const dono = await cliente(srv, "uid-0");
    await envia(srv, dono, { tipo: "criarMesa", apelido: "Dono", metaPontos: 100 });
    const codigo = dono.ultimo("entrou").codigo;
    for (let i = 1; i < 4; i++) {
      const c = await cliente(srv, "uid-" + i);
      await envia(srv, c, { tipo: "entrarMesa", codigo, apelido: "J" + i });
    }
    await envia(srv, dono, { tipo: "iniciarPartida" });

    const sala = srv.ger.salas[codigo];
    sala.jogo.placar.nos = sala.jogo.metaPontos;
    sala.jogo.encerrada = true;
    sala.jogo.assentoQueBateuFinal = 0;
    srv.ger.liquidar(sala);

    const env = sala.envelopeEncerramento;
    assert.ok(env, "o envelope foi produzido");
    assert.equal(env.versaoContrato, VERSAO_CONTRATO_ENCERRAMENTO);
    assert.equal(VERSAO_CONTRATO_ENCERRAMENTO, 1);
    assert.equal(env.uidQueBateuFinal, "uid-0");
    assert.ok(!("categoriaCompetitiva" in env), "§12.28: a categoria não entrou no envelope v1");
    assert.ok(!("admissaoId" in env), "nem a admissão");
    assert.ok(!JSON.stringify(env).includes("adm-"), "nenhuma prova de admissão no envelope");
    assert.equal(srv.ger.categoriaDaSala(codigo), "vip_ranqueada", "e continua disponível pela sala");
  });

  test("FIO-14: a composição preserva as duas folhas", () => {
    // §12.1. As duas entregas continuam de pé e continuam separadas: o gate
    // com a sua enumeração e o seu ponto único, a credencial com a sua API.
    const salas = bundle.require("salas");
    const credencial = bundle.require("credencial_motor");
    assert.deepEqual(salas.CATEGORIAS_COMPETITIVAS, ["casual", "vip_ranqueada"]);
    assert.deepEqual(salas.TIPOS_DE_PARTIDA, ["publica", "privada", "simulada"]);
    assert.equal(typeof salas.avaliarAdmissaoAoAssento, "function");
    assert.equal(typeof credencial.criarCredencialDoMotor, "function");
    assert.equal(credencial.CLAIM, "motorDePartidas");
    // e o adaptador é o ÚNICO consumidor de backend de admissão do bundle.
    const consumidores = (FONTE.match(/criarAdaptadorAdmissaoVip\(/g) || []).length;
    assert.equal(consumidores, 2, "a fábrica é declarada uma vez e usada uma vez");
  });

  test("FIO-15: nada é concedido nem consumido em nenhum caminho", () => {
    // §14. Assinatura, passe quinzenal e entitlements continuam fora deste
    // servidor — a ausência é entregável, então é afirmada.
    const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    // `assinatura` NÃO entra nesta lista, e a razão é a palavra: em português
    // ela é tanto "subscription" quanto "signature", e o `auth_firebase`
    // verifica ASSINATURA de JWT desde o WS-AUTH (`ASSINATURA_INVALIDA`).
    // Proibi-la aqui bateria no verificador de token, que é justamente o que
    // esta composição depende que continue de pé. Os termos abaixo cercam o
    // conceito comercial sem ambiguidade.
    for (const proibido of [
      "playerEntitlements", "entitlement", "passeQuinzenal", "passeVip",
      "consumirPasse", "concederPasse", "firebase-admin", "firestore",
      "cortesia", "quinzenal", "renovarAssinatura", "statusAssinatura",
    ]) {
      assert.ok(!new RegExp(proibido, "i").test(CODIGO),
        "esta OS não implementa nem simula: " + proibido);
    }
  });
});
