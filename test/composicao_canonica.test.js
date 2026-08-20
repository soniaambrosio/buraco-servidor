// test/composicao_canonica.test.js — A COMPOSIÇÃO NÃO APAGOU NENHUM LADO.
//
// Esta suíte não repete o que as três folhas já provam separadamente. Ela existe
// para o caso contrário: cada asserção aqui cruza DUAS ou TRÊS autoridades que
// nunca conviveram no mesmo servidor antes desta composição —
//
//   * a meta autoritativa da mesa (1500/2000/3000, padrão 2000);
//   * o controlador de assento (posse ≠ controle, graça, retorno humano);
//   * o transporte de chat (canal da SALA, servidor é transporte);
//   * a admissão VIP (que pode ser ASSÍNCRONA) e a credencial única do motor.
//
// O critério para um caso entrar aqui é estreito: ele tem de FALHAR se alguém
// escolher uma folha em vez de compor. Caso que passaria em qualquer uma das
// folhas isoladas pertence à suíte dela, não a esta.

"use strict";

const test = require("node:test");
const { describe } = test;
const assert = require("node:assert");

const { novoServidor, cliente, mesaComPartida, T0 } = require("./ajuda");

const bundle = require("../server.js");
const { CONTROLE, MOTIVO_CONTROLE, METAS_CANONICAS, META_PADRAO } = bundle.require("salas");
const {
  canalIdDeCodigo, composicaoDoCanal, canalAberto,
  CHAT_FIO, CHAT_ACK, CHAT_RECUSA, CHAT_SUPERFICIE_MESA,
} = bundle.require("servidor");
const { criarPonteDeChat } = bundle.require("chat_ponte");

const GRACA = 15000;

/** Espera as promessas pendentes (canal e envio são assíncronos). */
const drenar = () => new Promise((r) => setImmediate(r));

/** Ponte dublada mínima: registra o que o servidor pediu. */
function pontefalsa(opts = {}) {
  const canais = [];
  const envios = [];
  let n = 0;
  return {
    canais,
    envios,
    configurada: () => true,
    definirCanal(pedido) {
      canais.push(JSON.parse(JSON.stringify(pedido)));
      return Promise.resolve({ definido: true, canalId: pedido.canalId });
    },
    enviarMensagem(pedido) {
      envios.push(JSON.parse(JSON.stringify(pedido)));
      n++;
      return Promise.resolve({
        enviada: true,
        jaEnviada: false,
        mensagem: {
          messageId: "msg" + n,
          autorPublicId: "PUB",
          superficie: pedido.superficie,
          canalId: pedido.canalId,
          conteudo: pedido.conteudo,
          enviadaEm: "2026-01-01T12:00:00.000Z",
          esquema: 1,
        },
        destinatarios: opts.destinatarios ? opts.destinatarios(pedido) : [],
      });
    },
  };
}

/** Relógio movível, com o mesmo T0 dos tokens das suítes. */
function relogioMovel() {
  let t = T0;
  return { agora: () => t, avancar(ms) { t += ms; return t; } };
}

/** Mesa iniciada com 4 humanos, meta CANÔNICA de verdade e relógio movível. */
async function mesaCanonica({ metaPontos, chatPonte, destinatarios } = {}) {
  assert.ok(METAS_CANONICAS.includes(metaPontos), "esta suíte só monta mesa canônica");
  const rel = relogioMovel();
  const ponte = chatPonte || pontefalsa({ destinatarios });
  const r = await mesaComPartida({
    metaPontos,
    servidor: { agora: rel.agora, gracaAusenciaMs: GRACA, chatPonte: ponte },
  });
  return Object.assign({ rel, ponte }, r);
}

const assentoDe = (srv, c) => (srv.conexoes[c.id] ? srv.conexoes[c.id].assento : null);

