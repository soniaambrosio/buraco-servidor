# OS 52-C1 — Aposentadoria das duplicatas de ingresso e proteção da autoridade única

Base: `integracao/servidor-assento-descoberta-presenca-v1` @ `8a0ee4b76ac915705e2e1a37237666a4aab41c39`.

## O que a OS 52 encontrou

A auditoria mediu **pelo fio**, subindo cada artefato numa porta alta, quatro
duplicatas do contrato de ingresso e assento que viviam na raiz deste
repositório. Nenhuma era alcançada pelo despachante — e nenhuma era inofensiva:

| Caso | `server.js` @`8a0ee4b` | `server_js.txt` | `buraco-servidor.zip` |
|---|---|---|---|
| protocolo | autenticado (2) | aberto (1) | aberto (1) |
| pedido válido e livre | atendido | **ignorado** | atendido |
| pedido ocupado | `ASSENTO_OCUPADO` | **senta em outra** | **senta em outra** |
| pedido inválido / `null` / `"2"` | `ASSENTO_INVALIDO` | **senta em outra** | **senta em outra** |
| disputa pela mesma cadeira | um entra, o outro é recusado | **os dois entram** | **os dois entram** |
| reentrada pedindo outro lugar | devolve o assento do titular | **mesmo uid em dois assentos** | **mesmo uid em dois assentos** |
| `codigoRecusa` / `reconexao` | sim | **nunca** | **nunca** |
| identidade | do `sub` do token, imutável | **o que a mensagem disser** | **o que a mensagem disser** |

As duas gêmeas de Node subiam servidor **sozinhas**, na mesma porta padrão: o
arranque do transporte estava fora de qualquer guarda de `require.main`. O zip
carregava ainda um `package.json` com `start` — um pacote implantável completo.

O que fazia disso um risco de release, e não uma curiosidade: **nada reprovava**.
Apagar as quatro deixava o portão em 639/639 verde — e, simetricamente, promover
ou implantar qualquer uma delas também não reprovava.

## O que esta correção faz

1. **Remove** `server_js.txt`, `buraco-servidor.zip`, `mesa-online.html` e
   `mesa-online_rc.html`.
2. **Estende o censo que já existe** (`test/censo_de_suites.js`) com a regra da
   unicidade do portador, chamada de dentro de `conferirCenso` — no mesmo
   `npm test`, pelas mesmas três suítes. Não há segundo portão, segundo
   manifesto nem agregador novo.
3. **Protege a regra contra si mesma**, com sete casos no §11 da suíte de
   costura.

`server.js` não foi tocado. Provado por blob: `server.js`, `app.html`,
`package.json`, os dois contratos e as duas suítes de entrada são byte a byte
idênticos aos de `8a0ee4b`. O fio, o protocolo 2, a ordem automática, as recusas
tipadas, a exclusão mútua da disputa e a reconexão saem desta OS exatamente como
entraram.

## As três camadas da regra, e por que não é uma só

**1 · Raiz, assinaturas largas.** Nenhum arquivo da raiz além do portador
declara, despacha ou registra transporte de salas. Pega a duplicata restaurada e
a duplicata renomeada.

**2 · Repositório inteiro, assinatura estreita.** A camada 1 não pode varrer
`test/` nem `docs/`: as suítes citam as fábricas do bundle para carregar módulos,
e um documento cita a fronteira. **Medido antes de fixar** — sete arquivos de
`test/` e um de `docs/` casam com as assinaturas largas, e todos são legítimos.
O que não aparece em lugar nenhum além do bundle é a linha que **sobe o servidor
sozinha**; essa vale no repositório inteiro, e é ela que fecha a duplicata movida
para uma subpasta.

**3 · Opacidade.** `buraco-servidor.zip` passou pelas camadas 1 e 2 **sem um
único hit** — não por ser inofensivo, mas por estar **comprimido**. Varredura
textual não lê conteúdo empacotado, por construção: uma regra que só sabe ler
texto declara limpo exatamente o vetor mais fácil de implantar por engano. Por
isso pacote compactado na raiz é proibido pela **forma**, não pelo conteúdo.

`app.html` fica. Ele é cliente: fala `entrarMesa` pelo fio e não declara nem
despacha nada. Nenhuma das assinaturas casa com ele — medido, não suposto. Falso
positivo aqui derrubaria o portão íntegro, que é a forma mais rápida de uma
guarda nova ser removida por incômodo.

## Duas armadilhas que custaram esta rodada

**A guarda não pode casar com o próprio texto.** A assinatura do arranque nunca
aparece escrita por extenso — nem no censo, nem nos casos, nem neste documento.
Os trechos de sabotagem são **extraídos do `server.js` real pelos próprios
padrões exportados**, o que além de resolver o problema deixa o caso mais forte:
prova que uma cópia *deste* servidor é detectada, não que uma string inventada é.

**Recorte de comentários por expressão regular não sabe o que é string.** A
primeira versão de UNI-06 era textual, no molde de COST-12b: lia o censo sem
comentários e afirmava que `conferirCenso` chamava a unicidade. Ela reprovou o
repositório íntegro. Causa: o recorte de bloco casou com a abertura de comentário
que existe **dentro da string do glob**, engolindo do meio do arquivo até o
próximo fechamento — a chamada junto. A trava contra o recorte não pegou, porque
o que sumiu foi o miolo e não o começo. UNI-06 virou **prova executável**: monta
um repositório inteiro com o `test/` real, planta um segundo portador na raiz e
exige que `conferirCenso` reprove. Corpo esvaziado e chamada comentada morrem
os dois, e nenhum depende de ler prosa.

## Medição

* Portão: **646/646**, 75 suítes, zero falhas. Eram 639 na base; **nenhum caso
  perdido**, sete acrescentados.
* Campanha de sabotagem: **14/14 detectadas, zero escapes, zero indeterminadas**.
  Restauração de cada uma das quatro duplicatas; duplicata renomeada; duplicata
  em subpasta; segundo arranque escondido num doc; segundo portador recém-escrito;
  regra esvaziada; chamada comentada; assinaturas cegas; censo neutralizado;
  suíte fora do glob; censo apagado. Árvore idêntica antes e depois, conferida
  por `git status` e por digest do módulo.
* O piso da costura subiu de 10 para 23, medido. Piso que não acompanha a guarda
  nova deixa apagar os casos dela sem reprovar — que é o buraco que esta OS
  fecha, repetido um andar acima.

## O que esta OS não fez

Não criou adaptador, não mexeu no fio, não tocou em Comunicação Controlada e não
resolveu o contrato de chat. Fica registrado, para arbitragem própria: o
`contrato/chat-transporte-v1.json` **diverge** entre este repositório e o do
aplicativo (7.997 contra 3.416 bytes), ao contrário de
`contrato/descoberta-mesas-v1.json`, que é byte a byte idêntico nos dois.

Também segue registrado o residual da OS 38.3: `contrato/ingresso-assento-v1.json`
existe só no repositório do aplicativo, amarrado a este servidor por proveniência
(o SHA declarado dentro do JSON) mais digest. Publicar a cópia gêmea aqui é
trabalho de outra OS.
