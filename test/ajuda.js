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
// [META] A MESA NASCE COM META CANÔNICA — SEMPRE.
//
// O servidor só aceita 1.500, 2.000 e 3.000 numa mesa nova, e não existe porta
// de teste que o faça aceitar outra coisa: se existisse, a suíte inteira
// estaria medindo um servidor que não é o que roda em produção.
//
// Só que várias provas aqui precisam de partida CURTA (meta 100, meta 1) para
// chegar ao encerramento sem jogar 2.000 pontos de bot. Então quem encurta é o
// JOGO, depois de iniciado — estado do motor, que estas suítes já reescrevem à
// mão para forçar placar e encerramento. A MESA continua sendo uma mesa que
// existe em produção; o que é de mentirinha é a duração da partida dela.
const METAS_DE_MESA = [1500, 2000, 3000];

async function mesaComPartida({ humanos = 4, modalidade = "sbtl", metaPontos = 3000 } = {}) {
  const metaDaMesa = METAS_DE_MESA.includes(metaPontos) ? metaPontos : undefined;
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
    metaPontos: metaDaMesa,
  });
  jogadores.push(dono);
  const codigo = dono.ultimo("entrou").codigo;

  for (let i = 1; i < humanos; i++) {
    const c = await cliente(srv, "uid-" + i);
    c.envia({ tipo: "entrarMesa", codigo, apelido: "Jogador" + i, jogadorId: "uid-" + i });
    jogadores.push(c);
  }

  dono.envia({ tipo: "iniciarPartida" });
  const sala = srv.ger.salas[codigo];
  // Meta de teste, aplicada ao JOGO e nunca à mesa. Ver METAS_DE_MESA acima.
  if (metaDaMesa === undefined && sala && sala.jogo) sala.jogo.metaPontos = metaPontos;
  return { srv, codigo, jogadores, sala };
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

// [CORREÇÃO UUID] IDENTIDADE OPACA — POR QUE ELA SAI DE CENA ANTES DA TOKENIZAÇÃO.
//
// Um id de carta é `c` + dígitos (`c1818`). Um `eventoId` é `crypto.randomUUID()`:
// 32 dígitos HEXADECIMAIS. Todo dígito decimal é dígito hexadecimal, e `c` é
// hexadecimal — então `c1818` é uma sequência que um UUID pode conter POR SORTEIO.
// A varredura antiga procurava por substring cega (`no.includes(s)`) e com isso
// acusava vazamento onde só houve coincidência: medido nesta base, 60% dos UUIDs
// contêm algum dos 108 ids vivos de uma partida com o contador ainda baixo.
//
// A correção NÃO é ignorar `eventoId`, nem tirar id de carta da auditoria: é
// separar os dois fatos que a substring confundia —
//
//   id presente como DADO   -> `visao.x = "c1818"`, item de lista, chave de objeto,
//                              `carta.id`. Comparação por VALOR INTEIRO. Exata, e
//                              sem heurística nenhuma.
//   id citado em TEXTO      -> "carta c1818 recusada". Comparação por TOKEN
//                              COMPLETO, não por pedaço de palavra.
//   sequência DENTRO de uma identidade opaca -> não é nem um nem outro. Um UUID é
//                              atômico: os 36 caracteres valem juntos, e um recorte
//                              no meio deles não referencia coisa nenhuma.
//
// Por isso a FORMA canônica de UUID é reconhecida como valor — onde quer que ela
// apareça, e não num campo escolhido a dedo — e sai antes da tokenização. O que ela
// NÃO ganha é passe livre: se um `eventoId` fosse exatamente um id secreto, ou se um
// id secreto ficasse colado do lado de fora do UUID, a varredura continua acusando.
// O poder de detecção fica igual; o que morre é o acaso.
const FORMA_UUID =
  /(?<![0-9a-fA-F])[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?![0-9a-fA-F])/g;

/**
 * Tokens de um texto livre, já sem as identidades opacas.
 *
 * Cada corrida de caracteres de identificador vira token, e uma corrida com hífen
 * também entrega suas partes: assim `SEGREDO-MAO0-1` casa inteiro (é o id que
 * `marcarSegredos` carimba) e um `mao0-c1818` ainda entrega `c1818`. O UUID vira
 * ESPAÇO, não vazio — espaço é separador, então tirá-lo nunca cola dois vizinhos
 * num token que não existia antes.
 */
function tokensDe(texto) {
  const tokens = new Set();
  for (const corrida of texto.replace(FORMA_UUID, " ").match(/[A-Za-z0-9_-]+/g) || []) {
    tokens.add(corrida);
    if (corrida.includes("-")) {
      for (const parte of corrida.split("-")) if (parte) tokens.add(parte);
    }
  }
  return tokens;
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
      // (1) DADO: o id inteiro, exatamente. Vale para valor de campo e, pela
      //     recursão, para item de lista em qualquer profundidade.
      if (segredos.has(no)) {
        achados.push(caminho + " = " + no);
        return;
      }
      // (2) TEXTO: o id como token independente dentro de uma frase.
      for (const token of tokensDe(no)) {
        if (segredos.has(token)) achados.push(caminho + " cita o token " + token);
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
    // (3) OBJETO DE CARTA: a carta secreta viajando inteira, e não só o id solto.
    //     A recursão abaixo já pegaria o `.id`; este achado existe para o relatório
    //     dizer QUE FORMA o vazamento teve — carta inteira é pior que id avulso.
    if (typeof no.id === "string" && segredos.has(no.id)) {
      achados.push(caminho + " é OBJETO de carta secreta " + no.id);
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
  tokensDe,
  segredosAgora,
  PREFIXO_SEGREDO,
};
