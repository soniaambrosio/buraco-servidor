// ===========================================================================
// PROVAS NEGATIVAS DO CI OBRIGATÓRIO (OS 54, §5).
//
// A pergunta que esta campanha responde é a única que importa sobre um portão
// novo: ELE PEGA ALGUMA COISA? Um workflow bem escrito e uma suíte que fala
// bonito sobre ele passam juntos no verde e podem não guardar nada. Aqui cada
// sabotagem da §5 é INJETADA de verdade, e o veredito é medido, não afirmado.
//
// DUAS BATERIAS, porque são duas perguntas diferentes:
//
//   ÁRVORE     — sabota o workflow, o piso, o portão ou o `package.json` e
//                julga pelo `npm test` inteiro. Responde: "a metade de dentro
//                percebe que a metade de fora foi desligada?"
//   EVIDÊNCIA  — sabota a SAÍDA de uma execução real e julga pelo próprio
//                `ci/portao_do_ci.js`. Responde: "o veredito recusa mesmo
//                execução que não aconteceu, que foi cancelada ou que encolheu?"
//                É a bateria que separa este portão de um que só lê o YAML.
//
// TRAVAS ANTI-VÁCUO, e as três param a campanha em vez de mentir:
//   1) a âncora tem de aparecer EXATAMENTE uma vez;
//   2) o arquivo tem de mudar de bytes depois da troca;
//   3) veredito ausente (`-1`, suíte que trava) NÃO conta como sobrevivente.
//
// Uso: node mutacoes_ci.js
// ===========================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const WORKFLOW = ".github/workflows/provas-do-servidor.yml";
const PISO = "ci/piso_do_portao.json";
const PORTAO = "ci/portao_do_ci.js";
const PACOTE = "package.json";

