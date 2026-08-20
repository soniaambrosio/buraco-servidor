// test/chat_transporte.test.js — O TRANSPORTE DO CHAT (OS do Transporte Real V1).
//
// O QUE ESTA SUÍTE PROVA: que o servidor é TRANSPORTE, e nada além.
//
// Ela não prova regra de chat. Conteúdo, bloqueio, sanção, superfície,
// `messageId` e destinatários são decididos por `functions-moderacao`, e são
// provados lá (`chatdom`, `moderacaofn`, `chatemu`). O que se prova aqui é a
// outra metade, que nenhuma suíte do app alcança:
//
//   * o autor sai da CONEXÃO autenticada, nunca do payload;
//   * o canal sai da SALA, nunca do payload;
//   * o canal nasce, muda e fecha acompanhando o estado estável da mesa;
//   * a reconexão não cria outro canal;
//   * SOMENTE os destinatários devolvidos pela autoridade recebem;
//   * espectador não fala e não recebe;
//   * bot não participa;
//   * o pacote no fio não carrega UID, token nem lista interna;
//   * erro/timeout da autoridade não vira aprovação, e não mexe na partida.
//
// A PONTE É DUBLADA (§28). Nenhum teste desta suíte toca a rede: `pontefalsa()`
// substitui o transporte HTTPS inteiro e registra o que o servidor pediu. O
// contrato dublado é o REAL — os mesmos campos de pedido e de resposta que
// `contrato/chat-transporte-v1.json` declara, e `chat_contrato.test.js` afirma
// que ele não divergiu.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  bundle, cliente, emitirToken, novoParDeChaves, novoServidor, relogio, verificadorDeTeste,
} = require("./ajuda_auth.js");

const {
  canalIdDeCodigo, composicaoDoCanal, canalAberto, impressaoDoCanal,
  redigirRecusaDeChat, CHAT_FIO, CHAT_ACK, CHAT_RECUSA, CHAT_SUPERFICIE_MESA, CHAT_PAPEL,
} = bundle.require("servidor");

const CHAVE = novoParDeChaves("kid-chat-1");

const UID_A = "uid-alice";
const UID_B = "uid-bruno";
const UID_C = "uid-carla";
const UID_E = "uid-espectador";

/**
 * Ponte dublada: registra os pedidos e devolve o que o teste programar.
 *
 * `respostaDeEnvio` é função para que um caso possa mudar a resposta entre
 * chamadas (é assim que o retry devolve `jaEnviada: true`).
 */
function pontefalsa(opts = {}) {
  const canais = [];
  const envios = [];
  let contador = 0;

  return {
    canais,
    envios,
    configurada: () => true,
    definirCanal(pedido) {
      canais.push(JSON.parse(JSON.stringify(pedido)));
      if (opts.falharCanal) return Promise.reject(Object.assign(new Error("x"), { codigo: "PONTE_REDE" }));
      return Promise.resolve({ definido: true, canalId: pedido.canalId });
    },
    enviarMensagem(pedido) {
      envios.push(JSON.parse(JSON.stringify(pedido)));
      contador++;
      if (opts.envio) return opts.envio(pedido, contador);
      return Promise.resolve({
        enviada: true,
        jaEnviada: false,
        mensagem: {
          messageId: "msg" + contador,
          autorPublicId: "PUB-" + pedido.autorUid.slice(-1).toUpperCase(),
          superficie: pedido.superficie,
          canalId: pedido.canalId,
          conteudo: pedido.conteudo,
          enviadaEm: "2026-01-01T12:00:00.000Z",
          esquema: 1,
        },
        destinatarios: opts.destinatarios ? opts.destinatarios(pedido) : [],
      });
    },
  };
}

function servidorDeChat(ponte) {
  const tempo = relogio();
  return novoServidor({
    tempo,
    verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }),
    chatPonte: ponte,
  });
}

async function jogador(srv, uid) {
  const c = cliente(srv);
  await c.autentica(emitirToken({ chave: CHAVE, uid }));
  return c;
}

/** Mesa com Alice (criadora) e Bruno sentados. Devolve o código e os clientes. */
async function mesaComDois(srv) {
  const a = await jogador(srv, UID_A);
  a.envia({ tipo: "criarMesa", apelido: "Alice" });
  const codigo = a.ultimo("entrou").codigo;
  const b = await jogador(srv, UID_B);
  b.envia({ tipo: "entrarMesa", codigo, apelido: "Bruno" });
  return { a, b, codigo };
}

