// ci/artefato.js — A AUTORIDADE CANÔNICA DO ARTEFATO PRODUTIVO (OS 52-C4).
//
// ===========================================================================
// A MUDANÇA DE AUTORIDADE
// ===========================================================================
//
// As OS 52-C1 a C3 protegiam o repositório perguntando "isto se PARECE com um
// servidor?". A resposta ficou boa — capacidade composta da árvore, nove ramos,
// escopos de arquivo, conjunto e árvore — e continua valendo como HEURÍSTICA.
// Mas a pergunta era a errada.
//
// Reconhecimento sintático tem um teto que nenhuma expressão regular
// atravessa: `sv["cre"+"ateServer"]()`, `Reflect.get(net, alvo)`,
// `new Function(atob(carga))()`. Cada evasão dessas exige uma regra nova, e a
// regra nova chega depois do escape. Quem defende por reconhecimento está
// sempre um passo atrás de quem ataca.
//
// A OS 52-A2 trocou a pergunta. A propriedade autoritativa passa a ser
// **UNICIDADE IMPLANTÁVEL**, e ela não olha o conteúdo de arquivo nenhum:
//
//   1. o conjunto de caminhos do artefato produtivo é EXATAMENTE o declarado;
//   2. `scripts.start` é literalmente `node server.js`, e nenhum segundo script
//      ARRANCA um arquivo do artefato;
//   3. o artefato não carrega compactado, elo simbólico, segundo manifesto nem
//      diretório com manifesto próprio.
//
// Uma duplicata escrita com colchetes, base64 ou `new Function` reprova aqui
// pelo mesmo motivo que uma duplicata escrita de forma óbvia: **ela não
// pertence ao artefato**. A mensagem não fala de capacidade, e é esse o ponto —
// a defesa deixou de depender de entender o que o arquivo faz.
//
// ===========================================================================
// O QUE ESTE ARQUIVO NÃO FAZ
// ===========================================================================
//
// Não amplia o scanner, não abre parser, não executa arquivo nenhum da árvore.
// Ele lê a ÁRVORE DO GIT (`git ls-tree`), monta o artefato com `git archive` e
// compara conjuntos. É aritmética de conjunto sobre caminhos, e a única leitura
// de conteúdo é a dos MAGIC BYTES dos dois arquivos que sobram no artefato.
//
// ===========================================================================
// UMA PREMISSA DA OS QUE COLIDE COM O MANIFESTO CONGELADO — dita em voz alta
// ===========================================================================
//
// A OS 52-C4 exige "nenhum segundo script invoca node" E proíbe alterar
// `scripts.test`. O `scripts.test` deste repositório é
// `node --test "test/*.test.js"`, e `pretest` e `check` também chamam `node`.
// Lido ao pé da letra, o requisito reprovaria a base no primeiro segundo e não
// haveria correção possível sem violar a proibição.
//
// A leitura implementada é a que o resto da OS sustenta — a lista de recusas do
// §START EXATO é toda de formas de ARRANCAR o produto por outro caminho:
//
//     nenhum script além de `start` pode ARRANCAR um arquivo do ARTEFATO.
//
// Script que chama `node` contra caminho EXCLUÍDO (`test/`, `ci/`) é
// ferramenta, não deploy, e continua permitido. `node --check server.js` toca
// um produtivo mas não arranca nada: `--check` analisa a sintaxe e sai. As
// recusas categóricas do §START EXATO valem para QUALQUER script, alvo nenhum
// importa: `-e`, `--eval`, `-p`, `--print`, composição de shell, `npm run`
// indireto, `.mjs`, `.cjs` e caminho sem extensão.
//
// Esta é a única interpretação declarada. Se a arbitragem quiser a leitura
// literal, o caminho é liberar `scripts.test` — e aí a regra vira uma linha.
// ===========================================================================

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const CAMINHO_DO_MANIFESTO = path.join("ci", "artefato_produtivo.json");

// ---------------------------------------------------------------------------
// 1. LEITURA DO GIT — a árvore, e não o disco
// ---------------------------------------------------------------------------
//
// A árvore do git é o que o deploy recebe. O disco pode ter lixo não
// versionado que nunca sobe, e pode não ter o que está versionado. Quem manda
// é o commit.

