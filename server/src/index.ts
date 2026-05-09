import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "http://localhost:4000", "http://127.0.0.1:4000"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null
      }
    }
  })
);
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '5mb' }));

type Sport = 'Football' | 'Tennis' | 'Basketball' | 'Running' | 'Volleyball' | 'Padel';
type Skill = 'Beginner' | 'Intermediate' | 'Advanced';
type Availability = 'yes' | 'no' | 'maybe';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  description: string;
  photoUrl?: string;
  sports: Sport[];
  skill: Skill;
  lat: number;
  lng: number;
  radiusKm: number;
  availability: Availability;
  achievements: string[];
};

type Venue = {
  id: string;
  name: string;
  sport: Sport;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  rating: number;
};

type MatchGroup = {
  id: string;
  sport: Sport;
  title: string;
  description: string;
  captainId: string;
  memberIds: string[];
  compatibilityScore: number;
  suggestedVenueIds: string[];
  status: 'pending-confirmation' | 'confirmed';
  createdAt: string;
};

type ChatMessage = {
  id: string;
  groupId: string;
  userId: string;
  body: string;
  createdAt: string;
};

type ManualEvent = {
  id: string;
  title: string;
  sport: Sport;
  ownerId: string;
  startsAt: string;
  location: string;
  details: string;
  participantIds: string[];
};

type Database = {
  users: UserProfile[];
  groups: MatchGroup[];
  messages: ChatMessage[];
  events: ManualEvent[];
};

const sportValues = ['Football', 'Tennis', 'Basketball', 'Running', 'Volleyball', 'Padel'] as const;
const skillValues = ['Beginner', 'Intermediate', 'Advanced'] as const;
const availabilityValues = ['yes', 'no', 'maybe'] as const;

const groupSize: Record<Sport, { min: number; ideal: number; max: number }> = {
  Football: { min: 2, ideal: 5, max: 14 },
  Tennis: { min: 2, ideal: 2, max: 4 },
  Basketball: { min: 2, ideal: 4, max: 10 },
  Running: { min: 2, ideal: 5, max: 20 },
  Volleyball: { min: 2, ideal: 4, max: 12 },
  Padel: { min: 2, ideal: 4, max: 4 }
};

const groupBranding: Record<Sport, { names: string[]; description: string }> = {
  Football: {
    names: [
      'Class on Grass FC',
      'Touchline Titans',
      'First Touch FC',
      'Offside Stories',
      'The 90-Minute Alliance',
      'Sunday League Legends'
    ],
    description: 'Football group for team play, quick passes, and match-day energy.'
  },
  Tennis: {
    names: [
      'Rocket Pockets',
      'Serve Aces',
      'Baseline Bandits',
      'Rally Rebels',
      'Net Set Go',
      'Topspin Society'
    ],
    description: 'Tennis group for fast rallies, light gear, and balls ready to fly.'
  },
  Basketball: {
    names: [
      'Alley-Oops',
      'Hoop Voltage',
      'Rim Reapers',
      'Fast Break Club',
      'Court Vision',
      'Bucket Brigade'
    ],
    description: 'Basketball group for high-energy runs, fast breaks, and clutch shots.'
  },
  Running: {
    names: [
      'Worst Pace Scenario',
      'Pace Makers',
      'Run Intended',
      'Slow Motion Squad',
      'Miles Ahead',
      'The Joggernauts'
    ],
    description: 'Running group for casual pace, fresh air, and steady motivation.'
  },
  Volleyball: {
    names: [
      'Net Gains',
      'Block Party',
      'Set to Impress',
      'Spike Squad',
      'Serve Squad',
      'Block Party'
    ],
    description: 'Volleyball group for serves, saves, spikes, and team chemistry.'
  },
  Padel: {
    names: [
      'Glass Court Club',
      'Wall Street Padel',
      'Padel Pushers',
      'Doubles Trouble',
      'Glass Smashers',
      'The Wall Rallies'
    ],
    description: 'Padel group for doubles rallies, wall play, and social games.'
  }
};

function pickGroupName(sport: Sport, usedNames: Set<string>) {
  const names = groupBranding[sport].names;
  const availableNames = names.filter((name) => !usedNames.has(name));

  const pool = availableNames.length > 0 ? availableNames : names;
  const selectedName = pool[Math.floor(Math.random() * pool.length)];

  usedNames.add(selectedName);

  return selectedName;
}

