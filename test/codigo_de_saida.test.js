// test/codigo_de_saida.test.js — A OUTRA METADE DA AUTORIDADE (OS 54-C6, §3).
//
// ===========================================================================
// POR QUE ESTA SUÍTE EXISTE, E POR QUE ELA NÃO BASTA
// ===========================================================================
//
// `ci/codigo_de_saida.js` responde "o passo DEPENDE do resultado disso?" e mora
// fora de `test/`, no `pretest` e num passo próprio do workflow. Esta suíte é a
// segunda metade: ela exercita a autoridade de dentro do `npm test`.
//
// As duas são necessárias e nenhuma é suficiente. A OS 54-R2 provou que guarda
// escrita dentro do conjunto varrido some junto com ele; a OS 54-R4 provou que
// autoridade que ninguém exercita vira decoração. Remover qualquer uma das
// metades sozinha deixa a outra VERMELHA:
//
//   * apagar `ci/codigo_de_saida.js` quebra o `require` daqui, do `pretest` e
//     de `ci/auditabilidade.js`;
//   * trivializá-lo deixa esta suíte vermelha (os negativos param de reprovar);
//   * apagar esta suíte cai no censo, no piso declarado, no piso externo, no
//     inventário por execução e nos nomes obrigatórios.
//
// ===========================================================================
// O QUE É MEDIDO RODANDO, E NÃO LENDO
// ===========================================================================
//
// A §4 manda executar a cadeia equivalente à do CI, e é o que `SAI-18` e
// `SAI-19` fazem:
//
//   1. uma suíte DELIBERADAMENTE VERMELHA é executada de verdade, e a saída
//      dela vira evidência (com os dois ecos que o npm escreve);
//   2. o juiz é executado sobre essa evidência;
//   3. a FORMA DE INVOCAÇÃO DECLARADA é executada — o entrypoint que o
//      `runs.main` do `action.yml` apontar, e não um caminho escrito aqui;
//   4. o código final é observado;
//   5. exige-se VERMELHO.
//
// E o controle íntegro, que tem de continuar VERDE, roda no mesmo caso: sem
// ele, uma autoridade que reprovasse tudo passaria em todos os negativos e
// pareceria rigorosa estando quebrada.
//
// `SAI-19` faz o mesmo para os passos que continuam em `run:`, com `bash -e`
// de verdade — que é o shell padrão do provedor. É ali que se vê, em vez de
// deduzir, que a forma canônica propaga o vermelho e a forma composta não.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CODIGO = require("../ci/codigo_de_saida.js");
const GUARDIAO = require("../ci/auditabilidade.js");
const { OBRIGATORIAS, conferirCenso } = require("./censo_de_suites.js");
const {
  forjar, RAIZ_REAL, TRECHOS, partesDoRun, comComandoTrocado,
} = require("./arvore_forjada.js");

const WORKFLOW = ".github/workflows/provas-do-servidor.yml";
const ACAO = path.join(".github", "actions", "portao");
const NL = String.fromCharCode(10);

// [OS 52-C2] A RECIPROCIDADE. O censo conhece esta suíte, e esta suíte chama o
// censo: quem apagar uma das pontas reprova pela outra.
conferirCenso();

/** As reprovações da autoridade sobre uma árvore forjada com as edições dadas.
 *  Leitura ESTRUTURAL: a prova comportamental é pedida caso a caso, porque ela
 *  executa processos e não faz sentido em toda árvore de mentirinha. */
function reprovacoesCom(edicoes) {
  const dir = forjar(edicoes);
  try {
    return CODIGO.conferirPreservacaoDoCodigo({ raiz: dir });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function exigeMotivo(reprovacoes, padrao, oQue) {
  assert.ok(
    reprovacoes.some((m) => padrao.test(m)),
    oQue + " — motivos: " + (reprovacoes.length ? reprovacoes.join(" | ") : "(nenhum)")
  );
}

/** Uma cópia do entrypoint real com uma edição, fora da árvore. `GITHUB_WORKSPACE`
 *  continua apontando para a árvore REAL, então o juiz que ele executa é o de
 *  verdade — o que muda é só o fio. */
function entrypointMutado(de, para) {
  const original = fs.readFileSync(path.join(RAIZ_REAL, ACAO, "index.js"), "utf8");
  const partes = original.split(de);
  assert.equal(partes.length, 2, "âncora ambígua ou ausente no entrypoint: " + de.slice(0, 60));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "os54c6-fio-"));
  const alvo = path.join(dir, "index.js");
  fs.writeFileSync(alvo, partes.join(para), "utf8");
  return { dir, alvo };
}

const RUN_DO_GUARDIAO = TRECHOS.runDoGuardiao;
const comRunTrocado = (novo) => reprovacoesCom([[WORKFLOW, RUN_DO_GUARDIAO, novo]]);

// ===========================================================================
// FORMA — o passo do veredito só aceita uma
// ===========================================================================

