import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApp, ALL_TOPICS } from '@/context/AppContext';

export default function CreateProfile() {
  const navigate = useNavigate();
  const { createProfile } = useApp();
  const [form, setForm] = useState({
    name: '',
    bio: '',
    age: '',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  });
  const [selectedTopics, setSelectedTopics] = useState([]);

  const toggleTopic = (topic) => {
    setSelectedTopics(prev => {
      if (prev.includes(topic)) return prev.filter(t => t !== topic);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, topic];
    });
  };

  const handleContinue = () => {
    createProfile({
      name: form.name || 'Ospite',
      bio: form.bio,
      age: form.age ? parseInt(form.age) : 24,
      photo: form.photo,
      interests: selectedTopics.length > 0 ? selectedTopics : ['Musica', 'Viaggi', 'Serate'],
    });
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-10">
      {/* Header */}
      <div className="flex items-center mb-8">
        <button onClick={() => navigate(-1)} className="p-1 text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-foreground mb-8">
          Crea il tuo profilo
        </h1>

        {/* Photo */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-border">
              <img
                src={form.photo}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <button className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center glow-pink">
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-5 mb-7">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Nome utente
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Il tuo nome"
              className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Bio (opzionale)
            </label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Raccontati in poche parole..."
              className="bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50 resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Età
            </label>
            <Input
              type="number"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="24"
              className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50 w-24"
            />
          </div>
        </div>

        {/* Topics */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              I tuoi interessi
            </label>
            <span className={`text-xs font-medium ${selectedTopics.length === 5 ? 'text-primary' : 'text-muted-foreground'}`}>
              {selectedTopics.length}/5
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_TOPICS.map(topic => {
              const selected = selectedTopics.includes(topic);
              const maxReached = selectedTopics.length >= 5 && !selected;
              return (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  disabled={maxReached}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                    selected
                      ? 'bg-primary text-primary-foreground glow-pink'
                      : maxReached
                        ? 'bg-secondary/50 text-muted-foreground/40 cursor-not-allowed'
                        : 'bg-secondary text-secondary-foreground border border-border/50 hover:border-primary/40'
                  }`}
                >
                  {selected && <Check className="w-3 h-3" />}
                  {topic}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Seleziona fino a 5 interessi. Puoi modificarli in seguito dal profilo.
          </p>
        </div>

        <Button
          onClick={handleContinue}
          className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
        >
          Continua
        </Button>
      </motion.div>
    </div>
  );
}
