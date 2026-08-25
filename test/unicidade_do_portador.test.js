// test/unicidade_do_portador.test.js — A AUTORIDADE ÚNICA DO SERVIDOR (OS 52-C2).
//
// ===========================================================================
// O QUE ESTA SUÍTE PROVA, E POR QUE ELA NÃO É A ÚNICA DEFESA
// ===========================================================================
//
// Ela exercita o catálogo cenário a cenário, para que o relatório do portão
// diga QUAL vetor foi coberto — um número agregado esconde o que sumiu.
//
// Mas ela não é a única defesa, e isso é deliberado. `conferirCenso` chama
// `conferirProvaDaUnicidade` diretamente, e as três suítes obrigatórias chamam
// o censo. Apagar ESTA suíte não deixa nada verde: ela está em OBRIGATORIAS,
// com piso, e a prova continua rodando pelas outras três. O anel foi desenhado
// para não ter ponto único.
//
// AS MUTAÇÕES SÃO REAIS, e rodam contra uma CÓPIA do trio de módulos numa
// árvore descartável. Não há como afirmar "a guarda reprova se for esvaziada"
// lendo texto: é preciso esvaziá-la e ver. Cada caso do §R monta o repositório
// inteiro, aplica UMA mutação, carrega o módulo mutado e exige que a prova
// externa reprove.
// ===========================================================================

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { conferirCenso } = require("./censo_de_suites.js");
const unicidade = require("./unicidade_do_portador.js");
const fixtures = require("./fixtures_de_unicidade.js");
const prova = require("./prova_da_unicidade.js");

const RAIZ = path.join(__dirname, "..");
const FONTE_DO_PORTADOR = fs.readFileSync(path.join(RAIZ, unicidade.PORTADOR_UNICO), "latin1");

// A prova roda UMA vez por processo; os casos abaixo leem o resultado dela.
const PLACAR = prova.conferirProvaDaUnicidade();
const PORCENARIO = new Map(PLACAR.resultados.map((r) => [r.id, r]));

test.after(() => fixtures.limparArvores());

// ===========================================================================
test.describe("§C — DETECÇÃO POR CAPACIDADE, CENÁRIO A CENÁRIO", () => {
  for (const id of fixtures.CENARIOS_OBRIGATORIOS) {
    const r = PORCENARIO.get(id);
    test(id + ": " + (r ? r.o_que : "(cenário ausente)"), () => {
      assert.ok(r, "o cenário " + id + " sumiu do catálogo");
      assert.equal(
        r.obtido, r.esperado,
        id + " devia " + r.esperado + " e " + r.obtido +
          (r.motivo ? " (" + r.motivo + ")" : "")
      );
    });
  }
});

