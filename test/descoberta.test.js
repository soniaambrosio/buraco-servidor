// test/descoberta.test.js — DESCOBERTA DE MESAS PÚBLICAS E PRESENÇA AGREGADA V1
// (OS 38.1, §9)
//
// QUATRO TRABALHOS, e os quatro existem porque revisão de código não os dá:
//
// 1. O QUE APARECE. Mesa privada, VIP/ranqueada, encerrada ou malformada não
//    pode entrar na lista, e a prova disso não é ler o `if` — é montar cada uma
//    dessas mesas e não encontrá-la.
// 2. O QUE ATRAVESSA. `uid`, `jogadorId` e `admissaoId` moram na sala e no
//    assento. A prova de que não vazam é uma VARREDURA do payload serializado
//    contra os uids realmente vivos naquele servidor — não uma leitura da lista
//    branca, que descreve a intenção e não o resultado.
// 3. QUEM É CONTADO. Dois sockets, dois aparelhos, queda suja, reconexão dentro
//    e fora do lease, credencial vencida, espectador. Cada um desses é uma
//    forma diferente de o mesmo número ficar errado.
// 4. QUE O CLIENTE NÃO MANDA NO NÚMERO. A consulta é só leitura, ignora `msg`
//    por inteiro e não move nem versão de sala nem estado de mesa.
//
// O ARNÊS É O DE PRODUÇÃO. `novoServidor`/`cliente`/`relogio` de `ajuda_auth.js`
// — verificador real com chaves de teste, fronteira de autenticação intacta,
// relógio injetado. Nenhuma porta foi aberta para o teste passar: a projeção é
// pedida pelo MESMO `descobrirMesas` que o aplicativo vai mandar.
//
// SOBRE `salaForjada`: alguns casos precisam de uma sala que `criarMesa` RECUSA
// (meta 60, modalidade inventada, `assentos` malformado). Elas são escritas
// direto no registro DE PROPÓSITO — o ponto é justamente provar que a projeção
// também as recusa, para o dia em que apareça um caminho de escrita novo que a
// criação de mesa não guarde.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  AUTH,
  T0,
  bundle,
  cliente,
  emitirToken,
  novoParDeChaves,
  novoServidor,
  relogio,
  verificadorDeTeste,
} = require("./ajuda_auth.js");

const D = bundle.require("descoberta");
const P = bundle.require("presenca");
const SALAS = bundle.require("salas");
const SERVIDOR = bundle.require("servidor");
const { criarContas } = bundle.require("contas");
const { DESCOBERTA_FIO, RITMO_DESCOBERTA_MS, RITMO_PULSO_MS } = SERVIDOR;

const PAR = novoParDeChaves("kid-descoberta");
const tokenDe = (uid) => emitirToken({ chave: PAR, uid, emitidoEm: T0 });

// ---------------------------------------------------------------------------
// ARNÊS
// ---------------------------------------------------------------------------

/** Servidor cujas mesas são PÚBLICAS e CASUAIS — a configuração que hospeda a
 *  descoberta. `tipoPartida` e `categoriaCompetitiva` vêm da CONSTRUÇÃO, como
 *  em produção: não há parâmetro de mensagem que os alcance.
 *
 *  Código de mesa com dois dígitos (`M-01`, `M-02`) e não `MESA-1`: o desempate
 *  final é lexicográfico, e `MESA-10 < MESA-2` faria o teste medir o zero à
 *  esquerda em vez da regra. */
function bancada(opts = {}) {
  const tempo = relogio();
  const contas = criarContas({ persistir: false });
  let n = 0;
  const srv = novoServidor(
    Object.assign(
      {
        tempo,
        contas,
        tipoPartida: "publica",
        gerarCodigo: () => "M-" + String(++n).padStart(2, "0"),
        verificarToken: verificadorDeTeste({ chaves: [PAR], tempo }),
      },
      opts
    )
  );
  return { srv, tempo, contas };
}

/** Conexão autenticada de verdade, pela porta de produção. */
async function conectado(srv, uid) {
  const c = cliente(srv);
  await c.autentica(tokenDe(uid));
  c.__srv = srv;
  return c;
}

/** Cria uma mesa pelo despachante e devolve o código. */
async function abrirMesa(srv, { uid, apelido = "Jogador", modalidade = "sbtl", metaPontos = 2000 } = {}) {
  const c = await conectado(srv, uid);
  c.envia({ tipo: "criarMesa", apelido, modalidade, metaPontos });
  return { cliente: c, codigo: srv.conexoes[c.id] ? srv.conexoes[c.id].codigo : null };
}

/** Senta mais um humano na mesa. */
async function sentar(srv, codigo, { uid, apelido = "Convidado" } = {}) {
  const c = await conectado(srv, uid);
  c.envia({ tipo: "entrarMesa", codigo, apelido });
  return c;
}

/** A projeção pelo FIO, que é como o aplicativo a receberá. */
function pedirLista(c) {
  c.envia({ tipo: DESCOBERTA_FIO.PEDIDO });
  return c.ultimo(DESCOBERTA_FIO.RESPOSTA);
}

/** Pede de novo, ignorando o limite de frequência.
 *
 *  O limite é PROVADO com relógio em D-59/D-60/D-61. Nos demais casos ele é
 *  ruído. Zerar o carimbo aqui mexe no ARNÊS, não no servidor: nenhuma
 *  checagem do caminho de produção é desligada, e a resposta continua vindo
 *  pelo mesmo `descobrirMesas`. */
function pedirDeNovo(c) {
  const cx = c.__srv.conexoes[c.id];
  if (cx) cx._ritmoDescoberta = null;
  c.limpar();
  return pedirLista(c);
}

/** Todo texto de um payload, recursivamente — chave E valor, em qualquer
 *  profundidade. É com isto que a varredura de vazamento trabalha. */
function textosDe(valor, saida = []) {
  if (valor == null) return saida;
  if (typeof valor === "string") { saida.push(valor); return saida; }
  if (typeof valor !== "object") return saida;
  for (const [k, v] of Object.entries(valor)) { saida.push(k); textosDe(v, saida); }
  return saida;
}

/** Nenhum dos segredos aparece em nenhum canto do payload. */
function semVazamento(payload, segredos) {
  const textos = textosDe(payload);
  const cru = JSON.stringify(payload);
  for (const s of segredos) {
    if (!s) continue;
    assert.ok(!textos.includes(s), "segredo '" + s + "' apareceu como texto na projeção");
    assert.ok(cru.indexOf(s) === -1, "segredo '" + s + "' apareceu no payload serializado");
  }
}

/** Os uids REALMENTE vivos neste servidor — colhidos do registro, não digitados.
 *  Lista digitada não acompanha o arnês; esta acompanha. */
function segredosVivos(srv) {
  const s = new Set();
  for (const cod of Object.keys(srv.ger.salas)) {
    const sala = srv.ger.salas[cod];
    if (!sala || !Array.isArray(sala.assentos)) continue;
    for (const a of sala.assentos) {
      if (a && a.jogadorId) s.add(a.jogadorId);
      if (a && a.admissaoId) s.add(a.admissaoId);
    }
  }
  for (const cid of Object.keys(srv.conexoes)) {
    const cx = srv.conexoes[cid];
    if (cx && cx.uidAutenticado) s.add(cx.uidAutenticado);
    if (cx && cx.jogadorId) s.add(cx.jogadorId);
  }
  return s;
}

/** Sala de teste bem-formada, escrita direto no registro. Ver o cabeçalho. */
function salaForjada(over = {}) {
  return Object.assign(
    {
      codigo: "FORJADA1",
      modalidade: "sbtl",
      metaPontos: 2000,
      criadaEm: T0,
      aposta: 0,
      criadorAssento: 0,
      assentos: [{ apelido: "Forjado", tipo: "humano", jogadorId: "uid-forjado" }, null, null, null],
      iniciada: false,
      jogo: null,
      liquidada: false,
      resumoFinal: null,
      log: [],
      tipoPartida: "publica",
      categoriaCompetitiva: "casual",
      partidaId: null,
      participantes: null,
      envelopeEncerramento: null,
      versaoEstado: 0,
      eventoId: null,
      impressaoEstado: null,
    },
    over
  );
}

const CAMPOS_DA_RESPOSTA = ["esquema", "geracao", "revisao", "geradoEm", "mesas", "presenca"];
const CAMPOS_DA_MESA = [
  "codigo", "nome", "modalidade", "metaPontos", "capacidade",
  "jogadores", "bots", "ocupados", "vagas", "assentos",
  "estadoIngresso", "ingressavel", "aguardandoHaMs", "revisao",
];
const CAMPOS_DO_ASSENTO = ["assento", "ocupado", "tipo", "apelido", "avatarGaleria"];
const CAMPOS_DA_PRESENCA = [
  "jogadoresOnlineTotal", "espectadoresOnline",
  "jogadoresEmMesasPublicas", "jogadoresEmMesasPublicasAguardando",
  "jogadoresEmMesasPublicasEmAndamento",
  "mesasPublicas", "mesasPublicasComVagas", "porModalidade",
];

