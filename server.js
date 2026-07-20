// GERADO por cliente/build_server_bundle.js — NÃO EDITAR À MÃO.
// Buraco Master VIP — servidor de salas (multiplayer) num único arquivo, Node puro.
// Deploy: node server.js  (porta via env PORT, padrão 8080). Health-check: /health.
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
  const rSeq = validarSequencia(cartas);
  if (rSeq.valido) return rSeq;
  if (opts.permiteTrinca) {
    const rTri = validarTrinca(cartas);
    if (rTri.valido) return rTri;
    return { valido: false, motivo: "não forma uma sequência nem uma trinca válida" };
  }
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
    if (res.tipo === "limpa" || res.tipo === "de_500") return true; // ás não forma canastra (só valor)
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
function planejarTurno({ mao, topoLixo, jogosMesaDupla = [], jogosAdversario = [], mortoDisponivel, jaPegouMorto, cartaObrigatoria = null, minimoAbertura = 0, tamanhoLixo = 1, provaTopo = null, modalidade = "sbtl", cartasLixo = null }) {
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

  let descarte = null;
  if (!bater && maoAposBaixar.length > 0) {
    descarte = decidirDescarte(maoAposBaixar, jogosAdversario, permiteTrinca); // descarte SEGURO
  }

  return { compra, extensoes, baixadas: jogos, pegarMorto, bater, descarte };
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
    })),
    rodada: 0,
    placar: { nos: 0, eles: 0 },
    // VULNERABILIDADE (mesma regra da v111, motor/vulnerabilidade.js do mockup):
    // 0 = não vulnerável; 1 = vulnerável há 1 rodada (1ª baixada precisa somar
    // 75+ pontos); 2 = vulnerável há 2+ rodadas (90+). NÃO reseta por rodada —
    // só some numa partida nova.
    rodadasVulneravel: { nos: 0, eles: 0 },
    encerrada: false,        // partida encerrada (bateu a meta)
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
    encerrarRodada(jogo, dupla);
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
 *  Vale SÓ pro HUMANO (os bots já respeitam o mínimo via minimoAbertura). Quando a
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
  // FOUL — só o humano chega aqui (bot não abre fraco). Anula a abertura:
  if (jogo.assentos[assento].tipo !== "humano") { jogo.abriuValido[dupla] = true; return null; }
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
    // BATIDA FINAL (tem limpa, garantido pela checagem acima) — encerra a rodada
    encerrarRodada(jogo, dupla);
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
    return res.valido && (res.tipo === "limpa" || res.tipo === "de_500");
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
    if (res.tipo === "limpa" || res.tipo === "de_500") return true; // ás não conta (só valor de carta)
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
    return r.valido && (r.tipo === "limpa" || r.tipo === "de_500");
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
 *  (bônus de batida) ou null (esgotamento). */
