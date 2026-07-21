import React from 'react';
import { Users, MapPin, RefreshCw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import SessionTimer from '@/components/everywhere/SessionTimer';
import PersonCard from '@/components/everywhere/PersonCard';

function PeopleGrid({ list, offset = 0 }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {list.map((person, i) => (
        <PersonCard key={person.id} person={person} index={offset + i} />
      ))}
    </div>
  );
}

export default function Session() {
  const {
    currentVenue, currentNight, people, peopleLoading, peopleError,
    headcount, refreshPeople,
  } = useApp();

  // Chi è entrato dal mio stesso QR è "nella mia sala": stessa festa,
  // ma sapere chi hai davvero intorno cambia l'esperienza.
  const sameRoom = people.filter(p => p.sameRoom);
  const elsewhere = people.filter(p => !p.sameRoom);
  const myRoomLabel = sameRoom[0]?.roomLabel ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              {currentVenue?.name ?? 'Locale'}
            </h2>
            {currentNight?.title && (
              <p className="text-[11px] text-primary truncate">{currentNight.title}</p>
            )}
          </div>
          <SessionTimer variant="compact" />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-primary" />
            <span className="text-xs text-muted-foreground">
              {headcount === 1 ? '1 persona presente' : `${headcount} persone presenti`}
            </span>
          </span>
          {myRoomLabel && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
              <MapPin className="w-3 h-3" />
              {myRoomLabel}
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-4">
        {peopleError ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-muted-foreground leading-relaxed">{peopleError}</p>
            <button
              onClick={refreshPeople}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Riprova
            </button>
          </div>
        ) : peopleLoading && people.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : people.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-foreground font-medium">Sei il primo qui</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[260px] mx-auto">
              Appena qualcun altro entra nella serata lo vedrai comparire,
              senza dover ricaricare.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sameRoom.length > 0 && (
              <section>
                {elsewhere.length > 0 && (
                  <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 px-1">
                    {myRoomLabel ? `Nella tua sala · ${myRoomLabel}` : 'Vicino a te'}
                  </h3>
                )}
                <PeopleGrid list={sameRoom} />
              </section>
            )}

            {elsewhere.length > 0 && (
              <section>
                <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 px-1">
                  Altrove alla serata
                </h3>
                <PeopleGrid list={elsewhere} offset={sameRoom.length} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
