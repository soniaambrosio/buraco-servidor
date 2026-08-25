// test/artefato_unico.test.js — A AUTORIDADE DO ARTEFATO, EXERCITADA (OS 52-C4).
//
// ===========================================================================
// POR QUE ESTA SUÍTE MONTA REPOSITÓRIOS DE VERDADE
// ===========================================================================
//
// A autoridade lê `git ls-tree` e monta o artefato com `git archive`. Prova que
// não tenha commit não exercita nada disso — no máximo exercita a leitura de um
// diretório. Cada caso abaixo cria um repositório descartável com DOIS commits:
// o primeiro é a base (produtivos canônicos, sem manifesto), o segundo é o caso.
//
// Os dois commits não são luxo: a âncora histórica compara `HEAD` com `HEAD^`, e
// é ela que impede promover uma duplicata a `produtivos` e realinhar a
// declaração no mesmo movimento. Com um commit só, esse vetor não teria com o
// que ser comparado.
//
// ===========================================================================
// O QUE MUDOU DE AUTORIDADE
// ===========================================================================
//
// A unicidade por capacidade (OS 52-C1..C3) continua rodando e continua útil.
// Ela deixou de DECIDER. Uma duplicata escrita com `sv["cre"+"ateServer"]()`,
// com `new Function(atob(...))` ou com o alvo em base64 atravessa qualquer
// scanner — e reprova aqui, porque não pertence ao conjunto declarado. A
// mensagem não fala de capacidade nenhuma, e é isso que prova que a defesa
// deixou de depender de entender o arquivo.
// ===========================================================================

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const { conferirCenso } = require("./censo_de_suites.js");
const artefato = require("../ci/artefato.js");
const PORTAO = require("../ci/portao_do_ci.js");

const RAIZ = path.join(__dirname, "..");

// ---------------------------------------------------------------------------
// O REPOSITÓRIO FORJADO
// ---------------------------------------------------------------------------

const MANIFESTO_PADRAO = {
  produtivos: ["server.js", "package.json"],
  exclusoes: [
    { regra: "prefixo", valor: "test/", porque: "provas" },
    { regra: "prefixo", valor: "ci/", porque: "portão" },
    { regra: "prefixo", valor: "docs/", porque: "documentação" },
    { regra: "glob", valor: "mutacoes_*.js", porque: "campanhas" },
  ],
  start_exato: "node server.js",
  base_medida: "0000000000000000000000000000000000000000",
  artefato_final: ["server.js", "package.json"],
};

const CRIADOS = [];

function escrever(raiz, rel, conteudo) {
  const destino = path.join(raiz, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, conteudo);
}

/** Um repositório com base + caso. `mutar(raiz, escrever)` monta o segundo
 *  commit; `manifesto` é o que vai para `ci/artefato_produtivo.json`. */
function repoForjado(opcoes) {
  const o = opcoes || {};
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "artef-"));
  CRIADOS.push(raiz);
  const g = (...a) => cp.execFileSync("git", ["-C", raiz, ...a], { stdio: "ignore" });
  g("init", "-q");
  g("config", "user.email", "prova@local");
  g("config", "user.name", "prova");
  g("config", "core.autocrlf", "false");

  escrever(raiz, "server.js", "// o portador\n");
  escrever(raiz, "package.json",
    JSON.stringify({ name: "x", scripts: { start: "node server.js" } }, null, 2));
  g("add", "-A");
  g("commit", "-q", "-m", "base");

  if (o.mutar) o.mutar(raiz, escrever, g);
  const manifesto = o.manifesto === null
    ? null
    : Object.assign({}, MANIFESTO_PADRAO, o.manifesto || {});
  if (manifesto) {
    escrever(raiz, "ci/artefato_produtivo.json", JSON.stringify(manifesto, null, 2));
  }
  g("add", "-A");
  // `mutarIndice` roda DEPOIS do `add -A`, e a ordem é a diferença entre
  // funcionar e não funcionar: um elo simbólico entra pelo ÍNDICE
  // (`update-index --cacheinfo`) e não existe no disco, então um `add -A`
  // posterior o veria como apagado e o tiraria de volta.
  if (o.mutarIndice) o.mutarIndice(raiz, g);
  g("commit", "-q", "--allow-empty", "-m", "caso");
  return raiz;
}

