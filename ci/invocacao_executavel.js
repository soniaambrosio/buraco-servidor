// ci/invocacao_executavel.js — A DIFERENÇA ENTRE ESTAR ESCRITO E SER EXECUTADO
// (OS 54-C5, §2).
//
// ===========================================================================
// O ESCAPE QUE A OS 54-R4 ENCONTROU
// ===========================================================================
//
// Até a OS 54-C4, `ci/auditabilidade.js` respondia "o workflow chama o juiz?"
// com uma expressão regular aplicada ao CORPO INTEIRO do passo:
//
//     /node\s+ci\/portao_do_ci\.js\s+"\$EVIDENCIA/.test(passo.corpo)
//
// Isso mede PRESENÇA DE TEXTO, e presença de texto não é execução. Trocar
//
//     run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"
//
// por
//
//     run: echo node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"
//
// mantinha o texto e desligava o juiz — e o guardião aprovava. Medido nesta
// árvore antes da correção: as QUATRO invocações obrigatórias (juiz, guardião,
// inventário e autoridade do artefato) caíam pelo mesmo caminho, e o veredito
// continuava VERDE.
//
// As campanhas anteriores não viram porque sabotavam por REMOÇÃO: apagar o
// passo quebra a âncora e o texto some junto. Detecção por quebra acidental de
// âncora não é autoridade — é sorte com nome de prova.
//
// ===========================================================================
// O QUE ESTE ARQUIVO FAZ
// ===========================================================================
//
// Ele lê o passo do workflow como o runner leria: extrai o escalar de `run:`
// (simples ou em bloco), reconstrói as LINHAS LÓGICAS do script (continuação
// com `\`), joga fora o que é DADO e não comando (corpo de heredoc, comentário
// de shell), quebra em COMANDOS pelos separadores reais (`;`, `&&`, `||`, `|`,
// `&`, quebra de linha, agrupamentos) e tokeniza cada comando em PALAVRAS com
// as aspas resolvidas.
//
// Só então pergunta: **existe um comando ALCANÇÁVEL cuja CABEÇA é o binário
// exigido e que recebe o alvo exigido como PALAVRA PRÓPRIA?**
//
// Com isso caem, por construção e não por lista:
//
//   * `echo node …` e `printf … node …` — a cabeça é `echo`/`printf`;
//   * `true`, `:` e equivalentes — a cabeça não é o binário;
//   * comando comentado — comentário de shell não vira comando;
//   * texto dentro de string — o valor da palavra é a string inteira, e uma
//     string inteira nunca é igual ao caminho do alvo;
//   * heredoc contendo a chamada — corpo de heredoc é dado, não comando;
//   * `CMD="node ci/x.js"` — atribuição não é comando com cabeça;
//   * chamada depois de `exit`/`return` incondicional — inalcançável;
//   * ocorrência em passo diferente do canônico — a busca é ANCORADA no `name:`;
//   * ocorrência meramente textual dentro de comando composto — o comando que a
//     carrega tem outra cabeça.
//
// ===========================================================================
// O QUE ELE NÃO É, DITO EM VOZ ALTA
// ===========================================================================
//
// Não é um shell. Não expande variável, não resolve alias, não segue `source`,
// não sabe o que uma função definida no próprio script faz. E isso não é uma
// lacuna escondida — é a direção do erro: **tudo o que ele não consegue
// classificar como invocação executável é RECUSADO**. Uma forma legítima que
// ele não entenda deixa o portão VERMELHO e pede uma linha de contrato; nunca
// deixa passar por não ter entendido. Fail-closed é a única leitura que serve
// para um portão.
//
// Também não decide o que os comandos fazem: `ci/portao_do_ci.js` continua
// julgando a evidência, `ci/inventario_de_execucao.js` continua contando por
// origem e `ci/artefato.js` continua decidindo o que é implantável. Este
// arquivo responde uma pergunta só, e é a pergunta que faltava: **isso vai
// RODAR?**

"use strict";

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BARRA = String.fromCharCode(92);

// ---------------------------------------------------------------------------
// 1. O WORKFLOW — passos, atributos e o escalar de `run:`
// ---------------------------------------------------------------------------

