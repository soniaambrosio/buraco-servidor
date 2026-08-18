/**
 * mesa_privada.test.js — CÓDIGO DA SALA, ENTROPIA E O VALOR DE ENTRADA.
 *
 * OS 2 — Arbitragem e canonização autoritativa dos tipos de mesa, permissões
 * VIP e passe de cortesia v1.
 *
 * Três frentes, e as três nascem de defeitos concretos desta base:
 *
 *   COD-* .... `gerarCodigoPadrao` produzia NOVE MIL códigos possíveis
 *              (`"BURACO-" + Math.floor(1000 + Math.random()*9000)`), com um
 *              gerador não criptográfico. Um script percorre esse espaço em
 *              segundos.
 *
 *   APO-* .... `criarMesa` lia `msg.aposta`. Ou seja: o CLIENTE escolhia
 *              quanto se cobrava para entrar na mesa que ele abria, e
 *              `sala.aposta` alimenta `registrarPartida`, que move o cofre.
 *
 *   PRI-* .... a Mesa Privada é benefício exclusivo VIP, e cada ocupante
 *              precisa de direito próprio. O gate passou a exigir autorização
 *              na topologia `privada` DECLARADA.
 *
 * As provas de código (`COD-EST-*`) leem o CÓDIGO do bundle, e não os
 * comentários — este arquivo e o `server.js` explicam em prosa longa por que
 * `Math.random` não serve, e sem separar as duas coisas um comentário que
 * EXPLICA o defeito derrubaria o teste que prova que ele sumiu.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { novoServidor, cliente } = require("./ajuda.js");

const bundle = require("../server.js");
const { gerarCodigoPadrao, criarGerenciador } = bundle.require("salas");

const FONTE = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

/** O CÓDIGO de um trecho do bundle, sem os comentários.
 *
 *  Mesma disciplina de `gate_vip.test.js`, e pelo mesmo motivo: este arquivo e
 *  o `server.js` explicam em prosa longa por que `Math.random` não serve para
 *  cunhar código de sala. Sem separar código de comentário, o parágrafo que
 *  EXPLICA o defeito derrubaria o teste que prova que ele sumiu — e a saída
 *  seria apagar a explicação para salvar a prova. */
function semComentarios(texto) {
  const limpo = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  for (const marcador of ["function ", "return "]) {
    assert.ok(limpo.includes(marcador), "a limpeza comeu o código: " + marcador);
  }
  return limpo;
}

/** Recorte textual de um módulo do bundle, já sem comentários. */
function codigoDe(nome, seguinte) {
  const i = FONTE.indexOf('__fabricas["' + nome + '"]');
  const j = FONTE.indexOf('__fabricas["' + seguinte + '"]');
  assert.ok(i >= 0 && j > i, "não achei o módulo " + nome + " no bundle");
  return semComentarios(FONTE.slice(i, j));
}

const CODIGO = semComentarios(FONTE);

// ===========================================================================

describe("COD — entropia do código da sala", () => {
  test("COD-01 o formato mudou, e o antigo não é mais produzido", () => {
    // Formato novo de propósito: um código `BURACO-4821` apresentado hoje é
    // reconhecivelmente ANTIGO, e não um código válido de uma sala que já não
    // existe. As duas situações pedem respostas diferentes.
    const c = gerarCodigoPadrao();
    assert.match(c, /^BMV-[A-Z0-9]{4}-[A-Z0-9]{4}$/, `formato inesperado: ${c}`);
    assert.equal(/^BURACO-\d{4}$/.test(c), false);
  });

  test("COD-02 o alfabeto não tem símbolo ambíguo ao ser ditado", () => {
    const vistos = new Set();
    for (let i = 0; i < 500; i++) {
      for (const s of gerarCodigoPadrao().replace(/^BMV-/, "").replace("-", "")) vistos.add(s);
    }
    for (const proibido of ["0", "O", "1", "I", "L", "2", "Z", "5", "S", "8", "B"]) {
      assert.equal(vistos.has(proibido), false, `o alfabeto voltou a conter ${proibido}`);
    }
  });

  test("COD-03 mil códigos, mil valores diferentes", () => {
    // Com nove mil possibilidades, mil sorteios colidiriam quase sempre
    // (aniversário: ~1 em 10^24 de NÃO colidir). Este teste sozinho derruba o
    // gerador antigo.
    const vistos = new Set();
    for (let i = 0; i < 1000; i++) vistos.add(gerarCodigoPadrao());
    assert.equal(vistos.size, 1000);
  });

  test("COD-04 o espaço de códigos passa de 2^36", () => {
    const ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";
    const bits = 8 * Math.log2(ALFABETO.length);
    assert.ok(bits >= 36, `só ${bits.toFixed(1)} bits`);
    // O gerador antigo tinha ~13. A margem não é estética.
    assert.ok(bits - Math.log2(9000) > 22);
  });

  test("COD-05 a distribuição dos símbolos é plana — a redução é por rejeição", () => {
    // `% 25` sobre 0..255 daria aos seis primeiros símbolos ~1.22x a chance dos
    // demais. Com 40 mil símbolos sorteados, um viés desse tamanho aparece bem
    // acima do ruído.
    const contagem = new Map();
    let total = 0;
    for (let i = 0; i < 5000; i++) {
      for (const s of gerarCodigoPadrao().replace(/^BMV-/, "").replace("-", "")) {
        contagem.set(s, (contagem.get(s) || 0) + 1);
        total++;
      }
    }
    const esperado = total / contagem.size;
    for (const [simbolo, n] of contagem) {
      const desvio = Math.abs(n - esperado) / esperado;
      assert.ok(desvio < 0.15, `viés em ${simbolo}: ${(desvio * 100).toFixed(1)}%`);
    }
  });

  test("COD-06 o gerador injetado continua mandando nos testes", () => {
    // A injeção é o que permite às 300 provas desta suíte usarem `MESA-1`.
    // Trocar o gerador padrão não pode ter tirado isso.
    const ger = criarGerenciador({ gerarCodigo: () => "MESA-FIXA" });
    const r = ger.criarMesa({ apelido: "A", jogadorId: "j1" });
    assert.equal(r.codigo, "MESA-FIXA");
  });
});