const reprovacoesDe = (opcoes) => artefato.conferir(repoForjado(opcoes)).reprovacoes;
const juntar = (r) => r.join(" || ");

test.after(() => {
  for (const raiz of CRIADOS) {
    try { fs.rmSync(raiz, { recursive: true, force: true }); } catch (_) {}
  }
});

// ===========================================================================
test.describe("ART/CONJUNTO — o artefato é EXATAMENTE o declarado", () => {
  test("ART-01: a árvore REAL passa, e o artefato tem dois caminhos", () => {
    const v = artefato.conferir(RAIZ);
    assert.deepEqual(v.reprovacoes, [], "a árvore íntegra reprovou: " + juntar(v.reprovacoes));
    assert.deepEqual(v.dados.produtivos, ["package.json", "server.js"]);
    assert.deepEqual(v.dados.artefato, ["package.json", "server.js"],
      "o `git archive` não produziu exatamente o artefato declarado");
    assert.ok(v.dados.excluidos > 0, "nenhum caminho foi excluído por regra — a classificação não rodou");
    assert.ok(v.dados.ancoras > 0, "nenhuma âncora histórica foi conferida");
  });

  test("ART-02: o repositório forjado ÍNTEGRO passa — não é veto geral", () => {
    // A trava anti-vácuo: uma autoridade que reprovasse qualquer árvore passaria
    // em todos os negativos e não provaria nada.
    assert.deepEqual(reprovacoesDe({}), []);
  });

  test("ART-03: caminho NÃO CLASSIFICADO reprova", () => {
    const r = reprovacoesDe({ mutar: (raiz, e) => e(raiz, "solto.js", "// nada\n") });
    // DUAS acusações, e as duas certas: o caminho não foi classificado, e ele
    // sobra no artefato depois de aplicadas as exclusões. São as duas metades
    // da mesma propriedade, e nenhuma fala do CONTEÚDO do arquivo.
    assert.ok(r.some((m) => /CAMINHO NÃO CLASSIFICADO/.test(m)), juntar(r));
    assert.ok(r.some((m) => /ARTEFATO CARREGA O QUE NÃO DEVIA/.test(m)), juntar(r));
    assert.ok(r.every((m) => /solto\.js/.test(m)), juntar(r));
  });

  test("ART-04: é IGUALDADE de conjunto, não contenção", () => {
    // Declarar um produtivo que não existe no commit reprova. Contenção
    // aceitaria; igualdade não.
    const r = reprovacoesDe({
      manifesto: { produtivos: ["server.js", "package.json", "fantasma.js"] },
    });
    assert.ok(r.some((m) => /PRODUTIVO DECLARADO E AUSENTE/.test(m)), juntar(r));
  });

  test("ART-05: PROMOVER uma duplicata a `produtivos` cai na ÂNCORA", () => {
    // A sabotagem que a declaração sozinha não pega: quem edita a declaração
    // edita também o que ela declara. O commit anterior não se edita.
    const r = reprovacoesDe({
      mutar: (raiz, e) => e(raiz, "duplicata.js", "// segundo servidor\n"),
      manifesto: { produtivos: ["server.js", "package.json", "duplicata.js"] },
    });
    assert.ok(r.some((m) => /CONJUNTO PRODUTIVO ALTERADO/.test(m)),
      "promover caminho para `produtivos` passou: " + juntar(r));
  });

  test("ART-06: SEGUNDO MANIFESTO reprova, e diretório com manifesto próprio também", () => {
    const r = reprovacoesDe({ mutar: (raiz, e) => e(raiz, "sub/package.json", "{}\n") });
    assert.ok(r.some((m) => /SEGUNDO MANIFESTO/.test(m)), juntar(r));
  });

  test("ART-07: ELO SIMBÓLICO versionado reprova", () => {
    // Modo `120000` na árvore do git. Escrito pelo índice, que é como um elo
    // entra num repositório sem depender de privilégio do sistema de arquivos.
    const r = artefato.conferir(repoForjado({
      mutarIndice: (raiz, g) => {
        const sha = cp.execFileSync("git", ["-C", raiz, "hash-object", "-w", "--stdin"],
          { input: "../fora", encoding: "utf8" }).trim();
        g("update-index", "--add", "--cacheinfo", "120000," + sha + ",atalho");
      },
    })).reprovacoes;
    assert.ok(r.some((m) => /ELO SIMBÓLICO/.test(m)), juntar(r));
  });

  test("ART-08: a mensagem NÃO fala de capacidade", () => {
    // O ponto da OS 52-A2: a recusa é por PERTENCIMENTO, e não por
    // reconhecimento. Se a mensagem citasse `createServer` ou `listen`, a
    // defesa continuaria dependendo de entender o arquivo.
    const r = reprovacoesDe({
      mutar: (raiz, e) => e(raiz, "evasiva.js",
        'const k = ["cre","ateServer"].join("");\nconst sv = require("http")[k]();\nsv["lis"+"ten"](8080);\n'),
    });
    assert.ok(r.length >= 1, juntar(r));
    assert.ok(r.some((m) => /CAMINHO NÃO CLASSIFICADO/.test(m)), juntar(r));
    for (const m of r) {
      assert.ok(!/createServer|listen|capacidade|handshake|upgrade/i.test(m),
        "a mensagem apela para capacidade: " + m);
    }
  });
});

