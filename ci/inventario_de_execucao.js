// ci/inventario_de_execucao.js — A AUTORIDADE POR EXECUÇÃO (OS 54-C4, §5).
//
// ===========================================================================
// O QUE ESTE ARQUIVO SUBSTITUI, E POR QUÊ
// ===========================================================================
//
// Até a OS 54-C1, "quantos casos esta suíte tem" era respondido por
// `contarCasos()`: um `match(/\btest\s*\(/g)` sobre o FONTE. A OS 54-R2 mostrou
// os três buracos disso, e nenhum é teórico:
//
//   * conta `regex.test(` como se fosse caso — `gate_vip` declara 58 e executa
//     49, e a diferença é chamada de expressão regular;
//   * conta ocorrências dentro de COMENTÁRIO — apagar o bloco inteiro e repor
//     `// test( test( test(...` satisfazia o piso sem repor um caso;
//   * não sabe DE ONDE veio o caso — um arquivo-isca pode emprestar casos para
//     o número de outro.
//
// Contagem textual mede a prosa. Aqui a quantidade vem de EXECUÇÃO: o stream de
// eventos do `node:test` (`run()`), lendo `data.file` — o campo de origem que o
// próprio executor emite. Caso apagado não emite evento; caso comentado não
// emite evento; caso movido emite com outra origem. Não há como satisfazer isto
// escrevendo texto.
//
// [OS 54-C4] A CONTAGEM TEXTUAL CONTINUA NO CENSO, E CONTINUA SENDO HEURÍSTICA.
// Ela não foi apagada nesta composição: o piso por arquivo de
// `test/censo_de_suites.js` já existia na base homologada, e tirá-lo seria
// devolver uma proteção em troca de outra. O que mudou é a hierarquia — o
// texto vira piso barato que roda no `pretest`, e a AUTORIDADE de quantidade é
// este arquivo, que roda como passo próprio do CI. Defesa em profundidade só é
// defesa quando a camada frouxa não decide sozinha.
//
// TRÊS PERGUNTAS, e as três precisam de execução:
//
//   1. cada suíte obrigatória EXECUTOU? (arquivo ausente do stream = reprovado)
//   2. quantos casos ela APROVOU, e é o bastante? (piso por execução)
//   3. os casos NOMINAIS obrigatórios rodaram e passaram? (nome + origem)
//
// A terceira é a que sobrevive a todo piso rebaixado: `CI-18`, `CI-19` e
// `CI-19b` têm de existir como caso EXECUTÁVEL, no arquivo certo, aprovado —
// e, [OS 54-C4], os casos da AUTORIDADE DO ARTEFATO em
// `artefato_unico.test.js` também. Piso é número, e número se rebaixa; nome
// exigido por origem não.
//
// O QUE ELE NÃO É. Não julga evidência — isso é `ci/portao_do_ci.js`. Não lê o
// workflow — isso é `ci/auditabilidade.js`. Não decide o que é implantável —
// isso é `ci/artefato.js`, a autoridade que a OS 52-C4 entregou. Não é um
// segundo comando oficial: o
// alvo continua sendo `npm test` com o glob, e este inventário roda ao lado,
// como passo próprio do CI, para responder o que o rodapé agregado não sabe
// dizer — de qual arquivo veio cada caso.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { run } = require("node:test");

const { MINIMO_EXECUTADO, NOMES_OBRIGATORIOS, conferirPisosDeclarados } = require("./pisos_autorizados.js");

/** Executa as suítes obrigatórias e devolve o mapa origem -> casos aprovados,
 *  mais os nomes vistos por arquivo. */
