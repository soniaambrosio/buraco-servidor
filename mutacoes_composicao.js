// ===========================================================================
// PROVAS NEGATIVAS DA COMPOSIÇÃO — 16 mutações não-vácuas, sobre a SUÍTE INTEIRA.
//
// `mutacoes_os7.js` mede a folha do controlador contra quatro arquivos de teste.
// Esta campanha é outra coisa: cada mutação aqui desfaz um invariante que a
// COMPOSIÇÃO tinha de preservar — meta autoritativa, controlador, chat,
// credencial única —, e a bateria que julga é a suíte completa. Uma mutação que
// só a suíte de outra folha pega ainda conta: o ponto é que ela MORRA.
//
// DUAS TRAVAS ANTI-VÁCUO, e as duas param o processo:
//   1) a âncora tem de aparecer EXATAMENTE uma vez (`server.js` é um bundle de
//      fábricas e identificadores se repetem entre módulos);
//   2) o arquivo tem de mudar de bytes depois da troca.
// Sem elas, uma âncora que não casou vira "mutante não detectado" sem nunca ter
// sido injetada — e a campanha mente sobre cobertura.
//
// Uso: node mutacoes_composicao.js
// ===========================================================================
const fs = require("fs");
const { execFileSync } = require("child_process");

const ALVO = "server.js";

const MUTACOES = [
  // --- META AUTORITATIVA ---------------------------------------------------
  {
    n: 1,
    nome: "a validação da meta some (meta inválida cria mesa)",
    de: `    if (meta === null) return { erro: "meta de pontos inválida" };`,
    para: `    if (false) return { erro: "meta de pontos inválida" };`,
  },
  {
    n: 2,
    nome: "o padrão volta a ser 3000",
    de: `const META_PADRAO = 2000;`,
    para: `const META_PADRAO = 3000;`,
  },
  {
    n: 3,
    nome: `a lista branca aceita a STRING "2000"`,
    de: `  return METAS_CANONICAS.includes(valor) ? valor : null;`,
    para: `  return METAS_CANONICAS.includes(Number(valor)) ? Number(valor) : null;`,
  },
  {
    n: 4,
    nome: "a reconexão passa a trocar a meta da partida",
    // [OS 41] A ancora ganhou `assento: msg.assento`: a escolha autoritativa de
    // assento passou a atravessar o despachante. A mutacao e a mesma — o que
    // mudou foi a linha em que ela e injetada.
    de: `        const r = ger.entrarMesa({ codigo: msg.codigo, apelido: msg.apelido, jogadorId: c.jogadorId, uidAutenticado: c.uidAutenticado, assento: msg.assento });`,
    para: `        if (msg.metaPontos !== undefined) { const s = ger.salas[msg.codigo]; if (s && s.jogo) s.jogo.metaPontos = msg.metaPontos; }
        const r = ger.entrarMesa({ codigo: msg.codigo, apelido: msg.apelido, jogadorId: c.jogadorId, uidAutenticado: c.uidAutenticado, assento: msg.assento });`,
  },
  {
    n: 5,
    nome: "a meta da sala deixa de ser congelada",
    de: `      value: meta, writable: false, configurable: false, enumerable: true,`,
    para: `      value: meta, writable: true, configurable: true, enumerable: true,`,
  },
  {
    n: 6,
    nome: "`msg.aposta` volta a ser lido na criação de mesa",
    de: `        const r = ger.criarMesa({ apelido: msg.apelido, jogadorId: c.jogadorId, uidAutenticado: c.uidAutenticado, modalidade: msg.modalidade, metaPontos: msg.metaPontos });`,
    para: `        const r = ger.criarMesa({ apelido: msg.apelido, jogadorId: c.jogadorId, uidAutenticado: c.uidAutenticado, modalidade: msg.modalidade, metaPontos: msg.metaPontos, aposta: msg.aposta });`,
  },

  // --- CONTROLADOR DE ASSENTO ---------------------------------------------
  {
    n: 7,
    nome: "a queda perde a graça (vira bot na hora)",
    de: `    if (motivo === MOTIVO_CONTROLE.QUEDA) {
      // §5: NÃO vira bot agora. Marca ausente, reserva o assento e conta o tempo.`,
    para: `    if (false) {
      // §5: NÃO vira bot agora. Marca ausente, reserva o assento e conta o tempo.`,
  },
  {
    n: 8,
    nome: "o AFK passa a esperar a graça (declaração vira incerteza)",
    de: `    return assumirPorBot(sala, assento, motivo || MOTIVO_CONTROLE.AFK);`,
    para: `    ctrl.estado = CONTROLE.HUMANO_AUSENTE;
    ctrl.motivo = motivo || MOTIVO_CONTROLE.AFK;
    ctrl.desde = agora();
    ctrl.retornoPendente = false;
    return { ok: true, ausente: true, expiraEm: ctrl.desde + gracaAusenciaMs };`,
  },
  {
    n: 9,
    nome: "outro UID retoma o assento alheio",
    de: `    if (dono !== jogadorId) return { erro: "assento de outro proprietário" };`,
    para: `    if (false) return { erro: "assento de outro proprietário" };`,
  },
  {
    n: 10,
    nome: "o gate de `proporAcaoDoAssento` some (humano e bot juntos)",
    de: `    if (!assentoEhDeBot(sala, assento)) {
      return { ok: false, erro: "assento não está sob controle de bot", log: [] };
    }`,
    para: `    if (false) {
      return { ok: false, erro: "assento não está sob controle de bot", log: [] };
    }`,
  },
  {
    n: 11,
    nome: "duas conexões controlam o MESMO assento",
    de: `  function desalojarOutrasConexoes(dono) {
    if (!dono || dono.codigo == null || !Number.isInteger(dono.assento)) return 0;`,
    para: `  function desalojarOutrasConexoes(dono) {
    if (dono) return 0;
    if (!dono || dono.codigo == null || !Number.isInteger(dono.assento)) return 0;`,
  },
  {
    n: 12,
    nome: "o fato competitivo perde `botAgiu`",
    de: `      const sub = substituicaoAberta(sala, assento);
      if (sub) sub.botAgiu = true;`,
    para: `      const sub = substituicaoAberta(sala, assento);
      if (sub && false) sub.botAgiu = true;`,
  },

  // --- CHAT: O SERVIDOR É TRANSPORTE --------------------------------------
  {
    n: 13,
    nome: "o espectador entra na entrega do chat",
    de: `      if (c.assento == null) continue;
      if (c.estadoAuth !== AUTH.AUTENTICADO) continue;`,
    para: `      if (c.estadoAuth !== AUTH.AUTENTICADO) continue;`,
  },
  {
    n: 14,
    nome: "o retry recalcula os destinatários pela sala",
    de: `    entregarChat(codigo, r.destinatarios, projecao);`,
    para: `    entregarChat(
      codigo,
      r.jaEnviada && ger.salas[codigo]
        ? composicaoDoCanal(ger.salas[codigo]).map((p) => p.uid)
        : r.destinatarios,
      projecao
    );`,
  },
  {
    n: 15,
    nome: "o autor da mensagem passa a vir do payload",
    de: `        autorUid: c.jogadorId,`,
    para: `        autorUid: msg.autorUid || c.jogadorId,`,
  },

  // --- CREDENCIAL DO MOTOR -------------------------------------------------
  {
    n: 16,
    nome: "a ponte segue em frente sem credencial",
    de: `    let idToken;
    try {
      idToken = await credencial.obterIdToken();
    } catch (e) {
      // O código da credencial é útil ao operador e não revela segredo.
      throw new ErroPonteDeChat(FALHA_PONTE.SEM_CREDENCIAL, e && e.codigo);
    }`,
    para: `    let idToken;
    try {
      idToken = await credencial.obterIdToken();
    } catch (e) {
      idToken = null;
    }`,
  },
];

