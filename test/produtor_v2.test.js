// test/produtor_v2.test.js — O CONTRATO V2 DO ENVELOPE DE ENCERRAMENTO.
//
// Esta suíte não repete `produtor.test.js`. Ela prova exatamente o que a
// OS 23.2 arbitrou e a OS 23.1-P executou, e o critério de entrada é estreito:
// um caso pertence aqui se FALHA quando uma das seis decisões é desfeita.
//
//   D1  categoriaCompetitiva atravessa (a segunda dimensão)
//   D2  partidaCriadaEm, carimbado onde o partidaId é cunhado
//   D3  canastrasLimpasFinais, acumuladas por partida e por lado
//   D4  simulada PRODUZ envelope e é inelegível — a recusa é do tradutor
//   D5  substituicoes[] preservadas, com granularidade por substituição
//   D6  o envelope NÃO carrega historico nem lancamentos
//
// Mais as invariantes I1–I10 e a política de quarentena V1/V2.
//
// NADA AQUI TOCA REDE, e nada aqui traduz: o tradutor é a OS 23.1, e ele não
// existe. Uma prova que montasse `RegistroDePartida` estaria implementando o
// que esta OS proíbe.

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  T0,
  cliente: clienteAuth,
  emitirToken,
  novoParDeChaves,
  novoServidor: novoServidorAuth,
  relogio,
  verificadorDeTeste,
} = require("./ajuda_auth.js");

const bundle = require("../server.js");
const {
  montarEnvelopeEncerramento,
  novoPartidaId,
  VERSAO_CONTRATO_ENCERRAMENTO,
  MOTIVO_META,
  invariantesVioladas,
  INVARIANTE,
  LADOS_DA_MESA,
  MOTIVO_CONTROLE,
} = bundle.require("salas");
const { criarOutbox, ESTADO } = bundle.require("outbox");
const J = bundle.require("jogo");

const CHAVE = novoParDeChaves("kid-v2");
const token = (uid) => emitirToken({ chave: CHAVE, uid, emitidoEm: T0 });

const temporarios = [];
function dirTemporario(rotulo) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bmv-v2-" + rotulo + "-"));
  temporarios.push(d);
  return d;
}
after(() => {
  for (const d of temporarios) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/** Servidor autenticado, relógio FIXO e injetado. O relógio importa: sem ele,
 *  `partidaCriadaEm` viria do relógio real e nenhuma prova de tempo seria
 *  determinística. */
function servidorV2(opts = {}) {
  const tempo = opts.tempo || relogio();
  const srv = novoServidorAuth(Object.assign({
    tempo,
    verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }),
    outbox: opts.outbox === undefined ? criarOutbox({ persistir: false }) : opts.outbox,
    agoraIso: () => new Date(tempo.agoraMs).toISOString(),
  }, opts.gerenciador || {}));
  srv.tempo = tempo;
  return srv;
}

async function mesaIniciada(srv, { humanos = 4, metaPontos = 3000 } = {}) {
  const jogadores = [];
  for (let i = 0; i < humanos; i++) {
    const c = clienteAuth(srv);
    await c.autentica(token("uid-" + i));
    jogadores.push(c);
  }
  jogadores[0].envia({ tipo: "criarMesa", apelido: "Dono", metaPontos });
  const codigo = jogadores[0].ultimo("entrou").codigo;
  for (let i = 1; i < humanos; i++) {
    jogadores[i].envia({ tipo: "entrarMesa", codigo, apelido: "J" + i });
  }
  jogadores[0].envia({ tipo: "iniciarPartida" });
  return { codigo, jogadores, sala: srv.ger.salas[codigo] };
}

/** Mesa numa MESA VIP/RANQUEADA.
 *
 *  Separada porque a admissão VIP é ASSÍNCRONA: a porta de mesa só conclui
 *  depois que o adaptador responde, e `envia` síncrono devolveria antes disso.
 *  O adaptador é uma FUNÇÃO — é o que o gate injeta —, e não um objeto com
 *  método. */
async function mesaVip(srv, { humanos = 4, metaPontos = 3000 } = {}) {
  const jogadores = [];
  for (let i = 0; i < humanos; i++) {
    const c = clienteAuth(srv);
    await c.autentica(token("uid-" + i));
    jogadores.push(c);
  }
  await srv.processar(jogadores[0].id, { tipo: "criarMesa", apelido: "Dono", metaPontos });
  const codigo = jogadores[0].ultimo("entrou").codigo;
  for (let i = 1; i < humanos; i++) {
    await srv.processar(jogadores[i].id, { tipo: "entrarMesa", codigo, apelido: "J" + i });
  }
  await srv.processar(jogadores[0].id, { tipo: "iniciarPartida" });
  return { codigo, jogadores, sala: srv.ger.salas[codigo] };
}

