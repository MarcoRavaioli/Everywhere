import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import SessionTimer from '@/components/everywhere/SessionTimer';
import PersonCard from '@/components/everywhere/PersonCard';

export default function Session() {
  const { currentVenue, people } = useApp();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-foreground">
              {currentVenue?.name || 'MOON CLUB'}
            </h2>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
          <SessionTimer variant="compact" />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Users className="w-3 h-3 text-primary" />
          <span className="text-xs text-muted-foreground">128 persone presenti</span>
        </div>
      </div>

      {/* People Grid */}
      <div className="px-3 py-4">
        <div className="grid grid-cols-2 gap-3">
          {people.map((person, index) => (
            <PersonCard key={person.id} person={person} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
