const cron = require('node-cron');
const { spawn } = require('child_process');

function updatePrices() {
    const python = spawn('python', ['./updateprices.py']);
    python.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });
    python.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });
    python.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
}

// Run the Python script every 9 hours
cron.schedule('0 */9 * * *', updatePrices);

// Run the Python script on startup
updatePrices();
