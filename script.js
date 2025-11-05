const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const scoreEl = document.getElementById("score");

let letters = [];
let score = 0;
let gameRunning = false;

class Letter {
    constructor(char, x, y, speed) {
    this.char = char;
    this.x = x;
    this.y = y;
    this.speed = speed; 
    }
    draw() {
    ctx.font = "30px Poppins";
    ctx.fillStyle = "orange";
    ctx.fillText(this.char, this.x, this.y);
  }
  update() {
    this.y += this.speed;
  }
}
  function spawnLetter() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
  const x = Math.random() * (canvas.width - 30);
  letters.push(new Letter(randomChar, x, 0, 2 + Math.random() * 2));
}
function drawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  letters.forEach(letter => {
    letter.update();
    letter.draw();
  });
}
function gameLoop() {
  if (!gameRunning) return;
  drawAll();
  if (Math.random() < 0.02) spawnLetter(); // spawn randomly
  requestAnimationFrame(gameLoop);
}
startBtn.addEventListener("click", () => {
  letters = [];
  score = 0;
  gameRunning = true;
  scoreEl.textContent = "Score: " + score;
  gameLoop();
});
document.addEventListener("keydown", (e) => {
  const typed = e.key.toUpperCase();
  letters.forEach((letter, index) => {
    if (letter.char === typed) {
      letters.splice(index, 1);
      score++;
      scoreEl.textContent = "Score: " + score;
    }
  });
});


