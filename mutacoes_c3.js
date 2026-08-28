// ===========================================================================
// CAMPANHA NEGATIVA DA OS 52-C3 — CAPACIDADE COMPOSTA DA ÁRVORE.
//
// A pergunta que esta campanha responde é a única que importa sobre uma guarda
// nova: ELA PEGA ALGUMA COISA? A OS 52-C2 tinha catálogo, prova externa e juiz,
// e mesmo assim uma duplicata implantável partida em DOIS arquivos subiu de
// verdade, respondeu HTTP 200 numa porta isolada e atravessou `npm test`, o
// juiz e o pipeline inteiros. Texto bonito não guarda nada; medição guarda.
//
// Cada vetor é INJETADO na árvore de trabalho, julgado pelo PORTÃO OFICIAL
// (`npm test`, e para os vetores de encolhimento também `ci/portao_do_ci.js`
// sobre a evidência real), e a árvore é restaurada antes do vetor seguinte.
//
// ---------------------------------------------------------------------------
// HIGIENE DO ARNÊS — o que a OS 52-R2 mandou consertar
// ---------------------------------------------------------------------------
//
// A R2 registrou corrupção de log causada por LAÇO DE FUNDO SOBREVIVENTE. Este
// arnês não tem laço de fundo: cada execução é `spawnSync`, síncrona, e o
// processo só continua quando o filho terminou. Não há PID de wrapper para
// matar porque não há wrapper — e é por isso que não existe `pkill` aqui.
//
// As travas, todas parando a campanha em vez de mentir:
//
//   1. ÁRVORE SUJA é recusa: `git status --porcelain -uall` tem de estar vazio
//      no início, entre vetores e no fim;
//   2. ÂNCORA INVÁLIDA para a campanha: a âncora tem de aparecer EXATAMENTE
//      uma vez, e o arquivo tem de mudar de bytes depois da troca;
//   3. TIMEOUT e SINAL são INCONCLUSIVO, nunca detecção;
//   4. CONTROLE DE INTEGRIDADE roda no começo e no fim: a árvore íntegra tem
//      de sair VERDE nas duas pontas, senão o placar inteiro é inválido;
//   5. o log é gravado em ARQUIVO NOVO a cada rodada, e o tamanho bruto é
//      comparado com o tamanho sem NUL — divergência invalida o log;
//   6. mutação de JSON é feita no OBJETO, nunca por expressão regular sobre o
//      texto: `scripts.test` tem aspas escapadas, e trocá-lo por regex grava um
//      manifesto inválido (a C2 pagou uma rodada inteira por isso).
//
// A árvore está em CRLF (`core.autocrlf=true`). As âncoras são escritas em LF
// e convertidas quando não casarem — âncora que casa por engano é mutação cega.
//
// Uso:
//   node mutacoes_c3.js                  # campanha inteira
//   node mutacoes_c3.js --so E1,E6,FRG-A # só estes vetores
//   node mutacoes_c3.js --listar         # só lista os vetores
//   node mutacoes_c3.js --secar          # só confere as âncoras, numa cópia
// ===========================================================================
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const RAIZ = __dirname;
const LOG = path.join(os.tmpdir(), "campanha-os52c3-" + process.pid + ".txt");
const EVIDENCIA = path.join(os.tmpdir(), "evidencia-os52c3-" + process.pid);

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
    if (!fs.existsSync(alvo)) throw new Error("ANCORA INVALIDA: `" + rel + "` nao existe para apagar");
    fs.rmSync(alvo, { force: true });
  },
  /** Substituição ANCORADA: uma ocorrência, e os bytes têm de mudar. */
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
    if (depois === antes) throw new Error("ANCORA INVALIDA em " + rel + ": os bytes nao mudaram");
    fs.writeFileSync(alvo, depois);
  },
  /** Mutação de JSON pelo OBJETO. Nunca por regex — ver a nota da higiene. */
  json(rel, mutar) {
    const alvo = path.join(RAIZ, rel);
    const objeto = JSON.parse(fs.readFileSync(alvo, "utf8"));
    mutar(objeto);
    fs.writeFileSync(alvo, JSON.stringify(objeto, null, 2) + "\n");
  },
};

// ---------------------------------------------------------------------------
// [OS 54-C7] ÂNCORAS DERIVADAS DO ESTADO ATUAL
// ---------------------------------------------------------------------------
//
// A OS 54-R6 encontrou vetores desta campanha que tinham DEIXADO DE EXECUTAR:
// `E6` trazia a linha do censo com o número e o comentário de uma OS antiga, e
// `PIS-D` e `REC-B` traziam `CASOS_MEDIDOS_NA_BASE = 883`, que já estava
// obsoleto na própria base da C6. Vetor que morre por âncora não mede nada —
// ele some do placar parecendo cobertura.
//
// A regra: nada de valor histórico literal. O que a árvore pode mudar sozinha é
// LIDO da árvore, e a substituição continua conferida por `arq.trocar`, que
// exige uma ocorrência e bytes diferentes.

/** A linha inteira que declara o piso de uma suíte no censo — número e
 *  comentário de HOJE, quaisquer que sejam. */
function linhaDoCenso(arquivo) {
  const texto = fs.readFileSync(path.join(RAIZ, "test/censo_de_suites.js"), "utf8")
    .split("\r\n").join("\n");
  const re = new RegExp('^\\s*"' + arquivo.replace(/\./g, "\\.") + '":\\s*\\d+,.*$', "m");
  const m = re.exec(texto);
  if (!m) throw new Error("ANCORA INVALIDA: o censo nao declara `" + arquivo + "`");
  return m[0] + "\n";
}

