// test/prova_da_unicidade.js — A GUARDA EXTERNA DA GUARDA (OS 52-C2, §5 e §6).
//
// ===========================================================================
// O PROBLEMA QUE ESTE ARQUIVO RESOLVE
// ===========================================================================
//
// Uma guarda pode ser desligada de seis maneiras, e só a primeira é visível:
//
//   1. apagando-a;
//   2. esvaziando o corpo dela (`function f() { return; }`);
//   3. removendo a CHAMADA, e deixando o corpo intacto;
//   4. reduzindo os testes dela a comentários;
//   5. trocando as asserções por tautologias (`assert.ok(true)`), com nomes e
//      comentários preservados — o arquivo continua parecendo uma prova;
//   6. realinhando um digest depois de mudar a regra.
//
// Nenhuma dessas é pega por contar `test(`. Um arquivo com trinta casos vazios
// satisfaz qualquer contador, e a OS 52-C2 diz isso com todas as letras.
//
// A DEFESA É EXIGIR RESULTADO NEGATIVO REAL. Esta guarda executa a guarda de
// unicidade contra fixtures controladas e cobra o veredito declarado de cada
// uma: 45 árvores que TÊM de reprovar e 12 que TÊM de passar. Implementação oca
// falha nas 45; implementação que reprova tudo falha nas 12. Não existe corpo
// trivial que satisfaça as duas metades — e é por isso que a defesa não depende
// de ler o texto de ninguém.
//
// NÃO HÁ DIGEST AQUI, e a ausência é deliberada. Digest protege contra edição
// acidental e cai na primeira edição intencional: quem muda a regra realinha o
// número na mesma alteração, e o portão nunca vê. Comportamento contra fixture
// não se realinha — para fazê-lo passar seria preciso escrever uma regra que
// de fato detecta os 24 cenários.
//
// ONDE ISTO É CHAMADO. Do `conferirCenso`, que as suítes obrigatórias chamam.
// O anel fica fechado: apagar a suíte de unicidade derruba o censo (ela está
// em OBRIGATORIAS); apagar o catálogo derruba esta guarda (ela cobra os ids);
// esvaziar a regra derruba os 45 negativos; remover esta chamada derruba
// CENSO-UNI, na suíte que a exercita.
// ===========================================================================

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const unicidade = require("./unicidade_do_portador.js");
const fixtures = require("./fixtures_de_unicidade.js");

/** Memória por PROCESSO, e SÓ DA PARTE CARA.
 *
 *  O catálogo roda contra árvores que a própria fixture monta — ele não
 *  depende da árvore do repositório, então pagá-lo uma vez por processo é
 *  correto. `node --test` roda cada suíte num processo próprio.
 *
 *  A VARREDURA DA ÁRVORE REAL NÃO É MEMORIZADA, e a distinção custou um caso
 *  vermelho para aparecer: com o resultado inteiro em cache, plantar um
 *  servidor novo e chamar o censo de novo devolvia o veredito ANTIGO — a
 *  guarda parecia cega quando na verdade era o cache respondendo. Cache que
 *  atravessa uma mudança de estado é indistinguível de guarda desligada. */
let catalogoMemorizado = null;

/** Executa o catálogo inteiro e devolve o placar. Não afirma nada: quem afirma
 *  é `conferirProvaDaUnicidade`, para que a suíte possa relatar cenário a
 *  cenário sem duplicar a execução. */
