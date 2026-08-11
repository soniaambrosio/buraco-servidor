// test/regressao_auth.test.js — O JOGO CONTINUA O MESMO DEPOIS DA AUTENTICAÇÃO.
//
// A OS proíbe mudança funcional (§24): a autenticação protege a fronteira, ela
// não muda regra, ritmo, visão por assento nem o encerramento. Como o `main`
// não tinha suíte nenhuma, esta aqui é a linha de base: tudo o que o protocolo
// fazia antes tem que continuar fazendo — só que a partir de uma conexão que
// provou quem é.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  cliente, emitirToken, novoParDeChaves, novoServidor, relogio, verificadorDeTeste,
} = require("./ajuda_auth.js");

const CHAVE = novoParDeChaves("kid-reg-1");

function servidorAutenticado() {
  const tempo = relogio();
  return novoServidor({ tempo, verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }) });
}

/** Conexão já autenticada como `uid`. */
async function jogador(srv, uid) {
  const c = cliente(srv);
  await c.autentica(emitirToken({ chave: CHAVE, uid }));
  return c;
}

/**
 * Mesa com `humanos` pessoas sentadas, todas autenticadas.
 *
 * O assento de cada uma vem da resposta `entrou` — o servidor senta na ordem
 * PARCEIRO-PRIMEIRO (0, 2, 1, 3), então índice na lista ≠ número do assento.
 */
async function mesaComGente(humanos = 4, extra = {}) {
  const srv = servidorAutenticado();
  const dono = await jogador(srv, "uid-0");
  dono.envia(Object.assign({ tipo: "criarMesa", apelido: "Dono" }, extra));
  const codigo = dono.ultimo("entrou").codigo;
  dono.assento = dono.ultimo("entrou").assento;

  const jogadores = [dono];
  for (let i = 1; i < humanos; i++) {
    const c = await jogador(srv, "uid-" + i);
    c.envia({ tipo: "entrarMesa", codigo, apelido: "Jogador" + i });
    c.assento = c.ultimo("entrou").assento;
    jogadores.push(c);
  }
  return { srv, codigo, jogadores };
}

test("criar mesa devolve código e assento, e o lobby chega para todo mundo", async () => {
  const { srv, codigo, jogadores } = await mesaComGente(4);
  const [dono, j1] = jogadores;

  assert.equal(dono.assento, 0, "quem cria fica no assento 0");
  assert.equal(j1.assento, 2, "o 2º humano senta de PARCEIRO do criador");
  assert.equal(codigo, "MESA-1");

  const lobby = dono.ultimo("estado").visao;
  assert.equal(lobby.lobby, true);
  assert.equal(lobby.assentos.filter(Boolean).length, 4);
  assert.equal(Object.keys(srv.ger.salas).length, 1);
});

test("os assentos ficam com o uid autenticado de cada conexão", async () => {
  const { srv, codigo, jogadores } = await mesaComGente(4);
  const assentos = srv.ger.salas[codigo].assentos;
  jogadores.forEach((j, i) => assert.equal(assentos[j.assento].jogadorId, "uid-" + i));
});

test("iniciar partida distribui e cada um recebe SÓ a própria mão", async () => {
  const { srv, codigo, jogadores } = await mesaComGente(4);
  jogadores.forEach((j) => j.limpar());
  jogadores[0].envia({ tipo: "iniciarPartida" });

  const jogo = srv.ger.salas[codigo].jogo;
  assert.ok(jogo, "a partida tem que ter começado");

  jogadores.forEach((j) => {
    const v = j.ultimo("estado").visao;
    assert.notEqual(v.lobby, true, "assento " + j.assento + " devia estar em jogo");
    assert.equal(v.voceAssento, j.assento);
    assert.deepEqual(
      v.suaMao.map((c) => c.id),
      jogo.maos[j.assento].map((c) => c.id),
      "assento " + j.assento + " tem que ver a própria mão"
    );
    // dos outros, só a contagem — nunca as cartas
    v.assentos.forEach((a, i) => {
      if (i === j.assento) return;
      assert.equal(a.qtdCartas, jogo.maos[i].length);
      assert.equal(a.cartas, undefined);
    });
  });
});

test("só o dono do assento comanda: o servidor usa o assento da conexão", async () => {
  const { srv, codigo, jogadores } = await mesaComGente(4);
  jogadores[0].envia({ tipo: "iniciarPartida" });
  const jogo = srv.ger.salas[codigo].jogo;
  const daVez = jogo.vez;
  const foraDaVez = jogadores.find((j) => j.assento !== daVez);

  foraDaVez.limpar();
  foraDaVez.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });

  assert.ok(foraDaVez.ultimo("erro"), "quem não é da vez tem que ser recusado pela REGRA");
  assert.equal(foraDaVez.ultimo("erro").codigo, undefined, "e não pela autenticação");
  assert.equal(srv.ger.salas[codigo].jogo.vez, daVez, "a vez não muda");
});

