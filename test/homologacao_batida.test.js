// test/homologacao_batida.test.js — HOMOLOGAÇÃO DA CONQUISTA "PRIMEIRA BATIDA REAL".
//
// Esta suíte não reimplementa o que `produtor.test.js` já prova. Ela fecha os
// buracos que a matriz da homologação exige e que a suíte da candidata deixou
// em aberto:
//
//   1. O CAMINHO DA BATIDA DIRETA (mão zerou baixando/estendendo) não tinha
//      prova de COMPORTAMENTO. BAT-01 é uma varredura de texto no server.js:
//      ela garante que a chamada tem três argumentos, não que a autoria chegue
//      ao envelope. Um `encerrarRodada(jogo, dupla, assento)` com `assento`
//      errado passaria por BAT-01 sem piscar. Aqui a batida direta acontece de
//      verdade, pela porta pública, nos quatro assentos, pelos dois gatilhos
//      (`baixar` e `estender`).
//   2. O PARCEIRO. A dupla identifica dois jogadores; a conquista é de um.
//   3. AUTORIA APÓS O ENCERRAMENTO — queda, saída e reconexão depois do fato.
//   4. NÃO-DUPLICAÇÃO por replay de mensagem e por reconexão.
//   5. NENHUM EVENTO SEM ENCERRAMENTO correspondente.
//   6. O CONTRATO que o app vai ler como "Última Conquista".
//
// Nada aqui toca rede, e a outbox é sempre descartável.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

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
const { criarOutbox } = bundle.require("outbox");
const J = bundle.require("jogo");

const CHAVE = novoParDeChaves("kid-homologacao");
const token = (uid, opts = {}) =>
  emitirToken(Object.assign({ chave: CHAVE, uid, emitidoEm: T0 }, opts));

/** Servidor autenticado, outbox em memória, relógio determinístico. */
function servidor(opts = {}) {
  const tempo = opts.tempo || relogio();
  return novoServidorAuth(Object.assign({
    tempo,
    verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }),
    outbox: opts.outbox === undefined ? criarOutbox({ persistir: false }) : opts.outbox,
    agoraIso: () => new Date(tempo.agoraMs).toISOString(),
  }, opts.gerenciador || {}));
}

/** Mesa de 4 humanos autenticados (`uid-0..3`), partida iniciada. */
async function mesaIniciada(srv, { metaPontos = 3000 } = {}) {
  const jogadores = [];
  for (let i = 0; i < 4; i++) {
    const c = clienteAuth(srv);
    await c.autentica(token("uid-" + i));
    jogadores.push(c);
  }
  jogadores[0].envia({ tipo: "criarMesa", apelido: "Dono", metaPontos });
  const codigo = jogadores[0].ultimo("entrou").codigo;
  for (let i = 1; i < 4; i++) jogadores[i].envia({ tipo: "entrarMesa", codigo, apelido: "J" + i });
  jogadores[0].envia({ tipo: "iniciarPartida" });
  return { codigo, jogadores, sala: srv.ger.salas[codigo] };
}

/** UID do titular de um assento, lido do mapa congelado da própria partida.
 *
 *  Os testes NÃO podem supor que `uid-N` senta no assento N: `entrarMesa`
 *  preenche na ordem [2,1,3] depois do criador, para separar as duplas. Supor a
 *  identidade acusaria o produtor de trocar autoria quando quem trocou foi o
 *  teste. O mapa é a fonte, e conferi-lo contra o envelope é justamente a
 *  pergunta em jogo. */
function uidDoAssento(sala, assento) {
  const p = sala.participantes.find((x) => x.assento === assento);
  assert.ok(p && p.uid, "o assento " + assento + " tinha de ter titular humano");
  return p.uid;
}

/** Canastra LIMPA (3..9 do mesmo naipe) — é ela que libera a batida. */
function canastraLimpa(naipe = "copas", prefixo = "K") {
  return ["3", "4", "5", "6", "7", "8", "9"].map((v, i) =>
    ({ id: prefixo + i, naipe, valor: v, eh_coringa: false }));
}

/** Trinca de sequência para BAIXAR e zerar a mão (naipe distinto da canastra). */
function trincaParaBaixar() {
  return ["4", "5", "6"].map((v, i) =>
    ({ id: "B" + i, naipe: "espadas", valor: v, eh_coringa: false }));
}

