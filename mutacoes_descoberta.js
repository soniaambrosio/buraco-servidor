// ===========================================================================
// PROVAS NEGATIVAS DA DESCOBERTA E DA PRESENÇA — OS 38.1 §9.
//
// A §9 nomeia CINCO defesas que a suíte tem de reprovar quando somem:
// FILTRAGEM, EXPIRAÇÃO, DEDUPLICAÇÃO, SANITIZAÇÃO e ORDENAÇÃO. Cada uma delas
// tem mutação própria aqui, e mais as defesas de revisão, invariante,
// frequência e fronteira que a mesma OS exige em §7 e §8.
//
// A BATERIA QUE JULGA É A SUÍTE INTEIRA, não só `descoberta.test.js`. Uma
// mutação que a suíte de outra folha pegue ainda conta — o ponto não é qual
// arquivo acusa, é que a mutação MORRA. E rodar a suíte toda é o que impede
// esta campanha de virar um espelho do próprio arquivo que ela deveria medir.
//
// DUAS TRAVAS ANTI-VÁCUO, e as duas param o processo:
//   1) a âncora tem de aparecer EXATAMENTE uma vez (`server.js` é um bundle de
//      fábricas e identificadores se repetem entre módulos);
//   2) o arquivo tem de mudar de bytes depois da troca.
// Sem elas, uma âncora que não casou vira "mutante não detectado" sem nunca ter
// sido injetada — e a campanha mente sobre cobertura.
//
// Uso: node mutacoes_descoberta.js
// ===========================================================================
const fs = require("fs");
const { execFileSync } = require("child_process");

const ALVO = "server.js";

