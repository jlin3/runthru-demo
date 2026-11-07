/* Shelf: a personal reading list.
   Plain JavaScript, no build step. Books live in localStorage, seeded on first visit. */

(() => {
  "use strict";

  // v2 adds page counts and finish dates.
  const STORAGE_KEY = "shelf.books.v2";
  const YEARLY_GOAL = 24;
  const PAGE_STEP = 10;
  const THIS_YEAR = new Date().getFullYear();

  const STATUSES = [
    { id: "want", label: "Want to read" },
    { id: "reading", label: "Reading" },
    { id: "finished", label: "Finished" },
  ];

  const SEED_BOOKS = [
    { id: "piranesi", title: "Piranesi", author: "Susanna Clarke", status: "reading", pages: 272, currentPage: 148 },
    { id: "braiding-sweetgrass", title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", status: "reading", pages: 391, currentPage: 96 },
    { id: "thinking-in-systems", title: "Thinking in Systems", author: "Donella H. Meadows", status: "reading", pages: 240, currentPage: 220 },
    { id: "left-hand-of-darkness", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", status: "finished", pages: 304, finishedOn: `${THIS_YEAR}-02-11` },
    { id: "project-hail-mary", title: "Project Hail Mary", author: "Andy Weir", status: "finished", pages: 476, finishedOn: `${THIS_YEAR}-05-02` },
    { id: "tomorrow-x3", title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin", status: "finished", pages: 401, finishedOn: `${THIS_YEAR}-08-19` },
    { id: "the-overstory", title: "The Overstory", author: "Richard Powers", status: "want", pages: 502 },
    { id: "remains-of-the-day", title: "The Remains of the Day", author: "Kazuo Ishiguro", status: "want", pages: 245 },
    { id: "the-dispossessed", title: "The Dispossessed", author: "Ursula K. Le Guin", status: "want", pages: 387 },
  ];

  const grid = document.getElementById("book-grid");
  const summary = document.getElementById("shelf-summary");
  const addButton = document.getElementById("add-book-button");
  const addDialog = document.getElementById("add-dialog");
  const addForm = document.getElementById("add-form");
  const addError = document.getElementById("add-error");
  const goal = document.getElementById("goal");
  const goalFill = document.getElementById("goal-fill");
  const goalCount = document.getElementById("goal-count");

  let books = loadBooks().map(withProgress);

  /* ---------- Storage ---------- */

  function loadBooks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* fall through to seed data */
    }
    return SEED_BOOKS.map((book) => ({ ...book }));
  }

  function saveBooks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch {
      /* storage can be unavailable (private mode); the UI still works in memory */
    }
  }

  // Fill in reading-progress fields so every book can be rendered safely.
  function withProgress(book) {
    const pages = Math.max(1, Math.round(Number(book.pages) || 300));
    const finished = book.status === "finished";
    const currentPage = finished ? pages : clamp(Math.round(Number(book.currentPage) || 0), 0, pages);
    return { ...book, pages, currentPage, finishedOn: finished ? book.finishedOn || today() : null };
  }

  /* ---------- Helpers ---------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDay(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function percentRead(book) {
    return Math.round((book.currentPage / book.pages) * 100);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // FNV-1a: small, stable string hash so a title always gets the same cover.
  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  // Hand-picked cover colours (top, bottom). The title hash picks one, so covers stay calm and legible.
  const COVER_PALETTE = [
    ["hsl(184 46% 36%)", "hsl(204 55% 19%)"], // teal
    ["hsl(292 24% 42%)", "hsl(312 34% 21%)"], // plum
    ["hsl(212 26% 46%)", "hsl(222 34% 22%)"], // slate
    ["hsl(76 30% 38%)", "hsl(108 32% 18%)"], // moss
    ["hsl(224 54% 50%)", "hsl(240 48% 24%)"], // cobalt
    ["hsl(344 44% 50%)", "hsl(330 40% 24%)"], // rose
    ["hsl(256 34% 50%)", "hsl(266 40% 24%)"], // indigo
    ["hsl(200 18% 32%)", "hsl(214 28% 13%)"], // ink
    ["hsl(152 38% 34%)", "hsl(172 48% 16%)"], // forest
    ["hsl(26 46% 42%)", "hsl(10 42% 20%)"], // sienna
    ["hsl(38 64% 47%)", "hsl(20 56% 26%)"], // ochre
    ["hsl(6 50% 45%)", "hsl(350 44% 22%)"], // brick
  ];

  function coverStyle(title) {
    const hash = hashString(title.trim().toLowerCase());
    const [top, bottom] = COVER_PALETTE[(hash >>> 2) % COVER_PALETTE.length];
    const x = 20 + ((hash >>> 9) % 70);
    const y = 45 + ((hash >>> 13) % 50);
    const size = 56 + ((hash >>> 17) % 50);
    // Shrink the cover type when the longest word would not fit on one line.
    const longestWord = Math.max(...title.split(/\s+/).map((word) => word.length));
    const titleSize = Math.min(12.5, 120 / Math.max(longestWord, 1));
    return [
      `--cover-a: ${top}`,
      `--cover-b: ${bottom}`,
      `--motif-x: ${x}%`,
      `--motif-y: ${y}%`,
      `--motif-size: ${size}px`,
      `--cover-title-size: ${titleSize.toFixed(1)}px`,
    ].join("; ");
  }

  const NAME_PARTICLES = new Set(["le", "la", "de", "du", "da", "di", "van", "von", "der", "del"]);

  // "Ursula K. Le Guin" -> "Le Guin", "Andy Weir" -> "Weir"
  function lastName(author) {
    const parts = author.trim().split(/\s+/);
    let start = parts.length - 1;
    while (start > 1 && NAME_PARTICLES.has(parts[start - 1].toLowerCase())) start--;
    return parts.slice(start).join(" ");
  }

  function newId(title) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `${slug || "book"}-${Date.now().toString(36)}`;
  }

  /* ---------- Reading progress ---------- */

  function progressMarkup(book) {
    const pct = percentRead(book);
    return `
      <div class="progress" data-role="progress">
        <div class="progress-meta">
          <span>Page <strong data-role="current-page">${book.currentPage}</strong> of ${book.pages}</span>
          ${stepperMarkup(book)}
        </div>
        <div class="progress-bar-row">
          <div class="progress-track" role="progressbar" aria-label="Reading progress for ${escapeHtml(book.title)}"
            aria-valuemin="0" aria-valuemax="${book.pages}" aria-valuenow="${book.currentPage}"
            aria-valuetext="Page ${book.currentPage} of ${book.pages}">
            <div class="progress-fill" style="--progress: ${pct}%"></div>
          </div>
          <span class="progress-percent" data-role="percent">${pct}%</span>
        </div>
      </div>
    `;
  }

  function stepperMarkup(book) {
    const title = escapeHtml(book.title);
    return `
      <div class="stepper">
        <button type="button" data-action="pages" data-delta="-${PAGE_STEP}" aria-label="Back ${PAGE_STEP} pages on ${title}"
          ${book.currentPage <= 0 ? "disabled" : ""}>−${PAGE_STEP}</button>
        ${book.currentPage >= book.pages
          ? `<button type="button" class="finish" data-action="finish" aria-label="Mark ${title} as finished">Finish</button>`
          : `<button type="button" data-action="pages" data-delta="${PAGE_STEP}" aria-label="Forward ${PAGE_STEP} pages on ${title}">+${PAGE_STEP}</button>`}
      </div>
    `;
  }

  // Update the bar in place (no re-render) so the width change animates.
  function updateProgress(card, book) {
    const pct = percentRead(book);
    card.querySelector('[data-role="current-page"]').textContent = book.currentPage;
    card.querySelector('[data-role="percent"]').textContent = `${pct}%`;
    card.querySelector(".progress-fill").style.setProperty("--progress", `${pct}%`);

    const bar = card.querySelector('[role="progressbar"]');
    bar.setAttribute("aria-valuenow", book.currentPage);
    bar.setAttribute("aria-valuetext", `Page ${book.currentPage} of ${book.pages}`);

    // At the last page, "+10" becomes "Mark as finished" (and back again if you step back).
    card.querySelector(".stepper").outerHTML = stepperMarkup(book);
    card.querySelector('[data-role="progress"]').classList.toggle("progress--done", book.currentPage >= book.pages);
  }

  function changePages(id, delta) {
    const book = books.find((b) => b.id === id);
    if (!book || book.status !== "reading") return;
    book.currentPage = clamp(book.currentPage + delta, 0, book.pages);
    saveBooks();

    const card = grid.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (card) updateProgress(card, book);

    if (book.currentPage >= book.pages) card?.querySelector('[data-action="finish"]')?.focus();
  }

  function renderGoal({ animate = false } = {}) {
    const done = books.filter((b) => b.status === "finished" && b.finishedOn?.startsWith(String(THIS_YEAR))).length;
    const previous = Number(goal.dataset.count ?? done);
    goal.dataset.count = done;
    goalCount.textContent = `${done} of ${YEARLY_GOAL}`;
    goalFill.style.strokeDashoffset = String(100 - Math.min(100, (done / YEARLY_GOAL) * 100));
    goal.setAttribute("aria-label", `Yearly goal: ${done} of ${YEARLY_GOAL} books finished in ${THIS_YEAR}`);

    if (animate && done > previous) {
      goal.classList.remove("goal--bump");
      void goal.offsetWidth; // restart the animation
      goal.classList.add("goal--bump");
    }
  }

  /* ---------- Rendering ---------- */

  function createCard(book) {
    const card = document.createElement("article");
    card.className = "book";
    card.dataset.id = book.id;
    card.setAttribute("aria-label", `${book.title} by ${book.author}`);

    const title = escapeHtml(book.title);
    const options = STATUSES.map(
      (s) => `<option value="${s.id}"${s.id === book.status ? " selected" : ""}>${s.label}</option>`
    ).join("");

    card.innerHTML = `
      <div class="cover" style="${coverStyle(book.title)}" aria-hidden="true">
        <span class="cover-title">${title}</span>
        <span class="cover-author">${escapeHtml(lastName(book.author))}</span>
      </div>
      <div class="book-body">
        <h3 class="book-title">${title}</h3>
        <p class="book-author">${escapeHtml(book.author)}</p>
        ${book.status === "reading" ? progressMarkup(book) : ""}
        <div class="book-footer">
          <span class="status" data-status="${book.status}">
            <select data-action="status" aria-label="Status of ${title}">${options}</select>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>
          </span>
          ${book.status === "finished" && book.finishedOn ? `<time class="book-note" datetime="${book.finishedOn}">${formatDay(book.finishedOn)}</time>` : ""}
        </div>
      </div>
    `;
    return card;
  }

  function render() {
    grid.replaceChildren(...books.map(createCard));
    renderSummary();
    renderGoal();
  }

  function renderSummary() {
    const reading = books.filter((b) => b.status === "reading").length;
    const noun = books.length === 1 ? "book" : "books";
    summary.textContent = `${books.length} ${noun} · ${reading} reading now`;
  }

  function replaceCard(book, className) {
    const current = grid.querySelector(`[data-id="${CSS.escape(book.id)}"]`);
    if (!current) return null;
    const next = createCard(book);
    if (className) next.classList.add(className);
    current.replaceWith(next);
    return next;
  }

  /* ---------- Actions ---------- */

  function setStatus(id, status) {
    const book = books.find((b) => b.id === id);
    if (!book || book.status === status) return;
    const previous = book.status;
    book.status = status;
    if (status === "finished") {
      book.currentPage = book.pages;
      book.finishedOn = today();
    } else {
      book.finishedOn = null;
      if (previous === "finished") book.currentPage = 0;
    }
    saveBooks();

    const card = replaceCard(book, "book--changed");
    card?.querySelector('[data-action="status"]')?.focus();
    renderSummary();
    renderGoal({ animate: true });
  }

  function addBook({ title, author, status, pages }) {
    const book = withProgress({ id: newId(title), title, author, status, pages, currentPage: 0 });
    books.unshift(book);
    saveBooks();

    const card = createCard(book);
    card.classList.add("book--new");
    grid.prepend(card);
    renderSummary();
    renderGoal({ animate: true });
  }

  /* ---------- Events ---------- */

  grid.addEventListener("change", (event) => {
    const select = event.target.closest('[data-action="status"]');
    if (!select) return;
    setStatus(select.closest(".book").dataset.id, select.value);
  });

  grid.addEventListener("click", (event) => {
    const finish = event.target.closest('[data-action="finish"]');
    if (finish) return setStatus(finish.closest(".book").dataset.id, "finished");
    const button = event.target.closest('[data-action="pages"]');
    if (!button) return;
    changePages(button.closest(".book").dataset.id, Number(button.dataset.delta));
  });

  addButton.addEventListener("click", () => {
    addForm.reset();
    addError.textContent = "";
    addDialog.showModal();
    addForm.elements.title.focus();
  });

  addDialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]") || event.target === addDialog) addDialog.close();
  });

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(addForm);
    const title = String(data.get("title") || "").trim();
    const author = String(data.get("author") || "").trim();
    const status = String(data.get("status") || "want");
    const pages = Number(data.get("pages")) || 300;

    if (!title || !author) {
      addError.textContent = !title ? "Give the book a title." : "Who wrote it? Add an author.";
      (!title ? addForm.elements.title : addForm.elements.author).focus();
      return;
    }

    addBook({ title, author, status, pages });
    addDialog.close();
  });

  render();
})();
