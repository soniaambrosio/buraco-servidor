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
// basta, porque ela é chamada do censo, que as três suítes obrigatórias
// chamam. Não há um ponto único cuja remoção deixe tudo verde.
//
// CONTAR `test(` NÃO É PROTEÇÃO — a OS diz, e é verdade: um arquivo com trinta
// `test("x", () => {})` vazios satisfaz qualquer contador. O que este desenho
// cobra é RESULTADO NEGATIVO REAL contra fixture controlada.
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
// esse o ponto da OS 52-C2 — a guarda antiga procurava o servidor QUE EXISTE,
// e um servidor novo não se parecia com ele.

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

const SERVIDOR_WS_MANUAL = [
  "const http = require('node:http');",
  "const crypto = require('node:crypto');",
  "const marca = '258EAFA5' + '-E914-47DA-95CA-C5AB0DC85B11';",
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
  "MAN-01", "MAN-02",
  "PAC-01", "PAC-02", "PAC-03", "PAC-04", "PAC-05", "PAC-06", "PAC-07", "PAC-08", "PAC-09",
  "SUB-01", "SUB-02", "SUB-03",
  "OK-01", "OK-02", "OK-03", "OK-04", "OK-05", "OK-06", "OK-07",
  "POR-01", "POR-02",
]);

module.exports = {
  arvore, limparArvores, escrever, catalogo, CENARIOS_OBRIGATORIOS,
  zipCom, tarCom, comMagic, MAGIC,
  SERVIDOR_HTTP, SERVIDOR_NET, SERVIDOR_HTTPS, SERVIDOR_WS_MANUAL,
  SERVIDOR_PORTA_FIXA, PORTADOR_DE_INGRESSO, CLIENTE_HTML_INTEGRO,
  COMENTARIO_INOCENTE, TESTE_QUE_SIMULA_TRANSPORTE,
};
