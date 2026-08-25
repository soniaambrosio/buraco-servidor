// test/inventario_executado.test.js — A SUÍTE PRÓPRIA DO INVENTÁRIO (OS 54-C4, §5).
//
// ===========================================================================
// POR QUE ESTA SUÍTE EXISTE
// ===========================================================================
//
// `ci/inventario_de_execucao.js` é a autoridade de QUANTIDADE desde a OS 54-C2:
// ele executa as suítes obrigatórias pelo stream de eventos do `node:test` e
// conta por `data.file`, o campo de origem. Isso resolve os três buracos que a
// R2 abriu na contagem textual — `regex.test(` contado como caso, ocorrência em
// comentário contada como caso, e nenhuma noção de origem.
//
// Mas o julgamento dele pode ser esvaziado como qualquer outro. `julgarInventario`
// devolvendo `[]` sem olhar nada ficaria verde no CI para sempre. Por isso o
// veredito foi separado da execução: aqui ele é exercitado com inventários
// FORJADOS, um defeito por vez, e tem de reprovar pelo motivo certo.
//
// A execução de verdade também é exercitada, uma vez, num arquivo pequeno: sem
// isso, `inventariar()` poderia parar de emitir origem e ninguém notaria.
//
// [OS 54-C4] E A SUÍTE DA AUTORIDADE DO ARTEFATO ENTROU NA MEDIDA. Nesta
// árvore composta o inventário cobra `artefato_unico.test.js` pelo piso
// executado E por nome — a folha de origem da auditabilidade nasceu antes da
// OS 52-C4 e não conhecia essa suíte. INV-15 é o caso que impede a entrada de
// sumir das listas sem que nada reclame: piso que ninguém declara é piso que
// não existe.

"use strict";

const test = require("node:test");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");

const { conferirCenso, OBRIGATORIAS } = require("./censo_de_suites.js");
const { inventariar, julgarInventario } = require("../ci/inventario_de_execucao.js");
const {
  MINIMO_EXECUTADO,
  MINIMO_DECLARADO_NO_CENSO,
  NOMES_OBRIGATORIOS,
  conferirPisosDeclarados,
} = require("../ci/pisos_autorizados.js");

/** Um inventário perfeito: cada arquivo obrigatório no piso exato, com todos os
 *  casos nominais presentes. É o controle — e a base de cada sabotagem. */
function inventarioIntegro() {
  const porArquivo = new Map();
  for (const [arquivo, piso] of Object.entries(MINIMO_EXECUTADO)) {
    const nomes = (NOMES_OBRIGATORIOS[arquivo] || []).map((n) => n + ": alguma coisa");
    while (nomes.length < piso) nomes.push("caso " + nomes.length);
    porArquivo.set(arquivo, { casos: piso, nomes });
  }
  return { porArquivo, semOrigem: [], falhas: [] };
}

function exigeMotivo(reprovacoes, padrao, oQue) {
  assert.ok(
    reprovacoes.some((m) => padrao.test(m)),
    oQue + " — o inventário devolveu: " + JSON.stringify(reprovacoes)
  );
}

test("INV/CONTROLE — o inventário íntegro passa, e o censo real é consistente", async (t) => {
  await t.test("INV-00: inventário no piso, com os nomes, é aprovado", () => {
    // Trava anti-vácuo: um julgamento que reprovasse tudo passaria em todos os
    // casos negativos abaixo e pareceria rigoroso estando quebrado.
    assert.deepEqual(julgarInventario(inventarioIntegro(), OBRIGATORIAS), []);
  });

  await t.test("INV-00b: o censo REAL declara pisos consistentes com os autorizados", () => {
    assert.deepEqual(conferirPisosDeclarados(OBRIGATORIAS), []);
    conferirCenso();
  });

  await t.test("INV-00c: as duas listas cobrem as mesmas suítes obrigatórias", () => {
    // Uma suíte que estivesse só numa das listas teria metade da proteção — e
    // seria a metade errada, porque a que falta é sempre a que ninguém checa.
    assert.deepEqual(
      Object.keys(MINIMO_EXECUTADO).sort(),
      Object.keys(MINIMO_DECLARADO_NO_CENSO).sort()
    );
    for (const arquivo of Object.keys(MINIMO_EXECUTADO)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(OBRIGATORIAS, arquivo),
        arquivo + " está nos mínimos externos mas saiu do censo"
      );
    }
  });
});