function executarCatalogo(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");
  const fonteDoPortador = fs.readFileSync(
    path.join(raiz, unicidade.PORTADOR_UNICO), "latin1"
  );

  const resultados = [];
  try {
    for (const cenario of fixtures.catalogo(fonteDoPortador)) {
      const arvore = fixtures.arvore(fonteDoPortador);
      cenario.montar(arvore);
      // O LAUDO, e não o `throw`. A cobertura de ramo (§C3-06) exige saber
      // QUAIS ramos dispararam em cada cenário, e um veredito que só sabe
      // estourar não conta isso. O veredito continua sendo derivado do mesmo
      // laudo, pelas mesmas três condições que `conferirUnicidadeDoPortador`
      // afirma — o que se observa aqui é a saída da regra, nunca um contador
      // que ela mesma mantenha.
      const laudo = unicidade.laudoDaArvore(arvore);
      const reprovou =
        laudo.problemas.length > 0 ||
        !laudo.portadorReconhecido ||
        !laudo.estatistica.portadorConferido;
      const obtido = reprovou ? "reprova" : "passa";
      const motivo = reprovou ? (laudo.problemas[0] || "portador irreconhecível") : null;
      const estatistica = laudo.estatistica;
      resultados.push({
        id: cenario.id, o_que: cenario.o_que,
        esperado: cenario.esperado, obtido, motivo, estatistica,
        ramos: Object.keys(estatistica.ramos),
        escopos: estatistica.escopos,
        conforme: obtido === cenario.esperado,
      });
    }
  } finally {
    fixtures.limparArvores();
  }
  return resultados;
}

/** O anel completo. Reprova se a guarda de unicidade estiver oca, ausente,
 *  desligada, ou se o catálogo tiver sido encolhido. */
