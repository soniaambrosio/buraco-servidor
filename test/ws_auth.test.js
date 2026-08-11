// test/ws_auth.test.js — FRONTEIRA DE IDENTIDADE DA CONEXÃO.
//
// A pergunta que esta suíte responde é uma só:
//
//     o cliente consegue decidir quem ele é?
//
// A resposta tem que ser NÃO em todos os caminhos. O cliente apresenta uma
// credencial; quem decide a identidade é o servidor; e a identidade fica
// grudada na conexão até ela morrer.
//
// Estes testes FALHAM no servidor antigo (onde `c.jogadorId = msg.jogadorId`).

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AUTH, T0,
  cliente, emitirToken, novoParDeChaves, novoServidor, relogio, verificadorDeTeste,
} = require("./ajuda_auth.js");

const CHAVE = novoParDeChaves("kid-ws-1");
const UID_A = "uid-jogadora-A";
const UID_B = "uid-jogador-B";

function ambiente(opts = {}) {
  const tempo = relogio();
  const srv = novoServidor(
    Object.assign({ verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }) }, opts)
  );
  return { srv, tempo };
}

const tokenA = () => emitirToken({ chave: CHAVE, uid: UID_A });
const tokenB = () => emitirToken({ chave: CHAVE, uid: UID_B });

// ===========================================================================
// §23 — O TESTE NEGATIVO PRINCIPAL
// ===========================================================================

test("cliente_nao_pode_se_passar_por_outro_jogador", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autentica(tokenA()); // credencial legítima da jogadora A

  // ... e agora tenta agir como B, mandando o jogadorId do B no comando.
  a.limpar();
  a.envia({ tipo: "criarMesa", apelido: "Impostor", jogadorId: UID_B });

  const erro = a.ultimo("erro");
  assert.ok(erro, "o comando forjado tinha que ser recusado");
  assert.equal(erro.codigo, "IDENTIDADE_DIVERGENTE");
  assert.equal(a.ultimo("entrou"), null, "nenhuma mesa pode ter sido criada");

  // e nada, em lugar nenhum do servidor, ficou pertencendo ao B
  assert.equal(Object.keys(srv.ger.salas).length, 0);
  assert.equal(srv.conexoes[a.id].jogadorId, UID_A);
  assert.equal(srv.conexoes[a.id].uidAutenticado, UID_A);
});

// ===========================================================================
// §21 — PRÉ-AUTENTICAÇÃO: nenhum comando privilegiado executa
// ===========================================================================

test("antes de autenticar, nenhum comando de jogador executa", () => {
  const { srv } = ambiente();
  const c = cliente(srv);
  assert.equal(c.estadoAuth, AUTH.NAO_AUTENTICADO);

  const comandos = [
    { tipo: "criarMesa", apelido: "Ninguém", jogadorId: UID_A },
    { tipo: "entrarMesa", codigo: "MESA-1", apelido: "Ninguém" },
    { tipo: "iniciarPartida" },
    { tipo: "jogada", jogada: { tipo: "comprarMonte" } },
    { tipo: "perfil", jogadorId: UID_A },
    { tipo: "ranking" },
    { tipo: "definirAvatar", jogadorId: UID_A, galeria: 2 },
    { tipo: "denunciarAvatar", alvo: UID_B },
    { tipo: "afkBot" },
    { tipo: "afkVoltar" },
    { tipo: "sair" },
    { tipo: "tipoQueNemExiste" },
  ];

  for (const cmd of comandos) {
    c.limpar();
    c.envia(cmd);
    const erro = c.ultimo("erro");
    assert.ok(erro, "sem resposta de recusa para " + cmd.tipo);
    assert.equal(erro.codigo, "NAO_AUTENTICADO", "recusa errada para " + cmd.tipo);
    assert.equal(c.ultimo("entrou"), null, cmd.tipo + " não podia entrar em mesa");
    assert.equal(c.ultimo("estado"), null, cmd.tipo + " não podia receber estado");
    assert.equal(c.ultimo("perfil"), null, cmd.tipo + " não podia receber perfil");
    assert.equal(c.ultimo("ranking"), null, cmd.tipo + " não podia receber ranking");
    assert.equal(c.ultimo("avatar"), null, cmd.tipo + " não podia mexer em avatar");
  }

  // e nada aconteceu do lado de dentro
  assert.equal(Object.keys(srv.ger.salas).length, 0);
  assert.equal(c.estadoAuth, AUTH.NAO_AUTENTICADO);
});