// --- BATERIA DA ÁRVORE ------------------------------------------------------
const MUTACOES = [
  // §5.1 — o comando oficial some do workflow
  {
    n: 1,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.1 o `npm test` é REMOVIDO do workflow",
    de: '          npm test > "$EVIDENCIA/npm-test.txt" 2>&1\n',
    para: "",
  },
  // §5.2 — o passo é comentado
  {
    n: 2,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.2 o passo das provas é COMENTADO",
    de: '          npm test > "$EVIDENCIA/npm-test.txt" 2>&1',
    para: '          # npm test > "$EVIDENCIA/npm-test.txt" 2>&1',
  },
  // §5.3 — o comando vira um `echo`
  {
    n: 3,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.3 o comando é trocado por `echo`",
    de: '          npm test > "$EVIDENCIA/npm-test.txt" 2>&1',
    para: '          echo "tudo certo" > "$EVIDENCIA/npm-test.txt" 2>&1',
  },
  // §5.4 — o comando ganha `|| true`
  {
    n: 4,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.4 o comando ganha `|| true`",
    de: '          npm test > "$EVIDENCIA/npm-test.txt" 2>&1',
    para: '          npm test > "$EVIDENCIA/npm-test.txt" 2>&1 || true',
  },
  // §5.5 — o alvo é desviado, no workflow e na fonte
  {
    n: 5,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.5a o alvo é DESVIADO para uma suíte só",
    de: '          npm test > "$EVIDENCIA/npm-test.txt" 2>&1',
    para: '          node --test test/ci_obrigatorio.test.js > "$EVIDENCIA/npm-test.txt" 2>&1',
  },
  {
    n: 6,
    tipo: "troca",
    arquivo: PACOTE,
    nome: "§5.5b o alvo é desviado NA FONTE (glob vira arquivo-isca)",
    de: '"test": "node --test \\"test/*.test.js\\""',
    para: '"test": "node --test test/ci_obrigatorio.test.js"',
  },
  // §5.6 — a suíte principal desaparece
  {
    n: 7,
    tipo: "renomear",
    arquivo: "test/ci_obrigatorio.test.js",
    destino: "test/ci_obrigatorio.test.js.desligado",
    nome: "§5.6a a suíte do CI SOME do glob",
  },
  {
    n: 8,
    tipo: "renomear",
    arquivo: "test/gate_vip.test.js",
    destino: "test/gate_vip.test.js.desligado",
    nome: "§5.6b uma suíte obrigatória herdada some do glob",
  },
  {
    n: 9,
    tipo: "renomear",
    arquivo: WORKFLOW,
    destino: ".github/workflows/provas-do-servidor.yml.desligado",
    nome: "§5.6c o WORKFLOW some do lugar em que o GitHub lê",
  },
  // §5.7 — o job deixa de depender do resultado
  {
    n: 10,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.7a o passo do veredito ganha `continue-on-error`",
    de: '      - name: Portão fail-closed\n        run: node ci/portao_do_ci.js',
    para: '      - name: Portão fail-closed\n        continue-on-error: true\n        run: node ci/portao_do_ci.js',
  },
  {
    n: 11,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.7b o passo do veredito é REMOVIDO",
    de: '      - name: Portão fail-closed\n        run: node ci/portao_do_ci.js "$EVIDENCIA/npm-test.txt" "$EVIDENCIA/exit.txt"\n',
    para: "",
  },
  {
    n: 12,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.7c o veredito é CONDICIONADO por um `if:`",
    de: '      - name: Portão fail-closed\n        run: node ci/portao_do_ci.js',
    para: "      - name: Portão fail-closed\n        if: false\n        run: node ci/portao_do_ci.js",
  },
  // §5.8 — o workflow não dispara
  {
    n: 13,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.8a o gatilho é restringido a uma branch que ninguém usa",
    de: "    branches: ['**']",
    para: "    branches: ['branch-que-ninguem-usa']",
  },
  {
    n: 14,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.8b o gatilho de `push` é removido",
    de: "on:\n  push:\n    branches: ['**']\n  pull_request:\n  workflow_dispatch:",
    para: "on:\n  workflow_dispatch:",
  },
  // §5.9 — o checkout é removido
  {
    n: 15,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.9 o CHECKOUT é removido (o job rodaria sobre árvore vazia)",
    de: "      - name: Checkout íntegro\n        uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n",
    para: "",
  },
  // §5.10 — a execução termina sem marcador válido
  {
    n: 16,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5.10a o marcador de desfecho deixa de ser gravado",
    de: '          printf \'%s\' "$codigo" > "$EVIDENCIA/exit.txt"\n',
    para: "",
  },
  {
    n: 17,
    tipo: "troca",
    arquivo: PORTAO,
    nome: "§5.10b o portão para de exigir o rodapé (corpo esvaziado)",
    de: "  const faltando = CHAVES_DO_RODAPE.filter((k) => rodape[k] === null);",
    para: "  const faltando = [];",
  },
  {
    n: 18,
    tipo: "troca",
    arquivo: PORTAO,
    nome: "§5.10c o portão passa a aceitar evidência AUSENTE",
    de: "  const saida = lerArquivo(opcoes.arquivoSaida);\n  if (saida === null) {",
    para: "  const saida = lerArquivo(opcoes.arquivoSaida);\n  if (false) {",
  },
  // §5.11 — o número cai em silêncio
  {
    n: 19,
    tipo: "troca",
    arquivo: PISO,
    nome: "§5.11a o piso de CASOS é rebaixado",
    de: '"casos_minimos": 883,',
    para: '"casos_minimos": 1,',
  },
  {
    n: 20,
    tipo: "troca",
    arquivo: PISO,
    nome: "§5.11b o piso de SUÍTES é rebaixado",
    de: '"suites_minimas": 87,',
    para: '"suites_minimas": 1,',
  },
  {
    n: 21,
    tipo: "troca",
    arquivo: PORTAO,
    nome: "§5.11c o portão para de comparar com o piso",
    de: "  if (rodape.pass < piso.casos_minimos) {",
    para: "  if (false) {",
  },
  {
    n: 22,
    tipo: "renomear",
    arquivo: PISO,
    destino: "ci/piso_do_portao.json.desligado",
    nome: "§5.11d o arquivo de piso SOME",
  },
  // --- os limites que a §4 impõe ao workflow -------------------------------
  {
    n: 23,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§4 o workflow passa a usar SEGREDO",
    de: "          node --version",
    para: '          echo "${{ secrets.QUALQUER_COISA }}"\n          node --version',
  },
  {
    n: 24,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§4 as permissões são ampliadas para ESCRITA",
    de: "permissions:\n  contents: read",
    para: "permissions:\n  contents: write",
  },
  {
    n: 25,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§4 o limite de tempo do job é removido",
    de: "    timeout-minutes: 20\n",
    para: "",
  },
  {
    n: 26,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§4 uma SEGUNDA declaração de evidência é plantada no passo do veredito",
    de: "      - name: Portão fail-closed\n        run: node ci/portao_do_ci.js",
    para:
      "      - name: Plantada\n        run: echo \"EVIDENCIA=/tmp/outro-lugar\" >> \"$GITHUB_ENV\"\n\n" +
      "      - name: Portão fail-closed\n        run: node ci/portao_do_ci.js",
  },
  {
    n: 27,
    tipo: "renomear",
    arquivo: PORTAO,
    destino: "ci/portao_do_ci.js.desligado",
    nome: "§4 o JUIZ some do repositório",
  },
  {
    n: 28,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5 o passo que declara o lugar da evidência é REMOVIDO",
    de: '      - name: Lugar da evidência\n        run: echo "EVIDENCIA=$RUNNER_TEMP/evidencia" >> "$GITHUB_ENV"\n\n',
    para: "",
  },
  {
    // A sabotagem que o PROVEDOR ensinou: a primeira versão desta OS declarava
    // a evidência no `env:` do job, com `runner.temp`, e o GitHub reprovou o
    // workflow na validação — `failure` com zero jobs, sem log legível. Um
    // portão que não chega a criar job não guarda nada, e nada no repositório
    // teria apontado isso. Agora aponta.
    n: 29,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§5 o contexto `runner` volta para o `env:` do job (workflow inválido)",
    de: "    timeout-minutes: 20\n\n    steps:",
    para: "    timeout-minutes: 20\n\n    env:\n      EVIDENCIA: ${{ runner.temp }}/evidencia\n\n    steps:",
  },
  // =========================================================================
  // [OS 54-C1] AS SEIS DA AUDITABILIDADE.
  //
  // Nenhuma delas apaga o portão — o portão continua barrando. Elas apagam o
  // RASTRO: sem artefato e sem resumo, um vermelho vira "falhou, vá reproduzir",
  // e é assim que um gate morre de morte natural.
  // =========================================================================
  {
    n: 30,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§3 o UPLOAD do artefato é removido",
    de: `      - name: Evidência arquivada
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evidencia-provas-do-servidor
          path: \${{ env.EVIDENCIA }}/
          if-no-files-found: error
          retention-days: 30
`,
    para: "",
  },
  {
    n: 31,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§3 o artefato troca `always()` por condição comum",
    de: "      - name: Evidência arquivada\n        if: always()",
    para: "      - name: Evidência arquivada\n        if: success()",
  },
  {
    n: 32,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§3 o artefato aponta para caminho DIFERENTE da evidência julgada",
    de: "          path: \${{ env.EVIDENCIA }}/",
    para: "          path: /tmp/outro-lugar/",
  },
  {
    n: 33,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§3 o RESUMO é removido",
    de: `      - name: Resumo (verde, vermelho, cancelado ou não executado)
        if: always()
        run: |
          node ci/portao_do_ci.js --resumo "\$EVIDENCIA/npm-test.txt" "\$EVIDENCIA/exit.txt" \\
            --desfecho "\${{ job.status }}" >> "\$GITHUB_STEP_SUMMARY"

`,
    para: "",
  },
  {
    n: 34,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§3 o resumo deixa de ESCREVER no painel",
    de: '            --desfecho "\${{ job.status }}" >> "\$GITHUB_STEP_SUMMARY"',
    para: '            --desfecho "\${{ job.status }}"',
  },
  {
    n: 35,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§3 o resumo passa a rodar SÓ EM SUCESSO",
    de: "      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: always()",
    para: "      - name: Resumo (verde, vermelho, cancelado ou não executado)\n        if: success()",
  },
  {
    n: 36,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§3 o resumo TRUNCA o painel em vez de anexar",
    de: '>> "\$GITHUB_STEP_SUMMARY"',
    para: '> "\$GITHUB_STEP_SUMMARY"',
  },
  {
    n: 37,
    tipo: "troca",
    arquivo: PORTAO,
    nome: "§3 o resumo do juiz é ESVAZIADO (o passo fica, o painel fica vazio)",
    de: "  const linhas = [];\n  linhas.push(\"## Provas do servidor — portão fail-closed\");",
    para: "  const linhas = [];\n  if (true) return \"\";\n  linhas.push(\"## Provas do servidor — portão fail-closed\");",
  },
  {
    n: 38,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§4 o Node é rebaixado abaixo do homologado",
    de: "          node-version: '24'",
    para: "          node-version: '20'",
  },
  {
    n: 39,
    tipo: "troca",
    arquivo: WORKFLOW,
    nome: "§4 o limite de tempo do job é rebaixado",
    de: "    timeout-minutes: 20",
    para: "    timeout-minutes: 5",
  },
];

