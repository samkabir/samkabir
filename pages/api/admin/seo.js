// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { seoResource } from '@/lib/api/resources/seo';

export default seoResource.handler;
