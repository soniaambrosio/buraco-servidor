// ===========================================================================
// OS 7 — CONTROLADOR CANÔNICO DE ASSENTO, AUSÊNCIA E RETORNO HUMANO V1
//
// O que esta suíte afirma, em uma frase: queda de conexão não destrói o
// controle humano, e o proprietário legítimo consegue voltar ao próprio
// assento — sem que humano e bot tenham autoridade ao mesmo tempo.
//
// RELÓGIO. Nenhum teste dorme. O gerenciador recebe `agora` injetado e a graça
// é avaliada por comparação, não por timer; por isso T-1, T e T+1 são três
// asserções e não três esperas (§17).
// ===========================================================================
const test = require("node:test");
const { describe } = test;
const assert = require("node:assert");

const { novoServidor, cliente, T0 } = require("./ajuda");
const { CONTROLE, MOTIVO_CONTROLE, GRACA_AUSENCIA_PADRAO_MS } = require("../server.js").require("salas");

const GRACA = 15000;

/** Relógio de teste: começa em T0 (onde os tokens são válidos) e só anda
 *  quando o teste manda. Serve ao gerenciador E à credencial — um relógio só,
 *  porque dois relógios inventariam uma verdade que produção não tem. */
function relogio() {
  let t = T0;
  return {
    agora: () => t,
    avancar(ms) { t += ms; return t; },
    get valor() { return t; },
  };
}

/** Mesa com 4 humanos e partida iniciada, com relógio e graça controlados.
 *  `chatPonte` é opcional: só os testes de canal a injetam. */
async function mesa({ humanos = 4, chatPonte = null, gracaAusenciaMs = GRACA, metaPontos = 3000 } = {}) {
  const rel = relogio();
  const srv = novoServidor(
    Object.assign(
      { agora: rel.agora, gracaAusenciaMs },
      chatPonte ? { chatPonte } : {}
    )
  );
  const jogadores = [];
  const dono = await cliente(srv, "uid-0");
  dono.envia({ tipo: "criarMesa", apelido: "Dono", jogadorId: "uid-0", metaPontos });
  jogadores.push(dono);
  const codigo = dono.ultimo("entrou").codigo;
  for (let i = 1; i < humanos; i++) {
    const c = await cliente(srv, "uid-" + i);
    c.envia({ tipo: "entrarMesa", codigo, apelido: "J" + i, jogadorId: "uid-" + i });
    jogadores.push(c);
  }
  dono.envia({ tipo: "iniciarPartida" });
  const sala = srv.ger.salas[codigo];
  return { srv, codigo, sala, jogadores, rel };
}

/** O assento que a conexão realmente ocupa (lido do servidor, nunca presumido
 *  pela ordem de entrada — quem distribui assento é o gerenciador). */
function assentoDe(srv, cli) {
  return srv.conexoes[cli.id] ? srv.conexoes[cli.id].assento : null;
}

function ctrl(sala, assento) {
  return sala.controle[assento];
}

/** Põe a vez no assento `alvo`, no INÍCIO de um turno.
 *
 *  Posiciona o ponteiro em vez de jogar a partida até lá, e isso é escolha, não
 *  atalho: o controlador não tem opinião sobre COMO a vez chegou ao assento —
 *  ele responde quem pode propor AGORA. A versão que jogava a partida podia não
 *  chegar ao assento (rodada encerrando, partida acabando) e o teste desistia
 *  em silêncio; um teste que desiste passa, e passar sem afirmar nada foi
 *  exatamente o que deixou duas mutações escaparem.
 *
 *  `jaComprou = false` porque o que se posiciona é o COMEÇO do turno: quem
 *  precisa do meio do turno liga a compra explicitamente, e aí a intenção fica
 *  escrita no teste em vez de depender do que sobrou do turno anterior. */