// --- BATERIA DA EVIDÊNCIA ---------------------------------------------------
//
// Cada item recebe a saída REAL de uma execução do alvo oficial e devolve a
// versão sabotada dela (ou `null` para "o arquivo não existe"). O veredito é o
// código de saída do portão de verdade.
const SABOTAGENS_DE_EVIDENCIA = [
  {
    n: "E1",
    nome: "§5 a execução NÃO ACONTECEU (evidência ausente)",
    saida: () => null,
  },
  {
    n: "E2",
    nome: "§5 a execução terminou SEM MARCADOR (exit ausente)",
    exit: () => null,
  },
  {
    n: "E3",
    nome: "§5 o comando oficial falhou",
    exit: () => "1",
  },
  {
    n: "E4",
    nome: "§5 marcador ilegível (texto no lugar do código de saída)",
    exit: () => "verde",
  },
  {
    n: "E5",
    nome: "§5 a execução foi INTERROMPIDA no meio (rodapé truncado)",
    saida: (real) => real.split("# pass").join("").split("\u2139 pass").join(""),
  },
  {
    n: "E6",
    nome: "§5 a saída foi FABRICADA por um `echo`",
    saida: () => "tudo certo por aqui\n",
  },
  {
    n: "E7",
    nome: "§5 o alvo foi desviado para arquivo-isca",
    saida: (real) => real.split('node --test "test/*.test.js"').join("node --test test/isca.test.js"),
  },
  {
    n: "E8",
    nome: "§5 os CASOS caíram em silêncio",
    saida: (real) => trocarNumero(trocarNumero(real, "tests", 3), "pass", 3),
  },
  {
    n: "E9",
    nome: "§5 as SUÍTES caíram em silêncio",
    saida: (real) => trocarNumero(real, "suites", 2),
  },
  {
    n: "E10",
    nome: "§5 a execução foi CANCELADA (casos cancelados no rodapé)",
    saida: (real) => trocarNumero(real, "cancelled", 7),
  },
];

