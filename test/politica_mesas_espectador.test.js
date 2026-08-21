// Política de acesso às mesas e ao modo espectador.
//
// Estes casos não testam a projeção de cartas — `espectador.test.js` já fecha
// esse P0. Aqui o alvo é anterior: quem pode chegar à projeção pública.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  T0,
  cliente,
  emitirToken,
  novoParDeChaves,
  novoServidor,
  relogio,
  verificadorDeTeste,
} = require("./ajuda_auth.js");

const CHAVE = novoParDeChaves("kid-politica-mesas");

function token(uid, vip = false) {
  return emitirToken({
    chave: CHAVE,
    uid,
    emitidoEm: T0,
    claims: { vip },
  });
}

function servidor() {
  const tempo = relogio();
  return novoServidor({
    tempo,
    verificarToken: verificadorDeTeste({ chaves: CHAVE, tempo }),
  });
}

async function autenticado(srv, uid, vip = false) {
  const c = cliente(srv);
  assert.equal(await c.autentica(token(uid, vip)), true);
  return c;
}

describe("política de tipos de mesa", () => {
  test("VIP exige claim assinado para criar, entrar e assistir", async () => {
    const srv = servidor();
    const comum = await autenticado(srv, "uid-comum");
    comum.envia({ tipo: "criarMesa", apelido: "Comum", tipoMesa: "vip" });
    assert.equal(comum.ultimo("erro").codigo, "VIP_NECESSARIO");
    assert.equal(Object.keys(srv.ger.salas).length, 0);

    const dono = await autenticado(srv, "uid-vip-1", true);
    dono.envia({
      tipo: "criarMesa",
      apelido: "VIP",
      tipoMesa: "vip",
      espectadores: true,
    });
    const codigo = dono.ultimo("entrou").codigo;

    comum.envia({ tipo: "entrarMesa", codigo, apelido: "Comum" });
    assert.equal(comum.ultimo("erro").codigo, "VIP_NECESSARIO");

    comum.envia({ tipo: "assistirMesa", codigo });
    assert.equal(comum.ultimo("erro").codigo, "VIP_NECESSARIO");
    assert.equal(comum.ultimo("estado"), null);

    const espectadorVip = await autenticado(srv, "uid-vip-2", true);
    espectadorVip.envia({ tipo: "assistirMesa", codigo });
    assert.ok(espectadorVip.ultimo("estado"));
    assert.equal(srv.papelDe(srv.conexoes[espectadorVip.id]), "espectador");
  });

  test("interruptor de espectadores fecha pública, VIP e privada", async () => {
    for (const tipoMesa of ["publica", "vip", "privada"]) {
      const srv = servidor();
      const dono = await autenticado(srv, `dono-${tipoMesa}`, true);
      dono.envia({
        tipo: "criarMesa",
        apelido: "Dono",
        tipoMesa,
        espectadores: false,
      });
      const codigo = dono.ultimo("entrou").codigo;
      const esp = await autenticado(srv, `esp-${tipoMesa}`, true);
      esp.envia({ tipo: "assistirMesa", codigo });
      assert.equal(esp.ultimo("erro").codigo, "ESPECTADORES_DESATIVADOS");
      assert.equal(esp.ultimo("estado"), null);
    }
  });

  test("treino nunca pode ser assistido, mesmo se o cliente pedir", async () => {
    const srv = servidor();
    const dono = await autenticado(srv, "uid-treino");
    dono.envia({
      tipo: "criarMesa",
      apelido: "Treino",
      tipoMesa: "treino",
      espectadores: true,
    });
    const codigo = dono.ultimo("entrou").codigo;
    assert.equal(srv.ger.salas[codigo].espectadoresPermitidos, false);

    const esp = await autenticado(srv, "uid-curioso", true);
    esp.envia({ tipo: "assistirMesa", codigo });
    assert.equal(esp.ultimo("erro").codigo, "TREINO_NAO_PERMITE_ESPECTADOR");
    assert.equal(esp.ultimo("estado"), null);
  });

  test("privada exige o código válido e não revela detalhes em erro", async () => {
    const srv = servidor();
    const esp = await autenticado(srv, "uid-esp");
    esp.envia({ tipo: "assistirMesa", codigo: "BURACO-INEXISTENTE" });
    assert.equal(esp.ultimo("estado"), null);
    assert.equal(esp.ultimo("erro").motivo, "mesa não encontrada");
  });
});