test("comandos represados antes da autenticação não executam depois sozinhos", async () => {
  const { srv } = ambiente();
  const c = cliente(srv);

  c.envia({ tipo: "criarMesa", apelido: "Fila", metaPontos: 100 });
  assert.equal(Object.keys(srv.ger.salas).length, 0);

  await c.autentica(tokenA());
  // autenticar NÃO desengaveta comando nenhum: quem reenvia é o cliente.
  assert.equal(Object.keys(srv.ger.salas).length, 0, "o comando pré-auth não podia rodar retroativamente");

  c.envia({ tipo: "criarMesa", apelido: "Fila", metaPontos: 100 });
  assert.equal(Object.keys(srv.ger.salas).length, 1, "reenviado depois de autenticar, aí sim roda");
});

test("credencial recusada: fail closed, conexão derrubada e nenhum comando passa", async () => {
  const { srv, tempo } = ambiente();
  const expirado = emitirToken({ chave: CHAVE, uid: UID_A, emitidoEm: T0, validoPorS: 60 });
  tempo.avancarS(3600);

  const c = cliente(srv);
  const ok = await c.autentica(expirado);

  assert.equal(ok, false);
  assert.equal(c.estadoAuth, AUTH.NAO_AUTENTICADO);
  assert.equal(c.derrubada, true, "credencial recusada tem que derrubar a conexão");
  assert.equal(srv.conexoes[c.id].jogadorId, null, "não pode ter sobrado identidade nenhuma");

  c.envia({ tipo: "criarMesa", apelido: "Insistente" });
  assert.equal(c.ultimo("erro").codigo, "NAO_AUTENTICADO");
  assert.equal(Object.keys(srv.ger.salas).length, 0);
});

test("a recusa não conta ao cliente POR QUE falhou (§19)", async () => {
  const { srv, tempo } = ambiente();
  const casos = [
    ["ausente", undefined],
    ["vazio", ""],
    ["malformado", "isso-nao-e-jwt"],
    ["outro projeto", emitirToken({ chave: CHAVE, uid: UID_A, aud: "outro-projeto" })],
    ["assinatura falsa", emitirToken({ chave: CHAVE, uid: UID_A, assinarCom: novoParDeChaves("kid-ws-1") })],
    ["expirado", emitirToken({ chave: CHAVE, uid: UID_A, emitidoEm: T0 - 7200000, validoPorS: 60 })],
  ];
  const respostas = new Set();
  for (const [rotulo, token] of casos) {
    const c = cliente(srv);
    await c.autentica(token);
    const r = c.ultimo("authFalhou");
    assert.ok(r, "sem resposta de recusa em: " + rotulo);
    respostas.add(JSON.stringify(r));
  }
  assert.equal(respostas.size, 1, "todas as recusas têm que ser indistinguíveis para o cliente");
  assert.equal(JSON.parse([...respostas][0]).motivo, "credencial recusada");
});

test("FAIL CLOSED: servidor sem verificador não autentica ninguém", async () => {
  const srv = novoServidor(); // sem verificarToken: é o padrão recusar tudo
  const c = cliente(srv);
  const ok = await c.autentica(tokenA());
  assert.equal(ok, false);
  assert.equal(c.estadoAuth, AUTH.NAO_AUTENTICADO);
  c.envia({ tipo: "criarMesa", apelido: "X" });
  assert.equal(c.ultimo("erro").codigo, "NAO_AUTENTICADO");
});

// ===========================================================================
// §11 e §12 — IMPERSONAÇÃO
// ===========================================================================

test("token A + jogadorId A funciona (o campo redundante não atrapalha)", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autentica(tokenA());
  a.envia({ tipo: "criarMesa", apelido: "Sônia", jogadorId: UID_A });

  assert.ok(a.ultimo("entrou"), "identidade coerente tinha que passar");
  assert.equal(a.ultimo("erro"), null);
});

test("token A sem jogadorId nenhum funciona (o campo virou dispensável)", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autentica(tokenA());
  a.envia({ tipo: "criarMesa", apelido: "Sônia" });

  const entrou = a.ultimo("entrou");
  assert.ok(entrou);
  // o assento pertence ao uid do TOKEN, sem o cliente ter dito nada
  assert.equal(srv.ger.salas[entrou.codigo].assentos[0].jogadorId, UID_A);
});

test("qualquer apelido de campo de identidade divergente é recusado", async () => {
  const { srv } = ambiente();
  for (const campo of ["jogadorId", "uid", "playerId", "usuarioId", "ownerId"]) {
    const a = cliente(srv);
    await a.autentica(tokenA());
    a.limpar();
    a.envia({ tipo: "criarMesa", apelido: "Impostor", [campo]: UID_B });

    const erro = a.ultimo("erro");
    assert.ok(erro, "campo '" + campo + "' passou batido");
    assert.equal(erro.codigo, "IDENTIDADE_DIVERGENTE", "campo: " + campo);
    assert.equal(a.ultimo("entrou"), null, "campo: " + campo);
  }
  assert.equal(Object.keys(srv.ger.salas).length, 0);
});

