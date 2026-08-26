// test/ci_obrigatorio.test.js — A METADE DE DENTRO DO CI OBRIGATÓRIO (OS 54).
//
// POR QUE UMA SUÍTE GUARDA UM WORKFLOW.
//
// O workflow `.github/workflows/provas-do-servidor.yml` roda o portão deste
// repositório em todo push. Ele resolve a obrigação — mas não consegue guardar
// a si mesmo: quem edita o YAML edita também o que o YAML afirma. Apagar o
// passo das provas, comentá-lo, trocá-lo por um `echo`, desviar o alvo para uma
// suíte-isca, tirar o gatilho, tirar o checkout, rebaixar o piso — todas essas
// sabotagens deixam o job VERDE, porque um workflow adulterado executa
// exatamente o que passou a dizer.
//
// A simétrica também é verdadeira: uma suíte não consegue se obrigar a rodar.
// Por isso as duas metades. O YAML obriga a suíte a rodar; a suíte lê o YAML e
// reprova quem o desliga. Nenhuma das duas fecha sozinha, e é essa reciprocidade
// — a mesma que o censo da OS 44 construiu para o glob — que faz o conjunto ser
// um portão em vez de uma intenção.
//
// E ESTA SUÍTE, QUEM GUARDA? O censo. Ela está registrada em `OBRIGATORIAS`
// dentro de `test/censo_de_suites.js`, que é chamado pelas três suítes
// recíprocas: apagá-la, renomeá-la para fora do glob `test/*.test.js` ou
// esvaziá-la deixa as OUTRAS vermelhas, nomeando o arquivo que sumiu. Guarda
// que não sobrevive à própria remoção não é guarda — a OS 44 pagou por isso.
//
// O QUE ELA NÃO FAZ. Não roda o workflow, não fala com o GitHub, não conhece
// assento, ingresso, presença nem chat, e não é um segundo portão: o portão
// continua sendo `npm test`, e este arquivo é um caso dentro dele. Também não
// duplica o censo nem a unicidade da OS 52 — CI-16 apenas confirma que o
// caminho obrigatório continua alcançando as duas.
//
// LEITURA TEXTUAL, COM OS COMENTÁRIOS RECORTADOS ANTES DE MEDIR. Comentar uma
// linha é a sabotagem mais barata que existe, e prova textual que não separa
// código de comentário mede a prosa, não o programa. O recorte tem trava
// anti-vácuo: se a limpeza comer o arquivo, a leitura reprova em vez de passar
// por vacuidade.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { conferirCenso } = require("./censo_de_suites.js");
const PORTAO = require("../ci/portao_do_ci.js");
const GUARDIAO = require("../ci/auditabilidade.js");
const { forjar, TRECHOS, trechoDoPasso } = require("./arvore_forjada.js");

const RAIZ = path.join(__dirname, "..");
const CAMINHO_DO_WORKFLOW = path.join(RAIZ, ".github", "workflows", "provas-do-servidor.yml");
const CAMINHO_DO_PORTAO = path.join(RAIZ, "ci", "portao_do_ci.js");
const CAMINHO_DO_PISO = path.join(RAIZ, "ci", "piso_do_portao.json");

/** O PISO DO PISO, MEDIDO — e a correção de um comentário que mentia.
 *
 *  A versão da OS 54 dizia "682 casos vieram da base `750a012`". Não era o que
 *  os números diziam: `750a012` media 682, a OS 52-C2 subiu para 734, e o
 *  comentário continuou falando de 682 como se fosse a origem dos 734. A
 *  OS 52-R2 registrou isso como residual, e comentário errado num arquivo de
 *  guarda é pior que comentário nenhum: ele é lido como medição.
 *
 *  O histórico REAL desta linhagem, medido com `npm test` em cada ponta:
 *    `913611a` → 646 casos / 75 suítes
 *    `750a012` → 682 casos / 75 suítes  (a OS 54 acrescentou a suíte do CI)
 *    `4577048` → 734 casos / 80 suítes  (OS 52-C2, unicidade por capacidade)
 *    `99d2eb6` → 786 casos / 83 suítes  (OS 52-C3, capacidade composta)
 *    `9795df7` → 814 casos / 87 suítes  (OS 52-C4, autoridade do artefato)
 *    `0f65655` → 883 casos / 87 suítes  (OS 54-C4, auditabilidade externa)
 *    OS 54-C5 → 927 casos / 87 suítes  (invocação EXECUTÁVEL, não textual)
 *
 *  [OS 54-C5] 927 é 883 + 44. A OS 54-R4 mostrou que `echo node …` desligava
 *  as quatro autoridades com o portão VERDE — presença de texto contava como
 *  execução. Os doze casos novos do guardião e a suíte da autoridade das
 *  invocações são o que fecha isso, e é por isso que o número sobe.
 *
 *    (a auditabilidade externa PORTADA
 *                                       sobre a autoridade do artefato único)
 *
 *  [OS 54-C4] 883 NÃO É 848. A folha da OS 54-C3 mediu 848 casos sobre
 *  `99d2eb6`, uma árvore que não tinha a suíte do artefato produtivo; esta
 *  nasce de `9795df7` e a auditabilidade foi RECOMPOSTA, com casos que não
 *  existiam em folha nenhuma (CI-20d, AUD-18..20, INV-15). Piso herdado de uma
 *  das metades deixaria a outra encolher sem reprovar.
 *
 *  Escrito aqui, FORA do arquivo de piso e FORA do portão, de propósito: se o
 *  único lugar que conhecesse os números fosse `ci/piso_do_portao.json`, baixá-
 *  los seria uma edição silenciosa de uma linha.
 *
 *  [OS 52-C3] E ISTO DEIXOU DE SER A ÚLTIMA DEFESA. A R2 apagou ESTA suíte no
 *  encolhimento coordenado, e com ela foi-se o piso do piso — autoridade que
 *  mora dentro do alvo não é autoridade. Quem sustenta o piso agora é
 *  `test/piso_ancorado.js`, que compara com o COMMIT ANTERIOR; estes números
 *  continuam aqui como a segunda leitura, e CI-23 os mantém em dia. */
