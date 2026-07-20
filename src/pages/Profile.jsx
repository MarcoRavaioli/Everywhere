import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, LogOut, Shield, Eye, Bell, Pencil, Check, X, Menu, Store, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApp, ALL_TOPICS } from '@/context/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { DEFAULT_AVATAR, AvatarError } from '@/api/avatars';
import BottomNav from '@/components/everywhere/BottomNav';

function SettingsItem({ icon: Icon, label, value }) {
  return (
    <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/5 transition-colors">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-foreground flex-1 text-left">{label}</span>
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
    </button>
  );
}

function EditProfileModal({ user, onSave, onClose }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    age: user?.age || '',
  });
  const [selectedTopics, setSelectedTopics] = useState(user?.interests || []);

  const toggleTopic = (topic) => {
    setSelectedTopics(prev => {
      if (prev.includes(topic)) return prev.filter(t => t !== topic);
      if (prev.length >= 5) return prev;
      return [...prev, topic];
    });
  };

  const handleSave = () => {
    onSave({
      name: form.name || user.name,
      bio: form.bio,
      age: form.age ? parseInt(form.age) : user.age,
      interests: selectedTopics,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background overflow-y-auto"
    >
      <div className="glass-strong px-4 pt-6 pb-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground">Modifica profilo</h2>
        <button
          onClick={handleSave}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center glow-pink"
        >
          <Check className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>

      <div className="px-6 py-6 space-y-6 pb-12">
        {/* Photo */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border">
              <img
                src={user?.photo || DEFAULT_AVATAR}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
              />
            </div>
            {/* La foto si cambia dall'avatar della pagina Profilo */}
          </div>
        </div>

        {/* Fields */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Nome utente</label>
          <Input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Il tuo nome"
            className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Bio</label>
          <Textarea
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            placeholder="Raccontati in poche parole..."
            className="bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50 resize-none"
            rows={3}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Età</label>
          <Input
            type="number"
            value={form.age}
            onChange={e => setForm({ ...form, age: e.target.value })}
            placeholder="24"
            className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50 w-24"
          />
        </div>

        {/* Topics */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Interessi</label>
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
        </div>
      </div>
    </motion.div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, updateProfile, endSession, uploadAvatar, setCurrentUser, isInSession } = useApp();
  const { logout } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = useRef(null);

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    setPhotoError(null);
    setUploading(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      setPhotoError(
        err instanceof AvatarError ? err.message : 'Caricamento non riuscito. Riprova.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Chiude davvero la sessione Supabase: prima veniva solo azzerato
  // lo stato locale e l'utente si ritrovava di nuovo dentro.
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      endSession();
      await logout();
      setCurrentUser(null); // copre anche la modalità ospite (nessuna sessione Supabase)
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className={`min-h-screen bg-background px-4 py-6 ${isInSession ? 'pb-24' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {!isInSession && (
            <button
              onClick={() => navigate('/home')}
              className="w-10 h-10 rounded-full glass flex items-center justify-center"
              aria-label="Torna alla home"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-foreground">Profilo</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <Menu className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Profile header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30">
              <img
                src={currentUser?.photo || DEFAULT_AVATAR}
                alt={currentUser?.name}
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
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center glow-pink disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          {photoError && (
            <p className="text-destructive text-xs mb-2 max-w-[260px]">{photoError}</p>
          )}
          <h2 className="text-xl font-bold text-foreground">
            {currentUser?.name || 'Ospite'}
            {currentUser?.age && <span className="font-normal text-muted-foreground">, {currentUser.age}</span>}
          </h2>
          {currentUser?.bio && (
            <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
              {currentUser.bio}
            </p>
          )}
        </div>

        {/* Interests */}
        {currentUser?.interests?.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
              Interessi
            </h3>
            <div className="flex flex-wrap gap-2">
              {currentUser.interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border/50"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-1.5 mb-8">
          <h3 className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
            Impostazioni
          </h3>
          <SettingsItem icon={Eye} label="Visibilità" value="Visibile" />
          <SettingsItem icon={Bell} label="Notifiche" value="Attive" />
          <SettingsItem icon={Shield} label="Privacy" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">{loggingOut ? 'Uscita in corso…' : 'Esci'}</span>
        </button>
      </motion.div>

      {/* Edit modal */}
      <AnimatePresence>
        {editOpen && (
          <EditProfileModal
            user={currentUser}
            onSave={updateProfile}
            onClose={() => setEditOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings hamburger drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-50 glass-strong rounded-t-3xl px-5 pt-5 pb-10"
            >
              <div className="w-10 h-1 rounded-full bg-border/60 mx-auto mb-5" />
              <h3 className="text-sm font-bold text-foreground mb-4">Impostazioni</h3>
              <div className="space-y-1.5">
                <HamburgerRow icon={Pencil} label="Modifica profilo" onClick={() => { setMenuOpen(false); setEditOpen(true); }} />
                <HamburgerRow icon={Bell} label="Notifiche" value="Attive" />
                <HamburgerRow icon={Eye} label="Visibilità" value="Visibile" />
                <HamburgerRow icon={Shield} label="Privacy" />
                <div className="border-t border-border/40 my-2" />
                <HamburgerRow
                  icon={Store}
                  label="Passa ad account business"
                  className="text-accent"
                  iconClass="text-accent"
                  onClick={() => { setMenuOpen(false); navigate('/business-onboarding'); }}
                />
                <div className="border-t border-border/40 my-2" />
                <HamburgerRow icon={LogOut} label="Esci" className="text-destructive" iconClass="text-destructive" onClick={handleLogout} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* La pagina vive anche fuori sessione: la nav in basso solo quando serve */}
      {isInSession && <BottomNav />}
    </div>
  );
}

function HamburgerRow({ icon: Icon, label, value, onClick, className = '', iconClass = 'text-muted-foreground' }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/5 transition-colors ${className}`}>
      <Icon className={`w-4 h-4 ${iconClass}`} />
      <span className="text-sm text-foreground flex-1 text-left">{label}</span>
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
    </button>
  );
}
