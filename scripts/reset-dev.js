const { spawnSync } = require("child_process");

const PORTAS = [3000, 4301];

function executar(cmd, args) {
  return spawnSync(cmd, args, {
    encoding: "utf-8",
    windowsHide: true
  });
}

function listarPidsPorPorta(porta) {
  const resultado = executar("netstat", ["-ano", "-p", "tcp"]);
  if (resultado.status !== 0) {
    return [];
  }

  const pids = new Set();
  const alvo = `:${porta}`;

  resultado.stdout
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .forEach((linha) => {
      if (!linha.includes("LISTENING")) {
        return;
      }

      if (!linha.includes(alvo)) {
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

function encerrarPid(pid) {
  const retorno = executar("taskkill", ["/PID", String(pid), "/T", "/F"]);
  return retorno.status === 0;
}

function main() {
  if (process.platform !== "win32") {
    console.log("Este script foi feito para Windows.");
    process.exit(0);
  }

  const pids = new Set();
  PORTAS.forEach((porta) => {
    listarPidsPorPorta(porta).forEach((pid) => pids.add(pid));
  });

  if (pids.size === 0) {
    console.log("Nenhum processo ocupando as portas 3000/4301.");
    return;
  }

  let falhou = false;
  [...pids].forEach((pid) => {
    const ok = encerrarPid(pid);
    if (ok) {
      console.log(`PID ${pid} encerrado.`);
    } else {
      falhou = true;
      console.log(`Nao foi possivel encerrar PID ${pid}. Rode o terminal como administrador.`);
    }
  });

  if (falhou) {
    process.exit(1);
  }
}

main();
