import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import { listApplications } from '@/services/butcherApplications';
import type { ApplicationSummary } from '@/services/butcherApplicationTypes';

const ME_TTL_MS = 60_000;
const APPS_TTL_MS = 60_000;
const FOCUS_REFRESH_MS = 30_000;

type ButcherOwnerContextValue = {
  loading: boolean;
  applications: ApplicationSummary[];
  approvedApplication: ApplicationSummary | null;
  hasApprovedApplication: boolean;
  hasAnyApplication: boolean;
  hasPendingApplication: boolean;
  provisionedButcherId: string | null;
  isButcherOwner: boolean;
  refresh: () => Promise<void>;
};

const ButcherOwnerContext = createContext<ButcherOwnerContextValue | null>(null);

let butcherMeInflight: Promise<string | null> | null = null;
let applicationsInflight: Promise<ApplicationSummary[]> | null = null;

async function fetchButcherMeDeduped(accessToken: string): Promise<string | null> {
  if (butcherMeInflight) return butcherMeInflight;

  butcherMeInflight = (async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/butchers/me`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data?.id) {
        return String(json.data.id);
      }
      return null;
    } catch {
      return null;
    } finally {
      butcherMeInflight = null;
    }
  })();

  return butcherMeInflight;
}

async function fetchApplicationsDeduped(): Promise<ApplicationSummary[]> {
  if (applicationsInflight) return applicationsInflight;

  applicationsInflight = (async () => {
    try {
      const result = await listApplications({ limit: 10 });
      return result.applications;
    } catch {
      return [];
    } finally {
      applicationsInflight = null;
    }
  })();

  return applicationsInflight;
}

export function ButcherOwnerProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [butcherIdFromMe, setButcherIdFromMe] = useState<string | null>(null);

  const meCacheRef = useRef<{ token: string; id: string | null; at: number } | null>(null);
  const appsCacheRef = useRef<{ token: string; apps: ApplicationSummary[]; at: number } | null>(
    null,
  );
  const loadInflightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);

  const load = useCallback(
    async (force = false) => {
      if (!isAuthenticated || !accessToken) {
        setApplications([]);
        setButcherIdFromMe(null);
        meCacheRef.current = null;
        appsCacheRef.current = null;
        setLoading(false);
        return;
      }

      const now = Date.now();
      const meCache = meCacheRef.current;
      const appsCache = appsCacheRef.current;
      const meFresh =
        !force &&
        meCache &&
        meCache.token === accessToken &&
        now - meCache.at < ME_TTL_MS;
      const appsFresh =
        !force &&
        appsCache &&
        appsCache.token === accessToken &&
        now - appsCache.at < APPS_TTL_MS;

      if (meFresh && appsFresh) {
        setApplications(appsCache.apps);
        setButcherIdFromMe(meCache.id);
        setLoading(false);
        return;
      }

      if (loadInflightRef.current && !force) {
        await loadInflightRef.current;
        return;
      }

      const run = async () => {
        setLoading(true);
        try {
          let apps = appsCache?.apps ?? [];
          if (!appsFresh) {
            apps = await fetchApplicationsDeduped();
            appsCacheRef.current = { token: accessToken, apps, at: Date.now() };
          }
          setApplications(apps);

          const approved = apps.find((a) => a.status === 'APPROVED');
          const shouldFetchMe = user?.role === 'BUTCHER' || approved != null;

          let meId: string | null = meFresh ? meCache?.id ?? null : null;
          if (shouldFetchMe) {
            if (!meFresh) {
              meId = await fetchButcherMeDeduped(accessToken);
            }
            meCacheRef.current = { token: accessToken, id: meId, at: Date.now() };
          } else {
            meId = null;
            meCacheRef.current = { token: accessToken, id: null, at: Date.now() };
          }
          setButcherIdFromMe(meId);
        } finally {
          setLoading(false);
        }
      };

      const promise = run().finally(() => {
        if (loadInflightRef.current === promise) {
          loadInflightRef.current = null;
        }
      });
      loadInflightRef.current = promise;
      await promise;
    },
    [isAuthenticated, accessToken, user?.role],
  );

  useEffect(() => {
    lastRefreshAtRef.current = 0;
    if (!isAuthenticated) {
      butcherMeInflight = null;
      applicationsInflight = null;
    }
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load tracks auth/token/role internally
  }, [isAuthenticated, accessToken, user?.role]);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < FOCUS_REFRESH_MS) return;
    lastRefreshAtRef.current = now;
    await load(true);
  }, [load]);

  const approvedApplication =
    applications.find((application) => application.status === 'APPROVED') ?? null;

  const provisionedButcherId =
    approvedApplication?.provisionedButcherId ?? butcherIdFromMe;

  const value = useMemo<ButcherOwnerContextValue>(
    () => ({
      loading,
      applications,
      approvedApplication,
      hasApprovedApplication: approvedApplication !== null,
      hasAnyApplication: applications.length > 0,
      hasPendingApplication: applications.some(
        (application) =>
          application.status === 'DRAFT' || application.status === 'SUBMITTED',
      ),
      provisionedButcherId,
      isButcherOwner:
        approvedApplication !== null ||
        user?.role === 'BUTCHER' ||
        butcherIdFromMe !== null,
      refresh,
    }),
    [
      loading,
      applications,
      approvedApplication,
      provisionedButcherId,
      butcherIdFromMe,
      user?.role,
      refresh,
    ],
  );

  return (
    <ButcherOwnerContext.Provider value={value}>{children}</ButcherOwnerContext.Provider>
  );
}

export function useButcherOwnerContext(): ButcherOwnerContextValue {
  const ctx = useContext(ButcherOwnerContext);
  if (!ctx) {
    throw new Error('useButcherOwnerContext must be used within ButcherOwnerProvider');
  }
  return ctx;
}
