import morgan from 'morgan';

// Pre-configured morgan format for development / production
export const requestLogger = morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev');
