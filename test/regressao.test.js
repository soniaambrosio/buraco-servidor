// test/regressao.test.js — O JOGADOR NORMAL CONTINUA IGUAL (§18 da OS).
//
// O enforcement de espectador só vale se não tiver custado nada a quem senta:
// esta suíte exercita início, compra, descarte, turno, morto, batida, nova
// rodada, reconexão, idempotência e finalização pelo protocolo de verdade.
//
// Não havia suíte no repositório do servidor antes desta OS — estes são também
// o primeiro portão de regressão do bundle.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { J, T0, novoServidor, cliente, mesaComPartida } = require("./ajuda.js");

/** Índice do assento que uma conexão ocupa, segundo o SERVIDOR. */
function assentoDe(srv, c) {
  return srv.conexoes[c.id].assento;
}

/** A conexão sentada no assento pedido. */
function porAssento(srv, jogadores, assento) {
  return jogadores.find((j) => assentoDe(srv, j) === assento);
}

/** Sequência limpa de 7 cartas (canastra) — 3..9 do mesmo naipe, sem coringa. */
function canastraLimpa(naipe = "copas", prefixo = "k") {
  return ["3", "4", "5", "6", "7", "8", "9"].map((valor, i) => ({
    id: prefixo + "-" + i,
    naipe,
    valor,
    eh_coringa: false,
  }));
}

