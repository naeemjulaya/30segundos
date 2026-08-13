# PALAVRA 30s

PWA mobile-first para um jogo presencial de palavras por equipas. A interface segue os 19 ecrãs do mockup Lovable e o comportamento segue a especificação funcional de `30segundos.md`.

O MVP inclui Partida Rápida, Regras da Casa, equipas equilibradas ou dinâmicas, jogadores opcionais, rotação de explicadores, dois modos de vitória, desempate, revisão, pista, ranking, estatísticas reais, histórico, baralhos personalizados, funcionamento offline e um contador simples de visitantes anónimos com painel administrativo. Em ecrãs desktop, a interface ocupa a janela responsivamente sem simular a moldura de um telemóvel.

## Executar localmente

```bash
npm install
npm run dev
```

O servidor abre em `http://localhost:5174`, disponibiliza a aplicação e guarda as métricas em `.data/analytics.json`. É possível alterar o porto com `PORT` e o ficheiro de dados com `ANALYTICS_DATA_PATH`.

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
- `src/ui`: ecrãs e componentes visuais;
- `server`: armazenamento central das métricas;
- `public`: manifesto, ícone e Service Worker da PWA.

As decisões, justificações, divergências e estado de implementação são mantidos na Secção 13 do documento de especificação.
