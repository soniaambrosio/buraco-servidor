// test/costura_assento_descoberta.test.js — A COSTURA DA COMPOSIÇÃO (OS 44, §9)
//
// Esta suíte não pertence a nenhuma das duas entradas: ela existe porque a
// composição criou uma pergunta que nenhuma delas podia responder sozinha.
//
//   `13ea6f1` (OS 41) provou a ESCOLHA de assento contra o gerenciador de salas.
//   `d1de8a7` (OS 38.1) provou a DESCOBERTA contra o registro de salas.
//   Nenhuma das duas mediu o que acontece quando a fotografia da descoberta é
//   usada para PEDIR um assento — que é o fio inteiro da OS 38.3.
//
// O QUE ELA AFIRMA, e é a espinha do §9: a listagem é uma FOTOGRAFIA, não uma
// promessa. Ela não reserva cadeira, não concede assento e pode estar velha. A
// autoridade é `entrarMesa`, e ela decide sozinha — a fotografia não a informa,
// não a apressa e não a contradiz. Quando a foto e a autoridade discordam, quem
// perde é a foto, e o cliente recebe recusa TIPADA em vez de outra cadeira.
//
// DOIS REGIMES, E ELES SÃO DISJUNTOS — leia antes de procurar aqui a prova da
// trava atômica. A descoberta só publica mesa PÚBLICA e CASUAL (`ehPublicavel`),
// e mesa casual admite de forma SÍNCRONA: `entrarMesa` roda inteiro sem ponto de
// suspensão, então a disputa entre dois clientes é decidida pela ordem em que as
// mensagens são processadas, e a trava de reserva nunca chega a ser consultada
// por um segundo concorrente. A reserva existe para o regime VIP, que é
// assíncrono e NÃO é descobrível. Cada regime tem a sua prova: a disputa
// descobrível está aqui, e a disputa assíncrona está em
// `assento_autoritativo.test.js` (DISP-01..DISP-10). Escrever aqui um teste de
// reserva seria medir um caminho que a descoberta não alcança.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  conferirCenso,
  // [OS 52-C1] A regra da unicidade e as assinaturas que ela usa. Vêm do
  // MESMO módulo de propósito: uma segunda cópia dos padrões aqui seria
  // exatamente a duplicação de autoridade que esta OS existe para fechar.
  conferirUnicidadeDoBundle,
  ASSINATURAS_DE_SERVIDOR,
  ARRANQUE_DO_TRANSPORTE,
} = require("./censo_de_suites.js");

const {
  T0,
  bundle,
  cliente,
  emitirToken,
  novoParDeChaves,
  novoServidor,
  relogio,
  verificadorDeTeste,
} = require("./ajuda_auth.js");

const SERVIDOR = bundle.require("servidor");
const SALAS = bundle.require("salas");
const { criarContas } = bundle.require("contas");
const { DESCOBERTA_FIO } = SERVIDOR;
const { RECUSA_ASSENTO_OCUPADO, RECUSA_ASSENTO_INVALIDO } = SALAS;

const PAR = novoParDeChaves("kid-costura");
const tokenDe = (uid) => emitirToken({ chave: PAR, uid, emitidoEm: T0 });

// ---------------------------------------------------------------------------
// ARNÊS — o mesmo de `descoberta.test.js`, pela mesma razão: mesas PÚBLICAS e
// CASUAIS vêm da CONSTRUÇÃO do processo, e nenhum campo de mensagem as alcança.
// ---------------------------------------------------------------------------
function bancada(opts = {}) {
  const tempo = relogio();
  const contas = criarContas({ persistir: false });
  let n = 0;
  const srv = novoServidor(
    Object.assign(
      {
        tempo,
        contas,
        tipoPartida: "publica",
        gerarCodigo: () => "M-" + String(++n).padStart(2, "0"),
        verificarToken: verificadorDeTeste({ chaves: [PAR], tempo }),
      },
      opts
    )
  );
  return { srv, tempo, contas };
}

async function conectado(srv, uid) {
  const c = cliente(srv);
  await c.autentica(tokenDe(uid));
  c.__srv = srv;
  return c;
}

/** A projeção pelo FIO — é assim que o aplicativo a recebe. */
function pedirLista(c) {
  c.envia({ tipo: DESCOBERTA_FIO.PEDIDO });
  return c.ultimo(DESCOBERTA_FIO.RESPOSTA);
}

/** Pede de novo, ignorando o limite de frequência. Mexe no ARNÊS, não no
 *  servidor: o limite tem prova própria em `descoberta.test.js`, e aqui ele é
 *  ruído. A resposta continua vindo pelo mesmo `descobrirMesas`. */
function pedirDeNovo(c) {
  const cx = c.__srv.conexoes[c.id];
  if (cx) cx._ritmoDescoberta = null;
  c.limpar();
  return pedirLista(c);
}

const mesaDe = (lista, codigo) => lista.mesas.find((m) => m.codigo === codigo) || null;