const seedUsers: UserProfile[] = [
  {
    id: 'u1',
    name: 'Alex Ionescu',
    email: 'alex@example.com',
    description: 'Competitive football and weekend basketball. I like organized, high-energy games.',
    sports: ['Football', 'Basketball'],
    skill: 'Intermediate',
    lat: 45.7489,
    lng: 21.2087,
    radiusKm: 8,
    availability: 'yes',
    achievements: ['Early mover']
  },
  {
    id: 'u2',
    name: 'Mara Popa',
    email: 'mara@example.com',
    description: 'Tennis, padel and casual running after work.',
    sports: ['Tennis', 'Padel', 'Running'],
    skill: 'Beginner',
    lat: 45.7537,
    lng: 21.2257,
    radiusKm: 5,
    availability: 'yes',
    achievements: ['Social starter']
  },
  {
    id: 'u3',
    name: 'Vlad Marin',
    email: 'vlad@example.com',
    description: 'Basketball shooter, happy to captain and coordinate venues.',
    sports: ['Basketball'],
    skill: 'Advanced',
    lat: 45.742,
    lng: 21.2135,
    radiusKm: 10,
    availability: 'yes',
    achievements: ['Captain material']
  },
  {
    id: 'u4',
    name: 'Ioana Stan',
    email: 'ioana@example.com',
    description: 'Football goalkeeper and volleyball beginner.',
    sports: ['Football', 'Volleyball'],
    skill: 'Intermediate',
    lat: 45.7596,
    lng: 21.23,
    radiusKm: 7,
    availability: 'maybe',
    achievements: []
  },
  {
    id: 'u5',
    name: 'Radu Ene',
    email: 'radu@example.com',
    description: 'Basketball and football, flexible schedule.',
    sports: ['Basketball', 'Football'],
    skill: 'Intermediate',
    lat: 45.7369,
    lng: 21.231,
    radiusKm: 9,
    availability: 'yes',
    achievements: []
  },
  {
    id: 'u6',
    name: 'Ana Dima',
    email: 'ana@example.com',
    description: 'Padel doubles and tennis. Prefer friendly games.',
    sports: ['Padel', 'Tennis'],
    skill: 'Intermediate',
    lat: 45.767,
    lng: 21.218,
    radiusKm: 6,
    availability: 'yes',
    achievements: []
  },
  {
    id: 'u7',
    name: 'Sorin Matei',
    email: 'sorin@example.com',
    description: 'Basketball point guard, volleyball for fun.',
    sports: ['Basketball', 'Volleyball'],
    skill: 'Beginner',
    lat: 45.7528,
    lng: 21.2381,
    radiusKm: 7,
    availability: 'yes',
    achievements: []
  },
  {
    id: 'u8',
    name: 'Elena Barbu',
    email: 'elena@example.com',
    description: 'Running groups, tennis and beginner basketball.',
    sports: ['Running', 'Tennis', 'Basketball'],
    skill: 'Beginner',
    lat: 45.7512,
    lng: 21.2305,
    radiusKm: 8,
    availability: 'yes',
    achievements: []
  }
];

