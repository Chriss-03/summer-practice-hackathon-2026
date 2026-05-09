import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(helmet());
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

const groupSize: Record<Sport, { min: number; ideal: number; max: number }> = {
  Football: { min: 10, ideal: 12, max: 14 },
  Tennis: { min: 2, ideal: 2, max: 4 },
  Basketball: { min: 6, ideal: 8, max: 10 },
  Running: { min: 2, ideal: 5, max: 20 },
  Volleyball: { min: 6, ideal: 8, max: 12 },
  Padel: { min: 2, ideal: 4, max: 4 }
};

const users: UserProfile[] = [
  { id: 'u1', name: 'Alex Ionescu', email: 'alex@example.com', description: 'Competitive football and weekend basketball. I like organized, high-energy games.', sports: ['Football', 'Basketball'], skill: 'Intermediate', lat: 44.4268, lng: 26.1025, radiusKm: 8, availability: 'yes', achievements: ['Early mover'] },
  { id: 'u2', name: 'Mara Popa', email: 'mara@example.com', description: 'Tennis, padel and casual running after work.', sports: ['Tennis', 'Padel', 'Running'], skill: 'Beginner', lat: 44.432, lng: 26.1, radiusKm: 5, availability: 'yes', achievements: ['Social starter'] },
  { id: 'u3', name: 'Vlad Marin', email: 'vlad@example.com', description: 'Basketball shooter, happy to captain and coordinate venues.', sports: ['Basketball'], skill: 'Advanced', lat: 44.418, lng: 26.12, radiusKm: 10, availability: 'yes', achievements: ['Captain material'] },
  { id: 'u4', name: 'Ioana Stan', email: 'ioana@example.com', description: 'Football goalkeeper and volleyball beginner.', sports: ['Football', 'Volleyball'], skill: 'Intermediate', lat: 44.44, lng: 26.09, radiusKm: 7, availability: 'maybe', achievements: [] },
  { id: 'u5', name: 'Radu Ene', email: 'radu@example.com', description: 'Basketball and football, flexible schedule.', sports: ['Basketball', 'Football'], skill: 'Intermediate', lat: 44.424, lng: 26.13, radiusKm: 9, availability: 'yes', achievements: [] },
  { id: 'u6', name: 'Ana Dima', email: 'ana@example.com', description: 'Padel doubles and tennis. Prefer friendly games.', sports: ['Padel', 'Tennis'], skill: 'Intermediate', lat: 44.45, lng: 26.08, radiusKm: 6, availability: 'yes', achievements: [] },
  { id: 'u7', name: 'Sorin Matei', email: 'sorin@example.com', description: 'Basketball point guard, volleyball for fun.', sports: ['Basketball', 'Volleyball'], skill: 'Beginner', lat: 44.421, lng: 26.105, radiusKm: 7, availability: 'yes', achievements: [] },
  { id: 'u8', name: 'Elena Barbu', email: 'elena@example.com', description: 'Running groups, tennis and beginner basketball.', sports: ['Running', 'Tennis', 'Basketball'], skill: 'Beginner', lat: 44.435, lng: 26.11, radiusKm: 8, availability: 'yes', achievements: [] }
];

const venues: Venue[] = [
  { id: 'v1', name: 'Arena Sportivă Tineretului', sport: 'Football', address: 'Parcul Tineretului, Bucharest', lat: 44.407, lng: 26.107, pricePerHour: 180, rating: 4.6 },
  { id: 'v2', name: 'Hoop Factory', sport: 'Basketball', address: 'Splaiul Unirii 160, Bucharest', lat: 44.421, lng: 26.134, pricePerHour: 120, rating: 4.5 },
  { id: 'v3', name: 'Central Tennis Club', sport: 'Tennis', address: 'Bulevardul Unirii, Bucharest', lat: 44.426, lng: 26.104, pricePerHour: 90, rating: 4.4 },
  { id: 'v4', name: 'Padel Social Club', sport: 'Padel', address: 'Floreasca, Bucharest', lat: 44.456, lng: 26.102, pricePerHour: 140, rating: 4.7 },
  { id: 'v5', name: 'Herastrau Running Loop', sport: 'Running', address: 'King Mihai I Park, Bucharest', lat: 44.47, lng: 26.08, pricePerHour: 0, rating: 4.8 },
  { id: 'v6', name: 'Urban Volley Court', sport: 'Volleyball', address: 'Politehnica, Bucharest', lat: 44.438, lng: 26.048, pricePerHour: 100, rating: 4.2 }
];

let groups: MatchGroup[] = [];
let messages: ChatMessage[] = [];
let events: ManualEvent[] = [];

const sportKeywords: Record<Sport, string[]> = {
  Football: ['football', 'soccer', 'goalkeeper', 'striker', 'futsal'],
  Tennis: ['tennis', 'racket', 'singles', 'serve'],
  Basketball: ['basketball', 'hoop', 'shooter', 'point guard'],
  Running: ['running', 'jogging', 'run', 'marathon'],
  Volleyball: ['volleyball', 'volley', 'beach volley'],
  Padel: ['padel', 'doubles']
};

function distanceKm(a: Pick<UserProfile | Venue, 'lat' | 'lng'>, b: Pick<UserProfile | Venue, 'lat' | 'lng'>) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function inferSports(text: string): Sport[] {
  const normalized = text.toLowerCase();
  return (Object.keys(sportKeywords) as Sport[]).filter((sport) =>
    sportKeywords[sport].some((keyword) => normalized.includes(keyword))
  );
}

