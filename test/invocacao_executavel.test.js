// test/invocacao_executavel.test.js — A SUÍTE DA AUTORIDADE QUE SEPARA TEXTO DE
// EXECUÇÃO (OS 54-C5, §3).
//
// ===========================================================================
// POR QUE ESTA SUÍTE EXISTE
// ===========================================================================
//
// `ci/invocacao_executavel.js` é a peça que responde "isto vai RODAR?". Ela
// nasceu porque a OS 54-R4 mostrou que a resposta anterior — uma expressão
// regular sobre o corpo do passo — media presença de texto, e presença de texto
// não é execução: bastava prefixar `echo`.
//
// `test/auditabilidade_ci.test.js` já exercita essa autoridade DE FORA, contra
// árvores forjadas, e é lá que mora a prova de que as dez formas da §2 reprovam
// no veredito final. Esta suíte olha para DENTRO, e mede o que a de fora não
// alcança:
//
//   * o LEITOR do YAML — escalar de fluxo, bloco escalar, recuo, atributos;
//   * o LEITOR do shell — continuação de linha, heredoc (nu, citado, recuado),
//     comentário, aspas, separadores e redirecionamento;
//   * a ALCANÇABILIDADE — o que `exit` mata e o que ele não mata.
//
// Sem isto, um lexer esvaziado que devolvesse "um comando `node` alcançável"
// para qualquer script continuaria aprovando tudo, e a suíte de fora só veria o
// dano quando alguma sabotagem específica passasse. Cada peça vigiada pela
// camada que não mora nela.
//
// A TRAVA ANTI-VÁCUO é `EXE-00` e `EXE-01`: a autoridade tem de APROVAR as
// formas canônicas, inclusive as que o próprio workflow usa. Uma autoridade que
// recusasse tudo passaria em todos os casos negativos e pareceria rigorosa
// estando apenas quebrada.

"use strict";

const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const { conferirCenso } = require("./censo_de_suites.js");
const EXE = require("../ci/invocacao_executavel.js");
const GUARDIAO = require("../ci/auditabilidade.js");

const RAIZ = path.join(__dirname, "..");
const WORKFLOW = path.join(RAIZ, ".github", "workflows", "provas-do-servidor.yml");
const ALVO = "ci/auditabilidade.js";

const exigencia = (extra) => Object.assign({ binario: "node", alvo: ALVO, exige: [], proibe: [] }, extra || {});
const aceita = (script, extra) => EXE.invocacaoAutoritativa(script, exigencia(extra)).ok;
const motivo = (script, extra) => String(EXE.invocacaoAutoritativa(script, exigencia(extra)).motivo);

test("EXE/CONTROLE — o workflow REAL é lido, e os passos canônicos executam", async (t) => {
  await t.test("EXE-00: os quatro passos obrigatórios existem e invocam de verdade", () => {
    const passos = EXE.passosDoWorkflow(fs.readFileSync(WORKFLOW, "utf8"));
    assert.ok(passos.length >= 10, "o leitor achou só " + passos.length + " passos no workflow real");
    for (const e of GUARDIAO.INVOCACOES_OBRIGATORIAS) {
      const passo = EXE.passoChamado(passos, e.passo);
      assert.ok(passo, "passo canônico ausente no workflow real: " + e.passo);
      assert.ok(passo.run.presente, "passo `" + e.passo + "` sem `run:`");
      const veredito = EXE.invocacaoAutoritativa(passo.run.script, e);
      assert.ok(veredito.ok, "o workflow real não satisfaz `" + e.alvo + "`: " + veredito.motivo);
    }
    conferirCenso();
  });

  await t.test("EXE-00b: os dois tipos de escalar são reconhecidos no arquivo real", () => {
    const passos = EXE.passosDoWorkflow(fs.readFileSync(WORKFLOW, "utf8"));
    const tipos = new Set(passos.filter((p) => p.run.presente).map((p) => p.run.tipo));
    assert.ok(tipos.has("fluxo"), "nenhum `run:` de fluxo foi reconhecido");
    assert.ok(tipos.has("bloco"), "nenhum `run:` em bloco escalar foi reconhecido");
  });
});