/**
 * Põe o jogo no estado mínimo e LEGAL em que `assento` bate ao esvaziar a mão
 * baixando. Não simula partida: monta a situação e deixa o motor decidir.
 *
 * `mao` é o que sobra na mão — para `baixar`, a trinca inteira; para
 * `estender`, a carta que emenda na canastra da própria dupla.
 */
function prepararBatidaDireta(jogo, assento, mao) {
  const dupla = J.duplaDoAssento(assento);
  jogo.jogosDupla[dupla] = [canastraLimpa()];
  jogo.mortoPego.nos = true;
  jogo.mortoPego.eles = true;
  jogo.mortos = [];
  jogo.maos[assento] = mao;
  jogo.vez = assento;
  jogo.jaComprou = true;
  jogo.rodadaEncerrada = false;
  jogo.deveUsarTopo = null;
  return jogo;
}

function jogoDeQuatro(metaPontos) {
  return J.criarJogo({
    assentos: [0, 1, 2, 3].map((i) => ({ tipo: "humano", apelido: "P" + i })),
    modalidade: "sbtl",
    metaPontos,
  });
}

// ===========================================================================
// 1. BATIDA DIRETA — o caminho que só tinha prova estrutural.
// ===========================================================================
describe("HML/BATIDA-DIRETA", () => {
  test("HB-01: batida ao BAIXAR preserva o assento de quem bateu, nos quatro assentos", () => {
    for (const assento of [0, 1, 2, 3]) {
      const j = prepararBatidaDireta(jogoDeQuatro(100000), assento, trincaParaBaixar());
      assert.equal(J.duplaPodeBater(j, J.duplaDoAssento(assento)), true,
        "o cenário precisa ser de batida LEGAL no assento " + assento);

      const r = J.baixar(j, assento, ["B0", "B1", "B2"]);

      assert.equal(r.ok, true, "a baixada tinha de ser aceita no assento " + assento);
      assert.equal(r.bateu, true, "zerar a mão baixando, com limpa e sem morto, É batida");
      assert.equal(j.assentoQueBateu, assento,
        "a BATIDA DIRETA perdeu a autoria no assento " + assento);
      assert.equal(j.duplaQueBateu, J.duplaDoAssento(assento));
      assert.equal(j.maos[assento].length, 0, "a mão tinha de estar vazia");
    }
  });

  test("HB-02: batida ao ESTENDER preserva o assento de quem bateu", () => {
    for (const assento of [0, 1, 2, 3]) {
      const emenda = [{ id: "E0", naipe: "copas", valor: "10", eh_coringa: false }];
      const j = prepararBatidaDireta(jogoDeQuatro(100000), assento, emenda);

      const r = J.estender(j, assento, 0, ["E0"]);

      assert.equal(r.ok, true, "a extensão tinha de ser aceita no assento " + assento);
      assert.equal(r.bateu, true, "zerar a mão estendendo também é batida");
      assert.equal(j.assentoQueBateu, assento,
        "a batida por EXTENSÃO perdeu a autoria no assento " + assento);
    }
  });

  test("HB-03: batida direta que cruza a meta grava o assento FINAL", () => {
    for (const assento of [0, 1, 2, 3]) {
      const j = prepararBatidaDireta(jogoDeQuatro(1), assento, trincaParaBaixar());
      const r = J.baixar(j, assento, ["B0", "B1", "B2"]);

      assert.equal(r.bateu, true);
      assert.equal(j.encerrada, true, "meta 1 tinha de cair nesta rodada");
      assert.equal(j.assentoQueBateuFinal, assento,
        "a batida direta não gravou o assento FINAL no assento " + assento);
    }
  });

  test("HB-04: zerar a mão baixando COM morto disponível pega o morto e NÃO é batida", () => {
    const j = jogoDeQuatro(100000);
    const dupla = J.duplaDoAssento(0);
    j.jogosDupla[dupla] = [canastraLimpa()];
    j.mortoPego.nos = false;
    j.mortoPego.eles = false;
    j.mortos = [[{ id: "M0", naipe: "ouros", valor: "Q", eh_coringa: false }]];
    j.maos[0] = trincaParaBaixar();
    j.vez = 0; j.jaComprou = true; j.rodadaEncerrada = false; j.deveUsarTopo = null;

    const r = J.baixar(j, 0, ["B0", "B1", "B2"]);

    assert.equal(r.ok, true);
    assert.equal(r.pegouMorto, true, "com morto na mesa, zerar a mão pega o morto");
    assert.notEqual(r.bateu, true, "pegar o morto NÃO é bater");
    assert.equal(j.assentoQueBateu, null, "sem batida não há autoria");
    assert.equal(j.assentoQueBateuFinal, null);
    assert.equal(j.rodadaEncerrada, false);
  });

  test("HB-05: a batida direta atravessa a mesa e chega ao envelope com o UID certo", async () => {
    // Ponta a ponta: a mesma batida direta, agora pela mesa autenticada e pela
    // porta pública `aplicarJogada`, até o envelope produzido por `liquidar`.
    for (const assento of [0, 1, 2, 3]) {
      const srv = servidor();
      const { codigo, sala } = await mesaIniciada(srv, { metaPontos: 1 });
      prepararBatidaDireta(sala.jogo, assento, trincaParaBaixar());

      const r = srv.ger.aplicarJogada({
        codigo, assento, jogada: { tipo: "baixar", ids: ["B0", "B1", "B2"] },
      });

      assert.equal(r.bateu, true, "a mesa tinha de aceitar a batida no assento " + assento);
      const env = sala.envelopeEncerramento;
      assert.ok(env, "a batida encerrou a partida e o envelope tinha de existir");
      assert.equal(env.assentoQueBateuFinal, assento);
      assert.equal(env.uidQueBateuFinal, uidDoAssento(sala, assento),
        "o envelope creditou o UID errado para o assento " + assento);
      // E o UID é mesmo o de uma conta autenticada, não um rótulo qualquer.
      assert.match(env.uidQueBateuFinal, /^uid-[0-3]$/);
    }
  });
});

