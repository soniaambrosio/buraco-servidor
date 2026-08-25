// ===========================================================================
// CAMPANHA NEGATIVA DA OS 52-C4 — AUTORIDADE DO ARTEFATO PRODUTIVO.
//
// A pergunta desta campanha não é "a guarda reconhece o servidor?". É outra, e
// é a que a OS 52-A2 escolheu:
//
//     uma duplicata que NENHUM scanner reconheceria continua sendo recusada?
//
// As sete duplicatas da família F1 são escritas de propósito para atravessar
// qualquer expressão regular: colchetes, concatenação, vetor de nomes,
// template, base64, ingresso computado e controle em notação de ponto. Nenhuma
// delas é reconhecida por capacidade — e todas reprovam, porque **não
// pertencem ao artefato**. A mensagem prova isso: ela não cita `createServer`,
// `listen` nem handshake nenhum.
//
// ---------------------------------------------------------------------------
// AS FAMÍLIAS
// ---------------------------------------------------------------------------
//
//   F1 (7) — duplicatas indetectáveis pelo scanner
//   F2 (5) — evasões dinâmicas (`new Function`, `createRequire`, `Reflect.get`,
//            `net` com acesso computado, par `.js` + `.txt` com base64)
//   F3 (8) — desvios de arranque, todos pela autoridade do artefato e nunca só
//            pelo CRED-34 herdado
//   F4 (3) — neutralizações da própria guarda
//   F5 (2) — pacotes concorrentes
//
// ---------------------------------------------------------------------------
// A CLASSIFICAÇÃO DA ORIGEM
// ---------------------------------------------------------------------------
//
// Não basta ficar vermelho: importa QUEM reprovou. A etapa `pretest` chama
// `exigirArtefatoUnico()` ANTES de qualquer heurística, então quando a
// autoridade reprova o laudo começa com `ARTEFATO PRODUTIVO VIOLADO` e a
// unicidade por capacidade nem chega a rodar. Cada vetor declara de quem espera
// a recusa, e a campanha confere — vermelho pela razão errada é tão inútil
// quanto verde indevido.
//
// ---------------------------------------------------------------------------
// HIGIENE
// ---------------------------------------------------------------------------
//
// Sem laço de fundo: tudo é `spawnSync`. Árvore suja é recusa. Âncora tem de
// aparecer uma vez só e os bytes têm de mudar. Timeout e sinal são
// INCONCLUSIVO, nunca detecção. Controle de integridade no começo e no fim.
// Mutação de JSON é feita no OBJETO, nunca por expressão regular.
//
// Uso:
//   node mutacoes_c4.js                # campanha inteira
//   node mutacoes_c4.js --so F1-1,F5-2 # só estes vetores
//   node mutacoes_c4.js --listar
// ===========================================================================
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const RAIZ = __dirname;

// O nome do log carrega a OS E a família. Esta máquina roda mais de uma sessão
// ao mesmo tempo, e um prefixo genérico já produziu dois logs `campanha-os52c4-*`
// de campanhas DIFERENTES no mesmo diretório temporário — ler o log errado é
// mais fácil do que parece, e o placar sai de outra árvore.
const LOG = path.join(os.tmpdir(), "campanha-os52c4-artefato-" + process.pid + ".txt");
const EVIDENCIA = path.join(os.tmpdir(), "evidencia-os52c4-artefato-" + process.pid);

/** O ALVO OFICIAL, invocado sem depender de shell nenhum.
 *
 *  Duas armadilhas, as duas pagas nesta OS:
 *
 *    1. `spawnSync("npm", …)` depende do PATH de quem chamou, e um shell de
 *       fundo pode não tê-lo — a primeira rodada morreu com `exit 127`
 *       ("comando não encontrado") logo depois de escrever o cabeçalho;
 *    2. apontar para `npm.cmd` sem `shell: true` devolve `status: null` no
 *       Windows, porque um `.cmd` não é executável para o `CreateProcess`.
 *
 *  A saída que não tem nenhuma das duas é chamar o `npm-cli.js` COM O PRÓPRIO
 *  Node: mesmo interpretador, caminho absoluto, sem shell no meio. E continua
 *  sendo o alvo oficial — `npm test` roda `pretest` e `test` exatamente como
 *  antes. Arnês que morre sem veredito é pior que arnês que reprova. */
