/* =====================================================================
   SupportDesk — Priority Queue Ticket System
   A binary MIN-HEAP implemented from scratch (no libraries).
   Key for each ticket: priority * 10000 + arrival sequence
     -> lower priority number sorts first (Critical < High < Medium < Low)
     -> equal priorities are served FIFO (smaller arrival # wins)
   ===================================================================== */

/* ================= Min-Heap Priority Queue ================= */
class MinHeap {
  constructor() {
    this.arr = []; // stores ticket objects; ordering uses ticket.key
  }

  size() { return this.arr.length; }
  peek() { return this.arr[0] ?? null; }

  /* O(log n) — insert then bubble up */
  enqueue(ticket) {
    this.arr.push(ticket);
    this._bubbleUp(this.arr.length - 1);
  }

  /* O(log n) — move root to end, pop it, then sift down */
  dequeue() {
    if (this.arr.length === 0) return null;
    const top = this.arr[0];
    const last = this.arr.pop();
    if (this.arr.length > 0) {
      this.arr[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.arr[i].key < this.arr[parent].key) {
        [this.arr[i], this.arr[parent]] = [this.arr[parent], this.arr[i]];
        i = parent;
      } else break;
    }
  }

  _siftDown(i) {
    const n = this.arr.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.arr[l].key < this.arr[smallest].key) smallest = l;
      if (r < n && this.arr[r].key < this.arr[smallest].key) smallest = r;
      if (smallest === i) break;
      [this.arr[i], this.arr[smallest]] = [this.arr[smallest], this.arr[i]];
      i = smallest;
    }
  }
}

/* ================= Application State ================= */
const PRIO = {
  1: { name: "Critical", cls: "critical" },
  2: { name: "High",     cls: "high" },
  3: { name: "Medium",   cls: "medium" },
  4: { name: "Low",      cls: "low" },
};

const heap = new MinHeap();
let arrivalSeq = 0;
let selectedPriority = 1;
let serving = null;          // ticket currently in progress
let resolved = [];           // resolved tickets (most recent first)
let simTimer = null;
let simRunning = true;

/* ================= DOM refs ================= */
const $ = (id) => document.getElementById(id);
const customerInput = $("customerInput");
const issueInput = $("issueInput");
const priorityPicker = $("priorityPicker");
const heapViz = $("heapViz");
const queueList = $("queueList");
const opLog = $("opLog");
const servingArea = $("servingArea");
const resolvedList = $("resolvedList");
const serveBtn = $("serveBtn");

/* ================= Helpers ================= */
function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function log(type, html) {
  const li = document.createElement("li");
  li.className = type;
  li.innerHTML = `<span class="t">[${fmtTime(new Date())}]</span> ${html}`;
  opLog.prepend(li);
  while (opLog.children.length > 120) opLog.lastChild.remove();
}

/* ================= Rendering ================= */
function renderStats() {
  $("statWaiting").textContent = heap.size();
  $("statServing").textContent = serving ? 1 : 0;
  $("statResolved").textContent = resolved.length;
  $("statServed").textContent = resolved.length;

  const avgEl = $("statAvgWait");
  if (resolved.length === 0) { avgEl.textContent = "0s"; return; }
  const total = resolved.reduce((s, t) => s + (t.servedAt - t.enqueuedAt), 0);
  avgEl.textContent = Math.round(total / resolved.length / 1000) + "s";
}

function renderHeap() {
  heapViz.innerHTML = "";
  if (heap.size() === 0) {
    heapViz.innerHTML = `<span class="heap-empty">Heap is empty — enqueue a ticket to see it inserted with bubble-up.</span>`;
    return;
  }
  heap.arr.forEach((t, i) => {
    const cell = document.createElement("div");
    cell.className = `heap-cell k${t.priority}` + (i === 0 ? " root" : "");
    cell.title = `${t.customer} — ${PRIO[t.priority].name}`;
    cell.innerHTML = `<div class="idx">[${i}]</div><div class="key">${t.key}</div><div class="seq">#${t.seq}</div>`;
    heapViz.appendChild(cell);
  });
}

function dequeuePreview() {
  /* Snapshot of dequeue order without mutating: replicate with a clone */
  const clone = new MinHeap();
  clone.arr = heap.arr.slice();
  const order = [];
  while (clone.size() > 0) order.push(clone.dequeue());
  return order;
}

