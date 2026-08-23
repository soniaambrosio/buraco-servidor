// ===========================================================================
// PROVAS NEGATIVAS DA COSTURA (OS 44, §11) — julgadas pela SUÍTE INTEIRA.
//
// Esta campanha NÃO repete as quatro que já existem. `mutacoes_assento` (20)
// guarda a escolha de assento, `mutacoes_descoberta` (45) guarda a descoberta e
// a presença, `mutacoes_composicao` (16) e `mutacoes_os7` (12) guardam a
// comunicação e o controlador. Todas as quatro rodam sobre a árvore composta, e
// é assim que os itens 1–25 do §11 ficam provados: a autoridade continua lá
// porque a sabotagem dela continua vermelha.
//
// O que sobra — e só existe DEPOIS da composição — é o que está aqui:
//
//   * o fio que atravessa as duas entradas (fotografia → pedido de assento);
//   * a decisão semântica de que a descoberta NÃO conhece reserva;
//   * o §21, que é sobre não sanear valor de fio;
//   * e os §26/§28, que num repositório sem manifesto viram "a suíte de uma das
//     entradas some e o portão continua verde".
//
// DUAS ESPÉCIES DE MUTAÇÃO, porque duas espécies de defesa:
//   `troca`     — texto em `server.js` (as três travas anti-vácuo de sempre);
//   `renomear`  — move um ARQUIVO de suíte para fora do glob `test/*.test.js`.
//                 É a única forma honesta de sabotar um portão que é um glob.
//
// TRAVAS ANTI-VÁCUO, e as três param o processo:
//   1) a âncora tem de aparecer EXATAMENTE uma vez;
//   2) o arquivo tem de mudar de bytes depois da troca;
//   3) veredito ausente (`-1`, suíte que TRAVA) NÃO é sobrevivente — remede com
//      a suíte da costura e, se nem isso responder, aborta. Ver o laudo da OS 41:
//      o laço herdado contava timeout como escape e mentiu sobre duas mutações.
//
// Uso: node mutacoes_costura.js
// ===========================================================================
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ALVO = "server.js";

