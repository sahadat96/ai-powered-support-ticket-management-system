const path = require('node:path');
require('dotenv').config({path: path.resolve(__dirname, '../../../.env'), quiet: true});
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required for PostgreSQL integration tests');
const url = new URL(process.env.DATABASE_URL);
process.env.TEST_SCHEMA = `test_${process.pid}_${Date.now()}`;
url.searchParams.set('schema', process.env.TEST_SCHEMA);
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'test';
