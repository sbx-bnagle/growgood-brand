// GET: a draft’s PDF or PNG, to view or, with ?download, to save (review gate G3). D-057.
import { handle, readFile } from '../../../../../request-app/app.mjs';

export const onRequestGet = handle(readFile);
