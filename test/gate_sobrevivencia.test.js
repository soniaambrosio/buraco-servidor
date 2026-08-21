// test/gate_sobrevivencia.test.js — A METADE DE DENTRO DO PORTAO.
//
// `ferramentas/gate-de-provas.js` confere integridade e `ferramentas/portao.js`
// executa e conta. As duas vivem FORA das suites que protegem, porque uma suite
// nao pode ser a autoridade sobre a propria existencia. Mas o inverso tambem e
// verdade, e e por isso que este arquivo existe: as ferramentas nao podem ser a
// unica autoridade sobre si mesmas.
//
// Esta suite roda DENTRO do `node --test`, pelo mesmo caminho que roda todo o
// resto, e afirma tres coisas que as ferramentas nao conseguem afirmar sozinhas:
//
//   * que o comando oficial continua sendo EXATAMENTE o processo unico;
//   * que as ferramentas do portao continuam integras (digest do contrato);
//   * que os dois defeitos medidos pela OS 23.1-P-R1 continuam reprovando.
//
// OS DOIS DEFEITOS QUE ESTA SUITE CONGELA (secao 9 da OS 23.1-P-C2):
//
//   R1/2.1  trocar `&&` por `;` no script oficial deixava o portao VERDE com
//           ZERO testes executados. No Windows o `cmd.exe` nao trata `;` como
//           separador: entrega como argumento, e o `node --test` nunca roda.
//           Congelado por GS-10 (zero testes reprova) e GS-13 (comando
//           encadeado reprova).
//
//   R1/2.2  esvaziar os campos de defesa da entrada do contrato reduzia a
//           protecao a "existe um arquivo com esse nome", e a suite podia virar
//           `test("irrelevante")` com o portao verde. Congelado por GS-04
//           (a entrada CARREGA as defesas) e GS-12 (a guarda recusa entrada
//           incompleta).
//
// COMO AS PECAS SE APOIAM, em direcoes opostas:
//
//   apagar `produtor_v2.test.js`   -> a guarda acende (esta no contrato)
//   apagar ESTA suite             -> a guarda acende (tambem esta no contrato)
//   adulterar a guarda ou o portao -> ESTA suite acende (digest no contrato)
//   trocar o comando oficial       -> a guarda acende E esta suite acende
//
// Nao existe protecao absoluta contra apagar tudo de uma vez, e a OS nao pede
// isso. O que existe e que qualquer remocao PARCIAL acende alguma coisa, e a
// remocao total vira um diff grande e deliberado.
//
// NOTA DE HIGIENE. As provas comportamentais montam uma CAIXA DE AREIA em
// diretorio temporario e rodam as ferramentas la dentro. A versao anterior
// desta suite sobrescrevia o contrato REAL durante o teste e restaurava no
// `finally` — funcionava, mas uma interrupcao dura no meio deixava o arquivo
// corrompido na arvore de trabalho. A OS 23.1-P-R1 registrou isso como
// residual; a caixa de areia o fecha.

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");

const RAIZ = path.resolve(__dirname, "..");
const PKG = path.join(RAIZ, "package.json");
const FERRAMENTAS = path.join(RAIZ, "ferramentas");
const GUARDA = path.join(FERRAMENTAS, "gate-de-provas.js");
const PORTAO = path.join(FERRAMENTAS, "portao.js");
const CONTRATO = path.join(FERRAMENTAS, "contrato-de-provas.json");

const pacote = () => JSON.parse(fs.readFileSync(PKG, "utf8"));
const contrato = () => JSON.parse(fs.readFileSync(CONTRATO, "utf8"));
const lf = (p) => fs.readFileSync(p, "utf8").split("\r\n").join("\n");
const sha256 = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");

/** Monta uma caixa de areia com as ferramentas reais e um contrato sob medida.
 *  Devolve a raiz temporaria; nada fora dela e tocado. */