function lerNormalizado(caminho) {
  const bruto = fs.readFileSync(caminho, "utf8");
  return { crlf: bruto.indexOf("\r\n") >= 0, texto: bruto.split("\r\n").join("\n"), bruto };
}

function rodarSuite() {
  try {
    return execFileSync(process.execPath, ["--test", "test/*.test.js"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600000,
    });
  } catch (e) {
    return String((e.stdout || "") + (e.stderr || ""));
  }
}

function falhasDe(saida) {
  const m = /^# fail (\d+)$/m.exec(saida) || /ℹ fail (\d+)/.exec(saida);
  return m ? Number(m[1]) : -1;
}

// --- verde de partida -------------------------------------------------------
const base = falhasDe(rodarSuite());
if (base !== 0) {
  console.error("A BASE JÁ ESTÁ VERMELHA (" + base + " falhas). Mutação não prova nada aqui.");
  process.exit(1);
}
console.log("base verde (0 falhas) · " + MUTACOES.length + " mutações\n");

const resultados = [];
for (const mut of MUTACOES) {
  const antes = lerNormalizado(ALVO);
  const partes = antes.texto.split(mut.de);
  if (partes.length !== 2) {
    console.error("MUT-" + mut.n + " ANCORA AMBIGUA/AUSENTE (" + (partes.length - 1) + " ocorrencias): " + mut.nome);
    process.exit(1);
  }
  const mutado = partes[0] + mut.para + partes[1];
  if (mutado === antes.texto) {
    console.error("MUT-" + mut.n + " NAO ALTEROU O ARQUIVO: " + mut.nome);
    process.exit(1);
  }
  const delta = mutado.length - antes.texto.length;
  fs.writeFileSync(ALVO, antes.crlf ? mutado.split("\n").join("\r\n") : mutado, "utf8");
  let falhas = -1;
  try {
    falhas = falhasDe(rodarSuite());
  } finally {
    fs.writeFileSync(ALVO, antes.bruto, "utf8"); // reverte SEMPRE
  }
  const pego = falhas > 0;
  resultados.push({ n: mut.n, nome: mut.nome, falhas, pego, delta });
  console.log(
    (pego ? "PEGA   " : "ESCAPOU") + " MUT-" + String(mut.n).padStart(2, "0") +
    "  falhas=" + String(falhas).padStart(3) +
    "  bytes=" + (delta >= 0 ? "+" : "") + delta +
    "  " + mut.nome
  );
}

// --- verde de chegada: a reversão precisa ter funcionado --------------------
const fim = falhasDe(rodarSuite());
console.log("\nverde de chegada: " + fim + " falhas");
const escaparam = resultados.filter((r) => !r.pego);
console.log("detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const r of escaparam) console.log("  ESCAPOU MUT-" + r.n + ": " + r.nome);
if (fim !== 0 || escaparam.length > 0) process.exit(1);
