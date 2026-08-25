// ci/auditabilidade.js — O GUARDIÃO EXTERNO DO RASTRO (OS 54-C4, §5).
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
// [OS 54-C4] O QUE MUDOU AO PORTAR PARA A ÁRVORE DO ARTEFATO ÚNICO
// ===========================================================================
//
// A base desta correção é a OS 52-C4, que trocou a autoridade da unicidade:
// deixou de ser "isto se PARECE com um servidor" e passou a ser "isto PERTENCE
// ao conjunto implantável declarado" — `ci/artefato.js`, chamado do `pretest`,
// do censo, do juiz e de um PASSO PRÓPRIO do workflow.
//
// As duas famílias passaram a dividir os mesmos quatro endereços: o workflow, o
// `pretest`, o censo e o piso. Uma composição que só olhasse metade deixaria a
// outra metade sair da cadeia oficial com uma linha comentada, e a campanha de
// origem não veria — porque cada uma olha só o próprio lado. Por isso este
// guardião passou a cobrar, no MESMO lugar e com a MESMA severidade:
//
//   * a invocação da autoridade do artefato como passo do workflow, sem `if:`
//     e sem `continue-on-error:` (`INVOCACOES_OBRIGATORIAS`);
//   * a chamada de `exigirArtefatoUnico(...)` no programa do `pretest`
//     (`CHAMADAS_DO_PRETEST`).
//
// Não é duplicação de `ci/artefato.js`: ele decide O QUE é implantável, e este
// arquivo decide se ele CONTINUA SENDO CHAMADO. Autoridade que não é executada
// é decoração, e a única peça capaz de perceber a ausência de outra é uma que
// rode por um caminho que a ausência não desliga.
//
// O QUE ELE NÃO É. Não substitui `ci/portao_do_ci.js`, que continua sendo o
// juiz fail-closed da EVIDÊNCIA; aqui não se lê saída de teste nenhuma. Não é
// manifesto paralelo: não lista suítes, não conta casos e não conhece pisos —
// isso é do inventário. Não confere conjunto produtivo nenhum — isso é do
// artefato. Ele responde uma pergunta só: **o run publica rastro legível, o
// rastro é do que foi julgado, e as autoridades continuam sendo invocadas?**

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CAMINHO_RELATIVO_DO_WORKFLOW = path.join(".github", "workflows", "provas-do-servidor.yml");

/** Os verificadores que o workflow tem de invocar por conta própria.
 *  Estão aqui, e não no YAML, porque uma lista que vive só no arquivo vigiado
 *  se apaga junto com ele. */
