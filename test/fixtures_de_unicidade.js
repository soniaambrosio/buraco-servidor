// test/fixtures_de_unicidade.js — O CATÁLOGO DE CENÁRIOS DA GUARDA DE UNICIDADE.
//
// ===========================================================================
// POR QUE UM CATÁLOGO, E POR QUE ELE MORA FORA DA SUÍTE
// ===========================================================================
//
// A guarda da OS 52-C1 tinha uma proteção só: casos que exercitavam a regra.
// Apagar os casos e o portão ficava verde com a regra oca. A OS 52-C2 exige
// que a proteção resista à NEUTRALIZAÇÃO COORDENADA — regra esvaziada, chamada
// removida, testes reduzidos a comentários, corpos virando tautologia, tudo
// junto e ao mesmo tempo.
//
// A resposta é separar o QUE deve acontecer do QUEM afirma. Este arquivo é o
// catálogo: cada cenário monta uma árvore e DECLARA o veredito esperado. Ele
// não afirma nada — não tem `assert` nenhum. Quem afirma é a suíte, e a guarda
// externa (`conferirProvaDaUnicidade`) confere que a suíte de fato exercitou
// todos os cenários e que cada um deu o resultado declarado.
//
// O efeito prático: esvaziar a suíte não basta, porque a guarda externa cobra
// o catálogo inteiro; esvaziar o catálogo não basta, porque a guarda externa
// cobra os cenários OBRIGATÓRIOS pelo id; e esvaziar a guarda externa não
// basta, porque ela é chamada do censo, que as suítes obrigatórias chamam.
// Não há um ponto único cuja remoção deixe tudo verde.
//
// CONTAR `test(` NÃO É PROTEÇÃO — a OS diz, e é verdade: um arquivo com trinta
// `test("x", () => {})` vazios satisfaz qualquer contador. O que este desenho
// cobra é RESULTADO NEGATIVO REAL contra fixture controlada.
//
// ===========================================================================
// [OS 52-C3] O QUE ENTROU, E POR QUÊ
// ===========================================================================
//
// A R2 mostrou que 31 cenários num arquivo só não cobrem a fragmentação: a
// duplicata partida em dois arquivos não se parecia com nenhum deles. Entraram
// as famílias:
//
//   FRG — fragmentação: mesmo diretório, diretórios distintos, três arquivos,
//         `module.exports` com destructuring, e sem ligação declarada nenhuma;
//   ALI — alias de `.listen` e de `.bind`, que é a mesma capacidade com outra
//         escrita;
//   UPG — upgrade EXECUTÁVEL, com cenário gêmeo que só tem a palavra em string;
//   ASS — concessão de assento por `Map`, por objeto devolvido e por função
//         auxiliar, porque `assentos[i] =` era uma escrita entre muitas;
//   DES — despacho de `entrarMesa` com assento;
//   ARR — arranque do transporte por `require`, por `__require` e por auxiliar;
//   UDP — soquete de datagrama, que não passa por `createServer` nenhum.
//
// E cada RAMO da tabela de capacidades ganhou um cenário EXCLUSIVO que o
// aciona, declarado em `RAMO_EXERCITADO_POR` — sem isso um ramo pode virar
// decoração sem ninguém perceber.
// ===========================================================================

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const CRIADAS = [];

/** Uma árvore descartável com o portador legítimo dentro.
 *
 *  O portador entra sempre: sem ele, "passa" não provaria isenção nenhuma —
 *  provaria que uma pasta quase vazia não tem servidor. E a guarda reprova
 *  árvore sem portador de propósito, para que varredura que não alcança nada
 *  não possa se passar por varredura limpa. */
function arvore(fonteDoPortador) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "unic-"));
  fs.writeFileSync(path.join(raiz, "server.js"), fonteDoPortador);
  fs.writeFileSync(
    path.join(raiz, "package.json"),
    JSON.stringify({ name: "x", scripts: { start: "node server.js" } }, null, 2)
  );
  CRIADAS.push(raiz);
  return raiz;
}

function limparArvores() {
  while (CRIADAS.length) {
    const raiz = CRIADAS.pop();
    try { fs.rmSync(raiz, { recursive: true, force: true }); } catch (_) {}
  }
}

function escrever(raiz, rel, conteudo) {
  const destino = path.join(raiz, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, conteudo);
  return destino;
}

// ---------------------------------------------------------------------------
// PACOTES SINTÉTICOS — bytes de verdade, montados aqui
// ---------------------------------------------------------------------------

/** Um ZIP mínimo, porém REAL: cabeçalho local, diretório central e EOCD, com
 *  uma entrada de nome escolhido. Sem compressão (método 0), porque o que a
 *  guarda lê é o INVENTÁRIO, e o inventário está em claro. */
