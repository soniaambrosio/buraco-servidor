// test/produtor.test.js — o PRODUTOR autoritativo de encerramento.
//
// Quatro eixos, na ordem em que o fato se forma:
//   IDENTIDADE  quem é cada assento, e de onde isso vem;
//   BATIDA      qual assento bateu, e quando isso vira "batida final";
//   PARTIDA     identidade da partida, motivo e elegibilidade;
//   OUTBOX      o envelope persistido, uma vez, de forma durável.
//
// Nada aqui toca rede. A outbox de disco usa um diretório descartável por
// processo — nunca `./dados`.

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  AUTH,
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
  criarGerenciador,
  montarEnvelopeEncerramento,
  mapaDeParticipantes,
  novoPartidaId,
  VERSAO_CONTRATO_ENCERRAMENTO,
  MOTIVO_META,
  TIPOS_VALIDOS_PARA_CONQUISTA,
} = bundle.require("salas");
const { criarOutbox } = bundle.require("outbox");
const { criarContas } = bundle.require("contas");

const CHAVE = novoParDeChaves("kid-produtor");
const token = (uid, opts = {}) =>
  emitirToken(Object.assign({ chave: CHAVE, uid, emitidoEm: T0 }, opts));

const temporarios = [];
function dirTemporario(rotulo) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bmv-outbox-" + rotulo + "-"));
  temporarios.push(d);
  return d;
}
after(() => {
  for (const d of temporarios) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/** Servidor autenticado com outbox em memória (o padrão destes testes). */
function servidorProdutor(opts = {}) {
  const tempo = opts.tempo || relogio();
  return novoServidorAuth(Object.assign({
    tempo,
    verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }),
    outbox: opts.outbox === undefined ? criarOutbox({ persistir: false }) : opts.outbox,
    agoraIso: () => new Date(tempo.agoraMs).toISOString(),
  }, opts.gerenciador || {}));
}

/** Mesa iniciada, com `humanos` autenticados e o resto em bot. */
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

/** Encerra a partida pelo placar e liquida — sem simular 3000 pontos. */
function encerrarPelaMeta(srv, sala, lado = "nos") {
  sala.jogo.placar[lado] = sala.jogo.metaPontos;
  sala.jogo.encerrada = true;
  return srv.ger.liquidar(sala);
}

// ===========================================================================
describe("PROD/IDENTIDADE", () => {
  test("ID-01: assento humano resolve para o UID autenticado", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    for (let i = 0; i < 4; i++) {
      const p = sala.participantes[i];
      assert.equal(p.tipo, "humano");
      assert.ok(/^uid-\d$/.test(p.uid), "uid deve vir do token, não do apelido");
    }
    // E cada assento carrega o uid de quem realmente autenticou naquele assento.
    const porUid = new Map(sala.participantes.map((p) => [p.uid, p.assento]));
    assert.equal(porUid.size, 4, "quatro uids distintos");
  });

  test("ID-02: jogadorId forjado na mensagem não altera o UID do mapa", async () => {
    const srv = servidorProdutor();
    const c = clienteAuth(srv);
    await c.autentica(token("uid-verdadeiro"));
    // A mensagem tenta declarar outra identidade: é recusada antes de executar.
    c.envia({ tipo: "criarMesa", apelido: "Dono", jogadorId: "uid-forjado" });
    assert.equal(c.ultimo("entrou"), null);
    assert.equal(c.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");

    // E pelo caminho legítimo, o uid do mapa é o do token.
    c.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = c.ultimo("entrou").codigo;
    c.envia({ tipo: "iniciarPartida" });
    const sala = srv.ger.salas[codigo];
    assert.equal(sala.participantes[0].uid, "uid-verdadeiro");
    assert.ok(
      !sala.participantes.some((p) => p.uid === "uid-forjado"),
      "identidade forjada não pode aparecer no mapa"
    );
  });

  test("ID-03: espectador não vira participante", async () => {
    const srv = servidorProdutor();
    const { codigo, sala } = await mesaIniciada(srv, { humanos: 1 });
    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador"));
    esp.envia({ tipo: "assistirMesa", codigo });

    assert.equal(srv.conexoes[esp.id].assento, null);
    assert.ok(
      !sala.participantes.some((p) => p.uid === "uid-espectador"),
      "quem assiste não ocupa assento e não entra no mapa"
    );
  });

  test("ID-04: bot não recebe UID humano", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv, { humanos: 1 });
    const bots = sala.participantes.filter((p) => p.tipo === "bot");
    assert.equal(bots.length, 3, "três assentos viraram bot");
    for (const b of bots) assert.equal(b.uid, null, "bot não tem uid");
  });

  test("ID-05: o titular do assento não muda quando a conexão cai", async () => {
    const srv = servidorProdutor();
    const { codigo, jogadores, sala } = await mesaIniciada(srv);
    const assento = srv.conexoes[jogadores[1].id].assento;
    const titular = sala.participantes[assento].uid;

    srv.desconectar(jogadores[1].id);
    srv.ger.sair({ codigo, assento });

    // O assento virou bot no JOGO, mas o mapa da partida guarda quem jogou.
    assert.equal(sala.jogo.assentos[assento].tipo, "bot");
    assert.equal(sala.participantes[assento].uid, titular,
      "o titular histórico do assento não pode mudar no meio da partida");
  });

  test("ID-06: outro UID não assume o assento de quem saiu", async () => {
    const srv = servidorProdutor();
    const { codigo, jogadores, sala } = await mesaIniciada(srv);
    const assento = srv.conexoes[jogadores[2].id].assento;
    const titular = sala.participantes[assento].uid;

    srv.desconectar(jogadores[2].id);
    const intruso = clienteAuth(srv);
    await intruso.autentica(token("uid-intruso"));
    intruso.envia({ tipo: "entrarMesa", codigo, apelido: "Intruso" });

    assert.equal(srv.conexoes[intruso.id].assento, null, "partida começada não senta ninguém");
    assert.equal(sala.participantes[assento].uid, titular);
  });
});

