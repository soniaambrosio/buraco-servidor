// ci/pisos_autorizados.js — OS MÍNIMOS QUE NÃO MORAM EM `test/` (OS 54-C4, §5).
//
// ===========================================================================
// POR QUE OS NÚMEROS PRECISAM DE DOIS ENDEREÇOS
// ===========================================================================
//
// Os pisos por suíte viviam só em `test/censo_de_suites.js`. Uma lista que
// declara os próprios mínimos não se protege: baixar `gate_vip` de 58 para 1 é
// uma edição de um caractere, e a R2 mostrou que ela passava.
//
// Aqui ficam os mínimos EXTERNOS, do lado do CI e fora do conjunto varrido pelo
// glob. A regra é dupla e sem furo de mão única:
//
//   1. o censo não pode DECLARAR abaixo do que está aqui — rebaixar lá reprova
//      aqui, com o nome do arquivo e os dois números na mensagem;
//   2. o piso EFETIVO é o MAIOR dos dois — rebaixar este arquivo sozinho não
//      afrouxa coisa nenhuma, porque o censo continua alto.
//
// O que sobra, dito em voz alta: rebaixar os DOIS ao mesmo tempo é possível, e
// é a intenção — o custo passa a ser uma edição em duas famílias diferentes,
// visível na revisão, em vez de um dígito num arquivo só. E mesmo isso não
// alcança os NOMES OBRIGATÓRIOS abaixo, que não são número nenhum: apagar
// `CI-18` reprova com todos os pisos no chão.
//
// ===========================================================================
// DUAS MEDIDAS DIFERENTES, E ELAS NÃO SE MISTURAM
// ===========================================================================
//
// `MINIMO_DECLARADO_NO_CENSO` é o piso TEXTUAL herdado — o número que o censo
// escreve, e que o próprio censo confere contra o fonte de cada suíte. Ele
// guarda contra rebaixamento da declaração.
//
// `MINIMO_EXECUTADO` é o número de casos que a suíte de fato EXECUTA E APROVA,
// medido pelo stream de eventos do `node:test` com o campo de origem. É a
// autoridade de quantidade desde a OS 54-C2, e não tem relação aritmética com o
// textual: `gate_vip` conta 64 no fonte e executa 49, porque contagem textual
// enxerga `regex.test(`, prosa e chamadas que não são casos. Os dois números
// convivem porque medem coisas diferentes; nenhum deles é derivável do outro.

"use strict";

const crypto = require("node:crypto");

/** Piso TEXTUAL: o mínimo que `test/censo_de_suites.js` pode declarar.
 *
 *  [OS 54-C4] REMEDIDOS SOBRE A ÁRVORE COMPOSTA, e não herdados de folha
 *  nenhuma. A folha da OS 54-C2 media `4577048` e a OS 54-C3 media `99d2eb6`;
 *  esta árvore nasce de `9795df7`, onde a OS 52-C4 acrescentou a suíte da
 *  AUTORIDADE DO ARTEFATO. Mínimo externo abaixo do declarado não protege nada:
 *  ele só reprova o que já reprovaria. Aqui eles acompanham o que o censo
 *  declara HOJE, e a suíte nova entrou com piso próprio. */
const MINIMO_DECLARADO_NO_CENSO = Object.freeze({
  "assento_autoritativo.test.js": 30,
  "descoberta.test.js": 98,
  "costura_assento_descoberta.test.js": 18,
  "chat_transporte.test.js": 31,
  "chat_contrato.test.js": 11,
  "controlador_assento.test.js": 27,
  "gate_vip.test.js": 64,
  "unicidade_do_portador.test.js": 48,
  // [OS 52-C4] A AUTORIDADE do artefato produtivo único, herdada da base
  // homologada. Sem entrada aqui, o piso dela seria editável num arquivo só.
  "artefato_unico.test.js": 54,
  "ci_obrigatorio.test.js": 100,
  // [OS 54-C2, portadas pela OS 54-C4] As duas suítes próprias da cadeia
  // externa: a do guardião do rastro e a do inventário por execução.
  "auditabilidade_ci.test.js": 43,
  "inventario_executado.test.js": 24,
  // [OS 54-C5] A suíte da autoridade das invocações executáveis.
  "invocacao_executavel.test.js": 32,
  // [OS 54-C6] A suíte da preservação do código de saída.
  "codigo_de_saida.test.js": 46,
});