/** Adaptador de admissão que sempre aprova. É uma função com `estado()`
 *  pendurado, que é a forma exata que `criarAdaptadorAdmissaoVip` devolve. */
function admissaoQueAprova() {
  const f = () => Promise.resolve({ ok: true, admissaoId: "adm-v2" });
  f.estado = () => ({ host: "teste", seguro: true });
  return f;
}

function encerrarPelaMeta(srv, sala, lado = "nos") {
  sala.jogo.placar[lado] = sala.jogo.metaPontos;
  sala.jogo.encerrada = true;
  return srv.ger.liquidar(sala);
}

/** A forma EXATA que `contarPontos` deixa em `jogo.pontosRodada`. Montada aqui
 *  porque os robôs do servidor não fecham canastra de forma confiável — 25
 *  partidas medidas terminaram por esgotamento —, e um teste que dependesse
 *  disso seria intermitente. O que se prova aqui é a SOMA; a classificação de
 *  cada canastra continua sendo do motor, e `pontuarDuplaJogo` já a provou. */
function apuracao({ nos = {}, eles = {} } = {}) {
  const lado = (d) => ({
    total: 0, bonusBatida: 0, penalidadeMorto: 0, descontoMao: 0,
    detalhe: Object.assign({ de500: 0, asas: 0, limpas: 0, sujas: 0, baixadas: 0 }, d),
  });
  return { nos: lado(nos), eles: lado(eles) };
}

/** Um envelope V2 mínimo e VÁLIDO, para as provas de invariante mexerem num
 *  campo por vez. Montado à mão de propósito: se viesse do produtor, cada caso
 *  negativo dependeria de conseguir quebrar o produtor primeiro. */
function envelopeValido(over = {}) {
  return Object.assign({
    versaoContrato: 2,
    partidaId: novoPartidaId(),
    partidaCriadaEm: "2026-08-20T10:00:00.000Z",
    encerradaEm: "2026-08-20T11:00:00.000Z",
    motivoEncerramento: MOTIVO_META,
    modalidade: "sbtl",
    tipoPartida: "publica",
    categoriaCompetitiva: "casual",
    canastrasLimpasFinais: { nos: 3, eles: 1 },
    duplaVencedora: "nos",
    assentoQueBateuFinal: 2,
    participantes: [
      { assento: 0, uid: "uA", dupla: "nos", tipo: "humano" },
      { assento: 1, uid: "uB", dupla: "eles", tipo: "humano" },
      { assento: 2, uid: "uC", dupla: "nos", tipo: "humano" },
      { assento: 3, uid: null, dupla: "eles", tipo: "bot" },
    ],
    substituicoes: [],
  }, over);
}

// ===========================================================================
describe("V2/CONTRATO", () => {
  test("C-01: a versão é 2, explícita, e o envelope a declara", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    assert.equal(VERSAO_CONTRATO_ENCERRAMENTO, 2);
    assert.equal(sala.envelopeEncerramento.versaoContrato, 2);
  });

  test("C-02: os três campos novos existem, com os tipos do contrato", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;

    assert.equal(typeof e.partidaCriadaEm, "string");
    assert.ok(!Number.isNaN(Date.parse(e.partidaCriadaEm)), "ISO-8601 parseável");
    assert.equal(typeof e.categoriaCompetitiva, "string");
    assert.ok(["casual", "vip_ranqueada"].includes(e.categoriaCompetitiva));
    assert.equal(typeof e.canastrasLimpasFinais, "object");
    for (const lado of LADOS_DA_MESA) {
      assert.ok(Number.isInteger(e.canastrasLimpasFinais[lado]));
      assert.ok(e.canastrasLimpasFinais[lado] >= 0);
    }
  });

  test("C-03: nenhuma chave do V1 desapareceu", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    const doV1 = [
      "versaoContrato", "partidaId", "versaoEstadoFinal", "encerradaEm",
      "motivoEncerramento", "modalidade", "tipoPartida", "validaParaConquistas",
      "rodadaFinal", "meta", "placarFinal", "duplaVencedora",
      "duplaQueBateuUltimaRodada", "assentoQueBateuFinal", "uidQueBateuFinal",
      "participantes", "substituicoes",
    ];
    for (const k of doV1) assert.ok(k in e, "campo do V1 sumiu: " + k);
  });

  test("C-04: round-trip por JSON preserva o envelope inteiro", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    const volta = JSON.parse(JSON.stringify(e));
    assert.deepEqual(volta, JSON.parse(JSON.stringify(e)));
    assert.equal(volta.partidaCriadaEm, e.partidaCriadaEm);
    assert.equal(volta.categoriaCompetitiva, e.categoriaCompetitiva);
    assert.deepEqual(volta.canastrasLimpasFinais, e.canastrasLimpasFinais);
  });

  test("C-05: o envelope continua congelado", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    assert.ok(Object.isFrozen(e));
    assert.throws(() => { "use strict"; e.categoriaCompetitiva = "vip_ranqueada"; });
  });

  test("C-06: o envelope é determinístico — remontar dá o mesmo byte", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const a = JSON.stringify(sala.envelopeEncerramento);
    const b = JSON.stringify(
      montarEnvelopeEncerramento(sala, sala.envelopeEncerramento.encerradaEm));
    assert.equal(a, b, "os campos novos vêm da sala, não do instante da montagem");
  });
});

