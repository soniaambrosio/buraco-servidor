// test/assento_autoritativo.test.js — A ESCOLHA AUTORITATIVA DE ASSENTO.
//
// Quatro eixos, na ordem em que a decisão se forma:
//   ESCOLHA   as quatro respostas de `entrarMesa` a um pedido de assento;
//   DISPUTA   dois clientes no mesmo lugar, e quem fica com ele;
//   POSSE     depois da ocupação a autoridade é do servidor, e só dele;
//   ESTRUTURA onde a decisão mora, e onde ela NÃO mora.
//
// O INVARIANTE QUE ATRAVESSA OS QUATRO. `assento` é PREFERÊNCIA antes da
// ocupação e mais nada depois dela. Antes: o servidor tenta atender o pedido, e
// quando não pode, RECUSA — nunca senta a pessoa em outro lugar sem dizer.
// Depois: nenhum campo de mensagem move, troca ou toma um assento ocupado.
//
// O DEFEITO QUE ESTA SUÍTE FECHA, escrito por extenso porque ele não parecia um
// defeito: `entrarMesa` aceitava `assento` e, quando o pedido não podia ser
// atendido, caía no laço de escolha automática. A pessoa entrava — em OUTRA
// cadeira — e a resposta não carregava nenhum sinal de que o pedido tinha sido
// descartado. Um seletor de cadeira construído sobre isso mostra a cadeira
// errada e não tem como descobrir. Quatro casos desta suíte existem para que
// restaurar aquele laço volte a ficar vermelho.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { cliente, novoServidor } = require("./ajuda.js");

const bundle = require("../server.js");
const {
  criarGerenciador,
  impressaoDoEstado,
  reservaDe,
  assentoLivre,
  ehAssentoPedido,
  RECUSA_ASSENTO_INVALIDO,
  RECUSA_ASSENTO_OCUPADO,
  ERRO_ASSENTO_INVALIDO,
  ERRO_ASSENTO_OCUPADO,
  ADMISSAO_NOVA,
  ADMISSAO_RECONEXAO,
} = bundle.require("salas");

const FONTE = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

/** Recorte de um módulo do bundle, sem comentários — as provas estruturais
 *  daqui afirmam AUSÊNCIAS, e este arquivo documenta as decisões dele em prosa
 *  longa. Sem separar as duas coisas, o comentário que EXPLICA por que o
 *  despachante não decide assento derrubaria a prova de que ele não decide. */
function moduloSemComentarios(nome, seguinte) {
  const i = FONTE.indexOf('__fabricas["' + nome + '"]');
  const j = FONTE.indexOf('__fabricas["' + seguinte + '"]');
  assert.ok(i >= 0 && j > i, "não achei o módulo " + nome + " no bundle");
  const limpo = FONTE.slice(i, j)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  // Trava contra o próprio recorte: limpeza que comesse o código faria toda
  // asserção de ausência passar por vacuidade.
  for (const marcador of ["function ", "return "]) {
    assert.ok(limpo.includes(marcador), "a limpeza comeu o código: " + marcador);
  }
  return limpo;
}
const MOD_SALAS = moduloSemComentarios("salas", "auth_firebase");
const MOD_SERVIDOR = moduloSemComentarios("servidor", "ws_server");

/** Gerenciador casual (regime SÍNCRONO), com código determinístico. */
function gerCasual() {
  let n = 0;
  return criarGerenciador({ gerarCodigo: () => "MESA-" + ++n });
}

/** Mesa casual com o dono já no assento 0. */
function mesaCasual() {
  const g = gerCasual();
  const { codigo } = g.criarMesa({ apelido: "Dono", jogadorId: "uid-0", uidAutenticado: "uid-0" });
  return { g, codigo, sala: g.salas[codigo] };
}

/** Gerenciador VIP com o adaptador SUSPENSO: cada admissão fica pendurada até
 *  o teste resolvê-la à mão.
 *
 *  É o único jeito honesto de medir concorrência neste servidor. O regime
 *  casual é síncrono de ponta a ponta — `entrarMesa` roda inteiro sem ponto de
 *  suspensão —, então nele duas entradas NUNCA se cruzam, e um teste de disputa
 *  escrito sobre ele passaria sem exercitar nada. A janela real existe no
 *  regime VIP, onde o assento fica decidido e ainda não escrito enquanto um
 *  backend não responde. */
