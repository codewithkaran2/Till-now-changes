// Mode selection button events
const duoBtn = document.getElementById("duoButton");
const soloBtn = document.getElementById("soloButton");
const p2NameInput = document.getElementById("p2Name");
// Global game mode: "duo" or "solo" (default is "duo")
let gameMode = "duo";

// Updated duo mode listener: Clear player2 input when selected.
duoBtn.addEventListener("click", () => {
  gameMode = "duo";
  duoBtn.style.border = "3px solid white";
  soloBtn.style.border = "none";
  p2NameInput.disabled = false;
  p2NameInput.placeholder = "Enter 🟥 Player 2 Name";
  p2NameInput.value = ""; // Clear previous value
});
soloBtn.addEventListener("click", () => {
  gameMode = "solo";
  soloBtn.style.border = "3px solid white";
  duoBtn.style.border = "none";
  p2NameInput.disabled = true;
  p2NameInput.value = "Computer";
});

// Helper: draw a rounded rectangle
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Full screen toggle
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Default names and scores
const defaultP1Name = "Player 1";
const defaultP2Name = "Player 2";
let p1Name = defaultP1Name;
let p2Name = defaultP2Name;
let p1Score = 0, p2Score = 0;

const speed = 5;
let gameRunning = false;
let gamePaused = false;

// Audio elements
const bgMusic = document.getElementById("bgMusic");
const shootSound = document.getElementById("shootSound");
const hitSound = document.getElementById("hitSound");
const shieldBreakSound = document.getElementById("shieldBreakSound");

// Start background music (triggered on game start)
function startBackgroundMusic() {
  bgMusic.play();
}

// Set volume from slider
const volumeSlider = document.getElementById("volumeSlider");
function updateVolume() {
  let vol = volumeSlider.value / 100;
  bgMusic.volume = vol;
  shootSound.volume = vol;
  hitSound.volume = vol;
  shieldBreakSound.volume = vol;
}
volumeSlider.addEventListener("input", updateVolume);
updateVolume();

// Players (if solo, player2 is AI-controlled)
const player1 = {
  x: 100,
  y: 0,
  width: 40,
  height: 40,
  color: "blue",
  health: 100,
  shield: 100,
  shieldActive: false,
  shieldBroken: false,
  canShoot: true,
  lastDir: "right"
};
const player2 = {
  x: 600,
  y: 0,
  width: 40,
  height: 40,
  color: "red",
  health: 100,
  shield: 100,
  shieldActive: false,
  shieldBroken: false,
  canShoot: true,
  lastDir: "left"
};

let bullets = [];

// Controls mapping
const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
  " ": false, q: false, Enter: false, m: false, p: false
};

// Update last direction based on key input
function updateDirection() {
  if (keys.w) { player1.lastDir = "up"; }
  else if (keys.s) { player1.lastDir = "down"; }
  else if (keys.a) { player1.lastDir = "left"; }
  else if (keys.d) { player1.lastDir = "right"; }
  
  if (gameMode === "duo") {
    if (keys.ArrowUp) { player2.lastDir = "up"; }
    else if (keys.ArrowDown) { player2.lastDir = "down"; }
    else if (keys.ArrowLeft) { player2.lastDir = "left"; }
    else if (keys.ArrowRight) { player2.lastDir = "right"; }
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "CapsLock") { e.preventDefault(); return; }
  if (keys.hasOwnProperty(e.key)) {
    if (e.key === "p") { togglePause(); return; }
    if (e.key === " " && player1.canShoot && gameRunning && !gamePaused) {
      shootBullet(player1, 1);
      player1.canShoot = false;
    } else if (e.key === "Enter" && gameMode === "duo" && player2.canShoot && gameRunning && !gamePaused) {
      shootBullet(player2, 2);
      player2.canShoot = false;
    }
    keys[e.key] = true;
    updateDirection();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "CapsLock") { e.preventDefault(); return; }
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = false;
    if (e.key === " ") player1.canShoot = true;
    if (e.key === "Enter" && gameMode === "duo") player2.canShoot = true;
    updateDirection();
  }
});

