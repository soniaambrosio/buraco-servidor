// test/unicidade_do_portador.js — A AUTORIDADE ÚNICA DO SERVIDOR, POR CAPACIDADE
// COMPOSTA DA ÁRVORE (OS 52-C3).
//
// ===========================================================================
// O QUE A OS 52-R2 DERRUBOU, E POR QUÊ
// ===========================================================================
//
// A OS 52-C2 trocou a detecção por NOME e EXTENSÃO por detecção por CAPACIDADE
// EXECUTÁVEL, e isso resolveu o servidor escrito do zero — desde que ele
// coubesse num arquivo. A R2 mostrou o preço da premissa escondida: a decisão
// era tomada ARQUIVO A ARQUIVO, e capacidade não é propriedade de arquivo.
//
// Uma duplicata implantável partida em dois arquivos — um cria o servidor, o
// outro chama `.listen()` — subiu de verdade, respondeu HTTP 200 numa porta
// isolada, e atravessou `npm test`, o juiz e o pipeline inteiros. Nenhum dos
// dois arquivos, sozinho, formava capacidade; juntos, formavam um servidor.
//
// ===========================================================================
// O DESENHO: RESUMO POR ARQUIVO, DECISÃO SOBRE O CONJUNTO
// ===========================================================================
//
// A análise tem duas camadas, e a segunda é a que faltava.
//
//   1. RESUMO POR ARQUIVO. Cada arquivo produz um resumo com dois tipos de
//      sinal, e a distinção é a espinha do desenho:
//
//        * SINAIS DE PROGRAMA — medidos no texto depois do scanner léxico, ou
//          seja, sobre o que EXECUTA. São eles que COMPÕEM entre arquivos:
//          criar, escutar, vincular porta, declarar ingresso, despachar caso,
//          conceder assento. Programa em A e programa em B formam um programa
//          só quando A e B se ligam.
//
//        * SINAIS BRUTOS — medidos no texto cru, porque vivem dentro de
//          literais que o scanner esvazia (o GUID do RFC 6455, o cabeçalho do
//          handshake, a palavra `entrarMesa`, o nome do módulo do bundle).
//          Esses NÃO compõem entre arquivos, e a razão é simples: texto no
//          arquivo A não vira código no arquivo B. Um sinal bruto só conta
//          para o arquivo que o carrega — é isso que impede prosa de virar
//          capacidade quando existe um servidor em outro canto da árvore.
//
//   2. DECISÃO SOBRE O CONJUNTO. Os sinais de programa são unidos em três
//      escopos, e cada ramo declara até onde vale:
//
//        * ARQUIVO   — o arquivo sozinho;
//        * CONJUNTO  — a componente conexa do grafo de ligação (`require`,
//                      `__require`, `import`, `from`, com o especificador
//                      relativo resolvido para um arquivo que EXISTE na
//                      árvore);
//        * ÁRVORE    — a união de todos os arquivos, menos o portador. É o
//                      escopo residual: pega a fragmentação que não declara
//                      ligação nenhuma, e é justamente onde a R2 mostrou que
//                      "não há ligação declarada" não quer dizer "não há
//                      servidor".
//
//      Em qualquer escopo, o veredito de um arquivo F é calculado sobre
//      `sinais BRUTOS de F` + `sinais de PROGRAMA do escopo`.
//
// A ACUSAÇÃO TEM ENDEREÇO. Num escopo composto, só é acusado o arquivo que
// CONTRIBUI com pelo menos um dos sinais que o ramo usa, e a mensagem nomeia
// os outros contribuintes. Sem essa regra, um servidor fragmentado deixaria a
// árvore inteira vermelha com sessenta acusações idênticas, e o laudo apontaria
// para todo lado menos para os dois arquivos culpados — vermelho ilegível é
// quase tão ruim quanto verde indevido.
//
// O PORTADOR NÃO CONDUZ E NÃO CONTRIBUI. `server.js` é a autoridade autorizada:
// os sinais de programa dele não entram em união nenhuma, e as ligações que
// passam por ele não juntam componentes. Sem isso, toda suíte que exercita o
// bundle herdaria a capacidade dele e a guarda reprovaria a árvore íntegra —
// que é como uma guarda nova morre, removida por incômodo.
//
// ===========================================================================
// ISENÇÃO É RESULTADO DE ANÁLISE, NUNCA CAMINHO NUMA LISTA
// ===========================================================================
//
// Continua não existindo lista de isentos. `app.html` fica porque a análise
// não encontra nele criação, escuta, despacho nem concessão de assento — ele
// fala `entrarMesa` como STRING, que é o que um cliente faz. `server.js` é o
// portador declarado, e mesmo ele é conferido: se um dia PARAR de exibir as
// capacidades, a guarda reprova, porque análise que não reconhece o próprio
// servidor não está protegendo coisa nenhuma.
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
// 2. OS SINAIS
// ---------------------------------------------------------------------------

