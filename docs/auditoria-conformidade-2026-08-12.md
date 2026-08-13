# Auditoria de conformidade — PALAVRA 30s

**Data:** 12 de Agosto de 2026  
**Escopo auditado:** código existente no projecto, especificação até à Secção 13, build de produção, testes automatizados e execução da PWA em Chrome móvel simulado.  
**Natureza:** auditoria de estado actual; a presença de um ecrã sem comportamento real não foi considerada implementação.

## Legenda

- **C — Conforme:** comportamento implementado e sustentado por código, teste ou execução observável.
- **P — Parcial:** existe parte relevante, mas falta um critério obrigatório ou há comportamento incorrecto.
- **N — Não conforme:** não implementado, apenas visual, ou contrário à especificação.
- **NA — Não aplicável nesta versão:** depende de um serviço explicitamente fora do MVP actual.

## 1. Conclusão executiva

O sistema **não está conforme com todos os requisitos** e ainda **não deve ser declarado MVP concluído**.

O núcleo da Partida Rápida funciona: criação de equipas, escolha de baralhos, transição protegida, cartão, cronómetro, acertos, revisão, confirmação idempotente, pontuação, pista, ranking, alternância de equipas, persistência local, abertura offline e revanche. A maior concentração de lacunas encontra-se em configuração personalizada, jogadores individuais, rotação, desempate, estatísticas, histórico e gestão real de conteúdos.

### Resultado por área

| Área | Conforme | Parcial | Não conforme | Total auditado |
| ----- | -----: | -----: | -----: | -----: |
| Requisitos funcionais | 43 | 10 | 22 | 75 entradas documentadas |
| Casos de uso | 15 | 5 | 6 | 26 |
| Histórias de utilizador | 14 | 5 | 7 | 26 |
| Must Have | 17 | 1 | 0 | 18 |
| Should Have | 0 | 0 | 6 | 6 |

**Nota sobre os requisitos funcionais:** a especificação contém 75 entradas, mas apenas 66 números distintos, pois `RF-13` a `RF-21` foram reutilizados. Para evitar ambiguidade, esta auditoria acrescenta o nome do requisito.

## 2. Não conformidades críticas e altas

### NC-01 — Desempate não executa a regra especificada — Crítica

O motor detecta empate e mostra o ecrã de confronto, mas o botão inicia uma ronda normal. A ronda não é limitada às equipas empatadas, os pontos alteram a pontuação histórica e não existe controlo para dar exactamente uma oportunidade a cada finalista.

**Afecta:** RF-47, UC-19, US-18, RJ-27, configuração padrão e CAG-01.

### NC-02 — Estatísticas finais contêm valores fictícios — Alta

O ecrã final apresenta sempre `5/5` como melhor ronda e `Fotossíntese` como palavra mais difícil, independentemente da partida. Informação demonstrativa não pode ser apresentada como resultado real.

**Afecta:** RF-49, UC-20, US-19, confiança e integridade da interface.

### NC-03 — Conteúdo marcado como indisponível offline pode ser seleccionado — Alta

Os baralhos Filmes e África possuem `availableOffline: false`, mas podem ser seleccionados normalmente. Além disso, o resumo apresenta sempre a palavra `offline`, mesmo quando a selecção inclui conteúdo marcado como indisponível.

**Afecta:** RF-16 de conteúdo, RF-58, RN-12, UC-23, US-22 e CA-22.5.

### NC-04 — Passe pode alterar a palavra errada — Alta

O jogador pode explicar palavras em qualquer ordem, mas o botão `Passar` marca automaticamente a primeira palavra pendente. Não existe selecção explícita da palavra que o jogador pretende passar.

**Afecta:** RF-28, UC-11, US-10, RJ-13 e RJ-16.

### NC-05 — Interface promete comportamentos inexistentes — Alta

O modo dinâmico informa que a equipa menor explica primeiro e que o jogo compensa a ordem; a ordem real permanece sempre a ordem do array. O ecrã de passagem apresenta “Ana explica” mesmo sem jogadores registados. Som, vibração e download aparecem activos sem implementação.

**Afecta:** RF-12, RF-20, RF-21, RF-44, US-17, RJ-34, RNF-05 e exactidão da interface.

### NC-06 — Quantidades de palavras apresentadas não correspondem ao catálogo real — Alta