test("INV/EXECUÇÃO — a origem vem do executor, não do fonte", async (t) => {
  await t.test("INV-01: uma suíte pequena é executada e atribuída ao arquivo real", () => {
    // POR SUBPROCESSO, e não por chamada direta: `run()` aninhado dentro de um
    // processo que já é `node --test` não emite evento nenhum — medido, não
    // suposto. Chamar o inventário como PROCESSO é também como o CI o chama,
    // então este caso exercita o caminho real em vez de um atalho.
    const bruto = execFileSync(
      process.execPath,
      [path.join(__dirname, "..", "ci", "inventario_de_execucao.js"), "--json", "--arquivos", "chat_contrato.test.js"],
      // `NODE_TEST_CONTEXT` é herdada do runner e faz o filho se comportar como
      // parte DESTA execução — o stream do filho sai vazio e o caso reprova por
      // motivo errado. Custou uma volta: limpar a variável é o que faz o
      // subprocesso ser mesmo um subprocesso.
      { encoding: "utf8", timeout: 300000, env: Object.assign({}, process.env, { NODE_TEST_CONTEXT: undefined }) }
    );
    const inventario = JSON.parse(bruto);
    inventario.porArquivo = new Map(Object.entries(inventario.porArquivo));
    const registro = inventario.porArquivo.get("chat_contrato.test.js");
    assert.ok(registro, "o stream não atribuiu nenhum caso ao arquivo executado");
    assert.ok(
      registro.casos >= MINIMO_EXECUTADO["chat_contrato.test.js"],
      "executou " + registro.casos + " casos, abaixo do piso"
    );
    assert.equal(inventario.semOrigem.length, 0, "houve evento sem `file`");
    assert.equal(inventario.falhas.length, 0, "a suíte executada ficou vermelha");
  });

  await t.test("INV-02: arquivo obrigatório ausente do disco é erro fatal, não silêncio", async () => {
    const inventario = await inventariar({ arquivos: ["suite_que_nao_existe.test.js"] });
    exigeMotivo(
      julgarInventario(inventario, OBRIGATORIAS),
      /SUÍTE OBRIGATÓRIA AUSENTE DO DISCO/,
      "ausência de arquivo não pode virar inventário vazio aprovado"
    );
  });
});

