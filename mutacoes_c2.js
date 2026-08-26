// ===========================================================================
// CAMPANHA DA AUDITABILIDADE (OS 54-C4, §7) — OS DEZESSEIS SOBREVIVENTES DA R2
// MAIS A CAMPANHA MINIMA, REMEDIDAS SOBRE A ARVORE DO ARTEFATO UNICO.
//
// ===========================================================================
// O QUE ESTA CAMPANHA MEDE, E POR QUE ELA NÃO É A DA OS 54
// ===========================================================================
//
// `mutacoes_ci.js` sabota a árvore de trabalho e julga por `node --test`. Serve
// para o que ela foi feita, e continua rodando. Mas a R2 mostrou que o oráculo
// daquela campanha é curto demais para esta pergunta: o veredito oficial do CI
// não é só a suíte — é a CADEIA `npm test` (com o `pretest`) + o guardião do
// rastro + o inventário por execução + o juiz da evidência. Uma sabotagem que
// passa pela suíte e morre no inventário estava sendo contada como escape.
//
// Aqui o oráculo é a cadeia inteira, na ordem em que o CI a roda, e a árvore
// mutada é uma CÓPIA DESCARTÁVEL: nada é editado no worktree de trabalho, e a
// restauração é a destruição da cópia — não há como uma reversão malfeita
// contaminar a medição seguinte.
//
// TRAVAS, e todas param a campanha em vez de mentir:
//   1) âncora conferida: ausente ou ambígua ABORTA;
//   2) alteração efetiva: byte igual ABORTA;
//   3) controle verde ANTES e DEPOIS de cada rodada;
//   4) veredito indeterminado (processo sem código de saída) ABORTA.
//
// [OS 54-C4] AS ANCORAS FORAM REFEITAS, e nao por asseio: esta arvore nasce de
// `9795df7`, onde o piso global e 883 e nao 848, o censo declara 99 casos para
// a suite do CI e nao 98, e os pisos executados sao outros. Ancora que deixou
// de casar vira ABORTA no meio de uma campanha de horas — e, pior, uma
// sabotagem que nao sabota vira `PEGA` sem ter medido nada.
//
// O ORACULO tambem cresceu: a cadeia oficial desta arvore tem QUATRO passos
// externos, e o quarto e `ci/artefato.js`. Sem ele no oraculo, toda sabotagem
// que passasse pela auditabilidade e morresse no artefato seria contada como
// ESCAPE — vermelho pelo motivo errado no lugar mais caro possivel.
//
// Uso: node mutacoes_c2.js [--so <ID,ID>] [--listar] [--secar]
// ===========================================================================

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const RAIZ = __dirname;
const WORKFLOW = ".github/workflows/provas-do-servidor.yml";
const SUITE_CI = "test/ci_obrigatorio.test.js";
const CENSO = "test/censo_de_suites.js";
const PISO_GLOBAL = "ci/piso_do_portao.json";
const PISOS = "ci/pisos_autorizados.js";
const GUARDIAO = "ci/auditabilidade.js";
const INVENTARIO = "ci/inventario_de_execucao.js";
const JUIZ = "ci/portao_do_ci.js";
const PACOTE = "package.json";
const PRETEST = "test/guarda_do_portao.js";
const ARTEFATO = "ci/artefato.js";

/** O que uma cópia precisa ter para a cadeia oficial rodar inteira. */
// `docs` entra porque a guarda de unicidade da OS 52-C2 EXIGE que a varredura
// desça nele (UNI-A2): uma cópia sem `docs` reprova por falta de árvore, e a
// campanha inteira morreria no controle achando que a candidata está vermelha.
const COPIAR = ["package.json", ".github", "ci", "test", "docs", "server.js", "app.html", "contrato"];

