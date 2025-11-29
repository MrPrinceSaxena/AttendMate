// Base URL for your API (same origin as server)
const API_BASE = "/api";

/* ----------------- DOM ELEMENTS ----------------- */
const form = document.getElementById("attendance-form");
const subjectsList = document.getElementById("subjects-list");

const resultCard = document.getElementById("result");
const resultSubjectName = document.getElementById("subject-name");
const resultCurrent = document.getElementById("current");
const resultBunk = document.getElementById("bunk");
const resultNeed = document.getElementById("need");
const resultMessage = document.getElementById("message");

/* ----------------- API FUNCTIONS ----------------- */

// Fetch all subjects from backend
async function fetchSubjects() {
  try {
    const res = await fetch(`${API_BASE}/subjects`);
    if (!res.ok) throw new Error("Failed to fetch subjects");
    const data = await res.json();
    renderSubjects(data);
  } catch (err) {
    console.error(err);
    subjectsList.innerHTML =
      "<p style='color:#f97373'>Error loading subjects. Check console.</p>";
  }
}

// Create a new subject
async function createSubject(subject) {
  const res = await fetch(`${API_BASE}/subjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subject)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to create subject");
  }

  return await res.json();
}

// Update a subject
async function updateSubject(id, updatedData) {
  const res = await fetch(`${API_BASE}/subjects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedData)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to update subject");
  }

  return await res.json();
}

// Delete a subject
async function deleteSubject(id) {
  const res = await fetch(`${API_BASE}/subjects/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to delete subject");
  }
}

/* ----------------- UI RENDERING ----------------- */

async function handleSubjectUpdate(subject, newTotal, newAttended) {
  try {
    const payload = {
      subjectName: subject.subjectName,
      requiredPercent: subject.requiredPercent,
      total: newTotal,
      attended: newAttended
    };

    const updated = await updateSubject(subject._id, payload);

    // Update local copy (not strictly needed since we re-fetch)
    subject.total = updated.total;
    subject.attended = updated.attended;

    await fetchSubjects(); // re-render with fresh stats
  } catch (err) {
    console.error(err);
    alert("Failed to update subject.");
  }
}

function renderSubjects(subjects) {
  subjectsList.innerHTML = "";

  if (!subjects.length) {
    subjectsList.innerHTML = "<p>No subjects yet. Add one above.</p>";
    return;
  }

  subjects.forEach((s) => {
    const div = document.createElement("div");
    div.className = "card subject-card";

    const isSafe = s.stats.currentPercent >= s.requiredPercent;

    div.innerHTML = `
      <div class="subject-header">
        <h3>${s.subjectName}</h3>
        <span class="badge">Target ${s.requiredPercent}%</span>
      </div>

      <p class="current-line">
        <span><strong>Current:</strong> ${s.stats.currentPercent}%</span>
        <span class="status-pill ${isSafe ? "status-safe" : "status-risk"}">
          ${isSafe ? "SAFE" : "LOW"}
        </span>
      </p>

      <p class="hint-line">${s.stats.message}</p>

      <div class="counters">
        <div class="counter">
          <div class="counter-label">Total classes</div>
          <div class="counter-controls">
            <button class="counter-btn btn-dec-total">−</button>
            <span class="counter-value value-total">${s.total}</span>
            <button class="counter-btn btn-inc-total">+</button>
          </div>
        </div>

        <div class="counter">
          <div class="counter-label">Attended</div>
          <div class="counter-controls">
            <button class="counter-btn btn-dec-attended">−</button>
            <span class="counter-value value-attended">${s.attended}</span>
            <button class="counter-btn btn-inc-attended">+</button>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <small>
          Can bunk: <strong>${s.stats.canBunk}</strong> ·
          Need to attend: <strong>${s.stats.needToAttend}</strong>
        </small>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    subjectsList.appendChild(div);

    // Grab buttons
    const incTotalBtn = div.querySelector(".btn-inc-total");
    const decTotalBtn = div.querySelector(".btn-dec-total");
    const incAttBtn = div.querySelector(".btn-inc-attended");
    const decAttBtn = div.querySelector(".btn-dec-attended");
    const deleteBtn = div.querySelector(".delete-btn");

    // + Total
    incTotalBtn.addEventListener("click", async () => {
      const newTotal = s.total + 1;
      const newAttended = s.attended; // unchanged
      await handleSubjectUpdate(s, newTotal, newAttended);
    });

    // − Total
    decTotalBtn.addEventListener("click", async () => {
      const newTotal = Math.max(0, s.total - 1);
      let newAttended = s.attended;
      if (newAttended > newTotal) newAttended = newTotal; // attended can't exceed total
      await handleSubjectUpdate(s, newTotal, newAttended);
    });

    // + Attended
    incAttBtn.addEventListener("click", async () => {
      // Attended cannot be more than total
      const newAttended = Math.min(s.total, s.attended + 1);
      await handleSubjectUpdate(s, s.total, newAttended);
    });

    // − Attended
    decAttBtn.addEventListener("click", async () => {
      const newAttended = Math.max(0, s.attended - 1);
      await handleSubjectUpdate(s, s.total, newAttended);
    });

    // Delete
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Delete subject "${s.subjectName}"?`)) return;
      try {
        await deleteSubject(s._id);
        await fetchSubjects();
      } catch (err) {
        console.error(err);
        alert("Failed to delete subject.");
      }
    });
  });
}

// Show result card for latest added subject
function showResultCard(subjectData) {
  if (!subjectData || !subjectData.stats) return;

  resultSubjectName.textContent = subjectData.subjectName || "Your Subject";
  resultCurrent.textContent = subjectData.stats.currentPercent;
  resultBunk.textContent = subjectData.stats.canBunk;
  resultNeed.textContent = subjectData.stats.needToAttend;
  resultMessage.textContent = subjectData.stats.message;

  resultCard.classList.remove("hidden");
}

/* ----------------- EVENT LISTENERS ----------------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const subjectName = document.getElementById("subject").value.trim();
  const total = document.getElementById("total").value;
  const attended = document.getElementById("attended").value;
  const requiredPercent = document.getElementById("required").value;

  if (!subjectName) {
    alert("Please enter a subject name.");
    return;
  }
  if (Number(attended) > Number(total)) {
    alert("Attended classes cannot be more than total classes.");
    return;
  }

  const payload = {
    subjectName,
    total: Number(total),
    attended: Number(attended),
    requiredPercent: Number(requiredPercent)
  };

  try {
    const created = await createSubject(payload);
    showResultCard(created);
    form.reset();
    document.getElementById("required").value = requiredPercent || 75;
    await fetchSubjects();
  } catch (err) {
    console.error(err);
    alert("Failed to save subject. Check server console.");
  }
});

/* ----------------- INITIAL LOAD ----------------- */

fetchSubjects();
