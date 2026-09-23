import { services } from "./data.js";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("platformContainer");
  const searchInput = document.getElementById("platformSearch");

  function renderPlatforms(filterText = "") {
    container.innerHTML = "";

    const filtered = services.filter((s) =>
      s.name.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color:#aaa; grid-column: 1/-1; text-align:center;">No platforms found.</p>`;
      return;
    }

    filtered.forEach((service) => {
      const card = document.createElement("div");
      card.className = "platform-card";

      card.onclick = () => {
        window.location.href = `country-select.html?serviceSlug=${encodeURIComponent(
          service.slug
        )}&serviceName=${encodeURIComponent(service.name)}`;
      };

      const iconBg = service.badgeBg || "rgba(16, 185, 129, 0.2)";
      const iconColor = service.iconColor || "#10B981";

      card.innerHTML = `
        <div class="platform-icon" style="background: ${iconBg}; color: ${iconColor};">
          ${service.iconSvg || service.name.charAt(0)}
        </div>
        <div class="platform-info">
          <h4>${service.name}</h4>
          <p>Instant SMS Verification</p>
        </div>
      `;

      container.appendChild(card);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => renderPlatforms(e.target.value));
  }

  renderPlatforms();
});