const NPM_CLI = path.join(
  path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"
);

// ---------------------------------------------------------------------------
// FERRAMENTAL
// ---------------------------------------------------------------------------

function git(...args) {
  return cp.execFileSync("git", ["-C", RAIZ, ...args], { encoding: "utf8" });
}
const arvoreLimpa = () => git("status", "--porcelain", "-uall").trim() === "";
function restaurar() {
  git("reset", "--hard", "HEAD");
  git("clean", "-fd");
}
const emCrLf = (t) => t.split("\n").join("\r\n");

const arq = {
  escrever(rel, conteudo) {
    const destino = path.join(RAIZ, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, conteudo);
  },
  apagar(rel) {
    const alvo = path.join(RAIZ, rel);
    if (!fs.existsSync(alvo)) throw new Error("ANCORA INVALIDA: `" + rel + "` nao existe");
    fs.rmSync(alvo, { force: true });
  },
  trocar(rel, de, para) {
    const alvo = path.join(RAIZ, rel);
    const antes = fs.readFileSync(alvo, "utf8");
    let usar = de, usarPara = para;
    if (antes.split(de).length !== 2) { usar = emCrLf(de); usarPara = emCrLf(para); }
    const partes = antes.split(usar);
    if (partes.length !== 2) {
      throw new Error("ANCORA INVALIDA em " + rel + ": " + (partes.length - 1) +
        " ocorrencia(s) de <<" + de.slice(0, 70) + ">>");
    }
    const depois = partes.join(usarPara);
    if (depois === antes) throw new Error("ANCORA INVALIDA em " + rel + ": bytes iguais");
    fs.writeFileSync(alvo, depois);
  },
  /** Mutação de JSON pelo OBJETO. `scripts.test` tem aspas escapadas, e mexer
   *  nele por expressão regular grava um manifesto inválido — o `npm` morre
   *  antes de rodar e a campanha sai sem veredito. */
  json(rel, mutar) {
    const alvo = path.join(RAIZ, rel);
    const objeto = JSON.parse(fs.readFileSync(alvo, "utf8"));
    mutar(objeto);
    fs.writeFileSync(alvo, JSON.stringify(objeto, null, 2) + "\n");
  },
  /** Restaura um caminho de outra ref — é assim que o ZIP de `main` volta. */
  restaurarDe(ref, rel) {
    cp.execFileSync("git", ["-C", RAIZ, "checkout", ref, "--", rel], { stdio: "ignore" });
  },
};

// ---------------------------------------------------------------------------
// AS DUPLICATAS QUE O SCANNER NÃO VÊ
// ---------------------------------------------------------------------------
//
// Cada uma abre uma porta de verdade. Nenhuma tem `createServer(` nem
// `.listen(` em posição que uma expressão regular alcance.

