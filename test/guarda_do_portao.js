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

try {
  const { estatistica } = conferirProvaDaUnicidade();
  const glob = conferirGlobOficial();
  // [OS 52-C3] O PISO, CONTRA O COMMIT ANTERIOR. Roda aqui também — e não só
  // dentro do censo — porque o encolhimento coordenado pode estreitar o glob no
  // mesmo movimento, e aí nenhuma suíte obrigatória chega a chamar o censo.
  const piso = conferirPisoAncorado();
  const amarracoes = conferirAmarracao();
  process.stdout.write(
    "[guarda do portão] unicidade: " + estatistica.arquivos + " arquivos varridos · " +
    "glob oficial: " + glob.suites + " suítes alcançadas · " +
    "piso ancorado: " + piso.comparacoes + " comparações contra " +
    piso.ancoras.map((s) => s.slice(0, 7)).join(", ") +
    " · amarrações: " + amarracoes + "\n"
  );
} catch (erro) {
  process.stderr.write("\n[guarda do portão] REPROVADO\n" + ((erro && erro.message) || erro) + "\n");
  process.exit(1);
}
