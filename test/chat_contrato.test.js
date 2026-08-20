// test/chat_contrato.test.js — O CONTRATO COM A AUTORIDADE, e a fronteira.
//
// DOIS TRABALHOS, e os dois existem porque revisão de código não os garante:
//
// 1. O CONTRATO NÃO DIVERGIU (§24). `contrato/chat-transporte-v1.json` existe
//    IDÊNTICO neste repositório e no do app. Este arquivo afirma o digest dele.
//    Editar uma cópia e não a outra reprova aqui E na suíte do app — que é o
//    único jeito de impedir que nome de Function, região, campo de pedido, campo
//    de resposta ou código de recusa passem a discordar em silêncio entre dois
//    repositórios que ninguém compila junto.
//
//    O digest é sobre o conteúdo NORMALIZADO em LF. Sem normalizar, a mesma
//    árvore reprovaria no Windows (CRLF pelo autocrlf) e passaria no CI — o
//    contrário de um teste útil.
//
// 2. O SERVIDOR NÃO VIROU AUTORIDADE (§4). A regra inviolável da OS é que
//    bloqueio, sanção, autoria, identidade pública, validade de texto,
//    `messageId` e destinatários NÃO são decididos aqui. Isso é uma afirmação
//    sobre o CÓDIGO, e é varrível: se `server.js` passar a ler
//    `users/{uid}/blocks`, `playerModeration`, ou a recalcular destinatários,
//    este arquivo reprova.
//
// A VARREDURA É SOBRE CÓDIGO, NÃO SOBRE PROSA. Os comentários deste bundle
// FALAM de bloqueio, de sanção e de `playerModeration` — explicar o que não se
// faz é metade da documentação daqui. Procurar no arquivo cru daria falso
// positivo em cima da própria explicação, então tudo é varrido DEPOIS de tirar
// comentário e string literal.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const bundle = require("../server.js");
const {
  CHAT_FIO, CHAT_ACK, CHAT_RECUSA, CHAT_PAPEL, CHAT_SUPERFICIE_MESA,
} = bundle.require("servidor");

const RAIZ = path.resolve(__dirname, "..");
const CAMINHO_CONTRATO = path.join(RAIZ, "contrato", "chat-transporte-v1.json");
const FONTE = fs.readFileSync(path.join(RAIZ, "server.js"), "utf8");

/**
 * O digest esperado do contrato compartilhado.
 *
 * MUDAR O CONTRATO É MUDAR ESTE NÚMERO, nos DOIS repositórios, junto com o
 * arquivo. É trabalho de propósito: uma mudança de contrato que não exija tocar
 * as duas pontas é uma mudança que vai divergir.
 */
const DIGEST_CONTRATO = "a3ccdbab0730d807c8e954eee3e47d3e2c7b48933fcc1abcac01b5d09c2a2c23";

const contrato = JSON.parse(fs.readFileSync(CAMINHO_CONTRATO, "utf8"));

/** Tira comentário de linha, de bloco e string literal. */
function soCodigo(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/([^:])\/\/.*$/gm, "$1")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const CODIGO = soCodigo(FONTE);

/// A fatia CRUA do módulo servidor. Algumas afirmações precisam da string
/// literal intacta (ver CTR-B-04), e por isso existem as duas versões.
const FONTE_MODULO_SERVIDOR = FONTE.slice(
  FONTE.indexOf('__fabricas["servidor"]'),
  FONTE.indexOf('__fabricas["ws_server"]')
);

/// A fatia do MÓDULO servidor, já sem comentário. Algumas afirmações valem para
/// ele e não para o bundle inteiro: outros módulos legitimamente usam sha256.
const MODULO_SERVIDOR = soCodigo(FONTE_MODULO_SERVIDOR);

// ===========================================================================
// CTR-A — o contrato compartilhado
// ===========================================================================
test("CTR-A-01 o contrato tem o digest esperado", () => {
  const normalizado = fs.readFileSync(CAMINHO_CONTRATO, "utf8").replace(/\r\n/g, "\n");
  const digest = crypto.createHash("sha256").update(normalizado, "utf8").digest("hex");
  assert.equal(
    digest,
    DIGEST_CONTRATO,
    "o contrato mudou; atualize o digest AQUI e na suíte do app, e confira que os dois arquivos continuam idênticos"
  );
});