const D = {
  colchetes: [
    "'use strict';",
    "const h = require('node:http');",
    "const s = h['createServer'](function (q, r) { r.end('viva'); });",
    "s['listen'](Number(process.env.PORT_DUP) || 9401);",
  ].join("\n"),

  concatenacao: [
    "'use strict';",
    "const h = require('node:http');",
    "const s = h['cre' + 'ateServer'](function (q, r) { r.end('viva'); });",
    "s['lis' + 'ten'](Number(process.env.PORT_DUP) || 9402);",
  ].join("\n"),

  vetor: [
    "'use strict';",
    "const nomes = ['createServer', 'listen'];",
    "const h = require('node:http');",
    "h[nomes[0]](function (q, r) { r.end('viva'); })[nomes[1]](Number(process.env.PORT_DUP) || 9403);",
  ].join("\n"),

  template: [
    "'use strict';",
    "const h = require('node:http');",
    "const parte = 'Server';",
    "const s = h[`create${parte}`](function (q, r) { r.end('viva'); });",
    "s[`list${'en'}`](Number(process.env.PORT_DUP) || 9404);",
  ].join("\n"),

  base64: [
    "'use strict';",
    "const d = (t) => Buffer.from(t, 'base64').toString('latin1');",
    "const h = require(d('bm9kZTpodHRw'));",
    "const s = h[d('Y3JlYXRlU2VydmVy')](function (q, r) { r.end('viva'); });",
    "s[d('bGlzdGVu')](Number(process.env.PORT_DUP) || 9405);",
  ].join("\n"),

  ingressoComputado: [
    "'use strict';",
    "const rotulo = ['entrar', 'Mesa'].join('');",
    "const lugares = new Map();",
    "const acoes = {};",
    "acoes[rotulo] = function (pedido) {",
    "  const livre = [2, 1, 3, 0].find((i) => !lugares.has(i));",
    "  if (livre === undefined) return { recusa: 'CHEIA' };",
    "  lugares['set'](livre, pedido);",
    "  return { lugar: livre };",
    "};",
    "module.exports = { acoes, lugares };",
  ].join("\n"),

  controleEmPonto: [
    "'use strict';",
    "const alvo = { modulo: 'node:net', fabrica: 'createServer', porta: 'listen' };",
    "const pilha = require(alvo.modulo);",
    "const canal = pilha[alvo.fabrica](function (c) { c.end('viva'); });",
    "canal[alvo.porta](Number(process.env.PORT_DUP) || 9407);",
  ].join("\n"),
};

const E = {
  novaFuncao: [
    "'use strict';",
    "const corpo = Buffer.from(",
    "  'cmV0dXJuIHJlcXVpcmUoIm5vZGU6aHR0cCIpLmNyZWF0ZVNlcnZlcigpLmxpc3Rlbig5NDA4KTs=',",
    "  'base64').toString('latin1');",
    "new Function(corpo)();",
  ].join("\n"),

  createRequire: [
    "'use strict';",
    "const { createRequire } = require('node:module');",
    "const meu = createRequire(__filename);",
    "const s = meu('node:http')['createServer']();",
    "s['listen'](9409);",
  ].join("\n"),

  reflect: [
    "'use strict';",
    "const h = require('node:http');",
    "const s = Reflect.get(h, ['create', 'Server'].join(''))();",
    "Reflect.get(s, 'listen').call(s, 9410);",
  ].join("\n"),

  netComputado: [
    "'use strict';",
    "const mapa = { a: 'node:net', b: 'createServer', c: 'listen' };",
    "const n = require(mapa['a']);",
    "const t = n[mapa['b']]();",
    "t[mapa['c']](9411);",
  ].join("\n"),

  parJsTxt: [
    "'use strict';",
    "const fs = require('node:fs');",
    "const carga = fs.readFileSync(__dirname + '/carga.txt', 'utf8');",
    "new Function(Buffer.from(carga, 'base64').toString('latin1'))();",
  ].join("\n"),
};

const CARGA_TXT =
  Buffer.from(
    'require("node:http").createServer().listen(9412);',
    "latin1"
  ).toString("base64");

// ---------------------------------------------------------------------------
// OS VETORES
// ---------------------------------------------------------------------------
//
// `porQuem` é o que separa "ficou vermelho" de "ficou vermelho pelo motivo
// certo". `artefato` exige que o laudo comece pela autoridade do artefato.

