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
    assert.equal(s.despachaCaso, false, "`app.html` despacha o ingresso");
    assert.equal(s.concedeAssento, false, "`app.html` concede assento");
    assert.equal(s.arranqueChamado, false, "`app.html` inicia o transporte");

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
    for (const sinal of ["criaServidor", "escuta", "guid", "declaraIngresso", "despachaCaso", "arranqueChamado", "escutaPorta"]) {
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
    // [OS 52-C3] A acusação virou objeto `{ ramo, texto }`: sem o id do ramo
    // não há como cobrar cobertura de ramo, e cobertura de ramo é o §C3-06.
    const texto = laudo.acusacoes.map((a) => a.texto).join(" ");
    assert.equal(laudo.acusacoes[0].ramo, "PACOTE");
    assert.match(texto, /pacote ZIP/);
    assert.match(texto, /server\.js/,
      "o inventário não nomeou o que o pacote carrega");
  });

  test("UNI-F3: os limites da inspeção são explícitos", () => {
    // Inspeção sem teto vira vetor de expansão abusiva. Nada é descomprimido —
    // o inventário está em claro nos cabeçalhos —, e ainda assim há limite.
    assert.ok(unicidade.LIMITES.bytesLidosDoArquivo > 0);
    assert.ok(unicidade.LIMITES.entradasDeInventario > 0);
    assert.ok(unicidade.LIMITES.entradasDeInventario <= 5000);
    // [OS 52-C3] `profundidadeDeInventario` foi REMOVIDO. Ele era declarado e
    // nunca aplicado — a R2 registrou isso como residual, e limite decorativo
    // é pior que limite nenhum: afirma um cuidado que não existe. Não faz
    // falta, porque compactado é reprovado por SER compactado, em qualquer
    // aninhamento. Esta asserção existe para que ele não volte como enfeite.
    assert.equal(unicidade.LIMITES.profundidadeDeInventario, undefined,
      "voltou um limite declarado que a inspeção não aplica");
  });

  test("UNI-F4: arquivo grande demais para ser lido inteiro REPROVA", () => {
    // [OS 52-C3, residual da R2] O teto de bytes era SILENCIOSO: o arquivo era
    // truncado e analisado assim mesmo, e um servidor depois do byte 32 Mi
    // simplesmente não era lido. "Não li" saía como "não achei".
    //
    // A prova roda sobre `analisar`, e não sobre um arquivo de 32 MiB no disco:
    // o que está em questão é a POLÍTICA, e escrever trinta e dois megabytes em
    // cada suíte que chama o censo custaria caro sem provar mais nada.
    const inocente = Buffer.from("const x = 1;\n", "latin1");
    assert.deepEqual(
      unicidade.analisar("grande.js", inocente, { truncado: false }).acusacoes, [],
      "arquivo pequeno e inocente não pode ser acusado"
    );
    const truncado = unicidade.analisar("grande.js", inocente, { truncado: true });
    assert.equal(truncado.acusacoes.length, 1);
    assert.equal(truncado.acusacoes[0].ramo, "GRANDE-DEMAIS",
      "o corte por tamanho voltou a ser silencioso");
  });

  test("UNI-F5: elo simbólico é REPROVADO, e não pulado em silêncio", () => {
    // [OS 52-C3, residual da R2] A C2 pulava symlink sem dizer por quê. Um elo
    // aponta para conteúdo que mora FORA da árvore versionada: ler o alvo seria
    // auditar o que o repositório não carrega, e pular é aprovar sem olhar.
    //
    // O elo é montado como JUNÇÃO de diretório, que é a forma que o Windows
    // cria sem privilégio de administrador.
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "elo-"));
    const fora = fs.mkdtempSync(path.join(os.tmpdir(), "fora-"));
    try {
      fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
      fs.writeFileSync(path.join(fora, "qualquer.js"), "const y = 2;\n");
      fs.symlinkSync(fora, path.join(raiz, "atalho"), "junction");

      const listados = unicidade.listarArquivos(raiz, "", []);
      const elo = listados.find((a) => a.relativo === "atalho");
      assert.ok(elo, "o elo simbólico não apareceu na varredura");
      assert.equal(elo.elo, true, "o elo não foi marcado como elo");
      assert.throws(
        () => unicidade.conferirUnicidadeDoPortador(raiz),
        (erro) => erro instanceof assert.AssertionError && /elo simb/.test(erro.message),
        "a árvore com elo simbólico passou"
      );
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
      fs.rmSync(fora, { recursive: true, force: true });
    }
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
    "function capacidadesDe(sinais, escopo) {",
    "function capacidadesDe(sinais, escopo) {\n  if (sinais) return [];");

  const MUTACOES = [
    // [OS 52-C3] O corpo trivial passou a ser o de `laudoDaArvore`: é ele que
    // produz o veredito desde que a prova externa precisou observar os RAMOS.
    // Esvaziar só o invólucro deixaria a prova enxergando o laudo verdadeiro.
    ["R-01 · a REGRA é esvaziada (corpo trivial)", [["unicidade_do_portador.js",
      (t) => t.replace(
        "function laudoDaArvore(raizDoRepo) {",
        "function laudoDaArvore(raizDoRepo) {\n  if (raizDoRepo || true) return { estatistica: { arquivos: 99, asseveracoes: 99, portadorConferido: true, ramos: {}, escopos: { arquivo: 0, conjunto: 0, arvore: 0 } }, problemas: [], ramosDoPortador: [\"REDE\", \"ESCUTA-DE-PORTA\", \"ARRANQUE\"], portadorReconhecido: true };"
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
  /** Uma suíte forjada MÍNIMA, porém legítima.
   *
   *  [OS 52-C3] Um arquivo com um comentário dentro deixou de servir: a guarda
   *  do glob passou a cobrar que cada obrigatória continue CARREGANDO o módulo
   *  que ela exercita, e é isso que fecha a isca de corpos triviais. A fixture
   *  acompanha — se representasse uma suíte que a guarda legítima reprova, os
   *  casos daqui reprovariam por um motivo que não é o deles. */
  const suiteMinima = (rel) => {
    const exige = prova.ALCANCE_OBRIGATORIO[rel].exige;
    const alvo = exige === "portao_do_ci" ? "../ci/portao_do_ci.js" : "./" + exige + ".js";
    return 'require("' + alvo + '");\n// suíte forjada, porém ligada ao que exercita\n';
  };

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
        fs.writeFileSync(path.join(raiz, s), suiteMinima(s));
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
        if (s !== ausente) fs.writeFileSync(path.join(raiz, s), suiteMinima(s));
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

// ===========================================================================
// §K — A DECISÃO COMPOSTA (OS 52-C3)
//
// A R2 derrubou a C2 com uma duplicata partida em dois arquivos. Nenhum dos
// dois, sozinho, formava capacidade; juntos, formavam um servidor que subiu de
// verdade e respondeu HTTP 200. Os casos abaixo cobram as duas metades: a
// composição pega o que está partido, e NÃO pega o que é só uma peça.
// ===========================================================================
test.describe("§K — A DECISÃO COMPOSTA", () => {
  const laudoDe = (montar) => {
    const raiz = fixtures.arvore(FONTE_DO_PORTADOR);
    try {
      montar(raiz);
      return unicidade.laudoDaArvore(raiz);
    } finally {
      fixtures.limparArvores();
    }
  };

  test("UNI-K1: nenhuma peça, SOZINHA, é acusada de nada", () => {
    // A metade positiva da composição, e a que impede a guarda de virar veto
    // geral: um arquivo que só cria, sem escuta em canto nenhum da árvore, é
    // código comum e tem de passar.
    const so = laudoDe((r) => fixtures.escrever(r, "meia/peca.js", fixtures.PECA_CRIA));
    assert.deepEqual(so.problemas, [],
      "a peça de criação sozinha foi acusada — a guarda virou veto geral");
  });

  test("UNI-K2: as duas peças JUNTAS reprovam, no escopo `conjunto`", () => {
    const juntas = laudoDe((r) => {
      fixtures.escrever(r, "frag/cria.js", fixtures.PECA_CRIA);
      fixtures.escrever(r, "frag/sobe.js", fixtures.pecaEscuta("./cria.js"));
    });
    assert.ok(juntas.problemas.length > 0, "a duplicata fragmentada passou");
    assert.ok(juntas.estatistica.escopos.conjunto > 0,
      "a acusação não saiu no escopo `conjunto`");
    assert.ok(
      juntas.problemas.some((p) => /frag\/cria\.js/.test(p) && /frag\/sobe\.js/.test(p)),
      "a acusação não nomeou os DOIS arquivos que formam a porta"
    );
  });

  test("UNI-K3: sem ligação declarada, o escopo `arvore` ainda fecha", () => {
    const soltas = laudoDe((r) => {
      fixtures.escrever(r, "solto/cria.js", fixtures.PECA_CRIA_SOLTA);
      fixtures.escrever(r, "outro/lugar/sobe.js", fixtures.PECA_ESCUTA_SOLTA);
    });
    assert.ok(soltas.estatistica.escopos.arvore > 0,
      "o escopo residual não disparou — fragmentação sem `require` escapa");
  });

  test("UNI-K4: o PORTADOR não conduz e não empresta capacidade", () => {
    // Um arquivo que apenas EXERCITA o bundle não pode herdar a capacidade
    // dele. Sem esta regra a guarda reprovaria toda suíte do repositório.
    const exercita = laudoDe((r) =>
      fixtures.escrever(r, "test/usa.test.js",
        "const bundle = require('../server.js');\nconst cfg = { p: 1 };\nmodule.exports = { bundle, cfg };\n"));
    assert.deepEqual(exercita.problemas, [],
      "quem apenas requer o portador foi acusado de ser um segundo servidor");
  });

  test("UNI-K5: sinal BRUTO não atravessa arquivo", () => {
    // Prosa num documento não pode emprestar handshake ao programa de outro
    // arquivo. Se o bruto compusesse, o documento seria acusado de implementar
    // handshake por causa da escuta que mora noutro canto da árvore.
    const misto = laudoDe((r) => {
      fixtures.escrever(r, "docs/so_prosa.md",
        "# Nota\n\nO handshake devolve Sec-WebSocket-Accept ao cliente.\n");
      fixtures.escrever(r, "meia/peca.js", fixtures.PECA_CRIA);
    });
    assert.ok(
      !misto.problemas.some((p) => /so_prosa\.md/.test(p)),
      "a prosa foi acusada por causa de um sinal de programa de outro arquivo"
    );
  });

  test("UNI-K6: a ligação só conta quando o alvo EXISTE na árvore", () => {
    const existentes = new Set(["frag/cria.js", "frag/sobe.js"]);
    assert.equal(
      unicidade.resolverEspecificador("frag/sobe.js", "./cria.js", existentes),
      "frag/cria.js"
    );
    assert.equal(
      unicidade.resolverEspecificador("frag/sobe.js", "./inexistente.js", existentes),
      null,
      "um `require` para arquivo que não existe virou aresta"
    );
    assert.deepEqual(
      unicidade.especificadoresDe("const a = require('./cria.js');\nconst b = require('node:http');"),
      ["./cria.js"],
      "especificador de módulo interno do Node virou ligação"
    );
  });

  test("UNI-K7: TRÊS arquivos na mesma porta também fecham", () => {
    const tres = laudoDe((r) => {
      fixtures.escrever(r, "t1/cria.js", fixtures.PECA_CRIA);
      fixtures.escrever(r, "t2/repassa.js", fixtures.pecaReexporta("../t1/cria.js"));
      fixtures.escrever(r, "t3/sobe.js", fixtures.pecaEscuta("../t2/repassa.js"));
    });
    assert.ok(tres.problemas.length > 0, "a duplicata em três arquivos passou");
    const membros = unicidade.componentesDe([
      { relativo: "t1/cria.js", especificadores: [], sinais: {} },
      { relativo: "t2/repassa.js", especificadores: ["../t1/cria.js"], sinais: {} },
      { relativo: "t3/sobe.js", especificadores: ["../t2/repassa.js"], sinais: {} },
    ]).get("t1/cria.js");
    assert.equal(membros.length, 3, "a componente conexa não juntou os três");
  });

  test("UNI-K8: o argumento da chamada é lido com parênteses balanceados", () => {
    // Foi um parêntese no meio do argumento que deixou o servidor UDP passar na
    // C2: `bind(Number(process.env.PORT_UDP) || 41234)` não cabia numa leitura
    // por expressão regular chapada.
    assert.deepEqual(
      unicidade.argumentosDaChamada("canal.bind(Number(process.env.PORT_UDP) || 41234);", "\\.\\s*bind\\s*\\("),
      ["Number(process.env.PORT_UDP) || 41234"]
    );
    assert.deepEqual(
      unicidade.argumentosDaChamada("fn.bind(this);", "\\.\\s*bind\\s*\\("),
      ["this"]
    );
  });
});

// ===========================================================================
// §B — COBERTURA DE RAMO: nenhum ramo é decoração (§C3-06)
//
// A C2 tinha um ramo MORTO e não sabia: o handshake por GUID nunca disparava,
// porque a fixture montava o GUID por concatenação e o texto contíguo jamais
// existia no arquivo escrito. Verde por três semanas. A defesa é confrontar a
// tabela declarada com o que os cenários DE FATO fizeram disparar — e provar
// que essa conferência não sobrevive à morte do que ela confere.
// ===========================================================================
test.describe("§B — COBERTURA DE RAMO", () => {
  /** Uma cópia do `test/` real, com UMA mutação de texto num arquivo. */
  function repoComMutacao(nomeDoArquivo, mutacao) {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ramo-"));
    fs.mkdirSync(path.join(raiz, "test"), { recursive: true });
    fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
    fs.writeFileSync(path.join(raiz, "package.json"),
      fs.readFileSync(path.join(RAIZ, "package.json")));
    for (const nome of fs.readdirSync(__dirname)) {
      const de = path.join(__dirname, nome);
      if (!fs.statSync(de).isFile()) continue;
      let texto = fs.readFileSync(de, "utf8");
      if (nome === nomeDoArquivo) {
        const antes = texto;
        texto = mutacao(texto);
        assert.notEqual(texto, antes, "a mutação não encontrou âncora em " + nome);
      }
      fs.writeFileSync(path.join(raiz, "test", nome), texto);
    }
    return raiz;
  }

  function provaDoRepo(raiz) {
    for (const nome of ["prova_da_unicidade.js", "unicidade_do_portador.js", "fixtures_de_unicidade.js"]) {
      delete require.cache[require.resolve(path.join(raiz, "test", nome))];
    }
    return require(path.join(raiz, "test", "prova_da_unicidade.js"));
  }

  test("UNI-B1: todo ramo tem cenário, e todo cenário declarado tem ramo", () => {
    assert.deepEqual(
      unicidade.IDS_DOS_RAMOS.filter((id) => !(id in fixtures.RAMO_EXERCITADO_POR)), [],
      "ramo sem cenário exclusivo declarado"
    );
    assert.deepEqual(
      Object.keys(fixtures.RAMO_EXERCITADO_POR).filter((id) => !unicidade.IDS_DOS_RAMOS.includes(id)), [],
      "cenário declarado para ramo que não existe na tabela"
    );
    assert.ok(unicidade.IDS_DOS_RAMOS.length >= 9, "a tabela de ramos encolheu");
  });

  test("UNI-B2: cada ramo foi ACIONADO pelo cenário exclusivo dele", () => {
    // Observação externa: lê-se o laudo da regra, cenário a cenário, e não um
    // contador que a própria regra mantenha.
    for (const [ramo, cenario] of Object.entries(fixtures.RAMO_EXERCITADO_POR)) {
      const r = PORCENARIO.get(cenario);
      assert.ok(r, "cenário exclusivo `" + cenario + "` sumiu do catálogo");
      assert.ok(r.ramos.includes(ramo),
        "`" + cenario + "` não acionou `" + ramo + "` (acionou: " + r.ramos.join(",") + ")");
    }
  });

  test("UNI-B3: os TRÊS escopos foram exercitados de verdade", () => {
    for (const [escopo, cenario] of Object.entries(fixtures.ESCOPO_EXERCITADO_POR)) {
      const r = PORCENARIO.get(cenario);
      assert.ok(r, "cenário do escopo `" + escopo + "` sumiu");
      assert.ok((r.escopos && r.escopos[escopo]) > 0,
        "o escopo `" + escopo + "` não produziu acusação nenhuma no catálogo");
    }
  });

  test("UNI-B4: ramo tornado MORTO derruba a prova externa", () => {
    const raiz = repoComMutacao("unicidade_do_portador.js", (t) =>
      t.replace("quando: (s) => s.criaSoquete && s.vinculaPorta,",
                "quando: (s) => s && false,"));
    try {
      assert.throws(
        () => provaDoRepo(raiz).conferirProvaDaUnicidade(raiz),
        (erro) => erro instanceof assert.AssertionError,
        "matar o ramo `DATAGRAMA` não derrubou a prova externa"
      );
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });

  test("UNI-B5: cenário exclusivo REMOVIDO derruba a prova externa", () => {
    const raiz = repoComMutacao("fixtures_de_unicidade.js", (t) =>
      t.replace('"DATAGRAMA": "UDP-01",', '"DATAGRAMA": "NAO-EXISTE",'));
    try {
      assert.throws(
        () => provaDoRepo(raiz).conferirProvaDaUnicidade(raiz),
        (erro) => erro instanceof assert.AssertionError,
        "apontar o ramo para um cenário inexistente não derrubou a prova"
      );
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });

  test("UNI-B6: a composição DESLIGADA derruba a prova externa", () => {
    // A camada nova precisa sobreviver à própria remoção: sem isto, apagar
    // `capacidadesCompostas` deixaria a fragmentação passar em silêncio.
    const raiz = repoComMutacao("unicidade_do_portador.js", (t) =>
      t.replace("function capacidadesCompostas(resumos) {",
                "function capacidadesCompostas(resumos) {\n  if (resumos) return [];"));
    try {
      assert.throws(
        () => provaDoRepo(raiz).conferirProvaDaUnicidade(raiz),
        (erro) => erro instanceof assert.AssertionError,
        "desligar a decisão composta não derrubou a prova externa"
      );
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });

  test("UNI-B7: a cópia ÍNTEGRA continua aprovando — não é veto geral", () => {
    const raiz = repoComMutacao("prova_da_unicidade.js", (t) => t + "\n// cópia íntegra\n");
    try {
      const r = provaDoRepo(raiz).conferirProvaDaUnicidade(raiz);
      assert.ok(r.resultados.length >= 50, "a cópia íntegra rodou poucos cenários");
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// §P — O PISO ANCORADO NO COMMIT ANTERIOR (§C3-07)
//
// O encolhimento coordenado da R2 realinhou seis números e ficou verde, porque
// todos eles moravam dentro do conjunto editado — inclusive a suíte que
// guardava o piso do piso. A autoridade passou a ser o histórico.
// ===========================================================================
test.describe("§P — O PISO ANCORADO", () => {
  const piso = require("./piso_ancorado.js");

  test("UNI-P1: a comparação roda contra commits de verdade", () => {
    const laudo = piso.conferirPisoAncorado(RAIZ);
    assert.ok(laudo.ancoras.length >= 1, "nenhuma âncora foi lida do histórico");
    assert.ok(laudo.comparacoes > 0,
      "nenhuma comparação foi feita — a guarda passaria por vacuidade");
    assert.ok(laudo.passado.length >= 1, "nenhum commit anterior foi lido");
  });

  test("UNI-P2: o piso corrente é maior ou igual a todo piso já registrado", () => {
    const laudo = piso.conferirPisoAncorado(RAIZ);
    for (const antes of laudo.passado) {
      if (!antes.piso) continue;
      assert.ok(laudo.agora.piso.casos_minimos >= antes.piso.casos_minimos,
        "o piso de casos ficou abaixo do que `" + antes.sha.slice(0, 7) + "` declarava");
      assert.ok(laudo.agora.piso.suites_minimas >= antes.piso.suites_minimas,
        "o piso de suítes ficou abaixo do que `" + antes.sha.slice(0, 7) + "` declarava");
    }
  });

  test("UNI-P3: piso por suíte é a contagem REAL, sem folga", () => {
    // A folga entre o piso declarado e o conteúdo do arquivo é espaço para
    // apagar caso sem reprovar — o residual que a R2 registrou.
    const censo = fs.readFileSync(path.join(__dirname, "censo_de_suites.js"), "utf8");
    const pisos = piso.pisosPorSuiteNoTexto(censo);
    assert.ok(Object.keys(pisos).length >= 8, "o leitor de pisos por suíte não achou nada");
    for (const [arquivo, valor] of Object.entries(pisos)) {
      const reais = piso.contarCasos(fs.readFileSync(path.join(__dirname, arquivo), "utf8"));
      assert.equal(valor, reais,
        arquivo + " declara piso " + valor + " com " + reais + " casos: a diferença de " +
          (reais - valor) + " caso(s) é folga, e folga é espaço para apagar sem reprovar");
    }
  });

  test("UNI-P4: a AMARRAÇÃO é conferida, e a chamada removida reprova", () => {
    assert.ok(piso.conferirAmarracao(RAIZ) >= 7, "a amarração encolheu");
    for (const arquivo of Object.keys(piso.AMARRACOES)) {
      const fonte = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
      const programa = fonte.split("\n").filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l)).join("\n");
      assert.match(programa, /piso_ancorado/,
        "`" + arquivo + "` deixou de chamar o piso ancorado");
    }
  });

  test("UNI-P5: o JUIZ do CI reprova quando a autoridade do piso some", () => {
    // A conferência do juiz roda FORA do `npm test`, e é ela que sobrevive ao
    // encolhimento que apaga suítes. Aqui ela é EXERCITADA, não descrita.
    const PORTAO = require("../ci/portao_do_ci.js");
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "juiz-"));
    try {
      fs.mkdirSync(path.join(raiz, "ci"), { recursive: true });
      fs.mkdirSync(path.join(raiz, "test"), { recursive: true });
      fs.copyFileSync(path.join(RAIZ, "ci", "piso_do_portao.json"), path.join(raiz, "ci", "piso_do_portao.json"));
      fs.copyFileSync(path.join(RAIZ, "package.json"), path.join(raiz, "package.json"));
      for (const nome of Object.keys(PORTAO.AUTORIDADE_DO_PISO)) {
        fs.copyFileSync(path.join(RAIZ, nome), path.join(raiz, nome));
      }
      const semEvidencia = {
        raiz,
        arquivoSaida: path.join(raiz, "nada.txt"),
        arquivoExit: path.join(raiz, "nada2.txt"),
      };
      const base = PORTAO.conferir(semEvidencia).reprovacoes.filter((m) => /AUTORIDADE DO PISO/.test(m));
      assert.deepEqual(base, [], "a árvore com a autoridade intacta foi acusada");

      fs.rmSync(path.join(raiz, "test", "piso_ancorado.js"), { force: true });
      const semArquivo = PORTAO.conferir(semEvidencia).reprovacoes.filter((m) => /AUTORIDADE DO PISO AUSENTE/.test(m));
      assert.equal(semArquivo.length, 1, "apagar o piso ancorado não foi acusado pelo juiz");

      fs.copyFileSync(path.join(RAIZ, "test", "piso_ancorado.js"), path.join(raiz, "test", "piso_ancorado.js"));
      const censo = fs.readFileSync(path.join(raiz, "test", "censo_de_suites.js"), "utf8");
      fs.writeFileSync(path.join(raiz, "test", "censo_de_suites.js"),
        censo.split("piso_ancorado").join("piso_qualquer"));
      const semChamada = PORTAO.conferir(semEvidencia).reprovacoes.filter((m) => /AUTORIDADE DO PISO DESLIGADA/.test(m));
      assert.equal(semChamada.length, 1, "remover a chamada não foi acusado pelo juiz");
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });
});
