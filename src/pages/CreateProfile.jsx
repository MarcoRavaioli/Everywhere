import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApp, ALL_TOPICS } from '@/context/AppContext';
import { DEFAULT_AVATAR, AvatarError } from '@/api/avatars';

export default function CreateProfile() {
  const navigate = useNavigate();
  const { createProfile, currentUser, uploadAvatar } = useApp();
  const [form, setForm] = useState({
    name: '',
    bio: '',
    age: '',
    photo: null,
    photoPath: null,
  });
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = useRef(null);

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permette di riselezionare lo stesso file
    if (!file || uploading) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const { path, url } = await uploadAvatar(file);
      setForm(f => ({ ...f, photo: url, photoPath: path }));
    } catch (err) {
      setPhotoError(
        err instanceof AvatarError ? err.message : 'Caricamento non riuscito. Riprova.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Se un profilo esiste già (es. si arriva qui per errore o per modificarlo),
  // precompila i campi invece di partire da zero e sovrascrivere.
  useEffect(() => {
    if (currentUser && !currentUser.isGuest) {
      setForm(f => ({
        ...f,
        name: f.name || currentUser.name || '',
        bio: f.bio || currentUser.bio || '',
        age: f.age || (currentUser.age ?? ''),
      }));
      setSelectedTopics(prev => (prev.length > 0 ? prev : (currentUser.interests ?? [])));
    }
  }, [currentUser]);

  const toggleTopic = (topic) => {
    setSelectedTopics(prev => {
      if (prev.includes(topic)) return prev.filter(t => t !== topic);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, topic];
    });
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleContinue = async () => {
    const age = parseInt(form.age, 10);
    if (!form.name.trim()) {
      setError('Inserisci il tuo nome.');
      return;
    }
    if (!age || age < 18) {
      setError('Devi avere almeno 18 anni per usare EveryWhere.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createProfile({
        name: form.name.trim(),
        bio: form.bio.trim(),
        age,
        interests: selectedTopics,
        photoPath: form.photoPath,
      });
      navigate('/home');
    } catch (err) {
      console.error('Creazione profilo fallita:', err);
      setError('Salvataggio non riuscito. Controlla la connessione e riprova.');
    } finally {
      setSaving(false);
    }
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
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-border">
              <img
                src={form.photo || currentUser?.photo || DEFAULT_AVATAR}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelected}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center glow-pink disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          {photoError && (
            <p className="text-destructive text-xs mt-3 text-center max-w-[260px]">{photoError}</p>
          )}
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

        {error && (
          <p className="text-destructive text-sm text-center mb-4">{error}</p>
        )}

        <Button
          onClick={handleContinue}
          disabled={saving}
          className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
        >
          {saving ? 'Salvataggio…' : 'Continua'}
        </Button>
      </motion.div>
    </div>
  );
}