/** Piso EXECUTADO: casos aprovados, por arquivo de origem.
 *
 *  [OS 54-C4] REMEDIDOS NA ÁRVORE COMPOSTA com
 *  `node ci/inventario_de_execucao.js --json`. Herdar os números da OS 54-C3
 *  seria pior do que não ter piso: aquela árvore não tinha
 *  `artefato_unico.test.js`, e a suíte do CI ganhou casos nesta composição.
 *  Piso desatualizado é folga com outro nome.
 *
 *  [OS 54-C5] REMEDIDOS DE NOVO. A suíte do guardião subiu de 28 para 41
 *  casos executados com os doze casos da §2, e a suíte da autoridade das
 *  invocações nasceu com 31. Herdar os números da C4 deixaria vinte e quatro
 *  casos apagáveis sem que o inventário reclamasse. */
const MINIMO_EXECUTADO = Object.freeze({
  "assento_autoritativo.test.js": 34,
  "descoberta.test.js": 98,
  "costura_assento_descoberta.test.js": 15,
  "chat_transporte.test.js": 31,
  "chat_contrato.test.js": 10,
  "controlador_assento.test.js": 37,
  "gate_vip.test.js": 49,
  "unicidade_do_portador.test.js": 112,
  "artefato_unico.test.js": 32,
  "ci_obrigatorio.test.js": 63,
  "auditabilidade_ci.test.js": 41,
  "inventario_executado.test.js": 22,
  "invocacao_executavel.test.js": 31,
  "codigo_de_saida.test.js": 37,
});

/** CASOS NOMINAIS que têm de EXECUTAR E APROVAR, no arquivo indicado.
 *
 *  Isto é o que sobrevive a todo piso no chão. Nome em comentário não executa,
 *  corpo apagado não emite evento, e caso movido para outro arquivo aparece com
 *  outra origem. A R2 derrubou a C1 exatamente por aqui: o bloco inteiro sumia
 *  e o contador textual era reposto com prosa. */