// ===========================================================================
test("§4 — O QUE APARECE E O QUE NÃO APARECE", async (t) => {
// ===========================================================================

  await t.test("D-01 lista vazia: nenhuma mesa, contagens em zero, forma completa", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-a");
    const r = pedirLista(c);
    assert.equal(r.esquema, D.ESQUEMA);
    assert.deepEqual(r.mesas, []);
    assert.equal(r.presenca.mesasPublicas, 0);
    assert.equal(r.presenca.mesasPublicasComVagas, 0);
    assert.equal(r.presenca.jogadoresEmMesasPublicas, 0);
    assert.equal(r.presenca.espectadoresOnline, 0);
    // Quem PERGUNTA está online: lista vazia não é servidor vazio.
    assert.equal(r.presenca.jogadoresOnlineTotal, 1);
    for (const m of D.MODALIDADES_PUBLICAS) {
      assert.equal(r.presenca.porModalidade[m].mesas, 0);
      assert.equal(r.presenca.porModalidade[m].jogadores, 0);
      assert.equal(r.presenca.porModalidade[m].mesasComVagas, 0);
    }
  });

  await t.test("D-02 uma mesa: listas FECHADAS, nada a mais e nada a menos", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "uid-dono", apelido: "Ana" });
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    assert.deepEqual(Object.keys(r).sort(), ["tipo"].concat(CAMPOS_DA_RESPOSTA).sort());
    assert.equal(r.mesas.length, 1);
    assert.deepEqual(Object.keys(r.mesas[0]).sort(), CAMPOS_DA_MESA.slice().sort());
    assert.deepEqual(Object.keys(r.presenca).sort(), CAMPOS_DA_PRESENCA.slice().sort());
    for (const a of r.mesas[0].assentos) {
      assert.deepEqual(Object.keys(a).sort(), CAMPOS_DO_ASSENTO.slice().sort());
    }
  });

  await t.test("D-03 várias mesas aparecem, cada uma uma vez", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "u1" });
    await abrirMesa(srv, { uid: "u2" });
    await abrirMesa(srv, { uid: "u3" });
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    assert.equal(r.mesas.length, 3);
    assert.equal(new Set(r.mesas.map((m) => m.codigo)).size, 3);
    assert.equal(r.presenca.mesasPublicas, 3);
  });

  await t.test("D-04 processo de MESA PRIVADA não publica nada", async () => {
    // A Mesa Privada é benefício VIP: sem autorizador, `criarMesa` falha
    // fechada e nem sala existe. É o caminho de produção, não uma sala forjada.
    const { srv } = bancada({ tipoPartida: "privada" });
    const { codigo } = await abrirMesa(srv, { uid: "uid-dono" });
    assert.equal(codigo, null, "sem autorizador VIP a mesa privada nem nasce");
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    assert.deepEqual(r.mesas, []);
    // E se uma sala privada existisse no registro, também não sairia.
    srv.ger.salas["PRIVADA1"] = salaForjada({ codigo: "PRIVADA1", tipoPartida: "privada" });
    assert.deepEqual(pedirDeNovo(c).mesas, []);
  });

  await t.test("D-05 mesa VIP/RANQUEADA não aparece", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-olheiro");
    srv.ger.salas["VIP-0001"] = salaForjada({ codigo: "VIP-0001", categoriaCompetitiva: "vip_ranqueada" });
    srv.ger.salas["CASUAL01"] = salaForjada({ codigo: "CASUAL01" });
    const r = pedirLista(c);
    assert.deepEqual(r.mesas.map((m) => m.codigo), ["CASUAL01"]);
    semVazamento(r, ["VIP-0001", "vip_ranqueada"]);
  });

  await t.test("D-06 categoria DESCONHECIDA não aparece (fail closed)", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-olheiro");
    srv.ger.salas["DESC0001"] = salaForjada({ codigo: "DESC0001", categoriaCompetitiva: "desconhecida" });
    srv.ger.salas["DESC0002"] = salaForjada({ codigo: "DESC0002", categoriaCompetitiva: undefined });
    srv.ger.salas["CASUAL01"] = salaForjada({ codigo: "CASUAL01" });
    assert.deepEqual(pedirLista(c).mesas.map((m) => m.codigo), ["CASUAL01"]);
  });

  await t.test("D-07 mesa ENCERRADA não aparece — pelos DOIS marcadores", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-olheiro");
    srv.ger.salas["ENCER-01"] = salaForjada({ codigo: "ENCER-01", liquidada: true });
    srv.ger.salas["ENCER-02"] = salaForjada({ codigo: "ENCER-02", envelopeEncerramento: { versaoContrato: 1 } });
    srv.ger.salas["VIVA-001"] = salaForjada({ codigo: "VIVA-001" });
    assert.deepEqual(pedirLista(c).mesas.map((m) => m.codigo), ["VIVA-001"]);
  });

  await t.test("D-08 modalidade FORA da tabela do motor não aparece", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-olheiro");
    srv.ger.salas["MOD-0001"] = salaForjada({ codigo: "MOD-0001", modalidade: "modalidade-inventada" });
    srv.ger.salas["MOD-0002"] = salaForjada({ codigo: "MOD-0002", modalidade: "" });
    srv.ger.salas["MOD-0003"] = salaForjada({ codigo: "MOD-0003", modalidade: "aberto" });
    assert.deepEqual(pedirLista(c).mesas.map((m) => m.codigo), ["MOD-0003"]);
  });

  await t.test("D-09 meta FORA das canônicas não aparece", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-olheiro");
    srv.ger.salas["META-001"] = salaForjada({ codigo: "META-001", metaPontos: 60 });
    srv.ger.salas["META-002"] = salaForjada({ codigo: "META-002", metaPontos: "2000" });
    srv.ger.salas["META-003"] = salaForjada({ codigo: "META-003", metaPontos: 1500 });
    assert.deepEqual(pedirLista(c).mesas.map((m) => m.codigo), ["META-003"]);
  });

  await t.test("D-10 sala MALFORMADA não aparece", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-olheiro");
    srv.ger.salas["MAL-0001"] = salaForjada({ codigo: "MAL-0001", assentos: [null, null] });
    srv.ger.salas["MAL-0002"] = salaForjada({ codigo: "MAL-0002", assentos: null });
    srv.ger.salas["MAL-0003"] = salaForjada({ codigo: "MAL-0003", codigo2: 1, assentos: [null, null, null, null, null] });
    srv.ger.salas["MAL-0004"] = null;
    srv.ger.salas["MAL-0005"] = salaForjada({ codigo: "MAL-0005" });
    assert.deepEqual(pedirLista(c).mesas.map((m) => m.codigo), ["MAL-0005"]);
  });

  await t.test("D-11 mesa EM ANDAMENTO aparece, marcada, e não conta como vaga", async () => {
    const { srv } = bancada();
    const { cliente: dono, codigo } = await abrirMesa(srv, { uid: "uid-dono" });
    dono.envia({ tipo: "iniciarPartida" });
    assert.equal(srv.ger.salas[codigo].iniciada, true);
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    assert.equal(r.mesas.length, 1);
    assert.equal(r.mesas[0].estadoIngresso, D.INGRESSO.EM_ANDAMENTO);
    assert.equal(r.mesas[0].ingressavel, false);
    assert.equal(r.presenca.mesasPublicasComVagas, 0);
  });
});

