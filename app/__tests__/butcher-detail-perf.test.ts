import { readFileSync } from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('P1-2 butcher detail cold/repeat loading', () => {
  const store = src('app/butchers/[id].tsx');
  const directory = src('services/butcherDirectory.ts');

  it('seeds detail from a TTL-fresh directory snapshot instead of a blank loading screen', () => {
    expect(store).toContain("from '@/services/butcherDirectory'");
    expect(store).toContain('findCachedButcher');
    expect(store).toContain('getCachedButcherDetail');
    expect(store).toContain('applyDirectorySeed');
    expect(store).toContain('if (id !== hydratedId)');
    expect(store).toContain('setLoading(next.loading)');
    expect(store).toContain('if (!butcherRef.current || butcherRef.current.id !== id) setLoading(true)');
    expect(store).toContain('if (loading && (!butcher || butcher.id !== id))');
    expect(directory).toContain('export function findCachedButcher');
    expect(directory).toContain('now - homeSnapshot.fetchedAt < BUTCHERS_HOME_TTL_MS');
    expect(directory).toContain('now - entry.fetchedAt >= BUTCHERS_HOME_TTL_MS');
    expect(directory).toContain('homeLoadInflight');
    expect(directory).toContain('BUTCHERS_HOME_TTL_MS = 60_000');
  });

  it('does not refetch reviews when GET /api/butchers/:id already included them', () => {
    expect(directory).toContain('hasUsableEmbeddedReviews');
    expect(directory).toContain('loadReviewsIfNeeded');
    expect(directory).toContain('`${API_BASE}/api/butchers/${id}/reviews`');
    expect(store).toContain("method: 'POST'");
    expect(store).not.toContain('void fetchReviews();');
    expect(store).not.toContain('void fetchReviewsIfNeeded()');
  });

  it('loads stories in the background so they cannot keep butcher details behind a spinner', () => {
    expect(directory).toContain("`${API_BASE}/api/butchers/stories`");
    expect(store).toContain('fetchButcherStories');
    expect(store).toContain('Stories are optional and must not block butcher details.');
    expect(directory).toContain('Stories are optional and must not block butcher details.');
    expect(store).not.toContain('const [res, resS] = await Promise.all([');
    expect(store).not.toContain("fetch(`${API_BASE}/api/butchers/stories`),");
  });

  it('ignores cancelled and cross-butcher responses instead of overwriting the visible butcher', () => {
    expect(store).toContain('cancelled = true');
    expect(store).toContain('if (cancelled) return');
    expect(directory).toContain('if (b.id && String(b.id) !== String(id)) return null');
    expect(store).toContain('String(snapshot.profile.id) === String(id)');
    expect(store).toContain('if (failed && !have) return');
    expect(store).toContain('const have = butcherRef.current && butcherRef.current.id === id');
  });
});
