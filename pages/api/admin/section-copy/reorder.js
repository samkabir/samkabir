// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { sectionCopyResource } from '@/lib/api/resources/sectionCopy';

export default sectionCopyResource.reorder;