test("SAI/FORMA — o passo do veredito não tem campo de shell para compor", async (t) => {
  await t.test("SAI-00: a árvore REAL passa, inclusive na prova comportamental", () => {
    // A trava anti-vácuo. Sem ela, uma autoridade que recusasse tudo passaria
    // em cada negativo abaixo e pareceria rigorosa estando quebrada.
    assert.deepEqual(CODIGO.conferirPreservacaoDoCodigo({ executar: true }), []);
  });

  await t.test("SAI-01: passo do veredito AUSENTE reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, "      - name: Portão fail-closed" + NL, ""]]),
      /VEREDITO SEM PASSO/,
      "o passo do veredito sumiu e a autoridade aprovou"
    );
  });

  await t.test("SAI-02: passo do veredito DUPLICADO reprova, mesmo com o primeiro íntegro", () => {
    // A duplicata é a sabotagem que toda guarda escrita com `find` deixa passar:
    // ela acha o primeiro, que está perfeito, e nunca vê o segundo.
    const duplicado =
      "      - name: Portão fail-closed" + NL +
      "        uses: ./.github/actions/portao" + NL +
      "        continue-on-error: true" + NL +
      "        with:" + NL +
      "          saida: ${{ env.EVIDENCIA }}/npm-test.txt" + NL +
      "          marcador: ${{ env.EVIDENCIA }}/exit.txt" + NL + NL +
      "      - name: Artefato produtivo único";
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, "      - name: Artefato produtivo único", duplicado]]),
      /VEREDITO DUPLICADO/,
      "um segundo passo com o mesmo nome, permissivo, passou despercebido"
    );
  });

  await t.test("SAI-03: nome preservado com CONTEÚDO diferente reprova", () => {
    exigeMotivo(
      // A âncora sai do arquivo, e não de um literal: o caminho da ação também
      // aparece na PROSA do topo do workflow, e âncora que casa com o
      // comentário mede a prosa em vez do programa.
      reprovacoesCom([[WORKFLOW, TRECHOS.runDoJuiz, "        uses: ./.github/actions/outra"]]),
      /VEREDITO EM OUTRA AÇÃO/,
      "o passo manteve o nome e passou a usar outra ação"
    );
  });

  await t.test("SAI-04: o comando CORRETO acrescido de complemento reprova", () => {
    // O escape material da R5, escrito na forma que o passo teria hoje: quem
    // quisesse reproduzi-lo precisaria devolver o campo de shell ao passo.
    for (const [oQue, linha] of [
      ["complemento com `||`", '        run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt" || echo "seguimos"'],
      ["comando posterior", '        run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"'],
    ]) {
      exigeMotivo(
        reprovacoesCom([[WORKFLOW, TRECHOS.runDoJuiz, linha]]),
        /VEREDITO COM ATRIBUTO ESTRANHO.*`run`/,
        "o veredito voltou para um campo de shell livre (" + oQue + ")"
      );
    }
  });

  await t.test("SAI-05: `continue-on-error` no passo do veredito reprova", () => {
    exigeMotivo(
      reprovacoesCom([[
        WORKFLOW, "      - name: Portão fail-closed" + NL,
        "      - name: Portão fail-closed" + NL + "        continue-on-error: true" + NL,
      ]]),
      /VEREDITO COM ATRIBUTO ESTRANHO.*`continue-on-error`/,
      "o passo do veredito passou a perdoar o próprio erro"
    );
  });

  await t.test("SAI-06: condição que PULA o veredito reprova", () => {
    for (const condicao of ["if: always()", "if: false", "if: ${{ runner.os == 'Windows' }}"]) {
      exigeMotivo(
        reprovacoesCom([[
          WORKFLOW, "      - name: Portão fail-closed" + NL,
          "      - name: Portão fail-closed" + NL + "        " + condicao + NL,
        ]]),
        /VEREDITO COM ATRIBUTO ESTRANHO.*`if`/,
        "o veredito ganhou `" + condicao + "` — condicionar é desligar sem apagar"
      );
    }
  });

  await t.test("SAI-07: `shell:` no passo do veredito reprova", () => {
    exigeMotivo(
      reprovacoesCom([[
        WORKFLOW, "      - name: Portão fail-closed" + NL,
        "      - name: Portão fail-closed" + NL + "        shell: pwsh" + NL,
      ]]),
      /VEREDITO COM ATRIBUTO ESTRANHO.*`shell`/,
      "trocar o intérprete do passo do veredito passou despercebido"
    );
  });

  await t.test("SAI-08: evidência ou marcador TROCADOS reprovam", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, "saida: ${{ env.EVIDENCIA }}/npm-test.txt", "saida: ${{ env.EVIDENCIA }}/outra.txt"]]),
      /VEREDITO SOBRE OUTRA EVIDÊNCIA.*saida/,
      "o juiz passou a julgar outro arquivo de saída"
    );
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, "marcador: ${{ env.EVIDENCIA }}/exit.txt", "marcador: ${{ env.EVIDENCIA }}/zero.txt"]]),
      /VEREDITO SOBRE OUTRA EVIDÊNCIA.*marcador/,
      "o marcador de desfecho passou a apontar para outro arquivo"
    );
  });
});

