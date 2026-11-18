// GET: one request, with its brief, history, draft and check report. D-057.
import { handle, readRequest } from '../../../../request-app/app.mjs';

export const onRequestGet = handle(readRequest);
