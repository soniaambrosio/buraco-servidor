// ===========================================================================
// PROVAS NEGATIVAS DA ESCOLHA AUTORITATIVA DE ASSENTO — 20 mutações não-vácuas,
// julgadas pela SUÍTE INTEIRA.
//
// Cada mutação aqui desfaz um invariante da OS 41. A primeira é a que dá nome à
// campanha: ela RESTAURA O FALLBACK SILENCIOSO — o comportamento anterior, em
// que um pedido inatendível caía na escolha automática e a pessoa sentava em
// outra cadeira sem que nada dissesse isso. Se essa mutação ficar verde, a
// entrega não existe: o defeito foi reescrito, não fechado.
//
// A bateria que julga é a suíte completa, e não só `assento_autoritativo`. Uma
// mutação que morre na suíte do gate VIP ou na do controlador conta igual — o
// ponto é que ela MORRA, e onde ela morre é informação sobre quem a guarda.
//
// DUAS TRAVAS ANTI-VÁCUO, e as duas param o processo:
//   1) a âncora tem de aparecer EXATAMENTE uma vez (`server.js` é um bundle de
//      fábricas e identificadores se repetem entre módulos);
//   2) o arquivo tem de mudar de bytes depois da troca.
// Sem elas, uma âncora que não casou vira "mutante não detectado" sem nunca ter
// sido injetada — e a campanha mente sobre cobertura.
//
// Uso: node mutacoes_assento.js
// ===========================================================================
const fs = require("fs");
const { execFileSync } = require("child_process");

const ALVO = "server.js";