const CASOS_MEDIDOS_NA_BASE = 927;
const SUITES_MEDIDAS_NA_BASE = 87;

/** O ambiente homologado, escrito por extenso porque "manter" é uma afirmação
 *  que alguém tem de verificar. Subir é livre; descer é vermelho. */
const NODE_HOMOLOGADO = 24;
const TIMEOUT_DECLARADO = 20;

/** Recorta comentários de YAML e trava contra o próprio recorte. */
function yamlSemComentarios(bruto) {
  const texto = bruto
    .split("\r\n").join("\n")
    .split("\n")
    .map((linha) => linha.replace(/(^|\s)#.*$/, "$1"))
    .join("\n");
  assert.ok(
    /runs-on:/.test(texto),
    "a limpeza de comentários comeu o workflow — leitura inválida, não aprovação"
  );
  return texto;
}

function lerWorkflow() {
  assert.ok(
    fs.existsSync(CAMINHO_DO_WORKFLOW),
    "o workflow obrigatório sumiu: .github/workflows/provas-do-servidor.yml"
  );
  return yamlSemComentarios(fs.readFileSync(CAMINHO_DO_WORKFLOW, "utf8"));
}

/** Separa os passos do job. Um `if:` só importa no passo a que pertence, e
 *  medir o arquivo inteiro confundiria o `if: always()` legítimo do resumo com
 *  um `if:` plantado no passo do veredito — que é a sabotagem de verdade. */
function passosDo(texto) {
  const linhas = texto.split("\n");
  const passos = [];
  let atual = null;
  for (const linha of linhas) {
    if (/^\s{4,}-\s+name:/.test(linha)) {
      if (atual) passos.push(atual);
      atual = { nome: linha.replace(/^\s*-\s+name:\s*/, "").trim(), corpo: linha + "\n" };
    } else if (atual) {
      atual.corpo += linha + "\n";
    }
  }
  if (atual) passos.push(atual);
  return passos;
}

test("CI/WORKFLOW — o CI externo existe, dispara sozinho e roda o alvo oficial", async (t) => {
  const texto = lerWorkflow();

  await t.test("CI-01: o workflow está no caminho que o GitHub lê, e tem job", () => {
    assert.match(texto, /^name:\s*\S/m, "o workflow não tem nome");
    assert.match(texto, /^jobs:\s*$/m, "o workflow não declara `jobs:`");
    assert.match(texto, /^\s+runs-on:\s*ubuntu-[a-z0-9.]+\s*$/m, "o job não declara um runner");
  });

  await t.test("CI-02: o gatilho existe e alcança QUALQUER branch", () => {
    // Sem isto, a sabotagem mais barata do conjunto é restringir `branches:` a
    // uma branch que ninguém usa: o arquivo continua lá, íntegro, e nunca roda.
    assert.match(texto, /^on:\s*$/m, "o workflow perdeu o bloco `on:` — deixou de disparar");
    assert.match(texto, /^\s+push:\s*$/m, "o gatilho de `push` sumiu");
    assert.match(
      texto,
      /^\s+branches:\s*\[\s*'\*\*'\s*\]\s*$/m,
      "o `push` deixou de cobrir todas as branches — o CI não dispara onde o trabalho acontece"
    );
    assert.match(texto, /^\s+workflow_dispatch:\s*$/m, "o disparo manual sumiu");
  });

  await t.test("CI-03: o ALVO OFICIAL é executado, e a saída inteira vira evidência", () => {
    // Mata as quatro sabotagens da mesma família: passo removido, passo
    // comentado (os comentários já foram recortados), comando trocado por
    // `echo` e alvo desviado para arquivo-isca. Nenhuma delas deixa esta linha
    // literal de pé.
    assert.match(
      texto,
      /^\s*npm test\s*>\s*"\$EVIDENCIA\/npm-test\.txt"\s+2>&1\s*$/m,
      "o comando oficial `npm test` não é executado pelo workflow"
    );
    assert.ok(
      !/^\s*node\s+--test\s+(?!")/m.test(texto),
      "o workflow chama `node --test` direto — o alvo é `npm test`, e desviar dele tira o glob do caminho"
    );
  });

  await t.test("CI-04: nada de `continue-on-error` — falha do passo é falha do job", () => {
    assert.ok(
      !/continue-on-error/.test(texto),
      "`continue-on-error` no workflow: o job deixaria de depender do resultado das provas"
    );
  });

  await t.test("CI-05: o código de saída é capturado, e não engolido", () => {
    assert.ok(!/\|\|\s*true/.test(texto), "`|| true` no workflow engole a falha do comando");
    assert.ok(!/\|\|\s*exit\s+0/.test(texto), "`|| exit 0` no workflow engole a falha do comando");
    assert.ok(!/\|\|\s*:/.test(texto), "`|| :` no workflow engole a falha do comando");
    // `set +e` é legítimo ali — mas só porque o código de saída é gravado logo
    // depois. Sem o marcador, `set +e` seria exatamente o `|| true` acima.
    assert.match(texto, /^\s*codigo=\$\?\s*$/m, "o código de saída do `npm test` não é capturado");
    assert.match(
      texto,
      /^\s*printf\s+'%s'\s+"\$codigo"\s*>\s*"\$EVIDENCIA\/exit\.txt"\s*$/m,
      "o marcador de desfecho `evidencia/exit.txt` não é gravado — sem ele, cancelamento vira silêncio"
    );
  });

  await t.test("CI-05b: o lugar da evidência é declarado UMA vez", () => {
    // Uma segunda declaração — no passo do veredito, por exemplo — apontaria o
    // portão para um lugar diferente do que as provas escreveram, e é assim
    // que se troca a evidência sem tocar em comando nenhum.
    //
    // A declaração vive num passo, e não no `env:` do job, porque o contexto
    // `runner` só existe a partir dos passos: no job, o workflow falha na
    // VALIDAÇÃO e não chega a criar job. Medido no provedor, não deduzido —
    // o run 32774431823 terminou `failure` com zero jobs por causa disso.
    const declaracoes = texto.split("\n").filter((l) => /EVIDENCIA=\S/.test(l));
    assert.equal(
      declaracoes.length, 1,
      "o caminho da evidência tem de ser declarado exatamente uma vez (encontradas: " +
        declaracoes.length + ")"
    );
    assert.match(
      declaracoes[0],
      /\$RUNNER_TEMP/,
      "a evidência voltou para dentro da árvore — ela entraria na varredura de unicidade da OS 52 enquanto a suíte ainda roda"
    );
    assert.match(
      texto,
      /^\s*run:\s*echo\s+"EVIDENCIA=\$RUNNER_TEMP\/evidencia"\s*>>\s*"\$GITHUB_ENV"\s*$/m,
      "o passo que declara o lugar da evidência sumiu — sem ele o portão procuraria a evidência na raiz do disco"
    );
  });

  await t.test("CI-06: o veredito é um passo próprio, incondicional e não rebaixado", () => {
    const chamada = /node\s+ci\/portao_do_ci\.js\s+"\$EVIDENCIA\/npm-test\.txt"\s+"\$EVIDENCIA\/exit\.txt"/;
    assert.match(texto, chamada, "o portão fail-closed não é chamado pelo workflow");

    const passos = passosDo(texto);
    const doVeredito = passos.filter((p) => chamada.test(p.corpo) && !/--resumo/.test(p.corpo));
    assert.equal(
      doVeredito.length, 1,
      "o passo do veredito tem de existir exatamente uma vez (encontrados: " + doVeredito.length + ")"
    );
    assert.ok(
      !/^\s+if:/m.test(doVeredito[0].corpo),
      "o passo do veredito ganhou um `if:` — condicionar o portão é desligá-lo sem apagá-lo"
    );
    assert.ok(fs.existsSync(CAMINHO_DO_PORTAO), "`ci/portao_do_ci.js` sumiu — o veredito ficou sem juiz");
  });

  await t.test("CI-07: permissão de leitura, e só", () => {
    assert.match(texto, /^permissions:\s*$/m, "o workflow não declara `permissions:`");
    assert.match(texto, /^\s+contents:\s*read\s*$/m, "o workflow não se limita a ler o repositório");
    assert.ok(!/:\s*write\s*$/m.test(texto), "o workflow pede permissão de ESCRITA — o portão só precisa ler");
  });

  await t.test("CI-08: nenhum segredo", () => {
    assert.ok(
      !/secrets\./.test(texto),
      "o workflow usa `secrets.` — as provas do servidor não dependem de credencial nenhuma, e depender seria um caminho novo de falha"
    );
  });

  await t.test("CI-09: o job tem limite de tempo, e ele não desce", () => {
    const m = /^\s+timeout-minutes:\s*([0-9]+)\s*$/m.exec(texto);
    assert.ok(m, "o job não declara `timeout-minutes` — execução pendurada não é vermelha nem verde");
    assert.ok(
      Number(m[1]) >= TIMEOUT_DECLARADO,
      "`timeout-minutes` caiu para " + m[1] + ", abaixo dos " + TIMEOUT_DECLARADO +
        " homologados — limite curto demais mata a corrida antes do rodapé, e o que sobra é evidência truncada"
    );
  });

  await t.test("CI-10: o checkout é íntegro", () => {
    assert.match(
      texto,
      /uses:\s*actions\/checkout@v[0-9]+/,
      "o workflow não faz checkout — sem árvore não há o que testar, e o job passaria por vacuidade"
    );
    assert.match(texto, /^\s+fetch-depth:\s*0\s*$/m, "o checkout deixou de ser íntegro (`fetch-depth: 0`)");
  });

  await t.test("CI-11: a versão do Node é explícita e satisfaz o `engines` do repositório", () => {
    const m = /^\s+node-version:\s*'([0-9]+)(?:\.[0-9x.]+)?'\s*$/m.exec(texto);
    assert.ok(m, "o workflow não fixa uma versão explícita de Node");
    const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
    const exigida = Number(/([0-9]+)/.exec(pkg.engines.node)[1]);
    assert.ok(
      Number(m[1]) >= exigida,
      "o CI roda Node " + m[1] + ", abaixo do `engines.node` do repositório (>=" + exigida + ")"
    );
    assert.ok(
      Number(m[1]) >= NODE_HOMOLOGADO,
      "o CI caiu para Node " + m[1] + ", abaixo do " + NODE_HOMOLOGADO + " homologado — a major que rodou " +
        "as 734 provas é a que vale, e descer troca o ambiente medido por outro sem medir"
    );
  });

  await t.test("CI-17: nenhum contexto de passo é usado fora dos passos", () => {
    // ESTA LEITURA NASCEU DE UM VERMELHO REAL. A primeira versão declarava
    // `EVIDENCIA: ${{ runner.temp }}/evidencia` no `env:` do job — e o
    // contexto `runner` só existe a partir dos passos. O GitHub reprovou o
    // workflow na VALIDAÇÃO: run 32774431823, `failure`, ZERO jobs, sem log,
    // sem anotação legível pela API pública. Um portão que não chega a criar
    // job não guarda coisa nenhuma, e nada no repositório teria dito isso.
    const antesDosPassos = texto.split(/^\s{4}steps:\s*$/m)[0];
    assert.ok(
      antesDosPassos.length > 0 && /jobs:/.test(antesDosPassos),
      "o recorte antes dos passos falhou — leitura inválida, não aprovação"
    );
    for (const contexto of ["runner", "steps", "job"]) {
      assert.ok(
        !new RegExp("\\$\\{\\{[^}]*\\b" + contexto + "\\.").test(antesDosPassos),
        "o contexto `" + contexto + ".` aparece antes dos passos — o workflow falha na " +
          "validação do provedor e o job nem chega a existir"
      );
    }
  });

  await t.test("CI-12: as dependências entram pelo mecanismo canônico", () => {
    // O repositório não tem dependência nem lockfile hoje. A ramificação existe
    // para que o dia em que passar a ter não seja o dia em que o CI começa a
    // instalar de um jeito diferente do de todo mundo.
    assert.match(texto, /^\s*npm ci\s*$/m, "o caminho com lockfile deixou de usar `npm ci`");
    assert.match(texto, /^\s*npm install\s/m, "o caminho sem lockfile deixou de instalar dependências");
  });
});

// ===========================================================================
// [OS 54-C4] AS GUARDAS DO RASTRO PASSARAM A DELEGAR.
//
// Na OS 54-C1 estes casos LIAM o workflow e afirmavam coisas sobre ele. A OS
// 54-R2 mostrou o preço: cada um podia ser trivializado ou apagado sozinho, com
// o portão oficial verde, e o bloco inteiro podia sumir desde que os nomes
// ficassem num comentário — porque o piso por arquivo contava `test(` no fonte.
//
// A autoridade agora é `ci/auditabilidade.js`, que roda em dois lugares que
// nenhuma edição em `test/*.test.js` alcança: o `pretest` de todo `npm test` e
// um passo próprio do CI. O que sobrou aqui não é uma segunda leitura do YAML —
// é a PROVA de que aquela autoridade reprova o que deve reprovar, exercitada
// contra árvores forjadas, uma sabotagem por subcaso.
//
// E os subcasos são a resposta à trivialização: esvaziar `CI-18` deixa de ser
// uma edição neutra e passa a APAGAR seis casos executados, que é exatamente o
// que `ci/inventario_de_execucao.js` mede por arquivo de origem e o que o piso
// global do juiz vê. Guarda sem substância mensurável não tem como ser
// defendida; esta tem.
//
// CI-20 COBRE AS DUAS FAMÍLIAS. Esta árvore compõe a auditabilidade externa com
// a AUTORIDADE DO ARTEFATO PRODUTIVO ÚNICO da OS 52-C4, e as duas são passos
// próprios do MESMO workflow. Um caso que cobrisse só metade da cadeia deixaria
// a outra metade sair do CI em silêncio — que é precisamente o risco que uma
// composição cria e que nenhuma das campanhas de origem enxerga.
// ===========================================================================

/** Roda a autoridade contra uma árvore forjada com UMA sabotagem. */
function guardiaoSobre(edicoes) {
  return GUARDIAO.conferirAuditabilidade({ raiz: forjar(edicoes) });
}

function exigeReprovacao(reprovacoes, padrao, oQue) {
  assert.ok(
    reprovacoes.some((m) => padrao.test(m)),
    oQue + " — a autoridade devolveu: " + JSON.stringify(reprovacoes)
  );
}

const CAMINHO_YML = ".github/workflows/provas-do-servidor.yml";

test("CI/AUDITABILIDADE — o rastro é exigido por autoridade que não mora aqui", async (t) => {
  await t.test("CI-18: o ARTEFATO existe, é sempre enviado, é nomeado e guarda o que foi julgado", async (t18) => {
    await t18.test("CI-18a: a árvore íntegra passa (trava anti-vácuo)", () => {
      assert.deepEqual(guardiaoSobre([]), []);
    });
    await t18.test("CI-18b: upload removido reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.uploadInteiro, ""]]),
        /ARTEFATO: o passo de upload/,
        "sem upload a saída da corrida morre com o runner"
      );
    });
    await t18.test("CI-18c: upload condicionado a sucesso reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.uploadCabecalho, "      - name: Evidência arquivada\n        if: success()"]]),
        /ARTEFATO SEM/,
        "condição comum desliga o upload no run que interessa"
      );
    });
    await t18.test("CI-18d: upload sem nome reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.uploadNome, ""]]),
        /ARTEFATO SEM NOME/,
        "artefato anônimo não é achável"
      );
    });
    await t18.test("CI-18e: artefato que pode subir VAZIO reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.uploadVazio, "          if-no-files-found: warn"]]),
        /ARTEFATO PODE SUBIR VAZIO/,
        "upload sem arquivo e verde publica ausência com cara de rastro"
      );
    });
    await t18.test("CI-18f: artefato apontando para outro caminho reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.uploadCaminho, "          path: /tmp/outro-lugar/"]]),
        /ARTEFATO FORA DO ALVO/,
        "o que é guardado deixou de ser o que foi julgado"
      );
    });
  });

  await t.test("CI-19: o RESUMO existe, é sempre escrito, vem do juiz e vai para o painel", async (t19) => {
    await t19.test("CI-19a: resumo removido reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, trechoDoPasso("--resumo"), ""]]),
        /RESUMO: o passo tem de existir/,
        "o painel deixaria de existir"
      );
    });
    await t19.test("CI-19c: resumo condicionado a sucesso reprova", () => {
      exigeReprovacao(
        guardiaoSobre([
          [CAMINHO_YML, TRECHOS.resumoCabecalho, "      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: success()"],
        ]),
        /RESUMO SEM/,
        "resumo só em sucesso descreve os runs que ninguém precisa ler"
      );
    });
    await t19.test("CI-19d: resumo por eco estático reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.resumoChamada, 'echo "--resumo tudo certo"']]),
        /RESUMO NÃO VEM DO JUIZ/,
        "texto à mão descreve intenção, não a corrida"
      );
    });
    await t19.test("CI-19e: resumo que não é escrito no painel reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.resumoRedirecionamento, ""]]),
        /RESUMO NÃO É ESCRITO NO PAINEL/,
        "calculado e jogado fora não é auditabilidade"
      );
    });
    await t19.test("CI-19f: resumo que TRUNCA o painel reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.resumoRedirecionamento, '> "$GITHUB_STEP_SUMMARY"']]),
        /RESUMO TRUNCA O PAINEL/,
        "truncar apaga o que outros passos escreveram"
      );
    });
  });

  await t.test("CI-19b: o gerador do resumo produz conteúdo, e isso é medido rodando", async (t19b) => {
    await t19b.test("CI-19b1: o gerador real nomeia o que o painel precisa mostrar", () => {
      const texto = PORTAO.resumo(PORTAO.conferir(raizForjada({})), "success");
      for (const termo of GUARDIAO.TERMOS_DO_RESUMO) {
        assert.ok(texto.includes(termo), "o resumo deixou de nomear " + termo);
      }
      assert.ok(
        texto.trim().length >= GUARDIAO.TAMANHO_MINIMO_DO_RESUMO,
        "o resumo encolheu para " + texto.trim().length + " bytes"
      );
    });
    await t19b.test("CI-19b2: gerador esvaziado reprova com o passo intacto", () => {
      // A sabotagem mais silenciosa da família: o YAML continua perfeito, o
      // passo roda, e o painel sai em branco.
      exigeReprovacao(
        guardiaoSobre([
          ["ci/portao_do_ci.js", "function resumo(veredito, desfecho) {", 'function resumo(veredito, desfecho) {\n  if (true) return "";'],
        ]),
        /GERADOR DE RESUMO ESVAZIADO|RESUMO NÃO NOMEIA/,
        "o passo continuaria verde publicando nada"
      );
    });
  });

  await t.test("CI-20: a CADEIA EXTERNA é invocada pelo workflow, e sem condição", async (t20) => {
    await t20.test("CI-20a: invocação do guardião removida reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.invocacaoGuardiao, ""]]),
        /INVOCAÇÃO AUSENTE/,
        "a autoridade sairia da cadeia oficial em silêncio"
      );
    });
    await t20.test("CI-20b: invocação do inventário removida reprova", () => {
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.invocacaoInventario, ""]]),
        /INVOCAÇÃO AUSENTE/,
        "a autoridade de quantidade sairia da cadeia oficial"
      );
    });
    await t20.test("CI-20c: invocação condicionada reprova", () => {
      exigeReprovacao(
        guardiaoSobre([
          [CAMINHO_YML, "      - name: Guardião da auditabilidade\n        run:", "      - name: Guardião da auditabilidade\n        if: false\n        run:"],
        ]),
        /INVOCAÇÃO CONDICIONADA/,
        "condicionar é desligar sem apagar"
      );
    });
    await t20.test("CI-20d: invocação da AUTORIDADE DO ARTEFATO removida reprova", () => {
      // [OS 54-C4] A metade que a folha de origem não conhecia. O passo do
      // artefato produtivo é da OS 52-C4, e nesta composição ele passou a estar
      // sob a MESMA exigência dos outros três — presente, incondicional e
      // intolerante a erro.
      exigeReprovacao(
        guardiaoSobre([[CAMINHO_YML, TRECHOS.invocacaoArtefato, ""]]),
        /INVOCAÇÃO AUSENTE.*artefato produtivo/,
        "a autoridade que decide o que pode ser implantado sairia do CI em silêncio"
      );
    });
    await t20.test("CI-20e: e a autoridade aprova a árvore REAL", () => {
      assert.deepEqual(GUARDIAO.conferirAuditabilidade({}), []);
    });
  });
});