// [OS 54-C3] A CÓPIA PRECISA DE HISTÓRICO, e a razão é a composição.
//
// A OS 52-C3 ancorou o piso no COMMIT ANTERIOR: `test/piso_ancorado.js` roda
// no `pretest` e lê `HEAD`/`HEAD^` com o git. Numa cópia sem `.git` isso não
// devolve zero comparações — devolve REPROVAÇÃO, porque ausência de âncora é
// vermelho por desenho. A campanha inteira morreria no controle de partida,
// acusando a candidata de um defeito que é do arnês.
//
// A saída não é desligar a guarda na cópia (isso mediria outra árvore, e a
// mais frouxa). É dar à cópia o histórico que ela precisa: um repositório
// novo com UM commit da árvore ÍNTEGRA, feito ANTES da sabotagem. A ordem é o
// que importa — com o pristino em `HEAD`, toda mutação que rebaixa piso,
// apaga suíte ou encolhe número passa a ser comparada contra o que a árvore
// declarava um instante antes. A campanha ficou MAIS forte, não mais leniente.
function copiarArvore() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), "os54c2-"));
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
  return { bruto, crlf: bruto.indexOf("\r\n") >= 0, texto: bruto.split("\r\n").join("\n") };
}

function gravar(dir, relativo, texto, crlf) {
  fs.writeFileSync(path.join(dir, relativo), crlf ? texto.split("\n").join("\r\n") : texto, "utf8");
}

/** Troca com âncora conferida. Aborta a campanha se a âncora não for única. */
function trocar(dir, relativo, de, para, id) {
  const alvo = ler(dir, relativo);
  const partes = alvo.texto.split(de);
  if (partes.length !== 2) {
    throw new Error(id + ": âncora ambígua/ausente (" + (partes.length - 1) + ") em " + relativo + " :: " + de.slice(0, 70));
  }
  const mutado = partes.join(para);
  if (mutado === alvo.texto) throw new Error(id + ": a mutação não alterou byte nenhum em " + relativo);
  gravar(dir, relativo, mutado, alvo.crlf);
}

/** Recorta um caso `await t.test("<id>: ...", ...)` inteiro, com aninhamento.
 *
 *  O RECORTE É POR INDENTAÇÃO, e não por contagem de chaves. Contar `{` e `}`
 *  parecia mais rigoroso e é justamente o que quebra: os corpos destes casos
 *  carregam chaves DENTRO DE STRINGS (`"function resumo(veredito, desfecho) {"`),
 *  o nível nunca volta a zero, o recorte devolve vazio e a campanha aborta
 *  culpando a candidata. Custou uma rodada. O fecho de um caso de primeiro nível
 *  é sempre a linha `  });` com exatamente dois espaços — os subcasos fecham com
 *  quatro —, e essa é a única marca que strings não imitam por acidente. */
function fatiarCaso(texto, idCaso) {
  const marca = 'await t.test("' + idCaso + ':';
  const inicio = texto.indexOf(marca);
  if (inicio < 0) return null;
  const fecho = "\n  });\n";
  const fim = texto.indexOf(fecho, inicio);
  if (fim < 0) return null;
  const linhaInicial = texto.lastIndexOf("\n", inicio) + 1;
  const fimAbsoluto = fim + fecho.length;
  return { inicio: linhaInicial, fim: fimAbsoluto, trecho: texto.slice(linhaInicial, fimAbsoluto) };
}

function trivializarCaso(dir, idCaso, id) {
  const alvo = ler(dir, SUITE_CI);
  const fatia = fatiarCaso(alvo.texto, idCaso);
  if (!fatia) throw new Error(id + ": caso " + idCaso + " não encontrado");
  const titulo = /await t\.test\("([^"]+)"/.exec(fatia.trecho)[1];
  const novo = '  await t.test("' + titulo + '", () => {\n    assert.ok(true);\n  });\n';
  gravar(dir, SUITE_CI, alvo.texto.slice(0, fatia.inicio) + novo + alvo.texto.slice(fatia.fim), alvo.crlf);
}

function apagarCaso(dir, idCaso, id) {
  const alvo = ler(dir, SUITE_CI);
  const fatia = fatiarCaso(alvo.texto, idCaso);
  if (!fatia) throw new Error(id + ": caso " + idCaso + " não encontrado");
  gravar(dir, SUITE_CI, alvo.texto.slice(0, fatia.inicio) + alvo.texto.slice(fatia.fim), alvo.crlf);
}

