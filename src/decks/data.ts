import type { Deck } from '../game/domain/types'

export const decks: Deck[] = [
  { id: 'mocambique', name: 'Moçambique', icon: 'A', wordCount: 50, availableOffline: true, selected: true, words: [
    'Maputo', 'Matapa', 'Chapa', 'Xitique', 'Marrabenta', 'Katembe', 'Ilha de Moçambique', 'Gorongosa', 'Zambeze', 'Capulana', 'Piri-piri', 'Tofo', 'Xima', 'Marracuene', 'Inhambane', 'Niassa', 'Bazaruto', 'Samora Machel', 'Eduardo Mondlane', 'Chimoio',
    'Beira', 'Nampula', 'Pemba', 'Tete', 'Quelimane', 'Xai-Xai', 'Lichinga', 'Vilanculos', 'Ponta do Ouro', 'Limpopo', 'Rovuma', 'Cahora Bassa', 'Chimanimani', 'Gurué', 'Angoche', 'Macuti', 'Mussiro', 'Timbila', 'Tufo', 'Dhow', 'Mercado Central', 'Praça da Independência', 'Costa do Sol', 'Monte Binga', 'Lago Niassa', 'Sena', 'Manica', 'Sofala', 'Gaza', 'Cabo Delgado',
  ] },
  { id: 'futebol', name: 'Futebol', icon: '◎', wordCount: 50, availableOffline: true, selected: true, words: [
    'Cristiano Ronaldo', 'Lionel Messi', 'Fora de jogo', 'Grande penalidade', 'Liga dos Campeões', 'Moçambola', 'Árbitro', 'Guarda-redes', 'Estádio', 'Benfica', 'Real Madrid', 'Mambas', 'Pontapé de canto', 'Cartão vermelho', 'Hat-trick', 'Médio', 'Capitão', 'Mundial', 'VAR', 'Golo',
    'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Liga Europa', 'Taça Africana', 'Livre directo', 'Pontapé de bicicleta', 'Drible', 'Defesa', 'Avançado', 'Adepto', 'Bancada', 'Baliza', 'Apito', 'Relvado', 'Treinador', 'Substituição', 'Prolongamento', 'Desempate por penáltis', 'Troféu', 'Camisola', 'Bola de Ouro', 'Kylian Mbappé', 'Neymar', 'Mohamed Salah', 'Pelé', 'Eusébio', 'José Mourinho', 'Fair play',
  ] },
  { id: 'filmes', name: 'Filmes', icon: '▦', wordCount: 50, availableOffline: true, selected: false, words: [
    'Titanic', 'Pantera Negra', 'O Rei Leão', 'Avatar', 'Vingadores', 'Matrix', 'Frozen', 'Gladiador', 'Jurassic Park', 'Toy Story', 'Homem-Aranha', 'Shrek', 'Rocky', 'Barbie', 'O Padrinho', 'Star Wars', 'Madagáscar', 'Rambo', 'Harry Potter', 'Creed',
    'Interstellar', 'A Origem', 'Forrest Gump', 'Piratas das Caraíbas', 'Missão Impossível', 'Velocidade Furiosa', 'O Senhor dos Anéis', 'Batman', 'Superman', 'Mulher-Maravilha', 'Joker', 'Top Gun', 'Terminator', 'Alien', 'King Kong', 'Godzilla', 'Procurando Nemo', 'Ratatui', 'Up', 'Coco', 'Encanto', 'Moana', 'Aladino', 'Mulan', 'Branca de Neve', 'O Máskara', 'Matrix Reloaded', 'Indiana Jones', 'Karate Kid', 'Duna',
  ] },
  { id: 'musica', name: 'Música', icon: '♫', wordCount: 50, availableOffline: true, selected: false, words: [
    'Marrabenta', 'Jazz', 'Hip-hop', 'Guitarra', 'Microfone', 'Concerto', 'Bateria', 'Piano', 'Refrão', 'Kizomba', 'Pandza', 'DJ', 'Festival', 'Playlist', 'Dança', 'Banda', 'Rapper', 'Saxofone', 'Melodia', 'Palco',
    'Afrobeat', 'Reggae', 'Rock', 'Pop', 'Ópera', 'Fado', 'Samba', 'Rumba', 'Música clássica', 'Violino', 'Trompete', 'Flauta', 'Baixo', 'Teclado', 'Acordeão', 'Tambor', 'Voz', 'Coro', 'Orquestra', 'Letra', 'Ritmo', 'Harmonia', 'Álbum', 'Single', 'Estúdio', 'Auscultadores', 'Vinil', 'Maestro', 'Karaoke', 'Turné',
  ] },
  { id: 'africa', name: 'África', icon: '♘', wordCount: 50, availableOffline: true, selected: false, words: [
    'Nelson Mandela', 'Kilimanjaro', 'Saara', 'Nilo', 'União Africana', 'Cairo', 'Lagos', 'Luanda', 'Nairobi', 'Maputo', 'Savanas', 'Baobá', 'Victoria Falls', 'Madagáscar', 'Rift Valley', 'Kalahari', 'Serengeti', 'Timbuktu', 'Casablanca', 'Zanzibar',
    'África do Sul', 'Angola', 'Tanzânia', 'Quénia', 'Nigéria', 'Egipto', 'Etiópia', 'Gana', 'Senegal', 'Marrocos', 'Camarões', 'Ruanda', 'Botsuana', 'Namíbia', 'Zimbabwe', 'Lesoto', 'Eswatini', 'Maurícias', 'Seychelles', 'Cabo Verde', 'Monte Atlas', 'Lago Vitória', 'Rio Congo', 'Delta do Okavango', 'Deserto do Namibe', 'Ilha de Gorée', 'Grande Zimbabwe', 'Monte Quénia', 'Golfo da Guiné', 'Cabo da Boa Esperança',
  ] },
  { id: 'geral', name: 'Geral', icon: '⊕', wordCount: 50, availableOffline: true, selected: false, words: [
    'WhatsApp', 'Fotossíntese', 'Internet', 'Universidade', 'Satélite', 'Relógio', 'Biblioteca', 'Chocolate', 'Aeroporto', 'Elefante', 'Telefone', 'Hospital', 'Bicicleta', 'Oceano', 'Computador', 'Tempestade', 'Presidente', 'Professor', 'Arco-íris', 'Aniversário',
    'Televisão', 'Geladeira', 'Semáforo', 'Elevador', 'Restaurante', 'Supermercado', 'Farmácia', 'Calendário', 'Espelho', 'Guarda-chuva', 'Mochila', 'Óculos', 'Chave', 'Janela', 'Escada', 'Cozinha', 'Jardim', 'Praia', 'Montanha', 'Deserto', 'Vulcão', 'Planeta', 'Astronauta', 'Dinossauro', 'Borboleta', 'Girafa', 'Golfinho', 'Camaleão', 'Abacaxi', 'Café',
  ] },
]
