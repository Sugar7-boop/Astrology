// Asteroid Dodger — pure JS canvas mini-game
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;    // 360
  const H = canvas.height;   // 600

  // UI Elements
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const titleEl = document.getElementById('title');
  const subtitleEl = document.getElementById('subtitle');
  const startBtn = document.getElementById('startBtn');

  // Game state
  let running = false;
  let paused = false;
  let gameOver = false;

  let score = 0;
  let lives = 3;
  let time = 0;

  // Player
  const player = {
    x: W / 2,
    y: H - 60,
    r: 12,
    speed: 220,
    targetX: null,
  };

  // Entities
  const asteroids = [];
  const stars = [];

  // Spawn control
  let asteroidInterval = 0.9; // seconds
  let starInterval = 1.6;     // seconds
  let asteroidTimer = 0;
  let starTimer = 0;

  // Input
  const keys = { left: false, right: false };

  // Utility
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;

  function reset() {
    running = true; paused = false; gameOver = false;
    score = 0; lives = 3; time = 0;
    player.x = W / 2; player.targetX = null;
    asteroids.length = 0; stars.length = 0;
    asteroidInterval = 0.9;
    starInterval = 1.6;
    asteroidTimer = 0; starTimer = 0;

    overlay.style.display = 'none';
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = Math.floor(score);
    livesEl.textContent = lives;
  }

  function spawnAsteroid() {
    asteroids.push({
      x: rand(16, W - 16),
      y: -20,
      r: rand(10, 18),
      vy: rand(90, 140) + time * 3, // speeds up slowly
      rot: rand(0, Math.PI * 2),
      vr: rand(-2, 2),
    });
  }

  function spawnStar() {
    stars.push({
      x: rand(12, W - 12),
      y: -16,
      r: 7,
      vy: rand(75, 110) + time * 2,
      glow: rand(0.6, 1),
    });
  }

  function circleHit(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    const r = a.r + b.r;
    return dx*dx + dy*dy <= r*r;
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    // Ship body
    ctx.shadowColor = 'rgba(105,224,255,0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -player.r);
    ctx.lineTo(player.r, player.r);
    ctx.lineTo(0, player.r * 0.5);
    ctx.lineTo(-player.r, player.r);
    ctx.closePath();
    ctx.fillStyle = '#69e0ff';
    ctx.fill();
    // Cockpit
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0b2230';
    ctx.fill();
    // Thruster flame
    ctx.beginPath();
    ctx.moveTo(0, player.r * 0.6);
    ctx.quadraticCurveTo(0, player.r + rand(6,12), rand(-3,3), player.r + 18);
    ctx.strokeStyle = 'rgba(255,207,89,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    const r = a.r;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rr = r * (0.8 + Math.random() * 0.4);
      const px = Math.cos(angle) * rr;
      const py = Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const grd = ctx.createRadialGradient(0,0, r*0.2, 0,0, r);
    grd.addColorStop(0, '#2b2f3a');
    grd.addColorStop(1, '#1a1f2a');
    ctx.fillStyle = grd;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }

  function drawStar(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.shadowColor = 'rgba(255,207,89,0.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const outer = s.r, inner = s.r * 0.45;
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineTo(Math.cos(angle + Math.PI / 5) * inner, Math.sin(angle + Math.PI / 5) * inner);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(255,207,89,${s.glow})`;
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(dt) {
    // subtle starfield
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#0c1328';
    for (let i = 0; i < 18; i++) {
      const y = (time * 20 + i * 40) % H;
      ctx.fillRect((i * 19) % W, y, 2, 2);
    }
    ctx.restore();
  }

  function update(dt) {
    if (!running || paused || gameOver) return;
    time += dt;

    // Gradually increase difficulty
    asteroidInterval = Math.max(0.38, 0.9 - time * 0.015);
    starInterval = Math.max(0.9, 1.6 - time * 0.01);

    // Input -> movement
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;

    if (player.targetX != null) {
      const delta = player.targetX - player.x;
      dir = Math.sign(delta);
      // soft snap when close
      if (Math.abs(delta) < 4) {
        player.x = player.targetX;
        player.targetX = null;
      }
    }

    player.x += dir * player.speed * dt;
    player.x = clamp(player.x, 16, W - 16);

    // Spawns
    asteroidTimer += dt;
    if (asteroidTimer >= asteroidInterval) {
      asteroidTimer = 0;
      spawnAsteroid();
    }
    starTimer += dt;
    if (starTimer >= starInterval) {
      starTimer = 0;
      spawnStar();
    }

    // Update entities
    for (const a of asteroids) {
      a.y += a.vy * dt;
      a.rot += a.vr * dt;
    }
    for (const s of stars) {
      s.y += s.vy * dt;
    }

    // Collisions & cleanup
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      if (a.y - a.r > H + 20) { asteroids.splice(i, 1); continue; }
      if (circleHit({x: player.x, y: player.y, r: player.r * 0.9}, a)) {
        asteroids.splice(i, 1);
        lives -= 1;
        flash('#ff6b6b');
        if (lives <= 0) return endGame();
        updateHUD();
      }
    }

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      if (s.y - s.r > H + 20) { stars.splice(i, 1); continue; }
      if (circleHit({x: player.x, y: player.y, r: player.r * 0.9}, s)) {
        stars.splice(i, 1);
        score += 25;
        flash('#ffcf59');
        updateHUD();
      }
    }

    // Score over time
    score += dt * 5;
    updateHUD();
  }

  let flashColor = null;
  let flashT = 0;
  function flash(color) {
    flashColor = color;
    flashT = 0.18;
  }

  function render(dt) {
    ctx.clearRect(0, 0, W, H);
    drawBackground(dt);

    // Entities
    for (const s of stars) drawStar(s);
    for (const a of asteroids) drawAsteroid(a);
    drawPlayer();

    // Screen flash
    if (flashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, flashT / 0.18) * 0.36;
      ctx.fillStyle = flashColor || '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      flashT -= dt;
    }

    // Paused overlay hint
    if (paused && running) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e9eef7';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused — press P to resume', W/2, H/2);
      ctx.restore();
    }

    if (gameOver) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e9eef7';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', W/2, H/2 - 12);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Press Enter to restart', W/2, H/2 + 12);
      ctx.restore();
    }
  }

  function endGame() {
    running = false; gameOver = true;
    overlay.style.display = '';
    titleEl.textContent = 'Game Over';
    subtitleEl.textContent = `Final Score: ${Math.floor(score)} — Press Enter or click Start`;
    startBtn.textContent = 'Restart';
  }

  // Main loop
  let last = 0;
  function frame(t) {
    const now = t / 1000;
    const dt = Math.min(0.033, now - last || 0.016);
    last = now;
    update(dt);
    render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Input listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'p' || e.key === 'P') {
      if (running && !gameOver) paused = !paused;
    }
    if ((e.key === 'Enter' || e.key === ' ') && (gameOver || !running)) {
      reset();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  // Touch -> move to pointer X (mobile)
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const targetX = (e.clientX - rect.left) * scaleX;
    player.targetX = clamp(targetX, 16, W - 16);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pressure === 0) return; // only when touching/dragging
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const targetX = (e.clientX - rect.left) * scaleX;
    player.targetX = clamp(targetX, 16, W - 16);
  });
  canvas.addEventListener('pointerup', () => {
    player.targetX = null;
  });

  // Start button
  startBtn.addEventListener('click', () => {
    reset();
  });

  // Initial overlay text
  titleEl.textContent = 'Asteroid Dodger';
  subtitleEl.textContent = 'Move with ← → or A/D. On mobile, tap to move. Press P to pause.';
  startBtn.textContent = 'Start';
})();
