// test/espectador.test.js — ENFORCEMENT DE VISÃO DE ESPECTADOR (P0 de sigilo).
//
// O que esta suíte defende, em uma frase: um espectador pode adulterar payload,
// chamar qualquer mensagem do protocolo, informar o UID ou o assento de outro
// jogador e reconectar em qualquer estado; ainda assim o servidor nunca lhe
// entrega carta nem qualquer informação privada fora da visão pública.
//
// Contrato de referência: `app/lib/motor/visao_espectador.dart` (repo do app).

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  J,
  novoServidor,
  cliente,
  mesaComPartida,
  espectador,
  espectadorVigiado,
  marcarSegredos,
  varrerSegredos,
  segredosAgora,
  PREFIXO_SEGREDO,
} = require("./ajuda.js");

/** Campos que SÓ existem na visão de assento. Se um deles aparecer para quem
 *  assiste, alguém devolveu snapshot de jogador — falha imediata. */
const CAMPOS_DE_ASSENTO = ["suaMao", "suaVez", "precisaUsarTopo", "ehVoce"];

/** Asserção central: `visao` é pública, íntegra e sem nenhum segredo. */
function exigirVisaoPublica(visao, jogo, contexto) {
  assert.ok(visao, contexto + ": veio visão vazia");
  assert.equal(visao.espectador, true, contexto + ": visão não está marcada como de espectador");
  assert.equal(visao.voceAssento, null, contexto + ": espectador não pode ter assento");

  for (const campo of CAMPOS_DE_ASSENTO) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(visao, campo),
      false,
      contexto + ": campo de assento `" + campo + "` vazou para o espectador"
    );
  }

  const vazou = varrerSegredos(visao, segredosAgora(jogo));
  assert.deepEqual(vazou, [], contexto + ": id(s) secreto(s) na visão pública");

  // Rede de segurança independente do conjunto: nenhum id carimbado, em lugar
  // nenhum do payload serializado.
  const texto = JSON.stringify(visao);
  assert.equal(
    texto.includes(PREFIXO_SEGREDO),
    false,
    contexto + ": marcador de segredo encontrado no payload serializado"
  );
}

/** Varre TUDO o que o espectador recebeu — snapshot inicial e incrementais. */
function exigirTudoLimpo(esp, jogo, contexto) {
  const segredos = segredosAgora(jogo);
  assert.deepEqual(
    varrerSegredos(esp.recebidas, segredos),
    [],
    contexto + ": segredo em alguma mensagem recebida pelo espectador"
  );
  const texto = JSON.stringify(esp.recebidas);
  assert.equal(
    texto.includes(PREFIXO_SEGREDO),
    false,
    contexto + ": marcador de segredo no fluxo de mensagens do espectador"
  );
  for (const visao of esp.estados()) exigirVisaoPublica(visao, jogo, contexto);
}

