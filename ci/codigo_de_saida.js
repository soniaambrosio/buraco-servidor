// ci/codigo_de_saida.js — O PASSO DEPENDE DO RESULTADO? (OS 54-C6, §1 e §3).
//
// ===========================================================================
// A PERGUNTA QUE FALTAVA
// ===========================================================================
//
// A OS 54-C5 fechou "isso vai RODAR?". `ci/invocacao_executavel.js` lê o `run:`
// como o runner leria e recusa `echo`, `printf`, heredoc, string, atribuição,
// comentário e chamada inalcançável. É uma autoridade de verdade, e continua
// valendo.
//
// A OS 54-R5 mostrou que ela responde a pergunta errada sozinha. Medido de
// ponta a ponta, com uma suíte realmente vermelha:
//
//     run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt" || echo "seguimos"
//
//     juiz     -> imprime "PORTÃO VERMELHO — 3 reprovação(ões)", sai com 1
//     passo    -> sai com 0
//     job      -> VERDE
//
// O juiz EXECUTOU. A autoridade da C5 aprovava com razão: a pergunta dela é
// "isso vai rodar?", e a resposta era sim. O que ninguém perguntava era **o
// passo depende do resultado disso?** — e num campo de shell livre a resposta
// padrão é "depende do script inteiro", nunca "depende deste comando".
//
// A R5 também mostrou que lista negra não cobre o eixo: `CI-05` proibia
// `|| true`, `|| exit 0` e `|| :`, e `|| echo` e `|| /bin/true` passavam por
// baixo. Lista negra vaza por construção — ela enumera o que alguém lembrou.
//
// ===========================================================================
// AS DUAS METADES DA CORREÇÃO
// ===========================================================================
//
// 1. O PASSO DECISIVO SAIU DO CAMPO DE SHELL. O veredito deixou de ser um
//    `run:` e passou a ser `uses: ./.github/actions/portao` — uma ação
//    JavaScript local. O runner executa `runs.main` com Node e usa o CÓDIGO DE
//    SAÍDA DO PROCESSO como resultado do passo. `run:` e `uses:` são
//    mutuamente exclusivos no mesmo passo: não sobrou campo onde compor. Não é
//    uma proibição a mais na lista — é a lista inteira ficando sem objeto.
//
// 2. OS PASSOS QUE CONTINUAM EM `run:` passaram a aceitar UMA forma só: um
//    COMANDO SIMPLES, sozinho no script. Isso não é lista negra e não modela
//    bash. É uma propriedade decidível: se o script tem exatamente uma linha
//    lógica, nenhum separador (`;`, `&&`, `||`, `|`, `&`, agrupamento),
//    nenhum redirecionamento e exatamente um comando, então — sob qualquer
//    shell — o código de saída do script É o código de saída daquele comando.
//    Tudo o que não couber nessa forma é RECUSADO, inclusive o que seria
//    inofensivo. Fail-closed é a única leitura que serve para um portão.
//
//    Isso fecha o escape `E9` da R5, que era `|| echo` no GUARDIÃO — a mesma
//    doença no passo do lado.
//
// ===========================================================================
// A LEITURA NÃO É SÓ ESTRUTURAL: A AÇÃO É EXECUTADA
// ===========================================================================
//
// Conferir que `action.yml` diz `main: index.js` mede texto, e a OS 54-R4 já
// ensinou o que texto vale. Por isso esta autoridade EXECUTA o entrypoint
// declarado (o que `runs.main` apontar, e não um caminho escrito aqui) contra
// evidência forjada, e exige a INVARIANTE:
//
//     código de saída do entrypoint === código de saída do juiz
//
// para a mesma evidência, nos dois sentidos. Um entrypoint que traduza, engula
// ou invente código de saída reprova rodando, e não por parecer suspeito.
//
// O que NÃO mora aqui: a trava anti-vácuo ("evidência aprovada continua
// aprovada") vive em `test/codigo_de_saida.test.js`, que controla a árvore
// inteira. Aqui a invariante é de IGUALDADE justamente para nunca reprovar uma
// árvore que esteja vermelha por outro motivo — vermelho pelo motivo errado
// esconde o que estava sendo medido.
//
// ===========================================================================
// AS DUAS METADES SE VIGIAM
// ===========================================================================
//
//   * esta autoridade roda no `pretest` (por `test/guarda_do_portao.js`) e
//     dentro de `ci/auditabilidade.js`, que é um PASSO PRÓPRIO do workflow e
//     roda ANTES do passo do juiz;
//   * `test/codigo_de_saida.test.js` a exercita de dentro do `npm test`, com
//     piso próprio, casos nominais e censo.
//
// Apagar este arquivo quebra o `require` das duas pontas. Trivializá-lo deixa
// a suíte vermelha. Apagar a suíte cai no censo, no piso declarado e no
// inventário por execução. Nenhuma das metades é suficiente sozinha, e é assim
// que tem de ser.

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const EXECUTAVEL = require("./invocacao_executavel.js");

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BARRA = String.fromCharCode(92);

const CAMINHO_RELATIVO_DO_WORKFLOW = path.join(".github", "workflows", "provas-do-servidor.yml");

// ---------------------------------------------------------------------------
// 1. O CONTRATO — escrito aqui, e não no arquivo vigiado
// ---------------------------------------------------------------------------