test("EXE/ACEITA — as formas canônicas passam", async (t) => {
  await t.test("EXE-01: fluxo, bloco, `./`, continuação, encadeamento e cano", () => {
    for (const script of [
      "node ci/auditabilidade.js",
      "node ci/auditabilidade.js\n",
      "node ./ci/auditabilidade.js",
      "node \\\n  ci/auditabilidade.js",
      "mkdir -p x && node ci/auditabilidade.js",
      "echo oi; node ci/auditabilidade.js",
      "echo oi | node ci/auditabilidade.js",
      "node ci/auditabilidade.js # o comentário vem depois, e não desliga nada",
      "node ci/auditabilidade.js > /dev/null",
    ]) {
      assert.ok(aceita(script), "forma canônica recusada: " + JSON.stringify(script));
    }
  });

  await t.test("EXE-01b: argumentos exigidos são cobrados, e sobras não atrapalham", () => {
    assert.ok(aceita("node ci/auditabilidade.js --conferir", { exige: ["--conferir"] }));
    assert.ok(!aceita("node ci/auditabilidade.js", { exige: ["--conferir"] }));
    assert.match(motivo("node ci/auditabilidade.js", { exige: ["--conferir"] }), /argumentos obrigatórios/);
  });

  await t.test("EXE-01c: argumento PROIBIDO descaracteriza o papel do passo", () => {
    assert.ok(!aceita("node ci/auditabilidade.js --resumo", { proibe: ["--resumo"] }));
    assert.match(motivo("node ci/auditabilidade.js --resumo", { proibe: ["--resumo"] }), /de outro papel/);
  });
});

test("EXE/RECUSA — as dez formas da §2", async (t) => {
  await t.test("EXE-02: `echo` do comando não é o comando", () => {
    assert.ok(!aceita("echo node ci/auditabilidade.js"));
    assert.match(motivo("echo node ci/auditabilidade.js"), /passado para `echo`/);
  });

  await t.test("EXE-03: `printf` do comando não é o comando", () => {
    assert.ok(!aceita("printf '%s\\n' 'node ci/auditabilidade.js'"));
  });

  await t.test("EXE-04: comando comentado", () => {
    assert.ok(!aceita("# node ci/auditabilidade.js\ntrue"));
    assert.ok(!aceita("true\n  # node ci/auditabilidade.js"));
  });

  await t.test("EXE-05: texto dentro de string", () => {
    assert.ok(!aceita('grep -q "node ci/auditabilidade.js" README.md'));
    assert.ok(!aceita("echo 'node ci/auditabilidade.js' > log.txt"));
  });

  await t.test("EXE-06: heredoc — nu, citado e recuado", () => {
    assert.ok(!aceita("cat <<EOF\nnode ci/auditabilidade.js\nEOF"));
    assert.ok(!aceita("cat <<'FIM'\nnode ci/auditabilidade.js\nFIM"));
    assert.ok(!aceita("cat <<-EOF\n\tnode ci/auditabilidade.js\n\tEOF"));
  });

  await t.test("EXE-06b: o comando DEPOIS do heredoc volta a valer", () => {
    // O recorte não pode comer o resto do script: se comesse, a forma canônica
    // com heredoc antes reprovaria, e vermelho pelo motivo errado é tão cego
    // quanto verde indevido.
    assert.ok(aceita("cat <<EOF\ntexto qualquer\nEOF\nnode ci/auditabilidade.js"));
  });

  await t.test("EXE-07: atribuição de variável", () => {
    assert.ok(!aceita('CMD="node ci/auditabilidade.js"\ntrue'));
    assert.ok(!aceita("CMD=node\nARQ=ci/auditabilidade.js"));
  });

  await t.test("EXE-08: `true`, `:` e equivalentes", () => {
    assert.ok(!aceita("true # node ci/auditabilidade.js"));
    assert.ok(!aceita(": node ci/auditabilidade.js"));
    assert.ok(!aceita("false node ci/auditabilidade.js"));
  });

  await t.test("EXE-09: depois de saída antecipada incondicional", () => {
    assert.ok(!aceita("exit 0\nnode ci/auditabilidade.js"));
    assert.ok(!aceita("return\nnode ci/auditabilidade.js"));
    assert.match(motivo("exit 0\nnode ci/auditabilidade.js"), /saída antecipada/);
  });

  await t.test("EXE-09b: `exit` CONDICIONAL ou dentro de bloco não mata o resto", () => {
    assert.ok(aceita('[ -n "$X" ] && exit 0\nnode ci/auditabilidade.js'));
    assert.ok(aceita("if [ -f x ]; then exit 1; fi\nnode ci/auditabilidade.js"));
    assert.ok(aceita("for f in a b; do exit 1; done\nnode ci/auditabilidade.js"));
  });

  await t.test("EXE-10: só o caminho, sem binário", () => {
    assert.ok(!aceita("ci/auditabilidade.js"));
    assert.ok(!aceita("sh ci/auditabilidade.js"));
  });

  await t.test("EXE-11: ocorrência meramente textual em comando composto", () => {
    assert.ok(!aceita('test -f "node ci/auditabilidade.js" && echo "node ci/auditabilidade.js"'));
    assert.ok(!aceita('[ -z "$X" ] || printf "node ci/auditabilidade.js"'));
  });
});