const venues: Venue[] = [
  {
    id: 'v1',
    name: 'Stadionul Electrica',
    sport: 'Football',
    address: 'Strada Renașterii 41, Timișoara',
    pricePerHour: 180,
    rating: 4.5,
    lat: 45.769028,
    lng: 21.25444
  },
  {
    id: 'v2',
    name: 'Banu Sport',
    sport: 'Football',
    address: 'Aleea F. C. Ripensia 33, Timișoara',
    pricePerHour: 170,
    rating: 4.4,
    lat: 45.7412249,
    lng: 21.2421405
  },
  {
    id: 'v3',
    name: 'Baza Sportivă nr. 2 UPT',
    sport: 'Football',
    address: 'Strada Prof. Dr. Aurel Păunescu Podeanu 2, Timișoara',
    pricePerHour: 160,
    rating: 4.3,
    lat: 45.7409,
    lng: 21.2446
  },
  {
    id: 'v4',
    name: 'Padel Center Timișoara',
    sport: 'Football',
    address: 'Strada Praga 6, Dumbrăvița, Timiș',
    pricePerHour: 160,
    rating: 4.5,
    lat: 45.7859,
    lng: 21.2446
  },
  {
    id: 'v5',
    name: 'Arena Aquasport',
    sport: 'Tennis',
    address: 'Calea Dorobanților 92A, Timișoara',
    pricePerHour: 90,
    rating: 4.4,
    lat: 45.7694,
    lng: 21.2681
  },
  {
    id: 'v6',
    name: 'Banu Sport',
    sport: 'Tennis',
    address: 'Aleea F. C. Ripensia 33, Timișoara',
    pricePerHour: 90,
    rating: 4.4,
    lat: 45.7412249,
    lng: 21.2421405
  },
  {
    id: 'v7',
    name: 'Baza Sportivă nr. 2 UPT',
    sport: 'Tennis',
    address: 'Strada Prof. Dr. Aurel Păunescu Podeanu 2, Timișoara',
    pricePerHour: 80,
    rating: 4.3,
    lat: 45.7409,
    lng: 21.2446
  },
  {
    id: 'v8',
    name: 'Club Sportiv Dyadora',
    sport: 'Tennis',
    address: 'Strada Neptun 31, Giroc, Timiș',
    pricePerHour: 95,
    rating: 4.5,
    lat: 45.6948,
    lng: 21.2359
  },
  {
    id: 'v9',
    name: 'Teren de Baschet UVT',
    sport: 'Basketball',
    address: 'Bulevardul Vasile Pârvan 4, Timișoara',
    pricePerHour: 0,
    rating: 4.3,
    lat: 45.74775,
    lng: 21.22838
  },
  {
    id: 'v10',
    name: 'Sala Constantin Jude',
    sport: 'Basketball',
    address: 'Aleea F. C. Ripensia 7, Timișoara',
    pricePerHour: 140,
    rating: 4.4,
    lat: 45.745828,
    lng: 21.241122
  },
  {
    id: 'v11',
    name: 'Banu Sport',
    sport: 'Basketball',
    address: 'Aleea F. C. Ripensia 33, Timișoara',
    pricePerHour: 120,
    rating: 4.4,
    lat: 45.7412249,
    lng: 21.2421405
  },
  {
    id: 'v12',
    name: 'Parcul Rozelor',
    sport: 'Running',
    address: 'Parcul Rozelor, Timișoara',
    pricePerHour: 0,
    rating: 4.7,
    lat: 45.75,
    lng: 21.23194
  },
  {
    id: 'v13',
    name: 'Malul Begăi',
    sport: 'Running',
    address: 'Malul Begăi, Timișoara',
    pricePerHour: 0,
    rating: 4.6,
    lat: 45.7528,
    lng: 21.2381
  },
  {
    id: 'v14',
    name: 'Parcul Botanic',
    sport: 'Running',
    address: 'Parcul Botanic, Timișoara',
    pricePerHour: 0,
    rating: 4.5,
    lat: 45.7591,
    lng: 21.2265
  },
  {
    id: 'v15',
    name: 'Parcul Copiilor Ion Creangă',
    sport: 'Running',
    address: 'Parcul Copiilor Ion Creangă, Timișoara',
    pricePerHour: 0,
    rating: 4.5,
    lat: 45.7534,
    lng: 21.2326
  },
  {
    id: 'v16',
    name: 'Sala de Sport UVT Oituz',
    sport: 'Volleyball',
    address: 'Strada Oituz, Timișoara',
    pricePerHour: 120,
    rating: 4.4,
    lat: 45.76181,
    lng: 21.22963
  },
  {
    id: 'v17',
    name: 'Sala de Sport UVT',
    sport: 'Volleyball',
    address: 'Bulevardul Vasile Pârvan 4, Timișoara',
    pricePerHour: 120,
    rating: 4.4,
    lat: 45.74775,
    lng: 21.22838
  },
  {
    id: 'v18',
    name: 'Sala Constantin Jude',
    sport: 'Volleyball',
    address: 'Aleea F. C. Ripensia 7, Timișoara',
    pricePerHour: 150,
    rating: 4.4,
    lat: 45.745828,
    lng: 21.241122
  },
  {
    id: 'v19',
    name: 'Banu Sport',
    sport: 'Volleyball',
    address: 'Aleea F. C. Ripensia 33, Timișoara',
    pricePerHour: 120,
    rating: 4.4,
    lat: 45.7412249,
    lng: 21.2421405
  },
  {
    id: 'v20',
    name: 'Padel Center Timișoara',
    sport: 'Padel',
    address: 'Strada Praga 6, Dumbrăvița, Timiș',
    pricePerHour: 140,
    rating: 4.5,
    lat: 45.7859,
    lng: 21.2446
  }
];

