// ===========================================================================
// CAMPANHA DA OS 54-C7 — O CASO NOMINAL AINDA PROVA ALGUMA COISA?
//
// ===========================================================================
// O QUE ESTA CAMPANHA MEDE, E POR QUE AS OUTRAS NÃO MEDEM
// ===========================================================================
//
// `mutacoes_c5.js` pergunta "a invocação EXECUTA?". `mutacoes_c6.js` pergunta
// "o passo DEPENDE do resultado?". As duas fecharam o eixo delas.
//
// A OS 54-R6 mostrou um terceiro eixo, e ele estava aberto de par em par: um
// caso nominal protegido pode PERDER O CONTEÚDO mantendo tudo o que as
// autoridades olhavam — arquivo, caminho, título, nome, quantidade de casos
// executados, quantidade textual, quantidade de afirmações, mensagens, e até
// os pisos e carimbos realinhados na mesma alteração.
//
//     await t.test("SAI-02: passo do veredito DUPLICADO reprova…", () => {
//       assert.ok(true);
//     });
//
// O caso existe, executa, APROVA — e a cadeia oficial ficava verde (`E36`). Com
// `SAI-22`, que declarava peso 2, bastavam duas afirmações triviais (`E38`). E
// `X07` fazia o mesmo com `UNI-B4` desde antes da C6, na base E na candidata.
//
// Esta campanha é a desse terceiro eixo. Nada aqui apaga um caso, renomeia um
// arquivo ou mexe num número sozinho: toda sabotagem PRESERVA a aparência e
// tira o conteúdo.
//
// O ORÁCULO é a cadeia oficial INTEIRA, na ordem em que o CI a roda:
//
//   `npm test` (com o `pretest`) -> guardião -> preservação do código de saída
//   -> conteúdo nominal -> inventário -> AÇÃO DO PORTÃO -> artefato.
//
// A evidência é a real: a saída literal do `npm test` daquela árvore e o código
// de saída real dele.
//
// TRAVAS, e todas param a campanha em vez de mentir:
//   1) âncora conferida: ausente, ambígua ou SEM EFEITO aborta;
//   2) cópia descartável por vetor, apagada no `finally`;
//   3) controle verde ANTES e DEPOIS da rodada;
//   4) processo sem código de saída vira INCONCLUSIVO, nunca "pego";
//   5) `server.js` da árvore real conferido por hash no começo e no fim;
//   6) TRÊS controles verdes, e um deles é crescimento legítimo — sem isso, uma
//      autoridade que recusasse toda mudança passaria nos negativos e pareceria
//      rigorosa estando quebrada.
//
// Uso:
//   node mutacoes_c7.js            # campanha inteira
//   node mutacoes_c7.js --listar   # só lista
//   node mutacoes_c7.js --secar    # só confere as âncoras
//   node mutacoes_c7.js --so T01,C31
// ===========================================================================

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const RAIZ = __dirname;

const WORKFLOW = ".github/workflows/provas-do-servidor.yml";
const GUARDIAO = "ci/auditabilidade.js";
const PRESERVACAO = "ci/codigo_de_saida.js";
const PISOS = "ci/pisos_autorizados.js";
const INVENTARIO = "ci/inventario_de_execucao.js";
const ARTEFATO = "ci/artefato.js";
const ANCORADO = "test/piso_ancorado.js";
const PISO_GLOBAL = "ci/piso_do_portao.json";
const CENSO = "test/censo_de_suites.js";
const GUARDA_PRETEST = "test/guarda_do_portao.js";
const SUITE_SAI = "codigo_de_saida.test.js";
const SUITE_UNI = "unicidade_do_portador.test.js";

const TEMPO_LIMITE = 1800000;

// ---------------------------------------------------------------------------
// A ÁRVORE DESCARTÁVEL
// ---------------------------------------------------------------------------

const COPIAR = ["package.json", ".github", "ci", "test", "docs", "server.js", "app.html", "contrato"];
const temporarios = new Set();

function copiarArvore() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), "os54c7-"));
  temporarios.add(destino);
  for (const item of COPIAR) {
    fs.cpSync(path.join(RAIZ, item), path.join(destino, item), { recursive: true });
  }
  const git = (...args) =>
    execFileSync("git", ["-C", destino, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "user.email", "arnes@os54c7.local");
  git("config", "user.name", "arnes OS 54-C7");
  git("add", "-A");
  git("commit", "-q", "-m", "arvore integra (ancora do conteudo)");
  return destino;
}