// ===========================================================================
describe("PROD/BATIDA", () => {
  const J = bundle.require("jogo");

  /** Mesa nova de quatro humanos, sem simular partida. */
  function jogoNovo(metaPontos = 3000) {
    return J.criarJogo({
      assentos: [0, 1, 2, 3].map((i) => ({ tipo: "humano", apelido: "P" + i })),
      modalidade: "sbtl",
      metaPontos,
    });
  }

  const C = bundle.require("carta");

  /** Canastra LIMPA (3..9 do mesmo naipe): é ela que libera a batida no Aberto
   *  e no SBTL. Ids próprios para não colidir com o baralho da mesa. */
  function canastraLimpa(naipe = "copas", prefixo = "K") {
    return ["3", "4", "5", "6", "7", "8", "9"].map((v, i) =>
      ({ id: prefixo + i, naipe, valor: v, eh_coringa: false }));
  }

  /**
   * Mesa montada para que `assento` possa BATER no próximo descarte.
   *
   * Não simula partida: monta o estado mínimo e legal — canastra limpa na mesa
   * da dupla, morto já pego, mão com uma carta só — e depois usa a porta
   * PÚBLICA `J.descartar`. Quem decide se a batida vale continua sendo o motor;
   * o teste só cria a situação.
   */
  function mesaProntaParaBater(assento, metaPontos = 3000) {
    const j = jogoNovo(metaPontos);
    const dupla = J.duplaDoAssento(assento);
    j.jogosDupla[dupla] = [canastraLimpa()];
    j.mortoPego[dupla] = true;
    j.mortoPego[dupla === "nos" ? "eles" : "nos"] = true;
    j.mortos = [];
    j.maos[assento] = [{ id: "ULTIMA", naipe: "paus", valor: "K", eh_coringa: false }];
    j.vez = assento;
    j.jaComprou = true;
    j.rodadaEncerrada = false;
    j.deveUsarTopo = null;
    return j;
  }

  /** Faz esta rodada encerrar a PARTIDA, sem simular 3000 pontos: o placar já
   *  entra acima da meta, então qualquer contagem mantém a meta cruzada. */
  function jogoQueVaiEncerrar(lado = "nos") {
    const j = jogoNovo(1);
    j.placar[lado] = 5000;
    return j;
  }

  test("BAT-01: os dois caminhos de batida entregam o assento ao motor", () => {
    // Prova estrutural do contrato: as duas chamadas passam três argumentos, e
    // o terceiro é o `assento` que já estava em escopo. Se alguém voltar a
    // chamar com dois, este teste cai.
    const fonte = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    const chamadas = fonte.match(/encerrarRodada\(jogo,[^)]*\)/g) || [];
    const comAssento = chamadas.filter((c) => /encerrarRodada\(jogo,\s*dupla,\s*assento\)/.test(c));
    assert.equal(comAssento.length, 2,
      "esperava os DOIS caminhos de batida passando o assento, achei " + comAssento.length);
    // E o esgotamento continua sem assento, porque não houve batida.
    assert.ok(chamadas.some((c) => /encerrarRodada\(jogo,\s*null\)/.test(c)));
  });

  test("BAT-02: rodada encerrada sem batida deixa o assento nulo", () => {
    const j = jogoNovo();
    J.encerrarRodada(j, null, null);
    assert.equal(j.duplaQueBateu, null);
    assert.equal(j.assentoQueBateu, null);
    assert.equal(j.assentoQueBateuFinal, null);
  });

  test("BAT-03: batida REAL por descarte preserva o assento de quem bateu", () => {
    // Percorre os quatro assentos: o campo não pode funcionar só para um lado.
    for (const assento of [0, 1, 2, 3]) {
      const j = mesaProntaParaBater(assento);
      assert.equal(J.duplaPodeBater(j, J.duplaDoAssento(assento)), true,
        "o cenário precisa ser de batida LEGAL");

      const r = J.descartar(j, assento, "ULTIMA");
      assert.equal(r.ok, true, "o descarte tinha de ser aceito");
      assert.equal(r.bateu, true, "e tinha de ser batida");

      assert.equal(j.assentoQueBateu, assento, "assento errado no assento " + assento);
      assert.equal(j.duplaQueBateu, J.duplaDoAssento(assento));
    }
  });

  test("BAT-03b: batida ilegal (sem canastra) não produz assento nenhum", () => {
    const j = mesaProntaParaBater(0);
    j.jogosDupla.nos = [];                      // tira a canastra: batida ilegal
    const r = J.descartar(j, 0, "ULTIMA");
    assert.equal(r.ok, false, "sem canastra o descarte que zera a mão é recusado");
    assert.equal(j.assentoQueBateu, null);
    assert.equal(j.duplaQueBateu, null);
    assert.equal(j.rodadaEncerrada, false);
  });

  test("BAT-04: rodada intermediária NÃO produz assento final", () => {
    const j = jogoNovo(100000); // meta alta: a rodada não encerra a partida
    J.encerrarRodada(j, "nos", 2);
    assert.equal(j.assentoQueBateu, 2, "a rodada registra quem bateu");
    assert.equal(j.encerrada, false);
    assert.equal(j.assentoQueBateuFinal, null,
      "rodada intermediária não pode preencher o assento FINAL");
  });

  test("BAT-05: a batida que cruza a meta produz o assento final", () => {
    const j = jogoQueVaiEncerrar();
    J.encerrarRodada(j, "nos", 2);
    assert.equal(j.encerrada, true);
    assert.equal(j.assentoQueBateuFinal, 2);
  });

  test("BAT-06: rodada nova zera o assento da rodada, não o final", () => {
    const j = jogoQueVaiEncerrar();
    J.encerrarRodada(j, "nos", 2);
    const final = j.assentoQueBateuFinal;
    J.distribuirRodada(j);
    assert.equal(j.assentoQueBateu, null, "o assento da rodada some");
    assert.equal(j.assentoQueBateuFinal, final, "o assento FINAL sobrevive");
  });

  test("BAT-07: um segundo encerramento não reescreve o assento final", () => {
    const j = jogoQueVaiEncerrar();
    J.encerrarRodada(j, "nos", 2);
    j.rodadaEncerrada = false;             // força uma segunda tentativa
    J.encerrarRodada(j, "eles", 3);
    assert.equal(j.assentoQueBateuFinal, 2, "quem bateu primeiro continua sendo quem bateu");
  });

  test("BAT-08: assento não-inteiro é tratado como ausência, não como zero", () => {
    const j = jogoQueVaiEncerrar();
    J.encerrarRodada(j, "nos", "2");
    assert.equal(j.assentoQueBateu, null, "texto não vira assento");
    assert.equal(j.assentoQueBateuFinal, null);
  });
});

