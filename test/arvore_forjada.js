// test/arvore_forjada.js — CÓPIAS DESCARTÁVEIS PARA EXERCITAR OS VERIFICADORES.
//
// Prova textual não distingue uma regra viva de um corpo esvaziado. Por isso as
// guardas de auditabilidade não LEEM o workflow: elas montam uma árvore de
// mentira, sabotam um ponto, e exigem que o verificador de verdade reprove — e,
// no controle, que a árvore íntegra passe.
//
// Este módulo mora fora do glob `test/*.test.js` de propósito: é ferramenta de
// bancada, não suíte.

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RAIZ_REAL = path.join(__dirname, "..");

/** Os arquivos mínimos que um verificador precisa encontrar numa árvore.
 *
 *  [OS 54-C4] A AUTORIDADE DO ARTEFATO entrou na lista. Ela não é lida pelo
 *  guardião do rastro — quem a lê é o juiz e o `pretest` —, mas uma árvore
 *  forjada sem ela deixa de parecer com a real justamente na metade que esta
 *  composição existe para preservar, e a próxima sabotagem escrita aqui teria
 *  de descobrir isso do jeito caro. */
const ESSENCIAIS = Object.freeze([
  ".github/workflows/provas-do-servidor.yml",
  "ci/portao_do_ci.js",
  "ci/auditabilidade.js",
  // [OS 54-C5] A autoridade que separa texto de execução. Ela é carregada por
  // `ci/auditabilidade.js` com caminho RELATIVO, então uma árvore forjada sem
  // ela não reprova pela sabotagem — quebra no `require`, e vermelho pelo
  // motivo errado esconde o que estava sendo medido.
  "ci/invocacao_executavel.js",
  // [OS 54-C6] A autoridade do código de saída e a AÇÃO LOCAL que ela guarda.
  // Sem as três, uma árvore forjada quebra no `require` ou reprova por "ação
  // ausente" — vermelho pelo motivo errado esconde o que estava sendo medido.
  "ci/codigo_de_saida.js",
  ".github/actions/portao/action.yml",
  ".github/actions/portao/index.js",
  "ci/pisos_autorizados.js",
  "ci/piso_do_portao.json",
  "ci/artefato.js",
  "ci/artefato_produtivo.json",
  "package.json",
  "test/guarda_do_portao.js",
]);

/** Copia a árvore mínima para um diretório temporário e aplica as edições
 *  pedidas. Cada edição é `[arquivo, de, para]`, com âncora conferida: âncora
 *  ausente ou ambígua ABORTA, em vez de produzir uma sabotagem que não sabota. */
