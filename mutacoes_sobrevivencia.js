#!/usr/bin/env node
// mutacoes_sobrevivencia.js — CAMPANHA NEGATIVA DO PORTAO DE PROVAS.
//
// Um portao so vale o que a campanha negativa dele consegue provar. Esta
// campanha sabota o mecanismo de proposito, uma coisa de cada vez, e exige que
// cada sabotagem fique VERMELHA **com o codigo de recusa certo**.
//
// POR QUE O CODIGO IMPORTA, e nao so o vermelho. Uma sabotagem que derruba o
// comando por qualquer motivo — erro de sintaxe, arquivo corrompido, JSON
// invalido — parece detectada sem que a defesa exista. Exigir o codigo estavel
// (`SUITE_AUSENTE`, `CASO_OBRIGATORIO_NAO_EXECUTADO`, `ZERO_TESTES`...) e o que
// distingue "o portao pegou" de "alguma coisa quebrou".
//
// POR QUE ALGUMAS SABOTAGENS ATUALIZAM O CONTRATO JUNTO. Remover um bloco
// normativo tambem muda o digest. Se a sabotagem nao realinhar digest e piso,
// ela mede o DIGEST e nao o bloco — e a defesa sob teste fica sem prova. Por
// isso `realinhar()` existe: ele isola a defesa que se quer medir.
//
// ONDE ELA RODA. Numa COPIA em diretorio temporario, nunca na arvore de
// trabalho. Nenhuma sabotagem pode sobreviver ao fim da campanha, e a forma
// mais barata de garantir isso e nunca escrever no original.
//
// Uso: node mutacoes_sobrevivencia.js
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ORIGEM = __dirname;
const lf = (t) => t.split("\r\n").join("\n");
const sha = (t) => crypto.createHash("sha256").update(lf(t), "utf8").digest("hex");
const contarCasos = (t) => (lf(t).match(/^\s*test\(/gm) || []).length;
const idsDeCasos = (t) => {
  const o = [];
  for (const m of lf(t).matchAll(/^\s*test\(\s*"([^"]+)"/gm)) {
    const i = (m[1].match(/^([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)?)\s*:/) || [])[1];
    if (i) o.push(i);
  }
  return o;
};

// --- a copia de trabalho ----------------------------------------------------
// Somente o que o `npm test` precisa. `app.html` sozinho tem 5 MB e nao
// participa de prova nenhuma.
const PASTAS = ["ferramentas", "test", "contrato"];
const ARQUIVOS = ["package.json", "server.js"];

function montarCopia() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "campanha-portao-"));
  for (const p of PASTAS) {
    fs.mkdirSync(path.join(raiz, p), { recursive: true });
    for (const f of fs.readdirSync(path.join(ORIGEM, p))) {
      const de = path.join(ORIGEM, p, f);
      if (fs.statSync(de).isFile()) fs.copyFileSync(de, path.join(raiz, p, f));
    }
  }
  for (const f of ARQUIVOS) fs.copyFileSync(path.join(ORIGEM, f), path.join(raiz, f));
  return raiz;
}

let RAIZ = null;
const P = (...p) => path.join(RAIZ, ...p);
const PKG = () => P("package.json");
const CONTRATO = () => P("ferramentas", "contrato-de-provas.json");
const GUARDA = () => P("ferramentas", "gate-de-provas.js");
const PORTAO = () => P("ferramentas", "portao.js");
const SUITE = () => P("test", "produtor_v2.test.js");
const SOBREV = () => P("test", "gate_sobrevivencia.test.js");

const ler = (f) => fs.readFileSync(f, "utf8");
const esc = (f, t) => fs.writeFileSync(f, t, "utf8");
const jC = () => JSON.parse(ler(CONTRATO()));
const eC = (o) => esc(CONTRATO(), JSON.stringify(o, null, 2) + "\n");
const jP = () => JSON.parse(ler(PKG()));
const eP = (o) => esc(PKG(), JSON.stringify(o, null, 2) + "\n");

/** Reconcilia digest, piso e casos de uma suite com o que esta no disco.
 *  Serve para ISOLAR a defesa sob teste — sem isto, toda sabotagem de conteudo
 *  seria detectada pelo digest e nenhuma outra defesa teria prova propria.
 *  `campos` escolhe o que realinhar. */