const VETORES = [
  // === F1 — SETE DUPLICATAS QUE O SCANNER NÃO VÊ ==========================
  { id: "F1-1", porQuem: "artefato", o_que: "duplicata por COLCHETES",
    aplicar: () => arq.escrever("dup/colchetes.js", D.colchetes) },
  { id: "F1-2", porQuem: "artefato", o_que: "duplicata por CONCATENACAO",
    aplicar: () => arq.escrever("dup/concat.js", D.concatenacao) },
  { id: "F1-3", porQuem: "artefato", o_que: "duplicata por VETOR de nomes",
    aplicar: () => arq.escrever("dup/vetor.js", D.vetor) },
  { id: "F1-4", porQuem: "artefato", o_que: "duplicata por TEMPLATE",
    aplicar: () => arq.escrever("dup/template.js", D.template) },
  { id: "F1-5", porQuem: "artefato", o_que: "duplicata por BASE64",
    aplicar: () => arq.escrever("dup/base64.js", D.base64) },
  { id: "F1-6", porQuem: "artefato", o_que: "ingresso/assento COMPUTADO",
    aplicar: () => arq.escrever("salas/computado.js", D.ingressoComputado) },
  { id: "F1-7", porQuem: "artefato", o_que: "controle em NOTACAO DE PONTO",
    aplicar: () => arq.escrever("dup/ponto.js", D.controleEmPonto) },

  // === F2 — CINCO EVASOES DINAMICAS =======================================
  { id: "F2-1", porQuem: "artefato", o_que: "`new Function` com carga em base64",
    aplicar: () => arq.escrever("dup/nova_funcao.js", E.novaFuncao) },
  { id: "F2-2", porQuem: "artefato", o_que: "`createRequire`",
    aplicar: () => arq.escrever("dup/create_require.js", E.createRequire) },
  { id: "F2-3", porQuem: "artefato", o_que: "`Reflect.get`",
    aplicar: () => arq.escrever("dup/reflect.js", E.reflect) },
  { id: "F2-4", porQuem: "artefato", o_que: "`net` com acesso computado",
    aplicar: () => arq.escrever("dup/net_computado.js", E.netComputado) },
  { id: "F2-5", porQuem: "artefato", o_que: "par `.js` + `.txt` com carga base64",
    aplicar: () => {
      arq.escrever("dup/par.js", E.parJsTxt);
      arq.escrever("dup/carga.txt", CARGA_TXT);
    } },

  // === F3 — OITO DESVIOS DE ARRANQUE ======================================
  { id: "F3-1", porQuem: "artefato", o_que: "`node server.js & node duplicata.js` no start",
    aplicar: () => arq.json("package.json", (o) => {
      o.scripts.start = "node server.js & node duplicata.js";
    }) },
  { id: "F3-2", porQuem: "artefato", o_que: "`npm run arrancar` indireto",
    aplicar: () => arq.json("package.json", (o) => {
      o.scripts.arrancar = "npm run start";
    }) },
  { id: "F3-3", porQuem: "artefato", o_que: "`node -e` num segundo script",
    aplicar: () => arq.json("package.json", (o) => {
      o.scripts.solto = "node -e \"require('./server.js')\"";
    }) },
  { id: "F3-4", porQuem: "artefato", o_que: "`node --eval` num segundo script",
    aplicar: () => arq.json("package.json", (o) => {
      o.scripts.solto = "node --eval \"1+1\"";
    }) },
  { id: "F3-5", porQuem: "artefato", o_que: "alvo `.mjs`",
    aplicar: () => arq.json("package.json", (o) => {
      o.scripts.moderno = "node servidor.mjs";
    }) },
  { id: "F3-6", porQuem: "artefato", o_que: "alvo SEM EXTENSAO",
    aplicar: () => arq.json("package.json", (o) => {
      o.scripts.subir = "node arranque";
    }) },
  { id: "F3-7", porQuem: "artefato", o_que: "SEGUNDO script invocando node contra o produtivo",
    aplicar: () => arq.json("package.json", (o) => {
      o.scripts.servir = "node server.js";
    }) },
  { id: "F3-8", porQuem: "artefato",
    o_que: "start alterado COM realinhamento simultaneo de CRED-34 e do manifesto",
    aplicar: () => {
      // A sabotagem coordenada: muda o start, realinha o `start_exato` do
      // manifesto para casar, e ainda mexe na regressao herdada. Se a autoridade
      // fosse o CRED-34, isto passaria.
      arq.json("package.json", (o) => { o.scripts.start = "node servidor_novo.js"; });
      arq.json("ci/artefato_produtivo.json", (o) => {
        o.start_exato = "node servidor_novo.js";
        o.produtivos = ["servidor_novo.js", "package.json"];
        o.artefato_final = ["servidor_novo.js", "package.json"];
      });
      arq.escrever("servidor_novo.js", D.colchetes);
    } },

  // === F4 — TRES NEUTRALIZACOES DA GUARDA =================================
  { id: "F4-1", porQuem: "qualquer", o_que: "apagar `ci/artefato.js`",
    aplicar: () => arq.apagar("ci/artefato.js") },
  { id: "F4-2", porQuem: "qualquer",
    o_que: "remover a CHAMADA do pretest, mantendo `require` e o texto",
    aplicar: () => arq.trocar("test/guarda_do_portao.js",
      "  const artefato = exigirArtefatoUnico();",
      "  const artefato = { produtivos: [], excluidos: 0, ancoras: 0 }; // exigirArtefatoUnico()") },
  { id: "F4-3", porQuem: "artefato",
    o_que: "incluir uma duplicata em `produtivos` e realinhar o manifesto",
    aplicar: () => {
      arq.escrever("duplicata.js", D.vetor);
      arq.json("ci/artefato_produtivo.json", (o) => {
        o.produtivos = ["server.js", "package.json", "duplicata.js"];
        o.artefato_final = ["server.js", "package.json", "duplicata.js"];
      });
    } },

  // === F5 — DOIS PACOTES CONCORRENTES =====================================
  { id: "F5-1", porQuem: "artefato",
    o_que: "restaurar `buraco-servidor.zip` de origin/main",
    aplicar: () => arq.restaurarDe("origin/main", "buraco-servidor.zip") },
  { id: "F5-2", porQuem: "artefato", o_que: "criar `sub/package.json`",
    aplicar: () => arq.escrever("sub/package.json",
      JSON.stringify({ name: "outro", scripts: { start: "node outro.js" } }, null, 2)) },

  // === CONTROLE POSITIVO ==================================================
  //
  // Sem ele, uma autoridade que reprovasse QUALQUER árvore passaria nos 25
  // negativos e não teria provado nada.
  { id: "OK-1", esperado: "VERDE", porQuem: "ninguem",
    o_que: "arquivo novo em caminho EXCLUIDO (docs/) continua verde",
    aplicar: () => arq.escrever("docs/NOTA-DE-CAMPANHA.md", "# nota\n\nsó texto.\n") },
];