function gerVipSuspenso() {
  const pendentes = [];
  const g = criarGerenciador({
    gerarCodigo: () => "MESA-VIP",
    categoriaCompetitiva: "vip_ranqueada",
    autorizarEntradaVip: (ctx) =>
      new Promise((resolve, reject) => pendentes.push({ ctx, resolve, reject })),
  });
  return { g, pendentes };
}

/** Mesa VIP com o dono sentado — a criação também passa pelo adaptador. */
async function mesaVip() {
  const { g, pendentes } = gerVipSuspenso();
  const criacao = g.criarMesa({ apelido: "Dono", jogadorId: "uid-0", uidAutenticado: "uid-0" });
  assert.equal(pendentes.length, 1, "criar mesa VIP também consulta o adaptador");
  pendentes[0].resolve({ ok: true, admissaoId: "adm-dono" });
  const { codigo } = await criacao;
  pendentes.length = 0;
  return { g, pendentes, codigo, sala: g.salas[codigo] };
}

/** Deixa as promessas já resolvidas rodarem. Duas voltas porque a cadeia da
 *  admissão tem `then` sobre `then` — uma volta só devolveria o controle no
 *  meio dela, e a asserção mediria um estado intermediário. */
const assentar = () => new Promise((r) => setImmediate(() => setImmediate(r)));