// ===========================================================================
describe("COMPOSIÇÃO — a meta sobrevive ao controlador", () => {
  test("COMP-01: mesa de 1500, humano cai e volta — a meta não se move em nenhum passo", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesaCanonica({ metaPontos: 1500 });
    const alvo = jogadores[1];
    const assento = assentoDe(srv, alvo);

    assert.equal(sala.metaPontos, 1500, "a mesa nasceu com a meta pedida");
    assert.equal(sala.jogo.metaPontos, 1500, "e a partida herdou a meta da mesa");

    srv.desconectar(alvo.id);
    assert.equal(sala.controle[assento].estado, CONTROLE.HUMANO_AUSENTE);
    assert.equal(sala.controle[assento].motivo, MOTIVO_CONTROLE.QUEDA);
    assert.equal(sala.metaPontos, 1500, "a queda mexeu na meta");
    assert.equal(sala.jogo.metaPontos, 1500, "a queda mexeu na meta do jogo");

    // Volta DENTRO da graça, pela porta de produção.
    rel.avancar(GRACA - 1);
    const volta = await cliente(srv, "uid-1");
    volta.envia({ tipo: "entrarMesa", codigo, jogadorId: "uid-1" });

    assert.equal(sala.controle[assento].estado, CONTROLE.HUMANO_ATIVO, "o dono não retomou o assento");
    assert.equal(assentoDe(srv, volta), assento, "voltou em assento diferente");
    assert.equal(sala.metaPontos, 1500, "o retorno mexeu na meta");
    assert.equal(sala.jogo.metaPontos, 1500, "o retorno mexeu na meta do jogo");
    assert.equal(sala.substituicoes.length, 0, "graça não produz fato competitivo");
  });

  test("COMP-02: mesa de 3000, takeover por bot — a meta não é redecidida pelo substituto", async () => {
    const { srv, codigo, sala, jogadores, rel } = await mesaCanonica({ metaPontos: 3000 });
    const alvo = jogadores[1];
    const assento = assentoDe(srv, alvo);
    // A vez é DELE: assim o bot que assume também AGE, e `botAgiu` fica exercido
    // no mesmo caso em que a meta é conferida.
    sala.jogo.vez = assento;
    sala.jogo.jaComprou = false;
    sala.jogo.deveUsarTopo = null;

    srv.desconectar(alvo.id);
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);

    assert.equal(sala.controle[assento].estado, CONTROLE.BOT_SUBSTITUTO, "o bot não assumiu");
    const sub = sala.substituicoes.find((s) => s.assento === assento);
    assert.ok(sub, "o takeover não virou fato competitivo");
    assert.equal(sub.uid, "uid-1", "o fato perdeu o dono do assento");
    assert.equal(sub.botAgiu, true, "o bot assumiu com a vez na mão e não agiu");
    // POSSE intacta: o bot controla, não passa a possuir.
    assert.equal(sala.assentos[assento].jogadorId, "uid-1", "o takeover destruiu a posse");
    // E a meta continua sendo a da MESA.
    assert.equal(sala.metaPontos, 3000);
    assert.equal(sala.jogo.metaPontos, 3000, "o substituto redecidiu a meta");
  });

  test("COMP-03: reconexão não altera metaPontos, nem quando o cliente insiste", async () => {
    const { srv, codigo, sala } = await mesaCanonica({ metaPontos: 1500 });

    const volta = await cliente(srv, "uid-1");
    // O cliente manda metaPontos na reconexão. É exatamente o que um cliente
    // desatualizado (ou malicioso) faria, e não pode mudar nada.
    volta.envia({ tipo: "entrarMesa", codigo, jogadorId: "uid-1", metaPontos: 3000 });

    assert.equal(sala.metaPontos, 1500, "a reconexão trocou a meta da mesa");
    assert.equal(sala.jogo.metaPontos, 1500, "a reconexão trocou a meta do jogo");
    // E a trava é estrutural, não só comportamental.
    assert.throws(() => { "use strict"; sala.metaPontos = 3000; }, "a meta da sala virou gravável");
  });
});