/** O passo decisivo, e a forma EXATA que ele aceita. */
const PASSO_DO_JUIZ = "Portão fail-closed";

/** O diretório da ação local, relativo à raiz do repositório. */
const DIRETORIO_DA_ACAO = path.join(".github", "actions", "portao");

/** O valor EXATO de `uses:`. Caminho relativo com `./` — é o que faz o runner
 *  usar a ação do PRÓPRIO checkout em vez de baixar algo de fora. */
const USES_DO_JUIZ = "./.github/actions/portao";

/** Os únicos atributos que o passo do juiz pode ter. Um quarto atributo é
 *  reprovação sem análise de conteúdo: `if:`, `continue-on-error:`, `shell:`,
 *  `env:`, `timeout-minutes:` e o que mais alguém invente entram todos por
 *  aqui, e nenhum deles tem o que fazer num passo cujo trabalho é devolver um
 *  código de saída. */
const ATRIBUTOS_DO_JUIZ = Object.freeze(["name", "uses", "with"]);

/** As entradas da ação, com o valor exato. Elas são o endereço da evidência, e
 *  trocar o endereço é julgar outra corrida. */
const ENTRADAS_DO_JUIZ = Object.freeze({
  saida: "${{ env.EVIDENCIA }}/npm-test.txt",
  marcador: "${{ env.EVIDENCIA }}/exit.txt",
});

/** O runtime da ação, FIXADO. Ele não é escolha de gosto: o runner só executa
 *  ações JavaScript nos runtimes que conhece, e um valor inventado faz o passo
 *  morrer na inicialização — vermelho, mas pelo motivo errado e sem julgar
 *  nada. Está amarrado ao `node-version:` do `setup-node` do mesmo workflow. */
const RUNTIME_DA_ACAO = "node24";
const VERSAO_DO_NODE_NO_WORKFLOW = "24";

/** O entrypoint declarado. O nome está aqui para o caso de ele SUMIR; quem
 *  decide qual arquivo é executado é o `runs.main` do `action.yml`, e é esse
 *  que a prova comportamental executa. */
const ENTRYPOINT_DA_ACAO = "index.js";

/** As entradas que `action.yml` tem de declarar, e todas obrigatórias. */
const ENTRADAS_DECLARADAS = Object.freeze(["saida", "marcador"]);

/** Os passos que continuam em `run:` E cujo código de saída é o veredito
 *  deles. Cada um só aceita um COMANDO SIMPLES sozinho no script.
 *
 *  O passo das PROVAS não está aqui de propósito: ele existe justamente para
 *  ABSORVER o código de saída do `npm test` e gravá-lo num marcador, e é o juiz
 *  quem julga o marcador. E o passo do RESUMO também não: ele roda com
 *  `always()`, escreve no painel e não decide nada. Autoridade aplicada onde
 *  não cabe reprova o repositório íntegro. */
const PASSOS_DE_COMANDO_UNICO = Object.freeze([
  Object.freeze({ passo: "Guardião da auditabilidade", alvo: "ci/auditabilidade.js" }),
  Object.freeze({ passo: "Inventário por execução", alvo: "ci/inventario_de_execucao.js" }),
  Object.freeze({ passo: "Artefato produtivo único", alvo: "ci/artefato.js" }),
  // [OS 54-C6] E O PASSO DESTA AUTORIDADE. Ela guarda a si mesma pelo mesmo
  // critério que aplica aos outros: quem puder compor o passo que confere a
  // composição desliga a conferência sem tocar em mais nada. Que o passo
  // EXISTA é cobrado por `ci/auditabilidade.js`, que é outro arquivo — nenhuma
  // peça responde sozinha pela própria presença.
  Object.freeze({ passo: "Preservação do código de saída", alvo: "ci/codigo_de_saida.js" }),
  // [OS 54-C7] E o passo da autoridade do conteúdo nominal. Mesma regra, mesmo
  // motivo: um passo que pode ser composto é um passo cujo veredito não chega
  // ao job.
  Object.freeze({ passo: "Conteúdo dos casos nominais", alvo: "ci/pisos_autorizados.js" }),
]);

// ---------------------------------------------------------------------------
// 2. LEITURA ESTRUTURAL DO PASSO — atributos com aninhamento
// ---------------------------------------------------------------------------

const recuoDe = (linha) => (/^[ ]*/.exec(linha) || [""])[0].length;

/** Tira aspas de um escalar, e SÓ quando os dois lados existem. */
function semAspas(texto) {
  const t = String(texto).trim();
  for (const aspa of ['"', "'"]) {
    if (t.length >= 2 && t[0] === aspa && t[t.length - 1] === aspa && !t.slice(1, -1).includes(aspa)) {
      return t.slice(1, -1);
    }
  }
  return t;
}

/** Os atributos de um passo, COM um nível de aninhamento.
 *
 *  `EXECUTAVEL.passosDoWorkflow` devolve os atributos achatados — `with:` e as
 *  chaves de dentro dele saem no mesmo mapa. Achatado serve para perguntar "tem
 *  `if:`?"; não serve para dizer "os atributos são EXATAMENTE estes três", que
 *  é a pergunta desta autoridade. Uma chave de dentro do `with:` não pode
 *  contar como atributo do passo, e uma chave repetida não pode desaparecer.
 *
 *  Devolve `[{ chave, valor, filhos: [{ chave, valor }] }]`, na ordem do
 *  arquivo e SEM deduplicar: duplicata é informação. */
