const NotionFetcher = require('./notion-fetcher');
const winston = require('winston');

const currentDate = new Date(Date.now());
const currentDateString = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}_${currentDate.getHours()}-${currentDate.getMinutes()}-${currentDate.getSeconds()}-${currentDate.getMilliseconds()}`;

const original_logger = winston.createLogger({
    level: 'info',
    defaultMeta: { exclude: ['object'] },
    transports: [
        new winston.transports.Console({
            level: 'info',
            format: winston.format.combine(
                winston.format.simple(),
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp, module, ...meta }) => {
                    let return_string = `[${timestamp}] [${level}] [${module}]: ${message}`;
                    let new_meta = {...meta};
                    for (let tag in new_meta.exclude) {
                        delete new_meta[new_meta.exclude[tag]];
                    }

                    if (level.includes('error') && new_meta['error']) {
                        if (new_meta['error'].stack) {
                            return_string += ` ${new_meta['error'].stack}`;
                        }
                        else if(meta['error'].body) {
                            return_string += ` ${new_meta['error'].body}`;
                        }
                    }
                    if (new_meta.object) {
                        return_string += ' ' + JSON.stringify(new_meta.object, null, 4);
                    }
                    return return_string;
                })
            )
        }),

        new winston.transports.File({
            level: 'debug',
            format: winston.format.combine(
                winston.format.simple(),
                winston.format.printf((msg) => {
                    delete msg.exclude;
                    return msg;
                }),
                winston.format.prettyPrint()
            ),
            filename: `./logs/main-${currentDateString}.log`
        })
    ]
});
/** @param {NotionFetcher} fetcher */
async function findEssentials(fetcher) {
    let essentials = ['!RUN', '!CLEAR', '!Interface'];
    let result = [];
    for (let essential of essentials) {
        let found_object = await fetcher.findObject(essential);
        if (found_object) {
            result.push(found_object)
        }
    }
    return result;
}

async function startSubscribtion(fetcher, logger) {
    let run_button = await fetcher.getRunButton();
    run_button.on('pressed', () => {
        logger.info(`Button ${run_button.button_name} is pressed`);
    });
    run_button.on('unpressed', () => {
        logger.info(`Button ${run_button.button_name} is unpressed`);
        run_button.unsubscribe();
    })
    logger.info(`Subscribed for ${run_button.button_name}`);
    run_button.subscribe();
}

async function main() {
    const logger = original_logger.child({ module: 'main' });
    const fetcher = new NotionFetcher(logger.child({ module: 'NotionFetcher' }));
    fetcher.on('fetched root', () => {
        logger.info('Fetched root event', { object: fetcher.root_tree });
        startSubscribtion(fetcher, logger);
    });
    try {
        logger.info('Starting fetcher');
        fetcher.fetchFullTree();
    }
    catch (e) {
        logger.error('Error on start', { error: e });
        return;
    }
};

main();