/** O GUID do RFC 6455. Aparece em QUALQUER implementação de handshake
 *  WebSocket, porque é a constante que entra no digest do `Sec-WebSocket-Accept`
 *  — e é procurado no texto BRUTO de propósito: num servidor ele vive dentro de
 *  uma string, e o scanner esvazia strings. Sozinho ele não reprova nada (uma
 *  documentação pode citá-lo); ele só conta quando acompanhado de capacidade. */
const GUID_DO_HANDSHAKE =
  ["258EAFA5", "E914", "47DA", "95CA", "C5AB0DC85B11"].join("-");

/** Os ARGUMENTOS de cada chamada que casa com `abertura` (uma expressão
 *  regular, em texto, terminando no parêntese de abertura). Percorre contando
 *  parênteses, que é a única forma de não parar no meio de
 *  `bind(Number(x) || 41234)` — foi exatamente aí que a leitura por expressão
 *  regular chapada deixou o servidor UDP passar. */
function argumentosDaChamada(programa, abertura) {
  const achados = [];
  const re = new RegExp(abertura, "g");
  let m;
  while ((m = re.exec(programa))) {
    let i = m.index + m[0].length;
    const inicio = i;
    let profundidade = 1;
    while (i < programa.length && profundidade > 0) {
      if (programa[i] === "(") profundidade++;
      else if (programa[i] === ")") profundidade--;
      i++;
    }
    achados.push(programa.slice(inicio, Math.max(inicio, i - 1)));
    re.lastIndex = Math.max(re.lastIndex, inicio);
  }
  return achados;
}

/** OS SINAIS DE PROGRAMA — medidos sobre o que executa, e por isso COMPÕEM
 *  entre arquivos ligados. Cada entrada diz o que procura e por quê. */