// ===========================================================================
describe("PROD/PARTIDA", () => {
  test("PART-01: partidaId nasce no servidor, no início da partida", async () => {
    const srv = servidorProdutor();
    const c = clienteAuth(srv);
    await c.autentica(token("uid-0"));
    c.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = c.ultimo("entrou").codigo;

    assert.equal(srv.ger.salas[codigo].partidaId, null, "sala aberta ainda não é partida");
    c.envia({ tipo: "iniciarPartida" });
    const id = srv.ger.salas[codigo].partidaId;
    assert.ok(/^[0-9a-f-]{36}$/.test(id), "esperava UUID do servidor, veio " + id);
  });

  test("PART-02: o cliente não escolhe nem altera o partidaId", async () => {
    const srv = servidorProdutor();
    const c = clienteAuth(srv);
    await c.autentica(token("uid-0"));
    c.envia({ tipo: "criarMesa", apelido: "Dono", partidaId: "eu-escolhi" });
    const codigo = c.ultimo("entrou").codigo;
    c.envia({ tipo: "iniciarPartida", partidaId: "eu-escolhi" });
    const id = srv.ger.salas[codigo].partidaId;
    assert.notEqual(id, "eu-escolhi");
    assert.ok(/^[0-9a-f-]{36}$/.test(id));

    // E nenhuma mensagem posterior o move.
    c.envia({ tipo: "jogada", partidaId: "outro", jogada: { tipo: "comprarMonte" } });
    assert.equal(srv.ger.salas[codigo].partidaId, id);
  });

  test("PART-03: partida nova recebe id novo", async () => {
    const srv = servidorProdutor();
    const a = await mesaIniciada(srv, { humanos: 1 });
    const b = await mesaIniciada(srv, { humanos: 1 });
    assert.notEqual(a.sala.partidaId, b.sala.partidaId);
    // E dois ids gerados em sequência nunca colidem.
    assert.notEqual(novoPartidaId(), novoPartidaId());
  });

  test("PART-04: meta alcançada é o motivo, e a partida é elegível", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const env = sala.envelopeEncerramento;
    assert.equal(env.motivoEncerramento, MOTIVO_META);
    assert.equal(env.validaParaConquistas, true);
    assert.equal(env.duplaVencedora, "nos");
  });

  test("PART-05: encerramento por caminho não reconhecido é conservador", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    // Estado que a liquidação não deveria ver: não encerrado, mas capturado.
    const env = montarEnvelopeEncerramento(sala, new Date(T0).toISOString());
    assert.notEqual(env.motivoEncerramento, MOTIVO_META);
    assert.equal(env.validaParaConquistas, false,
      "motivo desconhecido nunca pode ser classificado como vitória normal");
  });

  test("PART-06: mesa privada real é elegível", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    assert.equal(sala.tipoPartida, "privada");
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.validaParaConquistas, true);
    assert.ok(TIPOS_VALIDOS_PARA_CONQUISTA.has("privada"));
  });

  test("PART-07: mesa pública real é elegível", async () => {
    const srv = servidorProdutor({ gerenciador: { tipoPartida: "publica" } });
    const { sala } = await mesaIniciada(srv);
    assert.equal(sala.tipoPartida, "publica");
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.validaParaConquistas, true);
  });

  test("PART-08: mesa simulada NÃO é elegível", async () => {
    const srv = servidorProdutor({ gerenciador: { tipoPartida: "simulada" } });
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    assert.equal(sala.envelopeEncerramento.validaParaConquistas, false);
  });

  test("PART-08b: tipo desconhecido cai no conservador, não no permissivo", () => {
    const ger = criarGerenciador({ tipoPartida: "modo_inventado_amanha" });
    const r = ger.criarMesa({ apelido: "Dono", jogadorId: "uid-0" });
    assert.equal(ger.salas[r.codigo].tipoPartida, "simulada");
  });

  test("PART-09: bot que bate não vira beneficiário", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv, { humanos: 1 });
    // Assento 2 é bot nesta mesa; ele é quem bate.
    sala.jogo.assentoQueBateuFinal = 2;
    sala.jogo.duplaQueBateu = "nos";
    encerrarPelaMeta(srv, sala);
    const env = sala.envelopeEncerramento;
    assert.equal(env.assentoQueBateuFinal, 2);
    assert.equal(env.uidQueBateuFinal, null, "bot não tem uid, e não ganha um");
  });

  test("PART-10: quem bateu e venceu tem assento e UID no envelope", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    sala.jogo.assentoQueBateuFinal = 2;   // dupla "nos"
    sala.jogo.duplaQueBateu = "nos";
    encerrarPelaMeta(srv, sala, "nos");
    const env = sala.envelopeEncerramento;
    assert.equal(env.assentoQueBateuFinal, 2);
    assert.equal(env.uidQueBateuFinal, sala.participantes[2].uid);
    assert.equal(env.duplaVencedora, "nos");
    // O parceiro continua distinguível: mesmo lado, outro uid.
    assert.equal(sala.participantes[0].dupla, "nos");
    assert.notEqual(env.uidQueBateuFinal, sala.participantes[0].uid);
  });

  test("PART-11: sem batida conhecida, assento e UID finais são nulos", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const env = sala.envelopeEncerramento;
    assert.equal(env.assentoQueBateuFinal, null);
    assert.equal(env.uidQueBateuFinal, null, "não se infere quem bateu");
    assert.equal(env.validaParaConquistas, true,
      "o encerramento continua válido para outros consumidores");
  });

  test("PART-12: o envelope não carrega carta, mão, token nem apelido", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const texto = JSON.stringify(sala.envelopeEncerramento);
    for (const proibido of ["apelido", "Dono", "mao", "suaMao", "monte", "mortos", "token", "@"]) {
      assert.ok(!texto.includes(proibido), "envelope não pode conter " + proibido);
    }
  });

  test("PART-13: o envelope é determinístico para o mesmo encerramento", async () => {
    const srv = servidorProdutor();
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);
    const a = JSON.stringify(sala.envelopeEncerramento);
    const b = JSON.stringify(montarEnvelopeEncerramento(sala, sala.envelopeEncerramento.encerradaEm));
    assert.equal(a, b);
    assert.equal(sala.envelopeEncerramento.versaoContrato, VERSAO_CONTRATO_ENCERRAMENTO);
  });
});