/** Todo texto de um payload, chave E valor, em qualquer profundidade. */
function textosDe(valor, saida = []) {
  if (valor == null) return saida;
  if (typeof valor === "string") { saida.push(valor); return saida; }
  if (typeof valor !== "object") return saida;
  for (const [k, v] of Object.entries(valor)) { saida.push(k); textosDe(v, saida); }
  return saida;
}

function semVazamento(payload, segredos) {
  const textos = textosDe(payload);
  const cru = JSON.stringify(payload);
  for (const s of segredos) {
    if (!s) continue;
    assert.ok(!textos.includes(s), "segredo '" + s + "' apareceu como texto");
    assert.ok(cru.indexOf(s) === -1, "segredo '" + s + "' apareceu no payload serializado");
  }
}

/** Mesa pública aberta pelo despachante, com o dono no assento 0. */
async function mesaAberta(srv, uid = "uid-dono") {
  const dono = await conectado(srv, uid);
  dono.envia({ tipo: "criarMesa", apelido: "Dono", modalidade: "sbtl", metaPontos: 2000 });
  const codigo = dono.ultimo("entrou").codigo;
  return { dono, codigo };
}

// ===========================================================================
test.describe("COSTURA — descoberta → escolha de assento", () => {
  test("COST-01: o fio inteiro, da fotografia ao ACK", async () => {
    // §9, passos 1 a 6. O jogador vê a mesa, escolhe um assento LIVRE na foto, e
    // o ACK confirma exatamente aquele lugar. É o caminho feliz da OS 38.3, e
    // até esta composição ele não existia em teste nenhum: uma entrada media a
    // foto sem pedir assento, a outra pedia assento sem foto.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);

    const jogador = await conectado(srv, "uid-1");
    const lista = pedirLista(jogador);
    const mesa = mesaDe(lista, codigo);
    assert.ok(mesa, "a mesa pública não apareceu na fotografia");
    assert.equal(mesa.vagas, 3);

    // O assento 3 está livre na FOTO — e não é o que a escolha automática daria
    // (ela daria 2). Pedir o 3 e receber o 3 é o que separa "atendido" de
    // "coincidiu".
    const livre = mesa.assentos.filter((a) => !a.ocupado).map((a) => a.assento);
    assert.deepEqual(livre, [1, 2, 3]);

    jogador.envia({ tipo: "entrarMesa", codigo, apelido: "J1", assento: 3 });
    const ack = jogador.ultimo("entrou");
    assert.ok(ack, "o pedido derivado da fotografia não produziu ACK");
    assert.equal(ack.assento, 3, "o ACK confirmou assento diferente do pedido");
    assert.equal(ack.codigo, codigo);
    assert.equal(srv.ger.salas[codigo].assentos[3].jogadorId, "uid-1");
  });

  test("COST-02: A e B disputam o MESMO assento visto na mesma foto", async () => {
    // O CENÁRIO OBRIGATÓRIO do §9, inteiro e num caso só, porque as partes dele
    // não se provam separadas: "um entra" sem "o outro é recusado" é meia
    // prova, e as duas sem "o perdedor não foi movido" é a metade que esconde o
    // fallback silencioso.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);

    const A = await conectado(srv, "uid-a");
    const B = await conectado(srv, "uid-b");

    // Os DOIS veem a mesma fotografia, com o assento 2 livre.
    const vistaA = mesaDe(pedirLista(A), codigo);
    const vistaB = mesaDe(pedirLista(B), codigo);
    assert.equal(vistaA.revisao, vistaB.revisao, "as duas fotos têm de ser a mesma");
    assert.equal(vistaA.assentos[2].ocupado, false);
    assert.equal(vistaB.assentos[2].ocupado, false);

    // Os dois pedem o 2.
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 2 });
    B.envia({ tipo: "entrarMesa", codigo, apelido: "B", assento: 2 });

    // EXATAMENTE um entrou.
    assert.ok(A.ultimo("entrou"), "o vencedor não recebeu ACK");
    assert.equal(A.ultimo("entrou").assento, 2);
    assert.equal(B.ultimo("entrou"), null, "os dois entraram no mesmo assento");

    // O perdedor recebe recusa TIPADA — não silêncio, não outra cadeira.
    const erro = B.ultimo("erro");
    assert.ok(erro, "o perdedor não recebeu recusa");
    assert.equal(erro.codigo, RECUSA_ASSENTO_OCUPADO);
    assert.equal(srv.conexoes[B.id].assento, null, "o perdedor foi movido para outro lugar");
    assert.equal(srv.conexoes[B.id].codigo, null, "o perdedor ficou vinculado à mesa mesmo assim");

    // Nunca dois proprietários do mesmo assento.
    const sala = srv.ger.salas[codigo];
    assert.equal(sala.assentos[2].jogadorId, "uid-a");
    assert.equal(sala.assentos.filter((a) => a && a.jogadorId === "uid-b").length, 0);

    // E a fotografia POSTERIOR mostra uma ocupação só.
    const depois = mesaDe(pedirDeNovo(A), codigo);
    assert.equal(depois.assentos[2].ocupado, true);
    assert.equal(depois.jogadores, 2, "dono + vencedor, e mais ninguém");
    assert.equal(depois.vagas, 2);
  });

  test("COST-03: a disputa não duplica ninguém na presença", async () => {
    // §9, passo 9. O perdedor continua ONLINE — ele não sumiu, foi recusado — e
    // o vencedor não passa a valer por dois. As duas contagens são medidas no
    // mesmo retrato, porque medir em retratos diferentes esconderia a diferença.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);
    const A = await conectado(srv, "uid-a");
    const B = await conectado(srv, "uid-b");

    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 2 });
    B.envia({ tipo: "entrarMesa", codigo, apelido: "B", assento: 2 });

    const p = pedirDeNovo(A).presenca;
    assert.equal(p.jogadoresOnlineTotal, 3, "dono + A + B, cada um contado UMA vez");
    assert.equal(p.jogadoresEmMesasPublicas, 2, "só quem tem assento está em mesa");
    assert.ok(p.jogadoresEmMesasPublicas <= p.jogadoresOnlineTotal,
      "o subconjunto passou do universo");
    // E a divisão por modalidade fecha com o universo público medido.
    assert.equal(p.porModalidade.sbtl.jogadores, p.jogadoresEmMesasPublicas);
  });

  test("COST-04: pedir a lista NÃO reserva cadeira e não move nada", async () => {
    // §9, passo 4. A fotografia é somente leitura: ela não toca ocupação, não
    // toca a revisão da mesa e não toca a versão do estado autoritativo. Um
    // cliente que consulte em laço não pode "segurar" lugar nenhum.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);
    const sala = srv.ger.salas[codigo];
    const jogador = await conectado(srv, "uid-1");

    const antes = mesaDe(pedirLista(jogador), codigo);
    const versaoAntes = sala.versaoEstado;
    for (let i = 0; i < 5; i++) pedirDeNovo(jogador);
    const depois = mesaDe(pedirDeNovo(jogador), codigo);

    assert.equal(depois.revisao, antes.revisao, "consultar moveu a revisão da mesa");
    assert.equal(sala.versaoEstado, versaoAntes, "consultar moveu a versão do estado");
    assert.deepEqual(sala.assentos.map(Boolean), [true, false, false, false]);
    assert.deepEqual(sala.reservas, [null, null, null, null], "a consulta criou reserva");
  });

  test("COST-05: fotografia ATRASADA não autoriza tomada de assento", async () => {
    // §9, passo 10, e o motivo pelo qual a listagem não pode ser fonte de
    // verdade no cliente: entre a foto e o pedido existe tempo, e nesse tempo o
    // lugar pode ter dono. Quem chega com a foto velha recebe recusa tipada —
    // não a cadeira do vizinho, e não uma cadeira qualquer.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);

    const atrasado = await conectado(srv, "uid-tarde");
    const foto = mesaDe(pedirLista(atrasado), codigo);
    assert.equal(foto.assentos[1].ocupado, false, "a foto precisa mostrar o lugar livre");

    // O mundo anda: outro jogador senta no 1.
    const rapido = await conectado(srv, "uid-cedo");
    rapido.envia({ tipo: "entrarMesa", codigo, apelido: "Cedo", assento: 1 });
    assert.equal(rapido.ultimo("entrou").assento, 1);

    // O atrasado age com a foto velha.
    atrasado.limpar();
    atrasado.envia({ tipo: "entrarMesa", codigo, apelido: "Tarde", assento: 1 });
    assert.equal(atrasado.ultimo("entrou"), null, "a foto velha sentou alguém");
    assert.equal(atrasado.ultimo("erro").codigo, RECUSA_ASSENTO_OCUPADO);
    assert.equal(srv.ger.salas[codigo].assentos[1].jogadorId, "uid-cedo");

    // E a foto NOVA já conta a verdade — a revisão andou porque a mesa mudou.
    const agora = mesaDe(pedirDeNovo(atrasado), codigo);
    assert.notEqual(agora.revisao, foto.revisao, "a mesa mudou e a revisão não andou");
    assert.equal(agora.assentos[1].ocupado, true);
  });

  test("COST-06: ocupação e vagas publicadas batem com a autoridade", async () => {
    // §7. Os números da lista não são um contador próprio: são leitura de
    // `sala.assentos`. Depois de uma entrada por pedido explícito, uma recusa e
    // uma reentrada, os três têm de continuar coerentes — é aqui que um
    // contador paralelo apareceria.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);
    const sala = srv.ger.salas[codigo];

    const A = await conectado(srv, "uid-a");
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 3 });
    const B = await conectado(srv, "uid-b");
    B.envia({ tipo: "entrarMesa", codigo, apelido: "B", assento: 3 }); // recusado
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 1 }); // reentrada

    const m = mesaDe(pedirDeNovo(A), codigo);
    const ocupadosReais = sala.assentos.filter(Boolean).length;
    assert.equal(ocupadosReais, 2, "a reentrada ocupou um segundo lugar");
    assert.equal(m.ocupados, ocupadosReais);
    assert.equal(m.vagas, 4 - ocupadosReais);
    assert.equal(m.jogadores, 2);
    assert.equal(m.ingressavel, true);
    assert.deepEqual(m.assentos.map((a) => a.ocupado), [true, false, false, true]);
  });

  test("COST-07: repetir o mesmo pedido é idempotente na fotografia", async () => {
    // §10.3. Mandar `entrarMesa` três vezes — de propósito, ou por retry de
    // rede — não pode render três lugares nem mover o jogador. A lista é onde
    // isso apareceria primeiro, e é onde ninguém olharia.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);
    const A = await conectado(srv, "uid-a");

    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 2 });
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 2 });
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 2 });

    const acks = A.todas("entrou");
    assert.equal(acks.length, 3, "cada pedido recebe resposta");
    for (const a of acks) assert.equal(a.assento, 2, "a repetição moveu o jogador");
    assert.equal(acks[1].reconexao, true, "a repetição não foi marcada como volta");

    const m = mesaDe(pedirDeNovo(A), codigo);
    assert.equal(m.ocupados, 2);
    assert.equal(m.jogadores, 2);
  });

  test("COST-08: nada da escolha de assento vaza na fotografia", async () => {
    // A varredura é do payload SERIALIZADO contra os segredos vivos, e não uma
    // leitura da lista branca — lista branca descreve intenção, varredura mede
    // resultado. Entram no varal os uids, e também a MARCA de reserva, que é
    // vocabulário novo desta composição e que nenhuma das duas entradas tinha
    // como incluir no seu próprio varal.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv, "uid-dono-secreto");
    const A = await conectado(srv, "uid-a-secreto");
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 2 });

    const sala = srv.ger.salas[codigo];
    const lista = pedirDeNovo(A);
    semVazamento(lista, [
      "uid-dono-secreto",
      "uid-a-secreto",
      sala.assentos[0] && sala.assentos[0].admissaoId,
      sala.assentos[2] && sala.assentos[2].admissaoId,
    ]);
    // E o campo `reservas` não atravessa nem vazio.
    assert.ok(!JSON.stringify(lista).includes("reservas"), "`reservas` atravessou o fio");
  });

  test("COST-09: a modalidade no fio vem da autoridade, sem saneamento cego", async () => {
    // §8. A chave do FIO é `sbtl`, que é o vocabulário do motor — o mesmo valor
    // que `criarJogo` e `MODALIDADES` usam. Trocá-lo aqui por `STBL` seria
    // saneamento cego de valor de fio, que a OS proíbe: o rótulo `STBL` é o que
    // a TELA mostra, e a tela não é deste repositório.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);
    const A = await conectado(srv, "uid-1");
    const lista = pedirLista(A);
    const m = mesaDe(lista, codigo);

    assert.equal(m.modalidade, "sbtl");
    assert.equal(m.modalidade, srv.ger.salas[codigo].modalidade, "a lista inventou modalidade");
    assert.ok(Object.prototype.hasOwnProperty.call(lista.presenca.porModalidade, "sbtl"),
      "a contagem por modalidade não usa a chave do fio");
    // O servidor NÃO emite o rótulo: quem o emitisse teria de decidir idioma e
    // maiúsculas, e isso é decisão de apresentação.
    assert.ok(!JSON.stringify(lista).includes("STBL"), "o servidor emitiu rótulo de tela");
  });

  test("COST-10: recusa de assento não move presença, revisão nem versão", async () => {
    // Uma recusa é um não-evento para todo mundo menos para quem pediu. Se ela
    // movesse a revisão, cada tentativa frustrada faria a lista de todos os
    // clientes parecer nova — e a §5 do versionamento é explícita: nada que não
    // seja mutação pode fingir ser versão nova.
    const { srv } = bancada();
    const { codigo } = await mesaAberta(srv);
    const sala = srv.ger.salas[codigo];
    const A = await conectado(srv, "uid-a");

    const antes = mesaDe(pedirLista(A), codigo);
    const presencaAntes = pedirDeNovo(A).presenca.jogadoresOnlineTotal;
    const versaoAntes = sala.versaoEstado;

    A.limpar();
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 0 });   // ocupado
    A.envia({ tipo: "entrarMesa", codigo, apelido: "A", assento: 9 });   // inválido
    assert.equal(A.todas("erro").length, 2);
    assert.equal(A.todas("erro")[0].codigo, RECUSA_ASSENTO_OCUPADO);
    assert.equal(A.todas("erro")[1].codigo, RECUSA_ASSENTO_INVALIDO);
    assert.equal(A.ultimo("entrou"), null);

    const depois = mesaDe(pedirDeNovo(A), codigo);
    assert.equal(depois.revisao, antes.revisao, "a recusa moveu a revisão da mesa");
    assert.equal(sala.versaoEstado, versaoAntes, "a recusa moveu a versão do estado");
    assert.equal(pedirDeNovo(A).presenca.jogadoresOnlineTotal, presencaAntes);
    assert.deepEqual(sala.reservas, [null, null, null, null], "a recusa deixou reserva presa");
  });

  test("COST-12: as suítes das DUAS entradas continuam registradas e cheias", () => {
    // A guarda mora em `censo_de_suites.js`, fora do glob, e é chamada daqui E
    // das duas suítes de entrada. A primeira versão morava SÓ aqui, e a campanha
    // a derrubou no ato: tirar esta suíte do glob levava a guarda junto. Guarda
    // que não sobrevive à própria remoção não é guarda — ver o cabeçalho do
    // módulo para o desenho recíproco que substituiu aquela.
    return conferirCenso();
  });

  test("COST-12b: o censo é RECÍPROCO — as três suítes o chamam", () => {
    // A prova de que a reciprocidade existe de fato, e não só no comentário:
    // as duas suítes de entrada TÊM de chamar o censo. Sem esta leitura, alguém
    // removeria a chamada de uma delas e a guarda voltaria a ser unilateral —
    // silenciosamente, porque nada mais mediria isso.
    // OS COMENTÁRIOS SÃO RECORTADOS ANTES DE MEDIR, e isto não é zelo: a
    // primeira versão deste caso lia o arquivo cru, e a campanha a derrubou
    // com a sabotagem mais barata que existe — trocar `conferirCenso();` por
    // `// conferirCenso();`. O texto continuava lá, a asserção continuava
    // verde, e a chamada não acontecia mais. Prova textual que não separa
    // código de comentário mede a prosa, não o programa.
    const semComentarios = (t) => t
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

    const dir = __dirname;
    for (const arquivo of ["assento_autoritativo.test.js", "descoberta.test.js"]) {
      const bruto = fs.readFileSync(path.join(dir, arquivo), "utf8");
      const texto = semComentarios(bruto);
      // Trava contra o próprio recorte: limpeza que comesse o arquivo faria as
      // duas asserções abaixo passarem por vacuidade.
      assert.ok(texto.includes("require("), "a limpeza comeu o código de " + arquivo);
      assert.match(texto, /require\(["']\.\/censo_de_suites\.js["']\)/,
        arquivo + " deixou de carregar o censo — a reciprocidade quebrou");
      assert.match(texto, /(?:^|[^/])\bconferirCenso\s*\(/m,
        arquivo + " carrega o censo mas não o executa");
    }
  });

  test("COST-12c: o portão continua sendo o glob", () => {
    // O ÚNICO PORTÃO DESTE REPOSITÓRIO É `npm test`, e ele é um GLOB
    // (`test/*.test.js`). Glob não tem manifesto: apagar um arquivo de suíte, ou
    // renomeá-lo para fora do padrão, faz os casos dele pararem de rodar e o
    // portão continuar VERDE. Numa composição isso é o risco número um — o §10.1
    // exige que nenhum caso desapareça, e sem esta guarda "não desapareceu" seria
    // uma afirmação que ninguém verifica.
    //
    // Isto NÃO é um segundo agregador nem um porteiro concorrente: é um caso
    // dentro do portão que já existe, na mesma disciplina estrutural do GATE-09.
    // O manifesto de verdade — com digest de ferramenta e piso por arquivo — vive
    // na família OS 23.1-P, que não é ancestral desta linhagem e não tem PASS
    // final. Importá-lo aqui seria trazer autoridade não arbitrada.
    const dir = __dirname;

    // Piso por arquivo, não contagem exata: contagem exata vira manutenção e
    // convida a "ajustar o número", que é como um caso sumido volta a passar.
    const OBRIGATORIAS = {
      "assento_autoritativo.test.js": 25,   // OS 41 — escolha autoritativa
      "descoberta.test.js": 90,             // OS 38.1 — descoberta e presença
      "chat_transporte.test.js": 28,        // Comunicação Controlada (ff3ddbe)
      "chat_contrato.test.js": 10,
      "controlador_assento.test.js": 24,
      "gate_vip.test.js": 58,
      "costura_assento_descoberta.test.js": 12, // esta, contra a própria remoção
    };

    const presentes = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js"));
    for (const [arquivo, piso] of Object.entries(OBRIGATORIAS)) {
      assert.ok(presentes.includes(arquivo),
        "suíte obrigatória sumiu ou foi renomeada para fora do glob: " + arquivo);
      const texto = fs.readFileSync(path.join(dir, arquivo), "utf8");
      // `\btest\s*\(` conta TAMBÉM os subtestes (`t.test(`), que é como a suíte
      // da descoberta declara os 97 casos dela. Um contador que exigisse `test(`
      // no início da expressão devolveria 10 para um arquivo cheio — e um piso
      // satisfeito por engano é pior que piso nenhum: ele afirma cobertura que
      // não mediu. Custou uma volta descobrir isso, e é por isso que os pisos
      // abaixo foram calculados com ESTE contador, nunca escritos de cabeça.
      const casos = (texto.match(/\btest\s*\(/g) || []).length;
      assert.ok(casos >= piso,
        arquivo + " caiu para " + casos + " casos, abaixo do piso " + piso +
        " — suíte esvaziada ou substituída por corpo trivial");
    }

    // E o alvo do portão continua sendo o GLOB, não uma lista que possa ser
    // desviada para uma suíte-isca.
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "..", "package.json"), "utf8"));
    assert.match(pkg.scripts.test, /--test\s+"?test\/\*\.test\.js"?/,
      "o comando oficial deixou de varrer test/*.test.js");
  });

  test("COST-11: a fotografia não conhece reserva — e é isso que está decidido", async () => {
    // DECISÃO DE UNIÃO SEMÂNTICA, escrita porque o merge textual não a tomou.
    //
    // `ocupacaoSanitizada` lê `sala.assentos`, e só. Um assento com RESERVA em
    // voo aparece como LIVRE. Foi decidido assim, e não por omissão:
    //
    //  - a reserva dura o tempo de um backend responder, e publicá-la faria a
    //    mesa piscar entre cheia e vaga a cada tentativa frustrada;
    //  - publicá-la moveria `ocupados`, `vagas` e `ingressavel`, e portanto a
    //    REVISÃO da mesa — uma foto nova para todos os clientes por causa de um
    //    estado que nenhum deles pode ver;
    //  - e não custa correção nenhuma: quem pedir o assento reservado recebe
    //    recusa tipada, que é exatamente o que a foto velha já produz.
    //
    // O caso é estrutural porque o comportamental não é alcançável pelo fio da
    // descoberta: mesa reservável é VIP, e mesa VIP não é publicável.
    const FONTE = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    const i = FONTE.indexOf('__fabricas["descoberta"]');
    const j = FONTE.indexOf('__fabricas["auth_firebase"]', i);
    assert.ok(i >= 0 && j > i, "não achei o módulo descoberta no bundle");
    const MOD = FONTE.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    assert.ok(MOD.includes("function ocupacaoSanitizada"), "a limpeza comeu o código");

    assert.ok(!/\breservas\b/.test(MOD),
      "a descoberta passou a ler `reservas` — a decisão mudou e o laudo não");
    assert.ok(!/\bassentoLivre\b|\breservaDe\b/.test(MOD),
      "a descoberta passou a usar a primitiva de reserva");

    // E a mesa reservável de fato não é publicável, que é o que torna o caso
    // acima suficiente.
    const D = bundle.require("descoberta");
    assert.equal(D.CATEGORIA_PUBLICA, "casual");
    assert.equal(D.ehPublicavel({
      codigo: "M-01", tipoPartida: "publica", categoriaCompetitiva: "vip_ranqueada",
      assentos: [null, null, null, null], metaPontos: 2000, modalidade: "sbtl",
    }), false, "mesa VIP entrou na descoberta");
  });
});

