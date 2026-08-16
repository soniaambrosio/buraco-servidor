// test/costura.test.js — os DOIS contratos operando juntos.
//
// As seis suítes herdadas provam cada folha no seu eixo: `ws_auth`/`auth_token`/
// `regressao_auth` provam identidade; `espectador`/`regressao`/`ws` provam
// projeção. Nenhuma delas prova a JUNÇÃO — e é na junção que uma composição
// costuma abrir buraco, porque cada lado supõe algo do outro que ninguém
// afirmou.
//
// O caso mais claro disso está em COST-01: antes da composição, a folha do
// espectador entregava a visão pública a qualquer conexão numa sala, e a folha
// de autenticação nunca soube que existia uma projeção pública para proteger.
// Só a junção responde "espectador não autenticado vê alguma coisa?".
//
// Convenções:
//   - `srv.autenticar` é a MESMA porta de produção, com o MESMO
//     `criarVerificadorFirebase`; nada é desligado para o teste passar;
//   - o relógio é o T0 das suítes, e a expiração é dirigida por `relogio()`,
//     igual a `ws_auth.test.js`.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  AUTH,
  PROTOCOLO_ATUAL,
  PROTOCOLO_MINIMO,
  T0,
  cliente: clienteAuth,
  emitirToken,
  novoParDeChaves,
  novoServidor: novoServidorAuth,
  relogio,
  verificadorDeTeste,
} = require("./ajuda_auth.js");

const {
  J,
  espectador,
  marcarSegredos,
  mesaComPartida,
  varrerSegredos,
  segredosAgora,
} = require("./ajuda.js");

const CHAVE = novoParDeChaves("kid-costura");
const token = (uid, opts = {}) =>
  emitirToken(Object.assign({ chave: CHAVE, uid, emitidoEm: T0 }, opts));

/** Servidor com verificador real (certificados de teste) e relógio dirigível. */
function servidorDeCostura(tempo) {
  return novoServidorAuth({
    tempo,
    verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }),
  });
}

/**
 * Mesa pronta com quatro humanos autenticados, num servidor de costura.
 *
 * O relógio é SEMPRE dirigido, mesmo quando o teste não se importa com tempo:
 * o token é emitido em T0 e `armarExpiracao` compara o `exp` dele com o relógio
 * do servidor. Deixar o servidor no relógio real faria toda sessão expirar no
 * instante em que nasce — e o sintoma seria "criarMesa não responde", que não
 * parece um problema de relógio.
 */
async function mesaAutenticada(tempo = relogio(), opts = {}) {
  const { humanos = 4, metaPontos = 3000 } = opts;
  const srv = servidorDeCostura(tempo);
  const jogadores = [];
  for (let i = 0; i < humanos; i++) {
    const c = clienteAuth(srv);
    await c.autentica(token("uid-" + i));
    jogadores.push(c);
  }
  jogadores[0].envia({ tipo: "criarMesa", apelido: "Dono", metaPontos });
  const codigo = jogadores[0].ultimo("entrou").codigo;
  for (let i = 1; i < humanos; i++) {
    jogadores[i].envia({ tipo: "entrarMesa", codigo, apelido: "J" + i });
  }
  jogadores[0].envia({ tipo: "iniciarPartida" });
  return { srv, codigo, jogadores, sala: srv.ger.salas[codigo] };
}