test("CI/PISO — o tamanho medido do portão não encolhe em silêncio", async (t) => {
  await t.test("CI-13: o piso declarado não foi rebaixado abaixo do medido na base", () => {
    assert.ok(fs.existsSync(CAMINHO_DO_PISO), "`ci/piso_do_portao.json` sumiu — o portão ficou sem piso");
    const piso = JSON.parse(fs.readFileSync(CAMINHO_DO_PISO, "utf8"));
    assert.ok(
      piso.casos_minimos >= CASOS_MEDIDOS_NA_BASE,
      "o piso de CASOS caiu para " + piso.casos_minimos + ", abaixo dos " + CASOS_MEDIDOS_NA_BASE +
        " medidos na base — número que desce é como uma suíte apagada volta a passar"
    );
    assert.ok(
      piso.suites_minimas >= SUITES_MEDIDAS_NA_BASE,
      "o piso de SUÍTES caiu para " + piso.suites_minimas + ", abaixo das " + SUITES_MEDIDAS_NA_BASE + " medidas na base"
    );
  });
});

// ===========================================================================
// CI-14 — O PORTÃO É EXERCITADO, NÃO DESCRITO.
//
// Prova textual não distingue uma regra viva de um corpo esvaziado: apagar o
// miolo de `conferir()` deixaria qualquer afirmação sobre "o portão confere X"
// verde para sempre. Por isso o portão é RODADO aqui, contra árvores forjadas,
// uma por sabotagem — e contra uma evidência íntegra, que é a trava anti-vácuo:
// um portão que reprovasse tudo passaria em todos os casos negativos.
//
// A EVIDÊNCIA ÍNTEGRA É UM FIXTURE, e é o oposto de fabricar TAP. Ela não vale
// como prova de execução em lugar nenhum: existe só para exercitar o juiz, e o
// que ela demonstra é justamente que o juiz aceita a forma certa e recusa todas
// as outras. No workflow, quem escreve a evidência é o `npm test` e mais nada.
// ===========================================================================