// ===========================================================================
// P0-01 — ENDPOINT DIRETO
// ===========================================================================
describe("P0-01 — endpoint direto", () => {
  test("P0-01: nenhuma mensagem do protocolo devolve visão de assento ao espectador", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    const segredosMarcados = marcarSegredos(sala.jogo);
    assert.ok(segredosMarcados.length > 0, "a partida de teste precisa ter segredos");

    const esp = await espectador(srv, codigo);

    // Todo `tipo` que o despachante conhece, incluindo os que existem para
    // jogador. Nenhum pode virar porta dos fundos para o estado completo.
    const mensagens = [
      { tipo: "assistirMesa", codigo },
      { tipo: "iniciarPartida" },
      { tipo: "jogada", jogada: { tipo: "comprarMonte" } },
      { tipo: "jogada", jogada: { tipo: "comprarLixo" } },
      { tipo: "jogada", jogada: { tipo: "descartar", id: segredosMarcados[0] } },
      { tipo: "jogada", jogada: { tipo: "baixar", ids: segredosMarcados.slice(0, 3) } },
      { tipo: "jogada", jogada: { tipo: "estender", indiceJogo: 0, ids: segredosMarcados.slice(0, 2) } },
      { tipo: "afkBot" },
      { tipo: "afkVoltar" },
      { tipo: "perfil" },
      { tipo: "ranking" },
      { tipo: "definirAvatar", galeria: 1 },
      { tipo: "denunciarAvatar", alvo: "uid-1" },
      { tipo: "entrarMesa", codigo },
      { tipo: "tipoQueNaoExiste" },
      {},
    ];
    for (const msg of mensagens) esp.envia(msg);

    exigirTudoLimpo(esp, sala.jogo, "P0-01");
  });

  test("P0-01: abrir a própria mesa não dá acesso à mesa que ele assistia", async () => {
    // `criarMesa` é legítimo — qualquer um pode abrir mesa. O que não pode é
    // isso virar porta dos fundos para a partida que ele estava assistindo.
    const { srv, codigo, sala } = await mesaComPartida();
    marcarSegredos(sala.jogo);

    const esp = await espectador(srv, codigo);

    // [COMPOSIÇÃO] Antes este comando ia com `jogadorId: "uid-intruso"` e era
    // executado. Depois da composição, declarar uid alheio é RECUSADO antes de
    // executar — resultado mais forte, e afirmado aqui em vez de perdido.
    esp.envia({ tipo: "criarMesa", apelido: "Intruso", jogadorId: "uid-intruso" });
    assert.equal(esp.ultimo("entrou"), null, "identidade divergente não executa");
    assert.equal(esp.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");

    // Agora o comando LEGÍTIMO, que é o que o título deste teste examina: abrir
    // mesa própria não pode virar porta dos fundos para a mesa assistida.
    esp.envia({ tipo: "criarMesa", apelido: "Intruso" });

    // Ele agora é dono de OUTRA mesa (vazia), e saiu da que assistia.
    const nova = esp.ultimo("entrou").codigo;
    assert.notEqual(nova, codigo, "criarMesa tem que abrir mesa nova, não tomar a existente");
    assert.equal(srv.conexoes[esp.id].codigo, nova);

    // E o broadcast da mesa antiga não o alcança mais.
    srv.broadcastSala(codigo);
    assert.deepEqual(
      varrerSegredos(esp.recebidas, segredosAgora(sala.jogo)),
      [],
      "segredo da mesa assistida vazou pela criação de outra mesa"
    );
  });

  test("P0-01: chamar a porta de serialização sem papel reconhecido não devolve estado", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    marcarSegredos(sala.jogo);

    // Fail-closed: sem papel válido a porta não monta payload nenhum.
    for (const papel of [undefined, null, "", "admin", "jogador", "owner", "debug"]) {
      const v = srv.ger.visaoPara({ codigo, papel, assento: undefined });
      assert.ok(v.erro, "papel `" + papel + "` sem assento não podia render estado");
      assert.equal(v.suaMao, undefined);
    }
  });
});