// ===========================================================================
test.describe("§A — A ÁRVORE REAL, E A ISENÇÃO QUE É RESULTADO DE ANÁLISE", () => {
  test("UNI-A1: a árvore real inteira passa, varrida recursivamente", () => {
    const e = unicidade.conferirUnicidadeDoPortador();
    assert.ok(e.arquivos > 40,
      "a varredura leu só " + e.arquivos + " arquivos — ela é RECURSIVA e a " +
      "árvore tem mais que isso; varredura curta é varredura cega");
    assert.equal(e.portadorConferido, true);
  });

  test("UNI-A2: a varredura desce em `docs/`, `ci/`, `test/` e `contrato/`", () => {
    // A guarda da OS 52-C1 varria só a raiz com as assinaturas fortes, porque
    // no texto CRU oito arquivos legítimos casavam. O scanner léxico eliminou
    // esses falsos positivos, e é isso que permitiu a varredura recursiva sem
    // exceção nenhuma. Este caso prova que a recursão de fato acontece.
    const vistos = unicidade.listarArquivos(RAIZ, "", []).map((a) => a.relativo);
    for (const pasta of ["docs/", "ci/", "test/", "contrato/", ".github/"]) {
      assert.ok(vistos.some((v) => v.startsWith(pasta)),
        "a varredura não desceu em `" + pasta + "`");
    }
    assert.deepEqual(
      unicidade.DIRETORIOS_TECNICOS.slice().sort(), [".git", "node_modules"],
      "a lista de diretórios fora da varredura cresceu — cada exclusão precisa " +
      "de justificativa própria, e curinga não é justificativa"
    );
  });

  test("UNI-A3: `app.html` é isento pela ANÁLISE, não pelo caminho", () => {
    // A isenção positiva do §4: provar AUSÊNCIA de capacidade, item por item.
    const bruto = fs.readFileSync(path.join(RAIZ, "app.html"));
    const laudo = unicidade.analisar("app.html", bruto);
    assert.deepEqual(laudo.acusacoes, [],
      "`app.html` passou a formar capacidade de servidor: " + laudo.acusacoes.join("; "));
    const s = laudo.sinais;
    assert.equal(s.escuta, false, "`app.html` escuta numa porta");
    assert.equal(s.criaServidor, false, "`app.html` cria servidor");
    assert.equal(s.guid, false, "`app.html` carrega o GUID do handshake");
    assert.equal(s.declaraIngresso, false, "`app.html` implementa o ingresso");
    assert.equal(s.despachaIngresso, false, "`app.html` despacha o ingresso");
    assert.equal(s.concedeAssento, false, "`app.html` concede assento");
    assert.equal(s.arranqueDoTransporte, false, "`app.html` inicia o transporte");

    // E o outro lado da mesma moeda: ele CONTINUA sendo cliente. Um `app.html`
    // que deixasse de falar `entrarMesa` teria virado outra coisa, e a isenção
    // estaria protegendo um arquivo que ninguém examinou.
    assert.match(bruto.toString("latin1"), /entrarMesa/,
      "`app.html` deixou de falar `entrarMesa` — não é mais o cliente isento");
  });

  test("UNI-A4: o PORTADOR é conferido por dentro — análise cega reprova", () => {
    const laudo = unicidade.analisar("server.js", Buffer.from(FONTE_DO_PORTADOR, "latin1"));
    assert.ok(laudo.acusacoes.length >= 3,
      "a análise reconhece só " + laudo.acusacoes.length + " capacidades no " +
      "próprio servidor; cega assim ela aprovaria qualquer duplicata");
    const s = laudo.sinais;
    for (const sinal of ["criaServidor", "escuta", "guid", "declaraIngresso", "despachaIngresso"]) {
      assert.equal(s[sinal], true, "o portador deixou de exibir o sinal `" + sinal + "`");
    }
  });

  test("UNI-A5: a guarda não casa consigo mesma", () => {
    // Guarda que se denuncia reprova a árvore íntegra, e a primeira pessoa a
    // ver vermelho sem defeito nenhum a remove por incômodo. A OS 52-C1 pagou
    // isso duas vezes; aqui o risco é maior, porque o módulo CITA cada padrão.
    for (const rel of [
      "test/unicidade_do_portador.js",
      "test/fixtures_de_unicidade.js",
      "test/prova_da_unicidade.js",
      "test/unicidade_do_portador.test.js",
    ]) {
      const laudo = unicidade.analisar(rel, fs.readFileSync(path.join(RAIZ, rel)));
      assert.deepEqual(laudo.acusacoes, [],
        "`" + rel + "` acusa a si mesmo: " + laudo.acusacoes.join("; "));
    }
  });
});

