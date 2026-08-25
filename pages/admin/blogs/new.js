import Link from 'next/link';
import { Box } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import PostEditor from '@/components/admin/PostEditor';
import { ErrorState, LoadingRows } from '@/components/admin/States';
import { useResource } from '@/components/admin/useResource';
import { withAdminPage } from '@/lib/adminPage';
import { HINT } from '@/lib/adminTheme';

/**
 * `/admin/blogs/new` — write a post.
 *
 * The only thing this screen loads is the tag list; the editor itself starts
 * empty. Tags are fetched here rather than passed as a prop because the same
 * `PostEditor` serves the edit screen, and both want the *current* tags — a tag
 * added on the Blog screen a moment ago should be selectable without a deploy.
 *
 * `PostEditor` is given `post={null}` and `mode="create"`. It does the rest:
 * validates with the create schema, POSTs, and on success replaces this route
 * with `/admin/blogs/[id]` so a second save edits the post rather than making a
 * duplicate.
 */
function NewPostScreen({ adminUser }) {
  const tags = useResource('/api/admin/tags', { query: { take: 200 } });

  return (
    <AdminLayout
      title="New post"
      number="20."
      user={adminUser}
      hint="Saved as a draft first — nothing is public until you publish it."
    >
      <Box className="pb-4">
        <Link href="/admin/blogs" className={HINT}>
          ← back to all posts
        </Link>
      </Box>

      {tags.loading ? (
        <LoadingRows rows={4} label="Loading the editor…" />
      ) : tags.error ? (
        <ErrorState message={tags.error} onRetry={tags.reload} />
      ) : (
        <PostEditor post={null} tags={tags.items} mode="create" />
      )}
    </AdminLayout>
  );
}

/**
 * Wrapped so the theme and toast providers sit *above* the screen — the same
 * arrangement every dashboard page uses. See the note on `adminScreen`.
 */
export default adminScreen(NewPostScreen);

export const getServerSideProps = withAdminPage();
