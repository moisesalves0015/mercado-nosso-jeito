import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '../contexts/ToastContext';

export type BadgeCategory = 'Pertencimento' | 'Compra' | 'Constância' | 'Diamantes' | 'Especiais' | 'Secretos';
export type BadgeRarity = 'comum' | 'raro' | 'epico' | 'lendario' | 'mitico';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string;      
  color: string;     
  rarity: BadgeRarity;
  secret?: boolean;  
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  // Pertencimento
  { id: 'b_pioneer', name: 'Pioneiro', description: 'Um dos primeiros 100 moradores.', category: 'Pertencimento', icon: '🏅', color: '#10273A', rarity: 'mitico' },
  { id: 'b_founder', name: 'Cliente Fundador', description: 'Fez os primeiros pedidos.', category: 'Pertencimento', icon: '🏅', color: '#10273A', rarity: 'lendario' },
  { id: 'b_club', name: 'Morador Participativo', description: 'Entrou no Clube.', category: 'Pertencimento', icon: '🏅', color: '#10273A', rarity: 'raro' },
  { id: 'b_ambassador', name: 'Embaixador', description: 'Indicou 5 moradores.', category: 'Pertencimento', icon: '🏅', color: '#10273A', rarity: 'epico' },
  
  // Compra
  { id: 'b_soda', name: 'Mestre dos Refrigerantes', description: '20 refrigerantes.', category: 'Compra', icon: '🥤', color: '#06D6A0', rarity: 'comum' },
  { id: 'b_coffee', name: 'Apaixonado por Café', description: '15 compras.', category: 'Compra', icon: '☕', color: '#06D6A0', rarity: 'comum' },
  { id: 'b_snack', name: 'Rei dos Snacks', description: '30 snacks.', category: 'Compra', icon: '🍫', color: '#06D6A0', rarity: 'raro' },
  { id: 'b_night', name: 'Cliente da Madrugada', description: '10 compras após meia-noite.', category: 'Compra', icon: '🌙', color: '#06D6A0', rarity: 'epico' },

  // Constância
  { id: 'b_streak_7', name: '7 dias', description: 'Sequência de 7 dias.', category: 'Constância', icon: '🔥', color: '#FB8500', rarity: 'comum' },
  { id: 'b_streak_15', name: '15 dias', description: 'Sequência de 15 dias.', category: 'Constância', icon: '🔥', color: '#FB8500', rarity: 'raro' },
  { id: 'b_streak_30', name: '30 dias', description: 'Sequência de 30 dias.', category: 'Constância', icon: '🔥', color: '#FB8500', rarity: 'epico' },
  { id: 'b_streak_60', name: '60 dias', description: 'Sequência de 60 dias.', category: 'Constância', icon: '🔥', color: '#FB8500', rarity: 'lendario' },

  // Diamantes
  { id: 'b_first_diamond', name: 'Primeiro Diamante', description: 'Ganhou seu primeiro diamante.', category: 'Diamantes', icon: '💎', color: '#4CC9F0', rarity: 'comum' },
  { id: 'b_diamond_collector', name: 'Colecionador', description: 'Acumulou 100 diamantes.', category: 'Diamantes', icon: '💎', color: '#4CC9F0', rarity: 'raro' },
  { id: 'b_diamond_millionaire', name: 'Milionário dos Diamantes', description: 'Acumulou 1.000 diamantes.', category: 'Diamantes', icon: '💎', color: '#4CC9F0', rarity: 'lendario' },

  // Especiais
  { id: 'b_xmas_2026', name: 'Natal 2026', description: 'Participou do evento de Natal 2026.', category: 'Especiais', icon: '🎄', color: '#FFC107', rarity: 'epico' },
  { id: 'b_halloween_2026', name: 'Halloween 2026', description: 'Participou do evento de Halloween 2026.', category: 'Especiais', icon: '🎃', color: '#FFC107', rarity: 'epico' },
  { id: 'b_bday', name: 'Aniversário do app', description: 'Esteve conosco no aniversário do aplicativo.', category: 'Especiais', icon: '🎂', color: '#FFC107', rarity: 'lendario' },
  { id: 'b_summer_2027', name: 'Verão 2027', description: 'Aproveitou o verão 2027 conosco.', category: 'Especiais', icon: '🏖️', color: '#FFC107', rarity: 'raro' },

  // Secretos
  { id: 'b_sec_combo', name: 'Combo Perfeito', description: 'Coca-Cola + Doritos + Gelo.', category: 'Secretos', icon: '🥤', color: '#9B5DE5', rarity: 'epico', secret: true },
  { id: 'b_sec_rain', name: 'Dia Chuvoso', description: 'Comprou em dia de chuva.', category: 'Secretos', icon: '🌧️', color: '#9B5DE5', rarity: 'raro', secret: true },
  { id: 'b_sec_owl', name: 'Coruja', description: 'Comprou após 2h da manhã.', category: 'Secretos', icon: '🦉', color: '#9B5DE5', rarity: 'lendario', secret: true },
];

export function useBadges() {
  const { userProfile, updateUserProfile } = useAuth();
  const { success } = useToast();

  const unlockedIds = useMemo(() => userProfile?.unlockedBadges || [], [userProfile?.unlockedBadges]);

  const activeUnlockedIds = useMemo(() => {
    if (unlockedIds.length === 0) {
      return ['b_pioneer', 'b_first_diamond', 'b_sec_owl', 'b_streak_7'];
    }
    return unlockedIds;
  }, [unlockedIds]);

  const getBadge = useCallback((id: string) => BADGE_DEFINITIONS.find(b => b.id === id), []);

  const unlockedBadges = useMemo(() => 
    activeUnlockedIds.map(getBadge).filter(Boolean) as BadgeDef[], 
  [activeUnlockedIds, getBadge]);



  const unlockBadge = async (badgeId: string) => {
    if (!userProfile) return;
    if (unlockedIds.includes(badgeId)) return;

    const newUnlocked = [...unlockedIds, badgeId];
    try {
      await updateUserProfile({ unlockedBadges: newUnlocked });
      const badge = getBadge(badgeId);
      if (badge) {
        success('Novo selo conquistado!', `${badge.name}`);
      }
    } catch (e) {
      console.error('Failed to unlock badge', e);
    }
  };

  return {
    badges: BADGE_DEFINITIONS,
    unlockedBadges,
    unlockedIds: activeUnlockedIds,
    unlockBadge,
  };
}