function conferirProvaDaUnicidade(raizDoRepo) {

  // --- 1. a regra EXISTE e é chamável ------------------------------------
  assert.equal(
    typeof unicidade.conferirUnicidadeDoPortador, "function",
    "a guarda de unicidade sumiu ou deixou de ser exportada"
  );

  // --- 2. o CATÁLOGO não foi encolhido -----------------------------------
  const fonteDoPortador = fs.readFileSync(
    path.join(raizDoRepo || path.join(__dirname, ".."), unicidade.PORTADOR_UNICO),
    "latin1"
  );
  const ids = new Set(fixtures.catalogo(fonteDoPortador).map((c) => c.id));
  const faltando = fixtures.CENARIOS_OBRIGATORIOS.filter((id) => !ids.has(id));
  assert.deepEqual(
    faltando, [],
    "cenários obrigatórios sumiram do catálogo: " + faltando.join(", ") +
      " — encolher o catálogo é a forma silenciosa de aprovar o que ele cobria"
  );

  // --- 3. RESULTADO NEGATIVO REAL, cenário a cenário ---------------------
  const resultados = catalogoMemorizado || executarCatalogo(raizDoRepo);
  catalogoMemorizado = resultados;
  // TRÊS AFIRMAÇÕES INDEPENDENTES SOBRE O MESMO FATO, e a redundância é o
  // ponto. A primeira versão tinha uma só, e a mutação que trocava a lista de
  // divergentes por `[]` deixava a prova inteira cega — nome, comentário e
  // estrutura intactos. Defesa única é ponto único: quem apagar uma destas
  // três ainda esbarra nas outras duas, que contam a mesma coisa por outro
  // caminho.
  const divergentes = resultados.filter((r) => !r.conforme);
  assert.deepEqual(
    divergentes.map((r) => r.id + " (esperado " + r.esperado + ", deu " + r.obtido + ": " + r.o_que + ")"),
    [],
    "a guarda de unicidade deixou de se comportar como declarado"
  );
  assert.equal(
    resultados.filter((r) => r.obtido === r.esperado).length, resultados.length,
    "há cenário cujo veredito não é o declarado"
  );
  for (const r of resultados) {
    assert.equal(r.obtido, r.esperado,
      r.id + " devia " + r.esperado + " e " + r.obtido + ": " + r.o_que);
  }

  // --- 3b. COBERTURA DE RAMO, nos DOIS sentidos (§C3-06) -----------------
  //
  // Ramo decorativo é falha. E "decorativo" não se descobre lendo a tabela: só
  // confrontando o que ela DECLARA com o que os cenários DE FATO fizeram
  // disparar. A conferência é externa — a declaração mora no catálogo, a
  // tabela mora na regra, e nenhuma das duas se autoavalia.
  //
  // A C2 pagou por não ter isto: o ramo do handshake por GUID nunca disparava,
  // porque a fixture montava o GUID por concatenação e o texto contíguo jamais
  // existia. Um ramo morto, verde por três semanas.
  const observados = new Set(resultados.flatMap((r) => r.ramos));
  const declarados = Object.keys(fixtures.RAMO_EXERCITADO_POR);
  const porId = new Map(resultados.map((r) => [r.id, r]));

  assert.deepEqual(
    unicidade.IDS_DOS_RAMOS.filter((id) => !declarados.includes(id)), [],
    "há ramo na tabela de capacidades sem cenário declarado em " +
      "`RAMO_EXERCITADO_POR` — ramo que ninguém exercita é decoração"
  );
  assert.deepEqual(
    declarados.filter((id) => !unicidade.IDS_DOS_RAMOS.includes(id)), [],
    "`RAMO_EXERCITADO_POR` cobra ramo que a tabela não tem — ou o ramo foi " +
      "removido, ou o nome mudou; nos dois casos a cobertura declarada é falsa"
  );
  assert.deepEqual(
    unicidade.IDS_DOS_RAMOS.filter((id) => !observados.has(id)), [],
    "há ramo que NENHUM cenário do catálogo fez disparar"
  );
  for (const [ramo, cenario] of Object.entries(fixtures.RAMO_EXERCITADO_POR)) {
    const r = porId.get(cenario);
    assert.ok(r, "o cenário `" + cenario + "`, exclusivo do ramo `" + ramo +
      "`, sumiu do catálogo");
    assert.ok(
      r.ramos.includes(ramo),
      "o cenário `" + cenario + "` deixou de acionar o ramo `" + ramo +
        "` (acionou: " + (r.ramos.join(", ") || "nada") + ") — ou o ramo morreu, " +
        "ou o cenário deixou de exercitá-lo"
    );
  }

  // E os ESCOPOS: um escopo que nunca dispara é a camada composta desligada.
  for (const [escopo, cenario] of Object.entries(fixtures.ESCOPO_EXERCITADO_POR)) {
    const r = porId.get(cenario);
    assert.ok(r, "o cenário `" + cenario + "`, exclusivo do escopo `" + escopo + "`, sumiu");
    assert.ok(
      (r.escopos && r.escopos[escopo]) > 0,
      "nenhuma acusação saiu no escopo `" + escopo + "` no cenário `" + cenario +
        "` — a decisão composta pode estar desligada nesse escopo"
    );
  }

  const negativos = resultados.filter((r) => r.esperado === "reprova");
  const positivos = resultados.filter((r) => r.esperado === "passa");
  assert.ok(negativos.length >= 40,
    "o catálogo tem só " + negativos.length + " cenários de reprovação; " +
    "regra oca precisa de muitos negativos para ser desmascarada");
  assert.ok(positivos.length >= 12,
    "o catálogo tem só " + positivos.length + " cenários de aprovação; " +
    "sem eles, uma regra que reprova TUDO passaria — e derrubaria a árvore íntegra");

  // --- 4. as ASSERÇÕES foram de fato executadas --------------------------
  // Estatística da varredura real: uma implementação que devolve cedo não lê
  // arquivo nenhum, e "passou" sem ter olhado não é passar.
  const estatistica = unicidade.conferirUnicidadeDoPortador(raizDoRepo);
  assert.ok(estatistica && estatistica.arquivos > 10,
    "a varredura leu " + ((estatistica && estatistica.arquivos) || 0) +
    " arquivos da árvore real — implementação que retorna cedo não guarda nada");
  assert.ok(estatistica.asseveracoes >= estatistica.arquivos,
    "houve menos análises que arquivos — parte da árvore não foi examinada");
  assert.equal(estatistica.portadorConferido, true,
    "o portador não foi conferido: a análise pode estar cega para o próprio servidor");

  return { resultados, estatistica };
}

