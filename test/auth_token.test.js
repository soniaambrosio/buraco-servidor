// test/auth_token.test.js — VERIFICAÇÃO DA CREDENCIAL (módulo auth_firebase).
//
// Aqui se prova a metade criptográfica: o servidor só aceita um ID Token que
// esteja assinado pela chave certa, no algoritmo certo, para o projeto certo e
// dentro da validade — e que o uid sai DO TOKEN, não de campo nenhum.
// A outra metade (o que a conexão faz com esse uid) está em ws_auth.test.js.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FALHA, PROJETO, T0,
  emitirToken, novoParDeChaves, relogio, verificadorDeTeste,
} = require("./ajuda_auth.js");

const CHAVE = novoParDeChaves("kid-teste-1");

test("token válido: autentica e o uid vem do sub do token", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const r = await verificar(emitirToken({ chave: CHAVE, uid: "uid-sonia" }));
  assert.equal(r.ok, true);
  assert.equal(r.uid, "uid-sonia");
});

test("token ausente é recusado", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  for (const ausente of [undefined, null]) {
    const r = await verificar(ausente);
    assert.equal(r.ok, false);
    assert.equal(r.codigo, FALHA.SEM_TOKEN);
  }
});

test("token vazio é recusado", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const r = await verificar("");
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.SEM_TOKEN);
});

test("token malformado é recusado (e não derruba o servidor)", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const lixos = [
    "nao-e-jwt",
    "a.b",                       // partes de menos
    "a.b.c.d",                   // partes demais
    "!!!.???.###",               // fora do alfabeto base64url
    "eyJhbGciOiJSUzI1NiJ9..",    // assinatura vazia
    b64("nao é json") + "." + b64("nem isso") + ".AAAA",
    JSON.stringify({ alg: "RS256" }), // objeto cru
    12345,                       // nem string é
    {},
  ];
  for (const lixo of lixos) {
    const r = await verificar(lixo);
    assert.equal(r.ok, false, "deveria recusar: " + String(lixo));
    assert.equal(r.codigo, FALHA.TOKEN_MALFORMADO, "código para: " + String(lixo));
  }
});

test("token assinado por outra chave é recusado (assinatura inválida)", async () => {
  const impostora = novoParDeChaves("kid-teste-1"); // MESMO kid, chave diferente
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const r = await verificar(emitirToken({ chave: CHAVE, assinarCom: impostora }));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.ASSINATURA_INVALIDA);
});

test("payload adulterado depois de assinado é recusado", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const token = emitirToken({ chave: CHAVE, uid: "uid-a" });
  const [h, p, s] = token.split(".");
  const conteudo = JSON.parse(Buffer.from(p, "base64").toString("utf8"));
  conteudo.sub = "uid-b"; // troca o dono na marra
  conteudo.user_id = "uid-b";
  const adulterado = h + "." + b64(JSON.stringify(conteudo)) + "." + s;

  const r = await verificar(adulterado);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.ASSINATURA_INVALIDA);
});

test("token expirado é recusado", async () => {
  const tempo = relogio();
  const verificar = verificadorDeTeste({ chaves: CHAVE, tempo });
  const token = emitirToken({ chave: CHAVE, emitidoEm: T0, validoPorS: 3600 });

  assert.equal((await verificar(token)).ok, true, "vale enquanto está dentro da validade");

  tempo.avancarS(3600 + 61); // passou a validade + a tolerância de relógio
  const r = await verificar(token);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.EXPIRADO);
});

test("token emitido no futuro é recusado", async () => {
  const tempo = relogio();
  const verificar = verificadorDeTeste({ chaves: CHAVE, tempo });
  const r = await verificar(emitirToken({ chave: CHAVE, emitidoEm: T0 + 10 * 60 * 1000 }));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.EMITIDO_NO_FUTURO);
});

test("token de OUTRO projeto Firebase é recusado (audience)", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const r = await verificar(emitirToken({ chave: CHAVE, aud: "projeto-de-outra-pessoa" }));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.AUDIENCE_INVALIDO);
});

