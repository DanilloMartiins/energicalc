const { spawn, spawnSync } = require("child_process");
const net = require("net");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const PORTAS_OBRIGATORIAS = [3000, 4301];

let encerrando = false;

function iniciarProcesso(label, args) {
  const child = spawn(npmCmd, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });

  child.on("error", (error) => {
    console.error(`[${label}] erro ao iniciar:`, error.message);
    finalizarComFalha();
  });

  child.on("exit", (code, signal) => {
    if (encerrando) {
      return;
    }

    if (signal) {
      console.log(`[${label}] finalizado por sinal ${signal}.`);
    } else {
      console.log(`[${label}] finalizado com codigo ${code}.`);
    }

    if (code !== 0) {
      finalizarComFalha();
    } else {
      finalizarComSucesso();
    }
  });

  return child;
}

let backendProcess;
let frontendProcess;

function encerrarProcessos() {
  encerrando = true;

  encerrarProcesso(backendProcess);
  encerrarProcesso(frontendProcess);
}

function encerrarProcesso(child) {
  if (!child || !child.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore"
    });
    return;
  }

  if (!child.killed) {
    child.kill("SIGINT");
  }
}

function portaDisponivel(porta) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    // Sem host explicito, o Node valida conflito considerando bindings locais existentes
    // (127.0.0.1, ::1, 0.0.0.0), evitando falso "livre" em Windows.
    server.listen(porta);
  });
}

function executarComando(cmd, args) {
  const result = spawnSync(cmd, args, {
    encoding: "utf-8",
    windowsHide: true
  });

  if (result.error) {
    return { ok: false, stdout: "", stderr: result.error.message };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      stdout: result.stdout || "",
      stderr: result.stderr || ""
    };
  }

  return {
    ok: true,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function listarPidsPorPortaWindows(porta) {
  const consulta = executarComando("netstat", ["-ano", "-p", "tcp"]);
  if (!consulta.ok) {
    return [];
  }

  const alvoIPv4 = `:${porta}`;
  const alvoIPv6 = `:${porta}`;

  const pids = new Set();
  consulta.stdout
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .forEach((linha) => {
      if (!linha.includes("LISTENING")) {
        return;
      }

      if (!linha.includes(alvoIPv4) && !linha.includes(alvoIPv6)) {
        return;
      }

      const partes = linha.split(/\s+/);
      const pid = Number(partes[partes.length - 1]);
      if (Number.isFinite(pid) && pid > 0) {
        pids.add(pid);
      }
    });

  return [...pids];
}

function encerrarPidWindows(pid) {
  const resultado = executarComando("taskkill", ["/PID", String(pid), "/T", "/F"]);
  return resultado.ok;
}

function tentarLiberarPortasWindows() {
  const relatorio = [];

  PORTAS_OBRIGATORIAS.forEach((porta) => {
    const pids = listarPidsPorPortaWindows(porta);

    pids.forEach((pid) => {
      const encerrado = encerrarPidWindows(pid);

      relatorio.push({
        porta,
        pid,
        encerrado
      });
    });
  });

  return relatorio;
}

async function validarPortas() {
  if (process.platform === "win32") {
    const ocupadas = PORTAS_OBRIGATORIAS.filter((porta) => {
      return listarPidsPorPortaWindows(porta).length > 0;
    });

    if (ocupadas.length === 0) {
      return true;
    }

    console.error(
      `Porta(s) em uso: ${ocupadas.join(", ")}. Encerre processos antigos antes de subir o ambiente.`
    );
    console.error(
      "Sugestao (PowerShell): netstat -ano | findstr :3000 e netstat -ano | findstr :4301"
    );
    return false;
  }

  const verificacoes = await Promise.all(
    PORTAS_OBRIGATORIAS.map(async (porta) => ({
      porta,
      disponivel: await portaDisponivel(porta)
    }))
  );

  const ocupadas = verificacoes.filter((item) => !item.disponivel).map((item) => item.porta);
  if (ocupadas.length === 0) {
    return true;
  }

  console.error(
    `Porta(s) em uso: ${ocupadas.join(", ")}. Encerre processos antigos antes de subir o ambiente.`
  );
  console.error(
    "Sugestao (PowerShell): netstat -ano | findstr :3000 e netstat -ano | findstr :4301"
  );
  return false;
}

function finalizarComFalha() {
  if (encerrando) {
    return;
  }

  encerrarProcessos();
  process.exit(1);
}

function finalizarComSucesso() {
  if (encerrando) {
    return;
  }

  encerrarProcessos();
  process.exit(0);
}

process.on("SIGINT", () => {
  encerrarProcessos();
  process.exit(0);
});

process.on("SIGTERM", () => {
  encerrarProcessos();
  process.exit(0);
});

async function main() {
  if (process.platform === "win32") {
    const relatorio = tentarLiberarPortasWindows();
    relatorio.forEach((item) => {
      if (item.encerrado) {
        console.log(`Processo antigo encerrado: porta ${item.porta}, pid ${item.pid}`);
      } else {
        console.log(
          `Nao foi possivel encerrar pid ${item.pid} na porta ${item.porta}. Tente abrir o terminal como administrador.`
        );
      }
    });
  }

  const portasOk = await validarPortas();
  if (!portasOk) {
    process.exit(1);
  }

  console.log("Subindo backend e frontend em paralelo...");
  console.log("Frontend: http://localhost:4301");
  console.log("Backend:  http://localhost:3000");
  console.log("Health:   http://localhost:3000/health");

  backendProcess = iniciarProcesso("backend", ["--prefix", "backend", "run", "dev"]);
  frontendProcess = iniciarProcesso("frontend", ["--prefix", "frontend", "run", "start"]);
}

main().catch((error) => {
  console.error("Falha ao iniciar ambiente de desenvolvimento:", error.message);
  finalizarComFalha();
});
