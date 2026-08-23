#!/usr/bin/env node
// ferramentas/aferidor.js — A TERCEIRA VOZ: O EXECUTOR FOI MESMO ALCANCADO?
//
// `npm test` e tres scripts, e os tres sao garantidos pelo PROPRIO npm, nao por
// operador de shell:
//
//   pretest    node ferramentas/gate-de-provas.js   as provas estao integras?
//   test       node ferramentas/portao.js           elas rodaram, e passaram?
//   posttest   node ferramentas/aferidor.js         o portao REALMENTE rodou?
//
// POR QUE O TERCEIRO. A OS 23.1-P-R2 mediu o escape `FER-02`: tornar
// inalcancavel a linha final do `portao.js` — a que chama `main()` quando ele e
// o modulo principal — e atualizar a linha de digest no contrato. O `npm test`
// saia com codigo ZERO, sem marcador e sem veredito — porque nao havia depois do
// portao para notar que ele nao tinha falado. Um arquivo nao pode ser a
// autoridade sobre a propria execucao; o `pretest` cobre o que vem ANTES do
// portao, e faltava quem cobrisse o DEPOIS.
//
// A pergunta deste arquivo e uma so, e ela NAO e "o portao aprovou?": e "existe
// prova selada de que a execucao aconteceu, e ela descreve o que o contrato
// exige?". Um portao que nao roda nao deixa prova nenhuma, e ausencia de prova
// e reprovacao — nunca silencio.
//
// O APERTO DE MAO, e por que ele nao aceita sobra. O `pretest` apaga o marcador
// antigo e emite um DESAFIO: um nonce novo, em disco, valido por uma janela
// curta. O portao le o desafio, executa a suite e sela o marcador com um HMAC
// chaveado por esse nonce. O aferidor rele os dois e confere o selo. Entao:
//
//   portao nao rodou             -> nao ha marcador               -> vermelho
//   marcador de ontem            -> selo nao bate com o desafio    -> vermelho
//   marcador escrito a mao       -> selo nao bate                  -> vermelho
//   marcador que nao fecha conta -> divergencia contra o contrato  -> vermelho
//
// E O QUE ELE LE ALEM DO VEREDITO. O aferidor nao acredita no resumo: ele abre
// tambem a ATRIBUICAO crua que o relator escreveu durante a execucao, confere
// que o digest dela bate com o que o marcador jurou, e reconta, linha a linha,
// se cada caso obrigatorio passou NO ARQUIVO que o contrato manda prova-lo. E a
// mesma conta do portao, feita de novo por outro processo, sobre a evidencia e
// nao sobre o resumo.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const guarda = require("./gate-de-provas.js");

const RAIZ = guarda.RAIZ;

/** Janela do desafio. Curta o bastante para que um desafio esquecido nao vire
 *  passe livre, larga o bastante para uma suite lenta caber inteira. */
const JANELA_DO_DESAFIO_MS = 60 * 60 * 1000;

function morrer(codigo, titulo, linhas) {
  console.error("\n=== AFERIDOR: REPROVADO ===\n");
  console.error(`  [${codigo}] ${titulo}`);
  for (const l of linhas || []) console.error("      " + l);
  console.error("");
  process.exit(1);
}

