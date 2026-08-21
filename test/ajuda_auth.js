// test/ajuda_auth.js — utilidades das suítes de autenticação do handshake.
//
// O bundle `server.js` é um programa: rodado com `node server.js` ele sobe o
// WebSocket. Carregado com `require` ele devolve o registro interno de módulos
// e NÃO abre porta (ver a fronteira de teste no fim do bundle). É por essa
// porta que estas suítes montam conexões falsas, sem rede.
//
// IMPORTANTE — estas utilidades NÃO desligam verificação nenhuma. O verificador
// exercitado nos testes é o MESMO de produção (`criarVerificadorFirebase`); o
// que muda é a origem das chaves públicas (um par RSA gerado aqui, em vez do
// endpoint do Google) e o relógio. Toda assinatura é RS256 de verdade.

const crypto = require("crypto");

const bundle = require("../server.js");

const { criarServidor, AUTH, PROTOCOLO_ATUAL, PROTOCOLO_MINIMO } = bundle.require("servidor");
const { criarContas } = bundle.require("contas");
const { criarVerificadorFirebase, FALHA } = bundle.require("auth_firebase");

const PROJETO = "buraco-master-vip-teste";
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0); // relógio-base fixo das suítes

/** Par de chaves RSA para assinar os tokens do teste.
 *
 *  A chave PÚBLICA entra no lugar do certificado x509 do Google: o
 *  `crypto.createVerify().verify()` do Node aceita tanto um certificado PEM
 *  quanto uma chave pública PEM, então a verificação exercitada é idêntica. */