function atributosDoPasso(passo) {
  const linhas = String(passo.corpo).split(CR + NL).join(NL).split(NL);
  const base = passo.recuo + 2;
  const atributos = [];
  let atual = null;

  for (let i = 0; i < linhas.length; i++) {
    const bruta = linhas[i];
    if (bruta.trim() === "" || /^\s*#/.test(bruta)) continue;
    // A primeira linha é `- name: X`; o traço ocupa o lugar do recuo do atributo.
    const linha = i === 0 ? bruta.replace(/^(\s*)-(\s)/, "$1 $2") : bruta;
    const recuo = recuoDe(linha);
    if (recuo < base) break;

    const par = /^\s*([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(linha);
    if (!par) continue;
    const valor = semAspas(EXECUTAVEL.semComentarioDeFluxo(par[2]));

    if (recuo === base) {
      atual = { chave: par[1], valor, filhos: [] };
      atributos.push(atual);
    } else if (atual) {
      atual.filhos.push({ chave: par[1], valor });
    }
  }
  return atributos;
}

/** Todos os passos com um dado nome. Plural de propósito: `passoChamado`
 *  devolve o PRIMEIRO, e um segundo passo com o mesmo nome — um deles
 *  permissivo — é uma das sabotagens que esta OS existe para reprovar. */
function passosChamados(passos, nome) {
  return passos.filter((p) => p.nome === nome);
}

// ---------------------------------------------------------------------------
// 3. UM COMANDO SIMPLES, E NADA ALÉM DISSO
// ---------------------------------------------------------------------------

/** Os separadores de shell presentes numa linha lógica, FORA de aspas.
 *
 *  Varredura própria, e não reaproveitada de `pedacosDe`: aquela função filtra
 *  pedaços vazios, então `cmd &` — o comando em segundo plano, cujo código de
 *  saída o script NÃO espera — sai de lá como um pedaço só e pareceria simples.
 *  Aqui o que interessa não são os pedaços: são os SEPARADORES, e a resposta
 *  certa para `cmd &` é "tem um separador".
 *
 *  `2>&1`, `>&2` e `&>arquivo` são redirecionamento, não separador — mas
 *  também não são permitidos na forma canônica, e saem na lista própria. */
function separadoresDe(logica) {
  const achados = [];
  const texto = String(logica);
  let aspa = null;
  const DUPLOS = ["&&", "||", ";;"];
  const SIMPLES = [";", "|", "&", "(", ")", "{", "}"];

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspa) {
      if (c === BARRA && aspa === '"' && i + 1 < texto.length) { i++; continue; }
      if (c === aspa) aspa = null;
      continue;
    }
    if (c === BARRA && i + 1 < texto.length) { i++; continue; }
    if (c === '"' || c === "'") { aspa = c; continue; }

    // `&` DE REDIRECIONAMENTO (`2>&1`, `>&2`, `&>arquivo`) NÃO É SEPARADOR.
    // A distinção custou uma leitura na C5, e vale igual aqui: quem a perde
    // parte `npm test > "$E/npm-test.txt" 2>&1` no meio e mede outra coisa.
    if (c === "&" && texto[i + 1] !== "&") {
      const anterior = texto.slice(0, i).replace(/\s+$/, "").slice(-1);
      if (anterior === ">" || anterior === "<" || texto[i + 1] === ">") continue;
    }

    const dois = texto.slice(i, i + 2);
    if (DUPLOS.includes(dois)) { achados.push(dois); i++; continue; }
    if (SIMPLES.includes(c)) { achados.push(c); continue; }
  }
  return achados;
}

/** Redirecionamentos presentes numa linha lógica, fora de aspas. */
function redirecionamentosDe(logica) {
  const achados = [];
  const texto = String(logica);
  let aspa = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspa) {
      if (c === BARRA && aspa === '"' && i + 1 < texto.length) { i++; continue; }
      if (c === aspa) aspa = null;
      continue;
    }
    if (c === BARRA && i + 1 < texto.length) { i++; continue; }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (c === ">" || c === "<") { achados.push(c); continue; }
  }
  return achados;
}

/** O script é UM COMANDO SIMPLES executando `binario` sobre `alvo`?
 *
 *  A pergunta não é "existe uma invocação?" — essa é da C5. É "o script INTEIRO
 *  é essa invocação, e nada mais?". Quando a resposta é sim, o código de saída
 *  do script é o do comando por definição do shell, e não por leitura de caso
 *  particular: não há segundo comando para vir depois, não há `||` para
 *  absorver, não há cano para trocar o código pelo do último estágio, não há
 *  `&` para não esperar.
 *
 *  Devolve `{ ok, motivo, comando }`. Duas leituras independentes têm de
 *  concordar — a varredura própria de separadores e a tokenização de
 *  `ci/invocacao_executavel.js` —, e discordância é RECUSA. */