const NOMES_OBRIGATORIOS = Object.freeze({
  "ci_obrigatorio.test.js": Object.freeze([
    "CI-03", // o alvo oficial é executado
    "CI-06", // o veredito é um passo próprio e incondicional
    "CI-13", // o piso global não foi rebaixado
    "CI-18", // o artefato
    "CI-19", // o resumo
    "CI-19b", // o conteúdo do resumo
    "CI-20", // a cadeia externa é invocada pelo workflow
    // [OS 54-C4] A autoridade do piso da OS 52-C3, que na folha de origem não
    // tinha exigência nominal nenhuma. Estes três eram CI-17/18/19 e colidiam
    // com os de cima dentro do MESMO arquivo — a colisão fazia a exigência de
    // `CI-18` ser satisfeita pelo caso errado.
    "CI-21", // o piso ancorado existe e compara commits de verdade
    "CI-22", // o juiz cobra a autoridade do piso, exercitado contra árvore forjada
    "CI-23", // o piso do piso desta suíte acompanha o piso declarado
  ]),
  // [OS 54-C4] REESCRITA SOBRE A SUÍTE REAL desta base. A folha da OS 54-C2
  // exigia `CAP-01`, `PAC-01` e `MAN-01`, que são nomes da OS 52-C2: a OS 52-C3
  // reescreveu esta suíte inteira e nenhum dos três existe mais. Exigir nome
  // que não existe é vermelho pelo motivo errado; exigir só os que existem, e
  // não escolher os que carregam a autoridade, é verde pelo motivo errado. Os
  // nove abaixo cobrem as autoridades que a OS 52-C3 entregou: a árvore inteira
  // varrida, o portador conferido por dentro, o formato pelos BYTES, os ramos
  // acionados por cenário exclusivo, o ramo morto derrubando a prova externa, a
  // capacidade COMPOSTA no escopo `conjunto`, o piso monotônico, a amarração e
  // o alcance do comando oficial.
  "unicidade_do_portador.test.js": Object.freeze([
    "UNI-A1", "UNI-A4", "UNI-F1", "UNI-B2", "UNI-B4",
    "UNI-K2", "UNI-P2", "UNI-P4", "GLOB-04",
  ]),
  // [OS 54-C4] A AUTORIDADE DO ARTEFATO PRODUTIVO ÚNICO, que a folha da
  // auditabilidade não conhecia — ela nasceu numa árvore anterior à OS 52-C4.
  //
  // Sem estes nomes, a composição teria um buraco exatamente do tamanho da
  // pergunta desta OS: os pisos da unicidade poderiam ser satisfeitos por
  // corpos triviais enquanto a auditabilidade ficava verde, e nenhuma das
  // campanhas de origem veria. Os nove cobrem os itens que a §7 manda deixar
  // vermelhos — conjunto ampliado (ART-03, ART-04, ART-23), `server.js` fora do
  // conjunto (ART-01, ART-05), pacote implantável (ART-24), segundo arranque
  // (ART-15) e neutralização da própria guarda (ART-19, ART-22).
  "artefato_unico.test.js": Object.freeze([
    "ART-01", "ART-03", "ART-04", "ART-05", "ART-15",
    "ART-19", "ART-22", "ART-23", "ART-24",
  ]),
  // [OS 54-C5] `AUD-21` é o caso que mata o escape da R4 nas QUATRO
  // autoridades de uma vez; `AUD-29` é o que ancora a exigência no passo
  // canônico; `AUD-31` é a trava anti-vácuo, que impede a autoridade nova de
  // virar um veto geral.
  "auditabilidade_ci.test.js": Object.freeze([
    "AUD-00", "AUD-01", "AUD-06", "AUD-11", "AUD-18",
    "AUD-21", "AUD-25", "AUD-28", "AUD-29", "AUD-31",
  ]),
  "invocacao_executavel.test.js": Object.freeze([
    "EXE-00", "EXE-01", "EXE-02", "EXE-06", "EXE-09", "EXE-09b", "EXE-19",
  ]),
  "inventario_executado.test.js": Object.freeze(["INV-00", "INV-01", "INV-05", "INV-09"]),
  // [OS 54-C6] `SAI-00` é a trava anti-vácuo (a árvore real passa, inclusive
  // rodando); `SAI-04` é o escape material da R5 escrito na forma de hoje;
  // `SAI-09` são as oito composições do Grupo A; `SAI-19` e `SAI-20` são a
  // prova comportamental do §4 — a suíte vermelha de verdade e o `bash -e`.
  "codigo_de_saida.test.js": Object.freeze([
    "SAI-00", "SAI-02", "SAI-04", "SAI-09", "SAI-17", "SAI-18", "SAI-19", "SAI-20", "SAI-22",
    // [OS 54-C7] Os dois casos que carregam a prova nova: `SAI-25` trivializa os
    // dez casos protegidos um a um, e `SAI-29` faz o gesto do recarimbo — a
    // sabotagem que a R6 nomeou e a C6 não pegava.
    "SAI-25", "SAI-29",
  ]),
});