function zipCom(nomeInterno, dados) {
  const nome = Buffer.from(nomeInterno, "latin1");
  const corpo = Buffer.from(dados, "latin1");
  const crc = crc32(corpo);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8);            // método: armazenado
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(corpo.length, 18);
  local.writeUInt32LE(corpo.length, 22);
  local.writeUInt16LE(nome.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(corpo.length, 20);
  central.writeUInt32LE(corpo.length, 24);
  central.writeUInt16LE(nome.length, 28);

  const deslocamentoCentral = local.length + nome.length + corpo.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nome.length, 12);
  fim.writeUInt32LE(deslocamentoCentral, 16);

  return Buffer.concat([local, nome, corpo, central, nome, fim]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

/** Um TAR mínimo: um cabeçalho de 512 com `ustar` no byte 257 — que é a única
 *  marca que o formato tem, e não fica no começo do arquivo. */
function tarCom(nomeInterno, dados) {
  const cabecalho = Buffer.alloc(512, 0);
  cabecalho.write(nomeInterno, 0, "latin1");
  cabecalho.write("0000644\0", 100, "latin1");
  cabecalho.write(dados.length.toString(8).padStart(11, "0") + "\0", 124, "latin1");
  cabecalho.write("ustar\0", 257, "latin1");
  cabecalho.write("00", 263, "latin1");
  const corpo = Buffer.alloc(Math.ceil(dados.length / 512) * 512, 0);
  Buffer.from(dados, "latin1").copy(corpo);
  return Buffer.concat([cabecalho, corpo, Buffer.alloc(1024, 0)]);
}

const MAGIC = Object.freeze({
  GZIP: Buffer.from([0x1f, 0x8b, 0x08, 0x00]),
  XZ: Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]),
  SETEZ: Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
  RAR: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]),
  BZIP2: Buffer.from([0x42, 0x5a, 0x68, 0x39]),
  ZSTD: Buffer.from([0x28, 0xb5, 0x2f, 0xfd]),
});
const comMagic = (m) => Buffer.concat([m, Buffer.from("conteudo qualquer, nao importa", "latin1")]);

// ---------------------------------------------------------------------------
// SERVIDORES SINTÉTICOS — escritos do zero, sem um trecho do bundle
// ---------------------------------------------------------------------------
//
// Nenhum deles copia nada de `server.js`: nomes, estilo e pilha são outros. É
// esse o ponto desde a OS 52-C2 — a guarda antiga procurava o servidor QUE
// EXISTE, e um servidor novo não se parecia com ele.

const SERVIDOR_HTTP = [
  "const http = require('node:http');",
  "const alvo = http.createServer((req, res) => res.end('ok'));",
  "alvo.listen(process.env.PORT || 3000);",
].join("\n");

const SERVIDOR_NET = [
  "const net = require('node:net');",
  "const tomada = net.createServer((c) => { c.write('oi'); c.end(); });",
  "tomada.listen(process.env.PORT || 4000);",
].join("\n");

const SERVIDOR_HTTPS = [
  "const https = require('node:https');",
  "const seguro = https.createServer({}, (req, res) => res.end('ok'));",
  "seguro.listen(process.env.PORT || 8443);",
].join("\n");

const SERVIDOR_PORTA_FIXA = [
  "const http = require('node:http');",
  "http.createServer((q, r) => r.end()).listen(9123);",
].join("\n");

/** O GUID do RFC 6455, montado em pedaços.
 *
 *  Os cenários precisam do GUID CONTÍGUO dentro do arquivo que escrevem — foi
 *  por não tê-lo que o ramo do handshake por GUID nunca disparou na C2, e um
 *  ramo que nunca dispara é decoração. Mas ele não pode aparecer contíguo
 *  NESTE arquivo, que também é varrido: o catálogo passaria a carregar o sinal
 *  bruto que ele existe para testar. Montar em pedaços resolve os dois. */
const GUID_RFC6455 = ["258EAFA5", "E914", "47DA", "95CA", "C5AB0DC85B11"].join("-");

const SERVIDOR_WS_MANUAL = [
  "const http = require('node:http');",
  "const crypto = require('node:crypto');",
  "const marca = '" + GUID_RFC6455 + "';",
  "const alvo = http.createServer();",
  "alvo.on('upgrade', (req, socket) => {",
  "  const chave = req.headers['sec-websocket-key'];",
  "  const aceite = crypto.createHash('sha1').update(chave + marca).digest('base64');",
  "  socket.write('HTTP/1.1 101\\r\\nSec-WebSocket-Accept: ' + aceite + '\\r\\n\\r\\n');",
  "});",
  "alvo.listen(process.env.PORT || 7000);",
].join("\n");

const PORTADOR_DE_INGRESSO = [
  "function entrarMesa({ codigo, apelido }) {",
  "  const sala = registro[codigo];",
  "  for (const s of [2, 1, 3]) {",
  "    if (sala.assentos[s] === null) { sala.assentos[s] = { apelido }; return { assento: s }; }",
  "  }",
  "  return { erro: 'mesa cheia' };",
  "}",
].join("\n");