// ===========================================================================
test("§4 — CONTEÚDO DA ENTRADA E SANITIZAÇÃO", async (t) => {
// ===========================================================================

  await t.test("D-12 Meta e modalidade saem exatamente como a sala congelou", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "u1", modalidade: "fechado", metaPontos: 1500 });
    await abrirMesa(srv, { uid: "u2", modalidade: "aberto", metaPontos: 3000 });
    const c = await conectado(srv, "uid-olheiro");
    const porModalidade = {};
    for (const m of pedirLista(c).mesas) porModalidade[m.modalidade] = m;
    assert.equal(porModalidade.fechado.metaPontos, 1500);
    assert.equal(porModalidade.aberto.metaPontos, 3000);
    assert.ok(SALAS.METAS_CANONICAS.includes(porModalidade.fechado.metaPontos));
  });

  await t.test("D-13 assentos ocupados e livres, quatro posições na ordem", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "uid-dono", apelido: "Ana" });
    await sentar(srv, codigo, { uid: "uid-b", apelido: "Bruno" });
    const c = await conectado(srv, "uid-olheiro");
    const m = pedirLista(c).mesas[0];
    assert.equal(m.assentos.length, 4);
    assert.deepEqual(m.assentos.map((a) => a.assento), [0, 1, 2, 3]);
    // ORDEM PARCEIRO-PRIMEIRO: o 2º humano senta no assento 2.
    assert.deepEqual(m.assentos.map((a) => a.ocupado), [true, false, true, false]);
    assert.equal(m.assentos[0].apelido, "Ana");
    assert.equal(m.assentos[2].apelido, "Bruno");
    assert.equal(m.assentos[1].apelido, null);
    assert.equal(m.assentos[1].tipo, null);
    assert.equal(m.jogadores, 2);
    assert.equal(m.ocupados, 2);
    assert.equal(m.vagas, 2);
    assert.equal(m.capacidade, 4);
    assert.equal(m.bots, 0);
  });

  await t.test("D-14 bots ocupam assento mas NÃO são jogadores", async () => {
    const { srv } = bancada();
    const { cliente: dono } = await abrirMesa(srv, { uid: "uid-dono" });
    dono.envia({ tipo: "iniciarPartida" });
    const c = await conectado(srv, "uid-olheiro");
    const m = pedirLista(c).mesas[0];
    assert.equal(m.ocupados, 4);
    assert.equal(m.jogadores, 1);
    assert.equal(m.bots, 3);
    assert.equal(m.vagas, 0);
    assert.deepEqual(m.assentos.map((a) => a.tipo), ["humano", "bot", "bot", "bot"]);
    // Bot não tem avatar e não ganha um por acidente.
    assert.deepEqual(m.assentos.slice(1).map((a) => a.avatarGaleria), [null, null, null]);
  });

  await t.test("D-15 NENHUM uid, jogadorId ou admissaoId atravessa — varredura do payload", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "uid-segredo-do-dono", apelido: "Ana" });
    await sentar(srv, codigo, { uid: "uid-segredo-do-b", apelido: "Bruno" });
    const c = await conectado(srv, "uid-segredo-do-olheiro");
    const r = pedirLista(c);
    const segredos = segredosVivos(srv);
    assert.ok(segredos.size >= 3, "o arnês tem de ter uid de verdade para varrer");
    semVazamento(r, segredos);
    const textos = textosDe(r);
    for (const proibida of ["jogadorId", "admissaoId", "uid", "uidAutenticado", "tentativaEntradaId"]) {
      assert.ok(!textos.includes(proibida), "chave proibida '" + proibida + "' na projeção");
    }
  });

  await t.test("D-16 avatar: galeria atravessa; FOTO não vira id nem rota", async () => {
    const { srv, contas } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "uid-galeria", apelido: "Ana" });
    await sentar(srv, codigo, { uid: "uid-foto", apelido: "Bruno" });
    contas.definirAvatarGaleria("uid-galeria", 7);
    const r = contas.definirAvatarFoto("uid-foto", Buffer.from("x".repeat(400)).toString("base64"));
    assert.equal(r.avatarTipo, "foto", "o arnês tem de ter mesmo uma foto para a prova valer");

    const c = await conectado(srv, "uid-olheiro");
    const m = pedirLista(c).mesas[0];
    assert.equal(m.assentos[0].avatarGaleria, 7);
    assert.equal(m.assentos[2].avatarGaleria, null, "foto não vira índice de galeria");
    semVazamento(m, ["uid-galeria", "uid-foto"]);
  });

  await t.test("D-17 `avatarDeGaleria` recusa foto e conta inexistente, na primitiva", () => {
    const cofre = {
      obter: (id) => ({
        "quem-tem-galeria": { avatarTipo: "galeria", avatarId: 3 },
        "quem-tem-foto": { avatarTipo: "foto", avatarId: null },
        "quem-nao-tem": { avatarTipo: null, avatarId: null },
        "galeria-podre": { avatarTipo: "galeria", avatarId: "nao-e-numero" },
      }[id] || null),
    };
    assert.equal(D.avatarDeGaleria(cofre, "quem-tem-galeria"), 3);
    assert.equal(D.avatarDeGaleria(cofre, "quem-tem-foto"), null);
    assert.equal(D.avatarDeGaleria(cofre, "quem-nao-tem"), null);
    assert.equal(D.avatarDeGaleria(cofre, "galeria-podre"), null);
    assert.equal(D.avatarDeGaleria(cofre, "nao-existe"), null);
    assert.equal(D.avatarDeGaleria(null, "quem-tem-galeria"), null);
  });

  await t.test("D-18 nome público é derivado de quem está sentado, nunca de uid", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "uid-dono", apelido: "Ana" });
    const c = await conectado(srv, "uid-olheiro");
    const m = pedirLista(c).mesas[0];
    assert.equal(m.nome, "Mesa de Ana");
    assert.ok(m.nome.indexOf("uid-") === -1);
  });

  await t.test("D-19 sem humano nenhum, o nome cai no código — e não quebra", () => {
    const sala = salaForjada({ codigo: "SOZINHA1", assentos: [null, null, null, null] });
    const assentos = D.ocupacaoSanitizada(sala, null);
    assert.equal(D.nomePublico(sala, assentos), "Mesa SOZINHA1");
  });

  await t.test("D-20 apelido é cortado no mesmo limite do cofre (24)", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "uid-dono", apelido: "A".repeat(80) });
    const c = await conectado(srv, "uid-olheiro");
    assert.equal(pedirLista(c).mesas[0].assentos[0].apelido.length, 24);
  });

  await t.test("D-21 estadoIngresso cobre os TRÊS estados do ciclo de vida", async () => {
    const { srv } = bancada();
    const { codigo: a } = await abrirMesa(srv, { uid: "u-a" });
    const { codigo: b } = await abrirMesa(srv, { uid: "u-b1" });
    await sentar(srv, b, { uid: "u-b2" });
    await sentar(srv, b, { uid: "u-b3" });
    await sentar(srv, b, { uid: "u-b4" });
    const { cliente: dono, codigo: cCod } = await abrirMesa(srv, { uid: "u-c" });
    dono.envia({ tipo: "iniciarPartida" });

    const olho = await conectado(srv, "uid-olheiro");
    const porCodigo = {};
    for (const m of pedirLista(olho).mesas) porCodigo[m.codigo] = m;
    assert.equal(porCodigo[a].estadoIngresso, D.INGRESSO.AGUARDANDO);
    assert.equal(porCodigo[a].ingressavel, true);
    assert.equal(porCodigo[b].estadoIngresso, D.INGRESSO.CHEIA);
    assert.equal(porCodigo[b].ingressavel, false);
    assert.equal(porCodigo[b].vagas, 0);
    assert.equal(porCodigo[cCod].estadoIngresso, D.INGRESSO.EM_ANDAMENTO);
    assert.equal(porCodigo[cCod].ingressavel, false);
  });

  await t.test("D-21b mesa INICIADA com assento vazio continua não sendo ingressável", async () => {
    // O caminho de produção enche a mesa de bot ao iniciar, então "iniciada com
    // vaga" não é alcançável hoje. O invariante que se guarda aqui é o OUTRO,
    // e ele é sobre a REGRA: quem manda é `iniciada`, não a aritmética de
    // assento. Se um caminho futuro liberar assento no meio da partida, a lista
    // não pode passar a convidar gente para uma porta que `entrarMesa` fecha.
    const { srv } = bancada();
    const olho = await conectado(srv, "uid-olheiro");
    srv.ger.salas["ANDANDO1"] = salaForjada({
      codigo: "ANDANDO1",
      iniciada: true,
      assentos: [{ apelido: "Ana", tipo: "humano", jogadorId: "uid-ana" }, null, null, null],
    });
    const r = pedirLista(olho);
    assert.equal(r.mesas.length, 1);
    assert.equal(r.mesas[0].vagas, 3, "o arnês tem de ter mesmo assento vazio");
    assert.equal(r.mesas[0].estadoIngresso, D.INGRESSO.EM_ANDAMENTO);
    assert.equal(r.mesas[0].ingressavel, false);
    // E ela não entra em "mesas com vagas" — nem no total, nem na modalidade.
    assert.equal(r.presenca.mesasPublicasComVagas, 0);
    assert.equal(r.presenca.porModalidade.sbtl.mesasComVagas, 0);
    assert.equal(r.presenca.porModalidade.sbtl.mesas, 1);
  });

  await t.test("D-22 INVARIANTES: nunca negativo, nunca acima da capacidade", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "u0" });
    await sentar(srv, codigo, { uid: "u0b" });
    for (let i = 1; i < 4; i++) await abrirMesa(srv, { uid: "u" + i });
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    assert.ok(r.mesas.length >= 4);
    for (const m of r.mesas) {
      assert.ok(m.jogadores >= 0 && m.bots >= 0 && m.vagas >= 0 && m.ocupados >= 0);
      assert.ok(m.ocupados <= m.capacidade);
      assert.ok(m.jogadores <= m.ocupados);
      assert.equal(m.vagas, m.capacidade - m.ocupados);
      assert.equal(m.ocupados, m.jogadores + m.bots);
    }
    for (const chave of Object.keys(r.presenca)) {
      if (typeof r.presenca[chave] === "number") assert.ok(r.presenca[chave] >= 0, chave);
    }
  });

  await t.test("D-23 ocupação acima da capacidade é recusada ANTES de virar entrada", () => {
    const um = { apelido: "X", tipo: "humano", jogadorId: "uid-x" };
    assert.equal(D.ehPublicavel(salaForjada({ assentos: [um, um, um, um, um] })), false);
    assert.equal(D.ehPublicavel(salaForjada({ assentos: [um, um, um] })), false);
    assert.equal(D.ehPublicavel(salaForjada({ assentos: [um, null, null, null] })), true);
    // E o diagnóstico é CONTAGEM, nunca o dado.
    const reg = D.criarRegistroDeDescoberta();
    const d = reg.diagnostico();
    assert.equal(typeof d.descartadasPorInvariante, "number");
    assert.ok(!JSON.stringify(d).includes("uid"));
  });
});

