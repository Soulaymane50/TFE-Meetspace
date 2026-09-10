import { useCallback, useEffect, useState } from "react";

export function usePublicCatalog(load) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    load()
      .then((items) => {
        if (!Array.isArray(items)) throw new Error("INVALID_CATALOG_RESPONSE");
        if (active) setData(items);
      })
      .catch((failure) => { if (active) setError(failure); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);
  return { data, loading, error, retry };
}