test("EXE/LEITOR — o que o lexer tem de acertar para o veredito valer", async (t) => {
  await t.test("EXE-12: comentário de shell só abre PALAVRA, e não vale dentro de aspas", () => {
    assert.equal(EXE.semComentarioDeShell('echo "a#b"'), 'echo "a#b"');
    assert.equal(EXE.semComentarioDeShell("echo a # b").trim(), "echo a");
    assert.equal(EXE.semComentarioDeShell("echo a#b"), "echo a#b");
  });

  await t.test("EXE-13: escalar de fluxo só é desembrulhado quando tem aspas nos DOIS lados", () => {
    // O `run:` do juiz TERMINA em aspas sem começar com elas. Um recorte cego
    // devolveria um script com aspas desemparelhadas — e o lexer mediria outra
    // coisa. Custou uma leitura descobrir.
    assert.equal(EXE.escalarDeFluxo('node x.js "$A/b.txt"'), 'node x.js "$A/b.txt"');
    assert.equal(EXE.escalarDeFluxo("'node x.js'"), "node x.js");
    assert.equal(EXE.escalarDeFluxo('"node x.js"'), "node x.js");
  });

  await t.test("EXE-14: `&` de redirecionamento não parte o comando", () => {
    const comandos = EXE.comandosDe('npm test > "$E/npm-test.txt" 2>&1');
    assert.equal(comandos.length, 1, "o `2>&1` partiu o comando em " + comandos.length);
    assert.equal(comandos[0].cabeca, "npm");
  });

  await t.test("EXE-15: `>` e `>>` são distinguidos, e o alvo do redirecionamento é lido", () => {
    const anexa = EXE.comandosDe('node x.js >> "$PAINEL"')[0];
    const trunca = EXE.comandosDe('node x.js > "$PAINEL"')[0];
    assert.equal(EXE.redirecionamentoPara(anexa, "$PAINEL"), ">>");
    assert.equal(EXE.redirecionamentoPara(trunca, "$PAINEL"), ">");
    assert.equal(EXE.redirecionamentoPara(EXE.comandosDe("node x.js")[0], "$PAINEL"), null);
  });

  await t.test("EXE-16: o bloco escalar é dedentado pela PRIMEIRA linha não vazia", () => {
    const yaml = [
      "jobs:",
      "  provas:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Um passo",
      "        run: |",
      "          node ci/auditabilidade.js",
      "          echo fim",
      "      - name: Outro",
      "        run: echo oi",
    ].join("\n");
    const passos = EXE.passosDoWorkflow(yaml);
    const um = EXE.passoChamado(passos, "Um passo");
    assert.equal(um.run.tipo, "bloco");
    assert.equal(um.run.script.split("\n")[0], "node ci/auditabilidade.js");
    assert.ok(aceita(um.run.script), "o bloco dedentado deixou de ser reconhecido");
    assert.equal(EXE.passoChamado(passos, "Outro").run.tipo, "fluxo");
  });

  await t.test("EXE-17: atributos do passo são lidos, e `if:` de um não vaza para o outro", () => {
    const yaml = [
      "    steps:",
      "      - name: Com if",
      "        if: always()",
      "        run: echo a",
      "      - name: Sem if",
      "        run: echo b",
    ].join("\n");
    const passos = EXE.passosDoWorkflow(yaml);
    assert.equal(EXE.passoChamado(passos, "Com if").atributos["if"], "always()");
    assert.equal(EXE.passoChamado(passos, "Sem if").atributos["if"], undefined);
  });

  await t.test("EXE-18: passo comentado no YAML não existe", () => {
    const yaml = [
      "    steps:",
      "      # - name: Guardião da auditabilidade",
      "      #   run: node ci/auditabilidade.js",
      "      - name: Vivo",
      "        run: echo a",
    ].join("\n");
    const passos = EXE.passosDoWorkflow(yaml);
    assert.equal(EXE.passoChamado(passos, "Guardião da auditabilidade"), null);
    assert.equal(passos.length, 1);
  });
});

test("EXE/AMARRAÇÃO — a autoridade é a mesma que o guardião usa", async (t) => {
  await t.test("EXE-19: o guardião cobra o passo canônico, e a árvore real passa", () => {
    // Se esta afirmação cair, os casos acima medem um módulo que ninguém
    // consulta — e um verificador que não é chamado não verifica.
    for (const e of GUARDIAO.INVOCACOES_OBRIGATORIAS) {
      assert.equal(typeof e.passo, "string");
      assert.ok(e.alvo.startsWith("ci/"), "alvo fora de `ci/`: " + e.alvo);
    }
    assert.deepEqual(GUARDIAO.conferirAuditabilidade({}), []);
  });

  await t.test("EXE-20: `conferirInvocacao` reprova passo inexistente por AUSÊNCIA", () => {
    const passos = EXE.passosDoWorkflow("    steps:\n      - name: Nada\n        run: echo a\n");
    const motivos = GUARDIAO.conferirInvocacao(passos, GUARDIAO.INVOCACOES_OBRIGATORIAS[0]);
    assert.ok(motivos.some((m) => /INVOCAÇÃO AUSENTE/.test(m)), JSON.stringify(motivos));
  });
});
