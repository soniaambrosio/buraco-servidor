// test/gate_sobrevivencia.test.js — A METADE DE DENTRO DA GUARDA.
//
// `ferramentas/gate-de-provas.js` confere que as suites obrigatorias existem,
// alcancam o comando oficial e batem com o contrato versionado. Mas ela tem um
// ponto cego estrutural, e ele nao se resolve escrevendo mais codigo la dentro:
//
//   se ninguem a CHAMA, ela nao roda, e nao rodar da verde.
//
// Esta suite fecha essa metade. Ela vive DENTRO do glob de `node --test`, entao
// roda pelo mesmo caminho que roda todo o resto, e afirma que o `package.json`
// continua chamando a guarda — e que a guarda e o contrato continuam existindo.
//
// AS DUAS SE APOIAM EM DIRECOES OPOSTAS:
//
//   apagar `produtor_v2.test.js`  -> a guarda externa acende
//   tirar a guarda do `npm test`  -> esta suite acende
//   apagar esta suite             -> a guarda externa acende (ela tambem e obrigatoria)
//
// Nao existe protecao absoluta contra alguem apagar tudo de uma vez, e a OS nao
// pede isso. O que existe e que qualquer remocao PARCIAL acende alguma coisa, e
// a remocao total vira um diff grande e deliberado, que e exatamente o que a
// campanha de sabotagem torna visivel.

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const RAIZ = path.resolve(__dirname, "..");
const PKG = path.join(RAIZ, "package.json");
const GUARDA = path.join(RAIZ, "ferramentas", "gate-de-provas.js");
const CONTRATO = path.join(RAIZ, "ferramentas", "contrato-de-provas.json");

const pacote = () => JSON.parse(fs.readFileSync(PKG, "utf8"));
const contrato = () => JSON.parse(fs.readFileSync(CONTRATO, "utf8"));

describe("GATE/SOBREVIVENCIA", () => {
  test("GS-01: a guarda existe no lugar que o contrato aponta", () => {
    assert.ok(fs.existsSync(GUARDA),
      "ferramentas/gate-de-provas.js sumiu — sem ela nada confere as suites obrigatorias");
    assert.ok(fs.existsSync(CONTRATO),
      "ferramentas/contrato-de-provas.json sumiu — a LISTA do que e obrigatorio nao pode evaporar");
  });

  test("GS-02: o comando oficial CHAMA a guarda", () => {
    // O ponto cego que esta suite existe para cobrir. Se alguem trocar o script
    // `test` por um `node --test` seco, a guarda deixa de rodar e o gate volta a
    // ser um glob — que e o defeito que a OS 23.1-P-C1 fecha.
    const script = pacote().scripts.test;
    assert.ok(typeof script === "string" && script.length > 0, "script `test` ausente");
    assert.ok(script.includes("gate-de-provas.js"),
      "o script `test` deixou de chamar a guarda:\n  " + script);
  });

  test("GS-03: a guarda roda ANTES do node --test", () => {
    // A ordem importa: rodar a guarda depois deixaria a suite inteira executar e
    // so no fim diria que faltava prova. Antes, o portao para na hora e a saida
    // nao se confunde com falha de teste.
    const script = pacote().scripts.test;
    const iGuarda = script.indexOf("gate-de-provas.js");
    const iTeste = script.indexOf("--test");
    assert.ok(iGuarda >= 0 && iTeste >= 0, "script incompleto: " + script);
    assert.ok(iGuarda < iTeste,
      "a guarda precisa vir antes do `node --test` no script `test`");
  });

  test("GS-04: a guarda e encadeada com && (falha dela PARA o comando)", () => {
    // `;` deixaria o `node --test` rodar mesmo com a guarda vermelha, e o
    // codigo de saida do npm viria do ultimo comando. `&&` e o que faz a recusa
    // da guarda derrubar o `npm test` inteiro.
    const script = pacote().scripts.test;
    const trecho = script.slice(script.indexOf("gate-de-provas.js"));
    assert.ok(/^[^;]*&&/.test(trecho),
      "a guarda precisa ser encadeada com `&&`, nunca com `;`:\n  " + script);
  });

  test("GS-05: esta suite tambem e obrigatoria no contrato", () => {
    // Sem isto, apagar ESTE arquivo seria a saida silenciosa: a guarda externa
    // nao a exigiria, e o ponto cego voltaria.
    const caminhos = contrato().suitesObrigatorias.map((s) => s.caminho);
    assert.ok(caminhos.includes("test/gate_sobrevivencia.test.js"),
      "o contrato precisa exigir esta propria suite; declarados: " + caminhos.join(", "));
    assert.ok(caminhos.includes("test/produtor_v2.test.js"),
      "e a suite do contrato V2, que e o motivo de tudo isto existir");
  });

  test("GS-06: o contrato de prova e versionado", () => {
    const c = contrato();
    assert.ok(Number.isInteger(c.versaoContratoDeProva),
      "sem versao, uma troca de contrato nao se distingue de um ajuste qualquer");
    assert.ok(c.versaoContratoDeProva >= 1);
  });

  test("GS-07: a guarda REPROVA quando uma suite obrigatoria some", () => {
    // Prova comportamental, e nao leitura de codigo: roda a guarda de verdade
    // contra um contrato que aponta para um arquivo inexistente, e confere que
    // ela sai diferente de zero. Sem isto, "a guarda existe" nao diria nada
    // sobre a guarda FUNCIONAR.
    const contratoQuebrado = {
      versaoContratoDeProva: 1,
      suitesObrigatorias: [
        { id: "inexistente", caminho: "test/nao_existe_de_proposito.test.js", pisoDeCasos: 1 },
      ],
      comandoOficial: { script: "test", invocacaoDaGuarda: "ferramentas/gate-de-provas.js" },
    };
    const temp = path.join(RAIZ, "ferramentas", ".contrato-de-provas.prova.json");
    const original = fs.readFileSync(CONTRATO, "utf8");
    let saiuComErro = false;
    let saida = "";
    try {
      fs.writeFileSync(temp, original, "utf8");                       // guarda o real
      fs.writeFileSync(CONTRATO, JSON.stringify(contratoQuebrado), "utf8");
      try {
        execFileSync(process.execPath, [GUARDA], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        saiuComErro = true;
        saida = String((e.stdout || "") + (e.stderr || ""));
      }
    } finally {
      fs.writeFileSync(CONTRATO, original, "utf8");                   // RESTAURA sempre
      try { fs.unlinkSync(temp); } catch (_) {}
    }
    assert.ok(saiuComErro, "a guarda precisa sair != 0 quando uma suite obrigatoria falta");
    assert.match(saida, /SUITE_AUSENTE/, "e precisa dizer POR QUE, com codigo estavel");
  });

  test("GS-08: a guarda APROVA a arvore intacta", () => {
    // O controle. Sem ele, uma guarda que reprovasse sempre passaria em GS-07 e
    // seria desligada no primeiro dia util.
    const saida = execFileSync(process.execPath, [GUARDA], { encoding: "utf8" });
    assert.match(saida, /OK/);
  });
});