/** A forma que uma execução real do alvo oficial tem. */
function evidenciaIntegra(ajustes) {
  const v = Object.assign(
    { tests: 646, suites: 75, pass: 646, fail: 0, cancelled: 0, skipped: 0, todo: 0, duration_ms: 18670.49 },
    ajustes || {}
  );
  return [
    "",
    "> buraco-master-vip-servidor@1.0.0 test",
    '> node --test "test/*.test.js"',
    "",
    "▶ ALGUMA SUITE",
    "  ✔ algum caso (1.2345ms)",
    "✔ ALGUMA SUITE (2.3456ms)",
    "# tests " + v.tests,
    "# suites " + v.suites,
    "# pass " + v.pass,
    "# fail " + v.fail,
    "# cancelled " + v.cancelled,
    "# skipped " + v.skipped,
    "# todo " + v.todo,
    "# duration_ms " + v.duration_ms,
    "",
  ].join("\n");
}

/** Monta uma raiz forjada com piso e `package.json` válidos. */
function raizForjada(opcoes) {
  const o = opcoes || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portao-ci-"));
  fs.mkdirSync(path.join(dir, "ci"));
  if (o.piso !== null) {
    fs.writeFileSync(
      path.join(dir, "ci", "piso_do_portao.json"),
      JSON.stringify(o.piso || { casos_minimos: 646, suites_minimas: 75 })
    );
  }
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ scripts: { test: o.alvo || 'node --test "test/*.test.js"' } })
  );
  // [OS 52-C3] A árvore forjada carrega a AUTORIDADE DO PISO, porque o juiz
  // passou a cobrá-la. Sem isto, todo caso deste arquivo reprovaria por um
  // motivo que não é o dele — e vermelho pelo motivo errado esconde o que
  // estava sendo medido. Quem quiser exercitar a AUSÊNCIA da autoridade passa
  // `semAutoridadeDoPiso: true`, e CI-22 faz exatamente isso.
  if (!o.semAutoridadeDoPiso) {
    fs.mkdirSync(path.join(dir, "test"), { recursive: true });
    for (const nome of Object.keys(PORTAO.AUTORIDADE_DO_PISO)) {
      fs.copyFileSync(path.join(RAIZ, nome), path.join(dir, nome));
    }
  }
  // [OS 52-C4] E a AUTORIDADE DO ARTEFATO, pelo mesmo motivo e com a mesma
  // saída: o juiz passou a cobrá-la, e uma árvore forjada sem ela faria todo
  // caso deste arquivo reprovar por algo que não é o que ele mede. Quem quiser
  // exercitar a AUSÊNCIA passa `semAutoridadeDoArtefato: true`.
  if (!o.semAutoridadeDoArtefato) {
    const { AMARRACAO_DO_ARTEFATO } = require("../ci/artefato.js");
    for (const nome of Object.keys(AMARRACAO_DO_ARTEFATO)) {
      fs.mkdirSync(path.dirname(path.join(dir, nome)), { recursive: true });
      fs.copyFileSync(path.join(RAIZ, nome), path.join(dir, nome));
    }
  }
  const arquivoSaida = path.join(dir, "npm-test.txt");
  const arquivoExit = path.join(dir, "exit.txt");
  if (o.saida !== null) fs.writeFileSync(arquivoSaida, o.saida === undefined ? evidenciaIntegra() : o.saida);
  if (o.exit !== null) fs.writeFileSync(arquivoExit, o.exit === undefined ? "0" : o.exit);
  return { raiz: dir, arquivoSaida, arquivoExit };
}

