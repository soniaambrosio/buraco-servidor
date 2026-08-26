// ===========================================================================
// CAMPANHA CRUZADA DA OS 54-C4 — AS DUAS FAMILIAS NA MESMA ARVORE.
//
// ===========================================================================
// O QUE ESTA CAMPANHA MEDE, E POR QUE ELA NAO E NENHUMA DAS OUTRAS DUAS
// ===========================================================================
//
// `mutacoes_c4.js` sabota a AUTORIDADE DO ARTEFATO PRODUTIVO. `mutacoes_c2.js`
// sabota a auditabilidade externa. `mutacoes_c3.js` sabota a unicidade por
// capacidade composta. Cada uma prova que a SUA familia continua viva, e
// nenhuma das tres responde a pergunta desta composicao: uma metade pode ser
// desligada usando a outra como cobertura?
//
// O risco e concreto e tem nome. As familias compartilham o `pretest`, o censo,
// o piso, a suite do CI e — desde a OS 52-C4 — a lista de PASSOS PROPRIOS do
// workflow. Uma composicao malfeita deixa a auditabilidade verde enquanto a
// autoridade do artefato some, ou o contrario — e as campanhas de origem nao
// veem, porque cada uma olha so o proprio lado.
//
// O ORACULO e a cadeia oficial inteira, na ordem em que o CI a roda:
//   `npm test` (com o `pretest`) -> guardiao -> inventario -> juiz -> artefato.
//
// A arvore mutada e uma COPIA DESCARTAVEL com historico proprio: um repositorio
// novo com UM commit da arvore INTEGRA, feito ANTES da sabotagem. Sem historico
// o piso ancorado da OS 52-C3 nao tem ancora e reprova por falta de git, que e
// vermelho pelo motivo errado; com o pristino em `HEAD`, toda mutacao que
// rebaixa numero e comparada com o que a arvore declarava um instante antes.
//
// TRAVAS, e todas param a campanha em vez de mentir:
//   1) ancora conferida: ausente ou ambigua ABORTA;
//   2) alteracao efetiva: byte igual ABORTA;
//   3) controle verde ANTES e DEPOIS da rodada;
//   4) veredito indeterminado (processo sem codigo de saida) ABORTA.
//
// Uso:
//   node mutacoes_cruzada.js            # campanha inteira
//   node mutacoes_cruzada.js --listar   # so lista
//   node mutacoes_cruzada.js --secar    # so confere as ancoras
//   node mutacoes_cruzada.js --so X01,X07
// ===========================================================================

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const RAIZ = __dirname;
const WORKFLOW = ".github/workflows/provas-do-servidor.yml";
const SUITE_CI = "test/ci_obrigatorio.test.js";
const SUITE_UNI = "test/unicidade_do_portador.test.js";
const GUARDA_UNI = "test/unicidade_do_portador.js";
const CENSO = "test/censo_de_suites.js";
const PISO_GLOBAL = "ci/piso_do_portao.json";
const PISOS = "ci/pisos_autorizados.js";
const GUARDIAO = "ci/auditabilidade.js";
const INVENTARIO = "ci/inventario_de_execucao.js";
const JUIZ = "ci/portao_do_ci.js";
const PRETEST = "test/guarda_do_portao.js";
const ARTEFATO = "ci/artefato.js";
const MANIFESTO = "ci/artefato_produtivo.json";
const PACOTE = "package.json";
const SUITE_ART = "test/artefato_unico.test.js";

const COPIAR = ["package.json", ".github", "ci", "test", "docs", "server.js", "app.html", "contrato"];

function copiarArvore() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), "os54c3x-"));
  for (const item of COPIAR) {
    fs.cpSync(path.join(RAIZ, item), path.join(destino, item), { recursive: true });
  }
  const git = (...args) =>
    execFileSync("git", ["-C", destino, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "user.email", "arnes@os54c4.local");
  git("config", "user.name", "arnes OS 54-C4");
  git("add", "-A");
  git("commit", "-q", "-m", "arvore integra (ancora do piso)");
  return destino;
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
    throw new Error(id + ": ancora ambigua/ausente (" + (partes.length - 1) + ") em " + relativo + " :: " + de.slice(0, 70));
  }
  const mutado = partes.join(para);
  if (mutado === alvo.texto) throw new Error(id + ": a mutacao nao alterou byte nenhum em " + relativo);
  gravar(dir, relativo, mutado, alvo.crlf);
}