/** Espera as promessas pendentes da ponte (o envio é assíncrono). */
const drenar = () => new Promise((r) => setImmediate(r));

// ===========================================================================
// CHT-A — o autor e o canal vêm do servidor, nunca do payload
// ===========================================================================
test("CHT-A-01 jogador autenticado e sentado consegue pedir envio", async () => {
  const ponte = pontefalsa({ destinatarios: () => [UID_B] });
  const srv = servidorDeChat(ponte);
  const { a } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "boa jogada" });
  await drenar();

  assert.equal(ponte.envios.length, 1);
  assert.equal(ponte.envios[0].conteudo, "boa jogada");
  const ack = a.ultimo(CHAT_FIO.RECIBO);
  assert.equal(ack.resultado, CHAT_ACK.ACEITA);
  assert.equal(ack.messageId, "msg1");
});

test("CHT-A-02 conexão NÃO autenticada não pede envio", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const c = cliente(srv);

  c.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "sem login" });
  await drenar();

  // A fronteira de autenticação é anterior ao `switch`: nem chega ao chat.
  assert.equal(ponte.envios.length, 0);
  assert.equal(c.ultimo(CHAT_FIO.RECIBO), null, "nem recibo de chat existe");
  assert.equal(c.ultimo("erro").codigo, "ATUALIZACAO_OBRIGATORIA");
});

test("CHT-A-03 o autor sai da CONEXÃO: uid no payload não muda nada", async () => {
  const ponte = pontefalsa({ destinatarios: () => [UID_B] });
  const srv = servidorDeChat(ponte);
  const { a } = await mesaComDois(srv);

  // PRIMEIRO CAMINHO: `uid` está em CAMPOS_DE_IDENTIDADE, então a fronteira de
  // identidade do servidor (anterior a esta OS) RECUSA o comando inteiro. Mais
  // severo que ignorar o campo, e melhor: a tentativa não passa em silêncio.
  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "seria do Bruno", uid: UID_B });
  await drenar();

  assert.equal(ponte.envios.length, 0, "identidade divergente não chega ao chat");
  assert.equal(a.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");

  // SEGUNDO CAMINHO: `autorUid` e `senderUid` NÃO estão naquela lista, então
  // eles chegam ao `case` do chat. A prova aqui é que ninguém os lê: a autoria
  // sai de `c.jogadorId`, e o campo do payload não muda nada.
  a.envia({
    tipo: CHAT_FIO.PEDIDO,
    intentId: "i2",
    texto: "seria do Bruno de novo",
    autorUid: UID_B,
    senderUid: UID_B,
  });
  await drenar();

  assert.equal(ponte.envios.length, 1, "este passou pela fronteira");
  assert.equal(ponte.envios[0].autorUid, UID_A, "o autor é o da conexão");
});

test("CHT-A-04 o canal sai da SALA: canalId no payload não muda nada", async () => {
  const ponte = pontefalsa({ destinatarios: () => [UID_B] });
  const srv = servidorDeChat(ponte);
  const { a, codigo } = await mesaComDois(srv);

  a.envia({
    tipo: CHAT_FIO.PEDIDO,
    intentId: "i1",
    texto: "mesa alheia",
    canalId: canalIdDeCodigo("MESA-INVENTADA"),
    codigo: "MESA-INVENTADA",
    superficie: "saguao_publico",
  });
  await drenar();

  assert.equal(ponte.envios[0].canalId, canalIdDeCodigo(codigo));
  // [COMUNICACAO CONTROLADA] `superficie` saiu do pedido na versao 2 do
  // contrato: quem a deriva agora e a autoridade, a partir do AMBIENTE do
  // canal. A afirmacao equivalente — e mais forte — e que NADA do que o cliente
  // mandou atravessa: nem o canal inventado, nem a superficie, nem o codigo.
  assert.equal("superficie" in ponte.envios[0], false);
  assert.equal("codigo" in ponte.envios[0], false);
  // Sem `especie` no pedido, a autoridade recebe `tipo: null` — que ela le
  // como texto privado, o comportamento da versao 1.
  assert.equal(ponte.envios[0].tipo, null);
});