// ===========================================================================
describe("V2/D1 — categoria competitiva", () => {
  test("D1-01: mesa casual leva `casual` ao envelope", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.categoriaCompetitiva, "casual");
  });

  test("D1-02: processo ranqueado leva `vip_ranqueada` ao envelope", async () => {
    const srv = servidorV2({
      gerenciador: {
        categoriaCompetitiva: "vip_ranqueada",
        autorizarEntradaVip: admissaoQueAprova(),
      },
    });
    const { sala } = await mesaVip(srv);
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.categoriaCompetitiva, "vip_ranqueada");
    assert.equal(sala.categoriaCompetitiva, "vip_ranqueada");
  });

  test("D1-03: é EXATAMENTE a que a sala congelou, não uma recalculada", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.categoriaCompetitiva, sala.categoriaCompetitiva);
    // E a da sala é imutável — a tentativa de rebaixar não pega.
    assert.throws(() => { "use strict"; sala.categoriaCompetitiva = "casual"; });
  });

  test("D1-04: o cliente não escolhe a categoria pela mensagem", async () => {
    const srv = servidorV2();
    const c = clienteAuth(srv);
    await c.autentica(token("uid-0"));
    c.envia({ tipo: "criarMesa", apelido: "Dono", categoriaCompetitiva: "vip_ranqueada" });
    const codigo = c.ultimo("entrou").codigo;
    c.envia({ tipo: "iniciarPartida" });
    const sala = srv.ger.salas[codigo];
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.categoriaCompetitiva, "casual",
      "a categoria vem da configuração do processo, nunca do pedido");
  });

  test("D1-05: categoria ausente NÃO vira `casual` — o envelope não persiste", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidorV2({ outbox });
    const { sala } = await mesaIniciada(srv);
    // Sala montada por fora do caminho normal: sem categoria.
    const nu = Object.create(Object.getPrototypeOf(sala));
    Object.assign(nu, sala);
    Object.defineProperty(nu, "categoriaCompetitiva", { value: undefined, enumerable: true });
    const e = montarEnvelopeEncerramento(nu, "2026-08-20T11:00:00.000Z");
    assert.equal(e.categoriaCompetitiva, null, "null, e não `casual`");
    assert.ok(invariantesVioladas(e).includes(INVARIANTE.CATEGORIA_AUSENTE));
  });

  test("D1-06: categoria fora do enum é recusada", () => {
    const v = invariantesVioladas(envelopeValido({ categoriaCompetitiva: "ouro" }));
    assert.ok(v.includes(INVARIANTE.CATEGORIA_AUSENTE));
  });
});

