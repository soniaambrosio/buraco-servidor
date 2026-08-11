// test/ws.test.js — a fronteira vale no TRANSPORTE REAL (§10 da OS).
//
// As outras suítes falam com o despachante em processo. Esta sobe o servidor
// WebSocket de verdade (o mesmo `iniciar()` que o Railway executa), conecta
// clientes WebSocket reais e confere o que chega pelo fio. É o que fecha a
// dúvida "e se o adaptador de transporte desfizer a proteção?".

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

// O cofre de contas persiste em disco; num teste ele vai para uma pasta
// descartável, nunca para `./dados`.
process.env.DADOS_DIR = path.join(os.tmpdir(), "bmv-teste-ws-" + process.pid);

const bundle = require("../server.js");
const { iniciar } = bundle.require("ws_server");

const PORTA = 8137;
let servidorHttp = null;

/** Cliente WebSocket real, com fila de mensagens e espera por tipo. */
function conectar() {
  const ws = new WebSocket("ws://127.0.0.1:" + PORTA);
  const recebidas = [];
  const esperando = [];

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    recebidas.push(msg);
    for (let i = esperando.length - 1; i >= 0; i--) {
      if (esperando[i].tipo === msg.tipo) {
        esperando[i].resolver(msg);
        esperando.splice(i, 1);
      }
    }
  });

  return {
    ws,
    recebidas,
    aberto: new Promise((r) => ws.addEventListener("open", r, { once: true })),
    envia(msg) {
      ws.send(JSON.stringify(msg));
      return this;
    },
    /** Próxima (ou já recebida) mensagem daquele tipo. */
    espera(tipo, timeoutMs = 4000) {
      const jaVeio = recebidas.find((m) => m.tipo === tipo);
      if (jaVeio) return Promise.resolve(jaVeio);
      return new Promise((resolver, rejeitar) => {
        const t = setTimeout(() => rejeitar(new Error("timeout esperando `" + tipo + "`")), timeoutMs);
        esperando.push({ tipo, resolver: (m) => { clearTimeout(t); resolver(m); } });
      });
    },
    ultimo(tipo) {
      for (let i = recebidas.length - 1; i >= 0; i--) {
        if (recebidas[i].tipo === tipo) return recebidas[i];
      }
      return null;
    },
    fecha() {
      ws.close();
    },
  };
}

/** Deixa o laço de eventos respirar para os frames chegarem. */
const respira = (ms = 120) => new Promise((r) => setTimeout(r, ms));

describe("§10 — enforcement no transporte WebSocket real", () => {
  before(() => {
    servidorHttp = iniciar(PORTA).http_server;
    // `unref` para o listener não segurar o laço de eventos depois do teste
    // (o servidor de verdade roda como programa e deve segurar mesmo).
    servidorHttp.unref();
  });

  after(() => {
    if (servidorHttp) servidorHttp.close();
  });

  test("pelo fio, o espectador recebe visão pública e o jogador recebe a dele", async () => {
    // Quatro humanos: a vez fica num humano e nada avança sozinho.
    const jogadores = [];
    for (let i = 0; i < 4; i++) {
      const c = conectar();
      await c.aberto;
      jogadores.push(c);
    }

    jogadores[0].envia({ tipo: "criarMesa", apelido: "Dono", jogadorId: "ws-0", metaPontos: 3000 });
    const entrou = await jogadores[0].espera("entrou");
    const codigo = entrou.codigo;

    for (let i = 1; i < 4; i++) {
      jogadores[i].envia({ tipo: "entrarMesa", codigo, apelido: "J" + i, jogadorId: "ws-" + i });
      await jogadores[i].espera("entrou");
    }

    jogadores[0].envia({ tipo: "iniciarPartida" });
    await respira(200);

    // Espectador entra pelo fio, alegando tudo o que dá para alegar.
    const esp = conectar();
    await esp.aberto;
    esp.envia({
      tipo: "assistirMesa",
      codigo,
      jogadorId: "ws-1",     // UID de um participante real
      assento: 0,
      seat: 0,
      papel: "jogador",
      role: "player",
      souEspectador: false,
      debug: true,
      owner: true,
    });
    await esp.espera("assistindo");
    const estadoEsp = await esp.espera("estado");
    await respira(150);

    // O jogador continua recebendo a própria mão...
    const estadoJogador = jogadores[0].ultimo("estado");
    assert.ok(estadoJogador, "o jogador precisa receber estado pelo fio");
    assert.ok(Array.isArray(estadoJogador.visao.suaMao), "regressão: sumiu a mão do jogador");
    assert.equal(estadoJogador.visao.suaMao.length, 11);

    // ...e o espectador, só a visão pública.
    assert.equal(estadoEsp.visao.espectador, true);
    assert.equal(estadoEsp.visao.voceAssento, null);
    assert.equal(estadoEsp.visao.suaMao, undefined, "mão vazou pelo WebSocket");
    assert.equal(estadoEsp.visao.precisaUsarTopo, undefined);
    assert.equal(estadoEsp.visao.suaVez, undefined);
    assert.deepEqual(estadoEsp.visao.qtdCartasPorAssento, [11, 11, 11, 11]);

    // Nenhum id de carta do jogador aparece no que o espectador recebeu.
    const idsDoJogador = new Set(estadoJogador.visao.suaMao.map((c) => c.id));
    const textoEsp = JSON.stringify(esp.recebidas);
    for (const id of idsDoJogador) {
      assert.equal(textoEsp.includes('"' + id + '"'), false, "id " + id + " vazou pelo fio");
    }

    // E um evento INCREMENTAL (a compra) também chega sanitizado.
    const monteAntes = estadoEsp.visao.monteQtd;
    assert.equal(monteAntes, 108 - 4 * 11 - 2 * 11, "monte inicial: 108 menos mãos e mortos");

    jogadores[0].envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    await respira(250);

    const ultimoEsp = esp.ultimo("estado");
    assert.equal(ultimoEsp.visao.espectador, true);
    assert.equal(ultimoEsp.visao.suaMao, undefined, "mão vazou num evento incremental");
    assert.equal(ultimoEsp.visao.monteQtd, monteAntes - 1, "o espectador acompanha a compra pela contagem");

    // A tentativa de jogar leva recusa genérica, sem detalhe de estado.
    esp.envia({ tipo: "jogada", jogada: { tipo: "descartar", id: [...idsDoJogador][0] } });
    const erro = await esp.espera("erro");
    assert.equal(erro.motivo, "você está assistindo a esta mesa");

    for (const c of jogadores) c.fecha();
    esp.fecha();
    await respira(120);
  });
});
