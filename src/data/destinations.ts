import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Destinos populares para sugerir antes de escribir. Coordenadas sacadas de
 * OpenStreetMap (Nominatim) el 10/10/2026.
 */
export type Destination = { name: string; area: string; icon: keyof typeof Ionicons.glyphMap; lon: number; lat: number };

export const POPULAR_DESTINATIONS: Destination[] = [
  { name: 'Ciutat de les Arts i les Ciències', area: 'Quatre Carreres', icon: 'sparkles-outline', lon: -0.35255, lat: 39.45576 },
  { name: 'Platja de la Malva-rosa', area: 'Poblats Marítims', icon: 'sunny-outline', lon: -0.32372, lat: 39.47939 },
  { name: 'Aeroport de València', area: 'Manises', icon: 'airplane-outline', lon: -0.48132, lat: 39.48818 },
  { name: 'Estació del Nord', area: "L'Eixample", icon: 'train-outline', lon: -0.37777, lat: 39.46613 },
  { name: 'Estació Joaquín Sorolla', area: 'Jesús', icon: 'train-outline', lon: -0.38089, lat: 39.45956 },
  { name: 'Mercat Central', area: 'Ciutat Vella', icon: 'basket-outline', lon: -0.37891, lat: 39.47349 },
  { name: "Plaça de l'Ajuntament", area: 'Ciutat Vella', icon: 'business-outline', lon: -0.37683, lat: 39.47065 },
  { name: 'Hospital La Fe', area: 'Malilla', icon: 'medkit-outline', lon: -0.3761, lat: 39.44365 },
  { name: 'Universitat Politècnica (UPV)', area: 'Campus de Vera', icon: 'school-outline', lon: -0.34203, lat: 39.48085 },
  { name: 'Campus de Blasco Ibáñez', area: 'El Pla del Real', icon: 'school-outline', lon: -0.36283, lat: 39.4794 },
  { name: 'Estadi de Mestalla', area: 'El Pla del Real', icon: 'football-outline', lon: -0.35816, lat: 39.47453 },
  { name: 'Oceanogràfic', area: 'Quatre Carreres', icon: 'fish-outline', lon: -0.34718, lat: 39.45305 },
  { name: 'Bioparc', area: 'Campanar', icon: 'paw-outline', lon: -0.41122, lat: 39.47833 },
  { name: 'La Marina de València', area: 'El Grau', icon: 'boat-outline', lon: -0.31456, lat: 39.45958 },
  { name: 'Torres de Serranos', area: 'Ciutat Vella', icon: 'flag-outline', lon: -0.37617, lat: 39.47928 },
];