const databasePath = path.join(process.cwd(), 'server', 'data', 'database.json');

function createInitialDatabase(): Database {
  return {
    users: seedUsers,
    groups: [],
    messages: [],
    events: []
  };
}

function ensureDatabaseFile() {
  const directory = path.dirname(databasePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(databasePath)) {
    const initialDatabase = createInitialDatabase();
    fs.writeFileSync(databasePath, JSON.stringify(initialDatabase, null, 2));
  }
}

function readDatabase(): Database {
  ensureDatabaseFile();

  try {
    const raw = fs.readFileSync(databasePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Database>;

    return {
      users: Array.isArray(parsed.users) ? parsed.users : seedUsers,
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      events: Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch {
    const fallbackDatabase = createInitialDatabase();
    fs.writeFileSync(databasePath, JSON.stringify(fallbackDatabase, null, 2));
    return fallbackDatabase;
  }
}

function writeDatabase(database: Database) {
  fs.writeFileSync(databasePath, JSON.stringify(database, null, 2));
}

const initialDatabase = readDatabase();

let users: UserProfile[] = initialDatabase.users.length ? initialDatabase.users : seedUsers;
let groups: MatchGroup[] = initialDatabase.groups;
let messages: ChatMessage[] = initialDatabase.messages;
let events: ManualEvent[] = initialDatabase.events;

function persist() {
  writeDatabase({
    users,
    groups,
    messages,
    events
  });
}

persist();

function distanceKm(
  a: Pick<UserProfile | Venue, 'lat' | 'lng'>,
  b: Pick<UserProfile | Venue, 'lat' | 'lng'>
) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(h));
}

function compatibility(memberIds: string[], sport: Sport) {
  const members = memberIds
    .map((id) => users.find((user) => user.id === id))
    .filter(Boolean) as UserProfile[];

  const availableScore =
    members.filter((user) => user.availability === 'yes').length / Math.max(members.length, 1);

  const sportScore =
    members.filter((user) => user.sports.includes(sport)).length / Math.max(members.length, 1);

  const centroid = {
    lat: members.reduce((sum, user) => sum + user.lat, 0) / Math.max(members.length, 1),
    lng: members.reduce((sum, user) => sum + user.lng, 0) / Math.max(members.length, 1)
  };

  const avgDistance =
    members.reduce((sum, user) => sum + distanceKm(user, centroid), 0) /
    Math.max(members.length, 1);

  const proximityScore = Math.max(0, 1 - avgDistance / 10);

  return Math.round((0.45 * availableScore + 0.35 * sportScore + 0.2 * proximityScore) * 100);
}

function selectCaptain(memberIds: string[]) {
  const sorted = [...memberIds].sort((a, b) => {
    const userA = users.find((user) => user.id === a)!;
    const userB = users.find((user) => user.id === b)!;

    const scoreA =
      (userA.achievements.includes('Captain material') ? 2 : 0) +
      (userA.skill === 'Advanced' ? 1 : 0);

    const scoreB =
      (userB.achievements.includes('Captain material') ? 2 : 0) +
      (userB.skill === 'Advanced' ? 1 : 0);

    return scoreB - scoreA || userA.name.localeCompare(userB.name);
  });

  return sorted[0];
}

function generateFreshGroups() {
  const generated: MatchGroup[] = [];
  const usedNames = new Set<string>();
  const available = users.filter(
    (user) => user.availability === 'yes' || user.availability === 'maybe'
  );

  (Object.keys(groupSize) as Sport[]).forEach((sport) => {
    const candidates = available
      .filter((user) => user.sports.includes(sport))
      .sort((a, b) => {
        if (a.availability === b.availability) return a.name.localeCompare(b.name);
        return a.availability === 'yes' ? -1 : 1;
      });

    const size = groupSize[sport];

    if (candidates.length < size.min) return;

    const memberIds = candidates
      .slice(0, Math.min(size.ideal, candidates.length, size.max))
      .map((user) => user.id);

    const suggestedVenueIds = venues
      .filter((venue) => venue.sport === sport)
      .sort((a, b) => b.rating - a.rating || a.pricePerHour - b.pricePerHour)
      .slice(0, 3)
      .map((venue) => venue.id);

    generated.push({
      id: randomUUID(),
      sport,
      title: pickGroupName(sport, usedNames),
      description: groupBranding[sport].description,
      captainId: selectCaptain(memberIds),
      memberIds,
      compatibilityScore: compatibility(memberIds, sport),
      suggestedVenueIds,
      status: 'pending-confirmation',
      createdAt: new Date().toISOString()
    });
  });

  return generated;
}

function regenerateGroupsPreservingConfirmed() {
  const confirmedGroups = groups.filter((group) => group.status === 'confirmed');
  const freshGroups = generateFreshGroups();

  groups = [...confirmedGroups, ...freshGroups];
  persist();

  return groups;
}

const sportKeywords: Record<Sport, string[]> = {
  Football: ['football', 'soccer', 'futsal', 'striker', 'goalkeeper', 'keeper', 'midfielder', 'defender', 'winger', 'pitch', 'field', 'kick', 'kicking', 'goals', 'goal', '11v11', '5 a side', '5-a-side'],
  Tennis: ['tennis', 'racket', 'racquet', 'serve', 'serving', 'rally', 'rallies', 'court', 'forehand', 'backhand', 'baseline', 'singles', 'doubles', 'wimbledon', 'balls in my pocket', 'light gear'],
  Basketball: ['basketball', 'hoops', 'hoop', 'shooting', 'shooter', 'dunk', 'layup', 'dribble', 'dribbling', 'court', '3v3', '5v5', 'pick up', 'pickup', 'nba', 'fast break', 'fast breaks', 'rebound', 'passing'],
  Running: ['running', 'run', 'runner', 'jog', 'jogging', '5k', '10k', 'marathon', 'trail', 'pace', 'cardio', 'endurance', 'morning run', 'evening run', 'fresh air', 'fitness'],
  Volleyball: ['volleyball', 'beach volleyball', 'serve', 'spike', 'spiking', 'block', 'dig', 'setter', 'libero', 'net', 'sand', 'beach game', 'team chemistry'],
  Padel: ['padel', 'paddle', 'glass court', 'walls', 'wall play', 'doubles', 'racket sport', 'racquet sport', 'fast social game', 'court walls']
};

function inferSports(text: string): Sport[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const scores = (Object.keys(sportKeywords) as Sport[]).map((sport) => {
    const score = sportKeywords[sport].reduce((total, keyword) => {
      const normalizedKeyword = keyword.toLowerCase();

      if (!normalized.includes(normalizedKeyword)) return total;
      if (normalizedKeyword === sport.toLowerCase()) return total + 5;
      if (normalizedKeyword.length >= 8) return total + 3;

      return total + 2;
    }, 0);

    return { sport, score };
  });

  return scores
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sport)
    .slice(0, 3);
}

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email is required'),
  description: z.string().trim().min(1, 'Description is required'),
  photoUrl: z.string().trim().optional().or(z.literal('')),
  sports: z.array(z.enum(sportValues)).min(1, 'Choose at least one sport'),
  skill: z.enum(skillValues),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusKm: z.coerce.number().min(1).max(50)
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'showup2move-api' });
});

