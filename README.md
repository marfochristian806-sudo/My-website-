# SupportDesk — Priority Queue Ticket System

Data structures assignment: a support ticket dashboard built around a
**priority queue**, implemented from scratch as a binary **min-heap**.

## How the queue is used
- Each ticket gets `key = priority × 10000 + arrival sequence`
- Lower priority number is served first (Critical → High → Medium → Low)
- Tickets with equal priority are served **FIFO** by arrival order
- `enqueue()` — O(log n) bubble-up
- `dequeue()` — O(log n) sift-down
- `peek()` — O(1)

## Features
- Live min-heap array visualization (root highlighted, color-coded priorities)
- Dequeue-order preview panel
- Timestamped operation log (enqueue/dequeue/bubble-up/sift-down)
- Now Serving → Resolve workflow with wait-time stats
- Simulated live ticket arrivals (pausable)

## Run it
Just open `index.html` in a browser, or serve the folder:
```
python3 -m http.server 8000
```
