const servicesMap = {
  "whatsapp-1": [
    { id: "us", name: "USA", code: "us", pools: 1, minPrice: 4.76 },
    { id: "fr", name: "France", code: "fr", pools: 1, minPrice: 9.26 },
    { id: "al", name: "Albania", code: "al", pools: 1, minPrice: 0.68 },
    { id: "es", name: "Spain", code: "es", pools: 1, minPrice: 15.00 },
    { id: "br", name: "Brazil", code: "br", pools: 1, minPrice: 3.54 },
    { id: "de", name: "Germany", code: "de", pools: 1, minPrice: 13.50 },
    { id: "ma", name: "Morocco", code: "ma", pools: 1, minPrice: 1.70 },
    { id: "gr", name: "Greece", code: "gr", pools: 1, minPrice: 1.49 },
    { id: "ca", name: "Canada", code: "ca", pools: 1, minPrice: 6.40 },
    { id: "hk", name: "Hong Kong", code: "hk", pools: 1, minPrice: 5.78 },
    { id: "gb", name: "England", code: "gb", pools: 1, minPrice: 5.80 },
    { id: "mx", name: "Mexico", code: "mx", pools: 1, minPrice: 5.37 },
    { id: "at", name: "Austria", code: "at", pools: 1, minPrice: 7.40 },
    { id: "it", name: "Italy", code: "it", pools: 1, minPrice: 9.45 },
    { id: "pl", name: "Poland", code: "pl", pools: 1, minPrice: 7.40 },
    { id: "co", name: "Colombia", code: "co", pools: 1, minPrice: 1.08 }
  ],
  "whatsapp-2": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 7, minPrice: 3.00 },
    { id: "us", name: "USA", code: "us", pools: 9, minPrice: 3.52 },
    { id: "al", name: "Albania", code: "al", pools: 1, minPrice: 1.80 },
    { id: "eg", name: "Egypt", code: "eg", pools: 1, minPrice: 3.15 },
    { id: "pl", name: "Poland", code: "pl", pools: 1, minPrice: 5.18 },
    { id: "id", name: "Indonesia", code: "id", pools: 11, minPrice: 0.77 },
    { id: "ca", name: "Canada", code: "ca", pools: 16, minPrice: 4.07 },
    { id: "co", name: "Colombia", code: "co", pools: 22, minPrice: 1.75 },
    { id: "ao", name: "Angola", code: "ao", pools: 1, minPrice: 3.85 },
    { id: "bg", name: "Bulgaria", code: "bg", pools: 1, minPrice: 9.66 },
    { id: "pa", name: "Panama", code: "pa", pools: 1, minPrice: 4.27 },
    { id: "in", name: "India", code: "in", pools: 10, minPrice: 5.11 },
    { id: "am", name: "Armenia", code: "am", pools: 1, minPrice: 5.18 },
    { id: "mg", name: "Madagascar", code: "mg", pools: 1, minPrice: 3.01 },
    { id: "dk", name: "Denmark", code: "dk", pools: 1, minPrice: 7.07 },
    { id: "gb", name: "United Kingdom", code: "gb", pools: 13, minPrice: 5.20 }
  ],
  "facebook": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 11, minPrice: 1.24 },
    { id: "us", name: "USA", code: "us", pools: 8, minPrice: 1.78 },
    { id: "ge", name: "Georgia", code: "ge", pools: 1, minPrice: 0.56 },
    { id: "lv", name: "Latvia", code: "lv", pools: 1, minPrice: 0.42 },
    { id: "es", name: "Spain", code: "es", pools: 1, minPrice: 1.89 },
    { id: "ro", name: "Romania", code: "ro", pools: 1, minPrice: 0.42 },
    { id: "kz", name: "Kazakhstan", code: "kz", pools: 1, minPrice: 0.35 },
    { id: "ee", name: "Estonia", code: "ee", pools: 1, minPrice: 0.77 },
    { id: "il", name: "Israel", code: "il", pools: 1, minPrice: 0.56 },
    { id: "cy", name: "Cyprus", code: "cy", pools: 1, minPrice: 0.63 },
    { id: "ni", name: "Nicaragua", code: "ni", pools: 1, minPrice: 0.63 },
    { id: "nz", name: "New Zealand", code: "nz", pools: 1, minPrice: 2.40 },
    { id: "at", name: "Austria", code: "at", pools: 1, minPrice: 4.00 },
    { id: "ca", name: "Canada", code: "ca", pools: 1, minPrice: 1.98 },
    { id: "pa", name: "Panama", code: "pa", pools: 1, minPrice: 1.26 },
    { id: "ph", name: "Philippines", code: "ph", pools: 4, minPrice: 0.42 }
  ],
  "telegram": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 6, minPrice: 4.59 },
    { id: "us", name: "USA", code: "us", pools: 4, minPrice: 4.56 },
    { id: "ma", name: "Morocco", code: "ma", pools: 1, minPrice: 1.82 },
    { id: "bj", name: "Benin", code: "bj", pools: 1, minPrice: 1.47 },
    { id: "pa", name: "Panama", code: "pa", pools: 1, minPrice: 3.15 },
    { id: "it", name: "Italy", code: "it", pools: 1, minPrice: 51.66 },
    { id: "co", name: "Colombia", code: "co", pools: 12, minPrice: 2.38 },
    { id: "af", name: "Afghanistan", code: "af", pools: 1, minPrice: 1.65 },
    { id: "iq", name: "Iraq", code: "iq", pools: 1, minPrice: 3.71 },
    { id: "tz", name: "Tanzania", code: "tz", pools: 1, minPrice: 2.38 },
    { id: "ao", name: "Angola", code: "ao", pools: 1, minPrice: 2.03 },
    { id: "za", name: "South Africa", code: "za", pools: 1, minPrice: 3.36 },
    { id: "am", name: "Armenia", code: "am", pools: 11, minPrice: 2.94 },
    { id: "bo", name: "Bolivia", code: "bo", pools: 1, minPrice: 2.24 },
    { id: "cz", name: "Czech Republic", code: "cz", pools: 1, minPrice: 18.41 },
    { id: "gb", name: "United Kingdom", code: "gb", pools: 8, minPrice: 4.32 }
  ],
  "google": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 6, minPrice: 4.00 },
    { id: "us", name: "USA", code: "us", pools: 6, minPrice: 5.00 },
    { id: "bh", name: "Bahrain", code: "bh", pools: 1, minPrice: 0.77 },
    { id: "kg", name: "Kyrgyzstan", code: "kg", pools: 1, minPrice: 0.77 },
    { id: "al", name: "Albania", code: "al", pools: 1, minPrice: 0.55 },
    { id: "qa", name: "Qatar", code: "qa", pools: 1, minPrice: 0.77 },
    { id: "il", name: "Israel", code: "il", pools: 1, minPrice: 0.77 },
    { id: "au", name: "Australia", code: "au", pools: 1, minPrice: 10.52 },
    { id: "sg", name: "Singapore", code: "sg", pools: 1, minPrice: 0.77 },
    { id: "by", name: "Belarus", code: "by", pools: 1, minPrice: 0.77 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 1, minPrice: 0.77 },
    { id: "cl", name: "Chile", code: "cl", pools: 23, minPrice: 0.35 },
    { id: "ph", name: "Philippines", code: "ph", pools: 1, minPrice: 1.33 },
    { id: "nz", name: "New Zealand", code: "nz", pools: 1, minPrice: 0.77 },
    { id: "kh", name: "Cambodia", code: "kh", pools: 1, minPrice: 1.61 },
    { id: "sa", name: "Saudi Arabia", code: "sa", pools: 1, minPrice: 0.77 }
  ],
  "amazon": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 9, minPrice: 0.06 },
    { id: "us", name: "USA", code: "us", pools: 5, minPrice: 1.52 },
    { id: "es", name: "Spain", code: "es", pools: 1, minPrice: 0.77 },
    { id: "mx", name: "Mexico", code: "mx", pools: 1, minPrice: 0.77 },
    { id: "rs", name: "Serbia", code: "rs", pools: 1, minPrice: 0.77 },
    { id: "dk", name: "Denmark", code: "dk", pools: 1, minPrice: 0.77 },
    { id: "kz", name: "Kazakhstan", code: "kz", pools: 1, minPrice: 0.63 },
    { id: "pa", name: "Panama", code: "pa", pools: 1, minPrice: 0.77 },
    { id: "at", name: "Austria", code: "at", pools: 1, minPrice: 0.66 },
    { id: "id", name: "Indonesia", code: "id", pools: 1, minPrice: 0.63 },
    { id: "by", name: "Belarus", code: "by", pools: 1, minPrice: 0.77 },
    { id: "tr", name: "Turkey", code: "tr", pools: 1, minPrice: 0.84 },
    { id: "ca", name: "Canada", code: "ca", pools: 13, minPrice: 0.44 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 1, minPrice: 0.77 },
    { id: "in", name: "India", code: "in", pools: 11, minPrice: 0.63 },
    { id: "ph", name: "Philippines", code: "ph", pools: 1, minPrice: 0.63 }
  ],
  "anyother": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 1, minPrice: 3.87 },
    { id: "us", name: "USA", code: "us", pools: 6, minPrice: 2.33 },
    { id: "br", name: "Brazil", code: "br", pools: 1, minPrice: 4.55 },
    { id: "ca", name: "Canada", code: "ca", pools: 1, minPrice: 4.40 },
    { id: "gb", name: "United Kingdom", code: "gb", pools: 1, minPrice: 11.25 },
    { id: "hk", name: "Hong Kong", code: "hk", pools: 1, minPrice: 20.68 },
    { id: "cl", name: "Chile", code: "cl", pools: 1, minPrice: 0.42 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 1, minPrice: 1.40 },
    { id: "co", name: "Colombia", code: "co", pools: 3, minPrice: 0.07 },
    { id: "ua", name: "Ukraine", code: "ua", pools: 1, minPrice: 3.22 },
    { id: "cz", name: "Czech Republic", code: "cz", pools: 1, minPrice: 6.30 },
    { id: "ph", name: "Philippines", code: "ph", pools: 1, minPrice: 0.42 },
    { id: "mx", name: "Mexico", code: "mx", pools: 1, minPrice: 3.22 },
    { id: "it", name: "Italy", code: "it", pools: 1, minPrice: 8.12 },
    { id: "de", name: "Germany", code: "de", pools: 1, minPrice: 15.30 },
    { id: "pl", name: "Poland", code: "pl", pools: 1, minPrice: 4.41 }
  ],
  "claude": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 13, minPrice: 0.57 },
    { id: "us", name: "USA", code: "us", pools: 12, minPrice: 1.45 },
    { id: "ca", name: "Canada", code: "ca", pools: 13, minPrice: 0.11 },
    { id: "gb", name: "United Kingdom", code: "gb", pools: 19, minPrice: 0.65 },
    { id: "id", name: "Indonesia", code: "id", pools: 11, minPrice: 0.07 },
    { id: "it", name: "Italy", code: "it", pools: 14, minPrice: 0.42 },
    { id: "hk", name: "Hong Kong", code: "hk", pools: 5, minPrice: 0.11 },
    { id: "co", name: "Colombia", code: "co", pools: 8, minPrice: 0.07 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 13, minPrice: 0.07 },
    { id: "de", name: "Germany", code: "de", pools: 10, minPrice: 0.05 },
    { id: "th", name: "Thailand", code: "th", pools: 9, minPrice: 0.07 },
    { id: "za", name: "South Africa", code: "za", pools: 6, minPrice: 0.35 },
    { id: "pt", name: "Portugal", code: "pt", pools: 10, minPrice: 0.07 },
    { id: "fr", name: "France", code: "fr", pools: 14, minPrice: 0.35 },
    { id: "pl", name: "Poland", code: "pl", pools: 11, minPrice: 0.07 },
    { id: "cz", name: "Czech Republic", code: "cz", pools: 9, minPrice: 0.07 }
  ],
  "instagram+threads": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 10, minPrice: 1.67 },
    { id: "us", name: "USA", code: "us", pools: 7, minPrice: 1.60 },
    { id: "am", name: "Armenia", code: "am", pools: 1, minPrice: 0.35 },
    { id: "tr", name: "Turkey", code: "tr", pools: 1, minPrice: 0.56 },
    { id: "ca", name: "Canada", code: "ca", pools: 1, minPrice: 3.70 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 1, minPrice: 0.42 },
    { id: "ro", name: "Romania", code: "ro", pools: 1, minPrice: 0.49 },
    { id: "ie", name: "Ireland", code: "ie", pools: 1, minPrice: 0.98 },
    { id: "cy", name: "Cyprus", code: "cy", pools: 1, minPrice: 0.42 },
    { id: "pa", name: "Panama", code: "pa", pools: 1, minPrice: 1.26 },
    { id: "ge", name: "Georgia", code: "ge", pools: 1, minPrice: 0.42 },
    { id: "at", name: "Austria", code: "at", pools: 1, minPrice: 3.54 },
    { id: "rs", name: "Serbia", code: "rs", pools: 1, minPrice: 2.59 },
    { id: "lv", name: "Latvia", code: "lv", pools: 1, minPrice: 2.45 },
    { id: "kh", name: "Cambodia", code: "kh", pools: 1, minPrice: 0.42 },
    { id: "sg", name: "Singapore", code: "sg", pools: 1, minPrice: 6.02 }
  ],
  "tiktok": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 8, minPrice: 2.02 },
    { id: "us", name: "USA", code: "us", pools: 6, minPrice: 4.98 },
    { id: "bg", name: "Bulgaria", code: "bg", pools: 1, minPrice: 0.42 },
    { id: "tz", name: "Tanzania", code: "tz", pools: 1, minPrice: 0.35 },
    { id: "lt", name: "Lithuania", code: "lt", pools: 1, minPrice: 0.35 },
    { id: "sg", name: "Singapore", code: "sg", pools: 1, minPrice: 6.02 },
    { id: "cy", name: "Cyprus", code: "cy", pools: 1, minPrice: 0.28 },
    { id: "rs", name: "Serbia", code: "rs", pools: 1, minPrice: 0.77 },
    { id: "uz", name: "Uzbekistan", code: "uz", pools: 1, minPrice: 0.14 },
    { id: "tr", name: "Turkey", code: "tr", pools: 1, minPrice: 1.05 },
    { id: "ro", name: "Romania", code: "ro", pools: 1, minPrice: 1.05 },
    { id: "mx", name: "Mexico", code: "mx", pools: 1, minPrice: 0.35 },
    { id: "mm", name: "Myanmar", code: "mm", pools: 1, minPrice: 0.21 },
    { id: "bh", name: "Bahrain", code: "bh", pools: 1, minPrice: 0.98 },
    { id: "my", name: "Malaysia", code: "my", pools: 1, minPrice: 1.12 },
    { id: "br", name: "Brazil", code: "br", pools: 1, minPrice: 5.22 }
  ],
  "paypal": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 1, minPrice: 6.00 },
    { id: "us", name: "USA", code: "us", pools: 2, minPrice: 6.12 },
    { id: "cy", name: "Cyprus", code: "cy", pools: 1, minPrice: 1.68 },
    { id: "ee", name: "Estonia", code: "ee", pools: 1, minPrice: 2.03 },
    { id: "pl", name: "Poland", code: "pl", pools: 1, minPrice: 1.82 },
    { id: "kh", name: "Cambodia", code: "kh", pools: 1, minPrice: 1.61 },
    { id: "co", name: "Colombia", code: "co", pools: 1, minPrice: 2.80 },
    { id: "ke", name: "Kenya", code: "ke", pools: 1, minPrice: 1.26 },
    { id: "by", name: "Belarus", code: "by", pools: 1, minPrice: 1.68 },
    { id: "al", name: "Albania", code: "al", pools: 1, minPrice: 2.65 },
    { id: "id", name: "Indonesia", code: "id", pools: 1, minPrice: 0.42 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 1, minPrice: 4.13 },
    { id: "ca", name: "Canada", code: "ca", pools: 1, minPrice: 6.11 },
    { id: "cl", name: "Chile", code: "cl", pools: 1, minPrice: 2.66 },
    { id: "gb", name: "United Kingdom", code: "gb", pools: 8, minPrice: 6.00 },
    { id: "hk", name: "Hong Kong", code: "hk", pools: 1, minPrice: 6.49 }
  ],
  "flipkart": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 1, minPrice: 0.06 },
    { id: "us", name: "USA", code: "us", pools: 1, minPrice: 0.04 },
    { id: "it", name: "Italy", code: "it", pools: 1, minPrice: 0.28 },
    { id: "fr", name: "France", code: "fr", pools: 1, minPrice: 0.07 },
    { id: "au", name: "Australia", code: "au", pools: 1, minPrice: 0.04 },
    { id: "in", name: "India", code: "in", pools: 9, minPrice: 0.49 },
    { id: "ca", name: "Canada", code: "ca", pools: 1, minPrice: 0.11 },
    { id: "br", name: "Brazil", code: "br", pools: 1, minPrice: 0.07 },
    { id: "hk", name: "Hong Kong", code: "hk", pools: 1, minPrice: 0.11 },
    { id: "cl", name: "Chile", code: "cl", pools: 1, minPrice: 0.07 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 1, minPrice: 0.07 },
    { id: "gb", name: "United Kingdom", code: "gb", pools: 1, minPrice: 0.05 },
    { id: "id", name: "Indonesia", code: "id", pools: 1, minPrice: 1.05 },
    { id: "ua", name: "Ukraine", code: "ua", pools: 1, minPrice: 0.07 },
    { id: "jp", name: "Japan", code: "jp", pools: 1, minPrice: 0.07 },
    { id: "gr", name: "Greece", code: "gr", pools: 1, minPrice: 0.28 }
  ],
  "apple": [
    { id: "us-virtual", name: "USA (virtual)", code: "us", pools: 9, minPrice: 0.05 },
    { id: "us", name: "USA", code: "us", pools: 15, minPrice: 0.52 },
    { id: "ca", name: "Canada", code: "ca", pools: 22, minPrice: 0.22 },
    { id: "id", name: "Indonesia", code: "id", pools: 18, minPrice: 0.14 },
    { id: "br", name: "Brazil", code: "br", pools: 19, minPrice: 0.42 },
    { id: "gb", name: "United Kingdom", code: "gb", pools: 22, minPrice: 0.05 },
    { id: "hk", name: "Hong Kong", code: "hk", pools: 10, minPrice: 1.98 },
    { id: "co", name: "Colombia", code: "co", pools: 13, minPrice: 0.49 },
    { id: "ph", name: "Philippines", code: "ph", pools: 19, minPrice: 0.07 },
    { id: "nl", name: "Netherlands", code: "nl", pools: 17, minPrice: 0.07 },
    { id: "cl", name: "Chile", code: "cl", pools: 18, minPrice: 5.95 },
    { id: "za", name: "South Africa", code: "za", pools: 17, minPrice: 0.49 },
    { id: "pt", name: "Portugal", code: "pt", pools: 22, minPrice: 6.02 },
    { id: "at", name: "Austria", code: "at", pools: 21, minPrice: 5.28 },
    { id: "tr", name: "Turkey", code: "tr", pools: 13, minPrice: 2.45 },
    { id: "de", name: "Germany", code: "de", pools: 14, minPrice: 0.60 }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("countryContainer");
  const searchInput = document.getElementById("searchInput");

  const urlParams = new URLSearchParams(window.location.search);
  const serviceSlug = urlParams.get("serviceSlug") || "whatsapp-1";
  const serviceName = urlParams.get("serviceName") || "WhatsApp";

  document.getElementById("serviceTitle").textContent = `Country selection for ${serviceName}`;

  // Get active country array for selected service (fallback to whatsapp-1)
  const currentCountries = servicesMap[serviceSlug] || servicesMap["whatsapp-1"];

  function render(filterText = "") {
    container.innerHTML = "";

    const filtered = currentCountries.filter((c) =>
      c.name.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach((country) => {
      const card = document.createElement("div");
      card.className = "country-card";

      card.onclick = () => {
        window.location.href = `offers.html?serviceSlug=${encodeURIComponent(serviceSlug)}&serviceName=${encodeURIComponent(serviceName)}&country=${encodeURIComponent(country.id)}&countryName=${encodeURIComponent(country.name)}&code=${country.code}`;
      };

      card.innerHTML = `
        <div class="country-info">
          <img src="https://flagcdn.com/w80/${country.code}.png" alt="${country.name}" class="country-flag" />
          <div class="country-details">
            <h4>${country.name}</h4>
            <p>${country.pools} number ${country.pools === 1 ? "pool" : "pools"}</p>
          </div>
        </div>
        <div class="price-badge">from $${country.minPrice.toFixed(2)}</div>
      `;

      container.appendChild(card);
    });
  }

  searchInput.addEventListener("input", (e) => render(e.target.value));
  render();
});
