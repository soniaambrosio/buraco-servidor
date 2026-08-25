// test/unicidade_do_portador.js — A AUTORIDADE ÚNICA DO SERVIDOR, POR CAPACIDADE.
//
// ===========================================================================
// POR QUE ESTA GUARDA FOI REESCRITA (OS 52-C2)
// ===========================================================================
//
// A versão da OS 52-C1 protegia por NOME, TRECHO CANÔNICO e EXTENSÃO:
//
//   * varria só a RAIZ com as assinaturas largas, porque no texto cru sete
//     arquivos de `test/` e um de `docs/` casavam com elas — todos legítimos,
//     todos citando o bundle dentro de string, regex ou comentário;
//   * no repositório inteiro procurava UMA linha, a do arranque do bundle;
//   * e proibia pacote compactado pela EXTENSÃO do arquivo.
//
// As três premissas eram frágeis pelo mesmo motivo: descreviam o servidor QUE
// EXISTE, não a capacidade de ser um servidor. Um segundo servidor escrito do
// zero, com outros nomes, em `net.createServer`, guardado dois níveis abaixo,
// não parecia com nada daquilo. Um ZIP renomeado para `entrega` não tinha
// extensão a proibir.
//
// ===========================================================================
// O QUE MUDOU, E O QUE TORNOU A MUDANÇA POSSÍVEL
// ===========================================================================
//
// A varredura passou a ser RECURSIVA sobre a árvore inteira, e a detecção
// passou a ser por CAPACIDADE EXECUTÁVEL: combinações que só um servidor forma.
//
// O que destravou isso foi trocar o recorte de comentários por um SCANNER
// LÉXICO de verdade. A OS 52-C1 pagou caro para descobrir que
// `/\/\*[\s\S]*?\*\//g` não sabe o que é string — ele casou com a abertura de
// comentário dentro do literal `"test/*.test.js"` e engoliu meio arquivo. Um
// scanner que percorre o texto caractere a caractere, sabendo quando está numa
// string, num template, num literal de expressão regular ou num comentário,
// resolve o problema de raiz: o conteúdo de string vira `""`, comentário vira
// espaço, e o que sobra é PROGRAMA.
//
// Com isso os oito falsos positivos que prendiam a guarda antiga à raiz
// simplesmente desaparecem — eles eram todos texto dentro de literal. É por
// isso que a varredura pôde ficar recursiva sem ganhar exceção nenhuma.
//
// ===========================================================================
// ISENÇÃO É RESULTADO DE ANÁLISE, NUNCA CAMINHO NUMA LISTA
// ===========================================================================
//
// Não existe lista de isentos. `app.html` fica porque a análise não encontra
// nele criação de servidor, escuta, handshake, despachante nem concessão de
// assento — ele fala `entrarMesa` como STRING, que é o que um cliente faz.
// `server.js` é o portador declarado, e mesmo ele é conferido: se um dia
// PARAR de exibir as capacidades, a guarda reprova, porque análise que não
// reconhece o próprio servidor não está protegendo coisa nenhuma.
//
// Menção não é capacidade. Um documento que explica o handshake, um teste que
// simula transporte sem abrir porta e um comentário que cita `entrarMesa` não
// formam servidor — e a guarda não pode reprová-los, sob pena de virar
// incômodo e ser removida.
// ===========================================================================

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

/** O único arquivo autorizado a portar o servidor. */
const PORTADOR_UNICO = "server.js";

/** Diretórios técnicos, com justificativa individual — não um curinga.
 *
 *  `.git` é o banco de objetos do próprio versionamento: ele guarda CÓPIAS
 *  comprimidas de tudo o que já existiu, inclusive das quatro duplicatas que a
 *  OS 52-C1 removeu. Varrê-lo faria a guarda reprovar por causa do histórico,
 *  que é exatamente o que não se quer apagar.
 *
 *  `node_modules` é dependência de terceiro, não conteúdo deste repositório —
 *  e aqui ele nem existe, porque o servidor não tem dependências. Está listado
 *  para a guarda não virar lenta e frágil se um dia existir.
 *
 *  NÃO SÃO IGNORADOS, e a lista curta é o ponto: `docs/`, `ci/`, `test/`,
 *  `contrato/`, subdiretório desconhecido, arquivo sem extensão, HTML, TXT,
 *  compactado e nome inédito entram TODOS na varredura. */
const DIRETORIOS_TECNICOS = Object.freeze([".git", "node_modules"]);

// ---------------------------------------------------------------------------
// 1. O SCANNER LÉXICO
// ---------------------------------------------------------------------------