// ===========================================================================
// §6 — O GLOB OFICIAL
// ===========================================================================
//
// O portão deste repositório é `npm test`, e o alvo dele é um GLOB. Glob não
// tem manifesto: estreitá-lo para uma suíte-isca, trocá-lo por um arquivo único
// ou remover uma suíte obrigatória faz casos pararem de rodar com o portão
// VERDE. O censo já cobrava a FORMA do comando; o que faltava era cobrar o
// ALCANCE — expandir o padrão de verdade e exigir que o conjunto resultante
// contenha cada suíte que precisa rodar.

/** Converte um padrão de linha de comando em expressão regular de caminho. */
function padraoParaRegex(padrao) {
  const limpo = padrao.replace(/^["']|["']$/g, "").replace(/\\/g, "/");
  const escapado = limpo
    .replace(/[.+^${}()|[\]]/g, "\\$&")
    .replace(/\*\*/g, " ")
    .replace(/\*/g, "[^/]*")
    .replace(/ /g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp("^" + escapado + "$");
}

/** Os arquivos que o comando oficial de fato alcança. */
function alcanceDoComando(comando, raiz) {
  const semNode = comando.replace(/^\s*node\s+/, "");
  const partes = semNode.split(/\s+/).filter(Boolean);
  const alvos = partes.filter((p) => !p.startsWith("-"));
  const arquivos = unicidade.listarArquivos(raiz, "", []).map((a) => a.relativo);
  const alcancados = new Set();
  for (const alvo of alvos) {
    const re = padraoParaRegex(alvo);
    for (const rel of arquivos) if (re.test(rel)) alcancados.add(rel);
  }
  return { alvos, alcancados };
}

/** As suítes que `npm test` TEM de alcançar, o que cada uma carrega junto, e —
 *  [OS 52-C3] — o módulo a que cada uma precisa continuar LIGADA.
 *
 *  A campanha da C3 encontrou uma sabotagem que só a contagem não pega:
 *  substituir uma suíte obrigatória por uma ISCA de sessenta
 *  `test("...", () => {})` vazios. O piso por arquivo fica satisfeito (sessenta
 *  é mais que quarenta e oito), o `npm test` termina verde, e o que se perdeu
 *  são os casos de verdade — o juiz externo pega pelo total, mas só depois.
 *
 *  `exige` é a trava local: a suíte tem de continuar CARREGANDO o módulo que
 *  ela existe para exercitar. Não é contar `test(` — é cobrar o vínculo. Uma
 *  isca de corpos triviais não tem `require` nenhum, e cai aqui, na etapa
 *  `pretest`, antes de o glob rodar. */
const ALCANCE_OBRIGATORIO = Object.freeze({
  "test/assento_autoritativo.test.js": {
    porque: "chama o censo (e com ele a unicidade)",
    exige: "censo_de_suites",
  },
  "test/descoberta.test.js": {
    porque: "chama o censo (e com ele a unicidade)",
    exige: "censo_de_suites",
  },
  "test/costura_assento_descoberta.test.js": {
    porque: "chama o censo e prova a reciprocidade",
    exige: "censo_de_suites",
  },
  "test/unicidade_do_portador.test.js": {
    porque: "exercita o catálogo cenário a cenário",
    exige: "prova_da_unicidade",
  },
  "test/ci_obrigatorio.test.js": {
    porque: "guarda o CI externo e o piso do portão",
    exige: "portao_do_ci",
  },
  // [OS 52-C4] A suíte da AUTORIDADE do artefato. Ela precisa continuar ligada
  // a `ci/artefato.js`: uma isca de corpos triviais no lugar dela satisfaria o
  // piso por arquivo e deixaria o conjunto implantável sem quem o exercite.
  "test/artefato_unico.test.js": {
    porque: "exercita a autoridade do artefato produtivo",
    exige: "artefato",
  },
});

function conferirGlobOficial(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
  const comando = (pkg.scripts && pkg.scripts.test) || "";

  assert.match(comando, /(^|\s)--test(\s|$)/,
    "o comando oficial deixou de rodar o executor de testes do Node");

  // A ETAPA QUE RODA ANTES DO GLOB.
  //
  // Sem ela existe uma sabotagem que nada pega: estreitar o comando para uma
  // suíte-isca faz com que NENHUMA suíte obrigatória rode, ninguém chame o
  // censo, e o portão termine verde com um caso só. A campanha encontrou esse
  // escape, e ele é o limite estrutural que a OS 44 já tinha nomeado — uma
  // suíte não consegue se obrigar a rodar.
  //
  // `pretest` é a primeira etapa do MESMO `npm test`, não um segundo comando:
  // `scripts.test` continua exatamente o que era, e é ele que o CI ecoa.
  const pretest = (pkg.scripts && pkg.scripts.pretest) || "";
  assert.match(
    pretest, /guarda_do_portao\.js/,
    "o manifesto perdeu a etapa `pretest` que roda a guarda antes do glob — sem ela, estreitar o comando para uma suíte-isca deixa o portão verde"
  );
  assert.ok(
    fs.existsSync(path.join(raiz, "test", "guarda_do_portao.js")),
    "`test/guarda_do_portao.js` sumiu do disco — a etapa `pretest` aponta para o vazio"
  );

  const { alvos, alcancados } = alcanceDoComando(comando, raiz);

  // Arquivo único não é portão: é uma suíte escolhida a dedo.
  const alvosConcretos = alvos.filter((a) => !/[*?]/.test(a.replace(/^["']|["']$/g, "")));
  assert.deepEqual(
    alvosConcretos, [],
    "o comando oficial passou a nomear arquivos em vez de varrer: " +
      alvosConcretos.join(", ") + " — alvo nomeado é suíte escolhida, não portão"
  );

  const suitesAlcancadas = [...alcancados].filter((r) => r.endsWith(".test.js"));
  const noDisco = unicidade.listarArquivos(raiz, "", [])
    .map((a) => a.relativo)
    .filter((r) => /^test\/[^/]+\.test\.js$/.test(r));

  const perdidas = noDisco.filter((r) => !alcancados.has(r));
  assert.deepEqual(
    perdidas, [],
    "há suíte no disco que o comando oficial NÃO alcança: " + perdidas.join(", ") +
      " — glob estreitado deixa casos fora do portão com ele verde"
  );

  for (const [suite, exigencia] of Object.entries(ALCANCE_OBRIGATORIO)) {
    assert.ok(
      alcancados.has(suite),
      "`npm test` deixou de alcançar `" + suite + "` — " + exigencia.porque
    );
    const caminho = path.join(raiz, suite);
    assert.ok(
      fs.existsSync(caminho),
      "`" + suite + "` sumiu do disco — " + exigencia.porque
    );
    // A SUÍTE CONTINUA LIGADA AO QUE ELA EXERCITA. Isca de corpos triviais
    // satisfaz qualquer contador e não carrega módulo nenhum.
    //
    // A leitura é a MESMA que monta o grafo de ligação da unicidade: os
    // especificadores relativos do texto bruto. Tem de ser bruto — o scanner
    // léxico esvazia strings, e o nome do módulo mora dentro de uma —, e tem de
    // ser a FORMA `require("...")`, para que citar o nome num comentário não
    // valha como vínculo.
    const ligacoes = unicidade.especificadoresDe(fs.readFileSync(caminho, "latin1"));
    assert.ok(
      ligacoes.some((e) => e.includes(exigencia.exige)),
      "`" + suite + "` deixou de carregar `" + exigencia.exige + "` — ela " +
        exigencia.porque + ", e uma suíte que não carrega o que exercita foi " +
        "substituída por isca: os títulos continuam lá e as provas não"
    );
  }

  assert.ok(suitesAlcancadas.length >= 5,
    "o comando oficial alcança só " + suitesAlcancadas.length + " suítes");

  return { comando, alvos, suites: suitesAlcancadas.length };
}

module.exports = {
  conferirProvaDaUnicidade, executarCatalogo,
  conferirGlobOficial, alcanceDoComando, padraoParaRegex, ALCANCE_OBRIGATORIO,
};
