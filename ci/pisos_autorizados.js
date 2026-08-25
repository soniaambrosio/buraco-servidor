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
  "ci_obrigatorio.test.js": 99,
  // [OS 54-C2, portadas pela OS 54-C4] As duas suítes próprias da cadeia
  // externa: a do guardião do rastro e a do inventário por execução.
  "auditabilidade_ci.test.js": 29,
  "inventario_executado.test.js": 24,
});

/** Piso EXECUTADO: casos aprovados, por arquivo de origem.
 *
 *  [OS 54-C4] REMEDIDOS NA ÁRVORE COMPOSTA com
 *  `node ci/inventario_de_execucao.js --json`. Herdar os números da OS 54-C3
 *  seria pior do que não ter piso: aquela árvore não tinha
 *  `artefato_unico.test.js`, e a suíte do CI ganhou casos nesta composição.
 *  Piso desatualizado é folga com outro nome. */
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
  "auditabilidade_ci.test.js": 28,
  "inventario_executado.test.js": 22,
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
  "auditabilidade_ci.test.js": Object.freeze(["AUD-00", "AUD-01", "AUD-06", "AUD-11", "AUD-18"]),
  "inventario_executado.test.js": Object.freeze(["INV-00", "INV-01", "INV-05", "INV-09"]),
});

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
  MINIMO_DECLARADO_NO_CENSO, MINIMO_EXECUTADO, NOMES_OBRIGATORIOS,
  pisoTextualEfetivo, conferirPisosDeclarados,
};