// ===========================================================================
// [OS 52-C1] §11 — A UNICIDADE DO PORTADOR, E A GUARDA DELA CONTRA SI MESMA.
//
// A regra vive em `censo_de_suites.js` e é chamada de dentro de
// `conferirCenso`, então já roda nas TRÊS suítes obrigatórias. O que estes
// casos acrescentam é o que a chamada sozinha não prova:
//
//   * que a regra REPROVA de fato — exercitada contra árvores forjadas, uma
//     por vetor. Prova textual não distingue regra viva de corpo esvaziado, e
//     um `function conferirUnicidadeDoBundle() {}` deixaria o portão verde com
//     quatro servidores no repositório;
//   * que `conferirCenso` continua CHAMANDO a regra — porque apagar a chamada
//     é mais barato que apagar a função, e o texto do módulo continuaria
//     idêntico ao de uma guarda viva.
//
// A leitura textual recorta comentários antes de medir, com trava contra o
// próprio recorte, pela razão que COST-12b já pagou: `// conferirCenso();`
// mantém o texto, mantém a asserção verde e mata a chamada.
//
// NENHUMA ASSINATURA APARECE ESCRITA AQUI, e isso não é estilo. A camada 2 da
// regra varre o repositório inteiro, `test/` incluído: um caso que escrevesse
// a chamada de arranque por extenso — ainda que só para forjar a sabotagem —
// faria a guarda reprovar a árvore íntegra, e a primeira pessoa a ver o portão
// vermelho sem defeito nenhum removeria a guarda. Os trechos de sabotagem são
// EXTRAÍDOS do `server.js` real pelos próprios padrões exportados, o que de
// quebra torna o caso mais forte: prova que uma cópia DESTE servidor é
// detectada, não que uma string inventada é detectada.
// ===========================================================================