test("CHT-A-05 o pedido à autoridade tem SÓ os campos do contrato", async () => {
  // Um campo a mais aqui é um campo que o servidor decidiu — e ele não decide.
  const ponte = pontefalsa({ destinatarios: () => [UID_B] });
  const srv = servidorDeChat(ponte);
  const { a } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "oi", messageId: "meu", enviadaEm: "1999" });
  await drenar();

  // A lista da versao 2 do contrato compartilhado. Que ELA bate com o arquivo
  // do contrato e afirmado em chat_contrato.test.js (CTR-A-04); aqui o que se
  // afirma e que o servidor nao acrescenta nem esquece nenhum campo.
  assert.deepEqual(
    Object.keys(ponte.envios[0]).sort(),
    ["autorUid", "canalId", "conteudo", "intentId", "itemId", "tipo"]
  );
});

test("CHT-A-06 ESPECTADOR não envia", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const { codigo } = await mesaComDois(srv);

  const e = await jogador(srv, UID_E);
  e.envia({ tipo: "assistirMesa", codigo });
  e.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "sou plateia" });
  await drenar();

  assert.equal(ponte.envios.length, 0, "nem chega à autoridade");
  assert.equal(e.ultimo(CHAT_FIO.RECIBO).resultado, CHAT_ACK.RECUSADA);
  assert.equal(e.ultimo(CHAT_FIO.RECIBO).codigo, CHAT_RECUSA.SEM_ASSENTO);
});

test("CHT-A-07 quem não está em mesa não envia", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const solto = await jogador(srv, UID_C);

  solto.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "de lugar nenhum" });
  await drenar();

  assert.equal(ponte.envios.length, 0);
  assert.equal(solto.ultimo(CHAT_FIO.RECIBO).codigo, CHAT_RECUSA.SEM_ASSENTO);
});

// ===========================================================================
// CHT-B — ciclo de vida do canal
// ===========================================================================
test("CHT-B-01 criar mesa declara o canal", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const a = await jogador(srv, UID_A);
  a.envia({ tipo: "criarMesa", apelido: "Alice" });
  await drenar();

  assert.equal(ponte.canais.length, 1);
  const canal = ponte.canais[0];
  assert.equal(canal.canalId, canalIdDeCodigo(a.ultimo("entrou").codigo));
  // [COMUNICACAO CONTROLADA] A superficie saiu; entraram as duas dimensoes que
  // este processo tem fixadas na construcao. Sem topologia declarada — o caso
  // desta suite, e o padrao da base — vai `publica`, o ambiente online mais
  // restritivo. NUNCA `privada`, que e o unico com teclado.
  assert.equal("superficie" in canal, false);
  assert.equal(canal.tipoPartida, "publica");
  assert.equal(canal.categoriaCompetitiva, "casual");
  assert.equal(canal.codigoDaSala, null, "o codigo da sala nao viaja fora da Privada");
  assert.equal(canal.modo, "apenas_emotes");
  assert.equal(canal.aberto, true);
  assert.deepEqual(canal.participantes, [{ uid: UID_A, papel: CHAT_PAPEL.SENTADO }]);
});

test("CHT-B-02 novo assento atualiza a composição", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  await mesaComDois(srv);
  await drenar();

  const ultimo = ponte.canais[ponte.canais.length - 1];
  assert.deepEqual(
    ultimo.participantes.map((p) => p.uid).sort(),
    [UID_A, UID_B].sort()
  );
});

test("CHT-B-03 ESPECTADOR não entra na composição", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const { codigo } = await mesaComDois(srv);
  const antes = ponte.canais.length;

  const e = await jogador(srv, UID_E);
  e.envia({ tipo: "assistirMesa", codigo });
  await drenar();

  // Assistir não muda a composição, então não gera nem chamada nova.
  assert.equal(ponte.canais.length, antes, "assistir não redeclara o canal");
  const ultimo = ponte.canais[ponte.canais.length - 1];
  assert.equal(ultimo.participantes.some((p) => p.uid === UID_E), false);
});

