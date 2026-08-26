// ci/auditabilidade.js — O GUARDIÃO EXTERNO DO RASTRO (OS 54-C5, §1 e §2).
//
// ===========================================================================
// O QUE A OS 54-R2 PROVOU, E POR QUE ESTE ARQUIVO EXISTE
// ===========================================================================
//
// A OS 54-C1 escreveu três guardas corretas — CI-18 (artefato), CI-19 (resumo)
// e CI-19b (conteúdo do resumo) — e as pôs DENTRO da suíte que elas protegem.
// A R2 mostrou o preço disso: cada uma podia ser apagada ou trivializada
// isoladamente com o portão oficial VERDE, e o bloco inteiro podia sumir desde
// que os nomes ficassem num comentário, porque o piso por arquivo contava
// ocorrências de `test(` no FONTE — inclusive em prosa.
//
// Guarda que mora dentro do que protege não é guarda: é uma declaração de
// intenção que some junto com o que deveria vigiar. Dezesseis sabotagens
// passaram por essa porta.
//
// ESTE ARQUIVO É A AUTORIDADE, e ele não mora no bloco protegido:
//
//   * roda no `pretest` (via `test/guarda_do_portao.js`), ANTES do glob, então
//     apagar casos, trivializá-los ou apagar o bloco inteiro não o alcança;
//   * roda como PASSO PRÓPRIO do workflow, participando do veredito;
//   * confere o próprio endereço: se a invocação sumir do workflow, ele reprova
//     de dentro do `npm test` — e se ele sumir do disco, o passo do CI quebra e
//     o `pretest` também.
//
// ===========================================================================
// [OS 54-C4] O PORTE PARA A ÁRVORE DO ARTEFATO ÚNICO
// ===========================================================================
//
// A base é a OS 52-C4, que trocou a autoridade da unicidade: deixou de ser
// "isto se PARECE com um servidor" e passou a ser "isto PERTENCE ao conjunto
// implantável declarado" — `ci/artefato.js`, chamado do `pretest`, do censo, do
// juiz e de um PASSO PRÓPRIO do workflow.
//
// As duas famílias dividem os mesmos endereços: o workflow, o `pretest`, o
// censo e o piso. Por isso este guardião cobra, no MESMO lugar e com a MESMA
// severidade, a invocação da autoridade do artefato e a chamada dela no
// `pretest`. Autoridade que não é executada é decoração.
//
// ===========================================================================
// [OS 54-C5] O ESCAPE DA R4: ESTAR ESCRITO NÃO É SER EXECUTADO
// ===========================================================================
//
// Até a OS 54-C4 este arquivo respondia "o workflow chama o juiz?" com uma
// expressão regular sobre o CORPO INTEIRO do passo. Presença de texto não é
// execução, e a R4 mostrou o preço: bastava prefixar `echo`.
//
//     run: echo node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" …
//
// O texto continuava lá, o comando não rodava, e o guardião aprovava. Medido
// nesta árvore antes da correção: as QUATRO invocações obrigatórias caíam pelo
// mesmo caminho. As campanhas não viram porque sabotavam por REMOÇÃO — e
// remoção quebra a âncora, o que é detecção por acidente, não por autoridade.
//
// A pergunta passou a ser feita por `ci/invocacao_executavel.js`, que lê o
// `run:` do PASSO CANÔNICO como o runner leria — bloco escalar, continuação de
// linha, heredoc, comentário de shell, aspas, separadores e alcançabilidade — e
// só aprova quando existe um comando ALCANÇÁVEL cuja CABEÇA é `node` e que
// recebe o alvo como PALAVRA PRÓPRIA. Tudo o que ele não consegue classificar
// como invocação executável é RECUSADO: a direção do erro é o vermelho.
//
// O QUE ELE NÃO É. Não substitui `ci/portao_do_ci.js`, que continua sendo o
// juiz fail-closed da EVIDÊNCIA; aqui não se lê saída de teste nenhuma. Não é
// manifesto paralelo: não lista suítes, não conta casos e não conhece pisos —
// isso é do inventário. Não confere conjunto produtivo nenhum — isso é do
// artefato. Ele responde uma pergunta só: **o run publica rastro legível, o
// rastro é do que foi julgado, e as autoridades continuam sendo EXECUTADAS?**

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXECUTAVEL = require("./invocacao_executavel.js");

