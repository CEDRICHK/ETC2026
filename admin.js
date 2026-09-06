(function () {
  "use strict";

  const NTFY_SERVERS = [
    "https://ntfy.tedomum.fr",
    "https://ntfy.hostux.net"
  ];
  const PIN_KEY = "etc2026AdminPinHash";
  const SESSION_KEY = "etc2026AdminSession";
  const HISTORY_KEY = "etc2026AdminHistory";
  const questions = window.ETC_QUESTIONS;
  const pinGate = document.getElementById("pinGate");
  const dashboard = document.getElementById("dashboard");
  let sessionData = null;
  let currentVotes = [];
  let pollBusy = false;

  function code() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, value => chars[value % chars.length]).join("");
  }

  function defaultEpochs() {
    return Object.fromEntries(questions.map(question => [question.id, 1]));
  }

  function topic(kind) {
    return `etc2026-${sessionData.code.toLowerCase()}-${kind}`;
  }

  function fetchWithTimeout(url, options = {}, timeout = 6000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => window.clearTimeout(timer));
  }

  async function publishEverywhere(channel, message) {
    const results = await Promise.allSettled(NTFY_SERVERS.map(server =>
      fetchWithTimeout(`${server}/${channel}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(message)
      })
    ));
    const delivered = results.filter(result =>
      result.status === "fulfilled" && result.value.ok
    ).length;
    if (!delivered) throw new Error("Aucun relais disponible");
    return delivered;
  }

  async function pollEverywhere(channel) {
    const results = await Promise.allSettled(NTFY_SERVERS.map(async server => {
      const response = await fetchWithTimeout(
        `${server}/${channel}/json?poll=1&since=all`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseMessages(await response.text());
    }));
    const available = results.filter(result => result.status === "fulfilled");
    if (!available.length) throw new Error("Aucun relais disponible");
    return {
      messages: available.flatMap(result => result.value),
      available: available.length
    };
  }

  function setTransportStatus(kind, message) {
    const status = document.getElementById("transportStatus");
    status.className = `transport-status ${kind}`;
    status.textContent = message;
  }

  async function digest(value) {
    const data = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function saveSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  }

  function history() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (_) { return []; }
  }

  function saveToHistory(data) {
    if (!data || !data.code) return;
    const list = history().filter(item => item.code !== data.code);
    list.unshift({ code: data.code, createdAt: data.createdAt });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
  }

  function renderHistory() {
    const select = document.getElementById("historySelect");
    select.innerHTML = '<option value="">Sessions précédentes…</option>';
    history().filter(item => item.code !== sessionData.code).forEach(item => {
      const option = document.createElement("option");
      option.value = item.code;
      option.textContent = `${item.code} · ${new Date(item.createdAt).toLocaleString("fr-FR")}`;
      select.append(option);
    });
  }

  function renderQuestionSelector() {
    const select = document.getElementById("questionSelect");
    select.replaceChildren();
    questions.forEach((question, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${question.block} — ${question.title}`;
      select.append(option);
    });
    select.value = String(sessionData.selected);
    renderActiveQuestion();
  }

  function renderActiveQuestion() {
    const question = questions[sessionData.selected];
    const box = document.getElementById("activeQuestion");
    box.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = question.title;
    const span = document.createElement("span");
    const status = sessionData.syncError
      ? "NON TRANSMIS"
      : sessionData.open
        ? "Vote ouvert"
        : sessionData.reveal
          ? "Correction révélée"
          : "Vote fermé";
    span.textContent = `${question.context} · ${status}`;
    box.append(strong, span);
  }

  function parseMessages(text) {
    return text.split("\n").filter(Boolean).map(line => {
      try {
        const envelope = JSON.parse(line);
        if (envelope.event !== "message") return null;
        return JSON.parse(envelope.message);
      } catch (_) { return null; }
    }).filter(Boolean);
  }

  async function publishState() {
    const q = questions[sessionData.selected];
    const state = {
      kind: "state",
      session: sessionData.code,
      question: sessionData.selected,
      epoch: sessionData.epochs[q.id],
      open: sessionData.open,
      reveal: sessionData.reveal,
      ts: Date.now()
    };
    saveSession();
    renderActiveQuestion();
    setTransportStatus("sending", "Transmission de la question…");
    try {
      const delivered = await publishEverywhere(topic("state"), state);
      sessionData.syncError = false;
      setTransportStatus(
        "success",
        delivered === NTFY_SERVERS.length
          ? "Question synchronisée sur les téléphones."
          : "Question synchronisée par le relais de secours."
      );
      renderActiveQuestion();
      return true;
    } catch (_) {
      sessionData.syncError = true;
      setTransportStatus("error", "Question non transmise — vérifiez la connexion puis recliquez sur OUVRIR.");
      renderActiveQuestion();
      return false;
    }
  }

  function uniqueVotes(messages, question, epoch) {
    const latest = new Map();
    messages
      .filter(item => item.kind === "vote" && item.session === sessionData.code && item.question === question.id && item.epoch === epoch)
      .forEach(item => {
        const previous = latest.get(item.voter);
        if (!previous || (item.ts || 0) > (previous.ts || 0)) latest.set(item.voter, item);
      });
    return Array.from(latest.values());
  }

  function renderResults() {
    const question = questions[sessionData.selected];
    const epoch = sessionData.epochs[question.id];
    const votes = uniqueVotes(currentVotes, question, epoch);
    const total = votes.length;
    document.getElementById("responseCount").textContent = `${total} vote${total > 1 ? "s" : ""}`;
    const bars = document.getElementById("bars");
    bars.replaceChildren();
    question.options.forEach(option => {
      const count = votes.filter(vote => vote.answer === option.key).length;
      const percent = total ? Math.round(100 * count / total) : 0;
      const row = document.createElement("div");
      row.className = "bar-row" + (sessionData.reveal && option.key === question.correct ? " correct" : "");
      const letter = document.createElement("span");
      letter.className = "bar-letter";
      letter.textContent = option.key;
      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width = `${percent}%`;
      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = option.label;
      track.append(fill, label);
      const value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = `${count} · ${percent}%`;
      row.append(letter, track, value);
      bars.append(row);
    });
    const explanation = document.getElementById("resultsExplanation");
    explanation.classList.toggle("hidden", !sessionData.reveal);
    explanation.textContent = sessionData.reveal ? `Réponse ${question.correct} — ${question.explanation}` : "";
  }

  async function pollVotes() {
    if (pollBusy || !sessionData) return;
    pollBusy = true;
    try {
      const relay = await pollEverywhere(topic("votes"));
      currentVotes = relay.messages;
      renderResults();
    } catch (_) {
      document.getElementById("responseCount").textContent = "Reconnexion…";
    } finally {
      pollBusy = false;
    }
  }

  async function restoreState() {
    try {
      const relay = await pollEverywhere(topic("state"));
      const states = relay.messages
        .filter(item => item.kind === "state" && item.session === sessionData.code)
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const last = states.at(-1);
      if (last && questions[last.question]) {
        sessionData.selected = last.question;
        sessionData.open = Boolean(last.open);
        sessionData.reveal = Boolean(last.reveal);
        sessionData.epochs[questions[last.question].id] = last.epoch || 1;
        sessionData.syncError = false;
        setTransportStatus("success", "Tableau de bord connecté.");
      } else {
        sessionData.open = false;
        sessionData.reveal = false;
        sessionData.syncError = true;
        setTransportStatus("error", "Cette ancienne séance n’est pas encore synchronisée — cliquez sur OUVRIR LE VOTE.");
      }
    } catch (_) {
      sessionData.syncError = true;
      setTransportStatus("error", "Relais indisponibles — les commandes ne seront pas transmises.");
    }
    saveSession();
    renderAll();
  }

  function renderAll() {
    document.getElementById("adminSessionCode").textContent = sessionData.code;
    renderQuestionSelector();
    renderHistory();
    renderResults();
  }

  async function newSession() {
    if (sessionData) saveToHistory(sessionData);
    sessionData = {
      code: code(),
      createdAt: new Date().toISOString(),
      selected: 0,
      epochs: defaultEpochs(),
      open: false,
      reveal: false
    };
    currentVotes = [];
    saveSession();
    renderAll();
    await publishState();
  }

  function csvEscape(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  async function exportCsv() {
    const relay = await pollEverywhere(topic("votes"));
    const messages = relay.messages;
    const rows = [];
    const participantNumbers = new Map();
    questions.forEach(question => {
      const votes = uniqueVotes(messages, question, sessionData.epochs[question.id]);
      votes.forEach(vote => {
        if (!participantNumbers.has(vote.voter)) participantNumbers.set(vote.voter, participantNumbers.size + 1);
        rows.push([
          sessionData.code,
          question.id,
          question.title,
          `P${String(participantNumbers.get(vote.voter)).padStart(3, "0")}`,
          vote.answer,
          vote.answer === question.correct ? "1" : "0",
          new Date(vote.ts).toISOString()
        ]);
      });
    });
    const header = ["session", "question", "intitule", "participant_anonyme", "reponse", "correcte", "horodatage"];
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `ETC2026_QCM_${sessionData.code}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function showDashboard() {
    pinGate.classList.add("hidden");
    dashboard.classList.remove("hidden");
    try { sessionData = JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch (_) { sessionData = null; }
    if (!sessionData || !sessionData.code) await newSession();
    else {
      sessionData.epochs = { ...defaultEpochs(), ...(sessionData.epochs || {}) };
      await restoreState();
    }
    window.setInterval(pollVotes, 1600);
    pollVotes();
  }

  const hasPin = Boolean(localStorage.getItem(PIN_KEY));
  if (hasPin) {
    document.getElementById("pinTitle").textContent = "Déverrouiller le tableau de bord";
    document.getElementById("pinHelp").textContent = "Saisissez le code formateur défini sur cet ordinateur.";
  }

  document.getElementById("pinForm").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("pinInput").value;
    const error = document.getElementById("pinError");
    if (!/^\d{4,8}$/.test(input)) {
      error.textContent = "Utilisez 4 à 8 chiffres.";
      return;
    }
    const hash = await digest(input);
    const saved = localStorage.getItem(PIN_KEY);
    if (saved && saved !== hash) {
      error.textContent = "Code incorrect.";
      return;
    }
    if (!saved) localStorage.setItem(PIN_KEY, hash);
    document.getElementById("pinInput").value = "";
    showDashboard();
  });

  document.getElementById("lockButton").addEventListener("click", () => {
    dashboard.classList.add("hidden");
    pinGate.classList.remove("hidden");
  });
  document.getElementById("newSessionButton").addEventListener("click", () => {
    if (confirm("Démarrer une nouvelle séance ? Les résultats actuels resteront accessibles dans l’historique.")) newSession();
  });
  document.getElementById("questionSelect").addEventListener("change", async event => {
    sessionData.selected = Number(event.target.value);
    sessionData.open = false;
    sessionData.reveal = false;
    await publishState();
    renderResults();
  });
  document.getElementById("openButton").addEventListener("click", async () => {
    sessionData.open = true;
    sessionData.reveal = false;
    await publishState();
  });
  document.getElementById("closeButton").addEventListener("click", async () => {
    sessionData.open = false;
    sessionData.reveal = false;
    await publishState();
  });
  document.getElementById("revealButton").addEventListener("click", async () => {
    sessionData.open = false;
    sessionData.reveal = true;
    await publishState();
    renderResults();
  });
  document.getElementById("resetQuestionButton").addEventListener("click", async () => {
    const question = questions[sessionData.selected];
    if (!confirm(`Réinitialiser « ${question.title} » ?`)) return;
    sessionData.epochs[question.id] += 1;
    sessionData.open = false;
    sessionData.reveal = false;
    await publishState();
    renderResults();
  });
  document.getElementById("exportButton").addEventListener("click", exportCsv);
  document.getElementById("historySelect").addEventListener("change", async event => {
    const selectedCode = event.target.value;
    if (!selectedCode) return;
    saveToHistory(sessionData);
    const item = history().find(entry => entry.code === selectedCode);
    sessionData = {
      code: selectedCode,
      createdAt: item?.createdAt || new Date().toISOString(),
      selected: 0,
      epochs: defaultEpochs(),
      open: false,
      reveal: false
    };
    currentVotes = [];
    await restoreState();
    pollVotes();
  });

  const previewParams = new URLSearchParams(location.search);
  const preview = previewParams.get("preview") === "1";
  if (preview && ["127.0.0.1", "localhost"].includes(location.hostname)) {
    const previewCode = (previewParams.get("session") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (previewCode.length >= 5) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        code: previewCode,
        createdAt: new Date().toISOString(),
        selected: 0,
        epochs: defaultEpochs(),
        open: true,
        reveal: false
      }));
    }
    showDashboard();
  }
}());