test("CHT-B-04 BOT nunca entra na composição", async () => {
  // A mesa começa com dois humanos e o jogo preenche o resto com bots. Um bot no
  // canal seria destinatário sem pessoa — e um passo de bot que conversa (§21).
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const { a, codigo } = await mesaComDois(srv);
  a.envia({ tipo: "iniciarPartida" });
  await drenar();

  const sala = srv.ger.salas[codigo];
  assert.equal(sala.assentos.length, 4, "a mesa tem quatro assentos");
  assert.ok(sala.assentos.some((s) => s && s.tipo === "bot"), "há bot na mesa");

  const composicao = composicaoDoCanal(sala);
  assert.deepEqual(composicao.map((p) => p.uid).sort(), [UID_A, UID_B].sort());
  for (const p of composicao) assert.equal(p.papel, CHAT_PAPEL.SENTADO);
});

test("CHT-B-05 RECONEXÃO não cria outro canal", async () => {
  // O `canalId` é função só do código da sala: nem socket, nem assento, nem
  // contador de reconexão entram nele (§6).
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const { b, codigo } = await mesaComDois(srv);
  const idAntes = canalIdDeCodigo(codigo);
  const canaisAntes = ponte.canais.length;

  srv.desconectar(b.id);
  const b2 = await jogador(srv, UID_B);
  b2.envia({ tipo: "entrarMesa", codigo, apelido: "Bruno" });
  await drenar();

  assert.equal(canalIdDeCodigo(codigo), idAntes, "o canalId não mudou");
  for (const c of ponte.canais) {
    assert.equal(c.canalId, idAntes, "nenhuma declaração usou outro canalId");
  }
  // A composição volta ao mesmo conjunto, então a impressão volta a bater e a
  // reconexão não deixa o canal num estado novo.
  const sala = srv.ger.salas[codigo];
  assert.deepEqual(
    composicaoDoCanal(sala).map((p) => p.uid).sort(),
    [UID_A, UID_B].sort()
  );
  assert.ok(ponte.canais.length >= canaisAntes);
});

test("CHT-B-06 desconexão transitória não FECHA o canal", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const { b, codigo } = await mesaComDois(srv);

  srv.desconectar(b.id);
  await drenar();

  assert.equal(canalAberto(srv.ger.salas[codigo]), true);
  for (const c of ponte.canais) {
    assert.equal(c.aberto, true, "nenhuma declaração fechou o canal");
  }
});

test("CHT-B-07 encerramento definitivo FECHA o canal", async () => {
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const { a, codigo } = await mesaComDois(srv);
  a.envia({ tipo: "iniciarPartida" });
  await drenar();

  const sala = srv.ger.salas[codigo];
  assert.equal(canalAberto(sala), true);

  // `liquidada` é a marca autoritativa do encerramento da partida, gerenciada
  // por `salas.js` — não por esta OS.
  sala.liquidada = true;
  srv.broadcastSala(codigo);
  await drenar();

  assert.equal(canalAberto(sala), false);
  assert.equal(ponte.canais[ponte.canais.length - 1].aberto, false);
});

test("CHT-B-08 canal só é redeclarado quando o estado MUDA", async () => {
  // Sem a impressão, `broadcastSala` chamaria a autoridade a cada jogada.
  const ponte = pontefalsa();
  const srv = servidorDeChat(ponte);
  const { codigo } = await mesaComDois(srv);
  await drenar();
  const depoisDaMontagem = ponte.canais.length;

  srv.broadcastSala(codigo);
  srv.broadcastSala(codigo);
  srv.broadcastSala(codigo);
  await drenar();

  assert.equal(ponte.canais.length, depoisDaMontagem, "estado igual, nenhuma chamada nova");
});

// ===========================================================================
// CHT-C — entrega: só quem a autoridade autorizou
// ===========================================================================
test("CHT-C-01 os destinatários da autoridade são respeitados EXATAMENTE", async () => {
  const ponte = pontefalsa({ destinatarios: () => [UID_B] });
  const srv = servidorDeChat(ponte);
  const { a, b, codigo } = await mesaComDois(srv);
  const c = await jogador(srv, UID_C);
  c.envia({ tipo: "entrarMesa", codigo, apelido: "Carla" });
  await drenar();

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "só o Bruno lê" });
  await drenar();

  assert.equal(b.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA).length, 1);
  // Carla estava sentada e NÃO foi devolvida pela autoridade: ela não recebe nem
  // o pacote para descartar depois (§12).
  assert.equal(c.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA).length, 0);
  // O próprio remetente também não é destinatário: quem ecoa é a UI.
  assert.equal(a.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA).length, 0);
});