// ===========================================================================
describe("V2/D2 — instante autoritativo", () => {
  test("D2-01: `partidaCriadaEm` vem do relógio INJETADO, no início da partida", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const esperado = new Date(tempo.agoraMs).toISOString();
    const { sala } = await mesaIniciada(srv);
    assert.equal(sala.partidaCriadaEm, esperado);
    tempo.avancarS(3600);
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.partidaCriadaEm, esperado,
      "carimbado no início, não no encerramento");
  });

  test("D2-02: é anterior ou igual a `encerradaEm`", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const { sala } = await mesaIniciada(srv);
    tempo.avancarS(600);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    assert.ok(e.partidaCriadaEm <= e.encerradaEm);
    assert.deepEqual(invariantesVioladas(e), [], "envelope real não viola nada");
  });

  test("D2-03: NÃO é o instante da serialização", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const { sala } = await mesaIniciada(srv);
    const naCriacao = sala.partidaCriadaEm;
    tempo.avancarS(7200);
    encerrarPelaMeta(srv, sala);
    const depois = montarEnvelopeEncerramento(sala, new Date(tempo.agoraMs).toISOString());
    assert.equal(depois.partidaCriadaEm, naCriacao,
      "remontar horas depois não reescreve a criação");
  });

  test("D2-04: substituição e retorno não movem o instante", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const { codigo, sala } = await mesaIniciada(srv);
    const antes = sala.partidaCriadaEm;
    srv.ger.ausentar({ codigo, assento: 1, motivo: MOTIVO_CONTROLE.QUEDA });
    tempo.avancarS(30);
    srv.ger.verificarAusencias(codigo);
    srv.ger.retornar({ codigo, assento: 1, jogadorId: sala.participantes[1].uid });
    tempo.avancarS(30);
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.partidaCriadaEm, antes);
  });

  test("D2-05: a revanche na MESMA sala recebe instante novo", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const { codigo, sala } = await mesaIniciada(srv);
    const primeira = sala.partidaCriadaEm;
    const idPrimeira = sala.partidaId;
    encerrarPelaMeta(srv, sala);

    tempo.avancarS(120);
    sala.iniciada = false;
    srv.ger.iniciarPartida({ codigo, assento: sala.criadorAssento });
    assert.notEqual(sala.partidaId, idPrimeira, "id novo");
    assert.notEqual(sala.partidaCriadaEm, primeira, "e instante novo");
    assert.ok(sala.partidaCriadaEm > primeira);
  });

  test("D2-06: instante ausente é recusado, não substituído por agora", () => {
    const v = invariantesVioladas(envelopeValido({ partidaCriadaEm: null }));
    assert.ok(v.includes(INVARIANTE.ORDEM_TEMPORAL));
  });

  test("D2-07: criação DEPOIS do encerramento é recusada", () => {
    const v = invariantesVioladas(envelopeValido({
      partidaCriadaEm: "2026-08-20T12:00:00.000Z",
      encerradaEm: "2026-08-20T11:00:00.000Z",
    }));
    assert.ok(v.includes(INVARIANTE.ORDEM_TEMPORAL));
  });
});

