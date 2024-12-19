const Logger = require('./src/logger.js');
const Server = require('./src/webserver.js');
const Router = require('./src/router.js');
const Socket = require('./src/socketserver.js');
const Locale = require('./src/locale.js');
const Dict = require('./src/dictionary.js');
const Dist = require('./src/letter-distributions.js');
const Helpers = require('./src/helpers.js');

require('dotenv').config();

async function main() {
    Logger.SetLevel(Logger.VERBOSE_LOGS);
    Logger.init();

    await Locale.init();
    await Server.init();
    await Socket.init();
    await Router.init();

    Logger.ready();
}

function benchmarkDictionary() {
    let hrTime = process.hrtime();
    let startTime = hrTime[0] * 1000000 + hrTime[1] / 1000;

    // Time 10 thousand reads using the API-based dictionary
    const promises = [];
    for (let i = 0; i < 100; i++) { // Reduced to 100 since we're using API calls now
        promises.push(Dict.FindWord('en', 'test'));
    }

    Promise.all(promises).then(() => {
        hrTime = process.hrtime();
        let endTime = hrTime[0] * 1000000 + hrTime[1] / 1000;
        Logger.debug(`100 API Dictionary Reads: ${endTime - startTime}μs`);
    });
}

main();
