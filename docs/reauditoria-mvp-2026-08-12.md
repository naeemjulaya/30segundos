# Reauditoria do MVP — 12 de Agosto de 2026

## Conclusão

O escopo do MVP definido pelas prioridades **Must Have**, **Should Have** e pelos critérios globais CAG-01 a CAG-08 foi implementado.

Funcionalidades explicitamente classificadas como pós-MVP continuam fora deste resultado: partilha online de baralhos, administração remota, autenticação, sincronização cloud, multiplayer remoto, reconhecimento de voz e torneios.

## Must Have

| Item | Estado final |
| ----- | :---: |
| Criar partida e equipas | Conforme |
| Seleccionar conteúdo | Conforme |
| Cartões, cronómetro e acertos | Conforme |
| Fim e revisão da ronda | Conforme |
| Confirmação e integridade da pontuação | Conforme |
| Turnos, pista e ranking | Conforme |
| Vitória, igualdade de turnos e desempate | Conforme |
| Offline | Conforme |
| Revanche | Conforme |
| Composição equilibrada/dinâmica | Conforme |
| Quantidades sem nomes individuais | Conforme |

**Resultado:** 18 de 18 conformes.

## Should Have

| Item | Estado final | Implementação |
| ----- | :---: | ----- |
| Jogadores individuais | Conforme | Activação opcional, nomes por equipa e validação |
| Rotação automática | Conforme | Ponteiro independente por equipa, nomes ou referências genéricas, salto de explicador |
| Múltiplas Regras da Casa | Conforme | Tempo, cartão, passes, penalização, dificuldade, vitória, meta/rondas e primeira equipa |
| Estatísticas finais | Conforme | Melhor ronda, desafio difícil, rondas e palavras vistas derivados da sessão |
| Histórico de partidas | Conforme | Registos persistidos na IndexedDB |
| Repetição entre partidas | Conforme | Preferência pelas palavras fora das últimas três partidas |

**Resultado:** 6 de 6 conformes.

## Não conformidades anteriores encerradas

1. **Desempate:** possui pontuação separada, apenas equipas empatadas, repetição em novo empate e vencedor explícito.
2. **Estatísticas fictícias:** removidas; todos os valores agora são derivados.
3. **Conteúdo offline:** todos os packs incorporados são realmente locais, as quantidades reflectem os arrays reais e rascunhos não podem ser seleccionados.
4. **Passe errado:** cada palavra possui o seu próprio controlo de passe.
5. **Promessas sem comportamento:** rotação, som, vibração, histórico e baralhos personalizados possuem comportamento real.
6. **Esgotamento:** a ronda sinaliza reutilização e a transição avisa o grupo.

## Regras e fluxos acrescentados

- Partida Rápida explicitamente identificada.
- Partida Personalizada e Regras da Casa.
- Vitória por pontos ou rondas fixas.
- Igualdade de turnos compatível com qualquer primeira equipa.
- Primeira equipa manual ou aleatória.
- Passes de zero a ilimitados e penalização opcional.
- Dificuldade fácil, normal, difícil ou mista.
- Baralhos personalizados criados, editados e eliminados localmente.
- Baralhos com menos de 20 palavras guardados como rascunho.
- Normalização de texto para evitar duplicados entre packs.
- Continuação ou abandono de sessão guardada.
- Preferências de som e vibração persistentes.
- Histórico e estatísticas reais.

## Evidências

- 11 testes automatizados aprovados.
- Build de produção concluído.
- Partida Rápida executada no navegador até à pista.
- Passe aplicado à segunda palavra e preservado na revisão, com cálculo `+4` correcto.
- Fluxo personalizado validado até à introdução de 12 jogadores.
- Baralho personalizado com 20 palavras persistido e recuperado depois de reload.
- PWA controlada por Service Worker `palavra-30s-v2` e recarregada sem rede.
- Desktop 1440×1000: largura 1440 px, borda 0 px, raio 0 px e sombra inexistente.

## Responsividade desktop

A aplicação deixou de impor largura de 430 px e deixou de desenhar moldura, cantos ou sombra de telemóvel em viewports a partir de 700 px. Os mesmos componentes são reorganizados em grelhas responsivas, mantendo a identidade visual e a navegação.

## Refinamento visual Stitch

O projecto partilhado Google Stitch `1886894703773229342` foi adoptado como referência visual e adaptado aos estados reais do MVP. A interface utiliza agora a identidade Tactile Competitive: papel quente, carvão, cores impressas densas, Barlow Condensed, IBM Plex Sans, bordas grossas e sombras rígidas.

Os mockups não substituíram o motor nem foram importados como HTML estático. Pontuação, turnos, nomes, baralhos, desempate, estatísticas e estados visuais continuam derivados da sessão e das regras documentadas. Foram verificadas as vistas móvel 390 × 844 e desktop 1440 × 1000, além dos fluxos de resumo, Regras da Casa, ronda e revisão, sem overflow horizontal observado.