function forjar(edicoes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arvore-forjada-"));
  for (const relativo of ESSENCIAIS) {
    const destino = path.join(dir, relativo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(path.join(RAIZ_REAL, relativo), destino);
  }

  for (const [relativo, de, para] of edicoes || []) {
    const alvo = path.join(dir, relativo);
    const bruto = fs.readFileSync(alvo, "utf8");
    const crlf = bruto.indexOf("\r\n") >= 0;
    const texto = bruto.split("\r\n").join("\n");
    const partes = texto.split(de);
    if (partes.length !== 2) {
      throw new Error(
        "âncora ambígua ou ausente (" + (partes.length - 1) + " ocorrências) em " + relativo + ": " + de.slice(0, 60)
      );
    }
    const mutado = partes.join(para);
    if (mutado === texto) throw new Error("a edição não alterou byte nenhum em " + relativo);
    fs.writeFileSync(alvo, crlf ? mutado.split("\n").join("\r\n") : mutado, "utf8");
  }

  return dir;
}

// ---------------------------------------------------------------------------
// [OS 54-C5] AS ÂNCORAS PASSARAM A SER DERIVADAS DO ARQUIVO
// ---------------------------------------------------------------------------
//
// A campanha `mutacoes_c5.js` tem um controle que quase ninguém pensaria em
// escrever: trocar a forma canônica do `run:` do guardião de escalar de fluxo
// para BLOCO ESCALAR, e exigir que a cadeia continue VERDE. Ele reprovou — e a
// autoridade não tinha nada a ver com isso. `ci/auditabilidade.js` aceitava as
// duas formas; quem caía eram doze casos cujas âncoras de sabotagem eram TEXTO
// LITERAL preso à forma de fluxo, e `forjar` abortava por âncora ausente.
//
// Isso é um alarme falso de verdade: reformatar o YAML — quebrar uma linha
// comprida, por exemplo — derrubaria o portão sem defeito nenhum, e vermelho
// pelo motivo errado é tão cego quanto verde indevido. A §2 exige que as duas
// formas canônicas continuem aceitas, e "aceitas" tem de valer para a cadeia
// inteira, não só para a autoridade.
//
// A saída é a mesma que `trechoDoPasso` já usava: EXTRAIR do arquivo real em
// vez de copiar para dentro de um literal. Uma cópia do YAML dentro do arnês
// envelhece calada; a extração acompanha o arquivo e falha alto quando o passo
// deixa de existir.
//
// E são GETTERS, e não valores calculados no `require`: numa cópia onde a
// sabotagem APAGOU o passo, calcular tudo na carga faria o módulo estourar
// antes do primeiro caso, e todas as suítes que o importam morreriam pelo
// motivo errado. Assim só quebra quem de fato pede a âncora que sumiu.

const CAMINHO_DO_WORKFLOW = path.join(RAIZ_REAL, ".github", "workflows", "provas-do-servidor.yml");

const linhasDoWorkflow = () =>
  fs.readFileSync(CAMINHO_DO_WORKFLOW, "utf8").split("\r\n").join("\n").split("\n");

const ehCabecalhoDePasso = (linha) => /^\s{4,}-\s+name:/.test(linha);

/** Onde um passo começa e termina, achado pelo NOME. */
function limitesDoPasso(nome) {
  const linhas = linhasDoWorkflow();
  let inicio = -1;
  for (let i = 0; i < linhas.length; i++) {
    const m = /^\s{4,}-\s+name:\s*(.*)$/.exec(linhas[i]);
    if (m && m[1].trim().replace(/^["']|["']$/g, "") === nome) { inicio = i; break; }
  }
  if (inicio < 0) throw new Error("passo não encontrado no workflow real: " + nome);
  let fim = linhas.length;
  for (let j = inicio + 1; j < linhas.length; j++) {
    if (ehCabecalhoDePasso(linhas[j])) { fim = j; break; }
  }
  return { linhas, inicio, fim };
}

/** O texto EXATO de um passo, pelo nome, INCLUINDO a linha em branco que o
 *  separa do próximo — sem ela, remover o passo deixa dois brancos seguidos e a
 *  sabotagem vira uma mudança de formatação a mais do que devia. */
function passoInteiro(nome) {
  const { linhas, inicio, fim } = limitesDoPasso(nome);
  const corpo = linhas.slice(inicio, fim);
  // O bloco de COMENTÁRIO que antecede o próximo passo mora entre os dois, e o
  // corte por cabeçalho o traz junto. Levá-lo embora numa sabotagem apagaria a
  // prosa do passo SEGUINTE — o que muda o arquivo mais do que a sabotagem diz
  // que muda, e sabotagem que faz mais do que declara mede outra coisa.
  while (corpo.length > 0) {
    const ultima = corpo[corpo.length - 1];
    if (ultima.trim() === "" || /^\s*#/.test(ultima)) corpo.pop();
    else break;
  }
  return corpo.join("\n") + "\n";
}

/** O texto EXATO da INVOCAÇÃO de um passo, pelo nome.
 *
 *  Em `run:` de fluxo é uma linha; em `run:` de bloco são a linha do `run:`
 *  mais todas as que pertencem ao bloco. Devolver a região inteira é o que
 *  permite trocar UMA forma canônica pela OUTRA numa sabotagem, em vez de colar
 *  um bloco novo ao lado de uma linha que ficou órfã.
 *
 *  [OS 54-C6] E EM `uses:` é a linha do `uses:`.
 *
 *  O passo do veredito deixou de ter `run:`: ele virou `uses:` de uma ação
 *  JavaScript local, justamente para não ter mais campo de shell onde compor.
 *  Se esta função continuasse exigindo `run:`, as sabotagens NOMINAIS da
 *  campanha da OS 54-C5 que miram o juiz morreriam por âncora — e caso que
 *  morre por âncora não mede coisa nenhuma, ele só some do placar.
 *
 *  Com a generalização elas continuam significando exatamente o que diziam
 *  significar: "o texto fica no lugar certo e a invocação deixa de ser
 *  invocação". Trocar a linha do `uses:` por um `run: echo …` é a mesma
 *  sabotagem daquela campanha, escrita na forma que o passo tem hoje. */
function runDoPasso(nome) {
  const { linhas, inicio, fim } = limitesDoPasso(nome);
  let iRun = -1;
  for (let i = inicio; i < fim; i++) {
    if (/^\s+run:/.test(linhas[i])) { iRun = i; break; }
  }
  if (iRun < 0) {
    for (let i = inicio; i < fim; i++) {
      if (/^\s+uses:/.test(linhas[i])) return linhas[i];
    }
    throw new Error("o passo `" + nome + "` não tem `run:` nem `uses:` no workflow real");
  }

  const recuoRun = (/^[ ]*/.exec(linhas[iRun]) || [""])[0].length;
  const resto = linhas[iRun].replace(/^\s+run:\s*/, "").replace(/\s+$/, "");
  if (!/^[|>][-+]?[0-9]*$/.test(resto)) return linhas[iRun];

  let ultima = iRun;
  for (let i = iRun + 1; i < fim; i++) {
    const vazia = linhas[i].trim() === "";
    const recuo = (/^[ ]*/.exec(linhas[i]) || [""])[0].length;
    if (!vazia && recuo <= recuoRun) break;
    if (!vazia) ultima = i;
  }
  return linhas.slice(iRun, ultima + 1).join("\n");
}

/** Trechos do workflow reaproveitados pelas sabotagens, extraídos do arquivo
 *  REAL — assim uma mudança de formatação acompanha a âncora em vez de fazer a
 *  sabotagem virar um no-op silencioso. */
const TRECHOS = Object.freeze({
  get uploadInteiro() { return passoInteiro("Evidência arquivada"); },
  uploadCabecalho: "      - name: Evidência arquivada\n        if: always()",
  uploadNome: "          name: evidencia-provas-do-servidor\n",
  uploadCaminho: "          path: ${{ env.EVIDENCIA }}/",
  uploadVazio: "          if-no-files-found: error",
  resumoCabecalho: "      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: always()",
  resumoRedirecionamento: '>> "$GITHUB_STEP_SUMMARY"',
  resumoChamada: "node ci/portao_do_ci.js --resumo",
  get invocacaoGuardiao() { return passoInteiro("Guardião da auditabilidade") + "\n"; },
  get invocacaoInventario() { return passoInteiro("Inventário por execução") + "\n"; },
  // [OS 54-C6] O passo próprio da autoridade do código de saída. Ele roda
  // ANTES do veredito e é a metade do §3 que não mora em `test/*.test.js`.
  get invocacaoDaPreservacao() { return passoInteiro("Preservação do código de saída") + "\n"; },
  // [OS 54-C4] A invocação da autoridade do artefato produtivo. Ela é o passo
  // que a OS 52-C4 entregou, e a composição a pôs sob a MESMA exigência das
  // outras: presente, sem `if:` e sem `continue-on-error:`.
  get invocacaoArtefato() { return passoInteiro("Artefato produtivo único") + "\n"; },
  // [OS 54-C5] Os escalares de `run:` dos passos canônicos. Eles são a âncora
  // das neutralizações NOMINAIS — `echo`, `printf`, heredoc, atribuição,
  // `true` —, que preservam o texto e desligam o comando. As campanhas antigas
  // só sabiam REMOVER, e remoção quebra a âncora: a detecção vinha do acidente,
  // e não da autoridade.
  get runDoJuiz() { return runDoPasso("Portão fail-closed"); },
  get runDoGuardiao() { return runDoPasso("Guardião da auditabilidade"); },
  get runDoInventario() { return runDoPasso("Inventário por execução"); },
  get runDoArtefato() { return runDoPasso("Artefato produtivo único"); },
  // [OS 54-C6] O `run:` do passo da autoridade do código de saída. Ele é a
  // âncora do caso que prova que a autoridade guarda o próprio passo — e vem
  // do arquivo, e não de um literal, porque o controle `D28` da campanha troca
  // uma forma canônica pela outra e exige VERDE. Um literal ali faria o caso
  // morrer por âncora nesse controle, que é morrer sem medir nada.
  get runDaPreservacao() { return runDoPasso("Preservação do código de saída"); },
  cabecalhoDoInventario: "      - name: Inventário por execução",
});

// ---------------------------------------------------------------------------
// [OS 54-C5] SABOTAGENS AGNÓSTICAS À FORMA DO `run:`
// ---------------------------------------------------------------------------
//
// Derivar as ÂNCORAS do arquivo resolveu metade do problema; a outra metade
// estava nas SUBSTITUIÇÕES. Um caso que escreve
//
//     run.replace("run: node", "run: echo node")
//
// só funciona enquanto o passo estiver em escalar de fluxo: no bloco escalar a
// troca não casa, a edição não muda byte nenhum, e o caso morre por âncora em
// vez de medir o que dizia medir.
//
// Estas três funções operam sobre o COMANDO dentro do escalar, seja qual for a
// forma. É o que permite ao controle `E27` — trocar uma forma canônica pela
// outra e exigir VERDE — significar alguma coisa.

/** O comando de uma invocação de passo, e como recolocá-lo lá dentro.
 *
 *  [OS 54-C6] Três formas: `run:` de fluxo, `run:` de bloco e `uses:`. Na
 *  terceira o "comando" é a ação referenciada — e prefixá-la com `echo`, que é
 *  o gesto das sabotagens nominais, produz um `uses:` que não resolve para ação
 *  nenhuma. É a tradução exata do gesto para a forma nova. */
function partesDoRun(run) {
  const linhas = String(run).split("\n");
  const comUses = /^(\s+)uses:\s*(.*)$/.exec(linhas[0]);
  if (comUses && !/^(\s+)run:/.test(linhas[0])) {
    return {
      forma: "uses", recuoRun: comUses[1], comando: comUses[2].replace(/\s+$/, ""),
      corpo: null, recuoCorpo: null,
    };
  }
  const cabecalho = /^(\s+)run:\s*(.*)$/.exec(linhas[0]);
  if (!cabecalho) throw new Error("isto não é uma invocação de passo: " + run.slice(0, 60));
  const recuoRun = cabecalho[1];
  const resto = cabecalho[2].replace(/\s+$/, "");

  if (!/^[|>][-+]?[0-9]*$/.test(resto)) {
    return { forma: "fluxo", recuoRun, comando: resto, corpo: null, recuoCorpo: null };
  }
  const corpo = linhas.slice(1);
  const primeira = corpo.findIndex((l) => l.trim() !== "");
  if (primeira < 0) throw new Error("bloco escalar vazio em `run:`");
  const recuoCorpo = (/^[ ]*/.exec(corpo[primeira]) || [""])[0];
  return { forma: "bloco", recuoRun, comando: corpo[primeira].trim(), corpo, recuoCorpo, primeira };
}

/** Troca o COMANDO preservando a forma do escalar. */
function comComandoTrocado(run, novoComando) {
  const p = partesDoRun(run);
  if (p.forma === "uses") return p.recuoRun + "uses: " + novoComando;
  if (p.forma === "fluxo") return p.recuoRun + "run: " + novoComando;
  const corpo = p.corpo.slice();
  corpo[p.primeira] = p.recuoCorpo + novoComando;
  return p.recuoRun + "run: |\n" + corpo.join("\n");
}

/** Põe um prefixo ANTES do comando — `echo`, `printf`, `:` — sem tocar na forma.
 *  É a neutralização nominal: o texto do comando fica, a execução some. */
function comPrefixoNoComando(run, prefixo) {
  const p = partesDoRun(run);
  return comComandoTrocado(run, prefixo + p.comando);
}

/** A OUTRA forma canônica do mesmo comando: fluxo vira bloco e bloco vira
 *  fluxo. Um escalar de bloco com mais de um comando não tem forma de fluxo
 *  equivalente, e a conversão falha alto em vez de inventar uma. */
function outraFormaDoRun(run) {
  const p = partesDoRun(run);
  if (p.forma === "uses") {
    throw new Error("`uses:` não tem forma canônica alternativa — é essa a razão de o juiz morar nele");
  }
  if (p.forma === "fluxo") {
    return p.recuoRun + "run: |\n" + p.recuoRun + "  " + p.comando;
  }
  const uteis = p.corpo.filter((l) => l.trim() !== "");
  if (uteis.length !== 1) {
    throw new Error("bloco com " + uteis.length + " linhas não tem forma de fluxo equivalente");
  }
  return p.recuoRun + "run: " + p.comando;
}

/** Devolve o TEXTO EXATO de um passo do workflow real, achado pelo que ele faz.
 *
 *  Copiar o passo inteiro para dentro de um literal aqui seria criar uma segunda
 *  cópia do YAML — que envelhece calada e faz a sabotagem virar no-op no dia em
 *  que alguém reformatar o arquivo. Extrair do original mantém uma verdade só, e
 *  a extração falha alto se o passo deixar de existir. */
function trechoDoPasso(marca) {
  const yaml = fs
    .readFileSync(path.join(RAIZ_REAL, ".github", "workflows", "provas-do-servidor.yml"), "utf8")
    .split("\r\n").join("\n");
  const linhas = yaml.split("\n");
  let inicio = -1;
  let fim = linhas.length;
  for (let i = 0; i < linhas.length; i++) {
    if (/^\s{4,}-\s+name:/.test(linhas[i])) {
      if (inicio >= 0) { fim = i; break; }
      const corpo = [];
      for (let j = i; j < linhas.length && (j === i || !/^\s{4,}-\s+name:/.test(linhas[j])); j++) corpo.push(linhas[j]);
      if (corpo.join("\n").includes(marca)) inicio = i;
    }
  }
  if (inicio < 0) throw new Error("passo não encontrado no workflow real: " + marca);
  const corpo = linhas.slice(inicio, fim);
  // O último passo do arquivo carrega as linhas vazias do fim junto; sem isto
  // a âncora não casa e a sabotagem viraria um no-op silencioso.
  while (corpo.length > 0 && corpo[corpo.length - 1].trim() === "") corpo.pop();
  return corpo.join("\n") + "\n";
}

/** Uma árvore com a cadeia do `pretest` sabotada num ponto.
 *
 *  `removerEtapa` tira o `pretest` do manifesto; caso contrário, troca uma linha
 *  da guarda (tipicamente comentando uma das chamadas obrigatórias). */
function forjarComPretest(de, para, removerEtapa) {
  if (removerEtapa) {
    const dir = forjar([]);
    const alvo = path.join(dir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(alvo, "utf8"));
    delete pkg.scripts.pretest;
    fs.writeFileSync(alvo, JSON.stringify(pkg, null, 2), "utf8");
    return dir;
  }
  return forjar([["test/guarda_do_portao.js", de, para]]);
}

module.exports = {
  ESSENCIAIS, RAIZ_REAL, TRECHOS, forjar, trechoDoPasso, forjarComPretest,
  limitesDoPasso, passoInteiro, runDoPasso,
  partesDoRun, comComandoTrocado, comPrefixoNoComando, outraFormaDoRun,
};