// ===========================================================================
test("§5 — ORDENAÇÃO CANÔNICA", async (t) => {
// ===========================================================================

  await t.test("D-24 3/4 antes de 2/4 antes de 1/4", async () => {
    const { srv } = bancada();
    const { codigo: um } = await abrirMesa(srv, { uid: "a1" });
    const { codigo: dois } = await abrirMesa(srv, { uid: "b1" });
    await sentar(srv, dois, { uid: "b2" });
    const { codigo: tres } = await abrirMesa(srv, { uid: "c1" });
    await sentar(srv, tres, { uid: "c2" });
    await sentar(srv, tres, { uid: "c3" });

    const olho = await conectado(srv, "uid-olheiro");
    const r = pedirLista(olho);
    assert.deepEqual(r.mesas.map((m) => m.jogadores), [3, 2, 1]);
    assert.deepEqual(r.mesas.map((m) => m.codigo), [tres, dois, um]);
  });

  await t.test("D-25 INGRESSÁVEL vem antes, por mais cheia que a outra esteja", async () => {
    const { srv } = bancada();
    const { cliente: dono, codigo: andando } = await abrirMesa(srv, { uid: "x1" });
    await sentar(srv, andando, { uid: "x2" });
    await sentar(srv, andando, { uid: "x3" });
    dono.envia({ tipo: "iniciarPartida" });
    const { codigo: espera } = await abrirMesa(srv, { uid: "y1" });

    const olho = await conectado(srv, "uid-olheiro");
    const r = pedirLista(olho);
    assert.deepEqual(r.mesas.map((m) => m.codigo), [espera, andando]);
    assert.equal(r.mesas[0].ingressavel, true);
    assert.equal(r.mesas[0].jogadores, 1);
    assert.equal(r.mesas[1].jogadores, 3);
  });

  await t.test("D-26 desempate: quem espera há MAIS TEMPO vem primeiro", async () => {
    const { srv, tempo } = bancada();
    const { codigo: velha } = await abrirMesa(srv, { uid: "v1" });
    tempo.avancarMs(10000);
    const { codigo: nova } = await abrirMesa(srv, { uid: "n1" });
    const olho = await conectado(srv, "uid-olheiro");
    const r = pedirLista(olho);
    assert.deepEqual(r.mesas.map((m) => m.jogadores), [1, 1]);
    assert.deepEqual(r.mesas.map((m) => m.codigo), [velha, nova]);
    assert.ok(r.mesas[0].aguardandoHaMs > r.mesas[1].aguardandoHaMs);
  });

  await t.test("D-27 o cliente NÃO compra posição: `criadaEm` é imutável na sala", async () => {
    const { srv, tempo } = bancada();
    const { codigo: velha } = await abrirMesa(srv, { uid: "v1" });
    tempo.avancarMs(10000);
    const { codigo: nova } = await abrirMesa(srv, { uid: "n1" });
    try { srv.ger.salas[nova].criadaEm = 0; } catch (_) {}
    assert.notEqual(srv.ger.salas[nova].criadaEm, 0);
    const olho = await conectado(srv, "uid-olheiro");
    assert.deepEqual(pedirLista(olho).mesas.map((m) => m.codigo), [velha, nova]);
  });

  await t.test("D-28 desempate final por código: ordem TOTAL e estável", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "a" });
    await abrirMesa(srv, { uid: "b" });
    await abrirMesa(srv, { uid: "c" });
    const olho = await conectado(srv, "uid-olheiro");
    const primeira = pedirLista(olho).mesas.map((m) => m.codigo);
    assert.deepEqual(primeira, primeira.slice().sort());
    const segunda = srv.projetarDescoberta().mesas.map((m) => m.codigo);
    assert.deepEqual(segunda, primeira);
  });

  await t.test("D-29 o comparador é ordem total: reflexivo e antissimétrico", () => {
    const base = { ingressavel: true, jogadores: 2, criadaEm: 100, codigo: "AAA" };
    assert.equal(D.compararMesas(base, Object.assign({}, base)), 0);
    const outro = { ingressavel: true, jogadores: 2, criadaEm: 100, codigo: "BBB" };
    assert.ok(D.compararMesas(base, outro) < 0);
    assert.ok(D.compararMesas(outro, base) > 0);
    // A precedência dos critérios, um a um.
    assert.ok(D.compararMesas({ ingressavel: true, jogadores: 0, criadaEm: 9, codigo: "Z" },
                              { ingressavel: false, jogadores: 3, criadaEm: 1, codigo: "A" }) < 0);
    assert.ok(D.compararMesas({ ingressavel: true, jogadores: 3, criadaEm: 9, codigo: "Z" },
                              { ingressavel: true, jogadores: 2, criadaEm: 1, codigo: "A" }) < 0);
    assert.ok(D.compararMesas({ ingressavel: true, jogadores: 2, criadaEm: 1, codigo: "Z" },
                              { ingressavel: true, jogadores: 2, criadaEm: 9, codigo: "A" }) < 0);
  });
});

// ===========================================================================
test("§6 — PRESENÇA: DEDUPLICAÇÃO", async (t) => {
// ===========================================================================

  await t.test("D-30 dois SOCKETS do mesmo jogador contam UMA pessoa", async () => {
    const { srv } = bancada();
    await conectado(srv, "uid-a");
    const c2 = await conectado(srv, "uid-a");
    assert.equal(srv.presenca.totalDeJogadores(), 1);
    assert.equal(srv.presenca.sessoesDe("uid-a"), 2);
    assert.equal(pedirLista(c2).presenca.jogadoresOnlineTotal, 1);
  });

  await t.test("D-31 dois APARELHOS e mais um jogador: duas pessoas", async () => {
    const { srv } = bancada();
    await conectado(srv, "uid-a"); // celular
    await conectado(srv, "uid-a"); // tablet
    const outro = await conectado(srv, "uid-b");
    assert.equal(pedirLista(outro).presenca.jogadoresOnlineTotal, 2);
    assert.equal(srv.presenca.sessoesDe("uid-a"), 2);
  });

  await t.test("D-32 fechar UMA aba não derruba a pessoa", async () => {
    const { srv } = bancada();
    const aba1 = await conectado(srv, "uid-a");
    const aba2 = await conectado(srv, "uid-a");
    srv.desconectar(aba1.id);
    assert.equal(srv.presenca.totalDeJogadores(), 1);
    assert.equal(srv.presenca.sessoesDe("uid-a"), 1);
    srv.desconectar(aba2.id);
    assert.equal(srv.presenca.totalDeJogadores(), 0);
  });

  await t.test("D-33 desconexão LIMPA remove na hora", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-a");
    const olho = await conectado(srv, "uid-olheiro");
    assert.equal(pedirLista(olho).presenca.jogadoresOnlineTotal, 2);
    srv.desconectar(c.id);
    assert.equal(pedirDeNovo(olho).presenca.jogadoresOnlineTotal, 1);
  });

  await t.test("D-34 a chave é o uid: id de sessão vazio ou nulo não cria presença", () => {
    const pres = P.criarRegistroDePresenca({ agora: () => T0 });
    assert.equal(pres.renovar("", "s1"), null);
    assert.equal(pres.renovar(null, "s1"), null);
    assert.equal(pres.renovar("uid-a", ""), null);
    assert.equal(pres.renovar("uid-a", null), null);
    assert.equal(pres.totalDeJogadores(), 0);
    assert.ok(pres.renovar("uid-a", "s1"));
    assert.equal(pres.totalDeJogadores(), 1);
    // Idempotente por (uid, sessão): dez renovações não são dez presenças.
    for (let i = 0; i < 10; i++) pres.renovar("uid-a", "s1");
    assert.equal(pres.sessoesDe("uid-a"), 1);
    // E o retrato de diagnóstico não carrega uid nenhum.
    assert.ok(!JSON.stringify(pres.estado()).includes("uid-a"));
  });
});

