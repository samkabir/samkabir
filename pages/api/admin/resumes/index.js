// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { resumeResource } from '@/lib/api/resources/resume';

export default resumeResource.collection;
