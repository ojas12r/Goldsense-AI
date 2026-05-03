import { useEffect } from 'react';

export default function Cursor() {
  useEffect(() => {
    const dot  = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    let rx = 0, ry = 0; // ring position (lagged)
    let mx = 0, my = 0; // mouse position

    const onMove = e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    };

    // Smooth ring follows with lag
    let raf;
    const lerp = (a, b, t) => a + (b - a) * t;
    const loop = () => {
      rix = lerp(rix, mx, 0.14);
      riy = lerp(riy, my, 0.14);
      ring.style.transform = `translate(${rix}px, ${riy}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    let rix = 0, riy = 0;
    raf = requestAnimationFrame(loop);

    // Hover effect on interactive elements
    const onEnter = () => document.body.classList.add('cursor-hover');
    const onLeave = () => document.body.classList.remove('cursor-hover');
    const targets = 'a, button, [data-hover]';
    document.querySelectorAll(targets).forEach(el => {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div id="cursor-dot"  />
      <div id="cursor-ring" />
    </>
  );
}
