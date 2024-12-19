const ngrok = require('ngrok');

(async function() {
    try {
        // Disconnect any existing tunnels
        await ngrok.kill();
        
        const url = await ngrok.connect({
            proto: 'http',
            addr: 8080,
            authtoken: process.env.NGROK_AUTH_TOKEN,
            onStatusChange: status => {
                console.log('Ngrok Status:', status);
            },
            onLogEvent: log => {
                console.log('Ngrok Log:', log);
            }
        });
        console.log('Ngrok tunnel created:', url);
        
        // Keep the process alive
        process.on('SIGINT', async () => {
            await ngrok.kill();
            process.exit(0);
        });
    } catch (err) {
        console.error('Error creating tunnel:', err);
        process.exit(1);
    }
})();
