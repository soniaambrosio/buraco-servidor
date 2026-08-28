// test/piso_ancorado.js — O PISO ANCORADO NO COMMIT ANTERIOR (OS 52-C3, §C3-07).
//
// ===========================================================================
// O ATAQUE QUE ESTE ARQUIVO FECHA
// ===========================================================================
//
// A OS 52-R2 mostrou o ENCOLHIMENTO COORDENADO: remover uma suíte, tirar a
// entrada dela do censo, tirá-la do alcance obrigatório, baixar o limiar de
// suítes alcançadas e realinhar `ci/piso_do_portao.json` para o novo total.
// Seis edições, todas plausíveis, e o pipeline inteiro fica verde — porque
// TODOS os números que decidem moram dentro do conjunto que o ataque edita.
//
// O `CASOS_MEDIDOS_NA_BASE` de `test/ci_obrigatorio.test.js` era a defesa, e
// ela caiu junto: a suíte removida no ataque ERA a que guardava o piso do piso.
// Autoridade que mora dentro do alvo não é autoridade — é um número a mais
// para realinhar.
//
// ===========================================================================
// A SAÍDA: A AUTORIDADE É O COMMIT ANTERIOR
// ===========================================================================
//
// O piso passa a ser comparado com o piso do PRÓPRIO REPOSITÓRIO NO PASSADO,
// lido do objeto de commit. Um commit é imutável: não existe edição na árvore
// de trabalho que baixe o que `HEAD^` declara. Para o ataque coordenado passar
// seria preciso REESCREVER HISTÓRIA — que não é recarimbo silencioso, é
// force-push, e aparece.
//
// E não é uma terceira fonte paralela: é o MESMO `ci/piso_do_portao.json`, o
// MESMO `test/censo_de_suites.js` e a MESMA lista de suítes, lidos de onde não
// dá para editá-los. A regra é uma só, e é de MONOTONICIDADE:
//
//     nada do que já foi medido pode diminuir.
//
// SUBIR É LIVRE, DESCER É VERMELHO — que é exatamente a disciplina que o piso
// sempre declarou e nunca conseguiu sustentar sozinho.
//
// ===========================================================================
// O LIMITE, DITO EM VOZ ALTA
// ===========================================================================
//
// Quem apagar ESTE arquivo e as quatro amarrações dele (o censo, a guarda do
// portão, a suíte do CI e o juiz) volta ao estado anterior. Isso é uma décima
// primeira edição, em quatro arquivos que se cobram mutuamente, e não é o
// ataque que a R2 descreveu — é outro, maior e mais visível. Nenhum mecanismo
// dentro de um repositório escapa dessa circularidade: a última guarda é sempre
// removível por quem tem escrita. O que se pode fazer, e o que este arquivo
// faz, é tornar cada passo do encolhimento vermelho ANTES do seguinte.
// ===========================================================================

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const assert = require("node:assert/strict");

// [OS 54-C7] O MEDIDOR do conteúdo material vem da fonte canônica dos pisos,
// e não de uma cópia local: duas medidas do mesmo corpo seriam duas verdades,
// e a que ficasse para trás viraria a folga.
const NOMINAIS = require("../ci/pisos_autorizados.js");

/** Os arquivos que sustentam a autoridade do piso, e o papel de cada um.
 *  A amarração entre eles é conferida por `conferirAmarracao`, e também pelo
 *  juiz do CI — que roda fora da suíte. */
const ARQUIVOS_DA_AUTORIDADE = Object.freeze({
  "test/piso_ancorado.js": "a comparação com o commit anterior",
  "test/censo_de_suites.js": "chama a comparação de dentro do censo",
  "test/guarda_do_portao.js": "chama a comparação antes do glob, no `pretest`",
  "ci/piso_do_portao.json": "declara o piso que a comparação protege",
  // [OS 54-C7] Os pisos EXTERNOS, os nomes obrigatórios e o CONTEÚDO MATERIAL
  // dos casos protegidos moram todos aqui. A OS 54-R6 mostrou o preço de eles
  // não estarem sob a autoridade ancorada: peso reduzido, peso removido,
  // nomes esvaziados e pisos rebaixados passavam, porque a única leitura era
  // a do próprio arquivo — e o próprio arquivo é editável.
  "ci/pisos_autorizados.js": "declara os pisos externos, os nomes obrigatórios e o conteúdo material dos casos protegidos",
});