// ===========================================================================
test("§6.3 — PRESENÇA: EXPIRAÇÃO, QUEDA E RECONEXÃO", async (t) => {
// ===========================================================================

  await t.test("D-35 QUEDA ABRUPTA: sem evento de saída, o lease vence sozinho", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    await conectado(srv, "uid-caiu");
    const olho = await conectado(srv, "uid-olheiro");
    assert.equal(pedirLista(olho).presenca.jogadoresOnlineTotal, 2);
    // O cabo foi arrancado: NINGUÉM chama `desconectar`. A conexão continua no
    // mapa, exatamente como num servidor que não percebeu a queda.
    assert.ok(srv.conexoes[Object.keys(srv.conexoes)[0]]);
    tempo.avancarMs(45001);
    assert.equal(pedirDeNovo(olho).presenca.jogadoresOnlineTotal, 1);
  });

  await t.test("D-36 TTL: presente em T-1, ausente em T", () => {
    const tempo = relogio();
    const pres = P.criarRegistroDePresenca({ agora: () => tempo.agoraMs, ttlMs: 45000 });
    pres.renovar("uid-a", "s1");
    tempo.avancarMs(44999);
    assert.equal(pres.estaPresente("uid-a"), true, "T-1 ainda presente");
    tempo.avancarMs(1);
    assert.equal(pres.estaPresente("uid-a"), false, "em T o lease já venceu");
    assert.equal(pres.totalDeJogadores(), 0);
  });

  await t.test("D-37 RECONEXÃO DENTRO do lease: continua UMA pessoa, UMA sessão", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    const antiga = await conectado(srv, "uid-a");
    tempo.avancarMs(20000);
    srv.desconectar(antiga.id);
    await conectado(srv, "uid-a");
    assert.equal(srv.presenca.totalDeJogadores(), 1);
    assert.equal(srv.presenca.sessoesDe("uid-a"), 1);
  });

  await t.test("D-38 RECONEXÃO FORA do lease: volta a UMA, nunca a duas", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    await conectado(srv, "uid-a"); // e cai sem avisar
    tempo.avancarMs(60000);
    assert.equal(srv.presenca.totalDeJogadores(), 0, "o lease velho venceu");
    await conectado(srv, "uid-a");
    assert.equal(srv.presenca.totalDeJogadores(), 1);
    assert.equal(srv.presenca.sessoesDe("uid-a"), 1);
  });

  await t.test("D-39 PONG do keepalive renova a presença de quem está PARADO", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    const c = await conectado(srv, "uid-parado");
    // Três batidas de keepalive (20 s cada) sem UMA mensagem de aplicação.
    tempo.avancarMs(20000); assert.equal(srv.pulsar(c.id), true);
    tempo.avancarMs(20000); assert.equal(srv.pulsar(c.id), true);
    tempo.avancarMs(20000); assert.equal(srv.pulsar(c.id), true);
    assert.equal(srv.presenca.estaPresente("uid-parado"), true);
    tempo.avancarMs(45001); // parou de pulsar
    assert.equal(srv.presenca.estaPresente("uid-parado"), false);
  });

  await t.test("D-40 conexão NÃO autenticada não pulsa e não conta", () => {
    const { srv } = bancada();
    const c = cliente(srv);
    assert.equal(srv.pulsar(c.id), false);
    assert.equal(srv.pulsar("c-inexistente"), false);
    assert.equal(srv.presenca.totalDeJogadores(), 0);
  });

  await t.test("D-41 SESSÃO EXPIRADA não conta (§6.1)", async () => {
    const { srv, tempo } = bancada();
    const c = await conectado(srv, "uid-a");
    const olho = await conectado(srv, "uid-olheiro");
    assert.equal(pedirLista(olho).presenca.jogadoresOnlineTotal, 2);
    tempo.avancarMs(3600 * 1000 + 1); // a credencial vence
    assert.equal(srv.conexoes[c.id].estadoAuth, AUTH.EXPIRADA);
    assert.equal(srv.presenca.estaPresente("uid-a"), false);
  });

  await t.test("D-41b credencial vencida encerra a sessão NA HORA, não pelo TTL", async () => {
    // O TTL de 45 s é curto e a credencial dura uma hora, então no arnês padrão
    // o lease sempre vence primeiro — e "a presença sumiu" não prova NADA sobre
    // o fechamento explícito da sessão expirada.
    //
    // Aqui o lease dura MAIS que a credencial. Se `expirar` não fechar a
    // sessão, a pessoa continua contando de credencial vencida — que é
    // exatamente o que a §6.1 proíbe.
    const { srv, tempo } = bancada({ presencaTtlMs: 2 * 3600 * 1000 });
    const c = await conectado(srv, "uid-a");
    assert.equal(srv.presenca.estaPresente("uid-a"), true);
    tempo.avancarMs(3600 * 1000 + 1);
    assert.equal(srv.conexoes[c.id].estadoAuth, AUTH.EXPIRADA);
    assert.equal(srv.presenca.estaPresente("uid-a"), false, "o lease ainda valeria por mais uma hora");
    assert.equal(srv.presenca.totalDeJogadores(), 0);
  });

  await t.test("D-41c desconexão limpa fecha a sessão mesmo com lease longo", async () => {
    const { srv } = bancada({ presencaTtlMs: 2 * 3600 * 1000 });
    const c = await conectado(srv, "uid-a");
    srv.desconectar(c.id);
    assert.equal(srv.presenca.totalDeJogadores(), 0, "o lease longo não segura quem saiu limpo");
  });

  await t.test("D-42 `presenca_ping` renova, e o recibo traz o contrato do ritmo", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    const c = await conectado(srv, "uid-a");
    tempo.avancarMs(40000);
    c.envia({ tipo: DESCOBERTA_FIO.PULSO });
    const recibo = c.ultimo(DESCOBERTA_FIO.RECIBO_PULSO);
    assert.equal(recibo.ttlMs, 45000);
    assert.ok(recibo.intervaloSugeridoMs > 0 && recibo.intervaloSugeridoMs < recibo.ttlMs);
    tempo.avancarMs(40000); // 80 s do início: só sobrevive quem renovou
    assert.equal(srv.presenca.estaPresente("uid-a"), true);
  });

  await t.test("D-43 renovar credencial numa conexão viva renova a presença", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    const c = await conectado(srv, "uid-a");
    tempo.avancarMs(40000);
    await c.autentica(tokenDe("uid-a")); // mesmo uid: é renovação, não troca
    tempo.avancarMs(40000);
    assert.equal(srv.presenca.estaPresente("uid-a"), true);
  });
});

// ===========================================================================
test("§6.2 — CONTAGENS PÚBLICAS", async (t) => {
// ===========================================================================

  await t.test("D-44 jogadores em mesas públicas, e o corte aguardando/andamento", async () => {
    const { srv } = bancada();
    const { codigo: esperando } = await abrirMesa(srv, { uid: "e1" });
    await sentar(srv, esperando, { uid: "e2" });
    const { cliente: dono, codigo: andando } = await abrirMesa(srv, { uid: "a1" });
    await sentar(srv, andando, { uid: "a2" });
    dono.envia({ tipo: "iniciarPartida" });

    const olho = await conectado(srv, "uid-olheiro");
    const p = pedirLista(olho).presenca;
    assert.equal(p.jogadoresEmMesasPublicas, 4);
    assert.equal(p.jogadoresEmMesasPublicasAguardando, 2);
    assert.equal(p.jogadoresEmMesasPublicasEmAndamento, 2);
    // A soma é explicável: os dois pedaços SÃO o total.
    assert.equal(
      p.jogadoresEmMesasPublicasAguardando + p.jogadoresEmMesasPublicasEmAndamento,
      p.jogadoresEmMesasPublicas
    );
    // E "com vagas" é sobre MESAS, não sobre gente.
    assert.equal(p.mesasPublicas, 2);
    assert.equal(p.mesasPublicasComVagas, 1);
  });

  await t.test("D-45 por modalidade: jogadores e mesas com vagas, separados", async () => {
    const { srv } = bancada();
    const { codigo: ab } = await abrirMesa(srv, { uid: "ab1", modalidade: "aberto" });
    await sentar(srv, ab, { uid: "ab2" });
    await abrirMesa(srv, { uid: "fe1", modalidade: "fechado" });
    const { cliente: dono } = await abrirMesa(srv, { uid: "sb1", modalidade: "sbtl" });
    dono.envia({ tipo: "iniciarPartida" });

    const olho = await conectado(srv, "uid-olheiro");
    const p = pedirLista(olho).presenca;
    assert.equal(p.porModalidade.aberto.jogadores, 2);
    assert.equal(p.porModalidade.aberto.mesas, 1);
    assert.equal(p.porModalidade.aberto.mesasComVagas, 1);
    assert.equal(p.porModalidade.fechado.jogadores, 1);
    assert.equal(p.porModalidade.sbtl.jogadores, 1);
    assert.equal(p.porModalidade.sbtl.mesasComVagas, 0, "em andamento não tem vaga");
    assert.equal(p.porModalidade.sbtl.jogadoresEmAndamento, 1);
    assert.equal(p.porModalidade.sbtl.jogadoresAguardando, 0);
    // As chaves são as do MOTOR, não uma segunda lista.
    assert.deepEqual(Object.keys(p.porModalidade).sort(), D.MODALIDADES_PUBLICAS.slice().sort());
  });

  await t.test("D-46 jogador que MUDA de modalidade sai de uma contagem e entra na outra", async () => {
    const { srv } = bancada();
    const { codigo: ab } = await abrirMesa(srv, { uid: "dono-ab", modalidade: "aberto" });
    const { codigo: fe } = await abrirMesa(srv, { uid: "dono-fe", modalidade: "fechado" });
    const andarilho = await sentar(srv, ab, { uid: "uid-andarilho" });
    const olho = await conectado(srv, "uid-olheiro");

    let p = pedirLista(olho).presenca;
    assert.equal(p.porModalidade.aberto.jogadores, 2);
    assert.equal(p.porModalidade.fechado.jogadores, 1);

    srv.desconectar(andarilho.id);
    srv.ger.sair({ codigo: ab, assento: 2 });
    await sentar(srv, fe, { uid: "uid-andarilho" });

    p = pedirDeNovo(olho).presenca;
    assert.equal(p.porModalidade.aberto.jogadores, 1);
    assert.equal(p.porModalidade.fechado.jogadores, 2);
    assert.equal(p.jogadoresEmMesasPublicas, 3);
  });

  await t.test("D-47 ESPECTADOR não é jogador — mas está no total do app", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "uid-dono" });
    const espectador = await conectado(srv, "uid-espectador");
    espectador.envia({ tipo: "assistirMesa", codigo });
    assert.equal(srv.conexoes[espectador.id].assento, null);
    assert.equal(srv.papelDe(srv.conexoes[espectador.id]), "espectador");

    const olho = await conectado(srv, "uid-olheiro");
    const r = pedirLista(olho);
    assert.equal(r.presenca.jogadoresEmMesasPublicas, 1, "só o dono ocupa assento");
    assert.equal(r.presenca.espectadoresOnline, 1);
    assert.equal(r.presenca.jogadoresOnlineTotal, 3, "os três estão no app");
    // A mesa também não o conta como ocupante.
    assert.equal(r.mesas[0].jogadores, 1);
    assert.equal(r.mesas[0].ocupados, 1);
    // E nenhuma contagem por modalidade o pegou.
    assert.equal(r.presenca.porModalidade.sbtl.jogadores, 1);
  });

  await t.test("D-48 quem está sentado E assistindo conta como JOGADOR, uma vez só", async () => {
    const { srv } = bancada();
    const { codigo: a } = await abrirMesa(srv, { uid: "uid-duplo" });
    const { codigo: b } = await abrirMesa(srv, { uid: "uid-outro" });
    // Segunda conexão do MESMO jogador, assistindo a outra mesa.
    const segunda = await conectado(srv, "uid-duplo");
    segunda.envia({ tipo: "assistirMesa", codigo: b });

    const olho = await conectado(srv, "uid-olheiro");
    const p = pedirLista(olho).presenca;
    assert.equal(p.jogadoresEmMesasPublicas, 2);
    assert.equal(p.espectadoresOnline, 0, "conjuntos disjuntos: jogador ganha do espectador");
    assert.equal(p.jogadoresOnlineTotal, 3);
    void a;
  });

  await t.test("D-48b quem OCUPA ASSENTO nunca é espectador — nem em mesa fora da lista", async () => {
    // A armadilha: se `uidsEspectando` deixar de exigir `assento === null`, o
    // filtro `emMesas.has(uid)` ainda esconde o erro para quem está sentado numa
    // mesa PROJETADA. Quem está sentado numa mesa que NÃO aparece (encerrada,
    // privada, VIP) não está em `emMesas`, e aí o erro sai no número.
    const { srv } = bancada();
    const { cliente: dono, codigo } = await abrirMesa(srv, { uid: "uid-sentado" });
    // A partida da mesa dele acabou: a mesa sai da lista, o assento não.
    srv.ger.salas[codigo].liquidada = true;
    assert.equal(srv.conexoes[dono.id].assento, 0, "ele continua sentado");
    assert.equal(srv.conexoes[dono.id].codigo, codigo);

    const olho = await conectado(srv, "uid-olheiro");
    const r = pedirLista(olho);
    assert.equal(r.mesas.length, 0, "a mesa encerrada não aparece");
    assert.equal(r.presenca.jogadoresEmMesasPublicas, 0);
    assert.equal(r.presenca.espectadoresOnline, 0, "quem tem assento não é espectador");
    assert.equal(r.presenca.jogadoresOnlineTotal, 2);
  });

  await t.test("D-49 assento RESERVADO de jogador ausente não infla a contagem pública", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    const { cliente: dono, codigo } = await abrirMesa(srv, { uid: "uid-dono" });
    await sentar(srv, codigo, { uid: "uid-sumido" });
    const olho = await conectado(srv, "uid-olheiro");
    assert.equal(pedirLista(olho).presenca.jogadoresEmMesasPublicas, 2);

    // O sumido cai sem avisar. O ASSENTO fica reservado — é o controlador de
    // assento fazendo o trabalho dele — mas a PESSOA deixa de estar presente.
    //
    // O DONO continua conectado e parado, e o keepalive do transporte pulsa por
    // ele. Sem isto o teste mediria "todo mundo venceu", que é outra coisa: o
    // que se quer provar é o contraste entre UM que venceu e UM que não.
    tempo.avancarMs(45001);
    assert.equal(srv.pulsar(dono.id), true);
    const r = pedirDeNovo(olho);
    assert.equal(r.mesas[0].jogadores, 2, "a MESA continua com dois assentos de humano");
    assert.equal(r.presenca.jogadoresEmMesasPublicas, 1, "a PRESENÇA conta um");
  });

  await t.test("D-50 INVARIANTE: público nunca passa do total geral", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    await sentar(srv, codigo, { uid: "u2" });
    await sentar(srv, codigo, { uid: "u3" });
    const olho = await conectado(srv, "uid-olheiro");
    for (const passo of [0, 10000, 45001, 90000]) {
      tempo.avancarMs(passo);
      const p = pedirDeNovo(olho).presenca;
      assert.ok(p.jogadoresEmMesasPublicas <= p.jogadoresOnlineTotal,
        "publico=" + p.jogadoresEmMesasPublicas + " total=" + p.jogadoresOnlineTotal);
      assert.ok(p.espectadoresOnline <= p.jogadoresOnlineTotal);
      for (const m of D.MODALIDADES_PUBLICAS) {
        assert.ok(p.porModalidade[m].jogadores <= p.jogadoresEmMesasPublicas);
        assert.ok(p.porModalidade[m].mesasComVagas <= p.porModalidade[m].mesas);
      }
    }
  });
});

