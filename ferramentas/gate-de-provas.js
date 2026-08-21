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

/** Um SHA-256 hexadecimal, e nada alem disso. */
const HEX64 = /^[0-9a-f]{64}$/i;

/** Texto util: string, e nao so espaco em branco.
 *
 *  A distincao importa. `""` ja era recusado pela checagem de vazio; `"   "`
 *  nao era — e um `id` de tres espacos e indistinguivel de um `id` ausente para
 *  qualquer humano lendo o diff, mas passava. */
const textoUtil = (v) => typeof v === "string" && v.trim() !== "";

/** Lista nao vazia de textos uteis. */
const listaDeTextos = (v) => Array.isArray(v) && v.length > 0 && v.every(textoUtil);

/** Caminho relativo que NAO escapa do repositorio.
 *
 *  Sem isto, `caminho: "../fora.test.js"` aponta a entrada obrigatoria para um
 *  arquivo fora da arvore versionada: o digest bate, o gate fica verde, e a
 *  prova protegida nao esta sob revisao de ninguem. */
function caminhoInterno(rel) {
  if (!textoUtil(rel)) return false;
  if (path.isAbsolute(rel)) return false;
  const dentro = path.relative(RAIZ, path.resolve(RAIZ, rel));
  return dentro !== "" && !dentro.startsWith("..") && !path.isAbsolute(dentro);
}

/** O SCHEMA de uma entrada obrigatoria — secao 8 da OS 23.1-P-C2.
 *
 *  POR QUE UM VALIDADOR, e nao so "o campo existe". A C2 fechou a AUSENCIA dos
 *  campos com `camposObrigatoriosPorSuite`, e a rehomologacao mostrou que isso
 *  cobre metade do problema: o campo PRESENTE e INVALIDO desarma a defesa do
 *  mesmo jeito, e sem deixar rastro no diff.
 *
 *    `pisoDeCasos: 0`    nao e "piso zero", e SEM PISO: `casos < 0` nunca e
 *                        verdade, entao a comparacao existe e nao decide nada.
 *    `pisoDeCasos: "61"` nao e um piso de 61: `Number.isInteger("61")` e falso,
 *                        e o `if` inteiro era pulado.
 *
 *  Os dois passavam pela checagem de vazio sem tocar em nada. */
