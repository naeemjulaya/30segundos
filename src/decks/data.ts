import type { Deck } from '../game/domain/types'

export const decks: Deck[] = [
  { id: 'mocambique', name: 'Moçambique', icon: 'A', wordCount: 20, availableOffline: true, selected: true, words: [
    'Maputo', 'Matapa', 'Chapa', 'Xitique', 'Marrabenta', 'Katembe', 'Ilha de Moçambique', 'Gorongosa', 'Zambeze', 'Capulana', 'Piri-piri', 'Tofo', 'Xima', 'Marracuene', 'Inhambane', 'Niassa', 'Bazaruto', 'Samora Machel', 'Eduardo Mondlane', 'Chimoio',
  ] },
  { id: 'futebol', name: 'Futebol', icon: '◎', wordCount: 20, availableOffline: true, selected: true, words: [
    'Cristiano Ronaldo', 'Lionel Messi', 'Fora de jogo', 'Grande penalidade', 'Liga dos Campeões', 'Moçambola', 'Árbitro', 'Guarda-redes', 'Estádio', 'Benfica', 'Real Madrid', 'Mambas', 'Pontapé de canto', 'Cartão vermelho', 'Hat-trick', 'Médio', 'Capitão', 'Mundial', 'VAR', 'Golo',
  ] },
  { id: 'filmes', name: 'Filmes', icon: '▦', wordCount: 20, availableOffline: true, selected: false, words: [
    'Titanic', 'Pantera Negra', 'O Rei Leão', 'Avatar', 'Vingadores', 'Matrix', 'Frozen', 'Gladiador', 'Jurassic Park', 'Toy Story', 'Homem-Aranha', 'Shrek', 'Rocky', 'Barbie', 'O Padrinho', 'Star Wars', 'Madagáscar', 'Rambo', 'Harry Potter', 'Creed',
  ] },
  { id: 'musica', name: 'Música', icon: '♫', wordCount: 20, availableOffline: true, selected: false, words: [
    'Marrabenta', 'Jazz', 'Hip-hop', 'Guitarra', 'Microfone', 'Concerto', 'Bateria', 'Piano', 'Refrão', 'Kizomba', 'Pandza', 'DJ', 'Festival', 'Playlist', 'Dança', 'Banda', 'Rapper', 'Saxofone', 'Melodia', 'Palco',
  ] },
  { id: 'africa', name: 'África', icon: '♘', wordCount: 20, availableOffline: true, selected: false, words: [
    'Nelson Mandela', 'Kilimanjaro', 'Saara', 'Nilo', 'União Africana', 'Cairo', 'Lagos', 'Luanda', 'Nairobi', 'Maputo', 'Savanas', 'Baobá', 'Victoria Falls', 'Madagáscar', 'Rift Valley', 'Kalahari', 'Serengeti', 'Timbuktu', 'Casablanca', 'Zanzibar',
  ] },
  { id: 'geral', name: 'Geral', icon: '⊕', wordCount: 20, availableOffline: true, selected: false, words: [
    'WhatsApp', 'Fotossíntese', 'Internet', 'Universidade', 'Satélite', 'Relógio', 'Biblioteca', 'Chocolate', 'Aeroporto', 'Elefante', 'Telefone', 'Hospital', 'Bicicleta', 'Oceano', 'Computador', 'Tempestade', 'Presidente', 'Professor', 'Arco-íris', 'Aniversário',
  ] },
]
