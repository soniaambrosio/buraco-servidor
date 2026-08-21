# Descoberta autoritativa de mesas públicas e presença agregada V1

**OS 38.1** — primeira etapa da família *Lobby Público / Onde Jogar*.
Backend apenas. Nenhuma tela, nenhuma alteração na autoridade de ingresso.

- **Base:** `buraco-servidor@integracao/servidor-canonico-chat-assento-meta-v1`
  @ `26a08fcbcc7013586d7218d9dbd60b11b7a70ab0`
- **Branch:** `integracao/descoberta-mesas-publicas-presenca-v1`
- **Contrato congelado:** `contrato/descoberta-mesas-v1.json`
- **Suíte:** `test/descoberta.test.js` (87 casos, 97 nós de teste)
- **Provas negativas:** `mutacoes_descoberta.js` — **45/45 detectadas**

Suíte da base: 497 → **594**, zero falhas. Campanhas existentes intactas:
`mutacoes_composicao.js` **16/16**, `mutacoes_os7.js` **12/12**.

> **Um defeito real saiu da campanha.** `aguardandoHaMs` era preenchido *depois*
> de a impressão da mesa ser tirada, então ele valia zero no cálculo e a exclusão
> declarada em `CAMPOS_FORA_DA_REVISAO` era letra morta: a revisão ficava estável
> por **acidente de ordem**, e trocar duas linhas de lugar teria quebrado a
> estabilidade sem tocar em nada que se parecesse com a defesa. O campo passou a
> ser preenchido antes, para que quem o mantenha fora da revisão seja a lista —
> que é onde a decisão está escrita.

---

## 1. O que esta OS acrescenta, e o que ela deliberadamente não toca

Acrescenta **duas autoridades novas**, ambas somente-leitura sobre o que já
existia:

| módulo | responsabilidade |
| --- | --- |
| `presenca` | quantas **pessoas** distintas estão no aplicativo, com lease e vencimento |
| `descoberta` | o **retrato** das mesas públicas: filtragem, sanitização, ordenação, revisão |

E **um campo** na sala: `criadaEm`. Ele existe por uma razão só — o desempate da
ordenação precisa de "quem espera há mais tempo", e isso não era derivável de
nenhum campo anterior. É imutável, vem do relógio do servidor e nenhuma
mensagem o alcança.

**Não toca:** controlador de assento, gate de admissão VIP, mesa privada, meta
canônica, chat, motor de jogo, envelope de encerramento, Functions. `entrarMesa`
continua sendo a única porta de ingresso, exatamente como estava.

---

## 2. Topologia

**Uma instância.** `salas` e `conexoes` são objetos em memória dentro de um
único processo Node. Não há cluster, sticky session nem estado compartilhado.

Isto **não é limitação introduzida por esta OS**: o registro de mesas já era por
processo. Uma mesa criada na réplica A sempre foi invisível na réplica B. A
consequência que importa é a seguinte, e ela está declarada no contrato:

> A presença é exatamente tão global quanto a listagem que ela acompanha. As
> duas descrevem o **mesmo processo**, e nunca uma metade dele.

Se um dia houver réplicas, presença e listagem passam a ser parciais **juntas**,
de forma coerente entre si. Tornar qualquer uma das duas global exige estado
compartilhado — o mesmo que hoje falta para as **mesas** — e isso é arbitragem
de outra OS, não desta.

Provado em `D-73` e `D-74`.

---

## 3. Modelo de presença

### Lease, não contador

Um contador (`entrou++` / `saiu--`) só está certo se **toda saída for
observada**. Queda abrupta — cabo arrancado, aplicativo morto pelo sistema, rede
de celular que some — não produz evento de saída nenhum, e o contador fica alto
para sempre. Esse é o "fantasma" da §6.3.

Com lease não existe fantasma por construção: a presença é uma **afirmação com
validade**. Quem está vivo renova; quem morreu para de renovar e vence sozinho.

### Deduplicação

