// test/uuid_falso_positivo.test.js — o arnês do espectador julgado a si mesmo.
//
// POR QUE ESTA SUÍTE EXISTE.
//
// A prova de não-vazamento do espectador varre cada payload atrás dos ids das
// cartas secretas. Um id de carta é `c` + dígitos (`c1818`); um `eventoId` é
// `crypto.randomUUID()`, que é hexadecimal. Como todo dígito decimal é dígito
// hexadecimal — e `c` também é —, um UUID pode conter `c1818` POR SORTEIO, sem
// que carta nenhuma tenha vazado. A varredura antiga fazia `no.includes(s)` e
// reprovava nessa coincidência: prova intermitente, que ora acusa, ora não.
//
// Estas asserções não são sobre o servidor. São sobre a VARREDURA: ela precisa
// distinguir um id que está ali como DADO de uma sequência que caiu dentro de
// outra identidade opaca. E precisa fazer isso sem perder um grama de detecção —
// por isso metade dos casos abaixo exige que a varredura CONTINUE reprovando.

const { test, describe } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");

const {
  J,
  varrerSegredos,
  tokensDe,
  mesaComPartida,
  espectador,
  segredosAgora,
} = require("./ajuda.js");

// O id que a OS nomeia. Cinco caracteres, todos hexadecimais — é por isso que ele
// cabe dentro de um UUID.
const ALVO = "c1818";
const SEGREDOS = new Set([ALVO]);

/**
 * UUID v4 sintaticamente VÁLIDO com `miolo` embutido a partir de `offset`, dentro
 * do grupo escolhido. Determinístico: nada aqui é sorteado.
 *
 * Os grupos 2, 3 e 4 têm 4 caracteres e não comportam um id de 5; o 3 começa com
 * o dígito de versão (`4`) e o 4 com o de variante (8/9/a/b). Então as posições
 * possíveis são as do grupo 1 (8 casas) e as do grupo 5 (12 casas).
 */
function uuidComMiolo(miolo, grupo, offset) {
  const grupos = ["0".repeat(8), "0000", "4000", "8000", "0".repeat(12)];
  const g = grupos[grupo];
  assert.ok(offset + miolo.length <= g.length, "posição impossível no grupo");
  grupos[grupo] = g.slice(0, offset) + miolo + g.slice(offset + miolo.length);
  return grupos.join("-");
}

/** Toda posição em que um id de 5 caracteres cabe dentro de um UUID v4 válido. */
function todasAsPosicoes(miolo) {
  const fora = [];
  for (const grupo of [0, 4]) {
    const largura = grupo === 0 ? 8 : 12;
    for (let off = 0; off + miolo.length <= largura; off++) {
      fora.push(uuidComMiolo(miolo, grupo, off));
    }
  }
  return fora;
}

const FORMA_CANONICA = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ===========================================================================
// §1 — O FALSO POSITIVO MORRE, E MORRE SEM DEPENDER DE SORTE
// ===========================================================================
describe("§1 — coincidência dentro de identidade opaca não é vazamento", () => {
  test("CASO 1: `eventoId` contendo `c1818` internamente NÃO reprova", () => {
    // O caso exato da OS, fixo no código: nenhuma execução escapa dele.
    const eventoId = "550e8400-e29b-41d4-a716-4466c1818000";
    assert.match(eventoId, FORMA_CANONICA, "a sonda precisa usar um UUID v4 legítimo");
    assert.ok(eventoId.includes(ALVO), "a sonda precisa MESMO conter o id — senão não prova nada");

    assert.deepEqual(
      varrerSegredos({ versaoEstado: 7, eventoId }, SEGREDOS),
      [],
      "id de carta contido por acaso num UUID foi acusado como vazamento"
    );
  });

  test("CASO 12: em NENHUMA posição possível do UUID a coincidência reprova", () => {
    // Exaustivo, não amostral: as 4 posições do grupo 1 e as 8 do grupo 5.
    const posicoes = todasAsPosicoes(ALVO);
    assert.equal(posicoes.length, 12, "as 12 posições possíveis precisam ser cobertas");
    for (const eventoId of posicoes) {
      assert.match(eventoId, FORMA_CANONICA, eventoId + " não é UUID v4 válido");
      assert.ok(eventoId.includes(ALVO));
      assert.deepEqual(
        varrerSegredos({ eventoId }, SEGREDOS),
        [],
        "posição " + eventoId + " ainda reprova"
      );
    }
  });

  test("CASO 7: 100 mil UUIDs de verdade, contra um baralho inteiro de segredos vivos", () => {
    // O regime pior: contador baixo, ids curtos (`c1`..`c108`). Na varredura
    // antiga, 60% destes UUIDs reprovavam.
    const segredos = new Set();
    for (let i = 1; i <= 108; i++) segredos.add("c" + i);

    const N = 100000;
    const acusados = [];
    for (let i = 0; i < N; i++) {
      const eventoId = crypto.randomUUID();
      const achados = varrerSegredos({ versaoEstado: i, eventoId }, segredos);
      if (achados.length) acusados.push(eventoId + " -> " + achados.join("; "));
      if (acusados.length > 3) break; // já falhou; não vale gastar o resto
    }
    assert.deepEqual(acusados, [], "UUID legítimo acusado de carregar carta");
  });

  test("CASO 7b: o UUID também não vira vazamento quando é a mensagem inteira", () => {
    for (const eventoId of todasAsPosicoes(ALVO)) {
      assert.deepEqual(varrerSegredos(eventoId, SEGREDOS), []);
      assert.deepEqual(varrerSegredos([eventoId], SEGREDOS), []);
      assert.deepEqual(varrerSegredos({ a: { b: { c: eventoId } } }, SEGREDOS), []);
    }
  });
});

