// test/censo_de_suites.js — O CENSO DAS SUÍTES OBRIGATÓRIAS.
//
// POR QUE ISTO É UM MÓDULO, E NÃO UM CASO DENTRO DE UMA SUÍTE.
//
// O único portão deste repositório é `npm test`, e ele é um GLOB
// (`test/*.test.js`). Glob não tem manifesto: apagar um arquivo de suíte, ou
// renomeá-lo para fora do padrão, faz os casos dele pararem de rodar e o portão
// continuar VERDE. Numa composição isso é o risco número um — o §10.1 da OS 44
// exige que nenhum caso desapareça, e sem guarda "não desapareceu" é uma
// afirmação que ninguém verifica.
//
// A primeira versão desta guarda era um caso dentro de
// `costura_assento_descoberta.test.js`, e a campanha de mutação a derrubou na
// hora: tirar ESSA suíte do glob levava a guarda junto, e a sabotagem ficava
// verde. Guarda que não sobrevive à própria remoção não é guarda.
//
// A saída é a RECIPROCIDADE. O censo mora aqui, fora do glob, e é chamado pelas
// TRÊS suítes que ele protege — as duas entradas da composição e a costura.
// Assim, tirar qualquer UMA delas deixa as outras duas vermelhas, e o arquivo
// que sumiu é nomeado na mensagem. Tirar este módulo também é vermelho: as três
// deixam de carregar.
//
// O QUE ISTO NÃO É. Não é um segundo manifesto, um segundo agregador nem um
// porteiro concorrente — o §12 proíbe os três, e não há um primeiro para este
// ser o segundo. É uma asserção compartilhada, chamada de dentro do portão que
// já existe, na mesma disciplina estrutural do GATE-09. O manifesto de verdade,
// com digest de ferramenta e piso por arquivo, vive na família OS 23.1-P — que
// não é ancestral desta linhagem e não tem PASS final. Importá-lo seria trazer
// autoridade não arbitrada, e o §12 manda registrar a dívida em vez disso.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

/** PISO por arquivo, nunca contagem exata.
 *
 *  Contagem exata vira manutenção, e manutenção de número vira "ajustar o
 *  número" — que é como um caso apagado volta a passar. O piso só se move para
 *  baixo por decisão explícita, e mover para baixo é o que a revisão vê.
 *
 *  Os valores foram MEDIDOS com o contador abaixo, nunca escritos de cabeça.
 *  Medidos em 2026-08-23: assento 29 · descoberta 97 · chat_transporte 31 ·
 *  chat_contrato 11 · controlador 27 · gate_vip 64 · costura 12. */
const OBRIGATORIAS = Object.freeze({
  "assento_autoritativo.test.js": 25,        // OS 41 — escolha autoritativa de assento
  "descoberta.test.js": 90,                  // OS 38.1 — descoberta e presença
  "costura_assento_descoberta.test.js": 10,  // OS 44 — a costura entre as duas
  "chat_transporte.test.js": 28,             // Comunicação Controlada (ff3ddbe)
  "chat_contrato.test.js": 10,
  "controlador_assento.test.js": 24,
  "gate_vip.test.js": 58,
});

/** Conta casos, INCLUINDO subtestes.
 *
 *  `\btest\s*\(` casa tanto `test(` quanto `t.test(`, que é como a suíte da
 *  descoberta declara os 97 casos dela. Um contador que exigisse `test(` no
 *  início da expressão devolveria 10 para um arquivo cheio — e piso satisfeito
 *  por engano é pior que piso nenhum: afirma cobertura que não mediu. Custou
 *  uma volta descobrir isso. */
function contarCasos(texto) {
  return (texto.match(/\btest\s*\(/g) || []).length;
}

/** Reprova se alguma suíte obrigatória sumiu, saiu do glob ou esvaziou. */
function conferirCenso(dir) {
  const raiz = dir || __dirname;
  const presentes = fs.readdirSync(raiz).filter((f) => f.endsWith(".test.js"));

  for (const [arquivo, piso] of Object.entries(OBRIGATORIAS)) {
    assert.ok(
      presentes.includes(arquivo),
      "suíte obrigatória sumiu ou foi renomeada para fora do glob: " + arquivo
    );
    const casos = contarCasos(fs.readFileSync(path.join(raiz, arquivo), "utf8"));
    assert.ok(
      casos >= piso,
      arquivo + " caiu para " + casos + " casos, abaixo do piso " + piso +
        " — suíte esvaziada ou substituída por corpo trivial"
    );
  }

  // E o alvo do portão continua sendo o GLOB, não uma lista que possa ser
  // desviada para uma suíte-isca.
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "..", "package.json"), "utf8"));
  assert.match(
    pkg.scripts.test,
    /--test\s+"?test\/\*\.test\.js"?/,
    "o comando oficial deixou de varrer test/*.test.js"
  );
}

module.exports = { OBRIGATORIAS, contarCasos, conferirCenso };