function porVezEm(sala, alvo) {
  sala.jogo.vez = alvo;
  sala.jogo.jaComprou = false;
  sala.jogo.deveUsarTopo = null;
  return alvo;
}

// ===========================================================================
describe("OS7 — posse e controle são entidades distintas", () => {
  test("CTRL-01: queda marca AUSENTE e não entrega o assento ao bot", async () => {
    const { srv, sala, jogadores } = await mesa();
    const a = assentoDe(srv, jogadores[1]);

    srv.desconectar(jogadores[1].id);

    assert.equal(ctrl(sala, a).estado, CONTROLE.HUMANO_AUSENTE, "queda virou bot na hora");
    assert.equal(ctrl(sala, a).motivo, MOTIVO_CONTROLE.QUEDA);
    // POSSE intacta: é ela que permite a volta, e é ela que o chat lê.
    assert.equal(sala.assentos[a].jogadorId, "uid-1", "a queda destruiu a posse");
    assert.equal(sala.assentos[a].tipo, "humano", "a queda mexeu na posse");
    // E nenhum bot foi anotado como substituto ainda.
    assert.equal(sala.substituicoes.length, 0);
  });

  test("CTRL-02: o controlador NÃO toca fase, mão, lixo, morto nem placar", async () => {
    const { srv, sala, jogadores } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    const j = sala.jogo;
    const antes = {
      vez: j.vez,
      jaComprou: j.jaComprou,
      mao: j.maos[a].length,
      monte: j.monte.length,
      lixo: j.lixo.length,
      mortos: j.mortos.length,
      placar: JSON.stringify(j.placar),
      topo: j.deveUsarTopo,
    };

    srv.desconectar(jogadores[1].id);

    assert.equal(j.vez, antes.vez, "o controlador mudou a vez");
    assert.equal(j.jaComprou, antes.jaComprou);
    assert.equal(j.maos[a].length, antes.mao);
    assert.equal(j.monte.length, antes.monte);
    assert.equal(j.lixo.length, antes.lixo);
    assert.equal(j.mortos.length, antes.mortos);
    assert.equal(JSON.stringify(j.placar), antes.placar);
    assert.equal(j.deveUsarTopo, antes.topo);
  });
});