// ===========================================================================
// COST-01 a COST-03 — a fronteira de identidade cobre a projeção pública
// ===========================================================================
describe("COST — autenticação e projeção juntas", () => {
  test("COST-01: espectador NÃO autenticado não recebe nem a visão pública", async () => {
    const { srv, codigo, sala } = await mesaAutenticada();
    marcarSegredos(sala.jogo);

    // Conexão crua: nunca apresentou credencial.
    const intruso = clienteAuth(srv);
    intruso.envia({ tipo: "assistirMesa", codigo });

    assert.equal(intruso.estadoAuth, AUTH.NAO_AUTENTICADO);
    assert.equal(intruso.ultimo("assistindo"), null, "não entrou na mesa");
    assert.equal(
      intruso.todas("estado").length,
      0,
      "conexão anônima recebeu estado — a projeção pública ficou fora da fronteira"
    );

    // E o broadcast da mesa também não o alcança.
    srv.broadcastSala(codigo);
    assert.equal(intruso.todas("estado").length, 0);
    assert.deepEqual(varrerSegredos(intruso.recebidas, segredosAgora(sala.jogo)), []);
  });

  test("COST-02: espectador autenticado recebe somente a visão pública", async () => {
    const { srv, codigo, sala } = await mesaAutenticada();
    marcarSegredos(sala.jogo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador"));
    esp.envia({ tipo: "assistirMesa", codigo });

    assert.equal(srv.papelDe(srv.conexoes[esp.id]), "espectador");
    const estados = esp.todas("estado").map((m) => m.visao);
    assert.ok(estados.length > 0, "espectador autenticado precisa receber a projeção");
    for (const visao of estados) {
      // A projeção pública ZERA os campos privados em vez de omiti-los, então o
      // valor esperado é "nada dentro", e não "chave ausente". O que não pode,
      // em nenhuma das duas formas, é vir carta.
      assert.ok(
        !Array.isArray(visao.suaMao) || visao.suaMao.length === 0,
        "mão não pode aparecer para quem assiste"
      );
      assert.ok(
        visao.voceAssento == null,
        "quem assiste não tem assento e não pode receber um"
      );
    }
    assert.deepEqual(varrerSegredos(esp.recebidas, segredosAgora(sala.jogo)), []);
  });

  test("COST-03: UID ou assento forjado não eleva espectador a jogador", async () => {
    const { srv, codigo, sala } = await mesaAutenticada();
    marcarSegredos(sala.jogo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador"));

    // (a) assento forjado, identidade honesta: o comando roda e não concede nada.
    esp.envia({ tipo: "assistirMesa", codigo, assento: 0, seat: 0, papel: "jogador" });
    assert.equal(srv.conexoes[esp.id].assento, null);
    assert.equal(srv.papelDe(srv.conexoes[esp.id]), "espectador");

    // (b) identidade forjada: nem chega a rodar.
    esp.limpar();
    esp.envia({ tipo: "assistirMesa", codigo, jogadorId: "uid-1" });
    assert.equal(esp.ultimo("erro").codigo, "IDENTIDADE_DIVERGENTE");
    assert.equal(srv.conexoes[esp.id].assento, null);

    assert.deepEqual(varrerSegredos(esp.recebidas, segredosAgora(sala.jogo)), []);
  });

  test("COST-04: jogador autenticado mantém a própria visão privada", async () => {
    const { srv, jogadores, sala } = await mesaAutenticada();

    for (let i = 0; i < 4; i++) {
      // O assento vem do SERVIDOR. A mesa alterna as duplas, então a ordem de
      // entrada não é a ordem dos assentos — presumir isso testaria a suposição
      // do teste, e não o servidor.
      const assento = srv.conexoes[jogadores[i].id].assento;
      const estados = jogadores[i].todas("estado").map((m) => m.visao);
      const ultima = estados[estados.length - 1];
      assert.equal(ultima.voceAssento, assento, "cada jogador vê o próprio assento");
      assert.ok(Array.isArray(ultima.suaMao), "jogador precisa receber a própria mão");
      // E a mão dos outros continua invisível: só contagem.
      for (const a of ultima.assentos) assert.equal(a.cartas, undefined);
    }

    // A mão de OUTRO assento não aparece no que o primeiro jogador recebeu.
    const assentoA = srv.conexoes[jogadores[0].id].assento;
    const assentoB = srv.conexoes[jogadores[1].id].assento;
    const maoDeB = new Set(sala.jogo.maos[assentoB].map((c) => c.id));
    assert.deepEqual(
      varrerSegredos(jogadores[0].recebidas, maoDeB),
      [],
      `a mão do assento ${assentoB} vazou para o assento ${assentoA}`
    );
  });
});

// ===========================================================================
// COST-05 a COST-09 — ciclo de vida da credencial cruzando a projeção
// ===========================================================================
describe("COST — expiração, renovação e reconexão", () => {
  test("COST-05: credencial expirada deixa de receber QUALQUER atualização", async () => {
    const tempo = relogio();
    const { srv, codigo, sala } = await mesaAutenticada(tempo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador", { validoPorS: 60 }));
    esp.envia({ tipo: "assistirMesa", codigo });
    assert.ok(esp.todas("estado").length > 0, "antes de expirar ele recebia");

    esp.limpar();
    tempo.avancarMs(61 * 1000); // o token morreu
    assert.equal(esp.estadoAuth, AUTH.EXPIRADA);

    srv.broadcastSala(codigo);
    assert.equal(
      esp.todas("estado").length,
      0,
      "credencial vencida continuou recebendo estado"
    );
    assert.deepEqual(varrerSegredos(esp.recebidas, segredosAgora(sala.jogo)), []);
  });

  test("COST-06: renovação do MESMO uid preserva a conexão sem ampliar privilégio", async () => {
    const tempo = relogio();
    const { srv, codigo } = await mesaAutenticada(tempo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador", { validoPorS: 60 }));
    esp.envia({ tipo: "assistirMesa", codigo });
    const idAntes = esp.id;

    tempo.avancarMs(61 * 1000);
    assert.equal(esp.estadoAuth, AUTH.EXPIRADA);

    // Token novo, mesmo dono.
    await esp.autentica(token("uid-espectador", { emitidoEm: tempo.agoraMs }));
    assert.equal(esp.estadoAuth, AUTH.AUTENTICADO);
    assert.equal(esp.id, idAntes, "renovar não troca a conexão");
    assert.equal(esp.derrubada, false);

    // Voltou a receber — e continua espectador.
    esp.limpar();
    srv.broadcastSala(codigo);
    assert.ok(esp.todas("estado").length > 0, "renovado, deve voltar a receber");
    assert.equal(srv.papelDe(srv.conexoes[esp.id]), "espectador");
    assert.equal(srv.conexoes[esp.id].assento, null, "renovar não concede assento");
  });

  test("COST-07: renovação com uid DIFERENTE encerra a conexão", async () => {
    const tempo = relogio();
    const { srv, codigo } = await mesaAutenticada(tempo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador"));
    esp.envia({ tipo: "assistirMesa", codigo });

    await esp.autentica(token("uid-outra-pessoa"));
    assert.equal(esp.derrubada, true, "token de outra pessoa tem que derrubar");

    esp.limpar();
    srv.broadcastSala(codigo);
    assert.equal(esp.todas("estado").length, 0);
  });

  test("COST-08: reconexão exige nova autenticação e recalcula o papel", async () => {
    const { srv, codigo, jogadores } = await mesaAutenticada();

    // O jogador do assento 2 cai.
    srv.desconectar(jogadores[2].id);

    // Volta numa conexão NOVA. Sem autenticar, não recebe nada.
    const devolta = clienteAuth(srv);
    devolta.envia({ tipo: "assistirMesa", codigo });
    assert.equal(devolta.todas("estado").length, 0, "conexão nova nasce anônima");

    // Autenticando com o MESMO uid de antes, o papel é recalculado do zero:
    // não há retomada de assento neste servidor, então ele volta como quem vê.
    await devolta.autentica(token("uid-2"));
    devolta.envia({ tipo: "assistirMesa", codigo });
    assert.equal(srv.papelDe(srv.conexoes[devolta.id]), "espectador");
    assert.equal(srv.conexoes[devolta.id].assento, null, "assento antigo não volta");
  });

  test("COST-09: nenhuma identidade ou papel anterior sobrevive à nova conexão", async () => {
    const { srv, codigo, jogadores } = await mesaAutenticada();
    // O assento é LIDO do servidor, não presumido pela ordem de entrada: quem
    // distribui assento é o gerenciador de salas, e presumir aqui repetiria no
    // teste a decisão que ele deveria apenas observar.
    const assentoAntigo = srv.conexoes[jogadores[1].id].assento;
    assert.ok(Number.isInteger(assentoAntigo), "o segundo humano precisa estar sentado");

    srv.desconectar(jogadores[1].id);

    const nova = clienteAuth(srv);
    assert.equal(nova.estadoAuth, AUTH.NAO_AUTENTICADO, "conexão nova não herda estado de auth");
    assert.equal(srv.conexoes[nova.id].assento, null, "não herda assento");
    assert.equal(srv.conexoes[nova.id].jogadorId, null, "não herda identidade");
    assert.ok(srv.conexoes[nova.id].uidAutenticado == null, "não herda uid");
    assert.equal(srv.papelDe(srv.conexoes[nova.id]), "nenhum", "não herda papel");

    nova.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    assert.equal(nova.todas("estado").length, 0);
    assert.equal(
      srv.ger.salas[codigo].jogo.assentos[assentoAntigo].tipo,
      "bot",
      "o assento de quem caiu virou bot"
    );
  });
});

// ===========================================================================
// COST-10 a COST-14 — despacho, segredo e encerramento
// ===========================================================================
describe("COST — despacho e encerramento", () => {
  test("COST-10: comandos anteriores à autenticação não executam depois", async () => {
    const { srv, codigo } = await mesaAutenticada();

    const c = clienteAuth(srv);
    // Rajada ANTES de autenticar. Nada pode ficar represado.
    c.envia({ tipo: "assistirMesa", codigo });
    c.envia({ tipo: "criarMesa", apelido: "Fila" });
    c.envia({ tipo: "jogada", jogada: { tipo: "comprarMonte" } });
    assert.equal(c.todas("estado").length, 0);

    await c.autentica(token("uid-tardio"));

    // Autenticar não pode "soltar a fila": nenhuma daquelas mensagens roda.
    assert.equal(c.ultimo("entrou"), null, "criarMesa represado executou depois");
    assert.equal(c.ultimo("assistindo"), null, "assistirMesa represado executou depois");
    assert.equal(srv.conexoes[c.id].codigo, null, "a conexão entrou em sala sem pedir");
    assert.equal(c.todas("estado").length, 0);
  });

  test("COST-11: a visão pública não contém segredo em NENHUMA profundidade", async () => {
    const { srv, codigo, sala } = await mesaAutenticada();
    marcarSegredos(sala.jogo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador"));
    esp.envia({ tipo: "assistirMesa", codigo });

    // Roda a partida inteira com os bots e varre TUDO o que chegou.
    for (let i = 0; i < 400 && !sala.jogo.encerrada; i++) {
      if (!srv.ger.vezEhBot(codigo)) break;
      srv.ger.jogarUmBot(codigo);
      srv.broadcastSala(codigo);
    }

    const achados = varrerSegredos(esp.recebidas, J.segredosDoEspectador(sala.jogo));
    assert.deepEqual(achados, [], "segredo vazou para o espectador em algum evento");
  });

  test("COST-12: evento de fim NÃO vai para credencial vencida", async () => {
    const tempo = relogio();
    // Um humano, meta baixa: o mesmo idioma de REG-09 — `afkBot` entrega o
    // assento ao robô e a partida corre inteira, síncrona, até encerrar.
    const srv = servidorDeCostura(tempo);
    const humano = clienteAuth(srv);

    // Credencial curta DE PROPÓSITO: o salto precisa cair logo depois do `exp` e
    // DENTRO da carência de renovação (30s). Saltar horas derrubaria a conexão
    // de vez, e o teste provaria "conexão fechada não recebe" — outra coisa, e
    // mais fraca. O caso duro é este: conexão VIVA, credencial vencida.
    await humano.autentica(token("uid-0", { validoPorS: 60 }));
    humano.envia({ tipo: "criarMesa", apelido: "Dono", metaPontos: 100 });
    const codigo = humano.ultimo("entrou").codigo;
    humano.envia({ tipo: "iniciarPartida" });
    const sala = srv.ger.salas[codigo];

    tempo.avancarMs(61 * 1000);
    assert.equal(humano.estadoAuth, AUTH.EXPIRADA, "a credencial tem de estar vencida");
    assert.ok(srv.conexoes[humano.id], "e a conexão, ainda viva (dentro da carência)");
    humano.limpar();

    // A partida corre até o fim pela porta do gerenciador — `sair` entrega o
    // assento ao robô e avança, que é o caminho real de quem cai da mesa. O que
    // interessa aqui é o EVENTO de encerramento, não quem o disparou.
    const assento = srv.conexoes[humano.id].assento;
    srv.ger.sair({ codigo, assento });
    for (let i = 0; i < 50 && !sala.jogo.encerrada; i++) srv.ger.avancarBots(sala);
    assert.equal(sala.jogo.encerrada, true, "a partida de teste precisa encerrar");
    assert.equal(sala.liquidada, true, "a liquidação acontece normalmente");

    assert.equal(
      humano.ultimo("fim"),
      null,
      "credencial vencida recebeu o evento de fim (que carrega carteira)"
    );
    assert.equal(humano.todas("estado").length, 0, "nem estado ele recebe");
  });

  test("COST-13: jogador e espectador simultâneos não interferem um no outro", async () => {
    const { srv, codigo, jogadores, sala } = await mesaAutenticada();
    marcarSegredos(sala.jogo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador"));
    esp.envia({ tipo: "assistirMesa", codigo });

    jogadores[0].limpar();
    esp.limpar();
    srv.broadcastSala(codigo);

    const doJogador = jogadores[0].ultimo("estado").visao;
    const doEspectador = esp.ultimo("estado").visao;

    assert.equal(doJogador.voceAssento, 0, "o jogador perdeu a própria visão");
    assert.ok(Array.isArray(doJogador.suaMao));
    assert.equal(doEspectador.suaMao, undefined, "o espectador ganhou mão");
    assert.notDeepEqual(doJogador, doEspectador);
    // E os dois objetos não compartilham referência mutável com o jogo.
    assert.notStrictEqual(doEspectador.assentos, sala.jogo.assentos);
  });

  test("COST-14: partida com bots chega ao encerramento UMA vez só", async () => {
    const { srv, codigo, jogadores, sala } = await mesaAutenticada(relogio(), {
      humanos: 1,
      metaPontos: 100,
    });

    // O humano entrega o assento ao robô e a partida corre inteira.
    jogadores[0].envia({ tipo: "afkBot" });
    assert.equal(sala.jogo.encerrada, true, "a partida de teste precisa encerrar");
    assert.equal(sala.liquidada, true);
    assert.equal(sala.fimEmitido, true);

    const resumoUma = sala.resumoFinal;
    const fimAntes = jogadores[0].todas("fim").length;

    // Repetir os gatilhos não pode pagar de novo nem reemitir o fim — e isto
    // vale DEPOIS da composição, com a guarda de credencial no caminho.
    srv.broadcastSala(codigo);
    srv.ger.avancarBots(sala);
    srv.broadcastSala(codigo);

    assert.equal(sala.resumoFinal, resumoUma, "o resumo não pode ser recalculado");
    assert.equal(jogadores[0].todas("fim").length, fimAntes, "o fim sai UMA vez só");
  });
});

// ===========================================================================
// COST-15 — ANTI-MASCARAMENTO
// ===========================================================================
describe("COST — a costura falha alto se for afrouxada", () => {
  test("COST-15a: retirar a autenticação faz a costura falhar", async () => {
    const { srv, codigo, sala } = await mesaAutenticada();
    marcarSegredos(sala.jogo);

    const intruso = clienteAuth(srv);
    intruso.envia({ tipo: "assistirMesa", codigo });

    // Simula o afrouxamento: alguém marca a conexão como autenticada sem token.
    // Se COST-01 dependesse de outra coisa que não a fronteira de credencial,
    // este empurrão não mudaria nada — e a prova seria vazia.
    srv.conexoes[intruso.id].estadoAuth = AUTH.AUTENTICADO;
    srv.conexoes[intruso.id].codigo = codigo;
    srv.broadcastSala(codigo);

    assert.ok(
      intruso.todas("estado").length > 0,
      "afrouxar a fronteira TINHA que voltar a entregar estado — se não voltou, " +
        "COST-01 está passando por outro motivo e não prova a autenticação"
    );
  });

  test("COST-15b: retirar a projeção pública faz a costura falhar", async () => {
    const { srv, codigo, sala } = await mesaAutenticada();
    marcarSegredos(sala.jogo);

    const esp = clienteAuth(srv);
    await esp.autentica(token("uid-espectador"));
    esp.envia({ tipo: "assistirMesa", codigo });

    // A visão que o espectador recebeu é limpa (COST-02 já afirmou). Agora a
    // prova inversa: a MESMA varredura, aplicada à visão PRIVADA de um assento,
    // tem de acusar. Se não acusar, o varredor não enxerga nada e COST-11
    // estaria passando por cegueira.
    const privada = srv.ger.visao(codigo, 0);
    const achados = varrerSegredos(privada, J.segredosDoEspectador(sala.jogo));
    assert.ok(
      achados.length > 0,
      "a varredura não acusou a visão privada — o detector está cego e as " +
        "provas de não vazamento não valem nada"
    );
  });
});