function realinhar(caminhoRel, campos) {
  const alvo = campos || ["digestSha256", "pisoDeCasos", "casosObrigatorios"];
  const c = jC();
  for (const s of c.suitesObrigatorias) {
    if (s.caminho !== caminhoRel) continue;
    const abs = P.apply(null, caminhoRel.split("/"));
    if (!fs.existsSync(abs)) continue;
    const t = ler(abs);
    if (alvo.includes("digestSha256")) s.digestSha256 = sha(t);
    if (alvo.includes("pisoDeCasos")) s.pisoDeCasos = contarCasos(t);
    if (alvo.includes("casosObrigatorios")) s.casosObrigatorios = idsDeCasos(t);
  }
  eC(c);
}

function removerBloco(prefixo) {
  const bruto = ler(SUITE());
  const crlf = bruto.indexOf("\r\n") >= 0;
  const L = lf(bruto).split("\n");
  const ini = L.findIndex((l) => l.indexOf('describe("' + prefixo) === 0);
  if (ini < 0) throw new Error("bloco nao encontrado: " + prefixo);
  let fim = -1;
  for (let i = ini + 1; i < L.length; i++) if (L[i] === "});") { fim = i; break; }
  if (fim < 0) throw new Error("fim do bloco nao encontrado: " + prefixo);
  L.splice(ini, fim - ini + 1);
  esc(SUITE(), crlf ? L.join("\r\n") : L.join("\n"));
}

const TRIVIAL = 'const { test } = require("node:test");\ntest("irrelevante", () => {});\n';

const BLOCOS = [
  "V2/CONTRATO", "V2/D1", "V2/D2", "V2/D3", "V2/D4", "V2/D5", "V2/D6",
  "V2/INVARIANTES", "V2/QUARENTENA", "V2/PRIMEIRA BATIDA",
];

// ---------------------------------------------------------------------------
const SABOTAGENS = [];

// --- as DEZ originais da OS 23.1-P-C1, na mesma ordem e com a mesma intencao.
// Onde a arquitetura se moveu, a sabotagem acompanha o movimento: S8 era "tirar
// a guarda do npm test"; hoje a guarda nao e mais encadeada, entao a forma de
// tira-la e trocar o comando oficial — e e isso que S8 faz.
SABOTAGENS.push(
  { id: "S1", nome: "apagar test/produtor_v2.test.js", espera: "SUITE_AUSENTE",
    aplica: () => fs.unlinkSync(SUITE()) },
  { id: "S2", nome: "renomear a suite (o alvo acha, o contrato nao)", espera: "SUITE_AUSENTE",
    aplica: () => fs.renameSync(SUITE(), P("test", "produtor_v2_renomeado.test.js")) },
  { id: "S3", nome: "substituir por um unico teste irrelevante", espera: "DIGEST_DIVERGENTE",
    aplica: () => esc(SUITE(), TRIVIAL) },
  { id: "S4", nome: "remover o bloco V2/D3 (contrato realinhado junto)", espera: "BLOCO_NORMATIVO_AUSENTE",
    aplica: () => { removerBloco("V2/D3"); realinhar("test/produtor_v2.test.js"); } },
  { id: "S5", nome: "remover o bloco V2/QUARENTENA (contrato realinhado junto)", espera: "BLOCO_NORMATIVO_AUSENTE",
    aplica: () => { removerBloco("V2/QUARENTENA"); realinhar("test/produtor_v2.test.js"); } },
  { id: "S6", nome: "alterar o digest SEM alterar a suite", espera: "DIGEST_DIVERGENTE",
    aplica: () => { const c = jC(); c.suitesObrigatorias[0].digestSha256 = "0".repeat(64); eC(c); } },
  { id: "S7", nome: "alterar a suite SEM atualizar a assinatura", espera: "DIGEST_DIVERGENTE",
    aplica: () => esc(SUITE(), ler(SUITE()) + "\n// alteracao silenciosa\n") },
  { id: "S8", nome: "tirar a guarda do comando oficial", espera: "COMANDO_OFICIAL_DIVERGENTE",
    aplica: () => { const p = jP(); p.scripts.test = 'node --test "test/*.test.js"'; eP(p); } },
  { id: "S9", nome: "estreitar o alvo: a suite existe e nao roda", espera: "FORA_DO_COMANDO",
    aplica: () => { const c = jC(); c.execucao.padroes = ["test/gate_*.test.js"]; eC(c); } },
  { id: "S10", nome: "reduzir a suite abaixo do piso (digest realinhado junto)", espera: "ABAIXO_DO_PISO",
    aplica: () => {
      removerBloco("V2/D3"); removerBloco("V2/QUARENTENA");
      realinhar("test/produtor_v2.test.js", ["digestSha256", "casosObrigatorios"]);
    } },
);

