// ===========================================================================
// CAMPANHA DA OS 54-C6 — O CÓDIGO DE SAÍDA DO VEREDITO CHEGA AO JOB?
//
// ===========================================================================
// O QUE ESTA CAMPANHA MEDE, E POR QUE A DA C5 NÃO MEDE
// ===========================================================================
//
// `mutacoes_c5.js` sabota a INVOCAÇÃO: ela troca o comando por `echo`, por
// `printf`, por comentário, por string, por heredoc, por atribuição. Todas as
// vinte e sete sabotagens de lá respondem à mesma pergunta — "isso vai RODAR?".
//
// A OS 54-R5 mostrou que a pergunta é insuficiente. Com
//
//     run: node ci/portao_do_ci.js "$E/npm-test.txt" "$E/exit.txt" || echo "seguimos"
//
// o juiz RODA, reprova, sai com 1 — e o passo sai com 0. Toda a campanha da C5
// aprova, porque a invocação está lá e é executável. O que faltava perguntar é
// **o passo DEPENDE do resultado disso?**
//
// Esta campanha é a dessa segunda pergunta. Nada aqui esconde a chamada: em
// todo cenário do Grupo A o juiz continua sendo executado, e o que muda é
// apenas quem responde pelo código de saída do passo.
//
// O ORÁCULO é a cadeia oficial INTEIRA, na ordem em que o CI a roda, e com o
// juiz executado pela FORMA DECLARADA — o entrypoint que o `runs.main` do
// `action.yml` apontar, com as entradas em `INPUT_*`, que é como o runner o
// executa:
//
//   `npm test` (com o `pretest`) -> guardião -> preservação do código de saída
//   -> inventário -> AÇÃO DO PORTÃO -> artefato.
//
// A evidência NÃO é forjada: é a saída real do `npm test` daquela árvore e o
// código de saída real dele. É por isso que o controle `D25` — uma suíte
// deliberadamente vermelha — produz vermelho pelo caminho de verdade, e não
// por um número escrito à mão.
//
// A árvore mutada é uma CÓPIA DESCARTÁVEL com histórico próprio: um repositório
// novo com UM commit da árvore ÍNTEGRA, feito ANTES da sabotagem. Sem histórico
// o piso ancorado da OS 52-C3 não tem âncora e reprova por falta de git, que é
// vermelho pelo motivo errado.
//
// TRAVAS, e todas param a campanha em vez de mentir:
//   1) âncora conferida: ausente ou ambígua ABORTA;
//   2) alteração efetiva: byte igual ABORTA;
//   3) controle verde ANTES e DEPOIS da rodada;
//   4) veredito indeterminado (processo sem código de saída) ABORTA;
//   5) DUAS formas canônicas continuam VERDES (D26, D28) — sem isso, uma
//      autoridade que recusasse tudo passaria nos negativos e pareceria
//      rigorosa estando quebrada.
//
// Uso:
//   node mutacoes_c6.js            # campanha inteira
//   node mutacoes_c6.js --listar   # só lista
//   node mutacoes_c6.js --secar    # só confere as âncoras
//   node mutacoes_c6.js --so A01,D26
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
const ACAO_YML = ".github/actions/portao/action.yml";
const ACAO_JS = ".github/actions/portao/index.js";
const JUIZ = "ci/portao_do_ci.js";
const GUARDIAO = "ci/auditabilidade.js";
const PRESERVACAO = "ci/codigo_de_saida.js";
const INVENTARIO = "ci/inventario_de_execucao.js";
const ARTEFATO = "ci/artefato.js";
const PISO_GLOBAL = "ci/piso_do_portao.json";
const CENSO = "test/censo_de_suites.js";
const PISOS = "ci/pisos_autorizados.js";
const GUARDA_PRETEST = "test/guarda_do_portao.js";
const SUITE = "test/codigo_de_saida.test.js";

// ---------------------------------------------------------------------------
// AS ÂNCORAS, EXTRAÍDAS DO ARQUIVO REAL
// ---------------------------------------------------------------------------
//
// Copiar o YAML para dentro de um literal aqui criaria uma segunda verdade, que
// envelhece calada e faz a sabotagem virar um no-op silencioso no dia em que
// alguém reformatar o arquivo. A C5 aprendeu isso com o próprio controle `E27`.

function linhasDoWorkflow() {
  return fs.readFileSync(path.join(RAIZ, WORKFLOW), "utf8").split(CR + NL).join(NL).split(NL);
}

/** O bloco INTEIRO da invocação do passo do juiz: a linha do `uses:` e o
 *  `with:` com as duas entradas. É ele que os cenários do Grupo A trocam por um
 *  `run:` composto — que é como alguém devolveria ao passo decisivo o campo de
 *  shell que a R5 explorou. */