const MUTACOES = [
  // --- O DEFEITO QUE A OS FECHA -------------------------------------------
  {
    n: 1,
    nome: "RESTAURA O FALLBACK SILENCIOSO (pedido inatendível vira outra cadeira)",
    de: `    } else if (assento === undefined) {
      for (const s of ORDEM) { if (assentoLivre(sala, s)) { alvo = s; break; } }
      if (alvo === -1) return { erro: "mesa cheia" };
    } else if (!ehAssentoPedido(assento)) {
      return recusaDeAssento(RECUSA_ASSENTO_INVALIDO, ERRO_ASSENTO_INVALIDO);
    } else if (!assentoLivre(sala, assento)) {
      // Sem segunda tentativa, e a ausencia dela E o contrato: quem pediu um
      // lugar recebe aquele lugar ou uma recusa, nunca um lugar diferente.
      return recusaDeAssento(RECUSA_ASSENTO_OCUPADO, ERRO_ASSENTO_OCUPADO);
    } else {
      alvo = assento;
    }`,
    para: `    } else if (ehAssentoPedido(assento) && assentoLivre(sala, assento)) {
      alvo = assento;
    } else {
      for (const s of ORDEM) { if (assentoLivre(sala, s)) { alvo = s; break; } }
      if (alvo === -1) return { erro: "mesa cheia" };
    }`,
  },
  {
    n: 2,
    nome: "fallback SÓ para assento ocupado",
    de: `    } else if (!assentoLivre(sala, assento)) {
      // Sem segunda tentativa, e a ausencia dela E o contrato: quem pediu um
      // lugar recebe aquele lugar ou uma recusa, nunca um lugar diferente.
      return recusaDeAssento(RECUSA_ASSENTO_OCUPADO, ERRO_ASSENTO_OCUPADO);
    } else {
      alvo = assento;
    }`,
    para: `    } else if (!assentoLivre(sala, assento)) {
      for (const s of ORDEM) { if (assentoLivre(sala, s)) { alvo = s; break; } }
      if (alvo === -1) return { erro: "mesa cheia" };
    } else {
      alvo = assento;
    }`,
  },
  {
    n: 3,
    nome: "fallback SÓ para assento inválido",
    de: `    } else if (!ehAssentoPedido(assento)) {
      return recusaDeAssento(RECUSA_ASSENTO_INVALIDO, ERRO_ASSENTO_INVALIDO);`,
    para: `    } else if (!ehAssentoPedido(assento)) {
      for (const s of ORDEM) { if (assentoLivre(sala, s)) { alvo = s; break; } }
      if (alvo === -1) return { erro: "mesa cheia" };`,
  },
  {
    n: 4,
    nome: "`null` volta a ser tratado como ausência de pedido",
    de: `    } else if (assento === undefined) {`,
    para: `    } else if (assento === undefined || assento === null) {`,
  },

  // --- O QUE É UM PEDIDO VÁLIDO -------------------------------------------
  {
    n: 5,
    nome: "`ehAssentoPedido` passa a COAGIR string para número",
    de: `  return Number.isInteger(v) && v >= 0 && v < 4;`,
    para: `  return Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 4;`,
  },
  {
    n: 6,
    nome: "a faixa do assento vaza para o 4",
    de: `function ehAssentoPedido(v) {
  return Number.isInteger(v) && v >= 0 && v < 4;`,
    para: `function ehAssentoPedido(v) {
  return Number.isInteger(v) && v >= 0 && v <= 4;`,
  },
  {
    n: 7,
    nome: "a ORDEM automática deixa de ser parceiro-primeiro",
    de: `    const ORDEM = [2, 1, 3];`,
    para: `    const ORDEM = [1, 2, 3];`,
  },
  {
    n: 8,
    nome: "os dois códigos de recusa trocam de lugar",
    de: `      return recusaDeAssento(RECUSA_ASSENTO_INVALIDO, ERRO_ASSENTO_INVALIDO);`,
    para: `      return recusaDeAssento(RECUSA_ASSENTO_OCUPADO, ERRO_ASSENTO_OCUPADO);`,
  },

  // --- A TRAVA ATÔMICA ----------------------------------------------------
  {
    n: 9,
    nome: "`assentoLivre` volta a ignorar a reserva em voo",
    de: `  return sala.assentos[i] === null && reservaDe(sala, i) === null;`,
    para: `  return sala.assentos[i] === null;`,
  },
  {
    n: 10,
    nome: "a reserva deixa de ser tomada",
    de: `    if (!reentrada) reservarAssento(sala, alvo, marca);`,
    para: `    if (false) reservarAssento(sala, alvo, marca);`,
  },
  {
    n: 11,
    nome: "a reserva é tomada DEPOIS do gate (a janela reabre)",
    de: `    const marca = reentrada ? null : novaMarcaDeReserva();
    if (!reentrada) reservarAssento(sala, alvo, marca);`,
    para: `    const marca = reentrada ? null : novaMarcaDeReserva();`,
  },
  {
    n: 12,
    nome: "`liberarReserva` solta a reserva de QUALQUER tentativa",
    de: `  if (Array.isArray(sala.reservas) && sala.reservas[i] === marca) sala.reservas[i] = null;`,
    para: `  if (Array.isArray(sala.reservas)) sala.reservas[i] = null;`,
  },
  {
    n: 13,
    nome: "a reserva nunca é solta (assento fica preso para sempre)",
    de: `  if (marca == null) return;`,
    para: `  return;`,
  },
  {
    n: 14,
    nome: "a conferência final some (o atrasado escreve por cima)",
    de: `      if (sala.iniciada || sala.assentos[alvo] !== null || reservaDe(sala, alvo) !== marca) {
        return recusaDeAssento(RECUSA_ASSENTO_OCUPADO, ERRO_ASSENTO_OCUPADO);
      }`,
    para: `      if (false) {
        return recusaDeAssento(RECUSA_ASSENTO_OCUPADO, ERRO_ASSENTO_OCUPADO);
      }`,
  },
  {
    n: 15,
    nome: "a conferência final deixa de olhar a partida iniciada",
    de: `      if (sala.iniciada || sala.assentos[alvo] !== null || reservaDe(sala, alvo) !== marca) {`,
    para: `      if (sala.assentos[alvo] !== null || reservaDe(sala, alvo) !== marca) {`,
  },

  // --- POSSE E RECONEXÃO --------------------------------------------------
  {
    n: 16,
    nome: "a reentrada passa a honrar o assento pedido (troca de cadeira)",
    de: `    if (reentrada) {
      alvo = jaSentado;`,
    para: `    if (reentrada) {
      alvo = ehAssentoPedido(assento) && assentoLivre(sala, assento) ? assento : jaSentado;`,
  },
  {
    n: 17,
    nome: "a reentrada volta a OCUPAR (o mesmo uid em dois assentos)",
    de: `      if (reentrada) return { codigo, assento: alvo, reconexao: true };`,
    para: `      if (false) return { codigo, assento: alvo, reconexao: true };`,
  },
  {
    n: 18,
    nome: "a reentrada pula o gate (a volta deixa de ser classificada)",
    de: `    const jaSentado = assentoDoTitular(sala, jogadorId);
    const reentrada = jaSentado !== -1;`,
    para: `    const jaSentado = assentoDoTitular(sala, jogadorId);
    if (jaSentado !== -1) return { codigo, assento: jaSentado, reconexao: true };
    const reentrada = false;`,
  },
  {
    n: 19,
    nome: "a reconexão em partida iniciada passa a olhar o assento pedido",
    de: `      const rec = reconectar({ codigo, jogadorId });
      if (rec && rec.assento != null) return rec;`,
    para: `      const rec = reconectar({ codigo, jogadorId });
      if (rec && rec.assento != null) return Object.assign({}, rec, ehAssentoPedido(assento) ? { assento } : null);`,
  },

  // --- FRONTEIRA E VERSIONAMENTO ------------------------------------------
  {
    n: 20,
    nome: "`reservas` volta para dentro da impressão do estado",
    de: `  "reservas",                                     // [ASSENTO] trava em voo`,
    para: ``,
  },
];

