import { useCommunityPresence } from '../hooks/useCommunityPresence';

// Inline type to avoid Vite isolatedModules issue with TS interface exports
type RankingEntry = { position: number; name: string; points: number; isUser: boolean; tier: 'gold' | 'silver' | 'bronze' | 'default' };

const TIER_MEDALS: Record<string, string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
  default: '',
};

const TIER_COLORS: Record<string, string> = {
  gold: '#FFDF73',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  default: 'var(--text-secondary)',
};

function RankRow({ entry, userPoints }: { entry: RankingEntry; userPoints: number }) {
  const isUser = entry.isUser;
  const medal = TIER_MEDALS[entry.tier] || `${entry.position}️⃣`;
  const nameColor = TIER_COLORS[entry.tier];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        background: isUser
          ? 'var(--input-bg)'
          : 'transparent',
        border: isUser ? '1px solid var(--border-gold)' : '1px solid transparent',
        marginBottom: 4,
        transition: 'all 0.25s ease',
        position: 'relative',
      }}
    >
      {/* Medal / Position */}
      <div
        style={{
          width: 28,
          textAlign: 'center',
          fontSize: entry.tier !== 'default' ? 18 : 12,
          fontWeight: 900,
          color: nameColor,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {medal || `${entry.position}º`}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: isUser ? 900 : 700,
            color: 'var(--text-primary)',
            letterSpacing: isUser ? '-0.2px' : 0,
          }}
        >
          {entry.name}
          {isUser && (
            <span
              style={{
                marginLeft: 6,
                fontSize: '9px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--text-muted)',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-primary)',
                borderRadius: 99,
                padding: '1px 6px',
              }}
            >
              você
            </span>
          )}
        </div>
        {/* Points bar behind the name for non-top positions */}
        {!isUser && entry.tier === 'default' && (
          <div
            style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              marginTop: 1,
            }}
          >
            {(entry.points - userPoints).toLocaleString('pt-BR')} pts à frente
          </div>
        )}
      </div>

      {/* Points */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 900,
          color: isUser ? 'var(--text-primary)' : nameColor,
          letterSpacing: '-0.3px',
          flexShrink: 0,
        }}
      >
        {entry.points.toLocaleString('pt-BR')}
        <span
          style={{
            fontSize: '9px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginLeft: 3,
          }}
        >
          pts
        </span>
      </div>
    </div>
  );
}

interface SeasonRankingProps {
  userPoints: number;
}

export function SeasonRanking({ userPoints }: SeasonRankingProps) {
  const { getRanking, season } = useCommunityPresence();
  const ranking = getRanking(userPoints);

  const seasonProgress = Math.round((season.daysElapsed / season.daysTotal) * 100);

  return (
    <div
      style={{
        background: 'var(--card-gradient)',
        border: '1px solid var(--border-gold)',
        borderRadius: 14,
        padding: '16px 14px',
        marginBottom: 20,
      }}
    >
      {/* Season header */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 6,
          }}
        >
          <div>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: 'var(--text-muted)',
              }}
            >
              🏆 Ranking da Temporada
            </span>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 900,
                color: 'var(--text-primary)',
                marginTop: 2,
                letterSpacing: '-0.2px',
              }}
            >
              {season.name}
            </div>
          </div>

          <div
            style={{
              textAlign: 'right',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Termina em {season.endDateLabel}
            </span>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: season.daysRemaining <= 5 ? '#f87171' : 'var(--text-secondary)',
                marginTop: 1,
              }}
            >
              {season.daysRemaining} dias restantes
            </div>
          </div>
        </div>

        {/* Season progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: 99,
            background: 'var(--border-primary)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${seasonProgress}%`,
              background: 'linear-gradient(90deg, #D4AF37, #FFDF73)',
              borderRadius: 99,
            }}
          />
        </div>
        <div
          style={{
            fontSize: '9px',
            color: 'var(--text-muted)',
            marginTop: 3,
            textAlign: 'right',
          }}
        >
          Dia {season.daysElapsed} de {season.daysTotal}
        </div>
      </div>

      {/* Separator between top 4 and user */}
      <div>
        {ranking.slice(0, 4).map(entry => (
          <RankRow key={entry.position} entry={entry} userPoints={userPoints} />
        ))}
        <div
          style={{
            borderTop: '1px dashed var(--border-primary)',
            margin: '6px 0',
          }}
        />
        {ranking.slice(4).map(entry => (
          <RankRow key={entry.position} entry={entry} userPoints={userPoints} />
        ))}
      </div>

      {/* Footer note */}
      <div
        style={{
          marginTop: 10,
          padding: '8px 10px',
          background: 'var(--input-bg)',
          borderRadius: 8,
          fontSize: '10px',
          color: 'var(--text-muted)',
          lineHeight: 1.4,
          textAlign: 'center',
        }}
      >
        Pontos são zerados ao fim da temporada · Conquistas são mantidas para sempre
      </div>
    </div>
  );
}
