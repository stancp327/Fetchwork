import React, { createContext, useContext, useEffect, useState } from 'react';

const SeoContext = createContext({ pages: {}, globalEnabled: true });

export const useSeo = () => useContext(SeoContext);

export const SeoProvider = ({ children }) => {
  const [pages, setPages] = useState({});     // keyed by path
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadSeoPages = () => {
      fetch('/api/seo/pages')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.pages) return;
          const map = {};
          data.pages.forEach(p => { map[p.path] = p; });
          setGlobalEnabled(map['__global__']?.enabled !== false);
          setPages(map);
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(loadSeoPages, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const t = setTimeout(loadSeoPages, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <SeoContext.Provider value={{ pages, globalEnabled, loaded }}>
      {children}
    </SeoContext.Provider>
  );
};

export default SeoContext;