// ===========================================================================
// 2. AUTORIA — de quem é, e de quem NÃO é.
// ===========================================================================
describe("HML/AUTORIA", () => {
  /** Mesa encerrada por batida direta do assento pedido. */
  async function partidaBatidaPor(assento, opts = {}) {
    const srv = servidor(opts);
    const { codigo, sala, jogadores } = await mesaIniciada(srv, { metaPontos: 1 });
    prepararBatidaDireta(sala.jogo, assento, trincaParaBaixar());
    const r = srv.ger.aplicarJogada({
      codigo, assento, jogada: { tipo: "baixar", ids: ["B0", "B1", "B2"] },
    });
    assert.equal(r.bateu, true, "o cenário precisa terminar em batida");
    return { srv, codigo, sala, jogadores, envelope: sala.envelopeEncerramento };
  }

  test("HB-06: o PARCEIRO da dupla não é creditado pela batida", async () => {
    const assento = 1;
    const parceiro = 3; // mesma dupla ("eles"), assento diferente
    const { sala, envelope } = await partidaBatidaPor(assento);

    assert.equal(J.duplaDoAssento(assento), J.duplaDoAssento(parceiro),
      "o cenário precisa de dois assentos da MESMA dupla");
    const uidBatedor = uidDoAssento(sala, assento);
    const uidParceiro = uidDoAssento(sala, parceiro);
    assert.notEqual(uidBatedor, uidParceiro, "o cenário precisa de duas contas distintas");

    assert.equal(envelope.uidQueBateuFinal, uidBatedor);
    assert.notEqual(envelope.uidQueBateuFinal, uidParceiro,
      "o parceiro não bateu e não pode ser creditado");

    // O parceiro existe no envelope — como participante, que é outra coisa.
    const p = envelope.participantes.find((x) => x.assento === parceiro);
    assert.equal(p.uid, uidParceiro, "o parceiro continua sendo participante");
    // E a autoria é de UM: nenhum outro campo do envelope carrega UID de autor.
    const autores = Object.keys(envelope)
      .filter((k) => /uid/i.test(k))
      .map((k) => envelope[k]);
    assert.deepEqual(autores, [uidBatedor],
      "só pode existir UM campo de autoria, e com um UID só");
  });

  test("HB-07: adversário e espectador não recebem a autoria", async () => {
    const { srv, codigo, sala, envelope } = await partidaBatidaPor(0);
    const adversario = 1;
    assert.notEqual(J.duplaDoAssento(0), J.duplaDoAssento(adversario));
    assert.notEqual(envelope.uidQueBateuFinal, uidDoAssento(sala, adversario),
      "o adversário não pode ser creditado");

    // Um espectador autenticado não entra no mapa de participantes...
    const olheiro = clienteAuth(srv);
    await olheiro.autentica(token("uid-espectador"));
    olheiro.envia({ tipo: "assistir", codigo });
    const uids = envelope.participantes.map((p) => p.uid);
    assert.equal(uids.includes("uid-espectador"), false,
      "quem assiste não ocupa assento e não pode virar participante");

    // ...e o estado que ele recebe não carrega NADA do produtor: nem o envelope,
    // nem a identidade da partida, nem a autoria da batida. A conquista é
    // concedida pelo backend a partir do envelope, não anunciada na mesa.
    //
    // O `jogadorId` de quem está SENTADO continua aparecendo aqui, e isso é
    // anterior a esta entrega — é como a visão pública desenha o avatar de cada
    // assento. Não é campo do produtor, e por isso não é o que se afirma aqui.
    const visto = JSON.stringify(srv.ger.visaoPara({ codigo, papel: "espectador" }));
    for (const proibido of ["uidQueBateuFinal", "partidaId", "envelopeEncerramento",
                            "assentoQueBateuFinal", "validaParaConquistas", "participantes"]) {
      assert.equal(visto.includes(proibido), false,
        "a visão do espectador vazou `" + proibido + "`");
    }
  });

  test("HB-08: sair da mesa DEPOIS do encerramento não troca a autoria", async () => {
    const assento = 2;
    const { srv, codigo, sala, envelope } = await partidaBatidaPor(assento);
    const antes = JSON.parse(JSON.stringify(envelope));
    const uidBatedor = uidDoAssento(sala, assento);

    // Quem bateu cai/sai: o assento vira bot na mesa.
    srv.ger.sair({ codigo, assento });
    assert.equal(sala.jogo.assentos[assento].tipo, "bot",
      "o cenário precisa mesmo derrubar o assento para bot");

    assert.deepEqual(sala.envelopeEncerramento, antes,
      "o envelope é o retrato do fato e não pode mudar depois dele");
    assert.equal(sala.envelopeEncerramento.uidQueBateuFinal, uidBatedor,
      "quem bateu antes de cair continua sendo quem bateu");
  });

  test("HB-09: uma liquidação posterior não reescreve nem duplica o envelope", async () => {
    const outbox = criarOutbox({ persistir: false });
    const { srv, sala, envelope } = await partidaBatidaPor(1, { outbox });
    const antes = JSON.parse(JSON.stringify(envelope));

    assert.deepEqual(outbox.pendentes(), [sala.partidaId]);
    srv.ger.liquidar(sala);
    srv.ger.liquidar(sala);

    assert.deepEqual(sala.envelopeEncerramento, antes);
    assert.deepEqual(outbox.pendentes(), [sala.partidaId],
      "liquidar de novo não pode criar um segundo registro");
  });
});