test("token com emissor errado é recusado (issuer)", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const r = await verificar(emitirToken({ chave: CHAVE, iss: "https://securetoken.google.com/outro" }));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.ISSUER_INVALIDO);
});

test("alg 'none' e HS256 são recusados (confusão de algoritmo)", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  for (const alg of ["none", "HS256", "RS512", ""]) {
    const r = await verificar(emitirToken({ chave: CHAVE, alg }));
    assert.equal(r.ok, false, "deveria recusar alg=" + alg);
    assert.equal(r.codigo, FALHA.ALG_NAO_SUPORTADO);
  }
});

test("token sem kid, ou com kid desconhecido, é recusado", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });

  const semKid = await verificar(emitirToken({ chave: CHAVE, semKid: true }));
  assert.equal(semKid.ok, false);
  assert.equal(semKid.codigo, FALHA.SEM_KID);

  const outroKid = await verificar(emitirToken({ chave: CHAVE, kid: "kid-que-nao-existe" }));
  assert.equal(outroKid.ok, false);
  assert.equal(outroKid.codigo, FALHA.KID_DESCONHECIDO);
});

test("token sem sub (sem identidade) é recusado", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  for (const uid of ["", null, 42]) {
    const r = await verificar(emitirToken({ chave: CHAVE, uid }));
    assert.equal(r.ok, false, "deveria recusar sub=" + String(uid));
    assert.equal(r.codigo, FALHA.SEM_SUJEITO);
  }
});

test("FAIL CLOSED: sem os certificados do Google, ninguém autentica", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE, falharBusca: true });
  const r = await verificar(emitirToken({ chave: CHAVE }));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.CERTIFICADOS_INDISPONIVEIS);
});

test("FAIL CLOSED: sem FIREBASE_PROJECT_ID, ninguém autentica", async () => {
  const verificar = verificadorDeTeste({ chaves: CHAVE, projectId: "" });
  const r = await verificar(emitirToken({ chave: CHAVE }));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, FALHA.SEM_PROJETO);
});

test("os certificados são buscados uma vez só e reaproveitados no TTL", async () => {
  const { criarCacheDeCertificados } = require("../server.js").require("auth_firebase");
  let buscas = 0;
  const tempo = relogio();
  const obter = criarCacheDeCertificados({
    agora: () => tempo.agoraMs,
    buscar: () => { buscas++; return Promise.resolve({ certs: { k: "x" }, ttlMs: 60000 }); },
  });

  await Promise.all([obter(), obter(), obter()]); // rajada simultânea
  assert.equal(buscas, 1, "uma busca em voo é compartilhada");

  await obter();
  assert.equal(buscas, 1, "dentro do TTL não busca de novo");

  tempo.avancarS(61);
  await obter();
  assert.equal(buscas, 2, "vencido o TTL, busca de novo");
});

test("o cabeçalho Authorization só entrega um Bearer bem formado", () => {
  const { bearerDoCabecalho } = require("../server.js").require("ws_server");
  assert.equal(bearerDoCabecalho("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(bearerDoCabecalho("bearer abc.def.ghi"), "abc.def.ghi");
  for (const ruim of [undefined, null, "", "abc.def.ghi", "Basic dXNlcjpwYXNz", "Bearer", "Bearer ", "Bearer a b", 7]) {
    assert.equal(bearerDoCabecalho(ruim), null, "não deveria virar credencial: " + String(ruim));
  }
});

test("PROJETO de teste não vaza para o issuer esperado por engano", async () => {
  // guarda-corpo do próprio teste: o issuer conferido é derivado do projectId
  const verificar = verificadorDeTeste({ chaves: CHAVE });
  const r = await verificar(emitirToken({ chave: CHAVE, iss: "https://securetoken.google.com/" + PROJETO }));
  assert.equal(r.ok, true);
});

function b64(s) {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