// ===========================================================================
describe("ASSENTO/ESCOLHA — as quatro respostas, e só quatro", () => {
  test("ASSENTO-01: sem pedido, a escolha automática é [2, 1, 3]", () => {
    // A ordem é PARCEIRO-PRIMEIRO e continua intacta: o 2º humano senta no 2,
    // que é o parceiro do criador. A expectativa é digitada aqui de propósito —
    // ler a constante do bundle não detectaria mudança nela, só a repetiria.
    const { g, codigo } = mesaCasual();
    const vistos = [];
    for (let i = 1; i < 4; i++) {
      vistos.push(g.entrarMesa({ codigo, apelido: "J" + i, jogadorId: "uid-" + i, uidAutenticado: "uid-" + i }).assento);
    }
    assert.deepEqual(vistos, [2, 1, 3]);
  });

  test("ASSENTO-02: pedido válido e livre é atendido EXATAMENTE", () => {
    // E a prova é por assento, não por amostra: os três lugares livres da mesa
    // são pedidos um a um, em mesas separadas, e cada um tem de sair igual ao
    // que entrou. Medir só um deles deixaria passar um servidor que honra o
    // pedido quando ele coincide com a escolha automática.
    for (const pedido of [1, 2, 3]) {
      const { g, codigo } = mesaCasual();
      const r = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: pedido });
      assert.equal(r.assento, pedido, "pediu " + pedido);
      assert.equal(g.salas[codigo].assentos[pedido].jogadorId, "uid-1");
    }
  });

  test("ASSENTO-03: pedido OCUPADO é recusa tipada, e não outra cadeira", () => {
    // O caso que nomeia a OS. O assento 0 é do dono; antes desta entrega, quem
    // o pedisse sentava no 2 sem receber aviso nenhum.
    const { g, codigo, sala } = mesaCasual();
    const r = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-9", uidAutenticado: "uid-9", assento: 0 });

    assert.equal(r.codigoRecusa, RECUSA_ASSENTO_OCUPADO);
    assert.equal(r.erro, ERRO_ASSENTO_OCUPADO);
    assert.equal(r.assento, undefined, "recusa não carrega assento nenhum");
    // E o que NÃO aconteceu: ninguém sentou em lugar nenhum.
    assert.equal(sala.assentos.filter(Boolean).length, 1, "a recusa sentou alguém");
    assert.equal(sala.assentos[0].jogadorId, "uid-0", "o dono foi trocado");
  });

  test("ASSENTO-04: pedido INVÁLIDO é recusa tipada — nove formas", () => {
    // Recusar em vez de coagir. `"2"` não vira 2: adivinhar a intenção de um
    // cliente que já errou o contrato é como se volta ao fallback por outra
    // porta. `4` e `-1` estão fora da mesa; `1.5` e `NaN` não são assento.
    for (const ruim of [4, -1, 1.5, "2", true, {}, [], NaN, Infinity]) {
      const { g, codigo, sala } = mesaCasual();
      const r = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-9", uidAutenticado: "uid-9", assento: ruim });
      assert.equal(r.codigoRecusa, RECUSA_ASSENTO_INVALIDO, "pedido " + String(ruim));
      assert.equal(r.erro, ERRO_ASSENTO_INVALIDO);
      assert.equal(sala.assentos.filter(Boolean).length, 1, "pedido inválido sentou alguém: " + String(ruim));
    }
  });

  test("ASSENTO-05: `null` explícito é pedido malformado, não ausência", () => {
    // A porta mais fácil de reabrir o fallback: um cliente que serializa
    // "nenhuma escolha" como `null` e um servidor que a trata como omissão.
    // Ausência é o campo NÃO VIR — e aí `assento` chega `undefined`.
    const { g, codigo } = mesaCasual();
    const r = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-9", uidAutenticado: "uid-9", assento: null });
    assert.equal(r.codigoRecusa, RECUSA_ASSENTO_INVALIDO);

    // E a metade que dá sentido à outra: omitir o campo continua sentando.
    const r2 = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-9", uidAutenticado: "uid-9" });
    assert.equal(r2.assento, 2);
  });

  test("ASSENTO-06: a recusa acontece ANTES do gate — não gasta admissão", () => {
    // Mesma disciplina de `criarMesa`: pedido recusado não deixa rastro. Uma
    // tentativa que chega ao adaptador é uma tentativa que um backend de
    // direitos pode contabilizar, e pedir uma cadeira ocupada não pode custar
    // nada a ninguém.
    let chamadas = 0;
    const g = criarGerenciador({
      gerarCodigo: () => "MESA-1",
      autorizarEntradaVip: () => { chamadas++; return { ok: true }; },
    });
    const { codigo } = g.criarMesa({ apelido: "Dono", jogadorId: "uid-0", uidAutenticado: "uid-0" });
    g.entrarMesa({ codigo, jogadorId: "uid-9", uidAutenticado: "uid-9", assento: 0 });
    g.entrarMesa({ codigo, jogadorId: "uid-9", uidAutenticado: "uid-9", assento: 77 });
    assert.equal(chamadas, 0, "a recusa de assento consultou o adaptador");
  });

  test("ASSENTO-07: mesa cheia — sem pedido e com pedido dizem coisas diferentes", () => {
    const { g, codigo } = mesaCasual();
    for (let i = 1; i < 4; i++) g.entrarMesa({ codigo, jogadorId: "uid-" + i, uidAutenticado: "uid-" + i });

    // Sem pedido: não há lugar nenhum, e a mensagem é a da mesa.
    assert.equal(g.entrarMesa({ codigo, jogadorId: "uid-x", uidAutenticado: "uid-x" }).erro, "mesa cheia");
    // Com pedido: a resposta é sobre AQUELE lugar, e é tipada.
    const r = g.entrarMesa({ codigo, jogadorId: "uid-x", uidAutenticado: "uid-x", assento: 3 });
    assert.equal(r.codigoRecusa, RECUSA_ASSENTO_OCUPADO);
  });

  test("ASSENTO-08: no fio, o ACK devolve o assento CONFIRMADO", async () => {
    // §2. Confirmado == solicitado, sempre que houve pedido explícito — e a
    // volta é pelo transporte de produção, não pela primitiva.
    for (const pedido of [1, 2, 3]) {
      const srv = novoServidor();
      const dono = await cliente(srv, "uid-0");
      dono.envia({ tipo: "criarMesa", apelido: "Dono" });
      const codigo = dono.ultimo("entrou").codigo;

      const c = await cliente(srv, "uid-1");
      c.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: pedido });

      const ack = c.ultimo("entrou");
      assert.ok(ack, "não houve ACK para o pedido " + pedido);
      assert.equal(ack.assento, pedido, "ACK confirmou assento diferente do pedido");
      assert.equal(ack.reconexao, false, "entrada nova não é reconexão");
      assert.equal(srv.conexoes[c.id].assento, pedido);
    }
  });

  test("ASSENTO-09: no fio, a recusa é tipada e não vira entrada", async () => {
    const srv = novoServidor();
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;

    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 0 });
    assert.equal(c.ultimo("entrou"), null, "recusado recebeu ACK de entrada");
    assert.equal(c.ultimo("erro").codigo, RECUSA_ASSENTO_OCUPADO);

    c.limpar();
    c.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: "2" });
    assert.equal(c.ultimo("entrou"), null);
    assert.equal(c.ultimo("erro").codigo, RECUSA_ASSENTO_INVALIDO);
    assert.equal(srv.conexoes[c.id].assento, null, "recusado ficou com assento");
    // E o recusado não recebe estado: quem não entrou não é jogador da mesa.
    assert.equal(c.todas("estado").length, 0);
  });
});