const MUTACOES = [
  // --- FILTRAGEM (§4) ------------------------------------------------------
  {
    n: 1,
    nome: "a topologia deixa de filtrar (mesa PRIVADA passa a aparecer)",
    de: `  if (sala.tipoPartida !== TIPO_PUBLICO) return false;`,
    para: `  if (false) return false;`,
  },
  {
    n: 2,
    nome: "a natureza competitiva deixa de filtrar (VIP/ranqueada aparece)",
    de: `  if (sala.categoriaCompetitiva !== CATEGORIA_PUBLICA) return false;`,
    para: `  if (false) return false;`,
  },
  {
    n: 3,
    nome: "mesa ENCERRADA volta a aparecer (envelope ignorado)",
    de: `  if (sala.envelopeEncerramento) return false;`,
    para: `  if (false) return false;`,
  },
  {
    n: 4,
    nome: "mesa LIQUIDADA volta a aparecer",
    de: `  if (sala.liquidada) return false;`,
    para: `  if (false) return false;`,
  },
  {
    n: 5,
    nome: "a meta deixa de ser conferida contra a lista canônica",
    de: `  if (!METAS_CANONICAS.includes(sala.metaPontos)) return false;`,
    para: `  if (false) return false;`,
  },
  {
    n: 6,
    nome: "a modalidade do cliente passa a ser aceita como veio",
    de: `  if (!MODALIDADES_PUBLICAS.includes(sala.modalidade)) return false;`,
    para: `  if (false) return false;`,
  },
  {
    n: 7,
    nome: "sala malformada passa (assentos deixa de ser conferido)",
    de: `  if (!Array.isArray(sala.assentos) || sala.assentos.length !== CAPACIDADE) return false;`,
    para: `  if (!Array.isArray(sala.assentos)) return false;`,
  },
  {
    n: 8,
    nome: "a lista de modalidades vira uma SEGUNDA lista, digitada à mão",
    de: `const MODALIDADES_PUBLICAS = Object.freeze(Object.keys(MODALIDADES).slice().sort());`,
    para: `const MODALIDADES_PUBLICAS = Object.freeze(["aberto", "fechado"]);`,
  },

  // --- SANITIZAÇÃO (§4/§8) -------------------------------------------------
  {
    n: 9,
    nome: "o assento passa a ser copiado inteiro (jogadorId vaza)",
    de: `    saida.push({
      assento: i,
      ocupado: true,
      tipo: humano ? "humano" : "bot",
      apelido: apelidoPublico(a.apelido),
      avatarGaleria: humano ? avatarDeGaleria(contas, a.jogadorId) : null,
    });`,
    para: `    saida.push(Object.assign({
      assento: i,
      ocupado: true,
      tipo: humano ? "humano" : "bot",
      apelido: apelidoPublico(a.apelido),
      avatarGaleria: humano ? avatarDeGaleria(contas, a.jogadorId) : null,
    }, a));`,
  },
  {
    n: 10,
    nome: "o avatar de FOTO passa a sair com o id (que é o uid)",
    de: `  if (!c || c.avatarTipo !== "galeria") return null;
  const n = Number(c.avatarId);
  return Number.isInteger(n) && n > 0 ? n : null;`,
    para: `  if (!c) return null;
  if (c.avatarTipo === "foto") return jogadorId;
  const n = Number(c.avatarId);
  return Number.isInteger(n) && n > 0 ? n : null;`,
  },
  {
    n: 11,
    nome: "o nome público passa a ser derivado do uid do criador",
    de: `  if (criador && criador.tipo === "humano" && criador.apelido) return "Mesa de " + criador.apelido;`,
    para: `  if (criador && criador.tipo === "humano") return "Mesa de " + ((sala.assentos[sala.criadorAssento] || {}).jogadorId || criador.apelido);`,
  },

  // --- ORDENAÇÃO (§5) ------------------------------------------------------
  {
    n: 12,
    nome: "a preferência por mesa mais cheia inverte",
    de: `  if (a.jogadores !== b.jogadores) return b.jogadores - a.jogadores;`,
    para: `  if (a.jogadores !== b.jogadores) return a.jogadores - b.jogadores;`,
  },
  {
    n: 13,
    nome: "a ordenação some por inteiro",
    de: `    registros.sort((x, y) => compararMesas(`,
    para: `    if (false) registros.sort((x, y) => compararMesas(`,
  },
  {
    n: 14,
    nome: "mesa ingressável perde a precedência",
    de: `  if (a.ingressavel !== b.ingressavel) return a.ingressavel ? -1 : 1;`,
    para: `  if (false) return a.ingressavel ? -1 : 1;`,
  },
  {
    n: 15,
    nome: "o desempate por tempo de espera inverte (mais nova primeiro)",
    de: `  if (a.criadaEm !== b.criadaEm) return a.criadaEm - b.criadaEm;`,
    para: `  if (a.criadaEm !== b.criadaEm) return b.criadaEm - a.criadaEm;`,
  },
  {
    n: 16,
    nome: "o desempate final some (a ordem deixa de ser total)",
    de: `  if (a.codigo < b.codigo) return -1;
  if (a.codigo > b.codigo) return 1;
  return 0;`,
    para: `  return 0;`,
  },
  {
    n: 17,
    nome: "`criadaEm` deixa de ser imutável (o cliente compra posição)",
    de: `      value: salas[codigo].criadaEm, writable: false, configurable: false, enumerable: true,`,
    para: `      value: salas[codigo].criadaEm, writable: true, configurable: true, enumerable: true,`,
  },

  // --- ESTADO DE INGRESSO (§4) --------------------------------------------
  {
    n: 18,
    nome: "mesa em andamento passa a ser anunciada como ingressável",
    de: `    const estadoIngresso = sala.iniciada
      ? INGRESSO.EM_ANDAMENTO
      : (vagas > 0 ? INGRESSO.AGUARDANDO : INGRESSO.CHEIA);`,
    para: `    const estadoIngresso = vagas > 0 ? INGRESSO.AGUARDANDO : INGRESSO.CHEIA;`,
  },
  {
    n: 19,
    nome: "`ingressavel` passa a ser só 'tem vaga'",
    de: `        ingressavel: estadoIngresso === INGRESSO.AGUARDANDO,`,
    para: `        ingressavel: vagas > 0,`,
  },
  {
    n: 20,
    nome: "'mesas com vagas' passa a contar assento vazio de mesa em andamento",
    de: `      if (r.mesa.ingressavel) { mesasComVagas++; if (mod) mod.mesasComVagas++; }`,
    para: `      if (r.mesa.vagas > 0) { mesasComVagas++; if (mod) mod.mesasComVagas++; }`,
  },

  // --- DEDUPLICAÇÃO (§6.1) -------------------------------------------------
  {
    n: 21,
    nome: "a presença passa a contar SESSÕES (sockets), não pessoas",
    de: `  function totalDeJogadores() {
    expirarVencidas();
    return porUid.size;
  }`,
    para: `  function totalDeJogadores() {
    expirarVencidas();
    let n = 0; for (const m of porUid.values()) n += m.size; return n;
  }`,
  },
  {
    n: 22,
    nome: "a chave de deduplicação vira o id da conexão",
    de: `    presenca.renovar(c.uidAutenticado, c.id);
    const falta = Math.max(0, expiraEm - agora());`,
    para: `    presenca.renovar(c.id, c.id);
    const falta = Math.max(0, expiraEm - agora());`,
  },
  {
    n: 23,
    nome: "fechar UMA aba derruba a pessoa inteira",
    de: `    const havia = mapa.delete(sessaoId);
    if (mapa.size === 0) porUid.delete(uid);
    return havia;`,
    para: `    const havia = mapa.size > 0;
    porUid.delete(uid);
    return havia;`,
  },
  {
    n: 24,
    nome: "a contagem pública passa a somar ASSENTOS, não pessoas únicas",
    de: `      for (const uid of r.uids) {
        if (!presente(uid)) continue;
        emMesas.add(uid);`,
    para: `      for (const uid of r.uids) {
        emMesas.add(uid);`,
  },

  // --- EXPIRAÇÃO (§6.3) ----------------------------------------------------
  {
    n: 25,
    nome: "o lease nunca vence (fantasma de queda abrupta fica de pé)",
    de: `        if (expiraEm <= t) { mapa.delete(sid); sessoes++; }`,
    para: `        if (false) { mapa.delete(sid); sessoes++; }`,
  },
  {
    n: 26,
    nome: "a expiração deixa de ser conferida na LEITURA",
    de: `  function estaPresente(uid) {
    if (!ehTexto(uid)) return false;
    expirarVencidas();
    return porUid.has(uid);
  }`,
    para: `  function estaPresente(uid) {
    if (!ehTexto(uid)) return false;
    return porUid.has(uid);
  }`,
  },
  {
    n: 27,
    nome: "sessão com credencial EXPIRADA continua contando",
    de: `    presenca.encerrarSessao(c.uidAutenticado, c.id);
    c._cancelarExpiracao = agendarEm(carenciaMs, () => {`,
    para: `    c._cancelarExpiracao = agendarEm(carenciaMs, () => {`,
  },
  {
    n: 28,
    nome: "a desconexão limpa deixa de fechar a sessão",
    de: `    presenca.encerrarSessao(c.uidAutenticado, c.id);
    // [PATCH WS-AUTH] não deixa timer de expiração pendurado numa conexão morta`,
    para: `    // [PATCH WS-AUTH] não deixa timer de expiração pendurado numa conexão morta`,
  },
  {
    n: 29,
    nome: "o TTL vira eterno",
    de: `const TTL_PADRAO_MS = 45000;`,
    para: `const TTL_PADRAO_MS = 100000000;`,
  },

  // --- ESPECTADOR (§6.1/§6.2) ---------------------------------------------
  {
    n: 30,
    nome: "espectador passa a ser contado como jogador de mesa pública",
    de: `        if (!ehTexto(uid) || emMesas.has(uid) || !presente(uid)) continue;
        espectadoresUnicos.add(uid);`,
    para: `        if (!ehTexto(uid)) continue;
        espectadoresUnicos.add(uid);
        emMesas.add(uid);`,
  },
  {
    n: 31,
    nome: "quem tem assento passa a ser contado TAMBÉM como espectador",
    de: `    for (const cid in conexoes) {
      const c = conexoes[cid];
      if (!c || c.estadoAuth !== AUTH.AUTENTICADO) continue;
      if (c.codigo == null || c.assento != null) continue;`,
    para: `    for (const cid in conexoes) {
      const c = conexoes[cid];
      if (!c || c.estadoAuth !== AUTH.AUTENTICADO) continue;
      if (c.codigo == null) continue;`,
  },
  {
    n: 32,
    nome: "bot passa a ser contado como jogador humano",
    de: `      if (assentos[i].tipo !== "humano") continue;
      jogadores++;`,
    para: `      jogadores++;`,
  },

  // --- REVISÃO E CONSISTÊNCIA (§7) ----------------------------------------
  {
    n: 33,
    nome: "a revisão passa a subir a cada consulta (o relógio entra na impressão)",
    de: `const CAMPOS_FORA_DA_REVISAO = Object.freeze(["aguardandoHaMs", "revisao"]);`,
    para: `const CAMPOS_FORA_DA_REVISAO = Object.freeze(["revisao"]);`,
  },
  {
    n: 34,
    nome: "a revisão da mesa deixa de subir quando a mesa muda",
    de: `      if (!anterior || anterior.impressao !== imp) {
        porMesa.set(codigo, { revisao: ++sequencia, impressao: imp });
      }`,
    para: `      if (!anterior) {
        porMesa.set(codigo, { revisao: ++sequencia, impressao: imp });
      }`,
  },
  {
    n: 35,
    nome: "a revisão global deixa de subir",
    de: `    if (impressaoGlobal !== impGlobal) {
      impressaoGlobal = impGlobal;
      revisao = ++sequencia;
    }`,
    para: `    if (impressaoGlobal !== impGlobal) {
      impressaoGlobal = impGlobal;
    }`,
  },
  {
    n: 36,
    nome: "a revisão por mesa passa a ser um contador PRÓPRIO (código reaproveitado regride)",
    de: `        porMesa.set(codigo, { revisao: ++sequencia, impressao: imp });`,
    para: `        porMesa.set(codigo, { revisao: (anterior ? anterior.revisao : 0) + 1, impressao: imp });`,
  },
  {
    n: 37,
    nome: "a geração deixa de ser sorteada (dois processos ficam indistinguíveis)",
    de: `  const geracao = ehTexto(opts.geracao) ? opts.geracao : crypto.randomUUID();`,
    para: `  const geracao = ehTexto(opts.geracao) ? opts.geracao : "geracao-fixa";`,
  },

  // --- INVARIANTES (§7) ----------------------------------------------------
  {
    n: 38,
    nome: "`vagas` pode ficar negativo",
    de: `    const vagas = CAPACIDADE - ocupados;`,
    para: `    const vagas = CAPACIDADE - ocupados - 1;`,
  },
  {
    n: 39,
    nome: "a capacidade anunciada deixa de ser a real",
    de: `const CAPACIDADE = 4;`,
    para: `const CAPACIDADE = 5;`,
  },

  // --- FRONTEIRA E FREQUÊNCIA (§8) ----------------------------------------
  {
    n: 40,
    nome: "o limite de frequência da consulta some",
    de: `        if (!liberarRitmo(c, "_ritmoDescoberta", RITMO_DESCOBERTA_MS)) {`,
    para: `        if (false) {`,
  },
  {
    n: 41,
    nome: "o limite de frequência do pulso some",
    de: `        if (!liberarRitmo(c, "_ritmoPulso", RITMO_PULSO_MS)) {`,
    para: `        if (false) {`,
  },
  {
    n: 42,
    nome: "o limite passa a ser GLOBAL (um cliente tranca todos os outros)",
    de: `  function liberarRitmo(c, campo, intervaloMs) {
    const t = agora();
    const ultimo = c[campo];`,
    para: `  const _ritmoGlobal = {};
  function liberarRitmo(c, campo, intervaloMs) {
    const t = agora();
    const ultimo = _ritmoGlobal[campo];
    if (typeof ultimo === "number" && t - ultimo < intervaloMs) return false;
    _ritmoGlobal[campo] = t;
    return true;
  }
  function liberarRitmoOriginal(c, campo, intervaloMs) {
    const t = agora();
    const ultimo = c[campo];`,
  },
  {
    n: 43,
    nome: "conexão não autenticada passa a pulsar",
    de: `    if (!c || c.estadoAuth !== AUTH.AUTENTICADO || !c.uidAutenticado) return false;
    return Boolean(presenca.renovar(c.uidAutenticado, c.id));`,
    para: `    if (!c) return false;
    return Boolean(presenca.renovar(c.uidAutenticado || c.id, c.id));`,
  },
  {
    n: 44,
    nome: "o cliente passa a poder DECLARAR o próprio ttl",
    de: `          ttlMs: presenca.ttlMs,`,
    para: `          ttlMs: msg.ttlMs || presenca.ttlMs,`,
  },
  {
    n: 45,
    nome: "a consulta passa a aceitar filtro do cliente",
    de: `        return enviarPara(id, Object.assign({ tipo: DESCOBERTA_FIO.RESPOSTA }, projetarDescoberta()));`,
    para: `        const proj = projetarDescoberta();
        if (msg.modalidade) proj.mesas = proj.mesas.filter((m) => m.modalidade === msg.modalidade);
        return enviarPara(id, Object.assign({ tipo: DESCOBERTA_FIO.RESPOSTA }, proj));`,
  },
];