Os cartões anunciam centenas de palavras por baralho, mas cada baralho local contém apenas 20 entradas. Dois baralhos seleccionados anunciam 1.340 palavras, embora o conjunto efectivo possua 40. Quando faltam cinco palavras ainda não utilizadas, o gerador volta directamente ao conjunto completo sem apresentar o aviso obrigatório de esgotamento.

**Afecta:** RF-17 de conteúdo, RF-58, US-23, RJ-30, política de esgotamento e confiança do utilizador.

## 3. Must Have

| Must Have | Estado | Evidência ou lacuna |
| ----- | :---: | ----- |
| Criar partida | C | `createSession` e botão Jogar |
| Criar equipas | C | 2 a 6 equipas, nomes, cores e quantidades |
| Seleccionar categorias | C | Implementadas como baralhos/categorias seleccionáveis |
| Apresentar cartões | C | Cinco palavras simultâneas |
| Iniciar cronómetro | C | Inicia depois de Estou Pronto e contagem 3–2–1 |
| Marcar acertos | C | Um toque, feedback e alternância do estado |
| Terminar ronda | C | Zero ou todas as palavras processadas |
| Rever resultados | C | Todos os estados podem ser corrigidos |
| Confirmar pontuação | C | Confirmação explícita e idempotente |
| Gerir turnos | C | Rotação determinística entre equipas |
| Apresentar tabuleiro ou ranking | C | Ambos implementados |
| Detectar vitória | P | Corrida a 40 e igualdade de turnos funcionam; desempate está incorrecto |
| Funcionar offline | C | Build carregado e recarregado com rede desligada |
| Permitir revanche | C | Nova sessão, equipas/configuração mantidas e pontos repostos |
| Seleccionar composição | C | Equilibrada e dinâmica |
| Definir número igual | C | Alterar uma equipa actualiza todas no modo equilibrado |
| Permitir número dinâmico | C | Quantidades independentes |
| Jogar sem nomes individuais | C | O motor não depende de jogadores nomeados |

## 4. Should Have

| Should Have | Estado | Lacuna |
| ----- | :---: | ----- |
| Jogadores individuais | N | Não existe activação, inclusão, edição, remoção ou transferência |
| Rotação automática de explicadores | N | Não existem ponteiros por equipa; “Ana” é texto fixo |
| Múltiplas Regras da Casa | N | Configuração existe no tipo, mas não pode ser editada na interface |
| Estatísticas finais detalhadas | N | Valores mostrados são estáticos e não derivados da sessão |
| Histórico de partidas | N | IndexedDB guarda somente a sessão activa |
| Repetição inteligente entre partidas | N | Apenas `usedWordIds` da sessão actual é considerado |

## 5. Requisitos funcionais

### 5.1 Gestão de partidas

| Requisito | Estado | Resultado |
| ----- | :---: | ----- |
| RF-01 Criar partida | C | Nova sessão recebe identificador próprio |
| RF-02 Tipo de configuração | N | Não há escolha Partida Rápida/Personalizada |
| RF-03 Modo de vitória | N | Apenas meta fixa por pontos |
| RF-04 Duração | N | Valor 30 não é editável |
| RF-05 Palavras por cartão | N | Valor 5 não é editável |
| RF-06 Regras adicionais | N | Passes, penalização, roubo e rotação não são configuráveis |

### 5.2 Equipas

| Requisito | Estado | Resultado |
| ----- | :---: | ----- |
| RF-07 Número de equipas | C | Limite 2–6 aplicado |
| RF-08 Modo de composição | C | Equilibrado/dinâmico |
| RF-09 Quantidade uniforme | C | Quantidade configurável e sincronizada |
| RF-10 Validar equilíbrio | C | Divergência não pode ser criada pela interface equilibrada |
| RF-11 Quantidade dinâmica | C | Valores independentes |
| RF-12 Avisar desequilíbrio | P | Existe mensagem genérica, não calcula diferença significativa |
| RF-13 Nome da equipa | C | Editável |
| RF-14 Cor da equipa | C | Atribuição automática distinta; não editável, mas o requisito aceita atribuição |
| RF-15 Ordem das equipas | C | Ordem determinística e apresentada no resumo |
| RF-16 Quantidade sem nomes | C | Independente da lista `players` |
| RF-17 Activar nomes individuais | N | Ausente |
| RF-18 Adicionar jogadores | N | Ausente |
| RF-19 Editar composição individual | N | Ausente |
| RF-20 Rotação individual | N | Ausente |
| RF-21 Rotação genérica sem nomes | N | Ausente |