// ===========================================================================
describe("V2/D3 — canastras limpas por lado", () => {
  test("D3-01: nasce zerado com a partida", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    assert.deepEqual(sala.canastrasLimpasFinais, { nos: 0, eles: 0 });
  });

  test("D3-02: as TRÊS faixas de zero curinga contam; suja não", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    sala.jogo.pontosRodada = apuracao({
      nos: { limpas: 2, de500: 1, asas: 1, sujas: 9 },
      eles: { sujas: 5 },
    });
    srv.ger.absorverCanastras(sala);
    assert.equal(sala.canastrasLimpasFinais.nos, 4, "2 limpas + 1 de500 + 1 as-a-as");
    assert.equal(sala.canastrasLimpasFinais.eles, 0, "suja não é limpa");
  });

  test("D3-03: ACUMULA entre rodadas — não substitui", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    for (const n of [1, 2, 3]) {
      sala.jogo.pontosRodada = apuracao({ nos: { limpas: n }, eles: { limpas: 1 } });
      srv.ger.absorverCanastras(sala);
      J.distribuirRodada(sala.jogo); // zera pontosRodada e sobe a rodada
    }
    assert.equal(sala.canastrasLimpasFinais.nos, 6, "1+2+3");
    assert.equal(sala.canastrasLimpasFinais.eles, 3, "1+1+1");
  });

  test("D3-04: os lados são independentes e podem divergir", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    sala.jogo.pontosRodada = apuracao({ nos: { limpas: 5 }, eles: { limpas: 1 } });
    srv.ger.absorverCanastras(sala);
    encerrarPelaMeta(srv, sala);
    assert.deepEqual(sala.envelopeEncerramento.canastrasLimpasFinais, { nos: 5, eles: 1 });
  });

  test("D3-05: absorver é IDEMPOTENTE por rodada", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    sala.jogo.pontosRodada = apuracao({ nos: { limpas: 3 } });
    srv.ger.absorverCanastras(sala);
    srv.ger.absorverCanastras(sala);
    srv.ger.absorverCanastras(sala);
    assert.equal(sala.canastrasLimpasFinais.nos, 3, "a rodada N conta uma vez só");
  });

  test("D3-06: a ÚLTIMA rodada é absorvida no encerramento", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    // Nenhuma distribuição depois desta: só o encerramento a alcança.
    sala.jogo.pontosRodada = apuracao({ nos: { limpas: 7 }, eles: { de500: 2 } });
    encerrarPelaMeta(srv, sala);
    assert.deepEqual(sala.envelopeEncerramento.canastrasLimpasFinais, { nos: 7, eles: 2 });
  });

  test("D3-07: a transição por bot absorve antes de zerar", async () => {
    const srv = servidorV2();
    const { codigo, sala } = await mesaIniciada(srv);
    sala.jogo.rodadaEncerrada = true;
    sala.jogo.pontosRodada = apuracao({ nos: { limpas: 4 } });
    const r = srv.ger.jogarUmBot(codigo);
    assert.equal(r.transicao, true, "houve transição de rodada");
    assert.equal(sala.canastrasLimpasFinais.nos, 4, "somado ANTES de distribuirRodada zerar");
    assert.equal(sala.jogo.pontosRodada, null, "e a rodada foi mesmo distribuída");
  });

  test("D3-08: ausência é recusada — nunca vira zero", () => {
    assert.ok(invariantesVioladas(envelopeValido({ canastrasLimpasFinais: null }))
      .includes(INVARIANTE.CANASTRAS_AUSENTES));
    assert.ok(invariantesVioladas(envelopeValido({ canastrasLimpasFinais: { nos: 1 } }))
      .includes(INVARIANTE.CANASTRAS_AUSENTES), "um lado só não fecha");
  });

  test("D3-09: contagem negativa é recusada", () => {
    assert.ok(invariantesVioladas(envelopeValido({ canastrasLimpasFinais: { nos: -1, eles: 0 } }))
      .includes(INVARIANTE.CANASTRAS_AUSENTES));
  });
});

// ===========================================================================
describe("V2/D4 — mesa simulada", () => {
  test("D4-01: simulada PRODUZ envelope e ele é persistido", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidorV2({ outbox, gerenciador: { tipoPartida: "simulada" } });
    const { sala } = await mesaIniciada(srv);
    assert.equal(sala.tipoPartida, "simulada");
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    assert.ok(e, "o fato aconteceu e foi envelopado");
    assert.ok(outbox.existe(sala.partidaId), "e persistido: durabilidade não é negociável");
  });

  test("D4-02: e é EXPLICITAMENTE inelegível — a ausência não é silenciosa", async () => {
    const srv = servidorV2({ gerenciador: { tipoPartida: "simulada" } });
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    assert.equal(e.validaParaConquistas, false);
    assert.equal(e.tipoPartida, "simulada", "o motivo fica legível no próprio envelope");
  });

  test("D4-03: tipo FORA do enum é coagido a simulada (o contexto C2)", async () => {
    const srv = servidorV2({ gerenciador: { tipoPartida: "campeonato_secreto" } });
    const { sala } = await mesaIniciada(srv);
    assert.equal(sala.tipoPartida, "simulada", "na dúvida sobre a natureza, não se concede nada");
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.validaParaConquistas, false);
  });

  test("D4-05: o cliente NÃO escolhe o tipo pela mensagem", async () => {
    // Achado do arnês, e ele merece virar prova: passar `tipoPartida` em
    // `criarMesa` não muda nada. A topologia é da CONSTRUÇÃO da mesa, e um campo
    // que morasse na mensagem seria escolhível por quem joga — que é o mesmo
    // motivo pelo qual a categoria competitiva também não entra por lá.
    const srv = servidorV2();
    const c = clienteAuth(srv);
    await c.autentica(token("uid-0"));
    c.envia({ tipo: "criarMesa", apelido: "Dono", tipoPartida: "publica" });
    const codigo = c.ultimo("entrou").codigo;
    c.envia({ tipo: "iniciarPartida" });
    const sala = srv.ger.salas[codigo];
    assert.equal(sala.tipoPartida, "privada", "o padrão do processo, não o pedido");
  });

  test("D4-04: simulada NÃO é tratada como pública nem como privada", async () => {
    const srv = servidorV2({ gerenciador: { tipoPartida: "simulada" } });
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    assert.notEqual(e.tipoPartida, "publica");
    assert.notEqual(e.tipoPartida, "privada");
  });
});