function renderQueue() {
  queueList.innerHTML = "";
  const order = dequeuePreview();
  if (order.length === 0) {
    queueList.innerHTML = `<li class="queue-empty" style="border:none;background:none;">Queue is empty.</li>`;
    return;
  }
  order.forEach((t, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="queue-pos ${i === 0 ? "front" : ""}">${i === 0 ? "FRONT" : i + 1}</span>
      <span class="queue-main">
        <span class="who">${escapeHtml(t.customer)}</span>
        <span class="what">${escapeHtml(t.issue)}</span>
      </span>
      <span class="badge badge-${PRIO[t.priority].cls}">${PRIO[t.priority].name}</span>
      <span class="queue-key">${t.key}</span>`;
    queueList.appendChild(li);
  });
}

function renderServing() {
  if (!serving) {
    servingArea.innerHTML = `<p class="empty-hint">No ticket in progress.<br/>Press <strong>Dequeue &amp; Serve</strong> to take the highest-priority ticket.</p>`;
  } else {
    servingArea.innerHTML = `
      <div class="serving-card">
        <span class="who">${escapeHtml(serving.customer)}</span>
        <div class="what">${escapeHtml(serving.issue)}</div>
        <div class="serving-meta">
          <span class="badge badge-${PRIO[serving.priority].cls}">${PRIO[serving.priority].name}</span>
          <span>key ${serving.key}</span>
          <span>waiting ${Math.round((Date.now() - serving.enqueuedAt) / 1000)}s</span>
        </div>
        <div class="serving-actions">
          <button class="btn" id="resolveBtn">✓ Resolve</button>
        </div>
      </div>`;
    const rb = $("resolveBtn");
    if (rb) rb.addEventListener("click", resolveCurrent);
  }
  serveBtn.disabled = !!serving || heap.size() === 0;
}

function renderResolved() {
  if (resolved.length === 0) {
    resolvedList.innerHTML = `<li class="resolved-empty" style="border:none;background:none;">Nothing resolved yet.</li>`;
    return;
  }
  resolvedList.innerHTML = resolved.slice(0, 15).map((t) => `
    <li>
      <span class="check">✓</span>
      <span class="who">${escapeHtml(t.customer)}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.issue)}</span>
      <span class="badge badge-${PRIO[t.priority].cls}">${PRIO[t.priority].name}</span>
    </li>`).join("");
}

function renderAll() {
  renderStats();
  renderHeap();
  renderQueue();
  renderServing();
  renderResolved();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ================= Core actions ================= */
function addTicket(customer, issue, priority, { silent = false } = {}) {
  arrivalSeq += 1;
  const ticket = {
    seq: arrivalSeq,
    priority,
    key: priority * 10000 + arrivalSeq, // FIFO tie-break via arrival sequence
    customer,
    issue,
    enqueuedAt: Date.now(),
  };
  heap.enqueue(ticket);
  if (!silent) {
    log("enqueue", `enqueue(<strong>#${ticket.seq}</strong> ${escapeHtml(customer)}) → key <strong>${ticket.key}</strong> · heap size ${heap.size()}`);
    log("heap", `bubble-up applied · O(log n)`);
  }
  renderAll();
}

function serveNext() {
  if (serving) return;
  const t = heap.dequeue();
  if (!t) return;
  serving = t;
  t.servedAt = Date.now();
  log("dequeue", `dequeue() → <strong>#${t.seq}</strong> ${escapeHtml(t.customer)} · key ${t.key} · sift-down applied`);
  renderAll();
}

function resolveCurrent() {
  if (!serving) return;
  resolved.unshift(serving);
  log("resolve", `resolved <strong>#${serving.seq}</strong> ${escapeHtml(serving.customer)} · waited ${Math.round((serving.servedAt - serving.enqueuedAt) / 1000)}s`);
  serving = null;
  renderAll();
}

/* ================= Event wiring ================= */
priorityPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".prio");
  if (!btn) return;
  priorityPicker.querySelectorAll(".prio").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  selectedPriority = Number(btn.dataset.p);
});

$("ticketForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const customer = customerInput.value.trim();
  const issue = issueInput.value.trim();
  if (!customer || !issue) return;
  addTicket(customer, issue, selectedPriority);
  customerInput.value = "";
  issueInput.value = "";
  issueInput.focus();
});

serveBtn.addEventListener("click", serveNext);

$("clearLog").addEventListener("click", () => { opLog.innerHTML = ""; });

$("simToggle").addEventListener("click", () => {
  simRunning = !simRunning;
  $("simToggle").textContent = simRunning ? "⏸ Pause arrivals" : "▶ Resume arrivals";
  if (simRunning) startSim(); else stopSim();
});

/* ================= Simulated live arrivals ================= */
const SAMPLE_CUSTOMERS = ["Alice Nguyen", "Ben Carter", "Chloe Diaz", "Dan Kim", "Emma Rossi", "Farid Khan", "Grace Lee", "Hugo Martins", "Ivy Chen", "Jack O'Neill"];
const SAMPLE_ISSUES = [
  "Cannot reset password", "Payment declined at checkout", "App crashes on launch",
  "Wrong invoice amount", "2FA code never arrives", "Export button does nothing",
  "Page loads very slowly", "Add dark mode please", "Refund not received",
  "Change account email", "Session keeps expiring", "Feature request: dark theme",
];

function startSim() {
  stopSim();
  simTimer = setInterval(() => {
    if (heap.size() > 9) return; // keep the queue a reasonable size
    const c = SAMPLE_CUSTOMERS[Math.floor(Math.random() * SAMPLE_CUSTOMERS.length)];
    const i = SAMPLE_ISSUES[Math.floor(Math.random() * SAMPLE_ISSUES.length)];
    const weights = [1, 2, 3, 3, 3, 4, 4]; // skew toward mid/low priorities
    const p = weights[Math.floor(Math.random() * weights.length)];
    addTicket(c, i, p, { silent: true });
    log("enqueue", `auto-arrival <strong>#${arrivalSeq}</strong> ${escapeHtml(c)} · ${PRIO[p].name} · key ${arrivalSeq + p * 10000}`);
  }, 4500);
}
function stopSim() { if (simTimer) clearInterval(simTimer); simTimer = null; }

/* ================= Seed demo tickets ================= */
[
  ["Alice Nguyen", "Server outage on checkout page", 1],
  ["Ben Carter", "Refund not received after 5 days", 2],
  ["Chloe Diaz", "Feature request: dark mode toggle", 4],
  ["Dan Kim", "Cannot reset password", 2],
  ["Emma Rossi", "Report generation stuck at 90%", 3],
].forEach(([c, i, p]) => addTicket(c, i, p, { silent: true }));
log("heap", `demo tickets seeded · heapify applied on build`);

startSim();
renderAll();