/** Remove um comentário de fim de linha em contexto YAML de FLUXO.
 *
 *  Em YAML, `#` só abre comentário quando está no começo da linha ou precedido
 *  de espaço em branco, e nunca dentro de aspas. Recortar sem essa regra come
 *  `run: echo "a#b"`, e um recorte que come o comando mede outra coisa. */
function semComentarioDeFluxo(texto) {
  let aspa = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspa) {
      if (c === BARRA && aspa === '"') { i++; continue; }
      if (c === aspa) aspa = null;
      continue;
    }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(texto[i - 1]))) return texto.slice(0, i);
  }
  return texto;
}

const recuo = (linha) => (/^[ ]*/.exec(linha) || [""])[0].length;

/** Desembrulha um escalar YAML de fluxo — e SÓ quando ele é de fato um escalar
 *  entre aspas.
 *
 *  Recortar aspa inicial e final por conta própria come o comando: o `run:` do
 *  juiz TERMINA em aspas (`… \"$EVIDENCIA/exit.txt\"`) sem começar com elas, e
 *  um recorte cego devolveria um script com aspas desemparelhadas. Custou uma
 *  leitura descobrir; a trava é exigir os dois lados. */
function escalarDeFluxo(bruto) {
  const texto = String(bruto).trim();
  for (const aspa of ['"', "'"]) {
    if (texto.length >= 2 && texto[0] === aspa && texto[texto.length - 1] === aspa) {
      const miolo = texto.slice(1, -1);
      if (!miolo.includes(aspa)) return miolo;
    }
  }
  return texto;
}

/** Os passos do job, com o `run:` extraído DE VERDADE.
 *
 *  A leitura é feita sobre o YAML BRUTO — sem recorte global de comentários —
 *  porque `#` dentro de um bloco `run:` é comentário de SHELL, e tratá-lo como
 *  comentário de YAML confundiria as duas gramáticas. Comentário de YAML é
 *  ignorado aqui, na estrutura; comentário de shell é tratado adiante, no
 *  lugar dele.
 *
 *  Devolve `{ nome, recuo, atributos, run }`, onde `run` é
 *  `{ presente, tipo: "fluxo"|"bloco", script }`. */