// ===========================================================================
describe("V2/D5 — substituições", () => {
  test("D5-01: a substituição aparece no envelope, com assento e motivo", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const { codigo, sala } = await mesaIniciada(srv);
    srv.ger.ausentar({ codigo, assento: 1, motivo: MOTIVO_CONTROLE.QUEDA });
    tempo.avancarS(30);
    srv.ger.verificarAusencias(codigo);
    encerrarPelaMeta(srv, sala);
    const subs = sala.envelopeEncerramento.substituicoes;
    assert.ok(Array.isArray(subs));
    assert.equal(subs.length, 1);
    assert.equal(subs[0].assento, 1);
    assert.ok(typeof subs[0].desdeIso === "string");
  });

  test("D5-02: DUAS substituições no mesmo assento são DUAS entradas", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const { codigo, sala } = await mesaIniciada(srv);
    for (const _ of [1, 2]) {
      srv.ger.ausentar({ codigo, assento: 1, motivo: MOTIVO_CONTROLE.QUEDA });
      tempo.avancarS(30);
      srv.ger.verificarAusencias(codigo);
      srv.ger.retornar({ codigo, assento: 1, jogadorId: sala.participantes[1].uid });
      tempo.avancarS(30);
    }
    encerrarPelaMeta(srv, sala);
    const subs = sala.envelopeEncerramento.substituicoes.filter((s) => s.assento === 1);
    assert.equal(subs.length, 2, "não colapsam numa só");
    assert.notEqual(subs[0].desdeIso, subs[1].desdeIso, "e são distinguíveis pelo instante");
  });

  test("D5-03: o retorno do humano fica registrado", async () => {
    const tempo = relogio();
    const srv = servidorV2({ tempo });
    const { codigo, sala } = await mesaIniciada(srv);
    srv.ger.ausentar({ codigo, assento: 2, motivo: MOTIVO_CONTROLE.QUEDA });
    tempo.avancarS(30);
    srv.ger.verificarAusencias(codigo);
    srv.ger.retornar({ codigo, assento: 2, jogadorId: sala.participantes[2].uid });
    encerrarPelaMeta(srv, sala);
    const s = sala.envelopeEncerramento.substituicoes.find((x) => x.assento === 2);
    assert.ok(s, "a substituição existe");
    assert.equal(s.humanoVoltou, true);
  });

  test("D5-04: partida sem substituição leva lista VAZIA, não ausente", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    assert.deepEqual(sala.envelopeEncerramento.substituicoes, []);
  });
});

// ===========================================================================
describe("V2/D6 — o envelope não invade a privacidade", () => {
  test("D6-01: NÃO carrega `historico` nem `lancamentos`", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const e = sala.envelopeEncerramento;
    assert.ok(!("historico" in e), "projetar histórico é da autoridade Dart, não daqui");
    assert.ok(!("lancamentos" in e), "ledger competitivo não é do produtor");
    assert.ok(!("matchHistory" in e));
  });

  test("D6-02: nem carrega saldo, prêmio, XP ou delta de ranking", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const texto = JSON.stringify(sala.envelopeEncerramento).toLowerCase();
    for (const proibido of ["saldo", "fichas", "premio", "prêmio", "xp", "moeda", "delta", "recompensa"]) {
      assert.ok(!texto.includes(proibido), "o envelope não pode falar de economia: " + proibido);
    }
  });

  test("D6-03: e continua sem carta, mão, token ou apelido", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const texto = JSON.stringify(sala.envelopeEncerramento).toLowerCase();
    for (const proibido of ["apelido", "token", "dono", "\"mao\"", "carta"]) {
      assert.ok(!texto.includes(proibido), "vazou: " + proibido);
    }
  });
});

