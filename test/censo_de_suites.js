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
 *  chat_contrato 11 · controlador 27 · gate_vip 64 · costura 12. */
const OBRIGATORIAS = Object.freeze({
  "assento_autoritativo.test.js": 25,        // OS 41 — escolha autoritativa de assento
  "descoberta.test.js": 90,                  // OS 38.1 — descoberta e presença
  "costura_assento_descoberta.test.js": 23,  // OS 44 — a costura entre as duas, + §11 da OS 52-C1
  "chat_transporte.test.js": 28,             // Comunicação Controlada (ff3ddbe)
  "chat_contrato.test.js": 10,
  "controlador_assento.test.js": 24,
  "gate_vip.test.js": 58,
  // [OS 54] A metade de dentro do CI obrigatorio. Ela le o workflow e reprova
  // quem o desliga; registrada aqui, a remocao DELA reprova pelas outras tres.
  "ci_obrigatorio.test.js": 55,   // OS 54 — CI externo obrigatorio
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

  // [OS 52-C1] E o repositório continua carregando UM servidor só. Mora aqui,
  // dentro do censo, e não num caso próprio, porque assim herda a
  // reciprocidade que a OS 44 já construiu: as três suítes obrigatórias
  // chamam `conferirCenso`, e COST-12b prova que continuam chamando. Um caso
  // avulso numa suíte só seria unilateral outra vez.
  conferirUnicidadeDoBundle(path.join(raiz, ".."));
}

// ===========================================================================
// [OS 52-C1] A UNICIDADE DO PORTADOR DO CONTRATO.
//
// A OS 52 mediu, pelo fio, QUATRO duplicatas do contrato de ingresso e assento
// que viviam na raiz deste repositório: `server_js.txt`, `buraco-servidor.zip`,
// `mesa-online.html` e `mesa-online_rc.html`. Nenhuma era alcançada pelo
// despachante — mas duas subiam servidor SOZINHAS, na mesma porta padrão, e
// exercitadas devolviam outra cadeira em vez de recusa: pedido ocupado, pedido
// inválido, `null` e `"2"` caíam todos no laço automático, a disputa não tinha
// perdedor, e o mesmo uid terminava com dois assentos. Zero `codigoRecusa`,
// zero `reconexao` no ACK, identidade vinda da mensagem.
//
// O que fazia disso um risco, e não uma curiosidade: NADA REPROVAVA. Apagar as
// quatro deixava o portão em 639/639 verde — e, simetricamente, promover ou
// implantar qualquer uma delas também não reprovava. O censo sabia quais
// suítes deviam existir; não sabia quantos servidores o repositório carregava.
//
// ISTO NÃO É UM SEGUNDO PORTÃO. É a mesma asserção compartilhada de
// `conferirCenso`, chamada de DENTRO dele, pelas MESMAS três suítes, no MESMO
// `npm test`. A reciprocidade que a OS 44 construiu passa a valer para esta
// regra sem custo: quem tirar uma das três do glob deixa as outras duas
// vermelhas, e elas carregam esta guarda junto.
//
// POR QUE TRÊS CAMADAS, E NÃO UMA
//
//   1. RAIZ, ASSINATURAS LARGAS. Nenhum arquivo da raiz além do portador único
//      declara, despacha ou registra transporte de salas. Pega a duplicata
//      restaurada e a duplicata RENOMEADA — que é a sabotagem mais barata
//      depois da restauração.
//
//   2. REPOSITÓRIO INTEIRO, ASSINATURA ESTREITA. A camada 1 não pode varrer
//      `test/` nem `docs/`: as suítes citam as fábricas do bundle para carregar
//      módulos, e um documento cita a fronteira. Medido antes de fixar — sete
//      arquivos de `test/` e um de `docs/` casam com as assinaturas largas, e
//      todos são legítimos. O que não aparece em lugar nenhum além do bundle é
//      o ARRANQUE DO TRANSPORTE: a linha que sobe o servidor sozinha. Essa vale
//      no repositório inteiro, e é ela que fecha a duplicata movida para uma
//      subpasta.
//
//   3. OPACIDADE. `buraco-servidor.zip` passou pelas camadas 1 e 2 sem UM ÚNICO
//      hit, e não por ser inofensivo: carregava um `server.js` completo de
//      4.414 linhas E um `package.json` com `start` — um pacote implantável
//      inteiro. Escapou porque estava COMPRIMIDO, e varredura textual não lê
//      conteúdo empacotado, por construção. Uma regra que só sabe ler texto
//      declara limpo exatamente o vetor mais fácil de implantar por engano.
//      Por isso pacote compactado na raiz é proibido pela FORMA, não pelo
//      conteúdo — não há como auditar o que não se lê.
//
// O QUE ESTA REGRA NÃO FAZ. Não lê o portador (ele é o legítimo, e nada aqui o
// valida), não toca no fio, não conhece assento e não substitui nenhuma das 639
// provas de comportamento. Ela responde uma pergunta só: quantos servidores
// este repositório carrega?
// ===========================================================================

/** O único arquivo autorizado a portar o contrato de salas. */
const PORTADOR_UNICO = "server.js";

/** Assinaturas LARGAS — válidas só na raiz (a camada 2 explica por quê).
 *
 *  Nenhuma casa com `app.html`, que é CLIENTE e fica: ele fala `entrarMesa`
 *  pelo fio e não declara nem despacha coisa nenhuma. Medido antes de fixar,
 *  não suposto — falso positivo aqui derrubaria o portão íntegro, que é a
 *  forma mais rápida de uma guarda nova ser removida por incômodo. */
const ASSINATURAS_DE_SERVIDOR = Object.freeze([
  ["declara o ingresso", /\bfunction\s+entrarMesa\s*\(/],
  ["despacha o ingresso", /case\s*["']entrarMesa["']\s*:/],
  ["registra fábrica de transporte", /__fabricas\s*\[\s*["']ws_server["']\s*\]/],
]);

/** Assinatura ESTREITA — o arranque do transporte, válida no repositório todo.
 *
 *  O FONTE desta linha não casa consigo mesmo: o padrão exige a chamada
 *  literal, e aqui só existem metacaracteres entre os pedaços. Guarda que casa
 *  com o próprio texto é o erro que a OS 44 já pagou duas vezes, e ele volta
 *  disfarçado toda vez que alguém escreve a assinatura por extenso num
 *  comentário — por isso ela não aparece por extenso em lugar nenhum daqui. */
const ARRANQUE_DO_TRANSPORTE =
  /__require\s*\(\s*["']ws_server["']\s*\)\s*\.\s*iniciar\s*\(/;

/** Formas de EMPACOTAMENTO: conteúdo que a varredura textual não alcança. */
const EXTENSOES_OPACAS = Object.freeze([
  ".zip", ".tar", ".tgz", ".gz", ".7z", ".rar", ".jar", ".war",
]);

/** O que a camada 2 não desce. `node_modules` não existe aqui — o servidor não
 *  tem dependências —, e está listado para a guarda não virar lenta e frágil
 *  se um dia existir. */
const FORA_DA_VARREDURA = Object.freeze([".git", "node_modules"]);

function listarArquivos(dir, rel, saida) {
  for (const nome of fs.readdirSync(dir)) {
    if (FORA_DA_VARREDURA.includes(nome)) continue;
    const caminho = path.join(dir, nome);
    const relativo = rel ? rel + "/" + nome : nome;
    if (fs.statSync(caminho).isDirectory()) listarArquivos(caminho, relativo, saida);
    else saida.push({ caminho, relativo, nome });
  }
  return saida;
}

/** Reprova se o repositório passar a carregar mais de um servidor de salas.
 *
 *  `raizDoRepo` existe para o caso que EXERCITA esta função contra uma árvore
 *  forjada. Sem ele a única prova possível seria textual, e prova textual não
 *  distingue uma regra viva de um corpo esvaziado — ver UNI-05. */
function conferirUnicidadeDoBundle(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");

  // --- camada 1: a raiz, com as assinaturas largas -------------------------
  for (const nome of fs.readdirSync(raiz)) {
    const caminho = path.join(raiz, nome);
    if (!fs.statSync(caminho).isFile()) continue;

    // --- camada 3: a FORMA, decidida antes de tentar ler ------------------
    const ext = path.extname(nome).toLowerCase();
    assert.ok(
      !EXTENSOES_OPACAS.includes(ext),
      "pacote compactado na raiz: " + nome + " — conteúdo empacotado escapa da " +
        "varredura por construção, e foi assim que um servidor inteiro, com o " +
        "próprio `package.json`, ficou invisível para o portão"
    );

    if (nome === PORTADOR_UNICO) continue;
    const texto = fs.readFileSync(caminho, "latin1");
    for (const [oQue, padrao] of ASSINATURAS_DE_SERVIDOR) {
      assert.ok(
        !padrao.test(texto),
        "segundo portador do contrato na raiz: `" + nome + "` " + oQue +
          " — só `" + PORTADOR_UNICO + "` pode. Duplicata restaurada, renomeada " +
          "ou recém-escrita não divide autoridade com o bundle."
      );
    }
  }

  // --- camada 2: o repositório inteiro, com o arranque ---------------------
  for (const alvo of listarArquivos(raiz, "", [])) {
    if (alvo.relativo === PORTADOR_UNICO) continue;
    const texto = fs.readFileSync(alvo.caminho, "latin1");
    assert.ok(
      !ARRANQUE_DO_TRANSPORTE.test(texto),
      "segunda inicialização de servidor em `" + alvo.relativo + "` — este " +
        "repositório sobe UM servidor, e quem o sobe é `" + PORTADOR_UNICO +
        "`. Mover a duplicata para uma subpasta não a torna outra coisa."
    );
  }
}

module.exports = {
  OBRIGATORIAS, contarCasos, conferirCenso,
  conferirUnicidadeDoBundle, PORTADOR_UNICO,
  ASSINATURAS_DE_SERVIDOR, ARRANQUE_DO_TRANSPORTE, EXTENSOES_OPACAS,
};
