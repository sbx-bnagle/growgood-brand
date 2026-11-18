// POST: a note back to the drafter, from the reviewer or the requester; drafting runs again. D-057.
import { handle, replyToRequest } from '../../../../request-app/app.mjs';

export const onRequestPost = handle(replyToRequest);