// ===========================================================================
describe("COMPOSIÇÃO — o canal de chat sobrevive ao controlador", () => {
  test("COMP-04: queda e reconexão mantêm o MESMO canal e a MESMA composição", async () => {
    const { srv, codigo, sala, jogadores, rel, ponte } = await mesaCanonica({ metaPontos: 2000 });
    await drenar();

    const canalId = canalIdDeCodigo(codigo);
    const uidsDoCanal = (sl) => composicaoDoCanal(sl).map((p) => p.uid).sort();
    const composicaoAntes = uidsDoCanal(sala);
    const canaisAntes = ponte.canais.length;
    assert.equal(canalAberto(sala), true);
    assert.equal(composicaoAntes.length, 4, "os quatro sentados estão no canal");

    // QUEDA — o canal lê POSSE (`sala.assentos`), não conexão.
    srv.desconectar(jogadores[1].id);
    srv.broadcastSala(codigo);
    await drenar();
    assert.deepEqual(uidsDoCanal(sala), composicaoAntes,
      "a queda tirou alguém do canal");
    assert.equal(canalAberto(sala), true, "a queda fechou o canal");

    // TAKEOVER — o bot controla o assento e continua sem entrar no canal.
    rel.avancar(GRACA);
    srv.ger.verificarAusencias(codigo);
    srv.broadcastSala(codigo);
    await drenar();
    assert.deepEqual(uidsDoCanal(sala), composicaoAntes,
      "o bot substituto entrou no canal");

    // VOLTA — mesmo canal, nenhuma redeclaração de composição.
    const volta = await cliente(srv, "uid-1");
    volta.envia({ tipo: "entrarMesa", codigo, jogadorId: "uid-1" });
    await drenar();
    assert.equal(canalIdDeCodigo(codigo), canalId, "a volta criou outro canal");
    assert.deepEqual(uidsDoCanal(sala), composicaoAntes);
    assert.equal(ponte.canais.length, canaisAntes,
      "composição igual e mesmo assim a autoridade foi chamada de novo");
  });

  test("COMP-05: revanche mantém a meta e reabre o canal", async () => {
    const { srv, codigo, sala, jogadores, ponte } = await mesaCanonica({ metaPontos: 1500 });
    await drenar();
    const canalId = canalIdDeCodigo(codigo);
    const partidaAntes = sala.partidaId;

    // Encerramento: `liquidada` é a marca de `salas.js`, e é ela que fecha.
    sala.liquidada = true;
    srv.broadcastSala(codigo);
    await drenar();
    assert.equal(canalAberto(sala), false, "o encerramento não fechou o canal");
    assert.equal(ponte.canais[ponte.canais.length - 1].aberto, false);

    // REVANCHE: a sala é reaproveitável, a partida não. Passa pelo MESMO
    // `iniciarPartida`, que é onde o controlador e a meta são reconstruídos.
    sala.iniciada = false;
    jogadores[0].envia({ tipo: "iniciarPartida" });
    await drenar();

    assert.equal(sala.metaPontos, 1500, "a revanche redecidiu a meta da mesa");
    assert.equal(sala.jogo.metaPontos, 1500, "a revanche redecidiu a meta do jogo");
    assert.notEqual(sala.partidaId, partidaAntes, "a revanche reaproveitou a identidade da partida");
    assert.equal(canalIdDeCodigo(codigo), canalId, "a revanche trocou o canal");
    assert.equal(canalAberto(sala), true, "a revanche não reabriu o canal");
    assert.equal(ponte.canais[ponte.canais.length - 1].aberto, true);
    assert.equal(sala.substituicoes.length, 0, "o fato competitivo da partida anterior vazou");
  });

  test("COMP-06: espectador autenticado não age, não fala e não recebe", async () => {
    const { srv, codigo, sala, jogadores } = await mesaCanonica({
      metaPontos: 2000,
      destinatarios: () => ["uid-espectador"], // a autoridade ERRA de propósito
    });
    await drenar();

    const olho = await cliente(srv, "uid-espectador");
    olho.envia({ tipo: "assistirMesa", codigo });
    await drenar();

    assert.equal(srv.conexoes[olho.id].assento, null, "espectador ganhou assento");
    assert.equal(composicaoDoCanal(sala).some((p) => p.uid === "uid-espectador"), false,
      "espectador entrou na composição do canal");

    // Não AGE: nem jogada, nem controlador.
    const vezAntes = sala.jogo.vez;
    olho.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    olho.envia({ tipo: "sair" });
    assert.equal(sala.jogo.vez, vezAntes, "espectador mexeu na vez");
    assert.equal(sala.assentos.filter((a) => a && a.tipo === "humano").length, 4,
      "espectador derrubou alguém do assento");

    // Não FALA.
    olho.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "e1", texto: "oi" });
    await drenar();
    assert.equal(olho.ultimo(CHAT_FIO.RECIBO).resultado, CHAT_ACK.RECUSADA);
    assert.equal(olho.ultimo(CHAT_FIO.RECIBO).codigo, CHAT_RECUSA.SEM_ASSENTO);

    // E não RECEBE, nem quando a autoridade o lista por engano.
    jogadores[0].envia({ tipo: CHAT_FIO.PEDIDO, intentId: "j1", texto: "boa" });
    await drenar();
    assert.equal(olho.todas(CHAT_FIO.ENTREGA).length, 0,
      "espectador recebeu chat porque a autoridade errou");
  });

  test("COMP-07: credencial vencida recusa o chat sem destruir a partida", async () => {
    // A ponte é a REAL. Quem falha é a credencial, exatamente como falharia um
    // refresh token revogado no Railway — e o caminho de rede nunca é alcançado.
    let chamouRede = 0;
    const credencialVencida = {
      configurada: () => true,
      estado: () => ({ configurada: true, faltando: [] }),
      obterIdToken: () => Promise.reject(Object.assign(new Error("x"), { codigo: "REFRESH_TOKEN_INVALIDO" })),
    };
    const ponte = criarPonteDeChat({
      credencial: credencialVencida,
      baseUrl: "https://exemplo.invalido",
      chamar: () => { chamouRede++; return Promise.resolve({ status: 200, json: { result: {} } }); },
    });

    const { srv, codigo, sala, jogadores } = await mesaCanonica({ metaPontos: 2000, chatPonte: ponte });
    await drenar();

    const assentosAntes = JSON.stringify(sala.assentos);
    const controleAntes = JSON.stringify(sala.controle);
    const vezAntes = sala.jogo.vez;

    jogadores[0].envia({ tipo: CHAT_FIO.PEDIDO, intentId: "c1", texto: "alguém aí?" });
    await drenar();

    const ack = jogadores[0].ultimo(CHAT_FIO.RECIBO);
    assert.equal(ack.resultado, CHAT_ACK.RECUSADA, "credencial vencida virou aprovação");
    assert.ok(Object.values(CHAT_RECUSA).includes(ack.codigo),
      "o código que atravessou o fio não é do vocabulário redigido: " + ack.codigo);
    assert.equal(JSON.stringify(ack).includes("REFRESH_TOKEN"), false,
      "o motivo interno da credencial vazou para o cliente");
    assert.equal(chamouRede, 0, "sem credencial, a rede não é chamada");

    // A PARTIDA SEGUE. É este o ponto: chat indisponível não pode derrubar mesa.
    assert.equal(JSON.stringify(sala.assentos), assentosAntes, "os assentos mudaram");
    assert.equal(JSON.stringify(sala.controle), controleAntes, "o controlador mudou");
    assert.equal(sala.jogo.vez, vezAntes, "a vez mudou");
    assert.equal(sala.jogo.encerrada, false, "a partida encerrou");
    assert.equal(sala.metaPontos, 2000, "a meta mudou");
    assert.ok(srv.ger.salas[codigo], "a mesa sumiu");
  });
});