function novoParDeChaves(kid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    kid,
    privada: privateKey.export({ type: "pkcs8", format: "pem" }),
    publica: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function b64url(valor) {
  return Buffer.from(valor).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Emite um ID Token no formato do Firebase Auth, assinado de verdade.
 * Os parâmetros existem para os testes NEGATIVOS conseguirem produzir cada
 * defeito isoladamente (alg trocado, kid errado, audience errado, expirado…).
 */
function emitirToken({
  chave,
  uid = "uid-jogador",
  emitidoEm = T0,
  validoPorS = 3600,
  aud = PROJETO,
  iss,
  alg = "RS256",
  kid,
  semKid = false,
  assinarCom,
  claims = {},
} = {}) {
  const iatS = Math.floor(emitidoEm / 1000);
  const cabecalho = { alg, typ: "JWT" };
  if (!semKid) cabecalho.kid = kid !== undefined ? kid : chave.kid;
  const conteudo = {
    iss: iss || "https://securetoken.google.com/" + aud,
    aud,
    sub: uid,
    user_id: uid,
    iat: iatS,
    auth_time: iatS,
    exp: iatS + validoPorS,
    ...claims,
  };
  const h = b64url(JSON.stringify(cabecalho));
  const p = b64url(JSON.stringify(conteudo));
  const assinatura = crypto.sign("RSA-SHA256", Buffer.from(h + "." + p), (assinarCom || chave).privada);
  return h + "." + p + "." + b64url(assinatura);
}

/**
 * Relógio controlável — e também o AGENDADOR do servidor.
 *
 * Os dois juntos porque a expiração da sessão depende dos dois andando em
 * sincronia: avançar o relógio tem que disparar o timer que vence a credencial,
 * senão o teste provaria uma coisa e o servidor faria outra. Nada de espera
 * real: `avancarS(3600)` atravessa uma hora inteira na hora.
 */
function relogio(inicio = T0) {
  const tarefas = [];
  return {
    agoraMs: inicio,
    agendarEm(ms, fn) {
      const tarefa = { quando: this.agoraMs + ms, fn, cancelada: false };
      tarefas.push(tarefa);
      return () => { tarefa.cancelada = true; };
    },
    avancarS(s) { return this.avancarMs(s * 1000); },
    avancarMs(ms) {
      const alvo = this.agoraMs + ms;
      // dispara em ordem cronológica; um timer pode reagendar outro no caminho
      // (é o que a carência de renovação faz), então o laço reavalia sempre.
      for (;;) {
        let prox = null;
        for (const t of tarefas) {
          if (t.cancelada || t.quando > alvo) continue;
          if (!prox || t.quando < prox.quando) prox = t;
        }
        if (!prox) break;
        prox.cancelada = true;
        this.agoraMs = Math.max(this.agoraMs, prox.quando);
        prox.fn();
      }
      this.agoraMs = alvo;
      return this;
    },
  };
}

/**
 * Verificador real, com as chaves do teste no lugar dos certificados do Google.
 * `falharBusca:true` simula o endpoint fora do ar (prova o fail closed).
 */
function verificadorDeTeste({ chaves, tempo, projectId = PROJETO, falharBusca = false } = {}) {
  const lista = [].concat(chaves || []);
  return criarVerificadorFirebase({
    projectId,
    agora: () => (tempo ? tempo.agoraMs : T0),
    buscarCertificados: () => {
      if (falharBusca) return Promise.reject(new Error("certificados fora do ar"));
      const certs = {};
      for (const c of lista) certs[c.kid] = c.publica;
      return Promise.resolve({ certs, ttlMs: 3600000 });
    },
  });
}

/** Servidor de salas com código de mesa determinístico, bots imediatos e o
 *  cofre de contas REAL só que em memória (nada é escrito em disco).
 *
 *  Passando `tempo`, o relógio e o agendador do servidor passam a ser os do
 *  teste — é assim que a expiração da sessão fica provável. */
function novoServidor(opts = {}) {
  let n = 0;
  const { tempo, ...resto } = opts;
  return criarServidor(
    Object.assign(
      {
        gerarCodigo: () => "MESA-" + ++n,
        agendar: (fn) => fn(),
        contas: criarContas({ persistir: false }),
      },
      tempo
        ? {
            agora: () => tempo.agoraMs,
            agendarEm: (ms, fn) => tempo.agendarEm(ms, fn),
          }
        : {},
      resto
    )
  );
}

/** Conexão simulada: guarda tudo o que o servidor mandou e se foi derrubada. */
function cliente(srv) {
  const recebidas = [];
  let derrubada = false;
  const id = srv.conectar((msg) => recebidas.push(msg), { fechar: () => { derrubada = true; } });
  return {
    id,
    recebidas,
    get derrubada() { return derrubada; },
    get conexao() { return srv.conexoes[id]; },
    get estadoAuth() { return srv.conexoes[id] && srv.conexoes[id].estadoAuth; },
    get expiraEm() { return srv.conexoes[id] && srv.conexoes[id].expiraEm; },
    /** Autentica pela fronteira do transporte (cabeçalho do upgrade). */
    autentica(token, protocolo = PROTOCOLO_ATUAL) { return srv.autenticar(id, token, protocolo); },
    /** Igual, mas SEM valor padrão: é como se o cliente tivesse omitido o campo. */
    autenticaCru(token, protocolo) { return srv.autenticar(id, token, protocolo); },
    /** Autentica pela primeira mensagem do protocolo (caminho do navegador). */
    autenticaPorMensagem(token, protocolo = PROTOCOLO_ATUAL) {
      return srv.processar(id, { tipo: "auth", token, protocolo });
    },
    envia(msg) { return srv.processar(id, msg); },
    ultimo(tipo) {
      for (let i = recebidas.length - 1; i >= 0; i--) if (recebidas[i].tipo === tipo) return recebidas[i];
      return null;
    },
    todas(tipo) { return recebidas.filter((m) => m.tipo === tipo); },
    limpar() { recebidas.length = 0; return this; },
  };
}

module.exports = {
  AUTH,
  FALHA,
  PROJETO,
  PROTOCOLO_ATUAL,
  PROTOCOLO_MINIMO,
  T0,
  bundle,
  cliente,
  emitirToken,
  novoParDeChaves,
  novoServidor,
  relogio,
  verificadorDeTeste,
};
