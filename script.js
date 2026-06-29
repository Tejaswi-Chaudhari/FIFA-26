const LEAGUE_ID = "4429"; // FIFA World Cup, TheSportsDB
const SEASON = "2026";
const API_KEY = "123"; // TheSportsDB public test key
const API_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}/eventsseason.php?id=${LEAGUE_ID}&s=${SEASON}`;
const REFRESH_MS = 60000;

const ROUND_LABELS = {
  "1": "Group Stage",
  "2": "Group Stage",
  "3": "Group Stage",
  "140": "Round of 32",
  "150": "Round of 16",
  "160": "Quarter-Final",
  "170": "Semi-Final",
  "180": "Final",
  "190": "3rd Place Play-off",
};

const KNOCKOUT_ORDER = ["140", "150", "160", "170", "180"];

const bracketEl = document.getElementById("bracket");
const lastUpdatedEl = document.getElementById("last-updated");
const errorBannerEl = document.getElementById("error-banner");
const refreshBtn = document.getElementById("refresh-btn");

function showError(msg) {
  errorBannerEl.textContent = msg;
  errorBannerEl.classList.remove("hidden");
}

function clearError() {
  errorBannerEl.classList.add("hidden");
}

function flagUrl(badge) {
  return badge || "";
}

function statusInfo(event) {
  const status = (event.strStatus || "").toUpperCase();
  if (status.includes("FT") || status.includes("FINISH") || status.includes("MATCH FINISHED")) {
    return { label: "Finished", cls: "finished" };
  }
  if (status.includes("LIVE") || status === "1H" || status === "2H" || status === "HT" || status.includes("IN PLAY")) {
    return { label: "Live", cls: "live" };
  }
  return { label: "Scheduled", cls: "scheduled" };
}

function buildPlaceholderBracket() {
  const rounds = [
    { key: "140", label: "Round of 32", count: 16 },
    { key: "150", label: "Round of 16", count: 8 },
    { key: "160", label: "Quarter-Final", count: 4 },
    { key: "170", label: "Semi-Final", count: 2 },
    { key: "180", label: "Final", count: 1 },
  ];
  return rounds.map((r) => ({
    label: r.label,
    matches: Array.from({ length: r.count }, () => ({
      home: "TBD",
      away: "TBD",
      homeScore: null,
      awayScore: null,
      date: "",
      time: "",
      statusCls: "scheduled",
      statusLabel: "Scheduled",
      homeBadge: "",
      awayBadge: "",
    })),
  }));
}

function groupKnockoutEvents(events) {
  const byRound = {};
  for (const ev of events) {
    const r = String(ev.intRound);
    if (!KNOCKOUT_ORDER.includes(r)) continue;
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(ev);
  }
  return KNOCKOUT_ORDER.filter((r) => byRound[r] && byRound[r].length)
    .map((r) => ({
      label: ROUND_LABELS[r] || `Round ${r}`,
      matches: byRound[r].map((ev) => {
        const st = statusInfo(ev);
        return {
          home: ev.strHomeTeam || "TBD",
          away: ev.strAwayTeam || "TBD",
          homeScore: ev.intHomeScore,
          awayScore: ev.intAwayScore,
          date: ev.dateEvent || "",
          time: (ev.strTime || "").slice(0, 5),
          statusCls: st.cls,
          statusLabel: st.label,
          homeBadge: ev.strHomeTeamBadge,
          awayBadge: ev.strAwayTeamBadge,
        };
      }),
    }));
}

function renderBracket(rounds) {
  bracketEl.innerHTML = "";
  for (const round of rounds) {
    const roundEl = document.createElement("div");
    roundEl.className = "round";

    const title = document.createElement("div");
    title.className = "round-title";
    title.textContent = round.label;
    roundEl.appendChild(title);

    for (const m of round.matches) {
      roundEl.appendChild(renderMatch(m));
    }
    bracketEl.appendChild(roundEl);
  }
}

function renderMatch(m) {
  const card = document.createElement("div");
  card.className = "matchup";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <span>${m.date ? m.date : "Date TBD"}${m.time ? " · " + m.time : ""}</span>
    <span class="status-pill ${m.statusCls}">${m.statusLabel}</span>
  `;
  card.appendChild(meta);

  card.appendChild(renderTeamRow(m.home, m.homeScore, m.awayScore, m.homeBadge));
  card.appendChild(renderTeamRow(m.away, m.awayScore, m.homeScore, m.awayBadge));

  return card;
}

function renderTeamRow(name, score, otherScore, badge) {
  const row = document.createElement("div");
  const isWinner =
    score !== null && score !== undefined && otherScore !== null && otherScore !== undefined &&
    Number(score) > Number(otherScore);
  row.className = "team" + (isWinner ? " winner" : "");

  const nameEl = document.createElement("span");
  nameEl.className = "team-name";
  if (badge) {
    const img = document.createElement("img");
    img.className = "team-flag";
    img.src = flagUrl(badge);
    img.alt = "";
    img.onerror = () => { img.style.display = "none"; };
    nameEl.appendChild(img);
  }
  const text = document.createElement("span");
  text.textContent = name;
  nameEl.appendChild(text);

  const scoreEl = document.createElement("span");
  scoreEl.className = "team-score";
  scoreEl.textContent = score === null || score === undefined || score === "" ? "–" : score;

  row.appendChild(nameEl);
  row.appendChild(scoreEl);
  return row;
}

async function loadBracket() {
  lastUpdatedEl.textContent = "Refreshing…";
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`API responded with ${res.status}`);
    const data = await res.json();
    const events = data && data.events ? data.events : [];
    const rounds = groupKnockoutEvents(events);

    if (rounds.length) {
      renderBracket(rounds);
      clearError();
    } else {
      renderBracket(buildPlaceholderBracket());
      showError("Knockout fixtures aren't published yet — showing a placeholder bracket. It will fill in automatically once matches are scheduled.");
    }
  } catch (err) {
    console.error(err);
    renderBracket(buildPlaceholderBracket());
    showError("Couldn't reach the live data source right now — showing a placeholder bracket. Will retry automatically.");
  } finally {
    lastUpdatedEl.textContent = "Last updated: " + new Date().toLocaleTimeString();
  }
}

refreshBtn.addEventListener("click", loadBracket);
loadBracket();
setInterval(loadBracket, REFRESH_MS);
