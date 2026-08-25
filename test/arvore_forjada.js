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

/** Trechos do workflow reaproveitados pelas sabotagens, extraídos do arquivo
 *  REAL — assim uma mudança de formatação quebra a âncora em vez de fazer a
 *  sabotagem passar despercebida. */
const TRECHOS = Object.freeze({
  uploadInteiro:
    "      - name: Evidência arquivada\n" +
    "        if: always()\n" +
    "        uses: actions/upload-artifact@v4\n" +
    "        with:\n" +
    "          name: evidencia-provas-do-servidor\n" +
    "          path: ${{ env.EVIDENCIA }}/\n" +
    "          if-no-files-found: error\n" +
    "          retention-days: 30\n",
  uploadCabecalho: "      - name: Evidência arquivada\n        if: always()",
  uploadNome: "          name: evidencia-provas-do-servidor\n",
  uploadCaminho: "          path: ${{ env.EVIDENCIA }}/",
  uploadVazio: "          if-no-files-found: error",
  resumoCabecalho: "      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: always()",
  resumoRedirecionamento: '>> "$GITHUB_STEP_SUMMARY"',
  resumoChamada: "node ci/portao_do_ci.js --resumo",
  invocacaoGuardiao: "      - name: Guardião da auditabilidade\n        run: node ci/auditabilidade.js\n\n",
  invocacaoInventario: "      - name: Inventário por execução\n        run: node ci/inventario_de_execucao.js\n\n",
  // [OS 54-C4] A invocação da autoridade do artefato produtivo. Ela é o passo
  // que a OS 52-C4 entregou, e a composição a pôs sob a MESMA exigência das
  // outras: presente, sem `if:` e sem `continue-on-error:`.
  invocacaoArtefato: "      - name: Artefato produtivo único\n        run: node ci/artefato.js --conferir --raiz .\n\n",
});

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

module.exports = { ESSENCIAIS, RAIZ_REAL, TRECHOS, forjar, trechoDoPasso, forjarComPretest };