const CLIENTE_HTML_INTEGRO = [
  "<!doctype html><html><body>",
  "<!-- Cliente. Fala `entrarMesa` pelo fio e não implementa nada disso. -->",
  "<script>",
  "  const ws = new WebSocket('wss://exemplo/ws');",
  "  function pedirLugar(codigo, assento) {",
  "    ws.send(JSON.stringify({ tipo: 'entrarMesa', codigo, assento }));",
  "  }",
  "  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.tipo === 'entrou') sentar(m.assento); };",
  "</script></body></html>",
].join("\n");

const COMENTARIO_INOCENTE = [
  "// Notas sobre o transporte. Nada aqui executa.",
  "//",
  "// O handshake usa Sec-WebSocket-Accept e responde ao upgrade da conexão.",
  "// O despachante trata `case \"entrarMesa\"` e o servidor faz `listen` na",
  "// porta de process.env.PORT. Documentado para quem for ler o bundle.",
  "const NOTA = 'texto, nao programa';",
  "module.exports = { NOTA };",
].join("\n");

const TESTE_QUE_SIMULA_TRANSPORTE = [
  "// Simula o transporte SEM abrir porta: injeta um canal falso e observa.",
  "const assert = require('node:assert/strict');",
  "function canalFalso() {",
  "  const enviados = [];",
  "  return { send: (m) => enviados.push(JSON.parse(m)), enviados };",
  "}",
  "const c = canalFalso();",
  "c.send(JSON.stringify({ tipo: 'entrarMesa', codigo: 'ABC', assento: 2 }));",
  "assert.equal(c.enviados[0].tipo, 'entrarMesa');",
  "assert.equal(c.enviados[0].assento, 2);",
].join("\n");

// ---------------------------------------------------------------------------
// [OS 52-C3] AS PEÇAS DA FRAGMENTAÇÃO
// ---------------------------------------------------------------------------
//
// Nenhuma peça, sozinha, é um servidor. A escuta usa `cfg.p` de propósito: sem
// número nem nome de porta no argumento, o ramo `ESCUTA-DE-PORTA` não dispara,
// e o que sobra para pegar a duplicata é EXATAMENTE a composição — que é o
// defeito que a R2 encontrou.

const PECA_CRIA = [
  "'use strict';",
  "const http = require('node:http');",
  "// Cria, e não escuta. Sozinha esta peça não abre porta nenhuma.",
  "const alvo = http.createServer((req, res) => res.end('fragmento'));",
  "module.exports = { alvo };",
].join("\n");

const pecaEscuta = (caminhoRelativo) => [
  "'use strict';",
  "// Escuta, e não cria. Sozinha esta peça não é servidor de nada.",
  "const { alvo } = require('" + caminhoRelativo + "');",
  "const cfg = { p: 9101 };",
  "alvo.listen(cfg.p);",
].join("\n");

const pecaReexporta = (caminhoRelativo) => [
  "'use strict';",
  "const { alvo } = require('" + caminhoRelativo + "');",
  "module.exports = { alvo };",
].join("\n");

const PECA_CRIA_SOLTA = [
  "'use strict';",
  "const http = require('node:http');",
  "globalThis.__alvo = http.createServer((req, res) => res.end('solto'));",
].join("\n");

const PECA_ESCUTA_SOLTA = [
  "'use strict';",
  "// Nenhum `require` liga esta peça à outra: a ligação é feita por quem",
  "// carrega os dois arquivos, e a árvore não a declara em lugar nenhum.",
  "const cfg = { p: 9102 };",
  "globalThis.__alvo.listen(cfg.p);",
].join("\n");

const ALIAS_DE_LISTEN = [
  "'use strict';",
  "const { alvo } = require('./cria.js');",
  "const cfg = { p: 9103 };",
  "// A escuta pelo apelido do método: mesma capacidade, outra escrita.",
  "const abrir = alvo.listen;",
  "abrir.call(alvo, cfg.p);",
].join("\n");

const CANAL_UDP_CRIA = [
  "'use strict';",
  "const dgram = require('node:dgram');",
  "const canal = dgram.createSocket('udp4');",
  "module.exports = { canal };",
].join("\n");

const ALIAS_DE_BIND = [
  "'use strict';",
  "const { canal } = require('./canal.js');",
  "const vincular = canal.bind;",
  "vincular.call(canal, 41999);",
].join("\n");

const UDP_INTEIRO = [
  "'use strict';",
  "const dgram = require('node:dgram');",
  "const canal = dgram.createSocket('udp4');",
  "canal.on('message', (m, r) => canal.send('pong', r.port, r.address));",
  "canal.bind(Number(process.env.PORT_UDP) || 41234);",
].join("\n");

const WSS_COM_PORTA = [
  "'use strict';",
  "const { WebSocketServer } = require('ws');",
  "const wss = new WebSocketServer({ port: Number(process.env.PORT) || 8392 });",
  "wss.on('connection', (c) => c.send('ok'));",
].join("\n");