const VALIDADORES = {
  id: [textoUtil, "um texto nao vazio"],
  caminho: [caminhoInterno, "um caminho relativo, dentro do repositorio"],
  digestSha256: [(v) => typeof v === "string" && HEX64.test(v),
    "um SHA-256 hexadecimal de exatamente 64 caracteres"],
  pisoDeCasos: [(v) => Number.isInteger(v) && v > 0,
    "um inteiro estritamente positivo (0, negativo, fracionario ou string desarmam o piso)"],
  blocosNormativos: [listaDeTextos, "uma lista nao vazia de identificadores nao vazios"],
  casosObrigatorios: [listaDeTextos, "uma lista nao vazia de identificadores nao vazios"],
};
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
  // A entrada e identificada por POSICAO quando o proprio `id` e o que falta:
  // `anota(s.id, ...)` com `id` ausente produzia uma falha sem dono.
  const rotulo = (s, i) => (textoUtil(s && s.id) ? s.id : `suitesObrigatorias[${i}]`);
  const invalidas = new Set();
  const idsVistos = new Map();
  const caminhosVistos = new Map();

  for (let i = 0; i < suites.length; i++) {
    const s = suites[i];
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      anota(`suitesObrigatorias[${i}]`, "ENTRADA_MAL_FORMADA",
        "uma entrada de `suitesObrigatorias` precisa ser um objeto.");
      invalidas.add(i);
      continue;
    }
    for (const campo of camposExigidos || []) {
      const v = s[campo];
      const vazio = v === undefined || v === null || v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (vazio) {
        anota(rotulo(s, i), "CAMPO_OBRIGATORIO_AUSENTE",
          `a entrada nao carrega \`${campo}\`. Sem ele a defesa correspondente nao e avaliada, ` +
          `e a suite pode ser esvaziada sem que nada acenda.`);
        if (campo === "caminho") invalidas.add(i);
        continue;
      }
      const regra = VALIDADORES[campo];
      if (regra && !regra[0](v)) {
        anota(rotulo(s, i), "CAMPO_OBRIGATORIO_INVALIDO",
          `\`${campo}\` = ${JSON.stringify(v)} — esperado ${regra[1]}.\n` +
          `      Campo presente e invalido desarma a defesa tao bem quanto campo ausente,\n` +
          `      e sem deixar rastro no diff. Por isso e reprovacao, e nao aviso.`);
        if (campo === "caminho") invalidas.add(i);
      }
    }

    // Unicidade: duas entradas com o mesmo `id` (ou o mesmo `caminho`) fazem uma
    // esconder a outra, e a segunda vira uma linha decorativa que nao protege nada.
    if (textoUtil(s.id)) {
      const chave = s.id.trim();
      if (idsVistos.has(chave)) {
        anota(rotulo(s, i), "ENTRADA_DUPLICADA",
          `o \`id\` \`${chave}\` ja e usado pela entrada ${idsVistos.get(chave)}. ` +
          `Id repetido torna a lista ambigua, e uma entrada obrigatoria vira decoracao.`);
      } else idsVistos.set(chave, `suitesObrigatorias[${i}]`);
    }
    if (textoUtil(s.caminho)) {
      const chave = s.caminho.trim().replace(/\\/g, "/");
      if (caminhosVistos.has(chave)) {
        anota(rotulo(s, i), "ENTRADA_DUPLICADA",
          `o \`caminho\` \`${chave}\` ja e protegido pela entrada ${caminhosVistos.get(chave)}.`);
      } else caminhosVistos.set(chave, `suitesObrigatorias[${i}]`);
    }
  }

  // --- as proprias ferramentas do portao estao integras --------------------
  //
  // Sem isto, adulterar o portao e o caminho mais curto para o verde.
  //
  // DUAS CORRECOES QUE A REHOMOLOGACAO EXIGIU, e a razao de cada uma:
  //
  //   1. O DIGEST NAO E OPCIONAL. Era `if (f.digestSha256 && d !== ...)` — o
  //      MESMO padrao que foi o falso-verde R1/2.2, sobrevivendo aqui depois
  //      de ter sido corrigido nas suites. Apagar o campo `digestSha256` da
  //      entrada de `ferramentas/portao.js` apagava a conferencia junto: dava
  //      para esvaziar o `main()` do portao com `npm test` VERDE, exit 0 e
  //      ZERO testes executados. E o falso-verde 2.1 de volta por outra porta.
  //   2. A COBERTURA VEM DO DISCO, nao da lista. Se a lista fosse a autoridade
  //      sobre o proprio tamanho, esvazia-la desprotegia tudo de uma vez —
  //      `for (const f of [])` nao confere nada e nao reclama de nada. Aqui
  //      quem enumera e `ferramentas/*.js`: toda peca presente TEM de estar
  //      declarada. Lista vazia deixa de ser "nada a conferir" e passa a ser
  //      "duas ferramentas nao declaradas".
  const protegidas = Array.isArray(contrato.ferramentasProtegidas)
    ? contrato.ferramentasProtegidas : [];
  const declaradas = new Map();
  for (let i = 0; i < protegidas.length; i++) {
    const f = protegidas[i] || {};
    const onde = textoUtil(f.caminho) ? f.caminho : `ferramentasProtegidas[${i}]`;
    if (!caminhoInterno(f.caminho)) {
      anota(onde, "FERRAMENTA_MAL_DECLARADA",
        "`caminho` precisa ser um caminho relativo, dentro do repositorio.");
      continue;
    }
    if (typeof f.digestSha256 !== "string" || !HEX64.test(f.digestSha256)) {
      anota(onde, "FERRAMENTA_SEM_DIGEST",
        "a entrada nao carrega um `digestSha256` valido (SHA-256 hexadecimal de 64 caracteres).\n" +
        "      Uma peca do portao declarada sem digest e uma peca NAO protegida:\n" +
        "      era por aqui que se esvaziava o `portao.js` com o gate verde.");
      continue;
    }
    declaradas.set(f.caminho.replace(/\\/g, "/"), f.digestSha256);
  }

  // Cobertura derivada: quem manda e o diretorio, nao a lista digitada.
  let pecasEmDisco = [];
  try {
    pecasEmDisco = fs.readdirSync(__dirname)
      .filter((n) => n.endsWith(".js"))
      .map((n) => "ferramentas/" + n)
      .sort();
  } catch (e) {
    anota("(ferramentas)", "FERRAMENTAS_ILEGIVEIS", e.message);
  }
  for (const rel of pecasEmDisco) {
    if (!declaradas.has(rel)) {
      anota(rel, "FERRAMENTA_NAO_DECLARADA",
        "esta peca do portao existe em `ferramentas/` e NAO esta em `ferramentasProtegidas`.\n" +
        "      Ela roda sem que nada confira se foi adulterada. Declare-a com o digest:\n" +
        "      node ferramentas/gate-de-provas.js --digests");
    }
  }

  for (const [rel, esperado] of declaradas) {
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) {
      anota(rel, "FERRAMENTA_AUSENTE",
        "uma peca do portao sumiu — sem ela nada confere nem executa as provas.");
      continue;
    }
    const d = sha256(lerNormalizado(abs));
    if (d !== esperado) {
      anota(rel, "FERRAMENTA_ADULTERADA",
        `esperado ${esperado.slice(0, 16)}…, encontrado ${d.slice(0, 16)}…\n` +
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
  // Entradas com `caminho` ausente ou invalido ja foram anotadas acima e sao
  // puladas aqui de proposito: `path.join(RAIZ, undefined)` lanca TypeError, e
  // um portao que ESTOURA em vez de RECUSAR nao prova que a defesa existe —
  // prova que alguma coisa quebrou, que e outra afirmacao.
  for (let i = 0; i < suites.length; i++) {
    if (invalidas.has(i)) continue;
    const s = suites[i];
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

    // O digest declarado ja foi cobrado pelo schema acima (ausente ou malformado
    // e CAMPO_OBRIGATORIO_AUSENTE / CAMPO_OBRIGATORIO_INVALIDO). Aqui so se
    // COMPARA, e so quando ha o que comparar: formatar a mensagem com um digest
    // `undefined` fazia a guarda ESTOURAR em cima da propria reprovacao, trocando
    // um codigo estavel por um TypeError — o oposto do que a secao 10 pede de uma
    // defesa. A ausencia continua sendo reprovacao; o que muda e quem a relata.
    const digest = sha256(texto);
    const declarado = typeof s.digestSha256 === "string" ? s.digestSha256 : null;
    if (declarado !== null && digest !== declarado) {
      anota(s.id, "DIGEST_DIVERGENTE",
        `esperado ${declarado.slice(0, 16)}…, encontrado ${digest.slice(0, 16)}…\n` +
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
