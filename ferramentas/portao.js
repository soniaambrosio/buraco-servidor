#!/usr/bin/env node
// ferramentas/portao.js — O COMANDO OFICIAL. Um processo, cinco estagios.
//
// `npm test` e exatamente `node ferramentas/portao.js`. Um comando so, sem
// encadeamento, de proposito.
//
// POR QUE UM PROCESSO SO. A OS 23.1-P-R1 mediu o defeito da forma anterior, que
// era uma cadeia de shell:
//
//     "test": "node ferramentas/gate-de-provas.js && node --test \"test/*.test.js\""
//
// Trocar `&&` por `;` deixava o portao VERDE com ZERO testes executados. No
// Windows o npm roda scripts pelo `cmd.exe`, e o `cmd.exe` nao trata `;` como
// separador: entrega como argumento. A guarda recebia argv `[";", "node",
// "--test", ...]`, ignorava, imprimia "OK" e saia 0 — e o `node --test` nunca
// era invocado. A mensagem de sucesso da conferencia ESTATICA era lida como
// aprovacao da suite.
//
// A licao nao e "escolher melhor o operador". E que **quem imprime o veredito
// tem de ser quem executou as provas**. Aqui nao ha operador de shell entre a
// conferencia e a execucao, porque nao ha shell: e uma funcao chamando a
// seguinte, e cada uma so devolve o controle se a anterior fechou.
//
// OS CINCO ESTAGIOS, e o que cada um responde:
//
//   1 INTEGRIDADE   as provas existem, estao registradas e nao foram adulteradas?
//   2 EXECUCAO      o `node --test` rodou de verdade, e com que codigo saiu?
//   3 CONTABILIDADE quantos casos TERMINARAM, e todos os obrigatorios passaram?
//   4 MARCADOR      registro selado do que aconteceu — so escrito depois de 1-3
//   5 AGREGADOR     rele o marcador do disco, confere o selo, e so entao aprova
//
// O SELO DO MARCADOR. O `nonce` nasce no inicio DESTE processo e vive so na
// memoria. O marcador leva um HMAC das contagens chaveado por ele. Um marcador
// fabricado a mao — ou sobrado de uma execucao anterior — nao tem como conhecer
// o nonce, entao o estagio 5 o recusa. "Marcador existe" nunca vira "suite
// aprovada".
//
// Uso:
//   node ferramentas/portao.js              o portao completo (o `npm test`)
//   node ferramentas/portao.js --marcador   imprime o marcador da ultima execucao
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const guarda = require("./gate-de-provas.js");

const RAIZ = guarda.RAIZ;
const MARCADOR = path.join(__dirname, ".marcador-de-execucao.json");

const NONCE = crypto.randomBytes(24).toString("hex");

function selar(carga, nonce) {
  return crypto.createHmac("sha256", nonce)
    .update(JSON.stringify(carga), "utf8")
    .digest("hex");
}