/** A declaração de HOJE de uma constante do piso do piso. */
function constanteDoPisoDoPiso(nome) {
  const texto = fs.readFileSync(path.join(RAIZ, "test/ci_obrigatorio.test.js"), "utf8");
  const m = new RegExp("const\\s+" + nome + "\\s*=\\s*(\\d+)\\s*;").exec(texto);
  if (!m) throw new Error("ANCORA INVALIDA: `" + nome + "` nao existe na suite do CI");
  return { linha: "const " + nome + " = " + m[1] + ";", valor: Number(m[1]) };
}

// ---------------------------------------------------------------------------
// PEÇAS DE SABOTAGEM
// ---------------------------------------------------------------------------
//
// Escritas do zero: nenhuma copia trecho do bundle. É esse o ponto — a guarda
// não pode procurar o servidor QUE EXISTE, e sim a capacidade de ser um.

const P = {
  cria: [
    "'use strict';",
    "const http = require('node:http');",
    "const alvo = http.createServer((req, res) => res.end('fragmento'));",
    "module.exports = { alvo };",
  ].join("\n"),

  escuta: (rel) => [
    "'use strict';",
    "const { alvo } = require('" + rel + "');",
    "const cfg = { p: 9301 };",
    "alvo.listen(cfg.p);",
  ].join("\n"),

  repassa: (rel) => [
    "'use strict';",
    "const { alvo } = require('" + rel + "');",
    "module.exports = { alvo };",
  ].join("\n"),

  criaSolto: [
    "'use strict';",
    "const http = require('node:http');",
    "globalThis.__alvo = http.createServer((q, r) => r.end('solto'));",
  ].join("\n"),

  escutaSolta: [
    "'use strict';",
    "const cfg = { p: 9302 };",
    "globalThis.__alvo.listen(cfg.p);",
  ].join("\n"),

  aliasListen: [
    "'use strict';",
    "const { alvo } = require('./cria.js');",
    "const cfg = { p: 9303 };",
    "const abrir = alvo.listen;",
    "abrir.call(alvo, cfg.p);",
  ].join("\n"),

  criaSoquete: [
    "'use strict';",
    "const dgram = require('node:dgram');",
    "const canal = dgram.createSocket('udp4');",
    "module.exports = { canal };",
  ].join("\n"),

  aliasBind: [
    "'use strict';",
    "const { canal } = require('./canal.js');",
    "const vincular = canal.bind;",
    "vincular.call(canal, 41998);",
  ].join("\n"),

  udpInteiro: [
    "'use strict';",
    "const dgram = require('node:dgram');",
    "const canal = dgram.createSocket('udp4');",
    "canal.on('message', (m, r) => canal.send('pong', r.port, r.address));",
    "canal.bind(Number(process.env.PORT_UDP) || 41234);",
  ].join("\n"),

  wssNovo: [
    "'use strict';",
    "const { WebSocketServer } = require('ws');",
    "const wss = new WebSocketServer({ port: Number(process.env.PORT) || 8392 });",
    "wss.on('connection', (c) => c.send('ok'));",
  ].join("\n"),

  wssFabrica: [
    "'use strict';",
    "const { WebSocketServer } = require('ws');",
    "const wss = WebSocketServer({ port: 8393, perMessageDeflate: false });",
    "wss.on('connection', (c) => c.close());",
  ].join("\n"),

  appListen: [
    "'use strict';",
    "const express = require('express');",
    "const app = express();",
    "app.get('/', (q, r) => r.send('ok'));",
    "app.listen(3311);",
  ].join("\n"),

  upgradeExecutavel: [
    "'use strict';",
    "const http = require('node:http');",
    "const alvo = http.createServer();",
    "alvo.on('upgrade', (req, soquete) => {",
    "  const chave = req.headers['sec-websocket-key'];",
    "  soquete.write('HTTP/1.1 101\\r\\nSec-WebSocket-Accept: ' + chave + '\\r\\n\\r\\n');",
    "});",
    "alvo.listen(cfgDaPorta);",
  ].join("\n"),

  upgradeSoString: [
    "'use strict';",
    "const EVENTOS = ['upgrade', 'connection', 'close'];",
    "const CABECALHO = 'Sec-WebSocket-Accept';",
    "module.exports = { EVENTOS, CABECALHO };",
  ].join("\n"),

  assentoPorMapa: [
    "'use strict';",
    "const lugares = new Map();",
    "function entrarMesa({ codigo, apelido }) {",
    "  for (const s of [2, 1, 3, 0]) {",
    "    if (!lugares.has(s)) { lugares.set(s, { apelido, codigo }); return { ok: true, lugar: s }; }",
    "  }",
    "  return { ok: false, motivo: 'mesa cheia' };",
    "}",
    "module.exports = { entrarMesa, lugares };",
  ].join("\n"),

  assentoPorObjeto: [
    "'use strict';",
    "const entrarMesa = function (pedido) {",
    "  const livre = procurarLivre(pedido.codigo);",
    "  if (livre === null) return { recusa: 'MESA_CHEIA' };",
    "  return { assento: livre, confirmado: true };",
    "};",
    "module.exports = { entrarMesa };",
  ].join("\n"),

  assentoPorAuxiliar: [
    "'use strict';",
    "function assentarJogador(mesa, indice, jogador) {",
    "  mesa.lugares[indice] = { apelido: jogador.apelido, jogadorId: jogador.id };",
    "}",
    "const entrarMesa = (p) => assentarJogador(p.mesa, p.indice, p.jogador);",
    "module.exports = { entrarMesa, assentarJogador };",
  ].join("\n"),

  despachoComAssento: [
    "'use strict';",
    "function despachar(mensagem, sala) {",
    "  switch (mensagem.tipo) {",
    "    case 'entrarMesa': {",
    "      sala.assentos[mensagem.assento] = { apelido: mensagem.apelido };",
    "      return { tipo: 'entrou', assento: mensagem.assento };",
    "    }",
    "    default:",
    "      return { tipo: 'erro' };",
    "  }",
    "}",
    "module.exports = { despachar };",
  ].join("\n"),
};