test("CHT-C-02 o servidor NÃO acrescenta quem ficou de fora", async () => {
  // Lista vazia é lista vazia: ninguém recebe, e o servidor não "corrige".
  const ponte = pontefalsa({ destinatarios: () => [] });
  const srv = servidorDeChat(ponte);
  const { a, b } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "ninguém lê" });
  await drenar();

  assert.equal(b.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA).length, 0);
});

test("CHT-C-03 ESPECTADOR não recebe, mesmo se a autoridade o listar", async () => {
  // Segunda tranca da mesma porta: a autoridade não põe espectador em
  // `destinatarios`, e se puser (defeito), o transporte ainda não entrega.
  const ponte = pontefalsa({ destinatarios: () => [UID_B, UID_E] });
  const srv = servidorDeChat(ponte);
  const { a, codigo } = await mesaComDois(srv);
  const e = await jogador(srv, UID_E);
  e.envia({ tipo: "assistirMesa", codigo });
  await drenar();

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "plateia não lê" });
  await drenar();

  assert.equal(e.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA).length, 0);
});

test("CHT-C-04 o pacote no fio é SÓ a projeção", async () => {
  const ponte = pontefalsa({ destinatarios: () => [UID_B] });
  const srv = servidorDeChat(ponte);
  const { a, b } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "olha o pacote" });
  await drenar();

  const pacote = b.recebidas.find((m) => m.tipo === CHAT_FIO.ENTREGA);
  assert.deepEqual(Object.keys(pacote).sort(), ["dados", "tipo"]);
  // O envelope não ganha informação nova (§13).
  assert.deepEqual(
    Object.keys(pacote.dados).sort(),
    ["autorPublicId", "canalId", "conteudo", "enviadaEm", "esquema", "messageId", "superficie"]
  );
});

test("CHT-C-05 UID, token e lista interna NÃO atravessam o fio", async () => {
  const ponte = pontefalsa({ destinatarios: () => [UID_B] });
  const srv = servidorDeChat(ponte);
  const { a, b } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "varredura" });
  await drenar();

  const cru = JSON.stringify(b.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA));
  for (const proibido of [UID_A, UID_B, UID_C, "destinatarios", "autorUid", "token"]) {
    assert.equal(cru.includes(proibido), false, "vazou " + proibido);
  }
});

// ===========================================================================
// CHT-D — recibo, idempotência de entrega e redação
// ===========================================================================
test("CHT-D-01 retry mantém o MESMO messageId e avisa repetição", async () => {
  // Autoridade: exactly-once lógico. Transporte: at-least-once com o MESMO id,
  // que é o que permite a UI futura deduplicar (§15).
  const ponte = pontefalsa({
    destinatarios: () => [UID_B],
    envio: (pedido, n) =>
      Promise.resolve({
        enviada: true,
        jaEnviada: n > 1,
        mensagem: {
          messageId: "msg-estavel",
          autorPublicId: "PUB-A",
          superficie: pedido.superficie,
          canalId: pedido.canalId,
          conteudo: pedido.conteudo,
          enviadaEm: "2026-01-01T12:00:00.000Z",
          esquema: 1,
        },
        destinatarios: [UID_B],
      }),
  });
  const srv = servidorDeChat(ponte);
  const { a, b } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "mesma", texto: "duas vezes" });
  await drenar();
  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "mesma", texto: "duas vezes" });
  await drenar();

  const recibos = a.recebidas.filter((m) => m.tipo === CHAT_FIO.RECIBO);
  assert.equal(recibos[0].resultado, CHAT_ACK.ACEITA);
  assert.equal(recibos[1].resultado, CHAT_ACK.REPETIDA);
  assert.equal(recibos[0].messageId, "msg-estavel");
  assert.equal(recibos[1].messageId, "msg-estavel");

  // A entrega repetida é aceitável; o id estável é o que a torna deduplicável.
  const entregas = b.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA);
  assert.equal(entregas.length, 2);
  assert.equal(entregas[0].dados.messageId, entregas[1].dados.messageId);
});


