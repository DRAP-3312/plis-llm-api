const express = require('express');
const { spawn } = require('child_process');
const readline = require('readline');

const PORT = process.env.PORT || 8080;
const STOCKFISH_BIN = process.env.STOCKFISH_BIN || 'stockfish';

let engine;
let lineWaiters = [];

function startEngine() {
  engine = spawn(STOCKFISH_BIN, [], { stdio: ['pipe', 'pipe', 'pipe'] });

  const rl = readline.createInterface({ input: engine.stdout });
  rl.on('line', (line) => {
    for (const waiter of lineWaiters) {
      waiter.buffer.push(line);
      if (waiter.test(line)) waiter.resolve(waiter.buffer);
    }
  });

  engine.stderr.on('data', (data) => {
    console.error(`[stockfish stderr] ${data}`);
  });

  // El proceso de Stockfish no se relanza a sí mismo: si muere, se cae todo
  // el contenedor y es Docker (restart policy) quien lo vuelve a levantar.
  engine.on('exit', (code) => {
    console.error(`stockfish process exited (code ${code}), exiting container`);
    process.exit(1);
  });
}

function send(command) {
  engine.stdin.write(command + '\n');
}

// Acumula todas las líneas de stdout hasta que una cumpla `test`, o falla
// por timeout. Devuelve el buffer completo (útil para leer las líneas
// "info ..." previas a "bestmove").
function waitFor(test, timeoutMs) {
  return new Promise((resolve, reject) => {
    const waiter = {
      buffer: [],
      test,
      resolve: (buffer) => {
        lineWaiters = lineWaiters.filter((w) => w !== waiter);
        clearTimeout(timer);
        resolve(buffer);
      },
    };
    const timer = setTimeout(() => {
      lineWaiters = lineWaiters.filter((w) => w !== waiter);
      reject(new Error(`stockfish timeout waiting for match after ${timeoutMs}ms`));
    }, timeoutMs);
    lineWaiters.push(waiter);
  });
}

// Un solo proceso de Stockfish no puede atender dos búsquedas "go" a la vez:
// todas las requests HTTP se serializan por esta cola.
let queue = Promise.resolve();
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function parseScore(infoLine) {
  const cpMatch = infoLine.match(/score cp (-?\d+)/);
  if (cpMatch) return parseInt(cpMatch[1], 10);

  const mateMatch = infoLine.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const movesToMate = parseInt(mateMatch[1], 10);
    // No hay una convención centipawn "oficial" para mate. Usamos un valor
    // grande que preserva el signo y el orden entre líneas de mate.
    return movesToMate > 0 ? 100000 - movesToMate : -100000 - movesToMate;
  }
  return null;
}

function parseFirstPvMove(infoLine) {
  const pvMatch = infoLine.match(/ pv (\S+)/);
  return pvMatch ? pvMatch[1] : null;
}

async function runSearch({ fen, movetime, multiPV, elo }) {
  send('isready');
  await waitFor((line) => line === 'readyok', 5000);

  send(`setoption name MultiPV value ${multiPV}`);
  if (elo) {
    send('setoption name UCI_LimitStrength value true');
    send(`setoption name UCI_Elo value ${elo}`);
  } else {
    send('setoption name UCI_LimitStrength value false');
  }

  send(`position fen ${fen}`);
  send(`go movetime ${movetime}`);

  const lines = await waitFor((line) => line.startsWith('bestmove'), movetime + 3000);

  const byMultiPv = new Map();
  for (const line of lines) {
    if (!line.startsWith('info ')) continue;
    const multipvMatch = line.match(/multipv (\d+)/);
    if (!multipvMatch) continue;

    const score = parseScore(line);
    const uci = parseFirstPvMove(line);
    if (score === null || !uci) continue;

    // Cada profundidad reemite todas las líneas multipv; nos quedamos con la
    // última (la más profunda) para cada índice.
    byMultiPv.set(parseInt(multipvMatch[1], 10), { uci, score });
  }

  return [...byMultiPv.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, candidate]) => candidate);
}

const app = express();
app.use(express.json());

app.post('/evaluate', (req, res) => {
  const { fen, movetime } = req.body || {};
  if (!fen || !movetime) {
    return res.status(400).json({ error: 'fen and movetime are required' });
  }

  enqueue(() => runSearch({ fen, movetime, multiPV: 1 }))
    .then((candidates) => {
      if (candidates.length === 0) {
        return res.status(502).json({ error: 'no evaluation returned' });
      }
      res.json({ score: candidates[0].score });
    })
    .catch((err) => res.status(504).json({ error: err.message }));
});

app.post('/analyze', (req, res) => {
  const { fen, movetime, elo, multiPV } = req.body || {};
  if (!fen || !movetime || !multiPV) {
    return res.status(400).json({ error: 'fen, movetime and multiPV are required' });
  }

  enqueue(() => runSearch({ fen, movetime, multiPV, elo }))
    .then((candidates) => {
      if (candidates.length === 0) {
        return res.status(502).json({ error: 'no candidates returned' });
      }
      res.json({ bestScore: candidates[0].score, candidates });
    })
    .catch((err) => res.status(504).json({ error: err.message }));
});

app.get('/health', (req, res) => {
  res.json({ ok: Boolean(engine && !engine.killed) });
});

async function main() {
  startEngine();
  send('uci');
  await waitFor((line) => line === 'uciok', 5000);
  app.listen(PORT, () => {
    console.log(`stockfish-server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('failed to start stockfish-server', err);
  process.exit(1);
});
