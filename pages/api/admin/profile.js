// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { profileResource } from '@/lib/api/resources/profile';

export default profileResource.handler;