// ===========================================================================
test.describe("§F — OS FORMATOS, LIDOS PELOS BYTES", () => {
  test("UNI-F1: o formato vem dos BYTES, e o nome não muda nada", () => {
    const casos = [
      ["ZIP", fixtures.zipCom("server.js", "x")],
      ["TAR", fixtures.tarCom("server.js", "x")],
      ["GZIP", fixtures.comMagic(fixtures.MAGIC.GZIP)],
      ["XZ", fixtures.comMagic(fixtures.MAGIC.XZ)],
      ["7Z", fixtures.comMagic(fixtures.MAGIC.SETEZ)],
      ["RAR", fixtures.comMagic(fixtures.MAGIC.RAR)],
      ["BZIP2", fixtures.comMagic(fixtures.MAGIC.BZIP2)],
      ["ZSTD", fixtures.comMagic(fixtures.MAGIC.ZSTD)],
    ];
    for (const [formato, buf] of casos) {
      for (const nome of ["entrega", "notas.txt", "x.bin", "leia.md", "a"]) {
        assert.equal(unicidade.formatoCompactadoDe(buf), formato,
          formato + " não foi reconhecido quando chamado de `" + nome + "`");
      }
    }
    // E texto comum não vira pacote por acidente.
    assert.equal(unicidade.formatoCompactadoDe(Buffer.from("PK é uma sigla comum\n")), null);
    assert.equal(unicidade.formatoCompactadoDe(Buffer.from("# documento\n")), null);
  });

  test("UNI-F2: o INVENTÁRIO do pacote nomeia o portador implantável", () => {
    const zip = fixtures.zipCom("server.js", fixtures.SERVIDOR_HTTP);
    assert.deepEqual(unicidade.inventarioDeZip(zip), ["server.js"]);
    assert.deepEqual(unicidade.portadoresNoInventario(["a/server.js", "leia.md"]), ["a/server.js"]);
    assert.deepEqual(unicidade.inventarioDeTar(fixtures.tarCom("package.json", "{}")), ["package.json"]);

    const laudo = unicidade.analisar("entrega", zip);
    assert.match(laudo.acusacoes.join(" "), /pacote ZIP/);
    assert.match(laudo.acusacoes.join(" "), /server\.js/,
      "o inventário não nomeou o que o pacote carrega");
  });

  test("UNI-F3: os limites da inspeção são explícitos", () => {
    // Inspeção sem teto vira vetor de expansão abusiva. Nada é descomprimido —
    // o inventário está em claro nos cabeçalhos —, e ainda assim há limite.
    assert.ok(unicidade.LIMITES.bytesLidosDoArquivo > 0);
    assert.ok(unicidade.LIMITES.entradasDeInventario > 0);
    assert.ok(unicidade.LIMITES.entradasDeInventario <= 5000);
    assert.equal(unicidade.LIMITES.profundidadeDeInventario, 1,
      "a inspeção passou a descer em pacote dentro de pacote");
  });
});

