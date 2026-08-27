// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { changePasswordHandler } from '@/lib/api/resources/account';

export default changePasswordHandler;
