// test/gate_vip.test.js — O GATE AUTORITATIVO DE ENTRADA VIP/RANQUEADA.
//
// Cinco eixos, na ordem em que a decisão se forma:
//   CAT    a classificação competitiva da mesa: de onde nasce e o que a protege;
//   GATE   o ponto único de admissão ao assento e o seu fail-closed;
//   TENT   a identidade opaca da tentativa de entrada;
//   PAPEL  quem passa pelo gate e quem nunca passa (espectador, bot, reconexão);
//   MESA   o comportamento fim a fim, no fio, e o que NÃO acontece após a recusa.
//
// Nada aqui toca rede, disco, Firestore ou billing. Nenhuma ficha, passe ou
// direito é concedido ou consumido em nenhum caso — não existe código para
// isso neste servidor, e três testes deste arquivo existem para afirmar
// exatamente essa ausência.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { cliente, novoServidor } = require("./ajuda.js");

const bundle = require("../server.js");
const {
  criarGerenciador,
  avaliarAdmissaoAoAssento,
  normalizarCategoria,
  novaTentativaEntradaId,
  ehTentativaEntradaId,
  assentoDoTitular,
  montarEnvelopeEncerramento,
  CATEGORIAS_COMPETITIVAS,
  CATEGORIA_PADRAO,
  CATEGORIA_DESCONHECIDA,
  PREFIXO_TENTATIVA,
  ERRO_ADMISSAO,
  RECUSA_VIP_INDISPONIVEL,
  RECUSA_CATEGORIA_DESCONHECIDA,
  ADMISSAO_NOVA,
  ADMISSAO_RECONEXAO,
  TIPOS_DE_PARTIDA,
  VERSAO_CONTRATO_ENCERRAMENTO,
} = bundle.require("salas");

const FONTE = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------

/** O CÓDIGO de um trecho do bundle, sem os comentários.
 *
 *  Existe porque as provas estruturais deste arquivo afirmam ausências — "não
 *  existe booleano concorrente", "o despachante não lê categoria de `msg`" — e
 *  este bundle documenta as suas decisões em prosa longa. Sem separar as duas
 *  coisas, um comentário que EXPLICA por que `isVip` não existe derrubaria o
 *  teste que prova que `isVip` não existe, e a saída seria apagar o comentário:
 *  perder a explicação para salvar a prova, exatamente ao contrário.
 *
 *  Recorta só o que é seguro recortar: blocos `/* ... *\/` e linhas que
 *  COMEÇAM com `//`. Comentário no fim de uma linha de código fica — tirá-lo
 *  exigiria distinguir `//` de dentro de string, e um `://` de URL comido pela
 *  metade apagaria código de verdade. */
function codigoDe(texto) {
  const limpo = texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  // Trava contra o próprio recorte: se a limpeza comesse o arquivo, todas as
  // asserções de ausência passariam por vacuidade. Marcadores de código que
  // TÊM de sobreviver — se um deles sumir, é bug daqui, não do bundle.
  for (const marcador of ["__fabricas[", "function ", "return "]) {
    assert.ok(limpo.includes(marcador), "a limpeza de comentários comeu o código: " + marcador);
  }
  return limpo;
}

/** Recorte textual de um módulo do bundle, para as provas estruturais. */
function modulo(nome, seguinte) {
  const i = FONTE.indexOf('__fabricas["' + nome + '"]');
  const j = FONTE.indexOf('__fabricas["' + seguinte + '"]');
  assert.ok(i >= 0 && j > i, "não achei o módulo " + nome + " no bundle");
  return FONTE.slice(i, j);
}
const CODIGO = codigoDe(FONTE);
const MOD_SALAS = codigoDe(modulo("salas", "auth_firebase"));
const MOD_SERVIDOR = codigoDe(modulo("servidor", "ws_server"));

/** Gerenciador puro, com código determinístico. */
function ger(opts = {}) {
  let n = 0;
  return criarGerenciador(Object.assign({ gerarCodigo: () => "MESA-" + ++n }, opts));
}

/** Pedido de admissão bem-formado. Cada teste estraga UM campo por vez, para
 *  que a falha aponte para o campo e não para o formulário inteiro. */
function pedido(extra = {}) {
  return Object.assign({
    uidAutenticado: "uid-1",
    codigoDaSala: "MESA-1",
    identidadeDaPartida: null,
    assento: 0,
    categoriaCompetitiva: "casual",
    tentativaEntradaId: novaTentativaEntradaId(),
    reconexao: false,
  }, extra);
}

// ADAPTADOR DE TESTE — leia antes de copiar.
//
// Este é o único lugar de todo o repositório onde alguma coisa responde "sim"
// a uma admissão VIP, e ele é um dublê de teste. A construção de PRODUÇÃO
// (`iniciar()`, em ws_server) NÃO injeta adaptador nenhum, e há teste abaixo
// (GATE-02 e MESA-03) afirmando que sem adaptador a entrada VIP é recusada.
// Ele existe porque a porta precisa ser exercitada nos dois sentidos: uma porta
// que só se sabe recusar não é uma porta, é uma parede.
const soOCriador = ({ assento }) => ({ ok: assento === 0 });