function git(raiz, args, binario) {
  return cp.execFileSync("git", ["-C", raiz, ...args], {
    encoding: binario ? "buffer" : "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** `[{ modo, caminho }]` de um commit. Modo importa: `120000` é elo simbólico
 *  e `160000` é submódulo, e os dois trazem conteúdo de fora da árvore. */
function caminhosDoCommit(raiz, sha) {
  let bruto;
  try {
    bruto = git(raiz, ["ls-tree", "-r", sha]);
  } catch (_) {
    return null;
  }
  const saida = [];
  for (const linha of bruto.split("\n")) {
    const m = /^(\d{6})\s+(\w+)\s+([0-9a-f]+)\t(.+)$/.exec(linha.trim());
    if (m) saida.push({ modo: m[1], tipo: m[2], caminho: m[4] });
  }
  return saida;
}

/** Os caminhos da ÁRVORE DE TRABALHO que ainda virariam commit: rastreados
 *  mais não rastreados que o `.gitignore` não exclui.
 *
 *  Por que os dois mundos. O que o provedor recebe é o COMMIT — e é por isso
 *  que o artefato é montado de `git archive`. Mas uma guarda que só olhasse o
 *  commit só acusaria depois do commit feito, e o `pretest` existe justamente
 *  para acusar antes. Arquivo ignorado não entra: ele não é commitado, logo não
 *  é implantado. */
function caminhosDaArvore(raiz) {
  let bruto;
  try {
    bruto = git(raiz, ["ls-files", "-c", "-o", "--exclude-standard"]);
  } catch (_) {
    return null;
  }
  const saida = [];
  for (const linha of bruto.split("\n")) {
    const caminho = linha.trim();
    if (!caminho) continue;
    let modo = "100644";
    try {
      if (fs.lstatSync(path.join(raiz, caminho)).isSymbolicLink()) modo = "120000";
    } catch (_) { /* rastreado e apagado no disco: o commit ainda o tem */ }
    saida.push({ modo, tipo: "blob", caminho, ondeVive: "árvore de trabalho" });
  }
  return saida;
}

/** Os nomes dentro do tar que `git archive` produz.
 *
 *  Lidos dos cabeçalhos de 512 bytes, sem extrair nada. É a mesma leitura que a
 *  guarda de unicidade faz de um TAR qualquer — aqui aplicada ao artefato que o
 *  próprio repositório produz. */
function nomesDoArchive(raiz, sha) {
  let tar;
  try {
    tar = git(raiz, ["archive", "--format=tar", sha], true);
  } catch (_) {
    return null;
  }
  const nomes = [];
  for (let p = 0; p + 512 <= tar.length; p += 512) {
    const cabecalho = tar.slice(p, p + 512);
    if (cabecalho.slice(257, 262).toString("latin1") !== "ustar") break;
    const nome = cabecalho.slice(0, 100).toString("latin1").replace(/\0.*$/, "");
    const tipo = cabecalho.slice(156, 157).toString("latin1");
    const tamanho = parseInt(
      cabecalho.slice(124, 136).toString("latin1").replace(/\0.*$/, "").trim(), 8
    ) || 0;
    // `0` e `\0` são arquivo comum; `2` é elo simbólico, que interessa porque
    // tem de reprovar. `5` é diretório, e `g`/`x` são os cabeçalhos PAX que o
    // `git archive` põe na frente do tar para carregar o SHA do commit — não
    // são conteúdo, e tratá-los como arquivo faria o artefato íntegro reprovar
    // por causa de um metadado.
    const ehConteudo = tipo === "0" || tipo === "\0" || tipo === "2";
    if (nome && ehConteudo) nomes.push({ nome, tipo });
    p += Math.ceil(tamanho / 512) * 512;
  }
  return nomes;
}

// ---------------------------------------------------------------------------
// 2. O MANIFESTO E A CLASSIFICAÇÃO
// ---------------------------------------------------------------------------

function lerManifesto(raiz) {
  let bruto;
  try {
    bruto = fs.readFileSync(path.join(raiz, CAMINHO_DO_MANIFESTO), "utf8");
  } catch (_) {
    return { erro: "`" + CAMINHO_DO_MANIFESTO + "` não existe" };
  }
  let m;
  try {
    m = JSON.parse(bruto);
  } catch (e) {
    return { erro: "`" + CAMINHO_DO_MANIFESTO + "` não é JSON válido" };
  }
  if (!Array.isArray(m.produtivos) || m.produtivos.length === 0) {
    return { erro: "o manifesto não declara `produtivos`" };
  }
  if (!Array.isArray(m.exclusoes)) {
    return { erro: "o manifesto não declara `exclusoes`" };
  }
  if (typeof m.start_exato !== "string" || !m.start_exato) {
    return { erro: "o manifesto não declara `start_exato`" };
  }
  if (typeof m.base_medida !== "string" || !/^[0-9a-f]{40}$/.test(m.base_medida)) {
    return { erro: "o manifesto não declara `base_medida` como SHA completo" };
  }
  return { manifesto: m };
}

/** Um `glob` simplíssimo, que NÃO atravessa diretório. Deliberado: regra de
 *  exclusão precisa ser lida por gente, e `**` esconde o que exclui. */
function casaGlob(padrao, caminho) {
  const re = new RegExp(
    "^" + padrao.split("*").map((p) => p.replace(/[.+^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$"
  );
  return re.test(caminho);
}

/** Devolve a regra que exclui o caminho, ou `null`. */
function regraQueExclui(exclusoes, caminho) {
  for (const r of exclusoes) {
    if (r.regra === "prefixo" && caminho.startsWith(r.valor)) return r;
    if (r.regra === "caminho" && caminho === r.valor) return r;
    if (r.regra === "glob" && casaGlob(r.valor, caminho)) return r;
  }
  return null;
}

/** A classificação de TODA a árvore. Devolve os três montes. */
function classificar(manifesto, caminhos) {
  const produtivosDeclarados = new Set(manifesto.produtivos);
  const produtivos = [];
  const excluidos = [];
  const semClasse = [];
  for (const item of caminhos) {
    if (produtivosDeclarados.has(item.caminho)) { produtivos.push(item); continue; }
    if (regraQueExclui(manifesto.exclusoes, item.caminho)) { excluidos.push(item); continue; }
    semClasse.push(item);
  }
  return { produtivos, excluidos, semClasse };
}

// ---------------------------------------------------------------------------
// 3. O ARRANQUE
// ---------------------------------------------------------------------------

/** Bandeiras do Node que LEEM sem arrancar. `--check` analisa a sintaxe e sai;
 *  não abre porta, não roda módulo, não é um segundo deploy. */
const BANDEIRAS_QUE_NAO_ARRANCAM = Object.freeze(["--check", "-c"]);

/** Formas recusadas em QUALQUER script, alvo nenhum importa. */
const FORMAS_PROIBIDAS = Object.freeze([
  [/\bnode\b[^\n]*\s(?:-e|--eval)\b/, "`node -e` / `node --eval`: código arbitrário no manifesto"],
  [/\bnode\b[^\n]*\s(?:-p|--print)\b/, "`node -p` / `node --print`: código arbitrário no manifesto"],
  [/&&|\|\||;|(?:^|[^&])&(?:[^&]|$)|\|/, "composição de shell (`&`, `&&`, `||`, `;`, `|`): dois comandos numa linha"],
  [/\bnpm\s+run\b/, "`npm run` indireto: o arranque passa a depender de outro script"],
  [/\.(?:mjs|cjs)\b/, "alvo `.mjs`/`.cjs`: outro carregador, outro artefato"],
]);

/** Os alvos `node [bandeiras] <alvo>` de um comando. */
function alvosDeNode(comando) {
  const achados = [];
  const re = /\bnode\b((?:\s+--?[\w-]+(?:=\S+)?)*)\s+("?)([^\s"']+)\2/g;
  let m;
  while ((m = re.exec(comando))) {
    achados.push({ bandeiras: m[1].trim().split(/\s+/).filter(Boolean), alvo: m[3] });
  }
  return achados;
}

function conferirArranque(manifesto, pacote, classificados, reprovar) {
  const scripts = (pacote && pacote.scripts) || {};

  // --- `start` LITERAL -----------------------------------------------------
  if (scripts.start !== manifesto.start_exato) {
    reprovar(
      "START DESVIADO: `scripts.start` é " + JSON.stringify(scripts.start) +
      " e o manifesto exige exatamente " + JSON.stringify(manifesto.start_exato) +
      ". A igualdade é LITERAL: qualquer bandeira, redirecionamento, espaço a " +
      "mais ou segundo comando muda o que o provedor executa."
    );
  }

  const produtivos = new Set(manifesto.produtivos);
  const excluidos = new Set(classificados.excluidos.map((c) => c.caminho));

  for (const [nome, comando] of Object.entries(scripts)) {
    if (typeof comando !== "string") continue;

    for (const [forma, porque] of FORMAS_PROIBIDAS) {
      if (forma.test(comando)) {
        reprovar("SCRIPT `" + nome + "` RECUSADO: " + porque + " (está `" + comando + "`).");
      }
    }
    if (nome === "start") continue;

    // Nenhum segundo script pode ARRANCAR um arquivo do artefato.
    for (const { bandeiras, alvo } of alvosDeNode(comando)) {
      const limpo = alvo.replace(/^\.\//, "");
      const naoArranca = bandeiras.some((b) => BANDEIRAS_QUE_NAO_ARRANCAM.includes(b));
      if (produtivos.has(limpo) && !naoArranca) {
        reprovar(
          "SEGUNDO ARRANQUE: o script `" + nome + "` executa `" + limpo + "`, que é " +
          "do ARTEFATO. Só `start` pode arrancar o produto — um segundo alvo de " +
          "arranque é um segundo deploy esperando alguém apontar para ele."
        );
        continue;
      }
      if (produtivos.has(limpo) || excluidos.has(limpo)) continue;
      if (/[*?]/.test(limpo)) {
        // Glob: basta que ele não alcance nada de fora dos excluídos.
        const alcanca = classificados.produtivos
          .map((c) => c.caminho)
          .filter((c) => casaGlob(limpo.replace(/^"|"$/g, ""), c));
        if (alcanca.length) {
          reprovar(
            "SEGUNDO ARRANQUE POR GLOB: o script `" + nome + "` alcança " +
            alcanca.join(", ") + ", que é do ARTEFATO."
          );
        }
        continue;
      }
      if (!/\.[a-z]+$/i.test(limpo)) {
        reprovar(
          "ALVO SEM EXTENSÃO: o script `" + nome + "` executa `" + limpo + "`. " +
          "Sem extensão não dá para dizer o que o Node vai carregar, e caminho " +
          "que ninguém classifica não pertence a artefato nenhum."
        );
        continue;
      }
      reprovar(
        "ALVO NÃO CLASSIFICADO: o script `" + nome + "` executa `" + limpo + "`, " +
        "que não é produtivo nem está entre as exclusões declaradas."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. O ARTEFATO
// ---------------------------------------------------------------------------

const MAGIC = Object.freeze([
  ["ZIP", (b) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b &&
    ((b[2] === 0x03 && b[3] === 0x04) || (b[2] === 0x05 && b[3] === 0x06) || (b[2] === 0x07 && b[3] === 0x08))],
  ["GZIP", (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b],
  ["XZ", (b) => b.length > 5 && b[0] === 0xfd && b[1] === 0x37 && b[2] === 0x7a && b[3] === 0x58 && b[4] === 0x5a && b[5] === 0x00],
  ["BZIP2", (b) => b.length > 2 && b[0] === 0x42 && b[1] === 0x5a && b[2] === 0x68],
  ["7Z", (b) => b.length > 5 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c],
  ["RAR", (b) => b.length > 6 && b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21 && b[4] === 0x1a && b[5] === 0x07],
  ["ZSTD", (b) => b.length > 3 && b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd],
  ["TAR", (b) => b.length >= 265 && b.slice(257, 262).toString("latin1") === "ustar"],
]);

function formatoCompactadoDe(buf) {
  for (const [nome, casa] of MAGIC) if (casa(buf)) return nome;
  return null;
}

const EXTENSOES_PROIBIDAS_NA_RAIZ = Object.freeze([".txt", ".html", ".htm", ".mjs", ".cjs"]);

/** Monta o artefato a partir de `git archive HEAD`, aplicando SOMENTE as
 *  exclusões declaradas, e confere que o que sobrou é exatamente o declarado. */
function conferirArtefato(raiz, sha, manifesto, reprovar) {
  const nomes = nomesDoArchive(raiz, sha);
  if (nomes === null) {
    reprovar("ARTEFATO NÃO PÔDE SER MONTADO: `git archive` falhou. Sem artefato " +
      "não há o que conferir, e ausência é reprovação.");
    return null;
  }

  for (const item of nomes) {
    if (item.tipo === "2") {
      reprovar("ELO SIMBÓLICO NO ARTEFATO: `" + item.nome + "` aponta para fora " +
        "da árvore versionada — o que o deploy recebe deixaria de ser o que o " +
        "commit declara.");
    }
  }

  const restante = nomes
    .map((n) => n.nome)
    .filter((n) => !regraQueExclui(manifesto.exclusoes, n))
    .sort();
  const esperado = (manifesto.artefato_final || manifesto.produtivos).slice().sort();

  const sobrando = restante.filter((n) => !esperado.includes(n));
  const faltando = esperado.filter((n) => !restante.includes(n));

  if (sobrando.length) {
    reprovar(
      "ARTEFATO CARREGA O QUE NÃO DEVIA: " + sobrando.join(", ") + ". Depois de " +
      "aplicar as exclusões declaradas, o que sobra do `git archive` tem de ser " +
      "EXATAMENTE o artefato — e sobra é arquivo que vai subir sem ninguém ter dito."
    );
  }
  if (faltando.length) {
    reprovar(
      "ARTEFATO INCOMPLETO: falta " + faltando.join(", ") + " no `git archive`. " +
      "Artefato que não carrega o portador não implanta nada."
    );
  }

  // Os dois arquivos que sobram: nem compactado, nem extensão proibida.
  for (const nome of restante) {
    const naRaiz = !nome.includes("/");
    const ext = (/\.[a-z0-9]+$/i.exec(nome) || [""])[0].toLowerCase();
    if (naRaiz && !ext) {
      reprovar("ARQUIVO SEM EXTENSÃO NA RAIZ DO ARTEFATO: `" + nome + "`.");
    }
    if (naRaiz && EXTENSOES_PROIBIDAS_NA_RAIZ.includes(ext)) {
      reprovar("EXTENSÃO PROIBIDA NA RAIZ DO ARTEFATO: `" + nome + "`.");
    }
    if (nome !== "package.json" && /(^|\/)package\.json$/.test(nome)) {
      reprovar("SEGUNDO MANIFESTO NO ARTEFATO: `" + nome + "`.");
    }
    let conteudo = null;
    try { conteudo = git(raiz, ["show", sha + ":" + nome], true); } catch (_) { conteudo = null; }
    if (conteudo) {
      const formato = formatoCompactadoDe(conteudo);
      if (formato) {
        reprovar("COMPACTADO NO ARTEFATO: `" + nome + "` é um pacote " + formato +
          " pelos bytes. Conteúdo empacotado não é auditável por leitura.");
      }
    }
  }

  return restante;
}

// ---------------------------------------------------------------------------
// 5. A ÂNCORA HISTÓRICA
// ---------------------------------------------------------------------------
//
// Promover uma duplicata a `produtivos` e realinhar o manifesto é a sabotagem
// que a declaração sozinha não pega — quem edita a declaração edita também o
// que ela declara. A saída é a mesma da OS 52-C3: o commit anterior.
//
// Quando o commit ancestral NÃO tem manifesto (a base `99d2eb6` não tem), o
// conjunto é DERIVADO dele: o alvo de `scripts.start` mais o próprio
// `package.json`. Derivado da história, não declarado por ninguém.

function produtivosDoCommit(raiz, sha) {
  const bruto = (() => {
    try { return git(raiz, ["show", sha + ":" + CAMINHO_DO_MANIFESTO.split(path.sep).join("/")]); }
    catch (_) { return null; }
  })();
  if (bruto !== null) {
    try {
      const m = JSON.parse(bruto);
      if (Array.isArray(m.produtivos)) return { origem: "manifesto", conjunto: m.produtivos.slice().sort() };
    } catch (_) { /* manifesto ilegível no passado: cai na derivação */ }
  }
  let pacote;
  try { pacote = JSON.parse(git(raiz, ["show", sha + ":package.json"])); }
  catch (_) { return null; }
  const start = (pacote.scripts && pacote.scripts.start) || "";
  const m = /\bnode\s+(?:--?[\w-]+(?:=\S+)?\s+)*("?)([^\s"']+)\1\s*$/.exec(start.trim());
  if (!m) return null;
  return { origem: "derivado de scripts.start", conjunto: [m[2].replace(/^\.\//, ""), "package.json"].sort() };
}

function conferirAncora(raiz, manifesto, reprovar) {
  const declarado = manifesto.produtivos.slice().sort();
  const shas = [];
  for (const ref of ["HEAD", "HEAD^1"]) {
    try { shas.push(git(raiz, ["rev-parse", "--verify", ref + "^{commit}"]).trim()); }
    catch (_) { /* commit raiz não tem pai */ }
  }
  if (manifesto.base_medida && !shas.includes(manifesto.base_medida)) shas.push(manifesto.base_medida);

  let comparacoes = 0;
  for (const sha of shas) {
    const antes = produtivosDoCommit(raiz, sha);
    if (!antes) continue;
    comparacoes++;
    const igual =
      antes.conjunto.length === declarado.length &&
      antes.conjunto.every((c, i) => c === declarado[i]);
    if (!igual) {
      reprovar(
        "CONJUNTO PRODUTIVO ALTERADO: o manifesto declara [" + declarado.join(", ") +
        "] e o commit `" + sha.slice(0, 7) + "` " + antes.origem + " dá [" +
        antes.conjunto.join(", ") + "]. Promover caminho para `produtivos` e " +
        "realinhar a declaração não muda o que um commit já gravou."
      );
    }
  }
  if (comparacoes === 0) {
    reprovar("ÂNCORA AUSENTE: nenhum commit ancestral pôde ser lido para comparar o " +
      "conjunto produtivo. Comparação que não compara não protege.");
  }
  return comparacoes;
}

// ---------------------------------------------------------------------------
// 6. O VEREDITO
// ---------------------------------------------------------------------------

function conferir(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");
  const reprovacoes = [];
  const reprovar = (m) => reprovacoes.push(m);
  const dados = { produtivos: [], excluidos: 0, artefato: [], ancoras: 0 };

  const { manifesto, erro } = lerManifesto(raiz);
  if (erro) {
    reprovar("MANIFESTO DO ARTEFATO AUSENTE OU INVÁLIDO: " + erro + ". Sem a " +
      "declaração não há conjunto a comparar, e portão que não afirma nada é " +
      "verde decorativo.");
    return { reprovacoes, dados };
  }

  let sha;
  try { sha = git(raiz, ["rev-parse", "--verify", "HEAD^{commit}"]).trim(); }
  catch (e) {
    reprovar("SEM COMMIT: não foi possível ler `HEAD` nesta árvore. A autoridade " +
      "é o commit, não o disco.");
    return { reprovacoes, dados };
  }

  const doCommit = caminhosDoCommit(raiz, sha);
  if (doCommit === null || doCommit.length === 0) {
    reprovar("ÁRVORE DO COMMIT ILEGÍVEL: `git ls-tree` não devolveu caminho nenhum.");
    return { reprovacoes, dados };
  }
  // A UNIÃO dos dois mundos. O commit é o que sobe; a árvore de trabalho é o
  // que está prestes a subir. Guardar só o primeiro acusaria tarde demais.
  const daArvore = caminhosDaArvore(raiz) || [];
  const vistos = new Set();
  const caminhos = [];
  for (const item of doCommit.concat(daArvore)) {
    if (vistos.has(item.caminho)) continue;
    vistos.add(item.caminho);
    caminhos.push(item);
  }

  // --- modo: elo simbólico e submódulo trazem conteúdo de fora -------------
  for (const item of caminhos) {
    if (item.modo === "120000") {
      reprovar("ELO SIMBÓLICO VERSIONADO: `" + item.caminho + "`. O conteúdo mora " +
        "fora da árvore, e o que o deploy recebe deixa de ser o que o commit declara.");
    }
    if (item.modo === "160000") {
      reprovar("SUBMÓDULO VERSIONADO: `" + item.caminho + "`. Traz uma segunda " +
        "árvore inteira, com o manifesto dela.");
    }
  }

  // --- classificação: IGUALDADE de conjunto, nunca contenção ---------------
  const classificados = classificar(manifesto, caminhos);
  dados.produtivos = classificados.produtivos.map((c) => c.caminho).sort();
  dados.excluidos = classificados.excluidos.length;

  if (classificados.semClasse.length) {
    reprovar(
      "CAMINHO NÃO CLASSIFICADO: " + classificados.semClasse.map((c) => c.caminho).join(", ") +
      ". Todo caminho versionado tem de ser produtivo declarado ou casar com uma " +
      "exclusão declarada. Arquivo que ninguém classificou é arquivo que sobe sem " +
      "ninguém ter decidido que sobe."
    );
  }

  const declarado = manifesto.produtivos.slice().sort();
  const encontrado = dados.produtivos;
  const faltando = declarado.filter((c) => !encontrado.includes(c));
  if (faltando.length) {
    reprovar("PRODUTIVO DECLARADO E AUSENTE: " + faltando.join(", ") +
      " está no manifesto e não está no commit.");
  }

  // --- segundo manifesto, e diretório com manifesto próprio ----------------
  for (const item of caminhos) {
    if (item.caminho !== "package.json" && /(^|\/)package\.json$/.test(item.caminho)) {
      reprovar("SEGUNDO MANIFESTO: `" + item.caminho + "` é um projeto instalável " +
        "próprio, com o próprio alvo de arranque.");
    }
  }

  // --- o arranque, nos DOIS mundos -----------------------------------------
  //
  // O commit é o que o provedor executa; a árvore de trabalho é o que está
  // prestes a virar commit. Um `start` desviado só no disco passaria batido se
  // aqui se lesse apenas o commit — e o `pretest` existe para pegá-lo ANTES.
  // Reprovar por qualquer um dos dois é a leitura fail-closed.
  const acusadas = new Set();
  const reprovarUmaVez = (m) => { if (!acusadas.has(m)) { acusadas.add(m); reprovar(m); } };

  const pacotes = [];
  try { pacotes.push(["commit", JSON.parse(git(raiz, ["show", sha + ":package.json"]))]); }
  catch (_) { /* ausente no commit: acusado logo abaixo */ }
  try { pacotes.push(["árvore de trabalho", JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"))]); }
  catch (_) { /* ausente no disco */ }

  if (!pacotes.length) {
    reprovar("`package.json` ausente ou ilegível no commit e no disco — o alvo de arranque sumiu da fonte.");
  } else {
    for (const [onde, pacote] of pacotes) {
      conferirArranque(manifesto, pacote, classificados,
        (m) => reprovarUmaVez(m + " [" + onde + "]"));
    }
  }

  // --- o artefato, montado de verdade --------------------------------------
  const artefato = conferirArtefato(raiz, sha, manifesto, reprovar);
  if (artefato) dados.artefato = artefato;

  // --- a âncora ------------------------------------------------------------
  dados.ancoras = conferirAncora(raiz, manifesto, reprovar);

  return { reprovacoes, dados };
}

/** A porta de entrada de quem AFIRMA: estoura com o laudo inteiro.
 *
 *  O nome é próprio de propósito. O juiz externo cobra esta CHAMADA no
 *  programa do `pretest`, e um nome genérico (`conferir`) apareceria por
 *  acidente em qualquer arquivo. */
function exigirArtefatoUnico(raizDoRepo) {
  const veredito = conferir(raizDoRepo);
  if (veredito.reprovacoes.length === 0) return veredito.dados;
  const erro = new Error(
    "ARTEFATO PRODUTIVO VIOLADO — " + veredito.reprovacoes.length + " reprovação(ões):\n  " +
    veredito.reprovacoes.join("\n  ")
  );
  erro.reprovacoes = veredito.reprovacoes;
  throw erro;
}

// ---------------------------------------------------------------------------
// 7. O SCANNER MÍNIMO — para quem cobra CHAMADA, e não menção
// ---------------------------------------------------------------------------
//
// O juiz externo precisa distinguir `exigirArtefatoUnico(raiz)` de
// `"exigirArtefatoUnico("` dentro de uma string ou de um comentário. Isso pede
// um scanner léxico, e existe um muito melhor em
// `test/unicidade_do_portador.js` — que esta camada NÃO pode importar.
//
// A independência é o ponto da OS 52-A2: a autoridade do artefato não pode
// depender da heurística de capacidade, senão apagar a heurística apaga as
// duas. Trinta linhas duplicadas é o preço, e é barato perto de acoplar as
// camadas que a OS mandou separar.
function programaDe(fonte) {
  let saida = "";
  let i = 0;
  const n = fonte.length;
  while (i < n) {
    const c = fonte[i], d = fonte[i + 1];
    if (c === "/" && d === "/") { while (i < n && fonte[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(fonte[i] === "*" && fonte[i + 1] === "/")) i++;
      i += 2; saida += " "; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const aspa = c;
      i++;
      while (i < n && fonte[i] !== aspa) { if (fonte[i] === "\\") i++; i++; }
      i++; saida += aspa + aspa; continue;
    }
    saida += c; i++;
  }
  return saida;
}

/** A amarração, vista de fora: os arquivos existem e a CHAMADA está no
 *  programa — não num comentário, não numa string. */
const AMARRACAO_DO_ARTEFATO = Object.freeze({
  "ci/artefato.js": { chama: false, papel: "é a autoridade do artefato produtivo" },
  "ci/artefato_produtivo.json": { chama: false, papel: "é a declaração do conjunto produtivo" },
  "test/guarda_do_portao.js": { chama: true, papel: "chama a autoridade na etapa `pretest`, antes do glob" },
  "test/censo_de_suites.js": { chama: true, papel: "chama a autoridade de dentro do censo" },
});

function conferirAmarracaoDoArtefato(raiz, lerArquivo) {
  const reprovacoes = [];
  for (const [arquivo, exigencia] of Object.entries(AMARRACAO_DO_ARTEFATO)) {
    const fonte = lerArquivo(path.join(raiz, arquivo));
    if (fonte === null) {
      reprovacoes.push("AUTORIDADE DO ARTEFATO AUSENTE: `" + arquivo + "` sumiu — " +
        exigencia.papel + ".");
      continue;
    }
    if (!exigencia.chama) continue;
    if (!/exigirArtefatoUnico\s*\(/.test(programaDe(fonte))) {
      reprovacoes.push(
        "AUTORIDADE DO ARTEFATO DESLIGADA: `" + arquivo + "` não CHAMA " +
        "`exigirArtefatoUnico(...)` no programa. Menção em comentário, nome " +
        "dentro de string ou `require` sem chamada deixam o corpo intacto e a " +
        "guarda desligada — que é a sabotagem mais barata que existe."
      );
    }
  }
  return reprovacoes;
}

function principal(argv) {
  const args = argv.slice();
  let raiz = path.join(__dirname, "..");
  const i = args.indexOf("--raiz");
  if (i >= 0 && args[i + 1]) raiz = args[i + 1];

  const veredito = conferir(raiz);
  if (veredito.reprovacoes.length === 0) {
    const d = veredito.dados;
    process.stdout.write(
      "ARTEFATO VERDE — conjunto produtivo [" + d.produtivos.join(", ") + "] · " +
      d.excluidos + " caminhos excluídos por regra declarada · artefato de " +
      "`git archive`: [" + d.artefato.join(", ") + "] · " + d.ancoras +
      " âncora(s) histórica(s) conferida(s).\n"
    );
    return 0;
  }
  process.stdout.write("ARTEFATO VERMELHO — " + veredito.reprovacoes.length + " reprovação(ões):\n");
  for (const m of veredito.reprovacoes) process.stdout.write("  * " + m + "\n");
  return 1;
}

module.exports = {
  CAMINHO_DO_MANIFESTO, BANDEIRAS_QUE_NAO_ARRANCAM, FORMAS_PROIBIDAS,
  EXTENSOES_PROIBIDAS_NA_RAIZ,
  lerManifesto, caminhosDoCommit, caminhosDaArvore, nomesDoArchive, casaGlob, regraQueExclui,
  classificar, alvosDeNode, conferirArranque, formatoCompactadoDe,
  conferirArtefato, produtivosDoCommit, conferirAncora, conferir, principal,
  exigirArtefatoUnico, programaDe, AMARRACAO_DO_ARTEFATO, conferirAmarracaoDoArtefato,
};

if (require.main === module) process.exit(principal(process.argv.slice(2)));
