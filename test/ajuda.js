// test/ajuda.js — utilidades das suítes de espectador e regressão.
//
// O bundle `server.js` é um programa: rodado com `node server.js` ele sobe o
// WebSocket. Carregado com `require` ele devolve o registro interno de módulos
// e NÃO abre porta (ver a fronteira de teste no fim do bundle). É por essa
// porta que estas suítes montam mesas e conexões falsas, sem rede.

const bundle = require("../server.js");

const J = bundle.require("jogo");
const { criarServidor } = bundle.require("servidor");
const { criarContas } = bundle.require("contas");

/**
 * Servidor com código de mesa determinístico e bots em ritmo imediato.
 *
 * Usa o COFRE DE CONTAS de verdade, só que em memória (`persistir:false`): sem
 * ele a partida encerra sem `resumoFinal` e o evento `fim` nunca sai — e é
 * justamente esse evento que carrega carteira (moedas, XP, nível), que precisa
 * ser provado ausente para quem assiste. Nada é escrito em disco.
 */
function novoServidor(opts = {}) {
  let n = 0;
  return criarServidor(
    Object.assign(
      {
        gerarCodigo: () => "MESA-" + ++n,
        agendar: (fn) => fn(), // sem respiro: os bots jogam já, síncrono
        contas: criarContas({ persistir: false }),
      },
      opts
    )
  );
}

/** Cliente simulado: guarda tudo o que o servidor mandou para ele. */
function cliente(srv) {
  const recebidas = [];
  const id = srv.conectar((msg) => recebidas.push(msg));
  return {
    id,
    recebidas,
    envia(msg) {
      srv.processar(id, msg);
      return this;
    },
    ultimo(tipo) {
      for (let i = recebidas.length - 1; i >= 0; i--) {
        if (recebidas[i].tipo === tipo) return recebidas[i];
      }
      return null;
    },
    todas(tipo) {
      return recebidas.filter((m) => m.tipo === tipo);
    },
    /** Todo estado que este cliente já recebeu (snapshot inicial + incrementais). */
    estados() {
      return this.todas("estado").map((m) => m.visao);
    },
    limpar() {
      recebidas.length = 0;
      return this;
    },
  };
}

/**
 * Mesa pronta com `humanos` pessoas sentadas (o resto vira bot ao iniciar).
 * Devolve { srv, codigo, jogadores[], sala }.
 */
function mesaComPartida({ humanos = 4, modalidade = "sbtl", metaPontos = 3000 } = {}) {
  const srv = novoServidor();
  const jogadores = [];

  const dono = cliente(srv);
  dono.envia({
    tipo: "criarMesa",
    apelido: "Dono",
    jogadorId: "uid-0",
    modalidade,
    metaPontos,
  });
  jogadores.push(dono);
  const codigo = dono.ultimo("entrou").codigo;

  for (let i = 1; i < humanos; i++) {
    const c = cliente(srv);
    c.envia({ tipo: "entrarMesa", codigo, apelido: "Jogador" + i, jogadorId: "uid-" + i });
    jogadores.push(c);
  }

  dono.envia({ tipo: "iniciarPartida" });
  return { srv, codigo, jogadores, sala: srv.ger.salas[codigo] };
}

/** Conexão que só ASSISTE a `codigo`. */
function espectador(srv, codigo, extra = {}) {
  const c = cliente(srv);
  c.envia(Object.assign({ tipo: "assistirMesa", codigo, jogadorId: "uid-espectador" }, extra));
  return c;
}

/**
 * Espectador VIGIADO: confere cada mensagem NO INSTANTE do envio, contra os
 * segredos vivos naquele momento.
 *
 * Por que no instante, e não no fim: ao longo da partida uma carta secreta
 * LEGITIMAMENTE deixa de ser secreta — sai da mão para o lixo ou para um jogo
 * baixado, e aí é pública. Varrer o histórico no fim acusaria essas cartas e o
 * teste mentiria. O invariante correto é pontual: no momento em que o payload
 * sai, nada que é secreto AGORA pode estar dentro dele.
 */