### 5.3 Categorias, baralhos e cartões

| Requisito | Estado | Resultado |
| ----- | :---: | ----- |
| RF-13 Listar categorias | C | Packs equivalentes às categorias são listados |
| RF-14 Seleccionar categorias | C | Selecção múltipla |
| RF-15 Seleccionar baralhos | C | Selecção múltipla |
| RF-16 Conteúdo offline | P | Conteúdo base é local, mas a disponibilidade indicada não é aplicada |
| RF-17 Evitar repetição na partida | C | Usa identificadores enquanto restarem pelo menos cinco alternativas |
| RF-18 Repetição entre partidas | N | Sem histórico |
| RF-19 Gerar cartão | C | Geração local |
| RF-20 Respeitar selecção | C | Pool filtrado pelos IDs seleccionados |
| RF-21 Dificuldade | N | Palavra não possui dificuldade |
| RF-22 Ocultar na transição | C | Handoff não contém palavras |
| RF-23 Confirmar preparação | C | Botão Estou Pronto |

### 5.4 Ronda, revisão e pontuação

| Requisito | Estado | Resultado |
| ----- | :---: | ----- |
| RF-24 Iniciar cronómetro | C | Automático após revelação |
| RF-25 Tempo restante | C | Numeral e anel visíveis |
| RF-26 Marcar acerto | C | Um toque |
| RF-27 Desmarcar | C | Segundo toque repõe pendente |
| RF-28 Passar palavra | P | Limite funciona, mas escolhe a primeira pendente |
| RF-29 Limite de passe | C | Bloqueado depois de 2 |
| RF-30 Terminar automaticamente | C | Por tempo ou cartão concluído |
| RF-31 Indicação de fim | C | Feedback visual; áudio/háptico são opcionais |
| RF-32 Resumo da ronda | C | Cinco palavras e estados |
| RF-33 Alterar na revisão | C | Três estados editáveis |
| RF-34 Pontuação provisória | C | Actualização imediata |
| RF-35 Confirmar resultado | C | Acção explícita |
| RF-36 Imutabilidade | C | Fluxo não retorna à revisão confirmada |
| RF-37 Calcular pontuação | C | Um ponto por acerto |
| RF-38 Actualizar equipa | C | Depois da confirmação |
| RF-39 Tabuleiro | C | Posição derivada da pontuação |
| RF-40 Ranking | C | Ordenação descendente |
| RF-41 Estado da partida | C | Todas as equipas apresentadas |

### 5.5 Turnos, fim e persistência

| Requisito | Estado | Resultado |
| ----- | :---: | ----- |
| RF-42 Próxima equipa | C | Índice circular |
| RF-43 Ecrã de transição | C | Handoff |
| RF-44 Próximo explicador | N | Jogadores/rotação ausentes |
| RF-45 Condição de vitória | P | Apenas corrida por pontos |
| RF-46 Vencedor | P | Correcto sem empate; demais modos ausentes |
| RF-47 Empates | P | Detecta, mas fluxo da ronda extra está incorrecto |
| RF-48 Resultado final | C | Vencedor e classificação |
| RF-49 Estatísticas | N | Valores fictícios |
| RF-50 Revanche | C | Implementada |
| RF-51 Nova configuração | C | Nova partida e navegação de retorno |
| RF-52 Guardar partida | C | IndexedDB |
| RF-53 Recuperar partida | P | Recupera; não oferece abandono e política completa não foi testada em todos os estados |
| RF-54 Preferências | N | Ausente |
| RF-55 Histórico recente | N | Ausente |

### 5.6 Offline e baralhos personalizados

| Requisito | Estado | Resultado |
| ----- | :---: | ----- |
| RF-56 Iniciar offline | C | Validado após preparação inicial |
| RF-57 Concluir offline | C | Motor e persistência não usam servidor |
| RF-58 Conteúdo indisponível | N | Pode ser seleccionado e resumo declara-o offline |
| RF-59 Sincronizar depois | N | Ausente |
| RF-60 Criar baralho | N | Ecrã não possui nome real nem gravação |
| RF-61 Editar baralho | N | Ausente |
| RF-62 Eliminar baralho | N | Ausente |
| RF-63 Adicionar palavras | P | Funciona apenas em memória no formulário demonstrativo |
| RF-64 Remover palavras | P | Funciona apenas em memória |
| RF-65 Quantidade mínima | P | Botão bloqueia abaixo de 20, mas não há rascunho persistido nem utilização posterior |
| RF-66 Partilhar baralho | N | Ausente e pós-MVP |

