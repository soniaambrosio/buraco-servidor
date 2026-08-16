// test/versao.test.js — VERSIONAMENTO DA VISÃO AUTORITATIVA.
//
// O que esta suíte afirma: todo evento `estado` carrega o par
// (versaoEstado, eventoId), o par é atribuído pelo servidor num ponto único, e
// ele avança EXATAMENTE quando o estado autoritativo muda — nunca por
// serialização, destinatário, reenvio, reconexão ou comando recusado.
//
// Cinco eixos, na ordem em que a garantia se forma:
//   CONTRATO     os campos existem, com a forma prometida;
//   MUTAÇÃO      quando a versão avança, e quando ela não avança;
//   COERÊNCIA    todas as visões de uma mutação carregam o mesmo par;
//   ISOLAMENTO   partidas e salas diferentes não colidem;
//   ESTRUTURA    ninguém além do ponto único escreve versão.
//
// Nada aqui toca rede: tudo passa pelas portas de produção (`srv.processar`,
// `srv.broadcastSala`, `ger.visaoPara`), com conexões simuladas.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  J,
  cliente,
  espectador,
  mesaComPartida,
  novoServidor,
  varrerSegredos,
} = require("./ajuda.js");

const bundle = require("../server.js");
const { criarGerenciador, carimbarEstado, impressaoDoEstado, CAMPOS_FORA_DA_IMPRESSAO } =
  bundle.require("salas");

const FONTE = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------

/** O par carimbado no último `estado` que este cliente recebeu. */
function par(c) {
  const m = c.ultimo("estado");
  assert.ok(m, "esperava um evento `estado` recebido");
  return { versaoEstado: m.versaoEstado, eventoId: m.eventoId };
}

/** A versão vigente da mesa, lida pela porta do gerenciador. */
function versaoDe(srv, codigo) {
  return srv.ger.metadadosDe(codigo).versaoEstado;
}

/** Mapa ASSENTO → cliente.
 *
 *  A mesa senta PARCEIRO-PRIMEIRO: o criador vai para o assento 0 e os
 *  seguintes para 2, 1, 3, nessa ordem. Logo o índice na lista de jogadores NÃO
 *  é o assento — e mandar a jogada pelo cliente errado produziria uma recusa
 *  que este arquivo leria como "não incrementou", passando por engano. O
 *  assento vem da conexão, que é quem o servidor considera dono do lugar. */
function porAssento(srv, jogadores) {
  const mapa = [];
  for (const j of jogadores) mapa[srv.conexoes[j.id].assento] = j;
  return mapa;
}

/** Compra do monte pelo assento da vez. É a mutação válida mais simples que
 *  existe: não depende de mão sorteada, de canastra nem de vulnerabilidade. */
function comprarDaVez(srv, sala, jogadores) {
  const v = sala.jogo.vez;
  porAssento(srv, jogadores)[v].envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
  return v;
}

/** Descarte da primeira carta da mão do assento da vez (que já comprou). */
function descartarDaVez(srv, sala, jogadores) {
  const v = sala.jogo.vez;
  porAssento(srv, jogadores)[v].envia({
    tipo: "jogada",
    jogada: { tipo: "descartar", id: sala.jogo.maos[v][0].id },
  });
  return v;
}

/** Canastra LIMPA com ids próprios (não colidem com o baralho da mesa). */
function canastraLimpa(naipe = "copas", prefixo = "K") {
  return ["3", "4", "5", "6", "7", "8", "9"].map((v, i) =>
    ({ id: prefixo + i, naipe, valor: v, eh_coringa: false }));
}

/** Reescreve o jogo VIVO da sala para que `assento` bata no próximo descarte, e
 *  para que essa batida ENCERRE a partida (o placar já entra acima da meta).
 *
 *  Monta só a situação — quem decide se a batida vale continua sendo o motor,
 *  pela porta pública `descartar`. */