// O nome do módulo do bundle é montado, para que este arquivo não carregue o
// sinal bruto que ele existe para testar.
const MODULO = "ws" + "_server";
P.arranqueSublinhado = [
  "ENTREGA DO TRANSPORTE — arranque alternativo do bundle.",
  "",
  '__require("' + MODULO + '").iniciar();',
  "",
  "Fim.",
].join("\n");
P.arranqueRequire = ['"use strict";', 'require("' + MODULO + '").iniciar();'].join("\n");
P.arranqueAuxiliar = [
  '"use strict";',
  "function subirTransporte() {",
  '  return __require("' + MODULO + '").iniciar({ porta: 8080 });',
  "}",
  "subirTransporte();",
].join("\n");

const GUID = ["258EAFA5", "E914", "47DA", "95CA", "C5AB0DC85B11"].join("-");
P.prosaComTudo = [
  "# Nota de arquitetura",
  "",
  "O transporte responde ao upgrade com Sec-WebSocket-Accept, derivado da chave",
  "do cliente e do GUID do RFC 6455 (" + GUID + ").",
  "O despachante trata entrarMesa, o modulo " + MODULO + " faz o listen na porta",
  "de process.env.PORT e os assentos ficam em assentos[i]. Nada disto executa.",
].join("\n");

// Pacotes sintéticos, com bytes de verdade.
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function zipCom(nomeInterno, dados) {
  const nome = Buffer.from(nomeInterno, "latin1");
  const corpo = Buffer.from(dados, "latin1");
  const crc = crc32(corpo);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(corpo.length, 18);
  local.writeUInt32LE(corpo.length, 22); local.writeUInt16LE(nome.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(corpo.length, 20);
  central.writeUInt32LE(corpo.length, 24); central.writeUInt16LE(nome.length, 28);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(1, 8); fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nome.length, 12);
  fim.writeUInt32LE(local.length + nome.length + corpo.length, 16);
  return Buffer.concat([local, nome, corpo, central, nome, fim]);
}
const MAGIC_XZ = Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]);
const TAR_COM = (nome) => {
  const c = Buffer.alloc(512, 0);
  c.write(nome, 0, "latin1");
  c.write("0000644\0", 100, "latin1");
  c.write("00000000000\0", 124, "latin1");
  c.write("ustar\0", 257, "latin1");
  c.write("00", 263, "latin1");
  return Buffer.concat([c, Buffer.alloc(1024, 0)]);
};
const PNG_LEGITIMO = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64),
]);

// ---------------------------------------------------------------------------
// OS VETORES
// ---------------------------------------------------------------------------
//
// `esperado` é o veredito do PORTÃO: `VERMELHO` para sabotagem que tem de ser
// pega, `VERDE` para o que é legítimo e não pode reprovar. `juiz: true` roda
// também `ci/portao_do_ci.js` sobre a evidência real da execução.