function compatibility(memberIds: string[], sport: Sport) {
  const members = memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as UserProfile[];
  const availableScore = members.filter((u) => u.availability === 'yes').length / Math.max(members.length, 1);
  const sportScore = members.filter((u) => u.sports.includes(sport)).length / Math.max(members.length, 1);
  const centroid = {
    lat: members.reduce((sum, u) => sum + u.lat, 0) / Math.max(members.length, 1),
    lng: members.reduce((sum, u) => sum + u.lng, 0) / Math.max(members.length, 1)
  };
  const avgDistance = members.reduce((sum, u) => sum + distanceKm(u, centroid), 0) / Math.max(members.length, 1);
  const proximityScore = Math.max(0, 1 - avgDistance / 10);
  return Math.round((0.45 * availableScore + 0.35 * sportScore + 0.2 * proximityScore) * 100);
}

function selectCaptain(memberIds: string[]) {
  const sorted = [...memberIds].sort((a, b) => {
    const userA = users.find((u) => u.id === a)!;
    const userB = users.find((u) => u.id === b)!;
    const scoreA = (userA.achievements.includes('Captain material') ? 2 : 0) + (userA.skill === 'Advanced' ? 1 : 0);
    const scoreB = (userB.achievements.includes('Captain material') ? 2 : 0) + (userB.skill === 'Advanced' ? 1 : 0);
    return scoreB - scoreA || userA.name.localeCompare(userB.name);
  });
  return sorted[0];
}

function generateGroups() {
  const generated: MatchGroup[] = [];
  const available = users.filter((u) => u.availability === 'yes' || u.availability === 'maybe');

  (Object.keys(groupSize) as Sport[]).forEach((sport) => {
    const candidates = available
      .filter((u) => u.sports.includes(sport))
      .sort((a, b) => (a.availability === 'yes' ? -1 : 1) - (b.availability === 'yes' ? -1 : 1));

    const size = groupSize[sport];
    if (candidates.length < size.min) return;

    const memberIds = candidates.slice(0, Math.min(size.ideal, candidates.length, size.max)).map((u) => u.id);
    const suggestedVenueIds = venues
      .filter((v) => v.sport === sport)
      .sort((a, b) => b.rating - a.rating || a.pricePerHour - b.pricePerHour)
      .slice(0, 3)
      .map((v) => v.id);

    generated.push({
      id: randomUUID(),
      sport,
      title: `${sport} ShowUp Squad`,
      captainId: selectCaptain(memberIds),
      memberIds,
      compatibilityScore: compatibility(memberIds, sport),
      suggestedVenueIds,
      status: 'pending-confirmation',
      createdAt: new Date().toISOString()
    });
  });

  groups = generated;
  return generated;
}

const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  description: z.string().min(5),
  photoUrl: z.string().optional().or(z.literal('')),
  sports: z.array(z.enum(['Football', 'Tennis', 'Basketball', 'Running', 'Volleyball', 'Padel'])).min(1),
  skill: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  lat: z.number(),
  lng: z.number(),
  radiusKm: z.number().min(1).max(50)
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'showup2move-api' }));

app.get('/api/bootstrap', (_req, res) => {
  if (!groups.length) generateGroups();
  res.json({ users, venues, groups, messages, events, groupSize });
});

app.post('/api/profiles', (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const profile: UserProfile = { ...parsed.data, id: randomUUID(), availability: 'maybe', achievements: ['New teammate'] };
  users.push(profile);
  res.status(201).json(profile);
});

app.patch('/api/profiles/:id/availability', (req, res) => {
  const schema = z.object({ availability: z.enum(['yes', 'no', 'maybe']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.availability = parsed.data.availability;
  res.json(user);
});

app.post('/api/ai/infer-sports', (req, res) => {
  const schema = z.object({ description: z.string().default(''), photoFileName: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const sports = inferSports(`${parsed.data.description} ${parsed.data.photoFileName ?? ''}`);
  res.json({ sports, confidence: sports.length ? 0.78 : 0.25, note: 'Prototype heuristic. Swap this service with a real multimodal model for production image understanding.' });
});

app.post('/api/matches/generate', (_req, res) => {
  res.json(generateGroups());
});

app.patch('/api/groups/:id/confirm', (req, res) => {
  const group = groups.find((g) => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  group.status = 'confirmed';
  res.json(group);
});

app.get('/api/groups/:id/messages', (req, res) => {
  res.json(messages.filter((m) => m.groupId === req.params.id));
});

app.post('/api/groups/:id/messages', (req, res) => {
  const schema = z.object({ userId: z.string(), body: z.string().min(1).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const message: ChatMessage = { id: randomUUID(), groupId: req.params.id, userId: parsed.data.userId, body: parsed.data.body, createdAt: new Date().toISOString() };
  messages.push(message);
  res.status(201).json(message);
});

app.get('/api/venues', (req, res) => {
  const sport = req.query.sport as Sport | undefined;
  res.json(sport ? venues.filter((v) => v.sport === sport) : venues);
});

app.post('/api/events', (req, res) => {
  const schema = z.object({
    title: z.string().min(3),
    sport: z.enum(['Football', 'Tennis', 'Basketball', 'Running', 'Volleyball', 'Padel']),
    ownerId: z.string(),
    startsAt: z.string(),
    location: z.string().min(3),
    details: z.string().default(''),
    participantIds: z.array(z.string()).default([])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const event: ManualEvent = { ...parsed.data, id: randomUUID(), participantIds: Array.from(new Set([parsed.data.ownerId, ...parsed.data.participantIds])) };
  events.push(event);
  res.status(201).json(event);
});

app.listen(PORT, () => {
  console.log(`ShowUp2Move API running on http://localhost:${PORT}`);
});