// ===========================================================================
test("§7 — ATUALIZAÇÃO E CONSISTÊNCIA", async (t) => {
// ===========================================================================

  await t.test("D-51 mesa NOVA faz a revisão subir", async () => {
    const { srv } = bancada();
    const olho = await conectado(srv, "uid-olheiro");
    const r1 = pedirLista(olho);
    await abrirMesa(srv, { uid: "u1" });
    const r2 = pedirDeNovo(olho);
    assert.ok(r2.revisao > r1.revisao);
    assert.equal(r2.mesas.length, 1);
  });

  await t.test("D-52 mesa FICANDO CHEIA move a revisão DA MESA", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    const olho = await conectado(srv, "uid-olheiro");
    const antes = pedirLista(olho).mesas[0];
    await sentar(srv, codigo, { uid: "u2" });
    const depois = pedirDeNovo(olho).mesas[0];
    assert.ok(depois.revisao > antes.revisao);
    assert.equal(depois.jogadores, 2);
  });

  await t.test("D-53 jogador SAINDO move a revisão", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    await sentar(srv, codigo, { uid: "u2" });
    const olho = await conectado(srv, "uid-olheiro");
    const antes = pedirLista(olho).mesas[0];
    srv.ger.sair({ codigo, assento: 2 });
    const depois = pedirDeNovo(olho).mesas[0];
    assert.ok(depois.revisao > antes.revisao);
    assert.equal(depois.jogadores, 1);
  });

  await t.test("D-54 consulta SEM mudança NÃO move a revisão", async () => {
    const { srv, tempo } = bancada();
    await abrirMesa(srv, { uid: "u1" });
    await conectado(srv, "uid-olheiro");
    const r1 = srv.projetarDescoberta();
    tempo.avancarMs(5000); // só o relógio anda
    const r2 = srv.projetarDescoberta();
    assert.equal(r2.revisao, r1.revisao, "perguntar não é mudar");
    assert.equal(r2.mesas[0].revisao, r1.mesas[0].revisao);
    // O tempo de espera, esse sim, andou — e não moveu a revisão.
    assert.ok(r2.mesas[0].aguardandoHaMs > r1.mesas[0].aguardandoHaMs);
  });

  await t.test("D-55 ATUALIZAÇÃO FORA DE ORDEM: o retrato atrasado se identifica como velho", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "u1" });
    const atrasado = srv.projetarDescoberta(); // sai e fica preso na rede
    await abrirMesa(srv, { uid: "u2" });
    const novo = srv.projetarDescoberta();
    assert.ok(novo.revisao > atrasado.revisao);
    assert.equal(atrasado.mesas.length, 1);
    assert.equal(novo.mesas.length, 2);
    // A regra do contrato — descartar revisão <= a que já se tem — é decidível
    // sem ambiguidade, e não há empate entre retratos diferentes.
    assert.notEqual(atrasado.revisao, novo.revisao);
  });

  await t.test("D-56 a revisão é ESTRITAMENTE crescente ao longo de muitas mudanças", async () => {
    const { srv } = bancada();
    const vistas = [];
    for (let i = 0; i < 6; i++) {
      await abrirMesa(srv, { uid: "u" + i });
      vistas.push(srv.projetarDescoberta().revisao);
    }
    for (let i = 1; i < vistas.length; i++) assert.ok(vistas[i] > vistas[i - 1]);
  });

  await t.test("D-57 mudança de PRESENÇA também move a revisão global", async () => {
    const { srv, tempo } = bancada({ presencaTtlMs: 45000 });
    await conectado(srv, "uid-a");
    const antes = srv.projetarDescoberta().revisao;
    await conectado(srv, "uid-b");
    assert.ok(srv.projetarDescoberta().revisao > antes);
    void tempo;
  });

  await t.test("D-58 CÓDIGO REAPROVEITADO recebe revisão nova, nunca a antiga", async () => {
    const { srv } = bancada({ gerarCodigo: () => "REPETIDO" });
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    assert.equal(codigo, "REPETIDO");
    const antes = srv.projetarDescoberta().mesas[0].revisao;
    // A sala morre (o criador sumiu antes de sentar) e outra nasce com o MESMO
    // código — é o único caminho que apaga sala neste servidor.
    srv.ger.desfazerAdmissao({ codigo, assento: 0 });
    assert.equal(srv.ger.salas[codigo], undefined);
    assert.equal(srv.projetarDescoberta().mesas.length, 0);
    await abrirMesa(srv, { uid: "u2" });
    const depois = srv.projetarDescoberta().mesas[0];
    assert.equal(depois.codigo, "REPETIDO");
    assert.ok(depois.revisao > antes, "revisão " + depois.revisao + " tinha de passar de " + antes);
  });

  await t.test("D-59 GERAÇÃO: estável no processo, diferente entre registros", async () => {
    const { srv } = bancada();
    const a = srv.projetarDescoberta();
    const b = srv.projetarDescoberta();
    assert.equal(a.geracao, b.geracao);
    assert.ok(a.geracao && a.geracao.length >= 8);
    const outro = bancada();
    assert.notEqual(outro.srv.projetarDescoberta().geracao, a.geracao);
  });

  await t.test("D-60 a consulta NÃO MUTA a sala: versão e impressão do estado intactas", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    const sala = srv.ger.salas[codigo];
    SALAS.carimbarEstado(sala);
    const versaoAntes = sala.versaoEstado;
    const eventoAntes = sala.eventoId;
    const impressaoAntes = SALAS.impressaoDoEstado(sala);
    const olho = await conectado(srv, "uid-olheiro");
    for (let i = 0; i < 20; i++) srv.projetarDescoberta();
    pedirLista(olho);
    assert.equal(sala.versaoEstado, versaoAntes);
    assert.equal(sala.eventoId, eventoAntes);
    assert.equal(SALAS.impressaoDoEstado(sala), impressaoAntes);
    assert.equal(sala.iniciada, false);
    assert.deepEqual(sala.assentos.map((a) => (a ? a.jogadorId : null)), ["u1", null, null, null]);
  });

  await t.test("D-61 SNAPSHOT COERENTE: o retrato descreve um estado só", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    await sentar(srv, codigo, { uid: "u2" });
    await abrirMesa(srv, { uid: "u3", modalidade: "aberto" });
    const r = srv.projetarDescoberta();
    for (const m of r.mesas) {
      assert.equal(m.ocupados, m.assentos.filter((a) => a.ocupado).length);
      assert.equal(m.jogadores, m.assentos.filter((a) => a.tipo === "humano").length);
      assert.equal(m.bots, m.assentos.filter((a) => a.tipo === "bot").length);
    }
    assert.equal(r.presenca.mesasPublicas, r.mesas.length);
    assert.equal(r.presenca.mesasPublicasComVagas, r.mesas.filter((x) => x.ingressavel).length);
    let mesasPorModalidade = 0;
    for (const m of D.MODALIDADES_PUBLICAS) mesasPorModalidade += r.presenca.porModalidade[m].mesas;
    assert.equal(mesasPorModalidade, r.mesas.length);
  });
});