function prepararBatidaFinal(sala, assento, lado = "nos") {
  const j = sala.jogo;
  const dupla = J.duplaDoAssento(assento);
  j.jogosDupla[dupla] = [canastraLimpa()];
  j.mortoPego.nos = true;
  j.mortoPego.eles = true;
  j.mortos = [];
  j.maos[assento] = [{ id: "ULTIMA", naipe: "paus", valor: "K", eh_coringa: false }];
  j.vez = assento;
  j.jaComprou = true;
  j.rodadaEncerrada = false;
  j.deveUsarTopo = null;
  j.placar[lado] = 5000;
  j.metaPontos = 1;
}

// ===========================================================================
describe("VERSAO/CONTRATO", () => {
  test("VER-01: a primeira visão válida já traz os dois campos", async () => {
    const { jogadores } = await mesaComPartida({ humanos: 2 });
    const m = jogadores[0].ultimo("estado");

    assert.ok(Object.hasOwn(m, "versaoEstado"), "o evento `estado` precisa carregar versaoEstado");
    assert.ok(Object.hasOwn(m, "eventoId"), "o evento `estado` precisa carregar eventoId");
    assert.equal(m.tipo, "estado");
    assert.ok(m.visao, "a visão continua onde estava — os campos são irmãos dela");
    assert.equal(typeof m.eventoId, "string");
    assert.ok(m.eventoId.length > 0);
  });

  test("VER-02: versaoEstado é inteiro seguro, não negativo e nunca zero em mesa viva", async () => {
    const { jogadores } = await mesaComPartida({ humanos: 4 });

    // Todos os estados que QUALQUER um dos quatro recebeu, desde o lobby.
    for (const jog of jogadores) {
      for (const m of jog.todas("estado")) {
        assert.equal(typeof m.versaoEstado, "number");
        assert.ok(Number.isSafeInteger(m.versaoEstado), "versaoEstado precisa ser inteiro seguro");
        assert.ok(m.versaoEstado >= 0, "versaoEstado não pode ser negativa");
        // Zero é reservado para "não há estado autoritativo". Mesa viva nunca
        // emite zero: o carimbo mínimo é 1.
        assert.ok(m.versaoEstado >= 1, "mesa viva não emite versaoEstado 0");
      }
    }
  });

  test("VER-03: o eventoId é opaco e não é derivado da versão", async () => {
    const { codigo, srv, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    const antes = par(jogadores[0]);

    comprarDaVez(srv, sala, jogadores);
    const depois = par(jogadores[0]);

    assert.notEqual(depois.eventoId, antes.eventoId);
    // Nada do id pode ser lido como número de versão: se fosse derivado, o
    // cliente aprenderia a parsear e o formato viraria contrato.
    assert.ok(!depois.eventoId.includes(String(depois.versaoEstado + 1000000)));
    assert.match(depois.eventoId, /^[0-9a-f-]{36}$/, "esperava um id opaco de forma fixa");
    assert.equal(versaoDe(srv, codigo), depois.versaoEstado);
  });
});

// ===========================================================================
describe("VERSAO/MUTACAO", () => {
  test("VER-04: uma mutação válida incrementa exatamente uma vez", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    const antes = versaoDe(srv, codigo);

    comprarDaVez(srv, sala, jogadores);

    assert.equal(versaoDe(srv, codigo), antes + 1,
      "uma compra do monte é UMA mutação — não zero, não duas");
  });

  test("VER-05: comando fora do turno não incrementa", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    const antes = versaoDe(srv, codigo);
    const fora = porAssento(srv, jogadores)[(sala.jogo.vez + 1) % 4];

    fora.limpar();
    fora.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });

    assert.ok(fora.ultimo("erro"), "a jogada fora do turno precisa ser recusada");
    assert.equal(versaoDe(srv, codigo), antes, "recusa não é mutação: a versão não anda");
    // E o rebroadcast que acompanha a recusa reaproveita o carimbo vigente.
    assert.equal(par(fora).versaoEstado, antes);
  });

  test("VER-06: jogada malformada e tipo desconhecido também não incrementam", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    // Pelo cliente CERTO — o assento da vez. Assim a recusa é do comando em si,
    // e não da fronteira de turno (que já tem teste próprio).
    const daVez = porAssento(srv, jogadores)[sala.jogo.vez];
    const antes = versaoDe(srv, codigo);

    daVez.envia({ tipo: "jogada", jogada: { tipo: "naoExiste" } });
    daVez.envia({ tipo: "jogada", jogada: {} });
    daVez.envia({ tipo: "jogada" });
    daVez.envia({ tipo: "comandoInventado" });
    daVez.envia({ tipo: "jogada", jogada: { tipo: "descartar", id: "carta-que-nao-existe" } });

    assert.equal(versaoDe(srv, codigo), antes,
      "nenhum comando recusado pode inventar versão");
  });

  test("VER-07: reenvio sem mutação reutiliza versão E eventoId", async () => {
    const { srv, codigo, jogadores } = await mesaComPartida({ humanos: 4 });
    const antes = par(jogadores[0]);

    // Retransmissão pura, pela mesma porta que o servidor usa: nada mutou.
    srv.broadcastSala(codigo);
    srv.broadcastSala(codigo);
    srv.broadcastSala(codigo);

    const depois = par(jogadores[0]);
    assert.deepEqual(depois, antes, "reenvio do mesmo estado repete o par, não cria um novo");
    assert.ok(jogadores[0].todas("estado").length >= 4, "os reenvios de fato saíram");
  });

  test("VER-08: reconexão recebe o estado vigente sem criar versão artificial", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    comprarDaVez(srv, sala, jogadores);
    const vigente = par(jogadores[0]);

    // Partida começada não senta ninguém: a volta de quem não tem assento é
    // pelo caminho de assistir. É a única reconexão que este servidor tem.
    const voltou = await espectador(srv, codigo, { jogadorId: "uid-voltou" });

    assert.deepEqual(par(voltou), vigente,
      "quem volta recebe o estado VIGENTE, com o par vigente");
    assert.equal(versaoDe(srv, codigo), vigente.versaoEstado,
      "entrar na sala não é mutação da mesa");
  });

  test("VER-09: duas mutações sucessivas produzem versões crescentes e ids distintos", async () => {
    const { srv, sala, jogadores } = await mesaComPartida({ humanos: 4 });

    const marcos = [par(jogadores[0])];
    comprarDaVez(srv, sala, jogadores);
    marcos.push(par(jogadores[0]));
    descartarDaVez(srv, sala, jogadores);
    marcos.push(par(jogadores[0]));
    comprarDaVez(srv, sala, jogadores);
    marcos.push(par(jogadores[0]));

    for (let i = 1; i < marcos.length; i++) {
      assert.ok(marcos[i].versaoEstado > marcos[i - 1].versaoEstado,
        "a versão precisa CRESCER a cada mutação (passo " + i + ")");
      assert.notEqual(marcos[i].eventoId, marcos[i - 1].eventoId);
    }
    const ids = new Set(marcos.map((m) => m.eventoId));
    assert.equal(ids.size, marcos.length, "cada mutação tem um eventoId próprio");
  });

  test("VER-10: erro de autenticação não cria versão", async () => {
    const { srv, codigo } = await mesaComPartida({ humanos: 4 });
    const antes = versaoDe(srv, codigo);

    // Conexão que NUNCA autenticou, tentando de tudo dentro da mesa.
    const recebidas = [];
    const id = srv.conectar((msg) => recebidas.push(msg));
    srv.processar(id, { tipo: "assistirMesa", codigo });
    srv.processar(id, { tipo: "entrarMesa", codigo, apelido: "X" });
    srv.processar(id, { tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    // E uma credencial que o verificador recusa.
    await srv.autenticar(id, "token.invalido.aqui", 2);

    assert.equal(versaoDe(srv, codigo), antes, "falha de autenticação não versiona nada");
    assert.equal(recebidas.filter((m) => m.tipo === "estado").length, 0,
      "conexão não autenticada não recebe estado — logo, não pode carimbar");
  });

  test("VER-11: a versão nunca regride ao longo de uma partida inteira", async () => {
    const { srv, sala, jogadores } = await mesaComPartida({ humanos: 4 });

    for (let passo = 0; passo < 24; passo++) {
      if (sala.jogo.encerrada) break;
      if (sala.jogo.jaComprou) descartarDaVez(srv, sala, jogadores);
      else comprarDaVez(srv, sala, jogadores);
    }

    const serie = jogadores[0].todas("estado");
    assert.ok(serie.length > 10, "esperava uma série longa de estados");
    // Monotonicidade, e bijeção versão↔id: uma versão nunca aparece com dois
    // ids diferentes, e um id nunca aparece em duas versões.
    const idPorVersao = new Map();
    const versaoPorId = new Map();
    for (let i = 1; i < serie.length; i++) {
      assert.ok(serie[i].versaoEstado >= serie[i - 1].versaoEstado,
        "versão regrediu entre dois envios consecutivos");
    }
    for (const m of serie) {
      if (idPorVersao.has(m.versaoEstado)) {
        assert.equal(idPorVersao.get(m.versaoEstado), m.eventoId,
          "a mesma versão saiu com dois eventoId diferentes");
      }
      if (versaoPorId.has(m.eventoId)) {
        assert.equal(versaoPorId.get(m.eventoId), m.versaoEstado,
          "o mesmo eventoId saiu em duas versões diferentes");
      }
      idPorVersao.set(m.versaoEstado, m.eventoId);
      versaoPorId.set(m.eventoId, m.versaoEstado);
    }
  });
});

