// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { skillResource } from '@/lib/api/resources/skill';

export default skillResource.item;