test("CTR-A-02 as constantes do servidor batem com o contrato", () => {
  // Sem isto, o servidor poderia mandar `chat_send` enquanto o contrato diz
  // `chat_enviar`, e ninguém saberia até um cliente real falhar.
  assert.equal(CHAT_FIO.PEDIDO, contrato.protocoloWebSocket.pedidoDoCliente);
  assert.equal(CHAT_FIO.ENTREGA, contrato.protocoloWebSocket.entregaAoDestinatario);
  assert.equal(CHAT_FIO.RECIBO, contrato.protocoloWebSocket.reciboAoRemetente);

  assert.equal(CHAT_ACK.ACEITA, contrato.ack.aceita);
  assert.equal(CHAT_ACK.REPETIDA, contrato.ack.repetida);
  assert.equal(CHAT_ACK.RECUSADA, contrato.ack.recusada);

  assert.equal(CHAT_SUPERFICIE_MESA, contrato.superficies.mesa);
  assert.equal(CHAT_PAPEL.SENTADO, contrato.papeis.sentado);
  assert.equal(CHAT_PAPEL.ESPECTADOR, contrato.papeis.espectador);
  assert.equal(CHAT_PAPEL.FORA, contrato.papeis.fora);
});

test("CTR-A-03 os códigos de recusa do fio são os do contrato", () => {
  assert.deepEqual(
    Object.values(CHAT_RECUSA).sort(),
    Object.entries(contrato.recusasNoFio)
      .filter(([k]) => !k.startsWith("//"))
      .map(([, v]) => v)
      .sort()
  );
});

test("CTR-A-04 o servidor chama as Functions com os nomes do contrato", () => {
  // Os nomes padrão da ponte são os do contrato.
  const { criarPonteDeChat } = bundle.require("chat_ponte");
  const pedidos = [];
  const ponte = criarPonteDeChat({
    credencial: { configurada: () => true, obterIdToken: () => Promise.resolve("tok") },
    projectId: "projeto-teste",
    chamar: (p) => {
      pedidos.push(p);
      return Promise.resolve({ status: 200, json: { result: {} } });
    },
  });

  return Promise.all([
    ponte.definirCanal({ canalId: "c", superficie: "s", participantes: [], aberto: true }),
    ponte.enviarMensagem({ autorUid: "u", intentId: "i", canalId: "c", superficie: "s", conteudo: "t" }),
  ]).then(() => {
    assert.match(pedidos[0].url, new RegExp("/" + contrato.funcoes.definirCanal + "$"));
    assert.match(pedidos[1].url, new RegExp("/" + contrato.funcoes.enviarPeloMotor + "$"));
    assert.ok(pedidos[0].url.includes(contrato.funcoes.regiao), "a região é a do contrato");
    // O pedido de envio carrega EXATAMENTE os campos do contrato.
    assert.deepEqual(
      Object.keys(pedidos[1].dados).sort(),
      contrato.pedidoEnviarPeloMotor.campos.slice().sort()
    );
  });
});

// ===========================================================================
// CTR-B — o servidor NÃO é autoridade
// ===========================================================================
test("CTR-B-01 o servidor não lê bloqueio nem estado disciplinar", () => {
  // A varredura é no CÓDIGO: os comentários do bundle falam destas coisas de
  // propósito, e procurar no arquivo cru reprovaria a própria explicação.
  for (const proibido of [
    "playerModeration",
    "chatSilenciadoAte",
    "socialRestritoAte",
    "suspensoAte",
    "suspensaoPermanente",
    "avaliarContato",
    "playerIdentities",
    "publicIdIndex",
    "publicProfiles",
  ]) {
    assert.equal(
      CODIGO.includes(proibido),
      false,
      proibido + " apareceu no CÓDIGO do servidor: ele passou a ser autoridade"
    );
  }
});