function lerNormalizado(caminho) {
  const bruto = fs.readFileSync(caminho, "utf8");
  return { crlf: bruto.indexOf("\r\n") >= 0, texto: bruto.split("\r\n").join("\n"), bruto };
}

function rodarSuite() {
  try {
    return execFileSync(process.execPath, ["--test", "test/*.test.js"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600000,
    });
  } catch (e) {
    return String((e.stdout || "") + (e.stderr || ""));
  }
}

function falhasDe(saida) {
  const m = /^# fail (\d+)$/m.exec(saida) || /ℹ fail (\d+)/.exec(saida);
  return m ? Number(m[1]) : -1;
}

// --- verde de partida -------------------------------------------------------
const base = falhasDe(rodarSuite());
if (base !== 0) {
  console.error("A BASE JÁ ESTÁ VERMELHA (" + base + " falhas). Mutação não prova nada aqui.");
  process.exit(1);
}
console.log("base verde (0 falhas) · " + MUTACOES.length + " mutações\n");

const resultados = [];
for (const mut of MUTACOES) {
  const antes = lerNormalizado(ALVO);
  const partes = antes.texto.split(mut.de);
  if (partes.length !== 2) {
    console.error("MUT-" + mut.n + " ANCORA AMBIGUA/AUSENTE (" + (partes.length - 1) + " ocorrencias): " + mut.nome);
    process.exit(1);
  }
  const mutado = partes[0] + mut.para + partes[1];
  if (mutado === antes.texto) {
    console.error("MUT-" + mut.n + " NAO ALTEROU O ARQUIVO: " + mut.nome);
    process.exit(1);
  }
  const delta = mutado.length - antes.texto.length;
  fs.writeFileSync(ALVO, antes.crlf ? mutado.split("\n").join("\r\n") : mutado, "utf8");
  let falhas = -1;
  try {
    falhas = falhasDe(rodarSuite());
  } finally {
    fs.writeFileSync(ALVO, antes.bruto, "utf8"); // reverte SEMPRE
  }
  const pego = falhas > 0;
  resultados.push({ n: mut.n, nome: mut.nome, falhas, pego, delta });
  console.log(
    (pego ? "PEGA   " : "ESCAPOU") + " MUT-" + String(mut.n).padStart(2, "0") +
    "  falhas=" + String(falhas).padStart(3) +
    "  bytes=" + (delta >= 0 ? "+" : "") + delta +
    "  " + mut.nome
  );
}

// --- verde de chegada: a reversão precisa ter funcionado --------------------
const fim = falhasDe(rodarSuite());
console.log("\nverde de chegada: " + fim + " falhas");
const escaparam = resultados.filter((r) => !r.pego);
console.log("detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const r of escaparam) console.log("  ESCAPOU MUT-" + r.n + ": " + r.nome);
if (fim !== 0 || escaparam.length > 0) process.exit(1);
