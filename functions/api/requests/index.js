// GET: every request, newest first. POST: a new request (review gate G1 confirmed). D-057.
import { handle, listRequests, createRequest } from '../../../request-app/app.mjs';

export const onRequestGet = handle(listRequests);
export const onRequestPost = handle(createRequest);