## 6. Requisitos não funcionais

| Requisito | Estado | Resultado |
| ----- | :---: | ----- |
| RNF-01 Mobile-first | C | Viewport 390×844 validado |
| RNF-02 Uma mão | C | Acções principais grandes e próximas da zona inferior |
| RNF-03 Legibilidade | C | Contraste e hierarquia adequados na inspecção móvel |
| RNF-04 Poucas interacções | P | Fluxo único exige quatro etapas; não há Partida Rápida directa |
| RNF-05 Feedback imediato | P | Visual funciona; a interface promete feedback háptico/sonoro inexistente |
| RNF-06 Resposta local | C | Sem chamadas remotas durante o jogo |
| RNF-07 Inicialização eficiente | P | Build é pequeno, mas não foi medido em dispositivos móveis de baixa gama |
| RNF-08 Transições eficientes | C | Locais |
| RNF-09 Offline-first | C | Reload offline validado |
| RNF-10 Rede instável | C | Partida independente de rede |
| RNF-11 Baixo consumo | C | App estático; JS principal gzip ~70 KB |
| RNF-12 Redes lentas | NA | Não existem operações online reais além do primeiro carregamento |
| RNF-13 Navegadores móveis | P | Apenas Chrome foi validado; Safari e Firefox não foram testados |
| RNF-14 PWA | C | Manifesto, Service Worker e controlo offline presentes |
| RNF-15 Responsividade | P | Smartphone e desktop inspecionados; orientação horizontal não validada |
| RNF-16 Integridade da pontuação | C | Teste automatizado de idempotência |
| RNF-17 Persistência | C | Reload de ronda activa validado com palavra e tempo recuperados |
| RNF-18 Consistência de turnos | P | Equipas consistentes; jogadores não existem |
| RNF-19 Consistência de cartões | P | IDs usados persistem; esgotamento volta ao pool sem aviso |
| RNF-20 Validação de dados | P | Limites de equipa e baralho existem; nomes vazios, duplicados e quantidades elevadas não são validados |
| RNF-21 Protecção online | NA | Sem administração remota |
| RNF-22 Minimização de dados | C | Nenhum dado pessoal obrigatório |
| RNF-23 Armazenamento sensível | NA | Não há dados sensíveis |
| RNF-24 Separação | C | Domínio, UI, dados e persistência separados |
| RNF-25 Modularidade | P | Domínio modular; toda a UI está concentrada num único componente grande |
| RNF-26 Testabilidade | P | Quatro testes; faltam cartões, turnos completos, recuperação, desempate e esgotamento |
| RNF-27 Documentação | C | README e Secções 13–14 |
| RNF-28 Sessão local | C | Carga nula no servidor durante partida |
| RNF-29 Crescimento de conteúdos | P | Tipos suportam packs; persistência e carregamento por pacote não existem |
| RNF-30 Evolução online | P | Separação ajuda, mas interfaces remotas/sincronização ainda não foram definidas no código |

## 7. Regras de negócio e jogabilidade

### 7.1 Regras iniciais RN-01 a RN-13F

| Regra | Estado | Observação |
| ----- | :---: | ----- |
| RN-01 a RN-11 | C | Mínimo, cores, equipa activa, revisão, associação da ronda, contagem única, ordem, vitória após confirmação, bloqueio visual do fim e nova sessão de revanche |
| RN-12 | N | Conteúdo marcado indisponível pode ser seleccionado |
| RN-13A a RN-13E | C | Modos e quantidades independentes de nomes |
| RN-13F | N | Não existem jogadores individuais |

### 7.2 Regras de domínio RN-13 a RN-48