// ===========================================================================
describe("OS7 — graça de ausência (§5, §17)", () => {
  test("CTRL-03: T-1 ainda é ausente, T já é bot, T+1 continua bot", async () => {
    // Três mesas independentes: a mesma pergunta em três instantes, sem que a
    // resposta de uma contamine a outra.
    for (const [nome, delta, esperado] of [
      ["T-1", GRACA - 1, CONTROLE.HUMANO_AUSENTE],
      ["T", GRACA, CONTROLE.BOT_SUBSTITUTO],
      ["T+1", GRACA + 1, CONTROLE.BOT_SUBSTITUTO],
    ]) {
      const { srv, codigo, sala, jogadores, rel } = await mesa();
      const a = assentoDe(srv, jogadores[1]);
      srv.desconectar(jogadores[1].id);
      rel.avancar(delta);
      srv.ger.verificarAusencias(codigo);
      assert.equal(ctrl(sala, a).estado, esperado, "instante " + nome);
    }
  });

  test("CTRL-04: retorno dentro da graça retoma sem NENHUMA ação de bot", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    const logAntes = sala.log.length;

    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA - 1);
    srv.ger.verificarAusencias(codigo);

    const volta = await cliente(srv, "uid-1");
    volta.envia({ tipo: "entrarMesa", codigo, apelido: "J1", jogadorId: "uid-1" });

    assert.equal(volta.ultimo("entrou").assento, a, "não recuperou o próprio assento");
    assert.equal(volta.ultimo("entrou").reconexao, true, "não foi tratado como reconexão");
    assert.equal(ctrl(sala, a).estado, CONTROLE.HUMANO_ATIVO);
    assert.equal(sala.substituicoes.length, 0, "houve substituição onde não devia");
    assert.equal(sala.log.length, logAntes, "algum bot jogou durante a graça");
  });

  test("CTRL-05: expiração entrega o assento a EXATAMENTE um bot", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);

    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    // Duas verificações seguidas: a segunda não pode assumir de novo.
    srv.ger.verificarAusencias(codigo);
    srv.ger.verificarAusencias(codigo);

    assert.equal(ctrl(sala, a).estado, CONTROLE.BOT_SUBSTITUTO);
    const doAssento = sala.substituicoes.filter((s) => s.assento === a);
    assert.equal(doAssento.length, 1, "mais de uma substituição para o mesmo assento");
    assert.equal(doAssento[0].uid, "uid-1", "a substituição perdeu o titular");
    assert.equal(doAssento[0].motivo, MOTIVO_CONTROLE.QUEDA);

    // E TODO caminho de perda de assento, repetido sobre um assento que JÁ é
    // bot, continua entregando uma substituição só. Sem isto, um segundo
    // `assumirPorBot` sobrescreveria o motivo e o instante do primeiro — o
    // fato competitivo passaria a mentir sobre quando o bot entrou.
    const motivoAntes = ctrl(sala, a).motivo;
    const desdeAntes = doAssento[0].desdeIso;
    srv.ger.ausentar({ codigo, assento: a, motivo: MOTIVO_CONTROLE.QUEDA });
    srv.ger.ausentar({ codigo, assento: a, motivo: MOTIVO_CONTROLE.AFK });
    // `sair` e o unico caminho que chega a `assumirPorBot` SEM guarda propria:
    // e por ele que um segundo takeover do mesmo assento entraria, se pudesse.
    srv.ger.sair({ codigo, assento: a });
    rel.avancar(GRACA * 3);
    srv.ger.verificarAusencias(codigo);
    assert.equal(
      sala.substituicoes.filter((s) => s.assento === a).length,
      1,
      "dois bots foram registrados para o mesmo assento"
    );
    assert.equal(ctrl(sala, a).motivo, motivoAntes, "o motivo do takeover foi sobrescrito");
    assert.equal(
      sala.substituicoes.find((s) => s.assento === a).desdeIso,
      desdeAntes,
      "o instante do takeover foi sobrescrito"
    );
  });
});