// ===========================================================================
describe("ASSENTO/DISPUTA — dois no mesmo lugar", () => {
  test("DISP-01: dois pedidos pelo mesmo assento — um entra, o outro é recusado", async () => {
    const { g, pendentes, codigo, sala } = await mesaVip();

    // A entra pedindo o 2 e fica pendurada no backend.
    const voo = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    assert.equal(pendentes.length, 1, "a primeira tentativa foi ao adaptador");
    assert.equal(sala.assentos[2], null, "o assento ainda NÃO foi escrito — é essa a janela");

    // B pede o MESMO 2 enquanto A espera. A recusa é imediata e síncrona: a
    // reserva de A já está gravada, então nem chega a haver segunda consulta.
    const rB = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2", uidAutenticado: "uid-2", assento: 2 });
    assert.equal(rB.codigoRecusa, RECUSA_ASSENTO_OCUPADO, "o segundo não foi recusado");
    assert.equal(pendentes.length, 1, "a tentativa perdedora consultou o adaptador");

    pendentes[0].resolve({ ok: true, admissaoId: "adm-A" });
    const rA = await voo;
    assert.equal(rA.assento, 2, "o vencedor não ficou com o assento que pediu");
    assert.equal(sala.assentos[2].jogadorId, "uid-1");
    assert.equal(sala.assentos[2].admissaoId, "adm-A");
    assert.equal(reservaDe(sala, 2), null, "a reserva sobreviveu à entrada");
  });

  test("DISP-02: o perdedor não desloca ninguém, nem chegando depois", async () => {
    // A metade que a DISP-01 não mede: o que acontece se a tentativa perdedora
    // chegar ao ponto de escrita MESMO ASSIM. Aqui as duas vão ao adaptador
    // (pedidos distintos), e a segunda é resolvida DEPOIS — com o assento dela
    // já tomado por quem venceu.
    const { g, pendentes, codigo, sala } = await mesaVip();

    const vooA = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    const vooB = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2", uidAutenticado: "uid-2", assento: 1 });
    assert.equal(pendentes.length, 2);

    // O backend aprova B para o assento 1; à mão, forçamos a colisão que a
    // reserva existe para pegar: o assento 2 fica com A antes de B voltar.
    pendentes[0].resolve({ ok: true, admissaoId: "adm-A" });
    await vooA;
    pendentes[1].resolve({ ok: true, admissaoId: "adm-B" });
    const rB = await vooB;

    assert.equal(rB.assento, 1);
    assert.equal(sala.assentos[2].jogadorId, "uid-1", "o vencedor foi deslocado");
    assert.equal(sala.assentos[2].admissaoId, "adm-A", "a prova de admissão foi trocada");
    assert.equal(sala.assentos[1].jogadorId, "uid-2");
  });

  test("DISP-03: a ESCOLHA AUTOMÁTICA também respeita reserva em voo", async () => {
    // O caso que quase escapa. Sem pedido explícito, duas entradas concorrentes
    // percorriam a mesma ORDEM, liam o mesmo assento 2 como livre, e a segunda
    // a voltar do backend gravava por cima da primeira — nenhuma das duas tinha
    // pedido nada, e mesmo assim uma perdia o lugar sem receber recusa.
    const { g, pendentes, codigo, sala } = await mesaVip();

    const vooA = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    const vooB = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2", uidAutenticado: "uid-2" });

    assert.equal(pendentes[0].ctx.assento, 2, "o primeiro pega o parceiro do criador");
    assert.equal(pendentes[1].ctx.assento, 1, "o segundo NÃO pode pegar o mesmo lugar");

    pendentes[1].resolve({ ok: true, admissaoId: "adm-B" });
    pendentes[0].resolve({ ok: true, admissaoId: "adm-A" });
    assert.equal((await vooA).assento, 2);
    assert.equal((await vooB).assento, 1);
    assert.equal(sala.assentos[2].jogadorId, "uid-1");
    assert.equal(sala.assentos[1].jogadorId, "uid-2");
  });

  test("DISP-04: admissão RECUSADA solta a reserva", async () => {
    // Reserva que não morre com a tentativa é um assento que ninguém mais
    // consegue ocupar, num lugar que parece vazio para quem olha a mesa.
    const { g, pendentes, codigo, sala } = await mesaVip();

    const voo = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    assert.equal(assentoLivre(sala, 2), false, "durante o voo o lugar está tomado");
    pendentes[0].resolve({ ok: false });
    await voo;

    assert.equal(reservaDe(sala, 2), null, "a reserva ficou presa depois da recusa");
    assert.equal(assentoLivre(sala, 2), true);
    // E o lugar volta a ser ocupável de verdade.
    const voo2 = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2", uidAutenticado: "uid-2", assento: 2 });
    pendentes[1].resolve({ ok: true });
    assert.equal((await voo2).assento, 2);
  });

  test("DISP-05: adaptador que ESTOURA vira recusa — e a reserva sai junto", async () => {
    // Duas coisas de uma vez, e a primeira é anterior a esta OS: transporte
    // caído, timeout ou backend fora do ar viram RECUSA, nunca aprovação nem
    // rejeição vazando para quem chamou. É por isso que \`entrarMesa\` não tem
    // tratador de rejeição — não existe rejeição para tratar.
    const { g, pendentes, codigo, sala } = await mesaVip();
    const voo = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 3 });
    pendentes[0].reject(Object.assign(new Error("rede"), { codigo: "EREDE" }));
    const r = await voo;

    assert.ok(r.erro, "falha do adaptador virou entrada");
    assert.equal(r.assento, undefined);
    assert.equal(reservaDe(sala, 3), null, "reserva presa depois de falha do adaptador");
    assert.equal(sala.assentos[3], null);

    // E o lugar volta a ser ocupável — a falha não o aposentou.
    const voo2 = g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2", uidAutenticado: "uid-2", assento: 3 });
    pendentes[1].resolve({ ok: true });
    assert.equal((await voo2).assento, 3);
  });

  test("DISP-06: partida que começa durante o voo não é atropelada", async () => {
    // A conferência final. Enquanto a admissão espera, a mesa pode ter
    // iniciado — e ao iniciar ela enche os lugares vazios de bot. Escrever
    // assim mesmo trocaria um ocupante da partida em curso por quem chegou
    // atrasado, que é a forma mais silenciosa possível de deslocar alguém.
    const { g, pendentes, codigo, sala } = await mesaVip();

    const voo = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    g.iniciarPartida({ codigo, assento: 0 });
    assert.equal(sala.assentos[2].tipo, "bot", "iniciar encheu o lugar de bot");

    pendentes[0].resolve({ ok: true, admissaoId: "adm-tarde" });
    const r = await voo;

    assert.equal(r.codigoRecusa, RECUSA_ASSENTO_OCUPADO, "a entrada atrasada foi aceita");
    assert.equal(sala.assentos[2].tipo, "bot", "o bot da partida foi substituído");
    assert.equal(sala.assentos[2].jogadorId, null);
  });

  test("DISP-07: reserva em voo NÃO move a versão do estado", async () => {
    // §5 do versionamento: nada que não seja mutação da partida pode fingir ser
    // versão nova. A reserva é invisível em toda visão — se ela versionasse, o
    // cliente receberia um número novo com uma visão idêntica.
    const { g, pendentes, codigo, sala } = await mesaVip();
    const antes = impressaoDoEstado(sala);

    g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    assert.equal(impressaoDoEstado(sala), antes, "a reserva mexeu na impressão do estado");

    // E a ocupação que ela protege versiona normalmente — a exclusão não
    // desligou o versionamento do assento, que é o que importa de verdade.
    pendentes[0].resolve({ ok: true });
    await assentar();
    assert.notEqual(impressaoDoEstado(sala), antes, "sentar deixou de versionar");
  });

  test("DISP-09: a liberação é por MARCA, não por posição", async () => {
    // ESTADO FORJADO, e o motivo importa. Hoje nenhum caminho de produção põe
    // outra marca neste assento enquanto a primeira tentativa espera: a segunda
    // é recusada ANTES de reservar. Só que essa impossibilidade vem da ordem em
    // que as microtarefas rodam, não de uma regra — basta um `await` a mais na
    // cadeia da admissão para a janela nascer. A guarda por marca é o que torna
    // a liberação correta por construção em vez de correta por agendamento, e é
    // isso que este caso afirma.
    const { g, pendentes, codigo, sala } = await mesaVip();
    const voo = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    const minha = reservaDe(sala, 2);
    assert.ok(minha, "sem reserva em voo o caso ficaria vácuo");

    sala.reservas[2] = "res_de_outra_tentativa";
    pendentes[0].resolve({ ok: false });
    await voo;

    assert.equal(reservaDe(sala, 2), "res_de_outra_tentativa",
      "a tentativa que terminou soltou a reserva de outra pessoa");
  });

  test("DISP-10: partida iniciada com assento vazio (forjada) continua fechada", async () => {
    // ESTADO FORJADO pela mesma razão: `iniciarPartida` enche os lugares vazios
    // de bot, então "iniciada com vaga" não é alcançável por caminho de
    // produção. Sem esta prova a guarda de `sala.iniciada` viveria de carona na
    // guarda de assento ocupado — e no dia em que uma mesa começar sem encher
    // todos os lugares, uma admissão atrasada sentaria alguém no meio da
    // partida sem que nada recusasse.
    const { g, pendentes, codigo, sala } = await mesaVip();
    const voo = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    sala.iniciada = true;

    pendentes[0].resolve({ ok: true, admissaoId: "adm-tarde" });
    const r = await voo;

    assert.equal(r.codigoRecusa, RECUSA_ASSENTO_OCUPADO, "a entrada atrasada foi aceita");
    assert.equal(sala.assentos[2], null, "sentou alguém numa partida em curso");
  });

  test("DISP-08: reserva não vaza em visão nenhuma", async () => {
    const { g, pendentes, codigo, sala } = await mesaVip();
    g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    const marca = reservaDe(sala, 2);
    assert.ok(marca, "não há reserva para medir — o caso ficaria vácuo");

    for (const papel of ["jogador", "espectador"]) {
      const visao = g.visaoPara({ codigo, papel, assento: papel === "jogador" ? 0 : null });
      const texto = JSON.stringify(visao || null);
      assert.ok(!texto.includes(marca), "a marca de reserva saiu na visão de " + papel);
      assert.ok(!texto.includes("reservas"), "o campo `reservas` saiu na visão de " + papel);
    }
    pendentes[0].resolve({ ok: false });
  });
});

