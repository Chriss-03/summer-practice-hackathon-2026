import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  api,
  Availability,
  BootstrapData,
  ChatMessage,
  MatchGroup,
  ManualEvent,
  Sport,
  UserProfile
} from './lib/api';
import './styles.css';

const sports: Sport[] = ['Football', 'Tennis', 'Basketball', 'Running', 'Volleyball', 'Padel'];

type AppPage = 'dashboard' | 'matches' | 'coordination' | 'community' | 'events' | 'admin';

type ProfileFormState = {
  name: string;
  email: string;
  description: string;
  photoUrl: string;
  sports: Sport[];
  skill: 'Beginner' | 'Intermediate' | 'Advanced';
  lat: number;
  lng: number;
  radiusKm: number;
};

function Icon({ label }: { label: string }) {
  return (
    <span className="icon" aria-hidden="true">
      {label}
    </span>
  );
}

function Pill({
  children,
  tone = 'neutral'
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Avatar({ user }: { user: Pick<UserProfile, 'name' | 'photoUrl'> }) {
  const [failed, setFailed] = useState(false);

  if (user.photoUrl && !failed) {
    return (
      <div className="avatar">
        <img
          src={user.photoUrl}
          alt={`${user.name} profile`}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return <div className="avatar">{user.name.slice(0, 1)}</div>;
}

function Section({
  title,
  eyebrow,
  children,
  action
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="card section">
      <div className="section-header">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [page, setPage] = useState<AppPage>('dashboard');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showSignup, setShowSignup] = useState(false);
  const [expandedLoginUserId, setExpandedLoginUserId] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [messageDraft, setMessageDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [groupSportFilter, setGroupSportFilter] = useState<'All' | Sport>('All');

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    name: '',
    email: '',
    description: '',
    photoUrl: '',
    sports: ['Football'],
    skill: 'Beginner',
    lat: 45.7489,
    lng: 21.2087,
    radiusKm: 8
    });

  const [eventForm, setEventForm] = useState({
    title: '',
    sport: 'Basketball' as Sport,
    startsAt: '',
    location: '',
    details: ''
  });

  async function refresh(preferredGroupId?: string | null) {
    const bootstrap = await api.bootstrap();

    setData(bootstrap);

    setSelectedGroupId((existing) => {
      const preferred = preferredGroupId ?? existing;

      if (preferred && bootstrap.groups.some((group) => group.id === preferred)) {
        return preferred;
      }

      return bootstrap.groups[0]?.id ?? null;
    });
  }

  useEffect(() => {
    refresh().catch(() => setNotice('API unavailable. Start the server with npm run dev.'));
  }, []);

  const selectedGroup =
    data?.groups.find((group) => group.id === selectedGroupId) ?? data?.groups[0];

  const currentUser = currentUserId
    ? data?.users.find((user) => user.id === currentUserId)
    : null;

  const selectedMessages =
    data?.messages.filter((message) => message.groupId === selectedGroup?.id) ?? [];

  const stats = useMemo(() => {
    if (!data) return { available: 0, groups: 0, events: 0, confirmed: 0 };

    return {
      available: data.users.filter((user) => user.availability === 'yes').length,
      groups: data.groups.length,
      events: data.events.length,
      confirmed: data.groups.filter((group) => group.status === 'confirmed').length
    };
  }, [data]);

  const personalizedGroups = useMemo(() => {
    if (!data) return [];

    if (isAdmin || !currentUser) {
      return data.groups;
    }

    return [...data.groups].sort((a, b) => {
      const aIsPreferred = currentUser.sports.includes(a.sport);
      const bIsPreferred = currentUser.sports.includes(b.sport);

      if (aIsPreferred !== bIsPreferred) {
        return aIsPreferred ? -1 : 1;
      }

      const aHasUser = a.memberIds.includes(currentUser.id);
      const bHasUser = b.memberIds.includes(currentUser.id);

      if (aHasUser !== bHasUser) {
        return aHasUser ? -1 : 1;
      }

      return b.compatibilityScore - a.compatibilityScore;
    });
  }, [data, currentUser, isAdmin]);

  const filteredGroups = useMemo(() => {
    if (groupSportFilter === 'All') {
      if (isAdmin || !currentUser) {
        return personalizedGroups;
      }

      return personalizedGroups.filter((group) => currentUser.sports.includes(group.sport));
    }

    return personalizedGroups.filter((group) => group.sport === groupSportFilter);
  }, [personalizedGroups, groupSportFilter, currentUser, isAdmin]);

  function loginAsUser(userId: string) {
    const demoPassword = 'move123';

    if (loginPassword !== demoPassword) {
      setLoginError('Incorrect password. For the demo, use move123.');
      return;
    }

    setCurrentUserId(userId);
    setIsAdmin(false);
    setPage('dashboard');
    setShowSignup(false);
    setExpandedLoginUserId(null);
    setLoginPassword('');
    setLoginError('');
    setNotice('');
  }

  async function setAvailability(availability: Availability) {
    if (!currentUserId) {
      setNotice('Select a player before setting availability.');
      return;
    }

    await api.setAvailability(currentUserId, availability);
    await refresh(selectedGroupId);
  }

  async function generateMatches() {
    await api.generateMatches();
    await refresh(selectedGroupId);
    setNotice('Smart matching refreshed using sport, availability, group size and proximity signals.');
  }

  async function confirmGroup(group: MatchGroup) {
  if (!currentUserId || isAdmin) {
    setNotice('Log in as a player before changing participation.');
    return;
  }

  const userAlreadyJoined = group.memberIds.includes(currentUserId);

  const response = await fetch(`/api/groups/${group.id}/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUserId,
      action: userAlreadyJoined ? 'cancel' : 'confirm'
    })
  });

  if (!response.ok) {
    setNotice('Could not update participation. Please try again.');
    return;
  }

  await refresh(group.id);

  setNotice(
    userAlreadyJoined
      ? `${currentUser?.name ?? 'Player'} cancelled participation in ${group.title}.`
      : `${currentUser?.name ?? 'Player'} confirmed participation in ${group.title}.`
  );
}

  async function sendMessage() {
    if (!selectedGroup || !messageDraft.trim()) return;

    if (!currentUserId) {
      setNotice('Select a player before sending a chat message.');
      return;
    }

    await api.sendMessage(selectedGroup.id, currentUserId, messageDraft.trim());
    setMessageDraft('');
    await refresh(selectedGroup.id);
  }

  async function createProfile(event: React.FormEvent) {
    event.preventDefault();

    try {
      const createdProfile = await api.createProfile(profileForm);

      await refresh(selectedGroupId);

      setProfileForm({
        name: '',
        email: '',
        description: '',
        photoUrl: '',
        sports: ['Football'],
        skill: 'Beginner',
        lat: 45.7489,
        lng: 21.2087,
        radiusKm: 8
      });

      if (isAdmin) {
        setNotice('User created by admin. The new player is visible in Community Players.');
        return;
      }

      setCurrentUserId(createdProfile.id);
      setIsAdmin(false);
      setShowSignup(false);
      setExpandedLoginUserId(null);
      setLoginPassword('');
      setLoginError('');
      setPage('dashboard');
      setNotice('Account created. You are now logged in as the new player.');
    } catch (error) {
      console.error(error);
      setNotice('Could not create profile. Please add a valid name, email, description, and at least one sport.');
    }
  }

  async function inferProfileSports() {
    const result = await api.inferSports(profileForm.description, profileForm.photoUrl);

    if (result.sports.length) {
      setProfileForm((form) => ({ ...form, sports: result.sports }));
      setNotice(`Suggested sports from your description: ${result.sports.join(', ')}.`);
      return;
    }

    setNotice(
      'No sport suggestion found from the description, but you can still choose sports manually and create the profile.'
    );
  }

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();

    if (!currentUserId && !isAdmin) {
      setNotice('Select a player before creating an event.');
      return;
    }

    const groupToKeepSelected = selectedGroup?.id ?? selectedGroupId;

    await api.createEvent({
      ...eventForm,
      ownerId: currentUserId ?? 'admin',
      participantIds: currentUserId ? [currentUserId] : []
    });

    setEventForm({
      title: '',
      sport: 'Basketball',
      startsAt: '',
      location: '',
      details: ''
    });

    await refresh(groupToKeepSelected);
    setPage('events');
    setNotice('Manual event created.');
  }

  if (!data) {
    return (
      <main className="shell">
        <div className="card loading">Loading ShowUp2Move…</div>
      </main>
    );
  }

  if (!currentUserId && !isAdmin) {
    return (
      <main className="shell auth-shell">
        <section className="card auth-card">
          <div className="brand auth-brand">
            <Icon label="🏃" /> ShowUp2Move
          </div>

          <p className="eyebrow">Quick access</p>
          <h1>Choose a profile and start moving.</h1>
          <p className="hero-copy">
            Log in as an existing player, create a new player, or continue as admin.
          </p>

          {notice && <div className="notice">{notice}</div>}

          <div className="login-list">
            {data.users.map((user) => {
              const isExpanded = expandedLoginUserId === user.id;

              return (
                <article
                  className={`login-user-panel ${isExpanded ? 'expanded' : ''}`}
                  key={user.id}
                >
                  <button
                    type="button"
                    className="login-user"
                    onClick={() => {
                      setExpandedLoginUserId(isExpanded ? null : user.id);
                      setLoginPassword('');
                      setLoginError('');
                    }}
                  >
                    <div className="avatar">{user.name.slice(0, 1)}</div>

                    <span>
                      <strong>{user.name}</strong>
                      <small>{user.skill} · {user.sports.join(', ')}</small>
                    </span>

                    <span className="login-expand-indicator">{isExpanded ? '−' : '+'}</span>
                  </button>

                  {isExpanded && (
                    <div className="login-password-panel">
                      <label>
                        Password
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(event) => {
                            setLoginPassword(event.target.value);
                            setLoginError('');
                          }}
                          placeholder="Demo password: move123"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              loginAsUser(user.id);
                            }
                          }}
                          autoFocus
                        />
                      </label>

                      {loginError && <p className="form-error">{loginError}</p>}

                      <div className="button-row">
                        <button type="button" onClick={() => loginAsUser(user.id)}>
                          Log in
                        </button>

                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setExpandedLoginUserId(null);
                            setLoginPassword('');
                            setLoginError('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="button-row">
            <button
              className="secondary"
              onClick={() => {
                setShowSignup((value) => !value);
                setExpandedLoginUserId(null);
                setLoginPassword('');
                setLoginError('');
              }}
            >
              {showSignup ? 'Hide create user' : 'Create new user'}
            </button>

            <button
              className="secondary"
              onClick={() => {
                setIsAdmin(true);
                setCurrentUserId(null);
                setShowSignup(false);
                setExpandedLoginUserId(null);
                setLoginPassword('');
                setLoginError('');
                setPage('dashboard');
              }}
            >
              Admin console
            </button>
          </div>

          {showSignup && (
            <div className="signup-panel">
              <h2>Create your player profile</h2>
              <ProfileForm
                profileForm={profileForm}
                setProfileForm={setProfileForm}
                inferProfileSports={inferProfileSports}
                submitLabel="Create account"
                onSubmit={createProfile}
              />
            </div>
          )}

          <p className="muted">
            Existing players can log in instantly after entering the demo password. New players can create a profile before entering the app.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="app-header card">
        <div className="brand">
          <Icon label="🏃" /> ShowUp2Move
        </div>

        <div className="active-user-chip">
          <span className="eyebrow">{isAdmin ? 'Admin mode' : 'Active player'}</span>
          <strong>{isAdmin ? 'Admin Console' : currentUser?.name}</strong>
        </div>

        <button
          className="secondary"
          onClick={() => {
            setCurrentUserId(null);
            setIsAdmin(false);
            setShowSignup(false);
            setExpandedLoginUserId(null);
            setLoginPassword('');
            setLoginError('');
            setPage('dashboard');
          }}
        >
          Switch user
        </button>
      </header>

      <nav className="page-tabs card">
        <PageButton page="dashboard" currentPage={page} setPage={setPage} icon="🏠" label="Dashboard" />
        <PageButton page="matches" currentPage={page} setPage={setPage} icon="✨" label="Smart Matches" />
        <PageButton page="coordination" currentPage={page} setPage={setPage} icon="👥" label="Coordination" />
        <PageButton page="community" currentPage={page} setPage={setPage} icon="🌍" label="Community" />
        <PageButton page="events" currentPage={page} setPage={setPage} icon="📅" label="Events" />
        {isAdmin && <PageButton page="admin" currentPage={page} setPage={setPage} icon="🛠️" label="Admin" />}
      </nav>

      {notice && <div className="notice">{notice}</div>}

      {page === 'dashboard' && (
        <DashboardPage
          stats={stats}
          currentUser={currentUser}
          isAdmin={isAdmin}
          setAvailability={setAvailability}
          generateMatches={generateMatches}
          goToMatches={() => setPage('matches')}
          goToCoordination={() => setPage('coordination')}
        />
      )}

      {page === 'matches' && (
        <MatchesPage
          data={data}
          filteredGroups={filteredGroups}
          selectedGroup={selectedGroup}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          groupSportFilter={groupSportFilter}
          setGroupSportFilter={setGroupSportFilter}
          setSelectedGroupId={(groupId) => {
            setSelectedGroupId(groupId);
            setPage('coordination');
          }}
          confirmGroup={confirmGroup}
        />
      )}

      {page === 'coordination' && (
        <CoordinationPage
          selectedGroup={selectedGroup}
          data={data}
          selectedMessages={selectedMessages}
          messageDraft={messageDraft}
          setMessageDraft={setMessageDraft}
          sendMessage={sendMessage}
        />
      )}

      {page === 'community' && (
        <CommunityPage
          data={data}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onSwitchUser={(userId) => {
            setCurrentUserId(userId);
            setIsAdmin(false);
            setPage('dashboard');
            setNotice('Switched active player.');
          }}
        />
      )}

      {page === 'events' && (
        <EventsPage
          data={data}
          eventForm={eventForm}
          setEventForm={setEventForm}
          createEvent={createEvent}
        />
      )}

      {page === 'admin' && isAdmin && (
        <AdminPage
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          inferProfileSports={inferProfileSports}
          createProfile={createProfile}
          generateMatches={generateMatches}
          data={data}
        />
      )}
    </main>
  );
}

function PageButton({
  page,
  currentPage,
  setPage,
  icon,
  label
}: {
  page: AppPage;
  currentPage: AppPage;
  setPage: (page: AppPage) => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      className={`page-tab ${currentPage === page ? 'active' : ''}`}
      onClick={() => setPage(page)}
    >
      <Icon label={icon} />
      {label}
    </button>
  );
}

function DashboardPage({
  stats,
  currentUser,
  isAdmin,
  setAvailability,
  generateMatches,
  goToMatches,
  goToCoordination
}: {
  stats: { available: number; groups: number; events: number; confirmed: number };
  currentUser: UserProfile | null | undefined;
  isAdmin: boolean;
  setAvailability: (availability: Availability) => void;
  generateMatches: () => void;
  goToMatches: () => void;
  goToCoordination: () => void;
}) {
  return (
    <div className="page-grid">
      <section className="hero page-card">
        <div>
          <p className="eyebrow">Smart social sports matching</p>
          <h1>Say yes today. Get matched. Show up and move.</h1>
          <p className="hero-copy">
            A low-friction Timișoara prototype that handles profiles, availability,
            smart group generation, captains, chat, venues, logistics and manual events.
          </p>

          {!isAdmin ? (
            <div className="prompt card">
              <div>
                <p className="eyebrow">ShowUpToday?</p>
                <strong>{currentUser?.name ?? 'Demo user'}, are you available?</strong>
              </div>

              <div className="button-row">
                <button onClick={() => setAvailability('yes')}>
                  <Icon label="✓" /> Yes
                </button>
                <button className="secondary" onClick={() => setAvailability('maybe')}>
                  Maybe
                </button>
                <button className="ghost" onClick={() => setAvailability('no')}>
                  No
                </button>
              </div>
            </div>
          ) : (
            <div className="prompt card">
              <div>
                <p className="eyebrow">Admin console</p>
                <strong>Manage users, refresh matches, and inspect platform activity.</strong>
              </div>
            </div>
          )}
        </div>

        <div className="metrics">
          <Metric icon={<Icon label="👥" />} value={stats.available} label="available today" />
          <Metric icon={<Icon label="✨" />} value={stats.groups} label="auto groups" />
          <Metric icon={<Icon label="✓" />} value={stats.confirmed} label="confirmed" />
          <Metric icon={<Icon label="📅" />} value={stats.events} label="manual events" />
        </div>
      </section>

      <section className="quick-actions page-card">
        <p className="eyebrow">Workflow</p>
        <h2>Demo path</h2>
        <div className="action-grid">
          <button onClick={generateMatches}>Refresh matches</button>
          <button className="secondary" onClick={goToMatches}>Open Smart Matches</button>
          <button className="secondary" onClick={goToCoordination}>Open Coordination</button>
        </div>
      </section>
    </div>
  );
}

function MatchesPage({
  data,
  filteredGroups,
  selectedGroup,
  currentUserId,
  isAdmin,
  groupSportFilter,
  setGroupSportFilter,
  setSelectedGroupId,
  confirmGroup
}: {
  data: BootstrapData;
  filteredGroups: MatchGroup[];
  selectedGroup: MatchGroup | undefined;
  currentUserId: string | null;
  isAdmin: boolean;
  groupSportFilter: 'All' | Sport;
  setGroupSportFilter: (filter: 'All' | Sport) => void;
  setSelectedGroupId: (groupId: string) => void;
  confirmGroup: (group: MatchGroup) => void;
}) {
  return (
    <Section
      title="Smart matches"
      eyebrow="Personalized auto-generated groups"
      action={
        <label className="activity-filter">
          Activity
          <select
            value={groupSportFilter}
            onChange={(event) => setGroupSportFilter(event.target.value as 'All' | Sport)}
          >
            <option value="All">Recommended for me</option>
            {sports.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="group-list">
        {filteredGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            users={data.users}
            venues={data.venues}
            selected={group.id === selectedGroup?.id}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onSelect={() => setSelectedGroupId(group.id)}
            onConfirm={() => confirmGroup(group)}
          />
        ))}

        {!filteredGroups.length && (
          <p className="muted">
            No matching groups for this activity yet. Try another activity, update availability, or refresh matches.
          </p>
        )}
      </div>
    </Section>
  );
}

function CoordinationPage({
  selectedGroup,
  data,
  selectedMessages,
  messageDraft,
  setMessageDraft,
  sendMessage
}: {
  selectedGroup: MatchGroup | undefined;
  data: BootstrapData;
  selectedMessages: ChatMessage[];
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  sendMessage: () => void;
}) {
  return (
    <Section title="Group coordination" eyebrow={selectedGroup?.title ?? 'Select a group'}>
      {selectedGroup ? (
        <GroupDetail
          group={selectedGroup}
          data={data}
          messages={selectedMessages}
          draft={messageDraft}
          setDraft={setMessageDraft}
          sendMessage={sendMessage}
        />
      ) : (
        <p className="muted">No group selected. Open Smart Matches and choose one.</p>
      )}
    </Section>
  );
}

function CommunityPage({
  data,
  currentUserId,
  isAdmin,
  onSwitchUser
}: {
  data: BootstrapData;
  currentUserId: string | null;
  isAdmin: boolean;
  onSwitchUser: (userId: string) => void;
}) {
  return (
    <Section title="Community players" eyebrow="Created users & availability">
      <UsersList
        users={data.users}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onSwitchUser={onSwitchUser}
      />
    </Section>
  );
}

function EventsPage({
  data,
  eventForm,
  setEventForm,
  createEvent
}: {
  data: BootstrapData;
  eventForm: {
    title: string;
    sport: Sport;
    startsAt: string;
    location: string;
    details: string;
  };
  setEventForm: React.Dispatch<
    React.SetStateAction<{
      title: string;
      sport: Sport;
      startsAt: string;
      location: string;
      details: string;
    }>
  >;
  createEvent: (event: React.FormEvent) => void;
}) {
  return (
    <div className="split-page">
      <Section title="Manual event" eyebrow="Captain or user-created">
        <form className="form" onSubmit={createEvent}>
          <label>
            Title
            <input
              value={eventForm.title}
              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
              placeholder="Friday basketball run"
              required
            />
          </label>

          <div className="two-col">
            <label>
              Sport
              <select
                value={eventForm.sport}
                onChange={(e) => setEventForm({ ...eventForm, sport: e.target.value as Sport })}
              >
                {sports.map((sport) => (
                  <option key={sport}>{sport}</option>
                ))}
              </select>
            </label>

            <label>
              Time
              <input
                type="datetime-local"
                value={eventForm.startsAt}
                onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
                required
              />
            </label>
          </div>

          <label>
            Location
            <input
              value={eventForm.location}
              onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
              required
            />
          </label>

          <label>
            Details
            <textarea
              value={eventForm.details}
              onChange={(e) => setEventForm({ ...eventForm, details: e.target.value })}
            />
          </label>

          <button type="submit">
            <Icon label="📅" /> Create event
          </button>
        </form>
      </Section>

      <Section title="Events" eyebrow="Social layer">
        <div className="event-list">
          {data.events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}

          {!data.events.length && <p className="muted">No manual events yet.</p>}
        </div>

        {/* <div className="achievement">
          <Icon label="🏆" /> Gamification-ready: streaks, captain points and reliable teammate badges.
        </div> */}
      </Section>
    </div>
  );
}

function AdminPage({
  profileForm,
  setProfileForm,
  inferProfileSports,
  createProfile,
  generateMatches,
  data
}: {
  profileForm: {
    name: string;
    email: string;
    description: string;
    photoUrl: string;
    sports: Sport[];
    skill: 'Beginner' | 'Intermediate' | 'Advanced';
    lat: number;
    lng: number;
    radiusKm: number;
  };
  setProfileForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      email: string;
      description: string;
      photoUrl: string;
      sports: Sport[];
      skill: 'Beginner' | 'Intermediate' | 'Advanced';
      lat: number;
      lng: number;
      radiusKm: number;
    }>
  >;
  inferProfileSports: () => void;
  createProfile: (event: React.FormEvent) => void;
  generateMatches: () => void;
  data: BootstrapData;
}) {
  return (
    <div className="split-page">
      <Section title="Add user" eyebrow="Admin user creation">
        <ProfileForm
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          inferProfileSports={inferProfileSports}
          submitLabel="Create profile"
          onSubmit={createProfile}
        />
      </Section>

      <Section title="Admin overview" eyebrow="Platform controls">
        <div className="admin-overview">
          <div className="admin-stat">
            <strong>{data.users.length}</strong>
            <span>users</span>
          </div>
          <div className="admin-stat">
            <strong>{data.groups.length}</strong>
            <span>groups</span>
          </div>
          <div className="admin-stat">
            <strong>{data.events.length}</strong>
            <span>events</span>
          </div>
        </div>

        <button onClick={generateMatches}>
          <Icon label="↻" /> Refresh matches
        </button>
      </Section>
    </div>
  );
}

function ProfileForm({
  profileForm,
  setProfileForm,
  inferProfileSports,
  submitLabel,
  onSubmit
}: {
  profileForm: {
    name: string;
    email: string;
    description: string;
    photoUrl: string;
    sports: Sport[];
    skill: 'Beginner' | 'Intermediate' | 'Advanced';
    lat: number;
    lng: number;
    radiusKm: number;
  };
  setProfileForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      email: string;
      description: string;
      photoUrl: string;
      sports: Sport[];
      skill: 'Beginner' | 'Intermediate' | 'Advanced';
      lat: number;
      lng: number;
      radiusKm: number;
    }>
  >;
  inferProfileSports: () => void;
  submitLabel: string;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="two-col">
        <label>
          Name
          <input
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={profileForm.email}
            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
            required
          />
        </label>
      </div>

      <label>
        Description
        <textarea
          value={profileForm.description}
          onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
          placeholder="Say anything you want others to know about you. Sport hints are optional."
          required
        />
      </label>

      <div className="two-col">
        <div className="photo-field">
  <label>
    Profile picture URL
    <input
      value={profileForm.photoUrl}
      onChange={(e) => setProfileForm({ ...profileForm, photoUrl: e.target.value })}
      placeholder="https://example.com/profile.jpg"
    />
  </label>

  <div className="photo-preview">
    {profileForm.photoUrl ? (
      <img
        src={profileForm.photoUrl}
        alt="Profile preview"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    ) : (
      <span>{profileForm.name ? profileForm.name.slice(0, 1) : '?'}</span>
    )}
  </div>
</div>

        <label>
          Skill
          <select
            value={profileForm.skill}
            onChange={(e) =>
              setProfileForm({
                ...profileForm,
                skill: e.target.value as typeof profileForm.skill
              })
            }
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>
      </div>

      <div className="sport-picker">
        {sports.map((sport) => (
          <button
            type="button"
            key={sport}
            className={profileForm.sports.includes(sport) ? 'selected' : 'secondary'}
            onClick={() =>
              setProfileForm((form) => ({
                ...form,
                sports: form.sports.includes(sport)
                  ? form.sports.filter((item) => item !== sport)
                  : [...form.sports, sport]
              }))
            }
          >
            {sport}
          </button>
        ))}
      </div>

      <div className="button-row">
        <button type="button" className="secondary" onClick={inferProfileSports}>
          <Icon label="✨" /> Suggest sports
        </button>

        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="metric card">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function GroupCard({
  group,
  users,
  venues,
  selected,
  currentUserId,
  isAdmin,
  onSelect,
  onConfirm
}: {
  group: MatchGroup;
  users: UserProfile[];
  venues: BootstrapData['venues'];
  selected: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  onSelect: () => void;
  onConfirm: () => void;
}) {
  const captain = users.find((user) => user.id === group.captainId);
  const groupVenues = venues.filter((venue) => group.suggestedVenueIds.includes(venue.id));
  const userAlreadyJoined = !!currentUserId && group.memberIds.includes(currentUserId);
  const currentUser = users.find((user) => user.id === currentUserId);
  const isRecommendedForUser = !!currentUser && currentUser.sports.includes(group.sport);

  return (
    <article className={`group-card ${selected ? 'active' : ''}`} onClick={onSelect}>
      <div className="group-top">
  <h3>{group.title}</h3>
</div>

      <p className="group-description">{group.description}</p>

      <p className="muted">
        Captain: {captain?.name ?? 'TBD'} · {group.memberIds.length} players · {group.compatibilityScore}% fit
      </p>

      <div className="pills">
        <Pill>{group.sport}</Pill>
        {isRecommendedForUser && <Pill tone="success">recommended for you</Pill>}
        {groupVenues.slice(0, 1).map((venue) => (
          <Pill key={venue.id}>from {venue.pricePerHour} RON/h</Pill>
        ))}
      </div>

      {!isAdmin && (
        <button
          className="secondary full"
          onClick={(event) => {
            event.stopPropagation();
            onConfirm();
          }}
        >
          {userAlreadyJoined ? 'Cancel participation' : 'Confirm participation'}
        </button>
      )}
    </article>
  );
}

function GroupDetail({
  group,
  data,
  messages,
  draft,
  setDraft,
  sendMessage
}: {
  group: MatchGroup;
  data: BootstrapData;
  messages: ChatMessage[];
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: () => void;
}) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const members = group.memberIds
    .map((id) => data.users.find((user) => user.id === id))
    .filter(Boolean) as UserProfile[];

  const captain = data.users.find((user) => user.id === group.captainId);

  const recommendedVenues = data.venues.filter((venue) =>
    group.suggestedVenueIds.includes(venue.id)
  );

  const otherVenues = data.venues.filter((venue) =>
    !group.suggestedVenueIds.includes(venue.id)
  );

  const venues = [...recommendedVenues, ...otherVenues];
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId);

  useEffect(() => {
    setSelectedVenueId('');
  }, [group.id]);

  return (
    <div className="detail-stack">
      <div className="captain-box">
        <Icon label="👥" />
        <span>
          <strong>{captain?.name}</strong> is captain for this match.
        </span>
      </div>

      <div className="member-grid">
        {members.map((member) => (
          <div className="member" key={member.id}>
            <div className="avatar">{member.name.slice(0, 1)}</div>
            <div>
              <strong>{member.name}</strong>
              <small>{member.skill} · {member.availability}</small>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3>Choose activity place</h3>

        <div className="venue-picker">
          <label>
            Recommended and other places in Timișoara
            <select
              value={selectedVenueId}
              onChange={(event) => setSelectedVenueId(event.target.value)}
            >
              <option value="">Select a place for this activity</option>

              {recommendedVenues.length > 0 && (
                <optgroup label={`Recommended for ${group.sport}`}>
                  {recommendedVenues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} · {venue.sport} · {venue.pricePerHour} RON/h · ★ {venue.rating}
                    </option>
                  ))}
                </optgroup>
              )}

              {otherVenues.length > 0 && (
                <optgroup label="Other Timișoara venues">
                  {otherVenues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} · {venue.sport} · {venue.pricePerHour} RON/h · ★ {venue.rating}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          {selectedVenue && (
            <div className="selected-venue-card">
              <div>
                <p className="eyebrow">Selected place</p>
                <h3>{selectedVenue.name}</h3>
                <p className="muted">
                  {selectedVenue.address} · {selectedVenue.pricePerHour} RON/h · ★ {selectedVenue.rating}
                </p>
              </div>

              <a
                className="map-link"
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${selectedVenue.name}, ${selectedVenue.address}`
                )}`}
              >
                Open map
              </a>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3>
          <Icon label="💬" /> Event chat
        </h3>

        <div className="chat-window">
          {messages.map((message) => (
            <div className="chat-message" key={message.id}>
              <strong>
                {data.users.find((user) => user.id === message.userId)?.name ?? 'User'}
              </strong>
              <p>{message.body}</p>
            </div>
          ))}

          {!messages.length && (
            <p className="muted">Start with venue, time or split-cost coordination.</p>
          )}
        </div>

        <div className="chat-input">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message the group…"
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendMessage();
            }}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

function UsersList({
  users,
  currentUserId,
  isAdmin,
  onSwitchUser
}: {
  users: UserProfile[];
  currentUserId: string | null;
  isAdmin: boolean;
  onSwitchUser: (userId: string) => void;
}) {
  return (
    <div className="users-list">
      {users.map((user) => (
        <article
          className={`user-card ${user.id === currentUserId ? 'active-user-card' : ''}`}
          key={user.id}
        >
          <Avatar user={user} />

          <div className="user-card-body">
            <div className="user-card-top">
              <strong>{user.name}</strong>
              <Pill
                tone={
                  user.availability === 'yes'
                    ? 'success'
                    : user.availability === 'maybe'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {user.availability}
              </Pill>
            </div>

            <p className="user-description">{user.description}</p>

            <div className="pills">
              {user.sports.map((sport) => (
                <Pill key={sport}>{sport}</Pill>
              ))}
              <Pill>{user.skill}</Pill>
              <Pill>{user.radiusKm} km radius</Pill>
            </div>

            {isAdmin && (
              <button className="secondary full" onClick={() => onSwitchUser(user.id)}>
                Use this profile
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function EventRow({ event }: { event: ManualEvent }) {
  return (
    <div className="event-row">
      <strong>{event.title}</strong>
      <small>{event.sport} · {event.startsAt || 'time TBD'} · {event.location}</small>
      <p>{event.details}</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);