// --- os DOIS bloqueios medidos pela OS 23.1-P-R1 ---------------------------
SABOTAGENS.push(
  { id: "R1-A", nome: "R1/2.1 — trocar `&&` por `;` no comando oficial", espera: "COMANDO_OFICIAL_DIVERGENTE",
    aplica: () => {
      const p = jP();
      p.scripts.test = 'node ferramentas/gate-de-provas.js ; node --test "test/*.test.js"';
      eP(p);
    } },
  { id: "R1-B", nome: "R1/2.2 — suite trivial com os campos de defesa apagados do contrato", espera: "CAMPO_OBRIGATORIO_AUSENTE",
    aplica: () => {
      esc(SUITE(), TRIVIAL);
      const c = jC();
      const s = c.suitesObrigatorias[0];
      delete s.digestSha256; delete s.pisoDeCasos; delete s.blocosNormativos; delete s.casosObrigatorios;
      eC(c);
    } },
);

// --- endurecimentos complementares exigidos pela secao 8.3 -----------------
SABOTAGENS.push(
  { id: "E1", nome: "desregistrar a suite do contrato", espera: "GS-05",
    aplica: () => {
      const c = jC();
      c.suitesObrigatorias = c.suitesObrigatorias.filter((s) => s.caminho !== "test/produtor_v2.test.js");
      eC(c);
    } },
  { id: "E2", nome: "remover o PRODUTOR do gate (a guarda)", espera: "Cannot find module",
    aplica: () => fs.unlinkSync(GUARDA()) },
  { id: "E3", nome: "remover o CONSUMIDOR do gate (o portao)", espera: "FERRAMENTA_AUSENTE",
    aplica: () => fs.unlinkSync(PORTAO()) },
  { id: "E4", nome: "marcador de sucesso FABRICADO nao resgata execucao vermelha", espera: "SUITE_AUSENTE",
    aplica: () => {
      // O marcador plantado descreve uma execucao perfeita que nunca houve.
      // A suite obrigatoria e apagada no mesmo ato: se o marcador valesse por
      // si, o portao aprovaria. Ele nao vale — o selo nasce do processo.
      esc(P("ferramentas", ".marcador-de-execucao.json"), JSON.stringify({
        carga: { contratoVersao: 2, casosExecutados: 99999, falhas: 0 },
        selo: "f".repeat(64),
      }, null, 2));
      fs.unlinkSync(SUITE());
    } },
  { id: "E4b", nome: "neutralizar o proprio portao (main() vazio) — pego pelo pretest", espera: "FERRAMENTA_ADULTERADA",
    aplica: () => {
      esc(PORTAO(), ler(PORTAO()).replace("function main() {", "function main() { return;"));
      esc(P("ferramentas", ".marcador-de-execucao.json"), JSON.stringify({
        carga: { casosExecutados: 99999, falhas: 0 }, selo: "f".repeat(64),
      }));
    } },
  { id: "E4c", nome: "remover o `pretest`, deixando o portao como unico conferente", espera: "COMANDO_OFICIAL_AUSENTE",
    aplica: () => { const p = jP(); delete p.scripts.pretest; eP(p); } },
  { id: "E5", nome: "imprimir a aprovacao ANTES da execucao", espera: "FERRAMENTA_ADULTERADA",
    aplica: () => {
      esc(PORTAO(), ler(PORTAO()).replace("function main() {",
        'function main() { console.log("PORTAO: APROVADO"); '));
    } },
  { id: "E6", nome: "comando obrigatorio falha e o script segue mesmo assim", espera: "COMANDO_OFICIAL_DIVERGENTE",
    aplica: () => { const p = jP(); p.scripts.test = "node ferramentas/portao.js ; exit 0"; eP(p); } },
  { id: "E7", nome: "alvo que seleciona ZERO arquivos", espera: "FORA_DO_COMANDO",
    aplica: () => { const c = jC(); c.execucao.padroes = ["test/nada_de_nada_*.test.js"]; eC(c); } },
  { id: "E8", nome: "suite esvaziada de casos, contrato realinhado", espera: "CASO_OBRIGATORIO_AUSENTE",
    aplica: () => {
      esc(SUITE(), '"use strict";\n// nenhum caso, de proposito\n');
      realinhar("test/produtor_v2.test.js", ["digestSha256", "pisoDeCasos"]);
      const c = jC();
      c.suitesObrigatorias[0].blocosNormativos = ["V2/CONTRATO"];
      eC(c);
    } },
  { id: "E9", nome: "reduzir preservando a QUANTIDADE aparente (61 casos sem ID)", espera: "CASO_OBRIGATORIO_AUSENTE",
    aplica: () => {
      let corpo = 'const { test, describe } = require("node:test");\n';
      for (const b of BLOCOS) {
        corpo += `describe("${b}", () => {\n  test("nada de mais", () => {});\n});\n`;
      }
      for (let i = 0; i < 61; i++) corpo += `test("enchimento ${i}", () => {});\n`;
      esc(SUITE(), corpo);
      realinhar("test/produtor_v2.test.js", ["digestSha256", "pisoDeCasos"]);
    } },
  { id: "E10", nome: "atualizar a assinatura DENTRO do proprio arquivo adulterado", espera: "DIGEST_DIVERGENTE",
    aplica: () => {
      // A expectativa nao mora na suite; mora no contrato. Declarar um digest
      // dentro do arquivo adulterado nao muda nada — e essa e a prova.
      const t = ler(SUITE());
      esc(SUITE(), t + '\n// digestSha256: "' + sha(t) + '"\n');
    } },
  { id: "E11", nome: "adulterar a GUARDA sem atualizar o contrato", espera: "FERRAMENTA_ADULTERADA",
    aplica: () => esc(GUARDA(), ler(GUARDA()) + "\n// adulteracao silenciosa\n") },
  { id: "E12", nome: "marcar um caso obrigatorio como `skip`", espera: "CASO_OBRIGATORIO_NAO_EXECUTADO",
    aplica: () => {
      const t = ler(SUITE());
      const alvo = t.match(/^(\s*)test\("(C-01[^"]*)",/m);
      if (!alvo) throw new Error("C-01 nao encontrado");
      esc(SUITE(), t.replace(alvo[0], `${alvo[1]}test("${alvo[2]}", { skip: true },`));
      realinhar("test/produtor_v2.test.js", ["digestSha256", "pisoDeCasos"]);
      // Isola a defesa: sem baixar o piso global, quem acende e
      // ABAIXO_DO_TOTAL_MINIMO e o caso obrigatorio pulado fica sem prova.
      const c = jC(); c.execucao.totalMinimoDeTestes -= 1; eC(c);
    } },
  { id: "E13", nome: "apagar a propria suite de sobrevivencia", espera: "SUITE_AUSENTE",
    aplica: () => fs.unlinkSync(SOBREV()) },
  { id: "E14", nome: "esvaziar a lista de suites obrigatorias", espera: "LISTA_VAZIA",
    aplica: () => { const c = jC(); c.suitesObrigatorias = []; eC(c); } },
  { id: "E15", nome: "apagar o contrato de provas", espera: "CONTRATO_AUSENTE",
    aplica: () => fs.unlinkSync(CONTRATO()) },
  { id: "E16", nome: "tirar `camposObrigatoriosPorSuite` do contrato", espera: "SEM_CAMPOS_OBRIGATORIOS",
    aplica: () => { const c = jC(); delete c.camposObrigatoriosPorSuite; eC(c); } },
  { id: "E17", nome: "desproteger as ferramentas (lista de digests esvaziada)", espera: "GS-07",
    aplica: () => { const c = jC(); c.ferramentasProtegidas = []; eC(c); } },
  { id: "E18", nome: "esvaziar os casos obrigatorios e baixar o piso global", espera: "CAMPO_OBRIGATORIO_AUSENTE",
    aplica: () => {
      const c = jC();
      c.execucao.totalMinimoDeTestes = 1;
      c.suitesObrigatorias[0].casosObrigatorios = [];
      eC(c);
    } },
);