// ===========================================================================
// 3. IDEMPOTÊNCIA — replay de mensagem e reconexão.
// ===========================================================================
describe("HML/IDEMPOTENCIA", () => {
  test("HB-10: repetir a MESMA jogada de batida não produz um segundo evento", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const { codigo, sala } = await mesaIniciada(srv, { metaPontos: 1 });
    prepararBatidaDireta(sala.jogo, 0, trincaParaBaixar());

    const jogada = { tipo: "baixar", ids: ["B0", "B1", "B2"] };
    const primeira = srv.ger.aplicarJogada({ codigo, assento: 0, jogada });
    assert.equal(primeira.bateu, true);
    const partidaId = sala.partidaId;
    const envelope = JSON.parse(JSON.stringify(sala.envelopeEncerramento));

    // Replay: a mesma mensagem, de novo, várias vezes.
    for (let i = 0; i < 3; i++) {
      const repeticao = srv.ger.aplicarJogada({ codigo, assento: 0, jogada });
      assert.notEqual(repeticao.bateu, true, "o replay não pode bater de novo");
    }

    assert.deepEqual(outbox.pendentes(), [partidaId],
      "o replay da mensagem criou evento a mais");
    assert.deepEqual(sala.envelopeEncerramento, envelope,
      "o replay não pode reescrever o envelope");
  });

  test("HB-11: reconexão depois do encerramento não concede de novo", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const { codigo, sala } = await mesaIniciada(srv, { metaPontos: 1 });
    prepararBatidaDireta(sala.jogo, 3, trincaParaBaixar());
    srv.ger.aplicarJogada({ codigo, assento: 3, jogada: { tipo: "baixar", ids: ["B0", "B1", "B2"] } });

    const partidaId = sala.partidaId;
    const envelope = JSON.parse(JSON.stringify(sala.envelopeEncerramento));
    const uidBatedor = uidDoAssento(sala, 3);

    // O MESMO uid volta numa conexão nova e reentra na mesa.
    const devolta = clienteAuth(srv);
    await devolta.autentica(token(uidBatedor));
    devolta.envia({ tipo: "entrarMesa", codigo, apelido: "J3" });
    devolta.envia({ tipo: "assistir", codigo });

    assert.deepEqual(outbox.pendentes(), [partidaId],
      "reconectar não pode produzir um segundo evento");
    assert.equal(sala.envelopeEncerramento.uidQueBateuFinal, envelope.uidQueBateuFinal);
    assert.equal(sala.partidaId, partidaId, "a partida encerrada não pode ganhar id novo");
  });

  test("HB-12: duas partidas elegíveis continuam sendo dois eventos distintos", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const ids = [];
    for (const assento of [0, 1]) {
      const { sala } = await mesaIniciada(srv, { metaPontos: 1 });
      prepararBatidaDireta(sala.jogo, assento, trincaParaBaixar());
      srv.ger.aplicarJogada({
        codigo: sala.codigo, assento, jogada: { tipo: "baixar", ids: ["B0", "B1", "B2"] },
      });
      ids.push(sala.partidaId);
    }
    assert.notEqual(ids[0], ids[1], "partidas diferentes não podem dividir o id");
    assert.equal(outbox.pendentes().length, 2);
    assert.deepEqual(outbox.pendentes().sort(), ids.slice().sort());
  });
});

