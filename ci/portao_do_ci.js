// ci/portao_do_ci.js — O PORTÃO DO CI EXTERNO, FAIL-CLOSED (OS 54).
//
// POR QUE ELE EXISTE, E POR QUE NÃO É O `npm test`.
//
// Este repositório já tinha um portão bom — `npm test`, 646 casos em 75 suítes.
// O que ele não tinha era OBRIGAÇÃO: rodar dependia de alguém lembrar. Um
// workflow que só chamasse `npm test` transferiria a lembrança para o YAML e
// pararia por aí, porque no Actions há três desfechos e apenas um deles é
// "vermelho": o passo pode ter FALHADO, pode NÃO TER EXECUTADO (comentado,
// removido, desviado para outro alvo, trocado por um `echo`) e pode ter sido
// CANCELADO. Os dois últimos terminam sem marca — e "não rodou" nunca deve
// parecer com "passou".
//
// Este arquivo é quem separa os três. Ele não roda teste nenhum: lê a EVIDÊNCIA
// que a execução oficial deixou e recusa tudo o que não for prova positiva de
// que o alvo canônico rodou inteiro. Ausência é REPROVAÇÃO, nunca silêncio.
//
// O QUE ELE NÃO É. Não é um segundo portão, não tem lista de suítes, não
// conhece assento, ingresso, presença nem chat, e não decide o que testar — o
// alvo continua sendo o glob `test/*.test.js` do `package.json`, e a única
// coisa que este arquivo afirma sobre o alvo é que foi ELE que rodou. Não
// fabrica TAP: a evidência é a saída literal do `npm test`, e sem ela o
// veredito é vermelho, não verde.
//
// Uso:
//   node ci/portao_do_ci.js <saida.txt> <exit.txt> [--raiz <dir>]
//   node ci/portao_do_ci.js --resumo <saida.txt> <exit.txt> [--desfecho X] [--raiz <dir>]

"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** As oito chaves do rodapé do `node --test`. TODAS são obrigatórias.
 *
 *  Rodapé incompleto é evidência incompleta: um `echo` bem-intencionado produz
 *  duas ou três dessas linhas sem esforço, e uma execução truncada no meio
 *  produz zero. Exigir as oito é o que separa "a suíte terminou" de "alguma
 *  coisa escreveu no log". */
const CHAVES_DO_RODAPE = Object.freeze([
  "tests", "suites", "pass", "fail", "cancelled", "skipped", "todo", "duration_ms",
]);

/** O npm ecoa DUAS linhas antes de executar: o script escolhido e o comando
 *  real. São elas que provam qual alvo rodou — e não a nossa palavra sobre ele.
 *
 *  `ECO_DO_SCRIPT` mata `npm run outra-coisa`; `ECO_DO_ALVO` mata o desvio para
 *  uma suíte-isca (`node --test test/isca.test.js`) e mata o `echo`, que não
 *  produz nem um nem outro. */
const ECO_DO_SCRIPT = /^>\s*\S+@\S+\s+test\s*$/m;
const ECO_DO_ALVO = /^>\s*node\s+--test\s+"?test\/\*\.test\.js"?\s*$/m;

/** O rodapé sai em `# chave valor` (reporter tap) ou `i chave valor` (spec).
 *  Qual dos dois aparece depende da versão do Node e de haver terminal, e
 *  nenhuma das duas coisas é decisão desta OS — por isso os dois são lidos. */
function lerRodape(texto) {
  const limpo = String(texto).split("\r\n").join("\n");
  const dados = {};
  for (const chave of CHAVES_DO_RODAPE) {
    const m = new RegExp("^(?:#|ℹ)\\s+" + chave + "\\s+([0-9]+(?:\\.[0-9]+)?)\\s*$", "m").exec(limpo);
    dados[chave] = m ? Number(m[1]) : null;
  }
  return dados;
}

function lerArquivo(caminho) {
  try {
    return fs.readFileSync(caminho, "utf8");
  } catch (e) {
    return null;
  }
}

function lerPiso(raiz) {
  const bruto = lerArquivo(path.join(raiz, "ci", "piso_do_portao.json"));
  if (bruto === null) return null;
  try {
    const p = JSON.parse(bruto);
    if (!Number.isInteger(p.casos_minimos) || !Number.isInteger(p.suites_minimas)) return null;
    if (p.casos_minimos <= 0 || p.suites_minimas <= 0) return null;
    return p;
  } catch (e) {
    return null;
  }
}

/** O veredito. Devolve a lista de reprovações — vazia significa VERDE.
 *
 *  Toda ausência entra aqui como reprovação com nome próprio, porque o laudo
 *  precisa distinguir "a suíte falhou" de "a suíte não rodou": são defeitos
 *  diferentes, com donos diferentes. */
