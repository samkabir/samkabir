// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { tagResource } from '@/lib/api/resources/tag';

export default tagResource.collection;