// ===========================================================================
describe("ASSENTO/POSSE — depois de sentar, quem manda é o servidor", () => {
  test("POSSE-01: em partida iniciada, a volta deriva da POSSE, não do pedido", async () => {
    // O titular do assento 1 volta pedindo o 3. Ele recebe o 1, porque é o
    // dele — e nem o pedido nem o apelido participam dessa decisão.
    const srv = novoServidor();
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    const j1 = await cliente(srv, "uid-1");
    j1.envia({ tipo: "entrarMesa", codigo, apelido: "J1", assento: 1 });
    assert.equal(j1.ultimo("entrou").assento, 1);
    dono.envia({ tipo: "iniciarPartida" });

    srv.desconectar(j1.id);
    const volta = await cliente(srv, "uid-1");
    volta.envia({ tipo: "entrarMesa", codigo, apelido: "J1", assento: 3 });

    const ack = volta.ultimo("entrou");
    assert.ok(ack, "o titular não conseguiu voltar");
    assert.equal(ack.assento, 1, "o pedido moveu o titular de assento");
    assert.equal(ack.reconexao, true, "a volta não foi marcada como reconexão");
  });

  test("POSSE-02: em partida iniciada, o pedido não toma o assento de outro", async () => {
    const srv = novoServidor();
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    const j1 = await cliente(srv, "uid-1");
    j1.envia({ tipo: "entrarMesa", codigo, apelido: "J1", assento: 2 });
    dono.envia({ tipo: "iniciarPartida" });

    const intruso = await cliente(srv, "uid-99");
    intruso.envia({ tipo: "entrarMesa", codigo, apelido: "Eu", assento: 2 });

    assert.equal(intruso.ultimo("entrou"), null, "um terceiro sentou na partida em curso");
    assert.ok(intruso.ultimo("erro"));
    assert.equal(srv.conexoes[intruso.id].assento, null);
    assert.equal(srv.conexoes[j1.id].assento, 2, "o titular perdeu o assento para o pedido");
    assert.equal(srv.ger.salas[codigo].assentos[2].jogadorId, "uid-1");
  });

  test("POSSE-03: no lobby, quem já está sentado não troca de cadeira", () => {
    // "Sair e tentar outra cadeira" não existe neste servidor, e reentrar
    // pedindo outro lugar é essa operação com outro nome.
    const { g, codigo, sala } = mesaCasual();
    g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 1 });

    const r = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 3 });
    assert.equal(r.assento, 1, "a reentrada trocou o assento");
    assert.equal(r.reconexao, true);
    assert.equal(sala.assentos[3], null, "a reentrada ocupou um segundo lugar");
    assert.equal(sala.assentos.filter(Boolean).length, 2, "a mesa ganhou um ocupante fantasma");
  });

  test("POSSE-04: no lobby, reentrada sem pedido também devolve o mesmo lugar", () => {
    // Antes desta entrega, reentrar sem pedido dava um assento NOVO ao mesmo
    // uid: a mesma pessoa ocupava dois lugares e nada recusava.
    const { g, codigo, sala } = mesaCasual();
    const r = g.entrarMesa({ codigo, apelido: "Dono", jogadorId: "uid-0", uidAutenticado: "uid-0" });
    assert.equal(r.assento, 0);
    assert.equal(r.reconexao, true);
    assert.equal(sala.assentos.filter(Boolean).length, 1);
  });

  test("POSSE-05: a reentrada chega ao gate CLASSIFICADA, mesmo pedindo outro lugar", () => {
    // Curto-circuitar a reentrada pouparia uma chamada e apagaria o dado que a
    // chamada existe para carregar: um backend de direitos precisa ver a volta
    // marcada como reconexão para não cobrar um segundo passe.
    const vistos = [];
    const g = criarGerenciador({
      gerarCodigo: () => "MESA-1",
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: (ctx) => { vistos.push(ctx); return { ok: true }; },
    });
    const { codigo } = g.criarMesa({ apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    assert.equal(vistos[0].classificacao, ADMISSAO_NOVA);

    g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 3 });
    assert.equal(vistos.length, 2, "a reentrada não chegou ao adaptador");
    assert.equal(vistos[1].classificacao, ADMISSAO_RECONEXAO);
    assert.equal(vistos[1].assento, 0, "o adaptador viu o assento PEDIDO, não o possuído");
  });

  test("POSSE-06: reentrada recusada pelo gate não devolve o assento por fora", () => {
    // A reentrada continua sendo uma admissão: se o backend recusa, ela recusa.
    // O que ela nunca faz é ocupar de novo — o lugar já era dele e continua.
    const g = criarGerenciador({
      gerarCodigo: () => "MESA-1",
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: ({ classificacao }) => ({ ok: classificacao === ADMISSAO_NOVA }),
    });
    const { codigo } = g.criarMesa({ apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    const r = g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    assert.ok(r.erro, "a reentrada passou por cima da recusa do gate");
    assert.equal(g.salas[codigo].assentos[0].jogadorId, "uid-1", "o assento foi perdido na recusa");
    assert.equal(g.salas[codigo].assentos.filter(Boolean).length, 1);
  });
});

