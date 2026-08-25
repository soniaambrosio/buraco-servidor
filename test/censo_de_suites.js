// test/censo_de_suites.js — O CENSO DAS SUÍTES OBRIGATÓRIAS.
//
// POR QUE ISTO É UM MÓDULO, E NÃO UM CASO DENTRO DE UMA SUÍTE.
//
// O único portão deste repositório é `npm test`, e ele é um GLOB
// (`test/*.test.js`). Glob não tem manifesto: apagar um arquivo de suíte, ou
// renomeá-lo para fora do padrão, faz os casos dele pararem de rodar e o portão
// continuar VERDE. Numa composição isso é o risco número um — o §10.1 da OS 44
// exige que nenhum caso desapareça, e sem guarda "não desapareceu" é uma
// afirmação que ninguém verifica.
//
// A primeira versão desta guarda era um caso dentro de
// `costura_assento_descoberta.test.js`, e a campanha de mutação a derrubou na
// hora: tirar ESSA suíte do glob levava a guarda junto, e a sabotagem ficava
// verde. Guarda que não sobrevive à própria remoção não é guarda.
//
// A saída é a RECIPROCIDADE. O censo mora aqui, fora do glob, e é chamado pelas
// TRÊS suítes que ele protege — as duas entradas da composição e a costura.
// Assim, tirar qualquer UMA delas deixa as outras duas vermelhas, e o arquivo
// que sumiu é nomeado na mensagem. Tirar este módulo também é vermelho: as três
// deixam de carregar.
//
// O QUE ISTO NÃO É. Não é um segundo manifesto, um segundo agregador nem um
// porteiro concorrente — o §12 proíbe os três, e não há um primeiro para este
// ser o segundo. É uma asserção compartilhada, chamada de dentro do portão que
// já existe, na mesma disciplina estrutural do GATE-09. O manifesto de verdade,
// com digest de ferramenta e piso por arquivo, vive na família OS 23.1-P — que
// não é ancestral desta linhagem e não tem PASS final. Importá-lo seria trazer
// autoridade não arbitrada, e o §12 manda registrar a dívida em vez disso.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

/** PISO por arquivo, nunca contagem exata.
 *
 *  Contagem exata vira manutenção, e manutenção de número vira "ajustar o
 *  número" — que é como um caso apagado volta a passar. O piso só se move para
 *  baixo por decisão explícita, e mover para baixo é o que a revisão vê.
 *
 *  Os valores foram MEDIDOS com o contador abaixo, nunca escritos de cabeça.
 *  Medidos em 2026-08-23: assento 29 · descoberta 97 · chat_transporte 31 ·
 *  Remedido em 2026-08-24 (OS 52-C1): costura 25, com os sete casos
 *  do §11. O piso subiu junto — piso que não acompanha a guarda nova deixa
 *  apagar os casos dela sem reprovar, que é o buraco que esta OS fecha.
 *
 *  [OS 52-C3] REMEDIDOS TODOS, E SEM FOLGA. A OS 52-R2 registrou como residual
 *  que estes números eram rebaixáveis: a C2 baixou a costura de 23 para 16
 *  quando o arquivo tinha 18 casos, e a diferença é espaço para apagar dois
 *  casos sem que nada reprove. Agora cada piso é a contagem REAL do arquivo, e
 *  `test/piso_ancorado.js` compara com o commit anterior — descer abaixo do que
 *  o arquivo tem é vermelho, e descer com o arquivo é permitido só até ele. */