// ===========================================================================
describe("OS7 — retorno do proprietário (§6, §9)", () => {
  test("CTRL-06: nova conexão do MESMO proprietário recupera o assento", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[2]);
    srv.desconectar(jogadores[2].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    assert.equal(ctrl(sala, a).estado, CONTROLE.BOT_SUBSTITUTO, "pré-condição: bot assumiu");

    const volta = await cliente(srv, "uid-2");
    volta.envia({ tipo: "entrarMesa", codigo, apelido: "J2", jogadorId: "uid-2" });

    assert.equal(volta.ultimo("entrou").assento, a);
    assert.equal(srv.papelDe(srv.conexoes[volta.id]), "jogador");
    const sub = sala.substituicoes.find((s) => s.assento === a);
    assert.equal(sub.humanoVoltou, true, "a volta não foi registrada no fato competitivo");
  });

  test("CTRL-07: outro UID NÃO recupera assento alheio", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[2]);
    srv.desconectar(jogadores[2].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);

    const intruso = await cliente(srv, "uid-99");
    intruso.envia({ tipo: "entrarMesa", codigo, apelido: "Intruso", jogadorId: "uid-99" });

    assert.ok(intruso.ultimo("erro"), "o intruso entrou numa partida começada");
    assert.equal(intruso.ultimo("entrou"), null);
    assert.equal(assentoDe(srv, intruso), null);
    assert.equal(ctrl(sala, a).estado, CONTROLE.BOT_SUBSTITUTO, "o assento mudou de mãos");
    assert.equal(sala.assentos[a].jogadorId, "uid-2", "a posse foi transferida");
  });

  test("CTRL-08: retorno no meio do turno do bot espera a fronteira segura", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);

    // A única situação de "meio de turno" que existe para um assento: a vez é
    // dele e a compra já aconteceu.
    porVezEm(sala, a);
    sala.jogo.jaComprou = true;

    const r = srv.ger.retornar({ codigo, assento: a, jogadorId: "uid-1" });
    assert.equal(r.pendente, true, "devolveu o controle no meio do turno");
    assert.equal(ctrl(sala, a).estado, CONTROLE.BOT_SUBSTITUTO, "trocou antes da fronteira");
    assert.equal(ctrl(sala, a).retornoPendente, true);

    // Fronteira: com o turno fechado, o próximo passo devolve o assento.
    sala.jogo.jaComprou = false;
    srv.ger.avancarBots(sala);
    assert.equal(ctrl(sala, a).estado, CONTROLE.HUMANO_ATIVO, "não devolveu na fronteira");
  });

  test("CTRL-09: humano e bot nunca têm autoridade ao mesmo tempo", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    porVezEm(sala, a);

    // O humano voltou e é o dono: sob controle humano, o bot é RECUSADO.
    srv.ger.retornar({ codigo, assento: a, jogadorId: "uid-1" });
    const logAntes = sala.log.length;
    const recusa = srv.ger.proporAcaoDoAssento({ codigo, assento: a });
    assert.equal(recusa.ok, false, "o bot agiu num assento sob controle humano");
    // A recusa tem de vir da FRONTEIRA, não do motor lá dentro: se o gate de
    // autoridade sumisse, o motor ainda recusaria — por outro motivo — e um
    // teste que só olhasse `ok` não veria diferença nenhuma.
    assert.match(String(recusa.erro), /controle de bot/,
      "a recusa não veio do gate de autoridade");
    assert.equal(sala.log.length, logAntes, "a proposta recusada mexeu no log da partida");

    // E o inverso: assento ausente também não aceita proposta de bot.
    ctrl(sala, a).estado = CONTROLE.HUMANO_AUSENTE;
    const recusa2 = srv.ger.proporAcaoDoAssento({ codigo, assento: a });
    assert.equal(recusa2.ok, false, "o bot agiu num assento em graça");
    assert.match(String(recusa2.erro), /controle de bot/);
    assert.equal(sala.log.length, logAntes, "a proposta em graça mexeu no log da partida");
  });

  test("CTRL-10: duas conexões concorrentes deixam UMA autoridade", async () => {
    const { srv, codigo, jogadores } = await mesa();
    const a = assentoDe(srv, jogadores[1]);

    // O aparelho antigo continua aberto (o servidor não sabe que morreu) e o
    // novo reconecta com o mesmo UID.
    const nova = await cliente(srv, "uid-1");
    nova.envia({ tipo: "entrarMesa", codigo, apelido: "J1", jogadorId: "uid-1" });

    assert.equal(nova.ultimo("entrou").assento, a, "a reconexão não pegou o assento");
    assert.equal(assentoDe(srv, nova), a);
    assert.equal(assentoDe(srv, jogadores[1]), null, "duas conexões seguram o mesmo assento");
    assert.equal(srv.papelDe(srv.conexoes[jogadores[1].id]), "espectador");
    // A conexão desalojada é avisada — e não pode mais agir.
    const erro = jogadores[1].ultimo("erro");
    assert.equal(erro && erro.codigo, "ASSENTO_ASSUMIDO");
  });
});