// ===========================================================================
// COMANDO ÚNICO — os passos que continuam em `run:`
// ===========================================================================

test("SAI/COMANDO ÚNICO — o que sobrou em `run:` não pode ser composto", async (t) => {
  await t.test("SAI-09: as oito formas que absorvem o resultado reprovam", () => {
    // O escape `E9` da R5 era `|| echo` no GUARDIÃO — a mesma doença no passo
    // do lado. Estas oito não são uma lista negra: cada uma cai pela mesma
    // regra, que é "o script inteiro tem de ser UM comando simples".
    const COMPOSICOES = [
      ["mensagem posterior", '        run: |' + NL + '          node ci/auditabilidade.js' + NL + '          echo "seguimos"'],
      ["comando neutro posterior", '        run: |' + NL + '          node ci/auditabilidade.js' + NL + '          true'],
      ["executável de sucesso explícito", "        run: node ci/auditabilidade.js || /bin/true"],
      ["encerramento explícito com zero", '        run: |' + NL + '          node ci/auditabilidade.js' + NL + '          exit 0'],
      ["resultado encaminhado por cano", "        run: node ci/auditabilidade.js | cat"],
      ["segundo plano sem espera", "        run: node ci/auditabilidade.js &"],
      ["modo tolerante antes do alvo", '        run: |' + NL + '          set +e' + NL + '          node ci/auditabilidade.js'],
      ["interpretador intermediário", "        run: bash -c 'node ci/auditabilidade.js'"],
    ];
    for (const [oQue, linha] of COMPOSICOES) {
      exigeMotivo(
        comRunTrocado(linha),
        /CÓDIGO DE SAÍDA NÃO PRESERVADO em `Guardião da auditabilidade`/,
        "a forma `" + oQue + "` deixou o resultado do guardião sem chegar ao job"
      );
    }
  });

  await t.test("SAI-10: as formas canônicas continuam aceitas (trava anti-veto)", () => {
    // Uma autoridade que recusasse o bloco escalar, a continuação de linha ou o
    // comentário de shell reprovaria o repositório íntegro no dia em que alguém
    // quebrasse uma linha comprida. Vermelho pelo motivo errado é tão cego
    // quanto verde indevido.
    for (const [oQue, script] of [
      ["fluxo", "node ci/auditabilidade.js"],
      ["bloco escalar", "node ci/auditabilidade.js" + NL],
      ["continuação de linha", "node \\" + NL + "  ci/auditabilidade.js"],
      ["com comentário de shell", "node ci/auditabilidade.js # o guardião"],
    ]) {
      const veredito = CODIGO.comandoUnicoSimples(script, { binario: "node", alvo: "ci/auditabilidade.js" });
      assert.ok(veredito.ok, "a forma canônica `" + oQue + "` foi recusada: " + veredito.motivo);
    }
    assert.deepEqual(reprovacoesCom([]), []);
  });

  await t.test("SAI-11: `&` de redirecionamento não é `&` de segundo plano", () => {
    // A distinção custou uma leitura na C5 e continua valendo: tratar `2>&1`
    // como separador partiria o passo das provas no meio. Aqui o teste é o
    // contrário do de cima — a leitura tem de VER o segundo plano e NÃO ver
    // separador onde há redirecionamento.
    assert.deepEqual(CODIGO.separadoresDe('npm test > "$E/a.txt" 2>&1'), []);
    assert.deepEqual(CODIGO.separadoresDe("node ci/x.js &"), ["&"]);
    assert.deepEqual(CODIGO.separadoresDe('echo "a && b"'), []);
    assert.deepEqual(CODIGO.separadoresDe("node ci/x.js && node ci/y.js"), ["&&"]);
    assert.deepEqual(CODIGO.redirecionamentosDe("node ci/x.js"), []);
    assert.deepEqual(CODIGO.redirecionamentosDe("cat <<EOF"), ["<", "<"]);
  });
});

// ===========================================================================
// A AÇÃO LOCAL — manifesto, entrypoint e runtime
// ===========================================================================