const OBRIGATORIAS = Object.freeze({
  "assento_autoritativo.test.js": 30,        // OS 41 — escolha autoritativa de assento
  "descoberta.test.js": 98,                  // OS 38.1 — descoberta e presença
  "costura_assento_descoberta.test.js": 18,  // OS 44 — a costura entre as duas
  "chat_transporte.test.js": 31,             // Comunicação Controlada (ff3ddbe)
  "chat_contrato.test.js": 11,
  "controlador_assento.test.js": 27,
  "gate_vip.test.js": 64,
  "unicidade_do_portador.test.js": 48,   // OS 52-C3 — capacidade composta da árvore
  // [OS 52-C4] A AUTORIDADE. As de cima passaram a ser heuristica; esta cobra a
  // propriedade que decide o que pode ser implantado.
  "artefato_unico.test.js": 51,           // OS 52-C4 — artefato produtivo unico
  // [OS 54] A metade de dentro do CI obrigatorio. Ela le o workflow e reprova
  // quem o desliga; registrada aqui, a remocao DELA reprova pelas outras tres.
  "ci_obrigatorio.test.js": 83,   // OS 54 — CI externo obrigatorio; +15 na OS 54-C1; +3 na OS 52-C3
});

/** Conta casos, INCLUINDO subtestes.
 *
 *  `\btest\s*\(` casa tanto `test(` quanto `t.test(`, que é como a suíte da
 *  descoberta declara os 97 casos dela. Um contador que exigisse `test(` no
 *  início da expressão devolveria 10 para um arquivo cheio — e piso satisfeito
 *  por engano é pior que piso nenhum: afirma cobertura que não mediu. Custou
 *  uma volta descobrir isso. */
function contarCasos(texto) {
  return (texto.match(/\btest\s*\(/g) || []).length;
}

/** Reprova se alguma suíte obrigatória sumiu, saiu do glob ou esvaziou. */
function conferirCenso(dir) {
  const raiz = dir || __dirname;
  const presentes = fs.readdirSync(raiz).filter((f) => f.endsWith(".test.js"));

  for (const [arquivo, piso] of Object.entries(OBRIGATORIAS)) {
    assert.ok(
      presentes.includes(arquivo),
      "suíte obrigatória sumiu ou foi renomeada para fora do glob: " + arquivo
    );
    const casos = contarCasos(fs.readFileSync(path.join(raiz, arquivo), "utf8"));
    assert.ok(
      casos >= piso,
      arquivo + " caiu para " + casos + " casos, abaixo do piso " + piso +
        " — suíte esvaziada ou substituída por corpo trivial"
    );
  }

  // E o alvo do portão continua sendo o GLOB, não uma lista que possa ser
  // desviada para uma suíte-isca.
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "..", "package.json"), "utf8"));
  assert.match(
    pkg.scripts.test,
    /--test\s+"?test\/\*\.test\.js"?/,
    "o comando oficial deixou de varrer test/*.test.js"
  );

  // [OS 52-C2] E o repositório continua carregando UM servidor só.
  //
  // Mora aqui, dentro do censo, e não num caso próprio: assim herda a
  // reciprocidade que a OS 44 construiu — as suítes obrigatórias chamam
  // `conferirCenso`, e COST-12b prova que continuam chamando.
  //
  // O que se chama aqui NÃO é mais a guarda direta, e sim a PROVA dela. A
  // versão da OS 52-C1 detectava por nome, trecho canônico e extensão, e a
  // R1 mostrou o preço disso: servidor novo com outros nomes, em `net` ou
  // `https`, guardado numa subpasta, e ZIP sem extensão passavam inteiros.
  // A da OS 52-C3 detecta por CAPACIDADE COMPOSTA DA ÁRVORE e é exercitada
  // contra 57 fixtures — 45 que têm de reprovar e 12 que têm de passar.
  // Chamar a prova em vez da regra é o que impede corpo oco de aprovar em
  // silêncio.
  const { conferirProvaDaUnicidade, conferirGlobOficial } =
    require("./prova_da_unicidade.js");
  conferirProvaDaUnicidade(path.join(raiz, ".."));
  conferirGlobOficial(path.join(raiz, ".."));

  // [OS 52-C3] E NENHUM PISO ENCOLHEU EM RELAÇÃO AO QUE O REPOSITÓRIO JÁ
  // REGISTROU.
  //
  // Os pisos por suíte acima, o de `ci/piso_do_portao.json` e a própria lista
  // de suítes são todos editáveis pelo mesmo commit — foi assim que o
  // encolhimento coordenado da OS 52-R2 ficou verde: seis edições plausíveis,
  // e todos os números que decidiam moravam dentro do conjunto editado. A
  // comparação com o COMMIT ANTERIOR é a única autoridade que uma edição na
  // árvore de trabalho não alcança.
  //
  // SÓ NA ÁRVORE REAL, e a razão não é conveniência: o piso ancorado é uma
  // afirmação sobre O HISTÓRICO DESTE REPOSITÓRIO, e uma cópia descartável em
  // `%TEMP%` não tem histórico nenhum. Avaliá-lo ali devolveria "sem âncora"
  // para toda árvore forjada, e as provas que montam árvores forjadas para
  // testar OUTRA coisa passariam a reprovar pelo motivo errado — vermelho pelo
  // motivo errado é tão cego quanto verde indevido.
  //
  // Isto não abre porta: as suítes chamam `conferirCenso()` sem argumento, e a
  // etapa `pretest` chama a comparação DIRETAMENTE, sobre a raiz real, antes do
  // glob. Quem quisesse escapar por aqui teria de mudar quem chama o censo, e
  // aí esbarra na amarração que o juiz do CI confere de fora.
  const { conferirPisoAncorado, conferirAmarracao } = require("./piso_ancorado.js");
  const ehArvoreReal = !dir || path.resolve(dir) === path.resolve(__dirname);
  if (ehArvoreReal) {
    conferirPisoAncorado(path.join(raiz, ".."));
    conferirAmarracao(path.join(raiz, ".."));

    // [OS 52-C4] E O ARTEFATO PRODUTIVO CONTINUA SENDO EXATAMENTE DOIS
    // CAMINHOS.
    //
    // Esta é a AUTORIDADE; tudo o que veio antes passou a ser heurística. A
    // ordem no arquivo não é ordem de importância: quem decide o que pode ser
    // implantado é o conjunto declarado, conferido por IGUALDADE contra a
    // árvore do commit e ancorado no histórico. A mesma ressalva da árvore real
    // vale aqui, e pelo mesmo motivo.
    const { exigirArtefatoUnico } = require("../ci/artefato.js");
    exigirArtefatoUnico(path.join(raiz, ".."));
  }
}

