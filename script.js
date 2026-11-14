(() => {
    const $ = (s) => document.querySelector(s);
    const canvas = $("#game");
    const ctx = canvas.getContext("2d");

    // UI refs
    const scoreEl = $("#score"), bestEl = $("#best"), lengthEl = $("#length");
    const finalScoreEl = $("#finalScore"), finalBestEl = $("#finalBest"), finalLengthEl = $("#finalLength");
    const overlayStart = $("#overlayStart"), overlayPause = $("#overlayPause"), overlayGameOver = $("#overlayGameOver");
    const gameOverReasonEl = $("#gameOverReason");
    const speedSelect = $("#speedSelect"), gridSelect = $("#gridSelect"), wrapToggle = $("#wrapToggle"), soundToggle = $("#soundToggle");
    const speedBadge = $("#speedBadge"), modeBadge = $("#modeBadge"), levelFill = $("#levelFill"), levelText = $("#levelText");

    // State
    let GRID = 20;
    let SPEED = 110;
    let WRAP = false;
    let soundEnabled = true;

    let snake = [];
    let dir = { x: 1, y: 0 };
    let nextDir = { x: 1, y: 0 };
    let food = { x: 10, y: 10, golden: false };
    let score = 0;
    let best = +(localStorage.getItem("snek_best") || 0);
    let tickId = null;
    let paused = false;
    let gameState = "idle"; // idle | playing | paused | over

    function showOverlay(which) {
        [overlayStart, overlayPause, overlayGameOver].forEach(o => o.classList.remove("show"));
        if (which) which.classList.add("show");
    }

    function updateHUD() {
        scoreEl.textContent = score;
        bestEl.textContent = best;
        lengthEl.textContent = snake.length;
        speedBadge.textContent = SPEED + "ms";
        modeBadge.textContent = "WALLS: " + (WRAP ? "WRAP" : "SOLID");
        const level = Math.floor(score / 50) + 1;
        levelText.textContent = "Lv. " + level;
        levelFill.style.width = Math.min(100, 20 + level * 12) + "%";
    }

    function resizeCanvas() {
        // Keep canvas buffer 600x600 always; visual scaling via CSS. Just re-render.
        // But adjust background grid size for CSS fallback - we draw grid in canvas anyway.
    }

    function resetGame() {
        GRID = parseInt(gridSelect.value, 10);
        SPEED = parseInt(speedSelect.value, 10);
        WRAP = wrapToggle.checked;
        soundEnabled = soundToggle.checked;

        const mid = Math.floor(GRID / 2);
        snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid },
        ];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        score = 0;
        spawnFood();
        paused = false;
        updateHUD();
        draw();
    }

    function spawnFood() {
        let tries = 0;
        do {
            food = {
                x: Math.floor(Math.random() * GRID),
                y: Math.floor(Math.random() * GRID),
                golden: Math.random() < 0.1, // 10% golden
            };
            tries++;
            if (tries > 200) break;
        } while (snake.some(s => s.x === food.x && s.y === food.y));
    }

    // Sound with WebAudio
    let audioCtx = null;
    function beep(freq = 440, dur = 0.08, type = "square", gain = 0.15) {
        if (!soundEnabled) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === "suspended") audioCtx.resume();
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.value = gain;
            o.connect(g).connect(audioCtx.destination);
            o.start();
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
            o.stop(audioCtx.currentTime + dur);
        } catch { }
    }

    function setDirection(nx, ny) {
        // prevent 180 reverse
        if (snake.length > 1 && nx === -dir.x && ny === -dir.y) return;
        // also prevent queued opposite
        if (nx === -nextDir.x && ny === -nextDir.y && snake.length > 1) {
            // if dir already changed, check dir
            if (nx === -dir.x && ny === -dir.y) return;
        }
        nextDir = { x: nx, y: ny };
        // if idle, start game on first direction
        if (gameState === "idle") startPlaying();
        if (gameState === "paused") return;
    }

    function startPlaying() {
        gameState = "playing";
        showOverlay(null);
        startLoop();
    }

    function startLoop() {
        stopLoop();
        tickId = setInterval(tick, getTickSpeed());
    }
    function stopLoop() {
        if (tickId) clearInterval(tickId);
        tickId = null;
    }
    function getTickSpeed() {
        // speed up slightly as score grows: -2ms per 50 pts, capped
        const bonus = Math.floor(score / 50) * 6;
        return Math.max(45, SPEED - bonus);
    }

    function tick() {
        if (gameState !== "playing" || paused) return;
        dir = { ...nextDir };
        let head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        // wall handling
        if (WRAP) {
            head.x = (head.x + GRID) % GRID;
            head.y = (head.y + GRID) % GRID;
        } else {
            if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
                return gameOver("You hit the wall!");
            }
        }

        // self collision (check before tail removal; allow moving into tail if tail will move and not eating)
        const willEat = head.x === food.x && head.y === food.y;
        const bodyToCheck = willEat ? snake : snake.slice(0, -1);
        if (bodyToCheck.some(s => s.x === head.x && s.y === head.y)) {
            return gameOver("You bit yourself!");
        }

        snake.unshift(head);

        // eat
        if (willEat) {
            const pts = food.golden ? 50 : 10;
            score += pts;
            if (score > best) {
                best = score;
                localStorage.setItem("snek_best", String(best));
            }
            beep(food.golden ? 880 : 620, 0.12, food.golden ? "sine" : "square", 0.18);
            spawnFood();
            // adjust speed dynamically every 50 pts
            if (score % 50 === 0) {
                startLoop();
            }
            updateHUD();
        } else {
            snake.pop();
            // small move tick sound optional - muted to avoid annoyance
        }

        draw();
    }

    function gameOver(reason) {
        gameState = "over";
        stopLoop();
        beep(160, 0.35, "sawtooth", 0.2);
        setTimeout(() => beep(120, 0.4, "sawtooth", 0.18), 120);
        gameOverReasonEl.textContent = reason;
        finalScoreEl.textContent = score;
        finalBestEl.textContent = best;
        finalLengthEl.textContent = snake.length;
        updateHUD();
        showOverlay(overlayGameOver);
    }

    function togglePause() {
        if (gameState === "playing") {
            paused = true; gameState = "paused";
            stopLoop();
            showOverlay(overlayPause);
            $("#btnPause").textContent = "▶ Resume";
        } else if (gameState === "paused") {
            paused = false; gameState = "playing";
            showOverlay(null);
            startLoop();
            $("#btnPause").textContent = "⏸ Pause";
        } else if (gameState === "idle") {
            startPlaying();
        }
    }

    // Drawing
    function draw() {
        const W = canvas.width, H = canvas.height;
        const cell = W / GRID;

        // clear
        ctx.clearRect(0, 0, W, H);

        // subtle icy grid
        ctx.strokeStyle = "rgba(180, 225, 255, 0.07)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= GRID; i++) {
            const p = Math.round(i * cell) + 0.5;
            ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
        }

        // food shadow
        const fx = food.x * cell, fy = food.y * cell;
        // apple
        ctx.save();
        // glow
        if (food.golden) {
            ctx.shadowColor = "rgba(255,200,61,0.9)";
            ctx.shadowBlur = 18;
        } else {
            ctx.shadowColor = "rgba(255,77,109,0.85)";
            ctx.shadowBlur = 14;
        }
        const pad = cell * 0.14;
        const rx = fx + pad, ry = fy + pad, rw = cell - pad * 2, rh = cell - pad * 2;
        // body
        ctx.fillStyle = food.golden ? "#ffc83d" : "#ff4d6d";
        roundRect(rx, ry, rw, rh, cell * 0.32);
        ctx.fill();
        // highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        roundRect(rx + rw * 0.18, ry + rh * 0.15, rw * 0.45, rh * 0.28, 6);
        ctx.fill();
        // stem
        ctx.fillStyle = food.golden ? "#b77900" : "#2a6b2a";
        ctx.fillRect(fx + cell * 0.5 - 2, fy + pad - 2, 4, 6);
        // leaf
        ctx.fillStyle = "#3bff88";
        ctx.beginPath();
        ctx.ellipse(fx + cell * 0.68, fy + pad + 2, 7, 4, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // snake
        snake.forEach((seg, i) => {
            const x = seg.x * cell, y = seg.y * cell;
            const isHead = i === 0;
            const isTail = i === snake.length - 1;

            // segment rect with rounding
            const inset = isHead ? cell * 0.08 : cell * 0.12;
            const r = cell * 0.36;
            ctx.save();
            if (isHead) {
                // head glow
                ctx.shadowColor = "rgba(59,255,136,0.7)";
                ctx.shadowBlur = 14;
                ctx.fillStyle = "#3bff88";
            } else {
                // gradient body
                const t = i / Math.max(1, snake.length - 1);
                // from bright to darker
                const g = ctx.createLinearGradient(x, y, x + cell, y + cell);
                g.addColorStop(0, `rgba(${60 + Math.floor(t * 20)}, ${255 - Math.floor(t * 70)}, ${140 - Math.floor(t * 40)}, 1)`);
                g.addColorStop(1, `rgba(${20}, ${180 - Math.floor(t * 40)}, ${110}, 1)`);
                ctx.fillStyle = g;
                ctx.shadowColor = "rgba(0,0,0,0.35)";
                ctx.shadowBlur = 6;
            }
            roundRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2, isHead ? r : r * 0.9);
            ctx.fill();
            ctx.shadowBlur = 0;

            // head details: eyes + nostrils direction
            if (isHead) {
                // eyes
                ctx.fillStyle = "#07110b";
                const eyeR = Math.max(2, cell * 0.09);
                // determine eye positions based on dir
                let e1 = { x: 0, y: 0 }, e2 = { x: 0, y: 0 };
                const cx = x + cell / 2, cy = y + cell / 2;
                const off = cell * 0.18;
                const fwd = cell * 0.14;
                if (dir.x === 1) { // right
                    e1 = { x: cx + fwd, y: cy - off }; e2 = { x: cx + fwd, y: cy + off };
                } else if (dir.x === -1) { // left
                    e1 = { x: cx - fwd, y: cy - off }; e2 = { x: cx - fwd, y: cy + off };
                } else if (dir.y === -1) { // up
                    e1 = { x: cx - off, y: cy - fwd }; e2 = { x: cx + off, y: cy - fwd };
                } else { // down
                    e1 = { x: cx - off, y: cy + fwd }; e2 = { x: cx + off, y: cy + fwd };
                }
                ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR, 0, Math.PI * 2); ctx.fill();
                // eye shine
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.beginPath(); ctx.arc(e1.x + 1, e1.y - 1, 1.1, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(e2.x + 1, e2.y - 1, 1.1, 0, Math.PI * 2); ctx.fill();
                // tongue when moving? flick occasionally
                if (Math.random() < 0.08) {
                    ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
                    const tx = cx + dir.x * cell * 0.55, ty = cy + dir.y * cell * 0.55;
                    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + dir.x * 8, ty + dir.y * 8); ctx.stroke();
                }
            } else {
                // body pattern dots
                ctx.fillStyle = "rgba(255,255,255,0.12)";
                ctx.beginPath();
                ctx.arc(x + cell * 0.5, y + cell * 0.5, cell * 0.09, 0, Math.PI * 2);
                ctx.fill();
            }

            // tail tip taper visual
            if (isTail && snake.length > 3) {
                ctx.fillStyle = "rgba(0,0,0,0.18)";
                roundRect(x + cell * 0.3, y + cell * 0.3, cell * 0.4, cell * 0.4, 6);
                ctx.fill();
            }
            ctx.restore();
        });

        // vignette
        const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.45, W / 2, H / 2, W * 0.9);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, "rgba(0,0,0,0.35)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    // Input: keyboard
    window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (["arrowup", "w"].includes(k)) { e.preventDefault(); setDirection(0, -1); }
        else if (["arrowdown", "s"].includes(k)) { e.preventDefault(); setDirection(0, 1); }
        else if (["arrowleft", "a"].includes(k)) { e.preventDefault(); setDirection(-1, 0); }
        else if (["arrowright", "d"].includes(k)) { e.preventDefault(); setDirection(1, 0); }
        else if (k === " " || k === "p") { e.preventDefault(); togglePause(); }
        else if (k === "r") { e.preventDefault(); doRestart(); }
    });

    // Buttons
    function doRestart() {
        resetGame();
        gameState = "idle";
        showOverlay(overlayStart);
        $("#btnPause").textContent = "⏸ Pause";
        beep(440, 0.08, "square", 0.12);
    }
    function doResume() {
        if (gameState === "paused") togglePause();
    }

    $("#btnPlay").addEventListener("click", startPlaying);
    $("#btnPause").addEventListener("click", togglePause);
    $("#btnResume").addEventListener("click", doResume);
    $("#btnRestart").addEventListener("click", doRestart);
    $("#btnRestart2").addEventListener("click", doRestart);
    $("#btnAgain").addEventListener("click", doRestart);
    $("#btnDPadPause").addEventListener("click", togglePause);

    // DPad
    document.querySelectorAll("[data-dir]").forEach(btn => {
        const action = () => {
            const d = btn.dataset.dir;
            if (d === "up") setDirection(0, -1);
            if (d === "down") setDirection(0, 1);
            if (d === "left") setDirection(-1, 0);
            if (d === "right") setDirection(1, 0);
        };
        btn.addEventListener("click", action);
        btn.addEventListener("touchstart", (e) => { e.preventDefault(); action(); }, { passive: false });
    });

    // Swipe
    let touchStart = null;
    canvas.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("touchend", (e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
        if (Math.hypot(dx, dy) < 18) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            setDirection(dx > 0 ? 1 : -1, 0);
        } else {
            setDirection(0, dy > 0 ? 1 : -1);
        }
        touchStart = null;
    });

    // Settings live update
    speedSelect.addEventListener("change", () => {
        SPEED = parseInt(speedSelect.value, 10);
        updateHUD();
        if (gameState === "playing") startLoop();
        beep(700, 0.06);
    });
    gridSelect.addEventListener("change", () => {
        doRestart();
        beep(600, 0.06);
    });
    wrapToggle.addEventListener("change", () => {
        WRAP = wrapToggle.checked;
        updateHUD();
        beep(500, 0.06);
    });
    soundToggle.addEventListener("change", () => {
        soundEnabled = soundToggle.checked;
        if (soundEnabled) beep(880, 0.08);
    });

    // Topbar help/settings
    $("#btnHelp").addEventListener("click", () => $("#helpDialog").showModal());
    $("#btnSettings").addEventListener("click", () => {
        const p = $("#settingsPanel");
        p.style.display = p.style.display === "none" ? "" : "none";
    });

    // Christmas falling snowflakes generator
    function initSnow() {
        const snowContainer = document.querySelector(".snow-container");
        if (!snowContainer) return;
        const count = 42;
        const flakeChars = ["❄", "❅", "❆", "•", "·", "❄️"];
        for (let i = 0; i < count; i++) {
            const flake = document.createElement("span");
            flake.className = "snowflake";
            flake.textContent = flakeChars[Math.floor(Math.random() * flakeChars.length)];
            flake.style.left = (Math.random() * 98 + 1).toFixed(2) + "vw";
            const duration = (Math.random() * 6 + 6).toFixed(1);
            flake.style.animationDuration = duration + "s";
            flake.style.animationDelay = (Math.random() * 7).toFixed(1) + "s";
            flake.style.fontSize = (Math.random() * 12 + 10).toFixed(0) + "px";
            flake.style.opacity = (Math.random() * 0.65 + 0.35).toFixed(2);
            if (Math.random() > 0.65) {
                flake.style.filter = "blur(1.5px)";
            }
            snowContainer.appendChild(flake);
        }
    }

    // Init
    initSnow();
    bestEl.textContent = best;
    resetGame();
    gameState = "idle";
    showOverlay(overlayStart);
    draw();
    updateHUD();

    // Handle visibility change pause
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && gameState === "playing") togglePause();
    });

    // Prevent arrow scrolling
    window.addEventListener("keydown", e => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    });

})();