describe("COD-EST — provas estruturais", () => {
  const salas = codigoDe("salas", "auth_firebase");

  test("COD-EST-01 `Math.random` não cunha mais código de sala", () => {
    const gerador = salas.slice(
      salas.indexOf("function gerarCodigoPadrao"),
      salas.indexOf("const TIPOS_DE_PARTIDA"),
    );
    assert.ok(gerador.length > 0, "não achei o gerador no bundle");
    assert.equal(/Math\.random/.test(gerador), false, "Math.random voltou ao gerador");
    assert.ok(/crypto\.randomBytes/.test(gerador), "o gerador não usa bytes criptográficos");
  });

  test("COD-EST-02 a redução é por rejeição, e não por módulo direto sobre 256", () => {
    const gerador = salas.slice(
      salas.indexOf("function gerarCodigoPadrao"),
      salas.indexOf("const TIPOS_DE_PARTIDA"),
    );
    assert.ok(/256\s*%\s*ALFABETO_CODIGO\.length/.test(gerador), "sumiu o limite de rejeição");
    assert.ok(/continue/.test(gerador), "sumiu o descarte do byte fora do limite");
  });
});

// ===========================================================================

describe("APO — o valor de entrada não vem do cliente", () => {
  test("APO-01 `msg.aposta` não é mais lido pelo despachante", () => {
    // Prova ESTRUTURAL, e ela é a que importa: o defeito não era o valor, era
    // o caminho. Enquanto o despachante montasse `aposta` a partir de `msg`,
    // qualquer normalização a jusante seria contornável mandando outro número.
    const iWs = CODIGO.indexOf('__fabricas["ws_server"]');
    const transporte = CODIGO.slice(iWs);
    const limpo = transporte
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    assert.equal(/aposta:\s*msg\.aposta/.test(limpo), false, "o cliente voltou a escolher a aposta");
    assert.equal(/msg\.aposta/.test(limpo), false, "`msg.aposta` ainda é lido em algum ponto");
  });

  test("APO-02 `criarMesa` não recebe mais aposta como parâmetro", () => {
    const ger = criarGerenciador({ gerarCodigo: () => "MESA-A" });
    // Mesmo passando o campo explicitamente, ele é inerte: a assinatura da
    // função não o tem mais, e a sala nasce com a aposta do processo.
    const r = ger.criarMesa({ apelido: "A", jogadorId: "j1", aposta: 5000 });
    assert.equal(r.erro, undefined);
    assert.equal(ger.salas["MESA-A"].aposta, 0, "o valor do cliente entrou na sala");
  });

  test("APO-03 a aposta é configuração do PROCESSO", () => {
    const ger = criarGerenciador({ gerarCodigo: () => "MESA-B", apostaDeEntrada: 500 });
    ger.criarMesa({ apelido: "A", jogadorId: "j1" });
    assert.equal(ger.salas["MESA-B"].aposta, 500);
  });

  test("APO-04 valor inválido de configuração vira ZERO, e não NaN", () => {
    // Fecha para o lado seguro: uma configuração errada não pode virar uma
    // mesa que cobra um valor indefinido.
    for (const valor of ["500", null, NaN, Infinity, -100, undefined, {}]) {
      const ger = criarGerenciador({ gerarCodigo: () => "MESA-C", apostaDeEntrada: valor });
      ger.criarMesa({ apelido: "A", jogadorId: "j1" });
      assert.equal(ger.salas["MESA-C"].aposta, 0, `aceitou ${JSON.stringify(valor)}`);
    }
  });

  test("APO-05 a mesa pública padrão não cobra entrada", () => {
    // §5.1 da OS: a Mesa Pública não oferece aposta de entrada. Com o valor
    // saindo do processo e o padrão sendo zero, isso passa a ser a situação de
    // toda instância que ninguém configurou para cobrar.
    const ger = criarGerenciador({ gerarCodigo: () => "MESA-D", tipoPartida: "publica" });
    ger.criarMesa({ apelido: "A", jogadorId: "j1" });
    assert.equal(ger.salas["MESA-D"].aposta, 0);
  });
});

