// ===========================================================================
// CAMPANHA DA OS 54-C5 — NEUTRALIZAÇÃO NOMINAL DAS INVOCAÇÕES.
//
// ===========================================================================
// O QUE ESTA CAMPANHA MEDE, E POR QUE NENHUMA DAS OUTRAS MEDE
// ===========================================================================
//
// `mutacoes_c2.js` sabota a auditabilidade e `mutacoes_cruzada.js` sabota a
// composição. As duas pegavam a saída das autoridades do workflow — mas SEMPRE
// por REMOÇÃO: apagavam o passo inteiro.
//
// Remover quebra a âncora, e o texto some junto. A detecção vinha daí, e não de
// autoridade nenhuma: a OS 54-R4 provou isso trocando
//
//     run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" …
//
// por
//
//     run: echo node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" …
//
// O texto continuava inteiro, o comando não rodava, e o veredito ficava VERDE.
// As quatro autoridades caíam pelo mesmo caminho.
//
// Esta campanha é o contrário daquelas: TODA sabotagem aqui PRESERVA o texto e
// só tira dele a qualidade de comando — `echo`, `printf`, comentário, string,
// heredoc, atribuição, `true`, `:`, saída antecipada, passo renomeado, isca em
// outro passo. Se a detecção dependesse da âncora, todas passariam.
//
// O ORÁCULO é a cadeia oficial inteira, na ordem em que o CI a roda:
//   `npm test` (com o `pretest`) -> guardião -> inventário -> juiz -> artefato.
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
//   5) DUAS formas canônicas têm de continuar VERDES (E26, E27) — sem isso, uma
//      autoridade que recusasse tudo passaria nos negativos e pareceria rigorosa
//      estando quebrada.
//
// Uso:
//   node mutacoes_c5.js            # campanha inteira
//   node mutacoes_c5.js --listar   # só lista
//   node mutacoes_c5.js --secar    # só confere as âncoras
//   node mutacoes_c5.js --so E01,E23
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
const JUIZ = "ci/portao_do_ci.js";
const GUARDIAO = "ci/auditabilidade.js";
const INVENTARIO = "ci/inventario_de_execucao.js";
const ARTEFATO = "ci/artefato.js";
const EXECUTAVEL = "ci/invocacao_executavel.js";
const PISO_GLOBAL = "ci/piso_do_portao.json";

/** Os escalares de `run:` dos quatro passos canônicos, EXTRAÍDOS do arquivo
 *  real em vez de copiados para dentro de um literal.
 *
 *  A primeira versão desta campanha os escrevia à mão, e o controle `E27` — que
 *  troca a forma canônica de fluxo para BLOCO ESCALAR e exige verde — reprovou
 *  por causa disso: a autoridade aceitava as duas formas, e quem caía eram as
 *  âncoras presas a uma delas. Cópia do YAML dentro do arnês envelhece calada.
 */
const { TRECHOS, comPrefixoNoComando, outraFormaDoRun } = require("./test/arvore_forjada.js");
const RUN = Object.freeze({
  get juiz() { return TRECHOS.runDoJuiz; },
  get guardiao() { return TRECHOS.runDoGuardiao; },
  get inventario() { return TRECHOS.runDoInventario; },
  get artefato() { return TRECHOS.runDoArtefato; },
});

const COPIAR = ["package.json", ".github", "ci", "test", "docs", "server.js", "app.html", "contrato"];

