# PALAVRA 30s

PWA mobile-first para um jogo presencial de palavras por equipas. A interface segue os 19 ecrãs do mockup Lovable e o comportamento segue a especificação funcional de `30segundos.md`.

O MVP inclui Partida Rápida local, Regras da Casa, equipas equilibradas ou dinâmicas, jogadores opcionais, rotação de explicadores, dois modos de vitória, desempate, revisão, pista, ranking, estatísticas reais, histórico, baralhos personalizados, funcionamento offline, multiplayer em vários telemóveis, 1 vs 1 e um contador simples de visitantes anónimos com painel administrativo. Em ecrãs desktop, a interface ocupa a janela responsivamente sem simular a moldura de um telemóvel.

## Executar localmente

```bash
npm install
npm run dev
```

O servidor abre em `http://localhost:5174`, disponibiliza a aplicação, o WebSocket multiplayer em `/ws` e os QR Codes das salas. Guarda métricas em `.data/analytics.json` e salas temporárias em `.data/rooms.json`. É possível alterar o porto com `PORT`, o ficheiro de métricas com `ANALYTICS_DATA_PATH` e o ficheiro das salas com `MULTIPLAYER_DATA_PATH`.

Na mesma rede Wi-Fi, os outros dispositivos entram por `http://IP-DA-MAQUINA:5174` e usam o mesmo código/QR. Para jogar pela Internet, esta mesma aplicação deve ser publicada num servidor acessível por todos, com HTTPS e encaminhamento de WebSocket (`wss://`) no mesmo domínio. O modo local continua independente do servidor e funciona offline.

O acesso “Administração” aceita, nesta versão MVP, apenas `naeemjulaya7@gmail.com`. Esta identificação não possui palavra-passe e deverá ser substituída por autenticação real antes de expor operações ou dados sensíveis.

## Verificar

```bash
npm run test
npm run build
```

## Estrutura

- `src/game/domain`: regras puras do jogo;
- `src/game/infrastructure`: persistência da sessão em IndexedDB;
- `src/decks`: conteúdo local dos baralhos iniciais;
- `src/analytics`: identificação anónima do dispositivo e sessão administrativa do MVP;
- `src/multiplayer`: protocolo partilhado, transporte WebSocket, reconexão e sincronização versionada;
- `src/ui`: ecrãs e componentes visuais;
- `server`: estado autoritativo multiplayer, persistência temporária e armazenamento das métricas;
- `public`: manifesto, ícone e Service Worker da PWA.

As decisões, justificações, divergências e estado de implementação são mantidos no documento de especificação. A arquitectura e o protocolo multiplayer estão resumidos em [`docs/multiplayer-architecture.md`](docs/multiplayer-architecture.md).
