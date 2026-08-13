# PALAVRA 30s

PWA mobile-first para um jogo presencial de palavras por equipas. A interface segue os 19 ecrãs do mockup Lovable e o comportamento segue a especificação funcional de `30segundos.md`.

O MVP inclui Partida Rápida local, Regras da Casa, equipas equilibradas ou dinâmicas, jogadores opcionais, rotação de explicadores, dois modos de vitória, desempate, revisão, pista, ranking, estatísticas reais, histórico, baralhos personalizados, funcionamento offline, multiplayer em vários telemóveis, 1 vs 1 e um contador simples de visitantes anónimos com painel administrativo. Em ecrãs desktop, a interface ocupa a janela responsivamente sem simular a moldura de um telemóvel.

## Executar localmente

```bash
npm install
npm run dev
```

O servidor abre em `http://localhost:5174`, disponibiliza a aplicação, o WebSocket multiplayer em `/ws` e os QR Codes das salas. Guarda métricas em `.data/analytics.json` e salas temporárias em `.data/rooms.json`. É possível alterar o porto com `PORT`, o ficheiro de métricas com `ANALYTICS_DATA_PATH` e o ficheiro das salas com `MULTIPLAYER_DATA_PATH`.

Em produção, o frontend está na Vercel e o backend multiplayer em `https://trinta-segundos-multiplayer.mazzahub.workers.dev`, utilizando Workers e Durable Objects. O frontend selecciona esse endereço automaticamente no build de produção; em desenvolvimento continua a usar o servidor local, ou `VITE_BACKEND_ORIGIN` quando definido. O modo local continua independente do backend e funciona offline.

Para desenvolver e publicar o backend Cloudflare:

```bash
npm run dev:worker
npm run build:worker
npm run deploy:worker
```

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
- `server`: regras autoritativas partilhadas e servidor Node para desenvolvimento local;
- `cloudflare`: Worker, Durable Objects, SQLite, alarms e WebSockets de produção;
- `public`: manifesto, ícone e Service Worker da PWA.

As decisões, justificações, divergências e estado de implementação são mantidos no documento de especificação. A arquitectura e o protocolo multiplayer estão resumidos em [`docs/multiplayer-architecture.md`](docs/multiplayer-architecture.md).