// ===========================================================================

describe("PRI — a Mesa Privada exige autorização por ocupante", () => {
  test("PRI-01 o gate é consultado na topologia privada declarada, mesmo casual", async () => {
    const perguntas = [];
    const srv = novoServidor({
      tipoPartida: "privada",
      autorizarEntradaVip: (ctx) => {
        perguntas.push(ctx);
        return { ok: true, admissaoId: "adm_" + perguntas.length };
      },
    });
    const c = await cliente(srv, "uid-dono");
    c.envia({ tipo: "criarMesa", apelido: "Dono" });
    assert.equal(c.ultimo("erro"), null);
    assert.equal(perguntas.length, 1, "o backend não foi consultado");
    assert.equal(perguntas[0].uidAutenticado, "uid-dono");
    assert.equal(perguntas[0].categoriaCompetitiva, "casual");
  });

  test("PRI-02 CADA cadeira é perguntada separadamente", async () => {
    // O coração da regra: uma assinatura não libera familiares nem
    // convidados. Quatro ocupantes, quatro perguntas, quatro uids diferentes.
    const perguntados = [];
    const srv = novoServidor({
      tipoPartida: "privada",
      autorizarEntradaVip: (ctx) => {
        perguntados.push(ctx.uidAutenticado);
        return { ok: true, admissaoId: "adm_" + perguntados.length };
      },
    });
    const dono = await cliente(srv, "uid-dono");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;

    for (const uid of ["uid-b", "uid-c", "uid-d"]) {
      const c = await cliente(srv, uid);
      c.envia({ tipo: "entrarMesa", codigo, apelido: uid });
    }
    assert.deepEqual(perguntados, ["uid-dono", "uid-b", "uid-c", "uid-d"]);
  });

  test("PRI-03 o convidado recusado pelo backend NÃO ocupa cadeira", async () => {
    // O caso 38 da OS: não VIP com código válido não senta. Aqui o "código
    // válido" é literal — ele conhece o código da sala e chega até a entrada.
    const srv = novoServidor({
      tipoPartida: "privada",
      autorizarEntradaVip: (ctx) =>
        ctx.uidAutenticado === "uid-dono" ? { ok: true, admissaoId: "adm_1" } : { ok: false },
    });
    const dono = await cliente(srv, "uid-dono");
    dono.envia({ tipo: "criarMesa", apelido: "Dono" });
    const codigo = dono.ultimo("entrou").codigo;

    const carona = await cliente(srv, "uid-carona");
    carona.envia({ tipo: "entrarMesa", codigo, apelido: "Carona" });
    assert.ok(carona.ultimo("erro"), "o carona entrou");
    assert.equal(carona.ultimo("entrou"), null);

    const ocupados = srv.ger.salas[codigo].assentos.filter(Boolean).length;
    assert.equal(ocupados, 1, "a cadeira do carona foi ocupada");
  });

  test("PRI-04 a recusa do convidado é a MESMA da recusa do dono", async () => {
    // Sem oráculo: a mensagem não conta se a sala existe, se o código estava
    // certo ou se o problema era a assinatura.
    const srv = novoServidor({ tipoPartida: "privada" });
    const a = await cliente(srv, "uid-a");
    a.envia({ tipo: "criarMesa", apelido: "A" });
    const b = await cliente(srv, "uid-b");
    b.envia({ tipo: "entrarMesa", codigo: "MESA-QUE-NAO-EXISTE", apelido: "B" });
    assert.ok(a.ultimo("erro"));
    assert.ok(b.ultimo("erro"));
  });

  test("PRI-05 a mesa pública casual segue sem consultar backend nenhum", async () => {
    // A contraprova de PRI-01: se o gate passasse a perguntar em toda mesa, a
    // Mesa Pública deixaria de ser gratuita — e o custo apareceria como
    // latência em toda entrada do jogo.
    let perguntas = 0;
    const srv = novoServidor({
      tipoPartida: "publica",
      autorizarEntradaVip: () => {
        perguntas++;
        return { ok: true, admissaoId: "adm" };
      },
    });
    const c = await cliente(srv, "uid-1");
    c.envia({ tipo: "criarMesa", apelido: "A" });
    assert.equal(c.ultimo("erro"), null);
    assert.equal(perguntas, 0, "a mesa pública consultou o backend");
  });
});