app.get('/api/bootstrap', (_req, res) => {
  if (!groups.length) {
    groups = generateFreshGroups();
    persist();
  }

  res.json({
    users,
    venues,
    groups,
    messages,
    events,
    groupSize
  });
});

app.post('/api/profiles', (req, res) => {
  const parsed = profileSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid profile data',
      details: parsed.error.flatten()
    });
  }

  const emailExists = users.some(
    (user) => user.email.toLowerCase() === parsed.data.email.toLowerCase()
  );

  if (emailExists) {
    return res.status(409).json({
      error: 'A user with this email already exists.'
    });
  }

  const profile: UserProfile = {
    ...parsed.data,
    id: randomUUID(),
    availability: 'maybe',
    achievements: ['New teammate']
  };

  users.push(profile);
  persist();

  res.status(201).json(profile);
});

app.patch('/api/profiles/:id/availability', (req, res) => {
  const schema = z.object({
    availability: z.enum(availabilityValues)
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid availability',
      details: parsed.error.flatten()
    });
  }

  const user = users.find((candidate) => candidate.id === req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.availability = parsed.data.availability;
  persist();

  res.json(user);
});

app.post('/api/ai/infer-sports', (req, res) => {
  const schema = z.object({
    description: z.string().default(''),
    photoFileName: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid inference payload',
      details: parsed.error.flatten()
    });
  }

  const inferredSports = inferSports(
    `${parsed.data.description} ${parsed.data.photoFileName ?? ''}`
  );

  res.json({
    sports: inferredSports,
    confidence: inferredSports.length ? 0.78 : 0.25,
    note: 'Prototype heuristic. Swap this service with a real multimodal model for production image understanding.'
  });
});