/*
  CONCURRENT MOVEMENT FIX:
  - We compute dx/dy for both players
  - Move horizontally for both at once, check collision => revert if needed
  - Move vertically for both at once, check collision => revert if needed
  - If solo mode, we call updateAI() after player1's move
*/
function movePlayers() {
  let dx1 = 0, dy1 = 0;
  let dx2 = 0, dy2 = 0;
  
  // Player1 movement
  if (keys.a && player1.x > 0) dx1 = -speed;
  if (keys.d && player1.x + player1.width < canvas.width) dx1 = speed;
  if (keys.w && player1.y > 0) dy1 = -speed;
  if (keys.s && player1.y + player1.height < canvas.height) dy1 = speed;
  
  // Player2 movement in duo mode
  if (gameMode === "duo") {
    if (keys.ArrowLeft && player2.x > 0) dx2 = -speed;
    if (keys.ArrowRight && player2.x + player2.width < canvas.width) dx2 = speed;
    if (keys.ArrowUp && player2.y > 0) dy2 = -speed;
    if (keys.ArrowDown && player2.y + player2.height < canvas.height) dy2 = speed;
  }

  // --- Horizontal move (both at once) ---
  const oldP1x = player1.x;
  const oldP2x = player2.x;
  player1.x += dx1;
  if (gameMode === "duo") {
    player2.x += dx2;
  }
  // If collision => revert
  if (rectCollision(player1, player2)) {
    player1.x = oldP1x;
    if (gameMode === "duo") {
      player2.x = oldP2x;
    }
  }

  // --- Vertical move (both at once) ---
  const oldP1y = player1.y;
  const oldP2y = player2.y;
  player1.y += dy1;
  if (gameMode === "duo") {
    player2.y += dy2;
  }
  // If collision => revert
  if (rectCollision(player1, player2)) {
    player1.y = oldP1y;
    if (gameMode === "duo") {
      player2.y = oldP2y;
    }
  }

  // If solo => run AI after player1's move
  if (gameMode === "solo") {
    updateAI();
  }

  // Shield toggles
  player1.shieldActive = keys.q;
  if (gameMode === "duo") {
    player2.shieldActive = keys.m;
  } else {
    player2.shieldActive = false;
  }
  
  updateDirection();
}

/* 
  rectCollision with margin: 
  When players come within 'margin' px, treat it as collision.
*/
function rectCollision(rect1, rect2) {
  const margin = 5; // Adjust margin as needed
  return rect1.x < rect2.x + rect2.width + margin &&
         rect1.x + rect1.width > rect2.x - margin &&
         rect1.y < rect2.y + rect2.height + margin &&
         rect1.y + rect1.height > rect2.y - margin;
}

/* 
  UPDATED updateAI for Solo mode:
  Uses proportional control for smoother tracking and a closer shooting threshold.
*/
function updateAI() {
  if (gameMode === "solo") {
    let centerX1 = player1.x + player1.width / 2;
    let centerY1 = player1.y + player1.height / 2;
    let centerX2 = player2.x + player2.width / 2;
    let centerY2 = player2.y + player2.height / 2;
    
    let diffX = centerX1 - centerX2;
    let diffY = centerY1 - centerY2;
    
    // Proportional movement factor (adjust for responsiveness)
    let factor = 0.05;
    let moveX = diffX * factor;
    let moveY = diffY * factor;
    
    // Clamp movement to the defined speed
    moveX = Math.max(-speed, Math.min(speed, moveX));
    moveY = Math.max(-speed, Math.min(speed, moveY));
    
    player2.x += moveX;
    player2.y += moveY;
    
    // Shoot if within a certain distance (e.g., 150 pixels)
    let distance = Math.sqrt(diffX * diffX + diffY * diffY);
    if (distance < 150 && player2.canShoot && gameRunning && !gamePaused) {
      shootBullet(player2, 2);
      player2.canShoot = false;
      // Faster shooting delay for AI
      setTimeout(() => { player2.canShoot = true; }, 300);
    }
  }
}

