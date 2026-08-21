// ===========================================================================
// CAMPANHA DE SOBREVIVENCIA — S1..S10 da OS 23.1-P-C1.
//
// As duas campanhas que ja existem (`mutacoes_os7.js`, `mutacoes_composicao.js`)
// sabotam `server.js` e perguntam "a suite pega?". Esta pergunta outra coisa:
//
//     "e se a SUITE for embora?"
//
// Por isso ela sabota os arquivos de PROVA e o comando oficial, e nunca o
// produto. `server.js` e conferido byte a byte no inicio e no fim: se esta
// campanha o tocasse, ela deixaria de medir o que diz medir.
//
// CADA SABOTAGEM DECLARA O CODIGO DE RECUSA QUE ESPERA. "Ficou vermelho" nao
// basta: uma sabotagem que derrubasse o comando por um motivo qualquer
// (arquivo corrompido, erro de sintaxe) pareceria detectada sem que a defesa
// correspondente existisse. Exigir o codigo separa "pegou" de "quebrou".
//
// ISOLAMENTO DAS DEFESAS. Remover um bloco normativo tambem muda o digest, o
// que faria S4/S5/S10 medirem o digest em vez do que dizem medir. Por isso
// essas tres ATUALIZAM o digest junto da sabotagem: sobra so a defesa que esta
// sendo testada.
//
// Uso: node mutacoes_sobrevivencia.js
// ===========================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const RAIZ = __dirname;
const SUITE = path.join(RAIZ, "test", "produtor_v2.test.js");
const SOBREV = path.join(RAIZ, "test", "gate_sobrevivencia.test.js");
const CONTRATO = path.join(RAIZ, "ferramentas", "contrato-de-provas.json");
const PKG = path.join(RAIZ, "package.json");
const SERVER = path.join(RAIZ, "server.js");

const lf = (p) => fs.readFileSync(p, "utf8").split("\r\n").join("\n");
const sha = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");

/** Escreve preservando o EOL que o arquivo ja tinha. */
function escrever(p, textoLf) {
  const crlf = fs.readFileSync(p, "utf8").includes("\r\n");
  fs.writeFileSync(p, crlf ? textoLf.split("\n").join("\r\n") : textoLf, "utf8");
}

function lerContrato() { return JSON.parse(fs.readFileSync(CONTRATO, "utf8")); }
function gravarContrato(c) { fs.writeFileSync(CONTRATO, JSON.stringify(c, null, 2) + "\n", "utf8"); }
function suiteDoContrato(c, caminho) { return c.suitesObrigatorias.find((s) => s.caminho === caminho); }

/** Roda o comando OFICIAL e devolve { vermelho, saida }. */
function rodarComandoOficial() {
  try {
    // `execSync` com a linha inteira, e nao `execFileSync` com `shell: true`:
    // o segundo concatena argumentos sem escapar, e o Node avisa (DEP0190).
    const saida = execSync("npm test", {
      cwd: RAIZ, encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"], timeout: 600000,
    });
    const m = /^# fail (\d+)$/m.exec(saida) || /ℹ fail (\d+)/.exec(saida);
    const falhas = m ? Number(m[1]) : 0;
    return { vermelho: falhas > 0, saida };
  } catch (e) {
    return { vermelho: true, saida: String((e.stdout || "") + (e.stderr || "")) };
  }
}

// ---------------------------------------------------------------------------
// As sabotagens. `aplicar` devolve uma funcao de restauracao.
// ---------------------------------------------------------------------------
function guardarArquivos(lista) {
  const antes = lista.map((p) => ({ p, conteudo: fs.readFileSync(p) }));
  return () => { for (const a of antes) fs.writeFileSync(a.p, a.conteudo); };
}