// ===========================================================================
describe("V2/INVARIANTES", () => {
  test("I-00: um envelope válido não viola nada", () => {
    assert.deepEqual(invariantesVioladas(envelopeValido()), []);
  });

  test("I2: vencedor sem meta, e meta sem vencedor, são recusados", () => {
    assert.ok(invariantesVioladas(envelopeValido({ duplaVencedora: null }))
      .includes(INVARIANTE.VENCEDOR_E_MOTIVO));
    assert.ok(invariantesVioladas(envelopeValido({ motivoEncerramento: "desconhecido" }))
      .includes(INVARIANTE.VENCEDOR_E_MOTIVO));
  });

  test("I3: quem bateu tem de ser do lado vencedor", () => {
    const v = invariantesVioladas(envelopeValido({ assentoQueBateuFinal: 1 }));
    assert.ok(v.includes(INVARIANTE.BATIDA_DO_VENCEDOR), "assento 1 é `eles`, vencedor é `nos`");
  });

  test("I4: menos de quatro assentos, ou assento repetido, recusa", () => {
    const p = envelopeValido().participantes.slice(0, 3);
    assert.ok(invariantesVioladas(envelopeValido({ participantes: p }))
      .includes(INVARIANTE.QUATRO_ASSENTOS));
    const rep = envelopeValido().participantes.map((x, i) => (i === 3 ? { ...x, assento: 0 } : x));
    assert.ok(invariantesVioladas(envelopeValido({ participantes: rep }))
      .includes(INVARIANTE.QUATRO_ASSENTOS));
  });

  test("I5: a dupla é função do assento — declarar outra recusa", () => {
    const p = envelopeValido().participantes.map((x, i) => (i === 0 ? { ...x, dupla: "eles" } : x));
    assert.ok(invariantesVioladas(envelopeValido({ participantes: p }))
      .includes(INVARIANTE.DUPLA_DO_ASSENTO));
  });

  test("I6: humano sem uid, e bot com uid, recusam", () => {
    const semUid = envelopeValido().participantes.map((x, i) => (i === 0 ? { ...x, uid: null } : x));
    assert.ok(invariantesVioladas(envelopeValido({ participantes: semUid }))
      .includes(INVARIANTE.HUMANO_TEM_UID));
    const botComUid = envelopeValido().participantes.map((x, i) => (i === 3 ? { ...x, uid: "uZ" } : x));
    assert.ok(invariantesVioladas(envelopeValido({ participantes: botComUid }))
      .includes(INVARIANTE.HUMANO_TEM_UID));
  });

  test("I7: o mesmo uid em dois assentos é auto-jogo e recusa", () => {
    const p = envelopeValido().participantes.map((x, i) => (i === 2 ? { ...x, uid: "uA" } : x));
    assert.ok(invariantesVioladas(envelopeValido({ participantes: p }))
      .includes(INVARIANTE.UID_UNICO));
  });

  test("I-FECHO: envelope inválido NÃO é persistido, e o fato fica no log", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidorV2({ outbox });
    const { sala } = await mesaIniciada(srv);
    // Desfaz o acumulador: o produtor passa a montar um envelope que viola I10.
    sala.canastrasLimpasFinais = null;
    encerrarPelaMeta(srv, sala);
    assert.ok(sala.envelopeEncerramento, "o envelope foi montado");
    assert.equal(outbox.existe(sala.partidaId), false,
      "mas NÃO foi persistido: registro envenenado é pior que registro ausente");
  });
});

