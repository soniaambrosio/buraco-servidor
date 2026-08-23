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
// OS SEIS ESTAGIOS, e o que cada um responde:
//
//   1 INTEGRIDADE   as provas existem, estao registradas e nao foram adulteradas?
//   2 DESAFIO       este processo foi mesmo alcancado pelo comando oficial?
//   3 EXECUCAO      o `node --test` rodou de verdade, e com que codigo saiu?
//   4 CONTABILIDADE quantos casos TERMINARAM — e cada obrigatorio passou NO
//                   ARQUIVO que o contrato manda prova-lo?
//   5 MARCADOR      registro selado do que aconteceu — so escrito depois de 1-4
//   6 AGREGADOR     rele o marcador do disco, confere o selo, e so entao aprova
//
// O SELO DO MARCADOR. O `nonce` nasce no inicio DESTE processo e vive so na
// memoria. O marcador leva um HMAC das contagens chaveado por ele. Um marcador
// fabricado a mao — ou sobrado de uma execucao anterior — nao tem como conhecer
// o nonce, entao o estagio 6 o recusa. "Marcador existe" nunca vira "suite
// aprovada".
//
// O QUE A OS 23.1-P-C3 ACRESCENTOU, e por que:
//
//   ATRIBUICAO (escape FORJA-01). Contar identificadores num conjunto PLANO,
//   somado de todos os arquivos, respondia a pergunta errada. Bastava esvaziar
//   `test/produtor_v2.test.js` — os 61 casos dentro de um `if (false)` — e
//   acrescentar um `test/zz_falso.test.js` nao registrado com os mesmos 61
//   identificadores para o portao imprimir `61/61 casos obrigatorios aprovados`
//   sobre um arquivo que executou ZERO. Agora cada caso obrigatorio e cobrado
//   DO ARQUIVO DECLARADO, com a atribuicao vinda da stream de eventos do
//   executor — que carrega `file`, coisa que o TAP nao carrega.
//
//   DESAFIO (escape FER-02). O portao era seu proprio ultimo conferente: bastava
//   tornar a linha final deste arquivo — a que chama `main()` quando ele e o
//   modulo principal — inalcancavel, e realinhar o digest, para o `npm test`
//   sair com codigo zero, sem marcador e sem veredito.
//
//   (Esta linha aparece UMA vez neste arquivo, e no fim, de proposito: as provas
//   de sobrevivencia a sabotam por texto exato e recusam ancora ambigua. Nao a
//   reescreva num comentario.)
//   Agora o `pretest` emite um desafio, este processo o repassa dentro do selo
//   do marcador, e o `posttest` (`ferramentas/aferidor.js`) exige a prova. Um
//   portao que nao roda nao deixa marcador, e ausencia de marcador e vermelho.
//
// Uso:
//   npm test                                o comando oficial (pretest+test+posttest)
//   node ferramentas/portao.js              so o meio do caminho; exige o desafio
//   node ferramentas/portao.js --marcador   imprime o marcador da ultima execucao
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const guarda = require("./gate-de-provas.js");

const RAIZ = guarda.RAIZ;
// Os caminhos dos tres efemeros sao da guarda, e nao daqui: as tres pecas do
// ciclo do npm precisam olhar para o MESMO arquivo, e duas definicoes do mesmo
// caminho sao duas verdades esperando divergir.
const MARCADOR = guarda.MARCADOR;
const DESAFIO = guarda.DESAFIO;
const ATRIBUICAO = guarda.ATRIBUICAO;

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

/** O ID estavel na frente do nome de um caso TAP (`C-01: ...` -> `C-01`).
 *
 *  Delega para a guarda de proposito. Tres pecas leem identificadores — guarda,
 *  portao e aferidor — e duas leituras diferentes do mesmo nome seriam, na
 *  pratica, duas listas de obrigatorios diferentes. */
function idDoNome(nome) {
  return guarda.idDeCaso(nome);
}

