import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, LogOut, Shield, Eye, Bell, Pencil, Check, X, Menu, Store, ChevronRight, ArrowLeft, Ban, DoorOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApp, ALL_TOPICS } from '@/context/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { DEFAULT_AVATAR, AvatarError } from '@/api/avatars';
import { fetchBlockedUsers, unblockUser } from '@/api/moderation';
import { fetchMyStats } from '@/api/badges';
import { computeBadges } from '@/lib/badges';
import BottomNav from '@/components/everywhere/BottomNav';

function BadgesSection({ stats }) {
  if (!stats) return null;
  const badges = computeBadges(stats);
  return (
    <div className="mb-8">
      <h3 className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
        Riconoscimenti
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {badges.map(b => (
          <div
            key={b.code}
            className={`rounded-xl p-3 text-center border ${
              b.unlocked ? 'glass border-primary/30' : 'border-border/40 opacity-50'
            }`}
          >
            <div className={`text-2xl mb-1 ${b.unlocked ? '' : 'grayscale'}`}>{b.emoji}</div>
            <p className="text-[11px] font-medium text-foreground truncate">{b.label}</p>
            {b.unlocked ? (
              <p className="text-[10px] text-primary truncate">{b.tierName}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {b.value}/{b.nextThreshold}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsItem({ icon: Icon, label, value, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/5 transition-colors">
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
      className="fixed inset-0 z-[60] flex flex-col bg-background overflow-y-auto"
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

function BlockedUsersSheet({ onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      setList(await fetchBlockedUsers());
    } catch (err) {
      setError(err?.message ?? 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUnblock = async (personId) => {
    if (busyId) return;
    setBusyId(personId);
    setError(null);
    try {
      await unblockUser(personId);
      await load();
    } catch (err) {
      setError(err?.message ?? 'Sblocco non riuscito.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="glass-strong px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground">Persone bloccate</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && <p className="text-destructive text-sm text-center mb-3">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-14 px-6">
            <Ban className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">Nessuna persona bloccata</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[250px] mx-auto">
              Chi blocchi finisce qui e puoi sbloccarlo quando vuoi.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map(person => (
              <div key={person.id} className="flex items-center gap-3 p-3 rounded-xl glass">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-border/50 flex-shrink-0">
                  <img
                    src={person.photo || DEFAULT_AVATAR}
                    alt={person.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                  />
                </div>
                <p className="text-sm text-foreground flex-1 min-w-0 truncate">{person.name}</p>
                <Button
                  onClick={() => handleUnblock(person.id)}
                  disabled={busyId === person.id}
                  variant="outline"
                  className="h-9 px-4 rounded-xl border-border/50 text-foreground text-xs"
                >
                  {busyId === person.id ? '…' : 'Sblocca'}
                </Button>
              </div>
            ))}
          </div>
        )}
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
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [stats, setStats] = useState(null);
  const fileInputRef = useRef(null);

  // I riconoscimenti sono derivati: si leggono anche fuori da una serata
  useEffect(() => {
    let cancelled = false;
    if (!currentUser || currentUser.isGuest) return;
    fetchMyStats()
      .then(s => { if (!cancelled) setStats(s); })
      .catch(err => console.error('Caricamento riconoscimenti fallito:', err));
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.isGuest]);

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

  // Uscire dal locale ≠ uscire dall'account: prima l'unico modo per
  // smettere di essere visibili era fare logout.
  const handleLeaveVenue = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await endSession();
      navigate('/home', { replace: true });
    } finally {
      setLeaving(false);
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

        {/* Riconoscimenti */}
        <BadgesSection stats={stats} />

        {/* Settings */}
        <div className="space-y-1.5 mb-8">
          <h3 className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
            Impostazioni
          </h3>
          <SettingsItem icon={Eye} label="Visibilità" value="Visibile" />
          <SettingsItem icon={Bell} label="Notifiche" value="Attive" />
          <SettingsItem icon={Shield} label="Privacy" />
          <SettingsItem icon={Ban} label="Persone bloccate" onClick={() => setBlockedOpen(true)} />
        </div>

        {isInSession && (
          <button
            onClick={handleLeaveVenue}
            disabled={leaving}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass border border-border/50 hover:bg-white/5 transition-colors mb-2 disabled:opacity-50"
          >
            <DoorOpen className="w-4 h-4 text-foreground" />
            <div className="text-left flex-1">
              <p className="text-sm text-foreground font-medium">
                {leaving ? 'Uscita in corso…' : 'Esci dalla serata'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Smetti di essere visibile · resti nel tuo account
              </p>
            </div>
          </button>
        )}

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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-[60] glass-strong rounded-t-3xl px-5 pt-5 pb-10"
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

      <AnimatePresence>
        {blockedOpen && <BlockedUsersSheet onClose={() => setBlockedOpen(false)} />}
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
