// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { socialLinkResource } from '@/lib/api/resources/socialLink';

export default socialLinkResource.reorder;