/** Devolve o PROGRAMA: sem comentários e com o conteúdo dos literais vazio.
 *
 *  Percorre caractere a caractere porque é a única forma de saber em que
 *  estado se está. Aspas simples, duplas e template (com interpolação, que É
 *  código e por isso é analisada), literais de expressão regular e as duas
 *  formas de comentário. Escapes respeitados em todos.
 *
 *  A ambiguidade clássica de `/` — divisão ou início de regex — é resolvida
 *  pelo último caractere significativo. Errar para o lado de "é regex" só
 *  apagaria mais texto; e como a detecção exige COMBINAÇÃO de capacidades,
 *  texto apagado a mais nunca inventa um servidor que não existe. */
function programaDe(fonte) {
  let saida = "";
  let i = 0;
  const n = fonte.length;
  let anterior = "";

  while (i < n) {
    const c = fonte[i];
    const d = fonte[i + 1];

    if (c === "/" && d === "/") {
      while (i < n && fonte[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(fonte[i] === "*" && fonte[i + 1] === "/")) i++;
      i += 2;
      saida += " ";
      continue;
    }
    if (c === '"' || c === "'") {
      const aspa = c;
      i++;
      while (i < n && fonte[i] !== aspa) {
        if (fonte[i] === "\\") i++;
        i++;
      }
      i++;
      saida += aspa + aspa;
      anterior = aspa;
      continue;
    }
    if (c === "`") {
      i++;
      while (i < n && fonte[i] !== "`") {
        if (fonte[i] === "\\") { i += 2; continue; }
        if (fonte[i] === "$" && fonte[i + 1] === "{") {
          let profundidade = 1;
          i += 2;
          const inicio = i;
          while (i < n && profundidade > 0) {
            if (fonte[i] === "{") profundidade++;
            else if (fonte[i] === "}") profundidade--;
            i++;
          }
          saida += "``" + programaDe(fonte.slice(inicio, i - 1)) + "``";
          continue;
        }
        i++;
      }
      i++;
      saida += "``";
      anterior = "`";
      continue;
    }
    if (c === "/" && podeIniciarRegex(anterior)) {
      let j = i + 1;
      let dentroDeClasse = false;
      while (j < n) {
        const e = fonte[j];
        if (e === "\\") { j += 2; continue; }
        if (e === "[") dentroDeClasse = true;
        else if (e === "]") dentroDeClasse = false;
        else if (e === "/" && !dentroDeClasse) break;
        else if (e === "\n") { j = -1; break; }
        j++;
      }
      if (j > 0 && j < n) {
        i = j + 1;
        while (i < n && /[a-z]/.test(fonte[i])) i++;
        saida += "//";
        anterior = "/";
        continue;
      }
    }

    saida += c;
    if (!/\s/.test(c)) anterior = c;
    i++;
  }
  return saida;
}

function podeIniciarRegex(anterior) {
  if (anterior === "") return true;
  return !/[A-Za-z0-9_$)\]]/.test(anterior);
}

/** Num HTML, só o que está dentro de `<script>` é programa. O resto é marcação:
 *  atributo, texto e comentário de HTML não executam nada. */
function programaDeHtml(fonte) {
  let saida = "";
  const re = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(fonte))) saida += programaDe(m[1]) + "\n";
  return saida;
}

// ---------------------------------------------------------------------------
// 2. AS CAPACIDADES
// ---------------------------------------------------------------------------

/** O GUID do RFC 6455. Aparece em QUALQUER implementação de handshake
 *  WebSocket, porque é a constante que entra no digest do `Sec-WebSocket-Accept`
 *  — e é procurado no texto BRUTO de propósito: num servidor ele vive dentro de
 *  uma string, e o scanner esvazia strings. Sozinho ele não reprova nada (uma
 *  documentação pode citá-lo); ele só conta quando acompanhado de capacidade. */
const GUID_DO_HANDSHAKE =
  ["258EAFA5", "E914", "47DA", "95CA", "C5AB0DC85B11"].join("-");