// ===========================================================================
// P0-02 — UID DE TERCEIRO
// ===========================================================================
describe("P0-02 — UID de terceiro", () => {
  test("P0-02: reivindicar UID e assento de participante real não eleva acesso", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    marcarSegredos(sala.jogo);

    // `uid-1` é um participante REAL, sentado. O espectador se apresenta como
    // ele, e ainda pede o assento dele.
    const esp = await espectador(srv, codigo, {
      jogadorId: "uid-1",
      viewerUid: "uid-1",
      playerUid: "uid-1",
      uid: "uid-1",
      assento: 2,
      seat: 2,
    });

    const conexao = srv.conexoes[esp.id];
    assert.equal(conexao.assento, null, "identidade reivindicada não pode conceder assento");
    assert.equal(srv.papelDe(conexao), "espectador");

    // E insistindo pelo caminho de estado e de jogada, com o UID do terceiro:
    esp.envia({ tipo: "assistirMesa", codigo, jogadorId: "uid-1", assento: 2 });
    esp.envia({ tipo: "jogada", jogadorId: "uid-1", assento: 2, jogada: { tipo: "comprarMonte" } });
    esp.envia({ tipo: "entrarMesa", codigo, jogadorId: "uid-1", assento: 2 });

    assert.equal(srv.conexoes[esp.id].assento, null);
    exigirTudoLimpo(esp, sala.jogo, "P0-02");
  });

  test("P0-02: o assento pedido no payload é ignorado ao entrar na mesa", async () => {
    const srv = novoServidor();
    // [COMPOSIÇÃO] Cada conexão autentica com o uid que ela declara: o alvo
    // deste teste é o ASSENTO pedido no payload, não a identidade.
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono", jogadorId: "uid-0" });
    const codigo = dono.ultimo("entrou").codigo;

    // O assento 0 é do dono. Pedir 0 no payload não o toma dele.
    const outro = await cliente(srv, "uid-9");
    outro.envia({ tipo: "entrarMesa", codigo, apelido: "Outro", jogadorId: "uid-9", assento: 0 });

    assert.notEqual(outro.ultimo("entrou").assento, 0, "assento do payload não pode ser honrado");
    assert.equal(srv.conexoes[dono.id].assento, 0, "o dono não pode perder o assento");
  });
});

// ===========================================================================
// P0-03 — PARÂMETRO ADULTERADO
// ===========================================================================
describe("P0-03 — parâmetro adulterado", () => {
  test("P0-03: nenhum parâmetro de payload muda o nível de acesso", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    marcarSegredos(sala.jogo);

    const adulteracoes = {
      modo: "jogador",
      modoVisao: "completa",
      role: "player",
      papel: "jogador",
      viewerType: "participant",
      seat: 0,
      assento: 0,
      voceAssento: 0,
      reconnect: true,
      reconectando: true,
      spectator: false,
      souEspectador: false,
      espectador: false,
      owner: true,
      criador: true,
      participant: true,
      admin: true,
      debug: true,
      versaoEstado: 999,
      token: "qualquer-coisa",
    };

    const esp = await espectador(srv, codigo, adulteracoes);
    assert.equal(srv.papelDe(srv.conexoes[esp.id]), "espectador");

    // E repetindo a adulteração em cada mensagem do protocolo.
    for (const tipo of ["assistirMesa", "jogada", "iniciarPartida", "afkBot", "afkVoltar", "entrarMesa"]) {
      esp.envia(Object.assign({ tipo, codigo, jogada: { tipo: "comprarMonte" } }, adulteracoes));
    }

    assert.equal(srv.conexoes[esp.id].assento, null);
    exigirTudoLimpo(esp, sala.jogo, "P0-03");
  });

  test("P0-03: o papel sai do assento concedido, não do que o cliente mandou", async () => {
    const { srv, codigo } = await mesaComPartida();
    const esp = await espectador(srv, codigo);
    const conexao = srv.conexoes[esp.id];

    // Mesmo sujando a própria mensagem com um assento, o papel não muda —
    // `papelDe` não lê `msg`, lê o assento que o gerenciador concedeu.
    assert.equal(srv.papelDe(conexao), "espectador");
    conexao.jogadorId = "uid-0"; // identidade alegada de um participante real
    assert.equal(srv.papelDe(conexao), "espectador", "identidade não pode virar papel");
  });
});