// ===========================================================================
test.describe("ART/ARRANQUE — `start` literal, e nenhum segundo arranque", () => {
  const comScripts = (scripts) => reprovacoesDe({
    mutar: (raiz, e) => e(raiz, "package.json",
      JSON.stringify({ name: "x", scripts }, null, 2)),
  });

  test("ART-09: `start` tem de ser LITERALMENTE `node server.js`", () => {
    for (const desviado of [
      "node  server.js",
      "node server.js ",
      "node ./server.js",
      "node server.js --porta 80",
      "NODE_ENV=x node server.js",
    ]) {
      const r = comScripts({ start: desviado });
      assert.ok(r.some((m) => /START DESVIADO/.test(m)),
        "`" + desviado + "` passou como start: " + juntar(r));
    }
  });

  test("ART-10: `node server.js & node duplicata.js` reprova", () => {
    const r = comScripts({ start: "node server.js & node duplicata.js" });
    assert.ok(r.some((m) => /START DESVIADO/.test(m)), juntar(r));
    assert.ok(r.some((m) => /composição de shell/.test(m)), juntar(r));
  });

  test("ART-11: `npm run` indireto reprova", () => {
    const r = comScripts({ start: "node server.js", arrancar: "npm run start" });
    assert.ok(r.some((m) => /npm run/.test(m)), juntar(r));
  });

  test("ART-12: `node -e` e `node --eval` reprovam", () => {
    for (const forma of ['node -e "require(\'./d.js\')"', 'node --eval "1"']) {
      const r = comScripts({ start: "node server.js", solto: forma });
      assert.ok(r.some((m) => /código arbitrário/.test(m)), forma + ": " + juntar(r));
    }
  });

  test("ART-13: alvo `.mjs`/`.cjs` reprova", () => {
    for (const alvo of ["node d.mjs", "node d.cjs"]) {
      const r = comScripts({ start: "node server.js", outro: alvo });
      assert.ok(r.some((m) => /\.mjs.*\.cjs|outro carregador/.test(m)), alvo + ": " + juntar(r));
    }
  });

  test("ART-14: alvo SEM EXTENSÃO reprova", () => {
    const r = comScripts({ start: "node server.js", outro: "node arranque" });
    assert.ok(r.some((m) => /ALVO SEM EXTENSÃO/.test(m)), juntar(r));
  });

  test("ART-15: SEGUNDO script que ARRANCA um produtivo reprova", () => {
    const r = comScripts({ start: "node server.js", servir: "node server.js" });
    assert.ok(r.some((m) => /SEGUNDO ARRANQUE/.test(m)), juntar(r));
  });

  test("ART-16: `node --check server.js` NÃO é arranque — continua verde", () => {
    // O positivo legítimo do arranque, e o que separa "ferramenta" de "deploy":
    // `--check` analisa a sintaxe e sai. Sem este caso, a regra seria um veto a
    // qualquer script e morreria por incômodo.
    const r = comScripts({ start: "node server.js", check: "node --check server.js" });
    assert.deepEqual(r, [], "um script que só confere sintaxe foi tratado como arranque");
  });

  test("ART-17: script que chama node contra caminho EXCLUÍDO continua verde", () => {
    const r = reprovacoesDe({
      mutar: (raiz, e) => {
        e(raiz, "test/guarda.js", "// guarda\n");
        e(raiz, "package.json", JSON.stringify({
          name: "x",
          scripts: { start: "node server.js", pretest: "node test/guarda.js" },
        }, null, 2));
      },
    });
    assert.deepEqual(r, [], "ferramenta contra caminho excluído foi tratada como deploy");
  });
});

