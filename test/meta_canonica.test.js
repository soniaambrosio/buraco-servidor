/**
 * meta_canonica.test.js — A META DE PONTOS DA PARTIDA.
 *
 * OS — Meta canônica de partida 1500/2000/3000 e seletor produtivo do lobby v1.
 *
 * A meta é a primeira configuração de mesa que o cliente PODE escolher — e a
 * distinção com a aposta é o assunto inteiro desta suíte:
 *
 *   META-* ...... quem abre a mesa escolhe a duração da própria partida. É
 *                 escolha legítima, e por isso viaja na mensagem. Só que
 *                 "pode escolher" não é "pode mandar qualquer coisa": o valor
 *                 passa por uma lista fechada antes de virar mesa, a mesa
 *                 congela o que aceitou, e ninguém mais mexe nela.
 *
 *   APO-GUARDA .. a cicatriz da OS anterior. Meta viajar por mensagem não é
 *                 autorização para a aposta voltar de carona: nenhum campo
 *                 econômico volta a sair de `msg`.
 *
 * As provas ESTRUTURAIS leem o CÓDIGO do bundle, nunca os comentários — este
 * arquivo e o `server.js` explicam em prosa por que `msg.aposta` não pode
 * voltar, e sem separar as duas coisas a explicação derrubaria a prova.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { novoServidor, cliente } = require("./ajuda.js");

const bundle = require("../server.js");
const {
  criarGerenciador,
  resolverMetaDePontos,
  METAS_CANONICAS,
  META_PADRAO,
} = bundle.require("salas");

const FONTE = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

/** O CÓDIGO do bundle, sem comentário nenhum. */
function semComentarios(texto) {
  const limpo = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  for (const marcador of ["function ", "return "]) {
    assert.ok(limpo.includes(marcador), "a limpeza comeu o código: " + marcador);
  }
  return limpo;
}
const CODIGO = semComentarios(FONTE);

/** Um gerenciador puro, sem rede: o caminho mais curto até a decisão. */
function ger(opts = {}) {
  let n = 0;
  return criarGerenciador(Object.assign({ gerarCodigo: () => "MESA-" + ++n }, opts));
}

/** Mesa criada PELO FIO, autenticada, com a meta que o teste mandar. */
async function mesaPeloFio(srv, meta, uid = "uid-0") {
  const dono = await cliente(srv, uid);
  const msg = { tipo: "criarMesa", apelido: "Dono" };
  if (meta !== undefined) msg.metaPontos = meta;
  dono.envia(msg);
  return dono;
}

// ===========================================================================
// META-01 a META-05 — a lista canônica e o que ela aceita
// ===========================================================================

describe("META — a lista canônica", () => {
  test("META-01: a lista é exatamente 1.500, 2.000 e 3.000", () => {
    assert.deepEqual(Array.from(METAS_CANONICAS), [1500, 2000, 3000]);
    // Congelada: uma lista em que se pode empurrar valor em tempo de execução
    // não é lista branca, é sugestão.
    assert.equal(Object.isFrozen(METAS_CANONICAS), true);
  });

  test("META-02: 1500 é aceita e é o que a mesa guarda", () => {
    const g = ger();
    assert.equal(g.criarMesa({ apelido: "A", jogadorId: "j1", metaPontos: 1500 }).erro, undefined);
    assert.equal(g.salas["MESA-1"].metaPontos, 1500);
  });

  test("META-03: 2000 é aceita — e é o valor que faltava na base", () => {
    const g = ger();
    assert.equal(g.criarMesa({ apelido: "A", jogadorId: "j1", metaPontos: 2000 }).erro, undefined);
    assert.equal(g.salas["MESA-1"].metaPontos, 2000);
  });

  test("META-04: 3000 é aceita e é o que a mesa guarda", () => {
    const g = ger();
    assert.equal(g.criarMesa({ apelido: "A", jogadorId: "j1", metaPontos: 3000 }).erro, undefined);
    assert.equal(g.salas["MESA-1"].metaPontos, 3000);
  });

  test("META-05: o padrão é 2.000, declarado — e não o primeiro item da lista", () => {
    // As três asserções medem coisas diferentes de propósito: a primeira é o
    // valor decidido; a segunda é a de que ele NÃO foi derivado da ordem da
    // vitrine, que é o jeito de o padrão mudar sozinho quando alguém reordena
    // os botões; a terceira, que o padrão é oferecível.
    assert.equal(META_PADRAO, 2000);
    assert.notEqual(META_PADRAO, METAS_CANONICAS[0]);
    assert.ok(METAS_CANONICAS.includes(META_PADRAO), "o padrão tem de ser oferecível");

    const g = ger();
    g.criarMesa({ apelido: "A", jogadorId: "j1" }); // sem o campo
    assert.equal(g.salas["MESA-1"].metaPontos, 2000);
  });
});

// ===========================================================================
// META-06 e META-07 — o que a lista recusa
// ===========================================================================