// ===========================================================================
// COBERTURA ADICIONAL — ESPEC-01 .. ESPEC-10
// ===========================================================================
describe("ESPEC — cobertura adicional", () => {
  test("ESPEC-01: espectador comum recebe somente a visão pública", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    marcarSegredos(sala.jogo);
    const esp = await espectador(srv, codigo);

    const visao = esp.ultimo("estado").visao;
    exigirVisaoPublica(visao, sala.jogo, "ESPEC-01");

    // O que ele PODE ver está lá (não basta não vazar: tem que servir).
    assert.equal(typeof visao.vez, "number");
    assert.equal(visao.monteQtd, sala.jogo.monte.length);
    assert.deepEqual(visao.qtdCartasPorAssento, sala.jogo.maos.map((m) => m.length));
    assert.equal(visao.placarNos, sala.jogo.placar.nos);
    assert.equal(visao.assentos.length, 4);
    for (const a of visao.assentos) assert.equal(typeof a.apelido, "string");
  });

  test("ESPEC-02: jogador sentado continua recebendo a própria visão, sem regressão", async () => {
    const { sala, jogadores } = await mesaComPartida();
    const visao = jogadores[0].ultimo("estado").visao;

    assert.equal(visao.voceAssento, 0);
    assert.equal(visao.espectador, undefined, "visão de assento não é de espectador");
    assert.ok(Array.isArray(visao.suaMao), "o jogador precisa receber a própria mão");
    assert.equal(visao.suaMao.length, sala.jogo.maos[0].length);
    assert.deepEqual(
      visao.suaMao.map((c) => c.id),
      sala.jogo.maos[0].map((c) => c.id)
    );
    assert.equal(visao.suaVez, sala.jogo.vez === 0);
  });

  test("ESPEC-03: jogador A não recebe a mão de B, mesmo sendo participante", async () => {
    const { srv, sala, jogadores } = await mesaComPartida();

    // A ordem de chegada NÃO é a ordem dos assentos (o 2º humano senta no 2,
    // parceiro do criador). Quem manda é o assento concedido pelo servidor.
    const porAssento = [];
    for (const j of jogadores) porAssento[srv.conexoes[j.id].assento] = j;
    assert.equal(porAssento.filter(Boolean).length, 4, "os 4 assentos precisam estar ocupados");

    for (let a = 0; a < 4; a++) {
      const visao = porAssento[a].ultimo("estado").visao;
      assert.equal(visao.voceAssento, a);
      // segredo aqui = mãos ALHEIAS + monte + mortos (a própria mão é legítima)
      const segredosDosOutros = new Set();
      sala.jogo.maos.forEach((mao, i) => {
        if (i !== a) mao.forEach((c) => segredosDosOutros.add(c.id));
      });
      sala.jogo.monte.forEach((c) => segredosDosOutros.add(c.id));
      sala.jogo.mortos.forEach((m) => m.forEach((c) => segredosDosOutros.add(c.id)));

      assert.deepEqual(
        varrerSegredos(visao, segredosDosOutros),
        [],
        "assento " + a + " recebeu carta que não é dele"
      );
    }
  });

  test("ESPEC-04: reconexão não devolve mais do que a pessoa já podia ver", async () => {
    const { srv, codigo, sala, jogadores } = await mesaComPartida();
    marcarSegredos(sala.jogo);

    // O jogador do assento 2 cai. (Regra atual do servidor, fora do escopo
    // desta OS: o assento vira BOT e não há retomada de assento.)
    srv.desconectar(jogadores[2].id);

    // Ele volta. Sem assento a retomar, volta como quem assiste — e é só isso
    // que ele recebe. A autorização é RECALCULADA na reentrada; nada do
    // cliente (código guardado, assento antigo, versão de estado) participa.
    const devolta = await espectador(srv, codigo, { assento: 2, seat: 2, reconnect: true, jogadorId: "uid-2" });
    assert.equal(srv.papelDe(srv.conexoes[devolta.id]), "espectador");
    exigirTudoLimpo(devolta, sala.jogo, "ESPEC-04");

    // E o caminho de sentar de novo continua fechado pela regra da mesa.
    const tentativa = await cliente(srv, "uid-2");
    tentativa.envia({ tipo: "entrarMesa", codigo, jogadorId: "uid-2", assento: 2 });
    assert.ok(tentativa.ultimo("erro"), "não se senta numa partida já começada");
    assert.equal(tentativa.ultimo("entrou"), null);
    assert.equal(tentativa.todas("estado").length, 0, "quem não entrou não recebe estado");
  });

  test("ESPEC-05: espectador não ganha privilégio por reconectar", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    marcarSegredos(sala.jogo);

    const esp = await espectador(srv, codigo);
    const visaoAntes = esp.ultimo("estado").visao;

    // Cai e volta várias vezes, sempre alegando mais do que tem.
    for (let i = 0; i < 3; i++) {
      srv.desconectar(esp.id);
      const volta = await espectador(srv, codigo, {
        assento: i % 4,
        reconnect: true,
        versaoEstado: 1,
        papel: "jogador",
        token: "token-anterior",
      });
      assert.equal(srv.papelDe(srv.conexoes[volta.id]), "espectador", "volta " + i);
      exigirTudoLimpo(volta, sala.jogo, "ESPEC-05 volta " + i);
    }

    assert.equal(visaoAntes.espectador, true);
  });

  test("ESPEC-06: partida com robôs não expõe mão nem decisão dos bots", async () => {
    // 1 humano: os assentos 1, 2 e 3 viram bots ao iniciar.
    const { srv, codigo, sala } = await mesaComPartida({ humanos: 1, metaPontos: 200 });
    const jogo = sala.jogo;
    marcarSegredos(jogo);

    const esp = await espectador(srv, codigo);
    const visao = esp.ultimo("estado").visao;

    exigirVisaoPublica(visao, jogo, "ESPEC-06");
    assert.ok(
      visao.assentos.some((a) => a.tipo === "bot"),
      "a mesa de teste precisa ter bot"
    );
    // Nada de estrutura interna do bot na visão pública.
    for (const proibido of ["dificuldade", "substituto", "plano", "decisao", "log"]) {
      assert.equal(
        JSON.stringify(visao).includes('"' + proibido + '"'),
        false,
        "campo interno de bot `" + proibido + "` na visão pública"
      );
    }
    // O log de jogadas dos bots vive na sala e nunca é transmitido.
    assert.deepEqual(varrerSegredos(esp.recebidas, segredosAgora(jogo)), []);
  });

  test("ESPEC-07: os quatro assentos ficam ocultos para quem assiste", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    const jogo = sala.jogo;
    marcarSegredos(jogo);

    const esp = await espectador(srv, codigo);
    const visao = esp.ultimo("estado").visao;

    for (let a = 0; a < 4; a++) {
      const idsDaMao = new Set(jogo.maos[a].map((c) => c.id));
      assert.deepEqual(
        varrerSegredos(visao, idsDaMao),
        [],
        "mão do assento " + a + " vazou"
      );
      // A CONTAGEM, sim, é pública — é o que se vê em volta da mesa real.
      assert.equal(visao.qtdCartasPorAssento[a], jogo.maos[a].length);
      assert.equal(visao.assentos[a].qtdCartas, jogo.maos[a].length);
    }
  });

  test("ESPEC-08: nenhum id do monte ou dos mortos aparece", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    const jogo = sala.jogo;
    marcarSegredos(jogo);

    const esp = await espectador(srv, codigo);
    const visao = esp.ultimo("estado").visao;

    const ocultos = new Set();
    jogo.monte.forEach((c) => ocultos.add(c.id));
    jogo.mortos.forEach((m) => m.forEach((c) => ocultos.add(c.id)));
    assert.deepEqual(varrerSegredos(visao, ocultos), [], "monte/morto vazou");

    // Só a contagem.
    assert.equal(visao.monteQtd, jogo.monte.length);
    assert.equal(visao.mortosQtd, jogo.mortos.length);
    assert.deepEqual(visao.mortosTamanhos, jogo.mortos.map((m) => m.length));
  });

  test("ESPEC-09: erro de regra não revela carta secreta ao espectador", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    const jogo = sala.jogo;
    const marcados = marcarSegredos(jogo);

    const esp = await espectador(srv, codigo);
    esp.limpar();

    // Pede jogadas ilegais citando cartas secretas de propósito. A recusa não
    // pode devolver o detalhe — nem ecoar de volta o id que ele chutou.
    for (const jogada of [
      { tipo: "descartar", id: marcados[0] },
      { tipo: "comprarLixo" },
      { tipo: "baixar", ids: marcados.slice(0, 3) },
      { tipo: "estender", indiceJogo: 0, ids: [marcados[1]] },
      { tipo: "inventada" },
    ]) {
      esp.envia({ tipo: "jogada", jogada });
    }

    const erros = esp.todas("erro");
    assert.ok(erros.length > 0, "as jogadas ilegais precisam ser recusadas");
    for (const e of erros) {
      assert.equal(
        e.motivo.includes(PREFIXO_SEGREDO),
        false,
        "a mensagem de erro citou uma carta secreta: " + e.motivo
      );
    }
    // Recusa genérica: sempre o mesmo texto, sem detalhe do estado da mesa.
    assert.equal(new Set(erros.map((e) => e.motivo)).size, 1, "a recusa tem que ser genérica");
    exigirTudoLimpo(esp, jogo, "ESPEC-09");
  });

  test("ESPEC-10: campo privado NOVO no modelo não vaza (lista de permissão)", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    const jogo = sala.jogo;
    marcarSegredos(jogo);

    // Simula a evolução futura do motor: alguém acrescenta estado privado ao
    // jogo e aos assentos. Como a visão pública é construída por LISTA DE
    // PERMISSÃO, o campo novo simplesmente não existe nela — sem ninguém
    // precisar lembrar de escondê-lo.
    jogo.segredoNovoDoMotor = { cartas: jogo.maos[0], seed: "rng-123" };
    jogo.antiCheat = { impressaoDaMao: jogo.maos[1].map((c) => c.id) };
    jogo.assentos.forEach((a, i) => {
      a.segredoDoAssento = { mao: jogo.maos[i], plano: "baixar " + jogo.maos[i][0].id };
    });

    const esp = await espectador(srv, codigo);
    const visao = esp.ultimo("estado").visao;

    exigirVisaoPublica(visao, jogo, "ESPEC-10");
    for (const campo of ["segredoNovoDoMotor", "antiCheat", "segredoDoAssento", "seed", "impressaoDaMao"]) {
      assert.equal(
        JSON.stringify(visao).includes(campo),
        false,
        "campo privado novo `" + campo + "` vazou para a visão pública"
      );
    }
  });
});