function criarCaixa(opcoes) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "portao-prova-"));
  fs.mkdirSync(path.join(raiz, "ferramentas"));
  fs.mkdirSync(path.join(raiz, "test"));
  fs.copyFileSync(GUARDA, path.join(raiz, "ferramentas", "gate-de-provas.js"));
  fs.copyFileSync(PORTAO, path.join(raiz, "ferramentas", "portao.js"));

  for (const [nome, corpo] of Object.entries(opcoes.suites || {})) {
    fs.writeFileSync(path.join(raiz, "test", nome), corpo, "utf8");
  }
  fs.writeFileSync(
    path.join(raiz, "package.json"),
    JSON.stringify({
      name: "caixa-de-prova", version: "1.0.0", private: true,
      scripts: {
        pretest: opcoes.scriptPrevio || "node ferramentas/gate-de-provas.js",
        test: opcoes.script || "node ferramentas/portao.js",
      },
    }, null, 2) + "\n", "utf8"
  );

  // Os digests das ferramentas sao calculados sobre as copias, para que a caixa
  // nunca reprove por um motivo que nao seja o que ela quer medir.
  const ferramentasProtegidas = [
    { caminho: "ferramentas/gate-de-provas.js", digestSha256: sha256(lf(path.join(raiz, "ferramentas", "gate-de-provas.js"))) },
    { caminho: "ferramentas/portao.js", digestSha256: sha256(lf(path.join(raiz, "ferramentas", "portao.js"))) },
  ];
  const base = {
    versaoContratoDeProva: 1,
    camposObrigatoriosPorSuite: ["digestSha256"],
    ferramentasProtegidas,
    suitesObrigatorias: (opcoes.suitesObrigatorias || []).map((s) => ({
      ...s,
      digestSha256: s.digestSha256 === null ? undefined
        : (s.digestSha256 || sha256(lf(path.join(raiz, "test", path.basename(s.caminho))))),
    })),
    execucao: { padroes: ["test/*.test.js"], totalMinimoDeTestes: 1, ...(opcoes.execucao || {}) },
    comandoOficial: {
      script: "test", invocacaoExata: "node ferramentas/portao.js",
      scriptPrevio: "pretest", invocacaoPreviaExata: "node ferramentas/gate-de-provas.js",
    },
    ...(opcoes.contratoExtra || {}),
  };
  for (const s of base.suitesObrigatorias) {
    if (s.digestSha256 === undefined) delete s.digestSha256;
  }
  fs.writeFileSync(path.join(raiz, "ferramentas", "contrato-de-provas.json"),
    JSON.stringify(base, null, 2), "utf8");
  return raiz;
}

function rodarNaCaixa(raiz, alvo) {
  // O ambiente precisa sair LIMPO das marcas do test runner. Estas provas rodam
  // dentro de um `node --test`, e o portao da caixa lanca outro `node --test`:
  // vendo `NODE_TEST_CONTEXT` herdado, o node decide que e recursao e responde
  // "skipping running files" — sem executar nada e sem rodape TAP. O portao
  // reprovaria por `RELATORIO_ILEGIVEL`, e a prova mediria o arnes em vez da
  // defesa. Limpar a variavel e o que faz a caixa ser um processo de verdade.
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("NODE_TEST")) delete env[k];
  const r = spawnSync(process.execPath, [path.join(raiz, "ferramentas", alvo || "portao.js")], {
    cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env,
  });
  return { codigo: r.status, saida: String(r.stdout || "") + String(r.stderr || "") };
}

function limpar(raiz) {
  try { fs.rmSync(raiz, { recursive: true, force: true }); } catch (_) {}
}

const SUITE_OK =
  'const { test, describe } = require("node:test");\n' +
  'describe("X/BLOCO", () => {\n' +
  '  test("X-01: passa", () => {});\n' +
  '  test("X-02: tambem passa", () => {});\n' +
  '});\n';

