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

  if (!tabsContainer || !contentContainer) {
    return;
  }

    loadFixtureCategories();
    loadMachineJobs();

    newJobButton?.addEventListener("click", openNewJobModal);
    newJobClose?.addEventListener("click", closeNewJobModal);
    newJobCancel?.addEventListener("click", closeNewJobModal);

    newJobModal?.addEventListener("click", (event) => {
    if (event.target === newJobModal) {
    closeNewJobModal();
    }
    });

    document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && newJobModal && !newJobModal.hidden) {
    closeNewJobModal();
    }
    });

    newJobCreate?.addEventListener("click", createNewJob);

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
                        <div class="job-card">
                            <b>${escapeHtml(job)}</b>
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

        } catch (error) {
            machineBoard.innerHTML = `
            <div class="fixture-status fixture-error">
                Unable to load machine jobs.
            </div>
            `;
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
                machine: machine,
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