// ===========================================================================
describe("GATE-VIP/CAT — a classificação competitiva da mesa", () => {
  test("CAT-01: `vip` não é, e não vira, um tipo de partida", () => {
    // §9.1. `tipoPartida` é TOPOLOGIA. Colapsar as duas dimensões é o erro que
    // esta OS existe para impedir, e ele começaria exatamente aqui.
    assert.deepEqual(TIPOS_DE_PARTIDA, ["publica", "privada", "simulada"]);
    for (const proibido of ["vip", "vip_ranqueada", "ranqueada", "master_vip"]) {
      assert.ok(!TIPOS_DE_PARTIDA.includes(proibido),
        "topologia não pode carregar natureza competitiva: " + proibido);
    }
  });

  test("CAT-02: a enumeração competitiva é fechada e tem exatamente dois valores", () => {
    assert.deepEqual(CATEGORIAS_COMPETITIVAS, ["casual", "vip_ranqueada"]);
    // Sala privada ranqueada e partida simulada VIP não existem: não há terceiro
    // valor, e não há como compor um a partir destes dois.
    assert.equal(CATEGORIAS_COMPETITIVAS.length, 2);
  });

  test("CAT-03: categoria desconhecida NÃO cai em casual", () => {
    // §9.8 e §10.12. Ausente é uma coisa (é a mesa de sempre); declarada e
    // inválida é outra, e a outra não é gratuita.
    assert.equal(normalizarCategoria(undefined), CATEGORIA_PADRAO);
    assert.equal(normalizarCategoria(null), CATEGORIA_PADRAO);
    assert.equal(normalizarCategoria("casual"), "casual");
    assert.equal(normalizarCategoria("vip_ranqueada"), "vip_ranqueada");
    for (const lixo of ["vip", "VIP_RANQUEADA", "premium", "", 0, 1, true, {}, []]) {
      assert.equal(normalizarCategoria(lixo), CATEGORIA_DESCONHECIDA,
        "valor fora da enumeração: " + JSON.stringify(lixo));
    }
    assert.ok(!CATEGORIAS_COMPETITIVAS.includes(CATEGORIA_DESCONHECIDA),
      "`desconhecida` não é uma categoria válida — é a ausência de uma");
  });

  test("CAT-04: a categoria nasce da configuração, e o payload não a move", () => {
    // §10.8 e §10.9: nem elevar casual para VIP, nem rebaixar VIP para casual.
    const g = ger({ categoriaCompetitiva: "casual" });
    const r = g.criarMesa({
      apelido: "A", jogadorId: "uid-1",
      // tudo isto é ruído vindo do cliente e não pode alcançar a mesa
      categoriaCompetitiva: "vip_ranqueada", categoria: "vip_ranqueada",
      vip: true, ranqueada: true, mesaVip: true,
    });
    assert.ok(!r.erro, "mesa casual continua sendo criada");
    assert.equal(g.salas[r.codigo].categoriaCompetitiva, "casual");

    const gv = ger({ categoriaCompetitiva: "vip_ranqueada", autorizarEntradaVip: soOCriador });
    const rv = gv.criarMesa({
      apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1",
      categoriaCompetitiva: "casual", vip: false,
    });
    assert.ok(!rv.erro);
    assert.equal(gv.salas[rv.codigo].categoriaCompetitiva, "vip_ranqueada",
      "payload não rebaixa a mesa");
  });

  test("CAT-05: a categoria é imutável durante toda a vida da sala", () => {
    const g = ger({ categoriaCompetitiva: "casual" });
    const { codigo } = g.criarMesa({ apelido: "A", jogadorId: "uid-1" });
    const sala = g.salas[codigo];
    sala.categoriaCompetitiva = "vip_ranqueada";           // silencioso fora de strict
    assert.equal(sala.categoriaCompetitiva, "casual", "atribuição direta não pega");
    assert.throws(() => {
      Object.defineProperty(sala, "categoriaCompetitiva", { value: "vip_ranqueada" });
    }, "redefinir a propriedade também não");
    // e sobrevive à partida inteira, revanche inclusive
    g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2" });
    g.iniciarPartida({ codigo, assento: 0 });
    assert.equal(sala.categoriaCompetitiva, "casual");
  });

  test("CAT-06: a categoria está no objeto autoritativo da sala e é legível", () => {
    const g = ger({ categoriaCompetitiva: "vip_ranqueada", autorizarEntradaVip: soOCriador });
    const { codigo } = g.criarMesa({ apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    assert.equal(g.salas[codigo].categoriaCompetitiva, "vip_ranqueada");
    assert.equal(g.categoriaDaSala(codigo), "vip_ranqueada");
    assert.equal(g.categoriaDaSala("MESA-INEXISTENTE"), null);
    // `categoriaConfigurada` (das mesas novas) e `categoriaDaSala` (de UMA mesa)
    // são coisas diferentes e não se confundem.
    assert.equal(g.categoriaConfigurada, "vip_ranqueada");
  });

  test("CAT-07: não existe booleano concorrente à enumeração", () => {
    // §9.2. Um booleano ao lado da enumeração é uma segunda autoridade, e as
    // duas divergem no primeiro caminho que esquecer de atualizar uma delas.
    for (const proibido of ["isVip", "ehVip", "mesaVip", "salaVip", "vipMesa", "isRanqueada", "ehRanqueada"]) {
      assert.ok(!new RegExp("\\b" + proibido + "\\b").test(CODIGO),
        "booleano concorrente no bundle: " + proibido);
    }
    // e nenhuma propriedade `.vip` / `vip:` em lugar nenhum
    assert.ok(!/\.vip\b/.test(CODIGO), "nenhum campo `.vip`");
    assert.ok(!/["']?\bvip["']?\s*:/.test(MOD_SALAS.replace(/vip_ranqueada/g, "")),
      "nenhuma chave `vip:` no módulo de salas");
  });

  test("CAT-08: a categoria não chega por mensagem do socket", () => {
    // §9.3, prova ESTRUTURAL: o despachante não lê categoria de `msg`, e não
    // monta categoria nenhuma para passar adiante.
    assert.ok(!/msg\.categoria/i.test(MOD_SERVIDOR), "despachante não lê msg.categoria*");
    assert.ok(!/categoriaCompetitiva\s*:/.test(MOD_SERVIDOR),
      "despachante não constrói categoria para o gerenciador");
    // e no módulo de salas ela só sai de `opts` (construção) ou da sala.
    assert.ok(/normalizarCategoria\(opts\.categoriaCompetitiva\)/.test(MOD_SALAS),
      "a categoria configurada vem de opts, na construção do gerenciador");
    assert.ok(!/msg\./.test(MOD_SALAS), "o módulo de salas não conhece `msg`");
  });
});

// ===========================================================================
describe("GATE-VIP/GATE — o ponto único de admissão ao assento", () => {
  test("GATE-01: mesa casual admite, e a tentativa é classificada", () => {
    const d = avaliarAdmissaoAoAssento(pedido({ categoriaCompetitiva: "casual" }));
    assert.equal(d.ok, true);
    assert.equal(d.classificacao, ADMISSAO_NOVA);
    assert.equal(d.categoriaCompetitiva, "casual");
    assert.equal(d.codigoRecusa, null);
  });

  test("GATE-02: sem adaptador, mesa VIP falha FECHADA", () => {
    // §9.7 — este é o estado de HOJE, e é a entrega desta OS.
    const d = avaliarAdmissaoAoAssento(pedido({ categoriaCompetitiva: "vip_ranqueada" }));
    assert.equal(d.ok, false);
    assert.equal(d.codigoRecusa, RECUSA_VIP_INDISPONIVEL);
    assert.equal(d.erro, ERRO_ADMISSAO);
    // portas vazias, portas com lixo no lugar da função: tudo recusa.
    for (const portas of [undefined, {}, { autorizarEntradaVip: null }, { autorizarEntradaVip: true }, { autorizarEntradaVip: {} }]) {
      const r = avaliarAdmissaoAoAssento(pedido({ categoriaCompetitiva: "vip_ranqueada" }), portas);
      assert.equal(r.ok, false, "porta inválida não pode aprovar: " + JSON.stringify(portas));
    }
  });

  test("GATE-03: mesa VIP sem uid autenticado não admite ninguém", () => {
    for (const uid of [null, undefined, "", 0, 123, {}]) {
      const d = avaliarAdmissaoAoAssento(
        pedido({ categoriaCompetitiva: "vip_ranqueada", uidAutenticado: uid }),
        { autorizarEntradaVip: () => ({ ok: true }) }
      );
      assert.equal(d.ok, false, "uid inaceitável: " + JSON.stringify(uid));
      assert.equal(d.codigoRecusa, RECUSA_VIP_INDISPONIVEL);
    }
  });

  test("GATE-04: categoria desconhecida falha fechada, com código próprio", () => {
    // §10.12. E note que ela é recusada MESMO com adaptador aprovando: não é o
    // adaptador que decide se a mesa existe.
    for (const cat of [undefined, null, "vip", "premium", CATEGORIA_DESCONHECIDA]) {
      const d = avaliarAdmissaoAoAssento(
        pedido({ categoriaCompetitiva: cat }),
        { autorizarEntradaVip: () => ({ ok: true }) }
      );
      assert.equal(d.ok, false, "categoria: " + JSON.stringify(cat));
      assert.equal(d.codigoRecusa, RECUSA_CATEGORIA_DESCONHECIDA);
    }
  });

  test("GATE-05: a porta do adaptador existe, e responde nos dois sentidos", () => {
    const negado = avaliarAdmissaoAoAssento(
      pedido({ categoriaCompetitiva: "vip_ranqueada" }),
      { autorizarEntradaVip: () => ({ ok: false }) }
    );
    assert.equal(negado.ok, false);
    assert.equal(negado.codigoRecusa, RECUSA_VIP_INDISPONIVEL);

    const aceito = avaliarAdmissaoAoAssento(
      pedido({ categoriaCompetitiva: "vip_ranqueada" }),
      { autorizarEntradaVip: () => ({ ok: true }) }
    );
    assert.equal(aceito.ok, true, "a porta precisa ser atravessável, senão é parede");
    assert.equal(aceito.categoriaCompetitiva, "vip_ranqueada");
  });

  test("GATE-06: só `{ok:true}` aprova — truthy, vazio e exceção recusam", () => {
    const respostas = [true, 1, "sim", {}, { ok: "true" }, { ok: 1 }, { autorizado: true }, null, undefined];
    for (const r of respostas) {
      const d = avaliarAdmissaoAoAssento(
        pedido({ categoriaCompetitiva: "vip_ranqueada" }),
        { autorizarEntradaVip: () => r }
      );
      assert.equal(d.ok, false, "resposta ambígua não aprova: " + JSON.stringify(r));
    }
    const explodiu = avaliarAdmissaoAoAssento(
      pedido({ categoriaCompetitiva: "vip_ranqueada" }),
      { autorizarEntradaVip: () => { throw new Error("backend fora do ar"); } }
    );
    assert.equal(explodiu.ok, false, "adaptador que quebra não libera entrada");
    assert.equal(explodiu.codigoRecusa, RECUSA_VIP_INDISPONIVEL);
  });

  test("GATE-07: tentativa sem id cunhado pelo servidor não é admissão", () => {
    for (const t of [undefined, null, "", "abc", PREFIXO_TENTATIVA, "1f0d5b6e-1111-4222-8333-444455556666"]) {
      const d = avaliarAdmissaoAoAssento(pedido({ tentativaEntradaId: t }));
      assert.equal(d.ok, false, "id de tentativa inaceitável: " + JSON.stringify(t));
    }
  });

  test("GATE-08: o adaptador recebe o uid e a classificação — e nada pessoal", () => {
    let visto = null;
    avaliarAdmissaoAoAssento(
      pedido({ categoriaCompetitiva: "vip_ranqueada", reconexao: true, assento: 2, apelido: "Sônia" }),
      { autorizarEntradaVip: (ctx) => { visto = ctx; return { ok: false }; } }
    );
    assert.ok(visto, "o adaptador foi consultado");
    assert.equal(visto.uidAutenticado, "uid-1");
    assert.equal(visto.classificacao, ADMISSAO_RECONEXAO);
    assert.equal(visto.assento, 2);
    assert.ok(ehTentativaEntradaId(visto.tentativaEntradaId));
    // O contrato do adaptador é fechado: apelido, avatar e afins não entram.
    assert.deepEqual(Object.keys(visto).sort(), [
      "assento", "categoriaCompetitiva", "classificacao", "codigoDaSala",
      "identidadeDaPartida", "tentativaEntradaId", "uidAutenticado",
    ]);
  });

  test("GATE-09: não existe ocupação de assento fora do gate", () => {
    // §9.4, prova ESTRUTURAL. Toda escrita em assento do módulo de salas está
    // nesta lista, e cada uma tem uma justificativa. Uma escrita nova derruba a
    // suíte — que é o ponto: é assim que se descobre um caminho de ocupação
    // criado sem passar por `admitirNoAssento`.
    const escritas = MOD_SALAS.match(/(?:sala|salas\[[^\]]*\])\s*\.?\s*assentos(?:\[[^\]]*\])?\s*=[^=]/g) || [];
    const normalizadas = escritas.map((e) => e.trim().replace(/\s+/g, " ").replace(/[^=]$/, ""));
    assert.deepEqual(normalizadas.sort(), [
      "sala.assentos =",          // iniciarPartida: preenche BOTS nos vazios
      "sala.assentos[alvo] =",    // entrarMesa: gated logo acima
      "sala.assentos[assento] =", // sair: LIBERA o assento, não ocupa
    ], "escrita nova em assento — ela passa por admitirNoAssento?");

    // E as duas — e só duas — chamadas do gate estão nos dois caminhos que
    // sentam um humano, cada uma antes da escrita correspondente. A declaração
    // não conta como chamada, e é por isso que ela é descontada explicitamente.
    const ocorrencias = (MOD_SALAS.match(/admitirNoAssento\(\{/g) || []).length;
    const declaracoes = (MOD_SALAS.match(/function admitirNoAssento\(\{/g) || []).length;
    assert.equal(declaracoes, 1, "o gate é declarado uma vez só");
    assert.equal(ocorrencias - declaracoes, 2,
      "o gate é chamado exatamente em criarMesa e entrarMesa");
    const iCriar = MOD_SALAS.indexOf("function criarMesa(");
    const iEntrar = MOD_SALAS.indexOf("function entrarMesa(");
    const iIniciar = MOD_SALAS.indexOf("function iniciarPartida(");
    const emCriar = MOD_SALAS.slice(iCriar, iEntrar);
    const emEntrar = MOD_SALAS.slice(iEntrar, iIniciar);
    assert.ok(emCriar.indexOf("admitirNoAssento({") < emCriar.indexOf("salas[codigo] = {"),
      "em criarMesa o gate vem ANTES de a sala existir");
    assert.ok(emEntrar.indexOf("admitirNoAssento({") < emEntrar.indexOf("sala.assentos[alvo] ="),
      "em entrarMesa o gate vem ANTES da escrita no assento");
  });

  test("GATE-10: publicId e apelido não substituem o uid interno", () => {
    // §9.6. O bundle não lê `publicId` em lugar nenhum — a única ocorrência é
    // um comentário dizendo que ele NÃO é o sujeito da admissão.
    assert.ok(!/\.publicId\b/.test(CODIGO), "nenhuma leitura de .publicId");
    assert.ok(!/["']publicId["']/.test(CODIGO), "nenhum campo string 'publicId'");
    // E um pedido que traga publicId/apelido no lugar do uid não admite.
    const d = avaliarAdmissaoAoAssento(
      { categoriaCompetitiva: "vip_ranqueada", publicId: "BMV-1234", apelido: "Sônia",
        tentativaEntradaId: novaTentativaEntradaId(), assento: 0 },
      { autorizarEntradaVip: () => ({ ok: true }) }
    );
    assert.equal(d.ok, false, "sem uid não há admissão, por mais campos que venham junto");
  });
});

// ===========================================================================
describe("GATE-VIP/TENT — a identidade da tentativa de entrada", () => {
  test("TENT-01: opaca, prefixada e diferente a cada tentativa", () => {
    const a = novaTentativaEntradaId(), b = novaTentativaEntradaId();
    assert.ok(ehTentativaEntradaId(a) && ehTentativaEntradaId(b));
    assert.ok(a.startsWith(PREFIXO_TENTATIVA));
    assert.notEqual(a, b, "duas tentativas nunca compartilham identidade");
    const muitas = new Set(Array.from({ length: 500 }, novaTentativaEntradaId));
    assert.equal(muitas.size, 500);
  });

  test("TENT-02: não carrega uid, código da sala, assento nem horário", () => {
    const g = ger({ categoriaCompetitiva: "vip_ranqueada" });
    let visto = null;
    const gv = ger({
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: (ctx) => { visto = ctx; return { ok: false }; },
    });
    gv.criarMesa({ apelido: "A", jogadorId: "uid-secreto-1", uidAutenticado: "uid-secreto-1" });
    assert.ok(visto, "o adaptador viu a tentativa");
    const t = visto.tentativaEntradaId;
    assert.ok(!t.includes("uid-secreto-1"), "o id não carrega o uid");
    assert.ok(!t.includes("MESA-1"), "o id não carrega o código da sala");
    assert.ok(!t.includes(String(new Date().getFullYear())), "o id não é derivado de data");
    assert.equal(g.categoriaConfigurada, "vip_ranqueada"); // sanidade do fixture
  });

  test("TENT-03: tentativa e eventoId não se confundem", async () => {
    // §9.10. Os dois são opacos; se fossem intercambiáveis, o de versão da
    // visão viraria chave de idempotência de consumo sem ninguém perceber.
    const srv = novoServidor();
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    const ev = c.ultimo("estado");
    assert.ok(ev && ev.eventoId, "há eventoId carimbado");
    assert.ok(!ev.eventoId.startsWith(PREFIXO_TENTATIVA),
      "eventoId NUNCA usa o prefixo de tentativa");
    // e um eventoId apresentado como tentativa é recusado pelo gate
    const d = avaliarAdmissaoAoAssento(pedido({ tentativaEntradaId: ev.eventoId }));
    assert.equal(d.ok, false, "eventoId não é tentativa de entrada");
  });

  test("TENT-04: o cliente não escolhe a tentativa", () => {
    // Nem por parâmetro do gerenciador, nem por payload: o id é cunhado dentro
    // de `admitirNoAssento` e nada do lado de fora o alcança.
    let visto = null;
    const g = ger({
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: (ctx) => { visto = ctx; return { ok: false }; },
    });
    g.criarMesa({
      apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1",
      tentativaEntradaId: "te_forjado-pelo-cliente",
    });
    assert.notEqual(visto.tentativaEntradaId, "te_forjado-pelo-cliente");
    assert.ok(!/tentativaEntradaId/.test(MOD_SERVIDOR),
      "o despachante nem conhece o nome do campo");
  });

  test("TENT-05: a tentativa não vaza para o cliente", async () => {
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada" });
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    const texto = JSON.stringify(c.recebidas);
    assert.ok(!texto.includes(PREFIXO_TENTATIVA), "nenhum id de tentativa no fio");
  });
});

// ===========================================================================
describe("GATE-VIP/PAPEL — quem passa pelo gate e quem nunca passa", () => {
  test("PAPEL-01: espectador atravessa a sala VIP sem tocar no gate", async () => {
    // §8 e §10.10. A prova é comportamental e é forte justamente porque a sala
    // é VIP: se `assistirMesa` chamasse o gate, ela seria recusada (não há
    // adaptador para o espectador) e não haveria `assistindo` nem `estado`.
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada", autorizarEntradaVip: soOCriador });
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;

    const e = await cliente(srv, "uid-espectador");
    e.envia({ tipo: "assistirMesa", codigo });
    assert.ok(e.ultimo("assistindo"), "o espectador entrou para assistir");
    assert.ok(e.ultimo("estado"), "e recebeu a projeção pública");
    assert.equal(e.ultimo("erro"), null, "sem recusa de admissão");
    assert.equal(srv.papelDe(srv.conexoes[e.id]), "espectador");
    assert.equal(srv.conexoes[e.id].assento, null, "assistir NUNCA concede assento");
    // e a sala continua com um só ocupante
    assert.equal(srv.ger.salas[codigo].assentos.filter(Boolean).length, 1);

    // Prova ESTRUTURAL (§9.5): o caminho de assistir não chama a admissão.
    const iAssistir = MOD_SERVIDOR.indexOf('case "assistirMesa"');
    const iPerfil = MOD_SERVIDOR.indexOf('case "perfil"');
    const bloco = MOD_SERVIDOR.slice(iAssistir, iPerfil);
    assert.ok(iAssistir > 0 && iPerfil > iAssistir, "achei o caso assistirMesa");
    assert.ok(!/admitirNoAssento|avaliarAdmissao/.test(bloco),
      "espectador não passa pela admissão");
  });

  test("PAPEL-02: reconexão ao próprio assento é classificada, não confundida", () => {
    // §9.9 e §10.11. A classificação sai de quem JÁ ESTÁ SENTADO, não de um
    // campo do payload — o cliente não tem como se declarar reconectando.
    const vistos = [];
    const g = ger({
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: (ctx) => { vistos.push(ctx); return { ok: true }; },
    });
    const { codigo } = g.criarMesa({ apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    assert.equal(vistos[0].classificacao, ADMISSAO_NOVA, "criar mesa é sempre entrada nova");

    g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2", uidAutenticado: "uid-2" });
    assert.equal(vistos[1].classificacao, ADMISSAO_NOVA, "um segundo jogador é entrada nova");

    g.entrarMesa({ codigo, apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    assert.equal(vistos[2].classificacao, ADMISSAO_RECONEXAO,
        "quem já ocupa assento nesta sala volta como RECONEXÃO, não como entrada nova");
  });

  test("PAPEL-03: a classificação não vem do payload", () => {
    const vistos = [];
    const g = ger({
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: (ctx) => { vistos.push(ctx); return { ok: true }; },
    });
    const { codigo } = g.criarMesa({ apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    // "eu estou reconectando, juro" — e não está.
    g.entrarMesa({ codigo, apelido: "B", jogadorId: "uid-2", uidAutenticado: "uid-2", reconexao: true });
    assert.equal(vistos[1].classificacao, ADMISSAO_NOVA,
      "declarar reconexão não converte entrada nova em reconexão");
    assert.ok(!/reconexao/.test(MOD_SERVIDOR), "o despachante não fala de reconexão");
  });

  test("PAPEL-04: `assentoDoTitular` só reconhece humano com a mesma identidade", () => {
    const sala = { assentos: [
      { tipo: "humano", jogadorId: "uid-1" },
      null,
      { tipo: "bot", jogadorId: null },
      { tipo: "humano", jogadorId: "uid-3" },
    ] };
    assert.equal(assentoDoTitular(sala, "uid-1"), 0);
    assert.equal(assentoDoTitular(sala, "uid-3"), 3);
    assert.equal(assentoDoTitular(sala, "uid-9"), -1);
    assert.equal(assentoDoTitular(sala, null), -1);
    assert.equal(assentoDoTitular(sala, ""), -1);
    assert.equal(assentoDoTitular(null, "uid-1"), -1);
  });

  test("PAPEL-05: bots e partida simulada não passam pelo gate nem consomem nada", () => {
    // §10.14. Os bots são sentados por `iniciarPartida`, que não chama a
    // admissão: bot não tem uid, não paga entrada e quem o senta é o servidor.
    const g = ger({ categoriaCompetitiva: "casual", tipoPartida: "simulada" });
    const { codigo } = g.criarMesa({ apelido: "A", jogadorId: "uid-1" });
    let consultas = 0;
    const gv = ger({
      categoriaCompetitiva: "vip_ranqueada",
      autorizarEntradaVip: () => { consultas++; return { ok: true }; },
    });
    const v = gv.criarMesa({ apelido: "A", jogadorId: "uid-1", uidAutenticado: "uid-1" });
    assert.equal(consultas, 1, "só o humano do assento 0 foi avaliado");
    gv.iniciarPartida({ codigo: v.codigo, assento: 0 });
    assert.equal(consultas, 1, "os três bots não consultaram nada");
    const sala = gv.salas[v.codigo];
    assert.equal(sala.assentos.filter((a) => a && a.tipo === "bot").length, 3);

    g.iniciarPartida({ codigo, assento: 0 });
    assert.equal(g.salas[codigo].tipoPartida, "simulada", "topologia intacta");
    assert.equal(g.salas[codigo].categoriaCompetitiva, "casual", "e é casual, não VIP");
  });

  test("PAPEL-06: nada é concedido ou consumido em nenhum caminho", () => {
    // O servidor não conhece passe, ficha, assinatura nem entitlement — e esta
    // OS não os introduziu. Prova estrutural, porque a ausência é o entregável.
    for (const proibido of [
      "playerEntitlements", "entitlement", "passeQuinzenal", "passeVip",
      "consumirPasse", "concederPasse", "firebase-admin", "firestore",
    ]) {
      assert.ok(!new RegExp(proibido, "i").test(CODIGO),
        "esta OS não implementa nem simula: " + proibido);
    }
  });
});

// ===========================================================================
describe("GATE-VIP/MESA — o comportamento no fio", () => {
  test("MESA-01: criação de sala casual, intacta", async () => {
    // §10.1. Sem categoria declarada, o servidor é o de sempre.
    const srv = novoServidor();
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    const entrou = c.ultimo("entrou");
    assert.ok(entrou, "entrou na mesa");
    assert.equal(entrou.assento, 0);
    assert.equal(srv.ger.salas[entrou.codigo].categoriaCompetitiva, "casual");
    assert.equal(c.ultimo("erro"), null);
  });

  test("MESA-02: o fluxo casual preexistente, com os quatro assentos", async () => {
    // §10.2 e §10.13: os quatro passam pelo MESMO gate, e ele deixa passar.
    const srv = novoServidor();
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    const assentos = [dono.ultimo("entrou").assento];
    for (let i = 1; i < 4; i++) {
      const c = await cliente(srv, "uid-" + i);
      c.envia({ tipo: "entrarMesa", codigo, apelido: "J" + i });
      assert.equal(c.ultimo("erro"), null, "jogador " + i + " entrou sem recusa");
      assentos.push(c.ultimo("entrou").assento);
    }
    assert.deepEqual(assentos, [0, 2, 1, 3], "a ordem parceiro-primeiro não mudou");
    dono.envia({ tipo: "iniciarPartida" });
    assert.ok(srv.ger.salas[codigo].iniciada);
    assert.ok(srv.ger.salas[codigo].partidaId, "a partida ganhou identidade");
  });

  test("MESA-03: em produção, mesa VIP não admite ninguém — nem o criador", async () => {
    // §10.4 e §6. Esta é a construção de produção: categoria confiável, ZERO
    // adaptador. A recusa acontece antes de existir sala.
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada" });
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    const erro = c.ultimo("erro");
    assert.ok(erro, "recusado");
    assert.equal(erro.codigo, RECUSA_VIP_INDISPONIVEL);
    assert.equal(c.ultimo("entrou"), null, "nenhum `entrou` foi emitido");
    assert.equal(Object.keys(srv.ger.salas).length, 0, "nenhuma sala foi criada");
    assert.equal(srv.conexoes[c.id].assento, null, "a conexão não ganhou assento");
    assert.equal(srv.conexoes[c.id].codigo, null, "nem sala");
  });

  test("MESA-04: recusa em sala VIP viva não ocupa assento e não muda a sala", async () => {
    // §10.4, §10.5, §10.6 e §10.16, no mesmo cenário — porque são o mesmo fato
    // visto de quatro lados. O dublê admite só o assento 0, então existe uma
    // sala VIP de verdade para o segundo jogador ser recusado.
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada", autorizarEntradaVip: soOCriador });
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;
    const sala = srv.ger.salas[codigo];

    const antes = JSON.stringify(sala.assentos);
    const versaoAntes = srv.ger.metadadosDe(codigo).versaoEstado;
    const eventoAntes = srv.ger.metadadosDe(codigo).eventoId;
    dono.limpar();

    const invasor = await cliente(srv, "uid-9");
    invasor.envia({ tipo: "entrarMesa", codigo, apelido: "Nove" });

    const erro = invasor.ultimo("erro");
    assert.ok(erro, "§10.4: recusado");
    assert.equal(erro.codigo, RECUSA_VIP_INDISPONIVEL);
    assert.equal(invasor.ultimo("entrou"), null);
    assert.equal(JSON.stringify(sala.assentos), antes, "§10.5: a sala não mudou");
    assert.equal(srv.conexoes[invasor.id].assento, null, "nenhum assento concedido");
    assert.equal(dono.todas("estado").length, 0,
      "§10.6: nenhum broadcast de jogador admitido saiu para a mesa");
    assert.equal(srv.ger.metadadosDe(codigo).versaoEstado, versaoAntes,
      "§10.16: recusa que não muda o estado não avança a versão");
    assert.equal(srv.ger.metadadosDe(codigo).eventoId, eventoAntes);
  });

  test("MESA-05: recusa não produz encerramento nem outbox", async () => {
    // §10.7. Recusa de entrada não é fim de partida, e não pode fabricar fato.
    const registrados = [];
    const outbox = { registrar: (env) => { registrados.push(env); return { ok: true }; } };
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada", outbox });
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    assert.ok(c.ultimo("erro"));
    assert.equal(registrados.length, 0, "nada foi registrado na outbox");
    assert.equal(c.ultimo("fim"), null, "nenhum evento de fim");
    assert.equal(Object.keys(srv.ger.salas).length, 0);
  });

  test("MESA-06: a recusa é estável e redigida", async () => {
    // §10.17 e §6. O código é ramificável; a mensagem não conta nada.
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada" });
    const c = await cliente(srv, "uid-segredo-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    const erro = c.ultimo("erro");
    assert.equal(erro.codigo, RECUSA_VIP_INDISPONIVEL);
    assert.equal(erro.motivo, ERRO_ADMISSAO);
    const texto = JSON.stringify(erro);
    for (const vazamento of ["uid-segredo-1", "vip_ranqueada", "adaptador", "autoriz", PREFIXO_TENTATIVA, "admissao_nova"]) {
      assert.ok(!texto.includes(vazamento), "a recusa não conta: " + vazamento);
    }
    // duas tentativas produzem a MESMA recusa — nada de oráculo por diferença.
    c.limpar();
    c.envia({ tipo: "criarMesa", apelido: "B" });
    assert.deepEqual(c.ultimo("erro"), erro);
  });

  test("MESA-07: os erros preexistentes da mesa não ganharam código novo", async () => {
    const srv = novoServidor();
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "entrarMesa", codigo: "MESA-INEXISTENTE" });
    const erro = c.ultimo("erro");
    assert.equal(erro.motivo, "mesa não encontrada");
    assert.ok(!("codigo" in erro), "erro preexistente sai exatamente como saía");
  });

  test("MESA-08: a identidade interna não aparece na visão", async () => {
    // §10.15. Categoria, classificação e tentativa são do servidor; a visão é
    // do jogador. Nenhum dos três atravessa.
    const srv = novoServidor({ categoriaCompetitiva: "vip_ranqueada", autorizarEntradaVip: soOCriador });
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const texto = JSON.stringify(dono.recebidas);
    for (const interno of ["categoriaCompetitiva", "vip_ranqueada", "classificacao", "admissao_nova", "tentativaEntradaId", PREFIXO_TENTATIVA]) {
      assert.ok(!texto.includes(interno), "vazou para o cliente: " + interno);
    }
  });

  test("MESA-09: categoria desconhecida no processo tranca tudo, sem virar casual", async () => {
    // §10.12 fim a fim: erro de configuração não abre mesa de graça.
    const srv = novoServidor({ categoriaCompetitiva: "premium-2027" });
    assert.equal(srv.ger.categoriaConfigurada, CATEGORIA_DESCONHECIDA);
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    const erro = c.ultimo("erro");
    assert.equal(erro.codigo, RECUSA_CATEGORIA_DESCONHECIDA);
    assert.equal(Object.keys(srv.ger.salas).length, 0);
  });

  test("MESA-10: o produtor da Primeira Batida Real segue intacto", async () => {
    // §10.18. O envelope de encerramento NÃO mudou de forma: o contrato segue
    // na versão 1 e com as mesmas chaves. A categoria competitiva fica
    // DISPONÍVEL ao encerramento pela sala (`categoriaDaSala`), e não dentro do
    // envelope — acrescentar campo a um contrato congelado seria mudança de
    // contrato, e esta OS não a autoriza.
    const srv = novoServidor();
    const dono = await cliente(srv, "uid-0");
    dono.envia({ tipo: "criarMesa", apelido: "Dono", metaPontos: 100 });
    const codigo = dono.ultimo("entrou").codigo;
    for (let i = 1; i < 4; i++) {
      const c = await cliente(srv, "uid-" + i);
      c.envia({ tipo: "entrarMesa", codigo, apelido: "J" + i });
    }
    dono.envia({ tipo: "iniciarPartida" });
    const sala = srv.ger.salas[codigo];
    sala.jogo.placar.nos = sala.jogo.metaPontos;
    sala.jogo.encerrada = true;
    sala.jogo.assentoQueBateuFinal = 0;
    srv.ger.liquidar(sala);

    const env = sala.envelopeEncerramento;
    assert.ok(env, "o envelope foi produzido");
    assert.equal(env.versaoContrato, VERSAO_CONTRATO_ENCERRAMENTO);
    assert.equal(VERSAO_CONTRATO_ENCERRAMENTO, 1, "o contrato não foi versionado por esta OS");
    assert.equal(env.uidQueBateuFinal, "uid-0", "a batida real continua resolvendo para o uid");
    assert.equal(env.motivoEncerramento, "meta_alcancada");
    assert.ok(!("categoriaCompetitiva" in env), "o envelope não ganhou campo novo");
    assert.equal(env.versaoEstadoFinal, sala.jogo.rodada, "versaoEstadoFinal intocado");

    // ...e a categoria está disponível para quem for consumir o encerramento.
    assert.equal(srv.ger.categoriaDaSala(codigo), "casual");
    assert.equal(sala.categoriaCompetitiva, "casual");
  });

  test("MESA-11: mesa privada e mesa pública casuais não exigem gate VIP", async () => {
    // §8: a topologia não decide natureza competitiva, e nenhuma combinação
    // nova foi inventada — pública e privada seguem casuais e abertas.
    for (const tipoPartida of ["publica", "privada", "simulada"]) {
      const srv = novoServidor({ tipoPartida });
      const c = await cliente(srv, "uid-1");
      c.envia({ tipo: "criarMesa", apelido: "A" });
      assert.equal(c.ultimo("erro"), null, "topologia " + tipoPartida + " não exige admissão VIP");
      const codigo = c.ultimo("entrou").codigo;
      assert.equal(srv.ger.salas[codigo].tipoPartida, tipoPartida);
      assert.equal(srv.ger.salas[codigo].categoriaCompetitiva, "casual");
    }
  });

  test("MESA-12: a categoria do processo vem do ambiente, não de mensagem", () => {
    // §4: origem confiável. O bootstrap lê CATEGORIA_COMPETITIVA do ambiente —
    // do mesmo lugar de PORT e FIREBASE_PROJECT_ID — e não injeta adaptador.
    const iWs = CODIGO.indexOf('__fabricas["ws_server"]');
    const transporte = CODIGO.slice(iWs);
    assert.ok(/categoriaCompetitiva:\s*process\.env\.CATEGORIA_COMPETITIVA/.test(transporte),
      "a categoria do processo sai do ambiente");
    assert.ok(!/autorizarEntradaVip/.test(transporte),
      "produção NÃO injeta adaptador de autorização: entrada VIP falha fechada");
  });
});