function drawTopStatus() {
  // ...unchanged...
  const leftX = 20, topY = 20, barWidth = 200, barHeight = 15;
  ctx.fillStyle = "red";
  ctx.fillRect(leftX, topY, (player1.health/100)*barWidth, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(leftX, topY, barWidth, barHeight);
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "white";
  ctx.fillText("Health: " + player1.health + "%", leftX+5, topY+13);
  
  let shieldColor1 = (player1.shield > 0)
    ? ctx.createLinearGradient(leftX, topY+barHeight+5, leftX+barWidth, topY+barHeight+5)
    : "#777";
  if (player1.shield > 0) {
    shieldColor1.addColorStop(0, "#4A90E2");
    shieldColor1.addColorStop(1, "#003366");
  }
  ctx.fillStyle = shieldColor1;
  ctx.fillRect(leftX, topY+barHeight+5, (player1.shield/100)*barWidth, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(leftX, topY+barHeight+5, barWidth, barHeight);
  ctx.fillStyle = "white";
  ctx.fillText("Shield: " + player1.shield + "% 🛡️", leftX+5, topY+barHeight*2+3);
  
  const nameBoxWidth = 220, nameBoxHeight = 30;
  ctx.fillStyle = "white";
  ctx.fillRect(leftX, topY+barHeight*2+20, nameBoxWidth, nameBoxHeight);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, topY+barHeight*2+20, nameBoxWidth, nameBoxHeight);
  ctx.fillStyle = "blue";
  ctx.font = "bold 16px Arial";
  ctx.fillText("🟦 " + p1Name, leftX+10, topY+barHeight*2+27);
  
  const rightX = canvas.width - barWidth - 20;
  ctx.textAlign = "right";
  ctx.fillStyle = "red";
  ctx.fillRect(rightX, topY, (player2.health/100)*barWidth, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(rightX, topY, barWidth, barHeight);
  ctx.font = "14px Arial";
  ctx.fillStyle = "white";
  ctx.fillText("Health: " + player2.health + "%", rightX+barWidth-5, topY+13);
  
  let shieldColor2 = (player2.shield > 0)
    ? ctx.createLinearGradient(rightX, topY+barHeight+5, rightX+barWidth, topY+barHeight+5)
    : "#777";
  if (player2.shield > 0) {
    shieldColor2.addColorStop(0, "#4A90E2");
    shieldColor2.addColorStop(1, "#003366");
  }
  ctx.fillStyle = shieldColor2;
  ctx.fillRect(rightX, topY+barHeight+5, (player2.shield/100)*barWidth, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(rightX, topY+barHeight+5, barWidth, barHeight);
  ctx.fillStyle = "white";
  ctx.fillText("Shield: " + player2.shield + "% 🛡️", rightX+barWidth-5, topY+barHeight*2+3);
  
  ctx.fillStyle = "white";
  ctx.fillRect(rightX, topY+barHeight*2+20, nameBoxWidth, nameBoxHeight);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  ctx.strokeRect(rightX, topY+barHeight*2+20, nameBoxWidth, nameBoxHeight);
  ctx.fillStyle = "red";
  ctx.font = "bold 16px Arial";
  ctx.fillText("🟥 " + (gameMode==="solo" ? "Computer" : p2Name), rightX+nameBoxWidth-10, topY+barHeight*2+27);
  ctx.textAlign = "left";
}

function drawControls() {
  // ...unchanged...
  const boxWidth = 300, boxHeight = 50, padding = 20, radius = 10;
  const leftX = padding;
  const leftY = canvas.height - boxHeight - padding;
  let grad1 = ctx.createLinearGradient(leftX, leftY, leftX, leftY+boxHeight);
  grad1.addColorStop(0, "#777");
  grad1.addColorStop(1, "#444");
  ctx.save();
  ctx.shadowColor = "black";
  ctx.shadowBlur = 6;
  drawRoundedRect(ctx, leftX, leftY, boxWidth, boxHeight, radius);
  ctx.fillStyle = grad1;
  ctx.fill();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "white";
  ctx.fillText("🟦P1: WASD | SPACE shoot | Q shield", leftX+10, leftY+30);
  
  const rightX = canvas.width - boxWidth - padding;
  const rightY = canvas.height - boxHeight - padding;
  let grad2 = ctx.createLinearGradient(rightX, rightY, rightX, rightY+boxHeight);
  grad2.addColorStop(0, "#777");
  grad2.addColorStop(1, "#444");
  ctx.save();
  ctx.shadowColor = "black";
  ctx.shadowBlur = 6;
  drawRoundedRect(ctx, rightX, rightY, boxWidth, boxHeight, radius);
  ctx.fillStyle = grad2;
  ctx.fill();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  if (gameMode==="duo") {
    ctx.fillText("🟥P2: Arrows | ENTER shoot | M shield", rightX+boxWidth/2, rightY+30);
  } else {
    ctx.fillText("🟥AI Controlled", rightX+boxWidth/2, rightY+30);
  }
  ctx.textAlign = "left";
}

function drawPlayerNamesBox() {
  // ...unchanged...
  const boxWidth = 500, boxHeight = 50;
  const x = (canvas.width - boxWidth) / 2;
  const y = 100;
  ctx.fillStyle = "white";
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "blue";
  ctx.fillText("🟦 " + p1Name, x+20, y+30);
  ctx.textAlign = "right";
  ctx.fillStyle = "red";
  ctx.fillText("🟥 " + (gameMode==="solo" ? "Computer" : p2Name), x+boxWidth-20, y+30);
  ctx.textAlign = "left";
}

function gameLoop() {
  if (!gameRunning || gamePaused) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTopStatus();
  movePlayers();
  updateBullets();
  drawPlayer(player1);
  drawPlayer(player2);
  drawControls();
  checkGameOver();
  requestAnimationFrame(gameLoop);
}

function drawPlayer(player) {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  if (player.shieldActive && player.shield > 0) {
    ctx.strokeStyle = player.shieldBroken ? "orange" : "cyan";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width, 0, Math.PI*2);
    ctx.stroke();
  }
}

function shootBullet(player, owner) {
  if (shootSound) {
    shootSound.currentTime = 0;
    shootSound.play();
  }
  const bSize = 10;
  let bx = player.x, by = player.y, vx = 0, vy = 0;
  let dir = player.lastDir || (owner===1 ? "right" : "left");
  if (dir === "up") {
    bx = player.x + player.width/2 - bSize/2;
    by = player.y - bSize;
    vx = 0; 
    vy = -10;
  } else if (dir === "down") {
    bx = player.x + player.width/2 - bSize/2;
    by = player.y + player.height;
    vx = 0; 
    vy = 10;
  } else if (dir === "left") {
    bx = player.x - bSize;
    by = player.y + player.height/2 - bSize/2;
    vx = -10; 
    vy = 0;
  } else {
    bx = player.x + player.width;
    by = player.y + player.height/2 - bSize/2;
    vx = 10; 
    vy = 0;
  }
  const bullet = {
    x: bx,
    y: by,
    width: bSize,
    height: 4,
    speedX: vx,
    speedY: vy,
    owner: owner
  };
  bullets.push(bullet);
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    let bullet = bullets[i];
    bullet.x += bullet.speedX;
    bullet.y += bullet.speedY;
    ctx.fillStyle = (bullet.owner === 1) ? "cyan" : "orange";
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    if (
      bullet.x < 0 || bullet.x > canvas.width ||
      bullet.y < 0 || bullet.y > canvas.height
    ) {
      bullets.splice(i, 1);
      continue;
    }
    if (bullet.owner === 1 && rectCollision(bullet, player2)) {
      applyHit(player2);
      bullets.splice(i, 1);
      continue;
    } else if (bullet.owner === 2 && rectCollision(bullet, player1)) {
      applyHit(player1);
      bullets.splice(i, 1);
      continue;
    }
  }
}

function applyHit(player) {
  if (hitSound) {
    hitSound.currentTime = 0;
    hitSound.play();
  }
  if (player.shieldActive && player.shield > 0) {
    let prevShield = player.shield;
    player.shield -= 10;
    if (player.shield < 0) player.shield = 0;
    if (prevShield > 0 && player.shield === 0) {
      player.shieldBroken = true;
      if (shieldBreakSound) {
        shieldBreakSound.currentTime = 0;
        shieldBreakSound.play();
      }
      setTimeout(() => { player.shieldBroken = false; }, 500);
    }
  } else {
    player.health -= 10;
    if (player.health < 0) player.health = 0;
  }
}

function checkGameOver() {
  if (player1.health <= 0 || player2.health <= 0) {
    gameRunning = false;
    let winnerText = "";
    if (player1.health <= 0 && player2.health <= 0) {
      winnerText = "It's a draw!";
    } else if (player1.health <= 0) {
      winnerText = "Player 2 wins!";
      p2Score++;
    } else if (player2.health <= 0) {
      winnerText = "Player 1 wins!";
      p1Score++;
    }
    document.getElementById("winnerText").textContent = winnerText;
    updateScoreboard();
    showGameOverScreen();
  }
}

function updateScoreboard() {
  document.getElementById("p1Score").textContent = "Player 1: " + p1Score;
  document.getElementById("p2Score").textContent = "Player 2: " + p2Score;
}

function togglePause() {
  gamePaused = !gamePaused;
  document.getElementById("pauseScreen").classList.toggle("hidden", !gamePaused);
  if (!gamePaused && gameRunning) {
    gameLoop();
  }
}

function showGameOverScreen() {
  document.getElementById("gameOverScreen").classList.remove("hidden");
}

/*
  UPDATED dropPlayers: Increase dropSpeed from 5 to 10 for a faster drop animation.
*/
function dropPlayers() {
  let dropSpeed = 10; // Increased speed for drop animation
  let countdown = 3;
  let countdownInterval = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(countdown, canvas.width / 2, canvas.height / 2);
    countdown--;
    if (countdown < 0) {
      clearInterval(countdownInterval);
      animateDrop();
    }
  }, 1000);
  
  function animateDrop() {
    function dropAnimation() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (player1.y < 300) player1.y += dropSpeed;
      if (player2.y < 300) player2.y += dropSpeed;
      drawPlayer(player1);
      drawPlayer(player2);
      if (player1.y >= 300 && player2.y >= 300) {
        drawPlayerNamesBox();
        setTimeout(() => {
          gameRunning = true;
          startBackgroundMusic();
          gameLoop();
        }, 2000);
        return;
      }
      requestAnimationFrame(dropAnimation);
    }
    dropAnimation();
  }
}