/** [OS 54-C7] O CONTEÚDO MATERIAL DE CADA CASO NOMINAL PROTEGIDO.
 *
 * ===========================================================================
 * POR QUE O PESO EM AFIRMAÇÕES DA OS 54-C6 NÃO BASTAVA
 * ===========================================================================
 *
 * A C6 contava AFIRMAÇÕES (`assert.` e `exigeMotivo(`) e exigia um mínimo. A
 * OS 54-R6 mostrou o preço, e ele é aritmético: `SAI-02` tinha peso 1 porque o
 * corpo dela concentra a afirmação num ajudante. Trocar o corpo inteiro por
 *
 *     assert.ok(true);
 *
 * também dá 1. O caso continuava existindo, executando e APROVANDO, e a cadeia
 * oficial ficava verde (`E36`). Com `SAI-22`, peso 2, bastavam duas afirmações
 * triviais (`E38`). Contar afirmações mede a FORMA da prova, não o conteúdo
 * dela — e a C6 documentou como se fechasse o eixo. Não fechava.
 *
 * ===========================================================================
 * O QUE ESTA TABELA DECLARA
 * ===========================================================================
 *
 * Para cada caso nominal protegido, o PROGRAMA do corpo dele, medido de duas
 * formas independentes:
 *
 *   * `peso`   — quantidade de TOKENS de programa. Comentário não conta;
 *                 literal de string, de template e de expressão regular contam
 *                 UM token cada, seja qual for o tamanho. É isso que faz
 *                 "mover o corpo para dentro de uma string" e "mover o corpo
 *                 para um comentário" colapsarem o número em vez de preservá-lo;
 *   * `digest` — impressão digital do MESMO fluxo de tokens. Ela não perdoa
 *                 mudança material nenhuma, e perdoa reformatação e prosa.
 *
 * Os dois valores são MEDIDOS, nunca escritos de cabeça, e a conferência é de
 * IGUALDADE: declaração que não bate com o corpo é reprovação, para os dois
 * lados. Sem isso a tabela viraria um piso frouxo com aparência de contrato.
 *
 * ===========================================================================
 * POR QUE ISTO NÃO É RECARIMBÁVEL
 * ===========================================================================
 *
 * Sozinha, esta tabela seria recarimbável: quem trivializa o caso e atualiza
 * digest e peso na mesma alteração passa. Ela NÃO está sozinha.
 *
 * `test/piso_ancorado.js` — a autoridade ancorada da OS 52-C3 — passou a ler
 * `ci/pisos_autorizados.js` E os corpos dos casos protegidos DO COMMIT
 * ANTERIOR, que é imutável, e a exigir monotonicidade:
 *
 *   * o conjunto de casos protegidos não pode encolher;
 *   * o `peso` DECLARADO não pode cair;
 *   * o `peso` REAL do corpo, medido hoje, não pode cair abaixo do peso real
 *     que aquele mesmo corpo tinha no commit âncora.
 *
 * A terceira é a que fecha o recarimbo: ela não olha a declaração de hoje nem a
 * de ontem — olha o CORPO de ontem, que nenhuma edição na árvore de trabalho
 * alcança. Trivializar e recarimbar continua deixando o corpo menor do que o
 * commit já registrou.
 *
 * ===========================================================================
 * O LIMITE, DITO EM VOZ ALTA
 * ===========================================================================
 *
 * Isto reprova corpo APAGADO, corpo movido para string, corpo movido para
 * comentário, corpo trocado por ajudante benigno e corpo com afirmações
 * triviais — porque todos encolhem o programa. Não reprova um corpo do MESMO
 * TAMANHO em tokens que não prova nada (enchimento com código inerte). Nenhuma
 * leitura barata separa código forte de código inerte, e fingir que separa foi
 * exatamente o erro da C6. O que existe contra o enchimento é o inventário por
 * execução, o piso ancorado e a campanha — não esta tabela. */
const CONTEUDO_DOS_NOMINAIS = Object.freeze({
  "codigo_de_saida.test.js": Object.freeze({
    "SAI-00": Object.freeze({ peso: 34, digest: "38e95b3eb10b" }),
    "SAI-02": Object.freeze({ peso: 66, digest: "ff88111f22d9" }),
    "SAI-04": Object.freeze({ peso: 67, digest: "6f0c43a40a2c" }),
    "SAI-09": Object.freeze({ peso: 130, digest: "f39abcf5aef1" }),
    "SAI-17": Object.freeze({ peso: 68, digest: "6958e13c94f5" }),
    "SAI-18": Object.freeze({ peso: 68, digest: "70479e4ef4f9" }),
    "SAI-19": Object.freeze({ peso: 420, digest: "7e9b32794cc1" }),
    "SAI-20": Object.freeze({ peso: 221, digest: "339481059725" }),
    "SAI-25": Object.freeze({ peso: 277, digest: "c04a982415a8" }),
    "SAI-29": Object.freeze({ peso: 115, digest: "f08ae16f4273" }),
    "SAI-22": Object.freeze({ peso: 73, digest: "b6739caad039" }),
  }),
  // [OS 54-C7] `UNI-B4` é o caso que a sabotagem `X07` de `mutacoes_cruzada.js`
  // trivializava com o título preservado — e a cadeia oficial ficava verde, na
  // base E na candidata da C6. Ele guarda o RAMO MORTO da prova de unicidade, e
  // a regra funcional da unicidade não foi tocada para fabricar um vermelho: o
  // que passou a ser protegido é a sobrevivência do caso.
  "unicidade_do_portador.test.js": Object.freeze({
    "UNI-B4": Object.freeze({ peso: 89, digest: "94465990e9e5" }),
  }),
});