const INVOCACOES_OBRIGATORIAS = Object.freeze([
  ["o juiz fail-closed da evidência", /node\s+ci\/portao_do_ci\.js\s+"\$EVIDENCIA/],
  ["este guardião da auditabilidade", /node\s+ci\/auditabilidade\.js/],
  ["o inventário por execução", /node\s+ci\/inventario_de_execucao\.js/],
  // [OS 54-C4] A autoridade do ARTEFATO PRODUTIVO ÚNICO, da OS 52-C4. Ela é um
  // passo próprio do workflow pelo mesmo motivo que o juiz é: quem estreita o
  // glob desliga tudo o que vive dentro dele. Cobrada aqui, sumir do workflow
  // deixa de ser uma edição silenciosa de uma linha.
  ["a autoridade do artefato produtivo único", /node\s+ci\/artefato\.js\s+--conferir/],
]);

/** Termos que o resumo TEM de nomear. Um painel que não diz quantos casos
 *  passaram não serve para auditar coisa nenhuma. */
const TERMOS_DO_RESUMO = Object.freeze([
  "suítes", "casos aprovados", "falhas", "cancelados", "duração", "desfecho",
]);

const TAMANHO_MINIMO_DO_RESUMO = 200;

/** Recorta comentários de YAML — comentar uma linha é a sabotagem mais barata
 *  que existe, e prova textual que não separa código de prosa mede a prosa.
 *  Com trava contra o próprio recorte. */
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

/** Separa os passos do job. Um `if:` só importa no passo a que pertence. */
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

  let texto;
  try {
    texto = semComentarios(fs.readFileSync(caminho, "utf8"));
  } catch (erro) {
    reprovacoes.push("WORKFLOW ILEGÍVEL: " + ((erro && erro.message) || erro));
    return reprovacoes;
  }

  const passos = passosDo(texto);

  // --- as invocações que o CI deve fazer por conta própria -----------------
  //
  // Inclui a DESTE arquivo: um guardião que não é chamado é decoração, e a
  // única peça capaz de perceber a própria ausência do YAML é ele mesmo, rodando
  // pelo outro caminho (o `pretest`).
  for (const [oQue, padrao] of INVOCACOES_OBRIGATORIAS) {
    const alcancados = passos.filter((p) => padrao.test(p.corpo) && !/--resumo/.test(p.corpo));
    if (alcancados.length === 0) {
      reprovacoes.push(
        "INVOCAÇÃO AUSENTE: o workflow não chama " + oQue + " em passo nenhum — " +
        "verificador que não é executado não verifica."
      );
      continue;
    }
    for (const passo of alcancados) {
      if (/^\s+if:/m.test(passo.corpo)) {
        reprovacoes.push(
          "INVOCAÇÃO CONDICIONADA: o passo `" + passo.nome + "`, que chama " + oQue +
          ", ganhou um `if:` — condicionar é desligar sem apagar."
        );
      }
      if (/continue-on-error/.test(passo.corpo)) {
        reprovacoes.push(
          "INVOCAÇÃO TOLERADA: o passo `" + passo.nome + "` tem `continue-on-error` — " +
          "o job deixaria de depender do resultado."
        );
      }
    }
  }

  // --- o ARTEFATO ----------------------------------------------------------
  const upload = passos.filter((p) => /uses:\s*actions\/upload-artifact@v[0-9]+/.test(p.corpo));
  if (upload.length !== 1) {
    reprovacoes.push(
      "ARTEFATO: o passo de upload tem de existir exatamente uma vez (encontrados: " + upload.length +
      ") — sem ele a saída da corrida morre com o runner."
    );
  } else {
    const corpo = upload[0].corpo;
    if (!/^\s+if:\s*always\(\)\s*$/m.test(corpo)) {
      reprovacoes.push(
        "ARTEFATO SEM `always()`: condição comum desliga o upload justamente quando o job falha, " +
        "que é quando o rastro importa."
      );
    }
    if (!/^\s+name:\s*\S/m.test(corpo)) {
      reprovacoes.push("ARTEFATO SEM NOME: não dá para achar o que não se nomeia.");
    }
    if (!/^\s+if-no-files-found:\s*error\s*$/m.test(corpo)) {
      reprovacoes.push(
        "ARTEFATO PODE SUBIR VAZIO: `if-no-files-found` não está em `error` — um upload que não " +
        "encontra arquivo nenhum e termina verde publica ausência com cara de rastro."
      );
    }

    const mPath = /^\s+path:\s*(.+?)\s*$/m.exec(corpo);
    if (!mPath) {
      reprovacoes.push("ARTEFATO SEM `path:`: não arquiva coisa nenhuma.");
    } else {
      const arquivado = normalizarCaminho(mPath[1]);
      const veredito = passos.find(
        (p) => /node\s+ci\/portao_do_ci\.js/.test(p.corpo) && !/--resumo/.test(p.corpo)
      );
      if (!veredito) {
        reprovacoes.push("ARTEFATO SEM REFERÊNCIA: não há passo de veredito para comparar o caminho.");
      } else {
        const lidos = (veredito.corpo.match(/"\$EVIDENCIA\/[A-Za-z0-9._-]+"/g) || []).map(normalizarCaminho);
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
  const resumo = passos.filter((p) => /--resumo/.test(p.corpo));
  if (resumo.length !== 1) {
    reprovacoes.push(
      "RESUMO: o passo tem de existir exatamente uma vez (encontrados: " + resumo.length + ")."
    );
  } else {
    const corpo = resumo[0].corpo;
    if (!/^\s+if:\s*always\(\)\s*$/m.test(corpo)) {
      reprovacoes.push(
        "RESUMO SEM `always()`: executado só em sucesso, ele descreve exatamente os runs que " +
        "ninguém precisa ler."
      );
    }
    if (!/node\s+ci\/portao_do_ci\.js\s+--resumo/.test(corpo)) {
      reprovacoes.push(
        "RESUMO NÃO VEM DO JUIZ: texto escrito à mão descreve o que alguém quis dizer, não o que a " +
        "corrida fez."
      );
    }
    if (!/>>\s*"\$GITHUB_STEP_SUMMARY"/.test(corpo)) {
      reprovacoes.push(
        "RESUMO NÃO É ESCRITO NO PAINEL: calculado e jogado fora não é auditabilidade."
      );
    }
    if (/[^>]>\s*"\$GITHUB_STEP_SUMMARY"/.test(corpo)) {
      reprovacoes.push("RESUMO TRUNCA O PAINEL (`>`) em vez de anexar (`>>`).");
    }
    if (!/"\$EVIDENCIA\/npm-test\.txt"\s+"\$EVIDENCIA\/exit\.txt"/.test(corpo)) {
      reprovacoes.push(
        "RESUMO LÊ OUTRA EVIDÊNCIA: dois relatos da mesma corrida são um relato a mais do que existe."
      );
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
        tests: 814, suites: 87, pass: 814, fail: 0,
        cancelled: 0, skipped: 0, todo: 0, duration_ms: 109123.79,
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
      "guardião, inventário e artefato produtivo) continuam invocadas.\n"
    );
    return 0;
  }
  process.stdout.write("AUDITABILIDADE REPROVADA — " + reprovacoes.length + " motivo(s):\n");
  for (const m of reprovacoes) process.stdout.write("  * " + m + "\n");
  return 1;
}

module.exports = {
  CAMINHO_RELATIVO_DO_WORKFLOW, INVOCACOES_OBRIGATORIAS, TERMOS_DO_RESUMO, TAMANHO_MINIMO_DO_RESUMO,
  semComentarios, semComentariosDeLinha, passosDo, normalizarCaminho,
  CHAMADAS_DO_PRETEST, conferirCadeiaDoPretest, conferirAuditabilidade, principal,
};

if (require.main === module) process.exit(principal());