function reprovacoesDe(opcoes) {
  return PORTAO.conferir(raizForjada(opcoes)).reprovacoes;
}

test("CI/PORTÃO — o veredito é fail-closed de verdade, e não só na prosa", async (t) => {
  await t.test("CI-14a: a evidência ÍNTEGRA passa (trava anti-vácuo)", () => {
    // Sem esta, um portão que reprovasse tudo passaria em CI-14b..CI-14m e o
    // conjunto pareceria rigoroso enquanto era apenas quebrado.
    assert.deepEqual(reprovacoesDe({}), []);
  });

  await t.test("CI-14b: NÃO EXECUTADO — evidência ausente é reprovação, nunca silêncio", () => {
    const r = reprovacoesDe({ saida: null });
    assert.ok(r.some((m) => /NÃO EXECUTADO/.test(m)), "evidência ausente passou: " + JSON.stringify(r));
  });

  await t.test("CI-14c: marcador de desfecho ausente é reprovação (cancelamento, estouro de tempo)", () => {
    const r = reprovacoesDe({ exit: null });
    assert.ok(r.some((m) => /MARCADOR DE DESFECHO AUSENTE/.test(m)), JSON.stringify(r));
  });

  await t.test("CI-14d: marcador vazio ou ilegível não vira sucesso", () => {
    assert.ok(reprovacoesDe({ exit: "" }).some((m) => /MARCADOR DE DESFECHO/.test(m)));
    assert.ok(reprovacoesDe({ exit: "verde" }).some((m) => /ILEGÍVEL/.test(m)));
  });

  await t.test("CI-14e: comando que falhou reprova", () => {
    assert.ok(reprovacoesDe({ exit: "1" }).some((m) => /O COMANDO OFICIAL FALHOU/.test(m)));
  });

  await t.test("CI-14f: `echo` no lugar do alvo não passa — o eco do npm é obrigatório", () => {
    const r = reprovacoesDe({ saida: "tudo certo por aqui\n# tests 646\n# suites 75\n" });
    assert.ok(r.some((m) => /ALVO NÃO COMPROVADO/.test(m)), JSON.stringify(r));
    assert.ok(r.some((m) => /ALVO DESVIADO OU SUBSTITUÍDO/.test(m)), JSON.stringify(r));
  });

  await t.test("CI-14g: alvo desviado para arquivo-isca reprova, mesmo com rodapé cheio", () => {
    const isca = evidenciaIntegra().replace('> node --test "test/*.test.js"', "> node --test test/isca.test.js");
    const r = reprovacoesDe({ saida: isca });
    assert.ok(r.some((m) => /ALVO DESVIADO OU SUBSTITUÍDO/.test(m)), JSON.stringify(r));
  });

  await t.test("CI-14h: alvo desviado NA FONTE (`package.json`) reprova", () => {
    const r = reprovacoesDe({ alvo: "node --test test/isca.test.js" });
    assert.ok(r.some((m) => /ALVO OFICIAL FOI DESVIADO NA FONTE/.test(m)), JSON.stringify(r));
  });

  await t.test("CI-14i: rodapé incompleto é execução sem marcador válido", () => {
    const truncada = evidenciaIntegra().split("# pass")[0];
    const r = reprovacoesDe({ saida: truncada });
    assert.ok(r.some((m) => /EXECUÇÃO SEM MARCADOR VÁLIDO/.test(m)), JSON.stringify(r));
  });

  await t.test("CI-14j: casos abaixo do piso reprovam (suíte encolheu em silêncio)", () => {
    const menos = evidenciaIntegra({ tests: 600, pass: 600 });
    assert.ok(reprovacoesDe({ saida: menos }).some((m) => /CASOS ENCOLHERAM/.test(m)));
  });

  await t.test("CI-14k: suítes abaixo do piso reprovam", () => {
    const menos = evidenciaIntegra({ suites: 74 });
    assert.ok(reprovacoesDe({ saida: menos }).some((m) => /SUÍTES ENCOLHERAM/.test(m)));
  });

  await t.test("CI-14l: falha, cancelamento e rodapé inconsistente reprovam", () => {
    assert.ok(reprovacoesDe({ saida: evidenciaIntegra({ fail: 1, pass: 645 }) }).some((m) => /SUÍTE VERMELHA/.test(m)));
    assert.ok(
      reprovacoesDe({ saida: evidenciaIntegra({ cancelled: 1, pass: 645 }) }).some((m) => /EXECUÇÃO CANCELADA/.test(m))
    );
    assert.ok(
      reprovacoesDe({ saida: evidenciaIntegra({ tests: 999 }) }).some((m) => /EVIDÊNCIA INCONSISTENTE/.test(m))
    );
  });

  await t.test("CI-14m: duração zero e piso ausente reprovam", () => {
    assert.ok(reprovacoesDe({ saida: evidenciaIntegra({ duration_ms: 0 }) }).some((m) => /DURAÇÃO ZERO/.test(m)));
    assert.ok(reprovacoesDe({ piso: null }).some((m) => /PISO AUSENTE OU ILEGÍVEL/.test(m)));
  });

  await t.test("CI-14n: piso rebaixado dentro do próprio arquivo não salva o portão", () => {
    // O portão obedece ao piso que lê — é a suíte (CI-13) que impede o piso de
    // descer. Aqui só se prova que a obediência existe: com piso menor, 600
    // casos passariam. É por isso que CI-13 mora fora deste arquivo de dados.
    const r = reprovacoesDe({
      piso: { casos_minimos: 1, suites_minimas: 1 },
      saida: evidenciaIntegra({ tests: 600, pass: 600, suites: 2 }),
    });
    assert.deepEqual(r, []);
  });

  await t.test("CI-14o: o resumo distingue os desfechos, inclusive o que não deixou marca", () => {
    const semNada = PORTAO.conferir(raizForjada({ saida: null, exit: null }));
    const texto = PORTAO.resumo(semNada, "cancelled");
    assert.match(texto, /cancelled/);
    assert.match(texto, /AUSENTE \(não executado \/ cancelado\)/);
    assert.match(texto, /VERMELHO/);

    const verde = PORTAO.resumo(PORTAO.conferir(raizForjada({})), "success");
    assert.match(verde, /VERDE/);
    assert.match(verde, /646/);
    assert.match(verde, /75/);
  });
});

