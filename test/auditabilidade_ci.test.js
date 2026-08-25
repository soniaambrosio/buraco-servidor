// test/auditabilidade_ci.test.js — A SUÍTE PRÓPRIA DO GUARDIÃO (OS 54-C4, §5).
//
// ===========================================================================
// O QUE ESTA SUÍTE É, E O QUE ELA NÃO É
// ===========================================================================
//
// `ci/auditabilidade.js` é a autoridade sobre o rastro do run. Ele roda em dois
// lugares — no `pretest` de todo `npm test` e como passo próprio do CI —, e é
// por isso que apagar CI-18, CI-19 e CI-19b da outra suíte deixou de bastar.
//
// Mas autoridade também pode ser esvaziada. Um `conferirAuditabilidade` que
// devolvesse `[]` sem olhar nada continuaria verde nos dois lugares, para
// sempre, e ninguém notaria. É esta suíte que fecha esse buraco: cada regra do
// guardião é EXERCITADA contra uma árvore forjada, sabotada num ponto só, e o
// guardião tem de reprovar — pelo motivo certo, não por qualquer motivo.
//
// E o controle: a árvore ÍNTEGRA tem de PASSAR. Sem ele, um guardião que
// reprovasse tudo satisfaria todos os casos negativos e pareceria rigoroso
// enquanto estava apenas quebrado.
//
// [OS 54-C4] E A COMPOSIÇÃO ENTROU NA MEDIDA. Esta árvore tem duas famílias
// vivas — a auditabilidade externa e a AUTORIDADE DO ARTEFATO PRODUTIVO ÚNICO
// da OS 52-C4 —, e as duas dependem dos mesmos dois endereços: o workflow e o
// `pretest`. AUD-18 e AUD-19 são os casos que cobram isso: tirar o passo do
// artefato do CI, ou a chamada dele da etapa `pretest`, reprova no guardião.
// Sem eles a composição teria exatamente o buraco que esta OS existe para
// fechar — metade desligada usando a outra metade como cobertura.
//
// QUEM GUARDA ESTA SUÍTE. Ela está em `OBRIGATORIAS` (censo), no alcance
// obrigatório do glob e no inventário por execução: apagá-la faz
// `ci/inventario_de_execucao.js` reprovar por suíte que não executou, e o piso
// global do juiz cair. A cadeia não fecha em círculo — cada peça é vigiada por
// uma que não mora nela.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { conferirCenso } = require("./censo_de_suites.js");
const { forjar, TRECHOS, trechoDoPasso, forjarComPretest } = require("./arvore_forjada.js");
const GUARDIAO = require("../ci/auditabilidade.js");

/** Roda o guardião contra uma árvore forjada com UMA sabotagem. */
function reprovacoesCom(edicoes) {
  return GUARDIAO.conferirAuditabilidade({ raiz: forjar(edicoes) });
}

function exigeMotivo(reprovacoes, padrao, oQue) {
  assert.ok(
    reprovacoes.some((m) => padrao.test(m)),
    oQue + " — o guardião devolveu: " + JSON.stringify(reprovacoes)
  );
}

const WORKFLOW = ".github/workflows/provas-do-servidor.yml";

test("AUD/CONTROLE — a árvore íntegra passa", async (t) => {
  await t.test("AUD-00: sem sabotagem, o guardião aprova", () => {
    // A trava anti-vácuo de toda a suíte. Se este caso cair, os outros deixam
    // de significar qualquer coisa.
    assert.deepEqual(reprovacoesCom([]), []);
  });

  await t.test("AUD-00b: e aprova a árvore REAL, não só a cópia", () => {
    assert.deepEqual(GUARDIAO.conferirAuditabilidade({}), []);
    conferirCenso();
  });
});

test("AUD/ARTEFATO — o que é arquivado, e se é arquivado", async (t) => {
  await t.test("AUD-01: upload removido reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.uploadInteiro, ""]]),
      /ARTEFATO: o passo de upload/,
      "o upload sumiu e o guardião não viu"
    );
  });

  await t.test("AUD-02: upload condicionado a sucesso reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.uploadCabecalho, "      - name: Evidência arquivada\n        if: success()"]]),
      /ARTEFATO SEM `always\(\)`/,
      "condição comum desligaria o upload justamente no run que interessa"
    );
  });

  await t.test("AUD-03: upload sem nome reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.uploadNome, ""]]),
      /ARTEFATO SEM NOME/,
      "artefato anônimo não é achável"
    );
  });

  await t.test("AUD-04: `if-no-files-found` afrouxado para `warn` reprova", () => {
    // A diferença entre `error` e `warn` é a diferença entre "o rastro sumiu" e
    // "o rastro sumiu e o job ficou verde".
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.uploadVazio, "          if-no-files-found: warn"]]),
      /ARTEFATO PODE SUBIR VAZIO/,
      "upload vazio passaria por rastro"
    );
  });

  await t.test("AUD-05: artefato apontando para outro caminho reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.uploadCaminho, "          path: /tmp/outro-lugar/"]]),
      /ARTEFATO FORA DO ALVO/,
      "o que é guardado deixou de ser o que foi julgado"
    );
  });
});