describe("META — o que não vira mesa", () => {
  // Cada valor aqui é um caso da OS ou o vizinho de um valor válido. O vizinho
  // importa porque a falha típica de lista branca não é aceitar 7: é aceitar
  // 1999, por alguém ter trocado a lista por uma faixa.
  const RECUSADOS = [
    ["sete", 7],
    ["zero", 0],
    ["negativo", -1500],
    ["negativo do padrão", -2000],
    ["texto", "2000"],
    ["texto vazio", ""],
    ["nulo", null],
    ["NaN", NaN],
    ["infinito", Infinity],
    ["vizinho de baixo", 1499],
    ["vizinho de cima", 1501],
    ["vizinho do padrão (abaixo)", 1999],
    ["vizinho do padrão (acima)", 2001],
    ["vizinho do teto", 3001],
    ["quebrado", 2000.5],
    ["booleano", true],
    ["lista", [2000]],
    ["objeto", {}],
  ];

  for (const [nome, valor] of RECUSADOS) {
    test("META-06/" + nome + ": " + JSON.stringify(valor) + " é recusado e não vira mesa", () => {
      const g = ger();
      const r = g.criarMesa({ apelido: "A", jogadorId: "j1", metaPontos: valor });
      assert.ok(r.erro, "tinha que recusar");
      // E a recusa não deixa rastro: nem sala meio construída, nem código em
      // uso. É a mesma disciplina do gate de admissão.
      assert.deepEqual(Object.keys(g.salas), [], "a recusa deixou sala para trás");
    });
  }

  test("META-07: recusar é diferente de cair no padrão", () => {
    // O caso perigoso não é o erro: é a mesa nascer de 2.000 quando a pessoa
    // pediu 1.999 e ninguém avisou. `resolverMetaDePontos` responde `null`
    // para valor presente e inválido, e só a AUSÊNCIA vira padrão.
    assert.equal(resolverMetaDePontos(undefined), META_PADRAO);
    assert.equal(resolverMetaDePontos(1999), null);
    assert.equal(resolverMetaDePontos(null), null);
    assert.equal(resolverMetaDePontos("2000"), null);
    assert.equal(resolverMetaDePontos(2000), 2000);
  });

  test("META-08: pelo fio, meta inválida devolve erro e nenhuma sala nasce", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 7);
    assert.equal(dono.ultimo("entrou"), null, "não podia ter entrado em mesa nenhuma");
    assert.ok(dono.ultimo("erro"), "o cliente precisa saber que foi recusado");
    assert.deepEqual(Object.keys(srv.ger.salas), []);
  });

  test("META-09: pelo fio, 2000 nasce mesa de 2.000", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 2000);
    const codigo = dono.ultimo("entrou").codigo;
    assert.equal(srv.ger.salas[codigo].metaPontos, 2000);
  });
});

// ===========================================================================
// META-10 a META-14 — a meta pertence à MESA
// ===========================================================================

describe("META — a mesa é dona da meta", () => {
  test("META-10: a meta é imutável na sala, estruturalmente", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 3000);
    const sala = srv.ger.salas[dono.ultimo("entrou").codigo];

    const desc = Object.getOwnPropertyDescriptor(sala, "metaPontos");
    assert.equal(desc.writable, false, "a meta tem de ser não-gravável");
    assert.equal(desc.configurable, false, "e não-reconfigurável");

    try {
      sala.metaPontos = 1500;
    } catch (_) {
      // Em modo estrito a atribuição joga; em modo solto ela é ignorada. O que
      // esta prova afirma é o resultado, que é o mesmo nos dois.
    }
    assert.equal(sala.metaPontos, 3000, "a meta da mesa mudou depois de criada");
  });

  test("META-11: quem entra por código não transforma a mesa", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 3000);
    const codigo = dono.ultimo("entrou").codigo;

    // O convidado manda a meta que quiser junto do `entrarMesa`. O campo é
    // inerte: o despachante não o repassa, e a sala não o aceitaria.
    const b = await cliente(srv, "uid-1");
    b.envia({ tipo: "entrarMesa", codigo, apelido: "B", metaPontos: 1500 });
    assert.ok(b.ultimo("entrou"), "o convidado entra normalmente");
    assert.equal(srv.ger.salas[codigo].metaPontos, 3000, "a mesa de 3.000 virou outra");
  });

  test("META-12: reconexão não redecide a meta", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 1500);
    const codigo = dono.ultimo("entrou").codigo;

    srv.desconectar(dono.id); // queda

    const volta = await cliente(srv, "uid-0");
    volta.envia({ tipo: "entrarMesa", codigo, apelido: "Dono", metaPontos: 3000 });
    assert.ok(volta.ultimo("entrou"), "a volta é permitida");
    assert.equal(srv.ger.salas[codigo].metaPontos, 1500, "a volta mexeu na meta");
  });

  test("META-13: a partida começa com a meta da SALA", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 1500);
    const codigo = dono.ultimo("entrou").codigo;
    dono.envia({ tipo: "iniciarPartida" });

    const sala = srv.ger.salas[codigo];
    assert.equal(sala.jogo.metaPontos, 1500, "o jogo nasceu com outra meta");
    assert.equal(sala.jogo.metaPontos, sala.metaPontos);
  });

  test("META-14: o início não relê meta de mensagem nenhuma", async () => {
    // `iniciarPartida` com meta no payload: se o início lesse a mensagem, a
    // pessoa abriria mesa de 1.500 e jogaria 3.000 sem ninguém saber.
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 1500);
    const codigo = dono.ultimo("entrou").codigo;
    dono.envia({ tipo: "iniciarPartida", metaPontos: 3000 });
    assert.equal(srv.ger.salas[codigo].jogo.metaPontos, 1500);
  });
});