// ===========================================================================
test.describe("§R — RECIPROCIDADE: a guarda contra a própria neutralização", () => {
  /** Monta um repositório descartável com CÓPIA do trio de módulos, aplica uma
   *  mutação no texto de um deles e devolve a raiz. */
  /** Monta um repositório descartável com CÓPIA do `test/` real e aplica um
   *  CONJUNTO de mutações — arquivo por arquivo.
   *
   *  Ser um conjunto, e não uma só, é exigência do §5 da OS: a neutralização
   *  que interessa é COORDENADA. Apagar uma afirmação da prova, sozinha, não
   *  prova nada — sem violação na árvore não há o que deixar de detectar. O
   *  par certo é "regra oca MAIS afirmação apagada", e é ele que mostra se as
   *  afirmações restantes ainda seguram. */
  function repoMutado(mutacoes) {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "recip-"));
    fs.mkdirSync(path.join(raiz, "test"), { recursive: true });
    fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
    fs.writeFileSync(path.join(raiz, "package.json"),
      fs.readFileSync(path.join(RAIZ, "package.json")));
    // O `test/` INTEIRO é copiado, e não só o trio: a prova externa cobra que
    // a varredura tenha lido uma árvore de verdade, e três arquivos não são
    // uma árvore. Copiar tudo também deixa a cópia parecida com o original,
    // que é o que dá sentido a "a cópia íntegra aprova".
    for (const nome of fs.readdirSync(__dirname)) {
      const de = path.join(__dirname, nome);
      if (!fs.statSync(de).isFile()) continue;
      let texto = fs.readFileSync(de, "utf8");
      for (const [alvo, mutacao] of mutacoes) {
        if (alvo !== nome) continue;
        const antes = texto;
        texto = mutacao(texto);
        assert.notEqual(texto, antes, "a mutação não encontrou âncora em " + nome);
      }
      fs.writeFileSync(path.join(raiz, "test", nome), texto);
    }
    return raiz;
  }

  function provaDe(raiz) {
    const alvo = path.join(raiz, "test", "prova_da_unicidade.js");
    delete require.cache[require.resolve(alvo)];
    delete require.cache[require.resolve(path.join(raiz, "test", "unicidade_do_portador.js"))];
    delete require.cache[require.resolve(path.join(raiz, "test", "fixtures_de_unicidade.js"))];
    return require(alvo);
  }

  const APAGA1 = (t) => t.replace(
    "  const divergentes = resultados.filter((r) => !r.conforme);",
    "  const divergentes = [];");
  const APAGA2 = (t) => t.replace(
    "    resultados.filter((r) => r.obtido === r.esperado).length, resultados.length,",
    "    resultados.length, resultados.length,");
  const REGRA_OCA = (t) => t.replace(
    "function capacidadesDe(s) {",
    "function capacidadesDe(s) {\n  if (s) return [];");

  const MUTACOES = [
    ["R-01 · a REGRA é esvaziada (corpo trivial)", [["unicidade_do_portador.js",
      (t) => t.replace(
        "function conferirUnicidadeDoPortador(raizDoRepo) {",
        "function conferirUnicidadeDoPortador(raizDoRepo) {\n  return { arquivos: 99, asseveracoes: 99, portadorConferido: true };"
      )]]],
    ["R-02 · a ANÁLISE vira tautologia (nunca acusa nada)", [["unicidade_do_portador.js", REGRA_OCA]]],
    ["R-03 · os FORMATOS deixam de ser reconhecidos", [["unicidade_do_portador.js",
      (t) => t.replace(
        "function formatoCompactadoDe(buf) {",
        "function formatoCompactadoDe(buf) {\n  if (buf) return null;"
      )]]],
    ["R-04 · a varredura para de ser RECURSIVA", [["unicidade_do_portador.js",
      (t) => t.replace(
        "if (st.isDirectory()) listarArquivos(caminho, relativo, saida);",
        "if (st.isDirectory()) { /* não desce */ }"
      )]]],
    ["R-05 · o CATÁLOGO é encolhido", [["fixtures_de_unicidade.js",
      (t) => t.replace(
        "function catalogo(fonteDoPortador) {",
        "function catalogo(fonteDoPortador) {\n  if (fonteDoPortador) return [];"
      )]]],
    ["R-06 · a prova deixa de EXECUTAR o catálogo", [["prova_da_unicidade.js",
      (t) => t.replace(
        "  const resultados = catalogoMemorizado || executarCatalogo(raizDoRepo);",
        "  const resultados = [];"
      )]]],
    // R-07 e R-07b: NEUTRALIZAÇÃO COORDENADA. Regra oca MAIS afirmação apagada.
    // A conformidade é afirmada de três formas independentes, e isso não é
    // repetição descuidada: a primeira versão tinha uma só, e trocar a lista de
    // divergentes por `[]` cegava a prova inteira com nome, comentário e
    // estrutura preservados. Aqui a regra é esvaziada JUNTO, para haver o que
    // deixar de detectar — sem violação na árvore, afirmação apagada não prova
    // nada.
    ["R-07 · regra oca + a 1ª afirmação apagada", [
      ["unicidade_do_portador.js", REGRA_OCA], ["prova_da_unicidade.js", APAGA1]]],
    ["R-07b · regra oca + a 1ª e a 2ª apagadas", [
      ["unicidade_do_portador.js", REGRA_OCA],
      ["prova_da_unicidade.js", (t) => APAGA2(APAGA1(t))]]],
  ];
  for (const [rotulo, mutacoes] of MUTACOES) {
    test(rotulo + " — e a prova externa reprova", () => {
      const raiz = repoMutado(mutacoes);
      try {
        assert.throws(
          () => provaDe(raiz).conferirProvaDaUnicidade(raiz),
          (erro) => erro instanceof assert.AssertionError,
          "a neutralização passou: " + rotulo
        );
      } finally {
        fs.rmSync(raiz, { recursive: true, force: true });
      }
    });
  }

  test("R-08: a prova ÍNTEGRA aprova a cópia íntegra — não é veto geral", () => {
    // Sem isto, uma prova que rejeitasse qualquer cópia passaria em R-01..R-07
    // sem provar nada. É a metade positiva que dá sentido às negativas.
    const raiz = repoMutado([]);
    try {
      const r = provaDe(raiz).conferirProvaDaUnicidade(raiz);
      assert.ok(r.resultados.length >= 30, "a cópia íntegra rodou poucos cenários");
      assert.ok(r.resultados.every((x) => x.conforme));
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });

  test("R-09: o catálogo tem as DUAS metades, e nenhuma é decorativa", () => {
    const negativos = PLACAR.resultados.filter((r) => r.esperado === "reprova");
    const positivos = PLACAR.resultados.filter((r) => r.esperado === "passa");
    assert.ok(negativos.length >= 24, "só " + negativos.length + " cenários de reprovação");
    assert.ok(positivos.length >= 6, "só " + positivos.length + " cenários de aprovação");
    // Resultado negativo REAL: cada negativo tem de trazer o motivo da recusa,
    // e não apenas ter falhado por qualquer erro.
    for (const n of negativos) {
      assert.ok(n.motivo && n.motivo.length > 10,
        n.id + " reprovou sem dizer por quê — pode ter falhado por outro motivo");
    }
  });
});