// ===========================================================================
// §2 — VAZAMENTO REAL CONTINUA REPROVANDO
// Se qualquer teste desta seção passar a dar verde, a correção virou cegueira.
// ===========================================================================
describe("§2 — o que é vazamento de verdade continua sendo acusado", () => {
  test("CASO 2: valor EXATAMENTE igual a `c1818` reprova — inclusive em `eventoId`", () => {
    // O campo é o mesmo do falso positivo de propósito: quem "resolver" o problema
    // pulando `eventoId` inteiro mata este caso.
    assert.notDeepEqual(varrerSegredos({ eventoId: ALVO }, SEGREDOS), []);
    assert.notDeepEqual(varrerSegredos({ versaoEstado: 3, eventoId: ALVO }, SEGREDOS), []);
    assert.notDeepEqual(varrerSegredos(ALVO, SEGREDOS), []);
    assert.notDeepEqual(varrerSegredos({ qualquerCampo: ALVO }, SEGREDOS), []);
  });

  test("CASO 3: lista contendo `c1818` reprova", () => {
    assert.notDeepEqual(varrerSegredos([ALVO], SEGREDOS), []);
    assert.notDeepEqual(varrerSegredos({ mao: ["c9", ALVO, "c7"] }, SEGREDOS), []);
    // Lista dentro de lista dentro de objeto: a recursão não pode desistir.
    assert.notDeepEqual(varrerSegredos({ a: [[["c9"], [ALVO]]] }, SEGREDOS), []);
  });

  test("CASO 4: objeto de carta oculto reprova", () => {
    const carta = { id: ALVO, naipe: "P", valor: "A", eh_coringa: false };
    const achados = varrerSegredos({ topo: carta }, SEGREDOS);
    assert.notDeepEqual(achados, []);
    assert.ok(
      achados.some((a) => a.includes("OBJETO de carta secreta")),
      "a carta inteira precisa ser relatada COMO carta, não só como id solto"
    );
    // E também quando ela viaja dentro de uma lista de cartas.
    assert.notDeepEqual(varrerSegredos({ suaMao: [carta] }, SEGREDOS), []);
  });

  test("CASO 5: campo aninhado fundo contendo o id exato reprova", () => {
    assert.notDeepEqual(
      varrerSegredos({ dados: { x: { y: { z: { valor: ALVO } } } } }, SEGREDOS),
      []
    );
    // Sob uma chave inventada amanhã, e como a própria chave.
    assert.notDeepEqual(varrerSegredos({ a: { b: { [ALVO]: 1 } } }, SEGREDOS), []);
  });

  test("CASO 6: texto descritivo com o id como TOKEN independente reprova", () => {
    for (const texto of [
      "carta " + ALVO + " recusada",
      "erro: " + ALVO,
      ALVO + " nao pode ser descartada",
      "ids=[" + ALVO + "]",
      "topo:" + ALVO + ";vez:2",
      "mao0-" + ALVO, // composto por hífen: a parte ainda é um token
    ]) {
      assert.notDeepEqual(
        varrerSegredos({ msg: texto }, SEGREDOS),
        [],
        "o texto `" + texto + "` cita o id e passou batido"
      );
    }
  });

  test("CASO 6b: id colado FORA de um UUID continua sendo pego", () => {
    // Retirar a identidade opaca não pode servir de esconderijo para o vizinho.
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    assert.notDeepEqual(varrerSegredos({ m: uuid + " " + ALVO }, SEGREDOS), []);
    assert.notDeepEqual(varrerSegredos({ m: ALVO + " " + uuid }, SEGREDOS), []);
    assert.notDeepEqual(varrerSegredos({ m: "evento " + uuid + ", carta " + ALVO }, SEGREDOS), []);
  });

  test("CASO 8: vários ids-alvo continuam detectados, todos", () => {
    const muitos = new Set(["c1818", "c2", "c37", "c1007", "SEGREDO-MAO0-3"]);
    const payload = {
      eventoId: "550e8400-e29b-41d4-a716-4466c1818000", // coincidência: não conta
      lista: ["c2"],
      fundo: { z: "c37" },
      carta: { id: "c1007", naipe: "C", valor: "K" },
      texto: "a carta SEGREDO-MAO0-3 caiu",
    };
    const achados = varrerSegredos(payload, muitos);
    for (const s of ["c2", "c37", "c1007", "SEGREDO-MAO0-3"]) {
      assert.ok(
        achados.some((a) => a.endsWith(s) || a.includes(" " + s)),
        "o id " + s + " deixou de ser detectado"
      );
    }
    assert.equal(
      achados.some((a) => a.includes("eventoId")),
      false,
      "a coincidência no eventoId voltou a contar"
    );
  });

  test("a tokenização não inventa nem engole token", () => {
    assert.deepEqual([...tokensDe("carta c1818 fora")].sort(), ["c1818", "carta", "fora"]);
    // O UUID vira ESPAÇO: os vizinhos não se colam num token que não existia.
    assert.deepEqual(
      [...tokensDe("a 550e8400-e29b-41d4-a716-446655440000 b")].sort(),
      ["a", "b"]
    );
    // Composto com hífen entrega o inteiro E as partes.
    assert.deepEqual([...tokensDe("SEGREDO-MAO0-1")].sort(), ["1", "MAO0", "SEGREDO", "SEGREDO-MAO0-1"]);
  });
});

