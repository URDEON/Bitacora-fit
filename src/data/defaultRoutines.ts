import { SavedRoutine } from '../types';

export const DEFAULT_ROUTINES: SavedRoutine[] = [
  {
    id: 'routine-push',
    title: 'Día A — Empuje',
    subtitle: 'Pecho, Hombros y Tríceps • 5 ejercicios',
    color: '#D94E28',
    exercises: [
      { category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 50 },
      { category: 'Pecho', name: 'Press inclinado con mancuernas', mode: 'strength', sets: 3, reps: 10, weight: 18 },
      { category: 'Pecho', name: 'Peck Deck / Mariposa en máquina', mode: 'strength', sets: 3, reps: 12, weight: 40 },
      { category: 'Hombros', name: 'Elevaciones laterales con mancuernas', mode: 'strength', sets: 4, reps: 14, weight: 8 },
      { category: 'Bíceps y Tríceps', name: 'Extensión de tríceps en polea con cuerda', mode: 'strength', sets: 3, reps: 12, weight: 20 },
    ],
  },
  {
    id: 'routine-pull',
    title: 'Día B — Tirón',
    subtitle: 'Espalda, Posterior y Bíceps • 5 ejercicios',
    color: '#1D5D9B',
    exercises: [
      { category: 'Espalda', name: 'Jalón al pecho en polea abierta', mode: 'strength', sets: 4, reps: 10, weight: 45 },
      { category: 'Espalda', name: 'Remo en polea baja (Gironda)', mode: 'strength', sets: 4, reps: 10, weight: 45 },
      { category: 'Espalda', name: 'Remo con mancuerna a una mano', mode: 'strength', sets: 3, reps: 10, weight: 20 },
      { category: 'Hombros', name: 'Face Pull', mode: 'strength', sets: 3, reps: 15, weight: 15 },
      { category: 'Bíceps y Tríceps', name: 'Curl de bíceps con barra Z', mode: 'strength', sets: 3, reps: 10, weight: 25 },
    ],
  },
  {
    id: 'routine-legs',
    title: 'Día C — Piernas y Glúteos',
    subtitle: 'Cuádriceps, Femoral, Glúteo y Gemelos • 5 ejerc.',
    color: '#216E4E',
    exercises: [
      { category: 'Piernas y Glúteos', name: 'Prensa de piernas 45°', mode: 'strength', sets: 4, reps: 10, weight: 100 },
      { category: 'Piernas y Glúteos', name: 'Peso muerto rumano con barra', mode: 'strength', sets: 4, reps: 10, weight: 50 },
      { category: 'Piernas y Glúteos', name: 'Hip Thrust con barra', mode: 'strength', sets: 3, reps: 12, weight: 60 },
      { category: 'Piernas y Glúteos', name: 'Extensión de cuádriceps en máquina', mode: 'strength', sets: 3, reps: 12, weight: 40 },
      { category: 'Piernas y Glúteos', name: 'Gemelos de pie', mode: 'strength', sets: 4, reps: 15, weight: 45 },
    ],
  },
  {
    id: 'routine-cardio-core',
    title: 'Cardio y abdomen',
    subtitle: 'Bicicleta / Cinta + Abdomen isométrico',
    color: '#B45309',
    exercises: [
      { category: 'Cardio y Bici', name: 'Bicicleta estática', mode: 'cardio', minutes: 30, distanceKm: 10 },
      { category: 'Cardio y Bici', name: 'Caminata en cinta (inclinada)', mode: 'cardio', minutes: 15, distanceKm: 1.3 },
      { category: 'Abdomen y Tiempo', name: 'Plancha abdominal frontal', mode: 'time', sets: 3, seconds: 45 },
      { category: 'Abdomen y Tiempo', name: 'Crunch en polea alta', mode: 'strength', sets: 3, reps: 15, weight: 25 },
    ],
  },
];