// ===========================================================================
describe("ASSENTO/ESTRUTURA — onde a decisão mora", () => {
  test("EST-01: o despachante NÃO decide assento — só entrega o pedido", () => {
    // Validar a faixa, escolher a ordem ou consultar a posse no despachante
    // criaria uma segunda autoridade sobre assento, e as duas divergiriam no
    // primeiro ajuste. `msg.assento` aparece uma vez, e é a entrega.
    const usos = MOD_SERVIDOR.match(/msg\.assento/g) || [];
    assert.equal(usos.length, 1, "o despachante lê `msg.assento` mais de uma vez");
    assert.match(MOD_SERVIDOR, /ger\.entrarMesa\(\{[^}]*assento: msg\.assento[^}]*\}\)/,
      "o único uso não é a entrega a `entrarMesa`");
    // E o vocabulário da decisão não existe lá: nem a ordem, nem as recusas.
    assert.ok(!MOD_SERVIDOR.includes("ASSENTO_OCUPADO"), "o despachante cunha recusa de assento");
    assert.ok(!MOD_SERVIDOR.includes("ASSENTO_INVALIDO"), "o despachante cunha recusa de assento");
  });

  test("EST-02: toda escrita em RESERVA está enumerada — e cada uma tem dono", () => {
    // Companheira estrutural do GATE-09, e pela mesma razão: a reserva é um
    // caminho de TOMAR assento, e um caminho novo tem de derrubar a suíte em
    // vez de aparecer sozinho. Uma escrita a mais aqui é uma segunda autoridade
    // sobre ocupação, que é exatamente o que o gate obrigatório impede.
    const escritas = (MOD_SALAS.match(/sala\.reservas(?:\[[^\]]*\])?\s*=(?!=)[^;\r\n]*/g) || [])
      .map((e) => e.trim().replace(/\s+/g, " "));
    assert.deepEqual(escritas.sort(), [
      "sala.reservas = [null, null, null, null]", // garantirReservas: nasce vazio
      "sala.reservas[i] = marca",                 // reservarAssento: TOMA
      "sala.reservas[i] = null",                  // liberarReserva: SOLTA
    ].sort(), "escrita nova em reserva — ela passa por reservarAssento?");

    // As duas funções que escrevem são declaradas uma vez cada, e a que TOMA é
    // chamada de um lugar só: `entrarMesa`, logo antes do gate.
    for (const fn of ["reservarAssento", "liberarReserva", "garantirReservas"]) {
      const decl = (MOD_SALAS.match(new RegExp("function " + fn + "\\(", "g")) || []).length;
      assert.equal(decl, 1, fn + " é declarada mais de uma vez");
    }
    const tomadas = (MOD_SALAS.match(/reservarAssento\(/g) || []).length - 1;
    assert.equal(tomadas, 1, "a reserva é tomada em mais de um lugar");

    const iEntrar = MOD_SALAS.indexOf("function entrarMesa(");
    const iDesfazer = MOD_SALAS.indexOf("function desfazerAdmissao(");
    assert.ok(iEntrar >= 0 && iDesfazer > iEntrar);
    const emEntrar = MOD_SALAS.slice(iEntrar, iDesfazer);
    assert.ok(emEntrar.indexOf("reservarAssento(") < emEntrar.indexOf("admitirNoAssento({"),
      "a reserva tem de ser tomada ANTES do gate — depois dele a janela já passou");
  });

  test("EST-03: `reservas` só guarda null ou marca cunhada aqui", () => {
    // A exclusão da impressão de estado só é segura enquanto isto valer: o dia
    // em que alguém guardar estado de verdade aqui, ele deixa de versionar.
    const { g, codigo, sala } = mesaCasual();
    assert.deepEqual(sala.reservas, [null, null, null, null], "a mesa nasce sem reserva");
    g.entrarMesa({ codigo, jogadorId: "uid-1", uidAutenticado: "uid-1", assento: 2 });
    // Regime casual é síncrono: a reserva nasce e morre dentro da chamada.
    assert.deepEqual(sala.reservas, [null, null, null, null], "reserva sobreviveu ao caminho síncrono");
  });

  test("EST-04: `ehAssentoPedido` é a única leitura do que é um pedido válido", () => {
    // A faixa 0..3 escrita à mão em dois lugares diverge no primeiro ajuste.
    assert.deepEqual([0, 1, 2, 3].map(ehAssentoPedido), [true, true, true, true]);
    assert.deepEqual([4, -1, 1.5, "0", null, undefined, true].map(ehAssentoPedido),
      [false, false, false, false, false, false, false]);
    const faixas = (MOD_SALAS.match(/assento\s*>=\s*0\s*&&\s*assento\s*<\s*4/g) || []).length;
    assert.equal(faixas, 0, "a faixa do assento voltou a ser escrita à mão fora de `ehAssentoPedido`");
  });
});