function startGame() {
  let inputP1 = document.getElementById("p1Name").value.trim();
  let inputP2 = document.getElementById("p2Name").value.trim();
  p1Name = inputP1 ? inputP1 : defaultP1Name;
  if (gameMode === "solo") {
    p2Name = "Computer";
  } else {
    p2Name = inputP2 ? inputP2 : defaultP2Name;
  }
  document.getElementById("startScreen").classList.add("hidden");
  dropPlayers();
}

function playAgain() {
  restartGame();
  document.getElementById("startScreen").classList.add("hidden");
  dropPlayers();
}

function restartGame() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  document.getElementById("gameOverScreen").classList.add("hidden");
  document.getElementById("pauseScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
  
  player1.x = 100; 
  player1.y = 0; 
  player1.health = 100; 
  player1.shield = 100;
  
  player2.x = 600; 
  player2.y = 0; 
  player2.health = 100; 
  player2.shield = 100;
  
  bullets = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  document.getElementById("p1Name").value = "";
  document.getElementById("p2Name").value = "";
  p1Name = defaultP1Name; 
  p2Name = defaultP2Name;
  gameRunning = false;
}

// Name input event listeners
document.getElementById("p1Name").addEventListener("input", function() {
  let newName = this.value.trim();
  p1Name = newName === "" ? defaultP1Name : newName;
});
document.getElementById("p2Name").addEventListener("input", function() {
  let newName = this.value.trim();
  p2Name = newName === "" ? defaultP2Name : newName;
});