function passosDoWorkflow(bruto) {
  const linhas = String(bruto).split(CR + NL).join(NL).split(NL);
  const passos = [];
  let atual = null;
  let bloco = null; // { recuoMinimo, destino: "run"|null, linhas: [] }

  const fecharBloco = () => {
    if (!bloco) return;
    if (bloco.destino === "run" && atual) {
      const corte = bloco.recuoMinimo;
      atual.run = {
        presente: true,
        tipo: "bloco",
        script: bloco.linhas.map((l) => (l.length >= corte ? l.slice(corte) : l.trim())).join(NL),
      };
    }
    bloco = null;
  };

  for (const linha of linhas) {
    if (bloco) {
      // Linha vazia pertence ao bloco; linha menos recuada o encerra.
      if (linha.trim() === "" || recuo(linha) >= bloco.recuoMinimo) {
        bloco.linhas.push(linha);
        continue;
      }
      fecharBloco();
    }

    if (/^\s*#/.test(linha) || linha.trim() === "") continue;

    const inicio = /^(\s{4,})-\s+name:\s*(.*)$/.exec(linha);
    if (inicio) {
      if (atual) passos.push(atual);
      atual = {
        nome: semComentarioDeFluxo(inicio[2]).trim().replace(/^["']|["']$/g, ""),
        recuo: inicio[1].length,
        atributos: {},
        run: { presente: false, tipo: null, script: "" },
        corpo: linha + NL,
      };
      continue;
    }
    if (!atual) continue;

    // Um passo termina quando aparece algo menos recuado do que os atributos
    // dele. `- name:` já foi tratado acima.
    if (recuo(linha) <= atual.recuo && !/^\s*-\s/.test(linha)) {
      passos.push(atual);
      atual = null;
      continue;
    }

    atual.corpo += linha + NL;

    const atributo = /^(\s+)([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(linha);
    if (!atributo) continue;
    const chave = atributo[2];
    const resto = semComentarioDeFluxo(atributo[3]).trim();

    if (chave === "run") {
      if (/^[|>][-+]?[0-9]*$/.test(resto)) {
        // O recuo real do bloco é o da PRIMEIRA linha não vazia, e é ajustado
        // depois, quando todas elas já foram vistas.
        bloco = { recuoMinimo: atributo[1].length + 1, destino: "run", linhas: [] };
      } else {
        atual.run = { presente: true, tipo: "fluxo", script: escalarDeFluxo(resto) };
      }
      continue;
    }
    if (atual.atributos[chave] === undefined) atual.atributos[chave] = resto;
  }
  fecharBloco();
  if (atual) passos.push(atual);

  // Ajuste do recuo dos blocos: em YAML o recuo do bloco é o da PRIMEIRA linha
  // não vazia, e não `chave + 1`. Sem isto, um bloco recuado em dez espaços
  // sairia com dez espaços de sobra em toda linha — e um `echo` no começo da
  // linha viraria argumento de nada.
  for (const p of passos) {
    if (p.run.tipo !== "bloco") continue;
    const linhasBloco = p.run.script.split(NL);
    const naoVazias = linhasBloco.filter((l) => l.trim() !== "");
    const corte = naoVazias.length ? Math.min(...naoVazias.map(recuo)) : 0;
    p.run.script = linhasBloco.map((l) => (l.length >= corte ? l.slice(corte) : l.trim())).join(NL);
  }
  return passos;
}

function passoChamado(passos, nome) {
  return passos.find((p) => p.nome === nome) || null;
}

// ---------------------------------------------------------------------------
// 2. O SCRIPT — linhas lógicas, heredocs e comentários de shell
// ---------------------------------------------------------------------------

/** Devolve o terminador do primeiro heredoc aberto na linha, ou `null`.
 *
 *  Corpo de heredoc é DADO. Uma chamada escrita lá dentro é texto que o shell
 *  entrega a outro programa pela entrada padrão — nunca um comando. */
function heredocDe(linha) {
  let aspa = null;
  for (let i = 0; i < linha.length - 1; i++) {
    const c = linha[i];
    if (aspa) {
      if (c === BARRA && aspa === '"') { i++; continue; }
      if (c === aspa) aspa = null;
      continue;
    }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (c === "<" && linha[i + 1] === "<") {
      const m = /^<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(linha.slice(i));
      if (m) return { terminador: m[2], recuado: linha.slice(i, i + 3).indexOf("-") >= 0 };
      // `<<<` é here-string: dado numa palavra só, e não abre corpo.
      if (linha[i + 2] === "<") { i += 2; continue; }
    }
  }
  return null;
}

/** Recorta comentário de shell: `#` que ABRE PALAVRA e está fora de aspas. */
function semComentarioDeShell(linha) {
  let aspa = null;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspa) {
      if (c === BARRA && aspa !== "'") { i++; continue; }
      if (c === aspa) aspa = null;
      continue;
    }
    if (c === BARRA) { i++; continue; }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (c === "#" && (i === 0 || /\s|[;&|(]/.test(linha[i - 1]))) return linha.slice(0, i);
  }
  return linha;
}

/** As linhas LÓGICAS do script: continuações unidas, heredocs descartados,
 *  comentários de shell recortados. */
function linhasLogicas(script) {
  const fisicas = String(script).split(CR + NL).join(NL).split(NL);
  const saida = [];
  let acumulada = null;

  for (let i = 0; i < fisicas.length; i++) {
    const linha = fisicas[i];
    acumulada = acumulada === null ? linha : acumulada + " " + linha.replace(/^\s+/, "");

    // Continuação: barra no fim, e não escapada.
    const semFinal = acumulada.replace(/\s+$/, "");
    let barras = 0;
    for (let k = semFinal.length - 1; k >= 0 && semFinal[k] === BARRA; k--) barras++;
    if (barras % 2 === 1) {
      acumulada = semFinal.slice(0, semFinal.length - 1);
      continue;
    }

    const logica = semComentarioDeShell(acumulada);
    acumulada = null;

    const aqui = heredocDe(logica);
    if (aqui) {
      // Consome o corpo até o terminador, e o descarta inteiro.
      let j = i + 1;
      for (; j < fisicas.length; j++) {
        const alvo = aqui.recuado ? fisicas[j].replace(/^\t+/, "") : fisicas[j];
        if (alvo.trim() === aqui.terminador) break;
      }
      i = j;
    }

    if (logica.trim() !== "") saida.push(logica);
  }
  if (acumulada !== null && semComentarioDeShell(acumulada).trim() !== "") {
    saida.push(semComentarioDeShell(acumulada));
  }
  return saida;
}

// ---------------------------------------------------------------------------
// 3. OS COMANDOS — separadores reais e palavras com aspas resolvidas
// ---------------------------------------------------------------------------

const SEPARADORES = Object.freeze(["&&", "||", ";;", ";", "|", "&", "(", ")", "{", "}"]);

/** Palavras de um pedaço de comando, com aspas resolvidas.
 *
 *  `citada` diz se a palavra veio inteira de dentro de aspas — não é usado para
 *  aceitar nem recusar por si só; o que decide é o VALOR. Uma string como
 *  `"node ci/x.js"` vira UMA palavra cujo valor é `node ci/x.js`, que não é
 *  igual a `ci/x.js` nem a `node`. É assim que texto dentro de string deixa de
 *  parecer chamada. */
function palavrasDe(pedaco) {
  const palavras = [];
  let atual = null;
  let aspa = null;
  const empurrar = (c) => { atual = (atual === null ? "" : atual) + c; };

  for (let i = 0; i < pedaco.length; i++) {
    const c = pedaco[i];
    if (aspa) {
      if (c === BARRA && aspa === '"' && i + 1 < pedaco.length) { empurrar(pedaco[++i]); continue; }
      if (c === aspa) { aspa = null; if (atual === null) atual = ""; continue; }
      empurrar(c);
      continue;
    }
    if (c === BARRA && i + 1 < pedaco.length) { empurrar(pedaco[++i]); continue; }
    if (c === '"' || c === "'") { aspa = c; if (atual === null) atual = ""; continue; }
    if (/\s/.test(c)) {
      if (atual !== null) { palavras.push(atual); atual = null; }
      continue;
    }
    empurrar(c);
  }
  if (atual !== null) palavras.push(atual);
  return palavras;
}

/** Quebra uma linha lógica nos separadores REAIS, fora de aspas. Devolve
 *  `[{ texto, separadorAnterior }]`. */
function pedacosDe(logica) {
  const pedacos = [];
  let atual = "";
  let anterior = null;
  let aspa = null;

  const fechar = (sep) => {
    pedacos.push({ texto: atual, separadorAnterior: anterior });
    anterior = sep;
    atual = "";
  };

  for (let i = 0; i < logica.length; i++) {
    const c = logica[i];
    if (aspa) {
      atual += c;
      if (c === BARRA && aspa === '"' && i + 1 < logica.length) { atual += logica[++i]; }
      else if (c === aspa) aspa = null;
      continue;
    }
    if (c === BARRA && i + 1 < logica.length) { atual += c + logica[++i]; continue; }
    if (c === '"' || c === "'") { aspa = c; atual += c; continue; }

    // `&` de REDIRECIONAMENTO (`2>&1`, `>&2`, `&>arquivo`) não é separador, e
    // tratá-lo como separador partia o passo das provas oficiais no meio —
    // `npm test > "$EVIDENCIA/npm-test.txt" 2>&1` virava dois comandos, e o
    // segundo era lixo. Erro de leitura vira erro de veredito.
    if (c === "&" && logica[i + 1] !== "&") {
      const anteriorReal = atual.replace(/s+$/, "").slice(-1);
      if (anteriorReal === ">" || anteriorReal === "<" || logica[i + 1] === ">") { atual += c; continue; }
    }
    const dois = logica.slice(i, i + 2);
    if (SEPARADORES.includes(dois)) { fechar(dois); i++; continue; }
    if (SEPARADORES.includes(c)) { fechar(c); continue; }
    atual += c;
  }
  pedacos.push({ texto: atual, separadorAnterior: anterior });
  return pedacos.filter((p) => p.texto.trim() !== "");
}

/** Palavras-chave que ABREM bloco, e as que fecham. Servem só para saber a
 *  profundidade — um `exit` dentro de um `if` não torna o resto inalcançável. */
const ABREM = Object.freeze(["if", "for", "while", "until", "case", "select"]);
const FECHAM = Object.freeze(["fi", "done", "esac"]);
/** Palavras-chave que precedem um comando de verdade na MESMA palavra inicial. */
const PREFIXOS = Object.freeze(["then", "else", "elif", "do", "in", "!", "time"]);

/** Redirecionamentos de saída: `>`, `>>`, `2>&1`, `>&2`… Não são palavras do
 *  comando e não podem ser confundidas com argumentos. */
const ehRedirecionamento = (p) => /^[0-9]*(?:>>?|<|&>)&?[0-9]*$/.test(p);

/** O redirecionamento de saída que um comando faz para um alvo, ou `null`.
 *  Devolve o OPERADOR (`>` ou `>>`), que é o que distingue anexar de truncar. */
function redirecionamentoPara(comando, alvo) {
  const p = comando.palavras;
  for (let i = 0; i < p.length - 1; i++) {
    if ((p[i] === ">" || p[i] === ">>") && p[i + 1] === alvo) return p[i];
  }
  return null;
}

/** Os comandos de um script, na ordem, com alcançabilidade. */
function comandosDe(script) {
  const comandos = [];
  let profundidade = 0;
  let alcancavel = true;

  for (const logica of linhasLogicas(script)) {
    for (const pedaco of pedacosDe(logica)) {
      let palavras = palavrasDe(pedaco.texto);
      if (palavras.length === 0) continue;

      // Palavra-chave de fechamento: sai um nível e não é comando.
      while (palavras.length && FECHAM.includes(palavras[0])) { profundidade = Math.max(0, profundidade - 1); palavras = palavras.slice(1); }
      if (palavras.length === 0) continue;

      let abriu = 0;
      while (palavras.length && (ABREM.includes(palavras[0]) || PREFIXOS.includes(palavras[0]))) {
        if (ABREM.includes(palavras[0])) abriu++;
        palavras = palavras.slice(1);
      }
      if (palavras.length === 0) { profundidade += abriu; continue; }

      // Atribuições que precedem o comando (`VAR=x cmd`). Se SÓ houver
      // atribuições, não há comando nenhum — e é por aí que
      // `CMD="node ci/x.js"` deixa de parecer chamada.
      let i = 0;
      while (i < palavras.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(palavras[i])) i++;
      const soAtribuicoes = i >= palavras.length;

      const argumentos = palavras.slice(i + 1).filter((p) => !ehRedirecionamento(p));
      const comando = {
        cabeca: soAtribuicoes ? null : palavras[i],
        argumentos,
        palavras,
        alcancavel,
        profundidade: profundidade + abriu,
        separadorAnterior: pedaco.separadorAnterior,
      };
      comandos.push(comando);
      profundidade += abriu;

      // Saída antecipada INCONDICIONAL: no nível de cima, e não pendurada num
      // `&&`/`||` (que a torna condicional). O que vier depois não roda.
      const encadeado = pedaco.separadorAnterior === "&&" || pedaco.separadorAnterior === "||";
      if (
        comando.profundidade === 0 && !encadeado &&
        (comando.cabeca === "exit" || comando.cabeca === "return")
      ) {
        alcancavel = false;
      }
    }
  }
  return comandos;
}

// ---------------------------------------------------------------------------
// 4. O VEREDITO
// ---------------------------------------------------------------------------

const semPrefixo = (caminho) => String(caminho).replace(/^\.\//, "");

/** Existe um comando ALCANÇÁVEL cuja cabeça é `binario` e que recebe `alvo`
 *  como palavra própria, com os argumentos exigidos e sem os proibidos?
 *
 *  Devolve `{ ok, motivo, comando }`. `motivo` é escrito para quem vai ler o
 *  log do CI às três da manhã: ele nomeia a forma encontrada, e não só a
 *  ausência. */
function invocacaoAutoritativa(script, exigencia) {
  const e = exigencia || {};
  const binario = e.binario || "node";
  const alvo = semPrefixo(e.alvo);
  const exige = e.exige || [];
  const proibe = e.proibe || [];

  const comandos = comandosDe(script);
  const candidatos = comandos.filter((c) => c.argumentos.some((a) => semPrefixo(a) === alvo));

  if (candidatos.length === 0) {
    const mencionado = comandos.some((c) => c.palavras.some((p) => p.includes(alvo)));
    return {
      ok: false,
      motivo: mencionado
        ? "o alvo `" + alvo + "` aparece no passo, mas nunca como PALAVRA de um comando — " +
          "está dentro de uma string, de uma atribuição ou de um corpo de heredoc, e nada disso executa"
        : "nenhum comando do passo recebe `" + alvo + "` como argumento",
    };
  }

  const executaveis = candidatos.filter((c) => c.cabeca === binario);
  if (executaveis.length === 0) {
    const cabecas = [...new Set(candidatos.map((c) => c.cabeca || "(só atribuição)"))];
    return {
      ok: false,
      motivo: "o alvo `" + alvo + "` é passado para `" + cabecas.join("`, `") +
        "`, e não executado por `" + binario + "` — imprimir o nome de um comando não é rodá-lo",
    };
  }

  const vivos = executaveis.filter((c) => c.alcancavel);
  if (vivos.length === 0) {
    return {
      ok: false,
      motivo: "a invocação de `" + alvo + "` vem DEPOIS de uma saída antecipada incondicional " +
        "(`exit`/`return`) no mesmo script — escrita, e inalcançável",
    };
  }

  for (const proibido of proibe) {
    if (vivos.every((c) => c.argumentos.includes(proibido))) {
      return {
        ok: false,
        motivo: "a única invocação de `" + alvo + "` carrega `" + proibido +
          "`, que é de outro papel — este passo deixou de fazer o que lhe cabe",
      };
    }
  }

  const completos = vivos.filter(
    (c) => exige.every((a) => c.argumentos.includes(a)) && !proibe.some((a) => c.argumentos.includes(a))
  );
  if (completos.length === 0) {
    const faltando = exige.filter((a) => !vivos.some((c) => c.argumentos.includes(a)));
    return {
      ok: false,
      motivo: "`" + binario + " " + alvo + "` é executado, mas sem " +
        (faltando.length ? "os argumentos obrigatórios " + faltando.map((a) => "`" + a + "`").join(", ")
                         : "a forma canônica exigida"),
    };
  }

  return { ok: true, motivo: null, comando: completos[0] };
}

/** A mesma pergunta, ancorada no PASSO CANÔNICO. Um passo com outro nome não
 *  serve: `name:` é parte do contrato, e mover a chamada para outro lugar é
 *  mudar quando ela roda. */
function conferirInvocacaoNoPasso(passos, exigencia) {
  const passo = passoChamado(passos, exigencia.passo);
  if (!passo) {
    return [
      "PASSO AUSENTE: o workflow não tem passo chamado `" + exigencia.passo + "`, que é onde " +
      exigencia.oQue + " roda — passo que não existe não executa nada.",
    ];
  }
  const reprovacoes = [];
  if (!passo.run.presente) {
    reprovacoes.push(
      "PASSO SEM `run:`: o passo `" + passo.nome + "` deixou de ter comando — " + exigencia.oQue +
      " não é executado por um passo que não roda nada."
    );
    return reprovacoes;
  }
  const veredito = invocacaoAutoritativa(passo.run.script, exigencia);
  if (!veredito.ok) {
    reprovacoes.push(
      "INVOCAÇÃO NÃO EXECUTÁVEL: o passo `" + passo.nome + "` deveria executar " + exigencia.oQue +
      ", e " + veredito.motivo + "."
    );
  }
  if (passo.atributos["if"] !== undefined) {
    reprovacoes.push(
      "INVOCAÇÃO CONDICIONADA: o passo `" + passo.nome + "`, que executa " + exigencia.oQue +
      ", ganhou um `if:` — condicionar é desligar sem apagar."
    );
  }
  if (passo.atributos["continue-on-error"] !== undefined) {
    reprovacoes.push(
      "INVOCAÇÃO TOLERADA: o passo `" + passo.nome + "` tem `continue-on-error` — " +
      "o job deixaria de depender do resultado."
    );
  }
  return reprovacoes;
}

module.exports = {
  semComentarioDeFluxo, semComentarioDeShell, heredocDe, escalarDeFluxo,
  passosDoWorkflow, passoChamado,
  linhasLogicas, palavrasDe, pedacosDe, comandosDe,
  ehRedirecionamento, redirecionamentoPara,
  invocacaoAutoritativa, conferirInvocacaoNoPasso,
};