// ===========================================================================
describe("OS7 — saída voluntária é terminal (§7)", () => {
  test("CTRL-11: `sair` entrega o assento na hora e fecha a volta", async () => {
    const { srv, codigo, sala, jogadores } = await mesa();
    const a = assentoDe(srv, jogadores[1]);

    jogadores[1].envia({ tipo: "sair" });

    assert.equal(ctrl(sala, a).estado, CONTROLE.BOT_SUBSTITUTO, "saída não entregou o assento");
    assert.equal(ctrl(sala, a).terminal, true);
    assert.equal(ctrl(sala, a).motivo, MOTIVO_CONTROLE.SAIDA);

    const volta = await cliente(srv, "uid-1");
    volta.envia({ tipo: "entrarMesa", codigo, apelido: "J1", jogadorId: "uid-1" });
    assert.ok(volta.ultimo("erro"), "quem saiu voltou a jogar");
    assert.equal(volta.ultimo("entrou"), null);
    assert.equal(assentoDe(srv, volta), null);
  });

  test("CTRL-12: saída voluntária não ganha a graça de 15 s", async () => {
    const { srv, sala, jogadores } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    jogadores[1].envia({ tipo: "sair" });
    // Sem avançar o relógio: já é bot.
    assert.notEqual(ctrl(sala, a).estado, CONTROLE.HUMANO_AUSENTE);
    assert.equal(ctrl(sala, a).estado, CONTROLE.BOT_SUBSTITUTO);
  });
});

// ===========================================================================
describe("OS7 — continuidade de fase (§10)", () => {
  test("CTRL-13: queda depois da compra — o bot NÃO compra de novo", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    porVezEm(sala, a);

    // O humano compra do monte e cai antes de terminar o turno.
    const r = srv.ger.aplicarJogada({ codigo, assento: a, jogada: { tipo: "comprarMonte" } });
    assert.ok(!r.erro, "pré-condição: a compra humana precisa valer");
    assert.equal(sala.jogo.jaComprou, true);
    const monteDepoisDaCompra = sala.jogo.monte.length;
    const lixoAntes = sala.jogo.lixo.length;

    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);

    // O bot assumiu DEPOIS da compra: o monte não pode ter andado de novo.
    assert.equal(
      sala.jogo.monte.length,
      monteDepoisDaCompra,
      "o bot comprou de novo num turno já iniciado"
    );
    // E fechou o turno com EXATAMENTE um descarte.
    assert.equal(sala.jogo.lixo.length, lixoAntes + 1, "o turno assumido não deu 1 descarte");
    assert.notEqual(sala.jogo.vez, a, "o turno assumido não terminou");
  });

  test("CTRL-14: takeover não reinicia o turno — a fase atravessa", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    porVezEm(sala, a);
    srv.ger.aplicarJogada({ codigo, assento: a, jogada: { tipo: "comprarMonte" } });
    const maoDepoisDaCompra = sala.jogo.maos[a].length;

    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);

    // A mão não voltou ao tamanho de antes da compra (turno reiniciado), nem
    // cresceu de novo (compra dobrada). Ela só pode ter DIMINUÍDO — descarte e
    // eventuais baixadas.
    assert.ok(
      sala.jogo.maos[a].length < maoDepoisDaCompra,
      "a mão não evoluiu como um turno continuado"
    );
  });
});