A chave é o **`uid` autenticado**, e não pode ser outra coisa. Ele é derivado do
`sub` do token verificado, é `writable:false` na conexão, e nenhum campo de
mensagem o alcança (`identidadeDivergente` recusa antes).

- deduplicar por id de conexão contaria **abas**;
- deduplicar por `jogadorId` recebido contaria **o que o cliente quisesse**.

A sessão é o **id da conexão**. Duas abas do mesmo jogador são duas sessões e
uma pessoa. Fechar uma aba fecha uma sessão; a pessoa continua.

### Renovação

Quatro caminhos, e o terceiro é o que faz a presença **não depender de o
aplicativo implementar coisa alguma**:

1. ao vincular identidade / renovar credencial (`armarExpiracao`);
2. em **toda mensagem autenticada** processada;
3. no **PONG do keepalive do WebSocket** — o transporte já mandava PING a cada
   20 s e o PONG era descartado em silêncio; agora ele pulsa a presença. Cobre o
   jogador conectado e parado, olhando a tela sem tocar em nada;
4. em `presenca_ping`, a renovação explícita do cliente.

### Expiração

**TTL de 45 s**, com folga deliberada sobre o keepalive de 20 s: duas batidas
perdidas não derrubam a presença, três derrubam.

A avaliação é **preguiçosa** — em toda leitura, com o relógio injetado, nunca
dependendo de um temporizador ter rodado. É a mesma disciplina da guarda de
credencial em `processar`: validade se confere no ato.

| situação | quem resolve |
| --- | --- |
| desconexão limpa | `desconectar` fecha **aquela** sessão |
| credencial vencida | `expirar` fecha a sessão no mesmo instante em que ela deixa de valer como comando |
| queda abrupta | ninguém avisa; o **vencimento do lease** resolve |

### O cliente renova, o cliente não declara

`presenca_ping` **ignora `msg` por inteiro**. Não existe campo de total, de
contagem, de outro jogador ou de tempo — o argumento é a identidade da conexão e
o relógio é o do servidor. Não é promessa: é **ausência de caminho**. Provado em
`D-67`.

---

## 4. Contrato da projeção

Ver `contrato/descoberta-mesas-v1.json` para as listas fechadas. Resumo:

```
{ tipo: "mesas", esquema, geracao, revisao, geradoEm, mesas[], presenca }
```

Cada mesa:

```
{ codigo, nome, modalidade, metaPontos, capacidade,
  jogadores, bots, ocupados, vagas, assentos[4],
  estadoIngresso, ingressavel, aguardandoHaMs, revisao }
```

Cada assento (quatro sempre, índice = número do assento):

```
{ assento, ocupado, tipo: "humano"|"bot"|null, apelido, avatarGaleria }
```

### Duas medidas diferentes que não se confundem

- **`mesa.jogadores`** é ocupação **da mesa**: assentos de humano. Um assento
  reservado durante a graça de ausência continua contando aqui — é o
  controlador de assento fazendo o trabalho dele.
- **`presenca.jogadoresEmMesasPublicas`** é gente **presente**: só conta quem
  tem lease válido. É por isso que ele nunca passa de `jogadoresOnlineTotal`.

O contraste é medido em `D-49`: a mesa continua com dois; a presença conta um.

---

## 5. Filtros de privacidade

### Três filtros, todos fail-closed

1. **Topologia** — só `tipoPartida === "publica"`. O campo é carimbado na sala a
   partir da **configuração do processo**: `criarMesa` não o recebe e o
   despachante não o monta, então não há mensagem que promova uma mesa privada a
   pública.
2. **Natureza competitiva** — só `casual`. `vip_ranqueada` fica fora porque a
   admissão dela exige direito próprio de cada ocupante, e listar a mesa
   convidaria a bater numa porta que vai recusar. `desconhecida` fica fora
   porque mesa desconhecida não admite ninguém.
