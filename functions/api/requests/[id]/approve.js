// POST: an approver approves a draft (review gate G2, D-047). D-057.
import { handle, approveRequest } from '../../../../request-app/app.mjs';

export const onRequestPost = handle(approveRequest);