// ===========================================================================
// 4. ORDEM — nenhum evento sem encerramento correspondente.
// ===========================================================================
describe("HML/ORDEM", () => {
  test("HB-13: partida em curso não deixa evento nenhum na outbox", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const { codigo, sala } = await mesaIniciada(srv, { metaPontos: 3000 });

    assert.equal(sala.jogo.encerrada, false);
    assert.deepEqual(outbox.pendentes(), [], "sala iniciada não é partida encerrada");

    // Uma jogada legal qualquer, longe de qualquer batida, também não produz.
    srv.ger.aplicarJogada({ codigo, assento: sala.jogo.vez, jogada: { tipo: "comprarMonte" } });
    assert.deepEqual(outbox.pendentes(), []);
  });

  test("HB-14: todo evento da outbox corresponde a uma partida encerrada", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const { sala } = await mesaIniciada(srv, { metaPontos: 1 });
    prepararBatidaDireta(sala.jogo, 0, trincaParaBaixar());
    srv.ger.aplicarJogada({
      codigo: sala.codigo, assento: 0, jogada: { tipo: "baixar", ids: ["B0", "B1", "B2"] },
    });

    for (const partidaId of outbox.pendentes()) {
      const reg = outbox.ler(partidaId);
      assert.equal(reg.envelope.motivoEncerramento, "meta_alcancada",
        "não pode existir evento por caminho que o motor não encerrou");
      const dona = Object.values(srv.ger.salas).find((s) => s.partidaId === partidaId);
      assert.ok(dona, "evento órfão: nenhuma sala reconhece este partidaId");
      assert.equal(dona.jogo.encerrada, true,
        "evento sem encerramento correspondente");
      assert.equal(dona.liquidada, true);
    }
  });
});