const WSS_FABRICA_COM_PORTA = [
  "'use strict';",
  "const { WebSocketServer } = require('ws');",
  "const wss = WebSocketServer({ port: 8393, perMessageDeflate: false });",
  "wss.on('connection', (c) => c.close());",
].join("\n");

const APP_LISTEN = [
  "'use strict';",
  "const express = require('express');",
  "const app = express();",
  "app.get('/', (q, r) => r.send('ok'));",
  "app.listen(3311);",
].join("\n");

const UPGRADE_EXECUTAVEL = [
  "'use strict';",
  "const http = require('node:http');",
  "const alvo = http.createServer();",
  "// Sem o GUID: o que caracteriza aqui é o par upgrade + cabeçalho, executável.",
  "alvo.on('upgrade', (req, soquete) => {",
  "  const chave = req.headers['sec-websocket-key'];",
  "  soquete.write('HTTP/1.1 101\\r\\nSec-WebSocket-Accept: ' + chave + '\\r\\n\\r\\n');",
  "});",
  "alvo.listen(cfgDaPorta);",
].join("\n");

const UPGRADE_SO_EM_STRING = [
  "'use strict';",
  "// A palavra existe, e não executa: é dado, não registro de ouvinte.",
  "const EVENTOS_CONHECIDOS = ['upgrade', 'connection', 'close'];",
  "const CABECALHO = 'Sec-WebSocket-Accept';",
  "module.exports = { EVENTOS_CONHECIDOS, CABECALHO };",
].join("\n");

const ASSENTO_POR_MAPA = [
  "'use strict';",
  "const lugares = new Map();",
  "function entrarMesa({ codigo, apelido }) {",
  "  for (const s of [2, 1, 3, 0]) {",
  "    if (!lugares.has(s)) { lugares.set(s, { apelido, codigo }); return { ok: true, lugar: s }; }",
  "  }",
  "  return { ok: false, motivo: 'mesa cheia' };",
  "}",
  "module.exports = { entrarMesa, lugares };",
].join("\n");

const ASSENTO_POR_OBJETO = [
  "'use strict';",
  "const entrarMesa = function (pedido) {",
  "  const livre = procurarLivre(pedido.codigo);",
  "  if (livre === null) return { recusa: 'MESA_CHEIA' };",
  "  return { assento: livre, confirmado: true };",
  "};",
  "module.exports = { entrarMesa };",
].join("\n");

const ASSENTO_POR_AUXILIAR = [
  "'use strict';",
  "function assentarJogador(mesa, indice, jogador) {",
  "  mesa.lugares[indice] = { apelido: jogador.apelido, jogadorId: jogador.id };",
  "}",
  "const entrarMesa = (pedido) => assentarJogador(pedido.mesa, pedido.indice, pedido.jogador);",
  "module.exports = { entrarMesa, assentarJogador };",
].join("\n");

const DESPACHO_COM_ASSENTO = [
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
].join("\n");

// O nome do módulo do bundle nunca é escrito por extenso neste arquivo: ele é
// montado, para que a presença do texto no catálogo não vire sinal bruto num
// arquivo que não arranca coisa nenhuma.
const MODULO_DO_BUNDLE = "ws" + "_server";

const ARRANQUE_POR_SUBLINHADO = [
  "ENTREGA DO TRANSPORTE — arranque alternativo do bundle.",
  "",
  "__require(\"" + MODULO_DO_BUNDLE + "\").iniciar();",
  "",
  "Fim.",
].join("\n");

const ARRANQUE_POR_REQUIRE = [
  "'use strict';",
  "require(\"" + MODULO_DO_BUNDLE + "\").iniciar();",
].join("\n");

const ARRANQUE_POR_AUXILIAR = [
  "'use strict';",
  "function subirTransporte() {",
  "  return __require(\"" + MODULO_DO_BUNDLE + "\").iniciar({ porta: 8080 });",
  "}",
  "subirTransporte();",
].join("\n");

const PROSA_COM_TODOS_OS_TOKENS = [
  "# Nota de arquitetura",
  "",
  "O transporte responde ao upgrade com Sec-WebSocket-Accept, derivado da chave",
  "do cliente e do GUID do RFC 6455 (" + GUID_RFC6455 + ").",
  "O despachante trata entrarMesa, o módulo " + MODULO_DO_BUNDLE + " faz o listen na porta de",
  "process.env.PORT e os assentos ficam em assentos[i]. Nada disto executa: é",
  "prosa, num arquivo de documentação.",
].join("\n");

const ARQUIVO_LEGITIMO_DESCONHECIDO = [
  "# configuracao qualquer, de ferramenta nenhuma conhecida",
  "versao: 3",
  "opcoes:",
  "  - manter",
  "  - registrar",
].join("\n");

// ---------------------------------------------------------------------------
// O CATÁLOGO
// ---------------------------------------------------------------------------
//
// `esperado` é o veredito que a guarda TEM de dar. Os cenários `passa` são tão
// importantes quanto os `reprova`: uma guarda que reprova tudo passaria em
// todos os negativos e derrubaria a árvore íntegra — que é como uma guarda
// nova morre, removida por incômodo.