// --- cada bloco normativo, individualmente ---------------------------------
for (const b of BLOCOS) {
  SABOTAGENS.push({
    id: "B:" + b.replace("V2/", ""),
    nome: `remover integralmente o bloco ${b} (contrato realinhado junto)`,
    espera: "BLOCO_NORMATIVO_AUSENTE",
    aplica: () => { removerBloco(b); realinhar("test/produtor_v2.test.js"); },
  });
}

// ---------------------------------------------------------------------------
function restaurar() {
  for (const p of PASTAS) {
    fs.rmSync(P(p), { recursive: true, force: true });
    fs.mkdirSync(P(p), { recursive: true });
    for (const f of fs.readdirSync(path.join(ORIGEM, p))) {
      const de = path.join(ORIGEM, p, f);
      if (fs.statSync(de).isFile()) fs.copyFileSync(de, P(p, f));
    }
  }
  for (const f of ARQUIVOS) fs.copyFileSync(path.join(ORIGEM, f), P(f));
}

function rodarComandoOficial() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("NODE_TEST")) delete env[k];
  const r = spawnSync("npm", ["test"], {
    cwd: RAIZ, encoding: "utf8", shell: true, maxBuffer: 256 * 1024 * 1024, env,
  });
  return {
    vermelho: r.status !== 0,
    codigo: r.status,
    saida: String(r.stdout || "") + String(r.stderr || ""),
  };
}

