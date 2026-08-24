// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { activateResumeHandler } from '@/lib/api/resources/resume';

export default activateResumeHandler;