// ===========================================================================
test("§8 — SEGURANÇA E PRIVACIDADE", async (t) => {
// ===========================================================================

  await t.test("D-62 conexão NÃO AUTENTICADA não obtém lista nem pulso", () => {
    const { srv } = bancada();
    const c = cliente(srv);
    c.envia({ tipo: DESCOBERTA_FIO.PEDIDO });
    assert.equal(c.ultimo(DESCOBERTA_FIO.RESPOSTA), null);
    c.envia({ tipo: DESCOBERTA_FIO.PULSO });
    assert.equal(c.ultimo(DESCOBERTA_FIO.RECIBO_PULSO), null);
    assert.ok(c.ultimo("erro"));
    assert.equal(srv.presenca.totalDeJogadores(), 0);
  });

  await t.test("D-63 credencial EXPIRADA não obtém lista", async () => {
    const { srv, tempo } = bancada();
    const c = await conectado(srv, "uid-a");
    assert.ok(pedirLista(c));
    c.limpar();
    tempo.avancarMs(3600 * 1000 + 1);
    c.envia({ tipo: DESCOBERTA_FIO.PEDIDO });
    assert.equal(c.ultimo(DESCOBERTA_FIO.RESPOSTA), null);
    assert.equal(c.ultimo("erro").codigo, "CREDENCIAL_EXPIRADA");
  });

  await t.test("D-64 LIMITE DE FREQUÊNCIA da consulta: recusa e libera no tempo", async () => {
    const { srv, tempo } = bancada();
    const c = await conectado(srv, "uid-a");
    assert.ok(pedirLista(c));
    c.limpar();
    c.envia({ tipo: DESCOBERTA_FIO.PEDIDO });
    assert.equal(c.ultimo(DESCOBERTA_FIO.RESPOSTA), null);
    assert.equal(c.ultimo("erro").codigo, "DESCOBERTA_RITMO");
    c.limpar();
    tempo.avancarMs(RITMO_DESCOBERTA_MS);
    c.envia({ tipo: DESCOBERTA_FIO.PEDIDO });
    assert.ok(c.ultimo(DESCOBERTA_FIO.RESPOSTA));
  });

  await t.test("D-65 o limite é POR CONEXÃO: um cliente não trava o outro", async () => {
    const { srv } = bancada();
    const a = await conectado(srv, "uid-a");
    const b = await conectado(srv, "uid-b");
    assert.ok(pedirLista(a));
    assert.ok(pedirLista(b), "b nunca perguntou; não pode estar em ritmo excessivo");
    // E reconectar não devolve crédito acumulado: a conexão nova nasce sem
    // carimbo, com direito a UM pedido, não a mil.
    a.limpar();
    a.envia({ tipo: DESCOBERTA_FIO.PEDIDO });
    assert.equal(a.ultimo("erro").codigo, "DESCOBERTA_RITMO");
  });

  await t.test("D-66 LIMITE DE FREQUÊNCIA do pulso", async () => {
    const { srv, tempo } = bancada();
    const c = await conectado(srv, "uid-a");
    c.envia({ tipo: DESCOBERTA_FIO.PULSO });
    assert.ok(c.ultimo(DESCOBERTA_FIO.RECIBO_PULSO));
    c.limpar();
    c.envia({ tipo: DESCOBERTA_FIO.PULSO });
    assert.equal(c.ultimo("erro").codigo, "PRESENCA_RITMO");
    c.limpar();
    tempo.avancarMs(RITMO_PULSO_MS);
    c.envia({ tipo: DESCOBERTA_FIO.PULSO });
    assert.ok(c.ultimo(DESCOBERTA_FIO.RECIBO_PULSO));
  });

  await t.test("D-67 o CLIENTE NÃO FABRICA O TOTAL", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-a");
    // Tudo o que um cliente adulterado tentaria enfiar no pulso — MENOS campo
    // de identidade, que é barrado antes (ver D-67b). Sem essa separação, a
    // recusa de identidade esconderia o que se quer medir aqui: que os campos
    // de CONTAGEM são simplesmente ignorados por quem chega até o handler.
    c.envia({
      tipo: DESCOBERTA_FIO.PULSO,
      jogadoresOnlineTotal: 99999,
      total: 99999,
      presenca: { jogadoresOnlineTotal: 99999 },
      jogadores: ["uid-x", "uid-y", "uid-z"],
      espectadoresOnline: 4242,
      ttlMs: 99999999,
    });
    assert.equal(srv.presenca.totalDeJogadores(), 1);
    assert.equal(srv.presenca.estaPresente("uid-x"), false);
    const r = srv.projetarDescoberta();
    assert.equal(r.presenca.jogadoresOnlineTotal, 1);
    assert.equal(r.presenca.espectadoresOnline, 0);
    assert.equal(srv.presenca.ttlMs, P.TTL_PADRAO_MS);
    // E o RECIBO também não ecoa o que o cliente mandou. Não é detalhe: um
    // recibo que devolve o `ttlMs` do cliente ensina o aplicativo a pulsar no
    // ritmo que o atacante escolheu, e o servidor passa a parecer concordar
    // com um número que ele nunca aceitou.
    const recibo = c.ultimo(DESCOBERTA_FIO.RECIBO_PULSO);
    assert.equal(recibo.ttlMs, srv.presenca.ttlMs);
    assert.equal(recibo.ttlMs, P.TTL_PADRAO_MS);
    assert.ok(recibo.intervaloSugeridoMs < P.TTL_PADRAO_MS);
  });

  await t.test("D-67b pulso em nome de OUTRO é barrado antes de chegar ao handler", async () => {
    const { srv } = bancada();
    const c = await conectado(srv, "uid-a");
    c.envia({ tipo: DESCOBERTA_FIO.PULSO, uid: "uid-de-outro" });
    assert.equal(c.ultimo(DESCOBERTA_FIO.RECIBO_PULSO), null, "nem recibo ele leva");
    assert.equal(c.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");
    assert.equal(srv.presenca.estaPresente("uid-de-outro"), false);
    assert.equal(srv.presenca.totalDeJogadores(), 1);
    // O mesmo vale para a consulta.
    c.limpar();
    c.envia({ tipo: DESCOBERTA_FIO.PEDIDO, jogadorId: "uid-de-outro" });
    assert.equal(c.ultimo(DESCOBERTA_FIO.RESPOSTA), null);
    assert.equal(c.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");
  });

  await t.test("D-68 a CONSULTA ignora `msg` por inteiro", async () => {
    const { srv } = bancada();
    await abrirMesa(srv, { uid: "u1", modalidade: "aberto" });
    await abrirMesa(srv, { uid: "u2", modalidade: "fechado" });
    const c = await conectado(srv, "uid-olheiro");
    const limpa = pedirLista(c);
    const cx = srv.conexoes[c.id];
    cx._ritmoDescoberta = null;
    c.limpar();
    c.envia({
      tipo: DESCOBERTA_FIO.PEDIDO,
      modalidade: "fechado", limite: 1, incluirPrivadas: true, incluirVip: true,
      tipoPartida: "privada", categoriaCompetitiva: "vip_ranqueada", revisao: 999999,
    });
    const suja = c.ultimo(DESCOBERTA_FIO.RESPOSTA);
    assert.deepEqual(suja.mesas.map((m) => m.codigo), limpa.mesas.map((m) => m.codigo));
    assert.equal(suja.mesas.length, 2);
    assert.equal(suja.revisao, limpa.revisao);
  });

  await t.test("D-69 TENTATIVA DE OBTER UID por qualquer caminho da resposta", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "uid-alvo-do-ataque", apelido: "Ana" });
    await sentar(srv, codigo, { uid: "uid-segundo-alvo", apelido: "Bruno" });
    const atacante = await conectado(srv, "uid-atacante");
    const r = pedirLista(atacante);
    semVazamento(r, segredosVivos(srv));
    const chaves = new Set(textosDe(r));
    for (const proibida of ["uid", "jogadorId", "uidAutenticado", "admissaoId", "token", "credencial", "jogo", "mao", "lixo"]) {
      assert.ok(!chaves.has(proibida), "chave proibida '" + proibida + "' na projeção");
    }
  });

  await t.test("D-70 mesa em ANDAMENTO não vaza estado do motor", async () => {
    const { srv } = bancada();
    const { cliente: dono, codigo } = await abrirMesa(srv, { uid: "uid-dono" });
    dono.envia({ tipo: "iniciarPartida" });
    assert.ok(srv.ger.salas[codigo].jogo, "o arnês tem de ter jogo de verdade");
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    const chaves = new Set(textosDe(r));
    for (const proibida of ["jogo", "maos", "mao", "lixo", "monte", "mortos", "cartas", "rodada", "placar"]) {
      assert.ok(!chaves.has(proibida), "estado do motor vazou: '" + proibida + "'");
    }
  });

  await t.test("D-71 mesa PRIVADA e SIMULADA não são enumeráveis", async () => {
    const { srv } = bancada();
    const olho = await conectado(srv, "uid-olheiro");
    srv.ger.salas["PRIVADA1"] = salaForjada({ codigo: "PRIVADA1", tipoPartida: "privada" });
    srv.ger.salas["SIMULADA"] = salaForjada({ codigo: "SIMULADA", tipoPartida: "simulada" });
    srv.ger.salas["SEMTIPO0"] = salaForjada({ codigo: "SEMTIPO0", tipoPartida: undefined });
    srv.ger.salas["PUBLICA1"] = salaForjada({ codigo: "PUBLICA1" });
    const r = pedirLista(olho);
    assert.deepEqual(r.mesas.map((m) => m.codigo), ["PUBLICA1"]);
    semVazamento(r, ["PRIVADA1", "SIMULADA", "SEMTIPO0"]);
  });

  await t.test("D-72 a consulta NÃO É porta de mutação: nenhum campo de `msg` escreve", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    const c = await conectado(srv, "uid-atacante");
    const sala = srv.ger.salas[codigo];
    const retrato = () => JSON.stringify({
      assentos: sala.assentos, iniciada: sala.iniciada, meta: sala.metaPontos,
      modalidade: sala.modalidade, tipo: sala.tipoPartida, cat: sala.categoriaCompetitiva,
      criadaEm: sala.criadaEm,
    });
    const antes = retrato();
    c.envia({ tipo: DESCOBERTA_FIO.PEDIDO, codigo, assento: 1, apelido: "Invasor", metaPontos: 60, modalidade: "aberto", criadaEm: 0 });
    assert.equal(retrato(), antes);
    assert.equal(srv.conexoes[c.id].codigo, null);
    assert.equal(srv.conexoes[c.id].assento, null);
  });
});

