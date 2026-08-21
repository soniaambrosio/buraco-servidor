#!/usr/bin/env node
// ferramentas/gate-de-provas.js — A GUARDA DE INTEGRIDADE DAS PROVAS.
//
// Esta e a metade ESTATICA do portao: ela responde "as provas obrigatorias
// existem, estao registradas e nao foram adulteradas?". Ela NAO responde "as
// provas rodaram" — essa e a metade dinamica, e mora em `portao.js`.
//
// A separacao nao e estetica. A OS 23.1-P-R1 mediu o custo de confundir as
// duas: a versao anterior imprimia "OK" depois de conferir arquivos, e um
// operador de shell trocado (`;` no lugar de `&&`) fazia o `node --test` nunca
// rodar. A mensagem de sucesso da conferencia estatica era lida como aprovacao
// da suite. Agora esta guarda nunca e a ultima a falar: quem imprime o veredito
// e o `portao.js`, depois de contar os testes que de fato terminaram.
//
// O QUE MUDOU NA C2, e por que:
//
//   1. CAMPOS OBRIGATORIOS POR SUITE. Antes, digest/piso/blocos eram opcionais
//      (`if (s.digestSha256 && ...)`). Apagar os tres da entrada — mantendo o
//      caminho — reduzia a protecao a "existe um arquivo com esse nome", e a
//      suite podia virar `test("irrelevante")` com o portao verde. Agora a
//      ausencia de qualquer campo declarado em `camposObrigatoriosPorSuite` e
//      ela propria uma reprovacao.
//   2. COMANDO OFICIAL EXATO. Antes se conferia "a string da guarda aparece no
//      script". Agora o script tem de ser IDENTICO ao declarado no contrato.
//      Nao ha mais encadeamento no comando oficial, entao nao ha operador de
//      encadeamento para subverter — e qualquer tentativa de reintroduzir um
//      vira `COMANDO_OFICIAL_DIVERGENTE`.
//   3. AS FERRAMENTAS ENTRARAM NO CONTRATO. A guarda e o portao tem digest
//      declarado. Sem isso, adulterar o proprio portao era o caminho mais curto
//      para o verde, e nada olhava.
//   4. CASOS OBRIGATORIOS POR ID. Os identificadores estaveis (`C-01`, `D3-07`,
//      `GS-04`...) sao declarados no contrato, FORA do arquivo que protegem. O
//      `portao.js` exige que cada um tenha REALMENTE passado na execucao; aqui
//      se confere a presenca textual, que e a defesa contra reduzir a suite
//      preservando so a aparencia.
//
// Uso:
//   node ferramentas/gate-de-provas.js            confere (sai != 0 se reprovar)
//   node ferramentas/gate-de-provas.js --digests  recalcula e imprime os digests
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RAIZ = path.resolve(__dirname, "..");
const CONTRATO = path.join(__dirname, "contrato-de-provas.json");

/** Conteudo normalizado para LF.
 *
 *  As suites deste repo estao em CRLF e o `autocrlf` do git pode trocar o EOL no
 *  checkout. Um digest de bytes crus reprovaria por causa do sistema de
 *  arquivos, e nao por perda de prova — e um gate que da falso vermelho e
 *  desligado na primeira semana. */
function lerNormalizado(arquivo) {
  return fs.readFileSync(arquivo, "utf8").split("\r\n").join("\n");
}

function sha256(texto) {
  return crypto.createHash("sha256").update(texto, "utf8").digest("hex");
}

/** Casos declarados: `test("...")` no inicio de uma linha (com indentacao).
 *
 *  Contagem e defesa AUXILIAR, nunca a autoridade — um arquivo com 61
 *  `test("x", () => {})` vazios passaria por aqui e morreria no digest, e os
 *  casos obrigatorios por ID pegam a reducao que preserva so a aparencia. */