// ===========================================================================
test.describe("§G — O GLOB OFICIAL (§6)", () => {
  test("GLOB-01: o comando oficial alcança tudo o que precisa rodar", () => {
    const r = prova.conferirGlobOficial();
    assert.ok(r.suites >= 5);
  });

  test("GLOB-02: estreitar para suíte-isca, nomear arquivo ou perder suíte reprova", () => {
    const base = fs.readFileSync(path.join(RAIZ, "package.json"), "utf8");
    const comando = (comandoNovo) => {
      const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "glob-"));
      fs.mkdirSync(path.join(raiz, "test"), { recursive: true });
      fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
      const pkg = JSON.parse(base);
      pkg.scripts.test = comandoNovo;
      fs.writeFileSync(path.join(raiz, "package.json"), JSON.stringify(pkg, null, 2));
      for (const s of Object.keys(prova.ALCANCE_OBRIGATORIO)) {
        fs.writeFileSync(path.join(raiz, s), "// suíte\n");
      }
      // A etapa `pretest` também é cobrada, então a árvore forjada precisa do
      // arquivo para onde ela aponta — senão TODO vetor reprovaria por um
      // motivo que não é o que o caso está medindo.
      fs.writeFileSync(path.join(raiz, "test", "guarda_do_portao.js"), "// guarda\n");
      return raiz;
    };
    const vetores = [
      ['node --test "test/isca.test.js"', "estreitado para uma suíte-isca"],
      ["node --test test/ci_obrigatorio.test.js", "trocado por arquivo único"],
      ['node --test "test/c*.test.js"', "glob estreitado que perde suítes"],
    ];
    for (const [cmd, oQue] of vetores) {
      const raiz = comando(cmd);
      try {
        assert.throws(() => prova.conferirGlobOficial(raiz), assert.AssertionError,
          "o comando " + oQue + " passou: " + cmd);
      } finally {
        fs.rmSync(raiz, { recursive: true, force: true });
      }
    }
    // E o comando oficial de verdade, na árvore forjada completa, passa.
    const raiz = comando(JSON.parse(base).scripts.test);
    try { prova.conferirGlobOficial(raiz); }
    finally { fs.rmSync(raiz, { recursive: true, force: true }); }
  });

  test("GLOB-03: remover uma suíte obrigatória do disco reprova", () => {
    const base = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
    for (const ausente of Object.keys(prova.ALCANCE_OBRIGATORIO)) {
      const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "glob-"));
      fs.mkdirSync(path.join(raiz, "test"), { recursive: true });
      fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
      fs.writeFileSync(path.join(raiz, "package.json"), JSON.stringify(base, null, 2));
      for (const s of Object.keys(prova.ALCANCE_OBRIGATORIO)) {
        if (s !== ausente) fs.writeFileSync(path.join(raiz, s), "// suíte\n");
      }
      fs.writeFileSync(path.join(raiz, "test", "guarda_do_portao.js"), "// guarda\n");
      try {
        assert.throws(() => prova.conferirGlobOficial(raiz), assert.AssertionError,
          "faltar `" + ausente + "` não reprovou");
      } finally {
        fs.rmSync(raiz, { recursive: true, force: true });
      }
    }
  });

  test("GLOB-04: `npm test` alcança o censo, a unicidade e o CI externo", () => {
    const { alcancados } = prova.alcanceDoComando(
      JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8")).scripts.test,
      RAIZ
    );
    for (const s of Object.keys(prova.ALCANCE_OBRIGATORIO)) assert.ok(alcancados.has(s), s);
  });
});

