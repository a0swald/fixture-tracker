document.addEventListener("DOMContentLoaded", () => {
  const tabsContainer = document.getElementById("fixture-category-tabs");
  const contentContainer = document.getElementById("fixture-category-content");

  if (!tabsContainer || !contentContainer) {
    return;
  }

  loadFixtureCategories();

  async function loadFixtureCategories() {
    try {
      const response = await fetch("/api/fixture-pool/categories");

      if (!response.ok) {
        throw new Error("Unable to load fixture categories.");
      }

      const data = await response.json();
      const categories = data.categories || [];

      if (categories.length === 0) {
        tabsContainer.innerHTML =
          '<span class="fixture-loading">No fixture categories found.</span>';
        return;
      }

      tabsContainer.innerHTML = "";

      categories.forEach((category, index) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "fixture-category-tab";
        button.textContent = category;

        button.addEventListener("click", () => {
          selectCategory(button, category);
        });

        tabsContainer.appendChild(button);

        if (index === 0) {
          selectCategory(button, category);
        }
      });
    } catch (error) {
      tabsContainer.innerHTML =
        '<span class="fixture-loading fixture-error">Unable to load fixture categories.</span>';
    }
  }

  async function selectCategory(button, category) {
    document
        .querySelectorAll(".fixture-category-tab")
        .forEach((tab) => tab.classList.remove("active"));

    button.classList.add("active");

    contentContainer.innerHTML = `
        <div class="fixture-status">
        Loading ${escapeHtml(category)} fixtures...
        </div>
    `;

    try {
        const response = await fetch(
        `/api/fixture-pool/${encodeURIComponent(category)}`
        );

        if (!response.ok) {
        throw new Error("Unable to load fixtures.");
        }

        const data = await response.json();
        const items = data.items || [];

        if (items.length === 0) {
        contentContainer.innerHTML = `
            <div class="empty">
            <div class="empty-icon">▦</div>
            <h2>No fixtures available</h2>
            <p>There are currently no fixtures in ${escapeHtml(category)}.</p>
            </div>
        `;
        return;
        }

        contentContainer.innerHTML = `
        <div class="fixture-grid">
            ${items.map((item) => `
            <div class="fixture-card">
                <div class="fixture-card-preview">
                    <img
                        src="/api/fixture-pool/${encodeURIComponent(category)}/media/${encodeURIComponent(item.name)}"
                        alt="${escapeHtml(item.stem)}"
                        loading="lazy"
                    >
                </div>

                <div class="fixture-card-info">
                <b>${escapeHtml(item.stem)}</b>
                <small>${escapeHtml(category)}</small>
                </div>
            </div>
            `).join("")}
        </div>
        `;
    } catch (error) {
        contentContainer.innerHTML = `
        <div class="empty">
            <div class="empty-icon">!</div>
            <h2>Unable to load fixtures</h2>
            <p>The fixture folder could not be read.</p>
        </div>
        `;
    }
    }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
  }
});