function lerNormalizado(caminho) {
  const bruto = fs.readFileSync(caminho, "utf8");
  return { crlf: bruto.indexOf("\r\n") >= 0, texto: bruto.split("\r\n").join("\n"), bruto };
}

function rodarSuite(arquivos) {
  try {
    return execFileSync(process.execPath, ["--test", arquivos || "test/*.test.js"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300000,
    });
  } catch (e) {
    return String((e.stdout || "") + (e.stderr || ""));
  }
}

// A TERCEIRA TRAVA, e ela nasceu de um erro medido.
//
// `falhasDe` devolve -1 quando a saída não traz sumário — o que acontece quando
// a suíte TRAVA e o processo é morto pelo timeout. O laço original comparava
// `falhas > 0`, então -1 caía no ramo do sobrevivente: uma mutação catastrófica
// demais para a suíte terminar era relatada como NÃO DETECTADA. Foi exatamente o
// que aconteceu com MUT-10 e MUT-11, que quebram 12 casos cada.
//
// Silenciar isso nos dois sentidos seria mentir: contar timeout como detecção
// esconde arnês quebrado, e contá-lo como escape esconde mutação letal. Então a
// campanha REMEDE, sozinha, com a suíte desta OS — que não abre porta de rede e
// não trava —, e o veredito sai anotado com a origem.
function julgar(mut) {
  const cheia = falhasDe(rodarSuite());
  if (cheia >= 0) return { falhas: cheia, origem: "suíte completa" };
  const propria = falhasDe(rodarSuite("test/assento_autoritativo.test.js"));
  if (propria < 0) {
    console.error("MUT-" + mut.n + " NAO PRODUZIU VEREDITO EM NENHUMA BATERIA: " + mut.nome);
    process.exit(1);
  }
  return { falhas: propria, origem: "suíte da OS (a completa TRAVA)" };
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
  let v = { falhas: -1, origem: "?" };
  try {
    v = julgar(mut);
  } finally {
    fs.writeFileSync(ALVO, antes.bruto, "utf8"); // reverte SEMPRE
  }
  const falhas = v.falhas;
  const pego = falhas > 0;
  resultados.push({ n: mut.n, nome: mut.nome, falhas, pego, delta, origem: v.origem });
  console.log(
    (pego ? "PEGA   " : "ESCAPOU") + " MUT-" + String(mut.n).padStart(2, "0") +
    "  falhas=" + String(falhas).padStart(3) +
    "  bytes=" + (delta >= 0 ? "+" : "") + delta +
    "  " + mut.nome +
    (v.origem === "suíte completa" ? "" : "  [" + v.origem + "]")
  );
}

// --- verde de chegada: a reversão precisa ter funcionado --------------------
const fim = falhasDe(rodarSuite());
console.log("\nverde de chegada: " + fim + " falhas");
const escaparam = resultados.filter((r) => !r.pego);
console.log("detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const r of escaparam) console.log("  ESCAPOU MUT-" + r.n + ": " + r.nome);
if (fim !== 0 || escaparam.length > 0) process.exit(1);