// ---------------------------------------------------------------------------
// O ORACULO
// ---------------------------------------------------------------------------

function rodar(cmd, args, ms) {
  const r = cp.spawnSync(cmd, args, {
    cwd: RAIZ, encoding: "utf8", timeout: ms || 600000,
    shell: false,
    windowsHide: true,
  });
  const morreu = !!(r.error && r.error.code === "ETIMEDOUT") || !!r.signal;
  return { status: r.status, morreu, saida: String(r.stdout || "") + String(r.stderr || "") };
}

const MARCA_DO_ARTEFATO = /ARTEFATO PRODUTIVO VIOLADO|ARTEFATO VERMELHO|AUTORIDADE DO ARTEFATO/;
const MARCA_DA_CAPACIDADE = /SEGUNDO SERVIDOR NA ÁRVORE/;
const PALAVRAS_DE_CAPACIDADE = /createServer|\.listen\(|handshake|GUID|capacidade de servidor/i;

function portao() {
  const r = rodar(process.execPath, [NPM_CLI, "test"]);
  if (r.morreu) return { veredito: "INCONCLUSIVO", detalhe: "timeout ou sinal", saida: r.saida };
  return {
    veredito: r.status === 0 ? "VERDE" : "VERMELHO",
    detalhe: "npm exit " + r.status,
    saida: r.saida,
  };
}

/** De quem veio a recusa, e a mensagem fala de capacidade? */
function origemDa(saida) {
  const doArtefato = MARCA_DO_ARTEFATO.test(saida);
  const daCapacidade = MARCA_DA_CAPACIDADE.test(saida);
  const trecho = (/ARTEFATO PRODUTIVO VIOLADO[\s\S]{0,900}/.exec(saida) || [""])[0];
  return {
    quem: doArtefato ? "artefato" : daCapacidade ? "capacidade" : "outro",
    apelaParaCapacidade: doArtefato && PALAVRAS_DE_CAPACIDADE.test(trecho),
  };
}

// ---------------------------------------------------------------------------
// A CAMPANHA
// ---------------------------------------------------------------------------

function principal() {
  const args = process.argv.slice(2);
  if (args.includes("--listar")) {
    for (const v of VETORES) {
      console.log(v.id.padEnd(6), (v.esperado || "VERMELHO").padEnd(9), (v.porQuem || "-").padEnd(11), v.o_que);
    }
    console.log("total:", VETORES.length);
    return 0;
  }
  const i = args.indexOf("--so");
  const filtro = i >= 0 && args[i + 1] ? new Set(args[i + 1].split(",")) : null;

  const linhas = [];
  const anota = (s) => { linhas.push(s); process.stdout.write(s + "\n"); };

  if (!arvoreLimpa()) {
    process.stderr.write("ARVORE SUJA — o arnes recusa rodar.\n" + git("status", "--porcelain", "-uall"));
    return 2;
  }

  anota("# CAMPANHA OS 52-C4 · HEAD=" + git("rev-parse", "HEAD").trim());
  anota("# log: " + LOG);
  const inicial = portao();
  anota("# CONTROLE INICIAL (arvore integra): " + inicial.veredito + " · " + inicial.detalhe);

  const alvos = VETORES.filter((v) => !filtro || filtro.has(v.id));
  let ok = 0, divergentes = 0, inconclusivos = 0, ancoras = 0;

  for (const v of alvos) {
    if (!arvoreLimpa()) { anota("!! ARVORE SUJA antes de " + v.id + " — abortado"); break; }
    try {
      v.aplicar();
    } catch (e) {
      anota([v.id, "ANCORA-INVALIDA", "", v.o_que, String(e.message).slice(0, 150)].join(" | "));
      ancoras++;
      restaurar();
      continue;
    }
    const r = portao();
    const esperado = v.esperado || "VERMELHO";
    const origem = origemDa(r.saida);
    let classe;
    if (r.veredito === "INCONCLUSIVO") { classe = "INCONCLUSIVO"; inconclusivos++; }
    else if (r.veredito !== esperado) {
      classe = esperado === "VERMELHO" ? "**ESCAPE**" : "**FALSO-POSITIVO**";
      divergentes++;
    } else if (esperado === "VERMELHO" && v.porQuem === "artefato" && origem.quem !== "artefato") {
      classe = "**MOTIVO-ERRADO(" + origem.quem + ")**";
      divergentes++;
    } else if (esperado === "VERMELHO" && v.porQuem === "artefato" && origem.apelaParaCapacidade) {
      classe = "**MENSAGEM-POR-CAPACIDADE**";
      divergentes++;
    } else { classe = "OK"; ok++; }
    anota([v.id, r.veredito, classe, v.o_que,
           r.detalhe + " · recusa por " + origem.quem].join(" | "));
    restaurar();
  }

  const final = portao();
  anota("# CONTROLE FINAL (arvore integra): " + final.veredito + " · " + final.detalhe);
  anota("# PLACAR: conforme=" + ok + " · divergente=" + divergentes +
        " · inconclusivo=" + inconclusivos + " · ancora-invalida=" + ancoras +
        " · total=" + alvos.length);
  anota("# arvore limpa ao final: " + arvoreLimpa());

  fs.writeFileSync(LOG, linhas.join("\n") + "\n");
  const bruto = fs.readFileSync(LOG);
  const semNul = Buffer.from(bruto.filter((b) => b !== 0));
  anota("# INTEGRIDADE DO LOG: bruto=" + bruto.length + " sem-NUL=" + semNul.length +
        (bruto.length === semNul.length ? " (ok)" : " (INVALIDO: ha NUL no log)"));

  const valido = inicial.veredito === "VERDE" && final.veredito === "VERDE" &&
    bruto.length === semNul.length;
  if (!valido) process.stderr.write("\nPLACAR INVALIDO: controle de integridade ou log corrompido.\n");
  return divergentes === 0 && inconclusivos === 0 && ancoras === 0 && valido ? 0 : 1;
}

if (require.main === module) process.exit(principal());

module.exports = { VETORES, D, E, CARGA_TXT, portao, origemDa, arq };
