import config from './playwright.config';
export default {...config,testMatch:['**/annotation-review.spec.ts','**/record-history.spec.ts']};