function conferir(opcoes) {
  const raiz = opcoes.raiz;
  const reprovacoes = [];
  const dados = { rodape: null, saida: null, exit: null, piso: null };

  const piso = lerPiso(raiz);
  if (piso === null) {
    reprovacoes.push(
      "PISO AUSENTE OU ILEGÍVEL: `ci/piso_do_portao.json` não existe, não é JSON " +
      "válido ou não declara `casos_minimos`/`suites_minimas` como inteiros positivos. " +
      "Sem piso não há como afirmar que nada encolheu, e portão que não afirma nada é verde decorativo."
    );
    return { reprovacoes, dados };
  }
  dados.piso = piso;

  // --- o alvo declarado na FONTE ainda é o glob canônico --------------------
  const bruto = lerArquivo(path.join(raiz, "package.json"));
  let pkg = null;
  try {
    pkg = bruto === null ? null : JSON.parse(bruto);
  } catch (e) {
    pkg = null;
  }
  if (pkg === null || !pkg.scripts || typeof pkg.scripts.test !== "string") {
    reprovacoes.push("`package.json` ausente, ilegível ou sem `scripts.test` — o alvo oficial sumiu da fonte.");
  } else if (!/--test\s+"?test\/\*\.test\.js"?/.test(pkg.scripts.test)) {
    reprovacoes.push(
      "O ALVO OFICIAL FOI DESVIADO NA FONTE: `scripts.test` deixou de varrer " +
      "`test/*.test.js` (está `" + pkg.scripts.test + "`). Glob trocado por lista é " +
      "como uma suíte inteira sai do portão sem ninguém notar."
    );
  }

  // --- a EXECUÇÃO deixou marca? --------------------------------------------
  const saida = lerArquivo(opcoes.arquivoSaida);
  if (saida === null) {
    reprovacoes.push(
      "NÃO EXECUTADO: a evidência `" + opcoes.arquivoSaida + "` não existe. O passo " +
      "das provas não rodou, foi removido, comentado ou terminou antes de escrever. " +
      "Ausência de evidência é REPROVAÇÃO — nunca aprovação por silêncio."
    );
  } else {
    dados.saida = saida;
  }

  const exitBruto = lerArquivo(opcoes.arquivoExit);
  if (exitBruto === null || exitBruto.trim() === "") {
    reprovacoes.push(
      "MARCADOR DE DESFECHO AUSENTE OU VAZIO (`" + opcoes.arquivoExit + "`): a execução " +
      "terminou sem registrar o próprio código de saída — cancelamento, estouro de " +
      "tempo ou passo interrompido. Indistinguível de sucesso, logo REPROVADO."
    );
  } else if (!/^-?[0-9]+$/.test(exitBruto.trim())) {
    reprovacoes.push("MARCADOR DE DESFECHO ILEGÍVEL: `" + exitBruto.trim() + "` não é um código de saída.");
  } else {
    dados.exit = Number(exitBruto.trim());
    if (dados.exit !== 0) {
      reprovacoes.push("O COMANDO OFICIAL FALHOU: `npm test` saiu com código " + dados.exit + ".");
    }
  }

  if (saida === null) return { reprovacoes, dados };

  // --- foi o ALVO OFICIAL que rodou, e não um substituto -------------------
  const limpo = saida.split("\r\n").join("\n");
  if (!ECO_DO_SCRIPT.test(limpo)) {
    reprovacoes.push(
      "ALVO NÃO COMPROVADO: a evidência não traz o eco do script `test` do npm. " +
      "Ou o comando executado não foi `npm test`, ou a saída não é dele."
    );
  }
  if (!ECO_DO_ALVO.test(limpo)) {
    reprovacoes.push(
      "ALVO DESVIADO OU SUBSTITUÍDO: a evidência não traz `node --test \"test/*.test.js\"`. " +
      "Um `echo`, um `|| true` que engoliu a execução, ou um desvio para arquivo-isca " +
      "produzem exatamente esta ausência."
    );
  }

  // --- o rodapé, inteiro ---------------------------------------------------
  const rodape = lerRodape(saida);
  dados.rodape = rodape;
  const faltando = CHAVES_DO_RODAPE.filter((k) => rodape[k] === null);
  if (faltando.length > 0) {
    reprovacoes.push(
      "EXECUÇÃO SEM MARCADOR VÁLIDO: o rodapé do `node --test` está incompleto " +
      "(faltam: " + faltando.join(", ") + "). Suíte interrompida, cancelada ou saída forjada."
    );
    return { reprovacoes, dados };
  }

  if (!(rodape.duration_ms > 0)) {
    reprovacoes.push("DURAÇÃO ZERO: nenhuma execução da suíte inteira leva 0 ms — a evidência não é de uma corrida real.");
  }

  const soma = rodape.pass + rodape.fail + rodape.cancelled + rodape.skipped;
  if (soma !== rodape.tests) {
    reprovacoes.push(
      "EVIDÊNCIA INCONSISTENTE: pass+fail+cancelled+skipped = " + soma +
      ", mas o rodapé declara tests " + rodape.tests + "."
    );
  }
  if (rodape.fail > 0) reprovacoes.push("SUÍTE VERMELHA: " + rodape.fail + " caso(s) falharam.");
  if (rodape.cancelled > 0) {
    reprovacoes.push(
      "EXECUÇÃO CANCELADA: " + rodape.cancelled + " caso(s) cancelados — o portão " +
      "não trata interrupção como aprovação."
    );
  }

  // --- e nada encolheu -----------------------------------------------------
  //
  // O piso é conferido contra `pass`, e não contra `tests`, de propósito: caso
  // marcado como `skipped` continua contando em `tests` e some de `pass`, então
  // trivializar a suíte por `skip` derruba o piso em vez de passar por ela.
  if (rodape.pass < piso.casos_minimos) {
    reprovacoes.push(
      "CASOS ENCOLHERAM: " + rodape.pass + " aprovados, abaixo do piso " + piso.casos_minimos +
      " — suíte removida, esvaziada, desviada ou trivializada por `skip`."
    );
  }
  if (rodape.suites < piso.suites_minimas) {
    reprovacoes.push(
      "SUÍTES ENCOLHERAM: " + rodape.suites + " suítes, abaixo do piso " + piso.suites_minimas + "."
    );
  }

  return { reprovacoes, dados };
}

