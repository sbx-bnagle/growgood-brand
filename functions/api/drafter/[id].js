// The drafting workflow’s door: GET reads the brief, POST stores the draft. It sits outside
// Cloudflare Access and signs its calls with DRAFTER_SECRET instead. D-057.
import { handle, drafterRead, drafterWrite } from '../../../request-app/app.mjs';

export const onRequestGet = handle(drafterRead);
export const onRequestPost = handle(drafterWrite);
