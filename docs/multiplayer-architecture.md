# Arquitectura multiplayer

## Resultado

O modo local continua a chamar directamente o domínio puro e a persistir na IndexedDB. O modo multiplayer usa as mesmas funções de domínio (`createSession`, `createRound`, `confirmRound`, passes, pontuação, vitória e desempate), mas todas as mutações passam por `MultiplayerService`, no servidor.

```text
Domínio único do jogo
├── modo local → React + IndexedDB, offline
└── multiplayer → MultiplayerService autoritativo
                    ├── WebSocketTransport (Internet ou LAN)
                    └── persistência temporária rooms.json
```

## Módulos

- `src/multiplayer/types.ts`: sala, presença, revisão e mensagens partilhadas;
- `src/multiplayer/transport.ts`: contrato `MultiplayerTransport`, WebSocket, fila, reconexão e credenciais locais;
- `src/multiplayer/stateSync.ts`: aplicação testável de snapshots/patches, relógio e detecção de lacunas;
- `server/multiplayerService.ts`: autorização, estado autoritativo, timers, pontuação, privacidade, reconexão e persistência;
- `server.mjs`: HTTP, QR/deep link, upgrade WebSocket, heartbeat e difusão por papel;
- `src/ui/MultiplayerApp.tsx`: criação/entrada, lobby, equipas, duelo, ronda privada, revisão e classificação.

## Protocolo e redes lentas

Ao criar, entrar, recuperar a sessão ou pedir `SYNC_STATE`, o cliente recebe `ROOM_STATE`. As mutações seguintes produzem `ROOM_PATCH` apenas com campos de topo alterados e uma `stateVersion` monotónica. Eventos repetidos/antigos são ignorados; uma lacuna de versão pede um novo snapshot. Cada comando tem `actionId` e o servidor conserva os 200 identificadores mais recentes para impedir aplicação duplicada por múltiplos toques/reenvios.

O servidor envia `serverNow`, `roundEndsAt` e não envia contagens por segundo. O cliente calcula a diferença entre relógios; o servidor valida o prazo real. Heartbeats detectam sockets que ficaram silenciosamente inactivos, enquanto o cliente reconecta com backoff exponencial e `sessionToken`.

## Privacidade e autorização

Durante `ROUND_ACTIVE`, apenas o snapshot do explicador contém `round.words`. Colegas e adversários recebem apenas equipa, explicador, estado e timestamps. Na revisão, todos recebem os resultados. Tokens de sessão e a lista de acções processadas nunca entram no snapshot público.

O servidor valida host, pertença à sala, fase, explicador, palavra, prazo, passe, voto e confirmação. A pontuação só é calculada uma vez, depois de todas as confirmações activas e sem disputas pendentes, ou por finalização do host após 30 segundos.

## Presença, falhas e persistência

Uma queda marca `DISCONNECTED` sem remover o jogador. Se for o explicador, a ronda guarda o tempo restante e pausa; ao regressar, continua o mesmo cartão. Depois de 15 segundos, o host pode encerrar a ronda pausada. Se o host não voltar, o servidor transfere deterministicamente o papel ao participante ligado há mais tempo.

Salas são gravadas atomicamente em `.data/rooms.json` e expiram após seis horas sem actividade. Num reinício, todos regressam como desconectados e uma ronda que estava activa regressa pausada. Esta persistência em ficheiro é adequada ao MVP numa única instância. Escala horizontal exigirá armazenamento partilhado/pub-sub e encaminhamento consistente por sala.

## 1 vs 1

A interface fala em jogadores, embora internamente cada pessoa ocupe uma equipa de um elemento para reutilizar pontuação, vitória e turnos. Em **Alternado**, cada jogador explica uma ronda; em **Duelo**, cada jogador explica duas. Os dois confirmam a revisão. Numa contestação, ambos votam; um empate 1–1 anula a palavra (`wrong`).

## Decisão LAN

Uma PWA não consegue descobrir de forma portátil outros browsers na LAN nem abrir um servidor WebSocket no telefone. WebRTC também precisa de signalling, gestão ICE/STUN/TURN e não elimina o servidor de descoberta; acrescentá-lo agora reduziria a fiabilidade do MVP. Assim, o `WebSocketTransport` é usado tanto pela Internet como na mesma LAN. O QR/link usa o host pelo qual a aplicação foi aberta. A abstracção permite acrescentar `WebRTCTransport` mais tarde sem alterar o domínio.

## Publicação

Internet real requer uma instância pública que suporte processos Node persistentes e upgrade WebSocket, HTTPS/WSS e volume persistente para `.data`. Proxies devem encaminhar `/ws` com upgrade e preservar `Host`/`X-Forwarded-Proto`, para que o QR gere o domínio correcto. Hospedagem puramente estática não executa multiplayer.