function apagarBlocoDeAuditabilidade(dir, recheio, id) {
  const alvo = ler(dir, SUITE_CI);
  const inicio = alvo.texto.indexOf('test("CI/AUDITABILIDADE');
  if (inicio < 0) throw new Error(id + ": bloco CI/AUDITABILIDADE não encontrado");
  const fim = alvo.texto.indexOf("\n});\n", inicio);
  if (fim < 0) throw new Error(id + ": fim do bloco não encontrado");
  const resto = alvo.texto.slice(0, inicio) + (recheio || "") + alvo.texto.slice(fim + "\n});\n".length);
  gravar(dir, SUITE_CI, resto, alvo.crlf);
}

// --- o ORÁCULO: a cadeia oficial, na ordem do CI ---------------------------

function rodar(dir, comando, args) {
  try {
    const saida = execFileSync(comando, args, {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: comando === "npm", timeout: 900000,
    });
    return { exit: 0, saida };
  } catch (e) {
    const exit = typeof e.status === "number" ? e.status : null;
    return { exit, saida: String((e.stdout || "") + (e.stderr || "")) };
  }
}

function numerosDe(saida) {
  const p = (k) => {
    const m = new RegExp("^(?:#|\u2139)\\s+" + k + "\\s+([0-9]+)", "m").exec(saida);
    return m ? Number(m[1]) : -1;
  };
  return { casos: p("pass"), suites: p("suites"), falhas: p("fail") };
}

/** Devolve `{ vermelho, etapa, casos, suites }`. Aborta se algum passo não
 *  produzir código de saída — indeterminado não é sobrevivente. */
function cadeiaOficial(dir, id) {
  const provas = rodar(dir, "npm", ["test"]);
  if (provas.exit === null) throw new Error(id + ": `npm test` não produziu código de saída");
  const n = numerosDe(provas.saida);

  if (provas.exit !== 0) return { vermelho: true, etapa: "npm test", ...n };

  const dirEvid = fs.mkdtempSync(path.join(os.tmpdir(), "os54c2-evid-"));
  fs.writeFileSync(path.join(dirEvid, "npm-test.txt"), provas.saida);
  fs.writeFileSync(path.join(dirEvid, "exit.txt"), "0");

  const guardiao = rodar(dir, process.execPath, [path.join(dir, GUARDIAO)]);
  if (guardiao.exit === null) throw new Error(id + ": o guardião não produziu código de saída");
  if (guardiao.exit !== 0) return { vermelho: true, etapa: "guardião", ...n };

  const inventario = rodar(dir, process.execPath, [path.join(dir, INVENTARIO)]);
  if (inventario.exit === null) throw new Error(id + ": o inventário não produziu código de saída");
  if (inventario.exit !== 0) return { vermelho: true, etapa: "inventário", ...n };

  const juiz = rodar(dir, process.execPath, [
    path.join(dir, JUIZ), path.join(dirEvid, "npm-test.txt"), path.join(dirEvid, "exit.txt"), "--raiz", dir,
  ]);
  if (juiz.exit === null) throw new Error(id + ": o juiz não produziu código de saída");
  if (juiz.exit !== 0) return { vermelho: true, etapa: "juiz", ...n };

  // [OS 54-C4] O QUARTO PASSO EXTERNO. Ele é da OS 52-C4 e não da
  // auditabilidade, e está aqui porque o oráculo desta campanha é a CADEIA
  // OFICIAL — não a metade dela que interessa a quem escreveu a sabotagem.
  const artefato = rodar(dir, process.execPath, [path.join(dir, ARTEFATO), "--conferir", "--raiz", dir]);
  if (artefato.exit === null) throw new Error(id + ": a autoridade do artefato não produziu código de saída");
  if (artefato.exit !== 0) return { vermelho: true, etapa: "artefato", ...n };

  return { vermelho: false, etapa: "—", ...n };
}

