# Arquitectura multiplayer

## Resultado

O modo local continua a chamar directamente o domínio puro e a persistir na IndexedDB. O modo multiplayer usa as mesmas funções de domínio (`createSession`, `createRound`, `confirmRound`, passes, pontuação, vitória e desempate), mas todas as mutações passam por `MultiplayerService`, no servidor.

```text
Domínio único do jogo
├── modo local → React + IndexedDB, offline
└── multiplayer → MultiplayerService autoritativo e partilhado
                    ├── Node local → WebSocket + rooms.json
                    └── Cloudflare → um Durable Object SQLite por sala
```

## Módulos

- `src/multiplayer/types.ts`: sala, presença, revisão e mensagens partilhadas;
- `src/multiplayer/transport.ts`: contrato `MultiplayerTransport`, WebSocket, fila, reconexão e credenciais locais;
- `src/multiplayer/stateSync.ts`: aplicação testável de snapshots/patches, relógio e detecção de lacunas;
- `server/multiplayerService.ts`: autorização, estado autoritativo, timers, pontuação, privacidade, reconexão e persistência;
- `server.mjs`: backend integrado para desenvolvimento local;
- `cloudflare/worker.ts`: backend de produção, Durable Objects, SQLite, alarms, WebSocket Hibernation, QR e analytics;
- `src/ui/MultiplayerApp.tsx`: criação/entrada, lobby, equipas, duelo, ronda privada, revisão e classificação.

## Protocolo e redes lentas

Ao criar, entrar, recuperar a sessão ou pedir `SYNC_STATE`, o cliente recebe `ROOM_STATE`. As mutações seguintes produzem `ROOM_PATCH` apenas com campos de topo alterados e uma `stateVersion` monotónica. Eventos repetidos/antigos são ignorados; uma lacuna de versão pede um novo snapshot. Cada comando tem `actionId` e o servidor conserva os 200 identificadores mais recentes para impedir aplicação duplicada por múltiplos toques/reenvios.

O servidor envia `serverNow`, `roundEndsAt` e não envia contagens por segundo. O cliente calcula a diferença entre relógios; o servidor valida o prazo real. Heartbeats detectam sockets que ficaram silenciosamente inactivos, enquanto o cliente reconecta com backoff exponencial e `sessionToken`.

Para reduzir a latência percebida, acertos, passes e o indicador de pronto são apresentados de forma optimista no dispositivo que actuou. Isto não altera a autoridade: o servidor valida o comando, o patch seguinte reconcilia o cliente e qualquer rejeição provoca um `SYNC_STATE`. Criação e entrada mantêm confirmação autoritativa e mostram um estado de ligação para impedir pedidos duplicados.

Ao abandonar uma sala, o cliente apaga primeiro as credenciais e regressa imediatamente ao menu. A remoção autoritativa segue por `POST /api/rooms/:code/leave` com `keepalive`, autenticada pelo `playerId` e `sessionToken`, para sobreviver ao fecho do componente ou à navegação. O servidor remove o participante, transfere o host quando necessário e actualiza os restantes sockets.
Depois de a saída começar, o transporte também ignora respostas de criação/entrada e mensagens WebSocket que já estavam em trânsito. Assim, uma mensagem tardia nunca volta a guardar credenciais que acabaram de ser eliminadas.
O controlo de abandono permanece disponível durante a espera da ronda, ronda activa ou pausada, revisão e intervalo entre rondas; sair não depende de a partida regressar ao lobby.

## Privacidade e autorização

Durante `ROUND_ACTIVE`, apenas o snapshot do explicador contém `round.words`. Colegas e adversários recebem apenas equipa, explicador, estado e timestamps. Na revisão, todos recebem os resultados. Tokens de sessão e a lista de acções processadas nunca entram no snapshot público.

O servidor valida host, pertença à sala, fase, explicador, palavra, prazo, passe, voto e confirmação. A pontuação só é calculada uma vez, depois de todas as confirmações activas e sem disputas pendentes, ou por finalização do host após 30 segundos.

## Presença, falhas e persistência

Uma queda marca `DISCONNECTED` sem remover o jogador. Se for o explicador, a ronda guarda o tempo restante e pausa; ao regressar, continua o mesmo cartão. Depois de 15 segundos, o host pode encerrar a ronda pausada. Se o host não voltar, o servidor transfere deterministicamente o papel ao participante ligado há mais tempo.

Localmente, salas são gravadas atomicamente em `.data/rooms.json`. Em produção, cada código é encaminhado deterministicamente para um Durable Object próprio, cujo armazenamento SQLite guarda o estado autoritativo. WebSockets usam Hibernation e attachments para recuperar o jogador após o objecto sair da memória. Alarms encerram rondas, transferem o host e expiram salas sem depender de `setTimeout`. O frontend Vercel comunica directamente com o Worker através de CORS restrito ao domínio de produção.

As mutações iniciam a gravação durável antes do broadcast, mas usam `allowUnconfirmed` com a promessa entregue a `waitUntil`, para não adicionar o tempo de flush do disco a cada mensagem. O alarme só é regravado quando surge um prazo anterior ao já agendado. Uma falha de persistência é registada de forma estruturada. A localização da sala não é fixada: o Cloudflare aproxima o Durable Object do primeiro pedido real, que normalmente é o criador da sala.

Para respeitar a quota do plano gratuito, `SYNC_STATE` e acções idempotentes sem mudança respondem a partir da memória sem regravar a sala. Um alarme que dispara sem alterar o domínio agenda apenas o próximo prazo. O QR Code é uma representação determinística do deep link e é gerado sem instanciar um Durable Object; a entrada continua a validar a existência da sala.

As mutações HTTP, ligações WebSocket e consultas administrativas aceitam apenas o frontend oficial ou origens locais de desenvolvimento. Rate Limiting no edge limita, por localização e cliente, a criação de salas (5/minuto), entrada/saída/reconexão (30/minuto) e registo ou consulta analítica (10/minuto). Pedidos bloqueados recebem `403` ou `429` antes de invocar armazenamento durável, isolando o jogo de abuso ao contador e de criação automática de salas.

## 1 vs 1

A interface fala em jogadores, embora internamente cada pessoa ocupe uma equipa de um elemento para reutilizar pontuação, vitória e turnos. Em **Alternado**, cada jogador explica uma ronda; em **Duelo**, cada jogador explica duas. Os dois confirmam a revisão. Numa contestação, ambos votam; um empate 1–1 anula a palavra (`wrong`).

## Decisão LAN

Uma PWA não consegue descobrir de forma portátil outros browsers na LAN nem abrir um servidor WebSocket no telefone. WebRTC também precisa de signalling, gestão ICE/STUN/TURN e não elimina o servidor de descoberta; acrescentá-lo agora reduziria a fiabilidade do MVP. Assim, o `WebSocketTransport` é usado tanto pela Internet como na mesma LAN. O QR/link usa o host pelo qual a aplicação foi aberta. A abstracção permite acrescentar `WebRTCTransport` mais tarde sem alterar o domínio.

## Publicação

O frontend é publicado como Vite estático em `https://30segundos.vercel.app`. O backend é publicado pelo Wrangler em `https://trinta-segundos-multiplayer.mazzahub.workers.dev`. O build de produção possui esse endereço como fallback explícito; `VITE_BACKEND_ORIGIN` pode substituí-lo numa futura alteração de domínio. O QR continua a apontar para a rota `/join/CODE` do frontend.