// ===========================================================================
// §8 — PROVA ESTRUTURAL DE NÃO VAZAMENTO (partida inteira, evento a evento)
// ===========================================================================
describe("§8/§10 — prova estrutural ao longo da partida", () => {
  test("nenhum segredo atravessa em NENHUM evento, do início ao fim da partida", async () => {
    // Meta baixa: a partida encerra DE VERDADE dentro do teste, passando por
    // compra, descarte, morto, batida, nova rodada e encerramento.
    const { srv, codigo, sala } = await mesaComPartida({ humanos: 1, metaPontos: 100 });
    const jogo = sala.jogo;

    // O vigia confere cada payload no instante do envio (ver `ajuda.js`): é o
    // único jeito honesto de varrer uma partida inteira, porque uma carta
    // secreta vira pública ao ser descartada ou baixada.
    const esp = await espectadorVigiado(srv, codigo, () => sala.jogo);

    // Deixa a mesa andar sozinha: os assentos 1..3 são bots e o 0 entra em
    // AFK, então o servidor joga a partida inteira e emite a cadeia completa
    // de eventos incrementais.
    for (const cid in srv.conexoes) {
      if (srv.conexoes[cid].assento === 0) srv.processar(cid, { tipo: "afkBot" });
    }

    assert.ok(esp.estados().length > 1, "o espectador precisa ter recebido eventos incrementais");
    assert.ok(jogo.rodada >= 1, "a partida precisa ter andado");
    assert.deepEqual(esp.violacoes, [], "segredo vivo dentro de um payload de espectador");

    // Nenhum estado recebido carrega campo de assento, em nenhum momento.
    for (const visao of esp.estados()) {
      assert.equal(visao.espectador, true);
      for (const campo of CAMPOS_DE_ASSENTO) {
        assert.equal(Object.prototype.hasOwnProperty.call(visao, campo), false, "campo `" + campo + "` num evento incremental");
      }
    }

    // Inclusive na mensagem de FIM: quem assiste vê placar, não carteira.
    const fim = esp.ultimo("fim");
    assert.ok(fim, "a partida precisa ter encerrado para provar o evento de fim");
    assert.equal(fim.resumo, undefined, "carteira/ganhos não são públicos");
    assert.ok(fim.placar, "o placar final é público");
  });

  test("a varredura do próprio bundle enxerga segredo em qualquer profundidade", async () => {
    // O tripwire de `salas` depende desta função; se ela for enfraquecida, a
    // segunda tranca cai em silêncio. Aqui ela é testada de frente.
    const segredos = new Set(["S1", "S2"]);
    assert.deepEqual([...J.vazamentosNaVisao({ a: 1 }, segredos)], []);
    assert.deepEqual([...J.vazamentosNaVisao({ x: { y: { z: ["S1"] } } }, segredos)], ["S1"]);
    assert.deepEqual([...J.vazamentosNaVisao({ dados: { S2: true } }, segredos)], ["S2"], "segredo como CHAVE");
    // Ciclo não trava a varredura.
    const ciclico = { nome: "raiz" };
    ciclico.eu = ciclico;
    ciclico.lista = [{ v: "S1" }];
    assert.deepEqual([...J.vazamentosNaVisao(ciclico, segredos)], ["S1"]);
  });
});