// ===========================================================================
describe("V2/QUARENTENA V1", () => {
  function outboxComMistura() {
    const dir = dirTemporario("mistura");
    const outbox = criarOutbox({ dir });
    const v1 = novoPartidaId();
    const v2 = novoPartidaId();
    outbox.registrar({ partidaId: v1, versaoContrato: 1 });
    outbox.registrar({ partidaId: v2, versaoContrato: 2 });
    return { outbox, v1, v2, dir };
  }

  test("Q-01: `pendentesTraduziveis` devolve só o V2", () => {
    const { outbox, v1, v2 } = outboxComMistura();
    const t = outbox.pendentesTraduziveis(2);
    assert.deepEqual(t, [v2]);
    assert.ok(!t.includes(v1));
  });

  test("Q-02: `quarentena` devolve só o V1", () => {
    const { outbox, v1, v2 } = outboxComMistura();
    const q = outbox.quarentena(2);
    assert.deepEqual(q, [v1]);
    assert.ok(!q.includes(v2));
  });

  test("Q-03: `pendentes()` NÃO mudou de significado — os dois continuam lá", () => {
    const { outbox, v1, v2 } = outboxComMistura();
    const p = outbox.pendentes();
    assert.ok(p.includes(v1) && p.includes(v2));
    assert.equal(p.length, 2);
  });

  test("Q-04: quarentena NÃO apaga e NÃO converte", () => {
    const { outbox, v1, dir } = outboxComMistura();
    outbox.quarentena(2);
    outbox.pendentesTraduziveis(2);
    assert.ok(fs.existsSync(path.join(dir, v1 + ".json")), "o arquivo continua lá");
    assert.equal(outbox.ler(v1).versaoContrato, 1, "e continua sendo V1");
  });

  test("Q-05: a versão alvo é OBRIGATÓRIA — sem ela, lança", () => {
    const { outbox } = outboxComMistura();
    assert.throws(() => outbox.pendentesTraduziveis(), TypeError);
    assert.throws(() => outbox.quarentena(), TypeError);
    assert.throws(() => outbox.pendentesTraduziveis("2"), TypeError);
  });

  test("Q-06: registro corrompido é separado da quarentena", () => {
    const { outbox, dir } = outboxComMistura();
    const mau = novoPartidaId();
    fs.writeFileSync(path.join(dir, mau + ".json"), "{ nao é json");
    assert.deepEqual(outbox.corrompidos(), [mau]);
    assert.ok(!outbox.quarentena(2).includes(mau), "corrompido não é contrato velho");
    assert.ok(!outbox.pendentesTraduziveis(2).includes(mau));
  });

  test("Q-07: reinício preserva a classificação", () => {
    const { outbox, v1, v2, dir } = outboxComMistura();
    const depois = criarOutbox({ dir });
    assert.deepEqual(depois.quarentena(2), [v1]);
    assert.deepEqual(depois.pendentesTraduziveis(2), [v2]);
  });

  test("Q-08: o estado QUARENTENA tem nome, para o transporte não inventar outro", () => {
    assert.equal(ESTADO.QUARENTENA, "quarentena");
    assert.equal(ESTADO.PENDENTE, "pendente");
  });

  test("Q-09: o produtor V2 grava registros que se classificam como traduzíveis", async () => {
    const dir = dirTemporario("produzidos");
    const outbox = criarOutbox({ dir });
    const srv = servidorV2({ outbox });
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    assert.deepEqual(outbox.pendentesTraduziveis(2), [sala.partidaId]);
    assert.deepEqual(outbox.quarentena(2), []);
  });
});

// ===========================================================================
describe("V2/PRIMEIRA BATIDA REAL — intacta", () => {
  test("PB-01: assento e UID da batida continuam atravessando", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    sala.jogo.assentoQueBateuFinal = 0;
    encerrarPelaMeta(srv, sala, "nos");
    const e = sala.envelopeEncerramento;
    assert.equal(e.assentoQueBateuFinal, 0);
    assert.equal(e.uidQueBateuFinal, sala.participantes[0].uid);
    assert.equal(e.motivoEncerramento, MOTIVO_META);
    assert.equal(e.validaParaConquistas, true);
  });

  test("PB-02: o V2 não concede nada — nenhum efeito de conquista no servidor", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv);
    sala.jogo.assentoQueBateuFinal = 0;
    encerrarPelaMeta(srv, sala);
    //  É um campo legítimo do envelope: ele diz se a
    // PARTIDA é elegível, e isso é um fato do encerramento. O que o servidor não
    // pode carregar é CONCESSÃO — o nome da conquista, um id de concessão, uma
    // data de obtenção. Quem concede é a autoridade nas Functions.
    const e2 = sala.envelopeEncerramento;
    assert.equal(e2.validaParaConquistas, true, "elegibilidade é fato, e fica");
    const texto = JSON.stringify(e2).toLowerCase();
    for (const proibido of ["primeira_batida", "playerachievements", "obtidaem", "concedid", "conquistaid"]) {
      assert.ok(!texto.includes(proibido), "o servidor não concede: " + proibido);
    }
  });

  test("PB-03: bot que bate não vira beneficiário, mesmo no V2", async () => {
    const srv = servidorV2();
    const { sala } = await mesaIniciada(srv, { humanos: 3 });
    sala.jogo.assentoQueBateuFinal = 3; // assento de bot
    encerrarPelaMeta(srv, sala, "eles");
    const e = sala.envelopeEncerramento;
    assert.equal(e.assentoQueBateuFinal, 3);
    assert.equal(e.uidQueBateuFinal, null, "bot não tem uid");
  });

  test("PB-04: nenhuma chamada de rede acontece nesta etapa", async () => {
    const https = require("node:https");
    const original = https.request;
    let chamou = false;
    https.request = () => { chamou = true; throw new Error("o produtor não chama rede"); };
    try {
      const srv = servidorV2();
      const { sala } = await mesaIniciada(srv);
      encerrarPelaMeta(srv, sala);
      assert.ok(sala.envelopeEncerramento);
    } finally {
      https.request = original;
    }
    assert.equal(chamou, false, "produzir não é despachar");
  });
});