test("CHT-D-07 o RETRY entrega � lista da autoridade, n�o � sala", async () => {
  // A entrega repetida do at-least-once continua sendo ENTREGA: ela passa pelo
  // mesmo `entregarChat`, e a lista continua sendo a da autoridade. Recalcular
  // a partir de quem est� sentado seria furar bloqueio na segunda tentativa 
  // o caminho que ningu�m olha  e a mensagem chegaria a quem a autoridade
  // deixou de fora justamente por decis�o de modera��o.
  const ponte = pontefalsa({
    destinatarios: () => [UID_B], // Carla NUNCA est� na lista
    envio: (pedido, n) =>
      Promise.resolve({
        enviada: true,
        jaEnviada: n > 1,
        mensagem: {
          messageId: "msg-estavel",
          autorPublicId: "PUB-A",
          superficie: pedido.superficie,
          canalId: pedido.canalId,
          conteudo: pedido.conteudo,
          enviadaEm: "2026-01-01T12:00:00.000Z",
          esquema: 1,
        },
        destinatarios: [UID_B],
      }),
  });
  const srv = servidorDeChat(ponte);
  const { a, b, codigo } = await mesaComDois(srv);
  const c = await jogador(srv, UID_C);
  c.envia({ tipo: "entrarMesa", codigo, apelido: "Carla" });
  await drenar();
  assert.ok(Number.isInteger(srv.conexoes[c.id].assento), "Carla precisa estar SENTADA");

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "mesma", texto: "duas vezes" });
  await drenar();
  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "mesma", texto: "duas vezes" });
  await drenar();

  assert.equal(a.ultimo(CHAT_FIO.RECIBO).resultado, CHAT_ACK.REPETIDA, "o segundo pedido precisa ser retry");
  assert.equal(b.todas(CHAT_FIO.ENTREGA).length, 2, "quem a autoridade listou recebe as duas");
  assert.equal(c.todas(CHAT_FIO.ENTREGA).length, 0, "o retry recalculou os destinat�rios pela sala");
  assert.equal(a.todas(CHAT_FIO.ENTREGA).length, 0, "o autor n�o estava na lista e recebeu");
});
test("CHT-D-02 recusa da autoridade vira código REDIGIDO", async () => {
  // O fio não pode dizer "B te bloqueou" nem "B está suspenso" (§17).
  const ponte = pontefalsa({
    envio: () => Promise.reject(Object.assign(new Error("x"), { codigo: "PONTE_RECUSA", detalhe: "contatoRecusado" })),
  });
  const srv = servidorDeChat(ponte);
  const { a } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "bloqueado" });
  await drenar();

  const ack = a.ultimo(CHAT_FIO.RECIBO);
  assert.equal(ack.resultado, CHAT_ACK.RECUSADA);
  assert.equal(ack.codigo, CHAT_RECUSA.INDISPONIVEL);
  const cru = JSON.stringify(ack);
  for (const proibido of ["bloque", "suspens", "sancao", "sanção", "playerModeration", UID_B]) {
    assert.equal(cru.toLowerCase().includes(proibido.toLowerCase()), false, "vazou " + proibido);
  }
});

test("CHT-D-03 TIMEOUT não é aprovação", async () => {
  const ponte = pontefalsa({
    envio: () => Promise.reject(Object.assign(new Error("x"), { codigo: "PONTE_TIMEOUT" })),
  });
  const srv = servidorDeChat(ponte);
  const { a, b } = await mesaComDois(srv);

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "silêncio da autoridade" });
  await drenar();

  assert.equal(a.ultimo(CHAT_FIO.RECIBO).resultado, CHAT_ACK.RECUSADA);
  assert.equal(a.ultimo(CHAT_FIO.RECIBO).codigo, CHAT_RECUSA.TENTE_DE_NOVO);
  assert.equal(b.recebidas.filter((m) => m.tipo === CHAT_FIO.ENTREGA).length, 0);
});

test("CHT-D-04 erro da autoridade não mexe na partida nem no assento", async () => {
  const ponte = pontefalsa({
    envio: () => Promise.reject(Object.assign(new Error("x"), { codigo: "PONTE_REDE" })),
  });
  const srv = servidorDeChat(ponte);
  const { a, b, codigo } = await mesaComDois(srv);
  a.envia({ tipo: "iniciarPartida" });
  await drenar();

  const antes = JSON.stringify(srv.ger.salas[codigo].assentos);
  const vezAntes = srv.ger.salas[codigo].jogo.vez;

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "vai falhar" });
  await drenar();

  assert.equal(JSON.stringify(srv.ger.salas[codigo].assentos), antes, "assentos intactos");
  assert.equal(srv.ger.salas[codigo].jogo.vez, vezAntes, "a vez não mudou");
  assert.equal(a.derrubada, false);
  assert.equal(b.derrubada, false);
});

