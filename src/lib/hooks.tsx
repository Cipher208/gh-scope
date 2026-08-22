import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { prefersReducedMotion } from './github';

const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&';

/** Эффект «расшифровки»: строка набирается из случайных глифов. */
export function useScramble(text: string): string {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (prefersReducedMotion() || !text) {
      setOut(text);
      return;
    }
    let frame = 0;
    let raf = 0;
    const totalFrames = Math.min(16 + text.length * 2, 64);
    const tick = () => {
      frame += 1;
      const settled = Math.floor((frame / totalFrames) * text.length);
      if (settled >= text.length) {
        setOut(text);
        return;
      }
      let s = '';
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        s += i < settled || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setOut(s);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  return out;
}

/** Плавный набег числа от 0 до target. */
export function useCountUp(target: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return value;
}

/** Обёртка появления при скролле (IntersectionObserver). */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('is-visible');
            io.disconnect();
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties = delay ? { transitionDelay: `${delay}ms` } : {};

  return (
    <div ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </div>
  );
}
