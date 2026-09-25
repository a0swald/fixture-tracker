document.addEventListener("DOMContentLoaded", () => {
  const tabsContainer = document.getElementById("fixture-category-tabs");
  const contentContainer = document.getElementById("fixture-category-content");
  const machineBoard = document.getElementById("machine-board");

  const newJobButton = document.getElementById("new-job-button");
  const newJobModal = document.getElementById("new-job-modal");
  const newJobClose = document.getElementById("new-job-close");
  const newJobCancel = document.getElementById("new-job-cancel");
  const newJobName = document.getElementById("new-job-name");
  const newJobMachine = document.getElementById("new-job-machine");
  const newJobCreate = document.getElementById("new-job-create");
  const newJobError = document.getElementById("new-job-error");

    let activeCategory = null;
    let activeDrag = null;

  if (!tabsContainer || !contentContainer) {
    return;
  }

  loadFixtureCategories();
  loadMachineJobs();

  setupFixturePoolDropTarget();

  newJobButton?.addEventListener("click", openNewJobModal);
  newJobClose?.addEventListener("click", closeNewJobModal);
  newJobCancel?.addEventListener("click", closeNewJobModal);
  newJobCreate?.addEventListener("click", createNewJob);

  newJobModal?.addEventListener("click", (event) => {
    if (event.target === newJobModal) {
      closeNewJobModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      newJobModal &&
      !newJobModal.hidden
    ) {
      closeNewJobModal();
    }

    if (event.key === "Escape") {
      closeFixturePreview();
    }
  });

  newJobName?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      createNewJob();
    }
  });

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
    activeCategory = category;

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
            <p>
              There are currently no fixtures in
              ${escapeHtml(category)}.
            </p>
          </div>
        `;
        return;
      }

      contentContainer.innerHTML = `
        <div class="fixture-grid">
            ${items.map((item) => {
            const imageUrl =
                `/api/fixture-pool/${encodeURIComponent(category)}` +
                `/media/${encodeURIComponent(item.name)}`;

            return `
                <div
                class="fixture-card fixture-card-available"
                draggable="true"
                data-fixture="${escapeHtml(item.stem)}"
                data-category="${escapeHtml(category)}"
                data-image="${imageUrl}"
                title="Drag to assign • Click to view image"
                >
                <img
                    class="fixture-card-image"
                    src="${imageUrl}"
                    alt="${escapeHtml(item.stem)}"
                    draggable="false"
                >

                <div class="fixture-card-info">
                    <b>${escapeHtml(item.stem)}</b>
                    <small>${escapeHtml(category)}</small>
                </div>
                </div>
            `;
            }).join("")}
        </div>
        `;

      setupFixtureDragging();
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

  async function refreshActiveCategory() {
    if (!activeCategory) {
      return;
    }

    const activeButton = Array.from(
      document.querySelectorAll(".fixture-category-tab")
    ).find((button) => button.textContent === activeCategory);

    if (activeButton) {
      await selectCategory(activeButton, activeCategory);
    }
  }

  async function loadMachineJobs() {
    if (!machineBoard) {
      return;
    }

    try {
      const response = await fetch("/api/machine-jobs");

      if (!response.ok) {
        throw new Error("Unable to load machine jobs.");
      }

      const data = await response.json();
      const machines = data.machines || [];

      if (machines.length === 0) {
        machineBoard.innerHTML = `
          <div class="fixture-status">
            No machine folders found.
          </div>
        `;
        return;
      }

      machineBoard.innerHTML = machines.map((machine) => `
        <div class="machine-column">
          <div class="machine-column-header">
            <b>${escapeHtml(machine.name)}</b>
            <small>
              ${machine.jobs.length}
              ${machine.jobs.length === 1 ? "job" : "jobs"}
            </small>
          </div>

          <div class="machine-jobs">
            ${
              machine.jobs.length
                ? machine.jobs.map((job) => `
                    <div
                      class="job-card"
                      data-machine="${escapeHtml(machine.name)}"
                      data-job="${escapeHtml(job.name)}"
                    >
                      <div class="job-card-header">
                        <b>${escapeHtml(job.name)}</b>
                      </div>

                      <div class="job-fixtures">
                        ${
                          job.fixtures.length
                            ? job.fixtures.map((fixture) => `
                                <div
                                class="assigned-fixture"
                                draggable="true"
                                role="button"
                                tabindex="0"
                                data-fixture="${escapeHtml(fixture.fixture)}"
                                data-category="${escapeHtml(fixture.category)}"
                                data-machine="${escapeHtml(machine.name)}"
                                data-job="${escapeHtml(job.name)}"
                                title="Click to view • Drag to Fixture Pool to return"
                                >
                                    <b>${escapeHtml(fixture.fixture)}</b>
                                    <small>
                                        ${escapeHtml(fixture.category)}
                                    </small>
                                </div>
                              `).join("")
                            : `
                                <div class="job-drop-empty">
                                  Drop fixture here
                                </div>
                              `
                        }
                      </div>
                    </div>
                  `).join("")
                : `
                    <div class="machine-empty">
                      No running jobs
                    </div>
                  `
            }
          </div>
        </div>
      `).join("");

      setupJobDropTargets();
      setupAssignedFixtures();
    } catch (error) {
      machineBoard.innerHTML = `
        <div class="fixture-status fixture-error">
          Unable to load machine jobs.
        </div>
      `;
    }
  }

  function setupFixtureDragging() {
    document.querySelectorAll(".fixture-card").forEach((card) => {
        let didDrag = false;

        card.addEventListener("dragstart", (event) => {
        didDrag = true;

        const fixture = card.dataset.fixture;
        const category = card.dataset.category;

        activeDrag = {
            source: "fixture-pool",
            fixture,
            category
        };

        event.dataTransfer.effectAllowed = "move";

        event.dataTransfer.setData(
            "application/json",
            JSON.stringify(activeDrag)
        );

        card.classList.add("dragging");
        });

        card.addEventListener("dragend", () => {
        card.classList.remove("dragging");

        document
            .querySelectorAll(".job-card.drop-target")
            .forEach((jobCard) => {
            jobCard.classList.remove("drop-target");
            });

        activeDrag = null;

        window.setTimeout(() => {
            didDrag = false;
        }, 0);
        });

        card.addEventListener("click", () => {
        if (didDrag) {
            return;
        }

        openFixturePreview({
            fixture: card.dataset.fixture,
            category: card.dataset.category,
            imageUrl: card.dataset.image
        });
        });
    });
    }

  function setupAssignedFixtures() {
    document.querySelectorAll(".assigned-fixture").forEach((fixture) => {
        let didDrag = false;

        fixture.addEventListener("dragstart", (event) => {
        didDrag = true;

        activeDrag = {
            source: "assigned",
            fixture: fixture.dataset.fixture,
            category: fixture.dataset.category,
            machine: fixture.dataset.machine,
            jobName: fixture.dataset.job
        };

        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";

        event.dataTransfer.setData(
            "application/json",
            JSON.stringify(activeDrag)
        );

        fixture.classList.add("dragging");
        });

        fixture.addEventListener("dragend", () => {
        fixture.classList.remove("dragging");

        clearFixturePoolDropState();

        activeDrag = null;

        window.setTimeout(() => {
            didDrag = false;
        }, 0);
        });

        fixture.addEventListener("click", () => {
        if (didDrag) {
            return;
        }

        const fixtureName = fixture.dataset.fixture;
        const category = fixture.dataset.category;
        const machine = fixture.dataset.machine;
        const jobName = fixture.dataset.job;

        const imageUrl =
            `/api/fixture-pool/${encodeURIComponent(category)}` +
            `/media/${encodeURIComponent(fixtureName)}.jpg`;

        openFixturePreview({
            fixture: fixtureName,
            category,
            imageUrl,
            machine,
            jobName,
            assigned: true
        });
        });
    });
    }

  function setupFixturePoolDropTarget() {
    const fixturePool = contentContainer.closest(".fixture-pool");

    if (!fixturePool) {
        return;
    }

    fixturePool.addEventListener("dragover", (event) => {
        if (!activeDrag || activeDrag.source !== "assigned") {
        return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";

        fixturePool.classList.add("fixture-pool-drop-target");
    });

    fixturePool.addEventListener("dragleave", (event) => {
        if (!fixturePool.contains(event.relatedTarget)) {
        clearFixturePoolDropState();
        }
    });

    fixturePool.addEventListener("drop", async (event) => {
        if (!activeDrag || activeDrag.source !== "assigned") {
        return;
        }

        event.preventDefault();
        event.stopPropagation();

        const fixtureToReturn = { ...activeDrag };

        clearFixturePoolDropState();

        await releaseFixture(
        fixtureToReturn.fixture,
        fixtureToReturn.machine,
        fixtureToReturn.jobName,
        false
        );
    });
    }

  function clearFixturePoolDropState() {
    const fixturePool = contentContainer.closest(".fixture-pool");

    fixturePool?.classList.remove("fixture-pool-drop-target");
  }

  function getDragData(event) {
    const rawData =
        event.dataTransfer.getData("application/json");

    if (!rawData) {
        return null;
    }

    try {
        return JSON.parse(rawData);
    } catch {
        return null;
    }
    }

  function setupJobDropTargets() {
    document.querySelectorAll(".job-card").forEach((jobCard) => {
        jobCard.addEventListener("dragover", (event) => {
        if (!activeDrag || activeDrag.source !== "fixture-pool") {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";

        jobCard.classList.add("drop-target");
        });

        jobCard.addEventListener("dragleave", (event) => {
        if (!jobCard.contains(event.relatedTarget)) {
            jobCard.classList.remove("drop-target");
        }
        });

        jobCard.addEventListener("drop", async (event) => {
        if (!activeDrag || activeDrag.source !== "fixture-pool") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const fixtureToAssign = { ...activeDrag };

        jobCard.classList.remove("drop-target");

        await assignFixtureToJob(
            fixtureToAssign.fixture,
            fixtureToAssign.category,
            jobCard.dataset.machine,
            jobCard.dataset.job
        );
        });
    });
    }

  async function assignFixtureToJob(
    fixture,
    category,
    machine,
    jobName
  ) {
    try {
      const response = await fetch("/api/fixture-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fixture,
          category,
          machine,
          job_name: jobName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to assign fixture."
        );
      }

      await loadMachineJobs();
      await refreshActiveCategory();
    } catch (error) {
      alert(error.message);
    }
  }

  function openFixturePreview({
    fixture,
    category,
    imageUrl,
    machine = null,
    jobName = null,
    assigned = false
  }) {
    closeFixturePreview();

    const modal = document.createElement("div");

    modal.id = "fixture-preview-modal";
    modal.className = "fixture-preview-backdrop";

    const assignmentMarkup = assigned
      ? `
          <div class="fixture-preview-assignment">
            <span>Assigned To</span>
            <b>
              ${escapeHtml(machine)} / ${escapeHtml(jobName)}
            </b>
          </div>
        `
      : "";

    const footerMarkup = assigned
      ? `
          <div class="fixture-preview-footer">
            <button
              class="button-secondary fixture-preview-cancel"
              type="button"
            >
              Close
            </button>

            <button
              class="button fixture-release-button"
              type="button"
            >
              Return to Fixture Pool
            </button>
          </div>
        `
      : "";

    modal.innerHTML = `
      <div
        class="fixture-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="${escapeHtml(fixture)} fixture image"
      >
        <div class="fixture-preview-header">
          <div>
            <b>${escapeHtml(fixture)}</b>
            <small>${escapeHtml(category)}</small>
          </div>

          <button
            class="fixture-preview-close"
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        ${assignmentMarkup}

        <div class="fixture-preview-image">
          <img
            src="${imageUrl}"
            alt="${escapeHtml(fixture)}"
          >
        </div>

        ${footerMarkup}
      </div>
    `;

    document.body.appendChild(modal);

    modal
      .querySelector(".fixture-preview-close")
      ?.addEventListener("click", closeFixturePreview);

    modal
      .querySelector(".fixture-preview-cancel")
      ?.addEventListener("click", closeFixturePreview);

    modal
      .querySelector(".fixture-release-button")
      ?.addEventListener("click", async () => {
        await releaseFixture(
          fixture,
          machine,
          jobName,
          true
        );
      });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeFixturePreview();
      }
    });
  }

  function closeFixturePreview() {
    document.getElementById("fixture-preview-modal")?.remove();
  }

  async function releaseFixture(
    fixture,
    machine,
    jobName,
    fromPreview = false
  ) {
    const releaseButton =
      document.querySelector(".fixture-release-button");

    if (fromPreview && releaseButton) {
      releaseButton.disabled = true;
      releaseButton.textContent = "Returning...";
    }

    try {
      const url =
        `/api/fixture-assignments/` +
        `${encodeURIComponent(machine)}/` +
        `${encodeURIComponent(jobName)}/` +
        `${encodeURIComponent(fixture)}`;

      const response = await fetch(url, {
        method: "DELETE"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to return fixture."
        );
      }

      if (fromPreview) {
        closeFixturePreview();
      }

      await loadMachineJobs();
      await refreshActiveCategory();
    } catch (error) {
      alert(error.message);

      if (fromPreview && releaseButton) {
        releaseButton.disabled = false;
        releaseButton.textContent = "Return to Fixture Pool";
      }
    }
  }

  async function openNewJobModal() {
    if (!newJobModal || !newJobMachine || !newJobName) {
      return;
    }

    newJobName.value = "";
    newJobMachine.innerHTML =
      '<option value="">Select a machine...</option>';

    try {
      const response = await fetch("/api/machine-jobs");

      if (!response.ok) {
        throw new Error("Unable to load machines.");
      }

      const data = await response.json();

      data.machines.forEach((machine) => {
        const option = document.createElement("option");

        option.value = machine.name;
        option.textContent = machine.name;

        newJobMachine.appendChild(option);
      });

      newJobModal.hidden = false;

      requestAnimationFrame(() => {
        newJobName.focus();
      });
    } catch (error) {
      alert("Unable to load machines.");
    }
  }

  function closeNewJobModal() {
    if (!newJobModal) {
      return;
    }

    newJobModal.hidden = true;
  }

  async function createNewJob() {
    const jobName = newJobName.value.trim();
    const machine = newJobMachine.value;

    newJobError.hidden = true;
    newJobError.textContent = "";

    if (!jobName || !machine) {
      newJobError.textContent =
        "Enter a job number/name and select a machine.";

      newJobError.hidden = false;
      return;
    }

    newJobCreate.disabled = true;
    newJobCreate.textContent = "Creating...";

    try {
      const response = await fetch("/api/machine-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          machine,
          job_name: jobName
        })
      });

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.detail || "Unable to create job."
        );
      }

      closeNewJobModal();
      await loadMachineJobs();
    } catch (error) {
      newJobError.textContent = error.message;
      newJobError.hidden = false;
    } finally {
      newJobCreate.disabled = false;
      newJobCreate.textContent = "Create Job";
    }
  }

  function escapeHtml(value) {
    const element = document.createElement("div");

    element.textContent = value;

    return element.innerHTML;
  }
});