function encerrarRodada(jogo, duplaQueBateu) {
  if (jogo.rodadaEncerrada) return; // idempotente
  jogo.rodadaEncerrada = true;
  jogo.duplaQueBateu = duplaQueBateu;
  contarPontos(jogo);
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
  const detalhe = { de500: 0, limpas: 0, sujas: 0, baixadas: 0 };
  for (const meld of jogo.jogosDupla[dupla]) {
    if (meld.length >= 7) {
      // TRINCA não forma canastra (regra Sônia 19/jul): usa validarSequencia, que RECUSA
      // grupos de valor igual — então uma trinca de 7+ NÃO ganha bônus de canastra; só os
      // pontos das cartas (contados no laço abaixo) entram. Canastra de sequência normal.
      const res = validarSequencia(meld);
      if (res.valido) {
        if (res.tipo === "de_500") { pontosCanastras += 500; detalhe.de500++; }
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
function jogarTurnoBot(jogo, assento) {
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
  if (plano1.compra.origem === "lixo" && topo && !pegarLixoStranda && !lixoForcariaAberturaFraca) {
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
  });

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
  const idDescarte = escolherDescarteLegal(jogo, assento, plano2.descarte ? plano2.descarte.id : null);
  if (idDescarte == null) {
    // Sem descarte legal (ex.: 1 carta, batida exigiria limpa que não há). Segura
    // a carta e passa a vez — "carta não tem mola", nada volta pro lixo/monte.
    J.passarVez(jogo);
    log.push("segurou a carta (descarte seria batida ilegal) — passou a vez");
    return { ok: true, log, semDescarte: true };
  }
  const rd = J.descartar(jogo, assento, idDescarte);
  if (!rd.ok) {
    // Descarte recusado (ex.: trava do topo ainda ligada). Passa a vez sem travar.
    J.passarVez(jogo);
    log.push("descarte recusado (" + rd.erro + ") — passou a vez");
    return { ok: true, log, semDescarte: true };
  }
  if (rd.bateu) { log.push("descartou " + cartaTxt(rd.descarte) + " → BATEU! encerra a rodada"); return { ok: true, log, bateu: true }; }
  if (rd.pegouMorto) { log.push("descartou " + cartaTxt(rd.descarte) + " → zerou e pegou o MORTO"); return { ok: true, log, pegouMorto: true }; }
  log.push("descartou " + cartaTxt(rd.descarte));
  return { ok: true, log };
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
  return mao[mao.length - 1].id;
}

module.exports = { jogarTurnoBot, cartaTxt, escolherDescarteLegal };

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

  carregar();
  return {
    obterOuCriar, obter, atualizarApelido, ajustarMoedas, registrarPartida,
    ranking, posicaoNoRanking, totalDeContas, salvar, carregar,
    _dados: () => dados, ECON,
  };
}

module.exports = {
  criarContas, ECON, nivelDeXp, xpAcumuladoParaNivel, progressoDeXp, duplaDoAssento,
};

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

const NOMES_BOT = ["Renato", "Cláudia", "Mateus", "Sofia"];

/** Código padrão tipo BURACO-4821. (Math.random é ok em Node normal.) */
function gerarCodigoPadrao() {
  return "BURACO-" + Math.floor(1000 + Math.random() * 9000);
}

/** Cria um gerenciador de salas em memória. `opts.gerarCodigo` permite injetar
 *  um gerador determinístico nos testes. */
function criarGerenciador(opts = {}) {
  const salas = {};
  // cofre de contas (servidor/contas.js). Opcional: sem ele, a mesa roda igual,
  // só não persiste estatística nenhuma (útil pra testes puros de mesa).
  const contas = opts.contas || null;
  const gerarCodigo = opts.gerarCodigo || gerarCodigoPadrao;
  const LIMITE_BOTS = opts.limiteAvanco || 5000; // trava anti-loop do avanço
  // autoBots: avança TODOS os bots na hora (síncrono). Quando false, quem chama
  // controla o ritmo (jogarUmBot), pra dar o "respiro" entre jogadas na tela.
  const autoBots = opts.autoBots !== false;

  function criarMesa({ apelido = "Jogador", jogadorId = null, modalidade = "sbtl", metaPontos = 3000, aposta = 0 } = {}) {
    let codigo, tentativas = 0;
    do { codigo = gerarCodigo(); } while (salas[codigo] && ++tentativas < 100);
    if (salas[codigo]) return { erro: "não foi possível gerar um código único" };
    salas[codigo] = {
      codigo, modalidade, metaPontos,
      aposta: Math.max(0, Math.round(aposta || 0)), // entrada por jogador (0 = sem aposta)
      criadorAssento: 0,
      assentos: [{ apelido, tipo: "humano", jogadorId }, null, null, null],
      iniciada: false,
      jogo: null,
      liquidada: false,   // já contabilizou o resultado no cofre?
      resumoFinal: null,  // resumo por jogador (deltas de moedas/xp) pra tela de fim
      log: [],
    };
    return { codigo, assento: 0 };
  }

  function entrarMesa({ codigo, apelido = "Jogador", jogadorId = null, assento } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (sala.iniciada) return { erro: "a partida já começou" };
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
    sala.assentos[alvo] = { apelido, tipo: "humano", jogadorId };
    return { assento: alvo, codigo };
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
      if (!vez || vez.tipo !== "bot") break; // vez de humano: para e espera
      const r = jogarTurnoBot(jogo, jogo.vez);
      sala.log.push({ rodada: jogo.rodada, assento: jogo.vez, apelido: vez.apelido, acoes: r.log });
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
    return !!(v && v.tipo === "bot");
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
    if (!v || v.tipo !== "bot") return { jogou: false };
    const assento = j.vez;
    const r = jogarTurnoBot(j, assento);
    sala.log.push({ rodada: j.rodada, assento, apelido: v.apelido, acoes: r.log });
    liquidar(sala); // batida de bot pode ter encerrado a partida
    return { jogou: true, assento, resultado: r };
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
    return J.visaoDoAssento(sala.jogo, assento);
  }

  /** Um jogador saiu da sala. No lobby, libera o assento; em jogo, vira bot
   *  (pra mesa não travar) — decisão simples pro M2. */
  function sair({ codigo, assento } = {}) {
    const sala = salas[codigo];
    if (!sala) return { erro: "mesa não encontrada" };
    if (!sala.iniciada) {
      if (assento !== sala.criadorAssento) sala.assentos[assento] = null;
      return { ok: true };
    }
    if (sala.jogo && sala.jogo.assentos[assento]) {
      sala.jogo.assentos[assento].tipo = "bot";
      if (!sala.jogo.assentos[assento].apelido) sala.jogo.assentos[assento].apelido = NOMES_BOT[assento % NOMES_BOT.length];
      avancarBots(sala); // se era a vez dele, o bot assume
    }
    return { ok: true };
  }

  return { salas, criarMesa, entrarMesa, iniciarPartida, aplicarJogada, avancarBots, vezEhBot, jogarUmBot, visao, sair };
}

module.exports = { criarGerenciador, gerarCodigoPadrao, NOMES_BOT };

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

const { criarGerenciador } = require("./salas");

function criarServidor(opts = {}) {
  // autoBots:false → o servidor controla o ritmo dos bots (respiro). `agendar`
  // decide o tempo: padrão é IMEDIATO (síncrono, ótimo pros testes); no navegador
  // passa-se um setTimeout(~1100ms) pra dar pra acompanhar a jogada dos robôs.
  const ger = criarGerenciador(Object.assign({}, opts, { autoBots: false }));
  const contas = opts.contas || null; // cofre de contas (opcional)
  const agendar = opts.agendar || ((fn) => fn());
  const conexoes = {}; // id -> { id, enviar, codigo, assento, jogadorId }
  let seq = 0;

  function conectar(enviar) {
    const id = "c" + ++seq;
    conexoes[id] = { id, enviar, codigo: null, assento: null, jogadorId: null };
    return id;
  }

  function desconectar(id) {
    const c = conexoes[id];
    if (!c) return;
    if (c.codigo != null && c.assento != null) {
      const cod = c.codigo;
      ger.sair({ codigo: cod, assento: c.assento });
      c.codigo = null; c.assento = null;
      broadcastSala(cod);
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

    switch (msg.tipo) {
      case "criarMesa": {
        c.jogadorId = msg.jogadorId || c.jogadorId || null;
        if (contas && c.jogadorId) contas.obterOuCriar(c.jogadorId, msg.apelido);
        const r = ger.criarMesa({ apelido: msg.apelido, jogadorId: c.jogadorId, modalidade: msg.modalidade, metaPontos: msg.metaPontos, aposta: msg.aposta });
        if (r.erro) return enviarPara(id, { tipo: "erro", motivo: r.erro });
        c.codigo = r.codigo; c.assento = r.assento;
        enviarPara(id, { tipo: "entrou", codigo: r.codigo, assento: r.assento });
        return broadcastSala(r.codigo);
      }
      case "entrarMesa": {
        c.jogadorId = msg.jogadorId || c.jogadorId || null;
        if (contas && c.jogadorId) contas.obterOuCriar(c.jogadorId, msg.apelido);
        const r = ger.entrarMesa({ codigo: msg.codigo, apelido: msg.apelido, jogadorId: c.jogadorId });
        if (r.erro) return enviarPara(id, { tipo: "erro", motivo: r.erro });
        c.codigo = r.codigo || msg.codigo; c.assento = r.assento;
        enviarPara(id, { tipo: "entrou", codigo: c.codigo, assento: r.assento });
        return broadcastSala(c.codigo);
      }
      case "perfil": {
        // dados REAIS da conta do jogador (pro Perfil/carteira do app)
        const jid = msg.jogadorId || c.jogadorId;
        if (!contas || !jid) return enviarPara(id, { tipo: "perfil", conta: null });
        const conta = contas.obterOuCriar(jid, msg.apelido);
        return enviarPara(id, { tipo: "perfil", conta: Object.assign({ posicao: contas.posicaoNoRanking(jid) }, conta) });
      }
      case "ranking": {
        if (!contas) return enviarPara(id, { tipo: "ranking", lista: [] });
        return enviarPara(id, { tipo: "ranking", lista: contas.ranking({ limite: msg.limite || 50, criterio: msg.criterio }) });
      }
      case "iniciarPartida": {
        if (c.codigo == null) return enviarPara(id, { tipo: "erro", motivo: "você não está numa mesa" });
        const r = ger.iniciarPartida({ codigo: c.codigo, assento: c.assento });
        if (r.erro) return enviarPara(id, { tipo: "erro", motivo: r.erro });
        return avancarComRespiro(c.codigo);
      }
      case "jogada": {
        if (c.codigo == null) return enviarPara(id, { tipo: "erro", motivo: "você não está numa mesa" });
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
        // AFK: o jogador estourou o tempo 2x — o assento dele vira BOT e o servidor
        // assume (joga por ele até ele voltar). É o que segura a mesa pública quando
        // alguém dorme com o celular (pedido Sônia). Só marca o tipo e destrava o ritmo.
        if (c.codigo == null) return;
        const salaB = ger.salas[c.codigo];
        if (salaB && salaB.jogo && salaB.jogo.assentos[c.assento]) {
          salaB.jogo.assentos[c.assento].tipo = "bot";
        }
        return avancarComRespiro(c.codigo); // o servidor joga o assento agora-bot
      }
      case "afkVoltar": {
        // o jogador voltou: o assento volta a ser HUMANO. O servidor para na vez dele
        // (vezEhBot=false) e espera — ele reassume no próximo turno dele.
        if (c.codigo == null) return;
        const salaV = ger.salas[c.codigo];
        if (salaV && salaV.jogo && salaV.jogo.assentos[c.assento]) {
          salaV.jogo.assentos[c.assento].tipo = "humano";
        }
        return broadcastSala(c.codigo);
      }
      case "sair": {
        if (c.codigo != null) {
          const cod = c.codigo;
          ger.sair({ codigo: cod, assento: c.assento });
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
    broadcastSala(codigo);
    emitirFimSeAcabou(codigo);
    if (ger.vezEhBot(codigo)) {
      agendar(function () {
        ger.jogarUmBot(codigo);
        avancarComRespiro(codigo);
      });
    }
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
      if (c.codigo === codigo && c.assento != null) {
        c.enviar({ tipo: "fim", resumo: sala.resumoFinal, placar });
      }
    }
  }

  /** Manda pra cada conexão da sala a SUA visão (por assento). É o "tempo real":
   *  toda mudança (jogada humana, jogadas dos bots, entrada de gente) reflete em
   *  todos. Cada um vê só a própria mão — a dos outros é só contagem. */
  function broadcastSala(codigo) {
    for (const cid in conexoes) {
      const c = conexoes[cid];
      if (c.codigo === codigo && c.assento != null) {
        c.enviar({ tipo: "estado", visao: ger.visao(codigo, c.assento) });
      }
    }
  }

  return { conectar, desconectar, processar, broadcastSala, ger, conexoes };
}

module.exports = { criarServidor };

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
const { criarContas } = require("./contas");

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

function iniciar(porta) {
  porta = porta || process.env.PORT || 8080;
  const PUBLIC_DIR = process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : null;
  const RESPIRO_MS = Number(process.env.RESPIRO_MS) || 1100; // ritmo dos bots na tela
  // COFRE de contas: persiste em DADOS_DIR (no Railway, um Volume montado; local,
  // ./dados). Se não houver disco gravável, cai pra memória e o jogo roda igual.
  const contas = criarContas();
  const servidor = criarServidor({ agendar: (fn) => setTimeout(fn, RESPIRO_MS), contas });

  const http_server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok");
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

    let idConn = null;
    const conn = criarConexao(socket, {
      message: (str) => {
        let msg; try { msg = JSON.parse(str); } catch (_) { return conn.enviarTexto(JSON.stringify({ tipo: "erro", motivo: "JSON inválido" })); }
        servidor.processar(idConn, msg);
      },
      close: () => { if (idConn) { servidor.desconectar(idConn); idConn = null; } },
    });
    idConn = servidor.conectar((msg) => conn.enviarTexto(JSON.stringify(msg)));
  });

  http_server.listen(porta, () => {
    console.log("Buraco Master VIP — WS server (sem deps) ouvindo na porta " + porta +
      (PUBLIC_DIR ? " · servindo " + PUBLIC_DIR : ""));
  });
  return { http_server, servidor };
}

if (require.main === module) iniciar();

module.exports = { iniciar, encodeFrame };

  };


  // sobe o servidor WebSocket (usa a porta de PORT, padrão 8080)
  __require("ws_server").iniciar();
})();