function trocarNumero(texto, chave, valor) {
  const re = new RegExp("^((?:#|\u2139)\\s+" + chave + "\\s+)[0-9.]+$", "m");
  if (!re.test(texto)) {
    console.error("SABOTAGEM DE EVIDENCIA SEM ANCORA: " + chave);
    process.exit(1);
  }
  return texto.replace(re, "$1" + valor);
}

// --- maquinaria -------------------------------------------------------------

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
  const m = /^# fail (\d+)$/m.exec(saida) || /\u2139 fail (\d+)/.exec(saida);
  return m ? Number(m[1]) : -1;
}

function julgar(mut) {
  const falhas = falhasDe(rodarSuite());
  if (falhas < 0) {
    console.error("MUT-" + mut.n + " NAO PRODUZIU VEREDITO: " + mut.nome);
    process.exit(1);
  }
  return falhas;
}

function injetar(mut) {
  if (mut.tipo === "renomear") {
    if (!fs.existsSync(mut.arquivo)) {
      console.error("MUT-" + mut.n + " ARQUIVO AUSENTE: " + mut.arquivo);
      process.exit(1);
    }
    if (fs.existsSync(mut.destino)) {
      console.error("MUT-" + mut.n + " DESTINO JA EXISTE: " + mut.destino);
      process.exit(1);
    }
    fs.renameSync(mut.arquivo, mut.destino);
    if (fs.existsSync(mut.arquivo)) {
      console.error("MUT-" + mut.n + " O ARQUIVO CONTINUA NO LUGAR");
      process.exit(1);
    }
    return { delta: 0, desfazer: () => fs.renameSync(mut.destino, mut.arquivo) };
  }

  const antes = lerNormalizado(mut.arquivo);
  const partes = antes.texto.split(mut.de);
  if (partes.length !== 2) {
    console.error(
      "MUT-" + mut.n + " ANCORA AMBIGUA/AUSENTE (" + (partes.length - 1) + " ocorrencias): " + mut.nome
    );
    process.exit(1);
  }
  const mutado = partes[0] + mut.para + partes[1];
  if (mutado === antes.texto) {
    console.error("MUT-" + mut.n + " NAO ALTEROU O ARQUIVO: " + mut.nome);
    process.exit(1);
  }
  fs.writeFileSync(mut.arquivo, antes.crlf ? mutado.split("\n").join("\r\n") : mutado, "utf8");
  return {
    delta: mutado.length - antes.texto.length,
    desfazer: () => fs.writeFileSync(mut.arquivo, antes.bruto, "utf8"),
  };
}