function espectadorVigiado(srv, codigo, obterJogo, extra = {}) {
  const recebidas = [];
  const violacoes = [];
  const id = srv.conectar((msg) => {
    recebidas.push(msg);
    const jogo = obterJogo();
    if (!jogo) return;
    const achados = varrerSegredos(msg, J.segredosDoEspectador(jogo));
    if (achados.length) violacoes.push({ tipo: msg.tipo, achados });
  });
  srv.processar(id, Object.assign({ tipo: "assistirMesa", codigo }, extra));
  return {
    id,
    recebidas,
    violacoes,
    envia(msg) {
      srv.processar(id, msg);
      return this;
    },
    todas(tipo) {
      return recebidas.filter((m) => m.tipo === tipo);
    },
    estados() {
      return this.todas("estado").map((m) => m.visao);
    },
    ultimo(tipo) {
      for (let i = recebidas.length - 1; i >= 0; i--) {
        if (recebidas[i].tipo === tipo) return recebidas[i];
      }
      return null;
    },
  };
}

const PREFIXO_SEGREDO = "SEGREDO-";

/**
 * Carimba ids RECONHECÍVEIS em tudo o que é secreto para quem assiste: as
 * quatro mãos, o monte e os mortos (§8 da OS: "partida de teste contendo IDs
 * secretos conhecidos").
 *
 * Dois motivos para renomear em vez de só ler os ids que o baralho gerou:
 * um id como `c37` apareceria por acidente numa varredura de substring, e um
 * prefixo próprio deixa o vazamento óbvio no relatório do teste.
 *
 * Só é chamado LOGO APÓS iniciar a partida, quando ainda não há pendência de
 * topo nem lixo comprado apontando para id nenhum.
 */
function marcarSegredos(jogo) {
  const marcados = [];
  const marcar = (carta, rotulo) => {
    carta.id = PREFIXO_SEGREDO + rotulo;
    marcados.push(carta.id);
  };
  jogo.maos.forEach((mao, a) => mao.forEach((c, i) => marcar(c, "MAO" + a + "-" + i)));
  jogo.monte.forEach((c, i) => marcar(c, "MONTE-" + i));
  jogo.mortos.forEach((m, k) => m.forEach((c, i) => marcar(c, "MORTO" + k + "-" + i)));
  return marcados;
}

/**
 * Varredura estrutural: ids secretos que escaparam para `payload`.
 *
 * Não confia na função do próprio bundle (seria o réu avaliando a prova):
 * reimplementa a busca aqui, percorrendo chaves, strings, listas e objetos
 * aninhados em qualquer profundidade. Pega o segredo mesmo sob
 * `dados.x.y.z.valor` ou sob uma chave inventada.
 */
function varrerSegredos(payload, segredos) {
  const achados = [];
  const vistos = new Set();
  (function varrer(no, caminho) {
    if (no == null) return;
    if (typeof no === "string") {
      if (segredos.has(no)) achados.push(caminho + " = " + no);
      // substring: pega o segredo embutido em texto (mensagem de erro, dica...)
      for (const s of segredos) {
        if (no !== s && no.includes(s)) achados.push(caminho + " contém " + s);
      }
      return;
    }
    if (typeof no !== "object") return;
    if (vistos.has(no)) return;
    vistos.add(no);
    if (Array.isArray(no)) {
      no.forEach((item, i) => varrer(item, caminho + "[" + i + "]"));
      return;
    }
    for (const chave of Object.keys(no)) {
      if (segredos.has(chave)) achados.push(caminho + " tem CHAVE secreta " + chave);
      varrer(no[chave], caminho + "." + chave);
    }
  })(payload, "raiz");
  return achados;
}

/** Conjunto de segredos VIVO no instante da chamada (as 4 mãos + monte + mortos). */
function segredosAgora(jogo) {
  return J.segredosDoEspectador(jogo);
}

module.exports = {
  J,
  novoServidor,
  cliente,
  mesaComPartida,
  espectador,
  espectadorVigiado,
  marcarSegredos,
  varrerSegredos,
  segredosAgora,
  PREFIXO_SEGREDO,
};
