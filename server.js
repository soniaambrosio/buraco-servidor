// GERADO por cliente/build_server_bundle.js — NÃO EDITAR À MÃO.
// Buraco Master VIP — servidor de salas (multiplayer) num único arquivo, Node puro.
// Deploy: node server.js  (porta via env PORT, padrão 8080). Health-check: /health.
//
// ===================================================================================
// EXCEÇÃO DOCUMENTADA — PATCH CIRÚRGICO DE CONFORMIDADE (branch correcao/conformidade-canonica)
// Este arquivo é GERADO e não deveria ser editado à mão. Porém a fonte `cliente/`
// (`motor/*.js` + `build_server_bundle.js`) NÃO está versionada/localizada nos
// repositórios disponíveis (buraco-servidor só tem este bundle). Por decisão da Sônia,
// o bundle foi corrigido DIRETAMENTE, EXCLUSIVAMENTE para 3 divergências críticas do C8:
//   • CRIT-01 (de_500 = 500): validarSequencia + finalizar (classifica A..K limpa 13);
//   • CRIT-02 (as_a_as = 1000): validarSequencia + finalizar + pontuarDuplaJogo +
//                               duplaTemCanastraLimpa + duplaPodeBater + baixadaTravaria;
//   • CRIT-03 (vulnerabilidade uniforme bot=humano): checarAberturaVulneravel.
// Todos os trechos alterados estão marcados com o comentário `// [PATCH CRIT-0x]`.
// O server.js ANTERIOR está preservado no Git (main / commit be72bb6).
// Se a pasta-fonte `cliente/` for recuperada, RETROPORTAR estas mudanças para a fonte
// e REGERAR o bundle. Nenhuma outra regra/área foi tocada. Sem deploy.
//
// -----------------------------------------------------------------------------------
// EXCEÇÃO DOCUMENTADA #2 — ENFORCEMENT DE VISÃO DE ESPECTADOR (P0 de sigilo)
// Mesma justificativa da exceção acima: a fonte `cliente/` continua AUSENTE — o repo
// `buraco-servidor` guarda só este bundle (o `buraco-servidor.zip` versionado ao lado
// contém apenas `server.js` + `package.json`, não a fonte). Verificado nesta OS.
// Alterações, todas marcadas com `// [PATCH ESPECTADOR]`:
//   • motor/jogo    — `visaoDoEspectador` (lista de permissão), `segredosDoEspectador`
//                     (as 4 mãos + monte + mortos) e `vazamentosNaVisao` (varredura
//                     recursiva). NENHUMA regra de Buraco foi tocada;
//   • servidor/salas — porta única `visaoPara({codigo, papel, assento})` + tripwire
//                     que bloqueia o payload se um id secreto escapar;
//   • servidor/servidor — `papelDe` (papel decidido pelo SERVIDOR), mensagem
//                     `assistirMesa`, broadcast por papel, `fim` sem carteira para
//                     quem assiste e recusa genérica em ação de espectador.
// Contrato de referência: `app/lib/motor/visao_espectador.dart` (repo do app).
// Testes: `test/espectador.test.js` e `test/regressao.test.js` (`npm test`).
// O server.js ANTERIOR está preservado no Git (main / commit 1828d42). Sem deploy.
// ===================================================================================
// EXCEÇÃO DOCUMENTADA — AUTENTICAÇÃO DO HANDSHAKE (branch seguranca/ws-auth-identidade)
// Mesmo motivo acima (fonte `cliente/` ausente): o bundle foi editado à mão para
// fechar o P0 de identidade — o handshake WebSocket não autenticava ninguém e o
// `jogadorId` era o que o cliente DIZIA ser. Trechos marcados com `// [PATCH WS-AUTH]`:
//   • módulo NOVO `auth_firebase` (verificação de Firebase ID Token, sem deps);
//   • módulo `servidor`: máquina de estados de autenticação, identidade vinculada
//     e imutável na conexão, e fim da leitura de `msg.jogadorId`;
//   • módulo `ws_server`: credencial no upgrade HTTP (Authorization: Bearer) e
//     injeção do verificador real.
// Nenhuma regra do Buraco, pontuação, baralho, economia ou moderação foi tocada.
// Sem merge e sem deploy. Ver docs/WS-AUTH-IDENTIDADE.md.
// ===================================================================================
// EXCEÇÃO DOCUMENTADA — VERSIONAMENTO DA VISÃO AUTORITATIVA
// (branch claude/versionamento-visao-autoritativa-v1)
// Mesmo motivo das anteriores: a fonte `cliente/` continua ausente. O bundle foi
// editado à mão para fechar o risco residual da ligação do motor canônico à Casca
// V2 — o evento `estado` saía SEM nenhuma marca de emissão, e o cliente não tinha
// como reconhecer visão repetida, antiga ou reordenada. Trechos marcados com
// `// [VERSAO]`:
//   • módulo `salas`: `impressaoDoEstado` + `carimbarEstado` (ponto ÚNICO de
//     atribuição de `versaoEstado`/`eventoId`), carimbo na porta única de
//     projeção `visaoPara`, e leitura por `metadadosDe`;
//   • módulo `servidor`: `eventoEstado(c)` — a única forma de montar o evento
//     `estado`, usada pelos dois emissores (broadcast e snapshot de espectador).
// Os campos novos são ADITIVOS e irmãos de `visao`: nada foi removido ou
// renomeado, PROTOCOLO_MINIMO/ATUAL não mudaram, e nenhum campo novo é exigido do
// cliente. Nenhuma regra do Buraco, pontuação, encerramento, economia ou
// moderação foi tocada; o aplicativo Flutter não foi alterado.
// Testes: `test/versao.test.js` (24 provas). Sem merge e sem deploy.
// Ver docs/VERSIONAMENTO-VISAO-V1.md.
// ===================================================================================
// EXCEÇÃO DOCUMENTADA — GATE AUTORITATIVO DE ENTRADA VIP/RANQUEADA
// (branch claude/gate-autoritativo-entrada-vip-ranqueada-v1)
// Mesmo motivo das anteriores: a fonte `cliente/` continua ausente. O bundle foi
// editado à mão para criar o instante — que não existia — em que o servidor
// afirma, sem consultar o cliente, que UM UID AUTENTICADO está prestes a ocupar
// UM ASSENTO numa partida VIP/Ranqueada. Trechos marcados com `// [GATE VIP]`:
//   • módulo `salas`: `CATEGORIAS_COMPETITIVAS` (casual | vip_ranqueada — uma
//     dimensão NOVA, ortogonal a `tipoPartida`, que segue com os mesmos três
//     valores de topologia), `normalizarCategoria`, `novaTentativaEntradaId`,
//     `assentoDoTitular` e o ponto único `avaliarAdmissaoAoAssento`; a porta
//     `admitirNoAssento` do gerenciador, chamada pelos DOIS — e só dois —
//     caminhos que sentam um humano (`criarMesa` no assento 0, `entrarMesa` nos
//     demais), sempre antes da escrita no assento;
//   • módulo `servidor`: `uidAutenticado` levado às duas portas de mesa e
//     `erroDeAdmissao` (código estável, mensagem redigida). `assistirMesa` NÃO
//     foi tocada: espectador não ocupa assento e não atravessa o gate;
//   • módulo `ws_server`: a categoria do processo vem de CATEGORIA_COMPETITIVA,
//     e nenhum adaptador de autorização é injetado.
// FALHA FECHADA por decisão: sem adaptador, entrada em mesa `vip_ranqueada` é
// recusada ANTES da ocupação do assento; categoria fora da enumeração não vira
// casual, não admite ninguém. Nada é concedido, consumido ou cobrado — o passe
// quinzenal, a assinatura e o Firestore não são tocados aqui, e não existe
// bypass de desenvolvimento habilitado por padrão.
// Salas `casual` — que é o que toda mesa é hoje — seguem idênticas.
// Testes: `test/gate_vip.test.js`. Sem merge e sem deploy.
// Ver docs/GATE-VIP-RANQUEADA-V1.md.
// ===================================================================================
// EXCEÇÃO DOCUMENTADA — CREDENCIAL RENOVÁVEL DO MOTOR
// (branch claude/credencial-renovavel-motor-railway-v1)
// Mesmo motivo das anteriores: a fonte `cliente/` continua ausente. O bundle
// ganhou UM módulo novo, marcado com `// [CREDENCIAL]`:
//   • módulo NOVO `credencial_motor` — troca um refresh token por ID tokens do
//     Firebase pelo endpoint REST do Secure Token, com cache, margem de
//     renovação, coalescência de chamadas simultâneas e rotação do refresh
//     token em memória. `https` do Node e mais nada: NENHUMA dependência foi
//     acrescentada, e `package.json` continua sem `dependencies`.
// É o simétrico de `auth_firebase`: aquele verifica quem ENTRA, este produz a
// credencial de quando SAÍMOS — o ID token que o futuro transporte apresentará
// à Cloud Function `registrarEncerramentoPartida`, que exige `motorDePartidas`.
// NADA FOI LIGADO: a outbox está intocada, `ws_server` não carrega o módulo, o
// envelope não foi traduzido e `npm start` faz exatamente o que fazia. Nenhuma
// regra do Buraco, pontuação, encerramento, economia ou moderação foi tocada.
// Testes: `test/credencial_motor.test.js`. Sem merge e sem deploy.
// Ver docs/CREDENCIAL-RENOVAVEL-MOTOR-V1.md.
// ===================================================================================
// EXCEÇÃO DOCUMENTADA — COMPOSIÇÃO DO GATE VIP COM A CREDENCIAL, E O ADAPTADOR
// DE ADMISSÃO (branch integracao/gate-vip-credencial-backend-v1)
// Mesmo motivo das anteriores: a fonte `cliente/` continua ausente. Esta entrada
// COMPÕE as duas folhas acima e liga o que faltava entre elas. Um módulo NOVO,
// marcado com `// [BACKEND]`:
//   • módulo NOVO `admissao_vip` — a porta ÚNICA pela qual o servidor pergunta a
//     um backend se um UID autenticado pode ocupar um assento VIP/Ranqueado.
//     Contrato versionado `admissao-vip-v1`, credencial no cabeçalho, teto de
//     tempo, teto de corpo, leitura fechada da resposta e coalescência por
//     `tentativaEntradaId`. `https`/`http` do Node e mais nada: NENHUMA
//     dependência foi acrescentada;
//   • módulo `salas`: a admissão passou a ter DOIS regimes. Mesa casual decide
//     agora, no mesmo caminho síncrono de sempre; mesa VIP decide quando o
//     backend responder. `concluirAdmissao` é o ponto único que converte
//     decisão em efeito nos dois, e `desfazerAdmissao` fecha a janela em que
//     um jogador cai enquanto o backend pensa;
//   • módulo `servidor`: `concluirPortaDeMesa` conclui as duas portas de mesa
//     nos dois regimes, e confere que a conexão ainda é a mesma antes de
//     aplicar a entrada;
//   • módulo `ws_server`: a credencial canônica é construída UMA vez e o
//     adaptador nasce dela, com o endereço vindo de URL_AUTORIZACAO_ENTRADA_VIP.
// FALHA FECHADA em toda aresta: sem URL, sem credencial, credencial revogada,
// timeout, 429, 5xx, JSON quebrado, contrato de outra versão, `ok` que não é
// exatamente `true` ou `admissaoId` vazio — tudo recusa ANTES da ocupação. Não
// existe retry no adaptador: a recuperação é a da credencial canônica e só dela.
// Casual não busca credencial e não chama backend; espectador e bots não passam
// por este transporte. Nada é concedido ou consumido: assinatura, passe
// quinzenal e Firestore continuam fora deste servidor, e o endpoint real NÃO foi
// provisionado. O contrato de encerramento segue em versaoContrato 1, intocado.
// Testes: `test/admissao_vip.test.js`. Sem merge e sem deploy.
// Ver docs/ADMISSAO-VIP-BACKEND-V1.md.
// ===================================================================================
(function () {
  var __cache = {};
  var __fabricas = {};
  function __norm(nome) { return nome.split("/").pop().replace(/\.js$/, ""); }
  function __require(nome) {
    var id = __norm(nome);
    if (__fabricas[id]) {
      if (__cache[id]) return __cache[id].exports;
      var module = { exports: {} };
      __cache[id] = module;
      __fabricas[id](module, module.exports, __require);
      return module.exports;
    }
    return require(nome); // built-ins do Node (http, crypto, fs, path)
  }

  __fabricas["carta"] = function (module, exports, require) {
// motor/carta.js
// Modelo de Carta e geração do baralho (2 baralhos de 52 + 2 coringas cada = 108 cartas)
// Baseado em regras-buraco-tradicional.md, seção 1 e 2.

const NAIPES = ["copas", "ouros", "paus", "espadas"];
const VALORES_NUMERICOS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// Ordem sequencial pra validação de sequência (A pode ser alto ou baixo dependendo da variante —
// aqui tratamos A como carta baixa por padrão, seguindo a tabela de pontos da seção 2, que já
// prevê variante de A alto; deixamos isolado pra facilitar extensão futura).
const ORDEM_SEQUENCIA = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/**
 * @typedef {Object} Carta
 * @property {string} id
 * @property {string|null} naipe - null para coringa impresso
 * @property {string} valor - "A".."K" ou "JOKER"
 * @property {boolean} eh_coringa
 */

let _contadorId = 0;
function novoId() {
  _contadorId += 1;
  return `c${_contadorId}`;
}

/** Cria uma carta comum (não-coringa) */
function criarCarta(naipe, valor) {
  return {
    id: novoId(),
    naipe,
    valor,
    eh_coringa: valor === "2", // o 2 é coringa natural, mas continua tendo naipe físico
  };
}

/** Cria um coringa impresso (joker), sem naipe */
function criarJoker() {
  return {
    id: novoId(),
    naipe: null,
    valor: "JOKER",
    eh_coringa: true,
  };
}

/** Gera um baralho completo de 108 cartas (2 baralhos + 4 jokers) */
function gerarBaralhoCompleto() {
  const cartas = [];
  for (let baralho = 0; baralho < 2; baralho++) {
    for (const naipe of NAIPES) {
      for (const valor of VALORES_NUMERICOS) {
        cartas.push(criarCarta(naipe, valor));
      }
    }
    // 2 coringas impressos por baralho
    cartas.push(criarJoker());
    cartas.push(criarJoker());
  }
  return cartas; // 2 * (52 + 2) = 108
}

function embaralhar(cartas) {
  const copia = [...cartas];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

module.exports = {
  NAIPES,
  VALORES_NUMERICOS,
  ORDEM_SEQUENCIA,
  criarCarta,
  criarJoker,
  gerarBaralhoCompleto,
  embaralhar,
};

  };

  __fabricas["canastra"] = function (module, exports, require) {
// motor/canastra.js
// Validação de sequências/canastras — regras-buraco-tradicional.md, seções 2 e 7,
// e arquitetura-tecnica-buraco.md, seção 1.2.
//
// Cobre os 3 tipos de "jogo" que podem ser baixados na mesa:
//   1. Sequência normal: mesmo naipe, cartas em ordem, no máx. 1 curinga substituindo lacuna.
//   2. Canastra de Ás: grupo formado só por Ases (7+ para virar canastra oficial).
//   3. Canastra de curingas: grupo formado só por curingas (2's e/ou Jokers).
//
// Uma sequência com 3-6 cartas é "aberta" (ainda não pontua como canastra).
// Ao atingir 7+ cartas, vira oficialmente canastra (limpa/suja/de_as/de_curinga).

const { ORDEM_SEQUENCIA } = require("./carta");

const MIN_CARTAS_SEQUENCIA = 3;
const MIN_CARTAS_CANASTRA = 7;
const MAX_CURINGAS_SEQUENCIA_NORMAL = 1;
const MAX_CURINGAS_TRINCA = 1;

/**
 * Classifica um conjunto de cartas, validando se forma uma sequência/canastra válida.
 *
 * REGRA-CHAVE (Sônia): o "2" é AMBÍGUO. Ele é curinga quando substitui outra
 * carta, mas é carta COMUM quando está na posição natural dele e no naipe da
 * sequência (2♥ 3♥ 4♥ = LIMPA, não suja). Por isso o validador testa as
 * interpretações possíveis e fica com a MAIS LIMPA que for válida — é assim que
 * uma canastra suja vira limpa quando a carta que o curinga tapava é baixada.
 * O Joker impresso não tem essa ambiguidade: é curinga sempre, e suja em
 * definitivo (não tem naipe pra "voltar" pra lugar nenhum).
 *
 * @param {Carta[]} cartas
 * @returns {{valido: boolean, motivo?: string, tipo?: string, qtd_curingas?: number}}
 */
function validarSequencia(cartas) {
  if (!cartas || cartas.length < MIN_CARTAS_SEQUENCIA) {
    return { valido: false, motivo: `Mínimo de ${MIN_CARTAS_SEQUENCIA} cartas para formar um jogo` };
  }

  const curingas = cartas.filter((c) => c.eh_coringa);
  const naoCuringas = cartas.filter((c) => !c.eh_coringa);

  // --- Caso 1: Canastra de curingas (só 2's e/ou Jokers) ---
  if (curingas.length === cartas.length) {
    return finalizar({ tipoBase: "de_curinga", qtdCuringas: curingas.length, tamanho: cartas.length });
  }

  // --- Caso 2: Canastra de Ás (só Ases, sem substituição por curinga) ---
  if (curingas.length === 0 && naoCuringas.every((c) => c.valor === "A")) {
    return finalizar({ tipoBase: "de_as", qtdCuringas: 0, tamanho: cartas.length });
  }

  // [PATCH CRIT-01] de_500: A..K limpa (13 cartas, mesmo naipe, uma de cada valor,
  // sem JOKER). Detecção estrutural fiel à regra canônica (o "2" entra natural).
  if (cartas.length === 13 && !cartas.some((c) => c.valor === "JOKER")) {
    const naipes500 = new Set(cartas.map((c) => c.naipe));
    if (naipes500.size === 1 && !cartas.some((c) => c.naipe == null)) {
      const vals500 = new Set(cartas.map((c) => c.valor));
      const alvo500 = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      if (vals500.size === 13 && alvo500.every((v) => vals500.has(v))) {
        return finalizar({ tipoBase: "de_500", qtdCuringas: 0, tamanho: 13 });
      }
    }
  }
  // [PATCH CRIT-02] as_a_as: A–2–…–K–A (14 cartas, mesmo naipe, 2 ases nas pontas,
  // 2..K uma de cada, sem JOKER). Mesma forma canônica do motor Dart.
  if (cartas.length === 14 && !cartas.some((c) => c.valor === "JOKER")) {
    const naipesAA = new Set(cartas.map((c) => c.naipe));
    if (naipesAA.size === 1 && !cartas.some((c) => c.naipe == null)) {
      const asesAA = cartas.filter((c) => c.valor === "A");
      const naoAsesAA = cartas.filter((c) => c.valor !== "A");
      const valsAA = new Set(naoAsesAA.map((c) => c.valor));
      const alvoAA = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      if (asesAA.length === 2 && naoAsesAA.length === 12 && valsAA.size === 12 &&
          alvoAA.every((v) => valsAA.has(v))) {
        return finalizar({ tipoBase: "as_a_as", qtdCuringas: 0, tamanho: 14 });
      }
    }
  }

  // --- Caso 3: Sequência normal (mesmo naipe, em ordem, até 1 curinga) ---
  // Separa os "2" (ambíguos) dos Jokers (curinga puro) e das cartas comuns.
  const jokers = cartas.filter((c) => c.valor === "JOKER");
  const dois = cartas.filter((c) => c.valor === "2");
  const comuns = cartas.filter((c) => c.valor !== "2" && c.valor !== "JOKER");

  const naipesComuns = new Set(comuns.map((c) => c.naipe));
  if (naipesComuns.size > 1) {
    return { valido: false, motivo: "Todas as cartas não-coringa devem ser do mesmo naipe" };
  }
  const naipeSeq = comuns.length ? comuns[0].naipe : (dois.length ? dois[0].naipe : null);

  // Monta as interpretações: cada "2" pode entrar como NATURAL (só se for do
  // naipe da sequência) ou como CURINGA. Testa da mais limpa pra mais suja.
  const interpretacoes = [];
  for (let mascara = 0; mascara < (1 << dois.length); mascara++) {
    const comoCuringa = [], comoNatural = [];
    for (let i = 0; i < dois.length; i++) {
      if (mascara & (1 << i)) comoCuringa.push(dois[i]);
      else comoNatural.push(dois[i]);
    }
    // um "2" só pode ser natural se for do naipe da sequência
    if (comoNatural.some((c) => naipeSeq && c.naipe !== naipeSeq)) continue;
    interpretacoes.push({ comoCuringa, comoNatural });
  }
  interpretacoes.sort((a, b) => a.comoCuringa.length - b.comoCuringa.length);

  const idxBaixo = (v) => ORDEM_SEQUENCIA.indexOf(v);
  const idxAlto = (v) => (v === "A" ? ORDEM_SEQUENCIA.length : ORDEM_SEQUENCIA.indexOf(v));
  const encaixa = (naturais, qtdCuringas, mapa, teto) => {
    const valores = naturais.map((c) => c.valor);
    if (new Set(valores).size !== valores.length) return false; // valor repetido
    const indices = naturais.map((c) => mapa(c.valor)).sort((a, b) => a - b);
    const minIdx = indices[0];
    const maxIdx = indices[indices.length - 1];
    const span = maxIdx - minIdx + 1;
    const lacunasInternas = span - naturais.length;
    if (lacunasInternas > qtdCuringas) return false;
    const curingasSobrando = qtdCuringas - lacunasInternas;
    if (curingasSobrando > 0) {
      const cabeNoInicio = minIdx - curingasSobrando >= 0;
      const cabeNoFim = maxIdx + curingasSobrando <= teto;
      if (!cabeNoInicio && !cabeNoFim) return false;
    }
    return true;
  };

  let motivoFalha = "Lacuna na sequência maior que o número de curingas disponíveis";
  for (const interp of interpretacoes) {
    const qtdCuringas = jokers.length + interp.comoCuringa.length;
    if (qtdCuringas > MAX_CURINGAS_SEQUENCIA_NORMAL) {
      motivoFalha = `Máximo de ${MAX_CURINGAS_SEQUENCIA_NORMAL} curinga por sequência`;
      continue;
    }
    const naturais = comuns.concat(interp.comoNatural);
    if (naturais.length === 0) continue; // só curinga: já tratado no Caso 1
    let ok = encaixa(naturais, qtdCuringas, idxBaixo, ORDEM_SEQUENCIA.length - 1);
    if (!ok && naturais.some((c) => c.valor === "A")) {
      ok = encaixa(naturais, qtdCuringas, idxAlto, ORDEM_SEQUENCIA.length);
    }
    // fica na PRIMEIRA que validar — como estão ordenadas da mais limpa pra
    // mais suja, essa é a melhor leitura possível daquelas cartas
    if (ok) {
      return finalizar({ tipoBase: "sequencia", qtdCuringas, tamanho: cartas.length });
    }
  }
  return { valido: false, motivo: motivoFalha };
}

/**
 * Valida uma TRINCA (grupo do MESMO VALOR) — regra do modo FECHADO (Sônia, 19/jul).
 * "Buraco fechado com as temidas trincas": um jogo por VALOR (três Reis, quatro 7…),
 * naipes podem repetir (são 2 baralhos). REGRAS DA SÔNIA:
 *   - CURINGA (2 ou Joker) NÃO ENTRA em trinca — ela é só de cartas NATURAIS iguais.
 *   - A trinca NÃO forma canastra (a classificação de canastra usa validarSequencia,
 *     que recusa grupos de valor igual) — no fim vale só os pontos das cartas.
 * Mínimo 3 cartas do mesmo valor.
 *
 * @param {Carta[]} cartas
 * @returns {{valido:boolean, motivo?:string, tipo?:string, qtd_curingas?:number}}
 */
function validarTrinca(cartas) {
  if (!cartas || cartas.length < MIN_CARTAS_SEQUENCIA) {
    return { valido: false, motivo: `Mínimo de ${MIN_CARTAS_SEQUENCIA} cartas para formar um jogo` };
  }
  // CURINGA não entra em trinca (regra Sônia 19/jul): "2" e Joker são curingas.
  if (cartas.some((c) => c.eh_coringa)) {
    return { valido: false, motivo: "curinga (2 ou Joker) não entra em trinca — só cartas naturais iguais" };
  }
  // todas as cartas precisam ser do MESMO valor
  const valores = new Set(cartas.map((c) => c.valor));
  if (valores.size > 1) {
    return { valido: false, motivo: "Numa trinca, todas as cartas devem ser do mesmo valor" };
  }
  // trinca válida (sempre "limpa" no sentido de sem curinga; NÃO é canastra)
  return finalizar({ tipoBase: "trinca", qtdCuringas: 0, tamanho: cartas.length });
}

/**
 * Valida um JOGO conforme a modalidade. Sempre tenta SEQUÊNCIA; no modo com trinca
 * liberada (fechado), se não for sequência, tenta TRINCA. É o ponto único que o
 * motor e o bot usam pra saber se um conjunto de cartas pode ir pra mesa.
 *
 * @param {Carta[]} cartas
 * @param {{permiteTrinca?:boolean}} [opts]
 */
function validarJogo(cartas, opts = {}) {
  // O GRUPO DE ASES ("canastra de ás") é da família TRINCA — mesmo VALOR, não é
  // sequência de verdade. Só vale onde trinca vale (Fechado). No SBTL/Aberto, ás
  // só entra em SEQUÊNCIA (A-2-3 ou Q-K-A). Bug pego pela Sônia (20/jul): o robô
  // descia AAA no SBTL porque essa exceção furava a trava de trinca.
  const soAses = !!(cartas && cartas.length && cartas.every((c) => c && c.valor === "A" && !c.eh_coringa));
  const rSeq = validarSequencia(cartas);
  if (rSeq.valido && !(soAses && !opts.permiteTrinca)) return rSeq;
  if (opts.permiteTrinca) {
    const rTri = validarTrinca(cartas);
    if (rTri.valido) return rTri;
    return { valido: false, motivo: "não forma uma sequência nem uma trinca válida" };
  }
  if (soAses) return { valido: false, motivo: "no SBTL/Aberto o ás só entra em sequência (trinca de ases é só no Fechado)" };
  return rSeq;
}

function finalizar({ tipoBase, qtdCuringas, tamanho }) {
  let tipo;
  if (tamanho < MIN_CARTAS_CANASTRA) {
    tipo = "aberta"; // 3-6 cartas: ainda não é canastra oficial
  } else if (tipoBase === "de_curinga") {
    tipo = "de_curinga";
  } else if (tipoBase === "de_as") {
    tipo = "de_as";
  } else if (tipoBase === "de_500") { // [PATCH CRIT-01]
    tipo = "de_500";
  } else if (tipoBase === "as_a_as") { // [PATCH CRIT-02]
    tipo = "as_a_as";
  } else {
    tipo = qtdCuringas > 0 ? "suja" : "limpa";
  }
  return { valido: true, tipo, qtd_curingas: qtdCuringas };
}

/**
 * Verifica se uma carta pode ser adicionada a uma sequência já existente na mesa
 * (baixar/estender — regras-buraco-tradicional.md, seção 7).
 * @param {Carta[]} sequenciaAtual - cartas já baixadas
 * @param {Carta} novaCarta
 * @returns {{valido: boolean, motivo?: string}}
 */
function podeEstenderSequencia(sequenciaAtual, novaCarta) {
  const resultado = validarSequencia([...sequenciaAtual, novaCarta]);
  if (!resultado.valido) {
    return { valido: false, motivo: resultado.motivo };
  }
  return { valido: true };
}

module.exports = {
  MIN_CARTAS_SEQUENCIA,
  MIN_CARTAS_CANASTRA,
  MAX_CURINGAS_SEQUENCIA_NORMAL,
  MAX_CURINGAS_TRINCA,
  validarSequencia,
  validarTrinca,
  validarJogo,
  podeEstenderSequencia,
};

  };

  __fabricas["bot"] = function (module, exports, require) {
// motor/bot.js
// Cérebro de decisão de um bot "intermediário" de Buraco (variante SBTL/Jogatina).
// Reutiliza a validação de sequência/canastra já testada em motor/canastra.js —
// o bot NUNCA reimplementa regra de jogo; ele só decide ENTRE jogadas válidas.
//
// Nível "intermediário", conforme combinado:
//   - agrupa a mão em sequências do mesmo naipe (usa o "2" como curinga só quando
//     não dá pra fechar sem ele — prioriza canastra limpa);
//   - decide comprar do lixo quando a carta do topo encaixa/estende algo;
//   - baixa o que consegue, priorizando VIRAR/estender canastras (7+);
//   - descarta a carta menos útil (a mais "solitária" e de menor valor);
//   - pega o morto assim que zera a mão (não exige canastra pra isso);
//   - só BATE (batida final) quando tem canastra limpa E consegue zerar a mão.
//
// Decisões são puras e determinísticas (sem estado global), o que as torna
// fáceis de testar e de reusar tanto no mock quanto no servidor.

// Dependências: no Node vêm por require; no navegador, o mockup expõe as mesmas
// funções em window.MotorCanastra / window.MotorCarta antes de carregar este arquivo.
// (Fonte única de verdade: a MESMA validação de canastra roda nos dois ambientes.)
var _carta, _canastra;
if (typeof require !== "undefined") {
  _carta = require("./carta");
  _canastra = require("./canastra");
} else {
  _carta = (typeof self !== "undefined" ? self : this).MotorCarta;
  _canastra = (typeof self !== "undefined" ? self : this).MotorCanastra;
}
var ORDEM_SEQUENCIA = _carta.ORDEM_SEQUENCIA;
var validarSequencia = _canastra.validarSequencia;
var validarJogo = _canastra.validarJogo;
var podeEstenderSequencia = _canastra.podeEstenderSequencia;
var MIN_CARTAS_CANASTRA = _canastra.MIN_CARTAS_CANASTRA;

// No modo FECHADO o bot também monta TRINCAS. Estender/validar um jogo passa a
// olhar as duas formas. `permiteTrinca` é threadado a partir de planejarTurno
// (regras.trinca); default false preserva 100% o comportamento das outras modalidades.
function podeEstenderJogo(jogoAtual, novaCarta, permiteTrinca) {
  return validarJogo(jogoAtual.concat([novaCarta]), { permiteTrinca: !!permiteTrinca }).valido;
}

var VALOR_PONTOS = { A: 15, JOKER: 50 };
function pontosCarta(carta) {
  if (carta.valor === "A") return 15;
  if (carta.valor === "JOKER") return 50;
  if (carta.valor === "2") return 10;
  if (["8", "9", "10", "J", "Q", "K"].includes(carta.valor)) return 10;
  return 5; // 3 a 7
}

function idxValor(v) { return ORDEM_SEQUENCIA.indexOf(v); }

/**
 * Agrupa uma mão em sequências válidas (do mesmo naipe, em ordem), do jeito que
 * um jogador intermediário faria: pega as corridas mais longas primeiro, deixando
 * o curinga ("2") pra tapar buraco só quando necessário.
 *
 * @param {Carta[]} mao
 * @returns {{ jogos: Carta[][], sobra: Carta[] }} jogos com 3+ cartas e o resto.
 */
/**
 * Agrupa a mão em jogos, gulosamente por naipe.
 *
 * @param {Carta[]} mao
 * @param {boolean} permissivo - true: usa curinga à vontade (serve pra AVALIAR
 *   potencial da mão). false (modo PACIENTE, o do jogo): não gasta curinga num
 *   joguinho de 3 — mas USA numa corrida grande. A regra da Sônia é "não
 *   desperdiçar curinga", não "nunca usar": um Curingão parado na mão vale −50
 *   no fim da rodada, e um jogo de 5-6 cartas com curinga é canastra a caminho.
 */
const MIN_JOGO_PRA_GASTAR_CURINGA = 5;

function agruparMao(mao, permissivo, permiteTrinca = false) {
  const jogos = [];
  let restantes = mao.slice();

  // Separa curingas "puros" (JOKER) e trata "2" como possível curinga.
  // Estratégia gulosa por naipe: pra cada naipe, tenta montar a corrida mais longa.
  let progrediu = true;
  while (progrediu) {
    progrediu = false;
    let melhor = escolherCorrida(restantes, permissivo);
    if (melhor && melhor.length >= 3) {
      jogos.push(melhor);
      // remove as cartas usadas (por id)
      const usados = new Set(melhor.map((c) => c.id));
      restantes = restantes.filter((c) => !usados.has(c.id));
      progrediu = true;
    }
  }

  // ===== TRINCAS (modo FECHADO) =====
  // Depois de esgotar as sequências, forma grupos de MESMO VALOR com o que sobrou
  // (três Reis, quatro 7…). Guloso: pega a maior/mais limpa trinca, remove, repete.
  if (permiteTrinca) {
    let progT = true;
    while (progT) {
      progT = false;
      const t = melhorTrinca(restantes);
      if (t && t.length >= 3) {
        jogos.push(t);
        const usados = new Set(t.map((c) => c.id));
        restantes = restantes.filter((c) => !usados.has(c.id));
        progT = true;
      }
    }
  }

  // ===== ANEXO DO CURINGA QUE SOBROU =====
  // Depois do guloso, um curinga pode ter ficado órfão na mão. Anexá-lo na ponta
  // do MAIOR jogo aproxima a canastra — mas SUJA aquele jogo.
  // REGRA v104 (Sônia, print Mateus "colocou o curingão na ponta, sem ligação,
  // sujou um jogo que ia fazer 200"): no modo PACIENTE (mid-game) o CURINGÃO
  // (JOKER) NUNCA é anexado — segura ele pra o jogo virar LIMPA (200), não suja
  // (100). Só o "2" (10 pts) é anexado mid-game. No permissivo (reta final/batida)
  // o Curingão entra normal (aí evitar o −50 vale mais que esperar a limpa).
  const podeAnexarCuringa = (c) => permissivo || c.valor === "2";
  {
    const minParaAnexar = permissivo ? 3 : MIN_JOGO_PRA_GASTAR_CURINGA - 1;
    let curingaOrfao = restantes.find((c) => c.eh_coringa && podeAnexarCuringa(c));
    while (curingaOrfao) {
      // maior jogo SEM curinga (não se põe 2 curingas na mesma sequência) e que NÃO
      // seja TRINCA — curinga não entra em trinca (regra Sônia 19/jul); só estende
      // SEQUÊNCIA (>1 valor distinto). Sem isso, o órfão virava "8-8-8-JOKER" e o
      // motor recusava na hora de baixar (abertura vulnerável saía parcial/fraca).
      const alvo = jogos
        .filter((j) => j.length >= minParaAnexar && !j.some((c) => c.eh_coringa) &&
                       new Set(j.map((c) => c.valor)).size > 1)
        .sort((a, b) => b.length - a.length)[0];
      if (!alvo) break;
      alvo.push(curingaOrfao);
      restantes = restantes.filter((c) => c.id !== curingaOrfao.id);
      curingaOrfao = restantes.find((c) => c.eh_coringa && podeAnexarCuringa(c));
    }
  }
  return { jogos, sobra: restantes };
}

/**
 * Encontra a corrida (sequência de mesmo naipe) mais longa possível dentro da mão,
 * opcionalmente usando 1 curinga pra tapar um buraco. Retorna as cartas na ordem,
 * ou null se nada de 3+ cartas for possível.
 *
 * Regras de curinga respeitadas (espelham a validação do motor):
 *  - um "2 do MESMO naipe" da corrida é tratado como carta NATURAL na posição
 *    dele (ex: A-2-3 de copas), não como curinga — prioriza canastra limpa;
 *  - quando um buraco precisa ser tapado, prefere gastar um "2 de OUTRO naipe"
 *    (curinga puro), preservando o 2 natural;
 *  - cada curinga físico só entra em UMA corrida (o descarte por id em
 *    agruparMao garante que ele não seja reaproveitado em dois jogos).
 */
/**
 * Escolhe a melhor corrida respeitando a PACIÊNCIA com o curinga.
 *
 * Permissivo: pega a maior corrida, custe o curinga que custar.
 * Paciente (o do jogo): compara a corrida SEM curinga com a COM curinga.
 *   Só gasta o curinga se ele render um jogo de verdade e se isso for melhor
 *   que a corrida limpa. Assim o bot não queima curinga num trio, mas também
 *   não fica sentado em cima dele a rodada toda.
 */
/**
 * Melhor TRINCA (grupo de mesmo VALOR) disponível na mão. REGRA DA SÔNIA (19/jul):
 * CURINGA (2 ou Joker) NÃO entra em trinca — só cartas NATURAIS iguais, mín. 3.
 * Prefere a maior. Retorna as cartas ou null.
 */
function melhorTrinca(mao) {
  const porValor = {};
  for (const c of mao) {
    if (c.eh_coringa) continue;            // curinga nunca entra em trinca
    (porValor[c.valor] = porValor[c.valor] || []).push(c);
  }
  let melhor = null;
  for (const v in porValor) {
    const naturais = porValor[v];
    if (naturais.length >= 3 && (!melhor || naturais.length > melhor.length)) melhor = naturais.slice();
  }
  return melhor;
}

function escolherCorrida(mao, permissivo) {
  const comCuringa = melhorCorrida(mao, true);
  if (permissivo) return comCuringa;

  const semCuringa = melhorCorrida(mao, false);
  const tamSem = semCuringa ? semCuringa.length : 0;
  const tamCom = comCuringa ? comCuringa.length : 0;

  // a corrida limpa já é boa e não é pior que a suja? fica com a limpa
  if (tamSem >= 3 && tamSem >= tamCom) return semCuringa;
  // gastar curinga num jogo novo só vale por um jogo de verdade — vale pro "2"
  // e pro Curingão igual: abrir um joguinho de 4 já sujo mata a canastra limpa
  // de 200 que aquele jogo ainda podia virar.
  if (tamCom >= MIN_JOGO_PRA_GASTAR_CURINGA) return comCuringa;
  return tamSem >= 3 ? semCuringa : null;
}

function melhorCorrida(mao, permitir3ComCuringa) {
  const naipes = ["copas", "ouros", "paus", "espadas"];
  let melhor = null;

  const idxAltoMap = (v) => (v === "A" ? ORDEM_SEQUENCIA.length : idxValor(v));
  for (const naipe of naipes) {
    const cartasDoNaipe = mao.filter((c) => c.naipe === naipe);
    const temAs = cartasDoNaipe.some((c) => c.valor === "A");
    // varre nos dois mapeamentos: Ás baixo (A-2-3) e Ás ALTO (J-Q-K-A)
    const mapeamentos = temAs ? [idxValor, idxAltoMap] : [idxValor];
    for (const mapa of mapeamentos) {
    // Cartas-âncora: as não-curinga do naipe. O "2 do mesmo naipe" entra como
    // possível NATURAL (posição A-2-3) — o validador decide; um 2 de outro
    // naipe nunca é natural aqui.
    const doNaipe = cartasDoNaipe
      .slice()
      .sort((a, b) => mapa(a.valor) - mapa(b.valor));

    // curingas disponíveis pra tapar buraco NESTA corrida: qualquer "2"/joker.
    // Preferência da mesa real (feedback da Sônia): o 2 do MESMO naipe do jogo
    // primeiro — combina com o jogo e pode ser "limpado"/reposicionado depois;
    // depois o 2 de outro naipe; e o CURINGÃO (JOKER, 50 pts) por ÚLTIMO — ele é
    // caro e some em definitivo, então só entra se não houver "2" pra tapar o
    // buraco (bug do print: Renato tinha um 2 e mesmo assim queimou o Curingão).
    const curingasMesmoNaipe = mao.filter((c) => c.eh_coringa && c.valor === "2" && c.naipe === naipe);
    const doisOutroNaipe = mao.filter((c) => c.eh_coringa && c.valor === "2" && c.naipe !== naipe);
    const jokers = mao.filter((c) => c.valor === "JOKER");
    const curingasOrdenados = curingasMesmoNaipe.concat(doisOutroNaipe).concat(jokers);

    const unicas = [];
    const vistos = new Set();
    for (const c of doNaipe) {
      if (!vistos.has(c.valor)) { unicas.push(c); vistos.add(c.valor); }
    }
    if (unicas.length === 0) continue;

    for (let i = 0; i < unicas.length; i++) {
      let seq = [unicas[i]];
      let curingasUsados = 0;
      // um 2 do próprio naipe usado como ÂNCORA natural não pode dobrar como curinga
      const idsNaSeqInicial = new Set([unicas[i].id]);
      for (let j = i + 1; j < unicas.length; j++) {
        const distancia = mapa(unicas[j].valor) - mapa(seq[seq.length - 1].valor);
        if (distancia === 1) {
          seq.push(unicas[j]);
          idsNaSeqInicial.add(unicas[j].id);
        } else if (distancia === 2 && curingasUsados < 1 && permitir3ComCuringa) {
          // tapa 1 buraco com o próximo curinga disponível que NÃO esteja já na corrida
          const cur = curingasOrdenados.find((c) => !idsNaSeqInicial.has(c.id));
          if (!cur) break;
          seq.push(cur);
          idsNaSeqInicial.add(cur.id);
          seq.push(unicas[j]);
          idsNaSeqInicial.add(unicas[j].id);
          curingasUsados++;
        } else {
          break;
        }
      }
      // EXTENSÃO DE PONTA (lacuna que deixava combos invisíveis): um PAR do
      // mesmo naipe (ex: 4♠-5♠) + 1 curinga anexado na ponta (virando o 3♠ ou
      // o 6♠) é uma corrida válida de 3. Antes o curinga só tapava buraco
      // INTERNO e esses combos não eram vistos — nem protegidos do descarte.
      // Corridas MAIORES não puxam curinga aqui de propósito: o guloso usaria o
      // curinga pra alongar a maior corrida, quando ele quase sempre rende mais
      // fechando OUTRO jogo (ex: um par K-A vale mais que +1 carta numa corrida
      // que já é grande). Se ele sobrar, o passo de ANEXO no fim resolve.
      if (seq.length === 2 && curingasUsados < 1 && permitir3ComCuringa) {
        const curPonta = curingasOrdenados.find((c) => !idsNaSeqInicial.has(c.id));
        if (curPonta) {
          seq.push(curPonta);
          idsNaSeqInicial.add(curPonta.id);
          curingasUsados++;
        }
      }
      if (seq.length >= 3) {
        // PACIÊNCIA (Sônia): no modo estrito, jogo NOVO nunca gasta curinga —
        // nem tapando buraco, nem na ponta, em jogo de qualquer tamanho. Vale
        // mais esperar a carta natural e estender depois. Curinga em jogo novo
        // só nas exceções permissivas (zerar a mão pro morto/batida, ou a
        // obrigação da compra justificada).
        const usaCuringaComoTapa = curingasUsados > 0;
        if (usaCuringaComoTapa && !permitir3ComCuringa) continue;
        const res = validarSequencia(seq);
        if (res.valido && (!melhor || seq.length > melhor.length)) {
          melhor = seq;
        }
      }
    }
    } // fim do loop de mapeamentos (Ás baixo/alto)
  }
  return melhor;
}

/**
 * Decide de onde comprar no início do turno: do lixo (se a carta do topo
 * encaixa em algo) ou do monte (padrão). Intermediário: pega o lixo quando a
 * carta do topo estende um jogo na mesa OU completa uma corrida com a mão.
 *
 * @param {Object} params
 * @param {Carta[]} params.mao
 * @param {Carta|null} params.topoLixo
 * @param {Carta[][]} params.jogosMesaDupla - jogos já baixados pela dupla do bot
 * @returns {{ origem: "lixo"|"monte", motivo: string }}
 */
/**
 * Acha o maior conjunto {topo + N cartas da mão, do mesmo naipe} que, anexado a
 * um jogo da mesa, forma sequência válida. Retorna o grupo (incluindo o topo) ou
 * null. Ex: jogo 4-5-6-7♥ + topo 10♥ + 8♥,9♥ da mão → estende 4..10.
 */
function maiorExtensaoComTopo(jogo, topo, mao) {
  if (topo.eh_coringa) return null;
  const ancora = jogo.find((c) => !c.eh_coringa);
  if (!ancora || ancora.naipe !== topo.naipe) return null;
  const candidatas = mao.filter((c) => !c.eh_coringa && c.naipe === topo.naipe && c.id !== topo.id);
  const todas = [topo].concat(candidatas)
    .filter((c, i, arr) => arr.findIndex((x) => x.valor === c.valor) === i)
    .sort((a, b) => idxValor(a.valor) - idxValor(b.valor));
  for (let tam = todas.length; tam >= 1; tam--) {
    for (let ini = 0; ini + tam <= todas.length; ini++) {
      const grupo = todas.slice(ini, ini + tam);
      if (!grupo.some((c) => c.id === topo.id)) continue;
      if (validarSequencia(jogo.concat(grupo)).valido) return grupo;
    }
  }
  return null;
}

function decidirCompra({ mao, topoLixo, jogosMesaDupla = [], tamanhoLixo = 1, modalidade = "sbtl", cartasLixo = null }) {
  if (!topoLixo) return { origem: "monte", motivo: "lixo vazio" };
  const regras = regrasDaModalidade(modalidade);

  // ===== ABERTO: compra LIVRE (sem critério nenhum — regra confirmada) =====
  // Não existe prova nem carta obrigatória: quem quiser pega o lixo na sua vez.
  // Então o bot decide por VALOR, não por permissão. O lixo é visível, então
  // ele enxerga todas as cartas (mesma informação que os humanos têm).
  if (!regras.compraJustificada) {
    const lixo = cartasLixo && cartasLixo.length ? cartasLixo : [topoLixo];
    const { ganho, peso } = avaliarLixoAberto(mao, lixo, jogosMesaDupla);
    if (ganho > peso) {
      const uteis = contarUteisDoLixo(mao, lixo, jogosMesaDupla);
      return {
        origem: "lixo",
        motivo: "lixo aberto (" + lixo.length + " cartas) \u2014 material bom" +
          (uteis ? ": " + uteis + " entra" + (uteis > 1 ? "m" : "") + " em jogo agora" : ": casa com a m\u00e3o")
      };
    }
    return {
      origem: "monte",
      motivo: "lixo aberto (" + lixo.length + " cartas), mas quase nada casa com a m\u00e3o \u2014 n\u00e3o compensa encher"
    };
  }

  // ===== FECHADO / SBTL: compra JUSTIFICADA =====
  // TRAVA "CARTA NÃO TEM MOLA": só compra o lixo se houver PROVA concreta de
  // uso imediato do topo. A prova é o plano que será executado — impossível
  // comprar e não usar. Sem prova → monte.
  const prova = provarUsoDoTopo({ topo: topoLixo, mao, jogosMesaDupla, tamanhoLixo, permiteTrinca: regras.trinca });
  if (prova) {
    const extras = prova.cartas.length - 1;
    let motivo;
    if (prova.tipo === "estende") {
      // essa extensão LIMPA uma canastra suja? é a jogada mais lucrativa possível
      const jogo = jogosMesaDupla[prova.indiceJogo] || [];
      const antes = validarJogo(jogo, { permiteTrinca: regras.trinca });
      const depois = validarJogo(jogo.concat(prova.cartas), { permiteTrinca: regras.trinca });
      const limpou = antes.valido && depois.valido && antes.tipo === "suja" && depois.tipo === "limpa";
      motivo = limpou
        ? "o topo LIMPA nossa canastra suja (100 \u2192 200 pts!)"
        : "topo estende um jogo na mesa" + (extras ? " (com " + extras + " carta[s] da m\u00e3o)" : "");
    } else {
      motivo = "topo forma jogo novo com cartas da m\u00e3o";
    }
    return { origem: "lixo", motivo, provaTopo: prova };
  }
  return { origem: "monte", motivo: "topo do lixo não tem uso imediato — não pega o lixo" };
}

/**
 * PROVA ÚNICA do uso do topo do lixo (garante "carta não tem mola"): retorna um
 * PLANO CONCRETO de como o topo será usado imediatamente, ou null se não houver
 * uso. A MESMA prova serve pra decidir a compra E pra executá-la — impossível
 * comprar e não usar, porque a decisão já carrega o passo-a-passo da execução.
 *
 * Retorno: null | {
 *   tipo: "estende", indiceJogo, cartas: [topo (+ parceiras da mão)]
 * } | {
 *   tipo: "novo", cartas: [topo + 2 cartas da mão]
 * }
 */
function provarUsoDoTopo({ topo, mao, jogosMesaDupla, tamanhoLixo = 1, permiteTrinca = false }) {
  if (!topo) return null;
  const valJ = (cs) => validarJogo(cs, { permiteTrinca });

  // A) topo estende um jogo sozinho. PREFERE a extensão NATURAL — o topo entra
  // como carta comum, sem virar curinga (ex.: um "2" no PRÓPRIO naipe estende
  // 3-4-5-6♠ pra 2-3-4-5-6♠, LIMPO; ou o topo completa uma trinca do mesmo valor).
  // Regra Sônia: nunca gasta um "2" como curinga sujando outro jogo se ele tem
  // casa natural. Só se NÃO houver natural é que o topo entra como curinga — e,
  // aí, jamais num jogo LIMPO sem curinga nenhum (não suja canastra que ainda
  // pode virar 200). O JOKER (sem naipe) nunca é natural, então sempre cai na
  // regra do curinga.
  let estendeComoCuringa = null;
  for (let ji = 0; ji < jogosMesaDupla.length; ji++) {
    const jogo = jogosMesaDupla[ji];
    if (!podeEstenderJogo(jogo, topo, permiteTrinca)) continue;
    const curAntes = valJ(jogo).qtd_curingas || 0;
    const curDepois = valJ(jogo.concat([topo])).qtd_curingas || 0;
    if (curDepois <= curAntes) {
      // NATURAL: melhor uso possível — devolve na hora
      return { tipo: "estende", indiceJogo: ji, cartas: [topo] };
    }
    // entraria como CURINGA (sujaria): guarda como fallback, mas só num jogo que
    // já tem carta-curinga (nunca suja um jogo 100% limpo à toa — regra Sônia)
    if (!estendeComoCuringa && jogo.some((c) => c.eh_coringa)) {
      estendeComoCuringa = { tipo: "estende", indiceJogo: ji, cartas: [topo] };
    }
  }
  if (estendeComoCuringa) return estendeComoCuringa;

  // B) topo + N cartas da mão (mesmo naipe, sequenciais) estendem um jogo
  for (let ji = 0; ji < jogosMesaDupla.length; ji++) {
    const grupo = maiorExtensaoComTopo(jogosMesaDupla[ji], topo, mao);
    if (grupo) return { tipo: "estende", indiceJogo: ji, cartas: grupo };
  }

  // C) topo + 2 cartas do mesmo naipe (sem curinga) formam jogo novo
  const doNaipeTopo = mao.filter((c) => !c.eh_coringa && c.naipe === topo.naipe && c.id !== topo.id);
  for (let a = 0; a < doNaipeTopo.length; a++) {
    for (let b = a + 1; b < doNaipeTopo.length; b++) {
      if (validarSequencia([topo, doNaipeTopo[a], doNaipeTopo[b]]).valido) {
        return { tipo: "novo", cartas: [topo, doNaipeTopo[a], doNaipeTopo[b]] };
      }
    }
  }

  // C-trinca) FECHADO: topo + 2 cartas do MESMO VALOR do topo formam uma trinca
  // nova (limpa, sem gastar curinga). Ex.: topo K♣ + K♥ + K♦ da mão.
  if (permiteTrinca && !topo.eh_coringa) {
    const mesmoValor = mao.filter((c) => !c.eh_coringa && c.valor === topo.valor && c.id !== topo.id);
    if (mesmoValor.length >= 2 && valJ([topo, mesmoValor[0], mesmoValor[1]]).valido) {
      return { tipo: "novo", cartas: [topo, mesmoValor[0], mesmoValor[1]] };
    }
  }

  // D) LIXO GRANDE (>5) + curinga: topo do mesmo naipe do jogo estende com curinga,
  //    ou forma trio novo com o topo. (curinga de outro naipe só p/ jogo do naipe do topo)
  if (tamanhoLixo > 5 && !topo.eh_coringa) {
    // MOLA MAIS BARATA PRIMEIRO (Sônia v87): pra abocanhar o lixo gordo, gasta o
    // "2" (10 pts) antes do Curingão (50 pts). Só queima o Curingão quando ele é
    // a ÚNICA mola — aí vale sem dó, porque um lixo gordo rende muito mais que 50
    // pts. Antes o código pegava curingas[0] (ordem da mão), o que às vezes
    // torrava o Curingão à toa. Percorre em ordem de preço e usa a 1ª que serve.
    const curingas = mao
      .filter((c) => c.eh_coringa)
      .sort((a, b) => pontosCarta(a) - pontosCarta(b));
    for (const cur of curingas) {
      for (let ji = 0; ji < jogosMesaDupla.length; ji++) {
        const jogo = jogosMesaDupla[ji];
        if (jogo.some((c) => c.eh_coringa)) continue;
        const ancora = jogo.find((c) => !c.eh_coringa);
        if (!ancora || ancora.naipe !== topo.naipe) continue;
        if (validarSequencia(jogo.concat([topo])).valido) {
          return { tipo: "estende", indiceJogo: ji, cartas: [topo] };
        }
        if (validarSequencia(jogo.concat([topo, cur])).valido) {
          return { tipo: "estende", indiceJogo: ji, cartas: [topo, cur] };
        }
      }
      for (const parceira of doNaipeTopo) {
        if (validarSequencia([topo, parceira, cur]).valido) {
          return { tipo: "novo", cartas: [topo, parceira, cur] };
        }
      }
    }
  }

  return null; // sem uso imediato → NÃO compra o lixo (carta não tem mola)
}

/**
 * MODALIDADES DO BURACO — as três variantes se diferenciam por 4 eixos apenas.
 * Confirmado por Sônia (especialista) + pesquisa (Jogatina, Jogos do Rei, Pagat):
 *
 *  - lixoVisivel:       o lixo fica espalhado à vista de todos (aberto) ou
 *                       empilhado, mostrando só o topo (fechado/sbtl).
 *  - compraJustificada: pra pegar o lixo é preciso usar o TOPO imediatamente.
 *                       No aberto NÃO existe critério: qualquer um pega o lixo
 *                       na sua vez, de graça.
 *  - trinca:            jogos de 3+ cartas do mesmo VALOR (naipes diferentes).
 *                       Só o fechado aceita.
 *  - bateComSuja:       a batida final aceita canastra suja. Só o fechado.
 *  - curingao:          o baralho inclui os 4 Jokers impressos (50 pts). O
 *                       curingão SUJA EM DEFINITIVO — nunca há como limpar,
 *                       porque ele não tem naipe pra "voltar" ao lugar.
 *
 * SBTL = "Sem Trinca e Bate com Limpa" — é o Fechado com as duas regras mais
 * duras. Daí ser a modalidade dos jogadores experientes.
 */
const MODALIDADES = {
  aberto:  { lixoVisivel: true,  compraJustificada: false, trinca: false, bateComSuja: false, curingao: false },
  fechado: { lixoVisivel: false, compraJustificada: true,  trinca: true,  bateComSuja: true,  curingao: true  },
  sbtl:    { lixoVisivel: false, compraJustificada: true,  trinca: false, bateComSuja: false, curingao: true  },
};

/** Devolve as regras de uma modalidade (default: sbtl, a modalidade-mãe do app). */
function regrasDaModalidade(modalidade) {
  return MODALIDADES[modalidade] || MODALIDADES.sbtl;
}

/**
 * ABERTO: como não há compra justificada, o bot decide por VALOR. Mas o valor
 * do lixo NÃO é "quantas cartas eu baixaria agora" — é quanto MATERIAL ele
 * traz. Um jogador de mesa pega o lixo pelas cartas que completam jogos, pelas
 * que casam com o que ele tem (viram jogo depois) e pelos curingas. Só o que
 * não conversa com nada é peso morto (enche a mão e vira ponto negativo).
 *
 * Retorna { ganho, peso }: vale a pena quando o ganho supera o peso morto.
 */
/**
 * ABERTO: como não há compra justificada, o bot decide por VALOR. E a medida
 * honesta do valor não é heurística de vizinhança — é rodar o próprio agrupador
 * e comparar: quantas cartas eu baixaria A MAIS pegando o lixo, e quantas
 * cartas mortas a mais eu carregaria? Carta parada na mão vira ponto NEGATIVO
 * quando alguém bate, então lixo gordo e sem sinergia é péssimo negócio.
 *
 * Retorna { ganho, peso }: vale quando o ganho supera o peso.
 */
function avaliarLixoAberto(mao, cartasLixo, jogosMesaDupla) {
  const totalEm = (jogos) => jogos.reduce((s, j) => s + j.length, 0);
  const semLixo = agruparMao(mao, true);
  const comLixo = agruparMao(mao.concat(cartasLixo), true);
  // cartas que eu passaria a baixar por causa do lixo
  const ganhoBaixadas = totalEm(comLixo.jogos) - totalEm(semLixo.jogos);
  // cartas mortas a mais que ficariam encalhadas na minha mão
  const mortasExtras = comLixo.sobra.length - semLixo.sobra.length;

  // o agrupador só olha a mão; o que encaixa nos jogos JÁ na mesa é lucro à parte
  let naMesa = 0, curingas = 0, limpezas = 0;
  for (const c of cartasLixo) {
    if (c.eh_coringa) { curingas++; continue; }
    for (const jogo of jogosMesaDupla) {
      if (!podeEstenderSequencia(jogo, c).valido) continue;
      // ESTA carta LIMPA uma canastra suja? É a jogada mais lucrativa do jogo:
      // suja(100) → limpa(200). Vale muito mais que uma extensão comum.
      const antes = validarSequencia(jogo);
      const depois = validarSequencia(jogo.concat([c]));
      if (antes.valido && depois.valido && antes.tipo === "suja" && depois.tipo === "limpa") limpezas++;
      else naMesa++;
      break;
    }
  }

  // curinga vale muito (vira canastra depois); carta que encaixa na mesa é ponto
  // na hora; carta que LIMPA canastra é ouro puro (+100 pontos de uma vez)
  const ganho = ganhoBaixadas + naMesa * 2 + curingas * 3 + limpezas * 10;
  // quanto maior a mão final, mais caro cada carta morta: numa mão de 30 é quase
  // impossível baixar tudo antes de alguém bater
  const maoFinal = mao.length + cartasLixo.length;
  const custoPorMorta = maoFinal > 24 ? 2.5 : (maoFinal > 18 ? 1.6 : 1);
  return { ganho, peso: Math.max(0, mortasExtras) * custoPorMorta };
}

/**
 * Conta quantas cartas do lixo entram em jogo AGORA (jogos da mesa ou jogos
 * novos formados com a mão). Usado como informação auxiliar no log.
 */
function contarUteisDoLixo(mao, cartasLixo, jogosMesaDupla) {
  let uteis = 0;
  const sobrando = [];
  for (const c of cartasLixo) {
    let encaixou = false;
    for (const jogo of jogosMesaDupla) {
      if (podeEstenderSequencia(jogo, c).valido) { uteis++; encaixou = true; break; }
    }
    if (!encaixou) sobrando.push(c);
  }
  // as que sobraram: entram em algum jogo novo montado com a mão?
  const idsDoLixo = new Set(sobrando.map((c) => c.id));
  const { jogos } = agruparMao(mao.concat(sobrando), false);
  for (const jogo of jogos) {
    for (const c of jogo) if (idsDoLixo.has(c.id)) uteis++;
  }
  return uteis;
}

/**
 * Escolhe a carta a descartar: a menos útil E mais SEGURA. Heurística:
 *  1. evita cartas que já fazem parte de um jogo em formação na própria mão;
 *  2. NUNCA descarta (se puder evitar) carta que encaixa nos jogos do
 *     ADVERSÁRIO na mesa — seria entregar compra de lixo de graça;
 *  3. entre as seguras, escolhe a de menor valor (guarda as caras pra pontuar),
 *     desempatando pela mais "solitária" (menos vizinhas do mesmo naipe);
 *  4. nunca descarta o curinga se houver alternativa.
 *
 * @param {Carta[]} mao
 * @param {Carta[][]} [jogosAdversario] - jogos já baixados pela dupla adversária
 * @returns {Carta} a carta escolhida pra descarte
 */
function decidirDescarte(mao, jogosAdversario = [], permiteTrinca = false) {
  // Proteção PERMISSIVA: cartas que participariam de um jogo em potencial
  // (mesmo os de 3 com curinga, que o modo estrito segura em vez de baixar)
  // não são candidatas ao descarte — descartar uma delas jogaria fora um
  // combo em formação (ex: 3♣ + 2♣ + 5♣, ou um par de Reis que vira trinca).
  // Baixar continua estrito; PROTEGER é permissivo.
  const { sobra } = agruparMao(mao, true, permiteTrinca);
  const candidatas = sobra.length > 0 ? sobra : mao.slice();

  // não descarta curinga se houver alternativa
  const semCuringa = candidatas.filter((c) => !c.eh_coringa);
  let pool = semCuringa.length > 0 ? semCuringa : candidatas;

  // DESCARTE SEGURO: separa as que NÃO servem ao adversário (sequência OU trinca)
  const ehPerigosa = (carta) =>
    jogosAdversario.some((jogo) => podeEstenderJogo(jogo, carta, permiteTrinca));
  const seguras = pool.filter((c) => !ehPerigosa(c));
  if (seguras.length > 0) pool = seguras;
  // (se TODAS forem perigosas, paciência — descarta a de menor valor mesmo assim)

  // menor valor primeiro; desempate por "solidão" (menos vizinhos do mesmo naipe)
  return pool.slice().sort((a, b) => {
    const pa = pontosCarta(a), pb = pontosCarta(b);
    if (pa !== pb) return pa - pb;
    return vizinhos(mao, a) - vizinhos(mao, b);
  })[0];
}

function vizinhos(mao, carta) {
  if (carta.eh_coringa) return 99;
  let n = 0;
  for (const c of mao) {
    if (c.id === carta.id || c.eh_coringa) continue;
    if (c.naipe === carta.naipe && Math.abs(idxValor(c.valor) - idxValor(carta.valor)) <= 2) n++;
  }
  return n;
}

/**
 * Decide se o bot deve pegar o morto AGORA. No SBTL, basta a mão estar vazia
 * (não exige canastra). Retorna true se a mão ficou vazia após as baixadas.
 */
function decidirPegarMorto({ maoAposBaixar, mortoDisponivel }) {
  return mortoDisponivel && maoAposBaixar.length === 0;
}

/**
 * Decide se o bot deve BATER (batida final, que encerra a rodada). Só é
 * permitido se: já pegou o morto, consegue zerar a mão, E a dupla tem (ou
 * terá, com esta jogada) ao menos 1 canastra LIMPA (7+, sem curinga).
 *
 * @param {Object} params
 * @param {Carta[]} params.mao - mão atual do bot (após ter pego o morto)
 * @param {Carta[][]} params.jogosMesaDupla - jogos da dupla já na mesa
 * @param {boolean} params.jaPegouMorto
 * @returns {{ deveBater: boolean, motivo: string }}
 */
function decidirBater({ mao, jogosMesaDupla = [], jaPegouMorto, permiteTrinca = false, bateComSuja = false }) {
  if (!jaPegouMorto) return { deveBater: false, motivo: "ainda não pegou o morto" };

  // simula baixar tudo o que der (modo PERMISSIVO: na batida final, zerar a
  // mão vale mais que economizar o curinga); sobra tem que ser 0
  const { jogos, sobra } = agruparMao(mao, true, permiteTrinca);
  // zera por batida FECHADA (sobra 0) ou COMUM (sobra 1 — descarta a última)
  const conseguiriaZerar = sobra.length <= 1;
  if (!conseguiriaZerar) return { deveBater: false, motivo: "não consegue zerar a mão nesta jogada" };

  const jogosFinais = jogosMesaDupla.concat(jogos);
  // batida exige uma CANASTRA (7+): no FECHADO limpa OU suja; nas outras só LIMPA.
  // TRINCA NÃO forma canastra (regra Sônia 19/jul) — por isso usa validarSequencia,
  // que recusa grupos de valor igual. Só canastra de sequência (ou de ás) conta.
  const temCanastraPraBater = jogosFinais.some((j) => {
    if (j.length < MIN_CARTAS_CANASTRA) return false;
    const res = validarSequencia(j);
    if (!res.valido) return false;
    if (res.tipo === "limpa" || res.tipo === "de_500" || res.tipo === "as_a_as") return true; // [PATCH CRIT-02] estratégia do bot também reconhece as_a_as
    return bateComSuja && res.tipo === "suja";
  });
  if (!temCanastraPraBater) {
    return { deveBater: false, motivo: bateComSuja ? "sem canastra 7+ — não pode bater ainda" : "sem canastra limpa — não pode bater ainda" };
  }

  return { deveBater: true, motivo: "tem canastra pra bater e zera a mão: bate!" };
}

/**
 * Descobre quais cartas da mão ESTENDEM jogos já baixados pela dupla (uma
 * carta por vez, na melhor ordem). Retorna a lista de extensões e a mão que
 * sobra. Fundamental pra o bot honrar a decisão de comprar do lixo "porque a
 * carta estende um jogo" — antes ele comprava e não estendia.
 *
 * Inteligência de curinga:
 *  - NUNCA estende um jogo LIMPO com curinga (sujaria a canastra: 200 → 100
 *    pontos). Curinga só entra em jogo que já está sujo, e mesmo assim só se
 *    não houver uso melhor pra ele na mão (ex: abrir um jogo novo).
 *
 * @param {Carta[]} mao
 * @param {Carta[][]} jogosMesaDupla - jogos já na mesa (arrays de cartas)
 * @returns {{ extensoes: {indiceJogo:number, carta:Carta}[], sobra: Carta[] }}
 */
function planejarExtensoes(mao, jogosMesaDupla, permitirSujar, naRetaFinal, permiteTrinca = false) {
  const extensoes = [];
  const jogos = jogosMesaDupla.map((j) => j.slice());
  let sobra = mao.slice();
  const valJ = (cs) => validarJogo(cs, { permiteTrinca });

  // curingas que teriam uso melhor: participariam de um jogo novo da mão
  const { jogos: jogosPotenciais } = agruparMao(sobra, false, permiteTrinca);
  const curingasComUsoMelhor = new Set();
  jogosPotenciais.forEach((j) => j.forEach((c) => { if (c.eh_coringa) curingasComUsoMelhor.add(c.id); }));

  const temCuringa = (jogo) => {
    // Pergunta ao VALIDADOR, não à flag da carta: um "2" na posição natural
    // dele tem eh_coringa=true mas NÃO está sujando nada (2♥3♥4♥ é limpa).
    const r = valJ(jogo);
    return r.valido ? r.qtd_curingas > 0 : jogo.some((c) => c.eh_coringa);
  };

  /** A carta devolve o curinga à posição natural, virando a canastra suja em
   *  limpa? (suja=100 → limpa=200, e destrava a batida final). Numa TRINCA isso
   *  nunca acontece (o curinga não tem "posição natural" pra voltar), então valJ
   *  devolve qtd_curingas>0 antes e depois → false, que é o certo. */
  const limpaACanastra = (jogo, carta) => {
    const antes = valJ(jogo);
    const depois = valJ(jogo.concat([carta]));
    if (!antes.valido || !depois.valido) return false;
    return antes.qtd_curingas > 0 && depois.qtd_curingas === 0;
  };

  /** REGRA (Sônia): a canastra suja ainda TEM FUTURO? Só se o curinga for um
   *  "2" do PRÓPRIO naipe da sequência — aí, quando a carta que ele tapa
   *  aparecer, o 2 volta pra posição natural dele e a canastra vira limpa.
   *  Joker não tem naipe e "2" de naipe alheio não tem pra onde voltar: essas
   *  ficam sujas em definitivo. */
  const podeVirarLimpa = (jogo) => {
    const r = validarSequencia(jogo);
    if (!r.valido || r.qtd_curingas === 0) return false; // já é limpa
    if (jogo.some((c) => c.valor === "JOKER")) return false; // curingão nunca limpa
    const comuns = jogo.filter((c) => c.valor !== "2" && c.valor !== "JOKER");
    if (!comuns.length) return false;
    const naipeSeq = comuns[0].naipe;
    // todo "2" presente precisa ser do naipe da sequência pra ter volta
    return jogo.filter((c) => c.valor === "2").every((c) => c.naipe === naipeSeq);
  };

  let progrediu = true;
  while (progrediu) {
    progrediu = false;
    for (let ci = 0; ci < sobra.length; ci++) {
      const carta = sobra[ci];
      for (let ji = 0; ji < jogos.length; ji++) {
        if (!podeEstenderJogo(jogos[ji], carta, permiteTrinca)) continue;
        const jogoAlvo = jogos[ji];
        // REGRA (Sônia, Print SUJA 18/jul): NUNCA suja uma canastra que JÁ É LIMPA
        // (7+ cartas, 0 curinga). Vale pra QUALQUER carta — curinga (2/Joker) OU
        // natural que force o "2" natural a virar curinga: ex. 2-3-4-5-6-7-8-9 limpa
        // + J => o J não conecta (falta o 10), então o 2 vira curinga do 10 e a
        // canastra vira SUJA. Sujar uma limpa derruba 200 (ou 500 do de_500) pra
        // 100 e mata o caminho pro de_500/mil — troca péssima, sempre. (A exceção
        // do 6→7 lá embaixo age num RUN de 6, que ainda NÃO é canastra.)
        {
          const rLimpaAtual = valJ(jogoAlvo);
          if (rLimpaAtual.valido && jogoAlvo.length >= 7 && rLimpaAtual.qtd_curingas === 0) {
            const rDepois = valJ(jogoAlvo.concat([carta]));
            if (rDepois.valido && rDepois.qtd_curingas > 0) continue; // sujaria a limpa
          }
        }
        // PRINT 7 (Sônia, refinado): não vale inchar canastra suja fechada em
        // 7+ QUANDO ela é irremediável — curinga de outro naipe ou Joker, que
        // nunca voltam pro lugar. Essa vai valer 100 pra sempre, então guardar
        // as cartas pra outro jogo rende mais.
        // Já a canastra com o "2" do PRÓPRIO naipe ainda tem futuro: quando a
        // carta tapada aparecer, ela vira limpa e TUDO que está lá dentro passa
        // a valer 200. Nessa, vale a pena continuar investindo.
        if (!carta.eh_coringa && temCuringa(jogoAlvo) && jogoAlvo.length >= 7) {
          const temFuturo = podeVirarLimpa(jogoAlvo);
          if (!temFuturo && !limpaACanastra(jogoAlvo, carta)) continue;
        }
        if (carta.eh_coringa) {
          // DISCIPLINA DO CURINGA (feedback Sônia v42): um curinga de OUTRO
          // naipe suja o jogo EM DEFINITIVO — nunca tem volta. Então só vale
          // sujar quando há um ganho concreto:
          const mesmoNaipeQueJogo = (function () {
            const ancora = jogoAlvo.find((c) => !c.eh_coringa);
            return ancora && carta.naipe === ancora.naipe;
          })();
          // (a) nunca coloca 2º curinga num jogo que já tem curinga
          if (temCuringa(jogoAlvo)) continue;
          // (b) curinga de outro naipe: só se FECHAR a canastra (leva o jogo a
          //     exatamente 7 — a mínima), e só se não houver uso melhor na mão.
          //     Assim ele suja de propósito pra correr pro morto/bater, e não
          //     "por acaso" num jogo que ainda ia crescer limpo (Prints 2/4/6/7).
          if (!mesmoNaipeQueJogo) {
            // DUAS ECONOMIAS DIFERENTES:
            //
            // O "2" de outro naipe vale 10. Segurar custa 20 (de +10 pra −10) e
            // sujar custa 100 (canastra de 200 vira 100). Disciplina total: só
            // suja pra FECHAR canastra, e só quando já está correndo pra zerar.
            //
            // O Curingão vale 50. Segurar custa 100 — o mesmo que sujar —, mas
            // o prejuízo só se concretiza se a rodada ACABAR com ele na mão.
            // REGRA v104 (Sônia): o Curingão NÃO suja um jogo LIMPO só pra fechar
            // canastra fora da reta final — isso mata uma canastra de 200 (limpa)
            // por uma de 100 (suja) E queima o Curingão à toa. (Print: "colocou o
            // curingão na ponta, sem ligação, sujou um jogo que ia fazer 200".)
            // Ele espera a carta natural fechar LIMPA. SÓ suja na RETA FINAL,
            // quando não dá mais tempo de completar limpo e travar 100 (evitando
            // o −50 do Curingão parado) vale mais que arriscar.
            const ehCuringao = carta.valor === "JOKER";
            const fechaCanastra = jogoAlvo.length === 6; // +curinga = 7
            const valeSujar = ehCuringao
              ? naRetaFinal
              : (permitirSujar && fechaCanastra);
            if (!valeSujar) continue;
            if (curingasComUsoMelhor.has(carta.id)) continue;
          } else {
            // curinga do MESMO naipe pode reposicionar depois; ainda assim não
            // gasta se renderia um jogo novo melhor
            if (curingasComUsoMelhor.has(carta.id)) continue;
          }
        }
        extensoes.push({ indiceJogo: ji, carta });
        jogos[ji].push(carta);
        sobra.splice(ci, 1);
        progrediu = true;
        break;
      }
      if (progrediu) break;
    }
  }
  return { extensoes, sobra };
}

/**
 * Orquestra um turno completo do bot (decisão de alto nível). Não muta nada —
 * retorna um "plano" que o chamador (mock ou servidor) executa e anima.
 *
 * @returns {{ compra, extensoes, baixadas: Carta[][], pegarMorto, bater, descarte }}
 */
function planejarTurno({ mao, topoLixo, jogosMesaDupla = [], jogosAdversario = [], mortoDisponivel, jaPegouMorto, cartaObrigatoria = null, minimoAbertura = 0, tamanhoLixo = 1, provaTopo = null, modalidade = "sbtl", cartasLixo = null, ctx = null }) {
  const regras = regrasDaModalidade(modalidade);
  const permiteTrinca = regras.trinca; // FECHADO: o bot também monta grupos de valor igual
  const compra = decidirCompra({ mao, topoLixo, jogosMesaDupla, tamanhoLixo, modalidade, cartasLixo });
  // No ABERTO não existe compra justificada: nada de prova nem carta obrigatória
  // — o lixo inteiro entra na mão e o bot joga normalmente com o que tem.
  if (!regras.compraJustificada) {
    provaTopo = null;
    cartaObrigatoria = null;
  }
  // a prova do uso do topo pode vir: (1) da decisão de compra (1ª chamada, com
  // topoLixo), ou (2) recalculada a partir da cartaObrigatoria (2ª chamada, já
  // com o topo na mão). Isso garante que a execução use a MESMA prova.
  if (!provaTopo && compra.provaTopo) provaTopo = compra.provaTopo;
  if (!provaTopo && cartaObrigatoria) {
    provaTopo = provarUsoDoTopo({ topo: cartaObrigatoria, mao, jogosMesaDupla, tamanhoLixo });
  }

  // Sujar um jogo com curinga de outro naipe SÓ se justifica quando o bot está
  // de fato na RETA FINAL — perto de zerar a mão pra pegar o morto ou bater.
  // Ter morto na mesa NÃO basta (senão sujaria o tempo todo — bug do print v56).
  // Critério: a mão é pequena (poucas cartas fora dos jogos que já formaria),
  // sinalizando que fechar a canastra mínima realmente adianta a batida.
  const { jogos: jogosPreview } = agruparMao(mao, true, permiteTrinca);
  const cartasEmJogos = jogosPreview.reduce((s, j) => s + j.length, 0);
  const sobrariaNaMao = mao.length - cartasEmJogos;
  // reta final = mão enxuta (≤ 7 cartas totais) E há morto disponível ou já pego
  const naRetaFinal = (mortoDisponivel || jaPegouMorto) && mao.length <= 7;
  const correndoPraZerar = naRetaFinal && sobrariaNaMao <= 3;

  // 1) primeiro ESTENDE jogos já na mesa (usa as cartas que encaixam)
  let { extensoes, sobra: aposExtender } = planejarExtensoes(mao, jogosMesaDupla, correndoPraZerar, naRetaFinal, permiteTrinca);

  // 2) com o que sobrou, abre jogos NOVOS (modo estrito: segura curinga em jogo de 3)
  let { jogos } = agruparMao(aposExtender, false, permiteTrinca);
  // Estratégia (Sônia): NÃO abrir dois jogos do MESMO naipe na mesma jogada —
  // eles podem se conectar pelo meio depois (comprando ou via parceiro),
  // rendendo um jogo maior e possivelmente limpa. Mantém o melhor; segura o outro.
  jogos = umJogoPorNaipe(jogos);
  let maoAposBaixar = descontar(aposExtender, jogos);

  // EXCEÇÃO: se soltar o curinga num jogo de 3 permitir ZERAR a mão (0 sobrando,
  // ou 1 que vira o descarte — batida indireta ou batida final comum) com o
  // morto ainda disponível OU já pego (batida final), vale a pena.
  if ((mortoDisponivel || jaPegouMorto) && maoAposBaixar.length > 1) {
    const permissivo = agruparMao(aposExtender, true, permiteTrinca);
    let jogosPermissivos = permissivo.jogos;
    // DISCIPLINA DO CURINGÃO NO MORTO (Sônia v88): só pra PEGAR o morto (ainda
    // NÃO pegou) o bot NÃO abre trinca nova torrando um Curingão (JOKER) — ele
    // ficaria sujo em definitivo por um morto especulativo (era o print do
    // Renato: 3 Curingões de uma vez). O "2" (curinga barato, 10 pts) ainda
    // vale. Já na batida FINAL (jaPegouMorto) mantém o permissivo cheio:
    // encerrar a rodada vale mais que guardar curinga, e o decidirBater já
    // exige canastra LIMPA — que trinca com Joker nunca forma.
    if (!jaPegouMorto) {
      jogosPermissivos = jogosPermissivos.filter(
        (j) => !j.some((c) => c.valor === "JOKER")
      );
    }
    const sobraPermissiva = descontar(aposExtender, jogosPermissivos);
    if (sobraPermissiva.length <= 1) {
      jogos = jogosPermissivos;
      maoAposBaixar = sobraPermissiva;
    }
  }

  // EXECUTA A PROVA DO TOPO (carta não tem mola): a decisão de compra já
  // provou EXATAMENTE como o topo seria usado. Aplica esse plano ao pé da letra
  // — sem reinventar. Como a prova foi validada, o topo SEMPRE entra na mesa.
  if (provaTopo && provaTopo.cartas && provaTopo.cartas.length) {
    // remove as cartas da prova do que já foi planejado (evita duplicar)
    const idsProva = new Set(provaTopo.cartas.map((c) => c.id));
    jogos = jogos.filter((j) => !j.some((x) => idsProva.has(x.id)));
    extensoes = extensoes.filter((e) => !idsProva.has(e.carta.id));
    if (provaTopo.tipo === "estende") {
      // BUG Sônia: a prova do topo ia por ÚLTIMO nas extensões, então uma OUTRA
      // extensão no mesmo jogo (ex: um "2") era aplicada antes e preemptava o
      // topo — o bot comprava o lixo e o topo ficava na mão (fura "carta não tem
      // mola"). Fix: a prova do topo vai PRIMEIRO na lista, então o topo entra na
      // mesa antes de qualquer outra extensão. As demais seguem depois (aplicam
      // se ainda couberem; se não, a carta fica na mão — sem perda).
      const provaExts = provaTopo.cartas.map((c) => ({ indiceJogo: provaTopo.indiceJogo, carta: c }));
      extensoes = provaExts.concat(extensoes);
    } else {
      jogos.push(provaTopo.cartas.slice());
    }
    maoAposBaixar = maoAposBaixar.filter((c) => !idsProva.has(c.id));
  }

  // VULNERABILIDADE: com mesa vazia, a 1ª baixada precisa somar minimoAbertura.
  // Se o plano estrito não alcança, escala pro PERMISSIVO (usa curingas e todos
  // os jogos possíveis) pra tentar bater o mínimo; se nem assim, segura tudo.
  if (minimoAbertura > 0 && jogosMesaDupla.length === 0) {
    const somaJogos = (js) => js.reduce((t, j) => t + j.reduce((s, c) => s + pontosCarta(c), 0), 0);
    if (somaJogos(jogos) < minimoAbertura) {
      const permissivoVuln = agruparMao(aposExtender, true, permiteTrinca);
      if (somaJogos(permissivoVuln.jogos) >= minimoAbertura) {
        jogos = permissivoVuln.jogos;
        maoAposBaixar = descontar(aposExtender, jogos);
      } else {
        jogos = [];
        maoAposBaixar = aposExtender.slice();
      }
    }
  }

  const pegarMorto = decidirPegarMorto({ maoAposBaixar, mortoDisponivel });
  const bater = jaPegouMorto
    ? decidirBater({ mao, jogosMesaDupla, jaPegouMorto, permiteTrinca, bateComSuja: regras.bateComSuja }).deveBater
    : false;

  // FASE B1 (secao 16): classifica a fase da rodada com o contexto publico.
  const fase = classificarFase({ mao, jogosMesaDupla, mortoDisponivel, jaPegouMorto, minimoAbertura, ctx });

  let descarte = null;
  if (!bater && maoAposBaixar.length > 0) {
    const det = decidirDescarteDetalhado(maoAposBaixar, jogosAdversario, permiteTrinca, {
      fase,
      tamanhoLixo,
      minCartasOponente: ctx ? ctx.minCartasOponente : undefined,
      crencas: ctx ? ctx.crencas : null,
    });
    descarte = det.carta;
    if (descarte) { try { descarte.__reasons = det.reasons; } catch (e) {} }
  }

  const explic = explicarPlano(
    { compra, baixadas: jogos, pegarMorto, bater, descarte },
    { mao, jogosMesaDupla, minimoAbertura, modalidade },
    fase
  );
  if (ctx && ctx.crencas && ctx.crencas.resumo) explic.telemetria.beliefSummary = ctx.crencas.resumo;

  return { compra, extensoes, baixadas: jogos, pegarMorto, bater, descarte, fase, reasons: explic.reasons, telemetria: explic.telemetria };
}

/** Chave de agrupamento de um jogo pra evitar abrir DOIS que poderiam se juntar.
 *  Sequência: pelo NAIPE (duas do mesmo naipe podem conectar pelo meio depois).
 *  Trinca (todas as naturais do mesmo VALOR): pelo VALOR — duas trincas de valores
 *  diferentes (KKK e 777) são independentes e devem AMBAS ficar; só duas do mesmo
 *  valor competem. Sem isso, o key-por-naipe derrubava trincas por acaso. */
function chaveDoJogo(j) {
  const naturais = j.filter((c) => !c.eh_coringa);
  if (!naturais.length) return "so_curingas";
  const valores = new Set(naturais.map((c) => c.valor));
  if (valores.size === 1) return "trinca:" + naturais[0].valor; // grupo de valor igual
  return "naipe:" + naturais[0].naipe;                          // sequência
}

function umJogoPorNaipe(jogos) {
  const porChave = {};
  const resultado = [];
  for (const j of jogos) {
    const chave = chaveDoJogo(j);
    const atual = porChave[chave];
    if (!atual) { porChave[chave] = j; resultado.push(j); }
    else if (j.length > atual.length) {
      resultado[resultado.indexOf(atual)] = j;
      porChave[chave] = j;
    }
  }
  return resultado;
}

function descontar(mao, jogos) {
  const usados = new Set();
  jogos.forEach((j) => j.forEach((c) => usados.add(c.id)));
  return mao.filter((c) => !usados.has(c.id));
}

// ===========================================================================
// FASE B1 — HEURISTICA FORTE + ANTI-SABOTAGEM (Diretriz secoes 11,16,20,23,24,25,31)
// + FASE B2 — MOTOR DE CRENCAS v1 (secoes 12,14). Camada ADITIVA: nao substitui o
// planejarTurno ja testado; FORMALIZA aquele comportamento numa funcao de
// utilidade interpretavel, calcula MinDist-Buraco, classifica a fase, pontua o
// risco do descarte (agora tambem com CRENCAS sobre cartas ocultas) e ANOTA cada
// decisao com reasonCodes auditaveis. O RulesEngine (motor/jogo.js) segue como
// UNICA fonte de legalidade; nada aqui baixa/estende/descarta — so AVALIA e EXPLICA.
// Fronteira antifraude (secao 7): a camada de crencas so recebe INFORMACAO PUBLICA.
// ===========================================================================

var RC = {
  completeVulnerability: "completeVulnerability",
  takeDiscardHighValue: "takeDiscardHighValue",
  avoidDiscardGift: "avoidDiscardGift",
  preserveCleanCanasta: "preserveCleanCanasta",
  useWildToSecureMorto: "useWildToSecureMorto",
  preparePartnerGoOut: "preparePartnerGoOut",
  preventOpponentGoOut: "preventOpponentGoOut",
  reduceDeadwood: "reduceDeadwood",
  takeMorto: "takeMorto",
  goOutSecure: "goOutSecure",
  fallbackTimeout: "fallbackTimeout",
};

// Fase da rodada (secao 16)
function classificarFase({ mao, jogosMesaDupla, mortoDisponivel, jaPegouMorto, minimoAbertura, ctx }) {
  const c = ctx || {};
  const monteBaixo = typeof c.monteQtd === "number" && c.monteQtd <= 8;
  const oponentePoucas = typeof c.minCartasOponente === "number" && c.minCartasOponente <= 3;
  const maoEnxuta = (mao ? mao.length : 0) <= 6 && (jaPegouMorto || !mortoDisponivel);
  if (monteBaixo || oponentePoucas || maoEnxuta || c.algumApto) return "final";
  const naoAbriu = !jogosMesaDupla || jogosMesaDupla.length === 0;
  if (naoAbriu || minimoAbertura > 0) return "abertura";
  return "desenvolvimento";
}

// MinDist-Buraco (secao 11/25): distancia estrutural ate uma mao resolvida.
function minDistBuraco(mao, jogosMesaDupla, permiteTrinca) {
  var g = agruparMao(mao, true, permiteTrinca);
  var cardsOutsideMelds = g.sobra.length;
  var missingToExtend = 0, wildcardsCommitted = 0, immediateMeldPoints = 0;
  for (var i = 0; i < g.jogos.length; i++) {
    var j = g.jogos[i];
    immediateMeldPoints += j.reduce(function (s, c) { return s + pontosCarta(c); }, 0);
    var r = validarSequencia(j);
    if (r && r.valido) wildcardsCommitted += (r.qtd_curingas || 0);
    if (j.length >= 4 && j.length < MIN_CARTAS_CANASTRA) missingToExtend += (MIN_CARTAS_CANASTRA - j.length);
  }
  var deadwood = g.sobra.reduce(function (s, c) { return s + pontosCarta(c); }, 0);
  return cardsOutsideMelds * 1.0 + missingToExtend * 1.2 + wildcardsCommitted * 0.6 + deadwood * 0.05 - immediateMeldPoints * 0.02;
}

// Pesos da utilidade por fase (secao 25) — versionados num so lugar.
var PESOS_FASE = {
  abertura:        { scoreDelta: 0.6, structure: 1.3, mortoProgress: 1.5, cleanCanasta: 1.4, partnerSynergy: 1.2, deadwoodAfter: 0.6, discardRisk: 1.0, wildcardWaste: 1.2, opponentThreat: 0.7 },
  desenvolvimento: { scoreDelta: 0.9, structure: 1.0, mortoProgress: 1.2, cleanCanasta: 1.5, partnerSynergy: 1.3, deadwoodAfter: 0.9, discardRisk: 1.3, wildcardWaste: 1.1, opponentThreat: 1.0 },
  final:           { scoreDelta: 1.3, structure: 0.6, mortoProgress: 0.4, cleanCanasta: 1.1, partnerSynergy: 1.4, deadwoodAfter: 1.7, discardRisk: 1.8, wildcardWaste: 0.7, opponentThreat: 1.8 },
};
var BOT_CONFIG_VERSION = "b4.2-2026-07-31";

// U(action) — secao 25
function avaliarUtilidade(features, fase) {
  var w = PESOS_FASE[fase] || PESOS_FASE.desenvolvimento;
  var f = features || {};
  return w.scoreDelta * (f.scoreDelta || 0)
    + w.structure * (-(f.minDist || 0))
    + w.mortoProgress * (f.mortoProgress || 0)
    + w.cleanCanasta * (f.cleanCanastaValue || 0)
    + w.partnerSynergy * (f.partnerSynergy || 0)
    - w.deadwoodAfter * (f.deadwoodAfter || 0)
    - w.discardRisk * (f.discardRisk || 0)
    - w.wildcardWaste * (f.wildcardWaste || 0)
    - w.opponentThreat * (f.opponentThreat || 0);
}

// Risco do descarte (secao 23) — so informacao PUBLICA. Agora com CRENCAS (B2):
// alem de "estende jogo publico" e adjacencia, usa P(proximo oponente usa a carta).
function riscoDescarte(carta, mao, jogosAdversario, ctx, permiteTrinca) {
  if (carta.eh_coringa) return 999;
  var c = ctx || {};
  var risco = 0;
  var estendeAdv = jogosAdversario.some(function (j) { return podeEstenderJogo(j, carta, permiteTrinca); });
  if (estendeAdv) risco += 40;
  var adj = 0;
  for (var i = 0; i < jogosAdversario.length; i++) {
    for (var k = 0; k < jogosAdversario[i].length; k++) {
      var d = jogosAdversario[i][k];
      if (d.eh_coringa || carta.eh_coringa) continue;
      if (d.naipe === carta.naipe && Math.abs(idxValor(d.valor) - idxValor(carta.valor)) <= 2) adj++;
    }
  }
  risco += adj * 6;
  // B2 — pickupLikelihood por crenca (secao 12/14): prob de o proximo oponente
  // formar jogo com a carta usando cartas que ele PROVAVELMENTE tem (so publico).
  if (c.crencas && typeof c.crencas.pOponenteUsa === "function") {
    risco += c.crencas.pOponenteUsa(carta) * 0; // B4.1: crenca v1 nao ajuda o descarte heuristico (achado na suite de 50 testes, secao 12); peso 0 ate a rede treinada da B5. Infra + telemetria preservadas.
  }
  var pileSize = typeof c.tamanhoLixo === "number" ? c.tamanhoLixo : 1;
  risco += pileSize * 1.5;
  var endgame = (c.fase === "final") ? 1 : 0;
  var oponentePoucas = typeof c.minCartasOponente === "number" && c.minCartasOponente <= 3 ? 1 : 0;
  risco += (endgame + oponentePoucas) * 8 * (pontosCarta(carta) >= 10 ? 1.5 : 1);
  var solidao = vizinhos(mao, carta);
  if (solidao === 0) risco -= 10;
  risco -= pontosCarta(carta) * 0.1;
  return risco;
}

// Descarte DETALHADO (secao 23 + 31): mantem a selecao segura ja testada como
// ESPINHA e usa riscoDescarte (com crencas) como desempate fino.
function decidirDescarteDetalhado(mao, jogosAdversario, permiteTrinca, ctx) {
  jogosAdversario = jogosAdversario || [];
  var g = agruparMao(mao, true, permiteTrinca);
  var candidatas = g.sobra.length > 0 ? g.sobra : mao.slice();
  var semCuringa = candidatas.filter(function (c) { return !c.eh_coringa; });
  var pool = semCuringa.length > 0 ? semCuringa : candidatas;
  var ehPerigosa = function (carta) {
    return jogosAdversario.some(function (j) { return podeEstenderJogo(j, carta, permiteTrinca); });
  };
  var seguras = pool.filter(function (c) { return !ehPerigosa(c); });
  var evitouPresente = seguras.length > 0 && seguras.length < pool.length;
  if (seguras.length > 0) pool = seguras;
  var ordenada = pool.slice().sort(function (a, b) {
    var pa = pontosCarta(a), pb = pontosCarta(b);
    if (pa !== pb) return pa - pb;
    var ra = riscoDescarte(a, mao, jogosAdversario, ctx, permiteTrinca);
    var rb = riscoDescarte(b, mao, jogosAdversario, ctx, permiteTrinca);
    if (ra !== rb) return ra - rb;
    return vizinhos(mao, a) - vizinhos(mao, b);
  });
  var escolha = ordenada[0];
  var reasons = [];
  if (evitouPresente) reasons.push(RC.avoidDiscardGift);
  if (escolha && ctx && ctx.fase === "final") reasons.push(RC.preventOpponentGoOut);
  if (escolha) reasons.push(RC.reduceDeadwood);
  var featureValues = escolha ? {
    discardRisk: riscoDescarte(escolha, mao, jogosAdversario, ctx, permiteTrinca),
    discardPoints: pontosCarta(escolha),
    discardSolidao: vizinhos(mao, escolha),
  } : {};
  return { carta: escolha, reasons: reasons, featureValues: featureValues };
}

function explicarPlano(plano, entrada, fase) {
  var reasons = [];
  var regras = regrasDaModalidade(entrada.modalidade);
  if (plano.compra && plano.compra.origem === "lixo") reasons.push(RC.takeDiscardHighValue);
  if (entrada.minimoAbertura > 0 && plano.baixadas && plano.baixadas.length) reasons.push(RC.completeVulnerability);
  if (plano.pegarMorto) reasons.push(RC.takeMorto);
  if (plano.bater) reasons.push(RC.goOutSecure);
  var g = agruparMao(entrada.mao, false, regras.trinca);
  var curingaNaSobra = g.sobra.some(function (c) { return c.eh_coringa; });
  var temLimpaNaMesa = (entrada.jogosMesaDupla || []).some(function (m) {
    if (m.length < MIN_CARTAS_CANASTRA) return false;
    var r = validarSequencia(m); return r.valido && r.qtd_curingas === 0;
  });
  if (curingaNaSobra && temLimpaNaMesa) reasons.push(RC.preserveCleanCanasta);
  if (plano.descarte && plano.descarte.__reasons) {
    for (var i = 0; i < plano.descarte.__reasons.length; i++) reasons.push(plano.descarte.__reasons[i]);
  }
  var telemetria = {
    fase: fase,
    minDist: minDistBuraco(entrada.mao, entrada.jogosMesaDupla || [], regras.trinca),
    configVersion: BOT_CONFIG_VERSION,
  };
  var vistos = {}, out = [];
  for (var r2 = 0; r2 < reasons.length; r2++) { if (!vistos[reasons[r2]]) { vistos[reasons[r2]] = 1; out.push(reasons[r2]); } }
  return { reasons: out, telemetria: telemetria };
}

// ===========================================================================
// FASE B2 — MOTOR DE CRENCAS v1 (secao 12/14). Distribui a probabilidade das
// cartas OCULTAS a partir de informacao SO publica (secao 7 antifraude): mao
// propria, jogos das duas duplas, lixo visivel (integral no Aberto; so o topo nas
// outras), contagem de cartas do proximo oponente e tamanho do monte. NUNCA olha
// mao adversaria nem futuro do monte. v1 = crenca por contagem + fatores + suavizacao.
// ===========================================================================
function chaveCarta(c) { return c.valor === "JOKER" ? "JOKER" : (c.valor + "|" + c.naipe); }
function totalCopias(chave) { return chave === "JOKER" ? 4 : 2; }

function construirCrencas(pub) {
  var seen = {};
  var add = function (c) { var k = chaveCarta(c); seen[k] = (seen[k] || 0) + 1; };
  (pub.mao || []).forEach(add);
  (pub.jogosNos || []).forEach(function (j) { j.forEach(add); });
  (pub.jogosEles || []).forEach(function (j) { j.forEach(add); });
  (pub.lixoConhecido || []).forEach(add);
  var vistas = 0; for (var k0 in seen) vistas += seen[k0];
  var proxN = Math.max(0, pub.proxCartas || 0);
  var ocultasTotal = Math.max(proxN, 108 - vistas);
  var unseen = function (k) { return Math.max(0, totalCopias(k) - (seen[k] || 0)); };
  var frac = ocultasTotal > 0 ? Math.min(1, proxN / ocultasTotal) : 0;
  var pTem = function (k) { var u = unseen(k); if (u <= 0) return 0; return 1 - Math.pow(1 - frac, u); };
  var idx = function (v) { return ORDEM_SEQUENCIA.indexOf(v); };
  function pOponenteUsa(carta) {
    if (carta.eh_coringa) return 0.9;
    var naipe = carta.naipe, v = idx(carta.valor);
    var key = function (vv) { return (vv >= 0 && vv < ORDEM_SEQUENCIA.length) ? (ORDEM_SEQUENCIA[vv] + "|" + naipe) : null; };
    var pares = [[v - 2, v - 1], [v - 1, v + 1], [v + 1, v + 2]];
    var melhor = 0;
    for (var i = 0; i < pares.length; i++) {
      var ka = key(pares[i][0]), kb = key(pares[i][1]);
      if (!ka || !kb) continue;
      melhor = Math.max(melhor, pTem(ka) * pTem(kb));
    }
    if (pub.modalidade === "fechado") {
      var outros = ["copas", "ouros", "paus", "espadas"].filter(function (n) { return n !== naipe; });
      var pt = 0;
      for (var a = 0; a < outros.length; a++) for (var b = a + 1; b < outros.length; b++) {
        pt = Math.max(pt, pTem(carta.valor + "|" + outros[a]) * pTem(carta.valor + "|" + outros[b]));
      }
      melhor = Math.max(melhor, pt);
    }
    return melhor;
  }
  var resumo = { ocultas: ocultasTotal, proxCartas: proxN, fracProx: Number(frac.toFixed(3)) };
  return { pOponenteUsa: pOponenteUsa, pTem: pTem, resumo: resumo };
}

// --- Export universal: funciona tanto no Node (motor/testes) quanto no
// navegador (mockup). No Node usa module.exports; no browser expõe window.BotBuraco.
// A lógica acima é idêntica nos dois ambientes — fonte única de verdade. ---
(function (raiz, api) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    raiz.BotBuraco = api;
  }
})(typeof self !== "undefined" ? self : this, {
  pontosCarta,
  agruparMao,
  melhorCorrida,
  decidirCompra,
  provarUsoDoTopo,
  MODALIDADES,
  regrasDaModalidade,
  contarUteisDoLixo,
  avaliarLixoAberto,
  decidirDescarte,
  decidirPegarMorto,
  decidirBater,
  planejarExtensoes,
  planejarTurno,
  // --- Fase B1/B2 (aditivo) ---
  RC,
  classificarFase,
  minDistBuraco,
  avaliarUtilidade,
  PESOS_FASE,
  BOT_CONFIG_VERSION,
  riscoDescarte,
  decidirDescarteDetalhado,
  explicarPlano,
  construirCrencas,
});

  };

  __fabricas["jogo"] = function (module, exports, require) {
// motor/jogo.js — MOTOR DE JOGO "SEM TELA" (headless)
// A orquestração do Buraco que hoje vive no HTML (baralho, monte, mortos, lixo,
// turnos, contagem) extraída pra um módulo PURO, sem DOM. É a autoridade do jogo:
// roda no servidor (multiplayer) e é testável em Node. Reusa carta.js e canastra.js.
//
// Assentos (mesa 2v2): 0 e 2 = dupla "nos"; 1 e 3 = dupla "eles".
// Milestone 1 do MULTIPLAYER-PLANO.md. Esta 1ª parte: estado + distribuição +
// visão por assento. Próximo: aplicar jogadas (comprar/baixar/descartar/bater).

const { gerarBaralhoCompleto, embaralhar, criarJoker } = require("./carta");
const { validarJogo, validarSequencia } = require("./canastra");
const { provarUsoDoTopo } = require("./bot");

const CARTAS_POR_MAO = 11;
const CARTAS_POR_MORTO = 11;

/** A modalidade FECHADO libera as TRINCAS (grupos de valor igual) além das
 *  sequências (regra da Sônia, 19/jul). As outras modalidades só têm sequência. */
function permiteTrinca(jogo) {
  return jogo && jogo.modalidade === "fechado";
}
/** Valida um jogo respeitando a modalidade da mesa (sequência sempre; trinca só no
 *  fechado). Ponto único usado por baixar/estender/legalidade/classificação. */
function validarJogoMesa(jogo, cartas) {
  return validarJogo(cartas, { permiteTrinca: permiteTrinca(jogo) });
}

/** A dupla de um assento: 0 e 2 = "nos"; 1 e 3 = "eles". */
function duplaDoAssento(assento) {
  return assento % 2 === 0 ? "nos" : "eles";
}

/**
 * Cria um jogo novo já com a 1ª rodada distribuída.
 * @param {Object} opts
 * @param {Array}  opts.assentos - 4 posições: { tipo:"humano"|"bot", apelido }
 *                 (a dupla é derivada do índice; assento 0 é sempre quem "criou")
 * @param {string} [opts.modalidade="sbtl"]
 * @param {number} [opts.metaPontos=3000]
 */
function criarJogo({ assentos, modalidade = "sbtl", metaPontos = 3000 } = {}) {
  if (!assentos || assentos.length !== 4) {
    throw new Error("criarJogo exige exatamente 4 assentos");
  }
  const jogo = {
    modalidade,
    metaPontos,
    assentos: assentos.map((a, i) => ({
      tipo: a.tipo,                       // "humano" | "bot"
      apelido: a.apelido || (a.tipo === "bot" ? "Bot " + (i + 1) : "Jogador " + (i + 1)),
      dupla: duplaDoAssento(i),
      dificuldade: a.dificuldade,         // B4: nivel do bot (iniciante..expert); undefined = avancado
      substituto: a.substituto,           // B4: bot substituto de reconexao (secao 30)
    })),
    rodada: 0,
    placar: { nos: 0, eles: 0 },
    // VULNERABILIDADE (mesma regra da v111, motor/vulnerabilidade.js do mockup):
    // 0 = não vulnerável; 1 = vulnerável há 1 rodada (1ª baixada precisa somar
    // 75+ pontos); 2 = vulnerável há 2+ rodadas (90+). NÃO reseta por rodada —
    // só some numa partida nova.
    rodadasVulneravel: { nos: 0, eles: 0 },
    encerrada: false,        // partida encerrada (bateu a meta)
    // [PRODUTOR] Assento da batida que ENCERROU A PARTIDA (0..3), ou null se a
    // partida acabou sem batida. Diferente de `assentoQueBateu`, que é por
    // rodada e some na distribuição seguinte: este sobrevive porque é o fato
    // que o envelope de encerramento carrega.
    assentoQueBateuFinal: null,
    // campos por rodada (preenchidos em distribuirRodada):
    maos: null,
    monte: null,
    mortos: null,
    lixo: null,
    jogosDupla: null,
    mortoPego: null,
    vez: 0,
    jaComprou: false,
    rodadaEncerrada: false,
  };
  distribuirRodada(jogo);
  return jogo;
}

/** Embaralha e distribui uma rodada nova sobre `jogo` (muta o objeto). */
function distribuirRodada(jogo) {
  const comCuringao = jogo.modalidade !== "aberto"; // sbtl e fechado têm curingão
  const baralho = embaralhar(gerarBaralhoCompleto());
  // remove os jokers se a modalidade não usa curingão (gerar já inclui 4)
  const pool = comCuringao ? baralho : baralho.filter((c) => c.valor !== "JOKER");

  const maos = [[], [], [], []];
  for (let assento = 0; assento < 4; assento++) {
    maos[assento] = pool.splice(0, CARTAS_POR_MAO);
  }
  const mortos = [pool.splice(0, CARTAS_POR_MORTO), pool.splice(0, CARTAS_POR_MORTO)];

  jogo.rodada += 1;
  jogo.maos = maos;
  jogo.monte = pool;              // o que sobra é o monte de compra
  jogo.mortos = mortos;           // pilha compartilhada: 2 mortos
  jogo.lixo = [];                 // ninguém descartou ainda
  jogo.jogosDupla = { nos: [], eles: [] };
  jogo.mortoPego = { nos: false, eles: false };
  // ABERTURA VÁLIDA por dupla nesta rodada: vira true quando a dupla abre a mesa
  // (baixa o 1º jogo) cumprindo o mínimo de vulnerabilidade — ou já na 1ª baixada
  // se não estiver vulnerável. Usado pra saber se uma abertura fraca de dupla
  // vulnerável deve ser ANULADA (regra Sônia, 19/jul).
  jogo.abriuValido = { nos: false, eles: false };
  jogo.vez = 0;                   // a rodada começa no assento 0 (o criador)
  jaComprouReset(jogo);
  jogo.deveUsarTopo = null;       // trava "carta não tem mola" (comprou lixo)
  jogo.lixoCompradoNoTurno = null;
  jogo.turnosRodada = 0;          // válvula de segurança anti-livelock (ver passarVez)
  jogo.rodadaEncerrada = false;
  jogo.duplaQueBateu = null;
  // [PRODUTOR] Zerado junto da dupla, e pelo mesmo motivo: sem isto, a batida de
  // uma rodada intermediária ficaria pendurada no estado e seria lida, no fim da
  // partida, como se tivesse sido a batida final.
  //
  // `assentoQueBateuFinal` NÃO é zerado aqui de propósito: ele só existe quando
  // a partida acabou, e depois disso não se distribui rodada nenhuma.
  jogo.assentoQueBateu = null;
  jogo.pontosRodada = null;
  return jogo;
}

function jaComprouReset(jogo) {
  jogo.jaComprou = false;
}

/** Topo do lixo (última carta descartada), ou null. */
function topoLixo(jogo) {
  return jogo.lixo.length ? jogo.lixo[jogo.lixo.length - 1] : null;
}

/**
 * VISÃO de um assento: o que aquele jogador PODE ver. A própria mão vem inteira;
 * as mãos dos outros vêm só com a CONTAGEM (carta virada). Mais o estado público.
 * É isso que o servidor manda pra cada cliente (nunca a mão dos outros).
 */
function visaoDoAssento(jogo, assento) {
  return {
    voceAssento: assento,
    modalidade: jogo.modalidade,
    metaPontos: jogo.metaPontos,
    rodada: jogo.rodada,
    placar: jogo.placar,
    encerrada: jogo.encerrada,
    rodadaEncerrada: jogo.rodadaEncerrada,
    // quando rodadaEncerrada vira true, estes dois vêm preenchidos (até a próxima
    // distribuirRodada, que os zera de novo) — é o detalhe pra tela de contagem
    duplaQueBateu: jogo.duplaQueBateu,
    pontosRodada: jogo.pontosRodada,
    rodadasVulneravel: jogo.rodadasVulneravel, // pra tela mostrar o selo "vulnerável · precisa N+"
    vez: jogo.vez,
    suaVez: jogo.vez === assento,
    jaComprou: jogo.jaComprou,
    // se este assento comprou o lixo e ainda precisa usar a carta do TOPO antes
    // de descartar, aqui vai o id dela (o cliente destaca essa carta na mão)
    precisaUsarTopo: (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) ? jogo.deveUsarTopo.idTopo : null,
    suaMao: jogo.maos[assento],
    assentos: jogo.assentos.map((a, i) => ({
      apelido: a.apelido,
      tipo: a.tipo,
      dupla: a.dupla,
      qtdCartas: jogo.maos[i].length,   // dos outros só se vê a contagem
      ehVoce: i === assento,
    })),
    monteQtd: jogo.monte.length,
    lixoQtd: jogo.lixo.length,
    lixoTopo: topoLixo(jogo),
    // no ABERTO o lixo é PÚBLICO (espalhado à vista de todos) — manda o monte de
    // descarte inteiro; nas outras modalidades só o topo é visível (fica null).
    lixoAberto: jogo.modalidade === "aberto" ? jogo.lixo.slice() : null,
    mortosQtd: jogo.mortos.length,      // quantos mortos ainda não foram pegos
    mortoPego: jogo.mortoPego,
    jogosDupla: jogo.jogosDupla,        // jogos na mesa são públicos
  };
}

// ===========================================================================
// [PATCH ESPECTADOR] VISÃO PÚBLICA — o que quem ASSISTE pode ver.
//
// Contrato: `app/lib/motor/visao_espectador.dart` no repo do app
// (`VisaoEspectador.de` / `VisaoEspectador.segredos`). Esta é a contraparte
// Node da MESMA regra; a estrutura interna difere, a SUPERFÍCIE não.
//
// Por que uma função separada de `visaoDoAssento`, e não um `if (espectador)`
// lá dentro: o mapa abaixo é uma LISTA DE PERMISSÃO escrita à mão. Um campo
// secreto novo acrescentado ao assento não vaza para cá por descuido — ele
// simplesmente NÃO EXISTE nesta função. Num builder compartilhado com uma
// bandeira, o padrão se inverteria: o campo novo nasceria visível para quem
// assiste e alguém teria que lembrar de escondê-lo. Aqui, esquecer é omitir;
// lá, esquecer seria expor.
//
// Também não se constrói a visão de assento para depois DELETAR campos: o
// objeto do assento carrega referências vivas para `jogo.maos` e
// `jogo.jogosDupla`. Tudo aqui é CÓPIA — nenhum objeto mutável do jogo
// atravessa a fronteira.
// ===========================================================================

/** Carta em forma pública. Só é chamada sobre cartas JÁ à vista de todos
 *  (lixo e jogos baixados) — nunca sobre mão, monte ou morto. */
function cartaPublica(c) {
  return { id: c.id, naipe: c.naipe, valor: c.valor, coringa: !!c.eh_coringa };
}

function cartasPublicas(cs) {
  return cs.map(cartaPublica);
}

/** Mínimo que a dupla precisa somar para ABRIR (0 = não vulnerável ou já
 *  abriu). Espelha `checarAberturaVulneravel`: nível 1 → 75, nível 2 → 90. */
function minimoParaDescer(jogo, dupla) {
  if (jogo.abriuValido && jogo.abriuValido[dupla]) return 0;
  const niv = jogo.rodadasVulneravel[dupla];
  if (niv <= 0) return 0;
  return niv === 1 ? 75 : 90;
}

/**
 * TUDO o que é secreto para quem assiste: as QUATRO mãos, o monte e os mortos.
 *
 * É a diferença exata em relação ao assento, onde a própria mão é legítima.
 * Existe como função (e não só dentro do teste) porque é a definição que o
 * despacho consulta antes de mandar qualquer payload a um espectador — uma
 * segunda cópia dessa lista divergiria na primeira mudança de regra.
 */
function segredosDoEspectador(jogo) {
  const s = new Set();
  if (!jogo) return s;
  for (const mao of jogo.maos || []) for (const c of mao) s.add(c.id);
  for (const c of jogo.monte || []) s.add(c.id);
  for (const morto of jogo.mortos || []) for (const c of morto) s.add(c.id);
  return s;
}

/**
 * Ids secretos que escaparam para `visao`. Vazio = sem vazamento.
 *
 * Varre a estrutura INTEIRA — chaves, strings, listas, objetos aninhados — em
 * qualquer profundidade. Não procura por nomes de campo conhecidos (`mao` e
 * companhia): procura pelos IDS. Assim o vazamento é detectado mesmo que o
 * segredo apareça sob `dados.x.y.z.valor` ou sob uma chave inventada amanhã.
 */
function vazamentosNaVisao(visao, segredos) {
  const achados = new Set();
  const vistos = new Set();
  (function varrer(no) {
    if (no == null) return;
    if (typeof no === "string") {
      if (segredos.has(no)) achados.add(no);
      return;
    }
    if (typeof no !== "object") return;
    if (vistos.has(no)) return; // ciclos
    vistos.add(no);
    if (Array.isArray(no)) {
      for (const item of no) varrer(item);
      return;
    }
    for (const chave of Object.keys(no)) {
      if (segredos.has(chave)) achados.add(chave); // segredo usado como CHAVE
      varrer(no[chave]);
    }
  })(visao);
  return achados;
}

/**
 * Monta a visão de quem ASSISTE. Não recebe assento: espectador não ocupa
 * nenhum, não tem mão, não tem parceiro e não tem vez.
 *
 * A regra é mais estreita que a do assento: vê SOMENTE o que está na mesa
 * — lixo, jogos baixados, placar, de quem é a vez — e a CONTAGEM do que está
 * oculto. A contagem não é vazamento pelo mesmo motivo que vale para o
 * assento: quantas cartas cada um tem é o que qualquer pessoa em volta da
 * mesa real conta com os olhos.
 */
function visaoDoEspectador(jogo) {
  return {
    // Marca o recorte. Cliente e servidor podem AFIRMAR qual visão receberam,
    // em vez de inferir pela ausência de campos.
    espectador: true,
    voceAssento: null,

    // ---- mesa ----
    modalidade: jogo.modalidade,
    metaPontos: jogo.metaPontos,
    rodada: jogo.rodada,

    // ---- turno (de quem é a vez é público; `suaVez` não existe: não há "você") ----
    vez: jogo.vez,
    jaComprou: jogo.jaComprou,
    rodadaEncerrada: jogo.rodadaEncerrada,
    encerrada: jogo.encerrada,

    // ---- quem está na mesa (público: apelido, tipo, dupla, contagem) ----
    assentos: jogo.assentos.map((a, i) => ({
      apelido: a.apelido,
      tipo: a.tipo,
      dupla: a.dupla,
      qtdCartas: jogo.maos[i].length,
    })),

    // ---- o que está na mesa, à vista de todos ----
    // O lixo é pilha aberta no ABERTO (todo mundo leu o que passou por ela);
    // nas outras modalidades só o TOPO é visível. Os jogos baixados são
    // públicos em qualquer modalidade.
    lixoTopo: jogo.lixo.length ? cartaPublica(jogo.lixo[jogo.lixo.length - 1]) : null,
    lixoAberto: jogo.modalidade === "aberto" ? cartasPublicas(jogo.lixo) : null,
    jogosNos: jogo.jogosDupla.nos.map(cartasPublicas),
    jogosEles: jogo.jogosDupla.eles.map(cartasPublicas),

    // ---- o que está oculto: SÓ A CONTAGEM ----
    qtdCartasPorAssento: jogo.maos.map((m) => m.length),
    monteQtd: jogo.monte.length,
    lixoQtd: jogo.lixo.length,
    mortosQtd: jogo.mortos.length,
    mortosTamanhos: jogo.mortos.map((m) => m.length),
    mortoPegoNos: !!jogo.mortoPego.nos,
    mortoPegoEles: !!jogo.mortoPego.eles,

    // ---- pendência do topo: o FATO, nunca o id ----
    // Que alguém comprou o lixo e está devendo o topo é público — todo mundo
    // viu. QUAL é a carta, não: ela está na mão de quem comprou. O assento
    // dono recebe `precisaUsarTopo`; aqui esse campo não existe.
    obrigacaoTopoPendente: !!jogo.deveUsarTopo,

    // ---- placar e vulnerabilidade, pelas DUAS duplas ----
    // No assento estes campos são relativos ("minha dupla"). Sem assento, a
    // forma correta é nomear as duas.
    placarNos: jogo.placar.nos,
    placarEles: jogo.placar.eles,
    rodadasVulneravelNos: jogo.rodadasVulneravel.nos,
    rodadasVulneravelEles: jogo.rodadasVulneravel.eles,
    minimoParaDescerNos: minimoParaDescer(jogo, "nos"),
    minimoParaDescerEles: minimoParaDescer(jogo, "eles"),
    vulneravelNos: minimoParaDescer(jogo, "nos") > 0,
    vulneravelEles: minimoParaDescer(jogo, "eles") > 0,

    // ---- desfecho ----
    // `pontosRodada` só existe depois da rodada apurada e carrega AGREGADOS
    // (total, bônus, desconto de mão como NÚMERO, contadores de canastra) —
    // nenhum id de carta. Quem garante isso é o teste, não este comentário.
    duplaQueBateu: jogo.duplaQueBateu,
    pontosRodada: jogo.pontosRodada
      ? JSON.parse(JSON.stringify(jogo.pontosRodada))
      : null,
  };
}

// ===========================================================================
// JOGADAS — cada função valida e MUTA o jogo. Retorna { ok:true, ... } ou
// { ok:false, erro:"..." }. É a autoridade: o servidor confia só nisto.
// Fluxo do turno: 1 COMPRA (monte ou lixo) -> baixar/estender à vontade ->
// 1 DESCARTE (encerra a vez). O descarte que zera a mão pega o morto / bate.
// ===========================================================================

/** Acha o índice de uma carta (por id) na mão de um assento; -1 se não tiver. */
function idxNaMao(jogo, assento, idCarta) {
  return jogo.maos[assento].findIndex((c) => c.id === idCarta);
}

/** Valida que é a vez do assento e o estado de compra. */
function validarVez(jogo, assento, { precisaComprar, precisaTerComprado } = {}) {
  if (jogo.encerrada) return { ok: false, erro: "a partida já terminou" };
  if (jogo.rodadaEncerrada) return { ok: false, erro: "a rodada já terminou" };
  if (jogo.vez !== assento) return { ok: false, erro: "não é a sua vez" };
  if (precisaComprar && jogo.jaComprou) return { ok: false, erro: "você já comprou nesta jogada" };
  if (precisaTerComprado && !jogo.jaComprou) return { ok: false, erro: "compre uma carta antes de baixar/descartar" };
  return { ok: true };
}

/** COMPRA do monte. Se o monte esgotar, repõe com um morto; sem morto, a rodada
 *  encerra por esgotamento (mesma regra da mesa/HTML, v108). */
function comprarMonte(jogo, assento) {
  const v = validarVez(jogo, assento, { precisaComprar: true });
  if (!v.ok) return v;
  if (jogo.monte.length === 0) {
    if (jogo.mortos.length > 0) {
      jogo.monte = jogo.mortos.shift(); // o morto do topo vira o novo monte
    } else {
      encerrarRodadaPorEsgotamento(jogo);
      return { ok: false, erro: "monte e mortos esgotados — rodada encerrada" };
    }
  }
  const carta = jogo.monte.shift();
  jogo.maos[assento].push(carta);
  jogo.jaComprou = true;
  jogo.lixoCompradoNoTurno = null; // comprou do monte: nada de lixo pra devolver num foul
  return { ok: true, carta };
}

/** BAIXAR um jogo NOVO na mesa (cartas por id, tiradas da mão). Valida a
 *  sequência com o canastra.js. */
function baixar(jogo, assento, idsCartas) {
  const v = validarVez(jogo, assento, { precisaTerComprado: true });
  if (!v.ok) return v;
  if (!idsCartas || idsCartas.length < 3) return { ok: false, erro: "um jogo tem no mínimo 3 cartas" };
  const cartas = [];
  for (const id of idsCartas) {
    const idx = idxNaMao(jogo, assento, id);
    if (idx === -1) return { ok: false, erro: "carta " + id + " não está na sua mão" };
    cartas.push(jogo.maos[assento][idx]);
  }
  const res = validarJogoMesa(jogo, cartas);
  if (!res.valido) return { ok: false, erro: res.motivo || "jogo inválido" };
  const dupla = duplaDoAssento(assento);
  // TRAVA do "clássico erro" (Sônia): não deixa baixar se sobraria ≤1 carta impossível
  // de descartar (sem limpa pra bater e sem morto). meldsFuturos inclui o jogo novo.
  const maoRestBaixar = jogo.maos[assento].length - cartas.length;
  if (baixadaTravaria(jogo, dupla, maoRestBaixar, jogo.jogosDupla[dupla].concat([cartas]))) {
    return { ok: false, erro: ERRO_TRAVARIA };
  }
  // VULNERABILIDADE: a regra é HONRA, igual à mesa presencial e à v111 local — o
  // motor NÃO bloqueia o humano. O selo "vulnerável · precisa 75+" (na tela) é só
  // lembrete; a pessoa monta a abertura como quiser, inclusive juntando VÁRIOS
  // jogos no mesmo turno pra somar o mínimo (um jogo de 60 + outro de 20 = 80 é
  // abertura válida — bloquear cada jogo isolado impediria isso, foi o bug que a
  // Sônia pegou em 18/jul). Os BOTS seguem a regra sozinhos: o cérebro
  // (motor/bot.js) recebe `minimoAbertura` do bot_motor.js e não abre fraco.
  // remove da mão e baixa na mesa da dupla
  const ids = new Set(idsCartas);
  jogo.maos[assento] = jogo.maos[assento].filter((c) => !ids.has(c.id));
  jogo.jogosDupla[dupla].push(cartas);
  quitarTravaTopoSePreciso(jogo, assento, ids);
  return Object.assign({ ok: true, tipo: res.tipo }, aoZerarMaoBaixando(jogo, assento));
}

/** Se o jogador comprou o lixo (deveUsarTopo) e o topo acabou de ir pra mesa,
 *  libera a trava — agora ele já pode descartar (cumpriu "carta não tem mola"). */
function quitarTravaTopoSePreciso(jogo, assento, idsSet) {
  if (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento && idsSet.has(jogo.deveUsarTopo.idTopo)) {
    jogo.deveUsarTopo = null;
  }
}

/** BATIDA DIRETA: a mão zerou baixando/estendendo (não descartando). Espelha o
 *  que `descartar` já faz quando a mão zera lá — só que aqui o turno CONTINUA
 *  (a pessoa comprou, pode seguir baixando/estendendo e só encerra a vez no
 *  descarte). Sem isto, zerar a mão baixando deixava o jogador sem carta pra
 *  descartar e sem jeito de continuar (achado no playtest real da Sônia,
 *  17/jul — "batida direta, jogo não encerrou"). Se não pegar morto nem tiver
 *  canastra limpa pra bater final, não há nada a fazer aqui — mesma lacuna que
 *  já existia na v111 local (`aoZerarMaoBaixando`), fica como está por ora. */
function aoZerarMaoBaixando(jogo, assento) {
  if (jogo.maos[assento].length !== 0) return null;
  const dupla = duplaDoAssento(assento);
  if (!jogo.mortoPego[dupla] && jogo.mortos.length > 0) {
    jogo.maos[assento] = jogo.mortos.shift();
    jogo.mortoPego[dupla] = true;
    return { pegouMorto: true };
  }
  if (duplaPodeBater(jogo, dupla)) {
    // [PRODUTOR] BATIDA DIRETA (mão zerou baixando). O assento vai junto, e só
    // chega aqui depois de `duplaPodeBater` — a canastra exigida pela
    // modalidade — e depois de esgotado o morto da dupla, logo acima.
    encerrarRodada(jogo, dupla, assento);
    return { bateu: true };
  }
  return null;
}

/** ESTENDER um jogo já na mesa da própria dupla, com cartas da mão. */
function estender(jogo, assento, indiceJogo, idsCartas) {
  const v = validarVez(jogo, assento, { precisaTerComprado: true });
  if (!v.ok) return v;
  const dupla = duplaDoAssento(assento);
  const jogos = jogo.jogosDupla[dupla];
  const alvo = jogos[indiceJogo];
  if (!alvo) return { ok: false, erro: "jogo " + indiceJogo + " não existe na sua mesa" };
  if (!idsCartas || !idsCartas.length) return { ok: false, erro: "nenhuma carta pra estender" };
  const cartas = [];
  for (const id of idsCartas) {
    const idx = idxNaMao(jogo, assento, id);
    if (idx === -1) return { ok: false, erro: "carta " + id + " não está na sua mão" };
    cartas.push(jogo.maos[assento][idx]);
  }
  const res = validarJogoMesa(jogo, alvo.concat(cartas));
  if (!res.valido) return { ok: false, erro: res.motivo || "extensão inválida" };
  // TRAVA do "clássico erro" (Sônia): não estende se sobraria ≤1 carta impossível de
  // descartar. meldsFuturos = jogos da dupla com o alvo já estendido.
  const maoRestEstender = jogo.maos[assento].length - cartas.length;
  const meldsFuturos = jogos.map((m, i) => (i === indiceJogo ? alvo.concat(cartas) : m));
  if (baixadaTravaria(jogo, dupla, maoRestEstender, meldsFuturos)) {
    return { ok: false, erro: ERRO_TRAVARIA };
  }
  const ids = new Set(idsCartas);
  jogo.maos[assento] = jogo.maos[assento].filter((c) => !ids.has(c.id));
  jogos[indiceJogo] = alvo.concat(cartas);
  quitarTravaTopoSePreciso(jogo, assento, ids);
  return Object.assign({ ok: true, tipo: res.tipo }, aoZerarMaoBaixando(jogo, assento));
}

/** LEGALIDADE do "carta não tem mola" (visão do HUMANO): o topo tem ALGUM uso
 *  imediato? — estende um jogo (sozinho, com 1 OU com 2 cartas da mão) OU forma um
 *  jogo novo com 2 cartas da mão (inclui curinga fazendo a ponte, ex.: A-[Joker]-3).
 *  Mais permissivo que o provarUsoDoTopo do bot (que tem travas ESTRATÉGICAS, tipo
 *  só gastar curinga com lixo grande): legalidade ≠ estratégia. Uma pessoa que
 *  decidiu pegar o lixo não pode ser proibida de fazer uma jogada válida.
 *
 *  O caso do "topo + 2 cartas ESTENDENDO um jogo" cobre a reorganização com
 *  curinga (achado da Sônia, 18/jul): num jogo 7-8-[2=9]-10-J, ela põe o 9 REAL
 *  (libera o 2 curinga), o 2 vira o 6, e aí o 4♥ do topo + o 5♥ da mão descem —
 *  4-5-6-7-8-9-10-J. O motor precisa enxergar esse uso (topo + 5♥ + 9♥) pra
 *  liberar a pega do lixo; antes só testava topo + 1 carta e recusava. */
function topoTemUsoLegal(jogo, assento, topo) {
  const mao = jogo.maos[assento];
  const jogos = jogo.jogosDupla[duplaDoAssento(assento)];
  const cand = mao.filter((c) => c.id !== topo.id);
  // 1) topo estende um jogo existente — sozinho, com 1, ou com 2 cartas da mão
  //    (o "com 2" é o que permite a reorganização de curinga acima)
  for (const meld of jogos) {
    if (validarJogoMesa(jogo, meld.concat([topo])).valido) return true;
    for (let a = 0; a < cand.length; a++) {
      if (validarJogoMesa(jogo, meld.concat([topo, cand[a]])).valido) return true;
      for (let b = a + 1; b < cand.length; b++) {
        if (validarJogoMesa(jogo, meld.concat([topo, cand[a], cand[b]])).valido) return true;
      }
    }
  }
  // 2) topo + 2 cartas da mão formam um jogo novo (naturais e/ou curinga)
  for (let a = 0; a < cand.length; a++) {
    for (let b = a + 1; b < cand.length; b++) {
      if (validarJogoMesa(jogo, [topo, cand[a], cand[b]]).valido) return true;
    }
  }
  return false;
}

/** COMPRAR O LIXO INTEIRO. No SBTL/Fechado (compra justificada) o TOPO precisa
 *  ter uso imediato — "carta não tem mola" (legalidade via topoTemUsoLegal).
 *  Leva o lixo todo pra mão e liga a trava deveUsarTopo (só solta quando o topo
 *  for baixado/estendido; até lá não pode descartar). */
function comprarLixo(jogo, assento) {
  const v = validarVez(jogo, assento, { precisaComprar: true });
  if (!v.ok) return v;
  if (jogo.lixo.length === 0) return { ok: false, erro: "o lixo está vazio" };
  const topo = topoLixo(jogo);
  if (jogo.modalidade !== "aberto") {
    if (!topoTemUsoLegal(jogo, assento, topo)) {
      return { ok: false, erro: "o topo do lixo não tem uso imediato (carta não tem mola)" };
    }
    jogo.deveUsarTopo = { assento, idTopo: topo.id };
  }
  const qtd = jogo.lixo.length;
  // guarda as cartas do lixo compradas nesta vez — se der FOUL de abertura vulnerável,
  // elas VOLTAM pro lixo (regra Sônia 19/jul: "se comprou o lixo, volta pro lixo").
  jogo.lixoCompradoNoTurno = jogo.lixo.slice();
  jogo.maos[assento] = jogo.maos[assento].concat(jogo.lixo);
  jogo.lixo = [];
  jogo.jaComprou = true;
  return { ok: true, qtd, topo };
}

/** FOUL de ABERTURA VULNERÁVEL (regra Sônia, 19/jul, "regra do buraco de mesa"):
 *  quando a dupla está vulnerável, a ABERTURA da mesa (o 1º jogo da rodada, podendo
 *  ser vários jogos no mesmo turno) precisa somar o mínimo NO TOTAL — 75 no nível 1,
 *  90 no nível 2. Se abrir ABAIXO disso, a abertura é ANULADA no fim do turno: as
 *  cartas voltam pra mão de quem baixou e a vulnerabilidade escala pro nível 2 (90+).
 *  [PATCH CRIT-03] Vale para HUMANO **e** BOT (mesma legalidade): o gate +75/+90 é
 *  aplicado uniformemente. A estratégia do bot pode escolher não tentar abrir fraco,
 *  mas o motor valida e recusa/anula a abertura ilegal de qualquer assento. Quando a
 *  abertura é válida (ou a dupla não é vulnerável), marca `abriuValido` pra não
 *  checar de novo nas baixadas seguintes da rodada. Retorna {total, min} no foul,
 *  ou null se está tudo certo. */
function checarAberturaVulneravel(jogo, assento) {
  const dupla = duplaDoAssento(assento);
  if (jogo.abriuValido[dupla]) return null;                 // já abriu válido nesta rodada
  const melds = jogo.jogosDupla[dupla];
  if (melds.length === 0) return null;                      // não abriu (mesa da dupla vazia)
  const niv = jogo.rodadasVulneravel[dupla];
  if (niv <= 0) { jogo.abriuValido[dupla] = true; return null; } // não vulnerável: abriu ok
  const min = niv === 1 ? 75 : 90;
  const total = melds.reduce((s, m) => s + m.reduce((t, c) => t + valorCarta(c), 0), 0);
  if (total >= min) { jogo.abriuValido[dupla] = true; return null; } // abertura válida
  // [PATCH CRIT-03] Vulnerabilidade UNIFORME bot=humano: o gate +75/+90 vale para
  // TODOS os assentos. (Antes o motor isentava bots: `if (tipo !== "humano") ...`.)
  // A estratégia do bot decide o que TENTAR; o motor valida e recusa o ilegal.
  // FOUL — anula a abertura fraca (bot ou humano):
  // 1) tudo o que baixou volta pra mão
  for (const meld of melds) jogo.maos[assento].push(...meld);
  jogo.jogosDupla[dupla] = [];
  // 2) se COMPROU o lixo nesta vez, o lixo VOLTA pro lixo (regra Sônia 19/jul):
  //    tira as cartas do lixo de volta da mão e reconstrói o monte de descarte, e
  //    "destrava" a compra pra a pessoa refazer a vez do zero (comprar de novo).
  let lixoVoltou = false;
  if (jogo.lixoCompradoNoTurno && jogo.lixoCompradoNoTurno.length) {
    const idsLixo = new Set(jogo.lixoCompradoNoTurno.map((c) => c.id));
    jogo.maos[assento] = jogo.maos[assento].filter((c) => !idsLixo.has(c.id));
    jogo.lixo = jogo.lixoCompradoNoTurno.slice();
    jogo.lixoCompradoNoTurno = null;
    jogo.jaComprou = false;                                 // vez reiniciada: compra de novo
    lixoVoltou = true;
  }
  jogo.rodadasVulneravel[dupla] = 2;                        // penalidade: escala pra 90+
  jogo.deveUsarTopo = null;                                 // a trava do topo cai (abertura desfeita)
  return { total, min, lixoVoltou };
}

/** DESCARTAR uma carta (encerra a vez). Se zerar a mão, pega o morto (se houver
 *  e a dupla ainda não pegou) e a rodada segue; sem morto, encerra a rodada. */
function descartar(jogo, assento, idCarta) {
  const v = validarVez(jogo, assento, { precisaTerComprado: true });
  if (!v.ok) return v;
  // trava "carta não tem mola": comprou o lixo e ainda não desceu o topo
  if (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) {
    return { ok: false, erro: "você comprou o lixo — precisa usar a carta do topo antes de descartar" };
  }
  // FOUL de abertura vulnerável: anula a abertura fraca ANTES de descartar (as
  // cartas já voltaram pra mão dentro do checar). Recusa o descarte pra a pessoa
  // refazer com as cartas de volta.
  const foul = checarAberturaVulneravel(jogo, assento);
  if (foul) {
    const extra = foul.lixoVoltou
      ? " O lixo que você comprou voltou pro monte de descarte — pode comprar de novo."
      : "";
    return { ok: false, erro: "desceu " + foul.total + " (abaixo de " + foul.min + ") — abertura ANULADA. As cartas voltaram pra sua mão; agora tem que descer 90+." + extra };
  }
  const idx = idxNaMao(jogo, assento, idCarta);
  if (idx === -1) return { ok: false, erro: "carta não está na sua mão" };

  const dupla = duplaDoAssento(assento);
  const zeraria = jogo.maos[assento].length === 1; // essa é a última carta
  const podeBatidaFinal = jogo.mortoPego[dupla] || jogo.mortos.length === 0;

  // Se o descarte ZERA a mão e não há morto pra pegar, é BATIDA FINAL — que exige
  // uma canastra. No FECHADO vale QUALQUER canastra (até suja, regra do print da
  // Sônia 19/jul); no aberto/STBL só LIMPA. Sem canastra válida, o descarte é
  // ILEGAL (segura a carta).
  if (zeraria && podeBatidaFinal && !duplaPodeBater(jogo, dupla)) {
    const exig = bateComSuja(jogo) ? "uma CANASTRA (pode ser suja)" : "uma canastra LIMPA";
    return { ok: false, erro: "pra bater você precisa de " + exig + " na mesa da dupla" };
  }

  const carta = jogo.maos[assento].splice(idx, 1)[0];
  jogo.lixo.push(carta);

  if (jogo.maos[assento].length === 0) {
    if (!jogo.mortoPego[dupla] && jogo.mortos.length > 0) {
      // batida INDIRETA: pega o morto e só joga na próxima vez
      jogo.maos[assento] = jogo.mortos.shift();
      jogo.mortoPego[dupla] = true;
      passarVez(jogo);
      return { ok: true, descarte: carta, pegouMorto: true };
    }
    // BATIDA FINAL (tem limpa, garantido pela checagem acima) — encerra a rodada.
    // [PRODUTOR] O assento acompanha: a checagem `podeBatidaFinal` +
    // `duplaPodeBater` já rodou antes do descarte ser aceito, então chegar aqui
    // com este assento É a prova de que a batida dele foi legal.
    encerrarRodada(jogo, dupla, assento);
    return { ok: true, descarte: carta, bateu: true };
  }
  passarVez(jogo);
  return { ok: true, descarte: carta };
}

/** A dupla tem alguma canastra LIMPA (limpa/de_500/de_ás) na mesa? (libera a batida)
 *  IMPORTANTE (regra Sônia 19/jul): TRINCA NÃO forma canastra — então a checagem usa
 *  `validarSequencia` (que RECUSA grupos de valor igual como Reis/7). Só canastra de
 *  SEQUÊNCIA (e as tradicionais de ás / de curinga) conta pra bater. */
function duplaTemCanastraLimpa(jogo, dupla) {
  return jogo.jogosDupla[dupla].some((meld) => {
    if (meld.length < 7) return false;
    const res = validarSequencia(meld);
    // Ás NÃO forma canastra de ás na casa da Sônia (vale só valor de carta) — só
    // canastra de SEQUÊNCIA limpa (ou a de 500/1000) libera a batida.
    return res.valido && (res.tipo === "limpa" || res.tipo === "de_500" || res.tipo === "as_a_as"); // [PATCH CRIT-02]
  });
}

/** No FECHADO a batida final aceita canastra SUJA (regra do print da Sônia, 19/jul:
 *  "Só bate com canastra limpa?" → Fechado NÃO). Aberto/STBL só batem com limpa. */
function bateComSuja(jogo) {
  return jogo.modalidade === "fechado";
}

/** A dupla tem uma canastra que LIBERA a batida? No fechado vale limpa OU suja; nas
 *  outras só LIMPA. Em TODAS, TRINCA não conta (não é canastra) — usa validarSequencia. */
function duplaPodeBater(jogo, dupla) {
  const aceitaSuja = bateComSuja(jogo);
  return jogo.jogosDupla[dupla].some((meld) => {
    if (meld.length < 7) return false;
    const res = validarSequencia(meld); // trinca de valor igual é RECUSADA aqui de propósito
    if (!res.valido) return false;
    if (res.tipo === "limpa" || res.tipo === "de_500" || res.tipo === "as_a_as") return true; // [PATCH CRIT-02] ás não conta (só valor de carta)
    return aceitaSuja && res.tipo === "suja";
  });
}

/** A baixada/extensão deixaria o jogador PRESO? — o "clássico erro" (Sônia): ele
 *  ficaria com ≤1 carta e SEM conseguir encerrar o turno — não bate (sem canastra
 *  LIMPA) nem pega o morto (batida indireta). Com 2+ cartas nunca trava (descarta 1,
 *  sobra 1). `meldsFuturos` = os jogos da dupla DEPOIS da baixada (pra enxergar uma
 *  limpa recém-criada). Bloqueia ANTES de baixar pra a pessoa não cavar o próprio buraco. */
function baixadaTravaria(jogo, dupla, maoRestante, meldsFuturos) {
  if (maoRestante >= 2) return false;
  const temLimpa = meldsFuturos.some((m) => {
    if (m.length < 7) return false;
    const r = validarSequencia(m);
    return r.valido && (r.tipo === "limpa" || r.tipo === "de_500" || r.tipo === "as_a_as"); // [PATCH CRIT-02]
  });
  const mortoDisp = !jogo.mortoPego[dupla] && jogo.mortos.length > 0;
  return !(temLimpa || mortoDisp);
}
const ERRO_TRAVARIA = "não dá pra baixar isso: você ficaria com uma carta que não pode descartar (sem canastra LIMPA pra bater e sem morto pra pegar). Segure pelo menos uma carta a mais.";

// Válvula de segurança: número máximo de viradas de vez numa rodada. Uma rodada
// real termina em ~40-60 turnos; o teto (600, ~10x) só existe pra GARANTIR o fim
// mesmo num livelock teórico (ex.: no ABERTO, 4 BOTS ficando um jogando o lixo de
// 1 carta pro outro sem nunca comprar do monte — não acontece com humano na mesa,
// mas trava um scan all-bot). Ao estourar, encerra a rodada por esgotamento.
const MAX_TURNOS_RODADA = 600;

/** Passa a vez pro próximo assento. Se ninguém puder comprar (monte E mortos
 *  esgotados), encerra a rodada na hora (regra Sônia v108). */
function passarVez(jogo) {
  jogo.turnosRodada = (jogo.turnosRodada || 0) + 1;
  if (jogo.turnosRodada > MAX_TURNOS_RODADA) {
    encerrarRodadaPorEsgotamento(jogo);
    return;
  }
  if (jogo.monte.length === 0) {
    if (jogo.mortos.length === 0) {
      encerrarRodadaPorEsgotamento(jogo);
      return;
    }
    // MONTE ZEROU mas ainda há morto: o morto do topo vira o NOVO MONTE JÁ, na
    // virada da vez (Print 1 da Sônia, 18/jul: antes ficava monte=0 com um morto
    // parado até alguém clicar, parecendo travado). A vez de quem jogou já
    // acabou — se ela ia bater pegando esse morto, isso aconteceu ANTES do
    // passa-vez (no descarte/baixada); então nenhuma batida se perde aqui.
    jogo.monte = jogo.mortos.shift();
  }
  jogo.vez = (jogo.vez + 1) % 4;
  jogo.jaComprou = false;
  jogo.deveUsarTopo = null; // a trava do topo é por-turno
  jogo.lixoCompradoNoTurno = null; // fim de turno: nada mais pra devolver
}

function encerrarRodadaPorEsgotamento(jogo) {
  encerrarRodada(jogo, null);
}

/** Encerra a rodada, conta os pontos das duas duplas e soma no placar. Se
 *  alguma dupla bateu a meta, a PARTIDA encerra. `duplaQueBateu` = "nos"|"eles"
 *  (bônus de batida) ou null (esgotamento).
 *
 *  [PRODUTOR] `assentoQueBateu` = 0..3 de QUEM bateu, ou null quando a rodada
 *  acabou sem batida (baralho esgotado). Os dois caminhos de batida já tinham o
 *  assento em escopo e o descartavam aqui — a dupla não identifica a pessoa, e
 *  perguntas individuais ("foi você quem bateu?") não têm resposta a partir do
 *  lado. Deduzir premiaria o parceiro que não bateu.
 *
 *  É PROVA DE LEGALIDADE, e não só de autoria: o assento só chega até aqui
 *  depois de o caminho chamador ter aprovado a batida pela regra da modalidade
 *  (`duplaPodeBater`) e pelo morto da dupla. Por isso não existe — e não deve
 *  passar a existir — um booleano `batidaLegal` ao lado: seria um segundo lugar
 *  onde a mesma verdade poderia divergir.
 *
 *  `assentoQueBateuFinal` é gravado SÓ quando esta rodada encerra a PARTIDA. É
 *  o que separa "bateu numa rodada" de "bateu a rodada que acabou com o jogo" —
 *  e uma rodada intermediária nunca o preenche. */
function encerrarRodada(jogo, duplaQueBateu, assentoQueBateu = null) {
  if (jogo.rodadaEncerrada) return; // idempotente
  jogo.rodadaEncerrada = true;
  jogo.duplaQueBateu = duplaQueBateu;
  jogo.assentoQueBateu = Number.isInteger(assentoQueBateu) ? assentoQueBateu : null;
  contarPontos(jogo);
  // DEPOIS da contagem, porque é ela que decide se a meta caiu. Antes disso não
  // se sabe se esta rodada foi a última.
  if (jogo.encerrada && jogo.assentoQueBateuFinal == null) {
    jogo.assentoQueBateuFinal = jogo.assentoQueBateu;
  }
}

/** Valor de cada carta na CONTAGEM (idêntico ao HTML): JOKER=50, Ás=15,
 *  8..K e 2 = 10, 3..7 = 5. */
function valorCarta(c) {
  if (c.valor === "JOKER") return 50;
  if (c.valor === "A") return 15;
  if (["8", "9", "10", "J", "Q", "K", "2"].includes(c.valor)) return 10;
  return 5; // 3 a 7
}

/** Pontos de UMA dupla nesta rodada (mesmíssima fórmula do pontuarDupla do HTML):
 *  canastras (de_500=500 / limpa=200 / suja=100) + cartas baixadas + bônus de
 *  batida (+100) − cartas na mão − morto não pego (−100). */
function pontuarDuplaJogo(jogo, dupla, { bateu, mortoPego, cartasNaMao, algumPegouMorto }) {
  let pontosCanastras = 0, pontosCartas = 0;
  const detalhe = { de500: 0, asas: 0, limpas: 0, sujas: 0, baixadas: 0 }; // [PATCH CRIT-02] asas próprio (não reclassifica de500)
  for (const meld of jogo.jogosDupla[dupla]) {
    if (meld.length >= 7) {
      // TRINCA não forma canastra (regra Sônia 19/jul): usa validarSequencia, que RECUSA
      // grupos de valor igual — então uma trinca de 7+ NÃO ganha bônus de canastra; só os
      // pontos das cartas (contados no laço abaixo) entram. Canastra de sequência normal.
      const res = validarSequencia(meld);
      if (res.valido) {
        if (res.tipo === "as_a_as") { pontosCanastras += 1000; detalhe.asas++; } // [PATCH CRIT-02] contador próprio (não de500)
        else if (res.tipo === "de_500") { pontosCanastras += 500; detalhe.de500++; }
        else if (res.tipo === "limpa") { pontosCanastras += 200; detalhe.limpas++; }
        else if (res.tipo === "suja") { pontosCanastras += 100; detalhe.sujas++; }
      }
    }
    for (const c of meld) pontosCartas += valorCarta(c);
  }
  detalhe.baixadas = pontosCartas;
  const bonusBatida = bateu ? 100 : 0;
  // MORTO NÃO PEGO (regra Sônia, 18/jul): só penaliza -100 se a dupla NÃO pegou
  // morto E ALGUMA dupla pegou (prova que dava pra pegar). Se NINGUÉM pegou morto
  // (ex.: os dois viraram monte no esgotamento), ninguém é culpado -> sem -100.
  const penalidadeMorto = (!mortoPego && algumPegouMorto) ? -100 : 0;
  const descontoMao = -(cartasNaMao || 0);
  const total = pontosCanastras + pontosCartas + bonusBatida + descontoMao + penalidadeMorto;
  return { total, bonusBatida, penalidadeMorto, descontoMao, detalhe };
}

/** Conta as duas duplas, soma no placar e marca a partida encerrada se bateu
 *  a meta. Guarda o detalhe em jogo.pontosRodada (pra tela de contagem). */
function contarPontos(jogo) {
  const bateu = jogo.duplaQueBateu; // "nos" | "eles" | null
  const algumPegouMorto = jogo.mortoPego.nos || jogo.mortoPego.eles;
  const resultado = {};
  for (const dupla of ["nos", "eles"]) {
    const assentos = dupla === "nos" ? [0, 2] : [1, 3];
    const cartasNaMao = assentos.reduce(
      (s, a) => s + jogo.maos[a].reduce((t, c) => t + valorCarta(c), 0), 0);
    const r = pontuarDuplaJogo(jogo, dupla, {
      bateu: bateu === dupla,
      mortoPego: jogo.mortoPego[dupla],
      cartasNaMao,
      algumPegouMorto,
    });
    resultado[dupla] = r;
    jogo.placar[dupla] += r.total;
    // VULNERABILIDADE: quem já passou da metade da meta fica vulnerável — o
    // contador sobe a cada rodada que a dupla segue acima do limiar (até 2),
    // igual à v111 (75+ na 1ª rodada vulnerável, 90+ da 2ª em diante).
    if (jogo.placar[dupla] >= jogo.metaPontos / 2) {
      jogo.rodadasVulneravel[dupla] = Math.min(jogo.rodadasVulneravel[dupla] + 1, 2);
    }
  }
  jogo.pontosRodada = resultado;
  if (jogo.placar.nos >= jogo.metaPontos || jogo.placar.eles >= jogo.metaPontos) {
    jogo.encerrada = true; // partida acabou (bateu a meta)
  }
  return resultado;
}

module.exports = {
  duplaDoAssento,
  criarJogo,
  distribuirRodada,
  topoLixo,
  visaoDoAssento,
  // [PATCH ESPECTADOR] visão pública + definição de segredo + varredura
  visaoDoEspectador,
  segredosDoEspectador,
  vazamentosNaVisao,
  minimoParaDescer,
  // jogadas
  comprarMonte,
  comprarLixo,
  baixar,
  estender,
  descartar,
  passarVez,
  encerrarRodada,
  // contagem
  valorCarta,
  contarPontos,
  duplaTemCanastraLimpa,
  duplaPodeBater,
  idxNaMao,
  CARTAS_POR_MAO,
  CARTAS_POR_MORTO,
};

  };

  __fabricas["bot_motor"] = function (module, exports, require) {
// servidor/bot_motor.js — DRIVER DO BOT NO SERVIDOR (multiplayer M2)
// Liga o CÉREBRO do bot (motor/bot.js: planejarTurno) ao MOTOR DE JOGO
// (motor/jogo.js: a autoridade). Traduz o "plano" do cérebro em jogadas reais
// (comprarMonte/comprarLixo/baixar/estender/descartar) que o motor valida.
//
// Diferente da mesa (HTML), aqui NÃO precisamos das "redes de segurança" que
// mexiam no DOM: o motor já recusa jogada ilegal, já força a trava do topo
// (deveUsarTopo), já resolve morto e batida no descarte. O driver só precisa
// aplicar o plano com cuidado e escolher um descarte legal pra fechar a vez.

const J = require("../motor/jogo");
const Bot = require("../motor/bot");
const { validarJogo } = require("../motor/canastra");

/** No modo FECHADO o bot também usa TRINCAS — a validação de jogo passa a
 *  considerar grupos de valor igual. `permiteTrinca` sai de jogo.modalidade. */
function ptDaMesa(jogo) {
  return jogo && jogo.modalidade === "fechado";
}

const NAIPE_SIMB = { ouros: "♦", copas: "♥", espadas: "♠", paus: "♣" };
function cartaTxt(c) {
  if (!c) return "?";
  if (c.valor === "JOKER") return "JOKER";
  return c.valor + (NAIPE_SIMB[c.naipe] || c.naipe || "");
}

function ehCuringa(c) {
  return !!(c && (c.eh_coringa || c.valor === "2" || c.valor === "JOKER"));
}

/** Colocar `cartasNovas` neste meld SUJARIA uma canastra que já é LIMPA (7+
 *  cartas, 0 curinga)? Se sim, o bot NÃO faz — meter um 2/Joker numa limpa
 *  derruba 200 (ou 500 do de_500) pra 100 e mata o caminho pro de_500/mil
 *  (regra Sônia, Print SUJA 18/jul). */
function sujariaLimpa(meld, cartasNovas, permiteTrinca = false) {
  const a = validarJogo(meld, { permiteTrinca });
  if (!(a.valido && meld.length >= 7 && a.qtd_curingas === 0)) return false; // não era canastra limpa
  const d = validarJogo(meld.concat(cartasNovas), { permiteTrinca });
  return d.valido && d.qtd_curingas > 0; // a adição a deixaria suja
}

/** A compra é "justificada" (topo tem que ter uso) em tudo menos no ABERTO. */
function compraJustificada(modalidade) {
  return modalidade !== "aberto";
}

/**
 * Joga o TURNO INTEIRO de um assento-bot, mutando `jogo` via as jogadas do
 * motor. Retorna { ok, log:[...strings], bateu?, pegouMorto?, encerrouRodada? }.
 */
// ===========================================================================
// FASE B3 — SO-ISMCTS "lite" (Diretriz secao 26). Busca limitada e ANYTIME sobre
// os melhores candidatos de DESCARTE. Para cada candidato, amostra determinizacoes
// das maos ocultas coerentes com as CRENCAS/contagens (InformationMasker, secao 7:
// so info publica), simula alguns lances com a POLITICA HEURISTICA (rollout) e
// pontua por uma funcao de valor. Escolhe o descarte de maior valor esperado; so
// TROCA o descarte heuristico se o ganho superar uma margem (estabilidade/legibilidade).
// Respeita um orcamento de tempo (deadline) e, no estouro, devolve o melhor ja
// avaliado — nunca ultrapassa o SLO. Recursao evitada via flag `emRollout`.
// ===========================================================================
let emRollout = false;
// Orcamento (secao 26). Sobrescrevivel por globalThis.__B3_OPTS (usado nos testes
// pra acelerar; em producao usa o default, dentro do SLO de 120-250ms).
const B3_OPTS = Object.assign(
  { orcamentoMs: 50, maxIter: 60, depth: 2, margem: 35, topK: 5, ativo: true },
  (typeof globalThis !== "undefined" && globalThis.__B3_OPTS) || {}
);
function b3Ativo(jogo) { return B3_OPTS.ativo !== false; }

// ===========================================================================
// FASE B4 — NIVEIS DE DIFICULDADE + HUMANIZACAO (Diretriz secao 29/30/13).
// A dificuldade muda SO profundidade/exploracao da busca (secao 29). NAO altera
// distribuicao, monte, pontos, nem "erra de proposito". Lida de
// jogo.assentos[assento].dificuldade (e .substituto). Default = avancado (mantem
// exatamente o comportamento B3 ja testado). O SUBSTITUTO (secao 30) joga
// previsivel/conservador: 'margem' de troca alta = quase sempre a jogada
// heuristica legivel, protegendo o plano do parceiro humano (legibilityMargin, secao 13).
// ===========================================================================
const DIFICULDADES = {
  iniciante:     { nome: "iniciante",     ismcts: false },
  intermediario: { nome: "intermediario", ismcts: false },
  avancado:      { nome: "avancado",      ismcts: true,  orcamentoMs: 50,  maxIter: 60,  depth: 2, margem: 35, topK: 5 },
  expert:        { nome: "expert",        ismcts: true,  orcamentoMs: 120, maxIter: 120, depth: 3, margem: 25, topK: 6 },
  substituto:    { nome: "substituto",    ismcts: true,  orcamentoMs: 40,  maxIter: 50,  depth: 2, margem: 55, topK: 5, substituto: true },
};
function perfilDoAssento(jogo, assento) {
  const a = (jogo.assentos && jogo.assentos[assento]) || {};
  const nome = a.substituto ? "substituto" : (a.dificuldade || "avancado");
  return Object.assign({}, DIFICULDADES[nome] || DIFICULDADES.avancado);
}

const NAIPES_B3 = ["copas", "ouros", "paus", "espadas"];
const VALORES_B3 = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
let __synth = 0;
function synthCarta(valor, naipe) {
  return { id: "s" + (__synth++), naipe: naipe, valor: valor, eh_coringa: (valor === "2" || valor === "JOKER") };
}
function chaveB3(c) { return c.valor === "JOKER" ? "JOKER" : (c.valor + "|" + c.naipe); }
// multiconjunto do baralho conforme a modalidade (Aberto nao tem Joker)
function deckCounts(modalidade) {
  const m = {};
  for (const n of NAIPES_B3) for (const v of VALORES_B3) m[v + "|" + n] = 2;
  if (modalidade !== "aberto") m["JOKER"] = 4;
  return m;
}
function cloneJogoB3(j) {
  return {
    modalidade: j.modalidade, metaPontos: j.metaPontos, rodada: j.rodada,
    placar: { nos: j.placar.nos, eles: j.placar.eles },
    rodadasVulneravel: { nos: j.rodadasVulneravel.nos, eles: j.rodadasVulneravel.eles },
    encerrada: j.encerrada,
    maos: [j.maos[0].slice(), j.maos[1].slice(), j.maos[2].slice(), j.maos[3].slice()],
    monte: j.monte.slice(),
    mortos: j.mortos.map(function (m) { return m.slice(); }),
    lixo: j.lixo.slice(),
    jogosDupla: { nos: j.jogosDupla.nos.map(function (m) { return m.slice(); }), eles: j.jogosDupla.eles.map(function (m) { return m.slice(); }) },
    mortoPego: { nos: j.mortoPego.nos, eles: j.mortoPego.eles },
    abriuValido: { nos: j.abriuValido.nos, eles: j.abriuValido.eles },
    vez: j.vez, jaComprou: j.jaComprou,
    deveUsarTopo: j.deveUsarTopo ? { assento: j.deveUsarTopo.assento, idTopo: j.deveUsarTopo.idTopo } : null,
    lixoCompradoNoTurno: null, turnosRodada: j.turnosRodada || 0,
    rodadaEncerrada: j.rodadaEncerrada, duplaQueBateu: j.duplaQueBateu, pontosRodada: null,
    // TODOS os assentos viram "bot" na simulacao — modelamos os oponentes/parceiro
    // com a nossa propria heuristica (nao ha acesso a mao real deles).
    assentos: j.assentos.map(function (a) { return { tipo: "bot", apelido: a.apelido, dupla: a.dupla }; }),
  };
}
// Amostra uma determinizacao: mao propria fica REAL; demais maos/monte/mortos e o
// lixo enterrado (nao-Aberto) sao preenchidos com o multiconjunto NAO-VISTO.
function amostrarDeterminizacao(j, assento) {
  const seen = {};
  const add = function (c) { const k = chaveB3(c); seen[k] = (seen[k] || 0) + 1; };
  j.maos[assento].forEach(add);
  j.jogosDupla.nos.forEach(function (m) { m.forEach(add); });
  j.jogosDupla.eles.forEach(function (m) { m.forEach(add); });
  const aberto = j.modalidade === "aberto";
  if (aberto) j.lixo.forEach(add); else if (j.lixo.length) add(j.lixo[j.lixo.length - 1]);
  const counts = deckCounts(j.modalidade);
  const pool = [];
  for (const k in counts) {
    const falta = counts[k] - (seen[k] || 0);
    for (let i = 0; i < falta; i++) {
      if (k === "JOKER") pool.push(synthCarta("JOKER", null));
      else { const p = k.split("|"); pool.push(synthCarta(p[0], p[1])); }
    }
  }
  // embaralha (Math.random — producao).
  for (let i = pool.length - 1; i > 0; i--) { const r = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[r]; pool[r] = t; }
  const clone = cloneJogoB3(j);
  let p = 0;
  const draw = function (n) { const out = []; for (let i = 0; i < n && p < pool.length; i++) out.push(pool[p++]); return out; };
  for (let a = 0; a < 4; a++) if (a !== assento) clone.maos[a] = draw(j.maos[a].length);
  clone.monte = draw(j.monte.length);
  clone.mortos = j.mortos.map(function (m) { return draw(m.length); });
  if (!aberto && clone.lixo.length > 1) {
    const topo = clone.lixo[clone.lixo.length - 1];
    const enterrado = draw(clone.lixo.length - 1);
    clone.lixo = enterrado.concat([topo]);
  }
  return clone;
}
// Valor do estado da perspectiva de `dupla` (canastras + baixadas − adversario −
// deadwood nas nossas maos + bonus/penalidade de batida).
function valorEstadoB3(j, dupla) {
  const outra = dupla === "nos" ? "eles" : "nos";
  const valDupla = function (d) {
    let s = 0;
    for (const m of j.jogosDupla[d]) {
      if (m.length >= 7) { const r = validarJogo(m, { permiteTrinca: j.modalidade === "fechado" }); if (r.valido) { if (r.tipo === "de_500") s += 500; else if (r.tipo === "limpa") s += 200; else if (r.tipo === "suja") s += 100; } }
      for (const c of m) s += J.valorCarta(c);
    }
    return s;
  };
  let s = valDupla(dupla) - valDupla(outra);
  const seats = dupla === "nos" ? [0, 2] : [1, 3];
  for (const a of seats) s -= j.maos[a].reduce(function (t, c) { return t + J.valorCarta(c); }, 0) * 0.5;
  if (j.rodadaEncerrada && j.duplaQueBateu === dupla) s += 100;
  if (j.rodadaEncerrada && j.duplaQueBateu === outra) s -= 100;
  return s;
}
function gerarCandidatosDescarte(jogo, assento, ctxPub, preferidoId, opts) {
  const dupla = J.duplaDoAssento(assento);
  const advs = jogo.jogosDupla[dupla === "nos" ? "eles" : "nos"];
  const pt = ptDaMesa(jogo);
  const mao = jogo.maos[assento];
  const naoCuringa = mao.filter(function (c) { return !ehCuringa(c); });
  const base = naoCuringa.length ? naoCuringa : mao;
  const perigosa = function (c) { return advs.some(function (j) { return validarJogo(j.concat([c]), { permiteTrinca: pt }).valido; }); };
  let pool = base.filter(function (c) { return !perigosa(c); });
  if (!pool.length) pool = base.slice();
  const ctxRisk = { fase: null, tamanhoLixo: jogo.lixo.length, crencas: ctxPub ? ctxPub.crencas : null, minCartasOponente: ctxPub ? ctxPub.minCartasOponente : undefined };
  pool.sort(function (a, b) { return Bot.riscoDescarte(a, mao, advs, ctxRisk, pt) - Bot.riscoDescarte(b, mao, advs, ctxRisk, pt); });
  const ids = [];
  const topK = (opts && opts.topK) || B3_OPTS.topK;
  for (let i = 0; i < pool.length && ids.length < topK; i++) ids.push(pool[i].id);
  if (preferidoId && ids.indexOf(preferidoId) < 0 && mao.some(function (c) { return c.id === preferidoId; })) ids.push(preferidoId);
  return ids;
}
function simularDescarteB3(clone, assento, discardId, depth) {
  const dupla = J.duplaDoAssento(assento);
  const rd = J.descartar(clone, assento, discardId);
  if (!rd || !rd.ok) return null;
  let plies = 0;
  while (plies < depth && !clone.encerrada && !clone.rodadaEncerrada) {
    const a2 = clone.vez;
    try { jogarTurnoBotCore(clone, a2); } catch (e) { try { J.passarVez(clone); } catch (_) {} }
    plies++;
  }
  return valorEstadoB3(clone, dupla);
}
function ismctsEscolherDescarte(jogo, assento, ctxPub, preferidoId, opts) {
  opts = opts || B3_OPTS;
  const orcamentoMs = opts.orcamentoMs != null ? opts.orcamentoMs : B3_OPTS.orcamentoMs;
  const maxIter = opts.maxIter != null ? opts.maxIter : B3_OPTS.maxIter;
  const depth = opts.depth != null ? opts.depth : B3_OPTS.depth;
  const margem = opts.margem != null ? opts.margem : B3_OPTS.margem;
  const cands = gerarCandidatosDescarte(jogo, assento, ctxPub, preferidoId, opts);
  if (cands.length <= 1) return cands[0] || preferidoId;
  const soma = {}, cnt = {};
  cands.forEach(function (id) { soma[id] = 0; cnt[id] = 0; });
  const deadline = Date.now() + orcamentoMs;
  emRollout = true;
  try {
    let it = 0;
    while (it < maxIter && Date.now() < deadline) {
      for (let ci = 0; ci < cands.length; ci++) {
        if (Date.now() >= deadline) break;
        const clone = amostrarDeterminizacao(jogo, assento);
        const v = simularDescarteB3(clone, assento, cands[ci], depth);
        if (v != null) { soma[cands[ci]] += v; cnt[cands[ci]] += 1; }
      }
      it++;
    }
  } finally { emRollout = false; }
  let melhorId = preferidoId, melhorMed = -Infinity;
  for (let ci = 0; ci < cands.length; ci++) { const id = cands[ci]; if (!cnt[id]) continue; const med = soma[id] / cnt[id]; if (med > melhorMed) { melhorMed = med; melhorId = id; } }
  const medPref = (preferidoId && cnt[preferidoId]) ? soma[preferidoId] / cnt[preferidoId] : -Infinity;
  // so troca o descarte heuristico se o ganho superar a margem da dificuldade —
  // margem alta (substituto) = jogada previsivel/conservadora (legibilityMargin, secao 13).
  if (melhorId !== preferidoId && (melhorMed - medPref) < margem) return preferidoId;
  return melhorId;
}

function jogarTurnoBotCore(jogo, assento) {
  const log = [];
  if (jogo.encerrada) return { ok: false, erro: "a partida já terminou", log };
  if (jogo.rodadaEncerrada) return { ok: false, erro: "a rodada já terminou", log };
  if (jogo.vez !== assento) return { ok: false, erro: "não é a vez deste assento", log };
  if (jogo.assentos[assento].tipo !== "bot") return { ok: false, erro: "assento não é bot", log };

  const dupla = J.duplaDoAssento(assento);
  const outra = dupla === "nos" ? "eles" : "nos";
  const justif = compraJustificada(jogo.modalidade);
  const topo = J.topoLixo(jogo);
  const jogosDupla = jogo.jogosDupla[dupla];
  const jogosAdv = jogo.jogosDupla[outra];
  const mortoDisponivel = !jogo.mortoPego[dupla] && jogo.mortos.length > 0;
  const jaPegouMorto = jogo.mortoPego[dupla] || jogo.mortos.length === 0;
  // VULNERABILIDADE (mesma regra do motor/jogo.js): com a mesa ainda vazia, a
  // 1ª baixada da dupla precisa somar esse mínimo — o cérebro (motor/bot.js)
  // já sabe planejar em volta disso (minimoAbertura), só faltava passar o
  // valor aqui (sem isso os bots vulneráveis tentavam abrir baixadas fracas,
  // que agora o motor recusa).
  const rodadasVuln = jogo.rodadasVulneravel[dupla];
  const minimoAbertura = jogosDupla.length === 0 && rodadasVuln > 0 ? (rodadasVuln === 1 ? 75 : 90) : 0;

  // CONTEXTO PUBLICO (B1/B2, secao 7 antifraude): so o que o assento PODE ver.
  // As CRENCAS sao construidas aqui, no driver, e recebem apenas informacao
  // publica — nunca a mao adversaria nem o futuro do monte.
  const proxAssento = (assento + 1) % 4;
  const lixoConhecido = jogo.modalidade === "aberto" ? jogo.lixo.slice() : (topo ? [topo] : []);
  const crencas = Bot.construirCrencas({
    mao: jogo.maos[assento],
    jogosNos: jogosDupla,
    jogosEles: jogosAdv,
    lixoConhecido: lixoConhecido,
    proxCartas: jogo.maos[proxAssento].length,
    monteQtd: jogo.monte.length,
    modalidade: jogo.modalidade,
  });
  const ctxPub = {
    monteQtd: jogo.monte.length,
    minCartasOponente: Math.min(jogo.maos[(assento + 1) % 4].length, jogo.maos[(assento + 3) % 4].length),
    algumApto: J.duplaPodeBater(jogo, outra),
    crencas: crencas,
  };

  // 1) COMPRA — pergunta ao cérebro por onde comprar
  const plano1 = Bot.planejarTurno({
    mao: jogo.maos[assento],
    topoLixo: topo,
    jogosMesaDupla: jogosDupla,
    jogosAdversario: jogosAdv,
    mortoDisponivel,
    jaPegouMorto,
    minimoAbertura,
    tamanhoLixo: jogo.lixo.length,
    modalidade: jogo.modalidade,
    cartasLixo: jogo.modalidade === "aberto" ? jogo.lixo : null,
    ctx: ctxPub,
  });

  let comprouLixo = false;
  // SEGURANÇA anti-trava (bug do lixo vazio, Sônia 18/jul): pegar o lixo OBRIGA a
  // baixar o topo (deveUsarTopo) no SBTL/Fechado. Se, depois de baixar o topo, não
  // sobrar carta pra DESCARTAR, o bot fica com 1 carta impossível de largar e passa
  // a vez SEM descartar — o lixo chega vazio pro próximo. Então: só pega o lixo se
  // sobrar reserva pro descarte DEPOIS do custo mínimo de baixar o topo. Senão,
  // compra do monte (que sempre deixa uma carta pra descartar).
  const pegarLixoStranda =
    plano1.compra.origem === "lixo" && topo && jogo.modalidade !== "aberto" &&
    (jogo.maos[assento].length + jogo.lixo.length) - custoMinimoTopo(jogo, assento, topo) < reservaMinima(jogo, assento);
  // VULNERABILIDADE (bug do bot adversário abrindo 15 pts vulnerável, Sônia 19/jul):
  // com a dupla vulnerável e a mesa AINDA vazia (abertura) numa modalidade que obriga
  // usar o topo (SBTL/Fechado), pegar o lixo forçaria ABRIR um jogo com o topo — e a
  // abertura precisa somar 75/90. Um jogo do topo (3 cartas) quase nunca alcança isso,
  // e o forcarTopoNaMesa acabava ABRINDO fraco na marra. Então o bot NÃO pega o lixo
  // nesse caso: compra do monte e abre da mão quando puder (o cérebro respeita o
  // mínimo nas baixadas). Perde raras aberturas boas via lixo, mas nunca fura a regra.
  const lixoForcariaAberturaFraca = minimoAbertura > 0 && justif;
  // [CONTROLADOR §10] TURNO JÁ INICIADO. Se o humano comprou e caiu depois, o
  // bot que assume entra DEPOIS da compra: a fase do turno é do jogo, não do
  // controlador, e takeover não reinicia turno. Sem esta guarda o bot tentaria
  // comprar de novo, `validarVez` recusaria e o turno morreria sem jogada —
  // a mesa penduraria exatamente no caso que esta OS existe para consertar.
  //
  // A obrigação de topo (`deveUsarTopo`) atravessa junto: ela vive no jogo e é
  // honrada mais abaixo, no mesmo ponto em que já era.
  if (jogo.jaComprou) {
    log.push("assumiu o turno já iniciado (compra preservada)");
  } else if (plano1.compra.origem === "lixo" && topo && !pegarLixoStranda && !lixoForcariaAberturaFraca) {
    const r = J.comprarLixo(jogo, assento);
    if (r.ok) {
      comprouLixo = true;
      log.push("comprou o LIXO (" + r.qtd + ", topo " + cartaTxt(topo) + ") — " + plano1.compra.motivo);
    } else {
      const rm = J.comprarMonte(jogo, assento);
      if (!rm.ok) return finalizaSemJogada(jogo, rm, log);
      log.push("comprou do MONTE (lixo recusado: " + r.erro + ")");
    }
  } else {
    const rm = J.comprarMonte(jogo, assento);
    if (!rm.ok) return finalizaSemJogada(jogo, rm, log);
    log.push("comprou do MONTE — " + plano1.compra.motivo);
  }
  // a compra do monte pode ter encerrado a rodada por esgotamento
  if (jogo.rodadaEncerrada) return { ok: true, encerrouRodada: true, log };

  // 2) RE-PLANEJA com a carta já na mão. Passa a carta obrigatória / prova do
  // topo da 1ª chamada (o cérebro coloca o topo primeiro nas extensões).
  const plano2 = Bot.planejarTurno({
    mao: jogo.maos[assento],
    topoLixo: null,
    jogosMesaDupla: jogosDupla,
    jogosAdversario: jogosAdv,
    mortoDisponivel,
    jaPegouMorto,
    minimoAbertura,
    tamanhoLixo: jogo.lixo.length,
    cartaObrigatoria: justif && comprouLixo && topo ? topo : null,
    provaTopo: justif && comprouLixo ? plano1.compra.provaTopo : null,
    modalidade: jogo.modalidade,
    ctx: ctxPub,
  });
  // AUDITORIA (B1/B2, secao 31/35): reasonCodes + telemetria (com beliefSummary).
  const auditoria = {
    reasons: (plano2.reasons && plano2.reasons.length ? plano2.reasons : (plano1.reasons || [])),
    telemetria: plano2.telemetria || plano1.telemetria || null,
    fase: plano2.fase || plano1.fase || null,
  };

  // 2.5) DESCE O TOPO OBRIGATÓRIO PRIMEIRO. Se comprou o lixo (SBTL/Fechado), o
  //    topo TEM que ir pra mesa antes de qualquer outra jogada — senão uma extensão
  //    de uma carta DUPLICADA (mesmo valor/naipe, id diferente) pode roubar o exato
  //    encaixe do topo e deixá-lo órfão na mão, travando o descarte (bug raro do
  //    A♦ duplicado). Baixando o topo já com custo mínimo aqui, o encaixe é dele.
  if (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) {
    forcarTopoNaMesa(jogo, assento, log);
  }

  // 3) EXTENSÕES — a prova do topo já vem primeiro na lista (motor/bot.js).
  //    Deixa cartas suficientes pra FECHAR o turno legalmente (ver reservaMinima).
  //    O topo obrigatório NÃO precisa de exceção aqui: se a reserva pular a jogada
  //    que o desceria, o forcarTopoNaMesa (garantido) desce ele com o custo mínimo.
  for (const ext of plano2.extensoes || []) {
    if (jogo.maos[assento].length - 1 < reservaMinima(jogo, assento)) break; // a extensão gasta 1 carta
    // trava final anti-sujeira (Print SUJA): nunca aplica uma extensão que sujaria
    // uma canastra limpa 7+, mesmo se o plano pediu (ex.: ordem plano-vs-aplicação
    // fez a canastra virar limpa no meio do turno). O cérebro já evita, isto é o cinto.
    const alvo = jogo.jogosDupla[dupla][ext.indiceJogo];
    if (alvo && sujariaLimpa(alvo, [ext.carta], ptDaMesa(jogo))) continue;
    const r = J.estender(jogo, assento, ext.indiceJogo, [ext.carta.id]);
    if (r.ok) log.push("estendeu " + cartaTxt(ext.carta) + " no jogo " + (ext.indiceJogo + 1));
  }

  // 4) JOGOS NOVOS. A ABERTURA de dupla VULNERÁVEL é ATÔMICA: ou baixa TODOS os
  //    jogos do plano de uma vez (o cérebro já garantiu que somam >= mínimo e
  //    deixam carta pro descarte), ou não abre nada. A reservaMinima por-jogo NÃO
  //    pode splitar a abertura — aplicar parte e parar por reserva deixava a mesa
  //    aberta ABAIXO do mínimo (bug do bot abrindo 65 vulnerável, Sônia 19/jul).
  const abrindoVulneravel = minimoAbertura > 0 && jogo.jogosDupla[dupla].length === 0;
  if (abrindoVulneravel) {
    // SÓ conta melds REALMENTE válidos (o plano pode conter um jogo que o motor
    // recusa — ex.: trinca com curinga anexado). Filtrar ANTES de somar garante que
    // o `soma` reflete o que de fato vai pra mesa — senão a abertura sairia parcial e
    // abaixo do mínimo (o motor recusa o inválido, mas o soma já tinha contado).
    const pt = ptDaMesa(jogo);
    const abertura = (plano2.baixadas || []).filter(
      (jg) => jg && jg.length >= 3 && validarJogo(jg, { permiteTrinca: pt }).valido
    );
    const usadas = abertura.reduce((s, jg) => s + jg.length, 0);
    const soma = abertura.reduce((s, jg) => s + jg.reduce((t, c) => t + J.valorCarta(c), 0), 0);
    const sobra = jogo.maos[assento].length - usadas;
    if (soma >= minimoAbertura && sobra >= reservaMinima(jogo, assento)) {
      for (const jg of abertura) {
        const r = J.baixar(jogo, assento, jg.map((c) => c.id));
        if (r.ok) log.push("baixou jogo novo (abertura vulnerável " + soma + "+): " + jg.map(cartaTxt).join(" "));
      }
    }
    // senão: NÃO abre (segura os jogos) — abrir parcial seria abaixo do mínimo
  } else {
    for (const jg of plano2.baixadas || []) {
      if (!jg || jg.length < 3) continue;
      if (jogo.maos[assento].length - jg.length < reservaMinima(jogo, assento)) continue;
      const r = J.baixar(jogo, assento, jg.map((c) => c.id));
      if (r.ok) log.push("baixou jogo novo: " + jg.map(cartaTxt).join(" "));
    }
  }

  // 5) FALLBACK "USA O TOPO AGORA" — se comprou o lixo e o topo ainda não foi
  //    pra mesa (trava deveUsarTopo ligada), força ele sozinho em algum jogo da
  //    dupla que aceite, sem sujar canastra limpa.
  if (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) {
    forcarTopoNaMesa(jogo, assento, log);
  }

  // 6) DESCARTE — fecha a vez. O motor resolve morto/batida sozinho.
  // FASE B3: se a busca estiver ativa e a mao permitir, ela pode escolher um
  // descarte melhor entre os candidatos legais (nunca durante rollout).
  let preferidoDescarteId = plano2.descarte ? plano2.descarte.id : null;
  const perfil = perfilDoAssento(jogo, assento);
  if (auditoria.telemetria) { auditoria.telemetria.dificuldade = perfil.nome; if (perfil.substituto) auditoria.telemetria.substituto = true; }
  if (!emRollout && perfil.ismcts && b3Ativo(jogo) && !(jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) && jogo.maos[assento].length >= 2) {
    try {
      const alt = ismctsEscolherDescarte(jogo, assento, ctxPub, preferidoDescarteId, perfil);
      if (alt) preferidoDescarteId = alt;
    } catch (e) { /* qualquer erro na busca: mantem o descarte heuristico */ }
  }
  const idDescarte = escolherDescarteLegal(jogo, assento, preferidoDescarteId);
  // AUDITABILIDADE 100% (secao 35, correcao b4.2): quando o PLANO previa zerar a
  // mao (sem descarte planejado) mas a execucao acabou descartando, os reasonCodes
  // vinham vazios — o turno ficava sem explicacao. Aqui derivamos o motivo da carta
  // REALMENTE descartada, avaliando-a com a mesma regra do descarte seguro.
  // Achado pela suite de testes: 11 turnos em 4122 (0,27%) sem motivo.
  if (idDescarte != null && (!auditoria.reasons || !auditoria.reasons.length)) {
    const _c = jogo.maos[assento].find((c) => c.id === idDescarte);
    if (_c) auditoria.reasons = motivosDoDescarteReal(jogo, assento, _c);
  }
  if (idDescarte == null) {
    J.passarVez(jogo);
    log.push("segurou a carta (descarte seria batida ilegal) — passou a vez");
    return Object.assign({ ok: true, log, semDescarte: true }, auditoria);
  }
  const rd = J.descartar(jogo, assento, idDescarte);
  if (!rd.ok) {
    J.passarVez(jogo);
    log.push("descarte recusado (" + rd.erro + ") — passou a vez");
    return Object.assign({ ok: true, log, semDescarte: true }, auditoria);
  }
  const frase = fraseMotivos(auditoria.reasons);
  if (rd.bateu) { log.push("descartou " + cartaTxt(rd.descarte) + " → BATEU! encerra a rodada" + frase); return Object.assign({ ok: true, log, bateu: true }, auditoria); }
  if (rd.pegouMorto) { log.push("descartou " + cartaTxt(rd.descarte) + " → zerou e pegou o MORTO" + frase); return Object.assign({ ok: true, log, pegouMorto: true }, auditoria); }
  log.push("descartou " + cartaTxt(rd.descarte) + frase);
  return Object.assign({ ok: true, log }, auditoria);
}

const FRASES_RC = {
  completeVulnerability: "cumpri a abertura vulneravel",
  takeDiscardHighValue: "peguei o lixo pelo valor",
  avoidDiscardGift: "evitei entregar o lixo ao adversario",
  preserveCleanCanasta: "preservei a canastra limpa",
  useWildToSecureMorto: "usei o curinga p/ garantir morto/batida",
  preparePartnerGoOut: "preparei a saida do parceiro",
  preventOpponentGoOut: "neguei carta ao adversario",
  reduceDeadwood: "descartei carta morta",
  takeMorto: "peguei o morto",
  goOutSecure: "bati com seguranca",
  fallbackTimeout: "joguei seguro (fallback)",
};
function fraseMotivos(reasons) {
  if (!reasons || !reasons.length) return "";
  const preferida = ["goOutSecure", "takeMorto", "preserveCleanCanasta", "avoidDiscardGift", "completeVulnerability", "takeDiscardHighValue", "preventOpponentGoOut", "reduceDeadwood"];
  for (const p of preferida) if (reasons.indexOf(p) >= 0 && FRASES_RC[p]) return " — " + FRASES_RC[p];
  return FRASES_RC[reasons[0]] ? " — " + FRASES_RC[reasons[0]] : "";
}

/** Quantas cartas o bot PRECISA manter na mão pra conseguir FECHAR o turno com um
 *  descarte legal, ao baixar/estender. Regra:
 *   - se a dupla PODE bater agora (tem morto pra pegar, ou já pegou/não há morto E
 *     tem canastra limpa pra batida final): pode ir até 1 carta — o descarte dessa
 *     última vira a batida.
 *   - se NÃO pode bater: precisa sobrar ≥2 (uma pro descarte, ≥1 na mão). Sem isso
 *     o bot baixava até 1 carta que NÃO dá pra descartar (descartar zeraria a mão
 *     sem batida legal), aí "segurava a carta" e passava a vez SEM descartar — e o
 *     lixo chegava vazio pro próximo jogador (bug do print da Sônia, 18/jul). */
function reservaMinima(jogo, assento) {
  const dupla = J.duplaDoAssento(assento);
  const mortoDisp = !jogo.mortoPego[dupla] && jogo.mortos.length > 0;
  // Só deixa ir até 1 carta quando há MORTO pra pegar — aí descartar a última
  // zera a mão e pega o morto (sempre funciona). O caminho da "batida final por
  // canastra limpa" é FRÁGIL: a própria jogada de baixar/estender pode SUJAR a
  // limpa (ex.: enfiar o curinga nela), e aí no descarte não dá mais pra bater —
  // o bot ficava com 1 carta impossível de descartar. Sendo conservador aqui, o
  // bot no máximo deixa de bater final numa jogada (bate na próxima), mas NUNCA
  // trava sem descartar.
  return mortoDisp ? 1 : 2;
}

/** Custo MÍNIMO (em cartas usadas) pra baixar o topo do lixo na mesa da dupla,
 *  espelhando as opções que o motor aceita em topoTemUsoLegal:
 *   1 = topo estende sozinho um jogo existente;
 *   2 = topo + 1 carta da mão estendem;
 *   3 = topo + 2 cartas da mão abrem jogo novo;
 *   Infinity = sem uso (o motor nem deixaria pegar o lixo).
 *  Usado pra saber, ANTES de pegar o lixo, se vai sobrar carta pro descarte. */
function custoMinimoTopo(jogo, assento, topo) {
  const dupla = J.duplaDoAssento(assento);
  const jogos = jogo.jogosDupla[dupla];
  const cand = jogo.maos[assento].filter((c) => c.id !== topo.id);
  const pt = ptDaMesa(jogo);
  const val = (cs) => validarJogo(cs, { permiteTrinca: pt }).valido;
  for (const meld of jogos) if (val(meld.concat([topo])) && !sujariaLimpa(meld, [topo], pt)) return 1;
  for (const meld of jogos) for (const c of cand) if (val(meld.concat([topo, c])) && !sujariaLimpa(meld, [topo, c], pt)) return 2;
  for (let a = 0; a < cand.length; a++)
    for (let b = a + 1; b < cand.length; b++)
      if (val([topo, cand[a], cand[b]])) return 3;
  return Infinity;
}

/** A compra falhou (monte + mortos esgotados): a rodada pode ter encerrado. */
function finalizaSemJogada(jogo, resultado, log) {
  if (jogo.rodadaEncerrada) { log.push("monte e mortos esgotados — rodada encerrada"); return { ok: true, encerrouRodada: true, log }; }
  log.push("não conseguiu comprar: " + resultado.erro);
  return { ok: false, erro: resultado.erro, log };
}

/** GARANTE que o topo do lixo vá pra mesa (a trava deveUsarTopo tem que sair, ou
 *  o bot não consegue descartar e passa a vez sem descarte — lixo vazio pro
 *  próximo). O motor só deixou comprar o lixo porque `topoTemUsoLegal` achou ALGUM
 *  uso; aqui espelhamos exatamente esses usos, do menos ao mais "sujo":
 *   1) topo SOZINHO num jogo que ele não suja (preferido);
 *   2) topo SOZINHO em qualquer jogo (mesmo sujando — a trava tem que sair);
 *   3) topo + 1 carta da mão estendem um jogo;
 *   4) topo + 2 cartas da mão abrem um jogo novo.
 *  Como o motor garantiu que um desses existe, sempre acha um. */
function forcarTopoNaMesa(jogo, assento, log) {
  const dupla = J.duplaDoAssento(assento);
  const topoId = jogo.deveUsarTopo.idTopo;
  const carta = jogo.maos[assento].find((c) => c.id === topoId);
  if (!carta) { jogo.deveUsarTopo = null; return; }
  const jogos = jogo.jogosDupla[dupla];
  const pt = ptDaMesa(jogo);
  const topoCuringa = ehCuringa(carta);
  const outras = () => jogo.maos[assento].filter((c) => c.id !== topoId);

  // 1) topo sozinho num jogo que ele NÃO suja
  for (let i = 0; i < jogos.length; i++) {
    if (topoCuringa && !jogos[i].some(ehCuringa)) continue;
    if (sujariaLimpa(jogos[i], [carta], pt)) continue; // nunca suja canastra limpa
    const r = J.estender(jogo, assento, i, [topoId]);
    if (r.ok) { log.push("TRAVA: topo " + cartaTxt(carta) + " estendeu o jogo " + (i + 1)); return; }
  }
  // 2) topo sozinho em QUALQUER jogo (pode sujar um jogo AINDA não-canastra, mas
  //    NUNCA uma canastra que já é limpa 7+ — isso mataria a de 200/500)
  for (let i = 0; i < jogos.length; i++) {
    if (sujariaLimpa(jogos[i], [carta], pt)) continue;
    const r = J.estender(jogo, assento, i, [topoId]);
    if (r.ok) { log.push("TRAVA: topo " + cartaTxt(carta) + " estendeu o jogo " + (i + 1) + " (sujou, mas tinha que descer)"); return; }
  }
  // 3) topo + 1 carta da mão estendem algum jogo
  for (let i = 0; i < jogos.length; i++) {
    for (const c of outras()) {
      if (sujariaLimpa(jogos[i], [carta, c], pt)) continue;
      const r = J.estender(jogo, assento, i, [topoId, c.id]);
      if (r.ok) { log.push("TRAVA: topo " + cartaTxt(carta) + " + " + cartaTxt(c) + " estenderam o jogo " + (i + 1)); return; }
    }
  }
  // 4) topo + 2 cartas da mão abrem jogo novo
  const cand = outras();
  for (let a = 0; a < cand.length; a++) {
    for (let b = a + 1; b < cand.length; b++) {
      const r = J.baixar(jogo, assento, [topoId, cand[a].id, cand[b].id]);
      if (r.ok) { log.push("TRAVA: topo " + cartaTxt(carta) + " abriu jogo novo com " + cartaTxt(cand[a]) + " " + cartaTxt(cand[b])); return; }
    }
  }
  // Não deveria chegar aqui (o motor garantiu uso). Se chegar, a trava fica.
}

/** Escolhe uma carta que o motor VAI aceitar descartar. Se a mão tem >1 carta,
 *  qualquer descarte é legal (não zera). Se tem exatamente 1, descartar zera —
 *  só é legal se a dupla pode bater (tem morto pra pegar OU tem canastra limpa
 *  com a batida final liberada). Preferimos o descarte sugerido pelo cérebro. */
function escolherDescarteLegal(jogo, assento, preferidoId) {
  const dupla = J.duplaDoAssento(assento);
  const mao = jogo.maos[assento];
  if (mao.length === 0) return null;
  if (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) return null; // trava ligada
  if (mao.length === 1) {
    const mortoDisp = !jogo.mortoPego[dupla] && jogo.mortos.length > 0;
    const podeBatidaFinal = jogo.mortoPego[dupla] || jogo.mortos.length === 0;
    const podeZerar = mortoDisp || (podeBatidaFinal && J.duplaPodeBater(jogo, dupla));
    if (!podeZerar) return null;
  }
  if (preferidoId && mao.some((c) => c.id === preferidoId)) return preferidoId;
  // FALLBACK SEGURO (B4.1): sem sugestão do cérebro, NÃO solta a última carta à toa.
  // Escolhe a mais segura: não-curinga, que não estenda jogo público do adversário,
  // de menor valor. Evita descarte inseguro/curinga em turnos de borda (achado na
  // suíte de 50 testes — antes o fallback era mao[último], que às vezes entregava).
  const _dupla = J.duplaDoAssento(assento);
  const _advs = jogo.jogosDupla[_dupla === "nos" ? "eles" : "nos"];
  const _pt = ptDaMesa(jogo);
  const _perigosa = (c) => _advs.some((j) => validarJogo(j.concat([c]), { permiteTrinca: _pt }).valido);
  const _naoCuringa = mao.filter((c) => !ehCuringa(c));
  const _base = _naoCuringa.length ? _naoCuringa : mao;
  const _seguras = _base.filter((c) => !_perigosa(c));
  const _pool = (_seguras.length ? _seguras : _base).slice();
  _pool.sort((a, b) => J.valorCarta(a) - J.valorCarta(b));
  return _pool[0].id;
}

// ===========================================================================
// SafeFallbackPolicy (secao 34) — o fallback e PARTE do produto. Se o
// planejamento normal lancar QUALQUER excecao, o bot ainda joga uma vez de forma
// garantidamente LEGAL e razoavel: compra do monte, NAO baixa nada, descarta a
// carta mais segura. Nunca quebra canastra, nunca faz acao ilegal.
// ===========================================================================
function jogarTurnoBot(jogo, assento) {
  try {
    return jogarTurnoBotCore(jogo, assento);
  } catch (e) {
    return safeFallbackTurn(jogo, assento, "excecao no planejamento: " + (e && e.message));
  }
}

function escolherDescarteSeguroFallback(jogo, assento) {
  const dupla = J.duplaDoAssento(assento);
  if (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) {
    try { forcarTopoNaMesa(jogo, assento, []); } catch (_) {}
    if (jogo.deveUsarTopo && jogo.deveUsarTopo.assento === assento) return null;
  }
  const mao = jogo.maos[assento];
  if (!mao.length) return null;
  if (mao.length === 1) {
    const mortoDisp = !jogo.mortoPego[dupla] && jogo.mortos.length > 0;
    const podeFinal = jogo.mortoPego[dupla] || jogo.mortos.length === 0;
    if (!(mortoDisp || (podeFinal && J.duplaPodeBater(jogo, dupla)))) return null;
  }
  const pt = ptDaMesa(jogo);
  const advs = jogo.jogosDupla[dupla === "nos" ? "eles" : "nos"];
  const naoCuringa = mao.filter((c) => !ehCuringa(c));
  const base = naoCuringa.length ? naoCuringa : mao;
  const perigosa = (c) => advs.some((j) => validarJogo(j.concat([c]), { permiteTrinca: pt }).valido);
  const seguras = base.filter((c) => !perigosa(c));
  const pool = (seguras.length ? seguras : base).slice();
  pool.sort((a, b) => J.valorCarta(a) - J.valorCarta(b));
  return pool[0].id;
}

/** Motivos (reasonCodes) da carta REALMENTE descartada — usado quando o plano nao
 *  gerou motivo (ex.: plano previa zerar a mao). Avalia a carta com a mesma regra
 *  do descarte seguro: se ela NAO serve aos jogos publicos do adversario, o bot
 *  evitou presentear (avoidDiscardGift); em todo caso, reduziu peso morto. */
function motivosDoDescarteReal(jogo, assento, carta) {
  const dupla = J.duplaDoAssento(assento);
  const advs = jogo.jogosDupla[dupla === "nos" ? "eles" : "nos"] || [];
  const pt = ptDaMesa(jogo);
  const serveAoAdversario = advs.some((j) => validarJogo(j.concat([carta]), { permiteTrinca: pt }).valido);
  const out = [];
  if (!serveAoAdversario) out.push("avoidDiscardGift");
  out.push("reduceDeadwood");
  return out;
}

function safeFallbackTurn(jogo, assento, motivo) {
  const log = ["[FALLBACK secao34] " + (motivo || "jogada segura")];
  try {
    if (jogo.encerrada || jogo.rodadaEncerrada || jogo.vez !== assento) {
      return { ok: true, log, fallback: true, reasons: ["fallbackTimeout"] };
    }
    if (!jogo.jaComprou) {
      const rm = J.comprarMonte(jogo, assento);
      if (!rm.ok && jogo.rodadaEncerrada) {
        return { ok: true, log, encerrouRodada: true, fallback: true, reasons: ["fallbackTimeout"] };
      }
    }
    const id = escolherDescarteSeguroFallback(jogo, assento);
    if (id == null) {
      J.passarVez(jogo);
      log.push("segurou a carta — passou a vez");
      return { ok: true, log, semDescarte: true, fallback: true, reasons: ["fallbackTimeout"] };
    }
    const rd = J.descartar(jogo, assento, id);
    if (!rd.ok) {
      J.passarVez(jogo);
      log.push("descarte recusado (" + rd.erro + ") — passou a vez");
      return { ok: true, log, semDescarte: true, fallback: true, reasons: ["fallbackTimeout"] };
    }
    log.push("descartou " + cartaTxt(rd.descarte) + " (fallback seguro)");
    return { ok: true, log, bateu: rd.bateu, pegouMorto: rd.pegouMorto, fallback: true, reasons: ["fallbackTimeout"] };
  } catch (e) {
    try { J.passarVez(jogo); } catch (_) {}
    log.push("excecao no proprio fallback (" + (e && e.message) + ") — passou a vez");
    return { ok: true, log, semDescarte: true, fallback: true, reasons: ["fallbackTimeout"] };
  }
}

module.exports = { jogarTurnoBot, jogarTurnoBotCore, safeFallbackTurn, cartaTxt, escolherDescarteLegal };

  };

  __fabricas["contas"] = function (module, exports, require) {
// servidor/contas.js — CONTAS + PERSISTÊNCIA ("ligar aos dados reais")
// O COFRE do jogo: guarda, por jogador, o que hoje é mock na tela (moedas, XP,
// nível, vitórias, partidas, canastras) e sobrevive a reinícios do servidor.
//
// Princípios pé-no-chão desta camada:
//  1) IDENTIDADE SEM SENHA — cada jogador tem um `id` estável gerado no aparelho
//     dele (estilo "continuar como convidado"). Nada de e-mail/senha aqui: é o
//     padrão dos joguinhos casuais e evita todo o risco de guardar credencial.
//  2) SEM DEPENDÊNCIAS — persiste num arquivo JSON usando só `fs` (built-in do
//     Node), igual ao resto do servidor. No deploy, o arquivo mora num VOLUME do
//     Railway (disco que não some no redeploy). Zero banco de dados por enquanto.
//  3) ECONOMIA AJUSTÁVEL — todos os números (bônus, prêmios, XP) ficam no objeto
//     ECON, num lugar só, fáceis de a Sônia mexer sem caçar pelo código.
//
// Moedas são VIRTUAIS e não sacáveis (anti-aposta / regras de loja). O "pote" é
// só troca de fichas de brincadeira entre os jogadores da mesa.

const fs = require("fs");
const path = require("path");

// ------------------------- ECONOMIA (mexa à vontade) -------------------------
const ECON = {
  BONUS_BOAS_VINDAS: 1000, // moedas que todo novo jogador ganha ao criar a conta
  MOEDAS_VITORIA: 50,      // prêmio por vencer numa mesa SEM aposta
  MOEDAS_PARTICIPACAO: 10, // consolo por jogar (mesa sem aposta), pra todos
  XP_VITORIA: 100,         // XP base de quem vence
  XP_DERROTA: 40,          // XP base de quem perde (ninguém sai de mãos vazias)
  XP_POR_CANASTRA: 15,     // XP extra por canastra feita na partida
  XP_FRACAO_PLACAR: 0.02,  // + 2% dos pontos da dupla viram XP (recompensa jogar bem)
};

/** XP acumulado necessário pra ATINGIR o nível n. Curva suave e sempre crescente:
 *  nível 1 = 0 · 2 = 100 · 3 = 300 · 4 = 600 · 5 = 1.000 · 6 = 1.500 … */
function xpAcumuladoParaNivel(n) { return 50 * (n - 1) * n; }
function nivelDeXp(xp) {
  let n = 1;
  while (xpAcumuladoParaNivel(n + 1) <= xp) n++;
  return n;
}
/** Progresso dentro do nível atual: {nivel, xpNoNivel, xpProxNivel, faltam}. */
function progressoDeXp(xp) {
  const nivel = nivelDeXp(xp);
  const base = xpAcumuladoParaNivel(nivel);
  const prox = xpAcumuladoParaNivel(nivel + 1);
  return { nivel, xpNoNivel: xp - base, xpProxNivel: prox - base, faltam: prox - xp };
}

const DUPLAS = { nos: [0, 2], eles: [1, 3] };
function duplaDoAssento(a) { return (a === 0 || a === 2) ? "nos" : "eles"; }

/** Cria o gerenciador de contas. `opts.arquivo` define onde persistir; `opts.agora`
 *  injeta o relógio (testes); `opts.persistir:false` deixa tudo em memória. */
function criarContas(opts = {}) {
  const persistir = opts.persistir !== false;
  const dir = opts.dir || process.env.DADOS_DIR || path.join(__dirname, "..", "dados");
  const arquivo = opts.arquivo || path.join(dir, "contas.json");
  const agora = opts.agora || (() => Date.now());
  // fotos de avatar ficam ao lado do contas.json (no Volume, em DADOS_DIR/avatares)
  const avatarDir = path.join(path.dirname(arquivo), "avatares");
  const _avatarMem = {}; // fallback em memória (testes com persistir:false)

  let dados = { versao: 1, contas: {} };

  function carregar() {
    if (!persistir) return;
    try {
      if (fs.existsSync(arquivo)) {
        const bruto = JSON.parse(fs.readFileSync(arquivo, "utf8"));
        if (bruto && bruto.contas) dados = bruto;
      }
    } catch (e) {
      // arquivo corrompido não pode derrubar o servidor: começa limpo e avisa no log
      console.error("[contas] falha ao ler " + arquivo + " — começando vazio:", e.message);
      dados = { versao: 1, contas: {} };
    }
  }

  function salvar() {
    if (!persistir) return;
    try {
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      // escrita atômica: grava num .tmp e renomeia (renomear não deixa arquivo
      // pela metade se cair energia no meio da gravação)
      const tmp = arquivo + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(dados));
      fs.renameSync(tmp, arquivo);
    } catch (e) {
      console.error("[contas] falha ao salvar " + arquivo + ":", e.message);
    }
  }

  function contaPublica(c) {
    if (!c) return null;
    const p = progressoDeXp(c.xp);
    return {
      id: c.id, apelido: c.apelido,
      moedas: c.moedas, xp: c.xp, nivel: p.nivel,
      xpNoNivel: p.xpNoNivel, xpProxNivel: p.xpProxNivel, faltamXp: p.faltam,
      partidas: c.partidas, vitorias: c.vitorias, derrotas: c.derrotas,
      canastras: c.canastras,
      aproveitamento: c.partidas ? Math.round((c.vitorias / c.partidas) * 100) : 0,
      // avatar: tipo "foto" (upload, servido em /avatar/<id>), "galeria" (avatarId
      // = índice do avatar pronto) ou null (padrão). avatarVer serve de "cache-bust".
      avatarTipo: c.avatarTipo || null, avatarId: c.avatarId || null, avatarVer: c.avatarVer || 0,
    };
  }

  /** Pega a conta do jogador; cria (com bônus de boas-vindas) se for a 1ª vez. */
  function obterOuCriar(id, apelido) {
    if (!id) throw new Error("id do jogador é obrigatório");
    let c = dados.contas[id];
    if (!c) {
      c = dados.contas[id] = {
        id, apelido: (apelido || "Jogador").slice(0, 24),
        moedas: ECON.BONUS_BOAS_VINDAS, xp: 0,
        partidas: 0, vitorias: 0, derrotas: 0, canastras: 0,
        criadoEm: agora(), atualizadoEm: agora(),
      };
      salvar();
    } else if (apelido && apelido !== c.apelido) {
      c.apelido = apelido.slice(0, 24); c.atualizadoEm = agora(); salvar();
    }
    return contaPublica(c);
  }

  function obter(id) { return contaPublica(dados.contas[id]); }

  function atualizarApelido(id, apelido) {
    const c = dados.contas[id];
    if (!c) return null;
    c.apelido = (apelido || c.apelido).slice(0, 24); c.atualizadoEm = agora(); salvar();
    return contaPublica(c);
  }

  /** Ajusta moedas (piso em 0). n>0 credita, n<0 debita. */
  function ajustarMoedas(id, n) {
    const c = dados.contas[id];
    if (!c) return null;
    c.moedas = Math.max(0, c.moedas + Math.round(n)); c.atualizadoEm = agora();
    return c.moedas;
  }

  /**
   * Liquida o resultado de UMA partida encerrada e atualiza cada humano.
   * Entrada:
   *   jogadores: [{assento, id, apelido, canastras?}] — só assentos com conta
   *              (bots ficam de fora; passe só os humanos, ou id:null pra pular).
   *   placar:    { nos, eles }  (do jogo.placar ao encerrar)
   *   aposta:    entrada por jogador (0 = mesa sem aposta). Opcional.
   * Retorna um resumo por jogador (deltas + se subiu de nível) — bom pra tela.
   */
  function registrarPartida({ jogadores = [], placar = { nos: 0, eles: 0 }, aposta = 0 } = {}) {
    const humanos = jogadores.filter((j) => j && j.id);
    const vencedora = placar.nos >= placar.eles ? "nos" : "eles";
    aposta = Math.max(0, Math.round(aposta || 0));

    // pote (mesa com aposta): só entra quem tem conta e está sentado; vencedores
    // humanos dividem o pote. Cada um "pagou" a entrada ao começar — aqui a gente
    // debita a entrada de todos e credita o pote a quem venceu.
    const pagantes = humanos.length;
    const pote = aposta * pagantes;
    const vencedoresH = humanos.filter((j) => duplaDoAssento(j.assento) === vencedora);
    const quinhao = (aposta > 0 && vencedoresH.length) ? Math.floor(pote / vencedoresH.length) : 0;

    const resumo = { duplaVencedora: vencedora, aposta, pote, porJogador: [] };

    for (const j of humanos) {
      const c = dados.contas[j.id] || dados.contas[obterOuCriar(j.id, j.apelido).id];
      const venceu = duplaDoAssento(j.assento) === vencedora;
      const dupla = duplaDoAssento(j.assento);
      const canastras = Math.max(0, j.canastras || 0);

      const moedasAntes = c.moedas, nivelAntes = nivelDeXp(c.xp);

      // XP: base por resultado + fração do placar da própria dupla + canastras
      const xpGanho = (venceu ? ECON.XP_VITORIA : ECON.XP_DERROTA)
        + Math.round((placar[dupla] || 0) * ECON.XP_FRACAO_PLACAR)
        + canastras * ECON.XP_POR_CANASTRA;

      // MOEDAS
      let deltaMoedas;
      if (aposta > 0) {
        deltaMoedas = (venceu ? quinhao : 0) - aposta; // pagou a entrada; vencedor leva quinhão
      } else {
        deltaMoedas = ECON.MOEDAS_PARTICIPACAO + (venceu ? ECON.MOEDAS_VITORIA : 0);
      }

      c.xp += xpGanho;
      c.moedas = Math.max(0, c.moedas + deltaMoedas);
      c.partidas += 1;
      if (venceu) c.vitorias += 1; else c.derrotas += 1;
      c.canastras += canastras;
      c.atualizadoEm = agora();

      const nivelDepois = nivelDeXp(c.xp);
      resumo.porJogador.push({
        id: c.id, apelido: c.apelido, venceu,
        deltaMoedas: c.moedas - moedasAntes, deltaXp: xpGanho,
        moedas: c.moedas, xp: c.xp,
        nivelAntes, nivelDepois, subiuNivel: nivelDepois > nivelAntes,
      });
    }
    salvar();
    return resumo;
  }

  /** Ranking dos jogadores. Critério padrão: XP (progresso do jogador). */
  function ranking({ limite = 50, criterio = "xp" } = {}) {
    const lista = Object.values(dados.contas).map(contaPublica);
    const chave = criterio === "vitorias" ? "vitorias" : (criterio === "moedas" ? "moedas" : "xp");
    lista.sort((a, b) => (b[chave] - a[chave]) || (b.xp - a.xp) || (b.vitorias - a.vitorias));
    return lista.slice(0, limite).map((c, i) => Object.assign({ posicao: i + 1 }, c));
  }

  /** Posição de um jogador no ranking (1-based) por um critério. 0 se não achar. */
  function posicaoNoRanking(id, criterio = "xp") {
    const lista = ranking({ limite: Infinity, criterio });
    const i = lista.findIndex((c) => c.id === id);
    return i < 0 ? 0 : i + 1;
  }

  function totalDeContas() { return Object.keys(dados.contas).length; }

  // ------------------------------- AVATAR -------------------------------
  const AVATAR_MAX_BYTES = 250 * 1024; // teto ~250KB (o navegador já manda pequeno)
  function _avatarFile(id) { return path.join(avatarDir, encodeURIComponent(id) + ".jpg"); }

  /** Salva a FOTO do jogador (upload). Recebe data-URL ou base64 puro (JPEG/PNG).
   *  A imagem já vem pequena do navegador (recortada+redimensionada). */
  function definirAvatarFoto(id, dataUrl) {
    const c = dados.contas[id];
    if (!c) return { erro: "conta não encontrada" };
    let b64 = String(dataUrl || "");
    const m = b64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.*)$/i);
    if (m) b64 = m[2];
    let buf;
    try { buf = Buffer.from(b64, "base64"); } catch (e) { return { erro: "imagem inválida" }; }
    if (!buf || !buf.length) return { erro: "imagem vazia" };
    if (buf.length > AVATAR_MAX_BYTES) return { erro: "imagem muito grande (máx. 250KB)" };
    if (persistir) {
      try { fs.mkdirSync(avatarDir, { recursive: true }); fs.writeFileSync(_avatarFile(id), buf); }
      catch (e) { console.error("[contas] avatar write:", e.message); return { erro: "falha ao salvar a foto" }; }
    } else { _avatarMem[id] = buf; }
    c.avatarTipo = "foto"; c.avatarId = null; c.avatarVer = agora();
    c.reportsAvatar = 0; // foto nova zera denúncias anteriores
    c.atualizadoEm = agora(); salvar();
    return contaPublica(c);
  }

  /** Escolhe um avatar da GALERIA (avatar pronto). galeriaId = índice (1..N). */
  function definirAvatarGaleria(id, galeriaId) {
    const c = dados.contas[id];
    if (!c) return { erro: "conta não encontrada" };
    c.avatarTipo = "galeria"; c.avatarId = Math.max(1, parseInt(galeriaId, 10) || 1);
    c.avatarVer = agora(); c.atualizadoEm = agora();
    try { if (persistir && fs.existsSync(_avatarFile(id))) fs.unlinkSync(_avatarFile(id)); } catch (e) {}
    delete _avatarMem[id];
    salvar();
    return contaPublica(c);
  }

  /** Volta pro avatar padrão (apaga a foto). */
  function removerAvatar(id) {
    const c = dados.contas[id];
    if (!c) return { erro: "conta não encontrada" };
    c.avatarTipo = null; c.avatarId = null; c.avatarVer = agora(); c.atualizadoEm = agora();
    try { if (persistir && fs.existsSync(_avatarFile(id))) fs.unlinkSync(_avatarFile(id)); } catch (e) {}
    delete _avatarMem[id];
    salvar();
    return contaPublica(c);
  }

  /** Bytes da foto de um jogador (pra rota HTTP /avatar/<id>). null se não tiver. */
  function avatarBuffer(id) {
    const c = dados.contas[id];
    if (!c || c.avatarTipo !== "foto") return null;
    if (!persistir) return _avatarMem[id] || null;
    try { return fs.existsSync(_avatarFile(id)) ? fs.readFileSync(_avatarFile(id)) : null; } catch (e) { return null; }
  }

  /** Denúncia de foto imprópria (proteção do app público). Ao atingir o limite, a
   *  foto é OCULTADA automaticamente (volta pro padrão) até revisão. */
  function denunciarAvatar(alvoId) {
    const c = dados.contas[alvoId];
    if (!c || c.avatarTipo !== "foto") return { ok: false, motivo: "sem foto pra denunciar" };
    c.reportsAvatar = (c.reportsAvatar || 0) + 1;
    let ocultado = false;
    if (c.reportsAvatar >= 3) {
      c.avatarTipo = null; c.avatarVer = agora(); ocultado = true;
      try { if (persistir && fs.existsSync(_avatarFile(alvoId))) fs.unlinkSync(_avatarFile(alvoId)); } catch (e) {}
      delete _avatarMem[alvoId];
    }
    c.atualizadoEm = agora(); salvar();
    return { ok: true, reports: c.reportsAvatar, ocultado };
  }

  carregar();
  return {
    obterOuCriar, obter, atualizarApelido, ajustarMoedas, registrarPartida,
    ranking, posicaoNoRanking, totalDeContas, salvar, carregar,
    definirAvatarFoto, definirAvatarGaleria, removerAvatar, avatarBuffer, denunciarAvatar,
    _dados: () => dados, ECON,
  };
}

module.exports = {
  criarContas, ECON, nivelDeXp, xpAcumuladoParaNivel, progressoDeXp, duplaDoAssento,
};

  };

  __fabricas["outbox"] = function (module, exports, require) {
// servidor/outbox.js — OUTBOX DURÁVEL DE ENCERRAMENTOS.
//
// Guarda o envelope autoritativo de cada partida encerrada até que alguém o
// entregue. Nesta versão NINGUÉM entrega: não há rede aqui, de propósito. O
// transporte autenticado Railway→Functions é outra OS, e separar as duas coisas
// é o que permite provar durabilidade e idempotência sem depender de rede.
//
// POR QUE UM ARQUIVO POR PARTIDA, e não um único log:
//   * criação idempotente vira uma pergunta de existência (`existsSync`), sem
//     ler-modificar-escrever, que é onde duas liquidações simultâneas se
//     atropelariam;
//   * um envelope corrompido não leva os outros junto;
//   * o reinício do processo não precisa reconstruir índice nenhum — os
//     pendentes são os arquivos que estão lá.
//
// ATOMICIDADE: grava `.tmp` e renomeia, o MESMO idioma que `contas.js` já usa
// para o cofre. `rename` no mesmo sistema de arquivos é atômico, então nunca
// existe um arquivo de envelope pela metade — ou ele está inteiro, ou não está.
//
// O QUE NÃO MORA AQUI: token, credencial, URL de destino, resposta de Functions
// e qualquer coisa de economia. A outbox registra um FATO; ela não paga nada.

const fs = require("fs");
const path = require("path");

/** Estados de um registro. Só `pendente` é escrito nesta OS — os outros existem
 *  para o transporte futuro e estão nomeados aqui para que ele não os invente
 *  com outro nome. */
const ESTADO = Object.freeze({
  PENDENTE: "pendente",
  ENTREGUE: "entregue",
  FALHOU: "falhou",
});

/** Erro de leitura de um registro corrompido. Tipo próprio para que o chamador
 *  distinga "não existe" (normal) de "existe e está ilegível" (grave). */
class RegistroCorrompido extends Error {
  constructor(partidaId, causa) {
    super("registro de encerramento ilegível: " + partidaId + " (" + causa + ")");
    this.name = "RegistroCorrompido";
    this.partidaId = partidaId;
  }
}

/**
 * Cria a outbox em `dir` (padrão: DADOS_DIR/encerramentos).
 *
 * `persistir:false` mantém tudo em memória — os testes de mesa não precisam
 * tocar em disco, e o servidor sem volume gravável continua jogando.
 */
function criarOutbox(opts = {}) {
  const persistir = opts.persistir !== false;
  const base = opts.dir
    || path.join(process.env.DADOS_DIR || path.join(__dirname, "..", "dados"), "encerramentos");
  const agora = opts.agora || (() => new Date().toISOString());
  const memoria = new Map();

  let prontoParaDisco = false;
  if (persistir) {
    try {
      fs.mkdirSync(base, { recursive: true });
      prontoParaDisco = true;
    } catch (e) {
      // Sem disco gravável a partida continua: a outbox cai para memória e diz
      // isso alto. Derrubar a mesa porque o volume não montou seria trocar o
      // jogo pelo acessório.
      console.warn("[outbox] sem diretório gravável, seguindo em memória:", e.message);
    }
  }

  const arquivoDe = (partidaId) => path.join(base, partidaId + ".json");

  /** Um `partidaId` só pode virar nome de arquivo se for inofensivo. UUID passa;
   *  qualquer coisa com barra, ponto-ponto ou nulo, não. É travessia de caminho
   *  fechada na origem, mesmo o id nunca vindo do cliente. */
  function idValido(partidaId) {
    return typeof partidaId === "string" && /^[A-Za-z0-9._-]{8,128}$/.test(partidaId)
      && !partidaId.includes("..");
  }

  function existe(partidaId) {
    if (memoria.has(partidaId)) return true;
    if (!prontoParaDisco) return false;
    try { return fs.existsSync(arquivoDe(partidaId)); } catch (_) { return false; }
  }

  /**
   * Registra um envelope. IDEMPOTENTE: o segundo registro do mesmo `partidaId`
   * não reescreve nada e devolve `{criado:false}`.
   *
   * Devolve `{criado, partidaId, estado}`. Nunca lança por já existir — repetir
   * uma liquidação é caminho normal (retry, reprocessamento), não erro.
   */
  function registrar(envelope) {
    if (!envelope || !idValido(envelope.partidaId)) {
      return { criado: false, erro: "partidaId inválido", estado: null };
    }
    const partidaId = envelope.partidaId;
    if (existe(partidaId)) {
      return { criado: false, partidaId, estado: ESTADO.PENDENTE, jaExistia: true };
    }
    const quando = agora();
    const registro = {
      partidaId,
      versaoContrato: envelope.versaoContrato,
      estado: ESTADO.PENDENTE,
      tentativas: 0,
      criadoEm: quando,
      atualizadoEm: quando,
      envelope,
    };
    if (prontoParaDisco) {
      const alvo = arquivoDe(partidaId);
      const tmp = alvo + ".tmp";
      try {
        fs.writeFileSync(tmp, JSON.stringify(registro));
        fs.renameSync(tmp, alvo);
      } catch (e) {
        // FALHA DE ESCRITA NÃO VIRA ENTREGA. O registro não é marcado como
        // gravado, e o chamador recebe o erro para registrar no log. Guardar em
        // memória aqui mentiria sobre durabilidade.
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
        return { criado: false, partidaId, estado: null, erro: e.message };
      }
    } else {
      memoria.set(partidaId, registro);
    }
    return { criado: true, partidaId, estado: ESTADO.PENDENTE };
  }

  /** Lê um registro. `null` se não existe; lança [RegistroCorrompido] se existe
   *  e não é JSON válido — silenciar isso faria um envelope perdido parecer um
   *  envelope inexistente. */
  function ler(partidaId) {
    if (memoria.has(partidaId)) return memoria.get(partidaId);
    if (!prontoParaDisco) return null;
    const alvo = arquivoDe(partidaId);
    if (!fs.existsSync(alvo)) return null;
    try {
      return JSON.parse(fs.readFileSync(alvo, "utf8"));
    } catch (e) {
      throw new RegistroCorrompido(partidaId, e.message);
    }
  }

  /** Ids pendentes. Depois de um reinício, é a lista de arquivos que sobrou. */
  function pendentes() {
    if (!prontoParaDisco) {
      return [...memoria.values()].filter((r) => r.estado === ESTADO.PENDENTE).map((r) => r.partidaId);
    }
    try {
      return fs.readdirSync(base)
        .filter((n) => n.endsWith(".json"))
        .map((n) => n.slice(0, -5));
    } catch (_) {
      return [];
    }
  }

  return { registrar, ler, pendentes, existe, dir: base, ESTADO, RegistroCorrompido };
}

module.exports = { criarOutbox, ESTADO, RegistroCorrompido };

  };

  __fabricas["salas"] = function (module, exports, require) {
// servidor/salas.js — GERENCIADOR DE SALAS (multiplayer M2)
// Mesa privada por CÓDIGO, até 4 pessoas, assentos vazios viram BOT.
// - o criador senta no assento 0 e recebe o código pra compartilhar;
// - quem entra por código senta no próximo assento livre (1, 2, 3);
// - ao INICIAR (só o criador), os vazios viram bot e a rodada é distribuída;
// - depois de cada jogada humana, os assentos-bot jogam sozinhos até voltar a
//   vez de um humano (mesmo respiro do auto-play da mesa).
//
// Esta camada é PURA (sem rede): o servidor ws (servidor.js) é só um invólucro.
// Assim dá pra testar a mesa inteira aqui com "clientes simulados".

const J = require("../motor/jogo");
const { jogarTurnoBot } = require("./bot_motor");
const crypto = require("crypto");

const NOMES_BOT = ["Renato", "Cláudia", "Mateus", "Sofia"];

/** [MESA PRIVADA] Alfabeto do código da sala: 25 símbolos, escolhidos para
 *  serem DITADOS EM VOZ ALTA sem ambiguidade.
 *
 *  Fora da lista, de propósito: `0` e `O`, `1` e `I` e `L`, `2` e `Z`, `5` e
 *  `S`, `8` e `B`. Um código que se lê errado ao telefone vira uma tentativa
 *  falhada — e tentativa falhada consome o limitador de quem não fez nada de
 *  errado. */
const ALFABETO_CODIGO = "ACDEFGHJKMNPQRTUVWXY34679";

/** Quantos símbolos tem um código. 25^8 ≈ 1.5e11, ou ~37 bits. */
const TAMANHO_CODIGO = 8;

/** [MESA PRIVADA] Código da sala, com entropia criptográfica.
 *
 *  O QUE ISTO SUBSTITUI, e por que era um defeito:
 *
 *      "BURACO-" + Math.floor(1000 + Math.random() * 9000)
 *
 *  São NOVE MIL códigos possíveis (~13 bits), sorteados por um gerador NÃO
 *  criptográfico. Um script percorre o espaço inteiro em segundos, e a cada
 *  acerto entra numa sala privada de outra pessoa. Numa mesa que exige VIP de
 *  cada ocupante isso nem é a pior parte: a pior parte é que o código, sendo
 *  adivinhável, vira um canal de descoberta de quem está jogando com quem.
 *
 *  A redução de byte para símbolo é por REJEIÇÃO, e não por `% 25`. O módulo
 *  enviesaria — 256 não é múltiplo de 25, então os seis primeiros símbolos do
 *  alfabeto sairiam com ~1.22x a chance dos demais. O viés não quebra o código
 *  sozinho, mas corta entropia de graça, e entropia é a única coisa que este
 *  código tem.
 *
 *  O formato mudou (`BMV-XXXX-XXXX`), e isso é deliberado: um código do formato
 *  antigo apresentado hoje é reconhecivelmente antigo, e não um código válido
 *  de uma sala que não existe mais. */
function gerarCodigoPadrao() {
  const limite = 256 - (256 % ALFABETO_CODIGO.length); // maior múltiplo de 25 ≤ 256
  let saida = "";
  while (saida.length < TAMANHO_CODIGO) {
    for (const b of crypto.randomBytes(32)) {
      if (b >= limite) continue; // rejeitado: usar seria enviesar
      saida += ALFABETO_CODIGO[b % ALFABETO_CODIGO.length];
      if (saida.length === TAMANHO_CODIGO) break;
    }
  }
  return "BMV-" + saida.slice(0, 4) + "-" + saida.slice(4, 8);
}

/** Natureza da mesa, decidida pelo SERVIDOR. Nunca vem do cliente.
 *
 *  `publica` e `privada` são partidas reais e contam para conquista pessoal —
 *  a privada fica fora do ranking por ser combinável, mas quem jogou jogou.
 *  `simulada` é o default CONSERVADOR de qualquer mesa cuja natureza não tenha
 *  sido declarada pelo servidor: na dúvida, não conta. */
// ===========================================================================
// [CONTROLADOR] CONTROLE DE ASSENTO — separado da POSSE (OS 7 §3).
//
// POSSE responde "de quem é este assento": vive em `sala.assentos[i]`
// (`{ tipo, apelido, jogadorId }`), é congelada em `iniciarPartida` e
// NENHUM caminho desta OS a altera. É ela que `composicaoDoCanal` lê para o
// chat, e é por isso que uma queda de rede não remexe o canal.
//
// CONTROLE responde "quem fornece a próxima intenção deste assento": vive em
// `sala.controle[i]`, fora de `sala.jogo`. Ficar fora do objeto de jogo é
// deliberado — o controlador não é regra de Buraco e não pode encostar em mão,
// monte, lixo, morto, vez, obrigação de topo ou placar (§10).
//
// `sala.jogo.assentos[i].tipo` continua existindo e continua alternando entre
// "humano" e "bot", mas passa a ser DERIVADO: quem decide é `controle`. O
// motor e o bot leem `tipo`; a autoridade é `controle`.
// ===========================================================================
const CONTROLE = Object.freeze({
  HUMANO_ATIVO: "humano_ativo",      // conectado e no comando
  HUMANO_AUSENTE: "humano_ausente",  // caiu, assento RESERVADO, ninguém joga
  BOT_SUBSTITUTO: "bot_substituto",  // bot jogando assento de dono humano
  BOT_DE_MESA: "bot_de_mesa",        // nasceu bot em iniciarPartida, sem dono
});
/** Motivo da perda de controle. Queda NÃO é desistência (§7). */
const MOTIVO_CONTROLE = Object.freeze({
  QUEDA: "queda_de_conexao",
  AFK: "afk",
  SAIDA: "saida_voluntaria",
});
/** Os dois estados em que o assento é jogado por bot. */
const CONTROLES_DE_BOT = new Set([CONTROLE.BOT_SUBSTITUTO, CONTROLE.BOT_DE_MESA]);
/** Graça de ausência por QUEDA (§5). Configuração do SERVIDOR: entra por
 *  `criarGerenciador({ gracaAusenciaMs })`, nunca por mensagem do cliente. */
const GRACA_AUSENCIA_PADRAO_MS = 15000;

const TIPOS_DE_PARTIDA = ["publica", "privada", "simulada"];
const TIPO_PADRAO = "privada";

/** Versão do contrato do envelope de encerramento. */
const VERSAO_CONTRATO_ENCERRAMENTO = 1;

/** Único motivo de encerramento que este servidor sabe produzir.
 *
 *  O motor encerra a partida em UM lugar só (`contarPontos`, quando o placar
 *  cruza a meta). Abandono, WO, expulsão e anulação NÃO existem aqui — e
 *  inventá-los seria criar vocabulário sem código por trás. Encerramento que
 *  chegue por outro caminho vira [MOTIVO_DESCONHECIDO], que é inelegível. */
const MOTIVO_META = "meta_alcancada";
const MOTIVO_DESCONHECIDO = "desconhecido";

/** Tipos que valem para conquista. Lista fechada e positiva: um tipo novo
 *  criado amanhã não entra sozinho — precisa ser escrito aqui, de propósito. */
const TIPOS_VALIDOS_PARA_CONQUISTA = new Set(["publica", "privada"]);

/** Identificador imutável de UMA partida.
 *
 *  Gerado pelo servidor, sempre. Não é o código da sala (que se repete entre
 *  partidas e é escolhido para ser digitável), nem derivado de horário ou de
 *  UIDs concatenados — os dois colidem e os dois vazam informação. `randomUUID`
 *  é criptográfico e não precisa de coordenação entre processos. */
function novoPartidaId() {
  return crypto.randomUUID();
}
// ===========================================================================
// [GATE VIP] CATEGORIA COMPETITIVA DA MESA E GATE AUTORITATIVO DE ADMISSAO
//
// O problema: o servidor sabia dizer QUE TIPO DE SALA e uma mesa (publica,
// privada, simulada) e nao sabia dizer NADA sobre a natureza competitiva dela.
// Nao existia instante em que o servidor pudesse afirmar, por conta propria,
// "este UID autenticado esta prestes a ocupar um assento numa partida
// VIP/Ranqueada" - e sem esse instante nao ha onde pendurar autorizacao,
// consumo de passe, idempotencia ou recusa.
//
// DUAS DIMENSOES, NAO UMA. `tipoPartida` e TOPOLOGIA da sala (como se chega
// nela); `categoriaCompetitiva` e NATUREZA COMPETITIVA (o que a partida vale).
// Elas se cruzam, nao se substituem: uma mesa publica pode ser casual, e a
// modalidade competitiva oficial e a VIP/Ranqueada. Enfiar `vip` dentro de
// `TIPOS_DE_PARTIDA` colapsaria as duas e faria a topologia responder por uma
// pergunta que ela nao sabe responder - por isso a enumeracao de topologia
// permanece exatamente com os tres valores que sempre teve, e existe teste
// estrutural que derruba a suite se `vip` aparecer la.
//
// NENHUM BOOLEANO PARALELO. Nao existe `isVip`, `ehVip` nem `mesaVip`. Um
// booleano ao lado de uma enumeracao fechada e uma segunda autoridade: as duas
// divergem no primeiro caminho que esquecer de atualizar uma delas, e a
// divergencia aparece como mesa que cobra sem ser ranqueada (ou o contrario).
// ===========================================================================

/** Natureza competitiva da mesa. Enumeracao FECHADA.
 *
 *  `casual`         partida que nao vale ranking nem exige direito de entrada;
 *  `vip_ranqueada`  a modalidade competitiva oficial, que exige admissao
 *                   autorizada antes de alguem ocupar assento.
 *
 *  Combinacao comercial nova nao nasce aqui por acidente: acrescentar valor a
 *  esta lista e edicao visivel, e a matriz de admissao precisa saber o que
 *  fazer com ele - categoria que o gate nao reconhece NAO passa. */
const CATEGORIAS_COMPETITIVAS = ["casual", "vip_ranqueada"];

/** Padrao de quem nao declarou nada. E `casual` porque e a verdade da base:
 *  toda mesa que existe hoje e casual, e nenhuma delas exige direito de
 *  entrada. Silencio significa "a de sempre", nunca "a que cobra". */
const CATEGORIA_PADRAO = "casual";

/** Valor declarado que NAO esta na enumeracao. Nao e sinonimo de `casual` -
 *  e o contrario disso.
 *
 *  `tipoPartida` resolve valor invalido para `simulada`, que e o conservador
 *  DELE: uma partida que nao conta para conquista. Aqui o conservador e outro.
 *  Rebaixar categoria desconhecida para `casual` transformaria erro de
 *  configuracao em mesa aberta e gratuita - silenciosamente, e justamente na
 *  dimensao que decide se alguem paga para entrar. Entao categoria
 *  desconhecida nao vira casual e nao vira VIP: ela nao admite ninguem. */
const CATEGORIA_DESCONHECIDA = "desconhecida";

/** Codigos de recusa da admissao. Estaveis (o cliente pode ramificar neles) e
 *  REDIGIDOS: nenhum deles conta quem e o jogador, qual e o direito que falta,
 *  qual assento estava livre ou por que o adaptador respondeu o que respondeu. */
const RECUSA_VIP_INDISPONIVEL = "ADMISSAO_VIP_INDISPONIVEL";
const RECUSA_CATEGORIA_DESCONHECIDA = "ADMISSAO_CATEGORIA_DESCONHECIDA";

/** Mensagem unica das recusas de admissao. Uma so, de proposito: mensagens
 *  diferentes por motivo viram oraculo - quem tentar entrar varias vezes le nas
 *  diferencas o estado interno que o codigo de recusa nao conta. */
const ERRO_ADMISSAO = "entrada indisponivel nesta mesa";

/** Como a tentativa foi CLASSIFICADA. Nao e o veredito (isso e `ok`): e o que
 *  a tentativa E, e sobrevive a recusa.
 *
 *  A distincao existe agora porque ela e cara de acrescentar depois: quando o
 *  consumo de passe existir, reconexao ao proprio assento NAO pode consumir um
 *  segundo direito, e a unica forma de garantir isso e a admissao ja ter
 *  chegado ao adaptador dizendo o que ela e. Nesta OS a classificacao nao muda
 *  o veredito de sala VIP (que falha fechada dos dois jeitos) - ela existe para
 *  que ninguem precise adivinhar depois. */
const ADMISSAO_NOVA = "admissao_nova";
const ADMISSAO_RECONEXAO = "reconexao_ao_proprio_assento";

/** Prefixo do identificador de tentativa de entrada.
 *
 *  Existe por UM motivo: `tentativaEntradaId` e `eventoId` sao os dois
 *  identificadores opacos que circulam por aqui, os dois sao UUID, e troca-los
 *  um pelo outro seria um erro silencioso - o de versao da visao viraria chave
 *  de idempotencia de consumo, e um reenvio de estado passaria por tentativa
 *  nova de entrada. Com o prefixo, a troca e DETECTAVEL: `eventoId` nunca
 *  comeca com ele, e ha teste que afirma isso nos dois sentidos. */
const PREFIXO_TENTATIVA = "te_";

/** [BACKEND] Um valor que se comporta como promessa.
 *
 *  Existe porque a admissao passou a ter DOIS regimes: mesa casual decide
 *  agora, sem sair do processo; mesa VIP decide depois, quando um backend
 *  responder. Distinguir os dois por `then` - e nao por uma flag - e o que
 *  permite que o caminho casual continue percorrendo exatamente as mesmas
 *  linhas de antes, sem um unico microtask a mais. */
function ehPromessa(x) {
  return !!x && (typeof x === "object" || typeof x === "function") && typeof x.then === "function";
}

/** [BACKEND] Recusa de admissao, no formato que as portas de mesa devolvem. */
function recusaDaAdmissao(d) {
  return { erro: d.erro, codigoRecusa: d.codigoRecusa };
}

/** [BACKEND] PONTO UNICO em que uma decisao de admissao vira EFEITO.
 *
 *  Toda ocupacao de assento passa por aqui, nos dois regimes. `escrever` e o
 *  fecho que sabe gravar o assento daquela porta, e ele SO e chamado com uma
 *  decisao aprovada - nao existe caminho em que a escrita aconteca antes de o
 *  veredito existir, e nao existe caminho em que ela aconteca sem veredito.
 *
 *  A assimetria e proposital: mesa casual devolve VALOR e mesa VIP devolve
 *  PROMESSA. Nao e "as vezes assincrono conforme o dado" - e por processo: um
 *  servidor roda mesas de uma categoria so, fixada na construcao, entao para
 *  quem chama a porta o regime e constante. Uniformizar tudo em promessa
 *  custaria um microtask em cada entrada de mesa casual, que e o caminho de
 *  todo mundo hoje, e quebraria o encadeamento sincrono de quem ja chama. */
function concluirAdmissao(admissao, escrever) {
  if (ehPromessa(admissao)) {
    return admissao.then((d) => (d.ok ? escrever(d) : recusaDaAdmissao(d)));
  }
  return admissao.ok ? escrever(admissao) : recusaDaAdmissao(admissao);
}

/** [BACKEND] Registro de falha do adaptador. SO o codigo, nunca a mensagem.
 *
 *  `e.message` de um erro de socket do Node carrega a URL inteira do pedido, e
 *  a URL pode carregar chave em query. O codigo ja vem redigido da origem e e
 *  o que o operador precisa. */
function registrarFalhaDeAdmissao(codigoDaSala, classificacao, e) {
  const motivo = e && e.codigo ? e.codigo : "ERRO";
  console.error("[gate-vip] adaptador de admissao falhou · mesa=" + codigoDaSala +
    " classificacao=" + classificacao + " motivo=" + motivo);
}

/** Resolve a categoria a partir da CONFIGURACAO. Tres respostas, e so tres:
 *  ausente vira o padrao, valor da enumeracao vira ele mesmo, e qualquer outra
 *  coisa vira `desconhecida` - que nao admite ninguem. */
function normalizarCategoria(valor) {
  if (valor === undefined || valor === null) return CATEGORIA_PADRAO;
  return CATEGORIAS_COMPETITIVAS.includes(valor) ? valor : CATEGORIA_DESCONHECIDA;
}

/** Identidade OPACA de UMA tentativa de confirmacao de assento.
 *
 *  Sorteada, nunca calculada: nao deriva de uid, de codigo de sala, de assento
 *  nem de horario. Derivar de qualquer um deles faria o identificador carregar
 *  o dado por dentro - e um identificador que se pode ler deixa de ser opaco no
 *  dia em que alguem o loga, o guarda ou o manda para um terceiro.
 *
 *  E por tentativa, nao por jogador nem por partida: duas tentativas do mesmo
 *  uid na mesma sala tem ids diferentes. E isso que a torna utilizavel como
 *  chave de idempotencia quando o consumo existir - e e por isso que ela NAO
 *  significa, hoje, que algo foi concedido ou consumido. Ela nomeia a
 *  tentativa; o efeito dela e outra coisa, e essa outra coisa nao existe. */
function novaTentativaEntradaId() {
  return PREFIXO_TENTATIVA + crypto.randomUUID();
}

/** Forma esperada de um `tentativaEntradaId` cunhado por este servidor. */
function ehTentativaEntradaId(v) {
  return typeof v === "string" && v.startsWith(PREFIXO_TENTATIVA) && v.length > PREFIXO_TENTATIVA.length;
}

/** Assento que o titular `jogadorId` ja ocupa nesta sala; -1 se nenhum.
 *
 *  E daqui - e so daqui - que sai a classificacao de reconexao. O cliente nao
 *  declara que esta reconectando: o servidor OLHA quem ja esta sentado. Um
 *  campo `reconexao` vindo no payload seria exatamente o botao de "nao me
 *  cobre de novo" que a proxima OS nao pode oferecer a ninguem. */
function assentoDoTitular(sala, jogadorId) {
  if (!sala || jogadorId == null || jogadorId === "") return -1;
  const alvo = String(jogadorId);
  for (let i = 0; i < 4; i++) {
    const a = sala.assentos[i];
    if (a && a.tipo === "humano" && a.jogadorId != null && String(a.jogadorId) === alvo) return i;
  }
  return -1;
}

/** PONTO UNICO DE ADMISSAO AO ASSENTO.
 *
 *  Responde UMA pergunta: "esta ocupacao de assento pode prosseguir?". Roda
 *  depois da autenticacao e ANTES de o jogador ser gravado no assento - nunca
 *  ao abrir lobby, tocar em botao, consultar sala ou entrar para assistir.
 *  Espectador nao passa por aqui porque espectador nao ocupa assento, e o
 *  caminho de `assistirMesa` nao chama esta funcao.
 *
 *  O SUJEITO E O `uid` AUTENTICADO. Nao e apelido, nao e publicId, nao e
 *  `jogadorId` declarado em mensagem: e o valor que `vincularIdentidade`
 *  gravou a partir do `sub` do token verificado, e que e imutavel na conexao.
 *  Nenhum campo deste contrato pode ser preenchido com dado escolhido pelo
 *  cliente - `categoriaCompetitiva` vem da configuracao do processo,
 *  `tentativaEntradaId` e cunhado aqui dentro do servidor, `assento` e o que o
 *  gerenciador concedeu e `reconexao` e derivada de quem ja esta sentado.
 *
 *  FALHA FECHADA em todo caminho que nao seja explicitamente permitido:
 *
 *    categoria fora da enumeracao   ->  recusa (nao vira casual)
 *    tentativa sem id do servidor   ->  recusa
 *    vip_ranqueada sem uid          ->  recusa
 *    vip_ranqueada sem adaptador    ->  recusa   <- o estado de HOJE
 *    vip_ranqueada, adaptador != ok ->  recusa
 *    casual                         ->  segue, exatamente como antes
 *
 *  `casual` nao exige uid de proposito: e o comportamento preexistente da mesa,
 *  e esta OS nao pode muda-lo. A exigencia de identidade e da mesa que cobra.
 *
 *  `portas.autorizarEntradaVip` e A PORTA - unica - do adaptador autoritativo
 *  da proxima OS. Ausente por padrao, e ausente significa recusa: nao existe
 *  liberacao automatica enquanto nao houver quem autorize, e nao existe bypass
 *  de desenvolvimento ligado sozinho. So `{ ok: true }` aprova; resposta
 *  truthy qualquer, `undefined` ou excecao recusam.
 *
 *  A DECISAO NAO E O PAYLOAD. Ela carrega classificacao e categoria para quem
 *  chamou; o que chega ao cliente e so a mensagem redigida e o codigo estavel. */
function avaliarAdmissaoAoAssento({
  uidAutenticado,
  codigoDaSala,
  identidadeDaPartida,
  assento,
  categoriaCompetitiva,
  tentativaEntradaId,
  reconexao,
  tipoPartida,
} = {}, portas = {}) {
  // Classificacao PRIMEIRO, e fora de qualquer ramo de veredito: ela descreve a
  // tentativa, e tem de estar certa inclusive quando a resposta e "nao".
  // `=== true` estrito porque valor truthy vindo de lugar nenhum nao pode
  // promover uma entrada nova a reconexao.
  const classificacao = reconexao === true ? ADMISSAO_RECONEXAO : ADMISSAO_NOVA;

  const decisao = (extra) => Object.freeze(Object.assign({
    categoriaCompetitiva,
    classificacao,
    tentativaEntradaId,
    assento,
    codigoDaSala,
    identidadeDaPartida: identidadeDaPartida == null ? null : identidadeDaPartida,
  }, extra));

  const recusa = (codigoRecusa) => decisao({ ok: false, codigoRecusa, erro: ERRO_ADMISSAO });

  if (!CATEGORIAS_COMPETITIVAS.includes(categoriaCompetitiva)) {
    return recusa(RECUSA_CATEGORIA_DESCONHECIDA);
  }

  // Um id que nao foi cunhado por `novaTentativaEntradaId` nao identifica
  // tentativa nenhuma. Recusar aqui fecha, de graca, o caminho em que alguem um
  // dia deixe o valor chegar de fora.
  if (!ehTentativaEntradaId(tentativaEntradaId)) {
    return recusa(RECUSA_VIP_INDISPONIVEL);
  }

  // [MESA PRIVADA] QUEM PRECISA DE AUTORIZACAO. Duas dimensoes, e nao uma —
  // que e o mesmo motivo pelo qual `tipoPartida` e `categoriaCompetitiva` nao
  // foram colapsadas num campo so.
  //
  //   vip_ranqueada .... ambiente competitivo oficial. Exige assinatura ativa
  //                      OU passe de cortesia.
  //   privada .......... beneficio EXCLUSIVO VIP, mesmo sendo `casual`. Exige
  //                      assinatura ativa de CADA ocupante, e o codigo da sala
  //                      nao substitui direito nenhum.
  //
  // A Mesa Privada nao alimenta o Ranking, e por isso ela NAO e
  // `vip_ranqueada`. Se fosse, sala fechada com adversarios escolhidos a dedo
  // passaria a pontuar — que e a forma mais barata de farmar rating que
  // existe. As duas respostas divergem, entao sao duas perguntas.
  //
  // Quem decide QUAL das duas fontes de elegibilidade vale e o backend, e nao
  // este arquivo: o gate transporta a pergunta e le a resposta. Ele nao sabe o
  // que e assinatura, o que e cortesia, nem que a cortesia nao serve na
  // Privada.
  const exigeAutorizacao =
    categoriaCompetitiva === "vip_ranqueada" || tipoPartida === "privada";

  if (!exigeAutorizacao) {
    return decisao({ ok: true, codigoRecusa: null, erro: null });
  }

  // Daqui para baixo e mesa que exige elegibilidade.
  if (typeof uidAutenticado !== "string" || uidAutenticado === "") {
    return recusa(RECUSA_VIP_INDISPONIVEL);
  }

  const autorizar = portas && typeof portas.autorizarEntradaVip === "function"
    ? portas.autorizarEntradaVip
    : null;
  if (!autorizar) return recusa(RECUSA_VIP_INDISPONIVEL);

  // [BACKEND] A leitura da resposta do adaptador, em UM lugar so - os dois
  // regimes (agora e depois) caem aqui, para que a regra de aprovacao nao
  // exista duas vezes e nao divirja no primeiro ajuste.
  //
  // O `admissaoId` e CARREGADO, nao exigido. Quem o exige e o adaptador, que e
  // onde o contrato de transporte mora: o gate e politica, e nao deve saber
  // que admissoes tem identidade emitida por um backend. Uma porta injetada
  // que aprove sem id continua aprovando, e o assento fica sem prova - o que e
  // problema de quem injetou, e nao um buraco desta funcao.
  const julgar = (r) => {
    if (!r || r.ok !== true) return recusa(RECUSA_VIP_INDISPONIVEL);
    const admissaoId = r.admissaoId == null || r.admissaoId === "" ? null : String(r.admissaoId);
    return decisao({ ok: true, codigoRecusa: null, erro: null, admissaoId });
  };

  let resposta = null;
  try {
    resposta = autorizar({
      uidAutenticado,
      codigoDaSala,
      identidadeDaPartida: identidadeDaPartida == null ? null : identidadeDaPartida,
      assento,
      categoriaCompetitiva,
      tentativaEntradaId,
      classificacao,
    });
  } catch (e) {
    registrarFalhaDeAdmissao(codigoDaSala, classificacao, e);
    return recusa(RECUSA_VIP_INDISPONIVEL);
  }
  // Adaptador de rede responde DEPOIS. Uma promessa rejeitada - transporte
  // caido, timeout, backend fora do ar - e recusa, nunca aprovacao: falha
  // externa nao pode virar entrada liberada.
  if (ehPromessa(resposta)) {
    return resposta.then(julgar, (e) => {
      registrarFalhaDeAdmissao(codigoDaSala, classificacao, e);
      return recusa(RECUSA_VIP_INDISPONIVEL);
    });
  }
  return julgar(resposta);
}

// ===========================================================================
// [VERSAO] VERSIONAMENTO DA VISÃO AUTORITATIVA
//
// O problema: o evento `estado` saía sem nenhuma marca de emissão. Duas visões
// idênticas no fio eram indistinguíveis de uma visão repetida, e uma visão
// atrasada (reenvio, reconexão, corrida entre conexões) chegava sem nada que
// permitisse ao cliente recusá-la. O cliente Dart já tinha uma heurística de
// "este estado pode substituir o anterior?" — sem base formal nenhuma.
//
// A solução: todo evento `estado` carrega o par (versaoEstado, eventoId).
//
//   versaoEstado  inteiro monotônico, atribuído pelo servidor, que avança
//                 EXATAMENTE uma vez por mutação autoritativa consolidada;
//   eventoId      identificador opaco, estável enquanto a versão for a mesma.
//
// POR QUE IMPRESSÃO DE ESTADO, E NÃO UM CONTADOR NOS PONTOS DE MUTAÇÃO.
//
// Um contador exigiria um `++` em cada lugar que muta a mesa, e esses lugares
// não são um só: `entrarMesa`, `iniciarPartida`, `aplicarJogada`, `avancarBots`,
// `jogarUmBot`, `sair`, `liquidar` — e ainda `afkBot`/`afkVoltar`, que mexem em
// `sala.jogo.assentos[i].tipo` de DENTRO do despachante, fora deste arquivo.
// Esquecer um `++` produziria o pior defeito possível: um estado novo emitido
// com a versão velha, que o cliente descartaria como repetido. O erro seria
// silencioso e nenhum teste de regra o pegaria.
//
// A impressão inverte o risco. Ela pergunta ao próprio estado se ele mudou, e
// por isso cobre de graça toda mutação — inclusive as duas que acontecem fora
// do gerenciador, e inclusive as que alguém escrever amanhã. O modo de falhar
// deixa de ser "não incrementou" e passa a ser "incrementou à toa", que é
// visível e inofensivo: o cliente processa uma visão que ele já tinha.
//
// Ela também acerta um caso que o contador erraria. Uma jogada RECUSADA pode
// mudar o estado — o foul de abertura vulnerável devolve as cartas para a mão,
// e `aplicarJogada` retransmite antes de responder o erro. Contar "comandos
// aceitos" daria a mesma versão para dois estados diferentes. A impressão vê a
// mudança e versiona; e a recusa que NÃO muda nada não versiona.
// ===========================================================================

/** Campos da sala que NÃO são estado autoritativo, e por isso não entram na
 *  impressão. São dois grupos, e só dois:
 *
 *  1. O PRÓPRIO CARIMBO (`versaoEstado`, `eventoId`, `impressaoEstado`).
 *     Incluí-los faria a impressão mudar por causa da impressão anterior, e a
 *     versão avançaria a cada leitura, para sempre.
 *
 *  2. ESCRITURAÇÃO DE EMISSÃO (`fimEmitido`). É a trava que garante que o
 *     evento `fim` sai uma vez só — ela registra que uma NOTIFICAÇÃO foi
 *     enviada, não que a partida mudou. O estado do encerramento em si
 *     (`liquidada`, `resumoFinal`, `envelopeEncerramento`) é autoritativo, é
 *     gravado por `liquidar` ANTES do broadcast, e continua versionando
 *     normalmente. Sem esta exclusão, mandar o `fim` fabricaria uma versão
 *     nova logo depois da versão do encerramento — e §5 é explícita: nada que
 *     não seja mutação da partida pode fingir ser versão nova.
 *
 *  A lista é de EXCLUSÃO, e é assim de propósito. Um campo autoritativo novo
 *  acrescentado à sala amanhã passa a ser versionado sozinho, sem ninguém
 *  precisar lembrar de registrá-lo aqui. Uma lista de inclusão falharia para o
 *  lado errado: o campo novo mudaria sem gerar versão.
 *
 *  Em compensação, ACRESCENTAR algo aqui é um ato deliberado, e o conteúdo
 *  exato da lista está fixado por teste (VER-23): incluir um campo que é estado
 *  de verdade derruba a suíte em vez de silenciar uma mutação. */
const CAMPOS_FORA_DA_IMPRESSAO = new Set([
  "versaoEstado", "eventoId", "impressaoEstado", // o carimbo
  "fimEmitido",                                   // escrituração de emissão
]);

/** Impressão do estado autoritativo da sala.
 *
 *  Não é hash criptográfico de segurança — é detecção de mudança. Só precisa
 *  ser estável para o mesmo estado e diferente para estados diferentes.
 *
 *  `log` entra pela CONTAGEM, não pelo conteúdo: ele só cresce (uma linha por
 *  turno de bot), nunca é reescrito, e serializá-lo inteiro a cada emissão
 *  custaria proporcionalmente ao tamanho da partida sem detectar nada que o
 *  tamanho já não detecte.
 *
 *  Falha de serialização NÃO é silenciada e NÃO devolve a impressão anterior:
 *  devolve um valor único, que força o carimbo a avançar. Entre "repetir a
 *  versão de um estado que talvez tenha mudado" e "avançar a versão de um
 *  estado que talvez não tenha mudado", só o segundo é seguro — o cliente
 *  reprocessa uma visão igual, em vez de descartar uma visão nova. */
function impressaoDoEstado(sala) {
  try {
    const projecao = {};
    for (const chave of Object.keys(sala).sort()) {
      if (CAMPOS_FORA_DA_IMPRESSAO.has(chave)) continue;
      projecao[chave] = chave === "log" ? (sala.log ? sala.log.length : 0) : sala[chave];
    }
    return crypto.createHash("sha1").update(JSON.stringify(projecao)).digest("hex");
  } catch (e) {
    console.error("[versao] impressao do estado falhou; versao sera avancada por seguranca · mesa=" +
      sala.codigo + " erro=" + e.message);
    return "indeterminada-" + crypto.randomUUID();
  }
}

/** PONTO ÚNICO DE ATRIBUIÇÃO DA VERSÃO. Nenhum outro lugar escreve
 *  `versaoEstado` ou `eventoId` — nem o despachante, nem a conexão, nem o
 *  transporte.
 *
 *  Atômico porque é síncrono: o Node roda uma única linha de execução, e entre
 *  ler a impressão e gravar o carimbo não existe ponto de suspensão. Duas
 *  conexões não conseguem carimbar em paralelo nem produzir versão regressiva —
 *  a segunda encontra o carimbo da primeira já gravado.
 *
 *  Idempotente: chamar de novo sem mutação no meio devolve o MESMO par. É o que
 *  faz as quatro visões de assento e a visão de espectador saírem carimbadas
 *  igual, e é o que faz reenvio e reconexão reaproveitarem a versão vigente em
 *  vez de inventarem uma.
 *
 *  `eventoId` é `randomUUID`, e não algo derivado da versão ou da partida, por
 *  dois motivos: não pode colidir com o de outra partida (nem numa revanche na
 *  mesma sala) e não pode ser parseável — id derivado convida o cliente a ler
 *  dentro dele, e aí o formato vira contrato. Sendo opaco, não carrega uid,
 *  token, carta, mão nem qualquer coisa do estado: é sorteado, não calculado. */
function carimbarEstado(sala) {
  if (!sala) return null;
  const atual = impressaoDoEstado(sala);
  if (sala.impressaoEstado !== atual) {
    sala.impressaoEstado = atual;
    sala.versaoEstado = (sala.versaoEstado || 0) + 1;
    sala.eventoId = crypto.randomUUID();
  }
  return { versaoEstado: sala.versaoEstado, eventoId: sala.eventoId };
}

/** Retrato imutável de quem ocupa cada assento, tirado no início da partida.
 *
 *  O `uid` de humano vem de `sala.assentos[i].jogadorId`, que o despachante
 *  preenche com `c.jogadorId` — gravado por `vincularIdentidade` a partir do
 *  `sub` do token verificado, e IMUTÁVEL (`writable:false`). Nenhum campo de
 *  mensagem alcança este mapa: `jogadorId` alegado num payload é recusado antes,
 *  por `identidadeDivergente`.
 *
 *  Bot não tem uid, e não ganha um por acidente: o campo é preenchido só quando
 *  `tipo === "humano"`. Espectador não aparece — ele não ocupa assento, e o mapa
 *  é por assento.
 *
 *  Apelido NÃO entra. Ele é escolhido pelo jogador, muda no meio da partida e
 *  não identifica ninguém; guardá-lo aqui convidaria a inferir identidade por
 *  nome, que é exatamente o que este mapa existe para tornar desnecessário. */
function mapaDeParticipantes(sala) {
  const lista = [];
  for (let i = 0; i < 4; i++) {
    const a = sala.assentos[i];
    const humano = !!(a && a.tipo === "humano");
    lista.push(Object.freeze({
      assento: i,
      uid: humano && a.jogadorId ? String(a.jogadorId) : null,
      dupla: i % 2 === 0 ? "nos" : "eles",
      tipo: humano ? "humano" : "bot",
    }));
  }
  return Object.freeze(lista);
}

/** UID do titular de um assento, segundo o mapa congelado. `null` para bot,
 *  assento fora de 0..3 ou partida sem mapa (não deveria acontecer). */
function uidDoAssento(sala, assento) {
  if (!sala || !sala.participantes || !Number.isInteger(assento)) return null;
  const p = sala.participantes[assento];
  return p ? p.uid : null;
}

/** O envelope autoritativo de encerramento de UMA partida.
 *
 *  Capturado UMA vez, em `liquidar`, depois de o estado final estar consolidado
 *  — placar somado, `encerrada` marcada, `assentoQueBateuFinal` gravado. Antes
 *  disso qualquer retrato estaria incompleto; depois, o estado não muda mais.
 *
 *  DETERMINÍSTICO para o mesmo encerramento: todos os campos saem do estado
 *  canônico, e o único não-determinístico (`encerradaEm`) é carimbado uma vez e
 *  guardado com o envelope, não recalculado a cada leitura.
 *
 *  O QUE NÃO ENTRA, e é decisão e não esquecimento: mão, carta, monte, morto,
 *  token, e-mail e apelido. O envelope responde "quem venceu, quem bateu e se
 *  isso vale" — nada disso precisa de carta nem de nome.
 *
 *  `uidQueBateuFinal` é DERIVADO do assento pelo mapa congelado. Nunca vem de
 *  campo de mensagem, e nunca de `sala.assentos` no momento da captura: aquele
 *  vira bot quando alguém cai, e quem bateu antes de cair continua sendo quem
 *  bateu. */
function montarEnvelopeEncerramento(sala, agoraIso) {
  const jogo = sala.jogo;
  const placar = { nos: jogo.placar.nos, eles: jogo.placar.eles };
  // Vencedor pelo placar canônico. O motor só marca `encerrada` quando alguém
  // cruza a meta, então empate não chega aqui — mas se chegasse, `null` é a
  // resposta honesta, e não um desempate inventado neste ponto.
  let duplaVencedora = null;
  if (placar.nos > placar.eles) duplaVencedora = "nos";
  else if (placar.eles > placar.nos) duplaVencedora = "eles";

  const motivo = jogo.encerrada ? MOTIVO_META : MOTIVO_DESCONHECIDO;
  const assentoFinal = Number.isInteger(jogo.assentoQueBateuFinal)
    ? jogo.assentoQueBateuFinal
    : null;
  const uidFinal = assentoFinal == null ? null : uidDoAssento(sala, assentoFinal);

  // Validade para conquista: TUDO precisa valer. Uma linha por condição, para
  // que afrouxar qualquer uma seja uma edição visível.
  const validaParaConquistas =
    motivo === MOTIVO_META &&
    TIPOS_VALIDOS_PARA_CONQUISTA.has(sala.tipoPartida) &&
    duplaVencedora !== null;

  return Object.freeze({
    versaoContrato: VERSAO_CONTRATO_ENCERRAMENTO,
    partidaId: sala.partidaId,
    versaoEstadoFinal: jogo.rodada,
    encerradaEm: agoraIso,
    motivoEncerramento: motivo,
    modalidade: sala.modalidade,
    tipoPartida: sala.tipoPartida,
    validaParaConquistas,
    rodadaFinal: jogo.rodada,
    meta: jogo.metaPontos,
    placarFinal: placar,
    duplaVencedora,
    duplaQueBateuUltimaRodada: jogo.duplaQueBateu || null,
    assentoQueBateuFinal: assentoFinal,
    uidQueBateuFinal: uidFinal,
    participantes: sala.participantes
      ? sala.participantes.map((p) => ({
          assento: p.assento, uid: p.uid, dupla: p.dupla, tipo: p.tipo,
        }))
      : [],
    // [CONTROLADOR §13] Fato canônico da substituição, para o backend de
    // ranking consumir. O servidor NÃO calcula rating aqui: ele diz o que
    // aconteceu. `botAgiu: false` é caiu-e-voltou; `true` é o bot jogou.
    substituicoes: Array.isArray(sala.substituicoes)
      ? sala.substituicoes.map((s) => ({
          assento: s.assento, uid: s.uid, motivo: s.motivo,
          desdeIso: s.desdeIso, botAgiu: s.botAgiu,
          humanoVoltou: s.humanoVoltou, voltouEmIso: s.voltouEmIso,
        }))
      : [],
  });
}

// ===========================================================================
// [META] A META DE PONTOS DA PARTIDA
// ===========================================================================
//
// A meta e configuracao LEGITIMA da mesa: quem abre escolhe se a partida vai
// a 1.500, 2.000 ou 3.000 pontos, e quem entra joga a mesa que encontrou.
//
// Isso a separa de `apostaDeEntrada`, que e configuracao do PROCESSO porque
// move o cofre de fichas. Meta nao move ficha nenhuma — ela diz quando a
// partida acaba. Escolher a duracao da propria partida nao e poder economico.
//
// Mas ser ESCOLHIVEL pelo cliente nao e o mesmo que ser CONFIAVEL vindo dele.
// O valor chega por mensagem, entao passa por esta lista antes de virar mesa:
// o que nao esta nela nao nasce. "Veio do app, entao esta certo" e exatamente
// o que esta lista existe para impedir.
const METAS_CANONICAS = Object.freeze([1500, 2000, 3000]);

// O PADRAO E EXPLICITO, e nao "o primeiro item da lista". Derivar o padrao da
// ordem da vitrine faz reordenar botao trocar regra sem ninguem notar.
const META_PADRAO = 2000;

/** Resolve a meta que uma mesa NOVA vai ter.
 *
 *  Devolve o numero aceito, ou `null` — e `null` aqui significa RECUSA, nunca
 *  "cai no padrao". A unica coisa que vira padrao e a AUSENCIA do campo, que e
 *  o cliente antigo que nem sabe que existe meta. Qualquer valor PRESENTE e uma
 *  escolha, e escolha fora da lista se recusa em vez de virar outra coisa nas
 *  costas de quem escolheu — vale para `null`, `NaN`, `"2000"`, zero, negativo
 *  e para o 1999 de quem errou o dedo. */
function resolverMetaDePontos(valor) {
  if (valor === undefined) return META_PADRAO;
  return METAS_CANONICAS.includes(valor) ? valor : null;
}

/** Cria um gerenciador de salas em memória. `opts.gerarCodigo` permite injetar
 *  um gerador determinístico nos testes. */
function criarGerenciador(opts = {}) {
  const salas = {};
  // cofre de contas (servidor/contas.js). Opcional: sem ele, a mesa roda igual,
  // só não persiste estatística nenhuma (útil pra testes puros de mesa).
  const contas = opts.contas || null;
  // [PRODUTOR] Outbox de encerramentos. Opcional pelo mesmo critério do cofre:
  // sem ela a mesa roda igual, só não produz envelope. Os testes de mesa que
  // não se importam com encerramento não precisam tocar em disco.
  const outbox = opts.outbox || null;
  const agoraIso = opts.agoraIso || (() => new Date().toISOString());
  // [CONTROLADOR §17] Relógio em milissegundos, injetável. Toda a decisão de
  // expiração de graça passa por aqui — nenhum `Date.now()` solto no caminho
  // do controlador, para que a suíte possa afirmar T-1, T e T+1 sem dormir.
  const agora = opts.agora || (() => Date.now());
  // [CONTROLADOR §5] Janela de graça da ausência por queda.
  const gracaAusenciaMs = Number.isFinite(opts.gracaAusenciaMs)
    ? Math.max(0, opts.gracaAusenciaMs)
    : GRACA_AUSENCIA_PADRAO_MS;
  const gerarCodigo = opts.gerarCodigo || gerarCodigoPadrao;
  const LIMITE_BOTS = opts.limiteAvanco || 5000; // trava anti-loop do avanço
  // autoBots: avança TODOS os bots na hora (síncrono). Quando false, quem chama
  // controla o ritmo (jogarUmBot), pra dar o "respiro" entre jogadas na tela.
  const autoBots = opts.autoBots !== false;
  // [PRODUTOR] Natureza das mesas deste gerenciador. Vem da CONFIGURAÇÃO do
  // servidor, nunca de mensagem — é por isso que o parâmetro está aqui, na
  // construção, e não em `criarMesa({...})`: o despachante monta `criarMesa` a
  // partir de `msg`, e um campo que morasse lá seria escolhível pelo cliente.
  //
  // Padrão `privada` porque é a verdade da base: toda mesa hoje nasce de um
  // código compartilhado. Valor fora da enumeração vira `simulada`, que não
  // conta — na dúvida sobre a natureza, não se concede nada.
  const tipoPartida = TIPOS_DE_PARTIDA.includes(opts.tipoPartida)
    ? opts.tipoPartida
    : (opts.tipoPartida === undefined ? TIPO_PADRAO : "simulada");

  // [MESA PRIVADA] A topologia DECLARADA, que e coisa diferente da resolvida.
  //
  // `tipoPartida` acima resolve para `privada` QUANDO NINGUEM DECLAROU NADA —
  // e o padrao, e ele descreve a verdade da base: toda mesa de hoje nasce de
  // um codigo compartilhado. Esse padrao serve bem a pergunta que ele foi
  // criado para responder ("esta partida conta para conquista pessoal?").
  //
  // Ele NAO serve a pergunta nova ("esta mesa exige elegibilidade VIP de cada
  // ocupante?"). Se servisse, toda instancia nao configurada — inclusive todas
  // as 333 provas desta suite — passaria a exigir autorizacao, e o efeito
  // seria trancar o jogo inteiro em nome de proteger a Mesa Privada.
  //
  // Entao a segunda pergunta olha para o que foi DECLARADO, e nao para o que
  // foi resolvido. Uma instancia so hospeda Mesa Privada VIP se alguem
  // escreveu `privada` na configuracao dela. `null` significa "ninguem
  // declarou", e ninguem-declarou nao e uma declaracao.
  const tipoPartidaDeclarado = TIPOS_DE_PARTIDA.includes(opts.tipoPartida)
    ? opts.tipoPartida
    : null;
  // [GATE VIP] Natureza COMPETITIVA das mesas deste gerenciador. Mora aqui, na
  // CONSTRUCAO, pela mesma razao que `tipoPartida` mora: o despachante monta a
  // chamada de `criarMesa` a partir de `msg`, e um campo que morasse la seria
  // escolhivel pelo cliente. Aqui ele so pode vir de quem construiu o processo.
  const categoriaCompetitiva = normalizarCategoria(opts.categoriaCompetitiva);

  // [ECONOMIA] Entrada em fichas das mesas deste gerenciador.
  //
  // MORA AQUI PELA MESMA RAZAO QUE `tipoPartida` E `categoriaCompetitiva`
  // moram, e o motivo agora e concreto: ate esta OS o valor vinha de
  // `msg.aposta`, ou seja, o CLIENTE escolhia quanto se cobrava para entrar na
  // mesa que ele abria. `sala.aposta` alimenta `registrarPartida`, que move o
  // cofre de moedas — entao o cliente escolhia quanto o cofre movia.
  //
  // A secao 9.3 da OS proibe "confiar no valor de entrada enviado livremente
  // pelo cliente", e a secao 5.1 proibe aposta em Mesa Publica. As duas coisas
  // se resolvem no mesmo lugar: o valor passa a ser configuracao do PROCESSO, e
  // o padrao e ZERO. Uma mesa que cobra e uma mesa que alguem configurou para
  // cobrar.
  const apostaDeEntrada = Number.isFinite(opts.apostaDeEntrada)
    ? Math.max(0, Math.round(opts.apostaDeEntrada))
    : 0;

  // [GATE VIP] A PORTA do adaptador autoritativo de admissao VIP. Ausente por
  // padrao, e ausente RECUSA - nao existe liberacao automatica na falta de quem
  // autorize, e nao existe bypass de desenvolvimento ligado sozinho. A proxima
  // OS injeta o adaptador real por aqui; nada mais deste arquivo muda.
  const autorizarEntradaVip = typeof opts.autorizarEntradaVip === "function"
    ? opts.autorizarEntradaVip
    : null;

  /** [GATE VIP] O UNICO caminho pelo qual um assento e admitido.
   *
   *  Os dois - e sao dois - pontos que sentam um humano (`criarMesa` no assento
   *  0 e `entrarMesa` nos demais) passam por aqui antes de escrever no assento.
   *  Bot nao passa: bot nao tem uid, nao paga entrada e e o servidor que o
   *  senta, em `iniciarPartida`. Espectador nao passa: nao ocupa assento.
   *
   *  A RECONEXAO E DERIVADA AQUI, olhando quem ja esta sentado - nunca de campo
   *  de mensagem. Nesta OS ela nao altera o veredito (sala VIP falha fechada nos
   *  dois casos); ela existe para que a proxima OS receba a tentativa ja
   *  classificada e nao cobre um segundo passe de quem so caiu e voltou. */
  function admitirNoAssento({ codigoDaSala, categoria, identidadeDaPartida, assento, jogadorId, uidAutenticado }) {
    const sala = salas[codigoDaSala] || null;
    const uid = typeof uidAutenticado === "string" && uidAutenticado !== "" ? uidAutenticado : null;
    return avaliarAdmissaoAoAssento({
      uidAutenticado: uid,
      codigoDaSala,
      identidadeDaPartida: identidadeDaPartida == null ? null : identidadeDaPartida,
      assento,
      categoriaCompetitiva: categoria,
      // Cunhado AQUI, no servidor, uma vez por tentativa. Nao ha caminho pelo
      // qual este valor chegue de fora: nenhum parametro de `criarMesa` ou
      // `entrarMesa` o carrega, e o despachante nao o monta.
      tentativaEntradaId: novaTentativaEntradaId(),
      reconexao: assentoDoTitular(sala, jogadorId) !== -1,
      // [MESA PRIVADA] A TOPOLOGIA entra no gate. Ver o cabecalho de
      // `avaliarAdmissaoAoAssento`: uma mesa `privada` passa a exigir
      // autorizacao mesmo sendo `casual`, porque a Mesa Privada e beneficio
      // exclusivo VIP e cada ocupante precisa de direito PROPRIO.
      //
      // Ela vem da CONSTRUCAO do gerenciador, como sempre — nao do parametro
      // de `criarMesa`, nao de `msg`, e nao da sala (que pode nem existir
      // ainda quando o assento 0 e admitido).
      //
      // E e a topologia DECLARADA, nao a resolvida: ver `tipoPartidaDeclarado`.
      tipoPartida: tipoPartidaDeclarado,
    }, { autorizarEntradaVip });
  }

  function criarMesa({ apelido = "Jogador", jogadorId = null, uidAutenticado = null, modalidade = "sbtl", metaPontos } = {}) {
    // [META] Antes de qualquer outra coisa: mesa com meta invalida nao nasce.
    //
    // A recusa vem ANTES de sortear codigo e antes do gate de admissao, pela
    // mesma disciplina que faz o gate rodar antes de a sala existir: pedido
    // recusado nao deixa rastro nenhum — nem codigo em uso, nem assento
    // ocupado, nem sala meio construida.
    const meta = resolverMetaDePontos(metaPontos);
    if (meta === null) return { erro: "meta de pontos inválida" };
    let codigo, tentativas = 0;
    do { codigo = gerarCodigo(); } while (salas[codigo] && ++tentativas < 100);
    if (salas[codigo]) return { erro: "não foi possível gerar um código único" };
    // [GATE VIP] Criar mesa E ocupar o assento 0. O gate roda ANTES de a sala
    // existir: recusado, nao ha sala nova, nao ha assento ocupado e nao ha
    // codigo em uso - sortear um codigo nao registra nada em `salas`.
    return concluirAdmissao(admitirNoAssento({
      codigoDaSala: codigo, categoria: categoriaCompetitiva,
      identidadeDaPartida: null, assento: 0, jogadorId, uidAutenticado,
    }), function escreverMesaNova(veredito) {
    // [BACKEND] A prova da admissao fica NO ASSENTO, e so quando existe: mesa
    // casual nao tem admissao para provar, e o assento dela continua com
    // exatamente a mesma forma de sempre, campo por campo.
    const assentoZero = { apelido, tipo: "humano", jogadorId };
    if (veredito.admissaoId) assentoZero.admissaoId = veredito.admissaoId;
    salas[codigo] = {
      codigo, modalidade,
      // [META] O valor JA VALIDADO, nunca o cru que chegou por mensagem.
      metaPontos: meta,
      // [ECONOMIA] Entrada por jogador (0 = sem aposta). Vem da CONSTRUCAO do
      // gerenciador, e nao mais de `msg.aposta` — ver `apostaDeEntrada`.
      aposta: apostaDeEntrada,
      criadorAssento: 0,
      assentos: [assentoZero, null, null, null],
      iniciada: false,
      jogo: null,
      liquidada: false,   // já contabilizou o resultado no cofre?
      resumoFinal: null,  // resumo por jogador (deltas de moedas/xp) pra tela de fim
      log: [],
      // [PRODUTOR] Identidade da partida: só existe depois de `iniciarPartida`.
      // A sala existe antes e sobrevive depois; a partida, não.
      tipoPartida,
      // [GATE VIP] Natureza competitiva desta mesa. Congelada logo abaixo: e a
      // mesma da vida inteira da sala, inclusive nas revanches, porque quem
      // entrou numa mesa casual nao pode se ver numa ranqueada sem ter entrado
      // nela. Entra na impressao do estado como qualquer campo autoritativo -
      // sendo constante, nunca faz a versao andar sozinha.
      categoriaCompetitiva,
      partidaId: null,
      participantes: null,
      envelopeEncerramento: null,
      // [VERSAO] Carimbo da visão autoritativa. Nasce em zero e SEM eventoId:
      // zero significa "nenhum estado autoritativo foi emitido ainda", e não
      // "primeira versão". O primeiro carimbo — no primeiro envio de estado —
      // já entrega versão 1, então nenhuma visão sai com versaoEstado 0.
      //
      // A versão NÃO reinicia na revanche. A sala é reaproveitável (mesmo
      // código digitável) e a partida não; manter o contador subindo pela vida
      // da sala elimina a única janela em que dois estados diferentes poderiam
      // exibir o mesmo número. `eventoId` sorteado fecha o resto: nem entre
      // partidas, nem entre salas, dois eventos colidem.
      versaoEstado: 0,
      eventoId: null,
      impressaoEstado: null,
    };
    // [GATE VIP] IMUTAVEL. Nao e zelo decorativo: sem isto, qualquer caminho que
    // um dia receba a sala poderia rebaixar uma mesa ranqueada para casual (ou
    // promover uma casual) no meio da partida, e a decisao de admissao que ja
    // aconteceu ficaria valendo para uma mesa que nao existe mais.
    Object.defineProperty(salas[codigo], "categoriaCompetitiva", {
      value: categoriaCompetitiva, writable: false, configurable: false, enumerable: true,
    });
    // [META] IMUTAVEL pela mesma razao, e a razao aqui tem nome e sobrenome:
    // quem entra por codigo entrou NUMA mesa de 2.000, e nenhuma mensagem
    // posterior — entrada, reconexao, revanche — pode transforma-la em outra.
    // A trava e estrutural porque a alternativa seria confiar que nenhum
    // caminho futuro escreva neste campo, e caminho futuro sempre existe.
    Object.defineProperty(salas[codigo], "metaPontos", {
      value: meta, writable: false, configurable: false, enumerable: true,
    });
    return { codigo, assento: 0 };
    });
  }

  function entrarMesa({ codigo, apelido = "Jogador", jogadorId = null, uidAutenticado = null, assento } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (sala.iniciada) {
      // [CONTROLADOR §9] Mesa iniciada não recusa mais em bloco. Se o UID
      // autenticado é o PROPRIETÁRIO preservado de um assento, isto não é
      // entrada — é reconexão, e ela tem de passar. Qualquer outro UID
      // continua recebendo a recusa de sempre.
      const rec = reconectar({ codigo, jogadorId });
      if (rec && rec.assento != null) return rec;
      return { erro: (rec && rec.erro) || "a partida já começou" };
    }
    // ORDEM PARCEIRO-PRIMEIRO: o criador está no assento 0 (dupla "nós" = 0 e 2).
    // O 2º humano senta no assento 2 — PARCEIRO do criador (mesmo time), que é o
    // caso comum (casal/dupla que quer jogar JUNTA). Só depois enche os adversários
    // (1 e 3). Assim a estreia de 2 pessoas já cai no mesmo time, sem precisar de UI.
    // `assento` opcional: pedir um lugar específico livre (pro seletor de cadeira).
    const ORDEM = [2, 1, 3];
    let alvo = -1;
    if (Number.isInteger(assento) && assento >= 0 && assento < 4 && sala.assentos[assento] === null) {
      alvo = assento;
    } else {
      for (const s of ORDEM) { if (sala.assentos[s] === null) { alvo = s; break; } }
    }
    if (alvo === -1) return { erro: "mesa cheia" };
    // [GATE VIP] Ultima coisa antes da escrita no assento, e depois de o assento
    // alvo ja estar decidido - o gate precisa saber QUAL assento seria ocupado.
    // A categoria vem da SALA (congelada na criacao), nao do gerenciador: e a
    // mesa que se esta entrando que manda, e ela nao muda de natureza.
    return concluirAdmissao(admitirNoAssento({
      codigoDaSala: codigo, categoria: sala.categoriaCompetitiva,
      identidadeDaPartida: sala.partidaId, assento: alvo, jogadorId, uidAutenticado,
    }), function escreverAssento(veredito) {
      const ocupante = { apelido, tipo: "humano", jogadorId };
      if (veredito.admissaoId) ocupante.admissaoId = veredito.admissaoId;
      sala.assentos[alvo] = ocupante;
      return { assento: alvo, codigo };
    });
  }

  /** [BACKEND] Desfaz uma admissao que foi aprovada e nao pode mais ser usada.
   *
   *  Existe por causa de UMA janela que so passou a existir quando a admissao
   *  virou assincrona: entre o pedido e a resposta do backend, a conexao do
   *  jogador pode morrer. Sem isto, a aprovacao chegaria depois e sentaria
   *  ninguem - um assento ocupado por uma conexao que nao existe mais, numa
   *  mesa que nunca mais encheria.
   *
   *  Nao abre caminho de ocupacao nenhum: ele so LIBERA, e reaproveita `sair`
   *  para os assentos comuns. O assento do criador e o unico caso especial,
   *  porque `sair` o preserva de proposito (a mesa e dele); ali a sala inteira
   *  vai embora, que e a verdade - uma mesa recem-criada cujo criador sumiu
   *  antes de sentar nao tem ninguem dentro.
   *
   *  Mesa ja iniciada nao se desfaz: ali a partida existe, e sumir com um
   *  assento no meio dela seria pior do que o assento ocioso. */
  function desfazerAdmissao({ codigo, assento } = {}) {
    const sala = salas[codigo];
    if (!sala || sala.iniciada) return { ok: false };
    if (assento === sala.criadorAssento) {
      delete salas[codigo];
      return { ok: true, salaRemovida: true };
    }
    sair({ codigo, assento });
    return { ok: true, salaRemovida: false };
  }

  function iniciarPartida({ codigo, assento } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (assento !== sala.criadorAssento) return { erro: "só quem criou a mesa inicia a partida" };
    if (sala.iniciada) return { erro: "a partida já começou" };
    // guarda os jogadorId por assento ANTES de reconstruir (o cofre precisa deles
    // no fim da partida; criarJogo não carrega esse campo).
    const idsPorAssento = sala.assentos.map((a) => (a && a.jogadorId) || null);
    // preenche os assentos vazios com bots
    const assentosJogo = sala.assentos.map((a, i) =>
      a ? { tipo: a.tipo, apelido: a.apelido } : { tipo: "bot", apelido: NOMES_BOT[i % NOMES_BOT.length] }
    );
    sala.assentos = assentosJogo.map((a, i) => ({ tipo: a.tipo, apelido: a.apelido, jogadorId: idsPorAssento[i] }));
    sala.jogo = J.criarJogo({ assentos: assentosJogo, modalidade: sala.modalidade, metaPontos: sala.metaPontos });
    sala.iniciada = true;
    sala.liquidada = false; sala.resumoFinal = null;
    // [PRODUTOR] A partida nasce AQUI, e é aqui que ela ganha identidade. Antes
    // deste ponto existe uma sala (código digitável, reaproveitável); a partir
    // dele existe UMA partida, com um id que não se repete nem numa revanche na
    // mesma sala, porque a revanche passa por este mesmo caminho.
    sala.partidaId = novoPartidaId();
    sala.envelopeEncerramento = null;
    // Mapa assento → identidade, congelado no início. Congelado de propósito:
    // durante a partida um assento pode virar bot (queda/AFK) e a conexão pode
    // trocar, mas o TITULAR daquele assento não muda. Sem este retrato, quem
    // caiu no meio perderia o crédito do que fez, e quem entrou depois herdaria.
    sala.participantes = mapaDeParticipantes(sala);
    // [CONTROLADOR] O controlador nasce COM a partida e espelha a posse do
    // instante inicial: assento com dono humano nasce sob controle humano;
    // assento preenchido por bot nasce `bot_de_mesa` e nunca terá dono. A
    // distinção existe para que "devolver o assento" só seja possível onde há
    // a quem devolver.
    sala.controle = sala.assentos.map((a) =>
      a && a.tipo === "humano" && a.jogadorId
        ? { estado: CONTROLE.HUMANO_ATIVO, motivo: null, desde: null, retornoPendente: false, terminal: false }
        : { estado: CONTROLE.BOT_DE_MESA, motivo: null, desde: null, retornoPendente: false, terminal: false }
    );
    // [CONTROLADOR §13] Fato competitivo: uma entrada por substituição aberta.
    // Nasce vazio a cada partida (a revanche passa por aqui).
    sala.substituicoes = [];
    if (autoBots) avancarBots(sala); // se a vez começar num bot, ele já joga
    liquidar(sala); // caso raro: partida que já encerra de cara (meta minúscula em teste)
    return { ok: true, codigo };
  }

  /** Contabiliza UMA vez o resultado da partida encerrada no cofre de contas.
   *  Idempotente (a trava sala.liquidada garante que roda só uma vez). Guarda o
   *  resumo por jogador em sala.resumoFinal (o servidor manda pra tela de fim). */
  function liquidar(sala) {
    if (!sala || !sala.jogo || sala.liquidada) return null;
    if (!sala.jogo.encerrada) return null;
    sala.liquidada = true;

    // [PRODUTOR] O envelope é capturado AQUI, antes de qualquer coisa de
    // economia, e a ordem importa por dois motivos.
    //
    // 1. `sala.liquidada` já está travado acima, então este bloco roda no
    //    máximo uma vez por partida — a mesma trava que impede pagar duas
    //    vezes impede envelopar duas vezes.
    // 2. Fica ANTES do `if (!contas) return null`. O fato autoritativo não pode
    //    depender de existir cofre local: um servidor sem carteira ainda tem
    //    partidas que acabaram, e são elas que a conquista vai ler.
    //
    // O estado já está consolidado neste ponto — `contarPontos` somou o placar,
    // marcou `encerrada` e gravou `assentoQueBateuFinal` — e não muda mais.
    produzirEncerramento(sala);

    if (!contas) return null;
    const jogo = sala.jogo;
    const jogadores = [];
    for (let i = 0; i < 4; i++) {
      const aj = jogo.assentos[i], sj = sala.assentos[i];
      // só credita quem TERMINOU a partida como humano E tem conta (jogadorId).
      // Quem virou bot no meio (saiu/AFK) não pontua.
      if (aj && aj.tipo === "humano" && sj && sj.jogadorId) {
        jogadores.push({ assento: i, id: sj.jogadorId, apelido: aj.apelido });
      }
    }
    try {
      sala.resumoFinal = contas.registrarPartida({
        jogadores, placar: jogo.placar, aposta: sala.aposta || 0,
      });
    } catch (e) {
      console.error("[salas] liquidar falhou:", e.message);
    }
    return sala.resumoFinal;
  }

  /** Captura o envelope autoritativo e o entrega à outbox, uma vez.
   *
   *  NÃO paga nada e NÃO chama rede. A outbox registra um fato; quem aplica
   *  economia é `registrarPartida`, e as duas coisas continuam separadas de
   *  propósito — cortar a economia local para a autoridade do Firestore vai
   *  exigir homologação e ativação coordenadas, senão o jogador recebe duas
   *  vezes: uma pelo cofre daqui e outra por quem consumir o envelope.
   *
   *  Falha de persistência NÃO derruba a liquidação: a partida acabou de
   *  verdade, e perder o pagamento do jogador porque o disco falhou seria
   *  trocar o certo pelo acessório. O que a falha faz é ficar no log e NÃO
   *  marcar entrega — o evento continua devendo. */
  function produzirEncerramento(sala) {
    if (!sala.partidaId) {
      // Partida sem identidade não deveria existir: `iniciarPartida` sempre
      // cunha uma. Se chegou aqui, algo montou a sala por fora — falha alto no
      // log e não inventa id, que só criaria um evento órfão.
      console.error("[encerramento] sala sem partidaId; envelope nao produzido", {
        codigo: sala.codigo,
      });
      return null;
    }
    const envelope = montarEnvelopeEncerramento(sala, agoraIso());
    sala.envelopeEncerramento = envelope;

    // Log operacional: identificador técnico da partida e códigos. Sem uid, sem
    // apelido, sem e-mail, sem carta e sem o mapa de participantes.
    const base = {
      partidaId: envelope.partidaId,
      versaoContrato: envelope.versaoContrato,
      motivo: envelope.motivoEncerramento,
      tipoPartida: envelope.tipoPartida,
      valida: envelope.validaParaConquistas,
    };

    if (!envelope.validaParaConquistas) {
      // Inelegível não é erro: é o desfecho normal de mesa simulada, de partida
      // sem vencedor e de encerramento por caminho não reconhecido. O código do
      // motivo vai junto para responder "por que não contou?" sem reabrir nada.
      console.info("[encerramento] inelegivel", Object.assign({}, base, {
        codigoMotivo: envelope.motivoEncerramento !== MOTIVO_META
          ? "motivo_nao_reconhecido"
          : (!TIPOS_VALIDOS_PARA_CONQUISTA.has(envelope.tipoPartida)
              ? "tipo_nao_conta"
              : "sem_vencedor"),
      }));
    }

    if (!outbox) return envelope;

    let r;
    try {
      r = outbox.registrar(envelope);
    } catch (e) {
      console.error("[encerramento] falha de persistencia", Object.assign({}, base, { erro: e.message }));
      return envelope;
    }
    if (r.erro) {
      console.error("[encerramento] falha de persistencia", Object.assign({}, base, { erro: r.erro }));
    } else if (r.jaExistia) {
      console.info("[encerramento] envelope ja existente", base);
    } else {
      console.info("[encerramento] envelope criado, persistencia pendente", base);
    }
    return envelope;
  }

  function aplicarJogada({ codigo, assento, jogada } = {}) {
    const sala = salas[codigo];
    if (!sala || !sala.jogo) return { erro: "mesa ou partida inexistente" };
    const jogo = sala.jogo;
    if (!jogo.assentos[assento] || jogo.assentos[assento].tipo !== "humano") {
      return { erro: "este assento não é de um humano" };
    }
    const r = executarJogada(jogo, assento, jogada);
    if (!r.ok) return r;
    if (autoBots) avancarBots(sala); // fecha a vez? bots jogam até voltar a um humano
    liquidar(sala); // se essa jogada foi a batida que encerrou a partida
    return r;
  }

  function executarJogada(jogo, assento, jogada) {
    if (!jogada || !jogada.tipo) return { ok: false, erro: "jogada sem tipo" };
    switch (jogada.tipo) {
      case "comprarMonte": return J.comprarMonte(jogo, assento);
      case "comprarLixo": return J.comprarLixo(jogo, assento);
      case "baixar": return J.baixar(jogo, assento, jogada.ids || []);
      case "estender": return J.estender(jogo, assento, jogada.indiceJogo, jogada.ids || []);
      case "descartar": return J.descartar(jogo, assento, jogada.id);
      default: return { ok: false, erro: "jogada desconhecida: " + jogada.tipo };
    }
  }

  /** Avança o jogo enquanto for a vez de um BOT (ou entre rodadas). Para quando
   *  chega a vez de um humano, ou a partida encerra. */
  function avancarBots(sala) {
    const jogo = sala.jogo;
    let guarda = 0;
    while (guarda++ < LIMITE_BOTS) {
      if (jogo.encerrada) break;
      if (jogo.rodadaEncerrada) {
        // rodada acabou mas a partida não: distribui a próxima (mantém placar)
        J.distribuirRodada(jogo);
        continue;
      }
      const vez = jogo.assentos[jogo.vez];
      if (!vez) break;
      // [CONTROLADOR §6] FRONTEIRA SEGURA. O retorno de um humano que estava
      // sob substituição vale AQUI: antes de o bot começar o próximo turno
      // daquele assento, e nunca no meio de um. Turno já iniciado
      // (`jaComprou`) não é fronteira — espera o próximo.
      const ctrlVez = controleDe(sala, jogo.vez);
      if (ctrlVez && ctrlVez.retornoPendente && !jogo.jaComprou) {
        aplicarRetorno(sala, jogo.vez);
        break; // agora é vez de humano: para e espera
      }
      // [CONTROLADOR] Quem decide não é mais `tipo`, é `controle`. Assento
      // `humano_ausente` cai aqui e PARA o laço: durante a graça a mesa espera,
      // e nenhum bot age por ele (§5.5).
      if (!assentoEhDeBot(sala, jogo.vez)) break;
      const r = proporAcaoDoAssento({ codigo: sala.codigo, assento: jogo.vez });
      if (!r.ok && !jogo.rodadaEncerrada) break; // erro inesperado: evita loop
    }
    liquidar(sala); // partida pode ter encerrado numa batida de bot
  }

  /** Há trabalho de servidor a fazer? (a vez é de um bot, ou a rodada acabou e
   *  precisa distribuir a próxima). Usado pela cadência com "respiro". */
  function vezEhBot(codigo) {
    const sala = salas[codigo];
    if (!sala || !sala.jogo) return false;
    const j = sala.jogo;
    if (j.encerrada) return false;
    if (j.rodadaEncerrada) return true; // precisa transicionar de rodada
    const v = j.assentos[j.vez];
    // [CONTROLADOR] Autoridade é o controlador, não o `tipo` do assento.
    return !!(v && assentoEhDeBot(sala, j.vez));
  }

  /** Executa UM passo do servidor: joga o turno de UM bot, OU transiciona a
   *  rodada encerrada. Retorna { jogou, assento?, transicao?, resultado? }.
   *  É o tijolo da cadência com respiro (o servidor.js chama isto com um timer). */
  function jogarUmBot(codigo) {
    const sala = salas[codigo];
    if (!sala || !sala.jogo) return { jogou: false };
    const j = sala.jogo;
    if (j.encerrada) { liquidar(sala); return { jogou: false }; }
    if (j.rodadaEncerrada) { J.distribuirRodada(j); return { jogou: false, transicao: true }; }
    const v = j.assentos[j.vez];
    if (!v) return { jogou: false };
    // [CONTROLADOR §6] Mesma fronteira segura do laço síncrono: um passo da
    // cadência com respiro também devolve o assento antes de jogar por ele.
    const ctrlVez = controleDe(sala, j.vez);
    if (ctrlVez && ctrlVez.retornoPendente && !j.jaComprou) {
      aplicarRetorno(sala, j.vez);
      return { jogou: false, retornoAplicado: true, assento: j.vez };
    }
    if (!assentoEhDeBot(sala, j.vez)) return { jogou: false };
    const assento = j.vez;
    const r = proporAcaoDoAssento({ codigo, assento });
    sala.log.push({ rodada: j.rodada, assento, apelido: v.apelido, acoes: r.log });
    liquidar(sala); // batida de bot pode ter encerrado a partida
    return { jogou: true, assento, resultado: r };
  }

  // =========================================================================
  // [PATCH ESPECTADOR] PORTA ÚNICA DE SERIALIZAÇÃO
  //
  // Ninguém fora daqui monta payload de estado. `visaoPara` recebe o PAPEL já
  // decidido pelo servidor (nunca declarado pelo cliente, ver servidor.js) e
  // delega para um serializador dedicado. Os dois não compartilham objeto: a
  // visão de espectador é construída do zero por lista de permissão, não é a
  // visão de assento com campos removidos.
  // =========================================================================

  /** Papel → serializador. É a ÚNICA porta de estado da mesa.
   *
   *  [VERSAO] E é por ser única que ela também é onde o estado é CARIMBADO.
   *  Nenhuma visão sai desta camada sem passar por aqui, então nenhuma visão
   *  escapa do carimbo — e o carimbo é lido logo depois por `metadadosDe`,
   *  sobre a mesma sala, no mesmo passo síncrono.
   *
   *  A ordem importa: carimba ANTES de serializar. Os dois serializadores só
   *  leem o estado (montam objetos novos; `injetarAvatares` escreve na visão,
   *  nunca na sala), então serializar não muda a impressão e a visão entregue é
   *  exatamente a que o carimbo descreve. */
  function visaoPara({ codigo, papel, assento } = {}) {
    if (salas[codigo]) carimbarEstado(salas[codigo]);
    if (papel === "jogador" && Number.isInteger(assento)) return visao(codigo, assento);
    if (papel === "espectador") return visaoEspectador(codigo);
    // Sem papel reconhecido não existe payload de estado. Fail-closed.
    return { erro: "sem acesso a esta mesa" };
  }

  /** [VERSAO] O carimbo VIGENTE da mesa, para o despachante montar o envelope.
   *
   *  Só LÊ — quem atribui é `carimbarEstado`, chamado pela porta de projeção.
   *  Manter a leitura separada da atribuição é o que garante que as quatro
   *  visões de assento e a do espectador saiam com o mesmo par: a primeira
   *  chamada de `visaoPara` do laço carimba, as seguintes encontram a impressão
   *  igual e reaproveitam.
   *
   *  Mesa inexistente devolve `null`. Não se inventa versão para estado que não
   *  existe — quem chama decide o que fazer com a ausência. */
  function metadadosDe(codigo) {
    const sala = salas[codigo];
    if (!sala) return null;
    return { versaoEstado: sala.versaoEstado || 0, eventoId: sala.eventoId || null };
  }

  /** Avatares são PÚBLICOS (a mesa inteira desenha a foto de quem joga). */
  function injetarAvatares(sala, assentosDaVisao) {
    if (!contas || !assentosDaVisao) return;
    for (let i = 0; i < assentosDaVisao.length; i++) {
      const sj = sala.assentos[i];
      if (!sj || !sj.jogadorId) continue;
      const c = contas.obter(sj.jogadorId);
      if (!c) continue;
      assentosDaVisao[i].jogadorId = sj.jogadorId;
      assentosDaVisao[i].avatarTipo = c.avatarTipo || null;
      assentosDaVisao[i].avatarId = c.avatarId || null;
      assentosDaVisao[i].avatarVer = c.avatarVer || 0;
    }
  }

  /** O que quem ASSISTE pode ver. Sem assento, sem mão, sem "você". */
  function visaoEspectador(codigo) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (!sala.jogo) {
      // Lobby público: quem está sentado, sem `ehVoce` e sem `voceAssento`.
      return {
        lobby: true, espectador: true, codigo,
        modalidade: sala.modalidade, metaPontos: sala.metaPontos,
        voceAssento: null, criador: false,
        assentos: sala.assentos.map((a) => a
          ? { apelido: a.apelido, tipo: a.tipo }
          : { vazio: true }),
      };
    }
    const v = J.visaoDoEspectador(sala.jogo);
    injetarAvatares(sala, v.assentos);

    // TRIPWIRE. A lista de permissão acima já é a garantia; isto é a segunda
    // tranca, para o caso de alguém um dia injetar campo novo por aqui (ou de
    // um `injetarAvatares` futuro trazer junto algo que não devia). Se um id
    // secreto aparecer, o payload NÃO sai: falha fechada e registra só a
    // CONTAGEM — nunca o id, que é justamente o segredo.
    const escapou = J.vazamentosNaVisao(v, J.segredosDoEspectador(sala.jogo));
    if (escapou.size > 0) {
      console.error("[salas] visaoEspectador BLOQUEADA: " + escapou.size +
        " id(s) secreto(s) na visão pública · mesa=" + codigo + " rodada=" + sala.jogo.rodada);
      return { erro: "estado indisponível" };
    }
    return v;
  }

  /** O que um assento PODE ver (lobby antes de iniciar, ou a visão do jogo). */
  function visao(codigo, assento) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (!sala.jogo) {
      return {
        lobby: true, codigo, modalidade: sala.modalidade, metaPontos: sala.metaPontos,
        voceAssento: assento, criador: assento === sala.criadorAssento,
        assentos: sala.assentos.map((a, i) => a
          ? { apelido: a.apelido, tipo: a.tipo, ehVoce: i === assento }
          : { vazio: true }),
      };
    }
    const v = J.visaoDoAssento(sala.jogo, assento);
    // injeta o AVATAR de cada jogador humano (do cofre) na visão, pro cliente
    // desenhar a foto/galeria de quem está na mesa. Bots ficam sem (avatar padrão).
    if (contas && v && v.assentos) {
      for (let i = 0; i < v.assentos.length; i++) {
        const sj = sala.assentos[i];
        if (sj && sj.jogadorId) {
          const c = contas.obter(sj.jogadorId);
          if (c) {
            v.assentos[i].jogadorId = sj.jogadorId;
            v.assentos[i].avatarTipo = c.avatarTipo || null;
            v.assentos[i].avatarId = c.avatarId || null;
            v.assentos[i].avatarVer = c.avatarVer || 0;
          }
        }
      }
    }
    return v;
  }

  // =========================================================================
  // [CONTROLADOR] LEITURA
  // =========================================================================
  function controleDe(sala, assento) {
    if (!sala || !Array.isArray(sala.controle)) return null;
    return sala.controle[assento] || null;
  }

  /** O assento pode ser jogado por bot AGORA? É a pergunta que o laço faz. */
  function assentoEhDeBot(sala, assento) {
    const c = controleDe(sala, assento);
    return !!(c && CONTROLES_DE_BOT.has(c.estado));
  }

  /** O proprietário do assento (posse), ou null se o assento nasceu bot. */
  function donoDoAssento(sala, assento) {
    const a = sala && sala.assentos && sala.assentos[assento];
    if (!a || a.tipo !== "humano" || typeof a.jogadorId !== "string" || !a.jogadorId) return null;
    return a.jogadorId;
  }

  // =========================================================================
  // [CONTROLADOR §13] FATO COMPETITIVO
  //
  // O servidor NÃO calcula rating (a autoridade do ranking vive fora dele).
  // Ele produz o fato: houve substituição, em qual assento, por qual motivo,
  // quando começou, se o bot chegou a AGIR e se o humano voltou. `botAgiu` é
  // o campo que separa "caiu e voltou em 3 s" de "o bot jogou por você".
  // =========================================================================
  function registrarSubstituicao(sala, assento, motivo) {
    if (!Array.isArray(sala.substituicoes)) sala.substituicoes = [];
    const reg = {
      assento,
      uid: donoDoAssento(sala, assento),
      motivo: motivo || null,
      desdeIso: agoraIso(),
      botAgiu: false,
      humanoVoltou: false,
      voltouEmIso: null,
    };
    sala.substituicoes.push(reg);
    return reg;
  }

  /** A substituição ainda ABERTA deste assento (o humano não voltou). */
  function substituicaoAberta(sala, assento) {
    if (!Array.isArray(sala.substituicoes)) return null;
    for (let i = sala.substituicoes.length - 1; i >= 0; i--) {
      const s = sala.substituicoes[i];
      if (s.assento === assento && !s.humanoVoltou) return s;
    }
    return null;
  }

  // =========================================================================
  // [CONTROLADOR §11] FRONTEIRA DE PROPOSTA
  //
  // ÚNICO ponto por onde uma ação de bot entra na partida. Ele responde à
  // pergunta de autoridade — "este assento pode propor agora?" — antes de
  // qualquer regra de Buraco ser tocada, e é o que impede humano e bot de
  // terem autoridade ao mesmo tempo (§20).
  //
  // RESIDUAL DECLARADO PARA A OS 10: o decisor JS ainda APLICA a jogada dentro
  // de `jogarTurnoBot`, em vez de devolver uma intenção para esta função
  // validar e aplicar. Separar decisão de aplicação é a OS 10; migrar isso
  // aqui significaria reescrever o bot JS, que a §12 proíbe. O que esta OS
  // entrega é o SOQUETE: o gate de autoridade, o registro do fato e o ponto
  // único de entrada — trocar o decisor depois é trocar a linha marcada.
  // =========================================================================
  function proporAcaoDoAssento({ codigo, assento } = {}) {
    const sala = salas[codigo];
    if (!sala || !sala.jogo) return { ok: false, erro: "mesa sem partida", log: [] };
    const jogo = sala.jogo;
    if (jogo.encerrada) return { ok: false, erro: "a partida já terminou", log: [] };
    if (jogo.vez !== assento) return { ok: false, erro: "não é a vez deste assento", log: [] };
    // GATE DE AUTORIDADE. Assento humano — ativo OU ausente em graça — não
    // aceita proposta de bot. É aqui que a dupla autoridade morre.
    if (!assentoEhDeBot(sala, assento)) {
      return { ok: false, erro: "assento não está sob controle de bot", log: [] };
    }
    const alvo = jogo.assentos[assento];
    const r = jogarTurnoBot(jogo, assento); // <-- decisor (OS 10 troca ESTA linha)
    sala.log.push({ rodada: jogo.rodada, assento, apelido: alvo && alvo.apelido, acoes: r.log });
    if (r.ok) {
      // [§13] O bot AGIU por este assento. É o fato que muda o efeito competitivo.
      const sub = substituicaoAberta(sala, assento);
      if (sub) sub.botAgiu = true;
    }
    return r;
  }

  // =========================================================================
  // [CONTROLADOR] TRANSIÇÕES
  // =========================================================================

  /** O bot assume o assento. Não toca posse, nem nada de `jogo` além do
   *  `tipo` derivado — a fase do turno atravessa intacta (§10). */
  function assumirPorBot(sala, assento, motivo) {
    const ctrl = controleDe(sala, assento);
    if (!ctrl) return { erro: "assento sem controlador" };
    if (CONTROLES_DE_BOT.has(ctrl.estado)) return { ok: true, jaEraBot: true };
    ctrl.estado = CONTROLE.BOT_SUBSTITUTO;
    ctrl.motivo = motivo || null;
    ctrl.desde = agora();
    ctrl.retornoPendente = false;
    // Saída voluntária é TERMINAL para aquele jogador naquela partida (§7).
    if (motivo === MOTIVO_CONTROLE.SAIDA) ctrl.terminal = true;
    const j = sala.jogo;
    if (j && j.assentos[assento]) {
      j.assentos[assento].tipo = "bot";
      if (!j.assentos[assento].apelido) j.assentos[assento].apelido = NOMES_BOT[assento % NOMES_BOT.length];
    }
    registrarSubstituicao(sala, assento, motivo);
    avancarBots(sala); // se era a vez dele, o bot assume — do ponto em que estava
    return { ok: true, assumido: true };
  }

  /** Ausência (§5). Queda ganha graça; declaração (AFK, saída) não ganha:
   *  não há incerteza de rede a proteger quando o próprio jogador avisa. */
  function ausentar({ codigo, assento, motivo } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (!Number.isInteger(assento)) return { erro: "assento inválido" };
    if (!sala.iniciada) {
      // No lobby não há partida a segurar: o assento é liberado, como sempre foi.
      if (assento !== sala.criadorAssento) sala.assentos[assento] = null;
      return { ok: true, lobby: true };
    }
    const ctrl = controleDe(sala, assento);
    if (!ctrl) return { erro: "assento sem controlador" };
    if (CONTROLES_DE_BOT.has(ctrl.estado)) return { ok: true, jaEraBot: true };
    if (motivo === MOTIVO_CONTROLE.QUEDA) {
      // §5: NÃO vira bot agora. Marca ausente, reserva o assento e conta o tempo.
      ctrl.estado = CONTROLE.HUMANO_AUSENTE;
      ctrl.motivo = motivo;
      ctrl.desde = agora();
      ctrl.retornoPendente = false;
      return { ok: true, ausente: true, expiraEm: ctrl.desde + gracaAusenciaMs };
    }
    return assumirPorBot(sala, assento, motivo || MOTIVO_CONTROLE.AFK);
  }

  /** [§5.6 / §17] Expiração da graça, avaliada por RELÓGIO INJETADO e de forma
   *  PREGUIÇOSA: quem chama é o despachante, a cada mensagem, e o agendamento
   *  do servidor real — que só existe para a mesa silenciosa não ficar parada.
   *  Os dois caminhos chamam ESTA função, então não há duas verdades sobre o
   *  instante do takeover.
   *
   *  A comparação é `>=`: em T-1 o assento continua ausente; em T o bot assume.
   *  Exatamente T é takeover, e isso é escolha declarada, não acaso de ponto
   *  flutuante. */
  function verificarAusencias(codigo) {
    const sala = salas[codigo];
    if (!sala || !sala.iniciada || !Array.isArray(sala.controle)) return 0;
    const t = agora();
    let assumidos = 0;
    for (let i = 0; i < sala.controle.length; i++) {
      const c = sala.controle[i];
      if (!c || c.estado !== CONTROLE.HUMANO_AUSENTE) continue;
      if (!Number.isFinite(c.desde)) continue;
      if (t - c.desde < gracaAusenciaMs) continue;
      assumirPorBot(sala, i, c.motivo || MOTIVO_CONTROLE.QUEDA);
      assumidos++;
    }
    return assumidos;
  }

  /** Devolve o controle ao humano. Só é chamada em FRONTEIRA SEGURA. */
  function aplicarRetorno(sala, assento) {
    const ctrl = controleDe(sala, assento);
    if (!ctrl) return;
    ctrl.estado = CONTROLE.HUMANO_ATIVO;
    ctrl.motivo = null;
    ctrl.desde = null;
    ctrl.retornoPendente = false;
    if (sala.jogo && sala.jogo.assentos[assento]) sala.jogo.assentos[assento].tipo = "humano";
    const sub = substituicaoAberta(sala, assento);
    if (sub) { sub.humanoVoltou = true; sub.voltouEmIso = agoraIso(); }
  }

  /** Retorno do proprietário (§6). Nunca interrompe ação pela metade. */
  function retornar({ codigo, assento, jogadorId } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (!Number.isInteger(assento)) return { erro: "assento inválido" };
    const dono = donoDoAssento(sala, assento);
    if (!dono) return { erro: "assento sem proprietário humano" };
    // Um UID diferente NUNCA retoma assento alheio, nem que o assento esteja
    // sob bot. `jogadorId` null seria "sem identidade", e também não passa.
    if (dono !== jogadorId) return { erro: "assento de outro proprietário" };
    const ctrl = controleDe(sala, assento);
    if (!ctrl) return { erro: "assento sem controlador" };
    if (ctrl.terminal) return { erro: "você saiu desta partida" };
    if (ctrl.estado === CONTROLE.HUMANO_ATIVO) return { ok: true, jaAtivo: true, botAgiu: false };
    if (ctrl.estado === CONTROLE.HUMANO_AUSENTE) {
      // Voltou dentro da graça: nenhum bot chegou a agir por este assento.
      ctrl.estado = CONTROLE.HUMANO_ATIVO;
      ctrl.motivo = null;
      ctrl.desde = null;
      return { ok: true, retomou: true, botAgiu: false };
    }
    // Sob substituição: a troca espera a fronteira do turno.
    const j = sala.jogo;
    const sub = substituicaoAberta(sala, assento);
    const botAgiu = !!(sub && sub.botAgiu);
    if (j && j.vez === assento && j.jaComprou === true) {
      // Turno DESTE assento já começou: devolver agora partiria a jogada.
      ctrl.retornoPendente = true;
      return { ok: true, pendente: true, botAgiu };
    }
    aplicarRetorno(sala, assento);
    return { ok: true, retomou: true, botAgiu };
  }

  /** [§9] Reconexão do PROPRIETÁRIO a uma partida já iniciada. Não é entrada
   *  nova: não escolhe assento, não cria jogador, não aceita apelido como
   *  identidade. O casamento é UID autenticado × posse preservada. */
  function reconectar({ codigo, jogadorId } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (!sala.iniciada) return { erro: "a partida não começou" };
    if (typeof jogadorId !== "string" || !jogadorId) {
      return { erro: "reconexão exige identidade autenticada" };
    }
    let alvo = -1;
    for (let i = 0; i < sala.assentos.length; i++) {
      if (donoDoAssento(sala, i) === jogadorId) { alvo = i; break; }
    }
    if (alvo === -1) return { erro: "a partida já começou" };
    const r = retornar({ codigo, assento: alvo, jogadorId });
    if (r.erro) return r;
    return { codigo, assento: alvo, reconexao: true, pendente: !!r.pendente, botAgiu: !!r.botAgiu };
  }

  /** Saída VOLUNTÁRIA (§7). Sem graça e sem volta nesta partida. */
  function sair({ codigo, assento } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (!sala.iniciada) {
      if (assento !== sala.criadorAssento) sala.assentos[assento] = null;
      return { ok: true };
    }
    const r = assumirPorBot(sala, assento, MOTIVO_CONTROLE.SAIDA);
    // Mesmo se o assento já era bot, a saída é terminal para o dono.
    const ctrl = controleDe(sala, assento);
    if (ctrl) ctrl.terminal = true;
    return r.erro ? r : { ok: true };
  }

  /** [GATE VIP] Natureza competitiva de UMA sala, para quem precisa dela fora
   *  da admissao - o encerramento autoritativo inclusive. Leitura, so: a
   *  propriedade e nao-gravavel na origem, e nao existe setter em lugar nenhum. */
  function categoriaDaSala(codigo) {
    const sala = salas[codigo];
    return sala ? sala.categoriaCompetitiva : null;
  }

  /** [COMUNICACAO CONTROLADA] A topologia DECLARADA na configuracao deste
   *  processo, e nao a resolvida.
   *
   *  A diferenca e a mesma que `tipoPartidaDeclarado` ja registra para a
   *  admissao, e aqui ela e ainda mais decisiva: a topologia RESOLVIDA vale
   *  `privada` por padrao (e a verdade da base — toda mesa nasce de um codigo
   *  compartilhado), e usa-la aqui faria TODA instancia nao configurada pedir o
   *  ambiente de Mesa Privada — o unico com texto livre. `null` significa
   *  "ninguem declarou", e ninguem-declarou nao e uma declaracao. */
  function topologiaDeclarada() {
    return tipoPartidaDeclarado;
  }

  // [COMPOSICAO chat + controlador + meta] A superfície de `salas` é a UNIÃO das
  // três folhas, não a escolha de uma: quem some daqui não some do arquivo, some
  // do alcance de quem chama — e o defeito só apareceria em produção, como
  // `undefined is not a function` numa mesa com gente dentro.
  return {
    salas, criarMesa, entrarMesa, iniciarPartida, aplicarJogada, avancarBots,
    vezEhBot, jogarUmBot, visao, visaoEspectador, visaoPara, metadadosDe, sair,
    liquidar, outbox,
    // [CONTROLADOR] superfície da OS 7
    ausentar, retornar, reconectar, verificarAusencias, proporAcaoDoAssento,
    controleDe, assentoEhDeBot, donoDoAssento, gracaAusenciaMs,
    // [GATE VIP] `categoriaConfigurada` e o que a CONFIGURACAO do processo
    // resolveu para as mesas novas; `categoriaDaSala` e o que cada mesa ja
    // criada carrega. Sao coisas diferentes e ficam com nomes diferentes.
    categoriaConfigurada: categoriaCompetitiva, categoriaDaSala,
    // [COMUNICACAO CONTROLADA] A topologia DECLARADA, para o produtor do canal.
    topologiaDeclarada,
    admitirNoAssento, desfazerAdmissao,
  };
}

module.exports = {
  criarGerenciador, gerarCodigoPadrao, NOMES_BOT,
  // [PRODUTOR] Expostos para a suíte do produtor afirmar o contrato sem
  // reimplementá-lo: o vocabulário de motivo/tipo é o mesmo que o envelope usa.
  montarEnvelopeEncerramento, mapaDeParticipantes, novoPartidaId,
  VERSAO_CONTRATO_ENCERRAMENTO, MOTIVO_META, MOTIVO_DESCONHECIDO,
  TIPOS_DE_PARTIDA, TIPOS_VALIDOS_PARA_CONQUISTA,
  // [VERSAO] Expostos para a suíte afirmar idempotência e detecção de mudança
  // direto na primitiva, sem ter que montar servidor e conexão para cada caso.
  carimbarEstado, impressaoDoEstado, CAMPOS_FORA_DA_IMPRESSAO,
  // [GATE VIP] Expostos para a suite afirmar a enumeracao fechada, a matriz de
  // admissao e o vocabulario de recusa direto na primitiva - sem ter que
  // reimplementar nenhum deles do lado do teste.
  avaliarAdmissaoAoAssento, normalizarCategoria, novaTentativaEntradaId,
  ehTentativaEntradaId, assentoDoTitular,
  CATEGORIAS_COMPETITIVAS, CATEGORIA_PADRAO, CATEGORIA_DESCONHECIDA,
  PREFIXO_TENTATIVA, ERRO_ADMISSAO,
  RECUSA_VIP_INDISPONIVEL, RECUSA_CATEGORIA_DESCONHECIDA,
  ADMISSAO_NOVA, ADMISSAO_RECONEXAO,
  // [BACKEND] Expostos para a suite afirmar os dois regimes da admissao sem
  // ter que montar servidor e rede para cada caso.
  ehPromessa, concluirAdmissao,
  // [META] Expostos para a suite afirmar a lista canonica e o padrao direto na
  // primitiva, e para o arnes montar mesa sem adivinhar quais metas existem.
  resolverMetaDePontos, METAS_CANONICAS, META_PADRAO,
  // [CONTROLADOR] Vocabulário exposto para a suíte afirmar o contrato sem
  // reescrever as strings — teste que redigita "bot_substituto" não detecta
  // renomeação, só a repete.
  CONTROLE, MOTIVO_CONTROLE, GRACA_AUSENCIA_PADRAO_MS,
};

  };

  __fabricas["auth_firebase"] = function (module, exports, require) {
// [PATCH WS-AUTH] servidor/auth_firebase.js — VERIFICAÇÃO DE FIREBASE ID TOKEN
// Módulo NOVO (OS "Autenticação do handshake WebSocket e vinculação segura de
// identidade"). Verifica criptograficamente um ID Token do Firebase Auth SEM
// nenhuma dependência npm — o repositório inteiro é Node puro e o deploy roda
// `npm start` sem `npm install`, então `firebase-admin` não é uma opção aqui.
//
// O que é verificado (é o mesmo conjunto que o Admin SDK aplica em
// verifyIdToken, MENOS a checagem de revogação — ver DECISÃO 2 abaixo):
//   • header.alg === "RS256" e header.kid presente  (nada de "none"/HS256:
//     aceitar outro alg é o clássico ataque de confusão de algoritmo);
//   • assinatura RSA-SHA256 conferida contra o certificado x509 PÚBLICO do
//     Google correspondente ao kid;
//   • aud === FIREBASE_PROJECT_ID;
//   • iss === https://securetoken.google.com/<FIREBASE_PROJECT_ID>;
//   • exp no futuro, iat/auth_time não no futuro (tolerância de relógio);
//   • sub não vazio  → é ELE o uid autenticado.
//
// DECISÃO 1 — SEM SEGREDO. Verificar um ID Token exige só a chave PÚBLICA do
// Google e o project id (que não é segredo). Nenhuma service account, nenhuma
// private key, nada para versionar. A única variável nova é FIREBASE_PROJECT_ID.
//
// DECISÃO 2 — REVOGAÇÃO FORA DESTA CORREÇÃO (risco residual declarado).
// Checar token revogado exige credencial administrativa (ler `validSince` do
// usuário), o que traria service account para o runtime. Nesta OS verifica-se
// assinatura + expiração + audience + issuer. Consequência aceita: um ID Token
// já emitido continua válido até expirar (Firebase: 1h) mesmo se a sessão for
// revogada nesse intervalo. Ver docs/WS-AUTH-IDENTIDADE.md.
//
// DECISÃO 3 — FAIL CLOSED. Qualquer erro (rede, certificado, parsing, projeto
// não configurado) resulta em FALHA de autenticação. Não existe fallback para
// identidade declarada pelo cliente e não existe modo legado.

const crypto = require("crypto");
const https = require("https");

// Certificados x509 públicos que assinam os ID Tokens do Firebase Auth.
const URL_CERTIFICADOS =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const TOLERANCIA_RELOGIO_S = 60;   // desvio de relógio aceito entre nós e o Google
const TTL_PADRAO_CERTS_MS = 60 * 60 * 1000;

// Códigos de falha. São para LOG e TESTE — nunca vão inteiros para o cliente
// (§19: não facilitar enumeração de "por que" a autenticação falhou).
const FALHA = {
  SEM_PROJETO: "SEM_PROJETO",
  SEM_TOKEN: "SEM_TOKEN",
  TOKEN_MALFORMADO: "TOKEN_MALFORMADO",
  ALG_NAO_SUPORTADO: "ALG_NAO_SUPORTADO",
  SEM_KID: "SEM_KID",
  KID_DESCONHECIDO: "KID_DESCONHECIDO",
  ASSINATURA_INVALIDA: "ASSINATURA_INVALIDA",
  EXPIRADO: "EXPIRADO",
  EMITIDO_NO_FUTURO: "EMITIDO_NO_FUTURO",
  AUDIENCE_INVALIDO: "AUDIENCE_INVALIDO",
  ISSUER_INVALIDO: "ISSUER_INVALIDO",
  SEM_SUJEITO: "SEM_SUJEITO",
  CERTIFICADOS_INDISPONIVEIS: "CERTIFICADOS_INDISPONIVEIS",
};

function ehBase64Url(s) {
  return typeof s === "string" && s.length > 0 && /^[A-Za-z0-9_-]+$/.test(s);
}

function base64UrlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Quebra o JWT em header/payload/assinatura. Devolve null se não for um JWT
 *  compacto bem formado — sem lançar, para o chamador tratar como falha comum. */
function partesDoToken(token) {
  if (typeof token !== "string") return null;
  const p = token.split(".");
  if (p.length !== 3) return null;
  if (!ehBase64Url(p[0]) || !ehBase64Url(p[1]) || !ehBase64Url(p[2])) return null;
  let header, payload;
  try {
    header = JSON.parse(base64UrlParaBuffer(p[0]).toString("utf8"));
    payload = JSON.parse(base64UrlParaBuffer(p[1]).toString("utf8"));
  } catch (_) { return null; }
  if (!header || typeof header !== "object") return null;
  if (!payload || typeof payload !== "object") return null;
  return {
    header,
    payload,
    assinatura: base64UrlParaBuffer(p[2]),
    conteudoAssinado: p[0] + "." + p[1],
  };
}

/** Busca os certificados públicos do Google (GET simples, sem dependência). */
function buscarCertificadosHttps() {
  return new Promise((ok, falha) => {
    const req = https.get(URL_CERTIFICADOS, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return falha(new Error("HTTP " + res.statusCode));
      }
      let corpo = "";
      res.setEncoding("utf8");
      res.on("data", (d) => { corpo += d; });
      res.on("end", () => {
        try {
          const certs = JSON.parse(corpo);
          const cc = String(res.headers["cache-control"] || "");
          const m = cc.match(/max-age=(\d+)/);
          ok({ certs, ttlMs: m ? Number(m[1]) * 1000 : TTL_PADRAO_CERTS_MS });
        } catch (e) { falha(e); }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error("timeout")));
    req.on("error", falha);
  });
}

/** Cache dos certificados respeitando o max-age do Google. Uma busca em voo é
 *  compartilhada por todas as conexões (não faz N requisições em rajada). */
function criarCacheDeCertificados({ buscar, agora } = {}) {
  const _buscar = buscar || buscarCertificadosHttps;
  const _agora = agora || (() => Date.now());
  let certs = null;
  let validoAte = 0;
  let emVoo = null;

  return function obter() {
    if (certs && _agora() < validoAte) return Promise.resolve(certs);
    if (emVoo) return emVoo;
    emVoo = Promise.resolve()
      .then(_buscar)
      .then((r) => {
        certs = (r && r.certs) || {};
        validoAte = _agora() + ((r && r.ttlMs) || TTL_PADRAO_CERTS_MS);
        emVoo = null;
        return certs;
      })
      .catch((e) => { emVoo = null; throw e; });
    return emVoo;
  };
}

/**
 * Cria o verificador de credencial da conexão.
 *
 *   const verificar = criarVerificadorFirebase({ projectId: "meu-projeto" });
 *   const r = await verificar(token);
 *   // r = { ok: true, uid: "..." }  |  { ok: false, codigo: FALHA.* }
 *
 * `buscarCertificados` e `agora` existem para os TESTES injetarem um par de
 * chaves próprio e um relógio controlado. Não são caminho de produção e não
 * desligam verificação nenhuma — o teste ainda assina de verdade em RS256.
 */
function criarVerificadorFirebase({ projectId, buscarCertificados, agora } = {}) {
  const obterCerts = criarCacheDeCertificados({ buscar: buscarCertificados, agora });
  const _agora = agora || (() => Date.now());
  const issuerEsperado = "https://securetoken.google.com/" + projectId;

  return function verificar(token) {
    if (!projectId) return Promise.resolve({ ok: false, codigo: FALHA.SEM_PROJETO });
    if (token == null || token === "") return Promise.resolve({ ok: false, codigo: FALHA.SEM_TOKEN });

    const t = partesDoToken(token);
    if (!t) return Promise.resolve({ ok: false, codigo: FALHA.TOKEN_MALFORMADO });
    if (t.header.alg !== "RS256") return Promise.resolve({ ok: false, codigo: FALHA.ALG_NAO_SUPORTADO });
    if (!t.header.kid || typeof t.header.kid !== "string") {
      return Promise.resolve({ ok: false, codigo: FALHA.SEM_KID });
    }

    return obterCerts().then(
      (certs) => {
        const cert = certs[t.header.kid];
        if (!cert) return { ok: false, codigo: FALHA.KID_DESCONHECIDO };

        let assinaturaOk = false;
        try {
          assinaturaOk = crypto
            .createVerify("RSA-SHA256")
            .update(t.conteudoAssinado)
            .verify(cert, t.assinatura);
        } catch (_) { assinaturaOk = false; }
        if (!assinaturaOk) return { ok: false, codigo: FALHA.ASSINATURA_INVALIDA };

        // Só depois da assinatura conferida é que as claims valem alguma coisa.
        const p = t.payload;
        const agoraS = Math.floor(_agora() / 1000);
        if (typeof p.exp !== "number" || p.exp <= agoraS - TOLERANCIA_RELOGIO_S) {
          return { ok: false, codigo: FALHA.EXPIRADO };
        }
        if (typeof p.iat !== "number" || p.iat > agoraS + TOLERANCIA_RELOGIO_S) {
          return { ok: false, codigo: FALHA.EMITIDO_NO_FUTURO };
        }
        if (typeof p.auth_time === "number" && p.auth_time > agoraS + TOLERANCIA_RELOGIO_S) {
          return { ok: false, codigo: FALHA.EMITIDO_NO_FUTURO };
        }
        if (p.aud !== projectId) return { ok: false, codigo: FALHA.AUDIENCE_INVALIDO };
        if (p.iss !== issuerEsperado) return { ok: false, codigo: FALHA.ISSUER_INVALIDO };
        if (typeof p.sub !== "string" || p.sub === "" || p.sub.length > 128) {
          return { ok: false, codigo: FALHA.SEM_SUJEITO };
        }
        // `expiraEm` sai daqui em MILISSEGUNDOS porque a conexão precisa dele:
        // token válido no handshake NÃO compra sessão eterna. Quem manda na
        // validade da conexão é o `exp` do token, não o instante do aperto de mão.
        return { ok: true, uid: p.sub, expiraEm: p.exp * 1000 };
      },
      // rede/certificado fora do ar → NÃO autentica (fail closed)
      () => ({ ok: false, codigo: FALHA.CERTIFICADOS_INDISPONIVEIS })
    );
  };
}

module.exports = {
  criarVerificadorFirebase,
  criarCacheDeCertificados,
  partesDoToken,
  FALHA,
  URL_CERTIFICADOS,
};

  };

  __fabricas["admissao_vip"] = function (module, exports, require) {
// servidor/admissao_vip.js — ADAPTADOR UNICO DE AUTORIZACAO DE ENTRADA VIP
//
// [BACKEND] A porta - unica - pela qual o servidor pergunta a um backend se um
// UID autenticado pode ocupar um assento numa mesa VIP/Ranqueada.
//
// O QUE ESTE MODULO NAO SABE, e nao pode aprender: o que e uma assinatura, o
// que e um passe de cortesia, quanto custa entrar, quantos dias duram, quando
// renova. Ele nao decide admissao - ele TRANSPORTA a pergunta e LE a resposta.
// A regra comercial mora do outro lado do fio, e e por isso que trocar a regra
// nao vai exigir tocar em nada daqui.
//
// E ele tambem nao ocupa assento. Ele devolve um veredito para o gate, e quem
// escreve no assento e o gerenciador de salas, depois do veredito. As duas
// coisas ficam separadas de proposito: um adaptador que soubesse sentar
// jogador seria um segundo caminho de ocupacao, e o gate existe exatamente
// para nao haver um segundo.
//
// DECISAO 1 - FAIL CLOSED EM TODA ARESTA. URL ausente, URL sem HTTPS, sem
// credencial, timeout, 429, 5xx, JSON quebrado, contrato de outra versao,
// `ok` que nao e exatamente `true`, `admissaoId` vazio: tudo recusa. Nao
// existe caminho degradado e nao existe aprovacao local. O unico jeito de
// entrar numa mesa VIP e um backend dizer que sim, por escrito e no contrato.
//
// DECISAO 2 - SEM RETRY AQUI. Uma tentativa produz no maximo UMA chamada. O
// retry de credencial ja existe, e e da credencial: `obterIdToken()` renova
// por margem e coalesce chamadas simultaneas. Repetir aqui criaria uma segunda
// politica de repeticao sobre a mesma falha - duas politicas que divergem no
// primeiro ajuste, e que juntas multiplicam a carga sobre um backend que ja
// esta respondendo 5xx. Falha temporaria recusa a entrada; o jogador tenta de
// novo, e essa e uma tentativa NOVA, com identidade nova.
//
// DECISAO 3 - NADA DE IDENTIDADE NO CORPO ALEM DO UID, E NUNCA O TOKEN. O
// corpo carrega exatamente os oito campos do contrato. Apelido, avatar,
// moldura, publicId e perfil NAO entram: o backend decide por identidade
// autenticada, e tudo o mais seria dado pessoal viajando sem precisar. A
// credencial vai no cabecalho `authorization`, nunca no corpo e nunca na URL -
// corpo e URL aparecem em log de proxy, cabecalho de autorizacao e o que todo
// mundo ja sabe redigir.
//
// DECISAO 4 - LOG SO DE CODIGO. O que se registra e um codigo de falha, seco.
// Nunca o token, nunca o cabecalho, nunca o corpo da resposta, nunca a URL
// completa (a query e onde chave costuma se esconder) e nunca a mensagem de
// erro do socket, que em Node carrega a URL inteira dentro de `e.message`.
//
// DECISAO 5 - IDEMPOTENCIA PELO VOO. Chamadas SIMULTANEAS com a mesma
// `tentativaEntradaId` compartilham UMA chamada de rede. Tentativas diferentes
// nunca compartilham. O adaptador nao cunha identidade de tentativa e nao a
// reescreve: ela vem do gate, inteira, e viaja igual em toda repeticao tecnica
// daquele voo. Depois que o voo assenta, a entrada sai do mapa - uma tentativa
// repetida DEPOIS e uma pergunta nova para o backend, que a deduplica pelo
// mesmo `tentativaEntradaId` do lado dele. A divisao e essa: aqui se
// deduplica concorrencia, la se deduplica repeticao.

const https = require("https");
const http = require("http");

/** Versao do contrato de transporte. Vai no corpo e e exigida na resposta. */
const CONTRATO = "admissao-vip-v1";

/** Teto de espera. Mais curto que o da credencial de proposito: este pedido
 *  esta no caminho de alguem que clicou para sentar, e um jogador desiste bem
 *  antes de dez segundos. Estourar recusa - e recusar e barato, porque a
 *  entrada nao consumiu nada. */
const TIMEOUT_MS = 8000;

/** Teto do corpo lido. Existe para que uma resposta enorme (ou um endpoint
 *  trocado por outra coisa) nao vire memoria do processo. */
const LIMITE_RESPOSTA_BYTES = 64 * 1024;

/** Codigos de falha. Sao para LOG e TESTE. Nenhum deles carrega token, corpo,
 *  URL ou identidade - e por isso que eles podem ser registrados. */
const FALHA = {
  SEM_URL: "SEM_URL",
  URL_INVALIDA: "URL_INVALIDA",
  SEM_HTTPS: "SEM_HTTPS",
  SEM_CREDENCIAL: "SEM_CREDENCIAL",
  CREDENCIAL_RECUSADA: "CREDENCIAL_RECUSADA",
  TIMEOUT: "TIMEOUT",
  CONEXAO: "CONEXAO",
  RESPOSTA_GRANDE: "RESPOSTA_GRANDE",
  RESPOSTA_INVALIDA: "RESPOSTA_INVALIDA",
  CONTRATO_DESCONHECIDO: "CONTRATO_DESCONHECIDO",
  SEM_ADMISSAO_ID: "SEM_ADMISSAO_ID",
  HTTP_429: "HTTP_429",
  HTTP_5XX: "HTTP_5XX",
  HTTP: "HTTP",
  NEGADA: "NEGADA",
};

/** Nome da variavel de ambiente do endereco. Nome, nunca valor. */
const VARIAVEL_URL = "URL_AUTORIZACAO_ENTRADA_VIP";

/** Le e valida o endereco do backend.
 *
 *  HTTPS e obrigatorio, com UMA excecao estreita: `localhost` e os enderecos de
 *  loopback, para que uma bancada local possa subir um endpoint de mentira sem
 *  certificado. A excecao e por HOST, e nao por variavel de ambiente ou flag -
 *  uma flag de "aceitar http" e exatamente o tipo de coisa que alguem liga em
 *  producao para destravar um deploy as duas da manha.
 *
 *  Credencial embutida na URL (`https://user:senha@host`) e RECUSADA. Ela
 *  vazaria em todo log que registrasse o endereco, e nao existe motivo
 *  legitimo para ela aqui: a autenticacao deste transporte e o ID token. */
function lerEndpoint(valor) {
  if (typeof valor !== "string" || valor === "") return { ok: false, codigo: FALHA.SEM_URL };
  let u;
  try {
    u = new URL(valor);
  } catch (_) {
    return { ok: false, codigo: FALHA.URL_INVALIDA };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, codigo: FALHA.URL_INVALIDA };
  if (u.username || u.password) return { ok: false, codigo: FALHA.URL_INVALIDA };
  const loopback =
    u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]" || u.hostname === "::1";
  if (u.protocol === "http:" && !loopback) return { ok: false, codigo: FALHA.SEM_HTTPS };
  return { ok: true, url: u, host: u.hostname, seguro: u.protocol === "https:" };
}

/** O corpo do contrato `admissao-vip-v1`.
 *
 *  Exatamente estes oito campos, sempre, nesta forma. A lista e fechada e ha
 *  teste que compara o conjunto de chaves: acrescentar campo aqui deixou de ser
 *  uma edicao invisivel, porque cada campo novo e dado saindo do servidor.
 *
 *  `reconexao` e DERIVADA da classificacao que o gate ja fez - ela nao e
 *  perguntada ao cliente em lugar nenhum, e o backend precisa dela para nao
 *  cobrar duas vezes de quem so caiu e voltou. */
function corpoDaRequisicao(ctx) {
  const c = ctx || {};
  return {
    versaoContrato: CONTRATO,
    uidAutenticado: c.uidAutenticado,
    codigoDaSala: c.codigoDaSala,
    identidadeDaPartida: c.identidadeDaPartida == null ? null : c.identidadeDaPartida,
    assento: c.assento,
    categoriaCompetitiva: c.categoriaCompetitiva,
    tentativaEntradaId: c.tentativaEntradaId,
    reconexao: c.classificacao === "reconexao_ao_proprio_assento",
  };
}

/** Le a resposta do backend de forma FECHADA.
 *
 *  A ordem das checagens importa e nao e estetica: status primeiro (um 5xx com
 *  corpo HTML nao deve nem chegar ao parser), contrato depois (uma resposta de
 *  outra versao pode ter `ok` significando outra coisa), e so entao o veredito.
 *
 *  `ok !== true` estrito: `"true"`, `1` e `{}` nao aprovam. E aprovacao sem
 *  `admissaoId` tambem nao aprova - sem identidade da admissao nao ha o que
 *  guardar no assento, nao ha o que reconciliar depois e nao ha como provar,
 *  amanha, que aquela entrada foi autorizada. */
function interpretarRespostaAdmissao(bruto) {
  const status = bruto && bruto.status;
  if (status === 429) return { ok: false, codigo: FALHA.HTTP_429, temporaria: true };
  if (typeof status === "number" && status >= 500) return { ok: false, codigo: FALHA.HTTP_5XX, temporaria: true };
  if (status !== 200) return { ok: false, codigo: FALHA.HTTP, temporaria: false };

  let json = null;
  try {
    json = JSON.parse(bruto.corpo);
  } catch (_) {
    return { ok: false, codigo: FALHA.RESPOSTA_INVALIDA, temporaria: false };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, codigo: FALHA.RESPOSTA_INVALIDA, temporaria: false };
  }
  if (json.versaoContrato !== CONTRATO) {
    return { ok: false, codigo: FALHA.CONTRATO_DESCONHECIDO, temporaria: false };
  }
  if (json.ok !== true) {
    return { ok: false, codigo: FALHA.NEGADA, temporaria: false };
  }
  if (typeof json.admissaoId !== "string" || json.admissaoId === "") {
    return { ok: false, codigo: FALHA.SEM_ADMISSAO_ID, temporaria: false };
  }
  return {
    ok: true,
    admissaoId: json.admissaoId,
    codigoDecisao: typeof json.codigoDecisao === "string" ? json.codigoDecisao : null,
  };
}

/** Erro tipado e REDIGIDO do transporte. A mensagem e montada aqui e nunca
 *  interpolada a partir da resposta remota nem de `e.message` de socket - a
 *  segunda carrega a URL inteira, e a URL pode carregar o que nao deve. */
class ErroAdmissaoVip extends Error {
  constructor(codigo) {
    super("admissao vip: " + codigo);
    this.name = "ErroAdmissaoVip";
    this.codigo = codigo;
  }
}

/** POST do contrato, com teto de tempo e teto de corpo. */
function pedirAdmissaoHttps({ endpoint, idToken, corpo, timeoutMs }) {
  return new Promise((ok, falha) => {
    const texto = JSON.stringify(corpo);
    const agente = endpoint.protocol === "https:" ? https : http;
    let req;
    try {
      req = agente.request(
        {
          host: endpoint.hostname,
          port: endpoint.port || undefined,
          path: endpoint.pathname + endpoint.search,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(texto),
            // A credencial vai AQUI, e so aqui. Nunca no corpo, nunca na query.
            authorization: "Bearer " + idToken,
          },
        },
        (res) => {
          let dados = "";
          let excedeu = false;
          res.setEncoding("utf8");
          res.on("data", (d) => {
            if (excedeu) return;
            dados += d;
            if (dados.length > LIMITE_RESPOSTA_BYTES) {
              excedeu = true;
              res.destroy();
              falha(new ErroAdmissaoVip(FALHA.RESPOSTA_GRANDE));
            }
          });
          res.on("end", () => {
            if (excedeu) return;
            ok({ status: res.statusCode, corpo: dados });
          });
          // Conexao cortada no meio do corpo: `end` nao dispara, e sem isto a
          // promessa ficaria pendente para sempre e o jogador ficaria travado
          // na tela de entrar na mesa.
          res.on("error", () => {
            if (!excedeu) falha(new ErroAdmissaoVip(FALHA.CONEXAO));
          });
        }
      );
    } catch (_) {
      return falha(new ErroAdmissaoVip(FALHA.CONEXAO));
    }
    req.setTimeout(timeoutMs || TIMEOUT_MS, () => req.destroy(new ErroAdmissaoVip(FALHA.TIMEOUT)));
    req.on("error", (e) => falha(e instanceof ErroAdmissaoVip ? e : new ErroAdmissaoVip(FALHA.CONEXAO)));
    req.end(texto);
  });
}

/** O ADAPTADOR. Devolve a funcao `autorizarEntradaVip(contexto)` que o gate
 *  injeta como porta, ou `null` quando nao ha como falar com backend nenhum.
 *
 *  `null` e deliberado, e nao um erro: sem endpoint utilizavel ou sem
 *  credencial, o que existe nao e um adaptador quebrado, e a AUSENCIA de
 *  adaptador - que e exatamente o estado que o gate ja sabe tratar, recusando
 *  a entrada VIP. Devolver um adaptador que sempre falha faria a mesma coisa
 *  por um caminho mais longo, e deixaria em pe a chance de alguem, um dia,
 *  interpretar a falha dele como transitoria. */
function criarAdaptadorAdmissaoVip(opts = {}) {
  const leitura = lerEndpoint(opts.url);
  const credencial = opts.credencial || null;
  const pedir = opts.pedir || pedirAdmissaoHttps;
  const timeoutMs = opts.timeoutMs === undefined ? TIMEOUT_MS : opts.timeoutMs;
  const registrar =
    opts.registrar ||
      ((codigo) => console.warn("[admissao-vip] entrada recusada · motivo=" + codigo));

  if (!leitura.ok) return null;
  if (!credencial || typeof credencial.obterIdToken !== "function") return null;

  // tentativaEntradaId -> voo em andamento
  const emVoo = new Map();

  async function executar(contexto) {
    let idToken;
    try {
      idToken = await credencial.obterIdToken();
    } catch (e) {
      // A credencial ja tem a sua propria politica de renovacao e de descarte.
      // Aqui so se registra o codigo dela e se recusa: insistir seria a segunda
      // politica de repeticao que a DECISAO 2 proibe.
      registrar(e && e.codigo ? e.codigo : FALHA.SEM_CREDENCIAL);
      return { ok: false };
    }
    let bruto;
    try {
      bruto = await pedir({ endpoint: leitura.url, idToken, corpo: corpoDaRequisicao(contexto), timeoutMs });
    } catch (e) {
      registrar(e && e.codigo ? e.codigo : FALHA.CONEXAO);
      return { ok: false };
    }
    const r = interpretarRespostaAdmissao(bruto);
    if (!r.ok) {
      registrar(r.codigo);
      return { ok: false };
    }
    return { ok: true, admissaoId: r.admissaoId, codigoDecisao: r.codigoDecisao };
  }

  /** COALESCENCIA POR TENTATIVA. `emVoo.set` acontece SINCRONAMENTE, antes de
   *  qualquer ponto de suspensao: `executar()` roda ate o primeiro `await` e
   *  devolve a promessa, e o `.then` e o `.set` sao sincronos depois disso. Se
   *  a insercao acontecesse depois de um `await`, duas chamadas no mesmo tique
   *  veriam o mapa vazio e o backend receberia a MESMA tentativa duas vezes -
   *  que e precisamente o que uma chave de idempotencia existe para evitar. */
  function autorizarEntradaVip(contexto) {
    const t = contexto && contexto.tentativaEntradaId;
    if (typeof t !== "string" || t === "") return Promise.resolve({ ok: false });
    const voando = emVoo.get(t);
    if (voando) return voando;
    const voo = executar(contexto).then(
      (r) => {
        emVoo.delete(t);
        return r;
      },
      (e) => {
        emVoo.delete(t);
        registrar(e && e.codigo ? e.codigo : FALHA.CONEXAO);
        return { ok: false };
      }
    );
    emVoo.set(t, voo);
    return voo;
  }

  /** O que o operador pode ver. Sem URL completa, sem token, sem identidade. */
  autorizarEntradaVip.estado = function () {
    return { configurado: true, host: leitura.host, seguro: leitura.seguro, emVoo: emVoo.size };
  };

  return autorizarEntradaVip;
}

module.exports = {
  criarAdaptadorAdmissaoVip,
  lerEndpoint,
  corpoDaRequisicao,
  interpretarRespostaAdmissao,
  pedirAdmissaoHttps,
  ErroAdmissaoVip,
  CONTRATO,
  FALHA,
  VARIAVEL_URL,
  TIMEOUT_MS,
  LIMITE_RESPOSTA_BYTES,
};

  };

  __fabricas["credencial_motor"] = function (module, exports, require) {
// [CREDENCIAL] servidor/credencial_motor.js — A CREDENCIAL DE SAÍDA DO MOTOR.
//
// Módulo NOVO. É o simétrico exato de `auth_firebase`: aquele verifica a
// credencial de QUEM ENTRA (o jogador, no handshake); este produz a credencial
// de QUANDO SAÍMOS — o ID token que o futuro transporte vai apresentar à Cloud
// Function `registrarEncerramentoPartida`, que exige o claim `motorDePartidas`.
//
// O PROBLEMA QUE ELE RESOLVE. A Function só aceita ID token do Firebase, e ID
// token expira em uma hora. As saídas óbvias eram todas proibidas:
//
//   `firebase-admin` no servidor  → este repositório é zero-dependência por
//                                   decisão documentada, e o deploy roda
//                                   `npm start` sem `npm install`;
//   chave de conta de serviço     → segredo de altíssimo poder no Railway, e
//                                   nada a expira;
//   custom token guardado         → expira em uma hora e só credencial
//                                   administrativa o emite: teria de ser
//                                   renovado à mão, para sempre;
//   ID token estático             → morre em uma hora.
//
// A SAÍDA. Um REFRESH TOKEN, obtido UMA VEZ por
// `functions/scripts/bootstrap_credencial_motor.js` no repositório do app, e
// guardado como segredo do Railway. Trocá-lo por um ID token novo exige só a Web
// API Key do projeto, que não é segredo, e é uma requisição HTTPS — `https` do
// Node, nada instalado.
//
//   POST https://securetoken.googleapis.com/v1/token?key=<API_KEY>
//   content-type: application/x-www-form-urlencoded
//   grant_type=refresh_token&refresh_token=<segredo>
//
// DECISÃO 1 — FAIL CLOSED. Configuração faltando, resposta estranha, UID
// divergente, `aud`/`iss` de outro projeto, claim ausente: tudo recusa. Não
// existe caminho degradado, e não existe token "provisório". Um servidor que não
// consegue provar quem é simplesmente não fala com a Function.
//
// DECISÃO 2 — NADA EM DISCO, NADA EM LOG. O ID token vive só em memória, e o
// refresh token só na memória e no ambiente. Nenhum dos dois entra em log,
// mensagem de erro ou arquivo. Reiniciar o processo volta ao segredo do
// ambiente, e isso é o desejado: o Railway é a fonte da verdade.
//
// DECISÃO 3 — RENOVAÇÃO PREGUIÇOSA, SEM TIMER. O módulo não agenda nada por
// conta própria. Um `setInterval` manteria o processo vivo, renovaria em
// servidor ocioso e continuaria batendo no Google depois de a credencial ser
// revogada. Aqui a renovação acontece quando alguém pede um token — e se
// ninguém pede, nada acontece.
//
// DECISÃO 4 — ESTE MÓDULO NÃO É LIGADO A NADA NESTA ENTREGA. A outbox continua
// intocada, o envelope continua sem tradução e `ws_server` não o carrega. Ele é
// infraestrutura pronta para a OS do transporte. `npm start` faz exatamente o
// que fazia.
//
// DECISÃO 5 — A LEITURA LOCAL DO JWT NÃO É AUTORIDADE. O payload é decodificado
// para conferir que o token que chegou é o que se pediu (sub/aud/iss/exp/claim).
// A assinatura NÃO é verificada aqui, e não deve ser: quem tem autoridade sobre
// este token é a Function que o recebe. Implementar verificação criptográfica
// paralela criaria uma segunda opinião sobre um token que não é nosso para
// julgar. O parser é o MESMO de `auth_firebase` — um só analisador de JWT no
// bundle, para os dois não divergirem.
//
// DECISÃO 6 — `project_id` DO ENVELOPE NÃO É O FIREBASE PROJECT ID, E NÃO É
// AUTORIDADE. A V1 deste módulo comparava `json.project_id` da resposta do Secure
// Token com `FIREBASE_PROJECT_ID` e recusava na divergência. A homologação
// independente mediu o campo contra o endpoint e ele veio NUMÉRICO — o *project
// number* do Google Cloud, e não o id textual do projeto. Com a comparação de pé,
// `obterIdToken()` lançaria `PROJETO_DIVERGENTE` em toda chamada: o Railway
// falharia fechado, para sempre, e o defeito só apareceria na ativação.
//
// A comparação foi REMOVIDA, e não trocada por uma equivalente contra o número.
// Ela nunca acrescentou segurança:
//
//   • o próprio endpoint já valida o projeto do refresh token contra a API key —
//     um par incompatível volta como erro HTTP, e o erro HTTP já recusa aqui;
//   • `user_id` continua conferido, e prende a IDENTIDADE;
//   • `aud` e `iss` do ID token continuam conferidos, e prendem o PROJETO
//     TEXTUAL — e esses dois, ao contrário do envelope, estão criptograficamente
//     ligados ao token que a Function vai verificar.
//
// Um envelope pode dizer qualquer coisa; o token, não. Guardar o projeto pelo
// envelope era guardar pela metade mais fraca. O campo passou a ser INFORMATIVO:
// não é comparado, não é exigido, e a sua forma — texto, número em texto, número
// JSON ou ausência — não decide nada.

const https = require("https");
const { partesDoToken } = require("./auth_firebase");

const HOST_TOKEN = "securetoken.googleapis.com";
const CAMINHO_TOKEN = "/v1/token";

/// Teto do corpo lido. Sem ele, quem responde escolhe quanta memória gastamos.
const LIMITE_RESPOSTA_BYTES = 64 * 1024;
const TIMEOUT_MS = 10000;

/// Quanto ANTES da expiração o token é considerado velho.
///
/// Cinco minutos, e o número tem razão: entre pedir o token e a Function
/// verificá-lo há a viagem de rede, a fila do Cloud Functions e a tolerância de
/// relógio que o Google aplica (até um minuto para cada lado). Um token entregue
/// no limite chegaria expirado, e o encerramento da partida — que só acontece
/// uma vez — falharia por alguns segundos de diferença.
const MARGEM_RENOVACAO_MS = 5 * 60 * 1000;

/// O claim que a Function exige. Mesma grafia de `functions/src/autoridade.ts`.
const CLAIM = "motorDePartidas";

/// Códigos de falha. São para LOG e TESTE. Nenhum deles carrega token.
const FALHA = {
  SEM_CONFIGURACAO: "SEM_CONFIGURACAO",
  HTTP: "HTTP",
  TIMEOUT: "TIMEOUT",
  CONEXAO: "CONEXAO",
  RESPOSTA_GRANDE: "RESPOSTA_GRANDE",
  RESPOSTA_INVALIDA: "RESPOSTA_INVALIDA",
  RESPOSTA_INCOMPLETA: "RESPOSTA_INCOMPLETA",
  UID_DIVERGENTE: "UID_DIVERGENTE",
  // NÃO existe PROJETO_DIVERGENTE. O envelope não prende projeto (DECISÃO 6);
  // quem prende é `aud`/`iss` do token, e a recusa de lá é AUDIENCE_INVALIDO /
  // ISSUER_INVALIDO. Um código para "o envelope discordou" só voltaria a existir
  // junto com a comparação que quebrava a credencial.
  TOKEN_ILEGIVEL: "TOKEN_ILEGIVEL",
  SUJEITO_DIVERGENTE: "SUJEITO_DIVERGENTE",
  AUDIENCE_INVALIDO: "AUDIENCE_INVALIDO",
  ISSUER_INVALIDO: "ISSUER_INVALIDO",
  EXPIRACAO_INVALIDA: "EXPIRACAO_INVALIDA",
  SEM_AUTORIDADE: "SEM_AUTORIDADE",
};

/// As variáveis que o Railway precisa ter. Nomes, nunca valores.
const VARIAVEIS = [
  "FIREBASE_MOTOR_REFRESH_TOKEN",
  "FIREBASE_MOTOR_UID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_WEB_API_KEY",
];

/**
 * Erro tipado e REDIGIDO.
 *
 * O `codigo` é para o operador; a mensagem é montada aqui e nunca interpolada a
 * partir de resposta do servidor remoto. O motivo é concreto: a mensagem de erro
 * do endpoint de token ecoa o `refresh_token` enviado em alguns casos, e um
 * `catch` que fizesse `console.error(e)` publicaria a credencial no log do
 * Railway — de onde ela não sai nunca mais.
 */
class ErroCredencialMotor extends Error {
  constructor(codigo, detalhe) {
    super("credencial do motor: " + codigo + (detalhe ? " (" + detalhe + ")" : ""));
    this.name = "ErroCredencialMotor";
    this.codigo = codigo;
  }
}

/** Lê a configuração do ambiente. Fail closed: falta uma, falta tudo. */
function lerConfiguracao(env) {
  const fonte = env || {};
  const faltando = VARIAVEIS.filter((v) => {
    const valor = fonte[v];
    return typeof valor !== "string" || valor.length === 0;
  });
  if (faltando.length) return { ok: false, faltando };
  return {
    ok: true,
    cfg: {
      refreshToken: fonte.FIREBASE_MOTOR_REFRESH_TOKEN,
      uid: fonte.FIREBASE_MOTOR_UID,
      projectId: fonte.FIREBASE_PROJECT_ID,
      apiKey: fonte.FIREBASE_WEB_API_KEY,
    },
  };
}

/** O corpo da troca, exatamente como o endpoint espera. */
function corpoDaRenovacao(refreshToken) {
  return (
    "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken)
  );
}

/** A requisição REST. Injetável nos testes; em produção é esta. */
function pedirTokenHttps({ apiKey, refreshToken }) {
  return new Promise((ok, falha) => {
    const corpo = corpoDaRenovacao(refreshToken);
    let req;
    try {
      req = https.request(
        {
          host: HOST_TOKEN,
          path: CAMINHO_TOKEN + "?key=" + encodeURIComponent(apiKey),
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "content-length": Buffer.byteLength(corpo),
          },
        },
        (res) => {
          let bruto = "";
          let excedeu = false;
          res.setEncoding("utf8");
          res.on("data", (d) => {
            if (excedeu) return;
            bruto += d;
            if (bruto.length > LIMITE_RESPOSTA_BYTES) {
              excedeu = true;
              res.destroy();
              falha(new ErroCredencialMotor(FALHA.RESPOSTA_GRANDE));
            }
          });
          res.on("end", () => {
            if (excedeu) return;
            ok({ status: res.statusCode, corpo: bruto });
          });
          // Conexão cortada no meio do corpo: `end` não dispara, e sem isto a
          // promessa ficaria pendente para sempre e o chamador travaria.
          res.on("error", () => {
            if (!excedeu) falha(new ErroCredencialMotor(FALHA.CONEXAO));
          });
        }
      );
    } catch (_) {
      return falha(new ErroCredencialMotor(FALHA.CONEXAO));
    }
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new ErroCredencialMotor(FALHA.TIMEOUT)));
    req.on("error", (e) =>
      falha(
        e instanceof ErroCredencialMotor
          ? e
          : // A mensagem do erro de rede NÃO é propagada: `e.message` de um
            // socket pode carregar a URL, e a URL carrega a API key.
            new ErroCredencialMotor(FALHA.CONEXAO)
      )
    );
    req.end(corpo);
  });
}

/** Interpreta a resposta bruta. Separada da rede para o teste alcançá-la. */
function interpretarResposta({ status, corpo }, esperado) {
  if (status !== 200) {
    // Só o status. O corpo de erro do Google pode ecoar o refresh token.
    throw new ErroCredencialMotor(FALHA.HTTP, String(status));
  }
  let json;
  try {
    json = JSON.parse(corpo);
  } catch (_) {
    throw new ErroCredencialMotor(FALHA.RESPOSTA_INVALIDA);
  }
  if (!json || typeof json !== "object") {
    throw new ErroCredencialMotor(FALHA.RESPOSTA_INVALIDA);
  }

  const idToken = json.id_token;
  const expiresIn = Number(json.expires_in);
  // `project_id` NÃO está nesta lista, de propósito. Ver a DECISÃO 6: o campo é
  // o *project number*, não é comparado com nada, e exigir a forma de um dado que
  // não decide nada seria só mais um jeito de a credencial inteira falhar
  // fechada por causa de um campo que o servidor nem lê.
  if (
    typeof idToken !== "string" ||
    idToken.length === 0 ||
    typeof json.user_id !== "string" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new ErroCredencialMotor(FALHA.RESPOSTA_INCOMPLETA);
  }

  // O endpoint devolve QUEM é o dono do refresh token. Se não é quem esperamos,
  // o segredo do Railway pertence a outra identidade — e usá-lo faria o servidor
  // registrar partida sob autoria alheia.
  //
  // Esta é a ÚNICA conferência do envelope. O projeto não se confere aqui: ver a
  // DECISÃO 6 e, logo abaixo, `conferirSanidade`, onde `aud` e `iss` o prendem
  // pelo próprio token.
  if (json.user_id !== esperado.uid) {
    throw new ErroCredencialMotor(FALHA.UID_DIVERGENTE);
  }

  return {
    idToken,
    expiresInS: expiresIn,
    // O Firebase PODE devolver um refresh token novo. Quando devolve, é ele que
    // vale daqui em diante — continuar usando o antigo funcionaria por um tempo
    // e pararia sem aviso.
    refreshToken:
      typeof json.refresh_token === "string" && json.refresh_token.length > 0
        ? json.refresh_token
        : null,
  };
}

/**
 * SANIDADE LOCAL do ID token (§7 da OS). NÃO é verificação criptográfica.
 *
 * Cada checagem existe por um acidente concreto:
 *   sub   — o refresh token é de outra identidade;
 *   aud   — a Web API Key é de outro projeto;
 *   iss   — a resposta não veio do emissor do nosso projeto;
 *   exp   — token que já nasce vencido (relógio errado dos dois lados);
 *
 * `aud` e `iss` são, desde a DECISÃO 6, o ÚNICO ponto em que o FIREBASE_PROJECT_ID
 * textual é exigido — e o certo é que seja aqui: os dois vêm assinados dentro do
 * token, e são exatamente os campos que a Function verifica do outro lado. O
 * envelope da resposta não tem voto sobre projeto.
 *
 *   claim — o claim foi revogado desde a última renovação, e o token novo já não
 *           o carrega. Descobrir isso AQUI, e não na Function, é a diferença
 *           entre um log claro e um encerramento de partida perdido.
 */
function conferirSanidade(idToken, esperado, agoraMs) {
  const partes = partesDoToken(idToken);
  if (!partes) throw new ErroCredencialMotor(FALHA.TOKEN_ILEGIVEL);
  const p = partes.payload;

  if (p.sub !== esperado.uid) throw new ErroCredencialMotor(FALHA.SUJEITO_DIVERGENTE);
  if (p.aud !== esperado.projectId) throw new ErroCredencialMotor(FALHA.AUDIENCE_INVALIDO);
  if (p.iss !== "https://securetoken.google.com/" + esperado.projectId) {
    throw new ErroCredencialMotor(FALHA.ISSUER_INVALIDO);
  }
  if (typeof p.exp !== "number" || !Number.isFinite(p.exp)) {
    throw new ErroCredencialMotor(FALHA.EXPIRACAO_INVALIDA);
  }
  const expiraEmMs = p.exp * 1000;
  if (expiraEmMs <= agoraMs) throw new ErroCredencialMotor(FALHA.EXPIRACAO_INVALIDA);
  // `=== true` e ESTRITO, igual à guarda do outro lado. Um claim que chegue como
  // `"true"` ou `1` não autoriza lá, e aceitar aqui só adiaria a recusa.
  if (p[CLAIM] !== true) throw new ErroCredencialMotor(FALHA.SEM_AUTORIDADE);

  return { expiraEmMs };
}

/**
 * Cria o provedor de ID token do motor.
 *
 *   const cred = criarCredencialDoMotor();
 *   const idToken = await cred.obterIdToken();   // renova sozinho quando precisa
 *
 * É a camada de CICLO DE VIDA sobre o cliente REST acima: cache com margem,
 * coalescência de chamadas simultâneas, rotação do refresh token em memória e
 * descarte no erro. O cliente REST sabe fazer UMA troca; esta camada sabe
 * quando fazê-la e quantas vezes.
 *
 * `pedirToken`, `agora` e `margemMs` existem para os TESTES: nenhum deles desliga
 * verificação nenhuma — o teste ainda passa por `interpretarResposta` e
 * `conferirSanidade` inteiras.
 */
function criarCredencialDoMotor(opts = {}) {
  const leitura = lerConfiguracao(opts.env || process.env);
  const pedir = opts.pedirToken || pedirTokenHttps;
  const _agora = opts.agora || (() => Date.now());
  const margemMs = opts.margemMs === undefined ? MARGEM_RENOVACAO_MS : opts.margemMs;

  // O refresh token vive AQUI, em memória, e nasce do ambiente. Uma rotação
  // atualiza esta variável e nada mais: nada é gravado, e reiniciar o processo
  // volta ao segredo do Railway — que é a fonte da verdade.
  let refreshToken = leitura.ok ? leitura.cfg.refreshToken : null;
  let idToken = null;
  let expiraEmMs = 0;
  let emVoo = null;
  let renovacoes = 0;
  let rotacoes = 0;

  function configurada() {
    return leitura.ok;
  }

  /** O que o operador pode ver. Nenhum token, nem pedaço. */
  function estado() {
    return {
      configurada: leitura.ok,
      faltando: leitura.ok ? [] : leitura.faltando.slice(),
      temToken: idToken !== null,
      expiraEmMs: idToken !== null ? expiraEmMs : null,
      renovacoes,
      rotacoes,
    };
  }

  function valido() {
    return idToken !== null && _agora() + margemMs < expiraEmMs;
  }

  async function renovar() {
    const cfg = leitura.cfg;
    const bruto = await pedir({ apiKey: cfg.apiKey, refreshToken });
    const r = interpretarResposta(bruto, { uid: cfg.uid, projectId: cfg.projectId });
    const sanidade = conferirSanidade(r.idToken, { uid: cfg.uid, projectId: cfg.projectId }, _agora());

    if (r.refreshToken && r.refreshToken !== refreshToken) {
      refreshToken = r.refreshToken;
      rotacoes++;
    }
    idToken = r.idToken;
    // A expiração que vale é a do PRÓPRIO token, não a que o corpo da resposta
    // anunciou. Se as duas divergirem, quem verifica lê o `exp` do token.
    expiraEmMs = sanidade.expiraEmMs;
    renovacoes++;
    return idToken;
  }

  /**
   * O ID token válido, renovando se preciso.
   *
   * COALESCÊNCIA. `emVoo` é atribuído SINCRONAMENTE, antes de qualquer `await`.
   * É o detalhe que faz cem chamadas simultâneas produzirem UMA renovação: se a
   * atribuição acontecesse depois de um ponto de suspensão, todas as chamadas
   * que chegassem no mesmo tique veriam `emVoo === null` e disparariam a sua
   * própria — o Google devolveria um refresh token novo para cada uma, e as
   * rotações concorrentes invalidariam umas às outras.
   */
  function obterIdToken() {
    if (!leitura.ok) {
      return Promise.reject(
        new ErroCredencialMotor(FALHA.SEM_CONFIGURACAO, leitura.faltando.join(", "))
      );
    }
    if (valido()) return Promise.resolve(idToken);
    if (emVoo) return emVoo;

    emVoo = renovar().then(
      (t) => {
        emVoo = null;
        return t;
      },
      (e) => {
        emVoo = null;
        // DESCARTE. O token em memória (se havia) já estava vencido ou perto
        // disso — foi por isso que se tentou renovar. Mantê-lo faria a próxima
        // chamada devolver um token que a Function vai recusar, e o defeito
        // apareceria como "encerramento negado" em vez de "credencial quebrada".
        idToken = null;
        expiraEmMs = 0;
        throw e instanceof ErroCredencialMotor ? e : new ErroCredencialMotor(FALHA.CONEXAO);
      }
    );
    return emVoo;
  }

  return { obterIdToken, estado, configurada };
}

module.exports = {
  criarCredencialDoMotor,
  lerConfiguracao,
  corpoDaRenovacao,
  interpretarResposta,
  conferirSanidade,
  pedirTokenHttps,
  ErroCredencialMotor,
  FALHA,
  VARIAVEIS,
  CLAIM,
  HOST_TOKEN,
  CAMINHO_TOKEN,
  LIMITE_RESPOSTA_BYTES,
  TIMEOUT_MS,
  MARGEM_RENOVACAO_MS,
};

  };

  __fabricas["chat_ponte"] = function (module, exports, require) {
// [CHAT] servidor/chat_ponte.js — A PONTE PARA A AUTORIDADE DE CHAT.
//
// O QUE ESTE MÓDULO É: o único lugar do servidor que fala com
// `functions-moderacao`. Ele apresenta a credencial renovável do motor, monta a
// URL da callable, manda o pedido e devolve a resposta CRUA de quem decide.
//
// O QUE ESTE MÓDULO NÃO É, e não pode virar: autoridade. Ele não olha bloqueio,
// não olha sanção, não valida texto, não escolhe destinatários, não cunha
// `messageId` e não remonta identidade pública. Se um `if` de política aparecer
// aqui, ele está no lugar errado — a decisão é da Function, e este arquivo só
// carrega pergunta e resposta.
//
// SIMÉTRICO DE `auth_firebase`. Aquele verifica a credencial de QUEM ENTRA; o
// `credencial_motor` produz a credencial de QUANDO SAÍMOS; este a APRESENTA. A
// DECISÃO 4 do cabeçalho de `credencial_motor` dizia que o módulo nascia
// desligado, "infraestrutura pronta para a OS do transporte". É esta OS, e é
// aqui que ele é ligado — sem segunda credencial, sem chave estática e sem
// `firebase-admin`.
//
// ZERO DEPENDÊNCIA, como o resto do repositório: `https` do Node e nada mais.
//
// TESTÁVEL SEM REDE (§28). `opts.chamar` substitui o transporte inteiro. Sem
// injeção, o padrão é o HTTPS real — e a suíte NUNCA usa o padrão, porque um
// teste que alcance a internet é um teste que falha no avião.

const https = require("https");

/// Códigos de falha DESTE módulo. Nenhum deles atravessa o fio até o jogador sem
/// passar pela redação de `servidor.js` (§17): são para log de operador.
const FALHA_PONTE = {
  SEM_CREDENCIAL: "PONTE_SEM_CREDENCIAL",
  SEM_CONFIGURACAO: "PONTE_SEM_CONFIGURACAO",
  REDE: "PONTE_REDE",
  TIMEOUT: "PONTE_TIMEOUT",
  RESPOSTA_ILEGIVEL: "PONTE_RESPOSTA_ILEGIVEL",
  RECUSA_DA_AUTORIDADE: "PONTE_RECUSA",
};

/// Teto de resposta. Uma callable de chat responde com uma projeção e uma lista
/// curta de UIDs; qualquer coisa maior que isto é defeito ou ataque, e ler sem
/// limite é como se entrega memória a quem responde.
const LIMITE_RESPOSTA_BYTES = 64 * 1024;

/// Quanto se espera pela autoridade antes de desistir.
///
/// TIMEOUT NÃO É APROVAÇÃO (§22 item 19). Ao estourar, este módulo REJEITA — e
/// quem chama recusa a mensagem. Não existe caminho em que o silêncio da
/// autoridade se transforme em mensagem entregue.
const TIMEOUT_MS = 8000;

class ErroPonteDeChat extends Error {
  constructor(codigo, detalhe, familia) {
    // A mensagem é montada aqui e NUNCA interpolada a partir do corpo da
    // resposta remota: o corpo pode conter o texto do jogador, e texto de
    // jogador não entra em mensagem de erro nem em log.
    super("ponte de chat: " + codigo);
    this.name = "ErroPonteDeChat";
    this.codigo = codigo;
    // `detalhe` é o código de recusa da autoridade (curto, do vocabulário dela),
    // nunca o corpo bruto.
    this.detalhe = detalhe || null;
    // O motivo CATEGORICO da recusa, quando a autoridade o mandou. Curto e de
    // lista fechada, como o `detalhe` — e pelo mesmo motivo.
    this.familia = familia || null;
  }
}

/// POST numa callable do Firebase, com o ID token do motor.
///
/// O formato do corpo (`{data: ...}`) e o do sucesso (`{result: ...}`) são o
/// protocolo das callables, e não invenção nossa.
function chamarHttps({ url, idToken, dados }) {
  return new Promise((resolve, reject) => {
    let alvo;
    try {
      alvo = new URL(url);
    } catch (_) {
      return reject(new ErroPonteDeChat(FALHA_PONTE.SEM_CONFIGURACAO));
    }

    const corpo = Buffer.from(JSON.stringify({ data: dados }), "utf8");
    let req;
    try {
      req = https.request(
        {
          method: "POST",
          hostname: alvo.hostname,
          path: alvo.pathname + alvo.search,
          port: alvo.port || 443,
          headers: {
            "content-type": "application/json",
            "content-length": corpo.length,
            authorization: "Bearer " + idToken,
          },
          timeout: TIMEOUT_MS,
        },
        (res) => {
          const pedacos = [];
          let total = 0;
          res.on("data", (d) => {
            total += d.length;
            if (total > LIMITE_RESPOSTA_BYTES) {
              req.destroy();
              return;
            }
            pedacos.push(d);
          });
          res.on("end", () => {
            let json = null;
            try {
              json = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
            } catch (_) {
              return reject(new ErroPonteDeChat(FALHA_PONTE.RESPOSTA_ILEGIVEL));
            }
            resolve({ status: res.statusCode, json });
          });
        }
      );
    } catch (_) {
      return reject(new ErroPonteDeChat(FALHA_PONTE.REDE));
    }

    req.on("timeout", () => {
      req.destroy();
      reject(new ErroPonteDeChat(FALHA_PONTE.TIMEOUT));
    });
    // A mensagem do erro de rede NÃO é propagada: ela pode carregar host, IP e
    // caminho, e nada disso ajuda quem lê o log de chat.
    req.on("error", () => reject(new ErroPonteDeChat(FALHA_PONTE.REDE)));
    req.end(corpo);
  });
}

/**
 * Cria a ponte.
 *
 * @param opts.credencial  o objeto de `credencial_motor` (`obterIdToken`).
 * @param opts.projectId   projeto do Firebase (para montar a URL).
 * @param opts.regiao      região das Functions.
 * @param opts.nomes       nomes das Functions, vindos do contrato compartilhado.
 * @param opts.chamar      substitui o transporte HTTPS (testes).
 * @param opts.baseUrl     substitui a origem (emulador).
 */
function criarPonteDeChat(opts = {}) {
  const credencial = opts.credencial || null;
  const projectId = opts.projectId || process.env.FIREBASE_PROJECT_ID || null;
  const regiao = opts.regiao || "southamerica-east1";
  const nomes = opts.nomes || {
    definirCanal: "definirCanalDeChat",
    enviarPeloMotor: "enviarMensagemChatPeloMotor",
  };
  const chamar = opts.chamar || chamarHttps;
  const baseUrl =
    opts.baseUrl || (projectId ? "https://" + regiao + "-" + projectId + ".cloudfunctions.net" : null);

  function configurada() {
    return Boolean(credencial && credencial.configurada && credencial.configurada() && baseUrl);
  }

  function urlDe(nome) {
    return baseUrl + "/" + nome;
  }

  /// Executa uma chamada autenticada e traduz a resposta.
  ///
  /// FALHA FECHADA em todos os caminhos: sem credencial, sem configuração, rede
  /// caída, timeout, resposta ilegível, recusa da autoridade — todos REJEITAM.
  /// Não há retorno "provisório" nem degradado.
  async function invocar(nome, dados) {
    if (!configurada()) {
      throw new ErroPonteDeChat(FALHA_PONTE.SEM_CONFIGURACAO);
    }

    let idToken;
    try {
      idToken = await credencial.obterIdToken();
    } catch (e) {
      // O código da credencial é útil ao operador e não revela segredo.
      throw new ErroPonteDeChat(FALHA_PONTE.SEM_CREDENCIAL, e && e.codigo);
    }

    const r = await chamar({ url: urlDe(nome), idToken, dados });

    if (r && r.status === 200 && r.json && r.json.result !== undefined) {
      return r.json.result;
    }

    // Recusa da autoridade. O código dela vem em `details.recusa` — vocabulário
    // curto e já pensado para ser mostrado. O resto da resposta é descartado.
    const detalhes = (r && r.json && r.json.error && r.json.error.details) || null;
    const detalhe =
      (detalhes && detalhes.recusa) ||
      (r && r.json && r.json.error && r.json.error.status) ||
      null;
    // [COMUNICACAO CONTROLADA] A FAMILIA e o motivo CATEGORICO, e ela existe
    // para que ESTE arquivo nao precise conhecer o vocabulario inteiro da
    // autoridade. Sem ela, cada recusa nova la vira "tente de novo" aqui, em
    // silencio — e o jogador fica tentando uma porta que nunca vai abrir.
    throw new ErroPonteDeChat(
      FALHA_PONTE.RECUSA_DA_AUTORIDADE,
      detalhe,
      (detalhes && detalhes.familia) || null
    );
  }

  /**
   * Declara (cria ou atualiza) o canal de chat de uma sala.
   *
   * O CONTEÚDO VEM DO SERVIDOR, sempre: quem está sentado, qual superfície, se
   * está aberto. O cliente não participa desta chamada de forma nenhuma.
   */
  /**
   * Declara o canal.
   *
   * [COMUNICACAO CONTROLADA] O que mudou na versao 2 do contrato: sai
   * `superficie`, entram as DUAS DIMENSOES que este processo ja tem fixadas na
   * construcao (`tipoPartida`, `categoriaCompetitiva`) e, na Mesa Privada, o
   * `codigoDaSala`.
   *
   * POR QUE NAO MANDAR O AMBIENTE PRONTO: seria conceder o ambiente por um
   * campo de quem chama, e o ambiente decide se existe teclado. A autoridade
   * traduz as duas dimensoes e, para a Mesa Privada, ainda confere a sala em
   * `salasPrivadas` — que este servidor nao consegue forjar.
   *
   * O CODIGO DA SALA VIAJA E NAO FICA. A autoridade o usa para localizar a sala
   * e os assentos admitidos, e nao o grava no canal. Ele nao entra em log
   * nenhum deste arquivo.
   */
  function definirCanal({
    canalId,
    tipoPartida,
    categoriaCompetitiva,
    codigoDaSala,
    modo,
    participantes,
    aberto,
  }) {
    return invocar(nomes.definirCanal, {
      canalId,
      tipoPartida,
      categoriaCompetitiva,
      codigoDaSala,
      modo,
      participantes,
      aberto,
    });
  }

  /**
   * Pede à autoridade que a mensagem exista.
   *
   * `autorUid` vai no payload porque o UID autenticado desta chamada é o do
   * MOTOR, não o do autor — e a autoridade só aceita isso de quem tem o claim
   * `motorDePartidas`, conferindo ainda que aquele UID ocupa o canal.
   */
  /**
   * Envia uma comunicacao em nome de um jogador.
   *
   * [COMUNICACAO CONTROLADA] `tipo` e `itemId` entram; `superficie` sai (a
   * autoridade a deriva do ambiente do canal). Os SEIS campos vao sempre, e os
   * ausentes vao como `null` — a autoridade trata `null` como ausencia, e
   * mandar sempre o mesmo conjunto e o que permite a suite afirmar o formato do
   * pedido contra o contrato compartilhado.
   */
  function enviarMensagem({ autorUid, intentId, canalId, tipo, itemId, conteudo }) {
    return invocar(nomes.enviarPeloMotor, {
      autorUid,
      intentId,
      canalId,
      tipo: tipo === undefined ? null : tipo,
      itemId: itemId === undefined ? null : itemId,
      conteudo: conteudo === undefined ? null : conteudo,
    });
  }

  return { definirCanal, enviarMensagem, configurada };
}

module.exports = {
  criarPonteDeChat,
  chamarHttps,
  ErroPonteDeChat,
  FALHA_PONTE,
  TIMEOUT_MS,
  LIMITE_RESPOSTA_BYTES,
};

  };

  __fabricas["servidor"] = function (module, exports, require) {
// servidor/servidor.js — SERVIDOR DE SALAS (protocolo), multiplayer M2
// Despachante de mensagens INDEPENDENTE DE TRANSPORTE. Fala o protocolo do
// MULTIPLAYER-PLANO.md (criarMesa / entrarMesa / iniciarPartida / jogada / sair)
// e transmite o ESTADO por assento (cada humano recebe só a SUA visão).
//
// Por que sem rede aqui? O sandbox não instala `ws` (registro bloqueado) e o
// deploy é o Milestone 5. Deixando o servidor agnóstico de transporte, dá pra
// testar a mesa inteira com clientes simulados AGORA, e o adaptador WebSocket
// (servidor/ws_adapter.js) é só uma casca fininha que chama isto aqui.
//
// Contrato do transporte:
//   const id = servidor.conectar(enviar)  // enviar(msgObj) manda pro cliente
//   servidor.processar(id, msgObj)         // recebe uma mensagem do cliente
//   servidor.desconectar(id)               // cliente caiu/saiu
//
// [PATCH WS-AUTH] IDENTIDADE — leia antes de mexer aqui.
// A conexão nasce SEM identidade. O cliente não escolhe quem ele é: ele
// APRESENTA uma credencial, o servidor VERIFICA, e o servidor DERIVA o uid.
//
//   CONECTADO_NAO_AUTENTICADO  →  AUTENTICANDO  →  AUTENTICADO
//                                      ↓ (falha)
//                                   recusado + conexão fechada
//
// Enquanto não estiver AUTENTICADO, o único tipo aceito é "auth". Todo o resto
// (mesa, jogada, perfil, avatar, carteira) é recusado sem efeito colateral.
// Depois de AUTENTICADO, `c.uidAutenticado` e `c.jogadorId` são gravados como
// propriedades NÃO-GRAVÁVEIS: nenhum comando posterior troca a identidade da
// conexão, e nenhum `msg.jogadorId` é lido em lugar nenhum deste arquivo.

const { criarGerenciador, MOTIVO_CONTROLE, CONTROLE } = require("./salas");

// ===========================================================================
// [CHAT] PRODUTOR DO CANAL — o contexto estável que a autoridade consome.
// ===========================================================================
//
// O QUE O SERVIDOR SABE E A AUTORIDADE NÃO: quem está sentado, em que sala, e
// se a partida acabou. É só isso que ele produz. Bloqueio, sanção, autoria,
// texto, `messageId` e destinatários continuam sendo decididos por
// `functions-moderacao` — nada disso é recalculado aqui.
//
// VOCABULÁRIO CONGELADO. Os valores abaixo são os do contrato compartilhado
// `contrato/chat-transporte-v1.json`, que existe idêntico nos dois
// repositórios. `test/chat_contrato.test.js` afirma que estas constantes batem
// com o arquivo — se alguém mudar uma e não a outra, a suíte reprova. É o que
// impede o servidor e a Function de falarem dialetos diferentes.

const crypto = require("crypto");

/** Superfície da mesa. O espectador tem valor próprio e NÃO é usado no envio. */
const CHAT_SUPERFICIE_MESA = "mesa_de_partida";

/** Papéis dentro do canal. Só `sentado` fala e recebe. */
const CHAT_PAPEL = {
  SENTADO: "jogador_sentado",
  ESPECTADOR: "espectador",
  FORA: "fora_do_canal",
};

/** Tipos do fio. */
const CHAT_FIO = {
  PEDIDO: "chat_enviar",
  ENTREGA: "chat_mensagem",
  RECIBO: "chat_ack",
};

/** Desfechos do recibo ao remetente. */
const CHAT_ACK = {
  ACEITA: "aceita",
  REPETIDA: "repetida",
  RECUSADA: "recusada",
};

/**
 * Códigos que PODEM atravessar o fio (§17).
 *
 * REDIGIDOS DE PROPÓSITO. `indisponivel` cobre bloqueio E sanção de terceiro sem
 * dizer qual dos dois foi — porque dizer "B te bloqueou" entrega a decisão
 * pessoal de B a quem ele bloqueou, e dizer "B está suspenso" entrega estado
 * administrativo de terceiro. `silenciado` é diferente: é sobre o PRÓPRIO
 * remetente, e ele tem direito de saber por que não consegue falar.
 */
const CHAT_RECUSA = {
  TEXTO_INVALIDO: "texto_invalido",
  SEM_ASSENTO: "sem_assento",
  SILENCIADO: "silenciado",
  INDISPONIVEL: "indisponivel",
  CANAL_FECHADO: "canal_fechado",
  INTENCAO_INVALIDA: "intencao_invalida",
  INTENCAO_REUTILIZADA: "intencao_reutilizada",
  TENTE_DE_NOVO: "tente_de_novo",
  // [COMUNICACAO CONTROLADA] O ambiente nao admite o que se pediu: texto livre
  // fora da Mesa Privada, item fora do catalogo daquele lugar, chat desligado.
  // UM codigo para os tres porque a diferenca entre eles nao muda o que o
  // jogador faz a seguir — e porque detalhar aqui contaria ao cliente
  // adulterado exatamente qual porta ele nao conseguiu abrir.
  COMUNICACAO_NAO_PERMITIDA: "comunicacao_nao_permitida",
  // [COMUNICACAO CONTROLADA] Cooldown, limite por janela, repeticao, rajada e o
  // freio automatico por abuso. Quanto falta vem em `liberaEmMs`, que e
  // informacao sobre o PROPRIO remetente.
  RITMO: "muito_rapido",
};

/**
 * O `canalId` a partir do código da sala.
 *
 * DIGEST, e não o código cru, por duas razões:
 *
 *  1. O código da sala É A CHAVE DE ENTRADA de uma mesa privada — quem o tem,
 *     entra. Ele tem 4 dígitos ("BURACO-1234"), então é adivinhável, e a §6
 *     proíbe segredo no identificador. O `canalId` viaja na projeção e é
 *     referenciado numa denúncia; não pode ser o convite.
 *  2. ESTABILIDADE. O digest é função só do código, então ele não muda com
 *     socket, reconexão, geração de transporte, assento nem partida. Uma queda
 *     de conexão não cria outro canal — que é exatamente o que a §6 exige.
 *
 * NÃO derivado de UID: o código da sala não contém UID.
 *
 * 32 hex = 128 bits. O valor não é segredo e não autentica ninguém; ele só
 * precisa não colidir entre salas.
 */
function canalIdDeCodigo(codigo) {
  return crypto
    .createHash("sha256")
    .update("canal-de-chat|" + String(codigo), "utf8")
    .digest("hex")
    .slice(0, 32);
}

/**
 * A composição do canal, derivada do ESTADO DA SALA — nunca de conexão.
 *
 * FONTE: `sala.assentos[i]`, que é o registro autoritativo de quem ocupa a mesa.
 * Deliberadamente NÃO é a lista de conexões abertas, e a diferença aparece na
 * reconexão: `sair` pós-início troca o tipo em `sala.jogo.assentos` (o jogador
 * vira bot no JOGO) e não toca `sala.assentos`, então uma queda de conexão não
 * altera a composição do canal. Se a fonte fosse conexão, cada oscilação de rede
 * remexeria o canal e a §7 seria impossível de cumprir.
 *
 * BOT NUNCA ENTRA (§21). Só `tipo === "humano"` com `jogadorId`. Um bot no canal
 * seria um destinatário sem pessoa, e um passo de distância de bot que conversa.
 *
 * ESPECTADOR NÃO ENTRA. Quem assiste não ocupa assento, então não aparece em
 * `sala.assentos` — a exclusão é por construção, e não por filtro que alguém
 * pode esquecer.
 */
function composicaoDoCanal(sala) {
  if (!sala || !Array.isArray(sala.assentos)) return [];
  const fora = [];
  for (const a of sala.assentos) {
    if (!a || a.tipo !== "humano") continue;
    if (typeof a.jogadorId !== "string" || !a.jogadorId) continue;
    fora.push({ uid: a.jogadorId, papel: CHAT_PAPEL.SENTADO });
  }
  return fora;
}

/**
 * O canal aceita mensagem?
 *
 * `!sala.liquidada`, e a escolha tem base no domínio, não em preferência: quem
 * gerencia essa marca é `salas.js`, que a liga em `liquidar` (encerramento
 * autoritativo da partida) e a DESLIGA em `iniciarPartida`. Então o
 * comportamento na revanche não foi decidido aqui — ele cai do estado que a sala
 * já mantinha antes desta OS: partida encerrada não recebe fala, e partida nova
 * na mesma sala volta a receber.
 *
 * A sala nunca é destruída neste servidor (não há `delete salas[codigo]`), então
 * "encerrar definitivamente" é o encerramento da PARTIDA — não a morte da sala.
 */
function canalAberto(sala) {
  return Boolean(sala) && sala.liquidada !== true;
}

/**
 * A impressão do canal: o que faz uma sincronização valer a pena.
 *
 * Sem isto, `broadcastSala` chamaria a Function em cada jogada — dezenas de
 * chamadas por partida para declarar o mesmo canal. Com isto, a chamada só sai
 * quando a composição ou o estado de aceitação MUDA de fato, e a reconexão (que
 * não muda nenhum dos dois) não gera chamada nenhuma.
 */
function impressaoDoCanal(sala) {
  const uids = composicaoDoCanal(sala)
    .map((p) => p.uid)
    .slice()
    .sort();
  return (canalAberto(sala) ? "1" : "0") + "|" + uids.join(",");
}

/**
 * Traduz a recusa da autoridade num código seguro para o fio (§17).
 *
 * LISTA DE PERMISSÃO. Qualquer coisa que não esteja mapeada vira
 * `tente_de_novo` — nunca o código bruto da autoridade, nunca a mensagem, nunca
 * o corpo da resposta. É o que impede um código novo lá dentro de virar
 * vazamento aqui por omissão.
 *
 * `contatoRecusado` e `suspensaoImpedeChat` colapsam em respostas diferentes de
 * propósito: o primeiro pode ser sobre TERCEIRO (bloqueio) e por isso vira
 * `indisponivel`; o segundo é sobre quem escreve.
 */
function redigirRecusaDeChat(recusaDaAutoridade, familia) {
  // [COMUNICACAO CONTROLADA] A FAMILIA vem primeiro, e e ela que sustenta o
  // acrescimo desta OS. O `switch` por nome continua embaixo, intacto: ele e o
  // que traduz as recusas que ja existiam, e apagar qualquer uma delas mudaria
  // a resposta de um caso ja provado.
  //
  // NENHUMA FAMILIA E NOMEADA POR REGRA COMERCIAL. "direito" cobre item premium
  // sem assinatura E evento de sistema pedido por quem nao e autoridade — as
  // duas sao "voce nao pode isto", e detalhar qual das duas contaria ao cliente
  // adulterado exatamente que porta ele nao abriu.
  switch (familia) {
    case "ambiente":
    case "catalogo":
    case "direito":
      return CHAT_RECUSA.COMUNICACAO_NAO_PERMITIDA;
    case "ritmo":
      return CHAT_RECUSA.RITMO;
  }

  switch (recusaDaAutoridade) {
    case "conteudoVazio":
    case "conteudoNaoTexto":
    case "conteudoAcimaDoLimite":
    case "conteudoComCaractereDeControle":
      return CHAT_RECUSA.TEXTO_INVALIDO;
    case "papelSemDireitoDeFala":
    case "semDestinatarios":
    case "superficieNaoAceitaChat":
      return CHAT_RECUSA.SEM_ASSENTO;
    case "suspensaoImpedeChat":
      return CHAT_RECUSA.SILENCIADO;
    case "contatoRecusado":
      return CHAT_RECUSA.INDISPONIVEL;
    case "canalFechado":
    case "canalDesconhecido":
      return CHAT_RECUSA.CANAL_FECHADO;
    case "intencaoInvalida":
      return CHAT_RECUSA.INTENCAO_INVALIDA;
    case "intencaoReutilizada":
      return CHAT_RECUSA.INTENCAO_REUTILIZADA;
    // [COMUNICACAO CONTROLADA] O que o AMBIENTE nao admite. Note que
    // `textoLivreNaoPermitidoNoAmbiente` e a recusa que o jogador de Mesa
    // Publica recebe quando tenta digitar — e ela nao vira `texto_invalido`,
    // porque o texto nao tinha nada de errado: o lugar e que nao aceita texto.
    default:
      return CHAT_RECUSA.TENTE_DE_NOVO;
  }
}


// [PATCH WS-AUTH] estados de autenticação da conexão
//
//   CONECTADO_NAO_AUTENTICADO → AUTENTICANDO → AUTENTICADO
//                                                   ↓ passou o `exp` do token
//                                          CREDENCIAL_EXPIRADA
//                                             ↓ auth com token novo do MESMO uid
//                                              AUTENTICADO
//                                             ↓ carência estourada / outro uid
//                                            conexão fechada
const AUTH = {
  NAO_AUTENTICADO: "CONECTADO_NAO_AUTENTICADO",
  AUTENTICANDO: "AUTENTICANDO",
  AUTENTICADO: "AUTENTICADO",
  EXPIRADA: "CREDENCIAL_EXPIRADA",
};

// [PATCH WS-AUTH] VERSÃO DO PROTOCOLO DE CONEXÃO.
//   1 = protocolo antigo, sem autenticação (identidade declarada pelo cliente).
//   2 = este: a conexão apresenta credencial e o servidor deriva a identidade.
// O mínimo é 2 e não vai baixar: aceitar 1 seria exatamente o fallback que
// reabriria a confiança em `jogadorId` vindo do cliente.
const PROTOCOLO_ATUAL = 2;
const PROTOCOLO_MINIMO = 2;

// Carência para renovar a credencial de uma conexão que expirou em pleno uso.
// Curta de propósito: é só o tempo de o cliente pedir um token novo ao SDK.
const CARENCIA_RENOVACAO_MS = 30000;

// [PATCH WS-AUTH] Campos de identidade que o cliente PODE mandar por hábito ou
// por má-fé. Nenhum deles autentica nada; se vierem divergindo da identidade
// vinculada, o comando é RECUSADO (a divergência indica protocolo manipulado).
const CAMPOS_DE_IDENTIDADE = ["jogadorId", "uid", "playerId", "usuarioId", "ownerId"];

function criarServidor(opts = {}) {
  // autoBots:false → o servidor controla o ritmo dos bots (respiro). `agendar`
  // decide o tempo: padrão é IMEDIATO (síncrono, ótimo pros testes); no navegador
  // passa-se um setTimeout(~1100ms) pra dar pra acompanhar a jogada dos robôs.
  const ger = criarGerenciador(Object.assign({}, opts, { autoBots: false }));
  const contas = opts.contas || null; // cofre de contas (opcional)
  const agendar = opts.agendar || ((fn) => fn());
  // [PATCH WS-AUTH] verificador de credencial. SEM PADRÃO PERMISSIVO: se não
  // for injetado, toda autenticação falha e nenhum comando de jogador roda.
  // É de propósito — não existe "servidor sem auth" nem modo legado.
  const verificarToken = opts.verificarToken || (() => Promise.resolve({ ok: false, codigo: "SEM_VERIFICADOR" }));

  // ==========================================================================
  // [CHAT] TRANSPORTE — produtor do canal e entrega da projeção.
  // ==========================================================================
  //
  // SEM PADRÃO PERMISSIVO, igual ao `verificarToken` acima: sem ponte injetada
  // não existe chat. Não há "modo local" nem fallback que grave mensagem sem
  // passar pela autoridade — a ausência da ponte recusa o envio, e é isso.
  const chatPonte = opts.chatPonte || null;

  /// Última impressão sincronizada por sala. Evita declarar o mesmo canal a cada
  /// jogada, e é o que faz a reconexão não gerar chamada nenhuma.
  const chatImpressao = {};

  /// Declara o canal quando (e só quando) o estado estável da mesa mudou.
  ///
  /// NÃO É AWAIT NO CAMINHO DO JOGO. Um erro da autoridade de chat não pode
  /// ocupar assento, derrubar conexão nem alterar a partida (§22 item 18): a
  /// falha é registrada e o jogo segue. O preço é o canal ficar velho até a
  /// próxima mudança — e a próxima mudança tenta de novo, porque a impressão só
  /// é gravada quando a chamada dá certo.
  function sincronizarCanal(codigo) {
    if (!chatPonte || !codigo) return;
    const sala = ger.salas[codigo];
    if (!sala) return;

    const impressao = impressaoDoCanal(sala);
    if (chatImpressao[codigo] === impressao) return;

    const participantes = composicaoDoCanal(sala);
    const aberto = canalAberto(sala);

    // Marca ANTES de esperar, para que duas mudanças seguidas não disparem duas
    // chamadas concorrentes com o mesmo conteúdo. Em caso de falha a marca é
    // desfeita, e a próxima mudança tenta de novo.
    chatImpressao[codigo] = impressao;

    Promise.resolve()
      .then(() =>
        chatPonte.definirCanal({
          canalId: canalIdDeCodigo(codigo),
          // [COMUNICACAO CONTROLADA] As duas dimensoes, e nao o ambiente. A
          // topologia e a DECLARADA — ver `topologiaDeclarada` — porque a
          // resolvida vale `privada` por padrao e faria toda instancia nao
          // configurada pedir o ambiente com teclado.
          // AUSENCIA DE DECLARACAO VIRA `publica`, e NUNCA `privada`.
          //
          // Uma instancia sem topologia declarada existe: e o padrao da base, e
          // e o caso de toda a suite. Mandar `null` faria a autoridade recusar
          // o canal inteiro e o chat morreria nessas instancias; mandar
          // `privada` (a topologia RESOLVIDA) faria todas elas pedirem o unico
          // ambiente com teclado. `publica` e a terceira saida e a correta: o
          // ambiente online mais restritivo — falas prontas, sem digitacao.
          tipoPartida: ger.topologiaDeclarada() || "publica",
          categoriaCompetitiva: ger.categoriaDaSala(codigo),
          // So faz sentido na Mesa Privada, e la e obrigatorio: e por ele que a
          // autoridade acha a sala registrada e os assentos admitidos. Fora da
          // topologia `privada` vai `null`, e nunca e gravado do outro lado.
          codigoDaSala: ger.topologiaDeclarada() === "privada" ? codigo : null,
          // O modo da MESA. Na Mesa Privada a autoridade IGNORA este campo e le
          // a escolha gravada em `salasPrivadas` — o convidado (e este
          // servidor) nao muda a configuracao do anfitriao. Fora dela, o modo
          // possivel e o de balões, e `completo` seria recusado.
          modo: "apenas_emotes",
          participantes,
          aberto,
        })
      )
      .catch((e) => {
        delete chatImpressao[codigo];
        // Código de operador, nunca corpo de resposta e nunca texto de jogador.
        console.warn(
          "[chat] canal nao sincronizado sala=" + codigo + " codigo=" + ((e && e.codigo) || "DESCONHECIDO")
        );
      });
  }

  /// Entrega a projeção APENAS a quem a autoridade autorizou (§12).
  ///
  /// Percorre `destinatarios` — a lista que veio da Function — e não a sala. Quem
  /// ficou de fora não recebe nem o pacote para descartar depois: o `enviar` nunca
  /// é chamado para ele. Uma implementação que mandasse para a sala inteira e
  /// deixasse o cliente esconder seria bloqueio decorativo.
  ///
  /// O UID é usado AQUI, dentro da infraestrutura, só para achar o socket. O que
  /// atravessa o fio é `dados`, que é a projeção segura montada pela autoridade —
  /// este arquivo não acrescenta um campo a ela.
  function entregarChat(codigo, destinatarios, projecao) {
    if (!Array.isArray(destinatarios) || !projecao) return 0;
    const permitidos = Object.create(null);
    for (const uid of destinatarios) {
      if (typeof uid === "string" && uid) permitidos[uid] = true;
    }

    let entregues = 0;
    for (const id of Object.keys(conexoes)) {
      const c = conexoes[id];
      if (!c || c.codigo !== codigo) continue;
      // Espectador não recebe: `assento == null` é exatamente o que `papelDe`
      // usa para dizer "espectador". A autoridade também não o põe em
      // `destinatarios`, então esta é a segunda tranca da mesma porta.
      if (c.assento == null) continue;
      if (c.estadoAuth !== AUTH.AUTENTICADO) continue;
      if (!permitidos[c.jogadorId]) continue;
      enviarPara(id, { tipo: CHAT_FIO.ENTREGA, dados: projecao });
      entregues++;
    }
    return entregues;
  }

  /// Recibo ao remetente (§16). Três desfechos distinguíveis, nenhum revelando
  /// estado de terceiro.
  function reciboDeChat(id, intentId, resultado, extra) {
    enviarPara(
      id,
      Object.assign({ tipo: CHAT_FIO.RECIBO, intentId, resultado }, extra || {})
    );
  }

  /// O caminho do `chat_enviar`.
  ///
  /// O QUE O CLIENTE MANDA: `intentId` e `texto`. Nada mais é lido — nem
  /// `autorUid`, nem `canalId`, nem `destinatarios`, nem instante. O autor sai de
  /// `c.jogadorId` (gravado do token verificado, propriedade não-gravável) e o
  /// canal sai de `c.codigo`. Um payload que traga esses campos não é "aceito e
  /// ignorado": ele simplesmente não é consultado, e o teste estrutural afirma
  /// que este bloco não os lê.
  async function processarChatEnviar(id, msg) {
    const c = conexoes[id];
    if (!c) return;

    const intentId = typeof msg.intentId === "string" ? msg.intentId : "";

    if (!chatPonte) {
      return reciboDeChat(id, intentId, CHAT_ACK.RECUSADA, {
        codigo: CHAT_RECUSA.TENTE_DE_NOVO,
      });
    }

    // ESPECTADOR NÃO FALA, e quem não está em mesa também não. A recusa é local
    // porque não há canal a consultar — e é a MESMA resposta que a autoridade
    // daria (`papelSemDireitoDeFala`), então não há política nova aqui.
    if (c.codigo == null || c.assento == null) {
      return reciboDeChat(id, intentId, CHAT_ACK.RECUSADA, {
        codigo: CHAT_RECUSA.SEM_ASSENTO,
      });
    }

    const codigo = c.codigo;

    // O canal precisa existir na autoridade antes da primeira fala. Se a
    // sincronização anterior falhou, esta é a chance de recuperar.
    sincronizarCanal(codigo);

    let r;
    try {
      // [COMUNICACAO CONTROLADA] O cliente escolhe O QUE quer dizer — texto ou
      // item do catalogo — e NADA MAIS. Continua sem escolher autor, canal,
      // instante ou ambiente: o autor sai de `c.jogadorId` (gravado do token
      // verificado) e o canal de `c.codigo`.
      //
      // `tipo` ausente vale `texto_privado` na autoridade, que e o
      // comportamento da versao 1 do contrato — um cliente antigo continua
      // falando, e continua sendo recusado onde texto nao pode existir.
      // `especie`, e NAO `tipo`: neste protocolo `msg.tipo` e o ENVELOPE
      // (`chat_enviar`), e le-lo aqui faria o servidor mandar "chat_enviar" a
      // autoridade como especie de comunicacao. O contrato compartilhado nomeia
      // o campo do fio, e a razao esta escrita nele.
      const tipoPedido = typeof msg.especie === "string" ? msg.especie : null;
      const ehCatalogado = tipoPedido !== null && tipoPedido !== "texto_privado";

      r = await chatPonte.enviarMensagem({
        autorUid: c.jogadorId,
        intentId,
        canalId: canalIdDeCodigo(codigo),
        tipo: tipoPedido,
        itemId: ehCatalogado && typeof msg.itemId === "string" ? msg.itemId : null,
        // TEXTO SO NO PEDIDO DE TEXTO. Mandar o texto junto de um item faria a
        // autoridade recusar por `textoNoLugarDoItem` — o que estaria certo, e
        // seria um erro deste arquivo, nao do jogador.
        conteudo: ehCatalogado
          ? null
          : typeof msg.texto === "string"
            ? msg.texto
            : msg.texto,
      });
    } catch (e) {
      // TIMEOUT NÃO É APROVAÇÃO. Falha de rede, timeout e recusa da autoridade
      // caem todos aqui, e todos recusam. Nada é gravado, nada é entregue, e o
      // estado da partida não é tocado.
      const bruto = e && e.detalhe;
      console.warn(
        "[chat] envio recusado sala=" + codigo + " codigo=" + ((e && e.codigo) || "DESCONHECIDO")
      );
      return reciboDeChat(id, intentId, CHAT_ACK.RECUSADA, {
        codigo: redigirRecusaDeChat(bruto, e && e.familia),
      });
    }

    const projecao = r && r.mensagem;
    if (!projecao) {
      return reciboDeChat(id, intentId, CHAT_ACK.RECUSADA, {
        codigo: CHAT_RECUSA.TENTE_DE_NOVO,
      });
    }

    // ENTREGA AT-LEAST-ONCE, com `messageId` estável (§15). Um retry da mesma
    // intenção reentrega a MESMA projeção, com o MESMO `messageId` — que é o que
    // permite a futura UI deduplicar. Não se finge at-most-once transformando
    // retry em segunda mensagem.
    entregarChat(codigo, r.destinatarios, projecao);

    return reciboDeChat(
      id,
      intentId,
      r.jaEnviada ? CHAT_ACK.REPETIDA : CHAT_ACK.ACEITA,
      { messageId: projecao.messageId }
    );
  }

  // [PATCH WS-AUTH] §12 — UID (Firebase) x jogadorId (domínio). Hoje o cofre de
  // contas é chaveado pelo próprio uid: a relação é identidade, mas ela é
  // decidida AQUI, no servidor, e nunca informada pelo cliente. Se um dia houver
  // tabela de perfis, é só injetar outra derivação — o resto do arquivo não muda.
  const jogadorIdDoUid = opts.jogadorIdDoUid || ((uid) => uid);
  // [PATCH WS-AUTH] relógio e agendador injetáveis: a expiração da sessão
  // precisa ser provável em teste sem esperar uma hora de verdade.
  const agora = opts.agora || (() => Date.now());
  const agendarEm = opts.agendarEm || ((ms, fn) => {
    const t = setTimeout(fn, ms);
    if (t.unref) t.unref();
    return () => clearTimeout(t);
  });
  const carenciaMs = opts.carenciaRenovacaoMs != null ? opts.carenciaRenovacaoMs : CARENCIA_RENOVACAO_MS;
  const conexoes = {}; // id -> { id, enviar, codigo, assento, jogadorId, uidAutenticado, estadoAuth, expiraEm }
  let seq = 0;

  function conectar(enviar, opcoes = {}) {
    const id = "c" + ++seq;
    conexoes[id] = {
      id, enviar, codigo: null, assento: null,
      // [PATCH WS-AUTH] nasce sem identidade nenhuma
      jogadorId: null,
      uidAutenticado: null,
      estadoAuth: AUTH.NAO_AUTENTICADO,
      expiraEm: null,        // instante (ms) em que a credencial desta conexão morre
      _cancelarExpiracao: null,
      // Um cliente do protocolo 1 nunca manda `auth`. Este marcador é o que
      // distingue "app velho falando o dialeto antigo" de "app novo que ainda
      // não autenticou" — e é o que permite responder ATUALIZACAO_OBRIGATORIA
      // em vez de um erro genérico que o app velho não sabe explicar.
      tentouAutenticar: false,
      fechar: typeof opcoes.fechar === "function" ? opcoes.fechar : null,
    };
    return id;
  }

  // [PATCH WS-AUTH] Grava a identidade derivada do token na conexão, de forma
  // IMUTÁVEL (§10). Depois disto, `c.jogadorId = qualquer coisa` não tem efeito.
  function vincularIdentidade(c, uid) {
    const jid = String(jogadorIdDoUid(uid));
    Object.defineProperty(c, "uidAutenticado", { value: String(uid), writable: false, configurable: false, enumerable: true });
    Object.defineProperty(c, "jogadorId", { value: jid, writable: false, configurable: false, enumerable: true });
    c.estadoAuth = AUTH.AUTENTICADO;
  }

  /** [PATCH WS-AUTH] (Re)arma a validade da conexão a partir do `exp` do token.
   *  A sessão morre quando o token morre — ficar de pé não renova nada. */
  function armarExpiracao(c, expiraEm) {
    if (c._cancelarExpiracao) { try { c._cancelarExpiracao(); } catch (_) {} }
    c.expiraEm = expiraEm;
    c.estadoAuth = AUTH.AUTENTICADO;
    const falta = Math.max(0, expiraEm - agora());
    c._cancelarExpiracao = agendarEm(falta, () => expirar(c));
  }

  /** [PATCH WS-AUTH] A credencial venceu. A conexão NÃO continua valendo: ela
   *  para de receber estado, para de aceitar comando e ganha uma carência curta
   *  para apresentar um token novo DO MESMO uid. Estourou a carência, cai.
   *
   *  Renovar no lugar de derrubar direto é o caminho menos destrutivo: derrubar
   *  a cada hora entregaria o assento de quem está numa partida longa ao bot
   *  (o servidor não tem retomada de assento). A fronteira não afrouxa — durante
   *  a carência o único tipo aceito é `auth`, igual ao estado inicial. */
  function expirar(c) {
    if (!conexoes[c.id] || c.estadoAuth !== AUTH.AUTENTICADO) return;
    c.estadoAuth = AUTH.EXPIRADA;
    c._cancelarExpiracao = agendarEm(carenciaMs, () => {
      if (conexoes[c.id] && c.estadoAuth === AUTH.EXPIRADA) {
        console.warn("[auth] conexão " + c.id + " encerrada: credencial expirada e não renovada");
        try { c.enviar({ tipo: "authFalhou", motivo: "credencial recusada" }); } catch (_) {}
        if (c.fechar) { try { c.fechar(); } catch (_) {} }
        desconectar(c.id);
      }
    });
    try {
      c.enviar({ tipo: "authExpirou", motivo: "credencial expirada", carenciaMs });
    } catch (_) {}
  }

  /** [PATCH WS-AUTH] Recebe a credencial, verifica e vincula. Devolve uma
   *  Promise para os testes conseguirem esperar; os chamadores de transporte
   *  podem ignorar. NUNCA registra o token em log (§19). */
  function autenticar(id, token, protocolo) {
    const c = conexoes[id];
    if (!c) return Promise.resolve(false);
    c.tentouAutenticar = true;

    // PONTE DE VERSÃO — antes de olhar a credencial. Cliente velho demais leva
    // uma resposta que ele consegue explicar para a pessoa, e nenhum detalhe de
    // autenticação vaza para ele.
    const v = protocolo == null ? 1 : Number(protocolo);
    if (!Number.isFinite(v) || v < PROTOCOLO_MINIMO) {
      console.warn("[auth] conexão " + c.id + " recusada: protocolo " + v + " < " + PROTOCOLO_MINIMO);
      try {
        c.enviar({
          tipo: "atualizacaoObrigatoria",
          codigo: "ATUALIZACAO_OBRIGATORIA",
          motivo: "atualize o aplicativo para continuar jogando online",
          protocoloMinimo: PROTOCOLO_MINIMO,
          protocoloServidor: PROTOCOLO_ATUAL,
        });
      } catch (_) {}
      if (c.fechar) { try { c.fechar(); } catch (_) {} }
      return Promise.resolve(false);
    }

    if (c.estadoAuth === AUTH.AUTENTICANDO) {
      enviarPara(id, { tipo: "authFalhou", motivo: "credencial recusada" });
      return Promise.resolve(false);
    }
    // Reapresentar credencial numa conexão já autenticada (ou expirada) não
    // troca identidade. Mesmo uid → renova a validade. Outro uid → é tentativa
    // de troca: recusa e derruba a conexão.
    if (c.estadoAuth === AUTH.AUTENTICADO || c.estadoAuth === AUTH.EXPIRADA) {
      return Promise.resolve()
        .then(() => verificarToken(token))
        .then((r) => {
          if (!conexoes[id]) return false;
          if (r && r.ok && String(r.uid) === c.uidAutenticado && Number.isFinite(r.expiraEm)) {
            armarExpiracao(c, r.expiraEm);
            enviarPara(id, { tipo: "autenticado", jogadorId: c.jogadorId, protocolo: PROTOCOLO_ATUAL });
            return true;
          }
          recusar(c, r && r.ok ? "TROCA_DE_IDENTIDADE" : "RENOVACAO_RECUSADA");
          return false;
        })
        .catch(() => { recusar(c, "ERRO_INTERNO"); return false; });
    }

    c.estadoAuth = AUTH.AUTENTICANDO;
    return Promise.resolve()
      .then(() => verificarToken(token))
      .then((r) => {
        if (!conexoes[id]) return false;            // caiu durante a verificação
        if (!r || !r.ok || !r.uid) {
          recusar(c, (r && r.codigo) || "CREDENCIAL_INVALIDA");
          return false;
        }
        // Verificador que não diz até quando o token vale não autentica: sem
        // isso a conexão viveria para sempre, que é justamente o que não pode.
        if (!Number.isFinite(r.expiraEm)) {
          recusar(c, "SEM_EXPIRACAO");
          return false;
        }
        vincularIdentidade(c, r.uid);
        armarExpiracao(c, r.expiraEm);
        if (contas) contas.obterOuCriar(c.jogadorId, null);
        enviarPara(id, { tipo: "autenticado", jogadorId: c.jogadorId, protocolo: PROTOCOLO_ATUAL });
        return true;
      })
      .catch(() => { recusar(c, "ERRO_INTERNO"); return false; });
  }

  /** [PATCH WS-AUTH] Fail closed: volta ao estado não autenticado, avisa o
   *  cliente com motivo GENÉRICO (§19 — nada de expirado/assinatura/audience
   *  para o cliente enumerar) e derruba a conexão. O código detalhado fica só
   *  no log do servidor, e o token jamais é registrado. */
  function recusar(c, codigo) {
    if (c._cancelarExpiracao) { try { c._cancelarExpiracao(); } catch (_) {} c._cancelarExpiracao = null; }
    if (c.estadoAuth === AUTH.NAO_AUTENTICADO && !c.fechar) return;
    c.estadoAuth = AUTH.NAO_AUTENTICADO;
    console.warn("[auth] conexão " + c.id + " recusada: " + codigo);
    try { c.enviar({ tipo: "authFalhou", motivo: "credencial recusada" }); } catch (_) {}
    if (c.fechar) { try { c.fechar(); } catch (_) {} }
  }

  /** [PATCH WS-AUTH] §11 — o ataque principal. Token do jogador A com
   *  `jogadorId: B` no comando não pode virar ação do B. Aqui a identidade
   *  declarada é comparada com a vinculada e a divergência RECUSA o comando. */
  function identidadeDivergente(c, msg) {
    for (const campo of CAMPOS_DE_IDENTIDADE) {
      const v = msg[campo];
      if (v == null || v === "") continue;
      if (String(v) !== c.jogadorId && String(v) !== c.uidAutenticado) return campo;
    }
    return null;
  }

  // =========================================================================
  // [PATCH ESPECTADOR] QUEM É QUEM — decisão do SERVIDOR, nunca do cliente.
  //
  // O papel sai de UM lugar só: `conexoes[id].assento`. Esse campo é escrito
  // exclusivamente com o que `ger.criarMesa`/`ger.entrarMesa` DEVOLVEM — isto
  // é, com o assento que o gerenciador de salas concedeu. Nenhum caminho do
  // protocolo copia assento de dentro de `msg`.
  //
  // Consequência prática: não existe campo de payload capaz de promover uma
  // conexão. Mandar `souEspectador:false`, `viewerUid`, `playerUid`, `seat`,
  // `assento`, `papel`, `role`, `modo`, `debug`, `owner` ou o que se inventar
  // amanhã não muda nada, porque `papelDe` não lê `msg`. O cliente PEDE
  // operações; o nível de sigilo quem decide é aqui.
  //
  // [COMPOSIÇÃO ws-auth + espectador] O LIMITE QUE ESTE BLOCO DECLARAVA MORREU.
  // A folha do espectador foi escrita quando o transporte não autenticava, e
  // registrava aqui que `c.jogadorId` era "o que o cliente DISSE que é". Depois
  // da composição isso deixou de ser verdade: `jogadorId` é gravado por
  // `vincularIdentidade`, derivado do `sub` do token verificado, e é IMUTÁVEL
  // (`Object.defineProperty`, writable:false). O P0 de identidade que aquele
  // parágrafo apontava está fechado — e o comentário foi reescrito em vez de
  // preservado porque documentação errada é pior que documentação ausente.
  //
  // O QUE NÃO MUDOU, e é o ponto do bloco: `papelDe` continua NÃO consultando
  // `jogadorId`. As duas autoridades ficam separadas de propósito —
  //     quem você é   -> token verificado (ws-auth)
  //     o que você vê -> assento concedido pelo gerenciador de salas
  // Um token válido não compra assento, e por isso autenticar não promove
  // ninguém de espectador a jogador.
  // =========================================================================

  /** "jogador" (ocupa assento nesta mesa), "espectador" (está na mesa sem
   *  assento) ou "nenhum" (não está em mesa alguma). */
  function papelDe(c) {
    if (!c || c.codigo == null) return "nenhum";
    return Number.isInteger(c.assento) ? "jogador" : "espectador";
  }

  /** Participante = pode AGIR na partida. Espectador nunca é. */
  function ehParticipante(c) {
    return papelDe(c) === "jogador";
  }
  /** [GATE VIP] Erro de uma porta de mesa, no fio.
   *
   *  Recusa de admissao carrega um CODIGO estavel (o cliente pode ramificar
   *  nele); os demais erros da mesa continuam saindo exatamente como saiam,
   *  sem campo novo - por isso o codigo so entra quando existe.
   *
   *  O que NAO sai: categoria da mesa, classificacao da tentativa, o
   *  `tentativaEntradaId` e o motivo real da recusa. Quem foi recusado aprende
   *  que nao entrou, e mais nada. */
  function erroDeAdmissao(r) {
    return r.codigoRecusa
      ? { tipo: "erro", motivo: r.erro, codigo: r.codigoRecusa }
      : { tipo: "erro", motivo: r.erro };
  }
  /** [BACKEND] Conclui uma porta de mesa que pode responder AGORA ou DEPOIS.
   *
   *  Mesa casual devolve valor e percorre o ramo sincrono - as mesmas linhas
   *  de sempre, sem microtask nenhum, para que `envia(...)` seguido de ler a
   *  resposta continue funcionando como funcionava. Mesa VIP devolve promessa
   *  e so aplica a entrada quando o backend responder.
   *
   *  A JANELA QUE ISTO FECHA. Entre o pedido e a resposta o jogador pode cair.
   *  Aplicar a entrada depois disso deixaria um assento ocupado por uma conexao
   *  que nao existe mais - uma mesa que nunca mais enche, e que ninguem
   *  consegue nem assistir direito. Por isso, ao aplicar, confere-se que a
   *  conexao ainda e a MESMA: se nao for, a admissao aprovada e DESFEITA.
   *  `conexoes[id] !== c` e a comparacao certa, e nao `!conexoes[id]`: um id
   *  pode ter sido reaproveitado por outra conexao, e nesse caso a entrada
   *  tambem nao e daquela pessoa. */
  function concluirPortaDeMesa(id, c, r, codigoPedido) {
    if (!ehPromessaDeMesa(r)) return aplicarEntrada(id, c, r, codigoPedido);
    return r.then(
      (v) => aplicarEntrada(id, c, v, codigoPedido),
      (e) => {
        // Promessa rejeitada e recusa, nunca entrada. O motivo vai redigido:
        // so o codigo, nunca a mensagem - ver `registrarFalhaDeAdmissao`.
        console.error("[admissao] porta de mesa falhou · motivo=" + (e && e.codigo ? e.codigo : "ERRO"));
        return enviarPara(id, { tipo: "erro", motivo: "entrada indisponivel nesta mesa", codigo: "ADMISSAO_VIP_INDISPONIVEL" });
      }
    );
  }

  function ehPromessaDeMesa(x) {
    return !!x && (typeof x === "object" || typeof x === "function") && typeof x.then === "function";
  }

  function aplicarEntrada(id, c, r, codigoPedido) {
    if (r.erro) return enviarPara(id, erroDeAdmissao(r));
    const codigo = r.codigo || codigoPedido;
    if (conexoes[id] !== c) {
      ger.desfazerAdmissao({ codigo, assento: r.assento });
      return;
    }
    c.codigo = codigo;
    c.assento = r.assento;
    // [CONTROLADOR §15.10 · COMPOSICAO] Entrada, reconexao ou entrada VIP ja
    // aprovada pelo backend: em qualquer dos tres, a conexao que acabou de
    // assumir o assento e a UNICA que pode agir por ele. Mora aqui, e nao no
    // despachante, porque este e o unico ponto por onde os regimes sincrono e
    // assincrono da admissao passam — no assincrono o assento so existe agora.
    desalojarOutrasConexoes(c);
    // `reconexao` distingue quem VOLTA de quem chega: o cliente precisa saber
    // que nao houve assento novo. Ausente na criacao de mesa, que nunca e volta.
    enviarPara(id, { tipo: "entrou", codigo, assento: r.assento, reconexao: !!r.reconexao });
    return broadcastSala(codigo);
  }

  /** Estado que ESTA conexão pode receber. Passa pela porta única de `salas`. */
  function visaoDaConexao(c) {
    return ger.visaoPara({ codigo: c.codigo, papel: papelDe(c), assento: c.assento });
  }

  /** [VERSAO] O evento `estado` COMPLETO para uma conexão: a visão que ela pode
   *  receber, mais o par (versaoEstado, eventoId) da emissão.
   *
   *  Existe como função única porque o servidor emite `estado` em dois lugares
   *  — o broadcast e o snapshot de quem começa a assistir — e os dois têm de
   *  carimbar igual. Montar o objeto à mão nos dois deixaria um deles para trás
   *  no primeiro ajuste do contrato.
   *
   *  ORDEM: `visaoDaConexao` primeiro, porque é ela que passa pela porta de
   *  projeção e é lá que o carimbo é atribuído; `metadadosDe` depois, lendo o
   *  carimbo que acabou de valer. Invertido, o primeiro envio de cada mutação
   *  sairia com o par anterior.
   *
   *  Os campos são IRMÃOS de `visao`, não filhos: `visao` é o recorte que o
   *  papel autoriza, e a versão é da mesa, igual para todos os papéis. Enfiá-la
   *  dentro da visão a faria passar pela lista de permissão do espectador e
   *  sumir para quem assiste — que é justamente quem mais precisa dela.
   *
   *  Mesa sem estado autoritativo (`metadadosDe` null) emite versão 0 e
   *  `eventoId` null. Zero nunca é emitido por mesa viva — o carimbo acima já
   *  garante o mínimo 1 —, então o cliente pode tratar 0/null como "não há
   *  estado", sem confundir com "primeira versão". */
  function eventoEstado(c) {
    const visao = visaoDaConexao(c);
    const meta = ger.metadadosDe(c.codigo) || { versaoEstado: 0, eventoId: null };
    return { tipo: "estado", visao, versaoEstado: meta.versaoEstado, eventoId: meta.eventoId };
  }

  /** [CONTROLADOR §6/§15.10] UMA autoridade por assento.
   *
   *  Quem acabou de assumir o assento é o dono da vez; qualquer outra conexão
   *  que ainda o segure é rebaixada a espectador NA HORA. Rebaixar em vez de
   *  desconectar é deliberado: o socket velho pode ser um aparelho que ainda
   *  está com a tela aberta, e ele continua podendo ASSISTIR — só não age.
   *
   *  A varredura é por (codigo, assento), não por identidade: o que não pode
   *  existir são duas conexões emitindo intenção pelo MESMO assento, venham
   *  elas do mesmo UID ou não. */
  function desalojarOutrasConexoes(dono) {
    if (!dono || dono.codigo == null || !Number.isInteger(dono.assento)) return 0;
    let desalojadas = 0;
    for (const cid in conexoes) {
      const o = conexoes[cid];
      if (!o || o === dono) continue;
      if (o.codigo !== dono.codigo) continue;
      if (o.assento !== dono.assento) continue;
      o.assento = null; // continua na sala, mas como quem assiste
      desalojadas++;
      enviarPara(cid, {
        tipo: "erro",
        codigo: "ASSENTO_ASSUMIDO",
        motivo: "este assento foi assumido por outra conexão",
      });
    }
    return desalojadas;
  }

  function desconectar(id) {
    const c = conexoes[id];
    if (!c) return;
    // [PATCH WS-AUTH] não deixa timer de expiração pendurado numa conexão morta
    if (c._cancelarExpiracao) { try { c._cancelarExpiracao(); } catch (_) {} c._cancelarExpiracao = null; }
    if (c.codigo != null && c.assento != null) {
      const cod = c.codigo;
      const assento = c.assento;
      // [CONTROLADOR §5] Socket fechado NÃO é desistência. O assento fica
      // RESERVADO e o proprietário tem a graça para voltar. Só a expiração —
      // avaliada por `verificarAusencias`, com o relógio do servidor — entrega
      // o assento ao bot.
      ger.ausentar({ codigo: cod, assento, motivo: MOTIVO_CONTROLE.QUEDA });
      c.codigo = null; c.assento = null;
      broadcastSala(cod);
      // A mesa pode ficar em silêncio durante a graça inteira (ninguém fala
      // porque é a vez do ausente). Este despertar existe só para que o
      // silêncio não seja eterno — e ele chama a MESMA função preguiçosa, não
      // uma segunda regra de expiração.
      agendarEm(ger.gracaAusenciaMs + 1, () => {
        if (!ger.salas[cod]) return;
        if (ger.verificarAusencias(cod) > 0) avancarComRespiro(cod);
      });
    }
    delete conexoes[id];
  }

  function enviarPara(id, msg) {
    const c = conexoes[id];
    if (c && typeof c.enviar === "function") c.enviar(msg);
  }

  function processar(id, msg) {
    const c = conexoes[id];
    if (!c) return;
    if (!msg || !msg.tipo) return enviarPara(id, { tipo: "erro", motivo: "mensagem sem tipo" });

    // [PATCH WS-AUTH] FRONTEIRA DE AUTENTICAÇÃO. Antes de AUTENTICADO só passa
    // a própria autenticação. Nada de mesa, jogada, perfil, avatar, carteira ou
    // qualquer coisa pertencente a um jogador — e sem efeito colateral nenhum.
    if (msg.tipo === "auth") return autenticar(id, msg.token, msg.protocolo);
    // Guarda preguiçosa da expiração: o relógio pode ter passado do `exp` sem o
    // agendador ter rodado ainda (processo suspenso, teste com relógio falso).
    // Comando não espera timer — a validade é conferida no ato.
    if (c.estadoAuth === AUTH.AUTENTICADO && c.expiraEm != null && agora() >= c.expiraEm) {
      expirar(c);
    }
    if (c.estadoAuth === AUTH.EXPIRADA) {
      return enviarPara(id, { tipo: "erro", motivo: "credencial expirada", codigo: "CREDENCIAL_EXPIRADA" });
    }
    if (c.estadoAuth !== AUTH.AUTENTICADO) {
      // Cliente que NUNCA tentou autenticar está falando o protocolo antigo:
      // é app desatualizado, não app novo fora de ordem. A resposta diz isso.
      if (!c.tentouAutenticar) {
        return enviarPara(id, {
          tipo: "erro",
          codigo: "ATUALIZACAO_OBRIGATORIA",
          motivo: "atualize o aplicativo para continuar jogando online",
          protocoloMinimo: PROTOCOLO_MINIMO,
        });
      }
      return enviarPara(id, { tipo: "erro", motivo: "conexão não autenticada", codigo: "NAO_AUTENTICADO" });
    }
    // [CONTROLADOR §5.6] Toda mensagem é uma oportunidade de perceber que uma
    // graça venceu. Fica DEPOIS da fronteira de autenticação e ANTES do
    // despacho: mensagem de conexão não autenticada não move o controlador.
    if (c.codigo != null) ger.verificarAusencias(c.codigo);
    // [PATCH WS-AUTH] identidade declarada no comando ≠ identidade da conexão
    const divergente = identidadeDivergente(c, msg);
    if (divergente) {
      console.warn("[auth] conexão " + c.id + ": campo '" + divergente + "' divergente da identidade vinculada");
      return enviarPara(id, { tipo: "erro", motivo: "identidade divergente", codigo: "IDENTIDADE_DIVERGENTE" });
    }

    switch (msg.tipo) {
      // [CHAT] O ÚNICO ingresso de mensagem do jogador. Assíncrono porque a
      // decisão é da autoridade remota; `processar` não espera, e o recibo chega
      // pelo próprio socket quando a resposta voltar. Nenhum outro `case` é
      // afetado por uma falha aqui.
      case CHAT_FIO.PEDIDO: {
        processarChatEnviar(id, msg);
        return;
      }

      case "criarMesa": {
        // [PATCH WS-AUTH] c.jogadorId vem do token verificado, não da mensagem.
        // [GATE VIP] E o mesmo vale para `uidAutenticado`, que e o SUJEITO da
        // admissao: sai de `vincularIdentidade`, e nenhum campo de `msg` o
        // alcanca. Note que `msg` nao contribui com nada para a admissao -
        // nem categoria, nem tentativa, nem assento.
        if (contas) contas.obterOuCriar(c.jogadorId, msg.apelido);
        // [ECONOMIA] `msg.aposta` NAO e mais lido. O valor de entrada e
        // configuracao do processo (`apostaDeEntrada`), pela mesma disciplina
        // de `tipoPartida` e `categoriaCompetitiva`: o que o cliente escolhe
        // nao pode decidir quanto o cofre movimenta.
        const r = ger.criarMesa({ apelido: msg.apelido, jogadorId: c.jogadorId, uidAutenticado: c.uidAutenticado, modalidade: msg.modalidade, metaPontos: msg.metaPontos });
        return concluirPortaDeMesa(id, c, r, null);
      }
      case "entrarMesa": {
        // [PATCH WS-AUTH] idem: identidade da conexão, nunca da mensagem. É por
        // aqui que a reconexão volta pra mesa — e ela só chega aqui autenticada.
        if (contas) contas.obterOuCriar(c.jogadorId, msg.apelido);
        // [COMPOSICAO admissao-vip + controlador] A porta continua sendo
        // `concluirPortaDeMesa`, porque a admissao VIP pode ser ASSINCRONA e o
        // assento so existe depois que o backend responde. Desalojar aqui, antes
        // da promessa, rebaixaria a conexao velha por uma entrada que ainda pode
        // ser recusada. O §15.10 do controlador foi para dentro de
        // `aplicarEntrada`, que e o unico ponto por onde os DOIS regimes passam.
        const r = ger.entrarMesa({ codigo: msg.codigo, apelido: msg.apelido, jogadorId: c.jogadorId, uidAutenticado: c.uidAutenticado });
        return concluirPortaDeMesa(id, c, r, msg.codigo);
      }
      case "assistirMesa": {
        // [PATCH ESPECTADOR] Entrada de quem só ASSISTE. Não pede assento e
        // não recebe nenhum: `c.assento` continua null, e é isso — e só isso —
        // que faz `papelDe` responder "espectador" daqui pra frente.
        //
        // Também é o caminho de RECONEXÃO de quem não tem assento na mesa: o
        // papel é recalculado do zero a cada entrada, então token velho,
        // versão de estado antiga ou `assento` guardado no cliente não
        // devolvem privilégio nenhum.
        const salaE = ger.salas[msg.codigo];
        if (!salaE) return enviarPara(id, { tipo: "erro", motivo: "mesa não encontrada" });
        // [PRODUTOR] A atribuição `c.jogadorId = msg.jogadorId || ...` que morava
        // aqui foi REMOVIDA. Ela vinha da folha do espectador, escrita quando o
        // transporte não autenticava, e hoje é duplamente morta: `jogadorId`
        // divergente já é recusado por `identidadeDivergente` antes de chegar
        // neste ponto, e a propriedade é `writable:false` desde
        // `vincularIdentidade` — a atribuição era um no-op silencioso.
        //
        // Deixá-la seria pior do que inútil: sugere que uma mensagem pode
        // definir identidade, que é exatamente o que o mapa de participantes
        // existe para tornar impossível.
        c.codigo = msg.codigo;
        c.assento = null; // explícito: assistir NUNCA concede assento
        enviarPara(id, { tipo: "assistindo", codigo: c.codigo });
        // [VERSAO] Entrar para assistir NÃO é mutação da mesa: nada em `sala`
        // muda aqui (o que muda é a conexão). O carimbo vigente é reaproveitado
        // tal e qual, então quem chega recebe a MESMA versão que os assentos já
        // têm — e não uma versão nova que faria todo mundo achar que houve
        // jogada. É também por este caminho que a reconexão de quem não tem
        // assento volta a ver a mesa, e é por isso que ela não cria versão.
        return enviarPara(id, eventoEstado(c));
      }
      case "perfil": {
        // dados REAIS da conta do jogador (pro Perfil/carteira do app)
        // [PATCH WS-AUTH] só a PRÓPRIA conta: o jid é o da conexão autenticada.
        const jid = c.jogadorId;
        if (!contas || !jid) return enviarPara(id, { tipo: "perfil", conta: null });
        const conta = contas.obterOuCriar(jid, msg.apelido);
        return enviarPara(id, { tipo: "perfil", conta: Object.assign({ posicao: contas.posicaoNoRanking(jid) }, conta) });
      }
      case "ranking": {
        if (!contas) return enviarPara(id, { tipo: "ranking", lista: [] });
        return enviarPara(id, { tipo: "ranking", lista: contas.ranking({ limite: msg.limite || 50, criterio: msg.criterio }) });
      }
      case "definirAvatar": {
        // foto própria (upload), avatar da galeria, ou remover (voltar ao padrão)
        // [PATCH WS-AUTH] o avatar alterado é sempre o da conexão autenticada.
        const jid = c.jogadorId;
        if (!contas || !jid) return enviarPara(id, { tipo: "avatar", conta: null });
        contas.obterOuCriar(jid, msg.apelido);
        let r;
        if (msg.foto) r = contas.definirAvatarFoto(jid, msg.foto);
        else if (msg.galeria != null) r = contas.definirAvatarGaleria(jid, msg.galeria);
        else if (msg.remover) r = contas.removerAvatar(jid);
        else r = { erro: "avatar: informe foto, galeria ou remover" };
        if (r && r.erro) return enviarPara(id, { tipo: "erro", motivo: r.erro });
        return enviarPara(id, { tipo: "avatar", conta: r });
      }
      case "denunciarAvatar": {
        if (!contas || !msg.alvo) return;
        return enviarPara(id, Object.assign({ tipo: "denuncia" }, contas.denunciarAvatar(msg.alvo)));
      }
      case "iniciarPartida": {
        if (c.codigo == null) return enviarPara(id, { tipo: "erro", motivo: "você não está numa mesa" });
        if (!ehParticipante(c)) return recusarEspectador(id);
        const r = ger.iniciarPartida({ codigo: c.codigo, assento: c.assento });
        if (r.erro) return enviarPara(id, { tipo: "erro", motivo: r.erro });
        return avancarComRespiro(c.codigo);
      }
      case "jogada": {
        if (c.codigo == null) return enviarPara(id, { tipo: "erro", motivo: "você não está numa mesa" });
        // [PATCH ESPECTADOR] Corta ANTES do motor. Não é só questão de
        // permissão: o motor recusa citando a carta ("o topo é o X", "essa
        // carta não tem mola"), e esse texto é informação privada. Quem
        // assiste leva uma recusa genérica, sem detalhe nenhum do estado.
        if (!ehParticipante(c)) return recusarEspectador(id);
        const r = ger.aplicarJogada({ codigo: c.codigo, assento: c.assento, jogada: msg.jogada });
        if (r && (r.erro || r.ok === false)) {
          // rebroadcast ANTES do erro: uma jogada recusada PODE ter mudado o estado
          // (ex.: o foul de abertura vulnerável devolve as cartas pra mão). O estado
          // vem primeiro (o sync reescreve a dica) e o erro vem por último, então a
          // mensagem do foul fica na dica em vez de ser sobrescrita pelo sync.
          broadcastSala(c.codigo);
          return enviarPara(id, { tipo: "erro", motivo: r.erro });
        }
        return avancarComRespiro(c.codigo);
      }
      case "afkBot": {
        // [CONTROLADOR §8] AFK deixou de ser ORDEM do cliente e virou AVISO.
        // O cliente diz "estou ausente"; quem decide o que isso significa —
        // qual assento, qual identidade, qual instante — é o servidor, e ele
        // decide a partir da conexão autenticada, nunca do payload.
        //
        // AFK é DECLARAÇÃO, não queda: o jogador está no aparelho e avisou.
        // Por isso não ganha a graça de 15 s, que existe para a incerteza de
        // rede (§5). O assento passa ao bot na hora, e o dono pode voltar.
        if (c.codigo == null) return;
        if (!ehParticipante(c)) return recusarEspectador(id);
        ger.ausentar({ codigo: c.codigo, assento: c.assento, motivo: MOTIVO_CONTROLE.AFK });
        return avancarComRespiro(c.codigo);
      }
      case "afkVoltar": {
        // [CONTROLADOR §6/§8] Também aviso, não ordem. O servidor confere a
        // POSSE (UID autenticado × proprietário do assento) e só devolve o
        // controle em fronteira segura — se o bot está no meio de um turno, o
        // retorno fica pendente e vale no próximo.
        if (c.codigo == null) return;
        if (!ehParticipante(c)) return recusarEspectador(id);
        const rv = ger.retornar({ codigo: c.codigo, assento: c.assento, jogadorId: c.jogadorId });
        if (rv && rv.erro) return enviarPara(id, { tipo: "erro", motivo: rv.erro });
        return broadcastSala(c.codigo);
      }
      case "sair": {
        if (c.codigo != null) {
          const cod = c.codigo;
          // [PATCH ESPECTADOR] Espectador não ocupa assento: não há assento a
          // liberar, e chamar `ger.sair` com assento null mexeria na lista de
          // assentos da mesa por engano. Ele só se desliga.
          if (ehParticipante(c)) ger.sair({ codigo: cod, assento: c.assento });
          c.codigo = null; c.assento = null;
          broadcastSala(cod);
        }
        return;
      }
      default:
        return enviarPara(id, { tipo: "erro", motivo: "tipo desconhecido: " + msg.tipo });
    }
  }

  /** Cadência com respiro: transmite o estado atual e, se ainda houver jogada de
   *  bot (ou transição de rodada), agenda o próximo passo. Com `agendar` imediato
   *  vira um laço síncrono (testes); com setTimeout, os bots jogam um a um na tela. */
  function avancarComRespiro(codigo) {
    // [CONTROLADOR §5.6] Antes de qualquer coisa: a graça de quem caiu pode ter
    // vencido enquanto a mesa fazia outra coisa. Preguiçoso de propósito — o
    // instante do takeover é o relógio, não a chegada de um timer.
    ger.verificarAusencias(codigo);
    broadcastSala(codigo);
    emitirFimSeAcabou(codigo);
    if (ger.vezEhBot(codigo)) {
      agendar(function () {
        ger.jogarUmBot(codigo);
        avancarComRespiro(codigo);
      });
    }
  }

  /** [PATCH ESPECTADOR] Recusa para quem assiste: SEM detalhe de estado.
   *  Um texto do motor ("o topo é o 7 de copas", "essa carta não tem mola")
   *  revelaria carta que o espectador não pode ver. Motivo genérico, sempre o
   *  mesmo, independente do que foi pedido — o detalhe fica no log do servidor. */
  function recusarEspectador(id) {
    return enviarPara(id, { tipo: "erro", motivo: "você está assistindo a esta mesa" });
  }

  /** Quando a partida encerra, o cofre já liquidou (sala.resumoFinal). Aqui a
   *  gente manda UMA vez pra todo mundo da mesa o "fim" com os ganhos — é o que
   *  a tela usa pra mostrar "+X moedas / subiu de nível". */
  function emitirFimSeAcabou(codigo) {
    const sala = ger.salas[codigo];
    if (!sala || !sala.resumoFinal || sala.fimEmitido) return;
    sala.fimEmitido = true;
    const placar = sala.jogo && sala.jogo.placar;
    for (const cid in conexoes) {
      const c = conexoes[cid];
      if (c.codigo !== codigo) continue;
      // [COMPOSIÇÃO] As DUAS guardas valem, e nesta ordem. Primeiro a
      // credencial: o encerramento é estado, e credencial vencida não recebe
      // estado nenhum — nem o placar, que para o espectador seria o evento
      // inteiro. Só depois o papel decide QUANTO se envia.
      //
      // Trocar a ordem abriria o buraco exato que a composição precisa fechar:
      // um espectador com credencial vencida ainda receberia `fim`.
      if (c.estadoAuth !== AUTH.AUTENTICADO) continue;
      // [PATCH WS-AUTH] o resumo carrega carteira (moedas, XP); [PATCH
      // ESPECTADOR] e carteira não é estado de mesa. Participante autenticado
      // leva o resumo; quem só assiste leva o placar, que já estava à vista.
      if (ehParticipante(c)) {
        c.enviar({ tipo: "fim", resumo: sala.resumoFinal, placar });
      } else {
        // [PATCH ESPECTADOR] `resumoFinal` é carteira: moedas, XP e nível POR
        // JOGADOR. Não é estado de mesa e não é público. Quem assiste recebe
        // só o desfecho que já estava à vista — o placar.
        c.enviar({ tipo: "fim", placar });
      }
    }
  }

  /** Manda pra cada conexão da sala a visão QUE ELA PODE RECEBER. É o "tempo
   *  real": toda mudança (jogada humana, jogadas dos bots, entrada de gente)
   *  reflete em todos. Quem tem assento vê a própria mão — a dos outros é só
   *  contagem; quem assiste não vê mão nenhuma.
   *
   *  [PATCH ESPECTADOR] O papel é recalculado A CADA envio, e é o mesmo
   *  `papelDe` do snapshot inicial. Por isso não existe evento incremental que
   *  escape: compra, descarte, batida, morto, nova rodada, encerramento e
   *  ressincronização passam TODOS por aqui. */
  function broadcastSala(codigo) {
    // [CHAT] O canal acompanha o ESTADO ESTÁVEL da mesa, e este é o ponto por onde
    // todo estado estável passa: criar mesa, entrar, sair, jogada que encerra a
    // partida, bot que bate, revanche. Sincronizar aqui — em vez de em cada um
    // desses caminhos — é o que impede um caminho novo de esquecer o canal.
    //
    // `impressaoDoCanal` faz a chamada sair só quando composição ou aceitação
    // MUDAM: uma jogada comum não fala com a autoridade, e a reconexão (que não
    // muda nenhuma das duas) também não.
    sincronizarCanal(codigo);

    for (const cid in conexoes) {
      const c = conexoes[cid];
      if (c.codigo !== codigo) continue;
      // [COMPOSIÇÃO] Mesma ordem do encerramento, pelo mesmo motivo, e aqui a
      // consequência é mais forte: sem esta linha, uma conexão NUNCA
      // autenticada (`estadoAuth` inicial) receberia a visão pública de
      // espectador só por estar numa sala. O contrato da composição é que
      // espectador não autenticado não recebe NEM a projeção pública.
      //
      // [PATCH WS-AUTH] credencial vencida para de receber na hora, sem
      // esperar comando dela.
      if (c.estadoAuth !== AUTH.AUTENTICADO) continue;
      // [PATCH ESPECTADOR] `visaoDaConexao` — e não `ger.visao(codigo, assento)`
      // — porque é ela que passa pela porta única de projeção: jogador recebe a
      // própria visão privada, espectador recebe a pública. Chamar `ger.visao`
      // direto aqui devolveria visão de assento para quem não tem assento.
      //
      // [VERSAO] O laço é síncrono e nada muta a sala dentro dele, então as
      // quatro visões de assento e as de espectador saem todas com o MESMO par
      // (versaoEstado, eventoId): a primeira conexão do laço carimba, as
      // demais encontram a impressão inalterada e reaproveitam. Uma mutação
      // gera uma versão — não uma por destinatário.
      c.enviar(eventoEstado(c));
    }
  }

  // [COMPOSIÇÃO] A união dos dois contratos de saída, sem perder nenhum:
  // `autenticar` (folha A) porque o transporte pode receber a credencial ANTES
  // da primeira mensagem do protocolo (Authorization no upgrade HTTP — ver
  // ws_server); `papelDe` (folha B) porque a suíte do espectador afirma o papel
  // decidido pelo servidor. Perder qualquer um dos dois quebraria uma suíte
  // inteira — e silenciosamente, já que ambos são lidos por testes, não pelo
  // caminho de produção.
  return { conectar, desconectar, processar, autenticar, broadcastSala, papelDe, ger, conexoes };
}

module.exports = { criarServidor, AUTH, PROTOCOLO_ATUAL, PROTOCOLO_MINIMO };
// [CHAT] Expostos para a suíte de transporte afirmar o contrato na PRIMITIVA,
// sem montar servidor, conexão e ponte para cada caso — a mesma razão pela qual
// `salas` expõe `carimbarEstado` e `montarEnvelopeEncerramento`. É também o que
// permite ao teste de contrato comparar estas constantes com
// `contrato/chat-transporte-v1.json` em vez de reescrevê-las.
module.exports.canalIdDeCodigo = canalIdDeCodigo;
module.exports.composicaoDoCanal = composicaoDoCanal;
module.exports.canalAberto = canalAberto;
module.exports.impressaoDoCanal = impressaoDoCanal;
module.exports.redigirRecusaDeChat = redigirRecusaDeChat;
module.exports.CHAT_SUPERFICIE_MESA = CHAT_SUPERFICIE_MESA;
module.exports.CHAT_PAPEL = CHAT_PAPEL;
module.exports.CHAT_FIO = CHAT_FIO;
module.exports.CHAT_ACK = CHAT_ACK;
module.exports.CHAT_RECUSA = CHAT_RECUSA;


  };

  __fabricas["ws_server"] = function (module, exports, require) {
// servidor/ws_server.js — SERVIDOR WebSocket SEM DEPENDÊNCIAS (RFC 6455)
// Liga o servidor de salas (agnóstico de transporte, servidor/servidor.js) a
// WebSockets reais usando SÓ o que já vem no Node (http + crypto + net). Assim:
//   1) roda e é testável AQUI no sandbox (o pacote `ws` não instala — registro
//      bloqueado), com o cliente WebSocket embutido do Node;
//   2) sobe em QUALQUER host (Render/Fly/Railway) sem `npm install`;
//   3) o mesmo processo serve o HTTP (health-check + arquivos estáticos opcionais).
//
// Uso no deploy:  PORT=8080 node servidor/ws_server.js
// (opcional) PUBLIC_DIR=./public pra servir o cliente do mesmo endereço.

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { criarServidor } = require("./servidor");
// [BACKEND + CHAT · COMPOSICAO] A credencial canonica e os DOIS consumidores
// que ela alimenta. Este e o UNICO ponto do bundle que carrega
// `credencial_motor` — nao existe segundo cliente de credencial. O cabecalho do
// modulo dizia que ele nascia desligado, "infraestrutura pronta para a OS do
// transporte": e aqui que ele foi ligado, e passou a servir dois consumidores
// sem virar duas credenciais.
const { criarCredencialDoMotor } = require("./credencial_motor");
const { criarAdaptadorAdmissaoVip, VARIAVEL_URL: VARIAVEL_URL_ADMISSAO } = require("./admissao_vip");
const { criarPonteDeChat } = require("./chat_ponte");
const { criarContas } = require("./contas");
const { criarOutbox } = require("./outbox"); // [PRODUTOR]
const { criarVerificadorFirebase } = require("./auth_firebase"); // [PATCH WS-AUTH]


const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const OP = { CONT: 0x0, TEXT: 0x1, BIN: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa };
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
};

// ---- construção de um frame de saída (servidor→cliente NÃO mascara) ----
function encodeFrame(opcode, payloadBuf) {
  const len = payloadBuf.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(Math.floor(len / 4294967296), 2);
    header.writeUInt32BE(len >>> 0, 6);
  }
  header[0] = 0x80 | opcode; // FIN + opcode
  return Buffer.concat([header, payloadBuf]);
}

// ---- conexão: envolve o socket cru, faz o parsing de frames com buffer ----
function criarConexao(socket, handlers) {
  let buf = Buffer.alloc(0);
  let frags = [];        // pedaços de uma mensagem fragmentada
  let fragOp = null;
  let vivo = true;

  // KEEPALIVE: manda um PING a cada 20s. Sem isso, o proxy da hospedagem
  // (Railway/Render/etc.) corta a conexão parada depois de ~1min de silêncio —
  // que é o que derrubava a mesa quando alguém demorava a jogar ("a conexão
  // caiu"). O ping mantém a conexão viva mesmo sem jogada acontecendo. O
  // navegador responde PONG sozinho (nível de protocolo).
  const keepalive = setInterval(() => {
    if (!vivo) { clearInterval(keepalive); return; }
    try { socket.write(encodeFrame(OP.PING, Buffer.alloc(0))); } catch (_) {}
  }, 20000);
  if (keepalive.unref) keepalive.unref(); // não segura o processo vivo à toa

  function enviarTexto(str) {
    if (!vivo) return;
    try { socket.write(encodeFrame(OP.TEXT, Buffer.from(str, "utf8"))); } catch (_) {}
  }
  function fechar(code) {
    if (!vivo) return;
    vivo = false;
    clearInterval(keepalive);
    try {
      const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000, 0);
      socket.write(encodeFrame(OP.CLOSE, b));
    } catch (_) {}
    try { socket.end(); } catch (_) {}
  }

  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    // processa quantos frames completos houver no buffer
    while (true) {
      if (buf.length < 2) return;
      const b0 = buf[0], b1 = buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < off + 2) return;
        len = buf.readUInt16BE(off); off += 2;
      } else if (len === 127) {
        if (buf.length < off + 8) return;
        const hi = buf.readUInt32BE(off), lo = buf.readUInt32BE(off + 4);
        len = hi * 4294967296 + lo; off += 8;
      }
      // cliente DEVE mascarar (RFC 6455). Se não veio máscara, encerra.
      if (!masked) { fechar(1002); return; }
      if (buf.length < off + 4 + len) return; // frame ainda incompleto
      const mask = buf.slice(off, off + 4); off += 4;
      const payload = Buffer.alloc(len);
      for (let i = 0; i < len; i++) payload[i] = buf[off + i] ^ mask[i & 3];
      off += len;
      buf = buf.slice(off); // consome este frame

      if (opcode === OP.CLOSE) { handlers.close(); fechar(1000); return; }
      if (opcode === OP.PING) { try { socket.write(encodeFrame(OP.PONG, payload)); } catch (_) {} continue; }
      if (opcode === OP.PONG) continue;

      // TEXT / BIN / CONT — monta a mensagem (suporta fragmentação)
      if (opcode === OP.TEXT || opcode === OP.BIN) { frags = [payload]; fragOp = opcode; }
      else if (opcode === OP.CONT) { frags.push(payload); }
      if (fin) {
        const full = Buffer.concat(frags);
        frags = []; fragOp = null;
        if (full.length) handlers.message(full.toString("utf8"));
      }
    }
  });
  socket.on("close", () => { vivo = false; clearInterval(keepalive); handlers.close(); });
  socket.on("error", () => { vivo = false; clearInterval(keepalive); handlers.close(); });

  return { enviarTexto, fechar, get vivo() { return vivo; } };
}

/** [PATCH WS-AUTH] Extrai o token de um `Authorization: Bearer <token>`.
 *  Devolve null (e nunca lança) para qualquer coisa que não seja exatamente
 *  isso. O valor NÃO é registrado em log em lugar nenhum (§19). */
function bearerDoCabecalho(valor) {
  if (typeof valor !== "string") return null;
  const m = valor.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

// [SHA] PROVA DO COMMIT IMPLANTADO — somente leitura, e derivada do BUILD.
//
// A pergunta que isto responde e "qual commit esta rodando agora?", e ela nao
// tinha resposta: `/health` devolvia "ok" seco. Sem isso, toda pre-checagem de
// janela operacional depende de alguem AFIRMAR o que implantou.
//
// DECISAO 1 — SO VARIAVEL INJETADA PELA PLATAFORMA. A lista e fechada e so tem
// nomes que o Railway (e o Cloud Run) preenchem sozinhos a partir do commit
// implantado. NAO existe fallback que o operador digite: uma variavel escrita a
// mao provaria o que alguem escreveu, e nao o que foi implantado — que e
// exatamente o engano que este endpoint existe para impedir.
//
// DECISAO 2 — FORMA VALIDADA, NUNCA ECO. So passa o que tem forma de SHA de git
// (7 a 40 hexadecimais). Qualquer outra coisa vira `null`, e nao texto
// devolvido: a rota e publica, e ecoar ambiente e como se vaza segredo sem
// querer.
//
// DECISAO 3 — O CLIENTE NAO ESCOLHE NADA. `corpoDaVersao` le o ambiente e mais
// nada; nenhum campo vem do pedido. Nao ha cabecalho, query ou corpo que mude a
// resposta.
const FONTES_DE_SHA = ["RAILWAY_GIT_COMMIT_SHA", "SOURCE_VERSION", "GIT_COMMIT_SHA"];

/** O SHA implantado, ou `null`. Pura: recebe o ambiente, nao le `process`. */
function shaImplantado(env) {
  const fonte = env || {};
  for (const nome of FONTES_DE_SHA) {
    const v = fonte[nome];
    if (typeof v === "string" && /^[0-9a-f]{7,40}$/.test(v)) return { sha: v, origem: nome };
  }
  return { sha: null, origem: null };
}

/** O corpo de `/versao`. Nada aqui vem do pedido. */
function corpoDaVersao(env) {
  return shaImplantado(env);
}
function iniciar(porta, opts = {}) {
  porta = porta || process.env.PORT || 8080;
  const PUBLIC_DIR = process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : null;
  const RESPIRO_MS = Number(process.env.RESPIRO_MS) || 1100; // ritmo dos bots na tela
  // COFRE de contas: persiste em DADOS_DIR (no Railway, um Volume montado; local,
  // ./dados). Se não houver disco gravável, cai pra memória e o jogo roda igual.
  const contas = criarContas();
  // [PATCH WS-AUTH] Verificador de credencial da conexão. FIREBASE_PROJECT_ID é
  // o id do projeto Firebase (NÃO é segredo — nenhuma service account, nenhuma
  // private key entra aqui). Sem ele, toda autenticação falha e o servidor não
  // aceita comando de jogador nenhum: é fail closed de propósito.
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  // [COMPOSIÇÃO] Costura de teste, e SÓ de teste: `opts.verificarToken` permite
  // que a suíte do transporte real (`test/ws.test.js`) injete um verificador
  // com certificados de teste. É parametrização da MESMA construção, não uma
  // segunda autoridade — o verificador injetado é o próprio
  // `criarVerificadorFirebase`, com as mesmas checagens de assinatura,
  // algoritmo, kid, audience, issuer e validade.
  //
  // Em produção nada muda: `node server.js` chama `iniciar()` sem argumentos, o
  // caminho continua sendo o do env, e sem FIREBASE_PROJECT_ID o servidor segue
  // fail-closed. Sem esta costura, a única suíte que prova a fronteira NO FIO
  // teria de ser desligada — e desligar teste não é opção.
  if (!projectId && !opts.verificarToken) {
    console.warn("[auth] FIREBASE_PROJECT_ID não configurado — NENHUMA conexão vai autenticar.");
  }
  const verificarToken = opts.verificarToken || criarVerificadorFirebase({ projectId });
  // [PRODUTOR] Outbox de encerramentos, ao lado do cofre em DADOS_DIR. Ela NÃO
  // é servida por HTTP: as rotas deste servidor são `/health`, `/avatar/<id>` e
  // o PUBLIC_DIR opcional — e PUBLIC_DIR é resolvido para um diretório próprio,
  // com a checagem `startsWith` que impede sair dele. O diretório de dados não
  // aparece em nenhuma dessas rotas, e não passa a aparecer por existir a
  // outbox.
  const outbox = criarOutbox();
  // [BACKEND + CHAT] AUTORIZACAO DE ENTRADA VIP E PONTE DE CHAT — as duas
  // fiacoes externas deste servidor, sobre UMA credencial so.
  //
  // A credencial e a CANONICA (`credencial_motor`), construida uma vez e
  // compartilhada: e ela que tem cache por margem, coalescencia e rotacao do
  // refresh token. Um segundo cliente de credencial teria a sua propria
  // opiniao sobre validade e rotacionaria por conta propria - e duas rotacoes
  // concorrentes invalidam uma a outra. Por isso ela nasce aqui, e uma so.
  //
  // [COMPOSICAO] As duas folhas compunham esta linha, cada uma com o seu
  // consumidor (a admissao VIP numa, o chat na outra) e cada uma construindo a
  // credencial. Compor por uniao ingenua criaria exatamente a SEGUNDA credencial
  // que as duas proibiam. Ha uma so, e ela e injetada nos dois consumidores.
  //
  // Construir NAO fala com rede e NAO exige as variaveis: sem elas,
  // `configurada()` responde false e `obterIdToken()` recusa. O servidor sobe
  // igual, e mesa casual - que e o que existe hoje - nao toca em nada disto.
  const credencialDoMotor = criarCredencialDoMotor({ env: process.env });
  // Sem URL utilizavel ou sem credencial, `criarAdaptadorAdmissaoVip` devolve
  // `null` — e `null` e exatamente o estado que o gate ja sabe tratar: entrada
  // VIP recusada, fechada, antes da ocupacao do assento.
  const autorizarEntradaVip = criarAdaptadorAdmissaoVip({
    url: process.env[VARIAVEL_URL_ADMISSAO],
    credencial: credencialDoMotor,
  });
  // [CHAT] A ponte para a autoridade de chat.
  //
  // FALHA FECHADA E SILENCIOSA PARA O JOGO. Se as variáveis da credencial não
  // estiverem no ambiente, `configurada()` responde false, `sincronizarCanal`
  // não faz nada e todo `chat_enviar` é recusado — e o resto do servidor roda
  // exatamente como rodava. Um chat indisponível não pode impedir de jogar.
  const chatPonte = criarPonteDeChat({ credencial: credencialDoMotor });
  if (!chatPonte.configurada()) {
    // Nomes das variáveis que faltam, nunca valores. `estado()` já é redigido.
    console.warn(
      "[chat] transporte desligado: credencial do motor nao configurada (" +
        (credencialDoMotor.estado().faltando || []).join(", ") +
        ")"
    );
  }
  // [GATE VIP] Natureza COMPETITIVA das mesas deste processo. Vem do ambiente,
  // que e a configuracao confiavel do servidor - do mesmo lugar de PORT e de
  // FIREBASE_PROJECT_ID, e nao de mensagem de cliente. Ausente = `casual`, que
  // e o que toda mesa e hoje. Valor fora da enumeracao NAO vira casual: vira
  // `desconhecida`, e mesa desconhecida nao admite ninguem (fail closed).
  const servidor = criarServidor({
    agendar: (fn) => setTimeout(fn, RESPIRO_MS),
    contas,
    verificarToken,
    outbox,
    categoriaCompetitiva: process.env.CATEGORIA_COMPETITIVA,
    // [BACKEND] A porta unica do gate. `null` quando nao ha endpoint ou
    // credencial — e nesse caso a entrada VIP segue falhando fechada, que e
    // o estado de qualquer processo que ainda nao foi provisionado.
    autorizarEntradaVip,
    chatPonte,
  });
  const catConfigurada = servidor.ger.categoriaConfigurada;
  console.log("[gate-vip] categoria competitiva das mesas deste processo: " + catConfigurada);
  // [BACKEND] Disponibilidade e HOST. Nunca a URL inteira: o caminho e a query
  // sao onde chave costuma se esconder, e um log de boot e a coisa mais
  // copiada e colada que existe num painel de deploy.
  if (autorizarEntradaVip) {
    const est = autorizarEntradaVip.estado();
    console.log("[admissao-vip] autorizacao de entrada: CONFIGURADA · host=" + est.host +
      " · tls=" + (est.seguro ? "sim" : "nao (loopback)"));
  } else {
    console.warn("[admissao-vip] autorizacao de entrada: AUSENTE — entrada em mesa " +
      "vip_ranqueada falha fechada. (" + VARIAVEL_URL_ADMISSAO + " nao configurada, invalida, " +
      "ou credencial do motor incompleta.)");
  }
  if (catConfigurada !== "casual" && !autorizarEntradaVip) {
    console.warn("[gate-vip] este processo roda mesas " + catConfigurada + " e NAO tem " +
      "autorizador: nenhuma ocupacao de assento sera admitida.");
  }

  const http_server = http.createServer((req, res) => {
    // [SHA] Somente leitura: sem segredo, sem eco do pedido, sem cache.
    if (req.url === "/versao") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      return res.end(JSON.stringify(corpoDaVersao(process.env)));
    }
    if (req.url === "/health" || req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok");
    }
    // FOTO DE AVATAR do jogador: /avatar/<jogadorId>  → a imagem enviada por upload
    if (req.url.indexOf("/avatar/") === 0) {
      const idc = decodeURIComponent(req.url.slice("/avatar/".length).split("?")[0]);
      const buf = contas && contas.avatarBuffer ? contas.avatarBuffer(idc) : null;
      if (buf) {
        res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "public, max-age=60", "access-control-allow-origin": "*" });
        return res.end(buf);
      }
      res.writeHead(404, { "content-type": "text/plain" }); return res.end("sem avatar");
    }
    if (PUBLIC_DIR) {
      let rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel === "/") rel = "/index.html";
      const fp = path.join(PUBLIC_DIR, path.normalize(rel));
      if (fp.startsWith(PUBLIC_DIR) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { "content-type": MIME[path.extname(fp)] || "application/octet-stream" });
        return fs.createReadStream(fp).pipe(res);
      }
    }
    res.writeHead(404, { "content-type": "text/plain" }); res.end("not found");
  });

  // upgrade HTTP → WebSocket
  http_server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key || (req.headers["upgrade"] || "").toLowerCase() !== "websocket") {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n"); socket.destroy(); return;
    }
    const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
    );
    socket.setNoDelay(true);

    // [PATCH WS-AUTH] §8 — a credencial vem no cabeçalho do upgrade, que é a
    // fronteira mais forte que esta stack oferece: o token não passa por URL
    // nem por query string, então não cai em log de acesso, proxy ou métrica.
    // A leitura é EXCLUSIVAMENTE do header; `req.url` nunca é consultado para
    // identidade — se alguém mandar ?token=..., é simplesmente ignorado.
    const tokenDoHandshake = bearerDoCabecalho(req.headers["authorization"]);
    // A versão do protocolo acompanha a credencial na MESMA fronteira. Sem ela
    // o cliente é tratado como protocolo 1 (antigo) e leva ATUALIZACAO_OBRIGATORIA
    // — a ponte de versão não tem porta dos fundos.
    const protocoloDoHandshake = Number(req.headers["x-bmv-protocolo"]) || 1;

    let idConn = null;
    const conn = criarConexao(socket, {
      message: (str) => {
        let msg; try { msg = JSON.parse(str); } catch (_) { return conn.enviarTexto(JSON.stringify({ tipo: "erro", motivo: "JSON inválido" })); }
        servidor.processar(idConn, msg);
      },
      close: () => { if (idConn) { servidor.desconectar(idConn); idConn = null; } },
    });
    idConn = servidor.conectar(
      (msg) => conn.enviarTexto(JSON.stringify(msg)),
      // fail closed: credencial recusada derruba a conexão em vez de deixá-la
      // aberta tentando de novo.
      { fechar: () => conn.fechar(1008) }
    );
    // Clientes que não conseguem mandar cabeçalho no upgrade (navegador) ficam
    // em CONECTADO_NAO_AUTENTICADO e autenticam pela primeira mensagem
    // ({tipo:"auth", token}); até lá nenhum comando de jogador roda.
    if (tokenDoHandshake) servidor.autenticar(idConn, tokenDoHandshake, protocoloDoHandshake);
  });

  http_server.listen(porta, () => {
    console.log("Buraco Master VIP — WS server (sem deps) ouvindo na porta " + porta +
      (PUBLIC_DIR ? " · servindo " + PUBLIC_DIR : ""));
  });
  return { http_server, servidor };
}

if (require.main === module) iniciar();

module.exports = { iniciar, encodeFrame, bearerDoCabecalho, shaImplantado, corpoDaVersao, FONTES_DE_SHA };

  };


  // [PATCH WS-AUTH + PATCH ESPECTADOR] Fronteira de teste.
  // Executado como programa (`node server.js`, que é o comando do Railway) o
  // comportamento é EXATAMENTE o de antes: sobe o WebSocket na porta de PORT.
  // Carregado com `require(...)` — só os testes fazem isso — ele NÃO abre porta
  // nenhuma e apenas expõe o registro interno de módulos, para que a suíte possa
  // montar salas e conexões falsas sem subir rede. Sem esta saída, `require`
  // deste arquivo iniciaria um listener e a suíte não teria como rodar.
  if (require.main === module) {
    // sobe o servidor WebSocket (usa a porta de PORT, padrão 8080)
    __require("ws_server").iniciar();
  } else {
    module.exports = { require: __require };
  }
})();
