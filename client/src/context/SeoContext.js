import React, { createContext, useContext, useEffect, useState } from 'react';

const SeoContext = createContext({ pages: {}, globalEnabled: true });

export const useSeo = () => useContext(SeoContext);

export const SeoProvider = ({ children }) => {
  const [pages, setPages] = useState({});     // keyed by path
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <SeoContext.Provider value={{ pages, globalEnabled, loaded }}>
      {children}
    </SeoContext.Provider>
  );
};

export default SeoContext;