// ===========================================================================
describe("VERSAO/COERENCIA", () => {
  test("VER-12: as quatro visões da mesma mutação carregam o mesmo par", async () => {
    const { srv, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    for (const j of jogadores) j.limpar();

    comprarDaVez(srv, sala, jogadores);

    const pares = jogadores.map((j) => par(j));
    for (let i = 1; i < pares.length; i++) {
      assert.deepEqual(pares[i], pares[0],
        "assento " + i + " recebeu par diferente do assento 0 para a MESMA mutação");
    }
    // As visões em si continuam DIFERENTES — cada um vê a própria mão. O par é
    // igual porque é da mesa; a visão é diferente porque é do papel.
    assert.notDeepEqual(jogadores[0].ultimo("estado").visao.suaMao,
      jogadores[1].ultimo("estado").visao.suaMao);
  });

  test("VER-13: gerar quatro visões não provoca quatro incrementos", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    const antes = versaoDe(srv, codigo);

    comprarDaVez(srv, sala, jogadores);

    assert.equal(versaoDe(srv, codigo), antes + 1,
      "quatro destinatários, uma mutação: o incremento é UM");
    // E serializar mais vezes, sozinho, não move nada.
    for (let i = 0; i < 10; i++) {
      srv.ger.visaoPara({ codigo, papel: "jogador", assento: 0 });
      srv.ger.visaoPara({ codigo, papel: "espectador" });
    }
    assert.equal(versaoDe(srv, codigo), antes + 1, "serialização não é mutação");
  });

  test("VER-14: a visão de espectador traz o mesmo par do estado correspondente", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    const esp = await espectador(srv, codigo);
    for (const j of jogadores) j.limpar();
    esp.limpar();

    comprarDaVez(srv, sala, jogadores);

    const doAssento = par(jogadores[0]);
    const doEspectador = par(esp);
    assert.deepEqual(doEspectador, doAssento,
      "quem assiste precisa poder ordenar o mesmo fluxo que quem joga");
    // E o recorte continua sendo o de espectador — o par não abriu porta nenhuma.
    assert.equal(esp.ultimo("estado").visao.espectador, true);
    assert.equal(esp.ultimo("estado").visao.suaMao, undefined);
  });

  test("VER-15: duas conexões não criam versões concorrentes nem regressivas", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    const assentos = porAssento(srv, jogadores);
    const a = assentos[sala.jogo.vez];
    const b = assentos[(sala.jogo.vez + 1) % 4];

    for (const j of jogadores) j.limpar();
    // Dois comandos no MESMO passo: um válido (o da vez) e um recusado.
    a.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    const depoisDoValido = versaoDe(srv, codigo);
    b.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    const depoisDoRecusado = versaoDe(srv, codigo);

    assert.equal(depoisDoRecusado, depoisDoValido,
      "a segunda conexão não abre versão própria");
    // Todos os estados emitidos no passo, por qualquer conexão, são coerentes:
    // versão igual implica eventoId igual, sem exceção.
    const todos = jogadores.flatMap((j) => j.todas("estado"));
    const porVersao = new Map();
    for (const m of todos) {
      if (porVersao.has(m.versaoEstado)) {
        assert.equal(porVersao.get(m.versaoEstado), m.eventoId,
          "duas conexões viram a mesma versão com ids diferentes");
      }
      porVersao.set(m.versaoEstado, m.eventoId);
    }
    // E o carimbo é idempotente na primitiva: chamar de novo devolve o mesmo par.
    const primeiro = carimbarEstado(sala);
    const segundo = carimbarEstado(sala);
    assert.deepEqual(segundo, primeiro);
  });

  test("VER-16: encerramento e o produtor de conquista ficam no MESMO evento", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4, metaPontos: 1 });
    const assento = 0;
    prepararBatidaFinal(sala, assento, "nos");
    for (const j of jogadores) j.limpar();

    jogadores[assento].envia({ tipo: "jogada", jogada: { tipo: "descartar", id: "ULTIMA" } });

    assert.equal(sala.jogo.encerrada, true, "a batida precisa ter encerrado a partida");
    assert.ok(sala.envelopeEncerramento, "o produtor de encerramento precisa ter produzido");
    assert.equal(sala.envelopeEncerramento.assentoQueBateuFinal, assento,
      "é este assento que a conquista de primeira batida vai ler");
    assert.ok(jogadores[assento].ultimo("fim"), "o evento `fim` precisa ter saído");

    // O encerramento é UMA mutação autoritativa, e ela tem UM par.
    const doEncerramento = par(jogadores[assento]);
    assert.equal(doEncerramento.versaoEstado, versaoDe(srv, codigo));
    for (const j of jogadores) {
      assert.deepEqual(par(j), doEncerramento, "o encerramento sai carimbado igual para todos");
    }
    // `fim` NÃO é um estado novo: ele não inventa versão, e o reenvio do estado
    // depois dele continua no mesmo par.
    srv.broadcastSala(codigo);
    assert.deepEqual(par(jogadores[assento]), doEncerramento,
      "o estado depois do `fim` continua sendo o mesmo estado");
  });
});