function inventariar(opcoes) {
  const o = opcoes || {};
  const raiz = o.raiz || path.join(__dirname, "..");
  const arquivos = (o.arquivos || Object.keys(MINIMO_EXECUTADO)).map((f) => path.join(raiz, "test", f));

  const faltando = arquivos.filter((f) => !fs.existsSync(f));
  if (faltando.length > 0) {
    return Promise.resolve({
      erroFatal:
        "SUÍTE OBRIGATÓRIA AUSENTE DO DISCO: " + faltando.map((f) => path.basename(f)).join(", ") +
        " — não há o que executar, e ausência nunca é aprovação.",
      porArquivo: new Map(),
    });
  }

  return new Promise((resolve, reject) => {
    const porArquivo = new Map();
    const semOrigem = [];
    const falhas = [];

    const anotar = (mapa, chave) => {
      if (!mapa.has(chave)) mapa.set(chave, { casos: 0, nomes: [] });
      return mapa.get(chave);
    };

    const stream = run({ files: arquivos, concurrency: true, timeout: o.timeout || 600000 });

    stream.on("test:pass", (d) => {
      if (!d.file) {
        semOrigem.push(d.name);
        return;
      }
      const registro = anotar(porArquivo, path.basename(d.file));
      registro.casos += 1;
      registro.nomes.push(d.name);
    });
    stream.on("test:fail", (d) => {
      falhas.push((d.file ? path.basename(d.file) + " :: " : "") + d.name);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve({ porArquivo, semOrigem, falhas }));
    stream.resume();
  });
}

/** O veredito sobre um inventário já colhido. Separado da execução de
 *  propósito: assim a suíte própria pode exercitá-lo com inventários forjados,
 *  sem rodar a bateria inteira — e um corpo esvaziado aqui é pego lá. */
function julgarInventario(inventario, censo) {
  const reprovacoes = [];

  if (inventario.erroFatal) return [inventario.erroFatal];

  if (inventario.falhas && inventario.falhas.length > 0) {
    reprovacoes.push(
      "SUÍTE OBRIGATÓRIA VERMELHA no inventário: " + inventario.falhas.slice(0, 5).join(" | ") +
      (inventario.falhas.length > 5 ? " (+" + (inventario.falhas.length - 5) + ")" : "")
    );
  }

  if (inventario.semOrigem && inventario.semOrigem.length > 0) {
    reprovacoes.push(
      "CASO SEM ORIGEM: " + inventario.semOrigem.length + " evento(s) chegaram sem `file` — " +
      "sem origem não se sabe qual arquivo executou o quê, e o inventário perde o sentido."
    );
  }

  for (const [arquivo, piso] of Object.entries(MINIMO_EXECUTADO)) {
    const registro = inventario.porArquivo.get(arquivo);
    if (!registro) {
      reprovacoes.push(
        "SUÍTE NÃO EXECUTOU: `" + arquivo + "` não aparece no stream de execução — arquivo removido, " +
        "renomeado para fora do glob ou que morreu antes do primeiro caso."
      );
      continue;
    }
    if (registro.casos < piso) {
      reprovacoes.push(
        "CASOS EXECUTADOS ABAIXO DO PISO: `" + arquivo + "` aprovou " + registro.casos +
        ", piso " + piso + " — caso apagado, trivializado a ponto de sumir, ou movido para outro arquivo."
      );
    }
  }

  for (const [arquivo, nomes] of Object.entries(NOMES_OBRIGATORIOS)) {
    const registro = inventario.porArquivo.get(arquivo);
    for (const exigido of nomes) {
      const encontrado =
        registro && registro.nomes.some((n) => n === exigido || n.startsWith(exigido + ":"));
      if (!encontrado) {
        reprovacoes.push(
          "CASO NOMINAL AUSENTE: `" + exigido + "` não executou e passou em `" + arquivo + "` — " +
          "nome em comentário não roda, corpo apagado não emite evento, e caso movido muda de origem."
        );
      }
    }
  }

  if (censo !== undefined) {
    for (const motivo of conferirPisosDeclarados(censo)) reprovacoes.push(motivo);
  }

  return reprovacoes;
}

/** `--arquivos a,b` restringe a bateria; `--json` imprime o inventário cru.
 *
 *  Existem para a suíte própria: `run()` aninhado dentro de um processo que já
 *  é `node --test` não emite evento nenhum — medido, não suposto —, então a
 *  única forma honesta de provar que a atribuição por origem funciona é chamar
 *  este arquivo como PROCESSO, que é como o CI o chama. */
function opcoesDaLinha(argv) {
  const arquivos = [];
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") json = true;
    else if (argv[i] === "--arquivos") arquivos.push(...String(argv[++i] || "").split(",").filter(Boolean));
  }
  return { arquivos: arquivos.length > 0 ? arquivos : undefined, json };
}

async function principal() {
  const raiz = path.join(__dirname, "..");
  const opcoes = opcoesDaLinha(process.argv.slice(2));

  if (opcoes.json) {
    const inv = await inventariar({ raiz, arquivos: opcoes.arquivos });
    process.stdout.write(
      JSON.stringify({
        erroFatal: inv.erroFatal || null,
        semOrigem: inv.semOrigem || [],
        falhas: inv.falhas || [],
        porArquivo: Object.fromEntries([...(inv.porArquivo || new Map())].map(([k, v]) => [k, v])),
      }) + "\n"
    );
    return 0;
  }

  let censo;
  try {
    censo = require(path.join(raiz, "test", "censo_de_suites.js")).OBRIGATORIAS;
  } catch (erro) {
    process.stdout.write("INVENTÁRIO REPROVADO — o censo não pôde ser lido: " + ((erro && erro.message) || erro) + "\n");
    return 1;
  }

  const inventario = await inventariar({ raiz });
  const reprovacoes = julgarInventario(inventario, censo);

  if (!inventario.erroFatal) {
    const linhas = [...inventario.porArquivo.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([arquivo, r]) => "  " + String(r.casos).padStart(4) + "  " + arquivo);
    process.stdout.write("casos APROVADOS por arquivo de origem (execução real):\n" + linhas.join("\n") + "\n");
  }

  if (reprovacoes.length === 0) {
    process.stdout.write("INVENTÁRIO VERDE — toda suíte obrigatória executou, nenhum piso furado, casos nominais presentes.\n");
    return 0;
  }
  process.stdout.write("INVENTÁRIO REPROVADO — " + reprovacoes.length + " motivo(s):\n");
  for (const m of reprovacoes) process.stdout.write("  * " + m + "\n");
  return 1;
}

module.exports = { inventariar, julgarInventario };

if (require.main === module) {
  principal().then(
    (codigo) => process.exit(codigo),
    (erro) => {
      process.stderr.write("INVENTÁRIO ABORTOU: " + ((erro && erro.stack) || erro) + "\n");
      process.exit(1);
    }
  );
}