// ===========================================================================
// AS SABOTAGENS
// ===========================================================================

const yml = (de, para) => (dir, id) => trocar(dir, WORKFLOW, de, para, id);

const SABOTAGENS = [
  // --- os DEZESSEIS que a OS 54-R2 encontrou -----------------------------
  { id: "M14", nome: "CI-18 trivializada", aplicar: (d, i) => trivializarCaso(d, "CI-18", i) },
  { id: "M15", nome: "CI-19 trivializada", aplicar: (d, i) => trivializarCaso(d, "CI-19", i) },
  { id: "M16", nome: "CI-19b trivializada", aplicar: (d, i) => trivializarCaso(d, "CI-19b", i) },
  { id: "M21", nome: "CI-18 apagada", aplicar: (d, i) => apagarCaso(d, "CI-18", i) },
  { id: "M22", nome: "CI-19 apagada", aplicar: (d, i) => apagarCaso(d, "CI-19", i) },
  { id: "M23", nome: "CI-19b apagada", aplicar: (d, i) => apagarCaso(d, "CI-19b", i) },
  {
    id: "C07",
    nome: "as três trivializadas",
    aplicar: (d, i) => { trivializarCaso(d, "CI-18", i); trivializarCaso(d, "CI-19", i); trivializarCaso(d, "CI-19b", i); },
  },
  {
    id: "C01",
    nome: "CI-18 trivializada + upload removido",
    aplicar: (d, i) => { trivializarCaso(d, "CI-18", i); removerUpload(d, i); },
  },
  {
    id: "C02",
    nome: "CI-19 trivializada + resumo removido",
    aplicar: (d, i) => { trivializarCaso(d, "CI-19", i); removerResumo(d, i); },
  },
  {
    id: "C03",
    nome: "CI-18 apagada + upload removido",
    aplicar: (d, i) => { apagarCaso(d, "CI-18", i); removerUpload(d, i); },
  },
  {
    id: "C04",
    nome: "CI-19 apagada + resumo removido",
    aplicar: (d, i) => { apagarCaso(d, "CI-19", i); removerResumo(d, i); },
  },
  {
    id: "C08",
    nome: "bloco apagado, nomes mantidos só em comentários",
    aplicar: (d, i) =>
      apagarBlocoDeAuditabilidade(
        d,
        "// CI-18: o ARTEFATO existe\n// CI-19: o RESUMO existe\n// CI-19b: o conteúdo do resumo\n// CI-20: a cadeia externa\n\n",
        i
      ),
  },
  {
    id: "C09",
    nome: "bloco apagado, contador textual reposto por comentário",
    aplicar: (d, i) => apagarBlocoDeAuditabilidade(d, "// " + "test( ".repeat(60) + "\n\n", i),
  },
  {
    id: "M28",
    nome: "bloco apagado + piso específico rebaixado",
    aplicar: (d, i) => {
      apagarBlocoDeAuditabilidade(d, "", i);
      trocar(d, CENSO, '"ci_obrigatorio.test.js": 99,', '"ci_obrigatorio.test.js": 50,', i);
    },
  },
  { id: "H28", nome: "piso de gate_vip rebaixado (64 -> 1)", aplicar: (d, i) => trocar(d, CENSO, '"gate_vip.test.js": 64,', '"gate_vip.test.js": 1,', i) },
  {
    // DEFESA REDUNDANTE, e a OS exige que isso seja COMPROVADO, não alegado.
    // A prova é N34: remover a chamada do `pretest` — o endereço externo — deixa
    // a cadeia VERMELHA. Com a obrigatoriedade fora do conjunto varrido, a
    // chamada de dentro da suíte deixou de ser a que segura o censo, e comentá-la
    // não muda comportamento nenhum. Verde aqui é redundância medida, não
    // cobertura acidental — e por isso não conta como detecção.
    id: "M26",
    nome: "chamada do censo neutralizada na suíte do CI (redundante — ver N34)",
    equivalente: true,
    aplicar: (d, i) => trocar(d, SUITE_CI, "\n    conferirCenso();", "\n    // conferirCenso();", i),
  },

  // --- a CAMPANHA MÍNIMA da OS 54-C2 --------------------------------------
  { id: "N01", nome: "upload removido", aplicar: (d, i) => removerUpload(d, i) },
  { id: "N02", nome: "upload condicionado a sucesso", aplicar: yml("      - name: Evidência arquivada\n        if: always()", "      - name: Evidência arquivada\n        if: success()") },
  { id: "N03", nome: "upload apontando para diretório vazio", aplicar: yml("          path: ${{ env.EVIDENCIA }}/", "          path: ${{ runner.temp }}/vazio/") },
  { id: "N04", nome: "`if-no-files-found` reduzido para `warn`", aplicar: yml("          if-no-files-found: error", "          if-no-files-found: warn") },
  { id: "N05", nome: "artefato lendo caminho diferente", aplicar: yml("          path: ${{ env.EVIDENCIA }}/", "          path: /tmp/outro-lugar/") },
  { id: "N06", nome: "resumo removido", aplicar: (d, i) => removerResumo(d, i) },
  { id: "N07", nome: "resumo condicionado a sucesso", aplicar: yml("      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: always()", "      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: success()") },
  { id: "N08", nome: "resumo por `echo` estático", aplicar: yml("node ci/portao_do_ci.js --resumo", 'echo "--resumo tudo certo"') },
  { id: "N09", nome: "`>>` trocado por `>`", aplicar: yml('>> "$GITHUB_STEP_SUMMARY"', '> "$GITHUB_STEP_SUMMARY"') },
  { id: "N10", nome: "gerador de resumo esvaziado", aplicar: (d, i) => trocar(d, JUIZ, "function resumo(veredito, desfecho) {", 'function resumo(veredito, desfecho) {\n  if (true) return "";', i) },
  { id: "N11", nome: "evidência ausente (o juiz aceita ausência)", aplicar: (d, i) => trocar(d, JUIZ, "  const saida = lerArquivo(opcoes.arquivoSaida);\n  if (saida === null) {", "  const saida = lerArquivo(opcoes.arquivoSaida);\n  if (false) {", i) },
  { id: "N12", nome: "evidência truncada (o juiz para de exigir o rodapé)", aplicar: (d, i) => trocar(d, JUIZ, "  const faltando = CHAVES_DO_RODAPE.filter((k) => rodape[k] === null);", "  const faltando = [];", i) },
  { id: "N13", nome: "marcador ausente (o passo deixa de gravar)", aplicar: yml('          printf \'%s\' "$codigo" > "$EVIDENCIA/exit.txt"\n', "") },
  { id: "N14", nome: "marcador ilegível (o juiz aceita texto)", aplicar: (d, i) => trocar(d, JUIZ, '  } else if (!/^-?[0-9]+$/.test(exitBruto.trim())) {', "  } else if (false) {", i) },
  { id: "N15", nome: "execução parcial (o alvo vira uma suíte só)", aplicar: yml('          npm test > "$EVIDENCIA/npm-test.txt" 2>&1', '          node --test test/chat_contrato.test.js > "$EVIDENCIA/npm-test.txt" 2>&1') },
  { id: "N16", nome: "alvo desviado na fonte", aplicar: (d, i) => trocar(d, PACOTE, '"test": "node --test \\"test/*.test.js\\""', '"test": "node --test test/chat_contrato.test.js"', i) },
  { id: "N17", nome: "suíte-isca no lugar do glob", aplicar: (d, i) => trocar(d, PACOTE, '"test": "node --test \\"test/*.test.js\\""', '"test": "node --test \\"test/chat_*.test.js\\""', i) },
  { id: "N18", nome: "caso removido (um subcaso de CI-18)", aplicar: (d, i) => trocar(d, SUITE_CI, '    await t18.test("CI-18d: upload sem nome reprova", () => {', '    await t18.testDESLIGADO("CI-18d: upload sem nome reprova", () => {', i) },
  { id: "N19", nome: "suíte removida do glob", tipo: "renomear", de: "test/auditabilidade_ci.test.js", para: "test/auditabilidade_ci.test.js.desligado" },
  { id: "N20", nome: "piso global rebaixado", aplicar: (d, i) => trocar(d, PISO_GLOBAL, '"casos_minimos": 927,', '"casos_minimos": 1,', i) },
  { id: "N21", nome: "piso específico rebaixado no censo", aplicar: (d, i) => trocar(d, CENSO, '"descoberta.test.js": 98,', '"descoberta.test.js": 1,', i) },
  { id: "N22", nome: "atribuição de caso ao arquivo errado (nome exigido movido)", aplicar: (d, i) => trocar(d, PISOS, '"ci_obrigatorio.test.js": Object.freeze([', '"chat_contrato.test.js": Object.freeze(["CI-18"]),\n  "ci_obrigatorio.test.js": Object.freeze([', i) },
  { id: "N23", nome: "arquivo-isca emprestando casos ao piso executado", aplicar: (d, i) => trocar(d, PISOS, '  "ci_obrigatorio.test.js": 63,\n  "auditabilidade_ci.test.js": 41,', '  "ci_obrigatorio.test.js": 63,\n  "isca.test.js": 1,\n  "auditabilidade_ci.test.js": 41,', i) },
  { id: "N24", nome: "origem do caso FORJADA (o inventário atribui tudo ao mesmo arquivo)", aplicar: (d, i) => trocar(d, INVENTARIO, "      const registro = anotar(porArquivo, path.basename(d.file));", '      const registro = anotar(porArquivo, "ci_obrigatorio.test.js");', i) },
  {
    // EQUIVALENTE, e registrado como tal em vez de virar número. A guarda de
    // `semOrigem` só dispara para evento sem `file`, e o executor sempre manda
    // `file` numa árvore íntegra — então remover a guarda não muda saída
    // nenhuma HOJE. Ela existe para o dia em que o runner mudar, e verde aqui é
    // acidente de cobertura, não detecção. Ver a nota do laudo sobre M26.
    id: "N24b",
    nome: "guarda de evento sem origem removida (mutante equivalente)",
    equivalente: true,
    aplicar: (d, i) => trocar(d, INVENTARIO, "      if (!d.file) {\n        semOrigem.push(d.name);\n        return;\n      }", "      if (!d.file) {\n        return;\n      }", i),
  },
  { id: "N25", nome: "guardião externo removido do disco", tipo: "renomear", de: "ci/auditabilidade.js", para: "ci/auditabilidade.js.desligado" },
  { id: "N26", nome: "guardião externo trivializado", aplicar: (d, i) => trocar(d, GUARDIAO, "  const reprovacoes = [];\n  const caminho = path.join(raiz, CAMINHO_RELATIVO_DO_WORKFLOW);", "  const reprovacoes = [];\n  if (true) return reprovacoes;\n  const caminho = path.join(raiz, CAMINHO_RELATIVO_DO_WORKFLOW);", i) },
  { id: "N27", nome: "invocação do guardião removida do workflow", aplicar: yml("      - name: Guardião da auditabilidade\n        run: node ci/auditabilidade.js\n\n", "") },
  { id: "N28", nome: "teste de reciprocidade apagado (o pretest sai do manifesto)", aplicar: (d, i) => trocar(d, PACOTE, '    "pretest": "node test/guarda_do_portao.js",\n', "", i) },
  { id: "N29", nome: "workflow apagado", tipo: "renomear", de: WORKFLOW, para: ".github/workflows/provas-do-servidor.yml.desligado" },
  { id: "N30", nome: "CONTROLE ÍNTEGRO (tem de ficar VERDE)", controle: true, aplicar: () => {} },

  // --- os três que o inventário fecha, e que nenhuma leitura de texto pega --
  { id: "N31", nome: "inventário trivializado", aplicar: (d, i) => trocar(d, INVENTARIO, "  const reprovacoes = [];\n\n  if (inventario.erroFatal)", "  const reprovacoes = [];\n  if (true) return reprovacoes;\n\n  if (inventario.erroFatal)", i) },
  { id: "N32", nome: "invocação do inventário removida do workflow", aplicar: yml("      - name: Inventário por execução\n        run: node ci/inventario_de_execucao.js\n\n", "") },
  { id: "N33", nome: "mínimos externos apagados do disco", tipo: "renomear", de: "ci/pisos_autorizados.js", para: "ci/pisos_autorizados.js.desligado" },

  // --- a CADEIA DO PRETEST, que e o outro endereco das autoridades --------
  // [OS 54-C4] A INVOCACAO DO PROPRIO JUIZ, e a da AUTORIDADE DO ARTEFATO, que
  // a folha de origem nao sabotava — a primeira porque ninguem tinha pensado
  // nela, a segunda porque nao existia naquela arvore. Quem percebe a ausencia
  // do juiz nao e o juiz: e o guardiao, que cobra a presenca das outras tres
  // autoridades no workflow e roda tambem no `pretest`.
  { id: "N37", nome: "invocacao do JUIZ removida do workflow",
    aplicar: yml("      - name: Portão fail-closed\n        run: node ci/portao_do_ci.js \"$EVIDENCIA/npm-test.txt\" \"$EVIDENCIA/exit.txt\"\n\n", "") },
  { id: "N38", nome: "invocacao da AUTORIDADE DO ARTEFATO removida do workflow",
    aplicar: yml("      - name: Artefato produtivo único\n        run: node ci/artefato.js --conferir --raiz .\n\n", "") },
  { id: "N39", nome: "chamada da AUTORIDADE DO ARTEFATO removida do pretest",
    aplicar: (d, i) => trocar(d, PRETEST, "  const artefato = exigirArtefatoUnico();", "  const artefato = { produtivos: [], excluidos: 0, ancoras: 0 };", i) },
  { id: "N34", nome: "chamada do censo removida do pretest", aplicar: (d, i) => trocar(d, PRETEST, "\n  conferirCenso();", "\n  // conferirCenso();", i) },
  { id: "N35", nome: "chamada do guardiao removida do pretest", aplicar: (d, i) => trocar(d, PRETEST, "    ...conferirAuditabilidade({}),", "    // ...conferirAuditabilidade({}),", i) },
  { id: "N36", nome: "chamada dos pisos removida do pretest", aplicar: (d, i) => trocar(d, PRETEST, "    ...conferirPisosDeclarados(OBRIGATORIAS),", "    // ...conferirPisosDeclarados(OBRIGATORIAS),", i) },
];