/** Os corpos dos casos de um arquivo de suíte, por nome.
 *
 *  O recorte vai do começo de um caso até o começo do próximo. A âncora é
 *  ANCORADA NA LINHA — `^\s*(await )?(t.)?test("` — e não solta no texto: sem
 *  isso, um `test(` citado dentro de uma string ou de um comentário abriria um
 *  "caso" fantasma e o recorte do caso anterior terminaria cedo. A OS 54-C7
 *  exige, em voz alta, que nenhum vermelho venha de coincidência de `test(` em
 *  string.
 *
 *  Casar chaves seria uma gramática inteira, e gramática mal feita erra para o
 *  lado errado. Este recorte erra para o lado de INCLUIR demais — o que só
 *  poderia aprovar um caso trivializado se o SEGUINTE fosse gordo, e o seguinte
 *  é medido também. */
function corposDosCasos(fonte) {
  const texto = String(fonte).split("\r\n").join("\n");
  const marca = /^[ \t]*(?:await\s+)?(?:t\.)?test\(\s*"([^"]+)"/gm;
  const achados = [];
  let m;
  while ((m = marca.exec(texto)) !== null) achados.push({ nome: m[1], inicio: m.index });
  const corpos = new Map();
  for (let i = 0; i < achados.length; i++) {
    const fim = i + 1 < achados.length ? achados[i + 1].inicio : texto.length;
    corpos.set(achados[i].nome.split(":")[0].trim(), texto.slice(achados[i].inicio, fim));
  }
  return corpos;
}

/** O FLUXO DE TOKENS do programa de um corpo.
 *
 *  Comentário de linha e de bloco são descartados. Literal de string, de
 *  template e de expressão regular viram UM token cada — `"txt"`, `\`txt\``,
 *  `/re/` —, e é isso que faz "esconder o corpo dentro de uma string" colapsar
 *  o peso em vez de preservá-lo.
 *
 *  A distinção entre expressão regular e divisão é a heurística clássica: uma
 *  barra abre expressão regular quando o token anterior NÃO pode terminar um
 *  valor. Sem ela, uma expressão regular contendo aspas ou crase — e a suíte da
 *  C6 tem várias — abriria uma string fantasma e engoliria o resto do corpo. */