/** O resumo para o painel do Actions. Escreve o que houve — inclusive quando
 *  não houve nada, que é o caso que mais precisa aparecer. */
function resumo(veredito, desfecho) {
  const d = veredito.dados;
  const r = d.rodape;
  const valor = (chave) => (r && r[chave] !== null && r[chave] !== undefined ? String(r[chave]) : "**sem marcador**");
  const linhas = [];
  linhas.push("## Provas do servidor — portão fail-closed");
  linhas.push("");
  linhas.push("| item | valor |");
  linhas.push("| --- | --- |");
  linhas.push("| desfecho do job | " + (desfecho || "(não informado)") + " |");
  linhas.push("| alvo oficial | `npm test` -> `node --test \"test/*.test.js\"` |");
  linhas.push("| código de saída | " + (d.exit === null ? "**AUSENTE (não executado / cancelado)**" : "`" + d.exit + "`") + " |");
  linhas.push("| suítes | " + valor("suites") + (d.piso ? " (piso " + d.piso.suites_minimas + ")" : "") + " |");
  linhas.push("| casos aprovados | " + valor("pass") + (d.piso ? " (piso " + d.piso.casos_minimos + ")" : "") + " |");
  linhas.push("| casos declarados | " + valor("tests") + " |");
  linhas.push("| falhas | " + valor("fail") + " |");
  linhas.push("| cancelados | " + valor("cancelled") + " |");
  linhas.push("| pulados | " + valor("skipped") + " |");
  linhas.push("| duração | " + (r && r.duration_ms !== null ? r.duration_ms + " ms" : "**sem marcador**") + " |");
  linhas.push("");
  if (veredito.reprovacoes.length === 0) {
    linhas.push("**VERDE** — o alvo oficial rodou inteiro e nada encolheu.");
  } else {
    linhas.push("**VERMELHO** — " + veredito.reprovacoes.length + " reprovação(ões):");
    linhas.push("");
    for (const m of veredito.reprovacoes) linhas.push("- " + m);
  }
  return linhas.join("\n");
}

function principal(argv) {
  const args = argv.slice();
  const modoResumo = args.includes("--resumo");
  let raiz = path.join(__dirname, "..");
  let desfecho = null;

  const posicionais = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--resumo") continue;
    if (args[i] === "--raiz") { raiz = args[++i]; continue; }
    if (args[i] === "--desfecho") { desfecho = args[++i]; continue; }
    posicionais.push(args[i]);
  }

  const veredito = conferir({
    raiz,
    arquivoSaida: posicionais[0] || path.join(raiz, "evidencia", "npm-test.txt"),
    arquivoExit: posicionais[1] || path.join(raiz, "evidencia", "exit.txt"),
  });

  if (modoResumo) {
    process.stdout.write(resumo(veredito, desfecho) + "\n");
    return 0;
  }

  if (veredito.reprovacoes.length === 0) {
    const r = veredito.dados.rodape;
    process.stdout.write(
      "PORTÃO VERDE — npm test executado: " + r.pass + " casos aprovados em " + r.suites +
      " suítes (piso " + veredito.dados.piso.casos_minimos + "/" + veredito.dados.piso.suites_minimas +
      "), 0 falhas, 0 cancelados, " + r.duration_ms + " ms.\n"
    );
    return 0;
  }

  process.stdout.write("PORTÃO VERMELHO — " + veredito.reprovacoes.length + " reprovação(ões):\n");
  for (const m of veredito.reprovacoes) process.stdout.write("  * " + m + "\n");
  return 1;
}

module.exports = {
  CHAVES_DO_RODAPE, ECO_DO_SCRIPT, ECO_DO_ALVO,
  lerRodape, lerPiso, conferir, resumo, principal,
};

if (require.main === module) process.exit(principal(process.argv.slice(2)));