/** Recorta um caso inteiro pelo FECHO INDENTADO, e nao por contagem de chaves:
 *  os corpos carregam chaves dentro de strings, e o nivel nunca volta a zero. */
function fatiar(texto, marca) {
  const inicio = texto.indexOf(marca);
  if (inicio < 0) return null;
  const fecho = NL + "  });" + NL;
  const fim = texto.indexOf(fecho, inicio);
  if (fim < 0) return null;
  return { inicio: texto.lastIndexOf(NL, inicio) + 1, fim: fim + fecho.length };
}

function trivializar(dir, relativo, marca, id) {
  const alvo = ler(dir, relativo);
  const fatia = fatiar(alvo.texto, marca);
  if (!fatia) throw new Error(id + ": caso nao encontrado em " + relativo + " :: " + marca);
  const trecho = alvo.texto.slice(fatia.inicio, fatia.fim);
  const titulo = /test\("([^"]+)"/.exec(trecho)[1];
  const aninhado = /await t\.test/.test(trecho);
  const novo = aninhado
    ? '  await t.test("' + titulo + '", () => {' + NL + "    assert.ok(true);" + NL + "  });" + NL
    : '  test("' + titulo + '", () => {' + NL + "    assert.ok(true);" + NL + "  });" + NL;
  gravar(dir, relativo, alvo.texto.slice(0, fatia.inicio) + novo + alvo.texto.slice(fatia.fim), alvo.crlf);
}

// --- o ORACULO: a cadeia oficial, na ordem do CI ---------------------------

function rodar(dir, comando, args) {
  try {
    const saida = execFileSync(comando, args, {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: comando === "npm", timeout: 1800000,
    });
    return { exit: 0, saida };
  } catch (e) {
    const exit = typeof e.status === "number" ? e.status : null;
    return { exit, saida: String((e.stdout || "") + (e.stderr || "")) };
  }
}

function numerosDe(saida) {
  const p = (k) => {
    const m = new RegExp("^(?:#|ℹ)\\s+" + k + "\\s+([0-9]+)", "m").exec(saida);
    return m ? Number(m[1]) : -1;
  };
  return { casos: p("pass"), suites: p("suites") };
}

function cadeiaOficial(dir, id) {
  const provas = rodar(dir, "npm", ["test"]);
  if (provas.exit === null) throw new Error(id + ": `npm test` nao produziu codigo de saida");
  const n = numerosDe(provas.saida);
  if (provas.exit !== 0) return Object.assign({ vermelho: true, etapa: "npm test" }, n);

  const dirEvid = fs.mkdtempSync(path.join(os.tmpdir(), "os54c3x-evid-"));
  fs.writeFileSync(path.join(dirEvid, "npm-test.txt"), provas.saida);
  fs.writeFileSync(path.join(dirEvid, "exit.txt"), "0");

  const guardiao = rodar(dir, process.execPath, [path.join(dir, GUARDIAO)]);
  if (guardiao.exit === null) throw new Error(id + ": o guardiao nao produziu codigo de saida");
  if (guardiao.exit !== 0) { fs.rmSync(dirEvid, { recursive: true, force: true }); return Object.assign({ vermelho: true, etapa: "guardiao" }, n); }

  const inventario = rodar(dir, process.execPath, [path.join(dir, INVENTARIO)]);
  if (inventario.exit === null) throw new Error(id + ": o inventario nao produziu codigo de saida");
  if (inventario.exit !== 0) { fs.rmSync(dirEvid, { recursive: true, force: true }); return Object.assign({ vermelho: true, etapa: "inventario" }, n); }

  const juiz = rodar(dir, process.execPath, [
    path.join(dir, JUIZ), path.join(dirEvid, "npm-test.txt"), path.join(dirEvid, "exit.txt"), "--raiz", dir,
  ]);
  fs.rmSync(dirEvid, { recursive: true, force: true });
  if (juiz.exit === null) throw new Error(id + ": o juiz nao produziu codigo de saida");
  if (juiz.exit !== 0) return Object.assign({ vermelho: true, etapa: "juiz" }, n);

  const artefato = rodar(dir, process.execPath, [path.join(dir, ARTEFATO), "--conferir", "--raiz", dir]);
  if (artefato.exit === null) throw new Error(id + ": a autoridade do artefato nao produziu codigo de saida");
  if (artefato.exit !== 0) return Object.assign({ vermelho: true, etapa: "artefato" }, n);

  return Object.assign({ vermelho: false, etapa: "—" }, n);
}

