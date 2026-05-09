export type Sport = 'Football' | 'Tennis' | 'Basketball' | 'Running' | 'Volleyball' | 'Padel';
export type Skill = 'Beginner' | 'Intermediate' | 'Advanced';
export type Availability = 'yes' | 'no' | 'maybe';

export type UserProfile = {
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

export type Venue = {
  id: string;
  name: string;
  sport: Sport;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  rating: number;
};

export type MatchGroup = {
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

export type ChatMessage = {
  id: string;
  groupId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type ManualEvent = {
  id: string;
  title: string;
  sport: Sport;
  ownerId: string;
  startsAt: string;
  location: string;
  details: string;
  participantIds: string[];
};

export type BootstrapData = {
  users: UserProfile[];
  venues: Venue[];
  groups: MatchGroup[];
  messages: ChatMessage[];
  events: ManualEvent[];
  groupSize: Record<Sport, { min: number; ideal: number; max: number }>;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  bootstrap: () => request<BootstrapData>('/api/bootstrap'),
  setAvailability: (id: string, availability: Availability) =>
    request<UserProfile>(`/api/profiles/${id}/availability`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ availability }) }),
  createProfile: (profile: Omit<UserProfile, 'id' | 'availability' | 'achievements'>) =>
    request<UserProfile>('/api/profiles', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(profile) }),
  inferSports: (description: string, photoFileName?: string) =>
    request<{ sports: Sport[]; confidence: number; note: string }>('/api/ai/infer-sports', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ description, photoFileName }) }),
  generateMatches: () => request<MatchGroup[]>('/api/matches/generate', { method: 'POST' }),
  confirmGroup: (id: string) => request<MatchGroup>(`/api/groups/${id}/confirm`, { method: 'PATCH' }),
  sendMessage: (groupId: string, userId: string, body: string) =>
    request<ChatMessage>(`/api/groups/${groupId}/messages`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ userId, body }) }),
  createEvent: (event: Omit<ManualEvent, 'id'>) =>
    request<ManualEvent>('/api/events', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(event) })
};