test("CI/CADEIA — as duas metades continuam presas uma na outra", async (t) => {
  await t.test("CI-15: esta suíte é recíproca — chama o censo e está registrada nele", () => {
    // Chamar o censo daqui é o que faz a remoção de QUALQUER obrigatória
    // reprovar também por este arquivo; estar registrada nele é o que faz a
    // remoção DESTE arquivo reprovar pelas outras.
    conferirCenso();
    const { OBRIGATORIAS } = require("./censo_de_suites.js");
    assert.ok(
      Object.prototype.hasOwnProperty.call(OBRIGATORIAS, "ci_obrigatorio.test.js"),
      "esta suíte saiu do censo — voltaria a ser removível em silêncio"
    );
  });

  await t.test("CI-16: o caminho obrigatório continua alcançando a unicidade da OS 52", () => {
    // O CI não substitui nem duplica a guarda de unicidade: ele obriga a rodar
    // o `npm test`, e é de dentro do `npm test` que `conferirCenso` alcança
    // a prova da unicidade. Esta leitura confirma que o que a OS 54
    // acrescentou à árvore (workflow, portão, piso, esta suíte) não introduziu
    // um segundo portador, nem um pacote opaco, em lugar nenhum.
    //
    // [OS 52-C2] O símbolo mudou: a guarda deixou de detectar por nome e trecho
    // e passou a detectar por CAPACIDADE EXECUTÁVEL, varrendo a árvore inteira.
    // Ela vive em `test/unicidade_do_portador.js`, e quem afirma que ela
    // funciona é `test/prova_da_unicidade.js`. A leitura daqui continua sendo
    // a mesma pergunta: o que a OS 54 trouxe é auditável?
    const { conferirUnicidadeDoPortador } = require("./unicidade_do_portador.js");
    const estatistica = conferirUnicidadeDoPortador(RAIZ);
    assert.ok(estatistica.arquivos > 10, "a varredura não alcançou a árvore");
    assert.equal(estatistica.portadorConferido, true);
  });
});