// ===========================================================================
describe("COMPOSIÇÃO — meta inválida morre antes de tudo", () => {
  test("COMP-08: meta inválida não cria sala e não declara canal", async () => {
    for (const meta of [1999, 100, "2000", null, 0, -2000, 2000.5, NaN]) {
      const ponte = pontefalsa();
      const srv = novoServidor({ chatPonte: ponte });
      const c = await cliente(srv, "uid-0");
      c.envia({ tipo: "criarMesa", apelido: "Dono", metaPontos: meta });
      await drenar();

      assert.equal(c.ultimo("entrou"), null, "meta " + String(meta) + " sentou alguém");
      assert.deepEqual(Object.keys(srv.ger.salas), [], "meta " + String(meta) + " criou sala");
      assert.equal(ponte.canais.length, 0, "meta " + String(meta) + " declarou canal");
      assert.equal(srv.conexoes[c.id].assento, null);
    }
  });

  test("COMP-09: a AUSÊNCIA da meta cria mesa canônica de 2000, com canal", async () => {
    // A contrapartida do caso acima, e a razão de ele não ser "recusa tudo":
    // recusar ≠ cair no padrão, e só a ausência cai.
    const ponte = pontefalsa();
    const srv = novoServidor({ chatPonte: ponte });
    const c = await cliente(srv, "uid-0");
    c.envia({ tipo: "criarMesa", apelido: "Dono" });
    await drenar();

    const codigo = c.ultimo("entrou").codigo;
    assert.equal(srv.ger.salas[codigo].metaPontos, META_PADRAO);
    assert.equal(META_PADRAO, 2000);
    assert.equal(ponte.canais.length, 1, "a mesa canônica não declarou canal");
    assert.equal(ponte.canais[0].canalId, canalIdDeCodigo(codigo));
    // [COMUNICACAO CONTROLADA] A superficie saiu do pedido de canal na versao 2
    // do contrato: a autoridade a deriva do ambiente. O que o canal declara
    // agora sao as duas dimensoes da mesa — e a mesa canonica desta suite, sem
    // topologia declarada, e `publica`.
    assert.equal("superficie" in ponte.canais[0], false);
    assert.equal(ponte.canais[0].tipoPartida, "publica");
  });
});