// ===========================================================================
// 5. CONTRATO — o que o app vai ler como "Última Conquista".
// ===========================================================================
describe("HML/CONTRATO", () => {
  test("HB-15: o envelope basta para exibir a conquista, sem consultar a mesa", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const { sala } = await mesaIniciada(srv, { metaPontos: 1 });
    prepararBatidaDireta(sala.jogo, 2, trincaParaBaixar());
    srv.ger.aplicarJogada({
      codigo: sala.codigo, assento: 2, jogada: { tipo: "baixar", ids: ["B0", "B1", "B2"] },
    });

    // O consumidor lê o REGISTRO persistido, não a sala em memória.
    const reg = outbox.ler(sala.partidaId);
    const env = reg.envelope;

    // Quem: identidade estável do premiado.
    assert.equal(typeof env.uidQueBateuFinal, "string");
    assert.ok(env.uidQueBateuFinal.length > 0);
    // Por qual partida: chave de deduplicação do lado de lá.
    assert.equal(env.partidaId, sala.partidaId);
    assert.ok(env.partidaId.length >= 8);
    // Quando: ordenação de "última".
    assert.ok(!Number.isNaN(Date.parse(env.encerradaEm)), "encerradaEm tem de ser data ISO");
    // Se vale: o consumidor não recalcula elegibilidade.
    assert.equal(env.validaParaConquistas, true);
    // Com qual contrato: o leitor sabe o que esperar.
    assert.equal(env.versaoContrato, 1);
    // E o desfecho, para a tela.
    assert.equal(env.duplaVencedora, J.duplaDoAssento(2));
    assert.equal(env.motivoEncerramento, "meta_alcancada");
  });

  test("HB-17: partida elegível SEM batida não credita ninguém", async () => {
    // ARMADILHA DO CONTRATO, fixada aqui de propósito.
    //
    // `validaParaConquistas` responde "esta PARTIDA conta?", e não "houve
    // batida?". Uma partida encerrada por esgotamento do baralho é elegível —
    // ela contou, teve vencedor pelo placar — e mesmo assim não tem autor.
    //
    // Quem for conceder a "Primeira Batida Real" precisa exigir as DUAS coisas:
    // `validaParaConquistas === true` E `uidQueBateuFinal !== null`. Ler só a
    // primeira concederia a conquista de batida numa partida em que ninguém
    // bateu — e não haveria a quem conceder.
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const { sala } = await mesaIniciada(srv, { metaPontos: 1 });

    // Margem folgada de propósito: a contagem desconta as cartas que sobraram na
    // mão, e um empate na largada zeraria `duplaVencedora` — o que faria o teste
    // passar pelo motivo errado, por inelegibilidade em vez de por ausência de
    // autor.
    sala.jogo.placar.nos = 5000;
    J.encerrarRodada(sala.jogo, null, null);     // a rodada acaba SEM batida
    srv.ger.liquidar(sala);

    const env = outbox.ler(sala.partidaId).envelope;
    assert.equal(env.motivoEncerramento, "meta_alcancada");
    assert.equal(env.duplaQueBateuUltimaRodada, null, "ninguém bateu");
    assert.equal(env.assentoQueBateuFinal, null);
    assert.equal(env.uidQueBateuFinal, null,
      "sem batida não pode existir premiado");
    assert.equal(env.validaParaConquistas, true,
      "a partida contou — é a AUSÊNCIA DE AUTOR que barra a conquista de batida, " +
      "e não a elegibilidade da partida");
  });

  test("HB-16: o envelope persistido não carrega credencial nem dado privado", async () => {
    const outbox = criarOutbox({ persistir: false });
    const srv = servidor({ outbox });
    const { sala } = await mesaIniciada(srv, { metaPontos: 1 });
    prepararBatidaDireta(sala.jogo, 0, trincaParaBaixar());
    srv.ger.aplicarJogada({
      codigo: sala.codigo, assento: 0, jogada: { tipo: "baixar", ids: ["B0", "B1", "B2"] },
    });

    const bruto = JSON.stringify(outbox.ler(sala.partidaId));
    for (const proibido of ["token", "Bearer", "eyJ", "senha", "email", "@", "apelido",
                            "Dono", "mao", "monte", "morto", "naipe"]) {
      assert.equal(bruto.includes(proibido), false,
        "o registro persistido vazou `" + proibido + "`");
    }
  });
});
