import config from './playwright.config';
export default { ...config, testMatch: '**/record-history.spec.ts', outputDir: 'test-results-history' };