// ===========================================================================
// §3 — O QUE A CORREÇÃO NÃO PODE TER MEXIDO
// A varredura mudou; a fronteira do servidor, não. Estes casos rodam contra o
// servidor de verdade, com ids de carta de verdade.
// ===========================================================================
describe("§3 — a fronteira do servidor segue no lugar", () => {
  test("CASO 9: o caminho do jogador recebe o que lhe pertence", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;
    const propria = new Set(jogo.maos[0].map((c) => c.id));

    const visao = J.visaoDoAssento(jogo, 0);
    assert.equal(visao.suaMao.length, jogo.maos[0].length);
    // A varredura ENXERGA esses ids — não ficou cega. Aqui isso é o correto:
    // a própria mão é legítima no caminho do dono.
    assert.notDeepEqual(
      varrerSegredos(visao, propria),
      [],
      "a varredura deixou de enxergar id de carta que está ali como dado"
    );
  });

  test("CASO 10: o espectador continua sem receber carta oculta", async () => {
    const { srv, codigo, sala } = await mesaComPartida();
    const jogo = sala.jogo;

    const esp = await espectador(srv, codigo);
    const visao = esp.ultimo("estado").visao;

    assert.equal(visao.espectador, true);
    assert.deepEqual(varrerSegredos(visao, segredosAgora(jogo)), [], "segredo na visão do espectador");
    assert.deepEqual(varrerSegredos(esp.recebidas, segredosAgora(jogo)), [], "segredo em alguma mensagem");
    // E o contraste: os mesmos ids ESTÃO no jogo — o conjunto não é vazio.
    assert.ok(segredosAgora(jogo).size >= 100, "o conjunto de segredos precisa ser real");
  });

  test("CASO 11: o parceiro não recebe carta que não pode conhecer", async () => {
    const { sala } = await mesaComPartida();
    const jogo = sala.jogo;

    // O assento não é o índice do jogador; a dupla vem do próprio assento.
    const dupla = jogo.assentos[0].dupla;
    const parceiro = jogo.assentos.findIndex((a, i) => i !== 0 && a.dupla === dupla);
    assert.ok(parceiro > 0, "a mesa precisa ter parceiro para o assento 0");

    const maoDoParceiro = new Set(jogo.maos[parceiro].map((c) => c.id));
    const visao = J.visaoDoAssento(jogo, 0);
    assert.deepEqual(
      varrerSegredos(visao, maoDoParceiro),
      [],
      "a mão do parceiro (assento " + parceiro + ") vazou para o assento 0"
    );
    // Do parceiro só se vê a contagem.
    assert.equal(visao.assentos[parceiro].qtdCartas, jogo.maos[parceiro].length);
  });
});