// ===========================================================================
test.describe("ART/AMARRAÇÃO — a autoridade não some em silêncio", () => {
  test("ART-18: o juiz cobra a EXISTÊNCIA da autoridade", () => {
    const ler = (c) => { try { return fs.readFileSync(c, "utf8"); } catch (_) { return null; } };
    const intacta = artefato.conferirAmarracaoDoArtefato(RAIZ, ler);
    assert.deepEqual(intacta, [], "a árvore íntegra foi acusada: " + juntar(intacta));

    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "amarr-"));
    CRIADOS.push(raiz);
    const faltando = artefato.conferirAmarracaoDoArtefato(raiz, ler);
    assert.equal(faltando.length, Object.keys(artefato.AMARRACAO_DO_ARTEFATO).length,
      "arquivo ausente não foi acusado: " + juntar(faltando));
    assert.ok(faltando.every((m) => /AUTORIDADE DO ARTEFATO AUSENTE/.test(m)));
  });

  test("ART-19: MENÇÃO não satisfaz a amarração — só CHAMADA", () => {
    const ler = (caminho) => {
      const rel = path.relative(RAIZ, caminho).split(path.sep).join("/");
      if (rel === "test/guarda_do_portao.js") {
        return '// exigirArtefatoUnico(raiz) — comentado\nconst n = "exigirArtefatoUnico(";\n';
      }
      try { return fs.readFileSync(caminho, "utf8"); } catch (_) { return null; }
    };
    const r = artefato.conferirAmarracaoDoArtefato(RAIZ, ler);
    assert.equal(r.length, 1, juntar(r));
    assert.match(r[0], /AUTORIDADE DO ARTEFATO DESLIGADA/);
    assert.match(r[0], /guarda_do_portao/);
  });

  test("ART-20: o JUIZ do CI carrega a acusação para fora do `npm test`", () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "juizart-"));
    CRIADOS.push(raiz);
    fs.mkdirSync(path.join(raiz, "ci"), { recursive: true });
    fs.mkdirSync(path.join(raiz, "test"), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, "ci", "piso_do_portao.json"), path.join(raiz, "ci", "piso_do_portao.json"));
    fs.copyFileSync(path.join(RAIZ, "package.json"), path.join(raiz, "package.json"));
    for (const nome of Object.keys(PORTAO.AUTORIDADE_DO_PISO)) {
      fs.copyFileSync(path.join(RAIZ, nome), path.join(raiz, nome));
    }
    const alvo = {
      raiz,
      arquivoSaida: path.join(raiz, "sem-evidencia.txt"),
      arquivoExit: path.join(raiz, "sem-exit.txt"),
    };
    const r = PORTAO.conferir(alvo).reprovacoes.filter((m) => /AUTORIDADE DO ARTEFATO/.test(m));
    assert.ok(r.length >= 1,
      "o juiz não acusou a ausência da autoridade do artefato: " + juntar(PORTAO.conferir(alvo).reprovacoes));
  });

  test("ART-21: esta suíte é recíproca — chama o censo e está registrada nele", () => {
    conferirCenso();
    const { OBRIGATORIAS } = require("./censo_de_suites.js");
    assert.ok(
      Object.prototype.hasOwnProperty.call(OBRIGATORIAS, "artefato_unico.test.js"),
      "esta suíte saiu do censo — voltaria a ser removível em silêncio"
    );
  });

  test("ART-22: o workflow executa a autoridade num passo próprio", () => {
    const yml = fs.readFileSync(
      path.join(RAIZ, ".github", "workflows", "provas-do-servidor.yml"), "utf8"
    ).split("\r\n").join("\n").split("\n").map((l) => l.replace(/(^|\s)#.*$/, "$1")).join("\n");
    assert.match(yml, /^\s*run:\s*node ci\/artefato\.js --conferir --raiz \.\s*$/m,
      "o workflow deixou de executar a autoridade do artefato");
    const passo = /- name: Artefato produtivo único\n([\s\S]*?)(?=\n\s{6}- name:|$)/.exec(yml);
    assert.ok(passo, "o passo do artefato sumiu do workflow");
    assert.ok(!/if:/.test(passo[1]), "o passo do artefato ganhou um `if:`");
    assert.ok(!/continue-on-error/.test(passo[1]), "o passo do artefato ganhou `continue-on-error`");
    // Depois do juiz: a ordem importa, porque o juiz é quem separa
    // "não executou" de "falhou".
    assert.ok(
      yml.indexOf("Portão fail-closed") < yml.indexOf("Artefato produtivo único"),
      "a autoridade do artefato passou a rodar ANTES do juiz"
    );
  });
});