function catalogo(fonteDoPortador) {
  return [
    // --- capacidade: servidor novo, sem parentesco com o bundle -------------
    { id: "CAP-01", esperado: "reprova",
      o_que: "segundo servidor com nomes inteiramente diferentes (http)",
      montar: (r) => escrever(r, "servico/entrega.js", SERVIDOR_HTTP) },
    { id: "CAP-02", esperado: "reprova",
      o_que: "servidor em `net.createServer`",
      montar: (r) => escrever(r, "tomada.js", SERVIDOR_NET) },
    { id: "CAP-03", esperado: "reprova",
      o_que: "servidor em `https.createServer`",
      montar: (r) => escrever(r, "seguro.js", SERVIDOR_HTTPS) },
    { id: "CAP-04", esperado: "reprova",
      o_que: "servidor WebSocket manual, com handshake escrito à mão",
      montar: (r) => escrever(r, "ponte.js", SERVIDOR_WS_MANUAL) },
    { id: "CAP-05", esperado: "reprova",
      o_que: "porta fixa, sem `process.env.PORT`",
      montar: (r) => escrever(r, "fixo.js", SERVIDOR_PORTA_FIXA) },
    { id: "CAP-06", esperado: "reprova",
      o_que: "portador de ingresso reescrito: declara `entrarMesa` e senta gente",
      montar: (r) => escrever(r, "salas_v2.js", PORTADOR_DE_INGRESSO) },
    { id: "CAP-07", esperado: "reprova",
      o_que: "arquivo SEM EXTENSÃO com um servidor dentro",
      montar: (r) => escrever(r, "entrega", SERVIDOR_HTTP) },
    { id: "CAP-08", esperado: "reprova",
      o_que: "servidor dentro de HTML, em `<script>`",
      montar: (r) => escrever(r, "pagina.html", "<html><script>" + SERVIDOR_HTTP + "</script></html>") },

    // --- [C3] fragmentação: a capacidade que não cabe num arquivo ----------
    { id: "FRG-01", esperado: "reprova",
      o_que: "criação e escuta em DOIS arquivos do MESMO diretório, ligados por `require`",
      montar: (r) => {
        escrever(r, "frag/cria.js", PECA_CRIA);
        escrever(r, "frag/sobe.js", pecaEscuta("./cria.js"));
      } },
    { id: "FRG-02", esperado: "reprova",
      o_que: "criação e escuta em DIRETÓRIOS DISTINTOS",
      montar: (r) => {
        escrever(r, "nucleo/servidor.js", PECA_CRIA);
        escrever(r, "arranque/sobe.js", pecaEscuta("../nucleo/servidor.js"));
      } },
    { id: "FRG-03", esperado: "reprova",
      o_que: "TRÊS arquivos na mesma porta: cria, reexporta, escuta",
      montar: (r) => {
        escrever(r, "t1/cria.js", PECA_CRIA);
        escrever(r, "t2/repassa.js", pecaReexporta("../t1/cria.js"));
        escrever(r, "t3/sobe.js", pecaEscuta("../t2/repassa.js"));
      } },
    { id: "FRG-04", esperado: "reprova",
      o_que: "criação exportada por `module.exports`, importada por destructuring",
      montar: (r) => {
        escrever(r, "exp/fonte.js", PECA_CRIA + "\nexports.alvo = alvo;\n");
        escrever(r, "exp/consome.js", pecaEscuta("./fonte.js"));
      } },
    { id: "FRG-05", esperado: "reprova",
      o_que: "criação e escuta SEM ligação declarada — só o escopo `arvore` fecha",
      montar: (r) => {
        escrever(r, "solto/cria.js", PECA_CRIA_SOLTA);
        escrever(r, "outro/lugar/sobe.js", PECA_ESCUTA_SOLTA);
      } },

    // --- [C3] alias: a mesma capacidade com outra escrita -------------------
    { id: "ALI-01", esperado: "reprova",
      o_que: "alias de `.listen`, chamado por `call`",
      montar: (r) => {
        escrever(r, "alias/cria.js", PECA_CRIA);
        escrever(r, "alias/sobe.js", ALIAS_DE_LISTEN);
      } },
    { id: "ALI-02", esperado: "reprova",
      o_que: "alias de `.bind` sobre um soquete de datagrama",
      montar: (r) => {
        escrever(r, "eco/canal.js", CANAL_UDP_CRIA);
        escrever(r, "eco/vincula.js", ALIAS_DE_BIND);
      } },

    // --- [C3] portas abertas sem `.listen()` --------------------------------
    { id: "CAP-09", esperado: "reprova",
      o_que: "`new WebSocketServer({port})`, sem `.listen()` nenhum",
      montar: (r) => escrever(r, "ponte_ws.js", WSS_COM_PORTA) },
    { id: "CAP-10", esperado: "reprova",
      o_que: "`WebSocketServer({port})` por fábrica, sem `new`",
      montar: (r) => escrever(r, "fabrica_ws.js", WSS_FABRICA_COM_PORTA) },
    { id: "CAP-11", esperado: "reprova",
      o_que: "`app.listen(3311)` — quem cria é o framework, quem abre a porta é isto",
      montar: (r) => escrever(r, "web/app.js", APP_LISTEN) },
    { id: "UDP-01", esperado: "reprova",
      o_que: "servidor UDP: `dgram.createSocket().bind(porta)`",
      montar: (r) => escrever(r, "udp/eco.js", UDP_INTEIRO) },

    // --- [C3] handshake e upgrade ------------------------------------------
    { id: "UPG-01", esperado: "reprova",
      o_que: "upgrade EXECUTÁVEL com cabeçalho de handshake, sem o GUID",
      montar: (r) => escrever(r, "ponte_upgrade.js", UPGRADE_EXECUTAVEL) },

    // --- [C3] concessão de assento, por semântica --------------------------
    { id: "ASS-01", esperado: "reprova",
      o_que: "ingresso que concede assento por `Map.set`",
      montar: (r) => escrever(r, "salas/mapa.js", ASSENTO_POR_MAPA) },
    { id: "ASS-02", esperado: "reprova",
      o_que: "ingresso que devolve o assento confirmado num objeto, com recusa tipada",
      montar: (r) => escrever(r, "salas/objeto.js", ASSENTO_POR_OBJETO) },
    { id: "ASS-03", esperado: "reprova",
      o_que: "ingresso que delega a função auxiliar que vincula jogador a assento",
      montar: (r) => escrever(r, "salas/auxiliar.js", ASSENTO_POR_AUXILIAR) },
    { id: "DES-01", esperado: "reprova",
      o_que: "despachante com `case 'entrarMesa'` que senta o jogador",
      montar: (r) => escrever(r, "despacho/central.js", DESPACHO_COM_ASSENTO) },

    // --- [C3] arranque do transporte deste bundle ---------------------------
    { id: "ARR-01", esperado: "reprova",
      o_que: "segundo arranque por `__require`, em arquivo TEXTUAL",
      montar: (r) => escrever(r, "docs/ENTREGA-TRANSPORTE.txt", ARRANQUE_POR_SUBLINHADO) },
    { id: "ARR-02", esperado: "reprova",
      o_que: "segundo arranque por `require`, sem sublinhado",
      montar: (r) => escrever(r, "sobe.js", ARRANQUE_POR_REQUIRE) },
    { id: "ARR-03", esperado: "reprova",
      o_que: "arranque embrulhado numa função auxiliar",
      montar: (r) => escrever(r, "infra/subir.js", ARRANQUE_POR_AUXILIAR) },

    // --- manifestos ---------------------------------------------------------
    { id: "MAN-01", esperado: "reprova",
      o_que: "`package.json` secundário numa subpasta",
      montar: (r) => escrever(r, "pacote/package.json",
        JSON.stringify({ name: "outro", scripts: { start: "node outro.js" } })) },
    { id: "MAN-02", esperado: "reprova",
      o_que: "script `start` da raiz apontando para arquivo alternativo",
      montar: (r) => escrever(r, "package.json",
        JSON.stringify({ name: "x", scripts: { start: "node servidor_novo.js" } })) },

    // --- compactados, por conteúdo -----------------------------------------
    { id: "PAC-01", esperado: "reprova",
      o_que: "ZIP SEM EXTENSÃO, com `server.js` e `package.json` dentro",
      montar: (r) => escrever(r, "entrega", zipCom("server.js", SERVIDOR_HTTP)) },
    { id: "PAC-02", esperado: "reprova",
      o_que: "ZIP renomeado para `.bin`",
      montar: (r) => escrever(r, "artefato.bin", zipCom("package.json", "{}")) },
    { id: "PAC-03", esperado: "reprova",
      o_que: "XZ com nome `.txt`",
      montar: (r) => escrever(r, "notas.txt", comMagic(MAGIC.XZ)) },
    { id: "PAC-04", esperado: "reprova",
      o_que: "TAR reconhecido pelo cabeçalho (a marca está no byte 257)",
      montar: (r) => escrever(r, "pacote", tarCom("server.js", SERVIDOR_HTTP)) },
    { id: "PAC-05", esperado: "reprova",
      o_que: "GZIP sem extensão",
      montar: (r) => escrever(r, "dados", comMagic(MAGIC.GZIP)) },
    { id: "PAC-06", esperado: "reprova",
      o_que: "7z com nome inédito",
      montar: (r) => escrever(r, "guardado.dat", comMagic(MAGIC.SETEZ)) },
    { id: "PAC-07", esperado: "reprova",
      o_que: "RAR disfarçado de documento",
      montar: (r) => escrever(r, "leia.md", comMagic(MAGIC.RAR)) },
    { id: "PAC-08", esperado: "reprova",
      o_que: "BZIP2 sem extensão",
      montar: (r) => escrever(r, "b", comMagic(MAGIC.BZIP2)) },
    { id: "PAC-09", esperado: "reprova",
      o_que: "ZSTD sem extensão",
      montar: (r) => escrever(r, "z", comMagic(MAGIC.ZSTD)) },
    { id: "PAC-10", esperado: "reprova",
      o_que: "ZIP TRUNCADO: os bytes dizem ZIP e o inventário não abre",
      montar: (r) => escrever(r, "meio_pacote", zipCom("server.js", SERVIDOR_HTTP).slice(0, 40)) },

    // --- profundidade -------------------------------------------------------
    { id: "SUB-01", esperado: "reprova",
      o_que: "duplicata dois níveis abaixo",
      montar: (r) => escrever(r, "um/dois/servidor.js", SERVIDOR_HTTP) },
    { id: "SUB-02", esperado: "reprova",
      o_que: "duplicata quatro níveis abaixo, em subdiretório de nome inédito",
      montar: (r) => escrever(r, "a/b/c/d/qualquer", SERVIDOR_NET) },
    { id: "SUB-03", esperado: "reprova",
      o_que: "pacote compactado numa subpasta de documentação",
      montar: (r) => escrever(r, "docs/anexos/leitura", zipCom("server.js", "x")) },
    { id: "SUB-04", esperado: "reprova",
      o_que: "duplicata SEIS níveis abaixo — a recursão não tem teto de profundidade",
      montar: (r) => escrever(r, "n1/n2/n3/n4/n5/n6/oculto.js", SERVIDOR_HTTP) },

    // --- o que NÃO pode reprovar -------------------------------------------
    { id: "OK-01", esperado: "passa",
      o_que: "a árvore com o portador e mais nada",
      montar: () => {} },
    { id: "OK-02", esperado: "passa",
      o_que: "`app.html` cliente íntegro — fala `entrarMesa`, não implementa",
      montar: (r) => escrever(r, "app.html", CLIENTE_HTML_INTEGRO) },
    { id: "OK-03", esperado: "passa",
      o_que: "comentário com todas as palavras proibidas, sem capacidade",
      montar: (r) => escrever(r, "docs/notas.js", COMENTARIO_INOCENTE) },
    { id: "OK-04", esperado: "passa",
      o_que: "teste que simula transporte sem abrir porta",
      montar: (r) => escrever(r, "test/simulado.test.js", TESTE_QUE_SIMULA_TRANSPORTE) },
    { id: "OK-05", esperado: "passa",
      o_que: "documentação que descreve o handshake em prosa",
      montar: (r) => escrever(r, "docs/transporte.md",
        "# Transporte\n\nO upgrade responde com `Sec-WebSocket-Accept`, derivado da\n" +
        "chave do cliente e do GUID do RFC 6455. O `listen` usa `process.env.PORT`.\n") },
    { id: "OK-06", esperado: "passa",
      o_que: "JSON de contrato citando `entrarMesa` e assento",
      montar: (r) => escrever(r, "contrato/ingresso.json",
        JSON.stringify({ pedido: "entrarMesa", campos: ["codigo", "assento"] }, null, 2)) },
    { id: "OK-07", esperado: "passa",
      o_que: "arquivo binário que NÃO é pacote (PNG)",
      montar: (r) => escrever(r, "logo.png",
        Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)])) },
    { id: "OK-08", esperado: "passa",
      o_que: "`upgrade` e o cabeçalho só como STRING, sem registro de ouvinte",
      montar: (r) => escrever(r, "constantes/eventos.js", UPGRADE_SO_EM_STRING) },
    { id: "OK-09", esperado: "passa",
      o_que: "prosa com TODOS os tokens sensíveis, inclusive o GUID",
      montar: (r) => escrever(r, "docs/arquitetura.md", PROSA_COM_TODOS_OS_TOKENS) },
    { id: "OK-10", esperado: "passa",
      o_que: "arquivo legítimo de tipo desconhecido",
      montar: (r) => escrever(r, "ferramenta/config.yml", ARQUIVO_LEGITIMO_DESCONHECIDO) },
    { id: "OK-11", esperado: "passa",
      o_que: "peça de criação SOZINHA, sem escuta em lugar nenhum da árvore",
      montar: (r) => escrever(r, "meia/peca.js", PECA_CRIA) },
    { id: "OK-12", esperado: "passa",
      o_que: "`fn.bind(this)` e `Map.set` fora de qualquer ingresso",
      montar: (r) => escrever(r, "util/ligar.js",
        "'use strict';\nconst cache = new Map();\nfunction ligar(fn, alvo) { return fn.bind(alvo); }\n" +
        "cache.set('a', 1);\nmodule.exports = { ligar, cache };\n") },

    // --- o portador não pode deixar de ser reconhecido -----------------------
    { id: "POR-01", esperado: "reprova",
      o_que: "`server.js` deixa de exibir capacidade — a análise está cega",
      montar: (r) => fs.writeFileSync(path.join(r, "server.js"), "module.exports = {};\n") },
    { id: "POR-02", esperado: "reprova",
      o_que: "não há portador nenhum na árvore",
      montar: (r) => fs.rmSync(path.join(r, "server.js"), { force: true }) },
  ].map((c) => Object.assign({ fonteDoPortador }, c));
}

