import { useNavigate } from 'react-router-dom';
import { useCommunityPresence } from '../hooks/useCommunityPresence';

// ─── IC dot bar ───────────────────────────────────────────────
function ICDots({ value }: { value: number }) {
  const total = 10;
  const filled = Math.round((value / 100) * total);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: i < filled ? 6 : 5,
            height: i < filled ? 6 : 5,
            borderRadius: '50%',
            background: i < filled
              ? `hsl(${100 + (value / 100) * 40}, 80%, 60%)`
              : 'rgba(255,255,255,0.12)',
            transition: 'all 0.5s ease',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

export function CondoBuildingActivity() {
  const { stats, season } = useCommunityPresence();
  const navigate = useNavigate();

  const progressBarColor = stats.progressPct >= 80
    ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
    : stats.progressPct >= 50
      ? 'linear-gradient(90deg, #facc15, #4ade80)'
      : 'linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.6))';

  return (
    <div
      onClick={() => navigate('/clube')}
      style={{
        margin: '8px 0 12px',
        padding: '13px 14px',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      role="button"
      aria-label="Ver atividade do condomínio"
    >
      {/* Subtle ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -20,
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top row: condo name + IC */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: 2,
            }}
          >
            Condomínio Solar
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.2,
            }}
          >
            {stats.icLabel}
          </div>
        </div>

        {/* IC Badge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 3,
          }}
        >
          <span
            style={{
              fontSize: '9px',
              fontWeight: 800,
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Índice de Comunidade
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1,
              }}
            >
              {stats.ic}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>/100</span>
            </span>
            <ICDots value={stats.ic} />
          </div>
        </div>
      </div>

      {/* Progress bar: daily goal */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            Meta diária: {stats.goalOrders} pedidos
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 800 }}>
            {stats.progressPct}%
          </span>
        </div>
        <div
          style={{
            height: 5,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${stats.progressPct}%`,
              background: progressBarColor,
              borderRadius: 99,
              transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
        }}
      >
        <StatChip emoji="🛒" label="pedidos" value={stats.orders} />
        <StatChip emoji="✅" label="check-ins" value={stats.checkins} />
        <StatChip emoji="🎯" label="missões" value={stats.missionsDone} />
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.3)',
            alignSelf: 'flex-end',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
          }}
        >
          {season.name} →
        </div>
      </div>
    </div>
  );
}

function StatChip({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 12 }}>{emoji}</span>
      <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>{value}</span>
      <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
        {label}
      </span>
    </div>
  );
}