/** Mede os SINAIS de um arquivo. Sinal não é veredito — ver `capacidadesDe`. */
function sinaisDe(programa, bruto) {
  return {
    // criação de servidor de rede, em qualquer das pilhas do Node
    criaServidor:
      /\bcreate(Secure)?Server\s*\(/.test(programa) ||
      /\bnew\s+(?:[A-Za-z_$][\w$]*\s*\.\s*)*(?:WebSocket)?Server\s*\(/.test(programa),
    // e a escuta, que é o que transforma um objeto em porta aberta
    escuta: /\.\s*listen\s*\(/.test(programa),
    portaDeAmbiente: /\bprocess\s*\.\s*env\s*\.\s*PORT\b/.test(programa),
    portaFixa: /\.\s*listen\s*\(\s*\d{2,5}\b/.test(programa),
    // handshake WebSocket
    guid: bruto.includes(GUID_DO_HANDSHAKE),
    cabecalhoDeHandshake: /Sec-WebSocket-(?:Accept|Key|Version)/i.test(bruto),
    pedeUpgrade: /\bupgrade\b/i.test(programa),
    // o contrato de ingresso
    declaraIngresso: /\bfunction\s+entrarMesa\s*\(/.test(programa),
    despachaIngresso:
      /\bcase\s*["'`]{2}\s*:/.test(programa) && /entrarMesa/.test(bruto),
    concedeAssento:
      /\bassentos\s*\[[^\]]*\]\s*=/.test(programa) ||
      /\bassento\s*:\s*\w+\s*,\s*codigo\b/.test(programa),
    // o arranque do transporte deste bundle
    arranqueDoTransporte:
      /\brequire\s*\(\s*["'`]{2}\s*\)\s*\.\s*iniciar\s*\(/.test(programa) &&
      /ws_server/.test(bruto),
  };
}

/** As CAPACIDADES: combinações que só um servidor autônomo forma.
 *
 *  Cada uma exige mais de um sinal, e é isso que separa capacidade de menção.
 *  Um documento com `Sec-WebSocket-Accept` na prosa tem sinal e não tem
 *  capacidade; um teste que simula transporte sem abrir porta idem. */
function capacidadesDe(s) {
  const achadas = [];
  if (s.criaServidor && s.escuta) {
    achadas.push("cria um servidor de rede e escuta numa porta");
  }
  if (s.guid && (s.criaServidor || s.escuta || s.pedeUpgrade)) {
    achadas.push("implementa o handshake WebSocket (GUID do RFC 6455)");
  }
  if (s.cabecalhoDeHandshake && s.pedeUpgrade && (s.escuta || s.criaServidor)) {
    achadas.push("responde ao upgrade de conexão com cabeçalho de handshake");
  }
  if (s.declaraIngresso && s.concedeAssento) {
    achadas.push("implementa o ingresso e concede assento");
  }
  if (s.despachaIngresso && s.concedeAssento) {
    achadas.push("despacha `entrarMesa` e concede assento");
  }
  if (s.arranqueDoTransporte) {
    achadas.push("inicia o transporte deste bundle");
  }
  return achadas;
}

// ---------------------------------------------------------------------------
// 3. COMPACTADOS, POR CONTEÚDO
// ---------------------------------------------------------------------------

/** Limites explícitos. Existem para que a inspeção nunca vire vetor de
 *  expansão abusiva: nada é DESCOMPRIMIDO — o inventário do ZIP e do TAR é
 *  lido dos cabeçalhos —, e ainda assim há teto de bytes e de entradas. */
const LIMITES = Object.freeze({
  bytesLidosDoArquivo: 32 * 1024 * 1024,
  entradasDeInventario: 2000,
  profundidadeDeInventario: 1,
});

/** Assinaturas de formato, por MAGIC BYTES. Nome e extensão são irrelevantes:
 *  um ZIP chamado `entrega`, `.bin` ou coisa nenhuma é um ZIP. */
const FORMATOS_COMPACTADOS = Object.freeze([
  ["ZIP", (b) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b &&
    ((b[2] === 0x03 && b[3] === 0x04) || (b[2] === 0x05 && b[3] === 0x06) || (b[2] === 0x07 && b[3] === 0x08))],
  ["GZIP", (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b],
  ["XZ", (b) => b.length > 5 && b[0] === 0xfd && b[1] === 0x37 && b[2] === 0x7a && b[3] === 0x58 && b[4] === 0x5a && b[5] === 0x00],
  ["BZIP2", (b) => b.length > 2 && b[0] === 0x42 && b[1] === 0x5a && b[2] === 0x68],
  ["7Z", (b) => b.length > 5 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c],
  ["RAR", (b) => b.length > 6 && b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21 && b[4] === 0x1a && b[5] === 0x07],
  ["ZSTD", (b) => b.length > 3 && b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd],
  // TAR não tem magic no começo: a marca `ustar` mora no byte 257 do primeiro
  // cabeçalho de 512. É por isso que TAR passa despercebido por qualquer
  // verificação que só olhe os primeiros bytes.
  ["TAR", (b) => b.length >= 265 && b.slice(257, 262).toString("latin1") === "ustar"],
]);

function formatoCompactadoDe(buf) {
  for (const [nome, casa] of FORMATOS_COMPACTADOS) if (casa(buf)) return nome;
  return null;
}

/** Nomes de arquivo dentro de um ZIP, lidos do DIRETÓRIO CENTRAL.
 *
 *  Sem descomprimir nada: o diretório central guarda os nomes em claro. Devolve
 *  `null` quando a estrutura não é legível, e nesse caso o chamador reprova do
 *  mesmo jeito — um pacote ilegível é ainda menos auditável que um legível. */
function inventarioDeZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fim < 0 || fim + 22 > buf.length) return null;
  const total = buf.readUInt16LE(fim + 10);
  let deslocamento = buf.readUInt32LE(fim + 16);
  const nomes = [];
  for (let k = 0; k < Math.min(total, LIMITES.entradasDeInventario); k++) {
    if (deslocamento + 46 > buf.length) break;
    if (buf.readUInt32LE(deslocamento) !== 0x02014b50) break;
    const tamanhoNome = buf.readUInt16LE(deslocamento + 28);
    const extra = buf.readUInt16LE(deslocamento + 30);
    const comentario = buf.readUInt16LE(deslocamento + 32);
    nomes.push(buf.slice(deslocamento + 46, deslocamento + 46 + tamanhoNome).toString("latin1"));
    deslocamento += 46 + tamanhoNome + extra + comentario;
  }
  return nomes;
}

/** Nomes dentro de um TAR, lidos dos cabeçalhos de 512 bytes. */
function inventarioDeTar(buf) {
  const nomes = [];
  for (let p = 0; p + 512 <= buf.length && nomes.length < LIMITES.entradasDeInventario; p += 512) {
    const cabecalho = buf.slice(p, p + 512);
    if (cabecalho.slice(257, 262).toString("latin1") !== "ustar") break;
    const nome = cabecalho.slice(0, 100).toString("latin1").replace(/\0.*$/, "");
    if (nome) nomes.push(nome);
    const tamanho = parseInt(cabecalho.slice(124, 136).toString("latin1").replace(/\0.*$/, "").trim(), 8) || 0;
    p += Math.ceil(tamanho / 512) * 512;
  }
  return nomes;
}

/** O que num inventário caracteriza pacote IMPLANTÁVEL. */
const NOMES_IMPLANTAVEIS = /(^|\/)(server\.js|package\.json|index\.js|app\.js|Procfile|Dockerfile)$/i;

function portadoresNoInventario(nomes) {
  if (!nomes) return [];
  return nomes.filter((n) => NOMES_IMPLANTAVEIS.test(n)).slice(0, 20);
}

// ---------------------------------------------------------------------------
// 4. MANIFESTOS
// ---------------------------------------------------------------------------

/** Um `package.json` fora da raiz é um segundo projeto instalável, e um
 *  `start` que aponte para outro arquivo é um segundo alvo de deploy. */
function conferirManifesto(relativo, bruto, reprovar) {
  let json;
  try { json = JSON.parse(bruto); } catch (_) { return; }
  const scripts = (json && json.scripts) || {};

  if (relativo !== "package.json") {
    reprovar(relativo, "segundo `package.json`, fora da raiz — é um projeto " +
      "instalável próprio, com o próprio alvo de arranque");
    return;
  }
  for (const [nome, comando] of Object.entries(scripts)) {
    if (typeof comando !== "string") continue;
    const alvo = comando.match(/\bnode\s+(?:--[\w-]+(?:=\S+)?\s+)*([^\s"']+\.js)/);
    if (!alvo) continue;
    const arquivo = alvo[1].replace(/^\.\//, "");
    // `ci/portao_do_ci.js` é o VEREDITO do CI, não um servidor: ele lê dois
    // arquivos e sai com código. Quem decide não é o nome — é a análise de
    // capacidade, que roda sobre ele como sobre qualquer outro arquivo.
    if (arquivo === PORTADOR_UNICO) continue;
    if (nome === "start") {
      reprovar("package.json", "o script `start` aponta para `" + arquivo +
        "`, e não para `" + PORTADOR_UNICO + "` — o alvo de arranque é o " +
        "portador, e não pode ser desviado");
    }
  }
}

// ---------------------------------------------------------------------------
// 5. A GUARDA
// ---------------------------------------------------------------------------

function listarArquivos(dir, rel, saida) {
  for (const nome of fs.readdirSync(dir)) {
    if (DIRETORIOS_TECNICOS.includes(nome)) continue;
    const caminho = path.join(dir, nome);
    const relativo = rel ? rel + "/" + nome : nome;
    let st;
    try { st = fs.lstatSync(caminho); } catch (_) { continue; }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) listarArquivos(caminho, relativo, saida);
    else saida.push({ caminho, relativo, nome });
  }
  return saida;
}

/** Analisa UM arquivo e devolve as acusações contra ele. Exportada para que a
 *  prova externa possa exercitar a análise arquivo a arquivo, sem montar
 *  árvore — e para que a isenção de `app.html` seja uma AFIRMAÇÃO sobre o
 *  resultado da análise, nunca uma entrada numa lista de caminhos. */
function analisar(relativo, buf) {
  const acusacoes = [];
  const formato = formatoCompactadoDe(buf);
  if (formato) {
    const nomes = formato === "ZIP" ? inventarioDeZip(buf)
      : formato === "TAR" ? inventarioDeTar(buf) : null;
    const portadores = portadoresNoInventario(nomes);
    acusacoes.push(
      "é um pacote " + formato + " (reconhecido pelos bytes, não pelo nome)" +
      (portadores.length
        ? " e carrega dentro: " + portadores.join(", ")
        : " — conteúdo empacotado não é auditável por leitura")
    );
    return { compactado: formato, sinais: null, acusacoes };
  }

  const bruto = buf.toString("latin1");
  const ehHtml = /\.html?$/i.test(relativo) || /^\s*<(?:!doctype|html)\b/i.test(bruto);
  const programa = ehHtml ? programaDeHtml(bruto) : programaDe(bruto);
  const sinais = sinaisDe(programa, bruto);
  for (const capacidade of capacidadesDe(sinais)) acusacoes.push(capacidade);
  return { compactado: null, sinais, acusacoes };
}

/** Reprova se a árvore carregar qualquer servidor além do portador.
 *
 *  `raizDoRepo` existe para que a prova externa exercite a guarda contra
 *  árvores forjadas. Devolve estatística da varredura — quantos arquivos
 *  foram lidos e quantas asserções foram feitas —, porque uma implementação
 *  oca também "passa" em silêncio, e quem a chama precisa poder exigir que ela
 *  tenha de fato trabalhado. */
function conferirUnicidadeDoPortador(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");
  const estatistica = { arquivos: 0, asseveracoes: 0, portadorConferido: false };

  const problemas = [];
  const reprovar = (onde, oQue) => problemas.push("`" + onde + "` " + oQue);

  for (const alvo of listarArquivos(raiz, "", [])) {
    estatistica.arquivos++;
    let buf;
    try {
      buf = fs.readFileSync(alvo.caminho);
    } catch (_) { continue; }
    if (buf.length > LIMITES.bytesLidosDoArquivo) buf = buf.slice(0, LIMITES.bytesLidosDoArquivo);

    const laudo = analisar(alvo.relativo, buf);
    estatistica.asseveracoes++;

    if (alvo.relativo === PORTADOR_UNICO) {
      // O PORTADOR TAMBÉM É CONFERIDO, e por dentro: análise que deixasse de
      // reconhecer o próprio servidor estaria cega, e passaria tudo.
      estatistica.portadorConferido = true;
      assert.ok(
        laudo.acusacoes.length >= 3,
        "a análise deixou de reconhecer capacidade de servidor em `" +
          PORTADOR_UNICO + "` — cega assim ela aprovaria qualquer duplicata " +
          "(reconheceu: " + (laudo.acusacoes.join("; ") || "nada") + ")"
      );
      continue;
    }

    if (/(^|\/)package\.json$/.test(alvo.relativo)) {
      conferirManifesto(alvo.relativo, buf.toString("utf8"), reprovar);
      estatistica.asseveracoes++;
    }

    for (const acusacao of laudo.acusacoes) reprovar(alvo.relativo, acusacao);
  }

  assert.ok(
    estatistica.portadorConferido,
    "`" + PORTADOR_UNICO + "` não foi encontrado na árvore — sem portador não " +
      "há o que guardar, e uma varredura que não o alcança não alcança nada"
  );
  assert.equal(
    problemas.length, 0,
    "SEGUNDO SERVIDOR NA ÁRVORE — só `" + PORTADOR_UNICO + "` pode sê-lo:\n  " +
      problemas.join("\n  ")
  );
  return estatistica;
}

module.exports = {
  PORTADOR_UNICO, DIRETORIOS_TECNICOS, LIMITES, GUID_DO_HANDSHAKE,
  programaDe, programaDeHtml, sinaisDe, capacidadesDe,
  formatoCompactadoDe, inventarioDeZip, inventarioDeTar, portadoresNoInventario,
  listarArquivos, analisar, conferirUnicidadeDoPortador,
};