function tokensDoPrograma(corpo) {
  const texto = String(corpo).split("\r\n").join("\n");
  const tokens = [];
  const ultimo = () => (tokens.length ? tokens[tokens.length - 1] : null);
  const FECHA_VALOR = /^(?:[A-Za-z_$][\w$]*|[0-9.]+|\)|\]|\}|(?:str|tpl|re):)/;

  // UM token por literal — mas o token carrega a IMPRESSÃO do conteúdo.
  //
  // Sem a impressão, `SAI-17` e `SAI-18` saíam com o MESMO digest: os dois
  // corpos só diferem nas strings, e um `"str"` genérico apaga a diferença.
  // Trocar o corpo de um pelo do outro passaria por conteúdo íntegro — não é
  // trivialização, mas é um caso provando outra coisa com o mesmo nome.
  //
  // A impressão entra no DIGEST e não no PESO: o peso continua contando UM por
  // literal, e é isso que faz "esconder o corpo dentro de uma string" colapsar
  // o número em vez de preservá-lo.
  const marcaDe = (tipo, conteudo) =>
    tipo + ":" + crypto.createHash("sha256").update(String(conteudo), "utf8").digest("hex").slice(0, 8);

  const BARRA = String.fromCharCode(92);
  const ASPAS = [String.fromCharCode(34), String.fromCharCode(39), String.fromCharCode(96)];
  const CRASE = String.fromCharCode(96);

  let i = 0;
  while (i < texto.length) {
    const c = texto[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }

    // Comentário de linha e de bloco: descartados inteiros. É por aqui que
    // "mover o corpo para um comentário" deixa de preservar peso nenhum.
    if (c === "/" && texto[i + 1] === "/") {
      while (i < texto.length && texto[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && texto[i + 1] === "*") {
      i += 2;
      while (i < texto.length && !(texto[i] === "*" && texto[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (ASPAS.includes(c)) {
      const abre = i;
      i++;
      while (i < texto.length && texto[i] !== c) {
        if (texto[i] === BARRA) i++;
        i++;
      }
      i++;
      tokens.push(marcaDe(c === CRASE ? "tpl" : "str", texto.slice(abre, i)));
      continue;
    }

    // EXPRESSÃO REGULAR ou DIVISÃO. A heurística clássica: a barra abre uma
    // expressão regular quando o token anterior NÃO pode terminar um valor.
    // Sem ela, uma expressão regular que contenha aspas ou crase — e a suíte
    // do código de saída tem várias — abriria uma string fantasma e engoliria
    // o resto do corpo, que é vermelho pelo motivo errado.
    if (c === "/") {
      const anterior = ultimo();
      if (anterior === null || !FECHA_VALOR.test(anterior)) {
        const abre = i;
        i++;
        let classe = false;
        while (i < texto.length) {
          const d = texto[i];
          if (d === BARRA) { i += 2; continue; }
          if (d === "[") classe = true;
          else if (d === "]") classe = false;
          else if (d === "/" && !classe) break;
          else if (d === "\n") break;
          i++;
        }
        i++;
        while (i < texto.length && /[a-z]/.test(texto[i])) i++;
        tokens.push(marcaDe("re", texto.slice(abre, i)));
        continue;
      }
    }

    const palavra = /^[A-Za-z_$][\w$]*/.exec(texto.slice(i));
    if (palavra) { tokens.push(palavra[0]); i += palavra[0].length; continue; }

    const numero = /^[0-9][\w.]*/.exec(texto.slice(i));
    if (numero) { tokens.push(numero[0]); i += numero[0].length; continue; }

    tokens.push(c);
    i++;
  }
  return tokens;
}

const pesoMaterial = (corpo) => tokensDoPrograma(corpo).length;

/** A impressão digital do fluxo de tokens. Doze hexadecimais bastam para o que
 *  ela faz — distinguir corpos —, e cabem numa linha de tabela. */
function digestDoCorpo(corpo) {
  return crypto.createHash("sha256").update(tokensDoPrograma(corpo).join(" "), "utf8")
    .digest("hex").slice(0, 12);
}

/** A leitura de VERDADE da declaração: o corpo de hoje é exatamente o que a
 *  tabela diz que ele é?
 *
 *  Igualdade nos dois sentidos, e não "pelo menos": uma declaração que só
 *  cobrasse mínimo deixaria a tabela envelhecer em silêncio, e tabela
 *  desatualizada é folga com nome de contrato. Quem crescer o caso atualiza a
 *  linha — e a autoridade ancorada confere que o número novo não é menor do que
 *  o que o commit anterior já registrava. */
function conferirConteudoDosNominais(raiz) {
  const fs2 = require("node:fs");
  const path2 = require("node:path");
  const base = raiz || path2.join(__dirname, "..");
  const reprovacoes = [];

  for (const [arquivo, exigidos] of Object.entries(CONTEUDO_DOS_NOMINAIS)) {
    const caminho = path2.join(base, "test", arquivo);
    let fonte;
    try {
      fonte = fs2.readFileSync(caminho, "utf8");
    } catch (erro) {
      reprovacoes.push(
        "SUÍTE PROTEGIDA ILEGÍVEL: `" + arquivo + "` — " + ((erro && erro.message) || erro)
      );
      continue;
    }
    const corpos = corposDosCasos(fonte);
    for (const [caso, declarado] of Object.entries(exigidos)) {
      const corpo = corpos.get(caso);
      if (corpo === undefined) {
        reprovacoes.push(
          "CASO NOMINAL AUSENTE: `" + caso + "` sumiu de `" + arquivo + "` — nome que não existe " +
          "não prova nada."
        );
        continue;
      }
      const peso = pesoMaterial(corpo);
      const digest = digestDoCorpo(corpo);
      if (peso !== declarado.peso || digest !== declarado.digest) {
        reprovacoes.push(
          "CONTEÚDO DO CASO NOMINAL DIVERGE: `" + caso + "` em `" + arquivo + "` tem hoje " + peso +
          " token(s) de programa e digest `" + digest + "`, e `ci/pisos_autorizados.js` declara " +
          declarado.peso + " e `" + declarado.digest + "`. Título, posição, nome e número de casos " +
          "podem ser preservados; o PROGRAMA do corpo, não."
        );
      }
    }
  }
  return reprovacoes;
}

/** As duas medidas de um corpo, para quem precisa REDECLARAR uma linha desta
 *  tabela depois de crescer um caso de propósito. Rodar
 *  `node ci/pisos_autorizados.js --medir` imprime o par de cada caso protegido:
 *  o número entra na tabela MEDIDO, e nunca escrito de cabeça. */
function medirNominais(raiz) {
  const fs2 = require("node:fs");
  const path2 = require("node:path");
  const base = raiz || path2.join(__dirname, "..");
  const linhas = [];
  for (const arquivo of Object.keys(CONTEUDO_DOS_NOMINAIS)) {
    const corpos = corposDosCasos(fs2.readFileSync(path2.join(base, "test", arquivo), "utf8"));
    for (const caso of Object.keys(CONTEUDO_DOS_NOMINAIS[arquivo])) {
      const corpo = corpos.get(caso);
      linhas.push(
        arquivo + " :: " + caso + " :: " +
        (corpo === undefined ? "AUSENTE" : "peso " + pesoMaterial(corpo) + " digest " + digestDoCorpo(corpo))
      );
    }
  }
  return linhas;
}

/** O piso efetivo por arquivo: o MAIOR entre o externo e o declarado. */
function pisoTextualEfetivo(arquivo, declaradoNoCenso) {
  const externo = MINIMO_DECLARADO_NO_CENSO[arquivo];
  if (externo === undefined) return declaradoNoCenso;
  if (declaradoNoCenso === undefined) return externo;
  return Math.max(externo, declaradoNoCenso);
}

/** Reprova se o censo declarar menos do que o autorizado, ou perder uma chave.
 *  Não executa teste nenhum: é leitura de declaração contra declaração, e serve
 *  para rodar barato no `pretest`. */
function conferirPisosDeclarados(censo) {
  const reprovacoes = [];
  if (!censo || typeof censo !== "object") {
    return ["CENSO ILEGÍVEL: `OBRIGATORIAS` não é um objeto — sem declaração não há o que conferir."];
  }
  for (const [arquivo, minimo] of Object.entries(MINIMO_DECLARADO_NO_CENSO)) {
    if (!Object.prototype.hasOwnProperty.call(censo, arquivo)) {
      reprovacoes.push(
        "PISO REMOVIDO: `" + arquivo + "` saiu de `OBRIGATORIAS` — suíte sem piso é suíte que pode " +
        "esvaziar sem reprovar."
      );
      continue;
    }
    const declarado = censo[arquivo];
    if (!Number.isInteger(declarado)) {
      reprovacoes.push("PISO INVÁLIDO: `" + arquivo + "` declara `" + declarado + "`, que não é um inteiro.");
      continue;
    }
    if (declarado < minimo) {
      reprovacoes.push(
        "PISO REBAIXADO: `" + arquivo + "` caiu de " + minimo + " para " + declarado +
        " — descer o número é como uma suíte esvaziada volta a passar."
      );
    }
  }
  return reprovacoes;
}

module.exports = {
  MINIMO_DECLARADO_NO_CENSO, MINIMO_EXECUTADO, NOMES_OBRIGATORIOS, CONTEUDO_DOS_NOMINAIS,
  pisoTextualEfetivo, conferirPisosDeclarados,
  corposDosCasos, tokensDoPrograma, pesoMaterial, digestDoCorpo,
  conferirConteudoDosNominais, medirNominais, principal,
};

/** A autoridade roda como PASSO PRÓPRIO do workflow, e não só dentro do
 *  `pretest`. Duas moradas, pelo mesmo motivo de sempre: quem estreitar o glob
 *  desliga tudo o que vive dentro dele. */
function principal(argv) {
  const args = argv || process.argv.slice(2);
  if (args.includes("--medir")) {
    for (const linha of medirNominais()) process.stdout.write(linha + "\n");
    return 0;
  }
  const reprovacoes = [
    ...conferirConteudoDosNominais(),
  ];
  if (reprovacoes.length === 0) {
    const protegidos = Object.values(CONTEUDO_DOS_NOMINAIS)
      .reduce((t2, m) => t2 + Object.keys(m).length, 0);
    process.stdout.write(
      "CONTEÚDO NOMINAL ÍNTEGRO — " + protegidos + " caso(s) protegido(s) com o PROGRAMA do corpo " +
      "conferido por token e por digest. Título, posição, nome, contagem de casos e contagem de " +
      "afirmações não substituem o conteúdo.\n"
    );
    return 0;
  }
  process.stdout.write("CONTEÚDO NOMINAL REPROVADO — " + reprovacoes.length + " motivo(s):\n");
  for (const m of reprovacoes) process.stdout.write("  * " + m + "\n");
  return 1;
}

if (require.main === module) process.exit(principal());