test("CHT-D-05 falha ao declarar o canal não derruba a mesa", async () => {
  const ponte = pontefalsa({ falharCanal: true });
  const srv = servidorDeChat(ponte);
  const { a, codigo } = await mesaComDois(srv);
  await drenar();

  assert.ok(srv.ger.salas[codigo], "a sala existe");
  assert.equal(a.derrubada, false);
  assert.equal(a.ultimo("entrou").codigo, codigo);
});

test("CHT-D-06 sem ponte injetada, o chat recusa e o jogo segue", async () => {
  // Sem padrão permissivo: a ausência da ponte não abre um caminho local que
  // gravaria mensagem sem passar pela autoridade.
  const srv = servidorDeChat(null);
  const a = await jogador(srv, UID_A);
  a.envia({ tipo: "criarMesa", apelido: "Alice" });
  const codigo = a.ultimo("entrou").codigo;

  a.envia({ tipo: CHAT_FIO.PEDIDO, intentId: "i1", texto: "sem ponte" });
  await drenar();

  assert.equal(a.ultimo(CHAT_FIO.RECIBO).resultado, CHAT_ACK.RECUSADA);
  assert.ok(srv.ger.salas[codigo], "a mesa continua de pé");
});

// ===========================================================================
// CHT-E — as primitivas, direto
// ===========================================================================
test("CHT-E-01 canalId é opaco, estável e não é o código da sala", async () => {
  const id = canalIdDeCodigo("BURACO-1234");
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(id.includes("BURACO"), false, "o código da sala é chave de entrada e não pode vazar");
  assert.equal(id, canalIdDeCodigo("BURACO-1234"), "estável");
  assert.notEqual(id, canalIdDeCodigo("BURACO-1235"));
});

test("CHT-E-02 a composição ignora assento vazio, bot e humano sem uid", async () => {
  const sala = {
    assentos: [
      { tipo: "humano", jogadorId: UID_A },
      null,
      { tipo: "bot", jogadorId: null, apelido: "Robô" },
      { tipo: "humano", jogadorId: null },
    ],
  };
  assert.deepEqual(composicaoDoCanal(sala), [{ uid: UID_A, papel: CHAT_PAPEL.SENTADO }]);
});

test("CHT-E-03 a impressão muda com composição e com aceitação", async () => {
  const base = { assentos: [{ tipo: "humano", jogadorId: UID_A }], liquidada: false };
  const maisUm = { assentos: base.assentos.concat([{ tipo: "humano", jogadorId: UID_B }]), liquidada: false };
  const fechada = { assentos: base.assentos, liquidada: true };

  assert.equal(impressaoDoCanal(base), impressaoDoCanal({ ...base }));
  assert.notEqual(impressaoDoCanal(base), impressaoDoCanal(maisUm));
  assert.notEqual(impressaoDoCanal(base), impressaoDoCanal(fechada));
});

test("CHT-E-04 a redação de recusa é lista de PERMISSÃO", async () => {
  assert.equal(redigirRecusaDeChat("contatoRecusado"), CHAT_RECUSA.INDISPONIVEL);
  assert.equal(redigirRecusaDeChat("suspensaoImpedeChat"), CHAT_RECUSA.SILENCIADO);
  assert.equal(redigirRecusaDeChat("conteudoVazio"), CHAT_RECUSA.TEXTO_INVALIDO);
  assert.equal(redigirRecusaDeChat("canalFechado"), CHAT_RECUSA.CANAL_FECHADO);
  // Código novo e desconhecido NÃO passa cru: vira o genérico.
  assert.equal(redigirRecusaDeChat("motivoQueNinguemMapeou"), CHAT_RECUSA.TENTE_DE_NOVO);
  assert.equal(redigirRecusaDeChat(undefined), CHAT_RECUSA.TENTE_DE_NOVO);
  assert.equal(redigirRecusaDeChat("playerModeration"), CHAT_RECUSA.TENTE_DE_NOVO);
});
