/* Shelf: a personal reading list.
   Plain JavaScript, no build step. Books live in localStorage, seeded on first visit. */

(() => {
  "use strict";

  const STORAGE_KEY = "shelf.books.v1";

  const STATUSES = [
    { id: "want", label: "Want to read" },
    { id: "reading", label: "Reading" },
    { id: "finished", label: "Finished" },
  ];

  const SEED_BOOKS = [
    { id: "piranesi", title: "Piranesi", author: "Susanna Clarke", status: "reading" },
    { id: "braiding-sweetgrass", title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", status: "reading" },
    { id: "thinking-in-systems", title: "Thinking in Systems", author: "Donella H. Meadows", status: "reading" },
    { id: "left-hand-of-darkness", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", status: "finished" },
    { id: "project-hail-mary", title: "Project Hail Mary", author: "Andy Weir", status: "finished" },
    { id: "tomorrow-x3", title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin", status: "finished" },
    { id: "the-overstory", title: "The Overstory", author: "Richard Powers", status: "want" },
    { id: "remains-of-the-day", title: "The Remains of the Day", author: "Kazuo Ishiguro", status: "want" },
    { id: "the-dispossessed", title: "The Dispossessed", author: "Ursula K. Le Guin", status: "want" },
  ];

  const grid = document.getElementById("book-grid");
  const summary = document.getElementById("shelf-summary");
  const addButton = document.getElementById("add-book-button");
  const addDialog = document.getElementById("add-dialog");
  const addForm = document.getElementById("add-form");
  const addError = document.getElementById("add-error");
  const shareDialog = document.getElementById("share-dialog");
  const shareCard = document.getElementById("share-card");
  const shareCover = document.getElementById("share-cover");
  const shareCardStatus = document.getElementById("share-card-status");
  const shareCardTitle = document.getElementById("share-card-title");
  const shareCardAuthor = document.getElementById("share-card-author");
  const shareCardNote = document.getElementById("share-card-note");
  const shareNote = document.getElementById("share-note");
  const shareNoteCount = document.getElementById("share-note-count");
  const shareLink = document.getElementById("share-link");
  const copyButton = document.getElementById("copy-link");
  const copyStatus = document.getElementById("copy-status");

  const SHARE_STATUS_LABELS = { want: "On my list", reading: "Currently reading", finished: "Just finished" };
  const EMPTY_NOTE = "Add a note and it will appear here.";

  let books = loadBooks();
  let copyResetTimer = 0;

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

  /* ---------- Helpers ---------- */

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
        <div class="book-footer">
          <span class="status" data-status="${book.status}">
            <select data-action="status" aria-label="Status of ${title}">${options}</select>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>
          </span>
          <button type="button" class="share-button" data-action="share" aria-label="Share ${title}" title="Share">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 12.5V3M6.5 6.5L10 3l3.5 3.5M5.5 9.5H5A1.5 1.5 0 003.5 11v4.5A1.5 1.5 0 005 17h10a1.5 1.5 0 001.5-1.5V11A1.5 1.5 0 0015 9.5h-.5" /></svg>
          </button>
        </div>
      </div>
    `;
    return card;
  }

  function render() {
    grid.replaceChildren(...books.map(createCard));
    renderSummary();
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
    book.status = status;
    saveBooks();

    const card = replaceCard(book, "book--changed");
    card?.querySelector('[data-action="status"]')?.focus();
    renderSummary();
  }

  function addBook({ title, author, status }) {
    const book = { id: newId(title), title, author, status };
    books.unshift(book);
    saveBooks();

    const card = createCard(book);
    card.classList.add("book--new");
    grid.prepend(card);
    renderSummary();
  }

  /* ---------- Share ---------- */

  function bookLink(book) {
    return `${location.origin}${location.pathname}#book=${encodeURIComponent(book.id)}`;
  }

  function renderShareNote() {
    const note = shareNote.value.trim();
    shareCardNote.textContent = note || EMPTY_NOTE;
    shareCardNote.classList.toggle("is-empty", !note);
    shareNoteCount.textContent = `${shareNote.value.length} / ${shareNote.maxLength}`;
  }

  function resetCopyButton() {
    clearTimeout(copyResetTimer);
    copyButton.classList.remove("is-copied");
    copyButton.querySelector(".copy-label").textContent = "Copy link";
    copyStatus.textContent = "";
  }

  function openShare(id) {
    const book = books.find((b) => b.id === id);
    if (!book) return;

    shareCard.setAttribute("style", coverStyle(book.title));
    shareCover.setAttribute("style", coverStyle(book.title));
    shareCover.querySelector(".cover-title").textContent = book.title;
    shareCover.querySelector(".cover-author").textContent = lastName(book.author);
    shareCardStatus.textContent = SHARE_STATUS_LABELS[book.status] || "";
    shareCardTitle.textContent = book.title;
    shareCardAuthor.textContent = book.author;

    shareNote.value = "";
    shareLink.value = bookLink(book);
    renderShareNote();
    resetCopyButton();

    shareDialog.showModal();
    shareNote.focus();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API can be blocked (permissions, insecure context): fall back to a selection copy.
      shareLink.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      }
    }
  }

  async function copyShareLink() {
    const copied = await copyText(shareLink.value);
    clearTimeout(copyResetTimer);
    if (copied) {
      copyButton.classList.add("is-copied");
      copyButton.querySelector(".copy-label").textContent = "Link copied";
      copyStatus.textContent = "Link copied to your clipboard.";
      copyResetTimer = setTimeout(resetCopyButton, 2400);
    } else {
      shareLink.select();
      copyStatus.textContent = "Couldn't copy automatically. The link is selected, so copy it with your keyboard.";
    }
  }

  // Opening a shared link (…#book=piranesi) scrolls to that book and highlights it.
  function highlightLinkedBook() {
    const match = location.hash.match(/^#book=(.+)$/);
    if (!match) return;
    const card = grid.querySelector(`[data-id="${CSS.escape(decodeURIComponent(match[1]))}"]`);
    if (!card) return;
    card.scrollIntoView({ block: "center" });
    card.classList.add("book--changed");
  }

  /* ---------- Events ---------- */

  grid.addEventListener("change", (event) => {
    const select = event.target.closest('[data-action="status"]');
    if (!select) return;
    setStatus(select.closest(".book").dataset.id, select.value);
  });

  grid.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="share"]');
    if (button) openShare(button.closest(".book").dataset.id);
  });

  shareNote.addEventListener("input", renderShareNote);
  copyButton.addEventListener("click", copyShareLink);
  shareLink.addEventListener("focus", () => shareLink.select());

  shareDialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]") || event.target === shareDialog) shareDialog.close();
  });

  shareDialog.addEventListener("close", resetCopyButton);

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

    if (!title || !author) {
      addError.textContent = !title ? "Give the book a title." : "Who wrote it? Add an author.";
      (!title ? addForm.elements.title : addForm.elements.author).focus();
      return;
    }

    addBook({ title, author, status });
    addDialog.close();
  });

  render();
  highlightLinkedBook();
})();