test("a divergência é barrada em TODO comando, não só na entrada de mesa", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autentica(tokenA());
  a.envia({ tipo: "criarMesa", apelido: "Sônia" });

  for (const cmd of [
    { tipo: "perfil", jogadorId: UID_B },
    { tipo: "definirAvatar", jogadorId: UID_B, galeria: 3 },
    { tipo: "entrarMesa", codigo: "MESA-1", jogadorId: UID_B },
    { tipo: "jogada", jogadorId: UID_B, jogada: { tipo: "comprarMonte" } },
    { tipo: "iniciarPartida", jogadorId: UID_B },
    { tipo: "sair", jogadorId: UID_B },
  ]) {
    a.limpar();
    a.envia(cmd);
    const erro = a.ultimo("erro");
    assert.ok(erro, "passou sem recusa: " + cmd.tipo);
    assert.equal(erro.codigo, "IDENTIDADE_DIVERGENTE", "comando: " + cmd.tipo);
  }

  // e a conexão continua na mesa dela, intacta
  assert.equal(srv.conexoes[a.id].codigo, "MESA-1");
  assert.equal(srv.conexoes[a.id].jogadorId, UID_A);
});

test("perfil e avatar leem/escrevem SÓ a conta da conexão autenticada", async () => {
  const { srv } = ambiente();

  const b = cliente(srv);
  await b.autentica(tokenB());
  b.envia({ tipo: "definirAvatar", galeria: 7 });
  const avatarDoB = b.ultimo("avatar");
  assert.ok(avatarDoB && avatarDoB.conta);

  const a = cliente(srv);
  await a.autentica(tokenA());
  a.envia({ tipo: "perfil" });
  const perfilDoA = a.ultimo("perfil");
  assert.ok(perfilDoA.conta, "A recebe a conta dela");
  assert.equal(perfilDoA.conta.id, UID_A, "e é a conta do uid autenticado");

  // A tenta trocar o avatar do B: recusado, e o avatar do B fica como estava
  a.limpar();
  a.envia({ tipo: "definirAvatar", jogadorId: UID_B, galeria: 1 });
  assert.equal(a.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");
  assert.equal(a.ultimo("avatar"), null);

  b.limpar();
  b.envia({ tipo: "perfil" });
  assert.equal(b.ultimo("perfil").conta.avatar, avatarDoB.conta.avatar, "o avatar do B não foi mexido");
});

// ===========================================================================
// §10 — A IDENTIDADE FICA VINCULADA E IMUTÁVEL
// ===========================================================================

test("reapresentar a credencial de OUTRO jogador não troca a identidade", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autentica(tokenA());
  assert.equal(srv.conexoes[a.id].jogadorId, UID_A);

  const trocou = await a.autentica(tokenB()); // token do B, válido, na conexão da A
  assert.equal(trocou, false);
  assert.equal(a.derrubada, true, "tentativa de troca de identidade derruba a conexão");
  assert.equal(srv.conexoes[a.id].uidAutenticado, UID_A, "a identidade continua sendo a A");
  assert.equal(srv.conexoes[a.id].jogadorId, UID_A);
});

test("reapresentar a PRÓPRIA credencial é inofensivo", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autentica(tokenA());
  const ok = await a.autentica(tokenA());

  assert.equal(ok, true);
  assert.equal(a.derrubada, false);
  assert.equal(srv.conexoes[a.id].uidAutenticado, UID_A);
});

test("a identidade da conexão não é gravável nem por dentro do servidor", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autentica(tokenA());

  const c = srv.conexoes[a.id];
  try { c.jogadorId = UID_B; } catch (_) { /* strict mode lança; sloppy só ignora */ }
  try { c.uidAutenticado = UID_B; } catch (_) {}

  assert.equal(c.jogadorId, UID_A);
  assert.equal(c.uidAutenticado, UID_A);
});

test("§12 — o jogadorId do domínio é DERIVADO pelo servidor, não recebido", async () => {
  // aqui a derivação deixa de ser identidade, provando que quem manda na
  // associação uid → jogador é o servidor
  const { srv } = ambiente({ jogadorIdDoUid: (uid) => "jogador::" + uid });
  const a = cliente(srv);
  await a.autentica(tokenA());

  assert.equal(srv.conexoes[a.id].uidAutenticado, UID_A);
  assert.equal(srv.conexoes[a.id].jogadorId, "jogador::" + UID_A);

  // o cliente mandando o uid cru continua coerente (é a identidade dele)
  a.envia({ tipo: "criarMesa", apelido: "Sônia", uid: UID_A });
  const entrou = a.ultimo("entrou");
  assert.ok(entrou);
  assert.equal(srv.ger.salas[entrou.codigo].assentos[0].jogadorId, "jogador::" + UID_A);
});

