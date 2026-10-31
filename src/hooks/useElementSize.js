import { useEffect, useRef, useState } from 'react';

// Width and height in CSS pixels of the element behind `ref`, kept up to
// date as it resizes (charts are drawn at their real size so fonts don't scale).
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