// ===========================================================================
describe("VERSAO/ISOLAMENTO", () => {
  test("VER-17: partidas diferentes não colidem, mesmo com versaoEstado igual", async () => {
    const srv = novoServidor();
    const ids = [];
    const versoes = [];

    for (let mesa = 0; mesa < 3; mesa++) {
      const dono = await cliente(srv, "uid-dono-" + mesa);
      dono.envia({ tipo: "criarMesa", apelido: "Dono" });
      const codigo = dono.ultimo("entrou").codigo;
      dono.envia({ tipo: "iniciarPartida" });
      const p = par(dono);
      ids.push(p.eventoId);
      versoes.push(p.versaoEstado);
      assert.ok(srv.ger.salas[codigo].partidaId, "cada mesa cunha a própria partida");
    }

    // A situação exata que o contrato precisa cobrir: MESMA versaoEstado em
    // partidas diferentes. É por isso que o eventoId é sorteado, e não derivado.
    assert.equal(new Set(versoes).size, 1, "esperava as três mesas na mesma versão");
    assert.equal(new Set(ids).size, 3, "ids de partidas diferentes NÃO podem colidir");
  });

  test("VER-18: a versão de uma mesa não anda quando outra mesa muta", async () => {
    const srv = novoServidor();
    const a = await cliente(srv, "uid-a");
    a.envia({ tipo: "criarMesa", apelido: "A" });
    const codigoA = a.ultimo("entrou").codigo;
    const b = await cliente(srv, "uid-b");
    b.envia({ tipo: "criarMesa", apelido: "B" });
    const codigoB = b.ultimo("entrou").codigo;

    const antesA = versaoDe(srv, codigoA);
    const antesB = versaoDe(srv, codigoB);
    b.envia({ tipo: "iniciarPartida" });

    assert.ok(versaoDe(srv, codigoB) > antesB, "a mesa B precisa ter andado");
    assert.equal(versaoDe(srv, codigoA), antesA, "a mesa A não pode andar por causa da B");
  });

  test("VER-19: os metadados não revelam uid, token, carta nem mão", async () => {
    const { srv, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    comprarDaVez(srv, sala, jogadores);

    const segredos = J.segredosDoEspectador(sala.jogo);
    for (const j of jogadores) {
      for (const m of j.todas("estado")) {
        const metadados = { versaoEstado: m.versaoEstado, eventoId: m.eventoId };
        // Nenhuma carta de mão, monte ou morto pode estar no carimbo.
        assert.deepEqual(varrerSegredos(metadados, segredos), [],
          "o carimbo vazou id de carta secreta");
        // Nem uid, nem apelido, nem token.
        const texto = JSON.stringify(metadados);
        for (const uid of ["uid-0", "uid-1", "uid-2", "uid-3", "uid-espectador"]) {
          assert.ok(!texto.includes(uid), "o carimbo vazou o uid " + uid);
        }
        assert.ok(!texto.toLowerCase().includes("token"));
        assert.ok(!texto.includes(sala.partidaId), "o carimbo não deve expor o partidaId");
      }
    }
  });
});

// ===========================================================================
describe("VERSAO/ESTRUTURA", () => {
  // Estes testes existem para impedir que ALGUÉM, amanhã, resolva o mesmo
  // problema uma segunda vez em outro lugar. Um contador por socket ou por
  // assento pareceria funcionar em teste manual e quebraria exatamente o que a
  // versão existe para garantir: duas conexões numerando o mesmo estado
  // diferente.

  test("VER-20: nenhuma conexão carrega contador próprio de versão", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    await espectador(srv, codigo);
    comprarDaVez(srv, sala, jogadores);

    const proibidos = ["versaoEstado", "eventoId", "impressaoEstado", "versao", "seqEstado"];
    for (const cid in srv.conexoes) {
      for (const campo of proibidos) {
        assert.ok(!(campo in srv.conexoes[cid]),
          "a conexão " + cid + " ganhou o campo '" + campo + "': isso é um contador paralelo");
      }
    }
  });

  test("VER-21: a versão só é ESCRITA no ponto único, dentro do gerenciador", () => {
    // Recorta os módulos do bundle e confere onde há ATRIBUIÇÃO (`=`) aos
    // campos do carimbo. Leitura (`meta.versaoEstado`) e literal de objeto
    // (`versaoEstado: ...`) não contam — só a escrita.
    const escrita = /\b(versaoEstado|eventoId|impressaoEstado)\s*=(?!=)/g;

    const inicioServidor = FONTE.indexOf('__fabricas["servidor"]');
    const inicioWs = FONTE.indexOf('__fabricas["ws_server"]');
    const inicioSalas = FONTE.indexOf('__fabricas["salas"]');
    assert.ok(inicioServidor > 0 && inicioWs > inicioServidor && inicioSalas > 0);

    const despachante = FONTE.slice(inicioServidor, inicioWs);
    const transporte = FONTE.slice(inicioWs);
    assert.deepEqual(despachante.match(escrita), null,
      "o despachante não pode ATRIBUIR versão — ele só lê por `metadadosDe`");
    assert.deepEqual(transporte.match(escrita), null,
      "o transporte não pode atribuir versão");

    // E dentro de salas, a escrita mora só em `carimbarEstado`.
    const salas = FONTE.slice(inicioSalas, inicioServidor);
    const escritas = salas.match(escrita) || [];
    assert.equal(escritas.length, 3,
      "esperava exatamente as 3 escritas de `carimbarEstado`, achei " + escritas.length);
    const corpo = salas.slice(
      salas.indexOf("function carimbarEstado"),
      salas.indexOf("/** Retrato imutável")
    );
    assert.equal((corpo.match(escrita) || []).length, 3,
      "as 3 escritas precisam estar TODAS dentro de `carimbarEstado`");
  });

  test("VER-22: o evento `estado` é montado num lugar só", () => {
    const inicioServidor = FONTE.indexOf('__fabricas["servidor"]');
    const despachante = FONTE.slice(inicioServidor, FONTE.indexOf('__fabricas["ws_server"]'));
    const literais = despachante.match(/\{\s*tipo:\s*"estado"/g) || [];
    assert.equal(literais.length, 1,
      "esperava UM literal de evento `estado` (o de `eventoEstado`), achei " + literais.length +
      " — um segundo lugar montando o evento sairia sem carimbo no primeiro ajuste");
  });

  test("VER-23: a impressão exclui o carimbo e a escrituração — e nada mais", () => {
    // A lista fica FIXADA aqui de propósito. Ela é o único lugar por onde uma
    // mutação real poderia deixar de versionar, então acrescentar um campo
    // precisa passar por uma mudança visível de teste, e não por um commit que
    // "só ajusta a impressão".
    assert.deepEqual([...CAMPOS_FORA_DA_IMPRESSAO].sort(),
      ["eventoId", "fimEmitido", "impressaoEstado", "versaoEstado"]);

    // A prova de que a exclusão é necessária: com o carimbo dentro da
    // impressão, carimbar duas vezes seguidas já mudaria a impressão.
    const ger = criarGerenciador({ gerarCodigo: () => "MESA-IMP" });
    const { codigo } = ger.criarMesa({ apelido: "A" });
    const sala = ger.salas[codigo];
    const p1 = carimbarEstado(sala);
    const p2 = carimbarEstado(sala);
    assert.deepEqual(p2, p1, "sem mutação, carimbar de novo não muda nada");

    // E a prova de que a lista é de EXCLUSÃO: um campo autoritativo novo passa
    // a ser versionado sozinho, sem ninguém registrá-lo em lugar nenhum.
    const impressaoAntes = impressaoDoEstado(sala);
    sala.campoAutoritativoInventadoAgora = { qualquer: "coisa" };
    assert.notEqual(impressaoDoEstado(sala), impressaoAntes,
      "campo novo na sala precisa mudar a impressão sem registro manual");
    assert.equal(carimbarEstado(sala).versaoEstado, p1.versaoEstado + 1);
  });

  test("VER-24: mutação feita FORA do gerenciador também versiona", async () => {
    // `afkBot` e `afkVoltar` mexem em `sala.jogo.assentos[i].tipo` de dentro do
    // despachante. É exatamente o caso que um contador nos pontos de mutação
    // do gerenciador deixaria passar.
    const { srv, codigo, sala, jogadores } = await mesaComPartida({ humanos: 4 });
    const antes = versaoDe(srv, codigo);
    // Um assento que NÃO é o da vez, para o afk não se confundir com jogada.
    const alvo = (sala.jogo.vez + 1) % 4;
    porAssento(srv, jogadores)[alvo].envia({ tipo: "afkBot" });

    assert.equal(sala.jogo.assentos[alvo].tipo, "bot", "o assento precisa ter virado bot");
    assert.ok(versaoDe(srv, codigo) > antes,
      "mutação de fora do gerenciador precisa versionar — é o que a impressão garante");
  });
});