function copiarArvore() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), "os54c5-"));
  for (const item of COPIAR) {
    fs.cpSync(path.join(RAIZ, item), path.join(destino, item), { recursive: true });
  }
  const git = (...args) =>
    execFileSync("git", ["-C", destino, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "user.email", "arnes@os54c5.local");
  git("config", "user.name", "arnes OS 54-C5");
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

/** Troca a linha `run:` de um passo canônico. É o gesto desta campanha inteira:
 *  o passo continua lá, com o nome certo, e o comando deixa de ser comando. */
const run = (chave, novo) => (d, i) => trocar(d, WORKFLOW, RUN[chave], novo, i);

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

/** A cadeia oficial. `resumo` e `upload` NÃO entram aqui de propósito: eles
 *  rodam com `always()` no provedor, e o que esta campanha mede é se alguma
 *  etapa OBRIGATÓRIA deixou de reprovar. Que os dois `always()` não convertem
 *  vermelho em verde é propriedade do runner, provada por run externo real e
 *  registrada no placar — não é coisa que um arnês local possa afirmar. */
function cadeiaOficial(dir, id) {
  const provas = rodar(dir, "npm", ["test"]);
  if (provas.exit === null) throw new Error(id + ": `npm test` nao produziu codigo de saida");
  const n = numerosDe(provas.saida);
  if (provas.exit !== 0) return Object.assign({ vermelho: true, etapa: "npm test" }, n);

  const dirEvid = fs.mkdtempSync(path.join(os.tmpdir(), "os54c5-evid-"));
  fs.writeFileSync(path.join(dirEvid, "npm-test.txt"), provas.saida);
  fs.writeFileSync(path.join(dirEvid, "exit.txt"), "0");
  const limpar = () => fs.rmSync(dirEvid, { recursive: true, force: true });

  for (const [etapa, args] of [
    ["guardiao", [path.join(dir, GUARDIAO)]],
    ["inventario", [path.join(dir, INVENTARIO)]],
    ["juiz", [path.join(dir, JUIZ), path.join(dirEvid, "npm-test.txt"), path.join(dirEvid, "exit.txt"), "--raiz", dir]],
    ["artefato", [path.join(dir, ARTEFATO), "--conferir", "--raiz", dir]],
  ]) {
    const r = rodar(dir, process.execPath, args);
    if (r.exit === null) { limpar(); throw new Error(id + ": a etapa `" + etapa + "` nao produziu codigo de saida"); }
    if (r.exit !== 0) { limpar(); return Object.assign({ vermelho: true, etapa }, n); }
  }
  limpar();
  return Object.assign({ vermelho: false, etapa: "—" }, n);
}

// ===========================================================================
// AS SABOTAGENS — todas NOMINAIS: o texto fica, o comando some
// ===========================================================================

const SABOTAGENS = [
  // --- `echo`: o escape literal da R4, nas QUATRO autoridades ------------
  { id: "E01", nome: "juiz neutralizado por `echo`", aplicar: run("juiz", comPrefixoNoComando(RUN.juiz, "echo ")) },
  { id: "E02", nome: "guardiao neutralizado por `echo`", aplicar: run("guardiao", comPrefixoNoComando(RUN.guardiao, "echo ")) },
  { id: "E03", nome: "inventario neutralizado por `echo`", aplicar: run("inventario", comPrefixoNoComando(RUN.inventario, "echo ")) },
  { id: "E04", nome: "artefato neutralizado por `echo`", aplicar: run("artefato", comPrefixoNoComando(RUN.artefato, "echo ")) },

  // --- `printf`: a mesma ideia, com outro bico ---------------------------
  { id: "E05", nome: "juiz neutralizado por `printf`", aplicar: run("juiz", "        run: printf '%s\\n' 'node ci/portao_do_ci.js'") },
  { id: "E06", nome: "guardiao neutralizado por `printf`", aplicar: run("guardiao", "        run: printf '%s\\n' 'node ci/auditabilidade.js'") },
  { id: "E07", nome: "inventario neutralizado por `printf`", aplicar: run("inventario", "        run: printf '%s\\n' 'node ci/inventario_de_execucao.js'") },
  { id: "E08", nome: "artefato neutralizado por `printf`", aplicar: run("artefato", "        run: printf '%s\\n' 'node ci/artefato.js --conferir'") },

  // --- as outras formas da §2 -------------------------------------------
  {
    id: "E09", nome: "guardiao COMENTADO no bloco",
    aplicar: run("guardiao", "        run: |" + NL + "          # node ci/auditabilidade.js" + NL + "          true"),
  },
  {
    id: "E10", nome: "inventario dentro de HEREDOC",
    aplicar: run("inventario", "        run: |" + NL + "          cat <<EOF" + NL + "          node ci/inventario_de_execucao.js" + NL + "          EOF"),
  },
  {
    id: "E11", nome: "juiz guardado numa VARIAVEL",
    aplicar: run("juiz", "        run: |" + NL + '          CMD="node ci/portao_do_ci.js $EVIDENCIA/npm-test.txt $EVIDENCIA/exit.txt"' + NL + "          true"),
  },
  { id: "E12", nome: "artefato substituido por `true`", aplicar: run("artefato", "        run: 'true # node ci/artefato.js --conferir --raiz .'") },
  { id: "E13", nome: "guardiao substituido por `:`", aplicar: run("guardiao", "        run: ': node ci/auditabilidade.js'") },
  {
    id: "E14", nome: "inventario DEPOIS de saida antecipada",
    aplicar: run("inventario", "        run: |" + NL + "          exit 0" + NL + "          node ci/inventario_de_execucao.js"),
  },
  {
    id: "E15", nome: "passo do juiz RENOMEADO (a chamada muda de endereco)",
    aplicar: (d, i) => trocar(d, WORKFLOW, "      - name: Portão fail-closed", "      - name: Passo com outro nome", i),
  },
  {
    id: "E16", nome: "ISCA: a chamada real mudada para um passo NOVO",
    aplicar: (d, i) => {
      // O passo canônico continua existindo e continua com o texto — só que num
      // `echo`. A chamada de verdade foi para um passo novo, que roda depois do
      // upload. O texto está no lugar certo e o comando no lugar errado.
      trocar(d, WORKFLOW, RUN.guardiao, "        run: echo node ci/auditabilidade.js", i);
      const alvo = ler(d, WORKFLOW);
      gravar(
        d, WORKFLOW,
        alvo.texto + NL + "      - name: Passo tardio da isca" + NL + "        run: node ci/auditabilidade.js" + NL,
        alvo.crlf
      );
    },
  },
  {
    id: "E17", nome: "juiz como texto dentro de comando composto",
    aplicar: run("juiz", '        run: test -f "node ci/portao_do_ci.js" && echo "node ci/portao_do_ci.js $EVIDENCIA/npm-test.txt $EVIDENCIA/exit.txt"'),
  },

  // --- as formas ANTIGAS, mantidas para comparação -----------------------
  //
  // Elas já eram pegas antes desta OS. Estão aqui para que o placar mostre que
  // a correção não trocou uma cobertura por outra.
  {
    id: "E18", nome: "REMOCAO do passo do guardiao (a forma antiga)",
    aplicar: (d, i) => trocar(d, WORKFLOW, "      - name: Guardião da auditabilidade" + NL + RUN.guardiao + NL + NL, "", i),
  },
  {
    id: "E19", nome: "`continue-on-error` no passo das PROVAS",
    aplicar: (d, i) => trocar(d, WORKFLOW, "      - name: Provas oficiais do servidor" + NL + "        run: |", "      - name: Provas oficiais do servidor" + NL + "        continue-on-error: true" + NL + "        run: |", i),
  },
  {
    id: "E20", nome: "passo do juiz CONDICIONADO por `if:`",
    aplicar: (d, i) => trocar(d, WORKFLOW, "      - name: Portão fail-closed" + NL, "      - name: Portão fail-closed" + NL + "        if: always()" + NL, i),
  },

  // --- o RESUMO, que também podia ser impresso em vez de executado -------
  { id: "E21", nome: "resumo neutralizado por `echo`", aplicar: (d, i) => trocar(d, WORKFLOW, "          node ci/portao_do_ci.js --resumo", "          echo node ci/portao_do_ci.js --resumo", i) },
  { id: "E22", nome: "resumo TRUNCA o painel (`>` no lugar de `>>`)", aplicar: (d, i) => trocar(d, WORKFLOW, '>> "$GITHUB_STEP_SUMMARY"', '> "$GITHUB_STEP_SUMMARY"', i) },

  // --- a AUTORIDADE NOVA, atacada de frente ------------------------------
  { id: "E24", nome: "autoridade das invocacoes REMOVIDA do disco", tipo: "renomear", de: EXECUTAVEL, para: EXECUTAVEL + ".desligado" },
  {
    id: "E25", nome: "autoridade das invocacoes TRIVIALIZADA (aprova tudo)",
    aplicar: (d, i) => trocar(
      d, EXECUTAVEL,
      "  const comandos = comandosDe(script);",
      "  if (true) return { ok: true, motivo: null, comando: { argumentos: [], palavras: [] } };" + NL + "  const comandos = comandosDe(script);",
      i
    ),
  },

  // --- o caso DELIBERADAMENTE VERMELHO -----------------------------------
  {
    // A §3 exige que um caso deliberadamente vermelho produza falha REAL. Aqui
    // ele é medido na cadeia local; que os passos `always()` do provedor não
    // convertem a falha em sucesso é propriedade do runner, e está provada por
    // run externo real no placar desta OS.
    // [OS 54-C6] A ÂNCORA SAI DO ARQUIVO, e não de um literal.
    //
    // Ela era `"casos_minimos": 927,` escrito à mão. O piso subiu para 956 nesta
    // ponta e o caso ABORTOU por âncora ausente — cópia de número dentro do
    // arnês envelhece calada, que é a mesma lição do controle `E27` deste
    // arquivo, aplicada agora a um número em vez de a um trecho de YAML. A
    // sabotagem não mudou: continua sendo "o piso exige mais casos do que
    // existem".
    id: "E23", nome: "DELIBERADAMENTE VERMELHO: o piso exige mais casos do que existem",
    aplicar: (d, i) => {
      const atual = JSON.parse(fs.readFileSync(path.join(d, PISO_GLOBAL), "utf8")).casos_minimos;
      if (!Number.isInteger(atual)) throw new Error(i + ": `casos_minimos` ilegivel no piso global");
      trocar(d, PISO_GLOBAL, '"casos_minimos": ' + atual + ",", '"casos_minimos": 99999,', i);
    },
  },

  // --- os CONTROLES, e eles são dois -------------------------------------
  { id: "E26", nome: "CONTROLE INTEGRO (tem de ficar VERDE)", controle: true, aplicar: () => {} },
  {
    // A trava contra o excesso de zelo: a forma canônica ALTERNATIVA — bloco
    // escalar, que o próprio workflow já usa em dois passos — tem de continuar
    // aceita. Uma autoridade que recusasse o bloco reprovaria o repositório
    // íntegro no dia em que alguém quebrasse uma linha comprida.
    id: "E27", nome: "CONTROLE: a OUTRA forma canonica do guardiao continua VERDE", controle: true,
    aplicar: (d, i) => trocar(d, WORKFLOW, RUN.guardiao, outraFormaDoRun(RUN.guardiao), i),
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
      if (s.id !== "E26" && sujo === "") { ruins++; console.log("SEM EFEITO  " + s.id.padEnd(5) + s.nome); }
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
    " em " + veredito.etapa.padEnd(10) +
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