// ---------------------------------------------------------------------------
// ESTAGIO 4 — a atribuicao.
//
// O QUE O TAP NAO DIZ. Quando um arquivo de teste declara `describe`/`test` no
// topo, o executor ica os blocos para o nivel raiz do relatorio: o nome do
// arquivo nao aparece em lugar nenhum da saida TAP. So o arquivo VAZIO — o que
// nao declara caso algum — vira uma linha com nome de arquivo. Nao existe, no
// TAP, informacao para atribuir um caso ao seu arquivo.
//
// A stream de eventos do executor, essa sim, carrega `file` em cada `test:pass`
// e `test:fail`. `ferramentas/relator-de-atribuicao.js` a converte em uma linha
// JSON por evento, e e isso que se le aqui.
//
// FECHADO POR CONSTRUCAO. Se o registro nao existe, esta vazio, nao e legivel
// ou nao fecha com a contagem do TAP, isto e REPROVACAO — nunca "seguimos sem
// atribuicao". Uma defesa que se desliga sozinha quando o insumo falta e
// exatamente o padrao que a C2 passou duas voltas fechando.
function lerAtribuicao(bruto, tapTests) {
  const porArquivo = new Map();
  let casosRelatados = 0;
  let linhaN = 0;
  for (const linha of bruto.split("\n")) {
    linhaN++;
    if (linha.trim() === "") continue;
    let ev;
    try {
      ev = JSON.parse(linha);
    } catch (e) {
      morrer("ATRIBUICAO_ILEGIVEL", `linha ${linhaN} do registro de atribuicao nao e JSON`, [
        e.message,
        "Sem registro legivel nao ha como dizer qual arquivo executou cada caso.",
      ]);
    }
    if (ev.tipo === "caso") casosRelatados++;
    if (ev.r !== "passou" || ev.tipo !== "caso" || ev.pulado === true || ev.todo === true) continue;
    const arq = typeof ev.arquivo === "string" && ev.arquivo !== "" ? ev.arquivo : "(sem arquivo)";
    if (!porArquivo.has(arq)) porArquivo.set(arq, { casos: new Set(), ids: new Set() });
    const registro = porArquivo.get(arq);
    registro.casos.add(String(ev.nome));
    const id = guarda.idDeCaso(String(ev.nome));
    if (id) registro.ids.add(id);
  }

  // A trava contra um relator que aprende a mentir por omissao: o numero de
  // casos relatados tem de fechar com o rodape do TAP, que veio do MESMO
  // processo por outro caminho. Duas testemunhas independentes da mesma
  // execucao; divergiu, nao aprova.
  if (casosRelatados !== tapTests) {
    morrer("ATRIBUICAO_INCOMPLETA",
      `o registro de atribuicao descreve ${casosRelatados} caso(s) e o TAP contou ${tapTests}`, [
        "As duas contagens vem da mesma execucao por caminhos diferentes.",
        "Divergencia significa que uma das duas testemunhas foi silenciada.",
      ]);
  }
  return porArquivo;
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

  // As sobras da execucao anterior morrem ANTES de qualquer coisa. Assim nenhuma
  // etapa posterior pode confundir sobra com resultado, e um marcador plantado a
  // mao nao sobrevive ao proprio inicio do portao. (O `pretest` tambem apaga as
  // duas — de proposito: um portao NEUTRALIZADO nao apaga coisa nenhuma, e era
  // por ai que um marcador de ontem sobrevivia a um `test` que nao fez nada.)
  try { fs.unlinkSync(MARCADOR); } catch (_) {}
  try { fs.unlinkSync(ATRIBUICAO); } catch (_) {}

  // --- 1 INTEGRIDADE -------------------------------------------------------
  // A INTEGRIDADE VEM ANTES DO DESAFIO, e a ordem foi medida, nao escolhida
  // por gosto. Quando falta o desafio, quase sempre falta porque o `pretest`
  // sumiu do `package.json` — e quem sabe dizer ISSO, com codigo estavel, e a
  // guarda (`COMANDO_OFICIAL_AUSENTE`). Perguntando pelo desafio primeiro, a
  // resposta seria `DESAFIO_AUSENTE`: verdadeira, e mudando de assunto.
  // Vermelho tem de ser sobre a causa, e nao sobre o sintoma mais proximo.
  // (A campanha `mutacoes_sobrevivencia.js` mede exatamente isto em `E4c`.)
  const { falhas, contrato } = guarda.conferir();
  if (falhas.length > 0) {
    guarda.relatar(falhas);
    process.exit(1);
  }
  const suites = contrato.suitesObrigatorias || [];
  const execucao = contrato.execucao || {};
  console.log(
    `[1/6] integridade: ${suites.length} suites obrigatorias conferidas ` +
    `(contrato v${contrato.versaoContratoDeProva})`
  );

  // --- 2 DESAFIO -----------------------------------------------------------
  // O portao nao e o comeco do caminho oficial, e nao pode fingir que e. O
  // `pretest` — que o npm executa por semantica propria, sem operador de shell
  // no meio — emite um nonce em disco. Sem ele, este processo nao foi alcancado
  // pelo comando oficial, e recusa: rodar so o meio da corrente nao prova nada
  // sobre a corrente. E o mesmo nonce que amarra o marcador ao `posttest`.
  if (!fs.existsSync(DESAFIO)) {
    morrer("DESAFIO_AUSENTE", "nao ha desafio emitido pelo `pretest` para esta execucao", [
      "O comando oficial e `npm test`, que roda tres scripts: `pretest` (a guarda),",
      "`test` (este portao) e `posttest` (o aferidor). Invocar so este processo pula",
      "a conferencia de integridade que o antecede e a aferição que o sucede.",
    ]);
  }
  let desafio;
  try {
    desafio = JSON.parse(fs.readFileSync(DESAFIO, "utf8"));
  } catch (e) {
    morrer("DESAFIO_ILEGIVEL", "o desafio desta execucao nao pode ser lido", [e.message]);
  }
  if (!desafio || typeof desafio.nonce !== "string" || !/^[0-9a-f]{48,}$/i.test(desafio.nonce)) {
    morrer("DESAFIO_MAL_FORMADO", "o desafio nao carrega um nonce utilizavel", []);
  }
  console.log(`[2/6] desafio: nonce do \`pretest\` recebido (${desafio.nonce.slice(0, 12)}…)`);

  // --- 3 EXECUCAO ----------------------------------------------------------
  // DOIS RELATORES, no mesmo processo e na mesma execucao. O TAP vai para a
  // saida padrao e continua sendo a unica fonte da contabilidade da C2 — nada
  // do que ela afirma passa a depender da peca nova. O relator de atribuicao
  // vai para um arquivo, e responde a pergunta que o TAP nao responde: QUEM
  // executou cada caso.
  const padroes = execucao.padroes;
  const relator = String(execucao.relatorDeAtribuicao).replace(/\\/g, "/");
  const destinoDaAtribuicao = path.relative(RAIZ, ATRIBUICAO).replace(/\\/g, "/");
  const argv = [
    "--test",
    "--test-reporter=tap", "--test-reporter-destination=stdout",
    "--test-reporter=./" + relator, "--test-reporter-destination=" + destinoDaAtribuicao,
    ...padroes,
  ];
  console.log(`[3/6] execucao: node ${argv.join(" ")}`);

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

  // --- 4 CONTABILIDADE -----------------------------------------------------
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

  // A ATRIBUICAO. Cada caso obrigatorio nao so EXISTE no arquivo (isso a guarda
  // ja conferiu): ele TERMINOU, passou nesta execucao, e passou NO ARQUIVO certo.
  // Fechada por construcao: sem registro nao ha veredito. Este e
  // o conserto do escape FORJA-01, e ele cabe numa frase — a pergunta deixou de
  // ser "o `C-01` passou em algum lugar?" e passou a ser "o `C-01` passou NO
  // ARQUIVO que o contrato manda prova-lo?".
  if (!fs.existsSync(ATRIBUICAO)) {
    morrer("ATRIBUICAO_AUSENTE",
      "a execucao terminou sem registro de atribuicao", [
        `esperado em ${path.relative(RAIZ, ATRIBUICAO).replace(/\\/g, "/")}`,
        "Sem saber QUAL arquivo executou cada caso, `61/61 aprovados` pode estar",
        "descrevendo um arquivo que executou zero. Nao ha veredito sem atribuicao.",
      ]);
  }
  const brutoDaAtribuicao = guarda.lerNormalizado(ATRIBUICAO);
  if (brutoDaAtribuicao.trim() === "") {
    morrer("ATRIBUICAO_VAZIA", "o registro de atribuicao existe e esta vazio", [
      "Um relator silenciado produz exatamente isto. Vazio nao e `nada a atribuir`.",
    ]);
  }
  const porArquivo = lerAtribuicao(brutoDaAtribuicao, tap.tests);
  const idsEmQualquerArquivo = idsAprovadosEmQualquerArquivo(porArquivo);

  const porSuite = {};
  const naoExecutados = [];
  const foraDoArquivo = [];
  const pisoNaoAtingido = [];
  for (const s of suites) {
    const chave = String(s.caminho).replace(/\\/g, "/");
    const registro = porArquivo.get(chave) || { casos: new Set(), ids: new Set() };
    const exigidos = s.casosObrigatorios || [];
    const faltando = exigidos.filter((id) => !registro.ids.has(id));
    porSuite[s.caminho] = {
      exigidos: exigidos.length,
      aprovados: exigidos.length - faltando.length,
      executados: registro.casos.size,
    };
    for (const id of faltando) {
      // A distincao vale o codigo separado: "nao rodou em lugar nenhum" e um
      // caso perdido; "rodou, mas em OUTRO arquivo" e uma prova plantada.
      const rotulo = `${s.id}:${id}`;
      if (idsEmQualquerArquivo.has(id)) foraDoArquivo.push(rotulo);
      else naoExecutados.push(rotulo);
    }
    if (Number.isInteger(s.pisoDeCasos) && registro.casos.size < s.pisoDeCasos) {
      pisoNaoAtingido.push(
        `${chave}: ${registro.casos.size} casos executados NESTE arquivo, piso ${s.pisoDeCasos}`);
    }
  }
  if (naoExecutados.length) {
    morrer("CASO_OBRIGATORIO_NAO_EXECUTADO",
      `${naoExecutados.length} caso(s) obrigatorio(s) nao passaram nesta execucao`, [
        naoExecutados.slice(0, 10).join(", ") +
          (naoExecutados.length > 10 ? ` … (+${naoExecutados.length - 10})` : ""),
        "O arquivo pode estar no lugar e o caso nao ter rodado — filtro, `skip`, alvo estreitado.",
        "Presenca no disco nao e execucao.",
      ]);
  }
  if (foraDoArquivo.length) {
    morrer("CASO_OBRIGATORIO_FORA_DO_ARQUIVO",
      `${foraDoArquivo.length} caso(s) obrigatorio(s) passaram em OUTRO arquivo`, [
        foraDoArquivo.slice(0, 10).join(", ") +
          (foraDoArquivo.length > 10 ? ` … (+${foraDoArquivo.length - 10})` : ""),
        "Um identificador igual noutro arquivo nao prova nada sobre a suite protegida.",
        "E o escape FORJA-01: a casca fica no lugar, o digest e o piso sao realinhados,",
        "e um arquivo nao registrado empresta os identificadores.",
      ]);
  }
  if (pisoNaoAtingido.length) {
    morrer("ABAIXO_DO_PISO_EXECUTADO",
      "uma suite obrigatoria executou menos casos do que o piso declarado", [
        ...pisoNaoAtingido,
        "O piso textual da guarda conta `test(` no arquivo; este conta o que EXECUTOU.",
        "Sessenta e um casos dentro de um `if (false)` passam no primeiro e morrem aqui.",
      ]);
  }
  console.log(
    `[4/6] contabilidade: ${casosExecutados} casos executados e aprovados ` +
    `(${tap.suites.size} blocos), ${tap.fail} falhas, ${tap.skipped || 0} pulados`
  );
  for (const s of suites) {
    const c = porSuite[s.caminho];
    console.log(
      `      ${s.caminho}: ${c.aprovados}/${c.exigidos} casos obrigatorios aprovados ` +
      `NESTE arquivo (${c.executados} casos executados nele)`);
  }

  // --- 5 MARCADOR ----------------------------------------------------------
  // O desafio lido no estagio 1 tem de ser o MESMO que esta em disco agora. Uma
  // execucao que emitisse um desafio novo no meio do caminho — uma guarda
  // chamada a mao por alguma prova, por exemplo — deixaria este marcador selado
  // por uma chave que o `posttest` nao vai encontrar, e o vermelho resultante
  // falaria de um defeito que nao existe. Vermelho tem de ser sobre a coisa
  // certa: se o desafio trocou, isto e o que se diz.
  let desafioAgora = null;
  try {
    desafioAgora = JSON.parse(fs.readFileSync(DESAFIO, "utf8"));
  } catch (_) { /* tratado logo abaixo */ }
  if (!desafioAgora || desafioAgora.nonce !== desafio.nonce) {
    morrer("DESAFIO_TROCADO", "o desafio mudou entre o inicio e o fim desta execucao", [
      "Alguma coisa reemitiu o desafio enquanto a suite rodava.",
      "O marcador desta execucao nao teria como ser conferido pelo `posttest`.",
    ]);
  }

  const carga = {
    contratoVersao: contrato.versaoContratoDeProva,
    digestDoContrato: guarda.sha256(guarda.lerNormalizado(guarda.CONTRATO)),
    desafio: guarda.sha256(desafio.nonce),
    casosExecutados,
    blocosExecutados: tap.suites.size,
    rodapeTests: tap.tests,
    rodapePass: tap.pass,
    falhas: tap.fail,
    codigoDeSaidaDasProvas: proc.status,
    digestDaAtribuicao: guarda.sha256(brutoDaAtribuicao),
    porSuite,
  };
  // DOIS selos, e cada um responde a uma pergunta diferente. `selo` e chaveado
  // pelo nonce de memoria deste processo: e o que impede um marcador plantado
  // de chegar ao estagio 6. `seloDeDesafio` e chaveado pelo nonce do `pretest`:
  // e o que permite ao `posttest`, que e outro processo, distinguir o marcador
  // DESTA execucao de qualquer outro.
  const marcador = {
    carga,
    selo: selar(carga, NONCE),
    seloDeDesafio: guarda.selarCom(carga, desafio.nonce),
  };
  fs.writeFileSync(MARCADOR, JSON.stringify(marcador, null, 2) + "\n", "utf8");
  console.log(`[5/6] marcador: ${path.relative(RAIZ, MARCADOR).replace(/\\/g, "/")} selado`);

  // --- 6 AGREGADOR ---------------------------------------------------------
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
    `[6/6] agregador: marcador conferido — ${lido.carga.casosExecutados} provas executadas, ` +
    `0 falhas`
  );
  console.log("\nPORTAO: APROVADO (integridade + execucao real + atribuicao por arquivo + marcador selado)");
  console.log("  (o veredito final e do `posttest`: `node ferramentas/aferidor.js`)");
}

/** Os identificadores aprovados em QUALQUER arquivo desta execucao.
 *
 *  Serve so para separar dois diagnosticos que merecem codigos diferentes: um
 *  obrigatorio que nao rodou em lugar nenhum, e um que rodou no arquivo errado.
 *  A decisao de reprovar nao depende disto — as duas reprovam. */
function idsAprovadosEmQualquerArquivo(porArquivo) {
  const ids = new Set();
  for (const registro of porArquivo.values()) for (const id of registro.ids) ids.add(id);
  return ids;
}

if (require.main === module) main();

module.exports = { lerTap, idDoNome, lerAtribuicao, selar, MARCADOR, DESAFIO, ATRIBUICAO };