describe("§18 — regressão do jogador", () => {
  test("REG-01: início de partida distribui a mesa como sempre", async () => {
    const { sala, jogadores, srv } = await mesaComPartida();
    const jogo = sala.jogo;

    assert.equal(jogo.rodada, 1);
    assert.equal(jogo.vez, 0);
    assert.equal(jogo.jaComprou, false);
    for (let a = 0; a < 4; a++) assert.equal(jogo.maos[a].length, J.CARTAS_POR_MAO);
    assert.equal(jogo.mortos.length, 2);
    for (const m of jogo.mortos) assert.equal(m.length, J.CARTAS_POR_MORTO);
    assert.equal(jogo.lixo.length, 0);

    // 108 cartas conservadas (2 baralhos + 4 coringas).
    const total =
      jogo.maos.reduce((s, m) => s + m.length, 0) +
      jogo.mortos.reduce((s, m) => s + m.length, 0) +
      jogo.monte.length +
      jogo.lixo.length;
    assert.equal(total, 108);

    // E cada humano recebeu a SUA visão.
    for (const j of jogadores) {
      const v = j.ultimo("estado").visao;
      assert.equal(v.voceAssento, assentoDe(srv, j));
      assert.equal(v.suaMao.length, J.CARTAS_POR_MAO);
    }
  });

  test("REG-02: compra do monte tira do monte e põe na mão", async () => {
    const { srv, sala, jogadores } = await mesaComPartida();
    const jogo = sala.jogo;
    const daVez = porAssento(srv, jogadores, jogo.vez);

    const monteAntes = jogo.monte.length;
    const maoAntes = jogo.maos[jogo.vez].length;

    daVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });

    assert.equal(jogo.monte.length, monteAntes - 1);
    assert.equal(jogo.maos[daVez.ultimo("estado").visao.voceAssento].length, maoAntes + 1);
    assert.equal(jogo.jaComprou, true);
    assert.equal(daVez.ultimo("erro"), null, "compra legítima não pode dar erro");
  });

  test("REG-03: descarte passa a vez e alimenta o lixo", async () => {
    const { srv, sala, jogadores } = await mesaComPartida();
    const jogo = sala.jogo;
    const assento = jogo.vez;
    const daVez = porAssento(srv, jogadores, assento);

    daVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    const carta = jogo.maos[assento][0];
    daVez.envia({ tipo: "jogada", jogada: { tipo: "descartar", id: carta.id } });

    assert.equal(jogo.lixo.length, 1);
    assert.equal(jogo.lixo[0].id, carta.id);
    assert.notEqual(jogo.vez, assento, "a vez tem que passar");
    assert.equal(jogo.jaComprou, false, "a vez nova começa sem compra");
  });

  test("REG-04: turno continua fechado (fora da vez, compra dupla, descarte sem compra)", async () => {
    const { srv, sala, jogadores } = await mesaComPartida();
    const jogo = sala.jogo;
    const assento = jogo.vez;
    const daVez = porAssento(srv, jogadores, assento);
    const outro = porAssento(srv, jogadores, (assento + 1) % 4);

    // fora da vez
    outro.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    assert.ok(outro.ultimo("erro"), "jogar fora da vez tem que ser recusado");
    assert.equal(jogo.jaComprou, false);

    // descarte antes de comprar
    daVez.envia({ tipo: "jogada", jogada: { tipo: "descartar", id: jogo.maos[assento][0].id } });
    assert.ok(daVez.ultimo("erro"), "descartar sem comprar tem que ser recusado");

    // compra dupla
    daVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    const monteDepois = jogo.monte.length;
    daVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    assert.equal(jogo.monte.length, monteDepois, "comprar duas vezes não pode tirar carta");
  });

  test("REG-05: zerar a mão com morto disponível pega o morto (batida indireta)", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;

    // Estado montado à mão: assento 0 já comprou e está com UMA carta.
    const unica = jogo.maos[0][0];
    jogo.maos[0] = [unica];
    jogo.jaComprou = true;
    jogo.mortoPego = { nos: false, eles: false };
    const mortosAntes = jogo.mortos.length;

    const r = J.descartar(jogo, 0, unica.id);

    assert.equal(r.ok, true, r.erro);
    assert.equal(r.pegouMorto, true);
    assert.equal(jogo.mortos.length, mortosAntes - 1);
    assert.equal(jogo.maos[0].length, J.CARTAS_POR_MORTO, "a mão vira o morto");
    assert.equal(jogo.mortoPego.nos, true);
    assert.equal(jogo.rodadaEncerrada, false, "pegar o morto não encerra a rodada");
  });

  test("REG-06: zerar a mão com canastra e sem morto é batida final", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;

    jogo.jogosDupla.nos = [canastraLimpa()];
    jogo.abriuValido.nos = true;
    jogo.mortoPego = { nos: true, eles: false };
    const unica = jogo.maos[0][0];
    jogo.maos[0] = [unica];
    jogo.jaComprou = true;

    const r = J.descartar(jogo, 0, unica.id);

    assert.equal(r.ok, true, r.erro);
    assert.equal(r.bateu, true);
    assert.equal(jogo.rodadaEncerrada, true);
    assert.equal(jogo.duplaQueBateu, "nos");
    assert.ok(jogo.pontosRodada, "a rodada apurada tem que ter pontos");
    assert.ok(jogo.placar.nos > 0, "quem bateu com canastra pontua");
  });

  test("REG-06b: zerar a mão SEM canastra continua ilegal", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;

    jogo.jogosDupla.nos = []; // mesa vazia: não pode bater
    jogo.mortoPego = { nos: true, eles: false };
    const unica = jogo.maos[0][0];
    jogo.maos[0] = [unica];
    jogo.jaComprou = true;

    const r = J.descartar(jogo, 0, unica.id);

    assert.equal(r.ok, false, "bater sem canastra tem que ser recusado");
    assert.equal(jogo.maos[0].length, 1, "a carta fica na mão");
    assert.equal(jogo.rodadaEncerrada, false);
  });

  test("REG-07: nova rodada redistribui e PRESERVA o placar", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;

    jogo.placar = { nos: 320, eles: 145 };
    const rodadaAntes = jogo.rodada;
    J.distribuirRodada(jogo);

    assert.equal(jogo.rodada, rodadaAntes + 1);
    assert.deepEqual(jogo.placar, { nos: 320, eles: 145 }, "o placar não pode zerar");
    for (let a = 0; a < 4; a++) assert.equal(jogo.maos[a].length, J.CARTAS_POR_MAO);
    assert.equal(jogo.mortos.length, 2);
    assert.equal(jogo.lixo.length, 0);
    assert.equal(jogo.rodadaEncerrada, false);
    assert.equal(jogo.vez, 0);
  });

  test("REG-08: queda de jogador entrega o assento ao bot (agora em duas etapas)", async () => {
    // [OS7] A regra mudou de forma, não de finalidade. Antes: socket fechado ⇒
    // assento vira bot NA HORA. Agora: o assento é RESERVADO pela graça, e só
    // depois dela vira bot. O motivo de existir do REG-08 — "a mesa não pode
    // travar" — continua sendo afirmado, no segundo passo.
    //
    // Relógio controlado: sem ele a graça nunca vence e a segunda metade da
    // regra ficaria sem prova. Não há espera real em lugar nenhum.
    let t = T0;
    const GRACA = 15000;
    const { srv, codigo, sala, jogadores } = await mesaComPartida({
      servidor: { agora: () => t, gracaAusenciaMs: GRACA },
    });
    const jogo = sala.jogo;
    const alvo = jogadores[1];
    const assento = assentoDe(srv, alvo);

    assert.equal(jogo.assentos[assento].tipo, "humano");
    srv.desconectar(alvo.id);

    // ETAPA 1 — a queda NÃO entrega o assento, e não destrói a posse.
    assert.equal(jogo.assentos[assento].tipo, "humano", "a queda entregou o assento na hora");
    assert.equal(sala.controle[assento].estado, "humano_ausente");
    assert.equal(sala.assentos[assento].jogadorId, "uid-1", "a queda destruiu a posse");
    assert.equal(srv.conexoes[alvo.id], undefined, "a conexão sai do registro");

    // ETAPA 2 — vencida a graça, o assento vira bot: a mesa não trava.
    t += GRACA;
    srv.ger.verificarAusencias(codigo);
    assert.equal(jogo.assentos[assento].tipo, "bot", "o assento vira bot para a mesa não travar");
    assert.equal(sala.controle[assento].estado, "bot_substituto");
  });

  test("REG-09: liquidação e evento de fim são idempotentes", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 1, metaPontos: 100 });

    // Deixa a partida rodar até o fim (assentos 1..3 são bots; o 0 vira bot).
    jogadores[0].envia({ tipo: "afkBot" });
    assert.equal(sala.jogo.encerrada, true, "a partida de teste precisa encerrar");

    assert.equal(sala.liquidada, true);
    assert.equal(sala.fimEmitido, true);
    const resumoUma = sala.resumoFinal;

    // Repetir o gatilho não pode contabilizar de novo nem reemitir o fim.
    const fimAntes = jogadores[0].todas("fim").length;
    srv.broadcastSala(codigo);
    srv.ger.avancarBots(sala);
    assert.equal(sala.resumoFinal, resumoUma, "o resumo não pode ser recalculado");
    assert.equal(jogadores[0].todas("fim").length, fimAntes, "o fim sai UMA vez só");
  });

  test("REG-10: finalização entrega resumo de carteira a quem jogou", async () => {
    const { jogadores } = await mesaComPartida({ humanos: 1, metaPontos: 100 });
    jogadores[0].envia({ tipo: "afkBot" });

    const fim = jogadores[0].ultimo("fim");
    assert.ok(fim, "quem jogou recebe o fim");
    assert.ok(fim.placar, "com placar");
    assert.ok(fim.resumo, "e com o resumo de ganhos (é dele, é privado, e continua vindo)");
  });

  test("REG-11: o contrato da visão de assento não mudou", async () => {
    const { sala } = await mesaComPartida();
    const visao = J.visaoDoAssento(sala.jogo, 0);

    // Lista congelada ANTES desta OS (bundle em 1828d42). Se alguém acrescentar
    // ou remover campo da visão de assento, este teste acusa — inclusive se
    // acrescentar por engano algo que só deveria existir do lado público.
    const esperado = [
      "voceAssento", "modalidade", "metaPontos", "rodada", "placar", "encerrada",
      "rodadaEncerrada", "duplaQueBateu", "pontosRodada", "rodadasVulneravel",
      "vez", "suaVez", "jaComprou", "precisaUsarTopo", "suaMao", "assentos",
      "monteQtd", "lixoQtd", "lixoTopo", "lixoAberto", "mortosQtd", "mortoPego",
      "jogosDupla",
    ].sort();

    assert.deepEqual(Object.keys(visao).sort(), esperado);
    assert.equal(visao.espectador, undefined, "visão de assento não carrega a marca de espectador");
  });

  test("REG-12: jogador e espectador na mesma mesa não interferem um no outro", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida();
    const jogo = sala.jogo;

    // Entra alguém para assistir NO MEIO da partida.
    const esp = await cliente(srv);
    esp.envia({ tipo: "assistirMesa", codigo });

    const assento = jogo.vez;
    const daVez = porAssento(srv, jogadores, assento);
    const monteAntes = jogo.monte.length;

    daVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });

    // A jogada aconteceu normalmente...
    assert.equal(jogo.monte.length, monteAntes - 1);
    assert.equal(daVez.ultimo("erro"), null);
    // ...o jogador continua recebendo a mão dele...
    assert.ok(daVez.ultimo("estado").visao.suaMao.length > 0);
    // ...e o espectador foi avisado do evento, na visão pública.
    assert.equal(esp.ultimo("estado").visao.espectador, true);
    assert.equal(esp.ultimo("estado").visao.monteQtd, jogo.monte.length);
  });

  test("REG-13: o servidor é de uma thread só — não há corrida a cobrir", async () => {
    // A OS pede regressão de concorrência "se coberta pelo servidor". O bundle
    // trata uma mensagem por vez no laço de eventos do Node, sem I/O no meio do
    // despacho: duas jogadas chegando juntas são SERIALIZADAS. O que dá pra
    // provar é que a segunda vê o efeito da primeira — e é o que se faz aqui.
    const { srv, sala, jogadores } = await mesaComPartida();
    const jogo = sala.jogo;
    const assento = jogo.vez;
    const daVez = porAssento(srv, jogadores, assento);
    const monteAntes = jogo.monte.length;

    // duas compras "simultâneas": a segunda é recusada pela primeira
    daVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    daVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });

    assert.equal(jogo.monte.length, monteAntes - 1, "só UMA compra pode valer");
  });
});