function descartar(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  temporarios.delete(dir);
}

function ler(dir, relativo) {
  const bruto = fs.readFileSync(path.join(dir, relativo), "utf8");
  return { bruto, crlf: bruto.indexOf(CR + NL) >= 0, texto: bruto.split(CR + NL).join(NL) };
}

function gravar(dir, relativo, texto, crlf) {
  fs.writeFileSync(path.join(dir, relativo), crlf ? texto.split(NL).join(CR + NL) : texto, "utf8");
}

function trocar(dir, relativo, de, para, id) {
  const alvo = ler(dir, relativo);
  const partes = alvo.texto.split(de);
  if (partes.length !== 2) {
    throw new Error(id + ": ancora ambigua/ausente (" + (partes.length - 1) + ") em " + relativo +
      " :: " + de.slice(0, 70));
  }
  const mutado = partes.join(para);
  if (mutado === alvo.texto) throw new Error(id + ": a mutacao nao alterou byte nenhum em " + relativo);
  gravar(dir, relativo, mutado, alvo.crlf);
}

// ---------------------------------------------------------------------------
// AS PEÇAS: TROCAR O CORPO DE UM CASO PRESERVANDO A APARÊNCIA
// ---------------------------------------------------------------------------

/** Os limites de um caso no arquivo: do começo dele até o começo do próximo.
 *  A âncora é ANCORADA NA LINHA, pelo mesmo motivo da autoridade: um `test(`
 *  citado dentro de string abriria um caso fantasma. */
function limitesDoCaso(texto, caso, id) {
  const marca = new RegExp('^[ \\t]*(?:await\\s+)?(?:t\\.)?test\\(\\s*"' + caso + ':[^"]*"', "m");
  const m = marca.exec(texto);
  if (!m) throw new Error(id + ": caso `" + caso + "` nao encontrado");
  const inicio = m.index;
  const seguintes = [...texto.matchAll(/^[ \t]*(?:await\s+)?(?:t\.)?test\(\s*"([^"]+)"/gm)];
  const proximo = seguintes.find((x) => x.index > inicio);
  return {
    inicio,
    fim: proximo ? proximo.index : texto.length,
    recuo: /^[ \t]*/.exec(m[0])[0],
    cabeca: texto.slice(inicio, texto.indexOf("=> {", inicio) + 4),
  };
}

/** O corpo de um caso vira `corpoNovo`. Título, posição e nome ficam. */
function trocarCorpo(dir, arquivo, caso, corpoNovo, id) {
  const alvo = ler(dir, "test/" + arquivo);
  const { inicio, fim, recuo, cabeca } = limitesDoCaso(alvo.texto, caso, id);
  const novo = alvo.texto.slice(0, inicio) + cabeca + NL +
    String(corpoNovo).split(NL).map((l) => recuo + "  " + l).join(NL) + NL +
    recuo + "});" + NL + NL + alvo.texto.slice(fim);
  if (novo === alvo.texto) throw new Error(id + ": a trivializacao de " + caso + " nao alterou byte nenhum");
  gravar(dir, "test/" + arquivo, novo, alvo.crlf);
}

/** O corpo ORIGINAL de um caso, sem a linha do `test(` e sem o fecho. Serve às
 *  sabotagens que MOVEM o conteúdo para dentro de um comentário ou de uma
 *  string — as duas que preservam o tamanho bruto do arquivo. */
function corpoOriginal(dir, arquivo, caso, id) {
  const alvo = ler(dir, "test/" + arquivo);
  const { inicio, fim, cabeca } = limitesDoCaso(alvo.texto, caso, id);
  return alvo.texto.slice(inicio + cabeca.length, fim)
    .replace(/\}\);\s*$/, "").trim();
}

/** Recarimba a tabela com o que os corpos de HOJE medem: o gesto de quem
 *  trivializa e atualiza a declaração na mesma alteração. */