test("AUD/RESUMO — o painel do run", async (t) => {
  await t.test("AUD-06: resumo removido reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, trechoDoPasso("--resumo"), ""]]),
      /RESUMO: o passo tem de existir/,
      "o painel deixaria de existir"
    );
  });

  await t.test("AUD-07: resumo condicionado a sucesso reprova", () => {
    exigeMotivo(
      reprovacoesCom([
        [WORKFLOW, TRECHOS.resumoCabecalho, "      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: success()"],
      ]),
      /RESUMO SEM `always\(\)`/,
      "resumo só em sucesso descreve os runs que ninguém precisa ler"
    );
  });

  await t.test("AUD-08: resumo por `echo` estático reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.resumoChamada, 'echo "--resumo tudo certo"']]),
      /RESUMO NÃO VEM DO JUIZ/,
      "texto à mão descreve intenção, não a corrida"
    );
  });

  await t.test("AUD-09: `>>` trocado por `>` reprova, e some do painel também", () => {
    const truncando = reprovacoesCom([
      [WORKFLOW, TRECHOS.resumoRedirecionamento, '> "$GITHUB_STEP_SUMMARY"'],
    ]);
    exigeMotivo(truncando, /RESUMO TRUNCA O PAINEL/, "truncar apagaria o que outros passos escreveram");

    const semEscrita = reprovacoesCom([[WORKFLOW, TRECHOS.resumoRedirecionamento, ""]]);
    exigeMotivo(semEscrita, /RESUMO NÃO É ESCRITO NO PAINEL/, "calculado e jogado fora não é auditabilidade");
  });

  await t.test("AUD-10: gerador de resumo esvaziado reprova, com o passo intacto", () => {
    // A sabotagem mais silenciosa da família: o YAML continua perfeito, o passo
    // roda, e o painel sai em branco.
    exigeMotivo(
      reprovacoesCom([
        ["ci/portao_do_ci.js", "function resumo(veredito, desfecho) {", 'function resumo(veredito, desfecho) {\n  if (true) return "";'],
      ]),
      /GERADOR DE RESUMO ESVAZIADO|RESUMO NÃO NOMEIA/,
      "o passo continuaria verde publicando nada"
    );
  });
});

test("AUD/CADEIA — o guardião confere o próprio endereço", async (t) => {
  await t.test("AUD-11: invocação do GUARDIÃO removida do workflow reprova", () => {
    // Quem percebe que o guardião saiu do CI é o próprio guardião, rodando pelo
    // outro caminho — o `pretest`. É a única peça que pode: um verificador que
    // não é chamado não tem como reclamar de dentro do run que não aconteceu.
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.invocacaoGuardiao, ""]]),
      /INVOCAÇÃO AUSENTE.*guardião/,
      "o guardião sairia da cadeia oficial em silêncio"
    );
  });

  await t.test("AUD-12: invocação do INVENTÁRIO removida do workflow reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.invocacaoInventario, ""]]),
      /INVOCAÇÃO AUSENTE.*inventário/,
      "a autoridade de quantidade sairia da cadeia oficial"
    );
  });

  await t.test("AUD-13: invocação condicionada ou tolerada reprova", () => {
    exigeMotivo(
      reprovacoesCom([
        [WORKFLOW, "      - name: Guardião da auditabilidade\n        run:", "      - name: Guardião da auditabilidade\n        if: false\n        run:"],
      ]),
      /INVOCAÇÃO CONDICIONADA/,
      "condicionar é desligar sem apagar"
    );
    exigeMotivo(
      reprovacoesCom([
        [WORKFLOW, "      - name: Inventário por execução\n        run:", "      - name: Inventário por execução\n        continue-on-error: true\n        run:"],
      ]),
      /INVOCAÇÃO TOLERADA/,
      "tolerar o erro é não depender do resultado"
    );
  });

  await t.test("AUD-14: workflow inteiro apagado reprova", () => {
    const dir = forjar([]);
    require("node:fs").rmSync(require("node:path").join(dir, WORKFLOW));
    exigeMotivo(
      GUARDIAO.conferirAuditabilidade({ raiz: dir }),
      /WORKFLOW AUSENTE/,
      "sem workflow não há run, e ausência nunca é aprovação"
    );
  });

  await t.test("AUD-15: comentar as invocações não engana o guardião", () => {
    // Os comentários são recortados antes de medir. Prova textual que não
    // separa código de prosa mede a prosa — foi assim que a R2 derrubou o
    // contador de casos da C1.
    exigeMotivo(
      reprovacoesCom([
        [WORKFLOW, "        run: node ci/auditabilidade.js", "        run: echo ok # node ci/auditabilidade.js"],
      ]),
      /INVOCAÇÃO AUSENTE.*guardião/,
      "nome em comentário não executa"
    );
  });

  await t.test("AUD-16: a cadeia do `pretest` é conferida, chamada por chamada", () => {
    // O buraco simétrico ao da R2: as chamadas do `pretest` podiam ser
    // comentadas uma a uma, e cada remoção parecia inofensiva porque as OUTRAS
    // peças ainda cobriam. Cobertura por acaso não é proteção — e é esta
    // leitura que permite dizer, com prova, que a chamada de `conferirCenso`
    // de dentro das suítes virou defesa REDUNDANTE: a obrigatória é a de fora.
    for (const [oQue, alvo] of [
      ["conferirCenso", "  conferirCenso();"],
      ["conferirAuditabilidade", "    ...conferirAuditabilidade({}),"],
      ["conferirPisosDeclarados", "    ...conferirPisosDeclarados(OBRIGATORIAS),"],
    ]) {
      exigeMotivo(
        GUARDIAO.conferirCadeiaDoPretest(forjarComPretest(alvo, "  // " + alvo.trim())),
        /CHAMADA AUSENTE NO/,
        "comentar " + oQue + " no pretest passou"
      );
    }
    assert.deepEqual(GUARDIAO.conferirCadeiaDoPretest(require("node:path").join(__dirname, "..")), []);
  });

  await t.test("AUD-17: a etapa do manifesto removida reprova", () => {
    const dir = forjarComPretest(null, null, true);
    exigeMotivo(GUARDIAO.conferirCadeiaDoPretest(dir), /PRETEST AUSENTE/, "o manifesto perdeu a etapa e nada reclamou");
  });
});

