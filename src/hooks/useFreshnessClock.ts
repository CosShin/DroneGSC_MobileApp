import React from 'react';

/** Makes stale telemetry expire even when its MAVLink message stops arriving. */
export function useFreshnessClock(intervalMs = 1_000) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
