const headline = "Numbers, growth, and accounts — sorted from one place.";
const target = document.getElementById("typewriter");

let i = 0;

function typeNext() {
  if (!target) return;
  if (i <= headline.length) {
    target.textContent = headline.slice(0, i);
    i++;
    const delay = 28 + Math.random() * 35;
    setTimeout(typeNext, delay);
  } else {
    setTimeout(() => {
      const cursor = document.querySelector(".cursor");
      if (cursor) cursor.classList.add("cursor-still");
    }, 1200);

    startFlying();
  }
}

setTimeout(typeNext, 300);

/* Floating Icons Dynamic Positioning */
let iconsData = [];
let isFlying = false;

window.addEventListener("DOMContentLoaded", () => {
  const badges = document.querySelectorAll(".icon-badge");
  if (!badges.length) return;

  const totalBadges = badges.length;
  const heroElement = document.querySelector(".hero") || document.body;
  const heroRect = heroElement.getBoundingClientRect();
  const startY = Math.max(30, heroRect.top + 20);

  badges.forEach((el, index) => {
    el.style.zIndex = "1";

    const totalWidth = Math.min(window.innerWidth * 0.85, 700);
    const startX = (window.innerWidth - totalWidth) / 2 + (totalWidth / (totalBadges - 1)) * index;

    const vx = (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.35);
    const vy = (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.35);

    iconsData.push({
      el,
      x: startX,
      y: startY,
      startX,
      startY,
      vx,
      vy,
      rot: 0,
      vRot: (Math.random() - 0.5) * 0.4,
      phase: index * 0.6
    });
  });

  animate();
});

function startFlying() {
  isFlying = true;
}

let time = 0;

function animate() {
  time += 0.04;

  const maxX = window.innerWidth - 60;
  const maxY = window.innerHeight - 60;

  iconsData.forEach((icon) => {
    if (!isFlying) {
      const gentleFloatY = icon.startY + Math.sin(time + icon.phase) * 6;
      icon.x = icon.startX;
      icon.y = gentleFloatY;
      icon.el.style.transform = `translate3d(${icon.x}px, ${icon.y}px, 0) rotate(0deg)`;
    } else {
      icon.x += icon.vx;
      icon.y += icon.vy;
      icon.rot += icon.vRot;

      if (icon.x <= 10) {
        icon.x = 10;
        icon.vx *= -1;
      } else if (icon.x >= maxX) {
        icon.x = maxX;
        icon.vx *= -1;
      }

      if (icon.y <= 10) {
        icon.y = 10;
        icon.vy *= -1;
      } else if (icon.y >= maxY) {
        icon.y = maxY;
        icon.vy *= -1;
      }

      icon.el.style.transform = `translate3d(${icon.x}px, ${icon.y}px, 0) rotate(${icon.rot}deg)`;
    }
  });

  requestAnimationFrame(animate);
}