// ===========================================================================
describe("OS7 — quedas múltiplas (§15.11, §15.12)", () => {
  test("CTRL-15: dois jogadores caem e cada assento tem seu controlador", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a1 = assentoDe(srv, jogadores[1]);
    const a2 = assentoDe(srv, jogadores[2]);

    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA - 1);
    srv.desconectar(jogadores[2].id); // cai 1 ms antes de a graça do primeiro vencer
    srv.ger.verificarAusencias(codigo);

    // O primeiro ainda está na graça; o segundo acabou de cair.
    assert.equal(ctrl(sala, a1).estado, CONTROLE.HUMANO_AUSENTE);
    assert.equal(ctrl(sala, a2).estado, CONTROLE.HUMANO_AUSENTE);

    rel.avancar(1); // vence a graça do PRIMEIRO só
    srv.ger.verificarAusencias(codigo);
    assert.equal(ctrl(sala, a1).estado, CONTROLE.BOT_SUBSTITUTO, "o primeiro não expirou");
    assert.equal(ctrl(sala, a2).estado, CONTROLE.HUMANO_AUSENTE, "o segundo expirou junto");

    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    assert.equal(ctrl(sala, a2).estado, CONTROLE.BOT_SUBSTITUTO);
  });

  test("CTRL-16: os quatro humanos podem terminar substituídos e a mesa anda", async () => {
    // Meta baixa: o que se afirma é que a mesa ANDA com quatro bots, não que
    // ela jogue 3000 pontos — e uma partida curta mantém a suite rapida.
    const { srv, codigo, sala, jogadores, rel } = await mesa({ metaPontos: 60 });
    const logAntes = sala.log.length;
    // A POSSE é lida do servidor: quem distribui assento é o gerenciador, e a
    // ordem parceiro-primeiro (0,2,1,3) nao casa com a ordem de entrada.
    const posse = jogadores.map((c) => [assentoDe(srv, c), srv.conexoes[c.id].jogadorId]);
    for (const c of jogadores) srv.desconectar(c.id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);

    for (const [assento, uid] of posse) {
      assert.equal(ctrl(sala, assento).estado, CONTROLE.BOT_SUBSTITUTO, "assento " + assento);
      assert.equal(sala.assentos[assento].jogadorId, uid, "posse perdida no assento " + assento);
    }
    assert.equal(sala.substituicoes.length, 4);
    assert.ok(sala.log.length > logAntes, "com quatro bots a mesa não andou");
  });
});

// ===========================================================================
describe("OS7 — fato competitivo (§13)", () => {
  test("CTRL-17: caiu e voltou dentro da graça não produz fato nenhum", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA - 1);
    const volta = await cliente(srv, "uid-1");
    volta.envia({ tipo: "entrarMesa", codigo, jogadorId: "uid-1" });
    assert.equal(sala.substituicoes.length, 0, "graça produziu fato competitivo");
  });

  test("CTRL-18: o fato distingue bot que AGIU de bot que só assumiu", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    // Garante que a vez NÃO é dele: assumir não deve, por si, marcar ação.
    porVezEm(sala, (a + 1) % 4);

    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    const sub = sala.substituicoes.find((s) => s.assento === a);
    assert.ok(sub, "o takeover não foi registrado");
    assert.equal(sub.botAgiu, false, "assumir não é agir");
    assert.equal(sub.uid, "uid-1");
    assert.ok(sub.desdeIso, "o fato não tem instante");

    // Agora o bot joga de fato por aquele assento — sem "se".
    porVezEm(sala, a);
    const r = srv.ger.proporAcaoDoAssento({ codigo, assento: a });
    assert.equal(r.ok, true, "o bot substituto não conseguiu jogar o turno");
    assert.equal(sub.botAgiu, true, "o bot jogou e o fato não registrou");
  });

  test("CTRL-19: o envelope de encerramento carrega as substituições", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesa();
    const a = assentoDe(srv, jogadores[1]);
    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);

    // Encerra a partida à força pelo caminho do próprio motor.
    sala.jogo.placar.nos = sala.jogo.metaPontos + 10;
    sala.jogo.encerrada = true;
    srv.ger.liquidar(sala);

    const env = sala.envelopeEncerramento;
    assert.ok(env, "a partida encerrou sem envelope");
    assert.ok(Array.isArray(env.substituicoes), "o envelope não tem o fato competitivo");
    const doAssento = env.substituicoes.find((s) => s.assento === a);
    assert.ok(doAssento, "substituição ausente do envelope");
    assert.equal(doAssento.uid, "uid-1");
    assert.equal(typeof doAssento.botAgiu, "boolean");
    // O servidor NÃO calcula rating: nada de delta, nem de pontuação aqui.
    assert.equal(doAssento.rating, undefined);
    assert.equal(doAssento.delta, undefined);
  });
});

