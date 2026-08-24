// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { experienceResource } from '@/lib/api/resources/experience';

export default experienceResource.reorder;