/** Roda o portão de verdade sobre uma evidência forjada e devolve o exit. */
function rodarPortao(dir) {
  try {
    execFileSync(
      process.execPath,
      [PORTAO, path.join(dir, "npm-test.txt"), path.join(dir, "exit.txt")],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 }
    );
    return 0;
  } catch (e) {
    return typeof e.status === "number" ? e.status : -1;
  }
}

// --- verde de partida -------------------------------------------------------
//
// `--so-evidencia` roda apenas a segunda bateria. Serve para reexecutar o juiz
// sem repetir as 27 mutações de árvore, que custam uma suíte completa cada uma.
// Não é um modo "rápido" de aprovar: a bateria de árvore continua obrigatória
// para o veredito, e o laudo diz qual das duas rodou.
const SO_EVIDENCIA = process.argv.includes("--so-evidencia");

const base = falhasDe(rodarSuite());
if (base !== 0) {
  console.error("A BASE JÁ ESTÁ VERMELHA (" + base + " falhas). Mutação não prova nada aqui.");
  process.exit(1);
}
console.log(
  "base verde (0 falhas) · " + MUTACOES.length + " mutações de árvore · " +
  SABOTAGENS_DE_EVIDENCIA.length + " sabotagens de evidência\n"
);

const resultados = [];
for (const mut of SO_EVIDENCIA ? [] : MUTACOES) {
  const inj = injetar(mut);
  let falhas = -1;
  try {
    falhas = julgar(mut);
  } finally {
    inj.desfazer();
  }
  const pego = falhas > 0;
  resultados.push({ n: "MUT-" + mut.n, nome: mut.nome, pego });
  console.log(
    (pego ? "PEGA   " : "ESCAPOU") + " MUT-" + String(mut.n).padStart(2, "0") +
    "  falhas=" + String(falhas).padStart(3) +
    "  bytes=" + (inj.delta >= 0 ? "+" : "") + inj.delta +
    "  " + mut.nome
  );
}