const VETORES = [
  // === OS SEIS VETORES OBRIGATÓRIOS DA OS 52-R2 ===========================
  { id: "E1", o_que: "servidor fragmentado: criacao num arquivo e `.listen()` noutro",
    aplicar: () => { arq.escrever("dup/nucleo.js", P.cria); arq.escrever("dup/arranque.js", P.escuta("./nucleo.js")); } },
  { id: "E2", o_que: "segundo arranque real do bundle em arquivo textual (`__require`)",
    aplicar: () => arq.escrever("docs/ENTREGA-TRANSPORTE.txt", P.arranqueSublinhado) },
  { id: "E3", o_que: "`new WebSocketServer({port})` sem `.listen()`",
    aplicar: () => arq.escrever("ponte_ws.js", P.wssNovo) },
  { id: "E4", o_que: "ingresso/assento implementado por `Map`",
    aplicar: () => arq.escrever("salas/ingresso.js", P.assentoPorMapa) },
  { id: "E5", o_que: "servidor UDP com `dgram.createSocket().bind()`",
    aplicar: () => arq.escrever("udp/eco.js", P.udpInteiro) },
  { id: "E6", juiz: true,
    o_que: "encolhimento coordenado: suite removida, censo, alcance, limiar e piso realinhados",
    aplicar: () => {
      arq.apagar("test/ci_obrigatorio.test.js");
      arq.trocar("test/censo_de_suites.js", linhaDoCenso("ci_obrigatorio.test.js"), "");
      arq.trocar("test/prova_da_unicidade.js",
        '  "test/ci_obrigatorio.test.js": {\n' +
        '    porque: "guarda o CI externo e o piso do portão",\n' +
        '    exige: "portao_do_ci",\n' +
        "  },\n", "");
      arq.trocar("test/prova_da_unicidade.js", "suitesAlcancadas.length >= 5", "suitesAlcancadas.length >= 4");
      arq.json("ci/piso_do_portao.json", (o) => {
        o.casos_minimos = 820; o.suites_minimas = 87;
        o.medido_na_arvore_desta_os = { casos: 820, suites: 87 };
      });
    } },

  // === FRAGMENTAÇÃO (campanha §1–§5) ======================================
  { id: "FRG-A", o_que: "fragmentacao em dois arquivos no MESMO diretorio",
    aplicar: () => { arq.escrever("frg/cria.js", P.cria); arq.escrever("frg/sobe.js", P.escuta("./cria.js")); } },
  { id: "FRG-B", o_que: "fragmentacao em diretorios DISTINTOS",
    aplicar: () => { arq.escrever("nucleo/srv.js", P.cria); arq.escrever("arranque/sobe.js", P.escuta("../nucleo/srv.js")); } },
  { id: "FRG-C", o_que: "fragmentacao em TRES arquivos",
    aplicar: () => {
      arq.escrever("t1/cria.js", P.cria);
      arq.escrever("t2/repassa.js", P.repassa("../t1/cria.js"));
      arq.escrever("t3/sobe.js", P.escuta("../t2/repassa.js"));
    } },
  { id: "FRG-D", o_que: "criacao exportada por `module.exports`",
    aplicar: () => { arq.escrever("exp/fonte.js", P.cria + "\nexports.alvo = alvo;\n"); arq.escrever("exp/usa.js", P.escuta("./fonte.js")); } },
  { id: "FRG-E", o_que: "criacao importada por destructuring, sem ligacao declarada",
    aplicar: () => { arq.escrever("solto/cria.js", P.criaSolto); arq.escrever("outro/lugar/sobe.js", P.escutaSolta); } },

  // === ALIAS (campanha §6–§7) =============================================
  { id: "ALI-A", o_que: "alias de `.listen`, chamado por `call`",
    aplicar: () => { arq.escrever("ali/cria.js", P.cria); arq.escrever("ali/sobe.js", P.aliasListen); } },
  { id: "ALI-B", o_que: "alias de `.bind` sobre soquete de datagrama",
    aplicar: () => { arq.escrever("eco/canal.js", P.criaSoquete); arq.escrever("eco/vincula.js", P.aliasBind); } },

  // === PORTAS SEM `.listen()` (campanha §8–§10) ===========================
  { id: "POR-A", o_que: "`WebSocketServer({port})` por fabrica, sem `new`",
    aplicar: () => arq.escrever("fab_ws.js", P.wssFabrica) },
  { id: "POR-B", o_que: "`app.listen(3311)`",
    aplicar: () => arq.escrever("web/app.js", P.appListen) },
  { id: "UDP-A", o_que: "servidor UDP por `dgram`",
    aplicar: () => arq.escrever("udp2/eco.js", P.udpInteiro) },

  // === ARRANQUE (campanha §11–§13) ========================================
  { id: "ARR-A", o_que: "arranque por `__require`",
    aplicar: () => arq.escrever("infra/entrega.txt", P.arranqueSublinhado) },
  { id: "ARR-B", o_que: "arranque por `require`",
    aplicar: () => arq.escrever("infra/sobe.js", P.arranqueRequire) },
  { id: "ARR-C", o_que: "arranque dividido por auxiliar",
    aplicar: () => arq.escrever("infra/subir.js", P.arranqueAuxiliar) },

  // === HANDSHAKE E UPGRADE (campanha §14–§16) =============================
  { id: "UPG-A", o_que: "upgrade EXECUTAVEL com cabecalho de handshake",
    aplicar: () => arq.escrever("ponte_upg.js", P.upgradeExecutavel) },
  { id: "UPG-B", esperado: "VERDE", o_que: "upgrade somente em STRING, sem execucao",
    aplicar: () => arq.escrever("constantes/eventos.js", P.upgradeSoString) },
  { id: "HSK-A", esperado: "VERDE", o_que: "handshake somente em PROSA",
    aplicar: () => arq.escrever("docs/handshake-explicado.md",
      "# Handshake\n\nO servidor responde ao upgrade com `Sec-WebSocket-Accept`,\n" +
      "derivado da chave do cliente e do GUID do RFC 6455.\n") },

  // === ASSENTO (campanha §17–§19) =========================================
  { id: "ASS-A", o_que: "assento por `Map`",
    aplicar: () => arq.escrever("salas2/mapa.js", P.assentoPorMapa) },
  { id: "ASS-B", o_que: "assento por objeto devolvido, com recusa tipada",
    aplicar: () => arq.escrever("salas2/objeto.js", P.assentoPorObjeto) },
  { id: "ASS-C", o_que: "assento por funcao auxiliar",
    aplicar: () => arq.escrever("salas2/auxiliar.js", P.assentoPorAuxiliar) },
  { id: "DES-A", o_que: "despachante com `case 'entrarMesa'` que senta o jogador",
    aplicar: () => arq.escrever("despacho/central.js", P.despachoComAssento) },

  // === NEUTRALIZAÇÃO DA PRÓPRIA GUARDA (campanha §20–§24, §35) ============
  { id: "CEN-A", o_que: "cenario que cobre ramo exclusivo apontado para id inexistente",
    aplicar: () => arq.trocar("test/fixtures_de_unicidade.js", '"DATAGRAMA": "UDP-01",', '"DATAGRAMA": "NAO-EXISTE",') },
  { id: "RAM-A", o_que: "neutralizacao individual do ramo DATAGRAMA",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "quando: (s) => s.criaSoquete && s.vinculaPorta,", "quando: (s) => s && false,") },
  { id: "RAM-B", o_que: "neutralizacao individual do ramo REDE",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "quando: (s) => s.criaServidor && s.escuta,", "quando: (s) => s && false,") },
  { id: "RAM-C", o_que: "neutralizacao individual do ramo ARRANQUE",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "quando: (s) => s.arranqueChamado && s.mencionaModuloDoBundle,", "quando: (s) => s && false,") },
  { id: "CMP-A", o_que: "a decisao COMPOSTA desligada (retorno constante vazio)",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "function capacidadesCompostas(resumos) {",
      "function capacidadesCompostas(resumos) {\n  if (resumos) return [];") },
  { id: "OCA-A", o_que: "retorno constante de capacidades vazias",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "function capacidadesDe(sinais, escopo) {",
      "function capacidadesDe(sinais, escopo) {\n  if (sinais) return [];") },
  { id: "VET-A", o_que: "analisador que REPROVA tudo",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "function capacidadesDe(sinais, escopo) {",
      'function capacidadesDe(sinais, escopo) {\n  if (sinais) return [{ ramo: "REDE", texto: "tudo e servidor" }];') },
  { id: "CAT-A", o_que: "catalogo esvaziado",
    aplicar: () => arq.trocar("test/fixtures_de_unicidade.js",
      "function catalogo(fonteDoPortador) {",
      "function catalogo(fonteDoPortador) {\n  if (fonteDoPortador) return [];") },
  // MUTANTE EQUIVALENTE, e declarado como tal. Tirar a afirmacao "todo ramo
  // disparou" de uma arvore INTEGRA nao deixa de detectar nada: todos os ramos
  // disparam mesmo. Sobreviver aqui nao e escapar — e nao haver o que pegar.
  // O par acoplado abaixo (PRV-A2) e que mede a defesa de verdade.
  { id: "PRV-A", esperado: "VERDE",
    nota: "mutante equivalente: defesa removida sem violacao na arvore",
    o_que: "afirmacao 'todo ramo disparou' neutralizada, SEM ramo morto",
    aplicar: () => arq.trocar("test/prova_da_unicidade.js",
      "  const observados = new Set(resultados.flatMap((r) => r.ramos));",
      "  const observados = new Set(unicidade.IDS_DOS_RAMOS);") },
  { id: "PRV-A2", o_que: "afirmacao 'todo ramo disparou' neutralizada + ramo DATAGRAMA morto",
    aplicar: () => {
      arq.trocar("test/prova_da_unicidade.js",
        "  const observados = new Set(resultados.flatMap((r) => r.ramos));",
        "  const observados = new Set(unicidade.IDS_DOS_RAMOS);");
      arq.trocar("test/unicidade_do_portador.js",
        "quando: (s) => s.criaSoquete && s.vinculaPorta,", "quando: (s) => s && false,");
    } },
  { id: "PRV-B", o_que: "laco do cenario exclusivo neutralizado + ramo DATAGRAMA morto",
    aplicar: () => {
      arq.trocar("test/prova_da_unicidade.js",
        "  for (const [ramo, cenario] of Object.entries(fixtures.RAMO_EXERCITADO_POR)) {",
        "  for (const [ramo, cenario] of []) {");
      arq.trocar("test/unicidade_do_portador.js",
        "quando: (s) => s.criaSoquete && s.vinculaPorta,", "quando: (s) => s && false,");
    } },
  { id: "PRV-C", o_que: "as DUAS afirmacoes de cobertura neutralizadas + ramo DATAGRAMA morto",
    aplicar: () => {
      arq.trocar("test/prova_da_unicidade.js",
        "  const observados = new Set(resultados.flatMap((r) => r.ramos));",
        "  const observados = new Set(unicidade.IDS_DOS_RAMOS);");
      arq.trocar("test/prova_da_unicidade.js",
        "  for (const [ramo, cenario] of Object.entries(fixtures.RAMO_EXERCITADO_POR)) {",
        "  for (const [ramo, cenario] of []) {");
      arq.trocar("test/unicidade_do_portador.js",
        "quando: (s) => s.criaSoquete && s.vinculaPorta,", "quando: (s) => s && false,");
    } },
  { id: "REC-A", o_que: "varredura deixa de ser recursiva",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "if (st.isDirectory()) listarArquivos(caminho, relativo, saida);",
      "if (st.isDirectory()) { /* nao desce */ }") },

  // === PROFUNDIDADE E PACOTES (campanha §26–§29) ==========================
  { id: "PRF-A", o_que: "arquivo alem de uma profundidade (seis niveis)",
    aplicar: () => arq.escrever("n1/n2/n3/n4/n5/n6/oculto.js", P.cria + "\nalvo.listen(7777);\n") },
  { id: "PAC-A", o_que: "pacote RENOMEADO (ZIP com nome `.md`)",
    aplicar: () => arq.escrever("docs/leia-me-tambem.md", zipCom("server.js", "x")) },
  { id: "PAC-B", o_que: "pacote SEM EXTENSAO (TAR pelo byte 257)",
    aplicar: () => arq.escrever("entrega", TAR_COM("server.js")) },
  { id: "PAC-C", o_que: "compactado TRUNCADO (XZ cortado)",
    aplicar: () => arq.escrever("notas.txt", MAGIC_XZ.slice(0, 6)) },

  // === GLOB, PRETEST E PISOS (campanha §30–§32) ==========================
  { id: "GLB-A", o_que: "desvio do glob para suite-isca",
    aplicar: () => {
      arq.escrever("test/isca.test.js",
        'const test = require("node:test");\ntest("isca", () => {});\n');
      arq.json("package.json", (o) => { o.scripts.test = "node --test test/isca.test.js"; });
    } },
  { id: "PRE-A", o_que: "remocao do `pretest`",
    aplicar: () => arq.json("package.json", (o) => { delete o.scripts.pretest; }) },
  { id: "PIS-A", o_que: "rebaixamento do piso de CASOS",
    aplicar: () => arq.json("ci/piso_do_portao.json", (o) => { o.casos_minimos = 700; }) },
  { id: "PIS-B", o_que: "rebaixamento do piso de SUITES",
    aplicar: () => arq.json("ci/piso_do_portao.json", (o) => { o.suites_minimas = 80; }) },
  { id: "PIS-C", o_que: "rebaixamento de um piso POR SUITE",
    aplicar: () => arq.trocar("test/censo_de_suites.js",
      '"gate_vip.test.js": 64,', '"gate_vip.test.js": 58,') },
  // [OS 54-C7] RECONSTITUÍDO. A propriedade continua existindo — o piso do piso
  // ainda mora na suíte do CI —, e o que estava obsoleto era só o literal `883`.
  { id: "PIS-D", o_que: "rebaixamento do piso do piso (CI-13) na suite do CI",
    aplicar: () => arq.trocar("test/ci_obrigatorio.test.js",
      constanteDoPisoDoPiso("CASOS_MEDIDOS_NA_BASE").linha, "const CASOS_MEDIDOS_NA_BASE = 700;") },
  { id: "PIS-E", o_que: "entrada do censo APAGADA para uma suite obrigatoria",
    aplicar: () => arq.trocar("test/censo_de_suites.js",
      '  "gate_vip.test.js": 64,\n', "") },

  // === RECARIMBO COORDENADO E AUTORIDADE DO PISO (campanha §34) ==========
  { id: "REC-B", juiz: true,
    o_que: "recarimbo coordenado de TODOS os numeros editaveis, de uma vez",
    aplicar: () => {
      arq.json("ci/piso_do_portao.json", (o) => {
        o.casos_minimos = 600; o.suites_minimas = 70;
        o.medido_na_arvore_desta_os = { casos: 600, suites: 70 };
      });
      arq.trocar("test/ci_obrigatorio.test.js",
        constanteDoPisoDoPiso("CASOS_MEDIDOS_NA_BASE").linha, "const CASOS_MEDIDOS_NA_BASE = 600;");
      arq.trocar("test/ci_obrigatorio.test.js",
        constanteDoPisoDoPiso("SUITES_MEDIDAS_NA_BASE").linha, "const SUITES_MEDIDAS_NA_BASE = 70;");
    } },
  { id: "AUT-A", o_que: "a AUTORIDADE do piso ancorado e apagada do disco",
    aplicar: () => arq.apagar("test/piso_ancorado.js") },
  { id: "AUT-B", o_que: "a CHAMADA do piso ancorado e removida do censo",
    aplicar: () => arq.trocar("test/censo_de_suites.js",
      '  const { conferirPisoAncorado, conferirAmarracao } = require("./piso_ancorado.js");',
      "  const conferirPisoAncorado = () => {};\n  const conferirAmarracao = () => 0;") },
  { id: "AUT-C", o_que: "a comparacao com o commit anterior vira corpo trivial",
    aplicar: () => arq.trocar("test/piso_ancorado.js",
      "function conferirPisoAncorado(raizDoRepo) {",
      "function conferirPisoAncorado(raizDoRepo) {\n  if (raizDoRepo || true) return { ancoras: [], comparacoes: 0, agora: {}, passado: [] };") },

  // === ISCA E POSITIVOS LEGÍTIMOS (campanha §36–§39) =====================
  { id: "ISC-A", o_que: "isca com titulos e corpos triviais no lugar da suite de unicidade",
    aplicar: () => {
      const corpo = ['const test = require("node:test");'];
      for (let i = 1; i <= 60; i++) corpo.push('test("UNI-' + i + ': parece uma prova", () => {});');
      arq.escrever("test/unicidade_do_portador.test.js", corpo.join("\n") + "\n");
    } },
  { id: "PRO-A", esperado: "VERDE", o_que: "prosa contendo TODOS os tokens sensiveis",
    aplicar: () => arq.escrever("docs/arquitetura-do-transporte.md", P.prosaComTudo) },
  { id: "LEG-A", esperado: "VERDE", o_que: "arquivo legitimo de tipo desconhecido",
    aplicar: () => arq.escrever("ferramenta/config.yml", "versao: 3\nopcoes:\n  - manter\n") },
  { id: "PNG-A", esperado: "VERDE", o_que: "binario legitimo que NAO e pacote (PNG)",
    aplicar: () => arq.escrever("marca/logo.png", PNG_LEGITIMO) },
  { id: "MEI-A", esperado: "VERDE", o_que: "peca de criacao SOZINHA, sem escuta em lugar nenhum",
    aplicar: () => arq.escrever("meia/peca.js", P.cria) },

  // === OS NOVE VETORES DA OS 52-R1, PRESERVADOS ==========================
  //
  // O laudo da R1 não está disponível nesta sessão, e a C2 já havia registrado
  // que o mapa rótulo→vetor era INFERIDO da descrição dos requisitos. A C3
  // preserva a SUBSTÂNCIA de cada um e mantém a inferência declarada — ver o
  // documento da OS 52-C3, seção "Residuais".
  { id: "M06b", o_que: "[R1] segundo servidor com nomes inteiramente novos (http)",
    aplicar: () => arq.escrever("servico/entrega.js",
      "const http = require('node:http');\nhttp.createServer((q, r) => r.end('ok')).listen(process.env.PORT || 3000);\n") },
  { id: "M06c", o_que: "[R1] servidor em `net.createServer`, em subpasta",
    aplicar: () => arq.escrever("um/dois/tomada.js",
      "const net = require('node:net');\nnet.createServer((c) => c.end()).listen(4000);\n") },
  { id: "M06d", o_que: "[R1] servidor em `https.createServer`",
    aplicar: () => arq.escrever("seguro.js",
      "const https = require('node:https');\nhttps.createServer({}, (q, r) => r.end()).listen(8443);\n") },
  { id: "M08b", o_que: "[R1] ZIP sem extensao, com `server.js` dentro",
    aplicar: () => arq.escrever("pacote-de-entrega", zipCom("server.js", "x")) },
  { id: "M08c", o_que: "[R1] XZ com nome `.txt`",
    aplicar: () => arq.escrever("anotacoes.txt", Buffer.concat([MAGIC_XZ, Buffer.from("qualquer")])) },
  { id: "M13b", o_que: "[R1] glob estreitado para uma suite so",
    aplicar: () => arq.json("package.json", (o) => { o.scripts.test = 'node --test "test/gate_vip.test.js"'; }) },
  { id: "M16", o_que: "[R1] duplicata dois niveis abaixo",
    aplicar: () => arq.escrever("a/b/servidor.js",
      "const http = require('node:http');\nhttp.createServer().listen(process.env.PORT || 3000);\n") },
  { id: "M17b", o_que: "[R1] regra oca (a analise nunca acusa)",
    aplicar: () => arq.trocar("test/unicidade_do_portador.js",
      "function capacidadesDe(sinais, escopo) {",
      "function capacidadesDe(sinais, escopo) {\n  if (sinais) return [];") },
  { id: "M17c", o_que: "[R1] a CHAMADA da prova removida do censo, corpo intacto",
    aplicar: () => arq.trocar("test/censo_de_suites.js",
      "  conferirProvaDaUnicidade(path.join(raiz, \"..\"));",
      "  // conferirProvaDaUnicidade removida") },
];

