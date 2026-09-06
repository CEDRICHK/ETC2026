(function () {
  "use strict";

  const NTFY_SERVERS = [
    "https://ntfy.tedomum.fr",
    "https://ntfy.hostux.net"
  ];
  const questions = window.ETC_QUESTIONS;
  const joinView = document.getElementById("joinView");
  const participantView = document.getElementById("participantView");
  const waitingView = document.getElementById("waitingView");
  const questionView = document.getElementById("questionView");
  const correctionView = document.getElementById("correctionView");
  const joinError = document.getElementById("joinError");
  const feedback = document.getElementById("voteFeedback");
  const voterId = localStorage.getItem("etc2026VoterId") || crypto.randomUUID();
  localStorage.setItem("etc2026VoterId", voterId);

  let session = "";
  let currentState = null;
  let polling = false;

  function normalizeCode(value) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function topic(kind) {
    return `etc2026-${session.toLowerCase()}-${kind}`;
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

  function setConnection(ok, label) {
    document.getElementById("connectionDot").classList.toggle("live", ok);
    document.getElementById("connectionLabel").textContent = label;
  }

  function parseMessages(text) {
    return text.split("\n").filter(Boolean).map(line => {
      try {
        const envelope = JSON.parse(line);
        if (envelope.event !== "message") return null;
        return JSON.parse(envelope.message);
      } catch (_) {
        return null;
      }
    }).filter(Boolean);
  }

  function latestState(messages) {
    return messages
      .filter(item => item.kind === "state" && item.session === session)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .at(-1) || null;
  }

  function renderState(state) {
    if (!state || !Number.isInteger(state.question)) {
      waitingView.classList.remove("hidden");
      questionView.classList.add("hidden");
      correctionView.classList.add("hidden");
      return;
    }

    const q = questions[state.question];
    if (!q) return;
    waitingView.classList.add("hidden");
    questionView.classList.remove("hidden");
    document.getElementById("questionBlock").textContent = `${q.block} · QCM ${state.question + 1}/5`;
    document.getElementById("questionTitle").textContent = q.title;
    document.getElementById("questionContext").textContent = q.context;

    const savedKey = `etc2026Vote:${session}:${q.id}:${state.epoch}`;
    const savedAnswer = localStorage.getItem(savedKey);
    const list = document.getElementById("answersList");
    list.replaceChildren();
    q.options.forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-button" + (savedAnswer === option.key ? " selected" : "");
      button.disabled = !state.open;
      const letter = document.createElement("span");
      letter.className = "answer-letter";
      letter.textContent = option.key;
      const copy = document.createElement("span");
      copy.className = "answer-copy";
      const strong = document.createElement("strong");
      strong.textContent = option.label;
      const detail = document.createElement("span");
      detail.textContent = option.detail;
      copy.append(strong, detail);
      button.append(letter, copy);
      button.addEventListener("click", () => submitVote(q, option.key, state.epoch, savedKey));
      list.append(button);
    });

    feedback.className = "vote-feedback";
    if (state.open) {
      feedback.textContent = savedAnswer ? "Votre réponse est enregistrée. Vous pouvez encore la modifier." : "Choisissez une réponse.";
      if (savedAnswer) feedback.classList.add("success");
    } else {
      feedback.textContent = state.reveal ? "Réponse révélée par le formateur." : "Le vote est fermé.";
    }

    correctionView.classList.toggle("hidden", !state.reveal);
    if (state.reveal) {
      document.getElementById("correctionAnswer").textContent = `Réponse ${q.correct} — `;
      document.getElementById("correctionText").textContent = q.explanation;
    }
  }

  async function submitVote(question, answer, epoch, savedKey) {
    if (!currentState || !currentState.open || currentState.epoch !== epoch) return;
    feedback.className = "vote-feedback";
    feedback.textContent = "Envoi…";
    const message = {
      kind: "vote",
      session,
      question: question.id,
      answer,
      epoch,
      voter: voterId,
      ts: Date.now()
    };
    try {
      await publishEverywhere(topic("votes"), message);
      localStorage.setItem(savedKey, answer);
      feedback.className = "vote-feedback success";
      feedback.textContent = "Réponse enregistrée. Vous pouvez encore la modifier tant que le vote reste ouvert.";
      renderState(currentState);
    } catch (_) {
      feedback.textContent = "Envoi impossible. Vérifiez la connexion puis réessayez.";
    }
  }

  async function pollState() {
    if (polling || !session) return;
    polling = true;
    try {
      const relay = await pollEverywhere(topic("state"));
      const next = latestState(relay.messages);
      setConnection(true, relay.available === NTFY_SERVERS.length ? "Connecté" : "Connecté · relais de secours");
      if (next && (!currentState || next.ts !== currentState.ts)) {
        currentState = next;
        renderState(next);
      }
    } catch (_) {
      setConnection(false, "Reconnexion…");
    } finally {
      polling = false;
    }
  }

  function join(code) {
    session = normalizeCode(code);
    if (session.length < 5) {
      joinError.textContent = "Le code doit contenir au moins cinq caractères.";
      return;
    }
    localStorage.setItem("etc2026LastSession", session);
    document.getElementById("sessionCode").textContent = session;
    joinView.classList.add("hidden");
    participantView.classList.remove("hidden");
    pollState();
    window.setInterval(pollState, 2500);
  }

  document.getElementById("sessionInput").addEventListener("input", event => {
    event.target.value = normalizeCode(event.target.value);
  });
  document.getElementById("joinForm").addEventListener("submit", event => {
    event.preventDefault();
    join(document.getElementById("sessionInput").value);
  });

  const params = new URLSearchParams(location.search);
  const preset = normalizeCode(params.get("session") || "");
  document.getElementById("sessionInput").value = preset || localStorage.getItem("etc2026LastSession") || "";
  if (preset) join(preset);
}());
