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
const AFERIDOR = path.join(FERRAMENTAS, "aferidor.js");
const RELATOR = path.join(FERRAMENTAS, "relator-de-atribuicao.js");
const CONTRATO = path.join(FERRAMENTAS, "contrato-de-provas.json");

/** As quatro pecas do portao, na ordem em que o ciclo do npm as encontra. */
const PECAS = [
  ["ferramentas/gate-de-provas.js", GUARDA],
  ["ferramentas/portao.js", PORTAO],
  ["ferramentas/aferidor.js", AFERIDOR],
  ["ferramentas/relator-de-atribuicao.js", RELATOR],
];

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
  // AS QUATRO pecas, e nao duas. A C3 acrescentou o `aferidor.js` (o `posttest`,
  // unica voz DEPOIS do portao) e o `relator-de-atribuicao.js` (quem diz qual
  // arquivo executou cada caso). Uma caixa que copiasse so a guarda e o portao
  // mediria uma arquitetura que nao existe mais.
  for (const [rel, origem] of PECAS) {
    fs.copyFileSync(origem, path.join(raiz, rel));
  }

  for (const [nome, corpo] of Object.entries(opcoes.suites || {})) {
    fs.writeFileSync(path.join(raiz, "test", nome), corpo, "utf8");
  }
  fs.writeFileSync(
    path.join(raiz, "package.json"),
    JSON.stringify({
      name: "caixa-de-prova", version: "1.0.0", private: true,
      scripts: {
        pretest: opcoes.scriptPrevio || "node ferramentas/gate-de-provas.js --pretest",
        test: opcoes.script || "node ferramentas/portao.js",
        posttest: opcoes.scriptPosterior || "node ferramentas/aferidor.js",
        ...(opcoes.scriptsExtra || {}),
      },
    }, null, 2) + "\n", "utf8"
  );

  // Os digests das ferramentas sao calculados sobre as copias, para que a caixa
  // nunca reprove por um motivo que nao seja o que ela quer medir.
  const ferramentasProtegidas = PECAS.map(([rel]) => ({
    caminho: rel, digestSha256: sha256(lf(path.join(raiz, rel))),
  }));
  const base = {
    versaoContratoDeProva: 1,
    camposObrigatoriosPorSuite: ["digestSha256"],
    ferramentasProtegidas,
    suitesObrigatorias: (opcoes.suitesObrigatorias || []).map((s) => ({
      ...s,
      digestSha256: s.digestSha256 === null ? undefined
        : (s.digestSha256 || sha256(lf(path.join(raiz, "test", path.basename(s.caminho))))),
    })),
    execucao: {
      padroes: ["test/*.test.js"],
      relatorDeAtribuicao: "ferramentas/relator-de-atribuicao.js",
      totalMinimoDeTestes: 1,
      ...(opcoes.execucao || {}),
    },
    comandoOficial: {
      script: "test", invocacaoExata: "node ferramentas/portao.js",
      scriptPrevio: "pretest", invocacaoPreviaExata: "node ferramentas/gate-de-provas.js --pretest",
      scriptPosterior: "posttest", invocacaoPosteriorExata: "node ferramentas/aferidor.js",
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

/** Reescreve uma peca da caixa. Exige que a ancora ocorra EXATAMENTE UMA VEZ.
 *
 *  As duas metades desta exigencia custaram caro, cada uma do seu jeito:
 *
 *  ZERO ocorrencias — a sabotagem nao aplica, a caixa fica intacta, e a prova
 *  passa por nao ter sabotado nada. E o falso-verde mais barato que existe, e o
 *  que acontece sozinho no dia em que alguem renomear a linha sabotada.
 *
 *  DUAS ocorrencias — `String.replace` com texto literal troca so a PRIMEIRA. Na
 *  primeira escrita destas provas, o comentario de cabecalho do `portao.js`
 *  CITAVA a linha do executor para explicar o escape FER-02; a sabotagem reescreveu
 *  a citacao, o codigo ficou intacto, e quatro provas negativas ficaram verdes
 *  medindo uma caixa que nunca foi sabotada. Uma ancora ambigua e uma ancora
 *  errada. Por isso as pecas do portao mantem a chamada final de `main()` em UMA
 *  linha so, e nao a repetem em comentario. */
function mutarPeca(raiz, peca, de, para) {
  const p = path.join(raiz, "ferramentas", peca);
  const antes = fs.readFileSync(p, "utf8");
  const ocorrencias = antes.split(de).length - 1;
  assert.equal(ocorrencias, 1,
    `a ancora ${JSON.stringify(String(de).slice(0, 70))} ocorre ${ocorrencias} vez(es) em ` +
    `${peca}: sabotagem com ancora ambigua ou ausente nao mede defesa nenhuma`);
  const depois = antes.replace(de, para);
  assert.notEqual(depois, antes, `a sabotagem nao alterou ${peca}`);
  fs.writeFileSync(p, depois, "utf8");
}

/** REALINHA TODOS OS DIGESTS das ferramentas da caixa.
 *
 *  E o gesto que a OS 23.1-P-R2 mediu e que a C2 nao previa: a campanha dela
 *  realinhava digest de SUITE em nove cenarios e nunca realinhava digest de
 *  FERRAMENTA. Toda sabotagem de peca aqui passa por esta funcao de proposito —
 *  o contrato fica em dia, a integridade fica verde, e o que tem de acender e o
 *  comportamento. */
function realinharDigestsDasFerramentas(raiz) {
  const cPath = path.join(raiz, "ferramentas", "contrato-de-provas.json");
  const c = JSON.parse(fs.readFileSync(cPath, "utf8"));
  for (const f of c.ferramentasProtegidas || []) {
    f.digestSha256 = sha256(lf(path.join(raiz, f.caminho)));
  }
  fs.writeFileSync(cPath, JSON.stringify(c, null, 2), "utf8");
}

function rodarNaCaixa(raiz, alvo, args) {
  // O ambiente precisa sair LIMPO das marcas do test runner. Estas provas rodam
  // dentro de um `node --test`, e o portao da caixa lanca outro `node --test`:
  // vendo `NODE_TEST_CONTEXT` herdado, o node decide que e recursao e responde
  // "skipping running files" — sem executar nada e sem rodape TAP. O portao
  // reprovaria por `RELATORIO_ILEGIVEL`, e a prova mediria o arnes em vez da
  // defesa. Limpar a variavel e o que faz a caixa ser um processo de verdade.
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("NODE_TEST")) delete env[k];
  const r = spawnSync(process.execPath,
    [path.join(raiz, "ferramentas", alvo || "portao.js"), ...(args || [])], {
      cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env,
    });
  return { codigo: r.status, saida: String(r.stdout || "") + String(r.stderr || "") };
}

/** O CICLO OFICIAL INTEIRO, como o npm o executa: `pretest`, `test`,
 *  `posttest`, parando no primeiro codigo diferente de zero.
 *
 *  POR QUE O CICLO, E NAO SO O PORTAO. A partir da C3 o veredito nao e de uma
 *  peca so: o `pretest` emite o desafio e limpa as sobras, o `test` executa e
 *  sela, o `posttest` exige a prova selada. Medir so o `test` mediria um terco
 *  da defesa — e era exatamente esse terco isolado que ficava verde no escape
 *  FER-02. */
function rodarCicloNaCaixa(raiz) {
  const etapas = [
    ["pretest", "gate-de-provas.js", ["--pretest"]],
    ["test", "portao.js", []],
    ["posttest", "aferidor.js", []],
  ];
  let saida = "";
  for (const [etapa, peca, args] of etapas) {
    const r = rodarNaCaixa(raiz, peca, args);
    saida += `\n--- ${etapa} (node ferramentas/${peca} ${args.join(" ")}) ---\n` + r.saida;
    if (r.codigo !== 0) return { codigo: r.codigo, saida, etapa };
  }
  return { codigo: 0, saida, etapa: "completo" };
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

  test("GS-02: os tres comandos oficiais sao EXATAMENTE os declarados", () => {
    // O defeito R1/2.1 nasceu de um comando composto. Um processo unico nao tem
    // operador de shell para subverter, e a igualdade exata torna qualquer
    // reintroducao um diff visivel.
    //
    // Sao DOIS scripts: `pretest` (a guarda) e `test` (o portao). O npm executa
    // o `pretest` antes por semantica propria, nao por encadeamento — e e ele
    // que confere o digest do portao ANTES de o portao ter chance de decidir
    // qualquer coisa. Sem esse par, esvaziar o `main()` do portao daria verde.
    //
    // Sao TRES desde a C3. O `posttest` (`ferramentas/aferidor.js`) e a unica
    // voz DEPOIS do portao: sem ele, neutralizar o executor do portao deixa o
    // `npm test` com codigo zero, zero teste, sem marcador e sem veredito — que
    // e o escape FER-02 medido pela OS 23.1-P-R2.
    const s = pacote().scripts;
    const oficial = contrato().comandoOficial;
    assert.equal(String(s[oficial.script] || "").trim(), oficial.invocacaoExata,
      "o script `test` divergiu da invocacao declarada no contrato:\n  " + s[oficial.script]);
    assert.equal(String(s[oficial.scriptPrevio] || "").trim(), oficial.invocacaoPreviaExata,
      "o script `pretest` divergiu — sem ele o portao vira seu proprio unico conferente:\n  " +
      s[oficial.scriptPrevio]);
    assert.equal(String(oficial.scriptPosterior || "").trim(), "posttest",
      "o contrato precisa declarar `comandoOficial.scriptPosterior` como `posttest`");
    assert.equal(String(s[oficial.scriptPosterior] || "").trim(), oficial.invocacaoPosteriorExata,
      "o script `posttest` divergiu — sem ele ninguem confere que o portao chegou a falar:\n  " +
      s[oficial.scriptPosterior]);
  });

  test("GS-03: os tres comandos oficiais nao encadeiam processos", () => {
    // `;` e o caso que a OS 23.1-P-R1 mediu: no `cmd.exe` ele nao separa
    // comandos, entrega como argumento, e o `node --test` nunca roda.
    const s = pacote().scripts;
    const oficial = contrato().comandoOficial;
    for (const nome of [oficial.script, oficial.scriptPrevio, oficial.scriptPosterior]) {
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
    // SEM `--pretest`, de proposito. Esta e a unica prova que roda uma peca do
    // portao contra a ARVORE DE VERDADE, e ela roda no meio de uma execucao do
    // proprio portao. Com o `--pretest` a guarda apagaria a atribuicao da
    // execucao em curso e reemitiria o desafio que o portao ja tinha lido — a
    // prova destruiria aquilo que a estava executando. O modo somente-leitura
    // existe exatamente para isto.
    const r = spawnSync(process.execPath, [GUARDA], { cwd: RAIZ, encoding: "utf8" });
    assert.equal(r.status, 0, "a guarda reprovou a arvore intacta:\n" + r.stdout + r.stderr);
    assert.match(String(r.stdout), /integridade das provas/);
    assert.match(String(r.stdout), /somente-leitura/,
      "sem `--pretest` a guarda tem de declarar que nao abriu execucao nenhuma");
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
      const r = rodarCicloNaCaixa(caixa);
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
      const r = rodarCicloNaCaixa(caixa);
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
      const r = rodarCicloNaCaixa(caixa);
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

  // -------------------------------------------------------------------------
  // GS-22..GS-36 — OS DOIS ESCAPES DA OS 23.1-P-R2, E AS OITO SABOTAGENS DA C3.
  //
  // A rehomologacao independente da C2 achou dois buracos, os dois com `npm
  // test` VERDE e exit 0, e os dois pela MESMA pergunta mal feita:
  //
  //   FORJA-01  a expectativa nao estava atribuida a quem tinha de cumpri-la.
  //             Os identificadores obrigatorios eram cobrados de um conjunto
  //             PLANO, somado de todos os arquivos. Uma casca com digest e piso
  //             realinhados, mais um arquivo isca NAO REGISTRADO com os mesmos
  //             61 identificadores, produzia a linha
  //             `test/produtor_v2.test.js: 61/61 casos obrigatorios aprovados`
  //             sobre um arquivo que executou ZERO.
  //
  //   FER-02    a integridade da ferramenta nao estava presa a ninguem acima do
  //             contrato. `if (require.main === module) main();` virava
  //             `if (false) main();`, a linha do digest era ATUALIZADA, e o
  //             `npm test` saia zero sem marcador e sem veredito.
  //
  // O QUE MUDA NESTAS PROVAS, e por que isso importa: TODA sabotagem daqui para
  // baixo passa por `realinharDigestsDasFerramentas()`. A campanha da C2
  // realinhava digest de SUITE em nove cenarios e NUNCA de FERRAMENTA — media o
  // digest, nunca o comportamento de uma peca enfraquecida com o contrato em
  // dia. Era a unica combinacao que ficava verde, e e a que estas provas fazem.
  //
  // E medem o CICLO OFICIAL inteiro (`pretest` + `test` + `posttest`), nao uma
  // peca isolada: era justamente o isolamento que deixava o terco verde passar
  // por aprovacao.

  /** Uma casca: os blocos ficam, os casos vao para dentro de um `if (false)`.
   *  O texto continua com N ocorrencias de `test(`, entao o piso TEXTUAL da
   *  guarda continua satisfeito depois de realinhado. O que muda e so o que
   *  EXECUTA — e era exatamente essa a distancia que FORJA-01 explorava. */
  const cascaComCasosMortos = (ids) =>
    'const { test, describe } = require("node:test");\n' +
    'describe("X/BLOCO", () => {\n' +
    '  if (false) {\n' +
    ids.map((id) => `    test("${id}: caso morto", () => {});\n`).join("") +
    '  }\n' +
    '});\n';

  const suiteViva = (bloco, ids) =>
    'const { test, describe } = require("node:test");\n' +
    `describe("${bloco}", () => {\n` +
    ids.map((id) => `  test("${id}: caso vivo", () => {});\n`).join("") +
    '});\n';

  const ENTRADA_PROTEGIDA = {
    id: "protegida", caminho: "test/protegida.test.js",
    blocosNormativos: ["X/BLOCO"], casosObrigatorios: ["X-01", "X-02"], pisoDeCasos: 2,
  };
  const CAMPOS_COMPLETOS = {
    camposObrigatoriosPorSuite: ["id", "caminho", "digestSha256", "pisoDeCasos",
      "blocosNormativos", "casosObrigatorios"],
  };

  test("GS-22: caso obrigatorio servido por arquivo ISCA nao aprova o protegido", () => {
    // FORJA-01 na sua forma exata. `test/protegida.test.js` vira casca — os
    // casos dentro de `if (false)`, digest e piso realinhados pelo procedimento
    // documentado — e `test/isca.test.js`, que o contrato NAO conhece, executa
    // os mesmos identificadores. Sob a leitura plana da C2 isto ficava verde.
    const caixa = criarCaixa({
      suites: {
        "protegida.test.js": cascaComCasosMortos(["X-01", "X-02"]),
        "isca.test.js": suiteViva("Y/BLOCO", ["X-01", "X-02"]),
      },
      suitesObrigatorias: [ENTRADA_PROTEGIDA],
      contratoExtra: CAMPOS_COMPLETOS,
    });
    try {
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0,
        "identificador emprestado por outro arquivo NAO pode aprovar o protegido:\n" + r.saida);
      assert.match(r.saida, /CASO_OBRIGATORIO_FORA_DO_ARQUIVO/,
        "reprovou por outro motivo — a atribuicao precisa ser o codigo:\n" + r.saida);
      assert.doesNotMatch(r.saida, /PORTAO: APROVADO/,
        "o portao chegou a aprovar antes de morrer");
    } finally { limpar(caixa); }
  });

  test("GS-23: provas movidas para arquivo FORA do alvo nao contam", () => {
    // A mesma pergunta, pelo outro lado: as provas existem, so nao rodam. O
    // arquivo destino nao casa com `execucao.padroes`, entao o `node --test`
    // nem o abre — e um identificador que nao executou em lugar nenhum e um
    // caso perdido, nao um caso aprovado.
    const caixa = criarCaixa({
      suites: {
        "protegida.test.js": cascaComCasosMortos(["X-01", "X-02"]),
        "movidas.js": suiteViva("Y/BLOCO", ["X-01", "X-02"]),
        "outra.test.js": suiteViva("Z/BLOCO", ["Z-01", "Z-02"]),
      },
      suitesObrigatorias: [ENTRADA_PROTEGIDA],
      contratoExtra: CAMPOS_COMPLETOS,
    });
    try {
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0, "provas fora do alvo NAO podem dar verde:\n" + r.saida);
      assert.match(r.saida, /CASO_OBRIGATORIO_NAO_EXECUTADO/,
        "reprovou por outro motivo:\n" + r.saida);
      assert.match(r.saida, /X-01/, "e precisa nomear o caso que nao rodou");
    } finally { limpar(caixa); }
  });

  test("GS-24: o piso EXECUTADO por arquivo e independente do piso textual", () => {
    // "Reduzir o arquivo a teste trivial" sem perder nenhum identificador
    // obrigatorio: um caso vivo, vinte mortos, piso realinhado para 21 pelo
    // procedimento documentado. A guarda conta `test(` no TEXTO e fica verde; o
    // portao conta o que EXECUTOU NAQUELE arquivo, e nao fica.
    const mortos = Array.from({ length: 20 }, (_, i) => `X-${String(i + 10)}`);
    const corpo =
      'const { test, describe } = require("node:test");\n' +
      'describe("X/BLOCO", () => {\n' +
      '  test("X-01: unico caso vivo", () => {});\n' +
      '  if (false) {\n' +
      mortos.map((id) => `    test("${id}: caso morto", () => {});\n`).join("") +
      '  }\n' +
      '});\n';
    const caixa = criarCaixa({
      suites: { "protegida.test.js": corpo },
      suitesObrigatorias: [{
        id: "protegida", caminho: "test/protegida.test.js",
        blocosNormativos: ["X/BLOCO"], casosObrigatorios: ["X-01"], pisoDeCasos: 21,
      }],
      contratoExtra: CAMPOS_COMPLETOS,
    });
    try {
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0,
        "21 casos no texto e 1 na execucao NAO pode dar verde:\n" + r.saida);
      assert.match(r.saida, /ABAIXO_DO_PISO_EXECUTADO/, "reprovou por outro motivo:\n" + r.saida);
    } finally { limpar(caixa); }
  });

  test("GS-25: trocar o conteudo do arquivo protegido, com digests em dia, reprova", () => {
    // O arquivo protegido e o vizinho trocam de conteudo, e os digests do
    // contrato sao recalculados sobre o que ficou em cada lugar — integridade
    // impecavel. Os identificadores obrigatorios executam; so que no arquivo
    // errado. Digest responde "mudou?"; atribuicao responde "mudou de dono?".
    //
    // AS DUAS METADES, e qual pega esta. Aqui o texto do arquivo protegido nao
    // carrega mais os identificadores, entao quem acende primeiro e a metade
    // TEXTUAL da guarda (`CASO_OBRIGATORIO_AUSENTE`). A metade da ATRIBUICAO e a
    // que pega a variante em que o texto e preservado e so a execucao desaparece
    // — GS-22, o escape FORJA-01 na forma exata. As duas sao exigidas: uma
    // sozinha deixa passar a outra metade da sabotagem.
    const caixa = criarCaixa({
      suites: {
        "protegida.test.js": suiteViva("X/BLOCO", ["Z-01", "Z-02"]),
        "vizinha.test.js": suiteViva("Y/BLOCO", ["X-01", "X-02"]),
      },
      suitesObrigatorias: [ENTRADA_PROTEGIDA],
      contratoExtra: CAMPOS_COMPLETOS,
    });
    try {
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0,
        "a suite protegida com o conteudo do vizinho NAO pode dar verde:\n" + r.saida);
      assert.match(r.saida, /CASO_OBRIGATORIO_(AUSENTE|FORA_DO_ARQUIVO)/,
        "reprovou por outro motivo:\n" + r.saida);
      assert.doesNotMatch(r.saida, /AFERIDOR: EXECUCAO CONFIRMADA/,
        "o ciclo chegou a confirmar a execucao");
    } finally { limpar(caixa); }
  });

  test("GS-26: executor do portao INALCANCAVEL reprova, mesmo com o digest realinhado", () => {
    // FER-02 na sua forma exata, e o realinhamento do digest e parte da prova:
    // sem ele isto seria so mais um teste de integridade. Quem acende e a sonda
    // de alcance, que mede comportamento — a peca invocada com argumento
    // invalido tem de RECUSAR; neutralizada, ela sai zero.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    try {
      mutarPeca(caixa, "portao.js",
        "if (require.main === module) main();", "if (false) main();");
      realinharDigestsDasFerramentas(caixa);
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0, "portao neutralizado NAO pode dar verde:\n" + r.saida);
      assert.match(r.saida, /EXECUTOR_INALCANCAVEL/, "reprovou por outro motivo:\n" + r.saida);
      assert.doesNotMatch(r.saida, /FERRAMENTA_ADULTERADA/,
        "o digest foi realinhado: quem tem de acender e o comportamento, nao o digest");
      assert.doesNotMatch(r.saida, /PORTAO: APROVADO/, "o portao aprovou sem executar nada");
    } finally { limpar(caixa); }
  });

  test("GS-27: RETIRAR o executor do portao reprova, mesmo com o digest realinhado", () => {
    // A variante que nem finge: a linha some. Uma peca sem executor carrega,
    // exporta e sai ZERO — indistinguivel de sucesso para quem so olha o codigo
    // de saida, e e por isso que a sonda exige RECUSA explicita.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    try {
      mutarPeca(caixa, "portao.js", "if (require.main === module) main();", "");
      realinharDigestsDasFerramentas(caixa);
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0, "portao sem executor NAO pode dar verde:\n" + r.saida);
      assert.match(r.saida, /EXECUTOR_INALCANCAVEL/, "reprovou por outro motivo:\n" + r.saida);
    } finally { limpar(caixa); }
  });

  test("GS-28: portao que so IMPRIME o veredito nao produz prova, e o posttest recusa", () => {
    // A sabotagem mais fina das oito, e a razao de o `posttest` existir: o
    // `main()` e esvaziado mas a recusa de argumento e MANTIDA, entao a sonda de
    // alcance passa — a peca responde. O que nao ha e execucao: nenhum marcador,
    // nenhuma atribuicao, so a frase. A frase nao e o veredito; a prova selada e.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    try {
      mutarPeca(caixa, "portao.js", "function main() {",
        'function main() {\n' +
        '  if (process.argv.slice(2).length > 0) {\n' +
        '    console.error("[ARGUMENTO_INESPERADO] recusa de fachada");\n' +
        '    process.exit(1);\n' +
        '  }\n' +
        '  console.log("PORTAO: APROVADO (integridade + execucao real + atribuicao por arquivo)");\n' +
        '  return;');
      realinharDigestsDasFerramentas(caixa);
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0,
        "um portao que so imprime a frase NAO pode aprovar:\n" + r.saida);
      assert.equal(r.etapa, "posttest",
        "quem tinha de pegar esta era o `posttest`, e nao pegou:\n" + r.saida);
      assert.match(r.saida, /EXECUCAO_NAO_ACONTECEU/, "reprovou por outro motivo:\n" + r.saida);
      assert.match(r.saida, /PORTAO: APROVADO/,
        "a sabotagem nao chegou a imprimir a frase — a prova estaria medindo outra coisa");
    } finally { limpar(caixa); }
  });

  test("GS-29: retirar o `posttest` — do pacote ou do contrato — reprova", () => {
    // O trio e obrigatorio nos DOIS lugares. Tirar o script do `package.json` e
    // uma coisa; tirar a DECLARACAO do contrato e outra, e era a mais barata:
    // a versao anterior fazia `if (!nome || !esperado) continue;`, entao apagar
    // a declaracao apagava a conferencia junto, em silencio.
    for (const [modo, esperado] of [["pacote", /COMANDO_OFICIAL_AUSENTE/],
                                    ["contrato", /COMANDO_OFICIAL_INCOMPLETO/]]) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK },
        suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
      });
      try {
        if (modo === "pacote") {
          const p = path.join(caixa, "package.json");
          const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
          delete pkg.scripts.posttest;
          fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
        } else {
          const cPath = path.join(caixa, "ferramentas", "contrato-de-provas.json");
          const c = JSON.parse(fs.readFileSync(cPath, "utf8"));
          delete c.comandoOficial.scriptPosterior;
          delete c.comandoOficial.invocacaoPosteriorExata;
          fs.writeFileSync(cPath, JSON.stringify(c, null, 2), "utf8");
        }
        const r = rodarCicloNaCaixa(caixa);
        assert.notEqual(r.codigo, 0, `[${modo}] sem \`posttest\` NAO pode dar verde:\n` + r.saida);
        assert.equal(r.etapa, "pretest", `[${modo}] quem tinha de pegar era a guarda:\n` + r.saida);
        assert.match(r.saida, esperado, `[${modo}] reprovou por outro motivo:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });

  test("GS-30: retirar ou neutralizar o AFERIDOR reprova", () => {
    // A terceira voz tambem esta sob as duas defesas: presenca (digest, com
    // cobertura derivada do disco) e alcance (sonda de comportamento). Sem as
    // duas, silenciar o `posttest` seria o caminho curto de volta ao FER-02.
    for (const [modo, esperado] of [["ausente", /FERRAMENTA_AUSENTE/],
                                    ["neutralizado", /EXECUTOR_INALCANCAVEL/]]) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK },
        suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
      });
      try {
        if (modo === "ausente") {
          fs.unlinkSync(path.join(caixa, "ferramentas", "aferidor.js"));
        } else {
          mutarPeca(caixa, "aferidor.js", "if (require.main === module) main();", "if (false) main();");
          realinharDigestsDasFerramentas(caixa);
        }
        const r = rodarCicloNaCaixa(caixa);
        assert.notEqual(r.codigo, 0, `[${modo}] aferidor silenciado NAO pode dar verde:\n` + r.saida);
        assert.match(r.saida, esperado, `[${modo}] reprovou por outro motivo:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });

  test("GS-31: rodar a guarda SEM o `node --test` nao produz aprovacao", () => {
    // "Executar guarda sem `node --test`": o `pretest` sozinho sai zero e diz
    // que a integridade esta boa — e integridade nunca foi aprovacao. O
    // `posttest` chamado logo depois nao encontra marcador nenhum.
    //
    // A segunda metade e a que fecha a sobra: mesmo DEPOIS de um ciclo verde, o
    // marcador daquela execucao nao serve para a proxima, porque o `pretest`
    // apaga as sobras antes de emitir um desafio novo.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    try {
      const guardaSo = rodarNaCaixa(caixa, "gate-de-provas.js", ["--pretest"]);
      assert.equal(guardaSo.codigo, 0, "a guarda deveria aprovar a caixa intacta:\n" + guardaSo.saida);
      const semPortao = rodarNaCaixa(caixa, "aferidor.js");
      assert.notEqual(semPortao.codigo, 0, "sem o portao NAO pode haver aprovacao");
      assert.match(semPortao.saida, /EXECUCAO_NAO_ACONTECEU/);

      const completo = rodarCicloNaCaixa(caixa);
      assert.equal(completo.codigo, 0, "o ciclo intacto deveria aprovar:\n" + completo.saida);
      assert.ok(fs.existsSync(path.join(caixa, "ferramentas", ".marcador-de-execucao.json")),
        "o ciclo verde deveria ter deixado marcador");

      rodarNaCaixa(caixa, "gate-de-provas.js", ["--pretest"]);
      const sobra = rodarNaCaixa(caixa, "aferidor.js");
      assert.notEqual(sobra.codigo, 0,
        "o marcador de uma execucao anterior aprovou uma execucao que nao houve:\n" + sobra.saida);
      assert.match(sobra.saida, /EXECUCAO_NAO_ACONTECEU/);
    } finally { limpar(caixa); }
  });

  test("GS-32: o relator de atribuicao nao pode ser desligado pelo contrato", () => {
    // Se bastasse apagar `execucao.relatorDeAtribuicao` para o portao voltar a
    // contar sem atribuicao, FORJA-01 estaria fechado por convencao e nao por
    // construcao. As tres formas de desligar reprovam antes de qualquer execucao.
    const cenarios = [
      ["ausente", null, /SEM_RELATOR_DE_ATRIBUICAO/],
      ["fora das ferramentas", "test/relator.js", /RELATOR_FORA_DAS_FERRAMENTAS/],
      ["inexistente", "ferramentas/nao-existe.js", /RELATOR_AUSENTE/],
    ];
    for (const [nome, valor, esperado] of cenarios) {
      const caixa = criarCaixa({
        suites: { "viva.test.js": SUITE_OK },
        suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
      });
      try {
        const cPath = path.join(caixa, "ferramentas", "contrato-de-provas.json");
        const c = JSON.parse(fs.readFileSync(cPath, "utf8"));
        if (valor === null) delete c.execucao.relatorDeAtribuicao;
        else c.execucao.relatorDeAtribuicao = valor;
        fs.writeFileSync(cPath, JSON.stringify(c, null, 2), "utf8");
        const r = rodarCicloNaCaixa(caixa);
        assert.notEqual(r.codigo, 0, `relator ${nome} passou:\n` + r.saida);
        assert.match(r.saida, esperado, `relator ${nome} reprovou por outro motivo:\n` + r.saida);
      } finally { limpar(caixa); }
    }
  });

  test("GS-33: retirar JUNTAS a atribuicao e o executor continua vermelho", () => {
    // A sabotagem composta, que e a tentacao obvia depois de ler as duas
    // anteriores: se a atribuicao acende, tira-se a atribuicao; se o portao
    // acende, tira-se o portao. Tirar os dois nao soma duas defesas removidas,
    // porque quem sonda o alcance do portao e a GUARDA, e ela nao foi tocada.
    const caixa = criarCaixa({
      suites: {
        "protegida.test.js": cascaComCasosMortos(["X-01", "X-02"]),
        "isca.test.js": suiteViva("Y/BLOCO", ["X-01", "X-02"]),
      },
      suitesObrigatorias: [ENTRADA_PROTEGIDA],
      contratoExtra: CAMPOS_COMPLETOS,
    });
    try {
      mutarPeca(caixa, "portao.js", "if (foraDoArquivo.length) {", "if (false) {");
      mutarPeca(caixa, "portao.js", "if (pisoNaoAtingido.length) {", "if (false) {");
      mutarPeca(caixa, "portao.js", "if (require.main === module) main();", "if (false) main();");
      realinharDigestsDasFerramentas(caixa);
      const r = rodarCicloNaCaixa(caixa);
      assert.notEqual(r.codigo, 0,
        "atribuicao e executor retirados juntos deram VERDE:\n" + r.saida);
      assert.match(r.saida, /EXECUTOR_INALCANCAVEL/, "reprovou por outro motivo:\n" + r.saida);
      assert.doesNotMatch(r.saida, /PORTAO: APROVADO/);
      assert.doesNotMatch(r.saida, /AFERIDOR: EXECUCAO CONFIRMADA/);
    } finally { limpar(caixa); }
  });

  test("GS-34: o ciclo oficial INTACTO aprova, e as tres vozes falam", () => {
    // O controle das quatorze provas negativas acima. Sem ele, um ciclo que
    // reprovasse sempre passaria em todas elas e seria desligado no primeiro
    // dia util. E exige as TRES vozes: um ciclo em que o `posttest` cala e um
    // ciclo pela metade.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    try {
      const r = rodarCicloNaCaixa(caixa);
      assert.equal(r.codigo, 0, "o ciclo intacto reprovou:\n" + r.saida);
      assert.match(r.saida, /integridade das provas/, "o `pretest` nao falou");
      assert.match(r.saida, /PORTAO: APROVADO/, "o `test` nao falou");
      assert.match(r.saida, /AFERIDOR: EXECUCAO CONFIRMADA/, "o `posttest` nao falou");
    } finally { limpar(caixa); }
  });

  test("GS-35: o portao sozinho, sem o `pretest`, RECUSA em vez de aprovar", () => {
    // O executor tem de ser alcancado PELO COMANDO OFICIAL. Invocar so o meio
    // da corrente pula a conferencia que o antecede e a afericao que o sucede —
    // e um portao que aceitasse ser invocado assim seria um portao com uma porta
    // lateral documentada.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    try {
      const r = rodarNaCaixa(caixa, "portao.js");
      assert.notEqual(r.codigo, 0, "o portao aceitou rodar fora do comando oficial:\n" + r.saida);
      assert.match(r.saida, /DESAFIO_AUSENTE/, "reprovou por outro motivo:\n" + r.saida);
    } finally { limpar(caixa); }
  });

  test("GS-36: adulterar a atribuicao DEPOIS da execucao nao passa pelo posttest", () => {
    // O aferidor nao le so o resumo do portao: ele reabre a evidencia crua e
    // confere o digest que o marcador selou. Reescrever a atribuicao entre o
    // `test` e o `posttest` — para dizer que os obrigatorios rodaram onde nao
    // rodaram — troca o digest e acende.
    const caixa = criarCaixa({
      suites: { "viva.test.js": SUITE_OK },
      suitesObrigatorias: [{ id: "viva", caminho: "test/viva.test.js" }],
    });
    try {
      assert.equal(rodarNaCaixa(caixa, "gate-de-provas.js", ["--pretest"]).codigo, 0);
      assert.equal(rodarNaCaixa(caixa, "portao.js").codigo, 0);
      const atribuicao = path.join(caixa, "ferramentas", ".atribuicao-de-execucao.jsonl");
      fs.appendFileSync(atribuicao, JSON.stringify({
        r: "passou", tipo: "caso", arquivo: "test/viva.test.js",
        nome: "X-99: plantado depois", pulado: false, todo: false, aninhamento: 1,
      }) + "\n", "utf8");
      const r = rodarNaCaixa(caixa, "aferidor.js");
      assert.notEqual(r.codigo, 0, "atribuicao adulterada passou pelo posttest:\n" + r.saida);
      assert.match(r.saida, /ATRIBUICAO_DIVERGENTE/, "reprovou por outro motivo:\n" + r.saida);
    } finally { limpar(caixa); }
  });
});