test.describe("§11 — UNICIDADE DO PORTADOR DO CONTRATO (OS 52-C1)", () => {
  const os = require("node:os");

  const FONTE_DO_PORTADOR = fs.readFileSync(
    path.join(__dirname, "..", "server.js"), "latin1"
  );

  /** O trecho REAL do bundle que casa com `padrao`, mais um rabo de contexto. */
  function trechoReal(padrao, rabo) {
    const achado = FONTE_DO_PORTADOR.match(padrao);
    assert.ok(achado, "o padrão não reconhece mais o próprio `server.js`");
    const i = achado.index;
    return FONTE_DO_PORTADOR.slice(i, i + achado[0].length + (rabo || 0));
  }

  /** Uma árvore forjada, descartável, com o portador legítimo dentro.
   *
   *  O portador entra de propósito: sem ele, "a árvore correta passa" não
   *  provaria que a isenção existe — provaria só que uma pasta vazia não tem
   *  servidor nenhum. */
  const FORJADAS = [];
  function arvoreForjada() {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "uni-"));
    fs.writeFileSync(path.join(raiz, "server.js"), FONTE_DO_PORTADOR);
    FORJADAS.push(raiz);
    return raiz;
  }

  // Árvore forjada é lixo de bancada, não artefato. Sem isto o diretório
  // temporário do Windows acumula uma cópia do bundle por execução.
  test.after(() => {
    for (const raiz of FORJADAS) {
      try { fs.rmSync(raiz, { recursive: true, force: true }); } catch (_) {}
    }
  });

  test("UNI-01: a regra reprova a DUPLICATA RESTAURADA na raiz", () => {
    // Um vetor por assinatura larga, com os nomes das duplicatas que a OS 52
    // mediu — para o caso falar da coisa real e não de um exemplo.
    const nomes = ["server_js.txt", "mesa-online.html", "mesa-online_rc.html"];
    ASSINATURAS_DE_SERVIDOR.forEach(([oQue, padrao], i) => {
      const raiz = arvoreForjada();
      fs.writeFileSync(path.join(raiz, nomes[i]), trechoReal(padrao, 300));
      assert.throws(
        () => conferirUnicidadeDoBundle(raiz),
        /segundo portador do contrato na raiz/,
        "duplicata restaurada passou (" + oQue + "): " + nomes[i]
      );
    });
  });

  test("UNI-02: a regra reprova a duplicata RENOMEADA", () => {
    // A sabotagem mais barata depois da restauração: o mesmo conteúdo com
    // outro nome, inclusive um que não parece código.
    const [, primeira] = ASSINATURAS_DE_SERVIDOR[0];
    for (const nome of ["servidor_antigo.bak", "NOTAS.md", "z", "server2.js"]) {
      const raiz = arvoreForjada();
      fs.writeFileSync(path.join(raiz, nome), trechoReal(primeira, 300));
      assert.throws(
        () => conferirUnicidadeDoBundle(raiz),
        /segundo portador do contrato na raiz/,
        "renomear escapou: " + nome
      );
    }
  });

  test("UNI-03: a regra reprova a SEGUNDA INICIALIZAÇÃO, em qualquer subpasta", () => {
    // A camada 1 não desce em `test/` nem `docs/` — não pode, porque as suítes
    // citam as fábricas do bundle legitimamente. Quem fecha a duplicata movida
    // para subpasta é o arranque, e é isto que este caso mede.
    const arranque = trechoReal(ARRANQUE_DO_TRANSPORTE, 20);
    for (const rel of ["docs/velho.js", "test/isca.js", "guardado/server.js"]) {
      const raiz = arvoreForjada();
      const destino = path.join(raiz, rel);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, arranque);
      assert.throws(
        () => conferirUnicidadeDoBundle(raiz),
        /segunda inicialização de servidor/,
        "arranque em subpasta escapou: " + rel
      );
    }
  });

  test("UNI-04: a regra reprova PACOTE COMPACTADO na raiz, pela forma", () => {
    // O vetor que a varredura textual não alcança. O conteúdo é deliberadamente
    // inócuo: o ponto é que a decisão acontece ANTES de ler, porque ler
    // conteúdo empacotado não é possível. Foi assim que um `server.js` de 4.414
    // linhas, com o próprio `package.json`, ficou invisível para o portão.
    for (const nome of ["buraco-servidor.zip", "backup.tar", "x.7z", "app.jar"]) {
      const raiz = arvoreForjada();
      fs.writeFileSync(path.join(raiz, nome), "nada de mais aqui dentro");
      assert.throws(
        () => conferirUnicidadeDoBundle(raiz),
        /pacote compactado na raiz/,
        "pacote passou: " + nome
      );
    }
  });

  test("UNI-05: a ÁRVORE CORRETA passa — a regra não é um veto geral", () => {
    // Primeira metade: o portador é ISENTO, e uma árvore que só o contém está
    // limpa. Sem esta, uma regra que reprovasse TUDO passaria em UNI-01..04 e
    // derrubaria o repositório íntegro — que é como uma guarda nova morre.
    const raiz = arvoreForjada();
    fs.writeFileSync(
      path.join(raiz, "app.html"),
      "<script>enviar({ tipo: 'entrarMesa', codigo: c });</script>"
    );
    fs.mkdirSync(path.join(raiz, "contrato"), { recursive: true });
    fs.writeFileSync(path.join(raiz, "contrato", "x.json"), "{}");
    conferirUnicidadeDoBundle(raiz);

    // Segunda metade: o repositório REAL. `app.html`, os cinco `mutacoes_*.js`,
    // as suítes e os documentos convivem com a guarda — medido, não suposto.
    conferirUnicidadeDoBundle();
  });

  test("UNI-06: `conferirCenso` ALCANÇA a unicidade — a guarda não é órfã", () => {
    // Apagar a CHAMADA é mais barato que apagar a função, e o módulo ficaria
    // com o texto de uma guarda viva. Este caso monta um repositório inteiro
    // — o `test/` real e o `package.json` real, para o censo passar em tudo o
    // que ele já sabia conferir —, planta UM segundo portador na raiz e chama
    // `conferirCenso`. Se a chamada da unicidade sumir do corpo dele, nada
    // reprova, e é exatamente isso que este caso mede.
    //
    // A PRIMEIRA VERSÃO ERA TEXTUAL, e estava errada. Lia o censo sem
    // comentários, como COST-12b, e o recorte de bloco casou com a abertura
    // de comentário que existe DENTRO da string do glob — engolindo do meio
    // do arquivo até o próximo fechamento, com a chamada junto. A trava
    // contra o recorte não pegou, porque o que sumiu foi o miolo, não o
    // começo. Recorte de comentário por expressão regular não sabe o que é
    // string, e num módulo que carrega padrões de busca isso não é risco
    // teórico — foi o que aconteceu. Prova executável não tem esse problema.
    const raiz = arvoreForjada();
    const testeForjado = path.join(raiz, "test");
    fs.mkdirSync(testeForjado, { recursive: true });
    for (const arquivo of fs.readdirSync(__dirname)) {
      const de = path.join(__dirname, arquivo);
      if (fs.statSync(de).isFile()) fs.copyFileSync(de, path.join(testeForjado, arquivo));
    }
    fs.copyFileSync(
      path.join(__dirname, "..", "package.json"),
      path.join(raiz, "package.json")
    );

    // Linha de base: sem o segundo portador o censo forjado passa inteiro.
    // Sem ela, este caso poderia estar reprovando por qualquer outro motivo.
    conferirCenso(testeForjado);

    const [oQue, padrao] = ASSINATURAS_DE_SERVIDOR[0];
    fs.writeFileSync(path.join(raiz, "server_js.txt"), trechoReal(padrao, 300));
    assert.throws(
      () => conferirCenso(testeForjado),
      /segundo portador do contrato na raiz/,
      "`conferirCenso` deixou de alcançar a unicidade — " + oQue
    );
  });

  test("UNI-07: as assinaturas descrevem o PORTADOR REAL, e não a si mesmas", () => {
    // Trocar cada padrão por algo que não casa com nada deixaria UNI-01..04
    // vermelhos, então este caso não é a única defesa. Ele existe para NOMEAR a
    // falha: assinatura que não reconhece o próprio bundle não protege nada.
    for (const [oQue, padrao] of ASSINATURAS_DE_SERVIDOR) {
      assert.ok(padrao.exec(FONTE_DO_PORTADOR) !== null,
        "a assinatura `" + oQue + "` não reconhece mais o próprio `server.js`");
    }
    assert.ok(ARRANQUE_DO_TRANSPORTE.exec(FONTE_DO_PORTADOR) !== null,
      "o arranque não reconhece mais o próprio `server.js`");

    // E o outro lado: nenhuma pode casar com o texto da PRÓPRIA guarda. Guarda
    // que se denuncia sozinha reprova a árvore íntegra e é removida por
    // incômodo — é o modo de falha que a OS 44 já pagou duas vezes.
    const fonteDaGuarda = fs.readFileSync(
      path.join(__dirname, "censo_de_suites.js"), "latin1"
    );
    assert.ok(ARRANQUE_DO_TRANSPORTE.exec(fonteDaGuarda) === null,
      "a assinatura do arranque passou a casar com o próprio censo");
    for (const [oQue, padrao] of ASSINATURAS_DE_SERVIDOR) {
      assert.ok(padrao.exec(fonteDaGuarda) === null,
        "a assinatura `" + oQue + "` passou a casar com o próprio censo");
    }
  });
});