// ===========================================================================
// [OS 54-C4] A COMPOSIÇÃO — a outra família não pode sair pela porta de trás.
//
// A OS 52-C4 pôs a autoridade do ARTEFATO PRODUTIVO ÚNICO em dois endereços: um
// passo próprio do workflow e a chamada de `exigirArtefatoUnico(...)` no
// `pretest`. São exatamente os dois endereços da auditabilidade externa.
//
// Uma composição que deixasse o guardião olhar só o próprio lado devolveria o
// pior dos mundos: a metade auditável verde, gritando que tudo está no lugar,
// enquanto a autoridade do artefato tinha saído da cadeia oficial com uma
// edição de duas linhas. As campanhas de origem não veem isso — cada uma mede
// a própria família.
// ===========================================================================
test("AUD/COMPOSIÇÃO — a autoridade do artefato continua na cadeia", async (t) => {
  await t.test("AUD-18: passo do ARTEFATO removido do workflow reprova", () => {
    exigeMotivo(
      reprovacoesCom([[WORKFLOW, TRECHOS.invocacaoArtefato, ""]]),
      /INVOCAÇÃO AUSENTE.*artefato produtivo/,
      "a autoridade que decide o que pode ser implantado sairia do CI em silêncio"
    );
  });

  await t.test("AUD-18b: passo do ARTEFATO condicionado ou tolerado reprova", () => {
    exigeMotivo(
      reprovacoesCom([
        [WORKFLOW, "      - name: Artefato produtivo único\n        run:", "      - name: Artefato produtivo único\n        if: false\n        run:"],
      ]),
      /INVOCAÇÃO CONDICIONADA/,
      "condicionar o passo do artefato é desligá-lo sem apagar"
    );
    exigeMotivo(
      reprovacoesCom([
        [WORKFLOW, "      - name: Artefato produtivo único\n        run:", "      - name: Artefato produtivo único\n        continue-on-error: true\n        run:"],
      ]),
      /INVOCAÇÃO TOLERADA/,
      "o job deixaria de depender do que o artefato disse"
    );
  });

  await t.test("AUD-19: chamada do ARTEFATO removida do `pretest` reprova", () => {
    exigeMotivo(
      GUARDIAO.conferirCadeiaDoPretest(
        forjarComPretest("  const artefato = exigirArtefatoUnico();", "  // const artefato = exigirArtefatoUnico();")
      ),
      /CHAMADA AUSENTE NO `pretest`.*artefato produtivo/,
      "a autoridade do artefato sairia da etapa oficial com uma linha comentada"
    );
  });

  await t.test("AUD-20: as duas famílias estão na MESMA lista de invocações", () => {
    // Sem esta afirmação, alguém poderia remover a entrada do artefato de
    // `INVOCACOES_OBRIGATORIAS` e AUD-18 passaria a medir nada — a sabotagem
    // sairia do alcance do caso que a persegue, em vez de ser detectada por ele.
    const oQues = GUARDIAO.INVOCACOES_OBRIGATORIAS.map(([oQue]) => oQue).join(" | ");
    for (const exigido of ["juiz", "guardião", "inventário", "artefato produtivo"]) {
      assert.ok(
        oQues.includes(exigido),
        "`INVOCACOES_OBRIGATORIAS` deixou de cobrar " + exigido + ": " + oQues
      );
    }
    const chamadas = GUARDIAO.CHAMADAS_DO_PRETEST.map(([oQue]) => oQue).join(" | ");
    assert.ok(
      chamadas.includes("artefato produtivo"),
      "`CHAMADAS_DO_PRETEST` deixou de cobrar a autoridade do artefato: " + chamadas
    );
  });
});