// ===========================================================================
test.describe("ART/ARTEFATO — o que `git archive` produz é o que sobe", () => {
  test("ART-23: arquivo NÃO EXCLUÍDO sobra no artefato e reprova", () => {
    // Um caminho classificado como produtivo mas fora do `artefato_final`:
    // a árvore fica coerente e o ARTEFATO não.
    const r = reprovacoesDe({
      mutar: (raiz, e) => e(raiz, "extra.js", "// sobe junto\n"),
      manifesto: { produtivos: ["server.js", "package.json", "extra.js"] },
    });
    assert.ok(r.some((m) => /ARTEFATO CARREGA O QUE NÃO DEVIA/.test(m)), juntar(r));
    assert.ok(r.some((m) => /extra\.js/.test(m)), juntar(r));
  });

  test("ART-24: COMPACTADO no artefato reprova pelos BYTES", () => {
    const zip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64),
    ]);
    const r = reprovacoesDe({
      mutar: (raiz, e) => e(raiz, "pacote.js", zip),
      manifesto: {
        produtivos: ["server.js", "package.json", "pacote.js"],
        artefato_final: ["server.js", "package.json", "pacote.js"],
      },
    });
    assert.ok(r.some((m) => /COMPACTADO NO ARTEFATO/.test(m)), juntar(r));
  });

  test("ART-25: o glob de exclusão NÃO atravessa diretório", () => {
    assert.equal(artefato.casaGlob("mutacoes_*.js", "mutacoes_c4.js"), true);
    assert.equal(artefato.casaGlob("mutacoes_*.js", "sub/mutacoes_c4.js"), false,
      "o glob atravessou diretório — uma pasta inteira sairia da classificação");
    assert.equal(artefato.casaGlob("mutacoes_*.js", "mutacoes_c4.txt"), false);
  });

  test("ART-26: cabeçalho PAX do `git archive` não é conteúdo", () => {
    // O `git archive` põe `pax_global_header` na frente do tar para carregar o
    // SHA. Tratá-lo como arquivo faria a árvore íntegra reprovar por causa de um
    // metadado — e foi o primeiro vermelho desta OS.
    const nomes = artefato.nomesDoArchive(RAIZ, "HEAD");
    assert.ok(nomes, "o `git archive` não pôde ser lido");
    assert.ok(!nomes.some((n) => n.nome === "pax_global_header"),
      "o cabeçalho PAX voltou a ser contado como arquivo");
    assert.ok(nomes.some((n) => n.nome === "server.js"));
  });

  test("ART-27: o manifesto ausente ou ilegível é REPROVAÇÃO", () => {
    const semManifesto = artefato.conferir(repoForjado({ manifesto: null })).reprovacoes;
    assert.equal(semManifesto.length, 1, juntar(semManifesto));
    assert.match(semManifesto[0], /MANIFESTO DO ARTEFATO AUSENTE OU INVÁLIDO/);
  });
});