const SABOTAGENS = [
  {
    id: "S1", nome: "apagar test/produtor_v2.test.js", espera: "SUITE_AUSENTE",
    aplicar() {
      const restaurar = guardarArquivos([SUITE]);
      fs.unlinkSync(SUITE);
      return () => { restaurar(); };
    },
  },
  {
    id: "S2", nome: "renomear a suite (o glob acha, o contrato nao)", espera: "SUITE_AUSENTE",
    aplicar() {
      const novo = path.join(RAIZ, "test", "produtor_v2_renomeada.test.js");
      fs.renameSync(SUITE, novo);
      return () => { fs.renameSync(novo, SUITE); };
    },
  },
  {
    id: "S3", nome: "substituir por um unico teste irrelevante", espera: "DIGEST_DIVERGENTE",
    aplicar() {
      const restaurar = guardarArquivos([SUITE]);
      escrever(SUITE, 'const test = require("node:test");\ntest("irrelevante", () => {});\n');
      return restaurar;
    },
  },
  {
    id: "S4", nome: "remover o bloco V2/D3 (digest atualizado junto)", espera: "BLOCO_NORMATIVO_AUSENTE",
    aplicar() {
      const restaurar = guardarArquivos([SUITE, CONTRATO]);
      const t = lf(SUITE);
      const i = t.indexOf('describe("V2/D3');
      const j = t.indexOf("\ndescribe(", i + 1);
      const semBloco = t.slice(0, i) + t.slice(j + 1);
      escrever(SUITE, semBloco);
      const c = lerContrato();
      suiteDoContrato(c, "test/produtor_v2.test.js").digestSha256 = sha(semBloco);
      suiteDoContrato(c, "test/produtor_v2.test.js").pisoDeCasos = 1; // isola a defesa de bloco
      gravarContrato(c);
      return restaurar;
    },
  },
  {
    id: "S5", nome: "remover o bloco V2/QUARENTENA (digest atualizado junto)", espera: "BLOCO_NORMATIVO_AUSENTE",
    aplicar() {
      const restaurar = guardarArquivos([SUITE, CONTRATO]);
      const t = lf(SUITE);
      const i = t.indexOf('describe("V2/QUARENTENA');
      const j = t.indexOf("\ndescribe(", i + 1);
      const semBloco = j < 0 ? t.slice(0, i) : t.slice(0, i) + t.slice(j + 1);
      escrever(SUITE, semBloco);
      const c = lerContrato();
      suiteDoContrato(c, "test/produtor_v2.test.js").digestSha256 = sha(semBloco);
      suiteDoContrato(c, "test/produtor_v2.test.js").pisoDeCasos = 1;
      gravarContrato(c);
      return restaurar;
    },
  },
  {
    id: "S6", nome: "alterar o digest SEM alterar a suite", espera: "DIGEST_DIVERGENTE",
    aplicar() {
      const restaurar = guardarArquivos([CONTRATO]);
      const c = lerContrato();
      suiteDoContrato(c, "test/produtor_v2.test.js").digestSha256 = "0".repeat(64);
      gravarContrato(c);
      return restaurar;
    },
  },
  {
    id: "S7", nome: "alterar a suite SEM atualizar a assinatura", espera: "DIGEST_DIVERGENTE",
    aplicar() {
      const restaurar = guardarArquivos([SUITE]);
      escrever(SUITE, lf(SUITE) + "\n// alteracao nao declarada no contrato\n");
      return restaurar;
    },
  },
  {
    id: "S8", nome: "tirar a guarda do npm test", espera: "GS-02",
    aplicar() {
      const restaurar = guardarArquivos([PKG]);
      const pkg = JSON.parse(fs.readFileSync(PKG, "utf8"));
      pkg.scripts.test = 'node --test "test/*.test.js"';
      fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      return restaurar;
    },
  },
  {
    id: "S9", nome: "estreitar o glob: a suite existe e nao roda", espera: "FORA_DO_COMANDO",
    aplicar() {
      const restaurar = guardarArquivos([PKG]);
      const pkg = JSON.parse(fs.readFileSync(PKG, "utf8"));
      pkg.scripts.test = 'node ferramentas/gate-de-provas.js && node --test "test/produtor.test.js"';
      fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      return restaurar;
    },
  },
  {
    id: "S10", nome: "reduzir a suite abaixo do piso (digest atualizado junto)", espera: "ABAIXO_DO_PISO",
    aplicar() {
      const restaurar = guardarArquivos([SUITE, CONTRATO]);
      const t = lf(SUITE);
      // Mantem TODOS os blocos normativos e corta so casos: isola o piso.
      let cortado = t;
      let removidos = 0;
      while (removidos < 6) {
        const i = cortado.lastIndexOf("\n  test(");
        if (i < 0) break;
        const j = cortado.indexOf("\n  });", i);
        if (j < 0) break;
        cortado = cortado.slice(0, i) + cortado.slice(j + "\n  });".length);
        removidos++;
      }
      escrever(SUITE, cortado);
      const c = lerContrato();
      suiteDoContrato(c, "test/produtor_v2.test.js").digestSha256 = sha(cortado);
      gravarContrato(c);
      return restaurar;
    },
  },
];

// ---------------------------------------------------------------------------
const shaServidorAntes = sha(lf(SERVER));

console.log("controle: arvore intacta deve ficar VERDE\n");
const controle = rodarComandoOficial();
if (controle.vermelho) {
  console.error("A BASE JA ESTA VERMELHA. Sabotagem nao prova nada aqui.");
  console.error(controle.saida.slice(-2000));
  process.exit(1);
}
console.log("controle VERDE\n" + "-".repeat(72));

const resultados = [];
for (const s of SABOTAGENS) {
  let restaurar = () => {};
  let r = { vermelho: false, saida: "" };
  try {
    restaurar = s.aplicar();
    r = rodarComandoOficial();
  } finally {
    restaurar();
  }
  const temCodigo = r.saida.includes(s.espera);
  const ok = r.vermelho && temCodigo;
  resultados.push({ id: s.id, nome: s.nome, vermelho: r.vermelho, temCodigo, ok });
  console.log(
    (ok ? "PEGA   " : "ESCAPOU") + " " + s.id.padEnd(4) +
    " vermelho=" + (r.vermelho ? "sim" : "NAO ") +
    " codigo[" + s.espera + "]=" + (temCodigo ? "sim" : "NAO ") +
    "  " + s.nome
  );
}

console.log("-".repeat(72));
const fim = rodarComandoOficial();
console.log("verde de chegada: " + (fim.vermelho ? "VERMELHO (restauracao falhou!)" : "VERDE"));

const shaServidorDepois = sha(lf(SERVER));
const servidorIntacto = shaServidorAntes === shaServidorDepois;
console.log("server.js byte-identical: " + (servidorIntacto ? "SIM" : "NAO"));

const escaparam = resultados.filter((x) => !x.ok);
console.log("detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const e of escaparam) console.log("  ESCAPOU " + e.id + ": " + e.nome);

if (fim.vermelho || !servidorIntacto || escaparam.length > 0) process.exit(1);