const CAMINHO_RELATIVO_DO_WORKFLOW = path.join(".github", "workflows", "provas-do-servidor.yml");

/** Os verificadores que o workflow tem de EXECUTAR por conta própria.
 *
 *  Estão aqui, e não no YAML, porque uma lista que vive só no arquivo vigiado
 *  se apaga junto com ele.
 *
 *  [OS 54-C5] Cada entrada declara o PASSO CANÔNICO onde a invocação tem de
 *  viver. Ancorar no `name:` não é asseio: a ordem dos passos decide QUANDO um
 *  comando roda, e mover a chamada do juiz para depois do upload — ou para
 *  dentro de um passo `if: always()` — muda o significado sem mudar uma letra
 *  do comando. A §2 manda recusar "ocorrência em passo diferente do passo
 *  canônico", e é a âncora do nome que faz isso ser verificável.
 *
 *  `exige` são palavras que o comando TEM de receber; `proibe` são as que o
 *  descaracterizam. O juiz proíbe `--resumo` porque quem imprime o painel é
 *  outro passo, e um passo que só imprimisse não julgaria nada. */
const INVOCACOES_OBRIGATORIAS = Object.freeze([
  Object.freeze({
    oQue: "o juiz fail-closed da evidência",
    passo: "Portão fail-closed",
    binario: "node",
    alvo: "ci/portao_do_ci.js",
    exige: Object.freeze(["$EVIDENCIA/npm-test.txt", "$EVIDENCIA/exit.txt"]),
    proibe: Object.freeze(["--resumo"]),
  }),
  Object.freeze({
    oQue: "este guardião da auditabilidade",
    passo: "Guardião da auditabilidade",
    binario: "node",
    alvo: "ci/auditabilidade.js",
    exige: Object.freeze([]),
    proibe: Object.freeze([]),
  }),
  Object.freeze({
    oQue: "o inventário por execução",
    passo: "Inventário por execução",
    binario: "node",
    alvo: "ci/inventario_de_execucao.js",
    exige: Object.freeze([]),
    proibe: Object.freeze([]),
  }),
  Object.freeze({
    oQue: "a autoridade do artefato produtivo único",
    passo: "Artefato produtivo único",
    binario: "node",
    alvo: "ci/artefato.js",
    exige: Object.freeze(["--conferir"]),
    proibe: Object.freeze([]),
  }),
]);

/** O passo do RESUMO segue a mesma regra dos quatro acima — ele também pode ser
 *  neutralizado com `echo` —, e ainda carrega duas exigências próprias: rodar
 *  com `always()` e ANEXAR ao painel. */
const INVOCACAO_DO_RESUMO = Object.freeze({
  oQue: "o gerador do resumo do painel",
  passo: "Resumo (verde, vermelho, cancelado ou não executado)",
  binario: "node",
  alvo: "ci/portao_do_ci.js",
  exige: Object.freeze(["--resumo", "$EVIDENCIA/npm-test.txt", "$EVIDENCIA/exit.txt"]),
  proibe: Object.freeze([]),
});

const PASSO_DO_UPLOAD = "Evidência arquivada";
const PAINEL = "$GITHUB_STEP_SUMMARY";

/** Termos que o resumo TEM de nomear. Um painel que não diz quantos casos
 *  passaram não serve para auditar coisa nenhuma. */
const TERMOS_DO_RESUMO = Object.freeze([
  "suítes", "casos aprovados", "falhas", "cancelados", "duração", "desfecho",
]);

