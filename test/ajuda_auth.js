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

const { criarServidor, AUTH } = bundle.require("servidor");
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
  };
  const h = b64url(JSON.stringify(cabecalho));
  const p = b64url(JSON.stringify(conteudo));
  const assinatura = crypto.sign("RSA-SHA256", Buffer.from(h + "." + p), (assinarCom || chave).privada);
  return h + "." + p + "." + b64url(assinatura);
}

/** Relógio controlável, para provar expiração sem esperar uma hora. */
function relogio(inicio = T0) {
  return { agoraMs: inicio, avancarS(s) { this.agoraMs += s * 1000; return this; } };
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
 *  cofre de contas REAL só que em memória (nada é escrito em disco). */
function novoServidor(opts = {}) {
  let n = 0;
  return criarServidor(
    Object.assign(
      {
        gerarCodigo: () => "MESA-" + ++n,
        agendar: (fn) => fn(),
        contas: criarContas({ persistir: false }),
      },
      opts
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
    /** Autentica pela fronteira do transporte (cabeçalho do upgrade). */
    autentica(token) { return srv.autenticar(id, token); },
    /** Autentica pela primeira mensagem do protocolo (caminho do navegador). */
    autenticaPorMensagem(token) { return srv.processar(id, { tipo: "auth", token }); },
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
  T0,
  bundle,
  cliente,
  emitirToken,
  novoParDeChaves,
  novoServidor,
  relogio,
  verificadorDeTeste,
};
