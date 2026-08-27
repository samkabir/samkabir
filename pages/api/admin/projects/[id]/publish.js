// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { projectResource } from '@/lib/api/resources/project';

export default projectResource.publish;