| Regras | Estado | Observação |
| ----- | :---: | ----- |
| RN-13 a RN-17 | C | Ciclo base da partida e finalização após confirmação |
| RN-18 a RN-20 | P | Configuração existe, mas validação é incompleta; alterações não são expostas durante ronda |
| RN-21 a RN-25 | C | Equipas da sessão, nomes, cores, pontuação inicial e ordem |
| RN-26 e RN-29 | N | Associação e rotação individual ausentes |
| RN-27 e RN-28 | C | Sem conta obrigatória e sem jogadores individuais obrigatórios |
| RN-30 a RN-38 | C | Ronda, preparação, revisão, idempotência e cartão associado |
| RN-39 | N | Não existe estado activo/inactivo de palavra |
| RN-40 | P | Evita repetição, mas liberta todo o pool cedo e sem aviso |
| RN-41 | N | Não normaliza texto para detectar duplicados |
| RN-42 a RN-44 | N | Ciclo de vida de baralhos personalizados ausente |
| RN-45 a RN-48 | C | Um estado por palavra, edição em revisão e pontuação só confirmada |

### 7.3 Regras RJ-01 a RJ-38

| Regras | Estado | Observação |
| ----- | :---: | ----- |
| RJ-01 a RJ-06 de equipas | C | Mínimo, equilíbrio, total e modo dinâmico |
| RJ-07 e RJ-08 de equipas | P/N | Quantidades são independentes; reorganização de jogadores não existe |
| RJ-04 de rotação | N | Rotação individual ausente |
| RJ-05 e RJ-06 de preparação | C | Estou Pronto e início com revelação |
| RJ-07 de ordem livre | P | Acertos são livres, mas passe força a primeira pendente |
| RJ-08 a RJ-10 | C | Contagem única, limite de passes e revisão fechada |
| RJ-11 a RJ-12 | C | Cinco palavras e timestamp após revelação |
| RJ-13 | P | Ordem livre comprometida pelo passe |
| RJ-14 a RJ-21 | C | Pontuação base, correcção, passes, fim antecipado, estado final e revisão |
| RJ-22 | C | Decisão permanece social; UI permite editar |
| RJ-23 a RJ-26 | C | Compromisso, pontuação derivada e igualdade de turnos |
| RJ-27 | N | Desempate altera a pontuação principal e não possui sessão própria |
| RJ-28 | NA | Roubo está correctamente desactivado no padrão |
| RJ-29 | N | Dificuldade não existe no modelo de palavra |
| RJ-30 | P | IDs usados são guardados, mas política de esgotamento está incompleta |
| RJ-31 | N | Histórico entre partidas ausente |
| RJ-32 | P | Limite visual de 20, sem guardar rascunho |
| RJ-33 | C | Quantidade e identidade são campos distintos |
| RJ-34 e RJ-35 | N | Ponteiros e salto de explicador ausentes |
| RJ-36 | C | Não existe pausa na ronda |
| RJ-37 | C | Timestamp usado |
| RJ-38 | C | Cartão e marcações recuperados; tempo expirado encaminha à revisão |

**Defeito documental:** `RJ-04` a `RJ-08` também foram atribuídos duas vezes a regras diferentes. Devem ser renumerados antes de expandir testes de rastreabilidade.

## 8. Casos de uso

| Caso de uso | Estado | Resultado |
| ----- | :---: | ----- |
| UC-01 Criar partida | C | Implementado |
| UC-02 Configuração rápida | N | Não existe entrada própria |
| UC-03 Personalizar partida | N | Regras da Casa ausentes |
| UC-04 Configurar equipas | C | Implementado sem jogadores nominais |
| UC-05 Adicionar jogadores | N | Ausente |
| UC-06 Categorias/baralhos | C | Selecção implementada; disponibilidade offline tem defeito coberto por RF-58 |
| UC-07 Iniciar partida | C | Resumo e validação mínima |
| UC-08 Preparar próxima ronda | C | Handoff e Estou Pronto |
| UC-09 Realizar ronda | C | Implementado |
| UC-10 Marcar acerto | C | Implementado |
| UC-11 Passar palavra | P | Limite funciona; palavra alvo incorrecta |
| UC-12 Terminar ronda | C | Implementado |
| UC-13 Rever resultados | C | Implementado |
| UC-14 Confirmar pontuação | C | Implementado e idempotente |
| UC-15 Tabuleiro | C | Implementado |
| UC-16 Ranking | C | Implementado |
| UC-17 Próxima equipa | P | Equipa funciona; explicador não |
| UC-18 Verificar vitória | P | Só corrida por pontos |
| UC-19 Resolver empate | P | Detecção/ecrã existem; execução incorrecta |
| UC-20 Resultado final | C | Resultado e classificação; estatísticas são tratadas separadamente como NC-02 |
| UC-21 Revanche | C | Implementado |
| UC-22 Recuperar partida | P | Continuar funciona; abandonar e todos os estados não estão cobertos |
| UC-23 Jogar offline | C | Reload offline validado |
| UC-24 Criar baralho | N | Demonstração não persistente |
| UC-25 Editar baralho | N | Ausente |
| UC-26 Gerir conteúdo oficial | N | Fora da implementação actual |