const TAMANHO_MINIMO_DO_RESUMO = 200;

/** Recorta comentários de YAML — comentar uma linha é a sabotagem mais barata
 *  que existe, e prova textual que não separa código de prosa mede a prosa.
 *  Com trava contra o próprio recorte.
 *
 *  [OS 54-C5] DEIXOU DE SER O CAMINHO PRINCIPAL. A leitura autoritativa é feita
 *  sobre o YAML BRUTO por `ci/invocacao_executavel.js`, que distingue comentário
 *  de YAML de comentário de SHELL — recortar os dois com a mesma régua comia o
 *  `#` de dentro de um bloco `run:`. Isto fica exportado porque a suíte o
 *  exercita e porque a trava contra o próprio recorte é uma lição que não se
 *  joga fora. */
function semComentarios(bruto) {
  const texto = bruto
    .split("\r\n").join("\n")
    .split("\n")
    .map((linha) => linha.replace(/(^|\s)#.*$/, "$1"))
    .join("\n");
  if (!/runs-on:/.test(texto)) {
    throw new Error("o recorte de comentários comeu o workflow — leitura inválida, não aprovação");
  }
  return texto;
}

/** Separa os passos do job pelo texto. Mantido para quem só precisa do corpo
 *  bruto; quem precisa saber o que EXECUTA usa `passosDoWorkflow`. */
function passosDo(texto) {
  const passos = [];
  let atual = null;
  for (const linha of texto.split("\n")) {
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

/** `${{ env.X }}` e `$X` são a mesma variável em duas gramáticas. Para comparar
 *  caminhos é preciso falar uma só. */
function normalizarCaminho(bruto) {
  return String(bruto)
    .trim()
    .replace(/\$\{\{\s*env\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, "$$$1")
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");
}

/** O veredito. Lista vazia significa VERDE. */
function conferirAuditabilidade(opcoes) {
  const o = opcoes || {};
  const raiz = o.raiz || path.join(__dirname, "..");
  const reprovacoes = [];
  const caminho = path.join(raiz, CAMINHO_RELATIVO_DO_WORKFLOW);

  if (!fs.existsSync(caminho)) {
    reprovacoes.push(
      "WORKFLOW AUSENTE: `" + CAMINHO_RELATIVO_DO_WORKFLOW + "` não existe — sem ele não há run, " +
      "não há rastro e não há veredito."
    );
    return reprovacoes;
  }

  let bruto;
  try {
    bruto = fs.readFileSync(caminho, "utf8");
    semComentarios(bruto); // trava: um workflow que o recorte destrói é ilegível
  } catch (erro) {
    reprovacoes.push("WORKFLOW ILEGÍVEL: " + ((erro && erro.message) || erro));
    return reprovacoes;
  }

  const passos = EXECUTAVEL.passosDoWorkflow(bruto);

  // --- as invocações que o CI deve EXECUTAR por conta própria --------------
  //
  // Inclui a DESTE arquivo: um guardião que não é chamado é decoração, e a
  // única peça capaz de perceber a própria ausência do YAML é ele mesmo, rodando
  // pelo outro caminho (o `pretest`).
  for (const exigencia of INVOCACOES_OBRIGATORIAS) {
    for (const motivo of conferirInvocacao(passos, exigencia)) reprovacoes.push(motivo);
  }

  // --- nenhum passo do job tolera o próprio erro ---------------------------
  //
  // Um `continue-on-error` em QUALQUER passo — inclusive no das provas — deixa
  // o job verde com a etapa vermelha. A §4 proíbe introduzi-lo; aqui a proibição
  // vira leitura.
  for (const passo of passos) {
    if (passo.atributos["continue-on-error"] !== undefined) {
      reprovacoes.push(
        "PASSO TOLERANTE: `" + passo.nome + "` tem `continue-on-error` — um passo que perdoa o " +
        "próprio erro tira do job a única cor que ele produz sozinho."
      );
    }
  }

  // --- o ARTEFATO ----------------------------------------------------------
  const upload = passos.filter((p) => /^actions\/upload-artifact@v[0-9]+$/.test(p.atributos["uses"] || ""));
  if (upload.length !== 1) {
    reprovacoes.push(
      "ARTEFATO: o passo de upload tem de existir exatamente uma vez (encontrados: " + upload.length +
      ") — sem ele a saída da corrida morre com o runner."
    );
  } else {
    const passoUpload = upload[0];
    if (passoUpload.nome !== PASSO_DO_UPLOAD) {
      reprovacoes.push(
        "ARTEFATO EM PASSO DESCONHECIDO: o upload mora em `" + passoUpload.nome + "` e o contrato diz `" +
        PASSO_DO_UPLOAD + "` — passo renomeado é passo que nenhuma outra guarda encontra."
      );
    }
    if (passoUpload.atributos["if"] !== "always()") {
      reprovacoes.push(
        "ARTEFATO SEM `always()`: condição comum desliga o upload justamente quando o job falha, " +
        "que é quando o rastro importa."
      );
    }
    if (!passoUpload.atributos["name"]) {
      reprovacoes.push("ARTEFATO SEM NOME: não dá para achar o que não se nomeia.");
    }
    if (passoUpload.atributos["if-no-files-found"] !== "error") {
      reprovacoes.push(
        "ARTEFATO PODE SUBIR VAZIO: `if-no-files-found` não está em `error` — um upload que não " +
        "encontra arquivo nenhum e termina verde publica ausência com cara de rastro."
      );
    }

    if (!passoUpload.atributos["path"]) {
      reprovacoes.push("ARTEFATO SEM `path:`: não arquiva coisa nenhuma.");
    } else {
      const arquivado = normalizarCaminho(passoUpload.atributos["path"]);
      const veredito = EXECUTAVEL.passoChamado(passos, INVOCACOES_OBRIGATORIAS[0].passo);
      const comando = veredito && veredito.run.presente
        ? EXECUTAVEL.invocacaoAutoritativa(veredito.run.script, INVOCACOES_OBRIGATORIAS[0]).comando
        : null;
      if (!comando) {
        reprovacoes.push(
          "ARTEFATO SEM REFERÊNCIA: não há invocação executável do veredito para comparar o caminho."
        );
      } else {
        const lidos = comando.argumentos.filter((a) => a.startsWith("$EVIDENCIA/")).map(normalizarCaminho);
        if (lidos.length !== 2) {
          reprovacoes.push(
            "VEREDITO NÃO LÊ DOIS ARQUIVOS DE EVIDÊNCIA: " + JSON.stringify(lidos) +
            " — sem saída e marcador não há o que arquivar nem o que julgar."
          );
        }
        for (const lido of lidos) {
          if (!lido.startsWith(arquivado + "/")) {
            reprovacoes.push(
              "ARTEFATO FORA DO ALVO: arquiva `" + arquivado + "`, que não contém `" + lido +
              "` — o que é guardado não é o que foi julgado, e diretório inexistente arquiva vazio " +
              "parecendo cuidado."
            );
          }
        }
      }
    }
  }

  // --- o RESUMO ------------------------------------------------------------
  const passoResumo = EXECUTAVEL.passoChamado(passos, INVOCACAO_DO_RESUMO.passo);
  if (!passoResumo) {
    reprovacoes.push(
      "RESUMO: o passo tem de existir exatamente uma vez, com o nome `" + INVOCACAO_DO_RESUMO.passo +
      "` — e não existe."
    );
  } else {
    if (passoResumo.atributos["if"] !== "always()") {
      reprovacoes.push(
        "RESUMO SEM `always()`: executado só em sucesso, ele descreve exatamente os runs que " +
        "ninguém precisa ler."
      );
    }
    if (!passoResumo.run.presente) {
      reprovacoes.push("RESUMO NÃO VEM DO JUIZ: o passo do resumo não tem `run:` nenhum.");
    } else {
      const veredito = EXECUTAVEL.invocacaoAutoritativa(passoResumo.run.script, INVOCACAO_DO_RESUMO);
      if (!veredito.ok) {
        reprovacoes.push(
          "RESUMO NÃO VEM DO JUIZ: o passo deveria EXECUTAR `node ci/portao_do_ci.js --resumo`, e " +
          veredito.motivo + " — texto escrito à mão, impresso ou guardado numa variável descreve o " +
          "que alguém quis dizer, não o que a corrida fez."
        );
      } else {
        const operador = EXECUTAVEL.redirecionamentoPara(veredito.comando, PAINEL);
        if (operador === null) {
          reprovacoes.push(
            "RESUMO NÃO É ESCRITO NO PAINEL: calculado e jogado fora não é auditabilidade."
          );
        } else if (operador === ">") {
          reprovacoes.push("RESUMO TRUNCA O PAINEL (`>`) em vez de anexar (`>>`).");
        }
      }
    }
  }

  // --- a CADEIA DO `pretest`, que é o outro endereço desta autoridade ------
  //
  // Sem isto haveria um buraco simétrico ao que a R2 achou: as chamadas do
  // `pretest` — censo, auditabilidade, pisos, unicidade, piso ancorado e a
  // autoridade do artefato — podiam ser comentadas uma a uma, e cada remoção
  // pareceria inofensiva porque as OUTRAS peças ainda cobriam. Cobertura por
  // acaso não é proteção. E é esta leitura que permite dizer, com prova, que a
  // chamada de `conferirCenso` de DENTRO das suítes virou defesa redundante: a
  // obrigatória passou a ser a de fora.
  for (const motivo of conferirCadeiaDoPretest(raiz)) reprovacoes.push(motivo);

  // --- o CONTEÚDO que o gerador de fato produz -----------------------------
  //
  // Aqui o guardião sai do YAML e EXECUTA: um passo de resumo intacto apontando
  // para um gerador esvaziado publica um painel em branco, e nenhuma leitura de
  // texto perceberia isso.
  try {
    const juiz = require(path.join(raiz, "ci", "portao_do_ci.js"));
    const texto = juiz.resumo(exemploDeVeredito(juiz), "success");
    for (const termo of TERMOS_DO_RESUMO) {
      if (!texto.includes(termo)) {
        reprovacoes.push("RESUMO NÃO NOMEIA `" + termo + "` — o painel deixaria de dizer isso.");
      }
    }
    if (texto.trim().length < TAMANHO_MINIMO_DO_RESUMO) {
      reprovacoes.push(
        "GERADOR DE RESUMO ESVAZIADO: produziu " + texto.trim().length + " bytes, abaixo do mínimo " +
        TAMANHO_MINIMO_DO_RESUMO + " — o passo continuaria verde publicando nada."
      );
    }
  } catch (erro) {
    reprovacoes.push("GERADOR DE RESUMO INDISPONÍVEL: " + ((erro && erro.message) || erro));
  }

  return reprovacoes;
}

/** Uma exigência de invocação, respondida pela autoridade executável.
 *
 *  A mensagem começa sempre por `INVOCAÇÃO AUSENTE` e nomeia O QUE deixou de
 *  rodar antes de dizer POR QUÊ. É de propósito: quem lê o log do CI precisa
 *  saber em dois segundos qual autoridade caiu, e o motivo exato logo em
 *  seguida. Passo inexistente e passo que não executa são a mesma perda — em
 *  nenhum dos dois casos o comando roda. */
function conferirInvocacao(passos, exigencia) {
  const reprovacoes = [];
  const passo = EXECUTAVEL.passoChamado(passos, exigencia.passo);

  if (!passo) {
    reprovacoes.push(
      "INVOCAÇÃO AUSENTE: o workflow deveria executar " + exigencia.oQue + " no passo `" +
      exigencia.passo + "`, e não existe passo com esse nome — verificador que não é executado " +
      "não verifica."
    );
    return reprovacoes;
  }

  if (!passo.run.presente) {
    reprovacoes.push(
      "INVOCAÇÃO AUSENTE: o workflow deveria executar " + exigencia.oQue + " no passo `" +
      exigencia.passo + "`, e o passo não tem `run:` nenhum."
    );
  } else {
    const veredito = EXECUTAVEL.invocacaoAutoritativa(passo.run.script, exigencia);
    if (!veredito.ok) {
      reprovacoes.push(
        "INVOCAÇÃO AUSENTE: o workflow deveria executar " + exigencia.oQue + " no passo `" +
        exigencia.passo + "`, e " + veredito.motivo + ". Estar escrito não é ser executado."
      );
    }
  }

  if (passo.atributos["if"] !== undefined) {
    reprovacoes.push(
      "INVOCAÇÃO CONDICIONADA: o passo `" + passo.nome + "`, que executa " + exigencia.oQue +
      ", ganhou um `if:` — condicionar é desligar sem apagar."
    );
  }
  if (passo.atributos["continue-on-error"] !== undefined) {
    reprovacoes.push(
      "INVOCAÇÃO TOLERADA: o passo `" + passo.nome + "` tem `continue-on-error` — " +
      "o job deixaria de depender do resultado."
    );
  }
  return reprovacoes;
}

/** As chamadas que o `pretest` tem de fazer, em CÓDIGO e não em comentário.
 *
 *  [OS 54-C4] A LISTA COBRE AS DUAS FAMÍLIAS, e não é enfeite: esta árvore
 *  compõe a auditabilidade externa da OS 54-C2 com a AUTORIDADE DO ARTEFATO
 *  PRODUTIVO ÚNICO da OS 52-C4, e as duas dependem do MESMO `pretest`. Uma
 *  lista que cobrisse só metade deixaria a outra metade sair da etapa oficial
 *  com uma linha comentada — exatamente a sabotagem que esta leitura existe
 *  para reprovar, aplicada à família que não estava sendo olhada. */
const CHAMADAS_DO_PRETEST = Object.freeze([
  ["o censo das suítes obrigatórias", /(?:^|[^/])\bconferirCenso\s*\(/m],
  ["o guardião da auditabilidade", /(?:^|[^/])\bconferirAuditabilidade\s*\(/m],
  ["a autoridade do artefato produtivo único", /(?:^|[^/])\bexigirArtefatoUnico\s*\(/m],
  ["a prova da unicidade por capacidade composta", /(?:^|[^/])\bconferirProvaDaUnicidade\s*\(/m],
  ["o glob oficial do portão", /(?:^|[^/])\bconferirGlobOficial\s*\(/m],
  ["o piso ancorado no commit anterior", /(?:^|[^/])\bconferirPisoAncorado\s*\(/m],
  ["a amarração da autoridade do piso", /(?:^|[^/])\bconferirAmarracao\s*\(/m],
  ["os mínimos externos de piso", /(?:^|[^/])\bconferirPisosDeclarados\s*\(/m],
]);

/** Recorta comentários de JavaScript, com trava contra o próprio recorte.
 *
 *  O recorte de bloco é deliberadamente conservador: abertura de comentário de
 *  bloco dentro de uma string já engoliu o miolo de um arquivo inteiro numa OS
 *  anterior, e o que sumiu foi o MEIO — a trava de "sobrou código" não pegou.
 *  Aqui só se recorta comentário de LINHA, que é a sabotagem barata, e a trava
 *  confere que o corpo ficou. */
function semComentariosDeLinha(bruto) {
  const texto = bruto.split("\r\n").join("\n").replace(/^[ \t]*\/\/.*$/gm, "");
  if (!/require\(/.test(texto)) {
    throw new Error("o recorte de comentários comeu o arquivo — leitura inválida, não aprovação");
  }
  return texto;
}

/** O `pretest` existe, aponta para a guarda, e a guarda chama todas. */
function conferirCadeiaDoPretest(raiz) {
  const reprovacoes = [];

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
  } catch (erro) {
    return ["`package.json` ilegível: " + ((erro && erro.message) || erro)];
  }

  const pretest = (pkg.scripts && pkg.scripts.pretest) || "";
  if (!/guarda_do_portao\.js/.test(pretest)) {
    reprovacoes.push(
      "PRETEST AUSENTE: o manifesto não roda `test/guarda_do_portao.js` antes do glob — sem essa " +
      "etapa, estreitar o comando para uma suíte-isca deixa o portão verde, e as autoridades " +
      "externas deixam de rodar no `npm test`."
    );
    return reprovacoes;
  }

  const caminho = path.join(raiz, "test", "guarda_do_portao.js");
  if (!fs.existsSync(caminho)) {
    reprovacoes.push("GUARDA DO PORTÃO AUSENTE: `test/guarda_do_portao.js` sumiu, e o `pretest` aponta para o vazio.");
    return reprovacoes;
  }

  let corpo;
  try {
    corpo = semComentariosDeLinha(fs.readFileSync(caminho, "utf8"));
  } catch (erro) {
    reprovacoes.push("GUARDA DO PORTÃO ILEGÍVEL: " + ((erro && erro.message) || erro));
    return reprovacoes;
  }

  for (const [oQue, padrao] of CHAMADAS_DO_PRETEST) {
    if (!padrao.test(corpo)) {
      reprovacoes.push(
        "CHAMADA AUSENTE NO `pretest`: a guarda deixou de executar " + oQue +
        " — comentar a linha é a sabotagem mais barata que existe, e é por isso que a leitura " +
        "recorta os comentários antes de medir."
      );
    }
  }
  return reprovacoes;
}

/** Um veredito de mentirinha, só para fazer o gerador falar. Não é evidência de
 *  execução nenhuma e não vale como prova de corrida — serve para medir o
 *  GERADOR, que é o que pode ter sido esvaziado. */
function exemploDeVeredito(juiz) {
  return {
    reprovacoes: [],
    dados: {
      exit: 0,
      piso: { casos_minimos: 1, suites_minimas: 1 },
      rodape: {
        tests: 883, suites: 87, pass: 883, fail: 0,
        cancelled: 0, skipped: 0, todo: 0, duration_ms: 106207.99,
      },
      saida: "",
    },
  };
}

function principal() {
  const reprovacoes = conferirAuditabilidade({});
  if (reprovacoes.length === 0) {
    process.stdout.write(
      "AUDITABILIDADE VERDE — artefato e resumo presentes, sempre executados, apontando para a " +
      "evidência julgada, o gerador do painel produz conteúdo, e as autoridades externas (juiz, " +
      "guardião, inventário e artefato produtivo) são INVOCADAS DE VERDADE nos passos canônicos.\n"
    );
    return 0;
  }
  process.stdout.write("AUDITABILIDADE REPROVADA — " + reprovacoes.length + " motivo(s):\n");
  for (const m of reprovacoes) process.stdout.write("  * " + m + "\n");
  return 1;
}

module.exports = {
  CAMINHO_RELATIVO_DO_WORKFLOW, INVOCACOES_OBRIGATORIAS, INVOCACAO_DO_RESUMO,
  PASSO_DO_UPLOAD, PAINEL, TERMOS_DO_RESUMO, TAMANHO_MINIMO_DO_RESUMO,
  semComentarios, semComentariosDeLinha, passosDo, normalizarCaminho,
  CHAMADAS_DO_PRETEST, conferirInvocacao, conferirCadeiaDoPretest, conferirAuditabilidade, principal,
};

if (require.main === module) process.exit(principal());