function comandoUnicoSimples(script, exigencia) {
  const e = exigencia || {};
  const binario = e.binario || "node";
  const alvo = String(e.alvo || "").replace(/^\.\//, "");

  const logicas = EXECUTAVEL.linhasLogicas(script);
  if (logicas.length === 0) {
    return { ok: false, motivo: "o script do passo não tem comando nenhum — passo vazio não executa nada" };
  }
  if (logicas.length > 1) {
    return {
      ok: false,
      motivo: "o script do passo tem " + logicas.length + " linhas de comando, e a forma canônica é UMA — " +
        "com duas, o código de saída do passo é o da última, e o veredito da primeira vira decoração",
    };
  }

  const logica = logicas[0];
  const separadores = separadoresDe(logica);
  if (separadores.length > 0) {
    return {
      ok: false,
      motivo: "o comando é composto por `" + [...new Set(separadores)].join("`, `") + "` — " +
        "composição de shell é exatamente onde o código de saída do alvo deixa de ser o código de " +
        "saída do passo (`|| echo` engole, `|` troca pelo último estágio, `&` nem espera)",
    };
  }

  const redirecionamentos = redirecionamentosDe(logica);
  if (redirecionamentos.length > 0) {
    return {
      ok: false,
      motivo: "o comando redireciona (`" + [...new Set(redirecionamentos)].join("`, `") + "`) — " +
        "num passo cujo trabalho é reprovar, esconder a saída é esconder o motivo, e heredoc entra " +
        "por esta mesma porta",
    };
  }

  const comandos = EXECUTAVEL.comandosDe(script);
  if (comandos.length !== 1) {
    return {
      ok: false,
      motivo: "as duas leituras discordam: nenhum separador foi visto, mas a tokenização achou " +
        comandos.length + " comando(s) — forma não classificada é forma RECUSADA",
    };
  }

  const comando = comandos[0];
  if (comando.cabeca === null) {
    return { ok: false, motivo: "o script é só uma atribuição de variável, e atribuição não executa nada" };
  }
  if (comando.cabeca !== binario) {
    return {
      ok: false,
      motivo: "o comando é executado por `" + comando.cabeca + "`, e não por `" + binario +
        "` — interpretador intermediário devolve o código DELE, e nada garante que seja o do alvo",
    };
  }
  if (!comando.argumentos.some((a) => a.replace(/^\.\//, "") === alvo)) {
    return {
      ok: false,
      motivo: "o comando não recebe `" + alvo + "` como palavra própria — o passo executa outra coisa",
    };
  }
  if (!comando.alcancavel || comando.profundidade !== 0) {
    return {
      ok: false,
      motivo: "o comando não está no nível de cima do script, ou vem depois de uma saída antecipada — " +
        "escrito e inalcançável",
    };
  }

  return { ok: true, motivo: null, comando };
}

// ---------------------------------------------------------------------------
// 4. O PASSO DO JUIZ — forma estruturalmente única
// ---------------------------------------------------------------------------

/** Os caminhos de evidência que o passo do juiz de fato julga.
 *
 *  Exportado porque `ci/auditabilidade.js` compara o que é ARQUIVADO com o que
 *  é JULGADO, e desde a C6 o que é julgado vem das ENTRADAS DA AÇÃO, não dos
 *  argumentos de um comando. Duas leituras do mesmo endereço seriam duas
 *  verdades. */
function caminhosJulgados(passos) {
  const encontrados = passosChamados(passos, PASSO_DO_JUIZ);
  if (encontrados.length !== 1) return null;
  const atributos = atributosDoPasso(encontrados[0]);
  const com = atributos.find((a) => a.chave === "with");
  if (!com) return null;
  const valores = [];
  for (const chave of ENTRADAS_DECLARADAS) {
    const filho = com.filhos.find((f) => f.chave === chave);
    if (!filho) return null;
    valores.push(filho.valor);
  }
  return valores;
}

function conferirPassoDoJuiz(passos) {
  const reprovacoes = [];
  const encontrados = passosChamados(passos, PASSO_DO_JUIZ);

  if (encontrados.length === 0) {
    reprovacoes.push(
      "VEREDITO SEM PASSO: o workflow não tem passo chamado `" + PASSO_DO_JUIZ + "` — passo que não " +
      "existe não reprova nada, e um job sem juiz termina verde por omissão."
    );
    return reprovacoes;
  }
  if (encontrados.length > 1) {
    reprovacoes.push(
      "VEREDITO DUPLICADO: há " + encontrados.length + " passos chamados `" + PASSO_DO_JUIZ + "` — " +
      "com dois, basta que o segundo seja permissivo, e toda guarda que procura `o passo` encontra " +
      "só o primeiro."
    );
    return reprovacoes;
  }

  const passo = encontrados[0];
  const atributos = atributosDoPasso(passo);
  const chaves = atributos.map((a) => a.chave);

  const repetidos = chaves.filter((c, i) => chaves.indexOf(c) !== i);
  if (repetidos.length > 0) {
    reprovacoes.push(
      "VEREDITO COM ATRIBUTO REPETIDO: `" + [...new Set(repetidos)].join("`, `") + "` aparece mais de " +
      "uma vez no passo — em YAML a última declaração vence, e duas declarações são duas verdades."
    );
  }

  const sobrando = chaves.filter((c) => !ATRIBUTOS_DO_JUIZ.includes(c));
  if (sobrando.length > 0) {
    reprovacoes.push(
      "VEREDITO COM ATRIBUTO ESTRANHO: `" + [...new Set(sobrando)].join("`, `") + "` — o passo do " +
      "veredito aceita `" + ATRIBUTOS_DO_JUIZ.join("`, `") + "` e mais nada. `run:` devolve o campo de " +
      "shell que a R5 usou; `if:` desliga sem apagar; `continue-on-error:` perdoa; `shell:` troca o " +
      "intérprete. Nenhum tem o que fazer aqui."
    );
  }
  const faltando = ATRIBUTOS_DO_JUIZ.filter((c) => !chaves.includes(c));
  if (faltando.length > 0) {
    reprovacoes.push(
      "VEREDITO INCOMPLETO: falta `" + faltando.join("`, `") + "` no passo `" + PASSO_DO_JUIZ + "`."
    );
    return reprovacoes;
  }

  const uses = atributos.find((a) => a.chave === "uses");
  if (uses.valor !== USES_DO_JUIZ) {
    reprovacoes.push(
      "VEREDITO EM OUTRA AÇÃO: o passo usa `" + uses.valor + "` e o contrato diz `" + USES_DO_JUIZ +
      "` — ação trocada é juiz trocado, e uma referência que não começa por `./` sai do checkout."
    );
  }

  const com = atributos.find((a) => a.chave === "with");
  const entradas = com.filhos.map((f) => f.chave);
  const extras = entradas.filter((c) => !ENTRADAS_DECLARADAS.includes(c));
  if (extras.length > 0) {
    reprovacoes.push(
      "VEREDITO COM ENTRADA ESTRANHA: `" + extras.join("`, `") + "` não é entrada da ação do portão."
    );
  }
  for (const chave of ENTRADAS_DECLARADAS) {
    const filho = com.filhos.find((f) => f.chave === chave);
    if (!filho) {
      reprovacoes.push(
        "VEREDITO SEM `" + chave + "`: a ação exige as duas entradas, e entrada ausente chega ao " +
        "entrypoint como vazia."
      );
      continue;
    }
    if (filho.valor !== ENTRADAS_DO_JUIZ[chave]) {
      reprovacoes.push(
        "VEREDITO SOBRE OUTRA EVIDÊNCIA: `" + chave + "` aponta para `" + filho.valor +
        "` e o contrato diz `" + ENTRADAS_DO_JUIZ[chave] + "` — julgar outro arquivo é julgar outra corrida."
      );
    }
  }

  return reprovacoes;
}

// ---------------------------------------------------------------------------
// 5. A AÇÃO LOCAL — forma exata, e executada de verdade
// ---------------------------------------------------------------------------

/** Um leitor de `action.yml` do tamanho do que precisamos: dois níveis de
 *  aninhamento, escalares simples. Não é um parser de YAML e não finge ser —
 *  qualquer coisa que ele não entenda vira ausência, e ausência é reprovação. */
function lerManifestoDaAcao(bruto) {
  const linhas = String(bruto).split(CR + NL).join(NL).split(NL);
  const raiz = new Map();
  let atual = null;
  let neto = null;
  let recuoDoNeto = -1;

  for (const bruta of linhas) {
    if (bruta.trim() === "" || /^\s*#/.test(bruta)) continue;
    const par = /^(\s*)([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(bruta);
    if (!par) continue;
    const recuo = par[1].length;
    const chave = par[2];
    const valor = semAspas(EXECUTAVEL.semComentarioDeFluxo(par[3]));

    if (recuo === 0) {
      atual = { valor, filhos: new Map() };
      raiz.set(chave, atual);
      neto = null;
      recuoDoNeto = -1;
      continue;
    }
    if (!atual) continue;
    if (neto === null || recuo <= recuoDoNeto) {
      neto = { valor, filhos: new Map() };
      recuoDoNeto = recuo;
      atual.filhos.set(chave, neto);
      continue;
    }
    neto.filhos.set(chave, { valor, filhos: new Map() });
  }
  return raiz;
}

function conferirManifestoDaAcao(raiz) {
  const reprovacoes = [];
  const relativo = DIRETORIO_DA_ACAO.split(path.sep).join("/");
  const caminho = path.join(raiz, DIRETORIO_DA_ACAO, "action.yml");
  if (!fs.existsSync(caminho)) {
    reprovacoes.push(
      "AÇÃO DO PORTÃO AUSENTE: `" + relativo + "/action.yml` não existe — o passo do veredito aponta " +
      "para uma ação que não está no checkout, e um `uses:` que não resolve derruba o job antes de " +
      "qualquer julgamento."
    );
    return { reprovacoes, entrypoint: null };
  }

  let manifesto;
  try {
    manifesto = lerManifestoDaAcao(fs.readFileSync(caminho, "utf8"));
  } catch (erro) {
    return { reprovacoes: ["AÇÃO DO PORTÃO ILEGÍVEL: " + ((erro && erro.message) || erro)], entrypoint: null };
  }

  const runs = manifesto.get("runs");
  if (!runs) {
    reprovacoes.push("AÇÃO SEM `runs:`: sem isso o runner não sabe o que executar.");
    return { reprovacoes, entrypoint: null };
  }

  const using = runs.filhos.get("using");
  if (!using || using.valor !== RUNTIME_DA_ACAO) {
    reprovacoes.push(
      "RUNTIME DA AÇÃO TROCADO: `runs.using` é `" + (using ? using.valor : "(ausente)") +
      "` e o contrato fixa `" + RUNTIME_DA_ACAO + "` — runtime que o runner não conhece mata o passo " +
      "na inicialização, e runtime mais velho que o `engines` do repositório roda o juiz noutro Node."
    );
  }

  const main = runs.filhos.get("main");
  if (!main || main.valor !== ENTRYPOINT_DA_ACAO) {
    reprovacoes.push(
      "ENTRYPOINT TROCADO: `runs.main` é `" + (main ? main.valor : "(ausente)") + "` e o contrato diz `" +
      ENTRYPOINT_DA_ACAO + "` — trocar o arquivo executado troca o programa sem tocar no workflow."
    );
  }
  if (runs.filhos.get("pre") || runs.filhos.get("post")) {
    reprovacoes.push(
      "AÇÃO COM `pre`/`post`: a ação do portão faz uma coisa só, e um passo interno a mais é um lugar " +
      "a mais onde o código de saída pode ser reescrito."
    );
  }

  const entradas = manifesto.get("inputs");
  if (!entradas) {
    reprovacoes.push("AÇÃO SEM `inputs:`: as duas entradas são o endereço da evidência.");
  } else {
    const declaradas = [...entradas.filhos.keys()];
    const faltando = ENTRADAS_DECLARADAS.filter((c) => !declaradas.includes(c));
    if (faltando.length > 0) {
      reprovacoes.push("AÇÃO SEM A ENTRADA `" + faltando.join("`, `") + "`.");
    }
    const sobrando = declaradas.filter((c) => !ENTRADAS_DECLARADAS.includes(c));
    if (sobrando.length > 0) {
      reprovacoes.push("AÇÃO COM ENTRADA ESTRANHA: `" + sobrando.join("`, `") + "`.");
    }
    for (const chave of ENTRADAS_DECLARADAS) {
      const entrada = entradas.filhos.get(chave);
      if (!entrada) continue;
      const obrigatoria = entrada.filhos.get("required");
      if (!obrigatoria || String(obrigatoria.valor) !== "true") {
        reprovacoes.push(
          "ENTRADA `" + chave + "` DEIXOU DE SER OBRIGATÓRIA: entrada opcional chega vazia sem que " +
          "ninguém reclame, e o juiz passaria a julgar um caminho que não existe."
        );
      }
    }
  }

  const nomeDoEntrypoint = main && main.valor ? main.valor : ENTRYPOINT_DA_ACAO;
  const entrypoint = path.join(raiz, DIRETORIO_DA_ACAO, nomeDoEntrypoint);
  if (!fs.existsSync(entrypoint)) {
    reprovacoes.push("ENTRYPOINT AUSENTE: `" + nomeDoEntrypoint + "` não existe dentro de `" + relativo + "`.");
    return { reprovacoes, entrypoint: null };
  }
  return { reprovacoes, entrypoint };
}

// ---------------------------------------------------------------------------
// 6. A PROVA COMPORTAMENTAL — o entrypoint é EXECUTADO
// ---------------------------------------------------------------------------

/** Uma evidência de mentirinha, com o rodapé completo e os dois ecos do npm.
 *  Não é prova de corrida nenhuma e não vale como tal: serve para fazer o juiz
 *  falar duas vezes, com a mesma entrada, por dois caminhos diferentes. */
function evidenciaForjada(dir, exit, casos, suites) {
  const linhas = [
    "> buraco-master-vip-servidor@1.0.0 test",
    '> node --test "test/*.test.js"',
    "",
    "ℹ tests " + casos,
    "ℹ suites " + suites,
    "ℹ pass " + casos,
    "ℹ fail 0",
    "ℹ cancelled 0",
    "ℹ skipped 0",
    "ℹ todo 0",
    "ℹ duration_ms 100000.5",
    "",
  ];
  const saida = path.join(dir, "npm-test.txt");
  const marcador = path.join(dir, "exit.txt");
  fs.writeFileSync(saida, linhas.join(NL), "utf8");
  fs.writeFileSync(marcador, String(exit), "utf8");
  return { saida, marcador };
}

function pisoDaArvore(raiz) {
  try {
    const piso = JSON.parse(fs.readFileSync(path.join(raiz, "ci", "piso_do_portao.json"), "utf8"));
    return { casos: Number(piso.casos_minimos) || 1, suites: Number(piso.suites_minimas) || 1 };
  } catch (erro) {
    return { casos: 1, suites: 1 };
  }
}

const codigoDe = (execucao) => (typeof execucao.status === "number" ? execucao.status : null);

/** Executa o juiz diretamente. É a referência contra a qual o entrypoint é
 *  comparado — a mesma evidência, os dois caminhos, o mesmo número. */
function rodarJuiz(raiz, evidencia) {
  return codigoDe(spawnSync(
    process.execPath,
    [path.join(raiz, "ci", "portao_do_ci.js"), evidencia.saida, evidencia.marcador, "--raiz", raiz],
    { cwd: raiz, stdio: "ignore", timeout: 120000 }
  ));
}

/** Executa o ENTRYPOINT DECLARADO, do jeito que o runner executa: Node, o
 *  arquivo, e as entradas em `INPUT_*`. */
function rodarEntrypoint(raiz, entrypoint, evidencia) {
  return codigoDe(spawnSync(process.execPath, [entrypoint], {
    cwd: raiz,
    stdio: "ignore",
    timeout: 120000,
    env: Object.assign({}, process.env, {
      GITHUB_WORKSPACE: raiz,
      INPUT_SAIDA: evidencia ? evidencia.saida : "",
      INPUT_MARCADOR: evidencia ? evidencia.marcador : "",
    }),
  }));
}

/** A INVARIANTE, medida rodando: para a mesma evidência, o entrypoint devolve
 *  exatamente o que o juiz devolve. Nos dois sentidos, e mais dois cenários em
 *  que não há evidência nenhuma.
 *
 *  Igualdade, e não "aprovada é zero": esta autoridade roda no `pretest` de
 *  árvores que podem estar vermelhas por outro motivo, e exigir um valor
 *  ABSOLUTO ali reprovaria pelo motivo errado. A trava anti-vácuo mora em
 *  `test/codigo_de_saida.test.js`, que controla a árvore inteira. */
function conferirEntrypointExecutando(raiz, entrypoint) {
  const reprovacoes = [];
  const piso = pisoDaArvore(raiz);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "os54c6-invariante-"));

  try {
    for (const [rotulo, exit] of [["reprovada", 1], ["aprovada", 0]]) {
      const evidencia = evidenciaForjada(dir, exit, piso.casos, piso.suites);
      const doJuiz = rodarJuiz(raiz, evidencia);
      const doEntrypoint = rodarEntrypoint(raiz, entrypoint, evidencia);

      if (doJuiz === null || doEntrypoint === null) {
        reprovacoes.push(
          "CÓDIGO DE SAÍDA INDETERMINADO (evidência " + rotulo + "): juiz=" + String(doJuiz) +
          ", entrypoint=" + String(doEntrypoint) + " — processo sem código de saída é indistinguível " +
          "de reprovado, logo REPROVADO."
        );
        continue;
      }
      if (doJuiz !== doEntrypoint) {
        reprovacoes.push(
          "CÓDIGO DE SAÍDA NÃO PRESERVADO (evidência " + rotulo + "): o juiz devolveu " + doJuiz +
          " e o passo devolveria " + doEntrypoint + " — o entrypoint traduziu o veredito, e traduzir " +
          "é a mesma doença do `|| echo` com outra roupa."
        );
      }
      if (exit === 1 && doJuiz === 0) {
        reprovacoes.push(
          "JUIZ NÃO REPROVA EVIDÊNCIA REPROVADA: com o marcador em 1, o juiz devolveu 0 — a prova " +
          "comportamental perdeu o sentido, porque não sobrou vermelho para preservar."
        );
      }
    }

    const semEvidencia = rodarEntrypoint(raiz, entrypoint, {
      saida: path.join(dir, "nao-existe.txt"),
      marcador: path.join(dir, "nao-existe-exit.txt"),
    });
    if (semEvidencia === 0) {
      reprovacoes.push(
        "AUSÊNCIA VIROU APROVAÇÃO: sem evidência no disco, o passo devolveria 0 — ausência de prova " +
        "nunca é prova de sucesso."
      );
    }

    const semEntradas = rodarEntrypoint(raiz, entrypoint, null);
    if (semEntradas === 0) {
      reprovacoes.push(
        "ENTRADAS VAZIAS VIRARAM APROVAÇÃO: sem `saida` e sem `marcador`, o passo devolveria 0."
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return reprovacoes;
}

// ---------------------------------------------------------------------------
// 7. O VEREDITO
// ---------------------------------------------------------------------------

/** O `setup-node` do workflow e o runtime da ação falam da mesma coisa, e têm
 *  de concordar. Amarração recíproca: mexer num sem mexer no outro reprova. */
function conferirRuntimeAmarrado(passos) {
  const reprovacoes = [];
  const passo = passos.find((p) => /^actions\/setup-node@v[0-9]+$/.test(p.atributos["uses"] || ""));
  if (!passo) {
    reprovacoes.push(
      "SEM `setup-node`: a versão do Node do job deixou de ser explícita, e a ação do portão fixa `" +
      RUNTIME_DA_ACAO + "` — sem os dois lados a amarração não existe."
    );
    return reprovacoes;
  }
  const versao = semAspas(passo.atributos["node-version"] || "");
  if (versao !== VERSAO_DO_NODE_NO_WORKFLOW) {
    reprovacoes.push(
      "RUNTIME DESAMARRADO: o job instala Node `" + versao + "` e a ação do portão roda em `" +
      RUNTIME_DA_ACAO + "` — as duas pontas têm de andar juntas, ou o juiz roda num Node e a suíte noutro."
    );
  }
  return reprovacoes;
}

function conferirComandosUnicos(passos) {
  const reprovacoes = [];
  for (const exigencia of PASSOS_DE_COMANDO_UNICO) {
    const encontrados = passosChamados(passos, exigencia.passo);
    if (encontrados.length === 0) {
      reprovacoes.push(
        "AUTORIDADE SEM PASSO: `" + exigencia.passo + "` não existe no workflow — a reprovação dela " +
        "não chega ao job."
      );
      continue;
    }
    if (encontrados.length > 1) {
      reprovacoes.push(
        "AUTORIDADE DUPLICADA: há " + encontrados.length + " passos chamados `" + exigencia.passo +
        "` — basta que um deles seja permissivo."
      );
      continue;
    }
    const passo = encontrados[0];
    const chaves = atributosDoPasso(passo).map((a) => a.chave);

    for (const proibido of ["if", "continue-on-error", "shell"]) {
      if (chaves.includes(proibido)) {
        reprovacoes.push(
          "AUTORIDADE COM `" + proibido + "`: o passo `" + exigencia.passo + "` deixou de entregar o " +
          "próprio resultado ao job — condicionar, perdoar e trocar o intérprete são três jeitos de " +
          "dizer a mesma coisa."
        );
      }
    }
    if (!passo.run.presente) {
      reprovacoes.push("AUTORIDADE SEM `run:`: o passo `" + exigencia.passo + "` não executa nada.");
      continue;
    }
    const veredito = comandoUnicoSimples(passo.run.script, { binario: "node", alvo: exigencia.alvo });
    if (!veredito.ok) {
      reprovacoes.push(
        "CÓDIGO DE SAÍDA NÃO PRESERVADO em `" + exigencia.passo + "`: " + veredito.motivo + "."
      );
    }
  }
  return reprovacoes;
}

/** O veredito inteiro. Lista vazia significa VERDE. */
function conferirPreservacaoDoCodigo(opcoes) {
  const o = opcoes || {};
  const raiz = o.raiz || path.join(__dirname, "..");
  const reprovacoes = [];
  const caminho = path.join(raiz, CAMINHO_RELATIVO_DO_WORKFLOW);

  if (!fs.existsSync(caminho)) {
    return [
      "WORKFLOW AUSENTE: `" + CAMINHO_RELATIVO_DO_WORKFLOW.split(path.sep).join("/") + "` não existe — " +
      "sem ele não há passo, não há veredito e não há código de saída a preservar.",
    ];
  }

  let passos;
  try {
    passos = EXECUTAVEL.passosDoWorkflow(fs.readFileSync(caminho, "utf8"));
  } catch (erro) {
    return ["WORKFLOW ILEGÍVEL: " + ((erro && erro.message) || erro)];
  }

  for (const m of conferirPassoDoJuiz(passos)) reprovacoes.push(m);
  for (const m of conferirComandosUnicos(passos)) reprovacoes.push(m);
  for (const m of conferirRuntimeAmarrado(passos)) reprovacoes.push(m);

  const manifesto = conferirManifestoDaAcao(raiz);
  for (const m of manifesto.reprovacoes) reprovacoes.push(m);

  // A PROVA COMPORTAMENTAL é cara (quatro processos) e por isso é PEDIDA, não
  // presumida: quem a pede é o passo próprio do workflow, o `pretest` e a
  // suíte. `ci/auditabilidade.js` faz a leitura estrutural em dezenas de
  // árvores forjadas por caso de teste, e ali executar seria dobrar a corrida
  // sem medir nada de novo.
  if (manifesto.entrypoint && o.executar === true) {
    for (const m of conferirEntrypointExecutando(raiz, manifesto.entrypoint)) reprovacoes.push(m);
  }

  return reprovacoes;
}

function principal() {
  const reprovacoes = conferirPreservacaoDoCodigo({ executar: true });
  if (reprovacoes.length === 0) {
    process.stdout.write(
      "CÓDIGO DE SAÍDA PRESERVADO — o veredito é uma ação local sem campo de shell, as autoridades em " +
      "`run:` são comandos simples sozinhos no script, o runtime está amarrado ao do job, e o " +
      "entrypoint devolve EXATAMENTE o código do juiz (medido rodando, nos dois sentidos).\n"
    );
    return 0;
  }
  process.stdout.write("PRESERVAÇÃO DO CÓDIGO DE SAÍDA REPROVADA — " + reprovacoes.length + " motivo(s):\n");
  for (const m of reprovacoes) process.stdout.write("  * " + m + "\n");
  return 1;
}

module.exports = {
  CAMINHO_RELATIVO_DO_WORKFLOW, PASSO_DO_JUIZ, DIRETORIO_DA_ACAO, USES_DO_JUIZ,
  ATRIBUTOS_DO_JUIZ, ENTRADAS_DO_JUIZ, RUNTIME_DA_ACAO, VERSAO_DO_NODE_NO_WORKFLOW,
  ENTRYPOINT_DA_ACAO, ENTRADAS_DECLARADAS, PASSOS_DE_COMANDO_UNICO,
  semAspas, atributosDoPasso, passosChamados,
  separadoresDe, redirecionamentosDe, comandoUnicoSimples,
  caminhosJulgados, conferirPassoDoJuiz,
  lerManifestoDaAcao, conferirManifestoDaAcao,
  evidenciaForjada, rodarJuiz, rodarEntrypoint, conferirEntrypointExecutando,
  conferirRuntimeAmarrado, conferirComandosUnicos, conferirPreservacaoDoCodigo, principal,
};

if (require.main === module) process.exit(principal());