// ===========================================================================
// [OS 52-C3] CI/AUTORIDADE DO PISO — O QUE O ENCOLHIMENTO COORDENADO NÃO ALCANÇA.
//
// A OS 52-R2 apagou uma suíte, tirou a entrada dela do censo e do alcance,
// baixou um limiar e realinhou `ci/piso_do_portao.json` — e o pipeline ficou
// verde. A suíte apagada era JUSTAMENTE esta, que guardava `CASOS_MEDIDOS_NA_BASE`.
// Autoridade que mora dentro do alvo não é autoridade.
//
// A saída foi ancorar o piso no COMMIT ANTERIOR, que nenhuma edição na árvore
// de trabalho alcança, e amarrar a chamada em três lugares — dois dentro do
// `npm test` e um no juiz, que roda num passo separado do workflow.
//
// [OS 54-C4] OS TRÊS CASOS FORAM RENUMERADOS — CI-17/18/19 viraram
// CI-21/22/23 —, e isso não é asseio: nesta árvore composta a auditabilidade
// externa trouxe CI-18 (o artefato), CI-19 (o resumo) e CI-19b (o conteúdo do
// resumo), e os três são COBRADOS PELO NOME por `ci/pisos_autorizados.js`.
// Com os nomes duplicados no MESMO arquivo, apagar o CI-18 da auditabilidade
// seria coberto pelo CI-18 do piso, e a exigência nominal aprovaria uma suíte
// da qual a metade auditável tinha sumido. E o `CI-17` de cima — contexto de
// passo usado fora dos passos — já existia desde a OS 54: a colisão era com
// ele também.
//
// Os três renumerados entraram na lista de NOMES OBRIGATÓRIOS junto com os da
// auditabilidade, então a renumeração não afrouxou nada: eles passaram a ser
// exigidos por execução e por origem, o que antes não eram.
// ===========================================================================
test("CI/AUTORIDADE DO PISO — a autoridade do piso está fora do conjunto editável", async (t) => {
  await t.test("CI-21: o piso ancorado existe, é chamável e compara commits de verdade", () => {
    const piso = require("./piso_ancorado.js");
    assert.equal(typeof piso.conferirPisoAncorado, "function",
      "a comparação com o commit anterior sumiu ou deixou de ser exportada");
    const laudo = piso.conferirPisoAncorado(RAIZ);
    assert.ok(laudo.ancoras.length >= 1,
      "nenhuma âncora de histórico foi lida — a comparação passaria por vacuidade");
    assert.ok(laudo.comparacoes > 0,
      "a comparação não comparou nada");
    assert.ok(
      laudo.agora.piso.casos_minimos >= CASOS_MEDIDOS_NA_BASE,
      "o piso corrente ficou abaixo do medido na base"
    );
  });

  await t.test("CI-22: o juiz do CI cobra a autoridade do piso, e é exercitado nisso", () => {
    // Descrever não basta: o juiz é RODADO contra uma árvore forjada à qual
    // falta o arquivo da autoridade, e o que se exige é reprovação com nome.
    assert.ok(
      Object.prototype.hasOwnProperty.call(PORTAO.AUTORIDADE_DO_PISO, "test/piso_ancorado.js"),
      "o juiz deixou de conhecer a autoridade do piso"
    );
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ciautoridade-"));
    try {
      fs.mkdirSync(path.join(raiz, "ci"), { recursive: true });
      fs.mkdirSync(path.join(raiz, "test"), { recursive: true });
      fs.copyFileSync(CAMINHO_DO_PISO, path.join(raiz, "ci", "piso_do_portao.json"));
      fs.copyFileSync(path.join(RAIZ, "package.json"), path.join(raiz, "package.json"));
      for (const nome of Object.keys(PORTAO.AUTORIDADE_DO_PISO)) {
        fs.copyFileSync(path.join(RAIZ, nome), path.join(raiz, nome));
      }
      const alvo = {
        raiz,
        arquivoSaida: path.join(raiz, "sem-evidencia.txt"),
        arquivoExit: path.join(raiz, "sem-exit.txt"),
      };
      const intacta = PORTAO.conferir(alvo).reprovacoes.filter((m) => /AUTORIDADE DO PISO/.test(m));
      assert.deepEqual(intacta, [], "a árvore com a autoridade intacta foi acusada");

      fs.rmSync(path.join(raiz, "test", "piso_ancorado.js"), { force: true });
      const semAutoridade = PORTAO.conferir(alvo).reprovacoes.filter((m) => /AUTORIDADE DO PISO AUSENTE/.test(m));
      assert.equal(semAutoridade.length, 1,
        "apagar a autoridade do piso não deixou o juiz vermelho");
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });

  await t.test("CI-23: o piso do piso desta suíte acompanha o piso declarado", () => {
    // `CASOS_MEDIDOS_NA_BASE` continua aqui, e continua servindo — só deixou de
    // ser a ÚNICA defesa. O que este caso impede é a divergência silenciosa:
    // subir o piso do arquivo e esquecer este número deixaria a metade de
    // dentro protegendo um total que já não existe.
    const piso = JSON.parse(fs.readFileSync(CAMINHO_DO_PISO, "utf8"));
    assert.ok(
      piso.casos_minimos >= CASOS_MEDIDOS_NA_BASE,
      "o piso declarado (" + piso.casos_minimos + ") caiu abaixo do medido na base (" +
        CASOS_MEDIDOS_NA_BASE + ")"
    );
    assert.ok(
      piso.suites_minimas >= SUITES_MEDIDAS_NA_BASE,
      "o piso de suítes declarado caiu abaixo do medido na base"
    );
    assert.equal(
      piso.medido_na_arvore_desta_os.casos, piso.casos_minimos,
      "o número medido e o piso declarado divergiram — um dos dois está desatualizado"
    );
    assert.equal(
      piso.medido_na_arvore_desta_os.suites, piso.suites_minimas,
      "o número de suítes medido e o piso declarado divergiram"
    );
  });
});