// ===========================================================================
// AS QUINZE SABOTAGENS CRUZADAS (§ "Campanha cruzada minima" da OS)
// ===========================================================================

const SABOTAGENS = [
  {
    id: "X01", nome: "o inventario externo removido, a unicidade intacta",
    tipo: "renomear", de: INVENTARIO, para: INVENTARIO + ".desligado",
  },
  {
    id: "X02", nome: "a analise composta removida, o inventario intacto",
    tipo: "renomear", de: GUARDA_UNI, para: GUARDA_UNI + ".desligado",
  },
  {
    id: "X03", nome: "o inventario deixa de conhecer a suite da unicidade",
    aplicar: (d, i) => trocar(d, PISOS, '  "unicidade_do_portador.test.js": 112,' + NL, "", i),
  },
  {
    id: "X04", nome: "a unicidade sai do `pretest` (a chamada vira valor constante)",
    aplicar: (d, i) => trocar(
      d, PRETEST,
      "  const { estatistica } = conferirProvaDaUnicidade();",
      "  const estatistica = { arquivos: 0 };", i
    ),
  },
  {
    id: "X05", nome: "`data.file` desviado para um arquivo unico",
    aplicar: (d, i) => trocar(
      d, INVENTARIO,
      "      const registro = anotar(porArquivo, path.basename(d.file));",
      '      const registro = anotar(porArquivo, "unicidade_do_portador.test.js");', i
    ),
  },
  {
    id: "X06", nome: "nome obrigatorio mantido, mas em OUTRO arquivo",
    aplicar: (d, i) => {
      trocar(d, SUITE_UNI,
        '  test("UNI-P4: a AMARRAÇÃO é conferida, e a chamada removida reprova", () => {',
        '  test("UNI-P4z: a AMARRAÇÃO é conferida, e a chamada removida reprova", () => {', i);
      fs.writeFileSync(
        path.join(d, "test", "isca_unicidade.test.js"),
        [
          'const test = require("node:test");',
          'test("UNI-P4: a AMARRAÇÃO é conferida, e a chamada removida reprova", () => {});',
          "",
        ].join(NL),
        "utf8"
      );
    },
  },
  {
    id: "X07", nome: "caso da unicidade trivializado, o titulo preservado",
    aplicar: (d, i) => trivializar(d, SUITE_UNI, '  test("UNI-B4:', i),
  },
  {
    id: "X08", nome: "CI-18, CI-19 e CI-19b trivializadas, os titulos preservados",
    aplicar: (d, i) => {
      trivializar(d, SUITE_CI, 'await t.test("CI-18:', i);
      trivializar(d, SUITE_CI, 'await t.test("CI-19:', i);
      trivializar(d, SUITE_CI, 'await t.test("CI-19b:', i);
    },
  },
  {
    id: "X09", nome: "o passo proprio do guardiao removido do workflow",
    aplicar: (d, i) => trocar(
      d, WORKFLOW,
      "      - name: Guardião da auditabilidade" + NL + "        run: node ci/auditabilidade.js" + NL + NL,
      "", i
    ),
  },
  {
    id: "X10", nome: "uma das chamadas do `pretest` removida (o piso ancorado)",
    aplicar: (d, i) => trocar(
      d, PRETEST,
      "  const piso = conferirPisoAncorado();",
      "  const piso = { comparacoes: 0, ancoras: [] };", i
    ),
  },
  {
    id: "X11", nome: "pisos das DUAS familias rebaixados de uma vez",
    aplicar: (d, i) => {
      trocar(d, PISO_GLOBAL, '"casos_minimos": 927,', '"casos_minimos": 700,', i);
      trocar(d, CENSO, '"unicidade_do_portador.test.js": 48,', '"unicidade_do_portador.test.js": 16,', i);
    },
  },
  {
    id: "X12", nome: "recarimbo de TODOS os numeros editaveis, de uma vez",
    aplicar: (d, i) => {
      trocar(d, PISO_GLOBAL, '"casos_minimos": 927,', '"casos_minimos": 600,', i);
      trocar(d, PISO_GLOBAL, '"suites_minimas": 87,', '"suites_minimas": 70,', i);
      trocar(d, PISO_GLOBAL, '"casos": 927, "suites": 87', '"casos": 600, "suites": 70', i);
      trocar(d, SUITE_CI, "const CASOS_MEDIDOS_NA_BASE = 927;", "const CASOS_MEDIDOS_NA_BASE = 600;", i);
      trocar(d, SUITE_CI, "const SUITES_MEDIDAS_NA_BASE = 87;", "const SUITES_MEDIDAS_NA_BASE = 70;", i);
      trocar(d, CENSO, '"unicidade_do_portador.test.js": 48,', '"unicidade_do_portador.test.js": 16,', i);
      trocar(d, PISOS, '  "unicidade_do_portador.test.js": 48,', '  "unicidade_do_portador.test.js": 16,', i);
      trocar(d, PISOS, '  "unicidade_do_portador.test.js": 112,', '  "unicidade_do_portador.test.js": 16,', i);
    },
  },
  {
    id: "X13", nome: "um ramo morto E o inventario reduzido junto",
    aplicar: (d, i) => {
      trocar(d, GUARDA_UNI,
        "quando: (s) => s.criaSoquete && s.vinculaPorta,", "quando: (s) => s && false,", i);
      trocar(d, PISOS, '  "unicidade_do_portador.test.js": 112,', '  "unicidade_do_portador.test.js": 60,', i);
    },
  },
  {
    id: "X14", nome: "o passo do resumo removido do workflow",
    aplicar: (d, i) => {
      const alvo = ler(d, WORKFLOW);
      const inicio = alvo.texto.indexOf("      - name: Resumo (verde");
      const fim = alvo.texto.indexOf("      - name: Evidência arquivada");
      if (inicio < 0 || fim < 0 || fim < inicio) throw new Error(i + ": passo de resumo nao encontrado");
      gravar(d, WORKFLOW, alvo.texto.slice(0, inicio) + alvo.texto.slice(fim), alvo.crlf);
    },
  },
  // =========================================================================
  // [OS 54-C4] OS OITO VETORES DA COMPOSICAO NOVA.
  //
  // A folha da OS 54-C3 nasceu sobre `99d2eb6`, uma arvore onde `ci/artefato.js`
  // nao existia: a campanha cruzada dela cruzava a auditabilidade com a
  // unicidade POR CAPACIDADE, e nao com a AUTORIDADE DO ARTEFATO. Sobre
  // `9795df7` essa e a metade que importa — foi ela que a OS 52-R4 homologou, e
  // e ela que decide o que pode ser implantado.
  //
  // Os oito abaixo atacam exatamente a costura: desligar a autoridade do
  // artefato deixando a auditabilidade intacta (X16, X17, X22), ampliar ou
  // encolher o conjunto implantavel (X18, X19), introduzir pacote e segundo
  // arranque (X20, X21), e a regressao COORDENADA entre as duas familias (X23).
  // =========================================================================
  {
    id: "X16", nome: "o passo do ARTEFATO removido do workflow, a auditabilidade intacta",
    aplicar: (d, i) => trocar(
      d, WORKFLOW,
      "      - name: Artefato produtivo único" + NL + "        run: node ci/artefato.js --conferir --raiz ." + NL + NL,
      "", i
    ),
  },
  {
    id: "X17", nome: "a chamada do ARTEFATO removida do `pretest`",
    aplicar: (d, i) => trocar(
      d, PRETEST,
      "  const artefato = exigirArtefatoUnico();",
      "  const artefato = { produtivos: [], excluidos: 0, ancoras: 0 };", i
    ),
  },
  {
    id: "X18", nome: "o conjunto produtivo AMPLIADO (um caminho promovido)",
    aplicar: (d, i) => trocar(
      d, MANIFESTO,
      "  \"produtivos\": [" + NL + "    \"server.js\"," + NL + "    \"package.json\"" + NL + "  ],",
      "  \"produtivos\": [" + NL + "    \"server.js\"," + NL + "    \"package.json\"," + NL + "    \"app.html\"" + NL + "  ],", i
    ),
  },
  {
    id: "X19", nome: "`server.js` RETIRADO do conjunto declarado",
    aplicar: (d, i) => trocar(
      d, MANIFESTO,
      "  \"produtivos\": [" + NL + "    \"server.js\"," + NL + "    \"package.json\"" + NL + "  ],",
      "  \"produtivos\": [" + NL + "    \"package.json\"" + NL + "  ],", i
    ),
  },
  {
    id: "X20", nome: "ZIP implantavel introduzido na raiz, sem extensao",
    aplicar: (d) => {
      // Bytes de um ZIP de verdade (assinatura `PK\x03\x04`), num caminho sem
      // extensao — o cenario exato que derrubou a OS 52-C1: nao ha extensao a
      // proibir, e nenhum scanner reconhece o conteudo.
      const zip = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.alloc(26),
        Buffer.from("entrega", "latin1"),
      ]);
      fs.writeFileSync(path.join(d, "entrega"), zip);
    },
  },
  {
    id: "X21", nome: "segundo arranque implantavel no manifesto",
    aplicar: (d, i) => trocar(
      d, PACOTE,
      "\"start\": \"node server.js\",",
      "\"start\": \"node server.js\",\n    \"arranque\": \"node server.js\",", i
    ),
  },
  {
    id: "X22", nome: "a AUTORIDADE do artefato trivializada, o resto intacto",
    aplicar: (d, i) => trocar(
      d, ARTEFATO,
      "  const reprovacoes = [];" + NL + "  const reprovar = (m) => reprovacoes.push(m);",
      "  const reprovacoes = [];" + NL +
      "  if (true) return { reprovacoes, dados: { produtivos: [\"package.json\", \"server.js\"], excluidos: 0, artefato: [], ancoras: 1 } };" + NL +
      "  const reprovar = (m) => reprovacoes.push(m);", i
    ),
  },
  {
    id: "X23", nome: "regressao COORDENADA: artefato trivializado E auditabilidade esvaziada",
    aplicar: (d, i) => {
      // A sabotagem que so uma campanha CRUZADA pode medir: cada metade,
      // sozinha, ainda seria pega pela campanha da propria familia. Juntas, a
      // aposta e que uma sirva de cobertura para a outra.
      trocar(
        d, ARTEFATO,
        "  const reprovacoes = [];" + NL + "  const reprovar = (m) => reprovacoes.push(m);",
        "  const reprovacoes = [];" + NL +
        "  if (true) return { reprovacoes, dados: { produtivos: [\"package.json\", \"server.js\"], excluidos: 0, artefato: [], ancoras: 1 } };" + NL +
        "  const reprovar = (m) => reprovacoes.push(m);", i
      );
      trivializar(d, SUITE_ART, "  test(\"ART-05:", i);
      trivializar(d, SUITE_CI, "await t.test(\"CI-18:", i);
      trivializar(d, SUITE_CI, "await t.test(\"CI-20:", i);
    },
  },
  {
    // [OS 54-C4] O VETOR QUE DISCRIMINA X07.
    //
    // X07 trivializa `UNI-B4` mantendo o titulo, e SOBREVIVE: o nome continua
    // executando e passando, a contagem por origem nao muda, e a contagem
    // textual do censo tambem nao — o corpo daquele caso nao carrega ocorrencia
    // nenhuma de `test(`. Nenhuma autoridade desta arvore le o CORPO de um caso.
    //
    // A pergunta que importa nao e "o mutante sobreviveu?" e sim "passou algum
    // DEFEITO por causa disso?". Este vetor responde: ele aplica a trivializacao
    // de X07 E o defeito que `UNI-B4` existe para pegar — o ramo do analisador
    // tornado MORTO. Se ficar vermelho, X07 e perda de cobertura declarada, e
    // nao escape material: a autoridade (`conferirProvaDaUnicidade`, exercitada
    // contra as fixtures no `pretest`) continua de pe sem o caso que a descreve.
    id: "X24", nome: "UNI-B4 trivializada E o ramo MORTO introduzido juntos",
    aplicar: (d, i) => {
      trivializar(d, SUITE_UNI, "  test(\"UNI-B4:", i);
      trocar(d, GUARDA_UNI, "quando: (s) => s.criaSoquete && s.vinculaPorta,", "quando: (s) => s && false,", i);
    },
  },
  { id: "X15", nome: "CONTROLE INTEGRO (tem de ficar VERDE)", controle: true, aplicar: () => {} },
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