// ===========================================================================
describe("PROD/OUTBOX", () => {
  test("OUT-01: persistência atômica em disco, um arquivo por partida", async () => {
    const dir = dirTemporario("atomica");
    const outbox = criarOutbox({ dir });
    const srv = servidorProdutor({ outbox });
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);

    const arquivos = fs.readdirSync(dir);
    assert.deepEqual(arquivos, [sala.partidaId + ".json"]);
    assert.ok(!arquivos.some((n) => n.endsWith(".tmp")), "não pode sobrar temporário");

    const reg = JSON.parse(fs.readFileSync(path.join(dir, arquivos[0]), "utf8"));
    assert.equal(reg.partidaId, sala.partidaId);
    assert.equal(reg.estado, "pendente");
    assert.equal(reg.tentativas, 0);
    assert.ok(reg.criadoEm && reg.atualizadoEm);
    assert.equal(reg.envelope.partidaId, sala.partidaId);
  });

  test("OUT-02: a mesma partida não duplica", async () => {
    const dir = dirTemporario("dup");
    const outbox = criarOutbox({ dir });
    const srv = servidorProdutor({ outbox });
    const { sala } = await mesaIniciada(srv);

    encerrarPelaMeta(srv, sala);
    // Liquidações repetidas: retry, reprocessamento, gatilho duplicado.
    srv.ger.liquidar(sala);
    srv.ger.liquidar(sala);
    // E o registro direto do MESMO envelope também converge.
    const r = outbox.registrar(sala.envelopeEncerramento);
    assert.equal(r.criado, false);
    assert.equal(r.jaExistia, true);

    assert.equal(fs.readdirSync(dir).length, 1);
  });

  test("OUT-03: partidas diferentes coexistem", async () => {
    const dir = dirTemporario("coexistem");
    const outbox = criarOutbox({ dir });
    const srv = servidorProdutor({ outbox });
    const a = await mesaIniciada(srv, { humanos: 1 });
    const b = await mesaIniciada(srv, { humanos: 1 });
    encerrarPelaMeta(srv, a.sala);
    encerrarPelaMeta(srv, b.sala);

    const nomes = fs.readdirSync(dir).sort();
    assert.equal(nomes.length, 2);
    assert.deepEqual(nomes, [a.sala.partidaId + ".json", b.sala.partidaId + ".json"].sort());
  });

  test("OUT-04: reinício do processo preserva os pendentes", async () => {
    const dir = dirTemporario("reinicio");
    const srv = servidorProdutor({ outbox: criarOutbox({ dir }) });
    const { sala } = await mesaIniciada(srv);
    encerrarPelaMeta(srv, sala);

    // Outra instância, mesmo diretório: é o que acontece depois de reiniciar.
    const depois = criarOutbox({ dir });
    assert.deepEqual(depois.pendentes(), [sala.partidaId]);
    assert.equal(depois.ler(sala.partidaId).estado, "pendente");
    // E registrar de novo continua sendo no-op.
    assert.equal(depois.registrar(sala.envelopeEncerramento).criado, false);
  });

  test("OUT-05: falha de escrita NÃO marca entrega", () => {
    const dir = dirTemporario("falha");
    const outbox = criarOutbox({ dir });
    const envelope = { partidaId: novoPartidaId(), versaoContrato: 1 };

    // Torna o diretório inutilizável trocando-o por um arquivo.
    fs.rmSync(dir, { recursive: true, force: true });
    fs.writeFileSync(dir, "isto nao e um diretorio");

    const r = outbox.registrar(envelope);
    assert.equal(r.criado, false, "não pode declarar criação que não houve");
    assert.ok(r.erro, "a falha precisa subir para o chamador");
    assert.equal(outbox.existe(envelope.partidaId), false, "nada foi registrado");
  });

  test("OUT-06: arquivo corrompido falha de forma explícita", () => {
    const dir = dirTemporario("corrompido");
    const outbox = criarOutbox({ dir });
    const id = novoPartidaId();
    fs.writeFileSync(path.join(dir, id + ".json"), "{ isto nao e json");

    assert.throws(() => outbox.ler(id), /RegistroCorrompido|ilegível/,
      "silenciar faria um envelope perdido parecer inexistente");
    // E ele continua contando como pendente: não some da fila por estar quebrado.
    assert.ok(outbox.pendentes().includes(id));
  });

  test("OUT-07: partidaId inválido não vira nome de arquivo", () => {
    const dir = dirTemporario("travessia");
    const outbox = criarOutbox({ dir });
    for (const mau of ["../fuga", "a/b", "", null, "curto"]) {
      const r = outbox.registrar({ partidaId: mau, versaoContrato: 1 });
      assert.equal(r.criado, false, "id inválido: " + mau);
    }
    assert.equal(fs.readdirSync(dir).length, 0);
  });

  test("OUT-08: a outbox não concede moeda nem XP", async () => {
    const dir = dirTemporario("economia");
    const contas = criarContas({ persistir: false });
    const srv = servidorProdutor({
      outbox: criarOutbox({ dir }),
      gerenciador: { contas },
    });
    const { sala } = await mesaIniciada(srv);
    const antes = JSON.stringify(contas._dados());

    // Registrar o mesmo envelope várias vezes não move a carteira.
    encerrarPelaMeta(srv, sala);
    const depoisDaPrimeira = JSON.stringify(contas._dados());
    srv.ger.outbox.registrar(sala.envelopeEncerramento);
    srv.ger.outbox.registrar(sala.envelopeEncerramento);
    assert.equal(JSON.stringify(contas._dados()), depoisDaPrimeira,
      "a outbox registra fato; quem paga é registrarPartida");
    assert.notEqual(depoisDaPrimeira, antes, "a economia local continua funcionando");
  });

  test("OUT-09: nenhum envio de rede acontece", () => {
    // Prova estrutural: o módulo da outbox não importa nada de rede, e não há
    // chamada de saída em lugar nenhum do bundle.
    const fonte = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    const i = fonte.indexOf('__fabricas["outbox"]');
    const j = fonte.indexOf('__fabricas["salas"]');
    const moduloOutbox = fonte.slice(i, j);
    for (const proibido of ["require(\"http", "require(\"https", "fetch(", "axios", "net.connect"]) {
      assert.ok(!moduloOutbox.includes(proibido), "outbox não pode falar rede: " + proibido);
    }
    assert.ok(!/\bfetch\s*\(/.test(fonte), "o bundle inteiro não faz fetch");
  });

  test("OUT-10: sem outbox injetada, a partida encerra igual", async () => {
    const srv = servidorProdutor({ outbox: null });
    const { sala } = await mesaIniciada(srv);
    const resumo = encerrarPelaMeta(srv, sala);
    assert.ok(resumo, "a economia local continua");
    assert.ok(sala.envelopeEncerramento, "o envelope é produzido mesmo assim");
  });
});