// --- a bateria da evidência -------------------------------------------------
//
// A evidência real é produzida UMA vez, pelo alvo oficial, e cada sabotagem
// parte dela. Forjar do zero provaria menos: o que se quer medir é o portão
// recusando uma corrida que EXISTIU e foi adulterada.
console.log("\ngerando evidência real do alvo oficial…");
const dirBase = fs.mkdtempSync(path.join(os.tmpdir(), "mut-ci-real-"));
let saidaReal = "";
let exitReal = "0";
try {
  // `shell: true` não é conveniência: no Windows o npm é um `.cmd`, e o Node
  // recusa executá-lo sem shell (EINVAL) desde a correção contra injeção por
  // argumento em BAT/CMD. Sem isto a bateria aborta antes de medir qualquer
  // coisa — e abortar é o comportamento certo, porque evidência que não veio de
  // uma corrida real não prova nada.
  saidaReal = execFileSync("npm test", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    timeout: 600000,
  });
} catch (e) {
  saidaReal = String((e.stdout || "") + (e.stderr || ""));
  exitReal = String(typeof e.status === "number" ? e.status : 1);
}
if (exitReal !== "0" || falhasDe(saidaReal) !== 0) {
  console.error("A EXECUÇÃO REAL NÃO FICOU VERDE — a bateria da evidência não prova nada assim.");
  process.exit(1);
}
console.log("evidência real: exit 0, " + (/(?:#|\u2139) pass (\d+)/.exec(saidaReal) || [])[1] + " casos aprovados\n");

// Trava anti-vácuo da bateria: a evidência ÍNTEGRA tem de ser ACEITA.
fs.writeFileSync(path.join(dirBase, "npm-test.txt"), saidaReal);
fs.writeFileSync(path.join(dirBase, "exit.txt"), exitReal);
const controle = rodarPortao(dirBase);
if (controle !== 0) {
  console.error("O PORTÃO REPROVOU A EVIDÊNCIA ÍNTEGRA (exit " + controle + ") — juiz quebrado, campanha inválida.");
  process.exit(1);
}
console.log("controle: o portão ACEITA a evidência íntegra (exit 0)\n");

for (const sab of SABOTAGENS_DE_EVIDENCIA) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mut-ci-"));
  const saida = sab.saida ? sab.saida(saidaReal) : saidaReal;
  const exit = sab.exit ? sab.exit(exitReal) : exitReal;
  if (saida !== null) fs.writeFileSync(path.join(dir, "npm-test.txt"), saida);
  if (exit !== null) fs.writeFileSync(path.join(dir, "exit.txt"), exit);
  const codigo = rodarPortao(dir);
  const pego = codigo === 1;
  resultados.push({ n: sab.n, nome: sab.nome, pego });
  console.log(
    (pego ? "PEGA   " : "ESCAPOU") + " " + sab.n.padEnd(6) + "  portão=exit " + codigo + "  " + sab.nome
  );
}

// --- verde de chegada -------------------------------------------------------
const fim = falhasDe(rodarSuite());
console.log("\nverde de chegada: " + fim + " falhas");
const escaparam = resultados.filter((r) => !r.pego);
console.log("detectadas: " + (resultados.length - escaparam.length) + "/" + resultados.length);
for (const r of escaparam) console.log("  ESCAPOU " + r.n + ": " + r.nome);
if (fim !== 0 || escaparam.length > 0) process.exit(1);