/** Os ids que a guarda externa cobra por NOME. Encolher o catálogo derruba
 *  aqui: sem isto, apagar metade dos cenários deixaria a prova "completa". */
const CENARIOS_OBRIGATORIOS = Object.freeze([
  "CAP-01", "CAP-02", "CAP-03", "CAP-04", "CAP-05", "CAP-06", "CAP-07", "CAP-08",
  "CAP-09", "CAP-10", "CAP-11",
  "FRG-01", "FRG-02", "FRG-03", "FRG-04", "FRG-05",
  "ALI-01", "ALI-02",
  "UDP-01", "UPG-01",
  "ASS-01", "ASS-02", "ASS-03", "DES-01",
  "ARR-01", "ARR-02", "ARR-03",
  "MAN-01", "MAN-02",
  "PAC-01", "PAC-02", "PAC-03", "PAC-04", "PAC-05", "PAC-06", "PAC-07", "PAC-08", "PAC-09", "PAC-10",
  "SUB-01", "SUB-02", "SUB-03", "SUB-04",
  "OK-01", "OK-02", "OK-03", "OK-04", "OK-05", "OK-06", "OK-07",
  "OK-08", "OK-09", "OK-10", "OK-11", "OK-12",
  "POR-01", "POR-02",
]);

/** [OS 52-C3, §C3-06] O CENÁRIO EXCLUSIVO DE CADA RAMO.
 *
 *  Ramo decorativo é falha, e "decorativo" só se descobre confrontando a
 *  tabela de ramos com o que os cenários DE FATO fizeram disparar. Este mapa é
 *  a declaração EXTERNA: mora no catálogo, e não na implementação que ele
 *  cobra. A prova externa exige, nos dois sentidos, que cada ramo tenha aqui um
 *  cenário que o aciona e que cada ramo declarado exista na tabela — assim,
 *  matar um ramo derruba o cenário dele, e inventar um ramo sem cenário
 *  derruba a conferência. */
