import { readFileSync } from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function src(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('P0 tab empty recovery', () => {
  it('does not treat listing HTTP failures as a successful empty page', () => {
    const listings = src('services/listings.ts');
    expect(listings).toContain("throw new Error('listings_fetch_failed')");
    expect(listings).not.toContain('if (!res.ok) return empty');
    expect(listings).toContain('json.data.listings.map(mapListing)');
  });

  it('keeps market rows on fetch failure and retries empty tabs on later focus', () => {
    const market = src('app/(tabs)/market.tsx');
    expect(market).toContain('setLoadFailed(true)');
    expect(market).toContain('Keep the last good page');
    expect(market).toContain('if (hasItemsRef.current || loadingRef.current) return');
    expect(market).toContain('void loadFirstPage()');
    expect(market).toContain('loading || (loadFailed && items.length === 0)');
    expect(market).not.toContain('setItems([])');
  });

  it('does not count a skipped posts generation as a completed React apply', () => {
    const ctx = src('contexts/AppContext.tsx');
    expect(ctx).toContain('const applied = applyPostsFeed(inflightKey, fetchedPosts, applyGen)');
    expect(ctx).toContain('succeeded = applied');
    expect(ctx).toContain('hydratePostsFeed');
    expect(ctx).toContain('if (!gen.isCurrent(token)) return false');
    expect(ctx).toContain('postsApplyGenerationByFeed');
    expect(ctx).toContain('postsCacheByFeed.set(feed, fetchedPosts)');
    expect(ctx).toContain('if (!succeeded && activePostsFeed == null)');
    expect(ctx).not.toContain('setPosts([])');
  });

  it('force-refetches the community tab on later focus when the list is empty', () => {
    const posts = src('app/(tabs)/posts.tsx');
    expect(posts).toContain('useFocusEffect');
    expect(posts).toContain('if (postsLenRef.current > 0 || loadingFeedRef.current) return');
    expect(posts).toContain("void loadFeed(feedTab, { force: true })");
    expect(posts).toContain('force: Boolean(opts?.refresh || opts?.force)');
  });

  it('recovers Home latest listings after a failed empty fetch without looping', () => {
    const home = src('components/feature/HomeLatestListings.tsx');
    expect(home).toContain('needsFailureRecoveryRef');
    expect(home).toContain('if (inflightRef.current) return');
    expect(home).toContain('getBootstrappedListingsPage');
    expect(home).toContain('searchListingsPage');
  });

  it('does not treat butcher HTTP failures as a successful empty directory', () => {
    const directory = src('services/butcherDirectory.ts');
    expect(directory).toContain("throw new Error('butchers_fetch_failed')");
    expect(directory).toContain('BUTCHERS_HOME_TTL_MS');
    expect(directory).toContain('homeLoadInflight');
    expect(directory).toContain('records: ratingRecords');
    expect(src('services/butcherOffersPreview.ts')).toContain('butcherRecordsHaveEmbeddedOffers');
    const home = src('app/butchers/index.tsx');
    expect(home).not.toContain('if (!res.ok) return []');
    expect(home).toContain('loadButchersHome');
    expect(home).toContain('loading || (loadFailed && picks.length === 0)');
    expect(home).not.toContain('userCoords, fetchSorted');
    const all = src('app/butchers/all.tsx');
    expect(all).toContain('fetchSortedButchers');
    expect(all).toContain('loading || (loadFailed && butchers.length === 0)');
    expect(all).not.toContain('setButchers([])');
  });

  it('does not treat user post HTTP failures as an empty profile feed', () => {
    const posts = src('services/posts.ts');
    expect(posts).toContain("throw new Error('user_posts_fetch_failed')");
    expect(posts).not.toContain('if (!res.ok) return []');
    expect(src('app/users/[id].tsx')).toContain('Promise.allSettled');
    expect(src('app/users/[id].tsx')).toContain('postsLoadFailed');
    expect(src('app/ministry/index.tsx')).toContain('setPostsLoadFailed(true)');
  });

  it('keeps listing and butcher detail cache on non-404 fetch failure', () => {
    expect(src('app/listing/[id].tsx')).toContain('if (failed && !listingRef.current) return');
    expect(src('app/listing/[id].tsx')).toContain('if (res.status !== 404) failed = true');
    expect(src('app/butchers/[id].tsx')).toContain('if (failed && !have) return');
    expect(src('app/butchers/[id].tsx')).toContain('cancelled = true');
  });

  it('does not treat browse HTTP failures as a successful empty category', () => {
    const browse = src('app/market/browse.tsx');
    expect(browse).toContain('setLoadFailed(true)');
    expect(browse).toContain('(loading || loadFailed) && items.length === 0');
  });

  it('force-refetches the community tab on later focus when the list is empty', () => {
    const posts = src('app/(tabs)/posts.tsx');
    expect(posts).toContain('useFocusEffect');
    expect(posts).toContain('if (postsLenRef.current > 0 || loadingFeedRef.current) return');
    expect(posts).toContain("void loadFeed(feedTab, { force: true })");
    expect(posts).toContain('force: Boolean(opts?.refresh || opts?.force)');
  });

  it('does not clear message threads on a fetch_failed HTTP error', () => {
    const hook = src('hooks/useMessageThreads.ts');
    expect(hook).toContain("if (code === 'unauthorized')");
    expect(hook).not.toContain("if (code === 'unauthorized' || !hasDataRef.current)");
    expect(src('components/feature/MessagesPanel.tsx')).toContain(
      "error === 'fetch_failed' && threads.length === 0",
    );
    expect(src('components/feature/MessagesPanel.tsx')).toContain(
      'const forceEmpty = threadsLenRef.current === 0 && !loadingRef.current',
    );
  });
});