// ===========================================================================
// §21 — CRITÉRIO DE ACEITE DE SEGURANÇA
// Testes que falhariam se alguém, no futuro, afrouxasse a fronteira.
// ===========================================================================
describe("§21 — a fronteira falha alto se for afrouxada", () => {
  test("acrescentar a mão à visão de espectador quebra o teste", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;
    marcarSegredos(jogo);

    const visaoReal = J.visaoDoEspectador(jogo);
    assert.deepEqual(varrerSegredos(visaoReal, segredosAgora(jogo)), []);

    // A regressão que se quer impedir: alguém acrescenta `mao` ao recorte.
    const visaoAdulterada = Object.assign({}, visaoReal, { mao: jogo.maos[0] });
    assert.notDeepEqual(
      varrerSegredos(visaoAdulterada, segredosAgora(jogo)),
      [],
      "a varredura TEM que acusar `mao` na visão pública"
    );
  });

  test("devolver snapshot de jogador para espectador quebra o teste", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;
    marcarSegredos(jogo);

    const snapshotDeJogador = J.visaoDoAssento(jogo, 0);
    assert.notDeepEqual(
      varrerSegredos(snapshotDeJogador, segredosAgora(jogo)),
      [],
      "a varredura TEM que acusar o snapshot de assento"
    );
  });

  test("reutilizar o objeto do assento com um campo privado novo quebra o teste", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;
    marcarSegredos(jogo);

    const reaproveitado = Object.assign({}, J.visaoDoAssento(jogo, 1), { espectador: true });
    delete reaproveitado.suaMao; // a "limpeza" ingênua de sempre
    // Mesmo assim `precisaUsarTopo` e afins continuam ali — e a varredura pega.
    assert.equal(
      Object.prototype.hasOwnProperty.call(reaproveitado, "precisaUsarTopo"),
      true,
      "remover campo conhecido não é proteção — é justamente o que a OS proíbe"
    );
  });

  test("a visão de espectador não compartilha objeto mutável com o jogo", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;

    const visao = J.visaoDoEspectador(jogo);
    assert.notEqual(visao.jogosNos, jogo.jogosDupla.nos, "não pode ser a MESMA lista");

    // Mexer na visão não pode mexer no jogo (e vice-versa).
    visao.qtdCartasPorAssento[0] = 999;
    assert.notEqual(jogo.maos[0].length, 999);
    jogo.placar.nos += 50;
    assert.notEqual(visao.placarNos, jogo.placar.nos, "o placar da visão é cópia");
  });
});