test("CTR-B-02 o servidor não ganhou firebase-admin", () => {
  const pacote = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
  assert.equal(pacote.dependencies, undefined, "o repositório é zero-dependência");
  assert.equal(pacote.devDependencies, undefined);
  assert.equal(CODIGO.includes("firebase-admin"), false);
  assert.equal(CODIGO.includes("firebase/firestore"), false);
});

test("CTR-B-03 a ponte de chat só usa built-ins do Node", () => {
  const i = FONTE.indexOf('__fabricas["chat_ponte"]');
  const f = FONTE.indexOf('__fabricas["servidor"]');
  assert.ok(i > 0 && f > i, "o módulo da ponte existe antes do servidor");
  const modulo = FONTE.slice(i, f);
  const requeridos = [...modulo.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(requeridos)].sort(), ["https"]);
});

test("CTR-B-04 o servidor não cunha messageId nem identidade pública", () => {
  // `messageId` é derivado pela autoridade (sha256 de autor+intenção). O servidor
  // só o repassa: ele aparece lendo `projecao.messageId`, nunca criando.
  assert.equal(/messageId\s*[:=]\s*(crypto|Math|Date|"|')/.test(CODIGO), false);
  assert.equal(CODIGO.includes("autorPublicId:"), false, "o servidor não monta identidade pública");
  // O único digest que o MÓDULO SERVIDOR calcula é o do canalId, e ele é do
  // CÓDIGO DA SALA — não de UID. Escopo de módulo porque `auth_firebase` e
  // `contas` também usam sha256, para outras coisas.
  //
  // A varredura aqui é no CRU, e não em `soCodigo`: o stripper troca string
  // literal por "" e apagaria o próprio "sha256" que se procura, fazendo a busca
  // devolver zero sempre — reprovaria um servidor correto. Identificador se
  // varre sem string; chamada que CARREGA string, não.
  const usosDeHash = [...FONTE_MODULO_SERVIDOR.matchAll(/createHash\("sha256"\)/g)].length;
  assert.equal(usosDeHash, 1, "há exatamente um digest no módulo servidor: o do canalId");
  // E ele é do CÓDIGO DA SALA: o prefixo do digest prova a origem.
  assert.match(FONTE_MODULO_SERVIDOR, /createHash\("sha256"\)[\s\S]{0,160}canal-de-chat/);
});

test("CTR-B-05 o servidor não recalcula destinatários", () => {
  // A entrega percorre a lista da autoridade. Uma varredura da SALA para montar
  // destinatários seria o servidor decidindo quem recebe.
  const i = CODIGO.indexOf("function entregarChat");
  assert.ok(i > 0, "a função de entrega existe");
  const corpo = CODIGO.slice(i, CODIGO.indexOf("function reciboDeChat"));
  assert.ok(corpo.includes("destinatarios"), "a entrega usa a lista da autoridade");
  assert.equal(corpo.includes("ger.salas"), false, "a entrega não olha a sala");
  assert.equal(corpo.includes("assentos"), false, "a entrega não varre assentos");
});

test("CTR-B-06 o chat não altera estado de partida", () => {
  // O `case` do chat chama UMA coisa, e ela não toca no jogo. Se alguém puser
  // `ger.aplicarJogada`, `sentar` ou `liquidar` no caminho do chat, reprova.
  const i = CODIGO.indexOf("async function processarChatEnviar");
  assert.ok(i > 0);
  // O fim do recorte é a próxima declaração de função — e NÃO um comentário,
  // porque `soCodigo` já tirou os comentários e o índice viria -1, fazendo a
  // fatia pegar o arquivo inteiro e reprovar por código que não é do chat.
  const resto = CODIGO.slice(i + 10);
  const fim = resto.search(/\n  (async )?function /);
  const corpo = fim === -1 ? CODIGO.slice(i) : CODIGO.slice(i, i + 10 + fim);
  for (const proibido of ["aplicarJogada", "iniciarPartida", "liquidar", "sair(", "avancarBots"]) {
    assert.equal(corpo.includes(proibido), false, "o chat mexe em " + proibido);
  }
});
