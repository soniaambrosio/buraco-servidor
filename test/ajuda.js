// test/ajuda.js — utilidades das suítes de espectador e regressão.
//
// O bundle `server.js` é um programa: rodado com `node server.js` ele sobe o
// WebSocket. Carregado com `require` ele devolve o registro interno de módulos
// e NÃO abre porta (ver a fronteira de teste no fim do bundle). É por essa
// porta que estas suítes montam mesas e conexões falsas, sem rede.

// [COMPOSIÇÃO ws-auth + espectador] POR QUE ESTE ARQUIVO AGORA AUTENTICA.
//
// Estas suítes nasceram quando o transporte não autenticava: `conectar` já
// devolvia uma conexão apta a agir. Depois da composição isso deixou de valer —
// e deixou de valer DE PROPÓSITO: conexão não autenticada não recebe estado
// nenhum, nem a projeção pública do espectador.
//
// Então o arnês passou a fazer o que um cliente real faz: apresentar um token
// válido antes de qualquer coisa. NENHUMA asserção foi alterada, afrouxada ou
// removida — o que mudou é só como a conexão de teste nasce. O caso do
// espectador NÃO autenticado não sumiu: virou teste próprio, na suíte de
// costura (`test/costura.test.js`).
//
// A fábrica de token vem de `ajuda_auth.js` por REUSO, não por consolidação: os
// dois auxiliares seguem separados, como a OS pede. Duplicar aqui a geração de
// par de chaves e a assinatura RS256 criaria uma segunda implementação de
// credencial de teste, e as duas divergiriam no primeiro ajuste.

const bundle = require("../server.js");

const J = bundle.require("jogo");
const { criarServidor } = bundle.require("servidor");
const { criarContas } = bundle.require("contas");

const {
  PROTOCOLO_ATUAL,
  T0,
  emitirToken,
  novoParDeChaves,
  verificadorDeTeste,
} = require("./ajuda_auth.js");

// Um par de chaves para todo o arquivo. Determinístico e compartilhado porque
// o token emitido aqui precisa ser aceito pelo verificador instalado em
// `novoServidor` — inclusive quando o teste chama os dois separadamente.
const PAR = novoParDeChaves("kid-ajuda");

/** Token válido para `uid`, no relógio-base das suítes. */
function tokenDe(uid) {
  return emitirToken({ chave: PAR, uid, emitidoEm: T0 });
}

/**
 * Autentica uma conexão já criada, pela MESMA porta de produção
 * (`srv.autenticar`) e com o MESMO verificador de `criarVerificadorFirebase`.
 * Nada é desligado para o teste passar.
 */
function autenticarConexao(srv, id, uid) {
  return srv.autenticar(id, tokenDe(uid), PROTOCOLO_ATUAL);
}

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
        // [COMPOSIÇÃO] Verificador REAL, com as chaves de teste. O relógio é
        // fixado em T0 para que o token emitido por `tokenDe` esteja dentro da
        // validade — e não para esconder expiração: a expiração tem suíte
        // própria, com relógio controlado, em `ws_auth.test.js`.
        verificarToken: verificadorDeTeste({ chaves: [PAR] }),
        agora: () => T0,
      },
      opts
    )
  );
}

/** Cliente simulado AUTENTICADO: guarda tudo o que o servidor mandou para ele.
 *
 *  Assíncrono porque a verificação do token é — é a mesma promessa que o
 *  transporte de produção espera antes de liberar a conexão. */
async function cliente(srv, uid = "uid-anonimo") {
  const recebidas = [];
  const id = srv.conectar((msg) => recebidas.push(msg));
  await autenticarConexao(srv, id, uid);
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
async function mesaComPartida({ humanos = 4, modalidade = "sbtl", metaPontos = 3000 } = {}) {
  const srv = novoServidor();
  const jogadores = [];

  // Cada conexão autentica com o uid que ela declara. `jogadorId` continua indo
  // na mensagem de propósito: os testes de payload adulterado precisam dele lá.
  // Depois da composição ele não decide mais nada — a identidade vem do token —,
  // e é exatamente isso que a suíte de costura afirma.
  const dono = await cliente(srv, "uid-0");
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
    const c = await cliente(srv, "uid-" + i);
    c.envia({ tipo: "entrarMesa", codigo, apelido: "Jogador" + i, jogadorId: "uid-" + i });
    jogadores.push(c);
  }

  dono.envia({ tipo: "iniciarPartida" });
  return { srv, codigo, jogadores, sala: srv.ger.salas[codigo] };
}

/**
 * Conexão AUTENTICADA que só ASSISTE a `codigo`.
 *
 * [COMPOSIÇÃO] Quando o teste declara `extra.jogadorId`, a conexão autentica
 * COM AQUELE uid. Parece detalhe e é o contrário: separa os dois eixos de
 * falsificação, que depois da composição têm donos diferentes.
 *
 *   identidade forjada (token de A, payload dizendo B) -> recusado pela folha
 *     de autenticação, e provado em `ws_auth.test.js`;
 *   assento/papel forjado (uid legítimo pedindo assento alheio) -> não concede
 *     nada, e é ISTO que esta suíte existe para provar.
 *
 * Sem essa distinção, os testes de assento morreriam na fronteira de identidade
 * e nunca chegariam a exercitar o que eles de fato afirmam — passariam a provar
 * a folha errada.
 */
async function espectador(srv, codigo, extra = {}) {
  const c = await cliente(srv, extra.jogadorId || "uid-espectador");
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
async function espectadorVigiado(srv, codigo, obterJogo, extra = {}) {
  const recebidas = [];
  const violacoes = [];
  const id = srv.conectar((msg) => {
    recebidas.push(msg);
    const jogo = obterJogo();
    if (!jogo) return;
    const achados = varrerSegredos(msg, J.segredosDoEspectador(jogo));
    if (achados.length) violacoes.push({ tipo: msg.tipo, achados });
  });
  // Mesma regra de `espectador`: o uid do token acompanha o que o teste declara.
  await autenticarConexao(srv, id, extra.jogadorId || "uid-espectador");
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
  PAR,
  T0,
  autenticarConexao,
  tokenDe,
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