describe("GATE/SOBREVIVENCIA", () => {
  test("GS-01: as pecas do portao existem no lugar que o contrato aponta", () => {
    assert.ok(fs.existsSync(GUARDA), "ferramentas/gate-de-provas.js sumiu");
    assert.ok(fs.existsSync(PORTAO), "ferramentas/portao.js sumiu — sem ele nada executa nem conta");
    assert.ok(fs.existsSync(CONTRATO),
      "ferramentas/contrato-de-provas.json sumiu — a LISTA do que e obrigatorio nao pode evaporar");
  });

  test("GS-02: os dois comandos oficiais sao EXATAMENTE os declarados", () => {
    // O defeito R1/2.1 nasceu de um comando composto. Um processo unico nao tem
    // operador de shell para subverter, e a igualdade exata torna qualquer
    // reintroducao um diff visivel.
    //
    // Sao DOIS scripts: `pretest` (a guarda) e `test` (o portao). O npm executa
    // o `pretest` antes por semantica propria, nao por encadeamento — e e ele
    // que confere o digest do portao ANTES de o portao ter chance de decidir
    // qualquer coisa. Sem esse par, esvaziar o `main()` do portao daria verde.
    const s = pacote().scripts;
    const oficial = contrato().comandoOficial;
    assert.equal(String(s[oficial.script] || "").trim(), oficial.invocacaoExata,
      "o script `test` divergiu da invocacao declarada no contrato:\n  " + s[oficial.script]);
    assert.equal(String(s[oficial.scriptPrevio] || "").trim(), oficial.invocacaoPreviaExata,
      "o script `pretest` divergiu — sem ele o portao vira seu proprio unico conferente:\n  " +
      s[oficial.scriptPrevio]);
  });

  test("GS-03: os comandos oficiais nao encadeiam processos", () => {
    // `;` e o caso que a OS 23.1-P-R1 mediu: no `cmd.exe` ele nao separa
    // comandos, entrega como argumento, e o `node --test` nunca roda.
    const s = pacote().scripts;
    const oficial = contrato().comandoOficial;
    for (const nome of [oficial.script, oficial.scriptPrevio]) {
      const script = String(s[nome] || "");
      for (const op of ["&&", "||", ";", "|", "&"]) {
        assert.ok(!script.includes(op),
          `o script \`${nome}\` voltou a encadear com \`${op}\`:\n  ${script}`);
      }
    }
  });

  test("GS-04: cada entrada obrigatoria CARREGA os campos de defesa", () => {
    // O defeito R1/2.2: `if (s.digestSha256 && ...)` fazia a defesa sumir junto
    // com o campo. Exigir os campos e o que impede desarmar a entrada em
    // silencio mantendo o caminho.
    const c = contrato();
    const exigidos = c.camposObrigatoriosPorSuite;
    assert.ok(Array.isArray(exigidos) && exigidos.length > 0,
      "o contrato precisa declarar `camposObrigatoriosPorSuite`");
    for (const campo of ["digestSha256", "pisoDeCasos", "blocosNormativos", "casosObrigatorios"]) {
      assert.ok(exigidos.includes(campo), `\`${campo}\` deixou de ser exigido das entradas`);
    }
    for (const s of c.suitesObrigatorias) {
      for (const campo of exigidos) {
        const v = s[campo];
        const vazio = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
        assert.ok(!vazio, `a entrada \`${s.id}\` nao carrega \`${campo}\``);
      }
    }
  });

  test("GS-05: as duas suites obrigatorias estao registradas", () => {
    const caminhos = contrato().suitesObrigatorias.map((s) => s.caminho);
    assert.ok(caminhos.includes("test/gate_sobrevivencia.test.js"),
      "o contrato precisa exigir esta propria suite; declarados: " + caminhos.join(", "));
    assert.ok(caminhos.includes("test/produtor_v2.test.js"),
      "e a suite do contrato V2, que e o motivo de tudo isto existir");
  });

  test("GS-06: o contrato de prova e versionado", () => {
    const c = contrato();
    assert.ok(Number.isInteger(c.versaoContratoDeProva),
      "sem versao, uma troca de contrato nao se distingue de um ajuste qualquer");
    assert.ok(c.versaoContratoDeProva >= 2, "a C2 subiu o contrato de prova para 2");
  });

  test("GS-07: as ferramentas do portao estao sob digest, e batem", () => {
    // A metade que a guarda nao consegue afirmar sobre si mesma. Sem isto,
    // adulterar o proprio portao e o caminho mais curto para o verde.
    const c = contrato();
    const protegidas = c.ferramentasProtegidas || [];
    const caminhos = protegidas.map((f) => f.caminho);
    assert.ok(caminhos.includes("ferramentas/gate-de-provas.js"), "a guarda precisa estar protegida");
    assert.ok(caminhos.includes("ferramentas/portao.js"), "o portao precisa estar protegido");
    for (const f of protegidas) {
      const abs = path.join(RAIZ, f.caminho);
      assert.ok(fs.existsSync(abs), `${f.caminho} sumiu`);
      assert.equal(sha256(lf(abs)), f.digestSha256,
        `${f.caminho} mudou sem o contrato acompanhar`);
    }
  });

  test("GS-08: a guarda APROVA a arvore intacta", () => {
    // O controle. Sem ele, uma guarda que reprovasse sempre passaria em todas
    // as provas negativas e seria desligada no primeiro dia util.
    const r = spawnSync(process.execPath, [GUARDA], { cwd: RAIZ, encoding: "utf8" });
    assert.equal(r.status, 0, "a guarda reprovou a arvore intacta:\n" + r.stdout + r.stderr);
    assert.match(String(r.stdout), /integridade das provas/);
  });

  test("GS-09: a guarda REPROVA quando uma suite obrigatoria some", () => {
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [
        { id: "viva", caminho: "test/viva.test.js" },
        { id: "fantasma", caminho: "test/nao_existe.test.js", digestSha256: "0".repeat(64) },
      ],
    });
    try {
      const r = rodarNaCaixa(caixa, "gate-de-provas.js");
      assert.notEqual(r.codigo, 0, "a guarda precisa sair != 0 quando uma suite obrigatoria falta");
      assert.match(r.saida, /SUITE_AUSENTE/, "e precisa dizer POR QUE, com codigo estavel");
    } finally { limpar(caixa); }
  });

  test("GS-10: o portao REPROVA execucao com zero testes", () => {
    // O coracao do defeito R1/2.1. Um alvo que nao seleciona caso nenhum sai
    // com codigo 0 e parece sucesso; aqui isso e reprovacao explicita.
    const caixa = criarCaixa({
      suites: { "vazia.test.js": '"use strict";\n// nenhum caso aqui, de proposito\n' },
      suitesObrigatorias: [{ id: "vazia", caminho: "test/vazia.test.js" }],
    });
    try {
      const r = rodarNaCaixa(caixa);
      assert.notEqual(r.codigo, 0, "zero testes executados NAO pode dar verde");
      assert.match(r.saida, /ZERO_TESTES/, "e precisa dizer que nao houve prova, nao apenas falhar");
    } finally { limpar(caixa); }
  });

  test("GS-11: o portao REPROVA caso obrigatorio presente que nao executou", () => {
    // Arquivo no lugar, caso no arquivo, e mesmo assim ele nao roda — `skip`,
    // filtro, alvo estreitado. Presenca no disco nao e execucao.
    const comSkip =
      'const { test, describe } = require("node:test");\n' +
      'describe("X/BLOCO", () => {\n' +
      '  test("X-01: passa", () => {});\n' +
      '  test("X-02: tambem passa", { skip: true }, () => {});\n' +
      '});\n';
    const caixa = criarCaixa({
      suites: { "parcial.test.js": comSkip },
      suitesObrigatorias: [
        { id: "parcial", caminho: "test/parcial.test.js", casosObrigatorios: ["X-01", "X-02"] },
      ],
      contratoExtra: { camposObrigatoriosPorSuite: ["digestSha256", "casosObrigatorios"] },
    });
    try {
      const r = rodarNaCaixa(caixa);
      assert.notEqual(r.codigo, 0, "um caso obrigatorio pulado NAO pode dar verde");
      assert.match(r.saida, /CASO_OBRIGATORIO_NAO_EXECUTADO/);
      assert.match(r.saida, /X-02/, "e precisa nomear qual caso nao rodou");
    } finally { limpar(caixa); }
  });

  test("GS-12: a guarda REPROVA entrada de contrato sem campo de defesa", () => {
    // O defeito R1/2.2 na sua forma exata: manter o caminho, apagar o digest.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js", digestSha256: null }],
    });
    try {
      const r = rodarNaCaixa(caixa, "gate-de-provas.js");
      assert.notEqual(r.codigo, 0, "entrada obrigatoria sem digest NAO pode passar");
      assert.match(r.saida, /CAMPO_OBRIGATORIO_AUSENTE/);
    } finally { limpar(caixa); }
  });

  test("GS-13: a guarda REPROVA comando oficial encadeado", () => {
    // A forma estatica do defeito R1/2.1: qualquer tentativa de voltar a
    // encadear o comando oficial vira divergencia, mesmo antes de rodar nada.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
      script: 'node ferramentas/gate-de-provas.js ; node --test "test/*.test.js"',
    });
    try {
      const r = rodarNaCaixa(caixa, "gate-de-provas.js");
      assert.notEqual(r.codigo, 0, "comando oficial encadeado NAO pode passar");
      assert.match(r.saida, /COMANDO_OFICIAL_DIVERGENTE/);
    } finally { limpar(caixa); }
  });

  test("GS-14: marcador fabricado nao aprova, e nao sobrevive a execucao", () => {
    // "Marcador existe" nunca pode virar "suite aprovada". O portao apaga o
    // marcador no inicio e sela o novo com um nonce que so existe na memoria
    // do processo — um marcador plantado a mao nao chega ao fim.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    const alvo = path.join(caixa, "ferramentas", ".marcador-de-execucao.json");
    try {
      const forjado = {
        carga: { contratoVersao: 1, testesExecutados: 99999, testesAprovados: 99999, falhas: 0 },
        selo: "f".repeat(64),
      };
      fs.writeFileSync(alvo, JSON.stringify(forjado, null, 2), "utf8");
      const r = rodarNaCaixa(caixa);
      assert.equal(r.codigo, 0, "a caixa intacta deveria aprovar:\n" + r.saida);
      const depois = JSON.parse(fs.readFileSync(alvo, "utf8"));
      assert.notEqual(depois.selo, forjado.selo, "o marcador forjado sobreviveu a execucao");
      assert.equal(depois.carga.casosExecutados, 2,
        "o marcador tem de descrever a execucao real, nao o que alguem escreveu nele");
    } finally { limpar(caixa); }
  });

  // -------------------------------------------------------------------------
  // GS-15..GS-21 — O SCHEMA DA SECAO 8, ESPELHADO DE FORA.
  //
  // A primeira volta da C2 exigiu que a entrada CARREGASSE os campos de defesa,
  // e parou ai. A rehomologacao mostrou o que sobra quando "carregar" e tudo
  // que se pede: `pisoDeCasos: 0` e um campo presente que desliga o piso;
  // `pisoDeCasos: "61"` e um campo presente que pula a comparacao inteira; um
  // `id` de tres espacos e um campo presente que nao identifica nada. Todos
  // passavam. Estas provas cobram VALIDADE, nao presenca — e cobram de fora da
  // guarda, rodando a guarda de verdade numa caixa de areia e lendo o codigo de
  // recusa. Uma guarda alterada para ignorar um campo derruba a prova aqui.

  test("GS-15: os campos obrigatorios incluem identidade e caminho", () => {
    const exigidos = contrato().camposObrigatoriosPorSuite;
    for (const campo of ["id", "caminho", "digestSha256", "pisoDeCasos",
                         "blocosNormativos", "casosObrigatorios"]) {
      assert.ok(exigidos.includes(campo),
        `\`${campo}\` deixou de ser exigido das entradas obrigatorias`);
    }
  });

  test("GS-16: a guarda REPROVA piso invalido (0, negativo, fracionario, string)", () => {
    // O piso e uma comparacao numerica. Zero e negativo a tornam sempre falsa;
    // fracionario e string a fazem ser PULADA. Nos quatro casos o campo esta la,
    // e a defesa nao esta.
    for (const piso of [0, -1, 61.5, "61"]) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK },
        suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js", pisoDeCasos: piso,
                              blocosNormativos: ["X/BLOCO"], casosObrigatorios: ["X-01", "X-02"] }],
        contratoExtra: { camposObrigatoriosPorSuite: ["id", "caminho", "digestSha256",
                          "pisoDeCasos", "blocosNormativos", "casosObrigatorios"] },
      });
      try {
        const r = rodarNaCaixa(caixa, "gate-de-provas.js");
        assert.notEqual(r.codigo, 0,
          `pisoDeCasos ${JSON.stringify(piso)} passou pela guarda:\n` + r.saida);
        assert.match(r.saida, /CAMPO_OBRIGATORIO_(INVALIDO|AUSENTE)/,
          `pisoDeCasos ${JSON.stringify(piso)} reprovou por outro motivo:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });

  test("GS-17: a guarda REPROVA `id` ausente, em branco ou duplicado", () => {
    const comum = {
      blocosNormativos: ["X/BLOCO"], casosObrigatorios: ["X-01", "X-02"], pisoDeCasos: 2,
    };
    const extra = { camposObrigatoriosPorSuite: ["id", "caminho", "digestSha256",
                     "pisoDeCasos", "blocosNormativos", "casosObrigatorios"] };
    const cenarios = [
      ["ausente", [{ caminho: "test/viva.test.js", ...comum }], /CAMPO_OBRIGATORIO_AUSENTE/],
      ["vazio", [{ id: "", caminho: "test/viva.test.js", ...comum }], /CAMPO_OBRIGATORIO_AUSENTE/],
      ["so espacos", [{ id: "   ", caminho: "test/viva.test.js", ...comum }], /CAMPO_OBRIGATORIO_INVALIDO/],
      ["duplicado", [{ id: "viva", caminho: "test/viva.test.js", ...comum },
                     { id: "viva", caminho: "test/outra.test.js", ...comum }], /ENTRADA_DUPLICADA/],
    ];
    for (const [nome, suitesObrigatorias, esperado] of cenarios) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK, "outra.test.js": SUITE_OK },
        suitesObrigatorias, contratoExtra: extra,
      });
      try {
        const r = rodarNaCaixa(caixa, "gate-de-provas.js");
        assert.notEqual(r.codigo, 0, `\`id\` ${nome} passou pela guarda:\n` + r.saida);
        assert.match(r.saida, esperado, `\`id\` ${nome} reprovou por outro motivo:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });

  test("GS-18: a guarda RECUSA `caminho` invalido em vez de estourar", () => {
    // A diferenca entre RECUSAR e ESTOURAR e a prova. `path.join(RAIZ, undefined)`
    // lanca TypeError: vermelho, sim, mas vermelho de codigo quebrado — nao
    // prova que a defesa existe. Aqui se exige o codigo estavel.
    const comum = { blocosNormativos: ["X/BLOCO"], casosObrigatorios: ["X-01", "X-02"], pisoDeCasos: 2 };
    const extra = { camposObrigatoriosPorSuite: ["id", "caminho", "digestSha256",
                     "pisoDeCasos", "blocosNormativos", "casosObrigatorios"] };
    const digest = "a".repeat(64);
    const cenarios = [
      ["ausente", { id: "viva", digestSha256: digest, ...comum }, /CAMPO_OBRIGATORIO_AUSENTE/],
      ["vazio", { id: "viva", caminho: "", digestSha256: digest, ...comum }, /CAMPO_OBRIGATORIO_AUSENTE/],
      ["escapa da raiz", { id: "viva", caminho: "../fora.test.js", digestSha256: digest, ...comum },
        /CAMPO_OBRIGATORIO_INVALIDO/],
      ["absoluto", { id: "viva", caminho: path.resolve(__dirname, "..", "test", "viva.test.js"),
        digestSha256: digest, ...comum }, /CAMPO_OBRIGATORIO_INVALIDO/],
    ];
    for (const [nome, entrada, esperado] of cenarios) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK },
        suitesObrigatorias: [], contratoExtra: extra,
      });
      try {
        // A entrada e escrita crua: `criarCaixa` calcularia um digest a partir do
        // caminho, e e justamente o caminho que esta sob teste.
        const cPath = path.join(caixa, "ferramentas", "contrato-de-provas.json");
        const c = JSON.parse(fs.readFileSync(cPath, "utf8"));
        c.suitesObrigatorias = [entrada];
        fs.writeFileSync(cPath, JSON.stringify(c, null, 2), "utf8");
        const r = rodarNaCaixa(caixa, "gate-de-provas.js");
        assert.notEqual(r.codigo, 0, `\`caminho\` ${nome} passou pela guarda:\n` + r.saida);
        assert.match(r.saida, esperado, `\`caminho\` ${nome} reprovou por outro motivo:\n` + r.saida);
        assert.doesNotMatch(r.saida, /ERR_INVALID_ARG_TYPE|TypeError/,
          `\`caminho\` ${nome} ESTOUROU em vez de recusar:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });

  test("GS-19: a guarda REPROVA digest malformado", () => {
    const extra = { camposObrigatoriosPorSuite: ["id", "caminho", "digestSha256",
                     "pisoDeCasos", "blocosNormativos", "casosObrigatorios"] };
    for (const digest of ["z".repeat(64), "a".repeat(63), "a".repeat(65), "nao-e-digest"]) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK },
        suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js", digestSha256: digest,
                              pisoDeCasos: 2, blocosNormativos: ["X/BLOCO"],
                              casosObrigatorios: ["X-01", "X-02"] }],
        contratoExtra: extra,
      });
      try {
        const r = rodarNaCaixa(caixa, "gate-de-provas.js");
        assert.notEqual(r.codigo, 0, `digest ${digest.slice(0, 12)} passou:\n` + r.saida);
        assert.match(r.saida, /CAMPO_OBRIGATORIO_INVALIDO/,
          `digest ${digest.slice(0, 12)} reprovou por outro motivo:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });

  test("GS-20: toda peca de `ferramentas/` esta declarada sob digest valido", () => {
    // Cobertura DERIVADA do disco, conferida aqui contra o disco de verdade: se
    // alguem acrescentar uma peca ao portao sem declara-la, esta prova acende
    // junto com a guarda. Duas autoridades, nenhuma delas dona de si mesma.
    const declaradas = new Map(
      (contrato().ferramentasProtegidas || []).map((f) => [String(f.caminho), f]));
    const emDisco = fs.readdirSync(FERRAMENTAS).filter((n) => n.endsWith(".js")).sort();
    assert.ok(emDisco.length > 0, "nenhuma peca .js em ferramentas/ — o portao sumiu");
    for (const nome of emDisco) {
      const rel = "ferramentas/" + nome;
      const f = declaradas.get(rel);
      assert.ok(f, `\`${rel}\` roda no portao e nao esta em \`ferramentasProtegidas\``);
      assert.match(String(f.digestSha256), /^[0-9a-f]{64}$/i,
        `\`${rel}\` esta declarada sem um digest valido — declarada e desprotegida`);
      assert.equal(sha256(lf(path.join(RAIZ, rel))), f.digestSha256,
        `\`${rel}\` foi adulterada sem o contrato acompanhar`);
    }
  });

  test("GS-21: desarmar o digest de uma ferramenta nao libera adultera-la", () => {
    // O escape mais grave da primeira volta da C2, e o motivo de GS-20 existir:
    // `if (f.digestSha256 && ...)` deixava a conferencia sumir junto com o campo.
    // Apagar o digest do `portao.js` e esvaziar o `main()` dava `npm test` VERDE,
    // exit 0 e ZERO testes executados — o falso-verde R1/2.1 por outra porta.
    for (const modo of ["sem-digest", "lista-vazia"]) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK },
        suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js",
                              pisoDeCasos: 2, blocosNormativos: ["X/BLOCO"],
                              casosObrigatorios: ["X-01", "X-02"] }],
      });
      try {
        const cPath = path.join(caixa, "ferramentas", "contrato-de-provas.json");
        const c = JSON.parse(fs.readFileSync(cPath, "utf8"));
        if (modo === "lista-vazia") c.ferramentasProtegidas = [];
        else for (const f of c.ferramentasProtegidas) {
          if (/portao/.test(f.caminho)) delete f.digestSha256;
        }
        fs.writeFileSync(cPath, JSON.stringify(c, null, 2), "utf8");

        // e agora o portao e esvaziado, que e o que o desarme viabilizava
        const pPath = path.join(caixa, "ferramentas", "portao.js");
        fs.writeFileSync(pPath, fs.readFileSync(pPath, "utf8").replace(
          "function main() {", "function main() { console.log(\"PORTAO: APROVADO\"); return;"),
          "utf8");

        const r = rodarNaCaixa(caixa, "gate-de-provas.js");
        assert.notEqual(r.codigo, 0, `[${modo}] a guarda aprovou o portao desarmado:\n` + r.saida);
        assert.match(r.saida, /FERRAMENTA_SEM_DIGEST|FERRAMENTA_NAO_DECLARADA/,
          `[${modo}] reprovou por outro motivo:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });
});