function invocacaoDoJuiz() {
  const linhas = linhasDoWorkflow();
  let inicio = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (/^\s{4,}-\s+name:\s*Portão fail-closed\s*$/.test(linhas[i])) { inicio = i; break; }
  }
  if (inicio < 0) throw new Error("passo do juiz não encontrado no workflow real");
  let iUses = -1;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (/^\s{4,}-\s+name:/.test(linhas[i])) break;
    if (/^\s+uses:/.test(linhas[i])) { iUses = i; break; }
  }
  if (iUses < 0) throw new Error("o passo do juiz não tem `uses:` no workflow real");
  let fim = iUses;
  for (let i = iUses + 1; i < linhas.length; i++) {
    if (linhas[i].trim() === "" || /^\s{4,}-\s+name:/.test(linhas[i])) break;
    fim = i;
  }
  return linhas.slice(iUses, fim + 1).join(NL);
}

const CABECALHO_DO_JUIZ = "      - name: Portão fail-closed";
const RECUO = "        ";

/** Um `run:` que devolve o campo de shell ao passo do juiz. `script` pode ter
 *  várias linhas: nesse caso vira bloco escalar. */
function runNoJuiz(script) {
  const linhas = String(script).split(NL);
  if (linhas.length === 1) return RECUO + "run: " + linhas[0];
  return RECUO + "run: |" + NL + linhas.map((l) => RECUO + "  " + l).join(NL);
}

const CHAMADA_DO_JUIZ = 'node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"';

// ---------------------------------------------------------------------------
// A ÁRVORE DESCARTÁVEL
// ---------------------------------------------------------------------------

const COPIAR = ["package.json", ".github", "ci", "test", "docs", "server.js", "app.html", "contrato"];