// ===========================================================================
describe("OS7 — o canal de chat sobrevive (§14)", () => {
  function ponteEspiã() {
    const chamadas = [];
    return {
      chamadas,
      ponte: {
        definirCanal(arg) { chamadas.push(arg); return Promise.resolve({ ok: true }); },
        enviarPeloMotor() { return Promise.resolve({ ok: true, destinatarios: [], dados: {} }); },
      },
    };
  }

  test("CTRL-20: queda temporária não remove o participante do canal", async () => {
    const { chamadas, ponte } = ponteEspiã();
    const { srv, jogadores } = await mesa({ chatPonte: ponte });
    await new Promise((r) => setImmediate(r));
    const antes = chamadas.length;

    srv.desconectar(jogadores[1].id);
    await new Promise((r) => setImmediate(r));

    const ultima = chamadas[chamadas.length - 1];
    assert.ok(ultima, "nenhum canal foi declarado");
    const uids = ultima.participantes.map((p) => p.uid).sort();
    assert.deepEqual(uids, ["uid-0", "uid-1", "uid-2", "uid-3"], "a queda mexeu no canal");
    assert.equal(chamadas.length, antes, "a queda ressincronizou o canal à toa");
  });

  test("CTRL-21: bot substituto NÃO entra no canal, e a posse continua lá", async () => {
    const { chamadas, ponte } = ponteEspiã();
    const { srv, codigo, jogadores, rel } = await mesa({ chatPonte: ponte });
    await new Promise((r) => setImmediate(r));

    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    srv.broadcastSala(codigo);
    await new Promise((r) => setImmediate(r));

    const ultima = chamadas[chamadas.length - 1];
    const uids = ultima.participantes.map((p) => p.uid).sort();
    assert.deepEqual(uids, ["uid-0", "uid-1", "uid-2", "uid-3"],
      "o substituto mexeu na composição do canal");
    for (const p of ultima.participantes) {
      assert.ok(typeof p.uid === "string" && p.uid.startsWith("uid-"), "participante sem pessoa");
    }
  });

  test("CTRL-22: reconexão não cria canal novo", async () => {
    const { chamadas, ponte } = ponteEspiã();
    const { srv, codigo, jogadores, rel } = await mesa({ chatPonte: ponte });
    await new Promise((r) => setImmediate(r));
    const canalAntes = chamadas[chamadas.length - 1].canalId;
    const quantasAntes = chamadas.length;

    srv.desconectar(jogadores[2].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    const volta = await cliente(srv, "uid-2");
    volta.envia({ tipo: "entrarMesa", codigo, jogadorId: "uid-2" });
    await new Promise((r) => setImmediate(r));

    assert.equal(chamadas.length, quantasAntes, "a reconexão declarou canal de novo");
    if (chamadas.length > 0) {
      assert.equal(chamadas[chamadas.length - 1].canalId, canalAntes, "o canal mudou de id");
    }
  });
});

// ===========================================================================
describe("OS7 — o cliente não decide (§8)", () => {
  test("CTRL-23: afkBot age sobre o assento DA CONEXÃO, não o do payload", async () => {
    const { srv, sala, jogadores } = await mesa();
    const meu = assentoDe(srv, jogadores[1]);
    const alheio = assentoDe(srv, jogadores[2]);

    // Sem `jogadorId` no payload de proposito: identidade divergente ja e
    // recusada antes do despacho (composicao WS-AUTH), e o alvo deste caso e o
    // ASSENTO pedido no payload, que o despachante tem de ignorar.
    jogadores[1].envia({ tipo: "afkBot", assento: alheio });

    assert.equal(ctrl(sala, meu).estado, CONTROLE.BOT_SUBSTITUTO, "o próprio assento não mudou");
    assert.equal(ctrl(sala, alheio).estado, CONTROLE.HUMANO_ATIVO, "o payload escolheu assento alheio");
  });

  test("CTRL-24: afkVoltar de quem não é o dono não devolve nada", async () => {
    const { srv, codigo, sala, jogadores } = await mesa();
    const alheio = assentoDe(srv, jogadores[2]);
    jogadores[2].envia({ tipo: "afkBot" });
    assert.equal(ctrl(sala, alheio).estado, CONTROLE.BOT_SUBSTITUTO);

    // Uma conexão de OUTRO uid, sentada em outro assento, tenta devolver o dele.
    const c = srv.conexoes[jogadores[1].id];
    const r = srv.ger.retornar({ codigo, assento: alheio, jogadorId: c.jogadorId });
    assert.ok(r.erro, "um jogador devolveu o assento de outro");
    assert.equal(ctrl(sala, alheio).estado, CONTROLE.BOT_SUBSTITUTO);
  });

  test("CTRL-25: espectador não move o controlador de ninguém", async () => {
    const { srv, codigo, sala } = await mesa();
    const esp = await cliente(srv, "uid-espectador");
    esp.envia({ tipo: "assistirMesa", codigo });
    esp.envia({ tipo: "afkBot" });
    esp.envia({ tipo: "afkVoltar" });

    for (let i = 0; i < 4; i++) {
      assert.equal(ctrl(sala, i).estado, CONTROLE.HUMANO_ATIVO, "assento " + i + " foi movido");
    }
    assert.equal(assentoDe(srv, esp), null);
  });

  test("CTRL-26: a graça é configuração do servidor, não do payload", async () => {
    // Padrão declarado.
    assert.equal(GRACA_AUSENCIA_PADRAO_MS, 15000);
    // E um servidor com graça própria não a herda de mensagem nenhuma.
    const { srv, codigo, sala, jogadores, rel } = await mesa({ gracaAusenciaMs: 5000 });
    const a = assentoDe(srv, jogadores[1]);
    srv.desconectar(jogadores[1].id);
    rel.avancar(4999);
    srv.ger.verificarAusencias(codigo);
    assert.equal(ctrl(sala, a).estado, CONTROLE.HUMANO_AUSENTE);
    rel.avancar(1);
    srv.ger.verificarAusencias(codigo);
    assert.equal(ctrl(sala, a).estado, CONTROLE.BOT_SUBSTITUTO);
  });
});

// ===========================================================================
describe("OS7 — o canal só tem gente (§14, §21 do chat)", () => {
  test("CTRL-27: mesa com bots de mesa declara SÓ os humanos no canal", async () => {
    const chamadas = [];
    const ponte = {
      definirCanal(arg) { chamadas.push(arg); return Promise.resolve({ ok: true }); },
      enviarPeloMotor() { return Promise.resolve({ ok: true, destinatarios: [], dados: {} }); },
    };
    // Dois humanos: os outros dois assentos nascem BOT DE MESA, sem dono.
    const { srv, codigo, sala, jogadores, rel } = await mesa({ humanos: 2, chatPonte: ponte });
    await new Promise((r) => setImmediate(r));

    const humanos = jogadores.map((c) => srv.conexoes[c.id].jogadorId).sort();
    const ultima = chamadas[chamadas.length - 1];
    assert.ok(ultima, "nenhum canal declarado");
    assert.deepEqual(ultima.participantes.map((p) => p.uid).sort(), humanos,
      "o canal recebeu quem não é pessoa");

    // E continua assim depois de um takeover: o bot substituto não entra, e o
    // dono do assento não sai.
    srv.desconectar(jogadores[1].id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    srv.broadcastSala(codigo);
    await new Promise((r) => setImmediate(r));
    const depois = chamadas[chamadas.length - 1];
    assert.deepEqual(depois.participantes.map((p) => p.uid).sort(), humanos,
      "o takeover mexeu na composição do canal");
    assert.equal(sala.controle.filter((c) => c.estado === "bot_de_mesa").length, 2);
  });
});