// ---------------------------------------------------------------------------
// O ORÁCULO
// ---------------------------------------------------------------------------

function rodar(cmd, args, ms) {
  const r = cp.spawnSync(cmd, args, {
    cwd: RAIZ, encoding: "utf8", timeout: ms || 420000,
    shell: process.platform === "win32" && /^npm/.test(cmd),
    windowsHide: true,
  });
  const morreu = !!(r.error && r.error.code === "ETIMEDOUT") || r.signal;
  return { status: r.status, morreu, saida: String(r.stdout || "") + String(r.stderr || "") };
}

/** O PORTÃO OFICIAL. Verde é ESCAPE quando a sabotagem devia ser pega. */
function portao(comJuiz) {
  const r = rodar("npm", ["test"]);
  if (r.morreu) return { veredito: "INCONCLUSIVO", detalhe: "timeout ou sinal", saida: r.saida };
  if (!comJuiz) {
    return { veredito: r.status === 0 ? "VERDE" : "VERMELHO", detalhe: "npm exit " + r.status, saida: r.saida };
  }
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  const saida = path.join(EVIDENCIA, "npm-test.txt");
  const exit = path.join(EVIDENCIA, "exit.txt");
  fs.writeFileSync(saida, r.saida);
  fs.writeFileSync(exit, String(r.status));
  const j = rodar("node", ["ci/portao_do_ci.js", saida, exit], 120000);
  if (j.morreu) return { veredito: "INCONCLUSIVO", detalhe: "juiz morreu", saida: r.saida + j.saida };
  return {
    veredito: r.status === 0 && j.status === 0 ? "VERDE" : "VERMELHO",
    detalhe: "npm exit " + r.status + " · juiz exit " + j.status,
    saida: r.saida + "\n--- JUIZ ---\n" + j.saida,
  };
}