3. **Integridade** — meta em `METAS_CANONICAS`, modalidade na tabela do motor,
   `assentos` vetor de 4, código não vazio, sala não encerrada e não liquidada.

### A modalidade é conferida contra o motor

`criarMesa` hoje aceita `msg.modalidade` cru e o motor resolve valor
desconhecido para as regras do `sbtl`. A lista aceita na descoberta é
**derivada** de `MODALIDADES` (tabela do motor), nunca redigitada — acrescentar
uma modalidade lá a torna listável aqui sem tocar em nada. É o §8 ("não confiar
em modalidade enviada pelo cliente") resolvido sem reescrever a criação de mesa,
que é autoridade de outra OS.

**Residual conhecido, para a OS 38.3:** uma mesa criada com modalidade fora da
tabela continua existindo e jogando pelas regras do `sbtl` — ela apenas não
aparece na descoberta. Fechar isso é decidir o que `criarMesa` faz com um valor
desconhecido, e isso é decisão de produto sobre autoridade de criação.

### O que nunca atravessa

`uid`, `jogadorId`, `admissaoId`, `tentativaEntradaId`, token, credencial,
endereço interno, estado do motor, cartas, mão, mesa privada, mesa
VIP/ranqueada, dados administrativos.

A projeção é uma **lista branca construída campo a campo**: o objeto de saída é
montado do zero, nunca copiado do de entrada. A prova não é ler a lista branca
— é uma **varredura do payload serializado** contra os uids realmente vivos
naquele servidor (`D-15`, `D-69`, `D-82`).

### Avatares

Só o **índice da galeria**. Avatar de **foto** fica de fora de propósito: a foto
é servida em `/avatar/<jogadorId>` e `jogadorId` **é** o uid — publicar a foto
na descoberta seria publicar o uid com outro nome. O índice de galeria é um
número de catálogo: não identifica ninguém e não abre rota nenhuma.

---

## 6. Ordenação

Ordem **total** e determinística. Duas execuções sobre o mesmo estado devolvem a
mesma sequência.

1. **ingressável primeiro** — a lista serve para entrar; o que não dá para
   entrar desce, por mais cheio que esteja;
2. **mais perto de completar** — 3, depois 2, depois 1. É sobre **humanos**: uma
   mesa com três pessoas está a uma pessoa de começar; uma com um humano e dois
   bots, não;
3. **esperando há mais tempo** — `criadaEm` crescente, do relógio do servidor,
   imutável;
4. **código** — último desempate, para que a ordem seja total. Sem ele, duas
   mesas idênticas criadas no mesmo milissegundo ficariam em ordem dependente da
   iteração do objeto: instável entre execuções, e é exatamente o tipo de
   instabilidade que faz a lista "pular" na tela sem nada ter acontecido.

**Nenhum critério é escolhível pelo cliente.** `criadaEm` é imutável e o código
é sorteado pelo servidor.

### Mesas já iniciadas: aparecem, marcadas

Decidido a partir do **ciclo de vida real**: `entrarMesa` numa sala iniciada
recusa todo mundo, menos o titular de um assento voltando — que é reconexão, não
ingresso. Então mesa iniciada **não é ingressável**, mas continua existindo,
continua tendo gente dentro e continua podendo ser assistida.

Escondê-la faria a lista mentir sobre onde as pessoas estão; marcá-la de
ingressável faria o jogador bater numa porta fechada. Ela aparece com
`estadoIngresso: "em_andamento"`, `ingressavel: false`, e **não** entra em
"mesas com vagas".

---

## 7. Revisão e atualização

Uma sequência só, **monotônica**, compartilhada entre a revisão global e as
revisões por mesa. Resolve três coisas de uma vez:

- **atualização fora de ordem** — revisão menor ou igual à que o cliente já tem
  é descartada, sem empate ambíguo;
- **código reaproveitado** — uma sala nova com código que já existiu recebe
  revisão **nova**, maior que a da sala morta, e não herda a antiga (`D-58`);
- **retrato atrasado** — chega com o número velho e se identifica como velho
  sozinho (`D-55`).

A impressão que decide se a revisão sobe **ignora os campos derivados do
relógio** (`aguardandoHaMs`, `geradoEm`). Sem isso, a revisão subiria a cada
consulta e o número deixaria de significar "algo mudou" — passaria a significar
"alguém perguntou", que é a mesma coisa que não significar nada (`D-54`).

`geracao` é sorteado no nascimento do registro. A sequência é da **vida do
processo**: reiniciar o servidor volta a revisão para zero. Em vez de fingir
durabilidade que não existe, o retrato diz de qual geração ele é — **geração
diferente é ordem de descartar tudo e ressincronizar**, não de comparar números
que não são comparáveis.

### Coerência do retrato

O retrato é montado de uma vez, numa única linha de execução síncrona, do mesmo
`salas` — não existe ponto de suspensão entre ler uma mesa e ler a seguinte,
então não há retrato meio novo. `D-61` afirma que as partes batem com o resumo
dentro do **mesmo** retrato.

### Sem protocolo paralelo

As duas mensagens andam no **mesmo WebSocket autenticado**, no mesmo
despachante, atrás da mesma fronteira. A atualização é por **pull**: o cliente
pede, o servidor responde com um retrato **completo**. O cliente não reconstrói
nada — que é o §2.9 ("sem fabricar estado no Flutter"). O que ele guarda é
`revisao`, e só para saber se um retrato atrasado deve ser jogado fora.

Assinatura/push fica para a OS 38.2 decidir, se a tela precisar.

---

## 8. Segurança

- **Somente leitura.** A consulta não cria mesa, não senta ninguém, não move o
  controlador e não carimba versão de sala. Provado com 20 consultas seguidas
  contra `impressaoDoEstado` e `versaoEstado` intactos (`D-60`).
- **Autenticada.** As duas mensagens ficam depois da fronteira do protocolo 2.
  Conexão não autenticada e credencial expirada não obtêm nada (`D-62`, `D-63`).
- **`msg` ignorada por inteiro.** Não há filtro, paginação, modalidade,
  `tipoPartida` nem `categoriaCompetitiva` vindos do cliente (`D-68`, `D-72`).
- **Limite de frequência por conexão** — 1 s para a consulta, 5 s para o pulso.
  Recusa **antes** de tocar em `salas`, então o pedido excedente não custa nem a
  varredura. O carimbo mora na conexão: reconectar não devolve crédito
  acumulado, e desconectar não deixa lixo (`D-64`, `D-65`, `D-66`).
- **Sem enumeração de mesa não pública** — mesa privada, simulada, VIP ou sem
  tipo simplesmente não existem no retrato (`D-71`).

---

## 9. Superfície alterada

| arquivo | o quê |
| --- | --- |
| `server.js` | módulos `presenca` e `descoberta`; `criadaEm` na sala; fiação em `criarServidor`; dois `case` no despachante; PONG do transporte |
| `contrato/descoberta-mesas-v1.json` | **novo** — contrato congelado, com digest afirmado na suíte |
| `test/descoberta.test.js` | **novo** — 87 casos |
| `mutacoes_descoberta.js` | **novo** — 45 provas negativas |
| `docs/DESCOBERTA-MESAS-PRESENCA-V1.md` | **novo** — este arquivo |

---

## 10. O que a OS 38.2 recebe pronto

- `descobrirMesas` → lista ordenada, sanitizada e filtrada, com `revisao`;
- `presenca_ping` → renovação de presença com `ttlMs` e intervalo sugerido;
- contagens gerais, públicas e por modalidade, todas por pessoa única;
- `estadoIngresso` / `ingressavel` para a tela saber o que oferecer;
- `aguardandoHaMs` para "esperando há X";
- `geracao` + `revisao` para reconciliar sem inventar estado.

**Não recebe** — e não deve inventar: assinatura/push, paginação, filtro por
modalidade no servidor, e qualquer contagem calculada no cliente.