// ===========================================================================
test("§11 — TOPOLOGIA: MÚLTIPLAS INSTÂNCIAS", async (t) => {
// ===========================================================================

  await t.test("D-73 duas instâncias: cada uma projeta as PRÓPRIAS mesas e a PRÓPRIA presença", async () => {
    const A = bancada();
    const B = bancada();
    await abrirMesa(A.srv, { uid: "uid-a" });
    await abrirMesa(B.srv, { uid: "uid-b" });
    const olhoA = await conectado(A.srv, "uid-olheiro");
    const olhoB = await conectado(B.srv, "uid-olheiro");
    const rA = pedirLista(olhoA);
    const rB = pedirLista(olhoB);
    assert.equal(rA.mesas.length, 1);
    assert.equal(rB.mesas.length, 1);
    // O MESMO jogador conectado nas duas conta UMA vez EM CADA — porque cada
    // retrato descreve um processo, e o registro de MESAS já era assim antes
    // desta OS: a mesa de A não existe em B.
    assert.equal(rA.presenca.jogadoresOnlineTotal, 2);
    assert.equal(rB.presenca.jogadoresOnlineTotal, 2);
    // As revisões NÃO são comparáveis entre instâncias: é para isso que
    // `geracao` existe no contrato.
    assert.notEqual(rA.geracao, rB.geracao);
  });

  await t.test("D-74 presença e listagem descrevem o MESMO processo, sempre", async () => {
    const A = bancada();
    const B = bancada();
    const { codigo } = await abrirMesa(A.srv, { uid: "uid-x" });
    await sentar(A.srv, codigo, { uid: "uid-y" });
    const olhoB = await conectado(B.srv, "uid-z");
    const rB = pedirLista(olhoB);
    // B não vê a mesa de A e também não conta os jogadores dela. As duas
    // metades são parciais JUNTAS — nunca uma completa e outra pela metade.
    assert.equal(rB.mesas.length, 0);
    assert.equal(rB.presenca.jogadoresEmMesasPublicas, 0);
    assert.equal(rB.presenca.jogadoresOnlineTotal, 1);
  });
});

// ===========================================================================
test("§4/§5/§6 — O CONTRATO NÃO DIVERGIU", async (t) => {
// ===========================================================================

  const CAMINHO = path.join(__dirname, "..", "contrato", "descoberta-mesas-v1.json");
  const cru = fs.readFileSync(CAMINHO, "utf8").replace(/\r\n/g, "\n");
  const contrato = JSON.parse(cru);

  await t.test("D-75 o digest do contrato é o esperado", () => {
    const digest = crypto.createHash("sha256").update(cru, "utf8").digest("hex");
    assert.equal(
      digest,
      "a528c9e465a815f4aebb284b30744a17a02badbc0d48bc7d9b0ba368c0c5c63b",
      "contrato/descoberta-mesas-v1.json mudou. Se a mudança é intencional, atualize este digest NA MESMA alteração — e leia o que mudou antes de atualizar."
    );
  });

  await t.test("D-76 o vocabulário do fio é o do contrato", () => {
    assert.equal(contrato.protocoloWebSocket.pedidoDoCliente, DESCOBERTA_FIO.PEDIDO);
    assert.equal(contrato.protocoloWebSocket.respostaDoServidor, DESCOBERTA_FIO.RESPOSTA);
    assert.equal(contrato.protocoloWebSocket.pulsoDoCliente, DESCOBERTA_FIO.PULSO);
    assert.equal(contrato.protocoloWebSocket.reciboDoPulso, DESCOBERTA_FIO.RECIBO_PULSO);
    assert.equal(contrato.protocoloWebSocket.ritmoMinimoMs.descobrirMesas, RITMO_DESCOBERTA_MS);
    assert.equal(contrato.protocoloWebSocket.ritmoMinimoMs.presenca_ping, RITMO_PULSO_MS);
    assert.equal(contrato.esquema, D.ESQUEMA);
  });

  await t.test("D-77 as listas fechadas do contrato são as do servidor", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "u1" });
    await sentar(srv, codigo, { uid: "u2" });
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    assert.deepEqual(contrato.respostaMesas.campos.slice().sort(), CAMPOS_DA_RESPOSTA.slice().sort());
    assert.deepEqual(Object.keys(r).filter((k) => k !== "tipo").sort(), contrato.respostaMesas.campos.slice().sort());
    assert.deepEqual(Object.keys(r.mesas[0]).sort(), contrato.mesa.campos.slice().sort());
    assert.deepEqual(Object.keys(r.mesas[0].assentos[0]).sort(), contrato.assento.campos.slice().sort());
    assert.deepEqual(Object.keys(r.presenca).sort(), contrato.presenca.campos.slice().sort());
    assert.deepEqual(
      Object.keys(r.presenca.porModalidade.sbtl).sort(),
      contrato.presenca.porModalidade.campos.slice().sort()
    );
    assert.deepEqual(contrato.assento.tipos.slice().sort(), ["bot", "humano"]);
  });

  await t.test("D-78 as modalidades do contrato são as do MOTOR", () => {
    const doMotor = Object.keys(bundle.require("bot").MODALIDADES).slice().sort();
    assert.deepEqual(contrato.presenca.porModalidade.chaves.slice().sort(), doMotor);
    assert.deepEqual(D.MODALIDADES_PUBLICAS.slice().sort(), doMotor);
  });

  await t.test("D-79 a enumeração de estado de ingresso é a do contrato", () => {
    assert.deepEqual(contrato.estadoIngresso.valores.slice().sort(), Object.values(D.INGRESSO).slice().sort());
  });

  await t.test("D-80 o TTL e a capacidade declarados são os do servidor", () => {
    assert.equal(contrato.presencaModelo.ttlMs, P.TTL_PADRAO_MS);
    assert.equal(D.CAPACIDADE, 4);
    assert.equal(contrato.presencaModelo.chaveDeDeduplicacao.indexOf("uid"), 0);
  });

  await t.test("D-81 o contrato declara a topologia de UMA instância, e por quê", () => {
    assert.equal(contrato.topologia.instancias, 1);
    assert.ok(String(contrato.topologia["//instancias"]).length > 40);
    assert.ok(String(contrato.topologia.seHouverReplicas).length > 40);
  });

  await t.test("D-82 o contrato lista o que é proibido no fio, e nada disso aparece", async () => {
    const { srv } = bancada();
    const { codigo } = await abrirMesa(srv, { uid: "uid-proibido-1", apelido: "Ana" });
    await sentar(srv, codigo, { uid: "uid-proibido-2", apelido: "Bruno" });
    const c = await conectado(srv, "uid-olheiro");
    const r = pedirLista(c);
    assert.ok(contrato.proibidoNoFio.itens.length >= 10);
    const chaves = new Set(textosDe(r));
    for (const item of contrato.proibidoNoFio.itens) {
      if (item.indexOf(" ") !== -1) continue; // as entradas em prosa são descritivas
      assert.ok(!chaves.has(item), "item proibido '" + item + "' apareceu na projeção");
    }
    semVazamento(r, segredosVivos(srv));
  });
});