test("SAI/AÇÃO — o fio entre o juiz e o runner é declarado e conferido", async (t) => {
  await t.test("SAI-12: ação ou manifesto AUSENTES reprovam", () => {
    const dir = forjar([]);
    try {
      fs.rmSync(path.join(dir, ACAO, "action.yml"));
      exigeMotivo(
        CODIGO.conferirPreservacaoDoCodigo({ raiz: dir }),
        /AÇÃO DO PORTÃO AUSENTE/,
        "o `uses:` apontava para uma ação que não está no checkout"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("SAI-13: RUNTIME Node alterado reprova", () => {
    for (const runtime of ["node20", "node16", "docker"]) {
      exigeMotivo(
        reprovacoesCom([[path.join(ACAO, "action.yml"), "using: 'node24'", "using: '" + runtime + "'"]]),
        /RUNTIME DA AÇÃO TROCADO/,
        "o runtime da ação virou `" + runtime + "` sem reprovar"
      );
    }
  });

  await t.test("SAI-14: ENTRYPOINT trocado ou ausente reprova", () => {
    exigeMotivo(
      reprovacoesCom([[path.join(ACAO, "action.yml"), "main: 'index.js'", "main: 'outro.js'"]]),
      /ENTRYPOINT TROCADO/,
      "trocar o arquivo executado passou despercebido"
    );
    const dir = forjar([]);
    try {
      fs.rmSync(path.join(dir, ACAO, "index.js"));
      exigeMotivo(
        CODIGO.conferirPreservacaoDoCodigo({ raiz: dir }),
        /ENTRYPOINT AUSENTE/,
        "o entrypoint sumiu do disco e a autoridade aprovou"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("SAI-15: entrada que deixa de ser obrigatória reprova", () => {
    exigeMotivo(
      reprovacoesCom([[path.join(ACAO, "action.yml"), "    description: 'Arquivo com a saída literal do `npm test`.'\n    required: true", "    description: 'Arquivo com a saída literal do `npm test`.'\n    required: false"]]),
      /ENTRADA `saida` DEIXOU DE SER OBRIGATÓRIA/,
      "entrada opcional chega vazia e ninguém reclama"
    );
  });

  await t.test("SAI-16: o runtime da ação está AMARRADO ao Node do job", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, "node-version: '24'", "node-version: '20'"]]),
      /RUNTIME DESAMARRADO/,
      "o job passou a instalar outro Node e a ação continuou fixada no antigo"
    );
  });
});

// ===========================================================================
// A PROVA COMPORTAMENTAL — §4
// ===========================================================================

test("SAI/COMPORTAMENTO — o código de saída é medido, não afirmado", async (t) => {
  await t.test("SAI-17: um fio que ENGOLE o vermelho reprova rodando", () => {
    const { dir, alvo } = entrypointMutado("  return execucao.status;", "  return execucao.status === 0 ? 0 : 0;");
    try {
      exigeMotivo(
        CODIGO.conferirEntrypointExecutando(RAIZ_REAL, alvo),
        /CÓDIGO DE SAÍDA NÃO PRESERVADO \(evidência reprovada\)/,
        "o entrypoint traduziu a reprovação do juiz em sucesso e nenhuma leitura de texto veria"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("SAI-18: um fio que INVENTA vermelho também reprova", () => {
    // A simetria importa: um portão que reprovasse sempre passaria em todos os
    // negativos desta suíte e seria inútil no dia em que a árvore estivesse boa.
    const { dir, alvo } = entrypointMutado("  return execucao.status;", "  return 1;");
    try {
      exigeMotivo(
        CODIGO.conferirEntrypointExecutando(RAIZ_REAL, alvo),
        /CÓDIGO DE SAÍDA NÃO PRESERVADO \(evidência aprovada\)/,
        "o entrypoint inventou uma reprovação que o juiz não deu"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("SAI-19: suíte deliberadamente VERMELHA -> juiz -> forma declarada -> job VERMELHO", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "os54c6-sonda-"));
    try {
      // 1. UMA SUÍTE DELIBERADAMENTE VERMELHA, executada de verdade.
      const sonda = path.join(dir, "sonda.test.js");
      fs.writeFileSync(
        sonda,
        'const test = require("node:test");' + NL +
        'const assert = require("node:assert/strict");' + NL +
        'test("SONDA: caso deliberadamente vermelho", () => { assert.equal(1, 2); });' + NL,
        "utf8"
      );
      // `NODE_TEST_CONTEXT` É HERDADO, e um `node --test` filho que o veja
      // passa a se reportar ao runner de fora em vez de dar veredito próprio —
      // sai com 0 mesmo vermelho. Sem tirá-lo do ambiente, esta prova mediria o
      // runner de fora, e não a sonda.
      const ambiente = Object.assign({}, process.env);
      delete ambiente.NODE_TEST_CONTEXT;
      const corrida = spawnSync(process.execPath, ["--test", sonda], {
        encoding: "utf8", timeout: 120000, env: ambiente,
      });
      assert.notEqual(corrida.status, 0, "a sonda deliberadamente vermelha terminou VERDE");

      // A evidência é a saída da corrida, emoldurada pelos dois ecos que o npm
      // escreve antes de executar o script.
      const evidencia = {
        saida: path.join(dir, "npm-test.txt"),
        marcador: path.join(dir, "exit.txt"),
      };
      fs.writeFileSync(
        evidencia.saida,
        "> buraco-master-vip-servidor@1.0.0 test" + NL +
        '> node --test "test/*.test.js"' + NL + NL +
        String(corrida.stdout || "") + String(corrida.stderr || ""),
        "utf8"
      );
      fs.writeFileSync(evidencia.marcador, String(corrida.status), "utf8");

      // 2. O JUIZ sobre essa evidência.
      const doJuiz = CODIGO.rodarJuiz(RAIZ_REAL, evidencia);
      assert.notEqual(doJuiz, 0, "o juiz aprovou uma suíte vermelha");

      // 3. A FORMA DE INVOCAÇÃO DECLARADA — o que `runs.main` apontar.
      const manifesto = CODIGO.conferirManifestoDaAcao(RAIZ_REAL);
      assert.deepEqual(manifesto.reprovacoes, []);
      const doPasso = CODIGO.rodarEntrypoint(RAIZ_REAL, manifesto.entrypoint, evidencia);

      // 4 e 5. O CÓDIGO FINAL DO PASSO, e ele é VERMELHO.
      assert.equal(
        doPasso, doJuiz,
        "o passo não devolveu o código do juiz (juiz=" + doJuiz + ", passo=" + doPasso + ")"
      );
      assert.notEqual(doPasso, 0, "uma suíte deliberadamente vermelha embarcaria como sucesso");

      // O CONTROLE ÍNTEGRO, no mesmo caso: evidência aprovada continua verde
      // nos dois caminhos. É a trava anti-vácuo da prova comportamental.
      const piso = JSON.parse(fs.readFileSync(path.join(RAIZ_REAL, "ci", "piso_do_portao.json"), "utf8"));
      const boa = CODIGO.evidenciaForjada(dir, 0, piso.casos_minimos, piso.suites_minimas);
      assert.equal(CODIGO.rodarJuiz(RAIZ_REAL, boa), 0, "o juiz reprovou evidência íntegra");
      assert.equal(
        CODIGO.rodarEntrypoint(RAIZ_REAL, manifesto.entrypoint, boa), 0,
        "o passo reprovou evidência íntegra — portão que reprova tudo não guarda nada"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("SAI-20: em `bash -e`, a forma canônica propaga e a composta não", () => {
    // O que a R5 mediu, medido de novo aqui e no shell de verdade. Não é
    // opinião sobre bash: é bash respondendo. E é o que justifica a autoridade
    // recusar a forma composta em vez de confiar numa lista de proibições.
    const bash = spawnSync("bash", ["-e", "-c", "exit 7"], { stdio: "ignore" });
    assert.ok(
      !bash.error && bash.status === 7,
      "`bash` não está disponível para a prova comportamental dos passos em `run:` — " +
      "sem shell não há como observar o código final do passo, e afirmar sem medir é o que esta OS recusa"
    );

    const script = (corpo) => spawnSync("bash", ["-e", "-c", corpo], { stdio: "ignore", timeout: 60000 }).status;
    // Um comando que reprova com um código próprio, sem depender de binário
    // nenhum do sistema: o caminho do Node tem espaço no Windows, e um caminho
    // com espaço vira `command not found` (127) — que é vermelho pelo motivo
    // errado e provaria o contrário do que o caso diz provar.
    const falso = "(exit 3)";

    assert.equal(script(falso), 3, "o comando simples não propagou o próprio código");
    assert.equal(script(falso + ' || echo "seguimos"'), 0, "`|| echo` deixou de engolir a falha — a premissa da R5 caducou");
    assert.equal(script(falso + " | cat"), 0, "o cano deixou de trocar o código pelo do último estágio");
    assert.equal(script("set +e" + NL + falso + NL + "exit 0"), 0, "`set +e` com saída zero deixou de engolir a falha");

    // E a autoridade recusa exatamente as formas que o shell mostrou engolir.
    for (const composta of [' || echo "seguimos"', " | cat"]) {
      const veredito = CODIGO.comandoUnicoSimples("node ci/auditabilidade.js" + composta, {
        binario: "node", alvo: "ci/auditabilidade.js",
      });
      assert.ok(!veredito.ok, "a autoridade aceitou uma forma que o bash mostrou engolir: `" + composta + "`");
    }
  });
});

// ===========================================================================
// AS DUAS METADES — nenhuma responde sozinha pela própria presença
// ===========================================================================

test("SAI/CADEIA — a autoridade externa e esta suíte se prendem uma na outra", async (t) => {
  await t.test("SAI-21: esta suíte está no censo, e o censo é chamado daqui", () => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(OBRIGATORIAS, "codigo_de_saida.test.js"),
      "esta suíte saiu do censo — suíte fora do censo pode ser apagada sem reprovar"
    );
    const fonte = fs.readFileSync(__filename, "utf8");
    assert.match(fonte, /^conferirCenso\(\);$/m, "a chamada do censo saiu desta suíte");
  });

  await t.test("SAI-22: a autoridade externa é invocada pelo workflow E pelo `pretest`", () => {
    // As duas pontas do §3. Tirar a autoridade de um passo próprio deixa a
    // outra metade vermelha, e tirar a chamada do `pretest` também.
    exigeMotivo(
      GUARDIAO.conferirAuditabilidade({
        raiz: forjar([[WORKFLOW, TRECHOS.invocacaoDaPreservacao, ""]]),
      }),
      /INVOCAÇÃO AUSENTE.*preservação do código de saída/,
      "o passo próprio da autoridade saiu do workflow sem reprovar"
    );
    exigeMotivo(
      GUARDIAO.conferirCadeiaDoPretest(
        forjar([[
          "test/guarda_do_portao.js",
          "    ...conferirPreservacaoDoCodigo({ executar: true }),",
          "    // ...conferirPreservacaoDoCodigo({ executar: true }),",
        ]])
      ),
      /CHAMADA AUSENTE NO `pretest`.*código de saída/,
      "comentar a linha do `pretest` é a sabotagem mais barata que existe"
    );
  });

  await t.test("SAI-23: o passo próprio da autoridade também é comando único", () => {
    // Quem puder compor o passo que confere composição desliga a conferência
    // sem tocar em mais nada.
    assert.ok(
      CODIGO.PASSOS_DE_COMANDO_UNICO.some((e) => e.alvo === "ci/codigo_de_saida.js"),
      "a autoridade saiu da própria lista de comando único"
    );
    // A âncora e a substituição saem do arquivo, e nas duas pontas: o controle
    // `D28` da campanha troca a forma canônica deste passo por bloco escalar e
    // exige VERDE. Com um literal aqui, este caso morreria por âncora bem no
    // controle que existe para provar que a autoridade não virou veto geral.
    const daPreservacao = TRECHOS.runDaPreservacao;
    exigeMotivo(
      reprovacoesCom([[
        WORKFLOW, daPreservacao,
        comComandoTrocado(daPreservacao, partesDoRun(daPreservacao).comando + ' || echo "seguimos"'),
      ]]),
      /CÓDIGO DE SAÍDA NÃO PRESERVADO em `Preservação do código de saída`/,
      "o passo que confere composição pôde ser composto"
    );
  });
});
// ===========================================================================
// [OS 54-C7] O CONTEÚDO MATERIAL DOS CASOS NOMINAIS
// ===========================================================================
//
// A OS 54-C6 protegia o NOME e a FORMA de um caso nominal: título, posição,
// contagem de casos, contagem de afirmações. A OS 54-R6 mostrou que nada disso
// é o conteúdo — `SAI-02` tinha peso 1 porque concentra a afirmação num
// ajudante, e `assert.ok(true)` também dá 1. O caso continuava existindo,
// executando e APROVANDO, e a cadeia oficial ficava verde.
//
// O que se confere agora é o PROGRAMA do corpo, e em duas moradas que se
// vigiam:
//
//   * `ci/pisos_autorizados.js` — token e digest do corpo de HOJE contra a
//     declaração; roda no `pretest` e como PASSO PRÓPRIO do workflow;
//   * `test/piso_ancorado.js` — o mesmo programa contra o CORPO NO COMMIT
//     ANTERIOR, que nenhuma edição na árvore de trabalho alcança. É esta
//     segunda que faz o recarimbo — trivializar e atualizar peso e digest na
//     mesma alteração — continuar vermelho.

const NOMINAIS = require("../ci/pisos_autorizados.js");
const ANCORADO = require("./piso_ancorado.js");

/** Uma árvore mínima, com histórico próprio, para exercitar a autoridade
 *  ancorada: um repositório novo com UM commit da árvore ÍNTEGRA, feito ANTES
 *  da sabotagem. Sem histórico o piso ancorado reprova por falta de git, que é
 *  vermelho pelo motivo errado. */
function arvoreComHistorico() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "os54c7-ancora-"));
  for (const item of ["ci", "test"]) {
    fs.cpSync(path.join(RAIZ_REAL, item), path.join(dir, item), { recursive: true });
  }
  fs.copyFileSync(path.join(RAIZ_REAL, "package.json"), path.join(dir, "package.json"));
  const git = (...args) =>
    spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "user.email", "arnes@os54c7.local");
  git("config", "user.name", "arnes OS 54-C7");
  git("add", "-A");
  git("commit", "-q", "-m", "arvore integra (ancora do conteudo)");
  return dir;
}

/** Troca o corpo de um caso preservando título, posição e nome — que é
 *  exatamente o que a sabotagem faz. */
function trivializarCaso(dir, arquivo, caso, corpoNovo) {
  const alvo = path.join(dir, "test", arquivo);
  const bruto = fs.readFileSync(alvo, "utf8");
  const crlf = bruto.includes("\r\n");
  const texto = bruto.split("\r\n").join("\n");
  const marca = new RegExp('^[ \\t]*(?:await\\s+)?(?:t\\.)?test\\(\\s*"' + caso + ':[^"]*"', "m");
  const m = marca.exec(texto);
  assert.ok(m, "caso não encontrado para trivializar: " + caso);
  const inicio = m.index;
  const seguintes = [...texto.matchAll(/^[ \t]*(?:await\s+)?(?:t\.)?test\(\s*"([^"]+)"/gm)];
  const proximo = seguintes.find((x) => x.index > inicio);
  const fim = proximo ? proximo.index : texto.length;
  const cabeca = texto.slice(inicio, texto.indexOf("=> {", inicio) + 4);
  const recuo = /^[ \t]*/.exec(m[0])[0];
  const novo = texto.slice(0, inicio) + cabeca + NL + recuo + "  " + corpoNovo + NL +
    recuo + "});" + NL + NL + texto.slice(fim);
  assert.notEqual(novo, texto, "a trivialização de " + caso + " não alterou byte nenhum");
  fs.writeFileSync(alvo, crlf ? novo.split(NL).join("\r\n") : novo, "utf8");
}

/** Recarimba a tabela com o que os corpos de HOJE medem — o gesto de quem
 *  trivializa e atualiza a declaração na mesma alteração. */
function recarimbarTabela(dir) {
  const alvo = path.join(dir, "ci", "pisos_autorizados.js");
  const bruto = fs.readFileSync(alvo, "utf8");
  const crlf = bruto.includes("\r\n");
  let texto = bruto.split("\r\n").join("\n");
  for (const linha of NOMINAIS.medirNominais(dir)) {
    const m = /^(\S+) :: (\S+) :: peso (\d+) digest (\S+)$/.exec(linha);
    if (!m) continue;
    texto = texto.replace(
      new RegExp('"' + m[2] + '": Object\\.freeze\\(\\{ peso: \\d+, digest: "[0-9a-f]+" \\}\\)'),
      '"' + m[2] + '": Object.freeze({ peso: ' + m[3] + ', digest: "' + m[4] + '" })'
    );
  }
  fs.writeFileSync(alvo, crlf ? texto.split(NL).join("\r\n") : texto, "utf8");
}

test("SAI/CONTEÚDO — o corpo de um caso nominal não pode desaparecer", async (t) => {
  await t.test("SAI-24: a árvore REAL passa na autoridade de conteúdo", () => {
    // A trava anti-vácuo. Sem ela, uma autoridade que recusasse tudo passaria
    // em cada negativo abaixo e pareceria rigorosa estando quebrada.
    assert.deepEqual(NOMINAIS.conferirConteudoDosNominais(), []);
    const protegidos = Object.values(NOMINAIS.CONTEUDO_DOS_NOMINAIS)
      .reduce((total, mapa) => total + Object.keys(mapa).length, 0);
    assert.ok(protegidos >= 10, "a proteção encolheu para " + protegidos + " caso(s)");
  });

  await t.test("SAI-25: os DEZ casos protegidos morrem se o corpo for trivializado", () => {
    // Um a um, e não em bloco: uma trivialização coletiva poderia ser pega por
    // um efeito colateral qualquer, e o que se afirma aqui é que CADA caso
    // sobrevive por conta própria.
    for (const [arquivo, casos] of Object.entries(NOMINAIS.CONTEUDO_DOS_NOMINAIS)) {
      for (const caso of Object.keys(casos)) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "os54c7-triv-"));
        try {
          fs.mkdirSync(path.join(dir, "test"), { recursive: true });
          fs.mkdirSync(path.join(dir, "ci"), { recursive: true });
          fs.copyFileSync(
            path.join(RAIZ_REAL, "test", arquivo), path.join(dir, "test", arquivo)
          );
          fs.copyFileSync(
            path.join(RAIZ_REAL, "ci", "pisos_autorizados.js"),
            path.join(dir, "ci", "pisos_autorizados.js")
          );
          for (const outro of Object.keys(NOMINAIS.CONTEUDO_DOS_NOMINAIS)) {
            if (outro === arquivo) continue;
            fs.copyFileSync(path.join(RAIZ_REAL, "test", outro), path.join(dir, "test", outro));
          }
          trivializarCaso(dir, arquivo, caso, "assert.ok(true);");
          exigeMotivo(
            NOMINAIS.conferirConteudoDosNominais(dir),
            new RegExp("CONTEÚDO DO CASO NOMINAL DIVERGE: `" + caso + "`"),
            "`" + caso + "` foi trivializado com o título preservado e a autoridade aprovou"
          );
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    }
  });

  await t.test("SAI-26: esconder o corpo em STRING ou em COMENTÁRIO colapsa o peso", () => {
    // As duas formas que preservariam o TAMANHO BRUTO do arquivo e o número de
    // linhas, e que a §11 da OS manda não aceitar como prova de conteúdo.
    const real = 'const x = reprovacoesCom([[WORKFLOW, alvo, linha]]); assert.ok(x.length > 0);';
    const emString = 'const x = "const x = reprovacoesCom([[WORKFLOW, alvo, linha]]); assert.ok(x.length > 0);";';
    const emComentario = "// " + real + NL + "assert.ok(true);";
    assert.ok(
      NOMINAIS.pesoMaterial(real) > 3 * NOMINAIS.pesoMaterial(emString),
      "o corpo dentro de uma string não colapsou o peso"
    );
    assert.ok(
      NOMINAIS.pesoMaterial(real) > 3 * NOMINAIS.pesoMaterial(emComentario),
      "o corpo dentro de um comentário não colapsou o peso"
    );
    // E o digest não perdoa nenhuma das duas.
    assert.notEqual(NOMINAIS.digestDoCorpo(real), NOMINAIS.digestDoCorpo(emString));
    assert.notEqual(NOMINAIS.digestDoCorpo(real), NOMINAIS.digestDoCorpo(emComentario));
  });

  await t.test("SAI-27: o leitor não se perde em expressão regular nem em `test(` citado", () => {
    // As duas armadilhas do tokenizador, e as duas custaram medição:
    //
    // 1. uma expressão regular que contém aspas ou crase — e esta suíte tem
    //    várias — abriria uma string fantasma e engoliria o resto do corpo;
    // 2. um `test(` dentro de uma string abriria um caso fantasma e o recorte
    //    do caso anterior terminaria cedo. A §3 da OS proíbe, em voz alta,
    //    vermelho vindo de coincidência de `test(` em string.
    const comRegex = 'assert.match(m, /VEREDITO `run` "x"/); const depois = 1 + 2;';
    const tokens = NOMINAIS.tokensDoPrograma(comRegex);
    assert.ok(tokens.includes("depois"), "o corpo depois da expressão regular foi engolido: " + tokens.join(" "));

    const comTestCitado = 'const s = "await t.test(\\"SAI-99: isca\\", () => {});" ; assert.ok(s);';
    const corpos = NOMINAIS.corposDosCasos(
      'await t.test("SAI-98: real", () => {' + NL + "  " + comTestCitado + NL + "});" + NL
    );
    assert.deepEqual([...corpos.keys()], ["SAI-98"], "um `test(` citado em string abriu caso fantasma");
  });

  await t.test("SAI-28: reformatar e reescrever a PROSA não move o conteúdo", () => {
    // O contraste que impede a autoridade de virar veto geral: comentário e
    // espaço em branco não são conteúdo, e mexer neles não pode custar uma
    // redeclaração. Vermelho pelo motivo errado é tão cego quanto verde
    // indevido.
    const antes = "assert.ok(x);" + NL + "assert.equal(y, 1);";
    const depois = "// uma explicação nova" + NL + "assert.ok(x);" + NL + NL +
      "  /* e outra */  assert.equal(y,   1);";
    assert.equal(NOMINAIS.digestDoCorpo(antes), NOMINAIS.digestDoCorpo(depois));
    assert.equal(NOMINAIS.pesoMaterial(antes), NOMINAIS.pesoMaterial(depois));
  });

  await t.test("SAI-29: trivializar E RECARIMBAR continua vermelho", () => {
    // O gesto que a §11 da OS chama pelo nome: a fonte que protege os casos não
    // pode ser recarimbada na mesma alteração mantendo o CI verde. Quem faz
    // isso passa pela autoridade de conteúdo — a declaração volta a bater com o
    // corpo — e esbarra no CORPO DO COMMIT ANTERIOR, que não se edita.
    const dir = arvoreComHistorico();
    try {
      trivializarCaso(dir, "codigo_de_saida.test.js", "SAI-02", "assert.ok(true);");
      recarimbarTabela(dir);
      // A conferência tem de vir do módulo DAQUELA árvore, e não deste: a
      // declaração mora no arquivo recarimbado, e usar o módulo daqui mediria a
      // tabela errada — o caso passaria pelo motivo errado.
      const daArvore = require(path.join(dir, "ci", "pisos_autorizados.js"));
      assert.deepEqual(
        daArvore.conferirConteudoDosNominais(dir), [],
        "o recarimbo deveria ter reconciliado a declaração com o corpo — sem isso este caso mede outra coisa"
      );
      assert.throws(
        () => ANCORADO.conferirPisoAncorado(dir),
        /CASO NOMINAL TRIVIALIZADO|PESO MATERIAL DECLARADO REBAIXADO/,
        "trivializar e recarimbar na mesma alteração passou pela autoridade ancorada"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("SAI-30: as duas metades estão presas uma na outra", () => {
    // `ci/pisos_autorizados.js` sob a autoridade ancorada (a §2 da OS), a
    // chamada no `pretest` (a §1) e o passo próprio no workflow.
    assert.ok(
      Object.prototype.hasOwnProperty.call(ANCORADO.ARQUIVOS_DA_AUTORIDADE, "ci/pisos_autorizados.js"),
      "a fonte dos pisos e do conteúdo saiu da autoridade ancorada — voltaria a ser um arquivo editável"
    );
    const guarda = fs.readFileSync(path.join(RAIZ_REAL, "test", "guarda_do_portao.js"), "utf8");
    assert.match(
      guarda.split(NL).filter((l) => !/^\s*\/\//.test(l)).join(NL),
      /conferirConteudoDosNominais\s*\(/,
      "a chamada do conteúdo nominal saiu do `pretest`"
    );
    exigeMotivo(
      reprovacoesCom([[
        WORKFLOW, TRECHOS.runDoConteudoNominal,
        '        run: node ci/pisos_autorizados.js || echo "seguimos"',
      ]]),
      /CÓDIGO DE SAÍDA NÃO PRESERVADO em `Conteúdo dos casos nominais`/,
      "o passo da autoridade de conteúdo pôde ser composto"
    );
  });
});