// ===========================================================================
// META-15 a META-17 — todo mundo vê a mesma meta
// ===========================================================================

describe("META — a projeção", () => {
  test("META-15: no lobby, cada assento recebe a mesma meta", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 2000);
    const codigo = dono.ultimo("entrou").codigo;

    const vistas = [srv.ger.visao(codigo, 0)];
    for (let i = 1; i < 4; i++) {
      const c = await cliente(srv, "uid-" + i);
      c.envia({ tipo: "entrarMesa", codigo, apelido: "J" + i });
      vistas.push(srv.ger.visao(codigo, c.ultimo("entrou").assento));
    }

    for (const v of vistas) {
      assert.equal(v.lobby, true);
      assert.equal(v.metaPontos, 2000, "um assento viu meta diferente");
    }
  });

  test("META-16: quem só assiste também vê a meta da mesa", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 3000);
    const codigo = dono.ultimo("entrou").codigo;
    assert.equal(srv.ger.visaoEspectador(codigo).metaPontos, 3000);
  });

  test("META-17: começada a partida, a visão do assento leva a meta", async () => {
    const srv = novoServidor();
    const dono = await mesaPeloFio(srv, 1500);
    const codigo = dono.ultimo("entrou").codigo;
    dono.envia({ tipo: "iniciarPartida" });
    assert.equal(srv.ger.visao(codigo, 0).metaPontos, 1500);
  });
});

// ===========================================================================
// APO-GUARDA — a cicatriz da OS anterior
// ===========================================================================

describe("APO-GUARDA — meta viaja; aposta não volta de carona", () => {
  test("APO-GUARDA-01: `msg.aposta` continua sem ser lido em ponto nenhum", () => {
    // Espelha o APO-01 de `mesa_privada.test.js` e existe por um motivo
    // próprio: esta OS abriu um campo de `msg` para a criação da mesa, e o
    // jeito natural de errar seria abrir "o resto junto".
    assert.equal(/msg\.aposta/.test(CODIGO), false, "`msg.aposta` voltou a ser lido");
    assert.equal(/aposta:\s*msg\./.test(CODIGO), false, "a aposta voltou a sair da mensagem");
  });

  test("APO-GUARDA-02: nenhum campo econômico sai de `msg`", () => {
    for (const campo of ["saldo", "custo", "fichas", "moedas", "recompensa", "premio", "preco"]) {
      assert.equal(
        new RegExp("msg\\." + campo + "\\b").test(CODIGO),
        false,
        "o despachante passou a ler msg." + campo
      );
    }
  });

  test("APO-GUARDA-03: a mesa com meta escolhida continua com a aposta do processo", () => {
    const g = ger({ apostaDeEntrada: 500 });
    g.criarMesa({ apelido: "A", jogadorId: "j1", metaPontos: 1500, aposta: 5000 });
    const sala = g.salas["MESA-1"];
    assert.equal(sala.metaPontos, 1500, "a meta escolhida vale");
    assert.equal(sala.aposta, 500, "e a aposta continua sendo a do processo");
  });

  test("APO-GUARDA-04: o despachante repassa a meta e mais nada de novo", () => {
    // Prova estrutural do CAMINHO, e não do valor: a chamada de `criarMesa`
    // montada a partir de `msg` tem uma lista fechada de campos vindos dela.
    const chamada = /ger\.criarMesa\(\{([^}]*)\}\)/.exec(CODIGO);
    assert.ok(chamada, "não achei a chamada de criarMesa no despachante");
    const daMensagem = (chamada[1].match(/msg\.\w+/g) || []).sort();
    assert.deepEqual(daMensagem, ["msg.apelido", "msg.metaPontos", "msg.modalidade"]);
  });

  test("APO-GUARDA-05: `entrarMesa` não recebe meta do despachante", () => {
    const chamada = /ger\.entrarMesa\(\{([^}]*)\}\)/.exec(CODIGO);
    assert.ok(chamada, "não achei a chamada de entrarMesa no despachante");
    assert.equal(/metaPontos/.test(chamada[1]), false, "a entrada voltou a carregar meta");
  });
});