function aplicarEm(dir, s) {
  if (s.tipo === "renomear") {
    const de = path.join(dir, s.de);
    if (!fs.existsSync(de)) throw new Error(s.id + ": arquivo ausente: " + s.de);
    fs.renameSync(de, path.join(dir, s.para));
  } else {
    s.aplicar(dir, s.id);
  }
}

if (process.argv.includes("--secar")) {
  let ruins = 0;
  for (const s of alvos) {
    const dir = copiarArvore();
    try {
      aplicarEm(dir, s);
      const sujo = execFileSync("git", ["-C", dir, "status", "--porcelain", "-uall"], { encoding: "utf8" }).trim();
      if (!s.controle && sujo === "") { ruins++; console.log("SEM EFEITO  " + s.id.padEnd(5) + s.nome); }
      else console.log("ancora ok   " + s.id.padEnd(5) + s.nome);
    } catch (erro) {
      ruins++;
      console.log("ANCORA RUIM " + s.id.padEnd(5) + String((erro && erro.message) || erro).slice(0, 150));
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("ancoras invalidas ou sem efeito: " + ruins + "/" + alvos.length);
  process.exit(ruins === 0 ? 0 : 1);
}

console.log("controle de partida na copia limpa…");
const copiaControle = copiarArvore();
const partida = cadeiaOficial(copiaControle, "CONTROLE");
fs.rmSync(copiaControle, { recursive: true, force: true });
if (partida.vermelho) {
  console.error("A COPIA LIMPA JA ESTA VERMELHA (" + partida.etapa + ") — campanha invalida.");
  process.exit(1);
}
console.log("copia limpa VERDE · " + partida.casos + " casos em " + partida.suites + " suites" + NL);

const resultados = [];
for (const s of alvos) {
  const dir = copiarArvore();
  let veredito;
  try {
    aplicarEm(dir, s);
    veredito = cadeiaOficial(dir, s.id);
  } catch (erro) {
    console.error("ABORTA " + s.id + ": " + ((erro && erro.message) || erro));
    fs.rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(dir, { recursive: true, force: true });

  const esperadoVerde = Boolean(s.controle);
  const ok = esperadoVerde ? !veredito.vermelho : veredito.vermelho;
  resultados.push({ id: s.id, nome: s.nome, ok, etapa: veredito.etapa, casos: veredito.casos });
  console.log(
    (ok ? "PEGA   " : "ESCAPOU") + " " + s.id.padEnd(5) +
    " " + (veredito.vermelho ? "vermelho" : "  verde ") +
    " em " + veredito.etapa.padEnd(10) +
    " casos=" + String(veredito.casos).padStart(4) +
    "  " + s.nome
  );
}

console.log(NL + "controle de chegada na copia limpa…");
const copiaFim = copiarArvore();
const chegada = cadeiaOficial(copiaFim, "CHEGADA");
fs.rmSync(copiaFim, { recursive: true, force: true });
console.log("copia limpa: " + (chegada.vermelho ? "VERMELHA em " + chegada.etapa : "VERDE") + " · " + chegada.casos + " casos");

const escaparam = resultados.filter((r) => !r.ok);
console.log(NL + "detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const r of escaparam) console.log("  ESCAPOU " + r.id + ": " + r.nome);
if (chegada.vermelho || escaparam.length > 0) process.exit(1);