function morrer(codigo, titulo, linhas) {
  console.error("\n=== PORTAO: REPROVADO ===\n");
  console.error(`  [${codigo}] ${titulo}`);
  for (const l of linhas || []) console.error("      " + l);
  console.error("");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// ESTAGIO 3 — leitura do TAP.
//
// Le o relatorio de maquina, nao a saida humana. O `node --test` emite
// `ok N - <nome>` / `not ok N - <nome>` por caso e um rodape `# tests`,
// `# pass`, `# fail`. E dali que sai a resposta para "quantos TERMINARAM", que
// e diferente de "o comando iniciou".
// ESTAGIO 3 — leitura do TAP.
//
// UMA SUTILEZA QUE MUDA O VEREDITO. O `node --test` conta como "test" o proprio
// ARQUIVO quando ele nao declara caso nenhum: um `test/vazia.test.js` sem uma
// linha de `test()` produz `# tests 1 / # pass 1` e sai com codigo 0. Ler so o
// rodape faria "nenhuma prova existe" parecer "uma prova passou" — a mesma
// familia de engano que a OS 23.1-P-R1 mediu, um andar abaixo.
//
// Por isso cada `ok` e classificado pelo `type:` que o proprio TAP declara
// logo abaixo: `suite` (um `describe`), `test` (um caso). E um `test` cujo nome
// termina em `.test.js` e o envelope do arquivo, nao uma prova. So o que sobra
// depois desses dois descontos conta como CASO EXECUTADO.
function lerTap(saida) {
  const linhas = saida.split(/\r?\n/);
  const casos = new Set();       // provas de verdade que passaram
  const suites = new Set();      // `describe` — estrutura, nao prova
  const arquivos = new Set();    // envelopes de arquivo sem caso nenhum
  const reprovados = new Set();
  let tests = null, pass = null, fail = null, skipped = null;

  const ehArquivo = (nome) => /\.test\.js$/i.test(nome.replace(/\\/g, "/"));
  /** O `type:` declarado no bloco YAML que segue esta linha de resultado. */
  const tipoApos = (i) => {
    for (let j = i + 1; j < Math.min(i + 12, linhas.length); j++) {
      const t = linhas[j].match(/^\s*type:\s*'([a-z]+)'\s*$/);
      if (t) return t[1];
      if (/^\s*\.\.\.\s*$/.test(linhas[j])) break;
    }
    return "test";
  };

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    let m = l.match(/^\s*not ok \d+ - (.*)$/);
    if (m) { reprovados.add(m[1].trim()); continue; }
    m = l.match(/^\s*ok \d+ - (.*)$/);
    if (m) {
      const nome = m[1].trim();
      // Diretiva TAP: `# SKIP` / `# TODO` viajam como `ok`, e nao sao aprovacao.
      // Sem esta linha, marcar um caso obrigatorio como `skip` o faria contar
      // como executado — que e precisamente a confusao que a C2 fecha.
      if (/#\s*(SKIP|TODO)\b/i.test(nome)) continue;
      const tipo = tipoApos(i);
      if (tipo === "suite") suites.add(nome);
      else if (ehArquivo(nome)) arquivos.add(nome);
      else casos.add(nome);
      continue;
    }
    m = l.match(/^# tests (\d+)$/);      if (m) { tests = Number(m[1]); continue; }
    m = l.match(/^# pass (\d+)$/);       if (m) { pass = Number(m[1]); continue; }
    m = l.match(/^# fail (\d+)$/);       if (m) { fail = Number(m[1]); continue; }
    m = l.match(/^# skipped (\d+)$/);    if (m) { skipped = Number(m[1]); continue; }
  }
  return { aprovados: casos, suites, arquivos, reprovados, tests, pass, fail, skipped };
}

/** O ID estavel na frente do nome de um caso TAP (`C-01: ...` -> `C-01`). */
function idDoNome(nome) {
  return (nome.match(/^([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)?)\s*:/) || [])[1] || null;
}

// ---------------------------------------------------------------------------
function main() {
  // Argv estrito, pela mesma razao da guarda: com `;` o `cmd.exe` entrega o
  // resto do script como argumento em vez de executa-lo. Se isso acontecer,
  // este processo TEM de recusar em vez de rodar como se nada fosse.
  const args = process.argv.slice(2);
  const soMarcador = args.length === 1 && args[0] === "--marcador";
  if (args.length > 0 && !soMarcador) {
    morrer("ARGUMENTO_INESPERADO", "o comando oficial nao aceita argumentos: " + JSON.stringify(args), [
      "Se isto veio de um script encadeado com `;`, esse e exatamente o defeito que",
      "a OS 23.1-P-C2 fecha: o `cmd.exe` entrega o `;` como argumento e o comando",
      "seguinte nunca roda. O comando oficial e um processo unico.",
    ]);
  }

  if (soMarcador) {
    if (!fs.existsSync(MARCADOR)) {
      console.error("nenhum marcador: o portao nao concluiu nenhuma execucao nesta arvore.");
      process.exit(1);
    }
    console.log(fs.readFileSync(MARCADOR, "utf8"));
    return;
  }

  // O marcador da execucao anterior morre ANTES de qualquer coisa. Assim
  // nenhuma etapa posterior pode confundir sobra com resultado, e um marcador
  // plantado a mao nao sobrevive ao proprio inicio do portao.
  try { fs.unlinkSync(MARCADOR); } catch (_) {}

  // --- 1 INTEGRIDADE -------------------------------------------------------
  const { falhas, contrato } = guarda.conferir();
  if (falhas.length > 0) {
    guarda.relatar(falhas);
    process.exit(1);
  }
  const suites = contrato.suitesObrigatorias || [];
  const execucao = contrato.execucao || {};
  console.log(
    `[1/5] integridade: ${suites.length} suites obrigatorias conferidas ` +
    `(contrato v${contrato.versaoContratoDeProva})`
  );

  // --- 2 EXECUCAO ----------------------------------------------------------
  const padroes = execucao.padroes;
  const argv = ["--test", "--test-reporter=tap", ...padroes];
  console.log(`[2/5] execucao: node ${argv.join(" ")}`);

  const proc = spawnSync(process.execPath, argv, {
    cwd: RAIZ, encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
  });

  if (proc.error) {
    morrer("EXECUCAO_NAO_INICIOU", "nao foi possivel executar as provas", [String(proc.error.message)]);
  }
  const saida = String(proc.stdout || "") + String(proc.stderr || "");
  if (proc.status !== 0) {
    process.stdout.write(saida);
    morrer("PROVAS_VERMELHAS", `o \`node --test\` saiu com codigo ${proc.status}`, [
      "Ha teste reprovando. Isto e falha de prova, nao de portao.",
    ]);
  }

  // --- 3 CONTABILIDADE -----------------------------------------------------
  const tap = lerTap(saida);

  if (!Number.isInteger(tap.tests) || !Number.isInteger(tap.pass) || !Number.isInteger(tap.fail)) {
    process.stdout.write(saida);
    morrer("RELATORIO_ILEGIVEL", "o relatorio TAP nao trouxe as contagens", [
      "Sem `# tests`/`# pass`/`# fail` nao ha como afirmar que alguma prova terminou.",
      "Codigo de saida zero NAO basta: um comando que nao roda nada tambem sai zero.",
    ]);
  }

  // Zero PROVAS e REPROVACAO, nao sucesso silencioso. Este e o coracao da C2:
  // codigo de saida zero com nenhuma prova executada era o falso-verde 2.1.
  // Conta-se `aprovados` — casos de verdade —, nunca o rodape `# tests`, que
  // inclui o envelope de arquivos sem caso nenhum.
  const casosExecutados = tap.aprovados.size;
  if (casosExecutados === 0) {
    morrer("ZERO_TESTES",
      `o comando terminou sem executar prova nenhuma ` +
      `(casos=0, arquivos sem caso=${tap.arquivos.size}, rodape # tests=${tap.tests})`, [
        "Um alvo que seleciona zero casos sai com codigo 0 e parece sucesso.",
        "O `node --test` chega a contar como teste o proprio arquivo vazio.",
        "Nesta arquitetura, nenhuma prova executada e reprovacao.",
      ]);
  }
  if (tap.arquivos.size > 0) {
    morrer("ARQUIVO_SEM_PROVA",
      `${tap.arquivos.size} arquivo(s) foram executados sem declarar caso nenhum`, [
        [...tap.arquivos].slice(0, 5).join(", "),
        "Um arquivo de teste esvaziado passa como se fosse uma prova aprovada.",
      ]);
  }
  if (tap.fail !== 0) {
    process.stdout.write(saida);
    morrer("PROVAS_VERMELHAS", `${tap.fail} caso(s) reprovaram`, []);
  }

  const minimo = Number.isInteger(execucao.totalMinimoDeTestes) ? execucao.totalMinimoDeTestes : null;
  if (minimo === null) {
    morrer("SEM_TOTAL_MINIMO", "o contrato precisa declarar `execucao.totalMinimoDeTestes`", [
      "Sem piso global, uma reducao macica da suite passa por execucao normal.",
    ]);
  }
  if (casosExecutados < minimo) {
    morrer("ABAIXO_DO_TOTAL_MINIMO", `${casosExecutados} casos executados, minimo aprovado ${minimo}`, [
      "A suite encolheu. Se a reducao for deliberada, atualize o contrato no mesmo commit.",
    ]);
  }

  // Cada caso obrigatorio nao so EXISTE no arquivo (isso a guarda ja conferiu):
  // ele TERMINOU e passou nesta execucao. E a prova de conteudo que nao depende
  // de contagem nem de nome de arquivo, e cuja expectativa mora FORA da suite.
  const idsAprovados = new Set();
  for (const nome of tap.aprovados) {
    const id = idDoNome(nome);
    if (id) idsAprovados.add(id);
  }
  const porSuite = {};
  const ausentes = [];
  for (const s of suites) {
    const exigidos = s.casosObrigatorios || [];
    const faltando = exigidos.filter((id) => !idsAprovados.has(id));
    porSuite[s.caminho] = { exigidos: exigidos.length, aprovados: exigidos.length - faltando.length };
    for (const id of faltando) ausentes.push(`${s.id}:${id}`);
  }
  if (ausentes.length) {
    morrer("CASO_OBRIGATORIO_NAO_EXECUTADO",
      `${ausentes.length} caso(s) obrigatorio(s) nao passaram nesta execucao`, [
        ausentes.slice(0, 10).join(", ") + (ausentes.length > 10 ? ` … (+${ausentes.length - 10})` : ""),
        "O arquivo pode estar no lugar e o caso nao ter rodado — filtro, `skip`, alvo estreitado.",
        "Presenca no disco nao e execucao.",
      ]);
  }
  console.log(
    `[3/5] contabilidade: ${casosExecutados} casos executados e aprovados ` +
    `(${tap.suites.size} blocos), ${tap.fail} falhas, ${tap.skipped || 0} pulados`
  );
  for (const s of suites) {
    const c = porSuite[s.caminho];
    console.log(`      ${s.caminho}: ${c.aprovados}/${c.exigidos} casos obrigatorios aprovados`);
  }

  // --- 4 MARCADOR ----------------------------------------------------------
  const carga = {
    contratoVersao: contrato.versaoContratoDeProva,
    digestDoContrato: guarda.sha256(guarda.lerNormalizado(guarda.CONTRATO)),
    casosExecutados,
    blocosExecutados: tap.suites.size,
    rodapeTests: tap.tests,
    rodapePass: tap.pass,
    falhas: tap.fail,
    codigoDeSaidaDasProvas: proc.status,
    porSuite,
  };
  const marcador = { carga, selo: selar(carga, NONCE) };
  fs.writeFileSync(MARCADOR, JSON.stringify(marcador, null, 2) + "\n", "utf8");
  console.log(`[4/5] marcador: ${path.relative(RAIZ, MARCADOR).replace(/\\/g, "/")} selado`);

  // --- 5 AGREGADOR ---------------------------------------------------------
  // Rele do disco. Nao reaproveita o objeto em memoria de proposito: o que
  // aprova e o artefato, e o artefato tem de sobreviver a ida e volta.
  let lido;
  try {
    lido = JSON.parse(fs.readFileSync(MARCADOR, "utf8"));
  } catch (e) {
    morrer("MARCADOR_ILEGIVEL", "o marcador nao pode ser relido", [e.message]);
  }
  if (!lido || !lido.carga || lido.selo !== selar(lido.carga, NONCE)) {
    morrer("MARCADOR_NAO_CONFERE", "o selo do marcador nao bate com esta execucao", [
      "O selo e chaveado por um nonce que so existe na memoria deste processo.",
      "Marcador fabricado a mao, ou sobrado de outra execucao, nao passa daqui.",
    ]);
  }
  if (lido.carga.casosExecutados !== casosExecutados || lido.carga.falhas !== 0) {
    morrer("MARCADOR_DIVERGENTE", "o marcador nao descreve a execucao observada", []);
  }

  console.log(
    `[5/5] agregador: marcador conferido — ${lido.carga.casosExecutados} provas executadas, ` +
    `0 falhas`
  );
  console.log("\nPORTAO: APROVADO (integridade + execucao real + contabilidade + marcador selado)");
}

if (require.main === module) main();

module.exports = { lerTap, idDoNome, selar, MARCADOR };
