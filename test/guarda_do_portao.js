// test/guarda_do_portao.js — A GUARDA QUE RODA ANTES DO GLOB (OS 52-C2, §6).
//
// ===========================================================================
// O BURACO QUE ESTE ARQUIVO FECHA
// ===========================================================================
//
// A guarda de unicidade e a do glob moram dentro de `conferirCenso`, e o censo
// é chamado pelas suítes obrigatórias. Isso funciona para tudo — menos para uma
// sabotagem, e a campanha a encontrou: se o comando oficial for estreitado para
// uma SUÍTE-ISCA, nenhuma suíte obrigatória roda, ninguém chama o censo, e o
// portão termina VERDE com um caso só.
//
// É o limite estrutural que a OS 44 já tinha nomeado: uma suíte não consegue se
// obrigar a rodar. Qualquer guarda que viva DENTRO do conjunto varrido some
// junto quando o conjunto é estreitado.
//
// A saída é rodar ANTES do executor de testes, no mesmo `npm test`. Este script
// é o `pretest` do manifesto: o npm o executa antes do script `test`, e se ele
// reprovar o `npm test` inteiro morre sem chegar ao glob. Não é um segundo
// comando oficial — é a primeira etapa do único que existe, e `scripts.test`
// continua sendo exatamente o que sempre foi.
//
// O QUE ELE NÃO RESOLVE, dito em voz alta: quem apagar o `pretest` volta ao
// estado anterior. Aí quem pega é o CI externo, que julga por EVIDÊNCIA e piso
// — `ci/portao_do_ci.js` reprova uma execução de um caso por três motivos
// independentes, e nenhum deles depende de suíte nenhuma ter rodado. As duas
// metades juntas fecham o círculo; separadas, cada uma tem o seu ponto cego.
// ===========================================================================

"use strict";

const { conferirProvaDaUnicidade, conferirGlobOficial } = require("./prova_da_unicidade.js");
const { conferirPisoAncorado, conferirAmarracao } = require("./piso_ancorado.js");
const { exigirArtefatoUnico } = require("../ci/artefato.js");

// [OS 54-C2, portado pela OS 54-C4] AS EXIGÊNCIAS QUE NÃO PODEM MORAR DENTRO DO
// GLOB.
//
// A OS 54-R2 provou que guarda dentro da suíte protegida se apaga junto com
// ela: CI-18, CI-19 e CI-19b podiam ser trivializadas ou removidas — inclusive
// as três juntas — com o portão oficial verde. A correção não foi escrever uma
// quarta guarda no mesmo lugar; foi mover a AUTORIDADE para fora.
//
// Aqui, no `pretest`, elas rodam antes do glob e não são alcançadas por nenhuma
// edição em `test/*.test.js`:
//
//   * `ci/auditabilidade.js` — o rastro do run existe, é sempre publicado e é
//     do que foi julgado; e o workflow continua invocando a cadeia externa
//     INTEIRA, inclusive a autoridade do artefato produtivo da OS 52-C4;
//   * `ci/pisos_autorizados.js` — o censo não declara menos do que o autorizado.
//
// A contagem por EXECUÇÃO (`ci/inventario_de_execucao.js`) não roda aqui de
// propósito: ela executa suítes, e executar suítes dentro do `pretest` das
// mesmas suítes dobra toda corrida. Ela é passo próprio do CI, e a ausência da
// invocação dela no workflow é reprovada por `ci/auditabilidade.js`, que roda
// aqui.
const { conferirAuditabilidade } = require("../ci/auditabilidade.js");
// [OS 54-C6] A autoridade que responde "o passo DEPENDE do resultado disso?".
// Aqui ela roda com a PROVA COMPORTAMENTAL ligada: o entrypoint da ação do
// portão é executado contra evidência forjada, nos dois sentidos, e o código de
// saída dele tem de ser idêntico ao do juiz. Estrutura sozinha é o que a
// OS 54-R4 já mostrou não bastar.
const { conferirPreservacaoDoCodigo } = require("../ci/codigo_de_saida.js");
// [OS 54-C7] `conferirConteudoDosNominais` substituiu `conferirPesoDosNominais`.
// A OS 54-R6 mostrou que contar afirmações mede a FORMA da prova e não o
// conteúdo: um corpo trocado por `assert.ok(true)` dá o mesmo número de um
// corpo que concentra a afirmação num ajudante. O que passou a ser conferido é
// o PROGRAMA do corpo — token e digest —, e a monotonicidade dele contra o
// commit anterior mora em `test/piso_ancorado.js`.
const { conferirPisosDeclarados, conferirConteudoDosNominais } = require("../ci/pisos_autorizados.js");
const { OBRIGATORIAS, conferirCenso } = require("./censo_de_suites.js");

try {
  // [OS 52-C4] A AUTORIDADE VEM PRIMEIRO, E ANTES DO GLOB.
  //
  // As guardas abaixo continuam valendo como HEURÍSTICA: elas perguntam "isto
  // se PARECE com um servidor?", e essa pergunta tem teto — colchetes,
  // concatenação, base64 e `new Function` passam por baixo de qualquer
  // expressão regular. A pergunta que DECIDE é outra: "isto PERTENCE ao que é
  // implantado?". Uma duplicata cai aqui sem que ninguém precise entendê-la.
  const artefato = exigirArtefatoUnico();

  const { estatistica } = conferirProvaDaUnicidade();
  const glob = conferirGlobOficial();
  // [OS 52-C3] O PISO, CONTRA O COMMIT ANTERIOR. Roda aqui também — e não só
  // dentro do censo — porque o encolhimento coordenado pode estreitar o glob no
  // mesmo movimento, e aí nenhuma suíte obrigatória chega a chamar o censo.
  const piso = conferirPisoAncorado();
  const amarracoes = conferirAmarracao();

  // [OS 54-C2] O CENSO passa a ser conferido AQUI também. Ele já era chamado
  // de dentro das suítes obrigatórias, e a R2 mostrou que comentar a chamada
  // numa delas não reprovava — as outras cobriam, mas por acaso, e acaso não é
  // proteção. Com a conferência no `pretest`, a chamada de dentro vira defesa
  // redundante DE VERDADE: a obrigatoriedade passou a ter dono externo.
  conferirCenso();

  const motivos = [
    ...conferirAuditabilidade({}),
    ...conferirPreservacaoDoCodigo({ executar: true }),
    ...conferirPisosDeclarados(OBRIGATORIAS),
    ...conferirConteudoDosNominais(),
  ];
  if (motivos.length > 0) {
    throw new Error(
      "auditabilidade/pisos — " + motivos.length + " motivo(s):\n  * " + motivos.join("\n  * ")
    );
  }

  process.stdout.write(
    "[guarda do portão] artefato: [" + artefato.produtivos.join(", ") + "] · " +
    artefato.excluidos + " excluídos · " + artefato.ancoras + " âncora(s) · " +
    "unicidade: " + estatistica.arquivos + " arquivos varridos · " +
    "glob oficial: " + glob.suites + " suítes alcançadas · " +
    "piso ancorado: " + piso.comparacoes + " comparações contra " +
    piso.ancoras.map((s) => s.slice(0, 7)).join(", ") +
    " · amarrações: " + amarracoes +
    " · auditabilidade, código de saída, conteúdo nominal e pisos declarados: verdes\n"
  );
} catch (erro) {
  process.stderr.write("\n[guarda do portão] REPROVADO\n" + ((erro && erro.message) || erro) + "\n");
  process.exit(1);
}