// ===========================================================================
describe("COMPOSIÇÃO — a admissão VIP e o controlador na mesma porta", () => {
  /** Servidor VIP cuja autorização responde por PROMESSA, como o backend real. */
  function servidorVip() {
    const pendentes = [];
    const srv = novoServidor({
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: () => new Promise((resolve) => pendentes.push(resolve)),
    });
    return {
      srv,
      pendentes,
      /** Libera as autorizações pendentes e deixa as promessas correrem. */
      async liberar() {
        while (pendentes.length) pendentes.shift()({ ok: true });
        await drenar();
        await drenar();
      },
    };
  }

  test("COMP-10: enquanto o backend não responde, ninguém senta e ninguém é desalojado", async () => {
    // É POR ISTO que o §15.10 não pôde ficar no despachante: lá ele rodaria
    // ANTES da resposta do backend, rebaixando a conexão velha por uma entrada
    // que ainda pode ser recusada.
    const v = servidorVip();
    const dono = await cliente(v.srv, "uid-0");
    v.srv.processar(dono.id, { tipo: "criarMesa", apelido: "Dono" });
    await v.liberar();
    const codigo = dono.ultimo("entrou").codigo;

    const b = await cliente(v.srv, "uid-1");
    v.srv.processar(b.id, { tipo: "entrarMesa", codigo, apelido: "B" });
    await drenar();

    assert.equal(b.ultimo("entrou"), null, "sentou antes de o backend responder");
    assert.equal(v.srv.conexoes[b.id].assento, null, "o assento foi ocupado sem veredito");
    assert.equal(dono.ultimo("erro"), null, "o dono foi desalojado por uma entrada pendente");
    assert.equal(v.srv.conexoes[dono.id].assento, 0, "o dono perdeu o assento");

    await v.liberar();
    assert.ok(b.ultimo("entrou"), "o veredito chegou e ninguém sentou");
    assert.equal(v.srv.conexoes[dono.id].assento, 0, "o dono foi desalojado por outro assento");
  });

  test("COMP-11: reconexão em mesa VIP desaloja a conexão anterior e se declara reconexão", async () => {
    const v = servidorVip();
    const dono = await cliente(v.srv, "uid-0");
    v.srv.processar(dono.id, { tipo: "criarMesa", apelido: "Dono" });
    await v.liberar();
    const codigo = dono.ultimo("entrou").codigo;
    assert.equal(dono.ultimo("entrou").reconexao, false, "entrada nova se declarou reconexão");

    const b = await cliente(v.srv, "uid-1");
    v.srv.processar(b.id, { tipo: "entrarMesa", codigo, apelido: "B" });
    await v.liberar();
    const assentoB = v.srv.conexoes[b.id].assento;
    assert.ok(Number.isInteger(assentoB), "B não sentou");

    dono.envia({ tipo: "iniciarPartida" });

    // Segundo aparelho do MESMO jogador. Passa pela porta VIP e cai na
    // reconexão de `salas` — que não consulta o backend, porque não é entrada.
    const b2 = await cliente(v.srv, "uid-1");
    v.srv.processar(b2.id, { tipo: "entrarMesa", codigo, apelido: "B" });
    await v.liberar();

    assert.equal(b2.ultimo("entrou").reconexao, true, "a volta não se declarou reconexão");
    assert.equal(v.srv.conexoes[b2.id].assento, assentoB, "voltou em outro assento");
    // UMA autoridade por assento: o aparelho velho vira espectador NA HORA.
    assert.equal(v.srv.conexoes[b.id].assento, null, "duas conexões ficaram com o mesmo assento");
    assert.equal(b.ultimo("erro").codigo, "ASSENTO_ASSUMIDO");
    // E a posse não se moveu: quem possui é o UID, e ele é o mesmo.
    assert.equal(v.srv.ger.salas[codigo].assentos[assentoB].jogadorId, "uid-1");
  });
});