function main() {
  RAIZ = montarCopia();
  console.log("campanha em copia descartavel: " + RAIZ + "\n");

  const shaServidorAntes = sha(ler(path.join(ORIGEM, "server.js")));

  console.log("controle: a arvore intacta deve ficar VERDE");
  const controle = rodarComandoOficial();
  const casos = (controle.saida.match(/\[3\/5\] contabilidade: (\d+) casos/) || [])[1];
  console.log(
    `controle ${controle.vermelho ? "VERMELHO (INESPERADO)" : "VERDE"}` +
    `  casos executados: ${casos || "?"}\n`
  );
  console.log("-".repeat(78));

  const resultados = [];
  for (const s of SABOTAGENS) {
    restaurar();
    let erro = null;
    try { s.aplica(); } catch (e) { erro = e.message; }
    if (erro) {
      resultados.push({ id: s.id, nome: s.nome, ok: false, motivo: "ERRO_APLICAR: " + erro });
      console.log(`ERRO    ${s.id.padEnd(16)} ${s.nome}\n        -> ${erro}`);
      continue;
    }
    const r = rodarComandoOficial();
    const temCodigo = r.saida.includes(s.espera);
    const ok = s.limite ? true : (r.vermelho && temCodigo);
    resultados.push({ id: s.id, nome: s.nome, espera: s.espera, limite: !!s.limite, vermelho: r.vermelho, temCodigo, ok });
    const rotulo = s.limite ? "LIMITE " : (ok ? "PEGA   " : "ESCAPOU");
    console.log(
      `${rotulo} ${s.id.padEnd(16)} vermelho=${r.vermelho ? "sim" : "NAO"} ` +
      `codigo[${s.espera}]=${temCodigo ? "sim" : "NAO"}  ${s.nome}`
    );
  }

  restaurar();
  console.log("-".repeat(78));
  const fim = rodarComandoOficial();
  const shaServidorDepois = sha(ler(path.join(ORIGEM, "server.js")));
  const escaparam = resultados.filter((x) => !x.ok && !x.limite);

  console.log(`verde de chegada: ${fim.vermelho ? "VERMELHO (INESPERADO)" : "VERDE"}`);
  console.log(`server.js da arvore real intacto: ${shaServidorAntes === shaServidorDepois ? "SIM" : "NAO"}`);
  const limites = resultados.filter((x) => x.limite);
  const medidas = resultados.filter((x) => !x.limite);
  console.log(`detectadas: ${medidas.filter((x) => x.ok).length}/${medidas.length}`);
  if (limites.length) {
    console.log("\nLIMITES ESTRUTURAIS (reportados, nao contados):");
    for (const l of limites) console.log(`  ${l.id}  vermelho=${l.vermelho ? "sim" : "NAO"}  ${l.nome}`);
  }
  if (escaparam.length) {
    console.log("\nESCAPARAM:");
    for (const e of escaparam) console.log("  " + e.id + "  " + (e.motivo || e.nome));
  }

  fs.rmSync(RAIZ, { recursive: true, force: true });
  process.exit(escaparam.length || fim.vermelho || controle.vermelho ? 1 : 0);
}

main();