function contarCasos(texto) {
  return (texto.match(/^\s*test\(/gm) || []).length;
}

/** Os identificadores estaveis declarados no arquivo, na ordem em que aparecem.
 *  Um caso e `test("<ID>: descricao", ...)`. */
function idsDeCasos(texto) {
  const ids = [];
  for (const m of texto.matchAll(/^\s*test\(\s*"([^"]+)"/gm)) {
    const id = (m[1].match(/^([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)?)\s*:/) || [])[1];
    if (id) ids.push(id);
  }
  return ids;
}

/** Um bloco normativo esta presente? Casa por PREFIXO do `describe`, para que o
 *  titulo possa ganhar um subtitulo humano sem quebrar o gate — o que nao pode
 *  e a CATEGORIA sumir. */
function temBloco(texto, bloco) {
  const re = new RegExp(
    "^describe\\(\\s*[\"'`]" + bloco.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "m"
  );
  return re.test(texto);
}

/** Converte um glob de shell em RegExp.
 *
 *  Percorre caractere a caractere de proposito. A versao curta — encadear
 *  `.replace()` com um caractere de placeholder para o `**` — nao sobrevive ao
 *  proprio truque: o placeholder tem de ser um byte que nunca apareca num
 *  caminho, e o candidato natural acaba sendo um byte de CONTROLE. Um byte de
 *  controle dentro de um `.js` faz o git tratar o arquivo inteiro como binario,
 *  e um gate que ninguem consegue revisar em diff e meio gate. */
function globParaRegex(padrao) {
  let re = "";
  for (let i = 0; i < padrao.length; i++) {
    const c = padrao[i];
    if (c === "*") {
      if (padrao[i + 1] === "*") { re += ".*"; i++; }   // `**` cruza barras
      else re += "[^/]*";                               // `*` nao cruza
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

/** Os padroes de execucao declarados alcancam este caminho?
 *
 *  Fecha o buraco de estreitar o alvo: a suite continua no disco, o digest
 *  continua batendo, e mesmo assim ela nao roda mais. */
function padraoAlcanca(padroes, caminho) {
  const alvo = caminho.replace(/\\/g, "/");
  if (!Array.isArray(padroes) || padroes.length === 0) return false;
  return padroes.some((p) => globParaRegex(String(p).replace(/\\/g, "/")).test(alvo));
}

// ---------------------------------------------------------------------------
/** Confere a integridade estatica. Devolve `{ falhas, contrato }` — nunca sai
 *  do processo, para que o `portao.js` possa compor o veredito. */
function conferir() {
  const falhas = [];
  const anota = (id, codigo, detalhe) => falhas.push({ id, codigo, detalhe });

  if (!fs.existsSync(CONTRATO)) {
    anota("(contrato)", "CONTRATO_AUSENTE",
      "ferramentas/contrato-de-provas.json sumiu — a lista do que e obrigatorio nao pode evaporar.");
    return { falhas, contrato: null };
  }

  let contrato;
  try {
    contrato = JSON.parse(fs.readFileSync(CONTRATO, "utf8"));
  } catch (e) {
    anota("(contrato)", "CONTRATO_ILEGIVEL", e.message);
    return { falhas, contrato: null };
  }

  if (!Number.isInteger(contrato.versaoContratoDeProva)) {
    anota("(contrato)", "SEM_VERSAO", "o contrato de prova precisa declarar `versaoContratoDeProva`");
  }

  const suites = Array.isArray(contrato.suitesObrigatorias) ? contrato.suitesObrigatorias : [];
  if (suites.length === 0) {
    anota("(contrato)", "LISTA_VAZIA",
      "nenhuma suite obrigatoria declarada — esvaziar a lista NAO e caminho de saida");
  }

  // --- os campos de defesa da entrada nao sao opcionais --------------------
  // O buraco que a OS 23.1-P-R1 mediu: `if (s.digestSha256 && ...)` deixa a
  // defesa desaparecer junto com o campo. A entrada tem de CARREGAR as defesas.
  const camposExigidos = Array.isArray(contrato.camposObrigatoriosPorSuite)
    ? contrato.camposObrigatoriosPorSuite
    : null;
  if (!camposExigidos || camposExigidos.length === 0) {
    anota("(contrato)", "SEM_CAMPOS_OBRIGATORIOS",
      "o contrato precisa declarar `camposObrigatoriosPorSuite` — sem isso, apagar um digest desarma a suite em silencio");
  }
  for (const s of suites) {
    for (const campo of camposExigidos || []) {
      const v = s[campo];
      const vazio = v === undefined || v === null || v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (vazio) {
        anota(s.id || s.caminho, "CAMPO_OBRIGATORIO_AUSENTE",
          `a entrada nao carrega \`${campo}\`. Sem ele a defesa correspondente nao e avaliada, ` +
          `e a suite pode ser esvaziada sem que nada acenda.`);
      }
    }
  }

  // --- as proprias ferramentas do portao estao integras --------------------
  // Sem isto, adulterar o portao e o caminho mais curto para o verde.
  for (const f of contrato.ferramentasProtegidas || []) {
    const abs = path.join(RAIZ, f.caminho);
    if (!fs.existsSync(abs)) {
      anota(f.caminho, "FERRAMENTA_AUSENTE",
        "uma peca do portao sumiu — sem ela nada confere nem executa as provas.");
      continue;
    }
    const d = sha256(lerNormalizado(abs));
    if (f.digestSha256 && d !== f.digestSha256) {
      anota(f.caminho, "FERRAMENTA_ADULTERADA",
        `esperado ${f.digestSha256.slice(0, 16)}…, encontrado ${d.slice(0, 16)}…\n` +
        `      Mexer no portao e legitimo; faze-lo em silencio nao e.\n` +
        `      Atualize o contrato NO MESMO commit: node ferramentas/gate-de-provas.js --digests`);
    }
  }

  // --- o comando oficial e EXATAMENTE o declarado --------------------------
  // Nao ha mais encadeamento no comando oficial: um unico processo confere,
  // executa e conta. Assim nao existe operador de shell para subverter, e
  // qualquer tentativa de reintroduzir um vira divergencia aqui.
  const oficial = contrato.comandoOficial || {};
  const pkgPath = path.join(RAIZ, "package.json");
  let scripts = null;
  try {
    scripts = JSON.parse(fs.readFileSync(pkgPath, "utf8")).scripts || {};
  } catch (e) {
    anota("(package.json)", "PACOTE_ILEGIVEL", e.message);
  }

  // Dois scripts, e os dois exatos. O `test` e o portao; o `pre<test>` e esta
  // guarda, que o npm executa ANTES por conta propria — nao por encadeamento de
  // shell, mas pela semantica do proprio npm.
  //
  // O `pretest` fecha o unico caminho que sobrava: neutralizar o portao. Sem
  // ele, esvaziar o `main()` de `portao.js` daria verde, porque o portao e o
  // seu proprio primeiro conferente. Com ele, a guarda roda antes e confere o
  // DIGEST do portao — e a adulteracao acende sem que o portao precise
  // cooperar.
  const paresExigidos = [
    [oficial.script || "test", oficial.invocacaoExata],
    [oficial.scriptPrevio, oficial.invocacaoPreviaExata],
  ];
  for (const [nome, esperado] of paresExigidos) {
    if (!nome || !esperado) continue;
    const script = scripts ? scripts[nome] : null;
    if (script === undefined || script === null) {
      anota("(package.json)", "COMANDO_OFICIAL_AUSENTE",
        `o script \`${nome}\` nao existe no package.json. Sem ele o portao deixa de ser obrigatorio.`);
    } else if (String(script).trim() !== esperado) {
      anota("(package.json)", "COMANDO_OFICIAL_DIVERGENTE",
        `o script \`${nome}\` divergiu.\n      esperado exatamente:\n        ${esperado}\n` +
        `      encontrado:\n        ${script}\n` +
        `      O comando oficial e um processo unico de proposito. Encadear (\`&&\`, \`;\`, \`|\`)\n` +
        `      reabre o caminho pelo qual a suite deixa de rodar e o portao fica verde.`);
    }
  }

  const padroes = (contrato.execucao || {}).padroes;
  if (!Array.isArray(padroes) || padroes.length === 0) {
    anota("(contrato)", "SEM_PADROES_DE_EXECUCAO",
      "o contrato precisa declarar `execucao.padroes` — sem alvo, nada roda");
  }

  // --- cada suite obrigatoria ---------------------------------------------
  for (const s of suites) {
    const abs = path.join(RAIZ, s.caminho);

    if (!fs.existsSync(abs)) {
      anota(s.id, "SUITE_AUSENTE",
        `\`${s.caminho}\` nao existe. Apagada, renomeada ou movida — as tres dao aqui.`);
      continue;
    }

    const texto = lerNormalizado(abs);

    if (Array.isArray(padroes) && padroes.length && !padraoAlcanca(padroes, s.caminho)) {
      anota(s.id, "FORA_DO_COMANDO",
        `\`${s.caminho}\` existe mas os padroes de execucao nao a alcancam — ela nao roda.`);
    }

    const casos = contarCasos(texto);
    if (Number.isInteger(s.pisoDeCasos) && casos < s.pisoDeCasos) {
      anota(s.id, "ABAIXO_DO_PISO", `${casos} casos, piso aprovado ${s.pisoDeCasos}.`);
    }

    for (const bloco of s.blocosNormativos || []) {
      if (!temBloco(texto, bloco)) {
        anota(s.id, "BLOCO_NORMATIVO_AUSENTE",
          `o bloco \`${bloco}\` sumiu do arquivo. Uma categoria normativa inteira nao desaparece por acidente.`);
      }
    }

    // Presenca textual dos casos obrigatorios. A prova de que eles EXECUTARAM
    // e do `portao.js`; aqui se pega a reducao que preserva so a aparencia.
    const presentes = new Set(idsDeCasos(texto));
    const faltando = (s.casosObrigatorios || []).filter((id) => !presentes.has(id));
    if (faltando.length) {
      anota(s.id, "CASO_OBRIGATORIO_AUSENTE",
        `${faltando.length} caso(s) sumiram do arquivo: ${faltando.slice(0, 8).join(", ")}` +
        (faltando.length > 8 ? ` … (+${faltando.length - 8})` : ""));
    }

    const digest = sha256(texto);
    if (s.digestSha256 && digest !== s.digestSha256) {
      anota(s.id, "DIGEST_DIVERGENTE",
        `esperado ${s.digestSha256.slice(0, 16)}…, encontrado ${digest.slice(0, 16)}…\n` +
        `      Se a mudanca foi deliberada, atualize o contrato NO MESMO commit:\n` +
        `      node ferramentas/gate-de-provas.js --digests`);
    }
  }

  return { falhas, contrato };
}

/** Imprime as falhas no formato estavel que a campanha de sabotagem consome. */
function relatar(falhas) {
  console.error("\n=== GATE DE PROVAS: REPROVADO ===\n");
  for (const f of falhas) {
    console.error(`  [${f.codigo}] ${f.id}\n      ${f.detalhe}\n`);
  }
  console.error(
    "Uma suite obrigatoria sumiu, encolheu ou mudou sem o contrato acompanhar,\n" +
    "ou o proprio portao foi adulterado. Isto NAO e um teste vermelho comum: e\n" +
    "o portao dizendo que a prova deixou de existir, o que da verde por engano\n" +
    "em todo o resto.\n"
  );
}

// ---------------------------------------------------------------------------
function main() {
  // Argv estrito. No Windows o npm executa scripts pelo `cmd.exe`, que NAO
  // trata `;` como separador: ele o entrega como argumento. Um script
  // encadeado com `;` chegaria aqui como argv `[";", "node", "--test", ...]`.
  // Recusar argumento desconhecido transforma esse silencio em vermelho.
  const args = process.argv.slice(2);
  const modoDigests = args.length === 1 && args[0] === "--digests";
  if (args.length > 0 && !modoDigests) {
    console.error(
      "\n=== GATE DE PROVAS: REPROVADO ===\n\n" +
      "  [ARGUMENTO_INESPERADO] argumento nao reconhecido: " + JSON.stringify(args) + "\n" +
      "      Se isto veio de um script encadeado com `;`, esse e exatamente o defeito:\n" +
      "      o `cmd.exe` entrega o `;` como argumento e o comando seguinte nunca roda.\n"
    );
    process.exit(2);
  }

  if (modoDigests) {
    const contrato = JSON.parse(fs.readFileSync(CONTRATO, "utf8"));
    for (const s of contrato.suitesObrigatorias || []) {
      const p = path.join(RAIZ, s.caminho);
      if (!fs.existsSync(p)) { console.log(`${s.caminho}: AUSENTE`); continue; }
      const t = lerNormalizado(p);
      console.log(`${s.caminho}\n  digestSha256: "${sha256(t)}"\n  pisoDeCasos: ${contarCasos(t)}` +
        `\n  casosObrigatorios: ${JSON.stringify(idsDeCasos(t))}`);
    }
    for (const f of contrato.ferramentasProtegidas || []) {
      const p = path.join(RAIZ, f.caminho);
      if (!fs.existsSync(p)) { console.log(`${f.caminho}: AUSENTE`); continue; }
      console.log(`${f.caminho}\n  digestSha256: "${sha256(lerNormalizado(p))}"`);
    }
    return;
  }

  const { falhas, contrato } = conferir();
  if (falhas.length === 0) {
    const total = (contrato.suitesObrigatorias || []).length;
    console.log(
      `integridade das provas: ${total} suite${total === 1 ? "" : "s"} obrigatoria${total === 1 ? "" : "s"} ` +
      `conferida${total === 1 ? "" : "s"} (contrato v${contrato.versaoContratoDeProva})`
    );
    console.log("  (integridade NAO e aprovacao: quem aprova e o portao, depois de contar os testes)");
    return;
  }
  relatar(falhas);
  process.exit(1);
}

module.exports = {
  RAIZ, CONTRATO,
  conferir, relatar,
  lerNormalizado, sha256, contarCasos, idsDeCasos, temBloco, padraoAlcanca, globParaRegex,
};

if (require.main === module) main();
