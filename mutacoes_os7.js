// ===========================================================================
// PROVAS NEGATIVAS DA OS 7 (§16) — 12 mutações não-vácuas.
//
// Para cada mutação: aplica no arquivo, CONFERE que o arquivo mudou de fato
// (bytes diferentes), roda a suíte, exige que ela fique VERMELHA, e reverte.
// A conferência de bytes existe porque uma mutação que não pega mente sobre
// cobertura: âncora que não casou vira "mutante não detectado" sem nunca ter
// sido injetada.
//
// Uso: node mutacoes_os7.js
// ===========================================================================
const fs = require("fs");
const { execFileSync } = require("child_process");

const ALVOS = { server: "server.js" };

const MUTACOES = [
  {
    n: 1,
    nome: "socket fechado destrói a POSSE do assento",
    arquivo: "server",
    de: `      ger.ausentar({ codigo: cod, assento, motivo: MOTIVO_CONTROLE.QUEDA });`,
    para: `      ger.ausentar({ codigo: cod, assento, motivo: MOTIVO_CONTROLE.QUEDA });
      if (ger.salas[cod] && ger.salas[cod].assentos[assento]) ger.salas[cod].assentos[assento].jogadorId = null;`,
  },
  {
    n: 2,
    nome: "reconexão de UID diferente é aceita",
    arquivo: "server",
    de: `    if (dono !== jogadorId) return { erro: "assento de outro proprietário" };`,
    para: `    if (false) return { erro: "assento de outro proprietário" };`,
  },
  {
    n: 3,
    nome: "o bot assume 1 ms ANTES de T",
    arquivo: "server",
    de: `      if (t - c.desde < gracaAusenciaMs) continue;`,
    para: `      if (t - c.desde < gracaAusenciaMs - 1) continue;`,
  },
  {
    n: 4,
    nome: "dois bots assumem o MESMO assento",
    arquivo: "server",
    de: `    if (CONTROLES_DE_BOT.has(ctrl.estado)) return { ok: true, jaEraBot: true };
    ctrl.estado = CONTROLE.BOT_SUBSTITUTO;`,
    para: `    ctrl.estado = CONTROLE.BOT_SUBSTITUTO;`,
  },
  {
    n: 5,
    nome: "humano e bot com autoridade simultânea",
    arquivo: "server",
    de: `    if (!assentoEhDeBot(sala, assento)) {
      return { ok: false, erro: "assento não está sob controle de bot", log: [] };
    }`,
    para: `    if (false) {
      return { ok: false, erro: "assento não está sob controle de bot", log: [] };
    }`,
  },
  {
    n: 6,
    nome: "o retorno interrompe ação atômica (turno pela metade)",
    arquivo: "server",
    de: `    if (j && j.vez === assento && j.jaComprou === true) {`,
    para: `    if (false) {`,
  },
  {
    n: 7,
    nome: "a queda reinicia a fase do turno",
    arquivo: "server",
    de: `      ctrl.estado = CONTROLE.HUMANO_AUSENTE;
      ctrl.motivo = motivo;`,
    para: `      ctrl.estado = CONTROLE.HUMANO_AUSENTE;
      if (sala.jogo) sala.jogo.jaComprou = false;
      ctrl.motivo = motivo;`,
  },
  {
    n: 8,
    nome: "o bot COMPRA de novo num turno já iniciado",
    arquivo: "server",
    de: `  if (jogo.jaComprou) {
    log.push("assumiu o turno já iniciado (compra preservada)");`,
    para: `  if (false) {
    log.push("assumiu o turno já iniciado (compra preservada)");`,
  },
  {
    n: 9,
    nome: "o turno assumido DESCARTA duas vezes",
    arquivo: "server",
    de: `    const r = jogarTurnoBot(jogo, assento); // <-- decisor (OS 10 troca ESTA linha)`,
    para: `    const r = jogarTurnoBot(jogo, assento); // <-- decisor (OS 10 troca ESTA linha)
    if (r.ok && !jogo.rodadaEncerrada && !jogo.encerrada) { jogo.vez = assento; jogo.jaComprou = true; jogarTurnoBot(jogo, assento); }`,
  },
  {
    n: 10,
    nome: "saída voluntária permite retorno",
    arquivo: "server",
    de: `    if (ctrl.terminal) return { erro: "você saiu desta partida" };`,
    para: `    if (false) return { erro: "você saiu desta partida" };`,
  },
  {
    n: 11,
    nome: "o bot entra no canal de chat",
    arquivo: "server",
    de: `    if (!a || a.tipo !== "humano") continue;
    if (typeof a.jogadorId !== "string" || !a.jogadorId) continue;
    fora.push({ uid: a.jogadorId, papel: CHAT_PAPEL.SENTADO });`,
    para: `    if (!a) continue;
    fora.push({ uid: a.jogadorId || ("bot-" + a.apelido), papel: CHAT_PAPEL.SENTADO });`,
  },
  {
    n: 12,
    nome: "o takeover não registra o fato competitivo",
    arquivo: "server",
    de: `    registrarSubstituicao(sala, assento, motivo);
    avancarBots(sala);`,
    para: `    avancarBots(sala);`,
  },
];

function lerNormalizado(caminho) {
  const bruto = fs.readFileSync(caminho, "utf8");
  return { crlf: bruto.indexOf("\r\n") >= 0, texto: bruto.split("\r\n").join("\n"), bruto };
}

function rodarSuite() {
  try {
    const saida = execFileSync(
      process.execPath,
      ["--test", "test/controlador_assento.test.js", "test/regressao.test.js",
       "test/espectador.test.js", "test/costura.test.js"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300000 }
    );
    return saida;
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
console.log("base verde (0 falhas)\n");

const resultados = [];
for (const mut of MUTACOES) {
  const caminho = ALVOS[mut.arquivo];
  const antes = lerNormalizado(caminho);
  const partes = antes.texto.split(mut.de);
  if (partes.length !== 2) {
    console.error("MUT-" + mut.n + " ANCORA AMBIGUA/AUSENTE (" + (partes.length - 1) + " ocorrencias): " + mut.nome);
    process.exit(1);
  }
  let mutado = partes[0] + mut.para + partes[1];
  // Conferência anti-vácuo: o arquivo TEM de ter mudado.
  if (mutado === antes.texto) {
    console.error("MUT-" + mut.n + " NAO ALTEROU O ARQUIVO: " + mut.nome);
    process.exit(1);
  }
  const delta = mutado.length - antes.texto.length;
  fs.writeFileSync(caminho, antes.crlf ? mutado.split("\n").join("\r\n") : mutado, "utf8");
  let falhas = -1;
  try {
    falhas = falhasDe(rodarSuite());
  } finally {
    fs.writeFileSync(caminho, antes.bruto, "utf8"); // reverte SEMPRE
  }
  const pego = falhas > 0;
  resultados.push({ n: mut.n, nome: mut.nome, falhas, pego, delta });
  console.log(
    (pego ? "PEGA  " : "ESCAPOU") + "  MUT-" + String(mut.n).padStart(2, "0") +
    "  falhas=" + String(falhas).padStart(2) +
    "  bytes=" + (delta >= 0 ? "+" : "") + delta +
    "  " + mut.nome
  );
}

// --- verde de chegada: a reversão precisa ter funcionado --------------------
const fim = falhasDe(rodarSuite());
console.log("\nverde de chegada: " + fim + " falhas");
const escaparam = resultados.filter((r) => !r.pego);
console.log("detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
if (fim !== 0 || escaparam.length > 0) process.exit(1);
