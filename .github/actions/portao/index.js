// .github/actions/portao/index.js — O FIO ENTRE O JUIZ E O RUNNER
// (OS 54-C6, §2).
//
// O runner executa este arquivo com Node e usa o CÓDIGO DE SAÍDA DO PROCESSO
// como resultado do passo. Não há shell no caminho, então não há `||`, `|`,
// `&` nem comando posterior para absorver a reprovação: o que o juiz devolver
// é o que o job vê.
//
// TRÊS REGRAS, e as três são a mesma regra dita de três jeitos:
//
//   1. o código de saída do juiz é DEVOLVIDO, nunca traduzido;
//   2. tudo o que não for um código de saída legítimo do juiz vira 1 — entrada
//      faltando, juiz ausente, processo morto por sinal, exceção aqui dentro;
//   3. não existe caminho que devolva 0 sem o juiz ter devolvido 0.
//
// A saída do juiz vai para o log do passo por herança (`stdio: "inherit"`), e
// não é relida, resumida nem interpretada aqui — quem interpreta evidência é
// `ci/portao_do_ci.js`, e um segundo intérprete seria uma segunda verdade.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

/** A raiz do repositório dentro do runner. `GITHUB_WORKSPACE` é o checkout; o
 *  caminho relativo a este arquivo é a saída para quem executa a ação à mão. */
function raizDoRepositorio() {
  const doRunner = process.env.GITHUB_WORKSPACE;
  if (doRunner && fs.existsSync(path.join(doRunner, "ci", "portao_do_ci.js"))) return doRunner;
  return path.resolve(__dirname, "..", "..", "..");
}

function reclamar(mensagem) {
  process.stderr.write("[portão fail-closed] " + mensagem + "\n");
}

function principal() {
  const saida = process.env.INPUT_SAIDA;
  const marcador = process.env.INPUT_MARCADOR;

  if (!saida || !marcador) {
    reclamar(
      "as entradas `saida` e `marcador` são obrigatórias, e chegaram como " +
      JSON.stringify({ saida: saida || null, marcador: marcador || null }) +
      " — sem os dois caminhos não há evidência a julgar, e ausência é REPROVAÇÃO."
    );
    return 1;
  }

  const raiz = raizDoRepositorio();
  const juiz = path.join(raiz, "ci", "portao_do_ci.js");
  if (!fs.existsSync(juiz)) {
    reclamar("`ci/portao_do_ci.js` não existe em `" + raiz + "` — o veredito ficou sem juiz.");
    return 1;
  }

  const execucao = spawnSync(process.execPath, [juiz, saida, marcador, "--raiz", raiz], {
    cwd: raiz,
    stdio: "inherit",
  });

  if (execucao.error) {
    reclamar("o juiz não pôde ser executado: " + (execucao.error.message || execucao.error));
    return 1;
  }
  if (typeof execucao.status !== "number") {
    reclamar(
      "o juiz terminou sem código de saída (sinal `" + String(execucao.signal) + "`) — " +
      "morto no meio do julgamento é indistinguível de reprovado, logo REPROVADO."
    );
    return 1;
  }
  return execucao.status;
}

try {
  process.exitCode = principal();
} catch (erro) {
  reclamar("exceção no fio do portão: " + ((erro && erro.stack) || erro));
  process.exitCode = 1;
}
