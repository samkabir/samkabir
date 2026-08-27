// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { blogPostResource } from '@/lib/api/resources/blogPost';

export default blogPostResource.publish;
