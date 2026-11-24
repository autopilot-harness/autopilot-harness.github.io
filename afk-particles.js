// A projected ribbon of points occupies the space between the title and task count.
(() => {
  const canvas = document.querySelector('.afk-particles');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const palette = ['100,77,155', '51,119,123', '86,100,159'];
  const points = [];
  const tau = Math.PI * 2;
  for (let i = 0; i < 64; i++) {
    const along = tau * i / 64;
    for (let j = 0; j < 8; j++) {
      const around = tau * j / 8 + along * 1.5;
      const radius = .72 + .20 * Math.cos(around);
      points.push({
        x: radius * Math.cos(along),
        y: .21 * Math.sin(2 * along + .5) + .18 * Math.sin(around),
        z: radius * Math.sin(along),
        color: palette[Math.floor(i * palette.length / 64)]
      });
    }
  }

  let width = 0, height = 0, elapsed = 0;
  let frame = 0, last = null, visible = false;
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const angle = -.58 + elapsed * .11;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const tilt = .38 + .09 * Math.sin(elapsed * .18);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const projected = points.map(p => {
      const side = p.x * cos - p.z * sin;
      const depth = p.x * sin + p.z * cos;
      const z = depth * ct - p.y * st;
      const perspective = 3 / (3 - z);
      return {
        x: width * (.49 + side * perspective * .44),
        y: height * (.5 + ((p.y * ct + depth * st) * .68 - side * .09) * perspective),
        z, color: p.color
      };
    }).sort((a,b) => a.z - b.z);
    const size = Math.min(1, height / 70);
    for (const p of projected) {
      const near = Math.max(0,Math.min(1,(p.z + 1) / 2));
      ctx.fillStyle = 'rgba(' + p.color + ',' + (.17 + near * .67) + ')';
      ctx.beginPath();
      ctx.arc(p.x,p.y, (.62 + near * 1.06) * size, 0, tau);
      ctx.fill();
    }
  }
  function tick(now) {
    if (last === null || now - last >= 1000 / 24) {
      if (last !== null) elapsed += Math.min(100, now - last) / 1000;
      last = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = null;
    draw();
    if (visible && !motion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio,2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(canvas);
  motion.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
})();
