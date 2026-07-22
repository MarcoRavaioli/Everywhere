// Catalogo dei badge, in un solo posto. Le soglie corrispondono a quelle
// decise; i conteggi arrivano dal backend (my_stats / night_participants).
// Tutto derivato: nessuno stato da tenere sincronizzato.

export const BADGE_CATALOG = [
  {
    code: 'drinks',
    statKey: 'drinks_offered',
    label: 'Drink offerti',
    emoji: '🍸',
    tiers: [20, 40, 80],
    tierNames: ['Generoso', 'Mecenate', 'Leggenda del bancone'],
  },
  {
    code: 'nights',
    statKey: 'nights_attended',
    label: 'Serate',
    emoji: '🎉',
    tiers: [10, 50, 100],
    tierNames: ['Habitué', 'Nottambulo', 'Veterano'],
  },
  {
    code: 'matches',
    statKey: 'matches',
    label: 'Match',
    emoji: '💖',
    tiers: [5, 25, 50],
    tierNames: ['Primo match', 'Calamita', 'Irresistibile'],
  },
];

// stats: { nights_attended, drinks_offered, matches }
// Ritorna, per ogni categoria, il valore, il livello raggiunto (-1 = nessuno),
// il nome del livello e la soglia successiva.
export function computeBadges(stats = {}) {
  return BADGE_CATALOG.map(b => {
    const value = stats[b.statKey] ?? 0;
    const reached = b.tiers.filter(t => value >= t).length; // 0..3
    const tierIdx = reached - 1;
    return {
      code: b.code,
      label: b.label,
      emoji: b.emoji,
      value,
      unlocked: tierIdx >= 0,
      tier: tierIdx,                                   // -1 se non sbloccato
      tierName: tierIdx >= 0 ? b.tierNames[tierIdx] : null,
      currentThreshold: tierIdx >= 0 ? b.tiers[tierIdx] : 0,
      nextThreshold: b.tiers[reached] ?? null,        // null = massimo raggiunto
    };
  });
}

// Solo i badge effettivamente sbloccati (per una vista compatta).
export function unlockedBadges(stats = {}) {
  return computeBadges(stats).filter(b => b.unlocked);
}