## 9. Histórias de utilizador

| História | Estado | Resultado |
| ----- | :---: | ----- |
| US-01 Criar partida | C | Critérios essenciais cobertos |
| US-02 Partida rápida | N | Não há opção claramente identificada nem fluxo reduzido |
| US-03 Personalizar regras | N | Ausente |
| US-04 Definir equipas | C | Modos e quantidades cobertos |
| US-05 Quantidades sem nomes | C | Coberta |
| US-06 Registar nomes | N | O título diz categorias, mas o corpo exige jogadores individuais; não implementado |
| US-07 Receber telemóvel | C | Cartão oculto e acção explícita |
| US-08 Jogar ronda | C | Coberta |
| US-09 Marcar acerto | C | Coberta |
| US-10 Passar | P | Limite/estado cobertos; alvo do passe incorrecto |
| US-11 Fim do tempo | C | Feedback visual e bloqueio pela mudança de estado |
| US-12 Rever | C | Coberta |
| US-13 Confirmar | C | Coberta e persistida |
| US-14 Tabuleiro | C | Coberta |
| US-15 Ranking | C | Coberta; empates finais dependem de UC-19 |
| US-16 Alternar equipa | C | Ordem circular persistida |
| US-17 Explicador | N | Ausente; “Ana” não é rotação |
| US-18 Vitória | P | Corrida funciona; modos alternativos e desempate não |
| US-19 Resultado final | P | Vencedor/classificação reais; estatísticas fictícias |
| US-20 Revanche | C | Nova ID, valores repostos, configuração reutilizada |
| US-21 Recuperar | P | Continuar funciona; abandono e cobertura integral faltam |
| US-22 Offline | C | Validada no build de produção |
| US-23 Repetição | P | Sessão actual coberta; histórico e esgotamento não |
| US-24 Baralho personalizado | N | Não guarda localmente |
| US-25 Partilhar baralho | N | Pós-MVP, ausente |
| US-26 Administração | N | Ausente |

## 10. Critérios globais do MVP

| Critério | Estado | Resultado |
| ----- | :---: | ----- |
| CAG-01 Partida completa | P | Fluxo normal sem empate é possível; desempate impede aprovação universal |
| CAG-02 Um telemóvel | C | Arquitectura local |
| CAG-03 Independência da Internet | C | Validada após primeiro carregamento |
| CAG-04 Persistência | C | Ronda activa recuperada com marcação e tempo |
| CAG-05 Integridade | C | Teste automatizado |
| CAG-06 Turnos | P | Equipas cobertas; rotação de explicadores não |
| CAG-07 Mobile-first | C | Inspecção em 390×844 |
| CAG-08 Feedback | P | Visual existe; vitória/desempate e promessas sonoras/hápticas estão incompletas |

## 11. Evidências executadas

1. `npm run test`: 4 testes aprovados.
2. `npm run build`: build de produção concluído.
3. Fluxo Jogar → configuração → ronda → cinco acertos → revisão → confirmação → pista → ranking executado sem excepções.
4. Service Worker registado e controlando a página.
5. Build recarregado com rede desligada; Home renderizada integralmente do cache.
6. Ronda activa recarregada: uma palavra marcada permaneceu marcada e o cronómetro foi recuperado.

## 12. Ordem recomendada de correcção

1. Corrigir desempate e criar testes completos da justiça de turnos.
2. Remover estatísticas fictícias até existirem dados reais.
3. Corrigir política de conteúdo offline e textos enganosos.
4. Tornar o passe específico por palavra.
5. Implementar Partida Rápida explícita e Regras da Casa.
6. Implementar jogadores, rotação e referências genéricas.
7. Corrigir catálogo, esgotamento e histórico anti-repetição.
8. Completar recuperação/abandono e testes de estados.
9. Implementar os seis Should Have.
10. Renumerar identificadores duplicados no documento.