function copiarArvore() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), "os54c6-"));
  for (const item of COPIAR) {
    fs.cpSync(path.join(RAIZ, item), path.join(destino, item), { recursive: true });
  }
  const git = (...args) =>
    execFileSync("git", ["-C", destino, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "user.email", "arnes@os54c6.local");
  git("config", "user.name", "arnes OS 54-C6");
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

/** Troca a INVOCAÇÃO do passo do juiz por outra coisa. */
const noJuiz = (novo) => (d, i) => trocar(d, WORKFLOW, invocacaoDoJuiz(), novo, i);

/** Acrescenta um atributo ao passo do juiz, logo abaixo do `name:`. */
const atributoNoJuiz = (linha) => (d, i) =>
  trocar(d, WORKFLOW, CABECALHO_DO_JUIZ + NL, CABECALHO_DO_JUIZ + NL + RECUO + linha + NL, i);

// ---------------------------------------------------------------------------
// O ORÁCULO — a cadeia oficial, na ordem do CI e com o juiz pela forma real
// ---------------------------------------------------------------------------

function rodar(dir, comando, args, extraEnv) {
  const ambiente = Object.assign({}, process.env, extraEnv || {});
  delete ambiente.NODE_TEST_CONTEXT;
  try {
    const saida = execFileSync(comando, args, {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      shell: comando === "npm", timeout: 1800000, env: ambiente,
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

/** O entrypoint que o `action.yml` daquela árvore declara. Ler o manifesto em
 *  vez de escrever o caminho é o que faz o cenário "entrypoint substituído"
 *  significar alguma coisa. */
function entrypointDeclarado(dir) {
  const manifesto = fs.readFileSync(path.join(dir, ACAO_YML), "utf8");
  const m = /^\s*main:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(manifesto);
  if (!m) throw new Error("`runs.main` ausente do manifesto da ação");
  return path.join(dir, ".github", "actions", "portao", m[1]);
}

/** A cadeia oficial INTEIRA. Devolve `{ vermelho, etapa, casos, suites }`.
 *
 *  `resumo` e `upload` NÃO entram aqui de propósito: eles rodam com `always()`
 *  no provedor, e o que esta campanha mede é se alguma etapa OBRIGATÓRIA
 *  deixou de reprovar. Que os dois `always()` não convertem vermelho em verde é
 *  propriedade do runner, e não coisa que um arnês local possa afirmar. */
function cadeiaOficial(dir, id) {
  const provas = rodar(dir, "npm", ["test"]);
  if (provas.exit === null) throw new Error(id + ": `npm test` nao produziu codigo de saida");
  const n = numerosDe(provas.saida);

  // A EVIDÊNCIA É A DE VERDADE: a saída literal e o código de saída reais.
  const dirEvid = fs.mkdtempSync(path.join(os.tmpdir(), "os54c6-evid-"));
  const saida = path.join(dirEvid, "npm-test.txt");
  const marcador = path.join(dirEvid, "exit.txt");
  fs.writeFileSync(saida, provas.saida, "utf8");
  fs.writeFileSync(marcador, String(provas.exit), "utf8");
  const limpar = () => fs.rmSync(dirEvid, { recursive: true, force: true });

  if (provas.exit !== 0) { limpar(); return Object.assign({ vermelho: true, etapa: "npm test" }, n); }

  for (const [etapa, args] of [
    ["guardiao", [path.join(dir, GUARDIAO)]],
    ["preservacao", [path.join(dir, PRESERVACAO)]],
    ["inventario", [path.join(dir, INVENTARIO)]],
  ]) {
    const r = rodar(dir, process.execPath, args);
    if (r.exit === null) { limpar(); throw new Error(id + ": a etapa `" + etapa + "` nao produziu codigo de saida"); }
    if (r.exit !== 0) { limpar(); return Object.assign({ vermelho: true, etapa }, n); }
  }

  // O JUIZ, PELA FORMA DECLARADA: o entrypoint da ação, com as entradas em
  // `INPUT_*` e `GITHUB_WORKSPACE` apontando para a árvore — que é exatamente
  // como o runner executa uma ação JavaScript local.
  let entrypoint;
  try {
    entrypoint = entrypointDeclarado(dir);
  } catch (erro) {
    limpar();
    return Object.assign({ vermelho: true, etapa: "acao (manifesto)" }, n);
  }
  if (!fs.existsSync(entrypoint)) {
    limpar();
    return Object.assign({ vermelho: true, etapa: "acao (entrypoint)" }, n);
  }
  const juiz = rodar(dir, process.execPath, [entrypoint], {
    GITHUB_WORKSPACE: dir, INPUT_SAIDA: saida, INPUT_MARCADOR: marcador,
  });
  if (juiz.exit === null) { limpar(); throw new Error(id + ": a acao do portao nao produziu codigo de saida"); }
  if (juiz.exit !== 0) { limpar(); return Object.assign({ vermelho: true, etapa: "juiz (acao)" }, n); }

  const art = rodar(dir, process.execPath, [path.join(dir, ARTEFATO), "--conferir", "--raiz", dir]);
  if (art.exit === null) { limpar(); throw new Error(id + ": a etapa `artefato` nao produziu codigo de saida"); }
  limpar();
  if (art.exit !== 0) return Object.assign({ vermelho: true, etapa: "artefato" }, n);
  return Object.assign({ vermelho: false, etapa: "—" }, n);
}

// ===========================================================================
// AS SABOTAGENS
// ===========================================================================

const SABOTAGENS = [
  // --- GRUPO A: o resultado do juiz é absorvido por outra coisa -----------
  //
  // Em todos os oito o juiz CONTINUA SENDO EXECUTADO. Nenhum deles some com a
  // chamada, e é por isso que a campanha da C5 aprovaria os oito.
  {
    id: "A01", nome: "juiz seguido por comando de mensagem que termina com sucesso",
    aplicar: noJuiz(runNoJuiz(CHAMADA_DO_JUIZ + ' || echo "seguimos"')),
  },
  {
    id: "A02", nome: "juiz seguido por comando neutro do sistema",
    aplicar: noJuiz(runNoJuiz(CHAMADA_DO_JUIZ + NL + ":")),
  },
  {
    id: "A03", nome: "juiz seguido por executavel de sucesso explicito",
    aplicar: noJuiz(runNoJuiz(CHAMADA_DO_JUIZ + " || /bin/true")),
  },
  {
    id: "A04", nome: "juiz seguido por encerramento explicito com zero",
    aplicar: noJuiz(runNoJuiz(CHAMADA_DO_JUIZ + NL + "exit 0")),
  },
  {
    id: "A05", nome: "resultado do juiz encaminhado para programa que termina com sucesso",
    aplicar: noJuiz(runNoJuiz(CHAMADA_DO_JUIZ + " | cat")),
  },
  {
    id: "A06", nome: "juiz iniciado em segundo plano sem espera autoritativa",
    aplicar: noJuiz(runNoJuiz(CHAMADA_DO_JUIZ + " &")),
  },
  {
    id: "A07", nome: "modo tolerante a erro ativado antes do juiz",
    aplicar: noJuiz(runNoJuiz("set +e" + NL + CHAMADA_DO_JUIZ)),
  },
  {
    id: "A08", nome: "juiz envolvido por interpretador intermediario",
    aplicar: noJuiz(runNoJuiz("bash -c '" + CHAMADA_DO_JUIZ.split('"').join("") + "'")),
  },

  // --- GRUPO B: a configuração do passo ----------------------------------
  { id: "B09", nome: "`continue-on-error` habilitado no passo do juiz", aplicar: atributoNoJuiz("continue-on-error: true") },
  { id: "B10", nome: "condicao que PULA o passo do juiz", aplicar: atributoNoJuiz("if: false") },
  {
    id: "B11", nome: "condicao que executa o juiz so em cenario incompativel",
    aplicar: atributoNoJuiz("if: ${{ runner.os == 'Windows' }}"),
  },
  { id: "B12", nome: "shell substituido no passo do juiz", aplicar: atributoNoJuiz("shell: pwsh") },
  {
    id: "B13", nome: "passo do juiz DUPLICADO, sendo um permissivo",
    aplicar: (d, i) => trocar(
      d, WORKFLOW,
      "      - name: Artefato produtivo único",
      CABECALHO_DO_JUIZ + NL + RECUO + "continue-on-error: true" + NL + invocacaoDoJuiz() + NL + NL +
      "      - name: Artefato produtivo único",
      i
    ),
  },
  {
    id: "B14", nome: "nome do passo preservado com CONTEUDO diferente",
    aplicar: (d, i) => trocar(d, WORKFLOW, RECUO + "uses: ./.github/actions/portao", RECUO + "uses: ./.github/actions/sombra", i),
  },
  {
    id: "B15", nome: "evidencia trocada na entrada do juiz",
    aplicar: (d, i) => trocar(d, WORKFLOW, "saida: ${{ env.EVIDENCIA }}/npm-test.txt", "saida: ${{ env.EVIDENCIA }}/sombra.txt", i),
  },
  {
    id: "B16", nome: "marcador trocado na entrada do juiz",
    aplicar: (d, i) => trocar(d, WORKFLOW, "marcador: ${{ env.EVIDENCIA }}/exit.txt", "marcador: ${{ env.EVIDENCIA }}/zero.txt", i),
  },

  // --- GRUPO C: a proteção externa ---------------------------------------
  { id: "C17", nome: "autoridade externa REMOVIDA do disco", tipo: "renomear", de: PRESERVACAO, para: PRESERVACAO + ".desligado" },
  {
    id: "C18", nome: "chamada externa retirada do `pretest`",
    aplicar: (d, i) => trocar(
      d, GUARDA_PRETEST,
      "    ...conferirPreservacaoDoCodigo({ executar: true }),",
      "    // ...conferirPreservacaoDoCodigo({ executar: true }),",
      i
    ),
  },
  {
    id: "C19", nome: "teste nominal TRIVIALIZADO (o nome fica, o corpo vira nada)",
    // O nome continua no lugar, continua executando e continua APROVANDO — é
    // por isso que nem o censo, nem o piso por execução, nem a exigência
    // nominal o alcançam. Quem o alcança é o PESO dos casos nominais, que mora
    // em `ci/pisos_autorizados.js`, fora do conjunto varrido pelo glob.
    aplicar: (d, i) => {
      const alvo = ler(d, SUITE);
      const abre = alvo.texto.indexOf('await t.test("SAI-19');
      if (abre < 0) throw new Error(i + ": caso nominal SAI-19 nao encontrado");
      const fim = alvo.texto.indexOf("await t.test(", abre + 10);
      if (fim < 0) throw new Error(i + ": fim do caso SAI-19 nao encontrado");
      const cabeca = alvo.texto.slice(abre, alvo.texto.indexOf("=> {", abre) + 4);
      gravar(
        d, SUITE,
        alvo.texto.slice(0, abre) + cabeca + NL + "    assert.ok(true);" + NL + "  });" + NL + NL + "  " +
          alvo.texto.slice(fim),
        alvo.crlf
      );
    },
  },
  {
    id: "C20", nome: "forma canonica retirada da lista protegida",
    aplicar: (d, i) => trocar(
      d, PRESERVACAO,
      `  Object.freeze({ passo: "Guardião da auditabilidade", alvo: "ci/auditabilidade.js" }),`,
      "",
      i
    ),
  },
  {
    id: "C21", nome: "identidade RECARIMBADA depois da neutralizacao",
    aplicar: (d, i) => {
      // A sabotagem completa, e não meia: apaga a suíte da autoridade nova E
      // realinha TODOS os números que a denunciariam — o piso global, o censo e
      // os dois pisos externos. É o encolhimento coordenado da OS 52-R2,
      // aplicado à família desta OS.
      fs.rmSync(path.join(d, SUITE));
      trocar(d, PISO_GLOBAL, '"casos_minimos": 956,', '"casos_minimos": 927,', i + "/piso");
      trocar(d, PISO_GLOBAL, '"medido_na_arvore_desta_os": { "casos": 956, "suites": 87 }',
        '"medido_na_arvore_desta_os": { "casos": 927, "suites": 87 }', i + "/carimbo");
      trocar(d, CENSO, `  "codigo_de_saida.test.js": 31,`, "", i + "/censo");
      trocar(d, PISOS, `  "codigo_de_saida.test.js": 31,`, "", i + "/piso-textual");
      trocar(d, PISOS, `  "codigo_de_saida.test.js": 29,`, "", i + "/piso-executado");
    },
  },
  {
    id: "C22", nome: "entrypoint da acao local SUBSTITUIDO por um que aprova",
    aplicar: (d) => {
      fs.writeFileSync(
        path.join(d, ACAO_JS),
        '"use strict";' + NL + "process.exitCode = 0;" + NL,
        "utf8"
      );
    },
  },
  {
    id: "C23", nome: "runtime Node da acao alterado",
    aplicar: (d, i) => trocar(d, ACAO_YML, "using: 'node24'", "using: 'node20'", i),
  },
  {
    id: "C24", nome: "invocacao movida para VARIAVEL no passo do guardiao",
    aplicar: (d, i) => trocar(
      d, WORKFLOW,
      RECUO + "run: node ci/auditabilidade.js",
      RECUO + "run: |" + NL + RECUO + '  CMD="node ci/auditabilidade.js"' + NL + RECUO + "  $CMD",
      i
    ),
  },

  // --- GRUPO D: os controles ---------------------------------------------
  {
    // A §4 exige que uma suíte deliberadamente vermelha produza job vermelho —
    // e aqui isso passa pela cadeia inteira, com evidência real, até a ação do
    // portão devolver o código do juiz.
    id: "D25", nome: "CONTROLE NEGATIVO: suite deliberadamente VERMELHA produz job vermelho",
    aplicar: (d) => {
      fs.appendFileSync(
        path.join(d, "test/chat_contrato.test.js"),
        NL + 'test("SONDA-C6: caso deliberadamente vermelho", () => { assert.equal(1, 2); });' + NL,
        "utf8"
      );
    },
  },
  { id: "D26", nome: "CONTROLE: arvore INTEGRA produz job verde", controle: true, aplicar: () => {} },
  {
    // A trava contra o excesso de zelo: a forma canônica ALTERNATIVA de um
    // passo em `run:` — bloco escalar, que o próprio workflow já usa — tem de
    // continuar aceita. Uma autoridade que a recusasse reprovaria o repositório
    // íntegro no dia em que alguém quebrasse uma linha comprida.
    id: "D28", nome: "CONTROLE: chamada canonica ALTERNATIVA conserva o resultado", controle: true,
    aplicar: (d, i) => trocar(
      d, WORKFLOW,
      RECUO + "run: node ci/codigo_de_saida.js",
      RECUO + "run: |" + NL + RECUO + "  node ci/codigo_de_saida.js",
      i
    ),
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
      if (s.id !== "D26" && sujo === "") { ruins++; console.log("SEM EFEITO  " + s.id.padEnd(5) + s.nome); }
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

console.log("controle de partida na copia limpa...");
const copiaControle = copiarArvore();
const partida = cadeiaOficial(copiaControle, "CONTROLE");
fs.rmSync(copiaControle, { recursive: true, force: true });
if (partida.vermelho) {
  console.error("A COPIA LIMPA JA ESTA VERMELHA (" + partida.etapa + ") — campanha invalida.");
  process.exit(1);
}
console.log("copia limpa VERDE - " + partida.casos + " casos em " + partida.suites + " suites" + NL);

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
    " em " + veredito.etapa.padEnd(18) +
    " casos=" + String(veredito.casos).padStart(4) +
    "  " + s.nome
  );
}

console.log(NL + "controle de chegada na copia limpa...");
const copiaFim = copiarArvore();
const chegada = cadeiaOficial(copiaFim, "CHEGADA");
fs.rmSync(copiaFim, { recursive: true, force: true });
console.log("copia limpa: " + (chegada.vermelho ? "VERMELHA em " + chegada.etapa : "VERDE") + " - " + chegada.casos + " casos");

const escaparam = resultados.filter((r) => !r.ok);
console.log(NL + "detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const r of escaparam) console.log("  ESCAPOU " + r.id + ": " + r.nome);
if (chegada.vermelho || escaparam.length > 0) process.exit(1);