function removerUpload(dir, id) {
  const alvo = ler(dir, WORKFLOW);
  const inicio = alvo.texto.indexOf("      - name: Evidência arquivada");
  if (inicio < 0) throw new Error(id + ": passo de upload não encontrado");
  gravar(dir, WORKFLOW, alvo.texto.slice(0, inicio), alvo.crlf);
}

function removerResumo(dir, id) {
  const alvo = ler(dir, WORKFLOW);
  const inicio = alvo.texto.indexOf("      - name: Resumo (verde");
  const fim = alvo.texto.indexOf("      - name: Evidência arquivada");
  if (inicio < 0 || fim < 0 || fim < inicio) throw new Error(id + ": passo de resumo não encontrado");
  gravar(dir, WORKFLOW, alvo.texto.slice(0, inicio) + alvo.texto.slice(fim), alvo.crlf);
}

// ===========================================================================
// EXECUÇÃO
// ===========================================================================

const filtro = (() => {
  const i = process.argv.indexOf("--so");
  return i >= 0 ? new Set(String(process.argv[i + 1] || "").split(",")) : null;
})();

const alvos = SABOTAGENS.filter((s) => !filtro || filtro.has(s.id));

// [OS 54-C3] DUAS SAÍDAS BARATAS, e nenhuma delas julga nada.
//
// `--listar` só imprime o catálogo. `--secar` aplica cada sabotagem numa cópia
// e joga a cópia fora sem rodar a cadeia: serve para conferir que TODA âncora
// ainda casa depois de a árvore mudar. Numa composição isso não é conforto —
// âncora que deixou de casar vira `ABORTA` no meio de uma campanha de horas, e
// descobrir isso em dois minutos é a diferença entre medir e recomeçar.
if (process.argv.includes("--listar")) {
  for (const s of alvos) console.log(s.id.padEnd(5) + (s.equivalente ? " [equiv]" : s.controle ? " [ctrl] " : "        ") + s.nome);
  console.log("total: " + alvos.length);
  process.exit(0);
}
if (process.argv.includes("--secar")) {
  let ruins = 0;
  for (const s of alvos) {
    const dir = copiarArvore();
    try {
      if (s.tipo === "renomear") {
        const de = path.join(dir, s.de);
        if (!fs.existsSync(de)) throw new Error("arquivo ausente: " + s.de);
        fs.renameSync(de, path.join(dir, s.para));
      } else {
        s.aplicar(dir, s.id);
      }
      console.log("ancora ok  " + s.id.padEnd(5) + s.nome);
    } catch (erro) {
      ruins++;
      console.log("ANCORA RUIM " + s.id.padEnd(5) + ((erro && erro.message) || erro));
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("ancoras invalidas: " + ruins + "/" + alvos.length);
  process.exit(ruins === 0 ? 0 : 1);
}

console.log("controle de partida na cópia limpa…");
const copiaControle = copiarArvore();
const partida = cadeiaOficial(copiaControle, "CONTROLE");
fs.rmSync(copiaControle, { recursive: true, force: true });
if (partida.vermelho) {
  console.error("A CÓPIA LIMPA JÁ ESTÁ VERMELHA (" + partida.etapa + ") — campanha inválida.");
  process.exit(1);
}
console.log("cópia limpa VERDE · " + partida.casos + " casos em " + partida.suites + " suítes\n");

const resultados = [];
for (const sab of alvos) {
  const dir = copiarArvore();
  let veredito;
  try {
    if (sab.tipo === "renomear") {
      const de = path.join(dir, sab.de);
      if (!fs.existsSync(de)) throw new Error(sab.id + ": arquivo ausente: " + sab.de);
      fs.renameSync(de, path.join(dir, sab.para));
    } else {
      sab.aplicar(dir, sab.id);
    }
    veredito = cadeiaOficial(dir, sab.id);
  } catch (erro) {
    console.error("ABORTA " + sab.id + ": " + ((erro && erro.message) || erro));
    fs.rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(dir, { recursive: true, force: true });

  // EQUIVALENTE não é escape nem detecção: a mutação não muda comportamento
  // na árvore íntegra, e contar o verde dela como cobertura seria mentir sobre
  // o que a campanha mediu.
  const esperadoVerde = Boolean(sab.controle);
  const ok = sab.equivalente ? true : esperadoVerde ? !veredito.vermelho : veredito.vermelho;
  resultados.push({ id: sab.id, nome: sab.nome, ok, etapa: veredito.etapa, casos: veredito.casos });
  console.log(
    (sab.equivalente ? "EQUIV. " : ok ? "PEGA   " : "ESCAPOU") + " " + sab.id.padEnd(4) +
    " " + (veredito.vermelho ? "vermelho" : "  verde ") +
    " em " + veredito.etapa.padEnd(10) +
    " casos=" + String(veredito.casos).padStart(4) +
    "  " + sab.nome
  );
}

console.log("\ncontrole de chegada na cópia limpa…");
const copiaFim = copiarArvore();
const chegada = cadeiaOficial(copiaFim, "CHEGADA");
fs.rmSync(copiaFim, { recursive: true, force: true });
console.log("cópia limpa: " + (chegada.vermelho ? "VERMELHA em " + chegada.etapa : "VERDE") + " · " + chegada.casos + " casos");

const escaparam = resultados.filter((r) => !r.ok);
console.log("\ndetectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const r of escaparam) console.log("  ESCAPOU " + r.id + ": " + r.nome);
if (chegada.vermelho || escaparam.length > 0) process.exit(1);