const MUTACOES = [
  // --- O FIO QUE ATRAVESSA AS DUAS ENTRADAS -------------------------------
  {
    n: 1,
    tipo: "troca",
    nome: "o despachante para de entregar `msg.assento` (a fotografia vira decorativa)",
    de: `uidAutenticado: c.uidAutenticado, assento: msg.assento });`,
    para: `uidAutenticado: c.uidAutenticado });`,
  },
  {
    n: 2,
    tipo: "troca",
    nome: "o perdedor da disputa ganha OUTRA cadeira em vez de recusa",
    de: `    } else if (!assentoLivre(sala, assento)) {
      // Sem segunda tentativa, e a ausencia dela E o contrato: quem pediu um
      // lugar recebe aquele lugar ou uma recusa, nunca um lugar diferente.
      return recusaDeAssento(RECUSA_ASSENTO_OCUPADO, ERRO_ASSENTO_OCUPADO);`,
    para: `    } else if (!assentoLivre(sala, assento)) {
      for (const s of ORDEM) { if (assentoLivre(sala, s)) { alvo = s; break; } }
      if (alvo === -1) return { erro: "mesa cheia" };
      return concluirAdmissao(admitirNoAssento({
        codigoDaSala: codigo, categoria: sala.categoriaCompetitiva,
        identidadeDaPartida: sala.partidaId, assento: alvo, jogadorId, uidAutenticado,
      }), function escreverFallback() {
        sala.assentos[alvo] = { apelido, tipo: "humano", jogadorId };
        return { assento: alvo, codigo };
      });`,
  },

  // --- A DECISÃO SEMÂNTICA DA UNIÃO ---------------------------------------
  {
    n: 3,
    tipo: "troca",
    nome: "a descoberta passa a publicar a RESERVA como ocupação",
    de: `function ocupacaoSanitizada(sala, contas) {
  const saida = [];
  for (let i = 0; i < CAPACIDADE; i++) {
    const a = sala.assentos[i];`,
    para: `function ocupacaoSanitizada(sala, contas) {
  const saida = [];
  for (let i = 0; i < CAPACIDADE; i++) {
    const reservas = Array.isArray(sala.reservas) ? sala.reservas : [];
    const a = sala.assentos[i] || (reservas[i] ? { tipo: "humano", apelido: "reservado" } : null);`,
  },

  // --- §21: NÃO SANEAR VALOR DE FIO ---------------------------------------
  {
    n: 4,
    tipo: "troca",
    nome: "a modalidade do fio é saneada às cegas para o rótulo de tela",
    // Ancorado COM a linha anterior: `modalidade: sala.modalidade,` aparece
    // duas vezes no bundle (a projecao publica e o envelope de encerramento),
    // e ancora de uma linha so cairia no modulo errado.
    de: `        nome: nomePublico(sala, assentos),
        modalidade: sala.modalidade,`,
    para: `        nome: nomePublico(sala, assentos),
        modalidade: sala.modalidade === "sbtl" ? "STBL" : sala.modalidade,`,
  },

  // --- §12: A FOTOGRAFIA NÃO PODE VIRAR PROMESSA --------------------------
  {
    n: 5,
    tipo: "troca",
    nome: "consultar a lista passa a RESERVAR os assentos livres",
    de: `      const r = registroDaMesa(sala, contas);
      if (!r) { descartadasPorInvariante++; continue; }`,
    para: `      const r = registroDaMesa(sala, contas);
      if (!r) { descartadasPorInvariante++; continue; }
      if (Array.isArray(sala.reservas)) {
        for (let i = 0; i < 4; i++) if (!sala.assentos[i]) sala.reservas[i] = "res_lista";
      }`,
  },
  {
    n: 6,
    tipo: "troca",
    nome: "a recusa de assento passa a mover a versão do estado",
    de: `      return recusaDeAssento(RECUSA_ASSENTO_INVALIDO, ERRO_ASSENTO_INVALIDO);`,
    para: `      sala.versaoEstado = (sala.versaoEstado || 0) + 1;
      return recusaDeAssento(RECUSA_ASSENTO_INVALIDO, ERRO_ASSENTO_INVALIDO);`,
  },

  // --- §7/§12: A PROJEÇÃO SEGURA ------------------------------------------
  {
    n: 7,
    tipo: "troca",
    nome: "o assento publicado passa a carregar o jogadorId",
    de: `      apelido: apelidoPublico(a.apelido),
      avatarGaleria: humano ? avatarDeGaleria(contas, a.jogadorId) : null,`,
    para: `      apelido: apelidoPublico(a.apelido),
      jogadorId: a.jogadorId || null,
      avatarGaleria: humano ? avatarDeGaleria(contas, a.jogadorId) : null,`,
  },
  {
    n: 8,
    tipo: "troca",
    nome: "o registro interno vaza os uids para o retrato publicado",
    de: `    return {
      criadaEm: Number.isFinite(sala.criadaEm) ? sala.criadaEm : 0,
      uids,
      mesa: {
        codigo: sala.codigo,`,
    para: `    return {
      criadaEm: Number.isFinite(sala.criadaEm) ? sala.criadaEm : 0,
      uids,
      mesa: {
        uids,
        codigo: sala.codigo,`,
  },

  // --- §26/§28: O PORTÃO QUE É UM GLOB ------------------------------------
  {
    n: 9,
    tipo: "renomear",
    nome: "a suíte da OS 41 sai do glob (some do portão em silêncio)",
    arquivo: "test/assento_autoritativo.test.js",
    destino: "test/assento_autoritativo.desligada.js",
  },
  {
    n: 10,
    tipo: "renomear",
    nome: "a suíte da OS 38.1 sai do glob (some do portão em silêncio)",
    arquivo: "test/descoberta.test.js",
    destino: "test/descoberta.desligada.js",
  },
  {
    n: 11,
    tipo: "renomear",
    nome: "a suíte da COSTURA sai do glob (a composição deixa de ser provada)",
    arquivo: "test/costura_assento_descoberta.test.js",
    destino: "test/costura_assento_descoberta.desligada.js",
  },

  // --- A RECIPROCIDADE DO CENSO -------------------------------------------
  //
  // A primeira versão da MUT-11 ESCAPOU, e o motivo vale registrar: a guarda
  // morava dentro da própria suíte de costura, então tirá-la do glob levava a
  // guarda junto. Guarda que não sobrevive à própria remoção não é guarda. As
  // duas abaixo existem para que a correção — o censo recíproco — não possa ser
  // desfeita em silêncio.
  {
    n: 12,
    tipo: "troca",
    arquivo: "test/assento_autoritativo.test.js",
    nome: "a suíte da OS 41 para de chamar o censo (reciprocidade unilateral)",
    de: `    conferirCenso();`,
    para: `    // conferirCenso();`,
  },
  {
    n: 13,
    tipo: "troca",
    arquivo: "test/descoberta.test.js",
    nome: "a suíte da OS 38.1 para de chamar o censo (reciprocidade unilateral)",
    de: `  conferirCenso();`,
    para: `  // conferirCenso();`,
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

function falhasDe(saida) {
  const m = /^# fail (\d+)$/m.exec(saida) || /ℹ fail (\d+)/.exec(saida);
  return m ? Number(m[1]) : -1;
}

/** Veredito com a terceira trava: timeout NÃO é sobrevivente. */
function julgar(mut) {
  const cheia = falhasDe(rodarSuite());
  if (cheia >= 0) return { falhas: cheia, origem: "suíte completa" };
  const propria = falhasDe(rodarSuite("test/costura_assento_descoberta.test.js"));
  if (propria < 0) {
    console.error("MUT-" + mut.n + " NAO PRODUZIU VEREDITO EM NENHUMA BATERIA: " + mut.nome);
    process.exit(1);
  }
  return { falhas: propria, origem: "suíte da costura (a completa TRAVA)" };
}

/** Injeta e devolve o desfazedor. Cada espécie tem as suas travas. */
function injetar(mut) {
  if (mut.tipo === "renomear") {
    if (!fs.existsSync(mut.arquivo)) {
      console.error("MUT-" + mut.n + " ARQUIVO AUSENTE: " + mut.arquivo);
      process.exit(1);
    }
    if (fs.existsSync(mut.destino)) {
      console.error("MUT-" + mut.n + " DESTINO JA EXISTE: " + mut.destino);
      process.exit(1);
    }
    fs.renameSync(mut.arquivo, mut.destino);
    // Trava anti-vácuo da espécie: o glob tem de ter perdido o arquivo.
    if (fs.existsSync(mut.arquivo)) {
      console.error("MUT-" + mut.n + " O ARQUIVO CONTINUA NO GLOB");
      process.exit(1);
    }
    return { delta: 0, desfazer: () => fs.renameSync(mut.destino, mut.arquivo) };
  }

  // `mut.arquivo` permite sabotar um arquivo de TESTE, e não só o bundle. É
  // como se prova uma guarda recíproca: retirar a chamada do censo de uma das
  // suítes tem de deixar a outra vermelha.
  const alvo = mut.arquivo || ALVO;
  const antes = lerNormalizado(alvo);
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
  fs.writeFileSync(alvo, antes.crlf ? mutado.split("\n").join("\r\n") : mutado, "utf8");
  return {
    delta: mutado.length - antes.texto.length,
    desfazer: () => fs.writeFileSync(alvo, antes.bruto, "utf8"),
  };
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
  const inj = injetar(mut);
  let v = { falhas: -1, origem: "?" };
  try {
    v = julgar(mut);
  } finally {
    inj.desfazer(); // reverte SEMPRE
  }
  const pego = v.falhas > 0;
  resultados.push({ n: mut.n, nome: mut.nome, falhas: v.falhas, pego, origem: v.origem });
  console.log(
    (pego ? "PEGA   " : "ESCAPOU") + " MUT-" + String(mut.n).padStart(2, "0") +
    "  falhas=" + String(v.falhas).padStart(3) +
    "  bytes=" + (inj.delta >= 0 ? "+" : "") + inj.delta +
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