const SINAIS_DE_PROGRAMA = Object.freeze({
  /** Criação de servidor de rede, em qualquer das pilhas do Node: as fábricas
   *  `createServer`/`createSecureServer` e qualquer construtor cujo nome termine
   *  em `Server` (`new WebSocketServer`, `new WebSocket.Server`, `new Server`). */
  criaServidor: (p) =>
    /\bcreate(?:Secure)?Server\s*\(/.test(p) ||
    /\bnew\s+(?:[A-Za-z_$][\w$]*\s*\.\s*)*[A-Za-z_$][\w$]*Server\s*\(/.test(p),

  /** Soquete de datagrama: `dgram.createSocket(...)`. Não é `createServer`, e
   *  foi exatamente por isso que um servidor UDP atravessou a C2. */
  criaSoquete: (p) => /\bcreateSocket\s*\(/.test(p),

  /** A escuta. `\.listen\b` sem exigir o parêntese de propósito: o alias
   *  (`const abrir = srv.listen`) e a chamada auxiliar (`srv.listen.call(...)`)
   *  são a mesma capacidade escrita de outro jeito. */
  escuta: (p) => /\.\s*listen\b/.test(p),

  /** A escuta COM PORTA CONCRETA. `app.listen(3000)` não cria servidor nenhum
   *  pela letra do sinal anterior — quem cria é o framework —, e mesmo assim é
   *  o ato de abrir a porta. Aqui o argumento é lido com parênteses
   *  balanceados, e só conta se trouxer um número de porta ou um nome de porta. */
  escutaPorta: (p) =>
    argumentosDaChamada(p, "\\.\\s*listen\\s*\\(")
      .some((a) => /\b\d{2,5}\b/.test(a) || /port/i.test(a)),

  /** O vínculo de porta do UDP. `\.bind(` exigindo porta no argumento — sem
   *  isso, todo `fn.bind(this)` do JavaScript viraria abertura de porta, e uma
   *  guarda que grita em `bind(this)` é removida na semana seguinte. */
  vinculaPorta: (p) =>
    argumentosDaChamada(p, "\\.\\s*bind\\s*\\(")
      .some((a) => /\b\d{2,5}\b/.test(a) || /port/i.test(a)) ||
    /\.\s*bind\b\s*(?![\s(])/.test(p),

  /** Porta declarada no CONSTRUTOR, que é como se abre uma porta sem `.listen`:
   *  `new WebSocketServer({ port })`, `WebSocketServer({ port })`. O nome tem
   *  de terminar em `Server` ou `Socket`: sem isso, qualquer chamada que receba
   *  um objeto com `port:` viraria criação de servidor, e lixo binário lido
   *  como texto começa a formar capacidade por acaso. */
  portaNoConstrutor: (p) =>
    /\b(?:new\s+)?(?:[A-Za-z_$][\w$]*\s*\.\s*)*[A-Za-z_$][\w$]*(?:Server|Socket)\s*\(\s*\{[^{}]{0,200}\bport\s*:/.test(p),

  portaDeAmbiente: (p) => /\bprocess\s*\.\s*env\s*\.\s*PORT\b/.test(p),

  /** O REGISTRO DO OUVINTE DE UPGRADE.
   *
   *  A C2 procurava a palavra `upgrade` no programa, e isso tinha os dois
   *  defeitos ao mesmo tempo: não achava o caso real, porque
   *  `on("upgrade", ...)` vira `on("", ...)` depois do scanner e a palavra
   *  desaparece; e achava demais, porque num `.md` a prosa É o programa e
   *  qualquer parágrafo que explicasse o handshake virava sinal.
   *
   *  Aqui o sinal exige a FORMA EXECUTÁVEL — um registro de ouvinte com
   *  literal — casada com o literal `upgrade` no texto bruto. Prosa não tem
   *  `.on("", ` nenhum; o servidor tem. */
  ouveUpgrade: (p, b) =>
    /\.\s*(?:on|once|addListener|prependListener)\s*\(\s*(?:""|''|``)\s*,/.test(p) &&
    /(["'`])upgrade\1/i.test(b),

  /** A declaração do ingresso, em qualquer das formas de declarar função. */
  declaraIngresso: (p) =>
    /\b(?:async\s+)?function\s*\*?\s*entrarMesa\s*\(/.test(p) ||
    /\bentrarMesa\s*[:=]\s*(?:async\s*)?(?:function\b|\()/.test(p),

  /** O braço de despacho. `case "":` é o que sobra de `case "entrarMesa":`
   *  depois do scanner; o nome vem do sinal bruto, no mesmo arquivo. */
  despachaCaso: (p) => /\bcase\s*(?:""|''|``)\s*:/.test(p),

  /** A CONCESSÃO DE ASSENTO, por semântica e não por uma única escrita.
   *  A C2 cobrava `assentos[i] =`, e trocar o vetor por um `Map` bastava para
   *  sumir. Aqui entram: índice, par assento/código, `Map.set` numa coleção de
   *  assentos, `set` de coleção com outro nome carregando assento na chave ou
   *  no valor, função auxiliar que senta alguém, objeto devolvido com o
   *  assento confirmado, e atribuição indireta de um jogador a um lugar. */
  concedeAssento: (p) =>
    /\bassentos?\s*\[[^\]]*\]\s*=[^=]/.test(p) ||
    /\bassento\s*:\s*\w+\s*,\s*codigo\b/.test(p) ||
    /\b[\w$]*[Aa]ssentos?[\w$]*\s*\.\s*set\s*\(/.test(p) ||
    /\.\s*set\s*\(\s*[^;]{0,60}?\b(?:assento|lugar|cadeira|seat)\b/i.test(p) ||
    /\b(?:sentar|assentar|ocupar|vincularAssento|darAssento|atribuirAssento|alocarAssento)[\w$]*\s*\(/i.test(p) ||
    /\breturn\s*\{[^{}]{0,160}\b(?:assento|lugar)\s*:/.test(p) ||
    /\b[\w$]+\s*\[\s*[\w$]+\s*\]\s*=\s*\{[^{}]{0,120}\b(?:apelido|jogador|jogadorId)\b/.test(p),

  /** O ARRANQUE DO TRANSPORTE DESTE BUNDLE. A C2 exigia `\brequire`, e o
   *  bundle real chama `__require("ws_server").iniciar()` — o `\b` não casa
   *  depois de `_`, e o segundo arranque que a C1 pegava passou a atravessar.
   *  Aqui o prefixo de identificador é aceito. */
  arranqueChamado: (p) =>
    /[\w$]*require\s*\(\s*(?:""|''|``)\s*\)\s*\.\s*iniciar\s*\(/.test(p),
});

/** OS SINAIS BRUTOS — medidos no texto cru porque vivem dentro de literais.
 *  NÃO compõem entre arquivos: texto em A não vira código em B. */
const SINAIS_BRUTOS = Object.freeze({
  guid: (b) => b.includes(GUID_DO_HANDSHAKE),
  cabecalhoDeHandshake: (b) => /Sec-WebSocket-(?:Accept|Key|Version)/i.test(b),
  mencionaEntrarMesa: (b) => /entrarMesa/.test(b),
  mencionaModuloDoBundle: (b) => /ws_server/.test(b),
});

const NOMES_DE_PROGRAMA = Object.freeze(Object.keys(SINAIS_DE_PROGRAMA));
const NOMES_BRUTOS = Object.freeze(Object.keys(SINAIS_BRUTOS));

/** Mede os SINAIS de um arquivo. Sinal não é veredito — ver `capacidadesDe`. */
function sinaisDe(programa, bruto) {
  const s = {};
  for (const nome of NOMES_DE_PROGRAMA) s[nome] = !!SINAIS_DE_PROGRAMA[nome](programa, bruto);
  for (const nome of NOMES_BRUTOS) s[nome] = !!SINAIS_BRUTOS[nome](bruto);
  return s;
}

/** Só os sinais que ficam presos ao arquivo que os carrega. */
function sinaisBrutos(s) {
  const r = {};
  for (const nome of NOMES_BRUTOS) r[nome] = !!(s && s[nome]);
  return r;
}

/** A união dos sinais que COMPÕEM. */
function unirPrograma(lista) {
  const r = {};
  for (const nome of NOMES_DE_PROGRAMA) r[nome] = false;
  for (const s of lista) for (const nome of NOMES_DE_PROGRAMA) if (s && s[nome]) r[nome] = true;
  return r;
}

// ---------------------------------------------------------------------------
// 3. OS RAMOS — as combinações que só um servidor forma
// ---------------------------------------------------------------------------

const TODOS_OS_ESCOPOS = Object.freeze(["arquivo", "conjunto", "arvore"]);
const SO_NO_ARQUIVO = Object.freeze(["arquivo"]);
const ESCOPOS = TODOS_OS_ESCOPOS;

/** A TABELA DE RAMOS. Cada ramo declara id, os sinais de que se alimenta, a
 *  condição, o texto da acusação e o escopo máximo em que vale.
 *
 *  `sinais` não é enfeite: é por ela que a acusação composta encontra os
 *  arquivos que CONTRIBUEM, em vez de acusar a árvore inteira.
 *
 *  POR QUE TRÊS RAMOS SÃO SÓ DE ARQUIVO. `HANDSHAKE-GUID`, `HANDSHAKE-UPGRADE`
 *  e `ARRANQUE` dependem de sinal BRUTO (o GUID, o cabeçalho, o nome do módulo
 *  do bundle) — e sinal bruto não atravessa arquivo. Compor esses ramos entre
 *  arquivos seria deixar a prosa de um documento emprestar handshake ao
 *  servidor de outro canto da árvore, que é falso positivo com nome bonito.
 *  A fragmentação de um servidor WebSocket continua pega: quem parte criação e
 *  escuta cai em `REDE`, que compõe. */
const RAMOS = Object.freeze([
  {
    id: "REDE",
    texto: "cria um servidor de rede e escuta numa porta",
    sinais: ["criaServidor", "escuta"],
    escopos: TODOS_OS_ESCOPOS,
    quando: (s) => s.criaServidor && s.escuta,
  },
  {
    id: "ESCUTA-DE-PORTA",
    texto: "escuta numa porta concreta",
    sinais: ["escutaPorta"],
    escopos: TODOS_OS_ESCOPOS,
    // UM SINAL SÓ, e é deliberado. `.listen(3000)` em posição EXECUTÁVEL não é
    // menção: é a chamada que abre a porta. O que separa isto de prosa é o
    // scanner léxico — dentro de string, de comentário ou de regex o texto some
    // antes de chegar aqui —, e é por isso que um único sinal basta neste caso
    // e não bastaria em nenhum dos que dependem de palavra solta.
    quando: (s) => s.escutaPorta,
  },
  {
    id: "PORTA-NO-CONSTRUTOR",
    texto: "cria um servidor já com a porta no construtor, sem `.listen()`",
    sinais: ["portaNoConstrutor"],
    escopos: TODOS_OS_ESCOPOS,
    // UM SINAL SÓ, e pelo mesmo motivo do ramo anterior: o sinal já É a
    // combinação. `X...Server({ port: ... })` traz o construtor, o objeto de
    // opções e a porta na mesma expressão executável. Exigir também
    // `criaServidor` foi o que deixou a FÁBRICA sem `new` passar — o `new` é
    // detalhe de escrita, não de capacidade.
    quando: (s) => s.portaNoConstrutor,
  },
  {
    id: "DATAGRAMA",
    texto: "abre um soquete de datagrama e o vincula a uma porta",
    sinais: ["criaSoquete", "vinculaPorta"],
    escopos: TODOS_OS_ESCOPOS,
    quando: (s) => s.criaSoquete && s.vinculaPorta,
  },
  {
    id: "HANDSHAKE-GUID",
    texto: "implementa o handshake WebSocket (GUID do RFC 6455)",
    sinais: ["guid", "criaServidor", "escuta", "ouveUpgrade"],
    escopos: SO_NO_ARQUIVO,
    quando: (s) => s.guid && (s.criaServidor || s.escuta || s.ouveUpgrade),
  },
  {
    id: "HANDSHAKE-UPGRADE",
    texto: "responde ao upgrade de conexão com cabeçalho de handshake",
    sinais: ["cabecalhoDeHandshake", "ouveUpgrade", "escuta", "criaServidor", "portaNoConstrutor"],
    escopos: SO_NO_ARQUIVO,
    quando: (s) =>
      s.cabecalhoDeHandshake && s.ouveUpgrade &&
      (s.escuta || s.criaServidor || s.portaNoConstrutor),
  },
  {
    id: "INGRESSO-DECLARADO",
    texto: "implementa o ingresso e concede assento",
    sinais: ["declaraIngresso", "concedeAssento"],
    escopos: TODOS_OS_ESCOPOS,
    quando: (s) => s.declaraIngresso && s.concedeAssento,
  },
  {
    id: "INGRESSO-DESPACHADO",
    texto: "despacha `entrarMesa` e concede assento",
    sinais: ["despachaCaso", "mencionaEntrarMesa", "concedeAssento"],
    escopos: TODOS_OS_ESCOPOS,
    quando: (s) => s.despachaCaso && s.mencionaEntrarMesa && s.concedeAssento,
  },
  {
    id: "ARRANQUE",
    texto: "inicia o transporte deste bundle",
    sinais: ["arranqueChamado", "mencionaModuloDoBundle"],
    escopos: SO_NO_ARQUIVO,
    quando: (s) => s.arranqueChamado && s.mencionaModuloDoBundle,
  },
]);

const RAMOS_POR_ID = Object.freeze(Object.fromEntries(RAMOS.map((r) => [r.id, r])));
const IDS_DOS_RAMOS = Object.freeze(RAMOS.map((r) => r.id));

/** As CAPACIDADES de um resumo de sinais, num dado escopo.
 *
 *  Devolve objetos `{ ramo, texto }` — e não frases soltas — porque a prova
 *  externa cobra COBERTURA DE RAMO: cada ramo precisa de um cenário negativo
 *  que o acione de verdade, e cobrar isso exige saber qual ramo disparou. */
function capacidadesDe(sinais, escopo) {
  const onde = escopo || "arquivo";
  const achadas = [];
  for (const ramo of RAMOS) {
    if (!ramo.escopos.includes(onde)) continue;
    if (ramo.quando(sinais)) achadas.push({ ramo: ramo.id, texto: ramo.texto });
  }
  return achadas;
}

// ---------------------------------------------------------------------------
// 4. AS LIGAÇÕES — o grafo que transforma arquivos num conjunto executável
// ---------------------------------------------------------------------------

/** Os especificadores RELATIVOS que um arquivo carrega.
 *
 *  Lidos no texto BRUTO de propósito: o scanner esvazia strings, e o nome do
 *  módulo mora numa string. `require`, `__require` e qualquer prefixo de
 *  identificador; `import ... from "..."`, `import("...")` e `export ... from`.
 *
 *  Só o que é RELATIVO e resolve para um arquivo que EXISTE na árvore vira
 *  aresta. Um documento que cita `require("./coisa")` sem que `coisa` exista
 *  não liga nada — e mesmo se ligasse, ligação a mais só JUNTA arquivos, nunca
 *  esconde capacidade. */
const RE_LIGACAO = Object.freeze([
  "[\\w$]*require\\s*\\(\\s*(['\"])([^'\"\\n]+)\\1\\s*\\)",
  "\\bfrom\\s*(['\"])([^'\"\\n]+)\\1",
  "\\bimport\\s*\\(\\s*(['\"])([^'\"\\n]+)\\1\\s*\\)",
]);

function especificadoresDe(bruto) {
  const achados = new Set();
  for (const fonte of RE_LIGACAO) {
    const re = new RegExp(fonte, "g");
    let m;
    while ((m = re.exec(bruto))) {
      const alvo = m[2];
      if (alvo.startsWith("./") || alvo.startsWith("../")) achados.add(alvo);
    }
  }
  return [...achados];
}

/** Resolve um especificador relativo contra o conjunto de caminhos existentes. */
function resolverEspecificador(relativoDoArquivo, especificador, existentes) {
  const base = path.posix.dirname(relativoDoArquivo.split("\\").join("/"));
  const bruto = path.posix.normalize(path.posix.join(base, especificador));
  const alvo = bruto.replace(/^\.\//, "");
  for (const tentativa of [alvo, alvo + ".js", alvo + ".json", alvo + "/index.js"]) {
    if (existentes.has(tentativa)) return tentativa;
  }
  return null;
}

/** Componentes conexas do grafo de ligação.
 *
 *  O PORTADOR NÃO CONDUZ: nenhuma aresta que o toque é criada. Sem isso, toda
 *  suíte que exercita o bundle cairia na mesma componente que ele — e a
 *  componente inteira herdaria a capacidade do servidor autorizado. */
function componentesDe(resumos) {
  const existentes = new Set(resumos.map((r) => r.relativo));
  const indice = new Map(resumos.map((r, i) => [r.relativo, i]));
  const pai = resumos.map((_, i) => i);
  const achar = (i) => (pai[i] === i ? i : (pai[i] = achar(pai[i])));
  const unir = (a, b) => { const x = achar(a), y = achar(b); if (x !== y) pai[x] = y; };

  for (const resumo of resumos) {
    if (resumo.relativo === PORTADOR_UNICO) continue;
    for (const especificador of resumo.especificadores || []) {
      const alvo = resolverEspecificador(resumo.relativo, especificador, existentes);
      if (!alvo || alvo === PORTADOR_UNICO) continue;
      unir(indice.get(resumo.relativo), indice.get(alvo));
    }
  }

  const grupos = new Map();
  for (const resumo of resumos) {
    const raiz = achar(indice.get(resumo.relativo));
    if (!grupos.has(raiz)) grupos.set(raiz, []);
    grupos.get(raiz).push(resumo.relativo);
  }
  const porArquivo = new Map();
  for (const membros of grupos.values()) {
    for (const membro of membros) porArquivo.set(membro, membros);
  }
  return porArquivo;
}

// ---------------------------------------------------------------------------
// 5. COMPACTADOS, POR CONTEÚDO
// ---------------------------------------------------------------------------

/** Limites explícitos. Existem para que a inspeção nunca vire vetor de
 *  expansão abusiva: nada é DESCOMPRIMIDO — o inventário do ZIP e do TAR é
 *  lido dos cabeçalhos —, e ainda assim há teto de bytes e de entradas.
 *
 *  [OS 52-C3] O teto de bytes deixou de ser SILENCIOSO. Na C2 um arquivo maior
 *  que o teto era truncado e analisado assim mesmo — um servidor depois do
 *  byte 32 Mi simplesmente não era lido, e "não li" saía como "não achei".
 *  Agora truncar é REPROVAR: conteúdo que a guarda não consegue ler inteiro
 *  não é auditável, e não auditável não passa.
 *
 *  A `profundidadeDeInventario` da C2 foi REMOVIDA em vez de mantida como
 *  enfeite: ela era declarada e nunca aplicada. Não faz falta — um compactado
 *  é reprovado por ser compactado, qualquer que seja o aninhamento dentro
 *  dele, e o inventário serve só para nomear o que ele carrega. */
const LIMITES = Object.freeze({
  bytesLidosDoArquivo: 32 * 1024 * 1024,
  entradasDeInventario: 2000,
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
// 6. MANIFESTOS
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
// 7. A VARREDURA
// ---------------------------------------------------------------------------

/** Lista a árvore inteira.
 *
 *  [OS 52-C3] ELO SIMBÓLICO NÃO É MAIS IGNORADO EM SILÊNCIO. A C2 pulava
 *  symlink sem dizer por quê; um elo é um caminho para conteúdo que mora FORA
 *  do que está versionado, e ler o alvo seria auditar coisa que o repositório
 *  não carrega. O elo entra na lista MARCADO, e a guarda o reprova com nome
 *  próprio — que é o oposto de deixá-lo passar calado. */
function listarArquivos(dir, rel, saida) {
  for (const nome of fs.readdirSync(dir)) {
    if (DIRETORIOS_TECNICOS.includes(nome)) continue;
    const caminho = path.join(dir, nome);
    const relativo = rel ? rel + "/" + nome : nome;
    let st;
    try { st = fs.lstatSync(caminho); } catch (_) { continue; }
    if (st.isSymbolicLink()) { saida.push({ caminho, relativo, nome, elo: true }); continue; }
    if (st.isDirectory()) listarArquivos(caminho, relativo, saida);
    else saida.push({ caminho, relativo, nome, elo: false });
  }
  return saida;
}

/** Analisa UM arquivo e devolve o RESUMO dele: sinais, especificadores de
 *  ligação e as acusações que ele já forma sozinho.
 *
 *  Exportada para que a prova externa possa exercitar a análise arquivo a
 *  arquivo, sem montar árvore — e para que a isenção de `app.html` seja uma
 *  AFIRMAÇÃO sobre o resultado da análise, nunca uma entrada numa lista de
 *  caminhos. */
function analisar(relativo, buf, opcoes) {
  const truncado = !!(opcoes && opcoes.truncado);
  const acusacoes = [];
  const formato = formatoCompactadoDe(buf);
  if (formato) {
    const nomes = formato === "ZIP" ? inventarioDeZip(buf)
      : formato === "TAR" ? inventarioDeTar(buf) : null;
    const portadores = portadoresNoInventario(nomes);
    acusacoes.push({
      ramo: "PACOTE",
      texto: "é um pacote " + formato + " (reconhecido pelos bytes, não pelo nome)" +
        (portadores.length
          ? " e carrega dentro: " + portadores.join(", ")
          : " — conteúdo empacotado não é auditável por leitura"),
    });
    return { relativo, compactado: formato, sinais: null, especificadores: [], acusacoes };
  }

  if (truncado) {
    acusacoes.push({
      ramo: "GRANDE-DEMAIS",
      texto: "passa de " + LIMITES.bytesLidosDoArquivo + " bytes e não pôde ser lido " +
        "inteiro — o que a guarda não lê ela não audita, e não auditado não passa",
    });
  }

  const bruto = buf.toString("latin1");
  const ehHtml = /\.html?$/i.test(relativo) || /^\s*<(?:!doctype|html)\b/i.test(bruto);
  const programa = ehHtml ? programaDeHtml(bruto) : programaDe(bruto);
  const sinais = sinaisDe(programa, bruto);
  for (const c of capacidadesDe(sinais, "arquivo")) acusacoes.push(c);
  return {
    relativo, compactado: null, sinais,
    especificadores: especificadoresDe(bruto),
    acusacoes,
  };
}

/** A DECISÃO COMPOSTA. Recebe os resumos por arquivo e devolve as acusações
 *  que só aparecem quando mais de um arquivo é olhado junto.
 *
 *  Para cada arquivo F e cada escopo mais largo que ele, o veredito é calculado
 *  sobre `sinais brutos DE F` + `sinais de programa DO ESCOPO`. Um ramo que já
 *  acusou F num escopo mais estreito não é repetido — a acusação nomeia o
 *  escopo em que a capacidade se fecha, e é essa a informação útil.
 *
 *  E SÓ É ACUSADO QUEM CONTRIBUI: se nenhum dos sinais do ramo está ligado no
 *  resumo de F, F não é participante — é vizinho. */
function capacidadesCompostas(resumos) {
  const analisaveis = resumos.filter((r) => r.sinais && r.relativo !== PORTADOR_UNICO);
  const porArquivo = componentesDe(analisaveis);
  const compostas = [];

  const contribui = (resumo, ramo) =>
    !!resumo && !!resumo.sinais && ramo.sinais.some((nome) => resumo.sinais[nome]);
  const nomear = (lista) =>
    lista.slice(0, 8).join(", ") + (lista.length > 8 ? " (e mais " + (lista.length - 8) + ")" : "");

  // --- ESCOPO `conjunto`: a componente conexa, arquivo a arquivo -----------
  const jaAcusado = new Map(
    analisaveis.map((r) => [r.relativo, new Set(r.acusacoes.map((a) => a.ramo))])
  );

  for (const resumo of analisaveis) {
    const membros = porArquivo.get(resumo.relativo) || [resumo.relativo];
    const parceirosPossiveis = analisaveis.filter(
      (r) => membros.includes(r.relativo) && r.relativo !== resumo.relativo
    );
    if (!parceirosPossiveis.length) continue;

    const sinaisDoConjunto = unirPrograma(
      analisaveis.filter((r) => membros.includes(r.relativo)).map((r) => r.sinais)
    );
    const combinados = Object.assign({}, sinaisDoConjunto, sinaisBrutos(resumo.sinais));
    for (const c of capacidadesDe(combinados, "conjunto")) {
      if (jaAcusado.get(resumo.relativo).has(c.ramo)) continue;
      const ramo = RAMOS_POR_ID[c.ramo];
      if (!contribui(resumo, ramo)) continue;
      const parceiros = parceirosPossiveis.filter((r) => contribui(r, ramo)).map((r) => r.relativo);
      if (!parceiros.length) continue;
      jaAcusado.get(resumo.relativo).add(c.ramo);
      compostas.push({
        relativo: resumo.relativo, ramo: c.ramo, escopo: "conjunto",
        texto: c.texto + " — em COMPOSIÇÃO no escopo `conjunto`, com: " + nomear(parceiros),
      });
    }
  }

  // --- ESCOPO `arvore`: UM veredito por ramo, e não um por arquivo ---------
  //
  // O escopo residual olha a árvore inteira, e por isso a acusação é
  // CONSOLIDADA: um servidor fragmentado sem ligação declarada deixaria
  // sessenta linhas idênticas apontando para todo lado, e laudo ilegível é
  // quase tão ruim quanto verde indevido. Uma linha, com os contribuintes
  // nomeados, diz a mesma coisa e diz onde olhar.
  //
  // O SINAL BRUTO CONTINUA PRESO AO ARQUIVO: aqui ele só conta se vier de um
  // arquivo que TAMBÉM traz um sinal de programa do mesmo ramo. Texto num
  // documento não empresta capacidade ao programa de outro.
  for (const ramo of RAMOS) {
    if (!ramo.escopos.includes("arvore")) continue;

    const doPrograma = ramo.sinais.filter((nome) => NOMES_DE_PROGRAMA.includes(nome));
    const contribuintes = analisaveis.filter((r) => doPrograma.some((nome) => r.sinais[nome]));
    if (contribuintes.length < 2) continue;

    // se todos os contribuintes já estão na mesma componente, o escopo
    // `conjunto` já falou — o residual não repete.
    const primeira = porArquivo.get(contribuintes[0].relativo) || [contribuintes[0].relativo];
    if (contribuintes.every((r) => primeira.includes(r.relativo))) continue;

    const sinaisDaArvore = unirPrograma(contribuintes.map((r) => r.sinais));
    for (const nome of NOMES_BRUTOS) {
      sinaisDaArvore[nome] = contribuintes.some((r) => r.sinais[nome]);
    }
    if (!ramo.quando(sinaisDaArvore)) continue;

    const nomes = contribuintes.map((r) => r.relativo);
    compostas.push({
      relativo: nomes[0], ramo: ramo.id, escopo: "arvore",
      texto: ramo.texto + " — em COMPOSIÇÃO no escopo `arvore`, sem ligação declarada, " +
        "somando: " + nomear(nomes),
    });
  }

  return compostas;
}

/** Reprova se a árvore carregar qualquer servidor além do portador.
 *
 *  `raizDoRepo` existe para que a prova externa exercite a guarda contra
 *  árvores forjadas. Devolve estatística da varredura — quantos arquivos foram
 *  lidos, quantas asserções foram feitas e QUAIS RAMOS dispararam, por escopo —,
 *  porque uma implementação oca também "passa" em silêncio, e quem a chama
 *  precisa poder exigir que ela tenha de fato trabalhado. */
function conferirUnicidadeDoPortador(raizDoRepo) {
  const laudo = laudoDaArvore(raizDoRepo);
  assert.ok(
    laudo.estatistica.portadorConferido,
    "`" + PORTADOR_UNICO + "` não foi encontrado na árvore — sem portador não " +
      "há o que guardar, e uma varredura que não o alcança não alcança nada"
  );
  assert.ok(
    laudo.portadorReconhecido,
    "a análise deixou de reconhecer capacidade de servidor em `" + PORTADOR_UNICO +
      "` — cega assim ela aprovaria qualquer duplicata (reconheceu: " +
      (laudo.ramosDoPortador.join("; ") || "nada") + ")"
  );
  assert.equal(
    laudo.problemas.length, 0,
    "SEGUNDO SERVIDOR NA ÁRVORE — só `" + PORTADOR_UNICO + "` pode sê-lo:\n  " +
      laudo.problemas.join("\n  ")
  );
  return laudo.estatistica;
}

/** O LAUDO, sem asserção nenhuma.
 *
 *  Existe separado porque a prova externa precisa saber QUAIS RAMOS dispararam
 *  em cada cenário, e um veredito que só sabe estourar não conta isso. Quem
 *  afirma é `conferirUnicidadeDoPortador`, logo acima; quem observa é
 *  `prova_da_unicidade.js`, que cobra cobertura de ramo sobre este laudo. */
function laudoDaArvore(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");
  const estatistica = {
    arquivos: 0, asseveracoes: 0, portadorConferido: false,
    ramos: {}, escopos: { arquivo: 0, conjunto: 0, arvore: 0 },
  };
  const contar = (ramo, escopo) => {
    estatistica.ramos[ramo] = (estatistica.ramos[ramo] || 0) + 1;
    if (escopo && estatistica.escopos[escopo] !== undefined) estatistica.escopos[escopo]++;
  };

  const problemas = [];
  const reprovar = (onde, oQue) => problemas.push("`" + onde + "` " + oQue);
  let ramosDoPortador = [];
  let portadorReconhecido = false;

  const resumos = [];
  for (const alvo of listarArquivos(raiz, "", [])) {
    estatistica.arquivos++;

    if (alvo.elo) {
      estatistica.asseveracoes++;
      contar("ELO-SIMBOLICO", null);
      reprovar(alvo.relativo, "é um elo simbólico — o conteúdo mora fora da " +
        "árvore versionada e não é auditável por leitura");
      continue;
    }

    let buf;
    try {
      buf = fs.readFileSync(alvo.caminho);
    } catch (_) { continue; }
    const truncado = buf.length > LIMITES.bytesLidosDoArquivo;
    if (truncado) buf = buf.slice(0, LIMITES.bytesLidosDoArquivo);

    const laudo = analisar(alvo.relativo, buf, { truncado });
    estatistica.asseveracoes++;
    resumos.push(laudo);

    if (alvo.relativo === PORTADOR_UNICO) {
      // O PORTADOR TAMBÉM É CONFERIDO, e por dentro: análise que deixasse de
      // reconhecer o próprio servidor estaria cega, e passaria tudo.
      estatistica.portadorConferido = true;
      ramosDoPortador = laudo.acusacoes.map((a) => a.ramo);
      portadorReconhecido = ramosDoPortador.length >= 3;
      continue;
    }

    if (/(^|\/)package\.json$/.test(alvo.relativo)) {
      conferirManifesto(alvo.relativo, buf.toString("utf8"), reprovar);
      estatistica.asseveracoes++;
    }

    for (const acusacao of laudo.acusacoes) {
      contar(acusacao.ramo, "arquivo");
      reprovar(alvo.relativo, acusacao.texto);
    }
  }

  // A CAMADA QUE FALTAVA: a decisão sobre o conjunto.
  for (const composta of capacidadesCompostas(resumos)) {
    estatistica.asseveracoes++;
    contar(composta.ramo, composta.escopo);
    reprovar(composta.relativo, composta.texto);
  }

  return { estatistica, problemas, ramosDoPortador, portadorReconhecido };
}

module.exports = {
  PORTADOR_UNICO, DIRETORIOS_TECNICOS, LIMITES, GUID_DO_HANDSHAKE,
  SINAIS_DE_PROGRAMA, SINAIS_BRUTOS, NOMES_DE_PROGRAMA, NOMES_BRUTOS,
  RAMOS, RAMOS_POR_ID, IDS_DOS_RAMOS, ESCOPOS,
  programaDe, programaDeHtml, sinaisDe, sinaisBrutos, argumentosDaChamada,
  unirPrograma, capacidadesDe, capacidadesCompostas,
  especificadoresDe, resolverEspecificador, componentesDe,
  formatoCompactadoDe, inventarioDeZip, inventarioDeTar, portadoresNoInventario,
  listarArquivos, analisar, laudoDaArvore, conferirUnicidadeDoPortador,
};