// ---------------------------------------------------------------------------
function main() {
  // Argv estrito, pela mesma razao das outras duas pecas: com `;` o `cmd.exe`
  // entrega o resto do script como argumento em vez de executa-lo. E e por esta
  // recusa que a sonda de alcance reconhece que este executor ainda responde.
  const args = process.argv.slice(2);
  if (args.length > 0) {
    morrer("ARGUMENTO_INESPERADO", "o aferidor nao aceita argumentos: " + JSON.stringify(args), [
      "Se isto veio de um script encadeado com `;`, esse e exatamente o defeito que",
      "a OS 23.1-P-C2 fecha: o `cmd.exe` entrega o `;` como argumento e o comando",
      "seguinte nunca roda.",
    ]);
  }

  // --- 1 INTEGRIDADE, DEPOIS DA EXECUCAO -----------------------------------
  // A guarda ja rodou no `pretest`. Aqui ela roda de novo de proposito: o que
  // interessa agora e o estado das ferramentas DEPOIS da suite, e a sonda de
  // alcance de cada executor com a arvore ja no fim do caminho.
  const { falhas, contrato } = guarda.conferir();
  if (falhas.length > 0) {
    guarda.relatar(falhas);
    process.exit(1);
  }

  // --- 2 O DESAFIO EMITIDO PELO `pretest` ----------------------------------
  if (!fs.existsSync(guarda.DESAFIO)) {
    morrer("DESAFIO_AUSENTE", "nao ha desafio desta execucao para conferir", [
      "O desafio nasce no `pretest` e e consumido aqui. Sem ele nao ha como",
      "distinguir o marcador desta execucao de uma sobra de outra.",
      "Rode o comando oficial inteiro: npm test",
    ]);
  }
  let desafio;
  try {
    desafio = JSON.parse(fs.readFileSync(guarda.DESAFIO, "utf8"));
  } catch (e) {
    morrer("DESAFIO_ILEGIVEL", "o desafio desta execucao nao pode ser lido", [e.message]);
  }
  if (!desafio || typeof desafio.nonce !== "string" || !/^[0-9a-f]{48,}$/i.test(desafio.nonce)) {
    morrer("DESAFIO_MAL_FORMADO", "o desafio nao carrega um nonce utilizavel", []);
  }
  const idadeMs = Date.now() - Number(desafio.emitidoEm);
  if (!Number.isFinite(idadeMs) || idadeMs < -60000 || idadeMs > JANELA_DO_DESAFIO_MS) {
    morrer("DESAFIO_EXPIRADO", `o desafio nao e desta execucao (idade ${Math.round(idadeMs / 1000)}s)`, [
      "Um desafio antigo reaproveitado transformaria uma execucao de ontem em",
      "aprovacao de hoje. Rode o comando oficial inteiro: npm test",
    ]);
  }

  // --- 3 A PROVA DE QUE O PORTAO FALOU -------------------------------------
  // O coracao do escape FER-02: um portao neutralizado sai com codigo zero e
  // nao deixa marcador. Ausencia de marcador NAO e silencio, e reprovacao.
  if (!fs.existsSync(guarda.MARCADOR)) {
    morrer("EXECUCAO_NAO_ACONTECEU",
      "o `test` terminou sem deixar marcador: o portao nao executou nada", [
        "O script `test` saiu com codigo zero e nao produziu veredito nenhum.",
        "E o desenho do escape FER-02: a chamada final de `main()` no `portao.js`",
        "tornada inalcancavel, com o digest do contrato realinhado.",
        "Codigo de saida zero nao e aprovacao — aprovacao e prova selada.",
      ]);
  }
  let marcador;
  try {
    marcador = JSON.parse(fs.readFileSync(guarda.MARCADOR, "utf8"));
  } catch (e) {
    morrer("MARCADOR_ILEGIVEL", "o marcador da execucao nao pode ser lido", [e.message]);
  }
  const carga = marcador && marcador.carga;
  if (!carga || typeof carga !== "object") {
    morrer("MARCADOR_MAL_FORMADO", "o marcador nao carrega a carga da execucao", []);
  }
  if (typeof marcador.seloDeDesafio !== "string" ||
      marcador.seloDeDesafio !== guarda.selarCom(carga, desafio.nonce)) {
    morrer("SELO_DE_DESAFIO_NAO_CONFERE",
      "o marcador nao foi selado pelo desafio desta execucao", [
        "O selo e um HMAC das contagens chaveado pelo nonce que o `pretest` emitiu.",
        "Marcador de outra execucao, ou escrito a mao, nao passa daqui.",
      ]);
  }
  if (carga.desafio !== guarda.sha256(desafio.nonce)) {
    morrer("MARCADOR_DE_OUTRO_DESAFIO", "o marcador aponta para outro desafio", []);
  }

  // --- 4 O MARCADOR DESCREVE O QUE O CONTRATO EXIGE ------------------------
  const execucao = contrato.execucao || {};
  if (carga.contratoVersao !== contrato.versaoContratoDeProva) {
    morrer("MARCADOR_DE_OUTRO_CONTRATO",
      `o marcador e da versao ${carga.contratoVersao}, o contrato esta na ${contrato.versaoContratoDeProva}`, []);
  }
  if (carga.digestDoContrato !== guarda.sha256(guarda.lerNormalizado(guarda.CONTRATO))) {
    morrer("CONTRATO_MUDOU_DEPOIS_DA_EXECUCAO",
      "o contrato foi alterado entre a execucao e a aferição", [
        "Trocar a lista do que e obrigatorio DEPOIS de rodar a suite aprovaria",
        "uma exigencia que nunca foi medida.",
      ]);
  }
  if (carga.falhas !== 0) {
    morrer("MARCADOR_COM_FALHAS", `o marcador registra ${carga.falhas} falha(s)`, []);
  }
  const minimo = execucao.totalMinimoDeTestes;
  if (!Number.isInteger(minimo) || minimo <= 0) {
    morrer("SEM_TOTAL_MINIMO", "o contrato precisa declarar `execucao.totalMinimoDeTestes` positivo", []);
  }
  if (!Number.isInteger(carga.casosExecutados) || carga.casosExecutados < minimo) {
    morrer("ABAIXO_DO_TOTAL_MINIMO",
      `o marcador registra ${carga.casosExecutados} casos, minimo aprovado ${minimo}`, []);
  }

  // --- 5 A EVIDENCIA CRUA, RECONTADA AQUI ----------------------------------
  // O aferidor nao acredita no resumo do portao. Ele abre a atribuicao que o
  // relator escreveu DURANTE a execucao, confere que e a mesma que o marcador
  // jurou, e refaz a conta por arquivo.
  if (!fs.existsSync(guarda.ATRIBUICAO)) {
    morrer("ATRIBUICAO_AUSENTE",
      "a execucao nao deixou registro de atribuicao", [
        "Sem saber QUAL arquivo executou cada caso, `61/61 aprovados` pode estar",
        "descrevendo um arquivo que executou zero. E o escape FORJA-01.",
      ]);
  }
  const bruto = guarda.lerNormalizado(guarda.ATRIBUICAO);
  if (carga.digestDaAtribuicao !== guarda.sha256(bruto)) {
    morrer("ATRIBUICAO_DIVERGENTE",
      "o registro de atribuicao nao e o que o marcador selou", [
        "O marcador jura um digest; o arquivo em disco tem outro. Uma das duas",
        "coisas foi trocada depois da execucao.",
      ]);
  }
  const porArquivo = new Map();
  let linhaN = 0;
  for (const linha of bruto.split("\n")) {
    linhaN++;
    if (linha.trim() === "") continue;
    let ev;
    try {
      ev = JSON.parse(linha);
    } catch (e) {
      morrer("ATRIBUICAO_ILEGIVEL", `linha ${linhaN} do registro de atribuicao nao e JSON`, [e.message]);
    }
    if (ev.r !== "passou" || ev.tipo !== "caso" || ev.pulado === true || ev.todo === true) continue;
    const arq = typeof ev.arquivo === "string" ? ev.arquivo : "(sem arquivo)";
    if (!porArquivo.has(arq)) porArquivo.set(arq, { nomes: new Set(), ids: new Set() });
    const registro = porArquivo.get(arq);
    registro.nomes.add(String(ev.nome));
    const id = guarda.idDeCaso(String(ev.nome));
    if (id) registro.ids.add(id);
  }

  const forasDeLugar = [];
  const abaixoDoPiso = [];
  for (const s of contrato.suitesObrigatorias || []) {
    const chave = String(s.caminho).replace(/[\\]/g, "/");
    const registro = porArquivo.get(chave) || { nomes: new Set(), ids: new Set() };
    for (const id of s.casosObrigatorios || []) {
      if (!registro.ids.has(id)) forasDeLugar.push(`${s.id}:${id}`);
    }
    if (Number.isInteger(s.pisoDeCasos) && registro.nomes.size < s.pisoDeCasos) {
      abaixoDoPiso.push(`${s.id}: ${registro.nomes.size} casos executados, piso ${s.pisoDeCasos}`);
    }
  }
  if (forasDeLugar.length) {
    morrer("CASO_OBRIGATORIO_FORA_DO_ARQUIVO",
      `${forasDeLugar.length} caso(s) obrigatorio(s) nao passaram no arquivo declarado`, [
        forasDeLugar.slice(0, 10).join(", ") +
          (forasDeLugar.length > 10 ? ` … (+${forasDeLugar.length - 10})` : ""),
        "Outro arquivo pode ter executado um caso com o mesmo identificador —",
        "isso nao prova nada sobre a suite que o contrato protege.",
      ]);
  }
  if (abaixoDoPiso.length) {
    morrer("ABAIXO_DO_PISO_EXECUTADO",
      "uma suite obrigatoria executou menos casos do que o piso declarado", abaixoDoPiso);
  }

  // --- 6 O DESAFIO E DE USO UNICO ------------------------------------------
  // Consumido aqui para que ninguem o reaproveite numa proxima execucao vazia.
  try { fs.unlinkSync(guarda.DESAFIO); } catch (_) {}

  const suites = contrato.suitesObrigatorias || [];
  console.log(
    `[posttest] aferidor: execucao confirmada — ${carga.casosExecutados} casos, ` +
    `${suites.length} suite(s) obrigatoria(s) atribuida(s), selo do desafio confere`
  );
  for (const s of suites) {
    const chave = String(s.caminho).replace(/[\\]/g, "/");
    const registro = porArquivo.get(chave) || { nomes: new Set(), ids: new Set() };
    const exigidos = s.casosObrigatorios || [];
    // O numerador e CONTADO no registro, nao copiado do denominador. Imprimir
    // `61/61` a partir de `exigidos.length` dos dois lados seria uma linha que
    // nunca pode discordar de si mesma — a mesma decoracao que o escape
    // FORJA-01 explorou no portao da C2, onde `61/61 aprovados` descrevia um
    // arquivo que executou zero. Aqui, se divergir, a execucao ja morreu acima;
    // a linha existe para que quem le saiba que a conta foi refeita.
    const atribuidos = exigidos.filter((id) => registro.ids.has(id)).length;
    console.log(
      `      ${chave}: ${registro.nomes.size} casos executados NESTE arquivo, ` +
      `${atribuidos}/${exigidos.length} obrigatorios atribuidos a ele`
    );
  }
  console.log("\nAFERIDOR: EXECUCAO CONFIRMADA (desafio selado + evidencia recontada por arquivo)");
}

module.exports = { JANELA_DO_DESAFIO_MS };

if (require.main === module) main();