test("os bots continuam jogando sozinhos até a vez do humano", async () => {
  const srv = servidorAutenticado();
  const dono = await jogador(srv, "uid-solo");
  dono.envia({ tipo: "criarMesa", apelido: "Solo", modalidade: "aberto" });
  const codigo = dono.ultimo("entrou").codigo;

  dono.envia({ tipo: "iniciarPartida" });
  const sala = srv.ger.salas[codigo];

  assert.equal(sala.jogo.assentos.filter((a) => a.tipo === "bot").length, 3);
  assert.equal(srv.ger.vezEhBot(codigo), false, "o laço de bots só para na vez do humano");
  assert.equal(sala.jogo.vez, 0);
  assert.ok(dono.todas("estado").length >= 1);
});

test("afkBot entrega o assento ao servidor e afkVoltar devolve", async () => {
  const { srv, codigo, jogadores } = await mesaComGente(2);
  jogadores[0].envia({ tipo: "iniciarPartida" });
  const assentos = () => srv.ger.salas[codigo].jogo.assentos;
  const meu = jogadores[1].assento;

  jogadores[1].envia({ tipo: "afkBot" });
  assert.equal(assentos()[meu].tipo, "bot");

  jogadores[1].envia({ tipo: "afkVoltar" });
  assert.equal(assentos()[meu].tipo, "humano");
});

test("a partida roda até o fim e o encerramento é emitido uma vez só", async () => {
  const srv = servidorAutenticado();
  const dono = await jogador(srv, "uid-solo");
  dono.envia({ tipo: "criarMesa", apelido: "Solo", modalidade: "aberto", metaPontos: 100 });
  const codigo = dono.ultimo("entrou").codigo;
  dono.envia({ tipo: "iniciarPartida" });

  // entrega o próprio assento ao servidor: os 4 viram bot e a mesa corre sozinha
  dono.envia({ tipo: "afkBot" });

  const sala = srv.ger.salas[codigo];
  assert.ok(sala.resumoFinal, "a partida tinha que ter encerrado");
  assert.equal(sala.fimEmitido, true);
  assert.equal(dono.todas("fim").length, 1, "o 'fim' sai uma vez só");
  assert.ok(dono.ultimo("fim").placar);
});

test("sair libera o assento e o lobby é reemitido", async () => {
  const { srv, codigo, jogadores } = await mesaComGente(3);
  const saiu = jogadores[2];
  saiu.envia({ tipo: "sair" });

  assert.equal(srv.conexoes[saiu.id].codigo, null);
  assert.equal(srv.conexoes[saiu.id].assento, null);
  assert.equal(srv.ger.salas[codigo].assentos[saiu.assento], null);
  assert.equal(jogadores[0].ultimo("estado").visao.assentos[saiu.assento].vazio, true);
});

test("a queda solta o assento sem derrubar a mesa", async () => {
  const { srv, codigo, jogadores } = await mesaComGente(3);
  const caiu = jogadores[1];
  srv.desconectar(caiu.id);

  assert.equal(srv.conexoes[caiu.id], undefined);
  assert.equal(srv.ger.salas[codigo].assentos[caiu.assento], null);
  assert.equal(jogadores[0].ultimo("estado").visao.assentos[0].apelido, "Dono");
});

test("perfil e ranking continuam respondendo com a conta real", async () => {
  const srv = servidorAutenticado();
  const c = await jogador(srv, "uid-perfil");
  c.envia({ tipo: "perfil", apelido: "Sônia" });

  const perfil = c.ultimo("perfil");
  assert.equal(perfil.conta.id, "uid-perfil");
  assert.equal(perfil.conta.apelido, "Sônia");
  assert.equal(typeof perfil.conta.moedas, "number");
  assert.equal(typeof perfil.posicao === "number" || typeof perfil.conta.posicao === "number", true);

  c.envia({ tipo: "ranking", limite: 10 });
  assert.ok(Array.isArray(c.ultimo("ranking").lista));
});

test("mensagem sem tipo e tipo desconhecido continuam sendo erro comum", async () => {
  const srv = servidorAutenticado();
  const c = await jogador(srv, "uid-x");

  c.limpar();
  c.envia({});
  assert.equal(c.ultimo("erro").motivo, "mensagem sem tipo");

  c.limpar();
  c.envia({ tipo: "voar" });
  assert.match(c.ultimo("erro").motivo, /tipo desconhecido/);
});

test("a conta é criada no cofre já na autenticação, sob o uid do token", async () => {
  const srv = servidorAutenticado();
  const c = await jogador(srv, "uid-novato");
  c.envia({ tipo: "perfil" });
  assert.equal(c.ultimo("perfil").conta.id, "uid-novato");
});
