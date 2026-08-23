#!/usr/bin/env node
// ferramentas/relator-de-atribuicao.js — QUEM EXECUTOU CADA PROVA.
//
// POR QUE ESTA PECA EXISTE. A OS 23.1-P-R2 mediu o escape `FORJA-01`: o portao
// juntava os identificadores aprovados num conjunto PLANO, de todos os arquivos
// de uma vez, e depois perguntava apenas "o `C-01` esta ai?". A pergunta certa
// nunca foi essa. A pergunta certa e "o `C-01` passou NO ARQUIVO QUE O CONTRATO
// MANDA PROVA-LO?".
//
// A diferenca entre as duas custou um FAIL inteiro: bastou reduzir
// `test/produtor_v2.test.js` a uma casca — os 61 `test("<ID>: …")` dentro de um
// `if (false)` — e acrescentar um `test/zz_falso.test.js` NAO REGISTRADO com os
// mesmos 61 identificadores vazios. O portao imprimia
// `test/produtor_v2.test.js: 61/61 casos obrigatorios aprovados` sobre um
// arquivo que executou ZERO. Nenhuma ferramenta tinha sido tocada.
//
// POR QUE UM RELATOR, E NAO UMA LEITURA MAIS ESPERTA DO TAP. O relatorio TAP do
// `node --test` NAO CARREGA a origem: quando um arquivo declara `describe`/`test`
// no topo, o executor ica os blocos para o nivel raiz do relatorio e o nome do
// arquivo simplesmente nao aparece. So o arquivo VAZIO — o que nao declara caso
// nenhum — vira uma linha com nome de arquivo. Nao ha, no TAP, o que atribuir.
//
// A stream de eventos do executor, essa sim, carrega `file` em cada `test:pass`
// e `test:fail`. E dela que sai a atribuicao, e este relator existe para
// escreve-la num formato que o portao possa cobrar. O TAP continua sendo emitido
// em paralelo, no mesmo processo, e a contabilidade da C2 continua lendo o TAP
// palavra por palavra: nada do que ela afirma passa a depender daqui.
//
// FORMATO. Uma linha JSON por evento, e nada mais:
//
//   {"r":"passou","tipo":"caso","arquivo":"test/produtor_v2.test.js",
//    "nome":"C-01: …","pulado":false,"todo":false,"aninhamento":1}
//
//   r           `passou` | `reprovou`
//   tipo        `caso` (um `test`) | `bloco` (um `describe`)
//   arquivo     caminho relativo a raiz do repositorio, com barra normal
//   pulado/todo diretivas TAP: viajam como aprovacao e NAO sao aprovacao
//
// ESTE ARQUIVO NAO RODA SOZINHO. Ele e carregado pelo executor de testes como
// `--test-reporter`. Mesmo assim tem um executor proprio, que so sabe recusar:
// a sonda de alcance da guarda spawna TODA peca de `ferramentas/` com um
// argumento invalido e exige recusa explicita. Uma peca muda — porque perdeu o
// `if (require.main === module)`, ou porque teve o `main()` esvaziado — e uma
// peca que ninguem consegue provar que ainda executa.
"use strict";

const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");

const BARRA_INVERTIDA = /[\\]/g;

/** Caminho relativo a raiz, com barras normais. Fora da raiz devolve o
 *  caminho como veio: mentir "e daqui" seria pior que dizer "e de fora". */
function caminhoRelativo(arquivo) {
  if (arquivo === undefined || arquivo === null || arquivo === "") return null;
  const bruto = String(arquivo);
  let rel;
  try {
    rel = path.relative(RAIZ, bruto);
  } catch (_) {
    return bruto.replace(BARRA_INVERTIDA, "/");
  }
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return bruto.replace(BARRA_INVERTIDA, "/");
  }
  return rel.replace(BARRA_INVERTIDA, "/");
}

/** Uma diretiva de `skip`/`todo` pode chegar como `true` ou como o texto do
 *  motivo. As duas formas significam "nao executou como prova". */
const diretiva = (v) => v === true || (typeof v === "string" && v !== "");

async function* relatorDeAtribuicao(fonte) {
  for await (const evento of fonte) {
    if (evento.type !== "test:pass" && evento.type !== "test:fail") continue;
    const d = evento.data || {};
    const detalhes = d.details || {};
    yield JSON.stringify({
      r: evento.type === "test:pass" ? "passou" : "reprovou",
      tipo: detalhes.type === "suite" ? "bloco" : "caso",
      arquivo: caminhoRelativo(d.file),
      nome: d.name === undefined || d.name === null ? "" : String(d.name),
      pulado: diretiva(d.skip),
      todo: diretiva(d.todo),
      aninhamento: Number.isInteger(d.nesting) ? d.nesting : null,
    }) + "\n";
  }
}

module.exports = relatorDeAtribuicao;
module.exports.caminhoRelativo = caminhoRelativo;
module.exports.relatorDeAtribuicao = relatorDeAtribuicao;

// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  console.error(
    "\n=== RELATOR DE ATRIBUICAO: REPROVADO ===\n\n" +
    "  [ARGUMENTO_INESPERADO] " +
    (args.length ? "argumento nao reconhecido: " + JSON.stringify(args) : "sem argumento") + "\n" +
    "      Este relator nao roda sozinho: ele e carregado pelo executor de testes\n" +
    "      como `--test-reporter`. Executa-lo a mao nao produz atribuicao nenhuma.\n"
  );
  process.exit(2);
}

if (require.main === module) main();
