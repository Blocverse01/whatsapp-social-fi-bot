import { Logtail } from '@logtail/node';
import env from '@/constants/env';

let logger: Logtail | undefined;

const getLogger = () => {
    if (!logger) {
        logger = new Logtail(env.LOG_TAIL_SOURCE_TOKEN, {
            sendLogsToConsoleOutput: env.NODE_ENV === 'development' || env.NODE_ENV === 'test',
        });
    }

    return logger;
};

export default getLogger();
