import React from 'react';

export const HomeFullPageSkeleton: React.FC = () => {
  return (
    <div className="home-full-skeleton" style={{ width: '100%', overflowX: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div className="app" style={{ position: 'relative', zIndex: 1, paddingBottom: 6 }}>
          {/* Top Banner Skeleton */}
          <div
            style={{
              height: 38,
              borderRadius: 10,
              background: 'var(--skeleton-base, rgba(255,255,255,0.04))',
              marginBottom: 10,
              animation: 'skeletonPulse 1.6s ease-in-out infinite',
            }}
          />

          {/* Hero Banner Skeleton */}
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              maxHeight: 240,
              borderRadius: 16,
              background: 'var(--skeleton-shimmer-gradient, linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%))',
              backgroundSize: '200% 100%',
              animation: 'skeletonPulse 1.8s ease-in-out infinite',
              marginBottom: 16,
            }}
          />

          {/* Quick Categories Skeleton */}
          <div style={{ display: 'flex', gap: 12, overflowX: 'hidden', padding: '4px 0 16px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  width: 58,
                }}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    background: 'var(--skeleton-base, rgba(255,255,255,0.04))',
                    animation: 'skeletonPulse 1.6s ease-in-out infinite',
                  }}
                />
                <div
                  style={{
                    width: 42,
                    height: 8,
                    borderRadius: 4,
                    background: 'var(--skeleton-base, rgba(255,255,255,0.04))',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Search Bar Skeleton */}
          <div
            style={{
              height: 44,
              borderRadius: 12,
              background: 'var(--skeleton-base, rgba(255,255,255,0.04))',
              marginBottom: 18,
            }}
          />
        </div>
      </div>

      <main className="app" style={{ paddingTop: 0 }}>
        {/* Showcase Sections Skeletons */}
        {Array.from({ length: 2 }).map((_, sIdx) => (
          <section key={sIdx} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    width: 140,
                    height: 16,
                    borderRadius: 4,
                    background: 'var(--skeleton-base, rgba(255,255,255,0.06))',
                    animation: 'skeletonPulse 1.6s ease-in-out infinite',
                  }}
                />
                <div
                  style={{
                    width: 90,
                    height: 10,
                    borderRadius: 4,
                    background: 'var(--skeleton-base, rgba(255,255,255,0.03))',
                  }}
                />
              </div>
              <div
                style={{
                  width: 50,
                  height: 12,
                  borderRadius: 4,
                  background: 'var(--skeleton-base, rgba(255,255,255,0.03))',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, overflowX: 'hidden' }}>
              {Array.from({ length: 3 }).map((_, cIdx) => (
                <div
                  key={cIdx}
                  style={{
                    flex: '0 0 145px',
                    borderRadius: 12,
                    border: '1px solid var(--border-primary, rgba(255,255,255,0.06))',
                    background: 'var(--card-bg, rgba(255,255,255,0.02))',
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 8,
                      background: 'var(--skeleton-base, rgba(255,255,255,0.04))',
                      animation: 'skeletonPulse 1.6s ease-in-out infinite',
                    }}
                  />
                  <div
                    style={{
                      width: '85%',
                      height: 12,
                      borderRadius: 4,
                      background: 'var(--skeleton-base, rgba(255,255,255,0.04))',
                    }}
                  />
                  <div
                    style={{
                      width: '50%',
                      height: 14,
                      borderRadius: 4,
                      background: 'var(--skeleton-base, rgba(255,255,255,0.05))',
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

export default HomeFullPageSkeleton;

