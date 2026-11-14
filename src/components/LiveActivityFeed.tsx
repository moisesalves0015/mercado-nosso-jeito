import { useState, useEffect, useRef } from 'react';
import { useCommunityPresence } from '../hooks/useCommunityPresence';

// Inline type to avoid Vite isolatedModules import issues with .ts files
type LiveActivity = { id: string; emoji: string; text: string };

function ActivityRow({ activity, isNew }: { activity: LiveActivity; isNew: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 0',
        borderBottom: '1px solid var(--border-subtle)',
        animation: isNew ? 'liveSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        opacity: isNew ? undefined : 0.75,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{activity.emoji}</span>
      <span
        style={{
          fontSize: '11.5px',
          fontWeight: isNew ? 700 : 500,
          color: isNew ? 'var(--text-primary)' : 'var(--text-secondary)',
          lineHeight: 1.3,
        }}
      >
        {activity.text}
      </span>
    </div>
  );
}

export function LiveActivityFeed() {
  const { liveActivities } = useCommunityPresence();
  const prevRef = useRef<string[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prevIds = new Set(prevRef.current);
    const freshIds = liveActivities
      .map(a => a.id)
      .filter(id => !prevIds.has(id));
    setNewIds(new Set(freshIds));
    prevRef.current = liveActivities.map(a => a.id);

    if (freshIds.length > 0) {
      const t = setTimeout(() => setNewIds(new Set()), 2000);
      return () => clearTimeout(t);
    }
  }, [liveActivities]);

  return (
    <div
      style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: '12px',
        boxShadow: 'var(--card-shadow)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '12px 14px',
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 7px rgba(16,185,129,0.7)',
            animation: 'spLivePulse 1.8s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '10px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: 'var(--text-muted)',
          }}
        >
          Agora mesmo
        </span>
      </div>

      {/* Feed rows */}
      <div>
        {liveActivities.map((activity, i) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            isNew={i === 0 && newIds.has(activity.id)}
          />
        ))}
      </div>
    </div>
  );
}