// ---------------------------------------------------------------------------
// A CAMPANHA
// ---------------------------------------------------------------------------

/** [OS 54-C7] SECAGEM: valida TODAS as âncoras sem julgar nada.
 *
 *  Ela não roda na árvore de trabalho. A campanha muta `server.js` no lugar e
 *  restaura no fim — e a OS 54-C6 registrou o preço disso: morta pelo limite de
 *  tempo, ela deixou a mutação injetada. A secagem copia a árvore, roda ESTE
 *  MESMO arquivo dentro da cópia e joga a cópia fora. A árvore real não é
 *  tocada, e `server.js` é conferido por hash antes e depois.
 *
 *  Âncora ausente, ambígua ou sem efeito termina VERMELHO. */
function secar() {
  const os2 = require("node:os");
  const antes = cp.execFileSync("git", ["-C", RAIZ, "hash-object", "server.js"], { encoding: "utf8" }).trim();
  const copia = fs.mkdtempSync(path.join(os2.tmpdir(), "os52c3-secagem-"));
  try {
    for (const item of fs.readdirSync(RAIZ)) {
      if (item === ".git" || item === "node_modules") continue;
      fs.cpSync(path.join(RAIZ, item), path.join(copia, item), { recursive: true });
    }
    const git2 = (...a) =>
      cp.execFileSync("git", ["-C", copia, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    git2("init", "-q");
    git2("config", "user.email", "secagem@os52c3.local");
    git2("config", "user.name", "secagem");
    git2("add", "-A");
    git2("commit", "-q", "-m", "arvore integra (secagem)");
    const saida = cp.spawnSync(process.execPath, [path.join(copia, "mutacoes_c3.js"), "--secar-interno"],
      { cwd: copia, encoding: "utf8" });
    process.stdout.write(String(saida.stdout || ""));
    process.stderr.write(String(saida.stderr || ""));
    const depois = cp.execFileSync("git", ["-C", RAIZ, "hash-object", "server.js"], { encoding: "utf8" }).trim();
    if (antes !== depois) {
      process.stderr.write("SECAGEM TOCOU `server.js` NA ARVORE REAL — " + antes + " -> " + depois + "\n");
      return 2;
    }
    return typeof saida.status === "number" ? saida.status : 2;
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
}

/** A secagem por dentro: já está na cópia, e aqui pode aplicar à vontade. */
function secarInterno() {
  let ruins = 0;
  for (const v of VETORES) {
    if (!arvoreLimpa()) { console.log("!! ARVORE SUJA antes de " + v.id); ruins++; break; }
    try {
      v.aplicar();
      if (arvoreLimpa()) {
        ruins++;
        console.log("SEM EFEITO  " + v.id.padEnd(8) + v.o_que);
      } else {
        console.log("ancora ok   " + v.id.padEnd(8) + v.o_que);
      }
    } catch (e) {
      ruins++;
      console.log("ANCORA RUIM " + v.id.padEnd(8) + String((e && e.message) || e).slice(0, 140));
    }
    restaurar();
  }
  console.log("ancoras invalidas ou sem efeito: " + ruins + "/" + VETORES.length);
  return ruins === 0 ? 0 : 1;
}

function principal() {
  const args = process.argv.slice(2);
  if (args.includes("--secar")) return secar();
  if (args.includes("--secar-interno")) return secarInterno();
  if (args.includes("--listar")) {
    for (const v of VETORES) console.log(v.id.padEnd(8), (v.esperado || "VERMELHO").padEnd(9), v.o_que);
    console.log("total:", VETORES.length);
    return 0;
  }
  const filtro = (() => {
    const i = args.indexOf("--so");
    return i >= 0 && args[i + 1] ? new Set(args[i + 1].split(",")) : null;
  })();

  const linhas = [];
  const anota = (s) => { linhas.push(s); process.stdout.write(s + "\n"); };

  if (!arvoreLimpa()) {
    process.stderr.write("ARVORE SUJA — o arnes recusa rodar.\n" + git("status", "--porcelain", "-uall"));
    return 2;
  }

  anota("# CAMPANHA OS 52-C3 · HEAD=" + git("rev-parse", "HEAD").trim());
  anota("# log: " + LOG);
  const controleInicial = portao(true);
  anota("# CONTROLE INICIAL (arvore integra): " + controleInicial.veredito + " · " + controleInicial.detalhe);

  const alvos = VETORES.filter((v) => !filtro || filtro.has(v.id));
  let pegos = 0, escapes = 0, inconclusivos = 0, ancorasInvalidas = 0;

  for (const v of alvos) {
    if (!arvoreLimpa()) { anota("!! ARVORE SUJA antes de " + v.id + " — campanha abortada"); break; }
    try {
      v.aplicar();
    } catch (e) {
      anota([v.id, "ANCORA-INVALIDA", "", v.o_que, String(e.message).slice(0, 160)].join(" | "));
      ancorasInvalidas++;
      restaurar();
      continue;
    }
    const r = portao(!!v.juiz);
    const esperado = v.esperado || "VERMELHO";
    let classe;
    if (r.veredito === "INCONCLUSIVO") { classe = "INCONCLUSIVO"; inconclusivos++; }
    else if (r.veredito === esperado) { classe = "OK"; pegos++; }
    else { classe = esperado === "VERMELHO" ? "**ESCAPE**" : "**FALSO-POSITIVO**"; escapes++; }
    anota([v.id, r.veredito, classe, v.o_que, r.detalhe].join(" | ") +
      (v.nota ? "  [" + v.nota + "]" : ""));
    restaurar();
  }

  const controleFinal = portao(true);
  anota("# CONTROLE FINAL (arvore integra): " + controleFinal.veredito + " · " + controleFinal.detalhe);
  anota("# PLACAR: conforme=" + pegos + " · divergente=" + escapes +
        " · inconclusivo=" + inconclusivos + " · ancora-invalida=" + ancorasInvalidas +
        " · total=" + alvos.length);
  anota("# arvore limpa ao final: " + arvoreLimpa());

  const texto = linhas.join("\n") + "\n";
  fs.writeFileSync(LOG, texto);
  const bruto = fs.readFileSync(LOG);
  const semNul = Buffer.from(bruto.filter((b) => b !== 0));
  anota("# INTEGRIDADE DO LOG: bruto=" + bruto.length + " sem-NUL=" + semNul.length +
        (bruto.length === semNul.length ? " (ok)" : " (INVALIDO: ha NUL no log)"));

  const valido =
    controleInicial.veredito === "VERDE" &&
    controleFinal.veredito === "VERDE" &&
    bruto.length === semNul.length;
  if (!valido) process.stderr.write("\nPLACAR INVALIDO: controle de integridade ou log corrompido.\n");
  return escapes === 0 && inconclusivos === 0 && ancorasInvalidas === 0 && valido ? 0 : 1;
}

if (require.main === module) process.exit(principal());

module.exports = { VETORES, portao, arq };