test("INV/VEREDITO — cada defeito reprova pelo motivo certo", async (t) => {
  await t.test("INV-03: suíte que não executou reprova", () => {
    const inv = inventarioIntegro();
    inv.porArquivo.delete("gate_vip.test.js");
    exigeMotivo(julgarInventario(inv, OBRIGATORIAS), /SUÍTE NÃO EXECUTOU: `gate_vip/, "suíte sumiu do stream");
  });

  await t.test("INV-04: casos abaixo do piso executado reprovam", () => {
    const inv = inventarioIntegro();
    const r = inv.porArquivo.get("ci_obrigatorio.test.js");
    r.casos -= 1;
    exigeMotivo(julgarInventario(inv, OBRIGATORIAS), /CASOS EXECUTADOS ABAIXO DO PISO/, "um caso a menos passou");
  });

  await t.test("INV-05: caso nominal apagado reprova, mesmo com o piso satisfeito", () => {
    // O ponto exato em que a C1 caiu: o bloco inteiro sumia, o número era
    // reposto por prosa, e nada reclamava. Aqui o número está no piso e o nome
    // não está — e isso basta para reprovar.
    const inv = inventarioIntegro();
    const r = inv.porArquivo.get("ci_obrigatorio.test.js");
    r.nomes = r.nomes.filter((n) => !n.startsWith("CI-18"));
    r.nomes.push("caso qualquer para manter a contagem");
    exigeMotivo(julgarInventario(inv, OBRIGATORIAS), /CASO NOMINAL AUSENTE: `CI-18`/, "CI-18 sumiu e o piso ficou cheio");
  });

  await t.test("INV-06: caso nominal em OUTRO arquivo não conta — origem importa", () => {
    const inv = inventarioIntegro();
    const alvo = inv.porArquivo.get("ci_obrigatorio.test.js");
    alvo.nomes = alvo.nomes.filter((n) => !n.startsWith("CI-19b"));
    alvo.nomes.push("preenchimento");
    inv.porArquivo.set("isca.test.js", { casos: 99, nomes: ["CI-19b: emprestado de outro arquivo"] });
    exigeMotivo(
      julgarInventario(inv, OBRIGATORIAS),
      /CASO NOMINAL AUSENTE: `CI-19b`/,
      "um arquivo-isca emprestou o nome e o inventário aceitou"
    );
  });

  await t.test("INV-07: evento sem origem reprova", () => {
    const inv = inventarioIntegro();
    inv.semOrigem = ["um caso que veio sem `file`"];
    exigeMotivo(julgarInventario(inv, OBRIGATORIAS), /CASO SEM ORIGEM/, "sem origem o inventário perde o sentido");
  });

  await t.test("INV-08: suíte obrigatória vermelha reprova", () => {
    const inv = inventarioIntegro();
    inv.falhas = ["gate_vip.test.js :: algum caso"];
    exigeMotivo(julgarInventario(inv, OBRIGATORIAS), /SUÍTE OBRIGATÓRIA VERMELHA/, "falha no inventário passou");
  });
});

test("INV/PISOS — o censo não declara menos do que o autorizado", async (t) => {
  await t.test("INV-09: `ci_obrigatorio.test.js` de 70 para 50 reprova", () => {
    const censo = Object.assign({}, OBRIGATORIAS, { "ci_obrigatorio.test.js": 50 });
    exigeMotivo(julgarInventario(inventarioIntegro(), censo), /PISO REBAIXADO: `ci_obrigatorio/, "piso caiu em silêncio");
  });

  await t.test("INV-10: `gate_vip.test.js` de 58 para 1 reprova", () => {
    const censo = Object.assign({}, OBRIGATORIAS, { "gate_vip.test.js": 1 });
    exigeMotivo(julgarInventario(inventarioIntegro(), censo), /PISO REBAIXADO: `gate_vip/, "piso caiu em silêncio");
  });

  await t.test("INV-11: piso removido do censo reprova", () => {
    const censo = Object.assign({}, OBRIGATORIAS);
    delete censo["descoberta.test.js"];
    exigeMotivo(julgarInventario(inventarioIntegro(), censo), /PISO REMOVIDO: `descoberta/, "suíte ficou sem piso");
  });

  await t.test("INV-12: piso que deixa de ser inteiro reprova", () => {
    const censo = Object.assign({}, OBRIGATORIAS, { "chat_contrato.test.js": "dez" });
    exigeMotivo(julgarInventario(inventarioIntegro(), censo), /PISO INVÁLIDO/, "piso não numérico passou");
  });

  await t.test("INV-13: censo ilegível reprova em bloco", () => {
    exigeMotivo(julgarInventario(inventarioIntegro(), null), /CENSO ILEGÍVEL/, "sem declaração não há o que conferir");
  });

  await t.test("INV-15: a suíte da AUTORIDADE DO ARTEFATO é cobrada por piso e por NOME", () => {
    // A composição desta OS junta duas famílias, e a que veio de fora não
    // conhecia `artefato_unico.test.js`. Se a entrada dela cair de qualquer
    // uma das três listas, a autoridade que decide o que pode ser implantado
    // volta a ser exercitável por uma isca de corpos triviais.
    assert.ok(
      Object.prototype.hasOwnProperty.call(MINIMO_EXECUTADO, "artefato_unico.test.js"),
      "`artefato_unico.test.js` saiu do piso EXECUTADO"
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(MINIMO_DECLARADO_NO_CENSO, "artefato_unico.test.js"),
      "`artefato_unico.test.js` saiu do piso DECLARADO externo"
    );
    const nomes = NOMES_OBRIGATORIOS["artefato_unico.test.js"] || [];
    assert.ok(nomes.length >= 9, "os nomes obrigatórios do artefato encolheram para " + nomes.length);

    // E o julgamento REPROVA quando um deles não executa — declarar não basta.
    const inv = inventarioIntegro();
    const r = inv.porArquivo.get("artefato_unico.test.js");
    r.nomes = r.nomes.filter((n) => !n.startsWith("ART-05"));
    r.nomes.push("preenchimento");
    exigeMotivo(
      julgarInventario(inv, OBRIGATORIAS),
      /CASO NOMINAL AUSENTE: `ART-05`/,
      "a âncora histórica do conjunto produtivo sumiu e o inventário aceitou"
    );
  });

  await t.test("INV-14: subir o piso do censo continua livre", () => {
    // Piso é chão, não teto. Uma guarda que reprovasse o aumento empurraria
    // todo mundo a mexer nos mínimos externos por engano.
    const censo = Object.assign({}, OBRIGATORIAS, { "gate_vip.test.js": 999 });
    assert.deepEqual(julgarInventario(inventarioIntegro(), censo), []);
  });
});