function recarimbar(dir, id) {
  const P = require(path.join(dir, PISOS));
  const alvo = ler(dir, PISOS);
  let texto = alvo.texto;
  let n = 0;
  for (const linha of P.medirNominais(dir)) {
    const m = /^(\S+) :: (\S+) :: peso (\d+) digest (\S+)$/.exec(linha);
    if (!m) continue;
    const de = '"' + m[2] + '": Object.freeze({ peso: ';
    const i = texto.indexOf(de);
    if (i < 0) continue;
    const fim = texto.indexOf("})", i);
    const novo = de + m[3] + ', digest: "' + m[4] + '" ';
    texto = texto.slice(0, i) + novo + texto.slice(fim);
    n++;
  }
  if (n === 0) throw new Error(id + ": o recarimbo nao encontrou linha nenhuma");
  gravar(dir, PISOS, texto, alvo.crlf);
}

const trivializa = (arquivo, caso, corpo) => (d, i) =>
  trocarCorpo(d, arquivo, caso, corpo || "assert.ok(true);", i);

// ---------------------------------------------------------------------------
// O ORÁCULO — a cadeia oficial, na ordem do CI
// ---------------------------------------------------------------------------

function rodar(dir, comando, args) {
  const ambiente = Object.assign({}, process.env);
  delete ambiente.NODE_TEST_CONTEXT;
  try {
    const saida = execFileSync(comando, args, {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      shell: comando === "npm", timeout: TEMPO_LIMITE, env: ambiente,
    });
    return { exit: 0, saida };
  } catch (e) {
    if (e && (e.killed || e.signal)) return { exit: null, saida: "TIMEOUT/SINAL " + String(e.signal) };
    const exit = typeof e.status === "number" ? e.status : null;
    return { exit, saida: String((e.stdout || "") + (e.stderr || "")) };
  }
}

/** A CAUSA NOMINAL de um vermelho: o rótulo da reprovação, e não a saída
 *  inteira. Um placar que só diz "vermelho" não distingue a sabotagem medida de
 *  um acidente de bancada. */
const ROTULOS = [
  "CONTEÚDO DO CASO NOMINAL DIVERGE",
  "CASO NOMINAL TRIVIALIZADO",
  "CASO NOMINAL AUSENTE",
  "CASO PROTEGIDO REMOVIDO DA AUTORIDADE",
  "CASO PROTEGIDO SUMIU DO ARQUIVO",
  "PESO MATERIAL DECLARADO REBAIXADO",
  "PISO EXTERNO REBAIXADO",
  "PISO EXTERNO APAGADO",
  "NOME OBRIGATÓRIO REMOVIDO",
  "SHA DE MEDIÇÃO FORA DA HISTÓRIA",
  "SHA DE MEDIÇÃO RETROCEDIDO",
  "AUTORIDADE DOS PISOS EXTERNOS APAGADA",
  "PISO DE CASOS REBAIXADO",
  "PISO POR SUÍTE REBAIXADO COM FOLGA",
  "PISO DO PISO REBAIXADO",
  "CASOS ENCOLHERAM",
  "SUÍTE REMOVIDA",
  "CHAMADA AUSENTE NO `pretest`",
  "INVOCAÇÃO AUSENTE",
  "CÓDIGO DE SAÍDA NÃO PRESERVADO",
  "CASOS EXECUTADOS ABAIXO DO PISO",
  "CASO NOMINAL NÃO EXECUTOU",
  "SUÍTE NÃO EXECUTOU",
  "PISO SEM ÂNCORA",
  "sumiu do disco",
  "Cannot find module",
];