const RAMO_EXERCITADO_POR = Object.freeze({
  "REDE": "FRG-01",
  "ESCUTA-DE-PORTA": "CAP-11",
  "PORTA-NO-CONSTRUTOR": "CAP-09",
  "DATAGRAMA": "UDP-01",
  "HANDSHAKE-GUID": "CAP-04",
  "HANDSHAKE-UPGRADE": "UPG-01",
  "INGRESSO-DECLARADO": "ASS-01",
  "INGRESSO-DESPACHADO": "DES-01",
  "ARRANQUE": "ARR-01",
});

/** Os ESCOPOS que precisam ter sido exercitados de verdade. Um escopo que
 *  nunca dispara é código morto travestido de defesa. */
const ESCOPO_EXERCITADO_POR = Object.freeze({
  "arquivo": "CAP-01",
  "conjunto": "FRG-01",
  "arvore": "FRG-05",
});

module.exports = {
  arvore, limparArvores, escrever, catalogo, CENARIOS_OBRIGATORIOS,
  RAMO_EXERCITADO_POR, ESCOPO_EXERCITADO_POR,
  zipCom, tarCom, comMagic, MAGIC,
  SERVIDOR_HTTP, SERVIDOR_NET, SERVIDOR_HTTPS, SERVIDOR_WS_MANUAL,
  SERVIDOR_PORTA_FIXA, PORTADOR_DE_INGRESSO, CLIENTE_HTML_INTEGRO,
  COMENTARIO_INOCENTE, TESTE_QUE_SIMULA_TRANSPORTE,
  PECA_CRIA, pecaEscuta, pecaReexporta, PECA_CRIA_SOLTA, PECA_ESCUTA_SOLTA,
  ALIAS_DE_LISTEN, CANAL_UDP_CRIA, ALIAS_DE_BIND, UDP_INTEIRO,
  WSS_COM_PORTA, WSS_FABRICA_COM_PORTA, APP_LISTEN,
  UPGRADE_EXECUTAVEL, UPGRADE_SO_EM_STRING,
  ASSENTO_POR_MAPA, ASSENTO_POR_OBJETO, ASSENTO_POR_AUXILIAR, DESPACHO_COM_ASSENTO,
  ARRANQUE_POR_SUBLINHADO, ARRANQUE_POR_REQUIRE, ARRANQUE_POR_AUXILIAR,
  PROSA_COM_TODOS_OS_TOKENS, ARQUIVO_LEGITIMO_DESCONHECIDO,
};