app.post('/api/matches/generate', (_req, res) => {
  const updatedGroups = regenerateGroupsPreservingConfirmed();
  res.json(updatedGroups);
});

app.patch('/api/groups/:id/confirm', (req, res) => {
  const schema = z.object({
    userId: z.string(),
    action: z.enum(['confirm', 'cancel'])
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid confirmation payload',
      details: parsed.error.flatten()
    });
  }

  const group = groups.find((candidate) => candidate.id === req.params.id);

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const user = users.find((candidate) => candidate.id === parsed.data.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (parsed.data.action === 'confirm') {
    if (!group.memberIds.includes(user.id)) {
      group.memberIds.push(user.id);
    }

    user.availability = 'yes';
  }

  if (parsed.data.action === 'cancel') {
    group.memberIds = group.memberIds.filter((memberId) => memberId !== user.id);

    if (group.captainId === user.id && group.memberIds.length > 0) {
      group.captainId = selectCaptain(group.memberIds);
    }
  }

  if (group.memberIds.length > 0) {
    group.status = 'confirmed';
    group.compatibilityScore = compatibility(group.memberIds, group.sport);
  } else {
    group.status = 'pending-confirmation';
    group.compatibilityScore = 0;
  }

  persist();

  res.json(group);
});

app.get('/api/groups/:id/messages', (req, res) => {
  res.json(messages.filter((message) => message.groupId === req.params.id));
});

app.post('/api/groups/:id/messages', (req, res) => {
  const schema = z.object({
    userId: z.string(),
    body: z.string().trim().min(1).max(500)
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid message',
      details: parsed.error.flatten()
    });
  }

  const groupExists = groups.some((group) => group.id === req.params.id);
  const userExists = users.some((user) => user.id === parsed.data.userId);

  if (!groupExists) return res.status(404).json({ error: 'Group not found' });
  if (!userExists) return res.status(404).json({ error: 'User not found' });

  const message: ChatMessage = {
    id: randomUUID(),
    groupId: req.params.id,
    userId: parsed.data.userId,
    body: parsed.data.body,
    createdAt: new Date().toISOString()
  };

  messages.push(message);
  persist();

  res.status(201).json(message);
});

app.get('/api/venues', (req, res) => {
  const sport = req.query.sport as Sport | undefined;
  res.json(sport ? venues.filter((venue) => venue.sport === sport) : venues);
});

app.post('/api/events', (req, res) => {
  const schema = z.object({
    title: z.string().trim().min(1, 'Title is required'),
    sport: z.enum(sportValues),
    ownerId: z.string(),
    startsAt: z.string().min(1, 'Start time is required'),
    location: z.string().trim().min(1, 'Location is required'),
    details: z.string().default(''),
    participantIds: z.array(z.string()).default([])
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid event data',
      details: parsed.error.flatten()
    });
  }

  const event: ManualEvent = {
    ...parsed.data,
    id: randomUUID(),
    participantIds: Array.from(new Set([parsed.data.ownerId, ...parsed.data.participantIds]))
  };

  events.push(event);
  persist();

  res.status(201).json(event);
});

app.listen(PORT, () => {
  console.log(`ShowUp2Move API running on http://localhost:${PORT}`);
});