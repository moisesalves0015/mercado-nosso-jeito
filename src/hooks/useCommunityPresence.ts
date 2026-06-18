/**
 * useCommunityPresence
 *
 * Generates all community-presence data deterministically from a
 * date/hour seed.  No real user data is exposed — numbers feel
 * organic because they vary by hour/day, are consistent within a
 * session and always paint a positive, busy picture of the condo.
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Seeded PRNG (mulberry32) ──────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getSeed(): number {
  const now = new Date();
  // Changes every hour so numbers shift naturally throughout the day
  return now.getFullYear() * 1000000 + (now.getMonth() + 1) * 10000 +
    now.getDate() * 100 + now.getHours();
}

function seededRange(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── Types ────────────────────────────────────────────────────
export interface ActivityStats {
  orders: number;
  checkins: number;
  deliveries: number;
  missionsDone: number;
  goalOrders: number;
  ic: number;           // Community Index 0-100
  icLabel: string;
  progressPct: number;  // goal progress 0-100
}

export interface SocialProofMessage {
  emoji: string;
  text: string;
}

export interface LiveActivity {
  id: string;
  emoji: string;
  text: string;
}

export interface RankingEntry {
  position: number;
  name: string;
  points: number;
  isUser: boolean;
  tier: 'gold' | 'silver' | 'bronze' | 'default';
}

export interface SeasonInfo {
  name: string;
  year: number;
  month: number;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  endDateLabel: string;
}

export interface CondoFavorite {
  rank: number;
  emoji: string;
  name: string;
  id: string;
}

// ─── Static data pools ────────────────────────────────────────
const SOCIAL_PROOF_POOL: SocialProofMessage[] = [
  { emoji: '🏢', text: '{N} moradores do seu condomínio utilizaram o app hoje.' },
  { emoji: '🛒', text: '{N} pedidos foram realizados nos últimos 30 minutos.' },
  { emoji: '🔥', text: '{N} moradores aproveitaram a promoção desta semana.' },
  { emoji: '☕', text: 'O café da manhã é a categoria mais comprada hoje.' },
  { emoji: '📦', text: '{N} entregas realizadas hoje no condomínio.' },
  { emoji: '🎯', text: '{N} missões do Clube foram concluídas hoje.' },
  { emoji: '⭐', text: 'Nosso Clube está com {N} membros ativos esta semana.' },
  { emoji: '🥤', text: 'Bebidas geladas são o item favorito do momento.' },
  { emoji: '💎', text: '{N} recompensas foram resgatadas no Clube hoje.' },
];

const LIVE_ACTIVITY_POOL: Omit<LiveActivity, 'id'>[] = [
  { emoji: '☕', text: 'Um morador acabou de comprar café.' },
  { emoji: '🥤', text: 'Um morador aproveitou a promoção de refrigerantes.' },
  { emoji: '🎁', text: 'Uma recompensa foi resgatada no Clube.' },
  { emoji: '🍺', text: 'Um pedido de cervejas geladas saiu.' },
  { emoji: '🥛', text: 'Um morador fez seu check-in diário.' },
  { emoji: '🛒', text: 'Um novo pedido está a caminho.' },
  { emoji: '🍫', text: 'Um produto em promoção foi comprado.' },
  { emoji: '💎', text: 'Alguém acabou de subir no ranking do Clube.' },
  { emoji: '🏅', text: 'Uma missão foi concluída por um morador.' },
  { emoji: '🧃', text: 'Um morador aproveitou a oferta de sucos.' },
];

const RANKING_NAMES = [
  'Rafael', 'Amanda', 'Lucas', 'Juliana', 'Marcos',
  'Fernanda', 'Bruno', 'Camila', 'Diego', 'Larissa',
];

const CONDO_FAVORITES: CondoFavorite[] = [
  { rank: 1, emoji: '🥤', name: 'Coca-Cola Lata 350ml', id: 'coca-cola-350ml' },
  { rank: 2, emoji: '⚡', name: 'Monster Energy 473ml', id: 'monster-energy' },
  { rank: 3, emoji: '🍺', name: 'Heineken Long Neck 330ml', id: 'heineken-330ml' },
  { rank: 4, emoji: '🧀', name: 'Pão de Queijo Tradicional 1kg', id: 'paodequeijo-novo' },
  { rank: 5, emoji: '☕', name: 'Café Melitta Tradicional 500g', id: 'cafe-novo' },
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ─── Helper: build season info ────────────────────────────────
function buildSeasonInfo(): SeasonInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return {
    name: `${MONTH_NAMES[month]} ${year}`,
    year,
    month,
    daysTotal: daysInMonth,
    daysElapsed: day,
    daysRemaining: daysInMonth - day,
    endDateLabel: `${String(daysInMonth).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`,
  };
}

// ─── Helper: build activity stats ────────────────────────────
function buildActivityStats(): ActivityStats {
  const seed = getSeed();
  const rng = mulberry32(seed);

  // Vary by time of day: more activity in the afternoon
  const hour = new Date().getHours();
  const dayMultiplier = hour < 8 ? 0.4 : hour < 12 ? 0.7 : hour < 18 ? 1.0 : 0.85;

  const goalOrders = 40;
  const orders = Math.floor(seededRange(rng, 18, 38) * dayMultiplier);
  const checkins = Math.floor(seededRange(rng, 12, 28) * dayMultiplier);
  const deliveries = Math.floor(orders * seededRange(rng, 85, 98) / 100);
  const missionsDone = Math.floor(seededRange(rng, 8, 22) * dayMultiplier);
  const progressPct = Math.min(100, Math.round((orders / goalOrders) * 100));

  // IC formula: weighted average of engagement signals
  const ic = Math.min(100, Math.round(
    (checkins * 0.3 + orders * 0.4 + missionsDone * 0.3)
  ));

  let icLabel = 'Comunidade ativa';
  if (ic >= 85) icLabel = 'Comunidade muito ativa 🔥';
  else if (ic >= 65) icLabel = 'Comunidade ativa hoje';
  else if (ic >= 40) icLabel = 'Atividade moderada';
  else icLabel = 'Atividade baixa hoje';

  return { orders, checkins, deliveries, missionsDone, goalOrders, ic, icLabel, progressPct };
}

// ─── Helper: social proof message ────────────────────────────
function buildSocialProofMessage(index: number): SocialProofMessage {
  const seed = getSeed() + index * 997;
  const rng = mulberry32(seed);
  const pool = SOCIAL_PROOF_POOL;
  const template = pool[Math.floor(rng() * pool.length)];
  const n = seededRange(rng, 5, 47);
  return {
    emoji: template.emoji,
    text: template.text.replace('{N}', String(n)),
  };
}

// ─── Helper: ranking ─────────────────────────────────────────
function buildRanking(userPoints: number): RankingEntry[] {
  const seed = getSeed();
  const rng = mulberry32(seed);

  // Generate 4 NPCs above the user with random point totals
  const topPoints = Array.from({ length: 4 }, (_, i) =>
    Math.max(userPoints + 200 + i * 180, seededRange(rng, userPoints + 120, userPoints + 1200 - i * 150))
  ).sort((a, b) => b - a);

  const entries: RankingEntry[] = topPoints.map((pts, i) => ({
    position: i + 1,
    name: RANKING_NAMES[i % RANKING_NAMES.length],
    points: pts,
    isUser: false,
    tier: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default',
  }));

  // Insert user at position 5
  entries.push({
    position: 5,
    name: 'Você',
    points: userPoints,
    isUser: true,
    tier: 'default',
  });

  return entries;
}

// ─── Helper: generate live activities ────────────────────────
let _livePool = [...LIVE_ACTIVITY_POOL];
let _liveIndex = 0;

function pickNextActivity(): LiveActivity {
  if (_liveIndex >= _livePool.length) {
    // Reshuffle
    _livePool = [...LIVE_ACTIVITY_POOL].sort(() => Math.random() - 0.5);
    _liveIndex = 0;
  }
  const item = _livePool[_liveIndex++];
  return { ...item, id: `live-${Date.now()}-${Math.random()}` };
}

// ─── Hook ────────────────────────────────────────────────────
export function useCommunityPresence() {
  const [stats] = useState<ActivityStats>(() => buildActivityStats());
  const [season] = useState<SeasonInfo>(() => buildSeasonInfo());
  const [proofIndex, setProofIndex] = useState(0);
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>(() => [
    pickNextActivity(),
    pickNextActivity(),
  ]);

  // Rotate social proof message every 8 seconds
  useEffect(() => {
    const t = setInterval(() => setProofIndex(i => i + 1), 8000);
    return () => clearInterval(t);
  }, []);

  // Add a new live activity every 14-18 seconds
  useEffect(() => {
    const delay = Math.floor(Math.random() * 4000 + 14000);
    const t = setInterval(() => {
      setLiveActivities(prev => {
        const next = [pickNextActivity(), ...prev].slice(0, 3);
        return next;
      });
    }, delay);
    return () => clearInterval(t);
  }, []);

  const getSocialProof = useCallback((): SocialProofMessage => {
    return buildSocialProofMessage(proofIndex);
  }, [proofIndex]);

  const getRanking = useCallback((userPoints: number): RankingEntry[] => {
    return buildRanking(userPoints);
  }, []);

  return {
    stats,
    season,
    liveActivities,
    getSocialProof,
    getRanking,
    condoFavorites: CONDO_FAVORITES,
  };
}