// ===========================================================================
// [OS 52-C2] A GUARDA DE UNICIDADE SAIU DAQUI — e a mudança tem endereço.
//
// A versão da OS 52-C1 morava neste arquivo e protegia por NOME, TRECHO
// CANÔNICO e EXTENSÃO: varria só a raiz com as assinaturas fortes, procurava
// uma única linha de arranque no resto da árvore e proibia pacote pela
// extensão. A rehomologação mostrou o preço: um servidor escrito do zero,
// com outros nomes, em `net.createServer`, guardado numa subpasta, não se
// parecia com nada daquilo; e um ZIP renomeado para `entrega` não tinha
// extensão a proibir.
//
// A guarda vive agora em `test/unicidade_do_portador.js`, detecta por
// CAPACIDADE EXECUTÁVEL e varre a árvore inteira; o catálogo de cenários
// vive em `test/fixtures_de_unicidade.js`; e quem afirma que os dois
// funcionam é `test/prova_da_unicidade.js`, chamada do `conferirCenso`
// logo acima. Os três estão FORA do glob, como este arquivo, e por isso
// nenhum deles some junto com uma suíte.
//
// O censo continua fazendo o que sempre fez: conferir que as suítes
// obrigatórias existem, estão cheias e são varridas pelo comando oficial.
// ===========================================================================

module.exports = { OBRIGATORIAS, contarCasos, conferirCenso };