// ===========================================================================
// §8 — OS DOIS CAMINHOS DE TRANSPORTE DA CREDENCIAL
// ===========================================================================

test("autenticação pela primeira mensagem do protocolo (caminho do navegador)", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  assert.equal(a.estadoAuth, AUTH.NAO_AUTENTICADO);

  await a.autenticaPorMensagem(tokenA());
  assert.equal(a.estadoAuth, AUTH.AUTENTICADO);
  assert.equal(a.ultimo("autenticado").jogadorId, UID_A);

  a.envia({ tipo: "criarMesa", apelido: "Sônia" });
  assert.ok(a.ultimo("entrou"));
});

test("{tipo:'auth'} com token ruim recusa igual pela mensagem", async () => {
  const { srv } = ambiente();
  const a = cliente(srv);
  await a.autenticaPorMensagem("token-invalido");

  assert.equal(a.estadoAuth, AUTH.NAO_AUTENTICADO);
  assert.equal(a.ultimo("authFalhou").motivo, "credencial recusada");
  assert.equal(a.derrubada, true);
});

test("durante a verificação em curso, nenhum comando passa e nem outra credencial", async () => {
  let liberar;
  const espera = new Promise((r) => { liberar = r; });
  const srv = novoServidor({ verificarToken: () => espera.then(() => ({ ok: true, uid: UID_A })) });

  const a = cliente(srv);
  const emCurso = a.autentica(tokenA());
  assert.equal(a.estadoAuth, AUTH.AUTENTICANDO);

  a.envia({ tipo: "criarMesa", apelido: "Apressado" });
  assert.equal(a.ultimo("erro").codigo, "NAO_AUTENTICADO");
  assert.equal(Object.keys(srv.ger.salas).length, 0);

  await a.autentica(tokenB()); // segunda credencial na corrida: recusada
  assert.equal(a.ultimo("authFalhou").motivo, "credencial recusada");

  liberar();
  await emCurso;
  assert.equal(srv.conexoes[a.id].uidAutenticado, UID_A);
});

// ===========================================================================
// §14 — RECONEXÃO
// ===========================================================================

test("reconexão exige autenticar de novo: a conexão nova nasce sem identidade", async () => {
  const { srv } = ambiente();

  const antiga = cliente(srv);
  await antiga.autentica(tokenA());
  antiga.envia({ tipo: "criarMesa", apelido: "Sônia", metaPontos: 100 });
  const codigo = antiga.ultimo("entrou").codigo;

  srv.desconectar(antiga.id); // queda

  // volta: mesma pessoa, conexão nova, SEM credencial
  const nova = cliente(srv);
  assert.equal(nova.estadoAuth, AUTH.NAO_AUTENTICADO);
  assert.equal(srv.conexoes[nova.id].jogadorId, null);

  nova.envia({ tipo: "entrarMesa", codigo, apelido: "Sônia", jogadorId: UID_A });
  assert.equal(nova.ultimo("erro").codigo, "NAO_AUTENTICADO", "retomar sem credencial tem que ser recusado");
  assert.equal(nova.ultimo("entrou"), null);

  // agora com credencial válida: entra normalmente
  await nova.autentica(tokenA());
  nova.envia({ tipo: "entrarMesa", codigo, apelido: "Sônia" });
  assert.ok(nova.ultimo("entrou"), "com credencial válida a volta é permitida");
  assert.equal(srv.conexoes[nova.id].jogadorId, UID_A);
});

test("na volta, o B não retoma o lugar do A alegando o jogadorId do A", async () => {
  const { srv } = ambiente();

  const a = cliente(srv);
  await a.autentica(tokenA());
  a.envia({ tipo: "criarMesa", apelido: "Sônia", metaPontos: 100 });
  const codigo = a.ultimo("entrou").codigo;
  srv.desconectar(a.id);

  const impostor = cliente(srv);
  await impostor.autentica(tokenB()); // credencial legítima... do B
  impostor.envia({ tipo: "entrarMesa", codigo, apelido: "Sônia", jogadorId: UID_A });

  assert.equal(impostor.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");
  assert.equal(impostor.ultimo("entrou"), null);
  assert.equal(srv.conexoes[impostor.id].jogadorId, UID_B);
});

test("a queda no meio da verificação não deixa identidade órfã", async () => {
  let liberar;
  const espera = new Promise((r) => { liberar = r; });
  const srv = novoServidor({ verificarToken: () => espera.then(() => ({ ok: true, uid: UID_A })) });

  const a = cliente(srv);
  const emCurso = a.autentica(tokenA());
  srv.desconectar(a.id);
  liberar();

  assert.equal(await emCurso, false);
  assert.equal(srv.conexoes[a.id], undefined);
});