/** Quem TEM de citar `piso_ancorado` no programa, sob pena de a chamada ter
 *  sido removida com o corpo intacto — a sabotagem número 3 da lista da
 *  `prova_da_unicidade`. */
const AMARRACOES = Object.freeze({
  "test/censo_de_suites.js": "o censo deixou de chamar o piso ancorado",
  "test/guarda_do_portao.js": "a etapa `pretest` deixou de chamar o piso ancorado",
  "ci/portao_do_ci.js": "o juiz do CI deixou de conferir a amarração do piso ancorado",
});

// ---------------------------------------------------------------------------
// A LEITURA DO PASSADO
// ---------------------------------------------------------------------------

function git(raiz, args) {
  return cp.execFileSync("git", ["-C", raiz, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024,
  });
}

/** As âncoras: `HEAD` e o pai imediato.
 *
 *  As DUAS, e não só uma. Só `HEAD` deixaria passar o commit que encolhe (a
 *  árvore de trabalho bate com o que ele mesmo gravou); só `HEAD^` deixaria
 *  passar o encolhimento não commitado enquanto `HEAD` fosse o commit anterior.
 *  Juntas, o piso corrente tem de ser maior ou igual ao MAIOR dos dois. */
function ancorasDe(raiz) {
  let cabeca;
  try {
    cabeca = git(raiz, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  } catch (e) {
    return { erro: "não foi possível ler `HEAD` com o git nesta árvore (" +
      String((e && e.message) || e).split("\n")[0] + ")" };
  }
  const ancoras = [cabeca];
  try {
    ancoras.push(git(raiz, ["rev-parse", "--verify", "HEAD^1^{commit}"]).trim());
  } catch (_) {
    // commit raiz: não há pai. `HEAD` sozinho ainda serve, e a ausência é
    // registrada em vez de silenciada.
  }
  return { ancoras };
}

/** `a` é ancestral de `b`? Ausência de resposta é NÃO — fail-closed. */
function ehAncestral(raiz, a, b) {
  try {
    git(raiz, ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch (_) {
    return false;
  }
}

function conteudoNoCommit(raiz, sha, caminho) {
  try {
    return git(raiz, ["show", sha + ":" + caminho]);
  } catch (_) {
    return null;
  }
}

function suitesNoCommit(raiz, sha) {
  let listagem;
  try {
    listagem = git(raiz, ["ls-tree", "-r", "--name-only", sha]);
  } catch (_) {
    return null;
  }
  return listagem.split("\n").map((l) => l.trim())
    .filter((l) => /^test\/[^/]+\.test\.js$/.test(l));
}

/** Conta casos, INCLUINDO subtestes — a mesma contagem estática do censo.
 *  Vive aqui também para que a comparação com o passado não dependa de o
 *  arquivo do censo de HOJE ainda exportar a função de ontem. */
function contarCasos(texto) {
  return (String(texto).match(/\btest\s*\(/g) || []).length;
}

/** Os pisos por suíte declarados em `OBRIGATORIAS`, lidos do TEXTO.
 *
 *  Por texto e não por `require`: o objeto de um commit antigo não é um módulo
 *  carregável, e avaliar código do passado seria pior do que lê-lo. */
function pisosPorSuiteNoTexto(fonte) {
  const pisos = {};
  if (fonte === null || fonte === undefined) return pisos;
  const bloco = String(fonte).match(/OBRIGATORIAS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\)/);
  if (!bloco) return pisos;
  const re = /["']([^"']+\.test\.js)["']\s*:\s*(\d+)/g;
  let m;
  while ((m = re.exec(bloco[1]))) pisos[m[1]] = Number(m[2]);
  return pisos;
}

/** O PISO DO PISO, lido do texto de `test/ci_obrigatorio.test.js`.
 *
 *  Ele é a segunda leitura do piso, e a campanha da C3 mostrou que baixá-lo
 *  sozinho não reprovava nada: `786 >= 700` continua verdadeiro, e a guarda
 *  simplesmente ficava mais frouxa em silêncio. Número que pode encolher sem
 *  vermelho não é piso — é decoração. Aqui ele entra na mesma monotonicidade
 *  de todo o resto. */
function constantesDoPisoDoPiso(fonte) {
  const r = {};
  if (fonte === null || fonte === undefined) return r;
  const casos = /const\s+CASOS_MEDIDOS_NA_BASE\s*=\s*(\d+)\s*;/.exec(String(fonte));
  const suites = /const\s+SUITES_MEDIDAS_NA_BASE\s*=\s*(\d+)\s*;/.exec(String(fonte));
  if (casos) r.casos = Number(casos[1]);
  if (suites) r.suites = Number(suites[1]);
  return r;
}

/** [OS 54-C7] Os mapas de `ci/pisos_autorizados.js`, lidos do TEXTO.
 *
 *  Por texto e não por `require`: o objeto de um commit antigo não é um módulo
 *  carregável, e avaliar código do passado seria pior do que lê-lo. É a mesma
 *  disciplina que `pisosPorSuiteNoTexto` já seguia. */
function mapaNumericoNoTexto(fonte, nome) {
  const mapa = {};
  if (fonte === null || fonte === undefined) return mapa;
  const bloco = new RegExp(nome + "\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\n\\}\\)").exec(String(fonte));
  if (!bloco) return mapa;
  const re = /["']([^"']+\.test\.js)["']\s*:\s*(\d+)/g;
  let m;
  while ((m = re.exec(bloco[1]))) mapa[m[1]] = Number(m[2]);
  return mapa;
}

/** Os NOMES OBRIGATÓRIOS por arquivo, lidos do texto. */
function nomesObrigatoriosNoTexto(fonte) {
  const mapa = {};
  if (fonte === null || fonte === undefined) return mapa;
  const bloco = /NOMES_OBRIGATORIOS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\)/.exec(String(fonte));
  if (!bloco) return mapa;
  const re = /["']([^"']+\.test\.js)["']\s*:\s*Object\.freeze\(\[([\s\S]*?)\]\)/g;
  let m;
  while ((m = re.exec(bloco[1]))) {
    mapa[m[1]] = (m[2].match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1));
  }
  return mapa;
}

/** O CONTEÚDO MATERIAL declarado por arquivo e por caso, lido do texto. */
function conteudoNominalNoTexto(fonte) {
  const mapa = {};
  if (fonte === null || fonte === undefined) return mapa;
  const bloco = /CONTEUDO_DOS_NOMINAIS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(String(fonte));
  if (!bloco) return mapa;
  const porArquivo = /["']([^"']+\.test\.js)["']\s*:\s*Object\.freeze\(\{([\s\S]*?)\n  \}\)/g;
  let a;
  while ((a = porArquivo.exec(bloco[1]))) {
    const casos = {};
    const re = /["']([^"']+)["']\s*:\s*Object\.freeze\(\{\s*peso:\s*(\d+)\s*,\s*digest:\s*["']([0-9a-f]+)["']/g;
    let c;
    while ((c = re.exec(a[2]))) casos[c[1]] = { peso: Number(c[2]), digest: c[3] };
    mapa[a[1]] = casos;
  }
  return mapa;
}

function pisoDeclarado(fonte) {
  if (fonte === null || fonte === undefined) return null;
  try {
    const p = JSON.parse(String(fonte));
    if (!Number.isInteger(p.casos_minimos) || !Number.isInteger(p.suites_minimas)) return null;
    return p;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// A COMPARAÇÃO
// ---------------------------------------------------------------------------

const MEMORIA = new Map();

/** Reprova se qualquer número medido, qualquer suíte ou qualquer piso por
 *  arquivo tiver DIMINUÍDO em relação ao que o repositório já registrou.
 *
 *  Devolve o laudo para que a suíte possa afirmar sobre ele sem repetir o
 *  trabalho — e para que "a comparação rodou" seja uma afirmação verificável,
 *  não uma suposição. */
function conferirPisoAncorado(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");
  if (MEMORIA.has(raiz)) return MEMORIA.get(raiz);

  const { ancoras, erro } = ancorasDe(raiz);
  assert.ok(
    !erro,
    "PISO SEM ÂNCORA: " + erro + ". A autoridade do piso é o commit anterior, e " +
      "sem histórico não há como afirmar que nada encolheu. Ausência de âncora é " +
      "REPROVAÇÃO, nunca aprovação por silêncio."
  );

  const agora = {
    piso: pisoDeclarado(fs.readFileSync(path.join(raiz, "ci", "piso_do_portao.json"), "utf8")),
    pisosPorSuite: pisosPorSuiteNoTexto(
      fs.readFileSync(path.join(raiz, "test", "censo_de_suites.js"), "utf8")
    ),
    pisoDoPiso: constantesDoPisoDoPiso(
      (() => {
        try { return fs.readFileSync(path.join(raiz, "test", "ci_obrigatorio.test.js"), "utf8"); }
        catch (_) { return null; }
      })()
    ),
  };
  assert.ok(
    agora.piso,
    "`ci/piso_do_portao.json` não declara `casos_minimos`/`suites_minimas` como " +
      "inteiros — piso ilegível é piso ausente"
  );

  const suitesAgora = fs.readdirSync(path.join(raiz, "test"))
    .filter((f) => /\.test\.js$/.test(f)).map((f) => "test/" + f);
  const casosAgora = suitesAgora.reduce(
    (t, rel) => t + contarCasos(fs.readFileSync(path.join(raiz, rel), "utf8")), 0
  );

  const laudo = {
    ancoras, comparacoes: 0,
    agora: { casos: casosAgora, suites: suitesAgora.length, piso: agora.piso },
    passado: [],
  };

  for (const sha of ancoras) {
    const pisoAntes = pisoDeclarado(conteudoNoCommit(raiz, sha, "ci/piso_do_portao.json"));
    const suitesAntes = suitesNoCommit(raiz, sha);
    const censoAntes = conteudoNoCommit(raiz, sha, "test/censo_de_suites.js");
    const pisosPorSuiteAntes = pisosPorSuiteNoTexto(censoAntes);
    if (!pisoAntes && !suitesAntes) continue;

    const registro = { sha, piso: pisoAntes, suites: (suitesAntes || []).length };
    laudo.passado.push(registro);

    if (pisoAntes) {
      laudo.comparacoes++;
      assert.ok(
        agora.piso.casos_minimos >= pisoAntes.casos_minimos,
        "PISO DE CASOS REBAIXADO: `ci/piso_do_portao.json` declara " +
          agora.piso.casos_minimos + ", e o commit `" + sha.slice(0, 7) + "` já declarava " +
          pisoAntes.casos_minimos + ". O piso é ancorado no histórico: subir é livre, " +
          "descer é vermelho, e realinhar todos os números da árvore não muda o que " +
          "um commit já gravou."
      );
      assert.ok(
        agora.piso.suites_minimas >= pisoAntes.suites_minimas,
        "PISO DE SUÍTES REBAIXADO: declara " + agora.piso.suites_minimas +
          ", e o commit `" + sha.slice(0, 7) + "` já declarava " + pisoAntes.suites_minimas + "."
      );
    }

    if (suitesAntes && suitesAntes.length) {
      laudo.comparacoes++;
      const sumidas = suitesAntes.filter((rel) => !suitesAgora.includes(rel));
      assert.deepEqual(
        sumidas, [],
        "SUÍTE REMOVIDA DESDE `" + sha.slice(0, 7) + "`: " + sumidas.join(", ") +
          " — apagar a suíte e realinhar censo, alcance e piso é o encolhimento " +
          "coordenado que esta guarda existe para reprovar."
      );

      const casosAntes = suitesAntes.reduce((t, rel) => {
        const fonte = conteudoNoCommit(raiz, sha, rel);
        return t + (fonte === null ? 0 : contarCasos(fonte));
      }, 0);
      registro.casos = casosAntes;
      assert.ok(
        casosAgora >= casosAntes,
        "CASOS ENCOLHERAM DESDE `" + sha.slice(0, 7) + "`: a contagem estática das " +
          "suítes caiu de " + casosAntes + " para " + casosAgora + "."
      );
    }

    // O PISO DO PISO também é monotônico.
    const pisoDoPisoAntes = constantesDoPisoDoPiso(
      conteudoNoCommit(raiz, sha, "test/ci_obrigatorio.test.js")
    );
    for (const chave of ["casos", "suites"]) {
      if (pisoDoPisoAntes[chave] === undefined) continue;
      laudo.comparacoes++;
      assert.ok(
        agora.pisoDoPiso[chave] !== undefined,
        "PISO DO PISO APAGADO: `" + chave + "` sumiu de `test/ci_obrigatorio.test.js`, " +
          "e o commit `" + sha.slice(0, 7) + "` declarava " + pisoDoPisoAntes[chave] + "."
      );
      assert.ok(
        agora.pisoDoPiso[chave] >= pisoDoPisoAntes[chave],
        "PISO DO PISO REBAIXADO: `" + chave + "` caiu de " + pisoDoPisoAntes[chave] +
          " para " + agora.pisoDoPiso[chave] + " desde o commit `" + sha.slice(0, 7) +
          "`. Baixá-lo sozinho não muda nenhum limiar hoje — e é exatamente por isso " +
          "que passaria despercebido amanhã."
      );
    }

    // O PISO POR SUÍTE, com a única folga que faz sentido.
    //
    // Exigir `agora >= antes` e ponto proibiria migrar caso de uma suíte para
    // outra — e migrar foi exatamente o que a OS 52-C2 fez quando os sete casos
    // `UNI-*` saíram da costura para a suíte nova de unicidade. O total não
    // caiu; o arquivo, sim.
    //
    // A regra é: o piso só pode descer ATÉ O QUE O ARQUIVO DE FATO TEM. Ele
    // acompanha a realidade e nunca cria FOLGA — folga é espaço para apagar
    // caso sem reprovar, que é o defeito que a R2 registrou como residual. E
    // quem esvaziar a suíte para justificar o piso menor esbarra no total, que
    // é conferido logo acima e não perdoa.
    for (const [arquivo, pisoAntesDaSuite] of Object.entries(pisosPorSuiteAntes)) {
      laudo.comparacoes++;
      const agoraDaSuite = agora.pisosPorSuite[arquivo];
      assert.ok(
        agoraDaSuite !== undefined,
        "PISO POR SUÍTE APAGADO: `" + arquivo + "` tinha piso " + pisoAntesDaSuite +
          " no commit `" + sha.slice(0, 7) + "` e sumiu de `OBRIGATORIAS` — tirar a " +
          "entrada é como a suíte some sem ninguém reprovar."
      );
      let casosReais = null;
      try {
        casosReais = contarCasos(fs.readFileSync(path.join(raiz, "test", arquivo), "utf8"));
      } catch (_) { casosReais = 0; }
      const teto = Math.min(pisoAntesDaSuite, casosReais);
      assert.ok(
        agoraDaSuite >= teto,
        "PISO POR SUÍTE REBAIXADO COM FOLGA: `" + arquivo + "` está com piso " +
          agoraDaSuite + ", abaixo de " + teto + " — o commit `" + sha.slice(0, 7) +
          "` declarava " + pisoAntesDaSuite + " e o arquivo tem hoje " + casosReais +
          " casos. Piso pode acompanhar migração de caso; não pode abrir folga."
      );
    }

    // =====================================================================
    // [OS 54-C7] OS PISOS EXTERNOS, OS NOMES E O CONTEÚDO MATERIAL
    // =====================================================================
    //
    // A OS 54-R6 encontrou sete escapes que têm a MESMA forma: um número ou um
    // nome que só existia em `ci/pisos_autorizados.js` — e o arquivo é
    // editável. Reduzir peso (`E21`), remover a fonte de pesos (`E22`),
    // rebaixar o piso executado (`E32`) ou o textual (`E33`), esvaziar os
    // nomes obrigatórios (`E34`) e trivializar um caso com recarimbo
    // (`E36`/`E38`) passavam todos pela mesma porta.
    //
    // Aqui eles caem pela mesma regra de sempre: SUBIR É LIVRE, DESCER É
    // VERMELHO, e a referência é o commit — que nenhuma edição na árvore de
    // trabalho alcança.
    const pisosFonte = conteudoNoCommit(raiz, sha, "ci/pisos_autorizados.js");
    const pisosAgoraFonte = (() => {
      try { return fs.readFileSync(path.join(raiz, "ci", "pisos_autorizados.js"), "utf8"); }
      catch (_) { return null; }
    })();
    if (pisosFonte !== null) {
      assert.ok(
        pisosAgoraFonte !== null,
        "AUTORIDADE DOS PISOS EXTERNOS APAGADA: `ci/pisos_autorizados.js` existia no commit `" +
          sha.slice(0, 7) + "` e sumiu do disco — apagar a fonte é a forma mais direta de rebaixar " +
          "tudo o que ela declara."
      );

      for (const nome of ["MINIMO_DECLARADO_NO_CENSO", "MINIMO_EXECUTADO"]) {
        const antes = mapaNumericoNoTexto(pisosFonte, nome);
        const agoraMapa = mapaNumericoNoTexto(pisosAgoraFonte, nome);
        for (const [arquivo, valorAntes] of Object.entries(antes)) {
          laudo.comparacoes++;
          const valorAgora = agoraMapa[arquivo];
          assert.ok(
            valorAgora !== undefined,
            "PISO EXTERNO APAGADO: `" + arquivo + "` tinha " + nome + " = " + valorAntes +
              " no commit `" + sha.slice(0, 7) + "` e sumiu de `ci/pisos_autorizados.js`."
          );
          assert.ok(
            valorAgora >= valorAntes,
            "PISO EXTERNO REBAIXADO: " + nome + " de `" + arquivo + "` caiu de " + valorAntes +
              " para " + valorAgora + " desde o commit `" + sha.slice(0, 7) + "`."
          );
        }
      }

      const nomesAntes = nomesObrigatoriosNoTexto(pisosFonte);
      const nomesAgora = nomesObrigatoriosNoTexto(pisosAgoraFonte);
      for (const [arquivo, listaAntes] of Object.entries(nomesAntes)) {
        laudo.comparacoes++;
        const listaAgora = nomesAgora[arquivo] || [];
        const perdidos = listaAntes.filter((n) => !listaAgora.includes(n));
        assert.deepEqual(
          perdidos, [],
          "NOME OBRIGATÓRIO REMOVIDO: `" + arquivo + "` perdeu " + perdidos.join(", ") +
            " desde o commit `" + sha.slice(0, 7) + "` — esvaziar a lista é como um caso nominal " +
            "deixa de ser cobrado sem ninguém reprovar."
        );
      }

      // O CONTEÚDO MATERIAL, e é aqui que o RECARIMBO morre.
      //
      // Três leituras, e a terceira é a que não se recarimba: ela não compara
      // declaração com declaração, e sim o PROGRAMA do corpo de hoje com o
      // PROGRAMA do corpo que o commit já gravou. Trivializar o caso e
      // atualizar peso e digest na mesma alteração continua deixando o corpo
      // menor do que o passado — e o passado não se edita.
      const conteudoAntes = conteudoNominalNoTexto(pisosFonte);
      const conteudoAgora = conteudoNominalNoTexto(pisosAgoraFonte);
      for (const [arquivo, casosAntes] of Object.entries(conteudoAntes)) {
        const declaradosAgora = conteudoAgora[arquivo] || {};
        const fonteAntes = conteudoNoCommit(raiz, sha, "test/" + arquivo);
        const corposAntes = fonteAntes === null ? new Map() : NOMINAIS.corposDosCasos(fonteAntes);
        let corposAgora = new Map();
        try {
          corposAgora = NOMINAIS.corposDosCasos(
            fs.readFileSync(path.join(raiz, "test", arquivo), "utf8")
          );
        } catch (_) { corposAgora = new Map(); }

        for (const [caso, antes] of Object.entries(casosAntes)) {
          laudo.comparacoes++;
          const agoraDeclarado = declaradosAgora[caso];
          assert.ok(
            agoraDeclarado !== undefined,
            "CASO PROTEGIDO REMOVIDO DA AUTORIDADE: `" + caso + "` de `" + arquivo +
              "` estava protegido no commit `" + sha.slice(0, 7) + "` e saiu de " +
              "`CONTEUDO_DOS_NOMINAIS` — tirar o caso da lista é desprotegê-lo sem tocar nele."
          );
          assert.ok(
            agoraDeclarado.peso >= antes.peso,
            "PESO MATERIAL DECLARADO REBAIXADO: `" + caso + "` caiu de " + antes.peso + " para " +
              agoraDeclarado.peso + " desde o commit `" + sha.slice(0, 7) + "`."
          );

          const corpoAntes = corposAntes.get(caso);
          if (corpoAntes === undefined) continue;
          laudo.comparacoes++;
          const pesoAntes = NOMINAIS.pesoMaterial(corpoAntes);
          const corpoAgora = corposAgora.get(caso);
          assert.ok(
            corpoAgora !== undefined,
            "CASO PROTEGIDO SUMIU DO ARQUIVO: `" + caso + "` existia em `test/" + arquivo +
              "` no commit `" + sha.slice(0, 7) + "` e não existe hoje."
          );
          const pesoAgora = NOMINAIS.pesoMaterial(corpoAgora);
          assert.ok(
            pesoAgora >= pesoAntes,
            "CASO NOMINAL TRIVIALIZADO: o PROGRAMA de `" + caso + "` em `test/" + arquivo +
              "` caiu de " + pesoAntes + " para " + pesoAgora + " token(s) desde o commit `" +
              sha.slice(0, 7) + "`. Título, posição, nome, número de casos, número de afirmações e " +
              "mensagens podem ter sido preservados — o conteúdo, não. E recarimbar o peso e o " +
              "digest na mesma alteração não muda o que o commit já gravou."
          );
        }
      }

      // O SHA DE MEDIÇÃO não pode virar um SHA conveniente: ele tem de ser um
      // ancestral de `HEAD` (medir contra commit que não está na história é
      // medir contra nada) e não pode ANDAR PARA TRÁS.
      const medidoAntes = (pisoDeclarado(conteudoNoCommit(raiz, sha, "ci/piso_do_portao.json")) || {}).medido_sobre;
      const medidoAgora = (agora.piso || {}).medido_sobre;
      // A EXIGÊNCIA SÓ VALE QUANDO O SHA MUDA, e isso não é indulgência: é a
      // diferença entre medir a sabotagem e medir a bancada.
      //
      // Uma cópia descartável — que é como toda campanha deste repositório roda —
      // é um repositório NOVO com um commit só. O `medido_sobre` herdado aponta
      // para um commit que aquela cópia nunca teve, e exigir ancestralidade ali
      // reprovaria a ÁRVORE ÍNTEGRA por falta de história. Vermelho pelo motivo
      // errado esconde o que estava sendo medido, e foi assim que este caso
      // apareceu: o controle da sonda caiu antes de qualquer sabotagem.
      //
      // Quem quer um SHA conveniente precisa TROCAR o valor — e aí as duas
      // exigências caem em cima, sem folga: o novo tem de estar na história e
      // tem de descender do antigo.
      if (medidoAntes && medidoAgora && medidoAgora !== medidoAntes) {
        laudo.comparacoes++;
        assert.ok(
          ehAncestral(raiz, medidoAgora, "HEAD"),
          "SHA DE MEDIÇÃO FORA DA HISTÓRIA: `medido_sobre` mudou para `" +
            String(medidoAgora).slice(0, 7) + "`, que não é ancestral de `HEAD` — medir contra um " +
            "commit que a história não alcança é medir contra nada."
        );
        assert.ok(
          ehAncestral(raiz, medidoAntes, medidoAgora),
          "SHA DE MEDIÇÃO RETROCEDIDO: era `" + String(medidoAntes).slice(0, 7) + "` no commit `" +
            sha.slice(0, 7) + "` e virou `" + String(medidoAgora).slice(0, 7) + "`, que não o " +
            "descende — trocar a régua por uma mais velha afrouxa tudo o que ela mede."
        );
      }
    }
  }

  assert.ok(
    laudo.comparacoes > 0,
    "NENHUMA COMPARAÇÃO FOI FEITA: nem o piso, nem a lista de suítes, nem os pisos " +
      "por arquivo puderam ser lidos de commit nenhum. Comparação que não compara " +
      "não protege, e passar por vacuidade é o defeito que esta guarda persegue."
  );

  MEMORIA.set(raiz, laudo);
  return laudo;
}

/** A AMARRAÇÃO. Reprova se algum dos arquivos da autoridade sumiu do disco, ou
 *  se alguém removeu a CHAMADA e deixou o corpo intacto.
 *
 *  A leitura é do PROGRAMA — comentário que cita `piso_ancorado` não conta —, e
 *  por isso ela vive junto do que confere, e não numa lista de nomes. */
function conferirAmarracao(raizDoRepo) {
  const raiz = raizDoRepo || path.join(__dirname, "..");
  for (const [arquivo, papel] of Object.entries(ARQUIVOS_DA_AUTORIDADE)) {
    assert.ok(
      fs.existsSync(path.join(raiz, arquivo)),
      "`" + arquivo + "` sumiu do disco — " + papel
    );
  }
  for (const [arquivo, oQueQuebrou] of Object.entries(AMARRACOES)) {
    const fonte = fs.readFileSync(path.join(raiz, arquivo), "utf8");
    const programa = fonte.split("\n").filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l)).join("\n");
    assert.match(
      programa, /piso_ancorado/,
      oQueQuebrou + " (`" + arquivo + "`) — remover a chamada e deixar o corpo " +
        "intacto é a sabotagem que nenhuma leitura de nome de arquivo pega"
    );
  }
  return Object.keys(ARQUIVOS_DA_AUTORIDADE).length + Object.keys(AMARRACOES).length;
}

module.exports = {
  ARQUIVOS_DA_AUTORIDADE, AMARRACOES,
  contarCasos, pisosPorSuiteNoTexto, pisoDeclarado, constantesDoPisoDoPiso,
  mapaNumericoNoTexto, nomesObrigatoriosNoTexto, conteudoNominalNoTexto, ehAncestral,
  ancorasDe, conteudoNoCommit, suitesNoCommit,
  conferirPisoAncorado, conferirAmarracao,
};