// ===========================================================================
test.describe("§CENSO — o anel fechado", () => {
  test("CENSO-UNI: `conferirCenso` alcança a prova da unicidade", () => {
    // Executável, não textual: monta um repositório com o `test/` real, planta
    // um servidor novo numa subpasta e exige que o CENSO reprove. Se a chamada
    // sumir do corpo dele, nada reprova — e é isso que este caso mede.
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "censo-"));
    const testeForjado = path.join(raiz, "test");
    fs.mkdirSync(testeForjado, { recursive: true });
    for (const arquivo of fs.readdirSync(__dirname)) {
      const de = path.join(__dirname, arquivo);
      if (fs.statSync(de).isFile()) fs.copyFileSync(de, path.join(testeForjado, arquivo));
    }
    fs.copyFileSync(path.join(RAIZ, "package.json"), path.join(raiz, "package.json"));
    fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
    try {
      conferirCenso(testeForjado); // linha de base: a árvore forjada está limpa
      fs.mkdirSync(path.join(raiz, "servico"), { recursive: true });
      fs.writeFileSync(path.join(raiz, "servico", "entrega.js"), fixtures.SERVIDOR_HTTP);
      assert.throws(
        () => conferirCenso(testeForjado),
        assert.AssertionError,
        "`conferirCenso` deixou de alcançar a guarda de unicidade"
      );
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });

  test("CENSO-GLOB: `conferirCenso` alcança a guarda do glob", () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "censo-"));
    const testeForjado = path.join(raiz, "test");
    fs.mkdirSync(testeForjado, { recursive: true });
    for (const arquivo of fs.readdirSync(__dirname)) {
      const de = path.join(__dirname, arquivo);
      if (fs.statSync(de).isFile()) fs.copyFileSync(de, path.join(testeForjado, arquivo));
    }
    fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
    const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
    pkg.scripts.test = "node --test test/ci_obrigatorio.test.js";
    fs.writeFileSync(path.join(raiz, "package.json"), JSON.stringify(pkg, null, 2));
    try {
      assert.throws(
        () => conferirCenso(testeForjado),
        assert.AssertionError,
        "`conferirCenso` deixou de alcançar a guarda do glob oficial"
      );
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });
});