function causaDe(saida) {
  for (const rotulo of ROTULOS) {
    if (String(saida).includes(rotulo)) return rotulo;
  }
  // Quando a reprovação vem de um CASO da suíte, o nome dele é a causa
  // nominal — e é mais informativo do que qualquer rótulo genérico.
  const caso = /^\s*✖\s+([A-Z]{2,5}-[0-9]+[a-z]?)\s*:/m.exec(String(saida));
  if (caso) return "caso " + caso[1];
  const m = /^(?:\s*\*\s*)?([A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ \-`]{8,60}):/m.exec(String(saida));
  return m ? m[1].trim() : "(sem rótulo reconhecido)";
}

function numerosDe(saida) {
  const p = (k) => {
    const m = new RegExp("^(?:#|ℹ)\\s+" + k + "\\s+([0-9]+)", "m").exec(saida);
    return m ? Number(m[1]) : -1;
  };
  return { casos: p("pass"), suites: p("suites") };
}

function entrypointDeclarado(dir) {
  const manifesto = fs.readFileSync(path.join(dir, ".github/actions/portao/action.yml"), "utf8");
  const m = /^\s*main:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(manifesto);
  if (!m) throw new Error("`runs.main` ausente do manifesto da ação");
  return path.join(dir, ".github", "actions", "portao", m[1]);
}

/** A §3 da OS manda atribuir a causa dos nove vetores de trivialização à
 *  AUTORIDADE DE CONTEÚDO — e não a qualquer autoridade que reprove primeiro.
 *
 *  A cadeia oficial continua sendo o oráculo: é ela que decide vermelho e
 *  verde. Isto aqui é uma segunda leitura, feita na MESMA cópia, que responde
 *  "e a autoridade de conteúdo, o que diz?". Sem ela, um vetor cujo corpo
 *  trivializado derruba antes o piso ancorado — porque a contagem estática de
 *  casos caiu junto — apareceria no placar sem dizer o que esta OS fechou. */
function vozDoConteudo(dir) {
  const r = rodar(dir, process.execPath, [path.join(dir, PISOS)]);
  if (r.exit === null) return "sem código de saída";
  if (r.exit === 0) return "verde";
  return causaDe(r.saida);
}

function cadeiaOficial(dir, id) {
  const provas = rodar(dir, "npm", ["test"]);
  if (provas.exit === null) return { inconclusivo: true, etapa: "npm test", causa: "sem código de saída", casos: -1 };
  const n = numerosDe(provas.saida);

  const dirEvid = fs.mkdtempSync(path.join(os.tmpdir(), "os54c7-evid-"));
  temporarios.add(dirEvid);
  const saida = path.join(dirEvid, "npm-test.txt");
  const marcador = path.join(dirEvid, "exit.txt");
  fs.writeFileSync(saida, provas.saida, "utf8");
  fs.writeFileSync(marcador, String(provas.exit), "utf8");
  const limpar = () => { fs.rmSync(dirEvid, { recursive: true, force: true }); temporarios.delete(dirEvid); };

  if (provas.exit !== 0) {
    limpar();
    return Object.assign({ vermelho: true, etapa: "npm test", causa: causaDe(provas.saida) }, n);
  }

  for (const [etapa, alvo] of [
    ["guardiao", GUARDIAO], ["preservacao", PRESERVACAO],
    ["conteudo", PISOS], ["inventario", INVENTARIO],
  ]) {
    const r = rodar(dir, process.execPath, [path.join(dir, alvo)]);
    if (r.exit === null) { limpar(); return { inconclusivo: true, etapa, causa: "sem código de saída", casos: n.casos }; }
    if (r.exit !== 0) { limpar(); return Object.assign({ vermelho: true, etapa, causa: causaDe(r.saida) }, n); }
  }

  let entrypoint;
  try {
    entrypoint = entrypointDeclarado(dir);
  } catch (erro) {
    limpar();
    return Object.assign({ vermelho: true, etapa: "acao", causa: String((erro && erro.message) || erro) }, n);
  }
  const juiz = rodar(dir, process.execPath, [entrypoint]);
  const comEntradas = spawnSync(process.execPath, [entrypoint], {
    cwd: dir, encoding: "utf8", timeout: TEMPO_LIMITE,
    env: Object.assign({}, process.env, {
      GITHUB_WORKSPACE: dir, INPUT_SAIDA: saida, INPUT_MARCADOR: marcador,
    }),
  });
  void juiz;
  if (typeof comEntradas.status !== "number") {
    limpar();
    return { inconclusivo: true, etapa: "juiz (acao)", causa: "sem código de saída", casos: n.casos };
  }
  if (comEntradas.status !== 0) {
    limpar();
    return Object.assign({ vermelho: true, etapa: "juiz (acao)", causa: causaDe(comEntradas.stdout + comEntradas.stderr) }, n);
  }

  const art = rodar(dir, process.execPath, [path.join(dir, ARTEFATO), "--conferir", "--raiz", dir]);
  limpar();
  if (art.exit === null) return { inconclusivo: true, etapa: "artefato", causa: "sem código de saída", casos: n.casos };
  if (art.exit !== 0) return Object.assign({ vermelho: true, etapa: "artefato", causa: causaDe(art.saida) }, n);
  return Object.assign({ vermelho: false, etapa: "—", causa: "" }, n);
}

// ===========================================================================
// AS SABOTAGENS — todas PRESERVAM a aparência e tiram o conteúdo
// ===========================================================================

const PROTEGIDOS_SAI = ["SAI-00", "SAI-02", "SAI-04", "SAI-09", "SAI-17", "SAI-18", "SAI-19", "SAI-20", "SAI-22"];

const SABOTAGENS = [
  // --- as NOVE trivializações individuais da §3 ---------------------------
  ...PROTEGIDOS_SAI.map((caso, i) => ({
    id: "T" + String(i + 1).padStart(2, "0"),
    nome: caso + " trivializado (título, posição e nome preservados)",
    aplicar: trivializa(SUITE_SAI, caso),
  })),

  // --- e os dois casos que carregam a prova nova, e o UNI-B4 --------------
  { id: "T10", nome: "SAI-25 trivializado (o caso que trivializa os outros)", aplicar: trivializa(SUITE_SAI, "SAI-25") },
  { id: "T11", nome: "SAI-29 trivializado (o caso do recarimbo)", aplicar: trivializa(SUITE_SAI, "SAI-29") },
  {
    id: "T12", nome: "X07: UNI-B4 trivializado com o titulo preservado",
    aplicar: trivializa(SUITE_UNI, "UNI-B4"),
  },

  // --- as variações que preservam MAIS aparência --------------------------
  {
    id: "V13", nome: "E38: SAI-22 com o MESMO numero de afirmacoes triviais",
    aplicar: trivializa(SUITE_SAI, "SAI-22", "assert.ok(true);" + NL + "assert.ok(true);"),
  },
  {
    id: "V14", nome: "SAI-19 com afirmacoes DUPLICADAS ate o mesmo numero",
    aplicar: trivializa(SUITE_SAI, "SAI-19", new Array(8).fill("assert.ok(true);").join(NL)),
  },
  {
    id: "V15", nome: "SAI-09 com o corpo trocado por ajudante BENIGNO",
    aplicar: trivializa(SUITE_SAI, "SAI-09", "exigeMotivo([\"CÓDIGO DE SAÍDA NÃO PRESERVADO em `x`\"], /CÓDIGO DE SAÍDA/, \"benigno\");"),
  },
  {
    id: "V16", nome: "SAI-04 com o conteudo movido para COMENTARIO",
    aplicar: (d, i) => {
      const original = corpoOriginal(d, SUITE_SAI, "SAI-04", i);
      const comentado = original.split(NL).map((l) => "// " + l).join(NL);
      trocarCorpo(d, SUITE_SAI, "SAI-04", comentado + NL + "assert.ok(true);", i);
    },
  },
  {
    id: "V17", nome: "SAI-02 com o conteudo movido para STRING",
    aplicar: (d, i) => {
      const original = corpoOriginal(d, SUITE_SAI, "SAI-02", i);
      const emString = "const preservado = " + JSON.stringify(original) + ";" + NL + "assert.ok(preservado.length > 0);";
      trocarCorpo(d, SUITE_SAI, "SAI-02", emString, i);
    },
  },
  {
    id: "V18", nome: "RECARIMBO COORDENADO: trivializa e atualiza peso e digest juntos",
    aplicar: (d, i) => { trocarCorpo(d, SUITE_SAI, "SAI-02", "assert.ok(true);", i); recarimbar(d, i); },
  },
  {
    id: "V19", nome: "autoridade nominal REMOVIDA do disco",
    aplicar: (d, i) => {
      const alvo = path.join(d, PISOS);
      if (!fs.existsSync(alvo)) throw new Error(i + ": " + PISOS + " ausente");
      fs.renameSync(alvo, alvo + ".desligado");
    },
  },
  {
    id: "V20", nome: "chamada do conteudo nominal retirada do `pretest`",
    aplicar: (d, i) => trocar(d, GUARDA_PRETEST,
      "    ...conferirConteudoDosNominais()," , "    // ...conferirConteudoDosNominais(),", i),
  },
  {
    id: "V21", nome: "passo do conteudo nominal NEUTRALIZADO no workflow",
    aplicar: (d, i) => trocar(d, WORKFLOW,
      "        run: node ci/pisos_autorizados.js",
      "        run: echo node ci/pisos_autorizados.js", i),
  },
  {
    id: "V22", nome: "trivializacao COM o piso da suite reduzido junto",
    aplicar: (d, i) => {
      const P = require(path.join(d, PISOS));
      const textual = P.MINIMO_DECLARADO_NO_CENSO[SUITE_SAI];
      trocarCorpo(d, SUITE_SAI, "SAI-20", "assert.ok(true);", i);
      trocar(d, CENSO, '"' + SUITE_SAI + '": ' + textual + ",", '"' + SUITE_SAI + '": 1,', i);
    },
  },

  // --- os pisos e a fonte, que a R6 achou desprotegidos -------------------
  {
    id: "P23", nome: "E21: peso material DECLARADO reduzido",
    aplicar: (d, i) => {
      const P = require(path.join(d, PISOS));
      const atual = P.CONTEUDO_DOS_NOMINAIS[SUITE_SAI]["SAI-19"];
      trocar(d, PISOS, '"SAI-19": Object.freeze({ peso: ' + atual.peso + ",",
        '"SAI-19": Object.freeze({ peso: 1,', i);
    },
  },
  {
    id: "P24", nome: "E22: a FONTE de conteudo apagada do arquivo",
    aplicar: (d, i) => {
      const alvo = ler(d, PISOS);
      const inicio = alvo.texto.indexOf("const CONTEUDO_DOS_NOMINAIS = Object.freeze({");
      if (inicio < 0) throw new Error(i + ": CONTEUDO_DOS_NOMINAIS nao encontrado");
      const fim = alvo.texto.indexOf(NL + "});", inicio) + (NL + "});").length;
      const novo = alvo.texto.slice(0, inicio) + "const CONTEUDO_DOS_NOMINAIS = Object.freeze({});" +
        alvo.texto.slice(fim);
      if (novo === alvo.texto) throw new Error(i + ": a mutacao nao alterou byte nenhum");
      gravar(d, PISOS, novo, alvo.crlf);
    },
  },
  {
    id: "P25", nome: "E32: piso EXECUTADO da suite reduzido",
    aplicar: (d, i) => {
      const P = require(path.join(d, PISOS));
      trocar(d, PISOS, '"' + SUITE_SAI + '": ' + P.MINIMO_EXECUTADO[SUITE_SAI] + ",",
        '"' + SUITE_SAI + '": 1,', i);
    },
  },
  {
    id: "P26", nome: "E33: piso TEXTUAL da suite reduzido",
    aplicar: (d, i) => {
      const P = require(path.join(d, PISOS));
      trocar(d, PISOS, '"' + SUITE_SAI + '": ' + P.MINIMO_DECLARADO_NO_CENSO[SUITE_SAI] + ",",
        '"' + SUITE_SAI + '": 1,', i);
    },
  },
  {
    id: "P27", nome: "E34: nomes obrigatorios ESVAZIADOS",
    aplicar: (d, i) => {
      const alvo = ler(d, PISOS);
      const marca = '"' + SUITE_SAI + '": Object.freeze([';
      const inicio = alvo.texto.indexOf(marca);
      if (inicio < 0) throw new Error(i + ": lista de nomes obrigatorios nao encontrada");
      const fim = alvo.texto.indexOf("]),", inicio) + 3;
      const novo = alvo.texto.slice(0, inicio) + marca + "]),"+ alvo.texto.slice(fim);
      if (novo === alvo.texto) throw new Error(i + ": a mutacao nao alterou byte nenhum");
      gravar(d, PISOS, novo, alvo.crlf);
    },
  },
  {
    id: "P28", nome: "SHA de medicao trocado por um SHA conveniente",
    aplicar: (d, i) => {
      const piso = JSON.parse(ler(d, PISO_GLOBAL).texto);
      trocar(d, PISO_GLOBAL, '"medido_sobre": "' + piso.medido_sobre + '"',
        '"medido_sobre": "0000000000000000000000000000000000000000"', i);
    },
  },
  {
    id: "P29", nome: "o proprio arquivo RETIRADO da autoridade ancorada",
    aplicar: (d, i) => trocar(d, ANCORADO,
      '  "ci/pisos_autorizados.js": "declara os pisos externos, os nomes obrigatórios e o conteúdo material dos casos protegidos",' + NL,
      "", i),
  },
  {
    id: "P30", nome: "COORDENADA: trivializa e neutraliza o piso ancorado junto",
    aplicar: (d, i) => {
      trocarCorpo(d, SUITE_SAI, "SAI-02", "assert.ok(true);", i);
      recarimbar(d, i);
      trocar(d, ANCORADO, "function conferirPisoAncorado(raizDoRepo) {",
        "function conferirPisoAncorado(raizDoRepo) {" + NL +
        "  if (raizDoRepo || true) return { ancoras: [], comparacoes: 0, agora: {}, passado: [] };", i);
    },
  },

  // --- os CONTROLES, e são três ------------------------------------------
  { id: "C31", nome: "CONTROLE: arvore INTEGRA continua verde", controle: true, aplicar: () => {} },
  {
    // A trava contra o excesso de zelo, parte um: comentário e espaço em branco
    // não são conteúdo. Uma autoridade que os cobrasse exigiria redeclaração a
    // cada linha de prosa, e vermelho pelo motivo errado é tão cego quanto
    // verde indevido.
    id: "C32", nome: "CONTROLE: PROSA nova num caso protegido continua verde", controle: true,
    aplicar: (d, i) => {
      const alvo = ler(d, "test/" + SUITE_SAI);
      const { inicio, cabeca, recuo } = limitesDoCaso(alvo.texto, "SAI-00", i);
      const corte = inicio + cabeca.length;
      const novo = alvo.texto.slice(0, corte) + NL + recuo + "  // uma explicação nova, e só prosa" +
        alvo.texto.slice(corte);
      if (novo === alvo.texto) throw new Error(i + ": a mutacao nao alterou byte nenhum");
      gravar(d, "test/" + SUITE_SAI, novo, alvo.crlf);
    },
  },
  {
    // A trava contra o excesso de zelo, parte dois: CRESCER um caso protegido é
    // legítimo, e a redeclaração acompanha. Sem este controle, a autoridade
    // seria um congelamento — e congelar a suíte é impedir que ela melhore.
    id: "C33", nome: "CONTROLE: caso protegido que CRESCE e e redeclarado continua verde", controle: true,
    aplicar: (d, i) => {
      const alvo = ler(d, "test/" + SUITE_SAI);
      const { inicio, cabeca, recuo } = limitesDoCaso(alvo.texto, "SAI-00", i);
      const corte = inicio + cabeca.length;
      const novo = alvo.texto.slice(0, corte) + NL + recuo +
        "  assert.equal(typeof CODIGO.conferirPreservacaoDoCodigo, \"function\");" +
        alvo.texto.slice(corte);
      gravar(d, "test/" + SUITE_SAI, novo, alvo.crlf);
      recarimbar(d, i);
    },
  },
];

// ===========================================================================
// EXECUCAO
// ===========================================================================

const filtro = (() => {
  const i = process.argv.indexOf("--so");
  return i >= 0 ? new Set(String(process.argv[i + 1] || "").split(",")) : null;
})();
const alvos = SABOTAGENS.filter((s) => !filtro || filtro.has(s.id));

if (process.argv.includes("--listar")) {
  for (const s of alvos) console.log(s.id.padEnd(5) + (s.controle ? "[ctrl] " : "       ") + s.nome);
  console.log("total: " + alvos.length);
  process.exit(0);
}

const hashDoServidor = () =>
  execFileSync("git", ["-C", RAIZ, "hash-object", "server.js"], { encoding: "utf8" }).trim();

const servidorAntes = hashDoServidor();

function encerrar(codigo) {
  for (const dir of [...temporarios]) fs.rmSync(dir, { recursive: true, force: true });
  const servidorDepois = hashDoServidor();
  if (servidorAntes !== servidorDepois) {
    console.error("`server.js` DA ARVORE REAL MUDOU: " + servidorAntes + " -> " + servidorDepois);
    process.exit(2);
  }
  console.log("`server.js` da arvore real intacto: " + servidorAntes);
  console.log("temporarios abandonados: " + temporarios.size);
  process.exit(codigo);
}

if (process.argv.includes("--secar")) {
  let ruins = 0;
  for (const s of alvos) {
    const dir = copiarArvore();
    try {
      s.aplicar(dir, s.id);
      const sujo = execFileSync("git", ["-C", dir, "status", "--porcelain", "-uall"], { encoding: "utf8" }).trim();
      if (s.id !== "C31" && sujo === "") { ruins++; console.log("SEM EFEITO  " + s.id.padEnd(5) + s.nome); }
      else console.log("ancora ok   " + s.id.padEnd(5) + s.nome);
    } catch (erro) {
      ruins++;
      console.log("ANCORA RUIM " + s.id.padEnd(5) + String((erro && erro.message) || erro).slice(0, 150));
    } finally {
      descartar(dir);
    }
  }
  console.log("ancoras invalidas ou sem efeito: " + ruins + "/" + alvos.length);
  encerrar(ruins === 0 ? 0 : 1);
}

console.log("controle de partida na copia limpa...");
const copiaControle = copiarArvore();
const partida = cadeiaOficial(copiaControle, "CONTROLE");
descartar(copiaControle);
if (partida.vermelho || partida.inconclusivo) {
  console.error("A COPIA LIMPA JA ESTA VERMELHA/INCONCLUSIVA (" + partida.etapa + ": " + partida.causa +
    ") — campanha invalida.");
  encerrar(1);
}
console.log("copia limpa VERDE - " + partida.casos + " casos em " + partida.suites + " suites" + NL);

const resultados = [];
for (const s of alvos) {
  const dir = copiarArvore();
  let veredito;
  try {
    s.aplicar(dir, s.id);
    const conteudo = vozDoConteudo(dir);
    veredito = Object.assign(cadeiaOficial(dir, s.id), { conteudo });
  } catch (erro) {
    console.error("ABORTA " + s.id + ": " + ((erro && erro.message) || erro));
    descartar(dir);
    encerrar(1);
  }
  descartar(dir);

  const esperadoVerde = Boolean(s.controle);
  const ok = veredito.inconclusivo ? false : esperadoVerde ? !veredito.vermelho : veredito.vermelho;
  resultados.push({
    id: s.id, nome: s.nome, ok, inconclusivo: !!veredito.inconclusivo, veredito,
    conteudo: veredito.conteudo,
  });
  console.log(
    (veredito.inconclusivo ? "INCONCL" : ok ? "PEGA   " : "ESCAPOU") + " " + s.id.padEnd(5) +
    " " + (veredito.vermelho ? "vermelho" : veredito.inconclusivo ? "  ??    " : "  verde ") +
    " em " + String(veredito.etapa).padEnd(12) +
    " " + String(veredito.causa || "—").slice(0, 40).padEnd(40) +
    " conteudo=" + String(veredito.conteudo || "—").slice(0, 34).padEnd(34) +
    " " + s.nome
  );
}

console.log(NL + "controle de chegada na copia limpa...");
const copiaFim = copiarArvore();
const chegada = cadeiaOficial(copiaFim, "CHEGADA");
descartar(copiaFim);
console.log("copia limpa: " + (chegada.vermelho ? "VERMELHA em " + chegada.etapa : chegada.inconclusivo ? "INCONCLUSIVA" : "VERDE") +
  " - " + chegada.casos + " casos");

const escaparam = resultados.filter((r) => !r.ok && !r.inconclusivo);
const inconclusivas = resultados.filter((r) => r.inconclusivo);
console.log(NL + "detectadas: " + resultados.filter((r) => r.ok).length + "/" + resultados.length +
  " · escapes: " + escaparam.length + " · inconclusivas: " + inconclusivas.length);
for (const r of escaparam) console.log("  ESCAPOU " + r.id + ": " + r.nome);
for (const r of inconclusivas) console.log("  INCONCLUSIVA " + r.id + ": " + r.nome);
encerrar(chegada.vermelho || chegada.inconclusivo || escaparam.length > 0 || inconclusivas.length > 0 ? 1 : 0);
