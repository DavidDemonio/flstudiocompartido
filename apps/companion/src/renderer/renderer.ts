const startButton = document.getElementById('start') as HTMLButtonElement;
const stopButton = document.getElementById('stop') as HTMLButtonElement;
const rttLabel = document.getElementById('rtt') as HTMLSpanElement;
const timestampLabel = document.getElementById('timestamp') as HTMLSpanElement;
const statusLabel = document.getElementById('status') as HTMLParagraphElement;

startButton.addEventListener('click', async () => {
  statusLabel.textContent = 'Iniciando bridge…';
  try {
    await window.bridge.start({ roomId: 'default' });
    statusLabel.textContent = 'Bridge activo, enviando audio ASIO → WebRTC';
  } catch (error) {
    statusLabel.textContent = `Error: ${(error as Error).message}`;
  }
});

stopButton.addEventListener('click', async () => {
  await window.bridge.stop();
  statusLabel.textContent = 'Bridge detenido';
});

window.bridge.onStats((stats) => {
  rttLabel.textContent = stats.roundTripTimeMs ? stats.roundTripTimeMs.toFixed(2) : 'N/A';
  timestampLabel.textContent = new Date(stats.timestamp).toLocaleTimeString();
});

window.bridge.onError((message) => {
  statusLabel.textContent = `Error: ${message}`;
});
